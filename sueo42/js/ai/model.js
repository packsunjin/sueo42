// [AI 순위] 정규화한 손 좌표 [30][90] → 비슷해 보이는 단어 이름 순위(①②)만 돌려준다. 확률 숫자는 정렬에만 쓰고 바로 버린다(화면·기록·콘솔에 남기지 않음).
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

const BATCH = 12;   // 창 최대 개수(3초 녹화 ≈ 90프레임 → 창 9개). normalize.js windowSequences 와 맞춤
const ZERO_SEQ = Array.from({ length: 30 }, () => new Array(90).fill(0));

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
      const inShape = model.inputs[0].shape;          // [null, 30, 90]
      const outUnits = model.outputs[0].shape[1];
      if (!(inShape.length === 3 && inShape[1] === 30 && inShape[2] === 90)) throw new Error("입력 모양이 [null,30,90] 가 아님");
      if (!Array.isArray(labels) || labels.length !== outUnits) throw new Error("labels 개수 ≠ 출력 개수");
      // 미리 한 번 돌려 둔다: 브라우저(WebGL)는 처음 보는 입력 크기마다 계산 준비에 1~2초 걸린다(11/16 실측 1.7초)
      tf.tidy(() => { model.predict(tf.zeros([BATCH, 30, 90])); });
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

// features: [30][90] 또는 창 여러 개 [n][30][90], words: 단어 목록. 돌려주는 값: { names: [①, ②], trial } 또는 { error }
export function rank(features, words) {
  return rankBest([features], words);
}

// (11/19) 후보 여러 개(그대로·좌우 뒤집음)를 각각 모델에 넣고, 1위 값이 더 큰 후보의 순위를 쓴다(값은 고르는 데만 쓰고 버림)
export async function rankBest(candidates, words) {
  const size = CONFIG.LAB_RANK_SIZE;
  if (!CONFIG.MODEL_URL) {
    return { names: sample(words, size).map((w) => w.name), trial: true };
  }
  let m;
  try { m = await loadModel(); }
  catch (e) { console.warn("AI 모델 불러오기 실패:", e && e.message); return { error: "E-08" }; }
  try {
    const { tf, model, labels } = m;
    let best = null, bestTop = -Infinity;
    for (const features of candidates) {
      const sc = tf.tidy(() => {
        // features 가 창 여러 개([n][30][90])면 창마다 낸 값을 더함
        // 입력 크기를 늘 BATCH(12)로 고정해야 크기가 바뀔 때마다 1~2초씩 멈추지 않는다 → 모자라면 0 으로 채우고 앞 n 개만 더함
        const seqs = (Array.isArray(features[0]?.[0]) ? features : [features]).slice(0, BATCH);
        const pad = Array.from({ length: BATCH - seqs.length }, () => ZERO_SEQ);
        const out = model.predict(tf.tensor3d(seqs.concat(pad), [BATCH, 30, 90], "float32")).slice([0, 0], [seqs.length, -1]).mean(0);
        return Array.from(out.dataSync());
      });
      const top = Math.max(...sc);
      if (top > bestTop) { bestTop = top; best = sc; }
    }
    const order = best.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);   // 번호만 남김
    const known = new Set(words.map((w) => w.name));
    const names = order.map((i) => labels[i]).filter((n) => known.has(n)).slice(0, size);
    if (names.length < size) throw new Error("words.csv 에 있는 이름이 모자람");
    return { names, trial: false };
  } catch (e) {
    console.warn("순위 계산 실패:", e && e.message);
    return { error: "E-10" };
  }
}
