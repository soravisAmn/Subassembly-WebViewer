// วาดใน Edit mode: เครื่องมือใน Drawer, snap, พิมพ์ค่า (Tab), Undo/Redo
//
// ทุกคลิกถูกแปลงเป็น "ความหมาย" ก่อนเก็บลง spec ของ subassembly ที่แก้อยู่ (ดู spec.js):
//   ชนจุดที่มีอยู่ = ใช้จุดเดิม · จุดของโค้ดเดิม = external (point code) · กึ่งกลาง link = between 0.5
//   จุดตัด 2 link = intersect · ล็อก slope แล้วชนดิน = slopeToSurface · ผิวดิน = onSurface
//   ล็อก slope = slopeLength · อื่นๆ = delta (dx, dy) จากจุดก่อนหน้า
"use strict";

// list = snap ทั้งหมดที่ตำแหน่งเมาส์ · cyc / lastCyc = ตัวที่ Tab วนไว้ · lastPx/lastPy = เมาส์ล่าสุดบนจอ (ไว้คำนวณใหม่เมื่อกดปุ่ม)
const draw = { tool: null, chain: [], cand: null, mouse: null, typing: false, list: [], cyc: null, lastCyc: null, lastPx: null, lastPy: null };
let drawRes = {};                  // item id -> ผล Spec.evaluate (เทียบ origin) จาก render ล่าสุด
const TOOL_NAMES = { point: "Point", link: "Link", shape: "Shape", daylight: "ลาดจนชนดิน", follow: "วิ่งตามผิวดิน" };
const OSNAP_LABEL = { end: "Endpoint", mid: "Midpoint", int: "Intersection", surf: "Surface", perp: "Perpendicular", near: "Nearest", ray: "ลาดชนดิน" };

// ---------------- spec ของ item ----------------
const editItem = () => itemById(state.editing);
const codeParamsOf = it => { const r = asmRes[it.id]; return r && r.result ? r.result.params : []; };
const hasCode = it => !!(it.file || it.sourceName);
const specNames = it => it.spec ? Spec.names(it.spec, codeParamsOf(it)) : [];

// origin ของ item บนจอ: ได้จาก server; ยังไม่มีผล (เช่น เพิ่ง ADD) หาเองจากจุดเกาะ
function itemOrigin(it){
  const r = asmRes[it.id];
  if (r) return { x: r.originX, y: r.originY };
  const at = it.attach, a = asmOfItem(it.id);
  if (at.type === "baseline" && a) return { x: a.baseline.x, y: a.baseline.y };
  if (at.type === "point"){
    const pr = asmRes[at.parent], pts = pr && pr.result ? pr.result.points : null;
    if (pts){
      const okIdx = at.index != null && at.index >= 0 && at.index < pts.length;
      const hit = at.code ? (okIdx && pts[at.index].codes.includes(at.code) ? pts[at.index] : pts.find(p => p.codes.includes(at.code))) : okIdx ? pts[at.index] : null;
      if (hit) return { x: hit.x, y: hit.y };
    }
  }
  return { x: at.x, y: at.y };
}
function specCtx(it, o){
  const r = asmRes[it.id];
  return {
    values: it.params || {}, codeParams: codeParamsOf(it),
    codePoints: r && r.result ? r.result.points.map(p => ({ x: p.x - r.originX, y: p.y - r.originY, codes: p.codes })) : [],
    surface: state.surfaceOn && state.surface.length >= 2 ? state.surface.map(p => ({ x: p.x - o.x, y: p.y - o.y })) : null,
    extendEnds: state.extendEnds, layout: state.layout
  };
}
function evalItem(it){
  if (!it.spec) return null;
  const o = itemOrigin(it);
  const r = Spec.evaluate(it.spec, specCtx(it, o));
  r.ox = o.x; r.oy = o.y;
  return r;
}
function evalAll(){
  drawRes = {};
  for (const it of allItems()) if (it.spec){
    drawRes[it.id] = evalItem(it);
    if (!hasCode(it)){ const o = drawRes[it.id]; it.attach.x = o.ox; it.attach.y = o.oy; }
  }
}

// เทียบรูปจาก JS กับผลรันโค้ด C# ที่สร้างจาก spec เดียวกัน (โค้ดเพิ่มจุดตามลำดับใน spec แล้วตามด้วยจุดกลางของ link ที่วิ่งตามผิวดิน)
// คืนข้อความเมื่อไม่ตรง; null = ตรง หรือยังเทียบไม่ได้ (ผล C# ยังไม่ใช่ของ spec ล่าสุด)
function csharpMismatch(it){
  const rr = asmRes[it.id], d = drawRes[it.id];
  if (!rr || !rr.generated || !rr.result || !d || inFlight || pending || rr.specJson !== JSON.stringify(it.spec)) return null;
  const exp = [];
  for (const p of it.spec.points){ const q = d.pts[p.id]; if (q && !q.err) exp.push([p.id, q.x, q.y]); }
  for (const l of it.spec.links){ const q = d.links[l.id]; if (q && !q.err) for (let i = 1; i < q.path.length - 1; i++) exp.push([l.id + " จุดกลาง", q.path[i].x, q.path[i].y]); }
  const P = rr.result.points;
  if (P.length !== exp.length) return `ผลรันโค้ด C# ได้ ${P.length} จุด แต่ที่วาดคำนวณได้ ${exp.length} จุด` + (hasCode(it) ? " (โค้ดนอกช่วงป้ายสร้างจุดเองด้วย?)" : "");
  for (let i = 0; i < exp.length; i++){
    const [id, x, y] = exp[i], px = P[i].x - rr.originX, py = P[i].y - rr.originY;
    if (Math.abs(px - x) > 1e-6 || Math.abs(py - y) > 1e-6) return `${id}: ที่วาด (${f3(x)}, ${f3(y)}) แต่โค้ด C# ได้ (${f3(px)}, ${f3(py)})`;
  }
  return null;
}
// spec ต่างจากที่ Save ลงไฟล์ล่าสุด
const drawingDirty = it => !!it.spec && it.savedSpec !== JSON.stringify(it.spec);
// Save (.cs) ได้ไหม: ยังไม่มีไฟล์ / ไฟล์ที่มีช่วง SA-DRAWING แล้ว (ไฟล์เขียนเองที่ยังไม่มีช่วงนี้ = Milestone 4)
const canSaveDrawing = it => !!it && !!it.spec && (!hasCode(it) || (!!it.file && (it.generatedFile || (asmRes[it.id] && asmRes[it.id].generated))));

// ---------------- แก้ spec (Undo ดู history.js) ----------------
// label = ชื่อการกระทำที่แถบบอกแสดงตอน Undo
function specEdit(fn, it, label){
  it = it || editItem();
  if (!it || !it.spec) return;
  History.act(label || "แก้ส่วนที่วาด");
  const r = fn(it.spec);
  persist(); renderAll();
  return r;
}
const specObj = (it, s) => !it.spec ? null : s.type === "dpt" ? Spec.byId(it.spec.points, s.id) : s.type === "dlink" ? Spec.byId(it.spec.links, s.id) : Spec.byId(it.spec.shapes, s.id);
const DRAWN_KIND = { dpt: "point", dlink: "link", dshape: "shape" };
function deleteDrawn(it, kind, id){
  deleteDrawnSet(it, [{ type: { point: "dpt", link: "dlink", shape: "dshape" }[kind], item: it.id, id }]);
}
// ลบ point / link / shape ที่วาด (หลายชิ้นพร้อมกัน) — สิ่งที่พึ่งของที่ลบจะหายไปด้วย: บอกก่อนแล้วให้ยืนยัน
function deleteDrawnSet(it, list){
  const objs = list.filter(o => o.item === it.id && DRAWN_KIND[o.type] && specObj(it, o));
  if (!objs.length) return;
  const picked = new Set(objs.map(o => o.id)), trial = JSON.parse(JSON.stringify(it.spec)), gone = new Set();
  for (const o of objs) for (const g of Spec.removeCascade(trial, DRAWN_KIND[o.type], o.id)) gone.add(g);
  const extra = [...gone].filter(g => !picked.has(g));
  const what = objs.length === 1 ? objs[0].id : `${objs.length} objects ที่เลือก`;
  const list_ = extra.length > 15 ? extra.slice(0, 15).join(", ") + ` … และอีก ${extra.length - 15} ชิ้น` : extra.join(", ");
  if (extra.length && !confirm(`ลบ ${what} จะลบ ${list_} ที่พึ่งอยู่ไปด้วย (รวม ${extra.length} ชิ้น) ตกลงไหม? (Ctrl+Z ย้อนได้)`)) return;
  const n = picked.size + extra.length;
  specEdit(s => { for (const o of objs) Spec.removeCascade(s, DRAWN_KIND[o.type], o.id); }, it, n === 1 ? `ลบ ${objs[0].id}` : `ลบ ${n} objects`);
  setSel({ type:"item", item: it.id });
}

// ---------------- เครื่องมือ ----------------
function setTool(t){
  if (t && !state.editing) return;
  if (t && cmd.name) endCmd();
  draw.tool = t; draw.chain = []; draw.cand = null; draw.list = []; draw.lastCyc = null; closeTyping(); tip.style.display = "none";
  for (const b of document.querySelectorAll("#drawer [data-tool]")) b.classList.toggle("on", b.dataset.tool === t);
  showBanner(drawBanner());
  render();
}
function drawBanner(){
  if (!draw.tool) return "";
  const t = {
    point: "Point: คลิกเพื่อวางจุด (อ้างจากจุดที่เลือกอยู่)",
    link: draw.chain.length ? "Link: คลิกจุดถัดไป · คลิกขวา/Enter = จบเส้นนี้" : "Link: คลิกจุดเริ่ม",
    shape: draw.chain.length ? `Shape: คลิกจุดรอบรูปต่อ (${draw.chain.length} จุด) · คลิกจุดแรก/Enter = ปิดรูป` : "Shape: คลิกจุดรอบรูปตามลำดับ",
    daylight: draw.chain.length ? "ลาดจนชนดิน: เลื่อนเมาส์เลือกทิศ แล้วคลิก (slope ตามปุ่มที่ล็อกในแถบล่าง ไม่ล็อก = 1:2)" : "ลาดจนชนดิน: คลิกจุดเริ่ม",
    follow: draw.chain.length ? "วิ่งตามผิวดิน: คลิกจุดปลาย" : "วิ่งตามผิวดิน: คลิกจุดเริ่ม"
  }[draw.tool];
  return t + " · Tab = พิมพ์ค่า · Esc = ยกเลิก";
}
document.getElementById("drawer").addEventListener("click", e => {
  const b = e.target.closest("[data-tool]"); if (!b || b.disabled) return;
  const t = b.dataset.tool;
  if (t === "bounds"){ const it = editItem(); if (it){ state.open["i:" + it.id] = true; setSel({ type:"params", item: it.id }); } return; }
  setTool(draw.tool === t ? null : t);
});
function renderDrawer(){
  const on = !!state.editing;
  for (const b of document.querySelectorAll("#drawer [data-tool]")) b.disabled = !on || !!b.dataset.later;
  if (!on && draw.tool) setTool(null);
}

// ---------------- snap ----------------
// พิกัดทั้งหมดในส่วนนี้เป็นค่าเทียบ origin ของตัวที่แก้ (ค่าจริงบนจอ = origin + ค่า)
const slopeLock = () => state.bar.slope >= 0 ? state.bar.slopes[state.bar.slope] : null;
const slopeMag = txt => { const m = /^1:(.+)$/.exec(txt); return m ? "1/" + m[1] : txt; };

function prevPoint(){
  const it = editItem(), r = drawRes[it.id];
  let id = draw.chain[draw.chain.length - 1];
  // Point: อ้างจากจุดที่เลือก (เลือกหลายชิ้น = จุดที่เลือกล่าสุด)
  const picked = draw.tool === "point" ? selList().filter(s => s.type === "dpt" && s.item === it.id) : [];
  if (!id && picked.length) id = picked[picked.length - 1].id;
  const p = id && r && r.pts[id];
  return p && !p.err ? { id, x: p.x, y: p.y } : null;
}

// ผู้สมัคร snap ที่ตำแหน่งเมาส์ m -> { x, y, kind, label, make() -> id ของจุด }
// รายการทั้งหมดเก็บใน draw.list (Tab วนเลือก) · ตัวที่ใช้ = draw.list[draw.cyc.i] · ไม่มี snap = จุดอิสระ
// ทุกเครื่องมือใช้ปุ่ม OSNAP ชุดเดียวกัน (ปิด Endpoint แล้วคลิกบนจุดเดิม = ได้จุดใหม่ แบบ AutoCAD)
function snapAt(m){
  const it = editItem(), r = drawRes[it.id], A = prevPoint();
  draw.list = []; draw.cyc = null;
  if (draw.tool === "daylight" && A) return daylightCand(m, A, r.flip, editGround(it));
  return pickSnap(editSnapList(m, A, true), () => freePoint(m, A, r.flip));
}
// ตัวที่ใช้จากรายการ (Tab วนไว้ตัวไหน) ไม่มี = fallback()
function pickSnap(list, fallback){
  draw.list = list;
  draw.cyc = Snap.keep(list, draw.lastCyc);
  draw.lastCyc = draw.cyc;
  return list.length ? list[draw.cyc.i] : fallback();
}
function editGround(it){
  const r = drawRes[it.id], s = specCtx(it, { x: r.ox, y: r.oy }).surface;
  return s && !state.layout ? Spec.makeGround(s, state.extendEnds) : null;
}
// snap ทั้งหมดของตัวที่แก้ที่เมาส์ m (เทียบ origin) — A = จุดก่อนหน้า (Perpendicular) · withRay = ลาดชนดินเมื่อล็อก slope
// ใช้ทั้งตอนวาดและตอนเลือกจุดฐาน / ปลายทางของ Move / Copy / Paste (cmd.js)
function editSnapList(m, A, withRay){
  const it = editItem(), r = drawRes[it.id], spec = it.spec, os = state.bar.osnap, F = r.flip, ground = editGround(it);

  // จุดที่จับได้: จุดที่วาด ก่อนจุดของโค้ดเดิม (ซ้อนกัน = ใช้จุดที่วาด) และ origin
  const points = [];
  for (const p of spec.points){ const q = r.pts[p.id]; if (q && !q.err) points.push({ x: q.x, y: q.y, label: p.id + (p.codes.length ? " " + p.codes.join(",") : ""), make: () => p.id }); }
  const rr = asmRes[it.id];
  if (rr && rr.result) rr.result.points.forEach((p, i) => {
    const x = p.x - rr.originX, y = p.y - rr.originY, code = p.codes[0];
    points.push({ x, y, label: code ? `${code} (โค้ดเดิม)` : `#${i} โค้ดเดิม (ไม่มี code)`, make: () => {
      if (code){ const ex = spec.points.find(q => q.def.type === "external" && q.def.code === code); return ex ? ex.id : Spec.addPoint(spec, { type:"external", code }); }
      return Spec.addPoint(spec, { type:"delta", dx: Expr.num(x * F), dy: Expr.num(y) });
    } });
  });
  points.push({ x: 0, y: 0, label: "origin", make: () => { const ex = spec.points.find(q => q.def.type === "origin"); return ex ? ex.id : Spec.addPoint(spec, { type:"origin" }); } });
  const segs = spec.links.filter(l => l.type !== "followSurface" && r.links[l.id] && !r.links[l.id].err)
    .map(l => ({ id: l.id, a: r.pts[l.points[0]], b: r.pts[l.points[1]], ends: l.points }));
  // ล็อก slope แล้วลากไปทางผิวดิน = จุดที่ลาดชนดิน (daylight)
  let ray = null;
  if (withRay && ground && A && slopeLock()){ const c = daylightCand(m, A, F, ground); if (c.kind === "ray") ray = c; }

  const list = Snap.collect({ mouse: m, scale: { x: state.view.scale, y: state.view.scale * state.view.ve }, R: OSNAP_PX,
    os: { ...os, on: state.bar.osOn }, points, segs, from: A, ground, ray });
  for (const c of list) c.make = snapMake(c, spec, A, F);
  return list;
}
const OSNAP_PX = 12;
// ชนิด snap -> ความหมายของจุดใน spec
function snapMake(c, spec, A, F){
  const [a, b] = c.seg ? c.seg.ends : [];
  switch (c.kind){
    case "end": return c.point.make;
    case "ray": return c.make;
    case "int": { const [a1, a2] = c.segs[0].ends, [b1, b2] = c.segs[1].ends; return () => Spec.addPoint(spec, { type:"intersect", a1, a2, b1, b2 }); }
    case "mid": return () => Spec.addPoint(spec, { type:"between", a, b, t:"0.5" });
    case "perp": case "near": return () => Spec.addPoint(spec, { type:"between", a, b, t: Expr.num(c.t) });
    case "surf": return () => Spec.addPoint(spec, { type:"onSurface", ...(A ? { from: A.id } : {}), dx: Expr.num((c.x - (A ? A.x : 0)) * F), target: "TargetSurface" });
  }
}
// Tab ตอนวาด: มี snap ให้เลือก ≥ 2 ตัว = วนไปตัวถัดไป (คืน true) · ไม่งั้นให้ผู้เรียกเปิดช่องพิมพ์ค่า
function cycleSnap(){
  if (!draw.list || draw.list.length < 2 || draw.lastPx == null || draw.typing) return false;
  draw.lastCyc = Snap.next(draw.list, draw.cyc);
  refreshSnap();
  return true;
}
// คำนวณ snap ใหม่ที่ตำแหน่งเมาส์ล่าสุด (กดปุ่ม OSNAP / Grid / Ortho / slope แล้วเห็นผลทันทีโดยไม่ต้องขยับเมาส์)
function refreshSnap(){
  if (draw.lastPx == null || draw.typing) return;
  if (cmdPlacing()) cmdMove(draw.lastPx, draw.lastPy);
  else if (state.editing && draw.tool) drawMove(draw.lastPx, draw.lastPy);
}

// ลาดจาก A ไปทางเมาส์ (slope ตามปุ่มที่ล็อก ไม่ล็อก = 1:2) จนชนดิน; ไม่มีผิวดิน/ไม่ชน = ยาวคงที่ตามที่ spec จะวาด
function daylightCand(m, A, F, ground){
  const it = editItem(), sl = slopeLock() || "1:2";
  const dirA = Math.sign(m.x - A.x) || 1, mag = Expr.value(slopeMag(sl), {}), s = (m.y < A.y ? -1 : 1) * mag;
  const slope = (s < 0 ? "-" : "") + slopeMag(sl);
  const make = () => Spec.addPoint(it.spec, { type:"slopeToSurface", from: A.id, slope, dir: dirA * F, target: "TargetSurface", maxDistance: "50", layoutLength: "3" });
  let hit = null;
  if (ground){ try{ hit = ground.intersect(A.x, A.y, dirA, s); }catch{} }
  if (hit && Math.abs(hit.x - A.x) <= 50) return { kind: "ray", x: hit.x, y: hit.y, label: `ลาด ${s < 0 ? "-" : ""}${sl} ชนดิน`, make };
  const run = ground ? 50 : 3;
  return { kind: "free", x: A.x + dirA * run, y: A.y + s * run, label: ground ? `ลาด ${sl} ไม่ชนดินใน 50 m` : `ลาด ${sl} (ไม่มีผิวดิน: ยาวคงที่ 3 m)`, make };
}

// ไม่ชน snap: ล็อก slope / Ortho / grid แล้วเก็บเป็น slopeLength หรือ delta จากจุดก่อนหน้า
function freePoint(m, A, F){
  const it = editItem(), spec = it.spec, sl = slopeLock(), g = snapV;
  if (A && sl && draw.tool !== "daylight"){
    const dirA = Math.sign(m.x - A.x) || 1, mag = Expr.value(slopeMag(sl), {}), s = (m.y < A.y ? -1 : 1) * mag;
    const run = g(Math.abs(m.x - A.x)), along = run * Math.sqrt(1 + s * s);
    return { kind: "free", x: A.x + dirA * run, y: A.y + s * run, label: `ลาด ${s < 0 ? "-" : ""}${sl}`,
             make: () => Spec.addPoint(spec, { type:"slopeLength", from: A.id, slope: (s < 0 ? "-" : "") + slopeMag(sl), length: Expr.num(along), dir: dirA * F, measure: "along" }) };
  }
  const bx = A ? A.x : 0, by = A ? A.y : 0;
  let dx = g(m.x - bx), dy = g(m.y - by);
  if (A && state.bar.ortho){ if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
  return { kind: "free", x: bx + dx, y: by + dy, label: "",
           make: () => Spec.addPoint(spec, { type:"delta", ...(A ? { from: A.id } : {}), dx: Expr.num(dx * F), dy: Expr.num(dy) }) };
}

// ---------------- คลิก ----------------
function drawLocal(px, py){
  const it = editItem(), r = drawRes[it.id];
  return { x: wx(px) - r.ox, y: wy(py) - r.oy };
}
function drawMove(px, py){
  const it = editItem(); if (!it || !drawRes[it.id]) return;
  draw.mouse = drawLocal(px, py); draw.lastPx = px; draw.lastPy = py;
  if (draw.typing) return;
  draw.cand = snapAt(draw.mouse);
  render();
  drawTip(px, py);
}
function drawTip(px, py){
  const c = draw.cand, A = prevPoint();
  if (!c){ tip.style.display = "none"; return; }
  const lines = [];
  const n = draw.list.length;
  if (c.label) lines.push((OSNAP_LABEL[c.kind] ? `${OSNAP_LABEL[c.kind]}: ` : "") + c.label);
  if (A && draw.tool !== "shape"){
    const dx = c.x - A.x, dy = c.y - A.y;
    lines.push(`slope ${slopeText(dx, dy)}`, `ยาว ${f3(Math.hypot(dx, dy))} m · dx ${f3(dx)} · dy ${f3(dy)}`);
  } else lines.push(`offset ${f3(c.x)} · elev ${f3(c.y)} (เทียบ origin)`);
  if (n >= 2) lines.push(`Tab = snap ตัวถัดไป (${draw.cyc.i + 1}/${n})`);
  if (draw.tool !== "shape" && draw.tool !== "follow") lines.push(n >= 2 ? "พิมพ์ตัวเลข = พิมพ์ค่า" : "พิมพ์ตัวเลข / Tab = พิมพ์ค่า / ชื่อ parameter");
  showTip(px, py, lines.join("\n"));
}

// คลิกซ้ายตอนเลือกเครื่องมืออยู่
function drawClick(px, py){
  const it = editItem(); if (!it) return;
  draw.mouse = drawLocal(px, py);
  const c = snapAt(draw.mouse);
  if (!c) return;
  commitPoint(c.make, c.kind);
}
// สร้าง/ใช้จุดจาก make() แล้วต่อ link / shape ตามเครื่องมือ (ทั้งหมดเป็น undo ก้อนเดียว)
function commitPoint(make){
  const t = draw.tool;
  let closeShape = false;
  specEdit(spec => {
    const id = make();
    const prev = draw.chain[draw.chain.length - 1];
    if (t === "point"){ state.sel = { type:"dpt", item: state.editing, id }; return; }
    if (t === "link"){ if (prev && prev !== id) Spec.addLink(spec, prev, id); if (prev !== id) draw.chain.push(id); return; }
    if (t === "follow"){
      if (!prev){ draw.chain = [id]; return; }
      if (prev !== id){ const lid = Spec.addLink(spec, prev, id, { type:"followSurface", from: prev, to: id, target:"TargetSurface" }); state.sel = { type:"dlink", item: state.editing, id: lid }; }
      draw.chain = []; return;
    }
    if (t === "daylight"){
      if (!prev){ draw.chain = [id]; return; }
      if (prev !== id){ Spec.addLink(spec, prev, id); state.sel = { type:"dpt", item: state.editing, id }; }
      draw.chain = []; return;
    }
    if (t === "shape"){
      if (draw.chain.length >= 3 && id === draw.chain[0]){ closeShape = true; return; }
      if (!draw.chain.includes(id)) draw.chain.push(id);
    }
  }, null, `วาด ${TOOL_NAMES[t]}`);
  if (closeShape) finishShape();
  showBanner(drawBanner());
}
function finishChain(){
  if (draw.tool === "shape" && draw.chain.length >= 3) return finishShape();
  draw.chain = []; showBanner(drawBanner()); render();
}
function finishShape(){
  const ids = draw.chain.slice();
  draw.chain = [];
  specEdit(spec => {
    const links = ids.map((a, i) => Spec.addLink(spec, a, ids[(i + 1) % ids.length]));
    const sid = Spec.addShape(spec, links);
    state.sel = { type:"dshape", item: state.editing, id: sid };
  }, null, "วาด Shape");
  showBanner(drawBanner());
}

// ---------------- พิมพ์ค่า (Tab / พิมพ์ตัวเลขเลย แบบ Dynamic Input) ----------------
// ช่องที่เว้นว่างใช้ค่าจากเมาส์ · slope พิมพ์แบบ 1:2 ได้ (ทิศขึ้น/ลงตามเมาส์) หรือเป็นนิพจน์มีเครื่องหมาย
// first = ตัวอักษรที่ผู้ใช้กดเปิดช่อง (ใส่ในช่องแรกให้เลย)
function openTyping(first){
  if (!draw.tool || draw.tool === "shape" || draw.tool === "follow" || !draw.mouse) return;
  const it = editItem(), box = $("dyn");
  draw.typing = true;
  const A = prevPoint();
  box.innerHTML = `<div class="dyn-h">${A ? "จาก " + A.id : "จาก origin"} · เว้นว่าง = ใช้ค่าจากเมาส์ · Enter = ตกลง · Esc = ยกเลิก</div>
    <label>dx<input data-f="dx" placeholder="${f3((draw.cand ? draw.cand.x : 0) - (A ? A.x : 0))}"></label>
    <label>dy<input data-f="dy" placeholder="${f3((draw.cand ? draw.cand.y : 0) - (A ? A.y : 0))}"></label>
    <label>slope<input data-f="slope" placeholder="เช่น 1:2"></label>
    <label>ยาว<input data-f="length" placeholder="ตามแนวลาด"></label>`;
  if (draw.tool === "daylight") for (const k of ["dx", "dy", "length"]) box.querySelector(`[data-f=${k}]`).parentElement.hidden = true;
  const names = specNames(it);
  for (const inp of box.querySelectorAll("input")){
    inp.addEventListener("input", () => {
      const v = inp.value.trim(), chk = v ? Expr.check(inp.dataset.f === "slope" ? slopeMag(v) : v, names) : { ok: true };
      inp.classList.toggle("bad", !chk.ok); inp.title = chk.ok ? "" : chk.error;
    });
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter"){ e.preventDefault(); commitTyping(); }
      else if (e.key === "Escape"){ e.preventDefault(); closeTyping(); }
      e.stopPropagation();
    });
  }
  const tp = tip.getBoundingClientRect(), mr = main.getBoundingClientRect();
  box.style.left = Math.max(4, Math.min(mr.width - 330, tp.left - mr.left)) + "px";
  box.style.top = Math.max(4, Math.min(mr.height - 120, tp.bottom - mr.top + 6)) + "px";
  box.hidden = false; tip.style.display = "none";
  const inp = box.querySelector(draw.tool === "daylight" ? "[data-f=slope]" : "input");
  inp.focus();
  if (first){ inp.value = first; inp.dispatchEvent(new Event("input")); }
}
function closeTyping(){ draw.typing = false; const b = $("dyn"); if (b){ b.hidden = true; b.innerHTML = ""; } }
function commitTyping(){
  const box = $("dyn"), it = editItem(), r = drawRes[it.id], F = r.flip, A = prevPoint();
  const val = k => { const i = box.querySelector(`[data-f=${k}]`); return i && !i.parentElement.hidden ? i.value.trim() : ""; };
  if (box.querySelector("input.bad")){ box.querySelector("input.bad").focus(); return; }
  const m = draw.mouse, mdx = m.x - (A ? A.x : 0), mdy = m.y - (A ? A.y : 0);
  const dirA = Math.sign(mdx) || 1;
  let slope = val("slope");
  if (/^1:/.test(slope)) slope = (mdy < 0 ? "-" : "") + slopeMag(slope);
  const L = val("length"), dx = val("dx"), dy = val("dy"), from = A ? { from: A.id } : {};
  let make;
  if (draw.tool === "daylight"){
    if (!A) return;
    const s = slope || (mdy < 0 ? "-1/2" : "1/2");
    make = () => Spec.addPoint(it.spec, { type:"slopeToSurface", from: A.id, slope: s, dir: dirA * F, target:"TargetSurface", maxDistance:"50", layoutLength:"3" });
  } else if (slope){
    const [measure, len] = L ? ["along", L] : dx ? ["dx", dx] : dy ? ["dy", dy] : ["along", Expr.num(Math.hypot(mdx, mdy))];
    make = () => Spec.addPoint(it.spec, { type:"slopeLength", ...from, slope, length: len, dir: dirA * F, measure });
  } else if (L && !dx && !dy){
    const s = Math.abs(mdx) < 1e-9 ? 0 : mdy / Math.abs(mdx);
    make = () => Spec.addPoint(it.spec, { type:"slopeLength", ...from, slope: Expr.num(s), length: L, dir: dirA * F, measure: "along" });
  } else {
    // dx ที่พิมพ์เป็นระยะไปทางนอก (ฝั่ง Right = ขวา) ตามระบบของ spec; dx จากเมาส์แปลงให้แล้ว
    make = () => Spec.addPoint(it.spec, { type:"delta", ...from, dx: dx || Expr.num(mdx * F), dy: dy || Expr.num(mdy) });
  }
  closeTyping();
  commitPoint(make);
}

// ---------------- วาดเส้นช่วย (rubber band, snap marker) ----------------
function renderDrawOverlay(){
  const it = editItem(); if (!it || !draw.tool || !draw.cand || !drawRes[it.id]) return;
  const r = drawRes[it.id], o = { x: r.ox, y: r.oy }, c = draw.cand, A = prevPoint();
  const X = v => sx(o.x + v.x), Y = v => sy(o.y + v.y);
  if (draw.tool === "shape" && draw.chain.length){
    const pts = draw.chain.map(id => r.pts[id]).filter(p => p && !p.err).concat([c]);
    el("polygon", { points: pts.map(p => X(p) + "," + Y(p)).join(" "), class:"rubber-fill" }, svg);
  }
  if (A && draw.tool !== "point" && draw.tool !== "shape") el("line", { x1: X(A), y1: Y(A), x2: X(c), y2: Y(c), class:"rubber" + (draw.tool === "follow" ? " follow" : "") }, svg);
  if (draw.tool === "shape" && draw.chain.length){ const P = r.pts[draw.chain[draw.chain.length - 1]]; if (P && !P.err) el("line", { x1: X(P), y1: Y(P), x2: X(c), y2: Y(c), class:"rubber" }, svg); }
  if (c.kind !== "free"){
    el("path", { d: osnapMarker(c.kind, X(c), Y(c)), class:"osnap " + c.kind }, svg);
    el("text", { x: X(c) + 12, y: Y(c) - 10, class:"osnap-lbl" }, svg).textContent = OSNAP_LABEL[c.kind] + (draw.list.length >= 2 ? ` (${draw.cyc.i + 1}/${draw.list.length})` : "");
  } else el("circle", { cx: X(c), cy: Y(c), r: 3, class:"osnap free" }, svg);
}
// รูป marker ตามแบบ AutoCAD: □ Endpoint · △ Midpoint · ✕ Intersection · ⊠ ลาดชนดิน (แบบ Apparent intersection)
//   ⊥ Perpendicular · ⧗ Nearest · เส้นดินมีขีด = Surface
function osnapMarker(kind, x, y){
  const k = 7, M = (a, b) => `M${x + a} ${y + b}`, L = (a, b) => `L${x + a} ${y + b}`;
  switch (kind){
    case "end": return M(-k, -k) + L(k, -k) + L(k, k) + L(-k, k) + "Z";
    case "mid": return M(0, -k - 2) + L(k + 1, k) + L(-k - 1, k) + "Z";
    case "int": return M(-k, -k) + L(k, k) + M(k, -k) + L(-k, k);
    case "ray": return M(-k, -k) + L(k, -k) + L(k, k) + L(-k, k) + "Z" + M(-k, -k) + L(k, k) + M(k, -k) + L(-k, k);
    case "perp": return M(-k, -k) + L(-k, k) + L(k, k) + M(-k, 0) + L(0, 0) + L(0, k);
    case "near": return M(-k, -k) + L(k, -k) + L(-k, k) + L(k, k) + "Z";
    case "surf": return M(-k - 2, 0) + L(k + 2, 0) + M(-k + 1, 0) + L(-k - 3, 6) + M(1, 0) + L(-3, 6) + M(k + 1, 0) + L(k - 3, 6);
  }
  return M(-k, -k) + L(k, -k) + L(k, k) + L(-k, k) + "Z";
}
