# [역할] 환경 시험(3-0): 무작위 숫자로 입력 [1, 30, 84] → 출력 42 인 작은 GRU 모델을 만들고
#        TF.js LayersModel(model.json + .bin)로 변환되는지만 본다. 학습 결과가 아니다(뜻 없는 모델).
#
# 쓰는 법(결과는 저장소 밖 폴더에):
#     training\.venv\Scripts\python.exe training\smoke_test_tfjs.py <출력 폴더>
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tfjs_compat  # noqa: E402

tfjs_compat.install()

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402
import tf_keras as keras  # noqa: E402  tensorflowjs 4.22 가 쓰는 Keras 2
import tensorflowjs as tfjs  # noqa: E402

FRAMES, FEATURES, CLASSES = 30, 84, 42


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir", help="변환 결과를 쓸 폴더(저장소 밖)")
    args = ap.parse_args()

    rng = np.random.default_rng(0)
    x = rng.normal(size=(64, FRAMES, FEATURES)).astype("float32")
    y = rng.integers(0, CLASSES, size=64)

    model = keras.Sequential([
        keras.layers.Input(shape=(FRAMES, FEATURES)),
        keras.layers.GRU(32),
        keras.layers.Dense(CLASSES, activation="softmax"),
    ])
    model.compile(optimizer="adam", loss="sparse_categorical_crossentropy")
    model.fit(x, y, epochs=1, batch_size=16, verbose=0)

    os.makedirs(args.out_dir, exist_ok=True)
    tfjs.converters.save_keras_model(model, args.out_dir)

    # 뒤에서 TF.js 쪽 결과와 비교할 수 있게 한 입력의 출력 순위만 남긴다(값은 시험용, 뜻 없음)
    probe = x[:1]
    pred = model.predict(probe, verbose=0)[0]
    np.save(os.path.join(args.out_dir, "probe_input.npy"), probe)
    with open(os.path.join(args.out_dir, "probe_top5.json"), "w", encoding="utf-8") as f:
        json.dump({"top5": [int(i) for i in np.argsort(-pred)[:5]],
                   "values": [float(v) for v in pred]}, f)

    with open(os.path.join(args.out_dir, "model.json"), encoding="utf-8") as f:
        mj = json.load(f)
    print("TF", tf.__version__, "| tensorflowjs", tfjs.__version__)
    print("format:", mj.get("format"), "| generatedBy:", mj.get("generatedBy"))
    print("files:", sorted(os.listdir(args.out_dir)))


if __name__ == "__main__":
    main()
