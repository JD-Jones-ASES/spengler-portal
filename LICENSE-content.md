# Content License & Source Provenance

## Original editorial content — CC BY-SA 4.0

All **original editorial apparatus** in this repository — annotations, glossary/lexicon
definitions, summaries, comparative-table glosses, scholarly-reception notes, and prose written for
this portal — is licensed under the
[Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/).

You may share and adapt this material for any purpose, including commercially, provided you give
appropriate credit and license your derivatives under the same terms.

## Code — MIT

All source code (build scripts, Astro components, Svelte islands, schemas) is licensed under the
[MIT License](./LICENSE).

## Source texts

| Work | Source text we publish | Provenance & rights |
|------|------------------------|---------------------|
| *The Decline of the West*, Vol. I — *Form and Actuality* | Atkinson translation (George Allen & Unwin, 1926), via Project Gutenberg | Public domain in the US (published 1926). |
| *The Decline of the West*, Vol. II — *Perspectives of World-History* | Atkinson translation (1928), via Project Gutenberg #78914 | Public domain in the US (published 1928). |
| *Man and Technics* | **A fresh English translation made for this portal from the German original** | See below. |

**On *Man and Technics*.** The 1932 Atkinson/Knopf English translation is **still under US copyright**
(published 1932; 95-year term, entering the public domain on 1 January 2028), so this portal does **not**
publish it. Instead, *Man and Technics* is published here in a **new, independent English translation**
made from the **public-domain German original** — *Der Mensch und die Technik* (C. H. Beck, Munich 1931;
Vordenker 2009 digital edition). Spengler died in 1936, so under German/EU copyright (life + 70 years) the
German original entered the public domain on 1 January 2007. The new translation is an original work made
from that German; like any translation, it consults earlier ones only as references and reproduces none of
their distinctive wording. As original editorial content it is licensed **CC BY-SA 4.0** (see above). The
German source text lives at `raw/Mensch_und_Technik_DE.txt`; the term glossary at
`data/translation/mt-glossary.json`.

Public-domain status of each source is recorded, with an accessed date and a verification note, in
`data/sources/`. The raw files are treated as **read-only originals** and are never mutated; the
cleaned reading text in `derived/` is produced by a deterministic, auditable transform
(`scripts/ingest/build-cleaned-spine.mjs`) whose every edit is logged.

## Verification posture

This portal is **AI-authored under an owner-designed verification system**. The verification system —
not a human-review gate on every line — is the safeguard, and the build fails loud when a claim is
unsupported. See `/about` on the live site and `DECISIONS.md` for the full method.
