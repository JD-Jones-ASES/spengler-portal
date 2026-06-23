// reader-ui.js — the reader's interactivity, framework-free. Routes every hovered/focused annotation
// or footnote mark into ONE fixed margin-card; drives the progress bar, focus mode, typography, and
// the scroll-spied topic spine. State persists in localStorage under sp-*.

export function initReader() {
  const data = readJson("reader-data");
  if (!data) return;
  const card = document.getElementById("margin-note");
  const cardBody = document.getElementById("mn-body");
  const cardKind = document.getElementById("mn-kind");

  const kindLabels = {
    "lexicon-term": "Term", "historical-reference": "Reference", "cross-culture-parallel": "Parallel",
    "translation-note": "Translation", "form-observation": "Close reading", "scholarly-reception": "Scholarly reception",
    "difficult-material": "Context", "teacher-note": "For new readers", footnote: "Translator's note",
  };

  function showAnno(id) {
    const a = data.anno[id];
    if (!a || !card) return;
    card.dataset.cult = a.cultures?.[0] || "";
    card.classList.toggle("is-interpretation", !!a.interpretation);
    cardKind.textContent = kindLabels[a.kind] || a.kind;
    let html = "";
    if (a.interpretation && a.attribution) {
      html += `<span class="view-flag">A reading attributed to ${esc(a.attribution.scholar)}${a.attribution.year ? ` (${a.attribution.year})` : ""} — not a settled fact</span>`;
    } else if (a.interpretation) {
      html += `<span class="view-flag">An interpretation, not a settled fact</span>`;
    }
    html += `<span class="anchor-q">${esc(a.anchor)}</span>`;
    html += `<p class="body">${esc(a.note)}</p>`;
    if (a.see_also?.length) {
      html += `<p class="cite">See also: ${a.see_also.map((s) => `<a href="${base("lexicon/")}#term-${s.id}">${esc(s.term)}</a>`).join(", ")}</p>`;
    }
    if (a.cites?.length) {
      html += `<p class="cite">Source: ${a.cites.map((c) => (c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a>` : esc(c.title))).join(" · ")}</p>`;
    }
    cardBody.innerHTML = html;
    card.hidden = false;
    setActive(`[data-anno="${id}"]`);
  }

  function showFn(n) {
    const body = data.fn[n];
    if (!card) return;
    card.dataset.cult = "";
    card.classList.remove("is-interpretation");
    cardKind.textContent = `${kindLabels.footnote} ${n}`;
    cardBody.innerHTML = body ? `<p class="body">${esc(body)}</p>` : `<p class="body muted">(note ${n})</p>`;
    card.hidden = false;
    setActive(`[data-fn="${n}"]`);
  }

  function setActive(sel) {
    document.querySelectorAll(".anno-mark.active, .fn-mark.active").forEach((el) => el.classList.remove("active"));
    document.querySelectorAll(sel).forEach((el) => el.classList.add("active"));
  }

  const prose = document.querySelector(".prose");
  if (prose) {
    const handler = (e) => {
      const am = e.target.closest(".anno-mark");
      const fm = e.target.closest(".fn-mark");
      if (am) showAnno(am.dataset.anno);
      else if (fm) showFn(fm.dataset.fn);
    };
    prose.addEventListener("mouseover", handler);
    prose.addEventListener("focusin", handler);
    prose.addEventListener("click", (e) => {
      if (e.target.closest(".anno-mark, .fn-mark")) { e.preventDefault(); handler(e); }
    });
    prose.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.closest(".anno-mark, .fn-mark")) { e.preventDefault(); handler(e); }
    });
  }
  document.getElementById("mn-close")?.addEventListener("click", () => { if (card) card.hidden = true; });

  // ---- reading progress ----
  const bar = document.getElementById("progress-bar");
  if (bar) {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, h.scrollTop / max) : 0})`;
    };
    document.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---- focus mode ----
  const focusBtn = document.getElementById("focus-toggle");
  if (focusBtn) {
    const root = document.documentElement;
    const sync = () => focusBtn.setAttribute("aria-pressed", String(root.dataset.focus === "on"));
    sync();
    focusBtn.addEventListener("click", () => {
      root.dataset.focus = root.dataset.focus === "on" ? "off" : "on";
      try { localStorage.setItem("sp-focus", root.dataset.focus); } catch {}
      sync();
    });
  }

  // ---- typography (size) ----
  document.querySelectorAll("[data-typo-size]").forEach((b) => {
    b.addEventListener("click", () => {
      const size = b.dataset.typoSize;
      document.documentElement.style.setProperty("--reader-size", size);
      try {
        const t = JSON.parse(localStorage.getItem("sp-typo") || "{}");
        t.size = size; localStorage.setItem("sp-typo", JSON.stringify(t));
      } catch {}
      document.querySelectorAll("[data-typo-size]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    });
  });

  // ---- cite / share ----
  const copyHelper = async (text, btn, okLabel) => {
    const prev = btn.textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      ta.remove();
    }
    btn.textContent = okLabel; btn.classList.add("copied");
    setTimeout(() => { btn.textContent = prev; btn.classList.remove("copied"); }, 1600);
  };

  const cite = readJson("cite-data");
  const citeText = document.getElementById("cite-text");
  if (cite && citeText) {
    const url = location.href.split("#")[0];
    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    let s = `${cite.author}, “${cite.chapter},” in ${cite.work}`;
    if (cite.volume) s += `, ${cite.volume}`;
    s += `, ${cite.translator}. The Spengler Portal, ${url} (accessed ${date}).`;
    citeText.value = s;
    document.getElementById("copy-cite")?.addEventListener("click", (e) => copyHelper(s, e.currentTarget, "Copied!"));
  }
  document.getElementById("copy-link")?.addEventListener("click", (e) => copyHelper(location.href.split("#")[0], e.currentTarget, "Link copied!"));

  // ---- back to top ----
  const toTop = document.getElementById("back-to-top");
  if (toTop) {
    const onScrollTop = () => { toTop.hidden = window.scrollY < 600; };
    document.addEventListener("scroll", onScrollTop, { passive: true });
    onScrollTop();
    toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  // ---- topic-spine scroll-spy ----
  const spine = document.querySelectorAll(".topic-list a[data-para]");
  if (spine.length) {
    const paras = [...spine].map((a) => ({ a, el: document.getElementById("p" + a.dataset.para) })).filter((x) => x.el);
    const spy = () => {
      const y = window.scrollY + 120;
      let active = paras[0];
      for (const p of paras) if (p.el.offsetTop <= y) active = p;
      spine.forEach((a) => a.classList.toggle("spine-active", a === active?.a));
    };
    document.addEventListener("scroll", spy, { passive: true });
    spy();
  }
}

function readJson(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch { return null; }
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function base(p) {
  const b = document.documentElement.dataset.base || "/";
  return (b.endsWith("/") ? b : b + "/") + String(p).replace(/^\/+/, "");
}
