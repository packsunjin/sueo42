// [S9 직접 해보기: 단어 고르기] 단계 1~7 접는 목록(이어서 할 단계 또는 ?stage=n 이 펼쳐짐), 단어를 누르면 #/lab/word/번호 로. 연습 화면(S10~S15)은 lab.js.
import { h } from "../util.js";
import { t } from "../copy.js";
import { header, trialTag, go } from "../ui.js";
import { isTrialModel } from "../../config.js";
import { allWords, wordsOfStage, stageNumbers } from "../data/words.js";
import { getState } from "../store.js";
import { continueStage, isTried, stageTried, stageDone } from "../game/progress.js";

export { renderLabWord } from "./lab.js";

export function renderLabPick(el, { query = {} } = {}) {
  const s = getState(), words = allWords();
  const open = Number(query.stage) || continueStage(s, words);
  el.append(h("section", { class: "lab-pick" },
    header(t("L-01")),
    h("p", {}, t("L-02")),
    isTrialModel() ? h("p", { class: "trial-line" }, trialTag(), " ", h("span", { class: "muted small" }, t("L-04"))) : null,
    stageNumbers().map((n) => h("details", { class: "card stage-fold", open: n === open },
      h("summary", { class: "row-between" },
        h("strong", {}, t("C-14", { n })),
        h("span", { class: "muted small" }, t("C-15", { k: stageTried(s, words, n) }),
          stageDone(s, words, n) ? [" ", h("span", { class: "tag-done" }, t("C-16"))] : null)),
      h("div", { class: "word-grid" }, wordsOfStage(n).map((w) =>
        h("button", { class: "word-card", onclick: () => go(`/lab/word/${w.no}`) },
          h("span", {}, w.name),
          isTried(s, w.no) ? h("span", { class: "dot", "aria-hidden": "true" }) : null)))))));
}
