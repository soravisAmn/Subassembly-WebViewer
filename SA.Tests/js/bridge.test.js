// Round 6 M4: the stdio bridge for Claude Desktop, against a fake local /mcp.
// Run: node SA.Tests/js/bridge.test.js
"use strict";
const http = require("http"), path = require("path"), { spawn } = require("child_process");
const script = path.join(__dirname, "../../SA.Mcp/bridge.js");
let passed = 0, failed = 0;
async function test(name, body){
  try{ await body(); passed++; console.log("  PASS  " + name); }
  catch(e){ failed++; console.log("  FAIL  " + name + "\n        " + e.message); }
}
const ok = (c, what) => { if (!c) throw new Error(what); };

// Sends lines, closes stdin, resolves with the parsed stdout lines
function runBridge(url, lines){
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [script], { env: { ...process.env, SA_MCP_URL: url } });
    let out = "";
    p.stdout.on("data", d => out += d);
    p.on("error", reject);
    p.on("close", () => { try{ resolve(out.split("\n").filter(Boolean).map(l => JSON.parse(l))); }catch(e){ reject(new Error("stdout is not JSON lines: " + out)); } });
    p.stdin.end(lines.map(l => JSON.stringify(l)).join("\n") + "\n");
  });
}
(async () => {
  console.log("Claude Desktop bridge (round 6 M4)");
  const seen = [];
  const srv = http.createServer((req, res) => {
    let b = ""; req.on("data", d => b += d);
    req.on("end", () => {
      const m = JSON.parse(b); seen.push({ m, accept: req.headers.accept });
      if (m.id === undefined){ res.statusCode = 202; return res.end(); }
      if (m.method === "sse"){ res.setHeader("Content-Type", "text/event-stream"); return res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: m.id, result: { via: "sse" } })}\n\n`); }
      if (m.method === "forbidden"){ res.statusCode = 403; return res.end("no"); }
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ jsonrpc: "2.0", id: m.id, result: { via: "json" } }));
    });
  });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}/mcp`;
  await test("JSON and SSE answers become one line each; the Accept header is sent; notifications get no answer", async () => {
    const r = await runBridge(url, [{ jsonrpc: "2.0", id: 1, method: "a" }, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 2, method: "sse" }]);
    const by = Object.fromEntries(r.map(x => [x.id, x.result.via]));
    ok(r.length === 2 && by[1] === "json" && by[2] === "sse", JSON.stringify(r));
    ok(seen.every(s => /application\/json/.test(s.accept) && /text\/event-stream/.test(s.accept)), "accept");
    ok(seen.some(s => s.m.method === "notifications/initialized"), "notification forwarded");
  });
  await test("an HTTP error becomes a JSON-RPC error", async () => {
    const r = await runBridge(url, [{ jsonrpc: "2.0", id: 5, method: "forbidden" }]);
    ok(r.length === 1 && r[0].id === 5 && /403/.test(r[0].error.message), JSON.stringify(r));
  });
  await new Promise(r => srv.close(r));
  await test("viewer off: a tool call gets a readable tool error, other requests a JSON-RPC error", async () => {
    const r = await runBridge(url, [{ jsonrpc: "2.0", id: 7, method: "tools/call", params: {} }, { jsonrpc: "2.0", id: 8, method: "initialize" }]);
    const t = r.find(x => x.id === 7), i = r.find(x => x.id === 8);
    ok(t.result.isError && /run-viewer\.bat/.test(t.result.content[0].text), JSON.stringify(t));
    ok(/run-viewer\.bat/.test(i.error.message), JSON.stringify(i));
  });
  console.log(`\n${passed} ผ่าน, ${failed} ไม่ผ่าน`);
  process.exitCode = failed ? 1 : 0;
})();
