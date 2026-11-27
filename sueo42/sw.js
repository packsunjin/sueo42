// [오프라인 저장] (11/24, 사장: 대회장 인터넷이 끊겨도 돌아가게) 서비스 워커. 한 번 인터넷으로 열어 두면 앱·AI 가 인터넷 없이도 돌아간다.
// - 앱 파일(화면·CSS·단어 목록 등): 인터넷 먼저(4초 안에 안 오면 저장본). 고친 내용은 인터넷이 될 때 바로 반영
// - vendor/(AI 라이브러리·글꼴, 폴더 이름에 버전이 있어 안 바뀜): 저장본 먼저, 없으면 받아서 저장
// - model/(단어 순위 모델): 다시 학습하면 같은 이름으로 바뀌므로 앱 파일처럼 인터넷 먼저
// - 사전 그림(국립국어원 썸네일): 저장본 먼저. 사전 영상(mp4)은 부분 요청(Range)이라 저장하지 않음 → 인터넷이 없으면 사전 영상은 안 나옴
// - 이 기기 안에만 저장. 다른 곳으로 보내는 것 없음. 카메라 영상은 여기를 지나지 않음
const VERSION = "sueo42-2026-11-27b";
const APP = `${VERSION}-app`, ASSET = `${VERSION}-asset`, THUMB = `${VERSION}-thumb`;
const NET_TIMEOUT_MS = 4000;

// 설치할 때: index.html 이 미리 받는 파일(모듈·CSS·글꼴·로고) 전부 + 단어 목록. 첫 방문에 이미 받은 파일도 오프라인에서 쓰이게
const BASE = ["./", "index.html", "data/words.csv", "img/bubbles.svg", "model/model.json", "model/group1-shard1of1.bin", "model/labels.json"];
// 직접 해보기 AI(config.js 의 주소와 같아야 함). 첫 방문에는 이 파일들을 받기 시작할 때 아직 서비스 워커가 화면을 맡지 않아서
// 저장이 안 될 수 있으므로 설치할 때 직접 받아 둔다(앱이 미리 준비하며 받는 파일이라 브라우저 캐시에서 와서 두 번 받지 않음). 데이터 절약이면 건너뜀
const AI = [
  "vendor/tfjs@4.22.0/tf.min.js",
  "vendor/mediapipe/tasks-vision@0.10.14/vision_bundle.mjs",
  "vendor/mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.js",
  "vendor/mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.wasm",
  "vendor/mediapipe/hand_landmarker/float16-1/hand_landmarker.task",
  "vendor/mediapipe/pose_landmarker/lite-float16-1/pose_landmarker_lite.task",
];
self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const app = await caches.open(APP);
    let list = BASE.slice();
    try {
      const html = await (await fetch("index.html", { cache: "no-cache" })).text();
      for (const m of html.matchAll(/<(?:link|script)\b[^>]*?(?:href|src)="([^"]+)"/g)) if (!/^https?:/.test(m[1])) list.push(m[1]);
    } catch (e) { /* 목록을 못 읽으면 기본만 */ }
    list = [...new Set(list)];
    const saveData = self.navigator && self.navigator.connection && self.navigator.connection.saveData;
    if (!saveData) list.push(...AI);
    list = [...new Set(list)];
    const assets = list.filter((u) => u.includes("vendor/"));
    await Promise.all([
      Promise.all(list.filter((u) => !assets.includes(u)).map((u) => app.add(u).catch(() => {}))),
      caches.open(ASSET).then((c) => Promise.all(assets.map((u) => c.add(u).catch(() => {})))),
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isThumb = (url) => url.hostname === "sldict.korean.go.kr" && /_215X161\.jpg$/.test(url.pathname);

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET" || req.headers.has("range")) return;     // 영상 부분 요청은 건드리지 않음
  const url = new URL(req.url);
  if (isThumb(url)) { ev.respondWith(cacheFirst(req, THUMB)); return; }
  if (url.origin !== self.location.origin) return;                   // 다른 사이트는 그대로
  if (/\.(mp4|webm)$/.test(url.pathname)) return;
  const path = url.pathname;
  if (path.includes("/vendor/")) ev.respondWith(cacheFirst(req, ASSET));   // model/ 은 다시 학습하면 같은 이름으로 바뀌므로 인터넷 먼저(아래)
  else ev.respondWith(networkFirst(req, APP));
});

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone()).catch(() => {});
  return res;
}

// 인터넷 먼저: 4초 안에 오면 그것(저장도 새로), 늦으면 저장본, 저장본도 없으면 인터넷을 끝까지 기다림
async function networkFirst(req, name) {
  const cache = await caches.open(name);
  const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()).catch(() => {}); return res; });
  const first = await Promise.race([net.catch(() => null), new Promise((r) => setTimeout(r, NET_TIMEOUT_MS, "late"))]);
  if (first && first !== "late") return first;
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await net.catch(() => null);
  if (res) return res;
  if (req.mode === "navigate") { const home = await cache.match("index.html"); if (home) return home; }
  return Response.error();
}
