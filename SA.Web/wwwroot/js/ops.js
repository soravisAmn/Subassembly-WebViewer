// Move / Copy / Paste ของส่วนที่วาด (DrawingSpec) — ฟังก์ชันล้วน ไม่แตะ DOM / state (ทดสอบ: SA.Tests/js/ops.test.js)
//
// spec เก็บ "ความหมาย" ของจุด จึงย้ายแบบไม่ให้ความสัมพันธ์พัง:
//   จุดที่อ้างตามจุดที่ย้ายอยู่แล้ว (delta / ลาด จากจุดที่ย้าย, บนเส้น / จุดตัดที่ปลายย้ายทั้งหมด) = ตามไปเอง ไม่ต้องแก้
//   ราก: delta = แก้ dx / dy (นิพจน์อ้าง parameter เขียนต่อท้าย เช่น "Width + 1.25") · ลาด + ความยาว = แปลงเป็น delta
//   จุดที่ขึ้นกับ "โลกภายนอก" (ผิวดิน, บนเส้น / จุดตัดของจุดที่ไม่ย้าย, จุดของโค้ดเดิม, origin) = ไม่ย้าย + บอกเหตุผล
//     เว้นแต่ convert = แปลงเป็นระยะคงที่ (delta) แล้วย้าย
// พิกัด v / pos เป็นค่าบนจอเทียบ origin (ขวา +) · ค่าใน spec ไปทางนอก = ค่าบนจอ × F (F = -1 เมื่อ Side = Left)
"use strict";

const Ops = (() => {
  const REFS = ["from", "a", "b", "a1", "a2", "b1", "b2"];
  // จุดที่ตามไปเองเมื่อจุดที่อ้างถึงย้ายทั้งหมด
  const FOLLOW = { delta: d => [d.from], slopeLength: d => [d.from], between: d => [d.a, d.b], intersect: d => [d.a1, d.a2, d.b1, d.b2] };
  const WHY = { origin: "เป็นจุด origin", slopeToSurface: "ลาดจนชนดิน (ตำแหน่งขึ้นกับผิวดิน)", onSurface: "อยู่บนผิวดิน",
                between: "อยู่บนเส้นของจุดที่ไม่ได้ย้าย", intersect: "เป็นจุดตัดของเส้นที่ไม่ได้ย้ายทั้งหมด", external: "เป็นจุดของโค้ดเดิม" };
  const num = v => Expr.num(v);

  // ชุดที่เลือก -> จุด / link / shape ทั้งหมดที่เกี่ยว (ปลาย link, link ของ shape)
  function expand(spec, sel){
    const P = new Set(sel.points || []), L = new Set(sel.links || []), S = new Set(sel.shapes || []);
    for (const sid of S){ const s = Spec.byId(spec.shapes, sid); if (s) s.links.forEach(l => L.add(l)); }
    for (const lid of L){ const l = Spec.byId(spec.links, lid); if (l) Spec.linkEnds(l).forEach(p => P.add(p)); }
    // ลำดับตาม spec (จุดอ้างจุดที่มาก่อน — โค้ด C# ที่สร้างต้องเรียงแบบนี้)
    return { points: spec.points.filter(p => P.has(p.id)).map(p => p.id), links: spec.links.filter(l => L.has(l.id)).map(l => l.id),
             shapes: spec.shapes.filter(s => S.has(s.id)).map(s => s.id) };
  }

  // แผนการย้ายจุด ids: { moving: Set (จุดในชุดที่ขยับ), edit: [{id, how: "edit" | "convert"}], blocked: [{id, why}] }
  function plan(spec, ids, convert){
    const inSet = new Set(ids), moving = new Set(), edit = [], blocked = [], done = new Set();
    const visit = id => {
      if (done.has(id)) return;
      done.add(id);
      const p = Spec.byId(spec.points, id);
      if (!p) return;
      const d = p.def;
      for (const r of Spec.refs(d)) if (inSet.has(r)) visit(r);
      const f = FOLLOW[d.type];
      if (f && f(d).every(r => r && moving.has(r))){ moving.add(id); return; }
      if (d.type === "delta"){ edit.push({ id, how: "edit" }); moving.add(id); return; }
      if (d.type === "slopeLength" || (convert && d.type !== "origin")){ edit.push({ id, how: "convert" }); moving.add(id); return; }
      blocked.push({ id, why: WHY[d.type] || d.type });
    };
    ids.forEach(visit);
    return { moving, edit, blocked };
  }

  // ทำตามแผน: ย้าย v (บนจอ) · pos = ตำแหน่งปัจจุบันของจุด (ใช้ตอนแปลงเป็น delta) · คืน id ที่แปลงไม่ได้ (ยังไม่มีตำแหน่ง)
  function apply(spec, pl, v, F, pos){
    const failed = [];
    for (const { id, how } of pl.edit){
      const p = Spec.byId(spec.points, id), d = p.def;
      if (how === "edit"){ d.dx = addExpr(d.dx, v.x * F); d.dy = addExpr(d.dy, v.y); continue; }
      const q = pos[id];
      if (!q){ failed.push(id); continue; }
      // delta จากจุด from เดิม (ถ้ามีตำแหน่ง) ไม่งั้นจาก origin — from ที่ย้ายด้วยก็ย้ายไป v เท่ากัน
      const from = d.from && pos[d.from] ? d.from : null, f = from ? pos[from] : { x: 0, y: 0 };
      const fv = from && pl.moving.has(from) ? v : { x: 0, y: 0 };
      p.def = { type: "delta", ...(from ? { from } : {}), dx: num((q.x + v.x - f.x - fv.x) * F), dy: num(q.y + v.y - f.y - fv.y) };
    }
    return failed;
  }

  // นิพจน์ + ค่าคงที่ d: ตัวเลข = รวมเป็นตัวเลข · มีค่าคงที่ต่อท้ายอยู่แล้ว ("Width + 1") = รวมเข้าไป · อื่นๆ = ต่อท้าย " + d"
  function addExpr(expr, d){
    const s = String(expr == null || expr === "" ? "0" : expr).trim();
    if (Math.abs(d) < 1e-9) return s;
    if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(s)) return num(+s + d);
    const m = /^(.*\S)\s+([+-])\s+(\d+(?:\.\d+)?)$/.exec(s);
    if (m && !/[*/(,]$/.test(m[1])){
      const c = +num((m[2] === "-" ? -1 : 1) * +m[3] + d);
      return Math.abs(c) < 1e-9 ? m[1] : `${m[1]} ${c < 0 ? "-" : "+"} ${num(Math.abs(c))}`;
    }
    return `${s} ${d < 0 ? "-" : "+"} ${num(Math.abs(d))}`;
  }

  // สำเนา frag (= expand) ของ src ลง dst — ความสัมพันธ์ในชุดอ้างกันเอง, ที่อ้างนอกชุดอ้างตัวเดิม
  // opts.detach = วางในตัวอื่น: จุดที่อ้างนอกชุด / origin / จุดของโค้ดเดิม / นิพจน์ที่ใช้ชื่อที่ไม่มี (opts.names)
  //   แปลงเป็น delta จาก origin ตามตำแหน่ง opts.pos (บนจอ) × opts.F ของตัวใหม่
  // คืน { map (id เดิม -> id ใหม่), points, links, shapes, pos (ตำแหน่งของสำเนา = ของตัวเดิม) }
  function clone(src, frag, dst, opts = {}){
    const map = {}, lmap = {}, pts = [], P = new Set(frag.points);
    for (const p of src.points.filter(p => P.has(p.id))){
      const id = Spec.addPoint(dst, JSON.parse(JSON.stringify(p.def)), p.codes.slice());
      map[p.id] = id; pts.push([p.id, id]);
    }
    for (const [old, id] of pts){
      const np = Spec.byId(dst.points, id);
      if (opts.detach && mustDetach(np.def, P, opts.names)){
        const q = opts.pos && opts.pos[old];
        np.def = { type: "delta", dx: num((q ? q.x : 0) * (opts.F || 1)), dy: num(q ? q.y : 0) };
        continue;
      }
      for (const k of REFS) if (np.def[k] && map[np.def[k]]) np.def[k] = map[np.def[k]];
    }
    const L = new Set(frag.links), S = new Set(frag.shapes), links = [], shapes = [];
    for (const l of src.links.filter(l => L.has(l.id))){
      const c = JSON.parse(JSON.stringify(l));
      if (c.points) c.points = c.points.map(p => map[p] || p);
      if (c.from) c.from = map[c.from] || c.from;
      if (c.to) c.to = map[c.to] || c.to;
      c.id = Spec.nextId(dst, "L");
      dst.links.push(c); lmap[l.id] = c.id; links.push(c.id);
    }
    for (const s of src.shapes.filter(s => S.has(s.id))){
      const id = Spec.addShape(dst, s.links.map(l => lmap[l] || l));
      Spec.byId(dst.shapes, id).codes = s.codes.slice();
      shapes.push(id);
    }
    const pos = {};
    if (opts.pos) for (const [old, id] of pts) if (opts.pos[old]) pos[id] = opts.pos[old];
    return { map, points: pts.map(x => x[1]), links, shapes, pos };
  }
  function mustDetach(def, P, names){
    if (def.type === "origin" || def.type === "external") return true;
    if (Spec.refs(def).some(r => !P.has(r))) return true;
    if (names){
      for (const k of Spec.EXPR_FIELDS[def.type] || []){
        const e = def[k];
        if (e != null && e !== "" && !Expr.check(String(e).replace(/^(-?)1:/, "$11/"), names).ok) return true;
      }
    }
    return false;
  }

  return { expand, plan, apply, addExpr, clone, WHY };
})();
