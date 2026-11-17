// Dimensions and slope labels (round 10 M2): js/display.js (Display: values, auto parameter label, slope text, geometry, visibility)
// and the Logic API ops addDim / addSlopeLabel / updateAnnotation / removeAnnotation + cascades (removeObjects, removeParam, editParam rename, copyObjects).
// Run: node SA.Tests/js/display.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("style.js") + "\n" + js("display.js") + "\n" + js("ops.js") + "\n" + js("logicops.js")
  + "\nthis.Spec = Spec; this.Logic = Logic; this.Display = Display;", ctx);
// makeHistory only (the page part of history.js needs the DOM)
vm.runInContext(js("history.js").split("// ---------------- เอกสารของหน้าเว็บ")[0] + "\nthis.makeHistory = makeHistory;", ctx);
const { Spec, Logic, Display, makeHistory } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { const a = JSON.stringify(act), b = JSON.stringify(exp); if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const good = (r, what) => { if (!r || r.ok !== true) throw new Error(`${what}: ${r && r.error}`); return r; };
function bad(s, fn, re, what){
  const before = JSON.stringify(s);
  const r = fn();
  if (!r || r.ok !== false) throw new Error(`${what}: must fail, got ${JSON.stringify(r)}`);
  if (re && !re.test(r.error)) throw new Error(`${what}: message "${r.error}" does not match ${re}`);
  if (JSON.stringify(s) !== before) throw new Error(`${what}: spec changed after an error`);
}
const run = (s, values) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: null, extendEnds: true, layout: true });

// a small dam crest: P1 origin, P2 = P1 + (Wcrest, 0), P3 = P2 slope 1:2 down, length Hcrest measured dy, P4 = P1 + (Wcrest/2, 1)
function crest(){
  const s = Logic.newSubassembly("Crest10").result;
  good(Logic.addParam(s, { name: "Wcrest", default: 3 }), "Wcrest");
  good(Logic.addParam(s, { name: "Hcrest", default: 2 }), "Hcrest");
  eq("P2", good(Logic.addPoint(s, { type: "delta", from: "P1", dx: "Wcrest", dy: "0" }), "P2").result, "P2 id");
  eq("P3", good(Logic.addPoint(s, { type: "slopeLength", from: "P2", slope: "-1/2", length: "Hcrest", dir: 1, measure: "dy" }), "P3").result, "P3 id");
  eq("P4", good(Logic.addPoint(s, { type: "delta", from: "P1", dx: "Wcrest/2", dy: "1" }), "P4").result, "P4 id");
  good(Logic.addLink(s, "P1", "P2"), "L1"); good(Logic.addLink(s, "P2", "P3"), "L2");
  good(Logic.addLink(s, "P1", "P3", { type: "arc3", via: "P4" }), "L3");
  return s;
}

console.log("auto parameter label (decision 8)");
test("delta dx = parameter -> label; dy of the same delta for a vertical dimension (0) -> none", () => {
  const s = crest();
  eq("Wcrest", Display.autoLabel(s, { kind: "h", a: "P1", b: "P2" }), "h P1-P2");
  eq("Wcrest", Display.autoLabel(s, { kind: "h", a: "P2", b: "P1" }), "either order");
  eq("Wcrest", Display.autoLabel(s, { kind: "aligned", a: "P1", b: "P2" }), "aligned with dy 0");
  eq(null, Display.autoLabel(s, { kind: "v", a: "P1", b: "P2" }), "v of a 0 dy");
});
test("an expression (Wcrest/2) -> no label; slopeLength measured dy -> label for a vertical dimension only", () => {
  const s = crest();
  eq(null, Display.autoLabel(s, { kind: "h", a: "P1", b: "P4" }), "Wcrest/2");
  eq("Hcrest", Display.autoLabel(s, { kind: "v", a: "P2", b: "P3" }), "slopeLength dy");
  eq(null, Display.autoLabel(s, { kind: "h", a: "P2", b: "P3" }), "slopeLength dy is not the horizontal");
  eq(null, Display.autoLabel(s, { kind: "h", a: "P1", b: "P3" }), "not joined by one definition");
});
test("label: auto / a parameter name / null", () => {
  const s = crest();
  eq("Wcrest", Display.labelOf(s, { kind: "h", a: "P1", b: "P2", label: "auto" }), "auto");
  eq("Hcrest", Display.labelOf(s, { kind: "h", a: "P1", b: "P2", label: "Hcrest" }), "picked");
  eq(null, Display.labelOf(s, { kind: "h", a: "P1", b: "P2", label: null }), "none");
});

console.log("values follow parameters and scenarios");
test("dimension values change with a parameter and with a scenario; text shows (Wcrest), decimals 2 by default", () => {
  const s = crest();
  const id = good(Logic.addDim(s, { kind: "h", a: "P1", b: "P2", offset: 1 }), "addDim").result;
  eq("D1", id, "id");
  const d = s.display.dims[0];
  eq({ id: "D1", kind: "h", a: "P1", b: "P2", offset: 1, label: "auto", decimals: 2 }, d, "stored");
  eq("3.00 (Wcrest)", Display.dimText(s, run(s), d), "default");
  good(Logic.editParam(s, "Wcrest", { default: 4.25 }), "default 4.25");
  eq("4.25 (Wcrest)", Display.dimText(s, run(s), d), "parameter changed");
  // a scenario = a set of parameter values (js/scenarios.js passes them as values)
  eq("5.50 (Wcrest)", Display.dimText(s, run(s, { Wcrest: 5.5 }), d), "scenario");
  const v = { id: "D9", kind: "v", a: "P2", b: "P3", label: "auto", decimals: 3 };
  eq("2.000 (Hcrest)", Display.dimText(s, run(s, { Hcrest: 2 }), v), "vertical, 3 decimals");
  const al = { kind: "aligned", a: "P2", b: "P3", label: null, decimals: 2 };
  eq(Math.hypot(4, 2).toFixed(2), Display.dimText(s, run(s, { Hcrest: 2 }), al), "aligned = distance, no label");
});
test("Side Left: values unchanged, positions mirror (v / aligned offsets follow F), text angle upright", () => {
  const s = crest(), dv = { kind: "v", a: "P2", b: "P3", offset: 1 };
  const R = run(s, { Side: 0 }), L = run(s, { Side: 1 });
  eq(Display.dimValue(s, R, dv), Display.dimValue(s, L, dv), "same value");
  const gR = Display.dimGeom(dv, R.pts.P2, R.pts.P3, R.flip), gL = Display.dimGeom(dv, L.pts.P2, L.pts.P3, L.flip);
  eq(-gR.p1.x, gL.p1.x, "dimension line mirrored");
  eq(1, Display.offsetAt("v", L.pts.P2, L.pts.P3, L.flip, gL.p1), "offset read back on Left");
  const da = { kind: "aligned", a: "P2", b: "P3", offset: 0.5 };
  const aR = Display.dimGeom(da, R.pts.P2, R.pts.P3, R.flip), aL = Display.dimGeom(da, L.pts.P2, L.pts.P3, L.flip);
  ok(Math.abs(aR.p1.x + aL.p1.x) < 1e-9 && Math.abs(aR.p1.y - aL.p1.y) < 1e-9, "aligned mirrored");
  for (const a of [170, -170, 95, -95, 0, 90, 270]){ const u = Display.upright(a); ok(u >= -90 && u < 90, `${a} -> ${u}`); }
  eq(-90, Display.upright(90), "vertical reads from the right");
  eq(10, Display.upright(-170), "-170 -> 10");
});

console.log("slope text");
test("ratio 1:2.00, percent 5.0%, auto switches at 5 %", () => {
  eq("1:2.00", Display.slopeText({ dx: 4, dy: -2 }, "ratio"), "ratio");
  eq("50.0%", Display.slopeText({ dx: 4, dy: -2 }, "percent"), "percent");
  eq("1:2.00", Display.slopeText({ dx: 4, dy: 2 }, "auto"), "auto steep");
  eq("5.0%", Display.slopeText({ dx: 100, dy: 5 }, "auto"), "exactly 5 % = percent");
  eq("1:19.80", Display.slopeText({ dx: 99, dy: 5 }, "auto"), "steeper than 5 % = ratio");
  eq("2.0%", Display.slopeText({ dx: 10, dy: -0.2 }, "auto"), "flat");
  eq("0.0%", Display.slopeText({ dx: 10, dy: 0 }, "auto"), "level");
  eq("1:0.00", Display.slopeText({ dx: 0, dy: 3 }, "auto"), "vertical");
  eq("1:2.00", Display.slopeText({ path: [{ x: 0, y: 0 }, { x: 1, y: 0.2 }, { x: 4, y: 2 }] }, "auto"), "evaluated link (first -> last)");
});

console.log("Logic API");
test("addDim / addSlopeLabel / updateAnnotation / removeAnnotation", () => {
  const s = crest();
  eq("D1", good(Logic.addDim(s, { kind: "h", a: "P1", b: "P2", offset: 1 }), "D1").result, "D1");
  eq("D2", good(Logic.addDim(s, { kind: "aligned", a: "P2", b: "P3", offset: -0.5, label: null, decimals: 1 }), "D2").result, "D2");
  eq("G1", good(Logic.addSlopeLabel(s, { link: "L2" }), "G1").result, "G1");
  eq("auto", s.display.slopes[0].format, "format default");
  good(Logic.updateAnnotation(s, "D1", { offset: 2.5 }), "drag");
  eq(2.5, s.display.dims[0].offset, "offset");
  good(Logic.updateAnnotation(s, "D1", { label: "Hcrest", decimals: 3, kind: "v" }), "options");
  eq(["v", "Hcrest", 3], [s.display.dims[0].kind, s.display.dims[0].label, s.display.dims[0].decimals], "options stored");
  good(Logic.updateAnnotation(s, "G1", { format: "percent" }), "format");
  eq(["D1", "G1"], good(Logic.removeAnnotation(s, ["D1", "G1"]), "remove").result, "removed");
  eq(["D2"], s.display.dims.map(d => d.id), "D2 left");
  ok(!("slopes" in s.display), "empty list dropped");
  good(Logic.removeAnnotation(s, "D2"), "remove last");
  eq({ seq: { D: 2, G: 1 } }, s.display, "only the id counter stays once annotations were added");
  ok(!("display" in crest()), "a spec never annotated has no display");
});
test("ids are never reused: add D1, D2, remove D2, add -> D3; Undo-like restore brings the counter back", () => {
  const s = crest();
  good(Logic.addDim(s, { kind: "h", a: "P1", b: "P2" }), "D1");
  good(Logic.addDim(s, { kind: "v", a: "P2", b: "P3" }), "D2");
  const snap = JSON.stringify(s);
  good(Logic.removeAnnotation(s, "D2"), "remove D2");
  eq("D3", good(Logic.addDim(s, { kind: "h", a: "P1", b: "P3" }), "add").result, "next id");
  good(Logic.removeAnnotation(s, ["D1", "D3"]), "remove all");
  eq("D4", good(Logic.addDim(s, { kind: "h", a: "P1", b: "P2" }), "add after removing all").result, "still not reused");
  eq("G1", good(Logic.addSlopeLabel(s, { link: "L1" }), "G1").result, "own counter per kind");
  eq("D5", Display.nextId(s, "dim"), "pure nextId honours seq");
  const back = JSON.parse(snap);
  eq({ D: 2 }, back.display.seq, "the counter is part of the spec (Undo snapshot)");
});
test("validation errors (English) leave the spec unchanged", () => {
  const s = crest();
  good(Logic.addDim(s, { kind: "h", a: "P1", b: "P2", offset: 1 }), "D1");
  good(Logic.addSlopeLabel(s, { link: "L1" }), "G1");
  bad(s, () => Logic.addDim(s, { kind: "x", a: "P1", b: "P2" }), /kind must be h, v or aligned/, "kind");
  bad(s, () => Logic.addDim(s, { kind: "h", a: "P1", b: "P99" }), /P99.*not a point/, "missing point");
  bad(s, () => Logic.addDim(s, { kind: "h", a: "P2", b: "P2" }), /two different points/, "same point");
  bad(s, () => Logic.addDim(s, { kind: "h", a: "P1", b: "P2", offset: "far" }), /offset must be a number/, "offset");
  bad(s, () => Logic.addDim(s, { kind: "h", a: "P1", b: "P2", label: "Nope" }), /no parameter "Nope"/, "label");
  bad(s, () => Logic.addDim(s, { kind: "h", a: "P1", b: "P2", decimals: 9 }), /decimals/, "decimals");
  bad(s, () => Logic.addSlopeLabel(s, { link: "L3" }), /not a straight link/, "arc link");
  bad(s, () => Logic.addSlopeLabel(s, { link: "L9" }), /not a link/, "missing link");
  bad(s, () => Logic.addSlopeLabel(s, { link: "L1", format: "deg" }), /format must be/, "format");
  bad(s, () => Logic.updateAnnotation(s, "D7", { offset: 1 }), /No annotation D7/, "missing id");
  bad(s, () => Logic.updateAnnotation(s, "G1", { offset: 1 }), /slope label: field offset/, "field of another kind");
  bad(s, () => Logic.updateAnnotation(s, "D1", { b: "P1" }), /two different points/, "update checks the result");
  bad(s, () => Logic.removeAnnotation(s, ["D1", "D5"]), /No annotation D5/, "remove all or nothing");
});
test("catalog lists the ops (MCP sees them)", () => {
  const fns = Logic.catalog().functions.map(f => f.fn);
  for (const f of ["addDim", "addSlopeLabel", "updateAnnotation", "removeAnnotation"]) ok(fns.includes(f), f);
  const r = good(Logic.applyBatch(crest(), [{ fn: "addDim", args: [{ kind: "h", a: "P1", b: "P2", offset: 1 }], as: "d" }, { fn: "updateAnnotation", args: ["${d.result}", { decimals: 1 }] }]), "batch");
  ok(r, "batch ok");
});

console.log("cascades (design section 3)");
test("removeObjects deletes bound annotations (warning); Undo restores both", () => {
  const s = crest();
  good(Logic.addDim(s, { kind: "h", a: "P1", b: "P2", offset: 1 }), "D1");
  good(Logic.addDim(s, { kind: "h", a: "P1", b: "P4", offset: 2 }), "D2");
  good(Logic.addSlopeLabel(s, { link: "L2" }), "G1");
  // the page: History snapshots the item specs (history.js); one act + track = one Undo step (specEdit)
  const doc = { spec: s };
  const h = makeHistory(() => { const f = JSON.stringify(doc.spec); return { full: f, key: f }; }, full => { doc.spec = JSON.parse(full); }, 50);
  h.reset();
  h.act("ลบ P2");
  const r = good(Logic.removeObjects(doc.spec, ["P2"]), "remove P2");
  h.track();
  ok(r.warnings.some(w => /Annotations removed with them: D1, G1/.test(w)), "warning: " + JSON.stringify(r.warnings));
  eq(["D2"], doc.spec.display.dims.map(d => d.id), "D2 stays (P1, P4)");
  ok(!doc.spec.display.slopes, "G1 gone with L2");
  eq("ลบ P2", h.step(false), "undo");
  ok(doc.spec.points.some(p => p.id === "P2"), "P2 back");
  eq(["D1", "D2"], doc.spec.display.dims.map(d => d.id), "D1 back");
  eq(["G1"], doc.spec.display.slopes.map(g => g.id), "G1 back");
});
test("removeParam: a dimension naming it goes back to auto; rename follows; copyObjects does not copy annotations", () => {
  const s = crest();
  good(Logic.addParam(s, { name: "Spare", default: 1 }), "Spare");
  good(Logic.addDim(s, { kind: "h", a: "P1", b: "P2", offset: 1, label: "Spare" }), "D1");
  good(Logic.addDim(s, { kind: "h", a: "P1", b: "P4", offset: 1, label: "Wcrest" }), "D2");
  good(Logic.removeParam(s, "Spare"), "removeParam (a label is not a use)");
  eq("auto", s.display.dims[0].label, "back to auto");
  good(Logic.editParam(s, "Wcrest", { name: "Bcrest" }), "rename");
  eq("Bcrest", s.display.dims[1].label, "label follows rename");
  eq("3.00 (Bcrest)", Display.dimText(s, run(s), s.display.dims[0]), "auto label after rename");
  const before = JSON.stringify(s.display);
  good(Logic.copyObjects(s, ["P2"], { dx: 5, dy: 0, convert: true }), "copy");
  eq(before, JSON.stringify(s.display), "annotations not copied");
});

test("removeDecision / removeCase / removeCondition with how: remove list the annotations they take (same wording)", () => {
  const s = crest();
  const c = good(Logic.addCondition(s, { expr: "Wcrest > 2" }), "cond");
  const d = s.logic.decisions[0], yes = s.logic.branches.find(b => b.decision === d.id && b.case !== "else" && b.case !== false) || s.logic.branches[0];
  good(Logic.setBranch(s, ["P3"], yes.id), "P3 into a branch");
  good(Logic.addDim(s, { kind: "v", a: "P2", b: "P3" }), "D1");
  const s2 = JSON.parse(JSON.stringify(s));
  const r = good(Logic.removeDecision(s, d.id, { how: "remove" }), "removeDecision");
  ok((r.warnings || []).some(w => /Annotations removed with them: D1/.test(w)), "removeDecision warning: " + JSON.stringify(r.warnings));
  const r2 = good(Logic.removeCondition(s2, c.result || s2.logic.conditions[0].name, { how: "remove" }), "removeCondition");
  ok((r2.warnings || []).some(w => /Annotations removed with them: D1/.test(w)), "removeCondition warning: " + JSON.stringify(r2.warnings));
  // removeCase on a switch
  const s3 = crest();
  good(Logic.addDecision(s3, { kind: "switch", test: "Wcrest", cases: [{ value: 3 }, { value: 4 }] }), "switch");
  const cb = s3.logic.branches.find(b => b.case !== "else");
  good(Logic.setBranch(s3, ["P3"], cb.id), "P3 into case");
  good(Logic.addSlopeLabel(s3, { link: "L1" }), "G1 stays");
  good(Logic.addDim(s3, { kind: "v", a: "P2", b: "P3" }), "D1");
  const r3 = good(Logic.removeCase(s3, cb.id, { how: "remove" }), "removeCase");
  eq(["Annotations removed with them: D1"], r3.warnings, "removeCase warning");
  eq(["G1"], Display.all(s3).map(x => x.ann.id), "G1 stays (L1 untouched)");
  ok(!("warnings" in good(Logic.removeCase(s3, s3.logic.branches.find(b => b.case !== "else").id, { how: "remove" }), "no annotations lost")), "no warning when nothing is lost");
});

console.log("visibility");
test("hidden in Civil 3D preview and with View › Show › Annotations off; hidden when a point / link does not occur", () => {
  const s = crest();
  good(Logic.addDim(s, { kind: "h", a: "P1", b: "P2", offset: 1 }), "D1");
  good(Logic.addSlopeLabel(s, { link: "L2" }), "G1");
  const r = run(s), d = s.display.dims[0], g = s.display.slopes[0];
  eq(true, Display.visible(s, r, "dim", d, { annot: true, c3d: false }), "design");
  eq(true, Display.visible(s, r, "slope", g, {}), "slope design");
  eq(false, Display.visible(s, r, "dim", d, { annot: true, c3d: true }), "c3d");
  eq(false, Display.visible(s, r, "slope", g, { c3d: true }), "slope c3d");
  eq(false, Display.visible(s, r, "dim", d, { annot: false }), "Show off");
  const off = { ...r, pts: { ...r.pts, P2: { err: "branch", off: "B2" } }, links: { ...r.links, L2: { err: "branch", off: "B2" } } };
  eq(false, Display.visible(s, off, "dim", d, {}), "point not occurring");
  eq(false, Display.visible(s, off, "slope", g, {}), "link not occurring");
  eq(null, Display.dimValue(s, off, d), "no value");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);   // summary line read by test-all.js
process.exitCode = failed ? 1 : 0;
