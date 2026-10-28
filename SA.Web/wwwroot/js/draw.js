// วาดใน Edit mode: เครื่องมือใน Drawer, snap, พิมพ์ค่า (Tab), Undo/Redo
//
// ทุกคลิกถูกแปลงเป็น "ความหมาย" ก่อนเก็บลง spec ของ subassembly ที่แก้อยู่ (ดู spec.js):
//   ชนจุดที่มีอยู่ = ใช้จุดเดิม · จุดของโค้ดเดิม = external (point code) · กึ่งกลาง link = between 0.5
//   จุดตัด 2 link = intersect · ล็อก slope แล้วชนดิน = slopeToSurface · ผิวดิน = onSurface
//   ล็อก slope = slopeLength · อื่นๆ = delta (dx, dy) จากจุดก่อนหน้า
"use strict";

const draw = { tool: null, chain: [], cand: null, mouse: null, typing: false };
let drawRes = {};                  // item id -> ผล Spec.evaluate (เทียบ origin) จาก render ล่าสุด
const undoStack = [], redoStack = [];
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

// ---------------- แก้ spec (มี Undo) ----------------
function specEdit(fn, it){
  it = it || editItem();
  if (!it || !it.spec) return;
  undoStack.push({ id: it.id, json: JSON.stringify(it.spec) });
  if (undoStack.length > 200) undoStack.shift();
  redoStack.length = 0;
  const r = fn(it.spec);
  persist(); renderAll();
  return r;
}
function undoRedo(redo){
  const from = redo ? redoStack : undoStack, to = redo ? undoStack : redoStack;
  const s = from.pop(); if (!s) return;
  const it = itemById(s.id); if (!it) return;
  to.push({ id: s.id, json: JSON.stringify(it.spec) });
  it.spec = JSON.parse(s.json);
  const sel = state.sel;
  if (/^d(pt|link|shape)$/.test(sel.type) && !specObj(it, sel)) state.sel = { type:"item", item: it.id };
  persist(); renderAll();
  showBanner((redo ? "Redo" : "Undo") + " แล้ว"); setTimeout(() => showBanner(drawBanner()), 900);
}
const specObj = (it, s) => !it.spec ? null : s.type === "dpt" ? Spec.byId(it.spec.points, s.id) : s.type === "dlink" ? Spec.byId(it.spec.links, s.id) : Spec.byId(it.spec.shapes, s.id);
function deleteDrawn(it, kind, id){
  const gone = Spec.cascadePreview(it.spec, kind, id);
  if (gone.length > 1 && !confirm(`ลบ ${id} จะลบ ${gone.filter(g => g !== id).join(", ")} ที่พึ่ง ${id} ไปด้วย ตกลงไหม? (Ctrl+Z ย้อนได้)`)) return;
  specEdit(s => Spec.removeCascade(s, kind, id), it);
  setSel({ type:"item", item: it.id });
}

// ---------------- เครื่องมือ ----------------
function setTool(t){
  if (t && !state.editing) return;
  draw.tool = t; draw.chain = []; draw.cand = null; closeTyping(); tip.style.display = "none";
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
function pxDist(o, a, b){ return Math.hypot(sx(o.x + a.x) - sx(o.x + b.x), sy(o.y + a.y) - sy(o.y + b.y)); }

function prevPoint(){
  const it = editItem(), r = drawRes[it.id];
  let id = draw.chain[draw.chain.length - 1];
  if (!id && draw.tool === "point" && state.sel.type === "dpt" && state.sel.item === it.id) id = state.sel.id;
  const p = id && r && r.pts[id];
  return p && !p.err ? { id, x: p.x, y: p.y } : null;
}

// ผู้สมัคร snap ที่ตำแหน่งเมาส์ m -> { x, y, kind, label, make() -> id ของจุด }
function snapAt(m){
  const it = editItem(), r = drawRes[it.id], o = { x: r.ox, y: r.oy }, spec = it.spec, os = state.bar.osnap;
  const A = prevPoint(), F = r.flip, R = 12;
  const cands = [];
  // จุดลาดชนดินจับได้ไกลกว่า (ผู้ใช้เล็งตามแนวลาด ไม่ได้เล็งจุดเป๊ะ)
  const add = (kind, x, y, label, make) => { const d = pxDist(o, { x, y }, m); if (d <= (kind === "ray" ? 2.5 * R : R)) cands.push({ kind, x, y, label, make, d }); };
  const ctxS = specCtx(it, o).surface, ground = ctxS && !state.layout ? Spec.makeGround(ctxS, state.extendEnds) : null;
  if (draw.tool === "daylight" && A) return daylightCand(m, A, F, ground);
  const onlyEnds = draw.tool === "shape" || draw.tool === "follow" || draw.tool === "daylight";
  const straight = spec.links.filter(l => l.type !== "followSurface" && r.links[l.id] && !r.links[l.id].err);

  if (os.end || onlyEnds){
    for (const p of spec.points){ const q = r.pts[p.id]; if (q && !q.err) add("end", q.x, q.y, p.id + (p.codes.length ? " " + p.codes.join(",") : ""), () => p.id); }
    if (!onlyEnds){
      const rr = asmRes[it.id];
      if (rr && rr.result) rr.result.points.forEach((p, i) => {
        const x = p.x - rr.originX, y = p.y - rr.originY, code = p.codes[0];
        add("end", x, y, code ? `${code} (โค้ดเดิม)` : `#${i} โค้ดเดิม (ไม่มี code)`, () => {
          if (code){ const ex = spec.points.find(q => q.def.type === "external" && q.def.code === code); return ex ? ex.id : Spec.addPoint(spec, { type:"external", code }); }
          return Spec.addPoint(spec, { type:"delta", dx: Expr.num(x * F), dy: Expr.num(y) });
        });
      });
      add("end", 0, 0, "origin", () => { const ex = spec.points.find(q => q.def.type === "origin"); return ex ? ex.id : Spec.addPoint(spec, { type:"origin" }); });
    }
  }
  if (!onlyEnds){
    if (os.int) for (let i = 0; i < straight.length; i++) for (let j = i + 1; j < straight.length; j++){
      const [a1, a2] = straight[i].points, [b1, b2] = straight[j].points;
      if (new Set([a1, a2, b1, b2]).size < 4) continue;          // ต่อกันที่ปลาย = endpoint อยู่แล้ว
      const P1 = r.pts[a1], P2 = r.pts[a2], Q1 = r.pts[b1], Q2 = r.pts[b2];
      const x = Spec.lineX(P1, P2, Q1, Q2);
      if (!x) continue;
      const on = (a, b) => Spec.projectSeg(a, b, x).t > -1e-6 && Spec.projectSeg(a, b, x).t < 1 + 1e-6 && Math.hypot(Spec.projectSeg(a, b, x).x - x.x, Spec.projectSeg(a, b, x).y - x.y) < 1e-6;
      if (on(P1, P2) && on(Q1, Q2)) add("int", x.x, x.y, `จุดตัด ${straight[i].id} × ${straight[j].id}`, () => Spec.addPoint(spec, { type:"intersect", a1, a2, b1, b2 }));
    }
    if (os.mid) for (const l of straight){
      const [a, b] = l.points, P1 = r.pts[a], P2 = r.pts[b];
      add("mid", (P1.x + P2.x) / 2, (P1.y + P2.y) / 2, `กึ่งกลาง ${l.id}`, () => Spec.addPoint(spec, { type:"between", a, b, t:"0.5" }));
    }
    if (os.surf && ground && A && slopeLock()){
      // ล็อก slope แล้วลากไปทางผิวดิน = จุดที่ลาดชนดิน (daylight)
      const c = daylightCand(m, A, F, ground);
      if (c.kind === "ray") add("ray", c.x, c.y, c.label, c.make);
    }
    if (os.perp && A) for (const l of straight){
      const [a, b] = l.points, q = Spec.projectSeg(r.pts[a], r.pts[b], A);
      if (q.t > 1e-6 && q.t < 1 - 1e-6) add("perp", q.x, q.y, `ตั้งฉาก ${l.id}`, () => Spec.addPoint(spec, { type:"between", a, b, t: Expr.num(q.t) }));
    }
    if (os.surf && ground && draw.tool !== "daylight"){
      const g = ground.nearest(m.x, m.y);
      if (g){
        const from = A ? A.id : undefined, fx = A ? A.x : 0;
        add("surf", g.x, g.y, "ผิวดิน", () => Spec.addPoint(spec, { type:"onSurface", ...(from ? { from } : {}), dx: Expr.num((g.x - fx) * F), target: "TargetSurface" }));
      }
    }
    if (os.near) for (const l of straight){
      const [a, b] = l.points, q = Spec.projectSeg(r.pts[a], r.pts[b], m);
      if (q.t > 1e-6 && q.t < 1 - 1e-6) add("near", q.x, q.y, `บน ${l.id}`, () => Spec.addPoint(spec, { type:"between", a, b, t: Expr.num(q.t) }));
    }
  }
  const order = ["end", "int", "mid", "ray", "perp", "surf", "near"];
  cands.sort((p, q) => order.indexOf(p.kind) - order.indexOf(q.kind) || p.d - q.d);
  if (cands.length) return cands[0];
  if (onlyEnds) return null;
  return freePoint(m, A, F);
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
  const it = editItem(), spec = it.spec, sl = slopeLock();
  const g = v => state.bar.snap ? Math.round(v / 0.05) * 0.05 : v;
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
  draw.mouse = drawLocal(px, py);
  if (draw.typing) return;
  draw.cand = snapAt(draw.mouse);
  render();
  drawTip(px, py);
}
function drawTip(px, py){
  const c = draw.cand, A = prevPoint();
  if (!c){ tip.style.display = "none"; return; }
  const lines = [];
  if (c.label) lines.push((OSNAP_LABEL[c.kind] ? "Snap: " : "") + c.label);
  if (A && draw.tool !== "shape"){
    const dx = c.x - A.x, dy = c.y - A.y;
    lines.push(`slope ${slopeText(dx, dy)}`, `ยาว ${f3(Math.hypot(dx, dy))} m · dx ${f3(dx)} · dy ${f3(dy)}`);
  } else lines.push(`offset ${f3(c.x)} · elev ${f3(c.y)} (เทียบ origin)`);
  if (draw.tool !== "shape" && draw.tool !== "follow") lines.push("Tab = พิมพ์ค่า / ชื่อ parameter");
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
  });
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
  });
  showBanner(drawBanner());
}

// ---------------- พิมพ์ค่า (Tab) ----------------
// ช่องที่เว้นว่างใช้ค่าจากเมาส์ · slope พิมพ์แบบ 1:2 ได้ (ทิศขึ้น/ลงตามเมาส์) หรือเป็นนิพจน์มีเครื่องหมาย
function openTyping(){
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
  box.querySelector(draw.tool === "daylight" ? "[data-f=slope]" : "input").focus();
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
    el("rect", { x: X(c) - 8, y: Y(c) - 8, width: 16, height: 16, class:"osnap " + c.kind }, svg);
  } else el("circle", { cx: X(c), cy: Y(c), r: 3, class:"osnap free" }, svg);
}
