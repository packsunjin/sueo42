// [S16 내 기록 · S18 기록 지우기] 레벨(큰 숫자 + 두꺼운 막대)·연속 학습(주황 타일, 최근 7일 동그라미)·해 본 단어·단계별 진행·배지 8개 메달(참여 기준)과 랭킹 바로가기, 기록 지우기 창.
import { h, localDate } from "../util.js";
import { t, btn, BADGE_COPY, fill } from "../copy.js";
import { header, button, go, levelBar, confirmModal, toast, icon } from "../ui.js";
import { getState, clearAll } from "../store.js";
import { allWords, stageNumbers } from "../data/words.js";
import { levelInfo, streak, last7, triedCount, totals, stageTried, stageDone, BADGES, badgeProgress, goalDays } from "../game/progress.js";

export function renderRecords(el) {
  const s = getState(), words = allWords(), today = localDate();
  const lv = levelInfo(s);
  const { lab } = totals(s);
  const got = BADGES.filter((b) => s.badges[b.id]).length;

  el.append(h("section", { class: "records" },
    header(t("R-01")),

    h("div", { class: "card level-card" },
      h("h2", { class: "level-num" }, t("R-02", { n: lv.level })),
      levelBar(lv),
      h("p", { class: "muted small" }, t("R-05"))),

    h("div", { class: "card streak-tile" },
      h("h2", {}, h("span", { class: "streak-flame", "aria-hidden": "true" }, flameIcon()), t("R-06", { d: streak(s, today) })),
      h("p", { class: "muted small" }, t("R-07"), " · ", t("R-18", { k: goalDays(s) })),
      h("ol", { class: "week" }, last7(s, today).map((d) => h("li", { title: d.date, class: d.done ? "on" : "" },
        h("span", { class: "day-dot", "aria-hidden": "true" }, d.done ? icon("check", { stroke: 3.2 }) : null),
        h("span", { class: "sr-only" }, d.done ? "●" : "○"),
        h("small", {}, d.date.slice(8)))))),

    h("div", { class: "card" },
      h("h2", {}, t("R-08", { k: triedCount(s, words) })),
      h("p", { class: "muted small" }, t("R-09", { a: lab, b: s.labTries, r: s.quizRounds })),
      h("ul", { class: "stage-progress" }, stageNumbers().map((n) => {
        const k = stageTried(s, words, n);
        return h("li", { "data-stage": n },
          h("button", { onclick: () => go(`/lab?stage=${n}`) },
            h("span", { class: "stage-badge", "aria-hidden": "true" }, String(n)),
            h("span", { class: "sp-name" }, t("C-14", { n })),
            h("span", { class: "mini-bar", "aria-hidden": "true" }, h("span", { style: { width: `${(k / 6) * 100}%` } })),
            stageDone(s, words, n) ? h("span", { class: "tag-done" }, t("C-16")) : h("span", { class: "sp-count muted" }, t("C-15", { k }))));
      }))),

    h("div", { class: "card" },
      h("h2", {}, t("R-10", { k: got, n: BADGES.length })),
      h("ul", { class: "badges" }, BADGES.map((b) => badgeCell(b, s, words)))),

    aiCheckCard(s, words),

    h("div", { class: "btn-col" },
      button(btn("Q-03"), () => go("/ranking"), { kind: "secondary" })),

    h("p", { class: "muted small" }, t("R-11")),

    h("div", { class: "btn-col bottom-actions" },
      button(btn("R-12"), () => go("/info"), { kind: "secondary" }),
      button(btn("R-13"), () => confirmModal(t("R-14"), btn("R-15"), btn("R-16"), () => {
        clearAll();
        toast(t("R-17"));
        go("/home");
      }), { kind: "danger" }))));
}

function badgeCell(b, s, words) {
  const c = BADGE_COPY[b.copy];
  const date = s.badges[b.id];
  if (date) {
    // B-04 의 {n}: 받게 한 단계. 옛 기록·고친 기록이라 없으면 지금 다 해 본 첫 단계, 그것도 없으면 문구를 빼서 빈칸을 안 보인다
    let got = c.got;
    if (b.id === "stage") {
      const n = s.badgeStage ?? stageNumbers().find((k) => stageDone(s, words, k)) ?? null;
      got = n == null ? null : fill(c.got, { n });
    }
    return h("li", { class: "badge on" },
      h("span", { class: "medal", "aria-hidden": "true" }, icon("medal", { stroke: 2.2 })),
      h("strong", {}, c.name),
      h("small", {}, date),
      got ? h("small", { class: "muted" }, got) : null);
  }
  const p = badgeProgress(b.id, s, words);
  return h("li", { class: "badge off" },
    h("span", { class: "medal", "aria-hidden": "true" }, icon("medal", { stroke: 2.2 })),
    h("strong", {}, c.name),
    h("small", { class: "muted" }, c.how),
    p ? h("small", { class: "muted" }, fill(BADGE_COPY["B-09"].name, p)) : null);
}

// 연속 학습 타일의 불꽃(채운 모양)
const flameIcon = () => icon("flame", { stroke: 1.6, fill: "currentColor" });

// (11/25) AI 확인 기록: 사람이 AI 추정을 확인한 결과. 사람을 채점하지 않고, AI 가 어디서 헷갈렸는지만 모아 보여 준다
function aiCheckCard(s, words) {
  const checks = Array.isArray(s.aiChecks) ? s.aiChecks : [];
  const name = (no) => (words.find((w) => w.no === no) || {}).name;
  const same = checks.filter((c) => c.ai === c.me).length;
  const pairs = new Map();
  for (const c of checks) {
    if (c.ai === c.me || !name(c.ai) || !name(c.me)) continue;
    const k = `${c.ai}>${c.me}`;
    pairs.set(k, { ai: c.ai, me: c.me, k: (pairs.get(k)?.k || 0) + 1 });
  }
  const top = [...pairs.values()].sort((a, b) => b.k - a.k).slice(0, 3);
  return h("div", { class: "card ai-check" },
    h("h2", {}, t("R-19")),
    checks.length
      ? h("p", { class: "muted small" }, t("R-20", { n: checks.length, a: same, b: checks.length - same }))
      : h("p", { class: "muted small" }, t("R-24")),
    top.length ? h("h3", { class: "ai-check-sub" }, t("R-21")) : null,
    top.length ? h("ul", { class: "ai-pairs" }, top.map((p) => h("li", {}, t("R-22", { ai: name(p.ai), me: name(p.me), k: p.k })))) : null,
    h("p", { class: "muted small" }, t("R-23")));
}
