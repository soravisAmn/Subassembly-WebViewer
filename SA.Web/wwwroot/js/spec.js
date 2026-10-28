// DrawingSpec: สิ่งที่ผู้ใช้วาดใน subassembly หนึ่งตัว เก็บเป็น "ความหมาย" ไม่ใช่แค่พิกัด
// (เช่น จุดที่วาดด้วย slope 1:2 ยาว Width เก็บเป็น { type: "slopeLength", from: "P2", slope: "-1/2", length: "Width" })
// แล้วคำนวณพิกัดใหม่ทุกครั้งที่ parameter หรือเส้น surface เปลี่ยน
//
// ระบบพิกัด: offset (ขวา +) / elevation (ขึ้น +) เทียบ origin ของ subassembly แบบเดียวกับ Points.Add
// spec เขียนไว้สำหรับ Side = Right; ฝั่งซ้าย (side.param = 1) กลับเครื่องหมายระยะแนวราบทั้งหมด (F = -1)
// slope = ระดับที่เปลี่ยน / ระยะราบที่เดินไปทาง dir (ลง = ลบ) — ระบบเดียวกับ CorridorState.IntersectSurface
//
// ชนิดจุด (def.type):
//   origin                                     จุด origin (0, 0)
//   delta          from, dx, dy                ห่างจากจุด from (ไม่มี from = origin)
//   slopeLength    from, slope, length, dir, measure   ลาด slope ไปทาง dir ยาว length
//                                              (measure: along = ตามแนวลาด, dx = ระยะราบ, dy = ระยะดิ่ง)
//   slopeToSurface from, slope, dir, target, maxDistance, layoutLength   ลาดจนชนดิน (daylight)
//   onSurface      from, dx, target            บนผิวดินที่ระยะ dx จากจุด from
//   between        a, b, t                     บนเส้น a-b ที่สัดส่วน t (0.5 = กึ่งกลาง)
//   intersect      a1, a2, b1, b2              จุดตัดของเส้น a1-a2 กับเส้น b1-b2 (ต่อเส้นออกไปได้)
//   external       code                        จุดจากโค้ดเดิมของผู้ใช้ หาด้วย point code
// ชนิด link: เส้นตรง { points: [a, b] } / วิ่งตามผิวดิน { type: "followSurface", from, to, target }
//
// ระยะสอง: point/link จะมี "cond" (เงื่อนไขการเกิด) ได้ — evaluator ตอนนี้ไม่สนใจ key ที่ไม่รู้จัก
// ไฟล์นี้ไม่ใช้ DOM เพื่อให้ node โหลดไปทดสอบได้ (SA.Tests/js)
"use strict";
const Spec = (() => {
  const POINT_TYPES = {
    origin: "Origin", delta: "ห่างจากจุด (dx, dy)", slopeLength: "ลาด + ความยาว", slopeToSurface: "ลาดจนชนดิน",
    onSurface: "บนผิวดิน", between: "บนเส้นระหว่าง 2 จุด", intersect: "จุดตัดของ 2 เส้น", external: "จุดจากโค้ดเดิม (point code)"
  };
  const MEASURES = { along: "ตามแนวลาด", dx: "ระยะราบ", dy: "ระยะดิ่ง" };

  function newSpec(className){
    return {
      version: 1, className, namespace: "TestSubassembly",
      params: [{ name: "Side", kind: "long", default: 0, displayName: "Side", min: null, max: null }],
      targets: [{ name: "TargetSurface", type: "Surface", displayName: "Target Surface" }],
      points: [{ id: "P1", codes: [], def: { type: "origin" } }],
      links: [], shapes: [],
      side: { param: "Side", mirror: true }
    };
  }
  // ไฟล์ที่เขียนเอง (import): parameter / target / Side ใช้ของไฟล์เดิม ส่วนที่วาดเพิ่มเริ่มว่าง
  function specForImported(className, codeParams){
    const side = (codeParams || []).find(p => /^side$/i.test(p.name) && p.kind === "long");
    return { version: 1, className, namespace: null, params: [], targets: [], points: [], links: [], shapes: [],
             side: side ? { param: side.name, mirror: true } : null, imported: true };
  }

  // ---------- โครงสร้าง ----------
  const refs = def => ["from", "a", "b", "a1", "a2", "b1", "b2"].map(k => def[k]).filter(Boolean);
  const linkEnds = l => l.type === "followSurface" ? [l.from, l.to] : l.points;
  const byId = (list, id) => list.find(o => o.id === id) || null;
  function nextId(spec, prefix){
    const list = prefix === "P" ? spec.points : prefix === "L" ? spec.links : spec.shapes;
    let n = 0;
    for (const o of list){ const m = new RegExp("^" + prefix + "(\\d+)$").exec(o.id); if (m) n = Math.max(n, +m[1]); }
    return prefix + (n + 1);
  }
  // ชื่อที่ใช้ในนิพจน์ได้: parameter ของ spec + parameter ตัวเลขของโค้ดเดิม
  function names(spec, codeParams){
    const s = new Set(spec.params.map(p => p.name));
    for (const p of codeParams || []) if (p.kind === "double" || p.kind === "long") s.add(p.name);
    return [...s];
  }
  // ช่องนิพจน์ของ def แต่ละชนิด
  const EXPR_FIELDS = { delta: ["dx", "dy"], slopeLength: ["slope", "length"], slopeToSurface: ["slope", "maxDistance", "layoutLength"],
                        onSurface: ["dx"], between: ["t"] };

  // ---------- คำนวณ ----------
  // ctx = { values: {ชื่อ: ค่า}, codeParams: [...], codePoints: [{x, y, codes}] (เทียบ origin),
  //         surface: [{x, y}] เทียบ origin หรือ null (ไม่มี/ไม่ได้กำหนด), extendEnds, layout }
  function evaluate(spec, ctx){
    const issues = [];
    const warn = (obj, msg) => issues.push({ level: "w", obj, msg });

    // parameter: ค่าที่ผู้ใช้ใส่ ไม่มีใช้ default; นอกขอบเขต = ใช้ค่าขอบแทน + เตือน (แบบ Depth < 2 m)
    const env = {};
    for (const p of ctx.codeParams || []){
      if (p.kind !== "double" && p.kind !== "long") continue;
      const v = (ctx.values || {})[p.name];
      env[p.name] = typeof v === "number" ? v : +p.default || 0;
    }
    for (const p of spec.params){
      let v = (ctx.values || {})[p.name];
      v = typeof v === "number" && isFinite(v) ? v : +p.default || 0;
      if (p.kind === "long") v = Math.round(v);
      if (p.min != null && v < p.min){ warn(p.name, `${p.name} = ${v} < ${p.min}, ใช้ ${p.min} แทน`); v = p.min; }
      if (p.max != null && v > p.max){ warn(p.name, `${p.name} = ${v} > ${p.max}, ใช้ ${p.max} แทน`); v = p.max; }
      env[p.name] = v;
    }
    const F = spec.side && spec.side.mirror && env[spec.side.param] === 1 ? -1 : 1;
    const ground = ctx.surface && ctx.surface.length >= 2 && !ctx.layout ? makeGround(ctx.surface, ctx.extendEnds) : null;
    const noTargetMsg = "ไม่ได้กำหนด Target Surface";
    const X = (src, what) => { try{ return Expr.value(src, env); }catch(e){ throw new Error(`${what}: ${e.message}`); } };

    const pts = {}, visiting = new Set();
    function pt(id){
      if (pts[id]) return pts[id];
      const p = byId(spec.points, id);
      if (!p) return (pts[id] = { err: `ไม่มีจุด ${id}` });
      if (visiting.has(id)) return (pts[id] = { err: `จุด ${id} อ้างถึงตัวเองเป็นวง` });
      visiting.add(id);
      let r;
      try{ r = calcPoint(p); }
      catch(e){ r = { err: e.message }; }
      visiting.delete(id);
      return (pts[id] = r);
    }
    function need(id){
      if (!id) return { x: 0, y: 0 };               // ไม่มี from = origin
      const q = pt(id);
      if (q.err) throw Object.assign(new Error(`ข้ามเพราะหาจุด ${id} ไม่ได้`), { skip: true });
      return q;
    }
    function calcPoint(p){
      const d = p.def;
      switch (d.type){
        case "origin": return { x: 0, y: 0 };
        case "delta": { const f = need(d.from); return { x: f.x + F * X(d.dx, "dx"), y: f.y + X(d.dy, "dy") }; }
        case "slopeLength": {
          const f = need(d.from), s = X(d.slope, "slope"), L = X(d.length, "length"), dir = d.dir === -1 ? -1 : 1;
          let run;
          if (d.measure === "dx") run = L;
          else if (d.measure === "dy"){ if (s === 0) throw new Error("slope = 0 ใช้ระยะดิ่งไม่ได้"); run = Math.abs(L / s); }
          else run = L / Math.sqrt(1 + s * s);
          return { x: f.x + F * dir * run, y: f.y + s * run };
        }
        case "slopeToSurface": {
          const f = need(d.from), s = X(d.slope, "slope"), dir = d.dir === -1 ? -1 : 1;
          const maxD = X(d.maxDistance ?? "50", "maxDistance");
          if (!ground){
            const run = X(d.layoutLength ?? "3", "layoutLength");
            if (!ctx.layout) warn(p.id, `${p.id} ลาดจนชนดิน: ${noTargetMsg} — วาดยาวคงที่ ${Expr.num(run)} m`);
            return { x: f.x + F * dir * run, y: f.y + s * run };
          }
          let hit = null;
          try{ hit = ground.intersect(f.x, f.y, F * dir, s); }catch{ hit = null; }
          if (hit && Math.abs(hit.x - f.x) <= maxD + 1e-9) return hit;
          warn(p.id, `${p.id} ลาดจนชนดิน: ไม่ชนผิวดินภายใน ${Expr.num(maxD)} m — หยุดที่ ${Expr.num(maxD)} m`);
          return { x: f.x + F * dir * maxD, y: f.y + s * maxD };
        }
        case "onSurface": {
          const f = need(d.from), x = f.x + F * X(d.dx, "dx");
          if (!ground){ if (!ctx.layout) warn(p.id, `${p.id} บนผิวดิน: ${noTargetMsg} — ใช้ระดับของจุดตั้งต้น`); return { x, y: f.y }; }
          return { x, y: ground.elev(x) };
        }
        case "between": {
          const a = need(d.a), b = need(d.b), t = X(d.t, "t");
          return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
        }
        case "intersect": {
          const a1 = need(d.a1), a2 = need(d.a2), b1 = need(d.b1), b2 = need(d.b2);
          const r = lineX(a1, a2, b1, b2);
          if (!r) throw new Error("เส้นทั้งสองขนานกัน ไม่มีจุดตัด");
          return r;
        }
        case "external": {
          const q = (ctx.codePoints || []).find(c => c.codes.includes(d.code));
          if (!q) throw Object.assign(new Error(`ไม่พบจุด code '${d.code}' จากโค้ดเดิม`), { skip: true });
          return { x: q.x, y: q.y };
        }
      }
      throw new Error(`ไม่รู้จักชนิดจุด ${d.type}`);
    }
    for (const p of spec.points){
      const r = pt(p.id);
      if (r.err) warn(p.id, `${p.id}: ${r.err}`);
    }

    const links = {};
    for (const l of spec.links){
      const [a, b] = linkEnds(l), A = pts[a], B = pts[b];
      if (!A || !B || A.err || B.err){ links[l.id] = { err: `ข้ามเพราะหาจุด ${!A || A.err ? a : b} ไม่ได้` }; warn(l.id, `${l.id}: ${links[l.id].err}`); continue; }
      let path = [A, B];
      if (l.type === "followSurface"){
        if (ground) path = [A, ...ground.between(A.x, B.x), B];
        else if (!ctx.layout) warn(l.id, `${l.id} วิ่งตามผิวดิน: ${noTargetMsg} — ใช้เส้นตรงแทน`);
      }
      links[l.id] = { path };
    }

    const shapes = {};
    for (const s of spec.shapes){
      const bad = s.links.find(id => !links[id] || links[id].err);
      if (bad){ shapes[s.id] = { err: `ข้ามเพราะ link ${bad} วาดไม่ได้` }; warn(s.id, `${s.id}: ${shapes[s.id].err}`); continue; }
      const poly = chain(s.links.map(id => links[id].path));
      if (!poly) warn(s.id, `${s.id}: link ต่อกันไม่เป็นรูปปิด`);
      shapes[s.id] = { poly };
    }
    return { pts, links, shapes, issues, flip: F, env };
  }

  // เรียง path ของ link ให้ต่อกันเป็นรูปปิด (เทียบจุดด้วยพิกัด)
  function chain(paths){
    const same = (p, q) => Math.abs(p.x - q.x) < 1e-7 && Math.abs(p.y - q.y) < 1e-7;
    const rest = paths.map(p => p.slice());
    if (!rest.length) return null;
    const out = rest.shift();
    while (rest.length){
      const end = out[out.length - 1];
      const k = rest.findIndex(r => same(r[0], end) || same(r[r.length - 1], end));
      if (k < 0) return null;
      const seg = rest.splice(k, 1)[0];
      if (!same(seg[0], end)) seg.reverse();
      out.push(...seg.slice(1));
    }
    if (out.length > 1 && same(out[0], out[out.length - 1])) out.pop();
    else return null;
    return out.length >= 3 ? out : null;
  }

  function lineX(a1, a2, b1, b2){
    const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
    if (Math.abs(d) < 1e-12) return null;
    const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
    return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
  }

  // ผิวดิน: ทำงานแบบเดียวกับ SimWorld ในตัวจำลอง (ElevationAtOffset / Intersect / SampleSection)
  // เพื่อให้ผลตรงกับโค้ด C# ที่ generate แล้วรันกับตัวจำลอง
  function makeGround(surface, extendEnds){
    const s = surface.slice().sort((p, q) => p.x - q.x);
    function elev(o){
      if (s.length >= 2 && extendEnds) o = Math.max(s[0].x, Math.min(s[s.length - 1].x, o));
      if (s.length < 2 || o < s[0].x - 1e-9 || o > s[s.length - 1].x + 1e-9) throw new Error(`offset ${Expr.num(o)} อยู่นอกขอบเขตของ surface`);
      for (let i = 0; i < s.length - 1; i++){
        if (o <= s[i + 1].x + 1e-9){
          const d = s[i + 1].x - s[i].x;
          if (Math.abs(d) < 1e-12) return s[i + 1].y;
          const t = Math.max(0, Math.min(1, (o - s[i].x) / d));
          return s[i].y + t * (s[i + 1].y - s[i].y);
        }
      }
      return s[s.length - 1].y;
    }
    // เส้นจาก (o0, e0) ไปทาง dir ด้วย slope -> จุดแรกที่ชน surface (null = ไม่ชน)
    function intersect(o0, e0, dir, slope){
      const line = o => e0 + slope * dir * (o - o0);
      const f0 = elev(o0) - line(o0);
      if (Math.abs(f0) < 1e-9) return { x: o0, y: e0 };
      const stops = [o0];
      if (dir > 0) stops.push(...s.filter(p => p.x > o0 + 1e-9).map(p => p.x));
      else stops.push(...s.filter(p => p.x < o0 - 1e-9).map(p => p.x).reverse());
      if (extendEnds) stops.push(o0 + dir * 1e4);
      let fs = f0;
      for (let i = 0; i < stops.length - 1; i++){
        const a = stops[i], b = stops[i + 1], fe = elev(b) - line(b);
        if (fe * f0 <= 0){
          const t = fs / (fs - fe), o = a + t * (b - a);
          return { x: o, y: line(o) };
        }
        fs = fe;
      }
      return null;
    }
    // จุดยอดของผิวดินระหว่าง x1 กับ x2 (ไม่รวมปลาย) เรียงจาก x1 ไป x2
    function between(x1, x2){
      const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
      const v = s.filter(p => p.x > lo + 1e-9 && p.x < hi - 1e-9).map(p => ({ x: p.x, y: elev(p.x) }));
      return x1 <= x2 ? v : v.reverse();
    }
    // จุดบนผิวดินที่ใกล้ (x, y) ที่สุด (สำหรับ snap)
    function nearest(x, y){
      let best = null;
      const segs = s.map((p, i) => [p, s[i + 1]]).slice(0, -1);
      if (extendEnds){ segs.unshift([{ x: s[0].x - 1e4, y: s[0].y }, s[0]]); segs.push([s[s.length - 1], { x: s[s.length - 1].x + 1e4, y: s[s.length - 1].y }]); }
      for (const [a, b] of segs){
        const q = projectSeg(a, b, { x, y }), d = Math.hypot(q.x - x, q.y - y);
        if (!best || d < best.d) best = { x: q.x, y: q.y, d };
      }
      return best;
    }
    return { elev, intersect, between, nearest, pts: s };
  }
  function projectSeg(a, b, p){
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
    return { x: a.x + t * dx, y: a.y + t * dy, t };
  }

  // ---------- แก้ spec ----------
  function addPoint(spec, def, codes){
    const id = nextId(spec, "P");
    spec.points.push({ id, codes: codes || [], def });
    return id;
  }
  function findLink(spec, a, b){
    return spec.links.find(l => { const [p, q] = linkEnds(l); return (p === a && q === b) || (p === b && q === a); }) || null;
  }
  function addLink(spec, a, b, extra){
    if (a === b) return null;
    const ex = findLink(spec, a, b);
    if (ex && !extra) return ex.id;
    const id = nextId(spec, "L");
    spec.links.push(extra ? { id, ...extra, codes: [] } : { id, points: [a, b], codes: [] });
    return id;
  }
  function addShape(spec, linkIds){
    const id = nextId(spec, "S");
    spec.shapes.push({ id, links: linkIds, codes: [] });
    return id;
  }
  // ลบ object และทุกอย่างที่พึ่งมัน คืนรายการ id ที่ลบ
  function removeCascade(spec, kind, id){
    const gone = { points: new Set(), links: new Set(), shapes: new Set() };
    if (kind === "point") gone.points.add(id);
    if (kind === "link") gone.links.add(id);
    if (kind === "shape") gone.shapes.add(id);
    let more = true;
    while (more){
      more = false;
      for (const p of spec.points) if (!gone.points.has(p.id) && refs(p.def).some(r => gone.points.has(r))){ gone.points.add(p.id); more = true; }
    }
    for (const l of spec.links) if (linkEnds(l).some(r => gone.points.has(r))) gone.links.add(l.id);
    for (const s of spec.shapes) if (s.links.some(r => gone.links.has(r))) gone.shapes.add(s.id);
    spec.points = spec.points.filter(p => !gone.points.has(p.id));
    spec.links = spec.links.filter(l => !gone.links.has(l.id));
    spec.shapes = spec.shapes.filter(s => !gone.shapes.has(s.id));
    return [...gone.points, ...gone.links, ...gone.shapes];
  }
  // ชื่อที่จะลบไปด้วยถ้าลบ id นี้ (ใช้ถามก่อนลบ)
  function cascadePreview(spec, kind, id){
    return removeCascade(JSON.parse(JSON.stringify(spec)), kind, id);
  }
  // จุดที่อ้างถึง id นี้ (ห้ามเลือกเป็น from จนเกิดวง)
  function dependsOn(spec, id, target){
    const p = byId(spec.points, id);
    if (!p) return false;
    if (id === target) return true;
    return refs(p.def).some(r => dependsOn(spec, r, target));
  }

  return { POINT_TYPES, MEASURES, EXPR_FIELDS, newSpec, specForImported, evaluate, makeGround, projectSeg, lineX, refs, linkEnds, byId,
           nextId, names, addPoint, addLink, findLink, addShape, removeCascade, cascadePreview, dependsOn };
})();
if (typeof module !== "undefined") module.exports = Spec;
