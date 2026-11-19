// [손 찾기 일꾼] (11/19, 사장: "트래킹 바로바로 되게") MediaPipe 손·몸 모델을 화면과 다른 스레드(Web Worker)에서 돌린다.
// 화면 쪽(hands.js)은 카메라 프레임을 ImageBitmap 으로 보내고, 여기는 손 21점·코·양어깨만 돌려준다. 영상은 저장하지 않는다.
// 클래식 워커: MediaPipe 는 wasm 로더를 importScripts 로 부르는데, 모듈 워커에는 importScripts 가 없어서.
// 메시지
//   받음 { type: "init", bundle, wasm, handModel, poseModel }       → 보냄 { type: "ready", delegate, hasBody } | { type: "error", message }
//   받음 { type: "tune", bitmap }                                   → 보냄 { type: "tuned", delegate, message }
//   받음 { type: "frame", id, bitmap, ts, body }                    → 보냄 { type: "hands", id, hands, ms } (+ body 면 { type: "body", id, body })
"use strict";

let vision = null, fileset = null, landmarker = null, poser = null, delegate = null, cfg = null;
const SLOW_MS = 120;      // hands.js 와 같음: GPU 가 이보다 느리면 CPU 도 재 본다
const VIS_MIN = 0.5;

async function makeHands(dg) {
  return vision.HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: cfg.handModel, delegate: dg }, runningMode: "VIDEO", numHands: 2,
  });
}

async function init(msg) {
  cfg = msg;
  vision = await import(msg.bundle);
  fileset = await vision.FilesetResolver.forVisionTasks(msg.wasm);
  try { landmarker = await makeHands("GPU"); delegate = "GPU"; }
  catch (e) { landmarker = await makeHands("CPU"); delegate = "CPU"; }
  try {
    poser = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: msg.poseModel, delegate: "CPU" }, runningMode: "VIDEO", numPoses: 1,
    });
  } catch (e) { poser = null; }
  postMessage({ type: "ready", delegate, hasBody: !!poser });
}

// 카메라가 켜진 뒤 한 번(hands.js tuneWorker): 같은 프레임으로 GPU 를 재고, 느리면 CPU 도 재서 빠른 쪽을 남긴다(hands.js tune 과 같은 기준)
async function tune(bitmap) {
  const measure = (lm) => {
    const ms = [];
    for (let i = 0; i < 6; i++) {
      lastTs += 34;
      const t0 = performance.now();
      try { lm.detectForVideo(bitmap, lastTs); } catch (e) { return Infinity; }
      ms.push(performance.now() - t0);
    }
    ms.sort((a, b) => a - b);
    return ms[2];
  };
  let msg = "";
  try {
    const now = measure(landmarker);
    msg = `${delegate} ${Math.round(now)}ms`;
    if (delegate === "GPU" && now > SLOW_MS) {
      const cpu = await makeHands("CPU");
      const cpuMs = measure(cpu);
      msg += `, CPU ${Math.round(cpuMs)}ms`;
      if (cpuMs < now) { try { landmarker.close(); } catch (e) { /* 무시 */ } landmarker = cpu; delegate = "CPU"; }
      else cpu.close();
    }
  } catch (e) { msg += " (재기 실패: " + String((e && e.message) || e).slice(0, 120) + ")"; }
  bitmap.close();
  postMessage({ type: "tuned", delegate, message: `손 찾기 속도(일꾼): ${msg} → ${delegate}` });
}

let lastTs = 0;
function frame(msg) {
  const { id, bitmap } = msg;
  const ts = Math.max(msg.ts, lastTs + 1);   // MediaPipe 는 시각이 늘 커져야 한다
  lastTs = ts;
  let hands = [], ms = 0;
  try {
    const t0 = performance.now();
    const res = landmarker.detectForVideo(bitmap, ts);
    ms = performance.now() - t0;
    const labels = res.handedness || res.handednesses || [];
    hands = (res.landmarks || []).map((pts, i) => ({
      label: labels[i] && labels[i][0] ? labels[i][0].categoryName : "Right",
      landmarks: pts.map((p) => [p.x, p.y]),
    }));
  } catch (e) { hands = []; }
  postMessage({ type: "hands", id, hands, ms });   // 손을 먼저 보낸다(화면이 기다리지 않게)
  if (msg.body) {
    let body = null;
    if (poser) {
      try {
        const res = poser.detectForVideo(bitmap, ts);
        const p = res.landmarks && res.landmarks[0];
        if (p) {
          const pt = (i) => (p[i] && (p[i].visibility ?? 1) >= VIS_MIN ? [p[i].x, p[i].y] : null);
          const rs = pt(12), ls = pt(11);
          if (rs && ls) body = { nose: pt(0), rs, ls };
        }
      } catch (e) { try { poser.close(); } catch (e2) { /* 무시 */ } poser = null; }
    }
    postMessage({ type: "body", id, body, hasBody: !!poser });
  }
  bitmap.close();
}

let queue = Promise.resolve();
onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === "init") {
    init(msg).catch((e) => postMessage({ type: "error", message: String((e && e.message) || e).slice(0, 200) }));
  } else if (msg.type === "tune") {
    queue = queue.then(() => tune(msg.bitmap)).catch(() => {});
  } else if (msg.type === "frame") {
    queue = queue.then(() => frame(msg)).catch(() => {});
  }
};
