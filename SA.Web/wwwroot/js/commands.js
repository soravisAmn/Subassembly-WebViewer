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
  // Draw tab icons: the Drawer SVGs (viewBox 0 0 28 22, classes styled in css/app.css) — drawn for these tools, Tabler has nothing as clear
  const TOOL_SVG = {
    point: "<circle cx=\"14\" cy=\"11\" r=\"3\" class=\"fill\"/><path d=\"M14 3v4M14 15v4M6 11h4M18 11h4\"/>",
    link: "<path d=\"M5 17L23 5\"/><circle cx=\"5\" cy=\"17\" r=\"2.2\" class=\"hollow\"/><circle cx=\"23\" cy=\"5\" r=\"2.2\" class=\"hollow\"/>",
    shape: "<path d=\"M4 6H24L20 17H8Z\" class=\"tint\"/>",
    polygon: "<path d=\"M5 17L4 7L13 3L24 8L20 18Z\" class=\"tint\"/><circle cx=\"5\" cy=\"17\" r=\"1.6\" class=\"hollow\"/><circle cx=\"4\" cy=\"7\" r=\"1.6\" class=\"hollow\"/><circle cx=\"13\" cy=\"3\" r=\"1.6\" class=\"hollow\"/><circle cx=\"24\" cy=\"8\" r=\"1.6\" class=\"hollow\"/><circle cx=\"20\" cy=\"18\" r=\"1.6\" class=\"hollow\"/>",
    ngon: "<path d=\"M14 2L23 8.5L19.6 19H8.4L5 8.5Z\" class=\"tint\"/><path d=\"M12.5 11H15.5M14 9.5V12.5\"/>",
    arc: "<path d=\"M4 18C6 8 22 8 24 18\"/><circle cx=\"4\" cy=\"18\" r=\"1.8\" class=\"hollow\"/><circle cx=\"14\" cy=\"10.5\" r=\"1.6\" class=\"hollow\"/><circle cx=\"24\" cy=\"18\" r=\"1.8\" class=\"hollow\"/>",
    fillet: "<path d=\"M4 4V12\" /><path d=\"M12 19H24\"/><path d=\"M4 12C4 16 8 19 12 19\" class=\"warm\"/><path d=\"M4 12V19H12\" stroke-dasharray=\"2 2\"/>",
    intersect: "<path d=\"M4 18L16 6\"/><path d=\"M4 6L14 12\" /><path d=\"M14 12L24 18\" stroke-dasharray=\"2 2\"/><circle cx=\"12.3\" cy=\"10.8\" r=\"2.4\" class=\"good\"/>",
    offset: "<path d=\"M4 17L22 5\"/><path d=\"M7 21L25 9\" class=\"warm\"/><path d=\"M13 11L15.5 14.5\" stroke-dasharray=\"1.5 1.5\"/>",
    array: "<path d=\"M3 4H8V8\"/><path d=\"M8 8H13V12\" class=\"warm\"/><path d=\"M13 12H18V16\" class=\"warm\"/><path d=\"M18 16H23V20\" class=\"warm\"/>",
    daylight: "<path d=\"M2 18H26\" class=\"ground\"/><path d=\"M5 4L17 18\" stroke-dasharray=\"3 2\"/><circle cx=\"5\" cy=\"4\" r=\"2\" class=\"hollow\"/><circle cx=\"17\" cy=\"18\" r=\"2.4\" class=\"good\"/>",
    follow: "<path d=\"M2 12L8 15L14 10L20 16L26 13\" class=\"ground\"/><path d=\"M8 15L14 10L20 16\" class=\"goodline\"/>",
    extend: "<path d=\"M2 18L10 15L18 17L26 14\" class=\"ground\"/><path d=\"M6 3L13 10\"/><path d=\"M13 10L18 16\" stroke-dasharray=\"2 2\" class=\"goodline\"/><circle cx=\"13\" cy=\"10\" r=\"1.8\" class=\"hollow\"/><circle cx=\"18\" cy=\"16.5\" r=\"2\" class=\"good\"/>",
    clip: "<path d=\"M2 8L9 17L16 9L26 14\" class=\"ground\"/><path d=\"M2 12H26\" stroke-dasharray=\"2 2\"/><path d=\"M4 10.5L5.3 12H12.5L16 9L20 11L22.6 12\" class=\"goodline\"/>",
    cutfill: "<path d=\"M14 2L24 11L14 20L4 11Z\"/><text x=\"14\" y=\"14\" text-anchor=\"middle\">?</text>",
    // Annotate tab (round 10 M2)
    dimH: "<path d=\"M5 4V18M23 4V18M5 13H23\"/><path d=\"M5 13L9 11V15ZM23 13L19 11V15Z\" class=\"fill\"/>",
    dimV: "<path d=\"M6 3H20M6 19H20M14 3V19\"/><path d=\"M14 3L12 7H16ZM14 19L12 15H16Z\" class=\"fill\"/>",
    dimA: "<path d=\"M3 14L7 19M19 3L23 8M7 19L23 8\"/><path d=\"M7 19L9.3 15.6L11 18.1ZM23 8L20.7 11.4L19 8.9Z\" class=\"fill\"/>",
    slope: "<path d=\"M3 18L25 6\"/><path d=\"M15 18.5H25V12\" stroke-dasharray=\"2 2\"/><circle cx=\"10\" cy=\"9\" r=\"2\" class=\"fill\"/>",
    // round 10 M3: note (text lines), note with leader (arrow to a point), point names (P1 beside a point)
    note: "<path d=\"M6 6H22M6 11H22M6 16H16\"/>",
    noteL: "<path d=\"M12 6H25M12 11H22\"/><path d=\"M11 9L4 18\"/><path d=\"M4 18L5 13.8L7.6 15.8Z\" class=\"fill\"/>",
    ptnames: "<path d=\"M3 13H8V18H3Z\" class=\"fill\"/><text x=\"10\" y=\"11\">P1</text>"
  };
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
    { id: "redo", label: "Redo", icon: "arrow-forward-up", shortcut: "Ctrl+Y / Ctrl+Shift+Z", keys: ["ctrl+y", "ctrl+shift+z", "ctrl+shift+y"], tip: "ทำซ้ำสิ่งที่ย้อนไป",
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
    { id: "view.style", label: "Style", icon: "palette", tip: "ใช้ style by code (.style.json + ค่าเฉพาะชิ้น) · ปิด = สีอัตโนมัติ (ดูแบบ Civil 3D = สีกลางเสมอ)",
      active: c => c.bar.style !== false,
      run: () => barClick("style") },
    { id: "view.annot", label: "Annotations", svg: TOOL_SVG.dimH, tip: "แสดง / ซ่อน note, dimension, slope label (ซ่อนเฉยๆ ไม่ลบ · ดูแบบ Civil 3D = ซ่อนเสมอ)",
      active: c => c.bar.annot !== false,
      run: () => barClick("annot") },
    { id: "view.ptnames", label: "Point names", svg: TOOL_SVG.ptnames, tip: "แสดงชื่อจุด P1, P2 … ของส่วนที่วาด (#ลำดับ ของโค้ดที่เขียนเอง) แม้ไม่ได้ Edit (ดูแบบ Civil 3D = ซ่อนเสมอ)",
      active: c => !!c.bar.ptnames,
      run: () => barClick("ptnames") },
    { id: "view.grid", label: "Grid", icon: "grid-dots", tip: "แสดงเส้น grid",
      active: c => !!c.bar.grid,
      run: () => barClick("grid") },
    ...[1, 2, 5].map(n => ({ id: "view.ve" + n, label: "VE " + n, tip: `ขยายแนวดิ่ง ${n} เท่า (Vertical Exaggeration)`,
      active: c => c.ve === n,
      run: () => setVe(n) })),

    // ---------- Annotate (round 10 M2 / M3): always visible, works outside Edit; no single-letter keys ----------
    ...[["note", "note", "Note", "ข้อความผูกกับจุด: คลิกจุด → คลิกวางข้อความ → พิมพ์ ({Hcrest} = แสดงค่า)"],
        ["noteL", "noteL", "Note with leader", "ข้อความมีเส้นชี้ไปที่จุด: คลิกจุด → คลิกวางข้อความ → พิมพ์"],
        ["h", "dimH", "Horizontal", "บอกระยะแนวราบ: คลิกจุด 1 → จุด 2 → วางเส้น (Tab = พิมพ์ระยะห่าง) · จุดอยู่คนละตัว = เก็บในไฟล์ project"],
        ["v", "dimV", "Vertical", "บอกระยะแนวดิ่ง: คลิกจุด 1 → จุด 2 → วางเส้น (Tab = พิมพ์ระยะห่าง)"],
        ["aligned", "dimA", "Aligned", "บอกระยะตามแนวสองจุด: คลิกจุด 1 → จุด 2 → วางเส้น (Tab = พิมพ์ระยะห่าง)"],
        ["slope", "slope", "Slope label", "ป้ายความลาดบน link เส้นตรง: คลิก link (1:x หรือ %)"]]
      .map(([t, k, label, tip]) => ({ id: "annot." + k, label, svg: TOOL_SVG[k], tip,
        active: c => c.annTool === t,
        run: () => { if (ann.tool === t) annEnd(); else annStart(t); } })),
    { id: "style.fromColours", label: "สร้าง style จากสีที่เห็นตอนนี้", icon: "palette", tip: "เขียนสีที่แต่ละ code แสดงอยู่ลงไฟล์ style (code ที่ตั้งสีไว้แล้วคงเดิม)",
      run: () => { Dock.show("style"); styleFromColours(); } },
    { id: "style.open", label: "Open style file…", icon: "folder-open", tip: "ให้โปรเจกต์ใช้ไฟล์ .style.json อื่น (เช่น template กลาง)",
      run: () => openStyleFile() },

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
    // View › Palettes: one toggle per palette (js/dock.js) + Reset layout
    ...[["tree", "Workspace"], ["scenarios", "Scenarios"], ["props", "Properties"], ["style", "Style"], ["code", "Code"], ["msg", "Messages"], ["log", "Log"],
        ["pts", "Points"], ["logic", "Logic"], ["ai", "AI"]].map(([p, label]) => ({ id: "pal." + p, label, tip: `เปิด / ปิด palette ${label}`,
      active: c => (c.pals || []).includes(p),
      run: () => Dock.toggle(p) })),
    { id: "pal.reset", label: "Reset layout", icon: "restore", tip: "palette ทั้งหมดกลับตำแหน่งเริ่มต้น (ตำแหน่งที่จัดไว้ในเครื่องนี้หายไป)",
      run: () => Dock.reset() },
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
      .map(([t, label, key, tip]) => ({ id: "draw." + t, label, edit: true, tool: t, tip, svg: TOOL_SVG[t],
        // button = toggle the tool (as the Drawer) · key = start the tool (pressing P again restarts it, as before)
        ...(key ? { shortcut: key, keys: [key.toLowerCase()], keyRun: () => setTool(t) } : {}),
        active: c => c.tool === t,
        run: () => pickTool(t) })),
    { id: "draw.aux", label: "Auxiliary", icon: "line-dashed", edit: true, shortcut: "X", keys: ["x"], keyIdle: true,
      tip: "ระหว่างวาด = สลับโหมดของชิ้นที่จะสร้าง · มีของเลือก = สลับ point / link ที่เลือก",
      run: () => { if (draw.tool) toggleDrawAux(); else toggleAuxSel(); } },

    // ---------- contextual: Modify (Move / Copy also work outside Edit on subassemblies) ----------
    { id: "mod.move", label: "Move", icon: "arrows-move", shortcut: "M", keys: ["m"], tip: "คลิกจุดฐาน แล้วคลิกปลายทาง",
      run: () => startCmd("move") },
    { id: "mod.copy", label: "Copy", icon: "copy", shortcut: "C", keys: ["c"], tip: "คลิกจุดฐาน แล้วคลิกปลายทาง (วางได้หลายครั้ง Enter = จบ)",
      run: () => startCmd("copy") },
    { id: "mod.rotate", label: "Rotate", icon: "rotate-clockwise", shortcut: "R", keys: ["r"], tip: "คลิกจุดหมุน แล้วลากมุม / พิมพ์มุม · C = หมุนสำเนา · R = Reference",
      enabled: c => c.editing ? true : NEED_EDIT,
      run: () => startCmd("rotate") },

    // ---------- contextual: Logic ----------
    { id: "logic.params", label: "Parameters", icon: "adjustments-horizontal", edit: true, tip: "ตาราง Parameter ของตัวที่แก้ (ใน Properties)",
      run: () => { const e = editItem(); state.open["i:" + e.id] = true; setSel({ type: "params", item: e.id }); } },
    { id: "logic.vars", label: "Variables", icon: "variable", edit: true, tip: "Variables ของตัวที่แก้ (ในต้นไม้ Workspace)",
      run: () => showVariables() },
    { id: "logic.conds", label: "Conditions", icon: "git-branch", edit: true, tip: "เงื่อนไข / กิ่ง ของส่วนที่วาด (แท็บ Logic)",
      run: () => { Dock.show("logic"); } },
    { id: "logic.branch", label: "Draw into branch", icon: "git-fork", edit: true, shortcut: "B", keys: ["b"], keyIdle: true,
      tip: "object ที่วาดต่อจากนี้เข้ากิ่งที่เลือก",
      run: () => chooseDrawBranch() },

    // ---------- contextual: Finish ----------
    { id: "finish.save", label: "Save (.cs)", icon: "device-floppy", edit: true, shortcut: "Ctrl+S", tip: "เขียนส่วนที่วาดลงไฟล์ .cs ของตัวที่แก้",
      enabled: c => !c.editing ? NEED_EDIT : c.canSaveDrawing ? true : c.saveReason || "ยังไม่มีส่วนที่วาดที่บันทึกได้",
      run: () => saveDrawing(editItem()) },
    { id: "finish.exit", label: "ออกจาก Edit", icon: "door-exit", edit: true, tip: "จบการแก้ subassembly นี้",
      run: () => exitEdit() }
  ];

  const BY_ID = Object.fromEntries(LIST.map(c => [c.id, c]));
  const BY_KEY = {};
  for (const c of LIST) for (const k of c.keys || []) BY_KEY[k] = c;

  // ---------- where commands appear ----------
  // ribbon item: "id" (large) | ["id", "s"] (small) | ["id", size, label shown here] | { widget }
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
      { title: "Show", items: [["view.style", "s"], ["view.annot", "s"], ["view.aux", "s"], ["view.codes", "s"], ["view.ptnames", "s"], ["view.grid", "s"]] },
      { title: "VE", items: [["view.ve1", "s"], ["view.ve2", "s"], ["view.ve5", "s"]] },
      { title: "Scenario", items: [{ widget: "scenario" }] },
      { title: "Palettes", items: [["pal.tree", "s"], ["pal.scenarios", "s"], ["pal.props", "s"], ["pal.style", "s"], ["pal.code", "s"], ["pal.msg", "s"], ["pal.log", "s"],
                                   ["pal.pts", "s"], ["pal.logic", "s"], ["pal.ai", "s"], ["pal.reset", "s"]] }] },
    { id: "annotate", label: "Annotate", panels: [
      { title: "Note", items: ["annot.note", ["annot.noteL", "s"]] },
      { title: "Dimension", items: ["annot.dimH", ["annot.dimV", "s"], ["annot.dimA", "s"]] },
      { title: "Slope", items: ["annot.slope"] },
      { title: "Style", items: [["pal.style", "s", "Style palette"], ["style.fromColours", "s"], ["style.open", "s"]] }] },
    { id: "output", label: "Output", panels: [
      { title: "Build", items: ["build"] },
      { title: "Code", items: ["code.edit", ["code.generated", "s"]] },
      { title: "Scenarios", items: [["sc.export", "s"], ["sc.import", "s"]] }] },
    { id: "ai", label: "AI", panels: [
      { title: "Proposals", items: ["ai.open"] },
      { title: "Claude", items: ["ai.connect", { widget: "aistatus" }] }] },
    // contextual (Edit only, teal, as in Civil 3D); every one ends with the Finish panel (FINISH)
    { id: "draw", label: "Draw", contextual: true, panels: [
      { title: "Draw", items: ["draw.point", "draw.link", "draw.shape", ["draw.polygon", "s"], ["draw.ngon", "s"], ["draw.arc", "s"]] },
      { title: "Surface", items: [["draw.daylight", "s"], ["draw.follow", "s"], ["draw.extend", "s"], ["draw.clip", "s"], ["draw.cutfill", "s"]] },
      { title: "Construct", items: [["draw.intersect", "s"], ["draw.offset", "s"], ["draw.fillet", "s"], ["draw.array", "s"], ["draw.aux", "s"]] }] },
    { id: "modify", label: "Modify", contextual: true, panels: [
      { title: "Modify", items: ["mod.move", "mod.copy", "mod.rotate", "sel.delete"] }] },
    { id: "logic", label: "Logic", contextual: true, panels: [
      { title: "Logic", items: ["logic.params", "logic.vars", "logic.conds", ["logic.branch", "s"], ["draw.cutfill", "s", "ถ้าตัด / ถม"]] }] }
  ];
  const FINISH = { title: "Finish", items: ["finish.save", "finish.exit"] };
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
    "data-tab": { msg: "pal.msg", log: "pal.log", pts: "pal.pts", logic: "pal.logic", ai: "pal.ai" },
    "id": { "b-build": "build", "b-edit": "code.edit", "edit-save": "finish.save", "edit-exit": "finish.exit", "b-fit": "view.fit",
            "b-aux": "view.aux", "b-c3d": "view.c3d" }
  };
  const REMOVED = {
    "data-cmd:export": "Save / Export .cs… ไม่เคยใช้ได้ (Save (.cs) อยู่ใน Finish)",
    "data-tool:marked": "Marked point ไม่เคยใช้ได้",
    "data-tool:level": "Cut at Level ไม่เคยใช้ได้",
    "my-shapes": "My Shapes ไม่เคยใช้ได้ — Browser มาในรอบ 12",
    "id:dock-toggle": "ย่อ dock ล่าง — ใช้ปรับขนาด / ปิด palette แทน",
    "id:ed-close": "× ของแถบโค้ด — ใช้ × ของ palette Code / Ctrl+E",
    "id:ed-resize": "ลากความกว้างแถบโค้ด — dockview ปรับขนาดแทน",
    "id:lw-resize": "ลากความกว้างแถบซ้าย — dockview ปรับขนาดแทน",
    "id:rw-resize": "ลากความกว้างแถบขวา — dockview ปรับขนาดแทน",
    "id:split-left": "เส้นแบ่ง Workspace / Scenarios — dockview ปรับขนาดแทน",
    "fold:sc": "พับ / กาง Scenarios — ปิด / เปิด palette แทน",
    "id:drawer-hint": "คำใบ้ใต้หัว Drawer — tooltip บอกแทน"
  };

  // ---------- ? / F1 shortcut table: command rows take their key from the command, Thai text as before round 9 ----------
  // row: "id" | { ids: [...], text } (keys joined with " / ") | { id, text } | [key, text] (mouse / typing, not a command)
  const HELP = [
    ["ทั่วไป", [{ id: "undo", text: "Undo" }, { id: "redo", text: "Redo" }, { id: "finish.save", text: "Save (.cs) ตอน Edit · นอก Edit = ตัวที่เลือก (ถ้ามี ●) · บันทึกแถบโค้ด" },
                { id: "code.edit", text: "แถบแก้โค้ด" }, { id: "view.fit", text: "Fit (ดูทั้งหมด)" }, { id: "surf.add", text: "Add point บนเส้น surface" },
                { id: "help.keys", text: "ตารางนี้" }, ["Esc", "ยกเลิกคำสั่ง / เครื่องมือ / การเลือก"]]],
    ["เลือก", [["คลิก", "เพิ่มเข้าชุดที่เลือก"], ["ลากซ้าย → ขวา", "Window (อยู่ในกรอบทั้งตัว)"], ["ลากขวา → ซ้าย", "Crossing (แตะกรอบ)"],
               ["Shift + คลิก / คลุม", "เอาออกจากชุด"], ["Ctrl + คลิก (ต้นไม้)", "เพิ่ม / เอาออก"], { id: "sel.all", text: "เลือกทั้งหมด" }, { id: "sel.delete", text: "ลบที่เลือก" }]],
    ["แก้ไข", [{ id: "mod.move", text: "Move" }, { id: "mod.copy", text: "Copy (วางได้หลายครั้ง, Enter = จบ)" },
               { id: "mod.rotate", text: "Rotate (Edit mode) · ระหว่างระบุมุม: C = หมุนสำเนา · R = Reference" },
               { id: "draw.aux", text: "Auxiliary: ระหว่างวาด = สลับโหมดของชิ้นที่จะสร้าง · มีของเลือก = สลับ point / link ที่เลือก" },
               { ids: ["clip.copy", "clip.cut", "clip.paste"], text: "คัดลอก / ตัด / วาง" },
               ["Enter / คลิกขวา", "จบการเลือก / จบ Copy"]]],
    ["วาด (Edit mode)", [{ ids: ["draw.point", "draw.link", "draw.shape"], text: "Point / Link / Shape" },
               { id: "draw.intersect", text: "Intersect: คลิก link 2 เส้น → T = ตัด / ยืดเส้นให้จบที่จุดตัด · N = ไม่ตัด (ได้แค่จุดตัด)" },
               { id: "draw.offset", text: "Offset: คลิก link → คลิกด้าน (Tab / ตัวเลข = ตั้งระยะ · ทำซ้ำได้จน Esc)" },
               ["Tab", "snap ตัวถัดไป (มีหลายตัว) / พิมพ์ค่า"], ["พิมพ์ตัวเลข", "พิมพ์ค่า / ระยะ"],
               ["Enter / คลิกขวา", "จบเส้น"], ["C (ตอนวาด Polygon)", "ปิดรูป Polygon อิสระ (≥ 3 จุด)"],
               ["Tab (Regular Polygon)", "พิมพ์ N / R / θ / ถึงกึ่งกลางด้าน · ปุ่ม + = สร้าง parameter จากช่อง"],
               ["T / E (ตอนวาด Arc)", "Arc 3 จุด / เริ่ม-ปลาย-รัศมี (Tab ตอนเลือกความโค้ง = พิมพ์ R, ตามเข็ม, ทางยาว)"],
               ["Tab / ตัวเลข (Fillet)", "ตั้งรัศมี Fillet (นิพจน์ / parameter ได้)"],
               { id: "logic.branch", text: "วาดลงกิ่ง… (object ที่วาดต่อจากนี้เข้ากิ่งที่เลือก · banner บอกกิ่ง)" }]],
    ["แถบล่าง", [{ id: "bar.osnap", text: "OSNAP เปิด/ปิด" }, ["▾ / คลิกขวาที่ OSNAP", "เมนูเลือกชนิด snap"], { id: "bar.ortho", text: "Ortho" },
               { id: "bar.snap", text: "Grid snap (ดับเบิลคลิกปุ่ม = ตั้งระยะ ถึง 0.001 m)" },
               { id: "bar.track", text: "Object snap tracking (ชี้ค้างบน snap = จับจุด · ชี้ค้างซ้ำ = ปล่อย · Esc = ล้าง)" },
               ["ปุ่ม Aux", "แสดง / ซ่อน Auxiliary (ซ่อน = snap / คลุมเลือกไม่ได้)"], ["ปุ่ม ดูแบบ Civil 3D", "เห็นเฉพาะที่จะส่งออกไปจริง"]]],
    ["พิมพ์ค่า", [["ตัวเลข", "dx / dy (มีจุดที่จับไว้ = คิดจากจุดนั้น)"], ["Tab / ตัวเลข (ตอนวาง Dimension)", "พิมพ์ระยะห่างของเส้นบอกระยะจากกึ่งกลางสองจุด (m)"], ["ระยะ<มุม ในช่อง dx", "เช่น 5<30 = ห่าง 5 ทำมุม 30° (ทวนเข็มจาก +x)"]]],
    ["มุมมอง", [["ปุ่มกลางเมาส์ลาก / Space + ลาก", "Pan"], ["ล้อเมาส์", "Zoom"], ["Shift + ล้อเมาส์", "Zoom ทีละน้อย"],
               { id: "view.zoomSel", text: "Zoom ไปที่ของที่เลือก (ไม่มีที่เลือก = Fit)" }]],
    ["Ribbon / palette", [["ดับเบิลคลิกแท็บ ribbon", "ย่อ / ขยาย ribbon (ย่ออยู่: คลิกแท็บ = เปิดชั่วคราว)"],
               ["ลากแท็บ palette", "ย้าย / รวมเป็นแท็บ / ชิดขอบ · Shift + ลาก = palette ลอย"], ["View › Palettes", "เปิด / ปิด palette · Reset layout"]]]
  ];
  // → [[group, [[key, text], …]], …]
  const helpRows = () => HELP.map(([g, rows]) => [g, rows.map(r => {
    if (Array.isArray(r)) return r;
    if (typeof r === "string") r = { id: r };
    const ids = r.ids || [r.id];
    return [ids.map(id => BY_ID[id].shortcut).join(" / "), r.text || BY_ID[ids[0]].label];
  })]);
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
  return { LIST, RIBBON, FINISH, HELP, helpRows, FILE_MENU, QUICK, MENU_LABEL, OLD, REMOVED, get, enabled, active, keyOf, forKey, keyAllowed, tooltip };
})();
if (typeof module !== "undefined") module.exports = Commands;
