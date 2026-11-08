// คำนวณ DrawingSpec ด้วยตัวคำนวณของเว็บ (spec.js) แล้วพิมพ์ผลเป็น JSON — SA.Tests/DrawingTests.cs เรียกใช้เพื่อเทียบกับโค้ด C# ที่สร้าง
// ใช้: node SA.Tests/js/eval-cli.js <cases.json>
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const js = f => fs.readFileSync(path.join(__dirname, "../../SA.Web/wwwroot/js", f), "utf8");
const ctx = vm.createContext({});
vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\nthis.Spec = Spec;", ctx);

const cases = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
cases.forEach(c => { if (c.copySpecFrom != null) c.spec = cases[c.copySpecFrom].spec; });
const out = cases.map(c => {
  const r = ctx.Spec.evaluate(c.spec, {
    values: c.values || {}, codeParams: [], codePoints: [],
    surface: c.surfaceAssigned === false ? null : c.surface, extendEnds: c.extendEnds !== false, layout: !!c.layout
  });
  return {
    name: c.name,
    points: c.spec.points.map(p => r.pts[p.id] && !r.pts[p.id].err ? { id: p.id, x: r.pts[p.id].x, y: r.pts[p.id].y, auxiliary: ctx.Spec.isAux(p) } : { id: p.id, err: (r.pts[p.id] || {}).err || "?" }),
    // เส้นโค้ง = link ตรงทีละท่อนในโค้ด C# -> แตกเป็นท่อนให้เทียบทีละ link
    links: c.spec.links.flatMap(l => {
      const q = r.links[l.id];
      if (ctx.Spec.isAux(l)) return [];                      // link auxiliary ไม่ Links.Add
      if (!q || q.err) return [{ id: l.id, err: true }];
      const path = q.path.map(p => [p.x, p.y]);
      // ท่อนแรกพกจุดระหว่างทางของทั้งโค้ง (mids) ไว้ให้นับจุดที่ C# Points.Add ตามลำดับ
      //   Clipped Surface Link = หลาย link แบบเดียวกัน (code แยกตามท่อน) · codes = ไว้เทียบกับ code ของ link ใน C#
      const multi = ctx.Spec.isArc(l) || l.type === "followClipped";
      const codesOf = k => q.segCodes ? q.segCodes[k] : (l.codes || []);
      return multi ? path.slice(1).map((p, k) => ({ id: `${l.id} ท่อน ${k + 1}`, path: [path[k], p], codes: codesOf(k), ...(k ? {} : { mids: path.slice(1, -1) }) }))
                   : [{ id: l.id, path, codes: l.codes || [] }];
    }),
    shapes: c.spec.shapes.map(s => r.shapes[s.id] && !r.shapes[s.id].err ? { id: s.id, poly: r.shapes[s.id].poly ? r.shapes[s.id].poly.map(p => [p.x, p.y]) : null } : { id: s.id, err: true }),
    issues: r.issues.length,
    // ข้อความเตือนของ parameter (ขอบเขต / ต้องมากกว่า 0) — DrawingTests เทียบข้อความตรงตัวกับ C# (ชนิดค่า 1:x / m / % รอบ 4e)
    paramMsgs: r.issues.filter(i => c.spec.params.some(p => p.name === i.obj)).map(i => i.msg),
    // ข้อความเตือนของ rules ใน Variables (รอบ 5) — ต้องมีใน C# ตรงตัว
    varMsgs: r.issues.filter(i => ((c.spec.logic || {}).variables || []).some(v => v.name === i.obj)).map(i => i.msg)
  };
});
process.stdout.write(JSON.stringify(out));
