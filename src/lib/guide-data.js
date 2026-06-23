// guide-data.js — build-time loaders for the generated data. Reads from /data and /derived (outside
// src) via the filesystem so pages get plain JS objects. The public gate has already been applied by
// the pipeline; this layer just assembles per-page views.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Anchored on the project root (cwd during `astro dev`/`build`) — import.meta.url is unreliable here
// because Astro relocates the bundled module into dist/ at build time.
const ROOT = process.cwd();
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));

let _cache = null;
const tryRead = (p) => { try { return read(p); } catch { return null; } };
const volKeyOf = (work, volume) => (volume ? `${work}-${volume}` : work);
function load() {
  if (_cache) return _cache;
  const manifest = read("data/manifest.json");
  const byUnit = read("data/indexes/annotations-by-unit.json");
  const sources = read("data/sources/decline.sources.json");
  const lexicon = read("data/lexicon/spengler.lexicon.json");
  const paths = read("data/paths/paths.json");
  // Concordance + footnotes span every published volume. Merge concordance entries (they carry their
  // own unit_id) and key footnotes PER VOLUME — footnote numbers restart per volume, so a single
  // number→note map would collide across Vol I / Vol II.
  const volKeys = [...new Set(manifest.units.filter((u) => u.published).map((u) => volKeyOf(u.work, u.volume)))];
  const concEntries = [];
  const footnotesByVol = new Map();
  for (const vk of volKeys) {
    const c = tryRead(`data/concordance/${vk}.concordance.json`);
    if (c) concEntries.push(...(c.entries || []));
    const f = tryRead(`derived/${vk}.footnotes.json`);
    footnotesByVol.set(vk, new Map((f?.footnotes || []).map((x) => [x.number, x])));
  }
  _cache = {
    manifest,
    byUnit,
    concordance: { entries: concEntries },
    footnotesByVol,
    sourceById: new Map(sources.records.map((s) => [s.id, s])),
    sources: sources.records,
    lexTermById: new Map(lexicon.terms.map((t) => [t.id, t])),
    lexicon,
    paths: paths.paths,
  };
  return _cache;
}

export function publishedUnits() {
  return load().manifest.units.filter((u) => u.published).sort((a, b) => a.n - b.n);
}

export function allWorks() {
  return load().manifest.works;
}

export function unitText(unit) {
  return readFileSync(resolve(ROOT, unit.clean_path), "utf8");
}

export function getReaderData(unitId) {
  const d = load();
  const units = d.manifest.units;
  const unit = units.find((u) => u.unit_id === unitId);
  if (!unit) return null;
  const text = unitText(unit);
  const annotations = (d.byUnit[unitId] || []).slice();
  // footnote bodies referenced in this unit — looked up in THIS unit's volume (numbers restart per volume)
  const fmap = d.footnotesByVol.get(volKeyOf(unit.work, unit.volume)) || new Map();
  const footnotes = (unit.footnote_refs || []).map((fr) => ({
    number: fr.number,
    offset: fr.offset,
    body: fmap.get(fr.number)?.body || null,
  }));
  // concordance topics for this unit, in sequence
  const topics = d.concordance.entries.filter((e) => e.unit_id === unitId).sort((a, b) => a.sequence - b.sequence);
  // prev/next within the same published volume
  const pubVol = units.filter((u) => u.published && u.work === unit.work && u.volume === unit.volume).sort((a, b) => a.n - b.n);
  const i = pubVol.findIndex((u) => u.unit_id === unitId);
  return {
    unit,
    text,
    annotations,
    footnotes,
    topics,
    prev: i > 0 ? pubVol[i - 1] : null,
    next: i < pubVol.length - 1 ? pubVol[i + 1] : null,
  };
}

export function sourceInfo(id) {
  return load().sourceById.get(id) || { id, title: id, url: null };
}

export function lexTerm(id) {
  return load().lexTermById.get(id) || null;
}

export function getConcordance() {
  return load().concordance;
}
export function getLexicon() {
  return load().lexicon;
}
export function getPaths() {
  return load().paths;
}
export function getSources() {
  return load().sources;
}
