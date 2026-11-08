// รอบ 5b M4: round5b-demo = คันดินถมที่มีชานพักทุก BermInterval (จำนวนชั้นเปลี่ยนตามความสูงถมที่สถานีนั้น)
//   buildRound5b() = ลำดับการกด (Logic API ชุดเดียวกับปุ่ม Array + ติ๊ก Loop / ต้นไม้ Conditions / หน้าต่าง Variable / ปุ่ม "สร้างจุดชุดสุดท้าย")
//   ผลคือ spec ใน tests-civil3d/round5b-demo.cs (Save ผ่าน /api/drawing/save) · ผล JS = C# อยู่ใน drawing-cases.json (round5b-demo)
// รัน: node SA.Tests/js/round5bdemo.test.js
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

// คันดินครึ่งตัว (Right): สัน P1 → P2 · ถมไม่ถึง BermInterval = ลาดถมเดียวชนดิน
//   ถมสูง: ชุด (ลาดลง BermInterval → ชานพัก BermW) ทำซ้ำ N = floor(FillH / BermInterval) ชั้น (Loop)
//   ลาดชั้นที่ i (ต้นฉบับ 0) = 1:(FillSlope + SlopeInc × i) — ชั้นล่างลาดกว่า · ลาดสุดท้ายจากชานพักชั้นสุดท้าย (lastOf) ลงไปชนดินที่ 1:(FillSlope + SlopeInc × count(A1))
function buildRound5b(){
  const s = Spec.newSpec("Round5bDemo");
  s.params.push({ name: "Width", kind: "double", default: 4, displayName: "Crest Width", min: 1, max: null, unit: "length" },
                { name: "FillSlope", kind: "double", default: 2, displayName: "Fill Slope (1:x)", min: null, max: null, unit: "slope", positive: true },
                { name: "SlopeInc", kind: "double", default: 0.25, displayName: "Slope Increase per Bench", min: 0, max: null },
                { name: "BermInterval", kind: "double", default: 3, displayName: "Berm Every (Height)", min: null, max: null, unit: "length", positive: true },
                { name: "BermW", kind: "double", default: 2, displayName: "Berm Width", min: null, max: null, unit: "length", positive: true },
                { name: "LayoutH", kind: "double", default: 7, displayName: "Fill Height (Layout / ไม่มีดิน)", min: null, max: null, unit: "length", positive: true });
  const P = id => Spec.byId(s.points, id);
  const L = (a, b, codes) => { const id = Spec.addLink(s, a, b, { points: [a, b] }); Spec.byId(s.links, id).codes = codes; return id; };
  // สัน
  P("P1").codes = ["CrestInside"];
  const p2 = Spec.addPoint(s, { type: "delta", from: "P1", dx: "Width", dy: "0" }, ["CrestOutside"]);
  L("P1", p2, ["Top", "Crest"]);
  // Variable FillH = ความสูงถมที่ไหล่ (ไม่มีดิน = LayoutH)
  good(Logic.addVariable(s, { name: "FillH", unit: "length", expr: `${p2}.y - ground(${p2})`, note: "ความสูงถมที่ไหล่คันดิน",
    rules: [{ when: "not hasGround()", value: "LayoutH" }] }));
  // + Condition HighFill: ถมสูงถึงชั้นชานพักแรกไหม
  const hf = good(Logic.addCondition(s, { name: "HighFill", expr: "FillH > BermInterval", label: "มีชานพักไหม?", yes: "มีชานพัก (Loop)", no: "ถมต่ำ" }));
  // กิ่ง ถมต่ำ: ลาดถมเดียวจากไหล่ชนดิน
  const d0 = Spec.addPoint(s, { type: "slopeToSurface", from: p2, slope: "-1/FillSlope", dir: 1, target: "TargetSurface", maxDistance: "50", layoutLength: "3" }, ["Daylight_Fill"]);
  const l0 = L(p2, d0, ["Top", "Daylight_Fill"]);
  good(Logic.setBranch(s, [d0, l0], hf.no));
  // กิ่ง มีชานพัก: ชุดต้นฉบับ = ลาดลง BermInterval (1:FillSlope) → ชานพัก BermW
  const q0 = Spec.addPoint(s, { type: "slopeLength", from: p2, slope: "-1/FillSlope", length: "BermInterval", dir: 1, measure: "dy" }, ["BermInside"]);
  const b0 = Spec.addPoint(s, { type: "delta", from: q0, dx: "BermW", dy: "0" }, ["BermOutside"]);
  const ls = L(p2, q0, ["Top", "Fill"]), lb = L(q0, b0, ["Top", "Berm"]);
  good(Logic.setBranch(s, [q0, b0, ls, lb], hf.yes));
  // ปุ่ม Array + ติ๊ก Loop: ชุดถัดไปเริ่มที่ปลายชานพักชุดก่อน (จุดร่วม BermOutside → CrestOutside)
  //   dx = ชานพัก + ระยะราบของลาดชั้นที่ i · dy = ลง BermInterval · N = floor(FillH / BermInterval) ชั้น (อย่างน้อย 1) สูงสุด 10
  const a = good(Logic.addArray(s, { points: [p2, q0, b0], links: [ls, lb], shapes: [] },
    { n: 2, dx: "BermW + BermInterval * (FillSlope + SlopeInc * i)", dy: "-BermInterval", join: { mode: "share", from: b0, to: p2 },
      loop: { n: "max(1, floor(FillH / BermInterval))", nMax: 10, nRound: "floor" } }));
  // ปุ่ม "สร้างจุดชุดสุดท้าย" ของ BermOutside → ลาดสุดท้ายลงไปชนดิน
  const last = good(Logic.addLastOf(s, a.id || "A1", b0)).result;
  const d1 = Spec.addPoint(s, { type: "slopeToSurface", from: last, slope: "-1/(FillSlope + SlopeInc * count(A1))", dir: 1, target: "TargetSurface", maxDistance: "50", layoutLength: "3" }, ["Daylight_Fill"]);
  const l1 = L(last, d1, ["Top", "Daylight_Fill"]);
  good(Logic.setBranch(s, [last, d1, l1], hf.yes));
  return s;
}

const run = (s, y, values, layout) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: y == null ? null : [{ x: -60, y }, { x: 80, y }], extendEnds: true, layout: !!layout || y == null });
let specOf = null;
const ptsWith = (r, code) => specOf.points.filter(p => p.codes.includes(code) && r.pts[p.id] && !r.pts[p.id].err).map(p => r.pts[p.id]);

console.log("round5b-demo (รอบ 5b M4)");

test("สร้างได้ด้วย Logic API ล้วน — Loop A1 ในกิ่ง มีชานพัก · lastOf · variable FillH · ไม่มี risk", () => {
  const s = specOf = buildRound5b();
  ok(s.arrays.length === 1 && s.arrays[0].loop && s.arrays[0].members.length === 9, "Loop สร้างเผื่อ 10 ชุด");
  ok(s.points.some(p => p.def.type === "lastOf"), "มีจุดชุดสุดท้าย");
  ok(!Spec.branchRisks(s).length, "branchRisks: " + JSON.stringify(Spec.branchRisks(s)));
});

test("ถม 2 m = ไม่มีชานพัก · 7 m = 2 ชั้น · 13 m = 4 ชั้น (ลาดชั้นล่างลาดขึ้น) · ไม่มีเตือน", () => {
  const s = specOf;
  let r = run(s, -2); ok(!ptsWith(r, "BermInside").length && ptsWith(r, "Daylight_Fill").length === 1, "ถมต่ำ"); near(4 + 4, ptsWith(r, "Daylight_Fill")[0].x, "daylight 1:2");
  r = run(s, -7); ok(ptsWith(r, "BermInside").length === 2 && r.logic.loops.A1 === 2, "2 ชั้น");
  // ชั้น 1: ลง 3 ที่ 1:2 → x 10 · ชานพัก → 12 · ชั้น 2: ลง 3 ที่ 1:2.25 → 18.75 · ชานพัก → 20.75 · ลาดสุดท้าย 1:2.5 ลง 1 → 23.25
  near(10, ptsWith(r, "BermInside")[0].x, "BermInside 1"); near(18.75, ptsWith(r, "BermInside")[1].x, "BermInside 2 (1:2.25)");
  const d = ptsWith(r, "Daylight_Fill"); ok(d.length === 1, "daylight เดียว"); near(23.25, d[0].x, "ลาดสุดท้าย 1:2.5"); near(-7, d[0].y, "ชนดิน");
  ok(!r.issues.filter(i => i.level !== "i").length, "ไม่เตือน: " + JSON.stringify(r.issues));
  r = run(s, -13); ok(r.logic.loops.A1 === 4 && ptsWith(r, "BermOutside").length === 4, "4 ชั้น");
});

test("Layout (ไม่มีดิน) = LayoutH 7 → 2 ชั้น · BermInterval 2 → 3 ชั้น · Side = Left ภาพกระจก · ถมสูงมาก 40 m = 10 ชั้น + เตือนเกินสูงสุด", () => {
  const s = specOf;
  let r = run(s, null); ok(r.logic.loops.A1 === 2, "Layout 2 ชั้น");
  r = run(s, -7, { BermInterval: 2 }); ok(r.logic.loops.A1 === 3, "ทุก 2 m = 3 ชั้น");
  r = run(s, -7, { Side: 1 }); ok(ptsWith(r, "BermOutside").every(q => q.x < 0), "Left");
  r = run(s, -40); ok(r.logic.loops.A1 === 10 && r.issues.some(i => /เกินสูงสุด 10/.test(i.msg)), "เกินสูงสุด: " + JSON.stringify(r.issues));
});

test("สร้างใหม่ = sa-spec ใน tests-civil3d/round5b-demo.cs (ทำซ้ำได้)", () => {
  const f = path.join(__dirname, "../../tests-civil3d/round5b-demo.cs");
  if (!fs.existsSync(f)){ console.log("        (ยังไม่มี round5b-demo.cs — ข้าม)"); return; }
  const t = fs.readFileSync(f, "utf8"), m = /\/\/ sa-spec: (.*)/.exec(t);
  const want = m ? JSON.parse(m[1]) : JSON.parse(Buffer.from(/\/\/ sa-spec-b64: (.*)/.exec(t)[1].trim(), "base64").toString("utf8"));
  if (JSON.stringify(want) !== JSON.stringify(buildRound5b())) throw new Error("spec ไม่ตรงกับไฟล์");
});

module.exports = { buildRound5b };
console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
