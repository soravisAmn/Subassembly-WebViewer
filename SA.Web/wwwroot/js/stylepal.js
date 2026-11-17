// Style by code on the page (round 10 M1, docs/display.md). The pure rules are in js/style.js (Style); this file holds:
//   - the style file of the tab's project: WS().styleFile (project key, relative path) + the loaded style (StyleNow)
//     Unsaved style edits live in WS().styleDraft { file, text } (kept on reload of the tab; Save style writes the file)
//   - resolveStyle() for the workspace, the legend and the AI proposal preview (one resolver, no duplicated colour logic)
//   - SVG helpers: linkLook / shapeLook / pointMarker / hatch patterns (screen-constant weights, hatch scaled with zoom)
//   - the Style palette (dockview panel "style") and the "Display" section of Properties (per-object override via the Logic API)
"use strict";

const StyleNow = { file: null, style: null, saved: null, missing: false, error: null, calls: 0 };   // saved = text on disk (null = none)

// ---------------- which file, load, save ----------------
// the project's style file: the key, else {project}.style.json (used only if it exists), else none (automatic colours)
const styleFileName = () => WS().styleFile || (WS().path ? projBaseName() + ".style.json" : null);
const styleDirty = () => !!WS().styleDraft;
const curStyle = () => StyleNow.style;

async function loadStyle(){
  StyleNow.calls++;
  const file = styleFileName(), d = WS().styleDraft;
  StyleNow.file = file; StyleNow.missing = false; StyleNow.error = null;
  // an unsaved edit of this same file (tab reload) wins over the file on disk
  if (d && d.file === file){
    const p = Style.parse(d.text);
    if (p.ok){ StyleNow.style = p.style; StyleNow.saved = null; afterStyle(); return; }
  }
  WS().styleDraft = null;
  StyleNow.style = null; StyleNow.saved = null;
  if (!file){ afterStyle(); return; }
  const r = await fetch("/api/style?file=" + encodeURIComponent(file)).then(x => x.json()).catch(() => null);
  if (StyleNow.file !== file) return;                  // another project was opened meanwhile
  if (r && r.ok){
    const p = Style.parse(r.text);
    if (p.ok){ StyleNow.style = p.style; StyleNow.saved = r.text; if (p.warnings.length) setStatus("warn", `${file}: ${p.warnings.slice(0, 3).join(" · ")}`); }
    else { StyleNow.error = p.error; setStatus("warn", `${file}: ${p.error} — ใช้สีอัตโนมัติ`); }
  } else if (r && r.notFound) StyleNow.missing = !!WS().styleFile;   // the default name that does not exist is not "missing"
  else if (r) StyleNow.error = r.message;
  afterStyle();
}
function afterStyle(){ persist(); render(); renderStylePal(true); renderProps(true); }
// a palette edit: keep the draft, redraw
function styleChanged(){
  WS().styleDraft = { file: StyleNow.file || styleFileName(), text: Style.serialize(StyleNow.style) };
  afterStyle();
}
async function saveStyle(){
  if (!StyleNow.style) return;
  if (Proj.readOnly) return alert("โปรเจกต์นี้เปิดอยู่ในแท็บอื่น — แท็บนี้บันทึก style ไม่ได้");
  const file = StyleNow.file || styleFileName();
  if (!file) return alert("Save project ก่อน — ไฟล์ style อยู่คู่กับไฟล์โปรเจกต์ ({ชื่อโปรเจกต์}.style.json)");
  const text = Style.serialize(StyleNow.style);
  const r = await fetch("/api/style/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file, text }) })
    .then(x => x.json()).catch(() => ({ ok: false, message: NO_SERVER }));
  if (!r.ok) return alert(r.message || "บันทึก style ไม่สำเร็จ");
  WS().styleDraft = null; StyleNow.saved = text; StyleNow.file = file; StyleNow.missing = false;
  const keyNew = WS().styleFile !== file;
  WS().styleFile = file;                               // the project file points at it from now on (Save project writes the key)
  afterStyle(); renderProjName();
  setStatus("ok", `บันทึก ${file} แล้ว${keyNew ? " — Save project เพื่อเก็บว่าโปรเจกต์ใช้ไฟล์นี้" : ""}`);
}
// "สร้าง style จากสีที่เห็นตอนนี้": every code in the project gets the link colour it shows now (codes already styled keep theirs)
function styleFromColours(){
  const codes = projectCodes();
  if (!codes.length) return flashBanner("ยังไม่มี code ในโปรเจกต์");
  const st = StyleNow.style ? JSON.parse(JSON.stringify(StyleNow.style)) : Style.empty();
  const add = Style.fromColours(codes, c => hexOf(resolveStyle("link", [c], null, { c3d: false }).color));
  let n = 0;
  for (const [c, e] of Object.entries(add.codes)){
    const cur = st.codes[c] && st.codes[c].link;
    if (cur && cur.color) continue;
    Style.setField(st, c, "link", { color: e.link.color }); n++;
  }
  StyleNow.style = st;
  if (!StyleNow.file) StyleNow.file = styleFileName();
  styleChanged();
  if (typeof Dock !== "undefined" && Dock) Dock.show("style");
  flashBanner(`เขียนสีของ ${n} code ลง style แล้ว — กด Save style เพื่อบันทึกไฟล์`);
}
// "Open style file…": point the project at another style file (e.g. a shared template, also outside the folder)
async function openStyleFile(){
  if (styleDirty() && !confirm("style ที่แก้ไว้ยังไม่ได้ Save — ทิ้งแล้วเปิดไฟล์อื่น?")) return;
  const p = await fileDialog({ title: "Open style file", mode: "open", exts: [".style.json"], start: WS().dir });
  if (!p) return;
  if (!/\.style\.json$/i.test(p)) return alert("ต้องเป็นไฟล์ *.style.json");
  await useStyleFile(p);
}
async function useStyleFile(fullPath){
  const x = await fetch("/api/project/relink", { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ path: fullPath, sep: ProjectV3.sepOf(allItems().map(i => i.file)) }) }).then(y => y.json()).catch(() => ({ ok: false, message: NO_SERVER }));
  if (!x.ok){ alert(x.message); return false; }
  WS().styleFile = x.file; WS().styleDraft = null;
  await loadStyle();
  renderProjName();
  setStatus("ok", `ใช้ style ${x.file}${x.outside ? " (นอกโฟลเดอร์โปรเจกต์ — Pack จะ copy เข้ามาให้)" : ""} — Save project เพื่อเก็บ`);
  return true;
}

// ---------------- resolve + draw ----------------
// opts override the view state (tests / "สร้าง style": { c3d: false })
function resolveStyle(kind, codes, override, opts){
  const o = Object.assign({ useStyle: state.bar.style !== false, c3d: !!state.bar.c3d, auto: colorFor }, opts || {});
  return Style.resolve(kind, codes || [], override || null, StyleNow.style, o);
}
const ovrOf = (spec, id) => spec && spec.display && spec.display.overrides ? spec.display.overrides[id] || null : null;
// #rgb / #rrggbb / rgb() -> #rrggbb (colour inputs need 6 digits)
function hexOf(c){
  c = String(c || "").trim();
  let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (m) return "#" + m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
  if (/^#[0-9a-f]{6}/i.test(c)) return c.slice(0, 7).toLowerCase();
  m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(c);
  if (m) return "#" + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, "0")).join("");
  return "#9a9ea6";
}
// link: colour always; weight / linetype only when the style sets them (unstyled links keep their CSS look: drawn 3 px, follow-surface dash)
function linkLook(st){
  const css = [];
  if (st.set.includes("weight")) css.push(`stroke-width:${Style.weightPx(st.weight)}px`);
  if (st.set.includes("linetype") && st.linetype !== "solid") css.push(`stroke-dasharray:${Style.dash(st.linetype)}`);
  else if (st.set.includes("linetype")) css.push("stroke-dasharray:none");
  return css.length ? { stroke: st.color, style: css.join(";") } : { stroke: st.color };
}
// shape: no fill / alpha in the style = the workspace's default shape fill (CSS --shape)
function shapeLook(st){
  if (!st || !(st.set.includes("fill") || st.set.includes("alpha"))) return {};
  return { style: `fill:${st.fill || css("--l1")};fill-opacity:${st.alpha}` };
}
let hatchDefs = null, hatchIds = {};
function hatchReset(){ hatchDefs = null; hatchIds = {}; }
// url(#…) of a pattern for this frame (userSpaceOnUse, tile from the zoom, anchored at the workspace origin so it pans with the drawing)
function hatchFill(h){
  const t = Style.hatchTile(h, state.view.scale);
  if (!t) return null;
  if (hatchIds[t.key]) return `url(#${hatchIds[t.key]})`;
  if (!hatchDefs) hatchDefs = el("defs", {}, svg);
  const id = "hatch" + Object.keys(hatchIds).length;
  const p = el("pattern", { id, patternUnits: "userSpaceOnUse", width: t.w, height: t.h,
                            patternTransform: `translate(${sx(0).toFixed(1)} ${sy(0).toFixed(1)}) rotate(${-t.angle})` }, hatchDefs);
  p.innerHTML = t.body;
  hatchIds[t.key] = id;
  return `url(#${id})`;
}
// drawn point marker. st = null: the default square (ghost points). attrs carry data-kind / data-id (hit target)
function pointMarker(st, x, y, cls, attrs, grp){
  const s = st ? st.size : 8, h = s / 2, mk = st ? st.marker : "square";
  const col = st && st.set.includes("color") ? { style: `stroke:${st.color}` } : {};
  const a = { class: cls, ...attrs, ...(col.style ? { style: (attrs.style ? attrs.style + ";" : "") + col.style } : {}) };
  if (mk === "circle") return el("circle", { cx: x, cy: y, r: h, ...a }, grp);
  if (mk === "triangle") return el("path", { d: `M${x} ${y - h}L${x + h} ${y + h * 0.8}L${x - h} ${y + h * 0.8}Z`, ...a }, grp);
  if (mk === "cross" || mk === "none"){
    if (mk === "cross") el("path", { d: `M${x - h} ${y - h}L${x + h} ${y + h}M${x + h} ${y - h}L${x - h} ${y + h}`, class: cls + " mk-cross", ...col }, grp);
    return el("rect", { x: x - Math.max(h, 4), y: y - Math.max(h, 4), width: Math.max(s, 8), height: Math.max(s, 8), ...attrs, class: "dpt-hit" }, grp);
  }
  return el("rect", { x: x - h, y: y - h, width: s, height: s, ...a }, grp);
}

// ---------------- codes of the project ----------------
function projectCodes(){
  const set = new Set();
  const add = list => { for (const c of list || []) if (c) set.add(c); };
  for (const it of allItems()){
    if (it.spec) for (const o of [...it.spec.points, ...it.spec.links, ...it.spec.shapes]) if (!Spec.isAux(o)) add(o.codes);
    const r = asmRes[it.id] && asmRes[it.id].result;
    if (r && !asmRes[it.id].generated) for (const o of [...r.points, ...r.links, ...r.shapes]) add(o.codes);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ---------------- Style palette ----------------
const WEIGHTS = [0.13, 0.18, 0.25, 0.30, 0.35, 0.50, 0.70, 1.00, 1.40, 2.00];
const LT_TH = { solid: "solid (ต่อเนื่อง)", dashed: "dashed (ประ)", center: "center (ศูนย์กลาง)", hidden: "hidden (ซ่อน)" };
const MK_TH = { square: "สี่เหลี่ยม", circle: "วงกลม", cross: "กากบาท", triangle: "สามเหลี่ยม", none: "ไม่แสดง" };
function renderStylePal(force){
  const box = $("style-pal");
  if (!box || !palShown("style")) return;
  if (!force && box.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) return;
  const file = StyleNow.file || styleFileName(), dirty = styleDirty(), ro = !!Proj.readOnly;
  $("style-of").innerHTML = file ? `<span class="mono">${esc(ProjectV3.baseName(file))}</span>${dirty ? " *" : ""}` : "(ยังไม่มีไฟล์ style)";
  $("style-of").title = file || "Save project ก่อน แล้ว Save style จะสร้าง {ชื่อโปรเจกต์}.style.json";
  box.innerHTML = "";
  const bar = div("btns", null, box);
  bar.append(btn("Save style", saveStyle, !StyleNow.style || !dirty || ro || !file,
                 ro ? "แท็บนี้อ่านอย่างเดียว" : !file ? "Save project ก่อน" : "บันทึกไฟล์ style (แยกจาก Save project)"),
             btn("สร้าง style จากสีที่เห็นตอนนี้", styleFromColours, false, "เขียนสีอัตโนมัติของทุก code ลงไฟล์ style (code ที่ตั้งสีไว้แล้วไม่เปลี่ยน)"),
             btn("Open style file…", openStyleFile, ro, "ให้โปรเจกต์ใช้ไฟล์ style อื่น (เช่นไฟล์มาตรฐานที่ใช้ร่วมกัน)"));
  const note = [];
  if (state.bar.c3d) note.push("ดูแบบ Civil 3D อยู่: รูปใช้สีกลาง ไม่ใช้ style");
  else if (state.bar.style === false) note.push("View › Show › Style ปิดอยู่: รูปใช้สีอัตโนมัติ");
  if (StyleNow.missing) note.push(`หาไฟล์ ${file} ไม่เจอ — ใช้สีอัตโนมัติ`);
  if (StyleNow.error) note.push(StyleNow.error);
  if (!StyleNow.style && !StyleNow.missing) note.push("ยังไม่มี style: ทุก code ใช้สีอัตโนมัติ · แก้ค่าด้านล่างเพื่อเริ่มไฟล์ style");
  for (const t of note) div("hint", esc(t), box);
  const used = projectCodes(), only = Object.keys((StyleNow.style && StyleNow.style.codes) || {}).filter(c => !used.includes(c)).sort();
  if (!used.length && !only.length){ div("empty", "ยังไม่มี code ในโปรเจกต์", box); return; }
  const tbl = div("st-list", null, box);
  for (const c of used) styleRow(tbl, c, false);
  for (const c of only) styleRow(tbl, c, true);
}
function styleRow(parent, code, onlyInFile){
  const e = (StyleNow.style && StyleNow.style.codes[code]) || {};
  const L = resolveStyle("link", [code], null, { c3d: false, useStyle: true }), S = resolveStyle("shape", [code], null, { c3d: false, useStyle: true }),
        P = resolveStyle("point", [code], null, { c3d: false, useStyle: true });
  const row = div("st-row" + (onlyInFile ? " only" : ""), null, parent);
  const h = div("st-h", `<i class="st-sw" style="background:${esc(L.color)}"></i><b>${esc(code)}</b>${onlyInFile ? " <small>(มีแค่ในไฟล์ style)</small>" : ""}`, row);
  if (e.link || e.shape || e.point){
    const x = btn("×", () => { for (const k of Style.KINDS) delete e[k]; delete StyleNow.style.codes[code]; styleChanged(); }, false, "ลบ style ของ code นี้ (กลับไปสีอัตโนมัติ)");
    x.className = "st-x"; h.appendChild(x);
  }
  const set = (kind, patch) => {
    if (!StyleNow.style){ StyleNow.style = Style.empty(); StyleNow.file = StyleNow.file || styleFileName(); }
    Style.setField(StyleNow.style, code, kind, patch);
    styleChanged();
  };
  const line = (label, kind) => { const d = div("st-line" + (e[kind] ? " on" : ""), `<span class="st-k" title="${e[kind] ? "ตั้งใน style" : "ค่าอัตโนมัติ / ค่าเริ่มต้น"}">${label}</span>`, row); return d; };
  const color = (d, val, on, title) => { const i = document.createElement("input"); i.type = "color"; i.value = hexOf(val); i.title = title; i.onchange = () => on(i.value); d.appendChild(i); return i; };
  const select = (d, opts, val, on, title) => {
    const s = document.createElement("select"); s.title = title;
    s.innerHTML = opts.map(([v, t]) => `<option value="${esc(String(v))}">${esc(t)}</option>`).join("");
    s.value = String(val); s.onchange = () => on(s.value); d.appendChild(s); return s;
  };
  const reset = (d, kind) => { if (e[kind]){ const b = btn("↺", () => set(kind, Object.fromEntries(Style.FIELDS[kind].map(f => [f, null]))), false, `${kind}: กลับไปค่าอัตโนมัติ`); b.className = "st-x"; d.appendChild(b); } };
  // link
  const dl = line("Link", "link");
  color(dl, L.color, v => set("link", { color: v }), "สีเส้น");
  select(dl, Style.LINETYPES.map(t => [t, LT_TH[t]]), L.linetype, v => set("link", { linetype: v }), "Linetype");
  select(dl, WEIGHTS.map(w => [w.toFixed(2), w.toFixed(2) + " mm"]), (WEIGHTS.find(w => Math.abs(w - L.weight) < 1e-6) ?? 0.25).toFixed(2), v => set("link", { weight: +v }), "Lineweight (ความกว้างบนจอคงที่)");
  reset(dl, "link");
  // shape
  const ds = line("Shape", "shape");
  color(ds, S.fill || css("--l1"), v => set("shape", { fill: v }), "สีพื้น");
  const al = document.createElement("input"); al.type = "number"; al.min = 0; al.max = 1; al.step = 0.05; al.value = S.alpha; al.title = "ความทึบ 0–1"; al.className = "st-num";
  al.onchange = () => { const v = +al.value; if (v >= 0 && v <= 1) set("shape", { alpha: v }); else renderStylePal(true); };
  ds.appendChild(al);
  const hs = select(ds, Object.keys(Style.HATCHES).map(k => [k, Style.HATCHES[k].label]), S.hatch ? S.hatch.pattern : "NONE",
                    v => set("shape", { hatch: v === "NONE" ? null : { ...(e.shape && typeof e.shape.hatch === "object" ? e.shape.hatch : {}), pattern: v } }), "Hatch (ใกล้เคียงของ AutoCAD)");
  if (S.hatch) color(ds, S.hatch.color || "#c8b89a", v => set("shape", { hatch: { ...(typeof e.shape.hatch === "object" ? e.shape.hatch : { pattern: S.hatch.pattern }), color: v } }), "สีลาย hatch");
  hs.classList.add("st-hatch");
  reset(ds, "shape");
  // point
  const dp = line("Point", "point");
  color(dp, P.color || "#e6e8eb", v => set("point", { color: v }), "สี marker");
  select(dp, Style.MARKERS.map(m => [m, MK_TH[m]]), P.marker, v => set("point", { marker: v }), "Marker");
  const sz = document.createElement("input"); sz.type = "number"; sz.min = 2; sz.max = 40; sz.step = 1; sz.value = P.size; sz.title = "ขนาด (px บนจอ)"; sz.className = "st-num";
  sz.onchange = () => { const v = +sz.value; if (v > 0 && v <= 40) set("point", { size: v }); else renderStylePal(true); };
  dp.appendChild(sz);
  reset(dp, "point");
}

// ---------------- Properties: "Display" of one drawn point / link / shape ----------------
// ByCode (default) or custom values stored in the .cs (spec display.overrides) through the Logic API: one Undo step per change
function propsDisplay(box, it, s){
  const kind = DRAWN_KIND[s.type], o = specObj(it, s);
  if (!kind || !o) return;
  const g = group(box, "Display");
  if (Spec.isAux(o)){ div("hint", "Auxiliary ใช้รูปแบบของเว็บ (เส้นประเทา) — ไม่มี style", g); return; }
  if (annCantSave(it)){ div("hint", annCantSave(it) + " (ใช้ ByCode)", g); return; }          // js/annot.js
  const ov = ovrOf(it.spec, o.id), mine = ov && ov[kind];
  const st = resolveStyle(kind, o.codes, ov, { c3d: false, useStyle: true });
  const src = st.source === "override" ? "ค่าเฉพาะชิ้นนี้" : st.source.startsWith("code:") ? `ByCode (${st.source.slice(5)})` : "ByCode (สีอัตโนมัติ)";
  const edit = (patch, label) => { specEdit(sp => Logic.setOverride(sp, o.id, { [kind]: patch }), it, label || `Display ${o.id}`); renderProps(true); };
  const row = div("row", `<label>Style<small>${esc(src)}</small></label>`, g);
  const mode = document.createElement("select");
  mode.innerHTML = `<option value="code">ByCode</option><option value="own">กำหนดเอง</option>`;
  mode.value = mine ? "own" : "code";
  mode.onchange = () => {
    if (mode.value === "own") edit(kind === "link" ? { color: hexOf(st.color) } : kind === "shape" ? { fill: hexOf(st.fill || css("--l1")) } : { marker: st.marker }, `${o.id}: Display กำหนดเอง`);
    else { specEdit(sp => Logic.clearOverride(sp, o.id), it, `${o.id}: กลับไปใช้ ByCode`); renderProps(true); }
  };
  row.appendChild(mode);
  if (state.bar.c3d || state.bar.style === false) div("hint", state.bar.c3d ? "ดูแบบ Civil 3D อยู่: รูปไม่ใช้ style" : "View › Show › Style ปิดอยู่: รูปใช้สีอัตโนมัติ", g);
  if (!mine) return;
  const field = (label, small, input) => { const r = div("row", `<label>${esc(label)}${small ? `<small>${esc(small)}</small>` : ""}</label>`, g); r.appendChild(input); return input; };
  const colorIn = (val, on) => { const i = document.createElement("input"); i.type = "color"; i.value = hexOf(val); i.onchange = () => on(i.value); return i; };
  const selIn = (opts, val, on) => { const x = document.createElement("select"); x.innerHTML = opts.map(([v, t]) => `<option value="${esc(String(v))}">${esc(t)}</option>`).join(""); x.value = String(val); x.onchange = () => on(x.value); return x; };
  const numIn = (val, min, max, step, on) => { const i = document.createElement("input"); i.type = "number"; i.min = min; i.max = max; i.step = step; i.value = val; i.onchange = () => { const v = +i.value; if (v >= min && v <= max) on(v); else renderProps(true); }; return i; };
  if (kind === "link"){
    field("สี", "", colorIn(st.color, v => edit({ color: v })));
    field("Linetype", "", selIn(Style.LINETYPES.map(t => [t, LT_TH[t]]), st.linetype, v => edit({ linetype: v })));
    field("Lineweight", "mm · บนจอกว้างคงที่", selIn(WEIGHTS.map(w => [w.toFixed(2), w.toFixed(2)]), (WEIGHTS.find(w => Math.abs(w - st.weight) < 1e-6) ?? 0.25).toFixed(2), v => edit({ weight: +v })));
  } else if (kind === "shape"){
    field("สีพื้น", "", colorIn(st.fill || css("--l1"), v => edit({ fill: v })));
    field("ความทึบ", "0–1", numIn(st.alpha, 0, 1, 0.05, v => edit({ alpha: v })));
    field("Hatch", "ใกล้เคียงของ AutoCAD", selIn(Object.keys(Style.HATCHES).map(k => [k, Style.HATCHES[k].label]), st.hatch ? st.hatch.pattern : "NONE", v => edit({ hatch: v === "NONE" ? { pattern: "NONE" } : { pattern: v } })));
    if (st.hatch){
      field("สีลาย", "", colorIn(st.hatch.color || "#c8b89a", v => edit({ hatch: { color: v } })));
      field("Scale ลาย", "", numIn(st.hatch.scale || 1, 0.1, 20, 0.1, v => edit({ hatch: { scale: v } })));
    }
  } else {
    field("Marker", "", selIn(Style.MARKERS.map(m => [m, MK_TH[m]]), st.marker, v => edit({ marker: v })));
    field("สี", "", colorIn(st.color || "#e6e8eb", v => edit({ color: v })));
    field("ขนาด", "px บนจอ", numIn(st.size, 2, 40, 1, v => edit({ size: v })));
  }
  div("btns", null, g).append(btn("กลับไปใช้ ByCode", () => { specEdit(sp => Logic.clearOverride(sp, o.id), it, `${o.id}: กลับไปใช้ ByCode`); renderProps(true); }, false,
                                  "ลบค่าเฉพาะชิ้นนี้ ใช้ style ของ code แทน"));
  div("hint", "เก็บใน .cs (เฉพาะเว็บ ไม่มีผลกับ Civil 3D) · ต้อง Save (.cs) ●", g);
}
