// ทดสอบ Max / Min ของจุด (รอบ 4b — prompt-4b-design.md): spec.js limitPt / setLimit / limitOptions, limited() ใน expr.js, clone ใน ops.js
// รัน: node SA.Tests/js/limit.test.js
// (ไม่มี node: รันใน console ของหน้าเว็บได้ด้วย globalThis.SA_LIB = { Expr, Spec, Ops } แล้ว eval ไฟล์นี้ในฟังก์ชัน)
"use strict";
const { Expr, Spec, Ops } = typeof require === "function" ? (() => {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
  const ctx = vm.createContext({ console });
  vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("ops.js") + "\nthis.Expr = Expr; this.Spec = Spec; this.Ops = Ops;", ctx);
  return ctx;
})() : globalThis.SA_LIB;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const near = (exp, act, what, tol = 1e-6) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const throws = (f, part, what) => { try{ f(); }catch(e){ ok(e.message.includes(part), `${what}: ข้อความ "${e.message}" ต้องมี "${part}"`); return; } throw new Error(what + ": ต้อง error"); };

const flat = y => [{ x: -30, y }, { x: 30, y }];
const run = (s, o = {}) => Spec.evaluate(s, { values: o.values || {}, codeParams: [], codePoints: [], surface: o.surface === undefined ? flat(0) : o.surface,
                                             extendEnds: true, layout: !!o.layout, originElevation: 100 });
const P = (r, id) => { const p = r.pts[id]; if (!p || p.err) throw new Error(`จุด ${id}: ${p ? p.err : "ไม่มี"}`); return p; };
const pt = (id, def, extra) => ({ id, codes: [], def, ...extra });
// ฐานรากลาดลง: P3 ลาด 2:1 (slope -2) ลึก Depth (วัดดิ่ง) จากไหล่ P2 · P4 ต่อจาก P3
function base(limit){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Depth", kind: "double", default: 1, min: null, max: null }, { name: "MinDepth", kind: "double", default: 2, min: null, max: null });
  s.points.push(pt("P2", { type: "delta", from: "P1", dx: "3", dy: "0" }),
                pt("P3", { type: "slopeLength", from: "P2", slope: "-2", length: "Depth", dir: 1, measure: "dy" }),
                pt("P4", { type: "delta", from: "P3", dx: "1", dy: "0" }));
  if (limit) Spec.setLimit(s, "P3", limit);
  return s;
}
const deep = { measure: "depth", side: "below", ref: { type: "ground" }, min: "MinDepth", action: "clampWarn", along: "slope" };

console.log("ระยะดิ่งจากผิวดิน (ฐานราก)");
test("ไม่ถึง: ขยับตามแนวลาดเดิมจนลึก 2.00 + เตือนแบบ rock-pitching · จุดที่ต่อจาก P3 ขยับตาม", () => {
  const r = run(base(deep));
  near(4, P(r, "P3").x, "P3.x"); near(-2, P(r, "P3").y, "P3.y"); near(5, P(r, "P4").x, "P4 ตาม");
  eq("P3 ต่ำกว่าผิวดิน 1.00 m < 2.00 m ใช้ 2.00 m แทน", r.issues.map(i => i.msg).join(" | "), "เตือน");
  ok(r.limits.P3.hit && r.limits.P3.v0 === 1, "limits.P3");
});
test("ผ่าน (Depth = 3): ไม่ขยับ ไม่เตือน", () => {
  const r = run(base(deep), { values: { Depth: 3 } });
  near(4.5, P(r, "P3").x, "P3.x"); near(-3, P(r, "P3").y, "P3.y"); eq(0, r.issues.length, "ไม่เตือน"); eq(false, r.limits.P3.hit, "hit");
});
test("แนวดิ่ง: x เดิม", () => {
  const r = run(base({ ...deep, along: "vertical" }));
  near(3.5, P(r, "P3").x, "P3.x"); near(-2, P(r, "P3").y, "P3.y");
});
test("ฝั่ง Left: แนวลาดที่ mirror แล้ว · ระยะดิ่งไม่กลับ", () => {
  const r = run(base(deep), { values: { Side: 1 } });
  near(-4, P(r, "P3").x, "P3.x"); near(-2, P(r, "P3").y, "P3.y");
});
test("ผิวดินลาด: ระยะดิ่งวัดจากดินที่ตำแหน่งใหม่ (แก้สมการบนแนวลาด)", () => {
  const r = run(base(deep), { surface: [{ x: -30, y: 15 }, { x: 30, y: -15 }] });   // ดิน y = -0.5x
  near(3.5 + 11 / 6, P(r, "P3").x, "P3.x"); near(-1 - 11 / 3, P(r, "P3").y, "P3.y");
  near(2, -0.5 * P(r, "P3").x - P(r, "P3").y, "ลึกจากดิน ณ ตำแหน่งใหม่ = 2");
});
test("อย่างมาก: ลึกเกิน 1.5 = ขยับขึ้น · min > max ตอนรัน = ใช้อย่างน้อย + เตือน", () => {
  const a = run(base({ ...deep, min: null, max: "1.5" }), { values: { Depth: 3 } });
  near(3.75, P(a, "P3").x, "P3.x"); near(-1.5, P(a, "P3").y, "P3.y");
  ok(a.issues[0].msg.includes("3.00 m > 1.50 m"), a.issues[0].msg);
  const b = run(base({ ...deep, min: "MinDepth", max: "MinDepth - 1" }));
  near(-2, P(b, "P3").y, "ใช้อย่างน้อย"); ok(b.issues.some(i => i.msg.includes("อย่างน้อย 2.00 > อย่างมาก 1.00")), "เตือน min > max");
});
test("ถ้าไม่ผ่าน: เตือนอย่างเดียว (ไม่ขยับ) / ขยับเงียบๆ (ไม่เตือน)", () => {
  const w = run(base({ ...deep, action: "warn" }));
  near(-1, P(w, "P3").y, "ไม่ขยับ"); ok(w.issues[0].msg.endsWith("(ไม่ขยับ)"), w.issues[0].msg); ok(w.limits.P3.hit, "ยังนับว่าไม่ผ่าน");
  const c = run(base({ ...deep, action: "clamp" }));
  near(-2, P(c, "P3").y, "ขยับ"); eq(0, c.issues.length, "ไม่เตือน");
});
test("ไม่มีผิวดิน: ไม่ขยับ + เตือน · Layout mode: ไม่ขยับ ไม่เตือน (จุดไม่หาย)", () => {
  const a = run(base(deep), { surface: null });
  near(-1, P(a, "P3").y, "ไม่ขยับ"); ok(a.issues.some(i => i.msg.includes("ไม่ได้กำหนด Target Surface")), "เตือน");
  const b = run(base(deep), { layout: true });
  near(-1, P(b, "P3").y, "ไม่ขยับ"); eq(0, b.issues.length, "Layout ไม่เตือน");
});

console.log("อ้างอิงจุด / ระดับจริง / ตั้งฉาก / ความยาว / ระยะราบ");
test("สูงกว่าจุด P2 อย่างน้อย 0.5 (แนวดิ่ง) · ต่ำกว่าจุด ระหว่าง 0.5–1.5", () => {
  const s = base();
  s.points.push(pt("P5", { type: "delta", from: "P1", dx: "1", dy: "0.2" }), pt("P6", { type: "delta", from: "P2", dx: "2", dy: "-2" }));
  Spec.setLimit(s, "P5", { measure: "depth", side: "above", ref: { type: "point", id: "P2" }, min: "0.5" });
  Spec.setLimit(s, "P6", { measure: "depth", side: "below", ref: { type: "point", id: "P2" }, min: "0.5", max: "1.5" });
  const r = run(s);
  near(1, P(r, "P5").x, "P5.x"); near(0.5, P(r, "P5").y, "P5.y"); near(-1.5, P(r, "P6").y, "P6 ไม่เกิน 1.5");
  ok(r.issues.some(i => i.msg.startsWith("P5 สูงกว่า P2 0.20 m < 0.50 m")), r.issues.map(i => i.msg).join(" | "));
});
test("ระดับจริง: สันต้องสูงกว่า WL (ระดับจริง 100.8) อย่างน้อย FB — แปลงด้วยระดับ origin 100", () => {
  const s = base();
  s.params.push({ name: "WL", kind: "double", default: 100.8, min: null, max: null }, { name: "FB", kind: "double", default: 0.5, min: null, max: null });
  s.points.push(pt("P5", { type: "delta", from: "P1", dx: "2", dy: "0.3" }));
  Spec.setLimit(s, "P5", { measure: "depth", side: "above", ref: { type: "elev", expr: "WL" }, min: "FB" });
  const r = run(s);
  near(1.3, P(r, "P5").y, "P5.y = 0.8 + 0.5"); ok(r.issues[0].msg.startsWith("P5 สูงกว่า ระดับ WL -0.50 m < 0.50 m"), r.issues[0].msg);
  near(1.8, P(run(s, { values: { WL: 101.3 } }), "P5").y, "WL ใหม่");
});
test("ตั้งฉากกับผิวดิน: ดินลาด 45° · ห่างตั้งฉากอย่างน้อย 1 (ขยับแนวดิ่ง)", () => {
  const s = base();
  s.points.push(pt("P5", { type: "delta", from: "P1", dx: "2", dy: "-2.5" }));
  Spec.setLimit(s, "P5", { measure: "normal", side: "below", min: "1", along: "vertical" });
  const r = run(s, { surface: [{ x: -30, y: 30 }, { x: 30, y: -30 }] });
  near(2, P(r, "P5").x, "x เดิม"); near(-2 - Math.SQRT2, P(r, "P5").y, "y");
});
test("ความยาวจากจุดต้น: polar ยาว 2 → อย่างน้อย 3 (ตามแนวมุมเดิม) · Left", () => {
  const s = base();
  s.points.push(pt("P5", { type: "polar", from: "P1", length: "2", angle: "-30" }));
  Spec.setLimit(s, "P5", { measure: "length", min: "3" });
  const r = run(s);
  near(3 * Math.cos(Math.PI / 6), P(r, "P5").x, "x"); near(-1.5, P(r, "P5").y, "y");
  ok(r.issues[0].msg.startsWith("P5 ยาวจาก P1 2.00 m < 3.00 m"), r.issues[0].msg);
  near(-3 * Math.cos(Math.PI / 6), P(run(s, { values: { Side: 1 } }), "P5").x, "Left");
});
test("ระยะราบจากแกน: อย่างน้อย 1 (แนวราบ) · Left วัดออกด้านนอกเหมือนกัน", () => {
  const s = base();
  s.points.push(pt("P5", { type: "delta", from: "P1", dx: "0.5", dy: "-1" }));
  Spec.setLimit(s, "P5", { measure: "offset", min: "1" });
  eq("horizontal", s.points.find(p => p.id === "P5").limit.along, "default ขยับแนวราบ");
  near(1, P(run(s), "P5").x, "Right"); near(-1, P(run(s, { values: { Side: 1 } }), "P5").x, "Left");
});
test("อ้างจุดที่หาไม่ได้ = ไม่ขยับ + เตือน (จุดไม่หาย) · นิพจน์อ้าง P3.y เห็นค่าหลังขยับ", () => {
  const s = base(deep);
  s.points.push(pt("P5", { type: "delta", from: "P1", dx: "1", dy: "0" }, { limit: { measure: "depth", side: "below", ref: { type: "point", id: "P9" }, min: "1", action: "clampWarn", along: "vertical" } }),
                pt("P6", { type: "delta", from: "P1", dx: "1", dy: "P3.y" }));
  const r = run(s);
  near(0, P(r, "P5").y, "P5 อยู่ที่เดิม"); ok(r.issues.some(i => i.msg.startsWith("P5 Max / Min: ข้ามเพราะหาจุด P9 ไม่ได้")), "เตือน P9");
  near(-2, P(r, "P6").y, "P3.y หลังขยับ");
});

console.log("limited() / ตั้งค่า / ต่อกับระบบเดิม");
test("limited(P3) ในนิพจน์และเงื่อนไข · จุดที่ไม่มี Max / Min ใส่ limited() ไม่ได้", () => {
  const s = base(deep);
  s.points.push(pt("P5", { type: "delta", from: "P1", dx: "0", dy: "if(limited(P3), 1, 0)" }));
  near(1, P(run(s), "P5").y, "Depth 1 = ถูกขยับ"); near(0, P(run(s, { values: { Depth: 3 } }), "P5").y, "Depth 3 = ผ่าน");
  const o = Spec.exprOpts(s);
  ok(Expr.check("limited(P3)", Spec.names(s), { ...o, want: "bool" }).ok, "P3 ใช้ได้");
  const bad = Expr.check("limited(P2)", Spec.names(s), { ...o, want: "bool" });
  ok(!bad.ok && bad.error.includes("P2 ไม่มี Max / Min"), bad.error);
});
test("limitOptions / setLimit: จุดที่ตั้งไม่ได้, ขยับไม่ได้, ค่าว่าง, min > max, อ้างกันเป็นวง", () => {
  const s = base();
  s.points.push(pt("P5", { type: "slopeToSurface", from: "P2", slope: "-0.5", dir: 1, target: "TargetSurface" }));
  ok(!Spec.limitOptions(s, "P1").ok, "origin"); ok(Spec.limitOptions(s, "P5").why.includes("ลาดจนชนดิน"), "ลาดจนชนดิน");
  eq("depth,normal,length,offset", Spec.limitOptions(s, "P3").measures.join(","), "จุดลาดคุมได้ทุกแบบ");
  eq("slope", Spec.limitOptions(s, "P3").defaultAlong.depth, "จุดลาด default ตามแนวเดิม");
  throws(() => Spec.setLimit(s, "P5", deep), "ลาดจนชนดิน", "ลาดจนชนดิน");
  throws(() => Spec.setLimit(s, "P3", { ...deep, min: "", max: "" }), "อย่างใดอย่างหนึ่ง", "ค่าว่าง");
  throws(() => Spec.setLimit(s, "P3", { ...deep, min: "3", max: "2" }), "มากกว่า", "min > max");
  throws(() => Spec.setLimit(s, "P3", { ...deep, ref: { type: "point", id: "P4" } }), "อ้างกันเป็นวง", "วง");
  throws(() => Spec.setLimit(s, "P3", { measure: "length", min: "1", along: "vertical" }), "ขยับแนวดิ่งไม่ได้", "length + แนวดิ่ง");
  s.rotations = [{ id: "R1", pivot: "P1", angle: "10", points: ["P3"] }];
  ok(Spec.limitOptions(s, "P3").why.includes("กลุ่มหมุน"), "กลุ่มหมุน");
});
test("ลบจุดอ้างอิง = เอา Max / Min ออก (จุดอยู่) · ลบผ่าน removeLimit", () => {
  const s = base();
  s.points.push(pt("P5", { type: "delta", from: "P1", dx: "1", dy: "0" }));
  Spec.setLimit(s, "P5", { measure: "depth", side: "above", ref: { type: "point", id: "P4" }, min: "0.5" });
  Spec.removeCascade(s, "point", "P4");
  const p5 = s.points.find(p => p.id === "P5");
  ok(p5 && !p5.limit, "P5 อยู่ ไม่มี limit");
  Spec.setLimit(s, "P3", deep); Spec.removeLimit(s, "P3");
  ok(!s.points.find(p => p.id === "P3").limit, "removeLimit");
});
test("Copy ในตัวเดิม: Max / Min ไปด้วย (อ้างจุดในชุด = ตัวใหม่) · เปลี่ยนชื่อ parameter แล้วขอบเขตเปลี่ยนตาม (exprSlots)", () => {
  const s = base(deep);
  s.points.push(pt("P5", { type: "delta", from: "P2", dx: "1", dy: "0" }));
  Spec.setLimit(s, "P5", { measure: "depth", side: "below", ref: { type: "point", id: "P2" }, min: "P3.y + 3" });
  const c = Ops.clone(s, Ops.expand(s, { points: ["P2", "P3", "P5"] }), s);
  const n3 = s.points.find(p => p.id === c.map.P3), n5 = s.points.find(p => p.id === c.map.P5);
  eq("MinDepth", n3.limit.min, "limit ของ P3 ไปด้วย"); eq(c.map.P2, n5.limit.ref.id, "อ้าง P2 ตัวใหม่"); eq(`${c.map.P3}.y + 3`, n5.limit.min, "นิพจน์ remap");
  ok(Spec.exprSlots(s).some(x => x.obj === s.points[2].limit && x.key === "min"), "slot ของ limit");
});

test("Rotate: จุดที่มี Max / Min หมุนไม่ได้ (บอกเหตุผล) · branchRisks นับจุดที่ Max / Min อ้าง", () => {
  const s = base(deep);
  const pl = Ops.rotatePlan(s, ["P3"], "P2");
  ok(pl.blocked.some(b => b.id === "P3" && b.why.includes("Max / Min")), JSON.stringify(pl.blocked));
  ok(!pl.members.includes("P3"), "P3 ไม่อยู่ในกลุ่ม");
  const b = base();
  b.logic = { conditions: [{ id: "C1", name: "Up", expr: "true" }], decisions: [{ id: "D1", kind: "if", test: "Up" }],
              branches: [{ id: "B1", decision: "D1", case: true }, { id: "B2", decision: "D1", case: false }] };
  b.points.find(p => p.id === "P2").branch = "B1";
  b.points.push(pt("P5", { type: "delta", from: "P1", dx: "1", dy: "0" }));
  Spec.setLimit(b, "P5", { measure: "depth", side: "above", ref: { type: "point", id: "P2" }, min: "0.5" });
  ok(Spec.branchRisks(b).some(x => x.id === "P5" && x.ref === "P2"), JSON.stringify(Spec.branchRisks(b)));
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process !== "undefined") process.exitCode = failed ? 1 : 0;
