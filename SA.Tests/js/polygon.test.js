// ทดสอบ Polygon ด้านเท่า (spec.js: polygonVertexDefs / addPolygon / updatePolygon / rebuildPolygon) + Move / Copy (ops.js)
// รัน: node SA.Tests/js/polygon.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(["expr.js", "spec.js", "ops.js"].map(js).join("\n") + "\nthis.Spec = Spec; this.Ops = Ops;", ctx);
const { Spec, Ops } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const near = (exp, act, what, tol = 1e-9) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };

// spec ที่มีจุดศูนย์กลาง P2 (ช่วยสร้าง) ห่าง origin (3, 2)
function base(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "R", kind: "double", default: 1.5 }, { name: "Th", kind: "double", default: 0 });
  Spec.addPoint(s, { type: "delta", from: "P1", dx: "3", dy: "2" }, [], true);
  return s;
}
const ev = (s, values) => Spec.evaluate(s, { values: values || {} });

console.log("จุดยอด");
test("5 เหลี่ยม inscribed: จุดแรกอยู่บนสุด · ทุกจุดห่างศูนย์กลาง R · มุมห่างกัน 72°", () => {
  const s = base(), g = Spec.addPolygon(s, { center: "P2", n: 5, radius: "R", angle: "Th", mode: "inscribed" });
  eq(5, g.points.length, "จุด"); eq(5, g.links.length, "link"); ok(g.shape, "shape");
  const r = ev(s), C = r.pts.P2;
  near(3, r.pts[g.points[0]].x, "x จุดแรก"); near(3.5, r.pts[g.points[0]].y, "y จุดแรก");
  for (const id of g.points) near(1.5, Math.hypot(r.pts[id].x - C.x, r.pts[id].y - C.y), "รัศมี " + id);
  eq("Th + 162", Spec.byId(s.points, g.points[1]).def.angle, "มุมจุดที่ 2 (นิพจน์ รวมค่าคงที่)");
  ok(!r.shapes[g.shape].err, "shape ปิดรูป");
});
test("7 เหลี่ยม: มุมที่หารไม่ลงตัวเขียนเป็นเศษส่วน (ไม่ปัดทศนิยม)", () => {
  const s = base(), g = Spec.addPolygon(s, { center: "P2", n: 7, radius: "2", angle: "0" });
  eq("90 + 360 * 1 / 7", Spec.byId(s.points, g.points[1]).def.angle, "มุม");
  const r = ev(s), a = r.pts[g.points[0]], b = r.pts[g.points[1]];
  near(2 * 2 * Math.sin(Math.PI / 7), Math.hypot(a.x - b.x, a.y - b.y), "ยาวด้าน", 1e-9);
});
test("circumscribed: กึ่งกลางด้านห่างศูนย์กลาง R (ระยะถึงมุม = R / cos(180/N))", () => {
  const s = base(), g = Spec.addPolygon(s, { center: "P2", n: 6, radius: "R", angle: "0", mode: "circumscribed" });
  eq("R / cos(30)", Spec.byId(s.points, g.points[0]).def.length, "นิพจน์ระยะ");
  const r = ev(s), C = r.pts.P2, a = r.pts[g.points[0]], b = r.pts[g.points[1]];
  near(1.5, Math.hypot((a.x + b.x) / 2 - C.x, (a.y + b.y) / 2 - C.y), "ระยะถึงกึ่งกลางด้าน", 1e-9);
});
test("รัศมีเป็นนิพจน์ยาว = ใส่วงเล็บก่อนหาร", () => {
  const g = { center: "P2", n: 4, radius: "R + 1", angle: "0", mode: "circumscribed" };
  eq("(R + 1) / cos(45)", Spec.polygonVertexDefs(g)[0].length, "length");
});
test("เปลี่ยน parameter R / Th แล้วรูปตาม · Side = Left = ภาพกระจก", () => {
  const s = base(), g = Spec.addPolygon(s, { center: "P2", n: 5, radius: "R", angle: "Th" });
  const p = ev(s, { R: 2, Th: 90 }).pts[g.points[0]];
  near(1, p.x, "Th = 90 → จุดแรกไปทางซ้ายของศูนย์กลาง (x = 3 - 2)", 1e-9); near(2, p.y, "y", 1e-9);
  const L = ev(s, { R: 2, Th: 90, Side: 1 }).pts[g.points[0]];
  near(-1, L.x, "Left: x กลับเครื่องหมาย", 1e-9); near(2, L.y, "y เท่าเดิม", 1e-9);
});

console.log("แก้ทีหลัง");
test("updatePolygon: แก้ R / θ / โหมด แล้ว id ของจุดยอดเดิม · จุดที่อ้างจุดยอดตามไป", () => {
  const s = base(), g = Spec.addPolygon(s, { center: "P2", n: 4, radius: "1", angle: "0" });
  const ids = g.points.slice(), q = Spec.addPoint(s, { type: "delta", from: g.points[0], dx: "1", dy: "0" });
  g.radius = "2"; g.mode = "circumscribed"; Spec.updatePolygon(s, g);
  eq(ids.join(), g.points.join(), "id เดิม");
  const r = ev(s);
  near(2 * Math.SQRT2 + 2, r.pts[g.points[0]].y, "ระยะถึงมุม = 2/cos45", 1e-9);
  near(r.pts[g.points[0]].x + 1, r.pts[q].x, "จุดที่อ้างตาม", 1e-9);
});
test("rebuildPolygon: เปลี่ยน N สร้างจุด / link / shape ใหม่ · คง codes ของ link / shape", () => {
  const s = base(), g = Spec.addPolygon(s, { center: "P2", n: 4, radius: "1", angle: "0" });
  Spec.byId(s.links, g.links[0]).codes = ["Top"]; Spec.byId(s.shapes, g.shape).codes = ["Pave"];
  eq(0, Spec.rebuildPolygon(s, g, 6).length, "ไม่มีตัวขวาง");
  eq(6, g.points.length, "จุดยอด"); eq(6, g.n, "N");
  ok(g.links.every(id => Spec.byId(s.links, id).codes[0] === "Top"), "codes link");
  eq("Pave", Spec.byId(s.shapes, g.shape).codes[0], "codes shape");
  eq(2 + 6, s.points.length, "จุดทั้งหมด = origin + ศูนย์กลาง + 6");
  ok(!ev(s).shapes[g.shape].err, "shape ใหม่ปิดรูป");
});
test("rebuildPolygon: มีของอื่นอ้างจุดยอด = ไม่ทำ + คืนรายชื่อที่ขวาง", () => {
  const s = base(), g = Spec.addPolygon(s, { center: "P2", n: 4, radius: "1", angle: "0" });
  const q = Spec.addPoint(s, { type: "delta", from: g.points[2], dx: "1", dy: "0" });
  const before = JSON.stringify(s), b = Spec.rebuildPolygon(s, g, 5);
  eq(q, b[0], "ตัวขวาง"); eq(before, JSON.stringify(s), "spec ไม่เปลี่ยน");
});
test("ลบจุดยอด = ข้อมูล polygon หายไปด้วย (เหลือแต่จุดธรรมดา)", () => {
  const s = base(), g = Spec.addPolygon(s, { center: "P2", n: 4, radius: "1", angle: "0" });
  Spec.removeCascade(s, "point", g.points[1]);
  eq(0, (s.polygons || []).length, "polygons");
});
test("polygonOf: หาได้จากจุดยอด / link / shape · ศูนย์กลางเฉพาะ withCenter", () => {
  const s = base(), g = Spec.addPolygon(s, { center: "P2", n: 3, radius: "1", angle: "0" });
  eq(g, Spec.polygonOf(s, "point", g.points[1]), "จุดยอด"); eq(g, Spec.polygonOf(s, "link", g.links[2]), "link");
  eq(g, Spec.polygonOf(s, "shape", g.shape), "shape");
  eq(null, Spec.polygonOf(s, "point", "P2"), "ศูนย์กลาง ไม่ withCenter"); eq(g, Spec.polygonOf(s, "point", "P2", true), "withCenter");
});

console.log("Move / Copy");
test("เลือกชิ้นเดียว = ได้ทั้งรูป + จุดศูนย์กลาง · ย้ายศูนย์กลางแล้วจุดยอดตาม", () => {
  const s = base(), g = Spec.addPolygon(s, { center: "P2", n: 5, radius: "R", angle: "0" });
  const f = Ops.expand(s, { links: [g.links[3]] });
  eq(6, f.points.length, "จุด"); eq(5, f.links.length, "link"); eq(1, f.shapes.length, "shape");
  const pl = Ops.plan(s, f.points);
  eq(0, pl.blocked.length, "ไม่มีจุดติด"); eq(1, pl.edit.length, "แก้แค่ศูนย์กลาง");
  const before = ev(s).pts[g.points[0]];
  Ops.apply(s, pl, { x: 1, y: -1 }, 1, ev(s).pts);
  const after = ev(s).pts[g.points[0]];
  near(before.x + 1, after.x, "x", 1e-9); near(before.y - 1, after.y, "y", 1e-9);
  eq("R", Spec.byId(s.points, g.points[0]).def.length, "ยังเป็นนิพจน์ R");
});
test("Copy ทั้งรูป = ได้ polygon ใหม่ (G2) ที่แก้ N / R ต่อได้", () => {
  const s = base(), g = Spec.addPolygon(s, { center: "P2", n: 4, radius: "1", angle: "0" });
  const c = Ops.clone(s, Ops.expand(s, { shapes: [g.shape] }), s);
  eq(2, s.polygons.length, "polygons"); const g2 = s.polygons[1];
  eq("G2", g2.id, "id"); eq(c.map.P2, g2.center, "ศูนย์กลางใหม่");
  ok(Spec.isAux(Spec.byId(s.points, g2.center)), "ศูนย์กลางของสำเนายังเป็นจุดช่วยสร้าง");
  ok(g2.points.every(id => !g.points.includes(id)), "จุดยอดใหม่");
  eq(0, Spec.rebuildPolygon(s, g2, 8).length, "เปลี่ยน N ของสำเนาได้"); eq(4, g.n, "ตัวเดิมไม่เปลี่ยน");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
