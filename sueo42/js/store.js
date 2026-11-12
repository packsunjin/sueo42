// [기록 저장] 이 기기 localStorage(키 sueo42-v1)에 기록을 읽고 쓴다. 읽기 실패·형식이 다르면 빈 기록, 쓰기 실패면 이번 창 메모리에만(E-11).
import { CONFIG } from "../config.js";
import { emptyState, applyRecord, RECORD, sortRanking, BADGES } from "./game/progress.js";
import { allWords } from "./data/words.js";
import { localDate } from "./util.js";

let state = emptyState();
let memoryOnly = false;          // 저장이 안 되는 브라우저(시크릿 모드 등)
let storageWarned = false;       // E-11 을 이번 창에서 이미 띄웠는지
const listeners = new Set();     // 기록이 바뀌면 부름(상태 줄 갱신 등)
let eventSink = () => {};        // 토스트로 보낼 곳(main.js 가 정함)
let warnSink = () => {};         // E-11 띄울 곳

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

// ── 저장값 거르기 도구 ──
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const count = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);       // 0 이상 정수만
const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isNoKey = (k) => /^[1-9]\d{0,3}$/.test(k);                              // 단어 번호·단계 번호 열쇠("__proto__" 같은 것 막음)
const BADGE_IDS = new Set(BADGES.map((b) => b.id));

function cleanRankRow(r) {
  if (!isObj(r)) return null;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name || !Number.isFinite(r.score) || !Number.isFinite(r.stage) || !Number.isFinite(r.at)) return null;
  return { name: [...name].slice(0, CONFIG.NICKNAME_MAX).join(""), score: r.score, stage: r.stage,
    date: isDay(r.date) ? r.date : "", at: r.at };
}

// 저장된 값이 game.md 모양인지 칸마다(안쪽 항목까지) 확인한다. 알 수 없는 값은 버리고 기본값으로 채운다.
// 어떤 값이 들어 있어도 던지지 않는다. version 이 1 이 아니거나 객체가 아니면 null(→ 빈 기록).
export function normalize(raw) {
  if (!isObj(raw) || raw.version !== 1) return null;
  const s = emptyState();
  if (isObj(raw.words)) {
    for (const [k, c] of Object.entries(raw.words)) {
      if (!isNoKey(k) || !isObj(c)) continue;
      const quiz = count(c.quiz), lab = count(c.lab);
      if (quiz + lab > 0) s.words[k] = { quiz, lab };
    }
  }
  if (Array.isArray(raw.days)) s.days = [...new Set(raw.days.filter(isDay))].sort();
  if (isObj(raw.badges)) {
    for (const [k, d] of Object.entries(raw.badges)) if (BADGE_IDS.has(k) && isDay(d)) s.badges[k] = d;
  }
  if (Number.isInteger(raw.badgeStage) && raw.badgeStage > 0) s.badgeStage = raw.badgeStage;
  if (isObj(raw.best)) {
    for (const [k, v] of Object.entries(raw.best)) if (isNoKey(k) && Number.isFinite(v) && v >= 0) s.best[k] = v;
  }
  if (Array.isArray(raw.ranking)) s.ranking = sortRanking(raw.ranking.map(cleanRankRow).filter(Boolean));
  if (typeof raw.lastName === "string") s.lastName = [...raw.lastName].slice(0, CONFIG.NICKNAME_MAX).join("");
  s.cameraIntroSeen = raw.cameraIntroSeen === true;
  s.labTries = count(raw.labTries);
  s.quizRounds = count(raw.quizRounds);
  return s;
}

// 앱 시작 때 한 번. 돌려주는 값: 저장을 쓸 수 있는지
export function initStore() {
  const ls = storage();
  try {
    const txt = ls ? ls.getItem(CONFIG.STORAGE_KEY) : null;
    state = (txt && normalize(JSON.parse(txt))) || emptyState();
  } catch {
    state = emptyState();
  }
  try {
    if (!ls) throw new Error("no storage");
    const k = CONFIG.STORAGE_KEY + "-test";
    ls.setItem(k, "1"); ls.removeItem(k);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  return !memoryOnly;
}

function save() {
  if (!memoryOnly) {
    try { storage().setItem(CONFIG.STORAGE_KEY, JSON.stringify(state)); }
    catch { memoryOnly = true; }
  }
  if (memoryOnly && !storageWarned) { storageWarned = true; warnSink(); }
  listeners.forEach((f) => f(state));
}

export const getState = () => state;
export const isMemoryOnly = () => memoryOnly;
export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const setEventSink = (f) => { eventSink = f; };
export const setStorageWarn = (f) => { warnSink = f; };
export const markStorageWarned = () => { storageWarned = true; };

// 기록 하나 적용 → 저장 → 생긴 일(토스트) 보내기
function record(mutate, opts) {
  const events = applyRecord(state, allWords(), localDate(), mutate, opts);
  save();
  if (events.length) eventSink(events);
  return events;
}

export const recordQuizAnswer = (no) => record(RECORD.quizAnswer(no));
export const recordQuizRound = (stage, score) => record(RECORD.quizRound(stage, score));
export const recordLabChoice = (no) => record(RECORD.labChoice(no));   // 1-6 에서 씀
export const recordLabRetry = () => record(RECORD.labRetry());        // 1-6 에서 씀

// 랭킹에 올리기(학습 기록이 아니므로 학습한 날에 넣지 않음). 돌려주는 값: 올린 줄의 at
export function addRanking({ name, score, stage }) {
  const at = Date.now();
  state.ranking = sortRanking([...state.ranking, { name, score, stage, date: localDate(), at }]);
  state.lastName = name;
  save();
  return at;
}

export function setCameraIntroSeen() { state.cameraIntroSeen = true; save(); } // 1-6 에서 씀

// 기록 지우기(S18)
export function clearAll() {
  state = emptyState();
  const ls = storage();
  try { ls && ls.removeItem(CONFIG.STORAGE_KEY); } catch { /* 메모리만 지움 */ }
  listeners.forEach((f) => f(state));
}
