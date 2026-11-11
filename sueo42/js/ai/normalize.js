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

// 앱에서 부르는 한 번에 하기: 비율이 minRatio 미만이면 { error: "E-09" }, 아니면 { features: [30][84] }
export function prepareFeatures(frames, { flip, minRatio }) {
  const ff = frames.map((f) => frameFeatures(f, flip));
  if (handRatio(ff) < minRatio) return { error: "E-09" };
  const features = toSequence(ff);
  if (!features) return { error: "E-09" };
  return { features };
}
