// Build-time sitemap — static pages + every published reading unit, base-prefixed and absolute.
// Dependency-free (mirrors search-index.json.js); regenerates from the same manifest the pages use.
import { publishedUnits } from "../lib/guide-data.js";
import { withBase } from "../lib/site.js";

const SITE = "https://jd-jones-ases.github.io"; // matches `site` in astro.config

export function GET() {
  const staticPaths = ["", "read/", "tables/", "timeline/", "lexicon/", "sources/", "about/"];
  const unitPaths = publishedUnits().map((u) => `read/${u.unit_id}/`);
  const urls = [...staticPaths, ...unitPaths]
    .map((p) => `  <url><loc>${new URL(withBase(p), SITE).href}</loc></url>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.w3.org/2000/sitemaps/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
