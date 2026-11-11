// [카메라] 앞 카메라 켜기·끄기. 브라우저 오류를 copy.md 오류 번호(E-03~E-06)로 바꾼다. 영상은 저장하거나 보내지 않는다.

let stream = null;

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
  const pre = precheck();
  if (pre) return pre;
  if (!isOn()) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
    } catch (err) {
      if (err && err.name === "OverconstrainedError") {      // 해상도 조건 없이 한 번 더
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true }); }
        catch (err2) { console.warn("카메라 실패:", err2.name); return errorCode(err2); }
      } else { console.warn("카메라 실패:", err && err.name); return errorCode(err); }
    }
  }
  video.muted = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
  if (video.srcObject !== stream) video.srcObject = stream;
  try { await video.play(); } catch { /* 자동 재생 막힘 — 화면을 누르면 다시 재생됨 */ }
  if (video.readyState < 2) {
    await new Promise((res) => video.addEventListener("loadeddata", res, { once: true }));
  }
  return null;
}

export function stopCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}
