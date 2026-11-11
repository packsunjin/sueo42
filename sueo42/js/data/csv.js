// [CSV 읽기] 글자 CSV 를 줄·칸 배열로 나눈다(따옴표 안의 쉼표·줄바꿈·"" 처리).
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM 제거
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// 첫 줄을 머리글로 써서 객체 배열로
export function csvToObjects(text) {
  const [head, ...rest] = parseCSV(text);
  if (!head) return [];
  const keys = head.map((k) => k.trim());
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}
