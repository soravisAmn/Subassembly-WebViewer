// Stdio bridge for Claude Desktop: Desktop starts this script and it forwards each JSON-RPC line to the viewer's /mcp.
// stdout carries only MCP messages; diagnostics go to stderr. Needs Node 18 or later, no packages.
// The URL can be changed with the environment variable SA_MCP_URL.
"use strict";
const readline = require("readline");
const URL_ = process.env.SA_MCP_URL || "http://localhost:5050/mcp";
const DOWN = "The viewer is not running. Start run-viewer.bat, open http://localhost:5050, then try again.";

const out = o => process.stdout.write(JSON.stringify(o) + "\n");

// With the viewer off, a tool call gets a readable tool error; anything else gets a JSON-RPC error
function viewerDown(msg){
  if (msg.id === undefined) return;
  if (msg.method === "tools/call") out({ jsonrpc: "2.0", id: msg.id, result: { isError: true, content: [{ type: "text", text: DOWN }] } });
  else out({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: DOWN } });
}

async function forward(line){
  let msg;
  try{ msg = JSON.parse(line); }catch{ process.stderr.write("Ignored a line that is not JSON\n"); return; }
  let res;
  try{
    res = await fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: line });
  }catch(e){ process.stderr.write(`Cannot reach ${URL_}: ${e.message}\n`); return viewerDown(msg); }
  if (res.status === 202 || msg.id === undefined) return;
  const text = await res.text();
  if (!res.ok){
    process.stderr.write(`HTTP ${res.status}: ${text}\n`);
    return out({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: `Viewer answered HTTP ${res.status}.` } });
  }
  if ((res.headers.get("content-type") || "").includes("text/event-stream")){
    for (const l of text.split(/\r?\n/)) if (l.startsWith("data: ")) process.stdout.write(l.slice(6) + "\n");
  } else process.stdout.write(text.trim() + "\n");
}

let active = 0, closed = false;
readline.createInterface({ input: process.stdin }).on("line", line => {
  if (!line.trim()) return;
  active++;
  forward(line).finally(() => { active--; if (closed && !active) process.exit(0); });
}).on("close", () => { closed = true; if (!active) process.exit(0); });
