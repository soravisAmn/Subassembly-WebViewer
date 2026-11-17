// Style by code (round 10 M1): js/style.js (resolve / parse / serialize / fromColours / hatches) and the Logic API
// display ops setOverride / clearOverride + the removeObjects / copyObjects cascades (js/logicops.js).
// Run: node SA.Tests/js/style.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const Style = require("../../SA.Web/wwwroot/js/style.js");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("style.js") + "\n" + js("ops.js") + "\n" + js("logicops.js")
  + "\nthis.Spec = Spec; this.Logic = Logic; this.Style = Style;", ctx);
const { Spec, Logic } = ctx;
const fixture = fs.readFileSync(path.join(__dirname, "../fixtures/round10/demo.style.json"), "utf8");

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
const style = () => Style.parse(fixture).style;

console.log("resolve");
test("order: override > code > automatic colour, field by field", () => {
  const st = style();
  const auto = Style.resolve("link", ["Nothing"], null, st);
  eq("auto", auto.source, "no style for the code");
  eq(Style.autoColor("Nothing"), auto.color, "automatic colour");
  eq(0.25, auto.weight, "default weight");
  const byCode = Style.resolve("link", ["Top"], null, st);
  eq("code:Top", byCode.source, "code");
  eq(["#d9a441", "solid", 0.5], [byCode.color, byCode.linetype, byCode.weight], "code fields");
  const ov = Style.resolve("link", ["Top"], { link: { linetype: "hidden" } }, st);
  eq("override", ov.source, "override");
  eq(["#d9a441", "hidden", 0.5], [ov.color, ov.linetype, ov.weight], "override of linetype only keeps the code colour / weight");
});
test("Datum is skipped unless it is the only code; several codes = first code with a style of this kind", () => {
  const st = style();
  eq("code:Top", Style.resolve("link", ["Datum", "Top"], null, st).source, "Datum first");
  eq("code:Datum", Style.resolve("link", ["Datum"], null, st).source, "Datum alone");
  eq("code:Top", Style.resolve("link", ["Unstyled", "Top", "Rock"], null, st).source, "first styled code");
  eq("code:Rock", Style.resolve("shape", ["Top", "Rock"], null, st).source, "Top has no shape entry: Rock's");
  eq(Style.autoColor("Unstyled"), Style.resolve("link", ["Unstyled", "Top"], null, null).color, "no style file: colour of the first code");
});
test("automatic colour is stable (hash of the name, not the order codes are met)", () => {
  const a = Style.autoColor("Crest"), b = Style.autoColor("Toe");
  Style.autoColor("Zzz"); Style.autoColor("Another");
  eq(a, Style.autoColor("Crest"), "same name, same colour");
  eq(b, Style.autoColor("Toe"), "same name, same colour 2");
  ok(Style.autoIndex("Crest") >= 0 && Style.autoIndex("Crest") < Style.AUTO_PALETTE.length, "index in the palette");
  eq(Style.NO_CODE, Style.autoColor(""), "no code");
  eq("x", Style.resolve("link", ["Crest"], null, null, { auto: c => c === "Crest" ? "x" : "y" }).color, "page palette through opts.auto");
});
test("shape hatch and point marker", () => {
  const st = style();
  const sh = Style.resolve("shape", ["Rock"], null, st);
  eq(["#7a6a55", 0.35, "GRAVEL", "#c8b89a"], [sh.fill, sh.alpha, sh.hatch.pattern, sh.hatch.color], "Rock shape");
  const sh2 = Style.resolve("shape", ["Rock"], { shape: { hatch: { pattern: "EARTH" } } }, st);
  eq(["EARTH", "#c8b89a"], [sh2.hatch.pattern, sh2.hatch.color], "override pattern keeps the code's hatch colour");
  eq(null, Style.resolve("shape", ["Rock"], { shape: { hatch: { pattern: "NONE" } } }, st).hatch, "NONE removes the hatch");
  const pt = Style.resolve("point", ["Crest"], null, st);
  eq(["triangle", "#ff6b6b", 7], [pt.marker, pt.color, pt.size], "Crest point");
  eq(["square", 8], [Style.resolve("point", [], null, st).marker, Style.resolve("point", [], null, st).size], "default point");
});
test("useStyle: false ignores the style file and overrides; c3d: neutral", () => {
  const st = style();
  const off = Style.resolve("link", ["Top"], { link: { color: "#000000" } }, st, { useStyle: false });
  eq(["auto", Style.autoColor("Top"), "solid"], [off.source, off.color, off.linetype], "style off");
  const c3 = Style.resolve("link", ["Top"], { link: { color: "#000000" } }, st, { c3d: true });
  eq([Style.NEUTRAL, "solid", "c3d"], [c3.color, c3.linetype, c3.source], "c3d link");
  const c3s = Style.resolve("shape", ["Rock"], null, st, { c3d: true });
  eq([null, null], [c3s.fill, c3s.hatch], "c3d shape: default fill, no hatch");
  const c3p = Style.resolve("point", ["Crest"], null, st, { c3d: true });
  eq(["square", 8, null], [c3p.marker, c3p.size, c3p.color], "c3d point: plain square");
  eq(Style.NEUTRAL, Style.resolve("link", ["A"], null, st, { c3d: true }).color === Style.resolve("link", ["B"], null, st, { c3d: true }).color ? Style.NEUTRAL : "", "one colour for every link");
});

console.log("style file");
test("parse / serialize round trip keeps unknown keys", () => {
  const p = Style.parse(fixture);
  ok(p.ok, p.error);
  eq(0, p.warnings.length, "no warnings: " + p.warnings.join(","));
  ok(p.style.icon && p.style.icon.keep === true, "unknown root key kept");
  ok(p.style.codes.Top.note === "kept", "unknown code key kept");
  const again = Style.parse(Style.serialize(p.style));
  eq(p.style, again.style, "round trip");
  eq(11, Style.textSize(p.style), "text size");
});
test("bad fields are dropped with a warning; broken / newer / empty file = error (page falls back to automatic colours)", () => {
  const p = Style.parse({ codes: { A: { link: { color: "red", linetype: "wavy", weight: 0.5 } }, B: 5 }, text: { size: 2 } });
  ok(p.ok, "still ok");
  eq({ weight: 0.5 }, p.style.codes.A.link, "only the good field");
  ok(!("B" in p.style.codes), "B dropped");
  ok(p.warnings.length >= 3, "warnings: " + p.warnings.join(" | "));
  eq(11, p.style.text.size, "text size default");
  for (const x of ["", "{bad", "[]", JSON.stringify({ version: 2 })]) ok(!Style.parse(x).ok, "must fail: " + x);
  // missing style file: resolve with null = automatic colours
  eq("auto", Style.resolve("link", ["Top"], null, null).source, "no style");
});
test("fromColours writes the colour seen now for each code once", () => {
  const st = Style.fromColours(["Top", "Rock", "Top", ""], c => "#" + (c === "Top" ? "111111" : "222222"));
  eq({ Top: { link: { color: "#111111" } }, Rock: { link: { color: "#222222" } } }, st.codes, "codes");
  eq(1, st.version, "version");
  eq(Style.autoColor("Top"), Style.fromColours(["Top"]).codes.Top.link.color, "default = automatic colour");
});
test("setField edits one code; an emptied kind / code is removed", () => {
  const st = Style.empty();
  Style.setField(st, "A", "link", { color: "#123456", weight: 0.5 });
  eq({ link: { color: "#123456", weight: 0.5 } }, st.codes.A, "set");
  Style.setField(st, "A", "link", { color: null, weight: null });
  ok(!("A" in st.codes), "removed");
});
test("hatches: SOLID, ANSI31, ANSI37, AR-CONC, EARTH, GRAVEL, NONE; tiles scale with zoom", () => {
  eq("SOLID,ANSI31,ANSI37,AR-CONC,EARTH,GRAVEL,NONE", Object.keys(Style.HATCHES).join(","), "list");
  for (const k of Object.keys(Style.HATCHES)){
    const t = Style.hatchTile({ pattern: k, scale: 1, angle: 0, color: "#abcdef" }, 40);
    if (k === "NONE"){ eq(null, t, "NONE draws nothing"); continue; }
    ok(t && t.w > 0 && t.h > 0 && /#abcdef/.test(t.body), k + " tile");
  }
  const a = Style.hatchTile({ pattern: "ANSI31", scale: 1 }, 40), b = Style.hatchTile({ pattern: "ANSI31", scale: 1 }, 80);
  ok(b.w > a.w, "bigger zoom, bigger tile");
  ok(!/<script|onload/i.test(Style.hatchTile({ pattern: "SOLID", color: '"><script>' }, 40).body), "colour cannot inject markup");
});
test("weights: fixed screen width per mm; linetypes", () => {
  ok(Style.weightPx(0.5) > Style.weightPx(0.25), "thicker");
  eq(2.4, Style.weightPx(0.25), "0.25 mm = 2.4 px (links before round 10)");
  eq("", Style.dash("solid"), "solid");
  ok(Style.dash("hidden") && Style.dash("center") && Style.dash("dashed"), "dashes");
});

console.log("Logic API: setOverride / clearOverride");
function base(){
  const s = Spec.newSpec("T");
  Spec.addPoint(s, { type: "delta", from: "P1", dx: "2", dy: "0" }, ["Top"]);      // P2
  Spec.addPoint(s, { type: "delta", from: "P2", dx: "1", dy: "-1" }, ["Toe"]);     // P3
  for (const [a, b, c] of [["P1", "P2", "Top"], ["P2", "P3", "Side"], ["P3", "P1", "Base"]])   // L1 L2 L3
    Spec.byId(s.links, Spec.addLink(s, a, b)).codes = [c];
  Spec.byId(s.shapes, Spec.addShape(s, ["L1", "L2", "L3"])).codes = ["Rock"];        // S1
  return s;
}
test("a spec without overrides has no display key", () => {
  const s = base();
  ok(!("display" in s), "no display");
  ok(!("display" in Spec.normalize(JSON.parse(JSON.stringify(s)))), "normalize adds nothing");
  const e = base(); e.display = { overrides: {}, notes: [] };
  ok(!("display" in Spec.normalize(e)), "empty display removed");
});
test("setOverride merges field by field; clearOverride goes back to ByCode", () => {
  const s = base();
  good(Logic.setOverride(s, "L1", { link: { linetype: "hidden" } }), "linetype");
  good(Logic.setOverride(s, "L1", { link: { weight: 0.5 } }), "weight");
  eq({ link: { linetype: "hidden", weight: 0.5 } }, s.display.overrides.L1, "merged");
  good(Logic.setOverride(s, "S1", { shape: { hatch: "EARTH" } }), "hatch by name");
  good(Logic.setOverride(s, "S1", { shape: { hatch: { color: "#ffffff" } } }), "hatch colour");
  eq({ pattern: "EARTH", color: "#ffffff" }, s.display.overrides.S1.shape.hatch, "hatch merged");
  good(Logic.setOverride(s, "L1", { link: { weight: null } }), "null removes a field");
  eq({ link: { linetype: "hidden" } }, s.display.overrides.L1, "weight gone");
  eq(true, good(Logic.clearOverride(s, "L1"), "clear").result, "had one");
  eq(false, good(Logic.clearOverride(s, "L2"), "clear none").result, "had none");
  good(Logic.clearOverride(s, "S1", "shape"), "clear kind");
  ok(!("display" in s), "display removed when empty");
  good(Logic.applyBatch(s, [{ fn: "setOverride", args: ["P2", { point: { marker: "circle" } }] }]), "through applyBatch");
  eq("circle", s.display.overrides.P2.point.marker, "batch");
});
test("errors leave the spec unchanged", () => {
  const s = base();
  good(Logic.setOverride(s, "L1", { link: { color: "#123456" } }), "start");
  bad(s, () => Logic.setOverride(s, "L9", { link: { color: "#000000" } }), /L9/, "missing id");
  bad(s, () => Logic.setOverride(s, "L1", { shape: { fill: "#000000" } }), /link/, "field of another kind");
  bad(s, () => Logic.setOverride(s, "L1", { link: { linetype: "wavy" } }), /linetype/, "bad linetype");
  bad(s, () => Logic.setOverride(s, "L1", { link: { color: "red" } }), /color/, "bad colour");
  bad(s, () => Logic.setOverride(s, "P2", { point: { marker: "star" } }), /marker/, "bad marker");
  bad(s, () => Logic.setOverride(s, "S1", { shape: { hatch: "BRICK" } }), /hatch/, "unknown hatch");
  bad(s, () => Logic.setOverride(s, "S1", { shape: { hatch: { pattern: "BOGUS" } } }), /pattern/, "unknown hatch pattern in an object");
  bad(s, () => Logic.setOverride(s, "S1", { shape: { hatch: { pattern: "EARTH", scale: -1 } } }), /scale/, "negative hatch scale");
  bad(s, () => Logic.setOverride(s, "S1", { shape: { hatch: { color: "red" } } }), /color/, "bad hatch colour");
  ok(Style.checkField("shape", "hatch", { pattern: "BOGUS" }) && Style.checkField("shape", "hatch", { scale: -1 }), "checkField rejects dropped hatch fields");
  good(Logic.setOverride(s, "S1", { shape: { hatch: { pattern: "earth", scale: 2 } } }), "lower-case pattern");
  eq({ pattern: "EARTH", scale: 2 }, s.display.overrides.S1.shape.hatch, "cleaned value stored");
  bad(s, () => Logic.setOverride(s, "L1", {}), /empty/, "empty patch");
  bad(s, () => Logic.clearOverride(s, "L1", "shape"), /link/, "wrong kind");
});
test("removeObjects removes the overrides of removed ids (warning); copyObjects copies them", () => {
  const s = base();
  good(Logic.setOverride(s, "L1", { link: { linetype: "dashed" } }), "L1");
  good(Logic.setOverride(s, "S1", { shape: { fill: "#00ff00" } }), "S1");
  good(Logic.setOverride(s, "P3", { point: { marker: "cross" } }), "P3");
  good(Logic.setOverride(s, "L2", { link: { linetype: "dashed" } }), "L2");
  const c = good(Logic.copyObjects(s, ["L2"], { dx: 10, dy: 0, convert: true }), "copy");
  const newL = c.links[0];
  eq({ link: { linetype: "dashed" } }, s.display.overrides[newL], "copied link override");
  const r = good(Logic.removeObjects(s, ["P3"]), "remove P3");
  ok(!s.display.overrides.P3 && !s.display.overrides.S1, "P3 and its shape lost their overrides");
  ok(s.display.overrides.L1, "L1 kept");
  ok(r.warnings.some(w => /Display overrides removed/.test(w) && /P3/.test(w)), "warning: " + r.warnings.join(" | "));
});
test("display is web only: generated code input ignores it (spec keys other than display unchanged)", () => {
  const s = base(), t = base();
  good(Logic.setOverride(t, "L1", { link: { color: "#123456" } }), "override");
  const strip = o => { const x = JSON.parse(JSON.stringify(o)); delete x.display; return x; };
  eq(strip(s), strip(t), "only display differs");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);   // summary line read by test-all.js
process.exitCode = failed ? 1 : 0;
