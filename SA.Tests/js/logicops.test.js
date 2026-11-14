// ทดสอบ Logic API ของรอบ 5 M1 (js/logicops.js) — ทุกฟังก์ชัน กรณีปกติ + error · error แล้ว spec ต้องไม่เปลี่ยนเลย
// รัน: node SA.Tests/js/logicops.test.js
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
const eq = (exp, act, what) => { const a = JSON.stringify(act), b = JSON.stringify(exp); if (a !== b) throw new Error(`${what}: คาด ${b} ได้ ${a}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const good = (r, what) => { if (!r || r.ok !== true) throw new Error(`${what}: ${r && r.error}`); return r; };
// error + spec ไม่เปลี่ยนแม้แต่ตัวเดียว
function bad(s, fn, re, what){
  const before = JSON.stringify(s);
  const r = fn();
  if (!r || r.ok !== false) throw new Error(`${what}: ต้อง error แต่ได้ ${JSON.stringify(r)}`);
  if (typeof r.error !== "string" || !r.error) throw new Error(`${what}: ไม่มีข้อความ error`);
  if (re && !re.test(r.error)) throw new Error(`${what}: ข้อความ "${r.error}" ไม่ตรง ${re}`);
  if (JSON.stringify(s) !== before) throw new Error(`${what}: error แล้ว spec เปลี่ยน`);
}
// round4-demo จริง (IsCut / HighFill ซ้อนในกิ่งถม / switch Curb)
function demo(){
  const t = fs.readFileSync(path.join(__dirname, "../../tests-civil3d/round4-demo.cs"), "utf8");
  const m = /\/\/ sa-spec: (.*)/.exec(t);
  return m ? JSON.parse(m[1]) : JSON.parse(Buffer.from(/\/\/ sa-spec-b64: (.*)/.exec(t)[1].trim(), "base64").toString("utf8"));
}
// ผิวดินราบที่ระดับ y (เทียบ origin)
const run = (s, y, values) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: y == null ? null : [{ x: -40, y }, { x: 40, y }], extendEnds: true, layout: y == null });
const on = (r, id) => !(r.pts[id] || r.links[id] || r.shapes[id] || {}).off;
function base(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Width", kind: "double", default: 3 }, { name: "Kind", kind: "long", default: 1 });
  Spec.addPoint(s, { type: "delta", from: "P1", dx: "Width", dy: "0" }, ["Shoulder"]);      // P2
  Spec.addPoint(s, { type: "delta", from: "P2", dx: "2", dy: "-1" }, ["A"]);               // P3
  Spec.addPoint(s, { type: "delta", from: "P2", dx: "2", dy: "1" }, ["B"]);                // P4
  Spec.addLink(s, "P1", "P2", { points: ["P1", "P2"] });                                  // L1
  Spec.addLink(s, "P2", "P3", { points: ["P2", "P3"] });                                  // L2
  return s;
}

console.log("Logic API (รอบ 5 M1)");

test("addCondition: ได้เงื่อนไข + decision if + กิ่ง ใช่ / ไม่ใช่ · ชื่อเริ่มต้น Cond1 · object เดิมของ spec ตัวเดิม", () => {
  const s = base(), same = s;
  const r = good(Logic.addCondition(s, { expr: "ground(P2) > P2.y" }), "add");
  eq("Cond1", r.name, "ชื่อเริ่ม"); ok(s === same && s.logic.conditions.length === 1, "spec ตัวเดิม");
  eq(["C1", "D1", "B1", "B2"], [r.cond, r.decision, r.yes, r.no], "id");
  eq({ id: "D1", parent: null, kind: "if", test: "Cond1", label: "Cond1" }, s.logic.decisions[0], "decision");
  const r2 = good(Logic.addCondition(s, { name: "High", expr: "P2.y - ground(P2) > 2", parentBranch: r.no, label: "สูงไหม?" }), "elif");
  eq("B2", s.logic.decisions.find(d => d.id === r2.decision).parent, "elif อยู่ในกิ่ง ไม่ใช่");
  const r3 = good(Logic.addCondition(s, { name: "Flag", expr: "Width > 2", decision: false }), "เงื่อนไขเปล่า");
  ok(!r3.decision && s.logic.decisions.length === 2, "ไม่สร้าง decision");
});

test("addCondition error: ชื่อซ้ำ / คำสงวน / ชื่อแบบ P1 / นิพจน์ไม่ใช่ bool / จุดไม่มี / กิ่งไม่มี — spec ไม่เปลี่ยน", () => {
  const s = base();
  good(Logic.addCondition(s, { name: "IsCut", expr: "true" }), "ตัวแรก");
  bad(s, () => Logic.addCondition(s, { name: "IsCut", expr: "true" }), /มีชื่อ IsCut/, "ซ้ำเงื่อนไข");
  bad(s, () => Logic.addCondition(s, { name: "Width", expr: "true" }), /มีชื่อ Width/, "ซ้ำ parameter");
  bad(s, () => Logic.addCondition(s, { name: "F", expr: "true" }), /โค้ดที่สร้างใช้/, "F");
  bad(s, () => Logic.addCondition(s, { name: "D7", expr: "true" }), /โค้ดที่สร้างใช้/, "D7");
  bad(s, () => Logic.addCondition(s, { name: "and", expr: "true" }), /คำ \/ ฟังก์ชัน/, "and");
  bad(s, () => Logic.addCondition(s, { name: "1x", expr: "true" }), /ใช้ไม่ได้/, "ขึ้นต้นตัวเลข");
  bad(s, () => Logic.addCondition(s, { name: "N", expr: "Width + 1" }), /จริง ?\/ ?เท็จ/, "ชนิด num");
  bad(s, () => Logic.addCondition(s, { name: "N", expr: "P9.y > 0" }), /P9/, "จุดไม่มี");
  bad(s, () => Logic.addCondition(s, { name: "N", expr: "" }), /ว่าง/, "ว่าง");
  bad(s, () => Logic.addCondition(s, { name: "N", expr: "true", parentBranch: "B99" }), /ไม่มีกิ่ง B99/, "กิ่งไม่มี");
});

test("editCondition / renameCondition: แก้นิพจน์ · ชื่อใหม่ตามไปทุกที่ (test, นิพจน์อื่น) · วนกัน = error", () => {
  const s = base();
  good(Logic.addCondition(s, { name: "A", expr: "Width > 1" }), "A");
  good(Logic.addCondition(s, { name: "Bb", expr: "A and Width < 9", decision: false }), "Bb");
  good(Logic.editCondition(s, "A", { expr: "Width > 2", note: "กว้าง" }), "edit");
  eq("Width > 2", s.logic.conditions[0].expr, "expr"); eq("กว้าง", s.logic.conditions[0].note, "note");
  bad(s, () => Logic.editCondition(s, "A", { expr: "Width" }), /จริง ?\/ ?เท็จ/, "ชนิดผิด");
  bad(s, () => Logic.editCondition(s, "A", { expr: "Bb" }), /เป็นวง: A → Bb → A/, "วนกัน");
  bad(s, () => Logic.editCondition(s, "Zz", { expr: "true" }), /ไม่มีเงื่อนไข Zz/, "ไม่มี");
  good(Logic.renameCondition(s, "A", "Wide"), "rename");
  eq("Wide", s.logic.decisions[0].test, "test ตาม"); eq("Wide and Width < 9", s.logic.conditions[1].expr, "นิพจน์ตาม");
  bad(s, () => Logic.renameCondition(s, "Wide", "Bb"), /มีชื่อ Bb/, "ชื่อซ้ำ");
  good(Logic.renameCondition(s, "Wide", "Wide"), "ชื่อเดิม = ไม่ทำอะไร");
});

test("removeCondition: decision ที่ใช้ลบตาม how · ยังมีนิพจน์อื่นใช้ = error บอกรายการ", () => {
  const s = base();
  const r = good(Logic.addCondition(s, { name: "A", expr: "Width > 1" }), "A");
  good(Logic.setBranch(s, ["P3", "L2"], r.yes), "เข้ากิ่ง");
  good(Logic.addCondition(s, { name: "Bb", expr: "not A", decision: false }), "Bb ใช้ A");
  bad(s, () => Logic.removeCondition(s, "A"), /ยังใช้อยู่ใน Bb/, "ยังมีคนใช้");
  bad(s, () => Logic.removeCondition(s, "Bb", { how: "แปลก" }), /how/, "how ผิด");
  good(Logic.removeCondition(s, "Bb"), "ลบ Bb");
  const x = good(Logic.removeCondition(s, "A", { how: "always" }), "ลบ A");
  eq([], s.logic.conditions, "เงื่อนไขหมด"); eq([], s.logic.decisions, "decision หมด");
  ok(!s.points.find(p => p.id === "P3").branch && x.touched.includes("P3"), "P3 เกิดเสมอ");
});

test("addDecision: if (นิพจน์ตรงๆ) / switch + cases + else ท้าย · error: case ซ้ำ, ชนิด test, kind", () => {
  const s = base();
  const a = good(Logic.addDecision(s, { kind: "if", test: "Width > 2", label: "กว้าง?" }), "if");
  eq(2, a.branches.length, "if 2 กิ่ง");
  const w = good(Logic.addDecision(s, { kind: "switch", test: "Kind", cases: [{ value: 1, label: "หิน" }, { value: "2" }] }), "switch");
  eq([1, 2, "else"], s.logic.branches.filter(b => b.decision === w.decision).map(b => b.case), "case + else");
  eq("= 2", s.logic.branches.find(b => b.decision === w.decision && b.case === 2).label, "label เริ่ม");
  bad(s, () => Logic.addDecision(s, { kind: "switch", test: "Kind", cases: [{ value: 1 }, { value: 1.0 }] }), /ซ้ำ/, "case ซ้ำ");
  bad(s, () => Logic.addDecision(s, { kind: "switch", test: "Kind", cases: [{ value: "x" }] }), /ตัวเลข/, "case ไม่ใช่เลข");
  bad(s, () => Logic.addDecision(s, { kind: "switch", test: "Width > 1" }), /ตัวเลข/, "switch test bool");
  bad(s, () => Logic.addDecision(s, { kind: "if", test: "Width" }), /จริง ?\/ ?เท็จ/, "if test num");
  bad(s, () => Logic.addDecision(s, { kind: "while", test: "true" }), /kind/, "kind ผิด");
});

test("editDecision: if → switch (ใช่ = case 1, ไม่ใช่ = else) · switch 1 case → if · หลาย case → if = error", () => {
  const s = base();
  const a = good(Logic.addDecision(s, { kind: "if", test: "Width > 2" }), "if");
  good(Logic.editDecision(s, a.decision, { kind: "switch", test: "Kind", label: "ชนิด" }), "→ switch");
  eq([1, "else"], s.logic.branches.filter(b => b.decision === a.decision).map(b => b.case), "แปลงกิ่ง");
  bad(s, () => Logic.editDecision(s, a.decision, { test: "Width > 1" }), /ตัวเลข/, "test ไม่ตรง kind");
  good(Logic.editDecision(s, a.decision, { kind: "if", test: "Width > 1" }), "→ if");
  eq([true, false], s.logic.branches.filter(b => b.decision === a.decision).map(b => b.case), "กลับเป็น if");
  const w = good(Logic.addDecision(s, { kind: "switch", test: "Kind", cases: [{ value: 1 }, { value: 2 }] }), "switch 2 case");
  bad(s, () => Logic.editDecision(s, w.decision, { kind: "if", test: "true" }), /2 case/, "หลาย case");
  bad(s, () => Logic.editDecision(s, "D99", { label: "x" }), /ไม่มี decision D99/, "ไม่มี");
});

test("removeDecision 3 แบบบน round4-demo: parent (กิ่งแม่) · always (เกิดเสมอ) · remove (ลบ object)", () => {
  // D2 (HighFill) ซ้อนในกิ่ง ถม B2 · P7 / L6 อยู่ในกิ่ง ถมสูง B3
  let s = demo(); good(Logic.removeDecision(s, "D2", { how: "parent" }), "parent");
  eq("B2", s.points.find(p => p.id === "P7").branch, "P7 → กิ่งแม่ ถม");
  ok(!s.logic.conditions.some(c => c.name === "HighFill"), "เงื่อนไขที่ไม่มีใครใช้หายตาม");
  s = demo(); good(Logic.removeDecision(s, "D2", { how: "always" }), "always");
  ok(!s.points.find(p => p.id === "P7").branch && !s.links.find(l => l.id === "L6").branch, "เกิดเสมอ");
  s = demo(); good(Logic.removeDecision(s, "D1", { how: "remove" }), "remove D1 (มี D2 ซ้อน)");
  ok(!s.points.some(p => ["P3", "P4", "P7"].includes(p.id)), "object ในกิ่งถูกลบ");
  eq(["D3"], s.logic.decisions.map(d => d.id), "เหลือ switch");
  const d = demo(); bad(d, () => Logic.removeDecision(d, "D2", { how: "ทิ้ง" }), /how/, "how ผิด");
});

test("moveDecision: ย้ายเข้ากิ่งอื่น = elif · ย้ายเข้ากิ่งตัวเอง / ที่ซ้อนอยู่ข้างใน = error · null = ระดับบนสุด", () => {
  const s = demo();
  good(Logic.moveDecision(s, "D3", "B2"), "switch ไปอยู่ในกิ่ง ถม");
  eq("B2", s.logic.decisions.find(d => d.id === "D3").parent, "parent");
  bad(s, () => Logic.moveDecision(s, "D1", "B3"), /ของตัวเอง/, "B3 อยู่ใน D2 ใน D1");
  bad(s, () => Logic.moveDecision(s, "D1", "B1"), /ของตัวเอง/, "กิ่งตัวเอง");
  bad(s, () => Logic.moveDecision(s, "D1", "B77"), /ไม่มีกิ่ง/, "กิ่งไม่มี");
  const r = good(Logic.moveDecision(s, "D2", null), "ออกมาบนสุด");
  ok(Array.isArray(r.warnings), "คืน warnings");
});

test("case: เพิ่ม (แทรกก่อน else) · แก้ · เรียง · ลบ 3 แบบ · else แก้ / ลบ / ย้ายไม่ได้ · ค่าซ้ำ", () => {
  const s = demo();   // D3 switch Curb: B5 = 1, B6 = else
  const a = good(Logic.addCase(s, "D3", { value: 2, label: "ขอบสูง" }), "add");
  eq([1, 2, "else"], s.logic.branches.filter(b => b.decision === "D3").map(b => b.case), "แทรกก่อน else");
  bad(s, () => Logic.addCase(s, "D3", { value: 1 }), /ซ้ำ/, "ซ้ำ");
  bad(s, () => Logic.addCase(s, "D1", { value: 3 }), /ไม่ใช่ switch/, "ไม่ใช่ switch");
  good(Logic.editCase(s, a.branch, { value: 3, label: "ขอบ 3" }), "edit");
  bad(s, () => Logic.editCase(s, a.branch, { value: 1 }), /ซ้ำ/, "แก้ให้ซ้ำ");
  bad(s, () => Logic.editCase(s, "B6", { value: 5 }), /else/, "else ไม่มีค่า");
  good(Logic.editCase(s, "B6", { label: "ไม่มีขอบ" }), "else เปลี่ยนชื่อได้");
  good(Logic.moveCase(s, a.branch, 0), "move");
  eq([3, 1, "else"], s.logic.branches.filter(b => b.decision === "D3").map(b => b.case), "เรียงใหม่ else ท้าย");
  bad(s, () => Logic.moveCase(s, "B6", 0), /ท้ายเสมอ/, "ย้าย else");
  bad(s, () => Logic.removeCase(s, "B6"), /else/, "ลบ else");
  // B5 (= 1) มี P8 / L7: always = เกิดเสมอ · remove = ลบ
  const t = demo(); good(Logic.removeCase(t, "B5", { how: "always" }), "always"); ok(!t.points.find(p => p.id === "P8").branch, "P8 เกิดเสมอ");
  const u = demo(); good(Logic.removeCase(u, "B5", { how: "remove" }), "remove"); ok(!u.points.some(p => p.id === "P8") && !u.links.some(l => l.id === "L7"), "ลบ P8 L7");
  eq(["B6"], u.logic.branches.filter(b => b.decision === "D3").map(b => b.id), "เหลือ else");
});

test("renameBranch / setBranch: ย้าย object เข้า / ออกกิ่ง · กลุ่มหมุนทั้งกลุ่ม · warnings branchRisks · error", () => {
  const s = demo();
  good(Logic.renameBranch(s, "B1", "ช่วงตัด"), "rename"); eq("ช่วงตัด", s.logic.branches.find(b => b.id === "B1").label, "label");
  bad(s, () => Logic.renameBranch(s, "B1", "  "), /ว่าง/, "ชื่อว่าง");
  bad(s, () => Logic.renameBranch(s, "B9", "x"), /ไม่มีกิ่ง/, "ไม่มี");
  // P6 (Ditch เกิดเสมอ) อ้างผ่านกิ่ง? ย้าย P3 ไปกิ่ง ถม = P3 อ้าง P2 (เกิดเสมอ) ไม่เสี่ยง แต่ L2 (กิ่งตัด) อ้าง P3 → เสี่ยง
  const r = good(Logic.setBranch(s, ["P3"], "B2"), "P3 → ถม");
  eq(["P3"], r.moved, "moved"); eq("B2", s.points.find(p => p.id === "P3").branch, "branch");
  ok(Spec.branchRisks(s).some(x => x.id === "L2"), "L2 เสี่ยงหลังย้าย");
  good(Logic.setBranch(s, ["P3", "L2"], null), "เกิดเสมอ");
  ok(!s.points.find(p => p.id === "P3").branch && !s.links.find(l => l.id === "L2").branch, "ออกจากกิ่ง");
  bad(s, () => Logic.setBranch(s, ["P3", "P99"], "B1"), /ไม่มี object P99/, "id ไม่มี (ทั้งชุดไม่เปลี่ยน)");
  bad(s, () => Logic.setBranch(s, ["P3"], "B99"), /ไม่มีกิ่ง/, "กิ่งไม่มี");
  const g = base(); g.rotations = [{ id: "R1", pivot: "P2", angle: "10", points: ["P3", "P4"] }];
  const k = good(Logic.addCondition(g, { name: "A", expr: "true" }), "A");
  eq(["P3", "P4"], good(Logic.setBranch(g, ["R1"], k.yes), "R1").moved, "สมาชิกกลุ่มหมุน");
});

test("ผลคำนวณหลังแก้ด้วย API = เหมือนแก้มือ (round4-demo: ย้ายกิ่ง / switch case ใหม่ เกิดตามค่า)", () => {
  const s = demo();
  // ผิวดินสูง (+2) = ตัด: P3 เกิด P4 ไม่เกิด · Curb = 1 → P8 เกิด
  let r = run(s, 2);
  ok(on(r, "P3") && !on(r, "P4") && on(r, "P8"), "ก่อนแก้");
  const a = good(Logic.addCase(s, "D3", { value: 2 }), "case 2");
  good(Logic.setBranch(s, ["P8", "L7"], a.branch), "P8 L7 → case 2");
  r = run(s, 2, { Curb: 1 }); ok(!on(r, "P8"), "Curb = 1 → ไม่เกิด");
  r = run(s, 2, { Curb: 2 }); ok(on(r, "P8") && on(r, "L7"), "Curb = 2 → เกิด");
});

test("ห่อฟังก์ชันรอบ 4c: error ของตัวเดิม → { ok: false } + spec ไม่เปลี่ยน · สำเร็จ = ผลเดิม + ok", () => {
  const s = base();
  bad(s, () => Logic.addExtendToGround(s, "L2", "P9", {}), /P9/, "ปลายไม่ใช่ของเส้น");
  const e = good(Logic.addExtendToGround(s, "L2", "P3", { rewire: false }), "extend");
  ok(e.point && e.link && e.tip, "ผล extend");
  bad(s, () => Logic.setParamBounds(s, "Width", { min: 5, max: 1 }), /มากกว่า/, "ขั้นต่ำ > ขั้นสูง");
  good(Logic.setParamUnit(s, "Width", "length"), "unit"); eq("length", s.params.find(p => p.name === "Width").unit, "unit ตั้งแล้ว");
  bad(s, () => Logic.setParamUnit(s, "Width", "deg"), /ชนิดค่า/, "unit ผิด");
  const c = good(Logic.addCutFill(s, { hinge: "P2", cut: 1.5, fill: 2, params: true, dir: 1 }), "cutfill");
  ok(c.cut && c.fill && c.daylight, "ผล cutfill");
  bad(s, () => Logic.addCutFill(s, { hinge: "P42" }), /P42/, "บานพับไม่มี");
  bad(s, () => Logic.updateArray(s, "A9", { dx: "1" }), /ไม่มี Array A9/, "Array ไม่มี");
});

test("describe: โครง + ค่าตอนนี้ (round4-demo) — เงื่อนไข / decision / กิ่ง / object / เกิดเสมอ", () => {
  const s = demo(), d0 = Logic.describe(s);
  eq(["IsCut", "HighFill"], d0.conditions.map(c => c.name), "เงื่อนไข");
  ok(!("value" in d0.conditions[0]), "ไม่ส่งผลคำนวณ = ไม่มีค่า");
  const D3 = d0.decisions.find(d => d.id === "D3");
  eq({ kind: "switch", test: "Curb" }, { kind: D3.kind, test: D3.test }, "switch");
  eq(["P8", "L7"], D3.branches[0].objects, "object ในกิ่ง");
  ok(d0.always.points.includes("P1") && !d0.always.points.includes("P3"), "เกิดเสมอ");
  const d1 = Logic.describe(s, run(s, 2));
  eq(true, d1.conditions[0].value, "IsCut ตอนนี้"); eq(1, d1.decisions.find(d => d.id === "D3").value, "Curb ตอนนี้");
  ok(JSON.stringify(d1).length < 4000, "สั้นพอให้ AI อ่าน");
});

test("setClassName (รอบ 7, หน้าต่าง Build): เปลี่ยนชื่อ class / namespace + ชื่อที่ใช้ไม่ได้ = error ไม่แก้ spec", () => {
  const s = Spec.newSpec("Body");
  const r = good(Logic.setClassName(s, { className: "RockBody", namespace: "Soravis.SA" }), "เปลี่ยนทั้งคู่");
  eq({ className: "RockBody", namespace: "Soravis.SA" }, r.result, "ผล");
  eq("RockBody", s.className, "className");
  eq("Soravis.SA", s.namespace, "namespace");
  good(Logic.setClassName(s, { className: "Rock_2" }), "เฉพาะ class");
  eq("Soravis.SA", s.namespace, "namespace คงเดิม");
  eq("TestSubassembly", good(Logic.setClassName(Spec.newSpec("X"), { className: "Y" }), "ไม่มี namespace").result.namespace, "namespace เริ่มต้น");
  bad(s, () => Logic.setClassName(s, { className: "2abc" }), /not valid/, "ขึ้นต้นด้วยเลข");
  bad(s, () => Logic.setClassName(s, { className: "my-class" }), /not valid/, "มี -");
  bad(s, () => Logic.setClassName(s, { className: "class" }), /not valid/, "keyword");
  bad(s, () => Logic.setClassName(s, { className: "ถนน" }), /not valid/, "ภาษาไทย");
  bad(s, () => Logic.setClassName(s, { className: "SaDrawing_X" }), /reserved/, "ชื่อ helper");
  bad(s, () => Logic.setClassName(s, { namespace: "A..B" }), /Namespace/, "namespace ว่างตรงกลาง");
  bad(s, () => Logic.setClassName(s, { namespace: "A.namespace" }), /Namespace/, "namespace keyword");
  bad(s, () => Logic.setClassName(s, {}), /className/, "ไม่ได้ให้อะไร");
  good(Logic.applyBatch(s, [{ fn: "setClassName", args: [{ className: "Rock_3" }] }]), "ผ่าน applyBatch");
  eq("Rock_3", s.className, "applyBatch");
});

test("setParamInfo (รอบ 7, .atc): คำอธิบาย + ตัวเลือกของ long · ลบได้ · double มีตัวเลือกไม่ได้ · ค่าซ้ำ = error", () => {
  const s = Spec.newSpec("Body");
  good(Logic.addParam(s, { name: "Width", default: 3.5 }), "เพิ่ม Width");
  good(Logic.addParam(s, { name: "Mode", kind: "long", default: 2 }), "เพิ่ม Mode");
  const r = good(Logic.setParamInfo(s, "Width", { description: "  ความกว้าง\n ช่องจราจร " }), "คำอธิบาย");
  eq("ความกว้าง ช่องจราจร", s.params[1].description, "ช่องว่างหลายตัว / ขึ้นบรรทัด = ช่องเดียว");
  eq({ description: "ความกว้าง ช่องจราจร", options: null }, r.result, "ผล");
  good(Logic.setParamInfo(s, "Width", { description: "" }), "ลบคำอธิบาย");
  ok(!("description" in s.params[1]), "ไม่มี field ค้าง");
  const m = good(Logic.setParamInfo(s, "Mode", { options: [{ value: 1, label: "Cut" }, { value: 2, label: "Fill" }] }), "ตัวเลือก");
  eq([{ value: 1, label: "Cut" }, { value: 2, label: "Fill" }], s.params[2].options, "options");
  ok(!m.warnings, "default 2 อยู่ในตัวเลือก");
  const w = good(Logic.setParamInfo(s, "Mode", { options: [{ value: 5, label: "X" }] }), "default ไม่อยู่ในตัวเลือก");
  ok(w.warnings && /not one of the options/.test(w.warnings[0]), "เตือน default");
  good(Logic.setParamInfo(s, "Mode", { options: null }), "ลบตัวเลือก");
  ok(!("options" in s.params[2]), "ไม่มี options ค้าง");
  bad(s, () => Logic.setParamInfo(s, "Width", { options: [{ value: 0, label: "A" }] }), /long/, "double มีตัวเลือกไม่ได้");
  bad(s, () => Logic.setParamInfo(s, "Mode", { options: [{ value: 0, label: "A" }, { value: 0, label: "B" }] }), /twice/, "ค่าซ้ำ");
  bad(s, () => Logic.setParamInfo(s, "Mode", { options: [{ value: 0, label: "A" }, { value: 1, label: "a" }] }), /twice/, "ชื่อซ้ำ (ตัวพิมพ์)");
  bad(s, () => Logic.setParamInfo(s, "Mode", { options: [{ value: 0.5, label: "A" }] }), /whole number/, "ไม่ใช่จำนวนเต็ม");
  bad(s, () => Logic.setParamInfo(s, "Mode", { options: [{ value: 1, label: " " }] }), /label/, "ไม่มีชื่อ");
  bad(s, () => Logic.setParamInfo(s, "Nope", { description: "x" }), /No parameter/, "ไม่มี parameter");
  good(Logic.applyBatch(s, [{ fn: "setParamInfo", args: ["Width", { description: "w" }] }]), "applyBatch");
  eq("w", s.params[1].description, "applyBatch ได้ผล");
});

test("ตัวเลือก: parseOptions / optionsText / paramOptions (Side = Right / Left เมื่อไม่ได้ตั้ง) · spec เก่าไม่มี field ใหม่ใช้ได้", () => {
  eq({ ok: true, options: [{ value: 0, label: "Right" }, { value: 1, label: "Left ซ้าย" }] }, Spec.parseOptions(" 0=Right, 1 : Left ซ้าย "), "อ่าน");
  eq({ ok: true, options: null }, Spec.parseOptions("  "), "ว่าง");
  ok(!Spec.parseOptions("Right").ok, "ไม่มีเลข = error");
  eq("0=Right, 1=Left", Spec.optionsText(Spec.SIDE_OPTIONS), "ข้อความ");
  const s = Spec.newSpec("X");
  eq(Spec.SIDE_OPTIONS, Spec.paramOptions(s, s.params[0]), "Side ค่าเริ่มต้น");
  good(Logic.setParamInfo(s, "Side", { options: [{ value: 0, label: "R" }, { value: 1, label: "L" }] }), "ตั้งเอง");
  eq("0=R, 1=L", Spec.optionsText(Spec.paramOptions(s, s.params[0])), "ของที่ตั้งเอง");
  good(Logic.addParam(s, { name: "W", default: 1 }), "double");
  eq(null, Spec.paramOptions(s, s.params[1]), "double ไม่มีตัวเลือก");
  const old = demo();
  ok(old.params.every(p => !("description" in p) && !("options" in p)), "spec เก่าไม่มี field ใหม่");
  good(Logic.setParamInfo(old, old.params[0].name, { description: "ok" }), "spec เก่าแก้ได้");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
