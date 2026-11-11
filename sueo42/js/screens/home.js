// [S1 홈] 오늘 학습 상태, 직접 해보기 큰 카드, 이어서 할 단계, 검색·뜻 맞히기 작은 카드.
import { h, localDate } from "../util.js";
import { t, btn, splitButton } from "../copy.js";
import { button, go, trialTag } from "../ui.js";
import { getState } from "../store.js";
import { allWords } from "../data/words.js";
import { continueStage, stageTried, learnedToday, streak } from "../game/progress.js";
import { isTrialModel } from "../../config.js";

export function renderHome(el) {
  const s = getState(), words = allWords(), today = localDate();
  const stage = continueStage(s, words);
  const k = stageTried(s, words, stage);
  const h07 = splitButton("H-07", { k });

  el.append(h("section", { class: "home" },
    h("p", { class: "today-status" },
      learnedToday(s, today) ? t("H-11", { d: streak(s, today) }) : t("H-10")),

    h("div", { class: "card card-hero" },
      isTrialModel() ? trialTag() : null,
      h("h2", {}, t("H-03")),
      h("p", {}, t("H-04")),
      button(btn("H-05"), () => go("/lab"), { kind: "primary", cls: "btn-big" })),

    h("div", { class: "card card-continue" },
      h("h3", {}, t("H-06", { n: stage })),
      h("div", { class: "row-between" },
        h("span", { class: "muted" }, h07.text),
        button(h07.button,() => go(`/lab?stage=${stage}`), { kind: "secondary" }))),

    h("div", { class: "card-pair" },
      h("button", { class: "card card-small", onclick: () => go("/search") },
        h("strong", {}, t("C-03")), h("span", { class: "muted" }, t("H-08"))),
      h("button", { class: "card card-small", onclick: () => go("/quiz") },
        h("strong", {}, t("C-04")), h("span", { class: "muted" }, t("H-09"))))));
}
