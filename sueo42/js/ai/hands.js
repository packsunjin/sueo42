// [손 좌표] vendor/ 의 MediaPipe Hand Landmarker(0.10.14, float16/1)를 불러와 카메라 프레임마다 손 21점 좌표(0~1 비율)를 구한다. GPU 가 안 되면 CPU 로.
// (11/16) Pose Landmarker lite 로 코·양어깨도 구한다(몸 기준 위치, normalize.js bodyFeatures). 몸 모델이 실패해도 손은 그대로 쓴다.
// (11/19) 일꾼(hand-worker.js)에서 돌리는 길을 먼저 쓴다(loadWorker·send). 일꾼을 못 띄우는 브라우저는 아래 load·detect(화면 스레드)로.
// (11/18) tune(): 카메라가 켜진 뒤 GPU 로 몇 프레임 재 보고 느리면(그래픽 칩이 약하거나 막힌 컴퓨터) CPU 로 바꿔 더 빠른 쪽을 쓴다.
import { CONFIG } from "../../config.js";

let loading = null;
let landmarker = null;
let poser = null;
let visionMod = null;
let delegateNow = null;   // "GPU" | "CPU"
let tuned = false;
const SLOW_MS = 120;      // 한 프레임 손 찾기가 이보다 오래 걸리면 느림(초당 8장 아래) → CPU 도 재 본다
const VIS_MIN = 0.5;   // 몸 점 visibility 가 이보다 낮으면 그 점은 없음

const abs = (p) => new URL(p, document.baseURI).href;

async function create(vision, delegate) {
  const fileset = await vision.FilesetResolver.forVisionTasks(abs(CONFIG.MEDIAPIPE_DIR + "/wasm"));
  return vision.HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: abs(CONFIG.HAND_MODEL_URL), delegate },
    runningMode: "VIDEO",
    numHands: 2,
  });
}

async function createPose(vision, delegate) {
  const fileset = await vision.FilesetResolver.forVisionTasks(abs(CONFIG.MEDIAPIPE_DIR + "/wasm"));
  return vision.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: abs(CONFIG.POSE_MODEL_URL), delegate },
    runningMode: "VIDEO",
    numPoses: 1,
  });
}

// ── 일꾼 길 ──
// (11/24) 일꾼 두 개(CPU 일 때): 두 손 찾기는 프레임마다 손 위치 찾기를 다시 해서 CPU 에서 한 장 약 65ms.
// 일꾼 둘이 프레임을 번갈아 맡으면(코어가 여럿이므로) 초당 처리 장수가 거의 두 배. GPU 일 때는 하나만(그래픽 칩을 나눠 쓰면 느려짐).
// 몸(코·어깨)은 첫 일꾼만 돌린다.
let workers = [];            // [{ w, busy }]
let workerLoading = null, workerHasBody = false, nextId = 1, workerTuned = false, tuneWaiter = null;
const pending = new Map();   // id → { onHands, onBody, body, slot }
const WORKER_TIMEOUT_MS = 30000;
let worker = null;           // 첫 일꾼(몸·속도 재기 담당)

function spawnWorker({ prefer = null, pose = true } = {}) {
  return new Promise((resolve, reject) => {
    let w;
    try { w = new Worker(abs("js/ai/hand-worker.js")); } catch (e) { reject(e); return; }
    const timer = setTimeout(() => { w.terminate(); reject(new Error("일꾼 시간 초과")); }, WORKER_TIMEOUT_MS);
    w.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "ready") { clearTimeout(timer); resolve({ w, ready: m }); }
      else if (m.type === "error") { clearTimeout(timer); w.terminate(); reject(new Error(m.message)); }
    };
    w.onerror = (e) => { clearTimeout(timer); w.terminate(); reject(new Error((e && e.message) || "일꾼 오류")); };
    w.postMessage({
      type: "init", bundle: abs(CONFIG.MEDIAPIPE_DIR + "/vision_bundle.mjs"), wasm: abs(CONFIG.MEDIAPIPE_DIR + "/wasm"),
      handModel: abs(CONFIG.HAND_MODEL_URL), poseModel: pose ? abs(CONFIG.POSE_MODEL_URL) : null, prefer,
    });
  });
}
function addSlot(w) {
  const slot = { w, busy: false };
  w.onmessage = (ev) => onWorkerMessage(ev, slot);
  workers.push(slot);
  return slot;
}

// 시험에서 detect 를 가짜로 바꿔 끼울 수 있게 객체 하나로 내보낸다
export const handTracker = {
  // 첫 일꾼을 띄우고 모델을 불러온다. 실패하면 오류를 던진다(→ 화면 스레드 길로 바꿔 씀)
  loadWorker() {
    if (worker) return Promise.resolve();
    if (!workerLoading) {
      workerLoading = spawnWorker({ prefer: savedDelegate() }).then(({ w, ready }) => {
        worker = w; delegateNow = ready.delegate; workerHasBody = ready.hasBody;
        addSlot(w);
      }).catch((e) => { workerLoading = null; throw e; });
    }
    return workerLoading;
  },
  // 쉬고 있는 일꾼 수(화면은 이게 0 보다 클 때만 새 프레임을 보낸다)
  get idleWorkers() { return workers.filter((x) => !x.busy).length; },
  get usingWorker() { return !!worker; },
  get workerCount() { return workers.length; },

  // 카메라가 켜진 뒤 한 번: 일꾼이 이 프레임으로 GPU·CPU 중 빠른 쪽을 고른다(처음 1~2초, 그동안 [동작 시작]은 잠김)
  tuneWorker(video) {   // 이미 재는 중이면 그 결과를 같이 기다림(미리 준비 중에 직접 해보기에 들어온 경우)
    if (!worker) return Promise.resolve(delegateNow);
    if (!workerTuned) workerTuned = tuneOnce(video);
    return workerTuned;
  },

  // 프레임 하나를 쉬고 있는 일꾼에 보낸다. onHands(hands) 가 먼저, body=true 이고 첫 일꾼이 받았으면 onBody(body) 가 뒤에.
  // 돌려주는 값: { sent, body } — 쉬는 일꾼이 없으면 sent=false, 몸을 못 맡겼으면 body=false(다음에 다시 청함)
  async send(source, ts, { body = false, onHands, onBody } = {}) {
    const first = workers[0] && !workers[0].busy ? workers[0] : null;
    const slot = (body && first) || workers.find((x) => !x.busy && x !== workers[0]) || first;
    if (!slot) return { sent: false, body: false };
    const withBody = body && slot === workers[0];
    slot.busy = true;
    let bitmap;
    try { bitmap = await createImageBitmap(source); } catch (e) { slot.busy = false; throw e; }
    const id = nextId++;
    pending.set(id, { onHands, onBody, body: withBody, slot });
    slot.w.postMessage({ type: "frame", id, bitmap, ts, body: withBody }, [bitmap]);
    return { sent: true, body: withBody };
  },

  // 한 번만 불러온다. 실패하면 오류를 던진다(→ E-07). 다시 부르면 다시 시도
  load() {
    if (landmarker) return Promise.resolve();
    if (!loading) {
      loading = (async () => {
        const vision = await import(abs(CONFIG.MEDIAPIPE_DIR + "/vision_bundle.mjs"));
        visionMod = vision;
        try { landmarker = await create(vision, "GPU"); delegateNow = "GPU"; }
        catch (e) {
          console.warn("MediaPipe GPU 실패, CPU 로 다시:", e && e.message);
          landmarker = await create(vision, "CPU"); delegateNow = "CPU";
        }
        try { poser = await createPose(vision, "CPU"); }   // 손 모델(GPU)과 부딪히지 않게 CPU. 기록하는 3초만 돈다
        catch (e) { console.warn("몸 모델 불러오기 실패(손만 씀):", e && e.message); poser = null; }
      })().catch((e) => { loading = null; throw e; });
    }
    return loading;
  },

  // 카메라가 켜진 뒤 한 번만: 지금 방식(GPU)으로 6프레임 재고, 느리면 CPU 로도 재서 빠른 쪽을 남긴다.
  // 결과는 이 페이지를 닫을 때까지 유지. 어떤 오류가 나도 지금 쓰던 방식을 그대로 둔다.
  async tune(video) {
    if (tuned || !landmarker || !visionMod) return delegateNow;
    tuned = true;
    const measure = async (lm) => {
      const ms = [];
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 40));
        const t0 = performance.now();
        try { lm.detectForVideo(video, t0); } catch (e) { return Infinity; }
        ms.push(performance.now() - t0);
      }
      ms.sort((a, b) => a - b);
      return ms[2];                       // 첫 프레임(준비 시간)을 덜 타는 가운데 값
    };
    try {
      const now = await measure(landmarker);
      if (delegateNow !== "GPU" || now <= SLOW_MS) return delegateNow;
      const cpu = await create(visionMod, "CPU");
      const cpuMs = await measure(cpu);
      if (cpuMs < now) {
        try { landmarker.close(); } catch { /* 무시 */ }
        landmarker = cpu; delegateNow = "CPU";
      } else { cpu.close(); }
      console.info(`손 찾기 속도: GPU ${Math.round(now)}ms, CPU ${Math.round(cpuMs)}ms → ${delegateNow}`);
    } catch (e) { console.warn("속도 재기 실패(지금 방식 유지):", e && e.message); }
    return delegateNow;
  },

  get delegate() { return delegateNow; },
  get hasBody() { return worker ? workerHasBody : !!poser; },   // 몸 모델이 없으면(불러오기 실패) 얼굴·어깨 안내를 숨긴다

  // 프레임 하나 → [{ label: "Left"|"Right", landmarks: [[x,y]…21] }] (z·점수는 버림)
  detect(video, timestampMs) {
    if (!landmarker) return [];
    const res = landmarker.detectForVideo(video, timestampMs);
    const labels = res.handedness || res.handednesses || [];
    return (res.landmarks || []).map((pts, i) => ({
      label: labels[i] && labels[i][0] ? labels[i][0].categoryName : "Right",
      landmarks: pts.map((p) => [p.x, p.y]),
    }));
  },

  // 프레임 하나 → { nose, rs, ls } (0~1 비율, rs = 사람의 오른어깨 = MediaPipe 12번, ls = 11번) 또는 null
  detectBody(video, timestampMs) {
    if (!poser) return null;
    let res;
    try { res = poser.detectForVideo(video, timestampMs); }
    catch (e) {   // MediaPipe 는 한 번 오류가 나면 그래프가 계속 실패한다 → 몸 모델을 끄고 손만 쓴다(모델은 몸 칸 0 도 학습함)
      console.warn("몸 모델 오류(손만 씀):", e && String(e.message).slice(0, 80));
      try { poser.close(); } catch { /* 무시 */ }
      poser = null;
      return null;
    }
    const p = res.landmarks && res.landmarks[0];
    if (!p) return null;
    const pt = (i) => (p[i] && (p[i].visibility ?? 1) >= VIS_MIN ? [p[i].x, p[i].y] : null);
    const rs = pt(12), ls = pt(11);
    if (!rs || !ls) return null;
    return { nose: pt(0), rs, ls };
  },
};

// 처음 한 번만: 이 기기에서 빠른 방식을 재고(기억해 두면 건너뜀), CPU 면 일꾼을 더 띄움
async function tuneOnce(video) {
  if (!savedDelegate()) {   // 이 기기에서 처음 한 번만 재고 기억한다(다음부터는 바로)
    const bitmap = await createImageBitmap(video);
    await new Promise((resolve) => {
      tuneWaiter = (m) => { console.info(m.message); delegateNow = m.delegate; resolve(); };
      worker.postMessage({ type: "tune", bitmap }, [bitmap]);
    });
    saveDelegate(delegateNow);
  }
  // CPU 면 코어 수에 맞춰 일꾼(몸 모델 없음)을 더 띄워 프레임을 번갈아 맡긴다(extraWorkers). 실패해도 있는 만큼 계속
  const want = extraWorkers();
  for (let i = workers.length; i < 1 + want; i++) {
    spawnWorker({ prefer: "CPU", pose: false }).then(({ w }) => addSlot(w))
      .catch((e) => console.warn("일꾼 더 띄우기 실패(있는 만큼 계속):", e && e.message));
  }
  return delegateNow;
}

function onWorkerMessage(ev, slot) {
  const m = ev.data;
  if (m.type === "tuned") { if (tuneWaiter) { tuneWaiter(m); tuneWaiter = null; } return; }
  const p = pending.get(m.id);
  if (!p) return;
  if (m.type === "hands") {
    slot.busy = false;                      // 손을 보내면 이 일꾼은 다음 프레임을 받을 수 있음(몸은 그 뒤 같은 일꾼 안에서 이어서)
    if (!p.body) pending.delete(m.id);
    if (p.onHands) p.onHands(m.hands);
  } else if (m.type === "body") {
    pending.delete(m.id);
    workerHasBody = m.hasBody;
    if (p.onBody) p.onBody(m.body);
  }
}

// 더 띄울 일꾼 수: CPU 일 때만. 코어 4~7개면 1개(모두 2개), 8개 이상이면 2개(모두 3개). 화면 스레드 몫으로 코어 하나는 남김
function extraWorkers() {
  if (delegateNow !== "CPU") return 0;
  const cores = navigator.hardwareConcurrency || 2;
  if (globalThis.__workersOverride) return globalThis.__workersOverride - 1;   // 시험용
  return cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
}

// 이 기기에서 빠른 방식(GPU/CPU) 기억(30일). 저장이 안 되는 브라우저면 매번 잼
const DELEGATE_KEY = "sueo42-delegate";
function savedDelegate() {
  try {
    const v = JSON.parse(localStorage.getItem(DELEGATE_KEY) || "null");
    if (v && (v.d === "GPU" || v.d === "CPU") && Date.now() - v.at < 30 * 864e5) return v.d;
  } catch { /* 무시 */ }
  return null;
}
function saveDelegate(d) {
  try { localStorage.setItem(DELEGATE_KEY, JSON.stringify({ d, at: Date.now() })); } catch { /* 무시 */ }
}
