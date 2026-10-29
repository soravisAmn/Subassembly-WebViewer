// ทดสอบกลุ่มหมุน (Rotate) — evaluate ใน spec.js + Ops.rotatePlan / rotate / Move / Copy ใน ops.js
// รัน: node SA.Tests/js/rot.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(["expr.js", "spec.js", "ops.js"].map(js).join("\n") + "\nthis.Spec = Spec; this.Ops = Ops;", ctx);
const { Spec, Ops } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const near = (exp, act, what, tol = 1e-9) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };

// P1 origin · P2 = P1 + (W, 0) · P3 = P2 + (0, -1) · link P1-P2-P3
function base(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "W", kind: "double", default: 2 }, { name: "Ang", kind: "double", default: 90 });
  s.points.push({ id: "P2", codes: [], def: { type: "delta", from: "P1", dx: "W", dy: "0" } },
                { id: "P3", codes: [], def: { type: "delta", from: "P2", dx: "0", dy: "-1" } });
  s.links.push({ id: "L1", points: ["P1", "P2"], codes: [] }, { id: "L2", points: ["P2", "P3"], codes: [] });
  return s;
}
const ev = (s, values) => Spec.evaluate(s, { values: values || {} });

console.log("evaluate");
test("หมุน P2, P3 รอบ P1 90° = (0, 2), (1, 2) · สมาชิกอ้างกันเองใช้ค่าก่อนหมุน (รูปไม่บิด)", () => {
  const s = base(); Spec.addRotation(s, { pivot: "P1", angle: "Ang", points: ["P2", "P3"] });
  const r = ev(s);
  near(0, r.pts.P2.x, "P2 x"); near(2, r.pts.P2.y, "P2 y"); near(1, r.pts.P3.x, "P3 x"); near(2, r.pts.P3.y, "P3 y");
  near(2, r.raw.P2.x, "raw P2 x");
});
test("จุดนอกกลุ่มที่อ้างสมาชิกเห็นค่าที่หมุนแล้ว (ไม่หมุนตาม แค่เลื่อนตาม)", () => {
  const s = base(); Spec.addRotation(s, { pivot: "P1", angle: "90", points: ["P2", "P3"] });
  s.points.push({ id: "P4", codes: [], def: { type: "delta", from: "P3", dx: "1", dy: "0" } });
  const r = ev(s); near(2, r.pts.P4.x, "x"); near(2, r.pts.P4.y, "y");
});
test("Side = Left: มุมกลับเครื่องหมาย = ภาพกระจกของ Right", () => {
  const s = base(); Spec.addRotation(s, { pivot: "P1", angle: "30", points: ["P2", "P3"] });
  const R = ev(s), L = ev(s, { Side: 1 });
  for (const id of ["P2", "P3"]){ near(-R.pts[id].x, L.pts[id].x, id + " x"); near(R.pts[id].y, L.pts[id].y, id + " y"); }
});
test("จุดหมุนที่อ้างสมาชิก (กึ่งกลางของสมาชิก) เห็นค่าก่อนหมุน = หมุนรอบกึ่งกลางจริง", () => {
  const s = base();
  s.points.push({ id: "P4", codes: [], construction: true, def: { type: "between", a: "P2", b: "P3", t: "0.5" } });
  Spec.addRotation(s, { pivot: "P4", angle: "90", points: ["P2", "P3"] });
  const r = ev(s);
  near(2, r.pts.P4.x, "pivot x"); near(-0.5, r.pts.P4.y, "pivot y");
  near(1.5, r.pts.P2.x, "P2 x"); near(-0.5, r.pts.P2.y, "P2 y"); near(2.5, r.pts.P3.x, "P3 x");
});
test("มุมเป็นนิพจน์ผิด / จุดหมุนหาไม่ได้ = สมาชิก error (ข้ามแบบเดียวกับ C#)", () => {
  const s = base(); Spec.addRotation(s, { pivot: "P9", angle: "90", points: ["P2"] });
  ok(ev(s).pts.P2.err, "จุดหมุนไม่มี");
  const t = base(); Spec.addRotation(t, { pivot: "P1", angle: "Nope", points: ["P2"] });
  ok(ev(t).pts.P2.err, "มุมผิด");
});

console.log("แผนการหมุน (Ops.rotatePlan / rotate)");
test("จุดหมุนไม่อยู่ในกลุ่ม · origin / ลาดชนดินหมุนไม่ได้ + เหตุผล", () => {
  const s = base();
  s.points.push({ id: "P4", codes: [], def: { type: "slopeToSurface", from: "P3", slope: "-0.5", dir: 1, target: "TargetSurface", maxDistance: "50", layoutLength: "3" } });
  const pl = Ops.rotatePlan(s, ["P1", "P2", "P3", "P4"], "P2");
  eq("P3", pl.members.join(), "สมาชิก (P2 = จุดหมุน)");
  ok(pl.blocked.some(b => b.id === "P1") && pl.blocked.some(b => b.id === "P4" && /ดิน/.test(b.why)), JSON.stringify(pl.blocked));
});
test("จุดที่อ้างจุดหมุน (เช่น between จุดหมุนกับสมาชิก) หมุนได้ — จุดหมุนอยู่กับที่", () => {
  const s = base();
  s.points.push({ id: "P4", codes: [], def: { type: "between", a: "P1", b: "P3", t: "0.5" } });
  const pl = Ops.rotatePlan(s, ["P1", "P2", "P3", "P4"], "P1");
  eq("P2,P3,P4", pl.members.slice().sort().join(), "สมาชิก"); eq(0, pl.blocked.length, "ไม่มีจุดติด");
});
test("จุดนอกชุดที่อยู่ระหว่างสมาชิก ถูกดึงเข้ากลุ่ม (กันวง)", () => {
  const s = base();
  s.points.push({ id: "P4", codes: [], def: { type: "delta", from: "P3", dx: "1", dy: "0" } });   // P4 อ้าง P3 (นอกชุด)
  Spec.byId(s.points, "P3").def.from = "P2";
  s.points.push({ id: "P5", codes: [], def: { type: "delta", from: "P4", dx: "0", dy: "1" } });   // P5 (ในชุด) อ้าง P4
  const pl = Ops.rotatePlan(s, ["P2", "P3", "P5"], "P1");
  ok(pl.members.includes("P4"), "P4 ต้องเข้ากลุ่ม: " + pl.members.join());
  Ops.rotate(s, ["P2", "P3", "P5"], "P1", "90");
  const r = ev(s); ok(!r.pts.P5.err, r.pts.P5.err); near(3, r.pts.P5.y, "P5 y (หมุนทั้งชุดแบบแข็ง)");
});
test("หมุนซ้ำทั้งกลุ่มด้วยจุดหมุนเดิม = บวกมุม · บางจุดของกลุ่ม / จุดหมุนอื่น = ไม่ได้ + เหตุผล", () => {
  const s = base();
  Ops.rotate(s, ["P2", "P3"], "P1", "Ang");
  const m = Ops.rotate(s, ["P2", "P3"], "P1", "15");
  eq(1, s.rotations.length, "ยังกลุ่มเดียว"); eq("Ang + 15", s.rotations[0].angle, "มุม"); eq("R1", m.merge.join(), "merge");
  const b = Ops.rotatePlan(s, ["P3"], "P2");
  ok(!b.members.length && /กลุ่มหมุน R1/.test(b.blocked[0].why), JSON.stringify(b));
  eq("Ang + (W * 2)", Ops.addAngle("Ang", "W * 2"), "นิพจน์");
});

test("หมุนซ้ำทั้งกลุ่มด้วยจุดหมุนอื่น (กลุ่มปิด) = เหมือนหมุนรูปที่หมุนแล้วต่อรอบจุดใหม่ (Right / Left)", () => {
  const s = base();
  s.points.push({ id: "P9", codes: [], construction: true, def: { type: "delta", dx: "5", dy: "1" } });
  Ops.rotate(s, ["P1", "P2", "P3"], "P1", "Ang");                     // หมุนรอบมุมตัวเอง (P1 = จุดหมุน)
  for (const Side of [0, 1]){
    const F = Side ? -1 : 1, t = JSON.parse(JSON.stringify(s)), before = ev(t, { Side });
    const res = Ops.rotate(t, ["P2", "P3"], "P9", "40");
    eq("R1", res.compose.join(), "compose"); eq(0, res.blocked.length, JSON.stringify(res.blocked));
    const after = ev(t, { Side }), c = before.pts.P9;
    for (const id of ["P2", "P3"]){
      const e = Spec.rotatePt(before.pts[id], c, F * 40);
      near(e.x, after.pts[id].x, `Side ${Side} ${id} x`); near(e.y, after.pts[id].y, `Side ${Side} ${id} y`);
    }
    near(before.pts.P1.x, after.pts.P1.x, "P1 (ไม่ได้เลือก) อยู่ที่เดิม");
  }
});
test("Copy + Rotate: สำเนาของกลุ่มหมุนรอบจุดเดิมได้ (ต้นฉบับอยู่ที่เดิม)", () => {
  const s = base();
  s.points[0].def = { type: "delta", dx: "0", dy: "0" };
  Ops.rotate(s, ["P2", "P3"], "P1", "30");
  const before = ev(s), c = Ops.clone(s, Ops.expand(s, { points: ["P1", "P2", "P3"] }), s);
  const res = Ops.rotate(s, c.points, "P1", "60");
  eq(0, res.blocked.length, JSON.stringify(res.blocked));
  const after = ev(s);
  near(before.pts.P3.x, after.pts.P3.x, "ต้นฉบับไม่ขยับ");
  const e = Spec.rotatePt(before.pts.P3, before.pts.P1, 60);
  near(e.x, after.pts[c.map.P3].x, "สำเนา x"); near(e.y, after.pts[c.map.P3].y, "สำเนา y");
});
console.log("Move / Copy / ลบ");
test("Move ทั้งกลุ่ม (จุดหมุนไม่ได้ย้าย) = ทุกจุดเลื่อนไป v เท่ากัน มุมเท่าเดิม (ใช้จุดหมุนใหม่)", () => {
  const s = base();
  Spec.byId(s.points, "P2").def = { type: "delta", dx: "2", dy: "0" };          // ไม่อ้าง P1 (P1 ไม่ย้าย)
  s.points.push({ id: "P4", codes: [], def: { type: "slopeLength", from: "P3", slope: "1", length: "1", dir: 1, measure: "dx" } });
  Ops.rotate(s, ["P2", "P3", "P4"], "P1", "30");
  const before = ev(s), f = Ops.expand(s, { points: ["P3"] });
  eq("P2,P3,P4", f.points.join(), "เลือกจุดเดียว = ทั้งกลุ่ม");
  const pl = Ops.plan(s, f.points);
  Ops.apply(s, pl, { x: 1, y: 0.5 }, 1, Object.fromEntries(Object.entries(before.pts)), before.raw);
  const after = ev(s);
  for (const id of ["P2", "P3", "P4"]){ near(before.pts[id].x + 1, after.pts[id].x, id + " x"); near(before.pts[id].y + 0.5, after.pts[id].y, id + " y"); }
  near(0, after.pts.P1.x, "P1 ไม่ย้าย"); ok(Spec.isAux(Spec.byId(s.points, s.rotations[0].pivot)), "จุดหมุนใหม่ = ช่วยสร้าง");
});
test("Copy ทั้งกลุ่ม = กลุ่มใหม่ มุมเดียวกัน", () => {
  const s = base(); Ops.rotate(s, ["P2", "P3"], "P1", "Ang");
  const c = Ops.clone(s, Ops.expand(s, { points: ["P2"] }), s);
  eq(2, s.rotations.length, "2 กลุ่ม"); eq("Ang", s.rotations[1].angle, "มุม");
  eq([c.map.P2, c.map.P3].join(), s.rotations[1].points.join(), "สมาชิกใหม่");
  const r = ev(s); near(r.pts.P2.x, r.pts[c.map.P2].x, "ตำแหน่งเดียวกับต้นฉบับ"); near(r.pts.P3.y, r.pts[c.map.P3].y, "y");
});
test("Paste ข้าม subassembly: กลุ่มหมุนมาด้วย (จุดหมุนนอกชุด = จุด aux ค่าคงที่) ตำแหน่งตรงกับต้นฉบับ ไม่หมุนซ้ำ", () => {
  const s = base(); Ops.rotate(s, ["P2", "P3"], "P1", "Ang");
  const r = ev(s), dst = Spec.newSpec("D");
  dst.params.push({ name: "Ang", kind: "double", default: 90 });
  const c = Ops.clone(s, Ops.expand(s, { points: ["P3"] }), dst, { detach: true, pos: r.pts, raw: r.raw, F: 1, names: Spec.names(dst) });
  eq(1, (dst.rotations || []).length, "กลุ่มมาด้วย"); ok(Spec.isAuxPoint(dst, dst.rotations[0].pivot), "จุดหมุนใหม่ = aux");
  const d = ev(dst);
  for (const id of ["P2", "P3"]){ near(r.pts[id].x, d.pts[c.map[id]].x, id + " x"); near(r.pts[id].y, d.pts[c.map[id]].y, id + " y"); }
  const dst2 = Spec.newSpec("D2");                                    // ตัวใหม่ไม่มี parameter Ang = ไม่เอากลุ่ม ใช้ตำแหน่งที่หมุนแล้ว
  const c2 = Ops.clone(s, Ops.expand(s, { points: ["P3"] }), dst2, { detach: true, pos: r.pts, raw: r.raw, F: 1, names: Spec.names(dst2) });
  eq(0, (dst2.rotations || []).length, "ไม่มีกลุ่ม"); near(r.pts.P3.y, ev(dst2).pts[c2.map.P3].y, "P3 y");
});
test("ลบสมาชิก = ออกจากกลุ่ม · ลบจุดหมุน = เลิกหมุน · ชื่อ parameter ในมุมเปลี่ยนตามได้", () => {
  const s = base(); Ops.rotate(s, ["P2", "P3"], "P1", "Ang");
  s.points.push({ id: "P9", codes: [], def: { type: "delta", dx: "5", dy: "5" } });
  s.links.push({ id: "L9", points: ["P3", "P9"], codes: [] });
  Spec.removeCascade(s, "link", "L9");
  eq("P2,P3", s.rotations[0].points.join(), "link ไม่เกี่ยว");
  ok(Spec.exprSlots(s).some(x => x.id === "R1" && x.obj[x.key] === "Ang"), "exprSlots มีมุม");
  const t = base(); Ops.rotate(t, ["P3"], "P2", "45");
  Spec.removeCascade(t, "point", "P3"); eq(0, t.rotations.length, "ไม่เหลือสมาชิก");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
