# [역할] (11/19) 좌우 뒤집기 증강: 정규화된 X[...,30,90] 를 "거울처럼 반대 손으로 한 동작"으로 바꾼다.
# 앱 normalize.js 의 mirrorFrame 으로 뒤집은 프레임을 정규화한 값과 똑같아야 한다(test_mirror.py 가 아니라
# scratchpad 에서 사전 영상 42개 좌표로 대조 — 최대 차이 1e-9 수준, design.md 16절).
# 칸: [실제 오른손 42, 실제 왼손 42, 몸 6 = 오른손목 x,y · 왼손목 x,y · 코 x,y]. 손 42 = x,y 번갈아 21점.
import numpy as np

HAND = 42


def mirror_features(X):
    """X [..., 90] → 뒤집은 X. x 좌표 부호를 바꾸고 오른손·왼손 자리를 맞바꾼다(없는 손 0 은 그대로 0)."""
    X = np.asarray(X)
    out = np.empty_like(X)
    r, l, b = X[..., :HAND], X[..., HAND:2 * HAND], X[..., 2 * HAND:]
    sign = np.tile(np.array([-1.0, 1.0], dtype=X.dtype), HAND // 2)
    out[..., :HAND] = l * sign
    out[..., HAND:2 * HAND] = r * sign
    out[..., 2 * HAND:2 * HAND + 2] = b[..., 2:4] * sign[:2]
    out[..., 2 * HAND + 2:2 * HAND + 4] = b[..., 0:2] * sign[:2]
    out[..., 2 * HAND + 4:2 * HAND + 6] = b[..., 4:6] * sign[:2]
    out[out == 0] = 0.0   # -0.0 정리
    return out
