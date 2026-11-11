// [정규화 시험 파일 만들기] 직접 지어낸 손 좌표로 docs/tech/norm-testcases.json 을 만든다. AI-Hub 데이터는 한 숫자도 쓰지 않는다.
// 실행: node tests/make-norm-testcases.mjs   (기대 출력은 sueo42/js/ai/normalize.js 로 계산 — 손으로 검산한 값은 tests/normalize.test.mjs 에 따로 있음)
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const N = await import(pathToFileURL(path.join(ROOT, "sueo42/js/ai/normalize.js")).href);

// 지어낸 손 모양(픽셀, 손목 = (0,0), 위가 −y). 실제 사람 손을 잰 값이 아니다
const TEMPLATE = [
  [0, 0], [12, -8], [22, -18], [30, -28], [36, -36],     // 0 손목, 1~4 엄지
  [10, -40], [12, -58], [13, -70], [14, -80],            // 5~8 검지
  [0, -40], [0, -62], [0, -75], [0, -86],                // 9~12 중지 (9 = 손목에서 40)
  [-9, -38], [-11, -57], [-12, -68], [-13, -77],         // 13~16 약지
  [-17, -33], [-21, -47], [-23, -56], [-25, -63],        // 17~20 새끼
];

// 템플릿을 옮기고(cx,cy) 키우고(s) 기울여(rot 라디안) 비율 좌표로
function hand(label, cx, cy, s, rot, W, H, { mirror = false } = {}) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  const landmarks = TEMPLATE.map(([x, y]) => {
    const xx = (mirror ? -x : x) * s, yy = y * s;
    return [(cx + xx * c - yy * sn) / W, (cy + xx * sn + yy * c) / H];
  });
  return { label, landmarks };
}
const frame = (W, H, hands) => ({ width: W, height: H, hands });

// OpenPose 모양으로 옮기기: 앱과 같은 자리 나누기(4-3)를 거친 픽셀 좌표, 신뢰도 1. 없는 손은 63개 0
function toOpenPose(frames, flip) {
  const pack = (px) => (px ? px.flatMap(([x, y]) => [x, y, 1]) : new Array(63).fill(0));
  return frames.map((f) => {
    const { right, left } = N.assignHands(f, flip);
    return { hand_right_keypoints_2d: pack(right), hand_left_keypoints_2d: pack(left) };
  });
}

const cases = [];
function add(name, note, frames, flip = true, minRatio = 0.5) {
  const ff = frames.map((f) => N.frameFeatures(f, flip));
  const ratio = N.handRatio(ff);
  const app = N.prepareFeatures(frames, { flip, minRatio });
  cases.push({
    name, note,
    handedness_flip: flip,
    min_hand_ratio: minRatio,
    mediapipe_frames: frames,
    openpose_frames: toOpenPose(frames, flip),
    expected: {
      hand_ratio: ratio,
      app_result: app.error ? "E-09" : "ok",
      kept_frames: (() => { let a = -1, b = -1; ff.forEach((x, i) => { if (x.present) { if (a < 0) a = i; b = i; } }); return a < 0 ? null : [a, b]; })(),
      features: N.toSequence(ff),  // [30][84] 또는 손이 하나도 없으면 null
    },
  });
}

// 1. 한 프레임, 손 하나(MediaPipe "Left" = 실제 오른손) → 30줄 모두 같음, 뒤 42칸은 0
add("one_frame_one_hand", "N=1 이면 30줄 모두 0번 프레임. 'Left' 라벨은 flip=true 에서 실제 오른손(앞 42칸)",
  [frame(640, 480, [hand("Left", 320, 240, 1.25, 0, 640, 480)])]);

// 2. 45프레임: 앞 5·뒤 3 빈 프레임은 잘림, 가운데 빈 프레임 1개는 0 그대로(메우지 않음), 두 손이 움직임
{
  const W = 640, H = 480, frames = [];
  for (let i = 0; i < 45; i++) {
    if (i < 5 || i >= 42 || i === 20) { frames.push(frame(W, H, [])); continue; }
    const t = i / 44;
    frames.push(frame(W, H, [
      hand("Left", 220 + 60 * t, 300 - 40 * t, 1.1, 0.3 * t, W, H),
      hand("Right", 430 - 30 * t, 310, 1.0, -0.2, W, H, { mirror: true }),
    ]));
  }
  add("moving_two_hands_45", "앞 0~4·뒤 42~44 프레임 자름(남는 0~41 중 5~41, N=37), 20번 빈 프레임은 0 으로 남음", frames);
}

// 3. 두 손이 같은 라벨 → 손목 x 가 작은 손 = 실제 오른손
add("same_label_two_hands", "두 손 모두 'Right'. 손목 x 가 작은(화면 왼쪽, x=200) 손이 앞 42칸",
  [frame(640, 480, [
    hand("Right", 450, 260, 0.9, 0.1, 640, 480, { mirror: true }),
    hand("Right", 200, 250, 1.2, -0.1, 640, 480),
  ])]);

// 4. 크기 0 인 손(점 21개가 한 자리) → 그 손 없음. 그 프레임만 있으면 손 없는 프레임
{
  const flat = { label: "Left", landmarks: Array.from({ length: 21 }, () => [0.5, 0.5]) };
  const good = hand("Left", 300, 240, 1, 0, 640, 480);
  add("degenerate_hand", "0·1번 프레임은 크기 0 손뿐이라 '손 없음' → 잘림. 2·3번만 남음(N=2)",
    [frame(640, 480, [flat]), frame(640, 480, [flat]), frame(640, 480, [good]), frame(640, 480, [hand("Left", 310, 235, 1, 0.05, 640, 480)])]);
}

// 5. 손 잡힌 비율 0.4 < 0.5 → 앱은 E-09(학습 쪽은 이 단계 없음)
{
  const fr = [];
  for (let i = 0; i < 10; i++) fr.push(i % 5 < 2 ? frame(640, 480, [hand("Left", 300 + i, 240, 1, 0, 640, 480)]) : frame(640, 480, []));
  add("low_hand_ratio", "10프레임 중 4프레임만 손 → 비율 0.4. 앱은 E-09 로 멈춤(features 는 학습 쪽 비교용으로 계산해 둠)", fr);
}

// 6. 해상도가 달라도 픽셀 모양이 같으면 결과가 같다(가로세로 비율 보정)
add("hd_1280x720", "1번과 같은 픽셀 손을 1280×720 에서. 픽셀로 바꾼 뒤 나누므로 features 가 1번과 같아야 함",
  [frame(1280, 720, [hand("Left", 640, 360, 1.25, 0, 1280, 720)])]);

// 7. flip=false 일 때: 'Right' 라벨 = 실제 오른손
add("flip_false", "HANDEDNESS_FLIP=false 이면 라벨을 그대로 읽음: 'Right' → 앞 42칸",
  [frame(640, 480, [hand("Right", 320, 240, 1.25, 0, 640, 480)])], false);

// 원본 번호 고르기 표(4-5 2번)
const sample_index = [1, 2, 3, 10, 29, 30, 31, 37, 45, 59, 60, 61, 100].map((n) => ({
  n, idx: Array.from({ length: 30 }, (_, i) => N.sampleIndex(i, n)),
}));

const out = {
  about: "수어42 손 좌표 정규화 시험 입력·기대 출력(docs/tech/structure.md 4절). 좌표는 전부 지어낸 숫자이며 AI-Hub 데이터는 쓰지 않았다. JS(sueo42/js/ai/normalize.js)와 Python 학습 코드가 모두 통과해야 한다.",
  made_by: "tests/make-norm-testcases.mjs",
  tolerance: 1e-6,
  rules: {
    pixels: "x·W, y·H (W·H = 프레임 width·height). z 없음",
    hand: "size = |p9 − p0| (픽셀). size < 1e-6 이면 그 손 없음. 42 = ((px_k − px_0)/size, (py_k − py_0)/size) k=0..20, x,y 번갈아",
    slots: "84 = [실제 오른손 42, 실제 왼손 42]. MediaPipe: flip=true 면 'Left'=실제 오른손. 두 손 같은 라벨이면 손목 x 작은 손=실제 오른손. OpenPose: hand_right → 앞, hand_left → 뒤",
    missing: "없는 손 42칸은 0. 앞뒤 프레임으로 메우지 않음",
    present: "프레임에 크기 1e-6 이상인 손이 하나라도 있으면 '손 있음'. 비율(앱만)·앞뒤 자르기 모두 이 기준",
    ratio_app_only: "손 있는 프레임 / 기록한 전체 프레임 < min_hand_ratio 이면 앱은 E-09 (학습 쪽은 이 단계 없음)",
    trim: "손 있는 첫 프레임 ~ 마지막 프레임만 남김(N 개)",
    sample: "N==1 이면 0, 아니면 floor((2·i·(N−1) + 29) / 58), i = 0..29",
    openpose_missing: "OpenPose 쪽 '없는 손'은 63개 0 으로 적었다(0·9번 신뢰도 0). 크기 0 손은 신뢰도 1 로 적어 size 기준으로 없음 처리됨",
  },
  sample_index,
  cases,
};
const dest = path.join(ROOT, "docs/tech/norm-testcases.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + "\n");
console.log("wrote", dest, cases.length, "cases");
