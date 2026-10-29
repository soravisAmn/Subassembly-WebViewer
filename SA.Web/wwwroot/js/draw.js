// วาดใน Edit mode: เครื่องมือใน Drawer, snap, พิมพ์ค่า (Tab), Undo/Redo
//
// ทุกคลิกถูกแปลงเป็น "ความหมาย" ก่อนเก็บลง spec ของ subassembly ที่แก้อยู่ (ดู spec.js):
//   ชนจุดที่มีอยู่ = ใช้จุดเดิม · จุดของโค้ดเดิม = external (point code) · กึ่งกลาง link = between 0.5
//   จุดตัด 2 link = intersect · ล็อก slope แล้วชนดิน = slopeToSurface · ผิวดิน = onSurface
//   ล็อก slope = slopeLength · อื่นๆ = delta (dx, dy) จากจุดก่อนหน้า
"use strict";

// list = snap ทั้งหมดที่ตำแหน่งเมาส์ · cyc / lastCyc = ตัวที่ Tab วนไว้ · lastPx/lastPy = เมาส์ล่าสุดบนจอ (ไว้คำนวณใหม่เมื่อกดปุ่ม)
// aux = โหมด Auxiliary ของชิ้นที่กำลังจะสร้าง (X สลับ — ใช้กับ AUX_TOOLS)
const draw = { tool: null, chain: [], cand: null, mouse: null, typing: false, list: [], cyc: null, lastCyc: null, lastPx: null, lastPy: null, aux: false };
const AUX_TOOLS = ["point", "link", "polygon", "ngon", "arc", "fillet"];
const auxDrawing = () => draw.aux && AUX_TOOLS.includes(draw.tool);
// X ระหว่างวาด: สลับโหมด Auxiliary ของชิ้นที่กำลังจะสร้าง (จุด / link ที่สร้างใหม่ = aux · จุดเดิมที่ snap ไม่เปลี่ยน)
function toggleDrawAux(){
  if (!AUX_TOOLS.includes(draw.tool)) return flashBanner(`X (Auxiliary) ใช้กับ Point / Link / Polygon / Arc / Fillet — ${TOOL_NAMES[draw.tool]} ไม่มีโหมดนี้`);
  draw.aux = !draw.aux;
  showBanner(drawBanner()); refreshSnap();
}
// ทำให้ทุกอย่างที่เพิ่งสร้างใน spec (ไม่อยู่ใน before) เป็น auxiliary — ตอนวาดโหมด Auxiliary
function markNewAux(spec, before){
  for (const o of spec.points) if (!before.P.has(o.id)) o.auxiliary = true;
  for (const o of spec.links) if (!before.L.has(o.id)) o.auxiliary = true;
}
const snapshotIds = spec => ({ P: new Set(spec.points.map(p => p.id)), L: new Set(spec.links.map(l => l.id)) });
let drawRes = {};                  // item id -> ผล Spec.evaluate (เทียบ origin) จาก render ล่าสุด
const TOOL_NAMES = { point: "Point", link: "Link", shape: "Shape", daylight: "ลาดจนชนดิน", follow: "วิ่งตามผิวดิน", polygon: "Polygon", ngon: "Polygon ด้านเท่า",
                     arc: "Arc", fillet: "Fillet" };
// Polygon ด้านเท่า: จำนวนด้าน / โหมดที่ใช้ล่าสุด (inscribed = รัศมีถึงมุม · circumscribed = รัศมีถึงกึ่งกลางด้าน)
const ngonOpt = () => (state.ngon ||= { n: 5, mode: "inscribed" });
// Arc: โหมด 3p = ผ่าน 3 จุด · ser = เริ่ม-ปลาย-รัศมี (สลับระหว่างวาดด้วย T / E แบบตัวเลือกใน banner ของ AutoCAD)
const arcOpt = () => (state.arc ||= { mode: "3p" });
// Fillet: รัศมีที่ใช้ล่าสุด (นิพจน์ / ชื่อ parameter ได้)
const filletOpt = () => (state.fillet ||= { r: "0.5" });
const OSNAP_LABEL = { end: "Endpoint", mid: "Midpoint", cen: "Center", int: "Intersection", surf: "Surface", perp: "Perpendicular", near: "Nearest", ray: "ลาดชนดิน", trk: "Tracking" };

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
  for (const p of it.spec.points){ const q = d.pts[p.id]; if (q && !q.err && !Spec.isAux(p)) exp.push([p.id, q.x, q.y]); }   // จุด auxiliary ไม่ Points.Add
  for (const l of it.spec.links){ const q = d.links[l.id]; if (q && !q.err && !q.aux) for (let i = 1; i < q.path.length - 1; i++) exp.push([l.id + " จุดกลาง", q.path[i].x, q.path[i].y]); }
  const P = rr.result.points;
  if (P.length !== exp.length) return `ผลรันโค้ด C# ได้ ${P.length} จุด แต่ที่วาดคำนวณได้ ${exp.length} จุด` + (hasCode(it) ? " (โค้ดนอกช่วงป้ายสร้างจุดเองด้วย?)" : "");
  for (let i = 0; i < exp.length; i++){
    const [id, x, y] = exp[i], px = P[i].x - rr.originX, py = P[i].y - rr.originY;
    if (Math.abs(px - x) > 1e-6 || Math.abs(py - y) > 1e-6) return `${id}: ที่วาด (${f3(x)}, ${f3(y)}) แต่โค้ด C# ได้ (${f3(px)}, ${f3(py)})`;
  }
  return null;
}
// spec ต่างจากที่ Save ลงไฟล์ล่าสุด
// spec / savedSpec รุ่นก่อน (construction) -> auxiliary — เรียกตอนโหลด (localStorage, .assembly.json, spec ที่ฝังใน .cs)
function normItem(it){
  if (!it || !it.spec) return;
  Spec.normalize(it.spec);
  if (it.savedSpec){ try{ it.savedSpec = JSON.stringify(Spec.normalize(JSON.parse(it.savedSpec))); }catch{} }
}
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
  draw.tool = t; draw.chain = []; draw.cand = null; draw.hover = null; draw.list = []; draw.lastCyc = null; closeTyping(); tip.style.display = "none";
  if (!t) document.body.classList.remove("aux-mode");
  trackClear();                                   // จบ / เปลี่ยนเครื่องมือ = ล้างจุดที่จับไว้ (แบบ AutoCAD)
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
    follow: draw.chain.length ? "วิ่งตามผิวดิน: คลิกจุดปลาย" : "วิ่งตามผิวดิน: คลิกจุดเริ่ม",
    polygon: draw.chain.length ? `Polygon: คลิกจุดถัดไป (${draw.chain.length} จุด) · คลิกจุดแรก / Enter / C = ปิดรูป` : "Polygon: คลิกจุดแรก",
    ngon: draw.chain.length ? `Polygon ${ngonOpt().n} ด้าน (${ngonOpt().mode === "circumscribed" ? "รัศมีถึงกึ่งกลางด้าน" : "รัศมีถึงมุม"}): ลากรัศมี / มุม แล้วคลิก · Tab = พิมพ์ N, R, θ`
                            : `Polygon ${ngonOpt().n} ด้าน: คลิกจุดศูนย์กลาง (เกาะจุดเดิมได้) · Tab = ตั้ง N / โหมด`,
    arc: arcBanner(),
    fillet: `Fillet R = ${filletOpt().r}: ` + (draw.chain.length ? `คลิก link ที่ 2 (ต่อกับ ${draw.chain[0]} ที่มุม)` : "คลิก link ที่ 1") + " · Tab / พิมพ์ = เปลี่ยน R"
            + (auxDrawing() ? " · Auxiliary = โค้งช่วยสร้างทับมุมเดิม (เส้นเดิมไม่เปลี่ยน)" : "")
  }[draw.tool];
  document.body.classList.toggle("aux-mode", auxDrawing());
  // โหมด Auxiliary: ป้ายชัดๆ หน้าข้อความ (X = สลับ)
  return (auxDrawing() ? "◇ AUXILIARY (ช่วยสร้าง — ไม่ลง Civil 3D) · " : "") + t + " · Tab = พิมพ์ค่า"
       + (AUX_TOOLS.includes(draw.tool) ? ` · X = ${draw.aux ? "กลับเป็นของจริง" : "Auxiliary"}` : "") + " · Esc = ยกเลิก";
}
function arcBanner(){
  const o = arcOpt(), n = draw.chain.length;
  const sw = "[T] 3 จุด · [E] เริ่ม-ปลาย-รัศมี";
  if (o.mode === "3p") return `Arc 3 จุด: ${["คลิกจุดเริ่ม", "คลิกจุดที่โค้งผ่าน (เป็นจุด auxiliary)", "คลิกจุดปลาย"][Math.min(n, 2)]} · ${sw}`;
  return `Arc เริ่ม-ปลาย-รัศมี: ${["คลิกจุดเริ่ม", "คลิกจุดปลาย", "ลากเมาส์เลือกความโค้ง / ทิศ แล้วคลิก · Tab = พิมพ์ R"][Math.min(n, 2)]} · ${sw}`;
}
// เปลี่ยนโหมด Arc ระหว่างวาด (จุดที่คลิกไว้แล้วเริ่มใหม่ ยกเว้นจุดเริ่ม)
function setArcMode(m){
  if (draw.tool !== "arc" || arcOpt().mode === m) return;
  arcOpt().mode = m; persist();
  draw.chain = draw.chain.slice(0, 1);
  showBanner(drawBanner()); refreshSnap();
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
  const base = editSnapList(m, A, true);
  trackHover(base[0]);
  return pickSnap(Track.merge(base, trackCands(m, c => trackMake(c, it.spec, r.flip))), () => freePoint(m, A, r.flip));
}

// ---------------- Object Snap Tracking (F11) — logic ใน track.js ----------------
// trk.list = จุดที่จับไว้ (พิกัดงาน) · ชี้ค้างบน snap ตัวบนสุด trackMs มิลลิวินาที = จับ / ปล่อย
const trk = { list: [], hoverKey: null, timer: 0 };
const trackOn = () => state.bar.track && state.bar.osOn;
function trackHover(c){
  if (!trackOn()) return;
  const k = Track.acquirable(c) ? Track.key(c) : null;
  if (k === trk.hoverKey) return;
  trk.hoverKey = k; clearTimeout(trk.timer);
  if (k) trk.timer = setTimeout(() => {
    if (trk.hoverKey !== k) return;
    const had = trk.list.length;
    trk.list = Track.toggle(trk.list, c);
    flashBanner(trk.list.length > had ? `Tracking: จับ ${c.label || OSNAP_LABEL[c.kind]} (${trk.list.length} จุด)` : `Tracking: ปล่อย ${c.label || OSNAP_LABEL[c.kind]}`);
    refreshSnap();
  }, state.bar.trackMs || 500);
}
function trackClear(){ clearTimeout(trk.timer); trk.hoverKey = null; if (trk.list.length){ trk.list = []; return true; } return false; }
// จุดบนเส้น tracking ที่เมาส์ m (make = ใส่ความหมายตอนวาด · ไม่ส่ง = ตำแหน่งอย่างเดียว เช่น Move / Copy)
function trackCands(m, make){
  if (!trackOn() || !trk.list.length) return [];
  const list = Track.collect(trk.list, m, { x: state.view.scale, y: state.view.scale * state.view.ve }, OSNAP_PX, state.bar.snap ? snapV : null);
  if (make) for (const c of list) c.make = make(c);
  return list;
}
// จุดใหม่บนเส้น tracking = ห่างจากจุดที่จับ (delta) — ผูกกับจุดนั้น: จุดนั้นขยับ จุดใหม่ขยับตาม
function trackMake(c, spec, F){
  return () => Spec.addPoint(spec, { type:"delta", from: trackFrom(c.base, spec, F), dx: Expr.num((c.x - c.base.x) * F), dy: Expr.num(c.y - c.base.y) });
}
// id ในสเปกของจุดที่จับ (สร้างจุดช่วยสร้างครั้งแรก แล้วจำไว้ใช้ซ้ำ — undo ลบไปแล้วก็สร้างใหม่)
function trackFrom(a, spec, F){
  if (a.made && Spec.byId(spec.points, a.made)) return a.made;
  const id = Track.refPoint(spec, a.ref, F);
  if (a.ref && a.ref.type !== "pt") a.made = id;
  return id;
}
// แสดงจุดที่จับ (+) และเส้น tracking ของ snap ที่ใช้อยู่ · S = พิกัดงาน -> จอ
function renderTrack(c, S){
  if (!trackOn()) return;
  for (const p of trk.list){ const q = S(p); el("path", { d: osnapMarker("trk", q.x, q.y), class: "trk-acq" + (p === Track.main(trk.list) ? " main" : "") }, svg); }
  if (!c || c.kind !== "trk") return;
  const q = S(c), line = (p, dir) => {
    const b = S(p);
    if (dir === "v") el("line", { x1: b.x, y1: 0, x2: b.x, y2: H, class: "trk-line" }, svg);
    else el("line", { x1: 0, y1: b.y, x2: W, y2: b.y, class: "trk-line" }, svg);
  };
  if (c.dir === "x"){ line(c.base, "v"); line(c.base2, "h"); } else line(c.base, c.dir);
  el("path", { d: osnapMarker("int", q.x, q.y), class: "osnap trk", transform: `translate(${q.x} ${q.y}) scale(.7) translate(${-q.x} ${-q.y})` }, svg);
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
  // ref = จุดนี้ในรูปที่ Tracking ใช้อ้างได้ (ดู Track.refPoint) — จุดช่วยสร้างก็จับได้
  const points = [];
  // Auxiliary ที่ซ่อนอยู่ (ปุ่ม Aux / ดูแบบ Civil 3D) = snap ไม่ได้
  const vis = o => auxShown() || !Spec.isAux(o);
  for (const p of spec.points){ const q = r.pts[p.id]; if (q && !q.err && vis(p)) points.push({ x: q.x, y: q.y, label: p.id + (p.codes.length ? " " + p.codes.join(",") : "") + (Spec.isAux(p) ? " (aux)" : ""), make: () => p.id, ref: { type:"pt", id: p.id } }); }
  const rr = asmRes[it.id];
  if (rr && rr.result && !rr.generated) rr.result.points.forEach((p, i) => {
    const x = p.x - rr.originX, y = p.y - rr.originY, code = p.codes[0];
    points.push({ x, y, label: code ? `${code} (โค้ดเดิม)` : `#${i} โค้ดเดิม (ไม่มี code)`, ref: code ? { type:"code", code } : { type:"fixed", x, y }, make: () => {
      if (code){ const ex = spec.points.find(q => q.def.type === "external" && q.def.code === code); return ex ? ex.id : Spec.addPoint(spec, { type:"external", code }); }
      return Spec.addPoint(spec, { type:"delta", dx: Expr.num(x * F), dy: Expr.num(y) });
    } });
  });
  points.push({ x: 0, y: 0, label: "origin", ref: { type:"origin" }, make: () => { const ex = spec.points.find(q => q.def.type === "origin"); return ex ? ex.id : Spec.addPoint(spec, { type:"origin" }); } });
  const segs = spec.links.filter(l => !l.type && vis(l) && r.links[l.id] && !r.links[l.id].err)
    .map(l => ({ id: l.id, a: r.pts[l.points[0]], b: r.pts[l.points[1]], ends: l.points }));
  // เส้นโค้ง: Nearest / Perpendicular / Intersection บนท่อนย่อยที่แบ่งแล้ว (จุดที่ได้เป็นค่าคงที่ — curve = ไม่มี Midpoint รายท่อน)
  //   Midpoint ของทั้งโค้ง + Center = ศูนย์กลาง (คลิก = จุดช่วยสร้างค่าคงที่)
  const mids = [], arcCenters = [];
  for (const l of spec.links){
    const q = r.links[l.id];
    if (!q || q.err || !q.arc || !vis(l)) continue;
    for (let i = 0; i < q.path.length - 1; i++) segs.push({ id: l.id, a: q.path[i], b: q.path[i + 1], curve: true });
    const g = q.arc, am = g.a1 + g.sw / 2, M = { x: g.cx + g.r * Math.cos(am), y: g.cy + g.r * Math.sin(am) };
    mids.push({ ...M, label: `กึ่งกลางโค้ง ${l.id} (ค่าคงที่)`, ref: { type:"fixed", x: M.x, y: M.y }, make: () => Spec.addPoint(spec, { type:"delta", dx: Expr.num(M.x * F), dy: Expr.num(M.y) }) });
    arcCenters.push({ x: g.cx, y: g.cy, label: `ศูนย์กลาง ${l.id} (ค่าคงที่)`, ref: { type:"fixed", x: g.cx, y: g.cy },
                      make: () => Spec.addPoint(spec, { type:"delta", dx: Expr.num(g.cx * F), dy: Expr.num(g.cy) }, [], true) });
  }
  // ล็อก slope แล้วลากไปทางผิวดิน = จุดที่ลาดชนดิน (daylight)
  let ray = null;
  if (withRay && ground && A && slopeLock()){ const c = daylightCand(m, A, F, ground); if (c.kind === "ray") ray = c; }

  // ศูนย์กลางของ polygon ด้านเท่า (Center)
  const centers = [];
  for (const g of spec.polygons || []){ const q = r.pts[g.center]; if (q && !q.err && vis(Spec.byId(spec.points, g.center))) centers.push({ x: q.x, y: q.y, label: `ศูนย์กลาง ${g.id}`, ref: { type:"pt", id: g.center }, make: () => g.center }); }
  centers.push(...arcCenters);

  const list = Snap.collect({ mouse: m, scale: { x: state.view.scale, y: state.view.scale * state.view.ve }, R: OSNAP_PX,
    os: { ...os, on: state.bar.osOn }, points, segs, centers, mids, from: A, ground, ray });
  for (const c of list){ c.make = snapMake(c, spec, A, F); c.ref = snapRef(c); }
  return list;
}
// จุด snap -> ref ของ Tracking (จุดที่ยังไม่อยู่ใน spec จะถูกสร้างเป็นจุดช่วยสร้างตอนใช้จริง)
const onCurve = c => (c.seg && c.seg.curve) || (c.segs && c.segs.some(s => s.curve));
function snapRef(c){
  if (c.midpt) return c.midpt.ref;
  if (onCurve(c)) return { type:"fixed", x: c.x, y: c.y };
  const [a, b] = c.seg ? c.seg.ends : [];
  switch (c.kind){
    case "end": return c.point.ref || null;
    case "cen": return c.center.ref || null;
    case "mid": return { type:"between", a, b, t:"0.5" };
    case "perp": return { type:"between", a, b, t: Expr.num(c.t) };
    case "int": { const [a1, a2] = c.segs[0].ends, [b1, b2] = c.segs[1].ends; return { type:"intersect", a1, a2, b1, b2 }; }
  }
  return null;
}
const OSNAP_PX = 12;
// ชนิด snap -> ความหมายของจุดใน spec
function snapMake(c, spec, A, F){
  if (c.midpt) return c.midpt.make;
  // บนเส้นโค้ง (ท่อนย่อย) = จุดค่าคงที่ตามตำแหน่ง (ยังไม่มีชนิดจุด "บนโค้ง")
  if (onCurve(c)) return () => Spec.addPoint(spec, { type:"delta", dx: Expr.num(c.x * F), dy: Expr.num(c.y) });
  const [a, b] = c.seg ? c.seg.ends : [];
  switch (c.kind){
    case "end": return c.point.make;
    case "cen": return c.center.make;
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
  if (draw.tool === "fillet"){
    draw.hover = filletLinkAt(draw.mouse);
    render();
    return showTip(px, py, draw.hover ? `${draw.hover} · R = ${filletOpt().r}` : "ชี้ที่ link เส้นตรง");
  }
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
  const ng = draw.tool === "ngon" && draw.chain.length ? ngonFromMouse(c) : null;
  const ar = arcSerStage() ? arcFromMouse(c) : null;
  if (ng) lines.push(`รัศมี ${f3(ng.R)} m (${ngonOpt().mode === "circumscribed" ? "ถึงกึ่งกลางด้าน" : "ถึงมุม"}) · θ ${ng.angle}° · ${ngonOpt().n} ด้าน`);
  else if (arcSerStage()) lines.push(ar ? `รัศมี ${f3(ar.R)} m · ${ar.sweep === "cw" ? "ตามเข็ม" : "ทวนเข็ม"} (กรอบ Side = Right)${ar.large ? " · ทางยาว" : ""}` : "เมาส์อยู่บนเส้นตรงเริ่ม-ปลาย");
  else if (A && draw.tool !== "shape"){
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
  if (draw.tool === "fillet") return filletClick();
  const c = snapAt(draw.mouse);
  if (!c) return;
  // Arc เริ่ม-ปลาย-รัศมี คลิกที่สาม = รัศมี / ทิศจากตำแหน่งเมาส์ (โค้งผ่านจุดนั้น)
  if (arcSerStage()){
    const g = arcFromMouse(c);
    if (!g) return flashBanner("เมาส์อยู่บนเส้นตรงเริ่ม-ปลาย — ลากออกไปด้านข้างเพื่อให้โค้ง");
    return arcRCommit(Expr.num(g.R), g.sweep, g.large);
  }
  // Polygon ด้านเท่า คลิกที่สอง = ได้รัศมี / มุมจากตำแหน่ง (snap ได้)
  if (draw.tool === "ngon" && draw.chain.length){
    const g = ngonFromMouse(c);
    if (!g || g.R < 1e-6) return flashBanner("รัศมีต้องมากกว่า 0 — ลากออกจากจุดศูนย์กลางก่อนคลิก");
    return ngonCommit(Expr.num(g.R), Expr.num(g.angle), ngonOpt().n, ngonOpt().mode);
  }
  // จุด auxiliary ไม่อยู่ใน Civil 3D จึงเป็นปลาย link / shape จริงไม่ได้ (ศูนย์กลาง polygon ด้านเท่าเป็นได้)
  // Shape / Polygon: ขอบที่เป็น link auxiliary เดิมใช้ไม่ได้ (shape ใน Civil 3D ประกอบจาก link จริงเท่านั้น)
  if ((draw.tool === "shape" || (draw.tool === "polygon" && !auxDrawing())) && draw.chain.length && c.kind === "end" && c.point.ref && c.point.ref.type === "pt"){
    const l = Spec.findLink(it.spec, draw.chain[draw.chain.length - 1], c.point.ref.id);
    if (l && Spec.isAux(l)) return flashBanner(`${l.id} เป็น link auxiliary — ใช้เป็นขอบของ shape ไม่ได้ (ทำเป็นของจริงใน Properties ก่อน)`);
  }
  const viaStage = draw.tool === "arc" && arcOpt().mode === "3p" && draw.chain.length === 1;   // จุดที่โค้งผ่านเป็นจุด auxiliary ได้
  if (c.kind === "end" && c.point.ref && c.point.ref.type === "pt" && draw.tool !== "point" && draw.tool !== "ngon" && !viaStage && !auxDrawing() && Spec.isAuxPoint(it.spec, c.point.ref.id))
    return flashBanner(`${c.point.ref.id} เป็นจุด auxiliary ต่อ link จริงไม่ได้ — ปิด "Auxiliary (ช่วยสร้าง)" ใน Properties ของ ${c.point.ref.id} ก่อน`);
  commitPoint(c.make, c.kind);
}
// สร้าง/ใช้จุดจาก make() แล้วต่อ link / shape ตามเครื่องมือ (ทั้งหมดเป็น undo ก้อนเดียว)
function commitPoint(make){
  const t = draw.tool;
  specEdit(spec => {
    const before = new Set(spec.points.map(p => p.id)), snap0 = snapshotIds(spec);
    // โหมด Auxiliary: ทุกอย่างที่เพิ่งสร้าง (จุด / link) เป็น aux — จุดเดิมที่ snap ไม่เปลี่ยน
    try{ return commitInSpec(spec, make, t, before); }
    finally{ if (auxDrawing()) markNewAux(spec, snap0); }
  }, null, `วาด ${TOOL_NAMES[t]}${auxDrawing() ? " (Auxiliary)" : ""}`);
  if (draw.closeShape) finishShape();
  if (draw.closePoly) closePolygon();
  draw.closeShape = draw.closePoly = false;
  showBanner(drawBanner());
}
// ส่วนใน specEdit ของ commitPoint: ต่อ link / chain ตามเครื่องมือ · ปิดรูป = ตั้ง draw.closeShape / closePoly ให้ทำหลัง specEdit
function commitInSpec(spec, make, t, before){
  const id = make();
  const prev = draw.chain[draw.chain.length - 1];
  if (t === "point"){ state.sel = { type:"dpt", item: state.editing, id }; return; }
  // Polygon ด้านเท่า: คลิกแรก = จุดศูนย์กลาง (ไม่ได้เกาะจุดเดิม = จุด auxiliary ไม่ไปโผล่ใน Civil 3D)
  if (t === "ngon"){ if (!before.has(id)) Spec.byId(spec.points, id).auxiliary = true; draw.chain = [id]; return; }
  // Arc: 3p = เริ่ม → ผ่าน (ใหม่ = จุด auxiliary) → ปลาย · ser = เริ่ม → ปลาย (แล้วเลือกรัศมีด้วยเมาส์ ดู drawClick)
  if (t === "arc"){
    if (draw.chain.includes(id)) return;
    const o = arcOpt();
    if (o.mode === "3p" && draw.chain.length === 1 && !before.has(id)) Spec.byId(spec.points, id).auxiliary = true;
    if (o.mode === "3p" && draw.chain.length === 2){
      const [a, v] = draw.chain;
      state.sel = { type:"dlink", item: state.editing, id: Spec.addLink(spec, a, id, { type:"arc3", from: a, via: v, to: id }) };
      draw.chain = []; return;
    }
    draw.chain.push(id); return;
  }
  // Polygon อิสระ: แบบ Link + คลิกจุดแรก (≥ 3 จุด) = ปิดรูป
  if (t === "polygon"){
    if (draw.chain.length >= 3 && id === draw.chain[0]){ draw.closePoly = true; return; }
    if (draw.chain.includes(id)) return;
    if (prev) Spec.addLink(spec, prev, id);
    draw.chain.push(id); return;
  }
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
    if (draw.chain.length >= 3 && id === draw.chain[0]){ draw.closeShape = true; return; }
    if (!draw.chain.includes(id)) draw.chain.push(id);
  }
}
function finishChain(){
  if (draw.tool === "shape" && draw.chain.length >= 3) return finishShape();
  if (draw.tool === "polygon" && draw.chain.length >= 3) return closePolygon();
  draw.chain = []; showBanner(drawBanner()); render();
}
// ปิด Polygon อิสระ: link จากจุดสุดท้ายกลับจุดแรก + shape จาก link ทั้งหมดตามลำดับ (แบบ Close ของ AutoCAD)
// ขอบรูปปิด ids ที่เป็น link auxiliary เดิม (ใช้ทำ shape ไม่ได้)
const auxEdge = ids => ids.map((a, i) => Spec.findLink(editItem().spec, a, ids[(i + 1) % ids.length])).find(l => l && Spec.isAux(l));
function closePolygon(){
  const ids = draw.chain.slice();
  if (ids.length < 3) return flashBanner("Polygon ต้องมีอย่างน้อย 3 จุด");
  const aux = auxDrawing(), ax = aux ? null : auxEdge(ids);
  if (ax) return flashBanner(`${ax.id} เป็น link auxiliary — ใช้เป็นขอบของ shape ไม่ได้ (ทำเป็นของจริงใน Properties ก่อน)`);
  draw.chain = [];
  specEdit(spec => {
    const s0 = snapshotIds(spec);
    const links = ids.map((a, i) => { const b = ids[(i + 1) % ids.length], l = Spec.findLink(spec, a, b); return l ? l.id : Spec.addLink(spec, a, b); });
    // Auxiliary: เส้นรอบรูปช่วยสร้าง ไม่มี shape (shape ใน Civil 3D ใช้ link จริงเท่านั้น)
    if (aux){ markNewAux(spec, s0); state.sel = { type:"dlink", item: state.editing, id: links[links.length - 1] }; }
    else state.sel = { type:"dshape", item: state.editing, id: Spec.addShape(spec, links) };
  }, null, `วาด Polygon ${ids.length} จุด${aux ? " (Auxiliary)" : ""}`);
  showBanner(drawBanner());
}

// ---------------- Arc ----------------
const arcSerStage = () => draw.tool === "arc" && arcOpt().mode === "ser" && draw.chain.length === 2;
// เริ่ม-ปลาย-รัศมี: วงกลมผ่านจุดเริ่ม เมาส์ และจุดปลาย -> รัศมี (ปัดตาม Grid snap) + ทิศ (กรอบ Side = Right) + ทางยาว
function arcFromMouse(c){
  const it = editItem(), r = drawRes[it.id], A = r.pts[draw.chain[0]], B = r.pts[draw.chain[1]];
  if (!A || !B || A.err || B.err || !c) return null;
  const g = Spec.arcGeom("arc3", A, B, c);
  if (g.warn) return null;
  const ccw = g.sw > 0, large = Math.abs(g.sw) > Math.PI;
  const R = Math.max(snapV(g.r), Math.hypot(B.x - A.x, B.y - A.y) / 2);
  return { R, sweep: ccw === (r.flip === 1) ? "ccw" : "cw", large, ccw, A, B };
}
function arcRCommit(R, sweep, large){
  const [a, b] = draw.chain;
  draw.chain = [];
  const aux = auxDrawing();
  specEdit(spec => {
    const s0 = snapshotIds(spec);
    state.sel = { type:"dlink", item: state.editing, id: Spec.addLink(spec, a, b, { type:"arcR", from: a, to: b, radius: String(R), sweep, large: !!large }) };
    if (aux) markNewAux(spec, s0);
  }, null, `วาด Arc เริ่ม-ปลาย-รัศมี${aux ? " (Auxiliary)" : ""}`);
  showBanner(drawBanner());
}
// จุดบนโค้งสำหรับเงาตอนลาก (เทียบ origin)
function arcPreview(type, A, B, extra, R, ccw, large){
  const g = Spec.arcGeom(type, A, B, extra, R, ccw, large);
  return g.warn ? [A, B] : [A, ...Spec.arcPoints(g, 64), B];
}

// ---------------- Fillet ----------------
// link เส้นตรงที่เมาส์ชี้ (ห่างไม่เกิน 10 px)
function filletLinkAt(m){
  const it = editItem(), r = drawRes[it.id], sx_ = state.view.scale, sy_ = state.view.scale * state.view.ve;
  let best = null;
  for (const l of it.spec.links){
    const q = r.links[l.id];
    if (l.type || !l.points || !q || q.err) continue;
    const p = Spec.projectSeg(q.path[0], q.path[1], m), d = Math.hypot((p.x - m.x) * sx_, (p.y - m.y) * sy_);
    if (d <= 10 && (!best || d < best.d)) best = { id: l.id, d };
  }
  return best ? best.id : null;
}
function filletClick(){
  const it = editItem(), id = filletLinkAt(draw.mouse);
  if (!id) return flashBanner("Fillet ได้เฉพาะ link เส้นตรง — คลิกบนเส้น");
  if (!draw.chain.length || draw.chain[0] === id){ draw.chain = [id]; showBanner(drawBanner()); return render(); }
  const first = draw.chain[0], R = filletOpt().r;
  // ลองกับสำเนาก่อน: ไม่ได้ต่อกันที่มุม ฯลฯ = บอกเหตุผล ไม่เกิดรายการ Undo เปล่า
  // โหมด Auxiliary = โค้ง + จุดสัมผัสช่วยสร้างทับมุม (link เดิม / shape ไม่เปลี่ยน)
  const opt = auxDrawing() ? { overlay: true } : {};
  const test = Spec.addFillet(JSON.parse(JSON.stringify(it.spec)), first, id, R, opt);
  if (test.error){ draw.chain = []; showBanner(drawBanner()); render(); return flashBanner(test.error); }
  draw.chain = [];
  let kept = null;
  specEdit(spec => { const f = Spec.addFillet(spec, first, id, R, opt); if (f.kept) kept = f.corner; state.sel = { type:"dlink", item: state.editing, id: f.link }; },
           null, `Fillet ${first} กับ ${id} R = ${R}${opt.overlay ? " (Auxiliary)" : ""}`);
  showBanner(drawBanner());
  if (kept) flashBanner(`จุดมุม ${kept} มี point code จึงยังเพิ่มลง Civil 3D (ติ๊ก "Auxiliary (ช่วยสร้าง)" ใน Properties ถ้าไม่ต้องการ)`);
}

// ---------------- Polygon ด้านเท่า ----------------
// จุดยอดเป็น polar จากจุดศูนย์กลาง (Spec.addPolygon) · ลากเมาส์ = จุดยอดแรก (inscribed) / กึ่งกลางด้านแรก (circumscribed)
// มุม θ ของ polygon เก็บในกรอบ Side = Right: จุดยอดแรกอยู่ที่ θ + 90 (θ = 0 → จุดแรกอยู่บนสุด)
function ngonFromMouse(c){
  const it = editItem(), r = drawRes[it.id], C = r.pts[draw.chain[0]], o = ngonOpt(), F = r.flip;
  if (!C || C.err || !c) return null;
  let phi = Math.atan2(c.y - C.y, c.x - C.x) * 180 / Math.PI;
  if (state.bar.ortho) phi = Math.round(phi / 90) * 90;                         // Ortho = ล็อกทีละ 90°
  const R = snapV(Math.hypot(c.x - C.x, c.y - C.y));
  const v0 = o.mode === "circumscribed" ? phi - 180 / o.n : phi;                 // มุมของจุดยอดแรกบนจอ
  const spec0 = F === 1 ? v0 : 180 - v0;                                         // -> กรอบ Side = Right
  return { R, angle: Math.round((spec0 - 90) * 100) / 100, C };
}
function ngonCommit(R, angle, n, mode){
  const center = draw.chain[0];
  draw.chain = [];
  const aux = auxDrawing();
  specEdit(spec => {
    const g = Spec.addPolygon(spec, { center, n, radius: R, angle, mode, aux });
    state.sel = aux ? { type:"dlink", item: state.editing, id: g.links[0] } : { type:"dshape", item: state.editing, id: g.shape };
  }, null, `วาด Polygon ${n} ด้าน${aux ? " (Auxiliary)" : ""}`);
  showBanner(drawBanner());
}
// จุดยอดของ polygon (เทียบ origin บนจอ) สำหรับเงาตอนลาก
function ngonPreview(C, R, angle, n, mode, F){
  const L = mode === "circumscribed" ? R / Math.cos(Math.PI / n) : R, out = [];
  for (let i = 0; i < n; i++){ const a = (angle + 90 + 360 * i / n) * Math.PI / 180; out.push({ x: C.x + F * L * Math.cos(a), y: C.y + L * Math.sin(a) }); }
  return out;
}
function finishShape(){
  const ids = draw.chain.slice(), ax = auxEdge(ids);
  if (ax) return flashBanner(`${ax.id} เป็น link auxiliary — ใช้เป็นขอบของ shape ไม่ได้ (ทำเป็นของจริงใน Properties ก่อน)`);
  draw.chain = [];
  specEdit(spec => {
    const links = ids.map((a, i) => Spec.addLink(spec, a, ids[(i + 1) % ids.length]));
    const sid = Spec.addShape(spec, links);
    state.sel = { type:"dshape", item: state.editing, id: sid };
  }, null, "วาด Shape");
  showBanner(drawBanner());
}

// ---------------- พิมพ์ค่า Polygon ด้านเท่า ----------------
// ช่อง N (3–24) + โหมด ทุกขั้น · ก่อนคลิกศูนย์กลาง: dx / dy ของจุดศูนย์กลาง · หลังคลิก: รัศมี R และมุม θ (นิพจน์ / ชื่อ parameter ได้)
// ปุ่ม + ข้างช่อง = สร้าง parameter ใหม่จากค่าในช่อง (แบบ SAC)
function openNgonTyping(first){
  const it = editItem(), box = $("dyn"), o = ngonOpt(), stage2 = draw.chain.length > 0;
  const g = stage2 ? ngonFromMouse(draw.cand) : null;
  const A = prevPoint(), R = typingRef(), B = R || A;
  draw.typing = true;
  box.innerHTML = `<div class="dyn-h">Polygon ด้านเท่า · ${stage2 ? "รัศมี / มุม (θ ในกรอบ Side = Right, 0 = จุดแรกอยู่บนสุด)" : `จุดศูนย์กลาง ${R ? "อ้างจาก " + esc(R.label) : A ? "จาก " + A.id : "จาก origin"}`} · เว้นว่าง = ใช้ค่าจากเมาส์ · Enter = ตกลง</div>
    <label>N<input data-f="n" placeholder="${o.n}" style="width:44px"></label>
    <label class="dyn-chk"><input type="checkbox" data-f="circ"${o.mode === "circumscribed" ? " checked" : ""}> ถึงกึ่งกลางด้าน</label>`
    + (stage2 ? `<label>R<input data-f="r" placeholder="${g ? f3(g.R) : ""}"><button type="button" class="dyn-par" data-p="r" title="สร้าง parameter ใหม่จากช่องนี้">+</button></label>
                 <label>θ<input data-f="t" placeholder="${g ? g.angle : 0}"><button type="button" class="dyn-par" data-p="t" title="สร้าง parameter ใหม่จากช่องนี้">+</button></label>`
              : `<label>dx<input data-f="dx" placeholder="${f3((draw.cand ? draw.cand.x : 0) - (B ? B.x : 0))}"></label>
                 <label>dy<input data-f="dy" placeholder="${f3((draw.cand ? draw.cand.y : 0) - (B ? B.y : 0))}"></label>`);
  const names = () => specNames(it);
  const check = inp => {
    const v = inp.value.trim();
    const r = inp.dataset.f === "n" ? (!v || (/^\d+$/.test(v) && +v >= 3 && +v <= 24) ? { ok: true } : { ok: false, error: "N ต้องเป็นจำนวนเต็ม 3–24" })
                                   : checkTyped(inp.dataset.f, v, names());
    inp.classList.toggle("bad", !r.ok); inp.title = r.ok ? "" : r.error;
  };
  for (const inp of box.querySelectorAll("input:not([type=checkbox])")){
    inp.addEventListener("input", () => check(inp));
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter"){ e.preventDefault(); commitNgonTyping(); }
      else if (e.key === "Escape"){ e.preventDefault(); closeTyping(); }
      e.stopPropagation();
    });
  }
  for (const b of box.querySelectorAll(".dyn-par")) b.onclick = () => {
    const inp = box.querySelector(`[data-f=${b.dataset.p}]`), cur = inp.value.trim() || inp.placeholder;
    const name = newParamFromValue(it, cur, b.dataset.p === "r" ? "R" : "Theta");
    if (name){ inp.value = name; check(inp); }
    inp.focus();
  };
  const tp = tip.getBoundingClientRect(), mr = main.getBoundingClientRect();
  box.style.left = Math.max(4, Math.min(mr.width - 330, tp.left - mr.left)) + "px";
  box.style.top = Math.max(4, Math.min(mr.height - 120, tp.bottom - mr.top + 6)) + "px";
  box.hidden = false; tip.style.display = "none";
  const inp = box.querySelector(stage2 ? "[data-f=r]" : "[data-f=n]");
  inp.focus();
  if (first){ inp.value = first; check(inp); }
}
function commitNgonTyping(){
  const box = $("dyn"), it = editItem(), r = drawRes[it.id], F = r.flip, o = ngonOpt();
  if (box.querySelector("input.bad")) return box.querySelector("input.bad").focus();
  const val = k => { const i = box.querySelector(`[data-f=${k}]`); return i ? i.value.trim() : ""; };
  if (val("n")) o.n = +val("n");
  o.mode = box.querySelector("[data-f=circ]").checked ? "circumscribed" : "inscribed";
  persist();
  if (draw.chain.length){
    const g = ngonFromMouse(draw.cand);
    const R = val("r") || (g ? Expr.num(g.R) : ""), t = val("t") || (g ? Expr.num(g.angle) : "0");
    if (!R || (/^-?[\d.]+$/.test(R) && +R <= 0)) return box.querySelector("[data-f=r]").focus();
    closeTyping();
    return ngonCommit(R, t, o.n, o.mode);
  }
  // ก่อนคลิกศูนย์กลาง: ตั้ง N / โหมดอย่างเดียว หรือพิมพ์ dx / dy = วางจุดศูนย์กลาง
  const dx = val("dx"), dy = val("dy");
  closeTyping();
  if (!dx && !dy){ showBanner(drawBanner()); return refreshSnap(); }
  const A = prevPoint(), R = typingRef(), B = R || A, p = draw.cand || draw.mouse;
  const from = () => R ? { from: trackFrom(R, it.spec, F) } : A ? { from: A.id } : {};
  commitPoint(() => Spec.addPoint(it.spec, { type:"delta", ...from(), dx: dx || Expr.num((p.x - (B ? B.x : 0)) * F), dy: dy || Expr.num(p.y - (B ? B.y : 0)) }));
}

// ---------------- พิมพ์รัศมี (Fillet / Arc เริ่ม-ปลาย-รัศมี) ----------------
// R เป็นนิพจน์ / ชื่อ parameter ได้ · ปุ่ม + = สร้าง parameter ใหม่จากค่าในช่อง · Arc: ติ๊กตามเข็ม / ทางยาว (กรอบ Side = Right)
function openRadiusTyping(first){
  const it = editItem(), box = $("dyn"), fil = draw.tool === "fillet";
  const g = fil ? null : arcFromMouse(draw.cand);
  draw.typing = true;
  box.innerHTML = `<div class="dyn-h">${fil ? "Fillet: รัศมีที่ใช้กับมุมถัดไป" : "Arc เริ่ม-ปลาย-รัศมี · เว้นว่าง = ค่าจากเมาส์ · ทิศในกรอบ Side = Right"} · Enter = ตกลง · Esc = ยกเลิก</div>
    <label>R<input data-f="r" placeholder="${fil ? esc(filletOpt().r) : g ? f3(g.R) : ""}"><button type="button" class="dyn-par" data-p="r" title="สร้าง parameter ใหม่จากช่องนี้">+</button></label>`
    + (fil ? "" : `<label class="dyn-chk"><input type="checkbox" data-f="cw"${g && g.sweep === "cw" ? " checked" : ""}> ตามเข็ม</label>
                   <label class="dyn-chk"><input type="checkbox" data-f="large"${g && g.large ? " checked" : ""}> ทางยาว (&gt; 180°)</label>`);
  const inp = box.querySelector("[data-f=r]"), names = () => specNames(it);
  const check = () => { const r = checkTyped("r", inp.value.trim(), names()); inp.classList.toggle("bad", !r.ok); inp.title = r.ok ? "" : r.error; };
  inp.addEventListener("input", check);
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter"){ e.preventDefault(); commitRadiusTyping(); }
    else if (e.key === "Escape"){ e.preventDefault(); closeTyping(); }
    e.stopPropagation();
  });
  box.querySelector(".dyn-par").onclick = () => {
    const name = newParamFromValue(it, inp.value.trim() || inp.placeholder, "R");
    if (name){ inp.value = name; check(); }
    inp.focus();
  };
  const tp = tip.getBoundingClientRect(), mr = main.getBoundingClientRect();
  box.style.left = Math.max(4, Math.min(mr.width - 330, (tp.width ? tp.left : mr.left + 40) - mr.left)) + "px";
  box.style.top = Math.max(4, Math.min(mr.height - 120, (tp.height ? tp.bottom : mr.top + 40) - mr.top + 6)) + "px";
  box.hidden = false; tip.style.display = "none";
  inp.focus();
  if (first){ inp.value = first; check(); }
}
function commitRadiusTyping(){
  const box = $("dyn"), inp = box.querySelector("[data-f=r]");
  if (inp.classList.contains("bad")) return inp.focus();
  const v = inp.value.trim();
  if (/^-?[\d.]+$/.test(v) && +v <= 0){ inp.classList.add("bad"); inp.title = "รัศมีต้องมากกว่า 0"; return inp.focus(); }
  if (draw.tool === "fillet"){
    if (v){ filletOpt().r = v; persist(); }
    closeTyping(); showBanner(drawBanner()); return;
  }
  const g = arcFromMouse(draw.cand), cw = box.querySelector("[data-f=cw]").checked, large = box.querySelector("[data-f=large]").checked;
  const R = v || (g ? Expr.num(g.R) : "");
  if (!R) return inp.focus();
  closeTyping();
  arcRCommit(R, cw ? "cw" : "ccw", large);
}

// ---------------- พิมพ์ค่า (Tab / พิมพ์ตัวเลขเลย แบบ Dynamic Input) ----------------
// ช่องที่เว้นว่างใช้ค่าจากเมาส์ · slope พิมพ์แบบ 1:2 ได้ (ทิศขึ้น/ลงตามเมาส์) หรือเป็นนิพจน์มีเครื่องหมาย
// first = ตัวอักษรที่ผู้ใช้กดเปิดช่อง (ใส่ในช่องแรกให้เลย)
// มีจุดที่จับไว้ (Tracking) = ค่าที่พิมพ์คิดจาก "จุดอ้างอิงหลัก" (จุดที่จับล่าสุด) แทนจุดก่อนหน้า
// ช่อง dx พิมพ์แบบ ระยะ<มุม ได้ (เช่น 5<30, Width<Ang) = จุดแบบ polar (มุมบนจอ ทวนเข็มจาก +x)
const typingRef = () => draw.tool !== "daylight" && trackOn() && trk.list.length ? Track.main(trk.list) : null;
function checkTyped(field, v, names){
  if (!v) return { ok: true };
  if (field === "slope") return Expr.check(slopeMag(v), names);
  const pol = field === "dx" ? Track.polarText(v) : null;
  if (pol){ const a = Expr.check(pol.length, names); return a.ok ? Expr.check(pol.angle, names) : a; }
  return Expr.check(v, names);
}
function openTyping(first){
  if (draw.tool === "ngon" && draw.mouse) return openNgonTyping(first);
  if (draw.tool === "fillet" || (arcSerStage() && draw.mouse)) return openRadiusTyping(first);
  if (!draw.tool || draw.tool === "shape" || draw.tool === "follow" || !draw.mouse) return;
  const it = editItem(), box = $("dyn");
  draw.typing = true;
  const A = prevPoint(), R = typingRef(), B = R || A;
  box.innerHTML = `<div class="dyn-h">${R ? `<b>อ้างจาก ${esc(R.label || OSNAP_LABEL[R.kind])}</b> (Tracking)` : A ? "จาก " + A.id : "จาก origin"} · เว้นว่าง = ใช้ค่าจากเมาส์ · dx พิมพ์ ระยะ&lt;มุม ได้ · Enter = ตกลง · Esc = ยกเลิก</div>
    <label>dx<input data-f="dx" placeholder="${f3((draw.cand ? draw.cand.x : 0) - (B ? B.x : 0))}"></label>
    <label>dy<input data-f="dy" placeholder="${f3((draw.cand ? draw.cand.y : 0) - (B ? B.y : 0))}"></label>
    <label>slope<input data-f="slope" placeholder="เช่น 1:2"></label>
    <label>ยาว<input data-f="length" placeholder="ตามแนวลาด"></label>`;
  if (draw.tool === "daylight") for (const k of ["dx", "dy", "length"]) box.querySelector(`[data-f=${k}]`).parentElement.hidden = true;
  if (R) showBanner(`อ้างจาก ${R.label || OSNAP_LABEL[R.kind]} (Tracking) — ค่าที่พิมพ์คิดจากจุดนี้`);
  const names = specNames(it);
  for (const inp of box.querySelectorAll("input")){
    inp.addEventListener("input", () => {
      const chk = checkTyped(inp.dataset.f, inp.value.trim(), names);
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
  const box = $("dyn"), it = editItem(), r = drawRes[it.id], F = r.flip, A = prevPoint(), R = typingRef();
  const val = k => { const i = box.querySelector(`[data-f=${k}]`); return i && !i.parentElement.hidden ? i.value.trim() : ""; };
  if (box.querySelector("input.bad")){ box.querySelector("input.bad").focus(); return; }
  // จุดตั้งต้นของค่าที่พิมพ์: จุดอ้างอิงของ Tracking > จุดก่อนหน้า > origin · ค่าที่ไม่ได้พิมพ์ใช้ตำแหน่ง snap ปัจจุบัน (บนเส้น tracking ก็ตรงแนวพอดี)
  const B = R || A, p = R && draw.cand ? draw.cand : draw.mouse;
  const mdx = p.x - (B ? B.x : 0), mdy = p.y - (B ? B.y : 0);
  const dirA = Math.sign(mdx) || 1;
  let slope = val("slope");
  if (/^1:/.test(slope)) slope = (mdy < 0 ? "-" : "") + slopeMag(slope);
  const L = val("length"), dx = val("dx"), dy = val("dy");
  const fromOf = () => R ? { from: trackFrom(R, it.spec, F) } : A ? { from: A.id } : {};
  const pol = Track.polarText(dx);
  let make;
  if (pol && draw.tool !== "daylight"){
    make = () => Spec.addPoint(it.spec, { type:"polar", ...fromOf(), length: pol.length, angle: Track.specAngle(pol.angle, F) });
  } else if (draw.tool === "daylight"){
    if (!A) return;
    const s = slope || (mdy < 0 ? "-1/2" : "1/2");
    make = () => Spec.addPoint(it.spec, { type:"slopeToSurface", from: A.id, slope: s, dir: dirA * F, target:"TargetSurface", maxDistance:"50", layoutLength:"3" });
  } else if (slope){
    const [measure, len] = L ? ["along", L] : dx ? ["dx", dx] : dy ? ["dy", dy] : ["along", Expr.num(Math.hypot(mdx, mdy))];
    make = () => Spec.addPoint(it.spec, { type:"slopeLength", ...fromOf(), slope, length: len, dir: dirA * F, measure });
  } else if (L && !dx && !dy){
    const s = Math.abs(mdx) < 1e-9 ? 0 : mdy / Math.abs(mdx);
    make = () => Spec.addPoint(it.spec, { type:"slopeLength", ...fromOf(), slope: Expr.num(s), length: L, dir: dirA * F, measure: "along" });
  } else {
    // dx ที่พิมพ์เป็นระยะไปทางนอก (ฝั่ง Right = ขวา) ตามระบบของ spec; dx จากเมาส์แปลงให้แล้ว
    make = () => Spec.addPoint(it.spec, { type:"delta", ...fromOf(), dx: dx || Expr.num(mdx * F), dy: dy || Expr.num(mdy) });
  }
  closeTyping();
  commitPoint(make);
}

// ---------------- วาดเส้นช่วย (rubber band, snap marker) ----------------
function renderDrawOverlay(){
  const it = editItem(); if (!it || !draw.tool || !drawRes[it.id]) return;
  const r = drawRes[it.id], o = { x: r.ox, y: r.oy }, c = draw.cand, A = prevPoint();
  const X = v => sx(o.x + v.x), Y = v => sy(o.y + v.y);
  const poly = P => P.map((p, j) => (j ? "L" : "M") + X(p) + " " + Y(p)).join(" ");
  // Fillet: link ที่เลือกไว้ + link ที่เมาส์ชี้
  if (draw.tool === "fillet"){
    for (const id of new Set([...draw.chain, draw.hover].filter(Boolean))){
      const q = r.links[id];
      if (q && !q.err) el("path", { d: poly(q.path), class: "fillet-pick" + (draw.chain.includes(id) ? " on" : "") }, svg);
    }
    return;
  }
  if (!c) return;
  // Arc: เงาของโค้งตามเมาส์
  if (draw.tool === "arc" && draw.chain.length){
    const P = draw.chain.map(id => r.pts[id]);
    if (P.every(p => p && !p.err)){
      if (draw.chain.length === 1) el("line", { x1: X(P[0]), y1: Y(P[0]), x2: X(c), y2: Y(c), class:"rubber" }, svg);
      else if (arcOpt().mode === "3p") el("path", { d: poly(arcPreview("arc3", P[0], c, P[1])), class:"rubber" }, svg);
      else {
        const g = arcFromMouse(c);
        el("line", { x1: X(P[0]), y1: Y(P[0]), x2: X(P[1]), y2: Y(P[1]), class:"rubber close" }, svg);
        if (g) el("path", { d: poly(arcPreview("arcR", g.A, g.B, null, g.R, g.ccw, g.large)), class:"rubber" }, svg);
      }
    }
  }
  if ((draw.tool === "shape" || draw.tool === "polygon") && draw.chain.length){
    const pts = draw.chain.map(id => r.pts[id]).filter(p => p && !p.err).concat([c]);
    el("polygon", { points: pts.map(p => X(p) + "," + Y(p)).join(" "), class:"rubber-fill" }, svg);
    // Polygon อิสระ: เส้นปิดรูปกลับจุดแรก
    if (draw.tool === "polygon" && pts.length >= 3) el("line", { x1: X(c), y1: Y(c), x2: X(pts[0]), y2: Y(pts[0]), class:"rubber close" }, svg);
  }
  // Polygon ด้านเท่า: เงาของรูปตามรัศมี / มุมจากเมาส์ + เส้นรัศมี
  const ng = draw.tool === "ngon" && draw.chain.length ? ngonFromMouse(c) : null;
  if (ng && ng.R > 1e-9){
    const V = ngonPreview(ng.C, ng.R, ng.angle, ngonOpt().n, ngonOpt().mode, r.flip);
    el("polygon", { points: V.map(p => X(p) + "," + Y(p)).join(" "), class:"rubber-fill ngon" }, svg);
    el("line", { x1: X(ng.C), y1: Y(ng.C), x2: X(c), y2: Y(c), class:"rubber" }, svg);
  }
  if (A && draw.tool !== "point" && draw.tool !== "shape" && draw.tool !== "ngon" && draw.tool !== "arc") el("line",{ x1: X(A), y1: Y(A), x2: X(c), y2: Y(c), class:"rubber" + (draw.tool === "follow" ? " follow" : "") }, svg);
  if (draw.tool === "shape" && draw.chain.length){ const P = r.pts[draw.chain[draw.chain.length - 1]]; if (P && !P.err) el("line", { x1: X(P), y1: Y(P), x2: X(c), y2: Y(c), class:"rubber" }, svg); }
  renderTrack(c, p => ({ x: X(p), y: Y(p) }));
  if (c.kind !== "free"){
    if (c.kind !== "trk") el("path", { d: osnapMarker(c.kind, X(c), Y(c)), class:"osnap " + c.kind }, svg);
    el("text", { x: X(c) + 12, y: Y(c) - 10, class:"osnap-lbl" }, svg).textContent = OSNAP_LABEL[c.kind] + (draw.list.length >= 2 ? ` (${draw.cyc.i + 1}/${draw.list.length})` : "");
  } else el("circle", { cx: X(c), cy: Y(c), r: 3, class:"osnap free" }, svg);
}
// รูป marker ตามแบบ AutoCAD: □ Endpoint · △ Midpoint · ◯ Center · ✕ Intersection · ⊠ ลาดชนดิน (แบบ Apparent intersection)
//   ⊥ Perpendicular · ⧗ Nearest · เส้นดินมีขีด = Surface · + = จุดที่จับไว้ของ Tracking (ใช้ในเมนู OSNAP ด้วย)
function osnapMarker(kind, x, y){
  const k = 7, M = (a, b) => `M${x + a} ${y + b}`, L = (a, b) => `L${x + a} ${y + b}`;
  switch (kind){
    case "end": return M(-k, -k) + L(k, -k) + L(k, k) + L(-k, k) + "Z";
    case "cen": return M(-k, 0) + `A${k} ${k} 0 1 0 ${x + k} ${y}A${k} ${k} 0 1 0 ${x - k} ${y}Z` + M(-3, 0) + L(3, 0) + M(0, -3) + L(0, 3);
    case "trk": return M(-5, 0) + L(5, 0) + M(0, -5) + L(0, 5);
    case "mid": return M(0, -k - 2) + L(k + 1, k) + L(-k - 1, k) + "Z";
    case "int": return M(-k, -k) + L(k, k) + M(k, -k) + L(-k, k);
    case "ray": return M(-k, -k) + L(k, -k) + L(k, k) + L(-k, k) + "Z" + M(-k, -k) + L(k, k) + M(k, -k) + L(-k, k);
    case "perp": return M(-k, -k) + L(-k, k) + L(k, k) + M(-k, 0) + L(0, 0) + L(0, k);
    case "near": return M(-k, -k) + L(k, -k) + L(-k, k) + L(k, k) + "Z";
    case "surf": return M(-k - 2, 0) + L(k + 2, 0) + M(-k + 1, 0) + L(-k - 3, 6) + M(1, 0) + L(-3, 6) + M(k + 1, 0) + L(k - 3, 6);
  }
  return M(-k, -k) + L(k, -k) + L(k, k) + L(-k, k) + "Z";
}
