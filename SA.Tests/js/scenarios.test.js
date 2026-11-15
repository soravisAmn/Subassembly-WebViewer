// Round 8 M3: scenarios in the project file (Scen in SA.Web/wwwroot/js/scenarios.js) + several codes on one object
// รัน: node SA.Tests/js/scenarios.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
// only the pure part of scenarios.js (before the page part)
vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("scenarios.js").split("// ---------------- page")[0] + "\nthis.Scen = Scen; this.Spec = Spec;", ctx);
const { Scen, Spec } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const J = o => JSON.stringify(o);

const ground = [{ x: -20, y: 1.5 }, { x: 0, y: 0 }, { x: 15, y: -1.8 }];
const base = () => ({ surface: [{ x: -10, y: 0 }, { x: 10, y: 0 }], surfaceOn: true, layout: false, params: { i1: { H: 2, W: 3 }, i2: { Side: 0 } } });

console.log("Scenarios (project file)");
test("บันทึกกรณี: เก็บผิวดิน + ค่าที่ต่างจากโปรเจกต์ + โหมด เท่านั้น", () => {
  const w = { surface: ground, surfaceOn: true, layout: false, params: { i1: { H: 3.5, W: 3 }, i2: { Side: 0 }, i9: { X: 1 } } };
  const s = Scen.capture("ตลิ่งสูง", w, base());
  eq('{"name":"ตลิ่งสูง","ground":[[-20,1.5],[0,0],[15,-1.8]],"params":{"i1":{"H":3.5}},"mode":"normal"}', J(s), "scenario");
  eq('{"name":"L","mode":"layout"}', J(Scen.capture("L", { ...base(), layout: true }, base())), "Layout");
  eq('{"name":"N","mode":"notarget"}', J(Scen.capture("N", { ...base(), surfaceOn: false }, base())), "ไม่มี target");
});
test("ใช้กรณี: ได้ผิวดิน / ค่า / โหมด ของกรณี บนค่าของโปรเจกต์ · Default = ค่าของโปรเจกต์คงเดิม", () => {
  const b = base(), s = { name: "s", ground: [[0, 1], [5, 2]], params: { i1: { H: 9 } }, mode: "normal" };
  const w = Scen.apply(s, b);
  eq('[{"x":0,"y":1},{"x":5,"y":2}]', J(w.surface), "ผิวดิน");
  eq('{"H":9,"W":3}', J(w.params.i1), "ค่า i1");
  eq('{"Side":0}', J(w.params.i2), "ค่า i2");
  eq(true, w.surfaceOn && !w.layout, "โหมด");
  eq(J(base()), J(b), "ค่าของโปรเจกต์ไม่ถูกแก้");
  const w2 = Scen.apply({ name: "L", mode: "layout" }, b);
  eq(J(b.surface), J(w2.surface), "ไม่มี ground = ผิวดินของโปรเจกต์");
  eq(true, w2.layout, "Layout");
  eq(false, Scen.apply({ name: "N", mode: "notarget" }, b).surfaceOn, "ไม่มี target");
});
test("บั๊กเดิม: ใช้กรณีที่บันทึกก่อนวาดเพิ่ม ไม่ทำให้ส่วนที่วาดย้อนกลับ (กรณีไม่มี spec / item / geometry)", () => {
  // workspace: draw, save a case, draw more, apply the case
  const ws = { items: [{ id: "i1", params: { H: 2 }, spec: { points: [{ id: "P1" }] } }] };
  const b = { surface: ground, surfaceOn: true, layout: false, params: { i1: { H: 2 } } };
  const s = Scen.capture("ก่อนวาดเพิ่ม", { ...b, params: { i1: { H: 5 } } }, b);
  ws.items[0].spec.points.push({ id: "P2" });                 // drawn after the case was saved
  ws.items.push({ id: "i2", params: {}, spec: { points: [] } });
  const w = Scen.apply(s, b);
  for (const k of Object.keys(w)) if (!["surface", "surfaceOn", "layout", "params"].includes(k)) throw new Error("apply คืนค่าที่ไม่ใช่ผิวดิน / ค่า / โหมด: " + k);
  for (const id in w.params) ws.items.find(it => it.id === id).params = w.params[id];   // what the page does (applyWork)
  eq("P1,P2", ws.items[0].spec.points.map(p => p.id).join(","), "ส่วนที่วาดยังอยู่");
  eq(2, ws.items.length, "item ที่เพิ่มทีหลังยังอยู่");
  eq(5, ws.items[0].params.H, "ค่าของกรณี");
  for (const k of ["spec", "ws", "items", "assemblies", "savedSpec"]) if (J(s).includes(`"${k}"`)) throw new Error("กรณีมี " + k);
});
test("ค่าที่แก้ค้าง: equal ไม่สนชื่อ, ต่างเมื่อผิวดิน / ค่า / โหมด ต่าง", () => {
  const b = base(), s = Scen.capture("a", { ...b, surface: ground }, b);
  eq(true, Scen.equal(s, Scen.capture("b", { ...b, surface: ground }, b)), "เหมือน");
  eq(false, Scen.equal(s, Scen.capture("a", { ...b, surface: ground, params: { ...b.params, i1: { H: 7, W: 3 } } }, b)), "ค่าต่าง");
  eq(false, Scen.equal(s, Scen.capture("a", { ...b, surface: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, b)), "ผิวดินต่าง");
  eq(false, Scen.equal(s, Scen.capture("a", { ...b, layout: true }, b)), "โหมดต่าง");
});
test("view (coverage / Build / sa_check): ค่าของ item ในกรณี, item ใหม่ใช้ค่าของตัวเอง, Layout / ไม่มี target = ไม่มีผิวดิน", () => {
  const b = base(), s = { name: "s", ground: [[0, 1], [5, 2]], params: { i1: { H: 9 } }, mode: "normal" };
  eq('{"H":9,"W":3}', J(Scen.view(s, b, "i1").values), "i1");
  eq('{"Q":1}', J(Scen.view(s, b, "new", { Q: 1 }).values), "item ที่ไม่มีในค่าของโปรเจกต์");
  eq(2, Scen.view(s, b, "i1").surface.length, "ผิวดิน");
  eq(null, Scen.view({ name: "L", mode: "layout" }, b, "i1").surface, "Layout");
  eq(true, Scen.view({ name: "L", mode: "layout" }, b, "i1").layout, "Layout flag");
  eq(null, Scen.view({ name: "N", mode: "notarget" }, b, "i1").surface, "ไม่มี target");
});
test("แปลง scenario เก่า (snapshot ทั้ง workspace): ผิวดิน + โหมด + ค่าที่ต่าง, จับคู่ด้วย id แล้วด้วยชื่อไฟล์, ไม่เอา spec", () => {
  const items = [{ id: "i1", file: "body.cs" }, { id: "i2", file: "base.cs" }];
  const old = { name: "เก่า", file: "2 subassembly", ws: { version: 2, surface: ground, surfaceOn: true, layout: false,
    assemblies: [{ items: [{ id: "i1", file: "body.cs", params: { H: 4, W: 3 }, spec: { big: 1 } }, { id: "zz", file: "BASE.cs", params: { Side: 1 } }, { id: "q", file: "other.cs", params: {} }] }] } };
  const r = Scen.fromOld(old, items, base());
  eq(2, r.matched, "จับคู่ได้ 2 ตัว (id, ชื่อไฟล์)");
  eq("body.cs,BASE.cs,other.cs", r.names.join(","), "ชื่อใน dialog");
  eq('{"name":"เก่า","ground":[[-20,1.5],[0,0],[15,-1.8]],"params":{"i1":{"H":4},"i2":{"Side":1}},"mode":"normal"}', J(r.scenario), "กรณีใหม่");
  const v1 = Scen.fromOld({ name: "v1", ws: { surface: ground, surfaceOn: false, items: [{ id: "i1", params: { H: 2, W: 3 } }] } }, items, base());
  eq('{"name":"v1","mode":"notarget"}', J(v1.scenario), "รุ่น 1 ไม่มี target ไม่มีค่าต่าง");
  const one = Scen.fromOld({ name: "ไฟล์เดียว", file: "body.cs", values: { H: 6 }, surface: ground, layout: true }, items, base());
  eq('{"name":"ไฟล์เดียว","params":{"i1":{"H":6}},"mode":"layout"}', J(one.scenario), "แบบไฟล์เดียวเดิม");
  eq(false, Scen.isNew(old), "รู้ว่าเป็นแบบเก่า");
  eq(true, Scen.isNew(r.scenario), "รู้ว่าเป็นแบบใหม่");
});
test("ชื่อซ้ำตอน import / AI ได้ชื่อใหม่", () => {
  const list = [{ name: "a" }, { name: "a (2)" }];
  eq("a (3)", Scen.freeName(list, "a"), "ชื่อที่ว่าง");
  eq("b", Scen.freeName(list, "b"), "ไม่ซ้ำ");
});
test("หลาย code ใน object เดียว: Spec.normalize เก็บครบทุกตัว (จุด / link / shape)", () => {
  const sp = { version: 1, className: "C", namespace: "T", params: [], targets: [],
    points: [{ id: "P1", codes: ["A", "B", "C"], def: { type: "origin" } }, { id: "P2", codes: ["Top", "Edge"], def: { type: "delta", from: "P1", dx: "1", dy: "0" } },
             { id: "P3", codes: [], def: { type: "delta", from: "P1", dx: "0", dy: "-1" } }],
    links: [{ id: "L1", points: ["P1", "P2"], codes: ["Top", "Datum"] }, { id: "L2", points: ["P2", "P3"], codes: ["Side"] }, { id: "L3", points: ["P3", "P1"], codes: ["Back", "Datum"] }],
    shapes: [{ id: "S1", links: ["L1", "L2", "L3"], codes: ["Fill", "Pave"] }], side: null };
  const n = Spec.normalize(JSON.parse(J(sp)), []);
  eq("A,B,C", n.points[0].codes.join(","), "จุด P1");
  eq("Top,Edge", n.points[1].codes.join(","), "จุด P2");
  eq("Top,Datum", n.links[0].codes.join(","), "link L1");
  eq("Fill,Pave", n.shapes[0].codes.join(","), "shape S1");
  const r = Spec.evaluate(n, { values: {}, surface: null, layout: true });
  eq(true, !!r.shapes.S1 && !r.shapes.S1.err, "shape คำนวณได้");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (failed) process.exitCode = 1;
