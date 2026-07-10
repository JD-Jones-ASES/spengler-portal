<script>
  // Hero 2 — Spengler's vocabulary as a force-directed concept graph synced with a readable lexicon.
  // Node coordinates are precomputed at build time (build-lexicon-graph.mjs) and frozen into the graph
  // JSON — the island reads them, so there is no client layout pass and no hydration mismatch. The list
  // is the graph's accessible equivalent. Typed edges (relation families styled distinctly); interlocutors
  // (the source-thinkers Spengler builds on / breaks with) are neutral "meta" diamonds outside the Culture
  // palette. v1.2: selecting a node updates the URL hash (deep-linkable, with Copy link), lists its
  // sourced relations (citations link to the source record), shows an arrowhead on its directional
  // relations, and on a phone reframes the canvas around the selection.
  import { onMount } from "svelte";
  import { GRAPH_W as W, GRAPH_H as H } from "../lib/graph-canvas.mjs";
  let { data, base = "/", cites = {} } = $props();

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

  // Node coordinates are precomputed at build time (build-lexicon-graph.mjs) and frozen into the graph
  // JSON — no client-side layout pass, no hydration mismatch. Drag mutates a reactive copy of them;
  // Reset restores the frozen coords.
  const baseLayout = () => Object.fromEntries(data.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  let positions = $state(baseLayout());
  function resetLayout() { positions = baseLayout(); }
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));

  let selected = $state(null);

  // ---- drag-to-rearrange (pointer); a tap that doesn't move is treated as a select ----
  let svgEl;
  let drag = $state(null);
  function svgCoords(e) {
    const r = svgEl.getBoundingClientRect();
    return { x: vb.x + ((e.clientX - r.left) / r.width) * vb.w, y: vb.y + ((e.clientY - r.top) / r.height) * vb.h };
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
  function pick(id) { selected = selected === id ? null : id; syncHash(); }
  const selNode = $derived(selected ? nodeById.get(selected) : null);

  // ---- direction: arrowheads on the selected node's directional relations only (overview stays clean) ----
  const SYMMETRIC = new Set(["contrasts-with", "analogous-to", "related-to"]);
  const showArrow = (e) => !!selected && isEdgeActive(e) && activeFam.has(famOf(e.type)) && !SYMMETRIC.has(e.type);
  function edgeLine(e) {
    const a = positions[e.source], b = positions[e.target];
    if (!showArrow(e)) return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    const back = nodeR(nodeById.get(e.target)) + 6; // pull the tip clear of the target node + arrowhead
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    return { x1: a.x, y1: a.y, x2: b.x - (dx / d) * back, y2: b.y - (dy / d) * back };
  }

  // ---- citable selection: URL hash <-> selected node, Copy link, deep-link on load ----
  function syncHash() {
    if (typeof location === "undefined") return;
    const h = selected ? "#" + selected : "";
    if (location.hash !== h) history.replaceState(null, "", location.pathname + location.search + h);
  }
  let copied = $state(false);
  async function copyLink() {
    if (!selected || typeof location === "undefined") return;
    const url = location.origin + location.pathname + location.search + "#" + selected;
    try { await navigator.clipboard.writeText(url); copied = true; setTimeout(() => (copied = false), 1500); } catch {}
  }

  // ---- mobile: frame the selection (selected node + its one-hop neighbours) on a narrow viewport ----
  let isMobile = $state(false);
  const vb = $derived.by(() => {
    if (!selected || !isMobile) return { x: 0, y: 0, w: W, h: H };
    const pts = [...(neighbors || new Set([selected]))].map((id) => positions[id]).filter(Boolean);
    if (!pts.length) return { x: 0, y: 0, w: W, h: H };
    let minX = Math.min(...pts.map((p) => p.x)) - 70, maxX = Math.max(...pts.map((p) => p.x)) + 70;
    let minY = Math.min(...pts.map((p) => p.y)) - 56, maxY = Math.max(...pts.map((p) => p.y)) + 56;
    minX = Math.max(0, minX); minY = Math.max(0, minY); maxX = Math.min(W, maxX); maxY = Math.min(H, maxY);
    return { x: minX, y: minY, w: Math.max(maxX - minX, 180), h: Math.max(maxY - minY, 150) };
  });

  onMount(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    isMobile = mq.matches;
    const onMq = () => (isMobile = mq.matches);
    mq.addEventListener("change", onMq);
    const fromHash = () => {
      const id = decodeURIComponent((location.hash || "").replace(/^#/, ""));
      return id && nodeById.has(id) ? id : null;
    };
    const initial = fromHash();
    if (initial) selected = initial;
    const onHash = () => { selected = fromHash(); };
    window.addEventListener("hashchange", onHash);
    return () => { mq.removeEventListener("change", onMq); window.removeEventListener("hashchange", onHash); };
  });

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
  // Searchable blob per node: term, definition, variants, German form, domain/cluster, Culture, plus the
  // terms of connected concepts and the glosses on their relations — so "Schicksal", a Culture name, or a
  // neighbouring concept all route in, not just the English headword.
  const neighbourText = (() => {
    const acc = new Map(data.nodes.map((n) => [n.id, []]));
    for (const e of data.edges) {
      const st = nodeById.get(e.source)?.term || "", tt = nodeById.get(e.target)?.term || "";
      acc.get(e.source)?.push(tt, e.gloss || "");
      acc.get(e.target)?.push(st, e.gloss || "");
    }
    return acc;
  })();
  const searchBlob = new Map(data.nodes.map((n) => [n.id, [
    n.term, n.definition, (n.variants || []).join(" "), n.german || "", n.domain || "", n.cluster || "",
    n.culture || "", ...(neighbourText.get(n.id) || []),
  ].join(" ").toLowerCase()]));
  const matchSet = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(data.nodes.filter((n) => searchBlob.get(n.id).includes(q)).map((n) => n.id));
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
      class="lex-graph" class:dragging={drag != null} class:framed={isMobile && selected != null}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="group"
      aria-label="Concept graph of Spengler's vocabulary. Drag a node to rearrange; tap to trace its links and read its sourced relations. Use the list at left for an accessible view."
      bind:this={svgEl}
      onpointermove={onSvgMove} onpointerup={endDrag} onpointerleave={endDrag} onpointercancel={endDrag}
    >
      <defs>
        <marker id="lex-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
          <path d="M0.5,0.5 L9.5,5 L0.5,9.5 z" fill="context-stroke"></path>
        </marker>
      </defs>
      {#each data.edges as e}
        {@const g = edgeLine(e)}
        <line
          class={`edge ${e.type}`}
          class:dim={!isEdgeActive(e)}
          class:off={!activeFam.has(famOf(e.type))}
          x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}
          marker-end={showArrow(e) ? "url(#lex-arrow)" : null}
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
        <div class="lex-sel-head">
          <strong class="lex-sel-term">{selNode.term}{#if selNode.kind === "interlocutor"}<span class="lex-ila-pill">interlocutor</span>{/if}</strong>
          <button class="lex-copy" type="button" onclick={copyLink} title="Copy a link to this concept">{copied ? "Copied ✓" : "Copy link"}</button>
        </div>
        <p class="lex-sel-def">{selNode.definition}</p>
        {#if selEdges.length}
          <p class="lex-rel-head">{selNode.kind === "interlocutor" ? "What Spengler takes & breaks with" : "Relations"} <span class="lex-group-n">{selEdges.length}</span></p>
          <ul class="lex-rel">
            {#each selEdges as r}
              <li class="lex-rel-item">
                <span class={`lex-rel-type fam-${r.family}`}>{r.type.replace(/-/g, " ")}</span>
                {r.out ? "→" : "←"} <strong>{r.otherTerm}</strong>{#if r.gloss}: {r.gloss}{/if}
                {#if r.cites.length}<span class="lex-rel-cite"> [{#each r.cites as cid, i}{#if i}, {/if}<a href={`${base}sources/#src-${cid}`}>{citeLabel(cid)}</a>{/each}]</span>{/if}
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
