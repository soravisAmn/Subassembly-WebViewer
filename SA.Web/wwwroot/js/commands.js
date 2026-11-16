// Command registry (round 9): one place for each command's name, icon, shortcut, Thai tip, enable rule and handler.
// The ribbon, the ไฟล์ menu, Quick Access and the keyboard read from here (js/ribbon.js, main.js).
//   enabled(c) / active(c) take a plain context object c (built by ctxNow in ribbon.js) so node tests can check the rules
//   (SA.Tests/js/commands.test.js). run() calls the existing handlers; it only runs in the browser.
//   edit: true = contextual command (Draw / Modify / Logic / Finish): disabled outside Edit, keyboard ignores it outside Edit.
//   keys = normalised keyboard keys ("p", "ctrl+z", "delete", "f3"); shortcut = how the key is shown to the user.
//   keyIdle: true = the key is ignored while a Move / Copy / Rotate command runs (as before round 9).
//   keyRun = what the key does when it differs from the button (draw tools: key starts the tool, button toggles it).
"use strict";
const Commands = (() => {
  const NEED_EDIT = "เข้า Edit ก่อน (คลิกขวาที่ subassembly → Edit)";
  const IN_EDIT = "ออกจาก Edit ก่อน";

  const LIST = [
    // ---------- project / file ----------
    { id: "proj.new", label: "New", icon: "folder-plus", tip: "สร้างโฟลเดอร์โปรเจกต์ใหม่",
      run: () => newProject() },
    { id: "proj.open", label: "Open", icon: "folder-open", tip: "เปิดโปรเจกต์ (.assembly.json)",
      run: () => openProject() },
    { id: "proj.save", label: "Save", icon: "device-floppy", tip: "บันทึกไฟล์โปรเจกต์",
      enabled: c => c.readOnly ? "โปรเจกต์นี้เปิดอยู่ในแท็บอื่น — บันทึกไม่ได้" : true,
      run: () => saveProject() },
    { id: "proj.saveAs", label: "Save as", icon: "file-arrow-right", tip: "บันทึกโปรเจกต์เป็นไฟล์ / โฟลเดอร์ใหม่",
      run: () => saveProjectAs() },
    { id: "proj.pack", label: "Pack", icon: "file-zip", tip: "รวมโปรเจกต์และไฟล์ที่ใช้เป็น zip",
      run: () => openPack() },
    { id: "cs.import", label: "Import .cs", icon: "file-import", tip: "เปิดไฟล์ subassembly (.cs) เข้า workspace",
      run: () => openImport() },
    { id: "cs.new", label: "New .cs", icon: "file-code", tip: "สร้างไฟล์ .cs ใหม่จาก template",
      run: () => newCs() },
    { id: "settings", label: "ตั้งค่า", icon: "settings", tip: "ตั้งค่าเฉพาะเครื่องนี้ (Build, Copy to, โปรเจกต์ล่าสุด)",
      run: () => openSettings() },
    { id: "undo", label: "Undo", icon: "arrow-back-up", shortcut: "Ctrl+Z", keys: ["ctrl+z"], tip: "ย้อนการกระทำล่าสุด",
      enabled: c => c.undo ? true : "ไม่มีอะไรให้ย้อน",
      run: () => { if (!drag){ if (cmd.name) endCmd(); undoRedo(false); } } },
    { id: "redo", label: "Redo", icon: "arrow-forward-up", shortcut: "Ctrl+Y", keys: ["ctrl+y", "ctrl+shift+z", "ctrl+shift+y"], tip: "ทำซ้ำสิ่งที่ย้อนไป (Ctrl+Shift+Z ก็ได้)",
      enabled: c => c.redo ? true : "ไม่มีอะไรให้ทำซ้ำ",
      run: () => { if (!drag){ if (cmd.name) endCmd(); undoRedo(true); } } },

    // ---------- Home ----------
    { id: "asm.new", label: "New assembly", icon: "stack-2", tip: "เพิ่ม assembly ใหม่ใน workspace",
      enabled: c => c.editing ? IN_EDIT : true,
      run: () => addAsm() },
    { id: "asm.add", label: "Add subassembly", icon: "square-plus", tip: "ADD: สร้าง subassembly ใหม่ (ว่าง) ใน assembly ที่เลือก แล้วเข้า Edit",
      enabled: c => c.editing ? IN_EDIT : c.asm ? true : "เลือก assembly ก่อน",
      run: () => addDrawn(ribbonAsm()) },
    { id: "edit.enter", label: "Edit", icon: "pencil", tip: "เข้า Edit: วาดใน subassembly ที่เลือก",
      enabled: c => c.editing ? "อยู่ใน Edit แล้ว" : c.item ? true : "เลือก subassembly ก่อน",
      run: () => enterEdit(selItemId()) },
    { id: "item.mirror", label: "Mirror", icon: "flip-vertical", tip: "สำเนา subassembly ที่เลือกพร้อมตัวที่เกาะอยู่ สลับ Side",
      enabled: c => c.editing ? IN_EDIT : c.item ? true : "เลือก subassembly ก่อน",
      run: () => mirrorItem(selItemId()) },
    { id: "surf.add", label: "Add point", icon: "map-pin-plus", shortcut: "A", keys: ["a"], tip: "เพิ่มจุดบนเส้น surface (คลิกบนเส้น)",
      active: c => c.addMode,
      run: () => setAddMode(!addMode) },
    { id: "surf.reset", label: "Reset surface", icon: "restore", tip: "รีเซ็ตเส้น surface เป็นค่าเริ่มต้น",
      run: () => resetSurface() },
    { id: "clip.cut", label: "Cut", icon: "cut", shortcut: "Ctrl+X", keys: ["ctrl+x"], tip: "ตัดของที่เลือกไปคลิปบอร์ด",
      enabled: c => c.picked ? true : "ยังไม่ได้เลือก",
      run: () => { if (cmd.name) endCmd(); copyClip(true); } },
    { id: "clip.copy", label: "Copy", icon: "copy", shortcut: "Ctrl+C", keys: ["ctrl+c"], tip: "คัดลอกของที่เลือกไปคลิปบอร์ด",
      enabled: c => c.picked ? true : "ยังไม่ได้เลือก",
      run: () => { if (cmd.name) endCmd(); copyClip(false); } },
    { id: "clip.paste", label: "Paste", icon: "clipboard", shortcut: "Ctrl+V", keys: ["ctrl+v"], tip: "วางจากคลิปบอร์ด (คลิกจุดที่จะวาง)",
      enabled: c => c.clip ? true : "คลิปบอร์ดว่าง — Copy / Cut ก่อน",
      run: () => { if (cmd.name) endCmd(); startCmd("paste"); } },
    { id: "sel.delete", label: "Delete", icon: "trash", shortcut: "Delete", keys: ["delete", "backspace"], tip: "ลบของที่เลือก (Ctrl+Z ย้อนได้)",
      enabled: c => c.deletable ? true : "ยังไม่ได้เลือก",
      run: () => deleteSelection() },
    { id: "sel.all", label: "Select all", icon: "select-all", shortcut: "Ctrl+A", keys: ["ctrl+a"], tip: "เลือกทั้งหมด (Edit = ส่วนที่วาดของตัวที่แก้ · นอก Edit = ทุก subassembly)",
      run: () => selectAll() },

    // ---------- View ----------
    { id: "view.fit", label: "Fit", icon: "maximize", shortcut: "F", keys: ["f"], tip: "ดูทั้งหมด",
      run: () => fit() },
    { id: "view.zoomSel", label: "Zoom selection", icon: "zoom-in-area", shortcut: "Z", keys: ["z"], tip: "ซูมไปที่ของที่เลือก (ไม่มีที่เลือก = Fit)",
      run: () => zoomSel() },
    { id: "view.design", label: "Design", icon: "vector", tip: "ดูแบบวาด: เห็น Auxiliary และสิ่งช่วยวาดทั้งหมด",
      active: c => !c.bar.c3d,
      run: () => { if (state.bar.c3d) barClick("c3d"); } },
    { id: "view.c3d", label: "Civil 3D preview", icon: "road", tip: "ดูแบบ Civil 3D: เห็นเฉพาะที่จะส่งออกไปจริง (ปุ่ม ดูแบบ Civil 3D ที่แถบล่าง)",
      active: c => !!c.bar.c3d,
      run: () => { if (!state.bar.c3d) barClick("c3d"); } },
    { id: "view.aux", label: "Aux", icon: "line-dashed", tip: "แสดง / ซ่อน Auxiliary (ซ่อน = snap / คลุมเลือกไม่ได้)",
      active: c => !!c.bar.aux,
      run: () => barClick("aux") },
    { id: "view.codes", label: "Codes", icon: "tag", tip: "แสดง point code บนรูป",
      active: c => !!c.showCodes,
      run: () => barClick("codes") },
    { id: "view.grid", label: "Grid", icon: "grid-dots", tip: "แสดงเส้น grid",
      active: c => !!c.bar.grid,
      run: () => barClick("grid") },
    ...[1, 2, 5].map(n => ({ id: "view.ve" + n, label: "VE " + n, tip: `ขยายแนวดิ่ง ${n} เท่า (Vertical Exaggeration)`,
      active: c => c.ve === n,
      run: () => setVe(n) })),

    // ---------- Output ----------
    { id: "build", label: "Build", icon: "hammer", tip: "Build DLL สำหรับ Civil 3D จากไฟล์ .cs ของโปรเจกต์",
      run: () => openBuild() },
    { id: "code.edit", label: "Edit code", icon: "code", shortcut: "Ctrl+E", keys: ["ctrl+e"], tip: "แสดง / ซ่อนแถบแก้โค้ดของ subassembly ที่เลือก",
      active: c => c.edOpen,
      run: () => toggleEditor() },
    { id: "code.generated", label: "View generated code", icon: "file-code-2", tip: "ดูโค้ดที่สร้างจากส่วนที่วาด (ตัวที่ยังไม่มีไฟล์ .cs)",
      enabled: c => c.item && c.itemGenerated ? true : "เลือก subassembly ที่วาดแล้วแต่ยังไม่มีไฟล์ .cs",
      run: () => { setSel({ type: "item", item: selItemId() }); if (!ed.open) openEditor(); } },
    { id: "sc.export", label: "Export scenarios", icon: "table-export", tip: "บันทึก scenario ทั้งหมดเป็นไฟล์ .json",
      run: () => exportScenarios() },
    { id: "sc.import", label: "Import scenarios", icon: "table-import", tip: "อ่าน scenario จากไฟล์ .json เข้าโปรเจกต์",
      run: () => $("f-import").click() },

    // ---------- AI ----------
    { id: "ai.open", label: "Proposals", icon: "sparkles", tip: "เปิดแท็บ AI: ข้อเสนอจาก Claude (รับ / ปฏิเสธ)",
      run: () => { aiFocus(); renderDock(); renderAi(); } },
    { id: "ai.connect", label: "เชื่อม Claude", icon: "plug-connected", tip: "วิธีเชื่อม Claude Code / Claude Desktop กับหน้านี้ (MCP)",
      run: () => showConnectClaude() },

    // ---------- status bar (keys only; the buttons stay in the status bar) ----------
    { id: "bar.osnap", label: "OSNAP", shortcut: "F3", keys: ["f3"], tip: "Object snap เปิด / ปิด", run: () => toggleBar("osOn") },
    { id: "bar.ortho", label: "Ortho", shortcut: "F8", keys: ["f8"], tip: "ล็อกแนวราบ / ดิ่งตอนวาดจุดอิสระ", run: () => toggleBar("ortho") },
    { id: "bar.snap", label: "Grid snap", shortcut: "F9", keys: ["f9"], tip: "Grid snap (ดับเบิลคลิกปุ่ม = ตั้งระยะ)", run: () => toggleBar("snap") },
    { id: "bar.track", label: "Object snap tracking", shortcut: "F11", keys: ["f11"], tip: "ชี้ค้างบน snap = จับจุด · Esc = ล้าง", run: () => toggleBar("track") },
    { id: "help.keys", label: "Shortcut", shortcut: "? / F1", keys: ["?", "f1"], tip: "ตาราง shortcut", run: () => showShortcuts() },

    // ---------- contextual: Draw (ribbon in M2; keys work now) ----------
    ...[["point", "Point", "P", "จุด"], ["link", "Link", "L", "เส้นต่อจุด"], ["shape", "Shape", "S", "พื้นที่ปิดจาก link"],
        ["polygon", "Polygon", null, "คลิกจุดไปเรื่อยๆ แล้วปิดรูป = ได้จุด + link + shape"],
        ["ngon", "Regular Polygon", null, "คลิกจุดศูนย์กลาง แล้วลากรัศมี / มุม (Tab = พิมพ์ N, R, θ)"],
        ["arc", "Arc", null, "3 จุด (T) หรือ เริ่ม-ปลาย-รัศมี (E)"],
        ["daylight", "Slope to Surface", null, "ลาดจากจุดจนชนผิวดิน"],
        ["follow", "Follow Surface", null, "link ที่วิ่งตามผิวดินระหว่างสองจุด"],
        ["extend", "Extend to Surface", null, "ต่อปลาย link ที่ลอยเหนือดินลงไปชนดิน"],
        ["clip", "Clipped Surface Link", null, "ตามผิวดินแต่ไม่เกินเส้นอ้างอิง (ขอบล่างแบบ rock-pitching)"],
        ["cutfill", "Daylight Cut/Fill", null, "ถ้าตัด / ถม: ดินสูงกว่า = ลาดตัด · ดินต่ำกว่า = ลาดถม"],
        ["intersect", "Intersect", "I", "คลิก link 2 เส้น → T = ตัด / ยืด · N = ไม่ตัด"],
        ["offset", "Offset", "O", "ตั้งระยะ (Tab) → คลิก link → คลิกด้าน"],
        ["fillet", "Fillet", null, "ตั้งรัศมี (Tab) แล้วคลิก link 2 เส้นที่ต่อกันที่มุม"],
        ["array", "Array", null, "ทำซ้ำของที่เลือก N ชุด ห่างชุดละ dx, dy"]]
      .map(([t, label, key, tip]) => ({ id: "draw." + t, label, edit: true, tool: t, tip,
        // button = toggle the tool (as the Drawer) · key = start the tool (pressing P again restarts it, as before)
        ...(key ? { shortcut: key, keys: [key.toLowerCase()], keyRun: () => setTool(t) } : {}),
        active: c => c.tool === t,
        run: () => pickTool(t) })),
    { id: "draw.aux", label: "Auxiliary", edit: true, shortcut: "X", keys: ["x"], keyIdle: true,
      tip: "ระหว่างวาด = สลับโหมดของชิ้นที่จะสร้าง · มีของเลือก = สลับ point / link ที่เลือก",
      run: () => { if (draw.tool) toggleDrawAux(); else toggleAuxSel(); } },

    // ---------- contextual: Modify (Move / Copy also work outside Edit on subassemblies) ----------
    { id: "mod.move", label: "Move", shortcut: "M", keys: ["m"], tip: "คลิกจุดฐาน แล้วคลิกปลายทาง",
      run: () => startCmd("move") },
    { id: "mod.copy", label: "Copy", shortcut: "C", keys: ["c"], tip: "คลิกจุดฐาน แล้วคลิกปลายทาง (วางได้หลายครั้ง Enter = จบ)",
      run: () => startCmd("copy") },
    { id: "mod.rotate", label: "Rotate", shortcut: "R", keys: ["r"], tip: "คลิกจุดหมุน แล้วลากมุม / พิมพ์มุม · C = หมุนสำเนา · R = Reference",
      enabled: c => c.editing ? true : NEED_EDIT,
      run: () => startCmd("rotate") },

    // ---------- contextual: Logic ----------
    { id: "logic.params", label: "Parameters", edit: true, tip: "ตาราง Parameter ของตัวที่แก้ (ใน Properties)",
      run: () => { const e = editItem(); state.open["i:" + e.id] = true; setSel({ type: "params", item: e.id }); } },
    { id: "logic.vars", label: "Variables", edit: true, tip: "Variables ของตัวที่แก้ (ในต้นไม้ Workspace)",
      run: () => showVariables() },
    { id: "logic.conds", label: "Conditions", edit: true, tip: "เงื่อนไข / กิ่ง ของส่วนที่วาด (แท็บ Logic)",
      run: () => { state.dock.tab = "logic"; state.dock.open = true; persist(); renderDock(); } },
    { id: "logic.branch", label: "Draw into branch", edit: true, shortcut: "B", keys: ["b"], keyIdle: true,
      tip: "object ที่วาดต่อจากนี้เข้ากิ่งที่เลือก",
      run: () => chooseDrawBranch() },

    // ---------- contextual: Finish ----------
    { id: "finish.save", label: "Save (.cs)", edit: true, shortcut: "Ctrl+S", tip: "เขียนส่วนที่วาดลงไฟล์ .cs (ไม่ได้อยู่ใน Edit: Ctrl+S = บันทึกแถบโค้ด)",
      enabled: c => !c.editing ? NEED_EDIT : c.canSaveDrawing ? true : "ยังไม่มีส่วนที่วาดที่บันทึกได้",
      run: () => saveDrawing(editItem()) },
    { id: "finish.exit", label: "ออกจาก Edit", edit: true, tip: "จบการแก้ subassembly นี้",
      run: () => exitEdit() }
  ];

  const BY_ID = Object.fromEntries(LIST.map(c => [c.id, c]));
  const BY_KEY = {};
  for (const c of LIST) for (const k of c.keys || []) BY_KEY[k] = c;

  // ---------- where commands appear ----------
  // ribbon item: "id" (large) | ["id", "s"] (small) | { widget }
  const RIBBON = [
    { id: "home", label: "Home", panels: [
      { title: "Project", items: ["proj.new", "proj.open", "proj.save", ["proj.saveAs", "s"], ["proj.pack", "s"]] },
      { title: "Import", items: ["cs.import", ["cs.new", "s"]] },
      { title: "Assembly", items: ["edit.enter", ["asm.new", "s"], ["asm.add", "s"], ["item.mirror", "s"]] },
      { title: "Surface", items: [["surf.add", "s"], ["surf.reset", "s"]] },
      { title: "Clipboard", items: [["clip.cut", "s"], ["clip.copy", "s"], ["clip.paste", "s"], ["sel.delete", "s"], ["sel.all", "s"]] }] },
    { id: "view", label: "View", panels: [
      { title: "Navigate", items: ["view.fit", ["view.zoomSel", "s"]] },
      { title: "Mode", items: ["view.design", "view.c3d"] },
      { title: "Show", items: [["view.aux", "s"], ["view.codes", "s"], ["view.grid", "s"]] },
      { title: "VE", items: [["view.ve1", "s"], ["view.ve2", "s"], ["view.ve5", "s"]] },
      { title: "Scenario", items: [{ widget: "scenario" }] }] },
    { id: "output", label: "Output", panels: [
      { title: "Build", items: ["build"] },
      { title: "Code", items: ["code.edit", ["code.generated", "s"]] },
      { title: "Scenarios", items: [["sc.export", "s"], ["sc.import", "s"]] }] },
    { id: "ai", label: "AI", panels: [
      { title: "Proposals", items: ["ai.open"] },
      { title: "Claude", items: ["ai.connect", { widget: "aistatus" }] }] }
  ];
  // ไฟล์ application menu (same order as the old ไฟล์ ▾); "recent" = Recent projects submenu
  const FILE_MENU = ["cs.import", "cs.new", "-", "proj.open", "proj.save", "proj.saveAs", "proj.new", "proj.pack", "recent", "-",
                     "build", "-", "sc.export", "sc.import", "-", "settings"];
  const QUICK = ["proj.save", "undo", "redo"];
  // labels in the ไฟล์ menu (longer than the ribbon labels, as before round 9)
  const MENU_LABEL = { "cs.import": "Import .cs (เข้า workspace)…", "cs.new": "สร้าง .cs ใหม่จาก template…", "proj.open": "Open project…",
    "proj.save": "Save project", "proj.saveAs": "Save project as…", "proj.new": "New project… (โฟลเดอร์ใหม่)", "proj.pack": "Pack project… (zip)",
    "build": "Build… (DLL สำหรับ Civil 3D)", "sc.export": "Export scenarios (.json)", "sc.import": "Import scenarios…", "settings": "ตั้งค่า…" };

  // ---------- inventory (round 9 M0, docs/prompts/prompt-9-design.md §1): old entry point → command id ----------
  const OLD = {
    "data-cmd": { "import": "cs.import", "new-cs": "cs.new", "open-proj": "proj.open", "save-proj": "proj.save", "save-proj-as": "proj.saveAs",
                  "new-proj": "proj.new", "pack": "proj.pack", "build": "build", "sc-export": "sc.export", "sc-import": "sc.import", "settings": "settings" },
    "data-tool": { point: "draw.point", link: "draw.link", shape: "draw.shape", polygon: "draw.polygon", ngon: "draw.ngon", arc: "draw.arc",
                   fillet: "draw.fillet", intersect: "draw.intersect", offset: "draw.offset", array: "draw.array", daylight: "draw.daylight",
                   follow: "draw.follow", extend: "draw.extend", clip: "draw.clip", cutfill: "draw.cutfill" },
    "id": { "b-build": "build", "b-edit": "code.edit", "edit-save": "finish.save", "edit-exit": "finish.exit", "b-fit": "view.fit",
            "b-aux": "view.aux", "b-c3d": "view.c3d" }
  };
  const REMOVED = {
    "data-cmd:export": "Save / Export .cs… ไม่เคยใช้ได้ (Save (.cs) อยู่ใน Finish)",
    "data-tool:marked": "Marked point ไม่เคยใช้ได้",
    "data-tool:level": "Cut at Level ไม่เคยใช้ได้",
    "my-shapes": "My Shapes ไม่เคยใช้ได้ — Browser มาในรอบ 12",
    "id:dock-toggle": "ย่อ dock ล่าง — ใช้ปรับขนาด / ปิด palette แทน",
    "id:drawer-hint": "คำใบ้ใต้หัว Drawer — tooltip บอกแทน"
  };

  const get = id => BY_ID[id];
  const enabled = (id, c) => {
    const x = BY_ID[id]; if (!x) return "ไม่มีคำสั่งนี้";
    if (x.edit && !c.editing) return NEED_EDIT;
    return x.enabled ? x.enabled(c) : true;
  };
  const active = (id, c) => { const x = BY_ID[id]; return !!(x && x.active && x.active(c)); };
  // keyboard event → normalised key ("ctrl+shift+z", "p", "f3", "delete")
  //   Shift counts only with Ctrl (Shift+P = P, Shift+/ = ?, as before round 9)
  const keyOf = e => {
    const mod = e.ctrlKey || e.metaKey;
    return (mod ? "ctrl+" : "") + (mod && e.shiftKey ? "shift+" : "") + (e.altKey ? "alt+" : "") + e.key.toLowerCase();
  };
  const forKey = k => BY_KEY[k] || null;
  // the keyboard runs a command unless it is contextual outside Edit, or keyIdle while a Move / Copy / Rotate runs
  const keyAllowed = (x, c) => !(x.edit && !c.editing) && !(x.keyIdle && c.cmdRunning);
  // tooltip: name (shortcut) + Thai line + why it is disabled
  const tooltip = (id, c) => {
    const x = BY_ID[id], e = c ? enabled(id, c) : true;
    return `${x.label}${x.shortcut ? ` (${x.shortcut})` : ""}\n${x.tip}${e === true ? "" : `\nใช้ไม่ได้ตอนนี้: ${e}`}`;
  };
  return { LIST, RIBBON, FILE_MENU, QUICK, MENU_LABEL, OLD, REMOVED, get, enabled, active, keyOf, forKey, keyAllowed, tooltip };
})();
if (typeof module !== "undefined") module.exports = Commands;
