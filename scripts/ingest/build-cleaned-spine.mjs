// build-cleaned-spine.mjs — turn raw/ originals into the committed derived/ reading spine.
//
// PRINCIPLE: raw/ is never mutated. This is a pure, deterministic, logged transform. Every edit is
// recorded in derived/<work>.cleanup-log.json; OCR corruption that would change meaning is FLAGGED,
// never auto-fixed. The .txt files it writes ARE the reading spine — annotation selectors, the
// concordance, and the search index all anchor to these exact strings.
//
// Output per work/volume:
//   derived/<volKey>/ch-NN.txt        cleaned prose (paragraphs joined by a blank line)
//   derived/<work>.spine.json         structural metadata (segments, page-map, footnote refs) by unit
//   derived/<work>.cleanup-log.json   the audit trail

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const config = JSON.parse(readFileSync(resolve(ROOT, "data/works/works.config.json"), "utf8"));

const ROMAN = "[IVXLCDM]+";

// ----- helpers -------------------------------------------------------------

function volKey(workId, volId) {
  return volId ? `${workId}-${volId}` : workId;
}
export function slugify(title) {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function unitId(workId, volId, ch) {
  const vk = volId ? `${workId}-${volId}` : workId;
  return `${vk}-ch-${String(ch.n).padStart(2, "0")}-${slugify(ch.title)}`;
}

// Find chapter header line indices. Returns array of {line, leading, roman} for every header-ish
// "[page]CHAPTER <ROMAN>" (Decline) or "Chapter <ROMAN>" (Man & Technics) line.
function findHeaders(lines, headerRe) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headerRe);
    if (m) hits.push({ line: i, leading: m[1] || "", roman: m[2] });
  }
  return hits;
}

// Strip glued page-number anchors using a running page counter, returning {text, pages:[{page,offset}]}.
// A 1-3 digit number glued to a following letter is a page anchor only when it falls in the running
// window and is not an ordinal (19th, 1st…). offsets are into the returned text.
function depaginate(text, startPage) {
  const pages = [];
  let running = startPage;
  let out = "";
  let i = 0;
  const re = /(\d{1,3})([A-Za-z])/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const num = parseInt(m[1], 10);
    const numEnd = m.index + m[1].length;
    // Ordinal only if the suffix (th/st/nd/rd) is NOT followed by another letter — so "19th " is an
    // ordinal but "43that" (page 43 glued to the word "that") is a real page anchor.
    const suffix = text.slice(numEnd, numEnd + 2).toLowerCase();
    const afterSuffix = text[numEnd + 2] || "";
    const isOrdinal = /^(th|st|nd|rd)$/.test(suffix) && !/[A-Za-z]/.test(afterSuffix);
    const inWindow = num >= running && num <= running + 4;
    // Must be preceded by a non-digit (so we don't split a longer number) — the regex \d{1,3} is
    // greedy but a 4-digit year like 1672 yields num=167 with preceding '1'; guard on that.
    const precededByDigit = m.index > 0 && /\d/.test(text[m.index - 1]);
    if (inWindow && !isOrdinal && !precededByDigit) {
      out += text.slice(last, m.index); // keep prose up to the number
      pages.push({ page: num, offset: out.length }); // page `num` begins here
      out += m[2]; // keep the letter that followed the number
      last = m.index + m[0].length;
      running = num;
    }
  }
  out += text.slice(last);
  return { text: out, pages };
}

// Apply an OCR corrections overlay to assembled chapter text. Each correction names the OCR token
// (`before`), the fix (`after`), and a `context` snippet (the OCR-version sentence fragment) to locate
// the right occurrence. Returns the corrected text, the applied list (with offsets in the NEW text),
// and the edit points so other offset arrays (paragraphs, footnotes) can be re-based.
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function applyCorrections(text, corrections) {
  // resolve each correction to one or more [start,end) spans in the ORIGINAL text.
  // A correction with `context` is a single, context-anchored replacement (for ambiguous / multi-word
  // tokens). A correction without `context` is a GLOBAL whole-token replacement — every occurrence of
  // the garble token (which is a non-word, so this is safe) is fixed.
  const spans = [];
  for (const c of corrections) {
    if (c.context) {
      let ci = text.indexOf(c.context);
      if (ci < 0) continue;
      const within = c.context.indexOf(c.before);
      const start = within >= 0 ? ci + within : ci;
      spans.push({ start, end: start + c.before.length, c });
    } else {
      const re = new RegExp(`(?<![A-Za-z])${escapeRe(c.before)}(?![A-Za-z])`, "g");
      let m;
      while ((m = re.exec(text)) !== null) spans.push({ start: m.index, end: m.index + c.before.length, c });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  let out = "";
  let cur = 0;
  const applied = [];
  const edits = [];
  for (const s of spans) {
    if (s.start < cur) continue; // overlap guard
    out += text.slice(cur, s.start);
    const offset = out.length;
    out += s.c.after;
    applied.push({ offset, before: s.c.before, after: s.c.after, method: s.c.method || "llm-nonword", confidence: s.c.confidence || "high" });
    edits.push({ pos: s.start, delta: s.c.after.length - s.c.before.length });
    cur = s.end;
  }
  out += text.slice(cur);
  return { text: out, applied, edits };
}
function rebase(offset, edits) {
  let d = 0;
  for (const e of edits) if (e.pos < offset) d += e.delta;
  return offset + d;
}

// ----- per-layout cleaning -------------------------------------------------

// Decline volumes: one paragraph per line. Slice each chapter, drop the doubled running header +
// title, keep lone-Roman section markers, de-paginate, pull [N] footnote refs out of the prose.
function cleanLineParagraphs(rawLines, chapters) {
  const headerRe = new RegExp(`^(\\d*)CHAPTER\\s+(${ROMAN})\\s*$`);
  const headers = findHeaders(rawLines, headerRe);
  // endnotes begin at the first "1. " line after the last header.
  const lastHeaderLine = headers.length ? headers[headers.length - 1].line : 0;
  let endnotesStart = rawLines.length;
  for (let i = lastHeaderLine; i < rawLines.length; i++) {
    if (/^1\.\s+\S/.test(rawLines[i])) { endnotesStart = i; break; }
  }

  const out = [];
  for (let ci = 0; ci < chapters.length; ci++) {
    const ch = chapters[ci];
    // real header = the headerRe hit for this roman with no leading page digits
    const real = headers.find((h) => h.roman === ch.roman && h.leading === "");
    if (!real) { out.push({ ch, error: `no header for CHAPTER ${ch.roman}` }); continue; }
    // boundary = first header hit for the NEXT chapter, else endnotes start
    const next = chapters[ci + 1];
    let end = endnotesStart;
    if (next) {
      const nh = headers.find((h) => h.roman === next.roman && h.line > real.line);
      if (nh) end = nh.line;
    }
    const body = rawLines.slice(real.line + 1, end);

    // Walk lines: skip title (ALL-CAPS / blank), capture last lone-Roman before first prose as the
    // opening section, then collect paragraphs and section markers.
    const paragraphs = [];
    const segments = []; // {roman, beforeParagraph}
    let started = false;
    let pendingSeg = null;
    for (const lnRaw of body) {
      const ln = lnRaw.trim();
      if (!ln) continue;
      const isRoman = new RegExp(`^${ROMAN}$`).test(ln);
      const isAllCaps = /^[A-Z0-9 .,:;()'"‘’“”-]+$/.test(ln) && /[A-Z]/.test(ln) && !/[a-z]/.test(ln);
      if (!started) {
        if (isRoman) { pendingSeg = ln; continue; }       // remember as opening section
        if (isAllCaps && ln.length < 70) continue;          // title line
        // first prose line
        started = true;
        if (pendingSeg) segments.push({ roman: pendingSeg, beforeParagraph: 0 });
        paragraphs.push(ln);
        continue;
      }
      if (isRoman) { segments.push({ roman: ln, beforeParagraph: paragraphs.length }); continue; }
      paragraphs.push(ln);
    }

    out.push({ ch, paragraphs, segments });
  }
  return finishChapters(out);
}

// Reflow a block of wrapped lines into one paragraph string (collapse spacing, de-hyphenate breaks).
function reflowBlock(para) {
  let joined = "";
  for (let k = 0; k < para.length; k++) {
    let seg = para[k].replace(/\s+/g, " ").trim();
    if (joined === "") { joined = seg; continue; }
    if (/[A-Za-z]-$/.test(joined)) {
      const nextStartsUpper = /^[A-Z]/.test(seg);
      joined = nextStartsUpper ? joined + seg : joined.slice(0, -1) + seg;
    } else {
      joined += " " + seg;
    }
  }
  return joined.replace(/\s+([,.;:!?])/g, "$1").replace(/\s+/g, " ").trim();
}

// A wrapped-layout block that is a running head / title / sub-subtitle, not prose: short, predominantly
// upper-case, and not a finished sentence. Catches "4 THE DECLINE OF THE WEST", "THE COSMIC AND THE
// MICROCOSM 5", the leaked "THE cosmc AND THE MICROCOSM", "ORIGIN AND LANDSCAPE", "(A)", "CA)".
function isHeadingBlock(para) {
  const s = para.map((l) => l.replace(/\s+/g, " ").trim()).join(" ").trim();
  if (!s || s.length >= 70) return false;
  if (/^[IVXLC]+$/.test(s)) return false; // a Roman section marker — handled separately, not dropped
  const letters = s.replace(/[^A-Za-z]/g, "");
  const upper = (s.match(/[A-Z]/g) || []).length;
  if (/decline\s+of\s+the\s+west/i.test(s) && (!letters.length || upper / letters.length > 0.5)) return true;
  if (letters.length) {
    const ratio = upper / letters.length;
    if (ratio >= 0.85) return true;                            // essentially all-caps → a running head
    if (ratio >= 0.6 && !/[.?!]["'’)]?$/.test(s)) return true; // mostly caps + not a finished sentence
  }
  if (/^\(?[A-Z]\)?$/.test(s) || /^C[A-Z]\)$/.test(s)) return true; // (A) / CA)
  return false;
}

// Man & Technics: paragraphs wrap across lines with hyphenation; collapse the heavy inter-word
// spacing, reflow, de-hyphenate line breaks. `cleaning` (Vol-II-only, optional) enables running-header
// dropping and symbol-footnote extraction without changing M&T's output.
function cleanWrapped(rawLines, chapters, cleaning) {
  const headerRe = new RegExp(`^(\\d*)\\s*Chapter\\s+(${ROMAN})\\s*$`, "i");
  const headers = findHeaders(rawLines, headerRe);
  const out = [];
  for (let ci = 0; ci < chapters.length; ci++) {
    const ch = chapters[ci];
    const real = headers.find((h) => h.roman.toUpperCase() === ch.roman && h.line > (ci === 0 ? 0 : -1));
    // pick the LAST matching header before the next chapter's (handles TOC + body duplicates)
    const mine = headers.filter((h) => h.roman.toUpperCase() === ch.roman);
    const start = mine.length ? mine[mine.length - 1].line : (real ? real.line : -1);
    if (start < 0) { out.push({ ch, error: `no header for Chapter ${ch.roman}` }); continue; }
    const next = chapters[ci + 1];
    let end = rawLines.length;
    if (next) {
      const nm = headers.filter((h) => h.roman.toUpperCase() === next.roman && h.line > start);
      if (nm.length) end = nm[0].line;
    }
    // cap the last chapter at the back-matter (Index) so it doesn't swallow it
    if (cleaning?.back_matter) {
      const bmRe = new RegExp(cleaning.back_matter);
      for (let i = start + 1; i < end; i++) { if (bmRe.test(rawLines[i])) { end = i; break; } }
    }
    let body = rawLines.slice(start + 1, end);

    if (!cleaning?.drop_headings) {
      // legacy path (M&T): drop only a leading ALL-CAPS title block
      let bi = 0;
      while (bi < body.length) {
        const ln = body[bi].trim();
        if (!ln) { bi++; continue; }
        const isAllCaps = /[A-Z]/.test(ln) && !/[a-z]/.test(ln);
        if (isAllCaps && ln.length < 70) { bi++; continue; }
        break;
      }
      body = body.slice(bi);
    }

    // group lines into blocks separated by blank lines
    const rawParas = [];
    let cur = [];
    for (const ln of body) {
      if (!ln.trim()) { if (cur.length) { rawParas.push(cur); cur = []; } continue; }
      cur.push(ln);
    }
    if (cur.length) rawParas.push(cur);

    const markers = cleaning?.footnote_markers || null;
    const markerRe = markers ? new RegExp(`^\\s*[${markers.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("")}]\\s`) : null;
    const paragraphs = [];
    const segments = [];
    const footnotes = [];
    let droppedHeadings = 0;
    for (const para of rawParas) {
      const first = para[0].replace(/\s+/g, " ").trim();
      if (cleaning?.drop_headings && isHeadingBlock(para)) { droppedHeadings++; continue; }
      if (cleaning?.drop_headings && /^[IVXLC]+$/.test(first)) { segments.push({ roman: first, beforeParagraph: paragraphs.length }); continue; }
      if (markerRe && markerRe.test(para[0])) {
        const body = reflowBlock(para).replace(markerRe, "").trim();
        if (body.length >= 3) footnotes.push({ marker: first[0], body });
        continue;
      }
      const joined = reflowBlock(para);
      if (joined.length < 3) continue;
      if (/^\d{1,3}$/.test(joined)) continue;
      paragraphs.push(joined);
    }
    out.push({ ch, paragraphs, segments, footnotes, droppedHeadings });
  }
  return finishChapters(out);
}

// Common finishing: de-paginate, pull footnote refs, assemble the .txt string + offsets.
function finishChapters(chapterParts) {
  const flagged = [];
  const editCount = { depaginate: 0, footnoteRef: 0, headingsDropped: 0, footnotesExtracted: 0 };
  const results = [];
  for (const part of chapterParts) {
    if (part.error) { results.push(part); continue; }
    const { ch, paragraphs, segments } = part;
    editCount.headingsDropped += part.droppedHeadings || 0;
    editCount.footnotesExtracted += (part.footnotes || []).length;
    let text = "";
    const pageMap = [];
    const footnoteRefs = [];
    const paraOffsets = [];
    paragraphs.forEach((p, idx) => {
      if (idx > 0) text += "\n\n";
      const base = text.length;
      paraOffsets.push(base);
      // de-paginate this paragraph relative to running page; thread running page across paragraphs
      const startPage = pageMap.length ? pageMap[pageMap.length - 1].page : ch.textStartPage || 1;
      const dep = depaginate(p, startPage);
      editCount.depaginate += dep.pages.length;
      for (const pg of dep.pages) pageMap.push({ page: pg.page, offset: base + pg.offset });
      // pull [N] footnote references out, recording their offset
      let clean = "";
      let last = 0;
      const fre = /\[(\d{1,3})\]/g;
      let fm;
      while ((fm = fre.exec(dep.text)) !== null) {
        clean += dep.text.slice(last, fm.index);
        footnoteRefs.push({ number: parseInt(fm[1], 10), offset: base + clean.length });
        editCount.footnoteRef++;
        last = fm.index + fm[0].length;
      }
      clean += dep.text.slice(last);
      text += clean;
    });
    results.push({ ch, text, segments, pageMap, footnoteRefs, paraOffsets, footnotes: part.footnotes || [] });
  }
  return { results, flagged, editCount };
}

// ----- shared exports ------------------------------------------------------
// The mechanically-cleaned (PRE-overlay) chapter text for a volume — the exact string that
// applyCorrections resolves its `context`/`before` spans against. The OCR-review apply step
// validates new human corrections against THIS, not against derived/ (which already has the
// overlay applied), so contexts captured before correction still anchor.
export function buildMechanical(vol) {
  const raw = readFileSync(resolve(ROOT, vol.raw_path), "utf8");
  const lines = raw.split(/\r?\n/);
  const cleaner = vol.layout === "wrapped" ? cleanWrapped : cleanLineParagraphs;
  return cleaner(lines, vol.chapters, vol.cleaning).results; // [{ ch, text, ... } | { ch, error }]
}
export { config, volKey, unitId, cleanWrapped, cleanLineParagraphs, applyCorrections };

// ----- run -----------------------------------------------------------------

function main() {
let totalChapters = 0;
for (const work of config.works) {
  for (const vol of work.volumes) {
    if (vol.text_status === "raw-deferred") {
      console.log(`  • ${work.id}/${vol.id || "—"}: registered raw-deferred (body not published)`);
      continue;
    }
    const rawPath = resolve(ROOT, vol.raw_path);
    const raw = readFileSync(rawPath, "utf8");
    const sha = createHash("sha256").update(raw).digest("hex");
    const lines = raw.split(/\r?\n/);

    const cleaner = vol.layout === "wrapped" ? cleanWrapped : cleanLineParagraphs;
    const { results, flagged, editCount } = cleaner(lines, vol.chapters, vol.cleaning);

    const vk = volKey(work.id, vol.id);
    // OCR corrections overlay (authored by the /ocr-correct workflow). raw/ is never touched.
    const overlayPath = resolve(ROOT, "corrections", `${vk}.corrections.json`);
    const overlay = existsSync(overlayPath) ? JSON.parse(readFileSync(overlayPath, "utf8")).corrections || [] : [];
    let ocrApplied = 0;

    const outDir = resolve(ROOT, "derived", vk);
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    const spineChapters = [];
    for (const r of results) {
      if (r.error) { console.warn(`  ! ${vk} CHAPTER ${r.ch.roman}: ${r.error}`); continue; }
      // apply the corrections overlay to this chapter's assembled text, then re-base the offset arrays
      let text = r.text, pageMap = r.pageMap, footnoteRefs = r.footnoteRefs, paraOffsets = r.paraOffsets;
      let ocrCorrections = [];
      if (overlay.length) {
        const ap = applyCorrections(r.text, overlay);
        text = ap.text;
        ocrCorrections = ap.applied;
        ocrApplied += ap.applied.length;
        pageMap = r.pageMap.map((p) => ({ ...p, offset: rebase(p.offset, ap.edits) }));
        footnoteRefs = r.footnoteRefs.map((f) => ({ ...f, offset: rebase(f.offset, ap.edits) }));
        paraOffsets = r.paraOffsets.map((o) => rebase(o, ap.edits));
      }
      const uid = unitId(work.id, vol.id, r.ch);
      const fname = `ch-${String(r.ch.n).padStart(2, "0")}.txt`;
      writeFileSync(resolve(outDir, fname), text, "utf8");
      spineChapters.push({
        unit_id: uid,
        work: work.id,
        volume: vol.id,
        n: r.ch.n,
        roman: r.ch.roman,
        title: r.ch.title,
        function: r.ch.function,
        text_status: vol.text_status,
        source_id: work.source_id,
        source_raw_path: vol.raw_path,
        clean_path: `derived/${vk}/${fname}`,
        char_count: text.length,
        paragraph_count: paraOffsets.length,
        paragraph_offsets: paraOffsets,
        segments: r.segments,
        page_map: pageMap,
        footnote_refs: footnoteRefs,
        ocr_corrections: ocrCorrections,
        extracted_footnotes: r.footnotes || [],
      });
      totalChapters++;
    }

    writeFileSync(
      resolve(ROOT, "derived", `${vk}.spine.json`),
      JSON.stringify({ work: work.id, volume: vol.id, source_id: work.source_id, source_sha256: sha, generator: "build-cleaned-spine@1", chapters: spineChapters }, null, 2)
    );
    writeFileSync(
      resolve(ROOT, "derived", `${vk}.cleanup-log.json`),
      JSON.stringify({ source_file: vol.raw_path, source_sha256: sha, layout: vol.layout, rules_applied: editCount, ocr_corrections_applied: ocrApplied, flagged }, null, 2)
    );
    console.log(`  ✓ ${vk}: ${spineChapters.length} chapters, ${editCount.depaginate} page anchors, ${editCount.footnoteRef} footnote refs${overlay.length ? `, ${ocrApplied} OCR corrections applied` : ""}`);
  }
}
console.log(`build-cleaned-spine: ${totalChapters} chapters cleaned.`);
}

// Run only when invoked directly (not when imported by the OCR-review apply step).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
