// [시작] 기록 저장소 준비 → 단어 불러오기(S0) → 화면 이동 시작, 맨 위 상태 줄(C-07, 불꽃 주황)·아래 탭 바(선 아이콘 + 글자)·토스트(T-01~T-04)를 관리한다.
import { h, localDate } from "./util.js";
import { t } from "./copy.js";
import { route, startRouter, setHooks, go } from "./router.js";
import { initStore, getState, onChange, setEventSink, setStorageWarn, markStorageWarned } from "./store.js";
import { levelInfo, streak, learnedToday } from "./game/progress.js";
import { toast, eventToastText, eventToastKind, showStorageWarning, icon, celebrate, holdCelebrations } from "./ui.js";
import { renderStart } from "./screens/start.js";
import { renderHome } from "./screens/home.js";
import { renderSearch } from "./screens/search.js";
import { renderDetail } from "./screens/detail.js";
import { renderQuizHome, renderQuizPlay, renderRanking } from "./screens/quiz.js";
import { renderLabPick, renderLabWord } from "./screens/lab-pick.js";
import { handTracker } from "./ai/hands.js";
import { preload as preloadModel } from "./ai/model.js";
import { renderRecords } from "./screens/records.js";
import { renderInfo } from "./screens/info.js";

const TABS = [
  { label: "C-02", icon: "home", path: "/home", match: ["/home"] },
  { label: "C-03", icon: "search", path: "/search", match: ["/search", "/word/:no"] },
  { label: "C-04", icon: "quiz", path: "/quiz", match: ["/quiz", "/quiz/play/:stage", "/ranking"] },
  { label: "C-05", icon: "camera", path: "/lab", match: ["/lab", "/lab/word/:no"] },
  { label: "C-06", icon: "chart", path: "/records", match: ["/records", "/info"] },
];
// 탭 바를 숨기는 화면 — 뜻 맞히기 한 판(S5·S6). 직접 해보기 S11~S13 은 screens/lab.js 가 화면마다 직접 숨긴다
const HIDE_TABBAR = ["/quiz/play/:stage"];

const statusEl = document.getElementById("status");
const tabbarEl = document.getElementById("tabbar");

function drawStatus() {
  const s = getState(), today = localDate();
  const lit = learnedToday(s, today);
  const lv = levelInfo(s).level, d = streak(s, today);
  // C-07 "레벨 n · d일 연속"을 칩 두 개로 나눠 보여 준다(읽기 프로그램에는 C-07 전체를 읽어 줌)
  statusEl.replaceChildren(
    h("span", { class: "brand" }, h("img", { class: "brand-logo", src: "img/logo.svg", alt: "", "aria-hidden": "true" }), t("C-01")),
    h("span", { class: "status-chips", role: "img", "aria-label": t("C-07", { n: lv, d }) },
      h("span", { class: `chip-stat streak ${lit ? "lit" : ""}`, "aria-hidden": "true" }, flame(lit), String(d)),
      h("span", { class: "chip-stat level", "aria-hidden": "true" }, icon("up", { stroke: 2.6 }), String(lv))));
}

function flame(filled) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "flame");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", "M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-4 2-5 0 2 1 3 2 3 0-4-1-6 1-9z");
  p.setAttribute("fill", filled ? "currentColor" : "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", "1.6");
  svg.append(p);
  return svg;
}

// 화면이 바뀌면 열려 있던 창(아래에서 올라온 창·확인 창)을 닫는다 — 뒤로 가기로 나가도 창이 남지 않게(11/19 고침)
// (11/24) 직접 해보기 미리 준비: 손 찾기 AI(일꾼)와 단어 순위 모델을 뒤에서 불러 둔다. 실패해도 조용히(들어갈 때 다시 시도)
let warmed = false;
function warmLab() {
  if (warmed) return;
  warmed = true;
  handTracker.loadWorker()
    .then(() => {   // 처음 온 기기면 빈 그림으로 GPU·CPU 속도를 미리 재 둠(카메라 화면에서 기다리지 않게). 손 없는 그림도 손 찾기 시간은 비슷함
      const cv = document.createElement("canvas"); cv.width = 640; cv.height = 480;
      const g = cv.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(0, 0, 640, 480);
      return handTracker.tuneWorker(cv);
    })
    .catch(() => { warmed = false; });
  preloadModel();
}

function closeOpenSheets() {
  document.querySelectorAll(".modal-layer").forEach((m) => m.remove());
}

function drawTabs(pattern) {
  tabbarEl.hidden = HIDE_TABBAR.includes(pattern);
  tabbarEl.replaceChildren(...TABS.map((tab) => {
    const on = tab.match.includes(pattern);
    return h("button", { class: `tab ${on ? "on" : ""}`, "aria-current": on ? "page" : false, onclick: () => go(tab.path) },
      h("span", { class: "tab-icon" }, icon(tab.icon)), h("span", {}, t(tab.label)));
  }));
}

function registerRoutes() {
  route("/home", renderHome);
  route("/search", renderSearch);
  route("/word/:no", renderDetail);
  route("/quiz", renderQuizHome);
  route("/quiz/play/:stage", renderQuizPlay);
  route("/ranking", renderRanking);
  route("/lab", renderLabPick);
  route("/lab/word/:no", renderLabWord);
  route("/records", renderRecords);
  route("/info", renderInfo);
}

function boot() {
  const storageOk = initStore();
  // (11/19) 큰 일(레벨·단계·배지·오늘의 목표)은 축하 화면, 연속 학습은 토스트. 직접 해보기에서 생긴 일은 모두 토스트만
  // (AI 결과 뒤에 축하가 뜨면 '맞혔다'로 보일 수 있어서 — 강연 규칙)
  setEventSink((events, { from } = {}) => {
    const small = from === "lab" ? events : events.filter((ev) => ev.type === "day");
    small.forEach((ev) => toast(eventToastText(ev), () => go("/records"), eventToastKind(ev)));
    if (from !== "lab") celebrate(events);
  });
  setStorageWarn(showStorageWarning);
  onChange(drawStatus);

  const app = document.getElementById("app");
  statusEl.hidden = true;
  tabbarEl.hidden = true;
  renderStart(app, () => {
    statusEl.hidden = false;
    registerRoutes();
    setHooks({ before: (pattern) => { closeOpenSheets(); holdCelebrations(false); drawStatus(); drawTabs(pattern); if (pattern.startsWith("/lab")) warmLab(); } });
    // 데이터 절약·느린 망이 아니면 첫 화면 3초 뒤 미리 불러 둠(직접 해보기를 누르면 바로 시작)
    const net = navigator.connection;
    if (!(net && (net.saveData || /(^|-)2g|3g/.test(net.effectiveType || "")))) setTimeout(warmLab, 3000);
    startRouter();
    if (!storageOk) { markStorageWarned(); showStorageWarning(); } // S0 다음 한 번
  });
}

boot();
