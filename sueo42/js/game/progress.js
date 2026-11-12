// [게임 계산] 단계·레벨·연속 학습·배지를 저장된 기록에서 계산한다(game.md). 맞고 틀림은 보지 않고 횟수·날짜만 센다.
import { CONFIG } from "../../config.js";
import { addDays } from "../util.js";

// 배지 8개(순서 = copy.md B-01~B-08)
export const BADGES = [
  { id: "first",   copy: "B-01" },                    // 처음 학습
  { id: "camera",  copy: "B-02" },                    // 직접 해보기 기록 1번
  { id: "choice5", copy: "B-03", goal: 5 },           // 결과 화면 세 버튼 5번(labTries)
  { id: "stage",   copy: "B-04", goal: 6 },           // 아무 단계 6/6
  { id: "streak3", copy: "B-05" },
  { id: "lab10",   copy: "B-06", goal: 10 },          // 직접 해보기 기록 10번
  { id: "streak7", copy: "B-07" },
  { id: "all42",   copy: "B-08", goal: 42 },          // 해 본 단어 42개
];

export function emptyState() {
  return {
    version: 1,
    words: {},          // { "번호": { quiz, lab } }
    labTries: 0,        // 결과 화면 세 버튼 누른 총횟수(배지 3)
    quizRounds: 0,
    days: [],           // 학습한 날 YYYY-MM-DD
    badges: {},         // { 배지id: 받은 날 }
    badgeStage: null,   // 배지 4 를 받게 한 단계 번호(B-04 문구의 {n})
    best: {},           // { 단계: 이 기기 최고 점수 } (S4 단계 카드 copy.js "S4-최고", S6 Q-14 판단)
    ranking: [],        // [{ name, score, stage, date, at }]
    lastName: "",
    cameraIntroSeen: false,
  };
}

const wc = (state, no) => state.words[String(no)] || { quiz: 0, lab: 0 };
export const isTried = (state, no) => { const c = wc(state, no); return (c.quiz || 0) + (c.lab || 0) > 0; };

export function triedCount(state, words) {
  return words.filter((w) => isTried(state, w.no)).length;
}

export function stageTried(state, words, stage) {
  return words.filter((w) => w.stage === stage && isTried(state, w.no)).length;
}

export function stageDone(state, words, stage) {
  const ws = words.filter((w) => w.stage === stage);
  return ws.length > 0 && ws.every((w) => isTried(state, w.no));
}

// 이어서 할 단계: 단계 1부터 해 본 단어가 6개 미만인 첫 단계, 모두 다 했으면 1
export function continueStage(state, words) {
  const stages = [...new Set(words.map((w) => w.stage))].sort((a, b) => a - b);
  return stages.find((s) => !stageDone(state, words, s)) ?? stages[0] ?? 1;
}

export function totals(state) {
  let quiz = 0, lab = 0;
  for (const c of Object.values(state.words)) { quiz += c.quiz || 0; lab += c.lab || 0; }
  return { quiz, lab };
}

// 레벨 점수 = 뜻 맞히기 문제 수 × 1 + 직접 해보기 기록 수 × 2
export function levelScore(state) {
  const { quiz, lab } = totals(state);
  return quiz * CONFIG.LEVEL_QUIZ_POINTS + lab * CONFIG.LEVEL_LAB_POINTS;
}

// { level, toNext(다음 레벨까지 남은 횟수, 최고면 null), ratio(막대 0~1) }
export function levelInfo(state) {
  const pts = levelScore(state);
  const T = CONFIG.LEVEL_THRESHOLDS;
  let level = 1;
  for (let i = 0; i < T.length; i++) if (pts >= T[i]) level = i + 1;
  if (level >= T.length) return { level, toNext: null, ratio: 1 };
  const lo = T[level - 1], hi = T[level];
  return { level, toNext: hi - pts, ratio: (pts - lo) / (hi - lo) };
}

// 연속 학습: 오늘부터 거꾸로, 오늘 아직 안 했으면 어제부터
export function streak(state, today) {
  const set = new Set(state.days);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export const learnedToday = (state, today) => state.days.includes(today);

// 최근 7일(오래된 날 → 오늘): [{ date, done }]
export function last7(state, today) {
  const set = new Set(state.days);
  return Array.from({ length: 7 }, (_, i) => { const date = addDays(today, i - 6); return { date, done: set.has(date) }; });
}

// 배지 진행 { k, n } — 횟수 배지만(B-09). 나머지는 null
export function badgeProgress(id, state, words) {
  switch (id) {
    case "choice5": return { k: Math.min(state.labTries, 5), n: 5 };
    case "lab10": return { k: Math.min(totals(state).lab, 10), n: 10 };
    case "stage": {
      const stages = [...new Set(words.map((w) => w.stage))];
      return { k: Math.max(0, ...stages.map((s) => stageTried(state, words, s))), n: 6 };
    }
    case "all42": return { k: triedCount(state, words), n: words.length };
    default: return null;
  }
}

// 지금 기록으로 받을 자격이 있는 배지 id 목록
export function earnedBadgeIds(state, words, today) {
  const { lab } = totals(state);
  const st = streak(state, today);
  const stages = [...new Set(words.map((w) => w.stage))];
  const ok = {
    first: state.days.length > 0,
    camera: lab >= 1,
    choice5: state.labTries >= 5,
    stage: stages.some((s) => stageDone(state, words, s)),
    streak3: st >= 3,
    lab10: lab >= 10,
    streak7: st >= 7,
    all42: words.length > 0 && triedCount(state, words) >= words.length,
  };
  return BADGES.map((b) => b.id).filter((id) => ok[id]);
}

// 기록 하나를 적용하고 생긴 일을 돌려준다. mutate(state) 가 기록을 바꾼다.
// 돌려주는 events: [{type:"day", streak}, {type:"level", level}, {type:"stage", stage}, {type:"badge", id}]
export function applyRecord(state, words, today, mutate, { learning = true } = {}) {
  const before = {
    today: learnedToday(state, today),
    level: levelInfo(state).level,
    done: new Set([...new Set(words.map((w) => w.stage))].filter((s) => stageDone(state, words, s))),
  };
  mutate(state);
  if (learning && !state.days.includes(today)) state.days.push(today);
  state.days.sort();

  const events = [];
  if (!before.today && learnedToday(state, today)) events.push({ type: "day", streak: streak(state, today) });
  const lv = levelInfo(state).level;
  if (lv > before.level) events.push({ type: "level", level: lv });
  const newDone = [...new Set(words.map((w) => w.stage))].sort((a, b) => a - b)
    .filter((s) => !before.done.has(s) && stageDone(state, words, s));
  for (const s of newDone) events.push({ type: "stage", stage: s });
  for (const id of earnedBadgeIds(state, words, today)) {
    if (state.badges[id]) continue;
    state.badges[id] = today;
    if (id === "stage") state.badgeStage = newDone[0] ?? before.done.values().next().value ?? null;
    events.push({ type: "badge", id });
  }
  return events;
}

// 기록 종류별 바꾸는 함수(game.md 1절 표)
const bump = (state, no, key) => {
  const k = String(no);
  const c = state.words[k] || { quiz: 0, lab: 0 };
  c[key] = (c[key] || 0) + 1;
  state.words[k] = c;
};
export const RECORD = {
  quizAnswer: (no) => (s) => bump(s, no, "quiz"),               // 보기 하나 고름(정답이든 아니든)
  quizRound: (stage, score) => (s) => {                         // 한 판 끝
    s.quizRounds += 1;
    if (!(stage in s.best) || score > s.best[stage]) s.best[stage] = score;
  },
  labChoice: (no) => (s) => { bump(s, no, "lab"); s.labTries += 1; }, // [맞아요]·[다른 동작이었어요]→고름
  labRetry: () => (s) => { s.labTries += 1; },                  // [다시 해보기]
};

// 랭킹: 점수 높은 순, 동점은 먼저 올린 것(at 작은 것) 위, 상위 N개
export function sortRanking(list) {
  return list.slice().sort((a, b) => b.score - a.score || a.at - b.at).slice(0, CONFIG.RANKING_SIZE);
}
