// ทดสอบ Move / Copy / Paste ของส่วนที่วาด (SA.Web/wwwroot/js/ops.js)
// รัน: node SA.Tests/js/ops.test.js
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

// P1 origin · P2 (0,0) · P3 = P2 + (-0.25, 0) · P4 = P3 + (0, -0.5) · P5 = P4 + (Width, 0)
// P6 บนเส้น P3-P4 · P7 ลาด -1/2 จาก P3 ยาว 1 (ระยะราบ) ไปทางนอก · P8 บนผิวดินห่าง P3 1 m · P9 บนเส้น P4-P5
function make(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Width", kind: "double", default: 2, min: null, max: null });
  const P = (id, def) => s.points.push({ id, codes: [], def });
  P("P2", { type: "delta", dx: "0", dy: "0" });
  P("P3", { type: "delta", from: "P2", dx: "-0.25", dy: "0" });
  P("P4", { type: "delta", from: "P3", dx: "0", dy: "-0.5" });
  P("P5", { type: "delta", from: "P4", dx: "Width", dy: "0" });
  P("P6", { type: "between", a: "P3", b: "P4", t: "0.5" });
  P("P7", { type: "slopeLength", from: "P3", slope: "-1/2", length: "1", dir: 1, measure: "dx" });
  P("P8", { type: "onSurface", from: "P3", dx: "1", target: "TargetSurface" });
  P("P9", { type: "between", a: "P4", b: "P5", t: "0.5" });
  s.links.push({ id: "L1", points: ["P3", "P4"], codes: ["Top"] }, { id: "L2", points: ["P4", "P5"], codes: [] });
  s.shapes.push({ id: "S1", links: ["L1", "L2"], codes: ["Pave"] });
  return s;
}
const ctx = { values: {}, codeParams: [], codePoints: [], surface: [{ x: -50, y: -3 }, { x: 50, y: -3 }], extendEnds: true, layout: false };
const ev = s => Spec.evaluate(s, ctx).pts;
const at = (r, id) => { const p = r[id]; if (!p || p.err) throw new Error(`จุด ${id}: ${p ? p.err : "ไม่มี"}`); return p; };
const moved = (before, after, id, v) => { near(at(before, id).x + v.x, at(after, id).x, id + " x"); near(at(before, id).y + v.y, at(after, id).y, id + " y"); };
function move(s, ids, v, F = 1, convert = false){
  const pos = ev(s), pl = Ops.plan(s, ids, convert);
  Ops.apply(s, pl, v, F, pos);
  return pl;
}

console.log("Move");
test("ย้ายราก (delta) = แก้ dx/dy · จุดที่อ้างตามขยับตามโดยไม่แก้", () => {
  const s = make(), b = ev(s), v = { x: 1, y: 0.5 };
  const pl = move(s, ["P3", "P4"], v);
  eq("P3", pl.edit.map(e => e.id).join(","), "แก้เฉพาะราก");
  eq("0.75", Spec.byId(s.points, "P3").def.dx, "dx"); eq("0.5", Spec.byId(s.points, "P3").def.dy, "dy");
  eq("0", Spec.byId(s.points, "P4").def.dx, "P4 ไม่ถูกแก้");
  const a = ev(s);
  for (const id of ["P3", "P4", "P5", "P6", "P7"]) moved(b, a, id, v);
  near(-3, at(a, "P8").y, "P8 ยังอยู่บนผิวดิน");
});
test("นิพจน์อ้าง parameter: เขียนต่อท้าย ไม่แทนเป็นตัวเลขเงียบๆ", () => {
  const s = make();
  move(s, ["P5"], { x: 1.25, y: 0 }); eq("Width + 1.25", Spec.byId(s.points, "P5").def.dx, "ครั้งแรก");
  move(s, ["P5"], { x: -0.75, y: 0 }); eq("Width + 0.5", Spec.byId(s.points, "P5").def.dx, "รวมค่าคงที่");
  move(s, ["P5"], { x: -0.5, y: 0 }); eq("Width", Spec.byId(s.points, "P5").def.dx, "หักล้างหมด");
  eq("Width - 1", Ops.addExpr("Width", -1), "ลบ");
  eq("Width * 2 + 1", Ops.addExpr("Width * 2", 1), "มีคูณ");
  eq("2.5", Ops.addExpr("2", 0.5), "ตัวเลข");
});
test("Side = Left (F = -1): ย้ายไปทางขวาบนจอ = dx ใน spec ลดลง", () => {
  const s = make();
  move(s, ["P3"], { x: 1, y: 0 }, -1);
  eq("-1.25", Spec.byId(s.points, "P3").def.dx, "dx");
});
test("จุดที่ขึ้นกับโลกภายนอก = ไม่ย้าย + บอกเหตุผล · convert = แปลงเป็น delta แล้วย้าย", () => {
  const s = make(), b = ev(s), v = { x: 0.3, y: 0.2 };
  const pl = Ops.plan(s, ["P6", "P8"], false);
  eq("P6,P8", pl.blocked.map(x => x.id).join(","), "ไม่ย้าย");
  move(s, ["P6", "P8"], v, 1, true);
  const a = ev(s);
  eq("delta", Spec.byId(s.points, "P6").def.type, "P6 แปลง"); eq("P3", Spec.byId(s.points, "P8").def.from, "P8 ยังอ้าง P3");
  moved(b, a, "P6", v); moved(b, a, "P8", v); moved(b, a, "P3", { x: 0, y: 0 });
});
test("ลาด + ความยาวที่เป็นราก = แปลงเป็น delta ที่ตำแหน่งใหม่", () => {
  const s = make(), b = ev(s), v = { x: 0.4, y: -0.1 };
  move(s, ["P7"], v);
  eq("delta", Spec.byId(s.points, "P7").def.type, "ชนิด"); moved(b, ev(s), "P7", v);
});
test("บนเส้นที่ปลายย้ายทั้งคู่ = ตามไปเอง", () => {
  const s = make(), pl = Ops.plan(s, ["P4", "P5", "P9"], false);
  eq(0, pl.blocked.length, "ไม่มีที่ย้ายไม่ได้"); eq("P4", pl.edit.map(e => e.id).join(","), "แก้แค่ P4");
});
test("expand: shape -> link -> จุดปลาย (เรียงตาม spec)", () => {
  const f = Ops.expand(make(), { shapes: ["S1"] });
  eq("P3,P4,P5", f.points.join(","), "จุด"); eq("L1,L2", f.links.join(","), "link");
});

console.log("Copy / Paste");
test("Copy ในตัวเดียวกัน: ในชุดอ้างกันเอง, นอกชุดอ้างตัวเดิม, codes ติดไป, ย้ายสำเนาไม่กระทบตัวเดิม", () => {
  const s = make(), b = ev(s), v = { x: 3, y: 0 };
  const c = Ops.clone(s, Ops.expand(s, { links: ["L1"] }), s);
  eq(2, c.points.length, "จุดใหม่");
  const p3c = Spec.byId(s.points, c.map.P3), p4c = Spec.byId(s.points, c.map.P4);
  eq("P2", p3c.def.from, "อ้างนอกชุด = ตัวเดิม"); eq(c.map.P3, p4c.def.from, "อ้างในชุด = สำเนา");
  eq("Top", Spec.byId(s.links, c.links[0]).codes[0], "codes");
  move(s, c.points, v);
  const a = ev(s);
  moved(b, a, "P3", { x: 0, y: 0 });
  near(at(b, "P3").x + 3, at(a, c.map.P3).x, "สำเนา P3 x"); near(at(b, "P4").y, at(a, c.map.P4).y, "สำเนา P4 y");
});
test("Paste เข้าตัวอื่น: ที่อ้างนอกชุด / ชื่อ parameter ที่ไม่มี = delta จาก origin ตามตำแหน่ง", () => {
  const s = make(), pos = ev(s), dst = Spec.newSpec("U");
  const c = Ops.clone(s, Ops.expand(s, { links: ["L1", "L2"] }), dst, { detach: true, pos, F: 1, names: Spec.names(dst) });
  const r = Spec.evaluate(dst, ctx).pts;
  for (const id of ["P3", "P4", "P5"]) { near(pos[id].x, at(r, c.map[id]).x, id + " x"); near(pos[id].y, at(r, c.map[id]).y, id + " y"); }
  eq(undefined, Spec.byId(dst.points, c.map.P3).def.from, "P3 แปลงเป็นจาก origin");
  eq(c.map.P3, Spec.byId(dst.points, c.map.P4).def.from, "P4 ยังอ้างในชุด");
  eq("delta", Spec.byId(dst.points, c.map.P5).def.type, "P5 (Width ไม่มีในตัวใหม่) = ตัวเลข");
  eq(undefined, Spec.byId(dst.points, c.map.P5).def.from, "P5 จาก origin");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process === "object") process.exitCode = failed ? 1 : 0;
