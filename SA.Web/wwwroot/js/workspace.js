// workspace กลางจอ: ส่งไป server, วาดรูป, เมาส์ (ลาก surface / แกน / subassembly, เกาะจุด), แก้รายการ subassembly
"use strict";

// ---------------- ส่งไป server ----------------
// แต่ละ assembly ส่ง /api/assembly แยกกัน (แกนคนละตัว) แต่ใช้ surface ชุดเดียวกัน
let inFlight = false, pending = false;
const sentSpec = {};          // item id -> spec ที่ส่งไปรอบล่าสุด (ไว้รู้ว่าผล C# ตรงกับ spec ปัจจุบันไหม)

function asmBody(a){
  return {
    baseline: a.baseline, datum: state.originElevation,
    surface: state.surface, surfaceAssigned: state.surfaceOn, extendEnds: state.extendEnds, layoutMode: state.layout,
    // ส่วนที่วาด (spec) ส่งไปด้วย: server สร้างโค้ด C# แล้วรันกับตัวจำลอง (preview ด้วย Roslyn)
    //   ยังไม่มีไฟล์ = ทั้งไฟล์จาก spec · ไฟล์ที่มีช่วง SA-DRAWING = แทนที่ช่วงนั้นก่อนรัน
    items: a.items.filter(it => hasCode(it) || it.spec).map(it => {
      const attach = drag && drag.type === "item" && drag.id === it.id ? drag.attach : it.attach;
      const o = { id: it.id, className: it.className || null, params: it.params || {}, attach };
      if (it.spec){ o.spec = it.spec; o.fileName = it.file || it.fileName; sentSpec[it.id] = JSON.stringify(it.spec); }
      if (!hasCode(it)) return o;
      const name = it.file || it.sourceName;
      // โค้ดในแถบแก้ (รวมส่วนที่ยังไม่บันทึก) ใช้กับทุกตัวที่มาจากไฟล์เดียวกัน
      if (editorActive() && ed.name === name && (it.file ? ed.kind === "folder" : ed.kind !== "folder")){ o.source = E.get(); o.sourceName = name; }
      else if (it.file) o.file = it.file;
      else { o.source = opened && opened.name === it.sourceName ? opened.text : it.source; o.sourceName = it.sourceName; }
      return o;
    })
  };
}

function run(){
  if (inFlight){ pending = true; return; }
  const list = asms().filter(a => a.items.some(it => hasCode(it) || it.spec));
  if (!list.length){ asmRes = {}; setStatus("ok", "workspace ว่าง"); renderAll(); return; }
  inFlight = true;
  const t0 = performance.now();
  const bodies = list.map(asmBody), sent = { ...sentSpec };
  Promise.all(bodies.map(b => fetch("/api/assembly", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(b) })
                              .then(r => r.json())))
    .then(rs => {
      asmRes = {};
      for (const r of rs) for (const x of r.items){ asmRes[x.id] = x; x.specJson = sent[x.id]; }
      // จำตำแหน่งจุดเกาะล่าสุด (ใช้เป็นตำแหน่งสำรองเมื่อหาจุดเกาะไม่เจอ)
      for (const it of allItems()){
        const x = asmRes[it.id];
        if (x && x.attachState !== "lost" && !(drag && drag.id === it.id)){ it.attach.x = x.originX; it.attach.y = x.originY; }
      }
      const n = allItems().length, bad = allItems().filter(it => itemStatus(it.id) === "e").length;
      setStatus(bad ? "busy" : "ok", `${n} subassembly${bad ? ` · ${bad} มีปัญหา` : ""} · ${(performance.now() - t0).toFixed(0)} ms`);
      if (!drag) persist();
      renderAll();
    })
    .catch(() => setStatus("off", NO_SERVER))
    .finally(() => { inFlight = false; if (pending){ pending = false; run(); } });
}
function changed(){ persist(); render(); renderProps(); run(); }

// แปลงผลของตัวที่เลือกเป็น resp/result แบบเดิม เพื่อใช้กับกรอบแดง / เส้นหยักในแถบโค้ด / แถบผลลัพธ์
// จุดแสดงเทียบ origin ของตัวที่เลือก (ค่าเดียวกับที่โค้ดส่งให้ Points.Add)
function mapSelected(){
  const r = selItemId() ? asmRes[selItemId()] : null;
  if (!r){ resp = null; result = null; return; }
  resp = { ok: r.ok, file: r.file, stage: r.stage, message: r.message, diagnostics: r.diagnostics || [],
           classes: r.classes || [], warnings: r.ok ? (r.diagnostics || []) : [] };
  result = r.result ? { ...r.result, points: r.result.points.map(p => ({ x: p.x - r.originX, y: p.y - r.originY, codes: p.codes })) } : null;
}

// ---------------- วาด ----------------
function niceStep(pxPerUnit){
  for (const s of [0.05,0.1,0.2,0.5,1,2,5,10,20,50,100]) if (s * pxPerUnit >= 34) return s;
  return 200;
}
const ptsPath = (P, idx) => idx.map((k, j) => (j ? "L" : "M") + sx(P[k].x) + " " + sy(P[k].y)).join(" ");

function render(){
  const r = main.getBoundingClientRect();
  W = r.width; H = r.height;
  cssCache = null;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = "";
  svg.classList.toggle("add", addMode);

  // grid: แนวราบวัดจากแกนของ assembly ที่เลือก, แนวดิ่งเป็นระดับจริง
  const g = el("g", {}, svg);
  const ca = curAsm(), bx = ca.baseline.x;
  const stepX = niceStep(state.view.scale), stepY = niceStep(state.view.scale * state.view.ve);
  for (let k = Math.floor((wx(0) - bx) / stepX); bx + k * stepX <= wx(W); k++){
    const x = bx + k * stepX, major = Math.abs(k % 5) === 0;
    if (state.bar.grid) el("line", {x1:sx(x), x2:sx(x), y1:0, y2:H, class: major ? "g-major" : "g-minor"}, g);
    if (major) el("text", {x:sx(x)+3, y:H-6, class:"g-lbl"}, g).textContent = +(k * stepX).toFixed(2);
  }
  for (let k = Math.floor(elevOf(wy(H)) / stepY); k * stepY - state.originElevation <= wy(0); k++){
    const y = k * stepY - state.originElevation, major = Math.abs(k % 5) === 0;
    if (state.bar.grid) el("line", {x1:0, x2:W, y1:sy(y), y2:sy(y), class: major ? "g-major" : "g-minor"}, g);
    if (major) el("text", {x:4, y:sy(y)-3, class:"g-lbl"}, g).textContent = +(k * stepY).toFixed(2);
  }

  const pts = state.surface;
  if (pts.length >= 2 && state.surfaceOn){
    const a = pts[0], z = pts[pts.length-1];
    const fd = state.extendEnds
      ? `M0 ${sy(a.y)} L` + pts.map(p => sx(p.x) + " " + sy(p.y)).join(" L") + ` L${W} ${sy(z.y)} L${W} ${H} L0 ${H} Z`
      : "M" + pts.map(p => sx(p.x) + " " + sy(p.y)).join(" L") + ` L${sx(z.x)} ${H} L${sx(a.x)} ${H} Z`;
    el("path", {d: fd, class:"gnd-fill"}, svg);
  }
  for (const a of asms()) el("line", {x1:sx(a.baseline.x), x2:sx(a.baseline.x), y1:0, y2:H, class:"bl-line"}, svg);

  const s = state.sel, selId = selItemId(), editing = state.editing;
  // subassembly ที่เลือก (ตัวเดียว หรือหลายตัวแบบ multi)
  const selIds = new Set(selList().map(x => x.item).filter(Boolean));
  const dragId = drag && drag.type === "item" ? drag.id : null;
  evalAll();
  for (const it of allItems()){
    const rr = asmRes[it.id], dr = drawRes[it.id];
    const res = rr && rr.result ? rr.result : null, P = res ? res.points : [];
    if (!res && !dr) continue;
    const isSel = selIds.has(it.id);
    let cls = "item";
    if (editing) cls += it.id === editing ? " editing-item" : " locked";
    else if (selIds.size && !isSel && dragId !== it.id) cls += " dim";
    if (!editing && isSel && s.type === "multi") cls += " picked";
    if (dragId === it.id) cls += " drag";
    const grp = el("g", {class: cls}, svg);
    if (dr) renderSpec(it, dr, grp, isSel);
    // โค้ดที่สร้างจาก spec: รูปที่เห็นมาจาก JS (เร็วกว่า) ผล C# ใช้ตรวจ/เกาะจุดเท่านั้น จึงไม่วาดซ้ำ
    if (!res || rr.generated) continue;
    res.shapes.forEach((sh, i) => {
      if (sh.polygon) el("polygon", {points: sh.polygon.map(k => sx(P[k].x)+","+sy(P[k].y)).join(" "), class:"shape item-hit", "data-kind":"shape", "data-id":it.id, "data-i":i}, grp);
    });
    res.links.forEach((l, i) => {
      const d = ptsPath(P, l.pts);
      el("path", {d, class:"link", stroke: colorFor(primaryCode(l.codes))}, grp);
      el("path", {d, class:"link-hit", "data-kind":"link", "data-id":it.id, "data-i":i}, grp);
    });
    P.forEach((p, i) => {
      el("circle", {cx:sx(p.x), cy:sy(p.y), r:3.6, class:"pt" + (isSel && i === hoverPt ? " hl" : ""), "data-kind":"pt", "data-id":it.id, "data-i":i}, grp);
      if (state.showCodes && isSel && p.codes.length)
        el("text", {x:sx(p.x)+7, y:sy(p.y)-7, class:"pt-lbl"}, grp).textContent = p.codes.join(", ");
    });
    // object ที่เลือก (จุด / link / shape) เน้นสีด้านบน
    if (isSel){
      if (s.type === "shape" && res.shapes[s.i] && res.shapes[s.i].polygon)
        el("polygon", {points: res.shapes[s.i].polygon.map(k => sx(P[k].x)+","+sy(P[k].y)).join(" "), class:"sel-shape"}, svg);
      else if (s.type === "link" && res.links[s.i]) el("path", {d: ptsPath(P, res.links[s.i].pts), class:"sel-link"}, svg);
      else if (s.type === "pt" && P[s.i]) el("circle", {cx:sx(P[s.i].x), cy:sy(P[s.i].y), r:8, class:"sel-pt"}, svg);
    }
  }

  if (pts.length >= 2){
    const d = pts.map((p,i) => (i ? "L" : "M") + sx(p.x) + " " + sy(p.y)).join(" ");
    el("path", {d, class:"gnd" + (state.surfaceOn ? "" : " off"), style:"pointer-events:none"}, svg);
    if (state.extendEnds){
      const a = pts[0], z = pts[pts.length-1];
      el("path", {d:`M0 ${sy(a.y)} L${sx(a.x)} ${sy(a.y)} M${sx(z.x)} ${sy(z.y)} L${W} ${sy(z.y)}`, class:"gnd ext", style:"pointer-events:none"}, svg);
    }
    el("path", {d, class:"gnd-hit", "data-kind":"seg"}, svg);
    const z = pts[pts.length-1];
    el("text", {x: Math.min(sx(z.x), W - 8) - 4, y: sy(z.y) + 20, class:"gnd-lbl", "text-anchor":"end"}, svg).textContent = "Surface: EG";
  }

  // origin ◇ ของแต่ละตัว
  for (const it of allItems()){
    if (editing && it.id !== editing) continue;
    const rr = hasCode(it) ? asmRes[it.id] : null, org = itemOrigin(it);
    const dragging = dragId === it.id;
    const ox = dragging ? drag.ox : org.x;
    const oy = dragging ? drag.oy : org.y;
    const st = dragging ? drag.attach.type : (rr ? rr.attachState : it.attach.type);
    const z = selIds.has(it.id) ? 7 : 5.5;
    el("path", {d:`M${sx(ox)} ${sy(oy)-z} L${sx(ox)+z} ${sy(oy)} L${sx(ox)} ${sy(oy)+z} L${sx(ox)-z} ${sy(oy)} Z`,
      class:"org" + (st === "free" ? " free" : st === "lost" ? " lost" : ""), "data-kind":"item", "data-id":it.id}, svg);
  }

  if (drag && drag.type === "item" && drag.moved){
    for (const c of drag.cands){
      const hot = drag.hot === c;
      el("circle", {cx:sx(c.x), cy:sy(c.y), r: hot ? 10 : 6, class:"snap" + (hot ? " hot" : "")}, svg);
      if (hot) el("text", {x:sx(c.x)+12, y:sy(c.y)+16, class:"snap-lbl"}, svg).textContent = c.label;
    }
  }

  for (const a of asms()){
    const bx = a.baseline.x, by = a.baseline.y;
    el("rect", {x:sx(bx)-7, y:sy(by)-7, width:14, height:14, rx:3, class:"bl" + (s.type === "asm" && s.asm === a.id ? " sel" : ""), "data-kind":"baseline", "data-asm":a.id}, svg);
    // ชื่อแกนไว้บนสุดของเส้นแกน ไม่ทับ point code ที่อยู่รอบ origin
    el("text", {x:sx(bx)+6, y:16, class:"bl-lbl"}, svg).textContent = `⊞ ${a.name} · ${f3(elevOf(by))}`;
  }

  state.surface.forEach((p, i) => {
    el("rect", {x:sx(p.x)-5, y:sy(p.y)-5, width:10, height:10, rx:2, class:"h" + (s.type === "spt" && s.i === i ? " sel" : ""), "data-kind":"h", "data-i":i}, svg);
  });

  renderCodeHot();
  renderDrawOverlay();
  renderCmdOverlay();
  renderSelBox();
  $("welcome").style.display = allItems().length ? "none" : "flex";
  renderLegend();
}

// ส่วนที่วาด (DrawingSpec) ของ item: เส้นทึบหนากว่าของโค้ด จุดเป็นสี่เหลี่ยม ป้าย P1/L1 แสดงตอนแก้อยู่
function renderSpec(it, r, grp, isSel){
  const spec = it.spec, X = p => sx(r.ox + p.x), Y = p => sy(r.oy + p.y), s = state.sel;
  const editingThis = state.editing === it.id;
  for (const sh of spec.shapes){
    const q = r.shapes[sh.id];
    if (q && q.poly) el("polygon", {points: q.poly.map(p => X(p) + "," + Y(p)).join(" "), class:"shape item-hit dshape", "data-kind":"dshape", "data-id":it.id, "data-sid":sh.id}, grp);
  }
  for (const l of spec.links){
    const q = r.links[l.id];
    if (!q || q.err) continue;
    const d = q.path.map((p, j) => (j ? "L" : "M") + X(p) + " " + Y(p)).join(" ");
    el("path", {d, class:"link dlink" + (l.type === "followSurface" ? " follow" : ""), stroke: colorFor(primaryCode(l.codes))}, grp);
    el("path", {d, class:"link-hit", "data-kind":"dlink", "data-id":it.id, "data-sid":l.id}, grp);
    if (editingThis){ const a = q.path[0], b = q.path[q.path.length - 1]; el("text", {x:(X(a)+X(b))/2 + 4, y:(Y(a)+Y(b))/2 - 4, class:"d-lbl"}, grp).textContent = l.id; }
  }
  for (const p of spec.points){
    const q = r.pts[p.id];
    if (!q || q.err) continue;
    el("rect", {x:X(q)-4, y:Y(q)-4, width:8, height:8, class:"dpt", "data-kind":"dpt", "data-id":it.id, "data-sid":p.id}, grp);
    const lbl = [editingThis ? p.id : "", state.showCodes && (isSel || editingThis) ? p.codes.join(", ") : ""].filter(Boolean).join(" ");
    if (lbl) el("text", {x:X(q)+7, y:Y(q)+14, class:"pt-lbl d-lbl"}, grp).textContent = lbl;
  }
  if (!isSel) return;
  for (const o of selList()){
    if (o.item !== it.id) continue;
    if (o.type === "dshape" && r.shapes[o.id] && r.shapes[o.id].poly) el("polygon", {points: r.shapes[o.id].poly.map(p => X(p) + "," + Y(p)).join(" "), class:"sel-shape"}, svg);
    else if (o.type === "dlink" && r.links[o.id] && r.links[o.id].path) el("path", {d: r.links[o.id].path.map((p, j) => (j ? "L" : "M") + X(p) + " " + Y(p)).join(" "), class:"sel-link"}, svg);
    else if (o.type === "dpt" && r.pts[o.id] && !r.pts[o.id].err) el("circle", {cx:X(r.pts[o.id]), cy:Y(r.pts[o.id]), r:9, class:"sel-pt"}, svg);
  }
}

// ---------------- คลุมเลือก (Window / Crossing) ----------------
// object ที่คลุมเลือกได้ เป็น px บนจอ: Edit mode = point / link / shape ที่วาดของตัวที่แก้ · นอก Edit = subassembly ทั้งตัว
function pickables(){
  const out = [];
  const drawnGeoms = (it, r) => {
    const X = p => ({ x: sx(r.ox + p.x), y: sy(r.oy + p.y) }), sp = it.spec, g = [];
    for (const p of sp.points){ const q = r.pts[p.id]; if (q && !q.err) g.push({ sel:{ type:"dpt", item: it.id, id: p.id }, geoms:[{ pts:[X(q)] }] }); }
    for (const l of sp.links){ const q = r.links[l.id]; if (q && !q.err && q.path) g.push({ sel:{ type:"dlink", item: it.id, id: l.id }, geoms:[{ pts: q.path.map(X) }] }); }
    for (const s of sp.shapes){ const q = r.shapes[s.id]; if (q && q.poly) g.push({ sel:{ type:"dshape", item: it.id, id: s.id }, geoms:[{ pts: q.poly.map(X), closed: true }] }); }
    return g;
  };
  if (state.editing){
    const it = editItem(), r = it && drawRes[it.id];
    return it && it.spec && r ? drawnGeoms(it, r) : out;
  }
  for (const it of allItems()){
    const rr = asmRes[it.id], res = rr && rr.result, geoms = [];
    if (res && !rr.generated){
      const P = res.points.map(p => ({ x: sx(p.x), y: sy(p.y) }));
      P.forEach(p => geoms.push({ pts:[p] }));
      res.links.forEach(l => geoms.push({ pts: l.pts.map(k => P[k]) }));
    }
    const r = drawRes[it.id];
    if (it.spec && r) for (const o of drawnGeoms(it, r)) geoms.push(...o.geoms);
    if (!geoms.length){ const o = itemOrigin(it); geoms.push({ pts:[{ x: sx(o.x), y: sy(o.y) }] }); }
    out.push({ sel:{ type:"item", item: it.id }, geoms });
  }
  return out;
}
function renderSelBox(){
  if (!drag || drag.type !== "box" || !drag.moved) return;
  const b = Select.box(drag.px, drag.py, drag.qx, drag.qy), cross = Select.mode(drag.px, drag.qx) === "crossing";
  el("rect", { x: b.l, y: b.t, width: b.r - b.l, height: b.b - b.t, class:"selbox" + (cross ? " cross" : "") }, svg);
}
function endSelBox(d, shift){
  const b = Select.box(d.px, d.py, d.qx, d.qy);
  const hits = Select.pick(pickables(), b, Select.mode(d.px, d.qx) === "crossing");
  pickAdd(hits, shift);
}

function renderLegend(){
  const lg = $("legend"); lg.innerHTML = "";
  // เลือก subassembly อยู่ = แสดงเฉพาะ code ของตัวนั้น (ทั้ง workspace มี code เยอะจนบังรูป)
  const codes = new Set(), ids = selItemId() ? [selItemId()] : allItems().map(i => i.id);
  for (const id of ids){
    const x = asmRes[id] && asmRes[id].result, it = itemById(id);
    if (x) x.links.forEach(l => codes.add(primaryCode(l.codes)));
    if (it && it.spec) it.spec.links.forEach(l => codes.add(primaryCode(l.codes)));
  }
  for (const c of codes){
    const s = document.createElement("span");
    s.innerHTML = `<i style="background:${colorFor(c)}"></i>${esc(c || "(no code)")}`;
    lg.appendChild(s);
  }
}

// ---------------- แก้รายการ subassembly ----------------
// ตัวแรกของ assembly เกาะแกนเอง (เหมือนเปิดไฟล์เดียวแบบเดิม) ตัวต่อไปลอยอยู่เหนือแกน ให้ผู้ใช้ลากไปเกาะ
function addItem(props, a){
  a = a || curAsm();
  const n = a.items.length;
  const attach = n ? { type:"free", x: a.baseline.x + 2 + (n % 4) * 1.5, y: a.baseline.y + 2.5 }
                   : { type:"baseline", x: a.baseline.x, y: a.baseline.y };
  const it = Object.assign({ id: newId(), className: null, params: {}, attach }, props);
  History.act(`เพิ่ม ${itemLabel(it)}`);
  a.items.push(it);
  setSel({ type:"item", item: it.id });
  run();
  if (!n) setTimeout(fit, 500);
  return it;
}

// ลบหลายตัวพร้อมกัน = Undo ก้อนเดียว
function removeItems(ids){
  const n = ids.length;
  History.batch(n === 1 ? `ลบ ${itemLabel(itemById(ids[0]))}` : `ลบ ${n} subassembly`, () => ids.forEach(removeItem));
  setSelList([]);
}
function removeItem(id){
  const a = asmOfItem(id); if (!a) return;
  History.act(`เอา ${itemLabel(itemById(id))} ออก`);
  if (state.editing === id) state.editing = null;
  // ตัวที่เกาะอยู่กับตัวนี้: ปลดให้ลอยอยู่ที่ตำแหน่งเดิม
  for (const k of a.items) if (k.attach.type === "point" && k.attach.parent === id){
    const r = asmRes[k.id];
    k.attach = { type:"free", x: r ? r.originX : k.attach.x, y: r ? r.originY : k.attach.y };
  }
  a.items = a.items.filter(i => i.id !== id);
  if (selItemId() === id) setSel({ type:"asm", asm: a.id }); else persist();
  run();
}

// Mirror: สำเนาตัวที่เลือกพร้อมตัวที่เกาะอยู่ทั้งหมด สลับ Side และเกาะที่เดียวกัน (ตัวที่ลอยอยู่สะท้อนข้ามแกน)
function mirrorItem(id){
  const a = asmOfItem(id); if (!a) return;
  const ids = [id, ...descendants(id)], map = {};
  History.act(`Mirror ${itemLabel(itemById(id))}`);
  ids.forEach(x => map[x] = newId());
  const clones = ids.map(x => {
    const src = itemById(x);
    const c = JSON.parse(JSON.stringify(src));
    c.id = map[x];
    const def = sideDef(x);
    if (def) c.params[def.name] = sideOf(src) === 1 ? 0 : 1;
    if (c.name) c.name += " (mirror)";
    if (x !== id) c.attach.parent = map[c.attach.parent];
    else if (c.attach.type === "free") c.attach.x = 2 * a.baseline.x - c.attach.x;
    return c;
  });
  a.items.push(...clones);
  setSel({ type:"item", item: map[id] });
  run();
}

// ย้าย item (พร้อมตัวที่เกาะอยู่กับมัน) ไปอีก assembly
function moveToAsm(id, target){
  const from = asmOfItem(id);
  if (!from || !target || from === target) return;
  const ids = new Set([id, ...descendants(id)]);
  target.items.push(...from.items.filter(i => ids.has(i.id)));
  from.items = from.items.filter(i => !ids.has(i.id));
}

function removeAsm(id){
  const a = asmById(id); if (!a) return;
  History.act(`ลบ ${a.name}`);
  if (a.items.some(i => i.id === state.editing)) state.editing = null;
  WS().assemblies = asms().filter(x => x.id !== id);
  if (!asms().length) WS().assemblies.push(newAssembly("Assembly 1"));
  setSel({ type:"ws" }); run();
}

function addAsm(){
  const xs = asms().map(a => a.baseline.x);
  const a = newAssembly("Assembly " + (asms().length + 1), { x: (xs.length ? Math.max(...xs) : 0) + 20, y: asms()[0] ? asms()[0].baseline.y : 0 });
  History.act(`เพิ่ม ${a.name}`);
  asms().push(a);
  setSel({ type:"asm", asm: a.id });
  fit();
}

// จุดที่ตัวที่ลากเกาะได้: แกนของทุก assembly + ทุกจุดของตัวอื่น (ยกเว้นตัวเองและตัวที่เกาะอยู่กับตัวเอง)
function snapCandidates(id){
  const banned = descendants(id); banned.add(id);
  const c = [];
  for (const a of asms()){
    c.push({ x: a.baseline.x, y: a.baseline.y, asm: a.id, attach:{ type:"baseline" }, label:"แกน " + a.name });
    for (const it of a.items){
      if (banned.has(it.id)) continue;
      const r = asmRes[it.id];
      if (!r || !r.result) continue;
      r.result.points.forEach((p, i) => {
        const code = p.codes[0] || null;
        c.push({ x:p.x, y:p.y, asm: a.id, attach:{ type:"point", parent: it.id, code, index: i },
                 label: (code || `จุด #${i} (ไม่มี code)`) + " · " + itemLabel(it) });
      });
    }
  }
  return c;
}

// ---------------- surface ----------------
function insertOnSurface(px){
  const x = wx(px), s = state.surface;
  for (let i = 0; i < s.length - 1; i++){
    if (x > s[i].x && x < s[i+1].x){
      const t = (x - s[i].x) / (s[i+1].x - s[i].x);
      History.act("เพิ่มจุด surface");
      s.splice(i + 1, 0, { x: snapV(x), y: s[i].y + t * (s[i+1].y - s[i].y) });
      state.sel = { type:"spt", i: i + 1 };
      changed(); renderTree();
      return;
    }
  }
}
function deleteSurfacePoint(i){
  if (i == null || i < 0 || state.surface.length <= 2) return;
  History.act(`ลบจุด surface #${i}`);
  state.surface.splice(i, 1);
  state.sel = { type:"surface" };
  changed(); renderTree();
}
function setAddMode(on){
  addMode = on;
  showBanner("");
  render(); renderProps();
}
function showBanner(t){
  const b = $("banner");
  if (!t && addMode) t = "โหมด Add point: คลิกบนเส้น surface เพื่อแทรกจุด · Esc เพื่อออก";
  b.textContent = t || ""; b.style.display = t ? "block" : "none";
}

// ---------------- เมาส์ ----------------
// pan = ปุ่มกลางเมาส์ลาก (แบบ AutoCAD) หรือ Space ค้าง + ลากปุ่มซ้าย (touchpad)
// ลากพื้นหลังด้วยปุ่มซ้าย = คลุมเลือก (Window ซ้าย→ขวา / Crossing ขวา→ซ้าย)
const ITEM_KINDS = ["item", "link", "pt", "shape", "dpt", "dlink", "dshape"];
let spaceDown = false;
function setSpace(on){ spaceDown = on; svg.classList.toggle("space", on); }
svg.addEventListener("pointerdown", e => {
  const t = e.target, kind = t.dataset.kind, { px, py } = evtPos(e);
  if (e.button === 1 || (e.button === 0 && spaceDown)){
    drag = { type:"pan", px, py, cx: state.view.cx, cy: state.view.cy, moved:false };
    svg.setPointerCapture(e.pointerId); e.preventDefault(); return;
  }
  if (e.button !== 0) return;
  closeMenus();
  if (cmdPlacing()){ cmdClick(px, py); e.preventDefault(); return; }       // Move / Copy / Paste: จุดฐาน / ปลายทาง
  if (state.editing && draw.tool){ if (draw.typing) closeTyping(); drawClick(px, py); e.preventDefault(); return; }
  if (kind === "h"){
    const i = +t.dataset.i;
    state.sel = { type:"spt", i };
    drag = { type:"spt", i };
    History.act(`ลากจุด surface #${i}`);
    renderAll();
  } else if (kind === "seg"){
    const now = performance.now(), dbl = lastSegDown && now - lastSegDown.t < 350 && Math.hypot(px - lastSegDown.px, py - lastSegDown.py) < 6;
    lastSegDown = { t: now, px, py };
    if (addMode || dbl){ lastSegDown = null; insertOnSurface(px); return; }
    drag = { type:"all", py, px, ys: state.surface.map(p => p.y), moved:false };
    History.act("เลื่อน surface");
  } else if (kind === "baseline"){
    const a = asmById(t.dataset.asm);
    drag = { type:"baseline", asm: a.id, px, py, x0: a.baseline.x, y0: a.baseline.y, moved:false };
    History.act(`ย้ายแกน ${a.name}`);
  } else if (ITEM_KINDS.includes(kind)){
    const id = t.dataset.id, it = itemById(id);
    if (!it) return;
    const obj = kind === "item" ? null : kind[0] === "d" ? { type: kind, id: t.dataset.sid } : { type: kind, i: +t.dataset.i };
    // Edit mode: ตัวที่แก้อยู่ไม่ลากทั้งตัว — คลิก = เลือก object, ลาก = คลุมเลือก (เริ่มบน object ได้)
    if (state.editing){
      const hit = id !== state.editing ? null : obj ? { ...obj, item: id } : { type:"item", item: id };
      drag = { type:"box", px, py, qx: px, qy: py, moved:false, hit, locked: id !== state.editing };
    } else {
      const { x: ox, y: oy } = itemOrigin(it);
      drag = { type:"item", id, obj, px, py, ox, oy, ox0: ox, oy0: oy, moved:false, attach: it.attach, cands: snapCandidates(id), hot:null };
      History.act(`ย้าย / เกาะ ${itemLabel(it)}`);
    }
  } else {
    drag = { type:"box", px, py, qx: px, qy: py, moved:false, hit: null };
  }
  svg.setPointerCapture(e.pointerId); e.preventDefault();
});

svg.addEventListener("pointermove", e => {
  const { px, py } = evtPos(e);
  renderXY(px, py);
  if (!drag && cmdPlacing()){ cmdMove(px, py); return; }
  if (!drag && state.editing && draw.tool){ drawMove(px, py); return; }
  if (!drag){ hoverTip(e, px, py); return; }
  if (!drag.moved && Math.hypot(px - drag.px, py - drag.py) >= 4) drag.moved = true;
  if (drag.type === "pan"){
    if (!drag.moved) return;
    tip.style.display = "none";
    state.view.cx = drag.cx - (px - drag.px) / state.view.scale;
    state.view.cy = drag.cy + (py - drag.py) / (state.view.scale * state.view.ve);
    render();
  } else if (drag.type === "box"){
    if (!drag.moved) return;
    drag.qx = px; drag.qy = py;
    tip.style.display = "none";
    render();
  } else if (drag.type === "spt"){
    const s = state.surface, p = s[drag.i];
    p.y = snapV(wy(py));
    if (e.shiftKey){
      const lo = drag.i > 0 ? s[drag.i-1].x + 0.01 : -Infinity;
      const hi = drag.i < s.length - 1 ? s[drag.i+1].x - 0.01 : Infinity;
      p.x = Math.min(hi, Math.max(lo, snapV(wx(px))));
    }
    showTip(px, py, `Offset ${f3(offOf(p.x))}\nElev   ${f3(elevOf(p.y))}`);
    changed();
  } else if (drag.type === "all"){
    if (!drag.moved) return;
    const dy = snapV(wy(py) - wy(drag.py));
    state.surface.forEach((p, i) => p.y = drag.ys[i] + dy);
    showTip(px, py, `เลื่อน surface ${dy >= 0 ? "+" : ""}${f3(dy)} m`);
    changed();
  } else if (drag.type === "baseline"){
    if (!drag.moved) return;
    const a = asmById(drag.asm);
    a.baseline.x = snapV(drag.x0 + (px - drag.px) / state.view.scale);
    a.baseline.y = snapV(drag.y0 - (py - drag.py) / (state.view.scale * state.view.ve));
    showTip(px, py, `แกน ${a.name}\nระดับ ${f3(elevOf(a.baseline.y))}`);
    changed();
  } else if (drag.type === "item"){
    if (!drag.moved) return;
    let ox = drag.ox0 + (px - drag.px) / state.view.scale;
    let oy = drag.oy0 - (py - drag.py) / (state.view.scale * state.view.ve);
    let best = null, bestD = SNAP_PX;
    for (const c of drag.cands){
      const d = Math.hypot(sx(c.x) - sx(ox), sy(c.y) - sy(oy));
      if (d < bestD){ best = c; bestD = d; }
    }
    drag.hot = best;
    if (best){ ox = best.x; oy = best.y; drag.attach = { ...best.attach, x: ox, y: oy }; }
    else { ox = snapV(ox); oy = snapV(oy); drag.attach = { type:"free", x: ox, y: oy }; }
    drag.ox = ox; drag.oy = oy; drag.target = best ? best.asm : null;
    showBanner(best ? "ปล่อยเพื่อเกาะที่ " + best.label : "ปล่อยตรงนี้ = ยังไม่เกาะ (ลอยอยู่)");
    tip.style.display = "none";
    render(); run();
  }
});

// คลิก (ไม่ได้ลาก) = เลือก: object ที่รวมชุดได้ = เพิ่มเข้าชุด (แบบ AutoCAD) · Shift = เอาออก · คลิกที่ว่าง = ยกเลิกการเลือก
function endDrag(e){
  if (!drag) return;
  const d = drag, shift = !!(e && e.shiftKey);
  drag = null;
  // คลุมเลือก: ใช้ตำแหน่งตอนปล่อยด้วย (ลากเร็วจน pointermove ไม่ทัน)
  if (d.type === "box" && e && e.clientX != null){
    const { px, py } = evtPos(e);
    if (Math.hypot(px - d.px, py - d.py) >= 4){ d.qx = px; d.qy = py; d.moved = true; }
  }
  tip.style.display = "none";
  if (d.type === "item"){
    const it = itemById(d.id);
    if (d.moved && it){
      it.attach = d.attach;
      if (d.target) moveToAsm(d.id, asmById(d.target));
      showBanner("");
      setSel({ type:"item", item: d.id }); run();
    } else if (shift) pickAdd([{ type:"item", item: d.id }], true);
    // คลิกซ้ำที่ตัวที่เลือกอยู่ตัวเดียว = เลือกจุด / link / shape ข้างใน (ดูค่าใน Properties)
    else if (d.obj && state.sel.type !== "multi" && selItemId() === d.id) setSel({ ...d.obj, item: d.id });
    else pickAdd([{ type:"item", item: d.id }]);
  } else if (d.type === "box"){
    if (d.moved){ endSelBox(d, shift); render(); }
    else if (d.hit && pickable(d.hit)) pickAdd([d.hit], shift);
    else if (d.hit){ if (!shift) setSel(d.hit); }           // จุด / link ของโค้ดเดิม, origin = เลือกแบบเดิม (ไม่รวมชุด)
    else if (!d.locked && !shift) setSelList([]);
    else render();
  } else if (d.type === "baseline" && !d.moved) setSel({ type:"asm", asm: d.asm });
  else if (d.type === "all" && !d.moved) setSel({ type:"surface" });
  else { persist(); renderTree(); renderProps(); }
}
svg.addEventListener("pointerup", endDrag);
svg.addEventListener("pointercancel", () => endDrag());
svg.addEventListener("pointerleave", () => { if (!drag) $("bar-xy").textContent = "—"; });
svg.addEventListener("contextmenu", e => {
  e.preventDefault();
  const t = e.target, k = t.dataset.kind;
  if (cmd.name) return cmdEnter();                            // Move / Copy: คลิกขวา = Enter (แบบ AutoCAD)
  if (state.editing && draw.tool) return finishChain();     // ตอนวาด: คลิกขวา = จบเส้น
  if (k === "h") return deleteSurfacePoint(+t.dataset.i);
  if (ITEM_KINDS.includes(k)){
    if (state.editing && t.dataset.id !== state.editing) return;
    if (k[0] === "d"){ setSel({ type: k, item: t.dataset.id, id: t.dataset.sid }); return openCtx(e, "drawn", t.dataset.id, { type: k, id: t.dataset.sid }); }
    return openCtx(e, "item", t.dataset.id);
  }
  if (k === "baseline") return openCtx(e, "asm", t.dataset.asm);
  if (k === "seg") return openCtx(e, "surface");
  openCtx(e, "ws");
});
svg.addEventListener("wheel", e => {
  e.preventDefault();
  const { px, py } = evtPos(e);
  const bx = wx(px), by = wy(py);
  state.view.scale = Math.min(800, Math.max(4, state.view.scale * Math.exp(-e.deltaY * 0.0015)));
  state.view.cx = bx - (px - W/2) / state.view.scale;
  state.view.cy = by + (py - H/2) / (state.view.scale * state.view.ve);
  render(); persist();
}, { passive:false });

function showTip(px, py, text){
  tip.textContent = text; tip.style.display = "block";
  tip.style.left = Math.min(px + 14, W - tip.offsetWidth - 4) + "px"; tip.style.top = (py + 14) + "px";
}
function hoverTip(e, px, py){
  const k = e.target.dataset.kind, i = +e.target.dataset.i, id = e.target.dataset.id;
  const r = id ? asmRes[id] : null, it = id ? itemById(id) : null, a = id ? asmOfItem(id) : null;
  if (k === "pt" && r && r.result){
    const p = r.result.points[i];
    showTip(px, py, `${itemLabel(it)} #${i} ${p.codes.join(", ") || "(no code)"}\nOffset ${f3(offOf(p.x, a))}  (จากแกน)\nElev   ${f3(elevOf(p.y))}`);
  } else if (k === "link" && r && r.result){
    const l = r.result.links[i];
    showTip(px, py, `${itemLabel(it)} link #${i}: ${l.pts.join("→")}\n${l.codes.join(", ") || "(no code)"}`);
  } else if (k === "shape" && r && r.result){
    const s = r.result.shapes[i];
    showTip(px, py, `${itemLabel(it)} shape #${i}\n${s.codes.join(", ") || "(no code)"}`);
  } else if (k === "h"){
    const p = state.surface[i];
    showTip(px, py, `surface #${i}\nOffset ${f3(offOf(p.x))}  (จากแกน)\nElev   ${f3(elevOf(p.y))}`);
  } else if (k === "baseline"){
    const b = asmById(e.target.dataset.asm);
    showTip(px, py, `แกน ${b.name} (ลากเพื่อย้าย)\nระดับ ${f3(elevOf(b.baseline.y))}`);
  } else if (k === "item" && it){
    showTip(px, py, `${itemLabel(it)}\nลากไปปล่อยที่แกน/จุดเพื่อเกาะ`);
  } else if ((k === "dpt" || k === "dlink" || k === "dshape") && it && drawRes[id]){
    const sid = e.target.dataset.sid, d = drawRes[id];
    if (k === "dpt"){
      const p = Spec.byId(it.spec.points, sid), q = d.pts[sid];
      showTip(px, py, `${itemLabel(it)} ${sid} ${p.codes.join(", ") || ""}\n${Spec.POINT_TYPES[p.def.type]}\nOffset ${f3(offOf(d.ox + q.x, a))}  (จากแกน)\nElev   ${f3(elevOf(d.oy + q.y))}`);
    } else {
      const o = k === "dlink" ? Spec.byId(it.spec.links, sid) : Spec.byId(it.spec.shapes, sid);
      showTip(px, py, `${itemLabel(it)} ${sid}\n${o.codes.join(", ") || "(no code)"}`);
    }
  } else tip.style.display = "none";
}

function fit(){
  const xs = [], ys = [];
  for (const a of asms()){ xs.push(a.baseline.x); ys.push(a.baseline.y); }
  for (const id in asmRes){ const x = asmRes[id].result; if (x) x.points.forEach(p => { xs.push(p.x); ys.push(p.y); }); }
  for (const id in drawRes){ const d = drawRes[id]; for (const k in d.pts) if (!d.pts[k].err){ xs.push(d.ox + d.pts[k].x); ys.push(d.oy + d.pts[k].y); } }
  state.surface.forEach(p => { xs.push(p.x); ys.push(p.y); });
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  state.view.scale = Math.max(4, Math.min((W - 120) / Math.max(maxX - minX, 1), (H - 120) / (Math.max(maxY - minY, 1) * state.view.ve)));
  state.view.cx = (minX + maxX) / 2;
  state.view.cy = (minY + maxY) / 2;
  render(); persist();
}
