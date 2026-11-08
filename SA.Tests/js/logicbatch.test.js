// Round 6 M1: drawing functions of the Logic API + applyBatch + catalog.
// Run: node SA.Tests/js/logicbatch.test.js
"use strict";
const fs = require("fs"), path = require("path");
const gen = require("../gen-logic-doc.js");
const { Expr, Spec, Logic, Ops } = gen.loadLogic();
const { buildBase, buildBody } = require("./rockpitching.test.js");

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { const a = JSON.stringify(act), b = JSON.stringify(exp); if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const good = r => { if (!r || r.ok !== true) throw new Error(r && r.error); return r; };
function bad(s, fn, re, what){
  const before = JSON.stringify(s), r = fn();
  if (!r || r.ok !== false) throw new Error(`${what}: expected an error, got ${JSON.stringify(r)}`);
  if (re && !re.test(r.error)) throw new Error(`${what}: "${r.error}" does not match ${re}`);
  if (JSON.stringify(s) !== before) throw new Error(`${what}: spec changed after the error`);
}
const fresh = () => good(Logic.newSubassembly("T")).result;
const run = (s, y, o) => Spec.evaluate(s, { values: (o && o.values) || {}, codeParams: [], codePoints: [], surface: y == null ? null : [{ x: -60, y }, { x: 60, y }], extendEnds: true, layout: y == null });

console.log("Logic API: drawing + applyBatch + catalog (round 6 M1)");

test("newSubassembly: valid spec, bad class name, targets, Side parameter name", () => {
  const s = good(Logic.newSubassembly("Levee", { targets: ["EG", { name: "Rock", displayName: "Rock top" }] })).result;
  eq(["EG", "Rock"], s.targets.map(t => t.name), "targets"); eq("Rock top", s.targets[1].displayName, "displayName"); eq("P1", s.points[0].id, "origin");
  ok(/not valid/.test(Logic.newSubassembly("1 bad").error), "bad name");
  eq("Dir", good(Logic.newSubassembly("X", { sideParam: "Dir" })).result.side.param, "sideParam");
});

test("addParam / editParam / removeParam: units, bounds, rename follows expressions, refused when used", () => {
  const s = fresh();
  good(Logic.addParam(s, { name: "W", default: 2, unit: "length", min: 1 }));
  good(Logic.addParam(s, { name: "SS", default: 1.5, unit: "slope" }));
  const W = s.params.find(p => p.name === "W"); eq([1, "length"], [W.min, W.unit], "bounds + unit");
  ok(s.params.find(p => p.name === "SS").positive, "slope is positive");
  bad(s, () => Logic.addParam(s, { name: "W", default: 1 }), /อยู่แล้ว/, "duplicate");
  bad(s, () => Logic.addParam(s, { name: "Q" }), /numeric default/, "no default");
  bad(s, () => Logic.addParam(s, { name: "F", default: 1 }), /F/, "reserved");
  const p = good(Logic.addPoint(s, { type: "delta", from: "P1", dx: "W * 2", dy: "0" })).result;
  bad(s, () => Logic.removeParam(s, "W"), new RegExp(p), "in use");
  good(Logic.editParam(s, "W", { name: "Width", default: 3 }));
  eq("Width * 2", Spec.byId(s.points, p).def.dx, "rename follows"); eq(3, s.params.find(x => x.name === "Width").default, "default");
  good(Logic.removeParam(s, "SS")); ok(!s.params.some(x => x.name === "SS"), "removed");
  bad(s, () => Logic.removeParam(s, "Side"), /Side/, "Side");
});

test("addPoint: every point type computes · missing field / point / bad expression leave the spec unchanged", () => {
  const s = fresh();
  const add = (d, c, o) => good(Logic.addPoint(s, d, c, o)).result;
  const a = add({ type: "delta", from: "P1", dx: "2", dy: "0" }, ["A"]);
  const b = add({ type: "polar", from: a, length: "1", angle: "90" });
  const c = add({ type: "slopeLength", from: a, slope: "-0.5", length: "2", dir: 1, measure: "dx" });
  const d = add({ type: "slopeToSurface", from: c, slope: "-0.5", dir: 1, target: "TargetSurface", maxDistance: "50", layoutLength: "3" });
  const e = add({ type: "onSurface", from: a, dx: "1", target: "TargetSurface" });
  const f = add({ type: "between", a, b: c, t: "0.5" });
  const g = add({ type: "intersect", a1: "P1", a2: a, b1: b, b2: c });
  const h = add({ type: "firstOf", points: [c, a] }, [], { aux: true });
  const r = run(s, -5);
  for (const id of [a, b, c, d, e, f, g, h]) ok(r.pts[id] && !r.pts[id].err, `${id}: ${JSON.stringify(r.pts[id])}`);
  eq(4, r.pts[c].x, "slopeLength dx"); ok(Spec.isAux(Spec.byId(s.points, h)), "aux");
  bad(s, () => Logic.addPoint(s, { type: "nope" }), /Unknown point type/, "type");
  bad(s, () => Logic.addPoint(s, { type: "between", a }), /needs "b"/, "field");
  bad(s, () => Logic.addPoint(s, { type: "delta", from: "P99", dx: "1", dy: "0" }), /P99/, "point");
  bad(s, () => Logic.addPoint(s, { type: "delta", dx: "Nope", dy: "0" }), /Nope/, "expression");
});

test("editPoint / setCodes / editLink: merge fields, circular reference refused", () => {
  const s = fresh();
  const a = good(Logic.addPoint(s, { type: "delta", from: "P1", dx: "1", dy: "0" })).result, b = good(Logic.addPoint(s, { type: "delta", from: a, dx: "1", dy: "0" })).result;
  good(Logic.editPoint(s, b, { dy: "2" })); eq("2", Spec.byId(s.points, b).def.dy, "merge"); eq(a, Spec.byId(s.points, b).def.from, "keeps from");
  bad(s, () => Logic.editPoint(s, a, { from: b }), /circular/, "cycle");
  bad(s, () => Logic.editPoint(s, "P1", { dx: "1" }), /cannot be edited/, "origin");
  const l = good(Logic.addLink(s, a, b, { codes: ["X"] })).result;
  good(Logic.setCodes(s, [a, l], ["Datum", "Top"])); eq(["Datum", "Top"], Spec.byId(s.links, l).codes, "link codes"); eq(["Datum", "Top"], Spec.byId(s.points, a).codes, "point codes");
  bad(s, () => Logic.setCodes(s, ["L9"], ["A"]), /L9/, "missing");
  good(Logic.editLink(s, l, { optional: true })); ok(Spec.byId(s.links, l).optional, "optional");
  bad(s, () => Logic.editLink(s, l, { points: [] }), /cannot be edited/, "field");
});

test("addLink types · real link on an auxiliary point refused · addShape · addPolygon · addRegularPolygon", () => {
  const s = fresh();
  const P = (dx, dy, o) => good(Logic.addPoint(s, { type: "delta", from: "P1", dx: String(dx), dy: String(dy) }, [], o)).result;
  const a = P(2, 0), b = P(2, -2), c = P(0, -2), x = P(1, 1, { aux: true });
  bad(s, () => Logic.addLink(s, a, a), /different/, "same point");
  bad(s, () => Logic.addLink(s, a, x), /auxiliary/, "aux end");
  good(Logic.addLink(s, a, x, { aux: true }));
  const fs_ = good(Logic.addLink(s, "P1", a, { type: "followSurface", codes: ["Datum"] })).result; eq("followSurface", Spec.byId(s.links, fs_).type, "follow");
  const arc = good(Logic.addLink(s, a, b, { type: "arc3", via: x })).result; eq(x, Spec.byId(s.links, arc).via, "arc3");
  const arcR = good(Logic.addLink(s, b, c, { type: "arcR", radius: "2", sweep: "cw" })).result; eq("cw", Spec.byId(s.links, arcR).sweep, "arcR");
  bad(s, () => Logic.addLink(s, a, b, { type: "wavy" }), /Unknown link type/, "type");
  const t = fresh(), Q = (dx, dy) => good(Logic.addPoint(t, { type: "delta", from: "P1", dx: String(dx), dy: String(dy) })).result;
  const p = [Q(2, 0), Q(2, -2), Q(0, -2)], g = good(Logic.addPolygon(t, ["P1", ...p], { codes: ["Box"], linkCodes: ["Edge"] }));
  eq(4, g.links.length, "links"); eq(["Box"], Spec.byId(t.shapes, g.shape).codes, "shape codes"); ok(run(t, -9).shapes[g.shape].poly, "closed");
  bad(t, () => Logic.addShape(t, g.links.slice(0, 2)), /at least 3/, "few links");
  const r = good(Logic.addRegularPolygon(t, { center: p[0], n: 5, radius: "1" })); eq(5, r.points.length, "vertices");
  bad(t, () => Logic.addRegularPolygon(t, { center: p[0], n: 2, radius: "1" }), /3 to 24/, "n");
});

test("setAuxiliary needs cascade for side effects · removeObjects reports what depended on it", () => {
  const s = fresh();
  const a = good(Logic.addPoint(s, { type: "delta", from: "P1", dx: "1", dy: "0" })).result, b = good(Logic.addPoint(s, { type: "delta", from: a, dx: "1", dy: "0" })).result;
  const l = good(Logic.addLink(s, a, b)).result;
  bad(s, () => Logic.setAuxiliary(s, [a], true), /cascade/, "side effect");
  good(Logic.setAuxiliary(s, [a], true, { cascade: true })); ok(Spec.isAux(Spec.byId(s.links, l)), "link followed");
  bad(s, () => Logic.setAuxiliary(s, [l], false), /cascade/, "aux end");
  bad(s, () => Logic.removeObjects(s, ["P1"]), /origin/, "origin");
  const r = good(Logic.removeObjects(s, [a])); ok(r.result.includes(b) && r.result.includes(l) && /depended/.test(r.warnings[0]), JSON.stringify(r));
});

test("moveObjects keeps expressions · copyObjects gives new ids · addRotateGroup · addFillet", () => {
  const s = fresh();
  good(Logic.addParam(s, { name: "W", default: 2 }));
  const a = good(Logic.addPoint(s, { type: "delta", from: "P1", dx: "W", dy: "0" })).result, b = good(Logic.addPoint(s, { type: "delta", from: a, dx: "0", dy: "-1" })).result;
  good(Logic.moveObjects(s, [a], { dx: 1, dy: 0 })); eq("W + 1", Spec.byId(s.points, a).def.dx, "appended");
  const c = good(Logic.copyObjects(s, [b], { dx: 5, dy: 0 })); ok(c.result[0] !== b && s.points.length === 4, "new point");
  eq(run(s, null).pts[b].x + 5, run(s, null).pts[c.result[0]].x, "copy moved");
  const g = good(Logic.addRotateGroup(s, [b], a, "90")); ok(/^R\d+$/.test(g.result), "group");
  const t = fresh();
  const p = good(Logic.addPoint(t, { type: "delta", from: "P1", dx: "5", dy: "0" })).result, q = good(Logic.addPoint(t, { type: "delta", from: p, dx: "0", dy: "-5" })).result;
  good(Logic.addFillet(t, good(Logic.addLink(t, "P1", p)).result, good(Logic.addLink(t, p, q)).result, "1"));
  ok(t.links.some(l => l.type === "fillet"), "fillet");
});

test("applyBatch: references between ops, inside expressions, typed values", () => {
  const s = fresh();
  const r = good(Logic.applyBatch(s, [
    { fn: "addParam", args: [{ name: "H", default: 3 }] },
    { as: "a", fn: "addPoint", args: [{ type: "delta", from: "P1", dx: "H", dy: "0" }, ["A"]] },
    { as: "b", fn: "addPoint", args: [{ type: "delta", from: "${a.result}", dx: "0", dy: "${a.result}.x - H - 1" }] },
    { as: "c", fn: "addPolygon", args: [["P1", "${a.result}", "${b.result}"], { codes: ["Tri"] }] },
    { fn: "setCodes", args: ["${c.links}", ["Edge"]] }
  ]));
  eq(5, r.results.length, "results"); eq("P2", r.results[1].result, "id");
  const b = s.points[2]; eq("P2.x - H - 1", b.def.dy, "in expression"); eq("P2", b.def.from, "as value");
  ok(s.links.every(l => l.codes[0] === "Edge"), "typed list");
  eq(-1, run(s, null).pts[b.id].y, "computes");
});

test("applyBatch: all or nothing · which op failed · unknown fn / reference · no eval", () => {
  const s = fresh(), before = JSON.stringify(s);
  const r = Logic.applyBatch(s, [{ fn: "addParam", args: [{ name: "H", default: 3 }] }, { as: "a", fn: "addPoint", args: [{ type: "delta", dx: "H", dy: "0" }] }, { fn: "addLink", args: ["${a.result}", "P77"] }]);
  ok(r.ok === false && r.failedOp === 2 && /op 2 \(addLink\).*P77/.test(r.error), JSON.stringify(r)); eq(before, JSON.stringify(s), "spec unchanged");
  for (const [ops, re] of [[[{ fn: "constructor", args: [] }], /Unknown function/], [[{ fn: "applyBatch", args: [[]] }], /Unknown function/], [[{ fn: "describe", args: [] }], /Unknown function/],
                           [[{ fn: "addLink", args: ["${x.result}", "P1"] }], /Unknown reference/], [[{ as: "1a", fn: "removeArray", args: ["A1"] }], /Bad "as"/],
                           [[{ as: "a", fn: "addParam", args: [{ name: "A1x", default: 1 }] }, { as: "a", fn: "addParam", args: [{ name: "A2x", default: 1 }] }], /already used/]])
    bad(s, () => Logic.applyBatch(s, ops), re, JSON.stringify(ops));
  bad(s, () => Logic.applyBatch(s, "x"), /list/, "not a list");
  good(Logic.applyBatch(s, []));
});

test("base rock-pitching redrawn with applyBatch only = buildBase()", () => {
  const s = good(Logic.newSubassembly("RockPitchingBaseWeb")).result;
  good(Logic.applyBatch(s, [
    { fn: "addParam", args: [{ name: "TopWidth", default: 2, displayName: "Top Width", positive: true, unit: "length" }] },
    { fn: "addParam", args: [{ name: "SideSlope", default: 1.5, displayName: "Side Slope (1:x)", positive: true, unit: "slope" }] },
    { fn: "addParam", args: [{ name: "Depth", default: 2, min: 2, unit: "length" }] },
    { fn: "setCodes", args: [["P1"], ["TrapTopInside"]] },
    { as: "p2", fn: "addPoint", args: [{ type: "delta", from: "P1", dx: "TopWidth", dy: "0" }, ["TrapTopOutside"]] },
    { as: "p3", fn: "addPoint", args: [{ type: "delta", from: "${p2.result}", dx: "Depth * SideSlope", dy: "-Depth" }, ["TrapBaseOutside"]] },
    { as: "p4", fn: "addPoint", args: [{ type: "delta", from: "P1", dx: "-Depth * SideSlope", dy: "-Depth" }, ["TrapBaseInside"]] },
    { as: "top", fn: "addLink", args: ["P1", "${p2.result}", { codes: ["Top"] }] },
    { as: "out", fn: "addLink", args: ["${p2.result}", "${p3.result}", { codes: ["TrapSide"] }] },
    { as: "in", fn: "addLink", args: ["${p4.result}", "P1", { codes: ["TrapSide"] }] },
    { as: "base", fn: "addLink", args: ["${p3.result}", "${p4.result}", { aux: true }] },
    { as: "eo", fn: "addExtendToGround", args: ["${out.result}", "${p3.result}", { pointCodes: ["TrapToeOutside"], rewire: false }] },
    { as: "ei", fn: "addExtendToGround", args: ["${in.result}", "${p4.result}", { pointCodes: ["TrapToeInside"], rewire: false }] },
    { as: "bot", fn: "addFollowClipped", args: ["${eo.tip}", "${ei.tip}", { refLink: "${base.result}", side: "below", codes: ["Datum"], codesGround: ["TrapOnSurface"], codesLine: ["TrapBase"] }] },
    { fn: "addShape", args: [["${top.result}", "${out.result}", "${eo.link}", "${bot.link}", "${ei.link}", "${in.result}"], ["Trapezoid"]] }
  ]));
  const want = buildBase();
  const shape = r => JSON.stringify({ p: r.pts, l: r.links, s: r.shapes, i: r.issues });
  for (const y of [null, 2, -1, -3, -9]) for (const Side of [0, 1]) eq(shape(run(want, y, { values: { Side } })), shape(run(s, y, { values: { Side } })), `ground ${y} Side ${Side}`);
  eq(JSON.parse(JSON.stringify(want)), JSON.parse(JSON.stringify(s)), "same spec");
});

test("catalog matches the real functions · docs/logic-api.md is generated from it", () => {
  const skip = new Set(["RESERVED", "VAR_ERRORS", "META"]);
  const real = Object.keys(Logic).filter(k => !skip.has(k)).sort(), meta = Logic.META.map(m => m.fn).sort();
  eq(real, meta, "META = exported functions");
  eq(meta.length, new Set(meta).size, "no duplicates");
  const c = Logic.catalog();
  ok(c.functions.length > 40 && c.functions.every(f => typeof Logic[f.fn] === "function" && f.does), "catalog functions");
  ok(c.pointTypes.delta && c.units.includes("slope") && c.rules.length, "catalog extras");
  ok(!c.functions.some(f => f.fn === "applyBatch"), "applyBatch is not a batch op");
  const text = fs.readFileSync(gen.docFile, "utf8");
  if (text !== gen.expected(text, Logic.META)) throw new Error("docs/logic-api.md is out of date: run node SA.Tests/gen-logic-doc.js");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
