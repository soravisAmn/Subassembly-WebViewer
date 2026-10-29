// ทดสอบเส้นโค้ง (Arc 3 จุด / Arc รัศมี / Fillet) ใน spec.js + Move / Copy (ops.js) + snap บนโค้ง (snap.js)
// รัน: node SA.Tests/js/arc.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(["expr.js", "spec.js", "ops.js", "snap.js"].map(js).join("\n") + "\nthis.Spec = Spec; this.Ops = Ops; this.Snap = Snap;", ctx);
const { Spec, Ops, Snap } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const near = (exp, act, what, tol = 1e-9) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const P = (x, y) => ({ x, y });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

console.log("เรขาคณิต");
test("จุดสัมผัสที่มุมฉาก R = 1 ห่างมุม 1 m · มุม 60° ห่าง R / tan(30°)", () => {
  const t = Spec.tangentPoint(P(0, 0), P(5, 0), P(0, 5), 1);
  near(1, t.x, "x"); near(0, t.y, "y"); ok(!t.warn, "ไม่เตือน");
  const u = Spec.tangentPoint(P(0, 0), P(5, 0), P(Math.cos(Math.PI / 3) * 5, Math.sin(Math.PI / 3) * 5), 1);
  near(1 / Math.tan(Math.PI / 6), u.x, "60°");
});
test("จุดสัมผัส: ขนาน / R ใหญ่เกินเส้น / R ≤ 0 = เตือน + มุมแหลมเดิม", () => {
  for (const [o, R, re] of [[P(-3, 0), 1, /ขนาน/], [P(0, 5), 9, /ใหญ่เกิน/], [P(0, 5), 0, /มากกว่า 0/]]){
    const t = Spec.tangentPoint(P(0, 0), P(5, 0), o, R);
    ok(re.test(t.warn || ""), "ข้อความ " + t.warn); near(0, t.x, "x = มุม"); near(0, t.y, "y = มุม");
  }
});
test("Arc 3 จุด: ผ่านจุดผ่านจริง · ทิศตามจุดผ่าน (บน = ตามเข็มจากซ้ายไปขวา)", () => {
  const g = Spec.arcGeom("arc3", P(-1, 0), P(1, 0), P(0, 1));
  near(0, g.cx, "cx"); near(0, g.cy, "cy"); near(1, g.r, "r"); ok(g.sw < 0, "ตามเข็ม"); near(Math.PI, Math.abs(g.sw), "ครึ่งวง");
  const h = Spec.arcGeom("arc3", P(-1, 0), P(1, 0), P(0, -1)); ok(h.sw > 0, "ผ่านด้านล่าง = ทวนเข็ม");
  ok(/เรียง/.test(Spec.arcGeom("arc3", P(0, 0), P(2, 0), P(1, 0)).warn), "3 จุดเรียงเส้นตรง");
});
test("Arc รัศมี: ทวน/ตามเข็ม × ทางสั้น/ยาว = ศูนย์กลาง 2 ฝั่ง · ปลายอยู่บนวง · รัศมีเล็กเกิน = เตือน", () => {
  const A = P(0, 0), B = P(2, 0), R = 2;
  const c = (ccw, large) => Spec.arcGeom("arcR", A, B, null, R, ccw, large);
  ok(c(true, false).cy > 0, "ทวนเข็มทางสั้น: ศูนย์กลางอยู่ซ้ายของทิศ A→B (บน)");
  ok(c(false, false).cy < 0, "ตามเข็มทางสั้น: ล่าง"); ok(c(true, true).cy < 0, "ทวนเข็มทางยาว: ล่าง");
  for (const [cc, lg] of [[true, false], [false, false], [true, true], [false, true]]){
    const g = c(cc, lg);
    near(R, Math.hypot(A.x - g.cx, A.y - g.cy), "A บนวง"); near(R, Math.hypot(B.x - g.cx, B.y - g.cy), "B บนวง");
    eq(lg, Math.abs(g.sw) > Math.PI, "ทางยาว"); eq(cc, g.sw > 0, "ทิศ");
  }
  ok(/น้อยกว่าครึ่ง/.test(Spec.arcGeom("arcR", A, B, null, 0.9, true, false).warn), "R < ครึ่งคอร์ด");
});
test("Fillet: ศูนย์กลางห่างทั้งสองเส้นเท่ากับ R · โค้งทางสั้น", () => {
  const g = Spec.arcGeom("fillet", P(1, 0), P(0, 1), P(0, 0), 1);
  near(1, g.cx, "cx"); near(1, g.cy, "cy"); near(Math.PI / 2, Math.abs(g.sw), "90°");
});
test("จำนวนท่อน: ยาวไม่เกิน chord · นับท่อน · จำกัด 2–180", () => {
  eq(32, Spec.segCount("chord", 0.05, 1, Math.PI / 2), "1.5708 / 0.05");
  eq(2, Spec.segCount("chord", 10, 1, 1), "ขั้นต่ำ 2"); eq(180, Spec.segCount("chord", 0.001, 10, Math.PI), "สูงสุด 180");
  eq(7, Spec.segCount("count", 7, 1, 1), "นับ"); eq(180, Spec.segCount("count", 999, 1, 1), "นับเกิน");
  eq(20, Spec.segCount("chord", 0.05, 1, 1), "พอดี (กันปัดขึ้นเพราะทศนิยม)");
});

console.log("evaluate");
function base(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "R", kind: "double", default: 0.5 });
  s.points.push({ id: "P2", codes: [], def: { type: "delta", from: "P1", dx: "4", dy: "0" } });
  s.points.push({ id: "P3", codes: [], def: { type: "delta", from: "P2", dx: "0", dy: "-2" } });
  s.links.push({ id: "L1", points: ["P1", "P2"], codes: ["Top"] }, { id: "L2", points: ["P2", "P3"], codes: ["Top"] },
               { id: "L3", points: ["P3", "P1"], codes: [] });
  s.shapes.push({ id: "S1", links: ["L1", "L2", "L3"], codes: [] });
  return s;
}
test("Arc รัศมี Side = Left = ภาพกระจกของ Right (sweep เก็บในกรอบ Right)", () => {
  const s = base();
  s.links.push({ id: "L4", type: "arcR", from: "P1", to: "P2", radius: "3", sweep: "ccw", large: false, codes: [] });
  const r = Spec.evaluate(s, {}).links.L4.path, l = Spec.evaluate(s, { values: { Side: 1 } }).links.L4.path;
  eq(r.length, l.length, "จำนวนจุด");
  r.forEach((p, i) => { near(-p.x, l[i].x, "x " + i); near(p.y, l[i].y, "y " + i); });
  ok(r[r.length >> 1].y < 0, "ทวนเข็มจากซ้ายไปขวา = โค้งลงล่าง");
});
test("ท่อนยาวไม่เกิน 0.05 m (default) · จุดบนโค้งห่างศูนย์กลางเท่ารัศมี", () => {
  const s = base();
  s.points.push({ id: "P9", codes: [], construction: true, def: { type: "delta", dx: "2", dy: "1" } });
  s.links.push({ id: "L4", type: "arc3", from: "P1", via: "P9", to: "P2", codes: [] });
  const q = Spec.evaluate(s, {}).links.L4;
  ok(q.path.length - 1 < 180, "ไม่ชนเพดาน 180 ท่อน");
  for (let i = 0; i < q.path.length - 1; i++) ok(dist(q.path[i], q.path[i + 1]) <= 0.05 + 1e-9, "ท่อน " + i + " ยาวเกิน");
  for (const p of q.path) near(q.arc.r, Math.hypot(p.x - q.arc.cx, p.y - q.arc.cy), "บนวง", 1e-9);
});
test("โค้งเป็นไปไม่ได้ = เตือน + เส้นตรง (ไม่ error)", () => {
  const s = base();
  s.links.push({ id: "L4", type: "arcR", from: "P1", to: "P2", radius: "1", sweep: "ccw", codes: [] });
  const r = Spec.evaluate(s, {});
  eq(2, r.links.L4.path.length, "เส้นตรง"); ok(!r.links.L4.err, "ไม่ error"); ok(r.issues.some(i => /L4/.test(i.msg)), "เตือน");
});

console.log("Fillet ใน spec");
test("Fillet มุม P2: link เดิมเปลี่ยนปลายเป็นจุดสัมผัส · shape แทรก fillet ตามลำดับ · P2 เป็นจุดช่วยสร้าง", () => {
  const s = base(), f = Spec.addFillet(s, "L1", "L2", "R");
  ok(!f.error, f.error);
  eq(`P1,${f.t1}`, Spec.byId(s.links, "L1").points.join(), "L1"); eq(`${f.t2},P3`, Spec.byId(s.links, "L2").points.join(), "L2");
  eq(`L1,${f.link},L2,L3`, s.shapes[0].links.join(), "ลำดับ shape");
  ok(Spec.isAux(Spec.byId(s.points, "P2")), "P2 ช่วยสร้าง"); eq("Top", Spec.byId(s.links, f.link).codes.join(), "code เดียวกัน");
  const r = Spec.evaluate(s, {});
  ok(!r.issues.length, JSON.stringify(r.issues)); ok(r.shapes.S1.poly, "shape ปิด");
  near(3.5, r.pts[f.t1].x, "T1 ห่างมุม R"); near(-0.5, r.pts[f.t2].y, "T2");
  const g = r.links[f.link].arc; near(3.5, g.cx, "cx"); near(-0.5, g.cy, "cy");
});
test("จุดมุมที่มี point code = ไม่เป็นจุดช่วยสร้าง (code ไม่หายจาก Civil 3D)", () => {
  const s = base(); Spec.byId(s.points, "P2").codes = ["Hinge"];
  const f = Spec.addFillet(s, "L1", "L2", "R");
  ok(f.kept, "kept"); ok(!Spec.isAux(Spec.byId(s.points, "P2")), "ยังเป็นจุดจริง");
});
test("Fillet ที่มุมแรก/สุดท้ายของ shape (วนรอบ) = ต่อท้าย", () => {
  const s = base(), f = Spec.addFillet(s, "L3", "L1", "0.3");
  eq(`L1,L2,L3,${f.link}`, s.shapes[0].links.join(), "ลำดับ"); ok(Spec.evaluate(s, {}).shapes.S1.poly, "ปิด");
});
test("Fillet ใช้ไม่ได้: ไม่ต่อกัน / link เดียวกัน / ไม่ใช่เส้นตรง", () => {
  const s = base();
  s.points.push({ id: "P4", codes: [], def: { type: "delta", dx: "9", dy: "9" } }, { id: "P5", codes: [], def: { type: "delta", dx: "8", dy: "9" } });
  s.links.push({ id: "L4", points: ["P4", "P5"], codes: [] }, { id: "L5", type: "followSurface", from: "P1", to: "P4", codes: [] });
  ok(/ไม่ได้ต่อกัน/.test(Spec.addFillet(s, "L1", "L4", "1").error), "ไม่ต่อกัน");
  ok(Spec.addFillet(s, "L1", "L1", "1").error, "ตัวเดียวกัน"); ok(/เส้นตรง/.test(Spec.addFillet(s, "L1", "L5", "1").error), "ตามดิน");
});
test("Fillet R ใหญ่เกิน = จุดสัมผัสอยู่ที่มุม + fillet เป็นเส้นตรง + เตือน · shape ยังปิด", () => {
  const s = base(), f = Spec.addFillet(s, "L1", "L2", "9");
  const r = Spec.evaluate(s, {});
  eq(2, r.links[f.link].path.length, "เส้นตรง"); ok(r.issues.length >= 2, "เตือน"); near(4, r.pts[f.t1].x, "T1 = มุม");
});
test("ลบจุดผ่านของ Arc 3 จุด / มุมของ Fillet = link โค้งหายด้วย", () => {
  const s = base();
  s.points.push({ id: "P9", codes: [], construction: true, def: { type: "delta", dx: "2", dy: "1" } });
  s.links.push({ id: "L4", type: "arc3", from: "P1", via: "P9", to: "P2", codes: [] });
  ok(Spec.removeCascade(s, "point", "P9").includes("L4"), "arc3");
  const t = base(), f = Spec.addFillet(t, "L1", "L2", "R");
  ok(Spec.cascadePreview(t, "point", "P2").includes(f.link), "fillet ตามมุม");
});

console.log("Move / Copy / snap");
test("Move ทั้งรูปที่มี Fillet: จุดสัมผัสตามเอง (ไม่ต้องแก้) · เลือก link โค้ง = ได้จุดผ่าน / มุมด้วย", () => {
  const s = base(), f = Spec.addFillet(s, "L1", "L2", "R");
  s.points[0].def = { type: "delta", dx: "0", dy: "0" };          // origin ย้ายไม่ได้ -> ใช้จุดธรรมดาแทน
  const fr = Ops.expand(s, { links: [f.link] });
  ok(fr.points.includes("P2"), "มุมมาด้วย");
  const all = Ops.expand(s, { shapes: ["S1"] }), pl = Ops.plan(s, all.points);
  eq(0, pl.blocked.length, "ไม่มีจุดติด"); ok(pl.edit.every(e => e.id !== f.t1 && e.id !== f.t2), "จุดสัมผัสไม่ต้องแก้");
});
test("Copy link โค้ง 3 จุด = จุดผ่านของสำเนาเป็นจุดใหม่", () => {
  const s = base();
  s.points.push({ id: "P9", codes: [], construction: true, def: { type: "delta", dx: "2", dy: "1" } });
  s.links.push({ id: "L4", type: "arc3", from: "P1", via: "P9", to: "P2", codes: [] });
  const c = Ops.clone(s, Ops.expand(s, { links: ["L4"] }), s), nl = Spec.byId(s.links, c.links[0]);
  eq(c.map.P9, nl.via, "via"); ok(nl.via !== "P9", "ไม่ใช่ตัวเดิม");
});
test("snap: ท่อนย่อยของโค้งไม่มี Midpoint รายท่อน · กึ่งกลางทั้งโค้งมาจาก mids", () => {
  const segs = [{ id: "L4", a: P(0, 0), b: P(1, 1), curve: true }, { id: "L1", a: P(0, 2), b: P(2, 2) }];
  const os = { on: true, mid: true }, sc = { x: 100, y: 100 };
  eq(0, Snap.collect({ mouse: P(0.5, 0.5), scale: sc, R: 12, os, segs }).length, "ไม่มี mid บนท่อนโค้ง");
  const l = Snap.collect({ mouse: P(0.7, 0.7), scale: sc, R: 12, os, segs, mids: [{ x: 0.71, y: 0.69, label: "กึ่งกลางโค้ง L4" }] });
  eq("mid", l[0].kind, "ได้ mid ของโค้ง"); ok(l[0].midpt, "midpt");
});
test("เปลี่ยนชื่อ / หา parameter ในรัศมีของโค้ง, Fillet, จำนวนท่อน, polygon", () => {
  const s = base(), f = Spec.addFillet(s, "L1", "L2", "R");
  Spec.byId(s.links, f.link).seg = { by: "count", value: "R * 10" };
  const ids = Spec.exprSlots(s).filter(x => /\bR\b/.test(x.obj[x.key])).map(x => x.id);
  ok(ids.includes(f.t1) && ids.includes(f.t2) && ids.includes(f.link), "พบ " + ids.join());
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
