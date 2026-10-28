// object → บรรทัดโค้ด (และกลับกัน)
//
// ส่วนที่วาด (P1, L1, S1 …): server อ่านจากช่วง SA-DRAWING ของโค้ดที่รันจริง (asmRes[id].drawnLines)
// จุด / link / shape ของโค้ดที่เขียนเอง: ตัวจำลองจำบรรทัดที่เรียก Points / Links / Shapes.Add ทั้งสาย (sites ในสุดก่อน)
// เลขบรรทัดอ้างข้อความไหน (asmRes[id].linesFor): file = ไฟล์บนดิสก์ · editor = โค้ดในแถบแก้ · preview = โค้ดที่สร้างจากการวาด
//   (ส่วนที่วาดยังไม่ได้ Save ในไฟล์ที่มีอยู่ = บรรทัดของโค้ดหลัง Save)
// เคอร์เซอร์ในแถบโค้ดอยู่บรรทัดที่สร้าง object -> object นั้นเน้นบนรูป (codeHot)
"use strict";

let codeHot = null;   // { item, list: [{ type, id | i }] } object ที่บรรทัดของเคอร์เซอร์สร้าง

// { lines, chain (sites | null), linesFor, file } ของ object ที่เลือก หรือ null ถ้ายังไม่รู้
function codeLinesOf(it, s){
  const rr = it && asmRes[it.id];
  if (!rr || !rr.ok) return null;
  const base = { linesFor: rr.linesFor, file: rr.file };
  if (/^d(pt|link|shape)$/.test(s.type)){
    const L = rr.drawnLines && rr.drawnLines[s.id];
    return L && L.length ? { ...base, lines: L, chain: null } : null;
  }
  const res = rr.result;
  if (!res) return null;
  const o = s.type === "pt" ? res.points[s.i] : s.type === "link" ? res.links[s.i] : s.type === "shape" ? res.shapes[s.i] : null;
  const sites = o && o.sites;
  return sites && sites.length ? { ...base, lines: [sites[0].line], chain: sites } : null;
}
// แถบโค้ดแสดงข้อความที่เลขบรรทัดอ้างถึงอยู่ไหม
function codeViewMatches(it, c){
  if (!c || !editorActive() || selItemId() !== it.id) return false;
  if (c.linesFor === "preview") return ed.kind === "generated";
  return ed.kind !== "generated";
}

// กลุ่ม "โค้ด" ใน Properties
function propsCode(box, it, s){
  const c = codeLinesOf(it, s), g = group(box, "โค้ด");
  if (!c){
    div("hint", !asmRes[it.id] ? "กำลังคอมไพล์…" : /^d/.test(s.type) ? "ยังไม่รู้บรรทัด (รอผลรันรอบถัดไป)"
      : "ยังไม่รู้บรรทัด — object นี้ไม่ได้สร้างผ่าน Points / Links / Shapes.Add ของไฟล์นี้", g);
    return;
  }
  const a = l => `<a href="#" data-line="${l}">${l}</a>`;
  const html = c.chain
    ? c.chain.map((x, i) => `${i ? "← เรียกจาก " : "บรรทัด "}${a(x.line)} <small>(${esc(x.method)})</small>`).join(" ")
    : "บรรทัด " + c.lines.map(a).join(", ");
  const row = div("code-ref", `<span class="mono">${esc(c.file || "")}</span> ${html}`, g);
  for (const x of row.querySelectorAll("[data-line]")) x.onclick = e => { e.preventDefault(); gotoCode(it, [+x.dataset.line], c.linesFor); };
  const unsaved = c.linesFor === "preview" && hasCode(it);
  if (unsaved) div("hint", "ส่วนที่วาดยังไม่ได้ Save — เลขบรรทัดเป็นของโค้ดหลัง Save", g);
  else if (c.linesFor === "preview") div("hint", "ยังไม่มีไฟล์ — ชี้ไปที่โค้ดที่สร้างจากการวาด (ดูอย่างเดียว)", g);
  div("btns", null, g).append(btn(unsaved ? "Save (.cs) แล้วไปที่โค้ด" : "ไปที่โค้ด", () => gotoCode(it, c.lines, c.linesFor),
                                  unsaved && !canSaveDrawing(it), "เปิดแถบโค้ดที่บรรทัดนี้ (Ctrl+E = ปิด/เปิดแถบโค้ด)"));
}

// เปิดแถบโค้ดของตัวนี้ (ไฟล์ / โค้ดที่สร้าง) แล้วเลื่อนไปบรรทัด + เน้นบรรทัด
async function gotoCode(it, lines, linesFor){
  if (linesFor === "preview" && hasCode(it)){
    if (!canSaveDrawing(it)) return;
    await saveDrawing(it);                       // หลัง Save ไฟล์ = โค้ดเดียวกับที่สร้าง เลขบรรทัดตรงกัน
    if (drawingDirty(it)) return;                // Save ไม่สำเร็จ / ยกเลิก
  }
  if (!ed.open) await openEditor(); else await loadDoc();
  for (let k = 0; k < 40 && !editorActive(); k++) await new Promise(r => setTimeout(r, 50));
  if (!editorActive()) return;
  E.highlight(lines);
  E.goto(lines[0]);
}

// เลือก object ใหม่ตอนแถบโค้ดเปิดอยู่: เน้น + เลื่อนให้เห็นบรรทัด (ไม่ย้าย focus)
function syncCodeHighlight(){
  if (!E || !ed.open) return;
  const it = selItem(), c = it && state.sel.type !== "multi" ? codeLinesOf(it, state.sel) : null;
  if (codeViewMatches(it, c)){ E.highlight(c.lines); E.reveal(c.lines[0]); }
  else if (editorActive()) E.highlight([]);
  if (codeHot && (!it || codeHot.item !== it.id)){ codeHot = null; render(); }
}

// เคอร์เซอร์ในแถบโค้ด -> object ที่บรรทัดนี้สร้าง เน้นบนรูป (บรรทัดของฟังก์ชันช่วยที่สร้างหลาย object = เน้นทุกตัว)
function codeCursor(line){
  const it = selItem(), rr = it && asmRes[it.id];
  let list = [];
  if (rr && rr.ok && codeViewMatches(it, { linesFor: rr.linesFor })){
    if (rr.drawnLines && it.spec) for (const [id, L] of Object.entries(rr.drawnLines)) if (L.includes(line))
      list.push({ type: Spec.byId(it.spec.points, id) ? "dpt" : Spec.byId(it.spec.links, id) ? "dlink" : "dshape", id });
    const res = rr.result;
    if (res && !rr.generated){
      const hit = o => o.sites && o.sites.some(x => x.line === line);
      res.points.forEach((o, i) => { if (hit(o)) list.push({ type: "pt", i }); });
      res.links.forEach((o, i) => { if (hit(o)) list.push({ type: "link", i }); });
      res.shapes.forEach((o, i) => { if (hit(o)) list.push({ type: "shape", i }); });
    }
  }
  codeHot = list.length ? { item: it.id, list } : null;
  render();
}

// วาดเน้น object ของ codeHot (เรียกจาก render)
function renderCodeHot(){
  if (!codeHot) return;
  const it = itemById(codeHot.item), rr = asmRes[codeHot.item], d = drawRes[codeHot.item];
  if (!it) return;
  const P = rr && rr.result ? rr.result.points : [];
  const path = pts => pts.map((p, j) => (j ? "L" : "M") + sx(p.x) + " " + sy(p.y)).join(" ");
  const local = p => ({ x: d.ox + p.x, y: d.oy + p.y });
  for (const o of codeHot.list){
    if (o.type === "pt" && P[o.i]) el("circle", { cx: sx(P[o.i].x), cy: sy(P[o.i].y), r: 9, class: "code-hot" }, svg);
    else if (o.type === "link" && rr.result.links[o.i]) el("path", { d: path(rr.result.links[o.i].pts.map(k => P[k])), class: "code-hot" }, svg);
    else if (o.type === "shape" && rr.result.shapes[o.i] && rr.result.shapes[o.i].polygon) el("path", { d: path(rr.result.shapes[o.i].polygon.map(k => P[k])) + "Z", class: "code-hot area" }, svg);
    else if (d && o.type === "dpt" && d.pts[o.id] && !d.pts[o.id].err){ const q = local(d.pts[o.id]); el("circle", { cx: sx(q.x), cy: sy(q.y), r: 9, class: "code-hot" }, svg); }
    else if (d && o.type === "dlink" && d.links[o.id] && d.links[o.id].path) el("path", { d: path(d.links[o.id].path.map(local)), class: "code-hot" }, svg);
    else if (d && o.type === "dshape" && d.shapes[o.id] && d.shapes[o.id].poly) el("path", { d: path(d.shapes[o.id].poly.map(local)) + "Z", class: "code-hot area" }, svg);
  }
}
