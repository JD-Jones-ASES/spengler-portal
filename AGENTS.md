# AGENTS.md — what this is & how to work it

Entry point for anyone (human or coding agent) opening this repo cold. Start here.

## What this is

**The Spengler Portal** — a static, source-cited *reading room* for Oswald Spengler.
**Live:** https://jd-jones-ases.github.io/spengler-portal/ · **Repo:** `JD-Jones-ASES/spengler-portal`.

It publishes three public-domain works — *The Decline of the West* (Vols I & II) and *Man and Technics* —
in full, wrapped in a verifiable scholarly apparatus: a navigable reader, full-text search, hand-authored
annotations, Spengler's own topic-index, a lexicon of his private vocabulary, interactive recreations of his
Comparative Tables, and a "phase-clock" timeline of the Cultures.

**The core idea:** take a clean source text, build a *schema-validated, source-cited apparatus* around it as
plain JSON, and compile the whole thing to a fast static site. It is **data-first** and **verification-first**:
every public claim is backed by a cited source, and the build fails loud if one isn't. There is no runtime
backend — the apparatus is computed at build time.

## Tech stack

- **Astro 7**, `output: "static"` — pages in `src/pages/`, layout/components in `src/components/`.
- **Svelte 5** islands (`src/islands/`) for the three interactive heroes, hydrated `client:visible`.
- **Vanilla ES modules** (`src/lib/`) for non-island UI (reader, search) — no front-end framework there.
- **CSS custom properties** (`src/styles/portal.css`) — no CSS framework. Self-hosted fonts via `@fontsource`.
- **Node 22** build scripts (`scripts/`), **Ajv** JSON-Schema validation (`schemas/`).
- No database, no server, no client-side data fetching. Generated data is committed to the repo.

## Build & run

```bash
npm install            # Node >= 22
npm run prepare:data   # the data pipeline + validation gate (run locally after any content change)
npm run build          # astro build -> dist/
npm run dev            # local dev server (production base path /spengler-portal)
npm run dev:preview    # local dev server served from /  (convenient for previewing)
```

`prepare:data` regenerates the committed `derived/` spine and `data/` indexes from `raw/` + hand-authored
data, then runs the gate. **CI does NOT run `prepare:data`** — it runs a pure `astro build` over the
committed generated data. So: edit content → `prepare:data` locally → commit the regenerated data → push.

## How it works (architecture)

```
raw text  →  cleaned spine (derived/)  →  JSON apparatus (data/)  →  validation gate  →  static pages
```

- **Content model:** `Work → Volume → Chapter (= reading unit) → segment (Roman §) → paragraph`.
  Stable IDs like `decline-vol-i-ch-01-introduction`; paragraph anchors `#pN`. New works are namespaced
  (additive).
- **The cleaner** (`scripts/ingest/build-cleaned-spine.mjs`) turns `raw/` into the `derived/` reading spine —
  a deterministic, logged transform that strips page numbers, rejoins hyphenated lines, and lifts footnotes,
  recording every edit. The `.txt` it writes ARE the spine that all anchors resolve against.
- **Apparatus layers** — each is hand-authored JSON, schema-validated, then surfaced in the UI:
  - `data/annotations/` — margin notes (dual-gated, see Principles)
  - `data/chapters/summary-seeds.json` — per-chapter one-line summaries + culture/domain tags
  - concordance — Spengler's own marginal topic-index → anchored paragraphs (reader spine + search)
  - `data/lexicon/` — his coined vocabulary as a typed concept graph (the lexicon hero)
  - `data/comparative/` — his foldout Culture tables, cells deep-linking to passages (the tables hero)
  - `data/timeline/` — the Cultures in morphological time (the phase-clock hero)
  - `data/sources/` — every cited source, hand-verified with the date it was checked
- **The reader** composes prose + a single margin-card (annotations/footnotes route into it) + a scroll-spied
  topic spine + search, all keyed to the culture colour.

## Pipeline (`npm run prepare:data`)

`build-cleaned-spine → build-footnotes → build-chapter-manifest → build-concordance → build-reading-paths →
build-annotation-selectors → build-annotation-indexes → build-comparative-table → build-lexicon-graph →
validate-basic → scan-text`.

- `build-annotation-selectors` resolves every annotation's verbatim anchor to a character position in the
  spine and **fails loud** on any anchor that doesn't resolve uniquely.
- `validate-basic` is the structural + content gate; `scan-text` rejects OCR/encoding artifacts and any
  stale OCR highlight on a clean work. **The gate staying green is the definition of done.**

## Repo map

```
raw/         immutable source text (gitignored; restored locally for a rebuild) — NEVER edited
derived/     GENERATED clean spine + footnotes + page-map + offsets (committed)
schemas/     JSON-Schema contracts (draft 2020-12, additionalProperties:false)
data/        apparatus — generated (manifest.json, indexes/, concordance/, paths/) + hand-authored
             (annotations/, lexicon/, comparative/, timeline/, sources/, chapters/, works/)
scripts/ingest/   pipeline stages      scripts/validate/   the build gate
src/         Astro app: pages/, components/, islands/ (Svelte), lib/ (vanilla ES), styles/
.github/workflows/deploy.yml   push to main -> astro build -> GitHub Pages
```

## Design system

*Morphological / Diagrammatic.* Culture-keyed colour: a `data-cult="faustian"` attribute resolves
`--cult / --cult-ink / --cult-wash`, and the same hue carries across the table, the graph, tags, and the
reader margin. Light (parchment) + night themes, toggled on `<html data-theme>`. Fonts: Space Grotesk
(display) / Source Serif 4 (prose) / IBM Plex Mono (data). **Night-mode contrast rule:** text on a coloured
chip uses the dark `-ink` variant, never white.

## Principles (non-negotiable — and the heart of the pattern)

1. **`raw/` is read-only.** Never mutate originals. The cleaner writes `derived/`; corrections live in an
   append-only overlay (`corrections/`).
2. **Verification is the product.** No unsupported public claim. The build fails loud — fix the data or the
   schema, never silence the gate.
3. **Dual annotation gate:** a *factual* note must cite a source **other than** Spengler; an *interpretation*
   must name a scholar, cite `scholarly-secondary`, and be **attributed, not asserted** ("According to X…").
4. **Schemas are contracts.** A mismatch means one side is wrong — fix it explicitly.
5. **Static, local-first.** No runtime backend. `prepare:data` runs locally (supervised); CI is a pure
   `astro build` over committed generated data.

## Deploy

Push to `main` → GitHub Actions runs `astro build` → GitHub Pages. The project base path is
`/spengler-portal` (see `astro.config.mjs`). The public history was squashed to a clean baseline at launch
(rationale in `DECISIONS.md`); generated data is committed so CI only needs to build.

## Reusing this idea for a new corpus

This repo is effectively a **template for "annotated public-domain text → verifiable static site"** (it was
itself adapted from a sibling Moby-Dick portal — the pattern generalizes to any single-author corpus). To
abstract it:

1. **Swap the text.** Put your source(s) in `raw/`, register them in `data/works/works.config.json` (layout,
   `text_status`, source id). Adjust the cleaner for your text's layout (`line-paragraphs` vs `wrapped`).
2. **Re-key the design dimension.** Replace the "Cultures" palette / `data-cult` taxonomy with whatever
   organizes *your* work (eras, themes, speakers…). One colour, carried everywhere.
3. **Author apparatus as schema-validated JSON.** Annotations, lexicon, tables, and timeline are all
   independent and optional — keep the layers that fit your text, drop the rest, add a schema for anything new.
4. **Keep the discipline.** Schema-validated data + a loud build gate = the definition of done. That single
   rule is what lets an agent extend the corpus safely without a human re-checking every claim.

A user-level `/ocr-correct` skill exists for the harder case of ingesting *scanned* sources (constrained,
human-in-the-loop OCR correction) — relevant if your raw text isn't already clean.

## Ideas for extension

More works (e.g. *Prussianism and Socialism*); deepen the lexicon; widen table→passage deep-link coverage;
add more Cultures to the timeline; rasterize `public/og.svg` → `og.png` for social platforms that ignore SVG;
persist dragged lexicon-node positions. See `DECISIONS.md` for the full decision log and history.
