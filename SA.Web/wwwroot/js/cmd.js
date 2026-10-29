// Move (M) / Copy (C) / Paste (Ctrl+V) / Rotate (R) แบบ AutoCAD + คลิปบอร์ด (Ctrl+C / Ctrl+X)
//
// Rotate (Edit mode เท่านั้น): เลือก → คลิกจุดหมุน (base point) → ลากเมาส์ = มุม (ทวนเข็ม +) หรือ Tab / พิมพ์ = มุม (นิพจน์ / parameter)
//   ตัวเลือกแบบ AutoCAD: C = หมุนสำเนา (ต้นฉบับอยู่ที่เดิม) · R = Reference (มุมอ้างอิง 2 จุด / พิมพ์ → มุมใหม่)
//   เก็บเป็นกลุ่มหมุนใน spec (spec.rotations, ดู spec.js / Ops.rotate) ไม่แปลงเป็นพิกัดคงที่
//
// เลือกก่อนแล้วสั่ง หรือสั่งก่อนแล้วเลือก (Enter / คลิกขวา = จบการเลือก) → คลิกจุดฐาน → เงาตามเมาส์ → คลิกปลายทาง
//   ใช้ OSNAP / Grid snap / Ortho / ล็อก slope ได้ · Tab / พิมพ์ตัวเลข = พิมพ์ระยะ dx, dy หรือ slope + ยาว · Esc = ยกเลิก
//   Copy วางได้หลายครั้งจน Enter / Esc · Paste เริ่มที่ขั้นปลายทางเลย (จุดฐาน = มุมซ้ายล่างของชุดที่คัดลอก)
// Edit mode = point / link / shape ที่วาด (ดู ops.js) · นอก Edit mode = subassembly ทั้งตัว (ปล่อยใกล้แกน / จุด = เกาะ แบบการลาก)
// พิกัดของคำสั่ง ("พิกัดงาน"): Edit mode = เทียบ origin ของตัวที่แก้ · นอก Edit = พิกัดโลก
"use strict";

// stage: select (เลือก object) | base (คลิกจุดฐาน) | dest (คลิกปลายทาง)
// Rotate: baseCand = snap ที่จุดหมุน · ang = มุมจากเมาส์ (บนจอ องศา) · copyRot = ตัวเลือก C · sub = ref1 / ref2 (Reference) · refAng / refText = มุมอ้างอิง
const cmd = { name: null, stage: null, base: null, pt: null, cand: null, convert: false, ghost: null, geom: null, n: 0,
              baseCand: null, ang: 0, copyRot: false, sub: null, ref1: null, refAng: 0, refText: null };
let clip = null;   // { kind: "drawn", spec, frag, pos, F, from, base, n } | { kind: "items", srcs, geom, base, n }
const CMD_NAMES = { move: "Move", copy: "Copy", paste: "Paste", rotate: "Rotate" };
const cmdPlacing = () => !!cmd.name && cmd.stage !== "select";

function startCmd(name){
  if (draw.tool) setTool(null);
  closeTyping();
  const fresh = { name, base: null, pt: null, cand: null, convert: false, ghost: null, geom: null, n: 0,
                  baseCand: null, ang: 0, copyRot: false, sub: null, ref1: null, refAng: 0, refText: null };
  if (name === "rotate" && !state.editing) return flashBanner("Rotate ใช้กับส่วนที่วาดใน Edit mode (คลิกขวาที่ subassembly → Edit)");
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
  closeTyping(); tip.style.display = "none"; draw.list = []; trackClear();
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
  const rot = cmd.name === "rotate";
  const t = {
    select: `${N}: เลือก object (คลิก / คลุม) แล้วกด Enter · Esc = ยกเลิก`,
    base: rot ? `Rotate ${n} objects: คลิกจุดหมุน (base point) · Esc = ยกเลิก` : `${N} ${n} objects: คลิกจุดฐาน (base point) · Esc = ยกเลิก`,
    dest: rot ? rotBannerText(n)
              : `${N} ${n} objects: คลิกปลายทาง · Tab / พิมพ์ตัวเลข = พิมพ์ระยะ · Esc = ยกเลิก` + (cmd.name === "copy" ? ` · Enter = จบ${cmd.n ? ` (วางแล้ว ${cmd.n})` : ""}` : "")
  }[cmd.stage];
  b.innerHTML = esc(t); b.style.display = "block";
  if (rot){
    // จุดที่หมุนไม่ได้: บอกเหตุผล (รอบนี้ยังไม่มีตัวเลือกแปลงเป็นค่าคงที่)
    const bl = cmd.stage !== "select" ? rotTrialPlan().blocked : [];
    if (bl.length){
      const d = document.createElement("div"); d.className = "banner-warn";
      d.textContent = "⚠ ไม่หมุน: " + bl.slice(0, 6).map(x => `${x.id} (${x.why})`).join(", ") + (bl.length > 6 ? ` … +${bl.length - 6}` : "");
      b.appendChild(d);
    }
    return;
  }
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
    Ops.apply(spec, pl, v, F, pos, r.raw);
    return { blocked: pl.blocked, ids: f.points };
  }
  let c;
  if (cmd.name === "copy") c = Ops.clone(spec, cmdFrag(it), spec, { pos });
  else {
    // วางในตัวเดิม (จุดนอกชุดที่อ้างถึงยังอยู่) = อ้างตัวเดิม · ตัวอื่น = แปลงเป็นระยะจาก origin ของตัวใหม่
    const ids = new Set(spec.points.map(p => p.id));
    const same = clip.from === it.id && clip.frag.points.every(id => Spec.refs(Spec.byId(clip.spec.points, id).def).every(x => ids.has(x) || clip.frag.points.includes(x)));
    c = Ops.clone(clip.spec, clip.frag, spec, { detach: !same, pos: clip.pos, raw: clip.raw, F, names: specNames(it) });
  }
  const pl = Ops.plan(spec, c.points, cmd.convert);
  // ค่าก่อนหมุน (กลุ่มหมุน) ของสำเนา = ของตัวเดิม (เฉพาะสำเนาในตัวเดียวกัน)
  const raw = { ...(r.raw || {}) };
  if (cmd.name === "copy") for (const [a, b] of Object.entries(c.map)) if (r.raw && r.raw[a]) raw[b] = r.raw[a];
  Ops.apply(spec, pl, v, F, { ...pos, ...c.pos }, raw);
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
  trackHover(list[0]);
  return pickSnap(Track.merge(list, trackCands(m)), () => cmdFree(m, A));     // Tracking: ตำแหน่งอย่างเดียว (ไม่เก็บลง spec)
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
  if (cmd.name === "rotate"){
    cmd.ghost = null;
    if (cmd.stage === "dest" && !cmd.sub){
      let a = rotAngleOf(cmd.base, cmd.pt);
      if (cmd.cand.kind === "free") a = state.bar.ortho ? Math.round(a / 90) * 90 : Math.round(a);   // ไม่ชน snap: ปัดทีละ 1° (Ortho = 90°)
      cmd.ang = normAng(a - cmd.refAng);
    }
  } else cmd.ghost = cmd.stage === "dest" && state.editing ? cmdTrial({ x: cmd.pt.x - cmd.base.x, y: cmd.pt.y - cmd.base.y }) : null;
  render();
  cmdTip(px, py);
}
function cmdTip(px, py){
  const c = cmd.cand, lines = [], n = draw.list.length;
  if (!c) return;
  if (c.label) lines.push((OSNAP_LABEL[c.kind] ? `${OSNAP_LABEL[c.kind]}: ` : "") + c.label);
  if (cmd.name === "rotate" && cmd.stage === "dest"){
    lines.push(cmd.sub === "ref1" ? "มุมอ้างอิง: จุดแรก" : cmd.sub === "ref2" ? "มุมอ้างอิง: จุดที่สอง"
             : `หมุน ${f3(cmd.ang)}° (${cmd.ang >= 0 ? "ทวนเข็ม" : "ตามเข็ม"})` + (cmd.refText != null || cmd.refAng ? ` · อ้างอิง ${cmd.refText != null ? cmd.refText : f3(cmd.refAng)}°` : ""));
    lines.push(n >= 2 ? `Tab = snap ตัวถัดไป (${draw.cyc.i + 1}/${n}) · พิมพ์ตัวเลข = พิมพ์มุม` : "พิมพ์ตัวเลข / Tab = พิมพ์มุม (นิพจน์ / parameter ได้)");
    return showTip(px, py, lines.join("\n"));
  }
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
    cmd.base = cmd.pt; cmd.baseCand = cmd.cand; cmd.stage = "dest"; draw.lastCyc = null;
    cmdBanner(); cmdMove(px, py);
    return;
  }
  if (cmd.name === "rotate"){
    if (cmd.sub === "ref1"){ cmd.ref1 = cmd.pt; cmd.sub = "ref2"; cmdBanner(); return cmdMove(px, py); }
    if (cmd.sub === "ref2"){
      if (Math.hypot(cmd.pt.x - cmd.ref1.x, cmd.pt.y - cmd.ref1.y) < 1e-9) return flashBanner("คลิกจุดที่สองให้ห่างจากจุดแรก");
      cmd.refAng = rotAngleOf(cmd.ref1, cmd.pt); cmd.refText = null; cmd.sub = null; cmdBanner(); return cmdMove(px, py);
    }
    return rotCommit(rotMouseText());
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

// ---------------- Rotate ----------------
const rotAngleOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
const normAng = a => { a = ((a + 180) % 360 + 360) % 360 - 180; return Math.abs(a + 180) < 1e-9 ? 180 : a; };
function rotBannerText(n){
  const opt = ` · [C] Copy${cmd.copyRot ? " (เปิด)" : ""} · [R] Reference · Esc = ยกเลิก`;
  if (cmd.sub === "ref1") return `Rotate ${n} objects — Reference: คลิกจุดแรกของมุมอ้างอิง (หรือ Tab = พิมพ์มุมอ้างอิง)` + opt;
  if (cmd.sub === "ref2") return `Rotate ${n} objects — Reference: คลิกจุดที่สองของมุมอ้างอิง` + opt;
  const ref = cmd.refText != null || cmd.refAng ? ` (มุมใหม่ − อ้างอิง ${cmd.refText != null ? cmd.refText : Expr.num(cmd.refAng)}°)` : "";
  return `Rotate ${n} objects${cmd.copyRot ? " (สำเนา)" : ""}: ลากเมาส์ = มุม${ref} ทวนเข็ม + · คลิก = ตกลง · Tab / พิมพ์ = พิมพ์มุม` + opt;
}
// ตัวเลือกระหว่างระบุมุม: C = สลับ Copy · R = Reference
function rotOption(k){
  if (k === "c") cmd.copyRot = !cmd.copyRot;
  else { cmd.sub = "ref1"; cmd.ref1 = null; cmd.refAng = 0; cmd.refText = null; }
  cmdBanner(); refreshSnap();
}
// จุดหมุนเป็นจุดใน spec: snap ที่จุดเดิม = จุดนั้น · snap อื่น (กึ่งกลาง / จุดตัด ...) = จุดใหม่ (auxiliary) · ที่ว่าง / Tracking = จุด auxiliary ค่าคงที่
function rotPivot(spec, F){
  const c = cmd.baseCand, before = new Set(spec.points.map(p => p.id));
  const id = c && c.make ? c.make() : Spec.addPoint(spec, { type:"delta", dx: Expr.num(cmd.base.x * F), dy: Expr.num(cmd.base.y) }, [], true);
  if (!before.has(id)) Spec.byId(spec.points, id).auxiliary = true;
  return id;
}
// แผน (ไม่แก้ spec) สำหรับบอกจุดที่หมุนไม่ได้ใน banner
function rotTrialPlan(){
  const it = editItem(), c = cmd.baseCand;
  const pivot = c && c.kind === "end" && c.point && c.point.ref && c.point.ref.type === "pt" ? c.point.ref.id : null;
  return Ops.rotatePlan(JSON.parse(JSON.stringify(it.spec)), cmdFrag(it).points, pivot);
}
// มุมบนจอ (ทวนเข็ม +) -> มุมในกรอบ Side = Right ที่เก็บใน spec (ฝั่ง Left กลับเครื่องหมาย)
const rotStore = (txt, F) => F === 1 ? txt : /^-?\d+(\.\d+)?$/.test(txt) ? Expr.num(-txt) : `-(${txt})`;
// มุมจากเมาส์ (หักมุมอ้างอิงแล้ว) · มุมอ้างอิงที่พิมพ์เป็นนิพจน์ = เก็บเป็น "มุมใหม่ - (อ้างอิง)" ให้ parameter ยังคุมได้
const rotMouseText = () => cmd.refText != null ? `${Expr.num(cmd.ang + cmd.refAng)} - (${cmd.refText})` : Expr.num(cmd.ang);
// มุมใหม่ที่พิมพ์ (มี Reference = หักมุมอ้างอิง)
function rotTypedText(v){
  if (cmd.refText != null) return `(${v}) - (${cmd.refText})`;
  if (Math.abs(cmd.refAng) > 1e-12) return /^-?\d+(\.\d+)?$/.test(v) ? Expr.num(+v - cmd.refAng) : `(${v}) - ${Expr.num(cmd.refAng)}`;
  return v;
}
function rotCommit(screenTxt){
  const it = editItem(), F = drawRes[it.id].flip, n = pickedList().length;
  const txt = String(screenTxt).trim(), stored = rotStore(txt, F);
  let res = null;
  specEdit(spec => {
    const pos = posOf(drawRes[it.id]);
    const ids = cmd.copyRot ? Ops.clone(spec, cmdFrag(it), spec, { pos }).points : cmdFrag(it).points;
    res = Ops.rotate(spec, ids, rotPivot(spec, F), stored);
  }, it, `${cmd.copyRot ? "หมุนสำเนา" : "หมุน"} ${n} objects ${txt}°`);
  const bl = res ? res.blocked : [];
  endCmd(`หมุน ${txt}°` + (res && res.group ? ` (กลุ่มหมุน ${res.group})` : res && res.merge.length ? ` (เพิ่มมุมของ ${res.merge.join(", ")})` : "")
         + (bl.length ? " · ไม่หมุน: " + bl.map(x => x.id).join(", ") : ""));
}
// เงา: ชุดที่เลือก (จุด + link) หมุนรอบจุดหมุนตามมุมจากเมาส์ (ดูรูปคร่าวๆ — ของที่อ้างตามจะเห็นหลังคลิก)
function rotGhost(){
  const it = editItem(), r = drawRes[it.id], f = cmdFrag(it), a = cmd.ang;
  const rot = p => Spec.rotatePt(p, cmd.base, a);
  return { pts: f.points.filter(id => r.pts[id] && !r.pts[id].err).map(id => rot(r.pts[id])),
           links: f.links.filter(id => r.links[id] && r.links[id].path).map(id => r.links[id].path.map(rot)) };
}
function openRotTyping(first){
  const it = editItem(), box = $("dyn"), ref = cmd.sub === "ref1" || cmd.sub === "ref2";
  draw.typing = true;
  box.innerHTML = `<div class="dyn-h">Rotate: ${ref ? "มุมอ้างอิง (องศา ทวนเข็มจาก +x บนจอ)" : "มุมหมุน (องศา ทวนเข็ม + บนจอ" + (cmd.refText != null || cmd.refAng ? " — มุมใหม่ แล้วหักมุมอ้างอิง" : "") + ")"} · นิพจน์ / ชื่อ parameter ได้ · Enter = ตกลง · Esc = ยกเลิก</div>
    <label>${ref ? "อ้างอิง" : "มุม"}<input data-f="a" placeholder="${ref ? "0" : f3(cmd.ang + (cmd.refText != null || cmd.refAng ? cmd.refAng : 0))}"><button type="button" class="dyn-par" title="สร้าง parameter ใหม่จากช่องนี้">+</button></label>`
    + (ref ? "" : `<label class="dyn-chk"><input type="checkbox" data-f="copy"${cmd.copyRot ? " checked" : ""}> Copy (ต้นฉบับอยู่ที่เดิม)</label>`);
  const inp = box.querySelector("[data-f=a]"), names = () => specNames(it);
  const check = () => { const r = checkTyped("a", inp.value.trim(), names()); inp.classList.toggle("bad", !r.ok); inp.title = r.ok ? "" : r.error; };
  inp.addEventListener("input", check);
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter"){ e.preventDefault(); commitRotTyping(ref); }
    else if (e.key === "Escape"){ e.preventDefault(); closeTyping(); }
    e.stopPropagation();
  });
  box.querySelector(".dyn-par").onclick = () => {
    const name = newParamFromValue(it, inp.value.trim() || inp.placeholder, ref ? "RefAng" : "Ang");
    if (name){ inp.value = name; check(); }
    inp.focus();
  };
  const tp = tip.getBoundingClientRect(), mr = main.getBoundingClientRect();
  box.style.left = Math.max(4, Math.min(mr.width - 330, (tp.width ? tp.left : mr.left + 40) - mr.left)) + "px";
  box.style.top = Math.max(4, Math.min(mr.height - 120, (tp.height ? tp.bottom : mr.top + 40) - mr.top + 6)) + "px";
  box.hidden = false; tip.style.display = "none";
  inp.focus();
  if (first){ inp.value = first; check(); }
}
function commitRotTyping(ref){
  const box = $("dyn"), inp = box.querySelector("[data-f=a]");
  if (inp.classList.contains("bad")) return inp.focus();
  const v = inp.value.trim(), it = editItem();
  if (ref){
    closeTyping();
    // มุมอ้างอิงเป็นตัวเลข = เก็บเป็นตัวเลข · นิพจน์ / parameter = เก็บข้อความไว้ใส่ในมุมที่ได้
    if (v){ try{ cmd.refAng = Expr.value(v, drawRes[it.id].env || {}); }catch{ cmd.refAng = 0; } cmd.refText = /^-?\d+(\.\d+)?$/.test(v) ? null : v; }
    cmd.sub = null; cmdBanner(); return refreshSnap();
  }
  const cp = box.querySelector("[data-f=copy]");
  if (cp) cmd.copyRot = cp.checked;
  closeTyping();
  // เว้นว่าง = มุมจากเมาส์
  rotCommit(v ? rotTypedText(v) : rotMouseText());
}

// ---------------- พิมพ์ระยะ (Tab / พิมพ์ตัวเลข) ----------------
// dx / dy บนจอ (ขวา + ขึ้น +) · slope แบบ 1:2 (ขึ้น/ลงตามเมาส์) + ยาวตามแนวลาด · เว้นว่าง = ใช้ค่าจากเมาส์
// มีจุดที่จับไว้ (Tracking) = ระยะคิดจากจุดอ้างอิงหลักแทนจุดฐาน (ผลลัพธ์ยังเป็นการย้ายจากจุดฐานไปตำแหน่งนั้น)
function openCmdTyping(first){
  if (cmd.stage !== "dest" || !cmd.pt) return;
  if (cmd.name === "rotate") return openRotTyping(first);
  const R = trackOn() && trk.list.length ? Track.main(trk.list) : null, B = R || cmd.base;
  const box = $("dyn"), m = { x: cmd.pt.x - B.x, y: cmd.pt.y - B.y };
  draw.typing = true;
  box.innerHTML = `<div class="dyn-h">${CMD_NAMES[cmd.name]}: ${R ? `<b>ระยะจาก ${esc(R.label || OSNAP_LABEL[R.kind])}</b> (Tracking)` : "ระยะจากจุดฐาน"} · เว้นว่าง = ใช้ค่าจากเมาส์ · dx พิมพ์ ระยะ&lt;มุม ได้ · Enter = ตกลง · Esc = ยกเลิก</div>
    <label>dx<input data-f="dx" placeholder="${f3(m.x)}"></label>
    <label>dy<input data-f="dy" placeholder="${f3(m.y)}"></label>
    <label>slope<input data-f="slope" placeholder="เช่น 1:2"></label>
    <label>ยาว<input data-f="length" placeholder="ตามแนวลาด"></label>`;
  for (const inp of box.querySelectorAll("input")){
    inp.addEventListener("input", () => {
      const chk = checkTyped(inp.dataset.f, inp.value.trim(), []);
      inp.classList.toggle("bad", !chk.ok); inp.title = chk.ok ? "" : chk.error;
    });
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter"){ e.preventDefault(); commitCmdTyping(m, B); }
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
function commitCmdTyping(m, B){
  const box = $("dyn"), val = k => box.querySelector(`[data-f=${k}]`).value.trim();
  if (box.querySelector("input.bad")) return box.querySelector("input.bad").focus();
  const n = k => Expr.value(val(k), {});
  const dx = val("dx"), dy = val("dy"), sl = val("slope"), L = val("length"), pol = Track.polarText(dx);
  let v;
  if (pol){
    const len = Expr.value(pol.length, {}), a = Expr.value(pol.angle, {}) * Math.PI / 180;
    v = { x: len * Math.cos(a), y: len * Math.sin(a) };
  } else if (sl){
    const s = (/^-/.test(sl) ? -1 : /^1:/.test(sl) ? (m.y < 0 ? -1 : 1) : 1) * Math.abs(Expr.value(slopeMag(sl.replace(/^-/, "")), {}));
    const dir = Math.sign(dx ? n("dx") : m.x) || 1;
    const run = L ? n("length") / Math.sqrt(1 + s * s) : dx ? Math.abs(n("dx")) : Math.abs(m.x);
    v = { x: dir * run, y: s * run };
  } else if (L && !dx && !dy){
    const d = Math.hypot(m.x, m.y) || 1;
    v = { x: m.x / d * n("length"), y: m.y / d * n("length") };
  } else v = { x: dx ? n("dx") : m.x, y: dy ? n("dy") : m.y };
  closeTyping();
  // ค่าที่พิมพ์คิดจาก B (จุดฐาน หรือจุดอ้างอิงของ Tracking) -> ระยะย้ายจากจุดฐาน
  cmdCommit({ x: B.x + v.x - cmd.base.x, y: B.y + v.y - cmd.base.y });
}

// ---------------- เงา + marker ----------------
function renderCmdOverlay(){
  if (!cmdPlacing() || !cmd.pt) return;
  const S = cmdScreen, line = (P, cls) => el("path", { d: P.map((p, j) => (j ? "L" : "M") + p.x + " " + p.y).join(" "), class: cls }, svg);
  if (cmd.name === "rotate" && cmd.stage === "dest" && cmd.base){
    const a = S(cmd.base), b = S(cmd.pt);
    if (cmd.sub === "ref2" && cmd.ref1){ const r1 = S(cmd.ref1); el("line", { x1: r1.x, y1: r1.y, x2: b.x, y2: b.y, class: "rubber close" }, svg); }
    else if (!cmd.sub){
      el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "rubber" }, svg);
      const g = rotGhost();
      for (const P of g.links) line(P.map(S), "ghost");
      for (const p of g.pts){ const q = S(p); el("rect", { x: q.x - 4, y: q.y - 4, width: 8, height: 8, class: "ghost-pt" }, svg); }
    }
    el("circle", { cx: a.x, cy: a.y, r: 5, class: "osnap cen" }, svg);
  }
  else if (cmd.stage === "dest" && cmd.base){
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
  renderTrack(c, S);
  if (c && c.kind !== "free"){
    if (c.kind !== "trk") el("path", { d: osnapMarker(c.kind, q.x, q.y), class: "osnap " + c.kind }, svg);
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
    clip = { kind: "drawn", spec: JSON.parse(JSON.stringify(it.spec)), frag, pos, raw: JSON.parse(JSON.stringify(r.raw || {})), F: r.flip, from: it.id, n: pickedList().length,
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
  ["แก้ไข", [["M", "Move"], ["C", "Copy (วางได้หลายครั้ง, Enter = จบ)"], ["R", "Rotate (Edit mode) · ระหว่างระบุมุม: C = หมุนสำเนา · R = Reference"],
             ["X", "Auxiliary: ระหว่างวาด = สลับโหมดของชิ้นที่จะสร้าง · มีของเลือก = สลับ point / link ที่เลือก"],
             ["Ctrl+C / Ctrl+X / Ctrl+V", "คัดลอก / ตัด / วาง"],
             ["Enter / คลิกขวา", "จบการเลือก / จบ Copy"]]],
  ["วาด (Edit mode)", [["P / L / S", "Point / Link / Shape"], ["Tab", "snap ตัวถัดไป (มีหลายตัว) / พิมพ์ค่า"], ["พิมพ์ตัวเลข", "พิมพ์ค่า / ระยะ"],
                       ["Enter / คลิกขวา", "จบเส้น"], ["C (ตอนวาด Polygon)", "ปิดรูป Polygon อิสระ (≥ 3 จุด)"],
                       ["Tab (Polygon ด้านเท่า)", "พิมพ์ N / R / θ / ถึงกึ่งกลางด้าน · ปุ่ม + = สร้าง parameter จากช่อง"],
                       ["T / E (ตอนวาด Arc)", "Arc 3 จุด / เริ่ม-ปลาย-รัศมี (Tab ตอนเลือกความโค้ง = พิมพ์ R, ตามเข็ม, ทางยาว)"],
                       ["Tab / ตัวเลข (Fillet)", "ตั้งรัศมี Fillet (นิพจน์ / parameter ได้)"]]],
  ["แถบล่าง", [["F3", "OSNAP เปิด/ปิด"], ["▾ / คลิกขวาที่ OSNAP", "เมนูเลือกชนิด snap"], ["F8", "Ortho"], ["F9", "Grid snap (ดับเบิลคลิกปุ่ม = ตั้งระยะ ถึง 0.001 m)"],
               ["F11", "Object snap tracking (ชี้ค้างบน snap = จับจุด · ชี้ค้างซ้ำ = ปล่อย · Esc = ล้าง)"],
               ["ปุ่ม Aux", "แสดง / ซ่อน Auxiliary (ซ่อน = snap / คลุมเลือกไม่ได้)"], ["ปุ่ม ดูแบบ Civil 3D", "เห็นเฉพาะที่จะส่งออกไปจริง"]]],
  ["พิมพ์ค่า", [["ตัวเลข", "dx / dy (มีจุดที่จับไว้ = คิดจากจุดนั้น)"], ["ระยะ<มุม ในช่อง dx", "เช่น 5<30 = ห่าง 5 ทำมุม 30° (ทวนเข็มจาก +x)"]]],
  ["มุมมอง", [["ปุ่มกลางเมาส์ลาก / Space + ลาก", "Pan"], ["ล้อเมาส์", "Zoom"], ["Shift + ล้อเมาส์", "Zoom ทีละน้อย"],
              ["Z", "Zoom ไปที่ของที่เลือก (ไม่มีที่เลือก = Fit)"]]]
];
function showShortcuts(){
  openDialog("Shortcut", b => {
    for (const [h, rows] of SHORTCUTS){
      div("pg-h", esc(h), b);
      kv(b, rows.map(([k, t]) => [k, t]));
    }
  });
}
