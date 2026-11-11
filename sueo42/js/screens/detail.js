// [S3 단어 상세] 사전 영상(원본 그대로)·사전 표제어·수형 설명·출처를 한 화면에. 여기서 직접 해보기·뜻 맞히기로 바로 간다. 기록은 남기지 않는다.
import { h } from "../util.js";
import { t, btn } from "../copy.js";
import { header, dictVideo, button, go } from "../ui.js";
import { wordByNo } from "../data/words.js";
import { startQuiz } from "./quiz.js";

export function renderDetail(el, { no }) {
  const w = wordByNo(no);
  if (!w) { go("/search"); return; }
  el.append(h("section", { class: "detail" },
    header(w.name, { backTo: "/search" }),
    h("p", { class: "muted" }, t("C-14", { n: w.stage })),
    dictVideo(w),
    h("p", { class: "hint" }, t("S-11")),
    h("dl", { class: "facts" },
      h("dt", {}, t("S-06")), h("dd", {}, w.headword),
      h("dt", {}, t("S-07")), h("dd", {}, w.handshape, h("small", { class: "muted block" }, t("S-08")))),
    h("div", { class: "btn-col bottom-actions" },
      button(btn("S-09"), () => go(`/lab/word/${w.no}`), { kind: "primary" }),
      button(btn("S-10"), () => startQuiz(w.stage), { kind: "secondary" }))));
}
