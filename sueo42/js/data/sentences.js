// [문장 만들기 예시] (11/25 사장 지시) 앱 42개 단어만으로 팀이 직접 만든 짧은 생활 문장.
// words 는 '이 순서로 하나씩 동작해 보는 단어'다. 한국어 문장의 단어 순서이고, 실제 수어 문법·어순과 다를 수 있다(앱에 안내).
// AI-Hub 문장 라벨의 문장을 옮기지 않았다(약관). 문장은 생활 상황(이동·급한 일·물건)에서 팀이 지음
// tpl: {단어} 자리가 블록(동작해서 채우는 칸), 나머지는 이어 주는 말. words 는 tpl 에서 뽑음
const RAW = [
  { id: 1, text: "지하철 타러 가요", tpl: "{지하철} 타러 {가다}" },
  { id: 2, text: "버스를 기다려요", tpl: "{버스}를 {기다리다}" },
  { id: 3, text: "화장실이 급해요", tpl: "{화장실}이 {급하다}" },
  { id: 4, text: "돈을 잃어버렸어요", tpl: "{돈}을 {잃어버리다}" },
  { id: 5, text: "화장실을 찾아요", tpl: "{화장실}을 {찾다}" },
  { id: 6, text: "시간이 없어요", tpl: "{시간}이 {없다}" },
  { id: 7, text: "병원에 빨리 가요", tpl: "{병원}에 {빨리} {가다}" },
  { id: 8, text: "지금 택시가 필요해요", tpl: "{지금} {택시}가 {필요}" },
  { id: 9, text: "학교에 천천히 가요", tpl: "{학교}에 {천천히} {가다}" },
  { id: 10, text: "추워서 힘들어요", tpl: "{춥다} 그래서 {힘들다}" },
];
// parts: [{ word: "지하철" } | { glue: "타러" }, ...]
const parse = (tpl) => tpl.split(/(\{[^}]+\})/).map((x) => x.trim()).filter(Boolean)
  .map((x) => (x.startsWith("{") ? { word: x.slice(1, -1) } : { glue: x }));
export const SENTENCES = RAW.map((r) => { const parts = parse(r.tpl); return { ...r, parts, words: parts.filter((p) => p.word).map((p) => p.word) }; });
export const CHANCE_PER_WORD = 2;          // 기회 = 단어 수 × 2 (11/25 사장 결정)
export const SENTENCE_RANK_SIZE = 5;       // AI 후보 5개
export const sentenceById = (id) => SENTENCES.find((s) => s.id === Number(id));
