// ทดสอบ Auxiliary (ช่วยสร้าง) point / link — spec.js (evaluate, normalize, auxPlan / applyAux, Fillet) + Move / Copy / Rotate (ops.js) + history.js
// รัน: node SA.Tests/js/auxiliary.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
// history.js: ใช้เฉพาะ makeHistory (ตัดก่อนส่วนที่ผูกกับหน้าเว็บ)
const hist = js("history.js").split("// ---------------- เอกสารของหน้าเว็บ")[0];
vm.runInContext(["expr.js", "spec.js", "ops.js"].map(js).join("\n") + "\n" + hist + "\nthis.Spec = Spec; this.Ops = Ops; this.makeHistory = makeHistory;", ctx);
const { Spec, Ops, makeHistory } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const near = (exp, act, what, tol = 1e-9) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };

// สี่เหลี่ยม P1-P2-P3-P4 (shape S1) + เส้น aux ทแยง 2 เส้น L5 (P1-P3) / L6 (P2-P4) + จุดจริง P5 = จุดตัดของเส้น aux
function base(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "W", kind: "double", default: 4 });
  s.points.push({ id: "P2", codes: ["A"], def: { type: "delta", from: "P1", dx: "W", dy: "0" } },
                { id: "P3", codes: [], def: { type: "delta", from: "P2", dx: "0", dy: "-2" } },
                { id: "P4", codes: [], def: { type: "delta", from: "P1", dx: "0", dy: "-2" } },
                { id: "P5", codes: ["Mid"], def: { type: "intersect", a1: "P1", a2: "P3", b1: "P2", b2: "P4" } });
  s.links.push({ id: "L1", points: ["P1", "P2"], codes: ["Top"] }, { id: "L2", points: ["P2", "P3"], codes: [] },
               { id: "L3", points: ["P3", "P4"], codes: [] }, { id: "L4", points: ["P4", "P1"], codes: [] },
               { id: "L5", points: ["P1", "P3"], codes: ["Diag"], auxiliary: true }, { id: "L6", points: ["P2", "P4"], codes: [], auxiliary: true });
  s.shapes.push({ id: "S1", links: ["L1", "L2", "L3", "L4"], codes: [] });
  return s;
}
const ev = (s, values) => Spec.evaluate(s, { values: values || {} });

console.log("evaluate");
test("link auxiliary มี geometry (ตรง / โค้ง) + ธง aux · จุดจริงที่เป็นจุดตัดของเส้น aux ตาม W", () => {
  const s = base();
  s.links.push({ id: "L7", type: "arc3", from: "P1", via: "P5", to: "P2", codes: [], auxiliary: true });
  const r = ev(s);
  ok(r.links.L5.aux && r.links.L5.path.length === 2, "L5"); ok(r.links.L7.aux && r.links.L7.path.length > 3, "โค้ง aux แบ่งท่อน");
  near(2, r.pts.P5.x, "P5 x"); near(-1, r.pts.P5.y, "P5 y"); near(3, ev(s, { W: 6 }).pts.P5.x, "W = 6");
  eq(0, r.issues.length, JSON.stringify(r.issues));
});
test("link auxiliary ต่อจุด auxiliary ได้ · link จริงที่ปลายเป็นจุด aux = error + บอกจุด (quick fix)", () => {
  const s = base();
  s.points.push({ id: "P6", codes: [], auxiliary: true, def: { type: "delta", from: "P5", dx: "0", dy: "1" } });
  s.links.push({ id: "L8", points: ["P5", "P6"], codes: [], auxiliary: true }, { id: "L9", points: ["P6", "P2"], codes: [] });
  const r = ev(s);
  ok(!r.links.L8.err, "aux ต่อ aux ได้"); eq("P6", r.links.L9.auxEnd, "L9 ปลาย aux"); ok(r.issues.some(i => i.obj === "L9"), "เตือน");
});
test("shape ที่มี link auxiliary = ข้าม + เตือน + บอก link", () => {
  const s = base(); s.shapes[0].links[1] = "L5";
  const r = ev(s); eq("L5", r.shapes.S1.auxLink, "auxLink"); ok(r.issues.some(i => i.obj === "S1"), "เตือน");
});
test("spec รุ่นก่อน (construction) = auxiliary: ผลเหมือนกัน · normalize เขียนเป็น auxiliary", () => {
  const a = base(), b = base();
  a.points.push({ id: "P6", codes: [], def: { type: "delta", dx: "1", dy: "1" }, auxiliary: true });
  b.points.push({ id: "P6", codes: [], construction: true, def: { type: "delta", dx: "1", dy: "1" } });
  b.links.forEach(l => { if (l.auxiliary){ delete l.auxiliary; l.construction = true; } });
  b.links.push({ id: "L9", points: ["P6", "P2"], codes: [] }); a.links.push({ id: "L9", points: ["P6", "P2"], codes: [] });
  eq(JSON.stringify(ev(a)), JSON.stringify(ev(b)), "evaluate");
  Spec.normalize(b);
  ok(!JSON.stringify(b).includes("construction"), "ไม่เหลือ construction"); eq(JSON.stringify(a), JSON.stringify(b), "spec เท่ากัน");
});

console.log("สลับ Auxiliary (auxPlan / applyAux)");
test("จุดจริงที่ link จริงใช้อยู่ -> แผนบอก link ที่กระทบ + shape ที่ต้องเอา link ออก", () => {
  const s = base(), pl = Spec.auxPlan(s, [{ type: "dpt", id: "P3" }], true);
  eq("L2,L3", pl.hitLinks.join(), "link ที่กระทบ"); eq("S1", pl.shapes.join(), "shape");
  Spec.applyAux(s, pl, true);
  ok(Spec.isAux(Spec.byId(s.points, "P3")) && Spec.isAux(Spec.byId(s.links, "L2")), "เป็น aux"); eq("L1,L4", s.shapes[0].links.join(), "เอาออกจาก shape");
});
test("สลับไปแล้วกลับ code ไม่หาย · ทำเป็นของจริงไม่แตะ shape", () => {
  const s = base(), pl = Spec.auxPlan(s, [{ type: "dlink", id: "L5" }], false);
  Spec.applyAux(s, pl, false); eq("Diag", Spec.byId(s.links, "L5").codes.join(), "code"); ok(!Spec.isAux(Spec.byId(s.links, "L5")), "จริง");
  Spec.applyAux(s, Spec.auxPlan(s, [{ type: "dpt", id: "P2" }], true), true);
  Spec.applyAux(s, Spec.auxPlan(s, [{ type: "dpt", id: "P2" }], false), false);
  eq("A", Spec.byId(s.points, "P2").codes.join(), "code ของจุด");
});

console.log("Fillet / Move / Copy / Rotate");
test("Fillet ระหว่าง link aux 2 เส้น = โค้ง + จุดสัมผัส aux · ผสม aux / จริง = ของจริง", () => {
  const s = base();
  s.points.push({ id: "P6", codes: [], def: { type: "delta", from: "P1", dx: "-3", dy: "2" } });
  s.links.push({ id: "L7", points: ["P1", "P6"], codes: [], auxiliary: true });
  const f = Spec.addFillet(s, "L5", "L7", "0.5");
  ok(Spec.isAux(Spec.byId(s.links, f.link)) && Spec.isAux(Spec.byId(s.points, f.t1)) && Spec.isAux(Spec.byId(s.points, f.t2)), "aux ทั้งหมด");
  const t = base(), g = Spec.addFillet(t, "L1", "L6", "0.5");
  ok(!Spec.isAux(Spec.byId(t.links, g.link)) && !Spec.isAux(Spec.byId(t.points, g.t1)), "ผสม = จริง"); ok(Spec.isAux(Spec.byId(t.links, "L6")), "L6 ยัง aux");
});
test("Copy / Rotate คงสถานะ auxiliary", () => {
  const s = base(); s.points[0].def = { type: "delta", dx: "0", dy: "0" };
  const c = Ops.clone(s, Ops.expand(s, { links: ["L5", "L1"] }), s);
  ok(Spec.isAux(Spec.byId(s.links, c.links[c.links.length - 1])) || c.links.some(id => Spec.isAux(Spec.byId(s.links, id))), "link aux ที่สำเนา");
  ok(!Spec.isAux(Spec.byId(s.links, c.links.find(id => Spec.byId(s.links, id).codes.includes("Top")))), "link จริงที่สำเนา");
  Ops.rotate(s, ["P2", "P3"], "P1", "30");
  ok(Spec.isAux(Spec.byId(s.links, "L5")), "หมุนแล้วยัง aux"); ok(!ev(s).links.L5.err, "L5 คำนวณได้");
});

console.log("วาดแบบ Auxiliary / Undo");
test("Polygon ด้านเท่าแบบ aux = จุดยอด + link เป็น aux ไม่มี shape · เปลี่ยน N แล้วยัง aux", () => {
  const s = base(); s.points.push({ id: "P9", codes: [], auxiliary: true, def: { type: "delta", dx: "8", dy: "0" } });
  const g = Spec.addPolygon(s, { center: "P9", n: 5, radius: "1", angle: "0", aux: true });
  eq(null, g.shape, "ไม่มี shape"); ok(g.points.every(id => Spec.isAuxPoint(s, id)) && g.links.every(id => Spec.isAux(Spec.byId(s.links, id))), "aux ทั้งหมด");
  eq(0, ev(s).issues.length, "ไม่เตือน");
  eq(0, Spec.rebuildPolygon(s, g, 7).length, "เปลี่ยน N");
  eq(null, g.shape, "ยังไม่มี shape"); ok(g.links.every(id => Spec.isAux(Spec.byId(s.links, id))), "link ใหม่ aux");
});
test("Fillet แบบ aux (overlay) = โค้ง + จุดสัมผัส aux ทับมุม · link เดิม / shape / มุมไม่เปลี่ยน", () => {
  const s = base();
  const f = Spec.addFillet(s, "L1", "L2", "0.5", { overlay: true });
  ok(Spec.isAux(Spec.byId(s.links, f.link)) && Spec.isAuxPoint(s, f.t1) && Spec.isAuxPoint(s, f.t2), "aux");
  eq("P1,P2", Spec.byId(s.links, "L1").points.join(), "L1 เดิม"); eq("L1,L2,L3,L4", s.shapes[0].links.join(), "shape เดิม");
  ok(!Spec.isAuxPoint(s, "P2"), "มุมยังเป็นจุดจริง");
  const r = ev(s); ok(r.shapes.S1.poly && r.links[f.link].arc, "shape ปิด + โค้ง aux มี geometry"); eq(0, r.issues.length, "ไม่เตือน");
});
test("Undo / Redo การสลับ Auxiliary (ก้อนเดียว รวม link ที่กระทบ + shape)", () => {
  const s = base();
  const h = makeHistory(() => { const j = JSON.stringify(s); return { full: j, key: j }; },
                        full => { const d = JSON.parse(full); for (const k of Object.keys(s)) delete s[k]; Object.assign(s, d); }, 50);
  h.reset();
  h.act("ทำ P3 เป็น Auxiliary"); Spec.applyAux(s, Spec.auxPlan(s, [{ type: "dpt", id: "P3" }], true), true); h.track();
  ok(Spec.isAuxPoint(s, "P3") && Spec.isAux(Spec.byId(s.links, "L2")), "หลังสลับ");
  eq("ทำ P3 เป็น Auxiliary", h.step(false), "undo");
  ok(!Spec.isAuxPoint(s, "P3") && !Spec.isAux(Spec.byId(s.links, "L2")) && s.shapes[0].links.length === 4, "กลับครบ");
  h.step(true); ok(Spec.isAuxPoint(s, "P3") && s.shapes[0].links.length === 2, "redo");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
