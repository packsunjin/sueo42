// [S2 검색] 42개 단어를 입력할 때마다 거르고(단어·사전 표제어), 단계 칩으로 좁힌다. 줄을 누르면 단어 상세.
import { h } from "../util.js";
import { t } from "../copy.js";
import { header, go } from "../ui.js";
import { allWords, filterWords, stageNumbers } from "../data/words.js";
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
      ...stageNumbers().map((n) => chip(t("C-14", { n }), memo.stage === n, () => { memo.stage = n; drawChips(); draw(); })));
  }

  function draw() {
    const found = filterWords(allWords(), memo.query, memo.stage);
    count.textContent = t("S-05", { n: found.length });
    const s = getState();
    list.replaceChildren(...(found.length
      ? found.map((w) => h("li", {},
          h("button", { class: "word-row", onclick: () => go(`/word/${w.no}`) },
            h("span", { class: "word-name" }, w.name),
            h("span", { class: "muted" }, t("C-14", { n: w.stage })),
            isTried(s, w.no) ? h("span", { class: "dot", "aria-hidden": "true" }) : null)))
      : [h("li", { class: "empty" }, t("S-04"))]));
  }

  drawChips();
  draw();
  el.append(h("section", {}, header(t("S-01")), input, chips, count, list));
}

function chip(label, on, onclick) {
  return h("button", { class: `chip ${on ? "on" : ""}`, "aria-pressed": on ? "true" : "false", onclick }, label);
}
