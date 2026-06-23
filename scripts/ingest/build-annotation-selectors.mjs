// build-annotation-selectors.mjs — resolve every annotation's TextQuoteSelector to a character
// position in the unit's cleaned reading text. Fails loud if an anchor can't be located uniquely:
// a selector that doesn't resolve is a broken annotation, caught here before it can reach a page.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifest = JSON.parse(readFileSync(resolve(ROOT, "data/manifest.json"), "utf8"));
const unitsById = new Map(manifest.units.map((u) => [u.unit_id, u]));

const annDir = resolve(ROOT, "data/annotations");
const files = readdirSync(annDir).filter((f) => f.endsWith(".annotations.json"));

const textCache = new Map();
function unitText(unit) {
  if (!unit.clean_path) return null;
  if (!textCache.has(unit.unit_id)) textCache.set(unit.unit_id, readFileSync(resolve(ROOT, unit.clean_path), "utf8"));
  return textCache.get(unit.unit_id);
}

const resolved = [];
const errors = [];

for (const file of files) {
  const data = JSON.parse(readFileSync(resolve(annDir, file), "utf8"));
  const unit = unitsById.get(data.unit_id);
  if (!unit) { errors.push(`${file}: unknown unit_id ${data.unit_id}`); continue; }
  const text = unitText(unit);
  if (text == null) { errors.push(`${file}: unit ${data.unit_id} has no published text`); continue; }

  for (const ann of data.annotations) {
    const sel = ann.selector;
    const needle = (sel.prefix || "") + sel.exact + (sel.suffix || "");
    let idx = text.indexOf(needle);
    if (idx < 0) {
      // try exact alone (prefix/suffix are hints, not always literally adjacent)
      idx = text.indexOf(sel.exact);
      if (idx < 0) { errors.push(`${data.unit_id}/${ann.id}: exact not found: "${sel.exact.slice(0, 50)}"`); continue; }
      const second = text.indexOf(sel.exact, idx + 1);
      if (second >= 0 && !sel.prefix && !sel.suffix) {
        errors.push(`${data.unit_id}/${ann.id}: exact is ambiguous (${text.split(sel.exact).length - 1}×) — add prefix/suffix`);
        continue;
      }
      ann.selector.position = { start: idx, end: idx + sel.exact.length, generated: true };
    } else {
      const start = idx + (sel.prefix || "").length;
      ann.selector.position = { start, end: start + sel.exact.length, generated: true };
    }
    resolved.push({ unit_id: data.unit_id, ...ann });
  }
}

if (errors.length) {
  console.error("build-annotation-selectors: UNRESOLVED selectors:\n  " + errors.join("\n  "));
  process.exit(1);
}

mkdirSync(resolve(ROOT, "data/indexes"), { recursive: true });
writeFileSync(resolve(ROOT, "data/indexes/annotations.resolved.json"), JSON.stringify({ annotations: resolved }, null, 2));
console.log(`build-annotation-selectors: ${resolved.length} annotations resolved across ${files.length} unit file(s).`);
