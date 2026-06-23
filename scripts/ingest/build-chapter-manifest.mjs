// build-chapter-manifest.mjs — the single reading manifest, merged from config + derived spines +
// hand-authored summary seeds. Deferred works are registered (for navigation) without a clean body.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const config = JSON.parse(readFileSync(resolve(ROOT, "data/works/works.config.json"), "utf8"));

function volKey(workId, volId) { return volId ? `${workId}-${volId}` : workId; }
function readJson(p, fallback) { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback; }

const summarySeeds = readJson(resolve(ROOT, "data/chapters/summary-seeds.json"), { seeds: {} });

const works = [];
const units = [];

for (const work of config.works) {
  const workEntry = {
    id: work.id,
    title: work.title,
    subtitle: work.subtitle || null,
    author: work.author,
    translator: work.translator,
    source_id: work.source_id,
    volumes: [],
  };
  for (const vol of work.volumes) {
    const vk = volKey(work.id, vol.id);
    // 'ocr-correcting' = processed (derived text exists for candidate-gen) but NOT yet published.
    const published = vol.text_status === "clean" || vol.text_status === "ocr-corrected";
    const volEntry = {
      key: vk,
      id: vol.id,
      title: vol.title,
      text_status: vol.text_status,
      published,
      unit_ids: [],
    };
    const spine = published ? readJson(resolve(ROOT, "derived", `${vk}.spine.json`), { chapters: [] }) : { chapters: [] };
    const spineByN = new Map(spine.chapters.map((c) => [c.n, c]));

    for (const ch of vol.chapters) {
      const sc = spineByN.get(ch.n);
      const slug = ch.title.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const uid = sc ? sc.unit_id : `${vk}-ch-${String(ch.n).padStart(2, "0")}-${slug}`;
      const seed = summarySeeds.seeds[uid] || {};
      const unit = {
        unit_id: uid,
        work: work.id,
        work_title: work.title,
        volume: vol.id,
        volume_title: vol.title,
        n: ch.n,
        roman: ch.roman,
        title: ch.title,
        function: ch.function,
        published: published && !!sc,
        text_status: vol.text_status,
        clean_path: sc ? sc.clean_path : null,
        char_count: sc ? sc.char_count : null,
        paragraph_count: sc ? sc.paragraph_count : null,
        paragraph_offsets: sc ? sc.paragraph_offsets : [],
        segments: sc ? sc.segments : [],
        page_map: sc ? sc.page_map : [],
        footnote_refs: sc ? sc.footnote_refs : [],
        ocr_corrections: sc ? sc.ocr_corrections || [] : [],
        summary: {
          one_line: seed.one_line || null,
          student: seed.student || null,
          why_it_matters: seed.why_it_matters || null,
        },
        cultures: seed.cultures || [],
        domains: seed.domains || [],
      };
      units.push(unit);
      volEntry.unit_ids.push(uid);
    }
    workEntry.volumes.push(volEntry);
  }
  works.push(workEntry);
}

mkdirSync(resolve(ROOT, "data"), { recursive: true });
writeFileSync(resolve(ROOT, "data/manifest.json"), JSON.stringify({ generated_by: "build-chapter-manifest", works, units }, null, 2));

const pub = units.filter((u) => u.published).length;
console.log(`build-chapter-manifest: ${units.length} units (${pub} published, ${units.length - pub} registered/deferred).`);
