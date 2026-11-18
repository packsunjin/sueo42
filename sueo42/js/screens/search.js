// [S2 검색] 42개 단어를 입력할 때마다 거르고(단어·사전 표제어), 단계 칩으로 좁힌다. 줄을 누르면 단어 상세.
import { h } from "../util.js";
import { t } from "../copy.js";
import { header, go, icon } from "../ui.js";
import { allWords, filterWords, stageNumbers, thumbOf } from "../data/words.js";
import { getState } from "../store.js";
import { isTried } from "../game/progress.js";

// 다른 화면에 다녀와도 입력·칩이 남게 이 화면 밖에 둔다
const memo = { query: "", stage: null };

export function renderSearch(el) {
  const list = h("ul", { class: "word-list" });
  const count = h("p", { class: "muted count" });
  const input = h("input", { type: "search", class: "search-input", placeholder: t("S-02"),
    value: memo.query, "aria-label": t("S-01"), oninput: (e) => { memo.query = e.target.value; draw(); } });
  const chips = h("div", { class: "chips", role: "group" });

  function drawChips() {
    chips.replaceChildren(
      chip(t("S-03"), memo.stage == null, () => { memo.stage = null; drawChips(); draw(); }),
      ...stageNumbers().map((n) => chip(t("C-14", { n }), memo.stage === n, () => { memo.stage = n; drawChips(); draw(); }, n)));
  }

  function draw() {
    const found = filterWords(allWords(), memo.query, memo.stage);
    count.textContent = t("S-05", { n: found.length });
    const s = getState();
    list.replaceChildren(...(found.length
      ? found.map((w) => h("li", {},
          h("button", { class: "word-row", "data-stage": w.stage, onclick: () => go(`/word/${w.no}`) },
            rowThumb(w),
            h("span", { class: "word-meta" },
              h("span", { class: "word-name" }, w.name),
              h("small", { "aria-hidden": "true" }, t("C-14", { n: w.stage }))),
            h("span", { class: "sr-only" }, t("C-14", { n: w.stage })),
            isTried(s, w.no) ? h("span", { class: "tried-mark", "aria-hidden": "true" }, icon("check", { stroke: 3 })) : null)))
      : [h("li", { class: "empty" }, t("S-04"))]));
  }

  drawChips();
  draw();
  el.append(h("section", { class: "search" }, header(t("S-01")),
    h("label", { class: "search-field" }, icon("search", { stroke: 2.2 }), input), chips, count, list));
}

function chip(label, on, onclick, stage) {
  return h("button", { class: `chip ${on ? "on" : ""}`, "aria-pressed": on ? "true" : "false", onclick, "data-stage": stage ?? undefined }, label);
}

// 사전 영상의 작은 그림(사전 사이트가 주는 그대로). 못 불러오면 자리만 남김
function rowThumb(w) {
  const src = thumbOf(w);
  if (!src) return null;
  const img = h("img", { class: "row-thumb", src, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.classList.add("broken"), { once: true });
  return img;
}
