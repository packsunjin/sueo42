# [역할] 3-1: AI-Hub「수어 영상」 형태소 라벨 JSON 에서 앱 42개 단어가 몇 번 나오는지 표로 낸다.
#
# 쓰는 법(데이터는 저장소 밖에 두고 경로만 준다):
#     training\.venv\Scripts\python.exe training\count_words.py D:\aihub\01_real_word_morpheme.zip
#     training\.venv\Scripts\python.exe training\count_words.py D:\aihub\morpheme_folder --few 20
#     ... --csv D:\aihub_out\counts.csv     (표를 CSV 로도 저장. 저장소 안 경로는 쓰지 말 것)
#
# 읽는 형식(⚠️ 실제 단어 라벨 파일을 받기 전에 문장 라벨 설명과 가짜 JSON 으로만 맞춘 것이다.
#   2-2 에서 01_real_word_morpheme.zip 을 받으면 실제 형식을 보고 다시 맞춘다):
#   { "metaData": {...}, "data": [ { "start": 1.2, "end": 2.3, "name": "택시" }, ... ] }
#   항목에 name 이 없고 "attributes": [ {"name": ...} ] 로 들어 있어도 읽는다.
# - zip 은 풀지 않고 안에서 바로 읽는다(원본을 디스크에 복사하지 않음).
# - 후보 이름 = words.csv 의 '단어' + '사전 표제어'(쉼표 목록). 이름이 글자까지 같을 때만 센다.
#   사전 표제어에는 뜻이 넓은 말(봄·북·남쪽 등)도 있어 숫자가 부풀 수 있다 → 이름별 횟수를 같이 보여 준다.
#   어느 이름을 학습에 쓸지는 사람이 표를 보고 정한다.
import argparse
import collections
import csv
import json
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_WORDS = os.path.join(HERE, "..", "sueo42", "data", "words.csv")


def load_words(path):
    """words.csv → [(번호, 단어, [후보 이름...])], 이름 → [단어...] 역색인"""
    words, owner = [], collections.defaultdict(list)
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            cands = [row["단어"].strip()]
            for h in row.get("사전 표제어", "").split(","):
                h = h.strip()
                if h and h not in cands:
                    cands.append(h)
            words.append((row["번호"], row["단어"].strip(), cands))
            for c in cands:
                owner[c].append(row["단어"].strip())
    return words, owner


def decode(raw):
    for enc in ("utf-8-sig", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("utf-8/cp949", raw, 0, 1, "읽을 수 없는 글자 인코딩")


def iter_json(path):
    """(파일 이름, 내용 문자열)을 하나씩. zip 은 풀지 않는다."""
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as z:
            for info in z.infolist():
                if not info.is_dir() and info.filename.lower().endswith(".json"):
                    yield info.filename, decode(z.read(info))
    elif os.path.isdir(path):
        for root, _, files in os.walk(path):
            for fn in files:
                if fn.lower().endswith(".json"):
                    p = os.path.join(root, fn)
                    with open(p, "rb") as f:
                        yield p, decode(f.read())
    else:
        sys.exit(f"zip 파일이나 폴더가 아닙니다: {path}")


def names_of(item):
    """data 항목 하나에서 단어 이름들."""
    if isinstance(item.get("name"), str):
        return [item["name"].strip()]
    out = []
    for a in item.get("attributes") or []:
        if isinstance(a, dict) and isinstance(a.get("name"), str):
            out.append(a["name"].strip())
    return out


def main():
    ap = argparse.ArgumentParser(description="42개 단어 라벨 등장 횟수 표")
    ap.add_argument("data", help="형태소 라벨 zip 또는 폴더(저장소 밖)")
    ap.add_argument("--words", default=DEFAULT_WORDS, help="words.csv 경로")
    ap.add_argument("--few", type=int, default=10,
                    help="이 횟수 미만이면 '적음' 표시(임시 기준, 3-1 결과를 보고 다시 정함)")
    ap.add_argument("--csv", help="표를 CSV 로도 저장할 경로(저장소 밖)")
    args = ap.parse_args()

    words, owner = load_words(args.words)
    dup = {n: ws for n, ws in owner.items() if len(ws) > 1}

    seg = collections.Counter()      # 이름별 구간 수
    files = collections.defaultdict(set)  # 이름별 파일 수
    all_names = collections.Counter()
    n_files = n_bad = n_items = 0
    for fname, text in iter_json(args.data):
        n_files += 1
        try:
            doc = json.loads(text)
            items = doc.get("data") or []
        except (json.JSONDecodeError, AttributeError):
            n_bad += 1
            continue
        for it in items:
            if not isinstance(it, dict):
                continue
            n_items += 1
            for nm in names_of(it):
                all_names[nm] += 1
                if nm in owner:
                    seg[nm] += 1
                    files[nm].add(fname)

    print(f"JSON {n_files}개 읽음 (못 읽은 것 {n_bad}개), 라벨 항목 {n_items}개, 서로 다른 이름 {len(all_names)}개")
    if dup:
        print("주의: 두 단어 이상의 후보에 겹친 이름(양쪽에 다 셈):", dup)
    print(f"'적음' 기준: 등장 {args.few}회 미만 (임시)\n")

    rows = []
    for num, word, cands in words:
        total = sum(seg[c] for c in cands)
        nfile = len(set().union(*(files[c] for c in cands)))
        hit = ", ".join(f"{c} {seg[c]}" for c in cands if seg[c])
        mark = "적음" if total < args.few else ""
        rows.append((num, word, total, nfile, mark, hit or "-"))

    print(f"{'번호':>4} {'단어':<8} {'등장':>6} {'파일':>6}  표시  맞은 이름(횟수)")
    for num, word, total, nfile, mark, hit in rows:
        print(f"{num:>4} {word:<8} {total:>6} {nfile:>6}  {mark:<4}  {hit}")
    few = [r[1] for r in rows if r[4]]
    print(f"\n적은 단어 {len(few)}개: {', '.join(few) if few else '없음'}")

    if args.csv:
        with open(args.csv, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(["번호", "단어", "등장 횟수", "파일 수", "표시", "맞은 이름(횟수)"])
            w.writerows(rows)
        print("CSV 저장:", args.csv)


if __name__ == "__main__":
    main()
