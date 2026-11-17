// Round 8: project folders on the page (docs/prompts/prompt-8-design.md).
//   ProjectV3 (pure, tested in node): workspace <-> project file v3. The .cs is the only source of a saved spec; an item
//     keeps a draft only for work that is not in a .cs yet (drawing not saved = ●, drawn item with no file, inline code).
//   Page part: start-up (re-open the tab's project / the last project), web file dialog, Open / Save / Save as / New /
//     Recent, app settings ("ตั้งค่า…"), migration questions, missing files + relink, title with the project name.
"use strict";

const ProjectV3 = (() => {
  const VERSION = 3;
  // workspace item -> v3 item. dirty(it) = its drawing differs from the .cs (drawingDirty)
  function itemOut(it, dirty){
    const o = { id: it.id };
    if (it.file) o.file = it.file;
    if (it.name) o.name = it.name;
    if (it.className) o.className = it.className;
    o.params = it.params || {};
    if (it.attach) o.attach = it.attach;
    let draft = null;
    if (it.file){ if (it.spec && dirty(it)) draft = { spec: it.spec }; }
    else if (it.spec) draft = it.fileName ? { fileName: it.fileName, spec: it.spec } : { spec: it.spec };
    else if (it.source != null) draft = it.sourceName ? { sourceName: it.sourceName, source: it.source } : { source: it.source };
    if (draft) o.draft = draft;
    return o;
  }
  // whole project file (ws = WS(), st = state for ground / bar values)
  function content(ws, st, dirty){
    const c = { version: VERSION, originElevation: st.originElevation, surface: st.surface, surfaceOn: st.surfaceOn, layout: st.layout,
                extendEnds: st.extendEnds, bar: st.bar,
                assemblies: ws.assemblies.map(a => ({ id: a.id, name: a.name, baseline: a.baseline, items: a.items.map(it => itemOut(it, dirty)) })),
                scenarios: ws.scenarios || [] };
    if (ws.styleFile) c.styleFile = ws.styleFile;           // round 10: written only after the user saved / opened a style file
    return c;
  }
  // v3 item -> workspace item. draftSpec is applied after the .cs spec is read (applyFileSpec)
  function itemIn(o){
    const it = { params: {}, ...o };
    delete it.draft;
    const d = o.draft || {};
    if (d.spec) it.draftSpec = d.spec;
    if (!o.file){
      if (d.fileName) it.fileName = d.fileName;
      if (d.source != null){ it.source = d.source; if (d.sourceName) it.sourceName = d.sourceName; }
    }
    return it;
  }
  // fileSpec = the sa-spec read from the item's .cs (null = none / no file); norm = Spec.normalize
  function applyFileSpec(it, fileSpec, edited, norm){
    if (fileSpec){
      // savedSpec normalized, as normItem does on load (so ● compares like with like)
      it.spec = norm(fileSpec); it.savedSpec = JSON.stringify(it.spec); it.generatedFile = true; it.specEdited = !!edited;
    }
    if (it.draftSpec){ it.spec = norm(it.draftSpec); }
    delete it.draftSpec;
    return it;
  }
  // answer to a migration question: "file" = use the .cs (drop the draft), "draft" = keep the project's drawing
  function answer(it, choice, norm){
    if (choice !== "file") return it;
    if (it.savedSpec) it.spec = norm(JSON.parse(it.savedSpec)); else delete it.spec;
    return it;
  }
  function hash(str){
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + ":" + str.length;
  }
  const join = (dir, name) => dir.replace(/[\\/]+$/, "") + "\\" + name;
  const samePath = (a, b) => !!a && !!b && a.replace(/\//g, "\\").toLowerCase() === b.replace(/\//g, "\\").toLowerCase();
  const baseName = p => (p || "").split(/[\\/]/).pop();
  const sepOf = files => files.some(f => f && f.includes("/")) && !files.some(f => f && f.includes("\\")) ? "/" : "\\";
  return { VERSION, itemOut, content, itemIn, applyFileSpec, answer, hash, join, samePath, baseName, sepOf };
})();

// ---------------- page ----------------
// while a scenario is active the project file gets the project's own values (Default), never the scenario's
function projContentV3(){
  const b = WS().scenarioBase;
  if (!b) return ProjectV3.content(WS(), state, drawingDirty);
  const ws = { ...WS(), assemblies: WS().assemblies.map(a => ({ ...a, items: a.items.map(it => b.params[it.id] ? { ...it, params: b.params[it.id] } : it) })) };
  return ProjectV3.content(ws, { ...state, surface: b.surface, surfaceOn: b.surfaceOn, layout: b.layout }, drawingDirty);
}
const projHashNow = () => ProjectV3.hash(JSON.stringify(projContentV3()));
const projDirty = () => !WS().savedHash || WS().savedHash !== projHashNow();
const projBaseName = () => (WS().name || "").replace(/\.assembly\.json$/i, "");
const getJson = url => rawFetch(url).then(r => r.json()).catch(() => null);

// title + header: project name, folder, * = changes not saved to the project file, read-only badge
function renderProjName(){
  const name = projBaseName(), dirty = (allItems().length || WS().path) && projDirty();
  $("proj-name").innerHTML = WS().path
    ? `project: <b>${esc(name)}</b>${dirty ? " *" : ""}${Proj.readOnly ? ' <span class="ro" title="โปรเจกต์นี้เปิดอยู่ในแท็บอื่น — บันทึกไม่ได้">อ่านอย่างเดียว</span>' : ""}`
    : `project: (ยังไม่ได้บันทึก)${dirty ? " *" : ""}`;
  $("proj-name").title = WS().path || "ยังไม่มีไฟล์โปรเจกต์ — ไฟล์ .cs ใหม่จะอยู่ในโฟลเดอร์ชั่วคราวของเครื่อง จนกว่าจะ Save project as";
  document.title = (WS().path ? name + (dirty ? " *" : "") + " — " : "") + "SA Drawing Studio";
}

// ---------- start-up ----------
// reload of this tab = keep its workspace, re-attach its project · fresh tab = the last project (setting "เปิดโปรเจกต์ล่าสุด"),
// keeping the backed-up workspace when it is that project (unsaved work after closing the browser) · else no project (scratch)
Proj.start = function(){
  const styleCalls = StyleNow.calls;
  this.opening = (async () => {
    this.settings = await getJson("/api/settings");
    const ws = WS();
    if (tabReloaded){
      const r = ws.path ? await this.post("/api/project/open", { path: ws.path, tab: TAB }) : null;
      if (r && r.ok){ this.use(r); if (r.readOnly) setStatus("warn", r.warning); return; }
      if (r) setStatus("warn", r.message);
      await toScratch(!!ws.path);
      return;
    }
    let target = null, keep = false;
    if (!ws.path && ws.name && allItems().length){
      // first start after round 8: the project of the old fixed folder
      const info = await getJson("/api/info");
      if (info && info.folder){ target = ProjectV3.join(info.folder, ws.name); keep = true; }
    } else if (this.settings && this.settings.reopenLast && this.settings.recent && this.settings.recent.length){
      target = this.settings.recent[0];
      keep = ProjectV3.samePath(ws.path, target);
    }
    if (target){
      const r = await this.post("/api/project/open", { path: target, tab: TAB });
      if (r.ok){
        this.use(r);
        if (keep && !r.readOnly){
          setProjectPath(r);
          if (r.fromVersion < ProjectV3.VERSION) WS().savedHash = null;      // the file is still v1 / v2: Save writes v3
          if (r.missing.length) setTimeout(() => showMissing(r.missing), 300);
          else setTimeout(maybeImportOldScenarios, 300);
          return;
        }
        await loadOpened(r, true);
        return;
      }
      setStatus("warn", r.message);
    }
    await toScratch(!!ws.path);
  })().finally(() => { this.opening = null; renderAll(); if (StyleNow.calls === styleCalls) loadStyle(); });   // once: loadOpened may have loaded it
  return this.opening;
};
// no project: a scratch folder. clear = the stored workspace belonged to a project that is not open
async function toScratch(clear){
  const s = await Proj.post("/api/project/scratch", { tab: TAB });
  if (s.ok) Proj.use(s);
  if (clear){
    WS().assemblies = [newAssembly("Assembly 1")];
    WS().name = null; WS().path = null; WS().dir = null; WS().scenarios = []; WS().savedHash = null; resetScenarioState();
    WS().styleFile = null; WS().styleDraft = null;
    asmRes = {}; state.editing = null; persist();
  }
}
function setProjectPath(r){
  WS().path = r.path; WS().dir = r.dir; WS().name = ProjectV3.baseName(r.path);
}

// ---------- open ----------
async function openProjectPath(path){
  const r = await Proj.post("/api/project/open", { path, tab: TAB });
  if (!r.ok){ alert(r.message || "เปิดโปรเจกต์ไม่สำเร็จ"); refreshSettings(); return false; }
  Proj.use(r);
  await loadOpened(r);
  if (r.readOnly) alert(r.warning);
  return true;
}
// v3 content from the server -> workspace (specs from the .cs files, drafts on top), then questions and missing files
async function loadOpened(r, quiet){
  const c = r.content;
  const asmList = (c.assemblies || []).map(a => ({ ...a, items: (a.items || []).map(ProjectV3.itemIn) }));
  const items = asmList.flatMap(a => a.items);
  const missing = new Set((r.missing || []).map(m => m.itemId));
  await Promise.all(items.map(async it => {
    let f = null;
    if (it.file && !missing.has(it.id)) f = await fetch("/api/drawing/spec?file=" + encodeURIComponent(it.file)).then(x => x.json()).catch(() => null);
    ProjectV3.applyFileSpec(it, f && f.ok ? f.spec : null, f && f.edited, s => Spec.normalize(s, []));
  }));
  WS().scenarios = c.scenarios || [];
  resetScenarioState();
  loadProjContent({ ...c, assemblies: asmList }, ProjectV3.baseName(r.path));
  WS().styleFile = c.styleFile || null; WS().styleDraft = null;
  setProjectPath(r);
  WS().savedHash = r.changed ? null : projHashNow();
  persist(); renderAll();
  loadStyle();
  if (!quiet) setStatus("ok", "เปิด " + projBaseName() + (r.fromVersion < ProjectV3.VERSION ? ` (แปลงจากรุ่น ${r.fromVersion} — Save project เพื่อเขียนเป็นรุ่น 3)` : ""));
  if (r.questions && r.questions.length) await askMigration(r.questions);
  if (r.missing && r.missing.length) showMissing(r.missing);
  else maybeImportOldScenarios();
}
function confirmLeave(what){
  return !(allItems().length && projDirty()) || confirm(`${what}? workspace ตอนนี้มีส่วนที่ยังไม่ได้ Save project (จะหายไป)`);
}
async function openProject(){
  if (!confirmLeave("เปิดโปรเจกต์อื่น")) return;
  const p = await fileDialog({ title: "Open project", mode: "open", exts: [".assembly.json"], start: WS().dir });
  if (p) await openProjectPath(p);
}

// ---------- save ----------
async function saveProject(asPath){
  if (Proj.readOnly){ alert("โปรเจกต์นี้เปิดอยู่ในแท็บอื่น — แท็บนี้บันทึกไม่ได้ (ใช้ Save project as… เพื่อบันทึกเป็นไฟล์ใหม่)"); if (!asPath) return; }
  if (!WS().path && !asPath) return saveProjectAs();
  // Save as: a default {project}.style.json that exists on disk (no key) keeps being used -> write the key so the server rebases it
  const keyBefore = WS().styleFile;
  if (asPath && !WS().styleFile && StyleNow.file && StyleNow.saved != null) WS().styleFile = StyleNow.file;
  const r = await fetch("/api/project/save", { method: "POST", headers: { "Content-Type": "application/json" },
                         body: JSON.stringify({ content: projContentV3(), path: asPath || null }) }).then(x => x.json()).catch(() => ({ ok: false, message: NO_SERVER }));
  if (!r.ok){ WS().styleFile = keyBefore; if (r.needPath) return saveProjectAs(); alert(r.message || "บันทึกไม่สำเร็จ"); return; }
  if (asPath){
    // paths of the items were rewritten relative to the new folder (same files on disk)
    for (const a of r.content.assemblies) for (const o of a.items){ const it = itemById(o.id); if (it && o.file) it.file = o.file; }
    if (WS().styleFile) WS().styleFile = r.content.styleFile || null;
    Proj.readOnly = false; WS().readOnly = false;
  }
  setProjectPath(r);
  WS().savedHash = projHashNow();
  if (asPath){
    // the style file path is relative to the project file: follow the rebased key (or the new default name), draft included
    const sf = WS().styleFile || styleFileName();
    StyleNow.file = sf;
    if (WS().styleDraft) WS().styleDraft.file = sf;
    else loadStyle();
  }
  persist(); await poll(); renderAll(); refreshSettings();
  setStatus("ok", "บันทึก " + projBaseName() + " แล้ว");
}
async function saveProjectAs(){
  const p = await fileDialog({ title: "Save project as", mode: "save", exts: [".assembly.json"], name: projBaseName() || "project",
                               start: WS().dir, nameLabel: "ชื่อไฟล์โปรเจกต์" });
  if (p) await saveProject(p);
}

// ---------- new ----------
async function newProject(){
  if (!confirmLeave("เริ่มโปรเจกต์ใหม่")) return;
  const p = await fileDialog({ title: "New project — เลือกโฟลเดอร์ที่จะสร้างโฟลเดอร์โปรเจกต์", mode: "folder", name: "",
                               nameLabel: "ชื่อโปรเจกต์ (สร้างโฟลเดอร์ชื่อนี้)", start: WS().dir ? WS().dir.replace(/[\\/][^\\/]+$/, "") : null });
  if (!p) return;
  const r = await Proj.post("/api/project/new", { parent: p.dir, name: p.name, tab: TAB });
  if (!r.ok){ alert(r.message); return; }
  Proj.use(r);
  await loadOpened(r);
  refreshSettings();
}

// ---------- recent projects + settings ----------
async function refreshSettings(){ Proj.settings = await getJson("/api/settings") || Proj.settings; renderRecent(); }
function renderRecent(){
  const box = $("dd-recent"); if (!box) return;
  const list = (Proj.settings && Proj.settings.recentInfo) || [];
  box.innerHTML = list.length ? '<div class="dd-h">โปรเจกต์ล่าสุด</div>' : "";
  for (const r of list){
    const b = document.createElement("button");
    b.disabled = !r.exists;
    b.innerHTML = `${esc(r.name)}<small>${r.exists ? esc(r.path.replace(/[\\/][^\\/]+$/, "")) : "หาไม่เจอ"}</small>`;
    b.title = r.path;
    b.onclick = async () => { closeMenus(); if (confirmLeave("เปิด " + r.name)) await openProjectPath(r.path); };
    box.appendChild(b);
  }
}
function openSettings(){
  const s = Proj.settings || {};
  openDialog("ตั้งค่า (เฉพาะเครื่องนี้)", b => {
    const row = (label, el, hint) => { const r = div("row wide-row", `<label>${label}</label>`, b); r.appendChild(el); if (hint) div("hint", hint, b); return el; };
    const text = (v, ph) => { const i = document.createElement("input"); i.type = "text"; i.value = v || ""; i.placeholder = ph || ""; i.className = "mono wide"; return i; };
    const check = v => { const i = document.createElement("input"); i.type = "checkbox"; i.checked = !!v; return i; };
    div("pg-h", "Build", b);
    const cOn = row("Copy to", check(s.copyToOn), null);
    const cPath = row("โฟลเดอร์ Copy to", text(s.copyTo, "เช่น D:\\test_cad\\C3D_Custom\\SA"),
      "หลัง build สำเร็จ คัดลอก DLL + .atc + icons ไปโฟลเดอร์นี้ (Trusted Location ของ Civil 3D) · เลือกหลายปี = คัดลอกเฉพาะปีล่าสุด");
    const c3d = row("Civil 3D (ถ้าไม่ได้อยู่ที่เดิม)", text(s.c3dInstall, "เช่น E:\\Autodesk\\AutoCAD 2027"),
      "ปกติหาเองใน C:\\Program Files\\Autodesk — ใส่เมื่อติดตั้งไว้ที่อื่น");
    div("pg-h", "โปรเจกต์", b);
    const reopen = row("เปิดโปรเจกต์ล่าสุดตอนเริ่ม", check(s.reopenLast !== false), null);
    const start = row("โฟลเดอร์เริ่มของหน้าต่างเลือกไฟล์", text(s.startFolder, s.startEffective || ""), null);
    let clear = false;
    const n = (s.recent || []).length;
    const clr = btn(`ล้างรายการโปรเจกต์ล่าสุด (${n})`, () => { clear = true; clr.disabled = true; clr.textContent = "จะล้างเมื่อกด บันทึก"; });
    clr.disabled = !n;
    div("btns", null, b).appendChild(clr);
    const note = div("hint", "ค่าเหล่านี้เก็บในเครื่อง (%LOCALAPPDATA%\\SA-Studio\\settings.json) ไม่อยู่ในไฟล์โปรเจกต์", b);
    note.classList.add("muted");
    div("btns", null, b).append(
      btn("บันทึก", async () => {
        const r = await rawFetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ copyTo: cPath.value.trim(), copyToOn: cOn.checked, c3dInstall: c3d.value.trim(), reopenLast: reopen.checked,
                                 startFolder: start.value.trim(), clearRecent: clear }) }).then(x => x.json()).catch(() => ({ ok: false, message: NO_SERVER }));
        if (!r.ok){ alert(r.message); return; }
        Proj.settings = r.settings; renderRecent(); closeDialog(); setStatus("ok", "บันทึกการตั้งค่าแล้ว");
      }),
      btn("ยกเลิก", cancelDialog));
  });
}

// ---------- web file dialog ----------
// o = { title, mode: "open" | "save" | "folder", exts: [".assembly.json"], name, nameLabel, start }
// open -> full path of a file · save -> folder + name (+ ext) · folder -> { dir, name } · cancel -> null
function fileDialog(o){
  return new Promise(resolve => {
    let cur = null, done = false, entries = [];
    const finish = v => { if (done) return; done = true; dlg.onCancel = null; closeDialog(); resolve(v); };
    openDialog(o.title, b => {
      $("modal").firstElementChild.classList.add("wide");
      const top = div("fd-top", null, b);
      const up = btn("↑", () => { if (cur) go(parentOf(cur)); }, false, "โฟลเดอร์แม่");
      const pathIn = document.createElement("input"); pathIn.type = "text"; pathIn.className = "mono fd-pathin"; pathIn.placeholder = "พิมพ์ / วาง path แล้วกด Enter";
      pathIn.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); const v = pathIn.value.trim(); if (/\.(assembly\.json|style\.json|cs)$/i.test(v) && o.mode === "open") finish(v); else go(v || null); } };
      top.append(up, pathIn);
      const wrap = div("fd", null, b);
      const side = div("fd-side", null, wrap), list = div("flist fd-list", null, wrap);
      let nameIn = null;
      if (o.mode !== "open"){
        const r = div("row wide-row", `<label>${esc(o.nameLabel || "ชื่อ")}</label>`, b);
        nameIn = document.createElement("input"); nameIn.type = "text"; nameIn.value = o.name || ""; nameIn.className = "wide";
        nameIn.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); ok(); } };
        r.appendChild(nameIn);
      }
      const note = div("hint fd-note", "", b);
      const okBtn = btn(o.mode === "open" ? "เปิด" : o.mode === "save" ? "บันทึก" : "สร้าง", () => ok());
      div("btns", null, b).append(okBtn, btn("ยกเลิก", cancelDialog));
      dlg.onCancel = () => { if (!done){ done = true; resolve(null); } };

      const ext = o.exts && o.exts[0] || "";
      const fits = n => !o.exts || o.exts.some(e => n.toLowerCase().endsWith(e));
      function parentOf(p){ const t = p.replace(/[\\/]+$/, ""); const i = t.search(/[\\/][^\\/]*$/); return i > 2 ? t.slice(0, i) : i === 2 ? t.slice(0, 3) : null; }
      let selected = null;
      function ok(){
        if (o.mode === "open"){ if (selected) finish(selected); else note.textContent = "เลือกไฟล์ก่อน"; return; }
        if (!cur){ note.textContent = "เลือกโฟลเดอร์ก่อน"; return; }
        let n = (nameIn.value || "").trim();
        if (!n){ note.textContent = "ใส่ชื่อก่อน"; nameIn.focus(); return; }
        if (/[\\/:*?"<>|]/.test(n)){ note.textContent = "ชื่อมีตัวอักษรที่ใช้ไม่ได้"; return; }
        if (o.mode === "folder") return finish({ dir: cur, name: n });
        if (ext && !n.toLowerCase().endsWith(ext)) n += ext;
        if (entries.some(e => e.kind !== "folder" && e.name.toLowerCase() === n.toLowerCase()) && !confirm(`มี ${n} อยู่แล้ว เขียนทับ?`)) return;
        finish(ProjectV3.join(cur, n));
      }
      function row(label, small, cls, onclick, ondbl){
        const x = document.createElement("button"); x.className = cls || "";
        x.innerHTML = `${label}${small ? `<small>${small}</small>` : ""}`;
        x.onclick = onclick; if (ondbl) x.ondblclick = ondbl;
        return x;
      }
      function renderSide(home){
        side.innerHTML = "";
        const add = (label, path, small, dis) => { const x = row(esc(label), small ? esc(small) : "", "", () => path && go(path)); x.disabled = !!dis; x.title = path || ""; side.appendChild(x); };
        div("dd-h", "ไดรฟ์", side);
        for (const e of (home || []).filter(e => e.kind === "drive")) add(e.name, e.path);
        const start = Proj.settings && Proj.settings.startEffective;
        if (start){ div("dd-h", "โฟลเดอร์เริ่ม", side); add(ProjectV3.baseName(start) || start, start); }
        const rec = (Proj.settings && Proj.settings.recentInfo) || [];
        if (rec.length){
          div("dd-h", "โปรเจกต์ล่าสุด", side);
          for (const r of rec){
            const dir = r.path.replace(/[\\/][^\\/]+$/, "");
            const x = row(esc(r.name), r.exists ? esc(ProjectV3.baseName(dir)) : "หาไม่เจอ", "", () => o.mode === "open" ? finish(r.path) : go(dir));
            x.disabled = !r.exists; x.title = r.path; side.appendChild(x);
          }
        }
      }
      async function go(p){
        const r = await getJson("/api/fs/list" + (p ? "?path=" + encodeURIComponent(p) : ""));
        if (!r || !r.ok){ note.textContent = r ? r.message : NO_SERVER; return; }
        note.textContent = "";
        cur = r.path; selected = null; entries = r.entries;
        pathIn.value = r.path || ""; up.disabled = !r.path;
        if (!r.path){ renderSide(r.entries); }
        list.innerHTML = "";
        if (!r.path){ div("empty", "เลือกไดรฟ์หรือโปรเจกต์ล่าสุดทางซ้าย หรือพิมพ์ path ด้านบน", list); return; }
        const shown = r.entries.filter(e => e.kind === "folder" || (o.mode !== "folder" && fits(e.name)));
        if (!shown.length) div("empty", o.mode === "folder" ? "ไม่มีโฟลเดอร์ย่อย" : "ไม่มีไฟล์ที่เปิดได้ในโฟลเดอร์นี้", list);
        for (const e of shown){
          if (e.kind === "folder"){ list.appendChild(row("📁 " + esc(e.name), "", "fd-folder", () => go(e.path))); continue; }
          const x = row(esc(e.name), e.size != null ? (e.size / 1024).toFixed(1) + " KB" : "", "", () => {
            [...list.children].forEach(c => c.classList.remove("on")); x.classList.add("on");
            selected = e.path;
            if (nameIn) nameIn.value = e.name.slice(0, e.name.length - (ext && e.name.toLowerCase().endsWith(ext) ? ext.length : 0));
          }, () => { selected = e.path; if (o.mode === "open") finish(e.path); else ok(); });
          list.appendChild(x);
        }
      }
      getJson("/api/fs/list").then(r => { if (r && r.ok) renderSide(r.entries); });
      go(o.start || (Proj.settings && Proj.settings.startEffective) || null);
    });
  });
}

// ---------- migration questions (decision 3) ----------
// the drawing in an old project file differs from its .cs and the .cs changed after the project was saved: which to keep
function askMigration(questions){
  return new Promise(resolve => {
    const choice = {};
    openDialog("ส่วนที่วาดไม่ตรงกับไฟล์ .cs", b => {
      div("hint", "ไฟล์โปรเจกต์รุ่นเก่าเก็บส่วนที่วาดไว้ด้วย และไม่ตรงกับใน .cs — เลือกว่าจะใช้ฉบับไหน (ฉบับในไฟล์โปรเจกต์จะเป็นงานที่ยังไม่ได้ Save ลง .cs ●)", b);
      for (const q of questions){
        const it = itemById(q.itemId); if (!it) continue;
        choice[q.itemId] = "draft";
        const r = div("mig-row", `<div><b>${esc(q.itemName || itemLabel(it))}</b> <span class="mono">${esc(q.file)}</span><br><small>${esc(q.reason)}</small></div>`, b);
        const sel = document.createElement("select");
        sel.innerHTML = `<option value="draft">ใช้ในไฟล์โปรเจกต์ (●)</option><option value="file">ใช้ใน .cs</option>`;
        sel.onchange = () => { choice[q.itemId] = sel.value; };
        r.appendChild(sel);
      }
      const done = () => {
        for (const id in choice){ const it = itemById(id); if (it) ProjectV3.answer(it, choice[id], s => Spec.normalize(s, [])); }
        dlg.onCancel = null; closeDialog(); persist(); run(); renderAll(); resolve();
      };
      div("btns", null, b).append(btn("ตกลง", done));
      dlg.onCancel = () => resolve();   // closing = keep the project's drawing (nothing lost)
    });
  });
}

// ---------- missing files + relink ----------
function showMissing(list){
  openDialog("ไฟล์หาย", b => {
    div("hint", "ไฟล์ที่โปรเจกต์อ้างถึงหาไม่เจอ — หาไฟล์ใหม่ (path จะเก็บแบบ relative จากไฟล์โปรเจกต์) หรือเปิดต่อไปก่อนก็ได้", b);
    for (const m of list){
      if (m.kind === "style"){ missingStyleRow(b, m, list); continue; }
      const it = itemById(m.itemId);
      const r = div("mig-row", "", b);
      const what = it && it.spec ? "มีส่วนที่วาดในไฟล์โปรเจกต์ (draft) — วาดต่อได้ แล้ว Save (.cs) เพื่อสร้างไฟล์ใหม่" : "แสดงเป็นกรอบว่างจนกว่าจะหาไฟล์เจอ";
      const label = m.itemName || (it && it.name) || "";
      const info = div("", `${label ? `<b>${esc(label)}</b> ` : ""}<span class="mono">${esc(m.file)}</span><br><small>${esc(what)}</small>`, r);
      const find = btn("หาไฟล์ใหม่…", async () => {
        const p = await fileDialog({ title: "หาไฟล์ใหม่: " + m.file, mode: "open", exts: [".cs"], start: WS().dir });
        if (!p){ showMissing(list); return; }
        const x = await fetch("/api/project/relink", { method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ path: p, sep: ProjectV3.sepOf(allItems().map(i => i.file)) }) }).then(y => y.json()).catch(() => ({ ok: false, message: NO_SERVER }));
        if (!x.ok){ alert(x.message); showMissing(list); return; }
        const cur = itemById(m.itemId);
        if (cur){
          // the new file's drawing is the saved state; a draft from the project stays on top (● only when it differs)
          cur.file = x.file;
          const f = await fetch("/api/drawing/spec?file=" + encodeURIComponent(x.file)).then(y => y.json()).catch(() => null);
          if (cur.spec) cur.draftSpec = cur.spec;
          if (f && f.ok && f.spec) ProjectV3.applyFileSpec(cur, f.spec, f.edited, s => Spec.normalize(s, []));
          else { delete cur.savedSpec; delete cur.draftSpec; }
        }
        const rest = list.filter(k => k !== m);
        persist(); await poll(); run(); renderAll();
        setStatus("ok", `${m.file} → ${x.file}${x.outside ? " (นอกโฟลเดอร์โปรเจกต์ — Pack จะ copy เข้ามาให้)" : ""}`);
        if (rest.length) showMissing(rest);
      });
      r.appendChild(find);
      info.style.flex = "1";
    }
    div("btns", null, b).append(btn("เปิดต่อ", () => { closeDialog(); maybeImportOldScenarios(); }));
  });
}

// the project's style file is missing (round 10): automatic colours until it is found; never blocks opening
function missingStyleRow(b, m, list){
  const r = div("mig-row", "", b);
  const info = div("", `<b>Style</b> <span class="mono">${esc(m.file)}</span><br><small>ใช้สีอัตโนมัติจนกว่าจะหาไฟล์เจอ</small>`, r);
  info.style.flex = "1";
  r.appendChild(btn("หาไฟล์ใหม่…", async () => {
    const p = await fileDialog({ title: "หาไฟล์ใหม่: " + m.file, mode: "open", exts: [".style.json"], start: WS().dir });
    if (!p || !/\.style\.json$/i.test(p)){ showMissing(list); return; }
    const done = await useStyleFile(p);
    const rest = done ? list.filter(k => k !== m) : list;
    if (rest.length) showMissing(rest); else closeDialog();
  }));
}

// ---------- Pack project (M4) ----------
// zip of the project file + referenced .cs (+ .png) + lib\ (+ build\ when ticked); outside files are copied in with
// rewritten paths in the zip only. Unsaved drawings: Save (.cs) first, or pack them as drafts (they are in the project file).
async function openPack(includeBuild){
  if (!WS().path){ alert("Save project ก่อน (ไฟล์ ▾ → Save project) — Pack ใช้ไฟล์โปรเจกต์"); return; }
  const post = body => fetch("/api/project/pack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(x => x.json()).catch(() => ({ ok: false, message: NO_SERVER }));
  const dry = await post({ content: projContentV3(), dryRun: true, includeBuild: !!includeBuild });
  if (!dry.ok){ alert(dry.message); return; }
  const unsaved = allItems().filter(it => it.spec && (it.file ? drawingDirty(it) : true));
  openDialog("Pack project — " + projBaseName(), b => {
    div("hint", "zip เดียวที่เอาไปเปิดเครื่องอื่นได้: แตก zip แล้ว ไฟล์ ▾ → Open project (เว็บไม่เปิด zip ตรงๆ) · โปรเจกต์ที่เปิดอยู่ไม่ถูกแก้", b);
    div("pg-h", `ไฟล์ใน zip (${dry.entries.length})`, b);
    const list = div("flist pk-list", null, b);
    const outside = new Map(dry.outside.map(o => [o.packedAs.replace(/\\/g, "/"), o.file]));
    for (const e of dry.entries){
      const from = outside.get(e);
      const x = div(from ? "pk-out" : "", `<span class="mono">${esc(e)}</span>${from ? `<small>อยู่นอกโฟลเดอร์โปรเจกต์ (${esc(from)}) — copy เข้ามา และแก้ path ใน zip</small>` : ""}`, list);
      x.title = from ? from : e;
    }
    for (const m of dry.missing) div("pk-miss", `<span class="mono">${esc(m)}</span><small>หาไม่เจอ — ไม่อยู่ใน zip</small>`, list);
    const bRow = div("row wide-row", "<label>รวม build\\ (DLL, .atc — สร้างใหม่ได้ ไม่จำเป็นต้องส่งต่อ)</label>", b);
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!includeBuild;
    cb.onchange = () => openPack(cb.checked);
    bRow.appendChild(cb);
    if (unsaved.length){
      const w = div("hint pk-warn", `มี ${unsaved.length} ตัวที่ส่วนที่วาดยังไม่ได้ Save (.cs) (●): ${esc(unsaved.map(itemLabel).join(", "))} — Pack พร้อม draft (อยู่ในไฟล์โปรเจกต์ เปิดแล้ววาดต่อได้) หรือ Save (.cs) ก่อน`, b);
      w.appendChild(btn("Save (.cs) ทั้งหมดก่อน", async () => {
        closeDialog();
        for (const it of unsaved) if (canSaveDrawing(it)) await saveDrawing(it);
        openPack(includeBuild);
      }));
    }
    div("btns", null, b).append(btn("Pack…", async () => {
      const start = WS().dir.replace(/[\\/][^\\/]+$/, "");
      const out = await fileDialog({ title: "บันทึก zip", mode: "save", exts: [".zip"], name: dry.defaultName.replace(/\.zip$/i, ""), start, nameLabel: "ชื่อไฟล์ zip" });
      if (!out){ openPack(includeBuild); return; }
      const r = await post({ content: projContentV3(), out, includeBuild: !!includeBuild });
      if (!r.ok){ alert(r.message); return; }
      setStatus("ok", `Pack แล้ว: ${r.zip} (${(r.bytes / 1024).toFixed(0)} KB, ${r.entries.length} ไฟล์${r.drafts ? `, draft ${r.drafts} ตัว` : ""})`);
      alert(`Pack แล้ว\n${r.zip}\n\n${r.entries.length} ไฟล์${r.outside.length ? ` · copy ไฟล์นอกโฟลเดอร์เข้ามา ${r.outside.length} ไฟล์` : ""}${r.missing.length ? ` · ไม่มีไฟล์ที่หาย ${r.missing.length} ไฟล์` : ""}`);
    }), btn("ยกเลิก", cancelDialog));
  });
}
