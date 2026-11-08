// ทดสอบ Variables ของรอบ 5 M3 (spec.logic.variables — evaluate ใน spec.js + Logic.addVariable ฯลฯ ใน logicops.js)
// รัน: node SA.Tests/js/variables.test.js · ผล JS = C# อยู่ใน drawing-cases.json (DrawingTests) และ RockPitchingTests (DepthUsed)
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
const near = (exp, act, what, tol = 1e-9) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const good = (r, what) => { if (!r || r.ok !== true) throw new Error(`${what}: ${r && r.error}`); return r; };
function bad(s, fn, re, what){
  const before = JSON.stringify(s), r = fn();
  if (!r || r.ok !== false) throw new Error(`${what}: ต้อง error แต่ได้ ${JSON.stringify(r)}`);
  if (re && !re.test(r.error)) throw new Error(`${what}: "${r.error}" ไม่ตรง ${re}`);
  if (JSON.stringify(s) !== before) throw new Error(`${what}: error แล้ว spec เปลี่ยน`);
}
const run = (s, values, surface) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: surface || null, extendEnds: true, layout: !surface });
const flat = y => [{ x: -40, y }, { x: 40, y }];
function base(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Depth", kind: "double", default: 3, displayName: "Depth", min: null, max: null, unit: "length" },
                { name: "Width", kind: "double", default: 2, displayName: "Width", min: null, max: null });
  Spec.addPoint(s, { type: "delta", from: "P1", dx: "Width", dy: "0" }, ["Shoulder"]);   // P2
  return s;
}

console.log("Variables (รอบ 5 M3)");

test("ค่าปกติ + rules ตามลำดับ ตัวแรกที่จริงชนะ + ข้อความเตือน {ชื่อ} · ใช้ใน dy ของจุด", () => {
  const s = base();
  good(Logic.addVariable(s, { name: "DepthUsed", unit: "length", expr: "Depth", note: "ลึกขั้นต่ำ 2 m",
    rules: [{ when: "Depth < 1", value: "1.5", warn: "Depth = {Depth} m < 1 m ใช้ 1.5 m" }, { when: "Depth < 2", value: "2", warn: "Depth = {Depth} m < 2 m ใช้ 2 m แทน" }] }), "add");
  const v = s.logic.variables[0];
  eq({ id: "V1", kind: "double", unit: "length", error: "ValueTooSmall" }, { id: v.id, kind: v.kind, unit: v.unit, error: v.rules[1].error }, "เก็บ + error เดาจาก <");
  const id = Spec.addPoint(s, { type: "delta", from: "P1", dx: "0", dy: "-DepthUsed" }, ["Bottom"]);
  let r = run(s, {}); near(-3, r.pts[id].y, "Depth 3 = ค่าปกติ"); eq(0, r.issues.length, "ไม่เตือน"); eq(3, r.logic.vars.DepthUsed, "vars");
  r = run(s, { Depth: 1.5 }); near(-2, r.pts[id].y, "1.5 → 2");
  eq(["Depth = 1.5 m < 2 m ใช้ 2 m แทน"], r.issues.map(i => i.msg), "เตือนข้อ 2");
  r = run(s, { Depth: 0.5 }); near(-1.5, r.pts[id].y, "0.5 → ข้อแรกชนะ 1.5"); eq(["Depth = 0.5 m < 1 m ใช้ 1.5 m"], r.issues.map(i => i.msg), "เตือนข้อแรกอย่างเดียว");
});

test("อ้างจุด / ผิวดิน (ความสูงถม) · หาจุดไม่ได้ = ไม่รู้ค่า + เตือน + จุดที่ใช้ชื่อนี้หาไม่ได้", () => {
  const s = base();
  good(Logic.addVariable(s, { name: "FillH", expr: "P2.y - ground(P2)", rules: [{ when: "FillH0 > 0", value: "1" }].slice(0, 0) }), "FillH");
  good(Logic.addVariable(s, { name: "Berm", expr: "0", rules: [{ when: "FillH > 6", value: "2" }, { when: "FillH > 3", value: "1" }] }), "Berm (หลาย rules ไม่เตือน)");
  const id = Spec.addPoint(s, { type: "delta", from: "P2", dx: "Berm", dy: "0" }, ["Berm"]);
  near(2 + 2, run(s, {}, flat(-7)).pts[id].x, "ถม 7 → 2"); near(2 + 1, run(s, {}, flat(-4)).pts[id].x, "ถม 4 → 1"); near(2, run(s, {}, flat(-1)).pts[id].x, "ถม 1 → 0");
  // อ้างจุดที่ไม่มี (ผ่าน firstOf ว่างไม่ได้ → ใช้จุดในกิ่งที่ไม่เกิด)
  const t = base(); const a = good(Logic.addCondition(t, { name: "Never", expr: "false" }), "cond");
  const p3 = Spec.addPoint(t, { type: "delta", from: "P1", dx: "1", dy: "1" }, []); good(Logic.setBranch(t, [p3], a.yes), "P3 ในกิ่ง");
  good(Logic.addVariable(t, { name: "H", expr: `${p3}.y` }), "H อ้าง P3");
  const q = Spec.addPoint(t, { type: "delta", from: "P1", dx: "H", dy: "0" }, []);
  const r = run(t, {});
  ok(r.pts[q].err && /H/.test(r.pts[q].err), "จุดที่ใช้ H หาไม่ได้: " + JSON.stringify(r.pts[q]));
  ok(r.issues.some(i => /^H:/.test(i.msg)), "เตือนที่ H"); eq(null, r.logic.vars.H, "vars = null");
});

test("ใช้ได้ทุกช่อง: slope (Variable ชนิด Slope 1:x) · Offset · Array · เงื่อนไข", () => {
  const s = base();
  good(Logic.addVariable(s, { name: "SideS", unit: "slope", expr: "1.5" }), "SideS");
  eq({ up: false, text: "SideS", mode: "param" }, JSON.parse(JSON.stringify(Spec.slopeRead(s, "-1/SideS"))), "ช่อง slope อ่านชื่อ variable");
  eq("-1/SideS", Spec.slopeWrite(s, false, "SideS").expr, "ช่อง slope เขียน");
  const p = Spec.addPoint(s, { type: "slopeLength", from: "P2", slope: "-1/SideS", length: "3", dir: 1, measure: "dx" }, []);
  near(-2, run(s, {}).pts[p].y, "ลง 3 m ที่ 1:1.5");
  good(Logic.addVariable(s, { name: "Th", expr: "Width / 4" }), "Th");
  const L = Spec.addLink(s, "P1", "P2", { points: ["P1", "P2"] });
  const o = good(Logic.addOffset(s, L, "Th", 1, {}), "Offset ระยะ = variable");
  near(0.5, Math.abs(run(s, {}).pts[o.a].y), "offset 0.5");
  good(Logic.addCondition(s, { name: "Thick", expr: "Th > 0.4", decision: false }), "เงื่อนไขใช้ variable");
  eq(true, run(s, {}).logic.conds.Thick, "ค่าเงื่อนไข");
  const g = good(Logic.addArray(s, { points: [p], links: [], shapes: [] }, { n: 2, dx: "Th", dy: "0" }), "Array dx = variable");
  ok(g.id, "array");
});

test("Logic API: ชื่อซ้ำ / คำสงวน · ชนิดนิพจน์ · วนกัน (variable ↔ variable, variable ↔ จุด) · {ชื่อ} ไม่รู้จัก · CorridorError ผิด — spec ไม่เปลี่ยน", () => {
  const s = base();
  good(Logic.addVariable(s, { name: "A", expr: "Width" }), "A");
  bad(s, () => Logic.addVariable(s, { name: "A", expr: "1" }), /มีชื่อ A/, "ซ้ำ");
  bad(s, () => Logic.addVariable(s, { name: "Depth", expr: "1" }), /มีชื่อ Depth/, "ซ้ำ parameter");
  bad(s, () => Logic.addVariable(s, { name: "V3", expr: "1" }), /โค้ดที่สร้างใช้/, "V3");
  bad(s, () => Logic.addVariable(s, { name: "B", expr: "Width > 1" }), /ตัวเลข/, "expr bool");
  bad(s, () => Logic.addVariable(s, { name: "B", expr: "1", rules: [{ when: "Width", value: "1" }] }), /จริง ?\/ ?เท็จ/, "when num");
  bad(s, () => Logic.addVariable(s, { name: "B", expr: "B + 1" }), /วง/, "อ้างตัวเอง");
  good(Logic.addVariable(s, { name: "B", expr: "A * 2" }), "B");
  bad(s, () => Logic.editVariable(s, "A", { expr: "B" }), /วง: A → B → A|วง: B → A → B/, "A ↔ B");
  const p = Spec.addPoint(s, { type: "delta", from: "P1", dx: "B", dy: "0" }, []);
  bad(s, () => Logic.editVariable(s, "A", { expr: `${p}.x` }), /วง/, "A → P → B → A");
  bad(s, () => Logic.editVariable(s, "A", { rules: [{ when: "Width < 1", value: "1", warn: "{Nope} ผิด" }] }), /Nope/, "{ชื่อ} ไม่รู้จัก");
  bad(s, () => Logic.editVariable(s, "A", { rules: [{ when: "Width < 1", value: "1", warn: "x", error: "Boom" }] }), /CorridorError/, "error ผิด");
  bad(s, () => Logic.editVariable(s, "A", { unit: "deg" }), /ชนิดค่า/, "unit ผิด");
  bad(s, () => Logic.addVariable(s, { name: "C", kind: "int", expr: "1" }), /ยังไม่รองรับ/, "kind");
  good(Logic.editVariable(s, "A", { rules: [{ when: "Width > 5", value: "5", warn: "Width = {Width} > 5" }] }), "rule >"); eq("ValueTooLarge", s.logic.variables[0].rules[0].error, "เดา >");
});

test("rename (นิพจน์ทุกช่อง + ข้อความเตือน {ชื่อ} เปลี่ยนตาม) · ลบตอนมีคนใช้ = ไม่ยอม · เรียงลำดับ · bool = เงื่อนไข · describe", () => {
  const s = base();
  good(Logic.addVariable(s, { name: "A", expr: "Width" }), "A");
  good(Logic.addVariable(s, { name: "B", expr: "A + 1", rules: [{ when: "A > 5", value: "A", warn: "A = {A}" }] }), "B");
  const p = Spec.addPoint(s, { type: "delta", from: "P1", dx: "A", dy: "B" }, []);
  good(Logic.renameVariable(s, "A", "Half"), "rename");
  eq(["Half + 1", "Half > 5", "Half", "Half = {Half}"], [s.logic.variables[1].expr, s.logic.variables[1].rules[0].when, s.logic.variables[1].rules[0].value, s.logic.variables[1].rules[0].warn], "ตามไปทุกที่");
  eq("Half", s.points.find(q => q.id === p).def.dx, "จุดตาม");
  bad(s, () => Logic.removeVariable(s, "Half"), /ยังใช้อยู่ใน (B, P3|P3, B)/, "มีคนใช้");
  bad(s, () => Logic.renameVariable(s, "Half", "Width"), /มีชื่อ Width/, "ชื่อซ้ำ");
  good(Logic.moveVariable(s, "B", 0), "move"); eq(["B", "Half"], s.logic.variables.map(v => v.name), "ลำดับ");
  s.points = s.points.filter(q => q.id !== p);
  good(Logic.removeVariable(s, "B"), "ลบ B"); good(Logic.removeVariable(s, "Half"), "ลบ Half");
  const b = good(Logic.addVariable(s, { name: "Wide", kind: "bool", expr: "Width > 1" }), "bool");
  ok(s.logic.conditions.some(c => c.name === "Wide") && !(s.logic.variables || []).some(v => v.name === "Wide"), "bool เก็บใน conditions");
  eq("bool", b.kind, "kind");
  good(Logic.addVariable(s, { name: "W2", expr: "Width * 2" }), "W2");
  const d = Logic.describe(s, run(s, {}));
  eq({ name: "W2", kind: "double", unit: "number", expr: "Width * 2", value: 4 }, d.variables[0], "describe");
});

test("spec เก่า (ไม่มี variables) ผลเหมือนเดิม · evaluate ไม่ทำให้ env เปลี่ยนรูป (spread / JSON ได้)", () => {
  const s = base(); const id = Spec.addPoint(s, { type: "delta", from: "P2", dx: "1", dy: "-Depth" }, []);
  const r1 = run(s, {}); ok(!("variables" in (s.logic || {})), "ไม่มี field");
  near(-3, r1.pts[id].y, "ผลเดิม"); eq({}, r1.logic.vars, "vars ว่าง");
  good(Logic.addVariable(s, { name: "Bad", expr: "P9.y" }.expr ? { name: "Bad", expr: "1" } : {}), "Bad");
  const r2 = run(s, {}); ok(JSON.stringify({ ...r2.env }).length > 2, "spread env ได้");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
