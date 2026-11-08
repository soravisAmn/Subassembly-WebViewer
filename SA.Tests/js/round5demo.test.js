// รอบ 5 M5: round5-demo = คันดิน (switch ProtectionType + Daylight Cut/Fill + elif HighFill ชานพัก + Variable DepthUsed)
//   buildRound5() = ลำดับการกด (Logic API ชุดเดียวกับที่ปุ่ม / ต้นไม้ Conditions / หน้าต่าง Variable เรียก) + การแก้ใน Properties
//   ผลคือ spec ใน tests-civil3d/round5-demo.cs (Save ผ่าน /api/drawing/save) · ผล JS = C# อยู่ใน drawing-cases.json (round5-demo)
// รัน: node SA.Tests/js/round5demo.test.js
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
const near = (exp, act, what, tol = 1e-6) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const good = r => { if (!r || r.ok !== true) throw new Error(r && r.error); return r; };

function buildRound5(){
  const s = Spec.newSpec("Round5Demo");
  // ตาราง Parameter (ชนิดค่า Length / Number · ProtectionType = long)
  s.params.push({ name: "Width", kind: "double", default: 4, displayName: "Crest Width", min: 1, max: null, unit: "length" },
                { name: "ProtectionType", kind: "long", default: 1, displayName: "Protection (1 หินเรียง · 2 คอนกรีต · อื่นๆ ไม่มี)", min: null, max: null },
                { name: "RockT", kind: "double", default: 0.5, displayName: "Rock Thickness", min: null, max: null, unit: "length", positive: true },
                { name: "ConcT", kind: "double", default: 0.2, displayName: "Concrete Thickness", min: null, max: null, unit: "length", positive: true },
                { name: "Depth", kind: "double", default: 2.5, displayName: "Key Depth", min: null, max: null, unit: "length" },
                { name: "KeyW", kind: "double", default: 1, displayName: "Key Width", min: null, max: null, unit: "length", positive: true },
                { name: "BermH", kind: "double", default: 3, displayName: "Berm Height", min: null, max: null, unit: "length", positive: true },
                { name: "BermW", kind: "double", default: 2, displayName: "Berm Width", min: null, max: null, unit: "length", positive: true });
  const P = id => Spec.byId(s.points, id);
  const L = (a, b, codes) => { const id = Spec.addLink(s, a, b, { points: [a, b] }); Spec.byId(s.links, id).codes = codes; return id; };
  // สันคันดิน
  P("P1").codes = ["CrestInside"];
  const p2 = Spec.addPoint(s, { type: "delta", from: "P1", dx: "Width", dy: "0" }, ["CrestOutside"]);
  const crest = L("P1", p2, ["Top", "Crest"]);
  // ปุ่ม Daylight Cut/Fill ที่ไหล่ P2 (ลาดตัด 1:1.5 / ถม 1:2 + สร้าง CutSlope / FillSlope ชนิด Slope)
  const cf = good(Logic.addCutFill(s, { hinge: p2, cut: "1:1.5", fill: "1:2", params: true, dir: 1, cutCode: "Daylight_Cut", fillCode: "Daylight_Fill" }));
  // ต้นไม้ Conditions: คลิกขวากิ่ง ถม → + elif HighFill (ถมสูงเกิน BermH = มีชานพัก)
  const hf = good(Logic.addCondition(s, { name: "HighFill", expr: `${p2}.y - ground(${p2}) > BermH`, parentBranch: cf.no, label: "ถมสูงไหม?", yes: "ถมสูง (ชานพัก)", no: "ถมปกติ" }));
  // ลาดถมเดิม → ลากไปกิ่ง ถมปกติ
  good(Logic.setBranch(s, [cf.fill.point, cf.fill.link], hf.no));
  // วาดลงกิ่ง ถมสูง (B): ลาดลง BermH → ชานพัก BermW → ลาดจนชนดิน
  const b1 = Spec.addPoint(s, { type: "slopeLength", from: p2, slope: "-1/FillSlope", length: "BermH", dir: 1, measure: "dy" }, ["BermInside"]);
  const b2 = Spec.addPoint(s, { type: "delta", from: b1, dx: "BermW", dy: "0" }, ["BermOutside"]);
  const b3 = Spec.addPoint(s, { type: "slopeToSurface", from: b2, slope: "-1/FillSlope", dir: 1, target: "TargetSurface", maxDistance: "50", layoutLength: "3" }, ["Daylight_Fill"]);
  const bl = [L(p2, b1, ["Top", "Daylight_Fill"]), L(b1, b2, ["Top", "Berm"]), L(b2, b3, ["Top", "Daylight_Fill"])];
  good(Logic.setBranch(s, [b1, b2, b3, ...bl], hf.yes));
  // Properties ของจุด Daylight (firstOf): เพิ่มปลายลาดของกิ่งถมสูง
  P(cf.daylight).def.points.push(b3);
  // Variable DepthUsed (ลึกขั้นต่ำ 2 m) → ร่องแกนคันดิน (key) ใต้สัน
  good(Logic.addVariable(s, { name: "DepthUsed", unit: "length", expr: "Depth", note: "ร่องแกนลึกขั้นต่ำ 2 m",
    rules: [{ when: "Depth < 2", value: "2", warn: "Depth = {Depth} m < 2 m ใช้ 2 m แทน", error: "ValueTooSmall" }] }));
  const k1 = Spec.addPoint(s, { type: "delta", from: "P1", dx: "0", dy: "-DepthUsed" }, ["KeyBottomInside"]);
  const k2 = Spec.addPoint(s, { type: "delta", from: k1, dx: "KeyW", dy: "0" }, ["KeyBottomOutside"]);
  const k3 = Spec.addPoint(s, { type: "delta", from: k2, dx: "0", dy: "DepthUsed" }, ["KeyTop"]);
  const key = [L("P1", k1, ["Key"]), L(k1, k2, ["Key", "KeyBottom"]), L(k2, k3, ["Key"]), L(k3, "P1", ["Key"])];
  Spec.byId(s.shapes, Spec.addShape(s, key)).codes = ["CoreKey"];
  // + Switch ProtectionType: 1 หินเรียง · 2 คอนกรีต · อื่นๆ ไม่มี — ชั้นบนสัน
  const sw = good(Logic.addDecision(s, { kind: "switch", test: "ProtectionType", label: "ชั้นป้องกัน", cases: [{ value: 1, label: "หินเรียง" }, { value: 2, label: "คอนกรีต" }], elseLabel: "ไม่มีชั้นป้องกัน" }));
  const layer = (t, code, br) => {
    const a = Spec.addPoint(s, { type: "delta", from: "P1", dx: "0", dy: t }, [code + "TopInside"]);
    const b = Spec.addPoint(s, { type: "delta", from: p2, dx: "0", dy: t }, [code + "TopOutside"]);
    const ls = [L("P1", a, [code]), L(a, b, ["Top", code]), L(b, p2, [code])];
    const sh = Spec.addShape(s, [...ls, crest]); Spec.byId(s.shapes, sh).codes = [code];
    good(Logic.setBranch(s, [a, b, ...ls, sh], br));
  };
  layer("RockT", "Rock", sw.branches[0]);
  layer("ConcT", "Concrete", sw.branches[1]);
  return s;
}

const run = (s, y, values, layout) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: y == null ? null : [{ x: -40, y }, { x: 40, y }], extendEnds: true, layout: !!layout || y == null });
const on = (r, code) => { const s = specOf; const ids = s.points.filter(p => (p.codes || []).includes(code)).map(p => p.id); return ids.some(id => r.pts[id] && !r.pts[id].err); };
let specOf = null;

console.log("round5-demo (รอบ 5 M5)");

test("สร้างได้ด้วย Logic API ล้วน — โครง: ตัด / ถม › ถมสูง-ถมปกติ · switch 3 กิ่ง · variable 1 · ไม่มี risk", () => {
  const s = specOf = buildRound5();
  eq3(s.logic.decisions.map(d => d.kind), ["if", "if", "switch"], "decision");
  ok(s.logic.variables.length === 1 && s.logic.conditions.map(c => c.name).join() === "IsCut,HighFill", "เงื่อนไข / variable");
  ok(!Spec.branchRisks(s).length, "branchRisks: " + JSON.stringify(Spec.branchRisks(s)));
});
function eq3(a, b, w){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${w}: ${JSON.stringify(a)}`); }

test("ดินสูง (+2) = ตัด · ดินต่ำ 1.5 m = ถมปกติ · ดินต่ำ 6 m = ถมสูง (ชานพัก) · ไม่มีดิน = ถม", () => {
  const s = specOf;
  let r = run(s, 2); ok(on(r, "Daylight_Cut") && !on(r, "Daylight_Fill") && !on(r, "BermInside"), "ตัด");
  r = run(s, -1.5); ok(!on(r, "Daylight_Cut") && on(r, "Daylight_Fill") && !on(r, "BermInside"), "ถมปกติ");
  r = run(s, -6); ok(on(r, "BermInside") && on(r, "BermOutside") && on(r, "Daylight_Fill") && !on(r, "Daylight_Cut"), "ถมสูง");
  const bi = s.points.find(p => p.codes.includes("BermInside")).id, bo = s.points.find(p => p.codes.includes("BermOutside")).id;
  near(-3, r.pts[bi].y, "ชานพักต่ำกว่าสัน BermH"); near(4 + 6 + 2, r.pts[bo].x, "ชานพักนอก = 4 + 3×2 + 2");
  ok(!r.issues.length, "ไม่เตือน: " + JSON.stringify(r.issues));
  r = run(s, null); ok(on(r, "Daylight_Fill") && !on(r, "BermInside"), "Layout = ถมปกติ");
});

test("switch ProtectionType: 1 หินเรียง · 2 คอนกรีต · 3 ไม่มี · DepthUsed: Depth 1.5 → 2 + เตือน · Side = Left", () => {
  const s = specOf;
  let r = run(s, -1.5, { ProtectionType: 1 }); ok(on(r, "RockTopInside") && !on(r, "ConcreteTopInside"), "หิน");
  r = run(s, -1.5, { ProtectionType: 2 }); ok(!on(r, "RockTopInside") && on(r, "ConcreteTopInside"), "คอนกรีต");
  r = run(s, -1.5, { ProtectionType: 3 }); ok(!on(r, "RockTopInside") && !on(r, "ConcreteTopInside"), "ไม่มี");
  r = run(s, -1.5, { Depth: 1.5 });
  near(-2, r.pts[s.points.find(p => p.codes.includes("KeyBottomInside")).id].y, "ลึก 2");
  ok(r.issues.map(i => i.msg).includes("Depth = 1.5 m < 2 m ใช้ 2 m แทน"), "เตือน");
  r = run(s, -6, { Side: 1 }); ok(r.pts[s.points.find(p => p.codes.includes("BermOutside")).id].x < 0, "Left = ภาพกระจก");
  ok(r.shapes[s.shapes.find(x => x.codes.includes("CoreKey")).id].poly, "รูปร่องแกนปิด");
});

test("สร้างใหม่ = sa-spec ใน tests-civil3d/round5-demo.cs (ทำซ้ำได้)", () => {
  const f = path.join(__dirname, "../../tests-civil3d/round5-demo.cs");
  if (!fs.existsSync(f)){ console.log("        (ยังไม่มี round5-demo.cs — ข้าม)"); return; }
  const t = fs.readFileSync(f, "utf8"), m = /\/\/ sa-spec: (.*)/.exec(t);
  const want = m ? JSON.parse(m[1]) : JSON.parse(Buffer.from(/\/\/ sa-spec-b64: (.*)/.exec(t)[1].trim(), "base64").toString("utf8"));
  if (JSON.stringify(want) !== JSON.stringify(buildRound5())) throw new Error("spec ไม่ตรงกับไฟล์");
});

module.exports = { buildRound5 };
console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
