// ทดสอบ Undo / Redo (makeHistory ใน SA.Web/wwwroot/js/history.js)
// รัน: node SA.Tests/js/history.test.js
// (ไม่มี node: รันใน console ของหน้าเว็บได้ด้วย globalThis.SA_LIB = { makeHistory } แล้ว eval ไฟล์นี้ในฟังก์ชัน)
"use strict";
const { makeHistory } = typeof require === "function" ? (() => {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  // history.js ส่วนล่างผูกกับหน้าเว็บ: ใช้เฉพาะ makeHistory (ตัดก่อนส่วน "เอกสารของหน้าเว็บ")
  const src = fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js/history.js"), "utf8").split("// ---------------- เอกสารของหน้าเว็บ")[0];
  const ctx = vm.createContext({ console });
  vm.runInContext(src + "\nthis.makeHistory = makeHistory;", ctx);
  return ctx;
})() : globalThis.SA_LIB;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };

// เอกสารจำลอง: doc.v = ค่าที่ผู้ใช้แก้, doc.cache = ค่าที่ไม่นับ (แบบตำแหน่งสำรองของจุดเกาะ)
function setup(){
  const doc = { v: 0, cache: 0 };
  const h = makeHistory(() => ({ full: JSON.stringify(doc), key: String(doc.v) }), full => { const d = JSON.parse(full); doc.v = d.v; doc.cache = d.cache; }, 3);
  h.reset();
  return { doc, h };
}

console.log("Undo / Redo");
test("1 การเปลี่ยน = 1 ก้อน พร้อมชื่อ / Undo / Redo / Redo หายเมื่อแก้ใหม่", () => {
  const { doc, h } = setup();
  h.act("ตั้งเป็น 1"); doc.v = 1; h.track();
  h.act("ตั้งเป็น 2"); doc.v = 2; h.track();
  eq("ตั้งเป็น 2", h.step(false), "ชื่อก้อนที่ undo"); eq(1, doc.v, "หลัง undo");
  eq("ตั้งเป็น 1", h.step(false), "undo ครั้งที่ 2"); eq(0, doc.v, "หลัง undo 2 ครั้ง");
  eq(null, h.step(false), "ไม่มีให้ undo");
  eq("ตั้งเป็น 1", h.step(true), "redo"); eq(1, doc.v, "หลัง redo");
  doc.v = 5; h.track();
  eq(0, h.size.redo, "แก้ใหม่แล้ว redo หาย");
});
test("ไม่เปลี่ยน = ไม่เก็บ และชื่อไม่ค้างไปการกระทำถัดไป", () => {
  const { doc, h } = setup();
  h.act("คลิกเฉยๆ"); eq(false, h.track(), "ไม่เปลี่ยน");
  doc.v = 1; h.track();
  eq("แก้ไข", h.step(false), "ชื่อ default");
});
test("ค่าที่ไม่นับ (cache) เปลี่ยน = ไม่เกิดก้อน undo", () => {
  const { doc, h } = setup();
  doc.cache = 99; eq(false, h.track(), "cache เปลี่ยน");
  eq(0, h.size.undo, "ไม่มีก้อน");
});
test("batch = ก้อนเดียว ชื่อของ batch (act ข้างในไม่ทับ)", () => {
  const { doc, h } = setup();
  h.batch("ลบ 3 ชิ้น", () => { for (let i = 1; i <= 3; i++){ h.act("ลบชิ้น " + i); doc.v = i; h.track(); } });
  eq(1, h.size.undo, "จำนวนก้อน");
  eq("ลบ 3 ชิ้น", h.step(false), "ชื่อ"); eq(0, doc.v, "ย้อนทั้งชุด");
});
test("rebase = เปลี่ยนแบบไม่นับ", () => {
  const { doc, h } = setup();
  doc.v = 1; h.rebase();
  eq(false, h.track(), "หลัง rebase ไม่มีอะไรเปลี่ยน");
  doc.v = 2; h.track(); h.step(false);
  eq(1, doc.v, "undo กลับไปที่ค่าหลัง rebase");
});
test("เก็บไม่เกิน limit (ตัวเก่าสุดหลุด)", () => {
  const { doc, h } = setup();
  for (let i = 1; i <= 5; i++){ doc.v = i; h.track(); }
  eq(3, h.size.undo, "จำนวน");
  h.step(false); h.step(false); h.step(false);
  eq(2, doc.v, "ย้อนได้ถึงค่าที่ 2");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process === "object") process.exitCode = failed ? 1 : 0;
