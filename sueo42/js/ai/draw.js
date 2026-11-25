// [손 좌표 그리기] 손 21점과 뼈대 선을 캔버스에 그린다. 카메라 위 겹쳐 그리기와, 기록한 좌표를 반복 재생하기(결과 화면)에 쓴다.

// MediaPipe 손 연결선(손목 0, 엄지 1~4, 검지 5~8, 중지 9~12, 약지 13~16, 새끼 17~20)
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

const COLORS = ["#2f6fed", "#e8590c"];
const BODY = "#a6e35a";   // 얼굴·어깨 안내 선(앱 연두)

// hands: [{ landmarks: [[x,y]…] }] (0~1 비율). mirror=true 면 좌우를 뒤집어 그림(화면이 거울처럼 보일 때)
export function drawHands(ctx, hands, { mirror = false, clear = true } = {}) {
  const { width: W, height: H } = ctx.canvas;
  if (clear) ctx.clearRect(0, 0, W, H);
  const lw = Math.max(2, W / 160);
  hands.forEach((hd, n) => {
    const P = hd.landmarks.map(([x, y]) => [(mirror ? 1 - x : x) * W, y * H]);
    const col = hd.label ? COLORS[hd.label === "Right" ? 0 : 1] : COLORS[n % 2];   // 손마다 늘 같은 색(순서가 바뀌어도)
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); }
    ctx.stroke();
    for (const [x, y] of P) { ctx.beginPath(); ctx.arc(x, y, lw * 1.3, 0, Math.PI * 2); ctx.fill(); }
  });
}

// 기록한 프레임을 같은 길이만큼 반복 재생. 돌려주는 함수를 부르면 멈춘다
// clock: 재생 시각(ms)을 주는 함수(영상 위에 겹쳐 그릴 때 영상 시각에 맞춤), bg=false 면 배경을 칠하지 않음(투명)
export function replay(canvas, frames, { mirror = true, durationMs = 2000, clock = null, bg = true } = {}) {
  const ctx = canvas.getContext("2d");
  if (frames.length && frames[0].width) {
    canvas.width = 320;
    canvas.height = Math.round(320 * frames[0].height / frames[0].width);
  }
  // rAF 는 탭이 가려지거나 창이 작으면 멈춰 캔버스가 빈 채로 남는다 → 바로 한 번 그리고 타이머로 돈다
  let stopped = false;
  const t0 = performance.now();
  function tick(now = performance.now()) {
    if (stopped) return;
    const n = frames.length;
    if (bg) { ctx.fillStyle = "#11151c"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (n) {
      const ms = clock ? clock() : now - t0;
      const i = Math.min(n - 1, Math.max(0, Math.floor(((ms % durationMs) / durationMs) * n)));
      if (frames[i].hands.length) drawHands(ctx, frames[i].hands, { mirror, clear: false });
      else if (bg) {   // 이 순간 손이 안 잡힘 — 빈 화면이 고장처럼 보이지 않게 글로 알린다
        ctx.fillStyle = "#8a93a3";
        ctx.font = `${Math.round(canvas.width / 18)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("이 순간엔 손이 안 잡혔어요", canvas.width / 2, canvas.height / 2);
      }
      // (11/25) "손 잡힘 n/n" 글자는 뺌(분수 꼴이라 점수처럼 읽힘)
    }
  }
  tick();
  const timer = setInterval(() => { if (!canvas.isConnected) { stopped = true; clearInterval(timer); } else tick(); }, 33); // 화면에서 빠지면 저절로 멈춤
  return () => { stopped = true; clearInterval(timer); };
}

// (11/19) 얼굴·어깨 기준: AI 가 실제로 잡은 코·양어깨 점만 그린다(없는 점은 그리지 않음).
// 어깨 사이 선 + 어깨 점 + 코 점 + 코 둘레 점선 동그라미(얼굴 자리, 반지름 = 어깨 너비 × 0.32). body = { nose, rs, ls } (0~1 비율)
export function drawBody(ctx, body, { mirror = false } = {}) {
  if (!body || !body.rs || !body.ls) return;
  const { width: W, height: H } = ctx.canvas;
  const P = (p) => [(mirror ? 1 - p[0] : p[0]) * W, p[1] * H];
  const [a, b] = [P(body.rs), P(body.ls)];
  const lw = Math.max(3, W / 120);
  ctx.save();
  ctx.strokeStyle = BODY; ctx.fillStyle = BODY; ctx.lineWidth = lw; ctx.lineCap = "round";
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  for (const [x, y] of [a, b]) { ctx.beginPath(); ctx.arc(x, y, lw * 1.8, 0, Math.PI * 2); ctx.fill(); }
  if (body.nose) {
    const n = P(body.nose);
    const r = Math.hypot(a[0] - b[0], a[1] - b[1]) * 0.32;
    ctx.setLineDash([lw * 2, lw * 1.6]);
    ctx.beginPath(); ctx.arc(n[0], n[1], r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(n[0], n[1], lw * 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
