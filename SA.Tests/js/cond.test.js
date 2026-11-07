// ทดสอบนิพจน์เงื่อนไขของรอบ 4 (expr.js + การใช้ใน spec.js)
// รัน: node SA.Tests/js/cond.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\nthis.Expr = Expr; this.Spec = Spec;", ctx);
const { Expr, Spec } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const near = (exp, act, what, tol = 1e-6) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const bad = (r, part, what) => { ok(!r.ok, `${what}: ต้องไม่ผ่าน`); ok(r.error.includes(part), `${what}: ข้อความ "${r.error}" ต้องมี "${part}"`); };

const T = (src, env = {}, c) => Expr.test(src, env, c);
const V = (src, env = {}, c) => Expr.value(src, env, c);

console.log("เปรียบเทียบ / ตรรกะ / if()");
test("เปรียบเทียบ > < >= <= == != (== มี tolerance 1e-6)", () => {
  eq(true, T("2 > 1"), ">"); eq(false, T("2 < 1"), "<"); eq(true, T("Width >= 3", { Width: 3 }), ">=");
  eq(true, T("1 == 1.0000005"), "== ภายใน tolerance"); eq(false, T("1 == 1.00001"), "== นอก tolerance");
  eq(true, T("1 != 1.01"), "!="); eq(true, T("true == (2 > 1)"), "เทียบ จริง/เท็จ");
});
test("and or not (&& || !) · ไม่สนตัวพิมพ์ · ลำดับ not > and > or", () => {
  eq(true, T("1 > 0 and 2 > 1")); eq(true, T("1 > 2 || 2 > 1")); eq(false, T("!(1 > 0)")); eq(true, T("NOT 1 > 2 AND True"));
  eq(true, T("false and true or true"), "and ก่อน or");
  eq(false, T("not 1 > 0"), "not 1 > 0 = not (1 > 0)");
});
test("ลัดวงจร: exists(P9) and P9.y > 0 ไม่ error เมื่อ P9 ไม่มี", () => {
  const c = { exists: () => false, py: () => { throw new Error("ห้ามเรียก"); } };
  eq(false, T("exists(P9) and P9.y > 0", {}, c), "and");
  eq(true, T("not exists(P9) or P9.y > 0", {}, c), "or");
});
test("if(): เลือกตัวเลข / จริงเท็จ · คำนวณแค่กิ่งที่เลือก", () => {
  near(2, V("if(Width > 2, 2, 4)", { Width: 3 }), "if ตัวเลข");
  eq(false, T("if(1 > 2, true, false)"), "if จริง/เท็จ");
  near(1, V("if(true, 1, 1 / 0)"), "ไม่คำนวณกิ่งที่ไม่ได้เลือก");
});

console.log("ชนิด / ข้อความ error ภาษาไทย");
test("ช่องตัวเลขใส่เงื่อนไขไม่ได้ และกลับกัน", () => {
  bad(Expr.check("Width > 1", ["Width"]), "ช่องนี้ต้องเป็นตัวเลข", "ช่องตัวเลข");
  bad(Expr.check("Width + 1", ["Width"], { want: "bool" }), "ช่องนี้ต้องเป็นจริง/เท็จ", "ช่องเงื่อนไข");
  ok(Expr.check("Width > 1 and Width < 5", ["Width"], { want: "bool" }).ok, "เงื่อนไขปกติต้องผ่าน");
});
test("ชนิดผิดในนิพจน์: บอกตำแหน่ง", () => {
  bad(Expr.check("true + 1", []), "ด้านซ้ายของ + ต้องเป็นตัวเลข แต่ได้จริง/เท็จ (ตำแหน่ง 1)", "true + 1");
  bad(Expr.check("1 and 2 > 1", [], { want: "bool" }), "ด้านซ้ายของ and ต้องเป็นจริง/เท็จ", "1 and ...");
  bad(Expr.check("if(1, 2, 3)", []), "ค่าแรกของ if() ต้องเป็นจริง/เท็จ", "if เงื่อนไขไม่ใช่ bool");
  bad(Expr.check("if(true, 2, 1 > 0)", []), "ต้องชนิดเดียวกัน", "if สองกิ่งต่างชนิด");
  bad(Expr.check("1 == (2 > 1)", [], { want: "bool" }), "ต้องเทียบชนิดเดียวกัน", "== ต่างชนิด");
});
test("ไวยากรณ์: a < b < c, = ตัวเดียว, คำสงวน", () => {
  bad(Expr.check("1 < 2 < 3", [], { want: "bool" }), "ต่อกันแบบ a < b < c ไม่ได้", "ต่อกัน");
  bad(Expr.check("Width = 3", ["Width"], { want: "bool" }), "ใช้ == (สองตัว)", "= ตัวเดียว");
  bad(Expr.check("and + 1", []), "ไม่คาดว่าจะเจอ 'and'", "คำสงวน");
  ok(Expr.KEYWORDS.has("and") && Expr.FUNCS.ground && Expr.FUNCS.exists, "มีคำสงวน / ฟังก์ชันใหม่");
});
test("อ้างจุด: ช่องที่อ้างไม่ได้ / จุดที่ไม่มี / ชื่อจุดลอยๆ / target", () => {
  bad(Expr.check("P3.y", []), "ช่องนี้อ้างจุดไม่ได้", "ไม่ส่ง points");
  ok(Expr.check("P3.y + 1", [], { points: ["P3"] }).ok, "มี P3");
  bad(Expr.check("P4.y", [], { points: ["P3"] }), "ไม่มีจุด P4", "จุดที่ไม่มี");
  bad(Expr.check("P3 + 1", [], { points: ["P3"] }), "P3 เป็นจุด — ใช้ P3.x", "ชื่อจุดลอยๆ");
  bad(Expr.check("ground(2)", [], { points: ["P3"] }), "ต้องใส่ชื่อจุด", "ground ไม่ใช่จุด");
  bad(Expr.check('ground(P3, "Rock")', [], { points: ["P3"], targets: ["TargetSurface"] }), "ไม่มี target ชื่อ Rock", "target ผิด");
  ok(Expr.check('ground(P3, "TargetSurface") > P3.y', [], { points: ["P3"], targets: ["TargetSurface"], want: "bool" }).ok, "target ถูก");
  bad(Expr.check("P3.z", [], { points: ["P3"] }), "ต้องเป็น x หรือ y", ".z");
  eq("P3,P5", [...Expr.pointRefs(Expr.parse("P3.x + ground(P5) + if(exists(P3), 1, 0)"))].sort().join(","), "pointRefs");
});

console.log("ใช้ใน spec (P3.x / P3.y / ground / exists / hasGround)");
function spec(points, extra){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Width", kind: "double", default: 3, min: null, max: null });
  s.points = [{ id: "P1", codes: [], def: { type: "origin" } }, ...points.map(([id, def]) => ({ id, codes: [], def }))];
  return Object.assign(s, extra);
}
// ผิวดิน: ขวาสูง (ที่ x = 3 สูง 2.1) ซ้ายต่ำ (ที่ x = -3 สูง -1.4)
const surf = [{ x: -30, y: -5 }, { x: 0, y: -1 }, { x: 30, y: 30 }];
const run = (s, o = {}) => Spec.evaluate(s, { values: o.values || {}, codeParams: [], codePoints: [], surface: o.surface === undefined ? surf : o.surface,
                                             extendEnds: o.extendEnds !== false, layout: !!o.layout });
const P = (r, id) => { const p = r.pts[id]; if (!p || p.err) throw new Error(`จุด ${id}: ${p ? p.err : "ไม่มี"}`); return p; };
const cutFill = spec([
  ["P2", { type: "delta", from: "P1", dx: "Width", dy: "0" }],
  ["P3", { type: "delta", from: "P2", dx: "1", dy: "ground(P2) - P2.y" }],            // ระดับผิวดินใต้ P2
  ["P4", { type: "delta", from: "P1", dx: "if(ground(P2) > P2.y, 2, 4)", dy: "if(P2.x > 2 and not (Width == 4), -1, -2)" }],
  ["P5", { type: "polar", from: "P1", length: "1", angle: "if(hasGround(), 30, 60)" }]
]);
test("Right: ground(P2) บนผิวดินลาด · ตัด (ผิวดินสูงกว่า) เลือก 2", () => {
  const r = run(cutFill);
  near(2.1, P(r, "P3").y, "P3.y = ground(P2)"); near(4, P(r, "P3").x, "P3.x");
  near(2, P(r, "P4").x, "ตัด -> dx 2"); near(-1, P(r, "P4").y, "P2.x > 2");
  near(Math.cos(Math.PI / 6), P(r, "P5").x, "hasGround() = จริง -> 30°");
  eq(0, r.issues.length, "ไม่มีเตือน");
});
test("Left (F = -1): P2.x เป็นค่าในกรอบ Right (ยังเป็น 3) · ground ใช้ offset บนจอ (-3)", () => {
  const r = run(cutFill, { values: { Side: 1 } });
  near(-3, P(r, "P2").x, "P2 บนจอ"); near(-1.4, P(r, "P3").y, "ground(-3)");
  near(-4, P(r, "P4").x, "ถม -> dx 4 (บนจอ -4)"); near(-1, P(r, "P4").y, "P2.x > 2 ยังจริงในกรอบ Right");
});
test("ไม่มีผิวดิน: ground() = ระดับของจุดเอง (+ เตือน ยกเว้น Layout) · hasGround() = เท็จ", () => {
  const r = run(cutFill, { surface: null });
  near(0, P(r, "P3").y, "ground(P2) = P2.y"); near(4, P(r, "P4").x, "ไม่ใช่ตัด -> 4");
  near(Math.cos(Math.PI / 3), P(r, "P5").x, "hasGround() = เท็จ -> 60°");
  ok(r.issues.some(i => i.msg.includes("ground(P2)")), "เตือน ground");
  eq(0, run(cutFill, { layout: true }).issues.length, "Layout ไม่เตือน");
});
test("exists(): จุดที่ไม่มี / หาไม่ได้ = เท็จ · อ้างจุดที่หาไม่ได้ในนิพจน์ = จุดนี้หาไม่ได้", () => {
  const s = spec([
    ["P2", { type: "delta", from: "P9", dx: "1", dy: "0" }],                       // หาไม่ได้
    ["P3", { type: "delta", from: "P1", dx: "if(exists(P2) or exists(P8), 1, 2)", dy: "0" }],
    ["P4", { type: "delta", from: "P1", dx: "P2.x", dy: "0" }]
  ]);
  const r = run(s);
  near(2, P(r, "P3").x, "exists เท็จ"); ok(r.pts.P4.err, "P4 หาไม่ได้");
});
test("การพึ่งพา: refs นับจุดในนิพจน์ · ลบ P2 = P3 ที่ใช้ P2.y หายด้วย · อ้างกันเป็นวง = error", () => {
  eq("P2", Spec.refs({ type: "delta", from: "P1", dx: "1", dy: "ground(P2)" }).filter(x => x !== "P1").join(","), "refs");
  const s = JSON.parse(JSON.stringify(cutFill));
  const gone = Spec.removeCascade(s, "point", "P2");
  ok(gone.includes("P3") && gone.includes("P4"), "ลบตาม: " + gone.join(","));
  const cyc = spec([["P2", { type: "delta", from: "P1", dx: "P3.x", dy: "0" }], ["P3", { type: "delta", from: "P2", dx: "1", dy: "0" }]]);
  const r = run(cyc);
  ok(r.pts.P2.err && r.pts.P3.err, "วน = error");
});

console.log("ของเก่าจากรอบ 4b (Max / Min ถูกเอาออกในรอบ 4c)");
test("normalize ตัด limit ทิ้ง + คืนรายการจุด · จุดใช้ตำแหน่งตามนิยามเดิม · limited() = ไม่มีฟังก์ชัน (บอกตำแหน่ง)", () => {
  const s = spec([["P2", { type: "delta", from: "P1", dx: "1", dy: "-1" }]]);
  s.points[1].limit = { measure: "depth", side: "below", ref: { type: "ground" }, min: "2", action: "clampWarn", along: "vertical" };
  const dropped = [];
  Spec.normalize(s, dropped);
  eq("P2", dropped.join(","), "รายการที่ตัด"); ok(!("limit" in s.points[1]), "ไม่มี limit แล้ว");
  near(-1, P(run(s), "P2").y, "ตำแหน่งตามนิยามเดิม");
  bad(Expr.check("limited(P2)", ["Width"], { want: "bool", points: ["P1", "P2"] }), "ไม่มีฟังก์ชัน limited() (ตำแหน่ง 1)", "limited()");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
