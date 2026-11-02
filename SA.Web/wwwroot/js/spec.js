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
// นิพจน์ (ดู expr.js) อ้างจุดได้: P3.x (กรอบ Side = Right) / P3.y / ground(P3) / exists(P3) — จุดที่อ้างนับเป็นการพึ่งพา (refs)
// Logic (เงื่อนไข / กิ่ง) ของรอบ 4: โครงข้อมูลดู prompt-4-design.md
// ไฟล์นี้ไม่ใช้ DOM เพื่อให้ node โหลดไปทดสอบได้ (SA.Tests/js)
"use strict";
const Spec = (() => {
  const POINT_TYPES = {
    origin: "Origin", delta: "ห่างจากจุด (dx, dy)", polar: "ระยะ + มุม (polar)", slopeLength: "ลาด + ความยาว", slopeToSurface: "ลาดจนชนดิน",
    onSurface: "บนผิวดิน", between: "บนเส้นระหว่าง 2 จุด", intersect: "จุดตัดของ 2 เส้น", external: "จุดจากโค้ดเดิม (point code)",
    tangent: "จุดสัมผัส (Fillet)", firstOf: "จุดแรกที่เกิด (หลังกิ่ง)"
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
  // จุดที่ def อ้างถึง: ช่องอ้างจุด (from, a, b, ...) + จุดในนิพจน์ (P3.x, ground(P3), exists(P3)) — ต้องคำนวณก่อน / ลบแล้วจุดนี้หาย
  const refs = def => {
    const r = ["from", "a", "b", "a1", "a2", "b1", "b2", "corner", "toward", "other"].map(k => def[k]).filter(Boolean);
    if (def.type === "firstOf") for (const id of def.points || []) if (id && !r.includes(id)) r.push(id);
    for (const k of EXPR_FIELDS[def.type] || []) for (const id of Expr.pointRefsOf(def[k])) if (!r.includes(id)) r.push(id);
    return r;
  };
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
  // ---------- Logic: กิ่ง ----------
  // ค่าของ decision ตรงกับทางออก (กิ่ง) นี้ไหม — if: case true / false · switch: ค่าเท่ากับ case (tolerance เดียวกับ ==), "else" = ไม่ตรงกิ่งอื่นเลย
  function caseMatch(lg, d, b, v){
    if (v === null || v === undefined) return false;
    if (d.kind === "switch"){
      const eq = c => Math.abs(v - Number(c)) <= Expr.EPS;
      if (b.case === "else") return !(lg.branches || []).some(o => o.decision === d.id && o.case !== "else" && eq(o.case));
      return eq(b.case);
    }
    return v === (b.case === true || b.case === "true");
  }
  const branchLabel = (spec, id) => { const b = byId((spec.logic || {}).branches || [], id); return b ? b.label || b.id : id; };
  // กิ่งนี้ + กิ่งแม่ทุกชั้น (กิ่งเกิด = กิ่งเหล่านี้เกิดทั้งหมด)
  function branchChain(spec, id){
    const lg = spec.logic || {}, out = [];
    for (let cur = id; cur && !out.includes(cur); ){
      out.push(cur);
      const b = byId(lg.branches || [], cur), d = b && byId(lg.decisions || [], b.decision);
      cur = d ? d.parent : null;
    }
    return out;
  }
  // object ที่ "อาจหาจุดไม่ได้ในบางกรณี": อ้างจุด (ทางตรง / ทางอ้อม) ที่เกิดเฉพาะกิ่งที่ object นี้ไม่ได้อยู่
  //   exists(P) และรายการของ firstOf ไม่นับ · คืน [{ id, kind, ref, branch }]
  function branchRisks(spec){
    const req = {}, busy = new Set();
    // กิ่งที่จุดต้องเกิดถึงจะหาได้
    function need(id){
      if (req[id]) return req[id];
      const p = byId(spec.points, id);
      if (!p || busy.has(id)) return new Set();
      busy.add(id);
      const s = new Set(p.branch ? branchChain(spec, p.branch) : []);
      if (p.def.type !== "firstOf") for (const r of strictRefs(p.def)) for (const b of need(r)) s.add(b);
      busy.delete(id);
      return (req[id] = s);
    }
    const out = [];
    const check = (o, kind, ids) => {
      const mine = new Set(o.branch ? branchChain(spec, o.branch) : []);
      for (const r of ids) for (const b of need(r)) if (!mine.has(b)){ out.push({ id: o.id, kind, ref: r, branch: b }); return; }
    };
    for (const p of spec.points) if (p.def.type !== "firstOf") check(p, "point", strictRefs(p.def).concat(limitRefs(p)));
    for (const l of spec.links) check(l, "link", linkRefs(l));
    for (const s of spec.shapes){
      const mine = new Set(s.branch ? branchChain(spec, s.branch) : []);
      const l = s.links.map(id => byId(spec.links, id)).find(l => l && l.branch && !mine.has(l.branch));
      if (l) out.push({ id: s.id, kind: "shape", ref: l.id, branch: l.branch });
    }
    return out;
  }
  // จุดที่ต้องมีจริง (ไม่นับ exists(P) ที่แค่ถามว่าเกิดไหม)
  function strictRefs(def){
    const r = ["from", "a", "b", "a1", "a2", "b1", "b2", "corner", "toward", "other"].map(k => def[k]).filter(Boolean);
    for (const k of EXPR_FIELDS[def.type] || []) for (const id of Expr.pointRefsOf(def[k], true)) if (!r.includes(id)) r.push(id);
    return r;
  }

  // ตัวเลือกของ Expr.check สำหรับช่องนิพจน์ของ spec นี้: จุดที่อ้างได้ + target (ไฟล์ import ใช้ target ของโค้ดเดิม = ไม่ตรวจชื่อ)
  //   self = id ของ object ที่ช่องนี้เป็นของ (อ้างตัวเองไม่ได้)
  function exprOpts(spec, self){
    return { points: spec.points.map(p => p.id).filter(id => id !== self), targets: spec.imported ? null : spec.targets.map(t => t.name),
             conds: ((spec.logic && spec.logic.conditions) || []).map(c => c.name), limits: spec.points.filter(p => p.limit).map(p => p.id) };
  }
  // ช่องนิพจน์ของ def แต่ละชนิด
  const EXPR_FIELDS = { delta: ["dx", "dy"], polar: ["length", "angle"], slopeLength: ["slope", "length"], slopeToSurface: ["slope", "maxDistance", "layoutLength"],
                        onSurface: ["dx"], between: ["t"], tangent: ["radius"] };
  // ช่องนิพจน์ของ link (seg.value แยกต่างหาก)
  const LINK_EXPR_FIELDS = { arcR: ["radius"], fillet: ["radius"] };

  // ---------- คำนวณ ----------
  // ctx = { values: {ชื่อ: ค่า}, codeParams: [...], codePoints: [{x, y, codes}] (เทียบ origin),
  //         surface: [{x, y}] เทียบ origin หรือ null (ไม่มี/ไม่ได้กำหนด), extendEnds, layout,
  //         allBranches: ทุกกิ่งเกิด (ใช้วาด "แสดงทุกกรณี" เท่านั้น — ลาดจนชนดินที่ไม่ชน = ยาว layoutLength ไม่ใช่ maxDistance),
  //         originElevation: ระดับจริงของ origin (Max / Min อ้าง "ระดับจริง") }
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
    // นิพจน์ที่อ้างจุด / ผิวดิน: viewer = จุดที่กำลังคำนวณ (กลุ่มหมุน: เห็นค่า raw / ค่าที่หมุนตาม needFrom) · null = link
    //   P3.x = ค่าในกรอบ Side = Right (F × x) · ground(P3) ไม่มีผิวดิน = ระดับของ P3 เอง + เตือน (แบบลาดจนชนดิน) · ตรงกับ CodeGenerator
    const exprCtx = viewer => ({
      px: id => F * needFrom(viewer, id).x,
      py: id => needFrom(viewer, id).y,
      ground: id => {
        const q = needFrom(viewer, id);
        if (ground) return ground.elev(q.x);
        if (!ctx.layout) warn(viewer || id, `${viewer ? viewer + " " : ""}ground(${id}): ${noTargetMsg} — ใช้ระดับของ ${id}`);
        return q.y;
      },
      exists: id => { try{ needFrom(viewer, id); return true; }catch{ return false; } },
      hasGround: () => !!ground,
      limited: id => { try{ needFrom(viewer, id); }catch{ return false; } return !!limInfo[id] && limInfo[id].hit; },
      isCond: name => name in condByName,
      cond: name => { const v = cond(name); if (v === null) throw new Error(`เงื่อนไข ${name} ไม่รู้ค่า`); return v; }
    });

    // ---------- Logic (รอบ 4): เงื่อนไข / decision / กิ่ง — ดู prompt-4-design.md ----------
    //   เงื่อนไข = คำนวณทุกตัวเสมอ (ไม่รู้ค่า = null + เตือน) · decision คำนวณเมื่อกิ่งแม่เกิด · กิ่งเกิด = กิ่งแม่เกิด และค่าตรง case
    //   object ในกิ่งที่ไม่เกิด = { err, off: กิ่ง } (ไม่เตือน) · object ที่อ้างจุดที่ไม่เกิดผ่าน from / a / b ... = ไม่เกิดตาม (ไม่เตือน)
    //   ตรงกับโค้ด C# ที่สร้าง (ฟังก์ชันช่วยคืน null เงียบๆ เมื่อจุดตั้งต้นเป็น null)
    const LG = spec.logic || {}, CONDS = LG.conditions || [], DECS = LG.decisions || [], BRS = LG.branches || [];
    const condByName = {};
    for (const c of CONDS) condByName[c.name] = c;
    const condVal = {}, condBusy = new Set(), decVal = {}, brVal = {}, brBusy = new Set();
    function cond(name){
      if (name in condVal) return condVal[name];
      const c = condByName[name];
      if (condBusy.has(name)) throw new Error(`เงื่อนไข ${name} อ้างถึงตัวเองเป็นวง`);
      condBusy.add(name);
      let v = null;
      try{ v = Expr.test(c.expr, env, exprCtx(null)); }
      catch(e){ warn(c.id, `เงื่อนไข ${name}: ${e.message}`); }
      condBusy.delete(name);
      return (condVal[name] = v);
    }
    // ค่าของ decision: if = จริง/เท็จ, switch = ตัวเลข, null = ไม่รู้
    function decision(d){
      if (d.id in decVal) return decVal[d.id];
      const t = String(d.test ?? "").trim();
      let v = null;
      if (d.kind !== "switch" && condByName[t]) v = cond(t);
      else try{ v = d.kind === "switch" ? Expr.value(t, env, exprCtx(null)) : Expr.test(t, env, exprCtx(null)); }
      catch(e){ warn(d.id, `${d.label || d.id}: ${e.message}`); }
      return (decVal[d.id] = v);
    }
    function branchOn(id){
      if (id in brVal) return brVal[id];
      const b = byId(BRS, id), d = b && byId(DECS, b.decision);
      if (!d || brBusy.has(id)) return (brVal[id] = false);           // กิ่ง / decision ที่ไม่มี = ไม่เกิด
      brBusy.add(id);
      let on = !d.parent || branchOn(d.parent);
      if (on) on = caseMatch(LG, d, b, decision(d));
      brBusy.delete(id);
      return (brVal[id] = on);
    }
    const offOf = o => o.branch && !ctx.allBranches && !branchOn(o.branch) ? { err: `ไม่เกิด (กิ่ง ${branchLabel(spec, o.branch)})`, off: o.branch } : null;
    const Xv = (src, what, viewer) => { try{ return Expr.value(src, env, exprCtx(viewer)); }catch(e){ throw new Error(`${what}: ${e.message}`); } };
    const X = (src, what) => Xv(src, what, null);

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
    const pts = {}, raws = {}, visiting = new Set(), limInfo = {};
    const memo = (store, key, id, fn) => {
      if (store[id]) return store[id];
      if (visiting.has(key)) return (store[id] = { err: `จุด ${id} อ้างถึงตัวเองเป็นวง` });
      visiting.add(key);
      let r;
      try{ r = fn(); }
      catch(e){ r = e.off ? { err: e.message, off: e.off } : { err: e.message }; }
      visiting.delete(key);
      return (store[id] = r);
    };
    // ค่าที่ใช้วาด / ที่จุดอื่นเห็น (สมาชิกกลุ่มหมุน = หมุนแล้ว)
    function pt(id){
      const p = byId(spec.points, id);
      if (!p) return (pts[id] = { err: `ไม่มีจุด ${id}` });
      if (!(id in pts)){ const o = offOf(p); if (o) return (pts[id] = o); }
      const g = groupOf[id];
      if (!g) return memo(pts, "f:" + id, id, () => limitPt(p, calcPoint(p)));
      return memo(pts, "f:" + id, id, () => {
        if (p.limit) warn(p.id, `${p.id} Max / Min: สมาชิกกลุ่มหมุน ${g.id} ใช้ไม่ได้ — ข้าม`);
        const q = rawPt(id);
        if (q.err) return q;
        const c = pt(g.pivot);
        if (c.err) throw Object.assign(new Error(`ข้ามเพราะหาจุดหมุน ${g.pivot} ไม่ได้ (กลุ่มหมุน ${g.id})`), { skip: true });
        return rotatePt(q, c, F * X(g.angle, `มุมหมุน ${g.id}`));
      });
    }
    // ค่าก่อนหมุนของสมาชิกกลุ่มหมุน
    function rawPt(id){
      const p = byId(spec.points, id), o = p && !(id in raws) ? offOf(p) : null;
      if (o) return (raws[id] = o);
      return memo(raws, "r:" + id, id, () => calcPoint(p));
    }
    // จุด viewer อ้างจุด id: สมาชิกกลุ่มเดียวกัน / จุดที่ pivot ของกลุ่มนั้นอ้าง = ค่า raw · อื่นๆ = ค่าที่หมุนแล้ว
    function needFrom(viewer, id){
      if (!id) return { x: 0, y: 0 };               // ไม่มี from = origin
      const g = groupOf[id];
      const q = g && (groupOf[viewer] === g || pre[g.id].has(viewer)) ? rawPt(id) : pt(id);
      if (q.off) throw Object.assign(new Error(`ไม่เกิดเพราะ ${id} ไม่เกิด`), { skip: true, off: q.off });
      if (q.err) throw Object.assign(new Error(`ข้ามเพราะหาจุด ${id} ไม่ได้`), { skip: true });
      return q;
    }
    const need = id => needFrom(null, id);          // link: เห็นค่าที่หมุนแล้ว
    // Max / Min: ค่าที่คุมนอกขอบ = ขยับตาม along จนถึงขอบ (limInfo[id] = { v0, tgt, hit, from } ไว้แสดงผล)
    //   อ้างอิงหาไม่ได้ / นิพจน์ผิด = ไม่ขยับ + เตือน · Layout mode + ผิวดิน = ไม่ขยับ ไม่เตือน — ตรงกับ Limit ใน CodeGenerator.cs
    function limitPt(p, q){
      const L = p.limit;
      if (!L) return q;
      const tag = `${p.id} Max / Min`;
      if (LIMIT_NO[p.def.type]){ warn(p.id, `${tag}: ใช้กับจุดชนิดนี้ไม่ได้ — ข้าม`); return q; }
      const need = id => needFrom(p.id, id), X = (src, what) => Xv(src, what, p.id);
      const m = L.measure || "depth", below = L.side !== "above", r = L.ref || {};
      const info = limInfo[p.id] = { v0: null, tgt: null, hit: false, from: q };
      const groundRef = m === "normal" || (m === "depth" && (r.type || "ground") === "ground");
      if (groundRef && !ground){ if (!ctx.layout) warn(p.id, `${tag}: ${noTargetMsg} — ไม่ขยับ`); return q; }
      try{
        const val = (s, what) => s == null || String(s).trim() === "" ? null : X(String(s), what);
        const mn = val(L.min, "อย่างน้อย");
        let mx = val(L.max, "อย่างมาก");
        if (mn == null && mx == null) return q;
        if (mn != null && mx != null && mn > mx){ warn(p.id, `${tag}: อย่างน้อย ${f2(mn)} > อย่างมาก ${f2(mx)} — ใช้อย่างน้อย`); mx = null; }
        info.mn = mn; info.mx = mx;                       // ไว้วาดขอบที่ยอมได้ (limit.js)
        const sk = LIMIT_START[p.def.type], S = info.S = sk ? need(p.def[sk]) : { x: 0, y: 0 };
        let Q;
        if (m === "normal") Q = pt => {
          const h = 0.01, s = (ground.elev(pt.x + h) - ground.elev(pt.x - h)) / (2 * h), v = (ground.elev(pt.x) - pt.y) / Math.sqrt(1 + s * s);
          return below ? v : -v;
        };
        else if (m === "length"){
          const ex = q.x - S.x, ey = q.y - S.y, n = Math.hypot(ex, ey);
          if (n < 1e-9){ warn(p.id, `${tag}: จุดอยู่ที่จุดต้นของแนว — ไม่ขยับ`); return q; }
          Q = pt => (pt.x - S.x) * ex / n + (pt.y - S.y) * ey / n;
          info.u = { x: ex / n, y: ey / n };
        }
        else if (m === "offset"){ const rx = info.rx = r.type === "point" ? need(r.id).x : 0; Q = pt => F * (pt.x - rx); }
        else if (groundRef) Q = pt => below ? ground.elev(pt.x) - pt.y : pt.y - ground.elev(pt.x);
        else {
          const ry = info.ry = r.type === "point" ? need(r.id).y : X(r.expr, "ระดับ") - (ctx.originElevation || 0);
          Q = pt => below ? ry - pt.y : pt.y - ry;
        }
        const v0 = info.v0 = Q(q);
        const tgt = mn != null && v0 < mn - 1e-9 ? mn : mx != null && v0 > mx + 1e-9 ? mx : null;
        if (tgt == null) return q;
        info.tgt = tgt; info.hit = true;
        const msg = `${p.id} ${limitWhat(p)} ${f2(v0)} m ${v0 < tgt ? "<" : ">"} ${f2(tgt)} m `;
        const act = L.action || "clampWarn";
        if (act === "warn"){ warn(p.id, msg + "(ไม่ขยับ)"); return q; }
        let dx = 0, dy = 1;
        const al = L.along || "vertical";
        if (al === "horizontal"){ dx = 1; dy = 0; }
        else if (al === "slope"){
          const ex = q.x - S.x, ey = q.y - S.y, n = Math.hypot(ex, ey);
          if (n < 1e-9){ warn(p.id, `${tag}: จุดอยู่ที่จุดต้นของแนว — ไม่ขยับ`); return q; }
          dx = ex / n; dy = ey / n;
        }
        const t = solveLimit(u => { try{ return Q({ x: q.x + u * dx, y: q.y + u * dy }) - tgt; }catch{ return NaN; } });
        if (t == null){ warn(p.id, `${tag}: หาตำแหน่งที่ถึงขอบไม่ได้ภายใน 50 m — ไม่ขยับ`); return q; }
        if (act === "clampWarn") warn(p.id, msg + `ใช้ ${f2(tgt)} m แทน`);
        return { x: q.x + t * dx, y: q.y + t * dy };
      }catch(e){
        warn(p.id, `${tag}: ${e.message} — ไม่ขยับ`);
        return q;
      }
    }
    function calcPoint(p){
      const d = p.def, need = id => needFrom(p.id, id), X = (src, what) => Xv(src, what, p.id);
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
          if (ctx.allBranches){ const run = X(d.layoutLength ?? "3", "layoutLength"); return { x: f.x + F * dir * run, y: f.y + s * run }; }
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
        case "firstOf": {
          // จุดแรกในรายการที่เกิด (ไว้ต่อเรขาคณิตหลังกิ่ง) · ไม่มีสักจุด = หาไม่ได้ + เตือน
          for (const id of d.points || []){ try{ return need(id); }catch{} }
          throw new Error(`ไม่มีจุดใดใน ${(d.points || []).join(", ") || "(ว่าง)"} เกิด`);
        }
        case "external": {
          const q = (ctx.codePoints || []).find(c => c.codes.includes(d.code));
          if (!q) throw Object.assign(new Error(`ไม่พบจุด code '${d.code}' จากโค้ดเดิม`), { skip: true });
          return { x: q.x, y: q.y };
        }
      }
      throw new Error(`ไม่รู้จักชนิดจุด ${d.type}`);
    }
    for (const c of CONDS) cond(c.name);               // เงื่อนไขคำนวณทุกตัว (แบบโค้ด C#) แม้ไม่มีใครใช้
    for (const p of spec.points){
      const r = pt(p.id);
      if (r.err && !r.off) warn(p.id, `${p.id}: ${r.err}`);
    }

    const links = {};
    for (const l of spec.links){
      const lo = offOf(l);
      if (lo){ links[l.id] = lo; continue; }
      const [a, b] = linkEnds(l), A = pts[a], B = pts[b];
      if (!A || !B || A.err || B.err){
        // ปลายไม่เกิดเพราะกิ่ง = link ไม่เกิดตาม (ไม่เตือน) · หาไม่ได้ = เตือน
        const off = [A, B].every(q => q && (!q.err || q.off)) ? (A.off || B.off) : null;
        links[l.id] = off ? { err: `ไม่เกิดเพราะปลายไม่เกิด`, off } : { err: `ข้ามเพราะหาจุด ${!A || A.err ? a : b} ไม่ได้` };
        if (!off) warn(l.id, `${l.id}: ${links[l.id].err}`);
        continue;
      }
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
      const so = offOf(s);
      if (so){ shapes[s.id] = so; continue; }
      // link ที่ไม่เกิด (กิ่งอื่น) ใน shape ที่เกิด = ข้าม + เตือน (โค้ด C# AddShape เตือนแบบเดียวกัน)
      const bad = s.links.find(id => !links[id] || links[id].err);
      if (bad){ shapes[s.id] = { err: `ข้ามเพราะ link ${bad} วาดไม่ได้` }; warn(s.id, `${s.id}: ${shapes[s.id].err}`); continue; }
      // shape ใน Civil 3D ประกอบจาก link จริงเท่านั้น
      const ax = s.links.find(id => links[id].aux);
      if (ax){ shapes[s.id] = { err: `ใช้ link auxiliary ${ax} ไม่ได้ (ไม่อยู่ใน Civil 3D)`, auxLink: ax }; warn(s.id, `${s.id}: ${shapes[s.id].err}`); continue; }
      const poly = chain(s.links.map(id => links[id].path));
      if (!poly) warn(s.id, `${s.id}: link ต่อกันไม่เป็นรูปปิด`);
      shapes[s.id] = { poly };
    }
    for (const b of BRS) branchOn(b.id);
    return { pts, links, shapes, issues, flip: F, env, raw: raws, logic: { conds: condVal, decisions: decVal, branches: brVal }, limits: limInfo, ground };
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
  // ---------- Logic: สร้างเงื่อนไข / กิ่ง ----------
  // ชื่อที่ยังไม่มีใน parameter / เงื่อนไข / จุด: base, base2, base3, ...
  function freeName(spec, base){
    const used = new Set(spec.params.map(p => p.name).concat(((spec.logic || {}).conditions || []).map(c => c.name), spec.points.map(p => p.id)));
    let n = base, i = 2; while (used.has(n)) n = base + i++;
    return n;
  }
  // เงื่อนไข + decision if (ใต้กิ่ง parent) + กิ่ง ใช่ / ไม่ใช่ — คืน { cond, decision, yes, no } (id)
  function addIf(spec, o){
    const lg = spec.logic = spec.logic || {};
    for (const k of ["conditions", "decisions", "branches"]) lg[k] = lg[k] || [];
    const next = (list, pre) => { let k = 0; for (const x of list){ const m = new RegExp(`^${pre}(\\d+)$`).exec(x.id); if (m) k = Math.max(k, +m[1]); } return pre + (k + 1); };
    const cond = next(lg.conditions, "C");
    lg.conditions.push(o.note ? { id: cond, name: o.name, expr: o.expr, note: o.note } : { id: cond, name: o.name, expr: o.expr });
    const decision = next(lg.decisions, "D");
    lg.decisions.push({ id: decision, parent: o.parent || null, kind: "if", test: o.name, label: o.label || o.name });
    const yes = next(lg.branches, "B"); lg.branches.push({ id: yes, decision, case: true, label: o.yes || o.name });
    const no = next(lg.branches, "B"); lg.branches.push({ id: no, decision, case: false, label: o.no || "ไม่ " + o.name });
    return { cond, decision, yes, no };
  }
  // object ที่อยู่ในกิ่งนี้โดยตรง [{ kind: "dpt" | "dlink" | "dshape", id }]
  function branchObjects(spec, id){
    return [...spec.points.filter(o => o.branch === id).map(o => ({ kind: "dpt", id: o.id })),
            ...spec.links.filter(o => o.branch === id).map(o => ({ kind: "dlink", id: o.id })),
            ...spec.shapes.filter(o => o.branch === id).map(o => ({ kind: "dshape", id: o.id }))];
  }
  // ที่ที่ใช้ชื่อเงื่อนไขนี้ในนิพจน์ (ไม่นับ test ของ decision ที่เป็นชื่อเงื่อนไขตรงๆ) — คืน [id ของที่ใช้]
  function condUses(spec, name){
    const re = new RegExp(`\\b${name}\\b`), out = [];
    for (const s of exprSlots(spec)){
      if (s.obj.test === name && s.key === "test") continue;
      if (typeof s.obj[s.key] === "string" && re.test(s.obj[s.key]) && !(s.key === "expr" && s.obj.name === name) && !out.includes(s.id)) out.push(s.id);
    }
    return out;
  }
  // เปลี่ยนชื่อเงื่อนไข: ทุกนิพจน์ + test ของ decision เปลี่ยนตาม
  function renameCond(spec, oldName, name){
    const c = ((spec.logic || {}).conditions || []).find(x => x.name === oldName);
    if (!c) return;
    const re = new RegExp(`\\b${oldName}\\b`, "g");
    for (const s of exprSlots(spec)) if (typeof s.obj[s.key] === "string") s.obj[s.key] = s.obj[s.key].replace(re, name);
    for (const d of spec.logic.decisions || []) if (d.label === oldName) d.label = name;
    for (const b of spec.logic.branches || []){ if (b.label === oldName) b.label = name; else if (b.label === "ไม่ " + oldName) b.label = "ไม่ " + name; }
    c.name = name;
  }
  // decision นี้ + decision ที่ซ้อนอยู่ในกิ่งของมัน (ทุกชั้น) -> { decisions: [id], branches: [id] }
  function decisionTree(spec, did){
    const lg = spec.logic || {}, decs = [], brs = [];
    const walk = id => {
      if (decs.includes(id)) return;
      decs.push(id);
      for (const b of (lg.branches || []).filter(x => x.decision === id)){ brs.push(b.id); for (const d of (lg.decisions || []).filter(x => x.parent === b.id)) walk(d.id); }
    };
    walk(did);
    return { decisions: decs, branches: brs };
  }
  // ลบ decision (และที่ซ้อนอยู่ข้างใน) — object ในกิ่งที่ลบ: moveTo = กิ่งแม่ของ decision / null = เกิดเสมอ · remove = ลบ object ด้วย
  //   ลบเงื่อนไขที่ไม่มีใครใช้แล้วด้วย · คืนรายการ id ของ object ที่ย้าย / ลบ
  function removeDecision(spec, did, how){
    const lg = spec.logic || {}, d = byId(lg.decisions || [], did);
    if (!d) return [];
    const t = decisionTree(spec, did), B = new Set(t.branches), touched = [];
    const moveTo = d.parent || null;
    if (how === "remove"){
      for (const o of [...spec.shapes]) if (B.has(o.branch) && spec.shapes.includes(o)) touched.push(...removeCascade(spec, "shape", o.id));
      for (const o of [...spec.links]) if (B.has(o.branch) && spec.links.includes(o)) touched.push(...removeCascade(spec, "link", o.id));
      for (const o of [...spec.points]) if (B.has(o.branch) && spec.points.includes(o)) touched.push(...removeCascade(spec, "point", o.id));
    } else {
      for (const o of [...spec.points, ...spec.links, ...spec.shapes]) if (B.has(o.branch)){ if (moveTo) o.branch = moveTo; else delete o.branch; touched.push(o.id); }
    }
    const names = t.decisions.map(id => byId(lg.decisions, id).test);
    lg.decisions = lg.decisions.filter(x => !t.decisions.includes(x.id));
    lg.branches = lg.branches.filter(x => !B.has(x.id));
    // เงื่อนไขที่ไม่มีใครใช้แล้ว (วนซ้ำ: เงื่อนไขหนึ่งอาจถูกใช้แค่ในอีกเงื่อนไขที่เพิ่งหาย)
    for (let again = true; again; ){
      again = false;
      for (const n of names) if ((lg.conditions || []).some(c => c.name === n) && !lg.decisions.some(x => x.test === n) && !condUses(spec, n).length){ lg.conditions = lg.conditions.filter(c => c.name !== n); again = true; }
    }
    return touched;
  }
  // ---------- Max / Min ของจุด (รอบ 4b — prompt-4b-design.md) ----------
  // p.limit = { measure, side, ref, min, max, action, along } — ดูหัวข้อ "ตกลงแล้ว" ใน prompt-4b-design.md
  //   measure: depth = ระยะดิ่งจากอ้างอิง (ผิวดิน / จุด / ระดับจริง) · normal = ระยะตั้งฉากกับผิวดิน · length = ความยาวจากจุดต้นตามแนวเดิม
  //            offset = ระยะราบจากอ้างอิง (จุด / แกน) ออกด้านนอก (+)
  //   ไม่ผ่าน = ขยับจุดตาม along (vertical / horizontal / slope = ตามแนวจากจุดต้น) จนค่าที่คุมเท่าขอบ — ตรงกับ Limit ใน CodeGenerator.cs
  const LIMIT_MEASURES = { depth: "ระยะดิ่ง", normal: "ระยะตั้งฉากกับผิวดิน", length: "ความยาวจากจุดต้น", offset: "ระยะราบ" };
  const LIMIT_ALONG = { vertical: "แนวดิ่ง", horizontal: "แนวราบ", slope: "ตามแนวเดิม" };
  const LIMIT_ACTIONS = { clampWarn: "ขยับให้ถึงขอบ + เตือน", clamp: "ขยับเงียบๆ", warn: "เตือนอย่างเดียว ไม่ขยับ" };
  const LIMIT_START = { delta: "from", slopeLength: "from", polar: "from", between: "a" };     // จุดต้นของ "แนวเดิม"
  const LIMIT_NO = {
    origin: "origin อยู่กับที่เสมอ", external: "จุดจากโค้ดเดิม — ตำแหน่งมาจากโค้ด",
    firstOf: "จุดแรกที่เกิด — ตั้งที่จุดในรายการแทน",
    slopeToSurface: "ลาดจนชนดิน — ตำแหน่งถูกกำหนดโดยผิวดินอยู่แล้ว (คุมจุดที่มันเริ่ม หรือใช้ปุ่ม ถ้าตัด / ถม)",
    tangent: "จุดสัมผัสของ Fillet — ตำแหน่งขึ้นกับรัศมี"
  };
  // คุมอะไรได้ / ขยับแบบไหนได้ / เหตุผลที่ตั้งไม่ได้ (ใช้ทั้งหน้าต่าง, Properties, Logic API)
  function limitOptions(spec, id){
    const p = byId(spec.points, id);
    if (!p) return { ok: false, why: `ไม่มีจุด ${id}` };
    const t = p.def.type;
    if (LIMIT_NO[t]) return { ok: false, why: LIMIT_NO[t] };
    const g = (spec.rotations || []).find(x => x.points.includes(id));
    if (g) return { ok: false, why: `อยู่ในกลุ่มหมุน ${g.id} — รอบนี้ยังตั้ง Max / Min ให้สมาชิกกลุ่มหมุนไม่ได้` };
    const line = !!LIMIT_START[t], sl = line ? ["slope"] : [];
    const along = { depth: ["vertical", ...sl], normal: ["vertical", ...sl], length: sl, offset: ["horizontal", ...sl] };
    const lean = t === "slopeLength" || t === "polar";      // จุดแบบลาด / มุม: default ขยับตามแนวเดิม
    return { ok: true, measures: Object.keys(along).filter(m => along[m].length), along,
             defaultAlong: { depth: lean ? "slope" : "vertical", normal: lean ? "slope" : "vertical", length: "slope", offset: lean ? "slope" : "horizontal" },
             start: line ? (p.def[LIMIT_START[t]] || null) : null };
  }
  // จุดที่ Max / Min อ้าง (จุดอ้างอิง + จุดในนิพจน์)
  function limitRefs(p){
    const L = p && p.limit, out = [];
    if (!L) return out;
    if (L.ref && L.ref.type === "point" && L.ref.id) out.push(L.ref.id);
    for (const e of [L.min, L.max, L.ref && L.ref.expr]) for (const id of Expr.pointRefsOf(e)) if (!out.includes(id)) out.push(id);
    return out;
  }
  // ตั้ง / แก้ Max / Min ของจุด (ชุดเดียวต่อจุด) — ผิด = throw Error ข้อความไทย · คืน limit ที่เก็บ
  function setLimit(spec, id, lim){
    const o = limitOptions(spec, id);
    if (!o.ok) throw new Error(`ตั้ง Max / Min ที่ ${id} ไม่ได้: ${o.why}`);
    const m = lim.measure || "depth";
    if (!o.measures.includes(m)) throw new Error(`${id} คุม${LIMIT_MEASURES[m] || m}ไม่ได้ (จุดชนิดนี้ไม่มีแนวเดิม)`);
    const along = lim.along || o.defaultAlong[m];
    if (!o.along[m].includes(along)) throw new Error(`คุม${LIMIT_MEASURES[m]}แล้วขยับ${LIMIT_ALONG[along] || along}ไม่ได้`);
    const blank = v => v == null || String(v).trim() === "";
    const mn = blank(lim.min) ? null : String(lim.min).trim(), mx = blank(lim.max) ? null : String(lim.max).trim();
    if (mn == null && mx == null) throw new Error("ใส่อย่างน้อย หรือ อย่างมาก อย่างใดอย่างหนึ่ง");
    if (mn != null && mx != null && /^-?[\d.]+$/.test(mn) && /^-?[\d.]+$/.test(mx) && +mn > +mx) throw new Error(`อย่างน้อย (${mn}) มากกว่า อย่างมาก (${mx})`);
    let ref = null;
    const r = lim.ref || {};
    if (m === "depth"){
      const t = r.type || "ground";
      if (t === "ground") ref = { type: "ground", target: r.target || (spec.targets[0] || {}).name || "TargetSurface" };
      else if (t === "point") ref = { type: "point", id: r.id };
      else if (t === "elev"){ if (blank(r.expr)) throw new Error("ใส่ระดับจริงของอ้างอิง"); ref = { type: "elev", expr: String(r.expr).trim() }; }
      else throw new Error(`ไม่รู้จักอ้างอิง ${t}`);
    }
    else if (m === "normal") ref = { type: "ground", target: r.target || (spec.targets[0] || {}).name || "TargetSurface" };
    else if (m === "offset") ref = r.type === "point" ? { type: "point", id: r.id } : { type: "origin" };
    if (ref && ref.type === "point"){
      if (!ref.id || !byId(spec.points, ref.id)) throw new Error(`ไม่มีจุดอ้างอิง ${ref.id || ""}`.trim());
      if (ref.id === id || dependsOn(spec, ref.id, id)) throw new Error(`${ref.id} คำนวณจาก ${id} — อ้างกันเป็นวง`);
    }
    const out = { measure: m, ...(m === "depth" || m === "normal" ? { side: lim.side === "above" ? "above" : "below" } : {}), ...(ref ? { ref } : {}),
                  min: mn, max: mx, action: LIMIT_ACTIONS[lim.action] ? lim.action : "clampWarn", along };
    byId(spec.points, id).limit = out;
    return out;
  }
  function removeLimit(spec, id){ const p = byId(spec.points, id); if (p) delete p.limit; }
  // ข้อความของค่าที่คุม เช่น "ต่ำกว่าผิวดิน" / "สูงกว่า P2" / "ยาวจาก P4" (ใช้ในคำเตือน — ตรงกับ what ใน CodeGenerator)
  function limitWhat(p){
    const L = p.limit, r = L.ref || {}, below = L.side !== "above";
    if (L.measure === "normal") return `${below ? "ต่ำกว่า" : "สูงกว่า"}ผิวดิน (ตั้งฉาก)`;
    if (L.measure === "length") return `ยาวจาก ${p.def[LIMIT_START[p.def.type]] || "origin"}`;
    if (L.measure === "offset") return `ห่างแนวราบจาก${r.type === "point" ? " " + r.id : "แกน"}`;
    return `${below ? "ต่ำกว่า" : "สูงกว่า"}${r.type === "point" ? " " + r.id : r.type === "elev" ? " ระดับ " + r.expr : "ผิวดิน"}`;
  }
  // หา t ที่ f(t) = 0 ใกล้ 0 ที่สุด: ขยายช่วง 0.01, 0.02, ... ถึง 50 สลับ + / − แล้วแบ่งครึ่ง 60 รอบ (เหมือน SolveLimit ใน C#) · ไม่เจอ = null
  function solveLimit(f){
    const f0 = f(0);
    if (!isFinite(f0)) return null;
    if (Math.abs(f0) < 1e-12) return 0;
    let prevP = 0, prevN = 0;
    for (let s = 0.01; ; s = Math.min(s * 2, 50)){
      for (const sg of [1, -1]){
        const t = sg * s, ft = f(t);
        if (!isFinite(ft)) continue;
        if (ft * f0 <= 0){
          let a = sg > 0 ? prevP : prevN, b = t, fa = f(a);
          for (let k = 0; k < 60; k++){ const m = (a + b) / 2, fm = f(m); if (fm * fa > 0){ a = m; fa = fm; } else b = m; }
          return (a + b) / 2;
        }
        if (sg > 0) prevP = t; else prevN = t;
      }
      if (s >= 50) return null;
    }
  }
  const f2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);

  // ปุ่มสำเร็จรูป "ถ้าตัด / ถม" ที่จุดบานพับ hinge — ตัด = ผิวดินสูงกว่าบานพับ (ground(hinge) > hinge.y), ไม่มีผิวดิน = ถม
  //   o = { hinge, target, cut: 1.5, fill: 2 (ลาด 1:x), params: สร้าง CutSlope / FillSlope, dir: 1 | -1, cutCode, fillCode }
  //   ได้: เงื่อนไข IsCut + กิ่ง ตัด / ถม (ซ้อนใต้กิ่งของบานพับ ถ้ามี), จุดลาดจนชนดินกิ่งละจุด + link, จุด firstOf "Daylight" (auxiliary)
  function addCutFill(spec, o){
    const h = byId(spec.points, o.hinge);
    if (!h) throw new Error(`ไม่มีจุด ${o.hinge}`);
    const target = o.target || (spec.targets[0] || {}).name || "TargetSurface";
    let cutS = `1/${Expr.num(o.cut)}`, fillS = `-1/${Expr.num(o.fill)}`;
    if (o.params){
      const cn = freeName(spec, "CutSlope"); spec.params.push({ name: cn, kind: "double", default: o.cut, displayName: "Cut Slope (1:x)", min: null, max: null });
      const fn = freeName(spec, "FillSlope"); spec.params.push({ name: fn, kind: "double", default: o.fill, displayName: "Fill Slope (1:x)", min: null, max: null });
      cutS = `1/${cn}`; fillS = `-1/${fn}`;
    }
    const first = !spec.targets.length || spec.targets[0].name === target;
    const g = first ? `ground(${h.id})` : `ground(${h.id}, "${target}")`;
    const lab = (spec.logic && (spec.logic.branches || []).some(b => b.label === "ตัด")) ? ` ${h.id}` : "";
    const br = addIf(spec, { name: freeName(spec, "IsCut"), expr: `${g} > ${h.id}.y`, note: "ผิวดินสูงกว่าบานพับ = ตัด", parent: h.branch,
                             label: "ตัดหรือถม?" + lab, yes: "ตัด" + lab, no: "ถม" + lab });
    const dir = o.dir === -1 ? -1 : 1;
    const day = (slope, branch, code) => {
      const id = addPoint(spec, { type: "slopeToSurface", from: h.id, slope, dir, target, maxDistance: "50", layoutLength: "3" }, code ? [code] : []);
      byId(spec.points, id).branch = branch;
      const l = byId(spec.links, addLink(spec, h.id, id, { points: [h.id, id] }));
      l.codes = code ? [code] : []; l.branch = branch;
      return { point: id, link: l.id };
    };
    const cut = day(cutS, br.yes, o.cutCode), fill = day(fillS, br.no, o.fillCode);
    const daylight = addPoint(spec, { type: "firstOf", points: [cut.point, fill.point] }, ["Daylight"], true);
    if (h.branch) byId(spec.points, daylight).branch = h.branch;
    return { ...br, cut, fill, daylight };
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
    for (const p of spec.points) if (limitRefs(p).some(r => gone.points.has(r))) delete p.limit;
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
    return refs(p.def).concat(limitRefs(p)).some(r => dependsOn(spec, r, target));
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
    // Max / Min ของจุด
    for (const p of spec.points) if (p.limit){
      for (const k of ["min", "max"]) if (p.limit[k] != null) out.push({ obj: p.limit, key: k, id: p.id });
      if (p.limit.ref && p.limit.ref.expr != null) out.push({ obj: p.limit.ref, key: "expr", id: p.id });
    }
    // เงื่อนไข / decision (เปลี่ยนชื่อ parameter แล้วนิพจน์ในเงื่อนไขเปลี่ยนตาม)
    const lg = spec.logic || {};
    for (const c of lg.conditions || []) if (c.expr != null) out.push({ obj: c, key: "expr", id: c.name });
    for (const d of lg.decisions || []) if (d.test != null) out.push({ obj: d, key: "test", id: d.label || d.id });
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

  return { exprOpts, caseMatch, branchLabel, branchChain, branchRisks, freeName, addIf, addCutFill,
           LIMIT_MEASURES, LIMIT_ALONG, LIMIT_ACTIONS, LIMIT_START, limitOptions, limitRefs, setLimit, removeLimit, limitWhat, solveLimit, branchObjects, condUses, renameCond, decisionTree, removeDecision, POINT_TYPES, MEASURES, EXPR_FIELDS, LINK_TYPES, LINK_EXPR_FIELDS, ARC_TYPES, SEG_DEFAULT, SEG_MIN, SEG_MAX, isArc,
           newSpec, specForImported, evaluate, makeGround, projectSeg, lineX, refs, linkEnds, linkRefs, byId,
           isAux, isAuxPoint, normalize, auxPlan, applyAux, nextId, names, addPoint, addLink, findLink, addShape, removeCascade, cascadePreview, dependsOn,
           polygonVertexDefs, addPolygon, updatePolygon, rebuildPolygon, polygonOf,
           tangentPoint, arcGeom, segCount, arcPoints, addFillet, exprSlots, rotatePt, rotationOf, addRotation };
})();
if (typeof module !== "undefined") module.exports = Spec;
