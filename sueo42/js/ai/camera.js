// [카메라] 앞 카메라 켜기·끄기. 브라우저 오류를 copy.md 오류 번호(E-03~E-06)로 바꾼다. 영상은 서버로 보내거나 저장하지 않는다(직접 해보기의 '내 동작'은 lab.js 가 메모리에서만 잠깐 녹화).

let stream = null;
let lastErrorName = "";
export const cameraErrorName = () => lastErrorName;   // 화면에 작게 보여 줄 브라우저 오류 이름(문제 찾기용)

// (11/25) 앱 안의 브라우저(카카오톡·인스타그램·네이버 등). 이런 곳은 카메라가 막힌 경우가 많아 크롬·사파리로 열도록 안내(E-13)
const IN_APP = [["KAKAOTALK", "kakao"], ["Instagram", "insta"], ["FBAN", "fb"], ["FBAV", "fb"], ["NAVER(inapp", "naver"],
  ["Line/", "line"], ["everytimeApp", "etc"], ["DaumApps", "etc"], ["; wv)", "webview"]];
export function inAppBrowser() {
  const ua = navigator.userAgent || "";
  const hit = IN_APP.find(([k]) => ua.includes(k));
  return hit ? hit[1] : null;
}
// 다른 브라우저로 열기: 카카오톡은 외부 브라우저 열기 주소, 안드로이드는 크롬으로 여는 intent, 그 밖에는 false(주소 복사 안내)
export function openInBrowser() {
  const url = location.href, kind = inAppBrowser(), android = /Android/i.test(navigator.userAgent);
  if (kind === "kakao") { location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(url); return true; }
  if (kind === "line") { location.href = url + (url.includes("?") ? "&" : "?") + "openExternalBrowser=1"; return true; }
  if (android) { location.href = "intent://" + url.replace(/^https?:\/\//, "") + "#Intent;scheme=https;package=com.android.chrome;end"; return true; }
  return false;
}
const withInApp = (code) => (code && inAppBrowser() ? "E-13" : code);
// (11/25) 거절(E-03)일 때 어디서 막혔는지: 사이트 권한이 'denied' 면 사이트 차단(E-03), 아니면 기기 설정에서 브라우저 권한이 꺼진 것(E-14)
async function refineDenied(code) {
  if (code !== "E-03") return code;
  try {
    const st = await navigator.permissions.query({ name: "camera" });
    if (st.state !== "denied") return "E-14";
  } catch (e) { /* 이 브라우저는 확인 못 함 → 그대로 */ }
  return code;
}

export const isOn = () => !!(stream && stream.getVideoTracks().some((t) => t.readyState === "live"));

// 켜기 전에 확인: 보안 주소(https·localhost)인지, 기능이 있는지
export function precheck() {
  if (!globalThis.isSecureContext) return "E-05";
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof WebAssembly !== "object") return "E-06";
  return null;
}

export function errorCode(err) {
  const name = err && err.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "E-03";
  if (name === "NotFoundError" || name === "NotReadableError" || name === "DevicesNotFoundError" ||
      name === "TrackStartError" || name === "OverconstrainedError" || name === "AbortError") return "E-04";
  if (name === "TypeError" || name === "NotSupportedError") return "E-06";
  return "E-04";
}

// 켜서 video 요소에 붙인다. 성공하면 null, 실패하면 오류 번호
export async function startCamera(video) {
  lastErrorName = "";
  const pre = precheck();
  if (pre) { lastErrorName = pre === "E-05" ? "insecure" : "no-mediaDevices"; return withInApp(pre); }
  if (!isOn()) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
    } catch (err) {
      // (11/25) 카메라가 아직 풀리지 않은 경우(다른 탭·이전 화면이 막 놓은 직후 등) 잠깐 뒤 조건 없이 한 번 더
      const busy = err && (err.name === "NotReadableError" || err.name === "TrackStartError" || err.name === "AbortError");
      if (err && (err.name === "OverconstrainedError" || busy)) {      // 해상도 조건 없이 한 번 더
        if (busy) await new Promise((r) => setTimeout(r, 900));
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true }); }
        catch (err2) { console.warn("카메라 실패:", err2.name); lastErrorName = err2.name || "?"; return withInApp(await refineDenied(errorCode(err2))); }
      } else { console.warn("카메라 실패:", err && err.name); lastErrorName = (err && err.name) || "?"; return withInApp(await refineDenied(errorCode(err))); }
    }
  }
  video.muted = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
  if (video.srcObject !== stream) video.srcObject = stream;
  try { await video.play(); } catch { /* 자동 재생 막힘 — 화면을 누르면 다시 재생됨 */ }
  if (video.readyState < 2) {   // (11/25) 영영 기다리지 않게 5초까지만(그 뒤에는 화면에서 다시 재생을 시도)
    await new Promise((res) => { video.addEventListener("loadeddata", res, { once: true }); setTimeout(res, 5000); });
  }
  return null;
}

// 직접 해보기 결과 화면의 '내 동작' 다시 보기용(lab.js 가 이 기기 메모리에서만 녹화)
export const getStream = () => stream;

export function stopCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}
