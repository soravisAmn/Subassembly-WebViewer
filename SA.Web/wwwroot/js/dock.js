// Dockable palettes (round 9 M3) with dockview-core (lib/dockview, MIT): the workspace in the centre, palettes around it.
//   Palettes can be moved, tabbed together, resized, closed, reopened (View › Palettes) and floated (drag a tab out with Shift).
//   Each palette's content is an existing element in #pal-src (index.html) — ids unchanged, so render code and the MCP bridge work as before.
//   Layout per machine: localStorage "sa.layout" = { v: DockLayout.VERSION, layout: api.toJSON() }; an old / broken one = default layout.
//   palShown(id) = the palette is open and its content visible (render code skips hidden palettes and redraws them when shown).
"use strict";

// ---------- pure part (node: SA.Tests/js/dock.test.js) ----------
const DockLayout = (() => {
  const KEY = "sa.layout", VERSION = 1;
  // id = component name = panel id · home = where it opens when reopened · on = in the default layout
  const PALETTES = [
    { id: "tree",      title: "Workspace",  home: "left",   on: true },
    { id: "scenarios", title: "Scenarios",  home: "left2",  on: true },
    { id: "props",     title: "Properties", home: "right",  on: true },
    { id: "code",      title: "Code",       home: "right",  on: false },    // opened by Ctrl+E
    { id: "msg",       title: "Messages",   home: "bottom", on: true },
    { id: "log",       title: "Log",        home: "bottom", on: true },
    { id: "pts",       title: "Points",     home: "bottom", on: true },
    { id: "logic",     title: "Logic",      home: "bottom", on: true },
    { id: "ai",        title: "AI",         home: "bottom", on: true }
  ];
  const IDS = new Set(["main", ...PALETTES.map(p => p.id)]);
  // saved value (object or JSON text) → a dockview layout, or null when it cannot be used (then: default layout, no error)
  function parseSaved(raw){
    let o = raw;
    if (typeof o === "string"){ try{ o = JSON.parse(o); }catch{ return null; } }
    if (!o || typeof o !== "object" || o.v !== VERSION) return null;
    const l = o.layout;
    if (!l || typeof l !== "object" || !l.grid || !l.panels || typeof l.panels !== "object") return null;
    const ids = Object.keys(l.panels);
    if (!ids.includes("main")) return null;
    for (const id of ids){
      const p = l.panels[id];
      if (!IDS.has(id) || !p || (p.contentComponent && p.contentComponent !== id)) return null;
    }
    // every tab in the grid / floating groups must be a saved panel
    const views = [];
    const walk = n => { if (!n || typeof n !== "object") return; if (n.type === "leaf") views.push(...((n.data && n.data.views) || [])); else if (Array.isArray(n.data)) n.data.forEach(walk); };
    walk(l.grid.root);
    for (const f of l.floatingGroups || []) views.push(...((f.data && f.data.views) || []));
    if (!views.includes("main") || views.some(v => !l.panels[v])) return null;
    return l;
  }
  const wrap = layout => ({ v: VERSION, layout });
  return { KEY, VERSION, PALETTES, IDS, parseSaved, wrap };
})();
if (typeof module !== "undefined") module.exports = DockLayout;

// ---------- browser part ----------
const Dock = typeof window === "undefined" || !window["dockview-core"] ? null : (() => {
  const DV = window["dockview-core"];
  const content = {}, label = {};
  for (const e of document.querySelectorAll("#pal-src .pal")) content[e.dataset.pal] = e;
  for (const e of document.querySelectorAll("#pal-src .pal-tab")) label[e.dataset.tab] = e;
  const meta = id => DockLayout.PALETTES.find(p => p.id === id);
  // a closed palette's content goes back to #pal-src so getElementById still finds it (render code writes to it while closed)
  const park = el => setTimeout(() => { if (!el.isConnected) $("pal-src").appendChild(el); });
  let api = null, quiet = 0, saveT = null;

  // a palette came into view: draw what render code skipped while it was hidden
  function refresh(id){
    if (typeof renderAll !== "function") return;
    if (id === "msg" || id === "log" || id === "pts") renderDock();
    else if (id === "logic") renderLogic();
    else if (id === "ai") renderAi();
    else if (id === "props") renderProps(true);
    else if (id === "tree") renderTree();
    else if (id === "scenarios") renderScenarios();
    else if (id === "main") render();
  }
  function contentRenderer(id){
    return {
      element: content[id],
      init(params){
        if (params && params.api && params.api.onDidVisibilityChange)
          params.api.onDidVisibilityChange(e => { if (e.isVisible) setTimeout(() => refresh(id)); });
      },
      dispose(){ park(content[id]); }
    };
  }
  function tabRenderer(id){
    const w = document.createElement("div"); w.className = "pal-tabw";
    return {
      element: w,
      init(params){
        w.appendChild(label[id]);
        const x = document.createElement("button"); x.className = "pal-x"; x.textContent = "×"; x.title = "ปิด palette (เปิดคืนได้ที่ View › Palettes)";
        x.onpointerdown = e => e.stopPropagation();
        x.onclick = e => { e.stopPropagation(); params.api.close(); };
        w.appendChild(x);
      },
      dispose(){ park(label[id]); }
    };
  }
  const has = id => !!(api && api.getPanel(id));
  // where a reopened palette goes: next to a palette of the same home, else on its side of the workspace
  function position(id){
    const m = meta(id), open = DockLayout.PALETTES.filter(p => p.id !== id && has(p.id));
    const mate = open.find(p => p.home === m.home) || (m.home === "left2" && open.find(p => p.home === "left")) || (m.home === "left" && open.find(p => p.home === "left2"));
    if (mate && mate.home === m.home) return { referencePanel: mate.id, direction: "within" };
    if (mate) return { referencePanel: mate.id, direction: m.home === "left2" ? "below" : "above" };
    return { referencePanel: "main", direction: { left: "left", left2: "left", right: "right", bottom: "below" }[m.home] };
  }
  const SIZE = { left: { initialWidth: 260 }, left2: { initialWidth: 260, initialHeight: 220 }, right: { initialWidth: 340 }, bottom: { initialHeight: 210 } };
  function add(id, inactive){
    const m = meta(id);
    return api.addPanel({ id, component: id, tabComponent: id, title: m.title, position: position(id), inactive: !!inactive, ...SIZE[m.home] });
  }
  function fixMain(){
    const p = api.getPanel("main"); if (!p) return;
    p.group.header.hidden = true;      // no tab: the workspace cannot be dragged, floated or closed
    p.group.locked = true;             // palettes dock beside it, never as tabs over it
  }
  function buildDefault(){
    quiet++;
    try{
      api.addPanel({ id: "main", component: "main", title: "Workspace" });
      fixMain();
      for (const p of DockLayout.PALETTES) if (p.on) add(p.id, p.home === "bottom" && p.id !== "msg");
      if (typeof ed !== "undefined" && ed.open) add("code");
    } finally { quiet--; }
    api.getPanel("main").api.setActive();
  }
  function save(){
    clearTimeout(saveT);
    saveT = setTimeout(() => { try{ store.set(DockLayout.KEY, DockLayout.wrap(api.toJSON())); }catch{} }, 250);
  }
  function start(){
    api = DV.createDockview($("dv"), {
      createComponent: o => contentRenderer(o.name),
      createTabComponent: o => tabRenderer(o.name),
      theme: DV.themeDark,
      defaultRenderer: "always",            // hidden tabs stay in the page (ids found, editor / svg keep their state)
      floatingGroupBounds: "boundedWithinViewport"
    });
    const saved = DockLayout.parseSaved(store.get(DockLayout.KEY, null));
    let ok = false;
    if (saved){
      quiet++;
      try{ api.fromJSON(saved); ok = has("main"); }catch(e){ ok = false; }
      finally { quiet--; }
    }
    if (!ok){ try{ api.clear(); }catch{} buildDefault(); }
    fixMain();
    // the Code palette follows the code panel of this tab (state.editorOpen opens it again in main.js)
    if (has("code") && !(typeof ed !== "undefined" && ed.open)){ quiet++; try{ api.getPanel("code").api.close(); }finally{ quiet--; } }
    api.onDidLayoutChange(() => { save(); if (typeof updateRibbon === "function") updateRibbon(); });
    api.onDidRemovePanel(p => {
      if (quiet) return;
      if (p.id === "code" && typeof ed !== "undefined" && ed.open) closeEditor();
    });
  }

  // ---------- used by commands / render code ----------
  function show(id){
    if (!api) return;
    const p = api.getPanel(id) || add(id);
    if (p) p.api.setActive();
  }
  function hide(id){
    const p = api && api.getPanel(id); if (!p) return;
    quiet++; try{ p.api.close(); } finally { quiet--; }
  }
  function toggle(id){
    if (id === "code") return toggleEditor();
    has(id) ? hide(id) : show(id);
    if (typeof updateRibbon === "function") updateRibbon();
  }
  function shown(id){
    const p = api && api.getPanel(id);
    return !!p && p.api.isVisible;
  }
  function reset(){
    quiet++;
    try{ api.clear(); }catch{}
    finally { quiet--; }
    try{ store.set(DockLayout.KEY, null); }catch{}
    buildDefault();
    save();
    for (const p of DockLayout.PALETTES) if (has(p.id)) refresh(p.id);
    flashBanner("Reset layout: palette กลับตำแหน่งเริ่มต้น");
  }
  start();
  return { show, hide, toggle, shown, has, reset, get api(){ return api; } };
})();
const palShown = id => !Dock || Dock.shown(id);
