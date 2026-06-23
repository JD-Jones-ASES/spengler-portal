// render.js — turn a unit's cleaned text + resolved annotations + footnote refs + section markers
// into reader HTML. One single left-to-right pass inserts inline marks at character offsets; the
// result is split into paragraphs and section markers are placed before the right paragraph.

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// annotations: [{id, kind, cultures, selector:{position:{start,end}}}]  (non-overlapping)
// footnotes:   [{number, offset}]
// segments:    [{roman, beforeParagraph}]
// ocr:         [{offset, before, after}]  (corrected tokens — `after` is what's in `text`)
export function renderUnit(text, annotations, footnotes, segments, ocr = []) {
  const ev = [];
  for (const a of annotations) {
    ev.push({ pos: a.selector.position.start, order: 1, kind: "open", a });
    ev.push({ pos: a.selector.position.end, order: 0, kind: "close", a });
  }
  for (const f of footnotes) ev.push({ pos: f.offset, order: 2, kind: "fn", number: f.number });
  for (const c of ocr || []) {
    ev.push({ pos: c.offset, order: 1, kind: "ocr-open", before: c.before });
    ev.push({ pos: c.offset + (c.after ? c.after.length : 0), order: 0, kind: "ocr-close" });
  }
  ev.sort((x, y) => x.pos - y.pos || x.order - y.order);

  let html = "";
  let cur = 0;
  for (const e of ev) {
    if (e.pos > cur) {
      html += escapeHtml(text.slice(cur, e.pos));
      cur = e.pos;
    }
    if (e.kind === "open") {
      const cult = (e.a.cultures && e.a.cultures[0]) || "";
      const interp = e.a.kind === "scholarly-reception" || (e.a.tags || []).includes("view:interpretation");
      html += `<span class="anno-mark" data-anno="${e.a.id}"${cult ? ` data-cult="${cult}"` : ""}${interp ? ' data-interp="1"' : ""} tabindex="0" role="button" aria-label="annotation">`;
    } else if (e.kind === "close") {
      html += "</span>";
    } else if (e.kind === "ocr-open") {
      html += `<span class="ocr-fix" title="OCR scan read: ${escapeHtml(e.before)}" aria-label="OCR-corrected from ${escapeHtml(e.before)}">`;
    } else if (e.kind === "ocr-close") {
      html += "</span>";
    } else if (e.kind === "fn") {
      html += `<sup class="fn-mark" data-fn="${e.number}" tabindex="0" role="button" aria-label="translator note ${e.number}">${e.number}</sup>`;
    }
  }
  html += escapeHtml(text.slice(cur));

  const paras = html.split(/\n\n+/);
  const segByPara = new Map((segments || []).map((s) => [s.beforeParagraph, s.roman]));
  let out = "";
  paras.forEach((p, i) => {
    if (segByPara.has(i)) out += `<div class="seg-mark" id="seg-${segByPara.get(i)}">${segByPara.get(i)}</div>`;
    out += `<p id="p${i}">${p}</p>`;
  });
  return out;
}

// Build the JSON payload the margin-card reads on hover (annotation + footnote content).
export function readerPayload(annotations, footnotes, sourceById, lexTermById, withBase) {
  const anno = {};
  for (const a of annotations) {
    const cites = new Set();
    for (const ev of a.evidence || []) for (const c of ev.citations || []) cites.add(c);
    if (a.attribution?.citation) cites.add(a.attribution.citation);
    anno[a.id] = {
      kind: a.kind,
      anchor: a.anchor,
      note: a.note,
      interpretation: a.kind === "scholarly-reception" || (a.tags || []).includes("view:interpretation"),
      attribution: a.attribution
        ? { scholar: a.attribution.scholar, work: a.attribution.work || null, year: a.attribution.year || null, stance: a.attribution.stance }
        : null,
      cultures: a.cultures || [],
      see_also: (a.see_also || []).map((id) => ({ id, term: lexTermById.get(id)?.term || id })),
      cites: [...cites].map((id) => {
        const s = sourceById.get(id);
        return s ? { id, title: s.title, url: s.url } : { id, title: id, url: null };
      }),
    };
  }
  const fn = {};
  for (const f of footnotes) if (f.body) fn[f.number] = f.body;
  return { anno, fn };
}
