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
  if (e.key === "Escape" && (!$("modal").hidden || !$("ctx").hidden || !$("dd-file").hidden || !$("osmenu").hidden)){ closeDialog(); closeMenus(); return; }
  // F11 = Object snap tracking (แบบ AutoCAD) — กันเบราว์เซอร์เข้าเต็มจอ (ถ้าเบราว์เซอร์ยอม)
  if (e.key === "F11" && !e.target.closest("#ed")){ e.preventDefault(); toggleBar("track"); return; }
  if (["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName) || e.target.closest("#ed") || !$("modal").hidden) return;
  const k = e.key.toLowerCase(), editing = !!state.editing;
  // Space ค้าง + ลากปุ่มซ้าย = pan (กันหน้าเลื่อน / กดปุ่มที่ focus อยู่)
  if (e.key === " "){ e.preventDefault(); if (!e.repeat) setSpace(true); return; }
  // Ctrl+A = เลือกทั้งหมด (Edit mode: ส่วนที่วาดของตัวที่แก้ · นอก Edit: ทุก subassembly)
  if (mod && !e.shiftKey && !e.altKey && k === "a"){ e.preventDefault(); selectAll(); return; }
  // Undo / Redo ทุกการกระทำ: Ctrl+Z · Ctrl+Y / Ctrl+Shift+Z (ในช่องพิมพ์ / แถบโค้ด = undo ของช่องนั้นเอง)
  if (mod && !e.altKey && (k === "z" || k === "y")){ e.preventDefault(); if (!drag){ if (cmd.name) endCmd(); undoRedo(k === "y" || e.shiftKey); } return; }
  // คลิปบอร์ด (ในช่องพิมพ์ / แถบโค้ด = copy ข้อความปกติ เพราะ return ไปก่อนแล้ว)
  if (mod && !e.shiftKey && !e.altKey && (k === "c" || k === "x")){ e.preventDefault(); if (cmd.name) endCmd(); copyClip(k === "x"); return; }
  if (mod && !e.shiftKey && !e.altKey && k === "v"){ e.preventDefault(); if (cmd.name) endCmd(); startCmd("paste"); return; }
  // Move / Copy / Paste: Tab = snap ตัวถัดไป / พิมพ์ระยะ · พิมพ์ตัวเลข = พิมพ์ระยะ · Enter = จบการเลือก / จบ Copy
  if (cmdPlacing() && e.key === "Tab"){ e.preventDefault(); if (!cycleSnap()) openCmdTyping(); return; }
  if (cmd.stage === "dest" && !mod && !e.altKey && /^[0-9.\-]$/.test(e.key)){ e.preventDefault(); openCmdTyping(e.key); return; }
  if (cmd.name && e.key === "Enter"){ e.preventDefault(); cmdEnter(); return; }
  // Rotate ระหว่างระบุมุม: C = หมุนสำเนา · R = Reference (ตัวเลือกใน banner แบบ AutoCAD)
  if (cmd.name === "rotate" && cmd.stage === "dest" && !mod && !e.altKey && (k === "c" || k === "r")){ e.preventDefault(); rotOption(k); return; }
  // Esc ตอนมีจุดที่จับไว้ (Tracking) = ล้างจุดเหล่านั้นก่อน (กดอีกครั้ง = ยกเลิกแบบเดิม)
  if (e.key === "Escape" && trk.list.length){ trackClear(); flashBanner("Tracking: ล้างจุดที่จับไว้แล้ว"); refreshSnap(); render(); return; }
  if (cmd.name && e.key === "Escape"){ endCmd(); return; }
  if (e.key === "?" || e.key === "F1"){ e.preventDefault(); showShortcuts(); return; }
  // Tab: มี snap ให้เลือกหลายตัว = วนเลือก (แบบ AutoCAD) ไม่งั้น = พิมพ์ค่า · พิมพ์ตัวเลข = เปิดช่องพิมพ์ค่าเลย
  if (editing && draw.tool && e.key === "Tab"){ e.preventDefault(); if (!cycleSnap()) openTyping(); return; }
  if (editing && draw.tool && !mod && !e.altKey && /^[0-9.\-]$/.test(e.key)){ e.preventDefault(); openTyping(e.key); return; }
  if (editing && draw.tool && e.key === "Enter"){ e.preventDefault(); finishChain(); return; }
  if (e.key === "F3" || e.key === "F8" || e.key === "F9"){ e.preventDefault(); toggleBar({ F3: "osOn", F8: "ortho", F9: "snap" }[e.key]); }
  else if (e.key === "Escape"){
    if (draw.tool && draw.chain.length){ draw.chain = []; showBanner(drawBanner()); render(); }
    else if (draw.tool) setTool(null);
    else if (addMode) setAddMode(false);
    else if (drag && drag.type === "box"){ drag = null; render(); }
    else setSelList([]);                                    // ยกเลิกการเลือก
  }
  else if (mod || e.altKey) return;
  else if (editing && (k === "p" || k === "l" || k === "s")) setTool({ p: "point", l: "link", s: "shape" }[k]);
  // Arc: T = 3 จุด · E = เริ่ม-ปลาย-รัศมี (สลับระหว่างวาดได้ แบบตัวเลือกใน banner ของ AutoCAD)
  else if (editing && draw.tool === "arc" && (k === "t" || k === "e")) setArcMode(k === "t" ? "3p" : "ser");
  // C ระหว่างวาด Polygon อิสระ = ปิดรูป (แบบ Close ของ AutoCAD) · นอกนั้น C = Copy
  else if (k === "c" && editing && draw.tool === "polygon" && draw.chain.length){ if (draw.chain.length >= 3) closePolygon(); else flashBanner("Polygon ต้องมีอย่างน้อย 3 จุดก่อนปิดรูป (C)"); }
  else if (k === "m" || k === "c") startCmd(k === "m" ? "move" : "copy");
  else if (k === "r") startCmd("rotate");                    // Rotate (ส่วนที่วาด ใน Edit mode)
  // X = Auxiliary: ระหว่างวาด = สลับโหมดของชิ้นที่กำลังจะสร้าง · มีของเลือกอยู่ = สลับชุดที่เลือก (Ctrl+X = ตัด อยู่ด้านบน)
  else if (k === "x" && editing && !cmd.name){ if (draw.tool) toggleDrawAux(); else toggleAuxSel(); }
  else if (k === "a") setAddMode(!addMode);
  else if (k === "f") fit();
  else if (k === "z") zoomSel();                             // Zoom to selection (ไม่มีที่เลือก = Fit)
  else if (e.key === "Delete" || e.key === "Backspace") deleteSelection();
});

document.addEventListener("keyup", e => { if (e.key === " " && spaceDown){ setSpace(false); if (!["INPUT","SELECT","TEXTAREA"].includes(e.target.tagName)) e.preventDefault(); } });
window.addEventListener("blur", () => setSpace(false));

// ---------------- start ----------------
if (state.file === OPENED) state.file = null;   // ไฟล์ที่เปิดจากเครื่องไม่ถูกจำข้ามการรีเฟรช (subassembly ใช้โค้ดที่เก็บไว้แทน)
if (state.edWidth) document.body.style.setProperty("--edw", state.edWidth + "px");
allItems().forEach(normItem);   // spec รุ่นก่อน (construction) -> auxiliary
renderBar(); renderScenarios(); renderEditorBar(); renderAll();
History.reset();          // Undo เริ่มจากสภาพตอนเปิดหน้า (ไม่ข้ามการรีเฟรช)
if (!allItems().length) setStatus("ok", "workspace ว่าง");
new ResizeObserver(() => render()).observe(main);
poll(); setInterval(poll, 1000);
if (state.editorOpen) openEditor();
