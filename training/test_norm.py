# [역할] norm.py(파이썬 정규화)가 앱의 JS 정규화와 같은 결과를 내는지 docs/tech/norm-testcases.json 으로 검사한다.
#   시험 좌표는 지어낸 숫자다(AI-Hub 데이터 아님). JS 쪽 같은 검사는 tests/normalize.test.mjs.
# 쓰는 법:  training\.venv\Scripts\python.exe training\test_norm.py
#   모두 통과하면 종료 코드 0, 하나라도 다르면 1.
import json
import os
import sys

import numpy as np

import norm

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CASES = os.path.join(HERE, "..", "docs", "tech", "norm-testcases.json")


def run(path=DEFAULT_CASES, verbose=True):
    """돌려줌: (통과 수, 전체 수, 실패 설명 목록)"""
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    tol = doc["tolerance"]
    fails, total = [], 0

    def check(name, ok, detail=""):
        nonlocal total
        total += 1
        if not ok:
            fails.append(f"{name}: {detail}")
        if verbose:
            print(f"  {'통과' if ok else '실패'}  {name} {detail if not ok else ''}")

    # 1) 30프레임 고르기 번호표
    for row in doc["sample_index"]:
        got = [norm.sample_index(i, row["n"]) for i in range(norm.SEQ_LEN)]
        check(f"sample_index n={row['n']}", got == row["idx"], f"got {got}")

    # 2) 사례마다 MediaPipe 형식·OpenPose 형식 두 입력 모두 같은 기대 출력이 나와야 한다
    for case in doc["cases"]:
        exp = case["expected"]
        want = np.asarray(exp["features"], dtype=np.float64)
        inputs = (
            ("mediapipe", norm.mediapipe_to_points(case["mediapipe_frames"], case["handedness_flip"])),
            ("openpose", norm.openpose_to_points(case["openpose_frames"])),
        )
        for kind, (right, left) in inputs:
            feat, present = norm.frame_features(right, left)
            seq, kept = norm.to_sequence(feat, present)
            tag = f"{case['name']} [{kind}]"
            ratio = norm.hand_ratio(present)
            check(tag + " 손 비율", abs(ratio - exp["hand_ratio"]) <= tol, f"got {ratio}")
            check(tag + " 남긴 프레임", kept is not None and list(kept) == list(exp["kept_frames"]), f"got {kept}")
            if seq is None:
                check(tag + " 특징", False, "None")
            else:
                diff = float(np.max(np.abs(seq.astype(np.float64) - want))) if seq.shape == want.shape else float("inf")
                check(tag + f" 특징 {list(seq.shape)} (최대 차이 {diff:.2e})", diff <= tol, f"허용 {tol}")
            if kind == "mediapipe":  # 앱만 하는 단계(E-09). 학습 쪽에는 없지만 같은 값이 나오는지만 본다
                app = "E-09" if ratio < case["min_hand_ratio"] or seq is None else "ok"
                check(tag + " 앱 결과", app == exp["app_result"], f"got {app}")
    return total - len(fails), total, fails


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ok, total, fails = run(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CASES)
    print(f"\n정규화 검사: {ok}/{total} 통과")
    sys.exit(0 if not fails else 1)
