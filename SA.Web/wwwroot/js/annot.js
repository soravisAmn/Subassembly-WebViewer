// Annotate tab on the page (round 10 M2 / M3, docs/display.md): Note / Note with leader, Dimension (h / v / aligned) and Slope label
// commands, drawing the annotations of a drawn item and the project's cross-item dimensions, selecting / dragging / deleting them
// and their Properties section.
//   Pure rules (values, auto label, slope text, note text, geometry, visibility, project helpers): js/display.js (Display).
//   Every spec change goes through the Logic API (addNote / addDim / addSlopeLabel / updateAnnotation / removeAnnotation) via specEdit
//   = one Undo step. Works outside Edit too: the item becomes unsaved (●) until Save (.cs).
//   A dimension whose two points are in different items is stored in the project file (WS().display, refs { item, point }) through
//   projEdit = the same Logic functions on a project doc, one Undo step (History covers WS().display); saved with Save project.
"use strict";

// tool: null | "note" | "noteL" | "h" | "v" | "aligned" | "slope"
// stage: a (first / anchor point) | b (second point) | place (dimension line / note text) | text (typing the note) | link (slope)
// a / b = { item, id }
const ann = { tool: null, stage: null, a: null, b: null, mouse: null, hover: null };
// while dragging: { item, id, offset } (dimension line) | { item, id, at: { dx, dy } } (note text) | { proj: true, id, offset }
let annDrag = null;
const projMsgs = [];                 // project-level messages for the Messages palette (cross-item annotations removed)
const ANN_TOOL_NAME = { note: "Note", noteL: "Note with leader", h: "Dimension แนวราบ", v: "Dimension แนวดิ่ง", aligned: "Dimension แนวเอียง", slope: "Slope label" };
const ANN_KIND_TH = { h: "แนวราบ", v: "แนวดิ่ง", aligned: "แนวเอียง" };
const isNoteTool = t => t === "note" || t === "noteL";
const isDimTool = t => t === "h" || t === "v" || t === "aligned";
const annTextPx = () => Style.textSize(curStyle());

// ---------------- the command ----------------
function annStart(tool){
  if (draw.tool) setTool(null);
  if (cmd.name) endCmd();
  closeTyping();
  const items = annItems();
  if (!items.length) return flashBanner("ยังไม่มี subassembly ที่วาด — Note / Dimension / Slope label ใช้ได้กับส่วนที่วาด (มี point id) เท่านั้น");
  Object.assign(ann, { tool, stage: tool === "slope" ? "link" : "a", a: null, b: null, mouse: null, hover: null });
  if (!showNow().annot) flashBanner(state.bar.c3d ? "ดูแบบ Civil 3D อยู่ — ที่สร้างจะยังไม่เห็นบนรูป" : "View › Show › Annotations ปิดอยู่ — ที่สร้างจะยังไม่เห็นบนรูป");
  annBanner(); render();
  if (typeof updateRibbon === "function") updateRibbon();
}
function annEnd(msg){
  if (!ann.tool) return;
  Object.assign(ann, { tool: null, stage: null, a: null, b: null, mouse: null, hover: null });
  closeTyping(); tip.style.display = "none"; showBanner("");
  if (msg) flashBanner(msg);
  render();
  if (typeof updateRibbon === "function") updateRibbon();
}
function annBanner(){
  const N = ANN_TOOL_NAME[ann.tool];
  const st = ann.stage;
  if (isNoteTool(ann.tool)){
    showBanner(st === "a" ? `${N}: คลิกจุดที่ข้อความผูกอยู่ · Esc = ยกเลิก`
             : st === "place" ? `${N} ที่ ${ann.a.id}: คลิกวางข้อความ · Esc = ยกเลิก`
             : `${N} ที่ ${ann.a.id}: พิมพ์ข้อความ ({ชื่อ parameter} = แสดงค่า) · Enter = ตกลง · Esc = ยกเลิก`);
    return;
  }
  showBanner(st === "a" ? `${N}: คลิกจุดแรก · Esc = ยกเลิก`
           : st === "b" ? `${N}: คลิกจุดที่สอง (จาก ${ann.a.id}) · จุดของอีกตัว = เก็บในไฟล์ project · Esc = ยกเลิก`
           : st === "place" ? `${N} ${ann.a.id}–${ann.b.id}: คลิกวางเส้นบอกระยะ · Tab / พิมพ์ตัวเลข = พิมพ์ระยะห่าง · Esc = ยกเลิก`
           : `${N}: คลิก link เส้นตรง · Esc = ยกเลิก`);
}
// a drawn item whose .cs cannot be written (hand-written file without an SA-DRAWING block): no display data, it could never be saved
const annCantSave = it => it && it.spec && !canSaveDrawing(it) ? `${itemLabel(it)}: ไฟล์ที่เขียนเองยังไม่มีช่วง SA-DRAWING — บันทึก annotation / style ลง .cs ไม่ได้` : null;
// items that can take annotation picks now: drawn items (sa-spec) · in Edit only the edited one · not while an AI proposal
// is pending on it (its annotations are hidden then, and accepting replaces its spec)
const annItems = () => allItems().filter(it => it.spec && drawRes[it.id] && (!state.editing || it.id === state.editing) && !Proposals.pendingFor(it.id));
const annLocal = (it, px, py) => { const r = drawRes[it.id]; return { x: wx(px) - r.ox, y: wy(py) - r.oy }; };
// world position of a picked point { item, id } (+ flip of its item) or null
function annWorld(ref){
  const it = ref && itemById(ref.item), r = it && drawRes[it.id], q = r && Display.pt(r, ref.id);
  return q ? { x: r.ox + q.x, y: r.oy + q.y, flip: r.flip } : null;
}
// world position of a project ref { item, point }: null when the item is missing / has no drawing (file missing) / has a pending
// AI proposal / the point does not occur now
function projLook(ref){
  const it = itemById(ref.item);
  if (!it || !it.spec || Proposals.pendingFor(it.id)) return null;
  return annWorld({ item: it.id, id: ref.point });
}
// nearest real point (point id) of a drawn item within SNAP_PX
function annPickPoint(px, py){
  let best = null, bestD = SNAP_PX;
  for (const it of annItems()){
    const r = drawRes[it.id];
    for (const p of it.spec.points){
      const q = r.pts[p.id];
      if (!q || q.err || Spec.isAux(p) && !auxShown()) continue;
      const d = Math.hypot(sx(r.ox + q.x) - px, sy(r.oy + q.y) - py);
      if (d < bestD){ bestD = d; best = { item: it.id, id: p.id }; }
    }
  }
  return best;
}
// nearest straight link within 7 px
function annPickLink(px, py){
  let best = null, bestD = 7;
  for (const it of annItems()){
    const r = drawRes[it.id];
    for (const l of it.spec.links){
      const q = r.links[l.id];
      if (!Display.isStraight(l) || !q || q.err || !q.path || Spec.isAux(l) && !auxShown()) continue;
      const a = q.path[0], b = q.path[q.path.length - 1];
      const d = segDistPx(px, py, sx(r.ox + a.x), sy(r.oy + a.y), sx(r.ox + b.x), sy(r.oy + b.y));
      if (d < bestD){ bestD = d; best = { item: it.id, id: l.id }; }
    }
  }
  return best;
}
function segDistPx(px, py, ax, ay, bx, by){
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function annMove(px, py){
  if (ann.stage === "text") return;
  ann.mouse = { px, py };
  ann.hover = ann.stage === "link" ? annPickLink(px, py) : ann.stage === "place" ? null : annPickPoint(px, py);
  render();
}
function annClick(px, py){
  if (ann.stage === "text") return;                         // the note box is open: Enter / Esc
  if (ann.stage === "link"){
    const h = annPickLink(px, py);
    if (!h) return flashBanner("ต้องเลือก link เส้นตรง");
    const it = itemById(h.item);
    if (annCantSave(it)) return flashBanner(annCantSave(it));
    const r = specEdit(sp => Logic.addSlopeLabel(sp, { link: h.id }), it, `Slope label ${h.id}`);
    return annDone(it, r);
  }
  if (ann.stage === "a" || ann.stage === "b"){
    const h = annPickPoint(px, py);
    if (!h){ flashBanner("ต้องเลือกจุด"); return; }
    if (ann.stage === "a" && annCantSave(itemById(h.item))){ flashBanner(annCantSave(itemById(h.item))); return; }
    if (ann.stage === "a"){ ann.a = h; ann.stage = isNoteTool(ann.tool) ? "place" : "b"; ann.mouse = { px, py }; annBanner(); render(); return; }
    if (h.item === ann.a.item && h.id === ann.a.id){ flashBanner("เลือกจุดที่ต่างจากจุดแรก"); return; }
    // same item: its .cs (an item that cannot be saved is refused) · another item: the project file
    if (h.item === ann.a.item && annCantSave(itemById(h.item))){ flashBanner(annCantSave(itemById(h.item))); return; }
    ann.b = h; ann.stage = "place"; ann.mouse = { px, py }; annBanner(); render(); return;
  }
  if (ann.stage === "place"){
    if (isNoteTool(ann.tool)) return annNoteBox(px, py);
    annCommit(annOffsetAt(px, py));
  }
}
// dimension being placed: world points of the two picks (the same formula serves one item and two items)
function annPickPts(){
  const A = annWorld(ann.a), B = annWorld(ann.b);
  return A && B ? { A, B, F: A.flip === -1 ? -1 : 1 } : null;
}
// offset from the mouse position (dimension line through the mouse)
function annOffsetAt(px, py){
  const P = annPickPts();
  return P ? Display.offsetAt(ann.tool, P.A, P.B, P.F, { x: wx(px), y: wy(py) }) : 0;
}
function annCommit(offset){
  const off = +(+offset).toFixed(3);
  if (ann.a.item === ann.b.item){
    const it = itemById(ann.a.item);
    const o = { kind: ann.tool, a: ann.a.id, b: ann.b.id, offset: off };
    return annDone(it, specEdit(sp => Logic.addDim(sp, o), it, `${ANN_TOOL_NAME[ann.tool]} ${o.a}–${o.b}`));
  }
  // two items: a project-level dimension (project file), refs { item, point }
  const o = { kind: ann.tool, a: { item: ann.a.item, point: ann.a.id }, b: { item: ann.b.item, point: ann.b.id }, offset: off };
  const r = projEdit(doc => Logic.addDim(doc, o), `${ANN_TOOL_NAME[ann.tool]} ข้ามตัว ${ann.a.id}–${ann.b.id}`);
  if (!r || r.ok === false) return;
  annEnd();
  setSel({ type: "pann", id: r.result });
  flashBanner(`${r.result}: บอกระยะข้ามตัว เก็บในไฟล์ project — Save project เพื่อบันทึก`);
}
function annDone(it, r){
  if (!r || r.ok === false) return;           // the error is in the banner (specEdit)
  annEnd();
  setSel({ type: "dann", item: it.id, id: r.result });
}
// Note: an inline box at the clicked place; Enter = addNote (dx / dy from the anchor, Side = Right frame), Esc = cancel the note
function annNoteBox(px, py){
  const it = itemById(ann.a.item), r = drawRes[it.id], A = Display.pt(r, ann.a.id);
  if (!A) return annEnd("จุดนี้ไม่เกิดตอนนี้");
  const off = Display.noteOffsetAt(A, r.flip, annLocal(it, px, py));
  const at = { point: ann.a.id, dx: +off.dx.toFixed(3), dy: +off.dy.toFixed(3) }, leader = ann.tool === "noteL";
  ann.stage = "text"; ann.mouse = { px, py }; annBanner(); render();
  const box = $("dyn");
  draw.typing = true;
  box.innerHTML = `<div class="dyn-h">${esc(ANN_TOOL_NAME[ann.tool])} ที่ ${esc(at.point)}: พิมพ์ข้อความ · {Hcrest} = แสดงค่า parameter · Enter = ตกลง · Esc = ยกเลิก</div>
    <label>ข้อความ<input data-f="note" class="wide" maxlength="500" placeholder="เช่น ระดับสันเขื่อน +{Hcrest}"></label>`;
  const inp = box.querySelector("input");
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter"){
      e.preventDefault();
      const text = inp.value.trim();
      if (!text) return;
      closeTyping();
      const res = specEdit(sp => Logic.addNote(sp, { text, at, leader }), it, `${ANN_TOOL_NAME[ann.tool]} ${at.point}`);
      if (res && res.ok === false) return annEnd();
      annDone(it, res);
    } else if (e.key === "Escape"){ e.preventDefault(); annEnd(); }
    e.stopPropagation();
  });
  const mr = main.getBoundingClientRect();
  box.style.left = Math.max(4, Math.min(mr.width - 330, px + 8)) + "px";
  box.style.top = Math.max(4, Math.min(mr.height - 90, py + 12)) + "px";
  box.hidden = false; tip.style.display = "none";
  inp.focus();
}
// Tab / a digit while placing a dimension: type the distance of the dimension line (drawing units, sign = side)
function annTyping(first){
  if (ann.stage !== "place" || !isDimTool(ann.tool)) return;
  const box = $("dyn"), m = ann.mouse ? annOffsetAt(ann.mouse.px, ann.mouse.py) : 0;
  draw.typing = true;
  box.innerHTML = `<div class="dyn-h">${esc(ANN_TOOL_NAME[ann.tool])}: ระยะห่างของเส้นบอกระยะจากกึ่งกลางของสองจุด (m) · เว้นว่าง = ตามเมาส์ · Enter = ตกลง · Esc = ยกเลิก</div>
    <label>ระยะห่าง<input data-f="off" placeholder="${f3(m)}"></label>`;
  const inp = box.querySelector("input");
  inp.addEventListener("input", () => { const ok = !inp.value.trim() || isFinite(Expr.value(inp.value.trim(), {})); inp.classList.toggle("bad", !ok); });
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter"){
      e.preventDefault();
      const t = inp.value.trim(), v = t ? Expr.value(t, {}) : m;
      if (!isFinite(v)) return;
      closeTyping(); annCommit(v);
    } else if (e.key === "Escape"){ e.preventDefault(); closeTyping(); }
    e.stopPropagation();
  });
  const mr = main.getBoundingClientRect(), p = ann.mouse || { px: mr.width / 2, py: mr.height / 2 };
  box.style.left = Math.max(4, Math.min(mr.width - 330, p.px + 16)) + "px";
  box.style.top = Math.max(4, Math.min(mr.height - 90, p.py + 20)) + "px";
  box.hidden = false; tip.style.display = "none";
  inp.focus();
  if (first){ inp.value = first; inp.dispatchEvent(new Event("input")); }
}
// keys while the command runs (main.js): true = handled
function annKey(e){
  if (!ann.tool) return false;
  if (e.key === "Escape"){ annEnd(); return true; }
  if (!isDimTool(ann.tool) || ann.stage !== "place") return false;
  if (e.key === "Tab"){ e.preventDefault(); annTyping(); return true; }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[0-9.\-]$/.test(e.key)){ e.preventDefault(); annTyping(e.key); return true; }
  return false;
}

// ---------------- project-level annotations ----------------
// one Undo step on the project's display (WS().display) through the Logic API on a project doc (Display.projDoc)
function projEdit(fn, label){
  History.act(label || "แก้ annotation ข้ามตัว");
  const doc = Display.projDoc(WS().display, allItems());
  const r = fn(doc);
  if (r && r.ok === false){
    if (r.error) flashBanner(r.error);
    persist(); renderAll();                 // like specEdit: nothing changed, so History drops the label (the next change does not inherit it)
    return r;
  }
  if (doc.display) WS().display = doc.display; else delete WS().display;
  persist(); renderAll();
  return r;
}
// project-level messages belong to the workspace as it was: cleared on project open / new / scratch and on Undo / Redo
function projMsgsClear(){ projMsgs.length = 0; }
const projAnnFind = id => { const d = WS().display; return d ? Display.find({ display: d }, id) : null; };
// after an item / a point is removed (removeItem, removeAsm, specEdit): drop the project annotations bound to it, in the same
// Undo step, with a warning in Messages. An item whose .cs is missing (no spec) keeps its annotations, hidden.
function projCascade(){
  if (!WS().display) return;
  const { display, lost } = Display.projPrune(WS().display, allItems());
  if (!lost.length) return;
  if (display) WS().display = display; else delete WS().display;
  const msg = `ลบ annotation ข้ามตัว ${lost.map(x => x.id).join(", ")} ไปด้วย (${[...new Set(lost.map(x => x.why))].join("; ")})`;
  projMsgs.push(msg);
  if (projMsgs.length > 5) projMsgs.shift();
  flashBanner(msg);
}

// ---------------- drawing ----------------
function annDefs(){
  if (svg.querySelector("#ann-arr")) return;
  const defs = el("defs", {}, svg);
  const mk = el("marker", { id: "ann-arr", viewBox: "0 0 10 10", refX: 10, refY: 5, markerWidth: 9, markerHeight: 9,
                            markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs);
  el("path", { d: "M0 1.5L10 5L0 8.5Z", class: "ann-arrow" }, mk);
}
// one dimension: A / B / p1 / p2 in screen px, text, classes, data attributes of the hit targets
function drawDim(g, s, txt, fs, cls, attrs){
  annDefs();
  for (const [P, S] of [[s.A, s.p1], [s.B, s.p2]]) extLine(P, S, g, cls);
  el("path", { d: `M${s.p1.x} ${s.p1.y}L${s.p2.x} ${s.p2.y}`, class: cls + " ann-line", "marker-start": "url(#ann-arr)", "marker-end": "url(#ann-arr)" }, g);
  if (attrs) el("path", { d: `M${s.p1.x} ${s.p1.y}L${s.p2.x} ${s.p2.y}`, class: "ann-hit", ...attrs }, g);
  annText(txt, s.p1, s.p2, fs, g, cls, attrs || {});
}
// screen points of a dimension from points in a frame placed at (ox, oy)
function dimScreen(d, A, B, F, off, ox, oy){
  const { p1, p2 } = Display.dimGeom(d, A, B, F, off);
  const S = p => ({ x: sx(ox + p.x), y: sy(oy + p.y) });
  return { A: S(A), B: S(B), p1: S(p1), p2: S(p2) };
}
// the result an annotation is drawn from: the current one, or (editing the item with "show all cases") the all-branches
// result, ghosted, when its point / link does not occur now (prompt 1.2)
function annRes(it, r, kind, a){
  if (Display.visible(it.spec, r, kind, a, {})) return { res: r, ghost: false };
  if (r.ghost && showAllCases(it) && Display.visible(it.spec, r.ghost, kind, a, {})) return { res: r.ghost, ghost: true };
  return null;
}
// the annotations of one drawn item (annotations layer, called from renderSpec through layers.ann)
function renderAnnots(it, r, grp){
  const spec = it.spec;
  if (!spec.display || !showNow().annot) return;
  const X = p => sx(r.ox + p.x), Y = p => sy(r.oy + p.y), fs = annTextPx();
  const g = el("g", { class: "annots" }, grp);
  const drag = (id, k) => annDrag && !annDrag.proj && annDrag.item === it.id && annDrag.id === id ? annDrag[k] : undefined;
  for (const d of Display.list(spec, "dim")){
    const v = annRes(it, r, "dim", d);
    if (!v) continue;
    const cls = "ann" + (selHas("dann", it.id, d.id) ? " sel" : "") + (v.ghost ? " ghost" : "");
    const s = dimScreen(d, v.res.pts[d.a], v.res.pts[d.b], r.flip, drag(d.id, "offset") ?? d.offset, r.ox, r.oy);
    drawDim(g, s, Display.dimText(spec, v.res, d), fs, cls, { "data-kind": "dann", "data-id": it.id, "data-sid": d.id });
  }
  for (const s of Display.list(spec, "slope")){
    const v = annRes(it, r, "slope", s);
    if (!v) continue;
    const q = v.res.links[s.link], a = q.path[0], b = q.path[q.path.length - 1];
    const cls = "ann ann-slope" + (selHas("dann", it.id, s.id) ? " sel" : "") + (v.ghost ? " ghost" : "");
    annText(Display.slopeText(q, s.format), { x: X(a), y: Y(a) }, { x: X(b), y: Y(b) }, fs, g, cls,
            { "data-kind": "dann", "data-id": it.id, "data-sid": s.id });
  }
  for (const n of Display.list(spec, "note")){
    const v = annRes(it, r, "note", n);
    if (!v) continue;
    const A = v.res.pts[n.at.point], at = drag(n.id, "at") || n.at;
    const { T, anchor } = Display.noteGeom({ at }, A, r.flip);
    const cls = "ann" + (selHas("dann", it.id, n.id) ? " sel" : "") + (v.ghost ? " ghost" : "");
    const L = n.leader ? Display.pt(v.res, n.leader) : null;      // a leader point that does not occur now: no leader
    noteDraw(g, Display.noteText(spec, v.res, n), { x: X(T), y: Y(T) }, anchor, L && { x: X(L), y: Y(L) }, fs, cls,
             { "data-kind": "dann", "data-id": it.id, "data-sid": n.id });
  }
}
// note: text lines from T (upright, never mirrored; anchor start / end = grows away from the point) + leader with an arrow at L
function noteDraw(g, txt, T, anchor, L, fs, cls, attrs){
  if (L){
    annDefs();
    const sx0 = T.x + (anchor === "end" ? 3 : -3);
    if (Math.hypot(L.x - sx0, L.y - T.y) > 6) el("path", { d: `M${sx0} ${T.y}L${L.x} ${L.y}`, class: cls + " ann-line", "marker-end": "url(#ann-arr)" }, g);
  }
  const t = el("text", { x: T.x, y: T.y, class: cls + " ann-txt ann-note", "text-anchor": anchor, "font-size": fs, ...attrs }, g);
  String(txt).split("\n").forEach((line, i) => {
    const sp = el("tspan", { x: T.x, dy: i ? "1.25em" : "0.35em", ...attrs }, t);     // attrs: the click may land on a tspan
    sp.textContent = line || " ";
  });
  return t;
}
// the project's cross-item dimensions (annotations layer, after the items'); hidden when an item is missing / not drawn /
// has a pending AI proposal, or a point does not occur now · in Edit they are dimmed and cannot be picked, like other items
function renderProjAnnots(L){
  const d = WS().display;
  if (!d || !showNow().annot) return;
  const fs = annTextPx(), g = el("g", { class: "item proj-ann" + (state.editing ? " locked" : "") }, L);
  for (const dim of Display.list({ display: d }, "dim")){
    const P = Display.projPoints(dim, projLook);
    if (!P) continue;
    const off = annDrag && annDrag.proj && annDrag.id === dim.id ? annDrag.offset : dim.offset;
    const s = dimScreen(dim, P.A, P.B, P.F, off, 0, 0);
    drawDim(g, s, Display.projDimText(dim, P.A, P.B), fs, "ann" + (selHas("pann", dim.id) ? " sel" : ""), { "data-kind": "pann", "data-sid": dim.id });
  }
}
// extension line: a small gap at the point, a little past the dimension line
function extLine(P, S, g, cls){
  const dx = S.x - P.x, dy = S.y - P.y, L = Math.hypot(dx, dy);
  if (L < 4) return;
  const ux = dx / L, uy = dy / L;
  el("path", { d: `M${P.x + ux * 3} ${P.y + uy * 3}L${S.x + ux * 4} ${S.y + uy * 4}`, class: cls + " ann-ext" }, g);
}
// text centred on the segment s1-s2 (screen), above it, kept upright
function annText(txt, s1, s2, fs, g, cls, attrs){
  if (!txt) return;
  const ang = Display.upright(Math.atan2(s2.y - s1.y, s2.x - s1.x) * 180 / Math.PI), rad = ang * Math.PI / 180;
  const mx = (s1.x + s2.x) / 2 + Math.sin(rad) * 4, my = (s1.y + s2.y) / 2 - Math.cos(rad) * 4;    // 4 px to the upper side of the line
  const t = el("text", { x: mx, y: my, class: cls + " ann-txt", "text-anchor": "middle", "font-size": fs, transform: `rotate(${ang.toFixed(2)} ${mx} ${my})`, ...attrs }, g);
  t.textContent = txt;
}
// the running command: picked points, hover, preview of the dimension line / note text
function renderAnnOverlay(){
  if (!ann.tool) return;
  const mark = (h, cls) => {
    const w = h && ann.stage !== "link" ? annWorld(h) : null;
    if (w) el("circle", { cx: sx(w.x), cy: sy(w.y), r: 7, class: "snap" + (cls ? " " + cls : "") }, svg);
  };
  if (ann.stage === "link" && ann.hover){
    const it = itemById(ann.hover.item), r = drawRes[it.id], q = r.links[ann.hover.id];
    if (q && q.path) el("path", { d: q.path.map((p, j) => (j ? "L" : "M") + sx(r.ox + p.x) + " " + sy(r.oy + p.y)).join(" "), class: "sel-link" }, svg);
    return;
  }
  mark(ann.a, "hot"); mark(ann.b, "hot"); mark(ann.hover, "");
  if (!ann.mouse || (ann.stage !== "place" && ann.stage !== "text")) return;
  const g = el("g", { class: "annots preview" }, svg);
  if (isNoteTool(ann.tool)){
    const A = annWorld(ann.a);
    if (!A) return;
    const T = { x: ann.mouse.px, y: ann.mouse.py }, anchor = Display.noteGeom({ at: Display.noteOffsetAt(A, A.flip, { x: wx(T.x), y: wy(T.y) }) }, A, A.flip).anchor;
    noteDraw(g, ann.stage === "text" ? "" : "ข้อความ…", T, anchor, ann.tool === "noteL" ? { x: sx(A.x), y: sy(A.y) } : null, annTextPx(), "ann", {});
    return;
  }
  const P = annPickPts();
  if (!P) return;
  const d = { kind: ann.tool, a: ann.a.id, b: ann.b.id, offset: annOffsetAt(ann.mouse.px, ann.mouse.py), label: "auto", decimals: 2 };
  const it = itemById(ann.a.item);
  const txt = ann.a.item === ann.b.item ? Display.dimText(it.spec, drawRes[it.id], d) : Display.projDimText(d, P.A, P.B);
  drawDim(g, dimScreen(d, P.A, P.B, P.F, d.offset, 0, 0), txt, annTextPx(), "ann", null);
}

// ---------------- select / drag / delete ----------------
// pointerdown on an annotation (workspace.js): drag a dimension line = offset only, a note text = dx / dy only; a click selects
function annPointerDown(t, px, py){
  const sid = t.dataset.sid;
  if (t.dataset.kind === "pann"){
    if (state.editing || !projAnnFind(sid)) return false;            // dimmed and locked in Edit, like other items
    drag = { type: "ann", proj: true, id: sid, kind: "dim", px, py, moved: false };
    return true;
  }
  const id = t.dataset.id;
  if (state.editing && id !== state.editing) return false;          // other items are locked in Edit
  const it = itemById(id), f = it && it.spec && Display.find(it.spec, sid);
  if (!f) return false;
  drag = { type: "ann", item: id, id: sid, kind: f.kind, px, py, moved: false };
  if (f.kind === "note"){
    // grab offset: where in the text the mouse took it (the text follows the mouse without a jump)
    const r = drawRes[id], A = r && (Display.pt(r, f.ann.at.point) || (r.ghost && Display.pt(r.ghost, f.ann.at.point)));
    if (!A) return false;
    const T = Display.noteGeom(f.ann, A, r.flip).T, M = annLocal(it, px, py);
    drag.grab = { x: M.x - T.x, y: M.y - T.y };
  }
  return true;
}
function annDragMove(px, py){
  if (drag.proj){
    const f = projAnnFind(drag.id), P = f && Display.projPoints(f.ann, projLook);
    if (!P) return;
    annDrag = { proj: true, id: drag.id, offset: Display.offsetAt(f.ann.kind, P.A, P.B, P.F, { x: wx(px), y: wy(py) }) };
    return render();
  }
  if (drag.kind === "slope") return;
  const it = itemById(drag.item), r = drawRes[it.id], a = Display.find(it.spec, drag.id).ann;
  const pt = id => Display.pt(r, id) || (r.ghost && Display.pt(r.ghost, id));
  if (drag.kind === "note"){
    const A = pt(a.at.point), M = annLocal(it, px, py);
    if (!A) return;
    const o = Display.noteOffsetAt(A, r.flip, { x: M.x - drag.grab.x, y: M.y - drag.grab.y });
    annDrag = { item: it.id, id: a.id, at: { ...a.at, dx: +o.dx.toFixed(3), dy: +o.dy.toFixed(3) } };
    return render();
  }
  const A = pt(a.a), B = pt(a.b);
  if (!A || !B) return;
  annDrag = { item: it.id, id: a.id, offset: Display.offsetAt(a.kind, A, B, r.flip, annLocal(it, px, py)) };
  render();
}
function annDragEnd(d){
  const cur = annDrag && annDrag.id === d.id && d.moved ? annDrag : null;
  annDrag = null;
  if (d.proj){
    if (cur) projEdit(doc => Logic.updateAnnotation(doc, d.id, { offset: +cur.offset.toFixed(3) }), `ย้ายเส้นบอกระยะ ${d.id}`);
    return setSel({ type: "pann", id: d.id });
  }
  const it = itemById(d.item);
  if (cur && it){
    const patch = cur.at ? { at: { dx: cur.at.dx, dy: cur.at.dy } } : { offset: +cur.offset.toFixed(3) };
    specEdit(sp => Logic.updateAnnotation(sp, d.id, patch), it, cur.at ? `ย้าย note ${d.id}` : `ย้ายเส้นบอกระยะ ${d.id}`);
  }
  setSel({ type: "dann", item: d.item, id: d.id });
}
// Delete with annotations selected: one Undo step (an item's annotations, or the project's)
// item annotations (dann, any number of items) and project ones (pann) together = one Undo step (History.batch)
function deleteAnnots(list){
  const proj = list.filter(o => o.type === "pann").map(o => o.id);
  const byItem = new Map();
  for (const o of list) if (o.type === "dann") byItem.set(o.item, [...(byItem.get(o.item) || []), o.id]);
  const all = [...proj, ...[...byItem.values()].flat()];
  if (!all.length) return;
  let ok = true;
  History.batch(`ลบ ${all.join(", ")}`, () => {
    if (proj.length){ const r = projEdit(doc => Logic.removeAnnotation(doc, proj)); ok = ok && !!(r && r.ok); }
    for (const [id, ids] of byItem){
      const it = itemById(id);
      if (!it) continue;
      const r = specEdit(sp => Logic.removeAnnotation(sp, ids), it);
      ok = ok && !!(r && r.ok);
    }
  });
  persist(); renderAll();
  const one = byItem.size === 1 && !proj.length ? [...byItem.keys()][0] : null;
  if (ok) setSel(state.editing ? { type: "item", item: state.editing } : one ? { type: "item", item: one } : { type: "ws" });
}

// ---------------- Properties: "Display" of an annotation ----------------
function annField(g, label, small, input){ const row = div("row", `<label>${esc(label)}${small ? `<small>${esc(small)}</small>` : ""}</label>`, g); row.appendChild(input); return input; }
function annSelect(opts, val, on){ const x = document.createElement("select"); x.innerHTML = opts.map(([v, t]) => `<option value="${esc(String(v))}">${esc(t)}</option>`).join(""); x.value = String(val); x.onchange = () => on(x.value); return x; }
function annNumber(val, step, on, min, max){
  const x = document.createElement("input"); x.type = "number"; x.step = step; x.value = val;
  if (min != null) x.min = min; if (max != null) x.max = max;
  x.onchange = () => { const v = +x.value; if (x.value !== "" && isFinite(v)) on(v); else renderProps(true); };
  return x;
}
// kind / decimals / offset rows of a dimension (item or project)
function annDimRows(g, a, edit){
  annField(g, "แนว", "", annSelect(Display.KINDS.map(k => [k, ANN_KIND_TH[k]]), a.kind, v => edit({ kind: v }, `${a.id}: แนว${ANN_KIND_TH[v]}`)));
  annField(g, "ทศนิยม", "0–6", annNumber(Display.decOf(a), 1, v => { if (Number.isInteger(v) && v >= 0 && v <= 6) edit({ decimals: v }, `${a.id}: ทศนิยม`); else renderProps(true); }, 0, 6));
  annField(g, "ระยะห่าง", "m จากกึ่งกลางสองจุด (ลากเส้นบนรูปได้)", annNumber(a.offset, 0.1, v => edit({ offset: v }, `${a.id}: ระยะห่าง`)));
}
function annHidden(g){
  if (!showNow().annot) div("hint", state.bar.c3d ? "ดูแบบ Civil 3D อยู่: ไม่แสดง annotation" : "View › Show › Annotations ปิดอยู่", g);
}
function propsAnnot(box, it, s){
  const f = Display.find(it.spec, s.id);
  if (!f) return;
  const a = f.ann, r = drawRes[it.id];
  const edit = (patch, label) => { specEdit(sp => Logic.updateAnnotation(sp, a.id, patch), it, label || `แก้ ${a.id}`); renderProps(true); };
  const g = group(box, "Display");
  if (f.kind === "dim"){
    const val = r ? Display.dimValue(it.spec, r, a) : null;
    kv(g, [["ชนิด", "Dimension " + ANN_KIND_TH[a.kind]], ["จุด", `${a.a} – ${a.b}`], ["ค่าตอนนี้", val == null ? "— (จุดไม่เกิดตอนนี้: ซ่อน)" : r && Display.dimText(it.spec, r, a)]]);
    const auto = Display.autoLabel(it.spec, a);
    const params = it.spec.params.filter(p => p.name !== (it.spec.side && it.spec.side.param)).map(p => p.name);
    const cur = a.label === null ? "\u0000none" : a.label === undefined || a.label === "auto" ? "auto" : a.label;
    annField(g, "ป้าย parameter", "", annSelect([["auto", `อัตโนมัติ${auto ? ` (${auto})` : " (ไม่พบ)"}`], ...params.map(p => [p, p]), ["\u0000none", "ไม่แสดง (ตัวเลขอย่างเดียว)"]], cur,
          v => edit({ label: v === "\u0000none" ? null : v }, `${a.id}: ป้าย parameter`)));
    annDimRows(g, a, edit);
  } else if (f.kind === "slope"){
    const q = r && r.links[a.link];
    kv(g, [["ชนิด", "Slope label"], ["Link", a.link], ["ค่าตอนนี้", q && !q.err && q.path ? Display.slopeText(q, a.format) : "— (link ไม่เกิดตอนนี้: ซ่อน)"]]);
    annField(g, "รูปแบบ", "", annSelect([["auto", "อัตโนมัติ (ชันกว่า 5 % = 1:x)"], ["ratio", "1:x"], ["percent", "%"]], a.format || "auto", v => edit({ format: v }, `${a.id}: รูปแบบ slope`)));
  } else {
    const shown = r && Display.visible(it.spec, r, "note", a, {}) ? Display.noteText(it.spec, r, a) : "— (จุดไม่เกิดตอนนี้: ซ่อน)";
    kv(g, [["ชนิด", a.leader ? "Note with leader" : "Note"], ["แสดงตอนนี้", shown]]);
    const txt = document.createElement("input"); txt.type = "text"; txt.value = a.text; txt.maxLength = 500; txt.className = "wide";
    txt.onchange = () => { const v = txt.value.trim(); if (v) edit({ text: v }, `${a.id}: ข้อความ`); else renderProps(true); };
    annField(g, "ข้อความ", "{Hcrest} = ค่า parameter · ผิด = {?}", txt);
    const pts = it.spec.points.filter(p => !Spec.isAux(p)).map(p => [p.id, p.id]);
    // a leader that pointed at the old anchor moves with it
    annField(g, "ผูกกับจุด", "", annSelect(pts, a.at.point, v => edit({ at: { point: v }, ...(a.leader && a.leader === a.at.point ? { leader: v } : {}) }, `${a.id}: ผูกกับ ${v}`)));
    const ld = a.leader === null || a.leader === undefined ? "\u0000none" : a.leader;
    annField(g, "เส้นชี้ (leader)", "", annSelect([["\u0000none", "ไม่มี"], ...pts.map(([id]) => [id, id === a.at.point ? `${id} (จุดที่ผูก)` : id])], ld,
          v => edit({ leader: v === "\u0000none" ? null : v }, `${a.id}: เส้นชี้`)));
    annField(g, "dx", "m จากจุด (ฝั่งขวา · Left สะท้อนเอง)", annNumber(a.at.dx, 0.1, v => edit({ at: { dx: v } }, `${a.id}: dx`)));
    annField(g, "dy", "m (ลากข้อความบนรูปได้)", annNumber(a.at.dy, 0.1, v => edit({ at: { dy: v } }, `${a.id}: dy`)));
  }
  div("btns", null, g).append(btn("ลบ", () => deleteAnnots([{ type: "dann", item: it.id, id: a.id }]), false, "ลบ annotation นี้ (Delete) — Ctrl+Z ย้อนได้"));
  annHidden(g);
  div("hint", "เก็บใน .cs (เฉพาะเว็บ ไม่มีผลกับ Civil 3D) · ต้อง Save (.cs) ●", g);
}
// a project-level (cross-item) dimension: same options, stored in the project file
function propsProjAnnot(box, s){
  const f = projAnnFind(s.id);
  if (!f) return;
  const a = f.ann, P = Display.projPoints(a, projLook);
  const edit = (patch, label) => { projEdit(doc => Logic.updateAnnotation(doc, a.id, patch), label || `แก้ ${a.id}`); renderProps(true); };
  const name = ref => `${itemById(ref.item) ? itemLabel(itemById(ref.item)) : ref.item}:${ref.point}`;
  const g = group(box, "Display");
  kv(g, [["ชนิด", `Dimension ${ANN_KIND_TH[a.kind]} ข้ามตัว`], ["จุด", `${name(a.a)} – ${name(a.b)}`],
         ["ค่าตอนนี้", P ? Display.projDimText(a, P.A, P.B) : "— (ตัวใดตัวหนึ่งไม่อยู่ / จุดไม่เกิดตอนนี้: ซ่อน)"]]);
  annDimRows(g, a, edit);
  div("btns", null, g).append(btn("ลบ", () => deleteAnnots([{ type: "pann", id: a.id }]), false, "ลบ annotation นี้ (Delete) — Ctrl+Z ย้อนได้"));
  annHidden(g);
  div("hint", "เก็บในไฟล์ project (จุดอยู่คนละ subassembly) · ต้อง Save project · ลบตัว / จุดที่ผูก = ลบด้วย", g);
}
// double-click an annotation = its options in Properties
svg.addEventListener("dblclick", e => { const k = e.target.dataset && e.target.dataset.kind; if ((k === "dann" || k === "pann") && typeof Dock !== "undefined") Dock.show("props"); });
