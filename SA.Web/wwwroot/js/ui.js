// แผงรอบ workspace: ต้นไม้ (ซ้าย), Properties (ขวา), แถบผลลัพธ์, แถบล่าง, เมนู/คลิกขวา, หน้าต่าง Import / Open project, Scenarios
"use strict";

// ---------------- การเลือก ----------------
// state.sel.type: ws | surface | spt (จุด surface, i) | asm (asm) | item (item) | pt / link / shape (item, i) | params (item)
//                 | dpt / dlink / dshape (item, id) | multi (ดู selList ใน core.js)
function setSel(sel){
  state.sel = sel;
  hoverPt = -1; treeScroll = true;
  // แถบแก้โค้ดตามไฟล์ของ subassembly ที่เลือก
  const it = selItem();
  if (it){
    // ตัวที่ยังไม่มีไฟล์แต่มีส่วนที่วาด: แถบโค้ดแสดงโค้ดที่สร้าง (อ่านอย่างเดียว)
    const f = it.file ? it.file : (opened && opened.name === it.sourceName ? OPENED : it.spec ? GENERATED + it.id : null);
    if (f !== state.file){ state.file = f; if (ed.open) loadDoc(); }
  }
  persist(); renderAll();
  syncCodeHighlight();       // แถบโค้ดเปิดอยู่: เน้นบรรทัดของ object ที่เลือก
}
function renderAll(){
  mapSelected();
  render(); renderTree(); renderProps(); renderDock(); renderProblem(); applyMarkers(); renderEditBar(); renderDrawer(); renderProjName();
  refreshGenerated();
}
const isSel = selHas;
// ตั้งชุดที่เลือก: 0 ชิ้น = ตัวที่แก้อยู่ / Workspace · 1 ชิ้น = เลือกแบบเดิม · หลายชิ้น = multi
function setSelList(list){
  if (!list.length) return setSel(state.editing ? { type:"item", item: state.editing } : { type:"ws" });
  if (list.length === 1) return setSel(list[0]);
  setSel({ type:"multi", ...(state.editing ? { item: state.editing } : {}), list });
}
// ชิ้นที่รวมกับการเลือกครั้งต่อไปได้ (Edit mode = ส่วนที่วาด, นอก Edit = subassembly) — ที่เลือกอยู่แบบอื่นถูกแทนที่
const pickable = s => state.editing ? /^d(pt|link|shape)$/.test(s.type) && s.item === state.editing : s.type === "item";
const pickedList = () => selList().filter(pickable);
// คลิก / คลุมเลือกบนรูป: เพิ่มเข้าชุด (แบบ AutoCAD) · Shift = เอาออก
function pickAdd(list, remove){ setSelList(Select.merge(pickedList(), list, remove)); }
function selectAll(){
  if (state.editing){
    const it = editItem(); if (!it || !it.spec) return;
    setSelList([...it.spec.points.map(p => ({ type:"dpt", item: it.id, id: p.id })), ...it.spec.links.map(l => ({ type:"dlink", item: it.id, id: l.id })),
                ...it.spec.shapes.map(s => ({ type:"dshape", item: it.id, id: s.id }))]);
  } else setSelList(allItems().map(it => ({ type:"item", item: it.id })));
}
// Delete: Edit mode = ส่วนที่วาดที่เลือก · นอก Edit = subassembly ที่เลือก · จุด surface ที่เลือก = ลบจุดนั้น
function deleteSelection(){
  const s = state.sel;
  if (s.type === "spt") return deleteSurfacePoint(s.i);
  if (state.editing){
    const it = editItem(), list = selList().filter(o => DRAWN_KIND[o.type]);
    if (it && list.length) deleteDrawnSet(it, list);
    return;
  }
  const ids = selList().filter(o => o.type === "item").map(o => o.item);
  if (ids.length) removeItems(ids);
}

// ---------------- 2 · ต้นไม้ ----------------
// โหนดกาง/หุบเก็บใน state.open[key] (ค่าเริ่มต้นดู isOpen)
const OPEN_DEFAULT = { ws: true };
const isOpen = key => key in state.open ? state.open[key] : (OPEN_DEFAULT[key] ?? /^a:/.test(key));

function renderTree(){
  const box = $("tree");
  const h = [];
  const node = (o) => {
    const car = o.key ? `<span class="car" data-tog="${o.key}">${isOpen(o.key) ? "▾" : "▸"}</span>` : `<span class="car"></span>`;
    h.push(`<div class="tn${o.cls ? " " + o.cls : ""}${o.sel ? " sel" : ""}" style="padding-left:${6 + o.depth * 14}px" data-sel='${JSON.stringify(o.s)}'${o.ctx ? ` data-ctx='${JSON.stringify(o.ctx)}'` : ""}${o.title ? ` title="${esc(o.title)}"` : ""}>${car}${o.icon || ""}<span class="nm">${o.name}</span>${o.meta ? `<span class="meta${o.metaCls ? " " + o.metaCls : ""}">${o.meta}</span>` : ""}</div>`);
    if (o.after) h.push(o.after);
  };
  const editing = state.editing;

  node({ key:"ws", depth:0, s:{type:"ws"}, sel: isSel("ws"), ctx:{kind:"ws"}, icon:'<span class="ic">◫</span>',
         name: esc(WS().name ? WS().name.replace(/\.assembly\.json$/i, "") : "Workspace"), meta: `${asms().length} assembly` });
  if (isOpen("ws")){
    node({ depth:1, s:{type:"surface"}, sel: isSel("surface") || state.sel.type === "spt", ctx:{kind:"surface"}, icon:'<span class="ic gnd">≈</span>',
           name:"Surface: EG", meta: state.surfaceOn ? `${state.surface.length} จุด` : "ไม่ได้กำหนดให้ target", metaCls: state.surfaceOn ? "" : "warn" });
    for (const a of asms()){
      const ak = "a:" + a.id;
      node({ key: ak, depth:1, s:{type:"asm", asm:a.id}, sel: isSel("asm", a.id), ctx:{kind:"asm", id:a.id}, icon:'<span class="ic base">⊞</span>',
             name: esc(a.name), meta: `ระดับ ${f3(elevOf(a.baseline.y))}` });
      if (!isOpen(ak)) continue;
      if (!a.items.length) h.push(`<div class="att" style="padding-left:${6 + 2 * 14 + 18}px">ว่าง — คลิกขวา → Import .cs</div>`);
      // ตัวแม่ก่อนตัวลูก (ลำดับเดียวกับที่ server รัน) ย่อหน้าตามความลึกของการเกาะ
      const kids = id => a.items.filter(it => it.attach.type === "point" && it.attach.parent === id);
      const known = new Set(a.items.map(i => i.id)), drawn = new Set(), order = [];
      const walk = (it, d) => { if (drawn.has(it.id)) return; drawn.add(it.id); order.push([it, d]); kids(it.id).forEach(k => walk(k, d + 1)); };
      a.items.filter(i => i.attach.type === "baseline").forEach(i => walk(i, 0));
      a.items.filter(i => i.attach.type !== "point" || !known.has(i.attach.parent)).forEach(i => walk(i, 0));
      a.items.forEach(i => walk(i, 0));
      for (const [it, d] of order) treeItem(node, h, a, it, 2 + Math.min(d, 3), editing);
    }
  }
  box.innerHTML = h.join("");
  const cur = box.querySelector(".tn.sel");
  if (cur && treeScroll){ cur.scrollIntoView({ block:"nearest" }); treeScroll = false; }
}
let treeScroll = false;

function treeItem(node, h, a, it, depth, editing){
  const ik = "i:" + it.id, rr = asmRes[it.id], res = rr && rr.result, st = itemStatus(it.id), at = it.attach;
  const side = sideOf(it);
  let att = "", attCls = "";
  if (rr && rr.attachState === "lost" && hasCode(it)){ att = "⚠ " + (rr.attachNote || "หาจุดเกาะไม่เจอ"); attCls = "lost"; }
  else if (at.type === "baseline") att = "เกาะแกน " + a.name;
  else if (at.type === "point"){
    const p = itemById(at.parent);
    att = `เกาะ ${at.code ? at.code : "จุด #" + at.index + " (ไม่มี code)"} ของ ${itemLabel(p)}`;
  } else { att = "ยังไม่ได้เกาะ — ลากไปที่แกนหรือจุด"; attCls = "free"; }
  const name = `${esc(itemLabel(it))}${it.name && fileOf(it) !== it.name ? `<small>${esc(fileOf(it))}</small>` : ""}${state.editing === it.id ? '<span class="edit-tag">กำลังแก้</span>' : ""}${drawingDirty(it) ? '<span class="dirty-tag" title="ส่วนที่วาดยังไม่ได้ Save ลงไฟล์ .cs">●</span>' : ""}`;
  node({ key: ik, depth, cls: "sub" + (editing && editing !== it.id ? " locked" : ""), s:{type:"item", item:it.id}, sel: isSel("item", it.id),
         ctx:{kind:"item", id:it.id}, icon:`<span class="ic"><span class="sdot ${st === "ok" ? "" : st}" style="display:inline-block"></span></span>`,
         name, meta: side !== null ? (side ? "Left" : "Right") : "", title: att,
         after: `<div class="att ${attCls}" style="padding-left:${6 + depth * 14 + 36}px">${esc(att)}</div>` });
  const sp = it.spec, dr = drawRes[it.id];
  if (!isOpen(ik) || (!res && !sp)) return;
  const d2 = depth + 1;
  const grp = (key, label, n, kids) => {
    node({ key, depth: d2, s:{type:"item", item:it.id}, name: `${label} <small>(${n})</small>` });
    if (isOpen(key)) kids();
  };
  // ส่วนที่วาด (P1, L1, S1 …) ก่อน ตามด้วยของที่โค้ดสร้าง (#0, L0 …)
  const errMeta = o => o && o.err ? "⚠" : "";
  // code ซ้ำ (เช่น จาก Copy / Paste) — Civil 3D ยอมให้ซ้ำได้ แต่บอกไว้ในต้นไม้
  const dupOf = list => { const n = {}; for (const o of list) for (const c of new Set(o.codes)) n[c] = (n[c] || 0) + 1; return o => o.codes.some(c => n[c] > 1); };
  const dname = (o, dup) => esc(o.codes.length ? `${o.id} ${o.codes.join(", ")}` : o.id) + (dup && dup(o) ? ' <small class="dup" title="มี point / link / shape อื่นใช้ code นี้ด้วย">code ซ้ำ</small>' : "");
  const dp = sp ? sp.points : [], dl = sp ? sp.links : [], ds = sp ? sp.shapes : [];
  const code = res && !(rr && rr.generated) ? res : null;     // โค้ดที่สร้างจาก spec = ซ้ำกับที่วาด ไม่ต้องแสดง
  const cp = code ? code.points : [], cl = code ? code.links : [], cs = code ? code.shapes : [];
  const dupP = dupOf(dp), dupL = dupOf(dl), dupS = dupOf(ds);
  grp(ik + ":pts", "Points", dp.length + cp.length, () => {
    dp.forEach(p => node({ depth: d2 + 1, cls:"leaf drawn" + (Spec.isAux(p) ? " aux" : ""), s:{type:"dpt", item:it.id, id:p.id}, sel: isSel("dpt", it.id, p.id),
                           name: dname(p, dupP), meta: errMeta(dr && dr.pts[p.id]) || (Spec.isAux(p) ? "aux · " : "") + (Spec.rotationOf(sp, p.id) ? `หมุน ${Spec.rotationOf(sp, p.id).id} · ` : "") + Spec.POINT_TYPES[p.def.type], metaCls: dr && dr.pts[p.id] && dr.pts[p.id].err ? "warn" : "" }));
    cp.forEach((p, i) => node({ depth: d2 + 1, cls:"leaf", s:{type:"pt", item:it.id, i}, sel: isSel("pt", it.id, i), name: `#${i} ${esc(p.codes.join(", ") || "—")}`, meta: "โค้ด" }));
  });
  grp(ik + ":links", "Links", dl.length + cl.length, () => {
    dl.forEach(l => node({ depth: d2 + 1, cls:"leaf drawn" + (Spec.isAux(l) ? " aux" : ""), s:{type:"dlink", item:it.id, id:l.id}, sel: isSel("dlink", it.id, l.id),
                           name: dname(l, dupL), meta: errMeta(dr && dr.links[l.id]) || (Spec.isAux(l) ? "aux · " : "") + Spec.linkEnds(l).join("→") + (l.type === "followSurface" ? " ตามดิน" : Spec.isArc(l) ? " " + Spec.LINK_TYPES[l.type] : "") }));
    cl.forEach((l, i) => node({ depth: d2 + 1, cls:"leaf", s:{type:"link", item:it.id, i}, sel: isSel("link", it.id, i), name: `L${i} ${esc(l.codes.join(", ") || "—")}`, meta: "#" + l.pts.join("→#") }));
  });
  grp(ik + ":shapes", "Shapes", ds.length + cs.length, () => {
    ds.forEach(s => node({ depth: d2 + 1, cls:"leaf drawn", s:{type:"dshape", item:it.id, id:s.id}, sel: isSel("dshape", it.id, s.id),
                           name: dname(s, dupS), meta: errMeta(dr && dr.shapes[s.id]) || s.links.join(",") }));
    cs.forEach((s, i) => node({ depth: d2 + 1, cls:"leaf", s:{type:"shape", item:it.id, i}, sel: isSel("shape", it.id, i), name: `S${i} ${esc(s.codes.join(", ") || "—")}`, meta: "โค้ด" }));
  });
  const np = (res ? res.params.length : 0) + (sp ? sp.params.length : 0);
  node({ depth: d2, s:{type:"params", item:it.id}, sel: isSel("params", it.id), name: `Parameters <small>(${np})</small>` });
}

$("tree").addEventListener("click", e => {
  const tog = e.target.closest("[data-tog]");
  if (tog){ const k = tog.dataset.tog; state.open[k] = !isOpen(k); persist(); renderTree(); return; }
  const n = e.target.closest(".tn"); if (!n) return;
  const s = JSON.parse(n.dataset.sel);
  if (state.editing && s.item && s.item !== state.editing) return;     // Edit mode: ตัวอื่นแก้ไม่ได้
  // Ctrl+คลิก = เพิ่ม / เอาออกจากชุดที่เลือก (คลิกธรรมดาในต้นไม้ = เลือกชิ้นเดียว)
  if ((e.ctrlKey || e.metaKey) && pickable(s)) return pickAdd([s], selList().some(o => Select.key(o) === Select.key(s)));
  setSel(s);
});
$("tree").addEventListener("dblclick", e => {
  const n = e.target.closest(".tn"); if (!n) return;
  const t = n.querySelector("[data-tog]"); if (!t) return;
  const k = t.dataset.tog; state.open[k] = !isOpen(k); persist(); renderTree();
});
$("tree").addEventListener("contextmenu", e => {
  const n = e.target.closest(".tn"); if (!n || !n.dataset.ctx) return;
  e.preventDefault();
  const c = JSON.parse(n.dataset.ctx);
  if (state.editing && c.kind === "item" && c.id !== state.editing) return;
  setSel(JSON.parse(n.dataset.sel));
  openCtx(e, c.kind, c.id);
});

// ---------------- คลิกขวา ----------------
function ctxItems(kind, id, extra){
  if (kind === "drawn"){
    const it = itemById(id), k = { dpt: "point", dlink: "link", dshape: "shape" }[extra.type];
    return [
      { h: `${itemLabel(it)} · ${extra.id}` },
      { label:"Move", cmd: () => startCmd("move"), disabled: state.editing !== id, note: "M" },
      { label:"Copy", cmd: () => startCmd("copy"), disabled: state.editing !== id, note: "C" },
      { label:"Rotate", cmd: () => startCmd("rotate"), disabled: state.editing !== id, note: "R" },
      ...(k !== "shape" ? [auxMenuItem(it, extra, state.editing !== id)] : []),
      { label:`ลบ ${extra.id}`, cmd: () => deleteDrawn(it, k, extra.id), disabled: state.editing !== id, note: state.editing !== id ? "เข้า Edit ก่อน" : "Delete" }
    ];
  }
  if (kind === "item"){
    const it = itemById(id), editingThis = state.editing === id;
    return [
      { h: itemLabel(it) },
      editingThis ? { label:"ออกจาก Edit", cmd: () => exitEdit() } : { label:"Edit (วาดใน subassembly นี้)", cmd: () => enterEdit(id), disabled: !!state.editing },
      { label: hasCode(it) ? "✎ แก้โค้ด" : "ดูโค้ดที่สร้าง", cmd: () => { setSel({ type:"item", item:id }); if (!ed.open) openEditor(); },
        disabled: !hasCode(it) && !it.spec && !(opened && opened.name === it.sourceName) },
      { label:"Rename…", cmd: () => renameItem(id) },
      { label:"Save เป็น .cs", cmd: () => saveDrawing(it), disabled: !canSaveDrawing(it),
        note: canSaveDrawing(it) ? (drawingDirty(it) ? "ยังไม่ได้ save" : "") : it.spec ? "Milestone 4" : "ไม่มีส่วนที่วาด" },
      { label:"Move", cmd: () => { if (!selHas("item", id)) setSel({ type:"item", item:id }); startCmd("move"); }, disabled: !!state.editing, note: "M" },
      { label:"Copy", cmd: () => { if (!selHas("item", id)) setSel({ type:"item", item:id }); startCmd("copy"); }, disabled: !!state.editing, note: "C" },
      { label:"Mirror", cmd: () => mirrorItem(id), disabled: !!state.editing },
      { label:"เพิ่มเข้า \"รูปทรงของฉัน\"", disabled: true, note:"ระยะสอง" },
      { sep: true },
      { label:"เอาออกจาก assembly", cmd: () => removeItem(id), disabled: !!state.editing && !editingThis }
    ];
  }
  if (kind === "asm"){
    const a = asmById(id);
    return [
      { h: a.name },
      { label:"ADD (subassembly ใหม่ แล้วเข้า Edit)", cmd: () => addDrawn(a.id), disabled: !!state.editing },
      { label:"Import .cs เข้า assembly นี้…", cmd: () => openImport(a.id) },
      { label:"Rename…", cmd: () => { const n = prompt("ชื่อ assembly", a.name); if (n){ a.name = n.trim() || a.name; persist(); renderAll(); } } },
      { sep: true },
      { label:"ลบ assembly", cmd: () => { if (!a.items.length || confirm(`ลบ ${a.name} และ subassembly ${a.items.length} ตัวในนั้นออกจาก workspace? (ไฟล์ .cs ไม่ถูกลบ)`)) removeAsm(a.id); },
        disabled: !!state.editing }
    ];
  }
  if (kind === "surface") return [
    { h:"Surface: EG" },
    { label: addMode ? "ออกจากโหมด Add point" : "Add point (A)", cmd: () => setAddMode(!addMode) },
    { label:"รีเซ็ตเส้น surface", cmd: resetSurface }
  ];
  return [
    { h:"Workspace" },
    { label:"+ Assembly ใหม่", cmd: addAsm, disabled: !!state.editing },
    { label:"Import .cs…", cmd: () => openImport() },
    { label:"Fit (F)", cmd: fit }
  ];
}
function openCtx(e, kind, id, extra){
  const box = $("ctx");
  const list = ctxItems(kind, id, extra);
  box.innerHTML = "";
  for (const m of list){
    if (m.sep){ box.appendChild(document.createElement("hr")); continue; }
    if (m.h){ const d = document.createElement("div"); d.className = "ctx-h"; d.textContent = m.h; box.appendChild(d); continue; }
    const b = document.createElement("button");
    b.innerHTML = esc(m.label) + (m.note ? `<small>${esc(m.note)}</small>` : "");
    b.disabled = !!m.disabled;
    b.onclick = () => { closeMenus(); m.cmd && m.cmd(); };
    box.appendChild(b);
  }
  box.hidden = false;
  const r = box.getBoundingClientRect();
  box.style.left = Math.min(e.clientX, innerWidth - r.width - 6) + "px";
  box.style.top = Math.min(e.clientY, innerHeight - r.height - 6) + "px";
}
function closeMenus(){ $("ctx").hidden = true; $("dd-file").hidden = true; if (!$("osmenu").hidden) closeOsMenu(); }
// คลิกข้างนอกเมนู = ปิด (ปุ่ม OSNAP / ▾ จัดการเมนู OSNAP เอง)
document.addEventListener("pointerdown", e => { if (!e.target.closest(".ctx,.dropdown,#m-file,.osmenu,#b-osmenu,#b-osnap")) closeMenus(); });

function renameItem(id){
  const it = itemById(id);
  const n = prompt("ชื่อที่แสดงในต้นไม้ (ไฟล์ .cs ไม่ถูกเปลี่ยนชื่อ) — เว้นว่าง = ใช้ชื่อไฟล์", it.name || fileOf(it));
  if (n === null) return;
  it.name = n.trim() && n.trim() !== fileOf(it) ? n.trim() : undefined;
  persist(); renderAll();
}

// ---------------- Edit mode ----------------
// เข้า Edit = วาดเพิ่มใน subassembly นั้นได้ (Drawer ใช้ได้) ตัวอื่นจางและแก้ไม่ได้
// ไฟล์ที่เขียนเอง: ส่วนที่วาดเก็บแยกใน it.spec (Milestone 4 จะเขียนลงไฟล์ในช่วงที่มีป้ายกำกับ)
function enterEdit(id){
  const it = itemById(id); if (!it) return;
  if (cmd.name) endCmd();
  // spec ว่างที่สร้างตอนเข้า Edit ไม่นับเป็นการกระทำ
  if (!it.spec){ it.spec = Spec.specForImported((asmRes[id] && asmRes[id].className || "").split(".").pop() || "Imported", codeParamsOf(it)); History.rebase(); }
  state.editing = id; setAddMode(false);
  state.open["i:" + id] = true; state.open["i:" + id + ":pts"] = true;
  setSel({ type:"item", item:id });
}
function exitEdit(){
  if (cmd.name) endCmd();
  const id = state.editing; state.editing = null;
  setTool(null);
  // ไฟล์ import ที่เข้า Edit แล้วไม่ได้วาดอะไร: ไม่ต้องเก็บ spec ว่างไว้
  const it = itemById(id);
  if (it && it.spec && hasCode(it) && !it.spec.points.length && !it.spec.params.length){ delete it.spec; History.rebase(); }
  setSel(id ? { type:"item", item:id } : { type:"ws" });
}
function renderEditBar(){
  const it = itemById(state.editing);
  if (state.editing && !it) state.editing = null;
  $("edit-bar").hidden = !it;
  if (it) $("edit-name").textContent = itemLabel(it) + (hasCode(it) ? "" : " (ยังไม่มีไฟล์ .cs)") + (drawingDirty(it) ? " ●" : "");
  const sv = $("edit-save");
  sv.disabled = !canSaveDrawing(it);
  sv.title = !it ? "" : !it.spec ? "ยังไม่ได้วาดอะไร"
    : canSaveDrawing(it) ? (hasCode(it) ? `เขียนส่วนที่วาดลง ${it.file} (เฉพาะช่วง SA-DRAWING) — Ctrl+S` : `สร้างไฟล์ ${it.fileName || "?"} — Ctrl+S`)
    : "ไฟล์ที่เขียนเองยังไม่มีช่วง SA-DRAWING — การแทรกให้เองมาใน Milestone 4";
  $("drawer-hint").textContent = it ? "Undo Ctrl+Z · Redo Ctrl+Y" : "เข้า Edit ก่อน (คลิกขวาที่ subassembly)";
}
$("edit-save").onclick = () => saveDrawing(editItem());

// Save (.cs): ยังไม่มีไฟล์ = สร้างทั้งไฟล์; มีช่วง SA-DRAWING = แทนที่เฉพาะช่วงนั้น
//   ชื่อซ้ำกับไฟล์อื่น / ช่วงในไฟล์ถูกแก้ด้วยมือ -> ถามก่อนเสมอ
async function saveDrawing(it, opts = {}){
  if (!canSaveDrawing(it)) return;
  flushSave();                                   // แถบโค้ดมีส่วนที่ยังไม่บันทึกของไฟล์นี้ -> บันทึกก่อน
  let file = it.file || it.fileName;
  if (!file){
    file = prompt("ชื่อไฟล์ .cs", toClassName(it.spec.className) + ".cs");
    if (!file) return;
  }
  if (!/\.cs$/i.test(file)) file += ".cs";
  const body = { spec: it.spec, file, overwrite: !!opts.overwrite, force: !!opts.force };
  const r = await fetch("/api/drawing/save", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) })
    .then(r => r.json()).catch(() => ({ ok: false, message: NO_SERVER }));
  if (!r.ok){
    if (r.exists){
      if (confirm(`มีไฟล์ ${file} อยู่แล้ว และไม่ใช่ไฟล์ที่สร้างจากเว็บ\n\nตกลง = เขียนทับทั้งไฟล์ (โค้ดเดิมในไฟล์จะหาย)\nยกเลิก = ตั้งชื่อใหม่`))
        return saveDrawing(it, { ...opts, overwrite: true });
      const n = prompt("ชื่อไฟล์ใหม่", file.replace(/\.cs$/i, "") + "-2.cs");
      if (n){ it.fileName = n; return saveDrawing(it, opts); }
      return;
    }
    if (r.edited){
      if (confirm(`${r.message}\n\nตกลง = เขียนทับช่วงนั้นด้วยส่วนที่วาด (ที่แก้ด้วยมือในช่วงนั้นจะหาย)\nยกเลิก = ไม่บันทึก`))
        return saveDrawing(it, { ...opts, force: true });
      return;
    }
    alert(r.message || "บันทึกไม่สำเร็จ");
    return;
  }
  // บันทึกแล้ว: ตัวนี้กลายเป็นไฟล์ในโฟลเดอร์ (โค้ดในไฟล์ = ส่วนที่วาด) วาดต่อแล้ว Save ซ้ำได้
  if (!it.file){ it.file = r.file; delete it.fileName; state.file = it.file; }
  it.generatedFile = true; it.specEdited = false;
  it.savedSpec = JSON.stringify(it.spec);
  persist(); await poll();
  if (ed.open && ed.kind === "generated") loadDoc();
  else if (ed.open && ed.name === r.file){ ed.key = null; loadDoc(); }
  setStatus("ok", (r.created ? "สร้าง " : "บันทึก ") + r.file + " แล้ว");
  run();
}

// Import ไฟล์ที่เคยสร้าง/วาดจากเว็บ: อ่านส่วนที่วาดกลับจาก sa-spec ให้วาดต่อได้
async function loadSpecFromFile(it){
  if (!it || !it.file) return;
  const r = await fetch("/api/drawing/spec?file=" + encodeURIComponent(it.file)).then(r => r.json()).catch(() => null);
  if (!r || !r.ok || !r.spec) return;
  it.spec = Spec.normalize(r.spec); it.generatedFile = true; it.specEdited = !!r.edited;
  it.savedSpec = JSON.stringify(r.spec);
  History.rebase();          // ส่วนของการ Import (ก้อน Undo "เพิ่ม …" เดียวกัน)
  persist(); run();
}

// ADD: subassembly ใหม่ (มีแต่ส่วนที่วาด ยังไม่มีไฟล์ .cs) แล้วเข้า Edit ทันที
function addDrawn(asmId){
  const name = prompt("ชื่อ subassembly ใหม่ (เป็นชื่อไฟล์ .cs ตอนกด Save)", "new-subassembly");
  if (!name) return;
  const cls = toClassName(name.replace(/\.cs$/i, ""));
  const it = addItem({ spec: Spec.newSpec(cls), fileName: name.replace(/\.cs$/i, "") + ".cs" }, asmById(asmId) || curAsm());
  enterEdit(it.id);
  setTool("link");
}
// ชื่อไฟล์ -> ชื่อ class (แบบเดียวกับ SubassemblyTemplate.ClassName เช่น "rock-pitching 2" -> "RockPitching2")
function toClassName(name){
  let out = "", up = true;
  for (const c of name){
    if (/[A-Za-z0-9]/.test(c)){ out += up ? c.toUpperCase() : c; up = false; }
    else up = true;
  }
  return !out || /^\d/.test(out) ? "Subassembly" + out : out;
}
$("edit-exit").onclick = exitEdit;

// ---------------- 4 · Properties ----------------
let propsSig = "";
function renderProps(force){
  const box = $("props");
  // กำลังพิมพ์ใน Properties อยู่: ไม่สร้างใหม่ (ช่องจะหลุด focus) — วาดใหม่ตอนออกจากช่อง
  if (!force && box.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName) && propsSig === JSON.stringify(state.sel)) return;
  propsSig = JSON.stringify(state.sel);
  const s = state.sel;
  box.innerHTML = "";
  const it = selItem(), rr = it ? asmRes[it.id] : null, res = rr && rr.result;
  let of = "";
  if (s.type === "ws"){ of = "Workspace"; propsWorkspace(box); }
  else if (s.type === "surface" || s.type === "spt"){ of = s.type === "spt" ? `Surface #${s.i}` : "Surface: EG"; propsSurface(box); }
  else if (s.type === "asm"){ const a = asmById(s.asm); if (a){ of = a.name; propsAsm(box, a); } }
  else if (s.type === "multi"){ of = `${s.list.length} objects`; propsMulti(box, s.list); }
  else if (it){
    of = itemLabel(it);
    if (s.type === "pt" && res && res.points[s.i]){ of += ` · #${s.i}`; propsPoint(box, it, rr, s.i); propsCode(box, it, s); }
    else if (s.type === "link" && res && res.links[s.i]){ of += ` · L${s.i}`; propsLink(box, it, rr, s.i); propsCode(box, it, s); }
    else if (s.type === "shape" && res && res.shapes[s.i]){ of += ` · S${s.i}`; propsShape(box, it, rr, s.i); propsCode(box, it, s); }
    else if (/^d(pt|link|shape)$/.test(s.type) && specObj(it, s)){ of += " · " + s.id; propsDrawn(box, it, s); }
    else propsItem(box, it, rr, s.type === "params");
  } else { of = "Workspace"; state.sel = { type:"ws" }; propsWorkspace(box); }
  $("props-of").textContent = of;
}
// Undo: เข้าช่อง = ตั้งชื่อการกระทำจากชื่อช่อง · ออกจากช่อง = นับเป็น 1 ก้อน (ระหว่างพิมพ์ persist ไม่นับ)
$("props").addEventListener("focusin", e => {
  const lb = e.target.closest(".row") && e.target.closest(".row").querySelector("label");
  const field = lb && lb.firstChild ? lb.firstChild.textContent.trim() : "";
  History.act(`แก้ ${field || "ค่าใน Properties"} · ${$("props-of").textContent}`);
});
$("props").addEventListener("focusout", () => {
  History.track();
  setTimeout(() => { if (!$("props").contains(document.activeElement)) renderProps(true); }, 0);
});

const div = (cls, html, parent) => { const d = document.createElement("div"); if (cls) d.className = cls; if (html != null) d.innerHTML = html; if (parent) parent.appendChild(d); return d; };
function kv(parent, rows){
  const g = div("kv", null, parent);
  for (const [k, v, raw] of rows) g.insertAdjacentHTML("beforeend", `<span>${esc(k)}</span><span class="v">${raw ? v : esc(v)}</span>`);
  return g;
}
function group(parent, title, btn){
  const g = div("pg", null, parent);
  const h = div("pg-h", esc(title), g);
  if (btn){ const b = document.createElement("button"); b.textContent = btn.label; b.title = btn.title || ""; b.onclick = btn.cmd; h.appendChild(b); }
  return g;
}
function numRow(parent, label, small, value, step, onInput, onChange){
  const row = div("row", `<label>${esc(label)}${small ? `<small>${esc(small)}</small>` : ""}</label>`, parent);
  const inp = document.createElement("input"); inp.type = "number"; inp.step = step; inp.value = value;
  if (onInput) inp.addEventListener("input", () => { const v = parseFloat(inp.value); if (!isNaN(v)) onInput(v); });
  if (onChange) inp.addEventListener("change", () => { const v = parseFloat(inp.value); if (!isNaN(v)) onChange(v); });
  row.appendChild(inp);
  return inp;
}
function checkRow(parent, label, checked, on){
  const l = document.createElement("label"); l.className = "check";
  l.innerHTML = `<input type="checkbox"${checked ? " checked" : ""}> ${esc(label)}`;
  l.querySelector("input").onchange = e => on(e.target.checked);
  parent.appendChild(l);
}

function propsWorkspace(box){
  const g = group(box, "Corridor");
  const row = div("row", `<label>Mode</label>`, g);
  const sel = document.createElement("select");
  sel.innerHTML = '<option value="corridor">Corridor</option><option value="layout">Layout</option>';
  sel.value = state.layout ? "layout" : "corridor";
  sel.onchange = () => { state.layout = sel.value === "layout"; changed(); };
  row.appendChild(sel);
  numRow(g, "Datum", "ระดับจริงที่ Y = 0 ของจอ", state.originElevation, 0.5, null,
         v => { state.originElevation = v; changed(); renderTree(); });
  div("hint", "เปลี่ยน Datum = เปลี่ยนตัวเลขระดับจริงของทั้ง workspace (รูปบนจอไม่ขยับ) · ตัวจำลองส่งค่านี้เป็น CurrentElevation", g);
  const g2 = group(box, "Workspace");
  kv(g2, [["Assembly", String(asms().length)], ["Subassembly", String(allItems().length)], ["Project", WS().name || "(ยังไม่ได้บันทึก)"]]);
  div("btns", null, g2).append(btn("+ Assembly ใหม่", addAsm, !!state.editing), btn("Import .cs…", () => openImport()));
}
function btn(label, cmd, disabled, title){
  const b = document.createElement("button"); b.textContent = label; b.onclick = cmd; b.disabled = !!disabled; if (title) b.title = title; return b;
}
function resetSurface(){ state.surface = DEFAULT_SURFACE.map(p => ({...p})); state.sel = { type:"surface" }; changed(); renderTree(); }
function propsSurface(box){
  const g = group(box, "เส้น surface");
  const b = div("btns", null, g);
  const add = btn(addMode ? "✓ Add point" : "+ Add point", () => setAddMode(!addMode), false, "A");
  if (addMode) add.classList.add("on");
  b.append(add, btn("ลบจุด", () => deleteSurfacePoint(state.sel.i), state.sel.type !== "spt", "Delete"), btn("รีเซ็ต", resetSurface));
  checkRow(g, "กำหนด surface ของเว็บให้ Target Surface", state.surfaceOn, v => { state.surfaceOn = v; changed(); renderTree(); });
  checkRow(g, "ต่อปลายเส้นออกไปแนวราบ (surface กว้างไม่จำกัด)", state.extendEnds, v => { state.extendEnds = v; changed(); });
  div("hint", `ลากจุด = ขึ้น-ลง · <kbd>Shift</kbd>+ลาก = เลื่อนแนวราบด้วย<br>ลากที่เส้น = เลื่อนทั้งเส้น · ดับเบิลคลิกเส้น = แทรกจุด · คลิกขวาที่จุด = ลบ`, g);
  if (state.sel.type === "spt" && state.surface[state.sel.i]){
    const i = state.sel.i, p = state.surface[i], s = state.surface;
    const g2 = group(box, `จุด #${i}`);
    numRow(g2, "Offset", "จากแกน " + curAsm().name, f3(offOf(p.x)), 0.05, null, v => {
      const x = v + curAsm().baseline.x;
      const lo = i > 0 ? s[i-1].x + 0.01 : -Infinity, hi = i < s.length - 1 ? s[i+1].x - 0.01 : Infinity;
      p.x = Math.min(hi, Math.max(lo, x)); changed();
    });
    numRow(g2, "Elevation", "ระดับจริง", f3(elevOf(p.y)), 0.05, v => { p.y = v - state.originElevation; changed(); });
  }
}
function propsAsm(box, a){
  const g = group(box, "Assembly");
  const row = div("row", `<label>ชื่อ</label>`, g);
  const n = document.createElement("input"); n.type = "text"; n.value = a.name;
  n.onchange = () => { a.name = n.value.trim() || a.name; persist(); renderAll(); };
  row.appendChild(n);
  numRow(g, "ระดับแกน", "ระดับจริง (profile)", f3(elevOf(a.baseline.y)), 0.5, null, v => { a.baseline.y = v - state.originElevation; changed(); renderTree(); });
  div("hint", "เปลี่ยนระดับแกน = ยก/ลด assembly นี้ทั้งชุดเทียบกับ surface · ลากแกน ⊞ บนรูปก็ได้", g);
  kv(g, [["Subassembly", String(a.items.length)]]);
  div("btns", null, g).append(btn("Import .cs เข้า assembly นี้…", () => openImport(a.id)),
                              btn("ADD", () => addDrawn(a.id), !!state.editing, "สร้าง subassembly ใหม่ (ว่าง) แล้วเข้า Edit"));
}
function propsItem(box, it, rr, paramsOnly){
  const res = rr && rr.result, sp = it.spec, code = hasCode(it);
  if (!code) rr = null;
  if (!paramsOnly){
    const g = group(box, "Subassembly");
    const gen = !!(asmRes[it.id] && asmRes[it.id].generated);
    const rows = [["ไฟล์", code ? fileOf(it) + (it.file ? "" : " (เปิดจากเครื่อง)") : `${it.fileName || "-"} (ยังไม่ได้ Save)`]];
    if (rr && rr.className) rows.push(["Class", rr.className]);
    if (res && !gen){ rows.push(["Points / Links", `${res.points.length} / ${res.links.length} (จากโค้ด)`]); rows.push(["Shapes", String(res.shapes.length)]); }
    if (gen) rows.push(["โค้ด", (drawingDirty(it) ? "ส่วนที่วาดยังไม่ได้ Save · " : "") + (csharpMismatch(it) ? "⚠ ผล C# ไม่ตรงกับรูป" : "ผลรันโค้ด C# ตรงกับรูป")]);
    if (sp) rows.push(["วาดเพิ่ม", `${sp.points.length} จุด · ${sp.links.length} link · ${sp.shapes.length} shape`]);
    if (rr) rows.push(["คอมไพล์ + รัน", `${(rr.compileMs || 0).toFixed(0)} + ${(res ? res.runMs : 0).toFixed(0)} ms`]);
    kv(g, rows);
    if (sp && !code){
      const row = div("row", `<label>ชื่อ class<small>ใช้ตอนสร้างโค้ด</small></label>`, g);
      const inp = document.createElement("input"); inp.type = "text"; inp.value = sp.className;
      inp.onchange = () => { const v = inp.value.trim(); if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) specEdit(s => { s.className = v; }, it); else { alert("ชื่อ class ต้องเป็นตัวอังกฤษ/ตัวเลข/_ และไม่ขึ้นต้นด้วยตัวเลข"); inp.value = sp.className; } };
      row.appendChild(inp);
    }
    if (rr && rr.classes && rr.classes.length > 1){
      const row = div("row", `<label>class ในไฟล์</label>`, g);
      const sel = document.createElement("select");
      sel.innerHTML = rr.classes.map(c => `<option>${esc(c)}</option>`).join("");
      sel.value = rr.className; sel.onchange = () => { it.className = sel.value; persist(); run(); };
      row.appendChild(sel);
    }
    const at = it.attach, a = asmOfItem(it.id);
    let att = at.type === "baseline" ? "แกน " + a.name : at.type === "point" ? `${at.code || "จุด #" + at.index} ของ ${itemLabel(itemById(at.parent))}` : "ลอยอยู่ (ยังไม่เกาะ)";
    if (rr && rr.attachState === "lost") att = "⚠ " + rr.attachNote;
    const org = itemOrigin(it);
    kv(g, [["จุดเกาะ", att], ["Origin", `offset ${f3(offOf(org.x, a))} · elev ${f3(elevOf(org.y))}`]]);
    const b = div("btns", null, g);
    b.append(state.editing === it.id ? btn("ออกจาก Edit", exitEdit) : btn("Edit", () => enterEdit(it.id), !!state.editing),
             btn(hasCode(it) ? "✎ แก้โค้ด" : "ดูโค้ดที่สร้าง", () => { if (!ed.open) openEditor(); }, !hasCode(it) && !it.spec && !(opened && opened.name === it.sourceName)),
             btn("⇋ Mirror", () => mirrorItem(it.id), !!state.editing), btn("× เอาออก", () => removeItem(it.id), !!state.editing && state.editing !== it.id));
    if (it.spec){
      const sv = btn(drawingDirty(it) ? "Save (.cs) ●" : "Save (.cs)", () => saveDrawing(it), !canSaveDrawing(it));
      sv.title = canSaveDrawing(it) ? "เขียนส่วนที่วาดลงไฟล์ .cs" : "ไฟล์ที่เขียนเองยังไม่มีช่วง SA-DRAWING — Milestone 4";
      if (drawingDirty(it) && canSaveDrawing(it)) sv.classList.add("primary");
      b.append(sv);
    }
    if (res && res.targets.length){
      const gt = group(box, "Targets");
      for (const t of res.targets){
        const tag = !t.supported ? '<span class="tag no">ยังไม่รองรับ</span>'
          : t.assigned ? '<span class="tag ok">กำหนดแล้ว</span>' : '<span class="tag">ไม่ได้กำหนด</span>';
        div("tgt", `<span><b>${esc(t.displayName || t.name)}</b> <span class="mono" style="color:var(--muted);font-size:11px">${esc(t.type)}</span></span>${tag}`, gt);
      }
    }
  }
  const gp = group(box, "ค่า Parameter", { label:"ค่า default", title:"กลับไปใช้ค่า default ทั้งหมด", cmd: () => { it.params = {}; persist(); renderProps(true); run(); } });
  renderParams(gp, it, rr);
  if (sp) propsParamTable(box, it);
}
function renderParams(box, it, rr){
  // parameter จากโค้ด (GetInputParameters) + parameter ของส่วนที่วาด (ไม่ซ้ำชื่อ)
  let defs = rr && rr.result ? rr.result.params.slice() : (hasCode(it) ? null : []);
  if (!defs){ div("empty", rr && !rr.ok ? "— คอมไพล์/โหลดไม่ผ่าน ดูรายละเอียดในกรอบแดง" : "กำลังคอมไพล์…", box); return; }
  if (it.spec) for (const p of it.spec.params) if (!defs.some(d => d.name === p.name)) defs.push({ name: p.name, kind: p.kind, default: +p.default || 0, displayName: p.displayName, drawn: true });
  if (!defs.length){ div("empty", "ไม่มี input parameter", box); return; }
  const v = it.params ||= {};
  for (const d of defs){
    const row = div("row", null, box);
    const id = "prm-" + d.name;
    const label = d.displayName && d.displayName !== d.name ? `${esc(d.displayName)}<small>${esc(d.name)} · ${d.kind}</small>` : `${esc(d.name)}<small>${d.kind}</small>`;
    row.innerHTML = `<label for="${esc(id)}" title="${esc(d.description || "")}">${label}</label>`;
    let input;
    const cur = d.name in v ? v[d.name] : d.default;
    const set = val => { v[d.name] = val; input.classList.toggle("changed", val !== d.default); persist(); if (hasCode(it)) run(); else renderAll(); };
    if (d.kind === "long" && /^side$/i.test(d.name)){
      input = document.createElement("select");
      input.innerHTML = '<option value="0">0 · Right</option><option value="1">1 · Left</option>';
      input.value = String(cur);
      input.onchange = () => set(+input.value);
    } else if (d.kind === "bool"){
      input = document.createElement("input"); input.type = "checkbox"; input.checked = !!cur;
      input.style.justifySelf = "start";
      input.onchange = () => set(input.checked);
    } else if (d.kind === "string"){
      input = document.createElement("input"); input.type = "text"; input.value = cur ?? "";
      input.oninput = () => set(input.value);
    } else {
      input = document.createElement("input"); input.type = "number";
      input.step = d.kind === "long" ? "1" : "0.1"; input.value = cur;
      input.oninput = () => { const n = parseFloat(input.value); if (!isNaN(n)) set(n); };
    }
    input.id = id;
    if (d.name in v && v[d.name] !== d.default) input.classList.add("changed");
    row.appendChild(input);
  }
}
function propsPoint(box, it, rr, i){
  const p = rr.result.points[i], a = asmOfItem(it.id);
  const g = group(box, `Point #${i}`);
  kv(g, [["Codes", p.codes.join(", ") || "—"],
         ["Offset", f3(p.x - rr.originX) + "  (เทียบ origin)"], ["Elevation", f3(p.y - rr.originY) + "  (เทียบ origin)"],
         ["Offset แกน", f3(offOf(p.x, a))], ["ระดับจริง", f3(elevOf(p.y))]]);
  div("hint", "ค่าเทียบ origin = ค่าเดียวกับที่โค้ดส่งให้ Points.Add · จุดนี้มาจากโค้ดเดิม (แก้ในโค้ด) · ตอนวาด คลิกจุดนี้ = ใช้เป็นจุดอ้างอิงด้วย point code", g);
}
function propsLink(box, it, rr, i){
  const res = rr.result, l = res.links[i], P = res.points;
  const g = group(box, `Link L${i}`);
  const rows = [["Codes", l.codes.join(", ") || "—"], ["จุด", l.pts.map(k => "#" + k).join(" → ")]];
  let len = 0;
  for (let k = 0; k < l.pts.length - 1; k++){ const a = P[l.pts[k]], b = P[l.pts[k + 1]]; len += Math.hypot(b.x - a.x, b.y - a.y); }
  rows.push(["ความยาว", f3(len) + " m"]);
  if (l.pts.length === 2){
    const a = P[l.pts[0]], b = P[l.pts[1]];
    rows.push(["dx / dy", `${f3(b.x - a.x)} / ${f3(b.y - a.y)}`], ["Slope", slopeText(b.x - a.x, b.y - a.y)]);
  }
  kv(g, rows);
}
function propsShape(box, it, rr, i){
  const res = rr.result, s = res.shapes[i], P = res.points;
  const g = group(box, `Shape S${i}`);
  let area = null;
  if (s.polygon){ area = 0; s.polygon.forEach((k, j) => { const a = P[k], b = P[s.polygon[(j + 1) % s.polygon.length]]; area += a.x * b.y - b.x * a.y; }); area = Math.abs(area) / 2; }
  kv(g, [["Codes", s.codes.join(", ") || "—"], ["Links", s.links.map(k => "L" + k).join(", ")], ["พื้นที่", area == null ? "(link ต่อกันไม่เป็นรูปปิด)" : f3(area) + " m²"]]);
}

// ---------------- Properties ของสิ่งที่วาด ----------------
// ช่องพิมพ์: แก้แล้วรูปเปลี่ยนทันที (ถ้านิพจน์ถูก) · Undo 1 ครั้ง = ย้อนการแก้ 1 ช่อง (นับตอนออกจากช่อง ดู persist)
function liveEdit(it, fn){ fn(it.spec); persist(); renderAll(); }
const canEdit = it => state.editing === it.id;
function exprRow(parent, it, label, small, value, onValid, opts = {}){
  const row = div("row", `<label>${esc(label)}${small ? `<small>${esc(small)}</small>` : ""}</label>`, parent);
  const inp = document.createElement("input"); inp.type = "text"; inp.value = value ?? ""; inp.disabled = !canEdit(it);
  inp.className = "expr";
  const err = div("expr-err", "", parent);
  const names = specNames(it);
  const check = () => {
    const v = inp.value.trim();
    const r = opts.optional && !v ? { ok: true } : Expr.check(opts.slope ? v.replace(/^(-?)1:/, "$11/") : v, names);
    inp.classList.toggle("bad", !r.ok); err.textContent = r.ok ? "" : r.error;
    return r.ok;
  };
  inp.addEventListener("input", () => { if (check()) liveEdit(it, () => onValid(opts.slope ? inp.value.trim().replace(/^(-?)1:/, "$11/") : inp.value.trim())); });
  row.appendChild(inp); check();
  return inp;
}
function selectRow(parent, it, label, options, value, onChange, small){
  const row = div("row", `<label>${esc(label)}${small ? `<small>${esc(small)}</small>` : ""}</label>`, parent);
  const sel = document.createElement("select"); sel.disabled = !canEdit(it);
  sel.innerHTML = options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
  sel.value = value ?? "";
  sel.onchange = () => { specEdit(() => onChange(sel.value), it); renderProps(true); };
  row.appendChild(sel);
  return sel;
}
// auxiliary: code ไม่ถูกส่งออก (Civil 3D ไม่เห็นอยู่แล้ว) — ช่องปิดไว้แต่ไม่ลบ code เดิม (สลับกลับเป็นของจริงแล้ว code กลับมา)
function codesRow(parent, it, obj){
  const aux = Spec.isAux(obj);
  const row = div("row", `<label>Codes<small>${aux ? "auxiliary: ไม่ส่งออก (เก็บไว้)" : "คั่นด้วย ,"}</small></label>`, parent);
  const inp = document.createElement("input"); inp.type = "text"; inp.value = obj.codes.join(", "); inp.disabled = !canEdit(it) || aux;
  inp.onchange = () => specEdit(() => { obj.codes = inp.value.split(",").map(c => c.trim()).filter(Boolean); }, it);
  row.appendChild(inp);
}

// เลือกหลายชิ้น: จำนวนแยกชนิด, ปุ่มคำสั่ง, codes ร่วม (Edit mode), รายการ (คลิก = เลือกเฉพาะชิ้นนั้น · × = เอาออก)
const PICK_NAMES = { dpt: "point", dlink: "link", dshape: "shape", item: "subassembly" };
function propsMulti(box, list){
  const count = {};
  for (const o of list) count[o.type] = (count[o.type] || 0) + 1;
  const g = group(box, `เลือก ${list.length} objects`);
  kv(g, Object.entries(count).map(([t, n]) => [PICK_NAMES[t] || t, String(n)]));
  div("btns", null, g).append(btn("Move (M)", () => startCmd("move"), false, "คลิกจุดฐาน แล้วคลิกปลายทาง"),
                              btn("Copy (C)", () => startCmd("copy"), false, "คลิกจุดฐาน แล้วคลิกปลายทาง (วางได้หลายครั้ง Enter = จบ)"),
                              ...(state.editing ? [btn("Rotate (R)", () => startCmd("rotate"), false, "คลิกจุดหมุน แล้วลากมุม / พิมพ์มุม"),
                                                   btn("Auxiliary (X)", toggleAuxSel, false, "สลับ Auxiliary ของ point / link ที่เลือก")] : []),
                              btn("Delete", deleteSelection, false, "ลบทุกชิ้นที่เลือก (Delete) — Ctrl+Z ย้อนได้"));
  const it = state.editing ? editItem() : null;
  if (it && it.spec){
    const objs = list.map(o => specObj(it, o)).filter(Boolean), txt = objs.map(o => o.codes.join(", "));
    const same = txt.every(c => c === txt[0]);
    const row = div("row", `<label>Codes<small>ทุกชิ้นที่เลือก · คั่นด้วย ,</small></label>`, g);
    const inp = document.createElement("input"); inp.type = "text";
    inp.value = same ? txt[0] : ""; inp.placeholder = same ? "" : "(ต่างกัน — พิมพ์เพื่อแทนทั้งหมด)";
    inp.onchange = () => specEdit(() => { const c = inp.value.split(",").map(x => x.trim()).filter(Boolean); for (const o of objs) o.codes = c.slice(); }, it);
    row.appendChild(inp);
  }
  div("hint", "คลิก / คลุมเพิ่ม = เพิ่มเข้าชุด · Shift = เอาออก · Ctrl+คลิกในต้นไม้ = เพิ่ม/เอาออก · Esc = ยกเลิกการเลือก", g);
  const g2 = group(box, "รายการ");
  const pl = div("pick-list", null, g2);
  for (const o of list){
    const r = div("pk", null, pl);
    const name = o.type === "item" ? itemLabel(itemById(o.item)) : o.id;
    r.innerHTML = `<span>${esc(name)}</span><small>${PICK_NAMES[o.type] || ""}</small>`;
    r.onclick = () => setSel(o);
    const x = btn("×", ev => { ev.stopPropagation(); pickAdd([o], true); }, false, "เอาออกจากที่เลือก");
    r.appendChild(x);
  }
}

function propsDrawn(box, it, s){
  const sp = it.spec, r = drawRes[it.id];
  if (!canEdit(it)) div("hint", "เข้า Edit (คลิกขวาที่ subassembly) เพื่อแก้ค่า", box);
  if (s.type === "dpt") propsDrawnPoint(box, it, Spec.byId(sp.points, s.id), r);
  else if (s.type === "dlink") propsDrawnLink(box, it, Spec.byId(sp.links, s.id), r);
  else propsDrawnShape(box, it, Spec.byId(sp.shapes, s.id), r);
  const pg = Spec.polygonOf(sp, DRAWN_KIND[s.type], s.id, true);
  if (pg) propsPolygon(box, it, pg);
  for (const rg of rotationsFor(sp, s)) propsRotation(box, it, rg);
  propsCode(box, it, s);
}
// กลุ่มหมุนที่เกี่ยวกับ object ที่เลือก: จุด = กลุ่มของมันเอง / กลุ่มที่ใช้มันเป็นจุดหมุน · link / shape = กลุ่มของจุดปลาย
function rotationsFor(sp, s){
  const ids = s.type === "dpt" ? [s.id] : s.type === "dlink" ? Spec.linkRefs(Spec.byId(sp.links, s.id))
    : Spec.byId(sp.shapes, s.id).links.flatMap(l => { const o = Spec.byId(sp.links, l); return o ? Spec.linkRefs(o) : []; });
  return (sp.rotations || []).filter(g => ids.some(id => g.points.includes(id)) || (s.type === "dpt" && g.pivot === s.id));
}
// กลุ่มหมุน: แก้มุม (นิพจน์ / parameter) / จุดหมุน ทีหลังได้ · เลิกหมุน = สมาชิกกลับตำแหน่งก่อนหมุน
function propsRotation(box, it, g){
  const sp = it.spec;
  const gr = group(box, `กลุ่มหมุน ${g.id}`, canEdit(it) ? { label:"เลิกหมุน", title:"ลบกลุ่มหมุน — จุดกลับไปตำแหน่งก่อนหมุน (Ctrl+Z ย้อนได้)",
    cmd: () => { specEdit(s => { s.rotations = s.rotations.filter(x => x.id !== g.id); }, it, `เลิกหมุน ${g.id}`); renderProps(true); } } : null);
  kv(gr, [["สมาชิก", g.points.join(", ")]]);
  const opts = sp.points.filter(p => !g.points.includes(p.id)).map(p => [p.id, p.id + (Spec.isAux(p) ? " (aux)" : "")]);
  selectRow(gr, it, "จุดหมุน", opts, g.pivot, v => { g.pivot = v; });
  const inp = exprRow(gr, it, "มุม (องศา)", "ทวนเข็ม + ในกรอบ Side = Right", g.angle, v => { g.angle = v; });
  if (canEdit(it)){
    const b = btn("+", () => {
      const name = newParamFromValue(it, inp.value.trim() || g.angle, "Ang");
      if (name){ specEdit(() => { g.angle = name; }, it, `${g.id} ใช้ parameter ${name}`); renderProps(true); }
    }, false, "สร้าง parameter ใหม่จากช่องนี้ (default = ค่าตอนนี้)");
    b.classList.add("par-btn"); inp.parentElement.appendChild(b);
    div("btns", null, gr).append(btn("เลือกทั้งกลุ่ม", () => setSelList(g.points.map(id => ({ type:"dpt", item: it.id, id }))), false, "เลือกจุดทุกจุดในกลุ่ม"));
  }
  div("hint", "จุดในกลุ่มคำนวณตามความหมายเดิม (dx / dy ฯลฯ ในกรอบก่อนหมุน) แล้วหมุนรอบจุดหมุน · Move ทั้งกลุ่มได้ · ฝั่ง Left มุมกลับเอง", gr);
}
// Polygon ด้านเท่า: แก้ N / R / θ / โหมด ทีหลังได้ (จุดยอดเป็น polar จากจุดศูนย์กลาง — id เดิม ของที่อ้างจุดยอดไม่หลุด)
function propsPolygon(box, it, g){
  const sp = it.spec;
  const gr = group(box, `Polygon ด้านเท่า ${g.id}`);
  kv(gr, [["ศูนย์กลาง", g.center], ["จุดยอด", g.points.join(", ")], ["Shape", g.shape || "—"]]);
  const row = div("row", `<label>N<small>จำนวนด้าน 3–24</small></label>`, gr);
  const n = document.createElement("input"); n.type = "number"; n.min = 3; n.max = 24; n.step = 1; n.value = g.n; n.disabled = !canEdit(it);
  n.onchange = () => {
    const v = Math.round(+n.value);
    if (!(v >= 3 && v <= 24)){ n.value = g.n; return flashBanner("N ต้องเป็นจำนวนเต็ม 3–24"); }
    if (v === g.n) return;
    // ลองกับสำเนาก่อน: มีของอื่นอ้างจุดยอด / link เดิม = ไม่ทำ (ไม่เกิดรายการ Undo เปล่า)
    const test = JSON.parse(JSON.stringify(sp)), block = Spec.rebuildPolygon(test, test.polygons.find(x => x.id === g.id), v);
    if (block.length){ n.value = g.n; return alert(`เปลี่ยนจำนวนด้านไม่ได้ — ${block.join(", ")} อ้างจุดยอด / link ของ ${g.id} อยู่\nลบหรือย้ายการอ้างอิงนั้นก่อน (แก้ R / θ ได้ตามปกติ)`); }
    specEdit(s => { Spec.rebuildPolygon(s, g, v); state.sel = { type:"dshape", item: it.id, id: g.shape }; }, it, `เปลี่ยน ${g.id} เป็น ${v} ด้าน`);
    renderProps(true);
  };
  row.appendChild(n);
  const ex = (key, label, small, pname) => {
    const inp = exprRow(gr, it, label, small, g[key], v => { g[key] = v; Spec.updatePolygon(sp, g); });
    if (canEdit(it)){
      const b = btn("+", () => {
        const name = newParamFromValue(it, inp.value.trim() || g[key], pname);
        if (name){ specEdit(() => { g[key] = name; Spec.updatePolygon(sp, g); }, it, `${g.id} ใช้ parameter ${name}`); renderProps(true); }
      }, false, "สร้าง parameter ใหม่จากช่องนี้ (default = ค่าตอนนี้)");
      b.classList.add("par-btn"); inp.parentElement.appendChild(b);
    }
  };
  ex("radius", "R", g.mode === "circumscribed" ? "ศูนย์กลาง → กึ่งกลางด้าน" : "ศูนย์กลาง → มุม", "R");
  ex("angle", "θ (องศา)", "0 = จุดแรกอยู่บนสุด · ฝั่ง Right", "Theta");
  selectRow(gr, it, "โหมด", [["inscribed", "ถึงมุม (Inscribed)"], ["circumscribed", "ถึงกึ่งกลางด้าน (Circumscribed)"]], g.mode, v => { g.mode = v; Spec.updatePolygon(sp, g); });
  div("hint", "Move / Copy ทั้งรูปได้ (เลือกชิ้นไหนก็ได้ทั้งรูป) · จุดศูนย์กลางเป็นจุด auxiliary (ไม่ลง Civil 3D)", gr);
}
function propsDrawnPoint(box, it, p, r){
  const sp = it.spec, d = p.def, q = r && r.pts[p.id], a = asmOfItem(it.id);
  const g = group(box, `Point ${p.id}`, canEdit(it) ? { label:"ลบ", title:"ลบจุดนี้ (และสิ่งที่พึ่งจุดนี้)", cmd: () => deleteDrawn(it, "point", p.id) } : null);
  codesRow(g, it, p);
  const others = sp.points.filter(o => o.id !== p.id && !Spec.dependsOn(sp, o.id, p.id));
  const ptOpts = others.map(o => [o.id, `${o.id}${o.codes.length ? " " + o.codes.join(",") : ""}`]);
  // จุดสัมผัสเกิดจาก Fillet เท่านั้น (เปลี่ยนเป็นชนิดอื่นได้ แต่เปลี่ยนกลับไม่ได้)
  selectRow(g, it, "ชนิด", Object.entries(Spec.POINT_TYPES).filter(([k]) => k !== "tangent" || d.type === "tangent"), d.type, t => convertPoint(it, p, t, r));
  const refRow = (key, label, small, allowOrigin) =>
    selectRow(g, it, label, (allowOrigin ? [["", "(origin)"]] : []).concat(ptOpts), d[key] || "", v => { if (v) d[key] = v; else delete d[key]; }, small);
  const ex = (key, label, small, opts) => exprRow(g, it, label, small, d[key], v => { d[key] = v; }, opts);
  const dirRow = () => selectRow(g, it, "ทิศ", [["1", "ออกด้านนอก (+)"], ["-1", "เข้าด้านใน (−)"]], String(d.dir === -1 ? -1 : 1), v => { d.dir = +v; }, "ฝั่ง Right = ไปทางขวา");
  switch (d.type){
    case "delta": refRow("from", "จาก", "", true); ex("dx", "dx", "ไปทางนอก +"); ex("dy", "dy", "ขึ้น +"); break;
    case "polar": refRow("from", "จาก", "", true); ex("length", "ระยะ", ""); ex("angle", "มุม (องศา)", "ทวนเข็มจาก +x · ฝั่ง Right"); break;
    case "slopeLength": refRow("from", "จาก", "", true); ex("slope", "Slope", "dy/dx ลง = ลบ (หรือ -1:2)", { slope: true }); dirRow();
      ex("length", "ยาว", ""); selectRow(g, it, "วัดความยาว", Object.entries(Spec.MEASURES), d.measure || "along", v => { d.measure = v; }); break;
    case "slopeToSurface": refRow("from", "จาก", "", true); ex("slope", "Slope", "dy/dx ลง = ลบ (หรือ -1:2)", { slope: true }); dirRow();
      ex("maxDistance", "ไม่ชนดินใน", "ระยะราบสูงสุด (m) แล้วหยุด + เตือน"); ex("layoutLength", "Layout / ไม่มีดิน", "ระยะราบที่วาดแทน (m)"); break;
    case "onSurface": refRow("from", "จาก", "", true); ex("dx", "dx", "ไปทางนอก +"); break;
    case "between": refRow("a", "จุด a"); refRow("b", "จุด b"); ex("t", "t", "0 = a, 1 = b, 0.5 = กึ่งกลาง"); break;
    case "intersect": refRow("a1", "เส้น A จาก"); refRow("a2", "เส้น A ถึง"); refRow("b1", "เส้น B จาก"); refRow("b2", "เส้น B ถึง"); break;
    case "tangent": {
      refRow("corner", "มุม"); refRow("toward", "บนเส้นไปทาง"); refRow("other", "อีกเส้นไปทาง");
      // รัศมีของจุดสัมผัสคู่นี้กับ link Fillet ต้องเท่ากัน -> แก้ที่ไหนก็แก้ทั้งสาม
      const fl = sp.links.find(l => l.type === "fillet" && l.corner === d.corner && (l.from === p.id || l.to === p.id));
      exprRow(g, it, "รัศมี", fl ? `ใช้ร่วมกับ ${fl.id}` : "", d.radius, v => fl ? setFilletRadius(sp, fl, v) : (d.radius = v));
      break;
    }
    case "external": {
      const rr = asmRes[it.id], codes = rr && rr.result ? [...new Set(rr.result.points.flatMap(x => x.codes))] : [];
      if (d.code && !codes.includes(d.code)) codes.unshift(d.code);
      selectRow(g, it, "Point code", codes.map(c => [c, c]), d.code, v => { d.code = v; }, "จุดของโค้ดเดิม");
      break;
    }
  }
  // Auxiliary: คำนวณใน C# แต่ไม่ Points.Add · เป็นปลาย link จริงไม่ได้ (setAux ถามก่อน)
  auxCheck(g, it, { type:"dpt", id: p.id }, p, "ไม่เพิ่มลง Civil 3D · อ้างอิง / snap ได้");
  if (q && q.err) div("expr-err", "⚠ " + esc(q.err), g);
  else if (q){
    const rows = [["Offset", f3(q.x) + "  (เทียบ origin)"], ["Elevation", f3(q.y) + "  (เทียบ origin)"],
                  ["Offset แกน", f3(offOf(r.ox + q.x, a))], ["ระดับจริง", f3(elevOf(r.oy + q.y))]];
    const f = d.from && r.pts[d.from];
    if (f && !f.err) rows.push(["จาก " + d.from, slopeText(q.x - f.x, q.y - f.y)]);
    kv(g, rows);
  }
}
// เปลี่ยนชนิดจุด: คงตำแหน่งเดิมไว้ (แปลงเป็นตัวเลข) แล้วให้ผู้ใช้แก้ต่อ
function convertPoint(it, p, type, r){
  const sp = it.spec, d = p.def, q = r && r.pts[p.id] && !r.pts[p.id].err ? r.pts[p.id] : { x: 0, y: 0 }, F = r ? r.flip : 1;
  const from = refsFrom(sp, p), f = from && r.pts[from] && !r.pts[from].err ? r.pts[from] : { x: 0, y: 0 };
  const dx = q.x - f.x, dy = q.y - f.y, run = Math.abs(dx), s = run < 1e-9 ? 0 : dy / run, dir = (Math.sign(dx) || 1) * F;
  const others = sp.points.filter(o => o.id !== p.id && !Spec.dependsOn(sp, o.id, p.id)).map(o => o.id);
  const fr = from ? { from } : {};
  p.def = {
    origin: () => ({ type }),
    delta: () => ({ type, ...fr, dx: Expr.num(dx * F), dy: Expr.num(dy) }),
    // มุมในกรอบ Side = Right (ฝั่ง Left ภาพกระจก: dx บนจอ × F)
    polar: () => ({ type, ...fr, length: Expr.num(Math.hypot(dx, dy)), angle: Expr.num(Math.atan2(dy, dx * F) * 180 / Math.PI) }),
    slopeLength: () => ({ type, ...fr, slope: Expr.num(s), length: Expr.num(Math.hypot(dx, dy)), dir, measure: "along" }),
    slopeToSurface: () => ({ type, ...fr, slope: Expr.num(s || -0.5), dir, target: "TargetSurface", maxDistance: "50", layoutLength: Expr.num(run || 3) }),
    onSurface: () => ({ type, ...fr, dx: Expr.num(dx * F), target: "TargetSurface" }),
    between: () => ({ type, a: others[0] || "", b: others[1] || others[0] || "", t: "0.5" }),
    intersect: () => ({ type, a1: others[0] || "", a2: others[1] || "", b1: others[2] || "", b2: others[3] || "" }),
    external: () => { const rr = asmRes[it.id], c = rr && rr.result ? rr.result.points.find(x => x.codes.length) : null; return { type, code: c ? c.codes[0] : "" }; },
    tangent: () => d
  }[type]();
  if (d.type === type) p.def = d;
}
const refsFrom = (sp, p) => p.def.from || null;

function propsDrawnLink(box, it, l, r){
  const sp = it.spec, q = r && r.links[l.id];
  const g = group(box, `Link ${l.id}`, canEdit(it) ? { label:"ลบ", title:"ลบ link นี้ (และ shape ที่ใช้มัน)", cmd: () => deleteDrawn(it, "link", l.id) } : null);
  codesRow(g, it, l);
  const [a, b] = Spec.linkEnds(l), cur = l.type || "straight";
  // เปลี่ยนชนิด: เส้นตรง / ตามดิน / โค้งรัศมี สลับกันได้ · โค้ง 3 จุด / Fillet เปลี่ยนเป็นชนิดอื่นได้แต่สร้างจากตรงนี้ไม่ได้ (ใช้เครื่องมือ Arc / Fillet)
  const types = Object.entries(Spec.LINK_TYPES).filter(([k]) => !["arc3", "fillet"].includes(k) || k === cur);
  selectRow(g, it, "ชนิด", types, cur, v => {
    const keep = { id: l.id, codes: l.codes, ...(l.seg && Spec.ARC_TYPES.includes(v) ? { seg: l.seg } : {}) };
    for (const k of Object.keys(l)) delete l[k];
    if (v === "straight") Object.assign(l, keep, { points: [a, b] });
    else if (v === "followSurface") Object.assign(l, keep, { type: v, from: a, to: b, target: "TargetSurface" });
    else if (v === "arcR"){
      const A = r && r.pts[a], B = r && r.pts[b], c = A && B && !A.err && !B.err ? Math.hypot(B.x - A.x, B.y - A.y) : 1;
      Object.assign(l, keep, { type: v, from: a, to: b, radius: Expr.num(c), sweep: "ccw", large: false });   // เริ่มที่รัศมี = ระยะเริ่ม-ปลาย
    }
  });
  // link จริง: จุด auxiliary เป็นปลายไม่ได้ (ไม่อยู่ใน Civil 3D) · link auxiliary ต่อได้ทุกจุด
  const laux = Spec.isAux(l);
  const opts = sp.points.filter(o => laux || !Spec.isAux(o) || o.id === a || o.id === b).map(o => [o.id, o.id + (o.codes.length ? " " + o.codes.join(",") : "") + (Spec.isAux(o) ? " (aux)" : "")]);
  const setEnd = (i, v) => { if (l.points) l.points[i] = v; else l[i ? "to" : "from"] = v; };
  if (l.type !== "fillet"){
    selectRow(g, it, "จาก", opts, a, v => setEnd(0, v));
    selectRow(g, it, "ถึง", opts, b, v => setEnd(1, v));
  } else kv(g, [["จุดสัมผัส", `${a} → ${b}`], ["มุม", l.corner]]);
  if (l.type === "arc3"){
    const vopts = sp.points.filter(o => o.id !== a && o.id !== b).map(o => [o.id, o.id + (Spec.isAux(o) ? " (aux)" : "")]);
    selectRow(g, it, "ผ่านจุด", vopts, l.via, v => { l.via = v; }, "จุด auxiliary ได้");
  }
  if (l.type === "arcR"){
    exprRow(g, it, "รัศมี", "น้อยกว่าครึ่งระยะเริ่ม-ปลาย = เส้นตรง + เตือน", l.radius, v => { l.radius = v; });
    selectRow(g, it, "ทิศ", [["ccw", "ทวนเข็ม"], ["cw", "ตามเข็ม"]], l.sweep === "cw" ? "cw" : "ccw", v => { l.sweep = v; }, "กรอบ Side = Right");
    selectRow(g, it, "ทาง", [["", "ทางสั้น (≤ 180°)"], ["1", "ทางยาว (> 180°)"]], l.large ? "1" : "", v => { l.large = !!v; });
  }
  if (l.type === "fillet") exprRow(g, it, "รัศมี", "ใหญ่เกินเส้น / ขนาน = มุมแหลมเดิม + เตือน", l.radius, v => setFilletRadius(sp, l, v));
  if (Spec.isArc(l)){
    // ความละเอียด: ท่อนยาวไม่เกิน (m) หรือจำนวนท่อน · จำกัด 2–180 ท่อน
    const sg = l.seg || Spec.SEG_DEFAULT;
    selectRow(g, it, "แบ่งโค้ง", [["chord", "ท่อนยาวไม่เกิน (m)"], ["count", "จำนวนท่อน"]], sg.by, v => { l.seg = { by: v, value: v === "count" ? "16" : Spec.SEG_DEFAULT.value }; },
              `${Spec.SEG_MIN}–${Spec.SEG_MAX} ท่อน`);
    exprRow(g, it, sg.by === "count" ? "จำนวนท่อน" : "ท่อนยาวไม่เกิน", "", sg.value, v => { l.seg = { by: sg.by, value: v }; });
  }
  auxCheck(g, it, { type:"dlink", id: l.id }, l, "ไม่ Links.Add ลง Civil 3D · อ้างอิง / snap ได้ · ใช้ใน shape ไม่ได้");
  if (q && q.err){
    div("expr-err", "⚠ " + esc(q.err), g);
    // quick fix: link จริงที่ปลายเป็นจุด auxiliary (ไม่เปลี่ยนให้เองเงียบๆ)
    if (q.auxEnd && canEdit(it)) div("btns", null, g).append(
      btn(`ทำจุด ${q.auxEnd} เป็นจุดจริง`, () => setAux(it, [{ type:"dpt", id: q.auxEnd }], false)),
      btn("ทำ link นี้เป็น Auxiliary", () => setAux(it, [{ type:"dlink", id: l.id }], true)));
  }
  else if (q){
    let len = 0; for (let k = 0; k < q.path.length - 1; k++) len += Math.hypot(q.path[k + 1].x - q.path[k].x, q.path[k + 1].y - q.path[k].y);
    const A = q.path[0], B = q.path[q.path.length - 1];
    const rows = [["ความยาว", f3(len) + " m"], ["dx / dy", `${f3(B.x - A.x)} / ${f3(B.y - A.y)}`], ["Slope", slopeText(B.x - A.x, B.y - A.y)], ["จำนวนจุด", String(q.path.length)]];
    if (q.arc) rows.push(["ใน Civil 3D", `${q.path.length - 1} link ตรง (+ ${q.path.length - 2} จุดระหว่างทาง)`], ["รัศมีจริง", f3(q.arc.r) + " m"],
                         ["มุมกวาด", `${f3(Math.abs(q.arc.sw) * 180 / Math.PI)}° ${q.arc.sw > 0 ? "ทวนเข็ม" : "ตามเข็ม"} (บนจอ)`]);
    kv(g, rows);
  }
}
// รัศมีของ Fillet ใช้ 3 ที่ (link + จุดสัมผัส 2 จุด) ให้เท่ากันเสมอ
function setFilletRadius(sp, fl, v){
  fl.radius = v;
  for (const id of [fl.from, fl.to]){ const p = Spec.byId(sp.points, id); if (p && p.def.type === "tangent" && p.def.corner === fl.corner) p.def.radius = v; }
}
function propsDrawnShape(box, it, s, r){
  const q = r && r.shapes[s.id];
  const g = group(box, `Shape ${s.id}`, canEdit(it) ? { label:"ลบ", title:"ลบ shape นี้", cmd: () => deleteDrawn(it, "shape", s.id) } : null);
  codesRow(g, it, s);
  let area = null;
  if (q && q.poly){ area = 0; q.poly.forEach((a, j) => { const b = q.poly[(j + 1) % q.poly.length]; area += a.x * b.y - b.x * a.y; }); area = Math.abs(area) / 2; }
  kv(g, [["Links", s.links.join(", ")], ["พื้นที่", q && q.err ? "⚠ " + q.err : area == null ? "(link ต่อกันไม่เป็นรูปปิด)" : f3(area) + " m²"]]);
  // quick fix: shape ที่มี link auxiliary
  if (q && q.auxLink && canEdit(it)) div("btns", null, g).append(
    btn(`ทำ ${q.auxLink} เป็นของจริง`, () => setAux(it, [{ type:"dlink", id: q.auxLink }], false)),
    btn(`เอา ${q.auxLink} ออกจาก shape`, () => { specEdit(() => { s.links = s.links.filter(x => x !== q.auxLink); }, it, `เอา ${q.auxLink} ออกจาก ${s.id}`); renderProps(true); }));
}

// ---------------- Auxiliary (ช่วยสร้าง) ----------------
// point / link ที่สั่ง: คลิกขวาบนชิ้นที่อยู่ในชุดที่เลือก = ทั้งชุด · ไม่งั้น = ชิ้นนั้น (shape ไม่นับ)
function auxTargets(it, extra){
  const sel = pickedList().filter(o => o.item === it.id && (o.type === "dpt" || o.type === "dlink"));
  return extra && !sel.some(o => o.type === extra.type && o.id === extra.id) ? [{ type: extra.type, item: it.id, id: extra.id }] : sel;
}
function auxMenuItem(it, extra, disabled){
  const objs = auxTargets(it, extra), on = !objs.every(o => Spec.isAux(specObj(it, o)));
  return { label: (on ? "ทำเป็น Auxiliary" : "ทำเป็นของจริง") + (objs.length > 1 ? ` (${objs.length} ชิ้น)` : ""),
           cmd: () => setAux(it, objs, on), disabled: disabled || !objs.length, note: "X" };
}
// X นอกคำสั่ง: สลับ Auxiliary ของชุดที่เลือก (มีของจริงปน = ทำเป็น aux ทั้งหมด · aux ทั้งหมด = ทำเป็นของจริง)
function toggleAuxSel(){
  const it = editItem(); if (!it || !it.spec) return;
  const objs = auxTargets(it, null);
  if (!objs.length) return flashBanner(pickedList().length ? "Auxiliary ใช้กับ point / link (shape เป็น Auxiliary ไม่ได้)" : "เลือก point / link ก่อนแล้วกด X — หรือกด X ระหว่างวาดเพื่อวาดแบบ Auxiliary");
  const on = !objs.every(o => Spec.isAux(specObj(it, o)));
  if (setAux(it, objs, on)) flashBanner(`${on ? "ทำเป็น Auxiliary" : "ทำเป็นของจริง"}: ${objs.map(o => o.id).join(", ")} (Ctrl+Z ย้อนได้)`);
}
function auxCheck(g, it, ref, obj, note){
  const cl = document.createElement("label"); cl.className = "check";
  cl.innerHTML = `<input type="checkbox"${Spec.isAux(obj) ? " checked" : ""}> Auxiliary (ช่วยสร้าง) <small>(${esc(note)})</small>`;
  const cb = cl.querySelector("input");
  cb.disabled = !canEdit(it);
  cb.onchange = () => { if (!setAux(it, [ref], cb.checked)) cb.checked = !cb.checked; };
  g.appendChild(cl);
}
// สลับ Auxiliary ของ point / link หลายชิ้นพร้อมกัน (Undo ก้อนเดียว) — คืน false ถ้าผู้ใช้ยกเลิก
//   ทำจุดเป็น aux แต่มี link จริงใช้อยู่ = ถาม "ทำ link พวกนี้เป็น Auxiliary ด้วย" / ยกเลิก
//   ทำ link เป็น aux แต่อยู่ใน shape = ถาม "เอา link ออกจาก shape" (shape อาจไม่ปิด = เตือน) / ยกเลิก
//   ทำเป็นของจริง = ทำได้เลย (link จริงที่ปลายเป็นจุด aux จะขึ้นเตือน + quick fix)
function setAux(it, objs, on){
  const sp = it.spec;
  // ทำ link เป็นของจริงแต่ปลายยังเป็นจุด aux = ถามว่าจะทำจุดปลายเป็นจุดจริงด้วยไหม (Cancel = เฉพาะ link → ขึ้นเตือน + quick fix)
  if (!on){
    const P = new Set(objs.filter(o => o.type === "dpt").map(o => o.id));
    const ends = [...new Set(objs.filter(o => o.type === "dlink").flatMap(o => Spec.linkEnds(Spec.byId(sp.links, o.id))))]
      .filter(id => !P.has(id) && Spec.isAuxPoint(sp, id));
    if (ends.length && confirm(`ปลายของ link เป็นจุด auxiliary: ${ends.join(", ")}\n\nOK = ทำจุดพวกนี้เป็นจุดจริงด้วย\nCancel = ทำเฉพาะ link (link จะขึ้นเตือนจนกว่าจะแก้)`))
      objs = objs.concat(ends.map(id => ({ type: "dpt", item: it.id, id })));
  }
  const pl = Spec.auxPlan(sp, objs, on);
  if (pl.hitLinks.length){
    const hit = pl.hitLinks.map(id => Spec.byId(sp.links, id)), pts = pl.points.filter(id => hit.some(l => Spec.linkEnds(l).includes(id)));
    if (!confirm(`${pts.join(", ")} เป็นปลายของ link จริง ${pl.hitLinks.join(", ")} — Civil 3D จะไม่มีจุดนี้\n\nOK = ทำ link พวกนี้เป็น Auxiliary ด้วย\nCancel = ยกเลิก`)) return false;
  }
  if (pl.shapes.length){
    const ls = pl.links.filter(id => sp.shapes.some(s => pl.shapes.includes(s.id) && s.links.includes(id)));
    if (!confirm(`${ls.join(", ")} อยู่ใน shape ${pl.shapes.join(", ")} — shape ใช้ link auxiliary ไม่ได้\n\nOK = เอา link ออกจาก shape (shape อาจไม่ปิด = เตือน)\nCancel = ยกเลิก`)) return false;
  }
  const n = pl.points.length + pl.links.length, what = n === 1 ? pl.points.concat(pl.links)[0] : `${n} objects`;
  specEdit(s => Spec.applyAux(s, pl, on), it, on ? `ทำ ${what} เป็น Auxiliary` : `ทำ ${what} เป็นของจริง`);
  renderProps(true);
  return true;
}

// ---------------- ตาราง Parameter แบบ SAC ----------------
// ชื่อ, ชนิด, default, display name, ขอบเขตค่า (นอกขอบเขต = ใช้ค่าขอบแทน + เตือน)
function propsParamTable(box, it){
  const sp = it.spec, ed_ = canEdit(it);
  const g = group(box, "Parameter ของส่วนที่วาด (แบบ SAC)", ed_ ? { label:"+ parameter", cmd: () => addSpecParam(it) } : null);
  if (sp.imported) div("hint", "parameter ของไฟล์เดิมใช้ในนิพจน์ได้เลย · ที่เพิ่มตรงนี้จะเขียนเป็นบรรทัด SA-DRAWING PARAM ตอน Save (Milestone 4)", g);
  if (!sp.params.length){ div("empty", "ยังไม่มี", g); return; }
  // การ์ดละ 1 parameter: [ชื่อ][ชนิด][×] / default · min · max / display name
  for (const p of sp.params){
    const card = div("pcard", null, g), isSide = !!(sp.side && sp.side.param === p.name);
    const r1 = div("pc1", null, card), r2 = div("pc3", null, card), r3 = div("pc1", null, card);
    const txt = (parent, label, v, on, cls) => {
      const l = document.createElement("label"); l.textContent = label;
      const i = document.createElement("input"); i.type = "text"; i.value = v ?? ""; i.disabled = !ed_; if (cls) i.className = cls;
      i.onchange = () => on(i.value.trim(), i);
      l.appendChild(i); parent.appendChild(l); return i;
    };
    txt(r1, "ชื่อ", p.name, (v, i) => renameSpecParam(it, p, v) || (i.value = p.name), "mono");
    const kl = document.createElement("label"); kl.textContent = "ชนิด";
    const k = document.createElement("select"); k.disabled = !ed_ || isSide;
    k.innerHTML = '<option value="double">double</option><option value="long">long</option>'; k.value = p.kind;
    k.onchange = () => specEdit(() => { p.kind = k.value; if (k.value === "long") p.default = Math.round(+p.default || 0); }, it);
    kl.appendChild(k); r1.appendChild(kl);
    const x = document.createElement("button"); x.textContent = "×"; x.title = isSide ? "parameter Side ใช้กลับด้าน ลบไม่ได้" : "ลบ parameter"; x.disabled = !ed_ || isSide;
    x.onclick = () => {
      const used = usesParam(sp, p.name);
      if (used.length && !confirm(`${p.name} ใช้อยู่ใน ${used.join(", ")} — ลบแล้วนิพจน์เหล่านั้นจะ error ตกลงไหม?`)) return;
      specEdit(() => { sp.params = sp.params.filter(o => o !== p); }, it);
    };
    r1.appendChild(x);
    const num = (label, v, on) => txt(r2, label, v == null ? "" : String(v), (s, i) => {
      if (s === "") return on(null);
      const n = Number(s);
      if (isNaN(n)){ alert("ใส่ตัวเลข"); i.value = v ?? ""; return; }
      on(n);
    }, "mono");
    num("default", p.default, n => specEdit(() => { p.default = n ?? 0; }, it));
    num("min", p.min, n => specEdit(() => { p.min = n; }, it)).placeholder = "ไม่จำกัด";
    num("max", p.max, n => specEdit(() => { p.max = n; }, it)).placeholder = "ไม่จำกัด";
    txt(r3, "display name", p.displayName, v => specEdit(() => { p.displayName = v || p.name; }, it));
  }
  if (sp.side) div("hint", `${sp.side.param} = 1 (Left) กลับด้านแนวราบทั้งหมด`, g);
}
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
// ชื่อที่โค้ดที่สร้างใช้เอง (ตรงกับ CodeGenerator.Reserved ฝั่ง server)
const RESERVED = new Set(("cs F Deg Pt Measure Source surface Math Point Link Shape ObjectId " +
  "Seg Arc Delta Polar SlopeLength SlopeToSurface OnSurface Between Intersect Tangent Rotate Arc3 ArcR Fillet Join AddPoint AddLink AddShape " +
  "FollowSurface Check Warn TargetSurface GetLong GetDouble Elevation abstract as base bool break byte case catch char checked class const continue " +
  "decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal " +
  "is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc " +
  "static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while var").split(" "));
function addSpecParam(it){
  const names = specNames(it);
  let i = 1; while (names.includes("Param" + i)) i++;
  specEdit(s => { s.params.push({ name: "Param" + i, kind: "double", default: 1, displayName: "Param" + i, min: null, max: null }); }, it);
}
// สร้าง parameter ใหม่จากค่าในช่องพิมพ์ (แบบ SAC): default = ค่าของช่องนั้นตอนนี้ · คืนชื่อ (ให้ช่องใช้ชื่อแทน) · ค่าผิด = null
function newParamFromValue(it, value, base){
  const r = drawRes[it.id], env = r && r.env ? r.env : {};
  let v;
  try{ v = Expr.value(String(value).trim() || "0", env); }catch(e){ flashBanner("สร้าง parameter ไม่ได้: " + e.message); return null; }
  const names = specNames(it);
  let name = base, i = 2; while (names.includes(name) || RESERVED.has(name)) name = base + i++;
  specEdit(s => { s.params.push({ name, kind: "double", default: +Expr.num(v), displayName: name, min: null, max: null }); }, it, `เพิ่ม parameter ${name}`);
  return name;
}
// object ที่ใช้ parameter นี้ในนิพจน์
function usesParam(sp, name){
  const out = [];
  for (const s of Spec.exprSlots(sp)){
    const r = Expr.check(String(s.obj[s.key]).replace(/^(-?)1:/, "$11/"), []);
    if (r.ast && Expr.vars(r.ast).has(name) && !out.includes(s.id)) out.push(s.id);
  }
  return out;
}
function renameSpecParam(it, p, v){
  if (v === p.name) return true;
  if (!IDENT.test(v)){ alert("ชื่อ parameter ต้องเป็นตัวอังกฤษ/ตัวเลข/_ และไม่ขึ้นต้นด้วยตัวเลข"); return false; }
  if (RESERVED.has(v) || /^([PpLlSs]\d+|surface\d+)$/.test(v)){ alert(`ตั้งชื่อ ${v} ไม่ได้ — โค้ดที่สร้างใช้ชื่อนี้เอง (เช่น F, P1, cs, double)`); return false; }
  if (specNames(it).includes(v) || Expr.FUNCS[v.toLowerCase()]){ alert(`มีชื่อ ${v} อยู่แล้ว (หรือเป็นชื่อฟังก์ชัน)`); return false; }
  const old = p.name, re = new RegExp(`\\b${old}\\b`, "g");
  specEdit(sp => {
    p.name = v; if (p.displayName === old) p.displayName = v;
    if (sp.side && sp.side.param === old) sp.side.param = v;
    for (const s of Spec.exprSlots(sp)) if (typeof s.obj[s.key] === "string") s.obj[s.key] = s.obj[s.key].replace(re, v);
    if (it.params && old in it.params){ it.params[v] = it.params[old]; delete it.params[old]; }
  }, it);
  return true;
}

// ---------------- แถบผลลัพธ์ (Messages / Log / Points) ----------------
function renderDock(){
  const it = selItem(), rr = it ? asmRes[it.id] : null;
  const dock = $("dock");
  dock.classList.toggle("closed", !state.dock.open);
  $("dock-toggle").textContent = state.dock.open ? "▾" : "▴";
  for (const b of dock.querySelectorAll("[data-tab]")) b.classList.toggle("cur", b.dataset.tab === state.dock.tab);
  for (const p of dock.querySelectorAll("[data-pane]")) p.classList.toggle("cur", p.dataset.pane === state.dock.tab);
  $("dock-of").textContent = it ? "· " + itemLabel(it) : "· เลือก subassembly เพื่อดูผล";

  const iss = $("issues"), tb = $("pt-table"), log = $("log");
  iss.innerHTML = ""; tb.innerHTML = "";
  let ne = 0, nw = 0;
  if (!it){ iss.innerHTML = '<div class="empty">เลือก subassembly ในต้นไม้หรือบนรูป</div>'; log.innerHTML = ""; }
  else {
    const add = (cls, text) => { div(cls, null, iss).textContent = text; cls === "e" ? ne++ : nw++; };
    if (rr && rr.attachState === "lost") add("w", "จุดเกาะ · " + rr.attachNote);
    if (result){
      for (const i of result.issues) add(i.level === "Severe" ? "e" : "w", `${i.level} · ${i.error} — ${i.message ?? ""}`);
      if (result.exception) add("e", `${result.exception.type} — ${result.exception.message}`);
    }
    // ส่วนที่วาด: มีผลรันโค้ดที่สร้างแล้ว ข้อความเตือนมาจากโค้ด C# (result.issues) ไม่ต้องซ้ำจาก JS
    if (drawRes[it.id] && !(rr && rr.generated && rr.result)) for (const i of drawRes[it.id].issues) add("w", "วาด · " + i.msg);
    const mis = it.spec ? csharpMismatch(it) : null;
    if (mis) add("e", "รูปที่วาด (JS) ไม่ตรงกับผลรันโค้ด C# ที่สร้าง — " + mis);
    if (it.specEdited) add("w", "ช่วง SA-DRAWING ในไฟล์ถูกแก้ด้วยมือ (ไม่ตรงกับ sa-spec) — Save (.cs) จะถามก่อนเขียนทับด้วยส่วนที่วาด");
    if (resp && !resp.ok) add("e", resp.stage === "compile" ? `คอมไพล์ไม่ผ่าน (${resp.diagnostics.filter(d => d.severity === "Error").length} error) — ดูกรอบแดง` : (resp.message || "ผิดพลาด"));
    for (const w of (resp && resp.ok ? resp.warnings : []) || []) add("w", `compiler ${w.id} (บรรทัด ${w.line}) — ${w.message}`);
    if (!iss.children.length) iss.innerHTML = '<div class="empty">ไม่มี error / warning</div>';
    log.textContent = result && result.log.length ? result.log.join("\n") : "";
    if (!log.textContent) log.innerHTML = '<span class="empty">ไม่มี output จาก Console.WriteLine</span>';
    if (result && !(rr && rr.generated)) result.points.forEach((p, i) => {
      const row = document.createElement("tr");
      if (i === hoverPt || isSel("pt", it.id, i)) row.className = "hl";
      row.innerHTML = `<td>${i}</td><td>${esc(p.codes.join(", ")) || "—"}</td><td class="n">${f3(p.x)}</td><td class="n">${f3(p.y)}</td>`;
      row.onmouseenter = () => { hoverPt = i; render(); };
      row.onmouseleave = () => { hoverPt = -1; render(); };
      row.onclick = () => setSel({ type:"pt", item: it.id, i });
      tb.appendChild(row);
    });
    const dr = drawRes[it.id];
    if (dr) for (const p of it.spec.points){
      const q = dr.pts[p.id], row = document.createElement("tr");
      if (isSel("dpt", it.id, p.id)) row.className = "hl";
      row.innerHTML = `<td>${p.id}</td><td>${esc(p.codes.join(", ")) || "—"}</td>` + (q && !q.err ? `<td class="n">${f3(q.x)}</td><td class="n">${f3(q.y)}</td>` : `<td colspan="2" class="n">⚠ หาไม่ได้</td>`);
      row.onclick = () => setSel({ type:"dpt", item: it.id, id: p.id });
      tb.appendChild(row);
    }
  }
  const nm = $("n-msg");
  nm.textContent = ne + nw ? String(ne + nw) : ""; nm.className = "badge" + (ne ? " e" : nw ? " w" : "");
  $("n-log").textContent = result && result.log.length ? String(result.log.length) : "";
  const npt = (result && !(rr && rr.generated) ? result.points.length : 0) + (it && it.spec ? it.spec.points.length : 0);
  $("n-pts").textContent = npt ? String(npt) : "";
}
$("dock").querySelector(".dock-tabs").addEventListener("click", e => {
  const b = e.target.closest("[data-tab]");
  if (b){ state.dock.tab = b.dataset.tab; state.dock.open = true; persist(); renderDock(); }
});
$("dock-toggle").onclick = () => { state.dock.open = !state.dock.open; persist(); renderDock(); };

// ---------------- กรอบแดง (compile error / exception ของตัวที่เลือก) ----------------
function renderProblem(){
  const box = $("problem");
  let html = "";
  if (resp && !resp.ok){
    if (resp.stage === "compile"){
      const errs = resp.diagnostics.filter(d => d.severity === "Error");
      html = `<h3>คอมไพล์ ${esc(resp.file)} ไม่ผ่าน (${errs.length} error)</h3>`;
      for (const d of resp.diagnostics)
        html += `<div class="d${d.severity === "Error" ? "" : " wn"}" data-line="${d.line}" data-col="${d.column}"><b>${esc(resp.file)}(${d.line},${d.column}) ${d.id}</b>  ${esc(d.message)}</div>`;
      if (resp.diagnostics.some(d => /CS0234|CS0246|CS0117|CS1061|CS0103|CS1501|CS7036/.test(d.id)))
        html += `<div class="help">error ที่บอกว่า "does not contain a definition" / "could not be found" มักแปลว่าโค้ดเรียก Civil 3D API ที่ตัวจำลองยังไม่มี — เพิ่มได้ในโฟลเดอร์ SA.Civil3DShim (หรือส่งชื่อฟังก์ชันให้ Claude เพิ่มให้)</div>`;
    } else html = `<h3>${esc(resp.message || "เกิดข้อผิดพลาด")}</h3>`;
  } else if (result && result.exception){
    const e = result.exception;
    const title = e.type === "Timeout" || e.type === "StackOverflow" ? `${esc(e.type)} — เว็บหยุดการรันให้แล้ว`
                : `${esc(e.type)} ระหว่าง ${esc(result.stage || "รัน")} (exception หลุดออกจากโค้ด)`;
    html = `<h3>${title}</h3><div class="d">${esc(e.message)}</div>`;
    for (const s of (e.stack || "").split("\n").filter(Boolean)){
      const m = /:line (\d+)/.exec(s);
      html += `<div class="d" style="color:var(--muted)"${m ? ` data-line="${m[1]}"` : ""}>${esc(s)}</div>`;
    }
  }
  if (html && editorActive() && /data-line/.test(html)) html += `<div class="help">คลิกบรรทัดที่มีเลขบรรทัดเพื่อไปที่โค้ดตรงนั้น</div>`;
  box.innerHTML = html;
  box.classList.toggle("bottom", !!(resp && resp.ok) || editorActive());
  box.style.display = html ? "block" : "none";
}

// ---------------- 5 · แถบล่าง ----------------
function renderXY(px, py){
  const a = curAsm();
  $("bar-xy").textContent = `Offset ${fz(offOf(wx(px), a)).padStart(8)}  Elev ${fz(elevOf(wy(py))).padStart(8)}`;
}
function renderBar(){
  const b = state.bar;
  for (const t of document.querySelectorAll("#bar [data-tg]")){
    const k = t.dataset.tg;
    t.classList.toggle("on", k === "codes" ? state.showCodes : !!b[k]);
  }
  // tooltip ของปุ่ม OSNAP บอกชนิดที่เปิดอยู่ (แบบ AutoCAD)
  const onKinds = OSNAP_ITEMS.filter(([k]) => b.osnap[k]).map(([, n]) => n);
  $("b-osnap").title = `Object snap เปิด/ปิดทั้งหมด (F3) — ตอนนี้${b.osOn ? "เปิด" : "ปิด"}\nชนิดที่เลือก: ${onKinds.join(", ") || "(ไม่มี)"}`
    + `${b.track ? "\n+ Object snap tracking (F11)" : ""}\n▾ หรือคลิกขวา = เลือกชนิด`;
  $("b-osmenu").classList.toggle("on", b.osOn);
  if (!$("osmenu").hidden) renderOsMenu();
  const gs = $("b-gsnap");
  gs.textContent = `Grid snap ${+b.gridStep} (F9)`;
  gs.title = `ปัดค่าเป็นทุก ${+b.gridStep} m (F9) — ตอนวาดจุดอิสระ (dx / dy / ระยะตามลาด) และตอนลาก surface / แกน / subassembly ที่ลอยอยู่\nไม่ใช่ object snap (ดูปุ่ม OSNAP) · ดับเบิลคลิก = ตั้งระยะ`;
  const sl = $("slopes"); sl.innerHTML = "";
  b.slopes.forEach((s, i) => {
    const x = document.createElement("button");
    x.className = "tg" + (b.slope === i ? " on" : ""); x.textContent = s;
    x.onclick = () => { b.slope = b.slope === i ? -1 : i; persist(); renderBar(); refreshSnap(); };
    x.ondblclick = () => {
      const v = prompt("slope สำเร็จรูป (แบบ 1:x ดิ่ง:ราบ)", s);
      if (v && /^\s*1\s*:\s*\d+(\.\d+)?\s*$/.test(v)){ b.slopes[i] = v.replace(/\s+/g, ""); persist(); renderBar(); }
      else if (v) alert("ใส่แบบ 1:1.5");
    };
    sl.appendChild(x);
  });
  $("ve").value = state.view.ve;
}
$("bar").addEventListener("click", e => {
  if (e.target.closest("#b-osmenu")) return toggleOsMenu();
  const t = e.target.closest("[data-tg]"); if (!t) return;
  const k = t.dataset.tg;
  if (k === "codes"){ state.showCodes = !state.showCodes; render(); }
  else { state.bar[k] = !state.bar[k]; if (k === "grid") render(); }
  persist(); renderBar(); refreshSnap();
});
const OSNAP_HELP = { end: "จุดที่วาด / จุดของโค้ดเดิม / origin", mid: "กึ่งกลาง link", cen: "ศูนย์กลางของโค้ง / polygon ด้านเท่า",
  int: "จุดตัดของ 2 link", perp: "ตั้งฉากจากจุดก่อนหน้าไปยัง link", near: "จุดบน link ที่ใกล้เมาส์",
  surf: "จุดบนผิวดินที่ใกล้เมาส์ (ล็อก slope อยู่ = จุดที่ลาดชนดิน)" };
const OSNAP_ITEMS = [["end", "Endpoint"], ["mid", "Midpoint"], ["cen", "Center"], ["int", "Intersection"],
                     ["perp", "Perpendicular"], ["near", "Nearest"], ["surf", "Surface"]];

// ---------------- เมนู OSNAP (▾ / คลิกขวาที่ปุ่ม OSNAP) ----------------
// แบบ status bar ของ AutoCAD: ติ๊กหลายชนิดต่อกันได้ เมนูไม่ปิด · คลิกข้างนอก / Esc = ปิด · เปลี่ยนแล้ว snap ที่เมาส์เดิมเปลี่ยนทันที
const osIcon = kind => `<svg viewBox="-11 -11 22 22" class="osic ${kind}" aria-hidden="true"><path d="${osnapMarker(kind, 0, 0)}"/></svg>`;
function renderOsMenu(){
  const m = $("osmenu"), b = state.bar;
  const row = (attr, on, icon, name, help) =>
    `<label class="osrow" title="${esc(help)}"><input type="checkbox" ${attr}${on ? " checked" : ""}>${icon}<span>${esc(name)}</span></label>`;
  m.innerHTML = (b.osOn ? "" : `<div class="osnote">OSNAP ปิดอยู่ (F3) — ติ๊กไว้ได้ จะมีผลเมื่อเปิด</div>`)
    + OSNAP_ITEMS.map(([k, n]) => row(`data-os="${k}"`, b.osnap[k], osIcon(k), n, OSNAP_HELP[k])).join("")
    + `<hr>` + row(`data-trk="1"`, b.track, osIcon("trk"), "Object snap tracking (F11)",
                   "ชี้ค้างบนจุด snap เพื่อจับเป็นจุดอ้างอิง (+) แล้วลากตามแนวราบ/ดิ่งของจุดนั้น หรือพิมพ์ dx dy จากจุดนั้น · ชี้ค้างซ้ำ = ปล่อย · Esc = ล้าง")
    + `<label class="trkms">ชี้ค้าง <input type="number" data-trkms="1" min="0.1" max="3" step="0.1" value="${(b.trackMs || 500) / 1000}"> วินาที</label>`
    + `<hr><div class="osbtns"><button data-all="1">เลือกทั้งหมด</button><button data-all="0">ล้างทั้งหมด</button></div>`;
}
function openOsMenu(){
  const m = $("osmenu"), r = $("b-osnap").getBoundingClientRect();
  renderOsMenu();
  m.hidden = false; $("b-osmenu").setAttribute("aria-expanded", "true");
  // แถบล่างอยู่ล่างสุด: เมนูเปิดขึ้นด้านบน
  m.style.left = Math.max(4, Math.min(r.left, innerWidth - m.offsetWidth - 4)) + "px";
  m.style.bottom = (innerHeight - r.top + 4) + "px";
}
function closeOsMenu(){ $("osmenu").hidden = true; $("b-osmenu").setAttribute("aria-expanded", "false"); }
function toggleOsMenu(){ $("osmenu").hidden ? openOsMenu() : closeOsMenu(); }
$("b-osnap").addEventListener("contextmenu", e => { e.preventDefault(); openOsMenu(); });
$("osmenu").addEventListener("change", e => {
  const t = e.target, b = state.bar;
  if (t.dataset.os) b.osnap[t.dataset.os] = t.checked;
  else if (t.dataset.trk){ b.track = t.checked; if (!b.track) trackClear(); }
  else if (t.dataset.trkms){ const s = +t.value; if (s > 0) b.trackMs = Math.round(Math.min(3, Math.max(0.1, s)) * 1000); }
  persist(); renderBar(); refreshSnap();
});
$("osmenu").addEventListener("click", e => {
  const t = e.target.closest("[data-all]"); if (!t) return;
  for (const [k] of OSNAP_ITEMS) state.bar.osnap[k] = t.dataset.all === "1";
  persist(); renderBar(); refreshSnap();
});
$("b-gsnap").ondblclick = () => {
  const v = prompt("ระยะ Grid snap (m)", state.bar.gridStep);
  if (v == null) return;
  const n = +v;
  if (!(n >= 0.001)) return alert("ใส่ตัวเลขตั้งแต่ 0.001 ขึ้นไป เช่น 0.05 หรือ 0.005");
  state.bar.gridStep = n; persist(); renderBar(); refreshSnap();
};
// F3 / F8 / F9 (เรียกจาก main.js)
function toggleBar(k){
  state.bar[k] = !state.bar[k];
  if (k === "track" && !state.bar.track) trackClear();
  // ซ่อน Auxiliary: เอาออกจากชุดที่เลือกด้วย (มองไม่เห็น = ไม่ควรถูกแก้โดยไม่รู้ตัว)
  if ((k === "aux" || k === "c3d") && !auxShown() && state.editing){
    const it = editItem(), sp = it && it.spec;
    if (sp) setSelList(selList().filter(o => !(o.item === it.id && (o.type === "dpt" || o.type === "dlink") && Spec.isAux(specObj(it, o)))));
  }
  persist(); renderBar(); refreshSnap(); render(); showBanner(barBanner(k));
}
function barBanner(k){
  const on = state.bar[k] ? "เปิด" : "ปิด";
  const t = { osOn: `OSNAP ${on}`, snap: `Grid snap ${on} (${+state.bar.gridStep} m)`, ortho: `Ortho ${on}`, track: `Object snap tracking ${on}`,
              aux: state.bar.aux ? "แสดง Auxiliary" : "ซ่อน Auxiliary (snap / คลุมเลือกไม่ได้จนกว่าจะแสดง)",
              c3d: state.bar.c3d ? "ดูแบบ Civil 3D: เห็นเฉพาะที่จะส่งออกไปจริง (ซ่อน Auxiliary)" : "เลิกดูแบบ Civil 3D" }[k];
  setTimeout(() => { if ($("banner").textContent === t) showBanner(draw.tool ? drawBanner() : ""); }, 1200);
  return t;
}
$("ve").onchange = () => { state.view.ve = +$("ve").value; persist(); render(); };
$("b-fit").onclick = fit;

// ---------------- 3 · เมนูไฟล์ ----------------
$("m-file").onclick = () => { const d = $("dd-file"); const h = d.hidden; closeMenus(); d.hidden = !h; };
$("dd-file").addEventListener("click", e => {
  const b = e.target.closest("[data-cmd]"); if (!b || b.disabled) return;
  closeMenus();
  ({ "import": () => openImport(), "new-cs": () => newCs(), "open-proj": openProject, "save-proj": () => WS().name ? saveProject(WS().name) : saveProjectAs(),
     "save-proj-as": saveProjectAs, "new-proj": newProject, "sc-export": exportScenarios, "sc-import": () => $("f-import").click() })[b.dataset.cmd]();
});
function renderProjName(){
  $("proj-name").innerHTML = WS().name ? `project: <b>${esc(WS().name)}</b>` : "project: (ยังไม่ได้บันทึก)";
}

// ---------------- หน้าต่าง ----------------
function openDialog(title, build){
  $("dlg-title").textContent = title;
  const b = $("dlg-body"); b.innerHTML = "";
  build(b);
  $("modal").hidden = false;
}
function closeDialog(){ $("modal").hidden = true; }
$("dlg-x").onclick = closeDialog;
$("modal").addEventListener("pointerdown", e => { if (e.target === $("modal")) closeDialog(); });

// Import .cs: ไฟล์ในโฟลเดอร์ / เปิดจากเครื่อง / สร้างใหม่จาก template
let importTarget = null;
function openImport(asmId){
  importTarget = asmId || curAsm().id;
  openDialog("Import .cs เข้า workspace", b => {
    const row = div("row", `<label>เข้า assembly</label>`, b);
    const sel = document.createElement("select");
    sel.innerHTML = asms().map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
    sel.value = importTarget; sel.onchange = () => importTarget = sel.value;
    row.appendChild(sel);
    div("pg-h", `ไฟล์ในโฟลเดอร์ <span class="mono">${esc($("folder").textContent)}</span>`, b);
    const list = div("flist", null, b);
    if (!files.length) div("empty", "ไม่มีไฟล์ .cs ในโฟลเดอร์", list);
    const used = new Set(allItems().map(i => i.file));
    for (const f of files){
      const x = btn("", () => { closeDialog(); loadSpecFromFile(addItem({ file: f.name }, asmById(importTarget))); });
      x.innerHTML = `${esc(f.name)}<small>${used.has(f.name) ? "มีใน workspace แล้ว · " : ""}${(f.size / 1024).toFixed(1)} KB</small>`;
      list.appendChild(x);
    }
    div("btns", null, b).append(
      btn("เปิดจากเครื่อง…", () => { closeDialog(); openFromDisk(); }, false, "เปิดไฟล์ .cs จากที่อื่น (Chrome/Edge ติดตามการ Save ไฟล์นั้นให้)"),
      btn("+ สร้างไฟล์ใหม่จาก template…", () => { closeDialog(); newCs(); }));
    div("hint", "ตัวแรกของ assembly จะเกาะแกนให้เอง ตัวต่อไปลอยอยู่เหนือแกน ลากไปปล่อยที่แกนหรือจุดของตัวอื่นเพื่อเกาะ", b);
  });
}
async function openFromDisk(){
  const target = asmById(importTarget) || curAsm();
  const use = o => { opened = o; addItem({ sourceName: o.name, source: o.text }, target); };
  if (window.showOpenFilePicker){
    try{
      const [handle] = await window.showOpenFilePicker({ types:[{ description:"C# source", accept:{ "text/plain":[".cs"] } }] });
      const f = await handle.getFile();
      use({ name: f.name, text: await f.text(), handle, lastModified: f.lastModified });
    }catch(e){ /* ยกเลิก */ }
  } else { $("f-open").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      e.target.value = "";
      use({ name: f.name, text: await f.text(), handle: null, lastModified: f.lastModified });
    };
    $("f-open").click();
  }
}
async function newCs(){
  const name = prompt("ชื่อไฟล์ .cs ใหม่ (สร้างในโฟลเดอร์ของ viewer)", "new-subassembly");
  if (!name) return;
  const r = await fetch("/api/new", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
    .then(r => r.json()).catch(() => ({ ok: false, message: NO_SERVER }));
  if (!r.ok){ alert(r.message); return; }
  await poll();
  addItem({ file: r.file }, asmById(importTarget) || curAsm());
  if (!ed.open) openEditor();
}

// ---------------- project (.assembly.json) ----------------
// assembly เดียว -> เขียนรูปแบบเดิม (version 1) ให้ viewer รุ่นก่อนเปิดได้; หลาย assembly -> version 2
function projContent(){
  const items = a => a.items.map(it => ({ id: it.id, file: it.file, sourceName: it.sourceName, source: it.file ? undefined : it.source,
                                          name: it.name, className: it.className, params: it.params, attach: it.attach,
                                          fileName: it.fileName, spec: it.spec, savedSpec: it.savedSpec, generatedFile: it.generatedFile }));
  const common = { originElevation: state.originElevation, surface: state.surface, surfaceOn: state.surfaceOn, layout: state.layout,
                   extendEnds: state.extendEnds, bar: state.bar };
  if (asms().length === 1){ const a = asms()[0]; return { version: 1, baseline: a.baseline, name: a.name, ...common, items: items(a) }; }
  return { version: 2, ...common, assemblies: asms().map(a => ({ id: a.id, name: a.name, baseline: a.baseline, items: items(a) })) };
}
function loadProjContent(c, name){
  History.act(name ? `โหลด ${name}` : "โหลด workspace");
  if (c.originElevation != null) state.originElevation = c.originElevation;
  if (c.surface) state.surface = c.surface;
  if (c.surfaceOn != null) state.surfaceOn = c.surfaceOn;
  if (c.layout != null) state.layout = !!c.layout;
  if (c.extendEnds != null) state.extendEnds = c.extendEnds;
  if (c.bar) state.bar = Object.assign(defaultBar(), c.bar, { osnap: Object.assign(defaultBar().osnap, c.bar.osnap) });
  const fix = list => (list || []).map(it => ({ params: {}, ...it, id: it.id || newId() }));
  WS().assemblies = c.assemblies
    ? c.assemblies.map((a, i) => ({ id: a.id || newId("a"), name: a.name || "Assembly " + (i + 1), baseline: a.baseline || { x:0, y:0 }, items: fix(a.items) }))
    : [{ id: newId("a"), name: c.name || "Assembly 1", baseline: c.baseline || { x:0, y:0 }, items: fix(c.items) }];
  allItems().forEach(normItem);   // spec รุ่นก่อน (construction) -> auxiliary
  WS().name = name; state.editing = null; asmRes = {};
  renderBar(); setSel({ type:"ws" }); run();
  setTimeout(fit, 500);
}
function openProject(){
  openDialog("Open project", b => {
    div("pg-h", "ไฟล์ .assembly.json ในโฟลเดอร์", b);
    const list = div("flist", null, b);
    if (!projFiles.length) div("empty", "ยังไม่มีไฟล์ project ในโฟลเดอร์", list);
    for (const f of projFiles){
      const x = btn("", async () => {
        if (allItems().length && !confirm(`เปิด ${f.name}? workspace ตอนนี้จะถูกแทนที่ (ส่วนที่ยังไม่ได้บันทึกจะหายไป)`)) return;
        closeDialog();
        const r = await fetch("/api/assembly-file?name=" + encodeURIComponent(f.name)).catch(() => null);
        if (!r || !r.ok){ alert("เปิดไฟล์ไม่สำเร็จ"); return; }
        loadProjContent(await r.json(), f.name);
      });
      x.innerHTML = `${esc(f.name)}<small>${f.name === WS().name ? "เปิดอยู่" : ""}</small>`;
      list.appendChild(x);
    }
    div("hint", "ไฟล์จากโหมด Assembly เดิมเปิดได้ (1 ไฟล์ = 1 assembly) · project ที่มีหลาย assembly บันทึกเป็นรูปแบบใหม่ในไฟล์เดียวกัน", b);
  });
}
async function saveProject(name){
  const r = await fetch("/api/assembly-file", { method:"POST", headers:{ "Content-Type":"application/json" },
                         body: JSON.stringify({ name, content: projContent() }) }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : { message: NO_SERVER };
  if (!r || !r.ok){ alert(j.message || "บันทึกไม่สำเร็จ"); return; }
  WS().name = j.name; persist(); await poll(); renderAll();
  setStatus("ok", "บันทึก " + j.name + " แล้ว");
}
function saveProjectAs(){
  const n = prompt("ชื่อไฟล์ project (บันทึกเป็น ชื่อ.assembly.json ในโฟลเดอร์)", (WS().name || "project").replace(/\.assembly\.json$/i, ""));
  if (!n) return;
  if (projFiles.some(f => f.name.toLowerCase() === (n.replace(/\.assembly\.json$/i, "") + ".assembly.json").toLowerCase()) && n + ".assembly.json" !== WS().name
      && !confirm(`มีไฟล์ ${n}.assembly.json อยู่แล้ว เขียนทับ?`)) return;
  saveProject(n);
}
function newProject(){
  if (allItems().length && !confirm("เริ่ม project ใหม่? (ส่วนที่ยังไม่ได้บันทึกจะหายไป)")) return;
  loadProjContent({ baseline: asms()[0] ? asms()[0].baseline : { x:0, y:0 } }, null);
}

// ---------------- scenarios ----------------
// กรณีที่บันทึกจากเว็บรุ่นก่อน (ไฟล์เดียว / assembly) โหลดได้ โดยแปลงเป็น workspace
let scenarios = store.get("sav2.scenarios", []);
const saveScenarios = () => store.set("sav2.scenarios", scenarios);
const snapshot = name => ({ name, ws: projContent(), file: `${allItems().length} subassembly` });
function loadScenario(s){
  if (s.ws) return loadProjContent(JSON.parse(JSON.stringify(s.ws)), WS().name);
  if (s.asm) return loadProjContent(JSON.parse(JSON.stringify(s.asm)), WS().name);
  // ไฟล์เดียวแบบเดิม: origin อยู่ที่ (0, 0) = แกน assembly
  loadProjContent({ baseline: { x:0, y:0 }, surface: s.surface, surfaceOn: s.surfaceOn, layout: s.layout, originElevation: s.originElevation,
                    items: s.file ? [{ id: newId(), file: s.file, params: { ...(s.values || {}) }, attach: { type:"baseline", x:0, y:0 } }] : [] }, WS().name);
}
function renderScenarios(){
  const box = $("sc-list"); box.innerHTML = "";
  if (!scenarios.length){ box.innerHTML = '<div class="empty">ยังไม่มีกรณีที่บันทึกไว้</div>'; return; }
  scenarios.forEach((s, i) => {
    const row = document.createElement("div");
    const name = document.createElement("span");
    name.innerHTML = `${esc(s.name)}<small>${esc(s.file || "")}</small>`; name.title = "โหลดกรณีนี้ (แทนที่ workspace)";
    name.onclick = () => loadScenario(s);
    const del = document.createElement("button"); del.textContent = "×"; del.title = "ลบ";
    del.onclick = () => { scenarios.splice(i, 1); saveScenarios(); renderScenarios(); };
    row.append(name, del); box.appendChild(row);
  });
}
$("b-save").onclick = () => {
  const name = prompt("ตั้งชื่อกรณีนี้", "กรณี " + (scenarios.length + 1));
  if (!name) return;
  scenarios.push(snapshot(name)); saveScenarios(); renderScenarios();
};
function exportScenarios(){
  const blob = new Blob([JSON.stringify(scenarios, null, 2)], { type:"application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "scenarios.json"; a.click();
  URL.revokeObjectURL(a.href);
}
$("f-import").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => {
    try{ const arr = JSON.parse(t); if (Array.isArray(arr)){ scenarios = scenarios.concat(arr); saveScenarios(); renderScenarios(); } }
    catch{ alert("ไฟล์ไม่ใช่ JSON ของ scenarios"); }
  });
  e.target.value = "";
};
