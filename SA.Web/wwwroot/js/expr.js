// นิพจน์ในช่องตัวเลข / เงื่อนไข (ไวยากรณ์เดียวกับ SA.Web/Drawing/SpecExpr.cs — แก้ต้องแก้คู่กัน)
//
//   ตัวเลข, ชื่อ parameter, + - * / ( ) และฟังก์ชันคณิต
//     min(a, b, ...)  max(a, b, ...)  abs(x)  sqrt(x)  pow(x, y)  sin(องศา)  cos(องศา)  tan(องศา)  atan(x) -> องศา
//   เงื่อนไข (รอบ 4): > < >= <= == != (== / != มี tolerance EPS) · and or not (&& || !) · true false · if(เงื่อนไข, a, b)
//   ค่าจากเรขาคณิต: P3.x / P3.y (x ในกรอบ Side = Right) · ground(P3) / ground(P3, "Target") · exists(P3) · hasGround()
//   Max / Min (รอบ 4b): limited(P3) = จริงเมื่อรอบนี้ P3 ไม่ผ่านขอบเขต (ถูกขยับ / เตือน)
//
// ลำดับจากต่ำไปสูง: or < and < not < เปรียบเทียบ (ต่อกันไม่ได้) < + - < * / < เครื่องหมายหน้า < .x/.y
// ชนิดของค่า: "num" (ตัวเลข) / "bool" (จริง/เท็จ) — ตรวจตอน parse (typeOf) ไม่แปลงให้เอง
// การคำนวณที่ต้องรู้เรขาคณิต (จุด, ผิวดิน) เรียกผ่าน ctx ที่ผู้เรียกส่งมา (Spec.evaluate) — ไฟล์นี้ไม่รู้จัก spec
// ไฟล์นี้ไม่ใช้ DOM เพื่อให้ node โหลดไปทดสอบได้ (SA.Tests/js)
"use strict";
const Expr = (() => {
  // ฟังก์ชัน: จำนวนค่า (เทียบชื่อแบบไม่สนตัวพิมพ์เล็ก/ใหญ่)
  const FUNCS = {
    min:  { min: 1, max: 99 }, max: { min: 1, max: 99 }, abs: { min: 1, max: 1 }, sqrt: { min: 1, max: 1 },
    pow:  { min: 2, max: 2 },  sin: { min: 1, max: 1 },  cos: { min: 1, max: 1 }, tan: { min: 1, max: 1 }, atan: { min: 1, max: 1 },
    if: { min: 3, max: 3 }, ground: { min: 1, max: 2 }, exists: { min: 1, max: 1 }, hasground: { min: 0, max: 1 },
    limited: { min: 1, max: 1 }
  };
  // คำสงวน (ตั้งเป็นชื่อ parameter / เงื่อนไขไม่ได้ — ไม่สนตัวพิมพ์)
  const KEYWORDS = new Set(["and", "or", "not", "true", "false"]);
  const EPS = 1e-6;                    // tolerance ของ == / != (เท่ากับ SpecExpr.Eps ฝั่ง C#)
  const DEG = Math.PI / 180;
  const CMP = new Set(["<", ">", "<=", ">=", "==", "!="]);
  const TYPE_TH = { num: "ตัวเลข", bool: "จริง/เท็จ", str: "ข้อความ" };

  const fail = (at, msg) => { throw new Error(at != null ? `${msg} (ตำแหน่ง ${at + 1})` : msg); };

  function tokenize(src){
    const out = [];
    let i = 0;
    while (i < src.length){
      const c = src[i], rest = src.slice(i);
      if (/\s/.test(c)){ i++; continue; }
      const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest);
      if (num){ out.push({ t: "num", v: parseFloat(num[0]), at: i }); i += num[0].length; continue; }
      const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
      if (id){ out.push({ t: "id", v: id[0], at: i }); i += id[0].length; continue; }
      const str = /^"([^"]*)"|^'([^']*)'/.exec(rest);
      if (str){ out.push({ t: "str", v: str[1] ?? str[2], at: i }); i += str[0].length; continue; }
      if (c === '"' || c === "'") fail(i, "ข้อความไม่มีเครื่องหมายคำพูดปิด");
      const op = /^(<=|>=|==|!=|&&|\|\||[<>!+\-*\/(),.])/.exec(rest);
      if (op){ out.push({ t: op[0], at: i }); i += op[0].length; continue; }
      if (c === "=") fail(i, "เทียบเท่ากันใช้ == (สองตัว)");
      fail(i, `ใช้อักษร '${c}' ไม่ได้`);
    }
    return out;
  }

  // AST: num · bool · str · var (ชื่อ) · pt (P3.x) · ref (ชื่อจุดใน ground / exists) · neg · bin (+-*/) · cmp · and · or · not · call
  function parse(src){
    const s = String(src ?? "").trim();
    if (!s) throw new Error("ว่าง");
    const tk = tokenize(s);
    let p = 0;
    const peek = () => tk[p], take = () => tk[p++];
    const is = t => !!tk[p] && tk[p].t === t;
    const isKw = w => !!tk[p] && tk[p].t === "id" && tk[p].v.toLowerCase() === w;
    const expect = t => { const x = take(); if (!x || x.t !== t) fail(x ? x.at : null, x ? `คาดว่าจะเป็น '${t}'` : `ขาด '${t}'`); return x; };
    function orE(){
      let a = andE();
      while (isKw("or") || is("||")){ const at = take().at; a = { t: "or", a, b: andE(), at }; }
      return a;
    }
    function andE(){
      let a = notE();
      while (isKw("and") || is("&&")){ const at = take().at; a = { t: "and", a, b: notE(), at }; }
      return a;
    }
    function notE(){
      if (isKw("not") || is("!")){ const at = take().at; return { t: "not", a: notE(), at }; }
      return cmpE();
    }
    function cmpE(){
      const a = sum();
      if (peek() && CMP.has(peek().t)){
        const x = take(), b = sum();
        if (peek() && CMP.has(peek().t)) fail(peek().at, "เปรียบเทียบต่อกันแบบ a < b < c ไม่ได้ — ใช้ a < b and b < c");
        return { t: "cmp", op: x.t, a, b, at: x.at };
      }
      return a;
    }
    function sum(){
      let a = term();
      while (is("+") || is("-")){ const x = take(); a = { t: "bin", op: x.t, a, b: term(), at: x.at }; }
      return a;
    }
    function term(){
      let a = unary();
      while (is("*") || is("/")){ const x = take(); a = { t: "bin", op: x.t, a, b: unary(), at: x.at }; }
      return a;
    }
    function unary(){
      if (is("-")){ const at = take().at; return { t: "neg", a: unary(), at }; }
      if (is("+")){ take(); return unary(); }
      return postfix();
    }
    function postfix(){
      const a = atom();
      if (!is(".")) return a;
      const dot = take();
      if (a.t !== "var") fail(dot.at, "ใช้ .x / .y ได้กับชื่อจุดเท่านั้น เช่น P3.x");
      const ax = take();
      if (!ax || ax.t !== "id" || !/^[xy]$/i.test(ax.v)) fail(ax ? ax.at : null, "หลังจุด (.) ต้องเป็น x หรือ y เช่น P3.y");
      return { t: "pt", id: a.n, axis: ax.v.toLowerCase(), at: a.at };
    }
    function atom(){
      const x = take();
      if (!x) fail(null, "นิพจน์จบไม่ครบ");
      if (x.t === "num") return { t: "num", v: x.v, at: x.at };
      if (x.t === "str") return { t: "str", v: x.v, at: x.at };
      if (x.t === "("){ const e = orE(); expect(")"); return e; }
      if (x.t === "id"){
        const low = x.v.toLowerCase();
        if (low === "true" || low === "false") return { t: "bool", v: low === "true", at: x.at };
        if (KEYWORDS.has(low)) fail(x.at, `ไม่คาดว่าจะเจอ '${x.v}'`);
        if (is("(")){
          const def = FUNCS[low];
          if (!def) fail(x.at, `ไม่มีฟังก์ชัน ${x.v}()`);
          take();
          const args = [];
          if (!is(")")){ args.push(orE()); while (is(",")){ take(); args.push(orE()); } }
          expect(")");
          if (args.length < def.min || args.length > def.max)
            fail(x.at, `${x.v}() ต้องมี ${def.min === def.max ? def.min : def.min + "–" + def.max} ค่า`);
          // ground(P3) / exists(P3) / limited(P3): ค่าแรกเป็นชื่อจุด
          if (low === "ground" || low === "exists" || low === "limited"){
            if (args[0].t !== "var") fail(args[0].at, `${x.v}() ต้องใส่ชื่อจุด เช่น ${x.v}(P3)`);
            args[0] = { t: "ref", id: args[0].n, at: args[0].at };
          }
          return { t: "call", f: low, args, at: x.at };
        }
        return { t: "var", n: x.v, at: x.at };
      }
      fail(x.at, `ไม่คาดว่าจะเจอ '${x.t}'`);
    }
    const ast = orE();
    if (p < tk.length) fail(tk[p].at, "มีส่วนเกิน" + (tk[p].t === ")" ? " (วงเล็บปิดเกิน)" : ""));
    return ast;
  }

  // ชื่อ (parameter / เงื่อนไข) ที่ใช้
  function vars(ast, out = new Set()){
    walk(ast, n => { if (n.t === "var") out.add(n.n); });
    return out;
  }
  // จุดที่อ้าง (P3.x, ground(P3), exists(P3)) · strict = ไม่นับ exists(P3) (แค่ถามว่าเกิดไหม ไม่ต้องมีจริง)
  function pointRefs(ast, out = new Set(), strict){
    walk(ast, n => {
      if (n.t === "pt" || (n.t === "ref" && !strict)) out.add(n.id);
      if (strict && n.t === "call" && n.f === "ground") out.add(n.args[0].id);
    });
    return out;
  }
  function walk(n, fn){
    fn(n);
    if (n.a) walk(n.a, fn);
    if (n.b) walk(n.b, fn);
    if (n.args) n.args.forEach(x => walk(x, fn));
  }

  // ชนิดของนิพจน์: "num" | "bool" — sc = { params, points, conds, targets, limits } (Set หรือ null) · limits = จุดที่มี Max / Min
  //   points = null -> ช่องนี้อ้างจุดไม่ได้ · targets = null -> ไม่ตรวจชื่อ target
  function typeOf(n, sc){
    const need = (x, want, what) => {
      const t = typeOf(x, sc);
      if (t !== want) fail(x.at, `${what} ต้องเป็น${TYPE_TH[want]} แต่ได้${TYPE_TH[t]}`);
      return t;
    };
    const point = (id, at) => {
      if (!sc.points) fail(at, "ช่องนี้อ้างจุดไม่ได้");
      if (!sc.points.has(id)) fail(at, `ไม่มีจุด ${id}`);
    };
    switch (n.t){
      case "num": return "num";
      case "bool": return "bool";
      case "str": return "str";
      case "var":
        if (sc.conds && sc.conds.has(n.n)) return "bool";
        if (sc.params && sc.params.has(n.n)) return "num";
        if (sc.points && sc.points.has(n.n)) fail(n.at, `${n.n} เป็นจุด — ใช้ ${n.n}.x / ${n.n}.y / ground(${n.n}) / exists(${n.n})`);
        fail(n.at, `ไม่มี parameter ชื่อ ${n.n}`);
      case "pt": point(n.id, n.at); return "num";
      case "ref": point(n.id, n.at); return "ref";
      case "neg": need(n.a, "num", "เครื่องหมายลบ"); return "num";
      case "bin": need(n.a, "num", `ด้านซ้ายของ ${n.op}`); need(n.b, "num", `ด้านขวาของ ${n.op}`); return "num";
      case "cmp": {
        if (n.op === "==" || n.op === "!="){
          const a = typeOf(n.a, sc), b = typeOf(n.b, sc);
          if (a === "str" || b === "str") fail(n.at, "เทียบข้อความไม่ได้");
          if (a !== b) fail(n.at, `${n.op} ต้องเทียบชนิดเดียวกัน แต่ได้${TYPE_TH[a]}กับ${TYPE_TH[b]}`);
          return "bool";
        }
        need(n.a, "num", `ด้านซ้ายของ ${n.op}`); need(n.b, "num", `ด้านขวาของ ${n.op}`); return "bool";
      }
      case "and": case "or": {
        const w = n.t;
        need(n.a, "bool", `ด้านซ้ายของ ${w}`); need(n.b, "bool", `ด้านขวาของ ${w}`); return "bool";
      }
      case "not": need(n.a, "bool", "not"); return "bool";
      case "call": {
        const A = n.args;
        if (n.f === "if"){
          need(A[0], "bool", "ค่าแรกของ if()");
          const a = typeOf(A[1], sc), b = typeOf(A[2], sc);
          if (a !== b || a === "str") fail(n.at, `if() ค่าที่ 2 กับ 3 ต้องชนิดเดียวกัน แต่ได้${TYPE_TH[a]}กับ${TYPE_TH[b]}`);
          return a;
        }
        if (n.f === "ground" || n.f === "exists" || n.f === "limited"){
          typeOf(A[0], sc);
          if (n.f === "limited" && sc.limits && !sc.limits.has(A[0].id)) fail(A[0].at, `${A[0].id} ไม่มี Max / Min`);
          if (A[1]) target(A[1]);
          return n.f === "ground" ? "num" : "bool";
        }
        if (n.f === "hasground"){ if (A[0]) target(A[0]); return "bool"; }
        A.forEach((x, i) => need(x, "num", `ค่าที่ ${i + 1} ของ ${n.f}()`));
        return "num";
      }
    }
    fail(n.at, "นิพจน์ไม่ถูกต้อง");
    function target(x){
      if (x.t !== "str") fail(x.at, `ชื่อ target ต้องอยู่ในเครื่องหมายคำพูด เช่น "TargetSurface"`);
      if (sc.targets && !sc.targets.has(x.v)) fail(x.at, `ไม่มี target ชื่อ ${x.v}`);
    }
  }

  // คำนวณ — env = ค่า parameter · ctx (ไม่บังคับ) = { px(id), py(id), ground(id, target), exists(id), hasGround(target), cond(name), limited(id) }
  function evaluate(ast, env, ctx){
    const ev = n => evaluate(n, env, ctx);
    const need = f => { if (!ctx || !ctx[f]) throw new Error("ใช้ค่าจากจุด / ผิวดินในช่องนี้ไม่ได้"); return ctx[f]; };
    switch (ast.t){
      case "num": case "bool": case "str": return ast.v;
      case "var": {
        if (ast.n in env) return env[ast.n];
        if (ctx && ctx.cond && ctx.isCond && ctx.isCond(ast.n)) return ctx.cond(ast.n);
        throw new Error(`ไม่มี parameter ชื่อ ${ast.n}`);
      }
      case "pt": return ast.axis === "x" ? need("px")(ast.id) : need("py")(ast.id);
      case "neg": return -ev(ast.a);
      case "bin": {
        const a = ev(ast.a), b = ev(ast.b);
        if (ast.op === "+") return a + b;
        if (ast.op === "-") return a - b;
        if (ast.op === "*") return a * b;
        if (b === 0) throw new Error("หารด้วยศูนย์");
        return a / b;
      }
      case "cmp": {
        const a = ev(ast.a), b = ev(ast.b);
        switch (ast.op){
          case "<": return a < b;
          case ">": return a > b;
          case "<=": return a <= b;
          case ">=": return a >= b;
          case "==": return typeof a === "number" ? Math.abs(a - b) <= EPS : a === b;
          case "!=": return typeof a === "number" ? Math.abs(a - b) > EPS : a !== b;
        }
        break;
      }
      case "and": return ev(ast.a) ? !!ev(ast.b) : false;      // ลัดวงจร: ด้านซ้ายเท็จ = ไม่คำนวณด้านขวา
      case "or": return ev(ast.a) ? true : !!ev(ast.b);
      case "not": return !ev(ast.a);
      case "call": {
        const A = ast.args;
        switch (ast.f){
          case "if": return ev(A[0]) ? ev(A[1]) : ev(A[2]);
          case "ground": return need("ground")(A[0].id, A[1] ? A[1].v : null);
          case "exists": return need("exists")(A[0].id);
          case "limited": return need("limited")(A[0].id);
          case "hasground": return need("hasGround")(A[0] ? A[0].v : null);
        }
        const v = A.map(ev);
        switch (ast.f){
          case "min": return Math.min(...v);
          case "max": return Math.max(...v);
          case "abs": return Math.abs(v[0]);
          case "sqrt": if (v[0] < 0) throw new Error("sqrt ของค่าติดลบ"); return Math.sqrt(v[0]);
          case "pow": return Math.pow(v[0], v[1]);
          case "sin": return Math.sin(v[0] * DEG);
          case "cos": return Math.cos(v[0] * DEG);
          case "tan": return Math.tan(v[0] * DEG);
          case "atan": return Math.atan(v[0]) / DEG;
        }
      }
    }
    throw new Error("นิพจน์ไม่ถูกต้อง");
  }

  // ตรวจตอนพิมพ์: { ok, error, ast, type }
  //   names = ชื่อ parameter · opts = { want: "num" | "bool", points: [id], conds: [ชื่อ], targets: [ชื่อ], limits: [id ที่มี Max / Min] }
  //   ไม่ส่ง opts.points = ช่องนี้อ้างจุดไม่ได้ · ast คืนให้แม้ชื่อผิด (ใช้หา parameter ที่นิพจน์ใช้)
  function check(src, names, opts = {}){
    let ast;
    try{ ast = parse(src); }catch(e){ return { ok: false, error: e.message }; }
    try{
      const sc = { params: new Set(names || []), points: opts.points ? new Set(opts.points) : null,
                   conds: opts.conds ? new Set(opts.conds) : null, targets: opts.targets ? new Set(opts.targets) : null,
                   limits: opts.limits ? new Set(opts.limits) : null };
      const type = typeOf(ast, sc), want = opts.want || "num";
      if (type !== want) return { ok: false, error: `ช่องนี้ต้องเป็น${TYPE_TH[want]} แต่นิพจน์นี้ให้${TYPE_TH[type] || type}`, ast, type };
      return { ok: true, ast, type };
    }catch(e){ return { ok: false, error: e.message, ast }; }
  }

  const cache = new Map();
  const astOf = src => {
    const key = String(src ?? "");
    let ast = cache.get(key);
    if (!ast){ ast = parse(key); if (cache.size > 2000) cache.clear(); cache.set(key, ast); }
    return ast;
  };
  // คำนวณจากข้อความ (cache AST ไว้) ต้องได้ตัวเลข — โยน Error ถ้าผิด
  function value(src, env, ctx){
    const v = evaluate(astOf(src), env, ctx);
    if (typeof v !== "number") throw new Error(`"${src}" ไม่ใช่ตัวเลข (ได้${typeof v === "boolean" ? "จริง/เท็จ" : "ข้อความ"})`);
    if (!isFinite(v)) throw new Error(`ผลของ "${src}" ไม่ใช่ตัวเลข`);
    return v;
  }
  // คำนวณเงื่อนไข ต้องได้ จริง/เท็จ
  function test(src, env, ctx){
    const v = evaluate(astOf(src), env, ctx);
    if (typeof v !== "boolean") throw new Error(`"${src}" ไม่ใช่เงื่อนไข (ได้ตัวเลข)`);
    return v;
  }
  // จุดที่ข้อความนิพจน์อ้าง (parse ไม่ได้ = ไม่มี)
  function pointRefsOf(src, strict){
    if (src == null || src === "") return [];
    try{ return [...pointRefs(astOf(String(src)), new Set(), strict)]; }catch{ return []; }
  }

  // ตัวเลขเป็นข้อความสั้นๆ สำหรับเก็บใน spec (ปัดทศนิยม 4 ตำแหน่ง)
  const num = v => { const r = Math.round(v * 1e4) / 1e4; return String(Object.is(r, -0) ? 0 : r); };

  return { parse, vars, pointRefs, pointRefsOf, typeOf, eval: evaluate, check, value, test, num, FUNCS, KEYWORDS, EPS };
})();
if (typeof module !== "undefined") module.exports = Expr;
