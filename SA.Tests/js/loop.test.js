// ทดสอบ Array แบบ Loop ของรอบ 5b M1 (spec.arrays[].loop — evaluate ใน spec.js + Logic.addArray / updateArray / setArrayLoop / removeArray)
// รัน: node SA.Tests/js/loop.test.js · ผล JS = C# อยู่ใน drawing-cases.json (Loop) — DrawingTests เทียบข้อความเตือนตรงตัว
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("logicops.js") + "\nthis.Expr = Expr; this.Spec = Spec; this.Logic = Logic;", ctx);
const { Expr, Spec, Logic } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { const a = JSON.stringify(act), b = JSON.stringify(exp); if (a !== b) throw new Error(`${what}: คาด ${b} ได้ ${a}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const good = r => { if (!r || r.ok !== true) throw new Error(r && r.error); return r; };
function bad(s, fn, re, what){
  const before = JSON.stringify(s), r = fn();
  if (!r || r.ok !== false) throw new Error(`${what}: ต้อง error แต่ได้ ${JSON.stringify(r)}`);
  if (re && !re.test(r.error)) throw new Error(`${what}: "${r.error}" ไม่ตรง ${re}`);
  if (JSON.stringify(s) !== before) throw new Error(`${what}: error แล้ว spec เปลี่ยน`);
}
const run = (s, values, surface) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: surface || null, extendEnds: true, layout: !surface });
const on = (r, id) => !!(r.pts[id] || r.links[id] || r.shapes[id]) && !(r.pts[id] || r.links[id] || r.shapes[id]).err;
const msgs = (r, lv) => r.issues.filter(i => i.level === lv).map(i => i.msg);
// ขั้นบันได: P2 → P3 (ลง 1) · ชุดต่อด้วยจุดร่วม (P3 ของชุดก่อน = P2 ของชุดถัดไป) · N = Height / Step
function stairs(loop, extra){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Height", kind: "double", default: 7, displayName: "Height", min: null, max: null }, { name: "Step", kind: "double", default: 3, displayName: "Step", min: null, max: null });
  const a = Spec.addPoint(s, { type: "delta", from: "P1", dx: "2", dy: "0" }, ["Top"]);
  const b = Spec.addPoint(s, { type: "delta", from: a, dx: "0", dy: "-1" }, ["Toe"]);
  Spec.addLink(s, "P1", a, { points: ["P1", a] });
  const l = Spec.addLink(s, a, b, { points: [a, b] }); Spec.byId(s.links, l).codes = ["Riser"];
  const g = good(Logic.addArray(s, { points: [a, b], links: [l], shapes: [] }, { n: 2, dx: "2", dy: "-1", join: { mode: "share", from: b, to: a }, loop, ...(extra || {}) }));
  return { s, g: Spec.byId(s.arrays, g.id) };
}
// จุดใหม่ของชุดที่ k (join share = จุดเดียวต่อชุด)
const setPt = (g, k) => k === 0 ? g.source.points[1] : g.members[k - 1].points[0];

console.log("Array แบบ Loop (รอบ 5b M1)");

test("floor / ceil / round ในนิพจน์: round .5 ออกจากศูนย์ (2.5 → 3, -2.5 → -3) = C# AwayFromZero", () => {
  const v = s => Expr.value(s, {});
  eq([2, 3, 3, -3, 2, -2, -1, 3, -3], ["floor(7/3)", "ceil(7/3)", "round(2.5)", "round(-2.5)", "round(2.4)", "floor(-1.5)", "ceil(-1.5)", "round(3.4999999)", "round(-2.6)"].map(v), "ค่า");
  ok(Expr.check("floor(Height)", ["Height"]).ok && !Expr.check("floor(1, 2)", []).ok, "จำนวนอาร์กิวเมนต์");
});

test("สร้าง: สมาชิกครบ nMax ชุด (ค่าเริ่ม 10) · Array แบบเดิม (ไม่มี loop) ผลเหมือนเดิม", () => {
  const { g } = stairs({ n: "Height / Step" });
  eq({ n: 10, nMax: 10, members: 9 }, { n: g.n, nMax: g.loop.nMax, members: g.members.length }, "nMax 10");
  const old = stairs(undefined, { n: 4 }); ok(!old.g.loop && old.g.members.length === 3, "Array N คงที่");
  const r = run(old.s); ok(old.g.members.every(m => on(r, m.points[0])), "เกิดทุกชุด"); eq(0, r.issues.length, "ไม่เตือน");
});

test("N = 1, 2, nMax · ชุดที่ k เกิดเมื่อ k < N · link / จุดของชุดที่ไม่เกิด = off ไม่เตือน", () => {
  const { s, g } = stairs({ n: "Height / Step", nMax: 4 });
  const count = r => [0, 1, 2, 3].filter(k => on(r, setPt(g, k))).length;
  for (const [H, n] of [[3, 1], [6, 2], [12, 4]]){
    const r = run(s, { Height: H }); eq(n, r.logic.loops[g.id], `N ที่ Height ${H}`); eq(n, count(r), `จุดที่เกิด H ${H}`);
    eq([], msgs(r, "w"), `ไม่เตือน H ${H}`);
    ok(g.members.every((m, i) => on(r, m.links[0]) === (i + 1 < n)), "link ตามชุด");
    if (n < 4){ const q = r.pts[setPt(g, n)]; ok(q.off === `${g.id}#${n}` && /ไม่เกิด \(A1 ชุดที่/.test(q.err), "off แบบกิ่ง: " + JSON.stringify(q)); }
  }
});

test("⚠ เกินสูงสุด / น้อยกว่า 1 / หาค่าไม่ได้ (ข้อความเดียวกับ C#) · ℹ ปัดลงค่าเริ่ม (เว็บเท่านั้น)", () => {
  const { s, g } = stairs({ n: "Height / Step", nMax: 4 });
  let r = run(s, { Height: 20 });
  eq(4, r.logic.loops.A1, "บีบ"); eq(["Array A1: ต้องการ 6 ชุด เกินสูงสุด 4 ใช้ 4"], msgs(r, "w"), "เกิน");
  eq(['Array A1: N = 6.6667 → 6 ชุด (ปัดลง — ค่าเริ่มต้น เปลี่ยนได้ที่ "ปัดเศษ N")'], msgs(r, "i"), "ℹ ปัดลงค่าเริ่ม");
  r = run(s, { Height: 2 }); eq(1, r.logic.loops.A1, "< 1"); eq(["Array A1: ได้ 0 ชุด น้อยกว่า 1 ใช้ 1"], msgs(r, "w"), "น้อยกว่า 1");
  r = run(s, { Height: 6 }); eq([], msgs(r, "i"), "จำนวนเต็ม = ไม่มี ℹ");
  good(Logic.updateArray(s, g.id, { nRound: "floor" })); r = run(s, { Height: 7 }); eq([], msgs(r, "i"), "ผู้ใช้เลือกปัดลงเอง = ไม่มี ℹ");
  // อ้างจุดที่ไม่เกิด → 1 + เตือน
  const t = stairs({ n: "Height / Step", nMax: 4 }).s, c = good(Logic.addCondition(t, { name: "Never", expr: "false" }));
  const p = Spec.addPoint(t, { type: "delta", from: "P1", dx: "0", dy: "5" }, []); good(Logic.setBranch(t, [p], c.yes));
  good(Logic.updateArray(t, "A1", { n: `${p}.y` }));
  r = run(t, {}); eq(1, r.logic.loops.A1, "ไม่รู้ค่า = 1"); eq(["Array A1: หาจำนวนชุดไม่ได้ ใช้ 1"], msgs(r, "w"), "เตือน");
});

test("ปัดเศษ N: ลง / ขึ้น / ใกล้สุด (.5 ออกจากศูนย์) · ค่าติดลบ", () => {
  const { s } = stairs({ n: "Height / Step", nMax: 9 });
  const N = (mode, H, S) => { good(Logic.updateArray(s, "A1", { nRound: mode })); return run(s, { Height: H, Step: S || 3 }).logic.loops.A1; };
  eq([2, 3, 2, 3], [N("floor", 7), N("ceil", 7), N("round", 7), N("round", 7.5)], "7/3 และ 7.5/3 = 2.5");
  eq(3, N("round", 7.5, 3), ".5 ปัดขึ้น");
  eq(1, N("ceil", -0.9, 3), "ceil(-0.3) = 0 → 1");
});

test("join link / shape ในชุด / Array ในกิ่ง (ต้องจริงทั้งกิ่งและ k < N)", () => {
  const s = Spec.newSpec("T"); s.params.push({ name: "K", kind: "double", default: 2, displayName: "K", min: null, max: null });
  const a = Spec.addPoint(s, { type: "delta", from: "P1", dx: "1", dy: "0" }, []), b = Spec.addPoint(s, { type: "delta", from: a, dx: "1", dy: "0" }, []), c = Spec.addPoint(s, { type: "delta", from: a, dx: "0", dy: "-1" }, []);
  const L = [Spec.addLink(s, a, b, { points: [a, b] }), Spec.addLink(s, b, c, { points: [b, c] }), Spec.addLink(s, c, a, { points: [c, a] })];
  const sh = Spec.addShape(s, L);
  const cnd = good(Logic.addCondition(s, { name: "Go", expr: "K > 0" }));
  good(Logic.setBranch(s, [a, b, c, ...L, sh], cnd.yes));
  const gid = good(Logic.addArray(s, { points: [a, b, c], links: L, shapes: [sh] }, { n: 2, dx: "3", dy: "0", join: { mode: "link", from: b, to: a }, loop: { n: "K", nMax: 3 } })).id;
  const g = Spec.byId(s.arrays, gid);
  let r = run(s, { K: 2 });
  ok(on(r, g.members[0].shapes[0]) && !on(r, g.members[1].shapes[0]), "shape ชุด 2 เกิด ชุด 3 ไม่");
  ok(on(r, g.members[0].links[3]) && !on(r, g.members[1].links[3]), "link ต่อชุด");
  r = run(s, { K: -5 }); ok(!on(r, a) && !on(r, g.members[0].points[0]), "กิ่งไม่เกิด = ทั้ง Array ไม่เกิด");
});

test("Logic API: แปลง Array ↔ Loop · แก้ nMax (สร้างใหม่) · มีของนอกอ้างสมาชิก = ไม่ยอม · removeArray · error ไม่แก้ spec", () => {
  const { s, g } = stairs(undefined, { n: 3 });
  good(Logic.setArrayLoop(s, "A1", { n: "Height / Step", nMax: 5, nRound: "ceil" }));
  let A = Spec.byId(s.arrays, "A1"); eq({ n: "Height / Step", nMax: 5, nRound: "ceil" }, A.loop, "เปิด Loop"); eq(4, A.members.length, "สร้าง 5 ชุด");
  eq(3, run(s, { Height: 7 }).logic.loops.A1, "ceil(2.33) = 3");
  good(Logic.updateArray(s, "A1", { nMax: 3 })); A = Spec.byId(s.arrays, "A1"); eq(2, A.members.length, "nMax 3");
  good(Logic.setArrayLoop(s, "A1", null)); A = Spec.byId(s.arrays, "A1"); ok(!A.loop && A.n === 3, "ปิด Loop = N คงที่");
  bad(s, () => Logic.setArrayLoop(s, "A1", { n: "Nope", nMax: 5 }), /Nope/, "N ผิด");
  bad(s, () => Logic.setArrayLoop(s, "A1", { n: "Height", nMax: 60 }), /2–50/, "nMax เกิน 50");
  bad(s, () => Logic.updateArray(s, "A1", { nRound: "ceil" }), /ไม่ใช่ Loop/, "nRound ของ Array ธรรมดา");
  good(Logic.setArrayLoop(s, "A1", { n: "Height / Step" }));
  const m = Spec.byId(s.arrays, "A1").members[1].points[0];
  Spec.addPoint(s, { type: "delta", from: m, dx: "1", dy: "0" }, []);
  bad(s, () => Logic.updateArray(s, "A1", { nMax: 4 }), /อ้างสมาชิก/, "มีของนอกอ้าง");
  bad(s, () => Logic.updateArray(s, "A1", { nRound: "up" }), /floor/, "nRound ผิด");
  const rm = good(Logic.removeArray(s, "A1")); ok(!s.arrays.length && /เกิดเสมอ/.test(rm.warnings[0]), "เลิกเป็น Array");
  const d = Logic.describe(stairs({ n: "Height / Step", nMax: 4 }).s, run(stairs({ n: "Height / Step", nMax: 4 }).s, {}));
  eq({ n: "Height / Step", nMax: 4, nRound: "floor" }, d.arrays[0].loop, "describe loop"); eq(2, d.arrays[0].value, "describe ค่าตอนนี้");
});

test("แสดงทุกกรณี (allBranches) = ทุกชุดเกิด (ไว้วาดจาง) · spec เก่าที่มี arrays แบบเดิมไม่เปลี่ยน", () => {
  const { s, g } = stairs({ n: "Height / Step", nMax: 5 });
  const r = Spec.evaluate(s, { values: { Height: 3 }, codeParams: [], codePoints: [], surface: null, extendEnds: true, layout: true, allBranches: true });
  ok(g.members.every(m => on(r, m.points[0])), "ทุกชุดเกิดในโหมดแสดงทุกกรณี");
});

console.log("\ni / lastOf / count() (รอบ 5b M2)");

test("i ใน dx / dy: ชุดที่ k แทน i = k (ต้นฉบับ 0) · แก้ dx ทีหลังก็แทนใหม่ · i ที่อื่น = error", () => {
  const { s, g } = stairs(undefined, { n: 4 });
  good(Logic.updateArray(s, "A1", { dx: "1 + 0.5 * i" }));
  eq(["1 + 0.5 * (1)", "1 + 0.5 * (2)", "1 + 0.5 * (3)"], g.members.map(m => Spec.byId(s.points, m.points[0]).def.dx), "dx ของสมาชิก");
  const r = run(s); eq([2, 3.5, 5.5, 8], [0, 1, 2, 3].map(k => +r.pts[setPt(g, k)].x.toFixed(6)), "x ของจุดล่างแต่ละชุด");
  ok(Expr.check("i * 2", [], { allowI: true }).ok && /เฉพาะใน dx/.test(Expr.check("i * 2", []).error), "i นอก dx / dy");
  bad(s, () => Logic.addCondition(s, { name: "Q", expr: "i > 1" }), /เฉพาะใน dx/, "i ในเงื่อนไข");
  ok(/ตั้งชื่อ i ไม่ได้/.test(Logic.nameError(s, "i") || ""), "ชื่อ i จองไว้");
  const s2 = stairs({ n: "Height / Step", nMax: 4 }, { dy: "-1 - i" }).s;
  eq(["-1 - (1)", "-1 - (2)", "-1 - (3)"], s2.arrays[0].members.map(m => Spec.byId(s2.points, m.points[0]).def.dy), "สร้างพร้อม i");
});

test("lastOf: จุดของชุดสุดท้ายที่เกิด (join share ไล่ถูก) · ต่อ link จริงได้ · ตามจำนวนชุดเมื่อแก้ nMax", () => {
  const { s, g } = stairs({ n: "Height / Step", nMax: 4 });
  const toe = g.source.points[1], top = g.source.points[0];
  const r1 = good(Logic.addLastOf(s, "A1", toe)), L = r1.result;
  const p = Spec.byId(s.points, L); ok(Spec.isAux(p) && Spec.isAlias(s, L), "aux = ปลายจริง");
  eq([setPt(g, 3), setPt(g, 2), setPt(g, 1), toe], p.def.points, "รายการ ชุดสุดท้าย → ต้นฉบับ");
  const T = good(Logic.addLastOf(s, "A1", top)).result;
  eq([setPt(g, 2), setPt(g, 1), toe, top], Spec.byId(s.points, T).def.points, "top ของชุด k = toe ของชุด k−1 (จุดร่วม)");
  const end = Spec.addPoint(s, { type: "delta", from: L, dx: "3", dy: "0" }, ["End"]); Spec.addLink(s, L, end, { points: [L, end] });
  for (const [H, n] of [[3, 1], [7, 2], [30, 4]]){
    const r = run(s, { Height: H });
    eq(r.pts[setPt(g, n - 1)].x, r.pts[L].x, `lastOf = ชุดที่ ${n} (Height ${H})`); eq(r.pts[L].x + 3, r.pts[end].x, "จุดหลัง Array");
  }
  eq([], Spec.branchRisks(s), "อ้าง lastOf ไม่ใช่ความเสี่ยง");
  good(Logic.updateArray(s, "A1", { nMax: 6 })); eq(6, Spec.byId(s.points, L).def.points.length, "nMax 6 = รายการยาวขึ้น (lastOf ไม่ขวาง rebuild)");
  bad(s, () => Logic.addLastOf(s, "A1", "P1"), /ไม่ใช่จุดของชุดต้นฉบับ/, "จุดนอกชุด");
  bad(s, () => Logic.addLastOf(s, "A9", toe), /ไม่มี Array/, "ไม่มี Array");
});

test("count(A1): Loop = N ตอนนี้ · Array คงที่ = n · ไม่มี Array = error · i / ชื่อผิด", () => {
  const { s } = stairs({ n: "Height / Step", nMax: 5 });
  const c = good(Logic.addCondition(s, { name: "Many", expr: "count(A1) >= 3" }));
  const q = Spec.addPoint(s, { type: "delta", from: "P1", dx: "count(A1)", dy: "-5" }, ["Cnt"]);
  for (const [H, n] of [[3, 1], [9, 3], [99, 5]]){ const r = run(s, { Height: H }); eq(n, r.pts[q].x, `count ที่ Height ${H}`); eq(n >= 3, r.logic.conds.Many, "เงื่อนไข"); }
  const old = stairs(undefined, { n: 4 }).s; const q2 = Spec.addPoint(old, { type: "delta", from: "P1", dx: "count(A1) * 2", dy: "0" }, []);
  eq(8, run(old).pts[q2].x, "Array คงที่");
  bad(s, () => Logic.addCondition(s, { name: "X", expr: "count(A7) > 1" }), /ไม่มี Array A7/, "Array ไม่มี");
  bad(s, () => Logic.addCondition(s, { name: "X", expr: "count(2) > 1" }), /ชื่อ Array/, "ไม่ใช่ชื่อ");
});

test("branchRisks: ของนอก Array อ้างจุดของชุดที่ 2.. ของ Loop = เตือน (ชุดอาจไม่เกิด) · Array คงที่ไม่เตือน", () => {
  const { s, g } = stairs({ n: "Height / Step", nMax: 4 });
  const m = setPt(g, 2), x = Spec.addPoint(s, { type: "delta", from: m, dx: "1", dy: "0" }, []);
  const rk = Spec.branchRisks(s); eq([{ id: x, kind: "point", ref: m, branch: "A1#2" }], rk.map(o => ({ id: o.id, kind: o.kind, ref: o.ref, branch: o.branch })), "risk");
  ok(/A1 ชุดที่ 3 .*lastOf/.test(Spec.branchLabel(s, "A1#2")), "ป้าย");
  const old = stairs(undefined, { n: 4 }); Spec.addPoint(old.s, { type: "delta", from: setPt(old.g, 2), dx: "1", dy: "0" }, []);
  eq([], Spec.branchRisks(old.s), "Array คงที่");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
