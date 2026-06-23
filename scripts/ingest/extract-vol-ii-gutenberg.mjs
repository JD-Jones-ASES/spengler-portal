// extract-vol-ii-gutenberg.mjs — one-off source conversion.
//
// Turns the clean, human-proofread Project Gutenberg HTML of Decline Vol II (eBook #78914) into a
// plain-text reading source in the SAME shape as the clean Vol I source (Spengler_Decline_I.txt):
//   - a "CONTENTS OF VOLUME II" block (Spengler's marginal-summary topics → the concordance)
//   - "CHAPTER <ROMAN>" header lines
//   - one paragraph per line, with page numbers glued at paragraph starts (so the cleaner's
//     depaginate rebuilds the page-map the concordance binds topics to)
//   - lone-Roman section markers ("I", "II", …)
//   - inline [N] footnote references
//   - a global-numbered endnotes block ("N. body") after the last chapter
// so the existing line-paragraphs cleaner + footnote/concordance builders process it exactly like Vol I.
//
// raw/ is read-only: this reads the user-supplied HTML and writes a NEW raw file; it never touches the
// original OCR source. The HTML and the generated .txt both live in (gitignored) raw/; only derived/ is
// committed. It also prints the per-chapter start pages to set as textStartPage in works.config.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = resolve(ROOT, "raw", "The Decline of the West, Vol. 2 _ Project Gutenberg.html");
const OUT = resolve(ROOT, "raw", "Spengler_Decline_II_Gutenberg.txt");
const ROMANS = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV"];

function decode(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&hellip;/g, "…")
    .replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘").replace(/&rdquo;/g, "”").replace(/&ldquo;/g, "“");
}
const clean = (s) => decode(s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/ /g, " ").replace(/\s+/g, " ").trim();
// Replace every page-number span (two formats: standalone <span class="pagenum">…<a id="pN">…[N]</span>
// and inline <span class="pagenum" id="pN">[N]</span>) with " N" — a leading space (so it can't merge
// with the preceding word) and the bare number glued to the FOLLOWING char, which is what the cleaner's
// depaginate expects (it then strips the number and records page N in the page-map).
function gluePages(s) {
  return s.replace(/<span class="pagenum"([^>]*)>([\s\S]*?)<\/span>/g, (_, attrs, body) => {
    const a = attrs.match(/id="p(\d+)"/);
    const ids = [...body.matchAll(/id="p(\d+)"/g)].map((m) => +m[1]);
    const p = a ? +a[1] : (ids.length ? ids[ids.length - 1] : null);
    return p == null ? "" : ` ${p}`;
  });
}

let html = readFileSync(SRC, "utf8");
// Verse / quote blocks → a single paragraph each (flatten inner <p>/<br>), before the block walk.
html = html.replace(/<div class="(?:stanza|poetry|blockquote|blockquot)"[^>]*>([\s\S]*?)<\/div>/g,
  (_, inner) => "<p>" + inner.replace(/<\/?p[^>]*>/g, " ").replace(/<br\s*\/?>/g, " ") + "</p>");

const lines = [];

// ---- 1. Contents block (the concordance source), parsed from the HTML table of contents ----
const tocStart = html.indexOf("CONTENTS OF VOLUME");
const tocEnd = html.indexOf('id="CHAPTER_I"');
const toc = html.slice(tocStart, tocEnd);
const tocRe = /<span class="smcap">\s*Chapter\s+([IVXLC]+)\.\s*([\s\S]*?)<\/span>[\s\S]*?<td class="tdr">[\s\S]*?>\s*(\d+)\s*<\/a>[\s\S]*?<td class="tocdesc">([\s\S]*?)<\/td>/g;
const startPages = {};
let tm;
lines.push("CONTENTS OF VOLUME II");
while ((tm = tocRe.exec(toc)) !== null) {
  const roman = tm[1];
  const title = clean(tm[2]);
  const startPage = +tm[3];
  const summary = clean(tm[4]); // "Topic, p. 3. Topic, p. 6. …"
  startPages[roman] = startPage;
  lines.push(`Chapter ${roman}. ${title}\t${startPage}`);
  lines.push(summary);
}
if (Object.keys(startPages).length !== 14) throw new Error(`TOC parse: got ${Object.keys(startPages).length} chapters, expected 14`);

// ---- 2. Chapters: walk blocks (h3 sections + p paragraphs), glue page numbers, keep [N] refs ----
const marks = ROMANS.map((r) => {
  const idx = html.indexOf(`id="CHAPTER_${r}"`);
  if (idx < 0) throw new Error(`missing CHAPTER_${r}`);
  return { roman: r, idx };
}).sort((a, b) => a.idx - b.idx);
const fnIdx = html.indexOf('id="FOOTNOTES"');
if (fnIdx < 0) throw new Error("missing FOOTNOTES section");

for (let i = 0; i < marks.length; i++) {
  const region = html.slice(marks[i].idx, i + 1 < marks.length ? marks[i + 1].idx : fnIdx).replace(/^[\s\S]*?<\/h2>/, "");
  lines.push(`CHAPTER ${marks[i].roman}`);
  const blockRe = /<h3[^>]*>([\s\S]*?)<\/h3>|<p[^>]*>([\s\S]*?)<\/p>/g;
  let m, paras = 0, pending = "";
  while ((m = blockRe.exec(region)) !== null) {
    if (m[1] !== undefined) { // h3: a lone-Roman section marker (may carry a footnote anchor, e.g. "I[1]")
      const t = clean(m[1]).replace(/\[\d+\]/g, "").trim();
      if (/^[IVXLC]+$/.test(t)) lines.push(t);
      continue;
    }
    const t = clean(gluePages(m[2])); // page-number spans → inline " N" (glued to next char), then strip tags
    if (/^\d+$/.test(t)) { pending = t; continue; } // a standalone page-number paragraph → carry to next
    if (!t) continue;
    lines.push((pending ? pending : "") + t); // glue a carried page number to this paragraph's start
    pending = "";
    paras++;
  }
  if (!paras) throw new Error(`CHAPTER ${marks[i].roman}: no paragraphs extracted`);
}

// ---- 3. Footnote definitions → "N. body", sorted globally ----
const fnRe = /<div class="footnote">([\s\S]*?)<\/div>/g;
const notes = [];
let fm;
const fnRegion = html.slice(fnIdx);
while ((fm = fnRe.exec(fnRegion)) !== null) {
  const nm = fm[1].match(/id="Footnote_(\d+)"/);
  if (!nm) continue;
  const body = clean(fm[1].replace(/<a[^>]*id="Footnote_\d+"[^>]*>\s*\[\d+\]\s*<\/a>/, ""));
  if (body) notes.push({ n: +nm[1], body });
}
notes.sort((a, b) => a.n - b.n);
for (const note of notes) lines.push(`${note.n}. ${note.body}`);

writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
console.log(`extract-vol-ii-gutenberg: ${marks.length} chapters, ${notes.length} footnotes → ${OUT}`);
console.log("textStartPage per chapter:", ROMANS.map((r) => `${r}=${startPages[r]}`).join(" "));
