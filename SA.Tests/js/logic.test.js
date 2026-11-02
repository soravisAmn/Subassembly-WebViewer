// ทดสอบกิ่งของรอบ 4 M2 (logic.conditions / decisions / branches + firstOf ใน spec.js, clone กิ่งใน ops.js)
// รัน: node SA.Tests/js/logic.test.js
// (ไม่มี node: รันใน console ของหน้าเว็บได้ด้วย globalThis.SA_LIB = { Expr, Spec, Ops } แล้ว eval ไฟล์นี้ในฟังก์ชัน)
"use strict";
const { Expr, Spec, Ops } = typeof require === "function" ? (() => {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
  const ctx = vm.createContext({ console });
  vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("ops.js") + "\nthis.Expr = Expr; this.Spec = Spec; this.Ops = Ops;", ctx);
  return ctx;
})() : globalThis.SA_LIB;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const near = (exp, act, what, tol = 1e-3) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };

// ผิวดิน: ขวาสูง (ที่ x = 3 สูง 2.1 = ตัด) ซ้ายต่ำ (ที่ x = -3 สูง -1.4 = ถมสูง 1.4)
const surf = [{ x: -30, y: -5 }, { x: 0, y: -1 }, { x: 30, y: 30 }];
const run = (s, o = {}) => Spec.evaluate(s, { values: o.values || {}, codeParams: [], codePoints: [], surface: o.surface === undefined ? surf : o.surface,
                                             extendEnds: true, layout: !!o.layout });
const P = (r, id) => { const p = r.pts[id]; if (!p || p.err) throw new Error(`จุด ${id}: ${p ? p.err : "ไม่มี"}`); return p; };
const off = (r, id, what) => ok(r.pts[id] && r.pts[id].off, `${what || id}: ต้องไม่เกิด (ได้ ${JSON.stringify(r.pts[id])})`);
const pt = (id, def, extra) => ({ id, codes: [], def, ...extra });

// ตัด / ถม ที่ hinge: ตัด = ลาด 2:1 ขึ้นชนดิน · ถม = ลาด 1:2 ลงชนดิน · ถมสูง (> 1 m) มีชั้นพัก
function cutFill(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Width", kind: "double", default: 3, min: null, max: null });
  s.points = [
    pt("P1", { type: "origin" }),
    pt("P2", { type: "delta", from: "P1", dx: "Width", dy: "0" }),
    pt("P3", { type: "slopeToSurface", from: "P2", slope: "2", dir: 1, target: "TargetSurface", maxDistance: "50", layoutLength: "2" }, { branch: "B1" }),
    pt("P4", { type: "slopeToSurface", from: "P2", slope: "-0.5", dir: 1, target: "TargetSurface", maxDistance: "50", layoutLength: "3" }, { branch: "B2" }),
    pt("P5", { type: "firstOf", points: ["P3", "P4"] }, { auxiliary: true }),
    pt("P6", { type: "delta", from: "P5", dx: "1", dy: "0" }),
    pt("P7", { type: "delta", from: "P4", dx: "2", dy: "0" }, { branch: "B3" }),
    pt("P8", { type: "delta", from: "P3", dx: "1", dy: "if(IsCut, 1, 0)" })           // ไม่อยู่ในกิ่ง แต่อ้าง P3 -> ไม่เกิดตาม (ไม่เตือน)
  ];
  s.links = [
    { id: "L1", points: ["P1", "P2"], codes: [] },
    { id: "L2", points: ["P2", "P3"], codes: [], branch: "B1" },
    { id: "L3", points: ["P2", "P4"], codes: [], branch: "B2" },
    { id: "L4", points: ["P4", "P7"], codes: [], branch: "B3" },
    { id: "L5", points: ["P2", "P6"], codes: [] }
  ];
  s.logic = {
    conditions: [{ id: "C1", name: "IsCut", expr: "ground(P2) > P2.y" },
                 { id: "C2", name: "HighFill", expr: "P2.y - ground(P2) > 1 and not IsCut" }],
    decisions: [{ id: "D1", kind: "if", test: "IsCut", label: "ตัดไหม" },
                { id: "D2", parent: "B2", kind: "if", test: "HighFill", label: "ถมสูงไหม" }],
    branches: [{ id: "B1", decision: "D1", case: true, label: "ตัด" }, { id: "B2", decision: "D1", case: false, label: "ถม" },
               { id: "B3", decision: "D2", case: true, label: "ถมสูง" }, { id: "B4", decision: "D2", case: false, label: "ถมต่ำ" }]
  };
  return s;
}

console.log("กิ่ง if / กิ่งซ้อน / firstOf");
test("Right (ตัด): P3 เกิด, P4 / P7 ไม่เกิด, firstOf = P3, ต่อเรขาคณิตหลังกิ่ง", () => {
  const r = run(cutFill());
  eq(true, r.logic.conds.IsCut, "IsCut"); eq(false, r.logic.conds.HighFill, "HighFill");
  eq(true, r.logic.branches.B1, "B1"); eq(false, r.logic.branches.B2, "B2"); eq(false, r.logic.branches.B3, "B3 (กิ่งแม่ไม่เกิด)");
  near(5.1724, P(r, "P3").x, "P3.x"); near(4.3448, P(r, "P3").y, "P3.y");
  off(r, "P4"); off(r, "P7");
  near(P(r, "P3").x, P(r, "P5").x, "firstOf = P3"); near(P(r, "P3").x + 1, P(r, "P6").x, "P6 ต่อจาก firstOf");
  near(P(r, "P3").y + 1, P(r, "P8").y, "IsCut ในนิพจน์ = จริง");
  ok(!r.links.L2.err && r.links.L3.off && r.links.L4.off, "link ตามกิ่ง");
  eq(0, r.issues.length, "ไม่มีเตือน: " + r.issues.map(i => i.msg).join(" | "));
});
test("Left (ถมสูง): กิ่งซ้อนเกิด, P3 / P8 ไม่เกิด (P8 ไม่เกิดตาม P3 ไม่เตือน)", () => {
  const r = run(cutFill(), { values: { Side: 1 } });
  eq(false, r.logic.conds.IsCut, "IsCut"); eq(true, r.logic.conds.HighFill, "HighFill");
  eq(true, r.logic.branches.B2, "B2"); eq(true, r.logic.branches.B3, "B3");
  off(r, "P3"); off(r, "P8", "P8 (อ้าง P3)");
  near(-6.8182, P(r, "P4").x, "P4.x"); near(-1.9091, P(r, "P4").y, "P4.y");
  near(-8.8182, P(r, "P7").x, "P7 ชั้นพัก (บนจอ ไปทางซ้าย)");
  near(P(r, "P4").x - 1, P(r, "P6").x, "firstOf = P4 (P6 ไปทางนอก = ซ้าย)");
  eq(0, r.issues.length, "ไม่มีเตือน: " + r.issues.map(i => i.msg).join(" | "));
});
test("ถมต่ำ: ดินราบที่ -0.5 -> ถม 0.5 m = กิ่ง ถมต่ำ", () => {
  const r = run(cutFill(), { values: { Side: 1 }, surface: [{ x: -30, y: -0.5 }, { x: 30, y: -0.5 }] });
  eq(false, r.logic.conds.IsCut, "ถม"); eq(false, r.logic.conds.HighFill, "ถมไม่ถึง 1 m");
  eq(true, r.logic.branches.B4, "B4"); off(r, "P7");
});
test("ไม่มีผิวดิน: ground() = ระดับของจุดเอง -> ไม่ใช่ตัด -> ถม (ยาว layoutLength) · Layout ไม่เตือน", () => {
  const r = run(cutFill(), { surface: null, layout: true });
  eq(false, r.logic.conds.IsCut, "IsCut"); off(r, "P3");
  near(6, P(r, "P4").x, "P4 = layoutLength 3"); near(7, P(r, "P6").x, "firstOf = P4");
  eq(0, r.issues.length, "Layout ไม่เตือน");
});
test("เงื่อนไขไม่รู้ค่า (อ้างจุดที่ไม่มี) = null + เตือน -> ไม่เข้ากิ่งไหน -> firstOf ไม่มีจุด = หาไม่ได้ + เตือน", () => {
  const s = cutFill(); s.logic.conditions[0].expr = "P9.y > 0";
  const r = run(s);
  eq(null, r.logic.conds.IsCut, "IsCut ไม่รู้ค่า"); eq(false, r.logic.conds.HighFill, "HighFill: ส่วนแรกเท็จ -> ลัดวงจร ไม่ต้องรู้ IsCut");
  eq(false, r.logic.branches.B1, "B1"); eq(false, r.logic.branches.B2, "B2");
  off(r, "P3"); off(r, "P4");
  ok(r.pts.P5.err && !r.pts.P5.off, "P5 หาไม่ได้ (error ไม่ใช่ไม่เกิด)");
  ok(r.issues.some(i => i.msg.includes("เงื่อนไข IsCut")), "เตือนเงื่อนไข");
  ok(r.issues.some(i => i.msg.includes("P5")), "เตือน firstOf");
});
test("อ้างจุดที่ไม่เกิดในนิพจน์ (ไม่ใช่ exists) = error + เตือน · exists(จุดที่ไม่เกิด) = เท็จ", () => {
  const s = cutFill();
  s.points.push(pt("P9", { type: "delta", from: "P1", dx: "P4.x", dy: "0" }), pt("P10", { type: "delta", from: "P1", dx: "if(exists(P4), 1, 2)", dy: "0" }));
  const r = run(s);
  ok(r.pts.P9.err && !r.pts.P9.off, "P9 error"); ok(r.issues.some(i => i.msg.includes("P9")), "เตือน P9");
  near(2, P(r, "P10").x, "exists(P4) เท็จ");
});
test("shape ที่ link อยู่ในกิ่งที่ไม่เกิด = ไม่เกิด (ไม่เตือน) · shape อยู่ในกิ่งเดียวกัน", () => {
  const s = cutFill();
  s.links.push({ id: "L6", points: ["P3", "P1"], codes: [], branch: "B1" });
  s.shapes = [{ id: "S1", links: ["L1", "L2", "L6"], codes: ["Cut"], branch: "B1" }];
  const a = run(s), b = run(s, { values: { Side: 1 } });
  ok(!a.shapes.S1.err, "ตัด: S1 เกิด"); ok(b.shapes.S1.off, "ถม: S1 ไม่เกิด"); eq(0, b.issues.length, "ไม่เตือน");
});

console.log("switch / else");
function sw(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Lanes", kind: "long", default: 2, min: null, max: null });
  s.points = [pt("P1", { type: "origin" }),
              pt("P2", { type: "delta", from: "P1", dx: "3", dy: "0" }, { branch: "B1" }),
              pt("P3", { type: "delta", from: "P1", dx: "6", dy: "0" }, { branch: "B2" }),
              pt("P4", { type: "delta", from: "P1", dx: "1", dy: "-1" }, { branch: "B3" }),
              pt("P5", { type: "firstOf", points: ["P2", "P3", "P4"] })];
  s.logic = { conditions: [],
              decisions: [{ id: "D1", kind: "switch", test: "Lanes", label: "จำนวนช่อง" }],
              branches: [{ id: "B1", decision: "D1", case: 1, label: "1 ช่อง" }, { id: "B2", decision: "D1", case: 2, label: "2 ช่อง" },
                         { id: "B3", decision: "D1", case: "else", label: "อื่นๆ" }] };
  return s;
}
test("switch ตัวเลข: case ตรง / else = ไม่ตรงกิ่งอื่นเลย", () => {
  near(6, P(run(sw()), "P5").x, "Lanes 2"); near(3, P(run(sw(), { values: { Lanes: 1 } }), "P5").x, "Lanes 1");
  const r = run(sw(), { values: { Lanes: 5 } });
  eq(5, r.logic.decisions.D1, "ค่า switch"); off(r, "P2"); off(r, "P3"); near(1, P(r, "P5").x, "else");
});
test("caseMatch: if รับ true / \"true\" · switch ใช้ tolerance ของ ==", () => {
  const lg = sw().logic, d = lg.decisions[0];
  eq(true, Spec.caseMatch(lg, d, lg.branches[1], 2.0000001), "tolerance"); eq(false, Spec.caseMatch(lg, d, lg.branches[2], 2), "else ไม่ตรงเมื่อมี case 2");
  eq(true, Spec.caseMatch(lg, { kind: "if" }, { case: "true" }, true), "\"true\""); eq(false, Spec.caseMatch(lg, d, lg.branches[0], null), "null = ไม่ตรง");
});

console.log("ตรวจตอนออกแบบ / clone");
test("branchChain / branchLabel / branchRisks", () => {
  const s = cutFill();
  eq("B3,B2", Spec.branchChain(s, "B3").join(","), "chain"); eq("ถมสูง", Spec.branchLabel(s, "B3"), "label");
  const risks = Spec.branchRisks(s);
  ok(risks.some(x => x.id === "P8" && x.ref === "P3" && x.branch === "B1"), "P8 อ้าง P3 (กิ่ง ตัด): " + JSON.stringify(risks));
  ok(!risks.some(x => ["P5", "P6", "P7", "L4"].includes(x.id)), "firstOf / ของในกิ่งเดียวกัน / กิ่งลูก ไม่นับ: " + JSON.stringify(risks));
  ok(!risks.some(x => x.id === "P10"), "ไม่มี P10");
});
test("refs นับรายการของ firstOf · ลบ P3 = P5 ที่ใช้ P3 หายด้วย", () => {
  const s = cutFill();
  eq("P3,P4", Spec.refs(s.points[4].def).join(","), "refs firstOf");
  ok(Spec.removeCascade(s, "point", "P3").includes("P5"), "ลบตาม");
});
test("exprOpts มีชื่อเงื่อนไข · เงื่อนไขในนิพจน์ตัวเลขใช้ใน if() ได้", () => {
  const s = cutFill(), o = Spec.exprOpts(s);
  eq("IsCut,HighFill", o.conds.join(","), "conds");
  ok(Expr.check("if(IsCut, 1, 2)", Spec.names(s), o).ok, "if(IsCut, ...)");
  ok(!Expr.check("IsCut + 1", Spec.names(s), o).ok, "IsCut + 1 ใช้ไม่ได้");
});
test("clone ในตัวเดิม: คงกิ่ง, remap firstOf / จุดในนิพจน์ · วางในตัวอื่น (detach): ไม่มีกิ่ง", () => {
  const s = cutFill();
  const c = Ops.clone(s, Ops.expand(s, { points: ["P3", "P4", "P5"] }), s);
  const [n3, n4, n5] = ["P3", "P4", "P5"].map(id => Spec.byId(s.points, c.map[id]));
  eq("B1", n3.branch, "กิ่ง P3"); eq("B2", n4.branch, "กิ่ง P4");
  eq(`${n3.id},${n4.id}`, n5.def.points.join(","), "firstOf remap");
  const s2 = cutFill(); s2.points.push(pt("P9", { type: "delta", from: "P2", dx: "P2.x", dy: "ground(P2) - P2.y" }));
  const c2 = Ops.clone(s2, Ops.expand(s2, { points: ["P2", "P9"] }), s2), n9 = Spec.byId(s2.points, c2.map.P9);
  eq(`${c2.map.P2}.x`, n9.def.dx, "P2.x remap"); eq(`ground(${c2.map.P2}) - ${c2.map.P2}.y`, n9.def.dy, "ground remap");
  const dst = Spec.newSpec("U"), pos = {}; for (const id of ["P1", "P2", "P3"]) pos[id] = { x: 1, y: 1 };
  const c3 = Ops.clone(s, Ops.expand(s, { links: ["L2"] }), dst, { detach: true, pos, F: 1, names: Spec.names(dst) });
  ok(dst.points.every(p => !p.branch) && dst.links.every(l => !l.branch), "detach ไม่มีกิ่ง");
});

console.log("ปุ่มสำเร็จรูป ถ้าตัด / ถม (Spec.addCutFill)");
function hingeSpec(){
  const s = Spec.newSpec("CutFillButton");
  s.points.push(pt("P2", { type: "delta", from: "P1", dx: "3", dy: "0" }, { codes: ["Shoulder"] }));
  s.links.push({ id: "L1", points: ["P1", "P2"], codes: ["Top"] });
  return s;
}
const cfOpts = { hinge: "P2", cut: 1.5, fill: 2, params: true, dir: 1, cutCode: "Daylight_Cut", fillCode: "Daylight_Fill" };
test("ได้ชุดเดียวกับ drawing-cases (CutFillButton) ทุกตัว: parameter, เงื่อนไข, กิ่ง, จุดลาด, link, Daylight", () => {
  const s = hingeSpec(), r = Spec.addCutFill(s, cfOpts);
  eq("C1 D1 B1 B2 P3 P4 P5 L2 L3", [r.cond, r.decision, r.yes, r.no, r.cut.point, r.fill.point, r.daylight, r.cut.link, r.fill.link].join(" "), "id");
  const fs = typeof require === "function" ? require("fs") : null, path = typeof require === "function" ? require("path") : null;
  if (!fs) return;
  const ref = JSON.parse(fs.readFileSync(path.join(__dirname, "drawing-cases.json"), "utf8")).find(c => c.spec && c.spec.className === "CutFillButton").spec;
  const pick = o => JSON.stringify(o);
  eq(pick(ref.params), pick(s.params), "params");
  eq(pick(ref.logic), pick(s.logic), "logic");
  eq(pick(ref.points.slice(0, 5)), pick(s.points), "points");
  eq(pick(ref.links.slice(0, 3)), pick(s.links), "links");
});
test("ตัด / ถม สลับตามผิวดิน (ลากผิวดินขึ้นลง) · Daylight ตามกิ่งที่เกิด · ไม่มีเตือน", () => {
  const s = hingeSpec(); Spec.addCutFill(s, cfOpts);
  const hi = run(s, { surface: [{ x: -30, y: 5 }, { x: 30, y: 5 }] }), lo = run(s, { surface: [{ x: -30, y: -4 }, { x: 30, y: -4 }] });
  near(10.5, P(hi, "P3").x, "ตัด 1:1.5 ขึ้น 5 m"); off(hi, "P4"); near(10.5, P(hi, "P5").x, "Daylight = P3");
  near(11, P(lo, "P4").x, "ถม 1:2 ลง 4 m"); off(lo, "P3"); near(11, P(lo, "P5").x, "Daylight = P4");
  eq(0, hi.issues.length + lo.issues.length, "ไม่มีเตือน");
  const L = run(s, { values: { Side: 1 }, surface: [{ x: -30, y: -8 }, { x: 30, y: 8 }] });
  eq(false, L.logic.conds.IsCut, "Left ผิวดินต่ำ = ถม"); ok(P(L, "P4").x < -3, "ถมไปทางซ้าย");
  near(9, P(run(s, { values: { CutSlope: 1.2 }, surface: [{ x: -30, y: 5 }, { x: 30, y: 5 }] }), "P3").x, "CutSlope = 1.2 -> 3 + 6");
});
test("ไม่สร้าง parameter = ลาดเป็นตัวเลข · target ที่สอง = ground(P2, \"ชื่อ\") · ทิศเข้าด้านใน", () => {
  const s = hingeSpec(); s.targets.push({ name: "Rock", type: "Surface", displayName: "Rock" });
  Spec.addCutFill(s, { ...cfOpts, params: false, target: "Rock", dir: -1 });
  eq(1, s.params.length, "ไม่มี parameter เพิ่ม");
  eq("1/1.5", Spec.byId(s.points, "P3").def.slope, "ลาดตัด"); eq("-1/2", Spec.byId(s.points, "P4").def.slope, "ลาดถม");
  eq('ground(P2, "Rock") > P2.y', s.logic.conditions[0].expr, "target"); eq(-1, Spec.byId(s.points, "P4").def.dir, "ทิศ");
  ok(Expr.check(s.logic.conditions[0].expr, Spec.names(s), { ...Spec.exprOpts(s), want: "bool" }).ok, "นิพจน์ผ่านการตรวจ");
});
test("กดซ้ำที่จุดอื่น: ชื่อไม่ชน (IsCut2, CutSlope2, ป้าย ตัด P6) · บานพับในกิ่ง = กิ่งใหม่ซ้อนใต้กิ่งนั้น", () => {
  const s = hingeSpec(); const a = Spec.addCutFill(s, cfOpts);
  const r = Spec.addCutFill(s, { ...cfOpts, hinge: a.cut.point });
  eq("IsCut2", Spec.byId(s.logic.conditions, r.cond).name, "ชื่อเงื่อนไข"); ok(s.params.some(p => p.name === "CutSlope2"), "CutSlope2");
  eq(`ตัด ${a.cut.point}`, Spec.branchLabel(s, r.yes), "ป้ายกิ่ง"); eq(a.yes, Spec.byId(s.logic.decisions, r.decision).parent, "ซ้อนใต้กิ่ง ตัด");
  eq(a.yes, Spec.byId(s.points, r.daylight).branch, "Daylight อยู่กิ่งเดียวกับบานพับ");
  eq(0, Spec.branchRisks(s).length, "ไม่มีความเสี่ยงอ้างข้ามกิ่ง: " + JSON.stringify(Spec.branchRisks(s)));
});

console.log("แสดงทุกกรณี / แผง Logic (M4)");
test("allBranches: object ในกิ่งที่ไม่เกิดมีตำแหน่ง (ลาดที่ไม่ชนดิน = ยาว layoutLength) · ไม่กระทบผลจริง", () => {
  const s = hingeSpec(); Spec.addCutFill(s, cfOpts);
  const surf5 = [{ x: -30, y: 5 }, { x: 30, y: 5 }];
  const real = run(s, { surface: surf5 }), all = Spec.evaluate(s, { values: {}, codeParams: [], codePoints: [], surface: surf5, extendEnds: true, allBranches: true });
  off(real, "P4"); ok(!all.pts.P4.err, "P4 มีตำแหน่งตอนทุกกิ่งเกิด");
  near(6, all.pts.P4.x, "ลาดถมลงไม่ชนดินที่สูงกว่า = ยาว 3 m (layoutLength)"); near(-1.5, all.pts.P4.y, "P4.y");
  near(real.pts.P3.x, all.pts.P3.x, "P3 เหมือนเดิม"); ok(!all.links.L3.err, "L3 มีเส้น");
  eq(0, all.issues.filter(i => i.msg.includes("ลาดจนชนดิน")).length, "ไม่เตือนลาดที่ไม่ชน");
});
test("กิ่งที่ไม่มี object ก็รู้ค่า (scenario coverage) · decision ซ้อนคำนวณเมื่อกิ่งแม่เกิด", () => {
  const s = sw(); s.points = s.points.filter(p => p.branch !== "B2");
  const r = run(s);
  eq(true, r.logic.branches.B2, "B2 ไม่มี object แต่เกิด (Lanes = 2)"); eq(false, r.logic.branches.B1, "B1");
});
test("branchObjects / condUses / renameCond (นิพจน์ + test + ป้าย ไม่ IsCut เปลี่ยนตาม)", () => {
  const s = cutFill();
  eq("dpt:P3,dlink:L2", Spec.branchObjects(s, "B1").map(o => o.kind + ":" + o.id).join(","), "object ในกิ่ง ตัด");
  eq("P8,HighFill", Spec.condUses(s, "IsCut").join(","), "ที่ใช้ IsCut (ไม่นับ test ของ D1)");
  s.logic.branches[1].label = "ไม่ IsCut";
  Spec.renameCond(s, "IsCut", "Cut");
  eq("Cut", s.logic.conditions[0].name, "ชื่อ"); eq("Cut", s.logic.decisions[0].test, "test");
  eq("if(Cut, 1, 0)", Spec.byId(s.points, "P8").def.dy, "นิพจน์ของจุด"); eq("P2.y - ground(P2) > 1 and not Cut", s.logic.conditions[1].expr, "เงื่อนไขอื่น");
  eq("ไม่ Cut", s.logic.branches[1].label, "ป้ายกิ่ง ไม่ ...");
  near(5.1724, P(run(s), "P3").x, "ยังคำนวณได้เหมือนเดิม");
});
test("เปลี่ยนชื่อ parameter แล้วเงื่อนไขเปลี่ยนตาม (exprSlots รวม logic)", () => {
  const s = cutFill(); s.logic.conditions[0].expr = "ground(P2) > P2.y + Width - 3";
  ok(Spec.exprSlots(s).some(x => x.obj === s.logic.conditions[0]), "slot ของเงื่อนไข");
  ok(Spec.exprSlots(s).some(x => x.obj === s.logic.decisions[0] && x.key === "test"), "slot ของ decision");
});
test("removeDecision: ย้าย object ไปกิ่งแม่ / เกิดเสมอ · ลบ object · เงื่อนไขที่ไม่มีใครใช้หายด้วย", () => {
  const a = cutFill(); a.points = a.points.filter(p => p.id !== "P8");
  Spec.removeDecision(a, "D2", "move");
  eq("B2", Spec.byId(a.points, "P7").branch, "P7 ไปกิ่งแม่ (ถม)"); eq("B2", Spec.byId(a.links, "L4").branch, "L4 ไปกิ่งแม่");
  eq("IsCut", a.logic.conditions.map(c => c.name).join(","), "HighFill หาย (ไม่มีใครใช้)"); eq("B1,B2", a.logic.branches.map(b => b.id).join(","), "กิ่งที่เหลือ");
  const b = cutFill(); b.points = b.points.filter(p => p.id !== "P8");
  Spec.removeDecision(b, "D1", "move");
  ok(b.points.every(p => !p.branch) && b.links.every(l => !l.branch), "ลบ D1 (และ D2 ข้างใน) = ทุกอย่างเกิดเสมอ");
  eq(0, b.logic.decisions.length + b.logic.branches.length + b.logic.conditions.length, "logic ว่าง");
  const c = cutFill(); c.points = c.points.filter(p => p.id !== "P8");
  const gone = Spec.removeDecision(c, "D2", "remove");
  ok(gone.includes("P7") && gone.includes("L4") && !Spec.byId(c.points, "P7"), "ลบ P7 / L4: " + gone.join(","));
  const d = cutFill();
  Spec.removeDecision(d, "D1", "move");
  ok(d.logic.conditions.some(x => x.name === "IsCut"), "IsCut ยังอยู่ (P8 ใช้ในนิพจน์)");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process !== "undefined") process.exitCode = failed ? 1 : 0;
