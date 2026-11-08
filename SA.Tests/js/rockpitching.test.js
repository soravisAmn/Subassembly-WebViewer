// รอบ 4c M6: วาด base_rock-pitching.cs / body_rock-pitching.cs ใหม่ด้วยเครื่องมือของเว็บเท่านั้น (ไม่เขียนโค้ด)
//   build*() = ลำดับการกดเครื่องมือ (ฟังก์ชันเดียวกับที่ปุ่มเรียก) + การแก้ใน Properties — ผลคือ spec ใน base_rock-pitching-web.cs / body_rock-pitching-web.cs (รอบ 4e — tests-civil3d/round4c-*.cs = รุ่นรอบ 4c)
//   test นี้: (1) spec ที่สร้างใหม่ = sa-spec ในไฟล์ (ทำซ้ำได้) (2) คำนวณได้ไม่มีเตือน / รูปปิด หลายผิวดิน
//   การเทียบกับไฟล์จริง (พิกัด shape / code) อยู่ใน SA.Tests/RockPitchingTests.cs (รันไฟล์จริงกับตัวจำลอง)
// รัน: node SA.Tests/js/rockpitching.test.js
"use strict";
const { Expr, Spec, Ops, readText } = typeof require === "function" ? (() => {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
  const ctx = vm.createContext({ console });
  vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("ops.js") + "\nthis.Expr = Expr; this.Spec = Spec; this.Ops = Ops;", ctx);
  ctx.readText = f => { try{ return fs.readFileSync(path.join(__dirname, "../..", f), "utf8"); }catch{ return null; } };
  return ctx;
})() : globalThis.SA_LIB;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const ok = (c, what) => { if (!c) throw new Error(what); };
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };

// ---------- base_rock-pitching.cs (class Trapezoid) ----------
function buildBase(){
  const s = Spec.newSpec("RockPitchingBaseWeb");
  // ตาราง Parameter (ปุ่ม Parameter บนหัว Properties): ชุดเดียวกับไฟล์จริง
  s.params.push({ name: "TopWidth", kind: "double", default: 2, displayName: "Top Width", min: null, max: null },
                { name: "SideSlope", kind: "double", default: 1.5, displayName: "Side Slope (1:x)", min: null, max: null },
                { name: "Depth", kind: "double", default: 2, displayName: "Depth", min: null, max: null });
  Spec.setParamBounds(s, "TopWidth", { positive: true });
  Spec.setParamBounds(s, "SideSlope", { positive: true });
  Spec.setParamBounds(s, "Depth", { min: 2 });
  // ชนิดค่า (รอบ 4e): SideSlope = Slope (1:x) · ความกว้าง / ความลึก = Length (m)
  Spec.setParamUnit(s, "SideSlope", "slope"); Spec.setParamUnit(s, "TopWidth", "length"); Spec.setParamUnit(s, "Depth", "length");
  // Point (พิมพ์ dx / dy เป็นนิพจน์) + Codes ใน Properties
  const P = id => Spec.byId(s.points, id);
  P("P1").codes = ["TrapTopInside"];
  const p2 = Spec.addPoint(s, { type: "delta", from: "P1", dx: "TopWidth", dy: "0" }, ["TrapTopOutside"]);
  const p3 = Spec.addPoint(s, { type: "delta", from: p2, dx: "Depth * SideSlope", dy: "-Depth" }, ["TrapBaseOutside"]);
  const p4 = Spec.addPoint(s, { type: "delta", from: "P1", dx: "-Depth * SideSlope", dy: "-Depth" }, ["TrapBaseInside"]);
  // Link + Codes
  const L = (a, b, codes, aux) => { const id = Spec.addLink(s, a, b, { points: [a, b], ...(aux ? { auxiliary: true } : {}) }); Spec.byId(s.links, id).codes = codes; return id; };
  const top = L("P1", p2, ["Top"]), sideOut = L(p2, p3, ["TrapSide"]), sideIn = L(p4, "P1", ["TrapSide"]);
  const base = L(p3, p4, [], true);                               // เส้นฐาน (Link โหมด Auxiliary) = เส้นอ้างอิงของขอบล่าง
  // Extend to Surface ที่มุมฐานทั้งสอง (ไม่ติ๊ก "ย้ายเส้นอื่นไปปลายจริง" — เส้นฐาน aux ต้องอยู่ที่มุมเดิม)
  const eo = Spec.addExtendToGround(s, sideOut, p3, { pointCodes: ["TrapToeOutside"], rewire: false });
  const ei = Spec.addExtendToGround(s, sideIn, p4, { pointCodes: ["TrapToeInside"], rewire: false });
  // Clipped Surface Link จากปลายจริงนอก → ปลายจริงใน ไม่สูงกว่าเส้นฐาน
  const bottom = Spec.addFollowClipped(s, eo.tip, ei.tip, { refLink: base, side: "below", codes: ["Datum"], codesGround: ["TrapOnSurface"], codesLine: ["TrapBase"] }).link;
  // Shape (คลิกจุดรอบรูป) + code
  const sh = Spec.addShape(s, [top, sideOut, eo.link, bottom, ei.link, sideIn]);
  Spec.byId(s.shapes, sh).codes = ["Trapezoid"];
  return s;
}

// ---------- body_rock-pitching.cs (class RockPitchingBody) ----------
function buildBody(){
  const s = Spec.newSpec("RockPitchingBodyWeb");
  s.params.push({ name: "Height", kind: "double", default: 5, displayName: "Height", min: null, max: null },
                { name: "FaceSlope", kind: "double", default: 2.5, displayName: "Face Slope (1:x)", min: null, max: null },
                { name: "RockThickness", kind: "double", default: 0.5, displayName: "Rock Thickness", min: null, max: null },
                { name: "MinSoilThickness", kind: "double", default: 1, displayName: "Min Soil Thickness", min: null, max: null },
                { name: "EndSlope", kind: "double", default: 1.5, displayName: "End Slope (1:x)", min: null, max: null });
  for (const n of ["Height", "FaceSlope", "RockThickness", "EndSlope"]) Spec.setParamBounds(s, n, { positive: true });
  Spec.setParamBounds(s, "MinSoilThickness", { min: 1 });
  // ชนิดค่า (รอบ 4e): FaceSlope / EndSlope = Slope (1:x) · ความสูง / ความหนา = Length (m)
  for (const n of ["FaceSlope", "EndSlope"]) Spec.setParamUnit(s, n, "slope");
  for (const n of ["Height", "RockThickness", "MinSoilThickness"]) Spec.setParamUnit(s, n, "length");
  const P = id => Spec.byId(s.points, id);
  const L = (a, b, codes, aux) => { const id = Spec.addLink(s, a, b, { points: [a, b], ...(aux ? { auxiliary: true } : {}) }); Spec.byId(s.links, id).codes = codes; return id; };
  P("P1").codes = ["RockTopInside"];
  const f = Spec.addPoint(s, { type: "delta", from: "P1", dx: "FaceSlope * Height", dy: "-Height" }, ["RockTopOutside"]);
  const face = L("P1", f, ["Top", "RockFace"]);
  // Offset (X = Auxiliary): ใต้ชั้นหิน / เส้นความหนาขั้นต่ำของดิน — ตั้งฉากกับผิวหิน
  const rockLn = Spec.addOffset(s, face, "RockThickness", -1, { aux: true }).link;
  const soilLn = Spec.addOffset(s, face, "RockThickness + MinSoilThickness", -1, { aux: true }).link;
  // เส้นช่วย (โหมด Auxiliary): เส้นปิดปลาย 1:EndSlope จาก F เข้าด้านใน · เส้นดิ่งที่ origin
  const endDir = Spec.addPoint(s, { type: "delta", from: f, dx: "-EndSlope", dy: "-1" }, [], true);
  const endLn = L(f, endDir, [], true);
  const down = Spec.addPoint(s, { type: "delta", from: "P1", dx: "0", dy: "-1" }, [], true);
  const vert = L("P1", down, [], true);
  // Intersect (N = ไม่ตัด): R, B0 (เส้นช่วยทั้งคู่ = ได้จุด Auxiliary → Properties เอา Auxiliary ออก + code) · O, เส้นดินที่ origin (Auxiliary)
  const r = Spec.addIntersect(s, rockLn, endLn, {}).point; delete P(r).auxiliary; P(r).codes = ["RockBaseOutside"];
  const b0 = Spec.addIntersect(s, rockLn, vert, {}).point; delete P(b0).auxiliary; P(b0).codes = ["RockBaseInside"];
  const o = Spec.addIntersect(s, soilLn, endLn, { aux: true }).point;
  const s0 = Spec.addIntersect(s, soilLn, vert, { aux: true }).point;
  // Extend to Surface ที่ O ตามเส้นปิดปลาย (เส้น F–O เป็นเส้นช่วย) → ปลายจริง: ใน Properties เอา Auxiliary ออก + code SoilToe
  //   "ไม่ชนดินใน" = O.x (ห้ามต่อเลย origin เข้าด้านใน — ไฟล์จริงเตือนกรณีนี้)
  const fo = L(f, o, [], true);
  const e = Spec.addExtendToGround(s, fo, o, { rewire: false, maxDistance: `${o}.x` });
  delete P(e.tip).auxiliary; P(e.tip).codes = ["SoilToe"];
  // จุดล่างสุดที่ origin = min(ผิวดิน, เส้นดิน) — รอบ 4e: ไม่พิมพ์นิพจน์ ใช้ Extend to Surface บนเส้นดิ่งแทน
  //   Link (Auxiliary) P1 → S0 แล้ว Extend to Surface ที่ S0: ดินต่ำกว่า S0 = ต่อลงถึงดิน · ไม่ต่ำกว่า = ใช้ S0
  //   → ปลายจริง: ใน Properties เอา Auxiliary ออก + code SoilBaseInside (แบบ SoilToe)
  const ps0 = L("P1", s0, [], true);
  const e0 = Spec.addExtendToGround(s, ps0, s0, { rewire: false });
  const l0 = e0.tip; delete P(l0).auxiliary; P(l0).codes = ["SoilBaseInside"];
  // ชั้นหิน
  const rockEnd = L(f, r, ["Top", "RockEnd"]), rockBase = L(r, b0, ["RockBase"]), rockBack = L(b0, "P1", ["RockBack"]);
  const rock = Spec.addShape(s, [face, rockEnd, rockBase, rockBack]); Spec.byId(s.shapes, rock).codes = ["RockPitching"];
  // Compacted Soil: R → ปลายจริง → ขอบล่าง (Clipped Surface Link ไม่สูงกว่าเส้นดิน) → L0 → B0
  const soilEnd = L(r, e.tip, ["Top", "Datum", "SoilEnd"]);
  const bottom = Spec.addFollowClipped(s, e.tip, l0, { refLink: soilLn, side: "below", codes: ["Datum"], codesGround: ["SoilOnSurface"], codesLine: ["SoilMinThickness"] }).link;
  const back = L(l0, b0, ["SoilBack"]);
  const soil = Spec.addShape(s, [rockBase, soilEnd, bottom, back]); Spec.byId(s.shapes, soil).codes = ["CompactedSoil"];
  return s;
}

const run = (s, surface, o = {}) => Spec.evaluate(s, { values: o.values || {}, codeParams: [], codePoints: [], surface, extendEnds: true, layout: !!o.layout });
const SURF = {
  high: [{ x: -40, y: -1 }, { x: 40, y: -1 }],
  low: [{ x: -40, y: -8 }, { x: 40, y: -8 }],
  rough: [{ x: -40, y: 0 }, { x: -2, y: -1.5 }, { x: 0, y: -2.6 }, { x: 2, y: -1 }, { x: 4.3, y: -2.4 }, { x: 8, y: -6 }, { x: 10, y: -4.5 }, { x: 14, y: -7 }, { x: 40, y: -9 }]
};
// sa-spec ในไฟล์ .cs (บรรทัด // sa-spec: {...} หรือ // sa-spec-b64: ...)
function fileSpec(f){
  const t = readText(f);
  if (t == null) return null;
  const m = /\/\/ sa-spec: (.*)/.exec(t);
  if (m) return JSON.parse(m[1]);
  const b = /\/\/ sa-spec-b64: (.*)/.exec(t);
  return b ? JSON.parse(decodeURIComponent(escape(atob(b[1].trim())))) : null;
}

for (const [name, build, file] of [["base", buildBase, "SA.Tests/fixtures/base_rock-pitching-web.cs"], ["body", buildBody, "SA.Tests/fixtures/body_rock-pitching-web.cs"]]){
  test(`${name}: คำนวณได้ไม่เตือน รูปปิดทุก shape — ดินสูง / ดินต่ำ / ขรุขระ / Layout · Right / Left`, () => {
    const s = build();
    for (const [k, sf] of Object.entries(SURF)) for (const values of [{}, { Side: 1 }]){
      const r = run(s, values.Side ? sf.map(p => ({ x: -p.x, y: p.y })) : sf, { values });
      ok(!r.issues.length, `${k} ${JSON.stringify(values)}: ${JSON.stringify(r.issues)}`);
      for (const sh of s.shapes) ok(r.shapes[sh.id].poly, `${k}: ${sh.id} ไม่ปิด`);
    }
    const r = run(s, SURF.low, { layout: true });
    ok(!r.issues.length && s.shapes.every(sh => r.shapes[sh.id].poly), "Layout");
  });
  test(`${name}: สร้างใหม่ด้วยเครื่องมือ = sa-spec ใน ${file} (ทำซ้ำได้)`, () => {
    const want = fileSpec(file);
    if (!want){ console.log(`        (ยังไม่มี ${file} — ข้าม)`); return; }
    eq(JSON.stringify(want), JSON.stringify(build()), "spec");
  });
}
if (typeof module !== "undefined") module.exports = { buildBase, buildBody };
if (typeof globalThis !== "undefined") globalThis.RP_BUILD = { buildBase, buildBody };

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (typeof process !== "undefined") process.exitCode = failed ? 1 : 0;
