# [역할] Windows에서 tensorflowjs 를 import 할 수 있게 빈 모듈을 끼워 넣는다.
#
# 왜 필요한가
# - tensorflowjs 4.22.0 은 import 할 때 tensorflow_decision_forests·jax 를 무조건 불러온다.
# - tensorflow_decision_forests 는 Windows 용 설치 파일이 없고, jax/flax 는 uvloop(Windows 미지원)
#   까지 끌고 와서 pip 설치가 실패한다(2026-11-09 이 PC에서 확인).
# - 우리가 쓰는 건 Keras 모델 → TF.js LayersModel 변환(keras_h5_conversion)뿐이고, 이 경로는
#   두 패키지를 실제로 쓰지 않는다. 그래서 진짜 패키지가 없을 때만 빈 모듈을 넣는다.
# - 결정 트리 모델 변환·JAX 변환은 이 환경에서 쓸 수 없다(쓰지 않는다).
#
# 쓰는 법: tensorflowjs 를 import 하기 전에
#     import tfjs_compat; tfjs_compat.install()
import importlib.util
import sys
import types


def _stub(name):
    mod = types.ModuleType(name)
    mod.__dict__["__sueo42_stub__"] = True
    sys.modules[name] = mod
    return mod


def install():
    """진짜 패키지가 없는 것만 빈 모듈로 채운다. 이미 있으면 건드리지 않는다."""
    if importlib.util.find_spec("tensorflow_decision_forests") is None:
        _stub("tensorflow_decision_forests")
    if importlib.util.find_spec("jax") is None:
        jax = _stub("jax")
        exp = _stub("jax.experimental")
        exp.jax2tf = _stub("jax.experimental.jax2tf")
        jax.experimental = exp
