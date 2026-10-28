// ทดสอบการเลือกจุด OSNAP (SA.Web/wwwroot/js/snap.js)
// รัน: node SA.Tests/js/snap.test.js
// (ไม่มี node: รันใน console ของหน้าเว็บได้ด้วย globalThis.SA_LIB = { Spec, Snap } แล้ว eval ไฟล์นี้ในฟังก์ชัน)
"use strict";
const { Spec, Snap } = typeof require === "function" ? (() => {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
  const ctx = vm.createContext({ console });
  vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("snap.js") + "\nthis.Spec = Spec; this.Snap = Snap;", ctx);
  return ctx;
})() : globalThis.SA_LIB;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };

// 100 px ต่อเมตร · รัศมี 12 px · เปิดทุกชนิด
const ALL = { on: true, end: true, mid: true, int: true, surf: true, perp: true, near: true };
const P = (label, x, y) => ({ label, x, y });
const S = (id, a, b) => ({ id, a, b });
function run(over){
  return Snap.collect(Object.assign({ mouse: { x: 0, y: 0 }, scale: { x: 100, y: 100 }, R: 12, os: ALL, points: [], segs: [], from: null, ground: null, ray: null }, over));
}
const kinds = list => list.map(c => c.kind).join(",");

// เส้นสั้น 0.1 m: กึ่งกลางห่างปลาย 5 px
const p1 = P("P1", 0, 0), p2 = P("P2", 0.1, 0), short = S("L1", p1, p2);

console.log("เลือกตัวที่ใกล้เมาส์ที่สุด");
test("Midpoint ของเส้นสั้นชนะ Endpoint เมื่อเมาส์อยู่ที่กึ่งกลาง", () => {
  const r = run({ mouse: { x: 0.05, y: 0 }, points: [p1, p2], segs: [short] });
  eq("mid", r[0].kind, "ตัวแรก");
  ok(r.some(c => c.kind === "end"), "Endpoint ยังอยู่ในรายการให้ Tab วนถึง");
});
test("ใกล้ปลายมากกว่า = Endpoint", () => {
  const r = run({ mouse: { x: 0.02, y: 0 }, points: [p1, p2], segs: [short] });
  eq("end", r[0].kind, "ตัวแรก"); eq("P1", r[0].label, "จุด");
});
test("ระยะเท่ากัน = Endpoint ชนะ", () => {
  // จุด P3 อยู่ตรงกึ่งกลางของ L1 พอดี
  const r = run({ mouse: { x: 0.05, y: 0.02 }, points: [p1, p2, P("P3", 0.05, 0)], segs: [short] });
  eq("end", r[0].kind, "ตัวแรก"); eq("P3", r[0].label, "จุด");
});
test("Nearest ใช้เมื่อไม่มี snap แม่นในรัศมีเท่านั้น", () => {
  const long = S("L2", P("A", 0, 0), P("B", 1, 0));
  eq("near", run({ mouse: { x: 0.3, y: 0.01 }, segs: [long] })[0].kind, "กลางเส้นยาว");
  const r = run({ mouse: { x: 0.04, y: 0.01 }, points: [long.a], segs: [long] });
  eq("end", r[0].kind, "ใกล้ปลาย (Nearest อยู่ใกล้กว่าแต่เป็นตัวสำรอง)");
  eq("near", r[r.length - 1].kind, "Nearest อยู่ท้ายรายการ");
});
test("Surface เป็นตัวสำรองแบบ Nearest", () => {
  const ground = { nearest: (x) => ({ x, y: -0.02 }) };
  const r = run({ mouse: { x: 0.02, y: 0 }, points: [p1], ground });
  eq("end,surf", kinds(r), "ลำดับ");
});
test("รัศมีคิด VE (scale แนวดิ่งต่างจากแนวราบ)", () => {
  const pts = [P("P1", 0, 0.05)];
  eq(0, run({ mouse: { x: 0, y: 0 }, points: pts, scale: { x: 100, y: 500 } }).length, "VE 5: ห่าง 25 px");
  eq(1, run({ mouse: { x: 0, y: 0 }, points: pts, scale: { x: 100, y: 100 } }).length, "VE 1: ห่าง 5 px");
});

console.log("ปุ่ม OSNAP");
test("OSNAP master ปิด (F3) = ไม่มี snap", () => {
  eq(0, run({ os: { ...ALL, on: false }, points: [p1], segs: [short] }).length, "จำนวน");
});
test("ปิด Endpoint = ไม่จับจุด แต่ Midpoint ยังได้", () => {
  const r = run({ os: { ...ALL, end: false }, mouse: { x: 0.03, y: 0 }, points: [p1, p2], segs: [short] });
  ok(!r.some(c => c.kind === "end"), "ไม่มี end"); eq("mid", r[0].kind, "ตัวแรก");
});
test("ปิดทุกชนิด = ไม่มี snap", () => {
  const off = { on: true, end: false, mid: false, int: false, surf: false, perp: false, near: false };
  eq(0, run({ os: off, points: [p1], segs: [short], ground: { nearest: x => ({ x, y: 0 }) } }).length, "จำนวน");
});

console.log("ชนิดของ snap");
test("Intersection: เส้นไขว้กัน / ต่อกันที่ปลายไม่นับ / ไม่ถึงกันไม่นับ", () => {
  const a = S("L1", P("A", -1, -1), P("B", 1, 1)), b = S("L2", P("C", -1, 1), P("D", 1, -1));
  const r = run({ os: { ...ALL, near: false }, segs: [a, b] });
  eq("int", r[0].kind, "ไขว้กัน"); eq("จุดตัด L1 × L2", r[0].label, "ป้าย");
  const c = S("L3", P("B", 1, 1), P("E", 2, 0));
  eq(0, run({ os: { ...ALL, near: false, mid: false }, mouse: { x: 1, y: 1 }, segs: [a, c] }).filter(x => x.kind === "int").length, "ต่อกันที่ปลาย");
  const d = S("L4", P("F", 0.5, -1), P("G", 0.5, -0.8));
  eq(0, run({ os: { ...ALL, near: false }, mouse: { x: 0.5, y: 0.5 }, segs: [a, d] }).filter(x => x.kind === "int").length, "ไม่ถึงกัน");
});
test("Perpendicular จากจุดก่อนหน้า", () => {
  const l = S("L1", P("A", 0, 0), P("B", 1, 0));
  const r = run({ os: { ...ALL, near: false, mid: false }, mouse: { x: 0.4, y: 0.02 }, from: { x: 0.4, y: 1 }, segs: [l] });
  eq("perp", r[0].kind, "ชนิด"); ok(Math.abs(r[0].t - 0.4) < 1e-9, "t = 0.4");
});
test("ลาดชนดิน: รัศมีกว้าง 2.5 เท่า และมีแล้วไม่ต้องมี Surface", () => {
  const ground = { nearest: (x) => ({ x, y: 0 }) }, ray = { x: 0.25, y: 0, label: "ลาด 1:2 ชนดิน" };
  const r = run({ mouse: { x: 0, y: 0 }, ground, ray });
  eq("ray", kinds(r), "มีแต่ ray (ห่าง 25 px < 30 px)");
  eq("surf", kinds(run({ mouse: { x: 0, y: 0 }, ground, ray: { ...ray, x: 0.5 } })), "ray ไกลเกิน = Surface");
});
test("จุดซ้อนกัน (โค้ดเดิมทับจุดที่วาด) เหลือตัวแรก", () => {
  const r = run({ points: [P("P1", 0, 0), P("CL (โค้ดเดิม)", 0, 0)] });
  eq(1, r.length, "จำนวน"); eq("P1", r[0].label, "ตัวที่เหลือ");
});

console.log("Tab วนเลือก");
test("Tab วนตามลำดับ / รายการเดิมจำตัวที่วนไว้ / รายการเปลี่ยนเริ่มใหม่", () => {
  const list = run({ mouse: { x: 0.05, y: 0 }, points: [p1, p2], segs: [short] });
  ok(list.length >= 3, "มีอย่างน้อย mid + end 2 จุด");
  let cyc = Snap.keep(list, null);
  eq(0, cyc.i, "เริ่ม");
  cyc = Snap.next(list, cyc); eq(1, cyc.i, "Tab 1");
  const again = run({ mouse: { x: 0.05, y: 0 }, points: [p1, p2], segs: [short] });
  eq(1, Snap.keep(again, cyc).i, "เมาส์ขยับแต่รายการเดิม");
  for (let k = 1; k < list.length; k++) cyc = Snap.next(list, cyc);
  eq(0, cyc.i, "วนกลับตัวแรก");
  const other = run({ mouse: { x: 0.02, y: 0 }, points: [p1, p2], segs: [short] });
  eq(0, Snap.keep(other, { sig: "x", i: 2 }).i, "รายการใหม่");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process === "object") process.exitCode = failed ? 1 : 0;
