// ทดสอบช่วงซูม / ระยะ grid / ทศนิยมตามซูม (SA.Web/wwwroot/js/view.js)
// รัน: node SA.Tests/js/view.test.js
"use strict";
const View = require("../../SA.Web/wwwroot/js/view.js");

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };

console.log("ช่วงซูม");
test("ซูมเข้าได้ถึง 20000 px/m (1 ซม. = 200 px) และออกได้ถึง 0.5 px/m", () => {
  eq(20000, View.clampScale(1e9), "เกินบน"); eq(0.5, View.clampScale(0.01), "เกินล่าง");
  eq(1234, View.clampScale(1234), "ในช่วง");
  ok(0.01 * View.clampScale(1e9) >= 200, "1 ซม. ต้องได้อย่างน้อย 200 px");
});
test("ค่าเสียจาก project / localStorage กลับเป็นค่าเริ่มต้น", () => {
  eq(42, View.clampScale(undefined), "undefined"); eq(42, View.clampScale("abc"), "ข้อความ"); eq(42, View.clampScale(0), "ศูนย์");
});

console.log("grid");
test("ซูมเข้ามากสุด grid ลงไปถึงระดับมิลลิเมตร และห่างบนจอ ≥ 34 px ทุกระดับซูม", () => {
  eq(0.002, View.niceStep(20000), "20000 px/m");
  eq(0.001, View.niceStep(40000), "40000 px/m");
  for (const s of [0.5, 1, 4, 42, 800, 5000, 20000]) ok(View.niceStep(s) * s >= 34 || View.niceStep(s) === 5000, `ที่ ${s} px/m`);
  ok(View.niceStep(0.5) * 0.5 >= 34, "ซูมออกสุด");
});
test("ป้าย grid มีทศนิยมพอดีกับระยะ", () => {
  eq("100.005", View.gridLabel(100.005, 0.005), "0.005");
  eq("100.01", View.gridLabel(100.01, 0.01), "0.01 (ไม่มีศูนย์ท้าย)");
  eq("2.5", View.gridLabel(2.5, 0.5), "0.5");
  eq("20", View.gridLabel(20, 10), "10");
  eq("0.003", View.gridLabel(0.003 * 1, 0.001), "0.001");
  eq("0.3", View.gridLabel(3 * 0.1, 0.1), "ปัดเศษทศนิยม floating point (0.30000000000000004)");
});

console.log("ทศนิยมตามซูม / ล้อเมาส์");
test("พิกัดในแถบล่าง: 1 → 2 → 3 ตำแหน่งตามซูม", () => {
  eq("12.3", View.fmt(12.3456, 5), "ซูมออก"); eq("12.35", View.fmt(12.3456, 42), "ปกติ"); eq("12.346", View.fmt(12.3456, 2000), "ซูมเข้า");
  eq("0.000", View.fmt(-0.0001, 2000), "ไม่แสดง -0");
});
test("Shift + ล้อ = ซูมทีละน้อย และ Chrome ส่ง Shift+ล้อเป็น deltaX ก็ยังซูม", () => {
  const n = View.wheelFactor({ deltaY: -100 }), s = View.wheelFactor({ deltaY: 0, deltaX: -100, shiftKey: true });
  ok(n > 1 && s > 1, "หมุนขึ้น = ซูมเข้า");
  ok(s - 1 < (n - 1) / 2, "Shift ต้องละเอียดกว่า");
  ok(View.wheelFactor({ deltaY: 3, deltaMode: 1 }) < 1, "Firefox นับเป็นบรรทัด");
  ok(View.wheelFactor({ deltaY: 100000 }) > 0.6, "หมุนแรงมากไม่กระโดดเกิน");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
