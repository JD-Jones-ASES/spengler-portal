// scan-text.mjs — a guardrail over the committed reading text. Fails loud if any derived chapter
// carries a classic OCR/PDF/encoding artifact, and asserts that a `text_status: clean` work never
// ships OCR-correction highlights (so a fix from a now-superseded source can't resurface). Part of
// `prepare:data`; keeps the corpus honest after any re-source or re-clean.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DERIVED = resolve(ROOT, "derived");

// [label, regex] — each a true artifact, never legitimate in clean reading prose.
const ARTIFACTS = [
  ["ligature (ﬁ ﬂ …)", /[ﬀ-ﬆ]/g],
  ["soft hyphen U+00AD", /­/g],
  ["replacement char U+FFFD", /�/g],
  ["zero-width / BOM", /[​‌‍﻿]/g],
  ["form feed", /\f/g],
  ["mojibake (â€ / Ã·)", /â€|Ã[-¿]|Â[ ]/g],
  ["double space", / {2,}/g],
];

const errors = [];

// 1) artifact scan over every derived chapter .txt
function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".txt")) scanFile(p);
  }
}
function scanFile(path) {
  const text = readFileSync(path, "utf8");
  const rel = path.replace(ROOT + "\\", "").replace(ROOT + "/", "").replace(/\\/g, "/");
  for (const [label, re] of ARTIFACTS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      const upto = text.slice(0, m.index);
      const line = upto.split("\n").length;
      const ctx = text.slice(Math.max(0, m.index - 20), m.index + 20).replace(/\n/g, "⏎");
      errors.push(`${rel}:${line} — ${label}  …${ctx}…`);
    }
  }
}
if (existsSync(DERIVED)) walk(DERIVED);

// 2) a `clean` work must carry no OCR-correction highlights
for (const f of readdirSync(DERIVED)) {
  if (!f.endsWith(".spine.json")) continue;
  const spine = JSON.parse(readFileSync(join(DERIVED, f), "utf8"));
  for (const ch of spine.chapters || []) {
    if (ch.text_status === "clean" && (ch.ocr_corrections?.length || 0) > 0) {
      errors.push(`${f} / ${ch.unit_id} — text_status:clean but ${ch.ocr_corrections.length} ocr_corrections present (stale highlight risk)`);
    }
  }
}

if (errors.length) {
  console.error(`scan-text: ${errors.length} text artifact(s) found:\n  ` + errors.join("\n  "));
  process.exit(1);
}
console.log("scan-text: clean — no OCR/PDF/encoding artifacts; no stale OCR highlights on clean works.");
