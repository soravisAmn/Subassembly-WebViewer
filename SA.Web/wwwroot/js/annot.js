// Annotate tab on the page (round 10 M2, docs/display.md): Dimension (h / v / aligned) and Slope label commands,
// drawing the annotations of a drawn item, selecting / dragging / deleting them and their Properties section.
//   Pure rules (values, auto label, slope text, geometry, visibility): js/display.js (Display).
//   Every spec change goes through the Logic API (addDim / addSlopeLabel / updateAnnotation / removeAnnotation) via specEdit = one Undo step.
//   Works outside Edit too: the item becomes unsaved (●) until Save (.cs). Both picks must be in the same item (cross-item = M3).
"use strict";

// tool: null | "h" | "v" | "aligned" | "slope" · stage: a (first point) | b (second point) | place (dimension line) · a / b = { item, id }
const ann = { tool: null, stage: null, a: null, b: null, mouse: null, hover: null };
let annDrag = null;                  // { item, id, offset } while a dimension line is dragged (drawn with this offset, saved on release)
const ANN_TOOL_NAME = { h: "Dimension แนวราบ", v: "Dimension แนวดิ่ง", aligned: "Dimension แนวเอียง", slope: "Slope label" };
const ANN_KIND_TH = { h: "แนวราบ", v: "แนวดิ่ง", aligned: "แนวเอียง" };
const annTextPx = () => Style.textSize(curStyle());
const annOpts = () => ({ annot: state.bar.annot !== false, c3d: !!state.bar.c3d });

// ---------------- the command ----------------
function annStart(tool){
  if (draw.tool) setTool(null);
  if (cmd.name) endCmd();
  closeTyping();
  const items = annItems();
  if (!items.length) return flashBanner("ยังไม่มี subassembly ที่วาด — Dimension / Slope label ใช้ได้กับส่วนที่วาด (มี point id) เท่านั้น");
  Object.assign(ann, { tool, stage: tool === "slope" ? "link" : "a", a: null, b: null, mouse: null, hover: null });
  if (state.bar.annot === false) flashBanner("View › Show › Annotations ปิดอยู่ — ที่สร้างจะยังไม่เห็นบนรูป");
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
  showBanner(st === "a" ? `${N}: คลิกจุดแรก · Esc = ยกเลิก`
           : st === "b" ? `${N}: คลิกจุดที่สอง (จาก ${ann.a.id}) · Esc = ยกเลิก`
           : st === "place" ? `${N} ${ann.a.id}–${ann.b.id}: คลิกวางเส้นบอกระยะ · Tab / พิมพ์ตัวเลข = พิมพ์ระยะห่าง · Esc = ยกเลิก`
           : `${N}: คลิก link เส้นตรง · Esc = ยกเลิก`);
}
// a drawn item whose .cs cannot be written (hand-written file without an SA-DRAWING block): no display data, it could never be saved
const annCantSave = it => it && it.spec && !canSaveDrawing(it) ? `${itemLabel(it)}: ไฟล์ที่เขียนเองยังไม่มีช่วง SA-DRAWING — บันทึก annotation / style ลง .cs ไม่ได้` : null;
// items that can hold annotations now: drawn items (sa-spec) · in Edit only the edited one
const annItems = () => allItems().filter(it => it.spec && drawRes[it.id] && (!state.editing || it.id === state.editing));
const annLocal = (it, px, py) => { const r = drawRes[it.id]; return { x: wx(px) - r.ox, y: wy(py) - r.oy }; };
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
  ann.mouse = { px, py };
  ann.hover = ann.stage === "link" ? annPickLink(px, py) : ann.stage === "place" ? null : annPickPoint(px, py);
  render();
}
function annClick(px, py){
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
    if (annCantSave(itemById(h.item))){ flashBanner(annCantSave(itemById(h.item))); return; }
    if (ann.stage === "a"){ ann.a = h; ann.stage = "b"; annBanner(); render(); return; }
    if (h.item !== ann.a.item){ flashBanner("จุดทั้งสองต้องอยู่ใน subassembly เดียวกัน (บอกระยะข้ามตัวมาในรอบถัดไป)"); return; }
    if (h.id === ann.a.id){ flashBanner("เลือกจุดที่ต่างจากจุดแรก"); return; }
    ann.b = h; ann.stage = "place"; ann.mouse = { px, py }; annBanner(); render(); return;
  }
  if (ann.stage === "place") annCommit(annOffsetAt(px, py));
}
// offset from the mouse position (dimension line through the mouse)
function annOffsetAt(px, py){
  const it = itemById(ann.a.item), r = drawRes[it.id], A = r.pts[ann.a.id], B = r.pts[ann.b.id];
  if (!A || A.err || !B || B.err) return 0;
  return Display.offsetAt(ann.tool, A, B, r.flip, annLocal(it, px, py));
}
function annCommit(offset){
  const it = itemById(ann.a.item);
  const o = { kind: ann.tool, a: ann.a.id, b: ann.b.id, offset: +(+offset).toFixed(3) };
  const r = specEdit(sp => Logic.addDim(sp, o), it, `${ANN_TOOL_NAME[ann.tool]} ${o.a}–${o.b}`);
  annDone(it, r);
}
function annDone(it, r){
  if (!r || r.ok === false) return;           // the error is in the banner (specEdit)
  annEnd();
  setSel({ type: "dann", item: it.id, id: r.result });
}
// Tab / a digit while placing: type the distance of the dimension line (drawing units, sign = side)
function annTyping(first){
  if (ann.stage !== "place") return;
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
  if (ann.stage === "place" && e.key === "Tab"){ e.preventDefault(); annTyping(); return true; }
  if (ann.stage === "place" && !e.ctrlKey && !e.metaKey && !e.altKey && /^[0-9.\-]$/.test(e.key)){ e.preventDefault(); annTyping(e.key); return true; }
  return false;
}

// ---------------- drawing ----------------
function annDefs(){
  if (svg.querySelector("#ann-arr")) return;
  const defs = el("defs", {}, svg);
  const mk = el("marker", { id: "ann-arr", viewBox: "0 0 10 10", refX: 10, refY: 5, markerWidth: 9, markerHeight: 9,
                            markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs);
  el("path", { d: "M0 1.5L10 5L0 8.5Z", class: "ann-arrow" }, mk);
}
// the annotations of one drawn item, on top of its points (called at the end of renderSpec)
function renderAnnots(it, r, grp){
  const spec = it.spec, opts = annOpts();
  if (!spec.display || opts.c3d || !opts.annot) return;
  const X = p => sx(r.ox + p.x), Y = p => sy(r.oy + p.y), fs = annTextPx();
  const g = el("g", { class: "annots" }, grp);
  for (const d of Display.list(spec, "dim")){
    if (!Display.visible(spec, r, "dim", d, opts)) continue;
    annDefs();
    const A = r.pts[d.a], B = r.pts[d.b];
    const off = annDrag && annDrag.item === it.id && annDrag.id === d.id ? annDrag.offset : d.offset;
    const { p1, p2 } = Display.dimGeom(d, A, B, r.flip, off);
    const sel = selHas("dann", it.id, d.id), cls = "ann" + (sel ? " sel" : "");
    const s1 = { x: X(p1), y: Y(p1) }, s2 = { x: X(p2), y: Y(p2) };
    for (const [P, S] of [[A, s1], [B, s2]]) extLine({ x: X(P), y: Y(P) }, S, g, cls);
    el("path", { d: `M${s1.x} ${s1.y}L${s2.x} ${s2.y}`, class: cls + " ann-line", "marker-start": "url(#ann-arr)", "marker-end": "url(#ann-arr)" }, g);
    const attrs = { "data-kind": "dann", "data-id": it.id, "data-sid": d.id };
    el("path", { d: `M${s1.x} ${s1.y}L${s2.x} ${s2.y}`, class: "ann-hit", ...attrs }, g);
    annText(Display.dimText(spec, r, d), s1, s2, fs, g, cls, attrs);
  }
  for (const s of Display.list(spec, "slope")){
    if (!Display.visible(spec, r, "slope", s, opts)) continue;
    const q = r.links[s.link], a = q.path[0], b = q.path[q.path.length - 1];
    const sel = selHas("dann", it.id, s.id);
    annText(Display.slopeText(q, s.format), { x: X(a), y: Y(a) }, { x: X(b), y: Y(b) }, fs, g, "ann ann-slope" + (sel ? " sel" : ""),
            { "data-kind": "dann", "data-id": it.id, "data-sid": s.id });
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
// the running command: picked points, hover, preview of the dimension line
function renderAnnOverlay(){
  if (!ann.tool) return;
  const mark = (h, cls) => {
    const it = h && itemById(h.item), r = it && drawRes[it.id], q = r && (ann.stage === "link" ? null : r.pts[h.id]);
    if (q && !q.err) el("circle", { cx: sx(r.ox + q.x), cy: sy(r.oy + q.y), r: 7, class: "snap" + (cls ? " " + cls : "") }, svg);
  };
  if (ann.stage === "link" && ann.hover){
    const it = itemById(ann.hover.item), r = drawRes[it.id], q = r.links[ann.hover.id];
    if (q && q.path) el("path", { d: q.path.map((p, j) => (j ? "L" : "M") + sx(r.ox + p.x) + " " + sy(r.oy + p.y)).join(" "), class: "sel-link" }, svg);
    return;
  }
  mark(ann.a, "hot"); mark(ann.b, "hot"); mark(ann.hover, "");
  if (ann.stage !== "place" || !ann.mouse) return;
  const it = itemById(ann.a.item), r = drawRes[it.id], A = r.pts[ann.a.id], B = r.pts[ann.b.id];
  if (!A || A.err || !B || B.err) return;
  const d = { kind: ann.tool, a: ann.a.id, b: ann.b.id, offset: annOffsetAt(ann.mouse.px, ann.mouse.py), label: "auto", decimals: 2 };
  const { p1, p2 } = Display.dimGeom(d, A, B, r.flip);
  const X = p => sx(r.ox + p.x), Y = p => sy(r.oy + p.y), g = el("g", { class: "annots preview" }, svg);
  annDefs();
  const s1 = { x: X(p1), y: Y(p1) }, s2 = { x: X(p2), y: Y(p2) };
  extLine({ x: X(A), y: Y(A) }, s1, g, "ann"); extLine({ x: X(B), y: Y(B) }, s2, g, "ann");
  el("path", { d: `M${s1.x} ${s1.y}L${s2.x} ${s2.y}`, class: "ann ann-line", "marker-start": "url(#ann-arr)", "marker-end": "url(#ann-arr)" }, g);
  annText(Display.dimText(it.spec, r, d), s1, s2, annTextPx(), g, "ann", {});
}

// ---------------- select / drag / delete ----------------
// pointerdown on an annotation (workspace.js): drag a dimension line = offset only; a click selects
function annPointerDown(t, px, py){
  const id = t.dataset.id, sid = t.dataset.sid;
  if (state.editing && id !== state.editing) return false;          // other items are locked in Edit
  const it = itemById(id), f = it && it.spec && Display.find(it.spec, sid);
  if (!f) return false;
  drag = { type: "ann", item: id, id: sid, kind: f.kind, px, py, moved: false };
  return true;
}
function annDragMove(px, py){
  if (drag.kind !== "dim") return;
  const it = itemById(drag.item), r = drawRes[it.id], d = Display.find(it.spec, drag.id).ann, A = r.pts[d.a], B = r.pts[d.b];
  if (!A || A.err || !B || B.err) return;
  annDrag = { item: it.id, id: d.id, offset: Display.offsetAt(d.kind, A, B, r.flip, annLocal(it, px, py)) };
  render();
}
function annDragEnd(d){
  const it = itemById(d.item), moved = d.moved && annDrag && annDrag.id === d.id;
  const off = moved ? +annDrag.offset.toFixed(3) : null;
  annDrag = null;
  if (moved && it) specEdit(sp => Logic.updateAnnotation(sp, d.id, { offset: off }), it, `ย้ายเส้นบอกระยะ ${d.id}`);
  setSel({ type: "dann", item: d.item, id: d.id });
}
// Delete with annotations selected: one Undo step
function deleteAnnots(list){
  const it = itemById(list[0].item);
  const ids = list.filter(o => o.item === it.id).map(o => o.id);
  const r = specEdit(sp => Logic.removeAnnotation(sp, ids), it, `ลบ ${ids.join(", ")}`);
  if (r && r.ok) setSel(state.editing ? { type: "item", item: state.editing } : { type: "item", item: it.id });
}

// ---------------- Properties: "Display" of an annotation ----------------
function propsAnnot(box, it, s){
  const f = Display.find(it.spec, s.id);
  if (!f) return;
  const a = f.ann, r = drawRes[it.id];
  const edit = (patch, label) => { specEdit(sp => Logic.updateAnnotation(sp, a.id, patch), it, label || `แก้ ${a.id}`); renderProps(true); };
  const g = group(box, "Display");
  const field = (label, small, input) => { const row = div("row", `<label>${esc(label)}${small ? `<small>${esc(small)}</small>` : ""}</label>`, g); row.appendChild(input); return input; };
  const selIn = (opts, val, on) => { const x = document.createElement("select"); x.innerHTML = opts.map(([v, t]) => `<option value="${esc(String(v))}">${esc(t)}</option>`).join(""); x.value = String(val); x.onchange = () => on(x.value); return x; };
  if (f.kind === "dim"){
    const val = r ? Display.dimValue(it.spec, r, a) : null;
    kv(g, [["ชนิด", "Dimension " + ANN_KIND_TH[a.kind]], ["จุด", `${a.a} – ${a.b}`], ["ค่าตอนนี้", val == null ? "— (จุดไม่เกิดตอนนี้: ซ่อน)" : r && Display.dimText(it.spec, r, a)]]);
    field("แนว", "", selIn(Display.KINDS.map(k => [k, ANN_KIND_TH[k]]), a.kind, v => edit({ kind: v }, `${a.id}: แนว${ANN_KIND_TH[v]}`)));
    const auto = Display.autoLabel(it.spec, a);
    const params = it.spec.params.filter(p => p.name !== (it.spec.side && it.spec.side.param)).map(p => p.name);
    const cur = a.label === null ? "\u0000none" : a.label === undefined || a.label === "auto" ? "auto" : a.label;
    field("ป้าย parameter", "", selIn([["auto", `อัตโนมัติ${auto ? ` (${auto})` : " (ไม่พบ)"}`], ...params.map(p => [p, p]), ["\u0000none", "ไม่แสดง (ตัวเลขอย่างเดียว)"]], cur,
          v => edit({ label: v === "\u0000none" ? null : v }, `${a.id}: ป้าย parameter`)));
    const dec = document.createElement("input"); dec.type = "number"; dec.min = 0; dec.max = 6; dec.step = 1; dec.value = Display.decOf(a);
    dec.onchange = () => { const v = +dec.value; if (Number.isInteger(v) && v >= 0 && v <= 6) edit({ decimals: v }, `${a.id}: ทศนิยม`); else renderProps(true); };
    field("ทศนิยม", "0–6", dec);
    const off = document.createElement("input"); off.type = "number"; off.step = 0.1; off.value = a.offset;
    off.onchange = () => { const v = +off.value; if (off.value !== "" && isFinite(v)) edit({ offset: v }, `${a.id}: ระยะห่าง`); else renderProps(true); };
    field("ระยะห่าง", "m จากกึ่งกลางสองจุด (ลากเส้นบนรูปได้)", off);
  } else if (f.kind === "slope"){
    const q = r && r.links[a.link];
    kv(g, [["ชนิด", "Slope label"], ["Link", a.link], ["ค่าตอนนี้", q && !q.err && q.path ? Display.slopeText(q, a.format) : "— (link ไม่เกิดตอนนี้: ซ่อน)"]]);
    field("รูปแบบ", "", selIn([["auto", "อัตโนมัติ (ชันกว่า 5 % = 1:x)"], ["ratio", "1:x"], ["percent", "%"]], a.format || "auto", v => edit({ format: v }, `${a.id}: รูปแบบ slope`)));
  }
  div("btns", null, g).append(btn("ลบ", () => deleteAnnots([{ type: "dann", item: it.id, id: a.id }]), false, "ลบ annotation นี้ (Delete) — Ctrl+Z ย้อนได้"));
  if (state.bar.c3d || state.bar.annot === false) div("hint", state.bar.c3d ? "ดูแบบ Civil 3D อยู่: ไม่แสดง annotation" : "View › Show › Annotations ปิดอยู่", g);
  div("hint", "เก็บใน .cs (เฉพาะเว็บ ไม่มีผลกับ Civil 3D) · ต้อง Save (.cs) ●", g);
}
// double-click an annotation = its options in Properties
svg.addEventListener("dblclick", e => { if (e.target.dataset && e.target.dataset.kind === "dann" && typeof Dock !== "undefined") Dock.show("props"); });
