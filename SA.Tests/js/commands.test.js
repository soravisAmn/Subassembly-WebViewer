// Command registry of the round 9 ribbon (SA.Web/wwwroot/js/commands.js): fields, shortcuts, enable rules, inventory
// Run: node SA.Tests/js/commands.test.js
"use strict";
const fs = require("fs"), path = require("path");
const Commands = require("../../SA.Web/wwwroot/js/commands.js");
const WWW = path.join(__dirname, "../../SA.Web/wwwroot");

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const ok = (c, what) => { if (!c) throw new Error(what); };
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}`); };

// context outside / inside Edit (see ctxNow in js/ribbon.js)
const base = { editing: false, item: null, asm: null, itemGenerated: false, picked: false, deletable: false, clip: false, addMode: false,
               readOnly: false, undo: false, redo: false, bar: {}, showCodes: true, ve: 1, edOpen: false, tool: null, cmdRunning: false, canSaveDrawing: false };
const ctx = o => Object.assign({}, base, o);
const ribbonIds = () => Commands.RIBBON.flatMap(t => t.panels.flatMap(p => p.items.filter(x => !x.widget).map(x => Array.isArray(x) ? x[0] : x)));

console.log("registry");
test("every command has id, label, Thai tip and run()", () => {
  for (const c of Commands.LIST){
    ok(c.id && c.label, `missing id / label: ${JSON.stringify(c.id)}`);
    ok(typeof c.tip === "string" && /[฀-๿]/.test(c.tip), `${c.id}: tip must be a Thai line`);
    ok(typeof c.run === "function", `${c.id}: no run()`);
  }
});
test("ids are unique", () => {
  const seen = new Set();
  for (const c of Commands.LIST){ ok(!seen.has(c.id), "duplicate id " + c.id); seen.add(c.id); }
});
test("no key belongs to two commands, and every key has a shortcut label", () => {
  const seen = {};
  for (const c of Commands.LIST) for (const k of c.keys || []){
    ok(!seen[k], `key ${k}: ${seen[k]} and ${c.id}`); seen[k] = c.id;
    ok(c.shortcut, `${c.id}: key ${k} without a shortcut label`);
  }
});
test("keys are the ones used before round 9", () => {
  const want = { p: "draw.point", l: "draw.link", s: "draw.shape", i: "draw.intersect", o: "draw.offset", m: "mod.move", c: "mod.copy", r: "mod.rotate",
                 x: "draw.aux", b: "logic.branch", a: "surf.add", f: "view.fit", z: "view.zoomSel", delete: "sel.delete", backspace: "sel.delete",
                 "ctrl+z": "undo", "ctrl+y": "redo", "ctrl+shift+z": "redo", "ctrl+a": "sel.all", "ctrl+c": "clip.copy", "ctrl+x": "clip.cut",
                 "ctrl+v": "clip.paste", "ctrl+e": "code.edit", f3: "bar.osnap", f8: "bar.ortho", f9: "bar.snap", f11: "bar.track", "?": "help.keys", f1: "help.keys" };
  for (const [k, id] of Object.entries(want)) eq(id, (Commands.forKey(k) || {}).id, "key " + k);
});
test("keyOf: Shift counts only with Ctrl; ? stays ?", () => {
  const K = o => Commands.keyOf(Object.assign({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, o));
  eq("p", K({ key: "P", shiftKey: true }), "Shift+P");
  eq("ctrl+shift+z", K({ key: "Z", ctrlKey: true, shiftKey: true }), "Ctrl+Shift+Z");
  eq("ctrl+z", K({ key: "z", metaKey: true }), "Cmd+Z");
  eq("?", K({ key: "?", shiftKey: true }), "?");
  eq("delete", K({ key: "Delete" }), "Delete");
  eq("ctrl+alt+e", K({ key: "e", ctrlKey: true, altKey: true }), "Ctrl+Alt+E");
  eq(null, Commands.forKey("ctrl+alt+e"), "Ctrl+Alt+E is not Ctrl+E");
});

console.log("where commands appear");
test("ribbon, ไฟล์ menu and Quick Access name existing commands", () => {
  for (const id of [...ribbonIds(), ...Commands.QUICK, ...Commands.FILE_MENU.filter(x => x !== "-" && x !== "recent")])
    ok(Commands.get(id), "unknown command " + id);
});
test("always-visible tabs Home, View, Output, AI + contextual Draw, Modify, Logic (no empty tabs)", () => {
  eq("home,view,output,ai", Commands.RIBBON.filter(t => !t.contextual).map(t => t.id).join(","), "tabs");
  eq("draw,modify,logic", Commands.RIBBON.filter(t => t.contextual).map(t => t.id).join(","), "contextual tabs");
  for (const t of Commands.RIBBON) ok(t.panels.length && t.panels.every(p => p.items.length), t.id + ": empty panel");
  eq("finish.save,finish.exit", Commands.FINISH.items.join(","), "Finish panel");
});
test("every Edit-only command is on a contextual tab; contextual tabs hold only Edit commands (+ Move / Copy / Rotate / Delete)", () => {
  const onCtx = new Set(Commands.RIBBON.filter(t => t.contextual).flatMap(t => t.panels.flatMap(p => p.items.map(x => Array.isArray(x) ? x[0] : x))).concat(Commands.FINISH.items));
  for (const c of Commands.LIST.filter(c => c.edit)) ok(onCtx.has(c.id), c.id + " not on a contextual tab");
  for (const id of onCtx) ok(Commands.get(id).edit || /^(mod\.|sel\.delete)/.test(id), id + " is not an Edit command");
  ok(onCtx.has("draw.ngon"), "Regular Polygon (Q6)");
  const logic = Commands.RIBBON.find(t => t.id === "logic").panels[0].items.map(x => Array.isArray(x) ? x[0] : x);
  ok(logic.includes("draw.cutfill"), "ถ้าตัด / ถม in Logic (Q2)");
});
test("ribbon / menu / Quick Access icons exist in lib/tabler or are Drawer SVGs (VE and palette toggles are text only)", () => {
  for (const id of new Set([...ribbonIds(), ...Commands.QUICK, ...Commands.FINISH.items])){
    const c = Commands.get(id);
    if (/^view\.ve|^pal\.(?!reset)/.test(id)) continue;
    if (c.svg){ ok(/^<(path|circle|text)/.test(c.svg), id + ": bad svg"); continue; }
    ok(c.icon, id + ": no icon");
    ok(fs.existsSync(path.join(WWW, "lib/tabler", c.icon + ".svg")), `${id}: lib/tabler/${c.icon}.svg missing`);
  }
  ok(fs.existsSync(path.join(WWW, "lib/tabler/LICENSE")), "Tabler LICENSE missing");
});
test("ไฟล์ menu keeps the old order (minus the dead Save / Export .cs)", () => {
  eq("cs.import,cs.new,-,proj.open,proj.save,proj.saveAs,proj.new,proj.pack,recent,-,build,-,sc.export,sc.import,-,settings",
     Commands.FILE_MENU.join(","), "menu");
});
test("Quick Access = Save, Undo, Redo (no Build)", () => eq("proj.save,undo,redo", Commands.QUICK.join(","), "QA"));

console.log("enable rules");
test("contextual commands (Draw / Logic / Finish) and Rotate are disabled outside Edit, with a reason", () => {
  const edit = Commands.LIST.filter(c => c.edit).map(c => c.id).concat("mod.rotate");
  ok(edit.length >= 20, "too few contextual commands: " + edit.length);
  for (const id of edit){
    const e = Commands.enabled(id, ctx({ item: "a" }));
    ok(typeof e === "string" && e.length, id + " enabled outside Edit");
  }
  eq(true, Commands.enabled("draw.point", ctx({ editing: true })), "Point in Edit");
  eq(true, Commands.enabled("finish.exit", ctx({ editing: true })), "Exit in Edit");
});
test("Edit needs a selected subassembly and is off while editing", () => {
  ok(typeof Commands.enabled("edit.enter", ctx()) === "string", "no selection");
  eq(true, Commands.enabled("edit.enter", ctx({ item: "a" })), "selected");
  ok(typeof Commands.enabled("edit.enter", ctx({ item: "a", editing: true })) === "string", "in Edit");
});
test("Add subassembly needs an assembly; Mirror needs a subassembly; both off in Edit", () => {
  ok(typeof Commands.enabled("asm.add", ctx()) === "string", "no assembly");
  eq(true, Commands.enabled("asm.add", ctx({ asm: "A1" })), "assembly");
  ok(typeof Commands.enabled("asm.add", ctx({ asm: "A1", editing: true })) === "string", "in Edit");
  ok(typeof Commands.enabled("item.mirror", ctx()) === "string", "Mirror without selection");
  eq(true, Commands.enabled("item.mirror", ctx({ item: "a" })), "Mirror");
});
test("Save project is off in a read-only tab; Undo / Redo follow the history; Paste needs the clipboard", () => {
  ok(typeof Commands.enabled("proj.save", ctx({ readOnly: true })) === "string", "read-only");
  eq(true, Commands.enabled("proj.save", ctx()), "save");
  ok(typeof Commands.enabled("undo", ctx()) === "string", "undo empty");
  eq(true, Commands.enabled("undo", ctx({ undo: true })), "undo");
  ok(typeof Commands.enabled("clip.paste", ctx()) === "string", "paste empty");
});
test("tooltips: name + shortcut + Thai line + reason when disabled", () => {
  const t = Commands.tooltip("edit.enter", ctx());
  ok(/^Edit\n/.test(t) && /ใช้ไม่ได้ตอนนี้: เลือก subassembly ก่อน/.test(t), t);
  ok(/^Fit \(F\)\n/.test(Commands.tooltip("view.fit", ctx())), "Fit (F)");
});
test("View toggles read the same state as the status bar", () => {
  eq(true, Commands.active("view.c3d", ctx({ bar: { c3d: true } })), "c3d on");
  eq(true, Commands.active("view.design", ctx({ bar: { c3d: false } })), "design");
  eq(true, Commands.active("view.aux", ctx({ bar: { aux: true } })), "aux");
  eq(false, Commands.active("view.codes", ctx({ showCodes: false })), "codes off");
  eq(true, Commands.active("view.ve2", ctx({ ve: 2 })), "VE 2");
});
test("keyboard: contextual keys ignored outside Edit; X / B ignored during Move / Copy / Rotate", () => {
  eq(false, Commands.keyAllowed(Commands.forKey("p"), { editing: false }), "P outside Edit");
  eq(true, Commands.keyAllowed(Commands.forKey("p"), { editing: true }), "P in Edit");
  eq(true, Commands.keyAllowed(Commands.forKey("m"), { editing: false }), "M outside Edit (subassemblies)");
  eq(true, Commands.keyAllowed(Commands.forKey("r"), { editing: false }), "R outside Edit (banner says why)");
  eq(false, Commands.keyAllowed(Commands.forKey("x"), { editing: true, cmdRunning: true }), "X during Move");
});

console.log("? / F1 table");
test("generated from the registry: every command key is in the table, rows have key + Thai / English text", () => {
  const rows = Commands.helpRows(), keys = new Set();
  for (const [g, list] of rows){ ok(g && list.length, "empty group " + g); for (const [k, t] of list){ ok(k && t, `${g}: row ${k} / ${t}`); keys.add(k); } }
  const listed = rows.flatMap(([, list]) => list.map(r => r[0])).join(" / ");
  for (const c of Commands.LIST.filter(c => c.keys && c.keys.length)) ok(listed.includes(c.shortcut), `${c.id} (${c.shortcut}) not in the ? table`);
  ok(rows.some(([g]) => /Ribbon/.test(g)), "ribbon / palette group");
});

console.log("inventory (docs/prompts/prompt-9-design.md §1)");
// every entry point of the UI before round 9 (frozen list)
const OLD_ENTRIES = {
  "data-cmd": ["import", "new-cs", "open-proj", "save-proj", "save-proj-as", "new-proj", "pack", "export", "build", "sc-export", "sc-import", "settings"],
  "data-tool": ["point", "link", "shape", "polygon", "ngon", "arc", "fillet", "intersect", "offset", "array", "marked", "daylight", "follow", "extend",
                "clip", "level", "cutfill"],
  "data-tab": ["msg", "log", "pts", "logic", "ai"],
  "id": ["b-build", "b-edit", "edit-save", "edit-exit", "b-fit", "b-aux", "b-c3d", "dock-toggle", "drawer-hint", "ed-close", "ed-resize",
         "lw-resize", "rw-resize", "split-left"]
};
test("every old entry point maps to a command or is in the removed list", () => {
  for (const [kind, list] of Object.entries(OLD_ENTRIES)) for (const v of list){
    const to = (Commands.OLD[kind] || {})[v], rm = Commands.REMOVED[kind + ":" + v];
    ok(to || rm, `${kind}=${v}: no new place`);
    if (to) ok(Commands.get(to), `${kind}=${v} → unknown command ${to}`);
  }
  ok(Commands.REMOVED["my-shapes"], "My Shapes placeholder not listed");
  ok(Commands.REMOVED["fold:sc"], "Scenarios fold header not listed");
});
test("index.html: every data-cmd / data-tool still in the page has a command", () => {
  const html = fs.readFileSync(path.join(WWW, "index.html"), "utf8");
  for (const m of html.matchAll(/data-(cmd|tool)="([^"]+)"/g)){
    const to = Commands.OLD["data-" + m[1]][m[2]] || (m[1] === "cmd" && Commands.get(m[2]) && m[2]);
    ok(to || Commands.REMOVED[`data-${m[1]}:${m[2]}`], `data-${m[1]}="${m[2]}" has no command`);
  }
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);   // summary line read by test-all.js
process.exitCode = failed ? 1 : 0;
