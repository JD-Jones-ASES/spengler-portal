// build-comparative-table.mjs — validate the comparative tables and flatten their cells for search.
// Every non-empty cell must trace to the table's source citation (here the whole table is Spengler's
// verbatim Table I, cited once at the table level). The build fails if a cell names an unknown Culture.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = resolve(ROOT, "data/comparative");
if (!existsSync(dir)) { console.log("build-comparative-table: no tables."); process.exit(0); }

const sources = JSON.parse(readFileSync(resolve(ROOT, "data/sources/decline.sources.json"), "utf8"));
const sourceIds = new Set(sources.records.map((r) => r.id));

const files = readdirSync(dir).filter((f) => f.endsWith(".table.json"));
const errors = [];
const cells = [];

for (const file of files) {
  const t = JSON.parse(readFileSync(resolve(dir, file), "utf8"));
  const cultureIds = new Set(t.cultures.map((c) => c.id));
  if (t.source_citation && !sourceIds.has(t.source_citation)) errors.push(`${file}: source_citation '${t.source_citation}' not in sources`);
  for (const row of t.rows) {
    for (const [cid, cell] of Object.entries(row.cells)) {
      if (!cultureIds.has(cid)) { errors.push(`${file}: row ${row.epoch} cell references unknown culture '${cid}'`); continue; }
      const culture = t.cultures.find((c) => c.id === cid);
      cells.push({
        table: t.id,
        epoch: row.epoch,
        phase: row.phase,
        culture_id: cid,
        cult: culture.cult,
        culture_label: culture.label,
        epoch_label: row.label,
        text: cell.text,
        note: cell.note || null,
      });
    }
  }
}

if (errors.length) { console.error("build-comparative-table: ERRORS\n  " + errors.join("\n  ")); process.exit(1); }

mkdirSync(resolve(ROOT, "data/indexes"), { recursive: true });
writeFileSync(resolve(ROOT, "data/indexes/comparative-cells.json"), JSON.stringify({ cells }, null, 2));
console.log(`build-comparative-table: ${files.length} table(s), ${cells.length} cells validated.`);
