// build-reading-paths.mjs — curated routes through the corpus. Validates that every referenced unit
// exists and is published, then emits data/paths/paths.json for the reader.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifest = JSON.parse(readFileSync(resolve(ROOT, "data/manifest.json"), "utf8"));
const published = new Set(manifest.units.filter((u) => u.published).map((u) => u.unit_id));
const vol1 = manifest.units.filter((u) => u.work === "decline" && u.volume === "vol-i" && u.published).map((u) => u.unit_id);

const paths = [
  {
    id: "essential-introduction",
    title: "The Essential Introduction",
    blurb: "Start here. The single chapter that states the whole thesis — fully annotated.",
    units: ["decline-vol-i-ch-01-introduction"],
  },
  {
    id: "comparative-spine",
    title: "The Comparative Spine",
    blurb: "The chapters where Spengler's morphology of Cultures is densest — read alongside the Tables.",
    units: [
      "decline-vol-i-ch-01-introduction",
      "decline-vol-i-ch-03-the-problem-of-world-history-physiognomic-and-systematic",
      "decline-vol-i-ch-04-the-problem-of-world-history-the-destiny-idea-and-the-causality-principle",
      "decline-vol-i-ch-06-makrokosmos-apollinian-faustian-and-magian-soul",
      "decline-vol-i-ch-10-soul-image-and-life-feeling-buddhism-stoicism-and-socialism",
      "decline-vol-i-ch-11-faustian-and-apollinian-nature-knowledge",
    ],
  },
  {
    id: "vol-i-full",
    title: "Volume I — Form and Actuality",
    blurb: "The complete first volume, in order.",
    units: vol1,
  },
];

const errors = [];
for (const p of paths) for (const u of p.units) if (!published.has(u)) errors.push(`path ${p.id}: unpublished/unknown unit ${u}`);
if (errors.length) { console.error("build-reading-paths: ERRORS\n  " + errors.join("\n  ")); process.exit(1); }

mkdirSync(resolve(ROOT, "data/paths"), { recursive: true });
writeFileSync(resolve(ROOT, "data/paths/paths.json"), JSON.stringify({ paths }, null, 2));
console.log(`build-reading-paths: ${paths.length} paths validated.`);
