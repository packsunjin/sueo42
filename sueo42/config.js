// [설정] 주소·열 이름·게임 숫자를 바꾸는 곳. 다른 파일은 고치지 않아도 되게 한다.
export const CONFIG = {
  WORDS_CSV_URL: "data/words.csv",        // 이 파일만 읽는다(시트 직접 읽기 없음)
  STORAGE_KEY: "sueo42-v1",               // game.md 7절
  COLUMNS: {
    number: "번호", name: "단어", headword: "사전 표제어", handshape: "수형 설명",
    video: "영상", category: "분류", page: "항목 페이지", aihub: "AI-Hub 문장 수", stage: "단계",
  },
  // 출처 문구는 여기 두지 않고 js/copy.js 의 C-12·C-19·I-04 를 그대로 쓴다

  // ── AI 모델 (3-4 에서 채움). 비어 있으면 직접 해보기 순위는 "시험용"(무작위) ──
  MODEL_URL: "",                          // 3-4 뒤 "model/model.json"
  MODEL_LABELS_URL: "",                   // 3-4 뒤 "model/labels.json"
  TFJS_URL: "vendor/tfjs@4.22.0/tf.min.js",
  MEDIAPIPE_DIR: "vendor/mediapipe/tasks-vision@0.10.14",
  HAND_MODEL_URL: "vendor/mediapipe/hand_landmarker/float16-1/hand_landmarker.task",
  LAB_RECORD_SECONDS: 2,                  // 명세 S11 초안 2초. 최종 값은 ml-engineer 가 정함
  LAB_MIN_HAND_RATIO: 0.5,                // 명세 S12 초안. 최종 기준은 ml-engineer 가 정함
  LAB_RANK_SIZE: 2,
  HANDEDNESS_FLIP: true,                  // structure.md 4-3. 1-6 시험 결과로 확정
  LAB_LOW_DATA_MAX: 3,                    // 결재 4: AI-Hub 문장 수가 이 값 이하면 L-13 안내(3-1 뒤 다시 정함)

  // ── 게임 숫자 (game.md, 2026-11-09 결재) ──
  STAGE_COUNT: 7,
  WORDS_PER_STAGE: 6,
  LEVEL_THRESHOLDS: [0, 10, 25, 45, 70, 100, 140, 190, 250, 320], // 레벨 1~10 에 필요한 누적 레벨 점수
  LEVEL_QUIZ_POINTS: 1,                   // 뜻 맞히기 1문제 = 1
  LEVEL_LAB_POINTS: 2,                    // 직접 해보기 기록 1개 = 2
  QUIZ_QUESTIONS: 6,
  QUIZ_OPTIONS: 4,
  QUIZ_POINTS_PER_ANSWER: 10,
  RANKING_SIZE: 10,
  NICKNAME_MAX: 8,
  TOAST_MS: 2500,
};

// 모델이 연결됐는지(아니면 직접 해보기 결과에 "시험용")
export const isTrialModel = () => !CONFIG.MODEL_URL;
