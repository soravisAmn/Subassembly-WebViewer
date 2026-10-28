// ทดสอบตัวคำนวณนิพจน์และ DrawingSpec ฝั่ง JS (SA.Web/wwwroot/js/expr.js, spec.js)
// รัน: node SA.Tests/js/evaluator.test.js
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
const P = (r, id) => { const p = r.pts[id]; if (!p || p.err) throw new Error(`จุด ${id}: ${p ? p.err : "ไม่มี"}`); return p; };
const pt = (r, id, x, y) => { const p = P(r, id); near(x, p.x, id + " x"); near(y, p.y, id + " y"); };

function spec(points, extra){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Width", kind: "double", default: 3, min: 0.5, max: null }, { name: "SideSlope", kind: "double", default: 2, min: null, max: null });
  s.points = [{ id: "P1", codes: [], def: { type: "origin" } }, ...points.map(([id, def]) => ({ id, codes: [], def }))];
  return Object.assign(s, extra);
}
const flat = y => [{ x: -50, y }, { x: 50, y }];

console.log("นิพจน์");
test("ตัวเลข / parameter / ลำดับการคำนวณ", () => {
  near(-0.5, Expr.value("-1/SideSlope", { SideSlope: 2 }), "-1/SideSlope");
  near(7, Expr.value("1 + 2 * 3", {}), "1+2*3");
  near(9, Expr.value("(1 + 2) * 3", {}), "(1+2)*3");
  near(2, Expr.value("min(Width, 2, 5)", { Width: 3 }), "min");
  near(0.5, Expr.value("sin(30)", {}), "sin องศา");
  near(45, Expr.value("atan(1)", {}), "atan คืนองศา");
  near(8, Expr.value("pow(2, 3)", {}), "pow");
  near(0.001, Expr.value("1e-3", {}), "1e-3");
});
test("ตรวจตอนพิมพ์: ชื่อไม่มีจริง / วงเล็บไม่ครบ / ฟังก์ชันผิด", () => {
  ok(!Expr.check("Widht * 2", ["Width"]).ok, "ชื่อผิดต้องไม่ผ่าน");
  ok(!Expr.check("(1 + 2", []).ok, "วงเล็บขาดต้องไม่ผ่าน");
  ok(!Expr.check("1 + 2)", []).ok, "วงเล็บเกินต้องไม่ผ่าน");
  ok(!Expr.check("pow(2)", []).ok, "pow ต้องมี 2 ค่า");
  ok(!Expr.check("foo(1)", []).ok, "ฟังก์ชันที่ไม่มี");
  ok(!Expr.check("", []).ok, "ว่าง");
  ok(Expr.check("max(Width, 0.5) * 2", ["Width"]).ok, "ปกติต้องผ่าน");
});

console.log("DrawingSpec");
test("delta / slopeLength (ตามแนวลาด, ระยะราบ, ระยะดิ่ง)", () => {
  const r = Spec.evaluate(spec([
    ["P2", { type: "delta", from: "P1", dx: "Width", dy: "0" }],
    ["P3", { type: "slopeLength", from: "P2", slope: "-1/SideSlope", length: "sqrt(5)", dir: 1, measure: "along" }],
    ["P4", { type: "slopeLength", from: "P2", slope: "-1/2", length: "4", dir: -1, measure: "dx" }],
    ["P5", { type: "slopeLength", from: "P2", slope: "-1/2", length: "1", dir: 1, measure: "dy" }]
  ]), {});
  pt(r, "P2", 3, 0); pt(r, "P3", 5, -1); pt(r, "P4", -1, -2); pt(r, "P5", 5, -1);
  eq(0, r.issues.length, "issue");
});
test("Side = Left กลับด้านแนวราบทั้งหมด", () => {
  const r = Spec.evaluate(spec([
    ["P2", { type: "delta", from: "P1", dx: "Width", dy: "0" }],
    ["P3", { type: "slopeLength", from: "P2", slope: "-1/2", length: "2", dir: 1, measure: "dx" }]
  ]), { values: { Side: 1 } });
  pt(r, "P2", -3, 0); pt(r, "P3", -5, -1); eq(-1, r.flip, "flip");
});
test("ลาดจนชนดิน: ชนผิวดินราบ (ขวา และ ซ้าย)", () => {
  const s = spec([["P2", { type: "delta", from: "P1", dx: "Width", dy: "0" }],
                  ["P3", { type: "slopeToSurface", from: "P2", slope: "-1/SideSlope", dir: 1, target: "TargetSurface", maxDistance: "50", layoutLength: "3" }]]);
  pt(Spec.evaluate(s, { surface: flat(-3), extendEnds: true }), "P3", 9, -3);
  pt(Spec.evaluate(s, { surface: flat(-3), extendEnds: true, values: { Side: 1 } }), "P3", -9, -3);
  // ผิวดินสูงกว่าจุดเริ่ม: slope ขึ้น
  const up = spec([["P2", { type: "slopeToSurface", from: "P1", slope: "1/2", dir: 1, target: "TargetSurface", maxDistance: "50" }]]);
  pt(Spec.evaluate(up, { surface: flat(2), extendEnds: true }), "P2", 4, 2);
});
test("ลาดจนชนดิน: ไม่ชนภายใน maxDistance -> หยุดที่ maxDistance + เตือน", () => {
  const s = spec([["P2", { type: "slopeToSurface", from: "P1", slope: "-0.01", dir: 1, target: "TargetSurface", maxDistance: "10" }]]);
  const r = Spec.evaluate(s, { surface: flat(-3), extendEnds: true });
  pt(r, "P2", 10, -0.1); eq(1, r.issues.length, "เตือน");
});
test("ลาดจนชนดิน: Layout / ไม่มี surface -> ยาวคงที่ layoutLength", () => {
  const s = spec([["P2", { type: "slopeToSurface", from: "P1", slope: "-1/2", dir: 1, target: "TargetSurface", maxDistance: "50", layoutLength: "4" }]]);
  const r = Spec.evaluate(s, { surface: flat(-3), layout: true });
  pt(r, "P2", 4, -2); eq(0, r.issues.length, "Layout ไม่เตือน");
  eq(1, Spec.evaluate(s, { surface: null }).issues.length, "Corridor ไม่มี target ต้องเตือน");
});
test("ลาดจนชนดิน: ผิวดินหักหลายช่วง เหมือนตัวจำลอง", () => {
  const g = [{ x: -10, y: 0 }, { x: 2, y: -1 }, { x: 6, y: -4 }, { x: 20, y: -4.5 }];
  const s = spec([["P2", { type: "slopeToSurface", from: "P1", slope: "-0.25", dir: 1, target: "T", maxDistance: "50" }]]);
  const r = Spec.evaluate(s, { surface: g, extendEnds: true });
  // ดินลาดลงเร็วกว่าเส้นจนถึง x = 6 แล้วชนในช่วง 6..20: ดิน y = -4 - (x-6)/28, เส้น y = -0.25x -> x = 106/6
  pt(r, "P2", 106 / 6, -0.25 * 106 / 6);
});
test("onSurface / between / intersect", () => {
  const g = [{ x: 0, y: -1 }, { x: 10, y: -3 }];
  const r = Spec.evaluate(spec([
    ["P2", { type: "onSurface", from: "P1", dx: "5", target: "T" }],
    ["P3", { type: "delta", from: "P1", dx: "4", dy: "2" }],
    ["P4", { type: "between", a: "P1", b: "P3", t: "0.5" }],
    ["P5", { type: "delta", dx: "0", dy: "-5" }],
    ["P6", { type: "delta", dx: "4", dy: "-5" }],
    ["P7", { type: "intersect", a1: "P1", a2: "P3", b1: "P5", b2: "P6" }]
  ]), { surface: g, extendEnds: true });
  pt(r, "P2", 5, -2); pt(r, "P4", 2, 1); pt(r, "P7", -10, -5);
});
test("external: หาจุดด้วย code; ไม่เจอ = ข้ามส่วนที่พึ่งจุดนั้น", () => {
  const s = spec([["P2", { type: "external", code: "TrapTopOutside" }], ["P3", { type: "delta", from: "P2", dx: "1", dy: "0" }]]);
  s.links = [{ id: "L1", points: ["P2", "P3"], codes: [] }];
  const r = Spec.evaluate(s, { codePoints: [{ x: 2, y: 0, codes: ["TrapTopOutside"] }] });
  pt(r, "P3", 3, 0);
  const miss = Spec.evaluate(s, { codePoints: [] });
  ok(miss.pts.P2.err && miss.pts.P3.err && miss.links.L1.err, "ต้องข้าม P2, P3, L1");
});
test("วิ่งตามผิวดิน: ได้จุดยอดของผิวดินระหว่างปลาย", () => {
  const g = [{ x: -10, y: 0 }, { x: 1, y: -1 }, { x: 3, y: -2 }, { x: 20, y: -2 }];
  const s = spec([["P2", { type: "onSurface", from: "P1", dx: "-2", target: "T" }], ["P3", { type: "onSurface", from: "P1", dx: "5", target: "T" }]]);
  s.links = [{ id: "L1", type: "followSurface", from: "P2", to: "P3", target: "T", codes: [] }];
  const path = Spec.evaluate(s, { surface: g, extendEnds: true }).links.L1.path;
  eq(4, path.length, "จำนวนจุด"); near(1, path[1].x, "จุดกลาง 1"); near(3, path[2].x, "จุดกลาง 2"); near(-2, path[3].y, "ปลาย");
});
test("shape: ต่อ link เป็นรูปปิด (ทิศ link สลับกันได้)", () => {
  const s = spec([["P2", { type: "delta", dx: "2", dy: "0" }], ["P3", { type: "delta", dx: "2", dy: "-1" }]]);
  s.links = [{ id: "L1", points: ["P1", "P2"], codes: [] }, { id: "L2", points: ["P3", "P2"], codes: [] }, { id: "L3", points: ["P3", "P1"], codes: [] }];
  s.shapes = [{ id: "S1", links: ["L1", "L2", "L3"], codes: [] }];
  const r = Spec.evaluate(s, {});
  eq(3, r.shapes.S1.poly.length, "จุดของรูป");
  s.links.pop(); s.shapes[0].links.pop();
  ok(!Spec.evaluate(s, {}).shapes.S1.poly, "ไม่ปิด = ไม่มี polygon");
});
test("ขอบเขต parameter: ต่ำกว่า min ใช้ค่าขอบ + เตือน", () => {
  const r = Spec.evaluate(spec([["P2", { type: "delta", dx: "Width", dy: "0" }]]), { values: { Width: 0.2 } });
  pt(r, "P2", 0.5, 0); eq(1, r.issues.length, "เตือน");
});
test("parameter ของโค้ดเดิมใช้ในนิพจน์ได้", () => {
  const s = spec([["P2", { type: "delta", dx: "TopWidth * 2", dy: "0" }]]);
  pt(Spec.evaluate(s, { codeParams: [{ name: "TopWidth", kind: "double", default: 2 }], values: { TopWidth: 1.5 } }), "P2", 3, 0);
});
test("ลบจุด = ลบจุด / link / shape ที่พึ่งมันด้วย", () => {
  const s = spec([["P2", { type: "delta", from: "P1", dx: "1", dy: "0" }], ["P3", { type: "delta", from: "P2", dx: "1", dy: "0" }], ["P4", { type: "delta", dx: "0", dy: "1" }]]);
  s.links = [{ id: "L1", points: ["P1", "P2"], codes: [] }, { id: "L2", points: ["P1", "P4"], codes: [] }];
  s.shapes = [{ id: "S1", links: ["L1", "L2"], codes: [] }];
  const gone = Spec.removeCascade(s, "point", "P2");
  eq("P2,P3,L1,S1", gone.join(","), "ที่ถูกลบ");
  eq("P1,P4", s.points.map(p => p.id).join(","), "จุดที่เหลือ");
  eq("P5", Spec.nextId(s, "P"), "id ถัดไป (เลขสูงสุด + 1)");
});
test("จุดอ้างกันเป็นวง -> error ไม่ค้าง", () => {
  const s = spec([["P2", { type: "delta", from: "P3", dx: "1", dy: "0" }], ["P3", { type: "delta", from: "P2", dx: "1", dy: "0" }]]);
  const r = Spec.evaluate(s, {});
  ok(r.pts.P2.err && r.pts.P3.err, "ต้อง error");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
