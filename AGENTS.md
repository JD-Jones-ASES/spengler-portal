# AGENTS.md — working map & handoff

Terse contract for anyone (human or agent) working this repo. **Read this first.** Keep it current.

## What this is

A static Astro portal for Oswald Spengler. Data-first: raw text → cleaned spine → JSON apparatus →
build-time validation gate → static site. Adapted from the sibling `moby-dick-portal`
(`C:\GitHub_Files\Melville`); reuse its patterns, don't reinvent them. **Public repo:
`JD-Jones-ASES/spengler-portal` — LIVE at https://jd-jones-ases.github.io/spengler-portal/** via
`.github/workflows/deploy.yml` (push to `main` → `astro build` → GitHub Pages). `main` is a **clean
single-commit public history** (the pre-public dev history — which contained the copyrighted Atkinson
M&T text — was dropped by squashing; full history kept locally under tag `pre-public-backup-full-history`,
dev branch `mt-fresh-translation`). CI runs a pure `astro build` (Node 22, `npm install`); it does NOT
run `prepare:data` — generated data is committed.

## Where things stand (2026-06-23, latest) — v1.0.0, QOL & show-piece polish

- **v1.0.0 — feature-complete.** A UI/UX polish pass on top of the public launch (`package.json` → 1.0.0).
  All of the below is on `mt-fresh-translation`; `prepare:data` + `build` green (38 pages), browser-verified
  both themes, no console errors.
- **M&T typography normalized to house style.** Our translation used straight quotes; both *Decline*
  volumes use curly. A **length-preserving** `educate-quotes` pass (opt-in via `"typography"` on the M&T
  volume in `works.config.json`, applied in `build-cleaned-spine.mjs::educateQuotes`) converts straight
  quotes/apostrophes → curly while **keeping spaced em-dashes**. Length-preserving ⇒ **no offset re-basing**;
  the one affected annotation `selector.exact` (`Nietzsche's`) + a few display `anchor`s were educated to
  match. *Decline* volumes untouched. Lesson: educate-quotes is the safe way to retypeset our own text.
- **Text guardrail.** New `scripts/validate/scan-text.mjs` (wired into `prepare:data` as `validate:text`)
  fails the build on OCR/PDF/encoding artifacts (ligatures, soft hyphens, mojibake, zero-width, double
  spaces) **and** on any `clean` work that carries OCR highlights — so a superseded-source "fix" can never
  resurface. The corpus is currently artifact-free.
- **Honesty/credit fixes.** Footer (`Layout.astro`), About (incl. a new "On the translation of M&T"
  section), Read hub, home, Sources, and a new M&T **reader colophon** now state correctly: *Decline* = PD
  Atkinson; *M&T* = our fresh in-house translation. Removed the stale "being prepared / scans carry damage"
  claims. **Gotcha:** Astro strips whitespace at `text⏎<em>`/`</strong>⏎text` boundaries — insert `{" "}`.
- **Show-piece islands.** Timeline "We are here · 2026" marker now renders in a flag pill **below** the
  Western row (was floating above it) — `PhaseTimeline.svelte`, pill sized from text length, night-safe.
  Lexicon groups **default collapsed** (auto-open on filter/select) and nodes are **drag-to-rearrange**
  (pointer events; click/keyboard select preserved; "Reset layout" button) — `ConceptGraph.svelte`
  (`positions` is now reactive `$state`).
- **Cross-hero links.** Timeline culture labels → `tables/?cult=<id>`; `ComparativeTable.svelte` reads the
  param in a `$effect` and highlights that column (`.ct-focus`). Reciprocal timeline↔tables↔lexicon prose
  links.
- **Reader QOL + SEO.** Dock "copy link" / "cite this chapter" (client-built citation w/ accessed-date) +
  back-to-top + mobile "jump to section" (the topic spine is hidden < 900px) + print stylesheet — in
  `[unit].astro`, `reader-ui.js`, `portal.css`. OG/Twitter/canonical meta in `Layout.astro` (+ `image`
  prop), `public/og.svg`, dependency-free `src/pages/sitemap.xml.js`, `public/robots.txt`,
  `src/pages/404.astro`. (OG image is SVG; rasterize to `og.png` if a platform ignores SVG.)
- **Read-page consistency.** Authored the 19 missing summary seeds (Vol II + M&T) in
  `data/chapters/summary-seeds.json` so every chapter row shows a one-line summary + culture tags (Vol I
  had them; the others rendered bare). Manifest now: 30/30 summaries.
- **Possible next (all optional — v1.0.0 is done):** rasterize `og.png`; lexicon → 50 terms; extend
  table→passage deep-link coverage; add Indian/Mexican to the timeline; persist lexicon node positions.

## Where things stand (2026-06-22, latest)

- **Man and Technics re-published in a fresh in-house English translation from the public-domain German**
  (ADR-0018), on branch `mt-fresh-translation`. The 1932 Atkinson/Knopf translation is under US copyright
  until 2028 and blocked publishing; replaced by our own independent translation of the PD 1931 German
  original (Beck; Vordenker 2009 digital ed.). All 5 chapters translated faithful-in-register, each through
  refute-only *fidelity* (vs German) + *independence* (vs Atkinson) judges — ch1 1 hard fix, ch2–5 **0 hard
  errors / 0 required independence changes**. All **50 M&T annotations re-anchored** to the new text; 15
  Spengler *Decline* cross-reference footnotes now surface (the OCR'd Atkinson had none). Atkinson raw +
  corrections retired; works.config → `line-paragraphs`/`clean`/new source; `LICENSE-content.md` corrected;
  new German-original source record. `prepare:data`+`build` green (37 pages, 242 annotations); browser-verified.
  Tooling: `scripts/translate/extract-mt-german.py`, `data/translation/mt-glossary.json`,
  `raw/Mensch_und_Technik_DE.txt` (German), `raw/Man_and_Technics.en.txt` (our translation).
  **PUBLISHED & LIVE** (ADR-0019): squashed to a clean single-commit `main` (no Atkinson text in the
  public history), repo flipped public, GitHub Pages live via `deploy.yml`. The portal is now public.
- **Phase 3 #3 DONE — the Phase-Clock timeline (third hero) is live at `/timeline`** (ADR-0017). A
  morphological time-spine: 5 high Cultures (Egyptian, Chinese, Classical, Magian, Western) each normalized to
  its own life-span so births align left and Civilization-winters align right; reading down any vertical line
  shows Spengler's "contemporaries"; the West carries a "We are here · 2026" marker in its winter. New
  `data/timeline/culture-phases.json` (phase dates transcribed from Comparative Tables II/III, cited; West's
  ~2200 terminus disclosed as projection), `schemas/timeline.schema.json` + build-gate validation,
  `PhaseTimeline.svelte` island, `/timeline` page, "Timeline" nav entry. Browser-verified both themes, no
  console errors. **All three heroes (Tables, Lexicon, Timeline) are now shipped.**
- **Phase 3 #2 DONE — Comparative-Table cells deep-link to passages** (ADR-0016). 29 of 136 cells now carry
  `cell.passage_targets` (`unit#pN`) and render an "↪ chapter" deep-link into the reader; granularity is
  cell→chapter by row-theme (the cells are name-lists, not prose), coverage thematic/selective and disclosed
  on the page. New cell schema field + a build-gate rule that every target resolves (unit in manifest, para
  in range; negative-tested). Island (`ComparativeTable.svelte`) renders the links in both the desktop table
  and the mobile accordion; `tables/index.astro` passes `base` + a unit-title map. Browser-verified
  (`preview_*`): 58 links, all resolve to 200 + the `#p0` anchor, no console errors, night-mode legible.
- **Phase 3 #1 DONE — lexicon expanded 23 → 40 terms** (ADR-0015). The 7 `see_also` slugs that rendered as
  **dead anchors** (being-waking-being, blood-and-money, beast-of-prey, technics, hand-and-tool, enterprise,
  cosmic-microcosm) are now real nodes; added 10 breadth terms (tragedy, world-cavern, mexican, the-machine,
  nature-knowledge, the-city, the-estates, nation, culture-seasons, will-to-power); 36 → 82 typed edges.
  **Every `see_also` across all 242 annotations now resolves to a public node.** Refute-only judge: 17/17
  confirmed, 0 hard errors. `prepare:data`+`build` green (36 pages, 242 annotations, **40 lexicon terms**, 82
  edges, 273 concordance topics, 136 table cells, **29 passage-targets**). **Next front of Phase 3 is item #3
  — the phase-clock timeline (the deferred third hero).**

## Where things stand (2026-06-22)

- **30 published reading units, ALL now fully annotated** to the showcase standard via the scout →
  adversarial-judge flow (each chapter's notes fact-checked by a refute-only subagent; see
  ADR-0010/0011/0013/0014): *Decline* Vol I (11 ch, **97 notes**), *Decline* Vol II (14 ch, **95 notes**,
  added 2026-06-22 — ADR-0014), and *Man and Technics* (5 ch, **50 notes**, ADR-0013). **242 annotations
  total; the annotation-depth phase (roadmap Phase 2) is complete.** All three ship as clean text +
  concordance + footnotes + search.
- **Vol II re-sourced from clean Gutenberg #78914** (2026-06-22, ADR-0012), superseding the
  Internet-Archive OCR — which **eliminated the entire 1077-flag OCR review queue**. It now publishes
  like Vol I: `text_status: clean`, 941 global-numbered footnotes, 148 concordance topics (146
  deep-linked), 447 page anchors. `raw/Spengler_Decline_II_Gutenberg.txt` is generated from the
  (gitignored) HTML by `scripts/ingest/extract-vol-ii-gutenberg.mjs`; the old IA overlay + review-queue
  were retired (git history preserves them); the OCR `raw/Spengler_Decline_II.txt` is left untouched.
- **OCR human-review tooling (new):** `review/index.html` — a self-contained offline tool
  (`npm run review`) to clear the flag queues by typing/pasting corrections (suggestion chips, IA scan
  deep-links, span-widen for split words, localStorage progress, export by download **or** copy-paste).
  Apply with `npm run review:apply` (`scripts/ingest/apply-review-resolutions.mjs`; validates anchoring,
  promotes `fix`→`method:human`, logs `illegible`, fails loud). See `review/README.md`.
- **Live features:** culture-keyed design system (light/night); reader (margin-card, footnotes,
  scroll-spied topic spine, culture margins, OCR-transparency hover); two hero islands (Comparative
  Table, Concept Lexicon graph w/ collapsible filtered sidebar); full-text search palette; sources +
  about/method pages. **All three Comparative Tables now live** (I Spiritual, II Culture/art, III Political
  — the `/tables` page renders all three). **Lexicon 40 terms** (13 → 23 → 40; +17 on 2026-06-22, ADR-0015), **19 sources**
  (added for M&T 2026-06-22: Wikipedia *Man and Technics*, Wikipedia *Rousseau*, SEP *History of
  Utilitarianism*, Wikipedia *Umwelt*, Wikipedia *Faithful unto Death*). `npm run prepare:data` and
  `npm run build` are green (36 pages, **242 annotations**, 273 concordance topics, 136 table cells).
- **Deferred (next work — roadmap Phase 4):** ~~lexicon expansion toward 40–50~~ **DONE (ADR-0015)**;
  ~~deep-link Comparative-Table cells to passages~~ **DONE (ADR-0016)**; ~~phase-clock timeline~~ **DONE
  (ADR-0017)** — all three heroes shipped. **Phase 4 (publish) is now the front of work:** verified
  bibliography + per-chapter "further study"; orientation primers; accessibility/perf pass; GitHub Pages CI;
  go public. (Optional polish stretches: lexicon to 50 — good candidates with anchored `concept:` tags but no
  node yet are *world-picture* (Weltbild) and *decadence*; extend table deep-link coverage beyond 29 cells;
  add Indian/Mexican to the timeline once their phase dates are sourced.)
- **Roadmap:** `~/.claude/plans/pure-moseying-umbrella.md` (approved). Rationale: `DECISIONS.md`.

## Next session starts here — next buildout phase

**OCR review is COMPLETE — no manual queue remains.** Vol II's 1077-flag queue was eliminated by
re-sourcing it from clean Gutenberg #78914 (ADR-0012); M&T's 57 flags were all cleared by JD via
`review/index.html` (2026-06-22) → **133 human corrections** in `corrections/man-technics.corrections.json`,
queue now **0** (3 stale flags removed after verifying the text was already correct). The review tool
(`npm run review`) now shows an empty queue. **Do not re-drive the OCR pass.** Lesson (ADR-0012): if a clean
Gutenberg/other edition of an OCR'd work turns up, *re-sourcing* beats correcting — check for one first.
(`raw/` is gitignored. Watch for valid-word OCR errors the non-word detector can't catch, e.g. `dose`→`close`.)

**Annotation depth (roadmap Phase 2) is COMPLETE.** All three works are fully annotated to the Ch I
showcase standard (Vol I 97 + Vol II 95 + M&T 50 = **242 notes**), each chapter run through the proven
scout → adversarial-judge flow (ADR-0010/0011/0013/0014). All three Comparative Tables are live. **Phase 3
breadth features are underway** — item 1 (lexicon) is done; the front of work is now item 2:

1. ~~**Lexicon expansion to 40–50+ terms.**~~ **DONE (ADR-0015).** 23 → 40 terms, 82 edges; the 7 unresolved
   `see_also` slugs are now real nodes and **every see_also across all annotations resolves**. Method that
   worked: a script cross-references each annotation's `see_also` against the live term ids to find the *real*
   gap (AGENTS.md's hand-listed "missing" set was stale — 6 of 13 already existed), author terms by lifting
   the vetted `lexicon-term` annotation `note` text to glossary altitude, wire ≥2 typed edges each, then run
   the refute-only judge over the batch. (Optional later stretch to 50: *world-picture*, *decadence* — both
   have anchored `concept:` tags but no node.)
2. ~~**Deep-link the Comparative-Table cells to passages.**~~ **DONE (ADR-0016).** 29/136 cells carry
   `cell.passage_targets` and render an "↪ chapter" reader deep-link; cell→chapter granularity, thematic/
   selective coverage, disclosed on the page; build-gate validates every target resolves. To extend coverage
   later: add more `passage_targets` to `data/comparative/*.table.json` (any `unit#pN`; the gate checks the
   unit exists + the paragraph is in range) — and per-cell *paragraph* precision is a drop-in if you find a
   verbatim home passage.
3. ~~**Phase-clock timeline.**~~ **DONE (ADR-0017).** Live at `/timeline` — a morphological time-spine
   (`PhaseTimeline.svelte`, `data/timeline/culture-phases.json`, `timeline.schema.json`). To extend: add
   Indian/Mexican once their phase dates are sourced; optionally deep-link timeline bands to the matching
   Comparative-Table row or reader chapter.
4. **Phase 4 — publish (now the front of work).** verified bibliography + per-chapter "further study" lists;
   orientation primers; accessibility/perf pass; wire the GitHub Pages CI; go public. With all three heroes
   shipped and 242 annotations + 40 lexicon terms + 3 tables + the timeline live, the portal is feature-complete
   enough to start the publish track.

**Annotation method (proven over 3 works — reuse if adding future works like *Prussianism & Socialism*):**
author candidate notes with *verbatim, uniquely-resolving* anchors from `derived/`; a throwaway checker
mirroring `build-annotation-selectors` catches bad/ambiguous anchors before the pipeline run (watch the
`wrapped` M&T layout — footnote lines interleave paragraphs, so anchors must be one contiguous clause).
Then spawn a refute-only subagent that web-checks every factual claim and verifies each
`scholarly-reception` note faithfully represents the scholar. Registry scholars: Hughes, Frye, Adorno,
Farrenkopf — all four are *Decline*-specific (M&T can only borrow their general theses, verified). **The
judge is load-bearing and finds real errors** — across Vol II it caught a Trevor-Roper phrase misattributed
to Hughes, an over-clean Spengler/Nazism framing, a mis-emphasis of Farrenkopf, the wrong Chinese-emperor
name, and a false-friend "anti-capitalist." **Always verify its flags, then fix** (it also over-flags
occasionally). Diversify scholars across chapters (Frye was over-used in Vol I).

The build gate (`scripts/validate/validate-basic.mjs`) staying green is the definition of done for any
content addition.

## Hard rules (non-negotiable)

1. **`raw/` is read-only.** Never mutate originals. The cleaner writes `derived/`; OCR corrections
   live in an **append-only overlay** (`corrections/`), never erase.
2. **Verification is the product.** No unsupported public claim. The build fails loud
   (`scripts/validate/validate-basic.mjs`) — fix the data or the schema, never silence the gate.
3. **Dual annotation gate** (the Spengler wrinkle): *factual* teaching notes must cite a source
   **other than** the Spengler text; *interpretation* notes must name a scholar + cite a
   `scholarly-secondary` source and be **attributed, not asserted** ("According to X…").
4. **OCR correction is constrained.** Non-word detection finds candidates; an LLM classifies under a
   conservative default (**keep / minimal-edit fix / flag-the-unreconstructable**); fixes are
   hand-reviewed; the unreconstructable is **flagged for a human, never guessed**. Deterministic
   nearest-word "correction" is banned (it clobbers names + mis-fixes garbles).
5. **Public gate:** apparatus is public only when `content_status: student-ready` AND
   `citation_status: verified` AND it names the right surface. Drafts never reach a page.
6. **Schemas are contracts.** Disagreement → fix the wrong side explicitly.
7. **Static, local-first.** No runtime backend. `prepare:data` runs locally (supervised); CI is a
   pure `astro build` (it does NOT run `prepare:data` — generated data is committed).

## Repo map

```
raw/         immutable source .txt (Decline I/II, Man & Technics) — never edited
corrections/ append-only OCR overlays + human review queues (per work)
derived/     GENERATED clean spine + footnotes + cleanup-log + page-map + ocr_corrections (committed)
schemas/     JSON-Schema contracts (draft 2020-12, additionalProperties:false)
data/        apparatus — generated (manifest.json, indexes/, concordance/, paths/) + hand-authored
             (annotations/, lexicon/, comparative/, sources/, chapters/summary-seeds, works/)
scripts/ingest/   pipeline stages   scripts/validate/  the build gate
src/         Astro app: pages/, components/, islands/ (Svelte), lib/ (vanilla ES modules), styles/
```

## Pipeline (`npm run prepare:data`)

`build-cleaned-spine → build-footnotes → build-chapter-manifest → build-concordance →
build-reading-paths → build-annotation-selectors → build-annotation-indexes → build-comparative-table
→ build-lexicon-graph → validate-basic`. `build-cleaned-spine` applies any `corrections/<work>.corrections.json`
overlay and re-bases offsets. A work's `text_status` drives processing: `clean` / `ocr-corrected` →
processed **and published**; `ocr-correcting` → processed (derived text exists for candidate-gen) but
**not** published; `raw-deferred` → skipped entirely.

## OCR correction (`/ocr-correct` skill — user-level, reusable)

`~/.claude/skills/ocr-correct/` (SKILL.md + `scripts/`). Pipeline: normalize via the cleaner →
`prefilter.mjs` (scale gate: dedupe + **bulk-keep recurring capitalised proper nouns** into the
allowlist — fast, skips the slow nearest-word search) **or** `candidates.mjs` (small texts) → `batch.mjs`
splits the residual → **classify by fanning sub-agents over the batches** (constrained protocol: default
keep / minimal-edit fix / flag-the-unreconstructable) → `compile.mjs` folds decisions into the overlay +
review queue (demotes content-dropping "fixes" to flags; sorts flags by frequency) → `consensus.mjs`
(when an independent same-edition scan exists) anchors each flag's clean neighbours in the alt and adopts
the aligned word (high-precision: two-sided anchor or tight edit; content-drop + misalignment guards) →
`apply-review-resolutions.mjs` folds those in as `method:consensus`. The cleaner applies
`corrections/<work>.corrections.json` (`{before, after, context?, method, confidence}`; no `context` =
safe global whole-token replace); corrected tokens get `data-ocr` (reader hover + per-chapter banner).
Human review of what's left is done in `review/index.html`, applied via `apply-review-resolutions.mjs`.
*Worked examples: M&T 85 fixes (7 consensus) / 57 flags; Vol II 777 fixes (259 consensus) / 1077 flags /
882 bulk-kept.* The scratch (`corrections/_candidates/`) and `raw/` reference corpora are gitignored; the
overlay + review-queue are committed.

## Content model

`Work → Volume → Chapter(=reading unit) → segment(Roman §) → paragraph`. IDs like
`decline-vol-i-ch-01-introduction`; paragraphs `#pN`. Namespaced for new works (additive). Spengler's
marginal-summary Contents become a first-class **concordance** layer (topic → anchored paragraph),
surfaced in the reader's topic spine and in search.

## Design system

*Morphological / Diagrammatic.* Culture-keyed colour via a `data-cult="faustian"` attribute resolving
`--cult/--cult-ink/--cult-wash`; the same hue carries across table, graph, tags, reader margin. Light
(parchment) + night themes; fonts self-hosted via `@fontsource` (Space Grotesk / Source Serif 4 / IBM
Plex Mono). **Night-mode contrast trap:** on a coloured chip in night mode, text is the dark `-ink`
variant, not white.
