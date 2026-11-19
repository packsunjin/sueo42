// [손 좌표] vendor/ 의 MediaPipe Hand Landmarker(0.10.14, float16/1)를 불러와 카메라 프레임마다 손 21점 좌표(0~1 비율)를 구한다. GPU 가 안 되면 CPU 로.
// (11/16) Pose Landmarker lite 로 코·양어깨도 구한다(몸 기준 위치, normalize.js bodyFeatures). 몸 모델이 실패해도 손은 그대로 쓴다.
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

// 시험에서 detect 를 가짜로 바꿔 끼울 수 있게 객체 하나로 내보낸다
export const handTracker = {
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
  get hasBody() { return !!poser; },   // 몸 모델이 없으면(불러오기 실패) 얼굴·어깨 안내를 숨긴다

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
