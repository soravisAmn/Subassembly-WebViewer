// Runs every test suite quietly: one summary line per suite, plus only the failures.
// Started by test-all.bat at the repository root. The full output goes to SA.Tests/test-all.log (git-ignored).
// Exit code: 0 = everything passed, 1 = a suite failed or could not run.
"use strict";
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");

const root = path.join(__dirname, ".."), logFile = path.join(__dirname, "test-all.log");
const MAX_LINE = 300;                  // failure messages can contain a whole spec as JSON
const COUNTS = /(\d+) ผ่าน, (\d+) ไม่ผ่าน/;   // the summary line every suite prints

const clip = s => s.length > MAX_LINE ? s.slice(0, MAX_LINE) + " ..." : s;
let log = "", failedSuites = 0, passedTotal = 0, failedTotal = 0;

function runSuite(name, cmd, args){
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 30, shell: false });
  const out = (r.stdout || "") + (r.stderr || "");
  log += `===== ${name} (exit ${r.status}) =====\n${out}\n`;
  const lines = out.split(/\r?\n/);
  const summary = lines.filter(l => COUNTS.test(l)).pop();

  // no summary line = the suite did not finish (build error, locked DLL, syntax error, ...)
  if (r.error || !summary){
    failedSuites++;
    console.log(`FAIL ${name}: did not finish${r.error ? " - " + r.error.message : ""}`);
    for (const l of lines.filter(x => x.trim()).slice(-8)) console.log("    " + clip(l.trim()));
    return;
  }
  const [, pass, fail] = COUNTS.exec(summary).map(Number);
  passedTotal += pass; failedTotal += fail;
  const bad = fail > 0 || r.status !== 0;
  if (bad) failedSuites++;
  console.log(`${bad ? "FAIL" : "ok  "} ${name}: ${pass} passed, ${fail} failed`);
  if (!bad) return;

  // each failure: the FAIL line + the indented detail lines right after it
  for (let i = 0; i < lines.length; i++){
    if (!/^\s*FAIL\b/.test(lines[i])) continue;
    console.log("    " + clip(lines[i].trim()));
    for (let j = i + 1; j < lines.length && /^\s{4,}\S/.test(lines[j]) && !/^\s*(PASS|FAIL)\b/.test(lines[j]); j++)
      console.log("      " + clip(lines[j].trim()));
  }
}

runSuite("C# (SA.Tests)", "dotnet", ["run", "--project", "SA.Tests"]);
const jsDir = path.join(__dirname, "js");
for (const f of fs.readdirSync(jsDir).filter(x => x.endsWith(".test.js")).sort())
  runSuite(f, process.execPath, [path.join(jsDir, f)]);

fs.writeFileSync(logFile, log);
console.log(`\n${failedSuites ? "FAILED" : "PASSED"}: ${passedTotal} passed, ${failedTotal} failed, ${failedSuites} suite(s) with problems. Full log: SA.Tests/test-all.log`);
if (failedSuites && /being used by another process|locked by/.test(log)) console.log("Hint: a running viewer locks the build output. Close run-viewer.bat and run this again.");
process.exitCode = failedSuites ? 1 : 0;
