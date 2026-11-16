// [손 좌표] vendor/ 의 MediaPipe Hand Landmarker(0.10.14, float16/1)를 불러와 카메라 프레임마다 손 21점 좌표(0~1 비율)를 구한다. GPU 가 안 되면 CPU 로.
// (11/16) Pose Landmarker lite 로 코·양어깨도 구한다(몸 기준 위치, normalize.js bodyFeatures). 몸 모델이 실패해도 손은 그대로 쓴다.
import { CONFIG } from "../../config.js";

let loading = null;
let landmarker = null;
let poser = null;
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
        try { landmarker = await create(vision, "GPU"); }
        catch (e) {
          console.warn("MediaPipe GPU 실패, CPU 로 다시:", e && e.message);
          landmarker = await create(vision, "CPU");
        }
        try { poser = await createPose(vision, "CPU"); }   // 손 모델(GPU)과 부딪히지 않게 CPU. 기록하는 3초만 돈다
        catch (e) { console.warn("몸 모델 불러오기 실패(손만 씀):", e && e.message); poser = null; }
      })().catch((e) => { loading = null; throw e; });
    }
    return loading;
  },

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
