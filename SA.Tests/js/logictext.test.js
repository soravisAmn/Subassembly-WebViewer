// ทดสอบมุมมองข้อความของรอบ 5 M4 (Logic.toText / Logic.diffText ใน logicops.js)
// รัน: node SA.Tests/js/logictext.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("logicops.js") + "\nthis.Expr = Expr; this.Spec = Spec; this.Logic = Logic;", ctx);
const { Spec, Logic } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const ok = (c, what) => { if (!c) throw new Error(what); };
const has = (text, line, what) => { if (!text.split("\n").some(l => l.trimEnd() === line || l.replace(/\s+/g, " ").trim() === line.replace(/\s+/g, " ").trim())) throw new Error(`${what}: ไม่มีบรรทัด "${line}"\n${text}`); };
const good = r => { if (!r.ok) throw new Error(r.error); return r; };
const clone = s => JSON.parse(JSON.stringify(s));
function demo(){
  const t = fs.readFileSync(path.join(__dirname, "../../tests-civil3d/round4-demo.cs"), "utf8");
  const m = /\/\/ sa-spec: (.*)/.exec(t);
  return m ? JSON.parse(m[1]) : JSON.parse(Buffer.from(/\/\/ sa-spec-b64: (.*)/.exec(t)[1].trim(), "base64").toString("utf8"));
}
const run = (s, y, values) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: [{ x: -30, y }, { x: 30, y }], extendEnds: true, layout: false });

console.log("มุมมองข้อความ (รอบ 5 M4)");

test("toText round4-demo: if / elif (ซ้อนในกิ่ง ไม่ใช่) / switch / กิ่งว่าง / เกิดเสมอ (aux) — โครงอย่างเดียว ไม่มี ← ตอนนี้", () => {
  const t = Logic.toText(demo());
  has(t, "Variables: (ไม่มี)", "ไม่มี variable");
  has(t, "  IsCut = ground(P2) > P2.y", "เงื่อนไข");
  has(t, "เกิดเสมอ: P1, P2, P5 (aux), P6, L1", "เกิดเสมอ");
  has(t, "ถ้า IsCut: [D1 ตัดหรือถม?]", "if");
  has(t, "    ตัด (B1): P3, L2, L4", "กิ่งใช่");
  has(t, "ไม่ใช่:", "else");
  has(t, "    ถ้า HighFill: [D2 ถมสูงไหม?]", "elif ย่อหน้า");
  has(t, "        ถมปกติ (B4): (ว่าง)", "กิ่งว่าง");
  has(t, "switch Curb: [D3 ขอบทาง]", "switch");
  has(t, "    อื่นๆ  ไม่มีขอบทาง (B6): (ว่าง)", "else ของ switch");
  ok(!/ตอนนี้/.test(t), "ไม่ส่งผล = ไม่มีค่า");
});

test("toText + ผลคำนวณ: ค่าเงื่อนไข / switch / กิ่งที่เกิด (ดินสูง = ตัด · ดินต่ำ = ถม)", () => {
  const s = demo();
  let t = Logic.toText(s, run(s, 2));
  has(t, "  IsCut = ground(P2) > P2.y ← ตอนนี้: จริง", "IsCut จริง");
  has(t, "    ตัด (B1): P3, L2, L4 ← เกิดตอนนี้", "ตัดเกิด");
  has(t, "switch Curb: [D3 ขอบทาง] ← ตอนนี้: 1", "ค่า switch");
  t = Logic.toText(s, run(s, -6));
  has(t, "    ถม (B2): P4, L3, L5 ← เกิดตอนนี้", "ถมเกิด");
  has(t, "        ถมสูง (B3): P7, L6 ← เกิดตอนนี้", "ถมสูงเกิด (HighFillH 1.5)");
});

test("toText: variable มี / ไม่มี rules + ค่าตามชนิดค่า · ซ้อน 3 ชั้น", () => {
  const s = Spec.newSpec("T");
  s.params.push({ name: "Depth", kind: "double", default: 1.5, displayName: "Depth", min: null, max: null }, { name: "K", kind: "long", default: 1, displayName: "K", min: null, max: null });
  good(Logic.addVariable(s, { name: "DepthUsed", unit: "length", expr: "Depth", rules: [{ when: "Depth < 2", value: "2", warn: "Depth = {Depth}" }, { when: "Depth > 9", value: "9" }] }));
  good(Logic.addVariable(s, { name: "Half", expr: "DepthUsed / 2" }));
  const a = good(Logic.addCondition(s, { name: "A", expr: "Depth > 0" }));
  const b = good(Logic.addCondition(s, { name: "Bb", expr: "Depth > 1", parentBranch: a.no }));
  good(Logic.addDecision(s, { kind: "switch", test: "K", cases: [{ value: 1 }], parentBranch: b.yes }));
  const t = Logic.toText(s, Spec.evaluate(s, { values: {}, codeParams: [], codePoints: [], surface: null, extendEnds: true, layout: true }));
  has(t, "  DepthUsed = ถ้า Depth < 2 → 2 (เตือน) · ไม่งั้นถ้า Depth > 9 → 9 · ไม่งั้น → Depth ← ตอนนี้: 2 m", "variable rules + หน่วย");
  has(t, "  Half = DepthUsed / 2 ← ตอนนี้: 1", "variable ไม่มี rules");
  has(t, "    ถ้า Bb: [D2]", "ชั้น 2");
  has(t, "        switch K: [D3] ← ตอนนี้: – (กิ่งแม่ไม่เกิด)", "ชั้น 3 (กิ่งแม่ ไม่ใช่ ไม่เกิด = ไม่ได้คำนวณ)");
  has(t, "            = 1  = 1 (B5): (ว่าง)", "case ชั้น 3");
});

test("diffText: เพิ่ม / แก้ / เปลี่ยนชื่อ / ลบ — variable, เงื่อนไข, decision (ย้าย / kind / ป้าย), กิ่ง, object ย้ายกิ่ง / เพิ่ม / ลบ, parameter", () => {
  const a = demo(), b = clone(a);
  good(Logic.addVariable(b, { name: "DepthUsed", expr: "Width", rules: [{ when: "Width < 2", value: "2", warn: "W = {Width}" }] }));
  good(Logic.setBranch(b, ["P6"], "B3"));
  good(Logic.renameBranch(b, "B1", "ช่วงตัด"));
  good(Logic.addCase(b, "D3", { value: 2, label: "ขอบสูง" }));
  good(Logic.editCondition(b, "IsCut", { expr: "ground(P2) > P2.y + 0.1" }));
  good(Logic.renameCondition(b, "HighFill", "FillHigh"));
  good(Logic.moveDecision(b, "D3", "B1"));
  good(Logic.editDecision(b, "D3", { label: "ขอบ" }));
  good(Logic.setParamBounds(b, "Width", { max: 9 }));
  Spec.addPoint(b, { type: "delta", from: "P1", dx: "1", dy: "0" }, []);
  const d = Logic.diffText(a, b);
  has(d, "+ variable DepthUsed = ถ้า Width < 2 → 2 (เตือน) · ไม่งั้น → Width", "variable");
  has(d, "~ เงื่อนไข IsCut: ground(P2) > P2.y → ground(P2) > P2.y + 0.1", "แก้นิพจน์");
  has(d, "~ เงื่อนไข HighFill เปลี่ยนชื่อเป็น FillHigh", "เปลี่ยนชื่อ");
  has(d, "~ decision D2: HighFill → FillHigh", "test ตามชื่อ");
  has(d, "~ decision D3 ป้าย: ขอบทาง → ขอบ", "ป้าย");
  has(d, "~ decision D3 ย้าย: ระดับบนสุด → ในกิ่ง ช่วงตัด (B1)", "ย้าย decision");
  has(d, "+ กิ่ง ขอบสูง (B7) = 2 ของ D3", "กิ่งใหม่");
  has(d, "~ กิ่ง B1 ชื่อ: ตัด → ช่วงตัด", "ชื่อกิ่ง");
  has(d, "~ P6: เกิดเสมอ → ถมสูง (B3)", "object ย้ายกิ่ง");
  has(d, "+ object P9", "object ใหม่");
  has(d, "~ parameter Width: max 9 → 9".replace("max 9 → 9", "max null → 9"), "parameter");
  const c = clone(b);
  good(Logic.removeDecision(c, "D3", { how: "always" })); good(Logic.removeVariable(c, "DepthUsed"));
  const d2 = Logic.diffText(b, c);
  has(d2, "- decision D3 \"ขอบ\" (และกิ่งของมัน)", "ลบ decision");
  has(d2, "- variable DepthUsed", "ลบ variable");
  has(d2, "~ P8, L7: = 1 (B5)".replace(": = 1 (B5)", ": มีขอบทาง (B5) → เกิดเสมอ"), "object ออกจากกิ่งที่ลบ");
  const e = clone(a); good(Logic.editDecision(e, "D1", { kind: "switch", test: "Curb" }));
  const d3 = Logic.diffText(a, e);
  has(d3, "~ decision D1: if → switch", "kind"); has(d3, "~ กิ่ง B1 case: ใช่ → = 1", "case");
});

test("diffText: ไม่เปลี่ยน = (ไม่มีอะไรเปลี่ยน) · spec ไม่มี logic ก็ได้", () => {
  const a = demo();
  ok(Logic.diffText(a, clone(a)) === "(ไม่มีอะไรเปลี่ยน)", "ไม่เปลี่ยน");
  const s = Spec.newSpec("X"), t = clone(s); good(Logic.addCondition(t, { name: "A", expr: "true" }));
  const d = Logic.diffText(s, t);
  has(d, "+ เงื่อนไข A = true", "เงื่อนไขแรก"); has(d, "+ decision D1 \"A\" (if A) → กิ่ง A (B1) / ไม่ A (B2)", "decision แรก");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
