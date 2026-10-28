// แถบแก้โค้ด (Monaco) — ย้ายมาจากหน้าเดิมทั้งชุด ทำงานเหมือนเดิม
"use strict";

// พิมพ์แล้วรูปวาดใหม่เองหลังหยุดพิมพ์ RUN_DELAY และบันทึกลงไฟล์เองหลัง SAVE_DELAY
//   folder : ไฟล์ในโฟลเดอร์ของ viewer -> บันทึกผ่าน /api/save
//   handle : ไฟล์ที่เปิดด้วยปุ่ม Open ใน Chrome/Edge -> เขียนกลับผ่านสิทธิ์ของเบราว์เซอร์
//   memory : ไฟล์ที่เปิดด้วยปุ่ม Open ในเบราว์เซอร์อื่น -> แก้ได้ในเว็บ แต่ต้องกดดาวน์โหลดเอง
// ถ้าไฟล์ถูกแก้จากโปรแกรมอื่น: ในเว็บไม่มีอะไรค้างบันทึก -> โหลดฉบับใหม่ให้เอง
//                             ในเว็บมีส่วนที่ยังไม่บันทึก -> หยุดบันทึกอัตโนมัติแล้วให้เลือกว่าจะเก็บฉบับไหน
const MONACO_BASE = "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min";
const RUN_DELAY = 400, SAVE_DELAY = 900;
const ed = {
  open: false, key: null, name: null, kind: null, ready: false, loading: false,
  savedText: "", base: null,          // เนื้อหา/เวลาแก้ไขของไฟล์บนดิสก์ล่าสุดที่รู้
  dirty: false, saving: false, again: false, checking: false,
  conflict: null, error: null, hooked: false
};
let E = null, edLoading = null, saveT = 0, runT = 0, suppress = false;

function editorActive(){ return ed.open && !!E && ed.ready && !ed.loading && ed.key === fileKey(); }

function loadEditor(){
  if (edLoading) return edLoading;
  edLoading = new Promise(resolve => {
    let done = false;
    const finish = make => { if (!done){ done = true; resolve(make()); } };
    const fallback = () => finish(plainEditor);
    const timer = setTimeout(fallback, 15000);
    const s = document.createElement("script");
    s.src = MONACO_BASE + "/vs/loader.js";
    s.onerror = () => { clearTimeout(timer); fallback(); };
    s.onload = () => {
      const worker = `self.MonacoEnvironment={baseUrl:"${MONACO_BASE}/"};importScripts("${MONACO_BASE}/vs/base/worker/workerMain.js");`;
      window.MonacoEnvironment = { getWorkerUrl: () => URL.createObjectURL(new Blob([worker], { type: "text/javascript" })) };
      window.require.config({ paths: { vs: MONACO_BASE + "/vs" } });
      window.require(["vs/editor/editor.main"],
        monaco => { clearTimeout(timer); finish(() => monacoEditor(monaco)); },
        () => { clearTimeout(timer); fallback(); });
    };
    document.head.appendChild(s);
  });
  return edLoading;
}

function monacoEditor(monaco){
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const model = monaco.editor.createModel("", "csharp");
  const editor = monaco.editor.create($("ed-host"), {
    model, automaticLayout: true, theme: dark.matches ? "vs-dark" : "vs",
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace', fontSize: 13,
    minimap: { enabled: false }, scrollBeyondLastLine: false, tabSize: 4, insertSpaces: true,
    fixedOverflowWidgets: true, renderWhitespace: "selection"
  });
  dark.addEventListener("change", e => monaco.editor.setTheme(e.matches ? "vs-dark" : "vs"));
  const sev = { Error: monaco.MarkerSeverity.Error, Warning: monaco.MarkerSeverity.Warning };
  const eolOf = t => t.includes("\r\n") ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF;
  return {
    get: () => model.getValue(),
    set(text, keepUndo){
      if (keepUndo){
        // แยกเป็น undo ก้อนของตัวเอง: Ctrl+Z ครั้งเดียวกลับไปฉบับก่อนโหลด
        model.pushStackElement();
        model.pushEditOperations([], [{ range: model.getFullModelRange(), text }], () => null);
        model.pushStackElement();
      }
      else model.setValue(text);
      model.pushEOL(eolOf(text));     // คง CRLF/LF เดิมของไฟล์
    },
    onChange(cb){ model.onDidChangeContent(cb); },
    markers(list){
      const n = model.getLineCount();
      monaco.editor.setModelMarkers(model, "sa", list.map(m => {
        const line = Math.min(Math.max(m.line, 1), n);
        const endLine = Math.min(Math.max(m.endLine || line, line), n);
        let col = m.col || 1, endCol = m.endCol || 0;
        if (!m.col){ col = model.getLineFirstNonWhitespaceColumn(line) || 1; endCol = model.getLineMaxColumn(line); }
        if (endLine === line && endCol <= col) endCol = col + 1;
        return { startLineNumber: line, startColumn: col, endLineNumber: endLine, endColumn: endCol, message: m.message, severity: sev[m.severity] || sev.Error };
      }));
    },
    goto(line, col){ editor.revealLineInCenter(line); editor.setPosition({ lineNumber: line, column: col || 1 }); editor.focus(); },
    focus(){ editor.focus(); },
    readOnly(on){ editor.updateOptions({ readOnly: !!on }); }
  };
}

// ตัวแก้สำรองเมื่อโหลด Monaco ไม่ได้ (เช่น ไม่มีอินเทอร์เน็ต)
function plainEditor(){
  const ta = document.createElement("textarea");
  ta.spellcheck = false;
  $("ed-host").appendChild(ta);
  ta.addEventListener("keydown", e => {
    if (e.key === "Tab"){ e.preventDefault(); ta.setRangeText("    ", ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); }
  });
  let eol = "\n";
  return {
    plain: true,
    get: () => eol === "\n" ? ta.value : ta.value.replace(/\n/g, eol),
    set(text){ eol = text.includes("\r\n") ? "\r\n" : "\n"; ta.value = text.replace(/\r\n/g, "\n"); },
    onChange(cb){ ta.addEventListener("input", cb); },
    markers(){},
    goto(line){
      const lines = ta.value.split("\n");
      let p = 0;
      for (let i = 0; i < line - 1 && i < lines.length; i++) p += lines[i].length + 1;
      ta.focus(); ta.setSelectionRange(p, p);
      ta.scrollTop = Math.max(0, line - 6) * (ta.scrollHeight / Math.max(lines.length, 1));
    },
    focus(){ ta.focus(); },
    readOnly(on){ ta.readOnly = !!on; }
  };
}

function setText(text, keepUndo){ suppress = true; try{ E.set(text, keepUndo); } finally { suppress = false; } }

async function openEditor(){
  // ไฟล์จากปุ่ม Open: ขอสิทธิ์เขียนตอนที่ผู้ใช้เพิ่งคลิก (เบราว์เซอร์ยอมถามเฉพาะจังหวะนี้)
  if (state.file === OPENED && opened && opened.handle) await askWrite(opened.handle);
  ed.open = true; state.editorOpen = true; persist();
  document.body.classList.add("editing"); $("b-edit").classList.add("on");
  renderEditorBar();
  E = await loadEditor();
  if (!ed.hooked){ ed.hooked = true; E.onChange(onEdit); }
  if (!ed.open) return;
  ed.key = null;                     // บังคับโหลดเนื้อหาไฟล์ล่าสุด
  await loadDoc();
  if (ed.ready) E.focus();
}

function closeEditor(){
  flushSave();
  ed.open = false; state.editorOpen = false; persist();
  document.body.classList.remove("editing"); $("b-edit").classList.remove("on");
  renderProblem(); run();            // กลับไปแสดงจากไฟล์บนดิสก์
}
function toggleEditor(){ ed.open ? closeEditor() : openEditor(); }

async function loadDoc(){
  if (!ed.open || !E) return;
  const key = fileKey();
  if (ed.key === key && (ed.ready || ed.loading)) return;
  flushSave();
  Object.assign(ed, { key, name: null, kind: null, ready: false, loading: true, dirty: false, conflict: null, error: null, again: false });
  clearTimeout(saveT);
  E.markers([]);
  renderEditorBar();

  if (!state.file || (state.file === OPENED && !opened)){
    ed.loading = false; $("ed-empty").hidden = false; renderEditorBar(); return;
  }
  if (state.file === OPENED){
    ed.kind = opened.handle ? "handle" : "memory"; ed.name = opened.name;
    setText(opened.text); ed.savedText = opened.text; ed.base = opened.lastModified;
  } else if (state.file.startsWith(GENERATED)){
    // โค้ดที่สร้างจากส่วนที่วาด (ยังไม่มีไฟล์): อ่านอย่างเดียว อัปเดตตามการวาด
    const it = itemById(state.file.slice(GENERATED.length));
    const r = it && it.spec ? await fetchGenerated(it) : { ok: false, message: "ไม่มีส่วนที่วาด" };
    if (ed.key !== key) return;
    if (!r || !r.ok){ ed.loading = false; ed.error = r ? r.message : "server ไม่ตอบ"; renderEditorBar(); return; }
    ed.kind = "generated"; ed.name = it.fileName || it.spec.className + ".cs"; ed.genSpec = JSON.stringify(it.spec);
    setText(r.source); ed.savedText = r.source;
  } else {
    const r = await fetch("/api/source?file=" + encodeURIComponent(state.file)).then(r => r.json()).catch(() => null);
    if (ed.key !== key) return;      // ผู้ใช้เปลี่ยนไฟล์ระหว่างรอ
    if (!r || !r.ok){ ed.loading = false; ed.error = r ? r.message : "server ไม่ตอบ"; renderEditorBar(); return; }
    ed.kind = "folder"; ed.name = r.file;
    setText(r.source); ed.savedText = r.source; ed.base = r.mtime;
  }
  ed.loading = false; ed.ready = true;
  if (E.readOnly) E.readOnly(ed.kind === "generated");
  $("ed-empty").hidden = true;
  renderEditorBar(); renderProblem(); run();
}

const fetchGenerated = it => fetch("/api/drawing/code", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ spec: it.spec, fileName: it.fileName }) }).then(r => r.json()).catch(() => null);
// วาดแล้วโค้ดที่สร้างในแถบโค้ดเปลี่ยนตาม (หน่วงไว้นิดหน่อยระหว่างลาก)
let genT = 0;
function refreshGenerated(){
  if (!ed.open || ed.kind !== "generated" || !ed.ready) return;
  const it = itemById(state.file && state.file.startsWith(GENERATED) ? state.file.slice(GENERATED.length) : null);
  if (!it || !it.spec || ed.genSpec === JSON.stringify(it.spec)) return;
  clearTimeout(genT);
  genT = setTimeout(async () => {
    const key = ed.key, spec = JSON.stringify(it.spec), r = await fetchGenerated(it);
    if (ed.key !== key || !r || !r.ok) return;
    ed.genSpec = spec; setText(r.source, true); ed.savedText = r.source; applyMarkers();
  }, 400);
}

function onEdit(){
  if (suppress || !ed.ready) return;
  const text = E.get();
  ed.dirty = text !== ed.savedText;
  ed.error = null;
  if (state.file === OPENED && opened && ed.key === fileKey()) opened.text = text;
  renderEditorBar();
  clearTimeout(runT); runT = setTimeout(run, RUN_DELAY);
  if (ed.kind === "folder" || ed.kind === "handle"){ clearTimeout(saveT); saveT = setTimeout(save, SAVE_DELAY); }
}

async function askWrite(handle){
  try{
    if (await handle.queryPermission({ mode: "readwrite" }) === "granted") return true;
    return await handle.requestPermission({ mode: "readwrite" }) === "granted";
  }catch{ return false; }
}

async function save(force){
  clearTimeout(saveT);
  if (!ed.ready || !(ed.kind === "folder" || ed.kind === "handle")) return;
  if (!force && (!ed.dirty || ed.conflict)) return;
  if (ed.saving){ ed.again = true; return; }
  const key = ed.key, name = ed.name, text = E.get();
  ed.saving = true; ed.error = null; renderEditorBar();
  try{
    if (ed.kind === "folder"){
      const r = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: name, source: text, baseMtime: ed.base, force: !!force }) }).then(r => r.json());
      if (ed.key !== key) return;
      if (r.ok){ ed.savedText = text; ed.base = r.mtime; lastMtime[name] = r.mtime; ed.conflict = null; }
      else if (r.conflict) ed.conflict = { source: r.source, mtime: r.mtime };
      else ed.error = r.message || "บันทึกไม่ได้";
    } else {
      const h = opened.handle;
      const disk = await h.getFile();
      if (!force && disk.lastModified !== ed.base){
        const t = await disk.text();
        if (t !== ed.savedText && t !== text){ ed.conflict = { source: t, mtime: disk.lastModified }; return; }
      }
      if (!await askWrite(h)) throw new Error("เบราว์เซอร์ไม่ได้ให้สิทธิ์เขียนไฟล์นี้ (กดบันทึกอีกครั้งเพื่อขอสิทธิ์ หรือใช้ดาวน์โหลด)");
      const w = await h.createWritable();
      await w.write(text); await w.close();
      const f = await h.getFile();
      if (ed.key !== key) return;
      ed.savedText = text; ed.base = f.lastModified; ed.conflict = null;
      opened.text = text; opened.lastModified = f.lastModified;
    }
  }catch(e){
    if (ed.key === key) ed.error = (e && e.message) || "บันทึกไม่ได้";
  }finally{
    ed.saving = false;
    if (ed.key === key){
      ed.dirty = E.get() !== ed.savedText;
      renderEditorBar();
      if (ed.again || (ed.dirty && !ed.conflict && !ed.error)){ ed.again = false; saveT = setTimeout(save, 300); }
    }
  }
}
function saveNow(){
  if (ed.kind === "memory") return download();
  if (ed.kind === "generated") return saveDrawing(selItem());
  ed.error = null;
  save();
}
function flushSave(){ if (ed.ready && ed.dirty && !ed.conflict) save(); }

// ไฟล์ถูกแก้จากโปรแกรมอื่นหรือไม่ (เรียกจาก poll ทุก 1 วินาที)
async function checkExternal(){
  if (!editorActive() || ed.saving || ed.checking || ed.conflict) return;
  const key = ed.key;
  ed.checking = true;
  try{
    let disk = null;
    if (ed.kind === "folder"){
      const f = files.find(f => f.name === ed.name);
      if (!f || f.mtime === ed.base) return;
      const r = await fetch("/api/source?file=" + encodeURIComponent(ed.name)).then(r => r.json()).catch(() => null);
      if (r && r.ok) disk = { text: r.source, mtime: r.mtime };
    } else if (ed.kind === "handle"){
      const f = await opened.handle.getFile();
      if (f.lastModified === ed.base) return;
      disk = { text: await f.text(), mtime: f.lastModified };
    } else return;
    if (!disk || ed.key !== key || ed.saving) return;

    const cur = E.get();
    if (disk.text === ed.savedText || disk.text === cur){
      // ไม่ได้เปลี่ยนเนื้อหาจริง (เช่น เป็นผลของการบันทึกของเว็บเอง)
      ed.base = disk.mtime;
      if (disk.text === cur){ ed.savedText = cur; ed.dirty = false; }
    } else if (!ed.dirty){
      setText(disk.text, true);
      ed.savedText = disk.text; ed.base = disk.mtime;
      if (state.file === OPENED) { opened.text = disk.text; opened.lastModified = disk.mtime; }
      flashReload();
    } else {
      ed.conflict = { source: disk.text, mtime: disk.mtime };
      clearTimeout(saveT);
    }
    renderEditorBar();
  } finally { ed.checking = false; }
}

function renderEditorBar(){
  $("ed-name").textContent = ed.name || (ed.loading ? "…" : "—");
  let dot = "", txt = "บันทึกแล้ว", tip = "";
  if (!ed.ready && !ed.loading && !ed.error){ dot = "idle"; txt = "ยังไม่ได้เลือกไฟล์"; }
  else if (ed.loading){ dot = "busy"; txt = "กำลังโหลด…"; }
  else if (ed.conflict){ dot = "off"; txt = "ไฟล์ถูกแก้จากโปรแกรมอื่น"; }
  else if (ed.error){ dot = "off"; txt = ed.ready ? "บันทึกไม่ได้" : "เปิดไฟล์ไม่ได้"; tip = ed.error; }
  else if (ed.kind === "memory"){ dot = ed.dirty ? "busy" : "idle"; txt = ed.dirty ? "แก้ในเว็บ ยังไม่ได้ลงไฟล์ (กดดาวน์โหลด)" : "เบราว์เซอร์นี้บันทึกลงไฟล์เองไม่ได้"; }
  else if (ed.saving){ dot = "busy"; txt = "กำลังบันทึก…"; }
  else if (ed.kind === "generated"){ dot = "idle"; txt = "โค้ดที่สร้างจากการวาด (อ่านอย่างเดียว) · กด Save (.cs) เพื่อเขียนลงไฟล์"; }
  else if (ed.dirty){ dot = "busy"; txt = "ยังไม่บันทึก"; }
  if (E && E.plain) tip = (tip ? tip + "\n" : "") + "โหลดตัวแก้โค้ด Monaco ไม่ได้ (ไม่มีอินเทอร์เน็ต?) ใช้ช่องข้อความธรรมดาแทน";
  $("ed-dot").className = "dot " + dot;
  $("ed-txt").textContent = txt + (E && E.plain ? " · โหมดข้อความธรรมดา" : "");
  $("ed-state").title = tip || txt;
  $("ed-save").disabled = !ed.ready;
  $("ed-dl").disabled = !ed.ready;

  const c = $("ed-conflict");
  c.classList.toggle("on", !!ed.conflict);
  if (ed.conflict)
    $("ed-conflict-msg").innerHTML = `<b>${esc(ed.name)}</b> ถูกแก้จากโปรแกรมอื่นขณะที่ในเว็บมีส่วนที่ยังไม่บันทึก — หยุดบันทึกอัตโนมัติไว้ก่อน เลือกว่าจะเก็บฉบับไหน`;
}

function applyMarkers(){
  if (!E || !ed.ready) return;
  if (!editorActive() || !resp || resp.file !== ed.name){ E.markers([]); return; }
  const list = [];
  for (const d of (resp.ok ? resp.warnings : resp.diagnostics) || [])
    list.push({ line: d.line, col: d.column, endLine: d.endLine, endCol: d.endColumn, message: `${d.id}: ${d.message}`, severity: d.severity });
  if (resp.ok && result && result.exception){
    const m = /:line (\d+)/.exec(result.exception.stack || "");
    if (m) list.push({ line: +m[1], message: `${result.exception.type}: ${result.exception.message}`, severity: "Error" });
  }
  E.markers(list);
}

function download(){
  if (!E || !ed.ready) return;
  const blob = new Blob([E.get()], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = ed.name || "subassembly.cs"; a.click();
  URL.revokeObjectURL(a.href);
}

$("b-edit").onclick = toggleEditor;
$("ed-close").onclick = closeEditor;
$("ed-save").onclick = saveNow;
$("ed-dl").onclick = download;
$("ed-keep").onclick = () => { ed.conflict = null; save(true); };
$("ed-take").onclick = () => {
  const c = ed.conflict; if (!c) return;
  setText(c.source, true);
  Object.assign(ed, { savedText: c.source, base: c.mtime, conflict: null, dirty: false, error: null });
  if (state.file === OPENED){ opened.text = c.source; opened.lastModified = c.mtime; }
  renderEditorBar(); run(); E.focus();     // Ctrl+Z ย้อนกลับไปฉบับในเว็บได้
};
$("ed-keep").addEventListener("click", () => E && E.focus());
$("problem").addEventListener("click", e => {
  const d = e.target.closest("[data-line]");
  if (d && editorActive()) E.goto(+d.dataset.line, +(d.dataset.col || 1));
});

// ปรับความกว้างแถบโค้ด
$("ed-resize").addEventListener("pointerdown", e => {
  const x0 = e.clientX, w0 = $("ed").getBoundingClientRect().width;
  const move = ev => {
    state.edWidth = Math.round(Math.max(280, Math.min(innerWidth - 280 - 300 - 240, w0 + ev.clientX - x0)));
    document.body.style.setProperty("--edw", state.edWidth + "px");
  };
  const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); persist(); };
  addEventListener("pointermove", move); addEventListener("pointerup", up);
  e.preventDefault();
});

// ปิดหน้าเว็บระหว่างที่ยังไม่บันทึก: ไฟล์ในโฟลเดอร์ส่งบันทึกครั้งสุดท้าย, แบบอื่นให้เบราว์เซอร์ถามก่อน
addEventListener("beforeunload", e => {
  if (!ed.open || !ed.ready || !ed.dirty || ed.conflict) return;
  if (ed.kind === "folder")
    navigator.sendBeacon("/api/save", new Blob([JSON.stringify({ file: ed.name, source: E.get(), baseMtime: ed.base })], { type: "application/json" }));
  else { e.preventDefault(); e.returnValue = ""; }
});
