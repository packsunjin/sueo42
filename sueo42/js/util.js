// [도구] 화면 요소 만들기(h), 섞기, 무작위 고르기, 이 기기 날짜(YYYY-MM-DD) 같은 작은 함수 모음.

// h("div", {class:"x", onclick:fn}, "글자", 자식요소…) — 글자는 항상 textContent 로 넣어 안전하다
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  appendAll(el, children);
  return el;
}

function appendAll(el, children) {
  for (const c of children) {
    if (c === undefined || c === null || c === false) continue;
    if (Array.isArray(c)) appendAll(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// 피셔-예이츠 섞기(원본은 그대로, 새 배열을 돌려줌)
export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 배열에서 서로 다른 n개 무작위
export function sample(arr, n, rnd = Math.random) {
  return shuffle(arr, rnd).slice(0, n);
}

// 이 기기 시간 기준 날짜 글자(YYYY-MM-DD)
export function localDate(d = new Date()) {
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// "YYYY-MM-DD" 에서 days 일 앞/뒤 날짜
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

// 글자 수(한글·이모지도 한 글자로)
export const charLen = (s) => [...s].length;
