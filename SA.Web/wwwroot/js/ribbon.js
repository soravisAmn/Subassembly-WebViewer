// Ribbon, ไฟล์ application menu and Quick Access (round 9) — all read from the command registry (js/commands.js).
//   Built once at start (buildRibbon); updateRibbon() refreshes enabled / active / tooltips / badges after each render.
//   The active tab is kept in state.ribbon.tab (per browser tab, like the other view state; Undo ignores it).
"use strict";

// ---------- context for the enable / active rules ----------
// assembly the Home › Add subassembly button works on: the selected assembly, the selected subassembly's assembly, or the only one
function ribbonAsm(){
  if (state.sel.type === "asm") return state.sel.asm;
  const it = selItem(), a = it && asmOfItem(it.id);
  if (a) return a.id;
  return asms().length === 1 ? asms()[0].id : null;
}
function ctxNow(){
  const it = selItem(), s = state.sel, h = History.size;
  const many = s.type === "multi" ? s.list : [s];
  return {
    editing: !!state.editing, item: it ? it.id : null, asm: ribbonAsm(),
    itemGenerated: !!(it && it.spec && !hasCode(it)),
    picked: pickedList().length > 0,
    deletable: s.type === "spt" || many.some(o => state.editing ? DRAWN_KIND[o.type] : o.type === "item"),
    clip: !!clip, addMode, readOnly: !!Proj.readOnly, undo: h.undo > 0, redo: h.redo > 0,
    bar: state.bar, showCodes: !!state.showCodes, ve: +state.view.ve, edOpen: !!ed.open, tool: draw.tool, cmdRunning: !!cmd.name,
    canSaveDrawing: !!state.editing && canSaveDrawing(editItem())
  };
}
// run from a button / menu: disabled = say why in the banner
function runCommand(id){
  const e = Commands.enabled(id, ctxNow());
  if (e !== true) return flashBanner(e);
  closeMenus();
  Commands.get(id).run();
  updateRibbon();
}

// ---------- small handlers the registry needs ----------
function setVe(n){ state.view.ve = n; $("ve").value = n; persist(); render(); updateRibbon(); }
// Logic › Variables: open the Variables node of the edited subassembly in the Workspace tree
function showVariables(){
  const it = editItem(); if (!it) return;
  state.open["i:" + it.id] = true; state.open["i:" + it.id + ":vars"] = true;
  setSel({ type: "lg", item: it.id, k: "vars" });
}
// AI › เชื่อม Claude: the steps of docs/connect-claude.md
function showConnectClaude(){
  const url = location.origin + "/mcp";
  openDialog("เชื่อม Claude (MCP)", b => {
    div("hint", "Claude ใช้หน้าเว็บนี้ผ่าน MCP (ใช้แพ็กเกจ Claude ที่มีอยู่ ไม่ต้องมี API key) — ทุกการแก้เป็นข้อเสนอที่รับ / ปฏิเสธได้ในแท็บ AI", b);
    div("pg-h", "Claude Code", b);
    div("", `1. เปิดหน้านี้ค้างไว้ (run-viewer.bat)<br>2. รันครั้งเดียวใน terminal:`, b);
    const pre = document.createElement("pre"); pre.className = "lg-text"; pre.textContent = `claude mcp add --transport http sa-studio ${url}`; b.appendChild(pre);
    div("", "3. เช็กด้วย <span class=\"mono\">claude mcp list</span> (ต้องขึ้น Connected) หรือ <span class=\"mono\">/mcp</span> ใน Claude Code", b);
    div("pg-h", "Claude Desktop", b);
    div("", "ใช้ตัวเชื่อม <span class=\"mono\">SA.Mcp\\bridge.js</span> ในโฟลเดอร์โปรแกรม (ต้องมี Node 18 ขึ้นไป): Settings → Developer → Edit Config แล้วเพิ่ม <span class=\"mono\">sa-studio</span> ใน mcpServers — ขั้นตอนเต็มอยู่ใน <span class=\"mono\">docs/connect-claude.md</span>", b);
    div("hint", aiLastCall ? `สถานะ: Claude เชื่อมต่อแล้ว (เรียกล่าสุด ${new Date(aiLastCall).toLocaleTimeString()})` : "สถานะ: ยังไม่มีการเรียกจาก Claude ตั้งแต่เปิดหน้านี้", b);
  });
}

// ---------- build ----------
const iconHtml = name => name ? `<span class="ri" style="--ic:url(/lib/tabler/${name}.svg)" aria-hidden="true"></span>` : "";
function cmdButton(id, size){
  const x = Commands.get(id), b = document.createElement("button");
  b.className = "rb " + (size || "L"); b.dataset.cmd = id;
  b.innerHTML = iconHtml(x.icon) + `<span class="rl">${esc(x.label)}</span>` + (id === "ai.open" ? '<span class="badge" id="rb-n-ai"></span>' : "");
  b.onclick = () => runCommand(id);
  return b;
}
function ribbonWidget(w){
  if (w === "scenario"){
    const l = document.createElement("label"); l.className = "rb-sc";
    l.innerHTML = '<span class="rl">กรณีที่ใช้</span>';
    const s = document.createElement("select"); s.id = "rb-scenario"; s.title = "Scenario ที่ใช้อยู่ (เหมือนคลิกในแผง Scenarios)";
    s.onchange = () => { useScenario(s.value || null).then(() => updateRibbon()); };
    l.appendChild(s); return l;
  }
  if (w === "aistatus"){ const s = document.createElement("span"); s.className = "rb-status"; s.id = "rb-ai-status"; return s; }
}
function buildRibbon(){
  // ไฟล์ menu
  const dd = $("dd-file"); dd.innerHTML = "";
  for (const id of Commands.FILE_MENU){
    if (id === "-"){ dd.appendChild(document.createElement("hr")); continue; }
    if (id === "recent"){ const r = document.createElement("div"); r.id = "dd-recent"; dd.appendChild(r); continue; }
    const b = document.createElement("button"); b.dataset.cmd = id;
    b.innerHTML = iconHtml(Commands.get(id).icon) + esc(Commands.MENU_LABEL[id] || Commands.get(id).label);
    dd.appendChild(b);
  }
  // Quick Access
  const qa = $("qa"); qa.innerHTML = "";
  for (const id of Commands.QUICK){ const b = cmdButton(id, "q"); b.querySelector(".rl").remove(); qa.appendChild(b); }
  // tabs + panels
  const tabs = $("rb-tabs"), rb = $("ribbon"); tabs.innerHTML = ""; rb.innerHTML = "";
  for (const t of Commands.RIBBON){
    const tb = document.createElement("button"); tb.className = "rb-tab"; tb.dataset.tab = t.id; tb.setAttribute("role", "tab"); tb.textContent = t.label;
    tb.onclick = () => setRibbonTab(t.id);
    tabs.appendChild(tb);
    const page = document.createElement("div"); page.className = "rb-page"; page.dataset.page = t.id;
    for (const p of t.panels){
      const pn = document.createElement("div"); pn.className = "rb-panel";
      const body = document.createElement("div"); body.className = "rb-body";
      let col = null;      // small buttons stack in columns of 3
      for (const it of p.items){
        if (it.widget){ col = null; body.appendChild(ribbonWidget(it.widget)); continue; }
        const [id, size] = Array.isArray(it) ? it : [it, "L"];
        if (size === "s"){
          if (!col || col.childElementCount >= 3){ col = document.createElement("div"); col.className = "rb-col"; body.appendChild(col); }
          col.appendChild(cmdButton(id, "s"));
        } else { col = null; body.appendChild(cmdButton(id, "L")); }
      }
      const ttl = document.createElement("div"); ttl.className = "rb-title"; ttl.textContent = p.title;
      pn.append(body, ttl); page.appendChild(pn);
    }
    rb.appendChild(page);
  }
  // horizontal wheel over a narrow ribbon = scroll the panels
  rb.addEventListener("wheel", e => { if (rb.scrollWidth > rb.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)){ rb.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  updateRibbon();
}
function setRibbonTab(id){
  state.ribbon = Object.assign({}, state.ribbon, { tab: id });
  persist(); updateRibbon();
}

// ---------- refresh ----------
function updateRibbon(){
  if (!$("ribbon").childElementCount) return;
  const c = ctxNow(), tab = (state.ribbon && Commands.RIBBON.some(t => t.id === state.ribbon.tab)) ? state.ribbon.tab : "home";
  for (const b of $("rb-tabs").children) b.classList.toggle("cur", b.dataset.tab === tab);
  for (const p of $("ribbon").children) p.hidden = p.dataset.page !== tab;
  for (const b of document.querySelectorAll("#top [data-cmd]")){
    const id = b.dataset.cmd, e = Commands.enabled(id, c);
    b.disabled = e !== true;
    b.classList.toggle("on", Commands.active(id, c));
    b.title = Commands.tooltip(id, c);
  }
  const sel = $("rb-scenario");
  if (sel){
    const act = WS().scenarioActive || "", names = projScenarios().map(s => s.name);
    const sig = JSON.stringify([act, names]);
    if (sel.dataset.sig !== sig){
      sel.innerHTML = '<option value="">Default</option>' + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
      sel.value = act; sel.dataset.sig = sig;
    }
  }
  const n = Proposals.pending().length, badge = $("rb-n-ai");
  if (badge) badge.textContent = n ? String(n) : "";
  const st = $("rb-ai-status");
  if (st){ st.textContent = aiLastCall ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อม"; st.classList.toggle("ok", !!aiLastCall); }
}

$("dd-file").addEventListener("click", e => {
  const b = e.target.closest("[data-cmd]"); if (!b || b.disabled) return;
  runCommand(b.dataset.cmd);
});
$("m-file").onclick = () => { const d = $("dd-file"); const h = d.hidden; closeMenus(); d.hidden = !h; if (h){ renderRecent(); refreshSettings(); updateRibbon(); } };
buildRibbon();
