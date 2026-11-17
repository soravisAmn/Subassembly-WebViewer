// Ribbon, ไฟล์ application menu and Quick Access (round 9) — all read from the command registry (js/commands.js).
//   Built once at start (buildRibbon); updateRibbon() refreshes enabled / active / badges / contextual tabs after each render.
//   state.ribbon = { tab, prev } per browser tab (view state, Undo ignores it) · minimised = per machine (store "sa.ribbonMin").
//   Edit flow (as Civil 3D): entering Edit shows Draw / Modify / Logic (teal) and switches to Draw; leaving returns to the previous tab.
//   Minimised (double-click a tab): clicking a tab shows its panels over the drawing until a command runs or you click elsewhere.
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
  const it = selItem(), s = state.sel, h = History.size, ei = state.editing ? editItem() : null;
  const many = s.type === "multi" ? s.list : [s];
  return {
    editing: !!state.editing, item: it ? it.id : null, asm: ribbonAsm(),
    itemGenerated: !!(it && it.spec && !hasCode(it)),
    picked: pickedList().length > 0,
    deletable: s.type === "spt" || many.some(o => o.type === "dann" || (state.editing ? DRAWN_KIND[o.type] : o.type === "item")),
    clip: !!clip, addMode, readOnly: !!Proj.readOnly, undo: h.undo > 0, redo: h.redo > 0,
    bar: state.bar, showCodes: !!state.showCodes, ve: +state.view.ve, edOpen: !!ed.open, tool: draw.tool, cmdRunning: !!cmd.name, annTool: ann.tool,
    canSaveDrawing: !!ei && canSaveDrawing(ei),
    pals: Dock ? DockLayout.PALETTES.filter(p => Dock.has(p.id)).map(p => p.id) : [],
    saveReason: !ei ? "" : !ei.spec ? "ยังไม่ได้วาดอะไร" : "ไฟล์ที่เขียนเองยังไม่มีช่วง SA-DRAWING — แก้ในแถบโค้ดแทน"
  };
}
// run from a button / menu: disabled = say why in the banner
function runCommand(id){
  const e = Commands.enabled(id, ctxNow());
  if (e !== true) return flashBanner(e);
  closeMenus(); hideRibbonTip(); setRibbonPeek(false);
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
const iconHtml = x => x.svg ? `<svg class="rsvg" viewBox="0 0 28 22" aria-hidden="true">${x.svg}</svg>`
  : x.icon ? `<span class="ri" style="--ic:url(/lib/tabler/${x.icon}.svg)" aria-hidden="true"></span>` : "";
function cmdButton(id, size, label){
  const x = Commands.get(id), b = document.createElement("button");
  b.className = "rb " + (size || "L"); b.dataset.cmd = id;
  b.innerHTML = iconHtml(x) + `<span class="rl">${esc(label || x.label)}</span>` + (id === "ai.open" ? '<span class="badge" id="rb-n-ai"></span>' : "");
  b.setAttribute("aria-label", label || x.label);
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
function ribbonPanel(p, cls){
  const pn = document.createElement("div"); pn.className = "rb-panel" + (cls ? " " + cls : "");
  const body = document.createElement("div"); body.className = "rb-body";
  let col = null;      // small buttons stack in columns of 3
  for (const it of p.items){
    if (it.widget){ col = null; body.appendChild(ribbonWidget(it.widget)); continue; }
    const [id, size, label] = Array.isArray(it) ? it : [it, "L"];
    if (size === "s"){
      if (!col || col.childElementCount >= 3){ col = document.createElement("div"); col.className = "rb-col"; body.appendChild(col); }
      col.appendChild(cmdButton(id, "s", label));
    } else { col = null; body.appendChild(cmdButton(id, "L", label)); }
  }
  const ttl = document.createElement("div"); ttl.className = "rb-title"; ttl.textContent = p.title;
  pn.append(body, ttl); return pn;
}
function buildRibbon(){
  // ไฟล์ menu
  const dd = $("dd-file"); dd.innerHTML = "";
  for (const id of Commands.FILE_MENU){
    if (id === "-"){ dd.appendChild(document.createElement("hr")); continue; }
    if (id === "recent"){ const r = document.createElement("div"); r.id = "dd-recent"; dd.appendChild(r); continue; }
    const b = document.createElement("button"); b.dataset.cmd = id;
    b.innerHTML = iconHtml(Commands.get(id)) + esc(Commands.MENU_LABEL[id] || Commands.get(id).label);
    dd.appendChild(b);
  }
  // Quick Access
  const qa = $("qa"); qa.innerHTML = "";
  for (const id of Commands.QUICK){ const b = cmdButton(id, "q"); b.querySelector(".rl").remove(); qa.appendChild(b); }
  // tabs + panels
  const tabs = $("rb-tabs"), rb = $("ribbon"); tabs.innerHTML = ""; rb.innerHTML = "";
  for (const t of Commands.RIBBON){
    if (t.contextual && !tabs.querySelector(".rb-csep")){ const s = document.createElement("span"); s.className = "rb-csep"; tabs.appendChild(s); }
    const tb = document.createElement("button"); tb.className = "rb-tab" + (t.contextual ? " ctxl" : ""); tb.dataset.tab = t.id;
    tb.setAttribute("role", "tab"); tb.textContent = t.label;
    tb.title = (t.contextual ? "แท็บของ Edit mode · " : "") + "ดับเบิลคลิก = ย่อ / ขยาย ribbon";
    tabs.appendChild(tb);
    const page = document.createElement("div"); page.className = "rb-page" + (t.contextual ? " ctxl" : ""); page.dataset.page = t.id;
    for (const p of t.panels) page.appendChild(ribbonPanel(p));
    if (t.contextual) page.appendChild(ribbonPanel(Commands.FINISH, "finish"));
    rb.appendChild(page);
  }
  // a vertical wheel over a narrow ribbon scrolls the panels sideways
  rb.addEventListener("wheel", e => { if (rb.scrollWidth > rb.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)){ rb.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  applyRibbonMin();
  updateRibbon();
}

// ---------- tabs, Edit flow, minimise ----------
const ribbonTab = () => (state.ribbon && state.ribbon.tab) || "home";
function setRibbonTab(id){
  state.ribbon = Object.assign({}, state.ribbon, { tab: id });
  persist(); updateRibbon();
}
let rbEditWas = null;          // the subassembly in Edit at the last update (Edit flow)
function ribbonEditFlow(){
  const now = state.editing || null, r = state.ribbon = Object.assign({ tab: "home" }, state.ribbon);
  const ctxTab = id => (Commands.RIBBON.find(t => t.id === id) || {}).contextual;
  if (now && !rbEditWas){ if (!ctxTab(r.tab)) r.prev = r.tab; r.tab = "draw"; }
  else if (!now && ctxTab(r.tab)) r.tab = r.prev && !ctxTab(r.prev) ? r.prev : "home";
  rbEditWas = now;
}
const ribbonMin = () => !!store.get("sa.ribbonMin", false);
function applyRibbonMin(){ document.body.classList.toggle("rb-min", ribbonMin()); }
function setRibbonPeek(on){ document.body.classList.toggle("rb-peek", !!on && ribbonMin()); }
$("rb-tabs").addEventListener("click", e => {
  const t = e.target.closest(".rb-tab"); if (!t) return;
  const same = t.dataset.tab === ribbonTab();
  setRibbonTab(t.dataset.tab);
  if (ribbonMin()) setRibbonPeek(!(same && document.body.classList.contains("rb-peek")));
});
$("rb-tabs").addEventListener("dblclick", e => {
  if (!e.target.closest(".rb-tab")) return;
  store.set("sa.ribbonMin", !ribbonMin()); setRibbonPeek(false); applyRibbonMin();
  flashBanner(ribbonMin() ? "ย่อ ribbon: คลิกแท็บ = เปิดชั่วคราว · ดับเบิลคลิกแท็บ = ขยายคืน" : "ขยาย ribbon");
});
document.addEventListener("pointerdown", e => { if (!e.target.closest("#top")) setRibbonPeek(false); });

// ---------- tooltip (name + shortcut, Thai line, why disabled) ----------
let tipT = null;
function showRibbonTip(b){
  if (!b.isConnected) return;
  const id = b.dataset.cmd, x = Commands.get(id), e = Commands.enabled(id, ctxNow()), tip = $("rb-tip");
  tip.innerHTML = `<b>${esc(b.getAttribute("aria-label") || x.label)}</b>${x.shortcut ? ` <kbd>${esc(x.shortcut)}</kbd>` : ""}<div>${esc(x.tip)}</div>`
                + (e === true ? "" : `<div class="why">ใช้ไม่ได้ตอนนี้: ${esc(e)}</div>`);
  tip.hidden = false;
  const r = b.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.left = Math.max(4, Math.min(innerWidth - w - 4, r.left)) + "px";
  tip.style.top = (r.bottom + 4) + "px";
}
function hideRibbonTip(){ clearTimeout(tipT); $("rb-tip").hidden = true; }
$("top").addEventListener("mouseover", e => {
  const b = e.target.closest("[data-cmd]"); if (!b) return;
  if (e.relatedTarget && b.contains(e.relatedTarget)) return;
  clearTimeout(tipT); tipT = setTimeout(() => showRibbonTip(b), $("rb-tip").hidden ? 450 : 60);
});
$("top").addEventListener("mouseout", e => {
  const b = e.target.closest("[data-cmd]"); if (!b || (e.relatedTarget && b.contains(e.relatedTarget))) return;
  clearTimeout(tipT); tipT = setTimeout(() => { $("rb-tip").hidden = true; }, 80);
});
$("top").addEventListener("pointerdown", hideRibbonTip);

// ---------- refresh ----------
function updateRibbon(){
  if (!$("ribbon").childElementCount) return;
  ribbonEditFlow();
  const c = ctxNow(), editing = !!state.editing;
  let tab = ribbonTab();
  const def = Commands.RIBBON.find(t => t.id === tab);
  if (!def || (def.contextual && !editing)) tab = "home";
  for (const b of $("rb-tabs").children){
    if (!b.dataset.tab) continue;
    b.classList.toggle("cur", b.dataset.tab === tab);
    if (b.classList.contains("ctxl")) b.hidden = !editing;
  }
  $("rb-tabs").classList.toggle("editing", editing);
  for (const p of $("ribbon").children) p.hidden = p.dataset.page !== tab;
  for (const b of document.querySelectorAll("#top [data-cmd]")){
    const id = b.dataset.cmd, e = Commands.enabled(id, c);
    // not the disabled attribute: a disabled button gets no hover, and the tooltip must say why it is off (a click says it in the banner)
    b.classList.toggle("off", e !== true); b.setAttribute("aria-disabled", String(e !== true));
    b.classList.toggle("on", Commands.active(id, c));
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
  const b = e.target.closest("[data-cmd]"); if (!b) return;
  runCommand(b.dataset.cmd);
});
$("m-file").onclick = () => { const d = $("dd-file"); const h = d.hidden; closeMenus(); d.hidden = !h; if (h){ renderRecent(); refreshSettings(); updateRibbon(); } };
buildRibbon();
