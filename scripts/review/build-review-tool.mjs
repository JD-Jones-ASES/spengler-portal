// build-review-tool.mjs — generate review/index.html, a self-contained offline tool for clearing the
// OCR human-review queues (corrections/<work>.review-queue.json). No server, no build of the site:
// open the file in any browser, type or paste the correct readings, export your resolutions.
//
//   node scripts/review/build-review-tool.mjs
//
// For every flag it pre-computes three conveniences so the page itself stays dumb/offline:
//   • suggest  — a likely reading parsed out of the classifier's `reason` (a hint to VERIFY, not trust)
//   • scanUrl  — an Internet-Archive search-inside deep link (a clean neighbour phrase) to the page image
//   • where    — which chapter the passage sits in (located in the committed derived/ text)
// raw/ and corrections/ are never modified here; this only reads.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
// English wordlist (already a project dep) — used only to pick *clean* neighbour words for the
// Internet-Archive search-inside deep link, so the link lands on the right page instead of searching a
// garble that isn't in the scan's text layer.
let DICT = new Set();
try {
  const require = createRequire(import.meta.url);
  DICT = new Set(require("an-array-of-english-words").map((w) => w.toLowerCase()));
} catch { /* degrade to length/shape heuristic */ }
const CORR = resolve(ROOT, "corrections");
const TEMPLATE = resolve(ROOT, "scripts/review/review-tool.template.html");
const OUT_DIR = resolve(ROOT, "review");
const OUT = resolve(OUT_DIR, "index.html");

// --- helpers ---------------------------------------------------------------

const cleanWord = (t) => t.replace(/^[^A-Za-zÀ-ÿ]+/, "").replace(/[^A-Za-zÀ-ÿ]+$/, "");
const isClean = (t) => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]*$/.test(t);

// Parse a likely intended reading out of the human-readable `reason`. This is only a hint the
// reviewer verifies against the scan — never auto-applied. Heuristics, best-effort, may be empty.
function extractSuggestion(reason, before) {
  if (!reason) return null;
  const eq = (a) => a && a.toLowerCase() !== before.toLowerCase();
  // 1. "(likely 'X')" / 'likely "X"'
  let m = reason.match(/likely\s+[‘'"“]([^’'"”]+)[’'"”]/i);
  if (m && eq(cleanWord(m[1]))) return cleanWord(m[1]);
  // 2. "= 'X'"
  m = reason.match(/=\s*[‘'"“]([^’'"”]+)[’'"”]/);
  if (m && eq(cleanWord(m[1]))) return cleanWord(m[1]);
  // 3. trailing single-word parenthetical, clean — the German-title fixes: "(Betrachtungen)"
  const parens = [...reason.matchAll(/\(([^)]+)\)/g)].map((x) => x[1].trim());
  for (let i = parens.length - 1; i >= 0; i--) {
    const w = parens[i];
    if (isClean(w) && eq(w)) return w;
  }
  // 4. any clean quoted word that differs from the garble
  const quoted = [...reason.matchAll(/[‘'"“]([^’'"”]+)[’'"”]/g)].map((x) => cleanWord(x[1]));
  for (const w of quoted) if (isClean(w) && eq(w)) return w;
  return null;
}

// A real word likely present in the scan's text layer: a dictionary word, or a capitalised
// proper-noun-shaped token (names the dictionary won't have, but the scan's OCR usually got right).
function searchable(tok) {
  const w = cleanWord(tok);
  if (!isClean(w) || w.length < 3) return null;
  if (DICT.size ? DICT.has(w.toLowerCase()) : w.length >= 4) return w;
  if (/^[A-ZÀ-Ý][a-zà-ÿ]{3,}$/.test(w)) return w; // proper-noun shape
  return null;
}

// A run of searchable neighbouring words to drive the Internet-Archive search-inside deep link.
// Garbles between good words are skipped (not treated as run-breakers) so we still find a usable phrase
// near a heavily-corrupted token. Prefer the right of the garble, else the left.
function neighbourPhrase(context, before) {
  const toks = context.split(/\s+/).filter(Boolean);
  let gi = toks.findIndex((t) => t.includes(before));
  if (gi < 0) gi = Math.floor(toks.length / 2);
  const run = (from, step) => {
    const out = [];
    let gap = 0;
    for (let i = from; i >= 0 && i < toks.length && out.length < 4; i += step) {
      const w = searchable(toks[i]);
      if (w) { out.push(w); gap = 0; }
      else if (++gap > 2) break; // give up after a couple of garbles in a row
    }
    return step < 0 ? out.reverse() : out;
  };
  const right = run(gi + 1, 1);
  if (right.length >= 2) return right.join(" ");
  const left = run(gi - 1, -1);
  if (left.length >= 2) return left.join(" ");
  const both = [...left, ...right];
  return both.slice(0, 4).join(" ");
}

function scanUrl(iaId, phrase) {
  if (!iaId) return null;
  const base = `https://archive.org/details/${iaId}`;
  return phrase ? `${base}?q=${encodeURIComponent(phrase)}` : base;
}

// Locate a context string inside the committed derived/ chapter texts → a human "where" label.
function buildLocator(stem) {
  const spinePath = resolve(ROOT, "derived", `${stem}.spine.json`);
  if (!existsSync(spinePath)) return () => null;
  let chapters;
  try { chapters = JSON.parse(readFileSync(spinePath, "utf8")).chapters || []; } catch { return () => null; }
  const loaded = chapters.map((ch) => {
    const p = resolve(ROOT, ch.clean_path);
    let text = "";
    try { text = readFileSync(p, "utf8"); } catch {}
    return { roman: ch.roman, title: ch.title, n: ch.n, text };
  });
  return (context) => {
    const probe = context.replace(/\s+/g, " ").trim().slice(0, 24);
    for (const ch of loaded) {
      if (probe && ch.text.replace(/\s+/g, " ").includes(probe)) return `Ch. ${ch.roman} — ${ch.title}`;
    }
    return null;
  };
}

// --- build -----------------------------------------------------------------

const queueFiles = existsSync(CORR)
  ? readdirSync(CORR).filter((f) => f.endsWith(".review-queue.json")).sort()
  : [];

const works = [];
for (const file of queueFiles) {
  const stem = file.replace(/\.review-queue\.json$/, "");
  const q = JSON.parse(readFileSync(resolve(CORR, file), "utf8"));
  const flags = q.flags || [];
  if (!flags.length) continue;
  const iaId = q.ia_id || null;
  const locate = buildLocator(stem);
  const enriched = flags.map((f) => {
    const phrase = neighbourPhrase(f.context || "", f.before || "");
    return {
      before: f.before,
      context: f.context || "",
      reason: f.reason || "",
      suggest: extractSuggestion(f.reason, f.before || ""),
      scanUrl: scanUrl(iaId, phrase),
      where: (f.context && locate(f.context)) || null,
    };
  });
  works.push({ work: q.work || stem, ia_id: iaId, note: q.note || "", flags: enriched });
}

const data = { generated_from: queueFiles, works };

const template = readFileSync(TEMPLATE, "utf8");
const json = JSON.stringify(data, null, 0);
if (!template.includes("/*__DATA__*/ null")) {
  console.error("! template is missing the /*__DATA__*/ null injection point");
  process.exit(1);
}
const html = template.replace("/*__DATA__*/ null", "/*__DATA__*/ " + json);

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html, "utf8");

const totalFlags = works.reduce((s, w) => s + w.flags.length, 0);
const withScan = works.reduce((s, w) => s + w.flags.filter((f) => f.scanUrl).length, 0);
const withSug = works.reduce((s, w) => s + w.flags.filter((f) => f.suggest).length, 0);
console.log(`build-review-tool: ${works.length} work(s), ${totalFlags} flags → review/index.html`);
for (const w of works) console.log(`  • ${w.work}: ${w.flags.length} flags${w.ia_id ? ` (scan ${w.ia_id})` : " (no IA id — add \"ia_id\" to the queue for scan links)"}`);
console.log(`  ${withSug}/${totalFlags} have a parsed suggestion · ${withScan}/${totalFlags} have a scan deep-link`);
console.log(`  open: review/index.html`);
