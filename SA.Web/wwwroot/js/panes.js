// ลากปรับความกว้างแถบซ้าย (ต้นไม้ Workspace) / แถบขวา (Drawer + Properties) แบบ VS Code (รอบ 4d)
//   ค่าเก็บใน state.leftW / state.rightW (จำในเบราว์เซอร์พร้อม state อื่น — store อ่าน / เขียนแบบ try/catch) → ตัวแปร CSS --lw / --rw
//   ขอบเขต: ซ้าย 200–600 · ขวา 240–600 · workspace ตรงกลางเหลืออย่างน้อย 320 px (จอเล็ก = บีบแถบก่อน ไม่เปลี่ยนค่าที่จำไว้)
//   ดับเบิลคลิกที่ขอบ = ค่าเริ่มต้น 280 / 300 · จอแคบ (≤ 900 px) ซ่อนตัวลาก (CSS)
"use strict";
const PANE = { left: { def: 280, min: 200, max: 600, key: "leftW", css: "--lw" }, right: { def: 300, min: 240, max: 600, key: "rightW", css: "--rw" } };
const CENTER_MIN = 320;

// ความกว้างแถบโค้ด (แถบโค้ดเปิด) ที่ตั้งไว้ — ตรงกับ CSS minmax(280px, var(--edw, 40vw))
//   ใช้ค่าที่ตั้งไม่ใช่วัดจากจอ (ตอนแถบซ้าย / ขวากว้างเกิน grid บีบแถบโค้ดอยู่ วัดได้น้อยกว่าจริง)
const editorWidth = () => document.body.classList.contains("editing") ? Math.max(280, +state.edWidth || innerWidth * 0.4) : 0;
const paneWant = side => { const p = PANE[side], v = +state[p.key]; return isFinite(v) && v > 0 ? Math.max(p.min, Math.min(p.max, v)) : p.def; };

// ตั้ง --lw / --rw จากค่าที่จำไว้ — จอเล็กจน workspace เหลือไม่ถึง 320 px = บีบแถบลงก่อน (ไม่ต่ำกว่าขั้นต่ำ)
function applyPaneWidths(){
  let l = paneWant("left"), r = paneWant("right");
  let over = l + r + editorWidth() + CENTER_MIN - innerWidth;
  if (over > 0){ const cut = Math.min(over, r - PANE.right.min); r -= cut; over -= cut; }
  if (over > 0){ const cut = Math.min(over, l - PANE.left.min); l -= cut; }
  document.body.style.setProperty("--lw", Math.round(l) + "px");
  document.body.style.setProperty("--rw", Math.round(r) + "px");
  placePaneHandles();
}
// ตัวลากเป็น position: fixed ทับขอบแถบ (แถบเลื่อนขึ้นลงได้ — ตัวลากต้องไม่เลื่อนตาม) · สูงเท่าแถบ
function placePaneHandles(){
  for (const [id, pane] of [["lw-resize", "left"], ["rw-resize", "right"]]){
    const h = $(id), a = $(pane).getBoundingClientRect();
    h.style.top = a.top + "px"; h.style.height = a.height + "px";
    h.style.left = (pane === "left" ? a.right : a.left) - 3 + "px";
  }
}
function startPaneDrag(side, e){
  if (e.button !== 0) return;
  e.preventDefault();
  const p = PANE[side], x0 = e.clientX, w0 = $(side).getBoundingClientRect().width, h = $(side === "left" ? "lw-resize" : "rw-resize");
  const other = side === "left" ? $("right") : $("left");
  document.body.classList.add("col-resizing"); h.classList.add("on");
  const move = ev => {
    // ตรงกลางเหลืออย่างน้อย 320 px ระหว่างลาก
    const room = innerWidth - other.getBoundingClientRect().width - editorWidth() - CENTER_MIN;
    const w = w0 + (side === "left" ? 1 : -1) * (ev.clientX - x0);
    state[p.key] = Math.round(Math.max(p.min, Math.min(p.max, room, w)));
    applyPaneWidths();
  };
  const up = () => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up);
    document.body.classList.remove("col-resizing"); h.classList.remove("on");
    persist();
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up);
}
for (const [id, side] of [["lw-resize", "left"], ["rw-resize", "right"]]){
  const h = $(id);
  h.addEventListener("pointerdown", e => startPaneDrag(side, e));
  h.addEventListener("dblclick", () => { delete state[PANE[side].key]; applyPaneWidths(); persist(); flashBanner(`ความกว้างแถบ${side === "left" ? "ซ้าย" : "ขวา"}กลับเป็นค่าเริ่มต้น ${PANE[side].def} px`); });
}
addEventListener("resize", () => { applyPaneWidths(); });
// แถบซ้าย / ขวาเปลี่ยนตำแหน่ง (เปิด / ปิดแถบโค้ด, ลากแถบโค้ด, header สูงขึ้น) = วางตัวลากใหม่
new ResizeObserver(placePaneHandles).observe($("left"));
new ResizeObserver(placePaneHandles).observe($("right"));
