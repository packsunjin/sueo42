// [직접 해보기 S10~S15] 카메라 안내(처음 한 번) → 연습(사전 영상 + 내 카메라, 3·2·1 뒤 손 좌표 기록) → 분석 중 → 결과(AI 추정 순위 ①② + 사전 영상 ⇄ 내 손 좌표 나란히, 사용자가 고름) → 42개 목록 고르기 → 기록됨.
// 점수·확률·%·맞음/틀림은 쓰지 않는다. 카메라는 [다음 단어]로 이어 가는 동안 끄지 않고, 직접 해보기 밖으로 나가면 끈다.
import { h } from "../util.js";
import { t, btn } from "../copy.js";
import { CONFIG, isTrialModel } from "../../config.js";
import { header, button, dictVideo, errorBox, spinner, trialTag, levelBar, openModal, confirmModal, go, icon } from "../ui.js";
import { setLeaveGuard } from "../router.js";
import { allWords, wordByNo, wordsOfStage, stageNumbers, matchWord, isLowData } from "../data/words.js";
import { getState, recordLabChoice, recordLabRetry, setCameraIntroSeen } from "../store.js";
import { levelInfo } from "../game/progress.js";
import { makeFloating } from "../pip.js";
import { startCamera, stopCamera, getStream, isOn as cameraOn } from "../ai/camera.js";
import { handTracker } from "../ai/hands.js";
import { drawHands, drawBody, replay } from "../ai/draw.js";
import { prepareFeatures, mirrorFrame, mirrorPlan } from "../ai/normalize.js";
import { rankBest, preload } from "../ai/model.js";

// ── 화면이 바뀌어도 남는 것: 카메라 <video> 하나, 카메라 끄기 예약 ──
const camVideo = h("video", { class: "cam-video", muted: true, autoplay: true, playsInline: true });
camVideo.setAttribute("playsinline", "");
let stopTimer = null;
let ctx = null;            // 지금 연습 중인 화면의 상태
const MIN_FRAME_MS = 33;   // structure.md 4-5: 약 33 ms 간격 이상일 때만 기록(30 fps 가깝게)

// (11/25) 가로 막기는 휴대폰만(높이 500 이하). 태블릿은 가로로 세워 두고 써도 됨
const landscape = () => matchMedia("(orientation: landscape) and (pointer: coarse) and (max-height: 500px)").matches;
const setTabbar = (hidden) => { const tb = document.getElementById("tabbar"); if (tb) tb.hidden = hidden; };
const wordByName = (name) => allWords().find((w) => w.name === name);

// 같은 단계에서 번호가 다음인 단어(마지막 다음은 첫 단어)
export function nextWordOf(word, words = allWords()) {
  const ws = words.filter((w) => w.stage === word.stage).sort((a, b) => a.no - b.no);
  const i = ws.findIndex((w) => w.no === word.no);
  return ws[(i + 1) % ws.length];
}

document.addEventListener("visibilitychange", () => {
  if (!ctx) return;
  if (document.hidden) {
    if (ctx.mode === "countdown" || ctx.mode === "recording") { dropClip(ctx); showPractice(); } // 기록을 버리고 처음으로
    stopCamera();
  } else if (ctx.mode === "practice") {
    initCamera();
  }
});

// ── 내 동작 다시 보기(11/16): 기록하는 동안 카메라 영상을 이 기기 메모리(Blob)에만 녹화한다.
// 서버로 보내거나 기록(localStorage)에 넣지 않는다. 다시 해보기·화면 나가기·탭 숨김 때 바로 버린다(revokeObjectURL).
const CLIP_TYPES = ["video/webm;codecs=vp8", "video/webm", "video/mp4"];   // vp9 는 인코딩이 무거워 녹화 중 렉 → vp8 먼저
function startClip(c) {
  dropClip(c);
  if (c.file) { c.clipUrl = URL.createObjectURL(c.file); c.clipDone = Promise.resolve(); return; }   // 파일로 할 때 '내 동작' = 그 파일
  const stream = getStream();
  if (!stream || typeof MediaRecorder === "undefined") return;
  const type = CLIP_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
  try {
    const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 800_000 });
    const parts = [];
    const token = {};          // 녹화마다 표시 — 버린 앞 녹화가 늦게 끝나도 새 시도에 섞이지 않게
    c.clipToken = token;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
    c.clipDone = new Promise((res) => {
      rec.onstop = () => {
        if (parts.length && c.clipToken === token) c.clipUrl = URL.createObjectURL(new Blob(parts, { type: rec.mimeType || type || "video/webm" }));
        res();
      };
    });
    rec.start();
    c.clipRec = rec;
  } catch (e) { console.warn("내 동작 녹화 안 됨(손 좌표만 보여 줌):", e && e.name); c.clipRec = null; }
}
function stopClip(c) {
  const rec = c.clipRec;
  c.clipRec = null;
  if (rec && rec.state !== "inactive") { try { rec.stop(); } catch { /* 이미 멈춤 */ } }
  return c.clipDone || Promise.resolve();
}
function dropClip(c) {
  if (!c) return;
  c.clipToken = null;
  if (c.clipRec && c.clipRec.state !== "inactive") { try { c.clipRec.stop(); } catch { /* 이미 멈춤 */ } }
  c.clipRec = null;
  if (c.clipUrl) URL.revokeObjectURL(c.clipUrl);
  c.clipUrl = null;
  c.clipDone = null;
}

// 카메라 칸 왼쪽 아래 작은 버튼(화면 높이를 늘리지 않게): 카메라면 [내 영상 파일로 해보기], 파일이면 [카메라로 돌아가기]
function fileChip() {
  const f = !!ctx.file;
  return h("button", { class: "file-chip", type: "button", onclick: f ? useCamera : pickFile }, btn(f ? "L-51" : "L-49"));
}

// ── (11/25) 내 영상 파일로 해보기: 카메라 대신 이 기기에 있는 동영상 파일(미리 찍어 둔 동작)을 같은 방식으로 분석한다.
// 결선장에서 카메라가 말썽일 때·카메라가 없는 기기에서도 한 바퀴를 돌 수 있게. 파일은 이 기기 안에서만 읽고 어디로도 보내지 않는다
function clearFile(c) {
  if (c && c.fileUrl) { URL.revokeObjectURL(c.fileUrl); c.fileUrl = null; }
  if (camVideo.getAttribute("src")) { camVideo.pause(); camVideo.removeAttribute("src"); camVideo.load(); }
  camVideo.loop = false;
}
async function startFile(c) {
  stopCamera();
  camVideo.srcObject = null;
  if (c.fileUrl) URL.revokeObjectURL(c.fileUrl);
  c.fileUrl = URL.createObjectURL(c.file);
  camVideo.muted = true; camVideo.loop = true;
  camVideo.src = c.fileUrl;
  const ok = await new Promise((res) => {
    camVideo.addEventListener("loadeddata", () => res(true), { once: true });
    camVideo.addEventListener("error", () => res(false), { once: true });
    setTimeout(() => res(camVideo.readyState >= 2), 8000);
  });
  if (!ok) return "E-15";
  try { await camVideo.play(); } catch { /* 눌러서 재생 */ }
  return null;
}
function pickFile() {
  const input = h("input", { type: "file", accept: "video/*", hidden: true });
  input.onchange = () => {
    const f = input.files && input.files[0];
    input.remove();
    if (!f || !ctx || (ctx.mode !== "practice" && ctx.mode !== "intro")) return;
    if (ctx.mode === "intro") setCameraIntroSeen();
    ctx.file = f;
    showPractice();
  };
  document.body.append(input);
  input.click();
}
function useCamera() {
  if (!ctx) return;
  clearFile(ctx);
  ctx.file = null;
  showPractice();
}

// #/lab/word/:no
export function renderLabWord(el, { no }) {
  const word = wordByNo(no);
  if (!word) { go("/lab"); return; }
  clearTimeout(stopTimer);
  preload();
  ctx = { el, word, mode: null, frames: [], timers: [], raf: 0, stopReplay: null, retried: false, ranked: null };
  if (getState().cameraIntroSeen) showPractice();
  else showIntro();
  const mine = ctx;
  return () => {                        // 이 주소를 떠날 때
    teardown(mine);
    dropClip(mine);
    if (ctx === mine) ctx = null;
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => { if (!ctx) { stopCamera(); camVideo.srcObject = null; clearFile(mine); } }, 0); // 다음 화면도 연습이면 안 끔
  };
}

function teardown(c) {
  c.timers.forEach(clearTimeout); c.timers = [];
  stopLoop(c);
  if (c.stopReplay) { c.stopReplay(); c.stopReplay = null; }
}

function screen(mode, children, { tabbar = false } = {}) {
  teardown(ctx);
  ctx.mode = mode;
  setLeaveGuard(null);
  setTabbar(!tabbar);
  ctx.el.replaceChildren(h("section", { class: `lab lab-${mode}` }, children));
  window.scrollTo(0, 0);
}

const trialBlock = (withLine) => isTrialModel()
  ? h("p", { class: "trial-line" }, trialTag(), withLine ? [" ", h("span", { class: "muted small" }, t("L-04"))] : null)
  : null;

// ── S10 카메라 안내(처음 한 번) ──
function showIntro() {
  const errSlot = h("div");
  const onBtn = button(btn("L-08"), async () => {
    onBtn.disabled = true;
    errSlot.replaceChildren(spinner());
    const err = await startCamera(camVideo);
    onBtn.disabled = false;
    if (err) {
      errSlot.replaceChildren(errorBox(err, { [btn("C-11")]: () => onBtn.click() }),
        h("p", { class: "file-line" }, h("button", { class: "link-btn", type: "button", onclick: pickFile }, btn("L-49"))));
      return;
    }
    setCameraIntroSeen();
    showPractice();
  }, { kind: "primary", cls: "btn-big" });
  screen("intro", [
    header(t("L-05"), { onBack: () => go("/lab") }),
    h("p", {}, t("L-06")),
    h("p", {}, t("L-07")),
    poseFigure(),
    errSlot,
    h("div", { class: "bottom-actions" }, onBtn),
  ], { tabbar: true });
}

// 손이 화면 안에 들어온 자세 예시(사람 사진 대신 단순한 그림, 수어 동작 아님)
function poseFigure() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 200 150");
  svg.setAttribute("class", "pose-figure");
  svg.setAttribute("aria-hidden", "true");
  // 화면 안에 얼굴·양어깨·손이 들어오게 서는 법(틀 모서리 + 사람 윤곽 + 손이 들어올 자리). 손 모양은 그리지 않음(수어로 오해되지 않게)
  svg.innerHTML = `
    <rect x="14" y="6" width="172" height="138" rx="18" fill="#e3f6ea"/>
    <g fill="none" stroke="#17804f" stroke-width="4" stroke-linecap="round">
      <path d="M28 30V22a8 8 0 0 1 8-8h8"/><path d="M156 14h8a8 8 0 0 1 8 8v8"/>
      <path d="M172 120v8a8 8 0 0 1-8 8h-8"/><path d="M44 136h-8a8 8 0 0 1-8-8v-8"/></g>
    <circle cx="100" cy="54" r="19" fill="#0f3d2b"/>
    <path d="M56 136 Q58 88 100 84 Q142 88 144 136 Z" fill="#0f3d2b"/>
    <g fill="#a6e35a" fill-opacity=".35" stroke="#a6e35a" stroke-width="2.5" stroke-dasharray="5 4">
      <circle cx="58" cy="76" r="15"/><circle cx="142" cy="76" r="15"/></g>`;
  return svg;
}

// ── S11 연습 ──
function showPractice() {
  const w = ctx.word;
  ctx.frames = [];
  const dict = dictVideo(w);
  const shapeText = h("p", { class: "handshape", hidden: true }, w.handshape);
  const shapeBtn = button(btn("L-12"), () => { shapeText.hidden = !shapeText.hidden; }, { kind: "chip" });

  const box = h("div", { class: "cam-box" });
  const overlay = h("canvas", { class: "cam-overlay" });
  const cue = h("div", { class: "cam-cue", hidden: true });
  const handState = h("span", { class: "track-pill" }, t("L-20"));
  const bodyState = h("span", { class: "track-pill" }, t("L-44"));
  const notice = h("div");
  const startBtn = button(btn("L-15"), () => begin(), { kind: "primary", cls: "btn-big", disabled: true });

  // (11/24) 한 화면 연습: 휴대폰에서 사전 영상·내 카메라·[동작 시작]이 스크롤 없이 함께 보이게.
  // 내 카메라를 크게, 사전 영상은 그 위에 떠 있고 사용자가 옮기고 크기를 바꿈(11/25 사장 지시). 사전 영상은 편집하지 않고 크기만 바꿔 보여 줌
  const dictBox = dict.querySelector(".video-box");
  const dictTools = dict.querySelector(".video-tools");
  const dictSource = dict.lastElementChild;
  const stage = h("div", { class: "practice-stage" });
  // (11/25) 사전 영상은 카메라 위에 떠 있고, 끌어서 옮기고·모서리 손잡이/두 손가락으로 크기를 바꾼다(js/pip.js). 두 번 누르면 크게↔작게
  const moveBtn = h("button", { class: "pip-btn pip-move", type: "button", "aria-label": t("L-48") }, icon("move", { stroke: 2.4 }));
  const sizeBtn = h("button", { class: "pip-btn pip-size", type: "button", "aria-label": t("L-47") }, icon("expand", { stroke: 2.4 }));
  dictBox.classList.add("pip-target", "pip-float");
  dictBox.append(h("span", { class: "pip-label" }, t("L-10")), moveBtn, sizeBtn);
  stage.append(box);
  Object.assign(ctx, { dict, box, overlay, cue, handState, bodyState, notice, startBtn, stage, ready: false, bodyHist: [], fixedBody: null });

  screen("practice", [
    header(t("L-09", { "단어": w.name }), { onBack: () => go("/lab") }),
    trialBlock(false),
    ctx.retried ? h("p", { class: "info-line" }, t("L-39")) : null,
    stage,
    h("div", { class: "track-state" }, handState, bodyState),
    h("div", { class: "practice-tools" }, dictTools, shapeBtn),
    shapeText,
    dictSource,
    isLowData(w) ? h("p", { class: "info-line" }, t("L-13")) : null,
    notice,
    h("p", { class: "muted small" }, ctx.file ? t("L-50", { "이름": ctx.file.name }) : t("L-14")),
    h("div", { class: "bottom-actions sticky-actions" }, startBtn),
  ]);
  ctx.retried = false;
  makeFloating(stage, dictBox, moveBtn, sizeBtn);   // 화면에 놓인 뒤에 띄움(처음 자리를 카메라 칸 기준으로 잡으려고)
  initCamera();
}

// 카메라·MediaPipe 켜기(이미 켜져 있으면 바로). 끝나면 [동작 시작]을 누를 수 있다
async function initCamera() {
  const c = ctx;
  if (!c || c.mode !== "practice") return;
  c.ready = false;
  c.startBtn.disabled = true;
  c.box.replaceChildren(spinner());
  // (11/24) 손 찾기 AI 불러오기를 카메라 켜기와 동시에 시작(차례로 기다리지 않음)
  const workerReady = handTracker.loadWorker().then(() => true, (e) => { console.warn("손 찾기 일꾼 실패(화면 스레드로):", e && e.message); return false; });
  stopLoop(c);
  if (!c.file) clearFile(c);
  const err = c.file ? await startFile(c) : await startCamera(camVideo);
  if (ctx !== c || c.mode !== "practice") return;
  if (err) {   // 카메라가 안 되면 파일로 해 보는 길도 같이 보여 줌
    c.box.replaceChildren(errorBox(err, { [btn("C-11")]: () => initCamera() }),
      c.file ? "" : h("p", { class: "file-line" }, h("button", { class: "link-btn", type: "button", onclick: pickFile }, btn("L-49"))));
    return;
  }
  fitCameraBox(c);
  // (11/19) 먼저 일꾼(다른 스레드)으로. 안 되는 브라우저면 화면 스레드로
  const viaWorker = await workerReady;
  try { if (!viaWorker) await handTracker.load(); }
  catch (e) {
    console.warn("MediaPipe 불러오기 실패:", e && e.message);
    if (ctx === c) c.box.replaceChildren(errorBox("E-07", { [btn("C-11")]: () => initCamera() }));
    return;
  }
  if (ctx !== c || c.mode !== "practice") return;
  c.box.replaceChildren(camVideo, c.overlay, c.cue, fileChip());
  camVideo.play().catch(() => {});
  // 이 기기에서 손 찾기가 빠른 방식(GPU/CPU)을 한 번 고른다(처음 한 번만 1~2초, 그동안 [동작 시작]은 잠김)
  if (viaWorker) await handTracker.tuneWorker(camVideo); else await handTracker.tune(camVideo);
  if (ctx !== c || c.mode !== "practice") return;
  c.ready = true;
  syncOrientation();
  startLoop();
}

// (11/24) 카메라 상자 비율 = 실제 카메라 비율(휴대폰은 세로 3:4 등). 전에는 4:3 고정에 영상을 잘라 보여 줘서
// 뼈대(캔버스, 늘어남)와 영상(잘림)이 어긋날 수 있었음. 높이는 화면의 52% 까지
function fitCameraBox(c) {
  const vw = camVideo.videoWidth, vh = camVideo.videoHeight;
  if (!(vw > 0 && vh > 0)) return;
  c.box.style.aspectRatio = `${vw} / ${vh}`;
  c.box.style.width = `min(100%, calc(52svh * ${(vw / vh).toFixed(4)}))`;
}

function syncOrientation() {
  if (!ctx || ctx.mode !== "practice") return;
  const bad = landscape();
  ctx.notice.replaceChildren(bad ? errorBox("E-12") : "");
  ctx.startBtn.disabled = !ctx.ready || bad;
}
matchMedia("(orientation: landscape)").addEventListener?.("change", () => syncOrientation());

// 프레임마다 손 좌표 구하기 → 카메라 위에 그리기, 기록 중이면 모으기
// (11/19 속도) 새 카메라 프레임이 올 때만 돈다(requestVideoFrameCallback, 없으면 rAF).
// 몸 모델(코·양어깨)은 기록 전에만 0.2초마다 돌려 화면에 얼굴·어깨 기준을 그리고, 기록하는 동안은 손 모델만 돌린다.
// 기록 프레임의 몸 값 = 기록 직전 1초쯤의 가운데 값 하나(사전 영상 42개 실험: 매 프레임 값과 순위가 같음, design.md 16절).
const BODY_EVERY_MS = 200, BODY_HIST = 6;
function medianBody(list) {
  const ok = list.filter((b) => b && b.rs && b.ls);
  if (!ok.length) return null;
  const md = (k) => {
    const pts = ok.map((b) => b[k]).filter(Boolean);
    if (!pts.length) return null;
    return [0, 1].map((j) => pts.map((p) => p[j]).sort((x, y) => x - y)[pts.length >> 1]);
  };
  return { nose: md("nose"), rs: md("rs"), ls: md("ls") };
}
function stopLoop(c) {
  if (c.raf) cancelAnimationFrame(c.raf);
  if (c.vfc && camVideo.cancelVideoFrameCallback) camVideo.cancelVideoFrameCallback(c.vfc);
  if (c.vfcTimer) cancelAnimationFrame(c.vfcTimer);
  c.raf = 0; c.vfc = 0; c.vfcTimer = 0;
}

function startLoop() {
  const c = ctx;
  const g = c.overlay.getContext("2d");
  const rvfc = typeof camVideo.requestVideoFrameCallback === "function";
  let lastVT = -1, lastStored = -Infinity, lastBodyAt = -Infinity, sending = false, dirty = true, lastApplied = -Infinity;
  c.lastHands = [];
  let shownBody = null;

  // 결과 하나가 왔을 때: 화면 상태 갱신 + 기록 중이면 모으기
  const onHands = (hands, now) => {
    if (ctx !== c) return;
    if (now <= lastApplied) return;   // 일꾼 둘이 번갈아 하므로 늦게 온 옛 프레임 결과는 버림
    lastApplied = now;
    c.lastHands = hands; dirty = true;
    c.handState.textContent = hands.length ? t("L-19") : t("L-20");
    c.handState.classList.toggle("on", hands.length > 0);
    if (c.mode === "recording" && now - lastStored >= MIN_FRAME_MS) {
      const body = c.fixedBody || c.lastBody || null;
      c.frames.push({ width: camVideo.videoWidth, height: camVideo.videoHeight, hands, body });
      lastStored = now;
    }
  };
  const onBody = (b) => {
    if (ctx !== c) return;
    if (c.mode === "recording") { if (b) c.lastBody = b; return; }   // 어깨를 기록 전에 못 잡았을 때만 옴
    c.bodyHist.push(b);
    if (c.bodyHist.length > BODY_HIST) c.bodyHist.shift();
    shownBody = b; dirty = true;
    c.bodyState.hidden = !handTracker.hasBody;
    c.bodyState.textContent = b ? t("L-43") : t("L-44");
    c.bodyState.classList.toggle("on", !!b);
  };

  // 새 카메라 프레임마다: 손 찾기가 쉬고 있으면 이 (가장 새) 프레임을 보낸다. 바쁘면 이 프레임은 건너뜀 → 밀린 프레임이 쌓이지 않아 늦어지지 않음
  function pump() {
    if (ctx !== c) return;
    c.vfc = rvfc ? camVideo.requestVideoFrameCallback(pump) : 0;
    if (!rvfc) c.vfcTimer = requestAnimationFrame(pump);
    const free = handTracker.usingWorker ? handTracker.idleWorkers > 0 && !sending : true;
    if (!free || camVideo.readyState < 2 || (!rvfc && camVideo.currentTime === lastVT)) return;
    lastVT = camVideo.currentTime;
    const now = performance.now();
    const recording = c.mode === "recording";
    const wantBody = recording ? (!c.fixedBody && c.frames.length % 6 === 0) : now - lastBodyAt >= BODY_EVERY_MS;
    if (handTracker.usingWorker) {
      sending = true;   // ImageBitmap 을 만드는 동안 같은 프레임을 두 번 보내지 않게
      handTracker.send(camVideo, now, { body: wantBody, onHands: (hands) => onHands(hands, now), onBody })
        .then((r) => { sending = false; if (r.body && !recording) lastBodyAt = now; })
        .catch(() => { sending = false; });
    } else {
      if (wantBody && !recording) lastBodyAt = now;
      let hands = [];
      try { hands = handTracker.detect(camVideo, now); } catch (e) { hands = []; }
      onHands(hands, now);
      if (wantBody) { let b = null; try { b = handTracker.detectBody(camVideo, now); } catch (e) { b = null; } onBody(b); }
    }
  }

  // 그리기: 새 AI 결과가 왔을 때만, AI 가 실제로 찾은 점만 그린다(11/24 사장 지시로 결과 사이 짐작해 그리기 없앰)
  function draw() {
    if (ctx !== c) return;
    c.raf = requestAnimationFrame(draw);
    if (!dirty) return;
    dirty = false;
    if (c.overlay.width !== camVideo.videoWidth && camVideo.videoWidth) { c.overlay.width = camVideo.videoWidth; c.overlay.height = camVideo.videoHeight; }
    drawHands(g, c.lastHands, { mirror: true });
    drawBody(g, c.mode === "recording" ? c.fixedBody : shownBody, { mirror: true });
  }
  stopLoop(c);
  c.raf = requestAnimationFrame(draw);
  pump();
}

// 녹화 길이 = 사전 영상 길이(사장 지시 11/16). 영상 정보를 아직 모르면 CONFIG.LAB_RECORD_SECONDS
function recordSeconds(c) {
  const d = c.dict && c.dict.duration ? c.dict.duration() : NaN;
  if (!(d > 0) || !isFinite(d)) return CONFIG.LAB_RECORD_SECONDS;
  return Math.min(CONFIG.LAB_RECORD_MAX, Math.max(CONFIG.LAB_RECORD_MIN, Math.round(d * 10) / 10));
}

// [동작 시작] → 사전 영상 멈춤 → 3·2·1 → 기록(사전 영상 길이) → 분석
function begin() {
  const c = ctx;
  if (!c.ready || landscape()) return;
  c.startBtn.disabled = true;
  c.dict.pause();
  c.mode = "countdown";
  c.frames = [];
  c.lastBody = null;
  c.recSec = recordSeconds(c);   // 카운트다운 동안 영상 정보가 오면 녹화 시작 때 다시 정한다
  dropClip(c);
  if (c.stage) { c.stage.classList.remove("swap"); }   // 동작할 때는 늘 내 카메라를 크게
  const later = (ms, fn) => c.timers.push(setTimeout(fn, ms));
  const show = (...kids) => { c.cue.hidden = false; c.cue.replaceChildren(...kids); };
  [3, 2, 1].forEach((n, i) => later(i * 1000, () => show(h("span", { class: "count" }, t("L-16", { "3/2/1": n })))));
  later(3000, () => {
    c.recSec = recordSeconds(c);
    if (c.file) {   // 파일: 처음부터 파일 길이만큼(최대 LAB_RECORD_MAX)
      const d = camVideo.duration;
      if (d > 0 && isFinite(d)) c.recSec = Math.min(CONFIG.LAB_RECORD_MAX, Math.round(d * 10) / 10);
      try { camVideo.currentTime = 0; } catch { /* 무시 */ }
    }
    c.fixedBody = medianBody(c.bodyHist);   // 기록 직전 얼굴·어깨 위치 하나로 고정
    c.mode = "recording";
    startClip(c);
    later(c.recSec * 1000, () => {
      c.mode = "analyzing";
      stopClip(c);
      analyze(c.frames.slice());
    });
    const bar = h("span", { class: "rec-bar-fill" });
    show(h("strong", {}, t("L-17")), h("small", {}, t("L-18")), h("span", { class: "rec-bar" }, bar));
    requestAnimationFrame(() => { bar.style.transitionDuration = `${c.recSec}s`; bar.style.width = "0%"; });
  });
}

// ── S12 분석 중 ──
async function analyze(frames) {
  const c = ctx;
  c.frames = frames;
  const mini = h("canvas", { class: "replay mini" });
  const body = h("div", { class: "analyze-body" }, spinner(t("L-21")));
  screen("analyzing", [header(t("L-09", { "단어": c.word.name })), mini, body]);
  c.stopReplay = replay(mini, frames, { durationMs: c.recSec * 1000 });

  // 거울처럼 따라 했는지 보고(normalize.js mirrorPlan) 그대로·뒤집은 것 중 필요한 것만 모델에 넣는다
  const opts = { flip: CONFIG.HANDEDNESS_FLIP, minFrames: CONFIG.LAB_MIN_HAND_FRAMES };
  const plan = mirrorPlan(frames, CONFIG.HANDEDNESS_FLIP);
  const preps = [];
  if (plan !== "mirror") preps.push(prepareFeatures(frames, opts));
  if (plan !== "as-is") preps.push(prepareFeatures(frames.map(mirrorFrame), opts));
  const prep = preps.find((p) => !p.error) || preps[0];
  if (prep.error) {        // E-09: 순위를 찾지 않음. [다시 해보기]는 시도 횟수에 넣지 않음
    body.replaceChildren(errorBox("E-09", { [btn("L-31")]: () => showPractice() }));
    return;
  }
  const runRank = async () => {
    body.replaceChildren(spinner(t("L-21")));
    const r = await rankBest(preps.filter((p) => !p.error).map((p) => (p.windows.length ? p.windows : p.features)), allWords());
    if (ctx !== c) return;
    if (r.error === "E-08") {
      body.replaceChildren(errorBox("E-08", { [btn("C-11")]: runRank, [btn("L-38")]: () => go("/lab") }));
    } else if (r.error) {
      body.replaceChildren(errorBox("E-10", { [btn("L-31")]: () => showPractice() }));
    } else {
      c.ranked = r;
      await Promise.race([c.clipDone || null, new Promise((res) => setTimeout(res, 1500))]);  // 녹화 마무리(보통 수십 ms)
      if (ctx !== c) return;
      showResult(0);
    }
  };
  runRank();
}

// ── S13 결과 ──
function showResult(selected) {
  const c = ctx;
  const [n1, n2] = c.ranked.names;
  const sel = wordByName(c.ranked.names[selected]);
  const full = t("L-22", { "단어1": n1, "단어2": n2 });
  const seg = `① ${n1}`;
  const at = full.indexOf(seg);
  const replayCanvas = h("canvas", { class: c.clipUrl ? "replay over" : "replay" });
  const clip = c.clipUrl ? h("video", { class: "clip", src: c.clipUrl, muted: true, autoplay: true, loop: true, playsInline: true }) : null;
  const mine = clip ? h("div", { class: "clip-wrap" }, clip, replayCanvas) : replayCanvas;

  // (11/24 스크롤 줄이기) 사전 영상 출처 줄은 좁은 왼쪽 칸 대신 두 영상 아래 넓게(내용 그대로)
  const selVideo = dictVideo(sel);
  const selSource = selVideo.lastElementChild;
  selSource.remove();
  screen("result", [
    header(t("L-01"), { onBack: () => go("/lab") }),
    trialBlock(true),
    h("p", { class: "rank-line" }, at >= 0 ? [full.slice(0, at), h("strong", {}, seg), full.slice(at + seg.length)] : full),
    h("div", { class: "rank-switch", role: "group" },
      [btn("L-23", { "단어1": n1 }), btn("L-24", { "단어2": n2 })].map((label, i) =>
        h("button", { class: `chip ${i === selected ? "on" : ""}`, "aria-pressed": i === selected ? "true" : "false",
          onclick: () => { if (i !== selected) showResult(i); } }, label))),
    h("div", { class: "side-by-side" },
      h("div", { class: "pane" }, h("h3", { class: "pane-label" }, t("L-25", { "선택한 순위 단어": sel.name })), selVideo),
      h("div", { class: "pane" }, h("h3", { class: "pane-label" }, t("L-26")), mine)),
    selSource,
    h("p", { class: "muted" }, t("L-27")),
    h("p", { class: "ask-line" }, t("L-28", { "단어1": n1 })),
    h("div", { class: "choice-row" },
      button(btn("L-29"), () => { recordLabChoice(wordByName(n1).no); showSaved(wordByName(n1)); }, { kind: "secondary" }),
      button(btn("L-30"), () => openPicker(), { kind: "secondary" }),
      button(btn("L-31"), () => { recordLabRetry(); c.retried = true; showPractice(); }, { kind: "secondary" })),
  ]);
  c.stopReplay = clip
    ? replay(replayCanvas, c.frames, { durationMs: c.recSec * 1000, bg: false,
        clock: () => (clip.currentTime / (clip.duration > 0 && isFinite(clip.duration) ? clip.duration : c.recSec)) * c.recSec * 1000 })
    : replay(replayCanvas, c.frames, { durationMs: c.recSec * 1000 });
  // [뒤로]·탭으로 나가려 하면 L-40 확인
  setLeaveGuard((proceed) => {
    confirmModal(t("L-40"), btn("L-41"), btn("L-42"), proceed);
    return false;
  });
}

// ── S14 42개 목록에서 고르기(순서 그대로, AI 순위·따라 할 단어를 위로 올리지 않음) ──
function openPicker() {
  const list = h("div", { class: "picker-list" });
  const input = h("input", { type: "search", class: "search-input", placeholder: t("L-34"), "aria-label": t("L-34"),
    oninput: () => draw() });
  function draw() {
    const q = input.value;
    list.replaceChildren(...stageNumbers().map((n) => {
      const ws = wordsOfStage(n).filter((w) => matchWord(w, q));
      if (!ws.length) return null;
      return h("div", { class: "picker-stage" },
        h("h4", {}, t("C-14", { n })),
        h("ul", { class: "word-list" }, ws.map((w) => h("li", {},
          h("button", { class: "word-row", onclick: () => { m.close(); recordLabChoice(w.no); showSaved(w); } },
            h("span", { class: "word-name" }, w.name))))));
    }).filter(Boolean));
  }
  draw();
  const m = openModal(h("div", { class: "picker" },
    h("div", { class: "row-between" }, h("h2", {}, t("L-32")), button(btn("C-10"), () => m.close(), { kind: "chip" })),
    h("p", { class: "muted small" }, t("L-33")),
    input,
    list), { sheet: true });
}

// ── S15 기록됨 ──
function showSaved(w) {
  const c = ctx;
  const next = nextWordOf(c.word);
  screen("saved", [
    header(t("L-01")),
    h("div", { class: "saved-hero" },
      h("h2", { class: "saved-title" }, t("L-35", { "단어": w.name })),
      h("p", { class: "muted" }, t("L-36"))),
    levelBar(levelInfo(getState())),
    h("div", { class: "btn-col bottom-actions" },
      button(btn("L-37", { "단어": next.name }), () => go(`/lab/word/${next.no}`), { kind: "primary" }),
      button(btn("L-38"), () => go("/lab"), { kind: "secondary" })),
  ], { tabbar: true });
}

export const _labDebug = { camVideo, get ctx() { return ctx; }, cameraOn };
