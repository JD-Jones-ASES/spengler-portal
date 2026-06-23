// Shared helpers for the portal: base-aware links, Culture metadata, and annotation display info.
// Kept free of data-file imports so it can be used before the pipeline has generated anything.

const BASE = import.meta.env.BASE_URL; // e.g. "/spengler-portal/"

export function withBase(p) {
  const clean = String(p).replace(/^\/+/, "");
  return BASE.endsWith("/") ? BASE + clean : `${BASE}/${clean}`;
}

export function unitHref(unitId) {
  return withBase(`read/${unitId}/`);
}

// The Cultures, in Spengler's own comparative order. `id` is the canonical soul-name used as the
// data-cult attribute value; `column` is the label Spengler uses in his Tables (Classical, Arabian…).
export const cultures = [
  { id: "indian",     soul: "Indian",     column: "Indian",    prime_symbol: "—" },
  { id: "apollinian", soul: "Apollinian", column: "Classical", prime_symbol: "the bounded material body" },
  { id: "magian",     soul: "Magian",     column: "Arabian",   prime_symbol: "the world-cavern" },
  { id: "faustian",   soul: "Faustian",   column: "Western",   prime_symbol: "pure infinite space" },
  { id: "egyptian",   soul: "Egyptian",   column: "Egyptian",  prime_symbol: "the path / direction" },
  { id: "chinese",    soul: "Chinese",    column: "Chinese",   prime_symbol: "the Tao / the wandering way" },
  { id: "mexican",    soul: "Mexican",    column: "Mexican",   prime_symbol: "—" },
];

export const cultureById = new Map(cultures.map((c) => [c.id, c]));
export function cultureLabel(id) { return cultureById.get(id)?.soul ?? id; }

// The four organic seasons + the Civilization terminus.
export const phases = [
  { id: "spring", label: "Spring", gloss: "Birth of myth; the dream-heavy, rural soul" },
  { id: "summer", label: "Summer", gloss: "Ripening consciousness; the first cities and reform" },
  { id: "autumn", label: "Autumn", gloss: "The Enlightenment; the city's intelligence at its zenith" },
  { id: "winter", label: "Winter", gloss: "Megalopolitan Civilization; materialism, scepticism, the end" },
];
export const phaseById = new Map(phases.map((p) => [p.id, p]));

// Domains Spengler ranges across — the analytic facet axis.
export const domains = {
  art: "Art & music",
  mathematics: "Mathematics",
  politics: "Politics & history",
  religion: "Religion & metaphysics",
  economics: "Economics & technics",
  science: "Science & nature",
};

// Annotation kinds → display label + whether the kind is interpretation (UI flags these).
export const kindMeta = {
  "lexicon-term":          { label: "Term", interpretation: false },
  "historical-reference":  { label: "Reference", interpretation: false },
  "cross-culture-parallel":{ label: "Parallel", interpretation: false },
  "translation-note":      { label: "Translation", interpretation: false },
  "form-observation":      { label: "Close reading", interpretation: true },
  "scholarly-reception":   { label: "Reception", interpretation: true },
  "difficult-material":    { label: "Context", interpretation: false },
  "concordance-link":      { label: "Topic", interpretation: false },
  "teacher-note":          { label: "For teachers", interpretation: false },
};
export function kindInfo(kind) { return kindMeta[kind] ?? { label: kind, interpretation: false }; }

export function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
