<script>
  // Hero 3 — the phase-clock as a morphological time-spine. Each Culture's life is normalized to its own
  // span [birth → Civilization-end], so births align at the left and reading DOWN any vertical line shows
  // the stages Spengler calls "contemporary". A frozen, deterministic SVG (no animation); the readout line
  // and the focusable bands are the accessible equivalent of the hover guide.
  let { data, base = "/" } = $props();

  const cultures = data.cultures;
  const W = 720, PADL = 138, PADR = 20, PADT = 40, ROW_H = 44, GAP = 16, PRE_W = 26, AXIS_H = 26;
  const NOW_H = 24; // extra bottom room so the "We are here" marker sits below the last (Western) row
  const plotX = PADL + PRE_W;
  const plotW = W - plotX - PADR;
  const H = PADT + cultures.length * (ROW_H + GAP) + AXIS_H + NOW_H;
  const lastBoundaries = [0, 0.25, 0.5, 0.75, 1]; // faint reference grid for the eye

  const fmtYear = (y) => (y < 0 ? `${-y} BC` : `${y} AD`);
  const phaseOpacity = { "pre-cultural": 16, early: 42, late: 64, civilization: 84 };

  // normalize a calendar year to a pixel x within a Culture's [birth, span_end]
  function frac(c, year) { return (year - c.birth) / (c.span_end - c.birth); }
  function xOf(c, year) { return plotX + Math.max(0, Math.min(1, frac(c, year))) * plotW; }
  const rowY = (i) => PADT + i * (ROW_H + GAP);

  // which non-pre-cultural phase a Culture is in at a given morphological fraction (0..1 of its life)
  function phaseAt(c, f) {
    const yr = c.birth + f * (c.span_end - c.birth);
    const main = c.phases.filter((p) => p.id !== "pre-cultural");
    for (const p of main) if (yr >= p.from && yr <= p.to) return { ...p, yr };
    return { ...(yr < main[0].from ? main[0] : main[main.length - 1]), yr };
  }

  let hover = $state(null);     // a focused/hovered band {cult, phase}
  let guideF = $state(null);    // morphological fraction under the cursor (0..1)

  const nowC = $derived(cultures.find((c) => c.id === data.now?.culture));
  const nowF = $derived(nowC ? Math.max(0, Math.min(1, frac(nowC, data.now.year))) : null);

  const readout = $derived.by(() => {
    if (hover) {
      const c = cultures.find((x) => x.id === hover.cult);
      const p = c.phases.find((x) => x.id === hover.phase);
      return { kind: "band", html: `<strong>${c.label}</strong> · ${p.label}${p.style ? ` — ${p.style}` : ""} · ${fmtYear(p.from)}–${fmtYear(p.to)}` };
    }
    if (guideF != null) {
      const pct = Math.round(guideF * 100);
      const parts = cultures.map((c) => { const p = phaseAt(c, guideF); return `${c.label}: <em>${p.label.replace(/ \(.*/, "")}</em>`; });
      return { kind: "guide", html: `<strong>${pct}% through the life-cycle</strong> — contemporaries: ${parts.join(" · ")}` };
    }
    return { kind: "hint", html: "Hover a band for its dates, or sweep across to read the “contemporaries” down any vertical line." };
  });

  function onMove(e) {
    const svg = e.currentTarget;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    guideF = px >= plotX && px <= plotX + plotW ? (px - plotX) / plotW : null;
  }
</script>

<div class="pt">
  <svg
    class="pt-svg" viewBox={`0 0 ${W} ${H}`} role="img"
    aria-label="A morphological time-spine of Spengler's high Cultures. Each Culture's life is normalized to its own span; reading down a vertical line shows contemporary stages. The Western Culture is in its Civilization-winter."
    onmousemove={onMove} onmouseleave={() => (guideF = null)}
  >
    <!-- faint reference grid -->
    {#each lastBoundaries as b}
      <line class="pt-grid" x1={plotX + b * plotW} y1={PADT - 8} x2={plotX + b * plotW} y2={H - AXIS_H} />
    {/each}

    <!-- vertical hover guide -->
    {#if guideF != null}
      <line class="pt-guide" x1={plotX + guideF * plotW} y1={PADT - 10} x2={plotX + guideF * plotW} y2={H - AXIS_H} />
    {/if}

    {#each cultures as c, i}
      {@const y = rowY(i)}
      <!-- culture label → its column in the Comparative Tables -->
      <a class="pt-cult-link" href={`${base}tables/?cult=${c.id}`} aria-label={`See ${c.label} in the Comparative Tables`}>
        <text class="pt-cult-label" x={PADL - 12} y={y + ROW_H / 2} text-anchor="end" data-cult={c.cult}>{c.label}</text>
      </a>
      <circle cx={PADL - 4} cy={y + ROW_H / 2} r="3.5" style={`fill:var(--cult-${c.cult})`} />

      <!-- pre-cultural lead-in stub (before birth) -->
      {#each c.phases.filter((p) => p.id === "pre-cultural") as p}
        <rect class="pt-pre" x={PADL} y={y + 7} width={PRE_W} height={ROW_H - 14} rx="2"
          style={`fill:color-mix(in srgb, var(--cult-${c.cult}) 14%, var(--paper-raised))`}>
          <title>{c.label} · {p.label} ({p.style}) · {fmtYear(p.from)}–{fmtYear(p.to)}</title>
        </rect>
      {/each}

      <!-- the Culture proper: early / late / civilization -->
      {#each c.phases.filter((p) => p.id !== "pre-cultural") as p}
        {@const x0 = xOf(c, p.from)}
        {@const x1 = xOf(c, p.to)}
        <g
          class="pt-band" class:is-civ={p.id === "civilization"}
          class:dim={hover && !(hover.cult === c.id && hover.phase === p.id)}
          role="button" tabindex="0"
          aria-label={`${c.label}, ${p.label}, ${p.style}, ${fmtYear(p.from)} to ${fmtYear(p.to)}`}
          onmouseenter={() => (hover = { cult: c.id, phase: p.id })}
          onmouseleave={() => (hover = null)}
          onfocus={() => (hover = { cult: c.id, phase: p.id })}
          onblur={() => (hover = null)}
        >
          <rect x={x0} y={y + 6} width={Math.max(1, x1 - x0)} height={ROW_H - 12} rx="2.5"
            style={`fill:color-mix(in srgb, var(--cult-${c.cult}) ${phaseOpacity[p.id]}%, var(--paper-raised))`} />
          {#if x1 - x0 > 46}
            <text class="pt-style" x={(x0 + x1) / 2} y={y + ROW_H / 2 + 4} text-anchor="middle">{p.style}</text>
          {/if}
          <title>{c.label} · {p.label} · {p.style} · {fmtYear(p.from)}–{fmtYear(p.to)}</title>
        </g>
      {/each}

      <!-- birth tick -->
      <line class="pt-birth" x1={plotX} y1={y + 3} x2={plotX} y2={y + ROW_H - 3} />

      <!-- "now" marker on the Culture that carries it — bar through the row, label below it -->
      {#if c.id === data.now?.culture && nowF != null}
        {@const nx = plotX + nowF * plotW}
        {@const nowText = `${data.now.label} · ${data.now.year}`}
        {@const nowW = nowText.length * 6.5 + 24}
        {@const nlx = Math.min(plotX + plotW - nowW / 2, Math.max(plotX + nowW / 2, nx))}
        {@const labelY = y + ROW_H + 17}
        <circle class="pt-now-dot" cx={nx} cy={y + 4} r="3" />
        <line class="pt-now" x1={nx} y1={y + 4} x2={nx} y2={y + ROW_H + 9} />
        <rect class="pt-now-flag" x={nlx - nowW / 2} y={labelY - 13} width={nowW} height="19" rx="9.5" />
        <text class="pt-now-label" x={nlx} y={labelY} text-anchor="middle">{nowText}</text>
      {/if}
    {/each}

    <!-- axis -->
    <text class="pt-axis" x={plotX} y={H - 8} text-anchor="start">↑ birth</text>
    <text class="pt-axis" x={plotX + plotW} y={H - 8} text-anchor="end">Civilization · the end →</text>
    <text class="pt-axis pt-axis-mid" x={plotX + plotW / 2} y={H - 8} text-anchor="middle">morphological age →</text>
  </svg>

  <p class="pt-readout" aria-live="polite">{@html readout.html}</p>

  <!-- accessible / no-hover fallback: the same data as a list -->
  <details class="pt-table">
    <summary>The phases as a table</summary>
    <ul>
      {#each cultures as c}
        <li><span class="cult-tag" data-cult={c.cult}><span class="dot"></span>{c.label}</span>
          {c.phases.map((p) => `${p.style} (${fmtYear(p.from)}–${fmtYear(p.to)})`).join(" · ")}</li>
      {/each}
    </ul>
  </details>
</div>
