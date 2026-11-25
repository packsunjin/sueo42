// [떠 있는 사전 영상] (11/25 사장: "사전 영상 움직일 수 있고 확대 가능하게") 직접 해보기 연습 화면에서 사전 영상 칸을
// 카메라 위에 띄우고, 끌어서 옮기기·모서리 손잡이로 크기 바꾸기·두 손가락으로 벌려 크기 바꾸기·두 번 눌러 크게/작게를 한다.
// 영상 자체는 편집하지 않고 보여 주는 크기·위치만 바꾼다(국립국어원 변경금지). 위치·크기는 이 기기에만 기억(sueo42-pip).
const KEY = "sueo42-pip";
const RATIO = 466 / 700;      // 사전 영상 가로세로 비율(700×466)
const MIN_FRAC = 0.28, SMALL = 0.4, BIG = 0.9;

function load() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.w > 0) return v; } catch (e) { /* 저장 못 함 */ }
  return null;
}
function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 저장 못 함 */ } }

// stage: 위치 기준(카메라 상자를 담은 칸), box: 사전 영상 칸, handle: 크기 손잡이
export function makeFloating(stage, box, handle) {
  // 상태는 stage 크기에 대한 비율(가로 x·세로 y·너비 w)로 둔다 → 화면 크기가 바뀌어도 같은 자리
  let st = load() || { x: 1, y: 0, w: SMALL };   // x·y: 남는 공간 안 위치(0~1). 기본은 오른쪽 위
  const apply = () => {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    const minW = Math.min(W, Math.max(96, W * MIN_FRAC));
    const w = Math.max(minW, Math.min(W, st.w * W));
    const h = w * RATIO;
    const left = (W - w) * Math.max(0, Math.min(1, st.x));
    const top = Math.max(0, H - h) * Math.max(0, Math.min(1, st.y));
    box.style.width = `${w}px`; box.style.height = `${h}px`;
    box.style.transform = `translate(${left}px, ${top}px)`;
  };
  const fromPixels = (left, top, w) => {
    const W = stage.clientWidth, H = stage.clientHeight;
    const h = w * RATIO;
    st = { w: w / W, x: W - w > 0 ? left / (W - w) : 0, y: H - h > 0 ? top / (H - h) : 0 };
    st.x = Math.max(0, Math.min(1, st.x)); st.y = Math.max(0, Math.min(1, st.y));
  };
  const rect = () => { const s = stage.getBoundingClientRect(), b = box.getBoundingClientRect(); return { left: b.left - s.left, top: b.top - s.top, w: b.width }; };

  // 손가락·마우스: 하나면 옮기기, 둘이면 크기(벌리기). 손잡이를 잡으면 크기
  const pts = new Map();
  let mode = null, start = null, lastTap = 0, moved = false;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const begin = (resize) => {
    const r = rect();
    start = { ...r, px: [...pts.values()][0], d: pts.size > 1 ? dist() : 0 };
    mode = resize ? "resize" : pts.size > 1 ? "pinch" : "move";
    moved = false;
  };
  const down = (ev, resize) => {
    if (ev.button > 0) return;
    ev.preventDefault(); ev.stopPropagation();
    box.setPointerCapture?.(ev.pointerId);
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    begin(resize || mode === "resize");
    box.classList.add("dragging");
  };
  box.addEventListener("pointerdown", (ev) => { if (ev.target.closest(".pip-handle")) return; down(ev, false); });
  handle.addEventListener("pointerdown", (ev) => down(ev, true));
  box.addEventListener("pointermove", (ev) => {
    if (!pts.has(ev.pointerId) || !start) return;
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const p = [...pts.values()][0];
    const dx = p.x - start.px.x, dy = p.y - start.px.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (mode === "move") fromPixels(start.left + dx, start.top + dy, start.w);
    else if (mode === "resize") fromPixels(start.left, start.top, start.w + Math.max(dx, dy / RATIO));
    else if (mode === "pinch" && start.d) {
      const w = start.w * (dist() / start.d);
      fromPixels(start.left - (w - start.w) / 2, start.top - (w - start.w) * RATIO / 2, w);
    }
    apply();
  });
  const up = (ev) => {
    if (!pts.has(ev.pointerId)) return;
    pts.delete(ev.pointerId);
    if (pts.size) { begin(false); return; }      // 두 손가락 중 하나를 떼면 남은 손가락으로 옮기기
    box.classList.remove("dragging");
    if (!moved && mode === "move") {              // 두 번 톡: 크게 ↔ 작게
      const now = performance.now();
      if (now - lastTap < 320) { const r = rect(); const cx = r.left + r.w / 2; const w = st.w > (SMALL + BIG) / 2 ? SMALL : BIG; fromPixels(cx - (w * stage.clientWidth) / 2, r.top, w * stage.clientWidth); apply(); lastTap = 0; }
      else lastTap = now;
    }
    mode = null; start = null;
    save(st);
  };
  box.addEventListener("pointerup", up);
  box.addEventListener("pointercancel", up);

  // 키보드: 손잡이에 초점을 두고 화살표로 옮기기, +/- 로 크기
  handle.addEventListener("keydown", (ev) => {
    const r = rect(), step = 16;
    const k = ev.key;
    if (k === "+" || k === "=") fromPixels(r.left, r.top, r.w * 1.15);
    else if (k === "-") fromPixels(r.left, r.top, r.w / 1.15);
    else if (k === "ArrowLeft") fromPixels(r.left - step, r.top, r.w);
    else if (k === "ArrowRight") fromPixels(r.left + step, r.top, r.w);
    else if (k === "ArrowUp") fromPixels(r.left, r.top - step, r.w);
    else if (k === "ArrowDown") fromPixels(r.left, r.top + step, r.w);
    else return;
    ev.preventDefault(); apply(); save(st);
  });

  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(apply) : null;
  if (ro) ro.observe(stage); else addEventListener("resize", apply);
  requestAnimationFrame(apply);
  return { apply, stop: () => ro && ro.disconnect() };
}
