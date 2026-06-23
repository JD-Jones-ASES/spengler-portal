// apply-review-resolutions.mjs — fold a reviewer's resolutions (exported from review/index.html) into
// the append-only corrections overlay, and clear the matching flags from the review queue.
//
//   node scripts/ingest/apply-review-resolutions.mjs [path/to/<work>.resolutions.json ...]
//
// With no args it applies every corrections/*.resolutions.json it finds. For each resolution it
// VALIDATES that the correction actually anchors — the `context` must occur exactly once in the
// mechanically-cleaned text (the same string the build's applyCorrections resolves against) and the
// replacement must take when the whole overlay is applied. Anything that doesn't anchor is reported
// loudly and left in the queue; nothing is guessed and raw/ is never touched. A `fix` becomes a
// `method: "human"` correction; an `illegible` is logged as unreadable (kept honestly disclosed).
//
// After it runs, regenerate: npm run prepare:data

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
import { config, volKey, applyCorrections, buildMechanical } from "./build-cleaned-spine.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CORR = resolve(ROOT, "corrections");
const today = new Date().toISOString().slice(0, 10);

// ---- locate inputs --------------------------------------------------------
let inputs = process.argv.slice(2);
const DRY = inputs.includes("--dry-run");
inputs = inputs.filter((a) => a !== "--dry-run");
if (DRY) console.log("[dry-run] validating only — no files will be written.");
if (!inputs.length) {
  inputs = existsSync(CORR)
    ? readdirSync(CORR).filter((f) => f.endsWith(".resolutions.json")).map((f) => resolve(CORR, f))
    : [];
}
if (!inputs.length) {
  console.log("No .resolutions.json found. Export from review/index.html (Download), drop it in corrections/, and re-run — or paste the JSON to Claude.");
  process.exit(0);
}

// map volKey → volume object (so "man-technics" / "decline-vol-ii" resolve to their config entry)
const volByKey = new Map();
for (const work of config.works) for (const vol of work.volumes) volByKey.set(volKey(work.id, vol.id), { work, vol });

let grandFixes = 0, grandIllegible = 0, grandErrors = 0;

for (const inPath of inputs) {
  const payload = JSON.parse(readFileSync(inPath, "utf8"));
  const wk = payload.work;
  const resolutions = payload.resolutions || [];
  console.log(`\n▶ ${basename(inPath)} — ${resolutions.length} resolution(s) for ${wk}`);

  const entry = volByKey.get(wk);
  if (!entry) { console.error(`  ! unknown work "${wk}" (not in works.config.json) — skipped`); grandErrors++; continue; }

  // mechanically-cleaned chapter text — what the build's applyCorrections anchors against. The queue's
  // `context` strings are whitespace-FLATTENED (a footnote paragraph break became a single space), so
  // we locate them whitespace-flexibly, then re-derive a literal, intra-paragraph context that the
  // build's exact matcher can re-find.
  const flatten = (s) => s.replace(/\s+/g, " ");
  const chapters = buildMechanical(entry.vol).filter((r) => !r.error).map((r) => {
    const text = r.text;
    // flat string + map[k] = original index of flat char k
    let flat = "", map = [], i = 0;
    while (i < text.length) {
      if (/\s/.test(text[i])) { flat += " "; map.push(i); while (i < text.length && /\s/.test(text[i])) i++; }
      else { flat += text[i]; map.push(i); i++; }
    }
    return { roman: r.ch.roman, title: r.ch.title, text, flat, map };
  });

  // Locate (storedContext, beforeWindow) and return a literal, unique, single-paragraph context that
  // contains beforeWindow — or {error}. Requires the flattened context to occur exactly once overall.
  function deriveAnchor(storedCtx, before) {
    const flatCtx = flatten(storedCtx).trim();
    const hits = [];
    for (const c of chapters) { let p = c.flat.indexOf(flatCtx); while (p >= 0) { hits.push({ c, p }); p = c.flat.indexOf(flatCtx, p + 1); } }
    if (hits.length === 0) return { error: "context not found in the cleaned text (it may have shifted) — re-flag with a longer context" };
    if (hits.length > 1) return { error: `context occurs ${hits.length}× across the text (ambiguous) — needs a longer, unique context` };
    const { c, p } = hits[0];
    const realStart = c.map[p];
    let bp = c.text.indexOf(before, Math.max(0, realStart - 2));
    if (bp < 0) bp = c.text.indexOf(before);
    if (bp < 0) return { error: `before_window "${before}" not found at the matched location` };
    const ps = c.text.lastIndexOf("\n\n", bp), paraStart = ps < 0 ? 0 : ps + 2;
    let pe = c.text.indexOf("\n\n", bp); if (pe < 0) pe = c.text.length;
    for (let pad = 24; pad <= 240; pad += 24) {                 // widen until unique in the chapter
      const s = Math.max(paraStart, bp - pad), e = Math.min(pe, bp + before.length + pad);
      const ctx = c.text.slice(s, e);
      if (c.text.split(ctx).length - 1 === 1 && ctx.includes(before)) return { chapter: c, context: ctx };
    }
    const whole = c.text.slice(paraStart, pe);
    if (whole.split(before).length - 1 === 1) return { chapter: c, context: whole };
    return { error: "could not build a unique single-paragraph anchor — re-flag with a longer context" };
  }

  // existing overlay + queue + resolved-log
  const overlayPath = resolve(CORR, `${wk}.corrections.json`);
  const overlay = existsSync(overlayPath)
    ? JSON.parse(readFileSync(overlayPath, "utf8"))
    : { work: wk, note: "OCR corrections overlay.", generated: today, corrections: [] };
  overlay.corrections = overlay.corrections || [];

  const queuePath = resolve(CORR, `${wk}.review-queue.json`);
  const queue = existsSync(queuePath) ? JSON.parse(readFileSync(queuePath, "utf8")) : { work: wk, flags: [] };
  queue.flags = queue.flags || [];

  const resolvedPath = resolve(CORR, `${wk}.review-resolved.json`);
  const resolvedLog = existsSync(resolvedPath) ? JSON.parse(readFileSync(resolvedPath, "utf8")) : { work: wk, note: "Flags resolved out of the review queue. status:unreadable = the scan itself can't be read (kept disclosed, never guessed).", resolved: [] };
  resolvedLog.resolved = resolvedLog.resolved || [];

  // locate the queue flag a resolution clears: exact (before+context), else before-only when unique
  // (consensus may have REFRESHED the context from the cleaned text, so it won't match the stored one).
  function flagIndexFor(r) {
    const exact = queue.flags.findIndex((f) => f.before === r.before && (f.context || "") === (r.context || ""));
    if (exact >= 0) return exact;
    const byBefore = queue.flags.map((f, i) => (f.before === r.before ? i : -1)).filter((i) => i >= 0);
    return byBefore.length === 1 ? byBefore[0] : -1;
  }
  const dupCorrection = (c) => overlay.corrections.some((x) => x.before === c.before && x.after === c.after && (x.context || "") === (c.context || ""));

  const errors = [];
  const newCorrections = [];
  const removeFlags = new Set();   // indices into queue.flags
  let nFix = 0, nIll = 0, nDup = 0;

  for (const r of resolutions) {
    const fi = flagIndexFor(r);
    if (r.action === "illegible") {
      if (fi < 0 && resolvedLog.resolved.some((x) => x.before === r.before && x.context === r.context)) continue; // already logged
      resolvedLog.resolved.push({ before: r.before, context: r.context, status: "unreadable", reviewed_date: today });
      if (fi >= 0) removeFlags.add(fi);
      nIll++;
      continue;
    }
    if (r.action !== "fix") continue;

    const before = r.before_window, after = r.after_window;
    if (!before || after == null) { errors.push(`"${r.before}": missing before_window/after_window`); continue; }
    if (after === before) { errors.push(`"${r.before}": replacement is unchanged ("${before}")`); continue; }
    if (!r.context || !r.context.includes(before)) { errors.push(`"${r.before}": before_window "${before}" is not inside the stored context`); continue; }

    const anchor = deriveAnchor(r.context, before);
    if (anchor.error) { errors.push(`"${r.before}": ${anchor.error}`); continue; }

    const correction = { before, after, context: anchor.context, method: r.method || "human", confidence: "high", reviewed_date: today };
    if (dupCorrection(correction)) { if (fi >= 0) removeFlags.add(fi); nDup++; continue; }
    newCorrections.push({ correction, ch: anchor.chapter, after });
    if (fi >= 0) removeFlags.add(fi);
    nFix++;
  }

  // ---- end-to-end check: apply the WHOLE overlay (existing + new) per affected chapter and confirm
  // each new replacement actually lands (catches overlaps with an existing correction). ----
  const candidate = overlay.corrections.concat(newCorrections.map((n) => n.correction));
  const affected = [...new Set(newCorrections.map((n) => n.ch).filter(Boolean))];
  for (const ch of affected) {
    const out = applyCorrections(ch.text, candidate).text;
    for (const n of newCorrections.filter((n) => n.ch === ch)) {
      if (!out.includes(n.after)) {
        errors.push(`"${n.correction.before}" → "${n.after}": did not land when the overlay was applied (overlaps another correction?)`);
        // drop it from the commit set
        const idx = newCorrections.indexOf(n); if (idx >= 0) newCorrections.splice(idx, 1);
      }
    }
  }

  // ---- write (only the validated ones) ----
  for (const n of newCorrections) overlay.corrections.push(n.correction);
  const keptFlags = queue.flags.filter((_, i) => !removeFlags.has(i));
  queue.flags = keptFlags;

  if (!DRY && (newCorrections.length || nIll || nDup)) {
    writeFileSync(overlayPath, JSON.stringify(overlay, null, 2) + "\n");
    writeFileSync(queuePath, JSON.stringify(queue, null, 2) + "\n");
    if (nIll) writeFileSync(resolvedPath, JSON.stringify(resolvedLog, null, 2) + "\n");
  }

  console.log(`  ✓ ${newCorrections.length} fix(es) added${nDup ? `, ${nDup} already present` : ""}, ${nIll} marked unreadable.`);
  console.log(`  queue: ${queue.flags.length} flag(s) remaining.`);
  if (errors.length) {
    console.log(`  ⚠ ${errors.length} resolution(s) NOT applied (left in the queue):`);
    for (const e of errors) console.log(`      • ${e}`);
  }
  grandFixes += newCorrections.length; grandIllegible += nIll; grandErrors += errors.length;
}

console.log(`\nDone: ${grandFixes} fixes, ${grandIllegible} unreadable, ${grandErrors} not applied.`);
if (grandFixes || grandIllegible) console.log(`Next: npm run prepare:data   (re-cleans, applies the overlay, re-validates)`);
if (grandErrors) process.exitCode = 1;
