// [공통 화면 부품] 선 아이콘(인라인 SVG)·토스트(아이콘 알약)·창(모달)·오류 상자·사전 영상 칸·레벨 막대처럼 여러 화면이 같이 쓰는 것.
import { h } from "./util.js";
import { t, btn, ERROR_COPY, BADGE_COPY, unbracket } from "./copy.js";
import { CONFIG } from "../config.js";
import { go, back } from "./router.js";
import { BADGES } from "./game/progress.js";
import { thumbOf } from "./data/words.js";

// 사전 영상의 작은 그림(국립국어원 한국수어사전이 주는 215×161 그대로, 편집 안 함). 못 불러오면 자리만 남김
export function signThumb(w, cls = "thumb") {
  const src = thumbOf(w);
  if (!src) return null;
  const img = h("img", { class: cls, src, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.classList.add("broken"), { once: true });
  return img;
}

// ── 선 아이콘(직접 그린 단순한 SVG, 외부 이미지 없음) ──
const ICONS = {
  home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  quiz: '<path d="M4 4.5h16v11.5H10l-5 4v-4H4z"/><path d="M9.8 8.6a2.3 2.3 0 1 1 3.3 2c-.7.4-1.1.8-1.1 1.6"/><path d="M12 14.3v.1"/>',
  camera: '<path d="M3.5 8h3.5l1.8-2.6h6.4L17 8h3.5v11.5h-17z"/><circle cx="12" cy="13.5" r="3.6"/>',
  chart: '<path d="M4 20h16"/><path d="M6.5 20v-7"/><path d="M12 20V5.5"/><path d="M17.5 20v-10"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  expand: '<path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6"/>',
  move: '<path d="M12 3v18M3 12h18"/><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  medal: '<circle cx="12" cy="14" r="5.5"/><path d="M8.5 3.5 10.5 9M15.5 3.5 13.5 9"/><path d="m12 11.8.9 1.6 1.7.3-1.2 1.2.3 1.7-1.7-.8-1.7.8.3-1.7-1.2-1.2 1.7-.3z"/>',
  up: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.6v.1"/>',
  flame: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-4 2-5 0 2 1 3 2 3 0-4-1-6 1-9z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11.5v-7a1.5 1.5 0 0 1 3 0V12"/><path d="M14 11.5V6a1.5 1.5 0 0 1 3 0v8.5a6.5 6.5 0 0 1-11.4 4.3L3.8 16a1.6 1.6 0 0 1 2.4-2.1L8 15.5"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
};
export function icon(name, { stroke = 2, fill = "none" } = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", fill);
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", String(stroke));
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = ICONS[name] || "";
  return svg;
}

// ── 머리(제목 + [뒤로]) ──
export function header(title, { backTo, onBack } = {}) {
  const fn = onBack || (backTo !== undefined ? () => back(backTo) : null);
  return h("header", { class: "screen-head" },
    fn ? h("button", { class: "btn-back", onclick: fn, "aria-label": btn("C-09") }, icon("back", { stroke: 2.4 }), h("span", { class: "sr-only" }, btn("C-09"))) : null,
    h("h1", {}, title));
}

// ── 버튼 ──
export function button(label, onclick, { kind = "primary", disabled = false, cls = "" } = {}) {
  return h("button", { class: `btn btn-${kind} ${cls}`, onclick, disabled }, label);
}

// ── 오류 상자: copy.md E-번호 문구 + 버튼(handlers 는 버튼 글자 → 함수) ──
export function errorBox(id, handlers = {}) {
  const e = ERROR_COPY[id];
  return h("div", { class: "error-box", role: "alert" },
    h("p", {}, e.text),
    e.buttons.length ? h("div", { class: "btn-row" },
      e.buttons.map((b) => {
        const label = unbracket(b);
        const fn = handlers[label];
        return fn ? button(label, fn, { kind: "secondary" }) : null;
      })) : null);
}

export function spinner(text = t("C-08")) {
  return h("div", { class: "loading", role: "status" }, h("span", { class: "spin", "aria-hidden": "true" }), h("span", {}, text));
}

// ── 사전 영상 칸: 자동 재생·반복·소리 없음, 로딩 표시, 실패 시 E-02, [느리게 보기] ──
// opts.onReady / opts.onError / opts.extraError(오류 상자 아래 덧붙일 요소) / opts.source(출처 줄 요소)
export function dictVideo(word, opts = {}) {
  const wrap = h("div", { class: "video-wrap" });
  const box = h("div", { class: "video-box" });
  const loading = spinner();
  let video;
  let slow = false;
  const speedBtn = button(btn("C-17"), () => {
    slow = !slow;
    if (video) video.playbackRate = slow ? 0.5 : 1;
    speedBtn.textContent = slow ? btn("C-18") : btn("C-17");
  }, { kind: "chip" });

  function mount() {
    box.replaceChildren();
    video = h("video", { muted: true, autoplay: true, loop: true, playsInline: true, preload: "auto",
      "aria-label": t("L-10") });
    video.setAttribute("playsinline", "");
    video.muted = true;
    video.defaultMuted = true;
    video.addEventListener("loadeddata", () => {
      loading.remove();
      video.playbackRate = slow ? 0.5 : 1;
      video.play().catch(() => {});
      opts.onReady && opts.onReady();
    }, { once: true });
    video.addEventListener("error", () => {
      box.replaceChildren(h("div", { class: "video-error" },
        errorBox("E-02", {
          [btn("C-11")]: () => mount(),
          [btn("C-13")]: () => window.open(word.page, "_blank", "noopener"),
        }),
        opts.extraError || null));
      opts.onError && opts.onError();
    }, { once: true });
    box.append(video, loading);
    video.src = word.video;
  }
  mount();

  wrap.append(box, h("div", { class: "video-tools" }, speedBtn), opts.source || sourceLine(word));
  wrap.pause = () => video && video.pause();
  wrap.duration = () => (video ? video.duration : NaN);   // 직접 해보기 녹화 길이용(초, 모르면 NaN)
  return wrap;
}

// 출처 줄 C-12(표제어 있음) 또는 C-19(표제어 없음, 뜻 맞히기 문제 중)
export function sourceLine(word, { hideHeadword = false, link = true } = {}) {
  return h("p", { class: "source" },
    hideHeadword ? t("C-19") : t("C-12", { "사전 표제어": word.headword }),
    link && !hideHeadword ? [" ", dictLink(word)] : null);
}

export function dictLink(word) {
  return h("a", { class: "dict-link", href: word.page, target: "_blank", rel: "noopener" }, btn("C-13"));
}

// ── 레벨 막대 ──
export function levelBar(info) {
  return h("div", { class: "level-bar" },
    h("div", { class: "bar bar-thick" }, h("span", { style: { width: `${Math.round(info.ratio * 100)}%` } })),
    h("span", { class: "bar-label" }, info.toNext == null ? t("R-04") : t("R-03", { k: info.toNext })));
}

// ── 창(모달·아래에서 올라오는 창) ──
export function openModal(content, { sheet = false, onClose } = {}) {
  const layer = h("div", { class: `modal-layer ${sheet ? "sheet" : ""}` });
  const panel = h("div", { class: "modal-panel", role: "dialog", "aria-modal": "true" }, content);
  layer.append(panel);
  layer.addEventListener("click", (e) => { if (e.target === layer) close(); });
  function close() { layer.remove(); onClose && onClose(); }
  document.body.append(layer);
  const first = panel.querySelector("input, button");
  first && first.focus();
  return { close, layer };
}

// 간단 확인 창: 글 + 버튼 두 개
export function confirmModal(text, okLabel, cancelLabel, onOk) {
  const m = openModal(h("div", {},
    h("p", { class: "modal-text" }, text),
    h("div", { class: "btn-row" },
      button(okLabel, () => { m.close(); onOk(); }, { kind: "primary" }),
      button(cancelLabel, () => m.close(), { kind: "secondary" }))));
  return m;
}

// E-11 저장 안 됨 안내
export function showStorageWarning() {
  const e = ERROR_COPY["E-11"];
  const m = openModal(h("div", {},
    h("p", { class: "modal-text" }, e.text),
    h("div", { class: "btn-row" }, button(btn("C-10"), () => m.close(), { kind: "secondary" }))));
}

// ── 토스트(2.5초, 차례로) ──
const toastQueue = [];
let toastBusy = false;
export function toast(text, onClick, kind = "info") {
  toastQueue.push({ text, onClick, kind });
  if (!toastBusy) nextToast();
}
function nextToast() {
  const item = toastQueue.shift();
  if (!item) { toastBusy = false; return; }
  toastBusy = true;
  const el = h("div", { class: "toast", role: "status", onclick: () => { item.onClick && item.onClick(); } },
    h("span", { class: `toast-icon ${item.kind}` }, icon(TOAST_ICON[item.kind] || "info", { stroke: 2.4 })),
    h("span", {}, item.text));
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => { el.remove(); nextToast(); }, 250);
  }, CONFIG.TOAST_MS);
}

// 기록 이벤트 → 토스트 문구(T-01~T-04)
// ── (11/19) 축하 화면: 레벨·단계·배지·오늘의 목표(모두 참여 기준). 직접 해보기에서 생긴 일은 여기 오지 않음(main.js) ──
// 뜻 맞히기 문제를 푸는 동안에는 모아 뒀다가 결과 화면에서 한 번에 보여 준다(holdCelebrations)
let celebrateHold = false, celebrateQueue = [];
export function holdCelebrations(on) {
  celebrateHold = on;
  if (!on && celebrateQueue.length) { const q = celebrateQueue; celebrateQueue = []; celebrate(q); }
}
const CELEBRATE_ICON = { level: "up", stage: "check", badge: "medal", goal: "target" };
const CONFETTI = ["#17804f", "#a6e35a", "#ffc23d", "#1c9cf0", "#ff4b2b"];
export function celebrate(events) {
  const big = events.filter((e) => CELEBRATE_ICON[e.type]);
  if (!big.length) return;
  if (celebrateHold) { celebrateQueue.push(...big); return; }
  const order = ["level", "badge", "stage", "goal"];
  big.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const top = big[0];
  const reduce = globalThis.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const confetti = reduce ? null : h("div", { class: "confetti", "aria-hidden": "true" },
    Array.from({ length: 36 }, (_, i) => h("i", { style: {
      left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length],
      "--d": `${(i % 9) * 0.07}s`, "--r": `${(i * 47) % 360}deg`, "--x": `${((i * 29) % 60) - 30}px`,
    } })));
  const m = openModal(h("div", { class: `celebrate kind-${top.type}` },
    confetti,
    h("span", { class: "celebrate-icon", "aria-hidden": "true" }, icon(CELEBRATE_ICON[top.type], { stroke: 2.4 })),
    big.map((e, i) => h(i === 0 ? "h2" : "p", { class: i === 0 ? "" : "celebrate-more" }, eventToastText(e))),
    h("div", { class: "btn-col" }, button(btn("T-06"), () => m.close(), { kind: "primary" }))));
}

export function eventToastText(ev) {
  if (ev.type === "badge") return t("T-01", { "배지 이름": BADGE_COPY[badgeCopyId(ev.id)].name });
  if (ev.type === "day") return t("T-02", { d: ev.streak });
  if (ev.type === "level") return t("T-03", { n: ev.level });
  if (ev.type === "stage") return t("T-04", { n: ev.stage });
  if (ev.type === "goal") return t("T-05");
  return "";
}
// 기록 이벤트 → 토스트 아이콘 종류(배지 금색 메달, 연속 학습 주황 불꽃, 레벨 주색 화살표, 단계 초록 체크)
export const eventToastKind = (ev) => ({ badge: "badge", day: "day", level: "level", stage: "stage", goal: "goal" }[ev.type] || "info");
const TOAST_ICON = { badge: "medal", day: "flame", level: "up", stage: "check", goal: "target", info: "info" };
export const badgeCopyId = (id) => BADGES.find((b) => b.id === id).copy;

// "시험용" 표시
export const trialTag = () => h("span", { class: "tag-trial" }, t("L-03"));

export { go };
