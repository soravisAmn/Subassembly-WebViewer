// ทดสอบ Array ของรอบ 4c M5 (Spec.addArray / updateArray / rebuildArray / arrayOf ใน spec.js)
// รัน: node SA.Tests/js/array.test.js
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
const near = (exp, act, what, tol = 1e-9) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const pt = (id, def, extra) => ({ id, codes: [], def, ...extra });
const run = (s, values) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: null, extendEnds: true, layout: true });
const P = (r, id) => { const p = r.pts[id]; if (!p || p.err) throw new Error(`จุด ${id}: ${p ? p.err : "ไม่มี"}`); return p; };

// ขั้นบันไดแบบ pavement-assembly.cs (ขั้นละ 0.3 × 0.1): P1 → P2 (ลูกนอน) → P3 (ลูกตั้ง)
function stair(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Tread", kind: "double", default: 0.3 }, { name: "Rise", kind: "double", default: 0.1 });
  s.points.push(pt("P2", { type: "delta", from: "P1", dx: "Tread", dy: "0" }, { codes: ["StepTop"] }), pt("P3", { type: "delta", from: "P2", dx: "0", dy: "-Rise" }));
  s.links.push({ id: "L1", points: ["P1", "P2"], codes: ["Tread"] }, { id: "L2", points: ["P2", "P3"], codes: ["Riser"] });
  return s;
}
const SEL = s => Ops.expand(s, { links: ["L1", "L2"] });
const SHARE = { n: 5, dx: "Tread", dy: "-Rise", join: { mode: "share", from: "P3", to: "P1" } };

test("ขั้นบันได 5 ขั้น (จุดร่วม): ไม่มีจุดซ้ำ · ชุดที่ k = ชุดก่อน + (dx, dy) · link / code ตามต้นฉบับ", () => {
  const s = stair(), g = Spec.addArray(s, SEL(s), SHARE);
  ok(!g.error, g.error);
  eq("A1", g.id, "id"); eq(4, g.members.length, "สมาชิก 4 ชุด");
  ok(g.members.every(m => m.points.length === 2 && m.links.length === 2), "ชุดละ 2 จุด 2 link");
  eq(3 + 8, s.points.length, "จุดทั้งหมด"); eq(2 + 8, s.links.length, "link ทั้งหมด");
  const [p2, p3] = g.members[0].points;
  eq(`P3,${p2}`, Spec.byId(s.links, g.members[0].links[0]).points.join(), "ลูกนอนชุด 2 เริ่มที่ P3 (จุดร่วม)");
  eq("Tread", Spec.byId(s.links, g.members[0].links[0]).codes.join(), "code link"); eq("StepTop", Spec.byId(s.points, p2).codes.join(), "code จุด");
  const d = Spec.byId(s.points, p2).def;
  ok(d.type === "delta" && d.from === "P2" && d.dx === "Tread" && d.dy === "-Rise", JSON.stringify(d));
  const r = run(s);
  ok(!r.issues.length, JSON.stringify(r.issues));
  g.members.forEach((m, k) => { const q = P(r, m.points[1]); near(0.3 * (k + 2), q.x, `x ชุด ${k + 2}`); near(-0.1 * (k + 2), q.y, `y ชุด ${k + 2}`); });
  ok(Spec.arrayOf(s, "point", p3) === g && Spec.arrayOf(s, "link", "L1") === g && !Spec.arrayOf(s, "point", "PX"), "arrayOf");
});
test("แก้ dx / dy ทีเดียว = ขยับทั้งแถว · เปลี่ยน parameter = ทุกขั้นเปลี่ยน · Side = Left ภาพกระจก", () => {
  const s = stair(), g = Spec.addArray(s, SEL(s), SHARE);
  Spec.updateArray(s, g, { dx: "0.5" });
  const last = g.members[3].points[1];
  near(0.3 + 4 * 0.5, P(run(s), last).x, "dx ใหม่");
  near(-0.5, P(run(s, { Rise: 0.1 }), last).y, "dy เดิม");
  near(-1.0, P(run(s, { Rise: 0.2 }), last).y, "Rise = 0.2");
  near(-P(run(s), last).x, P(run(s, { Side: 1 }), last).x, "Left");
  // เปลี่ยนชื่อ parameter: dy ของ array เปลี่ยนตาม
  const slot = Spec.exprSlots(s).find(x => x.obj === g && x.key === "dy");
  ok(slot, "dy ของ array เป็นช่องนิพจน์");
});
test("ต่อชุดด้วย link / ไม่ต่อ · shape + Auxiliary + กิ่ง คัดลอกด้วย", () => {
  const s = stair(), g = Spec.addArray(s, SEL(s), { n: 3, dx: "1", dy: "0", join: { mode: "link", from: "P3", to: "P1" } });
  eq(3, g.members[0].points.length, "ไม่มีจุดร่วม = 3 จุด"); eq(3, g.members[0].links.length, "2 link + link ต่อชุด");
  eq(`P3,${g.members[0].points[0]}`, Spec.byId(s.links, g.members[0].links[2]).points.join(), "link ต่อ P3 → P1 ของชุด 2");
  const t = Spec.newSpec("T");
  t.points.push(pt("P2", { type: "delta", dx: "1", dy: "0" }), pt("P3", { type: "delta", dx: "0", dy: "-1" }, { auxiliary: true, branch: "B1" }));
  t.links.push({ id: "L1", points: ["P1", "P2"], codes: [] }, { id: "L2", points: ["P2", "P3"], codes: [] }, { id: "L3", points: ["P3", "P1"], codes: [] });
  t.shapes.push({ id: "S1", links: ["L1", "L2", "L3"], codes: ["Box"] });
  const h = Spec.addArray(t, Ops.expand(t, { shapes: ["S1"] }), { n: 3, dx: "2", dy: "0" });
  eq(2, h.members.length, "2 ชุด"); eq(3, t.shapes.length, "shape 3 รูป"); eq("Box", Spec.byId(t.shapes, h.members[1].shapes[0]).codes.join(), "code shape");
  const c3 = Spec.byId(t.points, h.members[0].points[2]);
  ok(Spec.isAux(c3) && c3.branch === "B1", "aux / กิ่งตามต้นฉบับ");
});
test("เปลี่ยนจำนวนชุด = สร้างใหม่ · มีของอื่นอ้างสมาชิก = ไม่ยอม (บอกรายการ) · ข้อผิดพลาด", () => {
  const s = stair(), g = Spec.addArray(s, SEL(s), SHARE);
  ok(!Spec.rebuildArray(s, g, { n: 3 }).block.length, "สร้างใหม่ได้");
  eq(2, g.members.length, "เหลือ 2 ชุด"); eq(3 + 4, s.points.length, "จุดลดลง"); eq(2 + 4, s.links.length, "link ลดลง");
  near(-0.3, P(run(s), g.members[1].points[1]).y, "ชุดสุดท้าย");
  s.points.push(pt("P99", { type: "delta", from: g.members[1].points[1], dx: "1", dy: "0" }));
  eq("P99", Spec.rebuildArray(s, g, { n: 6 }).block.join(), "มีของอ้าง");
  eq(2, g.members.length, "ไม่เปลี่ยน");
  ok(Spec.addArray(s, SEL(s), { ...SHARE, n: 1 }).error, "n < 2");
  ok(Spec.addArray(s, SEL(s), { ...SHARE, join: { mode: "share", from: "P1", to: "P1" } }).error, "จุดต่อเดียวกัน");
  ok(Spec.addArray(s, { points: [], links: [], shapes: [] }, SHARE).error, "ไม่ได้เลือก");
  ok(Spec.addArray(s, { points: ["P2"], links: ["L1"], shapes: [] }, SHARE).error, "ปลาย link ไม่อยู่ในชุด");
});
test("ลบสมาชิก / ต้นฉบับ = เลิกเป็น Array · Move ต้นฉบับ = ทุกชุดตามเอง", () => {
  const s = stair(), g = Spec.addArray(s, SEL(s), SHARE);
  const t = JSON.parse(JSON.stringify(s));
  Spec.removeCascade(t, "link", g.members[1].links[0]);
  eq(0, t.arrays.length, "เลิกเป็น array"); eq(s.points.length, t.points.length, "จุดยังอยู่");
  const gone = Spec.cascadePreview(s, "point", "P2");
  ok(g.members.every(m => m.points.every(p => gone.includes(p))), "ลบต้นฉบับ = ทุกชุดหาย (อ้างต่อกันเป็นทอด)");
  // ย้ายต้นฉบับ (P1 = origin ย้ายไม่ได้ → ย้าย P2 / P3) : ชุดอื่นอ้างต่อกันเป็นทอดจึงตามเอง
  const pl = Ops.plan(s, ["P2", "P3"], false);
  ok(!pl.blocked.length, JSON.stringify(pl.blocked));
  const u = JSON.parse(JSON.stringify(s)), before = P(run(u), g.members[3].points[1]);
  Ops.apply(u, pl, { x: 1, y: 0 }, 1, run(u).pts);
  near(before.x + 1, P(run(u), g.members[3].points[1]).x, "ชุดสุดท้ายตาม");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process !== "undefined") process.exitCode = failed ? 1 : 0;
