// [S16 내 기록 · S18 기록 지우기] 레벨·연속 학습·최근 7일·해 본 단어·단계별 진행·배지 8개(참여 기준)와 랭킹 바로가기, 기록 지우기 창.
import { h, localDate } from "../util.js";
import { t, btn, BADGE_COPY, fill } from "../copy.js";
import { header, button, go, levelBar, confirmModal, toast } from "../ui.js";
import { getState, clearAll } from "../store.js";
import { allWords, stageNumbers } from "../data/words.js";
import { levelInfo, streak, last7, triedCount, totals, stageTried, stageDone, BADGES, badgeProgress } from "../game/progress.js";

export function renderRecords(el) {
  const s = getState(), words = allWords(), today = localDate();
  const lv = levelInfo(s);
  const { lab } = totals(s);
  const got = BADGES.filter((b) => s.badges[b.id]).length;

  el.append(h("section", { class: "records" },
    header(t("R-01")),

    h("div", { class: "card" },
      h("h2", {}, t("R-02", { n: lv.level })),
      levelBar(lv),
      h("p", { class: "muted small" }, t("R-05"))),

    h("div", { class: "card" },
      h("h2", {}, t("R-06", { d: streak(s, today) })),
      h("p", { class: "muted small" }, t("R-07")),
      h("ol", { class: "week" }, last7(s, today).map((d) => h("li", { title: d.date, class: d.done ? "on" : "" },
        h("span", { "aria-hidden": "true" }, d.done ? "●" : "○"), h("small", {}, d.date.slice(8)))))),

    h("div", { class: "card" },
      h("h2", {}, t("R-08", { k: triedCount(s, words) })),
      h("p", { class: "muted small" }, t("R-09", { a: lab, b: s.labTries, r: s.quizRounds })),
      h("ul", { class: "stage-progress" }, stageNumbers().map((n) => h("li", {},
        h("button", { class: "row-between", onclick: () => go(`/lab?stage=${n}`) },
          h("span", {}, t("C-14", { n })),
          h("span", { class: "muted" }, t("C-15", { k: stageTried(s, words, n) }),
            stageDone(s, words, n) ? [" ", h("span", { class: "tag-done" }, t("C-16"))] : null)))))),

    h("div", { class: "card" },
      h("h2", {}, t("R-10", { k: got })),
      h("ul", { class: "badges" }, BADGES.map((b) => badgeCell(b, s, words)))),

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
    return h("li", { class: "badge on" },
      h("strong", {}, c.name),
      h("small", {}, date),
      h("small", { class: "muted" }, fill(c.got, { n: s.badgeStage ?? "" })));
  }
  const p = badgeProgress(b.id, s, words);
  return h("li", { class: "badge off" },
    h("strong", {}, c.name),
    h("small", { class: "muted" }, c.how),
    p ? h("small", { class: "muted" }, fill(BADGE_COPY["B-09"].name, p)) : null);
}
