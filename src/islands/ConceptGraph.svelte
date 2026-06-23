<script>
  // Hero 2 — Spengler's vocabulary as a force-directed graph synced with a readable lexicon.
  // The layout is computed deterministically (same on server and client → no hydration mismatch,
  // no animation loop draining battery). The list is the graph's accessible equivalent.
  let { data, base = "/" } = $props();
  const W = 640, H = 500;

  const cultureHue = { indian: "indian", apollinian: "apollinian", magian: "magian", faustian: "faustian", egyptian: "egyptian", chinese: "chinese", mexican: "mexican" };

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

  const pos = computeLayout(data.nodes, data.edges);
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));

  let selected = $state(null);

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

  // ---- filter + collapsible clustered list (scales as the lexicon grows) ----
  let query = $state("");
  const CULTURE_IDS = new Set(["indian", "apollinian", "magian", "faustian", "egyptian", "chinese", "mexican"]);
  const CLUSTER_LABEL = {
    faustian: "The Faustian", apollinian: "The Apollinian", magian: "The Magian", indian: "The Indian",
    egyptian: "The Egyptian", chinese: "The Chinese", mexican: "The Mexican",
    "prime-concept": "Core oppositions", method: "Method", culture: "The Cultures",
    politics: "Politics & the end-time", religion: "Religion", economics: "Economics", science: "Science",
    art: "Art", mathematics: "Mathematics", phase: "Phases",
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
      .sort((a, b) => b.nodes.length - a.nodes.length);
  });
</script>

<div class="lex">
  <div class="lex-list" id="lex-list">
    <input class="lex-filter" type="search" placeholder="Filter terms…" bind:value={query} aria-label="Filter lexicon terms" />
    {#if clusters.length === 0}
      <p class="lex-hint">No terms match “{query}”.</p>
    {/if}
    {#each clusters as group (group.key)}
      <details class="lex-group" data-cult={group.cult || ""} open>
        <summary>{group.label}<span class="lex-group-n">{group.nodes.length}</span></summary>
        {#each group.nodes as n (n.id)}
          <div
            class="lex-card"
            id={`term-${n.id}`}
            data-cult={n.culture || ""}
            class:active={selected === n.id}
            role="button"
            tabindex="0"
            onclick={() => pick(n.id)}
            onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(n.id); } }}
          >
            <span class="lex-term">{n.term}{#if n.german}<span class="muted" style="font-weight:400;font-size:0.8em"> · {n.german}</span>{/if}</span>
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
    <svg class="lex-graph" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Concept graph of Spengler's vocabulary. Use the list at left for an accessible view.">
      {#each data.edges as e}
        <line
          class={`edge ${e.type} ${isEdgeActive(e) ? "" : "dim"}`}
          x1={pos.get(e.source).x} y1={pos.get(e.source).y}
          x2={pos.get(e.target).x} y2={pos.get(e.target).y}
        />
      {/each}
      {#each data.nodes as n}
        <g
          class="node"
          class:selected={selected === n.id}
          class:dim={(neighbors && !neighbors.has(n.id)) || (matchSet && !matchSet.has(n.id))}
          data-cult={n.culture || ""}
          transform={`translate(${pos.get(n.id).x},${pos.get(n.id).y})`}
          role="button"
          tabindex="0"
          aria-label={`${n.term}. ${n.definition.slice(0, 80)}`}
          onclick={() => pick(n.id)}
          onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(n.id); } }}
        >
          <circle r={nodeR(n)} style={`fill:${n.culture ? `var(--cult-${n.culture})` : "var(--ink-faint)"}`}></circle>
          <text text-anchor="middle" dy={nodeR(n) + 12}>{n.term}</text>
        </g>
      {/each}
    </svg>
    {#if selNode}
      <div style="padding:0.8rem 1rem;border-top:1px solid var(--line);" data-cult={selNode.culture || ""}>
        <strong style="font-family:var(--font-display)">{selNode.term}</strong>
        <p style="margin:0.3rem 0 0;font-size:0.9rem;color:var(--ink-soft);line-height:1.5">{selNode.definition}</p>
      </div>
    {:else}
      <p class="lex-hint" style="padding:0.6rem 1rem 0.9rem;">Tap a node — or a card — to trace how a term connects. Nodes are coloured by Culture; dashed lines mark oppositions.</p>
    {/if}
  </div>
</div>
