// [S1 홈] (11/19 다시 짬, 사장: 듀오링고 같은 구성) 오늘의 목표(고리) + 연속 학습 → 단계마다 초록 배너(단계 n · 단어 · 진행 · [뜻 맞히기])
// → 그 단계 단어 6개가 굽이치는 동그라미 길(동그라미 안에 그 단어의 사전 그림, 해 본 단어는 체크, 다음 단어는 '여기서부터')
// → 길 옆 빈자리에 로고 그림. 동그라미를 누르면 아래에서 올라오는 창에 [이 단어 직접 해보기]·[이 단계 뜻 맞히기]·[자세히 보기].
// 단어 6개 다음 길 끝에 '마무리 문장'(그 단계 단어로 만든 문장 → 문장 만들기, 11/27).
// 잠금 없음. 상태는 참여(해 본 단어)만 본다. 사전 그림은 국립국어원 한국수어사전 것을 그대로 쓰고 출처 줄(C-19)을 붙인다.
import { h, localDate } from "../util.js";
import { t, btn } from "../copy.js";
import { button, go, trialTag, openModal, icon, signThumb } from "../ui.js";
import { getState } from "../store.js";
import { allWords, wordsOfStage, stageNumbers } from "../data/words.js";
import { stageTried, stageDone, isTried, learnedToday, streak, dailyPoints, wordStars } from "../game/progress.js";
import { startQuiz } from "./quiz.js";
import { stageSentence } from "../data/sentences.js";
import { isTrialModel, CONFIG } from "../../config.js";

// 길에서 동그라미가 좌우로 놓이는 자리(단어 6개, 단계마다 같은 굽이)
const OFFSETS = [0, 46, 70, 46, 0, -46];

export function renderHome(el) {
  const s = getState(), words = allWords(), today = localDate();
  const lit = learnedToday(s, today), d = streak(s, today);
  // '여기서부터' 말풍선: 앞 단계부터 보며 안 해 본 단어, 단계 단어를 다 했으면 그 단계 마무리 문장(11/27)
  let nextWord = null, nextFinal = null;
  for (const n of stageNumbers()) {
    const w = wordsOfStage(n).find((x) => !isTried(s, x.no));
    if (w) { nextWord = w; break; }
    const sen = stageSentence(n);
    if (sen && !(s.sentences && s.sentences[sen.id])) { nextFinal = n; break; }
  }

  el.append(h("section", { class: "home" },
    goalCard(dailyPoints(s, today), lit, d),

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
            h("span", { class: "wp-label", "aria-hidden": "true" }, w.name),
            starRow(wordStars(s, w.no)));
        }), finalStep(s, n, ws.length, nextFinal === n)),
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

// (11/19) 오늘의 목표 카드: 고리(오늘 한 만큼) + 목표 숫자 + 연속 학습 한 줄. 맞고 틀림은 안 봄(뜻 맞히기 1문제 1, 직접 해보기 1번 2)
function goalCard(pts, lit, d) {
  const n = CONFIG.DAILY_GOAL, k = Math.min(pts, n), done = pts >= n;
  const R = 26, C = 2 * Math.PI * R;
  const ring = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${R}" class="ring-bg"/>` +
    `<circle cx="32" cy="32" r="${R}" class="ring-fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - k / n)).toFixed(1)}"/></svg>`;
  const ringEl = h("span", { class: "goal-ring" });
  ringEl.innerHTML = ring;
  ringEl.append(h("span", { class: "goal-ring-icon" }, done ? icon("check", { stroke: 3 }) : icon("target", { stroke: 2.2 })));
  return h("div", { class: `goal-card ${done ? "done" : ""}` },
    ringEl,
    h("div", { class: "goal-text" },
      h("p", { class: "goal-title" }, h("strong", {}, t("H-16")), h("span", { class: "goal-num" }, done ? t("H-18") : t("H-17", { k, n }))),
      h("p", { class: "muted small" }, t("H-19")),
      h("p", { class: `goal-streak ${lit ? "lit" : ""}` }, icon("flame", { stroke: 1.8, fill: lit ? "currentColor" : "none" }), lit ? t("H-11", { d }) : t("H-10"))));
}

// (11/27 사장 제안) 단계 끝 '마무리 문장' 동그라미: 그 단계 단어로 만든 문장 → 문장 만들기. 잠금 없음, 끝까지 만들면 체크(참여 기록)
function finalStep(s, n, i, isNext) {
  const sen = stageSentence(n);
  if (!sen) return null;
  const done = !!(s.sentences && s.sentences[sen.id]);
  return h("li", { class: `wp-step wp-final-step ${isNext ? "has-bubble" : ""}`, style: { "--x": `${OFFSETS[i % OFFSETS.length]}px` } },
    isNext ? h("span", { class: "bubble" }, t("H-23")) : null,
    h("button", { class: `wp-node wp-final ${done ? "done" : ""} ${isNext ? "next" : ""}`, onclick: () => go(`/lab/sentence/${sen.id}`),
      "aria-label": t("H-22", { n, "문장": sen.text }) + (done ? `, ${t("C-16")}` : "") },
      h("span", { class: "wp-final-icon", "aria-hidden": "true" }, icon("chat", { stroke: 2.2 })),
      done ? h("span", { class: "wp-check", "aria-hidden": "true" }, icon("check", { stroke: 3.2 })) : null),
    h("span", { class: "wp-label", "aria-hidden": "true" }, t("H-21")),
    h("span", { class: "wp-final-text", "aria-hidden": "true" }, sen.text));
}

// 단어 별 1~3개(그 단어를 해 본 횟수 1·3·5번). 0개면 빈 별 세 개
function starRow(k) {
  return h("span", { class: "wp-stars", "aria-label": t("H-20", { k }) },
    [0, 1, 2].map((i) => h("span", { class: i < k ? "on" : "" }, icon("star", { stroke: 1.6, fill: i < k ? "currentColor" : "none" }))));
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
