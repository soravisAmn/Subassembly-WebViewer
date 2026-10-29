// Move / Copy / Paste ของส่วนที่วาด (DrawingSpec) — ฟังก์ชันล้วน ไม่แตะ DOM / state (ทดสอบ: SA.Tests/js/ops.test.js)
//
// spec เก็บ "ความหมาย" ของจุด จึงย้ายแบบไม่ให้ความสัมพันธ์พัง:
//   จุดที่อ้างตามจุดที่ย้ายอยู่แล้ว (delta / ลาด จากจุดที่ย้าย, บนเส้น / จุดตัดที่ปลายย้ายทั้งหมด) = ตามไปเอง ไม่ต้องแก้
//   ราก: delta = แก้ dx / dy (นิพจน์อ้าง parameter เขียนต่อท้าย เช่น "Width + 1.25") · ลาด + ความยาว / ระยะ + มุม = แปลงเป็น delta
//   จุดที่ขึ้นกับ "โลกภายนอก" (ผิวดิน, บนเส้น / จุดตัดของจุดที่ไม่ย้าย, จุดของโค้ดเดิม, origin) = ไม่ย้าย + บอกเหตุผล
//     เว้นแต่ convert = แปลงเป็นระยะคงที่ (delta) แล้วย้าย
// พิกัด v / pos เป็นค่าบนจอเทียบ origin (ขวา +) · ค่าใน spec ไปทางนอก = ค่าบนจอ × F (F = -1 เมื่อ Side = Left)
"use strict";

const Ops = (() => {
  const REFS = ["from", "a", "b", "a1", "a2", "b1", "b2", "corner", "toward", "other"];
  // จุดที่ตามไปเองเมื่อจุดที่อ้างถึงย้ายทั้งหมด
  const FOLLOW = { delta: d => [d.from], polar: d => [d.from], slopeLength: d => [d.from], between: d => [d.a, d.b], intersect: d => [d.a1, d.a2, d.b1, d.b2],
                   tangent: d => [d.corner, d.toward, d.other] };
  const WHY = { origin: "เป็นจุด origin", slopeToSurface: "ลาดจนชนดิน (ตำแหน่งขึ้นกับผิวดิน)", onSurface: "อยู่บนผิวดิน",
                between: "อยู่บนเส้นของจุดที่ไม่ได้ย้าย", intersect: "เป็นจุดตัดของเส้นที่ไม่ได้ย้ายทั้งหมด", external: "เป็นจุดของโค้ดเดิม",
                tangent: "เป็นจุดสัมผัสของ Fillet ที่มุม / เส้นไม่ได้ย้ายทั้งหมด" };
  const num = v => Expr.num(v);

  // ชุดที่เลือก -> จุด / link / shape ทั้งหมดที่เกี่ยว (ปลาย link, link ของ shape)
  function expand(spec, sel){
    const P = new Set(sel.points || []), L = new Set(sel.links || []), S = new Set(sel.shapes || []);
    // polygon ด้านเท่าเป็นก้อนเดียวแบบ AutoCAD: เลือกชิ้นไหนก็ได้ทั้งรูป + จุดศูนย์กลาง (ย้าย/สำเนาแล้วยังแก้ N / R / θ ได้)
    for (const g of spec.polygons || [])
      if (g.points.some(p => P.has(p)) || g.links.some(l => L.has(l)) || S.has(g.shape)){
        P.add(g.center); g.points.forEach(p => P.add(p)); g.links.forEach(l => L.add(l)); if (g.shape) S.add(g.shape);
      }
    for (const sid of S){ const s = Spec.byId(spec.shapes, sid); if (s) s.links.forEach(l => L.add(l)); }
    // link ใช้จุดไหนบ้าง (ปลาย + จุดผ่านของ arc3 + มุมของ fillet) ย้าย / สำเนาไปด้วย
    for (const lid of L){ const l = Spec.byId(spec.links, lid); if (l) Spec.linkRefs(l).forEach(p => P.add(p)); }
    // กลุ่มหมุนเป็นก้อนเดียว: เลือกจุดไหนในกลุ่มก็ได้ทั้งกลุ่ม (ย้ายบางจุดของกลุ่มที่หมุนแล้ว ตำแหน่งจะไม่ตรงกับที่เมาส์ลาก)
    for (const g of spec.rotations || []) if (g.points.some(p => P.has(p))) g.points.forEach(p => P.add(p));
    // ลำดับตาม spec (จุดอ้างจุดที่มาก่อน — โค้ด C# ที่สร้างต้องเรียงแบบนี้)
    return { points: spec.points.filter(p => P.has(p.id)).map(p => p.id), links: spec.links.filter(l => L.has(l.id)).map(l => l.id),
             shapes: spec.shapes.filter(s => S.has(s.id)).map(s => s.id) };
  }

  // แผนการย้ายจุด ids: { moving: Set (จุดในชุดที่ขยับ), edit: [{id, how: "edit" | "convert"}], blocked: [{id, why}] }
  // assume = จุดที่ถือว่า "ไปด้วย" โดยไม่แก้ (Rotate: จุดหมุนอยู่กับที่เมื่อหมุน จุดที่อ้างจุดหมุนจึงหมุนได้)
  function plan(spec, ids, convert, assume){
    const inSet = new Set(ids), moving = new Set(assume || []), edit = [], blocked = [], done = new Set(assume || []);
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
      if (d.type === "slopeLength" || d.type === "polar" || (convert && d.type !== "origin")){ edit.push({ id, how: "convert" }); moving.add(id); return; }
      blocked.push({ id, why: WHY[d.type] || d.type });
    };
    ids.forEach(visit);
    return { moving, edit, blocked };
  }

  // ทำตามแผน: ย้าย v (บนจอ) · pos = ตำแหน่งปัจจุบันของจุด (ใช้ตอนแปลงเป็น delta) · คืน id ที่แปลงไม่ได้ (ยังไม่มีตำแหน่ง)
  // raw = ค่าก่อนหมุนของสมาชิกกลุ่มหมุน (Spec.evaluate().raw) — สมาชิกคิดในกรอบก่อนหมุน
  // กลุ่มหมุนที่สมาชิกย้ายแต่จุดหมุนไม่ย้าย = ใช้จุดหมุนใหม่ (จุด auxiliary ห่างจุดหมุนเดิม v) — ทั้งกลุ่มเลื่อนไป v โดยมุมเท่าเดิม
  function apply(spec, pl, v, F, pos, raw){
    const failed = [], grp = {};
    for (const g of spec.rotations || []) for (const id of g.points) grp[id] = g;
    const at = (viewer, id) => raw && grp[id] && grp[viewer] === grp[id] && raw[id] ? raw[id] : pos[id];
    for (const { id, how } of pl.edit){
      const p = Spec.byId(spec.points, id), d = p.def;
      if (how === "edit"){ d.dx = addExpr(d.dx, v.x * F); d.dy = addExpr(d.dy, v.y); continue; }
      const q = at(id, id);
      if (!q){ failed.push(id); continue; }
      // delta จากจุด from เดิม (ถ้ามีตำแหน่ง) ไม่งั้นจาก origin — from ที่ย้ายด้วยก็ย้ายไป v เท่ากัน
      const from = d.from && at(id, d.from) ? d.from : null, f = from ? at(id, from) : { x: 0, y: 0 };
      const fv = from && pl.moving.has(from) ? v : { x: 0, y: 0 };
      p.def = { type: "delta", ...(from ? { from } : {}), dx: num((q.x + v.x - f.x - fv.x) * F), dy: num(q.y + v.y - f.y - fv.y) };
    }
    if (Math.abs(v.x) > 1e-12 || Math.abs(v.y) > 1e-12)
      for (const g of spec.rotations || [])
        if (g.points.some(id => pl.moving.has(id)) && !pl.moving.has(g.pivot))
          g.pivot = Spec.addPoint(spec, { type: "delta", from: g.pivot, dx: num(v.x * F), dy: num(v.y) }, [], true);
    return failed;
  }

  // ---------- Rotate ----------
  // แผนการหมุนจุด ids รอบ pivot: { members (กลุ่มใหม่), merge, compose, blocked: [{id, why}] }
  //   กลุ่มหมุนเดิมที่เลือกครบ: จุดหมุนเดิม = merge (บวกมุม) · จุดหมุนอื่น + กลุ่ม "ปิด" (สมาชิกอ้างแค่กันเองกับจุดหมุนของกลุ่ม)
  //   = compose (บวกมุม + จุดหมุนของกลุ่มหมุนตามไปด้วย ดู rotate) · นอกนั้น / เลือกไม่ครบ = หมุนไม่ได้ + เหตุผล
  //   หมุนไม่ได้ = ชุดเดียวกับ Move (WHY) · จุดนอกชุดที่อยู่ "ระหว่าง" สมาชิก (สมาชิกอ้างจุดนั้น จุดนั้นอ้างสมาชิก)
  //   ถูกดึงเข้ากลุ่มด้วย (ไม่งั้นเกิดวง) — ถ้าจุดนั้นหมุนไม่ได้ สมาชิกที่อ้างมันจะไม่หมุนแทน
  // ignore = กลุ่มที่ rotate จัดการแล้ว (ตัดสมาชิกออกเฉยๆ)
  function rotatePlan(spec, ids, pivot, ignore){
    const blocked = [], merge = [], compose = [];
    let set = new Set(ids.filter(id => id !== pivot && Spec.byId(spec.points, id)));
    for (const g of spec.rotations || []){
      const inSel = g.points.filter(p => set.has(p));
      if (!inSel.length) continue;
      const all = g.points.every(p => set.has(p));
      if (ignore && ignore.has(g.id)){ g.points.forEach(p => set.delete(p)); continue; }
      const closed = g.points.every(m => Spec.refs(Spec.byId(spec.points, m).def).every(r => g.points.includes(r) || r === g.pivot));
      if (all && (g.pivot === pivot || closed)){ (g.pivot === pivot ? merge : compose).push(g.id); g.points.forEach(p => set.delete(p)); continue; }
      const why = all ? `อยู่ในกลุ่มหมุน ${g.id} ที่อ้างจุดนอกกลุ่ม — หมุนซ้ำได้ด้วยจุดหมุนเดิม (${g.pivot}) หรือแก้มุมใน Properties`
                      : `อยู่ในกลุ่มหมุน ${g.id} แล้ว (เลือกให้ครบทั้งกลุ่มเพื่อหมุนซ้ำ)`;
      for (const p of inSel){ blocked.push({ id: p, why }); set.delete(p); }
    }
    const done = new Set([...merge, ...compose, ...(ignore || [])]);
    const grouped = id => !!Spec.rotationOf(spec, id) && !done.has(Spec.rotationOf(spec, id).id);
    for (let round = 0; round < 50; round++){
      const pl = plan(spec, [...set], false, [pivot]);
      const members = [...set].filter(id => pl.moving.has(id)), M = new Set(members);
      // จุดที่ pivot อ้าง (เห็นสมาชิกเป็นค่าก่อนหมุน) ไม่ใช่วง
      const pre = new Set(), st = [pivot];
      while (st.length){ const id = st.pop(); if (!id || pre.has(id) || M.has(id)) continue; pre.add(id); const p = Spec.byId(spec.points, id); if (p) st.push(...Spec.refs(p.def)); }
      const memo = {};
      const reaches = id => {                         // id (นอกกลุ่ม) อ้างถึงสมาชิกได้ไหม
        if (id in memo) return memo[id];
        memo[id] = false;
        const p = Spec.byId(spec.points, id);
        return (memo[id] = !!p && Spec.refs(p.def).some(r => M.has(r) || (!pre.has(r) && reaches(r))));
      };
      let bridge = null, by = null;
      for (const m of members){
        const p = Spec.byId(spec.points, m);
        for (const r of Spec.refs(p.def)) if (!M.has(r) && !pre.has(r) && reaches(r)){ bridge = r; by = m; break; }
        if (bridge) break;
      }
      if (!bridge){
        const out = blocked.concat(pl.blocked);
        for (const id of set) if (!M.has(id) && !out.some(b => b.id === id)) out.push({ id, why: "หมุนไม่ได้" });
        return { members, merge, compose, blocked: out };
      }
      if (!set.has(bridge) && !grouped(bridge) && Spec.byId(spec.points, bridge)) set.add(bridge);
      else { blocked.push({ id: by, why: `อ้าง ${bridge} ซึ่งอ้างจุดในชุดที่หมุน แต่ ${bridge} หมุนไม่ได้` }); set.delete(by); }
    }
    return { members: [], merge, compose, blocked: blocked.concat([...set].map(id => ({ id, why: "หมุนไม่ได้ (โครงสร้างซับซ้อนเกิน)" }))) };
  }
  // มุมเดิม + มุมที่หมุนเพิ่ม (นิพจน์ได้)
  function addAngle(a, b){
    const s = String(b).trim();
    if (/^-?\d+(\.\d+)?$/.test(s)) return addExpr(a, +s);
    return `${a} + ${/^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : "(" + s + ")"}`;
  }
  // หมุนจุด ids รอบ pivot ด้วย angle (องศา ในกรอบ Side = Right) — คืนแผน (members, merge, blocked) และ id ของกลุ่มใหม่
  //   compose: กลุ่มเดิม (จุดหมุน c มุม θ) หมุนต่อรอบ p ด้วย β = จุดหมุนใหม่ c' (= c ที่หมุนรอบ p, อยู่ในกลุ่มใหม่) + มุม θ + β
  //   (สมาชิกที่อ้าง c เปลี่ยนไปอ้าง c' — ทุกชนิดจุดที่หมุนได้เลื่อนตามจุดที่อ้างแบบขนาน จึงได้รูปเดิมที่หมุนต่อพอดี)
  function rotate(spec, ids, pivot, angle){
    const pl = rotatePlan(spec, ids, pivot), extra = [];
    for (const id of pl.merge.concat(pl.compose)){ const g = spec.rotations.find(x => x.id === id); g.angle = addAngle(g.angle, angle); }
    for (const id of pl.compose){
      const g = spec.rotations.find(x => x.id === id), c = g.pivot;
      const c2 = Spec.addPoint(spec, { type: "delta", from: c, dx: "0", dy: "0" }, [], true);
      for (const m of g.points){ const d = Spec.byId(spec.points, m).def; for (const k of REFS) if (d[k] === c) d[k] = c2; }
      g.pivot = c2; extra.push(c2);
    }
    const pl2 = pl.compose.length ? rotatePlan(spec, ids.concat(extra), pivot, new Set([...pl.merge, ...pl.compose])) : pl;
    const g = pl2.members.length ? Spec.addRotation(spec, { pivot, angle, points: pl2.members }) : null;
    return { members: pl2.members, merge: pl.merge, compose: pl.compose, blocked: pl2.blocked, group: g ? g.id : null };
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
    // กลุ่มหมุนที่สำเนาได้ทั้งกลุ่ม (วางในตัวอื่น: มุมต้องใช้ชื่อที่ตัวใหม่มี) — สมาชิกที่ต้องแปลงเป็นค่าคงที่ใช้ตำแหน่งก่อนหมุน (opts.raw) ไม่งั้นหมุนซ้ำ
    const rots = (src.rotations || []).filter(g => g.points.every(p => P.has(p)) && (!opts.detach || !opts.names || Expr.check(String(g.angle), opts.names).ok));
    const inRot = new Set(rots.flatMap(g => g.points));
    // กลุ่มที่เอามาไม่ได้ (วางในตัวอื่น) = สมาชิกทุกจุดเป็นค่าคงที่ตามตำแหน่งที่หมุนแล้ว (รูปไม่เพี้ยน)
    const lost = new Set(opts.detach ? (src.rotations || []).filter(g => !rots.includes(g)).flatMap(g => g.points).filter(p => P.has(p)) : []);
    for (const p of src.points.filter(p => P.has(p.id))){
      const id = Spec.addPoint(dst, JSON.parse(JSON.stringify(p.def)), p.codes.slice(), Spec.isAux(p));
      map[p.id] = id; pts.push([p.id, id]);
    }
    for (const [old, id] of pts){
      const np = Spec.byId(dst.points, id);
      if (opts.detach && (lost.has(old) || mustDetach(np.def, P, opts.names))){
        const q = (inRot.has(old) && opts.raw && opts.raw[old]) || (opts.pos && opts.pos[old]);
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
      if (c.via) c.via = map[c.via] || c.via;
      if (c.corner) c.corner = map[c.corner] || c.corner;
      c.id = Spec.nextId(dst, "L");
      dst.links.push(c); lmap[l.id] = c.id; links.push(c.id);
    }
    const smap = {};
    for (const s of src.shapes.filter(s => S.has(s.id))){
      const id = Spec.addShape(dst, s.links.map(l => lmap[l] || l));
      Spec.byId(dst.shapes, id).codes = s.codes.slice();
      shapes.push(id); smap[s.id] = id;
    }
    // polygon ด้านเท่าที่สำเนามาทั้งรูป: สำเนาข้อมูล polygon ด้วย (แก้ N / R / θ ของสำเนาได้)
    for (const g of src.polygons || []){
      if (!map[g.center] || !g.points.every(p => map[p]) || !g.links.every(l => lmap[l]) || (g.shape && !smap[g.shape])) continue;
      dst.polygons = dst.polygons || [];
      let k = 0; for (const x of dst.polygons){ const m = /^G(\d+)$/.exec(x.id); if (m) k = Math.max(k, +m[1]); }
      dst.polygons.push({ ...JSON.parse(JSON.stringify(g)), id: "G" + (k + 1), center: map[g.center], points: g.points.map(p => map[p]),
                          links: g.links.map(l => lmap[l]), shape: g.shape ? smap[g.shape] : null });
    }
    // กลุ่มหมุนที่สำเนามาทั้งกลุ่ม: สำเนากลุ่มด้วย (จุดหมุนในชุด = ตัวสำเนา ไม่งั้นตัวเดิม)
    //   วางในตัวอื่น (detach) แล้วจุดหมุนไม่ได้มาด้วย = จุดหมุนใหม่ (auxiliary ค่าคงที่ตามตำแหน่งเดิม)
    for (const g of rots){
      dst.rotations = dst.rotations || [];
      let k = 0; for (const x of dst.rotations){ const m = /^R(\d+)$/.exec(x.id); if (m) k = Math.max(k, +m[1]); }
      let pivot = map[g.pivot] || (src === dst || !opts.detach ? g.pivot : null);
      if (!pivot && opts.pos && opts.pos[g.pivot]){
        const q = opts.pos[g.pivot];
        pivot = Spec.addPoint(dst, { type: "delta", dx: num(q.x * (opts.F || 1)), dy: num(q.y) }, [], true);
      }
      if (pivot) dst.rotations.push({ id: "R" + (k + 1), pivot, angle: g.angle, points: g.points.map(p => map[p]) });
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

  return { expand, plan, apply, addExpr, clone, WHY, rotatePlan, rotate, addAngle };
})();
