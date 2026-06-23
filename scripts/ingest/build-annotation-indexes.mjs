// build-annotation-indexes.mjs — group resolved annotations into the indexes the pages consume.
// The public gate is applied HERE so a draft can never reach a page: an annotation is public only
// when content_status=student-ready AND citation_status=verified AND it names the right surface.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { annotations } = JSON.parse(readFileSync(resolve(ROOT, "data/indexes/annotations.resolved.json"), "utf8"));

function publicOn(a, surface) {
  return (
    a.status.content_status === "student-ready" &&
    a.status.citation_status === "verified" &&
    (a.status.surfaces || []).includes(surface)
  );
}

// Reader index: public-on-reader, grouped by unit, sorted by position.
const byUnit = {};
for (const a of annotations) {
  if (!publicOn(a, "reader")) continue;
  (byUnit[a.unit_id] ||= []).push(a);
}
for (const uid of Object.keys(byUnit)) {
  byUnit[uid].sort((x, y) => x.selector.position.start - y.selector.position.start);
}

// Tag indexes (culture:/concept:) over reader-public annotations.
const byTag = {};
for (const list of Object.values(byUnit)) {
  for (const a of list) {
    for (const t of a.tags || []) (byTag[t] ||= []).push({ unit_id: a.unit_id, id: a.id, anchor: a.anchor });
    for (const c of a.cultures || []) (byTag[`culture:${c}`] ||= []).push({ unit_id: a.unit_id, id: a.id, anchor: a.anchor });
  }
}

mkdirSync(resolve(ROOT, "data/indexes"), { recursive: true });
writeFileSync(resolve(ROOT, "data/indexes/annotations-by-unit.json"), JSON.stringify(byUnit, null, 2));
writeFileSync(resolve(ROOT, "data/indexes/annotations-by-tag.json"), JSON.stringify(byTag, null, 2));

const total = Object.values(byUnit).reduce((n, l) => n + l.length, 0);
console.log(`build-annotation-indexes: ${total} public annotations across ${Object.keys(byUnit).length} unit(s); ${Object.keys(byTag).length} tags.`);
