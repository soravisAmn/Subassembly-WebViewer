// Page side of the MCP tools (round 6): a WebSocket to SA.Web; each message is one tool call.
// Read-only tools here. Results are in English because Claude reads them. Output stays small by default.
"use strict";
const Mcp = (() => {
  let ws = null;
  const f3 = x => (Math.round(x * 1000) / 1000).toFixed(3);

  // ---------- which subassembly ----------
  function findItem(ref){
    const items = allItems().concat(Proposals.pending().filter(p => p.item).map(p => p.item));
    if (ref){
      const hit = items.filter(it => [it.id, itemLabel(it), it.name, it.file, it.fileName, it.spec && it.spec.className].includes(ref));
      if (hit.length === 1) return hit[0];
      if (hit.length > 1) throw new Error(`"${ref}" matches several subassemblies: ${hit.map(it => it.id).join(", ")}. Use the id.`);
      throw new Error(`No subassembly "${ref}". Use sa_status to list them.`);
    }
    const cur = editItem() || selItem();
    if (cur) return cur;
    if (items.length === 1) return items[0];
    const fresh = Proposals.pending().filter(p => p.item);
    if (fresh.length === 1) return fresh[0].item;
    throw new Error("Nothing is selected. Pass item (see sa_status).");
  }
  // A project item may hold only a file name: read the spec without changing the workspace
  async function specOf(it){
    if (it.spec) return it.spec;
    if (it.file){
      const r = await fetch("/api/drawing/spec?file=" + encodeURIComponent(it.file)).then(x => x.json()).catch(() => null);
      if (r && r.ok && r.spec) return Spec.normalize(r.spec, []);
    }
    throw new Error(`${itemLabel(it)} has no drawn part (hand-written code only).`);
  }
  // Read tools see the pending proposal unless view is "real"
  async function viewOf(it, a){
    const p = Proposals.pendingFor(it.id);
    if (p && a.view !== "real") return { sp: p.spec, note: ` (proposal ${p.id}, not accepted yet)`, p };
    return { sp: await specOf(it), note: "", p: null };
  }
  const ctxOf = it => ({ ...specCtx(it, itemOrigin(it)), values: { ...(it.params || {}) }, codeParams: codeParamsOf(it) });

  // ---------- scenarios ----------
  // Saved ones as they are, plus a generated set around the shape, Right and Left
  function scenarioList(it, sp){
    const base = ctxOf(it), out = [];
    const side = (sp.side && sp.side.param) || "Side";
    const pts = Object.values(Spec.evaluate(sp, { ...base, surface: null, layout: true }).pts).filter(q => q && !q.err);
    if (!pts.length) pts.push({ x: 0, y: 0 });
    const ys = pts.map(q => q.y), yMin = Math.min(...ys), yMax = Math.max(...ys), R = Math.max(...pts.map(q => Math.abs(q.x))) + 30;
    const gen = [
      ["high", [[-R, yMax + 3], [R, yMax + 3]]], ["low", [[-R, yMin - 3], [R, yMin - 3]]], ["mid", [[-R, (yMin + yMax) / 2], [R, (yMin + yMax) / 2]]],
      ["rising", [[-R, yMin - 3], [R, yMax + 3]]], ["falling", [[-R, yMax + 3], [R, yMin - 3]]], ["V", [[-R, yMax + 3], [0, yMin - 3], [R, yMax + 3]]]
    ];
    for (const [sd, name] of [[0, "Right"], [1, "Left"]]){
      const values = { ...base.values, [side]: sd };
      for (const [g, line] of gen) out.push({ name: `${g} ${name}`, ctx: { ...base, values, layout: false, extendEnds: true, surface: line.map(([x, y]) => ({ x, y })) } });
      out.push({ name: `layout ${name}`, ctx: { ...base, values, layout: true, surface: null } });
      out.push({ name: `no target ${name}`, ctx: { ...base, values, layout: false, surface: null } });
    }
    const prop = Proposals.pendingFor(it.id);
    if (prop) for (const c of prop.scenarios) out.push({ name: `proposed: ${c.name}`, ctx: { ...base, values: { ...base.values, ...(c.values || {}) }, layout: !!c.layout, extendEnds: true, surface: c.ground || null } });
    for (const s of scenarios){
      const ws_ = s.ws || s.asm; if (!ws_) continue;
      const si = (ws_.assemblies ? ws_.assemblies.flatMap(a => a.items || []) : (ws_.items || [])).find(x => x.id === it.id);
      if (!si) continue;
      const o = !hasCode(it) && si.attach && si.attach.x != null ? { x: si.attach.x, y: si.attach.y } : itemOrigin(it), sf = ws_.surface || [];
      out.push({ name: `saved: ${s.name}`, ctx: { ...base, values: si.params || {}, layout: !!ws_.layout, extendEnds: ws_.extendEnds !== false,
                 surface: ws_.surfaceOn !== false && sf.length >= 2 ? sf.map(p => ({ x: p.x - o.x, y: p.y - o.y })) : null } });
    }
    return out;
  }
  function renderCtx(it, sp, sc){
    if (!sc) return ctxOf(it);
    if (typeof sc === "string"){
      const hit = scenarioList(it, sp).find(s => s.name === sc);
      if (!hit) throw new Error(`No scenario "${sc}". Names: ${scenarioList(it, sp).map(s => s.name).join(", ")}.`);
      return hit.ctx;
    }
    const base = ctxOf(it);
    return { ...base, values: { ...base.values, ...(sc.values || {}) }, layout: !!sc.layout, surface: sc.ground || null };
  }

  // ---------- sa_render ----------
  function niceStep(span){ const s = span / 8, p = Math.pow(10, Math.floor(Math.log10(s))); return [1, 2, 5, 10].map(k => k * p).find(v => v >= s); }
  const xml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  function drawSvg(sp, r, surface, labels, W, H){
    const pts = sp.points.map(p => r.pts[p.id]).filter(q => q && !q.err);
    const paths = sp.links.map(l => r.links[l.id]).filter(q => q && !q.err && q.path).flatMap(q => q.path);
    const all = pts.concat(paths); if (!all.length) all.push({ x: 0, y: 0 });
    let x0 = Math.min(...all.map(q => q.x)), x1 = Math.max(...all.map(q => q.x)), y0 = Math.min(...all.map(q => q.y)), y1 = Math.max(...all.map(q => q.y));
    const pad = Math.max(x1 - x0, y1 - y0, 1) * 0.08; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const m = 46, k = Math.min((W - 2 * m) / (x1 - x0), (H - 2 * m) / (y1 - y0));
    const X = x => m + (x - x0) * k, Y = y => H - m - (y - y0) * k;
    const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`];
    const step = niceStep(Math.max(x1 - x0, y1 - y0));
    for (let v = Math.ceil(x0 / step) * step; v <= x1; v += step) o.push(`<line x1="${X(v)}" x2="${X(v)}" y1="${m / 2}" y2="${H - m}" stroke="#eee"/><text x="${X(v)}" y="${H - m + 14}" font-size="11" text-anchor="middle" fill="#666">${+v.toFixed(6)}</text>`);
    for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) o.push(`<line x1="${m}" x2="${W - m / 2}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eee"/><text x="${m - 5}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="#666">${+v.toFixed(6)}</text>`);
    if (surface && surface.length >= 2){
      const line = [{ x: Math.min(x0, surface[0].x), y: surface[0].y }, ...surface, { x: Math.max(x1, surface[surface.length - 1].x), y: surface[surface.length - 1].y }];
      o.push(`<clipPath id="c"><rect x="${m}" y="${m / 2}" width="${W - 1.5 * m}" height="${H - 1.5 * m}"/></clipPath><polyline clip-path="url(#c)" points="${line.map(p => X(p.x) + "," + Y(p.y)).join(" ")}" fill="none" stroke="#8a5a2b" stroke-width="2"/>`);
    }
    for (const s of sp.shapes){ const q = r.shapes[s.id]; if (q && q.poly) o.push(`<polygon points="${q.poly.map(p => X(p.x) + "," + Y(p.y)).join(" ")}" fill="#cfe3f7" stroke="none"/>`); }
    for (const l of sp.links){
      const q = r.links[l.id]; if (!q || q.err || !q.path) continue;
      const aux = Spec.isAux(l);
      o.push(`<polyline points="${q.path.map(p => X(p.x) + "," + Y(p.y)).join(" ")}" fill="none" stroke="${aux ? "#999" : "#1b3a5c"}" stroke-width="${aux ? 1 : 2}"${aux ? ' stroke-dasharray="5 4"' : ""}/>`);
      if (labels === "all"){ const a = q.path[q.path.length >> 1], b = q.path[(q.path.length >> 1) - 1] || a; o.push(`<text x="${X((a.x + b.x) / 2) + 3}" y="${Y((a.y + b.y) / 2) - 3}" font-size="11" fill="#b5451b">${xml(l.id)}</text>`); }
    }
    for (const p of sp.points){
      const q = r.pts[p.id]; if (!q || q.err) continue;
      o.push(`<rect x="${X(q.x) - 2.5}" y="${Y(q.y) - 2.5}" width="5" height="5" fill="${Spec.isAux(p) ? "#fff" : "#1b3a5c"}" stroke="#1b3a5c"/>`);
      if (labels !== "none") o.push(`<text x="${X(q.x) + 5}" y="${Y(q.y) + 13}" font-size="11" fill="#14532d">${xml(p.id)}</text>`);
    }
    o.push(`<text x="${m}" y="16" font-size="12" fill="#333">${xml(sp.className)} · width ${f3(x1 - x0 - 2 * pad)} m · height ${f3(y1 - y0 - 2 * pad)} m · grid ${step} m</text></svg>`);
    return o.join("");
  }
  function svgToPng(svg, W, H){
    return new Promise((ok, bad) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").drawImage(img, 0, 0); ok(c.toDataURL("image/png").split(",")[1]); };
      img.onerror = () => bad(new Error("Could not draw the image."));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }

  // ---------- compile ----------
  async function generated(it, sp){
    const r = await fetch("/api/drawing/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec: sp, fileName: it.fileName || sp.className + ".cs" }) }).then(x => x.json());
    if (!r.ok) throw new Error(r.message || "Could not generate the code.");
    return r.source;
  }
  async function compileErrors(it, sp){
    const source = await generated(it, sp);
    const r = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, sourceName: it.fileName || sp.className + ".cs", params: {} }) }).then(x => x.json());
    if (r.ok || r.stage !== "compile") return r.ok ? [] : [r.message || r.stage];
    return (r.diagnostics || []).filter(d => /error/i.test(d.severity)).slice(0, 10).map(d => `line ${d.line}: ${d.message}`);
  }

  // ---------- tools ----------
  const TOOLS = {
    async sa_status(a, msg){
      const pend = Proposals.pending();
      const lines = [`Web page open. Tabs: ${msg.tabs}${msg.tabs > 1 ? " (using the most recently active one)" : ""}. Pending proposals: ${pend.length ? pend.map(p => `${p.id} on ${itemLabel(aiOf(p))}`).join(", ") : 0}.`];
      for (const asm of asms()){
        lines.push(`Assembly ${asm.name}:`);
        for (const it of asm.items){
          const s = it.spec, tags = [state.editing === it.id ? "editing" : "", selItemId() === it.id ? "selected" : ""].filter(Boolean).join(", ");
          lines.push(`  ${it.id} "${itemLabel(it)}"${it.file ? ` file ${it.file}` : ""}${s ? ` class ${s.className}, ${s.points.length} points, ${s.links.length} links, ${s.shapes.length} shapes` : " code only"}${tags ? ` [${tags}]` : ""}`);
        }
      }
      return { text: lines.join("\n") };
    },
    async sa_describe(a){
      const it = findItem(a.item), { sp, note } = await viewOf(it, a), r = Spec.evaluate(sp, ctxOf(it));
      return { text: (note ? `Showing${note}.\n` : "") + JSON.stringify(Logic.describe(sp, r)) + "\n\n" + Logic.toText(sp, r) };
    },
    async sa_get_spec(a){ return { text: JSON.stringify((await viewOf(findItem(a.item), a)).sp) }; },
    async sa_catalog(){ return { text: JSON.stringify(Logic.catalog()) }; },
    async sa_render(a){
      const it = findItem(a.item), { sp, note } = await viewOf(it, a), c = renderCtx(it, sp, a.scenario);
      const W = Math.min(Math.max(a.width || 900, 200), 1600), H = Math.min(Math.max(a.height || 500, 150), 1200);
      const image = await svgToPng(drawSvg(sp, Spec.evaluate(sp, c), c.surface, a.labels || "points", W, H), W, H);
      return { text: `${itemLabel(it)}${note}, ${W} x ${H} px.`, image };
    },
    async sa_code_preview(a){
      const it = findItem(a.item);
      const lines = (await generated(it, (await viewOf(it, a)).sp)).split(/\r?\n/).filter(l => !/^\s*\/\/ sa-spec/.test(l));
      if (a.detail === "full") return { text: lines.join("\n") };
      // Default: only the drawing method. The helpers below it are the same in every generated file.
      const from = lines.findIndex(l => /internal static void Draw\(/.test(l));
      const to = lines.findIndex((l, i) => i > from && /^\s*private static /.test(l));
      if (from < 0 || to < 0) return { text: lines.join("\n") };
      return { text: lines.slice(from, to).join("\n") + `\n// (${lines.length - (to - from)} more lines; detail: "full" shows the whole file)` };
    },
    async sa_check(a){
      const it = findItem(a.item), { sp, note } = await viewOf(it, a), list = scenarioList(it, sp), full = a.detail === "full";
      const errs = await compileErrors(it, sp), lines = [`${itemLabel(it)}${note}. Compile: ${errs.length ? "FAILED" : "OK"}.`, ...errs.map(e => "  " + e)];
      const entered = new Set(), loops = {}, msgs = new Map(), onBoundary = new Map(), gaps = new Map();
      for (const s of list){
        const r = Spec.evaluate(sp, s.ctx), env = Boundary.lowerEnvelope(sp, r);
        for (const [b, on] of Object.entries(r.logic.branches)) if (on) entered.add(b);
        for (const [id, n] of Object.entries(r.logic.loops || {})) (loops[id] = loops[id] || new Set()).add(n);
        for (const i of r.issues) if (i.level !== "i") msgs.set(i.msg, (msgs.get(i.msg) || 0) + 1);
        for (const st of env.stretches) onBoundary.set(st.link, st.codes);
        if (full) lines.push(`${s.name}: ` + env.stretches.map(st => `${f3(st.from)}..${f3(st.to)} ${st.link} [${st.codes.join(",")}]`).join("; "));
        if (a.code){
          const miss = Boundary.missing(env, a.code);
          if (miss.length){ const k = miss.map(st => `${f3(st.from)}..${f3(st.to)} ${st.link} [${st.codes.join(",")}]`).join("; "); gaps.set(k, (gaps.get(k) || []).concat(s.name)); }
        }
      }
      lines.push(`Scenarios run: ${list.length}.`);
      const brs = ((sp.logic || {}).branches || []).filter(b => !entered.has(b.id));
      if (((sp.logic || {}).branches || []).length) lines.push(brs.length ? `Branches never entered: ${brs.map(b => `${b.id} ${b.label || ""}`).join(", ")}.` : "Every branch was entered.");
      for (const [id, ns] of Object.entries(loops)) lines.push(`Loop ${id}: N seen ${[...ns].sort((x, y) => x - y).join(", ")}.`);
      if (msgs.size) lines.push("Messages:", ...[...msgs].slice(0, full ? 100 : 12).map(([m, n]) => `  ${m} (${n} scenarios)`));
      lines.push("Bottom boundary links: " + [...onBoundary].map(([l, c]) => `${l} [${c.join(",")}]`).join(", ") + ".");
      const nGap = [...gaps.values()].reduce((n, v) => n + v.length, 0);
      if (a.code) lines.push(nGap ? `Missing ${a.code} in ${nGap} of ${list.length} scenarios (offset from..to, link, codes):` : `${a.code} covers the whole bottom boundary in every scenario.`, ...[...gaps].map(([k, v]) => `  ${v.join(", ")}: ${k}`));
      return { text: lines.join("\n") };
    }
  };

  // ---------- proposal tools ----------
  const aiOf = p => p.item || itemById(p.itemId);
  function cancelledNotice(itemId){
    const c = Proposals.takeCancelled(itemId);
    return c ? `Proposal ${c.id} was cancelled (${c.why}). Read the subassembly again with sa_describe, then propose again.` : null;
  }
  function changed(p){ aiFocus(); renderAll(); return p; }
  function report(p, r){
    const named = r.results.filter(x => x.as).map(x => `${x.as}=${typeof x.result === "string" ? x.result : JSON.stringify(x.result)}`);
    return [`Proposal ${p.id} on ${itemLabel(aiOf(p))}: ${Proposals.opCount(p)} ops so far. Nothing is applied until the user accepts in the AI tab; the user saves the file.`,
            ...(named.length ? ["Results: " + named.join(", ")] : []),
            ...(r.warnings.length ? ["Warnings: " + [...new Set(r.warnings)].join("; ")] : []),
            "Diff:", Logic.diffText(JSON.parse(p.base), p.spec)].join("\n");
  }
  Object.assign(TOOLS, {
    async sa_new(a){
      const n = Logic.newSubassembly(a.name, { targets: a.targets || undefined });
      if (!n.ok) throw new Error(n.error);
      const asm = curAsm(), id = "new-" + newId();
      const item = { id, name: a.name, fileName: a.name + ".cs", className: null, params: {}, spec: n.result, attach: { type: "free", x: asm.baseline.x, y: asm.baseline.y } };
      const p = Proposals.add(Proposals.make({ itemId: id, base: n.result, isNew: true, asmId: asm.id, item }));
      item.spec = p.spec;
      if (a.summary) p.summary = a.summary;
      changed(p);
      return { text: `Proposal ${p.id}: new subassembly ${a.name}, item id ${id}. Add to it with sa_apply (item: "${id}"). It exists only after the user accepts.` };
    },
    async sa_apply(a){
      const it = findItem(a.item);
      const notice = cancelledNotice(it.id);
      if (notice) throw new Error(notice);
      if (!Array.isArray(a.ops)) throw new Error("ops must be a list of { fn, args, as? }.");
      let p = Proposals.pendingFor(it.id), isNew = false;
      if (!p){ p = Proposals.make({ itemId: it.id, base: await specOf(it) }); isNew = true; }
      const r = Proposals.apply(p, a.ops, a.summary, { codeParams: codeParamsOf(it) });
      if (!r.ok) throw new Error(r.error + " Nothing was changed.");
      if (isNew) Proposals.add(p);
      changed(p);
      return { text: report(p, r) };
    },
    async sa_scenarios(a){
      const it = findItem(a.item), sp = (await viewOf(it, a)).sp;
      if ((a.action || "list") === "list") return { text: "Scenarios: " + scenarioList(it, sp).map(s => s.name).join(", ") + "." };
      if (a.action !== "add") throw new Error("action must be list or add.");
      if (!a.name) throw new Error("A scenario needs a name.");
      if (a.ground != null && !(Array.isArray(a.ground) && a.ground.length >= 2 && a.ground.every(q => isFinite(q.x) && isFinite(q.y)))) throw new Error("ground must be at least 2 points [{x,y}] relative to the subassembly origin.");
      const notice = cancelledNotice(it.id);
      if (notice) throw new Error(notice);
      let p = Proposals.pendingFor(it.id);
      if (!p) p = Proposals.add(Proposals.make({ itemId: it.id, base: await specOf(it) }));
      p.scenarios.push({ name: a.name, ground: a.ground || null, values: a.values || {}, layout: !!a.layout });
      changed(p);
      return { text: `Scenario "${a.name}" added to proposal ${p.id}; sa_check includes it as "proposed: ${a.name}".` };
    },
    async sa_proposal(a){
      const p = a.id ? Proposals.byId(a.id) : Proposals.pendingFor(findItem(a.item).id) || Proposals.all().filter(x => x.itemId === findItem(a.item).id).pop();
      if (!p) throw new Error("No proposal found.");
      if (a.action === "accept") throw new Error("Only the user can accept a proposal, in the AI tab.");
      if (a.action === "cancel"){
        if (p.status !== "pending") throw new Error(`Proposal ${p.id} is already ${p.status}.`);
        Proposals.finish(p, "cancelled", "cancelled by the AI"); p.acked = true;
        renderAll();
        return { text: `Proposal ${p.id} cancelled.` };
      }
      if (a.action && a.action !== "status") throw new Error("action must be status or cancel.");
      if (p.status === "cancelled") p.acked = true;
      return { text: `Proposal ${p.id}: ${p.status}${p.why ? " (" + p.why + ")" : ""}, ${Proposals.opCount(p)} ops.` };
    }
  });

  async function onMessage(ev){
    let m; try{ m = JSON.parse(ev.data); }catch{ return; }
    const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ id: m.id, ...o })); };
    aiLastCall = Date.now(); renderAi();
    try{
      const fn = TOOLS[m.tool];
      if (!fn) return send({ error: `Unknown tool ${m.tool}.` });
      send(await fn(m.args || {}, m));
    }catch(e){ send({ error: e.message || String(e) }); }
  }
  function connect(){
    ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/mcp-page");
    ws.onmessage = onMessage;
    ws.onopen = () => { if (document.hasFocus()) ws.send('{"active":1}'); };
    ws.onclose = () => setTimeout(connect, 2000);          // dotnet watch restarts the server
  }
  window.addEventListener("focus", () => { if (ws && ws.readyState === 1) ws.send('{"active":1}'); });
  connect();
  return { TOOLS, drawSvg };
})();
