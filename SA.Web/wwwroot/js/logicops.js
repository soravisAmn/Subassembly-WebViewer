// Logic API (รอบ 5 M1) — ฟังก์ชันล้วนชุดเดียวสำหรับแก้ logic / object ของส่วนที่วาด (ไม่แตะ DOM / state · ใช้ได้ทั้งเว็บและ node)
//   UI ทุกที่ (ต้นไม้ Conditions, แท็บ Logic, "เกิดเมื่อ", Daylight Cut/Fill, ปุ่มรอบ 4c, B) เรียกชุดนี้ผ่าน specEdit — prompt-6 ห่อเป็นเครื่องมือ MCP
//   ผล: { ok: true, ...ผล, warnings? } หรือ { ok: false, error: "ข้อความไทย" } — error = spec ไม่เปลี่ยนเลย (ทำบนสำเนาก่อน ผ่านแล้วค่อยแทน)
//   opts (ตัวสุดท้าย ไม่ใส่ก็ได้) = { codeParams } — parameter ของโค้ดเดิม (ไฟล์ที่ import) ที่นิพจน์ใช้ได้
//   รูปแบบ spec.logic เดิมไม่เปลี่ยน (conditions / decisions / branches — ดู prompt-4-design.md) · รายละเอียด / ตัวอย่างใน README หัวข้อ "Logic API"
"use strict";
const Logic = (() => {
  // ชื่อที่โค้ด C# ที่สร้างใช้เอง (ตรงกับ CodeGenerator.Reserved) — ตั้งเป็นชื่อ parameter / เงื่อนไข / variable ไม่ได้
  const RESERVED = new Set(("cs F Deg Pt Measure Source surface Math Point Link Shape ObjectId " +
    "Seg Arc Delta Polar SlopeLength SlopeToSurface OnSurface Between Intersect Offset ExtendToGround Opt FollowClipped Tangent Rotate Arc3 ArcR Fillet Join AddPoint AddLink AddShape " +
    "FollowSurface Check Warn TargetSurface GetLong GetDouble Elevation Ground Exists PX PY Eq Try Cond Val V FirstOf Severe abstract as base bool break byte case catch char checked class const continue " +
    "decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal " +
    "is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc " +
    "static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while var").split(" "));

  // ---------- ตัวช่วย ----------
  class LogicError extends Error {}
  const fail = msg => { throw new LogicError(msg); };
  // ทำบนสำเนา: fn(สำเนา) คืนผล (object) → แทน key บนสุดของ spec เดิมด้วยของสำเนา (spec ตัวเดิม UI / History ยังถือได้)
  function tx(spec, fn){
    if (!spec || typeof spec !== "object") return { ok: false, error: "ไม่มี spec" };
    const work = JSON.parse(JSON.stringify(spec));
    let r;
    try{ r = fn(work); }
    catch(e){ return { ok: false, error: e instanceof LogicError ? e.message : (e && e.message) || String(e) }; }
    if (r && r.ok === false) return r;
    for (const k of Object.keys(spec)) if (!(k in work)) delete spec[k];
    for (const k of Object.keys(work)) spec[k] = work[k];
    return Object.assign({ ok: true }, r && typeof r === "object" && !Array.isArray(r) ? r : { result: r });
  }
  const LG = spec => { const lg = spec.logic = spec.logic || {}; for (const k of ["conditions", "decisions", "branches"]) lg[k] = lg[k] || []; return lg; };
  const byId = (list, id) => (list || []).find(o => o.id === id);
  const nextId = (list, pre) => { let k = 0; for (const x of list){ const m = new RegExp(`^${pre}(\\d+)$`).exec(x.id); if (m) k = Math.max(k, +m[1]); } return pre + (k + 1); };
  const cond = (spec, name) => ((spec.logic || {}).conditions || []).find(c => c.name === name);
  const needCond = (spec, name) => cond(spec, name) || fail(`ไม่มีเงื่อนไข ${name}`);
  const needDec = (spec, id) => byId((spec.logic || {}).decisions, id) || fail(`ไม่มี decision ${id}`);
  const needBr = (spec, id) => byId((spec.logic || {}).branches, id) || fail(`ไม่มีกิ่ง ${id}`);
  const brsOf = (spec, did) => LG(spec).branches.filter(b => b.decision === did);
  const isElse = b => b.case === "else";

  // ชื่อใช้ได้ไหม — ห้ามซ้ำ parameter / เงื่อนไข / จุด, ห้ามชื่อที่โค้ดใช้เอง / คำสงวน / ชื่อฟังก์ชัน (except = ชื่อเดิมของตัวที่เปลี่ยนชื่อ)
  function nameError(spec, name, opts, except){
    if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return `ชื่อ "${name}" ใช้ไม่ได้ — ต้องเป็นตัวอังกฤษ / ตัวเลข / _ และไม่ขึ้นต้นด้วยตัวเลข`;
    if (RESERVED.has(name) || /^([PpLlSsBbDdCcVvRrAa]\d+|surface\d+)$/.test(name)) return `ตั้งชื่อ ${name} ไม่ได้ — โค้ดที่สร้างใช้ชื่อนี้เอง (เช่น F, P1, cs, double)`;
    if (Expr.KEYWORDS.has(name.toLowerCase()) || Expr.FUNCS[name.toLowerCase()]) return `ตั้งชื่อ ${name} ไม่ได้ — เป็นคำ / ฟังก์ชันในนิพจน์`;
    const used = new Set(Spec.names(spec, (opts || {}).codeParams).concat(((spec.logic || {}).conditions || []).map(c => c.name), spec.points.map(p => p.id)));
    if (name !== except && used.has(name)) return `มีชื่อ ${name} อยู่แล้ว (parameter / เงื่อนไข / จุด)`;
    return null;
  }
  // ตรวจนิพจน์: want = "bool" | "num" → โยน error ไทย
  function checkExpr(spec, src, want, opts, what){
    const s = String(src ?? "").trim();
    if (!s) fail(`${what || "นิพจน์"}: ว่าง`);
    const r = Expr.check(s, Spec.names(spec, (opts || {}).codeParams), { ...Spec.exprOpts(spec), want });
    if (!r.ok) fail(`${what || "นิพจน์"}: ${r.error}`);
    return s;
  }
  // เงื่อนไขอ้างกันเป็นวง (ผ่านชื่อในนิพจน์)
  function condCycle(spec){
    const cs = (spec.logic || {}).conditions || [], by = {};
    for (const c of cs) by[c.name] = c;
    const state = {};
    const visit = (n, path) => {
      if (state[n] === 2) return null;
      if (state[n] === 1) return path.concat(n);
      state[n] = 1;
      const r = Expr.check(String(by[n].expr || "true"), [], {});
      const refs = r.ast ? [...Expr.vars(r.ast)].filter(v => by[v]) : [];
      for (const m of refs){ const c = visit(m, path.concat(n)); if (c) return c; }
      state[n] = 2; return null;
    };
    for (const c of cs){ const cyc = visit(c.name, []); if (cyc) return cyc; }
    return null;
  }
  const noCycle = spec => { const c = condCycle(spec); if (c) fail(`เงื่อนไขอ้างกันเป็นวง: ${c.join(" → ")}`); };
  // object ในกิ่งเหล่านี้ (Set ของ id กิ่ง)
  const objsIn = (spec, B) => [...spec.points, ...spec.links, ...spec.shapes].filter(o => B.has(o.branch));
  const HOW = { parent: 1, always: 1, remove: 1 };
  const needHow = how => { const h = how || "parent"; if (!HOW[h]) fail(`how ต้องเป็น parent / always / remove (ได้ ${how})`); return h; };
  // ชื่อเริ่มต้น Cond1, Cond2, ...
  function freeCondName(spec, opts, base = "Cond"){
    for (let i = 1; ; i++){ const n = base + i; if (!nameError(spec, n, opts)) return n; }
  }
  // ค่า case ของ switch → ตัวเลข
  function caseNum(v){
    const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
    if (String(v ?? "").trim() === "" || !isFinite(n)) fail(`ค่า case ต้องเป็นตัวเลข (ได้ "${v}")`);
    return n;
  }
  const sameCase = (a, b) => Math.abs(a - b) <= Expr.EPS;
  const risksOf = (spec, ids) => { const s = ids ? new Set(ids) : null; return Spec.branchRisks(spec).filter(r => !s || s.has(r.id)); };

  // ---------- เงื่อนไข ----------
  // o = { name?, expr, note?, parentBranch?, decision (ค่าเริ่ม true), label?, yes?, no? }
  //   decision = true: ได้ decision if + กิ่ง ใช่ / ไม่ใช่ ด้วย (parentBranch = กิ่ง "ไม่ใช่" ของ decision อื่น = elif)
  function addCondition(spec, o, opts){
    return tx(spec, s => {
      o = o || {};
      const name = o.name == null || o.name === "" ? freeCondName(s, opts) : String(o.name).trim();
      const bad = nameError(s, name, opts); if (bad) fail(bad);
      const expr = checkExpr(s, o.expr, "bool", opts, `เงื่อนไข ${name}`);
      if (o.parentBranch) needBr(s, o.parentBranch);
      if (o.decision === false){
        const lg = LG(s), id = nextId(lg.conditions, "C");
        lg.conditions.push(o.note ? { id, name, expr, note: o.note } : { id, name, expr });
        return { cond: id, name };
      }
      const r = Spec.addIf(s, { name, expr, note: o.note, parent: o.parentBranch || null, label: o.label, yes: o.yes, no: o.no });
      return { ...r, name };
    });
  }
  function editCondition(spec, name, ch, opts){
    return tx(spec, s => {
      const c = needCond(s, name);
      if (ch && "expr" in ch) c.expr = checkExpr(s, ch.expr, "bool", opts, `เงื่อนไข ${name}`);
      if (ch && "note" in ch){ if (ch.note) c.note = String(ch.note); else delete c.note; }
      noCycle(s);
      return { cond: c.id };
    });
  }
  function renameCondition(spec, oldName, name, opts){
    return tx(spec, s => {
      needCond(s, oldName);
      name = String(name ?? "").trim();
      if (name === oldName) return {};
      const bad = nameError(s, name, opts, oldName); if (bad) fail(bad);
      Spec.renameCond(s, oldName, name);
      return { name };
    });
  }
  // decision ที่ใช้เงื่อนไขนี้ (test = ชื่อ) ลบด้วยตาม how · นิพจน์อื่นยังใช้ = ไม่ยอม (บอกรายการ)
  function removeCondition(spec, name, o){
    return tx(spec, s => {
      needCond(s, name);
      const how = needHow(o && o.how);
      const users = Spec.condUses(s, name);
      if (users.length) fail(`ลบ ${name} ไม่ได้ — ยังใช้อยู่ใน ${users.join(", ")} (แก้ที่ใช้ก่อน)`);
      const touched = [];
      for (const d of [...LG(s).decisions]) if (d.test === name && byId(LG(s).decisions, d.id)) touched.push(...removeDecisionIn(s, d.id, how));
      const lg = LG(s); lg.conditions = lg.conditions.filter(c => c.name !== name);
      return { touched };
    });
  }

  // ---------- decision ----------
  // o = { parentBranch?, kind: "if" | "switch", test, label?, cases?: [{ value, label? }], elseLabel? }
  function addDecision(spec, o, opts){
    return tx(spec, s => {
      o = o || {};
      const kind = o.kind === "switch" ? "switch" : o.kind == null || o.kind === "if" ? "if" : fail(`kind ต้องเป็น if หรือ switch (ได้ ${o.kind})`);
      const test = checkExpr(s, o.test, kind === "switch" ? "num" : "bool", opts, kind === "switch" ? "นิพจน์ของ switch (ตัวเลข)" : "นิพจน์ของ if (จริง / เท็จ)");
      if (o.parentBranch) needBr(s, o.parentBranch);
      const lg = LG(s), id = nextId(lg.decisions, "D");
      lg.decisions.push({ id, parent: o.parentBranch || null, kind, test, label: o.label || test });
      const branches = [];
      const add = (c, label) => { const b = nextId(lg.branches, "B"); lg.branches.push({ id: b, decision: id, case: c, label }); branches.push(b); };
      if (kind === "if"){ add(true, o.yes || "ใช่"); add(false, o.no || "ไม่ใช่"); }
      else {
        const seen = [];
        for (const c of o.cases || []){
          const v = caseNum(c.value);
          if (seen.some(x => sameCase(x, v))) fail(`ค่า case ${v} ซ้ำ`);
          seen.push(v); add(v, c.label || `= ${v}`);
        }
        add("else", o.elseLabel || "อื่นๆ");
      }
      return { decision: id, branches };
    });
  }
  // ch = { test?, label?, kind? } — เปลี่ยน kind: if → switch = ใช่ → case 1, ไม่ใช่ → else · switch → if ได้เมื่อมี case เดียว (+ else)
  function editDecision(spec, id, ch, opts){
    return tx(spec, s => {
      const d = needDec(s, id); ch = ch || {};
      const kind = ch.kind == null ? d.kind || "if" : ch.kind === "switch" || ch.kind === "if" ? ch.kind : fail(`kind ต้องเป็น if หรือ switch (ได้ ${ch.kind})`);
      if (kind !== (d.kind || "if")){
        const bs = brsOf(s, id);
        if (kind === "switch"){ for (const b of bs){ if (b.case === true || b.case === "true") b.case = 1; else b.case = "else"; } }
        else {
          const cs = bs.filter(b => !isElse(b));
          if (cs.length > 1) fail(`switch ${d.label || id} มี ${cs.length} case — แปลงเป็น if ได้เมื่อเหลือ case เดียว`);
          for (const b of bs) b.case = !isElse(b);
          if (!bs.some(b => b.case === true)){ const n = nextId(LG(s).branches, "B"); LG(s).branches.push({ id: n, decision: id, case: true, label: "ใช่" }); }
          if (!bs.some(b => b.case === false)){ const n = nextId(LG(s).branches, "B"); LG(s).branches.push({ id: n, decision: id, case: false, label: "ไม่ใช่" }); }
        }
        d.kind = kind;
      }
      const test = "test" in ch ? ch.test : d.test;
      d.test = checkExpr(s, test, kind === "switch" ? "num" : "bool", opts, kind === "switch" ? "นิพจน์ของ switch (ตัวเลข)" : "นิพจน์ของ if (จริง / เท็จ)");
      if ("label" in ch) d.label = String(ch.label || "").trim() || d.test;
      return { decision: id };
    });
  }
  // ลบ decision + ที่ซ้อนอยู่ข้างใน (ใช้ภายใน — s = สำเนาใน tx แล้ว) — how: parent (กิ่งแม่) · always (เกิดเสมอ) · remove (ลบ object ด้วย)
  function removeDecisionIn(s, id, how){
    const t = Spec.decisionTree(s, id), moved = [];
    if (how === "always") for (const o of objsIn(s, new Set(t.branches))){ delete o.branch; moved.push(o.id); }
    return moved.concat(Spec.removeDecision(s, id, how === "remove" ? "remove" : "move"));
  }
  function removeDecision(spec, id, o){
    return tx(spec, s => { needDec(s, id); return { touched: removeDecisionIn(s, id, needHow(o && o.how)) }; });
  }
  // ย้าย decision ทั้งก้อนไปซ้อนในกิ่งอื่น (null = ระดับบนสุด) — ห้ามย้ายเข้ากิ่งของตัวเอง / ที่ซ้อนอยู่ข้างใน
  function moveDecision(spec, id, parentBranch){
    return tx(spec, s => {
      const d = needDec(s, id);
      if (parentBranch){
        needBr(s, parentBranch);
        if (Spec.decisionTree(s, id).branches.includes(parentBranch)) fail(`ย้าย ${d.label || id} เข้าไปในกิ่งของตัวเองไม่ได้`);
      }
      d.parent = parentBranch || null;
      return { warnings: risksOf(s) };
    });
  }

  // ---------- case ของ switch ----------
  const needSwitch = (s, did) => { const d = needDec(s, did); if (d.kind !== "switch") fail(`${d.label || did} ไม่ใช่ switch`); return d; };
  function addCase(spec, did, o){
    return tx(spec, s => {
      needSwitch(s, did); o = o || {};
      const v = caseNum(o.value), bs = brsOf(s, did);
      if (bs.some(b => !isElse(b) && sameCase(+b.case, v))) fail(`ค่า case ${v} ซ้ำ`);
      const lg = LG(s), id = nextId(lg.branches, "B"), nb = { id, decision: did, case: v, label: o.label || `= ${v}` };
      const el = bs.find(isElse);
      if (el) lg.branches.splice(lg.branches.indexOf(el), 0, nb); else lg.branches.push(nb);
      return { branch: id };
    });
  }
  function editCase(spec, bid, o){
    return tx(spec, s => {
      const b = needBr(s, bid); needSwitch(s, b.decision); o = o || {};
      if ("value" in o){
        if (isElse(b)) fail("กิ่ง อื่นๆ (else) ไม่มีค่า case");
        const v = caseNum(o.value);
        if (brsOf(s, b.decision).some(x => x !== b && !isElse(x) && sameCase(+x.case, v))) fail(`ค่า case ${v} ซ้ำ`);
        b.case = v;
      }
      if ("label" in o){ const l = String(o.label ?? "").trim(); if (!l) fail("ชื่อกิ่งว่างไม่ได้"); b.label = l; }
      return { branch: bid };
    });
  }
  // ลบ case: object ในกิ่ง (+ decision ที่ซ้อนในกิ่งนี้) ตาม how · else ลบไม่ได้
  function removeCase(spec, bid, o){
    return tx(spec, s => {
      const b = needBr(s, bid), d = needSwitch(s, b.decision), how = needHow(o && o.how);
      if (isElse(b)) fail("ลบกิ่ง อื่นๆ (else) ไม่ได้ — switch ต้องมี else เสมอ");
      const lg = LG(s), touched = [];
      for (const x of [...lg.decisions]) if (x.parent === bid && byId(lg.decisions, x.id)) touched.push(...removeDecisionIn(s, x.id, how));
      for (const ob of objsIn(s, new Set([bid]))){
        if (how === "remove"){
          const kind = s.points.includes(ob) ? "point" : s.links.includes(ob) ? "link" : "shape";
          if ((s[kind + "s"] || []).includes(ob)) touched.push(...Spec.removeCascade(s, kind, ob.id));
        } else { if (how === "parent" && d.parent) ob.branch = d.parent; else delete ob.branch; touched.push(ob.id); }
      }
      lg.branches = lg.branches.filter(x => x.id !== bid);
      return { touched };
    });
  }
  // เรียง case: index = ลำดับใหม่ในบรรดา case ที่มีค่า (else อยู่ท้ายเสมอ)
  function moveCase(spec, bid, index){
    return tx(spec, s => {
      const b = needBr(s, bid); needSwitch(s, b.decision);
      if (isElse(b)) fail("กิ่ง อื่นๆ (else) อยู่ท้ายเสมอ ย้ายไม่ได้");
      const lg = LG(s), cs = brsOf(s, b.decision).filter(x => !isElse(x)), el = brsOf(s, b.decision).filter(isElse);
      const i = Math.max(0, Math.min(cs.length - 1, Math.round(+index)));
      if (!isFinite(i)) fail("index ต้องเป็นตัวเลข");
      const order = cs.filter(x => x !== b); order.splice(i, 0, b);
      const rest = lg.branches.filter(x => x.decision !== b.decision), at = lg.branches.findIndex(x => x.decision === b.decision);
      rest.splice(at, 0, ...order, ...el);
      lg.branches = rest;
      return { branch: bid, index: i };
    });
  }
  function renameBranch(spec, bid, label){
    return tx(spec, s => {
      const b = needBr(s, bid), l = String(label ?? "").trim();
      if (!l) fail("ชื่อกิ่งว่างไม่ได้");
      b.label = l;
      return { branch: bid };
    });
  }

  // ---------- object เข้ากิ่ง ----------
  // ids = id ของ point / link / shape · กลุ่มหมุน (R#) / Array (A#) = สมาชิกทั้งกลุ่ม · branchId null = เกิดเสมอ
  function setBranch(spec, ids, branchId){
    return tx(spec, s => {
      if (branchId) needBr(s, branchId);
      const list = Array.isArray(ids) ? ids : [ids], moved = [];
      const put = o => { if (branchId) o.branch = branchId; else delete o.branch; if (!moved.includes(o.id)) moved.push(o.id); };
      for (const id of list){
        const o = byId(s.points, id) || byId(s.links, id) || byId(s.shapes, id);
        if (o){ put(o); continue; }
        const g = byId(s.rotations, id);
        if (g){ for (const p of g.points) { const q = byId(s.points, p); if (q) put(q); } continue; }
        const a = byId(s.arrays, id);
        if (a){
          for (const set of [a.source, ...a.members]) for (const [k, list2] of [["points", s.points], ["links", s.links], ["shapes", s.shapes]])
            for (const x of set[k] || []){ const q = byId(list2, x); if (q) put(q); }
          continue;
        }
        fail(`ไม่มี object ${id}`);
      }
      return { moved, warnings: risksOf(s, moved) };
    });
  }

  // ---------- ห่อฟังก์ชันสร้าง / แก้ของรอบ 4c ให้คืน { ok, error } รูปแบบเดียวกัน ----------
  const wrap = fn => (spec, ...args) => tx(spec, s => {
    const r = fn(s, ...args);
    if (r && typeof r === "object" && !Array.isArray(r) && r.error) fail(r.error);
    return r && typeof r === "object" && !Array.isArray(r) ? r : { result: r };
  });
  const addCutFill = wrap((s, o) => Spec.addCutFill(s, o));
  const addIntersect = wrap((s, l1, l2, o) => Spec.addIntersect(s, l1, l2, o));
  const addOffset = wrap((s, id, dist, side, o) => Spec.addOffset(s, id, dist, side, o));
  const addExtendToGround = wrap((s, id, end, o) => Spec.addExtendToGround(s, id, end, o));
  const addFollowClipped = wrap((s, from, to, o) => Spec.addFollowClipped(s, from, to, o));
  const addArray = wrap((s, sel, o) => Spec.addArray(s, sel, o));
  const updateArray = wrap((s, id, o) => { const g = byId(s.arrays, id) || fail(`ไม่มี Array ${id}`); return Spec.updateArray(s, g, o); });
  const rebuildArray = wrap((s, id, o) => { const g = byId(s.arrays, id) || fail(`ไม่มี Array ${id}`); return Spec.rebuildArray(s, g, o); });
  const setParamBounds = wrap((s, name, b) => { Spec.setParamBounds(s, name, b); return { param: name }; });
  const setParamUnit = wrap((s, name, unit) => { Spec.setParamUnit(s, name, unit); return { param: name }; });

  // ---------- describe: สรุปโครงให้ MCP / AI อ่าน ----------
  // evalResult = ผลของ Spec.evaluate (ไม่ส่ง = โครงอย่างเดียว)
  function describe(spec, evalResult){
    const lg = spec.logic || {}, L = evalResult && evalResult.logic;
    const objs = b => [...spec.points, ...spec.links, ...spec.shapes].filter(o => o.branch === b).map(o => o.id);
    const decs = (lg.decisions || []).map(d => ({
      id: d.id, kind: d.kind || "if", test: d.test, label: d.label, parent: d.parent || null,
      ...(L ? { value: L.decisions[d.id] ?? null } : {}),
      branches: (lg.branches || []).filter(b => b.decision === d.id).map(b => ({ id: b.id, case: b.case, label: b.label, objects: objs(b.id), ...(L ? { active: !!L.branches[b.id] } : {}) }))
    }));
    const always = o => !o.branch;
    return {
      className: spec.className,
      params: spec.params.map(p => ({ name: p.name, kind: p.kind, default: p.default, unit: Spec.unitOf(p), ...(p.min != null ? { min: p.min } : {}), ...(p.max != null ? { max: p.max } : {}), ...(p.positive ? { positive: true } : {}) })),
      conditions: (lg.conditions || []).map(c => ({ name: c.name, expr: c.expr, ...(c.note ? { note: c.note } : {}), ...(L && L.conds ? { value: L.conds[c.name] ?? null } : {}) })),
      decisions: decs,
      always: { points: spec.points.filter(always).map(o => o.id), links: spec.links.filter(always).map(o => o.id), shapes: spec.shapes.filter(always).map(o => o.id) },
      risks: Spec.branchRisks(spec)
    };
  }

  return { RESERVED, nameError, freeCondName,
           addCondition, editCondition, renameCondition, removeCondition,
           addDecision, editDecision, removeDecision, moveDecision,
           addCase, editCase, removeCase, moveCase, renameBranch, setBranch,
           addCutFill, addIntersect, addOffset, addExtendToGround, addFollowClipped, addArray, updateArray, rebuildArray, setParamBounds, setParamUnit,
           describe };
})();
if (typeof module !== "undefined") module.exports = { Logic };
