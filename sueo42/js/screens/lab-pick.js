// [S9 직접 해보기: 단어 고르기] 단계 1~7 접는 목록(이어서 할 단계 또는 ?stage=n 이 펼쳐짐), 단어를 누르면 #/lab/word/번호 로. 연습 화면(S10~S15)은 lab.js.
import { h } from "../util.js";
import { t, btn } from "../copy.js";
import { header, trialTag, go, signThumb, icon } from "../ui.js";
import { SENTENCES, CHANCE_PER_WORD } from "../data/sentences.js";
import { isTrialModel } from "../../config.js";
import { allWords, wordsOfStage, stageNumbers } from "../data/words.js";
import { getState } from "../store.js";
import { continueStage, isTried, stageTried, stageDone } from "../game/progress.js";

export { renderLabWord, renderLabSentence } from "./lab.js";

export function renderLabPick(el, { query = {} } = {}) {
  const s = getState(), words = allWords();
  const open = Number(query.stage) || continueStage(s, words);
  el.append(h("section", { class: "lab-pick" },
    header(t("L-01")),
    h("p", {}, t("L-02")),
    isTrialModel() ? h("p", { class: "trial-line" }, trialTag(), " ", h("span", { class: "muted small" }, t("L-04"))) : null,
    // (11/25) 문장 만들기로 가는 카드
    h("button", { class: "card sentence-entry", type: "button", onclick: () => go("/lab/sentence") },
      h("span", { class: "sentence-entry-icon", "aria-hidden": "true" }, icon("chat", { stroke: 2.2 })),
      h("span", { class: "sentence-entry-text" }, h("strong", {}, btn("M-04")), h("small", {}, t("M-05"))),
      h("span", { class: "sentence-entry-go", "aria-hidden": "true" }, "›")),
    stageNumbers().map((n) => h("details", { class: "card stage-fold", "data-stage": n, open: n === open },
      h("summary", { class: "row-between" },
        h("strong", {}, t("C-14", { n })),
        stageDone(s, words, n) ? h("span", { class: "tag-done" }, t("C-16"))
          : h("span", { class: "muted small" }, t("C-15", { k: stageTried(s, words, n) }))),
      h("div", { class: "word-grid" }, wordsOfStage(n).map((w) =>
        h("button", { class: "word-card", onclick: () => go(`/lab/word/${w.no}`) },
          signThumb(w),
          h("span", {}, w.name),
          isTried(s, w.no) ? h("span", { class: "dot", "aria-hidden": "true" }) : null))))),
    h("p", { class: "source" }, t("C-19"))));
}

// (11/25) 문장 만들기: 예시 문장 고르기 #/lab/sentence
export function renderSentencePick(el) {
  el.append(h("section", { class: "lab-pick sentence-pick" },
    header(t("M-01"), { onBack: () => go("/lab") }),
    h("p", {}, t("M-02")),
    h("p", { class: "muted small" }, t("M-19")),
    h("ul", { class: "sentence-list" }, SENTENCES.map((s) => h("li", {},
      h("button", { class: "card sentence-card", type: "button", onclick: () => go(`/lab/sentence/${s.id}`) },
        h("strong", { class: "sentence-text" }, s.text),
        h("span", { class: "sentence-words" }, s.parts.map((p) => h("span", { class: p.word ? "w" : "glue" }, p.word || p.glue))),
        h("small", { class: "muted" }, t("M-03", { k: s.words.length, c: s.words.length * CHANCE_PER_WORD })))))),
    h("p", { class: "muted small" }, t("M-16")),
    h("p", { class: "source" }, t("C-19"))));
}
