// [손 좌표] vendor/ 의 MediaPipe Hand Landmarker(0.10.14, float16/1)를 불러와 카메라 프레임마다 손 21점 좌표(0~1 비율)를 구한다. GPU 가 안 되면 CPU 로.
import { CONFIG } from "../../config.js";

let loading = null;
let landmarker = null;

const abs = (p) => new URL(p, document.baseURI).href;

async function create(vision, delegate) {
  const fileset = await vision.FilesetResolver.forVisionTasks(abs(CONFIG.MEDIAPIPE_DIR + "/wasm"));
  return vision.HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: abs(CONFIG.HAND_MODEL_URL), delegate },
    runningMode: "VIDEO",
    numHands: 2,
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
};
