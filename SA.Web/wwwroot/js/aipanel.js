// AI tab, drawing overlay and accept / reject for proposals (round 6). Web text is Thai.
"use strict";
const AI_COLOR = { added: "#2f9e44", changed: "#e8890c", removed: "#d6336c" };
let aiLastCall = null;

function aiFocus(){ state.dock.tab = "ai"; state.dock.open = true; persist(); }
function aiItemOf(p){ return p.item || itemById(p.itemId); }

// The user edited the subassembly, or it is gone: the proposal is cancelled (the AI must read again)
function aiCheckEdits(){
  for (const p of Proposals.pending()){
    if (p.item) continue;
    const it = itemById(p.itemId);
    if (!it){ Proposals.finish(p, "cancelled", "subassembly removed"); continue; }
    if (it.spec && JSON.stringify(it.spec) !== p.base){
      Proposals.finish(p, "cancelled", "user edited the subassembly");
      flashBanner(`ข้อเสนอ AI ${p.id} ถูกยกเลิก เพราะมีการแก้ ${itemLabel(it)} — ให้ Claude อ่านใหม่แล้วเสนออีกครั้ง`);
    }
  }
}

function aiAccept(p){
  if (p.status !== "pending") return;
  let it;
  Proposals.finish(p, "accepted");
  if (p.item){
    it = addItem({ spec: p.spec, fileName: p.item.fileName }, asmById(p.asmId) || curAsm());
  } else {
    it = itemById(p.itemId);
    if (!it) return;
    if (it.spec) specEdit(s => {
      for (const k of Object.keys(s)) if (!(k in p.spec)) delete s[k];
      Object.assign(s, JSON.parse(JSON.stringify(p.spec)));
    }, it, `รับข้อเสนอ AI ${p.id}`);
    else { it.spec = p.spec; persist(); }
  }
  aiAddScenarios(p, it);
  flashBanner(`รับข้อเสนอ ${p.id} แล้ว — ยังไม่ได้เขียนไฟล์ กด Save (.cs) เมื่อพร้อม (Ctrl+Z ย้อนได้)`);
  renderAll();
}
function aiAddScenarios(p, it){
  if (!p.scenarios.length) return;
  const o = itemOrigin(it);
  for (const c of p.scenarios){
    const s = snapshot(c.name), ws_ = s.ws;
    const si = (ws_.assemblies ? ws_.assemblies.flatMap(a => a.items || []) : (ws_.items || [])).find(x => x.id === it.id);
    if (si) si.params = { ...(si.params || {}), ...(c.values || {}) };
    ws_.layout = !!c.layout;
    if (c.ground){ ws_.surface = c.ground.map(q => ({ x: q.x + o.x, y: q.y + o.y })); ws_.surfaceOn = true; } else ws_.surfaceOn = false;
    scenarios.push(s);
  }
  saveScenarios(); renderScenarios();
}
function aiReject(p){
  if (p.status !== "pending") return;
  Proposals.finish(p, "rejected");
  flashBanner(`ปฏิเสธข้อเสนอ ${p.id} แล้ว — ไม่มีอะไรเปลี่ยน`);
  renderAll();
}

// Draws a proposal in place of the real drawn part: changes in colour, removed objects dashed
function renderProposal(it, p, baseR, grp){
  let sp, r;
  const o = itemOrigin(it);
  try{ sp = Proposals.viewSpec(p); r = Spec.evaluate(sp, specCtx(it, o)); }catch{ return; }
  const base = JSON.parse(p.base), kind = Proposals.kinds(base, sp);
  const X = q => sx(o.x + q.x), Y = q => sy(o.y + q.y);
  const color = id => kind.added.has(id) ? AI_COLOR.added : kind.changed.has(id) ? AI_COLOR.changed : null;
  const label = (x, y, text, fill) => { const t = el("text", { x, y, class: "d-lbl" }, grp); t.textContent = text; if (fill) t.setAttribute("fill", fill); };
  for (const s of sp.shapes){
    const q = r.shapes[s.id], c = color(s.id);
    if (q && q.poly) el("polygon", { points: q.poly.map(a => X(a) + "," + Y(a)).join(" "), class: "shape", ...(c ? { style: `fill:${c};fill-opacity:.18` } : {}) }, grp);
  }
  const line = (path, stroke, dash, w) => el("path", { d: path.map((a, j) => (j ? "L" : "M") + X(a) + " " + Y(a)).join(" "), fill: "none", stroke, "stroke-width": w, ...(dash ? { "stroke-dasharray": dash } : {}) }, grp);
  for (const l of sp.links){
    const q = r.links[l.id]; if (!q || q.err || !q.path) continue;
    const c = color(l.id), aux = Spec.isAux(l);
    line(q.path, c || (aux ? "#8b9098" : colorFor(primaryCode(l.codes))), aux ? "5 4" : "", c ? 3 : 2);
    if (c){ const m = q.path[q.path.length >> 1], n = q.path[(q.path.length >> 1) - 1] || m; label((X(m) + X(n)) / 2 + 4, (Y(m) + Y(n)) / 2 - 4, l.id, c); }
  }
  for (const pt of sp.points){
    const q = r.pts[pt.id]; if (!q || q.err) continue;
    const c = color(pt.id);
    el("rect", { x: X(q) - 4, y: Y(q) - 4, width: 8, height: 8, fill: c || "#9fb6e0", stroke: "#123" }, grp);
    if (c) label(X(q) + 7, Y(q) + 14, pt.id, c);
  }
  // Removed objects, at their current place in the real result
  if (baseR) for (const l of base.links){
    if (!kind.removed.has(l.id)) continue;
    const q = baseR.links[l.id];
    if (q && !q.err && q.path) line(q.path, AI_COLOR.removed, "6 4", 2);
  }
  if (baseR) for (const pt of base.points){
    if (!kind.removed.has(pt.id)) continue;
    const q = baseR.pts[pt.id];
    if (q && !q.err) el("rect", { x: X(q) - 4, y: Y(q) - 4, width: 8, height: 8, fill: "none", stroke: AI_COLOR.removed }, grp);
  }
}

// ---------- AI tab ----------
function renderAi(){
  const pend = Proposals.pending();
  $("n-ai").textContent = pend.length ? String(pend.length) : "";
  const st = $("ai-status");
  st.textContent = aiLastCall ? `Claude เชื่อมต่อแล้ว${pend.length ? ` · ข้อเสนอรอ ${pend.length}` : ""}` : "";
  st.classList.toggle("wait", pend.length > 0);
  const box = $("ai-pane");
  if (state.dock.tab !== "ai" || !state.dock.open) return;
  box.innerHTML = "";
  if (!pend.length){
    const done = Proposals.all().slice(-1)[0];
    div("empty", done ? `ไม่มีข้อเสนอที่รออยู่ · ล่าสุด ${done.id}: ${({ accepted: "รับแล้ว", rejected: "ปฏิเสธแล้ว", cancelled: "ถูกยกเลิก" })[done.status] || done.status}` : "ยังไม่มีข้อเสนอจาก Claude", box);
    return;
  }
  for (const p of pend){
    const it = aiItemOf(p), card = div("ai-card", "", box);
    const head = div("ai-head", "", card);
    head.textContent = `${p.id} · ${itemLabel(it)}${p.isNew ? " (ตัวใหม่)" : ""} · ${Proposals.opCount(p)} ขั้น`;
    if (p.summary){ const s = div("ai-sum", "", card); s.textContent = p.summary; }
    const bar = div("btns", null, card);
    const yes = btn("รับทั้งหมด", () => aiAccept(p), false, "รับทุกขั้น เป็น Undo ก้อนเดียว ยังไม่เขียนไฟล์"); yes.classList.add("primary");
    bar.append(yes, btn("ปฏิเสธ", () => aiReject(p), false, "ทิ้งข้อเสนอ ไม่มีอะไรเปลี่ยน"));
    const n = Proposals.opCount(p);
    if (n > 1){
      const row = div("ai-step", "", card), lab = document.createElement("span"), r = document.createElement("input");
      r.type = "range"; r.min = 0; r.max = n; r.value = p.step == null ? n : p.step;
      lab.textContent = `ดูทีละขั้น ${r.value} / ${n}`;
      r.oninput = () => { p.step = +r.value === n ? null : +r.value; lab.textContent = `ดูทีละขั้น ${r.value} / ${n}`; render(); };
      row.append(lab, r);
    }
    const legend = div("ai-legend", `<i style="background:${AI_COLOR.added}"></i>เพิ่ม <i style="background:${AI_COLOR.changed}"></i>แก้ <i style="background:${AI_COLOR.removed}"></i>ลบ`, card);
    legend.title = "สีบนรูป";
    if (p.warnings.length){ const w = div("ai-warn", "", card); w.textContent = "⚠ " + [...new Set(p.warnings)].join("\n⚠ "); }
    if (p.scenarios.length){ const s = div("ai-sum", "", card); s.textContent = "Scenario ที่เสนอ: " + p.scenarios.map(c => c.name).join(", "); }
    const pre = document.createElement("pre"); pre.className = "lg-text"; pre.textContent = Logic.diffText(JSON.parse(p.base), p.spec); card.appendChild(pre);
  }
}
