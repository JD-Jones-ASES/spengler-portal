// build-lexicon-graph.mjs — project the hand-authored lexicon into a public graph for the island.
// Public gate: only student-ready + verified terms become nodes; edges whose endpoints aren't both
// public are dropped (so a draft term can never leak into a node or an edge).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lex = JSON.parse(readFileSync(resolve(ROOT, "data/lexicon/spengler.lexicon.json"), "utf8"));

const isPublic = (t) => t.status.content_status === "student-ready" && t.status.citation_status === "verified";
const publicTerms = lex.terms.filter(isPublic);
const publicIds = new Set(publicTerms.map((t) => t.id));

const degree = new Map(publicTerms.map((t) => [t.id, 0]));
const edges = [];
for (const e of lex.edges) {
  if (!publicIds.has(e.source) || !publicIds.has(e.target)) continue;
  edges.push(e);
  degree.set(e.source, degree.get(e.source) + 1);
  degree.set(e.target, degree.get(e.target) + 1);
}

// cluster: interlocutors (source-thinkers) form their own meta-group; otherwise a term sits
// with its Culture if it has one, else with its domain.
const nodes = publicTerms.map((t) => ({
  id: t.id,
  term: t.term,
  german: t.german || null,
  definition: t.definition,
  culture: t.culture || null,
  prime_symbol: t.prime_symbol || null,
  domain: t.domain || null,
  kind: t.kind || "concept",
  cluster: t.kind === "interlocutor" ? "interlocutor" : (t.culture || t.domain),
  degree: degree.get(t.id),
  variants: t.variants || [],
  targets: t.targets || [],
  citations: t.citations || [],
  secondary: t.secondary || [],
}));

mkdirSync(resolve(ROOT, "data/indexes"), { recursive: true });
writeFileSync(resolve(ROOT, "data/indexes/lexicon-graph.json"), JSON.stringify({ nodes, edges }, null, 2));
console.log(`build-lexicon-graph: ${nodes.length} nodes, ${edges.length} edges (public).`);
