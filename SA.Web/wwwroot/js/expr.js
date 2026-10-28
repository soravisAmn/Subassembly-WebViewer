// นิพจน์ในช่องตัวเลข: ตัวเลข, ชื่อ parameter, + - * / ( ) และฟังก์ชัน
//   min(a, b, ...)  max(a, b, ...)  abs(x)  sqrt(x)  pow(x, y)
//   sin(องศา)  cos(องศา)  tan(องศา)  atan(x) -> องศา
// แปลงเป็นต้นไม้ (AST) ครั้งเดียว แล้วใช้ทั้งคำนวณใน JS (Expr.eval) และแปลงเป็น C# (Milestone 3)
// ไฟล์นี้ไม่ใช้ DOM เพื่อให้ node โหลดไปทดสอบได้ (SA.Tests/js)
"use strict";
const Expr = (() => {
  const FUNCS = {
    min:  { min: 1, max: 99 }, max: { min: 1, max: 99 }, abs: { min: 1, max: 1 }, sqrt: { min: 1, max: 1 },
    pow:  { min: 2, max: 2 },  sin: { min: 1, max: 1 },  cos: { min: 1, max: 1 }, tan: { min: 1, max: 1 }, atan: { min: 1, max: 1 }
  };
  const DEG = Math.PI / 180;

  function tokenize(src){
    const out = [];
    let i = 0;
    while (i < src.length){
      const c = src[i];
      if (/\s/.test(c)){ i++; continue; }
      const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (num){ out.push({ t: "num", v: parseFloat(num[0]), at: i }); i += num[0].length; continue; }
      const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      if (id){ out.push({ t: "id", v: id[0], at: i }); i += id[0].length; continue; }
      if ("+-*/(),".includes(c)){ out.push({ t: c, at: i }); i++; continue; }
      throw new Error(`ใช้อักษร '${c}' ไม่ได้ (ตำแหน่ง ${i + 1})`);
    }
    return out;
  }

  // expr := term (('+'|'-') term)* ; term := unary (('*'|'/') unary)* ; unary := ('-'|'+') unary | atom
  function parse(src){
    const s = String(src ?? "").trim();
    if (!s) throw new Error("ว่าง");
    const tk = tokenize(s);
    let p = 0;
    const peek = () => tk[p], take = () => tk[p++];
    const expect = t => { const x = take(); if (!x || x.t !== t) throw new Error(x ? `คาดว่าจะเป็น '${t}' ที่ตำแหน่ง ${x.at + 1}` : `ขาด '${t}'`); return x; };
    function expr(){
      let a = term();
      while (peek() && (peek().t === "+" || peek().t === "-")){ const op = take().t; a = { t: "bin", op, a, b: term() }; }
      return a;
    }
    function term(){
      let a = unary();
      while (peek() && (peek().t === "*" || peek().t === "/")){ const op = take().t; a = { t: "bin", op, a, b: unary() }; }
      return a;
    }
    function unary(){
      if (peek() && peek().t === "-"){ take(); return { t: "neg", a: unary() }; }
      if (peek() && peek().t === "+"){ take(); return unary(); }
      return atom();
    }
    function atom(){
      const x = take();
      if (!x) throw new Error("นิพจน์จบไม่ครบ");
      if (x.t === "num") return { t: "num", v: x.v };
      if (x.t === "(" ){ const e = expr(); expect(")"); return e; }
      if (x.t === "id"){
        if (peek() && peek().t === "("){
          const f = x.v.toLowerCase(), def = FUNCS[f];
          if (!def) throw new Error(`ไม่มีฟังก์ชัน ${x.v}()`);
          take();
          const args = [];
          if (peek() && peek().t !== ")"){ args.push(expr()); while (peek() && peek().t === ","){ take(); args.push(expr()); } }
          expect(")");
          if (args.length < def.min || args.length > def.max)
            throw new Error(`${f}() ต้องมี ${def.min === def.max ? def.min : def.min + " ขึ้นไป"} ค่า`);
          return { t: "call", f, args };
        }
        return { t: "var", n: x.v };
      }
      throw new Error(`ไม่คาดว่าจะเจอ '${x.t}' ที่ตำแหน่ง ${x.at + 1}`);
    }
    const ast = expr();
    if (p < tk.length) throw new Error(`มีส่วนเกินที่ตำแหน่ง ${tk[p].at + 1}` + (tk[p].t === ")" ? " (วงเล็บปิดเกิน)" : ""));
    return ast;
  }

  function vars(ast, out = new Set()){
    if (ast.t === "var") out.add(ast.n);
    else if (ast.t === "bin"){ vars(ast.a, out); vars(ast.b, out); }
    else if (ast.t === "neg") vars(ast.a, out);
    else if (ast.t === "call") ast.args.forEach(a => vars(a, out));
    return out;
  }

  function evaluate(ast, env){
    switch (ast.t){
      case "num": return ast.v;
      case "var": {
        if (!(ast.n in env)) throw new Error(`ไม่มี parameter ชื่อ ${ast.n}`);
        return env[ast.n];
      }
      case "neg": return -evaluate(ast.a, env);
      case "bin": {
        const a = evaluate(ast.a, env), b = evaluate(ast.b, env);
        if (ast.op === "+") return a + b;
        if (ast.op === "-") return a - b;
        if (ast.op === "*") return a * b;
        if (b === 0) throw new Error("หารด้วยศูนย์");
        return a / b;
      }
      case "call": {
        const v = ast.args.map(x => evaluate(x, env));
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

  // ตรวจตอนพิมพ์: { ok, error, ast } — names = ชื่อ parameter ที่ใช้ได้
  function check(src, names){
    try{
      const ast = parse(src);
      const known = new Set(names || []);
      for (const n of vars(ast)) if (!known.has(n)) return { ok: false, error: `ไม่มี parameter ชื่อ ${n}`, ast };
      return { ok: true, ast };
    }catch(e){ return { ok: false, error: e.message }; }
  }

  const cache = new Map();
  // คำนวณจากข้อความ (cache AST ไว้) — โยน Error ถ้าผิด
  function value(src, env){
    const key = String(src ?? "");
    let ast = cache.get(key);
    if (!ast){ ast = parse(key); if (cache.size > 2000) cache.clear(); cache.set(key, ast); }
    const v = evaluate(ast, env);
    if (!isFinite(v)) throw new Error(`ผลของ "${key}" ไม่ใช่ตัวเลข`);
    return v;
  }

  // ตัวเลขเป็นข้อความสั้นๆ สำหรับเก็บใน spec (ปัดทศนิยม 4 ตำแหน่ง)
  const num = v => { const r = Math.round(v * 1e4) / 1e4; return String(Object.is(r, -0) ? 0 : r); };

  return { parse, vars, eval: evaluate, check, value, num, FUNCS };
})();
if (typeof module !== "undefined") module.exports = Expr;
