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
  // snap = Grid snap (F9) ทีละ gridStep m · osOn = OSNAP ทั้งหมด (F3) · osnap = ชนิดที่เปิดอยู่
  // track = Object snap tracking (F11), trackMs = เวลาชี้ค้างเพื่อจับจุด · cen = Center (ศูนย์กลางโค้ง / polygon ด้านเท่า)
  // aux = แสดง Auxiliary (ซ่อน = snap ไม่ได้ด้วย) · c3d = ดูแบบ Civil 3D (ซ่อน aux + ของที่ไม่ถูกส่งออก, สีกลาง ไม่ใช้ style)
  // style = ใช้ style by code (.style.json + override) · ปิด = สีอัตโนมัติ (round 10)
  // annot = show notes / dimensions / slope labels (round 10 M2; hidden in c3d, the value is kept)
  // ptnames = point names P1, P2 … (#index for hand-written code) outside Edit too (round 10 M3; off by default, hidden in c3d)
  return { grid: true, snap: false, gridStep: 0.05, ortho: false, slopes: ["1:1.5", "1:2", "1:3"], slope: -1, osOn: true, track: false, trackMs: 500, aux: true, c3d: false, style: true, annot: true, ptnames: false,
           osnap: { end: true, mid: false, cen: true, int: true, surf: true, perp: false, near: false } };
}
// แสดง / snap / คลุมเลือก object auxiliary ได้ไหม (ปุ่ม Aux เปิด และไม่ได้อยู่ในโหมดดูแบบ Civil 3D)
const auxShown = () => state.bar.aux !== false && !state.bar.c3d;
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
    editorOpen: false,
    ribbon: { tab: "home" }     // ribbon tab (js/ribbon.js) · palettes: js/dock.js (per machine)
  };
}
// Round 8: each browser tab holds its own project. The tab's workspace lives in sessionStorage (survives a reload of
// that tab only); localStorage "sa3.state" keeps a copy of the last tab that changed something (restores unsaved work
// after the browser was closed, see Proj.start in project.js).
const TAB = (() => {
  let t = null;
  try{ t = sessionStorage.getItem("sa.tab"); }catch{}
  if (!t){ t = newId("t") + newId(""); try{ sessionStorage.setItem("sa.tab", t); }catch{} }
  return t;
})();
const tabStore = {
  get(k){ try{ const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; }catch{ return null; } },
  set(k, v){ try{ sessionStorage.setItem(k, JSON.stringify(v)); }catch{} }
};
let tabReloaded = false;   // this tab had a workspace already (reload): keep it, only re-attach its project
function loadState(){
  const mine = tabStore.get("sa3.state");
  tabReloaded = !!mine;
  const s = mine || store.get("sa3.state", null);
  if (s){
    const st = Object.assign(baseState(), s);
    st.bar = Object.assign(defaultBar(), s.bar);
    st.bar.osnap = Object.assign(defaultBar().osnap, s.bar && s.bar.osnap);
    if (!st.ws.assemblies || !st.ws.assemblies.length) st.ws.assemblies = [newAssembly("Assembly 1")];
    st.view.scale = View.clampScale(st.view.scale);            // ซูมที่จำไว้ต้องอยู่ในช่วงที่ใช้ได้
    // panel sizes / bottom dock of the layout before round 9 (now dockview palettes, js/dock.js)
    for (const k of ["dock", "edWidth", "leftW", "rightW", "scH", "scFold", "drawerH", "drawerFold"]) delete st[k];
    return st;
  }
  // ครั้งแรกหลังอัปเดต: ย้ายค่าจาก viewer เดิม (โหมด Assembly หรือไฟล์เดียว) เข้า workspace
  const old = store.get("sav2.state", {}), st = baseState();
  for (const k of ["surface", "surfaceOn", "layout", "originElevation", "extendEnds", "showCodes", "editorOpen"])
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
// บันทึกลงเบราว์เซอร์ + นับก้อน Undo (history.js) — ระหว่างลาก / พิมพ์ในช่อง Properties ยังไม่นับ
const persist = () => { tabStore.set("sa3.state", state); store.set("sa3.state", state); if (!drag && !typingInProps()) History.track(); };

// ---------------- project of this tab (round 8) ----------------
// The server knows the tab's project by a handle sent in the X-SA-Project header on every /api/ request.
// Proj.opening = a project is being opened / re-attached: other requests wait for it.
// A 409 { projectLost } (server restarted) re-attaches the same project by path and retries once.
const rawFetch = window.fetch.bind(window);
const Proj = {
  handle: null, readOnly: false, opening: null, settings: null,
  notify(){},                                   // mcp.js: tells the page socket which project this tab holds
  async post(url, body){
    const r = await rawFetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(this.handle ? { "X-SA-Project": this.handle } : {}) },
                                    body: JSON.stringify(body || {}) }).catch(() => null);
    return r ? r.json().catch(() => ({ ok: false, message: "server ตอบผิดรูปแบบ" })) : { ok: false, message: NO_SERVER };
  },
  use(r){ this.handle = r.handle; this.readOnly = !!r.readOnly; WS().readOnly = this.readOnly; this.notify(); },
  // same project again (server restart / tab reload): the workspace stays as it is
  attach(){
    if (!this.opening) this.opening = (async () => {
      const r = WS().path ? await this.post("/api/project/open", { path: WS().path, tab: TAB }) : null;
      if (r && r.ok){ this.use(r); return r; }
      const s = await this.post("/api/project/scratch", { tab: TAB });
      if (s.ok) this.use(s);
      return r;
    })().finally(() => { this.opening = null; });
    return this.opening;
  }
};
const PROJECT_ROUTES = /^\/api\/(project\/(open|new|scratch)|settings|fs\/)/;
window.fetch = async (url, opt) => {
  if (typeof url !== "string" || !url.startsWith("/api/") || PROJECT_ROUTES.test(url)) return rawFetch(url, opt);
  // wait only while the tab has no handle yet (the opening itself reads specs once it has one)
  if (Proj.opening && !Proj.handle) await Proj.opening.catch(() => {});
  const go = () => {
    const o = Object.assign({}, opt), h = new Headers((opt && opt.headers) || {});
    if (Proj.handle) h.set("X-SA-Project", Proj.handle);
    o.headers = h;
    return rawFetch(url, o);
  };
  let r = await go();
  if (r.status === 409){
    const j = await r.clone().json().catch(() => ({}));
    if (j.projectLost){ await Proj.attach(); r = await go(); }
  }
  return r;
};
window.addEventListener("pagehide", () => {
  if (Proj.handle) rawFetch("/api/project/close", { method: "POST", headers: { "X-SA-Project": Proj.handle }, keepalive: true }).catch(() => {});
});
function typingInProps(){
  const a = document.activeElement;
  return !!a && a.tagName === "INPUT" && a.type !== "checkbox" && !!a.closest("#props");
}

let files = [], projFiles = [], opened = null;   // opened = {name, text, handle, lastModified}
let asmRes = {};                                  // item id -> ผลจาก /api/assembly
let resp = null, result = null;                   // ผลของ subassembly ที่เลือก ในรูปแบบเดิม (ใช้กับกรอบแดง / แถบโค้ด)
let addMode = false, hoverPt = -1, drag = null, lastSegDown = null;

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
// เลือกหลายชิ้น: state.sel = { type:"multi", item (ตัวที่ Edit อยู่ | ไม่มี), list:[{type, item, id | i}] }
//   Edit mode = point / link / shape ที่วาดของตัวที่แก้ · นอก Edit mode = subassembly ทั้งตัว (type "item")
const selList = () => state.sel.type === "multi" ? state.sel.list : [state.sel];
function selMatch(s, type, a, b){
  if (s.type !== type) return false;
  if (type === "asm") return s.asm === a;
  if (type === "item" || type === "params") return s.item === a;
  if (type === "pt" || type === "link" || type === "shape") return s.item === a && s.i === b;
  if (type === "dpt" || type === "dlink" || type === "dshape" || type === "dann") return s.item === a && s.id === b;
  if (type === "pann") return s.id === a;                 // project-level (cross-item) annotation (round 10 M3)
  if (type === "spt") return s.i === a;
  return true;
}
const selHas = (type, a, b) => selList().some(s => selMatch(s, type, a, b));
// assembly ที่ใช้อ้างอิง: ของสิ่งที่เลือก ถ้าไม่ได้เลือกใช้ตัวแรก
function curAsm(){
  const s = state.sel;
  return (s.asm && asmById(s.asm)) || (s.item && asmOfItem(s.item)) || (s.list && s.list[0] && asmOfItem(s.list[0].item)) || asms()[0];
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
// automatic colour of a code: palette index from a stable hash of the name (js/style.js), same on every machine / session
function colorFor(code){
  if (!code) return css("--l8");
  return css(PALETTE[Style.autoIndex(code)]);
}
const primaryCode = codes => codes.find(c => c !== "Datum") || codes[0] || "";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const f3 = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3);
// ซูม / ทศนิยมตามซูม (view.js)
const clampScale = View.clampScale;
const fz = v => View.fmt(v, state.view.scale);
const snapV = v => { const g = state.bar.gridStep; return state.bar.snap && g > 0 ? +(Math.round(v / g) * g).toFixed(9) : v; };
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
