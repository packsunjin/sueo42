# [역할] 3-2: AI-Hub「수어 영상」 문장(SEN) 손 좌표에서 앱 42개 단어 구간을 잘라 학습용 배열로 만든다.
#
# 쓰는 법(원본은 저장소 밖에 두고 경로만 준다. zip 은 풀지 않고 읽기만 한다):
#   training\.venv\Scripts\python.exe training\prepare_data.py `
#       --labels   "<...>\[라벨]01_real_sen_morpheme.zip" "<...>\01_real_sen_morpheme.zip" `
#       --keypoints "<...>\[라벨]01_real_sen_keypoint.zip" "<...>\[라벨]09_real_sen_keypoint.zip"
#   --out 폴더(기본 training/data, .gitignore 대상)   --angles DFLRU 중 쓸 각도(기본 전부)
#
# 만드는 파일(--out 안. AI-Hub 에서 뽑은 중간 파일이라 커밋·업로드 금지):
#   X.npy         [표본 수, 30, 84] float32   정규화한 손 좌표(norm.py = 앱 normalize.js 와 같은 규칙)
#   y.npy         [표본 수] int16             단어 번호(labels.json 의 순서, 0~41)
#   speakers.npy  [표본 수] int16             화자 번호(REAL01 → 1). 사람 단위로 학습·검증을 나눌 때 쓴다
#   angles.npy    [표본 수] int8              촬영 각도(meta.json 의 angles 글자 순서)
#   sentences.npy [표본 수] int16             문장 번호(SEN0001 → 1)
#   nframes.npy   [표본 수] int16             30프레임으로 고르기 전, 구간에 남은 프레임 수
#   labels.json   단어 이름 42개 배열(words.csv '단어' 열 순서 = 모델 출력 순서)
#   meta.json     단어별·화자별 표본 수, 버린 수와 이유, 쓴 규칙
#
# 규칙
# - 단어 이름: count_words.py 와 같다. words.csv 의 '단어' + '사전 표제어' 와 라벨 이름이 (앞뒤 공백을 뗀 뒤) 글자까지 같을 때만.
# - 구간 자르기(structure.md 4-6): 프레임 k 의 시각 = k/30 초, start ≤ k/30 ≤ end 인 프레임.
# - 정규화: norm.py. 시작할 때 docs/tech/norm-testcases.json 검사를 돌리고, 하나라도 다르면 멈춘다.
# - 손 자리: OpenPose hand_right → 앞 42칸(실제 오른손), hand_left → 뒤 42칸.
# - numpy 와 표준 라이브러리만 쓴다(TensorFlow 를 import 하지 않는다).
import argparse
import collections
import io
import json
import math
import os
import re
import struct
import sys
import time
import zipfile
import zlib

import numpy as np

import norm
import test_norm
from count_words import DEFAULT_WORDS, decode, load_words, names_of

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30
VID_RE = re.compile(r"NIA_SL_SEN(\d+)_REAL(\d+)_([A-Z])")
KP_SUFFIX = b"_keypoints.json"


# ── 라벨 읽기 ─────────────────────────────────────────────────────────────────
def read_labels(paths, name_to_idx, angles, drop):
    """돌려줌: ({영상 이름: [(단어 번호, start, end), ...]}, 읽은 파일 수)  (42개 단어 구간만)"""
    segs = collections.defaultdict(list)
    n_files = 0
    for path in paths:
        with zipfile.ZipFile(path) as z:
            for info in z.infolist():
                if info.is_dir() or not info.filename.lower().endswith(".json"):
                    continue
                m = VID_RE.search(os.path.basename(info.filename))
                if not m:
                    drop["라벨 파일 이름을 못 읽음(파일 단위)"] += 1
                    continue
                if m.group(3) not in angles:
                    continue
                n_files += 1
                try:
                    items = json.loads(decode(z.read(info))).get("data") or []
                except (json.JSONDecodeError, AttributeError, UnicodeDecodeError):
                    drop["라벨 JSON 깨짐(파일 단위)"] += 1
                    continue
                vid = m.group(0)
                for it in items:
                    if not isinstance(it, dict):
                        continue
                    idxs = {name_to_idx[n] for n in names_of(it) if n in name_to_idx}
                    for w in idxs:
                        try:
                            s, e = float(it["start"]), float(it["end"])
                        except (KeyError, TypeError, ValueError):
                            drop["start·end 없음"] += 1
                            continue
                        segs[vid].append((w, s, e))
    return segs, n_files


def frame_range(start, end):
    """start ≤ k/30 ≤ end 인 프레임 번호 범위 (k_lo, k_hi). 비어 있으면 k_lo > k_hi."""
    return math.ceil(start * FPS - 1e-9), math.floor(end * FPS + 1e-9)


# ── zip 중앙 목록을 가볍게 읽기 ───────────────────────────────────────────────
# 키포인트 zip 은 파일이 180만~360만 개라 zipfile 로 열면 메모리를 GB 단위로 쓴다(이 PC 는 8GB).
# 그래서 중앙 목록을 차례로 읽으며 필요한 프레임 파일의 위치만 남긴다.
def iter_central(f):
    """zip 중앙 목록 항목마다 (이름 bytes, 압축 방식, 압축 크기, 로컬 헤더 위치)"""
    f.seek(0, os.SEEK_END)
    fsize = f.tell()
    tail_len = min(fsize, 65536 + 22)
    f.seek(fsize - tail_len)
    tail = f.read(tail_len)
    p = tail.rfind(b"PK\x05\x06")
    if p < 0:
        raise ValueError("zip 끝 표시를 못 찾음")
    _, _, _, _, total, cd_size, cd_off, _ = struct.unpack("<4sHHHHIIH", tail[p:p + 22])
    if total == 0xFFFF or cd_size == 0xFFFFFFFF or cd_off == 0xFFFFFFFF:  # zip64
        q = tail.rfind(b"PK\x06\x07", 0, p)
        if q < 0:
            raise ValueError("zip64 위치 표시를 못 찾음")
        eocd64_off = struct.unpack("<Q", tail[q + 8:q + 16])[0]
        f.seek(eocd64_off)
        rec = f.read(56)
        if rec[:4] != b"PK\x06\x06":
            raise ValueError("zip64 끝 기록이 아님")
        total, cd_size, cd_off = struct.unpack("<QQQ", rec[32:56])
    f.seek(cd_off)
    r = io.BufferedReader(f, buffer_size=8 << 20)
    for _ in range(total):
        h = r.read(46)
        if h[:4] != b"PK\x01\x02":
            raise ValueError("zip 중앙 목록이 깨짐")
        method, = struct.unpack("<H", h[10:12])
        csize, usize, nlen, xlen, clen = struct.unpack("<IIHHH", h[20:34])
        off, = struct.unpack("<I", h[42:46])
        name = r.read(nlen)
        extra = r.read(xlen)
        if clen:
            r.read(clen)
        if off == 0xFFFFFFFF or csize == 0xFFFFFFFF or usize == 0xFFFFFFFF:
            i = 0
            while i + 4 <= len(extra):
                hid, hlen = struct.unpack("<HH", extra[i:i + 4])
                if hid == 1:
                    j = i + 4
                    if usize == 0xFFFFFFFF:
                        j += 8
                    if csize == 0xFFFFFFFF:
                        csize, = struct.unpack("<Q", extra[j:j + 8])
                        j += 8
                    if off == 0xFFFFFFFF:
                        off, = struct.unpack("<Q", extra[j:j + 8])
                    break
                i += 4 + hlen
        yield name, method, csize, off
    r.detach()


def read_member(f, method, csize, off):
    """로컬 헤더 위치에서 파일 하나의 내용(bytes)"""
    f.seek(off)
    h = f.read(30)
    if h[:4] != b"PK\x03\x04":
        raise ValueError("zip 로컬 헤더가 아님")
    nlen, xlen = struct.unpack("<HH", h[26:30])
    f.seek(nlen + xlen, os.SEEK_CUR)
    raw = f.read(csize)
    if method == 0:
        return raw
    if method == 8:
        return zlib.decompress(raw, -15)
    raise ValueError(f"지원하지 않는 압축 방식 {method}")


def hands_of(raw):
    """프레임 JSON → [2, 21, 3] (오른손, 왼손). 사람이 없거나 손 값이 63개가 아니면 그 손은 0."""
    doc = json.loads(raw)
    people = doc.get("people")
    if isinstance(people, list):          # 원래 OpenPose 형식(목록)도 받는다. 첫 사람만
        people = people[0] if people else {}
    out = np.zeros((2, 21, 3))
    if isinstance(people, dict):
        for s, key in enumerate(("hand_right_keypoints_2d", "hand_left_keypoints_2d")):
            h = people.get(key)
            if isinstance(h, list) and len(h) == 63:
                out[s] = np.asarray(h, dtype=np.float64).reshape(21, 3)
    return out


# ── 본 작업 ───────────────────────────────────────────────────────────────────
def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="AI-Hub 문장 손 좌표 → 42개 단어 학습 배열")
    ap.add_argument("--labels", nargs="+", required=True, help="문장 형태소 라벨 zip (여러 개 가능)")
    ap.add_argument("--keypoints", nargs="+", required=True, help="문장 keypoint zip (여러 개 가능)")
    ap.add_argument("--out", default=os.path.join(HERE, "data"), help="출력 폴더(기본 training/data, git 에 넣지 않음)")
    ap.add_argument("--words", default=DEFAULT_WORDS, help="words.csv 경로")
    ap.add_argument("--angles", default="DFLRU", help="쓸 촬영 각도 글자(기본 DFLRU 전부)")
    ap.add_argument("--min-frames", type=int, default=1, help="앞뒤 자른 뒤 프레임이 이보다 적으면 버림(기본 1 = 안 버림)")
    ap.add_argument("--limit-videos", type=int, default=0, help="시험용: zip 마다 앞에서 이만큼의 영상만")
    args = ap.parse_args()

    # 0) 정규화가 앱과 같은지 먼저 검사. 다르면 데이터를 만들지 않는다
    ok, total, fails = test_norm.run(verbose=False)
    print(f"정규화 검사(docs/tech/norm-testcases.json): {ok}/{total} 통과")
    if fails:
        for line in fails:
            print("  실패:", line)
        sys.exit("정규화가 앱과 다르다. 데이터를 만들지 않고 멈춘다.")

    words, _ = load_words(args.words)
    labels = [w for _, w, _ in words]
    name_to_idx = {}
    for i, (_, _, cands) in enumerate(words):
        for c in cands:
            if c in name_to_idx and name_to_idx[c] != i:
                sys.exit(f"이름 '{c}' 이 두 단어의 후보에 겹친다. words.csv 를 확인할 것")
            name_to_idx[c] = i

    drop = collections.Counter()           # 버린 이유별 수(구간 단위)
    t0 = time.time()
    segs, n_label_files = read_labels(args.labels, name_to_idx, set(args.angles), drop)
    n_seg_all = sum(len(v) for v in segs.values())
    print(f"라벨 파일 {n_label_files}개에서 42개 단어 구간 {n_seg_all}개 (영상 {len(segs)}개), {time.time() - t0:.0f}초")

    # 영상마다 필요한 프레임 범위
    need = {}
    for vid, lst in segs.items():
        lo = min(frame_range(s, e)[0] for _, s, e in lst)
        hi = max(frame_range(s, e)[1] for _, s, e in lst)
        need[vid] = (lo, hi)

    X, Y, SPK, ANG, SEN, NFR = [], [], [], [], [], []
    done_vids = set()
    low_ratio = 0
    for zpath in args.keypoints:
        t1 = time.time()
        with open(zpath, "rb") as f:
            # 1) 중앙 목록에서 필요한 프레임 파일 위치만 모은다
            entries = collections.defaultdict(dict)   # 영상 → {프레임 번호: (방식, 크기, 위치)}
            n_all = 0
            for name, method, csize, off in iter_central(f):
                if not name.endswith(KP_SUFFIX):
                    continue
                n_all += 1
                base = name[name.rfind(b"/") + 1:-len(KP_SUFFIX)]
                cut = base.rfind(b"_")
                vid = base[:cut].decode("ascii", "replace")
                rng = need.get(vid)
                if rng is None:
                    continue
                try:
                    k = int(base[cut + 1:])
                except ValueError:
                    continue
                if rng[0] <= k <= rng[1]:
                    entries[vid][k] = (method, csize, off)
            vids = sorted(entries, key=lambda v: min(e[2] for e in entries[v].values()))
            if args.limit_videos:
                vids = vids[:args.limit_videos]
            print(f"{os.path.basename(zpath)}: 프레임 파일 {n_all}개 중 쓸 영상 {len(vids)}개, 목록 읽기 {time.time() - t1:.0f}초", flush=True)

            # 2) 영상마다 프레임을 읽고 구간을 잘라 정규화
            for vi, vid in enumerate(vids):
                if vid in done_vids:
                    continue
                done_vids.add(vid)
                fr = entries[vid]
                hands = {}
                for k in sorted(fr, key=lambda k: fr[k][2]):
                    try:
                        hands[k] = hands_of(read_member(f, *fr[k]))
                    except (ValueError, zlib.error, json.JSONDecodeError, UnicodeDecodeError):
                        drop["프레임 JSON 깨짐(프레임 단위, 그 프레임만 뺌)"] += 1
                m = VID_RE.fullmatch(vid)
                sen, spk, ang = int(m.group(1)), int(m.group(2)), args.angles.index(m.group(3))
                for w, s, e in segs[vid]:
                    if not e > s:
                        drop["end 가 start 보다 크지 않음"] += 1
                        continue
                    k_lo, k_hi = frame_range(s, e)
                    ks = [k for k in range(max(k_lo, 0), k_hi + 1) if k in hands]
                    if not ks:
                        drop["구간에 프레임 없음(영상이 구간보다 짧음)"] += 1
                        continue
                    arr = np.stack([hands[k] for k in ks])          # [n, 2, 21, 3]
                    feat, present = norm.frame_features(arr[:, 0], arr[:, 1])
                    seq, kept = norm.to_sequence(feat, present)
                    if seq is None:
                        drop["손 없음(구간 내내 두 손 모두 없음)"] += 1
                        continue
                    n_kept = kept[1] - kept[0] + 1
                    if n_kept < args.min_frames:
                        drop[f"프레임 {args.min_frames}개 미만"] += 1
                        continue
                    if not np.all(np.isfinite(seq)):
                        drop["좌표에 숫자가 아닌 값"] += 1
                        continue
                    if norm.hand_ratio(present) < 0.5:
                        low_ratio += 1                               # 버리지 않고 세기만
                    X.append(seq)
                    Y.append(w)
                    SPK.append(spk)
                    ANG.append(ang)
                    SEN.append(sen)
                    NFR.append(n_kept)
                if (vi + 1) % 2000 == 0:
                    print(f"  영상 {vi + 1}/{len(vids)}, 표본 {len(X)}개, {time.time() - t1:.0f}초", flush=True)
        print(f"  끝: 누적 표본 {len(X)}개, {time.time() - t1:.0f}초", flush=True)

    # 손 좌표를 받지 않은 영상의 구간(예: REAL05~16)
    if not args.limit_videos:
        for vid, lst in segs.items():
            if vid not in done_vids:
                drop["손 좌표 파일이 없는 영상(받지 않은 사람 등)"] += len(lst)

    if not X:
        sys.exit("표본이 하나도 없다. 라벨 zip 과 keypoint zip 이 같은 사람 것인지 확인할 것")
    X = np.stack(X).astype(np.float32)
    Y = np.asarray(Y, dtype=np.int16)
    SPK = np.asarray(SPK, dtype=np.int16)
    ANG = np.asarray(ANG, dtype=np.int8)
    SEN = np.asarray(SEN, dtype=np.int16)
    NFR = np.asarray(NFR, dtype=np.int16)

    os.makedirs(args.out, exist_ok=True)
    for fn, a in (("X.npy", X), ("y.npy", Y), ("speakers.npy", SPK), ("angles.npy", ANG),
                  ("sentences.npy", SEN), ("nframes.npy", NFR)):
        np.save(os.path.join(args.out, fn), a)
    with open(os.path.join(args.out, "labels.json"), "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False)

    # ── 보고 ──
    speakers = sorted(set(SPK.tolist()))
    per_word = np.bincount(Y, minlength=len(labels))
    table = {spk: np.bincount(Y[SPK == spk], minlength=len(labels)) for spk in speakers}
    print(f"\nX {list(X.shape)} {X.dtype}, y {list(Y.shape)}, 화자 {['REAL%02d' % s for s in speakers]}, 각도 {args.angles}")
    print(f"{'번호':>3} {'단어':<8} {'합계':>6} " + " ".join(f"R{s:02d}".rjust(6) for s in speakers))
    for i, w in enumerate(labels):
        print(f"{i + 1:>4} {w:<8} {per_word[i]:>6} " + " ".join(f"{table[s][i]:>6}" for s in speakers))
    order = np.argsort(per_word, kind="stable")
    print(f"\n단어별 표본 수: 최소 {per_word.min()} ({labels[order[0]]}), 최대 {per_word.max()} ({labels[order[-1]]}), 중앙값 {int(np.median(per_word))}")
    print("적은 단어 8개:", ", ".join(f"{labels[i]} {per_word[i]}" for i in order[:8]))
    print("표본 0개 단어:", ", ".join(labels[i] for i in order if per_word[i] == 0) or "없음")
    q = np.percentile(NFR, [0, 5, 50, 95, 100]).astype(int).tolist()
    print(f"구간 프레임 수(30개로 고르기 전): 최소 {q[0]}, 5% {q[1]}, 중앙 {q[2]}, 95% {q[3]}, 최대 {q[4]}")
    r_all0 = float(np.mean(np.all(X[:, :, :42] == 0, axis=(1, 2))))
    l_all0 = float(np.mean(np.all(X[:, :, 42:] == 0, axis=(1, 2))))
    print(f"오른손 칸이 내내 0 인 표본 {r_all0:.2%}, 왼손 칸이 내내 0 인 표본 {l_all0:.2%}, 손 있는 프레임이 절반 미만인 표본 {low_ratio}개(버리지 않음)")
    print(f"\n42개 단어 구간 {n_seg_all}개 → 표본 {len(X)}개, 버림 {sum(drop.values())}개")
    for reason, n in drop.most_common():
        print(f"  {n:>7}  {reason}")

    meta = {
        "source": "한국지능정보사회진흥원 AI 허브(aihub.or.kr)「수어 영상」 문장(SEN) keypoint·morpheme",
        "warning": "AI-Hub 에서 뽑은 중간 파일. 저장소·공개 장소·해외 서버에 올리지 않는다",
        "shape": list(X.shape), "angles": args.angles, "fps": FPS,
        "segment_rule": "start <= k/30 <= end",
        "slots": "84 = [hand_right 42, hand_left 42]",
        "label_files": [os.path.basename(p) for p in args.labels],
        "keypoint_files": [os.path.basename(p) for p in args.keypoints],
        "per_word": {labels[i]: int(per_word[i]) for i in range(len(labels))},
        "per_speaker_word": {f"REAL{s:02d}": {labels[i]: int(table[s][i]) for i in range(len(labels))} for s in speakers},
        "segments_total": n_seg_all, "dropped": dict(drop), "low_hand_ratio_kept": low_ratio,
    }
    with open(os.path.join(args.out, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print(f"\n저장: {os.path.abspath(args.out)}  (X.npy {X.nbytes / 1e6:.0f}MB)  전체 {time.time() - t0:.0f}초")


if __name__ == "__main__":
    main()
