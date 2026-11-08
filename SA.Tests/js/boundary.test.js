// Round 6: bottom boundary (lower envelope of real links), on hand-made cases with known answers and on the locked fixtures.
// Run: node SA.Tests/js/boundary.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("logicops.js") + "\n" + js("boundary.js") + "\nthis.Spec = Spec; this.Logic = Logic; this.Boundary = Boundary;", ctx);
const { Spec, Logic, Boundary } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { const a = JSON.stringify(act), b = JSON.stringify(exp); if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const good = r => { if (!r || r.ok !== true) throw new Error(r && r.error); return r; };
const run = (s, y, values) => Spec.evaluate(s, { values: values || {}, codeParams: [], codePoints: [], surface: y == null ? null : (Array.isArray(y) ? y : [{ x: -60, y }, { x: 60, y }]), extendEnds: true, layout: y == null });
const r3 = list => list.map(s => [+s.from.toFixed(3), +s.to.toFixed(3), s.link]);
const P = (s, dx, dy, o) => good(Logic.addPoint(s, { type: "delta", from: "P1", dx: String(dx), dy: String(dy) }, [], o)).result;
const L = (s, a, b, codes, o) => good(Logic.addLink(s, a, b, { codes, ...(o || {}) })).result;
const fixture = n => {
  const t = fs.readFileSync(path.join(__dirname, "../fixtures/round6", n), "utf8"), m = /\/\/ sa-spec(-b64)?: (.*)/.exec(t);
  return JSON.parse(m[1] ? Buffer.from(m[2].trim(), "base64").toString("utf8") : m[2]);
};

console.log("Bottom boundary (round 6)");

test("box: the bottom edge is the boundary, vertical sides never count, a missing code gives the stretch", () => {
  const s = good(Logic.newSubassembly("T")).result;
  const a = P(s, 4, 0), b = P(s, 4, -2), c = P(s, 0, -2);
  L(s, "P1", a, ["Top"]); L(s, a, b, ["Side"]); const bot = L(s, b, c, ["Bottom"]); L(s, c, "P1", ["Side"]);
  const env = Boundary.lowerEnvelope(s, run(s, null));
  eq([[0, 4, bot]], r3(env.stretches), "stretches"); eq([], env.holes, "holes");
  eq([[0, 4, bot]], r3(Boundary.missing(env, "Datum")), "missing"); eq([], Boundary.missing(env, "Bottom"), "has code");
});

test("two links crossing: the lowest changes at the crossing · adjacent stretches stay separate per link", () => {
  const s = good(Logic.newSubassembly("T")).result;
  const a = P(s, 4, -4), b = P(s, 0, -4), c = P(s, 4, 0);
  const l1 = L(s, "P1", a, ["A"]), l2 = L(s, b, c, ["B"]);
  eq([[0, 2, l2], [2, 4, l1]], r3(Boundary.lowerEnvelope(s, run(s, null)).stretches), "crossing");
});

test("auxiliary links do not count · a hole between parts is reported", () => {
  const s = good(Logic.newSubassembly("T")).result;
  const a = P(s, 2, 0), b = P(s, 4, 0), c = P(s, 6, 0), d = P(s, 0, -5), e = P(s, 6, -5);
  const l1 = L(s, "P1", a, ["X"]), l2 = L(s, b, c, ["X"]); L(s, d, e, [], { aux: true });
  const env = Boundary.lowerEnvelope(s, run(s, null));
  eq([[0, 2, l1], [4, 6, l2]], r3(env.stretches), "aux ignored"); eq([[2, 4]], env.holes.map(h => [h.from, h.to]), "hole");
});

test("overlapping links: either one's code counts", () => {
  const s = good(Logic.newSubassembly("T")).result;
  const a = P(s, 4, 0), b = P(s, 8, 0);
  const l1 = L(s, "P1", b, ["Datum"]), l2 = L(s, "P1", a, ["Top"]);
  const env = Boundary.lowerEnvelope(s, run(s, null));
  eq([], Boundary.missing(env, "Datum"), "covered");
  ok(env.stretches[0].link === `${l1}+${l2}` || env.stretches[0].link === `${l2}+${l1}`, env.stretches[0].link);
});

test("a link in a branch or an optional link counts only where it occurs", () => {
  const s = good(Logic.newSubassembly("T")).result;
  const a = P(s, 4, 0), b = P(s, 4, -3), c = P(s, 0, -3);
  const low = L(s, b, c, ["Low"]), top = L(s, "P1", a, ["Top"]);
  const d = good(Logic.addCondition(s, { name: "Deep", expr: "ground(P1) < -5" }));
  good(Logic.setBranch(s, [low], d.yes));
  eq([[0, 4, top]], r3(Boundary.lowerEnvelope(s, run(s, -1)).stretches), "branch off");
  eq([[0, 4, low]], r3(Boundary.lowerEnvelope(s, run(s, -9)).stretches), "branch on");
});

test("Left side: offsets are mirrored and increasing", () => {
  const s = good(Logic.newSubassembly("T")).result;
  const a = P(s, 4, 0), l = L(s, "P1", a, ["X"]);
  eq([[-4, 0, l]], r3(Boundary.lowerEnvelope(s, run(s, null, { Side: 1 })).stretches), "left");
});

test("base fixture: the Clipped bottom edge carries Datum wherever the ground is below the base (per-segment codes)", () => {
  const s = fixture("base_rock-pitching-web.cs");
  for (const y of [-1, -9]) eq([], Boundary.missing(Boundary.lowerEnvelope(s, run(s, y)), "Datum"), `ground ${y}`);
});

test("locked fixtures: the real gaps before the user adds Datum (pavement L57 in Layout, body L10 at every ground)", () => {
  const p = fixture("pavement-assembly.cs");
  eq([[-0.205, -0.045, "L57"]], r3(Boundary.missing(Boundary.lowerEnvelope(p, run(p, null)), "Datum")), "pavement Layout");
  eq([], Boundary.missing(Boundary.lowerEnvelope(p, run(p, -20)), "Datum"), "pavement on low ground");
  const b = fixture("body_rock-pitching-web.cs");
  for (const y of [null, -20, 5]) eq([[11.995, 12.5, "L10"]], r3(Boundary.missing(Boundary.lowerEnvelope(b, run(b, y)), "Datum")), `body ground ${y}`);
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
