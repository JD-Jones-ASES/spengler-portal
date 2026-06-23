// validate-basic.mjs — the build gate. Fails loud on schema violations and on the two verification
// rules that keep the apparatus honest:
//   (a) a factual teaching note must cite a source OTHER than the Spengler text;
//   (b) a scholarly-reception / interpretation note must name a scholar, cite a scholarly-secondary
//       source, be flagged view:interpretation, and be ATTRIBUTED in prose, never asserted as fact.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
const schema = (n) => ajv.compile(read(`schemas/${n}.schema.json`));
const vSource = schema("source-record");
const vAnn = schema("annotation");
const vLex = schema("lexicon");
const vTable = schema("comparative-table");
const vTimeline = schema("timeline");

const SPENGLER_TEXT = new Set(["gutenberg-decline-i", "gutenberg-decline-ii", "internet-archive-decline-ii", "internet-archive-man-and-technics", "spengler-mensch-technik-de-1931"]);
// Lexicon edge-type families (kept in sync with the schema's $comment legend).
const INTERLOCUTOR_REL = new Set(["coined-from", "borrows-from", "breaks-with"]);
const INTERPRETIVE_EDGE = new Set(["contrasts-with", "coined-from", "borrows-from", "breaks-with", "narrows", "analogous-to", "symptom-of"]);
const EVALUATIVE_EDGE = new Set(["contrasts-with", "narrows", "breaks-with", "analogous-to", "symptom-of"]);
const FACTUAL = new Set(["lexical-definition", "historical-context", "cross-cultural-context", "translation-philology", "publication-context"]);
const BANNED_ASSERTION = /\bSpengler\s+(is|was)\s+(wrong|right|mistaken|refuted|vindicated|correct|proven)\b/i;

const errors = [];
const fail = (m) => errors.push(m);

// ---- sources ----
const sources = read("data/sources/decline.sources.json");
if (!vSource(sources)) for (const e of vSource.errors) fail(`sources${e.instancePath} ${e.message}`);
const sourceById = new Map(sources.records.map((r) => [r.id, r]));

// ---- provenance drift-killer (the v1.2.0 rule) ----
// A published (text_status:clean) volume must name a live source-text record: it must resolve, must
// NOT be a RETIRED record, and must NOT still describe the body as deferred/withheld pending cleanup.
// This makes the "Vol II re-sourced but its record wasn't updated" contradiction a hard build failure.
const DEFERRAL = /\bdeferred\b|\bwithheld\b|raw-deferred|OCR cleanup|cleanup pass|pending [^.]*(?:OCR|cleanup)/i;
for (const w of read("data/works/works.config.json").works) {
  for (const v of w.volumes || []) {
    const where = `works/${w.id}/${v.id ?? "(single)"}`;
    const sid = v.source_text_id;
    if (!sid) { fail(`${where}: volume has no source_text_id (link it to its source-text record)`); continue; }
    const rec = sourceById.get(sid);
    if (!rec) { fail(`${where}: source_text_id '${sid}' is not a known source record`); continue; }
    if (v.text_status === "clean") {
      if (/\bRETIRED\b/.test(rec.source_note)) fail(`${where}: clean volume points at RETIRED source '${sid}' — repoint source_text_id at the live record`);
      if (DEFERRAL.test(rec.source_note)) fail(`${where}: clean volume's source '${sid}' still describes deferred/withheld text — fix the source_note or the status`);
    }
  }
}

// ---- annotations + dual gate ----
const annDir = resolve(ROOT, "data/annotations");
let annCount = 0;
for (const file of readdirSync(annDir).filter((f) => f.endsWith(".annotations.json"))) {
  const data = read(`data/annotations/${file}`);
  if (!vAnn(data)) for (const e of vAnn.errors) fail(`${file}${e.instancePath} ${e.message}`);
  for (const a of data.annotations) {
    annCount++;
    const where = `${data.unit_id}/${a.id}`;
    const citations = new Set();
    for (const ev of a.evidence || []) for (const c of ev.citations || []) citations.add(c);
    // every cited source must exist
    for (const c of citations) if (!sourceById.has(c)) fail(`${where}: cites unknown source '${c}'`);

    const claimTypes = (a.evidence || []).map((e) => e.claim_type);
    const isInterpretation = a.kind === "scholarly-reception" || claimTypes.includes("scholarly-interpretation");

    if (isInterpretation) {
      // branch (b)
      const at = a.attribution;
      if (!at || !at.scholar || !at.citation) fail(`${where}: interpretation note needs attribution{scholar,citation}`);
      else {
        const src = sourceById.get(at.citation);
        if (!src) fail(`${where}: attribution cites unknown source '${at.citation}'`);
        else if (src.kind !== "scholarly-secondary") fail(`${where}: attribution must cite a scholarly-secondary source, got '${src.kind}'`);
        const surname = at.scholar.split(/\s+/).pop();
        if (surname && !a.note.includes(surname) && !a.note.includes(at.scholar)) fail(`${where}: interpretation prose must name the scholar (${at.scholar})`);
      }
      if (!(a.tags || []).includes("view:interpretation")) fail(`${where}: interpretation note must carry tag 'view:interpretation'`);
      if (BANNED_ASSERTION.test(a.note)) fail(`${where}: interpretation asserts a contested claim as fact (use an attributive frame)`);
    } else if (claimTypes.some((t) => FACTUAL.has(t))) {
      // branch (a): must cite a non-Spengler source
      const external = [...citations].filter((c) => !SPENGLER_TEXT.has(c));
      if (external.length === 0) fail(`${where}: factual teaching note must cite a source other than the Spengler text`);
    }
  }
}

// ---- public-gate defence in depth: nothing draft in the reader index ----
if (existsSync(resolve(ROOT, "data/indexes/annotations-by-unit.json"))) {
  const byUnit = read("data/indexes/annotations-by-unit.json");
  for (const list of Object.values(byUnit)) {
    for (const a of list) {
      if (a.status.content_status !== "student-ready" || a.status.citation_status !== "verified") {
        fail(`reader index leak: ${a.id} is not student-ready+verified`);
      }
      if (!a.selector.position) fail(`reader index: ${a.id} has no resolved selector position`);
    }
  }
}

// ---- lexicon ----
const lex = read("data/lexicon/spengler.lexicon.json");
if (!vLex(lex)) for (const e of vLex.errors) fail(`lexicon${e.instancePath} ${e.message}`);
const termIds = new Set(lex.terms.map((t) => t.id));
const termKind = new Map(lex.terms.map((t) => [t.id, t.kind || "concept"]));
for (const t of lex.terms) {
  for (const c of t.citations || []) if (!sourceById.has(c)) fail(`lexicon/${t.id}: unknown citation '${c}'`);
  for (const s of t.secondary || []) if (!sourceById.has(s)) fail(`lexicon/${t.id}: unknown secondary '${s}'`);
  // a public term must cite at least one non-Spengler source (it teaches a definition)
  if (t.status.content_status === "student-ready") {
    const ext = (t.citations || []).concat(t.secondary || []).filter((c) => !SPENGLER_TEXT.has(c));
    if (ext.length === 0) fail(`lexicon/${t.id}: public term must cite a non-Spengler source`);
  }
}
// Edge-level verification (the v1.1 dual gate at the edge). NB: this confirms a claim is
// attributed to the RIGHT KIND of source, not that the source actually supports it — closing
// that residual gap is the adversarial-review pass, not the gate.
for (const e of lex.edges) {
  const where = `lexicon edge ${e.source}--${e.type}-->${e.target}`;
  if (!termIds.has(e.source)) fail(`${where}: unknown source term '${e.source}'`);
  if (!termIds.has(e.target)) fail(`${where}: unknown target term '${e.target}'`);
  for (const c of e.citations || []) if (!sourceById.has(c)) fail(`${where}: unknown citation '${c}'`);
  for (const s of e.secondary || []) if (!sourceById.has(s)) fail(`${where}: unknown secondary '${s}'`);
  // (c) a borrowing / break relation must point at an interlocutor (source-thinker) node.
  if (INTERLOCUTOR_REL.has(e.type) && termKind.get(e.target) !== "interlocutor")
    fail(`${where}: '${e.type}' must point at an interlocutor node (target '${e.target}' is ${termKind.get(e.target) || "missing"})`);
  // (d) interpretive edges must carry >=1 citation; the evaluative subset must also name a scholar.
  if (INTERPRETIVE_EDGE.has(e.type)) {
    if (!(e.citations || []).length) fail(`${where}: interpretive '${e.type}' edge needs >=1 citation`);
    if (EVALUATIVE_EDGE.has(e.type)) {
      const named = (e.secondary || []).filter((s) => sourceById.get(s)?.kind === "scholarly-secondary");
      if (!named.length) fail(`${where}: evaluative '${e.type}' edge must name a scholarly-secondary source`);
    }
  }
}

// ---- comparative tables ----
// passage_targets must resolve to a real reading unit + an in-range paragraph (unit#pN, 0-based).
const manifest = read("data/manifest.json");
const paraCountByUnit = new Map((manifest.units || []).map((u) => [u.unit_id, u.paragraph_count ?? 0]));
for (const file of readdirSync(resolve(ROOT, "data/comparative")).filter((f) => f.endsWith(".table.json"))) {
  const t = read(`data/comparative/${file}`);
  if (!vTable(t)) for (const e of vTable.errors) fail(`${file}${e.instancePath} ${e.message}`);
  if (t.source_citation && !sourceById.has(t.source_citation)) fail(`${file}: source_citation '${t.source_citation}' unknown`);
  for (const row of t.rows || []) {
    for (const [cultId, cell] of Object.entries(row.cells || {})) {
      for (const target of cell.passage_targets || []) {
        const [unit, frag] = target.split("#");
        if (!paraCountByUnit.has(unit)) { fail(`${file} row ${row.epoch}/${cultId}: passage_target unknown unit '${unit}'`); continue; }
        const n = Number(frag.slice(1));
        if (!Number.isInteger(n) || n < 0 || n >= paraCountByUnit.get(unit)) fail(`${file} row ${row.epoch}/${cultId}: passage_target '${target}' paragraph out of range (unit has ${paraCountByUnit.get(unit)})`);
      }
    }
  }
}

// ---- phase-clock timeline ----
if (existsSync(resolve(ROOT, "data/timeline/culture-phases.json"))) {
  const tl = read("data/timeline/culture-phases.json");
  if (!vTimeline(tl)) for (const e of vTimeline.errors) fail(`timeline${e.instancePath} ${e.message}`);
  if (tl.source_citation && !sourceById.has(tl.source_citation)) fail(`timeline: source_citation '${tl.source_citation}' unknown`);
  const cultIds = new Set((tl.cultures || []).map((c) => c.id));
  if (tl.now && !cultIds.has(tl.now.culture)) fail(`timeline: now.culture '${tl.now.culture}' is not a timeline Culture`);
  for (const c of tl.cultures || []) {
    if (!(c.span_start < c.span_end)) fail(`timeline/${c.id}: span_start must precede span_end`);
    if (c.birth < c.span_start || c.birth > c.span_end) fail(`timeline/${c.id}: birth outside span`);
    let prev = c.span_start;
    for (const p of c.phases) {
      if (p.from < c.span_start || p.to > c.span_end) fail(`timeline/${c.id}/${p.id}: phase outside span`);
      if (!(p.from < p.to)) fail(`timeline/${c.id}/${p.id}: phase from must precede to`);
      if (p.from < prev) fail(`timeline/${c.id}/${p.id}: phases must not overlap or run backwards`);
      prev = p.to;
    }
  }
}

// ---- report ----
if (errors.length) {
  console.error(`\nvalidate-basic: ${errors.length} FAILURE(S):`);
  for (const e of errors) console.error("  ✗ " + e);
  process.exit(1);
}
console.log(`validate-basic: OK — ${annCount} annotations, ${lex.terms.length} lexicon terms, ${sources.records.length} sources, gates green.`);
