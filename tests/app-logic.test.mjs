// [앱 로직 시험] 브라우저 없이 Node 로 저장(store)·게임 계산(progress)·뜻 맞히기 문제(quiz)·검색(words)·시험용 순위(model)를 불러 흐름대로 돌려 본다.
// 실행: node --experimental-default-type=module tests/app-logic.test.mjs   (Node 20, 내장 모듈만)
// 화면 그리기(DOM)·카메라는 여기서 보지 않는다 — 브라우저에서 따로 확인.
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "sueo42");
const imp = (p) => import(pathToFileURL(path.join(APP, p)).href);

// ── 가짜 localStorage(브라우저 대신) ──
class FakeStorage {
  constructor(init = {}, { failWrite = false, failRead = false } = {}) { this.m = new Map(Object.entries(init)); this.failWrite = failWrite; this.failRead = failRead; }
  getItem(k) { if (this.failRead) throw new Error("read blocked"); return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.failWrite) throw new Error("QuotaExceededError"); this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
globalThis.localStorage = new FakeStorage();

const { CONFIG } = await imp("config.js");
const W = await imp("js/data/words.js");
const P = await imp("js/game/progress.js");
const S = await imp("js/store.js");
const Q = await imp("js/screens/quiz.js");
const M = await imp("js/ai/model.js");
const { t, COPY, BADGE_COPY } = await imp("js/copy.js");
const { localDate } = await imp("js/util.js");

let pass = 0, fail = 0;
async function check(name, fn) {
  try { await fn(); pass++; console.log("통과 ", name); }
  catch (e) { fail++; console.log("실패 ", name, "\n      ", e && e.message); }
}

// 단어: 실제 data/words.csv
const words = W.wordsFromCSV(fs.readFileSync(path.join(APP, "data/words.csv"), "utf8"));
W.setWords(words);
const today = localDate();
const KEY = CONFIG.STORAGE_KEY;

// 화면들이 기록으로 하는 계산을 한 번씩 다 해 본다(던지면 실패)
function exerciseScreens(s) {
  P.levelInfo(s); P.streak(s, today); P.last7(s, today); P.totals(s); P.triedCount(s, words);
  P.continueStage(s, words); P.learnedToday(s, today); P.earnedBadgeIds(s, words, today);
  for (const b of P.BADGES) P.badgeProgress(b.id, s, words);
  for (const n of W.stageNumbers()) { P.stageTried(s, words, n); P.stageDone(s, words, n); }
  P.sortRanking(s.ranking).forEach((r, i) => t("Q-25", { "순위": i + 1, "별명": r.name, s: r.score, n: r.stage, "날짜": r.date }));
  for (const [k, d] of Object.entries(s.badges)) assert.equal(typeof d, "string", `배지 날짜 ${k}`);
  for (const v of Object.values(s.best)) assert.ok(Number.isFinite(v), "최고 점수 숫자");
}

// ── 1. 단어 데이터 ──
await check("words.csv 42개·번호 1~42·단계 1~7 각 6개", () => {
  assert.equal(words.length, 42);
  assert.deepEqual(words.map((w) => w.no), Array.from({ length: 42 }, (_, i) => i + 1));
  assert.deepEqual(W.stageNumbers(), [1, 2, 3, 4, 5, 6, 7]);
  for (const n of W.stageNumbers()) assert.equal(W.wordsOfStage(n).length, 6, `단계 ${n}`);
  assert.equal(new Set(words.map((w) => w.name)).size, 42, "단어 이름 중복 없음");
});

// ── 2. 첫 실행·깨진 저장값 ──
await check("첫 실행(빈 저장소) → 빈 기록, 저장 가능", () => {
  globalThis.localStorage = new FakeStorage();
  assert.equal(S.initStore(), true);
  assert.deepEqual(S.getState(), P.emptyState());
  exerciseScreens(S.getState());
});

const BROKEN = {
  "JSON 아님": "{garbage",
  "null": "null",
  "숫자": "42",
  "배열": "[1,2]",
  "버전 2": JSON.stringify({ version: 2, words: { 1: { quiz: 1 } } }),
  "ranking:[null]": JSON.stringify({ version: 1, ranking: [null] }),
  "ranking 안쪽 엉뚱한 값": JSON.stringify({ version: 1, ranking: [null, 1, "x", [], {}, { name: 5, score: 10 }, { name: "가", score: "10", stage: 1, at: 1 }, { name: "ok", score: 30, stage: 2, at: 5, date: "2026-11-10" }] }),
  "ranking 객체": JSON.stringify({ version: 1, ranking: { a: 1 } }),
  "words 배열": JSON.stringify({ version: 1, words: [1, 2] }),
  "words 안쪽 null·문자·음수": JSON.stringify({ version: 1, words: { 1: null, 2: "x", 3: [1], 4: { quiz: -3, lab: "a" }, 5: { quiz: 2, lab: 1 }, abc: { quiz: 1 } } }),
  "words __proto__": '{"version":1,"words":{"__proto__":{"quiz":1},"7":{"quiz":1}}}',
  "days 안쪽 엉뚱한 값": JSON.stringify({ version: 1, days: [null, 5, {}, "어제", "2026-11-10", "2026-11-10"] }),
  "days 문자열": JSON.stringify({ version: 1, days: "2026-11-10" }),
  "badges 배열": JSON.stringify({ version: 1, badges: ["first"] }),
  "badges 안쪽 엉뚱한 값": JSON.stringify({ version: 1, badges: { first: { x: 1 }, camera: 1, nope: "2026-11-10", streak3: "2026-11-10" } }),
  "best 문자열": JSON.stringify({ version: 1, best: "x" }),
  "best 안쪽 엉뚱한 값": JSON.stringify({ version: 1, best: { 1: "60", 2: null, 3: 40, x: 10 } }),
  "숫자 칸이 문자·무한": JSON.stringify({ version: 1, labTries: "abc", quizRounds: 1e309 }).replace("null", "1e999"),
  "모든 칸 null": JSON.stringify({ version: 1, words: null, days: null, badges: null, best: null, ranking: null, lastName: null, badgeStage: "x", cameraIntroSeen: "yes", labTries: null, quizRounds: null }),
  "lastName 객체": JSON.stringify({ version: 1, lastName: { a: 1 } }),
};
for (const [name, txt] of Object.entries(BROKEN)) {
  await check(`깨진 저장값: ${name} → 멈추지 않고 화면 계산·기록이 됨`, () => {
    globalThis.localStorage = new FakeStorage({ [KEY]: txt });
    S.initStore();
    const s = S.getState();
    exerciseScreens(s);
    assert.ok(Array.isArray(s.ranking) && s.ranking.every((r) => r && typeof r.name === "string" && Number.isFinite(r.score)));
    assert.ok(Array.isArray(s.days) && s.days.every((d) => typeof d === "string"));
    assert.equal(typeof s.lastName, "string");
    assert.ok(Number.isFinite(s.labTries) && Number.isFinite(s.quizRounds));
    assert.equal(Object.getPrototypeOf(s.words), Object.prototype, "words 원형 오염 없음");
    // 그 위에 실제 기록을 해도 던지지 않음
    S.recordQuizAnswer(1); S.recordQuizRound(1, 10); S.recordLabChoice(2); S.recordLabRetry();
    S.addRanking({ name: "시험", score: 10, stage: 1 });
    exerciseScreens(S.getState());
  });
}

await check("깨진 값 안의 쓸 수 있는 항목은 남김", () => {
  globalThis.localStorage = new FakeStorage({ [KEY]: BROKEN["ranking 안쪽 엉뚱한 값"] });
  S.initStore();
  assert.deepEqual(S.getState().ranking.map((r) => r.name), ["ok"]);
  globalThis.localStorage = new FakeStorage({ [KEY]: BROKEN["words 안쪽 null·문자·음수"] });
  S.initStore();
  assert.deepEqual(S.getState().words, { 5: { quiz: 2, lab: 1 } });
});

await check("읽기 실패 → 빈 기록 / 쓰기 실패 → 메모리만 + E-11 한 번", () => {
  globalThis.localStorage = new FakeStorage({}, { failRead: true });
  S.initStore();
  assert.deepEqual(S.getState(), P.emptyState());
  globalThis.localStorage = new FakeStorage({}, { failWrite: true });
  let warned = 0;
  S.setStorageWarn(() => warned++);
  assert.equal(S.initStore(), false);
  assert.equal(S.isMemoryOnly(), true);
  S.recordQuizAnswer(1); S.recordQuizAnswer(2);
  assert.equal(S.getState().words["2"].quiz, 1, "메모리에는 남음");
  assert.ok(warned <= 1, "E-11 은 한 번만");
  S.setStorageWarn(() => {});
});

// ── 3. 뜻 맞히기 한 판 ──
await check("문제 출제: 단계마다 6문제, 보기 4개·정답 1개·중복 없음 (단계 7 × 200판)", () => {
  for (const n of W.stageNumbers()) {
    for (let k = 0; k < 200; k++) {
      const r = Q.newRound(n, words);
      assert.equal(r.items.length, CONFIG.QUIZ_QUESTIONS);
      assert.equal(new Set(r.items.map((q) => q.word.no)).size, 6, "같은 판에 같은 단어 두 번 없음");
      for (const q of r.items) {
        assert.equal(q.word.stage, n);
        assert.equal(q.options.length, CONFIG.QUIZ_OPTIONS);
        assert.equal(new Set(q.options.map((o) => o.no)).size, 4, "보기 중복");
        assert.equal(new Set(q.options.map((o) => o.name)).size, 4, "보기 이름 중복");
        assert.equal(q.options.filter((o) => o.no === q.word.no).length, 1, "정답 1개");
      }
    }
  }
});

await check("한 판: 채점 → 점수 → 별명 랭킹 → 기록·레벨·배지·연속 학습 반영, 다시 읽어도 같음", () => {
  globalThis.localStorage = new FakeStorage();
  S.initStore();
  const events = [];
  S.setEventSink((ev) => events.push(...ev));
  const round = Q.newRound(1, words);
  // 4개는 정답, 2개는 오답을 고른 것처럼(quiz.js choose() 와 같은 순서)
  round.items.forEach((q, i) => {
    const pick = i < 4 ? q.word : q.options.find((o) => o.no !== q.word.no);
    q.chosen = pick.no;
    if (pick.no === q.word.no) round.score += CONFIG.QUIZ_POINTS_PER_ANSWER;
    S.recordQuizAnswer(q.word.no);
  });
  assert.equal(Q.correctCount(round), 4);
  assert.equal(round.score, 40);
  S.recordQuizRound(round.stage, round.score);
  const at = S.addRanking({ name: "별명하나", score: round.score, stage: round.stage });
  const s = S.getState();
  assert.equal(s.quizRounds, 1);
  assert.equal(s.best["1"], 40);
  assert.equal(P.triedCount(s, words), 6);
  assert.ok(P.stageDone(s, words, 1), "단계 1 다 해 봄");
  assert.deepEqual(s.days, [today]);
  assert.equal(P.streak(s, today), 1);
  assert.equal(P.levelScore(s), 6);                      // 6문제 × 1
  assert.equal(P.levelInfo(s).level, 1);
  assert.ok(s.badges.first && s.badges.stage, "첫걸음·단계 하나 다 배지");
  assert.equal(s.badgeStage, 1);
  assert.equal(s.ranking[0].name, "별명하나"); assert.equal(s.ranking[0].at, at);
  const types = events.map((e) => e.type + (e.id ? ":" + e.id : e.stage ? ":" + e.stage : ""));
  assert.ok(types.includes("day") && types.includes("badge:first") && types.includes("stage:1") && types.includes("badge:stage"), types.join(","));
  // 저장된 값을 다시 읽기(새로고침 흉내)
  const saved = globalThis.localStorage.getItem(KEY);
  S.initStore();
  assert.deepEqual(S.getState(), JSON.parse(saved));
  S.setEventSink(() => {});
});

await check("레벨 오르기·최고 점수는 높을 때만·랭킹 정렬(점수↓, 동점은 먼저 올린 것)·10개까지", () => {
  globalThis.localStorage = new FakeStorage();
  S.initStore();
  for (let i = 0; i < 10; i++) S.recordQuizAnswer(1 + (i % 6));
  assert.equal(P.levelInfo(S.getState()).level, 2);
  S.recordQuizRound(2, 30); S.recordQuizRound(2, 20);
  assert.equal(S.getState().best["2"], 30);
  for (let i = 0; i < 12; i++) S.addRanking({ name: "n" + i, score: (i % 3) * 10, stage: 1 });
  const r = S.getState().ranking;
  assert.equal(r.length, CONFIG.RANKING_SIZE);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score > r[i].score || (r[i - 1].score === r[i].score && r[i - 1].at <= r[i].at));
});

await check("연속 학습: 어제·그제 기록 있으면 오늘 학습 시 3일, 3일 연속 배지", () => {
  const { addDays } = { addDays: (d, n) => { const [y, m, dd] = d.split("-").map(Number); return localDate(new Date(y, m - 1, dd + n)); } };
  globalThis.localStorage = new FakeStorage({ [KEY]: JSON.stringify({ version: 1, days: [addDays(today, -2), addDays(today, -1)] }) });
  S.initStore();
  assert.equal(P.streak(S.getState(), today), 2, "오늘 안 했으면 어제부터");
  S.recordQuizAnswer(3);
  assert.equal(P.streak(S.getState(), today), 3);
  assert.ok(S.getState().badges.streak3);
});

await check("직접 해보기 기록: [맞아요]/고르기 = lab+1·시도+1, [다시 해보기] = 시도만+1, 레벨 점수 2", () => {
  globalThis.localStorage = new FakeStorage();
  S.initStore();
  S.recordLabChoice(5); S.recordLabRetry();
  const s = S.getState();
  assert.equal(s.words["5"].lab, 1); assert.equal(s.labTries, 2);
  assert.equal(P.levelScore(s), 2);
  assert.ok(s.badges.camera, "카메라 앞으로 배지");
  assert.deepEqual(s.days, [today]);
});

await check("기록 지우기 → 빈 기록, 저장소에서도 지움", () => {
  S.recordQuizAnswer(1);
  S.clearAll();
  assert.deepEqual(S.getState(), P.emptyState());
  assert.equal(globalThis.localStorage.getItem(KEY), null);
});

// ── 4. 검색 → 단어 상세 ──
await check("검색: 단어·사전 표제어로 걸러짐, 없는 말은 0개, 단계 칩", () => {
  assert.deepEqual(W.filterWords(words, "버스").map((w) => w.name), ["버스"]);
  assert.ok(W.filterWords(words, "무방하다").some((w) => w.name === "괜찮다"), "사전 표제어로도 찾음");
  assert.equal(W.filterWords(words, "없는단어zz").length, 0);
  assert.equal(W.filterWords(words, "", 3).length, 6);
  assert.equal(W.filterWords(words, "  ").length, 42);
});

await check("단어 상세: 42개 모두 영상(mp4, https)·사전 페이지·표제어·수형 설명·출처 문구", () => {
  for (const w of words) {
    assert.match(w.video, /^https:\/\/sldict\.korean\.go\.kr\/.+\.mp4$/, `${w.name} 영상`);
    assert.match(w.page, /^https:\/\/sldict\.korean\.go\.kr\//, `${w.name} 사전 페이지`);
    assert.ok(w.headword && w.handshape, `${w.name} 표제어·수형 설명`);
    const src = t("C-12", { "사전 표제어": w.headword });
    assert.ok(src.includes(w.headword) && !src.includes("{"), `${w.name} 출처`);
    assert.equal(W.wordByNo(String(w.no)), w);
  }
});

// ── 5. 직접 해보기(모델 없음 → 시험용) ──
await check("MODEL_URL 비었음 → 시험용 순위: 서로 다른 2개, 42개 안의 이름, 확률 없음 (500번)", async () => {
  assert.equal(CONFIG.MODEL_URL, "");
  const names = new Set(words.map((w) => w.name));
  for (let i = 0; i < 500; i++) {
    const r = await M.rank([], words);
    assert.deepEqual(Object.keys(r).sort(), ["names", "trial"]);
    assert.equal(r.trial, true);
    assert.equal(r.names.length, CONFIG.LAB_RANK_SIZE);
    assert.notEqual(r.names[0], r.names[1]);
    r.names.forEach((n) => assert.ok(names.has(n)));
  }
  M.preload(); // 모델 없으면 아무것도 안 함(던지지 않음)
});

// ── 6. 문구 ──
await check("문구 표: 직접 해보기(L-) 문구에 점수·확률·%·맞음/틀림 없음", () => {
  for (const [k, v] of Object.entries(COPY)) {
    if (!k.startsWith("L-")) continue;
    assert.doesNotMatch(v, /점수|\d+점|확률|%|틀렸|맞았|정답|오답|채점/, `${k}: ${v}`);
  }
  for (const b of Object.values(BADGE_COPY)) assert.doesNotMatch(b.name + b.how + b.got, /확률|%|틀렸/);
  assert.equal(t("S4-최고", { s: 50 }), "최고 50점");
});

console.log(`\n결과: 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
