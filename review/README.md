# OCR review tool

`index.html` is a **self-contained, offline** tool for clearing the OCR human-review queues
(`corrections/<work>.review-queue.json`). No server, no build of the site — just open it.

## Use it

1. **Open** `review/index.html` in any browser (double-click is fine — it needs no server).
2. For each flagged garble it shows the passage, a parsed **suggestion** (a hint to *verify*, never
   trusted), and a **"View on the scan ↗"** deep link that searches the Internet-Archive page images.
3. **Type or paste** the correct reading into the box (it's pre-filled with the OCR text, so a typo
   like *Betracktungen* is a two-key edit). For a split word like *strug. gle*, click **widen right**
   to grow the replace-span, then fix it. Press **Enter** to save and jump to the next flag.
   - If the scan itself is unreadable there, click **Illegible** — it's logged, kept disclosed, never
     guessed.
   - **Skip** leaves a flag for later. Progress is saved in your browser, so you can do these in
     several sittings.
4. When you're done (or want to stop), open **Export your resolutions** at the bottom. Two ways out,
   depending on what you have to hand:
   - **⬇ Download** `<work>.resolutions.json` into `corrections/`, then run **`npm run review:apply`**.
   - **⧉ Copy** the JSON and paste it back into the Claude session — it will apply them for you.

## How applying works

`npm run review:apply` (→ `scripts/ingest/apply-review-resolutions.mjs`) validates every resolution:
the passage must anchor uniquely in the cleaned text, and the replacement must actually land when the
overlay is applied. Valid `fix`es become `method: "human"` entries in `corrections/<work>.corrections.json`;
`illegible`s are logged to `corrections/<work>.review-resolved.json`; resolved flags leave the queue.
Anything that doesn't anchor is reported and **left in the queue** — nothing is guessed, and `raw/` is
never touched. Use `--dry-run` to preview without writing.

Then `npm run prepare:data` re-cleans, applies the overlay, and re-validates; corrected tokens get the
in-reader `data-ocr` hover.

## Regenerate

`index.html` embeds the current queues. After applying resolutions (or a new `/ocr-correct` pass adds
flags), refresh it with **`npm run review`**.
