// [단어 데이터] data/words.csv 를 읽어 단어 42개를 들고 있고, 번호·단계로 찾기와 검색 거름을 해 준다.
import { CONFIG } from "../../config.js";
import { csvToObjects } from "./csv.js";

let WORDS = [];

// CSV 글자 → 단어 객체 배열(번호 순). 메모 열은 화면에 쓰지 않으므로 읽지 않는다
export function wordsFromCSV(text) {
  const C = CONFIG.COLUMNS;
  return csvToObjects(text)
    .map((r) => ({
      no: Number(r[C.number]),
      name: r[C.name],
      headword: r[C.headword],
      handshape: r[C.handshape],
      video: r[C.video],
      category: r[C.category],
      page: r[C.page],
      aihub: Number(r[C.aihub]),
      stage: Number(r[C.stage]),
    }))
    .filter((w) => Number.isInteger(w.no) && w.no > 0 && w.name)
    .sort((a, b) => a.no - b.no);
}

// S0 에서 부름. 실패하면 오류를 던진다(→ E-01)
// 휴대폰 망이 끊기면 fetch 가 끝나지 않아 '불러오는 중'이 계속 돈다 → 15초 지나면 멈추고 E-01 + [다시 시도]
const LOAD_TIMEOUT_MS = 15000;
export async function loadWords(fetchFn = fetch) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), LOAD_TIMEOUT_MS) : null;
  let text;
  try {
    const res = await fetchFn(CONFIG.WORDS_CSV_URL, { cache: "no-cache", signal: ctl ? ctl.signal : undefined });
    if (!res.ok) throw new Error(`words.csv ${res.status}`);
    text = await res.text();
  } finally { if (timer) clearTimeout(timer); }
  const list = wordsFromCSV(text);
  if (!list.length) throw new Error("words.csv 0줄");
  WORDS = list;
  return list;
}

export function setWords(list) { WORDS = list; } // 시험용
export const allWords = () => WORDS;
// 사전 영상의 작은 그림(사전 사이트가 주는 215×161 그대로). 주소 모양이 다르면 null
export const thumbOf = (w) => (w && /_700X466\.mp4$/.test(w.video) ? w.video.replace(/_700X466\.mp4$/, "_215X161.jpg") : null);
export const wordByNo = (no) => WORDS.find((w) => w.no === Number(no));
export const wordsOfStage = (n) => WORDS.filter((w) => w.stage === Number(n));
export const stageNumbers = () => [...new Set(WORDS.map((w) => w.stage))].sort((a, b) => a - b);

// 검색 거름: 「단어」 또는 「사전 표제어」(쉼표로 나뉜 말 하나라도)에 입력이 들어 있으면 통과
// (11/24) 초성 검색: 입력이 모두 자음(ㄱ~ㅎ)이면 단어의 첫소리끼리 비교(예: 'ㅌㅅ' → 택시)
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
export function initials(s) {
  return [...s].map((ch) => {
    const c = ch.charCodeAt(0) - 0xac00;
    return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch;
  }).join("");
}
const isChoOnly = (q) => /^[ㄱ-ㅎ]+$/.test(q);
export function matchWord(w, query) {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return true;
  const terms = [w.name, ...String(w.headword || "").split(",")].map((s) => s.trim().toLowerCase().replace(/\s+/g, ""));
  if (isChoOnly(q)) return terms.some((s) => s && initials(s).includes(q));
  return terms.some((s) => s && s.includes(q));
}

export function filterWords(list, query, stage = null) {
  return list.filter((w) => (stage == null || w.stage === stage) && matchWord(w, query));
}

// 결재 4: AI-Hub 문장 수가 적은 단어(직접 해보기 연습 화면 L-13 안내)
export const isLowData = (w) => Number.isFinite(w.aihub) && w.aihub <= CONFIG.LAB_LOW_DATA_MAX;
