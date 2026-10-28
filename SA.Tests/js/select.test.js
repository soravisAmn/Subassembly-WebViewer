// ทดสอบการคลุมเลือก Window / Crossing และการรวมชุดที่เลือก (SA.Web/wwwroot/js/select.js)
// รัน: node SA.Tests/js/select.test.js
// (ไม่มี node: รันใน console ของหน้าเว็บได้ด้วย globalThis.SA_LIB = { Select } แล้ว eval ไฟล์นี้ในฟังก์ชัน)
"use strict";
const { Select } = typeof require === "function" ? (() => {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js/select.js"), "utf8") + "\nthis.Select = Select;", ctx);
  return ctx;
})() : globalThis.SA_LIB;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };

// กรอบ 0..100 (px) · object ทดสอบ: จุดใน / จุดนอก / เส้นในทั้งเส้น / เส้นพาดผ่านกรอบ / เส้นข้างนอก / รูปปิดคลุมกรอบ
const B = Select.box(100, 100, 0, 0);
const pt = (id, x, y) => ({ sel: { type: "dpt", item: "a", id }, geoms: [{ pts: [{ x, y }] }] });
const ln = (id, ...p) => ({ sel: { type: "dlink", item: "a", id }, geoms: [{ pts: p.map(([x, y]) => ({ x, y })) }] });
const sh = (id, ...p) => ({ sel: { type: "dshape", item: "a", id }, geoms: [{ pts: p.map(([x, y]) => ({ x, y })), closed: true }] });
const objs = [
  pt("Pin", 50, 50), pt("Pout", 150, 50),
  ln("Lin", [10, 10], [90, 90]), ln("Lcross", [-50, 50], [150, 50]), ln("Lout", [120, 0], [120, 100]),
  sh("Sbig", [-50, -50], [150, -50], [150, 150], [-50, 150]), sh("Sin", [20, 20], [80, 20], [50, 80])
];
const ids = list => list.map(s => s.id).join(",");

console.log("Window / Crossing");
test("ทิศการลาก: ซ้าย→ขวา = Window, ขวา→ซ้าย = Crossing", () => {
  eq("window", Select.mode(10, 200), "ไปขวา");
  eq("crossing", Select.mode(200, 10), "ไปซ้าย");
  eq(0, B.l, "box ปรับให้ซ้าย < ขวา"); eq(100, B.b, "บน < ล่าง");
});
test("Window เลือกเฉพาะที่อยู่ในกรอบทั้งตัว", () => {
  eq("Pin,Lin,Sin", ids(Select.pick(objs, B, false)), "ที่เลือก");
});
test("Crossing เลือกที่แตะกรอบ (เส้นพาดผ่าน, รูปปิดที่คลุมกรอบ)", () => {
  eq("Pin,Lin,Lcross,Sbig,Sin", ids(Select.pick(objs, B, true)), "ที่เลือก");
});
test("subassembly ทั้งตัว (หลาย geom): Window ต้องอยู่ในทั้งหมด, Crossing แตะอันเดียวพอ", () => {
  const item = { sel: { type: "item", item: "s1" }, geoms: [{ pts: [{ x: 50, y: 50 }] }, { pts: [{ x: 50, y: 50 }, { x: 300, y: 50 }] }] };
  eq(0, Select.pick([item], B, false).length, "Window");
  eq(1, Select.pick([item], B, true).length, "Crossing");
});

console.log("ชุดที่เลือก");
test("เพิ่มไม่ซ้ำ / Shift เอาออก / เอาออกตัวที่ไม่มี = ไม่เปลี่ยน", () => {
  const a = { type: "dpt", item: "a", id: "P1" }, b = { type: "dlink", item: "a", id: "L1" }, c = { type: "item", item: "s1" };
  let l = Select.merge([], [a, b]);
  l = Select.merge(l, [a, c]);
  eq("dpt|a|P1,dlink|a|L1,item|s1|", l.map(Select.key).join(","), "เพิ่ม");
  l = Select.merge(l, [b], true);
  eq("dpt|a|P1,item|s1|", l.map(Select.key).join(","), "เอาออก");
  eq(2, Select.merge(l, [{ type: "dpt", item: "a", id: "P9" }], true).length, "เอาออกตัวที่ไม่มี");
});
test("จุด P1 กับ link L1 ของ subassembly ต่างตัว = คนละชิ้น", () => {
  const l = Select.merge([], [{ type: "dpt", item: "a", id: "P1" }, { type: "dpt", item: "b", id: "P1" }]);
  eq(2, l.length, "จำนวน");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process === "object") process.exitCode = failed ? 1 : 0;
