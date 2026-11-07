// ลากปรับความกว้างแถบซ้าย (ต้นไม้ Workspace) / แถบขวา (Drawer + Properties) แบบ VS Code (รอบ 4d)
//   ค่าเก็บใน state.leftW / state.rightW (จำในเบราว์เซอร์พร้อม state อื่น — store อ่าน / เขียนแบบ try/catch) → ตัวแปร CSS --lw / --rw
//   ขอบเขต: ซ้าย 200–600 · ขวา 240–600 · workspace ตรงกลางเหลืออย่างน้อย 320 px (จอเล็ก = บีบแถบก่อน ไม่เปลี่ยนค่าที่จำไว้)
//   ดับเบิลคลิกที่ขอบ = ค่าเริ่มต้น 280 / 300 · จอแคบ (≤ 900 px) ซ่อนตัวลาก (CSS)
// แต่ละแถบแบ่งเป็น 2 แผงเลื่อนแยกกัน: ซ้าย = ต้นไม้ / Scenarios · ขวา = Drawer / Properties
//   เส้นลากแนวนอนปรับความสูง Scenarios / Drawer (state.scH / drawerH) · คลิกหัวแผง = พับ / กาง (state.scFold / drawerFold)
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
// ---------------- แบ่งแถบเป็น 2 แผง (แนวนอน) ----------------
// แผง .sized (Drawer / Scenarios) สูงตามที่ลาก — ยังไม่ลาก = ตามเนื้อหาไม่เกิน --auto-max (CSS) · แผง .grow ได้ที่เหลือ
//   sizedBelow = แผงที่ปรับได้อยู่ใต้เส้นแบ่ง (Scenarios) → ลากขึ้น = สูงขึ้น · state[key] = ความสูง (px) · state[fold] = พับอยู่
const SPLITS = {
  right: { split: "split-right", sec: "sec-drawer", key: "drawerH", fold: "drawerFold", name: "Drawer", min: 60, keep: 120, sizedBelow: false },
  left:  { split: "split-left",  sec: "sec-sc",     key: "scH",     fold: "scFold",     name: "Scenarios", min: 50, keep: 120, sizedBelow: true }
};
// ความสูงสูงสุดของแผงที่ปรับได้ = สูงของแถบ − keep (แผงอีกฝั่งเหลืออย่างน้อย keep px)
function applySplits(){
  for (const side of ["left", "right"]){
    const s = SPLITS[side], sec = $(s.sec), folded = !!state[s.fold];
    sec.classList.toggle("folded", folded);
    $(s.split).classList.toggle("off", folded);
    const car = sec.querySelector(".fold-car"); if (car) car.textContent = folded ? "▸" : "▾";
    const h = +state[s.key];
    if (!folded && isFinite(h) && h > 0){
      const max = $(side).clientHeight - s.keep;
      sec.style.height = Math.round(Math.max(s.min, Math.min(max > s.min ? max : s.min, h))) + "px";
      sec.classList.add("dragged");
    } else { sec.style.height = ""; sec.classList.remove("dragged"); }
  }
}
function startSplitDrag(side, e){
  if (e.button !== 0) return;
  e.preventDefault();
  const s = SPLITS[side], sec = $(s.sec), sp = $(s.split), y0 = e.clientY, h0 = sec.getBoundingClientRect().height;
  document.body.classList.add("row-resizing"); sp.classList.add("on");
  const move = ev => {
    const dy = ev.clientY - y0, max = $(side).clientHeight - s.keep;
    state[s.key] = Math.round(Math.max(s.min, Math.min(max, h0 + (s.sizedBelow ? -dy : dy))));
    applySplits();
  };
  const up = () => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up);
    document.body.classList.remove("row-resizing"); sp.classList.remove("on");
    persist();
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up);
}
for (const side of ["left", "right"]){
  const s = SPLITS[side];
  $(s.split).addEventListener("pointerdown", e => startSplitDrag(side, e));
  $(s.split).addEventListener("dblclick", () => { delete state[s.key]; applySplits(); persist(); flashBanner(`ความสูง ${s.name} กลับเป็นค่าเริ่มต้น (ตามเนื้อหา)`); });
  // คลิกหัวแผง = พับ / กาง (ปุ่มในหัว เช่น + บันทึกกรณีนี้ ไม่นับ)
  $(s.sec).querySelector(".pane-h.fold").addEventListener("click", e => {
    if (e.target.closest("button, input, select, a")) return;
    state[s.fold] = !state[s.fold]; applySplits(); persist();
  });
}

addEventListener("resize", () => { applyPaneWidths(); applySplits(); });
// แถบซ้าย / ขวาเปลี่ยนตำแหน่ง (เปิด / ปิดแถบโค้ด, ลากแถบโค้ด, header สูงขึ้น) = วางตัวลากใหม่
new ResizeObserver(placePaneHandles).observe($("left"));
new ResizeObserver(placePaneHandles).observe($("right"));
