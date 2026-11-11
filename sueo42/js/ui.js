// [공통 화면 부품] 상태 줄·탭 바·토스트·창(모달)·오류 상자·사전 영상 칸·레벨 막대처럼 여러 화면이 같이 쓰는 것.
import { h } from "./util.js";
import { t, btn, ERROR_COPY, BADGE_COPY, unbracket } from "./copy.js";
import { CONFIG } from "../config.js";
import { go, back } from "./router.js";
import { BADGES } from "./game/progress.js";

// ── 머리(제목 + [뒤로]) ──
export function header(title, { backTo, onBack } = {}) {
  const fn = onBack || (backTo !== undefined ? () => back(backTo) : null);
  return h("header", { class: "screen-head" },
    fn ? h("button", { class: "btn-back", onclick: fn }, btn("C-09")) : null,
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
    h("div", { class: "bar" }, h("span", { style: { width: `${Math.round(info.ratio * 100)}%` } })),
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
export function toast(text, onClick) {
  toastQueue.push({ text, onClick });
  if (!toastBusy) nextToast();
}
function nextToast() {
  const item = toastQueue.shift();
  if (!item) { toastBusy = false; return; }
  toastBusy = true;
  const el = h("div", { class: "toast", role: "status", onclick: () => { item.onClick && item.onClick(); } }, item.text);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => { el.remove(); nextToast(); }, 250);
  }, CONFIG.TOAST_MS);
}

// 기록 이벤트 → 토스트 문구(T-01~T-04)
export function eventToastText(ev) {
  if (ev.type === "badge") return t("T-01", { "배지 이름": BADGE_COPY[badgeCopyId(ev.id)].name });
  if (ev.type === "day") return t("T-02", { d: ev.streak });
  if (ev.type === "level") return t("T-03", { n: ev.level });
  if (ev.type === "stage") return t("T-04", { n: ev.stage });
  return "";
}
export const badgeCopyId = (id) => BADGES.find((b) => b.id === id).copy;

// "시험용" 표시
export const trialTag = () => h("span", { class: "tag-trial" }, t("L-03"));

export { go };
