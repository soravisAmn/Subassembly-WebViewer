// End-to-end check against a running viewer with a page open and these copies imported:
// SA.Tests/fixtures/round6/{pavement-assembly,base_rock-pitching-web,body_rock-pitching-web}.cs
// Not part of test-all.bat. Run: node SA.Tests/e2e/mcp-e2e.js http://localhost:5051/mcp
// Leaves nothing behind: every proposal it makes is cancelled.
"use strict";
const URL_ = process.argv[2] || "http://localhost:5050/mcp";
const FILES = ["pavement-assembly.cs", "base_rock-pitching-web.cs", "body_rock-pitching-web.cs"];
let passed = 0, failed = 0;
const check = (name, cond, info) => { if (cond){ passed++; console.log("  PASS  " + name); } else { failed++; console.log("  FAIL  " + name + (info ? "\n        " + String(info).slice(0, 500) : "")); } };

async function call(name, args){
  const r = await fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args || {} } }) });
  const t = await r.text(), d = t.split("\n").find(l => l.startsWith("data: "));
  const res = JSON.parse(d ? d.slice(6) : t).result;
  return { error: !!res.isError, text: (res.content.find(c => c.type === "text") || {}).text || "", image: res.content.find(c => c.type === "image") };
}
const gapLinks = text => [...new Set([...text.matchAll(/\d \S*?(L\d+)(?:\+L\d+)* \[/g)].map(m => m[1]))];

(async () => {
  const st = await call("sa_status");
  if (st.error){ console.log(st.text); process.exitCode = 1; return; }
  for (const f of FILES){
    const d = await call("sa_describe", { item: f }), r = await call("sa_render", { item: f }), c = await call("sa_check", { item: f, code: "Datum" });
    check(`${f}: describe`, !d.error && d.text.includes("className"), d.text);
    check(`${f}: render returns an image`, !r.error && r.image && r.image.mimeType === "image/png", r.text);
    check(`${f}: compiles`, c.text.includes("Compile: OK"), c.text);
  }
  const before = {};
  for (const f of FILES) before[f] = (await call("sa_get_spec", { item: f, view: "real" })).text;

  const fail = await call("sa_apply", { item: FILES[0], summary: "t", ops: [{ fn: "setCodes", args: [["L57"], ["Datum"]] }, { fn: "addLink", args: ["P1", "P999"] }] });
  check("failure midway reports the op", fail.error && /op 1 \(addLink\)/.test(fail.text), fail.text);
  check("failure midway leaves no proposal", (await call("sa_status")).text.includes("Pending proposals: 0"));
  const acc = await call("sa_proposal", { item: FILES[0], action: "accept" });
  check("the AI cannot accept", acc.error, acc.text);

  const first = await call("sa_check", { item: FILES[2], code: "Datum" });
  check("body: known gap on L10 before editing", /11\.995\.\.12\.500 L10/.test(first.text), first.text);
  check("base: no gap before editing", (await call("sa_check", { item: FILES[1], code: "Datum" })).text.includes("covers the whole"));

  // Add Datum to whatever is missing, through proposals, until no gaps remain
  for (const f of FILES){
    let done = false;
    for (let round = 0; round < 6 && !done; round++){
      const c = await call("sa_check", { item: f, code: "Datum" });
      if (c.text.includes("covers the whole")){ done = true; break; }
      const spec = JSON.parse((await call("sa_get_spec", { item: f })).text);
      const ops = gapLinks(c.text).map(id => ({ fn: "editLink", args: [id, { codes: [...spec.links.find(l => l.id === id).codes, "Datum"] }] }));
      const r = await call("sa_apply", { item: f, summary: "Datum", ops });
      if (r.error){ console.log(r.text); break; }
    }
    check(`${f}: Datum complete in every scenario on the proposal`, done, (await call("sa_check", { item: f, code: "Datum" })).text);
    await call("sa_proposal", { item: f, action: "cancel" });
    check(`${f}: cancelled = real spec unchanged`, (await call("sa_get_spec", { item: f, view: "real" })).text === before[f]);
  }
  check("no proposals left", (await call("sa_status")).text.includes("Pending proposals: 0"));
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})();
