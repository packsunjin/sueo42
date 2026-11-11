# [역할] 손 좌표 정규화(파이썬 판). docs/tech/structure.md 4절, 앱의 sueo42/js/ai/normalize.js 와 같은 결과가 나와야 한다.
#   prepare_data.py(학습 데이터 만들기)와 test_norm.py(docs/tech/norm-testcases.json 검사)가 같이 쓴다.
#   numpy 와 표준 라이브러리만 쓴다(TensorFlow 를 import 하지 않는다).
#
# 한 표본 = [30, 84] float32. 한 프레임 84 = [실제 오른손 42, 실제 왼손 42], 손 42 = x,y 번갈아 21점.
# 손 하나: 손목(0번)을 원점으로 옮기고, 손목~중지 뿌리(9번) 거리(픽셀)로 나눈다. 크기 < 1e-6 이면 그 손 없음(42칸 0).
# 계산은 JS 와 같게 float64 로 하고 맨 끝에서만 float32 로 바꾼다.
import numpy as np

SEQ_LEN = 30
HAND_LEN = 42
FEAT_LEN = 84
EPS = 1e-6


def normalize_hands(pts):
    """손 여러 개를 한꺼번에 정규화.
    pts: [n, 21, 3] (픽셀 x, 픽셀 y, 신뢰도). 손이 아예 없으면 21×3 을 모두 0 으로 넣는다.
    돌려줌: (feat [n, 42] float64, present [n] bool)
    - 0번·9번 신뢰도가 0 이거나 크기 < 1e-6 이면 없음(42칸 0)  — structure.md 4-2, 4-4
    - 그 밖에 신뢰도 0 인 점은 그 점만 (0, 0)
    """
    pts = np.asarray(pts, dtype=np.float64).reshape(-1, 21, 3)
    xy, conf = pts[:, :, :2], pts[:, :, 2]
    d = xy[:, 9, :] - xy[:, 0, :]
    size = np.sqrt(d[:, 0] ** 2 + d[:, 1] ** 2)
    present = (size >= EPS) & (conf[:, 0] > 0) & (conf[:, 9] > 0)
    safe = np.where(present, size, 1.0)
    out = (xy - xy[:, :1, :]) / safe[:, None, None]
    out[conf <= 0] = 0.0
    out[~present] = 0.0
    return out.reshape(-1, HAND_LEN), present


def frame_features(right_pts, left_pts):
    """프레임 n 개의 오른손·왼손 [n,21,3] → (feat [n,84] float64, present [n] bool: 손이 하나라도 있음)"""
    r, rp = normalize_hands(right_pts)
    l, lp = normalize_hands(left_pts)
    return np.concatenate([r, l], axis=1), (rp | lp)


def sample_index(i, n):
    """출력 i 번째(0..29)가 고를 원본 프레임 번호 = i·(n−1)/29 반올림(0.5 는 올림). JS 와 같은 정수식."""
    if n == 1:
        return 0
    return (2 * i * (n - 1) + (SEQ_LEN - 1)) // (2 * (SEQ_LEN - 1))


def to_sequence(feat, present):
    """앞뒤 자르기(손 있는 첫 프레임~마지막 프레임) + 30프레임으로 고르기.
    돌려줌: (seq [30,84] float32 또는 None(손이 한 번도 없음), (first, last) 또는 None)"""
    idx = np.flatnonzero(present)
    if idx.size == 0:
        return None, None
    first, last = int(idx[0]), int(idx[-1])
    kept = feat[first:last + 1]
    n = kept.shape[0]
    pick = [sample_index(i, n) for i in range(SEQ_LEN)]
    return kept[pick].astype(np.float32), (first, last)


def hand_ratio(present):
    """손이 잡힌 프레임 비율(자르기 전 전체 기준). 앱의 E-09 판단과 같은 값."""
    return float(np.mean(present)) if len(present) else 0.0


# ── 입력 형식 두 가지를 [n,21,3] 두 덩어리(오른손, 왼손)로 바꾸기 ──────────────────────────

def openpose_to_points(frames):
    """OpenPose 프레임 목록 → (right [n,21,3], left [n,21,3]).
    frames 원소: {"hand_right_keypoints_2d": [63개], "hand_left_keypoints_2d": [63개]}
    hand_right → 앞 42칸(실제 오른손), hand_left → 뒤 42칸. 값이 없거나 63개가 아니면 그 손 없음(0)."""
    n = len(frames)
    right = np.zeros((n, 21, 3))
    left = np.zeros((n, 21, 3))
    for k, fr in enumerate(frames):
        for arr, key in ((right, "hand_right_keypoints_2d"), (left, "hand_left_keypoints_2d")):
            h = fr.get(key)
            if h is not None and len(h) == 63:
                arr[k] = np.asarray(h, dtype=np.float64).reshape(21, 3)
    return right, left


def mediapipe_to_points(frames, flip):
    """앱이 기록하는 MediaPipe 프레임 목록 → (right [n,21,3], left [n,21,3]). normalize.js 의 assignHands 와 같은 규칙.
    frames 원소: {"width", "height", "hands": [{"label": "Left"|"Right", "landmarks": [[x, y]×21]}]}
    - 비율 좌표를 픽셀로(x·W, y·H)
    - flip=True: "Left" = 실제 오른손 / 두 손이 같은 라벨이면 손목 x 가 작은 손 = 실제 오른손"""
    n = len(frames)
    right = np.zeros((n, 21, 3))
    left = np.zeros((n, 21, 3))
    for k, fr in enumerate(frames):
        hands = []
        for hd in (fr.get("hands") or [])[:2]:
            lm = np.asarray(hd["landmarks"], dtype=np.float64)
            if lm.shape[0] != 21:      # JS normalizeHand: 21점이 아니면 없음
                px = None
            else:
                px = np.ones((21, 3))
                px[:, 0] = lm[:, 0] * fr["width"]
                px[:, 1] = lm[:, 1] * fr["height"]
            hands.append((hd["label"], px, lm[0, 0] * fr["width"]))
        r = l = None
        if len(hands) == 2 and hands[0][0] == hands[1][0]:
            a, b = (hands[0], hands[1]) if hands[0][2] <= hands[1][2] else (hands[1], hands[0])
            r, l = a[1], b[1]
        else:
            for label, px, _ in hands:
                is_right = (label == "Left") if flip else (label == "Right")
                if is_right:
                    r = px
                else:
                    l = px
        if r is not None:
            right[k] = r
        if l is not None:
            left[k] = l
    return right, left
