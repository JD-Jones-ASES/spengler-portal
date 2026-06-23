// search-ui.js — the ⌘K command palette. Lazy-loads the build-time index and does token search in
// memory over chapters (full prose), annotations, lexicon, concordance topics, table cells, footnotes.

export function initSearch() {
  const overlay = document.getElementById("search-overlay");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");
  const facetRow = document.getElementById("search-facets");
  if (!overlay || !input) return;

  const BASE = document.documentElement.dataset.base || "/";
  const withBase = (p) => (BASE.endsWith("/") ? BASE : BASE + "/") + String(p).replace(/^\/+/, "");

  const TYPE_LABEL = { chapter: "Text", note: "Annotation", lexicon: "Lexicon", topic: "Topic (Spengler's index)", table: "Comparative Table", footnote: "Translator's note" };
  const TYPE_ORDER = ["lexicon", "topic", "note", "table", "chapter", "footnote"];

  let index = null;
  let facet = "all";
  let active = -1;
  let flat = [];

  async function ensureIndex() {
    if (index) return index;
    const res = await fetch(window.__SP_SEARCH_INDEX__ || withBase("search-index.json"));
    index = (await res.json()).records;
    return index;
  }

  function open() {
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
    document.body.classList.add("search-lock");
    ensureIndex().then(() => input.focus());
  }
  function close() {
    overlay.classList.remove("open");
    document.body.classList.remove("search-lock");
    setTimeout(() => (overlay.hidden = true), 160);
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q || !index) return [];
    const toks = q.split(/\s+/).filter(Boolean);
    const out = [];
    for (const r of index) {
      if (facet !== "all" && r.type !== facet) continue;
      const hay = r.terms;
      if (!toks.every((t) => hay.includes(t) || r.title.toLowerCase().includes(t))) continue;
      let score = 0;
      const tl = r.title.toLowerCase();
      if (tl.includes(q)) score += 100;
      for (const t of toks) {
        if (tl.includes(t)) score += 20;
        if (r.snippet.toLowerCase().includes(t)) score += 4;
        else if (hay.includes(t)) score += 2;
      }
      out.push({ r, score });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  function render(q) {
    const hits = search(q);
    flat = [];
    active = -1;
    if (!q.trim()) {
      results.innerHTML = `<p class="sr-hint">Type to search the full text, the annotations, the lexicon, Spengler's own topic-index, and the Comparative Tables.</p>`;
      return;
    }
    if (!hits.length) {
      results.innerHTML = `<p class="sr-hint">No matches for “${esc(q)}”.</p>`;
      return;
    }
    const groups = {};
    for (const h of hits) (groups[h.r.type] ||= []).push(h.r);
    let html = "";
    for (const type of TYPE_ORDER) {
      const list = groups[type];
      if (!list) continue;
      html += `<div class="sr-group"><p class="sr-grouphead">${TYPE_LABEL[type]} <span class="sr-count">${list.length}</span></p>`;
      for (const r of list.slice(0, 8)) {
        const idx = flat.length;
        flat.push(r);
        html += `<a class="sr-opt" href="${esc(withBase(r.path))}" data-i="${idx}"><span class="sr-type" data-cult="${r.cult?.[0] || ""}">${TYPE_LABEL[type]}</span><span class="sr-main"><span class="sr-title">${esc(r.title)}</span><span class="sr-snip">${esc(r.snippet)}</span></span></a>`;
      }
      if (list.length > 8) html += `<p class="sr-more">+${list.length - 8} more…</p>`;
      html += `</div>`;
    }
    results.innerHTML = html;
  }

  function move(d) {
    const opts = results.querySelectorAll(".sr-opt");
    if (!opts.length) return;
    active = (active + d + opts.length) % opts.length;
    opts.forEach((o, i) => o.classList.toggle("active", i === active));
    opts[active].scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("input", () => render(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") {
      const opts = results.querySelectorAll(".sr-opt");
      const el = active >= 0 ? opts[active] : opts[0];
      if (el) { e.preventDefault(); location.href = el.getAttribute("href"); }
    } else if (e.key === "Escape") { close(); }
  });

  facetRow?.addEventListener("click", (e) => {
    const b = e.target.closest(".facet-btn");
    if (!b) return;
    facet = b.dataset.facet;
    facetRow.querySelectorAll(".facet-btn").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render(input.value);
  });

  overlay.addEventListener("click", (e) => { if (e.target.closest("[data-search-close]")) close(); });
  document.getElementById("search-open")?.addEventListener("click", open);
  document.addEventListener("keydown", (e) => {
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName))) {
      e.preventDefault();
      overlay.hidden ? open() : close();
    }
  });
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
