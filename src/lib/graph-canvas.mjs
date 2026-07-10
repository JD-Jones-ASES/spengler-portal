// Single source of truth for the concept-graph canvas size. The frozen force layout is computed
// against these dimensions at build time (scripts/ingest/build-lexicon-graph.mjs) and the island
// (src/islands/ConceptGraph.svelte) renders its viewBox with the same values — import from here in
// both places; never restate the numbers. Changing them requires re-running `npm run ingest:lexicon`
// (the committed graph JSON holds coordinates computed for this canvas).
export const GRAPH_W = 640;
export const GRAPH_H = 500;
