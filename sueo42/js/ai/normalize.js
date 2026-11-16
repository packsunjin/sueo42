// [손 좌표 정규화] docs/tech/structure.md 4절 그대로. 학습 코드(ml-engineer, Python)와 한 글자도 달라지면 안 된다 — docs/tech/norm-testcases.json 으로 둘 다 시험한다.
//
// 입력 프레임 모양(앱이 기록하는 것):
//   { width, height, hands: [ { label: "Left"|"Right", landmarks: [[x, y], …21개] } ] }   x·y 는 MediaPipe 0~1 비율, 뒤집지 않은 원래 프레임 기준
// 출력: [30][84] 숫자 배열. 한 프레임 84 = [실제 오른손 42, 실제 왼손 42], 손 42 = x,y 번갈아 21점

export const SEQ_LEN = 30;
export const HAND_LEN = 42;
export const FEAT_LEN = 84;
const EPS = 1e-6;

// 4-1. 비율 → 픽셀 (가로세로 비율 보정). z 는 버림
export function toPixels(landmarks, width, height) {
  return landmarks.map(([x, y]) => [x * width, y * height]);
}

// 4-2. 손 하나: 손목(0) 기준, 손목~중지 뿌리(9) 거리로 나눔. 크기 < 1e-6 이면 null(그 손 없음)
export function normalizeHand(px) {
  if (!px || px.length !== 21) return null;
  const [x0, y0] = px[0];
  const size = Math.sqrt((px[9][0] - x0) ** 2 + (px[9][1] - y0) ** 2);
  if (!(size >= EPS)) return null;
  const out = new Array(HAND_LEN);
  for (let k = 0; k < 21; k++) {
    out[2 * k] = (px[k][0] - x0) / size;
    out[2 * k + 1] = (px[k][1] - y0) / size;
  }
  return out;
}

// 4-3. 실제 오른손/왼손 자리 나누기 (픽셀 좌표로 돌려줌)
//   flip=true: MediaPipe "Left" = 실제 오른손, "Right" = 실제 왼손 (뒤집지 않은 프레임을 넣으므로)
//   두 손이 같은 라벨이면: 손목 x 가 작은(화면 왼쪽) 손 = 실제 오른손
export function assignHands(frame, flip) {
  const hands = (frame.hands || []).slice(0, 2).map((hd) => ({
    label: hd.label,
    px: toPixels(hd.landmarks, frame.width, frame.height),
  }));
  const isRight = (label) => (flip ? label === "Left" : label === "Right");
  let right = null, left = null;
  if (hands.length === 2 && hands[0].label === hands[1].label) {
    const [a, b] = hands[0].px[0][0] <= hands[1].px[0][0] ? hands : [hands[1], hands[0]];
    right = a.px; left = b.px;
  } else {
    for (const hd of hands) {
      if (isRight(hd.label)) right = hd.px; else left = hd.px;
    }
  }
  return { right, left };
}

// 프레임 하나 → { feat: 84개, present: 손이 하나라도 있는지 }. 없는 손 자리는 42개 모두 0 (4-4)
export function frameFeatures(frame, flip) {
  const { right, left } = assignHands(frame, flip);
  const r = normalizeHand(right);
  const l = normalizeHand(left);
  const feat = new Array(FEAT_LEN).fill(0);
  if (r) for (let i = 0; i < HAND_LEN; i++) feat[i] = r[i];
  if (l) for (let i = 0; i < HAND_LEN; i++) feat[HAND_LEN + i] = l[i];
  return { feat, present: !!(r || l) };
}

// 몸 기준 위치 6칸(11/16, training/norm.py body_features 와 같음):
//   [실제 오른손 손목 x,y, 실제 왼손 손목 x,y, 코 x,y] = (점 − 양어깨 가운데) / 어깨 너비(픽셀).
//   frame.body = { nose:[x,y], rs:[x,y], ls:[x,y] } (0~1 비율, rs = 사람의 오른어깨). 어깨가 없으면 6칸 0
export const BODY_LEN = 6;
export const FULL_LEN = FEAT_LEN + BODY_LEN;
export function bodyFeatures(frame, flip) {
  const out = new Array(BODY_LEN).fill(0);
  const b = frame.body;
  if (!b || !b.rs || !b.ls) return out;
  const [rs, ls] = toPixels([b.rs, b.ls], frame.width, frame.height);
  const cx = (rs[0] + ls[0]) / 2, cy = (rs[1] + ls[1]) / 2;
  const w = Math.sqrt((rs[0] - ls[0]) ** 2 + (rs[1] - ls[1]) ** 2);
  if (!(w >= EPS)) return out;
  const { right, left } = assignHands(frame, flip);
  [right, left].forEach((px, slot) => {
    if (normalizeHand(px)) { out[2 * slot] = (px[0][0] - cx) / w; out[2 * slot + 1] = (px[0][1] - cy) / w; }
  });
  if (b.nose) {
    const [[nx, ny]] = toPixels([b.nose], frame.width, frame.height);
    out[4] = (nx - cx) / w; out[5] = (ny - cy) / w;
  }
  return out;
}

// 4-5 2번: 출력 i 번째가 고를 원본 번호 = round(i·(N−1)/29), 0.5 는 올림, 정수 계산
export function sampleIndex(i, n) {
  if (n === 1) return 0;
  return Math.floor((2 * i * (n - 1) + (SEQ_LEN - 1)) / (2 * (SEQ_LEN - 1)));
}

// 앞뒤 자르기 + 30프레임으로 고르기. 입력은 frameFeatures 결과 배열
export function toSequence(featFrames) {
  let first = -1, last = -1;
  featFrames.forEach((f, i) => { if (f.present) { if (first < 0) first = i; last = i; } });
  if (first < 0) return null;
  const kept = featFrames.slice(first, last + 1);
  const n = kept.length;
  return Array.from({ length: SEQ_LEN }, (_, i) => kept[sampleIndex(i, n)].feat.slice());
}

// 4-5 0번: 손이 잡힌 프레임 비율(자르기 전 전체 기준)
export function handRatio(featFrames) {
  if (!featFrames.length) return 0;
  return featFrames.filter((f) => f.present).length / featFrames.length;
}

// 앱에서 부르는 한 번에 하기: 비율이 minRatio 미만이면 { error: "E-09" }, 아니면 { features: [30][90] }
export function prepareFeatures(frames, { flip, minRatio }) {
  const ff = frames.map((f) => {          // 한 프레임 = 손 모양 84 + 몸 기준 위치 6 = 90
    const r = frameFeatures(f, flip);
    return { feat: r.feat.concat(bodyFeatures(f, flip)), present: r.present };
  });
  if (handRatio(ff) < minRatio) return { error: "E-09" };
  const features = toSequence(ff);
  if (!features) return { error: "E-09" };
  return { features, windows: windowSequences(ff) };
}

// 녹화(3초)는 학습 구간(AI-Hub 단어 구간, 중앙 32프레임 ≈ 1.1초)보다 길어 앞뒤 쉬는 시간이 섞인다.
// 손이 잡힌 범위 안에서 33프레임 창을 8프레임씩 밀며 잘라 각각 30프레임으로 고른다. 맨 앞은 범위 전체.
// 모델은 창마다 순위를 내고 합친다(model.js rank). 범위가 40프레임 이하면 전체 하나만.
export const WIN_LEN = 33, WIN_STEP = 8;
export function windowSequences(featFrames) {
  let first = -1, last = -1;
  featFrames.forEach((f, i) => { if (f.present) { if (first < 0) first = i; last = i; } });
  if (first < 0) return [];
  const kept = featFrames.slice(first, last + 1);
  const out = [toSequence(kept)];
  if (kept.length > 40) {
    for (let s = 0; s + WIN_LEN <= kept.length; s += WIN_STEP) {
      const seq = toSequence(kept.slice(s, s + WIN_LEN));
      if (seq) out.push(seq);
    }
  }
  return out.slice(0, 12);   // model.js BATCH 와 같은 최대 개수
}
