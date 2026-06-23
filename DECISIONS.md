# Decisions (ADR log)

Short records of non-trivial choices. Newest first.

## ADR-0021 — Lexicon v1.2: provenance drift-killer, precomputed layout, directional + citable graph
Second post-launch pass, prompted by an external GPT-5.5 review of the docs + Lexicon hero. As with
ADR-0020 the review was triaged, not taken wholesale: several specifics were from a **stale snapshot**
(it reported "40 lexicon terms" and a Sources page claiming Vol II was "deferred pending OCR" — neither
current; the public counts are already **derived live** from the data in `about/index.astro`, and the
Sources *page* was clean). But its lead point exposed a real, on-brand contradiction. **(1) The
provenance drift-killer — the headline.** *Root cause:* Vol II was re-sourced mid-build from the IA OCR
scan to the clean Project Gutenberg edition (#78914, ADR-0012), but its **source *record* never
followed** — so a `text_status:clean`, 14-chapter-published Vol II had, as its only source-text record,
`internet-archive-decline-ii` still reading *"body deferred pending a human-in-the-loop OCR cleanup
pass."* Vol II was effectively published with **no accurate provenance record**. Fix: added a live
`gutenberg-decline-ii` record **verified against gutenberg.org #78914** (title/author/translator/release
"Jun 22 2026"/credit, mirroring the Vol I record's evidence note); **retired** the IA record in place
using the *exact pattern already set by* `internet-archive-man-and-technics` ("RETIRED as a source… kept
only as a historical provenance note") rather than deleting it, preserving an honest trail; and made the
link **machine-checkable** by adding a per-volume `source_text_id` to `works.config.json` (the work-level
`source_id` only named Vol I). New gate rule in `validate-basic`: a `clean` volume's `source_text_id`
must resolve, must **not** be a RETIRED record, and must carry **no** deferral/withheld language
(`/deferred|withheld|raw-deferred|OCR cleanup|cleanup pass|pending …(OCR|cleanup)/i`). Planted-violation
test (point Vol II at the retired record) fails the build loud, as designed. Also removed the now-dead
`raw-deferred` "body is withheld" branch in `read/index.astro` (the last such string in the UI) and made
the About "lexicon terms" stat honest — it counted all 47 nodes; it now reads **41 concepts** (the 6
interlocutors are Spengler's *sources*, not his coinages), still fully derived. **(2) Layout precomputed
at build time.** The deterministic 420-iteration force layout moved out of the island into
`build-lexicon-graph.mjs`; node `x/y` are frozen into `data/indexes/lexicon-graph.json` (with a
`layout:{W,H}`). The island now just reads them — no client layout pass, no hydration-mismatch surface —
and curated/persisted positions become a trivial future merge (closes the AGENTS.md "persist dragged
positions" idea's precondition). Same algorithm/seeds ⇒ visually identical graph. **(3) Direction made
visible, selection-scoped.** Directional relations (everything except the symmetric `contrasts-with` /
`analogous-to` / `related-to`) now draw an arrowhead — but **only on the selected node's neighbourhood**,
so the overview stays a clean hairball-free atlas; the line's target endpoint is pulled back to the node
radius so the head clears the circle (`marker` with `fill:context-stroke` to match each edge's family
colour). **(4) The Lexicon made citable.** Selecting a node now writes `#<id>` to the URL
(`history.replaceState`, deep-linkable on load + responsive to `hashchange`) with a **Copy link** action;
relation citation labels became **links to the matching `/sources#src-<id>` record** (anchors +
`:target` highlight added on the Sources page); and the filter was widened from term/definition/variants
to also index the **German form, domain, Culture, connected-concept terms, and relation glosses** — so
"Schicksal" now routes into *Destiny vs Causality* (and *Amor fati*), which it previously could not.
**(5) Mobile: frame the selection.** On a narrow viewport, selecting a node animates the SVG `viewBox` to
frame it + its one-hop neighbours (drag-coords now map through the live viewBox); deselect restores the
full canvas. Chosen over a full secondary "Focus mode" (the accessible term-list already serves phones).
`prepare:data` + `build` green (**38 pages, 47 lexicon nodes = 41 concepts + 6 interlocutors, 97 edges,
26 sources**); browser-verified on the running site: deep-link select, hashchange, Copy link, cite→source
links, arrowheads on the selected neighbourhood, German search, and mobile reframe — zero console errors.
`raw/`/`derived/` untouched.

## ADR-0020 — Lexicon v1.1: interlocutor layer, *amor fati* fixed, edge-level verification, typed graph
First post-launch feature pass, prompted by an external Claude-chatbot review of the Lexicon hero
(`raw/lexicon-improvement-prompt.md`). The review's diagnosis was accurate and was confirmed against the
files before any edit; the work shipped as a five-part release. **(1) An `interlocutor` node class.**
Spengler's source-thinkers were named only in prose, so the `coined-from` relation was *stranded* (used
once, and **mis-fired** on `morphology→contemporaneity`, which is application, not coinage). Added a
`kind: "concept" | "interlocutor"` schema discriminator (conditional-`domain` via `if/then/else`, since
interlocutors sit outside the domain taxonomy) and seeded **six** thinkers, each with an explicit,
anchored passage: **Goethe** and **Nietzsche** (masters — `coined-from`/`borrows-from`), and **Rousseau,
Darwin, Schopenhauer, Joachim of Floris** (`breaks-with`). The stranded `coined-from` was retyped to
`derives-from`; the genuine coinages (`Faustian→Goethe`, `Will-to-Power→Nietzsche`) are now drawn — plus
`Apollinian→Nietzsche` ("the name *familiarized by Nietzsche*"), which the grounding pass found has
**stronger** explicit textual support than `Faustian→Goethe` (the latter is implicit — etymology +
*Faust* imagery — and its gloss says so: "evidently derived"). **(2) *amor fati* promoted to its own node
and the apparatus's self-inconsistency fixed.** It had appeared three ways (a Will-to-Power gloss, a
search `variant`, and an edge gloss that stated the *deflated* Stoic sense, contradicting the careful node
text). It is now a node carrying Nietzsche's *active* affirmation (GS §276/§341), with self-overcoming /
value-creation flagged as **separate** Nietzschean doctrines a scholar (Farrenkopf) connects — *not* voiced
as Nietzsche's own gloss (amor fati appears only at GS §276 in the named works; *Selbstüberwindung* is a
*Zarathustra* theme). The keystone `destiny-causality --narrows--> amor-fati` makes the Spengler-narrows-
Nietzsche reading legible, attributed throughout. (`narrows` is deliberately **not** interlocutor-
restricted — it marks the narrowing of a borrowed *concept*; the proposal was internally inconsistent on
this and concept→concept is the coherent reading.) **(3) The generic web retyped.** `related-to` fell from
**56/82 (68%)** to **29/97 (30%)** using a documented vocabulary (`instance-of`, `prime-symbol-of`,
`phase-of`, `derives-from`, `presupposes`, `symptom-of`, and the signature **`analogous-to`** /
contemporaneity). Honest result, not the ">80% retyped" the plan hoped: the adversarial pass **reverted 8
of 10** `analogous-to` edges back to `related-to` because they were within-system mappings, not cross-
Culture morphological analogies — a wrong type is worse than an honest generic. **(4) Verification extended
to edges.** Edge schema gained `citations`/`secondary`; the gate now fails loud on: unresolved
endpoints/citation-ids; `coined-from`/`borrows-from`/`breaks-with` not pointing at an interlocutor;
interpretive edges lacking a citation; and *evaluative* edges (`contrasts-with`, `narrows`, `breaks-with`,
`analogous-to`, `symptom-of`) lacking a named scholarly-secondary. Deliberately **type-driven, not prose-
scanning** — a regex over definitions would have **mis-fired on `beast-of-prey`**, whose contestable
"anti-egalitarian politics" clause is **Spengler's own stated thesis** (M&T ch-04: "the talk of the
'natural equality of all' … something to be explained away"), not the portal editorialising. So
`beast-of-prey` was fixed by widening its target to ch-04 and letting Spengler's own words carry the step,
with Farrenkopf a *hedged* corroborator ("scholars of Spengler's politics read…", no bare name in prose) —
reversing the review's prescribed "just attach Farrenkopf," which the refute pass refuted as an overclaim
against an unread source, and honouring the ADR-0015 restraint about not putting words in a scholar's
mouth. The gate's honest limit is stated in-code: it verifies a claim is attributed to the *right kind* of
source, not that the source *supports* it — that gap is the adversarial pass. (Also fixed a stale
`SPENGLER_TEXT` set that omitted the fresh M&T German source.) **(5) The typed structure made visible in
the island.** Edges are now styled by relation **family** (opposition = mexican dashed; analogy = magian
dotted; the Goethe/Nietzsche **lineage** = gold; structure = subtle; `related-to` faded to the
background); interlocutors render as neutral **meta-diamonds** outside the Culture palette; a legend
doubles as a **filter** (isolate oppositions, or the lineage); selecting a node lists its **sourced
relations** with citation labels — for an interlocutor that *is* the "what Spengler took / broke with"
lineage view; each edge carries a `<title>` (gloss + citation) for hover + a11y. **Method:** the content
was authored and **adversarially refuted** by background Workflow runs over the Nietzsche/Spengler
primaries — the refute stage caught two real wording slips (the `narrows` gloss over-asserting; 8 over-
eager `analogous-to`), both corrected before commit. `prepare:data` + `build` green (**38 pages, 47
lexicon terms, 97 edges, 25 sources**); planted-violation negative tests confirm the four new gate rules
fail loud; browser-verified the island (filters, lineage view, edge tooltips, interlocutor diamonds) in
light + night, zero console errors. `raw/`/`derived/` untouched.

## ADR-0019 — Public launch: squash to a clean public history, GitHub Pages live
With the copyright blocker resolved (ADR-0018), the portal went public: **live at
https://jd-jones-ases.github.io/spengler-portal/**. **Decision: publish a squashed, single-commit clean
history rather than rewrite the existing one.** The full pre-public dev history contained the copyrighted
1932 Atkinson *Man and Technics* text (in `raw/`, `derived/`, and several commits) plus OCR scratch and IA
references; a `git filter-repo` surgical purge of just those paths was possible but fiddly and leaves the
rest of a messy private history exposed. Squashing the current publish-ready tree into one orphan commit
(`git checkout --orphan`) gives a provably clean public snapshot — no Atkinson text in tree *or* history —
and the intellectual record is preserved anyway because the project keeps it in committed files
(`DECISIONS.md`, `AGENTS.md`), not in commit messages. Full dev history is retained locally under tag
`pre-public-backup-full-history` and branch `mt-fresh-translation`; `main` is now the clean public branch.
Mechanics: enable Pages via the API (`build_type=workflow`), force-push `public:main`, deploy via
`.github/workflows/deploy.yml`. **Two CI fixes the first run surfaced:** Astro 7 / @astrojs/svelte 9 require
**Node ≥ 22.12** (bumped from 20), and **`npm ci` fails on the Windows-generated lockfile** because it omits
Linux-only optional native deps (`@emnapi/*`) — switched CI to `npm install` (tolerant of cross-platform
lockfile drift; a pure `astro build`, no `prepare:data`). Second run green (37s); site returns HTTP 200 and
serves the new M&T translation. **Caveat recorded:** a force-push replaces branch history but GitHub may keep
unreachable commits fetchable-by-SHA until GC; for a *provably* scrubbed public repo the belt-and-suspenders
option is delete-and-recreate. (Note: `npm install --no-audit` in CI is a deliberate, disclosed loosening of
the otherwise-strict reproducibility posture — acceptable for a static-site deploy, not for the data gate,
which still runs locally.)

## ADR-0018 — Man and Technics re-published in a fresh in-house translation from the PD German
The publish track surfaced a hard blocker: *Man and Technics* was the **1932 Atkinson/Knopf English
translation**, under US copyright until 2028 — committed in `raw/` + `derived/`, in git history, and live on
the site. `LICENSE-content.md` wrongly called it public domain (ADR-0012 already flagged the copyright).
**Decision (user-directed): rather than wait or drop M&T, replace it with our own independent English
translation made from the public-domain 1931 German original** (*Der Mensch und die Technik*, C. H. Beck;
Vordenker 2009 digital edition; PD in the EU since 2007, Spengler d. 1936). A fresh translation from the
German is our own copyrightable work and owes Atkinson nothing but the courtesy any translator owes a
predecessor — consulted as one reference, never paraphrased. (US nuance, user's informed call: the German
original may carry a URAA-restored US copyright until 2027, so the derivative-translation right is a US gray
area until then; in the EU it is unambiguously free.) **Method, the proven scout→adversarial-judge flow
turned on translation:** (1) extract the German into a clean line-paragraphs source (`scripts/translate/
extract-mt-german.py`, char-level font filtering — drops the rotated "studienTEXT" watermark and the 2009
editor's Wikipedia footnotes, keeps Spengler's own *Decline* cross-reference footnotes; the Times-body vs
Arial-bold-header vs 10pt-footnote font split was the key); (2) a bilingual glossary
(`data/translation/mt-glossary.json`) seeded from the 40-term lexicon's `german` fields fixes the key terms
to the portal's established vocabulary; (3) translate faithful-in-register, independent of Atkinson, from the
German only; (4) **pilot Chapter 1 first** for user sign-off, then chapters 2–5. **Two refute-only judges per
chapter** (the load-bearing check): a *fidelity* judge (English vs German — omissions/additions/mistrans/
key-terms/names) and an *independence* judge (English vs the OCR'd Atkinson — distinctive copying). Result:
**ch1 1 hard + 3 soft (fixed); ch2–5 0 hard errors, 0 required independence changes.** The judges caught real
things — e.g. "lamb of the meadow" inventing "of the meadow" for plain *Schäflein*, and the prior annotation's
false claim that "Spengler's own footnote credits Uexküll" (no Uexküll footnote exists in the German — the
term is Uexküll's but Spengler used it without a note; the annotation was corrected). **Integration:** swap
the works.config M&T block to `layout:line-paragraphs`, `text_status:clean`, the new English source, a new
German-original source record, and `endnotes:global-numbered/bracket` (Spengler's footnotes now surface — the
OCR'd Atkinson had none); **re-anchor all 50 annotations** (every verbatim Atkinson anchor failed the loud
selector gate; a scripted by-id replace re-bound them, plus note-quote fixes); refresh the 5 M&T lexicon
definitions off the new wording; **retire the Atkinson assets** (`raw/Spengler_Man_and_Technics.txt`,
`corrections/man-technics.*`); correct `LICENSE-content.md`. `prepare:data`+`build` green (37 pages, 242
annotations, 50 M&T re-anchored, 15 M&T footnotes); browser-verified both reader chapters + footnotes +
re-anchored margin notes, no console errors. **Deferred to the publish step (Phase D, gated on explicit
go):** purge the Atkinson M&T text from git *history* (it sits in past commits) before the repo goes public,
then merge + flip public + wire Pages. The original 1931 Beck page numbers and the OCR'd German source
file's residual typos are noted but immaterial (the English translates past them).

## ADR-0017 — The Phase-Clock timeline shipped (Phase 3 #3; the third hero)
Third Phase-3 buildout — the deferred third hero is now live at `/timeline` (`PhaseClock.astro` was only ever
the decorative glyph). **(1) Form: a morphological time-spine, not a literal clock-dial.** Each high Culture
is a horizontal lane normalized to *its own* life-span `[birth → Civilization-end]`, so all births align at
the left edge and reading straight **down** any vertical line shows the stages Spengler calls "contemporary"
(Pericles beside the Baroque). This is the honest extension of the Comparative Tables' own logic (rows =
contemporary epochs regardless of calendar gap) and sidesteps the calendar-duration trap — Egypt's Culture
ran ~1700 calendar years and the West's ~1300, but normalized they read as homologous, which *is* the
contemporaneity thesis. A radial dial was rejected: less legible for "where is the West now," and the dial
motif is already spent on the glyph. **(2) Verification is the product — so the data is Spengler's own.** The
new `data/timeline/culture-phases.json` invents no dates: every phase boundary (Gothic 900–1500, Doric
1100–650, Old Kingdom, Late Chou, Caliphates→Mongol …) is transcribed from Comparative Tables II/III, cited
to `gutenberg-decline-i`. Only 5 Cultures are shown (Egyptian, Chinese, Classical, Magian, Western) — the
ones the Tables date concretely; Indian/Mexican lack the date-spine and are omitted (disclosed). The West's
Civilization terminus (~2200) and the "We are here · 2026" marker are flagged as Spengler's *forward
projection*, not a dated fact, in the `contemporaneity_note` printed on the page. New `timeline.schema.json`
+ a build-gate rule (phases ordered, non-overlapping, within span; birth in span; `now.culture` real;
citation exists). **(3) Reused the design language, not the geometry.** Lanes carry each Culture's `--cult`
hue at increasing opacity per phase (pre-cultural→civilization), and the Civilization band takes the dashed
faustian stroke that echoes `PhaseClock.astro`'s dashed "Civilization" outer ring. The island
(`PhaseTimeline.svelte`) is a frozen deterministic SVG (no animation loop) with a hover-guide that reads off
the contemporaries at any morphological age, focusable bands with aria-labels, and a `<details>` table
fallback. Added a "Timeline" nav entry. **(4) Browser-verified** (`preview_*`) in both themes: 5 lanes / 15
bands render, the focus-readout resolves ("Western (Faustian) · Civilization (Winter) — Modern · projected ·
1800 AD–2200 AD"), the "now" marker sits in the Western winter, zero console errors, legible light + night.
`prepare:data` + `build` green (now **37 pages**). `raw/`/`derived/` untouched.

## ADR-0016 — Comparative-Table cells deep-link to passages (Phase 3 #2)
Second Phase-3 buildout. The three Comparative Tables (136 cells of Spengler's own figures/movements) now
deep-link into the reader. **(1) Granularity: cell→chapter, by row-theme, not cell→paragraph.** The cells
are dense *name-lists* ("Plato (d. 346). Aristotle (d. 322).", "Doric (1100–500).") — Spengler's table
entries, not his prose — so a verbatim per-cell paragraph anchor mostly doesn't exist. Instead each linked
cell points at the reading **chapter that treats its theme** (the chapters are themselves comparative, so a
math row's four columns all legitimately point to *The Meaning of Numbers*). Anchors are `unit#p0`
(chapter-top); the schema/validator accept any `unit#pN` so future per-cell precision is a drop-in. AGENTS.md
claimed "the schema already allows `passage_targets`" — it did **not** (cell was `{text, note}`,
additionalProperties:false); added the field. **(2) Coverage is thematic + selective, and disclosed.**
29 of 136 cells linked — the rows with a strong single-chapter home: Table I math epochs (V/VIII/XII → *The
Meaning of Numbers*) and late world-feeling epochs (X/XI → *Buddhism, Stoicism, and Socialism*); Table II
early architecture rows → *Arts of Form* and late master rows → *Act and Portrait*; Table III estates/State/
money-Caesarism rows → the Vol II *State* + *Money* chapters. The forward-projected/anomalous Western cells
("from 2000", "1000–1200") are left unlinked. The page's source-note discloses the linking is "thematic and
selective — not every cell is wired" (no silent cap). **(3) The gate validates every target resolves** —
new rule in `validate-basic.mjs` checks each `passage_target`'s unit exists in the manifest and the paragraph
index is in range (0 ≤ N < `paragraph_count`); a negative test confirmed it fails loud on a bad unit and an
out-of-range paragraph. **(4) Authored via a throwaway line-insertion script** (unique text-snippet → insert
`passage_targets` before the cell's closing brace) to preserve the files' bespoke hand-formatting — a minimal
29-line diff, not a full `JSON.stringify` reformat; script deleted after. *Gotcha logged:* a `git checkout`
during a negative-test cleanup wiped the uncommitted targets in one table — re-authored, re-verified.
**(5) Verified in a real browser** (`preview_*`): 58 links render (29 cells × desktop table + mobile
accordion), labels resolve to chapter titles, targets return 200 with the `id="p0"` anchor present, zero
console errors, and the night-mode link colour is high-contrast light-gold on the dark page (the AGENTS
contrast trap doesn't bite — the link sits on the cell, not a coloured chip). `prepare:data` + `build` green
(36 pages, 29 passage_targets). `raw/`/`derived/` untouched.

## ADR-0015 — Lexicon expanded 23 → 40 terms (Phase 3 #1); dead see_also links closed
First Phase-3 buildout. The Vol II / M&T annotation pass (ADR-0013/0014) left a **lexicon debt**: 7
`see_also` slugs the reader renders as links — *being-waking-being* (14 refs), *blood-and-money* (9),
*beast-of-prey* (5), *technics* (4), *hand-and-tool* (3), *enterprise* (2), *cosmic-microcosm* (1) —
had **no matching lexicon node**, so `render.js` fell back to the raw slug text and the reader emitted a
**dead anchor** (`lexicon/#term-being-waking-being`). **(1) Diagnose against the data, not the prose.**
AGENTS.md listed ~14 "missing" slugs, but a script cross-referencing every annotation's `see_also` against
the live term ids showed 6 of them (caesarism, fellaheen, pseudomorphosis, second-religiousness, world-city,
destiny-causality) were *already* nodes — only **7 were genuinely unresolved**. Fixed the real gap, didn't
re-add what existed. **(2) Closed the 7, then added 10 breadth terms to reach 40** (roadmap target 40–50):
*tragedy* (16 `concept:` tags, the portal's most-anchored concept with no node), *world-cavern* (the Magian
prime-symbol), *mexican* (the 8th high Culture, completing the `culture` enum), *the-machine*,
*nature-knowledge*, *the-city*, *the-estates*, *nation*, *culture-seasons* (the four-season scheme the
Comparative Tables tabulate), *will-to-power*. +46 typed edges (36 → 82); every new node wired in, none
orphaned. Clustering is `culture||domain`, so *the-machine*/*nature-knowledge* (culture:faustian) land in the
Faustian cluster and *world-cavern* (culture:magian) in the Magian — correct, not lonely. **(3) Definitions
reuse the vetted annotation `note` text**, lifted to glossary altitude; difficult material (blood-and-money's
"might over right," beast-of-prey's predatory "praise") keeps its critical framing per the house convention,
never relayed flat. **(4) The adversarial judge held at the lexicon layer too.** A refute-only subagent
web-checked all 17: **17/17 confirmed, 0 hard errors** — and, true to ADR-0011, it *over-flagged then
self-corrected* three times (season→period mappings, the nobility=time/priesthood=space pairing — genuinely
correct but the most-mis-"corrected" point in Spengler, so left explicit; and the "world history is city
history" quote). Acted on its one live caveat: that phrase wasn't confirmed verbatim in the Atkinson text we
ship, so it was **demoted from a quotation to a paraphrase** (hard-rule #2). Each public term carries ≥1
non-Spengler citation; the M&T-anthropology terms (beast-of-prey/hand-and-tool/enterprise) lean on
`wikipedia-man-and-technics` with **empty `secondary`** rather than risk putting words in a scholar's mouth
(the ADR-0013 discipline). `prepare:data` + `build` green (36 pages, 242 annotations, **40 lexicon terms**,
82 edges). `raw/`/`derived/` untouched.

## ADR-0014 — Decline Vol II fully annotated (95 notes); portal annotation-complete
Same session as ADR-0013. *Decline* Vol II (14 ch) annotated to the Ch I showcase standard — **95 notes**,
bringing the portal to **242 annotations** and completing roadmap Phase 2 (every published reading unit is
now annotated). Worked in five committed batches by the book's own A/B/C groupings (Origin & Landscape,
Cities & Peoples, Arabian Culture, The State, Economic Life), each batch: author → anchor-check → gate →
refute-only judge → fix → commit.
Decisions/lessons recorded. **(1) Scale method: read by Spengler's own concordance, not cover-to-cover.**
Vol II is ~262k words; reading every chapter whole would blow context. Instead the marginal-summary
concordance (`data/concordance/decline-vol-ii.concordance.json`) gives each chapter's argument-map, and
targeted `grep`/offset-reads pulled the exact passages to anchor. This made 14 dense chapters tractable.
**(2) The adversarial judge earns its keep at scale.** Over five batches it caught *real* errors a reader
would have repeated as fact: a phrase ("heroically wrong") that is Trevor-Roper's, not Hughes's; a
Spengler/Nazism framing clean enough to imply he was an anti-Nazi liberal (he voted Hitler 1932 and carried
his own "Coloured World-Revolution" racism, even as he rejected Nazi race-*biology* and was suppressed by the
regime); a mis-emphasis of Farrenkopf (his *Prophet of Decline* centres on world-history/geopolitics, not a
narrow democracy-money reading); the Caesarism sentence's actual names (Hwang-ti/Amasis/Alp Arslan, not
"Shi-hwang-ti"); and a false-friend "anti-capitalist" in the note on Spengler's idiosyncratic "Socialism"
(he attacks the money-power, not enterprise). Every flag was verified before acting; the judge also
over-flags, so ADR-0011's "verify before obeying" held. **(3) Sensitive material handled as
`difficult-material` with critical framing, not silence:** the anti-Darwinian polemic (ch II), the Race
chapter's anti-biological "race" read "with both eyes open" (ch V), the sterility/gender passage (ch IV),
the slave-as-money (ch XIII), and the "might makes right / money overthrown only by blood" climax (ch XIV)
— each discloses what Spengler withholds rather than relaying it flat. **(4) Scholar diversity:** Frye,
Adorno, Hughes, Farrenkopf spread across the volume (Frye was over-used in Vol I; here used once). **(5)
Surfaced lexicon debt:** the new `lexicon-term` notes `see_also` slugs (pseudomorphosis, world-cavern,
being-waking-being, caesarism, second-religiousness, fellaheen, blood-and-money, …) that are not yet nodes
in the lexicon graph — Phase 3's lexicon expansion should promote them. `raw/`/`derived/` untouched.

## ADR-0013 — Man and Technics fully annotated (50 notes) via the proven scout → adversarial-judge flow
First buildout after OCR closed out. *Man and Technics* (5 ch) is now annotated to the Vol I showcase
standard — **50 notes** (10/9/9/10/12), lifting the portal to **147 annotations** total. Reused the
ADR-0010/0011 method verbatim: author candidate notes with verbatim, uniquely-resolving anchors pulled
from `derived/`, then spawn a refute-only subagent that web-checks every factual claim and confirms each
scholarly-reception note faithfully represents the named scholar. The judge (web access live) returned
**50/50 confirmed, 0 hard errors**; its one soft caveat — that the Hughes note's phrase "worn worst" read
as a quotation rather than a paraphrase — was verified and tightened (not obeyed blindly; ADR-0011's rule).
Three decisions worth recording. **(1) For a work the registry's scholars cover only generally, lean on the
ungated note kinds.** Hughes/Adorno/Frye are *Decline*-specific and Farrenkopf spans the whole corpus; rather
than risk putting words in a scholar's mouth about M&T, the set is weighted toward teacher-notes
(claim_type `interpretive`) and form-observations / cross-culture-parallels (`source-text-observation`) —
honest readings of the text that the dual gate does not force to carry an external citation — with
`scholarly-reception` used only twice, where a position was web-verifiable: **Farrenkopf** (M&T marks
Spengler's turn "from qualified to fully apocalyptic," incl. ecological collapse — corroborated against a
review of *Prophet of Decline*) and **Hughes** (read Spengler as a morphologist of cultural style, not a
checkable forecaster). This diversifies away from the over-used Frye (AGENTS.md note). **(2) Five new
reference sources, each web-verified before use** (19 total): Wikipedia *Man and Technics* (publication
facts, the tech-diffusion thesis), Wikipedia *Rousseau*, SEP *History of Utilitarianism* (Bentham/Mill),
Wikipedia *Umwelt* (Uexküll, whom Spengler's own footnote cites), Wikipedia *Faithful unto Death*. The
last grounds the highest-value note in the set: Spengler's famous closing image — the Pompeii sentry who
"died at his post" — is a **19th-century literary legend** (Bulwer-Lytton 1834 / Poynter 1865); the
structure at the Herculaneum Gate was a tomb. The note discloses this rather than relaying the image as
fact. **(3) Anchoring gotcha in the `wrapped` layout.** M&T paragraphs interleave footnote lines, so one
anchor silently spanned a footnote break and failed the selector build's `indexOf`; a throwaway checker
mirroring `build-annotation-selectors` caught all anchors before the pipeline run. Keep anchors to one
contiguous clause. `prepare:data` + `build` green (36 pages, 147 annotations); the OCR'd `derived/` text was
**not** re-touched (a few residual valid-word garbles remain in M&T and were avoided as anchor sites).

## ADR-0012 — Re-source Vol II from clean Gutenberg #78914 (re-sourcing beats OCR correction)
The user found that Project Gutenberg had released a clean, human-proofread edition of *Decline* Vol II
(eBook #78914, the Atkinson/Knopf translation) — which did not exist when Vol II was first ingested from
an Internet-Archive scan. **Decision: replace the OCR source entirely rather than keep correcting it.** A
clean published edition is categorically better than any amount of constrained OCR repair, and it dissolves
the whole problem: the 1077-flag human-review queue (ADR-0009) is **eliminated**, not worked down. The
general lesson, recorded for future OCR'd works: *before* investing in an `/ocr-correct` pass, check whether
a clean Gutenberg/other edition exists — re-sourcing wins. (M&T stays OCR-corrected: 1932 Knopf, still under
US copyright, so not on Gutenberg.)
Mechanics: `scripts/ingest/extract-vol-ii-gutenberg.mjs` converts the (gitignored) Gutenberg HTML into a
plain-text source in the *same line-paragraphs shape as Vol I* — `CHAPTER` headers, one paragraph per line,
a `CONTENTS OF VOLUME II` block (the concordance source, from the HTML TOC), `[N]` footnote refs, page
numbers glued at paragraph starts (so `depaginate` rebuilds the page-map), and 941 global-numbered endnotes.
works.config then switches Vol II to `layout:line-paragraphs` / `text_status:clean`, so the *entire existing
pipeline* (cleaner, footnotes, concordance, manifest, search) processes it unchanged. raw/ stays read-only:
the OCR file `raw/Spengler_Decline_II.txt` is untouched; the IA overlay + review-queue were retired (git
history preserves them). Result: 14 clean reading units (16 → 30 total), 941 footnotes, 148 concordance
topics (146 deep-linked), 447 page anchors — full Vol I parity.
Two latent reader-layer bugs surfaced and were fixed (they only ever mattered once a *second* volume
published): `guide-data.js` loaded **only Vol I's** concordance and footnotes, and keyed footnotes by number
— but footnote numbers restart per volume, so Vol I/II would collide. It now merges concordance across all
published volumes and keys footnotes **per volume**. A small generality fix to `build-footnotes`: locate the
endnotes block after the *last* chapter header (so a prose enumerated "1." — Vol II ch III — isn't mistaken
for the notes start; no Vol I regression). And the extractor strips tags as empty, not space, so italics
before punctuation don't leave " ." artifacts.

## ADR-0011 — Vol I fully annotated; Tables II/III shipped from the raw with editorial notes
Same session as ADR-0010, after the user green-lit online resources. Two follow-throughs that supersede
ADR-0010's "deferred/blocked" notes. (1) **All 11 chapters of Decline Vol I are now annotated** to the
Ch I showcase standard (97 notes total), each chapter run through the scout → adversarial-judge flow. Two
points learned at scale: (a) reuse the *verified-quotable* secondary source where it fits (Frye's Daedalus
essay, read from a saved PDF, supplied most receptions) but **diversify** — Frye ended up over-represented;
prefer spreading Hughes/Adorno/Farrenkopf when their documented positions genuinely cover the passage.
(b) **The judge is fallible — verify its flags.** On ch 10 it reported a "missing anchor" that in fact sat
at para 85 of a 181-paragraph chapter; grep + the selector build both confirmed the anchor resolves, so the
flag was overridden rather than obeyed. The selector build (`build-annotation-selectors`, fails loud on a
non-unique/missing anchor) is the ground truth for anchoring; the judge is ground truth for *sourcing*.
(2) **Tables II & III were shipped after all** — the deferral in ADR-0010 was for lack of a clean source;
on inspection the raw `.txt` corruption is *localized* (Table II clean; Table III's columns reconstructable
from the period-anchors Old Kingdom/Doric/Early-Chou/Gothic + dates), so they were transcribed with
**editorial `cell.note`s** flagging the few genuinely corrupt cells (the future-projected Western
Civilization dates printed as "1000–1200"/"after 1200"; a "rulers of Thebes" column-bleed) rather than
silently guessed — the same correct-and-disclose convention Table I uses for the Hus date. The schema was
generalized (phases/rows.phase no longer locked to the four seasons; optional `phase.cult`), the island's
`phaseColor()` extended for pre-cultural/early/late/civilization, and `/tables` now renders all three.

## ADR-0010 — Annotation depth (Vol I ch 2–4) via scout → adversarial-judge; Tables II/III deferred
Three coupled decisions in the first annotation-depth/breadth buildout after OCR. (1) **Each note earns
its sourcing through an independent adversarial check.** For every chapter I author the candidate notes
(pulling *verbatim, uniquely-resolving* anchors straight from `derived/`, since `build-annotation-selectors`
fails loud on any anchor that doesn't match exactly once), then spawn a separate subagent whose only job is
to **refute** each note — verifying factual claims against the cited source via web, and verifying that
every `scholarly-reception` note faithfully represents what the named scholar actually argued (not a
plausible-sounding paraphrase). This caught a real slip (the "Goethe gave me method, Nietzsche the
questioning faculty" line is in the *Preface*, not the Introduction) and confirmed the harder attributions
(Frye verbatim from the *Daedalus* PDF; Adorno's fatalism critique corroborated across independent sources).
The build gate proves *anchoring*; the judge proves *truth* — both are required before a note ships.
(2) **The verified bibliography is the real bottleneck, so expand it first.** Annotation depth and lexicon
breadth both starve without scholars to attribute to and references to cite. Added (web-verified) Adorno
*Prisms*, Farrenkopf *Prophet of Decline*, Frye's *Daedalus* essay, SEP *Pythagoras*, SEP *Continuity and
Infinitesimals*, and the Wikipedia *Decline* article (a `reference` whose coverage was confirmed before use,
for neutral glosses paired with scholarly-secondary). Lexicon grew 13 → 23 terms on this base.
(3) **Comparative Tables II & III deferred for lack of a clean source.** They exist in `raw/` (II: lines
~7538-7604; III: ~7606-7694) but the Gutenberg `.txt` export has corrupted their column structure (Table III
especially — cells bleed across lines). Transcribing them from *that* dump would risk shipping garbled cells,
violating "verification is the product." The schema/island/page generalization is contained and understood
(loosen the four-season `phases`/`rows.phase` enums; extend `ComparativeTable.svelte` `phaseColor()` for
pre-cultural/early/late/civilization; make `tables/index.astro` render all `*.table.json`) — the blocker is a
*clean, auditable* source (Gutenberg HTML ebook 72344, or another edition), not the code.

## ADR-0009 — Human-review tooling + the Vol II OCR pass at scale
Two coupled decisions. (1) **A self-contained offline review tool** (`review/index.html`, generated by
`scripts/review/`): the flag queue is cleared by typing/pasting the correct reading per garble, with
suggestion chips, Internet-Archive scan deep-links (search *clean neighbour words*, so any scan of the
same translation lands on the right passage), a widen-the-span control for split words, localStorage
progress, and export by **download or copy-paste** (whichever the reviewer has access to). It applies via
`apply-review-resolutions.mjs`, which **validates that each resolution anchors uniquely** in the
mechanically-cleaned text (the queue's `context` is whitespace-flattened, so match flexibly, then store a
literal intra-paragraph context the build's exact matcher can re-find), promotes `fix`→`method:human`,
logs `illegible`, and **fails loud** on anything that doesn't anchor — never guesses. Defence-in-depth:
the browser tool is the convenient surface, the apply step is the rigorous gate.
(2) **Vol II classification scaled by bulk-keep, not brute force.** 6,671 distinct candidates (≈20× M&T)
is too many to LLM-classify one-by-one, and most are proper nouns. So `prefilter.mjs` **bulk-keeps
recurring capitalised tokens** (a name recurs; OCR rarely repeats a garble exactly — and keeping is the
*safe* default, since a kept garble stays honest while a wrong fix corrupts) → 882 names to the allowlist,
leaving 3,946 genuine residual, fanned across 12 sub-agent batches → 518 fixes / 1,336 flags / 2,092 kept.
Content-dropping "fixes" (`itsiuture→its`) are demoted to flags. (3) **Cross-scan consensus** (`consensus.mjs`):
JD supplied independent scans (`raw/*_Alternate.pdf`); for each flag we anchor its clean neighbouring words
in the alt and adopt the aligned token — high-precision (two-sided anchor *or* tight edit; content-drop and
high-edit+short-anchor misalignment guards; trust the alt's own case). It even beats the LLM where the LLM
guessed wrong (`hee`→`bee`, not "free"). Iterated passes — allowlist/foreign words as anchors, proper-noun
adoption (a name recurs; a one-off alt-garble doesn't), context-refresh from the now-cleaner text, and the
**German originals** (`raw/German_*.txt`) fed in via `--allow` as an extra lexicon for the German/Latin/Greek
scholarly terms — auto-cleared **266 flags** (Vol II 259, M&T 7) before manual review. (`raw/` is gitignored:
the canonical `Spengler_*.txt` stay tracked, reference scans/originals don't.) Vol II stays `ocr-correcting`
(disclosed, unpublished) until the queue is worked down — verification is the product.

## ADR-0008 — OCR correction via a reusable skill; M&T published, Vol II sized
Built `~/.claude/skills/ocr-correct` and used it to publish *Man and Technics*. The load-bearing
finding: deterministic nearest-dictionary-word correction is **unsafe** (it clobbers proper nouns and
mis-fixes garbles), so the detector only finds non-word candidates and **constrained LLM classification
under a conservative default** (keep / minimal-edit fix / flag-the-unreconstructable) decides; every
fix is hand-reviewed; corrections live in an append-only overlay (raw immutable) and are disclosed
per-token in the reader. M&T: 78 fixes, 64 flags for human review. Vol II is sized but deferred — it
needs cleaner tuning (title leak, symbol footnotes) plus a larger correction pass; the recipe is proven.
This supersedes ADR-0002's "M&T deferred."


## ADR-0007 — Astro 7 + Svelte islands; vanilla elsewhere
The reader, search, theme, and typography stay framework-free vanilla ES modules (the proven Melville
pattern). The two hero features carry real reactive state, so they are **Svelte islands**
(`@astrojs/svelte`, `client:visible`), SVG-rendered. One framework for both islands. SVG over Canvas:
real focusable/labelable DOM nodes (accessibility), crisp print, CSS-variable theming, deep-linkable.
No d3-force — a ~120-line custom force sim at N≈30 nodes keeps the dependency tree clean.

## ADR-0006 — Hero features: Comparative Table + Concept Lexicon graph
The two showpieces are (1) an interactive recreation of Spengler's *Comparative Morphology of History*
tables and (2) a concept lexicon with a force-directed graph. The phase-clock timeline and slide-deck
orientation primers are **deferred**. Rationale: the table and lexicon are Spengler's two most
distinctive intellectual structures and both are directly source-groundable.

## ADR-0005 — Morphological / Diagrammatic design system, culture-keyed
A Culture is one hue, carried systematically (`data-cult` attribute → `--cult` token) across table,
graph, tags, and reader margins, so the whole portal reads as one atlas. Chosen over an austere
"Faustian Twilight" or print-journal "Weimar Scholarly" identity because it makes Spengler's
comparative method legible in the interface itself.

## ADR-0004 — Dual verification gate (the Spengler wrinkle)
Melville enforced one rule: teaching claims cite a non-primary source. Spengler is a **contested**
thinker, so most valuable notes are interpretation, not fact. We add a second, orthogonal branch:
interpretation notes must name a scholar, cite a `scholarly-secondary` source, and be attributed
(not asserted). The build fails if interpretation is smuggled in as fact, or fact smuggled in
unsourced. A `view:fact` vs `view:interpretation` filter exposes the split to readers.

## ADR-0003 — `raw/` immutable; `derived/` is the reading spine
Unlike Melville (clean vendored XHTML), our sources are raw `.txt` of three very different qualities.
A first-class, deterministic, **logged** cleanup stage (`build-cleaned-spine.mjs`) turns `raw/` into a
committed `derived/` spine; every edit is recorded in a `cleanup-log.json`. Meaning-changing OCR
corruption is **flagged, never auto-fixed**, and blocks `student-ready` on any unit that contains an
unresolved flag.

## ADR-0002 — Vol II and Man and Technics bodies deferred
Both *Decline* Vol II and *Man and Technics* are Internet-Archive OCR with corruption that cannot be
auto-corrected without guessing at meaning (`Encychfadia Britanika`, `igzE`, `Ctdture` for `Culture`,
broken drop-caps). That violates "verification is the product." Both are registered in the manifest
(`text_status: raw-deferred`) for navigation, but their prose is not published until a
human-in-the-loop cleanup pass. Only the clean Project Gutenberg Vol I is published in this slice.

## ADR-0001 — Adapt the Melville portal architecture
Reuse the proven data-first Astro pipeline: TextQuoteSelector annotations, build-time search index,
public/draft separation, schema-first validation. Extend it for Spengler with a `work/volume` axis, a
concordance layer, Spengler-specific annotation kinds, and the comparative-table + lexicon schemas.
