// Annotations of a drawn subassembly (round 10 M2, docs/display.md): pure helpers, no DOM / state (runs in node).
//   spec.display.dims   = [{ id: "D1", kind: "h" | "v" | "aligned", a, b, offset, label: "auto" | <parameter> | null, decimals }]
//   spec.display.slopes = [{ id: "G1", link, format: "auto" | "ratio" | "percent" }]
//   spec.display.notes  = [{ id: "N1", text, at: { point, dx, dy }, leader }]   (M3)
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

  // ---------- visibility ----------
  // opts: { annot (View › Show › Annotations, default on), c3d (Civil 3D preview hides every annotation) }
  // an annotation whose point / link does not exist in the current branch / scenario is hidden
  function visible(spec, res, kind, a, opts){
    opts = opts || {};
    if (opts.c3d || opts.annot === false) return false;
    if (kind === "dim") return !!(pt(res, a.a) && pt(res, a.b));
    if (kind === "slope"){ const q = res && res.links && res.links[a.link]; return !!(q && !q.err && q.path && q.path.length >= 2); }
    return !!pt(res, a.at && a.at.point);
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
           autoLabel, labelOf, dimValue, dimText, dimGeom, offsetAt, slopeText, visible, upright, decOf };
})();
if (typeof module !== "undefined") module.exports = Display;
