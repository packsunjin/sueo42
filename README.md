# 수어42

수어 42개를 **검색**으로 찾아보고, **뜻 맞히기**로 익히고, **직접 해보기**로 따라 해 보는 웹앱입니다.
디지털새싹 문제해결 경진대회 2026 C.O.D.E. 트랙3 출품작(고1 탐구 활동).

- 검색: 42개 단어의 국립국어원 한국수어사전 영상·수형 설명·출처
- 뜻 맞히기: 사전 영상을 보고 4개 중 뜻 고르기(점수·정답·이 기기 별명 랭킹은 이 기능에만)
- 직접 해보기(핵심, 만드는 중): 카메라로 손 좌표를 계산해 AI가 비슷해 보이는 동작 순위를 보여 주고, 어떤 동작이었는지는 사용자가 고릅니다. 점수·확률·맞음/틀림은 보여 주지 않습니다
- 단계·레벨·연속 학습·배지: 맞고 틀림이 아니라 해 본 횟수·날짜로 셉니다
- 기록은 이 기기 브라우저(localStorage)에만 저장합니다. 서버·로그인 없음, 실제 개인정보를 받지 않습니다

## 로컬에서 실행

빌드가 없는 정적 사이트입니다. `sueo42/` 폴더를 정적 서버로 열면 됩니다(Node.js 필요).

```bash
npx serve sueo42 -l 8080
```

브라우저에서 `http://localhost:8080` 을 엽니다.

- `index.html` 을 파일로 바로 열면(`file://`) 모듈·데이터 읽기가 막혀 동작하지 않습니다.
- 카메라는 `https://` 주소나 `http://localhost` 에서만 켜집니다. 같은 와이파이의 `http://192.168.…` 주소로 휴대폰에서 열면 카메라가 켜지지 않습니다.
- 설정은 `sueo42/config.js` 한 곳에 있습니다(단어 파일 경로, AI 모델 주소 `MODEL_URL` 등). `MODEL_URL` 이 비어 있으면 직접 해보기 순위는 화면 시험용 무작위이고 "시험용"이라고 표시됩니다.

## 폴더

```
sueo42/            공개 폴더(Render 정적 사이트, render.yaml)
  index.html       앱 틀
  config.js        설정 한 곳
  css/app.css      기본 화면 스타일
  data/words.csv   단어 42개
  js/              앱 코드(화면 이동·저장·게임 계산·화면별 파일)
  vendor/          MediaPipe·TensorFlow.js(버전 고정, 출처·sha256 은 vendor/SOURCES.md)
docs/              기능 명세(docs/spec)·구조(docs/tech)
```

## 출처

- 수어 영상·수형 설명: 국립국어원 한국수어사전(https://sldict.korean.go.kr), 저작자표시-비영리-변경금지(CC BY-NC-ND). 영상은 원본 주소 그대로, 편집하지 않고 보여 줍니다.
- 손 좌표 계산: MediaPipe Tasks Vision 0.10.14 (Google, Apache License 2.0) — `sueo42/vendor/LICENSE-mediapipe.txt`
- 모델 실행: TensorFlow.js 4.22.0 (Google, Apache License 2.0) — `sueo42/vendor/LICENSE-tfjs.txt`
- 손 인식 모델 파일 hand_landmarker.task(float16/1): Google MediaPipe. 라이선스는 아직 확인하지 못했습니다.
- AI 모델 학습 데이터(모델을 연결한 뒤): 한국지능정보사회진흥원 AI 허브(aihub.or.kr) 「수어 영상」. 원본 데이터(영상·라벨·키포인트)는 약관에 따라 이 저장소에 넣지 않으며, 학습된 모델만 공개합니다.

## AI 도구로 만든 코드

이 저장소의 코드와 문서는 AI 도구(Claude Code)를 써서 만들었습니다. 기획·결정·검수는 팀이 했습니다.
