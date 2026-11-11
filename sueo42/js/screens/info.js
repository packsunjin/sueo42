// [S17 정보·출처] 사전 영상·MediaPipe 출처, (모델 연결 뒤에만) AI-Hub 출처, AI 순위·카메라 안내. 'AI 도구로 만든 코드' 표기는 앱 화면에 넣지 않는다(README 에만).
import { h } from "../util.js";
import { t } from "../copy.js";
import { header } from "../ui.js";
import { isTrialModel } from "../../config.js";

export function renderInfo(el) {
  el.append(h("section", { class: "info" },
    header(t("I-01"), { backTo: "/records" }),
    h("ul", { class: "info-list" },
      h("li", {}, t("I-02")),
      h("li", {}, t("I-03")),
      isTrialModel() ? null : h("li", {}, t("I-04")),
      h("li", {}, t("I-05")),
      h("li", {}, t("I-06")))));
}
