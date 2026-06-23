// build-lexicon-graph.mjs — project the hand-authored lexicon into a public graph for the island.
// Public gate: only student-ready + verified terms become nodes; edges whose endpoints aren't both
// public are dropped (so a draft term can never leak into a node or an edge).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lex = JSON.parse(readFileSync(resolve(ROOT, "data/lexicon/spengler.lexicon.json"), "utf8"));

// Deterministic frozen force layout — computed once here at build time (was recomputed on every
// server render + client hydration). The island now just reads node.x/node.y. W/H must match the
// island's viewBox constants. Curated/persisted positions can later be merged in after this step.
const W = 640, H = 500;
function computeLayout(nodes, edges) {
  const cx = W / 2, cy = H / 2;
  const clusters = [...new Set(nodes.map((n) => n.cluster))];
  const pos = new Map();
  nodes.forEach((n, i) => {
    const ci = clusters.indexOf(n.cluster);
    const a = (ci / clusters.length) * 2 * Math.PI;
    const ja = (i * 2.39996) % (2 * Math.PI);
    pos.set(n.id, { x: cx + 130 * Math.cos(a) + 28 * Math.cos(ja), y: cy + 130 * Math.sin(a) + 28 * Math.sin(ja) });
  });
  const links = edges.map((e) => [e.source, e.target]);
  for (let it = 0; it < 420; it++) {
    const f = new Map(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos.get(nodes[i].id), b = pos.get(nodes[j].id);
        let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 0.01, d = Math.sqrt(d2);
        const rep = 2800 / d2;
        f.get(nodes[i].id).x += (dx / d) * rep; f.get(nodes[i].id).y += (dy / d) * rep;
        f.get(nodes[j].id).x -= (dx / d) * rep; f.get(nodes[j].id).y -= (dy / d) * rep;
      }
    for (const [s, t] of links) {
      const a = pos.get(s), b = pos.get(t); if (!a || !b) continue;
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const k = (d - 95) * 0.02;
      f.get(s).x += (dx / d) * k; f.get(s).y += (dy / d) * k;
      f.get(t).x -= (dx / d) * k; f.get(t).y -= (dy / d) * k;
    }
    const cool = Math.max(0.1, 1 - it / 520);
    for (const n of nodes) {
      const p = pos.get(n.id), ff = f.get(n.id);
      p.x += (cx - p.x) * 0.006; p.y += (cy - p.y) * 0.006;
      p.x += Math.max(-9, Math.min(9, ff.x)) * cool; p.y += Math.max(-9, Math.min(9, ff.y)) * cool;
      p.x = Math.max(28, Math.min(W - 28, p.x)); p.y = Math.max(26, Math.min(H - 26, p.y));
    }
  }
  return pos;
}

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

// Freeze each node's layout coordinate into the generated graph (rounded to keep the JSON tidy).
const layout = computeLayout(nodes, edges);
for (const n of nodes) {
  const p = layout.get(n.id);
  n.x = Math.round(p.x * 100) / 100;
  n.y = Math.round(p.y * 100) / 100;
}

mkdirSync(resolve(ROOT, "data/indexes"), { recursive: true });
writeFileSync(resolve(ROOT, "data/indexes/lexicon-graph.json"), JSON.stringify({ layout: { W, H }, nodes, edges }, null, 2));
console.log(`build-lexicon-graph: ${nodes.length} nodes, ${edges.length} edges (public), layout frozen.`);
