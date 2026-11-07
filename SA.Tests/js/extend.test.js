// ทดสอบ Extend to Surface ของรอบ 4c M3 (จุดชนิด extendToGround, ปลายจริง = firstOf aux เป็นปลาย link ได้, link optional ใน shape)
// รัน: node SA.Tests/js/extend.test.js
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

// ผิวดินลาดลงขวา: ที่ x = 4 ระดับ -2.1 (ต่ำกว่ามุมฐานนอก -2 = ลอย) · ที่ x = -1 ระดับ -1.48 (สูงกว่ามุมฐานใน = จม)
const SURF = [{ x: -30, y: -1 }, { x: 0, y: -1.5 }, { x: 30, y: -6 }];
const run = (s, o = {}) => Spec.evaluate(s, { values: o.values || {}, codeParams: [], codePoints: [], surface: o.surface === undefined ? SURF : o.surface,
                                             extendEnds: o.extendEnds !== false, layout: !!o.layout });
const P = (r, id) => { const p = r.pts[id]; if (!p || p.err) throw new Error(`จุด ${id}: ${p ? p.err : "ไม่มี"}`); return p; };
const pt = (id, def, extra) => ({ id, codes: [], def, ...extra });

// คางหมูแบบ base_rock-pitching: บน P1–P2 · ข้าง P2→P3 (นอก) / P1→P4 (ใน) · ฐาน P3–P4 · shape S1
function trap(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Width", kind: "double", default: 3 }, { name: "Depth", kind: "double", default: 2 });
  s.points.push(pt("P2", { type: "delta", from: "P1", dx: "Width", dy: "0" }), pt("P3", { type: "delta", from: "P2", dx: "1", dy: "-Depth" }),
                pt("P4", { type: "delta", from: "P1", dx: "-1", dy: "-Depth" }));
  s.links.push({ id: "L1", points: ["P1", "P2"], codes: ["Top"] }, { id: "L2", points: ["P2", "P3"], codes: ["TrapSide"] },
               { id: "L3", points: ["P3", "P4"], codes: ["TrapBase"] }, { id: "L4", points: ["P4", "P1"], codes: ["TrapSide"] });
  s.shapes.push({ id: "S1", links: ["L1", "L2", "L3", "L4"], codes: ["Trap"] });
  return s;
}
test("addExtendToGround: จุดต่อ + link ต่อ (optional, code เส้นเดิม) + ปลายจริง (firstOf aux) · ย้ายฐานไปต่อที่ปลายจริง · แทรกใน shape", () => {
  const s = trap();
  const x = Spec.addExtendToGround(s, "L2", "P3");
  ok(!x.error, x.error);
  const p = Spec.byId(s.points, x.point), l = Spec.byId(s.links, x.link), t = Spec.byId(s.points, x.tip);
  eq("extendToGround", p.def.type, "ชนิด"); eq("P3", p.def.from, "from"); eq("P2", p.def.along, "along"); eq("50", p.def.maxDistance, "maxDistance");
  eq(`P3,${x.point}`, l.points.join(), "link ต่อ"); ok(l.optional, "optional"); eq("TrapSide", l.codes.join(), "code เส้นเดิม");
  ok(Spec.isAux(t) && t.def.type === "firstOf" && t.def.points.join() === `${x.point},P3`, "ปลายจริง");
  ok(Spec.isAlias(s, x.tip) && !Spec.auxEnd(s, x.tip), "ปลายจริงเป็นปลาย link จริงได้");
  eq("L3", x.rewired.join(), "ย้าย L3"); eq(`${x.tip},P4`, Spec.byId(s.links, "L3").points.join(), "L3 เริ่มที่ปลายจริง");
  eq(`L1,L2,${x.link},L3,L4`, s.shapes[0].links.join(), "แทรกใน shape ถัดจาก L2");
  eq(s.links.indexOf(Spec.byId(s.links, "L2")) + 1, s.links.indexOf(l), "link ต่ออยู่ถัดจากเส้นเดิม");
});
test("ปลายลอย = ต่อลงชนดินตามแนวเดิม · ปลายจม = ไม่เกิด (ไม่เตือน) · shape ปิดได้ทั้งสองแบบ", () => {
  const s = trap();
  const a = Spec.addExtendToGround(s, "L2", "P3"), b = Spec.addExtendToGround(s, "L4", "P4");
  const r = run(s);
  ok(!r.issues.length, JSON.stringify(r.issues));
  const h = P(r, a.point), f = P(r, "P3"), g = Spec.makeGround(SURF, true);
  near(g.elev(h.x), h.y, "อยู่บนผิวดิน");
  near(0, (h.x - f.x) * -2 - (h.y - f.y) * 1, "อยู่บนแนว P2→P3 (ทิศ 1, -2)");
  ok(h.x > f.x, "ต่อเลย P3 ออกไป");
  ok(r.pts[b.point].off === Spec.GROUND_OFF, "ปลายใน (จม) ไม่เกิด");
  ok(r.links[b.link].off, "link ต่อในไม่เกิด");
  near(P(r, "P4").x, P(r, b.tip).x, "ปลายจริงใน = P4 (ไม่ต่อ)"); near(h.x, P(r, a.tip).x, "ปลายจริงนอก = จุดชนดิน");
  const S = r.shapes.S1;
  ok(S.poly && S.poly.length === 5, "shape ปิด 5 จุด: " + JSON.stringify(S));
  // ดินสูงขึ้นทั้งหมด (ไม่ลอยสักปลาย) = ไม่ต่อทั้งคู่ shape ยังปิด 4 จุด
  const r2 = run(s, { surface: [{ x: -30, y: 0 }, { x: 30, y: 0 }] });
  ok(!r2.issues.length && r2.shapes.S1.poly && r2.shapes.S1.poly.length === 4, JSON.stringify(r2.shapes.S1) + JSON.stringify(r2.issues));
  // ดินต่ำทั้งหมด = ต่อทั้งคู่ 6 จุด
  const r3 = run(s, { surface: [{ x: -30, y: -3 }, { x: 30, y: -3 }] });
  ok(!r3.issues.length && r3.shapes.S1.poly.length === 6, JSON.stringify(r3.shapes.S1));
  near(-3, P(r3, b.point).y, "ต่อในลงถึง -3"); near(-1 - 0.5, P(r3, b.point).x, "ต่อในตามแนว P1→P4 (ทิศ -1, -2)");
});
test("Layout / ไม่มีผิวดิน = ไม่ต่อ ไม่เตือน · ไม่ชนดินภายใน maxDistance = เตือน + shape ข้าม link ต่อ", () => {
  const s = trap(), a = Spec.addExtendToGround(s, "L2", "P3");
  for (const o of [{ layout: true }, { surface: null }]){
    const r = run(s, o);
    ok(!r.issues.length, JSON.stringify(o) + JSON.stringify(r.issues)); ok(r.pts[a.point].off, "ไม่เกิด"); eq(4, r.shapes.S1.poly.length, "shape 4 จุด");
  }
  Spec.byId(s.points, a.point).def.maxDistance = "0.01";
  const r = run(s);
  ok(r.pts[a.point].err && !r.pts[a.point].off && /ไม่ชนผิวดินภายใน 0.01/.test(r.pts[a.point].err), JSON.stringify(r.pts[a.point]));
  ok(r.issues.some(i => i.obj === a.point), "เตือนที่จุด");
  ok(!r.issues.some(i => i.obj === "S1"), "shape ไม่เตือน (link optional)"); eq(4, r.shapes.S1.poly.length, "shape ปิดด้วย P3");
});
test("ต่อแนวดิ่ง / ต่อขึ้น (ไม่มีทางชนดิน) / ผิวดินไม่ยาวพอ (extendEnds ปิด)", () => {
  const s = Spec.newSpec("T");
  s.points.push(pt("P2", { type: "delta", dx: "0", dy: "-1" }), pt("P3", { type: "extendToGround", from: "P2", along: "P1", target: "TargetSurface", maxDistance: "50" }));
  const r = run(s, { surface: [{ x: -30, y: -4 }, { x: 30, y: -4 }] });
  near(0, P(r, "P3").x, "x ดิ่ง"); near(-4, P(r, "P3").y, "y ดิ่ง");
  // ต่อขึ้น (ทิศ P2→P1 ขึ้น) แต่ปลายลอย = ไม่มีทางชน = เตือน
  s.points.push(pt("P4", { type: "extendToGround", from: "P1", along: "P2", target: "TargetSurface", maxDistance: "50" }));
  const r2 = run(s, { surface: [{ x: -30, y: -4 }, { x: 30, y: -4 }] });
  ok(r2.pts.P4.err && !r2.pts.P4.off, "ต่อขึ้น = หาไม่ได้"); ok(r2.issues.some(i => i.obj === "P4"), "เตือน");
  const r3 = run(s, { surface: [{ x: 5, y: -4 }, { x: 30, y: -4 }], extendEnds: false });
  ok(r3.pts.P3.err && !r3.pts.P3.off && r3.issues.some(i => i.obj === "P3"), "นอกขอบเขตผิวดิน = เตือน");
});
test("ปลายจริงเป็นปลาย link จริงได้เมื่อจุดในรายการเป็นจุดจริง · มีจุด aux = ข้าม + เตือน", () => {
  const s = trap(), a = Spec.addExtendToGround(s, "L2", "P3");
  ok(!run(s).links.L3.err, "L3 จากปลายจริง");
  Spec.byId(s.points, "P3").auxiliary = true;
  eq(a.tip, Spec.auxEnd(s, a.tip), "auxEnd = ปลายจริง");
  const r = run(s);
  eq(a.tip, r.links.L3.auxEnd, "L3 ข้าม"); ok(r.issues.some(i => i.obj === "L3"), "เตือน");
  // firstOf ที่ไม่ใช่ aux = จุดธรรมดา (ไม่ใช่ปลายจริง)
  Spec.byId(s.points, "P3").auxiliary = false; Spec.byId(s.points, a.tip).auxiliary = false;
  ok(!Spec.isAlias(s, a.tip), "ไม่ใช่ปลายจริง");
});
test("addExtendToGround: rewire: false · เส้นเดิม aux = ของใหม่ aux และไม่ย้าย link จริง · error", () => {
  const s = trap();
  const a = Spec.addExtendToGround(s, "L2", "P3", { rewire: false, codes: ["Ext"], pointCodes: ["E3"], maxDistance: "MaxExt" });
  eq("", a.rewired.join(), "ไม่ย้าย"); eq("P3,P4", Spec.byId(s.links, "L3").points.join(), "L3 เดิม");
  eq("Ext", Spec.byId(s.links, a.link).codes.join(), "code ที่ให้"); eq("E3", Spec.byId(s.points, a.point).codes.join(), "code จุด"); eq("MaxExt", Spec.byId(s.points, a.point).def.maxDistance, "นิพจน์");
  const t = trap();
  Spec.byId(t.links, "L2").auxiliary = true;
  const b = Spec.addExtendToGround(t, "L2", "P3");
  ok(Spec.isAux(Spec.byId(t.points, b.point)) && Spec.isAux(Spec.byId(t.links, b.link)), "aux ตามเส้นเดิม");
  eq("", b.rewired.join(), "ไม่ย้าย link จริง");
  ok(/เส้นตรง/.test(Spec.addExtendToGround(t, "LX", "P3").error), "ไม่มี link");
  ok(Spec.addExtendToGround(t, "L1", "P4").error, "ไม่ใช่ปลาย");
  t.links.push({ id: "L9", type: "arc3", from: "P1", via: "P2", to: "P3", codes: [] });
  ok(/เส้นตรง/.test(Spec.addExtendToGround(t, "L9", "P3").error), "โค้ง");
});
test("กิ่ง: ของใหม่อยู่กิ่งเดียวกับเส้นเดิม · Side = Left = ภาพกระจก", () => {
  const s = trap();
  Spec.byId(s.links, "L2").branch = "B1";
  const a = Spec.addExtendToGround(s, "L2", "P3");
  ok([a.point, a.tip].every(id => Spec.byId(s.points, id).branch === "B1") && Spec.byId(s.links, a.link).branch === "B1", "กิ่ง");
  const u = trap(), x = Spec.addExtendToGround(u, "L2", "P3");
  const mirror = SURF.map(p => ({ x: -p.x, y: p.y }));
  const R = run(u), L = run(u, { values: { Side: 1 }, surface: mirror });
  near(-P(R, x.point).x, P(L, x.point).x, "x"); near(P(R, x.point).y, P(L, x.point).y, "y");
});
test("Move: จุดต่อไม่ย้าย (ขึ้นกับผิวดิน) · ลบจุดต่อ = ปลายจริง + link ที่ต่อจากมันหายด้วย", () => {
  const s = trap(), a = Spec.addExtendToGround(s, "L2", "P3");
  const pl = Ops.plan(s, [a.point], false);
  eq(a.point, pl.blocked[0] && pl.blocked[0].id, "ไม่ย้าย"); ok(/ผิวดิน/.test(pl.blocked[0].why), pl.blocked[0].why);
  ok(Spec.refs(Spec.byId(s.points, a.point).def).includes("P2"), "refs มี along");
  const gone = Spec.cascadePreview(s, "point", a.point);
  ok(gone.includes(a.tip) && gone.includes(a.link) && gone.includes("L3"), gone.join());
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process !== "undefined") process.exitCode = failed ? 1 : 0;
