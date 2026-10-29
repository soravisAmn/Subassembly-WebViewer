// ทดสอบ Object Snap Tracking (SA.Web/wwwroot/js/track.js) + polar / จุดช่วยสร้างใน spec.js
// รัน: node SA.Tests/js/track.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(["expr.js", "spec.js", "snap.js", "track.js"].map(js).join("\n") + "\nthis.Spec = Spec; this.Snap = Snap; this.Track = Track;", ctx);
const { Spec, Track } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const near = (exp, act, what, tol = 1e-9) => { if (!(Math.abs(exp - act) <= tol)) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const S = { x: 100, y: 100 }, R = 12;            // 100 px ต่อเมตร · รัศมี 12 px

console.log("จับ / ปล่อยจุด");
test("ชี้ค้างซ้ำที่จุดเดิม = ปล่อย · ใหม่ต่อท้าย · จุดล่าสุด = จุดอ้างอิงหลัก", () => {
  const a = { kind: "end", x: 1, y: 2, label: "P3" }, b = { kind: "mid", x: 4, y: 0, label: "กึ่งกลาง L1" };
  let l = Track.toggle([], a); l = Track.toggle(l, b);
  eq(2, l.length, "จับ 2 จุด"); eq("กึ่งกลาง L1", Track.main(l).label, "จุดหลัก");
  l = Track.toggle(l, { ...a });
  eq(1, l.length, "ปล่อยจุดเดิม"); eq("mid", l[0].kind, "เหลือ");
});
test(`จับได้สูงสุด ${7} จุด (ทิ้งตัวเก่าสุด)`, () => {
  let l = [];
  for (let i = 0; i < 9; i++) l = Track.toggle(l, { kind: "end", x: i, y: 0, label: "P" + i });
  eq(Track.MAX, l.length, "จำนวน"); eq("P2", l[0].label, "ตัวเก่าสุดที่เหลือ"); eq("P8", Track.main(l).label, "ล่าสุด");
});
test("จับได้เฉพาะ snap แม่น (ไม่ใช่ Nearest / Surface / จุดอิสระ)", () => {
  ok(Track.acquirable({ kind: "end" }) && Track.acquirable({ kind: "cen" }) && Track.acquirable({ kind: "int" }), "end/cen/int");
  ok(!Track.acquirable({ kind: "near" }) && !Track.acquirable({ kind: "surf" }) && !Track.acquirable({ kind: "free" }) && !Track.acquirable(null), "near/surf/free");
});

console.log("เส้น tracking");
const P3 = { kind: "end", x: 2, y: 1, label: "P3" }, P7 = { kind: "end", x: 5, y: -2, label: "P7" };
test("เมาส์ตรงแนวดิ่งของจุดที่จับ = จุดบนเส้นดิ่ง (x เท่าจุดนั้นพอดี)", () => {
  const r = Track.collect([P3], { x: 2.05, y: -3 }, S, R);
  eq(1, r.length, "จำนวน"); eq("v", r[0].dir, "ทิศ"); near(2, r[0].x, "x"); near(-3, r[0].y, "y"); near(-4, r[0].dist, "ระยะจาก P3");
  ok(/แนวดิ่งจาก P3/.test(r[0].label), "ป้าย");
});
test("แนวราบ + ปัดระยะตาม Grid snap", () => {
  const r = Track.collect([P3], { x: 3.27, y: 1.08 }, S, R, v => Math.round(v / 0.5) * 0.5);
  eq("h", r[0].dir, "ทิศ"); near(1, r[0].y, "y"); near(3.5, r[0].x, "x ปัด 0.5 จาก P3");
});
test("ห่างเกินรัศมี = ไม่มี · อยู่บนจุดนั้นเอง = ไม่ใช่ tracking (เป็น Endpoint อยู่แล้ว)", () => {
  eq(0, Track.collect([P3], { x: 2.5, y: 0 }, S, R).length, "ไกล");
  eq(0, Track.collect([P3], { x: 2.01, y: 1.01 }, S, R).length, "บนจุด");
});
test("จุดตัดของแนวดิ่งจากจุดหนึ่งกับแนวราบจากอีกจุด มาก่อน", () => {
  const r = Track.collect([P3, P7], { x: 2.03, y: -1.96 }, S, R);
  eq("x", r[0].dir, "ตัวแรกเป็นจุดตัด"); near(2, r[0].x, "x = P3"); near(-2, r[0].y, "y = P7");
  ok(r.length >= 3, "ยังมีเส้นเดี่ยวให้ Tab วน");
});
test("รวมกับ OSNAP: snap แม่นก่อน → tracking → Nearest / Surface", () => {
  const list = Track.merge([{ kind: "end" }, { kind: "near" }, { kind: "mid" }], [{ kind: "trk" }]);
  eq("end,mid,trk,near", list.map(c => c.kind).join(","), "ลำดับ");
});

console.log("จุดอ้างอิงในสเปก (ผูกกับจุดที่จับ)");
function base(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "W", kind: "double", default: 4 });
  s.points.push({ id: "P2", codes: [], def: { type: "delta", from: "P1", dx: "W", dy: "0" } });
  s.links.push({ id: "L1", points: ["P1", "P2"], codes: [] });
  return s;
}
test("จับกึ่งกลาง link → สร้างจุดช่วยสร้าง (between) แล้วจุดใหม่อ้างจากจุดนั้น · เปลี่ยน W แล้วจุดใหม่ตาม", () => {
  const s = base();
  const from = Track.refPoint(s, { type: "between", a: "P1", b: "P2", t: "0.5" }, 1);
  const c = Spec.byId(s.points, from);
  ok(Spec.isAux(c), "ต้องเป็นจุดช่วยสร้าง");
  const id = Spec.addPoint(s, { type: "delta", from, dx: "0", dy: "-1.5" });
  const p = W => Spec.evaluate(s, { values: { W } }).pts[id];
  near(2, p(4).x, "W = 4"); near(3, p(6).x, "W = 6 ต้องเลื่อนตาม"); near(-1.5, p(6).y, "y");
});
test("จับจุดที่วาดอยู่แล้ว = ใช้จุดเดิม ไม่สร้างใหม่ · origin / จุดของโค้ดเดิมใช้ซ้ำได้", () => {
  const s = base(), n = s.points.length;
  eq("P2", Track.refPoint(s, { type: "pt", id: "P2" }, 1), "pt");
  eq("P1", Track.refPoint(s, { type: "origin" }, 1), "origin มีอยู่แล้ว");
  const e1 = Track.refPoint(s, { type: "code", code: "Crest" }, 1), e2 = Track.refPoint(s, { type: "code", code: "Crest" }, 1);
  eq(e1, e2, "external ใช้ซ้ำ"); eq(n + 1, s.points.length, "สร้างเพิ่มแค่ 1"); ok(Spec.isAux(Spec.byId(s.points, e1)), "external ที่สร้างเพื่ออ้างอิง = ช่วยสร้าง");
});
test("link จริงที่ปลายเป็นจุด auxiliary = ข้าม + เตือน (ตรงกับโค้ด C#)", () => {
  const s = base();
  const c = Track.refPoint(s, { type: "between", a: "P1", b: "P2", t: "0.5" }, 1);
  s.links.push({ id: "L2", points: ["P1", c], codes: [] });
  const r = Spec.evaluate(s, {});
  ok(r.links.L2.err && /auxiliary/.test(r.links.L2.err), "L2 ต้อง error"); ok(!r.links.L1.err, "L1 ปกติ");
});

console.log("polar (ระยะ<มุม)");
test("พิมพ์ ระยะ<มุม", () => {
  const p = Track.polarText("5<30"); eq("5", p.length, "ระยะ"); eq("30", p.angle, "มุม");
  const q = Track.polarText(" W / 2 < Ang + 90 "); eq("W / 2", q.length, "ระยะนิพจน์"); eq("Ang + 90", q.angle, "มุมนิพจน์");
  eq(null, Track.polarText("5"), "ไม่ใช่ polar");
});
test("polar ฝั่ง Right / Left: มุมบนจอเดียวกันได้จุดเดียวกันบนจอ", () => {
  const mk = (F, angleScreen) => {
    const s = Spec.newSpec("T");
    s.points.push({ id: "P2", codes: [], def: { type: "polar", from: "P1", length: "2", angle: Track.specAngle(angleScreen, F) } });
    return Spec.evaluate(s, { values: { Side: F === -1 ? 1 : 0 } }).pts.P2;
  };
  const r = mk(1, "30"), l = mk(-1, "30");
  near(2 * Math.cos(Math.PI / 6), r.x, "Right x", 1e-9); near(1, r.y, "Right y", 1e-9);
  near(r.x, l.x, "Left: มุมบนจอเดียวกัน x เท่ากัน", 1e-9); near(r.y, l.y, "y", 1e-9);
  eq("180 - (Ang)", Track.specAngle("Ang", -1), "นิพจน์ฝั่ง Left");
});
test("spec เดียวกัน สลับ Side = ภาพกระจก (x กลับเครื่องหมาย)", () => {
  const s = Spec.newSpec("T");
  s.points.push({ id: "P2", codes: [], def: { type: "polar", from: "P1", length: "3", angle: "60" } });
  const a = Spec.evaluate(s, {}).pts.P2, b = Spec.evaluate(s, { values: { Side: 1 } }).pts.P2;
  near(-a.x, b.x, "x", 1e-9); near(a.y, b.y, "y", 1e-9);
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
