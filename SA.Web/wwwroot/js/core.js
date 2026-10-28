// SA Drawing Studio — ส่วนกลาง: state, ตัวช่วย, ระบบพิกัด, โครงข้อมูล workspace
//
// workspace มีได้หลาย assembly; แต่ละ assembly มีแกน (baseline) ของตัวเอง และรายการ subassembly (item)
//   item = { id, file | (sourceName + source), name?, className, params, attach }
//   attach = { type: baseline | point | free, parent, code, index, x, y }  (แบบเดียวกับ AssemblyService)
// พิกัดบนจอ: X = ระยะแนวราบ, Y = ระดับเทียบ datum (ระดับจริง = originElevation + Y)
// ไฟล์ทั้งหมดในโฟลเดอร์ js/ เป็น script ธรรมดา (ไม่ใช่ module) ใช้ตัวแปรร่วมกัน โหลดตามลำดับใน index.html
"use strict";
const $ = id => document.getElementById(id);
const svg = $("view"), main = $("main"), tip = $("tip");
const NS = "http://www.w3.org/2000/svg";
const DEFAULT_SURFACE = [{x:-12,y:-0.8},{x:0,y:-1.4},{x:12,y:-3.8}];
const PALETTE = ["--l1","--l2","--l3","--l4","--l5","--l6","--l7","--l8"];
const OPENED = "\u0001opened";   // state.file ของไฟล์ที่เปิดจากเครื่อง (ปุ่ม เปิดจากเครื่อง…)
const GENERATED = "\u0002gen:";  // state.file = GENERATED + item id: โค้ดที่สร้างจากส่วนที่วาด (ยังไม่มีไฟล์)
const SNAP_PX = 14;
const NO_SERVER = "server ไม่ตอบ — หน้าต่าง run-viewer ยังเปิดอยู่ไหม?";

// ---------------- state ----------------
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
};
function newId(prefix){ return (prefix || "s") + Math.random().toString(36).slice(2, 8); }
function defaultBar(){
  return { grid: true, snap: false, ortho: false, slopes: ["1:1.5", "1:2", "1:3"], slope: -1,
           osnap: { end: true, mid: false, int: true, surf: true, perp: false, near: false } };
}
function newAssembly(name, baseline){ return { id: newId("a"), name, baseline: baseline || { x: 0, y: 0 }, items: [] }; }
function baseState(){
  return {
    ws: { assemblies: [newAssembly("Assembly 1")], name: null },
    sel: { type: "ws" },        // สิ่งที่เลือกอยู่ (ดู setSel ใน ui.js)
    open: {},                   // โหนดในต้นไม้ที่กางไว้
    editing: null,              // id ของ subassembly ที่อยู่ใน Edit mode
    surface: DEFAULT_SURFACE.map(p => ({...p})),
    surfaceOn: true, layout: false, originElevation: 100, extendEnds: true,
    view: { cx: 1.5, cy: -1.8, scale: 42, ve: 1 },
    showCodes: true, bar: defaultBar(),
    file: null,                 // ไฟล์ที่แถบแก้โค้ดเปิดอยู่ (ตาม subassembly ที่เลือก)
    dock: { open: true, tab: "msg" },
    editorOpen: false
  };
}
function loadState(){
  const s = store.get("sa3.state", null);
  if (s){
    const st = Object.assign(baseState(), s);
    st.bar = Object.assign(defaultBar(), s.bar);
    st.bar.osnap = Object.assign(defaultBar().osnap, s.bar && s.bar.osnap);
    if (!st.ws.assemblies || !st.ws.assemblies.length) st.ws.assemblies = [newAssembly("Assembly 1")];
    return st;
  }
  // ครั้งแรกหลังอัปเดต: ย้ายค่าจาก viewer เดิม (โหมด Assembly หรือไฟล์เดียว) เข้า workspace
  const old = store.get("sav2.state", {}), st = baseState();
  for (const k of ["surface", "surfaceOn", "layout", "originElevation", "extendEnds", "showCodes", "edWidth", "editorOpen"])
    if (old[k] != null) st[k] = old[k];
  if (old.view) st.view = old.view;
  if (old.snap) st.bar.snap = true;
  const asm = st.ws.assemblies[0], oa = old.asm || {};
  if (oa.items && oa.items.length){
    asm.baseline = oa.baseline || { x: 0, y: 0 };
    asm.items = oa.items.map(it => ({ params: {}, ...it }));
    st.ws.name = oa.name || null;
  } else if (old.file && old.file !== OPENED){
    // โหมดไฟล์เดียวเดิม = assembly ที่มี subassembly ตัวเดียวเกาะแกนที่ (0, 0)
    asm.items.push({ id: newId(), file: old.file, className: (old.classByFile || {})[old.file] || null,
                     params: { ...((old.values || {})[old.file] || {}) }, attach: { type: "baseline", x: 0, y: 0 } });
  }
  return st;
}
const state = loadState();
const persist = () => store.set("sa3.state", state);

let files = [], projFiles = [], opened = null;   // opened = {name, text, handle, lastModified}
let asmRes = {};                                  // item id -> ผลจาก /api/assembly
let resp = null, result = null;                   // ผลของ subassembly ที่เลือก ในรูปแบบเดิม (ใช้กับกรอบแดง / แถบโค้ด)
let addMode = false, hoverPt = -1, drag = null, lastSegDown = null;
const codeColor = {};

// ---------------- workspace ----------------
const WS = () => state.ws;
const asms = () => WS().assemblies;
const allItems = () => asms().flatMap(a => a.items);
const asmById = id => asms().find(a => a.id === id) || null;
const itemById = id => allItems().find(i => i.id === id) || null;
const asmOfItem = id => asms().find(a => a.items.some(i => i.id === id)) || null;
const itemLabel = it => it ? (it.name || it.file || it.sourceName || it.fileName || (it.spec ? it.spec.className : "") || "?") : "";
const fileOf = it => it ? (it.file || it.sourceName || "") : "";
// subassembly ที่เกี่ยวกับสิ่งที่เลือก (ตัวมันเอง หรือจุด/link/shape/parameter ของมัน)
const fileKey = () => state.file === OPENED ? "opened:" + (opened ? opened.name : "") : state.file || "";
const selItemId = () => state.sel.item || null;
const selItem = () => itemById(selItemId());
// assembly ที่ใช้อ้างอิง: ของสิ่งที่เลือก ถ้าไม่ได้เลือกใช้ตัวแรก
function curAsm(){
  const s = state.sel;
  return (s.asm && asmById(s.asm)) || (s.item && asmOfItem(s.item)) || asms()[0];
}
// ลูกหลานของ item (ใช้กันเกาะวน, mirror, ย้าย assembly)
function descendants(id){
  const a = asmOfItem(id), out = new Set(), stack = [id];
  if (!a) return out;
  while (stack.length){
    const cur = stack.pop();
    for (const it of a.items) if (it.attach.type === "point" && it.attach.parent === cur && !out.has(it.id)){ out.add(it.id); stack.push(it.id); }
  }
  return out;
}
// ok / w / e / n (ยังไม่มีผล) — รวมผลจาก server (โค้ด) และส่วนที่วาด (drawRes ใน draw.js)
function itemStatus(id){
  const it = itemById(id), r = asmRes[id], d = drawRes[id];
  const drawWarn = d && d.issues.length;
  if (it && !it.file && !it.sourceName && !r) return !d ? "n" : it.attach.type === "free" || drawWarn ? "w" : "ok";
  if (!r) return "n";
  if (!r.ok || (r.result && r.result.exception)) return "e";
  if (r.attachState === "lost" || r.attachState === "free" || drawWarn || (r.result && r.result.issues.some(i => i.level !== "Informational"))) return "w";
  return "ok";
}
// parameter Side ของ item (จากโค้ด หรือจาก spec ที่วาด)
function sideDef(id){
  const r = asmRes[id], it = itemById(id);
  const code = r && r.result ? r.result.params.find(p => /^side$/i.test(p.name) && p.kind === "long") : null;
  if (code) return code;
  const sp = it && it.spec && it.spec.side ? it.spec.params.find(p => p.name === it.spec.side.param) : null;
  return sp ? { name: sp.name, kind: sp.kind, default: sp.default } : null;
}
function sideOf(it){
  const def = sideDef(it.id);
  if (!def) return null;
  const v = def.name in (it.params || {}) ? it.params[def.name] : def.default;
  return +v === 1 ? 1 : 0;
}

// ---------------- ตัวช่วย ----------------
function el(tag, attrs, parent){
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
// สีอ่านจาก workspace (ชุดสีมืดของ #center) ไม่ใช่จากธีมของหน้า
let cssCache = null;
const css = v => (cssCache ||= getComputedStyle(main)).getPropertyValue(v).trim();
function colorFor(code){
  if (!code) return css("--l8");
  if (!(code in codeColor)) codeColor[code] = PALETTE[Object.keys(codeColor).length % (PALETTE.length - 1)];
  return css(codeColor[code]);
}
const primaryCode = codes => codes.find(c => c !== "Datum") || codes[0] || "";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const f3 = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3);
const snapV = v => state.bar.snap ? Math.round(v / 0.05) * 0.05 : v;
// slope dy/dx -> "1:x" (ดิ่ง:ราบ) และ %
function slopeText(dx, dy){
  if (Math.abs(dx) < 1e-9) return "ดิ่ง";
  const g = dy / dx;
  if (Math.abs(g) < 1e-9) return "ราบ (0%)";
  return `1:${(Math.abs(1 / g)).toFixed(3).replace(/\.?0+$/, "")} ${g < 0 ? "ลง" : "ขึ้น"} (${(g * 100).toFixed(1)}%)`;
}

// ---------------- coordinates ----------------
let W = 800, H = 600;
const sx = x => W/2 + (x - state.view.cx) * state.view.scale;
const sy = y => H/2 - (y - state.view.cy) * state.view.scale * state.view.ve;
const wx = px => state.view.cx + (px - W/2) / state.view.scale;
const wy = py => state.view.cy - (py - H/2) / (state.view.scale * state.view.ve);
const elevOf = y => state.originElevation + y;
const offOf = (x, a) => x - (a || curAsm()).baseline.x;
function evtPos(e){ const r = svg.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; }

// ---------------- สถานะ server ----------------
function setStatus(kind, txt){
  $("srv-dot").className = "dot" + (kind === "off" ? " off" : kind === "busy" ? " busy" : "");
  $("srv-txt").textContent = txt;
  $("srv").title = txt;
}
