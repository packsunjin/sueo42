// [직접 해보기 S10~S15] 카메라 안내(처음 한 번) → 연습(사전 영상 + 내 카메라, 3·2·1 뒤 손 좌표 기록) → 분석 중 → 결과(AI 추정 순위 ①② + 사전 영상 ⇄ 내 손 좌표 나란히, 사용자가 고름) → 42개 목록 고르기 → 기록됨.
// 점수·확률·%·맞음/틀림은 쓰지 않는다. 카메라는 [다음 단어]로 이어 가는 동안 끄지 않고, 직접 해보기 밖으로 나가면 끈다.
import { h } from "../util.js";
import { t, btn } from "../copy.js";
import { CONFIG, isTrialModel } from "../../config.js";
import { header, button, dictVideo, errorBox, spinner, trialTag, levelBar, openModal, confirmModal, go } from "../ui.js";
import { setLeaveGuard } from "../router.js";
import { allWords, wordByNo, wordsOfStage, stageNumbers, matchWord, isLowData } from "../data/words.js";
import { getState, recordLabChoice, recordLabRetry, setCameraIntroSeen } from "../store.js";
import { levelInfo } from "../game/progress.js";
import { startCamera, stopCamera, isOn as cameraOn } from "../ai/camera.js";
import { handTracker } from "../ai/hands.js";
import { drawHands, replay } from "../ai/draw.js";
import { prepareFeatures } from "../ai/normalize.js";
import { rank, preload } from "../ai/model.js";

// ── 화면이 바뀌어도 남는 것: 카메라 <video> 하나, 카메라 끄기 예약 ──
const camVideo = h("video", { class: "cam-video", muted: true, autoplay: true, playsInline: true });
camVideo.setAttribute("playsinline", "");
let stopTimer = null;
let ctx = null;            // 지금 연습 중인 화면의 상태
const MIN_FRAME_MS = 33;   // structure.md 4-5: 약 33 ms 간격 이상일 때만 기록(30 fps 가깝게)

const landscape = () => matchMedia("(orientation: landscape) and (pointer: coarse)").matches;
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
    stopCamera();
    if (ctx.mode === "countdown" || ctx.mode === "recording") showPractice(); // 기록을 버리고 처음으로
  } else if (ctx.mode === "practice") {
    initCamera();
  }
});

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
    if (ctx === mine) ctx = null;
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => { if (!ctx) { stopCamera(); camVideo.srcObject = null; } }, 0); // 다음 화면도 연습이면 안 끔
  };
}

function teardown(c) {
  c.timers.forEach(clearTimeout); c.timers = [];
  cancelAnimationFrame(c.raf); c.raf = 0;
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
    if (err) { errSlot.replaceChildren(errorBox(err, { [btn("C-11")]: () => onBtn.click() })); return; }
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
  svg.innerHTML = `
    <rect x="20" y="8" width="160" height="134" rx="10" fill="#f1f4f9" stroke="#9aa4b2" stroke-width="2" stroke-dasharray="6 5"/>
    <circle cx="100" cy="52" r="20" fill="#c9d3e3"/>
    <path d="M52 142 Q56 86 100 82 Q144 86 148 142 Z" fill="#c9d3e3"/>
    <path d="M140 118 L150 66" stroke="#c9d3e3" stroke-width="12" stroke-linecap="round"/>
    <g fill="#2f6fed"><rect x="140" y="40" width="20" height="26" rx="8"/></g>`;
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
  const handState = h("p", { class: "hand-state muted small" }, t("L-20"));
  const notice = h("div");
  const startBtn = button(btn("L-15"), () => begin(), { kind: "primary", cls: "btn-big", disabled: true });
  Object.assign(ctx, { dict, box, overlay, cue, handState, notice, startBtn, ready: false });

  screen("practice", [
    header(t("L-09", { "단어": w.name }), { onBack: () => go("/lab") }),
    trialBlock(false),
    ctx.retried ? h("p", { class: "info-line" }, t("L-39")) : null,
    h("h3", { class: "pane-label" }, t("L-10")),
    dict,
    h("div", {}, shapeBtn, shapeText),
    isLowData(w) ? h("p", { class: "info-line" }, t("L-13")) : null,
    h("h3", { class: "pane-label" }, t("L-11")),
    box,
    handState,
    notice,
    h("p", { class: "muted" }, t("L-14", { t: CONFIG.LAB_RECORD_SECONDS })),
    h("div", { class: "bottom-actions" }, startBtn),
  ]);
  ctx.retried = false;
  initCamera();
}

// 카메라·MediaPipe 켜기(이미 켜져 있으면 바로). 끝나면 [동작 시작]을 누를 수 있다
async function initCamera() {
  const c = ctx;
  if (!c || c.mode !== "practice") return;
  c.ready = false;
  c.startBtn.disabled = true;
  c.box.replaceChildren(spinner());
  const err = await startCamera(camVideo);
  if (ctx !== c || c.mode !== "practice") return;
  if (err) { c.box.replaceChildren(errorBox(err, { [btn("C-11")]: () => initCamera() })); return; }
  try { await handTracker.load(); }
  catch (e) {
    console.warn("MediaPipe 불러오기 실패:", e && e.message);
    if (ctx === c) c.box.replaceChildren(errorBox("E-07", { [btn("C-11")]: () => initCamera() }));
    return;
  }
  if (ctx !== c || c.mode !== "practice") return;
  c.box.replaceChildren(camVideo, c.overlay, c.cue);
  camVideo.play().catch(() => {});
  c.ready = true;
  syncOrientation();
  startLoop();
}

function syncOrientation() {
  if (!ctx || ctx.mode !== "practice") return;
  const bad = landscape();
  ctx.notice.replaceChildren(bad ? errorBox("E-12") : "");
  ctx.startBtn.disabled = !ctx.ready || bad;
}
matchMedia("(orientation: landscape)").addEventListener?.("change", () => syncOrientation());

// 프레임마다 손 좌표 구하기 → 카메라 위에 그리기, 기록 중이면 모으기
function startLoop() {
  const c = ctx;
  let lastVT = -1, lastStored = -Infinity;
  const g = c.overlay.getContext("2d");
  function tick() {
    c.raf = requestAnimationFrame(tick);
    if (camVideo.readyState < 2 || camVideo.currentTime === lastVT) return;
    lastVT = camVideo.currentTime;
    const now = performance.now();
    let hands = [];
    try { hands = handTracker.detect(camVideo, now); } catch (e) { hands = []; }
    if (c.overlay.width !== camVideo.videoWidth) { c.overlay.width = camVideo.videoWidth || 640; c.overlay.height = camVideo.videoHeight || 480; }
    drawHands(g, hands, { mirror: true });
    c.handState.textContent = hands.length ? t("L-19") : t("L-20");
    c.handState.classList.toggle("on", hands.length > 0);
    if (c.mode === "recording" && now - lastStored >= MIN_FRAME_MS) {
      c.frames.push({ width: camVideo.videoWidth, height: camVideo.videoHeight, hands });
      lastStored = now;
    }
  }
  cancelAnimationFrame(c.raf);
  c.raf = requestAnimationFrame(tick);
}

// [동작 시작] → 사전 영상 멈춤 → 3·2·1 → 기록(2초) → 분석
function begin() {
  const c = ctx;
  if (!c.ready || landscape()) return;
  c.startBtn.disabled = true;
  c.dict.pause();
  c.mode = "countdown";
  c.frames = [];
  const later = (ms, fn) => c.timers.push(setTimeout(fn, ms));
  const show = (...kids) => { c.cue.hidden = false; c.cue.replaceChildren(...kids); };
  [3, 2, 1].forEach((n, i) => later(i * 1000, () => show(h("span", { class: "count" }, t("L-16", { "3/2/1": n })))));
  later(3000, () => {
    c.mode = "recording";
    const bar = h("span", { class: "rec-bar-fill" });
    show(h("strong", {}, t("L-17")), h("small", {}, t("L-18")), h("span", { class: "rec-bar" }, bar));
    requestAnimationFrame(() => { bar.style.transitionDuration = `${CONFIG.LAB_RECORD_SECONDS}s`; bar.style.width = "0%"; });
  });
  later(3000 + CONFIG.LAB_RECORD_SECONDS * 1000, () => {
    c.mode = "analyzing";
    analyze(c.frames.slice());
  });
}

// ── S12 분석 중 ──
async function analyze(frames) {
  const c = ctx;
  c.frames = frames;
  const mini = h("canvas", { class: "replay mini" });
  const body = h("div", { class: "analyze-body" }, spinner(t("L-21")));
  screen("analyzing", [header(t("L-09", { "단어": c.word.name })), mini, body]);
  c.stopReplay = replay(mini, frames, { durationMs: CONFIG.LAB_RECORD_SECONDS * 1000 });

  const prep = prepareFeatures(frames, { flip: CONFIG.HANDEDNESS_FLIP, minRatio: CONFIG.LAB_MIN_HAND_RATIO });
  if (prep.error) {        // E-09: 순위를 찾지 않음. [다시 해보기]는 시도 횟수에 넣지 않음
    body.replaceChildren(errorBox("E-09", { [btn("L-31")]: () => showPractice() }));
    return;
  }
  const runRank = async () => {
    body.replaceChildren(spinner(t("L-21")));
    const r = await rank(prep.features, allWords());
    if (ctx !== c) return;
    if (r.error === "E-08") {
      body.replaceChildren(errorBox("E-08", { [btn("C-11")]: runRank, [btn("L-38")]: () => go("/lab") }));
    } else if (r.error) {
      body.replaceChildren(errorBox("E-10", { [btn("L-31")]: () => showPractice() }));
    } else {
      c.ranked = r;
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
  const replayCanvas = h("canvas", { class: "replay" });

  screen("result", [
    header(t("L-01"), { onBack: () => go("/lab") }),
    trialBlock(true),
    h("p", { class: "rank-line" }, at >= 0 ? [full.slice(0, at), h("strong", {}, seg), full.slice(at + seg.length)] : full),
    h("div", { class: "rank-switch", role: "group" },
      [btn("L-23", { "단어1": n1 }), btn("L-24", { "단어2": n2 })].map((label, i) =>
        h("button", { class: `chip ${i === selected ? "on" : ""}`, "aria-pressed": i === selected ? "true" : "false",
          onclick: () => { if (i !== selected) showResult(i); } }, label))),
    h("div", { class: "side-by-side" },
      h("div", { class: "pane" }, h("h3", { class: "pane-label" }, t("L-25", { "선택한 순위 단어": sel.name })), dictVideo(sel)),
      h("div", { class: "pane" }, h("h3", { class: "pane-label" }, t("L-26")), replayCanvas)),
    h("p", { class: "muted" }, t("L-27")),
    h("p", { class: "ask-line" }, t("L-28", { "단어1": n1 })),
    h("div", { class: "choice-row" },
      button(btn("L-29"), () => { recordLabChoice(wordByName(n1).no); showSaved(wordByName(n1)); }, { kind: "secondary" }),
      button(btn("L-30"), () => openPicker(), { kind: "secondary" }),
      button(btn("L-31"), () => { recordLabRetry(); c.retried = true; showPractice(); }, { kind: "secondary" })),
  ]);
  c.stopReplay = replay(replayCanvas, c.frames, { durationMs: CONFIG.LAB_RECORD_SECONDS * 1000 });
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
    h("h2", { class: "saved-title" }, t("L-35", { "단어": w.name })),
    h("p", { class: "muted" }, t("L-36")),
    levelBar(levelInfo(getState())),
    h("div", { class: "btn-col bottom-actions" },
      button(btn("L-37", { "단어": next.name }), () => go(`/lab/word/${next.no}`), { kind: "primary" }),
      button(btn("L-38"), () => go("/lab"), { kind: "secondary" })),
  ], { tabbar: true });
}

export const _labDebug = { camVideo, get ctx() { return ctx; }, cameraOn };
