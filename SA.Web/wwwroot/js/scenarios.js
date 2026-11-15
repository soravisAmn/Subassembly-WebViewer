// Round 8 M3: scenarios live in the project file (docs/prompts/prompt-8-design.md section 5).
//   A scenario = { name, ground?: [[x, y], …] (workspace coordinates), params?: { itemId: { name: value } }, mode }
//   mode = normal | layout | notarget. Only what differs from the project's values: no spec, no geometry, no items.
//   Applying one changes the ground / mode / parameter values used for computing; it never touches the drawing and is
//   not an undo step. The project's own values (the "Default" entry) are kept aside while a scenario is active, and the
//   project file always gets those. Edits while a scenario is active are temporary (*): "อัปเดต" saves them into it.
"use strict";

const Scen = (() => {
  const clone = o => JSON.parse(JSON.stringify(o));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const modeOf = w => w.layout ? "layout" : w.surfaceOn === false ? "notarget" : "normal";
  // work / base = { surface: [{x, y}], surfaceOn, layout, params: { itemId: {…} } }
  function capture(name, work, base){
    const s = { name };
    const mode = modeOf(work);
    if (mode === "normal" && work.surface && work.surface.length >= 2) s.ground = work.surface.map(p => [p.x, p.y]);
    const params = {};
    for (const id in work.params){
      const b = base.params[id]; if (!b) continue;
      const d = {};
      for (const k in work.params[id]) if (!same(work.params[id][k], b[k])) d[k] = work.params[id][k];
      if (Object.keys(d).length) params[id] = d;
    }
    if (Object.keys(params).length) s.params = params;
    s.mode = mode;
    return s;
  }
  // scenario -> the values to compute with (items not in base keep nothing here: the caller leaves them as they are)
  function apply(s, base){
    return {
      surface: s.ground ? s.ground.map(([x, y]) => ({ x, y })) : clone(base.surface),
      surfaceOn: s.mode !== "notarget", layout: s.mode === "layout",
      params: Object.fromEntries(Object.entries(base.params).map(([id, p]) => [id, { ...p, ...((s.params || {})[id] || {}) }]))
    };
  }
  // same content (name aside)
  const equal = (a, b) => same({ ...a, name: "" }, { ...b, name: "" });
  // values / ground of one item in a scenario, without applying it (coverage, Build checks, sa_check)
  //   own = the item's current values when it is not in base · surface: workspace coordinates, null = no ground
  function view(s, base, id, own){
    return {
      values: { ...((base.params[id]) || own || {}), ...((s.params || {})[id] || {}) },
      surface: s.mode === "notarget" ? null : s.mode === "layout" ? null : (s.ground ? s.ground.map(([x, y]) => ({ x, y })) : base.surface),
      layout: s.mode === "layout"
    };
  }
  const isNew = s => !!s && typeof s === "object" && typeof s.name === "string" && !s.ws && !s.asm && !("values" in s) && !("file" in s);
  // old browser scenario (whole workspace snapshot, round 7 and earlier) -> new one, for the items of this project
  //   items = [{ id, file }] of the project; matched by id, else by file. Returns { scenario, matched, names }
  function fromOld(old, items, base){
    const ws = old.ws || old.asm;
    let oItems, surface, surfaceOn, layout;
    if (ws){
      oItems = ws.assemblies ? ws.assemblies.flatMap(a => a.items || []) : (ws.items || []);
      surface = ws.surface; surfaceOn = ws.surfaceOn; layout = ws.layout;
    } else {
      oItems = old.file ? [{ file: old.file, params: old.values || {} }] : [];
      surface = old.surface; surfaceOn = old.surfaceOn; layout = old.layout;
    }
    const work = { surface: surface && surface.length >= 2 ? surface : base.surface, surfaceOn: surfaceOn !== false, layout: !!layout, params: {} };
    let matched = 0;
    for (const it of items){
      const oi = oItems.find(x => x.id && x.id === it.id) || oItems.find(x => x.file && it.file && x.file.toLowerCase() === it.file.toLowerCase());
      if (!oi || !base.params[it.id]) continue;
      matched++;
      work.params[it.id] = { ...base.params[it.id], ...(oi.params || {}) };
    }
    const names = oItems.map(x => x.name || x.file || x.sourceName || x.fileName || "?");
    return { scenario: capture(old.name || "กรณี", work, base), matched, names };
  }
  // a name that is not taken yet
  function freeName(list, name){
    if (!list.some(s => s.name === name)) return name;
    for (let i = 2; ; i++) if (!list.some(s => s.name === `${name} (${i})`)) return `${name} (${i})`;
  }
  return { capture, apply, equal, view, isNew, fromOld, freeName, modeOf };
})();

// ---------------- page ----------------
const projScenarios = () => WS().scenarios || (WS().scenarios = []);
const activeScenario = () => projScenarios().find(s => s.name === WS().scenarioActive) || null;
// the values in use now
function currentWork(){
  return { surface: JSON.parse(JSON.stringify(state.surface)), surfaceOn: state.surfaceOn !== false, layout: !!state.layout,
           params: Object.fromEntries(allItems().map(it => [it.id, JSON.parse(JSON.stringify(it.params || {}))])) };
}
// the project's own values ("Default"): kept aside while a scenario is active
const scenarioBase = () => WS().scenarioBase || currentWork();
function applyWork(w){
  state.surface = w.surface; state.surfaceOn = w.surfaceOn; state.layout = w.layout;
  for (const it of allItems()) if (w.params[it.id]) it.params = JSON.parse(JSON.stringify(w.params[it.id]));
  History.rebase();                     // switching cases is not an undo step (and never reverts the drawing)
  persist(); asmRes = {}; run(); renderAll(); renderScenarios();
}
// edits made while the active scenario was applied, not saved into it yet
function scenarioPending(){
  const s = activeScenario();
  return !!s && !Scen.equal(Scen.capture(s.name, currentWork(), scenarioBase()), s);
}
// the scenario of an item for coverage / checks: { values, surface (relative to the item origin) | null, layout }
function scenarioCtxOf(s, it, o){
  const v = Scen.view(s, scenarioBase(), it.id, it.params);
  const sf = v.surface && v.surface.length >= 2 ? v.surface.map(p => ({ x: p.x - o.x, y: p.y - o.y })) : null;
  return { values: v.values, surface: sf, layout: v.layout, extendEnds: state.extendEnds !== false };
}
function resetScenarioState(){ delete WS().scenarioActive; delete WS().scenarioBase; }

// pending edits: อัปเดต / ทิ้ง / ยกเลิก -> "update" | "discard" | null
function askPending(){
  const s = activeScenario();
  if (!s || !scenarioPending()) return Promise.resolve("discard");
  return new Promise(resolve => {
    openDialog(`กรณี "${s.name}" มีค่าที่แก้ค้าง`, b => {
      div("hint", "ค่าที่แก้ระหว่างใช้กรณีนี้ (ผิวดิน / parameter / โหมด) ยังไม่ได้เก็บลงในกรณีนี้ — ค่าของโปรเจกต์ไม่เปลี่ยน", b);
      const done = v => { dlg.onCancel = null; closeDialog(); resolve(v); };
      div("btns", null, b).append(btn("อัปเดตกรณีนี้", () => done("update")), btn("ทิ้ง", () => done("discard")), btn("ยกเลิก", () => done(null)));
      dlg.onCancel = () => resolve(null);
    });
  });
}
// name = null -> Default
async function useScenario(name){
  if (name === (WS().scenarioActive || null) && !scenarioPending()) return;
  const a = await askPending();
  if (!a) return;
  if (a === "update") updateScenario();
  const base = scenarioBase();
  if (!name){
    applyWork(base); resetScenarioState(); persist(); renderScenarios();
    setStatus("ok", "Default: ค่าของโปรเจกต์");
    return;
  }
  const s = projScenarios().find(x => x.name === name); if (!s) return;
  if (!WS().scenarioBase) WS().scenarioBase = base;
  WS().scenarioActive = name;
  applyWork(Scen.apply(s, base));
  setStatus("ok", `ใช้กรณี "${name}" (ส่วนที่วาดไม่เปลี่ยน)`);
}
function updateScenario(){
  const s = activeScenario(); if (!s) return;
  const n = Scen.capture(s.name, currentWork(), scenarioBase());
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, n);
  persist(); renderAll(); renderScenarios(); renderLogic();
}
// "+ บันทึกกรณีนี้": a new scenario from the values in use now (it becomes the active one)
function addScenario(){
  const name = prompt("ตั้งชื่อกรณีนี้", Scen.freeName(projScenarios(), "กรณี " + (projScenarios().length + 1)));
  if (!name) return;
  if (projScenarios().some(s => s.name === name)){ alert(`มีกรณีชื่อ ${name} แล้ว`); return; }
  const base = scenarioBase();
  projScenarios().push(Scen.capture(name, currentWork(), base));
  WS().scenarioBase = base; WS().scenarioActive = name;
  persist(); renderAll(); renderScenarios(); renderLogic();
}
function renameScenario(s){
  const n = prompt("ชื่อใหม่", s.name);
  if (!n || n === s.name) return;
  if (projScenarios().some(x => x.name === n)){ alert(`มีกรณีชื่อ ${n} แล้ว`); return; }
  if (WS().scenarioActive === s.name) WS().scenarioActive = n;
  s.name = n; persist(); renderAll(); renderScenarios(); renderLogic();
}
async function deleteScenario(s){
  if (!confirm(`ลบกรณี "${s.name}"?`)) return;
  if (WS().scenarioActive === s.name){
    const base = scenarioBase();
    applyWork(base); resetScenarioState();
  }
  WS().scenarios = projScenarios().filter(x => x !== s);
  persist(); renderAll(); renderScenarios(); renderLogic();
}

function renderScenarios(){
  const box = $("sc-list"); if (!box) return;
  box.innerHTML = "";
  const act = WS().scenarioActive || null, pend = scenarioPending();
  const li = logicItem();
  const row = (label, small, on, onclick, buttons) => {
    const r = document.createElement("div"); if (on) r.className = "on";
    const n = document.createElement("span");
    n.innerHTML = `${label}${small ? `<small>${small}</small>` : ""}`;
    n.onclick = onclick;
    r.appendChild(n);
    for (const b of buttons || []) r.appendChild(b);
    box.appendChild(r);
    return n;
  };
  const d = row("Default", "ค่าของโปรเจกต์", !act, () => useScenario(null));
  d.title = "ค่าในไฟล์โปรเจกต์ (ผิวดิน / parameter / โหมด ที่ Save project)";
  for (const s of projScenarios()){
    const on = s.name === act;
    const brs = li && ((li.spec.logic || {}).branches || []).length ? scenarioBranches(s, li) : null;
    const lp = li ? scenarioLoops(s, li) : null;
    const mode = { layout: "Layout", notarget: "ไม่มี target" }[s.mode] || "";
    const info = [mode, s.params ? Object.values(s.params).map(p => Object.entries(p).map(([k, v]) => `${k}=${v}`).join(" ")).join(" · ") : ""]
      .concat(brs ? ["กิ่ง: " + ([...brs].map(id => Spec.branchLabel(li.spec, id)).join(", ") || "—")] : [])
      .concat(lp ? [Object.entries(lp).map(([id, n]) => `${id} ×${n}`).join(", ")] : []).filter(Boolean).join(" · ");
    const btns = [];
    if (on){ const u = btn("อัปเดต", updateScenario, !pend, "เก็บค่าที่แก้ (ผิวดิน / parameter / โหมด) ลงในกรณีนี้"); btns.push(u); }
    btns.push(btn("✎", () => renameScenario(s), false, "เปลี่ยนชื่อ"), btn("⇩", () => exportScenarios([s]), false, `Export ${s.name}.scenario.json`), btn("×", () => deleteScenario(s), false, "ลบ"));
    const n = row(esc(s.name) + (on && pend ? " *" : ""), esc(info), on, () => useScenario(s.name), btns);
    n.title = "ใช้กรณีนี้ (เปลี่ยนแค่ผิวดิน / ค่า parameter / โหมด — ส่วนที่วาดไม่เปลี่ยน)" + (on && pend ? "\n* = มีค่าที่แก้ค้าง กด อัปเดต เพื่อเก็บ" : "");
  }
  if (!projScenarios().length) div("empty", "ยังไม่มีกรณี — ตั้งผิวดิน / parameter แล้วกด + บันทึกกรณีนี้", box);
}
$("b-save").onclick = addScenario;

// ---------- export / import ----------
function exportScenarios(list){
  list = list || projScenarios();
  const one = list.length === 1;
  const blob = new Blob([JSON.stringify(one ? list[0] : list, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = one ? `${list[0].name}.scenario.json` : `${projBaseName() || "project"}.scenarios.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
$("f-import").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => {
    let data; try{ data = JSON.parse(t); }catch{ alert("ไฟล์ไม่ใช่ JSON ของ scenarios"); return; }
    const arr = Array.isArray(data) ? data : [data];
    const base = scenarioBase(), items = allItems().map(it => ({ id: it.id, file: it.file }));
    let n = 0;
    for (const x of arr){
      if (!x || typeof x !== "object") continue;
      const s = Scen.isNew(x) ? JSON.parse(JSON.stringify(x)) : Scen.fromOld(x, items, base).scenario;
      s.name = Scen.freeName(projScenarios(), s.name || "กรณี");
      projScenarios().push(s); n++;
    }
    persist(); renderAll(); renderScenarios(); renderLogic();
    setStatus("ok", `นำเข้า ${n} กรณี`);
  });
  e.target.value = "";
};

// ---------- old browser scenarios -> this project (decision 4) ----------
// once per project in this browser; the old list (localStorage sav2.scenarios) is never deleted here
function maybeImportOldScenarios(){
  const old = store.get("sav2.scenarios", []);
  const path = WS().path;
  if (!path || !Array.isArray(old) || !old.length || Proj.readOnly) return;
  const done = store.get("sav2.scenariosImported", []);
  if (done.some(p => ProjectV3.samePath(p, path))) return;
  const mark = () => store.set("sav2.scenariosImported", done.concat([path]));
  const base = scenarioBase(), items = allItems().map(it => ({ id: it.id, file: it.file }));
  const conv = old.map(o => ({ o, ...Scen.fromOld(o, items, base) }));
  openDialog("นำเข้า scenario เก่า", b => {
    div("hint", `เบราว์เซอร์นี้มี scenario ที่บันทึกไว้แบบเดิม ${old.length} กรณี (ทุกโปรเจกต์รวมกัน) — ติ๊กกรณีที่เป็นของโปรเจกต์ ${esc(projBaseName())} เพื่อเก็บเข้าไฟล์โปรเจกต์ (เก็บแค่ผิวดิน / ค่า parameter ที่ต่าง / โหมด — ไม่เอาส่วนที่วาด)`, b);
    const checks = [];
    for (const c of conv){
      const r = div("mig-row", `<div><b>${esc(c.o.name || "กรณี")}</b><br><small>${esc(c.names.join(", ") || "ไม่มี subassembly")} · ตรงกับโปรเจกต์นี้ ${c.matched} ตัว</small></div>`, b);
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = c.matched > 0;
      r.appendChild(cb); checks.push(cb);
    }
    const finish = imp => {
      dlg.onCancel = null; mark();
      if (imp){
        let n = 0;
        conv.forEach((c, i) => { if (!checks[i].checked) return; const s = c.scenario; s.name = Scen.freeName(projScenarios(), s.name); projScenarios().push(s); n++; });
        persist(); renderAll(); renderScenarios(); renderLogic();
        if (n) setStatus("ok", `นำเข้า ${n} กรณีเข้าโปรเจกต์ (กด Save project เพื่อเก็บลงไฟล์)`);
      }
      closeDialog();
    };
    div("btns", null, b).append(btn("นำเข้าที่เลือก", () => finish(true)), btn("ข้าม (ไม่ถามอีก)", () => finish(false)));
    dlg.onCancel = () => mark();
  });
}
