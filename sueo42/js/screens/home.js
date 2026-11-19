// [S1 홈] (11/19 다시 짬, 사장: 듀오링고 같은 구성) 오늘 상태 → 단계마다 초록 배너(단계 n · 단어 · 진행 · [뜻 맞히기])
// → 그 단계 단어 6개가 굽이치는 동그라미 길(동그라미 안에 그 단어의 사전 그림, 해 본 단어는 체크, 다음 단어는 '여기서부터')
// → 길 옆 빈자리에 로고 그림. 동그라미를 누르면 아래에서 올라오는 창에 [이 단어 직접 해보기]·[이 단계 뜻 맞히기]·[자세히 보기].
// 잠금 없음. 상태는 참여(해 본 단어)만 본다. 사전 그림은 국립국어원 한국수어사전 것을 그대로 쓰고 출처 줄(C-19)을 붙인다.
import { h, localDate } from "../util.js";
import { t, btn } from "../copy.js";
import { button, go, trialTag, openModal, icon, signThumb } from "../ui.js";
import { getState } from "../store.js";
import { allWords, wordsOfStage, stageNumbers } from "../data/words.js";
import { stageTried, stageDone, isTried, learnedToday, streak } from "../game/progress.js";
import { startQuiz } from "./quiz.js";
import { isTrialModel } from "../../config.js";

// 길에서 동그라미가 좌우로 놓이는 자리(단어 6개, 단계마다 같은 굽이)
const OFFSETS = [0, 46, 70, 46, 0, -46];

export function renderHome(el) {
  const s = getState(), words = allWords(), today = localDate();
  const lit = learnedToday(s, today), d = streak(s, today);
  const nextWord = words.find((w) => !isTried(s, w.no)) || null;

  el.append(h("section", { class: "home" },
    h("div", { class: `today ${lit ? "lit" : ""}` },
      h("span", { class: "today-icon", "aria-hidden": "true" }, icon("flame", { stroke: 1.8, fill: lit ? "currentColor" : "none" })),
      h("p", { class: "today-status" }, lit ? t("H-11", { d }) : t("H-10"))),

    h("div", { class: "lab-banner" },
      h("div", {},
        isTrialModel() ? trialTag() : null,
        h("h2", {}, t("H-03")),
        h("p", {}, t("H-04"))),
      button(btn("H-05"), () => go("/lab"), { kind: "light" })),

    stageNumbers().map((n, si) => {
      const ws = wordsOfStage(n);
      const k = stageTried(s, words, n);
      const done = stageDone(s, words, n);
      return h("section", { class: "unit", "data-stage": n },
        h("header", { class: "unit-banner" },
          h("div", { class: "unit-text" },
            h("span", { class: "unit-label" }, t("C-14", { n })),
            h("strong", { class: "unit-title" }, ws.slice(0, 3).map((w) => w.name).join(" · ") + (ws.length > 3 ? " …" : "")),
            h("span", { class: "unit-progress" }, done ? t("C-16") : t("C-15", { k }))),
          button(t("C-04"), () => startQuiz(n), { kind: "light", cls: "unit-btn" })),
        h("ol", { class: "word-path" }, ws.map((w, i) => {
          const tried = isTried(s, w.no);
          const isNext = nextWord && nextWord.no === w.no;
          return h("li", { class: `wp-step ${isNext ? "has-bubble" : ""}`, style: { "--x": `${OFFSETS[i % OFFSETS.length]}px` } },
            isNext ? h("span", { class: "bubble" }, t("H-06")) : null,
            h("button", { class: `wp-node ${tried ? "done" : ""} ${isNext ? "next" : ""}`, onclick: () => openWordSheet(w),
              "aria-label": `${w.name}${tried ? `, ${t("C-16")}` : ""}` },
              signThumb(w, "wp-img"),
              tried ? h("span", { class: "wp-check", "aria-hidden": "true" }, icon("check", { stroke: 3.2 })) : null),
            h("span", { class: "wp-label", "aria-hidden": "true" }, w.name));
        })),
        // 길 옆 빈자리 그림(단계마다 반대쪽)
        h("img", { class: `path-art ${si % 2 ? "left" : "right"}`, src: "img/bubbles.svg", alt: "", "aria-hidden": "true" }));
    }),
    h("p", { class: "source" }, t("C-19")),

    h("div", { class: "card-pair" },
      h("button", { class: "card card-small", onclick: () => go("/search") },
        h("span", { class: "card-icon" }, icon("search")),
        h("strong", {}, t("C-03")), h("span", { class: "muted" }, t("H-08"))),
      h("button", { class: "card card-small", onclick: () => go("/quiz") },
        h("span", { class: "card-icon" }, icon("quiz")),
        h("strong", {}, t("C-04")), h("span", { class: "muted" }, t("H-09"))))));
}

// 단어 창: 사전 그림 + 이름 + [이 단어 직접 해보기] [이 단계 뜻 맞히기] [자세히 보기]
function openWordSheet(w) {
  const s = getState();
  const m = openModal(h("div", { class: "word-sheet", "data-stage": w.stage },
    h("div", { class: "ws-head" },
      signThumb(w, "ws-img"),
      h("div", {},
        h("span", { class: "unit-label" }, t("C-14", { n: w.stage })),
        h("h2", {}, w.name),
        isTried(s, w.no) ? h("span", { class: "tag-done" }, t("C-16")) : null)),
    h("p", { class: "source" }, t("C-19")),
    h("div", { class: "btn-col" },
      button(btn("S-09"), () => { m.close(); go(`/lab/word/${w.no}`); }, { kind: "primary" }),
      button(btn("S-10"), () => { m.close(); startQuiz(w.stage); }, { kind: "secondary" }),
      button(t("H-15"), () => { m.close(); go(`/word/${w.no}`); }, { kind: "secondary" }))), { sheet: true });
}
