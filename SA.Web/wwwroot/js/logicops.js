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
    "i FollowSurface Check Warn TargetSurface GetLong GetDouble Elevation Ground Exists PX PY Eq Try Cond Val V VN FirstOf Severe abstract as base bool break byte case catch char checked class const continue " +
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
    if (name !== except && used.has(name)) return `มีชื่อ ${name} อยู่แล้ว (parameter / เงื่อนไข / variable / จุด)`;
    return null;
  }
  // ตรวจนิพจน์: want = "bool" | "num" → โยน error ไทย
  function checkExpr(spec, src, want, opts, what){
    const s = String(src ?? "").trim();
    if (!s) fail(`${what || "นิพจน์"}: ว่าง`);
    const r = Expr.check(s, Spec.names(spec, (opts || {}).codeParams), { ...Spec.exprOpts(spec), want, allowI: what && /^A\d+ d[xy]$/.test(what) });
    if (!r.ok) fail(`${what || "นิพจน์"}: ${r.error}`);
    return s;
  }
  // เงื่อนไข / variable อ้างกันเป็นวง (ผ่านชื่อในนิพจน์ — variable: expr + rules)
  function condCycle(spec){
    const lg = spec.logic || {}, by = {};
    for (const c of lg.conditions || []) by[c.name] = [c.expr];
    for (const v of lg.variables || []) by[v.name] = [v.expr, ...(v.rules || []).flatMap(r => [r.when, r.value])];
    const state = {};
    const names = src => { const r = Expr.check(String(src || "0"), [], {}); return r.ast ? [...Expr.vars(r.ast)] : []; };
    const visit = (n, path) => {
      if (state[n] === 2) return null;
      if (state[n] === 1) return path.concat(n);
      state[n] = 1;
      const refs = by[n].flatMap(names).filter(v => by[v]);
      for (const m of refs){ const c = visit(m, path.concat(n)); if (c) return c; }
      state[n] = 2; return null;
    };
    for (const n of Object.keys(by)){ const cyc = visit(n, []); if (cyc) return cyc; }
    return null;
  }
  // variable อ้างจุดที่ (ทางตรง / อ้อม) ใช้ variable นั้นในนิพจน์ = วนผ่านจุด
  function varPointCycle(spec){
    const vars = (spec.logic || {}).variables || [];
    const usesName = (p, n) => (Spec.EXPR_FIELDS[p.def.type] || []).some(k => p.def[k] != null && new RegExp(`\\b${n}\\b`).test(String(p.def[k])));
    const exprsOf = v => [v.expr, ...(v.rules || []).flatMap(r => [r.when, r.value])];
    const refsOf = v => exprsOf(v).flatMap(e => { const r = Expr.check(String(e || "0"), [], {}); return r.ast ? [...Expr.vars(r.ast)] : []; });
    // variable ที่พึ่ง v (ทางตรง / อ้อม ผ่าน variable อื่น) รวม v เอง
    const dependents = v => {
      const out = new Set([v.name]);
      for (let more = true; more; ){ more = false; for (const w of vars) if (!out.has(w.name) && refsOf(w).some(n => out.has(n))){ out.add(w.name); more = true; } }
      return out;
    };
    for (const v of vars){
      const pts = exprsOf(v).flatMap(e => Expr.pointRefsOf(e)), dep = dependents(v);
      for (const P of pts) for (const q of spec.points)
        for (const n of dep) if (usesName(q, n) && Spec.dependsOn(spec, P, q.id)) return [v.name, P, ...(P === q.id ? [] : [q.id]), ...(n === v.name ? [] : [n]), v.name];
    }
    return null;
  }
  const noCycle = spec => { const c = condCycle(spec) || varPointCycle(spec); if (c) fail(`อ้างกันเป็นวง: ${c.join(" → ")}`); };
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

  // ---------- Variables (รอบ 5 M3) ----------
  // spec.logic.variables = [{ id: "V1", name, kind: "double", unit?, expr, rules: [{ when, value, warn?, error? }], note? }]
  //   kind "bool" = เงื่อนไขที่ตั้งชื่อ (เก็บใน logic.conditions เดิม — คำตอบ M0 ข้อ 3) · เผื่อ Loop: kind อื่น / scope เพิ่มได้ภายหลัง
  //   rules = if / elif ตามลำดับ ตัวแรกที่จริงชนะ · warn ใช้ {ชื่อ} แทนค่า · error = CorridorError ของข้อความเตือน (ค่าเริ่ม: มี < = ValueTooSmall, มี > = ValueTooLarge, อื่นๆ = Failure)
  const VAR_ERRORS = ["ValueTooSmall", "ValueTooLarge", "Failure", "ValueShouldNotBeLessThanOrEqualToZero", "ValueShouldNotBeLessThanZero", "ValueShouldNotBeZero", "ValueInABadPosition"];
  const guessError = when => /</.test(when || "") ? "ValueTooSmall" : />/.test(when || "") ? "ValueTooLarge" : "Failure";
  const VARS = s => { const lg = LG(s); lg.variables = lg.variables || []; return lg.variables; };
  const needVar = (s, name) => VARS(s).find(v => v.name === name) || fail(`ไม่มี variable ${name}`);
  // ตรวจ + จัดรูป variable (v = ของเดิมใน spec · ch = ค่าที่แก้) — ชื่อ placeholder ใน warn ต้องเป็น parameter / variable
  function fixVar(s, v, ch, opts){
    if ("unit" in ch){ if (ch.unit && ch.unit !== "number" && !Spec.UNITS[ch.unit]) fail(`ไม่มีชนิดค่า ${ch.unit}`); if (ch.unit && ch.unit !== "number") v.unit = ch.unit; else delete v.unit; }
    if ("kind" in ch && ch.kind && ch.kind !== "double") fail(`variable ชนิด ${ch.kind} ยังไม่รองรับ (bool = ใช้ addCondition)`);
    if ("note" in ch){ if (ch.note) v.note = String(ch.note); else delete v.note; }
    if ("expr" in ch) v.expr = checkExpr(s, ch.expr, "num", opts, `${v.name} ค่าปกติ`);
    if ("rules" in ch){
      const names = new Set(Spec.names(s, (opts || {}).codeParams));
      v.rules = (ch.rules || []).map((r, i) => {
        const when = checkExpr(s, r.when, "bool", opts, `${v.name} ถ้า ข้อ ${i + 1}`), value = checkExpr(s, r.value, "num", opts, `${v.name} ค่า ข้อ ${i + 1}`);
        const o = { when, value };
        if (r.warn){
          const w = String(r.warn).trim();
          for (const m of w.matchAll(/\{([^}]*)\}/g)) if (!names.has(m[1])) fail(`${v.name} ข้อความเตือน ข้อ ${i + 1}: {${m[1]}} ไม่ใช่ชื่อ parameter / variable`);
          if (/["\\]/.test(w)) fail(`${v.name} ข้อความเตือน ข้อ ${i + 1}: ใช้ " หรือ \\ ไม่ได้`);
          const e = r.error || guessError(when);
          if (!VAR_ERRORS.includes(e)) fail(`${v.name}: CorridorError ${e} ไม่มีในรายการ (${VAR_ERRORS.join(", ")})`);
          o.warn = w; o.error = e;
        }
        return o;
      });
    }
    noCycle(s);
    return v;
  }
  // o = { name, kind ("double"), unit?, expr, rules?, note?, index? }
  function addVariable(spec, o, opts){
    return tx(spec, s => {
      o = o || {};
      if (o.kind === "bool"){
        if (o.rules && o.rules.length) fail("variable ชนิด bool ยังไม่รองรับ rules — ใช้นิพจน์เดียว");
        const r = addCondition(s, { name: o.name, expr: o.expr, note: o.note, decision: false }, opts);
        if (!r.ok) fail(r.error);
        return { variable: r.cond, name: r.name, kind: "bool" };
      }
      const name = String(o.name ?? "").trim();
      const bad = nameError(s, name, opts); if (bad) fail(bad);
      const list = VARS(s), v = { id: nextId(list, "V"), name, kind: "double" };
      list.push(v);                                   // ใส่ก่อนตรวจ: นิพจน์ใน rules อ้างชื่อตัวเองไม่ได้ (วนกัน)
      fixVar(s, v, { expr: o.expr, rules: o.rules || [], ...(o.unit ? { unit: o.unit } : {}), ...(o.note ? { note: o.note } : {}), kind: o.kind }, opts);
      if (o.index != null){ list.splice(list.indexOf(v), 1); list.splice(Math.max(0, Math.min(list.length, Math.round(+o.index))), 0, v); }
      return { variable: v.id, name };
    });
  }
  function editVariable(spec, name, ch, opts){
    return tx(spec, s => { const v = needVar(s, name); fixVar(s, v, ch || {}, opts); return { variable: v.id }; });
  }
  function renameVariable(spec, oldName, name, opts){
    return tx(spec, s => {
      needVar(s, oldName); name = String(name ?? "").trim();
      if (name === oldName) return {};
      const bad = nameError(s, name, opts, oldName); if (bad) fail(bad);
      const re = new RegExp(`\\b${oldName}\\b`, "g");
      for (const sl of Spec.exprSlots(s)) if (typeof sl.obj[sl.key] === "string") sl.obj[sl.key] = sl.obj[sl.key].replace(re, name);
      needVar(s, oldName).name = name;
      return { name };
    });
  }
  // ใช้อยู่ = ไม่ยอม (บอกรายการ — คำตอบ M0 ข้อ 8)
  function variableUses(spec, name){
    const re = new RegExp(`\\b${name}\\b`), out = [];
    for (const sl of Spec.exprSlots(spec)) if (sl.id !== name && typeof sl.obj[sl.key] === "string" && re.test(sl.obj[sl.key]) && !out.includes(sl.id)) out.push(sl.id);
    return out;
  }
  function removeVariable(spec, name){
    return tx(spec, s => {
      needVar(s, name);
      const users = variableUses(s, name);
      if (users.length) fail(`ลบ ${name} ไม่ได้ — ยังใช้อยู่ใน ${users.join(", ")} (แก้ที่ใช้ก่อน)`);
      LG(s).variables = VARS(s).filter(v => v.name !== name);
      return {};
    });
  }
  function moveVariable(spec, name, index){
    return tx(spec, s => {
      const list = VARS(s), v = needVar(s, name), i = Math.round(+index);
      if (!isFinite(i)) fail("index ต้องเป็นตัวเลข");
      list.splice(list.indexOf(v), 1); list.splice(Math.max(0, Math.min(list.length, i)), 0, v);
      return { index: list.indexOf(v) };
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
  // จุด "ชุดสุดท้าย" (lastOf · รอบ 5b) ของจุด pointId ในชุดต้นฉบับของ Array — คืน { result: id ใหม่ }
  const addLastOf = wrap((s, arrayId, pointId, o) => Spec.addLastOf(s, arrayId, pointId, o));
  const needArr = (s, id) => byId(s.arrays, id) || fail(`ไม่มี Array ${id}`);
  // สร้างสมาชิกใหม่ (n / nMax / Loop เปิด-ปิด) — มีของนอก Array อ้างสมาชิกอยู่ = ไม่ยอม (บอกรายการ)
  const rebuild = (s, g, o) => { const r = Spec.rebuildArray(s, g, o); if (r.error) fail(r.error); if (r.block && r.block.length) fail(`เปลี่ยนจำนวนชุดของ ${g.id} ไม่ได้ — มีของนอก Array อ้างสมาชิกอยู่: ${r.block.join(", ")}`); return r; };
  // o = { dx?, dy?, n?, nMax?, nRound? } — Loop: n = นิพจน์ / nRound แก้ได้เลย · nMax = สร้างสมาชิกใหม่ · Array N คงที่: n = ตัวเลข (สร้างใหม่)
  function updateArray(spec, id, o, opts){
    return tx(spec, s => {
      const g = needArr(s, id); o = o || {};
      if ("dx" in o || "dy" in o){
        for (const k of ["dx", "dy"]) if (k in o) checkExpr(s, String(o[k]).trim() || "0", "num", opts, `${id} ${k}`);
        Spec.updateArray(s, g, o);
      }
      if (g.loop){
        if ("n" in o) g.loop.n = checkExpr(s, o.n, "num", opts, `${id} N`);
        if ("nRound" in o){ if (o.nRound && !Spec.LOOP_ROUND.includes(o.nRound)) fail("ปัดเศษ N ต้องเป็น floor / ceil / round"); if (o.nRound) g.loop.nRound = o.nRound; else delete g.loop.nRound; }
        if ("nMax" in o && Math.round(+o.nMax) !== g.loop.nMax) rebuild(s, g, { loop: { ...g.loop, nMax: o.nMax } });
      } else {
        if ("nMax" in o || "nRound" in o) fail(`${id} ไม่ใช่ Loop — เปิด Loop ก่อน (setArrayLoop)`);
        if ("n" in o && Math.round(+o.n) !== g.n) rebuild(s, g, { n: o.n });
      }
      return { array: id };
    });
  }
  const rebuildArray = wrap((s, id, o) => { const g = needArr(s, id); return Spec.rebuildArray(s, g, o); });
  // เปิด Loop (loop = { n, nMax?, nRound? }) / ปิด (null = Array N คงที่ เท่าจำนวนชุดที่สร้างไว้)
  function setArrayLoop(spec, id, loop, opts){
    return tx(spec, s => {
      const g = needArr(s, id);
      if (loop){ checkExpr(s, loop.n, "num", opts, `${id} N`); rebuild(s, g, { loop }); }
      else if (g.loop) rebuild(s, g, { loop: null, n: g.n });
      return { array: id, loop: g.loop || null };
    });
  }
  // เลิกเป็น Array: object ทุกชิ้นอยู่ต่อ (Loop: ชุดที่เคยไม่เกิดจะเกิดทั้งหมด — แจ้งใน warnings)
  function removeArray(spec, id){
    return tx(spec, s => {
      const g = needArr(s, id);
      s.arrays = s.arrays.filter(x => x !== g);
      return { warnings: g.loop ? [`${id} เคยเป็น Loop — ตอนนี้ทุกชุด (${g.n}) เกิดเสมอ`] : [] };
    });
  }
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
      variables: (lg.variables || []).map(v => ({ name: v.name, kind: v.kind || "double", unit: v.unit || "number", expr: v.expr, ...(v.rules && v.rules.length ? { rules: v.rules } : {}), ...(v.note ? { note: v.note } : {}), ...(L && L.vars ? { value: L.vars[v.name] ?? null } : {}) })),
      conditions: (lg.conditions || []).map(c => ({ name: c.name, expr: c.expr, ...(c.note ? { note: c.note } : {}), ...(L && L.conds ? { value: L.conds[c.name] ?? null } : {}) })),
      decisions: decs,
      arrays: (spec.arrays || []).map(g => ({ id: g.id, sets: g.n, dx: g.dx, dy: g.dy, source: [...g.source.points, ...g.source.links, ...g.source.shapes],
        ...(g.loop ? { loop: { n: g.loop.n, nMax: g.loop.nMax, nRound: g.loop.nRound || "floor" }, ...(L && L.loops ? { value: L.loops[g.id] } : {}) } : {}) })),
      always: { points: spec.points.filter(always).map(o => o.id), links: spec.links.filter(always).map(o => o.id), shapes: spec.shapes.filter(always).map(o => o.id) },
      risks: Spec.branchRisks(spec)
    };
  }

  // ---------- มุมมองข้อความ (รอบ 5 M4) ----------
  // toText: pseudo-code ภาษาไทยของ variables / เงื่อนไข / object เกิดเสมอ / decision → กิ่ง (ซ้อน = elif) · evalResult (ผลของ Spec.evaluate) = ต่อท้าย "← ตอนนี้: …"
  const COL = 44;
  const pad = (s, note) => note ? (s.length < COL ? s + " ".repeat(COL - s.length) : s + "  ") + note : s;
  // สมาชิกชุดที่ 2.. ของ Array = ย่อเป็น "สมาชิก A1 (ชุด 2–5)" (รอบ 5b)
  const memberIds = spec => { const m = new Map(); for (const g of spec.arrays || []) for (const mem of g.members) for (const id of [...mem.points, ...mem.links, ...mem.shapes]) m.set(id, g.id); return m; };
  const objList = (spec, b) => {
    const mem = memberIds(spec), arr = new Set();
    const pick = (list, aux) => list.filter(x => (x.branch || null) === b).filter(x => !(mem.has(x.id) && arr.add(mem.get(x.id)))).map(x => x.id + (aux && Spec.isAux(x) ? " (aux)" : ""));
    const o = [...pick(spec.points, true), ...pick(spec.links, true), ...pick(spec.shapes, false)];
    for (const id of arr){ const g = byId(spec.arrays, id); o.push(`สมาชิก ${id} (ชุด 2–${g.n})`); }
    return o.length ? o.join(", ") : "(ว่าง)";
  };
  const ROUND_TH = { floor: "ปัดลง", ceil: "ปัดขึ้น", round: "ปัดใกล้สุด" };
  // Array / Loop เป็นบรรทัดเดียว (toText / diffText)
  function arrText(g){
    const src = [...g.source.points, ...g.source.links, ...g.source.shapes].join(", ");
    const n = g.loop ? `N = ${g.loop.n} สูงสุด ${g.loop.nMax} ${ROUND_TH[g.loop.nRound || "floor"]}${g.loop.nRound ? "" : " (ค่าเริ่ม)"}` : `${g.n} ชุด (คงที่)`;
    const j = g.join ? ` · ต่อชุด ${g.join.mode === "share" ? "จุดร่วม" : "link"} ${g.join.from} → ${g.join.to}` : "";
    return `ทำซ้ำ ${g.id} (${src}): ${n} · dx = ${g.dx} · dy = ${g.dy}${j}`;
  }
  const fmtVal = (v, unit) => v === undefined ? "– (กิ่งแม่ไม่เกิด)" : v === null ? "ไม่รู้ค่า" : typeof v === "boolean" ? (v ? "จริง" : "เท็จ") : Spec.fmtUnit(unit || "number", Expr.num(v));
  function varText(v){
    const rs = v.rules || [];
    if (!rs.length) return `${v.name} = ${v.expr}`;
    return `${v.name} = ` + rs.map((r, i) => `${i ? "ไม่งั้นถ้า" : "ถ้า"} ${r.when} → ${r.value}${r.warn ? " (เตือน)" : ""}`).join(" · ") + ` · ไม่งั้น → ${v.expr}`;
  }
  function toText(spec, evalResult){
    const lg = spec.logic || {}, L = evalResult && evalResult.logic, out = [];
    const decs = lg.decisions || [], brs = lg.branches || [];
    const now = v => L ? `← ตอนนี้: ${v}` : "";
    out.push("Variables:" + ((lg.variables || []).length ? "" : " (ไม่มี)"));
    for (const v of lg.variables || []) out.push(pad("  " + varText(v), L && L.vars ? now(fmtVal(L.vars[v.name], v.unit)) : ""));
    out.push("Conditions:" + ((lg.conditions || []).length ? "" : " (ไม่มี)"));
    for (const c of lg.conditions || []) out.push(pad(`  ${c.name} = ${c.expr}`, L ? now(fmtVal(L.conds[c.name])) : ""));
    if ((spec.arrays || []).length){
      out.push("Arrays:");
      for (const g of spec.arrays) out.push(pad("  " + arrText(g), g.loop && L && L.loops && L.loops[g.id] != null ? now(`${L.loops[g.id]} ชุด`) : ""));
    }
    out.push(`เกิดเสมอ: ${objList(spec, null)}`);
    const walk = (parent, ind) => {
      const sp = " ".repeat(ind);
      for (const d of decs.filter(x => (x.parent || null) === parent)){
        const mine = brs.filter(b => b.decision === d.id), tag = `[${d.id}${d.label && d.label !== d.test ? " " + d.label : ""}]`;
        const on = b => L && L.branches[b.id] ? "← เกิดตอนนี้" : "";
        if (d.kind === "switch"){
          out.push(pad(`${sp}switch ${d.test}:`, tag + (L ? "   " + now(fmtVal(L.decisions[d.id])) : "")));
          for (const b of mine){
            out.push(pad(`${sp}    ${b.case === "else" ? "อื่นๆ" : "= " + b.case}  ${b.label || ""} (${b.id}): ${objList(spec, b.id)}`, on(b)));
            walk(b.id, ind + 8);
          }
          continue;
        }
        const yes = mine.find(b => b.case === true || b.case === "true"), no = mine.find(b => !(b.case === true || b.case === "true"));
        out.push(pad(`${sp}ถ้า ${d.test}:`, tag));
        if (yes){ out.push(pad(`${sp}    ${yes.label || "ใช่"} (${yes.id}): ${objList(spec, yes.id)}`, on(yes))); walk(yes.id, ind + 4); }
        if (no){ out.push(`${sp}ไม่ใช่:`); out.push(pad(`${sp}    ${no.label || "ไม่ใช่"} (${no.id}): ${objList(spec, no.id)}`, on(no))); walk(no.id, ind + 4); }
      }
    };
    walk(null, 0);
    return out.join("\n");
  }

  // diffText: สิ่งที่เปลี่ยนระหว่าง spec สองชุด เป็นบรรทัดภาษาไทย (+ เพิ่ม · - ลบ · ~ แก้) — ไว้ให้ผู้ใช้ดูก่อนยืนยันสิ่งที่ AI แก้ (prompt-6)
  function diffText(before, after){
    const A = before || {}, B = after || {}, la = A.logic || {}, lb = B.logic || {}, out = [];
    const by = (list, k) => { const m = new Map(); for (const x of list || []) m.set(x[k], x); return m; };
    const brName = (lg, id) => { const b = (lg.branches || []).find(x => x.id === id); return b ? `${b.label || b.id} (${b.id})` : "เกิดเสมอ"; };
    // parameter
    const pa = by(A.params, "name"), pb = by(B.params, "name");
    for (const [n, p] of pb) if (!pa.has(n)) out.push(`+ parameter ${n} = ${Spec.fmtParam(p, p.default)}`);
    for (const [n] of pa) if (!pb.has(n)) out.push(`- parameter ${n}`);
    for (const [n, p] of pb){ const q = pa.get(n); if (!q) continue;
      const ch = ["default", "min", "max", "positive", "unit", "kind"].filter(k => JSON.stringify(q[k] ?? null) !== JSON.stringify(p[k] ?? null)).map(k => `${k} ${JSON.stringify(q[k] ?? null)} → ${JSON.stringify(p[k] ?? null)}`);
      if (ch.length) out.push(`~ parameter ${n}: ${ch.join(" · ")}`); }
    // variable (จับคู่ด้วย id — เปลี่ยนชื่อ = ~)
    const va = by(la.variables, "id"), vb = by(lb.variables, "id");
    for (const [id, v] of vb) if (!va.has(id)) out.push(`+ variable ${varText(v)}`);
    for (const [id, v] of va) if (!vb.has(id)) out.push(`- variable ${v.name}`);
    for (const [id, v] of vb){ const o = va.get(id); if (!o) continue;
      if (o.name !== v.name) out.push(`~ variable ${o.name} เปลี่ยนชื่อเป็น ${v.name}`);
      if (varText({ ...o, name: v.name }) !== varText(v)) out.push(`~ variable ${v.name}: ${varText({ ...o, name: v.name }).slice(v.name.length + 3)} → ${varText(v).slice(v.name.length + 3)}`); }
    // เงื่อนไข
    const ca = by(la.conditions, "id"), cb = by(lb.conditions, "id");
    for (const [id, c] of cb) if (!ca.has(id)) out.push(`+ เงื่อนไข ${c.name} = ${c.expr}`);
    for (const [id, c] of ca) if (!cb.has(id)) out.push(`- เงื่อนไข ${c.name}`);
    for (const [id, c] of cb){ const o = ca.get(id); if (!o) continue;
      if (o.name !== c.name) out.push(`~ เงื่อนไข ${o.name} เปลี่ยนชื่อเป็น ${c.name}`);
      if (o.expr !== c.expr) out.push(`~ เงื่อนไข ${c.name}: ${o.expr} → ${c.expr}`); }
    // decision + กิ่ง
    const da = by(la.decisions, "id"), db = by(lb.decisions, "id"), ba = by(la.branches, "id"), bb = by(lb.branches, "id");
    const caseText = (d, b) => d && d.kind === "switch" ? (b.case === "else" ? "อื่นๆ" : `= ${b.case}`) : (b.case === true || b.case === "true" ? "ใช่" : "ไม่ใช่");
    for (const [id, d] of db) if (!da.has(id)){
      const kids = (lb.branches || []).filter(b => b.decision === id).map(b => `${b.label || b.id} (${b.id})`).join(" / ");
      out.push(`+ decision ${id} "${d.label || d.test}" (${d.kind === "switch" ? "switch" : "if"} ${d.test})${d.parent ? " ในกิ่ง " + brName(lb, d.parent) : ""} → กิ่ง ${kids}`);
    }
    for (const [id, d] of da) if (!db.has(id)) out.push(`- decision ${id} "${d.label || d.test}" (และกิ่งของมัน)`);
    for (const [id, d] of db){ const o = da.get(id); if (!o) continue;
      if ((o.kind || "if") !== (d.kind || "if")) out.push(`~ decision ${id}: ${o.kind || "if"} → ${d.kind || "if"}`);
      if (o.test !== d.test) out.push(`~ decision ${id}: ${o.test} → ${d.test}`);
      if ((o.label || "") !== (d.label || "")) out.push(`~ decision ${id} ป้าย: ${o.label || "-"} → ${d.label || "-"}`);
      if ((o.parent || null) !== (d.parent || null)) out.push(`~ decision ${id} ย้าย: ${o.parent ? "ในกิ่ง " + brName(la, o.parent) : "ระดับบนสุด"} → ${d.parent ? "ในกิ่ง " + brName(lb, d.parent) : "ระดับบนสุด"}`); }
    for (const [id, b] of bb) if (!ba.has(id) && da.has(b.decision)) out.push(`+ กิ่ง ${b.label || id} (${id}) ${caseText(db.get(b.decision), b)} ของ ${b.decision}`);
    for (const [id, b] of ba) if (!bb.has(id) && db.has(b.decision)) out.push(`- กิ่ง ${b.label || id} (${id}) ของ ${b.decision}`);
    for (const [id, b] of bb){ const o = ba.get(id); if (!o) continue;
      if ((o.label || "") !== (b.label || "")) out.push(`~ กิ่ง ${id} ชื่อ: ${o.label || "-"} → ${b.label || "-"}`);
      if (JSON.stringify(o.case) !== JSON.stringify(b.case)) out.push(`~ กิ่ง ${id} case: ${caseText(da.get(o.decision), o)} → ${caseText(db.get(b.decision), b)}`); }
    // Array / Loop (รอบ 5b): สร้าง / เลิก / แก้ N, สูงสุด, ปัดเศษ, dx, dy, วิธีต่อ, Loop เปิด-ปิด
    const ga = by(A.arrays, "id"), gb = by(B.arrays, "id");
    for (const [id, g] of gb) if (!ga.has(id)) out.push(`+ ${arrText(g)}`);
    for (const [id] of ga) if (!gb.has(id)) out.push(`- Array ${id} (object ยังอยู่)`);
    for (const [id, g] of gb){ const o = ga.get(id); if (!o) continue;
      if (!o.loop !== !g.loop) out.push(`~ ${id}: ${g.loop ? `เป็น Loop N = ${g.loop.n} สูงสุด ${g.loop.nMax}` : `เลิก Loop → ${g.n} ชุด (คงที่)`}`);
      else if (g.loop){
        for (const [k, name] of [["n", "N"], ["nMax", "สูงสุด"]]) if (o.loop[k] !== g.loop[k]) out.push(`~ ${id} ${name}: ${o.loop[k]} → ${g.loop[k]}`);
        if ((o.loop.nRound || "") !== (g.loop.nRound || "")) out.push(`~ ${id} ปัดเศษ: ${ROUND_TH[o.loop.nRound] || "ค่าเริ่ม (ปัดลง)"} → ${ROUND_TH[g.loop.nRound] || "ค่าเริ่ม (ปัดลง)"}`);
      }
      else if (o.n !== g.n) out.push(`~ ${id} จำนวนชุด: ${o.n} → ${g.n}`);
      for (const k of ["dx", "dy"]) if (o[k] !== g[k]) out.push(`~ ${id} ${k}: ${o[k]} → ${g[k]}`);
      if (JSON.stringify(o.join || null) !== JSON.stringify(g.join || null)) out.push(`~ ${id} ต่อชุด: ${o.join ? o.join.mode + " " + o.join.from + " → " + o.join.to : "ไม่ต่อ"} → ${g.join ? g.join.mode + " " + g.join.from + " → " + g.join.to : "ไม่ต่อ"}`);
    }
    // object: เพิ่ม / ลบ / ย้ายกิ่ง (รวมเป็นกลุ่มตามทางที่ย้าย) · สมาชิก Array ที่สร้างใหม่ = บรรทัดเดียว
    const all = s => [...(s.points || []), ...(s.links || []), ...(s.shapes || [])];
    const oa = by(all(A), "id"), ob = by(all(B), "id"), ma = memberIds(A), mb = memberIds(B), rebuilt = new Set();
    const isMem = k => (ma.has(k) || mb.has(k)) && rebuilt.add(mb.get(k) || ma.get(k));
    const added = [...ob.keys()].filter(k => !oa.has(k) && !isMem(k)), removed = [...oa.keys()].filter(k => !ob.has(k) && !isMem(k));
    for (const id of rebuilt) if (ga.has(id) && gb.has(id)) out.push(`~ ${id} สร้างสมาชิกใหม่ (ชุด 2–${gb.get(id).n})`);
    if (added.length) out.push(`+ object ${added.join(", ")}`);
    if (removed.length) out.push(`- object ${removed.join(", ")}`);
    const moves = new Map();
    for (const [id, o] of ob){ const p = oa.get(id); if (!p || (p.branch || null) === (o.branch || null)) continue;
      const k = `${brName(la, p.branch || null)} → ${brName(lb, o.branch || null)}`; moves.set(k, (moves.get(k) || []).concat(id)); }
    for (const [k, ids] of moves) out.push(`~ ${ids.join(", ")}: ${k}`);
    return out.length ? out.join("\n") : "(ไม่มีอะไรเปลี่ยน)";
  }

  return { RESERVED, nameError, freeCondName, toText, diffText,
           addCondition, editCondition, renameCondition, removeCondition,
           addDecision, editDecision, removeDecision, moveDecision,
           addCase, editCase, removeCase, moveCase, renameBranch, setBranch,
           addVariable, editVariable, renameVariable, removeVariable, moveVariable, variableUses, VAR_ERRORS, guessError,
           addCutFill, addIntersect, addOffset, addExtendToGround, addFollowClipped, addArray, updateArray, rebuildArray, setArrayLoop, removeArray, addLastOf, setParamBounds, setParamUnit,
           describe };
})();
if (typeof module !== "undefined") module.exports = { Logic };
