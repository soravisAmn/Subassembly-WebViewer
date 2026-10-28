// Move (M) / Copy (C) / Paste (Ctrl+V) แบบ AutoCAD + คลิปบอร์ด (Ctrl+C / Ctrl+X)
//
// เลือกก่อนแล้วสั่ง หรือสั่งก่อนแล้วเลือก (Enter / คลิกขวา = จบการเลือก) → คลิกจุดฐาน → เงาตามเมาส์ → คลิกปลายทาง
//   ใช้ OSNAP / Grid snap / Ortho / ล็อก slope ได้ · Tab / พิมพ์ตัวเลข = พิมพ์ระยะ dx, dy หรือ slope + ยาว · Esc = ยกเลิก
//   Copy วางได้หลายครั้งจน Enter / Esc · Paste เริ่มที่ขั้นปลายทางเลย (จุดฐาน = มุมซ้ายล่างของชุดที่คัดลอก)
// Edit mode = point / link / shape ที่วาด (ดู ops.js) · นอก Edit mode = subassembly ทั้งตัว (ปล่อยใกล้แกน / จุด = เกาะ แบบการลาก)
// พิกัดของคำสั่ง ("พิกัดงาน"): Edit mode = เทียบ origin ของตัวที่แก้ · นอก Edit = พิกัดโลก
"use strict";

// stage: select (เลือก object) | base (คลิกจุดฐาน) | dest (คลิกปลายทาง)
const cmd = { name: null, stage: null, base: null, pt: null, cand: null, convert: false, ghost: null, geom: null, n: 0 };
let clip = null;   // { kind: "drawn", spec, frag, pos, F, from, base, n } | { kind: "items", srcs, geom, base, n }
const CMD_NAMES = { move: "Move", copy: "Copy", paste: "Paste" };
const cmdPlacing = () => !!cmd.name && cmd.stage !== "select";

function startCmd(name){
  if (draw.tool) setTool(null);
  closeTyping();
  const fresh = { name, base: null, pt: null, cand: null, convert: false, ghost: null, geom: null, n: 0 };
  if (name === "paste"){
    if (!clip) return flashBanner("คลิปบอร์ดว่าง — Ctrl+C / Ctrl+X ก่อน");
    if (clip.kind === "drawn" && !state.editing) return flashBanner("วางส่วนที่วาดได้ใน Edit mode (เข้า Edit ตัวที่จะวางก่อน)");
    if (clip.kind === "items" && state.editing) return flashBanner("วาง subassembly ได้นอก Edit mode (ออกจาก Edit ก่อน)");
    Object.assign(cmd, fresh, { stage: "dest", base: clip.base, geom: clip.geom || null });
  } else Object.assign(cmd, fresh, { stage: pickedList().length ? "base" : "select" });
  draw.lastCyc = null;
  if (cmd.stage === "base" && !state.editing) cmd.geom = itemsGeom(cmdItems());
  cmdBanner(); refreshSnap(); render();
}
function endCmd(msg){
  Object.assign(cmd, { name: null, stage: null, base: null, pt: null, cand: null, ghost: null, geom: null });
  closeTyping(); tip.style.display = "none"; draw.list = [];
  showBanner(""); if (msg) flashBanner(msg);
  render();
}
// Enter / คลิกขวา: จบการเลือก · จบ Copy
function cmdEnter(){
  if (cmd.stage === "select"){
    if (!pickedList().length) return endCmd("ยังไม่ได้เลือกอะไร — ยกเลิก " + CMD_NAMES[cmd.name]);
    cmd.stage = "base";
    if (!state.editing) cmd.geom = itemsGeom(cmdItems());
    cmdBanner(); refreshSnap(); return;
  }
  if (cmd.name === "copy" && cmd.stage === "dest") return endCmd(cmd.n ? `Copy แล้ว ${cmd.n} ครั้ง` : "");
}

function cmdBanner(){
  const b = $("banner"), N = CMD_NAMES[cmd.name], n = cmd.name === "paste" ? clip.n : pickedList().length;
  const t = {
    select: `${N}: เลือก object (คลิก / คลุม) แล้วกด Enter · Esc = ยกเลิก`,
    base: `${N} ${n} objects: คลิกจุดฐาน (base point) · Esc = ยกเลิก`,
    dest: `${N} ${n} objects: คลิกปลายทาง · Tab / พิมพ์ตัวเลข = พิมพ์ระยะ · Esc = ยกเลิก` + (cmd.name === "copy" ? ` · Enter = จบ${cmd.n ? ` (วางแล้ว ${cmd.n})` : ""}` : "")
  }[cmd.stage];
  b.innerHTML = esc(t); b.style.display = "block";
  // จุดที่ย้ายไม่ได้ (ขึ้นกับผิวดิน / เส้นของจุดอื่น ฯลฯ): บอกเหตุผล + ปุ่มแปลงเป็นระยะคงที่
  const info = cmd.stage !== "select" && state.editing && cmd.name !== "paste" ? cmdTrial({ x: 0, y: 0 }).info : null;
  const blocked = info ? info.blocked : [];
  if (blocked.length || cmd.convert){
    const d = document.createElement("div"); d.className = "banner-warn";
    d.textContent = cmd.convert ? "แปลงจุดที่ขึ้นกับสิ่งอื่นเป็นระยะคงที่ (delta) แล้วย้าย "
      : "⚠ ไม่ย้าย: " + blocked.slice(0, 6).map(x => `${x.id} (${x.why})`).join(", ") + (blocked.length > 6 ? ` … +${blocked.length - 6}` : "") + " ";
    d.appendChild(btn(cmd.convert ? "ไม่แปลง" : "แปลงเป็นระยะคงที่ (delta) แล้วย้าย", () => { cmd.convert = !cmd.convert; cmdBanner(); refreshSnap(); }));
    b.appendChild(d);
  }
}

// ---------------- ชุดที่สั่ง ----------------
const cmdItems = () => pickedList().filter(o => o.type === "item").map(o => o.item);
function cmdFrag(it){
  const sel = { points: [], links: [], shapes: [] };
  for (const o of pickedList()) (o.type === "dpt" ? sel.points : o.type === "dlink" ? sel.links : sel.shapes).push(o.id);
  return Ops.expand(it.spec, sel);
}
function posOf(r){ const p = {}; for (const k in r.pts) if (!r.pts[k].err) p[k] = { x: r.pts[k].x, y: r.pts[k].y }; return p; }

// ทำคำสั่งกับ spec (ของจริงหรือสำเนาทดลอง) ย้ายไป v — คืน { blocked: [{id, why}], ids: จุดของชุด (หลังทำ) }
function applyDrawn(spec, it, v){
  const r = drawRes[it.id], F = r.flip, pos = posOf(r);
  if (cmd.name === "move"){
    const f = cmdFrag(it), pl = Ops.plan(spec, f.points, cmd.convert);
    Ops.apply(spec, pl, v, F, pos);
    return { blocked: pl.blocked, ids: f.points };
  }
  let c;
  if (cmd.name === "copy") c = Ops.clone(spec, cmdFrag(it), spec, { pos });
  else {
    // วางในตัวเดิม (จุดนอกชุดที่อ้างถึงยังอยู่) = อ้างตัวเดิม · ตัวอื่น = แปลงเป็นระยะจาก origin ของตัวใหม่
    const ids = new Set(spec.points.map(p => p.id));
    const same = clip.from === it.id && clip.frag.points.every(id => Spec.refs(Spec.byId(clip.spec.points, id).def).every(x => ids.has(x) || clip.frag.points.includes(x)));
    c = Ops.clone(clip.spec, clip.frag, spec, { detach: !same, pos: clip.pos, F, names: specNames(it) });
  }
  const pl = Ops.plan(spec, c.points, cmd.convert);
  Ops.apply(spec, pl, v, F, { ...pos, ...c.pos });
  const back = Object.fromEntries(Object.entries(c.map).map(([a, b]) => [b, a]));
  return { blocked: pl.blocked.map(x => ({ ...x, id: back[x.id] || x.id })), ids: c.points };
}
// ทดลองบนสำเนา: เงา = จุดที่ตำแหน่งเปลี่ยน / จุดใหม่ และ link ที่แตะจุดเหล่านั้น
function cmdTrial(v){
  const it = editItem(), r = drawRes[it.id], trial = JSON.parse(JSON.stringify(it.spec));
  const info = applyDrawn(trial, it, v);
  const ev = Spec.evaluate(trial, specCtx(it, { x: r.ox, y: r.oy }));
  const changed = new Set();
  for (const id in ev.pts){
    const a = ev.pts[id], b = r.pts[id];
    if (!a.err && (!b || b.err || Math.abs(a.x - b.x) > 1e-9 || Math.abs(a.y - b.y) > 1e-9)) changed.add(id);
  }
  const links = trial.links.filter(l => ev.links[l.id] && ev.links[l.id].path && Spec.linkEnds(l).some(p => changed.has(p))).map(l => ev.links[l.id].path);
  const own = new Set(info.ids);
  return { info, pts: [...changed].map(id => ev.pts[id]), links, follow: [...changed].filter(id => !own.has(id) && r.pts[id]) };
}

// ---------------- subassembly ทั้งตัว (นอก Edit mode) ----------------
// เส้น / จุดของ item (พิกัดโลก) ไว้วาดเงา
function itemsGeom(ids){
  const g = [], all = new Set();
  for (const id of ids){ all.add(id); if (cmd.name === "move") descendants(id).forEach(d => all.add(d)); }
  for (const id of all){
    const rr = asmRes[id], res = rr && rr.result, d = drawRes[id];
    if (res && !rr.generated){
      res.links.forEach(l => g.push(l.pts.map(k => ({ x: res.points[k].x, y: res.points[k].y }))));
      res.points.forEach(p => g.push([{ x: p.x, y: p.y }]));
    }
    if (d){
      for (const k in d.links) if (d.links[k].path) g.push(d.links[k].path.map(p => ({ x: d.ox + p.x, y: d.oy + p.y })));
      for (const k in d.pts) if (!d.pts[k].err) g.push([{ x: d.ox + d.pts[k].x, y: d.oy + d.pts[k].y }]);
    }
    const it = itemById(id); if (it){ const o = itemOrigin(it); g.push([{ x: o.x, y: o.y }]); }
  }
  return g;
}
// origin ตำแหน่งใหม่ -> จุดเกาะ (ใกล้แกน / จุดของตัวอื่นในระยะ SNAP_PX = เกาะ ไม่งั้นลอย)
function placeAttach(id, o, banned){
  let best = null, bestD = SNAP_PX;
  for (const c of snapCandidates(id)){
    if (c.attach.type === "point" && banned.has(c.attach.parent)) continue;
    const d = Math.hypot(sx(c.x) - sx(o.x), sy(c.y) - sy(o.y));
    if (d < bestD){ best = c; bestD = d; }
  }
  return best ? { attach: { ...best.attach, x: best.x, y: best.y }, asm: best.asm } : { attach: { type: "free", x: o.x, y: o.y }, asm: null };
}
function moveItems(ids, v){
  const set = new Set(ids), banned = new Set(ids.flatMap(id => [id, ...descendants(id)]));
  History.batch(`ย้าย ${ids.length} subassembly`, () => {
    for (const id of ids){
      const it = itemById(id), at = it.attach;
      if (at.type === "point" && set.has(at.parent)) continue;          // ตัวที่เกาะตัวในชุด = ตามไปเอง
      const o = itemOrigin(it), p = placeAttach(id, { x: o.x + v.x, y: o.y + v.y }, banned);
      it.attach = p.attach;
      if (p.asm) moveToAsm(id, asmById(p.asm));
    }
    persist();
  });
  run(); renderAll();
}
// สำเนาของ item: srcs = [{ it (JSON), origin, asm }] — ความสัมพันธ์ในชุดอ้างกันเอง, ตัวบนสุดวางที่ origin + v
function itemSrcs(ids){
  return ids.map(id => ({ it: JSON.parse(JSON.stringify(itemById(id))), origin: itemOrigin(itemById(id)), asm: asmOfItem(id).id }));
}
function addItemClones(srcs, v, label){
  const map = {};
  srcs.forEach(s => map[s.it.id] = newId());
  History.batch(label, () => {
    const roots = srcs.filter(s => !(s.it.attach.type === "point" && map[s.it.attach.parent]));
    const kids = srcs.filter(s => !roots.includes(s));
    for (const s of [...roots, ...kids]){
      const c = JSON.parse(JSON.stringify(s.it));
      c.id = map[s.it.id];
      if (!c.file){ delete c.savedSpec; if (c.fileName) c.fileName = c.fileName.replace(/\.cs$/i, "") + "-copy.cs"; }
      let a = asmById(s.asm) || curAsm();
      if (roots.includes(s)){
        const p = placeAttach(c.id, { x: s.origin.x + v.x, y: s.origin.y + v.y }, new Set());
        c.attach = p.attach;
        if (p.asm) a = asmById(p.asm);
      } else { c.attach.parent = map[c.attach.parent]; a = asmOfItem(c.attach.parent) || a; }
      a.items.push(c);
    }
    persist();
  });
  run(); renderAll();
}

// ---------------- เมาส์ ----------------
function cmdLocal(px, py){
  if (state.editing){ const r = drawRes[state.editing]; return { x: wx(px) - r.ox, y: wy(py) - r.oy }; }
  return { x: wx(px), y: wy(py) };
}
function cmdScreen(p){
  if (state.editing){ const r = drawRes[state.editing]; return { x: sx(r.ox + p.x), y: sy(r.oy + p.y) }; }
  return { x: sx(p.x), y: sy(p.y) };
}
// snap ที่ตำแหน่ง m: Edit mode = ชุดเดียวกับตอนวาด · นอก Edit = แกน + จุดทุกจุด + origin ของทุกตัว
function cmdSnap(m){
  const A = cmd.stage === "dest" ? cmd.base : null;
  const list = state.editing ? editSnapList(m, A, false)
    : Snap.collect({ mouse: m, scale: { x: state.view.scale, y: state.view.scale * state.view.ve }, R: OSNAP_PX,
                     os: { ...state.bar.osnap, on: state.bar.osOn }, points: wsSnapPoints(), segs: [], from: null, ground: null, ray: null });
  return pickSnap(list, () => cmdFree(m, A));
}
function wsSnapPoints(){
  const pts = asms().map(a => ({ x: a.baseline.x, y: a.baseline.y, label: "แกน " + a.name }));
  for (const it of allItems()){
    const rr = asmRes[it.id], d = drawRes[it.id], o = itemOrigin(it);
    pts.push({ x: o.x, y: o.y, label: "origin · " + itemLabel(it) });
    if (rr && rr.result && !rr.generated) rr.result.points.forEach((p, i) => pts.push({ x: p.x, y: p.y, label: `${p.codes[0] || "#" + i} · ${itemLabel(it)}` }));
    if (d) for (const k in d.pts) if (!d.pts[k].err) pts.push({ x: d.ox + d.pts[k].x, y: d.oy + d.pts[k].y, label: `${k} · ${itemLabel(it)}` });
  }
  return pts;
}
// ไม่ชน snap: จุดฐาน = Grid snap · ปลายทาง = ล็อก slope / Ortho / Grid snap เทียบจุดฐาน
function cmdFree(m, A){
  if (!A) return { kind: "free", x: snapV(m.x), y: snapV(m.y), label: "" };
  let dx = snapV(m.x - A.x), dy = snapV(m.y - A.y);
  const sl = slopeLock();
  if (sl) dy = (m.y < A.y ? -1 : 1) * Expr.value(slopeMag(sl), {}) * Math.abs(dx);
  else if (state.bar.ortho){ if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
  return { kind: "free", x: A.x + dx, y: A.y + dy, label: sl ? `ลาด ${sl}` : "" };
}
function cmdMove(px, py){
  draw.lastPx = px; draw.lastPy = py;
  if (state.editing && !drawRes[state.editing]) return;
  draw.mouse = cmdLocal(px, py);
  if (draw.typing) return;
  cmd.cand = cmdSnap(draw.mouse);
  cmd.pt = { x: cmd.cand.x, y: cmd.cand.y };
  cmd.ghost = cmd.stage === "dest" && state.editing ? cmdTrial({ x: cmd.pt.x - cmd.base.x, y: cmd.pt.y - cmd.base.y }) : null;
  render();
  cmdTip(px, py);
}
function cmdTip(px, py){
  const c = cmd.cand, lines = [], n = draw.list.length;
  if (!c) return;
  if (c.label) lines.push((OSNAP_LABEL[c.kind] ? `${OSNAP_LABEL[c.kind]}: ` : "") + c.label);
  if (cmd.stage === "dest"){
    const dx = cmd.pt.x - cmd.base.x, dy = cmd.pt.y - cmd.base.y;
    lines.push(`dx ${f3(dx)} · dy ${f3(dy)} · ยาว ${f3(Math.hypot(dx, dy))} m`);
    if (cmd.ghost && cmd.ghost.follow.length) lines.push("ขยับตาม: " + cmd.ghost.follow.slice(0, 8).join(", ") + (cmd.ghost.follow.length > 8 ? " …" : ""));
  } else lines.push("จุดฐาน (base point)");
  if (n >= 2) lines.push(`Tab = snap ตัวถัดไป (${draw.cyc.i + 1}/${n})`);
  if (cmd.stage === "dest") lines.push(n >= 2 ? "พิมพ์ตัวเลข = พิมพ์ระยะ" : "พิมพ์ตัวเลข / Tab = พิมพ์ระยะ");
  showTip(px, py, lines.join("\n"));
}
function cmdClick(px, py){
  if (draw.typing) closeTyping();
  cmdMove(px, py);
  if (!cmd.pt) return;
  if (cmd.stage === "base"){
    cmd.base = cmd.pt; cmd.stage = "dest"; draw.lastCyc = null;
    cmdBanner(); cmdMove(px, py);
    return;
  }
  cmdCommit({ x: cmd.pt.x - cmd.base.x, y: cmd.pt.y - cmd.base.y });
}
function cmdCommit(v){
  const N = CMD_NAMES[cmd.name];
  let msg = "";
  if (state.editing){
    const it = editItem(), n = cmd.name === "paste" ? clip.n : pickedList().length;
    const label = cmd.name === "move" ? `ย้าย ${n} objects` : `${N} ${n} objects`;
    const g = cmdTrial(v);
    specEdit(spec => applyDrawn(spec, it, v), it, label);
    msg = label + (g.info.blocked.length ? " · ไม่ย้าย: " + g.info.blocked.map(x => x.id).join(", ") : "")
                + (g.follow.length ? ` · ขยับตาม ${g.follow.length} จุด` : "");
  } else {
    const ids = cmdItems();
    if (cmd.name === "move") moveItems(ids, v);
    else if (cmd.name === "copy") addItemClones(itemSrcs(ids), v, `Copy ${ids.length} subassembly`);
    else addItemClones(clip.srcs, v, `Paste ${clip.n} subassembly`);
  }
  if (cmd.name === "copy"){ cmd.n++; cmdBanner(); refreshSnap(); return; }   // Copy วางซ้ำได้จน Enter / Esc
  endCmd(msg);
}

// ---------------- พิมพ์ระยะ (Tab / พิมพ์ตัวเลข) ----------------
// dx / dy บนจอ (ขวา + ขึ้น +) · slope แบบ 1:2 (ขึ้น/ลงตามเมาส์) + ยาวตามแนวลาด · เว้นว่าง = ใช้ค่าจากเมาส์
function openCmdTyping(first){
  if (cmd.stage !== "dest" || !cmd.pt) return;
  const box = $("dyn"), m = { x: cmd.pt.x - cmd.base.x, y: cmd.pt.y - cmd.base.y };
  draw.typing = true;
  box.innerHTML = `<div class="dyn-h">${CMD_NAMES[cmd.name]}: ระยะจากจุดฐาน · เว้นว่าง = ใช้ค่าจากเมาส์ · Enter = ตกลง · Esc = ยกเลิก</div>
    <label>dx<input data-f="dx" placeholder="${f3(m.x)}"></label>
    <label>dy<input data-f="dy" placeholder="${f3(m.y)}"></label>
    <label>slope<input data-f="slope" placeholder="เช่น 1:2"></label>
    <label>ยาว<input data-f="length" placeholder="ตามแนวลาด"></label>`;
  for (const inp of box.querySelectorAll("input")){
    inp.addEventListener("input", () => {
      const v = inp.value.trim(), chk = v ? Expr.check(inp.dataset.f === "slope" ? slopeMag(v) : v, []) : { ok: true };
      inp.classList.toggle("bad", !chk.ok); inp.title = chk.ok ? "" : chk.error;
    });
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter"){ e.preventDefault(); commitCmdTyping(m); }
      else if (e.key === "Escape"){ e.preventDefault(); closeTyping(); }
      e.stopPropagation();
    });
  }
  const tp = tip.getBoundingClientRect(), mr = main.getBoundingClientRect();
  box.style.left = Math.max(4, Math.min(mr.width - 330, tp.left - mr.left)) + "px";
  box.style.top = Math.max(4, Math.min(mr.height - 120, tp.bottom - mr.top + 6)) + "px";
  box.hidden = false; tip.style.display = "none";
  const inp = box.querySelector("input");
  inp.focus();
  if (first){ inp.value = first; inp.dispatchEvent(new Event("input")); }
}
function commitCmdTyping(m){
  const box = $("dyn"), val = k => box.querySelector(`[data-f=${k}]`).value.trim();
  if (box.querySelector("input.bad")) return box.querySelector("input.bad").focus();
  const n = k => Expr.value(val(k), {});
  const dx = val("dx"), dy = val("dy"), sl = val("slope"), L = val("length");
  let v;
  if (sl){
    const s = (/^-/.test(sl) ? -1 : /^1:/.test(sl) ? (m.y < 0 ? -1 : 1) : 1) * Math.abs(Expr.value(slopeMag(sl.replace(/^-/, "")), {}));
    const dir = Math.sign(dx ? n("dx") : m.x) || 1;
    const run = L ? n("length") / Math.sqrt(1 + s * s) : dx ? Math.abs(n("dx")) : Math.abs(m.x);
    v = { x: dir * run, y: s * run };
  } else if (L && !dx && !dy){
    const d = Math.hypot(m.x, m.y) || 1;
    v = { x: m.x / d * n("length"), y: m.y / d * n("length") };
  } else v = { x: dx ? n("dx") : m.x, y: dy ? n("dy") : m.y };
  closeTyping();
  cmdCommit(v);
}

// ---------------- เงา + marker ----------------
function renderCmdOverlay(){
  if (!cmdPlacing() || !cmd.pt) return;
  const S = cmdScreen, line = (P, cls) => el("path", { d: P.map((p, j) => (j ? "L" : "M") + p.x + " " + p.y).join(" "), class: cls }, svg);
  if (cmd.stage === "dest" && cmd.base){
    const a = S(cmd.base), b = S(cmd.pt);
    el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "rubber" }, svg);
    if (cmd.ghost){
      for (const P of cmd.ghost.links) line(P.map(S), "ghost");
      for (const p of cmd.ghost.pts){ const q = S(p); el("rect", { x: q.x - 4, y: q.y - 4, width: 8, height: 8, class: "ghost-pt" }, svg); }
    } else if (cmd.geom){
      const v = { x: cmd.pt.x - cmd.base.x, y: cmd.pt.y - cmd.base.y };
      for (const P of cmd.geom){
        const Q = P.map(p => S({ x: p.x + v.x, y: p.y + v.y }));
        if (Q.length > 1) line(Q, "ghost"); else el("rect", { x: Q[0].x - 3, y: Q[0].y - 3, width: 6, height: 6, class: "ghost-pt" }, svg);
      }
    }
  }
  const c = cmd.cand, q = S(cmd.pt);
  if (c && c.kind !== "free"){
    el("path", { d: osnapMarker(c.kind, q.x, q.y), class: "osnap " + c.kind }, svg);
    el("text", { x: q.x + 12, y: q.y - 10, class: "osnap-lbl" }, svg).textContent = OSNAP_LABEL[c.kind] + (draw.list.length >= 2 ? ` (${draw.cyc.i + 1}/${draw.list.length})` : "");
  } else el("circle", { cx: q.x, cy: q.y, r: 3, class: "osnap free" }, svg);
}

// ---------------- คลิปบอร์ด ----------------
// Ctrl+C / Ctrl+X: จำชุดที่เลือก (Edit mode = ส่วนที่วาด, นอก Edit = subassembly) · จุดฐานตอนวาง = มุมซ้ายล่าง
function copyClip(cut){
  if (state.editing){
    const it = editItem(), r = it && drawRes[it.id];
    if (!r || !pickedList().length) return flashBanner("ยังไม่ได้เลือกอะไร");
    const frag = cmdFrag(it), pos = posOf(r), P = frag.points.map(id => pos[id]).filter(Boolean);
    clip = { kind: "drawn", spec: JSON.parse(JSON.stringify(it.spec)), frag, pos, F: r.flip, from: it.id, n: pickedList().length,
             base: { x: Math.min(...P.map(p => p.x)), y: Math.min(...P.map(p => p.y)) } };
    if (cut) deleteDrawnSet(it, pickedList());
  } else {
    const ids = cmdItems();
    if (!ids.length) return flashBanner("ยังไม่ได้เลือก subassembly");
    const geom = itemsGeom(ids), P = geom.flat();
    clip = { kind: "items", srcs: itemSrcs(ids), geom, n: ids.length,
             base: { x: Math.min(...P.map(p => p.x)), y: Math.min(...P.map(p => p.y)) } };
    if (cut) removeItems(ids);
  }
  flashBanner(`${cut ? "ตัด" : "คัดลอก"} ${clip.n} objects แล้ว — Ctrl+V = วาง`);
}

// ---------------- ตาราง shortcut (? / F1) ----------------
const SHORTCUTS = [
  ["ทั่วไป", [["Ctrl+Z", "Undo"], ["Ctrl+Y / Ctrl+Shift+Z", "Redo"], ["Ctrl+S", "Save (.cs) ตอน Edit / บันทึกแถบโค้ด"], ["Ctrl+E", "แถบแก้โค้ด"],
              ["F", "Fit (ดูทั้งหมด)"], ["A", "Add point บนเส้น surface"], ["? / F1", "ตารางนี้"], ["Esc", "ยกเลิกคำสั่ง / เครื่องมือ / การเลือก"]]],
  ["เลือก", [["คลิก", "เพิ่มเข้าชุดที่เลือก"], ["ลากซ้าย → ขวา", "Window (อยู่ในกรอบทั้งตัว)"], ["ลากขวา → ซ้าย", "Crossing (แตะกรอบ)"],
             ["Shift + คลิก / คลุม", "เอาออกจากชุด"], ["Ctrl + คลิก (ต้นไม้)", "เพิ่ม / เอาออก"], ["Ctrl+A", "เลือกทั้งหมด"], ["Delete", "ลบที่เลือก"]]],
  ["แก้ไข", [["M", "Move"], ["C", "Copy (วางได้หลายครั้ง, Enter = จบ)"], ["Ctrl+C / Ctrl+X / Ctrl+V", "คัดลอก / ตัด / วาง"],
             ["Enter / คลิกขวา", "จบการเลือก / จบ Copy"]]],
  ["วาด (Edit mode)", [["P / L / S", "Point / Link / Shape"], ["Tab", "snap ตัวถัดไป (มีหลายตัว) / พิมพ์ค่า"], ["พิมพ์ตัวเลข", "พิมพ์ค่า / ระยะ"],
                       ["Enter / คลิกขวา", "จบเส้น"]]],
  ["แถบล่าง", [["F3", "OSNAP เปิด/ปิด"], ["F8", "Ortho"], ["F9", "Grid snap"]]],
  ["มุมมอง", [["ปุ่มกลางเมาส์ลาก / Space + ลาก", "Pan"], ["ล้อเมาส์", "Zoom"]]]
];
function showShortcuts(){
  openDialog("Shortcut", b => {
    for (const [h, rows] of SHORTCUTS){
      div("pg-h", esc(h), b);
      kv(b, rows.map(([k, t]) => [k, t]));
    }
  });
}
