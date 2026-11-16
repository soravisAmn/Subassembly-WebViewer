// Saved palette layout of round 9 (SA.Web/wwwroot/js/dock.js, DockLayout): a broken / old layout falls back to the default
// Run: node SA.Tests/js/dock.test.js
"use strict";
const fs = require("fs"), path = require("path");
const DockLayout = require("../../SA.Web/wwwroot/js/dock.js");
const Commands = require("../../SA.Web/wwwroot/js/commands.js");
const real = JSON.parse(fs.readFileSync(path.join(__dirname, "../fixtures/round9/dock-layout.json"), "utf8"));   // saved by the page (Log floated)

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const ok = (c, what) => { if (!c) throw new Error(what); };
const copy = o => JSON.parse(JSON.stringify(o));

console.log("saved layout");
test("a layout saved by the page is accepted (object or JSON text)", () => {
  ok(DockLayout.parseSaved(real), "object");
  ok(DockLayout.parseSaved(JSON.stringify(real)), "text");
  ok(DockLayout.parseSaved(real).floatingGroups.length === 1, "floating group kept");
});
test("broken JSON, nothing, or not an object → default", () => {
  for (const bad of [null, undefined, "", "{bad json", "42", 42, "[]", true]) ok(DockLayout.parseSaved(bad) === null, JSON.stringify(bad));
});
test("another version → default", () => {
  const o = copy(real); o.v = DockLayout.VERSION + 1; ok(DockLayout.parseSaved(o) === null, "newer");
  const p = copy(real); delete p.v; ok(DockLayout.parseSaved(p) === null, "no version");
});
test("no workspace panel, an unknown palette, or a component that is not its id → default", () => {
  const a = copy(real); delete a.layout.panels.main; ok(DockLayout.parseSaved(a) === null, "no main");
  const b = copy(real); b.layout.panels.browser = { id: "browser", contentComponent: "browser" }; ok(DockLayout.parseSaved(b) === null, "unknown");
  const c = copy(real); c.layout.panels.tree.contentComponent = "props"; ok(DockLayout.parseSaved(c) === null, "component");
});
test("a tab in the grid / a floating group without its panel → default", () => {
  const a = copy(real); delete a.layout.panels.scenarios; ok(DockLayout.parseSaved(a) === null, "grid view");
  const b = copy(real); delete b.layout.panels.log; ok(DockLayout.parseSaved(b) === null, "floating view");
  const c = copy(real); delete c.layout.grid; ok(DockLayout.parseSaved(c) === null, "no grid");
});

console.log("palettes");
test("palettes of prompt-9 §3, each with a View › Palettes toggle; Code is not in the default layout", () => {
  const ids = DockLayout.PALETTES.map(p => p.id).join(",");
  ok(ids === "tree,scenarios,props,code,msg,log,pts,logic,ai", ids);
  for (const p of DockLayout.PALETTES) ok(Commands.get("pal." + p.id), "no toggle for " + p.id);
  ok(Commands.get("pal.reset"), "Reset layout");
  ok(!DockLayout.PALETTES.find(p => p.id === "code").on, "Code opens by Ctrl+E");
  ok(DockLayout.PALETTES.filter(p => p.home === "bottom").length === 5, "5 result palettes under the workspace");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);   // summary line read by test-all.js
process.exitCode = failed ? 1 : 0;
