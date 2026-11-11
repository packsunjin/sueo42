// [AI 순위] 정규화한 손 좌표 [30][84] → 비슷해 보이는 단어 이름 순위(①②)만 돌려준다. 확률 숫자는 정렬에만 쓰고 바로 버린다(화면·기록·콘솔에 남기지 않음).
//   MODEL_URL 비었음 → 42개 중 무작위 2개 + trial:true ("시험용")
//   모델 불러오기 실패 → { error: "E-08" } (무작위로 대신하지 않음)
//   순위 계산 중 다른 오류 → { error: "E-10" }
import { CONFIG } from "../../config.js";
import { sample } from "../util.js";

let loaded = null;   // { tf, model, labels }
let loading = null;
let loadedFor = "";  // 어느 MODEL_URL 로 불러온 것인지(주소가 바뀌면 다시 불러옴)

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error("스크립트를 못 불러옴: " + src));
    document.head.append(s);
  });
}

async function loadModel() {
  if (loadedFor !== CONFIG.MODEL_URL) { loaded = null; loading = null; loadedFor = CONFIG.MODEL_URL; }
  if (loaded) return loaded;
  if (!loading) {
    loading = (async () => {
      if (!globalThis.tf) await loadScript(new URL(CONFIG.TFJS_URL, document.baseURI).href);
      const tf = globalThis.tf;
      const model = await tf.loadLayersModel(CONFIG.MODEL_URL);
      const res = await fetch(CONFIG.MODEL_LABELS_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error("labels.json " + res.status);
      const labels = await res.json();
      const inShape = model.inputs[0].shape;          // [null, 30, 84]
      const outUnits = model.outputs[0].shape[1];
      if (!(inShape.length === 3 && inShape[1] === 30 && inShape[2] === 84)) throw new Error("입력 모양이 [null,30,84] 가 아님");
      if (!Array.isArray(labels) || labels.length !== outUnits) throw new Error("labels 개수 ≠ 출력 개수");
      loaded = { tf, model, labels };
      return loaded;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

// 미리 불러 두기(직접 해보기에 들어갈 때). 실패해도 여기서는 조용히 — rank 에서 E-08 로 알린다
export function preload() {
  if (!CONFIG.MODEL_URL) return;
  loadModel().catch(() => {});
}

// features: [30][84], words: 단어 목록. 돌려주는 값: { names: [①, ②], trial } 또는 { error }
export async function rank(features, words) {
  const size = CONFIG.LAB_RANK_SIZE;
  if (!CONFIG.MODEL_URL) {
    return { names: sample(words, size).map((w) => w.name), trial: true };
  }
  let m;
  try { m = await loadModel(); }
  catch (e) { console.warn("AI 모델 불러오기 실패:", e && e.message); return { error: "E-08" }; }
  try {
    const { tf, model, labels } = m;
    const order = tf.tidy(() => {
      const out = model.predict(tf.tensor3d([features], [1, 30, 84], "float32"));
      return Array.from(tf.topk(out.reshape([-1]), labels.length).indices.dataSync()); // 번호만 꺼냄
    });
    const known = new Set(words.map((w) => w.name));
    const names = order.map((i) => labels[i]).filter((n) => known.has(n)).slice(0, size);
    if (names.length < size) throw new Error("words.csv 에 있는 이름이 모자람");
    return { names, trial: false };
  } catch (e) {
    console.warn("순위 계산 실패:", e && e.message);
    return { error: "E-10" };
  }
}
