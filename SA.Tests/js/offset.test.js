// ทดสอบ Intersect / Offset ของรอบ 4c M2 (จุดชนิด offset + Spec.addOffset / addIntersect ใน spec.js, Move ใน ops.js)
// รัน: node SA.Tests/js/offset.test.js
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

const run = (s, values) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: null, extendEnds: true, layout: true });
const P = (r, id) => { const p = r.pts[id]; if (!p || p.err) throw new Error(`จุด ${id}: ${p ? p.err : "ไม่มี"}`); return p; };
const pt = (id, def, extra) => ({ id, codes: [], def, ...extra });

// ผิวหินของ body_rock-pitching: origin → F (FaceSlope × Height, -Height)
function rockFace(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Height", kind: "double", default: 3 }, { name: "FaceSlope", kind: "double", default: 2.5 }, { name: "RockThickness", kind: "double", default: 0.3 });
  s.points.push(pt("P2", { type: "delta", from: "P1", dx: "FaceSlope * Height", dy: "-Height" }));
  s.links.push({ id: "L1", points: ["P1", "P2"], codes: [] });
  return s;
}
// BodyGeometry.ParallelY ของ body_rock-pitching.cs: เส้นขนานผิวหิน ลึกลงตั้งฉาก depth
const parallelY = (u, depth, fs) => -u / fs - depth * Math.sqrt(1 + fs * fs) / fs;

// ---------- จุดชนิด offset ----------
test("offset ใต้ผิวหิน = ParallelY ของ body_rock-pitching (ทั้งสองปลาย)", () => {
  const s = rockFace();
  const o = Spec.addOffset(s, "L1", "RockThickness", -1);
  ok(!o.error, o.error);
  const r = run(s);
  ok(!r.issues.length, JSON.stringify(r.issues));
  for (const id of [o.a, o.b]){ const q = P(r, id); near(parallelY(q.x, 0.3, 2.5), q.y, `${id} อยู่บนเส้นขนาน`); }
  // ระยะตั้งฉากจากผิวหิน = 0.3 และปลาย a ตั้งฉากกับ origin
  const A = P(r, o.a), F = P(r, "P2"), n = Math.hypot(F.x, F.y);
  near(0.3, Math.abs(F.x * A.y - F.y * A.x) / n, "ระยะตั้งฉาก");
  near(0, A.x * F.x + A.y * F.y, "ปลาย a ตั้งฉากกับ origin");
  ok(A.y < 0, "side -1 = ใต้ผิว (ขวาของทิศ origin → F)");
});
test("offset ฝั่ง Left = ภาพกระจก (x กลับ, y เท่าเดิม) · side 1 = อีกด้าน", () => {
  const s = rockFace();
  const o = Spec.addOffset(s, "L1", "RockThickness", -1);
  const R = run(s), L = run(s, { Side: 1 });
  for (const id of [o.a, o.b]){ near(-P(R, id).x, P(L, id).x, `${id} x`); near(P(R, id).y, P(L, id).y, `${id} y`); }
  const u = Spec.addOffset(s, "L1", "0.3", 1), r = run(s);
  near(-P(r, o.a).x, P(r, u.a).x, "side 1 = กลับด้าน (x)"); near(-P(r, o.a).y, P(r, u.a).y, "side 1 = กลับด้าน (y)");
});
test("offset ระยะติดลบ = อีกด้าน · ระยะเป็นนิพจน์อ้างจุดได้", () => {
  const s = rockFace();
  const a = Spec.addOffset(s, "L1", "-RockThickness", 1), b = Spec.addOffset(s, "L1", "RockThickness", -1), r = run(s);
  near(P(r, b.a).x, P(r, a.a).x, "x"); near(P(r, b.a).y, P(r, a.a).y, "y");
  ok(Spec.refs(Spec.byId(s.points, a.a).def).includes("P2"), "refs มีปลายเส้น");
  s.points.push(pt("P9", { type: "offset", a: "P1", b: "P2", end: "b", dist: "-P2.y / 10", side: 1 }));
  ok(Spec.refs(Spec.byId(s.points, "P9").def).includes("P2"), "refs จากนิพจน์");
  ok(!run(s).pts.P9.err, "นิพจน์อ้างจุด");
});
test("offset เส้นยาวเป็นศูนย์ = หาไม่ได้ + เตือน", () => {
  const s = Spec.newSpec("T");
  s.points.push(pt("P2", { type: "delta", from: "P1", dx: "0", dy: "0" }), pt("P3", { type: "offset", a: "P1", b: "P2", end: "a", dist: "1", side: 1 }));
  const r = run(s);
  ok(r.pts.P3.err && /ยาวเป็นศูนย์/.test(r.pts.P3.err), JSON.stringify(r.pts.P3));
  ok(r.issues.some(i => i.obj === "P3"), "เตือน");
});

// ---------- Spec.addOffset ----------
test("addOffset: 2 จุด + link ใหม่ · ไม่ใช่ aux จนกว่าจะติ๊ก · กิ่งตามเส้นเดิม", () => {
  const s = rockFace();
  const o = Spec.addOffset(s, "L1", "0.5", 1);
  eq(4, s.points.length, "จุด"); eq(2, s.links.length, "link");
  ok(!Spec.isAux(Spec.byId(s.points, o.a)) && !Spec.isAux(Spec.byId(s.links, o.link)), "ไม่ใช่ aux");
  eq("0.5", Spec.byId(s.points, o.b).def.dist, "dist");
  Spec.byId(s.links, "L1").auxiliary = true;
  const x = Spec.addOffset(s, "L1", "0.5", 1);
  ok(!Spec.isAux(Spec.byId(s.links, x.link)), "เส้นเดิมเป็น aux ก็ไม่ตาม (ต้องติ๊กเอง)");
  const y = Spec.addOffset(s, "L1", "0.5", 1, { aux: true });
  ok(Spec.isAux(Spec.byId(s.points, y.a)) && Spec.isAux(Spec.byId(s.points, y.b)) && Spec.isAux(Spec.byId(s.links, y.link)), "aux: true");
  Spec.byId(s.links, "L1").branch = "B1";
  const z = Spec.addOffset(s, "L1", "0.5", 1);
  eq("B1", Spec.byId(s.points, z.a).branch, "กิ่งของจุด"); eq("B1", Spec.byId(s.links, z.link).branch, "กิ่งของ link");
});
test("addOffset: เส้นโค้ง / ตามดิน / ไม่มีระยะ = error", () => {
  const s = rockFace();
  s.links.push({ id: "L2", type: "followSurface", from: "P1", to: "P2", target: "TargetSurface", codes: [] });
  ok(/เส้นตรง/.test(Spec.addOffset(s, "L2", "1", 1).error), "followSurface");
  ok(Spec.addOffset(s, "L1", " ", 1).error, "ไม่มีระยะ");
  eq(2, s.points.length, "ไม่สร้างอะไร");
});

// ---------- Spec.addIntersect ----------
// เส้น L1: P1 (0,0) → P2 (4,0) · L2: P3 (2,1) → P4 (2,-3) — ตัดกันที่ (2,0)
function cross(){
  const s = Spec.newSpec("T");
  s.points.push(pt("P2", { type: "delta", dx: "4", dy: "0" }), pt("P3", { type: "delta", dx: "2", dy: "1" }), pt("P4", { type: "delta", dx: "2", dy: "-3" }));
  s.links.push({ id: "L1", points: ["P1", "P2"], codes: [] }, { id: "L2", points: ["P3", "P4"], codes: [] });
  return s;
}
test("addIntersect ไม่ตัด: ได้จุดตัด · เส้นเดิมไม่เปลี่ยน", () => {
  const s = cross();
  const x = Spec.addIntersect(s, "L1", "L2", {});
  ok(!x.error, x.error);
  const r = run(s), q = P(r, x.point);
  near(2, q.x, "x"); near(0, q.y, "y");
  eq("P1,P2", Spec.byId(s.links, "L1").points.join(), "L1"); eq("P3,P4", Spec.byId(s.links, "L2").points.join(), "L2");
  ok(!Spec.isAux(Spec.byId(s.points, x.point)), "จุดจริง");
  ok(Spec.isAux(Spec.byId(s.points, Spec.addIntersect(s, "L1", "L2", { aux: true }).point)), "aux: true");
});
test("addIntersect ตัด: เก็บปลายที่เลือก อีกปลาย = จุดตัด · ปลายเดิมที่ว่าง = aux, มี code = คงเป็นจุดจริง", () => {
  const s = cross();
  Spec.byId(s.points, "P4").codes = ["Keep"];
  const x = Spec.addIntersect(s, "L1", "L2", { trim: true, keep1: "P1", keep2: "P4" });
  ok(!x.error, x.error);
  eq(`P1,${x.point}`, Spec.byId(s.links, "L1").points.join(), "L1 = P1 → จุดตัด (ทิศเดิม)");
  eq(`${x.point},P4`, Spec.byId(s.links, "L2").points.join(), "L2 = จุดตัด → P4 (ทิศเดิม)");
  eq("P2,P3", x.dropped.join(), "ปลายที่ถูกแทน");
  ok(Spec.isAux(Spec.byId(s.points, "P2")) && Spec.isAux(Spec.byId(s.points, "P3")), "ปลายที่ถูกแทน (ว่าง) = aux");
  eq("", x.kept.join(), "kept");
  const r = run(s);
  ok(!r.issues.length, JSON.stringify(r.issues));
  near(2, r.links.L1.path[1].x, "L1 จบที่จุดตัด");
  // ปลายที่ถูกแทนมี code = คงเป็นจุดจริง + บอก
  const t = cross();
  Spec.byId(t.points, "P2").codes = ["Edge"];
  const y = Spec.addIntersect(t, "L1", "L2", { trim: true, keep1: "P1", keep2: "P3" });
  eq("P2", y.kept.join(), "kept"); ok(!Spec.isAux(Spec.byId(t.points, "P2")), "P2 ยังเป็นจุดจริง");
  ok(Spec.isAux(Spec.byId(t.points, "P4")), "P4 ว่าง = aux");
});
test("addIntersect ยืด: จุดตัดเลยปลายเส้น = เส้นยาวออกไปถึงจุดตัด", () => {
  // L2 สั้น: P3 (2,1) → P4 (2,0.5) ไม่ถึง L1 — ยืดลงไปถึง (2,0)
  const s = cross();
  Spec.byId(s.points, "P4").def.dy = "0.5";
  const x = Spec.addIntersect(s, "L1", "L2", { trim: true, keep1: "P1", keep2: "P3" });
  const r = run(s), l2 = r.links.L2.path;
  near(2, l2[1].x, "x"); near(0, l2[1].y, "y = 0 (ยืดถึง L1)");
  eq("P4", x.dropped[1], "ปลายที่ยืดออก");
});
test("addIntersect: ต่อกันอยู่แล้ว / ไม่ใช่เส้นตรง / เส้นเดียวกัน = error · ขนาน = จุดหาไม่ได้ + เตือน", () => {
  const s = cross();
  s.links.push({ id: "L3", points: ["P2", "P4"], codes: [] }, { id: "L4", type: "arc3", from: "P1", via: "P3", to: "P2", codes: [] });
  ok(/ต่อกันที่ P2/.test(Spec.addIntersect(s, "L1", "L3", {}).error), "ต่อกันแล้ว");
  ok(/เส้นตรง/.test(Spec.addIntersect(s, "L1", "L4", {}).error), "โค้ง");
  ok(Spec.addIntersect(s, "L1", "L1", {}).error, "เส้นเดียวกัน");
  ok(Spec.addIntersect(s, "L1", "L2", { trim: true, keep1: "P9", keep2: "P3" }).error, "ปลายที่เก็บไม่ใช่ของเส้น");
  const p = Spec.newSpec("T");
  p.points.push(pt("P2", { type: "delta", dx: "4", dy: "0" }), pt("P3", { type: "delta", dx: "0", dy: "1" }), pt("P4", { type: "delta", dx: "4", dy: "1" }));
  p.links.push({ id: "L1", points: ["P1", "P2"], codes: [] }, { id: "L2", points: ["P3", "P4"], codes: [] });
  const x = Spec.addIntersect(p, "L1", "L2", {}), r = run(p);
  ok(r.pts[x.point].err && r.issues.length, "ขนาน = เตือน");
});
test("addIntersect ตัด: polygon ด้านเท่าที่โดน = เลิกเป็น polygon · กิ่งเดียวกัน = จุดตัดเข้ากิ่งนั้น", () => {
  const s = cross();
  s.polygons = [{ id: "G1", center: "P1", n: 3, radius: "1", angle: "0", mode: "inscribed", points: [], links: ["L1"], shape: null }];
  Spec.byId(s.links, "L1").branch = "B1"; Spec.byId(s.links, "L2").branch = "B1";
  const x = Spec.addIntersect(s, "L1", "L2", { trim: true, keep1: "P1", keep2: "P3" });
  eq(0, s.polygons.length, "polygon"); eq("B1", Spec.byId(s.points, x.point).branch, "กิ่ง");
});

// ---------- Move / ลบ ----------
test("Move: offset ตามไปเองเมื่อปลายเส้นย้ายทั้งคู่ · ไม่ครบ = ไม่ย้าย + เหตุผล", () => {
  const s = rockFace();
  const o = Spec.addOffset(s, "L1", "0.3", -1);
  const all = Ops.plan(s, ["P1", "P2", o.a, o.b].filter(id => id !== "P1"), false, ["P1"]);
  ok(all.moving.has(o.a) && all.moving.has(o.b) && !all.blocked.length, JSON.stringify(all.blocked));
  const part = Ops.plan(s, [o.a], false);
  eq(o.a, part.blocked[0] && part.blocked[0].id, "blocked"); ok(/Offset/.test(part.blocked[0].why), part.blocked[0].why);
});
test("ลบปลายเส้น = จุด offset + link ของมันหายด้วย · เปลี่ยนชื่อ parameter แล้ว dist เปลี่ยนตาม", () => {
  const s = rockFace();
  const o = Spec.addOffset(s, "L1", "RockThickness", -1);
  ok(Spec.exprSlots(s).some(x => x.id === o.a && x.key === "dist"), "dist เป็นช่องนิพจน์");
  const gone = Spec.cascadePreview(s, "point", "P2");
  ok(gone.includes(o.a) && gone.includes(o.b) && gone.includes(o.link), gone.join());
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process !== "undefined") process.exitCode = failed ? 1 : 0;
