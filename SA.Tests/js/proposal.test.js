// Round 6 M3: proposals. The real spec is never touched; failure leaves the proposal as it was.
// Run: node SA.Tests/js/proposal.test.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({ console });
vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("logicops.js") + "\n" + js("proposal.js") + "\nthis.Spec = Spec; this.Logic = Logic; this.Proposals = Proposals;", ctx);
const { Spec, Logic, Proposals } = ctx;

let passed = 0, failed = 0;
function test(name, body){
  try{ Proposals.reset(); body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { const a = JSON.stringify(act), b = JSON.stringify(exp); if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const good = r => { if (!r || r.ok !== true) throw new Error(r && r.error); return r; };
const base = () => { const s = good(Logic.newSubassembly("T")).result; good(Logic.addPoint(s, { type: "delta", from: "P1", dx: "2", dy: "0" }, ["A"])); good(Logic.addLink(s, "P1", "P2", { codes: ["Top"] })); return s; };
const pointOp = (dx, as) => ({ fn: "addPoint", as, args: [{ type: "delta", from: "P1", dx: String(dx), dy: "-1" }] });

console.log("Proposals (round 6 M3)");

test("the real spec does not change; ops accumulate over several applies", () => {
  const real = base(), before = JSON.stringify(real), p = Proposals.add(Proposals.make({ itemId: "x", base: real }));
  good(Proposals.apply(p, [pointOp(3, "a")], "first", {}));
  good(Proposals.apply(p, [pointOp(4), { fn: "setCodes", args: [["L1"], ["Datum"]] }], "second", {}));
  eq(before, JSON.stringify(real), "real spec"); eq(3, Proposals.opCount(p), "op count"); eq(4, p.spec.points.length, "proposal points"); eq("first\nsecond", p.summary, "summary");
});

test("failing midway: the proposal stays as it was", () => {
  const p = Proposals.add(Proposals.make({ itemId: "x", base: base() }));
  good(Proposals.apply(p, [pointOp(3)], "", {}));
  const before = JSON.stringify(p.spec);
  const r = Proposals.apply(p, [pointOp(5), { fn: "addLink", args: ["P1", "P99"] }], "bad", {});
  ok(r.ok === false && r.failedOp === 1, JSON.stringify(r)); eq(before, JSON.stringify(p.spec), "spec"); eq(1, Proposals.opCount(p), "ops"); eq("", p.summary, "summary");
});

test("kinds: added / changed / removed by id, diffText reports the same", () => {
  const b = base(), p = Proposals.add(Proposals.make({ itemId: "x", base: b }));
  good(Proposals.apply(p, [pointOp(3), { fn: "setCodes", args: [["L1"], ["Datum"]] }, { fn: "removeObjects", args: [["P2"]] }], "", {}));
  const k = Proposals.kinds(JSON.parse(p.base), p.spec);
  ok(k.added.has("P3"), "added"); ok(k.removed.has("P2") && k.removed.has("L1"), "removed cascade");
  const q = Proposals.make({ itemId: "y", base: b });
  good(Proposals.apply(q, [{ fn: "setCodes", args: [["L1"], ["Datum"]] }], "", {}));
  ok(Proposals.kinds(JSON.parse(q.base), q.spec).changed.has("L1"), "changed");
  ok(/\+ object P3/.test(Logic.diffText(JSON.parse(p.base), p.spec)), "diffText");
  const d = Logic.diffText(JSON.parse(q.base), q.spec);
  ok(d.includes("~ L1 code: Top → Datum"), "code change: " + d);
  const e = Proposals.make({ itemId: "z", base: b });
  good(Proposals.apply(e, [{ fn: "editPoint", args: ["P2", { dx: "7" }] }], "", {}));
  ok(Logic.diffText(JSON.parse(e.base), e.spec).includes("~ P2 แก้นิยาม"), "definition change");
});

test("specAtStep replays the first k ops across batches, references included; view only", () => {
  const p = Proposals.add(Proposals.make({ itemId: "x", base: base() }));
  good(Proposals.apply(p, [pointOp(3, "a"), { fn: "addLink", args: ["P1", "${a.result}"] }], "", {}));
  good(Proposals.apply(p, [pointOp(4)], "", {}));
  const n = k => { const s = Proposals.specAtStep(p, k); return [s.points.length, s.links.length]; };
  eq([2, 1], n(0), "0"); eq([3, 1], n(1), "1"); eq([3, 2], n(2), "2"); eq([4, 2], n(3), "3"); eq(4, p.spec.points.length, "proposal untouched");
  p.step = 1; eq(3, Proposals.viewSpec(p).points.length, "viewSpec step"); p.step = null; eq(p.spec, Proposals.viewSpec(p), "viewSpec full");
});

test("status: pending only until finished · a cancellation is reported once", () => {
  const p = Proposals.add(Proposals.make({ itemId: "x", base: base() }));
  eq(p, Proposals.pendingFor("x"), "pending");
  eq(null, Proposals.takeCancelled("x"), "nothing to report");
  Proposals.finish(p, "cancelled", "user edited");
  eq(null, Proposals.pendingFor("x"), "not pending");
  eq(p.id, Proposals.takeCancelled("x").id, "first"); eq(null, Proposals.takeCancelled("x"), "once");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
process.exitCode = failed ? 1 : 0;
