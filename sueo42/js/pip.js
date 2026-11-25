// [떠 있는 사전 영상] (11/25 사장: "사전 영상 움직일 수 있고 확대 가능하게", "자유롭게, 버튼은 작게 왼쪽 위·아래")
// 직접 해보기 연습 화면에서 사전 영상 칸을 화면 전체 위에 띄운다(카메라 칸에 갇히지 않음).
//   왼쪽 위 작은 버튼 = 끌어서 옮기기, 왼쪽 아래 작은 버튼 = 끌어서 크기 바꾸기(오른쪽 위 모서리 고정)
//   영상 몸통도 끌면 옮겨지고, 두 손가락으로 벌리면 크기, 두 번 톡 = 크게↔작게
// 영상 자체는 편집하지 않고 보여 주는 크기·위치만 바꾼다(국립국어원 변경금지). 위치·크기는 이 기기에만 기억(sueo42-pip2).
const KEY = "sueo42-pip2";
const RATIO = 466 / 700;      // 사전 영상 가로세로 비율(700×466)
const MIN_W = 90;   // 가장 작은 너비

function load() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.w > 0) return v; } catch (e) { /* 저장 못 함 */ }
  return null;
}
function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 저장 못 함 */ } }

// stage: 처음 자리를 정할 기준(카메라 칸), box: 사전 영상 칸, moveBtn·sizeBtn: 작은 버튼
export function makeFloating(stage, box, moveBtn, sizeBtn) {
  document.body.append(box);   // 화면 전체 기준으로 띄움(조상 요소의 변형·넘침에 갇히지 않게)
  // 상태: 화면(창) 크기에 대한 비율 { x, y: 왼쪽 위 위치, w: 너비 }
  let st = load();
  const vw = () => document.documentElement.clientWidth, vh = () => innerHeight;
  if (!st) {   // 처음: 카메라 칸 오른쪽 위에 작게
    const s = stage.getBoundingClientRect();
    const w = Math.max(MIN_W, s.width * 0.4 || 140);
    st = { x: (s.right - w - 8) / vw(), y: (s.top + 8) / vh(), w: w / vw() };
  }
  const apply = () => {
    const W = vw(), H = vh();
    const w = Math.max(MIN_W, Math.min(W, H / RATIO, st.w * W));
    const h = w * RATIO;
    // 화면 안 어디든(버튼이 화면 밖으로 나가 다시 못 잡는 일이 없게 칸 전체가 화면 안에 남음)
    const left = Math.max(0, Math.min(W - w, st.x * W));
    const top = Math.max(0, Math.min(Math.max(0, H - h), st.y * H));
    box.style.width = `${w}px`; box.style.height = `${h}px`;
    box.style.transform = `translate(${left}px, ${top}px)`;
  };
  const set = (left, top, w) => { st = { x: left / vw(), y: top / vh(), w: w / vw() }; apply(); };
  const rect = () => { const b = box.getBoundingClientRect(); return { left: b.left, top: b.top, w: b.width }; };

  const pts = new Map();
  let mode = null, start = null, lastTap = 0, moved = false;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const begin = (m) => {
    start = { ...rect(), px: [...pts.values()][0], d: pts.size > 1 ? dist() : 0 };
    mode = pts.size > 1 ? "pinch" : m;
    moved = false;
  };
  const down = (ev, m) => {
    if (ev.button > 0) return;
    ev.preventDefault(); ev.stopPropagation();
    box.setPointerCapture?.(ev.pointerId);
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    begin(mode === "size" ? "size" : m);
    box.classList.add("dragging");
  };
  box.addEventListener("pointerdown", (ev) => { if (ev.target.closest(".pip-btn")) return; down(ev, "move"); });
  moveBtn.addEventListener("pointerdown", (ev) => down(ev, "move"));
  sizeBtn.addEventListener("pointerdown", (ev) => down(ev, "size"));
  box.addEventListener("pointermove", (ev) => {
    if (!pts.has(ev.pointerId) || !start) return;
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const p = [...pts.values()][0];
    const dx = p.x - start.px.x, dy = p.y - start.px.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (mode === "move") set(start.left + dx, start.top + dy, start.w);
    else if (mode === "size") {   // 왼쪽 아래 손잡이: 오른쪽 위 모서리를 고정하고 왼쪽·아래로 끌면 커짐
      const w = Math.max(MIN_W, Math.min(vw(), start.w + Math.max(-dx, dy / RATIO)));
      set(Math.max(0, start.left + start.w - w), start.top, w);   // 왼쪽이 화면 끝에 닿으면 오른쪽으로 커짐
    } else if (mode === "pinch" && start.d) {
      const w = Math.max(MIN_W, start.w * (dist() / start.d));
      set(start.left - (w - start.w) / 2, start.top - (w - start.w) * RATIO / 2, w);
    }
  });
  const up = (ev) => {
    if (!pts.has(ev.pointerId)) return;
    pts.delete(ev.pointerId);
    if (pts.size) { begin("move"); return; }   // 두 손가락 중 하나를 떼면 남은 손가락으로 옮기기
    box.classList.remove("dragging");
    if (!moved && mode === "move" && !ev.target.closest?.(".pip-btn")) {   // 두 번 톡: 크게 ↔ 작게
      const now = performance.now();
      if (now - lastTap < 320) {
        const r = rect(), W = vw();
        const w = r.w > W * 0.6 ? Math.max(MIN_W, W * 0.4) : W * 0.92;
        set(Math.min(r.left, W - w), r.top, w); lastTap = 0;
      } else lastTap = now;
    }
    mode = null; start = null;
    save(st);
  };
  box.addEventListener("pointerup", up);
  box.addEventListener("pointercancel", up);

  // 키보드: 옮기기 버튼에서 화살표, 크기 버튼에서 + − (또는 화살표 위·아래)
  const key = (ev, which) => {
    const r = rect(), step = 16, k = ev.key;
    if (which === "size" && (k === "+" || k === "=" || k === "ArrowDown")) set(r.left - r.w * 0.15, r.top, r.w * 1.15);
    else if (which === "size" && (k === "-" || k === "ArrowUp")) set(r.left + r.w * 0.13, r.top, r.w / 1.15);
    else if (which === "move" && k === "ArrowLeft") set(r.left - step, r.top, r.w);
    else if (which === "move" && k === "ArrowRight") set(r.left + step, r.top, r.w);
    else if (which === "move" && k === "ArrowUp") set(r.left, r.top - step, r.w);
    else if (which === "move" && k === "ArrowDown") set(r.left, r.top + step, r.w);
    else return;
    ev.preventDefault(); save(st);
  };
  moveBtn.addEventListener("keydown", (ev) => key(ev, "move"));
  sizeBtn.addEventListener("keydown", (ev) => key(ev, "size"));

  addEventListener("resize", apply);
  apply();
  // 연습 화면을 떠나면(카메라 칸이 화면에서 빠지면) 떠 있는 영상도 치운다
  const app = stage.closest("#app") || document.body;
  const mo = new MutationObserver(() => { if (!stage.isConnected) stop(); });
  mo.observe(app, { childList: true, subtree: true });
  function stop() { mo.disconnect(); removeEventListener("resize", apply); box.remove(); }
  return { apply, stop };
}
