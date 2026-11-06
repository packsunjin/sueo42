# 수어42 앱 구조 (결재용 초안)

작성: frontend-dev, 2026-11-05 (11-06 QA 지적 9건 반영) · backlog 1-3 준비 · 상태: **결재 전(코드·vendor 파일 없음)**
기준 문서: docs/spec/screens.md(S0~S18), docs/spec/game.md, docs/spec/copy.md. 이 문서와 다르면 명세가 맞다.
관련 결재: decisions.md 2026-11-05 "앱 구조: 빌드 없는 JS 모듈, MediaPipe·TF.js 저장소 안에 보관" — 승인 후 중단, 다시 결재.

## 결론
**빌드 없는 ES 모듈 + 해시 라우터 + 라이브러리 저장소 안 보관(sueo42/vendor/)** 으로 간다.
render.yaml(빌드 명령 없음, `./sueo42` 공개)을 그대로 쓰고, `sueo42/model/model.json`·`sueo42/data/words.csv` 경로가 그대로 공개 주소가 된다.

---

## 1. 쓸 기술과 이유

| 항목 | 고른 것 | 이유 |
|---|---|---|
| 코드 방식 | 브라우저 기본 ES 모듈(`<script type="module">`, `import`) | 빌드 없이 Render가 폴더를 그대로 공개. 파일을 기능별로 나눌 수 있음 |
| 화면 이동 | 해시 라우터(`#/search`, `#/word/12` …) | 주소가 바뀌어도 서버는 항상 `index.html`만 줌 → Render 리라이트 설정 불필요, 새로고침·뒤로가기 동작. 상대 경로(`vendor/…`, `model/…`)가 항상 같은 기준으로 풀림 |
| 화면 그리기 | 프레임워크 없이 화면마다 `render(el, params)` 함수 | 명세 화면 S0~S18(19개)이지만 탭 5개(홈·검색·뜻 맞히기·직접 해보기·내 기록) + 직접 해보기 흐름으로 묶이고, 창(S7·S14·S18)은 화면 안에 띄움. 상태는 localStorage 하나(sueo42-v1)뿐이라 프레임워크 없이 충분. 프레임워크를 넣으면 빌드나 CDN이 필요해짐 |
| 저장 | localStorage(키 하나, 버전 번호 포함) | 서버 없음. 실제 개인정보 없이 별명만 |
| 손 인식 | @mediapipe/tasks-vision 0.10.14 HandLandmarker (VIDEO 모드, 손 2개) | 1차 코드에서 쓰던 API. 브라우저 안에서만 처리 |
| 모델 실행 | @tensorflow/tfjs 4.22.0 (`tf.loadLayersModel`) | 3-4에서 ml-engineer가 변환할 형식. 직접 해보기에 들어갈 때만 불러옴 |

### Vite 등 빌드 도구와 비교
| | 빌드 없음(추천) | Vite |
|---|---|---|
| Render | render.yaml 그대로 | buildCommand·`dist` 공개로 바꿔야 함 |
| 모델·데이터 경로 | `sueo42/model/…` 그대로 공개 | `public/` 아래로 옮기고 경로 다시 맞춤 |
| 라이브러리 고정 | vendor/ 파일 자체가 고정 | package-lock으로 고정(편함) |
| 개발 편의 | 새로고침 | 자동 새로고침·번들링 |
| 실패 지점 | 정적 파일만 | 빌드 실패·Node 버전 차이가 배포를 막을 수 있음 |

이 앱은 화면 수가 적고, 무거운 부분(MediaPipe·TF.js)은 이미 완성된 배포 파일이라 번들링 이득이 없다. 빌드를 추가하면 배포 실패 지점만 는다. → 빌드 없음 유지.

---

## 2. 라이브러리 — sueo42/vendor/ 에 보관

이유: 결선장(DDP) 인터넷이 불안정하면 CDN·Google 저장소에서 받는 단계에서 직접 해보기가 멈춘다. 저장소 안에 두면 Render 한 곳에서 다 받고, 노트북 localhost 시연이면 인터넷 없이도 된다.

### 버전
- **@mediapipe/tasks-vision 0.10.14** (npm 게시 2024-05-10). npm 최신은 1.2.2(2026-11-03 게시, 이틀 전)지만 쓰지 않는다 — API가 1차 코드와 같은지 확인 안 됐고 너무 새것. 0.10.14로 고정.
- **hand_landmarker.task float16 버전 1** (`…/hand_landmarker/float16/1/hand_landmarker.task`, `latest`가 아니라 `1`로 고정)
- **@tensorflow/tfjs 4.22.0** (npm 게시 2024-10-21, 현재 npm 최신과 같음)

### 파일과 크기 (2026-11-05 확인, 내려받지 않음)
확인 방법: jsdelivr 파일 목록 API(`data.jsdelivr.com/v1/packages/npm/<패키지>@<버전>?structure=flat`), .task는 `curl -sI` HEAD의 Content-Length.

| 넣을 위치(sueo42/vendor/…) | 원본 | 크기(바이트) |
|---|---|---|
| mediapipe/tasks-vision@0.10.14/vision_bundle.mjs | npm 패키지 | 136,870 |
| mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.js | 〃 | 209,826 |
| mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.wasm | 〃 | 9,423,986 |
| mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_nosimd_internal.js | 〃 | 209,735 |
| mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_nosimd_internal.wasm | 〃 | 9,294,247 |
| mediapipe/hand_landmarker/float16-1/hand_landmarker.task | storage.googleapis.com/mediapipe-models/… | 7,819,105 |
| tfjs@4.22.0/tf.min.js | npm 패키지 dist/ | 1,469,843 |
| 합계(저장소) | | 약 28.6 MB |

- `.map`, `.cjs`, `vision.d.ts` 는 넣지 않는다.
- wasm 두 벌은 브라우저가 **하나만** 받는다(FilesetResolver가 SIMD 지원 여부로 고름). nosimd는 옛 기기용이라 남긴다.
- 방문자 한 명이 처음 받는 양: 모델 없을 때 약 17.6 MB, 모델 있을 때 약 19.1 MB + 학습 모델 크기(3-3 뒤 확인). 두 번째부터는 브라우저 캐시.
- GitHub 한 파일 한도(100 MB)와 부딪히지 않음.

### 라이선스
| 파일 | 라이선스 | 확인한 곳 |
|---|---|---|
| tasks-vision 0.10.14 | Apache-2.0 | 패키지 안 package.json `"license"` |
| tfjs 4.22.0 | Apache-2.0 | 패키지 안 package.json `"license"` |
| hand_landmarker.task | **확인 못 함** | 공식 페이지(ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)에 "Model Card" 링크만 있음. 모델 카드 PDF를 열어 확인해야 함 |

- jsdelivr·unpkg의 `…/LICENSE` 경로는 둘 다 404 — **npm 패키지 안에 LICENSE 파일이 없다.** 그래서 라이선스는 (1) 패키지 package.json의 `license` 필드와 (2) 원 저장소 LICENSE 원문(github.com/google-ai-edge/mediapipe, github.com/tensorflow/tfjs — 둘 다 Apache License 2.0 원문 확인)으로 확인한다.
- 넣을 때 할 일: `vendor/` 에 Apache-2.0 원문을 `LICENSE-mediapipe.txt`·`LICENSE-tfjs.txt`로 두고(원 저장소 LICENSE에서 복사), `vendor/SOURCES.md`에 파일마다 원본 주소·버전·받은 날짜·sha256을 적는다. Apache-2.0은 재배포 시 라이선스 사본 동봉을 요구한다.

### Render 무료 정적 사이트와 부딪히는지
- Render 문서(render.com/docs/static-sites, /docs/outbound-bandwidth, /pricing, 2026-11-05 확인): 정적 사이트는 무료, 워크스페이스 **Hobby 요금제 월 5 GB 전송량 포함, 넘으면 GB당 $0.15**. Brotli 압축·CDN·https 자동.
- 계산: 5 GB ÷ 약 19 MB ≈ **첫 방문 약 260회/월**. 결선 준비·시연에는 충분, 홍보로 많이 퍼지면 넘을 수 있음.
- 정적 사이트 파일 개수·크기 한도: 문서에서 **확인 못 함**.
- 카드 등록 없이 5 GB를 넘으면 정지되는지 과금되는지: **확인 못 함**(5-1 Render 연결 때 사장이 화면에서 확인).
- `.wasm`을 `application/wasm`으로 주는지 **확인 못 함**. 다른 MIME이면 Emscripten이 "streaming 실패 → ArrayBuffer로 다시"로 넘어가 느려질 뿐 동작은 한다(실제로는 배포 후 확인). 필요하면 render.yaml `headers`로 지정 가능 — render.yaml은 내 담당 밖이라 [요청]으로 올림.
- 전송량을 줄이는 법: MediaPipe·TF.js는 **직접 해보기 화면에 들어갈 때만** 불러온다(검색·뜻 맞히기만 쓰는 방문자는 받지 않음).

---

## 3. 폴더·파일 목록

```
(저장소 맨 위)
.gitignore                 1-3 때 실제로 만든다(아래 목록). AI-Hub 원본·중간 파일이 실수로 커밋되지 않게
render.yaml                그대로(고치지 않음)
sueo42/
  index.html               틀(아래 탭, 화면 자리 #app), main.js 하나만 불러옴
  config.js                ★ 설정 한 곳(아래)
  css/app.css              기본 화면 스타일(디자인 시안은 4-2에서 designer가 덮어씀)
  data/words.csv           42개 단어(경로 고정). 앱은 이 파일만 읽는다(시트 직접 읽기 없음 — 5번)
  model/                   3-4에서 채움: model.json, *.bin, labels.json (지금은 없음)
  vendor/                  2절 파일 + LICENSE-*.txt + SOURCES.md
  js/
    main.js                시작: 단어 불러오기(S0), 라우터 시작, 탭 바·상태 줄(C-07), 토스트(T-01~T-04)
    router.js              해시 주소 → 화면 함수, 화면 나갈 때 정리 함수(카메라 끄기 등) 호출
    util.js                글자 안전하게 넣기(esc), 섞기, 날짜(로컬 기준 YYYY-MM-DD)
    copy.js                docs/spec/copy.md 문구를 번호로 그대로 옮긴 표(E-01 등). 화면 파일은 문장을 직접 쓰지 않고 번호로 가져온다
    data/csv.js            CSV 파싱(따옴표 안 쉼표·줄바꿈 처리)
    data/words.js          data/words.csv 읽기, 열 이름은 config.COLUMNS, 번호로 단어 찾기, 검색 거름(단어·사전 표제어)
    store.js               localStorage 읽기·쓰기(키 sueo42-v1, game.md), 형식 다르면 빈 기록, 쓰기 실패면 메모리 + E-11
    game/progress.js       단계·레벨·연속 학습·배지 계산(game.md, 참여 기준)
    screens/start.js       S0 첫 화면(불러오기, 실패 시 E-01)
    screens/home.js        S1 홈
    screens/search.js      S2 검색
    screens/detail.js      S3 단어 상세(사전 영상·수형 설명·출처 C-12)
    screens/quiz.js        S4 단계 고르기, S5·S5' 문제·정답 보기, S6 결과, S7 별명 창, S8 랭킹
    screens/lab-pick.js    S9 직접 해보기 단어 고르기
    screens/lab-intro.js   S10 카메라 안내(처음 한 번, cameraIntroSeen)
    screens/lab.js         S11 연습 → S12 분석 중 → S13 결과 → S14 42개 목록 창 → S15 기록됨(카메라를 끄지 않고 한 파일에서 이어 감)
    screens/records.js     S16 내 기록·배지, S18 기록 지우기 창
    screens/info.js        S17 정보·출처(I-01~I-06, I-04는 모델 연결 뒤에만)
    ai/camera.js           카메라 켜기·끄기, 브라우저 오류를 E-03~E-06 번호로 바꿈
    ai/hands.js            MediaPipe 불러오기(vendor), GPU 실패 시 CPU, 프레임마다 손 좌표
    ai/draw.js             손 21점·선을 캔버스에 그림, 기록한 좌표 다시 보기
    ai/normalize.js        ★ 4절 정규화(학습 코드와 똑같아야 함)
    ai/model.js            TF.js·모델 불러오기, 순위(단어 이름)만 돌려줌. MODEL_URL 비었을 때만 시험용, 불러오기 실패는 E-08
```

### .gitignore 에 넣을 것(1-3 때 저장소 맨 위에 만든다)
AI-Hub 데이터는 원래 저장소 밖 폴더에 두지만, 실수로 안에 풀었을 때를 막는 마지막 장치다.
```
# AI-Hub「수어 영상」 원본·중간 파일 — 저장소에 넣지 않는다(약관)
*.zip
*.tar
*.7z
**/*_keypoint/
**/*_morpheme/
**/*real_word*
**/*real_sen*
**/*REAL[0-9][0-9]*
**/aihub*/
**/AIHub*/
training/data/
training/out/
*.npy
*.npz
*.h5
*.keras
# 영상 원본
*.mp4
*.mov
*.avi
# 개발 도구
node_modules/
.DS_Store
Thumbs.db
```
- `*.mp4`를 막으면 팀이 찍은 영상도 같이 막힌다. 팀 영상을 저장소에 넣기로 정해지면 그 폴더만 `!` 로 연다(지금은 결정 없음).
- 학습된 모델(`sueo42/model/*.json`, `*.bin`)은 막지 않는다(공개 가능, 출처 표기).
- 정확한 폴더 이름 패턴은 2-2에서 실제 파일을 받은 뒤 ml-engineer와 맞춘다.

### config.js (설정 한 곳)
```js
// [설정] 주소·열 이름·게임 숫자를 바꾸는 곳. 다른 파일은 고치지 않아도 되게.
export const CONFIG = {
  WORDS_CSV_URL: "data/words.csv",        // 이 파일만 읽는다. 시트 탭에는 번호·단계 열이 없어 시트를 직접 읽지 않음
  STORAGE_KEY: "sueo42-v1",               // game.md
  COLUMNS: { number:"번호", name:"단어", headword:"사전 표제어", handshape:"수형 설명",
             video:"영상", category:"분류", page:"항목 페이지", aihub:"AI-Hub 문장 수", stage:"단계" },
  // 출처 문구는 여기 두지 않고 copy.js 의 C-12(표제어 들어감)·C-19(표제어 없음)·I-04 를 그대로 쓴다
  //   C-12: 출처: 국립국어원 한국수어사전 「{사전 표제어}」 (일상생활 수어, 저작자표시-비영리-변경금지)
  MODEL_URL: "",                          // 3-4 뒤 "model/model.json"
  MODEL_LABELS_URL: "",                   // 3-4 뒤 "model/labels.json"
  TFJS_URL: "vendor/tfjs@4.22.0/tf.min.js",
  MEDIAPIPE_DIR: "vendor/mediapipe/tasks-vision@0.10.14",
  HAND_MODEL_URL: "vendor/mediapipe/hand_landmarker/float16-1/hand_landmarker.task",
  LAB_RECORD_SECONDS: 2,                  // 명세 S11 초안 2초. 최종 값은 ml-engineer가 모델 입력(30프레임)에 맞춰 정함
  LAB_MIN_HAND_RATIO: 0.5,                // 명세 S12 초안: 손 잡힌 프레임이 절반 미만이면 E-09. 최종 기준은 ml-engineer가 정함
  LAB_RANK_SIZE: 2,
  HANDEDNESS_FLIP: true,                  // 4-3: MediaPipe 라벨을 뒤집어 읽음. 1-6 시험 결과로 확정
  // 게임 숫자(점수·보기 수·랭킹 수·단계당 단어 수)는 1-1 명세 결재 뒤 채움
};
```

---

## 4. 손 좌표 정규화 명세 (ai/normalize.js = ml-engineer 학습 코드)

**앱과 학습이 한 글자도 다르면 안 된다.** 그래서 이 절을 둘의 기준으로 하고, 1-6·3-2에서 **같은 시험 입력·기대 출력 파일**(`docs/tech/norm-testcases.json`, 손 좌표 몇 세트 → 84×30 숫자)을 만들어 JS와 Python이 둘 다 통과하게 한다(소수 6자리까지 같음).
- **이 파일의 입력 좌표는 AI-Hub 데이터에서 가져오지 않는다**(키포인트 한 프레임도 원본 데이터다, 약관). 직접 지어낸 숫자(예: 손목 (320,240), 9번 (320,190) 같은 손 모양 흉내)나 **팀원이 직접 찍은 MediaPipe 좌표**만 쓴다. OpenPose 형식 시험은 같은 숫자를 OpenPose JSON 모양으로 옮겨 만든다.

### 4-1. 입력 맞추기
| | 앱 (MediaPipe) | 학습 (AI-Hub OpenPose JSON) |
|---|---|---|
| 좌표 | 0~1 비율 (x는 가로 대비, y는 세로 대비) | 픽셀 |
| 픽셀로 | `px = x × W`, `py = y × H` (W·H = 검출에 넣은 프레임의 `video.videoWidth/Height`) | 그대로 |
| z | 버림 | 없음(세 번째 값은 신뢰도) |
| 점 순서 | 21점(0 손목, 4 엄지 끝, 9 중지 뿌리 …) | 같음 |

**가로세로 비율 보정**: MediaPipe 비율 좌표는 x 1칸과 y 1칸의 실제 길이가 다르다(640×480이면 4:3). 비율 그대로 손 크기로 나누면 모양이 찌그러진다. 그래서 **반드시 픽셀로 바꾼 뒤** 아래 계산을 한다. 픽셀 단위 자체는 손 크기로 나누면서 사라지므로 해상도가 달라도 결과는 같다.

**화면 거울 뒤집기**: 앱 화면은 CSS로 좌우를 뒤집어 보여 줘도, **정규화에는 뒤집지 않은 원래 프레임 좌표**를 쓴다. AI-Hub 영상도 뒤집지 않은 카메라 영상이라 x 방향이 같아진다. (AI-Hub 영상이 뒤집혀 저장됐는지는 **확인 못 함** — 3-2에서 ml-engineer가 영상 한 개로 확인.)

### 4-2. 손 하나 정규화 (21점 → 42개 숫자)
```
p[k] = (px_k, py_k), k = 0..20
size = √((px_9 − px_0)² + (py_9 − py_0)²)        # 손목~중지 뿌리 거리
size < 1e-6 이면 → 그 손은 "없음"
out = [ (px_0−px_0)/size, (py_0−py_0)/size, (px_1−px_0)/size, (py_1−py_0)/size, …, k=20 ]   # x,y 번갈아
```
- 크기 기준을 9번(중지 뿌리) 하나로 고정한다. 손가락을 접어도 거의 안 변하는 길이라서.
- 회전은 맞추지 않는다(손 방향 자체가 수어 정보).

### 4-3. 왼손·오른손 자리 (84 = [오른손 42, 왼손 42])
**기준은 "수어 하는 사람의 실제 오른손/왼손"이다.** 앞 42칸 = 실제 오른손, 뒤 42칸 = 실제 왼손.

- **학습(OpenPose)**: `hand_right_keypoints_2d` → 앞 42, `hand_left_keypoints_2d` → 뒤 42. OpenPose의 left/right는 사람 기준이다.
- **앱(MediaPipe)**: tasks-vision 문서는 handedness를 "입력 영상이 거울처럼 뒤집혀 있다고 가정하고" 정한다고 설명한다. 앱은 뒤집지 않은 원래 카메라 프레임을 넣으므로 **라벨이 반대로 나온다**: `"Left"` = 실제 오른손, `"Right"` = 실제 왼손.
  - 이건 문서 설명에서 나온 추론이고 **실제로 확인 못 함**. 1-6에서 오른손만 들고 라벨을 보는 시험을 반드시 한다. 결과에 따라 `config.HANDEDNESS_FLIP`(true/false) 한 곳만 바꾸게 짠다.
  - 두 손이 **같은 라벨**로 나오면(가끔 생김): 원래 프레임에서 손목 x가 작은(화면 왼쪽) 손 = 실제 오른손으로 나눈다(뒤집지 않은 셀카 영상에서 사람의 오른손은 영상 왼쪽에 보임).
  - 손이 3개 이상은 없음(numHands: 2).
- 왼손잡이 수어자는 따로 처리하지 않는다(AI-Hub 언어제공자의 주 손이 모두 오른손인지 **확인 못 함**).

### 4-4. 손이 하나·없을 때
- 그 프레임에서 없는 손 자리는 **42개 모두 0**.
- 학습(OpenPose)에서 "손 없음" 판정: 0번(손목) 또는 9번 신뢰도가 0이면 없음. 그 밖에 신뢰도 0인 점은 정규화 뒤 그 점만 (0, 0). — 문턱값은 3-2에서 ml-engineer가 데이터를 보고 정하고 이 문서에 적는다(MediaPipe는 항상 21점이 다 나오므로 앱 쪽에는 영향 없음).
- 다른 프레임 값으로 메우지 않는다(앞뒤 복사·보간 안 함). 단순하고 두 쪽이 같게 하기 쉬워서.

### 4-5. 30프레임으로 맞추기
0. **손이 거의 안 보이면 멈춤(앱만)**: 기록한 프레임(기록 시간 2초 동안 잡은 전부, 자르기 전) 중 손이 하나라도 잡힌 프레임이 `LAB_MIN_HAND_RATIO`(0.5) 미만이면 정규화·모델을 돌리지 않고 E-09(명세 S12). 0개일 때도 같다. 기준값은 ml-engineer가 정한다.
1. **앞뒤 자르기**: 기록한 프레임 중 손이 하나라도 있는 첫 프레임 ~ 마지막 프레임만 남긴다(학습도 start·end 구간에서 같은 방식).
2. 남은 프레임 수 N. 출력 i = 0..29 마다 원본 번호
   ```
   N == 1 이면 idx = 0
   아니면    idx = floor( (2·i·(N−1) + 29) / 58 )     # = i·(N−1)/29 를 반올림(0.5는 올림), 정수 계산
   ```
   - Python `round()`는 0.5에서 짝수 쪽으로 가고 JS `Math.round`는 올림이라 결과가 달라진다 → **두 쪽 모두 위 정수식을 쓴다.**
   - 보간하지 않고 가장 가까운 프레임을 고른다(없는 손 0과 섞이지 않게).
3. 앱은 카메라 프레임 간격이 일정하지 않다(초당 15~30장). 프레임 번호로 고르므로 동작 길이·속도 차이가 남는다 — AI-Hub는 30 fps 고정. 앱은 프레임을 화면 갱신마다 잡지 않고 **약 33 ms 간격 이상일 때만** 기록해 30 fps에 가깝게 맞춘다(완전히 같지는 않음).
4. 결과 `[30][84]`, float32.

### 4-6. 학습 쪽 구간 자르기(참고, ml-engineer 결정)
프레임 k의 시각 = k/30 초, `start ≤ k/30 ≤ end` 인 프레임. 정확한 규칙은 3-2에서 정해 이 절에 적는다.

---

## 5. 모델 인터페이스 (ai/model.js)

- 파일: `model/model.json`(+ 가중치 .bin, `tf.loadLayersModel` 형식), `model/labels.json` = 출력 순서대로 단어 이름 배열. 이름은 words.csv `단어` 열과 글자까지 같아야 함.
- 입력: `tf.tensor3d([features], [1, 30, 84], 'float32')`
- 출력: `[1, 42]`. 큰 값 순서로 **번호만** 정렬 → 단어 이름으로 바꿈 → words.csv에 있는 이름만 → 앞에서 `LAB_RANK_SIZE`(2)개.
- 출력 숫자는 정렬에만 쓰고 **바로 버린다**: 텐서 `dispose()`, 변수·기록·localStorage·console에 남기지 않는다. 함수가 돌려주는 값은 `{ names: ["택시","버스"], trial: false }` 뿐.
- 세 경우를 나눈다(명세 S12):
  | 경우 | 돌려주는 값 | 화면 |
  |---|---|---|
  | **MODEL_URL 이 비었음**(모델 연결 전) | `{ names: 42개 중 서로 다른 무작위 2개, trial: true }` — 따라 할 단어를 일부러 넣지 않음 | 순위 + "시험용" L-03 + L-04 |
  | 모델 **불러오기 실패**(파일 404, labels 개수 ≠ 출력 개수, 입력 모양이 [null,30,84]가 아님 등) | `{ error: "E-08" }` — **순위 없음**, 무작위로 대신하지 않음 | E-08 + [다시 시도] [다른 단어 고르기] |
  | 순위 계산 중 다른 오류 | `{ error: "E-10" }` | E-10 + [다시 해보기] |
  실패 이유는 console에 한 줄(출력 숫자는 넣지 않음).
- 손이 거의 안 잡혔으면(4-5의 0번) 모델을 부르지 않고 E-09. E-09·E-10의 [다시 해보기]는 시도 횟수에 넣지 않는다(copy.md).
- TF.js는 모델 주소가 있을 때만, 직접 해보기에 들어갈 때 `<script>`로 불러온다(tf.min.js는 ES 모듈이 아닌 UMD 파일).

---

## 6. 카메라·https

- `getUserMedia`는 **보안 주소에서만** 된다: `https://…` 또는 `http://localhost`·`http://127.0.0.1`. 같은 와이파이의 `http://192.168.x.x`로 휴대폰에서 열면 카메라가 안 켜진다.
- PC 시험: 저장소에서 정적 서버를 띄워 `http://localhost:8080` (이 PC는 Node 20 있음, Python은 실제 설치가 아니라 Windows 스토어 연결만 있음). 1-3에서 `.claude/launch.json`에 정적 서버를 등록해 브라우저로 확인. `file://`로 열면 ES 모듈·fetch가 막혀 안 된다.
- 휴대폰 시험(Render 연결 전): 안드로이드 크롬 USB 디버깅 + PC 크롬 `chrome://inspect` **포트 전달**(휴대폰의 localhost:8080 → PC). 외부 서비스 가입 없이 된다. 아이폰은 이 방법이 없어 Render https 연결(5-1) 뒤 시험.
- iOS 사파리: `<video playsinline muted autoplay>` 필요.
- 화면을 나가거나 앱이 백그라운드로 가면(`visibilitychange`) 카메라를 끈다.

## 7. 오류 처리 목록
문구는 여기서 새로 쓰지 않는다. **copy.md 번호의 문장·버튼을 그대로** 쓴다(js/copy.js). 이 표는 "어떤 기술적 상황을 어느 번호로 보내는지"만 정한다.

| 기술적 상황 | 보내는 번호 | 화면(screens.md) |
|---|---|---|
| words.csv fetch 실패·파싱 결과 0줄 | E-01 | S0 |
| localStorage 읽기 실패·형식 다름 | (안내 없음) 빈 기록으로 시작 | — |
| localStorage 쓰기 실패(시크릿 모드 등) | E-11, 이번 창에서만 메모리에 기억 | S0 다음 한 번, S15 |
| 사전 영상 `<video>` error | E-02 (뜻 맞히기에서는 + Q-30) | S3·S5·S11·S13 |
| 보안 주소 아님(`isSecureContext` false) | E-05 | S10·S11 |
| `navigator.mediaDevices`·`getUserMedia` 없음, WebAssembly 없음 | E-06 | S10·S11 |
| `NotAllowedError`·`SecurityError` | E-03 | S10·S11 |
| `NotFoundError`·`NotReadableError` | E-04 | S10·S11 |
| `OverconstrainedError` | 해상도 조건 없이 한 번 더 시도, 그래도 실패면 E-04 | S10·S11 |
| MediaPipe 파일(vendor) 불러오기 실패 | E-07 | S11 |
| MediaPipe GPU 실패 | 안내 없이 CPU로 다시 만들기, CPU도 실패면 E-07 | S11 |
| 카메라·MediaPipe 불러오는 중 | C-08, 끝나기 전 [동작 시작] 흐리게(첫 방문 약 18 MB) | S11 |
| 손 잡힌 프레임 절반 미만 | E-09 | S12 |
| 모델 불러오기 실패(MODEL_URL 있음) | E-08, 순위 없음 | S12 |
| 순위 계산 중 다른 오류 | E-10 | S12 |
| MODEL_URL 비었음 | 오류 아님: 시험용 순위 + L-03·L-04 | S1(홈 카드)·S9·S11·S13 |
| 직접 해보기에서 가로 화면·너무 좁음 | E-12 | S11 |

---

## 확인한 것 / 확인 못 한 것
- 확인: 2절 파일 크기 7개(jsdelivr API·HEAD), 두 패키지 Apache-2.0(package.json), 원 저장소 LICENSE 원문, jsdelivr·unpkg LICENSE 404, 버전 게시일, Render 무료 정적 사이트·Hobby 5 GB, 이 PC Node 20.
- 확인 못 함: hand_landmarker.task 라이선스, Render 파일 한도·초과 시 처리·wasm MIME, MediaPipe handedness 실제 방향(4-3), AI-Hub 영상 거울 여부, AI-Hub 수어자 주 손, 학습 모델 크기, wasm Brotli 압축률.
