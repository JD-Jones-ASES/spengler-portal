// build-concordance.mjs — turn Spengler's own marginal-summary Contents into a navigable topic index.
//
// Each chapter's Contents entry is a run of "Topic, p. N." pairs. We bind every topic to the paragraph
// where its page begins (via the spine's page_map). Topics whose page can't be located are kept but
// marked page-anchor-missing — a non-linking chip, never a faked deep link.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const config = JSON.parse(readFileSync(resolve(ROOT, "data/works/works.config.json"), "utf8"));
const manifest = JSON.parse(readFileSync(resolve(ROOT, "data/manifest.json"), "utf8"));
const unitsByKeyRoman = new Map(manifest.units.map((u) => [`${u.work}|${u.volume}|${u.roman}`, u]));

function paragraphForOffset(unit, offset) {
  const offs = unit.paragraph_offsets || [];
  let idx = 0;
  for (let i = 0; i < offs.length; i++) { if (offs[i] <= offset) idx = i; else break; }
  return idx;
}

let total = 0;
for (const work of config.works) {
  for (const vol of work.volumes) {
    if (vol.text_status === "raw-deferred") continue;
    const raw = readFileSync(resolve(ROOT, vol.raw_path), "utf8").split(/\r?\n/);

    // locate the Contents block
    let start = raw.findIndex((l) => /CONTENTS OF VOLUME/i.test(l));
    if (start < 0) start = 0;
    let end = raw.findIndex((l, i) => i > start && /^\d*CHAPTER\s+I\b/.test(l));
    if (end < 0) end = Math.min(start + 80, raw.length);

    // gather chapter entries: heading line then summary lines
    const entries = [];
    const chapHeadRe = /^Chapter\s+([IVXLC]+)\.\s+(.+?)\t/;
    let i = start;
    while (i < end) {
      const m = raw[i].match(chapHeadRe);
      if (!m) { i++; continue; }
      const roman = m[1];
      // collect summary text from following lines until the next chapter heading or the block end
      let summary = "";
      let j = i + 1;
      while (j < end && !chapHeadRe.test(raw[j])) {
        const t = raw[j].replace(/^[\s ]+/, "").trim();
        if (t && t !== "") summary += " " + t;
        j++;
      }
      entries.push({ roman, summary: summary.trim() });
      i = j;
    }

    const out = [];
    for (const e of entries) {
      const unit = unitsByKeyRoman.get(`${work.id}|${vol.id}|${e.roman}`);
      if (!unit) continue;
      const pageOffset = new Map((unit.page_map || []).map((p) => [p.page, p.offset]));
      // the chapter's own first page isn't glued anywhere (it's the heading) — bind it to paragraph 0
      const firstMapped = Math.min(...((unit.page_map || []).map((p) => p.page).concat([Infinity])));
      // tokenize "Topic, p. N." pairs
      const re = /p\.\s*(\d+)/g;
      let last = 0;
      let mm;
      let seq = 0;
      while ((mm = re.exec(e.summary)) !== null) {
        let topic = e.summary.slice(last, mm.index).replace(/[,.\s]+$/g, "").replace(/^[,.\s]+/g, "").trim();
        last = re.lastIndex;
        // strip a trailing connector like "p." artifacts
        topic = topic.replace(/\s+/g, " ");
        if (!topic) continue;
        const page = parseInt(mm[1], 10);
        const atStart = !pageOffset.has(page) && page < firstMapped; // chapter's opening page
        const hasAnchor = pageOffset.has(page) || atStart;
        const para = pageOffset.has(page) ? paragraphForOffset(unit, pageOffset.get(page)) : (atStart ? 0 : null);
        seq++;
        out.push({
          id: `${unit.unit_id}-t${String(seq).padStart(3, "0")}`,
          unit_id: unit.unit_id,
          work: work.id,
          volume: vol.id,
          roman: e.roman,
          topic,
          page,
          anchor_paragraph: para,
          anchor: hasAnchor ? `${unit.unit_id}#p${para}` : null,
          anchor_status: hasAnchor ? "page-anchor-resolved" : "page-anchor-missing",
          sequence: seq,
        });
      }
    }

    mkdirSync(resolve(ROOT, "data/concordance"), { recursive: true });
    const vk = vol.id ? `${work.id}-${vol.id}` : work.id;
    writeFileSync(resolve(ROOT, `data/concordance/${vk}.concordance.json`), JSON.stringify({ work: work.id, volume: vol.id, entries: out }, null, 2));
    const resolved = out.filter((x) => x.anchor_status === "page-anchor-resolved").length;
    total += out.length;
    console.log(`  ✓ ${vk}: ${out.length} topics (${resolved} anchored, ${out.length - resolved} missing)`);
  }
}
console.log(`build-concordance: ${total} topics.`);
