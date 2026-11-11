// [정규화 시험] sueo42/js/ai/normalize.js 가 docs/tech/norm-testcases.json 을 통과하는지, 손으로 검산한 값과 같은지 본다.
// 실행: node --experimental-default-type=module tests/normalize.test.mjs   (Node 20)
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const N = await import(pathToFileURL(path.join(ROOT, "sueo42/js/ai/normalize.js")).href);
const TC = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/tech/norm-testcases.json"), "utf8"));
const TOL = TC.tolerance;
let checks = 0;

const near = (a, b, where) => { assert.ok(Math.abs(a - b) <= TOL, `${where}: ${a} ≠ ${b}`); checks++; };
const sameSeq = (got, exp, where) => {
  if (exp === null) { assert.equal(got, null, where); return; }
  assert.equal(got.length, 30, where);
  got.forEach((row, i) => { assert.equal(row.length, 84, `${where} 줄 ${i}`); row.forEach((v, j) => near(v, exp[i][j], `${where} [${i}][${j}]`)); });
};

// 1) 원본 번호 고르기 표
for (const { n, idx } of TC.sample_index) {
  assert.deepEqual(Array.from({ length: 30 }, (_, i) => N.sampleIndex(i, n)), idx, `sampleIndex N=${n}`); checks++;
}
// 손으로: N=30 이면 그대로, N=2 이면 앞 15개 0·뒤 15개 1(i·1/29 ≥ 0.5 ⇔ i ≥ 15), N=60 i=29 → 59
assert.deepEqual(TC.sample_index.find((s) => s.n === 30).idx, [...Array(30).keys()]);
assert.deepEqual(TC.sample_index.find((s) => s.n === 2).idx, [...Array(15).fill(0), ...Array(15).fill(1)]);
assert.equal(N.sampleIndex(29, 60), 59); assert.equal(N.sampleIndex(0, 60), 0);

// 2) 사례마다 앱 경로(MediaPipe 프레임)
for (const c of TC.cases) {
  const ff = c.mediapipe_frames.map((f) => N.frameFeatures(f, c.handedness_flip));
  near(N.handRatio(ff), c.expected.hand_ratio, `${c.name} 비율`);
  const app = N.prepareFeatures(c.mediapipe_frames, { flip: c.handedness_flip, minRatio: c.min_hand_ratio });
  assert.equal(app.error ? "E-09" : "ok", c.expected.app_result, `${c.name} 앱 결과`);
  sameSeq(N.toSequence(ff), c.expected.features, c.name);
}

// 3) OpenPose 모양으로 적은 같은 숫자도 같은 결과(학습 쪽 흉내: 오른손→앞, 왼손→뒤, 0·9 신뢰도 0 이면 없음)
function openposeSequence(frames) {
  const handOf = (arr) => {
    const pts = Array.from({ length: 21 }, (_, k) => [arr[3 * k], arr[3 * k + 1], arr[3 * k + 2]]);
    if (pts[0][2] === 0 || pts[9][2] === 0) return null;
    return N.normalizeHand(pts.map(([x, y]) => [x, y]));
  };
  const ff = frames.map((f) => {
    const r = handOf(f.hand_right_keypoints_2d), l = handOf(f.hand_left_keypoints_2d);
    const feat = new Array(84).fill(0);
    if (r) r.forEach((v, i) => (feat[i] = v));
    if (l) l.forEach((v, i) => (feat[42 + i] = v));
    return { feat, present: !!(r || l) };
  });
  return N.toSequence(ff);
}
for (const c of TC.cases) sameSeq(openposeSequence(c.openpose_frames), c.expected.features, `${c.name} (OpenPose)`);

// 4) 손으로 검산한 값
const one = TC.cases.find((c) => c.name === "one_frame_one_hand").expected.features;
// 템플릿 × 1.25: 9번 = (0, −50) → size 50. 1번 = (15, −10) → (0.3, −0.2). 4번 = (45, −45) → (0.9, −0.9)
near(one[0][0], 0, "손목 x"); near(one[0][1], 0, "손목 y");
near(one[0][2], 0.3, "1번 x"); near(one[0][3], -0.2, "1번 y");
near(one[0][8], 0.9, "4번 x"); near(one[0][9], -0.9, "4번 y");
near(one[0][18], 0, "9번 x"); near(one[0][19], -1, "9번 y");
assert.ok(one.every((row) => row.slice(42).every((v) => v === 0)), "왼손 자리 0");
assert.ok(one.every((row) => row.every((v, j) => v === one[0][j])), "30줄 같음");
// 해상도가 달라도 같다
sameSeq(TC.cases.find((c) => c.name === "hd_1280x720").expected.features, one, "1280×720 = 640×480");
// flip=false 의 'Right' 도 같은 자리
sameSeq(TC.cases.find((c) => c.name === "flip_false").expected.features, one, "flip=false");
// 같은 라벨: 손목 x=200 인 손(크기 1.2 → size 48)이 앞칸 → 1번 x = 12·1.2·cos(−0.1) … 회전이 있으니 크기만 확인: 9번까지 거리 1
const same = TC.cases.find((c) => c.name === "same_label_two_hands").expected.features[0];
near(Math.hypot(same[18], same[19]), 1, "앞칸 9번 거리"); near(Math.hypot(same[60], same[61]), 1, "뒷칸 9번 거리");
const sameRaw = TC.cases.find((c) => c.name === "same_label_two_hands").mediapipe_frames[0].hands;
const rightPx = N.toPixels(sameRaw[1].landmarks, 640, 480);
near(same[2], (rightPx[1][0] - rightPx[0][0]) / Math.hypot(rightPx[9][0] - rightPx[0][0], rightPx[9][1] - rightPx[0][1]), "같은 라벨: x 작은 손이 앞칸");
// 가운데 빈 프레임(20번)은 0 줄로 남는다: 남은 프레임 5~41(N=37) 중 원본 20 = 남은 번호 15 → i 가 고르는 곳 있으면 0 줄
const mv = TC.cases.find((c) => c.name === "moving_two_hands_45");
assert.deepEqual(mv.expected.kept_frames, [5, 41]);
const zeroRows = mv.expected.features.filter((row) => row.every((v) => v === 0)).length;
const picks = Array.from({ length: 30 }, (_, i) => N.sampleIndex(i, 37)).filter((k) => k === 15).length;
assert.equal(zeroRows, picks, "빈 프레임을 메우지 않음");
// 크기 0 손
assert.deepEqual(TC.cases.find((c) => c.name === "degenerate_hand").expected.kept_frames, [2, 3]);
assert.equal(TC.cases.find((c) => c.name === "low_hand_ratio").expected.app_result, "E-09");

// 5) AI-Hub 흔적 없음(파일에 영상·라벨 이름 같은 것이 없는지)
const raw = fs.readFileSync(path.join(ROOT, "docs/tech/norm-testcases.json"), "utf8");
assert.ok(!/REAL\d\d|real_word|real_sen|aihub\.or\.kr\/.*\.zip/i.test(raw), "AI-Hub 파일 이름 흔적");

console.log(`정규화 시험 통과: 사례 ${TC.cases.length}개, 비교 ${checks}번`);
