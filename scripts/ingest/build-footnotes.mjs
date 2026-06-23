// build-footnotes.mjs — extract the translator/author endnotes from the raw Decline volumes.
//
// Decline I collects footnotes as a single globally-numbered block ("N. body … —Tr.") after the main
// text. We parse that block into {number, body} and map each note to the unit(s) that reference it
// (the footnote_refs were recorded in the spine by build-cleaned-spine).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const config = JSON.parse(readFileSync(resolve(ROOT, "data/works/works.config.json"), "utf8"));

function volKey(workId, volId) { return volId ? `${workId}-${volId}` : workId; }

let total = 0;
for (const work of config.works) {
  for (const vol of work.volumes) {
    if (vol.text_status === "raw-deferred") continue;
    if (!vol.endnotes || vol.endnotes.style !== "global-numbered") {
      writeFileSync(resolve(ROOT, "derived", `${volKey(work.id, vol.id)}.footnotes.json`), JSON.stringify({ work: work.id, volume: vol.id, footnotes: [] }, null, 2));
      continue;
    }
    const vk = volKey(work.id, vol.id);
    const raw = readFileSync(resolve(ROOT, vol.raw_path), "utf8").split(/\r?\n/);
    const spine = JSON.parse(readFileSync(resolve(ROOT, "derived", `${vk}.spine.json`), "utf8"));

    // Endnotes begin at the first "1. " line that follows the LAST chapter header (so a "1." that is
    // really an enumerated list item inside the prose — e.g. Vol II ch III — is not mistaken for the
    // start of the notes) and continue while the leading numbers stay roughly sequential. They end
    // where the Index begins. This mirrors how build-cleaned-spine locates the endnotes block.
    const headerRe = /^\d*CHAPTER\s+[IVXLCDM]+\s*$/;
    let lastHeader = 0;
    for (let i = 0; i < raw.length; i++) if (headerRe.test(raw[i])) lastHeader = i;
    let start = -1;
    for (let i = lastHeader; i < raw.length; i++) {
      if (/^1\.\s+\S/.test(raw[i])) { start = i; break; }
    }
    const footnotes = [];
    if (start >= 0) {
      let cur = null;
      let expected = 1;
      for (let i = start; i < raw.length; i++) {
        const line = raw[i];
        const m = line.match(/^(\d+)\.\s*(.*)$/); // body may be empty (poetry notes put it on next lines)
        if (m && parseInt(m[1], 10) === expected) {
          if (cur) footnotes.push(cur);
          cur = { number: expected, body: (m[2] || "").trim() };
          expected++;
        } else if (cur) {
          if (/^(INDEX|TABLES|TRANSCRIBER|Transcriber)/.test(line.trim())) break;
          if (line.trim()) cur.body = (cur.body ? cur.body + " " : "") + line.trim();
        }
      }
      if (cur) footnotes.push(cur);
    }

    // map number -> units that reference it
    const refMap = new Map();
    for (const ch of spine.chapters) {
      for (const fr of ch.footnote_refs || []) {
        if (!refMap.has(fr.number)) refMap.set(fr.number, new Set());
        refMap.get(fr.number).add(ch.unit_id);
      }
    }
    for (const fn of footnotes) {
      fn.units = [...(refMap.get(fn.number) || [])];
      fn.is_translator_note = /—\s*Tr\.?\s*$/.test(fn.body) || /Ency|Britann/.test(fn.body);
    }

    writeFileSync(
      resolve(ROOT, "derived", `${vk}.footnotes.json`),
      JSON.stringify({ work: work.id, volume: vol.id, source_id: work.source_id, footnotes }, null, 2)
    );
    total += footnotes.length;
    console.log(`  ✓ ${vk}: ${footnotes.length} footnotes extracted`);
  }
}
console.log(`build-footnotes: ${total} footnotes.`);
