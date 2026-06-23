// Build-time search index — one record per chapter (full prose), annotation, lexicon term,
// concordance topic, comparative-table cell, and translator footnote. Generated from the same data
// the pages consume, so it can never drift. The client (search-ui.js) does token search in memory.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { publishedUnits, unitText, getConcordance, getLexicon, getSources } from "../lib/guide-data.js";

const ROOT = process.cwd();
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));

function clip(s, n = 200) {
  s = s.replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function GET() {
  const records = [];
  const units = publishedUnits();

  // chapters — full prose for "find anything Spengler said"
  for (const u of units) {
    const text = unitText(u);
    records.push({
      id: u.unit_id,
      type: "chapter",
      title: u.title,
      snippet: u.summary?.one_line || clip(text),
      path: `read/${u.unit_id}/`,
      cult: u.cultures || [],
      facets: ["work:" + u.work, "volume:" + (u.volume || "-"), ...(u.domains || []).map((d) => "domain:" + d)],
      terms: (u.title + " " + text).toLowerCase(),
    });
  }

  // annotations (reader-public)
  const byUnit = read("data/indexes/annotations-by-unit.json");
  for (const [uid, list] of Object.entries(byUnit)) {
    for (const a of list) {
      const interp = a.kind === "scholarly-reception" || (a.tags || []).includes("view:interpretation");
      records.push({
        id: a.id,
        type: "note",
        title: a.anchor,
        snippet: clip(a.note),
        path: `read/${uid}/`,
        cult: a.cultures || [],
        facets: ["view:" + (interp ? "interpretation" : "fact"), ...(a.cultures || []).map((c) => "culture:" + c)],
        terms: (a.anchor + " " + a.note).toLowerCase(),
      });
    }
  }

  // lexicon terms
  for (const t of getLexicon().terms) {
    if (t.status.content_status !== "student-ready") continue;
    records.push({
      id: "lex-" + t.id,
      type: "lexicon",
      title: t.term,
      snippet: clip(t.definition),
      path: `lexicon/#term-${t.id}`,
      cult: t.culture ? [t.culture] : [],
      facets: ["concept:" + t.id, t.culture ? "culture:" + t.culture : "", "domain:" + t.domain].filter(Boolean),
      terms: (t.term + " " + (t.variants || []).join(" ") + " " + (t.german || "") + " " + t.definition).toLowerCase(),
    });
  }

  // concordance topics (Spengler's own index)
  for (const e of getConcordance().entries) {
    records.push({
      id: e.id,
      type: "topic",
      title: e.topic,
      snippet: `${e.roman ? "Chapter " + e.roman : ""} · p.${e.page}`,
      path: e.anchor ? `read/${e.unit_id}/#p${e.anchor_paragraph}` : `read/${e.unit_id}/`,
      cult: [],
      facets: ["work:" + e.work],
      terms: e.topic.toLowerCase(),
    });
  }

  // comparative-table cells
  const cells = read("data/indexes/comparative-cells.json").cells;
  for (const c of cells) {
    records.push({
      id: `cell-${c.table}-${c.epoch}-${c.culture_id}`,
      type: "table",
      title: `${c.culture_label} · ${c.epoch_label}`,
      snippet: clip(c.text, 160),
      path: `tables/`,
      cult: [c.cult],
      facets: ["culture:" + c.cult, "phase:" + c.phase],
      terms: (c.culture_label + " " + c.epoch_label + " " + c.text).toLowerCase(),
    });
  }

  // translator footnotes (published volumes)
  const fn = read("derived/decline-vol-i.footnotes.json");
  for (const f of fn.footnotes) {
    if (!f.units || !f.units.length || !f.body) continue;
    records.push({
      id: "fn-" + f.number,
      type: "footnote",
      title: `Translator's note ${f.number}`,
      snippet: clip(f.body, 160),
      path: `read/${f.units[0]}/`,
      cult: [],
      facets: ["work:decline"],
      terms: f.body.toLowerCase(),
    });
  }

  return new Response(JSON.stringify({ records }), { headers: { "content-type": "application/json" } });
}
