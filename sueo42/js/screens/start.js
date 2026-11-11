// [S0 첫 화면] 단어 목록(words.csv)을 읽는 동안 앱 이름·한 줄 소개·로딩을 보여 주고, 실패하면 E-01 + [다시 시도].
import { h } from "../util.js";
import { t, btn } from "../copy.js";
import { spinner, errorBox } from "../ui.js";
import { loadWords } from "../data/words.js";

export function renderStart(el, onDone) {
  async function attempt() {
    el.replaceChildren(h("section", { class: "start" },
      h("h1", { class: "app-name" }, t("C-01")),
      h("p", { class: "tagline" }, t("H-01")),
      spinner(t("H-02"))));
    try {
      await loadWords();
      onDone();
    } catch (e) {
      console.error("단어 목록 읽기 실패:", e.message);
      el.replaceChildren(h("section", { class: "start" },
        h("h1", { class: "app-name" }, t("C-01")),
        h("p", { class: "tagline" }, t("H-01")),
        errorBox("E-01", { [btn("C-11")]: attempt })));
    }
  }
  attempt();
}
