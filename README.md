# The Spengler Portal

**Live: https://jd-jones-ases.github.io/spengler-portal/**

An extensive, source-cited reading room for **Oswald Spengler** — beginning with *The Decline of the
West* (Vols I & II) and *Man and Technics*, and built to expand to his other works.

The goal is not a shortened edition. It is to give the full text — the public-domain Atkinson
translation for the two *Decline* volumes, and a **fresh, independent in-house translation of *Man and
Technics*** made from the public-domain 1931 German original (the 1932 Atkinson translation is still
under US copyright) — while building the apparatus a new reader needs: a navigable text, a searchable
index of everything Spengler says on any reasonable term, extensive annotation, a lexicon of his
idiosyncratic vocabulary, an interactive recreation of his own *Comparative Morphology of History*
tables, and pointers to the scholarship.

## What makes it different

- **An atlas you can read.** A *Morphological / Diagrammatic* design system keyed to Spengler's
  Cultures — Apollinian (Classical), Magian (Arabian), Faustian (Western), Egyptian, and the rest —
  so a colour carries one Culture across the table, the concept graph, and the reader's margins.
- **Three hero instruments.** An interactive **Comparative Cultures Table** (Spengler's own foldout
  tables, with cells deep-linking to the passage where he draws the parallel), a **Concept Lexicon +
  force-graph** of his coined vocabulary, and a **Phase-Clock timeline** that places the high Cultures
  in morphological time so you can read his "contemporaries" down any vertical line.
- **Verification is the product.** Every teaching claim cites a source other than Spengler; every
  contested interpretation is **attributed to a named scholar, never asserted as fact**. The build
  fails loud when a claim is unsupported. `raw/` is never mutated.

## Status

**Published and live** at https://jd-jones-ases.github.io/spengler-portal/ (static Astro site on GitHub
Pages). The full data pipeline, design system, reader, search, and all three hero islands are live.
**30 reading units are published, and all are fully annotated to the showcase standard:** *Decline* Vol
I (11 chapters, clean Project Gutenberg text, 97 notes), *Decline* Vol II (14 chapters, clean Project
Gutenberg text, 95 notes), and *Man and Technics* (5 chapters, in a **fresh in-house translation from
the public-domain German original**, replacing the still-copyrighted 1932 Atkinson translation — each
chapter verified by an adversarial fidelity-vs-German and independence-vs-Atkinson check — 50 notes).
That is **242 annotations**, each anchored to the text and run through an adversarial, web-checked
fact-check before shipping. Each work also carries Spengler's own topic-index (concordance), footnotes,
and full-text search; all three **Comparative Cultures Tables** and the **Phase-Clock timeline** are
live. See `AGENTS.md` and `DECISIONS.md` for the working map and the decision log.

## First useful commands

```powershell
npm install            # Node >= 22 (Astro 7)
npm run prepare:data   # clean raw -> derived spine, build manifests/indexes, validate (the build gate)
npm run build          # build the static portal into dist/
npm run dev            # local dev server
```

After any content change, run `prepare:data` (regenerates the committed derived data and runs the
validation gate), then `build`.

## Layout

`raw/` immutable source · `derived/` generated clean reading spine · `schemas/` JSON-Schema contracts
· `data/` generated + hand-authored apparatus · `scripts/{ingest,validate}/` the pipeline · `src/`
the Astro app + Svelte islands. See [AGENTS.md](AGENTS.md) for the working map.

## Licensing

Code **MIT** ([LICENSE](LICENSE)); editorial content **CC BY-SA 4.0** and source provenance
([LICENSE-content.md](LICENSE-content.md)). Source texts: the two *Decline* volumes are the
public-domain Atkinson translations (Project Gutenberg); *Man and Technics* is this portal's own fresh
translation from the public-domain 1931 German, also CC BY-SA 4.0. The copyrighted 1932 Atkinson
translation of *Man and Technics* is **not** published here.
