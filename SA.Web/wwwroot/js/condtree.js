// ต้นไม้ Conditions ในแถบซ้าย (รอบ 5 M2) — โครง if / elif / switch ของส่วนที่วาด ใต้ subassembly (แทน flowchart ไปก่อน)
//   ◇ decision (ชื่อ / นิพจน์ / ชิปค่าสด) → กิ่ง (จำนวน object, ⚠ ยังไม่มี scenario) → object ในกิ่ง + decision ที่ซ้อน (elif)
//   object แสดง 2 ที่: ใต้กิ่ง และใน Points / Links / Shapes (ป้ายกิ่งสีกิ่ง) — คลิกที่ไหนก็เลือกตัวเดียวกัน
//   แก้ทุกอย่างผ่าน Logic API (logicops.js) + specEdit (Undo 1 ครั้งต่อการกระทำ) · ลาก object ไปวางที่กิ่ง / Points-Links-Shapes (= เกิดเสมอ) = Logic.setBranch
"use strict";

// ชิปค่าสด: if = ● จริง / ○ เท็จ / ? ไม่รู้ · switch = ค่า · กิ่ง = ✓ เกิด
function condChipHtml(v, kind){
  // undefined = ไม่ได้คำนวณ (กิ่งแม่ไม่เกิด) · null = คำนวณแล้วแต่ไม่รู้ค่า (หาจุดที่อ้างไม่ได้)
  if (v === undefined) return '<span class="lg-val" title="ไม่ได้คำนวณ — กิ่งแม่ไม่เกิดตอนนี้">–</span>';
  if (kind === "switch") return v === null || v === undefined ? '<span class="lg-val u">? ไม่รู้</span>' : `<span class="lg-val t">= ${esc(Expr.num(v))}</span>`;
  return v === null || v === undefined ? '<span class="lg-val u">? ไม่รู้</span>' : v ? '<span class="lg-val t">● จริง</span>' : '<span class="lg-val f">○ เท็จ</span>';
}
const caseText = (d, b) => d.kind === "switch" ? (b.case === "else" ? "อื่นๆ" : `= ${b.case}`) : (b.case === true || b.case === "true" ? "ใช่" : "ไม่ใช่");
const lgOpts = it => ({ codeParams: codeParamsOf(it) });

// เรียกจาก treeItem — node = ตัวสร้างแถวของ renderTree · leaf(kind, obj, depth) = แถว object แบบเดียวกับใน Points / Links / Shapes
function treeConditions(node, h, it, ik, depth, leaf){
  const sp = it.spec, lg = sp.logic || {}, decs = lg.decisions || [], brs = lg.branches || [], conds = lg.conditions || [];
  const dr = drawRes[it.id], L = dr && dr.logic, ed_ = state.editing === it.id;
  const key = ik + ":cond";
  const btns = ed_ ? `<span class="tbtns"><button data-act="add-if" data-it="${esc(it.id)}" title="เงื่อนไข (if) + กิ่ง ใช่ / ไม่ใช่">+ Condition</button>`
                   + `<button data-act="add-sw" data-it="${esc(it.id)}" title="switch ตามค่าตัวเลข (เช่น parameter ProtectionType) + กิ่งตาม case + อื่นๆ">+ Switch</button></span>` : "";
  // ปุ่มอยู่บรรทัดของตัวเองใต้หัว (แถบซ้ายแคบ 280 px ก็เห็นครบ)
  node({ key, depth, cls: "lg-root", s: { type: "lg", item: it.id, k: "root" }, ctx: { kind: "lg", id: it.id, k: "root" },
         name: `Conditions <small>(${decs.length})</small>`, after: btns ? `<div class="lg-acts" style="padding-left:${6 + depth * 14 + 18}px">${btns}</div>` : "" });
  if (!isOpen(key)) return;
  if (!decs.length){ h.push(`<div class="att" style="padding-left:${6 + (depth + 1) * 14 + 18}px">ยังไม่มี${ed_ ? " — กด + Condition / + Switch" : " (เข้า Edit เพื่อเพิ่ม)"}</div>`); return; }
  const cov = scenarios.length ? logicCoverage(it) : null;
  const walk = (parent, dep) => {
    for (const d of decs.filter(x => (x.parent || null) === parent)){
      const dk = ik + ":d:" + d.id, sw = d.kind === "switch";
      const c = !sw && conds.find(x => x.name === d.test);
      const name = `${sw ? '<small class="kw">switch</small> ' : ""}<b>${esc(d.test)}</b>${c ? `<small>${esc(c.expr)}</small>` : ""}${d.label && d.label !== d.test ? `<small class="lbl">${esc(d.label)}</small>` : ""}`;
      node({ key: dk, depth: dep, cls: "lg-dec", icon: '<span class="ic dec">◇</span>', s: { type: "lg", item: it.id, k: "dec", id: d.id },
             ctx: { kind: "lg", id: it.id, k: "dec", d: d.id }, name, title: (c && c.note) || `${d.id}${d.label ? " " + d.label : ""} · ดับเบิลคลิก = แก้นิพจน์`,
             metaHtml: `<span data-tdec="${esc(d.id)}" data-it="${esc(it.id)}" data-sw="${sw ? 1 : ""}">${condChipHtml(L ? L.decisions[d.id] : undefined, sw ? "switch" : "")}</span>`,
             attrs: ` data-dec-edit="${esc(d.id)}"` });
      if (!isOpen(dk)) continue;
      for (const b of brs.filter(x => x.decision === d.id)){
        const bk = ik + ":b:" + b.id, objs = Spec.branchObjects(sp, b.id), on = !!(L && L.branches[b.id]);
        const miss = cov && !(cov.by[b.id] || []).length;
        node({ key: bk, depth: dep + 1, cls: "lg-br" + (on ? " on" : ""), s: { type: "lg", item: it.id, k: "br", id: b.id },
               ctx: { kind: "lg", id: it.id, k: "br", b: b.id },
               icon: `<span class="ic"><i class="brdot" style="background:${branchColor(sp, b.id)}"></i></span>`,
               name: `<span class="case">${esc(caseText(d, b))}</span> ${esc(b.label || b.id)} <small>${esc(b.id)}</small>`,
               title: (objs.length ? "คลิก = เลือก " + objs.map(o => o.id).join(", ") : "ยังไม่มี object ในกิ่งนี้") + (ed_ ? " · ลาก object มาวางที่นี่ = ย้ายเข้ากิ่ง" : ""),
               metaHtml: `${miss ? '<span class="miss" title="ยังไม่มี scenario ไหนเข้ากิ่งนี้">⚠</span> ' : ""}<span class="cnt">${objs.length}</span>`
                         + `<span class="tick" data-tbr="${esc(b.id)}" data-it="${esc(it.id)}">${on ? "✓" : ""}</span>`,
               attrs: ed_ ? ` data-drop="${esc(b.id)}" data-it="${esc(it.id)}"` : "" });
        if (!isOpen(bk)) continue;
        for (const o of objs) leaf(o.kind, Spec.byId(o.kind === "dpt" ? sp.points : o.kind === "dlink" ? sp.links : sp.shapes, o.id), dep + 2);
        walk(b.id, dep + 2);
      }
    }
  };
  walk(null, depth + 1);
}

// ค่าสดในต้นไม้ (เรียกจาก render ทุกครั้ง — ไม่สร้างแถวใหม่)
function updateTreeLive(){
  const box = $("tree");
  for (const e of box.querySelectorAll("[data-tdec]")){
    const r = drawRes[e.dataset.it]; if (!r || !r.logic) continue;
    e.innerHTML = condChipHtml(r.logic.decisions[e.dataset.tdec], e.dataset.sw ? "switch" : "");
  }
  for (const e of box.querySelectorAll("[data-tbr]")){
    const r = drawRes[e.dataset.it]; if (!r || !r.logic) continue;
    const on = !!r.logic.branches[e.dataset.tbr];
    e.textContent = on ? "✓" : ""; const row = e.closest(".tn"); if (row) row.classList.toggle("on", on);
  }
}

// ---------------- หน้าต่าง + Condition / + Switch ----------------
// parent = กิ่งที่จะซ้อนลงไป (null = ระดับบนสุด) · กิ่ง "ไม่ใช่" = elif
function condDialog(it, parent, kind){
  const sp = it.spec, opts = lgOpts(it), sw = kind === "switch";
  const pb = parent && Spec.byId((sp.logic || {}).branches || [], parent), pd = pb && Spec.byId(sp.logic.decisions, pb.decision);
  const elif = pb && pd && pd.kind !== "switch" && (pb.case === false || pb.case === "false");
  const title = sw ? "+ Switch" : elif ? `+ elif (Condition ในกิ่ง ${pb.label})` : "+ Condition";
  const p0 = sp.points.find(p => p.def.type !== "origin");
  const longP = sp.params.find(p => p.kind === "long" && !(sp.side && sp.side.param === p.name));
  const o = sw ? { test: longP ? longP.name : "", cases: "1, 2", label: "" }
               : { name: Logic.freeCondName(sp, opts), expr: p0 ? `ground(${p0.id}) > ${p0.id}.y` : "true", label: "" };
  openDialog(title + (pb ? ` · ใต้กิ่ง ${branchPath(sp, parent)}` : ""), b => {
    const row = (label, small, key, check) => {
      const r = div("row", `<label>${esc(label)}${small ? `<small>${esc(small)}</small>` : ""}</label>`, b);
      const inp = document.createElement("input"); inp.type = "text"; inp.value = o[key]; inp.dataset.k = key; inp.className = "expr";
      const e = div("expr-err", "", b); r.appendChild(inp); r.after(e);
      const run = () => { o[key] = inp.value.trim(); const m = check ? check(o[key]) : ""; e.textContent = m || ""; inp.classList.toggle("bad", !!m); };
      inp.addEventListener("input", run); run();
      return inp;
    };
    const names = specNames(it), xo = Spec.exprOpts(sp);
    const exprErr = want => v => { const r = Expr.check(v || "", names, { ...xo, want }); return r.ok ? "" : r.error; };
    if (sw){
      row("นิพจน์ตัวเลข", "เช่น parameter ProtectionType", "test", exprErr("num")).focus();
      row("ค่า case", "คั่นด้วย , เช่น 1, 2, 3 (+ อื่นๆ ให้เอง)", "cases", v => v.split(",").map(x => x.trim()).filter(Boolean).every(x => isFinite(+x)) ? "" : "ต้องเป็นตัวเลขคั่นด้วย ,");
      row("ป้าย", "ไม่ใส่ = ใช้นิพจน์", "label");
    } else {
      row("ชื่อเงื่อนไข", "ใช้เป็นชื่อตัวแปรในโค้ด", "name", v => Logic.nameError(sp, v, opts) || "");
      row("นิพจน์ จริง / เท็จ", "เช่น ground(P2) > P2.y = ดินสูงกว่าจุด = ตัด", "expr", exprErr("bool")).focus();
      row("ป้าย", "ไม่ใส่ = ใช้ชื่อ", "label");
    }
    const err = div("expr-err", "", b);
    div("hint", sw ? "ได้กิ่งละ case + อื่นๆ (else) · เพิ่ม / แก้ / เรียง case ได้ที่คลิกขวาในต้นไม้"
                   : "ได้ decision if + กิ่ง ใช่ / ไม่ใช่ · ลาก object มาวางที่กิ่ง หรือคลิกขวาที่กิ่ง → วาดลงกิ่งนี้ · เงื่อนไขที่ยังไม่มี object ในกิ่ง = แค่คำนวณค่า ไม่สร้างอะไร", b);
    div("btns", null, b).append(btn("สร้าง", () => {
      const go = sp2 => sw
        ? Logic.addDecision(sp2, { kind: "switch", test: o.test, parentBranch: parent || null, label: o.label || undefined,
                                    cases: o.cases.split(",").map(x => x.trim()).filter(Boolean).map(v => ({ value: v })) }, opts)
        : Logic.addCondition(sp2, { name: o.name, expr: o.expr, parentBranch: parent || null, label: o.label || undefined }, opts);
      const test = go(JSON.parse(JSON.stringify(sp)));
      if (!test.ok){ err.textContent = test.error; return; }
      closeDialog();
      const r = specEdit(go, it, sw ? `เพิ่ม switch ${o.test}` : `เพิ่มเงื่อนไข ${o.name}`);
      if (r && r.ok){
        const id = r.decision; state.open[`i:${it.id}:cond`] = true; state.open[`i:${it.id}:d:${id}`] = true;
        if (parent) state.open[`i:${it.id}:b:${parent}`] = true;
        persist(); renderTree();
        flashBanner(sw ? `switch ${o.test}: ${r.branches.length} กิ่ง — ลาก object มาวางที่กิ่ง (Ctrl+Z ย้อนได้)` : `${o.name}: กิ่ง ${r.yes} ใช่ / ${r.no} ไม่ใช่ — ลาก object มาวางที่กิ่ง (Ctrl+Z ย้อนได้)`);
      }
    }), btn("ยกเลิก", cancelDialog));
  });
}

// ถามว่า object ในกิ่งที่จะหาย (ลบ case) ไปไว้ไหน
function askHow(it, title, objs, toText, go){
  if (!objs.length) return go("parent");
  openDialog(title, b => {
    kv(b, [["object ในกิ่ง", objs.join(", ")]]);
    div("btns", null, b).append(btn(`ย้าย object ไป${toText}`, () => { closeDialog(); go("parent"); }),
                                btn("ลบ object ในกิ่งด้วย", () => { closeDialog(); go("remove"); }), btn("ยกเลิก", cancelDialog));
    div("hint", "Ctrl+Z ย้อนได้ทั้งก้อน", b);
  });
}
// ย้าย decision ไปกิ่งอื่น: รายการกิ่ง (ไม่รวมกิ่งของตัวเอง / ที่ซ้อนข้างใน) + ระดับบนสุด
function moveDecisionDialog(it, did){
  const sp = it.spec, lg = sp.logic || {}, d = Spec.byId(lg.decisions, did), inside = new Set(Spec.decisionTree(sp, did).branches);
  openDialog(`ย้าย ${d.label || d.id} ไปซ้อนในกิ่ง…`, b => {
    const list = div("flist", null, b);
    const go = to => { closeDialog(); const r = specEdit(s => Logic.moveDecision(s, did, to), it, `ย้าย ${d.label || d.id}`); if (r && r.ok){ if (to) state.open[`i:${it.id}:b:${to}`] = true; persist(); renderTree(); if (r.warnings.length) flashBanner(`⚠ ${r.warnings.length} object อาจหาจุดไม่ได้บางกรณี (ดู Properties)`); } };
    const add = (label, to, cur) => { const x = btn("", () => go(to)); x.innerHTML = `${label}${cur ? "<small>อยู่ที่นี่</small>" : ""}`; x.disabled = cur; list.appendChild(x); };
    add("ระดับบนสุด (ไม่ซ้อน)", null, !d.parent);
    for (const br of lg.branches || []) if (!inside.has(br.id)) add(`<i class="brdot" style="background:${branchColor(sp, br.id)}"></i>${esc(branchPath(sp, br.id))} <small>${esc(br.id)}</small>`, br.id, d.parent === br.id);
    div("hint", "ซ้อนในกิ่ง ไม่ใช่ = elif · decision ที่ซ้อนอยู่ข้างในย้ายตามไปด้วย", b);
  });
}
// แก้นิพจน์ของ decision ในบรรทัด (ดับเบิลคลิก) — if ที่ test เป็นชื่อเงื่อนไข = แก้นิพจน์ของเงื่อนไขนั้น
function editDecisionInline(it, did, row){
  const sp = it.spec, lg = sp.logic || {}, d = Spec.byId(lg.decisions, did); if (!d) return;
  const c = d.kind !== "switch" && (lg.conditions || []).find(x => x.name === d.test);
  const nm = row.querySelector(".nm"); if (!nm) return;
  const inp = document.createElement("input"); inp.type = "text"; inp.className = "expr tn-edit"; inp.value = c ? c.expr : d.test;
  inp.title = c ? `นิพจน์ของเงื่อนไข ${c.name} (จริง / เท็จ) · Enter = ตกลง · Esc = ยกเลิก` : `นิพจน์ของ ${d.kind === "switch" ? "switch (ตัวเลข)" : "if (จริง / เท็จ)"} · Enter = ตกลง · Esc = ยกเลิก`;
  nm.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = ok => {
    if (done) return; done = true;
    if (ok && inp.value.trim() !== (c ? c.expr : d.test))
      specEdit(s => c ? Logic.editCondition(s, c.name, { expr: inp.value.trim() }, lgOpts(it)) : Logic.editDecision(s, did, { test: inp.value.trim() }, lgOpts(it)), it, `แก้นิพจน์ ${c ? c.name : d.label || did}`);
    renderTree();
  };
  inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter"){ e.preventDefault(); finish(true); } else if (e.key === "Escape"){ e.preventDefault(); finish(false); } });
  inp.addEventListener("blur", () => finish(true));
  inp.addEventListener("click", e => e.stopPropagation());
  inp.addEventListener("dblclick", e => e.stopPropagation());
}

// ---------------- คลิกขวาในต้นไม้ Conditions ----------------
function condCtxItems(itemId, x){
  const it = itemById(itemId), sp = it && it.spec; if (!sp) return [];
  const lg = sp.logic || {}, can = state.editing === itemId, note = can ? "" : "เข้า Edit ก่อน", opts = lgOpts(it);
  const E = (label, cmd, extra) => ({ label, cmd, disabled: !can, note, ...(extra || {}) });
  if (x.k === "root") return [{ h: `${itemLabel(it)} · Conditions` }, E("+ Condition", () => condDialog(it, null, "if")), E("+ Switch", () => condDialog(it, null, "switch"))];
  if (x.k === "dec"){
    const d = Spec.byId(lg.decisions, x.d); if (!d) return [];
    const rr = asmRes[it.id], Ls = rr && rr.ok && rr.drawnLines && rr.drawnLines[d.id];
    const sw = d.kind === "switch";
    return [
      { h: `◇ ${d.label || d.test} (${d.id})` },
      E("แก้นิพจน์ (ดับเบิลคลิก)", () => { const row = $("tree").querySelector(`[data-dec-edit="${d.id}"]`); if (row) editDecisionInline(it, d.id, row); }),
      E("เปลี่ยนป้าย…", () => { const v = (prompt(`ป้ายของ ${d.id}`, d.label || "") || "").trim(); if (v) specEdit(s => Logic.editDecision(s, d.id, { label: v }, opts), it, `ป้าย ${d.id}`); }),
      ...(sw ? [E("+ case…", () => { const v = (prompt("ค่า case ใหม่ (ตัวเลข)", "") || "").trim(); if (v){ const l = (prompt("ชื่อกิ่ง", `= ${v}`) || "").trim(); specEdit(s => Logic.addCase(s, d.id, { value: v, label: l || undefined }), it, `เพิ่ม case ${v}`); } })] : []),
      E("ย้ายไปซ้อนในกิ่ง…", () => moveDecisionDialog(it, d.id)),
      E(sw ? "เปลี่ยนเป็น if…" : "เปลี่ยนเป็น switch…", () => {
        const v = (prompt(sw ? "นิพจน์ จริง / เท็จ ของ if (case เดียว → ใช่ · อื่นๆ → ไม่ใช่)" : "นิพจน์ตัวเลขของ switch (ใช่ → case 1 · ไม่ใช่ → อื่นๆ)", "") || "").trim();
        if (v) specEdit(s => Logic.editDecision(s, d.id, { kind: sw ? "if" : "switch", test: v }, opts), it, `${d.id} เป็น ${sw ? "if" : "switch"}`);
      }),
      { sep: true },
      { label: "ไปที่โค้ด", cmd: () => gotoCode(it, Ls, rr.linesFor), disabled: !(Ls && Ls.length), note: Ls && Ls.length ? "" : "ยังไม่รู้บรรทัด" },
      E("ลบ…", () => removeDecisionsDialog(it, [d], `ลบ decision ${d.label || d.id}`))
    ];
  }
  if (x.k === "br"){
    const b = Spec.byId(lg.branches, x.b); if (!b) return [];
    const d = Spec.byId(lg.decisions, b.decision), sw = d && d.kind === "switch", no = d && !sw && (b.case === false || b.case === "false");
    const cases = sw ? lg.branches.filter(o => o.decision === d.id && o.case !== "else") : [], i = cases.indexOf(b);
    const objs = Spec.branchObjects(sp, b.id).map(o => o.id);
    return [
      { h: `${b.label || b.id} (${b.id})` },
      E("วาดลงกิ่งนี้ (B)", () => { draw.branch = b.id; showBanner(drawBanner()); renderEditBar(); flashBanner(`วาดลงกิ่ง: ${branchPath(sp, b.id)} — object ที่วาดต่อจากนี้เข้ากิ่งนี้`); }),
      E(no ? "+ elif (Condition ในกิ่งนี้)" : "+ Condition ในกิ่งนี้", () => condDialog(it, b.id, "if")),
      E("+ Switch ในกิ่งนี้", () => condDialog(it, b.id, "switch")),
      E("เปลี่ยนชื่อกิ่ง…", () => { const v = (prompt(`ชื่อกิ่ง ${b.id}`, b.label || "") || "").trim(); if (v && v !== b.label) specEdit(s => Logic.renameBranch(s, b.id, v), it, `เปลี่ยนชื่อกิ่ง ${b.id}`); }),
      ...(sw && b.case !== "else" ? [
        E("แก้ค่า case…", () => { const v = (prompt(`ค่า case ของ ${b.label}`, String(b.case)) || "").trim(); if (v) specEdit(s => Logic.editCase(s, b.id, { value: v }), it, `แก้ case ${b.id}`); }),
        E("↑ เลื่อนขึ้น", () => specEdit(s => Logic.moveCase(s, b.id, i - 1), it, `เลื่อน ${b.id}`), { disabled: !can || i <= 0 }),
        E("↓ เลื่อนลง", () => specEdit(s => Logic.moveCase(s, b.id, i + 1), it, `เลื่อน ${b.id}`), { disabled: !can || i >= cases.length - 1 }),
        E("ลบ case…", () => askHow(it, `ลบ case ${b.label}`, objs, d.parent ? `กิ่ง ${branchPath(sp, d.parent)}` : "เกิดเสมอ",
                                   how => specEdit(s => Logic.removeCase(s, b.id, { how }), it, `ลบ case ${b.id}`)))
      ] : []),
      { sep: true },
      { label: objs.length ? `เลือก object ในกิ่ง (${objs.length})` : "ยังไม่มี object", cmd: () => setSelList(objs.map(id => ({ type: id[0] === "P" ? "dpt" : id[0] === "L" ? "dlink" : "dshape", item: it.id, id }))), disabled: !objs.length }
    ];
  }
  return [];
}

// ---------------- คลิก / ดับเบิลคลิก / ลาก ในต้นไม้ ----------------
// ปุ่มในแถว (+ Condition / + Switch) และแถวของต้นไม้ Conditions — คืน true = จัดการแล้ว (renderTree ไม่ต้อง setSel)
function condTreeClick(e){
  const a = e.target.closest("[data-act]");
  if (a){
    e.stopPropagation();
    const it = itemById(a.dataset.it); if (!it || state.editing !== it.id) return true;
    if (a.dataset.act === "add-if") condDialog(it, null, "if");
    if (a.dataset.act === "add-sw") condDialog(it, null, "switch");
    return true;
  }
  const n = e.target.closest(".tn"); if (!n || !n.dataset.sel) return false;
  const s = JSON.parse(n.dataset.sel);
  if (s.type !== "lg") return false;
  if (state.editing && s.item !== state.editing) return true;
  if (s.k === "br"){
    const it = itemById(s.item), objs = it && it.spec ? Spec.branchObjects(it.spec, s.id) : [];
    if (objs.length) setSelList(objs.map(o => ({ type: o.kind, item: s.item, id: o.id })));
    else flashBanner("ยังไม่มี object ในกิ่งนี้ — ลาก object มาวาง หรือคลิกขวา → วาดลงกิ่งนี้");
  }
  return true;
}
function condTreeDblClick(e){
  const row = e.target.closest("[data-dec-edit]"); if (!row || e.target.closest("[data-tog]")) return false;
  const s = JSON.parse(row.dataset.sel), it = itemById(s.item);
  if (!it || state.editing !== it.id) return false;
  editDecisionInline(it, row.dataset.decEdit, row);
  return true;
}
// ลาก object (แถว drawn ของตัวที่แก้อยู่) → วางบนกิ่ง / หัว Points-Links-Shapes (= เกิดเสมอ) · ลากตัวที่อยู่ในชุดที่เลือก = ย้ายทั้งชุด
(() => {
  const tree = $("tree");
  let drag = null;
  tree.addEventListener("dragstart", e => {
    const n = e.target.closest("[data-drag]"); if (!n) return;
    const s = JSON.parse(n.dataset.sel), sel = selList().filter(o => o.item === s.item && ["dpt", "dlink", "dshape"].includes(o.type));
    const ids = sel.some(o => o.id === s.id) ? sel.map(o => o.id) : [s.id];
    drag = { item: s.item, ids };
    e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", ids.join(","));
  });
  tree.addEventListener("dragend", () => { drag = null; tree.querySelectorAll(".drop-over").forEach(x => x.classList.remove("drop-over")); });
  const target = e => { const t = e.target.closest("[data-drop]"); return t && drag && t.dataset.it === drag.item ? t : null; };
  tree.addEventListener("dragover", e => {
    const t = target(e); tree.querySelectorAll(".drop-over").forEach(x => { if (x !== t) x.classList.remove("drop-over"); });
    if (!t) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; t.classList.add("drop-over");
  });
  tree.addEventListener("drop", e => {
    const t = target(e); if (!t) return;
    e.preventDefault(); t.classList.remove("drop-over");
    const it = itemById(drag.item), to = t.dataset.drop || null, ids = drag.ids; drag = null;
    const r = specEdit(s => Logic.setBranch(s, ids, to), it, `${ids.join(", ")} → ${to ? "กิ่ง " + Spec.branchLabel(it.spec, to) : "เกิดเสมอ"}`);
    if (r && r.ok){
      if (to) state.open[`i:${it.id}:b:${to}`] = true; persist(); renderTree();
      flashBanner(`${r.moved.join(", ")} → ${to ? "กิ่ง " + branchPath(it.spec, to) : "เกิดเสมอ"}` + (r.warnings.length ? ` · ⚠ ${r.warnings.map(w => w.id).join(", ")} อ้างจุดที่เกิดเฉพาะบางกิ่ง (ดู Properties)` : ""));
    }
  });
})();
