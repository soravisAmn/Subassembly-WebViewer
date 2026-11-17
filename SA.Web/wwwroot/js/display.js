// Annotations of a drawn subassembly (round 10 M2, docs/display.md): pure helpers, no DOM / state (runs in node).
//   spec.display.dims   = [{ id: "D1", kind: "h" | "v" | "aligned", a, b, offset, label: "auto" | <parameter> | null, decimals }]
//   spec.display.slopes = [{ id: "G1", link, format: "auto" | "ratio" | "percent" }]
//   spec.display.notes  = [{ id: "N1", text, at: { point, dx, dy }, leader: <point id> | null }]   (M3; text may hold {expression})
// Project-level (cross-item, round 10 M3): the project file's display.dims with refs { item, point } (see "project-level" below).
// Annotations are bound to point / link ids (never coordinates), so they follow parameters, scenarios, branches and Side.
// Coordinates here are the evaluated ones (Spec.evaluate: pts / links, already mirrored for Side = Left).
// offset is stored in the Side = Right frame: the distance of the dimension line from the middle of the two points
//   (h: up +, v: outward +, aligned: to the left of a -> b in the Right frame). Side Left mirrors it with F = -1.
// Web only: the generated C# ignores spec.display.
"use strict";
const Display = (() => {
  const KINDS = ["h", "v", "aligned"];
  const SLOPE_FORMATS = ["auto", "ratio", "percent"];
  const AUTO_SLOPE = 0.05;            // auto: steeper than 5 % -> 1:x, else % (user answer 6)
  const DECIMALS = 2;                 // user answer 3
  const LISTS = { dim: "dims", slope: "slopes", note: "notes" };
  const PREFIX = { dim: "D", slope: "G", note: "N" };

  const list = (spec, kind) => (spec && spec.display && Array.isArray(spec.display[LISTS[kind]]) ? spec.display[LISTS[kind]] : []);
  // every annotation of a spec: [{ kind: "dim" | "slope" | "note", ann }]
  const all = spec => Object.keys(LISTS).flatMap(kind => list(spec, kind).map(ann => ({ kind, ann })));
  const find = (spec, id) => all(spec).find(x => x.ann.id === id) || null;
  // next id of a kind (D1, G1, N1 …): never reused within a spec (display.seq keeps the highest one handed out; the Logic API updates it)
  function nextId(spec, kind){
    const seq = spec && spec.display && spec.display.seq;
    let k = +(seq && seq[PREFIX[kind]]) || 0;
    const re = new RegExp(`^${PREFIX[kind]}(\\d+)$`);
    for (const x of list(spec, kind)){ const m = re.exec(x.id || ""); if (m) k = Math.max(k, +m[1]); }
    return PREFIX[kind] + (k + 1);
  }
  // point / link ids an annotation is bound to
  function refs(kind, a){
    if (kind === "dim") return { points: [a.a, a.b], links: [] };
    if (kind === "slope") return { points: [], links: [a.link] };
    return { points: [a.at && a.at.point, a.leader].filter(Boolean), links: [] };
  }
  const isStraight = l => !!l && Array.isArray(l.points) && l.points.length === 2 && !l.type;

  // ---------- auto parameter label (decision 8) ----------
  // The two points are joined by one definition whose measured part is exactly one parameter name (a leading minus is allowed):
  //   delta dx (h) / dy (v) / dx or dy when the other is 0 (aligned) · slopeLength length measured dx (h) / dy (v) / along (aligned)
  //   · polar length (aligned). An expression such as Wcrest/2 -> no label.
  function paramName(spec, src){
    const m = /^\s*-?\s*\(?\s*([A-Za-z_]\w*)\s*\)?\s*$/.exec(String(src ?? ""));
    return m && (spec.params || []).some(p => p.name === m[1]) ? m[1] : null;
  }
  const isZero = v => v == null || /^\s*-?0*(\.0*)?\s*$/.test(String(v));
  function autoLabel(spec, dim){
    const byId = id => (spec.points || []).find(p => p.id === id);
    // a point in a rotate group (addRotateGroup): the rotation can change the measured component -> no auto label
    const rotated = new Set((spec.rotations || []).flatMap(g => g.points || []));
    if (rotated.has(dim.a) || rotated.has(dim.b)) return null;
    const origin = ((spec.points || []).find(p => p.def && p.def.type === "origin") || {}).id;
    for (const [p, other] of [[byId(dim.b), dim.a], [byId(dim.a), dim.b]]){
      if (!p || !p.def) continue;
      const d = p.def;
      if ((d.from || origin) !== other) continue;
      let src = null;
      if (d.type === "delta"){
        if (dim.kind === "h") src = d.dx;
        else if (dim.kind === "v") src = d.dy;
        else if (isZero(d.dy)) src = d.dx;
        else if (isZero(d.dx)) src = d.dy;
      } else if (d.type === "slopeLength"){
        const m = d.measure === "dx" ? "h" : d.measure === "dy" ? "v" : "aligned";
        if (m === dim.kind) src = d.length;
      } else if (d.type === "polar" && dim.kind === "aligned") src = d.length;
      const n = src != null ? paramName(spec, src) : null;
      if (n) return n;
    }
    return null;
  }
  // the label shown after the value: "auto" -> autoLabel, a parameter name -> that name, null -> none
  function labelOf(spec, dim){
    if (dim.label === undefined || dim.label === "auto") return autoLabel(spec, dim);
    return typeof dim.label === "string" && dim.label ? dim.label : null;
  }

  // ---------- values ----------
  const pt = (res, id) => { const q = res && res.pts && res.pts[id]; return q && !q.err && isFinite(q.x) && isFinite(q.y) ? q : null; };
  // the measured value (drawing units) or null when a point does not exist now
  function dimValue(spec, res, dim){
    const A = pt(res, dim.a), B = pt(res, dim.b);
    if (!A || !B) return null;
    const dx = B.x - A.x, dy = B.y - A.y;
    return dim.kind === "h" ? Math.abs(dx) : dim.kind === "v" ? Math.abs(dy) : Math.hypot(dx, dy);
  }
  const decOf = dim => Number.isInteger(dim.decimals) && dim.decimals >= 0 && dim.decimals <= 6 ? dim.decimals : DECIMALS;
  function dimText(spec, res, dim){
    const v = dimValue(spec, res, dim);
    if (v == null) return null;
    const lb = labelOf(spec, dim);
    return v.toFixed(decOf(dim)) + (lb ? ` (${lb})` : "");
  }
  // dimension line in the evaluated frame: p1 / p2 = ends on the dimension line (extension lines run A -> p1, B -> p2)
  //   F = res.flip (Side Left = -1 mirrors the outward offsets) · offset defaults to dim.offset
  function dimGeom(dim, A, B, F, offset){
    const off = +(offset ?? dim.offset) || 0, f = F === -1 ? -1 : 1;
    const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    if (dim.kind === "h"){ const y = mid.y + off; return { p1: { x: A.x, y }, p2: { x: B.x, y } }; }
    if (dim.kind === "v"){ const x = mid.x + f * off; return { p1: { x, y: A.y }, p2: { x, y: B.y } }; }
    const n = normal(A, B), e = f * off;
    return { p1: { x: A.x + n.x * e, y: A.y + n.y * e }, p2: { x: B.x + n.x * e, y: B.y + n.y * e } };
  }
  function normal(A, B){
    const L = Math.hypot(B.x - A.x, B.y - A.y);
    return L < 1e-12 ? { x: 0, y: 1 } : { x: -(B.y - A.y) / L, y: (B.x - A.x) / L };
  }
  // the offset that puts the dimension line through M (dragging / placing with the mouse)
  function offsetAt(kind, A, B, F, M){
    const f = F === -1 ? -1 : 1, mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    if (kind === "h") return M.y - mid.y;
    if (kind === "v") return f * (M.x - mid.x);
    const n = normal(A, B);
    return f * ((M.x - mid.x) * n.x + (M.y - mid.y) * n.y);
  }

  // ---------- slope labels ----------
  // g = { dx, dy } (run, rise) or an evaluated link { path } · ratio 1:x (x = run / rise, 2 decimals) · percent 5.0% · no sign (direction is in the drawing)
  function slopeText(g, format){
    if (g && g.path){ const a = g.path[0], b = g.path[g.path.length - 1]; g = { dx: b.x - a.x, dy: b.y - a.y }; }
    const run = Math.abs(+g.dx || 0), rise = Math.abs(+g.dy || 0);
    const fmt = SLOPE_FORMATS.includes(format) ? format : "auto";
    const ratio = () => "1:" + (rise < 1e-12 ? "∞" : (run / rise).toFixed(2));
    const pct = () => (run < 1e-12 ? "∞" : (rise / run * 100).toFixed(1)) + "%";
    if (fmt === "ratio") return ratio();
    if (fmt === "percent") return pct();
    return run < 1e-12 || rise / run > AUTO_SLOPE + 1e-12 ? ratio() : pct();
  }

  // ---------- notes (M3) ----------
  // {expression} in note text -> its current value (same Expr as number fields: parameters, variables, PX / PY of points ...);
  // an unknown name / bad expression / not a number -> {?}. Values: up to 3 decimals, trailing zeros dropped.
  const EXPR_IN_TEXT = /\{([^{}]*)\}/g;
  function fmtNum(v){ const r = Math.round(v * 1000) / 1000; return String(Object.is(r, -0) ? 0 : r); }
  function exprCtx(spec, res){
    const F = res && res.flip === -1 ? -1 : 1;
    const need = id => { const q = pt(res, id); if (!q) throw new Error(`no point ${id}`); return q; };
    const conds = (res && res.logic && res.logic.conds) || {};
    return { px: id => F * need(id).x, py: id => need(id).y, exists: id => !!pt(res, id), hasGround: () => false,
             ground: () => { throw new Error("ground"); },
             isCond: n => n in conds, cond: n => { if (conds[n] == null) throw new Error("unknown"); return conds[n]; },
             count: id => { const L = res && res.logic && res.logic.loops, g = ((spec && spec.arrays) || []).find(a => a.id === id);
                            if (!g) throw new Error(`no array ${id}`); return L && L[id] != null ? L[id] : g.n; } };
  }
  // value of one {...} part: a number string, or null when it cannot be shown (Expr is loaded before display.js)
  function exprPart(spec, res, src){
    const t = String(src).trim();
    if (!t || !res || !res.env || typeof Expr === "undefined") return null;
    try{ const v = Expr.value(t, res.env, exprCtx(spec, res)); return typeof v === "number" && isFinite(v) ? fmtNum(v) : null; }
    catch{ return null; }
  }
  // the text shown for a note (res = Spec.evaluate result of the item): "{Hcrest}" -> "2.5", a bad part -> "{?}"
  const noteText = (spec, res, note) => String((note && note.text) ?? "").replace(EXPR_IN_TEXT, (m, e) => exprPart(spec, res, e) ?? "{?}");
  // position of the note text in the evaluated frame: anchor A + (F*dx, dy) (dx / dy stored in the Side = Right frame,
  // so Side Left mirrors the position; the text itself is never mirrored). anchor = SVG text-anchor (text grows away from the point)
  function noteGeom(note, A, F){
    const f = F === -1 ? -1 : 1, at = note.at || {}, dx = +at.dx || 0, dy = +at.dy || 0;
    return { T: { x: A.x + f * dx, y: A.y + dy }, anchor: f * dx < 0 ? "end" : "start" };
  }
  // dx / dy that put the note text at T (dragging the text)
  const noteOffsetAt = (A, F, T) => ({ dx: (F === -1 ? -1 : 1) * (T.x - A.x), dy: T.y - A.y });

  // ---------- show flags ----------
  // which display groups are drawn now: Civil 3D preview hides all four and keeps their values (decision 11)
  // bar = state.bar, showCodes = state.showCodes (codes are not a bar value)
  function showFlags(bar, showCodes){
    bar = bar || {};
    const c3d = !!bar.c3d;
    return { style: !c3d && bar.style !== false, annot: !c3d && bar.annot !== false, codes: !c3d && !!showCodes, ptnames: !c3d && !!bar.ptnames };
  }

  // ---------- project-level (cross-item) annotations (M3) ----------
  // The project file's "display" = { dims: [{ id, kind, a: { item, point }, b: { item, point }, offset, label: "auto" | null, decimals }], seq }.
  // The Logic API works on a "project doc" { display, items: { <item id>: { points: [ids] | null } } } (projDoc), so the same
  // addDim / updateAnnotation / removeAnnotation validate item-qualified refs. Only dimensions span items (a note / slope label belongs to one item).
  // items = [{ id, spec }] (workspace items; one without a spec has points: null: nothing can be added on it, existing ones stay hidden)
  function projDoc(display, items){
    const doc = { items: {} };
    if (display && typeof display === "object") doc.display = JSON.parse(JSON.stringify(display));
    for (const it of items || []) doc.items[it.id] = { points: it.spec ? (it.spec.points || []).map(p => p.id) : null };
    return doc;
  }
  const isRef = r => !!r && typeof r === "object" && typeof r.item === "string" && typeof r.point === "string";
  const refText = r => isRef(r) ? `${r.item}:${r.point}` : JSON.stringify(r);
  // world points of a project dimension. look(ref) -> { x, y, flip } | null (item missing / not placed / point not occurring)
  function projPoints(dim, look){
    const A = isRef(dim.a) ? look(dim.a) : null, B = isRef(dim.b) ? look(dim.b) : null;
    return A && B ? { A, B, F: A.flip === -1 ? -1 : 1 } : null;
  }
  // text of a project dimension: the value only (no parameter label: the two points are in different items)
  function projDimText(dim, A, B){
    const v = dimValue(null, { pts: { a: A, b: B } }, { kind: dim.kind, a: "a", b: "b" });
    return v == null ? null : v.toFixed(decOf(dim));
  }
  // remove project annotations bound to a removed item / point. items = [{ id, spec }] now in the workspace.
  //   An item with no spec (file missing) keeps its annotations (hidden); only a removed item or a point gone from a loaded spec removes them.
  //   Returns { display (cleaned copy, or null when empty), lost: [{ id, why }] }
  function projPrune(display, items){
    const by = new Map((items || []).map(it => [it.id, it]));
    const lost = [];
    if (!display || typeof display !== "object") return { display: null, lost };
    const d = JSON.parse(JSON.stringify(display));
    const why = r => {
      if (!isRef(r)) return "bad reference";
      const it = by.get(r.item);
      if (!it) return `subassembly ${r.item} removed`;
      if (it.spec && !(it.spec.points || []).some(p => p.id === r.point)) return `point ${r.point} removed`;
      return null;
    };
    for (const k of Object.values(LISTS)) if (Array.isArray(d[k])) d[k] = d[k].filter(x => {
      const w = [x.a, x.b].map(why).find(Boolean);
      if (w) lost.push({ id: x.id, why: w });
      return !w;
    });
    for (const k of Object.values(LISTS)) if (k in d && (!Array.isArray(d[k]) || !d[k].length)) delete d[k];
    if ("seq" in d && (!d.seq || typeof d.seq !== "object" || !Object.keys(d.seq).length)) delete d.seq;
    return { display: Object.keys(d).length ? d : null, lost };
  }

  // ---------- visibility ----------
  // opts: { annot (View › Show › Annotations, default on), c3d (Civil 3D preview hides every annotation) }
  // an annotation whose point / link does not exist in the current branch / scenario is hidden
  function visible(spec, res, kind, a, opts){
    opts = opts || {};
    if (opts.c3d || opts.annot === false) return false;
    if (kind === "dim") return !!(pt(res, a.a) && pt(res, a.b));
    if (kind === "slope"){ const q = res && res.links && res.links[a.link]; return !!(q && !q.err && q.path && q.path.length >= 2); }
    return !!pt(res, a.at && a.at.point);          // note: its anchor point (a leader point that does not occur only hides the leader)
  }
  // upright text angle (degrees, screen): normalised to -90 … 90 (vertical = -90, read from the right as in AutoCAD)
  // so text is never upside down or mirrored
  function upright(deg){
    let a = ((deg % 360) + 360) % 360;
    if (a > 180) a -= 360;
    if (a >= 90) a -= 180; else if (a < -90) a += 180;
    return a;
  }

  return { KINDS, SLOPE_FORMATS, AUTO_SLOPE, DECIMALS, PREFIX, list, all, find, nextId, refs, isStraight, paramName,
           autoLabel, labelOf, dimValue, dimText, dimGeom, offsetAt, slopeText, visible, upright, decOf,
           noteText, noteGeom, noteOffsetAt, showFlags, projDoc, isRef, refText, projPoints, projDimText, projPrune, pt };
})();
if (typeof module !== "undefined") module.exports = Display;
