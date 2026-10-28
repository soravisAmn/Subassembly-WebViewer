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
    points: c.spec.points.map(p => r.pts[p.id] && !r.pts[p.id].err ? { id: p.id, x: r.pts[p.id].x, y: r.pts[p.id].y } : { id: p.id, err: (r.pts[p.id] || {}).err || "?" }),
    links: c.spec.links.map(l => r.links[l.id] && !r.links[l.id].err ? { id: l.id, path: r.links[l.id].path.map(p => [p.x, p.y]) } : { id: l.id, err: true }),
    shapes: c.spec.shapes.map(s => r.shapes[s.id] && !r.shapes[s.id].err ? { id: s.id, poly: r.shapes[s.id].poly ? r.shapes[s.id].poly.map(p => [p.x, p.y]) : null } : { id: s.id, err: true }),
    issues: r.issues.length
  };
});
process.stdout.write(JSON.stringify(out));
