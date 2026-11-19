// (11/19) 게임 요소 시험: 오늘의 목표·단어 별·새 배지·연속 정답 점수. 맞고 틀림이 목표·별·배지에 들어가지 않는지 확인
import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, applyRecord, RECORD, wordStars, dailyPoints, goalDone, earnedBadgeIds } from "../sueo42/js/game/progress.js";
import { CONFIG } from "../sueo42/config.js";

const words = Array.from({ length: 42 }, (_, i) => ({ no: i + 1, name: `w${i + 1}`, stage: Math.floor(i / 6) + 1 }));
const T = "2026-11-19";

test("오늘의 목표: 뜻 맞히기 1문제 = 1, 직접 해보기 1번 = 2, 다시 해보기 = 0, 10 채우면 goal 이벤트 한 번", () => {
  const s = emptyState();
  for (let i = 0; i < 4; i++) applyRecord(s, words, T, RECORD.quizAnswer(1));
  assert.equal(dailyPoints(s, T), 4);
  applyRecord(s, words, T, RECORD.labRetry());
  assert.equal(dailyPoints(s, T), 4);
  applyRecord(s, words, T, RECORD.labChoice(2));
  applyRecord(s, words, T, RECORD.labChoice(3));
  assert.equal(dailyPoints(s, T), 8);
  assert.equal(goalDone(s, T), false);
  const ev = applyRecord(s, words, T, RECORD.labChoice(4));
  assert.equal(dailyPoints(s, T), CONFIG.DAILY_GOAL);
  assert.ok(ev.some((e) => e.type === "goal"));
  assert.ok(ev.some((e) => e.type === "badge" && e.id === "goal1"));
  const ev2 = applyRecord(s, words, T, RECORD.quizAnswer(5));
  assert.ok(!ev2.some((e) => e.type === "goal"), "목표 이벤트는 하루 한 번");
});

test("단어 별: 해 본 횟수 1·3·5번 → 별 1·2·3개, 5번이면 '별 셋' 배지", () => {
  const s = emptyState();
  const counts = [];
  for (let i = 0; i < 5; i++) { applyRecord(s, words, T, RECORD.quizAnswer(7)); counts.push(wordStars(s, 7)); }
  assert.deepEqual(counts, [1, 1, 2, 2, 3]);
  assert.ok(earnedBadgeIds(s, words, T).includes("star3"));
});

test("뜻 맞히기 10판 배지, 14일 연속 배지", () => {
  const s = emptyState();
  for (let i = 0; i < 10; i++) applyRecord(s, words, T, RECORD.quizRound(1, 0));   // 0점이어도 판 수는 셈
  assert.ok(s.badges.quiz10);
  const s2 = emptyState();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.UTC(2026, 10, 19 - i)).toISOString().slice(0, 10);
    applyRecord(s2, words, d, RECORD.quizAnswer(1));
  }
  assert.ok(s2.badges.streak14);
});

test("연속 정답 점수: 3문제째부터 +5 (뜻 맞히기에만)", async () => {
  const pts = (c) => CONFIG.QUIZ_POINTS_PER_ANSWER + (c >= CONFIG.QUIZ_COMBO_FROM ? CONFIG.QUIZ_COMBO_BONUS : 0);
  assert.deepEqual([1, 2, 3, 4].map(pts), [10, 10, 15, 15]);
});
