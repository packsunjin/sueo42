# [역할] 3-3·3-4: training/data/ 의 정규화 손 좌표 X[N,30,90] 로 42개 단어 분류 모델(Conv1D + GRU)을 학습하고
#        TF.js LayersModel(model.json + .bin)과 labels.json 으로 바꾼다. 지표는 개발용(앱 화면에 넣지 않음).
#
# 쓰는 법:
#   training\.venv\Scripts\python.exe training\train.py --data training\data --model-out sueo42\model `
#       --report docs\data\train-report.md --probe-out <저장소 밖 폴더>
#   --epochs 에폭 수(기본 30)  --seed 난수 씨앗(기본 0)
#
# 규칙
# - 사람 단위 분할: 검증 = REAL17·18(AI-Hub Validation), 학습 = 나머지(받은 사람 전부, 11/19 까지는 REAL01~04). 같은 사람이 양쪽에 들어가지 않는다.
# - (11/19) 좌우 뒤집기 증강(--mirror-p, 기본 0.5): 사전 영상을 거울처럼 반대 손으로 따라 하는 사람이 많다(앱 실험 9/42 → design.md 16절).
#   mirror.py = 앱 normalize.js mirrorFrame 과 같은 결과. 검증은 그대로·뒤집은 것 둘 다 재고, 둘의 평균으로 가장 좋은 에폭을 고른다.
# - 단어 불균형: 클래스 가중치 = 전체/(42·단어 수), 최대 30 으로 자른 뒤 평균 1 로 맞춘다.
# - 증강(norm.py 정규화와 어긋나지 않는 것만. 손목은 늘 (0,0), 없는 점·없는 손은 늘 0):
#   손마다 손목 중심 회전(±12°)·크기(×N(1,0.06))·점 잡음(σ 0.02, 있는 점만),
#   확률 0.3 으로 두 손 중 모양 변화가 적은 손(쉬는 손) 42칸을 0 으로(앱에서 화면 밖 손),
#   확률 0.2 로 한 손의 일부 프레임(약 10%)을 0 으로(검출 놓침).
# - 손 모양 칸의 위치 이동은 하지 않는다: 정규화가 손목을 원점으로 옮기므로 이동하면 앱 입력과 달라진다.
# - (11/16) 몸 기준 위치 6칸: 전체 이동(σ 0.08)·크기(×N(1,0.08))·잡음(σ 0.02), 확률 0.05 로 6칸 모두 0, 지운 손의 손목 칸도 0.
# - (11/16) 시간 어긋남: 확률 0.5 로 앞뒤 0~20% 잘라 30프레임으로 다시 고름(앱의 33프레임 창 나누기 대비).
# - --probe-out: 재로딩 검사용 입력·출력 순위를 저장소 밖에 쓴다(AI-Hub 에서 뽑은 값이라 저장소에 넣지 않는다).
import argparse
import csv
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tfjs_compat  # noqa: E402

tfjs_compat.install()

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402
import tf_keras as keras  # noqa: E402  tensorflowjs 4.22 가 쓰는 Keras 2
import tensorflowjs as tfjs  # noqa: E402
from mirror import mirror_features  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WORDS_CSV = os.path.join(HERE, "..", "sueo42", "data", "words.csv")
VAL_SPEAKERS = (17, 18)
FRAMES, FEATURES, CLASSES = 30, 90, 42   # 90 = 손 모양 84 + 몸 기준 위치 6(11/16)
HANDS = 84


def load(data_dir):
    X = np.load(os.path.join(data_dir, "X.npy")).astype(np.float32)
    y = np.load(os.path.join(data_dir, "y.npy")).astype(np.int64)
    spk = np.load(os.path.join(data_dir, "speakers.npy"))
    ang = np.load(os.path.join(data_dir, "angles.npy"))
    with open(os.path.join(data_dir, "labels.json"), encoding="utf-8") as f:
        labels = json.load(f)
    with open(os.path.join(data_dir, "meta.json"), encoding="utf-8") as f:
        meta = json.load(f)
    with open(WORDS_CSV, encoding="utf-8-sig") as f:
        words = [r["단어"].strip() for r in csv.DictReader(f)]
    if labels != words:
        raise SystemExit("labels.json 순서가 words.csv '단어' 열과 다르다 — 멈춤")
    assert X.shape[1:] == (FRAMES, FEATURES) and len(labels) == CLASSES
    return X, y, spk, ang, labels, meta


def class_weights(y):
    cnt = np.bincount(y, minlength=CLASSES).astype(np.float64)
    w = len(y) / (CLASSES * np.maximum(cnt, 1))
    w = np.minimum(w, 30.0)
    sw = w[y]
    return (sw / sw.mean()).astype(np.float32)


def time_jitter(X, rng):
    """앱은 3초 녹화를 33프레임 창으로 잘라 넣으므로 단어 경계가 어긋난다.
    확률 0.5 로 앞·뒤를 각각 0~20% 잘라내고 다시 30프레임으로 고른다(가까운 프레임, 보간 없음)."""
    n = X.shape[0]
    out = X.copy()
    pick = rng.random(n) < 0.5
    a = rng.uniform(0, 0.2, n) * (FRAMES - 1)
    b = (FRAMES - 1) - rng.uniform(0, 0.2, n) * (FRAMES - 1)
    t = np.linspace(0, 1, FRAMES)
    idx = np.rint(a[:, None] + (b - a)[:, None] * t[None, :]).astype(int)
    rows = np.flatnonzero(pick)
    out[rows] = X[rows[:, None], idx[rows]]
    return out


def augment(X, rng, mirror_p=0.5):
    """X [N,30,90] → 증강본. 손 자리: [오른손 42, 왼손 42], 손 42 = x,y 번갈아 21점, 뒤 6 = 몸 기준 위치."""
    X = time_jitter(X, rng)
    n = X.shape[0]
    body = X[:, :, HANDS:].reshape(n, FRAMES, 3, 2).copy()          # [오른손목, 왼손목, 코] × (x, y)
    body_on = np.any(body != 0, axis=-1, keepdims=True)
    # 몸 위치: 사람마다 다른 자세·카메라 각도 → 전체 이동(σ 0.08)·크기(×N(1,0.08)), 확률 0.05 로 몸 6칸 전부 0(어깨 못 잡음)
    body = body * rng.normal(1.0, 0.08, size=(n, 1, 1, 1)) + rng.normal(0, 0.08, size=(n, 1, 1, 2))
    body = body + rng.normal(0, 0.02, size=body.shape)
    body[rng.random(n) < 0.05] = 0
    body[~np.broadcast_to(body_on, body.shape)] = 0
    h = X[:, :, :HANDS].reshape(n, FRAMES, 2, 21, 2).copy()
    present_pt = np.any(h != 0, axis=-1, keepdims=True)              # [n,30,2,21,1]
    # 회전·크기(손목 원점 기준 → 손목 0 유지, 0 인 점은 0 유지)
    th = np.deg2rad(rng.uniform(-12, 12, size=(n, 1, 2, 1)))
    sc = rng.normal(1.0, 0.06, size=(n, 1, 2, 1))
    c, s = np.cos(th) * sc, np.sin(th) * sc
    x0, y0 = h[..., 0], h[..., 1]
    h = np.stack([c * x0 - s * y0, s * x0 + c * y0], axis=-1)
    # 점 잡음(있는 점만, 손목 제외)
    noise = rng.normal(0, 0.02, size=h.shape) * present_pt
    noise[:, :, :, 0, :] = 0
    h = h + noise
    # 쉬는 손 지우기: 두 손 다 있으면 모양 변화가 적은 손을 0 으로
    hand_on = np.any(present_pt[..., 0], axis=(1, 3))               # [n,2]
    motion = np.abs(np.diff(h, axis=1)).sum(axis=(1, 3, 4))          # [n,2]
    both = hand_on.all(axis=1)
    pick = both & (rng.random(n) < 0.3)
    rest = np.argmin(motion, axis=1)
    idx = np.flatnonzero(pick)
    h[idx, :, rest[idx]] = 0
    body[idx, :, rest[idx]] = 0                                      # 지운 손의 손목 위치도 0
    # 일부 프레임 놓침
    drop = rng.random(n) < 0.2
    which = rng.integers(0, 2, size=n)
    fmask = rng.random((n, FRAMES)) < 0.1
    for i in np.flatnonzero(drop):
        h[i, fmask[i], which[i]] = 0
        body[i, fmask[i], which[i]] = 0
    h[~np.broadcast_to(present_pt, h.shape)] = 0  # 없는 점은 끝까지 0
    out = np.concatenate([h.reshape(n, FRAMES, HANDS), body.reshape(n, FRAMES, 6)], axis=2).astype(np.float32)
    flip = rng.random(n) < mirror_p                                 # (11/19) 거울처럼 반대 손
    out[flip] = mirror_features(out[flip])
    return out


def build_model():
    return keras.Sequential([
        keras.layers.Input(shape=(FRAMES, FEATURES)),
        keras.layers.Conv1D(96, 3, padding="same", activation="relu"),
        keras.layers.BatchNormalization(),
        keras.layers.Conv1D(96, 3, padding="same", activation="relu"),
        keras.layers.BatchNormalization(),
        keras.layers.Dropout(0.2),
        keras.layers.GRU(128, reset_after=False),  # TF.js GRUCell 은 reset_after=True 를 못 읽는다(4.22.0 확인)
        keras.layers.Dropout(0.3),
        keras.layers.Dense(CLASSES, activation="softmax"),
    ])


def per_word(pred, y):
    """단어별 (표본 수, 상위1 비율, 상위2 비율). 표본 없는 단어는 nan."""
    top2 = np.argsort(-pred, axis=1)[:, :2]
    out = []
    for k in range(CLASSES):
        m = y == k
        if not m.any():
            out.append((0, np.nan, np.nan))
            continue
        t = top2[m]
        out.append((int(m.sum()), float((t[:, 0] == k).mean()), float((t == k).any(axis=1).mean())))
    return out


def summary(rows):
    a1 = np.nanmean([r[1] for r in rows])
    a2 = np.nanmean([r[2] for r in rows])
    return a1, a2


def write_report(path, labels, rows_f, rows_all, info):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    f1, f2 = summary(rows_f)
    a1, a2 = summary(rows_all)
    low = sorted([k for k in range(CLASSES) if rows_f[k][0] > 0], key=lambda k: (rows_f[k][1], rows_f[k][2]))[:5]
    L = []
    L.append("# 학습 보고(3-3) — 개발용, 앱 화면에 넣지 않음\n")
    L.append("> 출처: 한국지능정보사회진흥원 AI 허브(aihub.or.kr)「수어 영상」 " + info['sources'] + " keypoint·morpheme. "
             f"검증 = REAL17·18(학습에 안 쓴 사람), 학습 = REAL{info['train_speakers']}. 비율은 단어마다 따로 내고 42개를 단순 평균.\n")
    L.append("## 요약\n")
    L.append(f"- 모델: Conv1D(96)×2 + GRU(128) + Dense(42), 파라미터 {info['params']:,}개, 입력 [1,30,90](손 모양 84 + 몸 기준 위치 6). "
             f"학습 {info['epochs']}에폭(가장 좋은 에폭 {info['best_epoch']}), {info['minutes']:.1f}분(CPU).")
    L.append(f"- 정면(F) 검증 단어 평균: 상위1 {f1:.1%}, 상위2 {f2:.1%} (표본 {info['n_val_f']}개).")
    L.append(f"- 5개 각도 전부 검증 단어 평균: 상위1 {a1:.1%}, 상위2 {a2:.1%} (표본 {info['n_val_all']}개).")
    L.append(f"- 거울처럼 반대 손으로 한 동작(정면 검증을 좌우로 뒤집음): 상위1 {info['mir1']:.1%}, 상위2 {info['mir2']:.1%}.")
    L.append(f"- 검증 표본 중 문장 속 단어 {info['n_val_sen']}개, 따로 한 단어 {info['n_val_word']}개. 문장 속 단어는 같은 문장을 다른 사람이 한 것이라 실제보다 높게 나올 수 있다(design.md 16절).")
    L.append("- 가장 낮은 단어 5개(F): " + ", ".join(
        f"{labels[k]}(상위1 {rows_f[k][1]:.0%}·상위2 {rows_f[k][2]:.0%}, {rows_f[k][0]}개)" for k in low) + ".")
    L.append("- 검증 표본이 10개 미만인 단어는 비율이 크게 흔들린다(아래 표의 표본 수). AI-Hub 손 좌표(OpenPose)로만 쟀고 "
             "앱 카메라(MediaPipe) 입력으로는 아직 확인 못 함.\n")
    L.append("## 단어별(검증 F / 전체 각도)\n")
    L.append("| 번호 | 단어 | 학습 표본 | F 표본 | F 상위1 | F 상위2 | 전체 상위1 | 전체 상위2 |")
    L.append("|---|---|---|---|---|---|---|---|")
    fmt = lambda v: "-" if np.isnan(v) else f"{v:.0%}"
    for k in range(CLASSES):
        L.append(f"| {k + 1} | {labels[k]} | {info['train_counts'][k]} | {rows_f[k][0]} | {fmt(rows_f[k][1])} | "
                 f"{fmt(rows_f[k][2])} | {fmt(rows_all[k][1])} | {fmt(rows_all[k][2])} |")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--model-out", required=True)
    ap.add_argument("--report", required=True)
    ap.add_argument("--probe-out", default=None)
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--mirror-p", type=float, default=0.5, help="좌우 뒤집기 증강 확률(0 이면 끔)")
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    tf.random.set_seed(args.seed)
    X, y, spk, ang, labels, meta = load(args.data)
    sen = np.load(os.path.join(args.data, "sentences.npy"))      # 10000 이상 = 따로 한 단어(WORD) 영상
    f_idx = meta["angles"].index("F")
    val = np.isin(spk, VAL_SPEAKERS)
    tr = ~val
    assert not set(np.unique(spk[tr])) & set(np.unique(spk[val]))
    Xtr, ytr = X[tr], y[tr]
    Xv, yv, av = X[val], y[val], ang[val]
    vf = av == f_idx
    sw = class_weights(ytr)
    print(f"학습 {len(ytr)} (화자 {sorted(set(spk[tr].tolist()))}) / 검증 {len(yv)} (F {vf.sum()})", flush=True)

    model = build_model()
    model.compile(optimizer=keras.optimizers.Adam(2e-3), loss="sparse_categorical_crossentropy")
    lr_sched = lambda e: 2e-3 * 0.5 * (1 + np.cos(np.pi * e / args.epochs))
    t0 = time.time()
    best, best_w, best_ep = -1.0, None, 0
    for ep in range(args.epochs):
        keras.backend.set_value(model.optimizer.learning_rate, lr_sched(ep))
        h = model.fit(augment(Xtr, rng, args.mirror_p), ytr, sample_weight=sw, batch_size=128, epochs=1, shuffle=True, verbose=0)
        pv = model.predict(Xv[vf], batch_size=512, verbose=0)
        f1, f2 = summary(per_word(pv, yv[vf]))
        pm = model.predict(mirror_features(Xv[vf]), batch_size=512, verbose=0)
        m1, m2 = summary(per_word(pm, yv[vf]))
        score = (f1 + m1) / 2
        if score > best:
            best, best_w, best_ep = score, model.get_weights(), ep + 1
        print(f"에폭 {ep + 1:2d} 손실 {h.history['loss'][0]:.3f} | F 상위1 {f1:.3f} 상위2 {f2:.3f} | 거울 상위1 {m1:.3f} 상위2 {m2:.3f} | {time.time() - t0:.0f}초", flush=True)
    model.set_weights(best_w)
    minutes = (time.time() - t0) / 60

    pv_all = model.predict(Xv, batch_size=512, verbose=0)
    rows_all = per_word(pv_all, yv)
    rows_f = per_word(pv_all[vf], yv[vf])
    mir1, mir2 = summary(per_word(model.predict(mirror_features(Xv[vf]), batch_size=512, verbose=0), yv[vf]))
    tr_spk = sorted(set(spk[tr].tolist()))
    sv = sen[val]
    info = dict(params=model.count_params(), epochs=args.epochs, best_epoch=best_ep, minutes=minutes,
                mir1=mir1, mir2=mir2, n_val_sen=int((sv < 10000).sum()), n_val_word=int((sv >= 10000).sum()),
                train_speakers=",".join(f"{k:02d}" for k in tr_spk),
                sources="문장" + ("·단어" if (sen >= 10000).any() else ""),
                n_val_f=int(vf.sum()), n_val_all=len(yv), train_counts=np.bincount(ytr, minlength=CLASSES).tolist())
    write_report(args.report, labels, rows_f, rows_all, info)

    # TF.js 변환 + labels.json(이름 배열, words.csv '단어' 순서 = 출력 순서)
    os.makedirs(args.model_out, exist_ok=True)
    tfjs.converters.save_keras_model(model, args.model_out)
    with open(os.path.join(args.model_out, "labels.json"), "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False)

    if args.probe_out:  # 재로딩 검사용(저장소 밖)
        os.makedirs(args.probe_out, exist_ok=True)
        sel = np.flatnonzero(vf)[:: max(1, vf.sum() // 50)][:50]
        xs = Xv[sel]
        ps = model.predict(xs, verbose=0)
        with open(os.path.join(args.probe_out, "probe.json"), "w", encoding="utf-8") as f:
            json.dump({"x": xs.tolist(), "top2": np.argsort(-ps, axis=1)[:, :2].tolist(),
                       "probs": ps.tolist()}, f)
    f1, f2 = summary(rows_f)
    a1, a2 = summary(rows_all)
    print(f"끝: 최적 에폭 {best_ep}, F 상위1 {f1:.3f} 상위2 {f2:.3f} | 전체 상위1 {a1:.3f} 상위2 {a2:.3f} | "
          f"파라미터 {model.count_params()} | {minutes:.1f}분")


if __name__ == "__main__":
    main()
