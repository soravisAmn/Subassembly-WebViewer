// Round 8: project file v3 on the page side (ProjectV3 in SA.Web/wwwroot/js/project.js)
// รัน: node SA.Tests/js/project.test.js
"use strict";
const { ProjectV3 } = (() => {
  const fs = require("fs"), path = require("path"), vm = require("vm");
  // only the pure part (before the page part)
  const src = fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js/project.js"), "utf8").split("// ---------------- page")[0];
  const ctx = vm.createContext({ console });
  vm.runInContext(src + "\nthis.ProjectV3 = ProjectV3;", ctx);
  return ctx;
})();

let passed = 0, failed = 0;
function test(name, body){
  try{ body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const eq = (exp, act, what) => { if (exp !== act) throw new Error(`${what}: คาด ${exp} ได้ ${act}`); };
const J = o => JSON.stringify(o);

const spec = { className: "Box8", points: [{ id: "P1", codes: ["A", "B"] }] };
const spec2 = { className: "Box8", points: [{ id: "P1", codes: ["A"] }, { id: "P2", codes: [] }] };
const dirty = it => it.savedSpec !== J(it.spec);
const att = { type: "baseline", x: 0, y: 0 };

console.log("Project file v3 (page)");
test("item ที่ส่วนที่วาดตรงกับ .cs = ไม่มี spec / draft ในไฟล์โปรเจกต์", () => {
  const o = ProjectV3.itemOut({ id: "i1", file: "box.cs", params: { W: 3 }, attach: att, spec, savedSpec: J(spec), generatedFile: true, specEdited: false }, dirty);
  eq('{"id":"i1","file":"box.cs","params":{"W":3},"attach":{"type":"baseline","x":0,"y":0}}', J(o), "item");
});
test("ยังไม่ Save ลง .cs (●) = draft.spec · ไม่มีไฟล์ = draft { fileName, spec } · โค้ด inline = draft { sourceName, source }", () => {
  eq(J({ spec: spec2 }), J(ProjectV3.itemOut({ id: "a", file: "box.cs", spec: spec2, savedSpec: J(spec) }, dirty).draft), "dirty");
  eq(J({ fileName: "levee.cs", spec }), J(ProjectV3.itemOut({ id: "b", fileName: "levee.cs", spec }, dirty).draft), "drawn no file");
  eq(J({ spec }), J(ProjectV3.itemOut({ id: "b2", spec }, dirty).draft), "drawn no file, no name");
  eq(J({ sourceName: "x.cs", source: "// code" }), J(ProjectV3.itemOut({ id: "c", sourceName: "x.cs", source: "// code" }, dirty).draft), "inline");
  eq(undefined, ProjectV3.itemOut({ id: "d", file: "hand.cs" }, dirty).draft, "hand-written, no drawing");
});
test("content: version 3, assemblies ทุกตัว, scenarios ของโปรเจกต์คงไว้, ไม่มี spec / savedSpec / generatedFile", () => {
  const ws = { assemblies: [{ id: "a1", name: "A", baseline: { x: 0, y: 0 }, items: [{ id: "i1", file: "box.cs", spec, savedSpec: J(spec), generatedFile: true, params: {} }] },
                            { id: "a2", name: "B", baseline: { x: 30, y: 0 }, items: [] }],
               scenarios: [{ name: "Layout", mode: "layout" }] };
  const st = { originElevation: 100, surface: [{ x: 0, y: 0 }], surfaceOn: true, layout: false, extendEnds: true, bar: {} };
  const c = ProjectV3.content(ws, st, dirty);
  eq(3, c.version, "version");
  eq(2, c.assemblies.length, "assemblies");
  eq("Layout", c.scenarios[0].name, "scenarios");
  const t = J(c);
  for (const k of ["savedSpec", "generatedFile", "\"spec\""]) if (t.includes(k)) throw new Error("ยังมี " + k);
});
test("อ่านกลับ: draft บน spec ของ .cs = ● · ไม่มี draft = ใช้ .cs · ไฟล์หาย + draft = วาดต่อจาก draft · inline กลับมาเป็น source", () => {
  const norm = s => JSON.parse(J(s));
  const a = ProjectV3.applyFileSpec(ProjectV3.itemIn({ id: "a", file: "box.cs", params: {}, draft: { spec: spec2 } }), spec, false, norm);
  eq(J(spec2), J(a.spec), "spec = draft");
  eq(J(spec), a.savedSpec, "savedSpec = .cs");
  eq(true, dirty(a), "●");
  eq(undefined, a.draftSpec, "draftSpec ถูกลบ");
  const b = ProjectV3.applyFileSpec(ProjectV3.itemIn({ id: "b", file: "box.cs", params: {} }), spec, true, norm);
  eq(false, dirty(b), "ไม่ ●");
  eq(true, b.specEdited, "specEdited");
  const m = ProjectV3.applyFileSpec(ProjectV3.itemIn({ id: "m", file: "gone.cs", draft: { spec } }), null, false, norm);
  eq(J(spec), J(m.spec), "missing + draft");
  eq(undefined, m.savedSpec, "ไม่มี savedSpec");
  const n = ProjectV3.applyFileSpec(ProjectV3.itemIn({ id: "n", draft: { fileName: "levee.cs", spec } }), null, false, norm);
  eq("levee.cs", n.fileName, "fileName");
  const s = ProjectV3.itemIn({ id: "s", draft: { sourceName: "x.cs", source: "// code" } });
  eq("// code", s.source, "source");
  eq("x.cs", s.sourceName, "sourceName");
  eq(undefined, s.draft, "draft ไม่ค้างใน item");
});
test("round trip: itemOut(itemIn(x)) = x สำหรับทุกแบบของ draft", () => {
  const norm = s => JSON.parse(J(s));
  const cases = [
    { id: "a", file: "box.cs", params: { W: 1 }, attach: att },
    { id: "b", file: "box.cs", params: {}, attach: att, draft: { spec: spec2 } },
    { id: "c", name: "ร่าง", params: {}, attach: att, draft: { fileName: "levee.cs", spec } },
    { id: "d", params: {}, attach: att, draft: { sourceName: "x.cs", source: "// code" } },
  ];
  for (const x of cases){
    const it = ProjectV3.applyFileSpec(ProjectV3.itemIn(x), x.file ? spec : null, false, norm);
    eq(J(x), J(ProjectV3.itemOut(it, dirty)), "item " + x.id);
  }
});
test("คำตอบตอนแปลงไฟล์เก่า: ใช้ .cs = ทิ้ง draft · ใช้ในไฟล์โปรเจกต์ = คงไว้ · .cs ไม่มีส่วนที่วาด = ไม่มี spec", () => {
  const norm = s => JSON.parse(J(s));
  const it = () => ({ id: "x", file: "box.cs", spec: spec2, savedSpec: J(spec) });
  eq(J(spec), J(ProjectV3.answer(it(), "file", norm).spec), "ใช้ .cs");
  eq(J(spec2), J(ProjectV3.answer(it(), "draft", norm).spec), "ใช้ในไฟล์โปรเจกต์");
  eq(undefined, ProjectV3.answer({ id: "y", file: "hand.cs", spec: spec2 }, "file", norm).spec, ".cs เขียนเอง");
});
test("ตัวช่วย path / hash", () => {
  eq("D:\\p\\SR03.assembly.json", ProjectV3.join("D:\\p\\", "SR03.assembly.json"), "join");
  eq("D:\\x.cs", ProjectV3.join("D:\\", "x.cs"), "join ราก");
  eq(true, ProjectV3.samePath("d:/P/a.assembly.json", "D:\\p\\A.assembly.json"), "samePath");
  eq(false, ProjectV3.samePath(null, "D:\\a"), "samePath null");
  eq("SR03.assembly.json", ProjectV3.baseName("D:\\p\\SR03.assembly.json"), "baseName");
  eq("/", ProjectV3.sepOf(["a.cs", "lib/b.cs"]), "sep /");
  eq("\\", ProjectV3.sepOf(["a.cs", undefined]), "sep \\");
  eq(ProjectV3.hash("abc"), ProjectV3.hash("abc"), "hash เท่ากัน");
  if (ProjectV3.hash("abc") === ProjectV3.hash("abd")) throw new Error("hash ต่างกันต้องต่าง");
});

console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
if (failed) process.exitCode = 1;
