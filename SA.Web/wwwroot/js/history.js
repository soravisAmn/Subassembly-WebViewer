// Undo / Redo ของทุกการกระทำ (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
//
// เก็บภาพ "เอกสาร" = assembly + subassembly (spec, parameter, จุดเกาะ) + surface + ค่า Corridor เป็น JSON
// ทุกครั้งที่ persist() แล้วเอกสารเปลี่ยน = 1 ก้อน undo (ภาพก่อนเปลี่ยน + ชื่อการกระทำจาก act())
//   ระหว่างลาก / พิมพ์ในช่องของ Properties ยังไม่นับ — นับตอนปล่อยเมาส์ / ออกจากช่อง (ลากต่อเนื่อง = ก้อนเดียว)
//   batch(label, fn) = หลายขั้นตอนเป็นก้อนเดียว
// ไม่นับเป็นเอกสาร (Undo ไม่ย้อน): มุมมอง, ที่เลือก, แถบล่าง, ชื่อ project และสถานะการ Save ไฟล์ (KEEP)
"use strict";

// ส่วนที่ไม่ขึ้นกับหน้าเว็บ (ทดสอบด้วย node: SA.Tests/js/history.test.js)
//   snap() -> { full, key }: full = ใช้คืนค่า, key = ใช้เทียบว่าเปลี่ยนไหม · apply(full) = คืนค่า
function makeHistory(snap, apply, limit = 200){
  const undo = [], redo = [];
  let last = null, label = null, hold = 0;
  const h = {
    // ชื่อของการกระทำถัดไป (ระหว่าง batch ใช้ชื่อของ batch)
    act(l){ if (!hold) label = l; },
    // เทียบกับภาพล่าสุด: เปลี่ยน = เก็บก้อน undo · คืน true เมื่อเก็บ
    track(){
      if (hold) return false;
      const now = snap(), l = label;
      label = null;
      if (!last){ last = now; return false; }
      if (now.key === last.key){ last = now; return false; }
      undo.push({ full: last.full, label: l || "แก้ไข" });
      if (undo.length > limit) undo.shift();
      redo.length = 0; last = now;
      return true;
    },
    batch(l, fn){
      h.act(l); hold++;
      try{ fn(); } finally{ hold--; }
      return h.track();
    },
    // เปลี่ยนเอกสารแบบไม่นับเป็นการกระทำ (เช่น ข้อมูลที่โหลดตามมาหลัง Import)
    rebase(){ last = snap(); label = null; },
    reset(){ undo.length = redo.length = 0; h.rebase(); },
    // Undo (redo = false) / Redo: คืนชื่อการกระทำ หรือ null ถ้าไม่มีให้ย้อน
    step(isRedo){
      const from = isRedo ? redo : undo, to = isRedo ? undo : redo;
      const e = from.pop();
      if (!e) return null;
      to.push({ full: snap().full, label: e.label });
      apply(e.full);
      last = snap(); label = null;
      return e.label;
    },
    get size(){ return { undo: undo.length, redo: redo.length }; },
    peek(isRedo){ const s = isRedo ? redo : undo; return s.length ? s[s.length - 1].label : null; }
  };
  return h;
}

// ---------------- เอกสารของหน้าเว็บ ----------------
// ข้อมูลของ item ที่ Undo ไม่ย้อน: สถานะการ Save / ไฟล์ที่ผูก / โค้ดที่เปิดจากเครื่อง (คงค่าปัจจุบันไว้ตอนคืนค่า)
const KEEP = ["file", "fileName", "sourceName", "source", "savedSpec", "generatedFile", "specEdited"];
function docOf(){
  return { assemblies: state.ws.assemblies, surface: state.surface, surfaceOn: state.surfaceOn, layout: state.layout,
           originElevation: state.originElevation, extendEnds: state.extendEnds };
}
function docSnap(){
  const d = docOf();
  // key: ไม่รวม KEEP และตำแหน่งสำรองของจุดเกาะ (server เขียนทับทุกครั้งที่รัน ไม่ใช่การกระทำของผู้ใช้)
  const key = JSON.stringify(d, function(k, v){
    if (KEEP.includes(k)) return undefined;
    if ((k === "x" || k === "y") && (this.type === "baseline" || this.type === "point")) return undefined;
    return v;
  });
  return { full: JSON.stringify(d), key };
}
function applyDoc(full){
  const d = JSON.parse(full), cur = new Map(allItems().map(i => [i.id, i]));
  for (const a of d.assemblies) for (const it of a.items){
    const o = cur.get(it.id);
    if (!o) continue;
    for (const k of KEEP){ if (k in o) it[k] = o[k]; else delete it[k]; }
    if (it.attach.type !== "free"){ it.attach.x = o.attach.x; it.attach.y = o.attach.y; }
  }
  state.ws.assemblies = d.assemblies;
  for (const k of ["surface", "surfaceOn", "layout", "originElevation", "extendEnds"]) state[k] = d[k];
  // ตัวที่แก้อยู่หายไป / ไม่มีส่วนที่วาดแล้ว = ออกจาก Edit · เส้นที่วาดค้างอยู่อ้างจุดที่อาจหายไป = เริ่มใหม่
  const ed_ = itemById(state.editing);
  if (state.editing && !(ed_ && ed_.spec)) state.editing = null;
  draw.chain = []; draw.cand = null;
  fixSel();
}
// ที่เลือกอ้างของที่ไม่มีแล้ว -> ตัดออก / เลือกตัวที่อยู่ในนั้นแทน
function fixSel(){
  const s = state.sel, it = s.item ? itemById(s.item) : null;
  const ok = o => o.type === "item" ? !!itemById(o.item) : !!(itemById(o.item) && specObj(itemById(o.item), o));
  if (s.type === "multi"){ state.sel = { ...s, list: s.list.filter(ok) }; if (state.sel.list.length < 2) state.sel = state.sel.list[0] || (state.editing ? { type:"item", item: state.editing } : { type:"ws" }); }
  else if (s.item && !it) state.sel = { type:"ws" };
  else if (/^d(pt|link|shape)$/.test(s.type) && !ok(s)) state.sel = { type:"item", item: s.item };
  else if (s.type === "spt" && !state.surface[s.i]) state.sel = { type:"surface" };
  else if (s.type === "asm" && !asmById(s.asm)) state.sel = { type:"ws" };
}

const History = makeHistory(docSnap, applyDoc);

function undoRedo(redo){
  const l = History.step(redo);
  if (l == null){ flashBanner(redo ? "ไม่มีอะไรให้ Redo" : "ไม่มีอะไรให้ Undo"); return; }
  persist(); run(); renderAll();
  flashBanner(`${redo ? "Redo" : "Undo"}: ${l}`);
}
// ข้อความสั้นในแถบบอก แล้วกลับไปข้อความเดิมของเครื่องมือ
function flashBanner(t){
  showBanner(t);
  setTimeout(() => { if ($("banner").textContent === t) showBanner(draw.tool ? drawBanner() : ""); }, 1500);
}
