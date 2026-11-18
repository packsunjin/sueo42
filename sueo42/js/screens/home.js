// [S1 홈] (11/18 레이아웃 다시) 오늘 상태 → 직접 해보기 카드(왼쪽 글·버튼, 오른쪽 다음에 할 단어의 사전 그림)
// → 단계별로 배우기(2칸 격자: 단계 색 칸마다 단어 그림 3장·진행 막대, 잠금 없음) → 바로 가기(검색·뜻 맞히기·랭킹·내 기록).
// 단계 칸을 누르면 아래에서 올라오는 창에 그 단계 단어 6개와 [뜻 맞히기]·[직접 해보기]. 상태는 참여(해 본 단어)만 본다.
// 단어 그림은 국립국어원 한국수어사전이 주는 작은 그림을 바꾸지 않고 그대로 쓰고, 출처 줄(C-19)을 붙인다.
import { h, localDate } from "../util.js";
import { t, btn } from "../copy.js";
import { button, go, trialTag, openModal, icon } from "../ui.js";
import { getState } from "../store.js";
import { allWords, wordsOfStage, stageNumbers, thumbOf } from "../data/words.js";
import { continueStage, stageTried, stageDone, isTried, learnedToday, streak, levelInfo, BADGES } from "../game/progress.js";
import { startQuiz } from "./quiz.js";
import { isTrialModel } from "../../config.js";

// 그림 하나(못 불러오면 그 자리를 비워 둠)
function thumb(w, cls = "thumb") {
  const src = thumbOf(w);
  if (!src) return null;
  const img = h("img", { class: cls, src, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.classList.add("broken"), { once: true });
  return img;
}

export function renderHome(el) {
  const s = getState(), words = allWords(), today = localDate();
  const next = continueStage(s, words);
  const nextWord = wordsOfStage(next).find((w) => !isTried(s, w.no)) || wordsOfStage(next)[0];
  const lit = learnedToday(s, today), d = streak(s, today);
  const badges = BADGES.filter((b) => s.badges[b.id]).length;

  el.append(h("section", { class: "home" },
    h("div", { class: `today ${lit ? "lit" : ""}` },
      h("span", { class: "today-icon", "aria-hidden": "true" }, icon("flame", { stroke: 1.8, fill: lit ? "currentColor" : "none" })),
      h("p", { class: "today-status" }, lit ? t("H-11", { d }) : t("H-10"))),

    // 직접 해보기: 글과 버튼 + 다음에 할 단어의 사전 그림
    h("div", { class: "card card-hero hero-split" },
      h("div", { class: "hero-text" },
        isTrialModel() ? trialTag() : null,
        h("h2", {}, t("H-03")),
        h("p", {}, t("H-04")),
        button(btn("H-05"), () => go("/lab"), { kind: "primary", cls: "btn-big" })),
      nextWord ? h("button", { class: "hero-word", onclick: () => go(`/lab/word/${nextWord.no}`), "aria-label": t("H-14", { "단어": nextWord.name }) },
        thumb(nextWord, "hero-thumb"),
        h("span", { class: "hero-word-name" }, t("H-14", { "단어": nextWord.name }))) : null),

    // 단계별로 배우기: 2칸 격자
    h("div", { class: "section-head" }, h("h2", {}, t("H-12"))),
    h("ul", { class: "stage-grid" }, stageNumbers().map((n) => {
      const ws = wordsOfStage(n);
      const k = stageTried(s, words, n);
      const done = stageDone(s, words, n);
      return h("li", { "data-stage": n },
        h("button", { class: `stage-tile ${n === next ? "is-next" : ""}`, onclick: () => openStageSheet(n),
          "aria-label": `${t("C-14", { n })}, ${done ? t("C-16") : t("C-15", { k })}` },
          h("span", { class: "tile-top" },
            h("strong", {}, t("C-14", { n })),
            done ? h("span", { class: "tile-done", "aria-hidden": "true" }, icon("check", { stroke: 3 }))
              : n === next ? h("span", { class: "tile-next" }, t("H-06")) : null),
          h("span", { class: "tile-thumbs", "aria-hidden": "true" }, ws.map((w, i) => i < 3 ? thumb(w) : thumb(w, "thumb more"))),
          h("span", { class: "tile-words" }, ws.map((w) => w.name).join(" · ")),
          h("span", { class: "mini-bar", "aria-hidden": "true" }, h("span", { style: { width: `${(k / 6) * 100}%` } })),
          h("span", { class: "tile-count" }, done ? t("C-16") : t("C-15", { k }))));
    })),
    h("p", { class: "source" }, t("C-19")),

    // 바로 가기
    h("div", { class: "section-head" }, h("h2", {}, t("H-13"))),
    h("div", { class: "quick-grid" },
      quick("search", t("C-03"), t("H-08"), () => go("/search")),
      quick("quiz", t("C-04"), t("H-09"), () => go("/quiz")),
      quick("medal", btn("Q-03"), t("R-10", { k: badges }), () => go("/ranking")),
      quick("chart", t("C-06"), t("R-02", { n: levelInfo(s).level }), () => go("/records")))));
}

function quick(ic, title, sub, onclick) {
  return h("button", { class: "quick", onclick },
    h("span", { class: "quick-icon", "aria-hidden": "true" }, icon(ic)),
    h("strong", {}, title),
    h("span", { class: "muted small" }, sub));
}

// 단계 창: C-14 단계 n, 단어 6개(사전 그림과 함께), C-15 해 본 단어 k/6, [뜻 맞히기](C-04) [직접 해보기](C-05)
function openStageSheet(n) {
  const s = getState(), words = allWords();
  const m = openModal(h("div", { class: "stage-sheet", "data-stage": n },
    h("div", { class: "row-between" },
      h("h2", {}, t("C-14", { n })),
      stageDone(s, words, n) ? h("span", { class: "tag-done" }, t("C-16")) : null),
    stageDone(s, words, n) ? null : h("p", { class: "muted" }, t("C-15", { k: stageTried(s, words, n) })),
    h("ul", { class: "sheet-words" }, wordsOfStage(n).map((w) =>
      h("li", { class: isTried(s, w.no) ? "tried" : "" },
        h("button", { onclick: () => { m.close(); go(`/word/${w.no}`); } },
          thumb(w),
          h("span", {}, isTried(s, w.no) ? icon("check", { stroke: 3 }) : null, w.name))))),
    h("p", { class: "source" }, t("C-19")),
    h("div", { class: "btn-col" },
      button(t("C-04"), () => { m.close(); startQuiz(n); }, { kind: "primary" }),
      button(t("C-05"), () => { m.close(); go(`/lab?stage=${n}`); }, { kind: "secondary" }))), { sheet: true });
}
