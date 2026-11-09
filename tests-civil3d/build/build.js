// Started by build-c3d.bat: builds SaRound6.dll against the installed Civil 3D and prints only a short summary.
"use strict";
const path = require("path"), fs = require("fs"), { spawnSync } = require("child_process");
const here = __dirname, dll = path.join(here, "out", "SaRound6.dll");
const r = spawnSync("dotnet", ["build", path.join(here, "Round6.csproj"), "-nologo", "-v", "q", "-consoleloggerparameters:NoSummary"], { encoding: "utf8", maxBuffer: 1 << 28 });
const out = (r.stdout || "") + (r.stderr || "");
fs.writeFileSync(path.join(here, "out-build.log"), out);
if (r.status === 0){
  console.log("OK: " + dll);
  process.exit(0);
}
if (/being used by another process|locked by|MSB3027|MSB3021/.test(out)){
  console.log("ปิด Civil 3D ก่อน");
  process.exit(1);
}
const errors = [...new Set(out.split(/\r?\n/).filter(l => /\berror\b/.test(l)).map(l => l.replace(/\s*\[[^\]]*\.csproj\]\s*$/, "").trim()))];
console.log(`FAILED: ${errors.length} error(s)`);
for (const e of errors.slice(0, 30)) console.log("  " + e);
if (errors.length > 30) console.log(`  ... and ${errors.length - 30} more (tests-civil3d/build/out-build.log)`);
process.exit(1);
