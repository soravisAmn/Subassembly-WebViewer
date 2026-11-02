// Max / Min ของจุด (รอบ 4b M2 — prompt-4b.md ข้อ 1, prompt-4b-design.md)
//   ปุ่ม "Max / Min" ใน drawer → คลิกจุด (หรือเลือกจุดไว้แล้วกด) → หน้าต่างถามเป็นประโยค + พรีวิวสด (ข้อความ + เส้นประขอบบนรูป)
//   "จุดอื่น… (คลิกบนรูป)" = ซ่อนหน้าต่างชั่วคราว (เครื่องมือ limitref) แล้วกลับมาพร้อมจุดที่คลิก
//   เก็บลง spec ผ่าน Spec.setLimit (ฟังก์ชันล้วน ใช้ร่วมกับ Logic API ของ prompt-5) · Undo ครั้งเดียว
"use strict";

let limitPreview = null;   // { item, id, spec, r } ระหว่างเปิดหน้าต่าง: spec ทดลอง + ผลคำนวณ (วาดใน render)
let limitPick = null;      // คลิกเลือกจุดอ้างอิงบนรูป: { it, id, st } (หน้าต่างซ่อนอยู่)

// คำกริยาในประโยค = สิ่งที่คุม + ทิศ
const LIMIT_VERBS = [
  ["depth:below", "ต่ำกว่า (วัดแนวดิ่ง)"], ["depth:above", "สูงกว่า (วัดแนวดิ่ง)"],
  ["normal:below", "ต่ำกว่าผิวดิน (วัดตั้งฉาก)"], ["normal:above", "สูงกว่าผิวดิน (วัดตั้งฉาก)"],
  ["length:", "ยาวจากจุดต้นตามแนวเดิม"], ["offset:", "ห่างแนวราบ (ออกด้านนอก) จาก"]
];
// ชื่อ parameter ที่เสนอตามสิ่งที่คุม / อ้างอิง (ชื่อชนกันเติมเลข)
function limitParamNames(st){
  const [m, side] = st.verb.split(":");
  if (m === "depth" && st.ref === "ground") return ["MinDepth", "MaxDepth"];
  if (m === "depth" && st.ref === "elev") return side === "above" ? ["Freeboard", "MaxFreeboard"] : ["MinBelow", "MaxBelow"];
  if (m === "depth") return side === "above" ? ["MinRise", "MaxRise"] : ["MinDrop", "MaxDrop"];
  if (m === "normal") return ["MinCover", "MaxCover"];
  if (m === "length") return ["MinLength", "MaxLength"];
  return ["MinOffset", "MaxOffset"];
}
// สถานะของหน้าต่าง <-> limit ใน spec
function limitStateOf(sp, p, o){
  const L = p.limit;
  if (!L) return { verb: "depth:below", ref: "ground", target: (sp.targets[0] || {}).name || "TargetSurface", elev: "100", min: "2", useMax: false, max: "",
                   params: true, action: "clampWarn", along: o.defaultAlong.depth };
  const r = L.ref || {};
  return { verb: `${L.measure}:${L.measure === "depth" || L.measure === "normal" ? L.side || "below" : ""}`,
           ref: r.type === "point" ? "pt:" + r.id : r.type || (L.measure === "offset" ? "origin" : "ground"), target: r.target || (sp.targets[0] || {}).name || "TargetSurface",
           elev: r.expr || "100", min: L.min || "", useMax: L.max != null && L.max !== "", max: L.max || "", params: false, action: L.action || "clampWarn", along: L.along };
}
function limitFromState(st){
  const [m, side] = st.verb.split(":");
  const ref = m === "normal" ? { type: "ground", target: st.target }
    : st.ref.startsWith("pt:") ? { type: "point", id: st.ref.slice(3) } : st.ref === "elev" ? { type: "elev", expr: st.elev } : { type: st.ref, target: st.target };
  return { measure: m, ...(side ? { side } : {}), ref, min: st.min, max: st.useMax ? st.max : null, action: st.action, along: st.along };
}
// อ้างอิงที่เลือกได้ตามสิ่งที่คุม
function limitRefOptions(sp, id, m){
  const pts = sp.points.filter(q => q.id !== id && !Spec.dependsOn(sp, q.id, id)).map(q => ["pt:" + q.id, `จุด ${q.id}${q.codes.length ? " " + q.codes.join(",") : ""}`]);
  if (m === "depth") return [["ground", "ผิวดิน (ที่ offset ของจุดนี้)"], ["elev", "ระดับจริง…"], ...pts];
  if (m === "offset") return [["origin", "แกน (origin)"], ...pts];
  return [];
}

// เปิดหน้าต่างของจุด id (st = สถานะเดิมตอนกลับจากคลิกจุดอ้างอิง)
function openLimit(it, id, st){
  const sp = it.spec, p = Spec.byId(sp.points, id);
  if (!p) return;
  const o = Spec.limitOptions(sp, id);
  if (!o.ok){
    openDialog(`Max / Min — ${id}`, b => {
      div("hint", `ตั้ง Max / Min ที่ ${esc(id)} ไม่ได้: ${esc(o.why)}`, b);
      div("btns", null, b).append(btn("ปิด", closeDialog));
    });
    return;
  }
  st = st || limitStateOf(sp, p, o);
  $("modal").classList.add("side");                // หน้าต่างชิดขวา ไม่บังรูป — เห็นพรีวิวบนรูป
  openDialog(`Max / Min — ${id}${p.codes.length ? " " + p.codes.join(",") : ""}`, b => build(b));

  function build(b){
    b.innerHTML = "";
    const [m] = st.verb.split(":");
    // คำกริยาที่จุดนี้คุมได้ / ขยับแบบที่ใช้ได้
    const verbs = LIMIT_VERBS.filter(([v]) => o.measures.includes(v.split(":")[0]));
    if (!o.along[m].includes(st.along)) st.along = o.defaultAlong[m];
    const refs = limitRefOptions(sp, id, m);
    if (refs.length && !refs.some(([v]) => v === st.ref)) st.ref = refs[0][0];
    const sel = (opts, val, on, cls) => {
      const s = document.createElement("select"); if (cls) s.className = cls;
      s.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(""); s.value = val;
      s.onchange = () => { on(s.value); build(b); };
      return s;
    };
    const txt = (val, on, ph, w) => {
      const i = document.createElement("input"); i.type = "text"; i.className = "expr lim-num"; i.value = val; i.placeholder = ph || ""; if (w) i.style.width = w;
      i.oninput = () => { on(i.value.trim()); check(i, i.value.trim()); preview(); };
      return i;
    };
    const names = specNames(it), xo = Spec.exprOpts(sp, id);
    const check = (i, v) => { const r = !v ? { ok: true } : Expr.check(v, names, xo); i.classList.toggle("bad", !r.ok); i.title = r.ok ? "" : r.error; return r.ok; };

    // ---- ประโยค ----
    const s1 = div("lim-sentence", `<span>จุด <b>${esc(id)}</b> ต้อง</span>`, b);
    s1.append(sel(verbs, st.verb, v => { st.verb = v; }));
    if (m === "length") s1.insertAdjacentHTML("beforeend", `<span>${esc(o.start || "origin")}</span>`);
    if (refs.length) s1.append(sel(refs, st.ref, v => { st.ref = v; }));
    if (st.ref === "elev" && m === "depth"){ const i = txt(st.elev, v => { st.elev = v; }, "ระดับจริง เช่น DesignWL", "110px"); s1.append(i); check(i, st.elev); }
    s1.insertAdjacentHTML("beforeend", "<span>อย่างน้อย</span>");
    const iMin = txt(st.min, v => { st.min = v; }, "ว่าง = ไม่คุม", "80px"); s1.append(iMin);
    s1.insertAdjacentHTML("beforeend", "<span>ม.</span>");
    const s2 = div("lim-sentence", null, b);
    const cb = document.createElement("label"); cb.className = "check";
    cb.innerHTML = `<input type="checkbox"${st.useMax ? " checked" : ""}> และไม่เกิน`;
    cb.querySelector("input").onchange = e => { st.useMax = e.target.checked; build(b); };
    s2.append(cb);
    const iMax = txt(st.max, v => { st.max = v; }, "", "80px"); iMax.disabled = !st.useMax; s2.append(iMax);
    s2.insertAdjacentHTML("beforeend", "<span>ม.</span>");
    if (st.min) check(iMin, st.min);
    if (st.useMax) check(iMax, st.max);
    // อ้างอิงผิวดิน + หลายผิว = เลือก target · จุดอื่น = คลิกบนรูปได้
    if ((st.ref === "ground" && m === "depth" || m === "normal") && sp.targets.length > 1)
      div("row", "<label>ผิวดิน</label>", b).append(sel(sp.targets.map(t => [t.name, t.displayName || t.name]), st.target, v => { st.target = v; }));
    if (m === "depth" || m === "offset")
      div("btns", null, b).append(btn("จุดอ้างอิง: คลิกบนรูป…", () => { limitPick = { it, id, st }; closeDialog(); setTool("limitref"); }, false, "ซ่อนหน้าต่างชั่วคราว คลิกจุดบนรูปแล้วกลับมา (Esc = กลับโดยไม่เปลี่ยน)"));

    // ---- parameter / ถ้าไม่ผ่าน / ขยับ ----
    const [n0, n1] = limitParamNames(st), numeric = v => /^-?\d+(\.\d+)?$/.test(String(v).trim());
    if (numeric(st.min) || (st.useMax && numeric(st.max))){
      const pc = document.createElement("label"); pc.className = "check";
      pc.innerHTML = `<input type="checkbox"${st.params ? " checked" : ""}> สร้าง parameter <b>${esc(Spec.freeName(sp, n0))}</b>${st.useMax ? ` / <b>${esc(Spec.freeName(sp, n1))}</b>` : ""} <small>(แก้ใน Civil 3D ได้)</small>`;
      pc.querySelector("input").onchange = e => { st.params = e.target.checked; };
      b.appendChild(pc);
    }
    const radio = (label, opts, val, on) => {
      const row = div("lim-radio", `<span class="lbl">${esc(label)}</span>`, b);
      for (const [v, t] of opts){
        const l = document.createElement("label");
        l.innerHTML = `<input type="radio" name="lim-${esc(label)}"${v === val ? " checked" : ""}> ${esc(t)}`;
        l.querySelector("input").onchange = () => { on(v); build(b); };
        row.appendChild(l);
      }
    };
    radio("ถ้าไม่ผ่าน", Object.entries(Spec.LIMIT_ACTIONS), st.action, v => { st.action = v; });
    if (st.action !== "warn" && o.along[m].length > 1) radio("ขยับ", o.along[m].map(a => [a, Spec.LIMIT_ALONG[a] + (a === "slope" && o.start ? ` (จาก ${o.start})` : "")]), st.along, v => { st.along = v; });

    // ---- พรีวิว + ปุ่ม ----
    const pv = div("lim-preview", "", b), err = div("expr-err", "", b);
    const ok = btn("สร้าง", () => { const e = commitLimit(it, id, st); if (e) err.textContent = e; });
    if (p.limit) ok.textContent = "บันทึก";
    div("btns", null, b).append(ok, ...(p.limit ? [btn("ลบ Max / Min", () => { closeDialog(); specEdit(s => Spec.removeLimit(s, id), it, `ลบ Max / Min ของ ${id}`); })] : []), btn("ยกเลิก", closeDialog));
    div("hint", "เส้นประสีส้มบนรูป = ขอบที่ยอมได้ (อย่างน้อย / อย่างมาก) · ลูกศร = จุดจะถูกขยับไปตรงไหน — คำนวณจากผิวดิน / parameter ตอนนี้", b);
    function preview(){
      err.textContent = "";
      const t = JSON.parse(JSON.stringify(sp));
      try{ Spec.setLimit(t, id, limitFromState(st)); }
      catch(e){ pv.textContent = ""; err.textContent = e.message; ok.disabled = true; limitPreview = null; render(); return; }
      ok.disabled = false;
      const r = Spec.evaluate(t, specCtx(it, itemOrigin(it))), o0 = itemOrigin(it);
      r.ox = o0.x; r.oy = o0.y;
      limitPreview = { item: it.id, id, spec: t, r };
      pv.innerHTML = limitNowText(t, r, id, true);
      render();
    }
    preview();
  }
}
// ประโยคสรุปของ Max / Min ที่ตั้งไว้ (Properties / แท็บ Logic) — ค่าในวงเล็บ = ค่าตอนนี้ของนิพจน์
function limitSentence(sp, p, r){
  const L = p.limit, info = r && r.limits && r.limits[p.id];
  if (!L) return "";
  const v = (e, n) => e == null || e === "" ? null : `<b>${esc(e)}</b>${n != null && !/^-?[\d.]+$/.test(String(e).trim()) ? ` <small>(= ${n.toFixed(2)})</small>` : ""}`;
  const mn = v(L.min, info && info.mn), mx = v(L.max, info && info.mx);
  const act = { clampWarn: "ขยับให้ถึงขอบ + เตือน", clamp: "ขยับเงียบๆ", warn: "เตือนอย่างเดียว" }[L.action || "clampWarn"];
  return `จุด <b>${esc(p.id)}</b> ต้อง${esc(Spec.limitWhat(p))}${mn ? " อย่างน้อย " + mn : ""}${mx ? (mn ? " และไม่เกิน " : " ไม่เกิน ") + mx : ""} ม.`
       + ` <small>· ถ้าไม่ผ่าน: ${act}${L.action === "warn" ? "" : " (" + Spec.LIMIT_ALONG[L.along || "vertical"] + ")"}</small>`;
}
// scenario ไหนทำให้ Max / Min ของจุดไม่ผ่าน (ถูกขยับ / เตือน) — คิดจาก spec ตอนนี้ + ผิวดิน / parameter ของ scenario
function limitCoverage(it){
  const ids = it.spec.points.filter(p => p.limit).map(p => p.id), by = {};
  for (const id of ids) by[id] = { hit: [], pass: [] };
  for (const s of scenarios){
    const r = scenarioEval(s, it);
    if (!r) continue;
    for (const id of ids){ const inf = r.limits[id]; if (inf && inf.v0 != null) by[id][inf.hit ? "hit" : "pass"].push(s.name); }
  }
  return by;
}
// ข้อความ "ตอนนี้ ..." (หน้าต่าง / Properties / แท็บ Logic)
function limitNowText(sp, r, id, future){
  const p = Spec.byId(sp.points, id), info = r && r.limits && r.limits[id];
  if (!p || !p.limit) return "";
  const q = r.pts[id];
  if (q && q.off) return `${esc(id)} ไม่เกิดตอนนี้ (กิ่ง ${esc(Spec.branchLabel(sp, q.off))})`;
  if (!info) return `${esc(id)} หาไม่ได้ตอนนี้ — ดู Messages`;
  const what = esc(Spec.limitWhat(p)), f = v => v.toFixed(2);
  if (info.v0 == null){
    const msg = (r.issues || []).find(i => i.obj === id && i.msg.includes("Max / Min"));
    return `ไม่รู้ค่าตอนนี้${msg ? " — " + esc(msg.msg.replace(/^\S+ Max \/ Min: /, "")) : " (Layout mode / ไม่มีผิวดิน = ไม่ขยับ)"}`;
  }
  if (!info.hit) return `ตอนนี้ ${esc(id)} ${what} <b>${f(info.v0)}</b> ม. — <span class="lim-ok">ผ่าน</span> ไม่ขยับ`;
  if (p.limit.action === "warn") return `ตอนนี้ ${esc(id)} ${what} <b>${f(info.v0)}</b> ม. — <span class="lim-bad">ไม่ผ่าน</span> (เตือนอย่างเดียว ไม่ขยับ)`;
  const d = Math.hypot(q.x - info.from.x, q.y - info.from.y);
  return `ตอนนี้ ${esc(id)} ${what} <b>${f(info.v0)}</b> ม. → ${future ? "จะถูก" : "ถูก"}ขยับเป็น <b>${f(info.tgt)}</b> ม. <small>(ขยับ ${f(d)} ม.)</small>`;
}
// บันทึก: สร้าง parameter (ถ้าติ๊กและค่าเป็นตัวเลข) + Spec.setLimit — Undo ครั้งเดียว · คืนข้อความผิด (ไม่ปิดหน้าต่าง)
function commitLimit(it, id, st){
  const lim = limitFromState(st);
  try{ Spec.setLimit(JSON.parse(JSON.stringify(it.spec)), id, lim); }catch(e){ return e.message; }
  const [n0, n1] = limitParamNames(st), numeric = v => v != null && /^-?\d+(\.\d+)?$/.test(String(v).trim());
  const made = [];
  specEdit(s => {
    if (st.params) for (const [k, base] of [["min", n0], ["max", n1]]){
      if (!numeric(lim[k])) continue;
      const name = Spec.freeName(s, base);
      s.params.push({ name, kind: "double", default: +lim[k], displayName: name, min: null, max: null });
      lim[k] = name; made.push(name);
    }
    Spec.setLimit(s, id, lim);
  }, it, `Max / Min ที่ ${id}`);
  closeDialog();
  state.sel = { type: "dpt", item: it.id, id }; renderAll();
  flashBanner(`Max / Min ที่ ${id}: ${Spec.limitWhat(Spec.byId(it.spec.points, id))}${made.length ? ` · สร้าง parameter ${made.join(", ")}` : ""} (Ctrl+Z ย้อนได้)`);
  return null;
}
// เครื่องมือ: คลิกจุดที่จะคุม (limit) / คลิกจุดอ้างอิงแล้วกลับหน้าต่าง (limitref)
function limitToolClick(it, c){
  if (c.kind !== "end" || !c.point.ref || c.point.ref.type !== "pt") return flashBanner("Max / Min: คลิกบนจุดที่วาดแล้ว");
  const id = c.point.ref.id;
  if (draw.tool === "limit"){ setTool(null); return openLimit(it, id); }
  const lp = limitPick;
  if (!lp) return setTool(null);
  if (id === lp.id || Spec.dependsOn(it.spec, id, lp.id)) return flashBanner(`${id} อ้างอิงไม่ได้ — คำนวณจาก ${lp.id} (อ้างกันเป็นวง)`);
  lp.st.ref = "pt:" + id;
  setTool(null);                                    // setTool เปิดหน้าต่างกลับให้ (ดู limitToolLeave)
}
// ออกจากเครื่องมือ limitref (คลิกจุดแล้ว / Esc) = เปิดหน้าต่างกลับด้วยสถานะเดิม
function limitToolLeave(){
  const lp = limitPick;
  limitPick = null;
  if (lp) setTimeout(() => openLimit(lp.it, lp.id, lp.st));
}
function limitPreviewClear(){
  if (!limitPreview) return;
  limitPreview = null;
  render();
}

// ---------------- เส้นขอบที่ยอมได้บนรูป ----------------
// พรีวิวในหน้าต่าง (เรียกจาก render)
function renderLimitPreview(){
  const lp = limitPreview;
  if (!lp || !itemById(lp.item)) return;
  limitBands(lp.spec, lp.r, lp.id, true);
}
// sp / r = spec + ผลคำนวณ (มี ox / oy) · move = แสดงตำแหน่งก่อนขยับ + ลูกศร
function limitBands(sp, r, id, move){
  const p = Spec.byId(sp.points, id), L = p && p.limit, info = r && r.limits && r.limits[id], q = r && r.pts[id];
  if (!L || !q || q.err || !info) return;
  const X = v => sx(r.ox + v.x), Y = v => sy(r.oy + v.y), F = r.flip || 1, below = L.side !== "above", G = r.ground;
  const g = el("g", { class: "lim-band" }, svg);
  const path = (pts, cls, label) => {
    const ok = pts.filter(v => v && isFinite(v.x) && isFinite(v.y));
    if (ok.length < 2) return;
    el("path", { d: ok.map((v, j) => (j ? "L" : "M") + X(v) + " " + Y(v)).join(" "), class: cls }, g);
    if (label){ const e = ok[ok.length - 1]; el("text", { x: X(e) + 4, y: Y(e) - 3, class: "lim-lbl" }, g).textContent = label; }
  };
  const gy = x => { try{ return G.elev(x); }catch{ return NaN; } };
  const span = (a, b2, n = 24) => Array.from({ length: n + 1 }, (_, k) => a + (b2 - a) * k / n);
  for (const [b, nm, cls] of [[info.mn, "อย่างน้อย", "lim-min"], [info.mx, "อย่างมาก", "lim-max"]]){
    if (b == null) continue;
    const label = `${nm} ${b.toFixed(2)}`;
    const m = L.measure;
    if ((m === "depth" && (L.ref || {}).type === "ground") || m === "normal"){
      if (!G) continue;
      path(span(q.x - 4, q.x + 4).map(x => {
        const s = m === "normal" ? (gy(x + 0.01) - gy(x - 0.01)) / 0.02 : 0, d = b * Math.sqrt(1 + s * s);
        return { x, y: below ? gy(x) - d : gy(x) + d };
      }), cls, label);
    }
    else if (m === "depth"){ if (info.ry == null) continue; const y = below ? info.ry - b : info.ry + b; path([{ x: q.x - 3, y }, { x: q.x + 3, y }], cls, label); }
    else if (m === "offset"){ if (info.rx == null) continue; const x = info.rx + F * b; path([{ x, y: q.y - 2 }, { x, y: q.y + 2 }], cls, label); }
    else if (m === "length" && info.S && info.u){
      const c = { x: info.S.x + info.u.x * b, y: info.S.y + info.u.y * b }, n = { x: -info.u.y * 0.4, y: info.u.x * 0.4 };
      path([{ x: c.x - n.x, y: c.y - n.y }, { x: c.x + n.x, y: c.y + n.y }], cls, label);
    }
  }
  // ตำแหน่งก่อนขยับ (จาง) + ลูกศรไปตำแหน่งใหม่
  if (move && info.hit && info.from && Math.hypot(q.x - info.from.x, q.y - info.from.y) > 1e-6){
    el("circle", { cx: X(info.from), cy: Y(info.from), r: 4, class: "lim-from" }, g);
    el("line", { x1: X(info.from), y1: Y(info.from), x2: X(q), y2: Y(q), class: "lim-arrow" }, g);
    el("circle", { cx: X(q), cy: Y(q), r: 6, class: "lim-to" }, g);
  }
}
