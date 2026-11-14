// Build dialog (round 7 M2): one DLL for Civil 3D from the .cs files of the open project.
//   "ไฟล์ ▾ → Build…" or the Build button on the menu bar. The server does the work (SA.Web/Build, docs/build.md):
//   /api/build/versions · /api/build/check (pre-build checks on the saved files) · /api/build · /api/build/settings (Copy-to)
//   Namespace / class of a web file: Logic API setClassName + Save (.cs) with rename (asks first). Hand-written: read-only.
"use strict";
const Build = (() => {
  const st = { project: null, versions: [], years: new Set(), files: null, allFiles: [], dllName: "", check: null, settings: { copyTo: "", copyToOn: false },
               busy: false, result: null, checking: false, seq: 0, atcFullPath: false, mode: "build", source: null, showReport: {} };
  const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(r => r.json()).catch(() => ({ ok: false, message: NO_SERVER }));
  const get = url => fetch(url).then(r => r.json()).catch(() => null);

  // Saved scenarios (browser) of the items whose file is built: ground relative to the item origin, as sa_check
  function savedScenarios(){
    const out = [];
    for (const s of scenarios){
      const w = s.ws || s.asm; if (!w) continue;
      const items = w.assemblies ? w.assemblies.flatMap(a => a.items || []) : (w.items || []);
      for (const si of items){
        if (!si.file) continue;
        const cur = itemById(si.id), o = cur ? itemOrigin(cur) : (si.attach && si.attach.x != null ? { x: si.attach.x, y: si.attach.y } : { x: 0, y: 0 });
        const sf = w.surface || [];
        out.push({ file: si.file, name: s.name, values: si.params || {}, layout: !!w.layout,
                   surface: w.surfaceOn !== false && sf.length >= 2 ? sf.map(p => ({ x: p.x - o.x, y: p.y - o.y })) : null });
      }
    }
    return out;
  }

  // Unsaved drawings of files in this build: the build uses the file on disk
  const unsaved = () => allItems().filter(it => it.file && drawingDirty(it) && (!st.check || st.check.files.includes(it.file)));

  async function open(){
    if (!WS().name){ alert("Save project ก่อน (ไฟล์ ▾ → Save project) — Build ใช้ไฟล์ project และไฟล์ .cs ที่บันทึกแล้ว"); return; }
    if (st.project !== WS().name){ st.project = WS().name; st.files = null; st.allFiles = []; st.dllName = ""; st.result = null; st.years.clear(); }
    openDialog("Build — " + st.project, b => { b.innerHTML = '<div class="hint">กำลังอ่าน…</div>'; });
    $("modal").firstElementChild.classList.add("wide");
    const [v, s] = await Promise.all([get("/api/build/versions"), get("/api/build/settings")]);
    st.versions = v && v.versions || [];
    if (s) st.settings = { copyTo: s.copyTo || "", copyToOn: !!s.copyToOn };
    if (!st.years.size){ const top = st.versions.filter(x => x.canBuild).map(x => x.year).sort().pop(); if (top) st.years.add(top); }
    await recheck();
  }

  async function recheck(){
    const seq = ++st.seq;
    st.checking = true; render();
    const r = await post("/api/build/check", { project: st.project, dllName: st.dllName || null, years: [...st.years], files: st.files, scenarios: savedScenarios() });
    if (seq !== st.seq) return;
    st.checking = false;
    if (r.message && !r.files){ st.check = null; render(r.message); return; }
    st.check = r;
    if (!st.dllName) st.dllName = r.dllName;
    if (!st.files){ st.files = r.files.slice(); st.allFiles = r.files.slice(); }
    render();
  }

  // ---------- render ----------
  function render(fatal){
    if ($("modal").hidden || !$("dlg-title").textContent.startsWith("Build")) return;
    const b = $("dlg-body"); b.innerHTML = "";
    if (fatal){ div("bd-err", esc(fatal), b); return; }
    const c = st.check;
    if (!c){ div("hint", "กำลังตรวจ…", b); return; }
    const issuesOf = f => c.issues.filter(i => i.file === f);

    // contents + class table
    div("pg-h", "สิ่งที่อยู่ใน DLL <small>(ไฟล์ .cs ของ project)</small>", b);
    const tb = document.createElement("table"); tb.className = "bd-table";
    tb.innerHTML = "<thead><tr><th></th><th>ไฟล์</th><th>namespace</th><th>class</th><th>ตรวจ</th></tr></thead>";
    const body = document.createElement("tbody"); tb.appendChild(body);
    const allFiles = st.allFiles.length ? st.allFiles : c.files;
    for (const f of allFiles){
      const on = !st.files || st.files.includes(f), cls = c.classes.filter(x => x.file === f), web = c.webFiles.includes(f);
      const iss = issuesOf(f), nErr = iss.filter(i => i.severity === "error").length, nWarn = iss.length - nErr;
      const rows = cls.length ? cls : [null];
      rows.forEach((k, idx) => {
        const tr = document.createElement("tr"); if (!on) tr.className = "off";
        const ck = document.createElement("td");
        if (idx === 0){
          const box = document.createElement("input"); box.type = "checkbox"; box.checked = on; box.title = "รวมไฟล์นี้ใน DLL";
          box.onchange = () => { st.files = box.checked ? allFiles.filter(x => x === f || (st.files || []).includes(x)) : (st.files || allFiles).filter(x => x !== f); recheck(); };
          ck.appendChild(box);
        }
        tr.appendChild(ck);
        const tdF = document.createElement("td"); tdF.className = "mono"; tdF.innerHTML = idx === 0 ? `${esc(f)}<small>${web ? "สร้างจากเว็บ" : "เขียนเอง"}</small>` : ""; tr.appendChild(tdF);
        const tdN = document.createElement("td"), tdC = document.createElement("td");
        if (k && web && on){
          const ns = input(k.namespace, "namespace"), cn = input(k.name, "class");
          const go = btn("เปลี่ยน", () => rename(f, k, ns.value.trim(), cn.value.trim()), true, "เปลี่ยนชื่อในส่วนที่วาด (Logic API) แล้ว Save (.cs)");
          const dirty = () => { go.disabled = ns.value.trim() === k.namespace && cn.value.trim() === k.name; };
          ns.oninput = cn.oninput = dirty;
          tdN.appendChild(ns); tdC.append(cn, go);
        } else {
          tdN.innerHTML = k ? `<span class="mono">${esc(k.namespace || "—")}</span>` : "—";
          tdC.innerHTML = k ? `<span class="mono">${esc(k.name)}</span>${web ? "" : '<small title="ไฟล์ที่เขียนเอง: แก้ชื่อในโค้ด">แก้ในโค้ด</small>'}` : "—";
        }
        tr.append(tdN, tdC);
        const tdS = document.createElement("td");
        tdS.innerHTML = !on ? "" : st.checking ? "…" : nErr ? `<span class="bd-e">✖ ${nErr}</span>` : nWarn ? `<span class="bd-w">⚠ ${nWarn}</span>` : '<span class="bd-ok">✓</span>';
        tr.appendChild(tdS);
        body.appendChild(tr);
      });
    }
    b.appendChild(tb);

    // export mode + DLL name
    const g = div("bd-grid", null, b);
    div("bd-l", "Export", g);
    const mv = div("bd-v", `<label title="build DLL บนเครื่องนี้ + .atc + icons + report"><input type="radio" name="bd-mode" value="build"> Build (DLL package)</label>
      <label title="zip ของไฟล์ .cs + .csproj + build.bat + .atc + icons + report ให้คนที่มี Civil 3D build เอง (ไม่มี DLL ของ Autodesk)"><input type="radio" name="bd-mode" value="source"> Source package</label>
      <label class="dis" title="ทดลองภายหลัง"><input type="radio" name="bd-mode" disabled> .pkt (ทดลองภายหลัง)</label>`, g);
    for (const r of mv.querySelectorAll("input[value]")){ r.checked = r.value === st.mode; r.onchange = () => { st.mode = r.value; render(); }; }
    div("bd-l", ".atc", g);
    const av = div("bd-v", null, g), al = document.createElement("label"), ac = document.createElement("input");
    ac.type = "checkbox"; ac.checked = st.atcFullPath; ac.onchange = () => { st.atcFullPath = ac.checked; };
    al.append(ac, " path แบบเต็ม");
    al.title = "ปกติ .atc อ้าง DLL ด้วยชื่อไฟล์ (อยู่โฟลเดอร์เดียวกัน) · ติ๊ก = อ้างด้วย path เต็มของโฟลเดอร์ที่ Civil 3D โหลด (Copy-to ถ้าเปิดไว้) — ใช้เมื่อ Civil 3D หา DLL ไม่เจอ";
    av.appendChild(al);
    av.insertAdjacentHTML("beforeend", "<small>ไม่ติ๊ก = ชื่อไฟล์ DLL อย่างเดียว (อยู่ข้าง .atc)</small>");
    div("bd-l", "ชื่อ DLL", g);
    const dv = div("bd-v", null, g);
    const dn = input(st.dllName, "ชื่อ DLL"); dn.classList.add("bd-dll");
    dn.onchange = () => { st.dllName = dn.value.trim(); st.result = null; recheck(); };
    dv.appendChild(dn); dv.insertAdjacentHTML("beforeend", '<small>.dll · ใช้ได้ A-Z a-z 0-9 _ - .</small>');

    // Civil 3D versions
    div("bd-l", "Civil 3D", g);
    const vv = div("bd-v", null, g);
    for (const v of st.versions){
      const l = document.createElement("label"); if (!v.canBuild) l.className = "dis";
      const x = document.createElement("input"); x.type = "checkbox"; x.disabled = !v.canBuild; x.checked = v.canBuild && st.years.has(v.year);
      x.onchange = () => { x.checked ? st.years.add(v.year) : st.years.delete(v.year); st.result = null; recheck(); };
      l.append(x, ` ${v.year}`);
      l.insertAdjacentHTML("beforeend", `<small>${v.canBuild ? esc(v.tfm) : esc(v.reason || "")}</small>`);
      l.title = v.path || v.reason || "";
      vv.appendChild(l);
    }
    if (!st.versions.length) vv.textContent = "ไม่พบ Civil 3D";

    // output folders
    div("bd-l", "Output", g);
    const ov = div("bd-v", null, g);
    const ys = c.years.filter(y => st.years.has(y.year));
    ov.innerHTML = ys.length ? ys.map(y => `<div class="mono bd-path">${esc(y.outDir)}</div>`).join("") : '<span class="hint">เลือก Civil 3D ก่อน</span>';

    // Copy to (machine setting)
    div("bd-l", "Copy to", g);
    const cv = div("bd-v", null, g);
    const cOn = document.createElement("input"); cOn.type = "checkbox"; cOn.checked = st.settings.copyToOn;
    const cPath = input(st.settings.copyTo, "เช่น D:\\test_cad\\C3D_Custom\\SA"); cPath.classList.add("bd-copy"); cPath.disabled = !cOn.checked;
    const save = async () => {
      const r = await post("/api/build/settings", { copyTo: cPath.value.trim(), copyToOn: cOn.checked });
      if (!r.ok){ alert(r.message); cOn.checked = false; cPath.disabled = true; return; }
      st.settings = { copyTo: cPath.value.trim(), copyToOn: cOn.checked };
      recheck();
    };
    cOn.onchange = () => { cPath.disabled = !cOn.checked; if (!cOn.checked || cPath.value.trim()) save(); else cPath.focus(); };
    cPath.onchange = save;
    const lab = document.createElement("label"); lab.append(cOn, " คัดลอก DLL + .atc + icons ไปที่ ");
    cv.append(lab, cPath);
    cv.insertAdjacentHTML("beforeend", "<small>ค่าของเครื่องนี้ (ไม่อยู่ในไฟล์ project) · คัดลอกหลัง build สำเร็จ · เลือกหลายปี = คัดลอกเฉพาะปีล่าสุด</small>");

    // checks
    const head = div("pg-h", `ตรวจก่อน build <small>${st.checking ? "กำลังตรวจ…" : `${c.scenarioRuns} scenario run · ${(c.ms / 1000).toFixed(1)} s`}</small>`, b);
    head.appendChild(btn("ตรวจอีกครั้ง", () => recheck(), st.checking || st.busy, "รันการตรวจทั้งหมดใหม่ (ไฟล์บนดิสก์)"));
    const list = div("bd-issues", null, b);
    const extra = unsaved().map(it => ({ severity: "warning", kind: "unsaved", file: it.file, message: `ส่วนที่วาดยังไม่ได้ Save (.cs) — build ใช้ไฟล์บนดิสก์ (กด Save (.cs) ก่อน)` }));
    const all = c.issues.concat(extra).sort((x, y) => (x.severity === "error" ? 0 : 1) - (y.severity === "error" ? 0 : 1));
    if (!all.length) div("bd-ok", "✓ ไม่พบปัญหา", list);
    for (const i of all){
      const d = div("bd-i " + (i.severity === "error" ? "e" : "w"), null, list);
      d.innerHTML = `<b>${i.severity === "error" ? "✖" : "⚠"}</b> ${i.file ? `<span class="mono">${esc(i.file)}</span> ` : ""}${esc(i.message)}`
        + (i.scenarios && i.scenarios.length ? `<small>${esc(i.scenarios.slice(0, 6).join(", "))}${i.scenarios.length > 6 ? ` … (${i.scenarios.length} กรณี)` : ""}</small>` : "");
    }

    // result of the last build / source package
    if (st.result && st.mode === "build") renderResult(div("bd-result", null, b), st.result);
    if (st.source && st.mode === "source") renderSource(div("bd-result", null, b), st.source);
    if (st.busy) div("bd-busy", `<span class="spin"></span> ${st.mode === "source" ? "กำลังสร้าง source package" : "กำลัง build"}… <span id="bd-sec">0</span> s${st.mode === "source" ? "" : " (ครั้งแรกใช้เวลานานกว่า)"}`, b);

    // buttons
    const errs = c.issues.some(i => i.severity === "error");
    const src = st.mode === "source";
    const reason = st.busy ? "กำลังทำงาน" : st.checking ? "กำลังตรวจ" : !src && !st.years.size ? "เลือก Civil 3D ก่อน" : !(st.files || []).length ? "ไม่ได้เลือกไฟล์" : errs ? "แก้ error ก่อน" : "";
    const bb = div("btns bd-btns", null, b);
    const go = src ? btn("สร้าง Source package", doSource, !!reason, reason || "zip สำหรับเครื่องที่มี Civil 3D (build.bat build เอง)")
                   : btn("Build", doBuild, !!reason, reason || "build DLL ตาม Civil 3D ที่เลือก");
    go.classList.add("primary");
    bb.append(go, btn("ปิด", () => closeDialog()));
    if (reason && !st.busy && !st.checking) bb.insertAdjacentHTML("beforeend", `<span class="hint">${esc(reason)}</span>`);
  }

  function input(v, ph){ const i = document.createElement("input"); i.type = "text"; i.value = v || ""; i.placeholder = ph || ""; i.spellcheck = false; return i; }

  function renderResult(box, r){
    for (const y of r.builds || []){
      const okY = y.status === "ok";
      const d = div("bd-i " + (okY ? "ok" : y.status === "skipped" ? "w" : "e"), null, box);
      d.innerHTML = `<b>${okY ? "✓" : "✖"}</b> Civil 3D ${y.year}: ${esc(y.message || y.status)}${okY ? ` <span class="mono">${esc(y.dll)}</span> · ${(y.ms / 1000).toFixed(1)} s` : ""}`;
      if (okY) d.appendChild(btn("คัดลอก path", () => navigator.clipboard && navigator.clipboard.writeText(y.dll)));
      if (okY && y.atc){
        const atc = y.copiedTo ? y.copiedTo.replace(/\\?$/, "\\") + y.atc.split("\\").pop() : y.atc;
        const a = div("bd-sub", `Tool Catalog: <span class="mono">${esc(atc)}</span> · ไอคอน ${y.icons} รูป — Civil 3D: CONTENTBROWSER → Add Catalog → เลือกไฟล์นี้`, box);
        a.appendChild(btn("คัดลอก path", () => navigator.clipboard && navigator.clipboard.writeText(atc)));
      }
      if (y.copiedTo) div("bd-sub", `คัดลอก DLL + .atc + icons ไป <span class="mono">${esc(y.copiedTo)}</span> แล้ว`, box);
      if (y.copyError) div("bd-i e", "✖ " + esc(y.copyError), box);
      if (y.report) reportToggle(box, "y" + y.year, y.report, y.reportPath);
      for (const e of (y.errors || []).slice(0, 30)) div("bd-sub mono", esc(e), box);
      if ((y.errors || []).length > 30) div("bd-sub", `… อีก ${y.errors.length - 30} (ดู build.log ใน ${esc(y.outDir)})`, box);
      if ((y.changes || []).length){
        div("bd-sub", "parameter เปลี่ยนจาก build ครั้งก่อน — ใน Civil 3D ต้องลบเครื่องมือเก่าออกจาก palette แล้วลากใหม่จาก catalog:", box);
        for (const ch of y.changes) div("bd-sub mono", esc(ch.text), box);
      }
      for (const w of y.warnings || []) div("bd-sub", "⚠ " + esc(w.message), box);
    }
    for (const i of (r.issues || []).filter(i => i.severity === "error")) div("bd-i e", "✖ " + esc(i.message), box);
  }

  // ---------- report (report.md shown in the dialog) ----------
  function reportToggle(box, key, md, path){
    const row = div("bd-sub", null, box);
    row.appendChild(btn(st.showReport[key] ? "ซ่อนรายงาน" : "ดูรายงาน", () => { st.showReport[key] = !st.showReport[key]; render(); }));
    if (path){ row.insertAdjacentHTML("beforeend", ` <span class="mono">${esc(path)}</span>`); row.appendChild(btn("คัดลอก path", () => navigator.clipboard && navigator.clipboard.writeText(path))); }
    if (st.showReport[key]) div("bd-report", mdHtml(md), box);
  }
  // Markdown of ReportWriter only: # headings, | tables |, - lists, 1. lists, `code`
  function mdHtml(md){
    const inl = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
    const out = []; let table = null, list = null;
    const flush = () => { if (table){ out.push("<table>" + table.join("") + "</table>"); table = null; } if (list){ out.push(`<${list.tag}>` + list.items.join("") + `</${list.tag}>`); list = null; } };
    for (const line of md.split(/\r?\n/)){
      if (/^\|/.test(line)){
        if (list) flush();
        if (/^\|[-| ]+\|$/.test(line)) continue;
        const cells = line.replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, "|"));
        (table = table || []).push("<tr>" + cells.map(c => (table.length ? "<td>" : "<th>") + inl(c) + (table.length ? "</td>" : "</th>")).join("") + "</tr>");
        continue;
      }
      const li = /^(-|\d+\.) (.*)$/.exec(line);
      if (li){
        if (table) flush();
        const tag = li[1] === "-" ? "ul" : "ol";
        if (list && list.tag !== tag) flush();
        (list = list || { tag, items: [] }).items.push("<li>" + inl(li[2]) + "</li>");
        continue;
      }
      flush();
      const h = /^(#{1,3}) (.*)$/.exec(line);
      if (h) out.push(`<h${h[1].length + 2}>${inl(h[2])}</h${h[1].length + 2}>`);
      else if (line.trim()) out.push("<p>" + inl(line) + "</p>");
    }
    flush();
    return out.join("");
  }

  function renderSource(box, r){
    if (!r.ok){ for (const i of r.issues || []) if (i.severity === "error") div("bd-i e", "✖ " + esc(i.message), box); if (r.message) div("bd-i e", "✖ " + esc(r.message), box); return; }
    const d = div("bd-i ok", `<b>✓</b> Source package: <span class="mono">${esc(r.zip)}</span>`, box);
    d.appendChild(btn("คัดลอก path", () => navigator.clipboard && navigator.clipboard.writeText(r.zip)));
    div("bd-sub", "ส่ง zip นี้ให้คนที่มี Civil 3D: แตกไฟล์ → ดับเบิลคลิก build.bat → Add Catalog (ขั้นตอนอยู่ใน README.txt)", box);
    for (const w of r.warnings || []) div("bd-sub", "⚠ " + esc(w.message), box);
    if (r.report) reportToggle(box, "source", r.report, null);
  }

  async function doSource(){
    if (st.busy) return;
    st.busy = true; st.source = null; render();
    const t0 = Date.now(), timer = setInterval(() => { const s = $("bd-sec"); if (s) s.textContent = Math.round((Date.now() - t0) / 1000); }, 500);
    const r = await post("/api/build/source", { project: st.project, dllName: st.dllName, years: [...st.years], files: st.files, scenarios: savedScenarios() });
    clearInterval(timer);
    st.busy = false; st.source = r;
    setStatus(r.ok ? "ok" : "err", r.ok ? `สร้าง ${st.dllName}-source.zip แล้ว` : "สร้าง source package ไม่สำเร็จ");
    render();
  }

  // ---------- Build ----------
  async function doBuild(){
    const c = st.check; if (!c || st.busy) return;
    const same = c.years.filter(y => st.years.has(y.year) && y.sameName.length);
    let allow = false;
    if (same.length){
      const where = same.map(y => `Civil 3D ${y.year}:\n` + y.sameName.map(p => "  " + p).join("\n")).join("\n");
      allow = confirm(`มี DLL ชื่อนี้อยู่แล้ว\n\n${st.dllName}.dll มีอยู่แล้วที่:\n${where}\n\n`
        + "ถ้า Civil 3D เคยโหลดตัวนั้นไปแล้วใน session นี้ จะโหลดตัวใหม่จากโฟลเดอร์อื่นไม่ได้ (subassembly .Net classes could not be found)\n"
        + "แนะนำ: ปิด Civil 3D ก่อน หรือใช้โฟลเดอร์ Copy-to เดียวกันเสมอ\n\nต้องการ build ทับต่อไหม?\nOK = build ต่อ · Cancel = ไม่ build");
      if (!allow) return;
    }
    st.busy = true; st.result = null; render();
    const t0 = Date.now(), timer = setInterval(() => { const s = $("bd-sec"); if (s) s.textContent = Math.round((Date.now() - t0) / 1000); }, 500);
    const r = await post("/api/build", { project: st.project, dllName: st.dllName, years: [...st.years], files: st.files, allowSameName: allow, atcFullPath: st.atcFullPath, scenarios: savedScenarios() });
    clearInterval(timer);
    st.busy = false; st.result = r;
    const okAll = r.ok && (r.builds || []).length;
    setStatus(okAll ? "ok" : "err", okAll ? `Build ${st.dllName}.dll สำเร็จ` : `Build ${st.dllName}.dll ไม่สำเร็จ`);
    await recheck();     // manifest / locked / same-name changed
  }

  // ---------- namespace / class of a web file ----------
  async function rename(file, k, ns, cn){
    const items = allItems().filter(it => it.file === file && it.spec);
    if (!items.length){ alert(`${file}: ยังไม่ได้เปิดส่วนที่วาดของไฟล์นี้ใน workspace — Import ไฟล์นี้ก่อน`); return; }
    const it = items[0];
    const dirtyNote = drawingDirty(it) ? "\n(ส่วนที่วาดที่ยังไม่ได้ Save จะถูก Save ไปด้วย)" : "";
    if (!confirm(`เปลี่ยนชื่อเป็น ${ns}.${cn}\n\nต้อง Save ไฟล์ ${file} ด้วย (ชื่อในไฟล์เปลี่ยนตาม)${dirtyNote}\n\nOK = เปลี่ยนแล้ว Save · Cancel = ไม่เปลี่ยน`)) return;
    History.act(`เปลี่ยนชื่อ ${k.namespace}.${k.name} → ${ns}.${cn}`);
    for (const x of items){
      const r = Logic.setClassName(x.spec, { className: cn, namespace: ns });
      if (!r.ok){ alert(r.error); return; }
    }
    persist();
    await saveDrawing(it, { rename: true });
    await recheck();
  }

  return { open, recheck };
})();

function openBuild(){ Build.open(); }
$("b-build").onclick = openBuild;
