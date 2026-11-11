// [화면 이동] 해시 주소(#/search, #/word/12 …)를 화면 함수로 잇고, 화면을 떠날 때 그 화면의 정리 함수를 부른다.
//
// 주소 목록 (screens.md)
//   #/home              S1 홈
//   #/search            S2 검색
//   #/word/:no          S3 단어 상세
//   #/quiz              S4 뜻 맞히기 단계 고르기
//   #/quiz/play/:stage  S5·S5'·S6·S7 한 판
//   #/ranking           S8 랭킹 (?hl=올린 시각 → 그 줄 강조)
//   #/lab               S9 직접 해보기 단어 고르기 (?stage=n → 그 단계 펼침)
//   #/lab/word/:no      S10·S11~S15 그 단어 연습 (1-6 에서 만듦. 단어 상세 [이 단어 직접 해보기] 가 여기로 감)
//   #/records           S16 내 기록 (S18 은 이 화면 안의 창)
//   #/info              S17 정보·출처

const routes = [];
let cleanup = null;
let currentPath = null;
let hooks = { before: () => {}, after: () => {} };

export function route(pattern, render) {
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "$");
  routes.push({ re, keys, render, pattern });
}

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, "") || "/home";
  const [path, qs = ""] = raw.split("?");
  return { path: path || "/home", query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function matchRoute(path) {
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) return { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export function go(path) {
  if (blockedByGuard(() => go(path))) return;
  if (location.hash === "#" + path) render();
  else location.hash = path;
}

// 나가기 확인(1-6, S13 L-40): guard(proceed) 가 false 를 돌려주면 이동을 멈추고, 화면이 확인 뒤 proceed() 를 부른다.
// [뒤로]·탭 바(go·back)만 막는다. 브라우저 자체 뒤로 버튼은 막지 않는다. 화면이 바뀌면 저절로 풀린다
let leaveGuard = null;
export function setLeaveGuard(fn) { leaveGuard = fn; }
function blockedByGuard(retry) {
  if (!leaveGuard) return false;
  const g = leaveGuard;
  return g(() => { leaveGuard = null; retry(); }) === false;
}

// [뒤로]: 앱 안에서 온 곳이 있으면 그리로, 없으면 fallback
let depth = 0;
export function back(fallback = "/home") {
  if (blockedByGuard(() => back(fallback))) return;
  if (depth > 0) { depth -= 2; history.back(); } // 뒤로 간 뒤 hashchange 가 1 을 더하므로 2 를 뺀다
  else go(fallback);
}

export function setHooks(h) { hooks = { ...hooks, ...h }; }

export function render() {
  const { path, query } = parseHash();
  const found = matchRoute(path);
  if (!found) { location.replace("#/home"); return; }
  if (typeof cleanup === "function") { try { cleanup(); } catch (e) { console.error(e); } }
  cleanup = null;
  leaveGuard = null;
  const app = document.getElementById("app");
  app.replaceChildren();
  hooks.before(found.r.pattern, path);
  cleanup = found.r.render(app, { ...found.params, query }) || null;
  if (path !== currentPath) window.scrollTo(0, 0);
  currentPath = path;
  hooks.after(found.r.pattern, path);
}

export function startRouter() {
  window.addEventListener("hashchange", () => { depth++; render(); });
  if (!location.hash) location.replace("#/home");
  render();
}
