// Round 10 M3: notes ({expression} text, leader, Side Left, branches), cross-item (project-level) dimensions, point-name / Civil 3D
// show flags, the Array rebuild cascade and the rotate-group rule of the auto parameter label.
//   js/display.js (Display), js/logicops.js (addNote, addDim on a project doc …), js/spec.js (pruneDisplay, renameInNotes),
//   ProjectV3.content (js/project.js, pure part), makeHistory (js/history.js, pure part).
// Run: node SA.Tests/js/notes.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("style.js") + "\n" + js("display.js") + "\n" + js("ops.js") + "\n" + js("logicops.js")
  + "\nthis.Spec = Spec; this.Logic = Logic; this.Display = Display; this.Ops = Ops;", ctx);
vm.runInContext(js("history.js").split("// ---------------- เอกสารของหน้าเว็บ")[0] + "\nthis.makeHistory = makeHistory;", ctx);
vm.runInContext(js("project.js").split("// ---------------- page")[0] + "\nthis.ProjectV3 = ProjectV3;", ctx);
const { Spec, Logic, Display, Ops, makeHistory, ProjectV3 } = ctx;

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
const run = (s, values, o) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: null, extendEnds: true, layout: true, ...(o || {}) });

// crest: P1 origin, P2 = P1 + (Wcrest, 0), P3 = P2 + (1, -Hcrest), L1 P1-P2, L2 P2-P3
function crest(){
  const s = Logic.newSubassembly("Crest10").result;
  good(Logic.addParam(s, { name: "Wcrest", default: 3 }), "Wcrest");
  good(Logic.addParam(s, { name: "Hcrest", default: 2.5 }), "Hcrest");
  good(Logic.addPoint(s, { type: "delta", from: "P1", dx: "Wcrest", dy: "0" }), "P2");
  good(Logic.addPoint(s, { type: "delta", from: "P2", dx: "1", dy: "-Hcrest" }), "P3");
  good(Logic.addLink(s, "P1", "P2"), "L1"); good(Logic.addLink(s, "P2", "P3"), "L2");
  return s;
}

console.log("notes");
test("addNote: ids N1, N2 (never reused); leader true = the anchor point, a point id, or none; validation errors leave the spec unchanged", () => {
  const s = crest();
  eq("N1", good(Logic.addNote(s, { text: "สันเขื่อน", at: { point: "P2", dx: 0.5, dy: 0.8 } }), "N1").result, "id");
  eq(null, s.display.notes[0].leader, "no leader by default");
  eq("N2", good(Logic.addNote(s, { text: "ตีน", at: { point: "P3" }, leader: true }), "N2").result, "id 2");
  eq({ point: "P3", dx: 0, dy: 0 }, s.display.notes[1].at, "dx / dy default 0");
  eq("P3", s.display.notes[1].leader, "leader true = anchor");
  good(Logic.removeAnnotation(s, ["N2"]), "remove N2");
  eq("N3", good(Logic.addNote(s, { text: "x", at: { point: "P1" }, leader: "P2" }), "N3").result, "N2 not reused");
  eq("P2", s.display.notes[1].leader, "leader to another point");
  bad(s, () => Logic.addNote(s, { text: "  ", at: { point: "P1" } }), /non-empty/, "empty text");
  bad(s, () => Logic.addNote(s, { text: "a", at: { point: "P9" } }), /P9/, "missing point");
  bad(s, () => Logic.addNote(s, { text: "a" }), /at must be/, "no at");
  bad(s, () => Logic.addNote(s, { text: "a", at: { point: "P1", dx: "x" } }), /at\.dx/, "bad dx");
  bad(s, () => Logic.addNote(s, { text: "a", at: { point: "P1" }, leader: "P9" }), /leader/, "bad leader");
  ok(JSON.stringify(Logic.catalog()).includes("addNote"), "in the catalog");
});
test("{expression} in note text: same Expr as number fields ({Hcrest}, {Wcrest*2}); unknown / bad -> {?}; values follow parameters", () => {
  const s = crest();
  good(Logic.addNote(s, { text: "ระดับ +{Hcrest} กว้าง {Wcrest*2} m", at: { point: "P2" } }), "N1");
  const n = s.display.notes[0];
  eq("ระดับ +2.5 กว้าง 6 m", Display.noteText(s, run(s), n), "default values");
  eq("ระดับ +4 กว้าง 7 m", Display.noteText(s, run(s, { Hcrest: 4, Wcrest: 3.5 }), n), "values follow");
  eq("a {?} b {?} c {?}", Display.noteText(s, run(s), { text: "a {Nope} b {Hcrest*} c {}" }), "unknown / bad / empty");
  eq("x = 3", Display.noteText(s, run(s), { text: "x = {P2.x}" }), "point coordinates work (P2.x)");
  eq("1.235", Display.noteText(s, run(s), { text: "{1.23456}" }), "3 decimals");
  eq("no braces", Display.noteText(s, run(s), { text: "no braces" }), "plain text");
});
test("parameter rename renames inside {…} only; removeParam leaves the note (it shows {?}); variable rename too", () => {
  const s = crest();
  good(Logic.addNote(s, { text: "Hcrest = {Hcrest} ({Hcrest/2})", at: { point: "P2" } }), "N1");
  good(Logic.editParam(s, "Hcrest", { name: "Hc" }), "rename");
  eq("Hcrest = {Hc} ({Hc/2})", s.display.notes[0].text, "renamed inside braces only");
  good(Logic.addParam(s, { name: "Spare", default: 1 }), "Spare");
  good(Logic.updateAnnotation(s, "N1", { text: "s {Spare}" }), "text");
  good(Logic.removeParam(s, "Spare"), "removeParam is not blocked by a note");
  eq("s {Spare}", s.display.notes[0].text, "text kept");
  eq("s {?}", Display.noteText(s, run(s), s.display.notes[0]), "shows {?}");
});
test("updateAnnotation on a note: { at: { dx, dy } } = drag (point kept), leader on / off / another point, text; bad values refused", () => {
  const s = crest();
  good(Logic.addNote(s, { text: "a", at: { point: "P2", dx: 1, dy: 1 } }), "N1");
  good(Logic.updateAnnotation(s, "N1", { at: { dx: -2, dy: 0.5 } }), "drag");
  eq({ point: "P2", dx: -2, dy: 0.5 }, s.display.notes[0].at, "point kept");
  good(Logic.updateAnnotation(s, "N1", { leader: true }), "leader on"); eq("P2", s.display.notes[0].leader, "to anchor");
  good(Logic.updateAnnotation(s, "N1", { leader: "P3" }), "leader P3"); eq("P3", s.display.notes[0].leader, "to P3");
  good(Logic.updateAnnotation(s, "N1", { leader: null }), "leader off"); eq(null, s.display.notes[0].leader, "off");
  bad(s, () => Logic.updateAnnotation(s, "N1", { at: { dx: "x" } }), /dx/, "bad dx");
  bad(s, () => Logic.updateAnnotation(s, "N1", { offset: 1 }), /not one of text, at, leader/, "dimension field");
});
test("removeObjects: the anchor point removes the note (warning); a removed leader point only turns the leader off", () => {
  const s = crest();
  good(Logic.addNote(s, { text: "a", at: { point: "P3" } }), "N1");
  good(Logic.addNote(s, { text: "b", at: { point: "P2" }, leader: "P3" }), "N2");
  const r = good(Logic.removeObjects(s, ["P3"]), "remove P3");
  ok((r.warnings || []).some(w => /Annotations removed with them: N1/.test(w)), "warning " + JSON.stringify(r.warnings));
  eq(["N2"], s.display.notes.map(n => n.id), "N2 kept");
  eq(null, s.display.notes[0].leader, "leader off");
});
test("Side Left: the note position mirrors (dx), text anchor flips so it grows away from the point; the text is never mirrored", () => {
  const s = crest();
  good(Logic.addNote(s, { text: "{Wcrest}", at: { point: "P2", dx: 0.5, dy: 0.8 } }), "N1");
  const n = s.display.notes[0], R = run(s, { Side: 0 }), L = run(s, { Side: 1 });
  const gR = Display.noteGeom(n, R.pts.P2, R.flip), gL = Display.noteGeom(n, L.pts.P2, L.flip);
  eq(-1, L.flip, "Left flips");
  ok(Math.abs(gR.T.x + gL.T.x) < 1e-9 && gR.T.y === gL.T.y, "position mirrored");
  eq(["start", "end"], [gR.anchor, gL.anchor], "anchor");
  eq("3", Display.noteText(s, L, n), "same text on Left");
  eq({ dx: 0.5, dy: 0.8 }, Display.noteOffsetAt(L.pts.P2, L.flip, gL.T), "drag on Left reads back the Right-frame dx");
});
test("branches: a note / dimension whose point does not occur is hidden; the all-branches result (show all cases) has it", () => {
  const s = crest();
  good(Logic.addCondition(s, { expr: "Wcrest > 5" }), "cond");
  const d = s.logic.decisions[0], yes = s.logic.branches.find(b => b.decision === d.id && b.case !== "else" && b.case !== false) || s.logic.branches[0];
  good(Logic.setBranch(s, ["P3"], yes.id), "P3 in the yes branch");
  good(Logic.addNote(s, { text: "toe", at: { point: "P3" } }), "N1");
  good(Logic.addDim(s, { kind: "v", a: "P2", b: "P3" }), "D1");
  const n = s.display.notes[0], dim = s.display.dims[0];
  const now = run(s), all = run(s, {}, { allBranches: true });
  eq(false, Display.visible(s, now, "note", n, {}), "note hidden now");
  eq(false, Display.visible(s, now, "dim", dim, {}), "dim hidden now");
  eq(true, Display.visible(s, all, "note", n, {}), "ghost result has it");
  eq(true, Display.visible(s, run(s, { Wcrest: 6 }), "note", n, {}), "shown when the branch occurs");
});

test("UI rename path (review fix 1): renameSpecParam in ui.js calls Logic.editParam (no direct spec edit); editParam with codeParams renames note {…} and the dimension label", () => {
  const src = js("ui.js"), f = src.slice(src.indexOf("function renameSpecParam"), src.indexOf("\n}", src.indexOf("function renameSpecParam")));
  ok(/specEdit\(sp => \{[\s\S]*Logic\.editParam\(sp, old, \{ name: v \}, \{ codeParams: codeParamsOf\(it\) \}\)/.test(f), "goes through specEdit + Logic.editParam");
  ok(!/p\.name\s*=|exprSlots/.test(f), "no direct edit of the spec");
  const s = crest();
  good(Logic.addNote(s, { text: "{Wcrest} m", at: { point: "P2" } }), "N1");
  good(Logic.addDim(s, { kind: "h", a: "P1", b: "P2", label: "Wcrest" }), "D1");
  good(Logic.editParam(s, "Wcrest", { name: "Wc" }, { codeParams: ["Other"] }), "rename as the UI does");
  eq("{Wc} m", s.display.notes[0].text, "note");
  eq("Wc", s.display.dims[0].label, "dimension label");
  eq("Wc", s.points.find(p => p.id === "P2").def.dx, "expression");
  eq("3 m", Display.noteText(s, run(s), s.display.notes[0]), "still shows the value");
});
test("describe lists annotations and survives a malformed note without at (review fix 7)", () => {
  const s = crest();
  good(Logic.addNote(s, { text: "a", at: { point: "P2" } }), "N1");
  s.display.notes.push({ id: "N9", text: "broken" });
  const d = Logic.describe(s, run(s));
  eq([{ id: "N1", note: "a", at: "P2", leader: null }, { id: "N9", note: "broken", at: undefined, leader: null }].map(x => JSON.stringify(x)).join(), d.annotations.map(x => JSON.stringify(x)).join(), "annotations");
});

console.log("show flags (View › Show + Civil 3D preview)");
test("point names off by default; Civil 3D preview hides style / annotations / codes / point names and keeps their values", () => {
  eq({ style: true, annot: true, codes: false, ptnames: false }, Display.showFlags({}, false), "older stored bar");
  eq({ style: true, annot: true, codes: true, ptnames: true }, Display.showFlags({ ptnames: true }, true), "all on");
  const bar = { ptnames: true, annot: true, style: true, c3d: true };
  eq({ style: false, annot: false, codes: false, ptnames: false }, Display.showFlags(bar, true), "c3d hides all four");
  eq(true, bar.ptnames && bar.annot && bar.style, "values kept");
  eq({ style: false, annot: false, codes: true, ptnames: false }, Display.showFlags({ style: false, annot: false }, true), "each toggle");
});

console.log("cross-item (project-level) dimensions");
function twoItems(){
  const body = crest(), base = crest();
  return [{ id: "i1", spec: body }, { id: "i2", spec: base }, { id: "i3" }];     // i3: file missing (no spec)
}
test("addDim on a project doc: refs { item, point } in two items; same item, missing item / point, item without drawing, parameter label refused", () => {
  const items = twoItems(), doc = Display.projDoc(null, items);
  const r = good(Logic.addDim(doc, { kind: "h", a: { item: "i1", point: "P1" }, b: { item: "i2", point: "P3" }, offset: 1.5 }), "cross");
  eq("D1", r.result, "id");
  eq({ id: "D1", kind: "h", a: { item: "i1", point: "P1" }, b: { item: "i2", point: "P3" }, offset: 1.5, label: "auto", decimals: 2 }, doc.display.dims[0], "stored");
  bad(doc, () => Logic.addDim(doc, { kind: "h", a: { item: "i1", point: "P1" }, b: { item: "i1", point: "P2" } }), /belongs in its \.cs/, "same item");
  bad(doc, () => Logic.addDim(doc, { kind: "h", a: { item: "i1", point: "P1" }, b: { item: "i9", point: "P2" } }), /no subassembly i9/, "missing item");
  bad(doc, () => Logic.addDim(doc, { kind: "h", a: { item: "i1", point: "P1" }, b: { item: "i2", point: "P9" } }), /P9 is not a point of i2/, "missing point");
  bad(doc, () => Logic.addDim(doc, { kind: "h", a: { item: "i1", point: "P1" }, b: { item: "i3", point: "P2" } }), /no drawn points/, "no drawing");
  bad(doc, () => Logic.addDim(doc, { kind: "h", a: "P1", b: "P2" }), /\{ item, point \}/, "plain ids");
  bad(doc, () => Logic.addDim(doc, { kind: "h", a: { item: "i1", point: "P1" }, b: { item: "i2", point: "P2" }, label: "Wcrest" }), /"auto" or null/, "parameter label");
  bad(doc, () => Logic.addNote(doc, { text: "a", at: { point: "P1" } }), /only dimensions/, "no notes in the project");
  good(Logic.updateAnnotation(doc, "D1", { offset: -2, kind: "aligned" }), "update");
  eq([-2, "aligned"], [doc.display.dims[0].offset, doc.display.dims[0].kind], "updated");
  good(Logic.removeAnnotation(doc, ["D1"]), "remove");
  eq(undefined, doc.display.dims, "removed");
  eq("D2", good(Logic.addDim(doc, { kind: "v", a: { item: "i1", point: "P2" }, b: { item: "i2", point: "P2" } }), "again").result, "id not reused");
});
test("value from world points (items placed apart, Side mirrored); hidden when an item is missing / a point does not occur", () => {
  const items = twoItems(), doc = Display.projDoc(null, items);
  good(Logic.addDim(doc, { kind: "h", a: { item: "i1", point: "P1" }, b: { item: "i2", point: "P2" }, decimals: 3 }), "D1");
  const dim = doc.display.dims[0];
  const res = { i1: run(items[0].spec), i2: run(items[1].spec, { Side: 1 }) }, org = { i1: { x: 0, y: 0 }, i2: { x: 10, y: -1 } };
  const look = ref => { const r = res[ref.item], q = r && Display.pt(r, ref.point); return q ? { x: org[ref.item].x + q.x, y: org[ref.item].y + q.y, flip: r.flip } : null; };
  const P = Display.projPoints(dim, look);
  eq("7.000", Display.projDimText(dim, P.A, P.B), "|(10 - 3) - 0| on Left");
  eq(null, Display.projPoints(dim, ref => ref.item === "i2" ? null : look(ref)), "item missing -> hidden");
  eq(1, Display.projPoints(dim, look).F, "F of the first item");
});
test("Save project -> reopen: ProjectV3.content writes display (only when it holds annotations); version stays 3; JSON round trip", () => {
  const items = twoItems(), doc = Display.projDoc(null, items);
  good(Logic.addDim(doc, { kind: "h", a: { item: "i1", point: "P1" }, b: { item: "i2", point: "P3" }, offset: 1 }), "D1");
  const ws = { assemblies: [{ id: "a1", name: "A", baseline: { x: 0, y: 0 }, items: [] }], scenarios: [], display: doc.display };
  const st = { originElevation: 0, surface: [], surfaceOn: true, layout: false, extendEnds: true, bar: {} };
  const c = ProjectV3.content(ws, st, () => false);
  eq(3, c.version, "version");
  const back = JSON.parse(JSON.stringify(c));
  eq(JSON.stringify(doc.display), JSON.stringify(back.display), "display survives");
  eq(undefined, ProjectV3.content({ ...ws, display: undefined }, st, () => false).display, "none -> no key");
  eq(undefined, ProjectV3.content({ ...ws, display: { seq: { D: 3 } } }, st, () => false).display, "only seq -> no key");
});
test("projPrune: removing an item or a bound point removes the dimension (with why); an item whose file is missing keeps it (hidden)", () => {
  const items = twoItems(), doc = Display.projDoc(null, items);
  good(Logic.addDim(doc, { kind: "h", a: { item: "i1", point: "P1" }, b: { item: "i2", point: "P3" } }), "D1");
  good(Logic.addDim(doc, { kind: "h", a: { item: "i1", point: "P2" }, b: { item: "i2", point: "P1" } }), "D2");
  eq({ display: doc.display, lost: [] }, Display.projPrune(doc.display, items), "nothing removed");
  const missingFile = items.map(it => it.id === "i2" ? { id: "i2" } : it);
  eq(0, Display.projPrune(doc.display, missingFile).lost.length, "file missing: kept");
  const noI2 = Display.projPrune(doc.display, items.filter(it => it.id !== "i2"));
  eq([{ id: "D1", why: "subassembly i2 removed" }, { id: "D2", why: "subassembly i2 removed" }], noI2.lost, "item removed");
  eq({ seq: { D: 2 } }, noI2.display, "seq kept");
  good(Logic.removeObjects(items[1].spec, ["P3"]), "remove P3 of i2");
  const p = Display.projPrune(doc.display, items);
  eq([{ id: "D1", why: "point P3 removed" }], p.lost, "point removed");
  eq(["D2"], p.display.dims.map(d => d.id), "D2 kept");
});
test("Undo covers project state: a history snapshot with projDisplay restores the dimension and the removed item together", () => {
  const items = twoItems();
  const doc = { assemblies: [{ items }], projDisplay: undefined };
  const snap = () => { const full = JSON.stringify(doc); return { full, key: full }; };
  const h = makeHistory(snap, full => { const d = JSON.parse(full); doc.assemblies = d.assemblies; doc.projDisplay = d.projDisplay; });
  h.track();
  const pd = Display.projDoc(doc.projDisplay, items);
  good(Logic.addDim(pd, { kind: "h", a: { item: "i1", point: "P1" }, b: { item: "i2", point: "P3" } }), "D1");
  h.act("dim"); doc.projDisplay = pd.display; h.track();
  // remove item i2 + cascade in one step
  h.act("remove i2"); doc.assemblies[0].items = items.filter(it => it.id !== "i2");
  doc.projDisplay = Display.projPrune(doc.projDisplay, doc.assemblies[0].items).display; h.track();
  eq(undefined, doc.projDisplay.dims, "gone after remove");
  eq("remove i2", h.step(false), "undo");
  eq(["D1"], doc.projDisplay.dims.map(d => d.id), "dimension back");
  eq(3, doc.assemblies[0].items.length, "item back");
  eq("dim", h.step(false), "undo dim");
  eq(undefined, doc.projDisplay, "no project display");
});

console.log("deferred from the M2 review");
test("rebuildArray with fewer sets: annotations / overrides on removed members are removed (warning), not left behind", () => {
  const s = Spec.newSpec("T");
  s.params.push({ name: "Tread", kind: "double", default: 0.3 }, { name: "Rise", kind: "double", default: 0.1 });
  s.points.push({ id: "P2", codes: [], def: { type: "delta", from: "P1", dx: "Tread", dy: "0" } }, { id: "P3", codes: [], def: { type: "delta", from: "P2", dx: "0", dy: "-Rise" } });
  s.links.push({ id: "L1", points: ["P1", "P2"], codes: [] }, { id: "L2", points: ["P2", "P3"], codes: [] });
  const g = Spec.addArray(s, Ops.expand(s, { links: ["L1", "L2"] }), { n: 4, dx: "Tread", dy: "-Rise", join: { mode: "share", from: "P3", to: "P1" } });
  ok(!g.error, g.error);
  const last = g.members[2], first = g.members[0];
  good(Logic.addNote(s, { text: "last", at: { point: last.points[1] } }), "N1 on the last set");
  good(Logic.addDim(s, { kind: "h", a: "P1", b: first.points[0] }), "D1 on the first member");
  good(Logic.setOverride(s, last.links[0], { link: { linetype: "hidden" } }), "override on the last set");
  const r = good(Logic.updateArray(s, g.id, { n: 2 }), "fewer sets");
  ok((r.warnings || []).some(w => /Annotations removed with them: .*N1/.test(w)), "warning " + JSON.stringify(r.warnings));
  const ids = new Set(s.points.map(p => p.id));
  ok(Display.all(s).every(x => x.kind !== "note"), "N1 gone");
  for (const d of s.display.dims || []) ok(ids.has(d.a) && ids.has(d.b), "no dead dimension");
  for (const id of Object.keys((s.display && s.display.overrides) || {})) ok(ids.has(id) || s.links.some(l => l.id === id) || s.shapes.some(x => x.id === id), "no dead override " + id);
  good(Logic.updateArray(s, g.id, { n: 4 }), "grow again works");
});
test("auto parameter label: none when either point is in a rotate group (the rotation changes the measured component)", () => {
  const s = crest();
  eq("Wcrest", Display.autoLabel(s, { kind: "h", a: "P1", b: "P2" }), "before");
  good(Logic.addRotateGroup(s, ["P2", "P3"], "P1", "10"), "rotate P2, P3 around P1");
  eq(null, Display.autoLabel(s, { kind: "h", a: "P1", b: "P2" }), "rotated");
  eq(null, Display.labelOf(s, { kind: "h", a: "P2", b: "P1", label: "auto" }), "labelOf auto");
  eq("Wcrest", Display.labelOf(s, { kind: "h", a: "P1", b: "P2", label: "Wcrest" }), "an explicit label stays the user's choice");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (failed) process.exitCode = 1;
