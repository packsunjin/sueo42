# training/ — 수어 42개 단어 손동작 모델 학습

AI-Hub「수어 영상」 키포인트로 앱(직접 해보기)에 넣을 모델을 **이 PC(국내)에서** 학습하고
TensorFlow.js(LayersModel)로 바꾼다. 정규화 규칙은 `docs/tech/structure.md` 4절과 한 글자도 다르면 안 된다.

> 이 폴더의 코드는 AI 도구(Claude Code)로 만든 코드다.

## 꼭 지킬 규칙 (AI-Hub 약관)
- **AI-Hub 원본(영상·라벨·키포인트)과 거기서 뽑은 중간 파일(자른 구간, 정규화한 배열, .npy 등)은
  저장소에 넣지 않는다.** GitHub·Colab·Render 같은 공개 장소·해외 서버에도 올리지 않는다.
- 데이터는 **저장소 밖 폴더**(예: `D:\aihub\`)에 두고, 스크립트를 실행할 때 **경로를 인자로** 준다.
  코드에 데이터 경로를 박지 않는다.
- 결과 표·임시 출력도 저장소 밖에 쓴다. 저장소에 들어가는 것은 학습이 끝난 모델
  (`sueo42/model/model.json`·`*.bin`·`labels.json`, 공개 가능한 2차 저작물)뿐이다.
  출처: 한국지능정보사회진흥원 AI 허브(aihub.or.kr)「수어 영상」

## 환경 만들기 (Windows 11, 2026-11-09 기준)
1. Python 3.11 (사용자 범위 설치)
   ```powershell
   winget install -e --id Python.Python.3.11 --scope user
   ```
   설치 위치: `%LOCALAPPDATA%\Programs\Python\Python311\python.exe`
2. **Microsoft Visual C++ 재배포 패키지(x64)** — TensorFlow 가 `msvcp140.dll` 을 찾는다.
   없으면 `import tensorflow` 가 "DLL load failed while importing _pywrap_tf2" 로 실패한다.
   관리자 권한이 필요하다.
3. 가상환경(`training/.venv`, git 에 넣지 않음)과 패키지
   ```powershell
   & "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe" -m venv training\.venv
   training\.venv\Scripts\python.exe -m pip install --upgrade pip
   training\.venv\Scripts\python.exe -m pip install -r training\requirements.txt
   training\.venv\Scripts\python.exe -m pip install --no-deps tensorflowjs==4.22.0
   ```
   버전과 이유는 `requirements.txt` 맨 위에 있다. tensorflowjs 를 `--no-deps` 로 까는 이유도 거기 있다
   (`pip check` 에 flax·jax·jaxlib·tensorflow-decision-forests 가 없다고 나오는 것은 정상).

## 스크립트
| 파일 | 하는 일 |
|---|---|
| `count_words.py` | (3-1) 형태소 라벨 JSON 에서 42개 단어 등장 횟수 표, 적은 단어 표시 |
| `norm.py` | (3-2) 손 좌표 정규화 파이썬 판. 앱 `sueo42/js/ai/normalize.js` 와 같은 결과 |
| `test_norm.py` | (3-2) `docs/tech/norm-testcases.json` 으로 norm.py 검사(인자 없이 실행) |
| `prepare_data.py` | (3-2) 문장(SEN) 손 좌표에서 42개 단어 구간을 잘라 `training/data/` 에 X·y·화자 배열 저장 |
| `smoke_test_tfjs.py` | (3-0) 무작위 숫자 GRU 모델(입력 [1,30,84] → 42)을 TF.js 로 변환해 보는 환경 시험 |
| `tfjs_compat.py` | Windows 에서 tensorflowjs 를 import 하게 빈 모듈을 채움(다른 스크립트가 씀) |

### count_words.py
```powershell
training\.venv\Scripts\python.exe training\count_words.py D:\aihub\01_real_word_morpheme.zip
training\.venv\Scripts\python.exe training\count_words.py D:\aihub\morpheme --few 20 --csv D:\aihub_out\counts.csv
```
- 인자: zip 또는 폴더. zip 은 풀지 않고 안에서 바로 읽는다. `.json` 파일만 읽는다.
- 후보 이름 = `sueo42/data/words.csv` 의 `단어` + `사전 표제어`(쉼표 목록). 이름이 글자까지 같을 때만 센다.
  표의 "맞은 이름(횟수)" 를 보고 어느 이름을 학습에 쓸지 사람이 정한다(봄·북처럼 뜻이 넓은 표제어가 있음).
- `--few N`: 등장 N회 미만이면 "적음"(기본 10, 임시 기준).
- ⚠️ 실제 단어 라벨 파일은 아직 받지 않았다. 문장 라벨 설명(`data` 항목마다 `name`·`start`·`end`)과
  직접 만든 가짜 JSON 으로만 시험했다. 2-2 에서 실제 파일을 받으면 형식을 다시 맞춘다.
- PowerShell 에서 출력을 변수·파이프로 받으면 한글이 깨져 보일 수 있다. 그냥 실행하거나 `--csv` 로 저장해 본다.

### smoke_test_tfjs.py
```powershell
training\.venv\Scripts\python.exe training\smoke_test_tfjs.py C:\temp\tfjs_smoke
```
출력 폴더(저장소 밖)에 `model.json` + 가중치 `.bin` 이 생기면 통과. 뜻 없는 모델이라 저장소에 넣지 않는다.

### prepare_data.py
```powershell
training\.venv\Scripts\python.exe training	est_norm.py
training\.venv\Scripts\python.exe training\prepare_data.py --labels <문장 형태소 라벨 zip ...> --keypoints <문장 keypoint zip ...>
```
- zip 은 풀지 않고 읽기만 한다. 라벨 zip 과 keypoint zip 은 영상 이름(`NIA_SL_SEN0001_REAL01_F`)으로 짝을 맞춘다.
- 출력(기본 `training/data/`, .gitignore 대상 — **커밋·업로드 금지**): `X.npy` [N,30,84], `y.npy`, `speakers.npy`(REAL 번호),
  `angles.npy`, `sentences.npy`, `nframes.npy`, `labels.json`(42개 이름 배열), `meta.json`(표본 수·버린 수).
- 시작할 때 정규화 검사를 돌리고, 앱과 다르면 데이터를 만들지 않고 멈춘다.
- 구간: 프레임 k 시각 = k/30 초, `start ≤ k/30 ≤ end`. `--angles F` 처럼 각도를 고를 수 있다(기본 5개 전부).
