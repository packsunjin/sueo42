// [뜻 맞히기] S4 단계 고르기, S5·S5' 문제(2×2 보기)·아래에서 올라오는 결과 판(정답 초록 / 아니면 회색, 정답 옆 사전 근거·출처), S6 한 판 결과, S7 별명 창, S8 랭킹.
// 점수·정답·랭킹은 이 기능에만 있다. 한 판 중에는 탭 바를 숨긴다(main.js HIDE_TABBAR).
import { h, shuffle, sample, charLen } from "../util.js";
import { t, btn, COPY } from "../copy.js";
import { header, button, dictVideo, sourceLine, dictLink, go, openModal, confirmModal, icon, signThumb, holdCelebrations } from "../ui.js";
import { CONFIG } from "../../config.js";
import { allWords, wordsOfStage, stageNumbers } from "../data/words.js";
import { getState, recordQuizAnswer, recordQuizRound, addRanking } from "../store.js";
import { stageTried, stageDone, sortRanking } from "../game/progress.js";
import { back } from "../router.js";

// 지금 하는 한 판(새로고침하면 사라짐 — 점수는 남지 않고 푼 문제 기록만 남는다)
let current = null;

// 문제 하나: 그 단어 + 나머지에서 무작위 3개, 보기 순서도 무작위
export function makeQuestion(word, all, rnd = Math.random) {
  const others = sample(all.filter((w) => w.no !== word.no), CONFIG.QUIZ_OPTIONS - 1, rnd);
  return { word, options: shuffle([word, ...others], rnd), chosen: null, skipped: false };
}

export function newRound(stage, all = allWords(), rnd = Math.random) {
  const ws = shuffle(all.filter((w) => w.stage === Number(stage)), rnd).slice(0, CONFIG.QUIZ_QUESTIONS);
  return { stage: Number(stage), items: ws.map((w) => makeQuestion(w, all, rnd)), index: 0, score: 0,
    combo: 0, bestCombo: 0, done: false, isBest: false, uploadedAt: null };
}

export const correctCount = (round) => round.items.filter((q) => q.chosen === q.word.no).length;

// (11/24) 틀린 문제만 다시: 결과 화면에서 틀린 단어로 짧은 판. 랭킹·최고 점수·판 수에는 넣지 않음(일부 단어만이라).
// 고른 답은 그대로 단어 기록(별·오늘의 목표)에 들어감
export const missedWords = (round) => round.items.filter((q) => !q.skipped && q.chosen !== null && q.chosen !== q.word.no).map((q) => q.word);
export function startReview(round, all = allWords(), rnd = Math.random) {
  const ws = missedWords(round);
  if (!ws.length) return;
  current = { stage: round.stage, items: shuffle(ws, rnd).map((w) => makeQuestion(w, all, rnd)), index: 0, score: 0,
    combo: 0, bestCombo: 0, done: false, isBest: false, uploadedAt: null, review: true };
  // 같은 주소(결과 화면)면 라우터가 다시 그리지 않으므로 직접 그림
  if (location.hash === `#/quiz/play/${round.stage}`) { const el = document.getElementById("app"); if (el) rerender(el); }
  else go(`/quiz/play/${round.stage}`);
}

// 단계 카드·단어 상세의 [이 단계 뜻 맞히기]·[한 판 더] 에서 부름: 새 판을 만들고 문제 화면으로
export function startQuiz(stage) {
  current = newRound(stage);
  go(`/quiz/play/${stage}`);
}

// ── S4 단계 고르기 ──
export function renderQuizHome(el) {
  const s = getState(), words = allWords();
  el.append(h("section", { class: "quiz-home" },
    header(t("Q-01")),
    h("p", { class: "muted" }, t("Q-02")),
    h("div", { class: "stage-list" }, stageNumbers().map((n) => {
      const ws = wordsOfStage(n);
      const best = s.best[n];
      const k = stageTried(s, words, n);
      return h("button", { class: "card stage-card", "data-stage": n, onclick: () => startQuiz(n) },
        h("span", { class: "stage-badge big", "aria-hidden": "true" }, String(n)),
        h("span", { class: "stage-body" },
          h("span", { class: "row-between" },
            h("strong", {}, t("C-14", { n })),
            stageDone(s, words, n) ? h("span", { class: "tag-done" }, t("C-16")) : null),
          h("span", { class: "stage-words" }, ws.map((w) => w.name).join(" · ")),
          h("span", { class: "thumb-strip", "aria-hidden": "true" }, ws.map((w) => signThumb(w))),
          h("span", { class: "mini-bar", "aria-hidden": "true" }, h("span", { style: { width: `${(k / 6) * 100}%` } })),
          h("span", { class: "row-between muted small" },
            stageDone(s, words, n) ? h("span", {}) : h("span", {}, t("C-15", { k })),
            best !== undefined ? h("span", { class: "pill pill-gold" }, t("S4-최고", { s: best })) : null)));
    })),
    h("p", { class: "source" }, t("C-19")),
    h("div", { class: "bottom-actions" }, button(btn("Q-03"), () => go("/ranking"), { kind: "secondary" }))));
}

// ── S5·S6 한 판 ──
export function renderQuizPlay(el, { stage }) {
  if (!current || current.stage !== Number(stage)) current = newRound(stage);
  if (!current.items.length) { go("/quiz"); return; }
  if (current.done) renderResult(el, current);
  else renderQuestion(el, current);
}

// (11/19) 연속 정답 보너스: QUIZ_COMBO_FROM 개째 연속 정답부터 한 문제에 QUIZ_COMBO_BONUS 점 더. 점수·정답은 뜻 맞히기에만(강연 규칙)
export function answerPoints(combo) {
  return CONFIG.QUIZ_POINTS_PER_ANSWER + (combo >= CONFIG.QUIZ_COMBO_FROM ? CONFIG.QUIZ_COMBO_BONUS : 0);
}

function renderQuestion(el, round) {
  holdCelebrations(true);   // 문제 푸는 동안 축하 화면은 결과 화면까지 미룸
  const q = round.items[round.index];
  const total = round.items.length;
  const scoreEl = h("span", { class: "pill score" }, t("Q-06", { s: round.score }));
  const comboEl = h("span", { class: "pill combo", hidden: round.combo < 2 },
    icon("flame", { stroke: 1.8, fill: "currentColor" }), t("Q-32", { c: round.combo }));
  const sourceSlot = h("div", {}, sourceLine(q.word, { hideHeadword: true }));
  const answerArea = h("div", { class: "answer-area" });
  const section = h("section", { class: "quiz-play" });
  const optionBtns = q.options.map((w) => h("button", { class: "option", disabled: true,
    onclick: () => choose(w) }, w.name));
  const optionsBox = h("div", { class: "options loading-dim" }, optionBtns);

  const video = dictVideo(q.word, {
    source: sourceSlot,
    onReady: () => { if (q.chosen === null) { optionsBox.classList.remove("loading-dim"); optionBtns.forEach((b) => (b.disabled = false)); } },
    extraError: button(btn("Q-30"), () => skip(), { kind: "secondary" }),
  });

  function choose(w) {
    if (q.chosen !== null) return;          // 한 번 고르면 바꿀 수 없음
    q.chosen = w.no;
    const right = w.no === q.word.no;
    let gained = 0;
    if (right) {
      round.combo += 1;
      round.bestCombo = Math.max(round.bestCombo, round.combo);
      gained = answerPoints(round.combo);
      round.score += gained;
    } else round.combo = 0;
    recordQuizAnswer(q.word.no);            // 정답이든 아니든 그 문제 단어 quiz +1
    scoreEl.textContent = t("Q-06", { s: round.score });
    comboEl.hidden = round.combo < 2;
    comboEl.lastChild.textContent = t("Q-32", { c: round.combo });
    if (right && round.combo >= 2) { comboEl.classList.remove("bump"); void comboEl.offsetWidth; comboEl.classList.add("bump"); }
    optionBtns.forEach((b, i) => {
      b.disabled = true;
      const o = q.options[i];
      if (o.no === q.word.no) b.classList.add("is-answer");
      else if (o.no === w.no) b.classList.add("is-chosen");
    });
    sourceSlot.replaceChildren(sourceLine(q.word, { link: false }));
    // 화면 아래에 고정된 결과 판: 정답이면 초록(Q-07), 아니면 회색(Q-08). 빨강·흔들림·X 표시 없음
    const kind = right ? "ok" : "primary";  // 정답 판은 초록 버튼, 회색 판은 주색 버튼
    const panel = h("div", { class: `answer-panel ${right ? "ok" : "neutral"}`, role: "status", "aria-live": "polite" },
      h("div", { class: "answer-panel-inner" },
        h("p", { class: "answer-msg" },
          right ? h("span", { class: "msg-icon" }, icon("check", { stroke: 3 })) : null,
          h("span", {}, !right ? t("Q-08", { "단어": q.word.name })
            : round.combo >= CONFIG.QUIZ_COMBO_FROM ? t("Q-33", { p: gained, c: round.combo }) : t("Q-07"))),
        evidenceBox(q.word),
        h("div", { class: "bottom-actions" }, round.index + 1 < total
          ? button(btn("Q-10"), () => next(), { kind })
          : button(btn("Q-11"), () => finish(), { kind }))));
    answerArea.replaceChildren(panel);
    // 판이 가린 만큼 아래 여백을 줘서 위 내용(영상·보기)을 끝까지 볼 수 있게
    requestAnimationFrame(() => { section.style.paddingBottom = `${panel.offsetHeight + 16}px`; });
  }

  function skip() {                          // 영상을 못 불러온 문제: 점수·기록 없이 넘어감
    q.skipped = true;
    if (round.index + 1 < total) next(); else finish();
  }
  function next() { round.index++; rerender(el); }
  function finish() {
    round.done = true;
    if (round.review) { rerender(el); return; }   // 다시 풀기 판은 랭킹·최고 점수·판 수에 안 넣음
    const prevBest = getState().best[round.stage];
    round.isBest = round.score > 0 && (prevBest === undefined || round.score > prevBest);
    recordQuizRound(round.stage, round.score);
    rerender(el);
  }

  const onBack = () => confirmModal(t("Q-27"), btn("Q-28"), btn("Q-29"), () => { current = null; go("/quiz"); });
  section.append(
    h("div", { class: "quiz-top" },
      h("button", { class: "btn-back", onclick: onBack, "aria-label": btn("C-09") }, icon("back", { stroke: 2.4 }), h("span", { class: "sr-only" }, btn("C-09"))),
      h("div", { class: "bar bar-thick", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": total, "aria-valuenow": round.index + 1 },
        h("span", { style: { width: `${((round.index + 1) / total) * 100}%` } })),
      comboEl,
      scoreEl),
    h("p", { class: "progress-text" }, t("Q-04", { i: round.index + 1, n: total })),
    h("h2", { class: "question" }, t("Q-05")),
    video,
    optionsBox,
    answerArea);
  el.append(section);
}

// 정답 옆 근거 상자 Q-09: 사전 표제어·수형 설명·출처·[사전에서 보기]
function evidenceBox(w) {
  return h("div", { class: "evidence" },
    h("h3", {}, t("Q-09", { "단어": w.name })),
    h("dl", { class: "facts" },
      h("dt", {}, t("S-06")), h("dd", {}, w.headword),
      h("dt", {}, t("S-07")), h("dd", {}, w.handshape)),
    h("p", { class: "source" }, t("C-12", { "사전 표제어": w.headword })),
    dictLink(w));
}

function renderResult(el, round) {
  const c = correctCount(round);
  queueMicrotask(() => holdCelebrations(false));   // 결과 화면을 그린 뒤 모아 둔 축하를 보여 줌
  const uploadBtn = round.review ? null : button(btn("Q-15"), () => openNicknameSheet(round), { kind: "primary", disabled: !!round.uploadedAt });
  const missed = missedWords(round);
  const reviewBtn = missed.length ? button(btn("Q-35"), () => startReview(round), { kind: round.review ? "primary" : "secondary" }) : null;
  el.append(h("section", { class: "quiz-result" },
    header(t("Q-01"), { onBack: () => go("/quiz") }),
    h("div", { class: `card result-card ${round.isBest ? "is-best" : ""}` },
      h("h2", {}, round.review ? t("Q-36") : t("Q-12")),
      h("p", { class: "result-score" }, round.review ? t("Q-37", { n: round.items.length, c }) : t("Q-13", { c, s: round.score })),
      round.bestCombo >= 2 ? h("p", { class: "result-combo" }, icon("flame", { stroke: 1.8, fill: "currentColor" }), t("Q-34", { c: round.bestCombo })) : null,
      round.isBest ? h("p", { class: "best" }, h("span", { class: "pill pill-gold" }, t("Q-14"))) : null),
    h("p", { class: "muted" }, t("Q-18")),
    h("ul", { class: "word-list" }, round.items.map((q) => h("li", {},
      h("button", { class: "word-row", onclick: () => go(`/word/${q.word.no}`) },
        h("span", { class: "word-name" }, q.word.name),
        q.skipped ? h("span", { class: "muted" }, t("Q-31"))
          : q.chosen === q.word.no ? h("span", { class: "mark-right", "aria-label": "정답" }, "○") : null)))),
    h("div", { class: "btn-col bottom-actions" },
      uploadBtn,
      reviewBtn,
      button(btn("Q-16"), () => startQuiz(round.stage), { kind: "secondary" }),
      button(btn("Q-17"), () => { current = null; go("/quiz"); }, { kind: "secondary" }))));
}

// ── S7 별명 입력(아래에서 올라오는 창) ──
function openNicknameSheet(round) {
  const input = h("input", { type: "text", class: "nick-input", placeholder: t("Q-20"),
    value: getState().lastName || "", autocomplete: "off", "aria-label": t("Q-19") });
  const ok = button(btn("Q-22"), submit, { kind: "primary" });
  const valid = () => { const n = charLen(input.value.trim()); return n >= 1 && n <= CONFIG.NICKNAME_MAX; };
  const sync = () => { ok.disabled = !valid(); };
  input.addEventListener("input", sync);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && valid()) submit(); });
  sync();
  const m = openModal(h("div", { class: "nick-sheet" },
    h("h2", {}, t("Q-19")),
    input,
    h("p", { class: "muted small" }, t("Q-21")),
    h("div", { class: "btn-col" }, ok, button(btn("Q-23"), () => m.close(), { kind: "secondary" }))), { sheet: true });

  function submit() {
    if (!valid() || round.uploadedAt) return;
    round.uploadedAt = addRanking({ name: input.value.trim(), score: round.score, stage: round.stage });
    m.close();
    go(`/ranking?hl=${round.uploadedAt}`);
  }
}

// ── S8 랭킹(이 기기) ──
export function renderRanking(el, { query }) {
  const list = sortRanking(getState().ranking);
  const hl = Number(query.hl) || null;
  const deviceOnly = COPY["Q-21"].split(". ").slice(1).join(". "); // Q-21 뒷문장 "랭킹은 이 기기에서만 보여요."
  el.append(h("section", { class: "ranking" },
    header(t("Q-24"), { onBack: () => back("/quiz") }),
    list.length
      ? h("ol", { class: "rank-list" }, list.map((r, i) => h("li", { class: r.at === hl ? "hl" : "" },
          t("Q-25", { "순위": i + 1, "별명": r.name, s: r.score, n: r.stage, "날짜": r.date }))))
      : h("div", { class: "empty-state" }, h("span", { class: "empty-icon", "aria-hidden": "true" }, icon("medal", { stroke: 1.8 })), h("p", {}, t("Q-26"))),
    h("p", { class: "muted small" }, deviceOnly)));
}

// 같은 주소 안에서 문제·결과를 다시 그림
function rerender(el) {
  el.replaceChildren();
  renderQuizPlay(el, { stage: current.stage });
  window.scrollTo(0, 0);
}
