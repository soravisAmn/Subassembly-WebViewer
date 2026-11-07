// ทดสอบ Clipped Surface Link ของรอบ 4c M4 (link followClipped + Spec.clipPath / addFollowClipped ใน spec.js)
// รัน: node SA.Tests/js/clip.test.js
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

// ผิวดินขรุขระ: ตัดระดับ -2 หลายครั้ง
const SURF = [{ x: -30, y: -1 }, { x: -2, y: -1.5 }, { x: 0, y: -2.6 }, { x: 2, y: -1 }, { x: 4.3, y: -2.4 }, { x: 30, y: -6 }];
const run = (s, o = {}) => Spec.evaluate(s, { values: o.values || {}, codeParams: [], codePoints: [], surface: o.surface === undefined ? SURF : o.surface,
                                             extendEnds: true, layout: !!o.layout });

// BuildBottom ของ base_rock-pitching.cs (เขียนตามไฟล์ของผู้ใช้ — อ่านอย่างเดียว) — ขอบล่าง min(ดิน, baseY) จาก l ถึง r
function buildBottom(ground, l, r, baseY){
  const profile = [{ x: l.x, y: ground.elev(l.x) }, ...ground.between(l.x, r.x), { x: r.x, y: ground.elev(r.x) }];
  const raw = [{ x: profile[0].x, y: Math.min(profile[0].y, baseY) }];
  for (let i = 0; i < profile.length - 1; i++){
    const a = profile[i], b = profile[i + 1];
    if ((a.y - baseY) * (b.y - baseY) < 0){ const t = (baseY - a.y) / (b.y - a.y); raw.push({ x: a.x + t * (b.x - a.x), y: baseY }); }
    raw.push({ x: b.x, y: Math.min(b.y, baseY) });
  }
  const isOn = y => Math.abs(y - baseY) < 1e-4, cleaned = [];
  for (const p of raw){
    if (cleaned.length && Math.abs(p.x - cleaned[cleaned.length - 1].x) < 1e-4) continue;
    if (cleaned.length >= 2 && isOn(p.y) && isOn(cleaned[cleaned.length - 1].y) && isOn(cleaned[cleaned.length - 2].y)){ cleaned[cleaned.length - 1] = p; continue; }
    cleaned.push(p);
  }
  const bottom = cleaned.length < 2 ? [l, r] : [l, ...cleaned.slice(1, -1), r];
  const codes = bottom.slice(1).map((b, i) => isOn(bottom[i].y) && isOn(b.y) ? "Datum,TrapBase" : "Datum,TrapOnSurface");
  return { bottom, codes };
}
const L = { codes: ["Datum"], codesGround: ["TrapOnSurface"], codesLine: ["TrapBase"] };

test("clipPath = BuildBottom ของ base_rock-pitching (ระดับฐานคงที่) ทั้งจุดและ code — หลายผิวดิน / หลายช่วง", () => {
  const surfaces = [SURF, [{ x: -30, y: 0 }, { x: 30, y: 0 }], [{ x: -30, y: -3 }, { x: 30, y: -3 }],
                    [{ x: -5, y: -2 }, { x: -1, y: -2 }, { x: 1, y: -3 }, { x: 3, y: -2 }, { x: 4, y: -2.00001 }, { x: 9, y: -1 }]];
  for (const s of surfaces){
    const g = Spec.makeGround(s, true);
    for (const [l, r] of [[{ x: -1.2, y: -2.1 }, { x: 4.1, y: -2.3 }], [{ x: -1, y: -2 }, { x: 4, y: -2 }], [{ x: 4.1, y: -2.3 }, { x: -1.2, y: -2.1 }]]){
      const want = buildBottom(g, l, r, -2), got = Spec.clipPath(L, l, r, { x: 0, y: -2 }, { x: 1, y: -2 }, g, false, m => { throw new Error(m); });
      eq(want.bottom.length, got.path.length, "จำนวนจุด " + JSON.stringify(s));
      want.bottom.forEach((p, i) => { near(p.x, got.path[i].x, `x ${i}`); near(p.y, got.path[i].y, `y ${i}`); });
      eq(want.codes.join("|"), got.segCodes.map(c => c.join(",")).join("|"), "code");
    }
  }
});
test("ไม่ต่ำกว่าเส้น (above) · เส้นอ้างอิงเอียง (ต่อออกไปได้) · ช่วงบนเส้นเอียงตัดจุดกลางทิ้ง", () => {
  const g = Spec.makeGround([{ x: -10, y: -3 }, { x: 0, y: 0 }, { x: 1, y: -3 }, { x: 2, y: -3 }, { x: 10, y: 2 }], true);
  const A = { x: -5, y: -1 }, B = { x: 5, y: -1 };
  const up = Spec.clipPath({ ...L, side: "above" }, A, B, { x: 0, y: -1 }, { x: 1, y: -1 }, g, false, m => { throw new Error(m); });
  for (const p of up.path.slice(1, -1)) ok(p.y >= -1 - 1e-12, "ไม่ต่ำกว่า -1: " + JSON.stringify(p));
  // ดินต่ำกว่า -1 เกือบทั้งช่วง ยกเว้นยอด (0, 0) และปลายขวา: บนเส้น → ขึ้นยอด → บนเส้น → ขึ้นตามดินช่วงท้าย
  ok(up.segOn.filter(Boolean).length === 2 && up.path.length <= 9, JSON.stringify(up.path.map(p => [+p.x.toFixed(3), +p.y.toFixed(3)])) + JSON.stringify(up.segOn));
  // เส้นอ้างอิงเอียง 1:10 ผ่าน (0,-2) (นิยามด้วยช่วงสั้นๆ แต่ใช้ทั้งเส้น)
  const tilt = Spec.clipPath(L, { x: -8, y: -2.8 }, { x: 8, y: -1.2 }, { x: 0, y: -2 }, { x: 0.1, y: -1.99 }, g, false, m => { throw new Error(m); });
  const line = x => -2 + 0.1 * x;
  for (const p of tilt.path.slice(1, -1)) ok(p.y <= line(p.x) + 1e-9, "ไม่สูงกว่าเส้นเอียง");
  ok(tilt.segOn.some(Boolean) && tilt.segOn.some(o => !o), "มีทั้งช่วงบนเส้น / ตามดิน");
  eq(tilt.segCodes.length, tilt.path.length - 1, "code ทุกท่อน");
});
test("ไม่มีดิน / Layout / เส้นอ้างอิงแนวดิ่ง = เส้นตรง + code ช่วงบนเส้น (Layout ไม่เตือน)", () => {
  const msgs = [], A = { x: 0, y: 0 }, B = { x: 3, y: 0 };
  const a = Spec.clipPath(L, A, B, { x: 0, y: -1 }, { x: 1, y: -1 }, null, true, m => msgs.push(m), "x");
  eq(2, a.path.length, "ตรง"); eq("Datum,TrapBase", a.segCodes[0].join(), "code"); eq(0, msgs.length, "Layout ไม่เตือน");
  Spec.clipPath(L, A, B, { x: 0, y: -1 }, { x: 1, y: -1 }, null, false, m => msgs.push(m), "ไม่ได้กำหนด Target Surface");
  Spec.clipPath(L, A, B, { x: 2, y: -1 }, { x: 2, y: -5 }, Spec.makeGround(SURF, true), false, m => msgs.push(m), "x");
  eq(2, msgs.length, "เตือน 2 ครั้ง"); ok(/แนวดิ่ง/.test(msgs[1]), msgs[1]);
});
function clipSpec(){
  const s = Spec.newSpec("T");
  s.params.push({ name: "Depth", kind: "double", default: 2 });
  s.points.push(pt("P2", { type: "delta", dx: "4", dy: "-Depth" }), pt("P3", { type: "delta", dx: "-1", dy: "-Depth" }));
  s.links.push({ id: "L1", points: ["P3", "P2"], codes: [], auxiliary: true });
  return s;
}
test("addFollowClipped + evaluate: เส้นอ้างอิง link aux / ระดับนิพจน์ ให้ผลเดียวกัน · error", () => {
  const s = clipSpec();
  const a = Spec.addFollowClipped(s, "P2", "P3", { refLink: "L1", codes: ["Datum"], codesGround: ["TrapOnSurface"], codesLine: ["TrapBase"] });
  const b = Spec.addFollowClipped(s, "P2", "P3", { refLevel: "-Depth", codes: ["Datum"], codesGround: ["TrapOnSurface"], codesLine: ["TrapBase"] });
  ok(!a.error && !b.error, a.error || b.error);
  const l = Spec.byId(s.links, a.link);
  eq("followClipped", l.type, "type"); eq("below", l.side, "side"); eq("TargetSurface", l.target, "target"); ok(!("refLevel" in l), "ไม่มี refLevel");
  const r = run(s);
  ok(!r.issues.length, JSON.stringify(r.issues));
  const pa = r.links[a.link].path, pb = r.links[b.link].path;
  eq(pa.length, pb.length, "จำนวนจุดเท่ากัน");
  pa.forEach((p, i) => { near(p.x, pb[i].x, "x"); near(p.y, pb[i].y, "y"); });
  ok(pa.every(p => p.y <= -2 + 1e-9), "ไม่สูงกว่าฐาน");
  ok(Spec.exprSlots(s).some(x => x.key === "refLevel"), "refLevel เป็นช่องนิพจน์");
  ok(Spec.addFollowClipped(s, "P2", "P2", { refLevel: "0" }).error, "จุดเดียวกัน");
  ok(Spec.addFollowClipped(s, "P2", "P3", {}).error, "ไม่มีเส้นอ้างอิง");
  ok(Spec.addFollowClipped(s, "P2", "P3", { refLink: a.link }).error, "เส้นอ้างอิงไม่ใช่เส้นตรง");
  // เส้นอ้างอิงถูกลบ (แก้ไฟล์เอง) = เตือน · ลบเส้นอ้างอิงด้วย removeCascade = link นี้หายด้วย
  const gone = Spec.cascadePreview(s, "link", "L1");
  ok(gone.includes(a.link) && !gone.includes(b.link), gone.join());
  Spec.byId(s.links, a.link).refLink = "L99";
  const r2 = run(s);
  ok(r2.links[a.link].err && r2.issues.some(i => i.obj === a.link), "เตือนเส้นอ้างอิงไม่มี");
});
test("Side = Left = ภาพกระจก · กิ่งของจุดอ้างอิงไม่เกิด = link ไม่เกิดเงียบ", () => {
  const s = clipSpec(), a = Spec.addFollowClipped(s, "P2", "P3", { refLink: "L1" });
  const R = run(s), Lr = run(s, { values: { Side: 1 }, surface: SURF.map(p => ({ x: -p.x, y: p.y })) });
  const pr = R.links[a.link].path, pl = Lr.links[a.link].path;
  eq(pr.length, pl.length, "จำนวนจุด");
  pr.forEach((p, i) => { near(-p.x, pl[i].x, "x"); near(p.y, pl[i].y, "y"); });
  s.logic = { conditions: [], decisions: [{ id: "D1", kind: "if", test: "false" }], branches: [{ id: "B1", decision: "D1", case: true }, { id: "B2", decision: "D1", case: false }] };
  Spec.byId(s.points, "P2").branch = "B1";
  const r = run(s);
  ok(r.links[a.link].off && !r.issues.length, JSON.stringify(r.links[a.link]) + JSON.stringify(r.issues));
});
test("Copy: เส้นอ้างอิงที่สำเนามาด้วย = ใช้ตัวสำเนา · ไม่ได้มาด้วย = ใช้ตัวเดิม · Extend to Surface ย้ายปลาย from / to ได้", () => {
  const s = clipSpec(), a = Spec.addFollowClipped(s, "P2", "P3", { refLink: "L1" });
  const both = Ops.clone(s, Ops.expand(s, { links: [a.link, "L1"] }), s);
  const c1 = Spec.byId(s.links, both.links.find(id => Spec.byId(s.links, id).type === "followClipped"));
  ok(c1.refLink !== "L1" && both.links.includes(c1.refLink), "ใช้ตัวสำเนา " + c1.refLink);
  const one = Ops.clone(s, Ops.expand(s, { links: [a.link] }), s);
  eq("L1", Spec.byId(s.links, one.links[0]).refLink, "ใช้ตัวเดิม");
  // Extend to Surface ที่ปลาย P2 ของเส้น P1–P2 : from ของ link ตามดินย้ายไปปลายจริง
  s.links.push({ id: "L9", points: ["P1", "P2"], codes: [] });
  const x = Spec.addExtendToGround(s, "L9", "P2");
  ok(x.rewired.includes(a.link) && Spec.byId(s.links, a.link).from === x.tip, "from = ปลายจริง");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process !== "undefined") process.exitCode = failed ? 1 : 0;
