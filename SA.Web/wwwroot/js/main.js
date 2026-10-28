// ติดตามไฟล์ในโฟลเดอร์, คีย์ลัด, เริ่มต้นหน้าเว็บ
"use strict";

// ติดตามไฟล์: โฟลเดอร์ (ผ่าน server ทุก 1 วินาที) และไฟล์ที่เปิดจากเครื่อง (ผ่าน file handle)
let lastMtime = {};
function poll(){
  const p = fetch("/api/files").then(r => r.json()).then(info => {
    $("folder").textContent = info.folder;
    $("welcome-folder").textContent = info.folder;
    projFiles = info.assemblies || [];
    const prev = lastMtime;
    files = info.files;
    lastMtime = Object.fromEntries(files.map(f => [f.name, f.mtime]));
    // ไฟล์ของตัวไหนถูกแก้จากโปรแกรมอื่น -> คำนวณใหม่ (ไฟล์ที่เปิดในแถบแก้: checkExternal จัดการเอง)
    if (allItems().some(it => it.file && prev[it.file] && prev[it.file] !== lastMtime[it.file] && !(editorActive() && ed.name === it.file))) flashReload();
    if (editorActive()) checkExternal();
    if (allItems().length && !Object.keys(asmRes).length && !inFlight) run();
  }).catch(() => setStatus("off", NO_SERVER));

  if (opened && opened.handle && !(editorActive() && state.file === OPENED)){
    opened.handle.getFile().then(f => {
      if (f.lastModified === opened.lastModified) return;
      opened.lastModified = f.lastModified;
      return f.text().then(t => {
        opened.text = t;
        for (const it of allItems()) if (!it.file && it.sourceName === opened.name) it.source = t;
        flashReload();
      });
    }).catch(() => {});
  }
  return p;
}
function flashReload(){
  run();
  const c = $("srv"); c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 1200);
}

document.addEventListener("keydown", e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.shiftKey && !e.altKey && (e.key === "e" || e.key === "E")){ e.preventDefault(); toggleEditor(); return; }
  if (mod && !e.shiftKey && !e.altKey && (e.key === "s" || e.key === "S")){
    e.preventDefault();
    // Edit mode (ไม่ได้พิมพ์อยู่ในแถบโค้ดของไฟล์) = Save ส่วนที่วาดลง .cs
    if (state.editing && !(ed.open && e.target.closest && e.target.closest("#ed") && ed.kind !== "generated")) saveDrawing(editItem());
    else if (ed.open) saveNow();
    return;
  }
  if (e.key === "Escape" && (!$("modal").hidden || !$("ctx").hidden || !$("dd-file").hidden)){ closeDialog(); closeMenus(); return; }
  if (["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName) || e.target.closest("#ed") || !$("modal").hidden) return;
  const k = e.key.toLowerCase(), editing = !!state.editing;
  // Edit mode: Undo / Redo / เครื่องมือวาด
  if (editing && mod && !e.altKey && (k === "z" || k === "y")){ e.preventDefault(); undoRedo(k === "y" || e.shiftKey); return; }
  if (editing && draw.tool && e.key === "Tab"){ e.preventDefault(); openTyping(); return; }
  if (editing && draw.tool && e.key === "Enter"){ e.preventDefault(); finishChain(); return; }
  if (e.key === "F8"){ e.preventDefault(); state.bar.ortho = !state.bar.ortho; persist(); renderBar(); }
  else if (e.key === "Escape"){
    if (draw.tool && draw.chain.length){ draw.chain = []; showBanner(drawBanner()); render(); }
    else if (draw.tool) setTool(null);
    else setAddMode(false);
  }
  else if (mod || e.altKey) return;
  else if (editing && (k === "p" || k === "l" || k === "s")) setTool({ p: "point", l: "link", s: "shape" }[k]);
  else if (k === "a") setAddMode(!addMode);
  else if (k === "f") fit();
  else if (e.key === "Delete" || e.key === "Backspace"){
    const s = state.sel, it = selItem();
    if (s.type === "spt") deleteSurfacePoint(s.i);
    else if (editing && it && it.id === state.editing && /^d(pt|link|shape)$/.test(s.type))
      deleteDrawn(it, { dpt: "point", dlink: "link", dshape: "shape" }[s.type], s.id);
  }
});

// ---------------- start ----------------
if (state.file === OPENED) state.file = null;   // ไฟล์ที่เปิดจากเครื่องไม่ถูกจำข้ามการรีเฟรช (subassembly ใช้โค้ดที่เก็บไว้แทน)
if (state.edWidth) document.body.style.setProperty("--edw", state.edWidth + "px");
renderBar(); renderScenarios(); renderEditorBar(); renderAll();
if (!allItems().length) setStatus("ok", "workspace ว่าง");
new ResizeObserver(() => render()).observe(main);
poll(); setInterval(poll, 1000);
if (state.editorOpen) openEditor();
