<script>
  // Hero 1 — Spengler's "Contemporary Spiritual Epochs" made navigable. The component is a real,
  // accessible <table>; the interactivity (Culture filter, season focus, row lift) only enhances it.
  // `units` maps unit_id → { label } so a cell's passage_targets render as a deep-link into the reader.
  let { data, base = "/", units = {} } = $props();

  // Resolve a cell's passage_targets into reader deep-links { href, label }.
  function jumps(cell) {
    return (cell?.passage_targets || []).map((t) => {
      const [unit, frag] = t.split("#");
      return { href: `${base}read/${unit}/#${frag}`, label: units[unit]?.label || unit };
    });
  }

  let hidden = $state(new Set());
  let season = $state("all"); // "all" | spring | summer | autumn | winter
  let openCulture = $state(data.cultures[0]?.id); // mobile accordion
  let focusCult = $state(null); // a Culture arriving via ?cult= (e.g. from the Phase-Clock)

  // Deep-link from another hero: tables/?cult=<id> highlights that Culture's column (if this table has it).
  $effect(() => {
    const p = new URLSearchParams(location.search).get("cult");
    if (p && data.cultures.some((c) => c.id === p)) { focusCult = p; openCulture = p; }
  });

  const visibleCultures = $derived(data.cultures.filter((c) => !hidden.has(c.id)));

  function toggleCulture(id) {
    const next = new Set(hidden);
    next.has(id) ? next.delete(id) : next.add(id);
    // never hide them all
    if (next.size >= data.cultures.length) return;
    hidden = next;
  }
  function rowsForPhase(phaseId) {
    return data.rows.filter((r) => r.phase === phaseId);
  }
  function phaseColor(id) {
    return {
      spring: "magian", summer: "apollinian", autumn: "egyptian", winter: "faustian",
      "pre-cultural": "indian", early: "magian", late: "apollinian", civilization: "faustian",
    }[id] || "faustian";
  }
</script>

<div class="ct">
  <div class="ct-controls" role="group" aria-label="Table controls">
    <span class="ct-ctl-label">Cultures</span>
    {#each data.cultures as c}
      <label class="ct-toggle" data-cult={c.cult}>
        <input type="checkbox" checked={!hidden.has(c.id)} onchange={() => toggleCulture(c.id)} />
        <span class="cult-tag" data-cult={c.cult}><span class="dot"></span>{c.label}</span>
      </label>
    {/each}
    <span class="ct-ctl-label" style="margin-left:1rem;">Contemporaries</span>
    <div class="ct-seasons">
      {#each [{ id: "all", label: "All" }, ...data.phases] as s}
        <button class="facet-btn" aria-pressed={season === s.id} onclick={() => (season = s.id)}>{s.label}</button>
      {/each}
    </div>
  </div>

  <div class="ct-scroll">
    <table class="ct-table" class:contemp-on={season !== "all"}>
      <caption>{data.title}</caption>
      <thead>
        <tr>
          <th scope="col" class="ct-row-head">Epoch</th>
          {#each visibleCultures as c}
            <th scope="col" data-cult={c.cult} class:ct-focus={focusCult === c.id}>{c.label}<span class="ct-from">{c.from}</span></th>
          {/each}
        </tr>
      </thead>
      {#each data.phases as phase}
        <tbody>
          <tr>
            <th scope="colgroup" colspan={visibleCultures.length + 1} class="ct-phase-head" data-cult={phase.cult || phaseColor(phase.id)}>{phase.label}</th>
          </tr>
          {#each rowsForPhase(phase.id) as row}
            <tr class="ct-row" class:contemp-band={season === row.phase} tabindex="0">
              <th scope="row" class="ct-row-head"><span class="ct-epoch">{row.epoch}</span> {row.label}</th>
              {#each visibleCultures as c}
                {@const cell = row.cells[c.id]}
                <td class="ct-cell" data-cult={c.cult} class:ct-focus={focusCult === c.id} class:is-empty={!cell || !cell.text}>
                  {#if cell && cell.text}
                    {cell.text}
                    {#if cell.note}<span class="ct-cite" title={cell.note}>⚑ editorial note</span>{/if}
                    {#if cell.passage_targets?.length}
                      <span class="ct-jumps">
                        {#each jumps(cell) as j}
                          <a class="ct-jump" href={j.href} title={`Read this in “${j.label}”`} aria-label={`Read this in the text: ${j.label}`}>↪ {j.label}</a>
                        {/each}
                      </span>
                    {/if}
                  {:else}—{/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      {/each}
    </table>
  </div>
  <p class="ct-note">{data.caption}</p>
</div>

<!-- Mobile: one Culture at a time, read its life-cycle down the seasons -->
<div class="ct-accordion">
  {#each data.cultures as c}
    <details class="ct-acc-item" data-cult={c.cult} class:ct-focus={focusCult === c.id} open={openCulture === c.id}>
      <summary>{c.label} <span class="ct-from" style="font-weight:400">{c.from}</span></summary>
      <div class="ct-acc-body">
        {#each data.phases as phase}
          {#each rowsForPhase(phase.id) as row}
            {@const cell = row.cells[c.id]}
            <div class="ct-acc-row">
              <span class="ph">{phase.label} · {row.epoch}</span>
              <div>{cell && cell.text ? cell.text : "—"}
                {#if cell?.passage_targets?.length}
                  <span class="ct-jumps">
                    {#each jumps(cell) as j}
                      <a class="ct-jump" href={j.href} title={`Read this in “${j.label}”`}>↪ {j.label}</a>
                    {/each}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        {/each}
      </div>
    </details>
  {/each}
</div>
