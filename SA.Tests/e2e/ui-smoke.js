// Round 9 UI smoke test: ribbon tabs, Edit flow (contextual tabs), palettes, Reset layout, ? table — in headless Chrome / Edge.
// Playwright is not installed on this machine, so this drives the installed browser through the DevTools protocol (no packages).
// Not part of test-all.bat (needs a running viewer). Run against a TEST server with a scratch SA_STUDIO_MACHINE_DIR and copies:
//   node SA.Tests/e2e/ui-smoke.js http://localhost:5051/
// It imports SA.Tests/fixtures/round6/pavement-assembly.cs only when the page shows a file of that name; otherwise it uses what is open.
// No browser found = "skipped" (not a failure). Leaves nothing behind: own browser profile in %TEMP%, nothing saved.
"use strict";
const { spawn } = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
const URL_ = process.argv[2] || "http://localhost:5051/";
const BROWSERS = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
                  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"];
const exe = BROWSERS.find(p => fs.existsSync(p));
if (!exe){ console.log("skipped: no Chrome / Edge found — use the manual checklist in docs/testing.md"); process.exit(0); }

let passed = 0, failed = 0;
const check = (name, cond, info) => { if (cond){ passed++; console.log("  PASS  " + name); } else { failed++; console.log("  FAIL  " + name + (info ? "\n        " + String(info).slice(0, 400) : "")); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const prof = fs.mkdtempSync(path.join(os.tmpdir(), "sa-ui-smoke-"));
const PORT = 9300 + Math.floor(Math.random() * 300);
const br = spawn(exe, ["--headless=new", `--remote-debugging-port=${PORT}`, "--user-data-dir=" + prof, "--no-first-run", "about:blank"], { stdio: "ignore" });
const errors = [];

(async () => {
  let tgt;
  for (let i = 0; i < 150 && !tgt; i++){ await sleep(200); try{ tgt = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === "page"); }catch{} }
  if (!tgt) throw new Error("browser did not start");
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const wait = {};
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && wait[d.id]){ wait[d.id](d); delete wait[d.id]; }
    else if (d.method === "Runtime.exceptionThrown") errors.push((d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text);
  };
  const send = (method, params) => new Promise(r => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception || {}).description || "evaluate failed");
    return r.result.result.value;
  };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: URL_ }); await sleep(4000);
  const tabs = `[...document.querySelectorAll("#rb-tabs .rb-tab")].filter(b => !b.hidden).map(b => b.dataset.tab + (b.classList.contains("cur") ? "*" : "")).join(",")`;

  check("page loads with the ribbon and the workspace palette", await ev(`!!document.querySelector("#ribbon .rb-page") && !!Dock && Dock.has("main")`));
  for (const t of ["home", "view", "annotate", "output", "ai"]){
    await ev(`document.querySelector('.rb-tab[data-tab="${t}"]').click()`); await sleep(150);
    check(`tab ${t} switches`, await ev(`!document.querySelector('[data-page="${t}"]').hidden && document.querySelector('.rb-tab[data-tab="${t}"]').classList.contains("cur")`));
  }
  check("contextual tabs hidden outside Edit", (await ev(tabs)) === "home,view,annotate,output,ai*");
  if (!(await ev(`allItems().length`)) && (await ev(`fetch("/api/files").then(r => r.json()).then(i => i.files.some(f => f.name === "pavement-assembly.cs"))`))){
    await ev(`loadSpecFromFile(addItem({ file: "pavement-assembly.cs" }, asms()[0] || null))`); await sleep(3000);
  }
  if (await ev(`allItems().length`)){
    await ev(`setSel({ type: "item", item: allItems()[0].id })`);
    await ev(`document.querySelector('.rb-tab[data-tab="home"]').click()`);
    await ev(`document.querySelector('[data-page="home"] [data-cmd="edit.enter"]').click()`); await sleep(400);
    check("Home › Edit shows Draw / Modify / Logic and switches to Draw", (await ev(tabs)) === "home,view,annotate,output,ai,draw*,modify,logic", await ev(tabs));
    await ev(`document.querySelector('[data-page="draw"] [data-cmd="draw.point"]').click()`);
    check("Draw › Point starts the tool", (await ev(`draw.tool`)) === "point");
    await ev(`document.querySelector('[data-page="draw"] [data-cmd="finish.exit"]').click()`); await sleep(300);
    check("Finish › ออกจาก Edit returns to Home", (await ev(tabs)) === "home*,view,annotate,output,ai", await ev(tabs));
  } else console.log("  (no subassembly open: Edit steps skipped)");
  await ev(`Dock.hide("props")`);
  check("closing a palette", !(await ev(`Dock.has("props")`)));
  await ev(`document.querySelector('.rb-tab[data-tab="view"]').click()`);
  await ev(`document.querySelector('[data-cmd="pal.reset"]').click()`); await sleep(400);
  check("Reset layout brings the default palettes back", await ev(`["tree","scenarios","props","msg","log","pts","logic","ai"].every(id => Dock.has(id))`));
  await ev(`document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true }))`); await sleep(200);
  check("? opens the shortcut table", (await ev(`document.getElementById("dlg-title").textContent`)) === "Shortcut");
  await ev(`cancelDialog()`);
  check("no script errors", !errors.length, errors.join("\n"));
  ws.close();
})().catch(e => { failed++; console.log("  FAIL  " + e.message); })
  .finally(() => {
    br.kill();
    setTimeout(() => { try{ fs.rmSync(prof, { recursive: true, force: true }); }catch{} console.log(`\n${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0; }, 800);
  });
