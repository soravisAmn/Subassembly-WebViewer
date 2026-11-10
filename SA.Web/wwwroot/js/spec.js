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
//   offset         a, b, end, dist, side       ปลาย end ("a" | "b") ของเส้น a-b เลื่อนตั้งฉากไป dist (side 1 = ซ้ายของทิศ a→b ในกรอบ Side = Right, -1 = ขวา)
//                                              (2 จุด offset ของปลายทั้งสอง = เส้นขนาน แบบ OFFSET ของ AutoCAD)
//   extendToGround from, along, target, maxDistance   Extend to Surface: ต่อเส้น along→from เลย from ออกไป (ทิศเดิม) จนชนดิน
//                                              เฉพาะเมื่อปลาย from ลอยเหนือดิน · ไม่ลอย / ไม่มีดิน = ไม่เกิด (เงียบ แบบกิ่งที่ไม่เกิด: off = GROUND_OFF)
//                                              · ไม่ชนดินภายใน maxDistance (ระยะราบ) = เตือน + หาไม่ได้
//   external       code                        จุดจากโค้ดเดิมของผู้ใช้ หาด้วย point code
//   tangent        corner, toward, other, radius   จุดสัมผัสของ Fillet: บนเส้น corner→toward ห่าง radius / tan(α/2)
//                                              (α = มุมระหว่างเส้น corner→toward กับ corner→other · ขนานกัน / รัศมีใหญ่เกินเส้น = เตือน + ใช้มุมแหลมเดิม)
// ชนิด link: เส้นตรง { points: [a, b] } / วิ่งตามผิวดิน { type: "followSurface", from, to, target }
//   Clipped Surface Link { type: "followClipped", from, to, target, refLink | refLevel, side, codes, codesGround, codesLine }
//     ตามผิวดินจาก from ถึง to แต่ไม่สูงกว่า (side "below") / ไม่ต่ำกว่า ("above") เส้นอ้างอิง: link เส้นตรง refLink (ต่อออกไปได้)
//     หรือระดับคงที่ refLevel (นิพจน์ เทียบ origin) · แบบ BuildBottom ของ base_rock-pitching.cs: เพิ่มจุดที่ดินตัดเส้น, ตัดจุดซ้ำ (< 0.0001 m)
//     และจุดกลางของช่วงบนเส้น · ช่วงที่ปลายทั้งสองอยู่บนเส้น = codes + codesLine · นอกนั้น = codes + codesGround
//     ไม่มีดิน (Layout / ไม่มี target = เตือนแบบวิ่งตามผิวดิน) / เส้นอ้างอิงแนวดิ่ง / ดินผิดพลาด = เส้นตรง from→to + codes + codesLine
//     ใน C# = หลาย link (Link[] แบบเส้นโค้ง) — ผล evaluate: { path, segCodes }
//   optional: true = ใน shape ถ้า link นี้วาดไม่ได้ / ไม่เกิด ให้ข้ามไป (link ต่อของ Extend to Surface — shape เดียวปิดได้ทั้งตอนต่อ / ไม่ต่อ)
//   ปลายเป็น "ปลายจริง" (จุด firstOf ที่เป็น auxiliary) = ใช้จุดแรกในรายการที่เกิด (C#: ตัวแปร Point ของจุดนั้น)
//     ต่อได้เมื่อจุดในรายการเป็นจุดจริงทั้งหมด (มีจุด auxiliary = ข้าม + เตือน แบบปลาย auxiliary)
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
// Logic (เงื่อนไข / กิ่ง) ของรอบ 4: โครงข้อมูลดู docs/prompts/prompt-4-design.md
// ไฟล์นี้ไม่ใช้ DOM เพื่อให้ node โหลดไปทดสอบได้ (SA.Tests/js)
"use strict";
const Spec = (() => {
  const POINT_TYPES = {
    origin: "Origin", delta: "ห่างจากจุด (dx, dy)", polar: "ระยะ + มุม (polar)", slopeLength: "ลาด + ความยาว", slopeToSurface: "ลาดจนชนดิน",
    onSurface: "บนผิวดิน", between: "บนเส้นระหว่าง 2 จุด", intersect: "จุดตัดของ 2 เส้น", offset: "Offset (เส้นขนาน)",
    extendToGround: "ต่อลงถึงดิน (Extend to Surface)", external: "จุดจากโค้ดเดิม (point code)",
    tangent: "จุดสัมผัส (Fillet)", firstOf: "จุดแรกที่เกิด (หลังกิ่ง)", lastOf: "จุดของชุดสุดท้าย (Loop)"
  };
  const LINK_TYPES = { straight: "เส้นตรง", followSurface: "วิ่งตามผิวดิน", followClipped: "ตามดิน ไม่เกินเส้น (Clipped Surface Link)", arc3: "โค้งผ่าน 3 จุด", arcR: "โค้ง เริ่ม-ปลาย-รัศมี", fillet: "โค้ง Fillet" };
  const ARC_TYPES = ["arc3", "arcR", "fillet"];
  const isArc = l => ARC_TYPES.includes(l.type);
  const SEG_DEFAULT = { by: "chord", value: "0.05" };
  const SEG_MIN = 2, SEG_MAX = 180;
  const MEASURES = { along: "ตามแนวลาด", dx: "ระยะราบ", dy: "ระยะดิ่ง" };
  // off ของจุดต่อลงถึงดินที่ไม่ต้องต่อ (ปลายไม่ลอย / ไม่มีดิน) — ไม่ใช่ id กิ่ง
  const GROUND_OFF = "~ground";

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
  const REF_KEYS = ["from", "a", "b", "a1", "a2", "b1", "b2", "corner", "toward", "other", "along"];
  const refs = def => {
    const r = REF_KEYS.map(k => def[k]).filter(Boolean);
    if (def.type === "firstOf" || def.type === "lastOf") for (const id of def.points || []) if (id && !r.includes(id)) r.push(id);
    for (const k of EXPR_FIELDS[def.type] || []) for (const id of Expr.pointRefsOf(def[k])) if (!r.includes(id)) r.push(id);
    return r;
  };
  const linkEnds = l => l.points ? l.points : [l.from, l.to];
  // จุดทั้งหมดที่ link ใช้ (ปลาย + จุดผ่านของ arc3 + มุมของ fillet) — ลบจุดเหล่านี้ = link หาย · Move ย้ายไปด้วย
  const linkRefs = l => linkEnds(l).concat([l.via, l.corner].filter(Boolean));
  const byId = (list, id) => list.find(o => o.id === id) || null;
  const isAux = o => !!(o && (o.auxiliary || o.construction));
  const isAuxPoint = (spec, id) => isAux(byId(spec.points, id));
  // "ปลายจริง": จุด firstOf ที่เป็น auxiliary — เป็นปลาย link จริงได้ (ใช้จุดแรกในรายการที่เกิด)
  const isAlias = (spec, id) => { const p = byId(spec.points, id); return !!p && (p.def.type === "firstOf" || p.def.type === "lastOf") && isAux(p); };
  // ปลาย link จริงที่ใช้ไม่ได้เพราะเป็น auxiliary: จุด aux ทั่วไป / ปลายจริงที่มีจุด aux ในรายการ — คืน id ของปลายนั้น หรือ null
  function auxEnd(spec, id, seen){
    const p = byId(spec.points, id);
    if (!p) return null;
    if (!isAlias(spec, id)) return isAux(p) ? id : null;
    seen = seen || new Set();
    if (seen.has(id)) return null;
    seen.add(id);
    return (p.def.points || []).some(m => auxEnd(spec, m, seen)) ? id : null;
  }
  // construction (รุ่นก่อน) -> auxiliary — แก้ในที่ คืน spec เดิม (เรียกซ้ำได้)
  //   Max / Min (รอบ 4b ถูกเอาออกในรอบ 4c) -> ตัดทิ้ง จุดใช้ตำแหน่งตามนิยามเดิม · dropped = รายการจุดที่ถูกตัด (ไว้แจ้งผู้ใช้)
  function normalize(spec, dropped){
    if (!spec) return spec;
    for (const o of (spec.points || []).concat(spec.links || []))
      if ("construction" in o){ if (o.construction) o.auxiliary = true; delete o.construction; }
    for (const p of spec.points || []) if ("limit" in p){ delete p.limit; if (dropped) dropped.push(p.id); }
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
    for (const v of (spec.logic || {}).variables || []) s.add(v.name);          // Variables (รอบ 5) = ตัวเลข ใช้แบบ parameter
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
  // ป้ายสั้นของสิ่งที่ทำให้ไม่เกิด (บนรูป / snap): กิ่ง = ชื่อกิ่ง · Loop = "A1 ชุดที่ 3" (รอบ 5b)
  const offLabel = (spec, id) => { const lp = /^(A\d+)#(\d+)$/.exec(id || ""); return lp ? `${lp[1]} ชุดที่ ${+lp[2] + 1}` : branchLabel(spec, id); };
  const branchLabel = (spec, id) => { const lp = /^(A\d+)#(\d+)$/.exec(id || ""); if (lp) return `${lp[1]} ชุดที่ ${+lp[2] + 1} (Loop — อาจไม่เกิดถ้า N น้อย ใช้ lastOf)`; const b = byId((spec.logic || {}).branches || [], id); return b ? b.label || b.id : id; };
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
      if (p.def.type !== "firstOf" && p.def.type !== "lastOf") for (const r of strictRefs(p.def)) for (const b of need(r)) s.add(b);
      busy.delete(id);
      return (req[id] = s);
    }
    const out = [];
    const check = (o, kind, ids) => {
      const mine = new Set(o.branch ? branchChain(spec, o.branch) : []);
      for (const r of ids) for (const b of need(r)) if (!mine.has(b)){ out.push({ id: o.id, kind, ref: r, branch: b }); return; }
    };
    for (const p of spec.points) if (p.def.type !== "firstOf" && p.def.type !== "lastOf") check(p, "point", strictRefs(p.def));
    // Loop (รอบ 5b): ของนอก Array อ้างจุดของชุดที่ 2.. = อาจไม่เกิดถ้า N น้อย (lastOf ของ Array นั้นไม่นับ) · branch = "A1#k"
    for (const g of spec.arrays || []){
      if (!g.loop) continue;
      const mine = new Set([...g.source.points, ...g.source.links, ...g.source.shapes, ...g.members.flatMap(m => [...m.points, ...m.links, ...m.shapes])]);
      const setOf = {}; g.members.forEach((m, i) => { for (const id of m.points) setOf[id] = i + 1; });
      const look = (o, kind, ids) => { if (mine.has(o.id) || out.some(x => x.id === o.id)) return; const r = ids.find(id => setOf[id]); if (r) out.push({ id: o.id, kind, ref: r, branch: `${g.id}#${setOf[r]}` }); };
      for (const p of spec.points) if (!(p.def.type === "lastOf" && p.def.array === g.id) && p.def.type !== "firstOf") look(p, "point", strictRefs(p.def));
      for (const l of spec.links) look(l, "link", linkRefs(l));
    }
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
    const r = REF_KEYS.map(k => def[k]).filter(Boolean);
    for (const k of EXPR_FIELDS[def.type] || []) for (const id of Expr.pointRefsOf(def[k], true)) if (!r.includes(id)) r.push(id);
    return r;
  }

  // ตัวเลือกของ Expr.check สำหรับช่องนิพจน์ของ spec นี้: จุดที่อ้างได้ + target (ไฟล์ import ใช้ target ของโค้ดเดิม = ไม่ตรวจชื่อ)
  //   self = id ของ object ที่ช่องนี้เป็นของ (อ้างตัวเองไม่ได้)
  function exprOpts(spec, self){
    return { points: spec.points.map(p => p.id).filter(id => id !== self), targets: spec.imported ? null : spec.targets.map(t => t.name),
             conds: ((spec.logic && spec.logic.conditions) || []).map(c => c.name), arrays: (spec.arrays || []).map(g => g.id) };
  }
  // ช่องนิพจน์ของ def แต่ละชนิด
  const EXPR_FIELDS = { delta: ["dx", "dy"], polar: ["length", "angle"], slopeLength: ["slope", "length"], slopeToSurface: ["slope", "maxDistance", "layoutLength"],
                        onSurface: ["dx"], between: ["t"], tangent: ["radius"], offset: ["dist"], extendToGround: ["maxDistance"] };
  // ช่องนิพจน์ของ link (seg.value แยกต่างหาก)
  const LINK_EXPR_FIELDS = { arcR: ["radius"], fillet: ["radius"], followClipped: ["refLevel"] };

  // ---------- คำนวณ ----------
  // ctx = { values: {ชื่อ: ค่า}, codeParams: [...], codePoints: [{x, y, codes}] (เทียบ origin),
  //         surface: [{x, y}] เทียบ origin หรือ null (ไม่มี/ไม่ได้กำหนด), extendEnds, layout,
  //         allBranches: ทุกกิ่งเกิด (ใช้วาด "แสดงทุกกรณี" เท่านั้น — ลาดจนชนดินที่ไม่ชน = ยาว layoutLength ไม่ใช่ maxDistance) }
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
      // ต้องมากกว่า 0 (แบบ base / body_rock-pitching.cs): ≤ 0 = error (Severe) + ใช้ default แทน
      if (p.positive && v <= 0){
        const d = p.kind === "long" ? Math.round(+p.default || 0) : +p.default || 0;
        issues.push({ level: "e", obj: p.name, msg: `${p.name} = ${fmtParam(p, v)} ต้องมากกว่า 0, ใช้ค่า default ${fmtParam(p, d)} แทน` });
        v = d;
      }
      if (p.min != null && v < p.min){ warn(p.name, `${p.name} = ${fmtParam(p, v)} < ${fmtParam(p, p.min)}, ใช้ ${fmtParam(p, p.min)} แทน`); v = p.min; }
      if (p.max != null && v > p.max){ warn(p.name, `${p.name} = ${fmtParam(p, v)} > ${fmtParam(p, p.max)}, ใช้ ${fmtParam(p, p.max)} แทน`); v = p.max; }
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
      isCond: name => name in condByName,
      count: id => { const g = byId(spec.arrays || [], id); if (!g) throw new Error(`ไม่มี Array ${id}`); return g.loop ? loopN(g) : g.n; },
      cond: name => { const v = cond(name); if (v === null) throw new Error(`เงื่อนไข ${name} ไม่รู้ค่า`); return v; }
    });

    // ---------- Logic (รอบ 4): เงื่อนไข / decision / กิ่ง — ดู docs/prompts/prompt-4-design.md ----------
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
    // ---------- Array แบบ Loop (รอบ 5b — docs/prompts/prompt-5b-design.md) ----------
    //   N = ปัดเศษค่าของ loop.n (nRound: floor ค่าเริ่ม / ceil / round .5 ออกจากศูนย์) แล้วบีบ 1..nMax · ชุดที่ k (ต้นฉบับ k = 0) เกิดเมื่อ k < N
    //   ⚠ (เว็บ + C#): เกินสูงสุด / น้อยกว่า 1 / หาค่าไม่ได้ · ℹ (เว็บเท่านั้น): ปัดเศษด้วยค่าเริ่มต้น — ตรงกับ LoopN ใน CodeGenerator.cs
    const loopOf = {}, loopVal = {}, loopBusy = new Set();
    for (const g of spec.arrays || []) if (g.loop) (g.members || []).forEach((m, i) => { for (const id of [...m.points, ...m.links, ...m.shapes]) loopOf[id] = { g, k: i + 1 }; });
    const ROUND_TH = { floor: "ปัดลง", ceil: "ปัดขึ้น", round: "ปัดใกล้สุด" };
    function loopN(g){
      if (g.id in loopVal) return loopVal[g.id];
      if (loopBusy.has(g.id)){ warn(g.id, `Array ${g.id}: หาจำนวนชุดไม่ได้ ใช้ 1`); return (loopVal[g.id] = 1); }
      loopBusy.add(g.id);
      const L = g.loop, nMax = Math.round(+L.nMax) || 10, mode = ROUND_TH[L.nRound] ? L.nRound : "floor";
      let raw = null;
      try{ raw = Expr.value(String(L.n), env, exprCtx(null)); if (!isFinite(raw)) raw = null; }catch{ raw = null; }
      let n;
      if (raw === null){ warn(g.id, `Array ${g.id}: หาจำนวนชุดไม่ได้ ใช้ 1`); n = 1; }
      else {
        const r = mode === "ceil" ? Math.ceil(raw) : mode === "round" ? Expr.roundAway(raw) : Math.floor(raw);
        if (!L.nRound && r !== raw) issues.push({ level: "i", obj: g.id, msg: `Array ${g.id}: N = ${Expr.num(raw)} → ${r} ชุด (ปัดลง — ค่าเริ่มต้น เปลี่ยนได้ที่ "ปัดเศษ N")` });
        if (r > nMax){ warn(g.id, `Array ${g.id}: ต้องการ ${r} ชุด เกินสูงสุด ${nMax} ใช้ ${nMax}`); n = nMax; }
        else if (r < 1){ warn(g.id, `Array ${g.id}: ได้ ${r} ชุด น้อยกว่า 1 ใช้ 1`); n = 1; }
        else n = r;
      }
      loopBusy.delete(g.id);
      return (loopVal[g.id] = n);
    }
    const loopOff = o => {
      const l = loopOf[o.id];
      if (!l || ctx.allBranches) return null;
      return l.k < loopN(l.g) ? null : { err: `ไม่เกิด (${l.g.id} ชุดที่ ${l.k + 1})`, off: `${l.g.id}#${l.k}` };
    };
    const offOf = o => (o.branch && !ctx.allBranches && !branchOn(o.branch) ? { err: `ไม่เกิด (กิ่ง ${branchLabel(spec, o.branch)})`, off: o.branch } : null) || loopOff(o);
    const Xv = (src, what, viewer) => { try{ return Expr.value(src, env, exprCtx(viewer)); }catch(e){ throw new Error(`${what}: ${e.message}`); } };
    const X = (src, what) => Xv(src, what, null);

    // ---------- Variables (รอบ 5 M3) — ค่าที่คำนวณครั้งเดียว ใช้ชื่อในนิพจน์ไหนก็ได้ (แบบ Define Variable ของ SAC) ----------
    //   rules = if / elif ตามลำดับ ตัวแรกที่จริงชนะ (warn = ข้อความเตือน {ชื่อ} = ค่า) · ไม่เข้าข้อไหน = expr
    //   ไม่รู้ค่า (อ้างจุดที่หาไม่ได้ / วนกัน) = เตือน + ทุกนิพจน์ที่ใช้ชื่อนี้หาไม่ได้ · คำนวณทุกตัวเสมอ (เตือนครบ) — ตรงกับ VariableLines ใน CodeGenerator.cs
    const VARS = LG.variables || [], varVal = {}, varBusy = new Set();
    const varWarnText = (t, self) => String(t).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, n) => {
      if (n === self) return m;
      try{ const x = env[n]; return typeof x === "number" ? `${x}` : m; }catch{ return m; }
    });
    function variable(v){
      if (!(v.name in varVal)){
        if (varBusy.has(v.name)) throw new Error(`${v.name} อ้างถึงตัวเองเป็นวง`);
        varBusy.add(v.name);
        let r;
        try{
          const c = exprCtx(null);
          const hit = (v.rules || []).find(rule => Expr.test(rule.when, env, c));
          r = { v: Expr.value(hit ? hit.value : v.expr, env, c) };
          if (hit && hit.warn) warn(v.name, varWarnText(hit.warn, v.name));
        }catch(e){ r = { err: `${v.name}: ${e.message}` }; warn(v.id || v.name, r.err); }   // obj = id (ข้อความเตือนของ rules ใช้ obj = ชื่อ — DrawingTests เทียบเฉพาะแบบหลัง)
        varBusy.delete(v.name);
        varVal[v.name] = r;
      }
      const r = varVal[v.name];
      if (r.err) throw new Error(r.err);
      return r.v;
    }
    // ชื่อ variable ใน env = getter (คำนวณตอนมีนิพจน์ใช้ครั้งแรก) · ไม่ enumerable (กัน spread / JSON ไปเรียกตัวที่ error)
    for (const v of VARS) Object.defineProperty(env, v.name, { get: () => variable(v), enumerable: false, configurable: true });

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
        case "offset": {
          // ตั้งฉากกับเส้น a→b: side 1 = ซ้ายของทิศ a→b ในกรอบ Side = Right (ฝั่ง Left ภาพกระจก = คูณ F) — ตรงกับ Offset ใน CodeGenerator.cs
          const a = need(d.a), b = need(d.b), dist = X(d.dist, "dist"), dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy);
          if (n < 1e-9) throw new Error(`เส้น ${d.a}-${d.b} ยาวเป็นศูนย์ หาทิศ offset ไม่ได้`);
          const e = d.end === "b" ? b : a, k = F * (d.side === -1 ? -1 : 1) * dist / n;
          return { x: e.x - dy * k, y: e.y + dx * k };
        }
        case "extendToGround": {
          // ต่อเส้น along→from เลย from จนชนดิน — ตรงกับ ExtendToGround ใน CodeGenerator.cs
          const f = need(d.from), a = need(d.along);
          const none = why => Object.assign(new Error(why), { off: GROUND_OFF });
          if (!ground) throw none("ไม่ต่อ (ไม่มีผิวดิน)");
          let gy;
          try{ gy = ground.elev(f.x); }catch(e){ throw new Error(`ต่อลงถึงดิน: ${e.message}`); }
          if (!(gy < f.y - 1e-9)) throw none(`ไม่ต่อ (ปลาย ${d.from} ไม่ลอยเหนือดิน)`);
          const dx = f.x - a.x, dy = f.y - a.y, maxD = X(d.maxDistance ?? "50", "maxDistance");
          if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) throw new Error(`ต่อลงถึงดิน: เส้น ${d.along}-${d.from} ยาวเป็นศูนย์`);
          let hit = null;
          if (Math.abs(dx) < 1e-12){ if (dy < 0) hit = { x: f.x, y: gy }; }
          else { try{ hit = ground.intersect(f.x, f.y, Math.sign(dx), dy / Math.abs(dx)); }catch{ hit = null; } }
          if (!hit || Math.abs(hit.x - f.x) > maxD + 1e-9) throw new Error(`ต่อลงถึงดิน: ไม่ชนผิวดินภายใน ${Expr.num(maxD)} m`);
          return hit;
        }
        case "tangent": {
          const c = need(d.corner), t = need(d.toward), o = need(d.other), R = X(d.radius, "radius");
          const r = tangentPoint(c, t, o, R);
          if (r.warn) warn(p.id, `${p.id} จุดสัมผัส: ${r.warn} — ใช้มุมแหลมเดิม`);
          return { x: r.x, y: r.y };
        }
        case "lastOf":                    // จุดของชุดสุดท้ายที่เกิด (รอบ 5b) = จุดแรกที่เกิดในรายการ [ชุดสุดท้าย … ต้นฉบับ] (spec ดูแลรายการให้)
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
      // ปลายจริง (firstOf aux) ต่อได้ถ้าจุดในรายการเป็นจุดจริงทั้งหมด (พิกัด = จุดแรกที่เกิดอยู่แล้ว)
      const aux = isAux(l), ae = aux ? null : [a, b].map(id => auxEnd(spec, id)).find(Boolean);
      if (ae){ links[l.id] = { err: `ปลาย ${ae} เป็นจุด auxiliary (ไม่อยู่ใน Civil 3D)`, auxEnd: ae }; warn(l.id, `${l.id}: ${links[l.id].err}`); continue; }
      let path = [A, B], arc = null;
      if (l.type === "followSurface"){
        if (ground) path = [A, ...ground.between(A.x, B.x), B];
        else if (!ctx.layout) warn(l.id, `${l.id} วิ่งตามผิวดิน: ${noTargetMsg} — ใช้เส้นตรงแทน`);
      }
      else if (l.type === "followClipped"){
        // เส้นอ้างอิง: ปลายของ link เส้นตรง / ระดับคงที่ — หาไม่ได้ = link นี้หาไม่ได้ (ไม่เกิดเพราะกิ่ง = เงียบ)
        let R1, R2;
        try{
          if (l.refLink){
            const rl = byId(spec.links, l.refLink);
            if (!rl || !rl.points || rl.type) throw new Error(`เส้นอ้างอิง ${l.refLink} ต้องเป็น link เส้นตรง`);
            R1 = need(rl.points[0]); R2 = need(rl.points[1]);
          } else { const lv = X(l.refLevel ?? "0", "ระดับอ้างอิง"); R1 = { x: 0, y: lv }; R2 = { x: 1, y: lv }; }
        }catch(e){
          links[l.id] = e.off ? { err: e.message, off: e.off } : { err: e.message };
          if (!e.off) warn(l.id, `${l.id}: ${e.message}`);
          continue;
        }
        const r = clipPath(l, A, B, R1, R2, ground, ctx.layout, msg => warn(l.id, `${l.id} ตามดิน ไม่เกินเส้น: ${msg} — ใช้เส้นตรงแทน`), noTargetMsg);
        links[l.id] = { path: r.path, segCodes: r.segCodes, segOn: r.segOn };
        if (aux) links[l.id].aux = true;
        continue;
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
      // link optional (ต่อลงถึงดิน) ที่วาดไม่ได้ / ไม่เกิด = ข้ามไปเฉยๆ (C#: Opt)
      const optional = id => { const l = byId(spec.links, id); return !!(l && l.optional && !isAux(l)); };
      const use = s.links.filter(id => !(optional(id) && links[id] && links[id].err));
      const bad = use.find(id => !links[id] || links[id].err);
      if (bad){ shapes[s.id] = { err: `ข้ามเพราะ link ${bad} วาดไม่ได้` }; warn(s.id, `${s.id}: ${shapes[s.id].err}`); continue; }
      // shape ใน Civil 3D ประกอบจาก link จริงเท่านั้น
      const ax = s.links.find(id => links[id] && links[id].aux);
      if (ax){ shapes[s.id] = { err: `ใช้ link auxiliary ${ax} ไม่ได้ (ไม่อยู่ใน Civil 3D)`, auxLink: ax }; warn(s.id, `${s.id}: ${shapes[s.id].err}`); continue; }
      // generated C# sorts the links into a closed chain (ChainLinks), then Civil 3D walks them in that order
      const paths = use.map(id => links[id].path);
      const order = chainOrder(paths);
      if (!order) warn(s.id, `${s.id}: link ต่อกันไม่เป็นรูปปิด — Civil 3D จะระบายสีผิด`);
      const w = walkShape(order ? order.map(i => paths[i]) : paths);
      shapes[s.id] = order ? { poly: w.poly } : { poly: w.poly, broken: true };
    }
    for (const b of BRS) branchOn(b.id);
    // variable ที่ยังไม่มีใครใช้ก็คำนวณ (เตือนครบเหมือน C#) · vars = ค่าตอนนี้ (null = ไม่รู้ค่า)
    const vars = {};
    for (const v of VARS){ try{ vars[v.name] = variable(v); }catch{ vars[v.name] = null; } }
    // Loop ที่ยังไม่มีใครถามก็คำนวณ (เตือนครบเหมือน C#) · loops = N ตอนนี้
    const loops = {};
    for (const g of spec.arrays || []) if (g.loop) loops[g.id] = loopN(g);
    return { pts, links, shapes, issues, flip: F, env, raw: raws, logic: { conds: condVal, decisions: decVal, branches: brVal, vars, loops } };
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

  const samePt = (p, q) => Math.abs(p.x - q.x) < 1e-7 && Math.abs(p.y - q.y) < 1e-7;

  // Same as ChainLinks in the generated C#: order of the link paths that makes one closed chain,
  // starting from the first link (greedy, first link that touches the current end) · null = not possible
  function chainOrder(paths){
    if (!paths.length) return null;
    const rest = paths.map((p, i) => i).slice(1), order = [0];
    const start = paths[0][0];
    let end = paths[0][paths[0].length - 1];
    while (rest.length){
      const k = rest.findIndex(i => samePt(paths[i][0], end) || samePt(paths[i][paths[i].length - 1], end));
      if (k < 0) return null;
      const i = rest.splice(k, 1)[0], p = paths[i];
      end = samePt(p[0], end) ? p[p.length - 1] : p[0];
      order.push(i);
    }
    return samePt(end, start) ? order : null;
  }

  // Same as Civil 3D (ShapeWalk in the shim): walk the links in the order given · first link keeps its direction,
  // a link touching the current end is turned around if needed, a link that does not touch is appended as is (crossed fill)
  // → { poly (closed implicitly, null below 3 points), chained }
  function walkShape(paths){
    const out = [];
    let chained = true;
    for (const p of paths){
      if (!out.length){ out.push(...p); continue; }
      const end = out[out.length - 1];
      if (samePt(p[0], end)) out.push(...p.slice(1));
      else if (samePt(p[p.length - 1], end)) out.push(...p.slice().reverse().slice(1));
      else { chained = false; out.push(...p); }
    }
    if (out.length > 1 && samePt(out[0], out[out.length - 1])) out.pop();
    else chained = false;
    return { poly: out.length >= 3 ? out : null, chained };
  }

  // Clipped Surface Link: เส้นทางจาก A ถึง B ตามผิวดิน แต่ไม่เกินเส้นอ้างอิง R1–R2 (ต่อออกไปได้) — ตรงกับ FollowClipped ใน CodeGenerator.cs
  //   และ BuildBottom ของ base_rock-pitching.cs · คืน { path, segCodes (code ของแต่ละท่อน), segOn (ท่อนอยู่บนเส้นอ้างอิง) } · fail(msg) = เตือน (ใช้เส้นตรงแทน)
  function clipPath(l, A, B, R1, R2, ground, layout, fail, noTargetMsg){
    const base = l.codes || [], uniq = a => [...new Set(a)];
    const lineCodes = uniq(base.concat(l.codesLine || [])), gndCodes = uniq(base.concat(l.codesGround || []));
    const straight = { path: [A, B], segCodes: [lineCodes], segOn: [true] };
    if (Math.abs(R2.x - R1.x) < 1e-9){ fail("เส้นอ้างอิงเป็นแนวดิ่ง"); return straight; }
    if (!ground){ if (!layout) fail(noTargetMsg); return straight; }
    const Lf = x => R1.y + (R2.y - R1.y) * (x - R1.x) / (R2.x - R1.x);
    let prof;
    try{ prof = [{ x: A.x, y: ground.elev(A.x) }, ...ground.between(A.x, B.x), { x: B.x, y: ground.elev(B.x) }]; }
    catch(e){ fail(e.message); return straight; }
    const below = l.side !== "above";
    const clip = (x, y) => below ? Math.min(y, Lf(x)) : Math.max(y, Lf(x));
    const raw = [{ x: prof[0].x, y: clip(prof[0].x, prof[0].y) }];
    for (let i = 0; i < prof.length - 1; i++){
      const a = prof[i], b = prof[i + 1], da = a.y - Lf(a.x), db = b.y - Lf(b.x);
      if (da * db < 0){ const t = da / (da - db), x = a.x + t * (b.x - a.x); raw.push({ x, y: Lf(x) }); }   // ดินตัดเส้น
      raw.push({ x: b.x, y: clip(b.x, b.y) });
    }
    const on = p => Math.abs(p.y - Lf(p.x)) < 1e-4;
    // ตัดจุดซ้ำ (ระยะราบ < 0.0001) และจุดกลางของช่วงที่อยู่บนเส้น (แบบ cleaned)
    const c = [];
    for (const p of raw){
      if (c.length && Math.abs(p.x - c[c.length - 1].x) < 1e-4) continue;
      if (c.length >= 2 && on(p) && on(c[c.length - 1]) && on(c[c.length - 2])){ c[c.length - 1] = p; continue; }
      c.push(p);
    }
    // ปลายทั้งสอง = from / to ตัวจริง
    const path = c.length < 2 ? [A, B] : [A, ...c.slice(1, -1), B];
    const segOn = [];
    for (let i = 0; i < path.length - 1; i++) segOn.push(on(path[i]) && on(path[i + 1]));
    return { path, segCodes: segOn.map(o => o ? lineCodes : gndCodes), segOn };
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
  // ---------- parameter: ขอบเขตค่า (ตาราง Parameter / Logic API) ----------
  // { positive, min, max } — null / false = ไม่คุม · ผิด = throw Error ข้อความไทย
  function setParamBounds(spec, name, b){
    const p = spec.params.find(x => x.name === name);
    if (!p) throw new Error(`ไม่มี parameter ${name}`);
    const num = v => v == null || v === "" ? null : +v;
    const mn = "min" in b ? num(b.min) : p.min, mx = "max" in b ? num(b.max) : p.max;
    if ((mn != null && !isFinite(mn)) || (mx != null && !isFinite(mx))) throw new Error("ขั้นต่ำ / ขั้นสูง ต้องเป็นตัวเลข");
    if (mn != null && mx != null && mn > mx) throw new Error(`ขั้นต่ำ (${mn}) มากกว่า ขั้นสูง (${mx})`);
    p.min = mn; p.max = mx;
    if ("positive" in b){ if (b.positive) p.positive = true; else delete p.positive; }
    return p;
  }
  // default ขัดกับขอบเขตไหม (เตือนในตาราง) — null = ไม่ขัด
  function paramBoundsIssue(p){
    const d = +p.default, f = v => fmtParam(p, v);
    if (p.min != null && p.max != null && p.min > p.max) return `ขั้นต่ำ ${f(p.min)} มากกว่า ขั้นสูง ${f(p.max)}`;
    if (p.positive && d <= 0) return `default ${f(d)} ไม่มากกว่า 0 — Civil 3D จะขึ้น error ทุกครั้งที่ใช้ค่า default`;
    if (p.min != null && d < p.min) return `default ${f(d)} ต่ำกว่าขั้นต่ำ ${f(p.min)} — Civil 3D จะเตือนทุกครั้งที่ใช้ค่า default`;
    if (p.max != null && d > p.max) return `default ${f(d)} สูงกว่าขั้นสูง ${f(p.max)} — Civil 3D จะเตือนทุกครั้งที่ใช้ค่า default`;
    return null;
  }

  // ---------- ชนิดค่าของ parameter (รอบ 4e) ----------
  // p.unit: ไม่มี = number (spec เก่า) · ค่าที่เก็บ / ใช้ในนิพจน์ / C# = ตัวเลขเดิมเสมอ — ชนิดค่ามีผลแค่การแสดง / ข้อความเตือน
  //   slope = x ของ 1:x (ดิ่ง:ราบ) แบบไฟล์ของผู้ใช้ (SideSlope = 1.5) · percent = เลขเปอร์เซ็นต์ (2 = 2%) · length = เมตร
  const UNITS = { number: "Number", slope: "Slope (1:x)", length: "Length (m)", percent: "Percent (%)" };
  const unitOf = p => p && UNITS[p.unit] ? p.unit : "number";
  // รูปแบบเดียวกับข้อความเตือนใน CodeGenerator.cs (UnitPre / UnitSuf)
  const fmtUnit = (unit, v) => unit === "slope" ? `1:${v}` : unit === "length" ? `${v} m` : unit === "percent" ? `${v}%` : `${v}`;
  const fmtParam = (p, v) => fmtUnit(unitOf(p), v);
  // ค่าที่พิมพ์ในตาราง (default / ขั้นต่ำ / ขั้นสูง): slope "1:1.5" | "1.5" · percent "2%" · length "2 m" → ตัวเลข · ว่าง = null · ผิด = NaN
  function parseUnitValue(unit, text){
    let t = String(text ?? "").trim();
    if (t === "") return null;
    if (unit === "slope"){ const m = /^1\s*:\s*(.+)$/.exec(t); if (m) t = m[1].trim(); }
    else if (unit === "percent") t = t.replace(/\s*%$/, "");
    else if (unit === "length") t = t.replace(/\s*m$/i, "");
    return t === "" ? NaN : Number(t);
  }
  // เปลี่ยนชนิดค่า: Slope = ติ๊ก "ต้องมากกว่า 0" ให้ (x ≤ 0 ใช้ไม่ได้ — เอาออกเองได้)
  function setParamUnit(spec, name, unit){
    const p = spec.params.find(x => x.name === name);
    if (!p) throw new Error(`ไม่มี parameter ${name}`);
    if (!UNITS[unit]) throw new Error(`ไม่มีชนิดค่า ${unit}`);
    if (unit === "number") delete p.unit; else p.unit = unit;
    if (unit === "slope") p.positive = true;
    return p;
  }

  // ---------- ช่อง slope (ลาด + ความยาว, ลาดจนชนดิน) ----------
  // เก็บแบบเดิมเสมอ = นิพจน์ดิ่งต่อราบมีเครื่องหมาย (ลง = ลบ) เช่น "-1/SideSlope" → evaluator / C# / spec เก่าไม่เปลี่ยน
  // หน้าตาในเว็บ = ทิศ ↗ / ↘ + ข้อความ: 1:1.5 · ชื่อ parameter ชนิด Slope · 2% · ชื่อ parameter ชนิด Percent · นิพจน์ (เครื่องหมายอยู่ในนิพจน์เอง)
  const SLOPE_NUM = "\\d+(?:\\.\\d+)?|\\.\\d+", SLOPE_ID = "[A-Za-z_][A-Za-z0-9_]*";
  const paramUnit = (spec, name) => { const p = (spec.params || []).find(x => x.name === name) || ((spec.logic || {}).variables || []).find(x => x.name === name); return p ? unitOf(p) : null; };   // variable มีชนิดค่าแบบ parameter
  // นิพจน์ที่เก็บ → { up, text, mode: "ratio" | "param" | "percent" | "expr" } (ไม่เข้ารูปแบบ = expr แสดงตามเดิม)
  function slopeRead(spec, expr){
    const raw = String(expr ?? "").trim(), s = raw.replace(/\s+/g, "");
    let m = new RegExp(`^(-?)1(?:\\.0*)?/(${SLOPE_NUM})$`).exec(s);
    if (m) return { up: !m[1], text: `1:${m[2]}`, mode: "ratio" };
    m = new RegExp(`^(-?)1(?:\\.0*)?/(${SLOPE_ID})$`).exec(s);
    if (m && paramUnit(spec, m[2]) === "slope") return { up: !m[1], text: m[2], mode: "param" };
    m = new RegExp(`^(-?)(${SLOPE_NUM})/100(?:\\.0*)?$`).exec(s);
    if (m) return { up: !m[1], text: `${m[2]}%`, mode: "percent" };
    m = new RegExp(`^(-?)(${SLOPE_ID})/100(?:\\.0*)?$`).exec(s);
    if (m && paramUnit(spec, m[2]) === "percent") return { up: !m[1], text: m[2], mode: "percent" };
    return { up: null, text: raw, mode: "expr" };
  }
  // ข้อความ + ทิศ → นิพจน์ที่เก็บ (up = true ขึ้น / false ลง) · -1:2 แบบเดิม = เครื่องหมายตามที่พิมพ์ · อื่นๆ = นิพจน์ตามที่พิมพ์
  function slopeWrite(spec, up, text){
    const t = String(text ?? "").trim(), sg = up ? "" : "-";
    let m = new RegExp(`^(-?)1\\s*:\\s*(${SLOPE_NUM})$`).exec(t);
    if (m) return { expr: `${m[1] ? "-" : sg}1/${m[2]}`, mode: "ratio" };
    m = new RegExp(`^(${SLOPE_NUM})\\s*%$`).exec(t);
    if (m) return { expr: `${sg}${m[1]}/100`, mode: "percent" };
    if (new RegExp(`^${SLOPE_ID}$`).test(t)){
      const u = paramUnit(spec, t);
      if (u === "slope") return { expr: `${sg}1/${t}`, mode: "param" };
      if (u === "percent") return { expr: `${sg}${t}/100`, mode: "percent" };
    }
    return { expr: t, mode: "expr" };
  }
  // "ขนาด" ของลาด (ไม่มีเครื่องหมาย — ทิศกำหนดที่อื่น เช่น Daylight Cut/Fill: ตัด ขึ้น / ถม ลง) จากค่าแบบช่อง slope
  //   v = ตัวเลข (x ของ 1:x — แบบเดิมของ addCutFill) หรือข้อความ: 1:1.5 · parameter Slope · 2% · parameter Percent · ดิ่งต่อราบ (0.667 / นิพจน์)
  //   คืน { mag: นิพจน์ดิ่งต่อราบ (บวก), x: x ของ 1:x ถ้าเป็นค่าคงที่ (ไม่งั้น null), param: ชื่อ parameter ที่ใช้ (หรือ null) } · ผิด = throw
  function slopeMagnitude(spec, v, what){
    const W = what || "ลาด";
    const pos = n => { if (!(n > 0) || !isFinite(n)) throw new Error(`${W}: ต้องมากกว่า 0 (ได้ ${n})`); return n; };
    if (typeof v === "number"){ pos(v); return { mag: `1/${Expr.num(v)}`, x: v, param: null }; }
    const t = String(v ?? "").trim().replace(/^-\s*/, "");          // เครื่องหมายไม่มีผล (ทิศกำหนดที่อื่น)
    if (!t) throw new Error(`${W}: ว่าง`);
    const w = slopeWrite(spec, true, t);
    if (w.mode === "ratio"){ const x = pos(+/:\s*(.+)$/.exec(t)[1]); return { mag: `1/${Expr.num(x)}`, x, param: null }; }
    if (w.mode === "param") return { mag: w.expr, x: null, param: t };
    if (w.mode === "percent"){
      const m = /^(\d+(?:\.\d+)?|\.\d+)\s*%$/.exec(t);
      if (m) return { mag: w.expr, x: 100 / pos(+m[1]), param: null };
      return { mag: w.expr, x: null, param: t };
    }
    if (/^(\d+(?:\.\d+)?|\.\d+)$/.test(t)){ const n = pos(+t); return { mag: Expr.num(n), x: 1 / n, param: null }; }
    const r = Expr.check(t, names(spec), { ...exprOpts(spec), want: "num" });
    if (!r.ok) throw new Error(`${W}: ${r.error}`);
    return { mag: t, x: null, param: null };
  }

  // ---------- Logic: สร้างเงื่อนไข / กิ่ง ----------
  // ชื่อที่ยังไม่มีใน parameter / เงื่อนไข / จุด: base, base2, base3, ...
  function freeName(spec, base){
    const used = new Set(spec.params.map(p => p.name).concat(((spec.logic || {}).conditions || []).map(c => c.name), ((spec.logic || {}).variables || []).map(v => v.name), spec.points.map(p => p.id)));
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
  // ปุ่มสำเร็จรูป "ถ้าตัด / ถม" ที่จุดบานพับ hinge — ตัด = ผิวดินสูงกว่าบานพับ (ground(hinge) > hinge.y), ไม่มีผิวดิน = ถม
  //   o = { hinge, target, cut: 1.5, fill: 2 (ลาด 1:x), params: สร้าง CutSlope / FillSlope, dir: 1 | -1, cutCode, fillCode }
  //   ได้: เงื่อนไข IsCut + กิ่ง ตัด / ถม (ซ้อนใต้กิ่งของบานพับ ถ้ามี), จุดลาดจนชนดินกิ่งละจุด + link, จุด firstOf "Daylight" (auxiliary)
  function addCutFill(spec, o){
    const h = byId(spec.points, o.hinge);
    if (!h) throw new Error(`ไม่มีจุด ${o.hinge}`);
    const target = o.target || (spec.targets[0] || {}).name || "TargetSurface";
    // o.cut / o.fill = ตัวเลข x (1:x — แบบเดิม) หรือข้อความแบบช่อง slope (slopeMagnitude): 1:1.5 · parameter Slope · 2% · parameter Percent · ดิ่งต่อราบ 0.667
    //   ทิศ: ตัด = ขึ้น · ถม = ลง เสมอ · params = ค่าคงที่ → สร้าง CutSlope / FillSlope ชนิด Slope (default = x ของ 1:x) · ใส่ชื่อ parameter = ใช้ตัวนั้นเลย
    const mk = (v, base, label, what) => {
      const s = slopeMagnitude(spec, v, what);
      if (!o.params || s.x == null) return s.mag;
      const n = freeName(spec, base);
      spec.params.push({ name: n, kind: "double", default: +Expr.num(s.x), displayName: label, min: null, max: null, unit: "slope", positive: true });
      return `1/${n}`;
    };
    const neg = m => /^[A-Za-z0-9_.]+(\/[A-Za-z0-9_.]+)?$/.test(m) ? "-" + m : `-(${m})`;
    const cutS = mk(o.cut, "CutSlope", "Cut Slope (1:x)", "ลาดตัด"), fillS = neg(mk(o.fill, "FillSlope", "Fill Slope (1:x)", "ลาดถม"));
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
    // Clipped Surface Link ที่เส้นอ้างอิงหายไป = หายด้วย (วนเผื่อเส้นอ้างอิงเป็นของที่เพิ่งหาย)
    for (let more = true; more; ){
      more = false;
      for (const l of spec.links) if (l.refLink && !gone.links.has(l.id) && gone.links.has(l.refLink)){ gone.links.add(l.id); more = true; }
    }
    for (const s of spec.shapes) if (s.links.some(r => gone.links.has(r))) gone.shapes.add(s.id);
    spec.points = spec.points.filter(p => !gone.points.has(p.id));
    spec.links = spec.links.filter(l => !gone.links.has(l.id));
    spec.shapes = spec.shapes.filter(s => !gone.shapes.has(s.id));
    // polygon ที่เสียชิ้นส่วนไป = เหลือเป็นจุด / link / shape ธรรมดา (เลิกแก้ N / R / θ ได้)
    if (spec.polygons) spec.polygons = spec.polygons.filter(g => !gone.points.has(g.center) && !g.points.some(p => gone.points.has(p))
                                                              && !g.links.some(l => gone.links.has(l)) && !(g.shape && gone.shapes.has(g.shape)));
    // Array ที่เสียชิ้นส่วน (ต้นฉบับ / สมาชิก) = เลิกเป็น array (ที่เหลือเป็นจุด / link / shape ธรรมดา)
    if (spec.arrays){
      const hit = o => o.points.some(p => gone.points.has(p)) || o.links.some(l => gone.links.has(l)) || o.shapes.some(s => gone.shapes.has(s));
      spec.arrays = spec.arrays.filter(g => !hit(g.source) && !g.members.some(hit));
    }
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
    for (const g of spec.arrays || []) for (const k of ["dx", "dy"]) out.push({ obj: g, key: k, id: g.id });
    // เงื่อนไข / decision (เปลี่ยนชื่อ parameter แล้วนิพจน์ในเงื่อนไขเปลี่ยนตาม)
    const lg = spec.logic || {};
    for (const c of lg.conditions || []) if (c.expr != null) out.push({ obj: c, key: "expr", id: c.name });
    for (const d of lg.decisions || []) if (d.test != null) out.push({ obj: d, key: "test", id: d.label || d.id });
    for (const v of lg.variables || []){
      if (v.expr != null) out.push({ obj: v, key: "expr", id: v.name });
      for (const r of v.rules || []) for (const k of ["when", "value", "warn"]) if (r[k] != null) out.push({ obj: r, key: k, id: v.name });
    }
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

  // ---------- Intersect / Offset (รอบ 4c) ----------
  const straightEnds = l => l && l.points && !l.type ? l.points : null;
  // จุดตัดของ link เส้นตรง id1 กับ id2 (ต่อเส้นออกไปได้) -> จุด intersect ใหม่
  //   opt.trim = ตัด / ยืดเส้นให้จบที่จุดตัด: keep1 / keep2 = ปลายที่เก็บไว้ของแต่ละเส้น (อีกปลายถูกแทนด้วยจุดตัด)
  //     ปลายที่ถูกแทนยังอยู่ (จุดตัดอ้างมัน) · ไม่มี link อื่นต่อและไม่มี point code = เป็นจุดช่วยสร้าง (แบบ Fillet)
  //   opt.aux = จุดตัดเป็น auxiliary (link ทั้งสองเป็น auxiliary = จุดตัด auxiliary เอง)
  //   คืน { point, dropped: [ปลายที่ถูกแทน], kept: [ปลายที่ถูกแทนแต่มี code เลยคงเป็นจุดจริง] } หรือ { error }
  function addIntersect(spec, id1, id2, opt){
    opt = opt || {};
    const l1 = byId(spec.links, id1), l2 = byId(spec.links, id2);
    if (!l1 || !l2 || id1 === id2) return { error: "เลือก link 2 เส้นที่ต่างกัน" };
    const e1 = straightEnds(l1), e2 = straightEnds(l2);
    if (!e1 || !e2) return { error: "Intersect ได้เฉพาะ link เส้นตรง" };
    const common = e1.find(p => e2.includes(p));
    if (common) return { error: `${id1} กับ ${id2} ต่อกันที่ ${common} อยู่แล้ว` };
    if (opt.trim && (!e1.includes(opt.keep1) || !e2.includes(opt.keep2))) return { error: "ไม่รู้ว่าจะเก็บปลายไหนของเส้น" };
    const aux = !!opt.aux || (isAux(l1) && isAux(l2));
    const P = addPoint(spec, { type: "intersect", a1: e1[0], a2: e1[1], b1: e2[0], b2: e2[1] }, [], aux);
    const br = l1.branch && l1.branch === l2.branch ? l1.branch : null;
    if (br) byId(spec.points, P).branch = br;
    const dropped = [], kept = [];
    if (opt.trim){
      for (const [l, keep] of [[l1, opt.keep1], [l2, opt.keep2]]){
        const drop = l.points.find(p => p !== keep);
        l.points = l.points.map(p => p === drop ? P : p);          // ทิศของเส้นคงเดิม
        dropped.push(drop);
      }
      if (spec.polygons) spec.polygons = spec.polygons.filter(g => !g.links.includes(id1) && !g.links.includes(id2));
      for (const id of dropped){
        const p = byId(spec.points, id), free = !spec.links.some(l => linkEnds(l).includes(id));
        if (p && free){ if (p.codes.length) kept.push(id); else p.auxiliary = true; }
      }
    }
    return { point: P, dropped, kept };
  }
  // เส้นขนานของ link เส้นตรง id: 2 จุด offset (ปลาย a / b) + link ใหม่ระหว่างกัน
  //   dist = นิพจน์ (เช่น "RockThickness"), side 1 = ซ้ายของทิศ a→b ในกรอบ Side = Right / -1 = ขวา
  //   opt.aux = จุด + link เป็น auxiliary (ต้องติ๊กเอง — ไม่ตามเส้นเดิม) · คืน { a, b, link } หรือ { error }
  function addOffset(spec, id, dist, side, opt){
    opt = opt || {};
    const l = byId(spec.links, id), e = straightEnds(l);
    if (!e) return { error: "Offset ได้เฉพาะ link เส้นตรง" };
    const D = String(dist ?? "").trim();
    if (!D) return { error: "ใส่ระยะ offset" };
    const s = side === -1 ? -1 : 1, aux = !!opt.aux;
    const a = addPoint(spec, { type: "offset", a: e[0], b: e[1], end: "a", dist: D, side: s }, [], aux);
    const b = addPoint(spec, { type: "offset", a: e[0], b: e[1], end: "b", dist: D, side: s }, [], aux);
    const nl = byId(spec.links, addLink(spec, a, b, { points: [a, b], ...(aux ? { auxiliary: true } : {}) }));
    if (l.branch) for (const o of [byId(spec.points, a), byId(spec.points, b), nl]) o.branch = l.branch;
    return { a, b, link: nl.id };
  }

  // ---------- Array (รอบ 4c) ----------
  // spec.arrays = [{ id: "A1", source: { points, links, shapes }, n (ชุดทั้งหมดรวมต้นฉบับ), dx, dy (นิพจน์ · dx ไปทางนอก + ในกรอบ Side = Right),
  //                  join: null | { mode: "share" | "link", from, to }, members: [{ points, links, shapes }] (ชุดที่ 2..n) }]
  //   จุดของชุดที่ k = delta { from: จุดเดียวกันของชุด k−1, dx, dy } → แก้ dx / dy ทีเดียวขยับทั้งแถว (evaluate / C# ไม่ต้องรู้จัก array)
  //   join share = จุด to ของชุดถัดไป "คือ" จุด from ของชุดก่อน (ขั้นบันไดต่อกัน ไม่สร้างจุดซ้ำ) · link = ต่อชุดด้วย link from (ชุดก่อน) → to (ชุดถัดไป)
  //   link / shape ในชุดคัดลอกด้วย (ปลายแทนด้วยจุดของชุดนั้น) · code / Auxiliary / กิ่ง ตามต้นฉบับ
  //   sel ต้องครบแล้ว (ปลาย link / link ของ shape — ดู Ops.expand) · คืน array หรือ { error }
  function addArray(spec, sel, o){
    const g = { id: null, source: { points: (sel.points || []).slice(), links: (sel.links || []).slice(), shapes: (sel.shapes || []).slice() },
                n: Math.round(+o.n), dx: String(o.dx ?? "0").trim() || "0", dy: String(o.dy ?? "0").trim() || "0", join: o.join || null, members: [] };
    // Loop (รอบ 5b): สร้างเผื่อไว้ nMax ชุด · ชุดที่ k เกิดเมื่อ k < N (evaluate / C#)
    if (o.loop) setLoop(g, o.loop);
    const err = arrayIssue(spec, g);
    if (err) return { error: err };
    spec.arrays = spec.arrays || [];
    let k = 0; for (const x of spec.arrays){ const m = /^A(\d+)$/.exec(x.id); if (m) k = Math.max(k, +m[1]); }
    g.id = "A" + (k + 1);
    buildArray(spec, g);
    spec.arrays.push(g);
    return g;
  }
  // Loop: { n: นิพจน์, nMax: 2..50 (ค่าเริ่ม 10), nRound?: floor | ceil | round } — n ของ array = nMax (ชุดที่สร้างไว้)
  const LOOP_MAX = 50, LOOP_DEFAULT = 10, LOOP_ROUND = ["floor", "ceil", "round"];
  function setLoop(g, L){
    g.loop = { n: String(L.n ?? "").trim(), nMax: L.nMax == null || L.nMax === "" ? LOOP_DEFAULT : Math.round(+L.nMax) };
    if (L.nRound && L.nRound !== "") g.loop.nRound = L.nRound;
    g.n = g.loop.nMax;
  }
  function arrayIssue(spec, g){
    if (g.loop){
      const L = g.loop;
      if (!(L.nMax >= 2 && L.nMax <= LOOP_MAX)) return `สูงสุดต้อง 2–${LOOP_MAX} ชุด (รวมชุดต้นฉบับ)`;
      if (L.nRound && !LOOP_ROUND.includes(L.nRound)) return "ปัดเศษ N ต้องเป็น floor / ceil / round";
      const c = Expr.check(L.n || "", names(spec), { ...exprOpts(spec), want: "num" });
      if (!c.ok) return "N: " + (L.n ? c.error : "ว่าง");
    }
    else if (!(g.n >= 2 && g.n <= 200)) return "จำนวนชุดต้อง 2–200 (รวมชุดต้นฉบับ)";
    if (!g.source.points.length) return "เลือก object ก่อน (จุด / link / shape ที่วาด)";
    if (g.source.points.some(id => !byId(spec.points, id))) return "มีจุดในชุดที่ไม่มีอยู่";
    for (const id of g.source.links){ const l = byId(spec.links, id); if (!l) return `ไม่มี link ${id}`; if (!linkRefs(l).every(p => g.source.points.includes(p))) return `ปลายของ ${id} ไม่อยู่ในชุด`; }
    for (const id of g.source.shapes){ const s = byId(spec.shapes, id); if (!s || !s.links.every(l => g.source.links.includes(l))) return `link ของ ${id} ไม่อยู่ในชุด`; }
    const j = g.join;
    if (j){
      if (!["share", "link"].includes(j.mode)) return "วิธีต่อชุดไม่ถูกต้อง";
      if (!g.source.points.includes(j.from) || !g.source.points.includes(j.to)) return "จุดที่ใช้ต่อชุดต้องอยู่ในชุด";
      if (j.from === j.to) return "จุดต่อชุดต้องเป็นคนละจุด";
    }
    return null;
  }
  // ตัวนับ i (รอบ 5b) = ลำดับของชุดที่กำลังวาง (ต้นฉบับ 0, ชุดถัดไป 1, 2, …) — แทนเป็นตัวเลขในนิยามของสมาชิก (evaluate / C# ไม่ต้องรู้จัก i)
  const withI = (e, k) => String(e).replace(/\bi\b/g, `(${k})`);
  // จุด p (ของชุดต้นฉบับ) ในชุดที่ k (join share: จุด to ของชุด k = จุด from ของชุด k−1)
  function arraySetPoint(spec, g, p, k){
    if (k === 0) return p;
    const j = g.join, share = j && j.mode === "share";
    if (share && p === j.to) return arraySetPoint(spec, g, j.from, k - 1);
    const src = g.source.points.filter(id => !(share && id === j.to));
    const i = src.indexOf(p);
    return i < 0 || !g.members[k - 1] ? null : g.members[k - 1].points[i];
  }
  // lastOf ของ Array นี้: รายการ = จุดเดียวกันจากชุดสุดท้ายย้อนถึงต้นฉบับ (เรียกหลังสร้าง / แก้จำนวนชุด)
  function refreshLastOf(spec, g){
    for (const p of spec.points) if (p.def.type === "lastOf" && p.def.array === g.id){
      const list = []; for (let k = g.n - 1; k >= 0; k--){ const id = arraySetPoint(spec, g, p.def.point, k); if (id && !list.includes(id)) list.push(id); }
      p.def.points = list;
    }
  }
  // สร้างจุด "ชุดสุดท้าย" ของจุด p ใน Array (aux = ปลายจริง ต่อ link จริงได้แบบ firstOf) · คืน id หรือ { error }
  function addLastOf(spec, arrayId, p, opt){
    const g = byId(spec.arrays || [], arrayId);
    if (!g) return { error: `ไม่มี Array ${arrayId}` };
    if (!g.source.points.includes(p)) return { error: `${p} ไม่ใช่จุดของชุดต้นฉบับของ ${arrayId}` };
    const id = addPoint(spec, { type: "lastOf", array: arrayId, point: p, points: [] }, (opt && opt.codes) || [], !(opt && opt.aux === false));
    refreshLastOf(spec, g);
    return id;
  }
  // สร้างสมาชิกชุดที่ 2..n (ต่อท้าย spec)
  function buildArray(spec, g){
    const src = g.source, j = g.join, share = j && j.mode === "share";
    const P = spec.points.filter(p => src.points.includes(p.id)), Lk = spec.links.filter(l => src.links.includes(l.id)), S = spec.shapes.filter(s => src.shapes.includes(s.id));
    let prev = Object.fromEntries(src.points.map(id => [id, id]));
    g.members = [];
    for (let k = 1; k < g.n; k++){
      const map = {}, lmap = {}, mem = { points: [], links: [], shapes: [] };
      if (share) map[j.to] = prev[j.from];
      for (const p of P){
        if (share && p.id === j.to) continue;
        const id = addPoint(spec, { type: "delta", from: prev[p.id], dx: withI(g.dx, k), dy: withI(g.dy, k) }, p.codes.slice(), isAux(p));
        if (p.branch) byId(spec.points, id).branch = p.branch;
        map[p.id] = id; mem.points.push(id);
      }
      const m = id => map[id] || id;
      for (const l of Lk){
        const c = JSON.parse(JSON.stringify(l));
        if (c.points) c.points = c.points.map(m);
        for (const key of ["from", "to", "via", "corner"]) if (c[key]) c[key] = m(c[key]);
        c.id = nextId(spec, "L");
        spec.links.push(c); lmap[l.id] = c.id; mem.links.push(c.id);
      }
      // เส้นอ้างอิงของ Clipped Surface Link ในชุด = ของชุดนั้น
      for (const id of mem.links){ const c = byId(spec.links, id); if (c.refLink && lmap[c.refLink]) c.refLink = lmap[c.refLink]; }
      for (const s of S){
        const id = addShape(spec, s.links.map(l => lmap[l] || l)), ns = byId(spec.shapes, id);
        ns.codes = s.codes.slice(); if (s.branch) ns.branch = s.branch;
        mem.shapes.push(id);
      }
      if (j && j.mode === "link"){
        const id = nextId(spec, "L");
        spec.links.push({ id, points: [prev[j.from], map[j.to]], codes: [] });
        mem.links.push(id);
      }
      g.members.push(mem);
      prev = { ...prev, ...map };
    }
    refreshLastOf(spec, g);
    return g;
  }
  // แก้ dx / dy: แก้นิยามจุดของสมาชิกทุกชุด (id เดิม — ของที่อ้างสมาชิกไม่หลุด)
  function updateArray(spec, g, o){
    if ("dx" in o) g.dx = String(o.dx).trim() || "0";
    if ("dy" in o) g.dy = String(o.dy).trim() || "0";
    g.members.forEach((mem, i) => { for (const id of mem.points){ const p = byId(spec.points, id); if (p && p.def.type === "delta"){ p.def.dx = withI(g.dx, i + 1); p.def.dy = withI(g.dy, i + 1); } } });
  }
  // เปลี่ยน N / วิธีต่อชุด: ลบสมาชิกแล้วสร้างใหม่ — มีของนอก array อ้างสมาชิกอยู่ = ไม่ทำ คืนรายการที่ขวาง
  function rebuildArray(spec, g, o){
    const P = new Set(g.members.flatMap(m => m.points)), L = new Set(g.members.flatMap(m => m.links)), S = new Set(g.members.flatMap(m => m.shapes));
    const block = spec.points.filter(p => !P.has(p.id) && !(p.def.type === "lastOf" && p.def.array === g.id) && refs(p.def).some(r => P.has(r))).map(p => p.id)
      .concat(spec.links.filter(l => !L.has(l.id) && (linkRefs(l).some(r => P.has(r)) || L.has(l.refLink))).map(l => l.id))
      .concat(spec.shapes.filter(s => !S.has(s.id) && s.links.some(l => L.has(l))).map(s => s.id));
    if (block.length) return { block };
    const next = { ...g, n: "n" in o ? Math.round(+o.n) : g.n, join: "join" in o ? o.join : g.join };
    // Loop: เปิด / ปิด / แก้ nMax (o.loop = { n, nMax, nRound } | null)
    if ("loop" in o){ if (o.loop) setLoop(next, o.loop); else { delete next.loop; } }
    const err = arrayIssue(spec, next);
    if (err) return { error: err };
    spec.points = spec.points.filter(p => !P.has(p.id));
    spec.links = spec.links.filter(l => !L.has(l.id));
    spec.shapes = spec.shapes.filter(s => !S.has(s.id));
    g.n = next.n; g.join = next.join;
    if (next.loop) g.loop = next.loop; else delete g.loop;
    buildArray(spec, g);
    return { block: [] };
  }
  // array ที่ object นี้เป็นส่วนหนึ่ง (ต้นฉบับหรือสมาชิก)
  function arrayOf(spec, type, id){
    const key = type === "point" ? "points" : type === "link" ? "links" : "shapes";
    return (spec.arrays || []).find(g => g.source[key].includes(id) || g.members.some(m => m[key].includes(id))) || null;
  }

  // ---------- Clipped Surface Link (รอบ 4c) ----------
  // link ตามผิวดินจาก from ถึง to ไม่เกินเส้นอ้างอิง — o = { refLink | refLevel, side: "below" | "above", codes, codesGround, codesLine, target, aux }
  //   คืน { link } หรือ { error }
  function addFollowClipped(spec, from, to, o){
    o = o || {};
    if (!byId(spec.points, from) || !byId(spec.points, to) || from === to) return { error: "เลือกจุดเริ่มกับจุดปลายที่ต่างกัน" };
    if (o.refLink){
      const rl = byId(spec.links, o.refLink);
      if (!rl || !rl.points || rl.type) return { error: "เส้นอ้างอิงต้องเป็น link เส้นตรง" };
    } else if (o.refLevel == null || String(o.refLevel).trim() === "") return { error: "เลือกเส้นอ้างอิง หรือใส่ระดับ" };
    const l = { id: nextId(spec, "L"), type: "followClipped", from, to, target: o.target || (spec.targets[0] || {}).name || "TargetSurface",
                ...(o.refLink ? { refLink: o.refLink } : { refLevel: String(o.refLevel).trim() }), side: o.side === "above" ? "above" : "below",
                codes: (o.codes || []).slice(), codesGround: (o.codesGround || []).slice(), codesLine: (o.codesLine || []).slice(), ...(o.aux ? { auxiliary: true } : {}) };
    spec.links.push(l);
    return { link: l.id };
  }

  // ---------- Extend to Surface (รอบ 4c) ----------
  // ต่อ link เส้นตรง id ที่ปลาย end ลงถึงดิน (เมื่อปลายลอย): จุด extendToGround + link ต่อ (optional ใน shape, code = code ของเส้นเดิม)
  //   + จุด "ปลายจริง" (firstOf [จุดต่อ, end] auxiliary) · opt.rewire (ปกติ true) = link อื่นที่ต่อที่ end ย้ายไปต่อที่ปลายจริง
  //   shape ที่ใช้เส้นเดิม = แทรก link ต่อถัดจากเส้นเดิม → shape เดียวปิดได้ทั้งตอนต่อ / ไม่ต่อ
  //   opt = { codes (ของ link ต่อ), pointCodes, target, maxDistance, rewire } · คืน { point, link, tip, rewired } หรือ { error }
  function addExtendToGround(spec, id, end, opt){
    opt = opt || {};
    const l = byId(spec.links, id), e = straightEnds(l);
    if (!e) return { error: "Extend to Surface ได้เฉพาะ link เส้นตรง" };
    if (!e.includes(end)) return { error: `${end} ไม่ใช่ปลายของ ${id}` };
    const along = e.find(p => p !== end);
    if (!along) return { error: "link ยาวเป็นศูนย์" };
    const target = opt.target || (spec.targets[0] || {}).name || "TargetSurface";
    const aux = isAux(l);
    const P = addPoint(spec, { type: "extendToGround", from: end, along, target, maxDistance: String(opt.maxDistance ?? "50") }, (opt.pointCodes || []).slice(), aux);
    const nl = { id: nextId(spec, "L"), points: [end, P], codes: (opt.codes || l.codes || []).slice(), optional: true, ...(aux ? { auxiliary: true } : {}) };
    spec.links.splice(spec.links.indexOf(l) + 1, 0, nl);
    const tip = addPoint(spec, { type: "firstOf", points: [P, end] }, [], true);
    if (l.branch) for (const o of [byId(spec.points, P), nl, byId(spec.points, tip)]) o.branch = l.branch;
    // link อื่นที่ต่อที่ end -> ต่อที่ปลายจริงแทน
    const rewired = [];
    if (opt.rewire !== false)
      for (const o of spec.links){
        if (o === l || o === nl || (aux && !isAux(o))) continue;     // เส้นเดิมเป็น aux: ไม่ย้าย link จริง (ปลายจริงมีจุด aux = ต่อไม่ได้)
        if (o.points && o.points.includes(end)){ o.points = o.points.map(p => p === end ? tip : p); rewired.push(o.id); }
        else if (!o.points && (o.from === end || o.to === end) && !isArc(o)){ if (o.from === end) o.from = tip; if (o.to === end) o.to = tip; rewired.push(o.id); }
      }
    // shape: แทรก link ต่อระหว่างเส้นเดิมกับขอบถัดไปที่ต่อที่ปลายนั้น
    for (const s of spec.shapes){
      const i = s.links.indexOf(id), n = s.links.length;
      if (i < 0) continue;
      const nb = k => byId(spec.links, s.links[(k + n) % n]);
      const atTip = o => !!o && linkEnds(o).includes(tip);
      if (atTip(nb(i - 1)) && !atTip(nb(i + 1))) s.links.splice(i, 0, nl.id);
      else s.links.splice(i + 1, 0, nl.id);
    }
    if (spec.polygons) spec.polygons = spec.polygons.filter(g => !g.links.includes(id) && !g.links.some(x => rewired.includes(x)));
    return { point: P, link: nl.id, tip, rewired };
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

  return { setParamBounds, paramBoundsIssue, exprOpts, caseMatch, branchLabel, offLabel, branchChain, branchRisks, freeName, addIf, addCutFill, branchObjects, condUses, renameCond, decisionTree, removeDecision, POINT_TYPES, MEASURES, EXPR_FIELDS, LINK_TYPES, LINK_EXPR_FIELDS, ARC_TYPES, SEG_DEFAULT, SEG_MIN, SEG_MAX, isArc,
           newSpec, specForImported, evaluate, makeGround, projectSeg, lineX, refs, linkEnds, linkRefs, byId,
           UNITS, unitOf, fmtUnit, fmtParam, parseUnitValue, setParamUnit, slopeRead, slopeWrite, slopeMagnitude, LOOP_MAX, LOOP_DEFAULT, LOOP_ROUND, addLastOf, arraySetPoint, withI, isAux, isAuxPoint, isAlias, auxEnd, GROUND_OFF, addExtendToGround, addFollowClipped, clipPath, addArray, updateArray, rebuildArray, arrayOf, normalize, auxPlan, applyAux, nextId, names, addPoint, addLink, findLink, addShape, removeCascade, cascadePreview, dependsOn,
           chainOrder, walkShape, polygonVertexDefs, addPolygon, updatePolygon, rebuildPolygon, polygonOf,
           tangentPoint, arcGeom, segCount, arcPoints, addFillet, addIntersect, addOffset, exprSlots, rotatePt, rotationOf, addRotation };
})();
if (typeof module !== "undefined") module.exports = Spec;
