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
//   polar          from, length, angle         ห่าง length ทำมุม angle (องศา ทวนเข็มจาก +x บนจอ, กรอบ Side = Right)
//   slopeLength   from, slope, length, dir, measure   ลาด slope ไปทาง dir ยาว length
//                                              (measure: along = ตามแนวลาด, dx = ระยะราบ, dy = ระยะดิ่ง)
//   slopeToSurface from, slope, dir, target, maxDistance, layoutLength   ลาดจนชนดิน (daylight)
//   onSurface      from, dx, target            บนผิวดินที่ระยะ dx จากจุด from
//   between        a, b, t                     บนเส้น a-b ที่สัดส่วน t (0.5 = กึ่งกลาง)
//   intersect      a1, a2, b1, b2              จุดตัดของเส้น a1-a2 กับเส้น b1-b2 (ต่อเส้นออกไปได้)
//   external       code                        จุดจากโค้ดเดิมของผู้ใช้ หาด้วย point code
//   tangent        corner, toward, other, radius   จุดสัมผัสของ Fillet: บนเส้น corner→toward ห่าง radius / tan(α/2)
//                                              (α = มุมระหว่างเส้น corner→toward กับ corner→other · ขนานกัน / รัศมีใหญ่เกินเส้น = เตือน + ใช้มุมแหลมเดิม)
// ชนิด link: เส้นตรง { points: [a, b] } / วิ่งตามผิวดิน { type: "followSurface", from, to, target }
//   เส้นโค้ง (1 link ใน spec = หลายท่อนตรงในโค้ดที่สร้าง เพราะ link ใน Civil 3D เป็นเส้นตรงเท่านั้น):
//   arc3   { from, via, to, seg }                    ผ่าน 3 จุด (เรียงเส้นตรง = เตือน + เส้นตรง)
//   arcR   { from, to, radius, sweep, large, seg }   เริ่ม-ปลาย-รัศมี · sweep "ccw" | "cw" ในกรอบ Side = Right · large = ทางยาว (> 180°)
//                                                     (รัศมี < ครึ่งคอร์ด = เตือน + เส้นตรง)
//   fillet { from, to, corner, radius, seg }         โค้งสัมผัส 2 เส้นที่มุม corner (from / to = จุด tangent)
//   seg = { by: "chord" | "count", value }  ท่อนยาว (ตามโค้ง) ไม่เกิน value m หรือจำนวนท่อน · จำกัด 2–180 ท่อน (ไม่มี = chord 0.05)
//
// Auxiliary (ช่วยสร้าง) แบบ SAC: auxiliary: true บน point / link — คำนวณ / อ้างอิง / snap ได้ แต่ไม่ส่งออกไป Civil 3D
//   (โค้ด C# ไม่ Points.Add / Links.Add) · link จริงที่ปลายเป็นจุด auxiliary = ข้าม + เตือน · shape ใช้ link auxiliary ไม่ได้ (ข้าม + เตือน)
//   spec รุ่นก่อนใช้ construction: true บนจุด = auxiliary (normalize แปลงให้ตอนโหลด · ตัวอ่านทุกตัวใช้ isAux รองรับทั้งสองแบบ)
//
// กลุ่มหมุน (Rotate): spec.rotations = [{ id: "R1", pivot, angle, points }]
//   จุดในกลุ่มคำนวณตาม def เดิมในกรอบที่ยังไม่หมุน ("raw" — สมาชิกอ้างสมาชิกกลุ่มเดียวกันใช้ค่า raw) แล้วหมุนรอบ pivot ด้วย F × angle
//   (angle = องศา ทวนเข็ม + ในกรอบ Side = Right) · จุดนอกกลุ่มที่อ้างสมาชิกเห็นพิกัดที่หมุนแล้ว
//   ยกเว้นจุดที่ pivot อ้างถึง (ทางอ้อมด้วย) เห็นค่า raw — ตรงกับลำดับในโค้ด C# (คำนวณก่อนบรรทัด Rotate)
//   1 จุดอยู่ได้กลุ่มเดียว · pivot ไม่อยู่ในกลุ่มตัวเอง
//
// ระยะสอง: point/link จะมี "cond" (เงื่อนไขการเกิด) ได้ — evaluator ตอนนี้ไม่สนใจ key ที่ไม่รู้จัก
// ไฟล์นี้ไม่ใช้ DOM เพื่อให้ node โหลดไปทดสอบได้ (SA.Tests/js)
"use strict";
const Spec = (() => {
  const POINT_TYPES = {
    origin: "Origin", delta: "ห่างจากจุด (dx, dy)", polar: "ระยะ + มุม (polar)", slopeLength: "ลาด + ความยาว", slopeToSurface: "ลาดจนชนดิน",
    onSurface: "บนผิวดิน", between: "บนเส้นระหว่าง 2 จุด", intersect: "จุดตัดของ 2 เส้น", external: "จุดจากโค้ดเดิม (point code)",
    tangent: "จุดสัมผัส (Fillet)"
  };
  const LINK_TYPES = { straight: "เส้นตรง", followSurface: "วิ่งตามผิวดิน", arc3: "โค้งผ่าน 3 จุด", arcR: "โค้ง เริ่ม-ปลาย-รัศมี", fillet: "โค้ง Fillet" };
  const ARC_TYPES = ["arc3", "arcR", "fillet"];
  const isArc = l => ARC_TYPES.includes(l.type);
  const SEG_DEFAULT = { by: "chord", value: "0.05" };
  const SEG_MIN = 2, SEG_MAX = 180;
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
  const refs = def => ["from", "a", "b", "a1", "a2", "b1", "b2", "corner", "toward", "other"].map(k => def[k]).filter(Boolean);
  const linkEnds = l => l.points ? l.points : [l.from, l.to];
  // จุดทั้งหมดที่ link ใช้ (ปลาย + จุดผ่านของ arc3 + มุมของ fillet) — ลบจุดเหล่านี้ = link หาย · Move ย้ายไปด้วย
  const linkRefs = l => linkEnds(l).concat([l.via, l.corner].filter(Boolean));
  const byId = (list, id) => list.find(o => o.id === id) || null;
  const isAux = o => !!(o && (o.auxiliary || o.construction));
  const isAuxPoint = (spec, id) => isAux(byId(spec.points, id));
  // construction (รุ่นก่อน) -> auxiliary — แก้ในที่ คืน spec เดิม (เรียกซ้ำได้)
  function normalize(spec){
    if (!spec) return spec;
    for (const o of (spec.points || []).concat(spec.links || []))
      if ("construction" in o){ if (o.construction) o.auxiliary = true; delete o.construction; }
    return spec;
  }
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
  const EXPR_FIELDS = { delta: ["dx", "dy"], polar: ["length", "angle"], slopeLength: ["slope", "length"], slopeToSurface: ["slope", "maxDistance", "layoutLength"],
                        onSurface: ["dx"], between: ["t"], tangent: ["radius"] };
  // ช่องนิพจน์ของ link (seg.value แยกต่างหาก)
  const LINK_EXPR_FIELDS = { arcR: ["radius"], fillet: ["radius"] };

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

    // กลุ่มหมุน: จุด -> กลุ่ม · pre[กลุ่ม] = จุดนอกกลุ่มที่ pivot อ้างถึง (ทางอ้อมด้วย) — เห็นสมาชิกเป็นค่า raw
    const groupOf = {}, pre = {};
    for (const g of spec.rotations || []) for (const id of g.points) groupOf[id] = g;
    for (const g of spec.rotations || []){
      const s = pre[g.id] = new Set(), stack = [g.pivot];
      while (stack.length){
        const id = stack.pop();
        if (!id || s.has(id) || groupOf[id] === g) continue;
        s.add(id);
        const p = byId(spec.points, id);
        if (p) stack.push(...refs(p.def));
      }
    }
    const pts = {}, raws = {}, visiting = new Set();
    const memo = (store, key, id, fn) => {
      if (store[id]) return store[id];
      if (visiting.has(key)) return (store[id] = { err: `จุด ${id} อ้างถึงตัวเองเป็นวง` });
      visiting.add(key);
      let r;
      try{ r = fn(); }
      catch(e){ r = { err: e.message }; }
      visiting.delete(key);
      return (store[id] = r);
    };
    // ค่าที่ใช้วาด / ที่จุดอื่นเห็น (สมาชิกกลุ่มหมุน = หมุนแล้ว)
    function pt(id){
      const p = byId(spec.points, id);
      if (!p) return (pts[id] = { err: `ไม่มีจุด ${id}` });
      const g = groupOf[id];
      if (!g) return memo(pts, "f:" + id, id, () => calcPoint(p));
      return memo(pts, "f:" + id, id, () => {
        const q = rawPt(id);
        if (q.err) return q;
        const c = pt(g.pivot);
        if (c.err) throw Object.assign(new Error(`ข้ามเพราะหาจุดหมุน ${g.pivot} ไม่ได้ (กลุ่มหมุน ${g.id})`), { skip: true });
        return rotatePt(q, c, F * X(g.angle, `มุมหมุน ${g.id}`));
      });
    }
    // ค่าก่อนหมุนของสมาชิกกลุ่มหมุน
    function rawPt(id){ return memo(raws, "r:" + id, id, () => calcPoint(byId(spec.points, id))); }
    // จุด viewer อ้างจุด id: สมาชิกกลุ่มเดียวกัน / จุดที่ pivot ของกลุ่มนั้นอ้าง = ค่า raw · อื่นๆ = ค่าที่หมุนแล้ว
    function needFrom(viewer, id){
      if (!id) return { x: 0, y: 0 };               // ไม่มี from = origin
      const g = groupOf[id];
      const q = g && (groupOf[viewer] === g || pre[g.id].has(viewer)) ? rawPt(id) : pt(id);
      if (q.err) throw Object.assign(new Error(`ข้ามเพราะหาจุด ${id} ไม่ได้`), { skip: true });
      return q;
    }
    const need = id => needFrom(null, id);          // link: เห็นค่าที่หมุนแล้ว
    function calcPoint(p){
      const d = p.def, need = id => needFrom(p.id, id);
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
        case "polar": {
          // มุม (องศา) ทวนเข็มจาก +x บนจอ ในกรอบ Side = Right · ฝั่ง Left กลับแนวราบด้วย F แบบชนิดอื่น
          const f = need(d.from), L = X(d.length, "length"), a = X(d.angle, "angle") * Math.PI / 180;
          return { x: f.x + F * L * Math.cos(a), y: f.y + L * Math.sin(a) };
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
        case "tangent": {
          const c = need(d.corner), t = need(d.toward), o = need(d.other), R = X(d.radius, "radius");
          const r = tangentPoint(c, t, o, R);
          if (r.warn) warn(p.id, `${p.id} จุดสัมผัส: ${r.warn} — ใช้มุมแหลมเดิม`);
          return { x: r.x, y: r.y };
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
      // link จริงที่ปลายเป็นจุด auxiliary: จุดนั้นไม่อยู่ใน Civil 3D (โค้ด C# ข้าม link นี้ + เตือนแบบเดียวกัน) · link auxiliary ต่อได้ทุกจุด
      const aux = isAux(l), auxEnd = aux ? null : [a, b].find(id => isAuxPoint(spec, id));
      if (auxEnd){ links[l.id] = { err: `ปลาย ${auxEnd} เป็นจุด auxiliary (ไม่อยู่ใน Civil 3D)`, auxEnd }; warn(l.id, `${l.id}: ${links[l.id].err}`); continue; }
      let path = [A, B], arc = null;
      if (l.type === "followSurface"){
        if (ground) path = [A, ...ground.between(A.x, B.x), B];
        else if (!ctx.layout) warn(l.id, `${l.id} วิ่งตามผิวดิน: ${noTargetMsg} — ใช้เส้นตรงแทน`);
      }
      else if (isArc(l)){
        try{
          const extra = l.type === "arc3" ? need(l.via) : l.type === "fillet" ? need(l.corner) : null;
          const R = l.type === "arc3" ? 0 : X(l.radius, "radius");
          // sweep เก็บในกรอบ Side = Right · ฝั่ง Left ภาพกระจก = ทิศกลับ
          const ccw = l.type === "arcR" ? (l.sweep !== "cw") === (F === 1) : false;
          const g = arcGeom(l.type, A, B, extra, R, ccw, !!l.large);
          if (g.warn) warn(l.id, `${l.id} ${LINK_TYPES[l.type]}: ${g.warn} — ใช้เส้นตรงแทน`);
          else {
            const sg = l.seg || SEG_DEFAULT;
            let v = X(sg.value, "ท่อนโค้ง"), by = sg.by === "count" ? "count" : "chord";
            if (!(v > 0)){ warn(l.id, `${l.id}: ค่าท่อนโค้ง ${Expr.num(v)} ใช้ไม่ได้ — ใช้ท่อนยาว ${SEG_DEFAULT.value} m`); v = +SEG_DEFAULT.value; by = "chord"; }
            path = [A, ...arcPoints(g, segCount(by, v, g.r, g.sw)), B]; arc = g;
          }
        }catch(e){
          links[l.id] = { err: e.message }; warn(l.id, `${l.id}: ${e.message}`); continue;
        }
      }
      links[l.id] = arc ? { path, arc } : { path };
      if (aux) links[l.id].aux = true;
    }

    const shapes = {};
    for (const s of spec.shapes){
      const bad = s.links.find(id => !links[id] || links[id].err);
      if (bad){ shapes[s.id] = { err: `ข้ามเพราะ link ${bad} วาดไม่ได้` }; warn(s.id, `${s.id}: ${shapes[s.id].err}`); continue; }
      // shape ใน Civil 3D ประกอบจาก link จริงเท่านั้น
      const ax = s.links.find(id => links[id].aux);
      if (ax){ shapes[s.id] = { err: `ใช้ link auxiliary ${ax} ไม่ได้ (ไม่อยู่ใน Civil 3D)`, auxLink: ax }; warn(s.id, `${s.id}: ${shapes[s.id].err}`); continue; }
      const poly = chain(s.links.map(id => links[id].path));
      if (!poly) warn(s.id, `${s.id}: link ต่อกันไม่เป็นรูปปิด`);
      shapes[s.id] = { poly };
    }
    return { pts, links, shapes, issues, flip: F, env, raw: raws };
  }
  // หมุนจุด q รอบ c ด้วยมุม a องศา (ทวนเข็ม +) — ตรงกับ Rotate ใน CodeGenerator.cs
  function rotatePt(q, c, a){
    const r = a * (Math.PI / 180), cs = Math.cos(r), sn = Math.sin(r), dx = q.x - c.x, dy = q.y - c.y;
    return { x: c.x + dx * cs - dy * sn, y: c.y + dx * sn + dy * cs };
  }

  // ---------- เรขาคณิตของเส้นโค้ง (ต้องตรงกับตัวช่วยใน CodeGenerator.cs ทุกขั้น) ----------
  const TAU = 2 * Math.PI;
  const mod = (a, m) => ((a % m) + m) % m;
  // จุดสัมผัสบนเส้น c→t ของโค้งรัศมี R ที่มุม c (อีกเส้นไปทาง o) · ใช้ไม่ได้ = ตำแหน่งของ c + warn
  function tangentPoint(c, t, o, R){
    const L1 = Math.hypot(t.x - c.x, t.y - c.y), L2 = Math.hypot(o.x - c.x, o.y - c.y);
    if (L1 < 1e-9 || L2 < 1e-9) return { x: c.x, y: c.y, warn: "เส้นยาวเป็นศูนย์" };
    const ux = (t.x - c.x) / L1, uy = (t.y - c.y) / L1, vx = (o.x - c.x) / L2, vy = (o.y - c.y) / L2;
    const al = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    if (al < 1e-6 || Math.PI - al < 1e-6) return { x: c.x, y: c.y, warn: "สองเส้นขนานกัน" };
    if (!(R > 0)) return { x: c.x, y: c.y, warn: `รัศมี ${Expr.num(R)} ต้องมากกว่า 0` };
    const d = R / Math.tan(al / 2);
    if (d > L1 + 1e-9 || d > L2 + 1e-9) return { x: c.x, y: c.y, warn: `รัศมี ${Expr.num(R)} ใหญ่เกิน (จุดสัมผัสเลยปลายเส้น)` };
    return { x: c.x + ux * d, y: c.y + uy * d };
  }
  // วงกลมของโค้งจาก A ถึง B -> { cx, cy, r, a1 (มุมเริ่ม rad), sw (มุมกวาด rad, + = ทวนเข็ม) } หรือ { warn }
  //   arc3: extra = จุดผ่าน · fillet: extra = จุดมุม (A, B = จุดสัมผัส) · arcR: R, ccw (ทิศบนจอจริง), large
  function arcGeom(type, A, B, extra, R, ccw, large){
    let cx, cy, r, sw, a1;
    if (type === "arc3"){
      const V = extra;
      const d = 2 * (A.x * (V.y - B.y) + V.x * (B.y - A.y) + B.x * (A.y - V.y));
      const size = Math.max(Math.hypot(V.x - A.x, V.y - A.y), Math.hypot(B.x - A.x, B.y - A.y), 1e-9);
      if (Math.abs(d) < 1e-9 * size * size) return { warn: "3 จุดเรียงเป็นเส้นตรง" };
      const a2 = A.x * A.x + A.y * A.y, v2 = V.x * V.x + V.y * V.y, b2 = B.x * B.x + B.y * B.y;
      cx = (a2 * (V.y - B.y) + v2 * (B.y - A.y) + b2 * (A.y - V.y)) / d;
      cy = (a2 * (B.x - V.x) + v2 * (A.x - B.x) + b2 * (V.x - A.x)) / d;
      r = Math.hypot(A.x - cx, A.y - cy);
      a1 = Math.atan2(A.y - cy, A.x - cx);
      const s2 = mod(Math.atan2(B.y - cy, B.x - cx) - a1, TAU), sv = mod(Math.atan2(V.y - cy, V.x - cx) - a1, TAU);
      sw = sv < s2 ? s2 : s2 - TAU;
      return { cx, cy, r, a1, sw };
    }
    if (type === "arcR"){
      const c = Math.hypot(B.x - A.x, B.y - A.y);
      if (c < 1e-9) return { warn: "จุดเริ่มกับจุดปลายเป็นจุดเดียวกัน" };
      if (!(R > 0) || R < c / 2 - 1e-9) return { warn: `รัศมี ${Expr.num(R)} น้อยกว่าครึ่งระยะเริ่ม-ปลาย (${Expr.num(c / 2)})` };
      const h = Math.sqrt(Math.max(0, R * R - c * c / 4)), mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const nx = -(B.y - A.y) / c, ny = (B.x - A.x) / c;           // ด้านซ้ายของทิศ A→B
      const side = ccw !== large ? 1 : -1;
      cx = mx + side * h * nx; cy = my + side * h * ny; r = R;
      a1 = Math.atan2(A.y - cy, A.x - cx);
      const s = mod(Math.atan2(B.y - cy, B.x - cx) - a1, TAU);
      sw = ccw ? s : s - TAU;
      return { cx, cy, r, a1, sw };
    }
    // fillet: ศูนย์กลางบนเส้นแบ่งครึ่งมุม ห่างมุม R / sin(α/2) · จุดสัมผัสเป็นมุมแหลมเดิม (R ใหญ่เกิน / ขนาน) = เส้นตรง
    const C = extra, L1 = Math.hypot(A.x - C.x, A.y - C.y), L2 = Math.hypot(B.x - C.x, B.y - C.y);
    if (L1 < 1e-9 || L2 < 1e-9) return { warn: "จุดสัมผัสอยู่ที่มุม (ดูคำเตือนของจุดสัมผัส)" };
    if (!(R > 0)) return { warn: `รัศมี ${Expr.num(R)} ต้องมากกว่า 0` };
    const ux = (A.x - C.x) / L1, uy = (A.y - C.y) / L1, vx = (B.x - C.x) / L2, vy = (B.y - C.y) / L2;
    const al = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    if (al < 1e-6 || Math.PI - al < 1e-6) return { warn: "สองเส้นขนานกัน" };
    const bl = Math.hypot(ux + vx, uy + vy), k = R / Math.sin(al / 2);
    cx = C.x + (ux + vx) / bl * k; cy = C.y + (uy + vy) / bl * k; r = R;
    a1 = Math.atan2(A.y - cy, A.x - cx);
    sw = mod(Math.atan2(B.y - cy, B.x - cx) - a1 + Math.PI, TAU) - Math.PI;   // ทางสั้น (< 180°)
    return { cx, cy, r, a1, sw };
  }
  // จำนวนท่อน: chord = ท่อนยาว (วัดตามโค้ง) ไม่เกิน v · count = v ท่อน · จำกัด 2–180
  function segCount(by, v, r, sw){
    const n = by === "count" ? Math.round(v) : Math.ceil(r * Math.abs(sw) / v - 1e-9);
    return Math.max(SEG_MIN, Math.min(SEG_MAX, n));
  }
  // จุดระหว่างทาง (ไม่รวมปลาย) ของโค้ง n ท่อน
  function arcPoints(g, n){
    const out = [];
    for (let i = 1; i < n; i++){ const a = g.a1 + g.sw * i / n; out.push({ x: g.cx + g.r * Math.cos(a), y: g.cy + g.r * Math.sin(a) }); }
    return out;
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
  // aux = Auxiliary (ช่วยสร้าง): คำนวณพิกัด (ใน C# เป็นตัวแปร Pt?) แต่ไม่ Points.Add — ไม่โผล่ใน Civil 3D
  function addPoint(spec, def, codes, aux){
    const id = nextId(spec, "P");
    spec.points.push(aux ? { id, codes: codes || [], def, auxiliary: true } : { id, codes: codes || [], def });
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
    for (const l of spec.links) if (linkRefs(l).some(r => gone.points.has(r))) gone.links.add(l.id);
    for (const s of spec.shapes) if (s.links.some(r => gone.links.has(r))) gone.shapes.add(s.id);
    spec.points = spec.points.filter(p => !gone.points.has(p.id));
    spec.links = spec.links.filter(l => !gone.links.has(l.id));
    spec.shapes = spec.shapes.filter(s => !gone.shapes.has(s.id));
    // polygon ที่เสียชิ้นส่วนไป = เหลือเป็นจุด / link / shape ธรรมดา (เลิกแก้ N / R / θ ได้)
    if (spec.polygons) spec.polygons = spec.polygons.filter(g => !gone.points.has(g.center) && !g.points.some(p => gone.points.has(p))
                                                              && !g.links.some(l => gone.links.has(l)) && !(g.shape && gone.shapes.has(g.shape)));
    // กลุ่มหมุน: สมาชิกที่ลบออกจากกลุ่ม · ลบจุดหมุน / ไม่เหลือสมาชิก = เลิกหมุน (สมาชิกกลับที่เดิม)
    if (spec.rotations){
      for (const g of spec.rotations) g.points = g.points.filter(p => !gone.points.has(p));
      spec.rotations = spec.rotations.filter(g => g.points.length && !gone.points.has(g.pivot));
    }
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

  // ---------- polygon ด้านเท่า ----------
  // spec.polygons = [{ id: "G1", center, n, radius, angle, mode, points, links, shape }] — ข้อมูลไว้แก้ N / R / θ ทีหลัง
  // จุดยอดเป็นจุด polar ธรรมดา (ตัวสร้างโค้ด / Move / evaluate ไม่ต้องรู้จัก polygon):
  //   จุดที่ i: polar จาก center · มุม = angle + 90 + i·360/N (angle = 0 -> จุดแรกอยู่บนสุด)
  //   ระยะ = radius (inscribed = ถึงมุม) หรือ radius / cos(180/N) (circumscribed = ถึงกึ่งกลางด้าน แบบ POLYGON ของ AutoCAD)
  const isNumText = s => /^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(String(s).trim());
  const plusConst = (t, c) => isNumText(t) ? Expr.num(+t + c) : Math.abs(c) < 1e-12 ? String(t).trim() : `${String(t).trim()} ${c < 0 ? "-" : "+"} ${Expr.num(Math.abs(c))}`;
  function polygonVertexDefs(g){
    const n = g.n;
    const r = String(g.radius).trim(), wrap = /^[A-Za-z_][A-Za-z0-9_]*$|^-?\d+(\.\d+)?$/.test(r) ? r : `(${r})`;
    const half = 180 % n === 0 ? String(180 / n) : `180 / ${n}`;
    // ถึงกึ่งกลางด้าน: เก็บเป็นนิพจน์เสมอ (ไม่ปัดทศนิยม) เช่น "R / cos(36)"
    const length = g.mode === "circumscribed" ? `${wrap} / cos(${half})` : r;
    const defs = [];
    for (let i = 0; i < n; i++){
      // มุมที่หารลงตัวเขียนเป็นตัวเลข ไม่ลงตัว (เช่น 7 เหลี่ยม) เขียนเป็นเศษส่วนกันปัดทศนิยม
      const angle = (360 * i) % n === 0 ? plusConst(g.angle, 90 + 360 * i / n) : `${plusConst(g.angle, 90)} + 360 * ${i} / ${n}`;
      defs.push({ type: "polar", from: g.center, length, angle });
    }
    return defs;
  }
  function addPolygon(spec, opt){
    spec.polygons = spec.polygons || [];
    let k = 0; for (const g of spec.polygons){ const m = /^G(\d+)$/.exec(g.id); if (m) k = Math.max(k, +m[1]); }
    const g = { id: "G" + (k + 1), center: opt.center, n: opt.n, radius: String(opt.radius), angle: String(opt.angle), mode: opt.mode || "inscribed", points: [], links: [], shape: null };
    // opt.aux = polygon ช่วยสร้าง: จุดยอด / link เป็น auxiliary และไม่มี shape
    g.points = polygonVertexDefs(g).map(def => addPoint(spec, def, [], opt.aux));
    g.links = g.points.map((p, i) => addLink(spec, p, g.points[(i + 1) % g.n], { points: [p, g.points[(i + 1) % g.n]], ...(opt.aux ? { auxiliary: true } : {}) }));
    g.shape = opt.aux ? null : addShape(spec, g.links);
    spec.polygons.push(g);
    return g;
  }
  // แก้ R / θ / mode: เขียนนิยามของจุดยอดใหม่ (id เดิม สิ่งที่อ้างจุดยอดไม่หลุด)
  function updatePolygon(spec, g){
    polygonVertexDefs(g).forEach((def, i) => { const p = byId(spec.points, g.points[i]); if (p) p.def = def; });
  }
  // เปลี่ยน N: สร้างจุดยอด / link / shape ใหม่ — มีของอื่นอ้างจุดยอด / link เดิมอยู่ = ไม่ทำ คืนรายการที่ขวาง
  function rebuildPolygon(spec, g, n){
    const P = new Set(g.points), L = new Set(g.links);
    const block = spec.points.filter(p => !P.has(p.id) && refs(p.def).some(r => P.has(r))).map(p => p.id)
      .concat(spec.links.filter(l => !L.has(l.id) && linkEnds(l).some(r => P.has(r))).map(l => l.id))
      .concat(spec.shapes.filter(s => s.id !== g.shape && s.links.some(l => L.has(l))).map(s => s.id));
    if (block.length) return block;
    const old = { link: (byId(spec.links, g.links[0]) || {}).codes || [], shape: (byId(spec.shapes, g.shape) || {}).codes || [] };
    const aux = isAux(byId(spec.links, g.links[0]));
    spec.points = spec.points.filter(p => !P.has(p.id));
    spec.links = spec.links.filter(l => !L.has(l.id));
    spec.shapes = spec.shapes.filter(s => s.id !== g.shape);
    g.n = n;
    g.points = polygonVertexDefs(g).map(def => addPoint(spec, def, [], aux));
    g.links = g.points.map((p, i) => addLink(spec, p, g.points[(i + 1) % n], { points: [p, g.points[(i + 1) % n]], ...(aux ? { auxiliary: true } : {}) }));
    for (const id of g.links) byId(spec.links, id).codes = old.link.slice();
    g.shape = aux ? null : addShape(spec, g.links);
    if (g.shape) byId(spec.shapes, g.shape).codes = old.shape.slice();
    return [];
  }
  // polygon ที่ object นี้เป็นส่วนหนึ่ง (จุดยอด / link / shape · center = เฉพาะเมื่อ withCenter)
  function polygonOf(spec, type, id, withCenter){
    return (spec.polygons || []).find(g => type === "point" ? g.points.includes(id) || (withCenter && g.center === id)
                                         : type === "link" ? g.links.includes(id) : g.shape === id) || null;
  }

  // ช่องนิพจน์ทั้งหมดใน spec: [{ obj, key, id }] (obj[key] = ข้อความนิพจน์) — ใช้หา / เปลี่ยนชื่อ parameter
  function exprSlots(spec){
    const out = [];
    for (const p of spec.points) for (const k of EXPR_FIELDS[p.def.type] || []) if (p.def[k] != null) out.push({ obj: p.def, key: k, id: p.id });
    for (const l of spec.links){
      for (const k of LINK_EXPR_FIELDS[l.type] || []) if (l[k] != null) out.push({ obj: l, key: k, id: l.id });
      if (l.seg && l.seg.value != null) out.push({ obj: l.seg, key: "value", id: l.id });
    }
    for (const g of spec.polygons || []) for (const k of ["radius", "angle"]) out.push({ obj: g, key: k, id: g.id });
    for (const g of spec.rotations || []) out.push({ obj: g, key: "angle", id: g.id });
    return out;
  }

  // ---------- Fillet ----------
  // link เส้นตรง 2 เส้นที่ต่อกันที่มุม P: A–P, P–B -> A–T1, fillet(T1→T2), T2–B (id ของ link เดิมคงไว้ แก้แค่ปลาย)
  // T1 / T2 = จุด tangent · P ไม่มี link อื่นต่อและไม่มี point code = จุดช่วยสร้าง (มี code = คงเป็นจุดจริง ไม่ให้ code หายจาก Civil 3D)
  // shape ที่ใช้ link เดิมได้ fillet แทรกตามลำดับ · คืน { t1, t2, link, corner, kept } หรือ { error }
  // opt.overlay = Fillet ช่วยสร้าง: จุดสัมผัส + โค้งเป็น auxiliary วางทับมุม — link เดิม / shape / จุดมุมไม่เปลี่ยน
  function addFillet(spec, id1, id2, radius, opt){
    const l1 = byId(spec.links, id1), l2 = byId(spec.links, id2);
    if (!l1 || !l2 || id1 === id2) return { error: "เลือก link 2 เส้นที่ต่างกัน" };
    if (!l1.points || !l2.points || l1.type || l2.type) return { error: "Fillet ได้เฉพาะ link เส้นตรง" };
    const P = l1.points.find(p => l2.points.includes(p));
    if (!P) return { error: `${id1} กับ ${id2} ไม่ได้ต่อกันที่มุม (ต้องมีจุดปลายร่วมกัน)` };
    const A = l1.points.find(p => p !== P), B = l2.points.find(p => p !== P);
    if (!A || !B) return { error: "link ยาวเป็นศูนย์" };
    const R = String(radius).trim();
    // auxiliary ทั้งคู่ = โค้ง + จุดสัมผัสเป็น auxiliary · ผสม = ของจริงชนะ (link auxiliary ฝั่งนั้นยังเป็น auxiliary)
    const overlay = !!(opt && opt.overlay), aux = overlay || (isAux(l1) && isAux(l2));
    if (overlay){
      const t1 = addPoint(spec, { type: "tangent", corner: P, toward: A, other: B, radius: R }, [], true);
      const t2 = addPoint(spec, { type: "tangent", corner: P, toward: B, other: A, radius: R }, [], true);
      const fl = { id: nextId(spec, "L"), type: "fillet", from: t1, to: t2, corner: P, radius: R, codes: [], auxiliary: true };
      spec.links.splice(spec.links.indexOf(l2) + 1, 0, fl);
      return { t1, t2, link: fl.id, corner: P, kept: false };
    }
    const t1 = addPoint(spec, { type: "tangent", corner: P, toward: A, other: B, radius: R }, [], aux);
    const t2 = addPoint(spec, { type: "tangent", corner: P, toward: B, other: A, radius: R }, [], aux);
    l1.points = l1.points.map(p => p === P ? t1 : p);
    l2.points = l2.points.map(p => p === P ? t2 : p);
    const same = l1.codes.join(",") === l2.codes.join(",");
    const fl = { id: nextId(spec, "L"), type: "fillet", from: t1, to: t2, corner: P, radius: R, codes: same ? l1.codes.slice() : [], ...(aux ? { auxiliary: true } : {}) };
    spec.links.splice(spec.links.indexOf(l1) + 1, 0, fl);
    for (const s of spec.shapes){
      const i = s.links.indexOf(id1), j = s.links.indexOf(id2), n = s.links.length;
      if (i < 0 || j < 0) continue;
      if (Math.abs(i - j) === 1) s.links.splice(Math.max(i, j), 0, fl.id);
      else if (Math.min(i, j) === 0 && Math.max(i, j) === n - 1) s.links.push(fl.id);
      else s.links.splice(i + 1, 0, fl.id);
    }
    // polygon ด้านเท่าที่โดน Fillet = เลิกเป็น polygon (เหลือเป็นจุด / link ธรรมดา)
    if (spec.polygons) spec.polygons = spec.polygons.filter(g => !g.links.includes(id1) && !g.links.includes(id2));
    const cp = byId(spec.points, P), free = !spec.links.some(l => linkEnds(l).includes(P));
    if (cp && free && !cp.codes.length) cp.auxiliary = true;
    return { t1, t2, link: fl.id, corner: P, kept: !!(cp && free && cp.codes.length) };
  }

  // ---------- สลับ Auxiliary ----------
  // แผนสลับ point / link: { points, links (รวม link จริงที่ต้องเป็น aux ด้วยเพราะปลายเป็นจุดที่จะเป็น aux), hitLinks, shapes (ที่ต้องเอา link ออก) }
  function auxPlan(spec, objs, on){
    const P = new Set(objs.filter(o => o.type === "dpt").map(o => o.id)), L = new Set(objs.filter(o => o.type === "dlink").map(o => o.id));
    const hitLinks = on ? spec.links.filter(l => !isAux(l) && !L.has(l.id) && linkEnds(l).some(e => P.has(e))).map(l => l.id) : [];
    hitLinks.forEach(id => L.add(id));
    const shapes = on ? spec.shapes.filter(s => s.links.some(id => L.has(id))).map(s => s.id) : [];
    return { points: [...P], links: [...L], hitLinks, shapes };
  }
  // ทำตามแผน: ตั้ง / เอา auxiliary ออก (codes ไม่ลบ) · on = เอา link ออกจาก shape ในแผน + polygon ที่เสีย link เลิกเป็น polygon
  function applyAux(spec, plan, on){
    const P = new Set(plan.points), L = new Set(plan.links);
    for (const o of spec.points.filter(p => P.has(p.id)).concat(spec.links.filter(l => L.has(l.id)))){
      delete o.construction;
      if (on) o.auxiliary = true; else delete o.auxiliary;
    }
    if (on && plan.shapes.length){
      for (const s of spec.shapes) if (plan.shapes.includes(s.id)) s.links = s.links.filter(id => !L.has(id));
      if (spec.polygons) spec.polygons = spec.polygons.filter(g => !g.links.some(id => L.has(id)));
    }
  }

  // ---------- กลุ่มหมุน ----------
  const rotationOf = (spec, id) => (spec.rotations || []).find(g => g.points.includes(id)) || null;
  function addRotation(spec, opt){
    spec.rotations = spec.rotations || [];
    let k = 0; for (const g of spec.rotations){ const m = /^R(\d+)$/.exec(g.id); if (m) k = Math.max(k, +m[1]); }
    const g = { id: "R" + (k + 1), pivot: opt.pivot, angle: String(opt.angle), points: opt.points.slice() };
    spec.rotations.push(g);
    return g;
  }

  return { POINT_TYPES, MEASURES, EXPR_FIELDS, LINK_TYPES, LINK_EXPR_FIELDS, ARC_TYPES, SEG_DEFAULT, SEG_MIN, SEG_MAX, isArc,
           newSpec, specForImported, evaluate, makeGround, projectSeg, lineX, refs, linkEnds, linkRefs, byId,
           isAux, isAuxPoint, normalize, auxPlan, applyAux, nextId, names, addPoint, addLink, findLink, addShape, removeCascade, cascadePreview, dependsOn,
           polygonVertexDefs, addPolygon, updatePolygon, rebuildPolygon, polygonOf,
           tangentPoint, arcGeom, segCount, arcPoints, addFillet, exprSlots, rotatePt, rotationOf, addRotation };
})();
if (typeof module !== "undefined") module.exports = Spec;
