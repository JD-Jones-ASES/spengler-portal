<script>
  // Hero 2 — Spengler's vocabulary as a force-directed graph synced with a readable lexicon.
  // The layout is computed deterministically (same on server and client → no hydration mismatch,
  // no animation loop draining battery). The list is the graph's accessible equivalent.
  // v1.1: edges are typed (relation families styled distinctly); interlocutors (the source-thinkers
  // Spengler builds on / breaks with) render as neutral "meta" diamonds outside the Culture palette;
  // selecting a node lists its sourced relations — for an interlocutor that is its borrow/break lineage.
  let { data, base = "/", cites = {} } = $props();
  const W = 640, H = 500;

  // ---- edge relation → visual family (kept in step with the schema $comment legend) ----
  const EDGE_FAMILY = {
    "contrasts-with": "opposition",
    "coined-from": "lineage", "borrows-from": "lineage", "breaks-with": "lineage", "narrows": "lineage",
    "analogous-to": "analogy",
    "symptom-of": "structure", "instance-of": "structure", "prime-symbol-of": "structure",
    "phase-of": "structure", "presupposes": "structure", "derives-from": "structure", "exemplified-by": "structure",
    "related-to": "generic",
  };
  const FAMILIES = [
    { key: "structure", label: "Structure" },
    { key: "opposition", label: "Opposition" },
    { key: "analogy", label: "Analogy" },
    { key: "lineage", label: "Lineage" },
    { key: "generic", label: "Related" },
  ];
  const famOf = (type) => EDGE_FAMILY[type] || "generic";
  let activeFam = $state(new Set(FAMILIES.map((f) => f.key)));
  function toggleFam(k) { const s = new Set(activeFam); s.has(k) ? s.delete(k) : s.add(k); activeFam = s; }
  const citeLabel = (id) => cites[id] || id;
  function edgeTitle(e) {
    const src = cites && (e.citations || []).concat(e.secondary || []).map(citeLabel);
    return `${e.type.replace(/-/g, " ")}${e.gloss ? " — " + e.gloss : ""}${src && src.length ? "  [" + src.join(", ") + "]" : ""}`;
  }

  // deterministic frozen force layout
  function computeLayout(nodes, edges) {
    const cx = W / 2, cy = H / 2;
    const clusters = [...new Set(nodes.map((n) => n.cluster))];
    const pos = new Map();
    nodes.forEach((n, i) => {
      const ci = clusters.indexOf(n.cluster);
      const a = (ci / clusters.length) * 2 * Math.PI;
      const ja = (i * 2.39996) % (2 * Math.PI);
      pos.set(n.id, { x: cx + 130 * Math.cos(a) + 28 * Math.cos(ja), y: cy + 130 * Math.sin(a) + 28 * Math.sin(ja) });
    });
    const links = edges.map((e) => [e.source, e.target]);
    for (let it = 0; it < 420; it++) {
      const f = new Map(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos.get(nodes[i].id), b = pos.get(nodes[j].id);
          let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 0.01, d = Math.sqrt(d2);
          const rep = 2800 / d2;
          f.get(nodes[i].id).x += (dx / d) * rep; f.get(nodes[i].id).y += (dy / d) * rep;
          f.get(nodes[j].id).x -= (dx / d) * rep; f.get(nodes[j].id).y -= (dy / d) * rep;
        }
      for (const [s, t] of links) {
        const a = pos.get(s), b = pos.get(t); if (!a || !b) continue;
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const k = (d - 95) * 0.02;
        f.get(s).x += (dx / d) * k; f.get(s).y += (dy / d) * k;
        f.get(t).x -= (dx / d) * k; f.get(t).y -= (dy / d) * k;
      }
      const cool = Math.max(0.1, 1 - it / 520);
      for (const n of nodes) {
        const p = pos.get(n.id), ff = f.get(n.id);
        p.x += (cx - p.x) * 0.006; p.y += (cy - p.y) * 0.006;
        p.x += Math.max(-9, Math.min(9, ff.x)) * cool; p.y += Math.max(-9, Math.min(9, ff.y)) * cool;
        p.x = Math.max(28, Math.min(W - 28, p.x)); p.y = Math.max(26, Math.min(H - 26, p.y));
      }
    }
    return pos;
  }

  const layoutMap = computeLayout(data.nodes, data.edges);
  const toObj = (m) => { const o = {}; for (const [k, v] of m) o[k] = { x: v.x, y: v.y }; return o; };
  let positions = $state(toObj(layoutMap)); // reactive node coords; seeded deterministically (no hydration mismatch)
  function resetLayout() { positions = toObj(layoutMap); }
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));

  let selected = $state(null);

  // ---- drag-to-rearrange (pointer); a tap that doesn't move is treated as a select ----
  let svgEl;
  let drag = $state(null);
  function svgCoords(e) {
    const r = svgEl.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  function onNodeDown(n, e) {
    e.preventDefault();
    const p = svgCoords(e);
    drag = { id: n.id, moved: false, sx: p.x, sy: p.y, dx: positions[n.id].x - p.x, dy: positions[n.id].y - p.y };
    try { svgEl.setPointerCapture(e.pointerId); } catch {}
  }
  function onSvgMove(e) {
    if (!drag) return;
    const p = svgCoords(e);
    if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 4) drag.moved = true;
    positions[drag.id] = {
      x: Math.max(28, Math.min(W - 28, p.x + drag.dx)),
      y: Math.max(26, Math.min(H - 26, p.y + drag.dy)),
    };
  }
  function endDrag(e) {
    if (!drag) return;
    const { id, moved } = drag;
    if (e && e.pointerId != null) { try { svgEl.releasePointerCapture(e.pointerId); } catch {} }
    drag = null;
    if (!moved) pick(id); // a tap, not a drag → select/toggle
  }

  const neighbors = $derived.by(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    for (const e of data.edges) { if (e.source === selected) s.add(e.target); if (e.target === selected) s.add(e.source); }
    return s;
  });
  function isEdgeActive(e) { return !selected || e.source === selected || e.target === selected; }
  function nodeR(n) { return 9 + Math.min(8, n.degree * 1.6); }
  function pick(id) { selected = selected === id ? null : id; }
  const selNode = $derived(selected ? nodeById.get(selected) : null);

  // ---- relations of the selected node (verification visible at the edge; lineage for interlocutors) ----
  const selEdges = $derived.by(() => {
    if (!selected) return [];
    return data.edges
      .filter((e) => e.source === selected || e.target === selected)
      .map((e) => {
        const out = e.source === selected;
        const other = out ? e.target : e.source;
        return {
          out, type: e.type, family: famOf(e.type),
          other, otherTerm: nodeById.get(other)?.term || other,
          gloss: e.gloss || "", cites: (e.citations || []).concat(e.secondary || []),
        };
      })
      .sort((a, b) => (a.family === "generic" ? 1 : 0) - (b.family === "generic" ? 1 : 0));
  });

  // ---- filter + collapsible clustered list (scales as the lexicon grows) ----
  let query = $state("");
  const CULTURE_IDS = new Set(["indian", "apollinian", "magian", "faustian", "egyptian", "chinese", "mexican"]);
  const CLUSTER_LABEL = {
    faustian: "The Faustian", apollinian: "The Apollinian", magian: "The Magian", indian: "The Indian",
    egyptian: "The Egyptian", chinese: "The Chinese", mexican: "The Mexican",
    "prime-concept": "Core oppositions", method: "Method", culture: "The Cultures",
    politics: "Politics & the end-time", religion: "Religion", economics: "Economics", science: "Science",
    art: "Art", mathematics: "Mathematics", phase: "Phases", interlocutor: "Interlocutors (his sources)",
  };
  function clusterLabel(k) { return CLUSTER_LABEL[k] || (k.charAt(0).toUpperCase() + k.slice(1)); }
  const matchSet = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(data.nodes.filter((n) => (n.term + " " + n.definition + " " + (n.variants || []).join(" ")).toLowerCase().includes(q)).map((n) => n.id));
  });
  const clusters = $derived.by(() => {
    const nodes = matchSet ? data.nodes.filter((n) => matchSet.has(n.id)) : data.nodes;
    const groups = new Map();
    for (const n of nodes) (groups.get(n.cluster) || groups.set(n.cluster, []).get(n.cluster)).push(n);
    return [...groups.entries()]
      .map(([k, ns]) => ({ key: k, label: clusterLabel(k), cult: CULTURE_IDS.has(k) ? k : null, nodes: ns }))
      .sort((a, b) => (a.key === "interlocutor" ? 1 : 0) - (b.key === "interlocutor" ? 1 : 0) || b.nodes.length - a.nodes.length);
  });
</script>

<div class="lex">
  <div class="lex-list" id="lex-list">
    <input class="lex-filter" type="search" placeholder="Filter terms…" bind:value={query} aria-label="Filter lexicon terms" />
    {#if clusters.length === 0}
      <p class="lex-hint">No terms match “{query}”.</p>
    {/if}
    {#each clusters as group (group.key)}
      <details class="lex-group" data-cult={group.cult || ""} open={!!query || (selected != null && group.nodes.some((n) => n.id === selected))}>
        <summary>{group.label}<span class="lex-group-n">{group.nodes.length}</span></summary>
        {#each group.nodes as n (n.id)}
          <div
            class="lex-card"
            class:interlocutor={n.kind === "interlocutor"}
            id={`term-${n.id}`}
            data-cult={n.culture || ""}
            class:active={selected === n.id}
            role="button"
            tabindex="0"
            onclick={() => pick(n.id)}
            onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(n.id); } }}
          >
            <span class="lex-term">{n.term}{#if n.german}<span class="muted" style="font-weight:400;font-size:0.8em"> · {n.german}</span>{/if}{#if n.kind === "interlocutor"}<span class="lex-ila-pill">interlocutor</span>{/if}</span>
            <p class="lex-def">{n.definition}</p>
            {#if n.targets?.length}
              <p class="lex-cite"><a href={`${base}read/${n.targets[0].split("#")[0]}/`}>Read it in the text →</a></p>
            {/if}
          </div>
        {/each}
      </details>
    {/each}
  </div>

  <div class="lex-graph-wrap">
    <div class="lex-legend" role="group" aria-label="Filter edges by relation type">
      {#each FAMILIES as f}
        <button
          type="button" class={`lex-fam fam-${f.key}`} class:off={!activeFam.has(f.key)}
          aria-pressed={activeFam.has(f.key)} onclick={() => toggleFam(f.key)}
          title={`Toggle ${f.label.toLowerCase()} edges`}
        ><span class="lex-fam-swatch"></span>{f.label}</button>
      {/each}
      <button class="lex-reset" type="button" onclick={resetLayout} title="Restore the original graph layout">Reset</button>
    </div>
    <svg
      class="lex-graph" class:dragging={drag != null}
      viewBox={`0 0 ${W} ${H}`} role="group"
      aria-label="Concept graph of Spengler's vocabulary. Drag a node to rearrange; tap to trace its links and read its sourced relations. Use the list at left for an accessible view."
      bind:this={svgEl}
      onpointermove={onSvgMove} onpointerup={endDrag} onpointerleave={endDrag} onpointercancel={endDrag}
    >
      {#each data.edges as e}
        <line
          class={`edge ${e.type}`}
          class:dim={!isEdgeActive(e)}
          class:off={!activeFam.has(famOf(e.type))}
          x1={positions[e.source].x} y1={positions[e.source].y}
          x2={positions[e.target].x} y2={positions[e.target].y}
        ><title>{edgeTitle(e)}</title></line>
      {/each}
      {#each data.nodes as n}
        <g
          class="node"
          class:selected={selected === n.id}
          class:interlocutor={n.kind === "interlocutor"}
          class:dim={(neighbors && !neighbors.has(n.id)) || (matchSet && !matchSet.has(n.id))}
          data-cult={n.culture || ""}
          transform={`translate(${positions[n.id].x},${positions[n.id].y})`}
          role="button"
          tabindex="0"
          aria-label={`${n.kind === "interlocutor" ? "Interlocutor: " : ""}${n.term}. ${n.definition.slice(0, 80)}`}
          onpointerdown={(e) => onNodeDown(n, e)}
          onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(n.id); } }}
        >
          {#if n.kind === "interlocutor"}
            {@const s = nodeR(n) * 0.92}
            <rect class="ila-mark" x={-s} y={-s} width={2 * s} height={2 * s} transform="rotate(45)" rx="1.5"></rect>
          {:else}
            <circle r={nodeR(n)} style={`fill:${n.culture ? `var(--cult-${n.culture})` : "var(--ink-faint)"}`}></circle>
          {/if}
          <text text-anchor="middle" dy={nodeR(n) + 12}>{n.term}</text>
        </g>
      {/each}
    </svg>
    {#if selNode}
      <div class="lex-sel" data-cult={selNode.culture || ""}>
        <strong class="lex-sel-term">{selNode.term}{#if selNode.kind === "interlocutor"}<span class="lex-ila-pill">interlocutor</span>{/if}</strong>
        <p class="lex-sel-def">{selNode.definition}</p>
        {#if selEdges.length}
          <p class="lex-rel-head">{selNode.kind === "interlocutor" ? "What Spengler takes & breaks with" : "Relations"} <span class="lex-group-n">{selEdges.length}</span></p>
          <ul class="lex-rel">
            {#each selEdges as r}
              <li class="lex-rel-item">
                <span class={`lex-rel-type fam-${r.family}`}>{r.type.replace(/-/g, " ")}</span>
                {r.out ? "→" : "←"} <strong>{r.otherTerm}</strong>{#if r.gloss}: {r.gloss}{/if}
                {#if r.cites.length}<span class="lex-rel-cite"> [{r.cites.map(citeLabel).join(", ")}]</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {:else}
      <p class="lex-hint" style="padding:0.6rem 1rem 0.9rem;">Tap a node — or a card — to trace how a term connects and read its sourced relations; drag to rearrange. Concept nodes carry their Culture's colour; <strong>interlocutors</strong> (Goethe, Nietzsche…) are neutral diamonds. Use the legend above to isolate a relation type.</p>
    {/if}
  </div>
</div>
