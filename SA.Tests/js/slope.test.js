// ทดสอบชนิดค่าของ parameter + ช่อง slope แบบ 1:x ของรอบ 4e M2 (Spec.UNITS / fmtParam / parseUnitValue / setParamUnit / slopeRead / slopeWrite ใน spec.js)
// รัน: node SA.Tests/js/slope.test.js
// (ผล JS = C# ของช่อง slope 3 แบบ + ข้อความเตือนตามชนิดค่า อยู่ใน drawing-cases.json → DrawingTests.cs)
"use strict";
const { Expr, Spec } = typeof require === "function" ? (() => {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
  const ctx = vm.createContext({ console });
  vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\nthis.Expr = Expr; this.Spec = Spec;", ctx);
  return ctx;
})() : globalThis.SA_LIB;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const near = (exp, act, what, tol = 1e-9) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${JSON.stringify(exp)} ได้ ${JSON.stringify(act)}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };

const run = (s, values, surface) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: surface || null, extendEnds: true, layout: !surface });
const P = (r, id) => { const p = r.pts[id]; if (!p || p.err) throw new Error(`จุด ${id}: ${p ? p.err : "ไม่มี"}`); return p; };
const par = (s, n) => s.params.find(p => p.name === n);
// spec: SideSlope (Slope 1:1.5), Grade (Percent 2), Depth (Length 2), N (Number)
function base(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "SideSlope", kind: "double", default: 1.5, displayName: "Side Slope", min: null, max: null, unit: "slope", positive: true },
                { name: "Grade", kind: "double", default: 2, displayName: "Grade", min: null, max: null, unit: "percent" },
                { name: "Depth", kind: "double", default: 2, displayName: "Depth", min: null, max: null, unit: "length" },
                { name: "N", kind: "double", default: 3, displayName: "N", min: null, max: null });
  return s;
}

test("ชนิดค่า: ไม่มี unit = Number (spec เก่า) · แสดง 1:x / m / %", () => {
  const s = base();
  eq("slope", Spec.unitOf(par(s, "SideSlope")), "SideSlope");
  eq("number", Spec.unitOf({ name: "X" }), "ไม่มี unit");
  eq("number", Spec.unitOf({ name: "X", unit: "แปลก" }), "unit ที่ไม่รู้จัก");
  eq("1:1.5", Spec.fmtParam(par(s, "SideSlope"), 1.5), "slope");
  eq("2%", Spec.fmtParam(par(s, "Grade"), 2), "percent");
  eq("2 m", Spec.fmtParam(par(s, "Depth"), 2), "length");
  eq("3", Spec.fmtParam(par(s, "N"), 3), "number");
});

test("พิมพ์ในตาราง: 1:1.5 ↔ 1.5 · 2% · 2 m · ว่าง = null · ผิด = NaN", () => {
  eq(1.5, Spec.parseUnitValue("slope", "1:1.5"), "1:1.5");
  eq(1.5, Spec.parseUnitValue("slope", " 1 : 1.5 "), "มีช่องว่าง");
  eq(1.5, Spec.parseUnitValue("slope", "1.5"), "1.5");
  eq(2, Spec.parseUnitValue("percent", "2%"), "2%");
  eq(2, Spec.parseUnitValue("length", "2 m"), "2 m");
  eq(null, Spec.parseUnitValue("slope", ""), "ว่าง");
  ok(isNaN(Spec.parseUnitValue("slope", "1:abc")), "1:abc");
  ok(isNaN(Spec.parseUnitValue("number", "1:2")), "Number ไม่รับ 1:2");
  // ไปกลับ: แสดงแล้วอ่านกลับได้ค่าเดิม
  for (const [u, v] of [["slope", 1.5], ["slope", 0.75], ["percent", 2.5], ["length", 0.3], ["number", -4]])
    eq(v, Spec.parseUnitValue(u, Spec.fmtUnit(u, v)), `${u} ${v}`);
});

test("เปลี่ยนชนิดค่า: Slope ติ๊ก ต้องมากกว่า 0 ให้ · Number = ลบ field unit", () => {
  const s = base();
  Spec.setParamUnit(s, "N", "slope");
  eq("slope", par(s, "N").unit, "unit"); ok(par(s, "N").positive, "positive");
  Spec.setParamUnit(s, "N", "number");
  ok(!("unit" in par(s, "N")), "number ไม่เก็บ field");
  let threw = false; try{ Spec.setParamUnit(s, "N", "deg"); }catch{ threw = true; } ok(threw, "unit ที่ไม่มีต้อง throw");
});

test("ช่อง slope เขียน: 1:x · parameter Slope · % · parameter Percent · นิพจน์ (ทิศ ↗ / ↘)", () => {
  const s = base(), w = (up, t) => Spec.slopeWrite(s, up, t);
  eq("-1/1.5", w(false, "1:1.5").expr, "↘ 1:1.5"); eq("1/1.5", w(true, "1:1.5").expr, "↗ 1:1.5");
  eq("-1/SideSlope", w(false, "SideSlope").expr, "↘ SideSlope"); eq("1/SideSlope", w(true, "SideSlope").expr, "↗ SideSlope");
  eq("-2/100", w(false, "2%").expr, "↘ 2%"); eq("-Grade/100", w(false, "Grade").expr, "↘ Grade");
  eq("-1/2", w(true, "-1:2").expr, "-1:2 แบบเดิม = เครื่องหมายตามที่พิมพ์");
  // parameter ชนิดอื่น / ตัวเลข / นิพจน์ = ตามที่พิมพ์ (เครื่องหมายอยู่ในนิพจน์)
  for (const t of ["N", "-0.667", "0.5", "-1/SideSlope", "Depth / 10"]) { const r = w(false, t); eq(t, r.expr, t); eq("expr", r.mode, t + " mode"); }
});

test("ช่อง slope อ่าน: spec เก่า (-1/SideSlope, -1/2, -0.5, 1.0 / CutSlope) → หน้าตาในเว็บ · อ่านแล้วเขียนกลับ = ค่าเดิม", () => {
  const s = base();
  const r = e => Spec.slopeRead(s, e);
  eq(JSON.stringify({ up: false, text: "SideSlope", mode: "param" }), JSON.stringify(r("-1/SideSlope")), "-1/SideSlope");
  eq(JSON.stringify({ up: true, text: "SideSlope", mode: "param" }), JSON.stringify(r("1 / SideSlope")), "1 / SideSlope");
  eq(JSON.stringify({ up: false, text: "1:2", mode: "ratio" }), JSON.stringify(r("-1/2")), "-1/2");
  eq(JSON.stringify({ up: false, text: "Grade", mode: "percent" }), JSON.stringify(r("-Grade/100")), "-Grade/100");
  eq("expr", r("-0.5").mode, "-0.5 = นิพจน์"); eq("-0.5", r("-0.5").text, "-0.5 ข้อความเดิม");
  eq("expr", r("-1/N").mode, "1/parameter Number = นิพจน์ (ไม่ใช่ชนิด Slope)");
  for (const e of ["-1/SideSlope", "1/SideSlope", "-1/2", "1/1.5", "-2/100", "-Grade/100"]){
    const q = r(e); eq(e, Spec.slopeWrite(s, q.up, q.text).expr, "ไปกลับ " + e);
  }
});

test("ผลคำนวณ: 1:1.5 / SideSlope / ตัวเลขเดิม ได้จุดเดียวกัน (ลาด + ความยาว, Right / Left)", () => {
  for (const side of [0, 1]){
    const ys = [];
    for (const t of ["1:1.5", "SideSlope", "-0.6666666666666666"]){
      const s = base();
      const id = Spec.addPoint(s, { type: "slopeLength", from: "P1", slope: Spec.slopeWrite(s, false, t).expr, length: "3", dir: 1, measure: "dx" }, []);
      const q = P(run(s, { Side: side }), id); ys.push([q.x, q.y]);
    }
    for (const q of ys){ near(ys[0][0], q[0], `x Side=${side}`, 1e-12); near(ys[0][1], q[1], `y Side=${side}`, 1e-12); }
    near(-2, ys[0][1], "ลง 3 m ที่ 1:1.5 = -2");
  }
});

test("ข้อความเตือนตามชนิดค่า (เหมือน C#): SideSlope = 1:0.5 < 1:1 · Depth = 0.5 m · Grade = 12% · ≤ 0", () => {
  const s = base();
  Spec.setParamBounds(s, "SideSlope", { min: 1 }); Spec.setParamBounds(s, "Depth", { min: 1 }); Spec.setParamBounds(s, "Grade", { max: 10 });
  const msgs = run(s, { SideSlope: 0.5, Depth: 0.5, Grade: 12 }).issues.map(i => i.msg);
  ok(msgs.includes("SideSlope = 1:0.5 < 1:1, ใช้ 1:1 แทน"), msgs.join(" | "));
  ok(msgs.includes("Depth = 0.5 m < 1 m, ใช้ 1 m แทน"), msgs.join(" | "));
  ok(msgs.includes("Grade = 12% > 10%, ใช้ 10% แทน"), msgs.join(" | "));
  const e = run(s, { SideSlope: -1 }).issues.find(i => i.level === "e");
  eq("SideSlope = 1:-1 ต้องมากกว่า 0, ใช้ค่า default 1:1.5 แทน", e && e.msg, "≤ 0");
  // ขอบเขตของ Slope = เทียบ x (ขั้นต่ำ 1:1 = ไม่ชันกว่า 1:1)
  const r = run(s, { SideSlope: 0.5 });
  near(1, r.env.SideSlope, "ใช้ 1:1 แทน");
  eq("default 1:1.5 ต่ำกว่าขั้นต่ำ 1:2 — Civil 3D จะเตือนทุกครั้งที่ใช้ค่า default",
     (Spec.setParamBounds(s, "SideSlope", { min: 2 }), Spec.paramBoundsIssue(par(s, "SideSlope"))), "เตือนในตาราง");
});

test("Daylight Cut/Fill: สร้าง CutSlope / FillSlope เป็นชนิด Slope · ใช้ parameter Slope ที่มีอยู่ได้ (ไม่สร้างใหม่)", () => {
  let s = base();
  Spec.addCutFill(s, { hinge: "P1", cut: 1, fill: 2, params: true, dir: 1 });
  const cs = s.params.find(p => p.name === "CutSlope"), fs = s.params.find(p => p.name === "FillSlope");
  ok(cs && fs, "สร้าง parameter"); eq("slope", cs.unit, "CutSlope unit"); ok(fs.positive, "FillSlope positive");
  ok(s.points.some(p => p.def.slope === "-1/FillSlope") && s.points.some(p => p.def.slope === "1/CutSlope"), "นิพจน์ลาด");
  s = base(); const n0 = s.params.length;
  Spec.addCutFill(s, { hinge: "P1", cut: "SideSlope", fill: "SideSlope", params: true, dir: 1 });
  eq(n0, s.params.length, "ไม่สร้าง parameter ใหม่");
  ok(s.points.some(p => p.def.slope === "-1/SideSlope") && s.points.some(p => p.def.slope === "1/SideSlope"), "ใช้ SideSlope");
  s = base(); Spec.addCutFill(s, { hinge: "P1", cut: 1.5, fill: 2, params: false, dir: 1 });
  ok(s.points.some(p => p.def.slope === "-1/2"), "ไม่สร้าง parameter = ตัวเลข");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process !== "undefined") process.exitCode = failed ? 1 : 0;
