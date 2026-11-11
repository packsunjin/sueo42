// [시작] 기록 저장소 준비 → 단어 불러오기(S0) → 화면 이동 시작, 맨 위 상태 줄(C-07)·아래 탭 바·토스트(T-01~T-04)를 관리한다.
import { h, localDate } from "./util.js";
import { t } from "./copy.js";
import { route, startRouter, setHooks, go } from "./router.js";
import { initStore, getState, onChange, setEventSink, setStorageWarn, markStorageWarned } from "./store.js";
import { levelInfo, streak, learnedToday } from "./game/progress.js";
import { toast, eventToastText, showStorageWarning } from "./ui.js";
import { renderStart } from "./screens/start.js";
import { renderHome } from "./screens/home.js";
import { renderSearch } from "./screens/search.js";
import { renderDetail } from "./screens/detail.js";
import { renderQuizHome, renderQuizPlay, renderRanking } from "./screens/quiz.js";
import { renderLabPick, renderLabWord } from "./screens/lab-pick.js";
import { renderRecords } from "./screens/records.js";
import { renderInfo } from "./screens/info.js";

const TABS = [
  { label: "C-02", path: "/home", match: ["/home"] },
  { label: "C-03", path: "/search", match: ["/search", "/word/:no"] },
  { label: "C-04", path: "/quiz", match: ["/quiz", "/quiz/play/:stage", "/ranking"] },
  { label: "C-05", path: "/lab", match: ["/lab", "/lab/word/:no"] },
  { label: "C-06", path: "/records", match: ["/records", "/info"] },
];
// 탭 바를 숨기는 화면 — 직접 해보기 S11~S13 은 screens/lab.js 가 화면마다 직접 숨긴다
const HIDE_TABBAR = [];

const statusEl = document.getElementById("status");
const tabbarEl = document.getElementById("tabbar");

function drawStatus() {
  const s = getState(), today = localDate();
  const lit = learnedToday(s, today);
  statusEl.replaceChildren(
    h("span", { class: "brand" }, t("C-01")),
    h("span", { class: `streak ${lit ? "lit" : ""}` }, flame(lit), t("C-07", { n: levelInfo(s).level, d: streak(s, today) })));
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

function drawTabs(pattern) {
  tabbarEl.hidden = HIDE_TABBAR.includes(pattern);
  tabbarEl.replaceChildren(...TABS.map((tab) => {
    const on = tab.match.includes(pattern);
    return h("button", { class: `tab ${on ? "on" : ""}`, "aria-current": on ? "page" : false, onclick: () => go(tab.path) }, t(tab.label));
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
  setEventSink((events) => events.forEach((ev) => toast(eventToastText(ev), () => go("/records"))));
  setStorageWarn(showStorageWarning);
  onChange(drawStatus);

  const app = document.getElementById("app");
  statusEl.hidden = true;
  tabbarEl.hidden = true;
  renderStart(app, () => {
    statusEl.hidden = false;
    registerRoutes();
    setHooks({ before: (pattern) => { drawStatus(); drawTabs(pattern); } });
    startRouter();
    if (!storageOk) { markStorageWarned(); showStorageWarning(); } // S0 다음 한 번
  });
}

boot();
