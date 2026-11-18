// [S1 홈] 오늘 학습 상태 + 참여 숫자 3칸(연속·레벨·해 본 단어) → 직접 해보기 큰 카드 → 학습 길(단계 1~7, 단계마다 색,
// 동그라미 둘레 고리 = 해 본 단어 k/6, 잠금 없음) → 검색·뜻 맞히기 작은 카드.
// 동그라미를 누르면 아래에서 올라오는 창에 그 단계 단어 6개와 [뜻 맞히기]·[직접 해보기]. 상태는 참여(해 본 단어)만 본다.
import { h, localDate } from "../util.js";
import { t, btn } from "../copy.js";
import { button, go, trialTag, openModal, icon } from "../ui.js";
import { getState } from "../store.js";
import { allWords, wordsOfStage, stageNumbers } from "../data/words.js";
import { continueStage, stageTried, stageDone, isTried, learnedToday, streak, levelInfo, triedCount } from "../game/progress.js";
import { startQuiz } from "./quiz.js";
import { isTrialModel } from "../../config.js";

export function renderHome(el) {
  const s = getState(), words = allWords(), today = localDate();
  const next = continueStage(s, words);

  const lit = learnedToday(s, today), d = streak(s, today);

  el.append(h("section", { class: "home" },
    h("div", { class: `today ${lit ? "lit" : ""}` },
      h("span", { class: "today-icon", "aria-hidden": "true" }, icon("flame", { stroke: 1.8, fill: lit ? "currentColor" : "none" })),
      h("p", { class: "today-status" }, lit ? t("H-11", { d }) : t("H-10"))),

    h("ul", { class: "stats" },
      h("li", { class: "stat s-flame" }, icon("flame", { stroke: 1.8, fill: "currentColor" }), h("span", {}, t("R-06", { d }))),
      h("li", { class: "stat s-level" }, icon("up", { stroke: 2.4 }), h("span", {}, t("R-02", { n: levelInfo(s).level }))),
      h("li", { class: "stat s-words" }, icon("check", { stroke: 2.6 }), h("span", {}, t("R-08", { k: triedCount(s, words) })))),

    h("div", { class: "card card-hero" },
      h("span", { class: "hero-deco", "aria-hidden": "true" }, icon("camera", { stroke: 1.6 })),
      isTrialModel() ? trialTag() : null,
      h("span", { class: "hero-kicker", "aria-hidden": "true" }, icon("camera", { stroke: 2 })),
      h("h2", {}, t("H-03")),
      h("p", {}, t("H-04")),
      button(btn("H-05"), () => go("/lab"), { kind: "primary", cls: "btn-big" })),

    h("ol", { class: "path" }, stageNumbers().map((n) => {
      const done = stageDone(s, words, n);
      const isNext = n === next;
      const k = stageTried(s, words, n);
      const state = done ? "done" : isNext ? "next" : "rest";
      return h("li", { class: `path-step ${isNext ? "has-bubble" : ""}`, "data-stage": n },
        isNext ? h("span", { class: "bubble" }, t("H-06", { n })) : null,
        h("span", { class: "node-ring", style: { "--p": k / 6 } },
          h("button", { class: `node ${state}`, onclick: () => openStageSheet(n),
            "aria-label": `${t("C-14", { n })}, ${t("C-15", { k })}${done ? `, ${t("C-16")}` : ""}` },
            done ? icon("check", { stroke: 3.2 }) : String(n))),
        h("span", { class: "node-label", "aria-hidden": "true" },
          h("strong", {}, t("C-14", { n })), h("span", {}, t("C-15", { k }))));
    })),

    h("div", { class: "card-pair" },
      h("button", { class: "card card-small", onclick: () => go("/search") },
        h("span", { class: "card-icon" }, icon("search")),
        h("strong", {}, t("C-03")), h("span", { class: "muted" }, t("H-08"))),
      h("button", { class: "card card-small", onclick: () => go("/quiz") },
        h("span", { class: "card-icon" }, icon("quiz")),
        h("strong", {}, t("C-04")), h("span", { class: "muted" }, t("H-09"))))));
}

// 단계 창: C-14 단계 n, 단어 6개, C-15 해 본 단어 k/6, [뜻 맞히기](C-04) [직접 해보기](C-05)
function openStageSheet(n) {
  const s = getState(), words = allWords();
  const m = openModal(h("div", { class: "stage-sheet", "data-stage": n },
    h("div", { class: "row-between" },
      h("h2", {}, t("C-14", { n })),
      stageDone(s, words, n) ? h("span", { class: "tag-done" }, t("C-16")) : null),
    h("p", { class: "muted" }, t("C-15", { k: stageTried(s, words, n) })),
    h("ul", { class: "stage-sheet-words" }, wordsOfStage(n).map((w) =>
      isTried(s, w.no) ? h("li", { class: "tried" }, icon("check", { stroke: 3 }), w.name) : h("li", {}, w.name))),
    h("div", { class: "btn-col" },
      button(t("C-04"), () => { m.close(); startQuiz(n); }, { kind: "primary" }),
      button(t("C-05"), () => { m.close(); go(`/lab?stage=${n}`); }, { kind: "secondary" }))), { sheet: true });
}
