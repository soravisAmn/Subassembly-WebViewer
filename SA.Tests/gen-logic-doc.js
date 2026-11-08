// Generates the function table of docs/logic-api.md from Logic.META (the same source as Logic.catalog()).
// Run: node SA.Tests/gen-logic-doc.js · logicbatch.test.js fails if the doc is out of date.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, ".."), docFile = path.join(root, "docs", "logic-api.md");
const BEGIN = "<!-- BEGIN generated from Logic.META by SA.Tests/gen-logic-doc.js. Do not edit by hand. -->";
const END = "<!-- END generated -->";

function loadLogic(){
  const js = f => fs.readFileSync(path.join(root, "SA.Web/wwwroot/js", f), "utf8");
  const ctx = vm.createContext({ console });
  vm.runInContext(js("expr.js") + "\n" + js("spec.js") + "\n" + js("logicops.js") + "\n" + js("ops.js") + "\nthis.Expr = Expr; this.Spec = Spec; this.Logic = Logic; this.Ops = Ops;", ctx);
  return ctx;
}
const cell = s => s.replace(/\|/g, "\\|");
function table(meta){
  const out = [BEGIN, ""];
  for (const group of [...new Set(meta.map(m => m.group))]){
    out.push(`### ${group}`, "", "| Function | Does | Possible errors |", "|---|---|---|");
    for (const m of meta.filter(x => x.group === group)) out.push(`| \`${cell(m.fn + "(" + m.sig + ")")}\` | ${cell(m.desc)} | ${cell(m.err)} |`);
    out.push("");
  }
  out.push(END);
  return out.join("\r\n");
}
function expected(text, meta){
  const a = text.indexOf(BEGIN), b = text.indexOf(END);
  if (a < 0 || b < 0) throw new Error("docs/logic-api.md has no generated block");
  return text.slice(0, a) + table(meta) + text.slice(b + END.length);
}
module.exports = { loadLogic, table, expected, docFile };
if (require.main === module){
  const { Logic } = loadLogic();
  fs.writeFileSync(docFile, expected(fs.readFileSync(docFile, "utf8"), Logic.META));
  console.log("docs/logic-api.md updated");
}
