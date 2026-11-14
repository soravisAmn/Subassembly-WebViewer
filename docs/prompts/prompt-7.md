# Round 7: Build dialog, build report, auto-generated .atc (Tool Catalog), source package

> How to use: tell Claude Code "Read CLAUDE.md and prompt-7.md, then do Milestone 0".
> One milestone at a time; stop after each so the user can check. Report to the user **in Thai, briefly** (what changed / how to check / what is not done).

## 0. Context

- Read `CLAUDE.md` first (rules, language policy, token rules). Round 6 (MCP) is done. Idea list: `docs/ideas/IDEA#1.md` — this round is **items 3–4**. Items 1, 2, 5–8 come later (round order is at the end of IDEA#1); do not start them.
- UI wireframes (Design canvas on claude.ai, the user can show you screenshots): "หน้าต่าง Build" and "รายงานหลัง build". The new ribbon UI is round 9 — **for now put the entry point in the existing menu bar** (e.g. "ไฟล์ ▾" → "Build…", or a "Build" button next to it).
- Today the user builds by hand: `build-c3d.bat` → `tests-civil3d/build/Round6.csproj` (fixed file list, `SaRound6.dll`, net10.0-windows, Autodesk DLLs referenced in place with `Private=false`) → copy the DLL to `D:\test_cad\C3D_Custom\SA` → make one Tool Palette tool per class by copying BasicLane and editing Assembly / Class name. Problems seen: forgetting to rebuild after Save, the same DLL name loaded from two paths in one Civil 3D session ("subassembly .Net classes could not be found"), a copied tool keeps BasicLane's parameter list.
- Goal: **one dialog** that builds every subassembly of the open project into one DLL, writes a matching `.atc` + icons + a report, and warns about the problems above before they happen.

### Files to read (by topic, not whole folders)

| File | Why |
|---|---|
| `tests-civil3d/build/Round6.csproj`, `build.js`, `build-c3d.bat` | Current build: copy its settings (TFM, references, x64, `EnableDynamicLoading`, error summary, "ปิด Civil 3D ก่อน" detection) |
| `SA.Web/Program.cs` | Existing `/api/*` endpoints; add the build endpoints here (localhost only) |
| `SA.Web/Drawing/CodeGenerator.cs` (lines ~40–110) | `ClassName`, `Namespace` (default `TestSubassembly`), parameter comment block |
| `SA.Web/wwwroot/js/spec.js` (params: `name, kind, default, displayName, min, max, unit, positive`) | Parameter fields the `.atc` needs; `description` / enum do not exist yet |
| `js/logicops.js` + `docs/logic-api.md` | Any new spec field (description, enum, namespace) goes through the Logic API first |
| `docs/parameters.md`, `docs/code-generation.md`, `docs/civil3d-testing.md` | Parameter table, generated code, Civil 3D test notes |
| `SA.Mcp` / `docs/connect-claude.md` | Only if question 7 is answered yes |
| A **stock** `.atc` under `C:\ProgramData\Autodesk\C3D 2027\` (find a Corridor Modeling catalog that contains `BasicLane`) | The exact tag structure of a .NET subassembly tool. Read it; **never copy Autodesk files into the repo** — write our own template from what you learn |

## 1. Build dialog (before build)

Opened from the menu bar. Thai UI text; field names in English as usual.

- **Contents of the DLL:** every subassembly item of the open project (`*.assembly.json`), with a checkbox each (default all on). Web-generated and hand-written `.cs` files both work; hand-written files are compiled as they are.
- **Export mode:** `Build (DLL package)` · `Source package` (section 5) · `.pkt` shown disabled ("ทดลองภายหลัง").
- **DLL name:** default = project name (`SR03` from `SR03.assembly.json`). Must be a valid file name.
- **Namespace / class names:** a table, one row per class: file · namespace · class · check result.
  - Read namespace + class from each file (Roslyn), not from guesses.
  - Checks: valid C# identifier; full name `Namespace.Class` unique inside the DLL; the class has the 4 public methods Civil 3D calls (`GetLogicalNames`, `GetInputParameters`, `GetOutputParameters`, `Draw`).
  - Editing namespace / class of a **web-generated** file = a Logic API change + Save (.cs) of that file (ask first: "ต้อง Save ไฟล์ … ด้วย"). Hand-written files: read-only, with a hint to edit the code.
- **Civil 3D version:** detect installs, do not hard-code the path:
  - scan for `AutoCAD 20xx\C3D\AeccDbMgd.dll` (Program Files; keep the `C3DInstall` override from `Round6.csproj`);
  - read the TFM from `acdbmgd.runtimeconfig.json` in that install (this is how we found .NET 10 for 2027); fallback map: 2025 / 2026 → `net8.0-windows`, 2027 → `net10.0-windows`;
  - check `dotnet --list-sdks` has a matching SDK; if not, show the version disabled with the reason;
  - versions not installed are shown greyed ("ไม่ได้ติดตั้ง"). Several ticked = one build per version.
- **Output folder:** `build\<DLL name>\<C3D year>\` next to the project file (git-ignored). Contains the DLL, `.atc`, `icons\`, `report.md`, `build.log`. (Round 8 will move projects into their own folders; keep the path logic in one place.)
- **Optional "Copy to" folder** (e.g. `D:\test_cad\C3D_Custom\SA`): after a successful build, copy DLL + `.atc` + `icons\` there. Saved as a **machine setting** (not in the project file). Default off.
- **Pre-build checks** (run when the dialog opens and on "ตรวจอีกครั้ง"; reuse the simulator, Right + Left, every scenario like `sa_check`):
  - compile + run errors (blocking);
  - links / shapes with no code (warning, lists file + link id);
  - code names that differ only by case / spaces, e.g. `Datum` vs `datum` (warning);
  - parameters changed since the last build of this DLL (added / removed / renamed / default changed) → "ต้องลากเครื่องมือใหม่จาก catalog" (warning). Needs a small `build-manifest.json` in the output folder;
  - **same DLL name in another folder**: warn if a DLL of this name exists in another known location (previous output folders, the Copy-to folder, paths recorded in the manifest) — explain that Civil 3D cannot load two same-named DLLs from different paths in one session (blocking unless the user ticks "เข้าใจแล้ว");
  - the DLL is locked (Civil 3D open) → "ปิด Civil 3D ก่อน" (blocking).
- **Build** runs on the server (`dotnet build` on a generated `.csproj` in the output folder's `obj` area), shows progress, then opens the report.

## 2. Parameter data the .atc needs (spec)

- Add to each parameter: `description` (text) and, for enum-like long parameters, `options` (list of `{ value, label }`). `Side` gets `options` Right = 0 / Left = 1 by default.
- New fields go through the **Logic API** (`setParamInfo` or similar) + `docs/logic-api.md`; the Parameter table gets 2 columns (คำอธิบาย, ตัวเลือก). Old specs without them keep working (empty description, no options).
- Generated C# only gains comments from `description` (no behaviour change). The `.atc` uses display name + description + options.
- Hand-written files have no spec: take parameter names / types / defaults from running `GetInputParameters` in the shim; description empty; the report says "ไม่มีคำอธิบาย (ไฟล์เขียนเอง)".

## 3. Auto-generated .atc

- One catalog per build: `<DLL name>.atc`, one **category** (name = DLL name) with one **tool per class**.
- Each tool: name = class name (or display name if the spec has one), description, image (section 4), the .NET class reference (`Namespace.Class` + the DLL), and the parameter list with display names, descriptions, default values, types, enum options — **in the same order as `GetInputParameters`**.
- Structure copied from the stock `.atc` you read in M0 (write the template yourself, record the source path in the design doc). New GUIDs per catalog / category / tool, **stable across rebuilds** (derive from DLL name + class name) so re-adding the catalog updates the tools instead of duplicating them.
- DLL path in the `.atc`: **relative** (`.\<DLL name>.dll` or the form the stock files use for relative paths). Unknown whether Civil 3D accepts it → test in M5; keep a build option "path แบบเต็ม" as the fallback.
- Validate the generated XML (well-formed, every class in the DLL appears once). Unit test: `.atc` for the 3 fixture files matches a locked expected file.

## 4. Icons (basic only — the icon editor is round 11)

- One PNG per class from the existing render (`sa_render` path): section at default parameter values, Right side, no labels, white background, cropped, sized as the stock `.atc` images (check in M0). Stored in `icons\<Class>.png` and referenced from the `.atc`.
- If rendering fails, use a plain generic image and say so in the report.

## 5. Report and Source package

**Report** (dialog + `report.md` in the output folder, English headings are fine but Thai explanations for the user):
- Status (success / failed), date, Civil 3D version, TFM, DLL name, output files.
- Full class names (copy button) — what the user would type in Civil 3D.
- Per class: parameter table (name, display name, type, default, unit, description, min / max, options); point / link / shape codes used (from the simulator run).
- Warnings and errors (from the checks and the compiler).
- "ขั้นต่อใน Civil 3D": `CONTENTBROWSER` → Add Catalog → choose `<DLL>.atc` → drag tools / the category to a Tool Palette; note "ถ้า parameter เปลี่ยน ให้ลบเครื่องมือเก่าออกจาก palette แล้วลากใหม่".

**Source package** (export mode 2) — for a user without Civil 3D who sends it to someone who has it:
- A zip: the `.cs` files, a `.csproj` (same settings as Build, `C3DInstall` property with auto-detect + override), `build.bat` (finds the Civil 3D install, runs `dotnet build`, prints the same short summary as `build.js`), the `.atc`, `icons\`, `report.md`, a short `README.txt` (Thai) with the steps.
- No Autodesk DLLs inside, ever.

## 6. Existing pieces

- `build-c3d.bat` / `Round6.csproj` keep working (tests and docs use them). After M1, `build.js` may call the new build engine instead, if that is simple; otherwise leave them.
- Server endpoints are localhost only (as all others). The build never touches the user's `.cs` files (it compiles them in place or from a copy in `obj`); only a namespace / class change in the dialog does, and that goes through Save (.cs) with a confirmation.
- `.gitignore`: add `build/`.

## 7. Tests

- C#: csproj generation (references, TFM per version, file list), version detection with a fake install folder, `.atc` generation vs a locked expected file (fixtures in `SA.Tests/fixtures/round6/`, never the root files), manifest diff (param added / removed / default changed), same-name DLL detection, class-name checks.
- JS: Logic API for `description` / `options`, Parameter table round-trip, old spec without the new fields.
- Real build test: runs only when a Civil 3D install is found; otherwise prints "skipped" (not a failure).
- Everything via `test-all.bat`.

## 8. Milestones

| M | Work | How the user checks |
|---|---|---|
| 0 | `git status`: **many uncommitted changes since `9b08683`** (shim, generator, fixtures, root `.cs`, docs, `tests-civil3d/*`) plus untracked `TEST.assembly.json`, `body.cs`, `br.cs`, `docs/ideas/`. Summarise them and ask whether to commit them first (separate commit, permission needed). Find and read a stock `.atc` (report its path and the tool-block structure in short). Ask section 10. Write `docs/prompts/prompt-7-design.md` (English) with the answers, the `.atc` template outline and the output-folder layout | Answer questions; read the design doc |
| 1 | Build engine on the server: version detection, csproj generation, `dotnet build`, output folder, error summary, locked-DLL detection, manifest. Endpoint + tests. No dialog yet (a temporary test call or the existing bat is fine) | Run `test-all.bat`; build the 3 round 6 files through the new engine once |
| 2 | Build dialog: contents, DLL name, class / namespace table + checks, version list, Copy-to setting, pre-build checks, progress | Open the dialog on `SR03.assembly.json`, see the warnings (e.g. a link without a code), build |
| 3 | Spec `description` / `options` (Logic API + Parameter table) · `.atc` generation · basic icons | Open the `.atc` in a text editor; Parameter table has the new columns |
| 4 | Report (dialog + `report.md`) · Source package zip · Copy-to after build · same-name DLL warning end to end | Build, read the report; make a source package and run its `build.bat` from another folder |
| 5 | `tests-civil3d/round7-checklist.md` + update `docs/` (new `docs/build.md`, links from README) + CLAUDE.md status. Ask permission to commit | The user tests in Civil 3D (below) |

**M5 checklist for Civil 3D (the user does it; Claude Code never opens Civil 3D):**
1. New drawing (or close Civil 3D first) — avoid the same-name DLL problem from earlier sessions.
2. Build `SR03` from the dialog with Copy-to = `D:\test_cad\C3D_Custom\SA` (a Trusted Location).
3. `CONTENTBROWSER` → Add Catalog → `SR03.atc`. Does the category appear with 3 tools and icons? **Does the relative DLL path work?** If not: rebuild with "path แบบเต็ม" and note it.
4. Drag the category to a Tool Palette; insert each subassembly into an assembly.
5. Subassembly Properties: parameter display names, descriptions, defaults, `Side` as a Right / Left list — compare with the report.
6. Build a corridor on the round 6 test drawing; compare sections with the web (same as round 6).
7. Change one parameter default in the web, Save, rebuild: the dialog warns "parameter เปลี่ยน"; re-add the catalog: tools update rather than duplicate.

## 9. Not in this round

- Ribbon / palette UI (round 9), project-folder storage and Pack (round 8), icon editor (round 11), `.pkt` export (experiment later), AI chat.
- Building several projects at once; signing DLLs; installers.
- No change to how `.cs` files are generated except comments from `description`.

## 10. Questions for the user in M0 (proposed default — "ตามที่เสนอ" is fine)

1. Entry point until the ribbon exists: **"ไฟล์ ▾" → "Build…" plus a "Build" button on the menu bar**.
2. Output folder: **`build\<DLL name>\<year>\` next to the project file**, git-ignored.
3. Copy-to folder: **optional machine setting, default off**; you will set `D:\test_cad\C3D_Custom\SA`.
4. Same-name DLL in another folder: **blocking until "เข้าใจแล้ว" is ticked**.
5. Namespace / class edits from the dialog: **only for web-generated files, with a confirm + Save (.cs)**; hand-written files read-only.
6. Default namespace for new web files stays **`TestSubassembly`**, or change to something like `Soravis.SA`? (**keep `TestSubassembly`** for now, so existing tests and tools stay the same.)
7. Add a read-only MCP tool `sa_build_check` (runs the pre-build checks, no build)? **Yes** — small, and lets Claude check before you build. Building itself stays a button for the user.
8. Icon size: **as the stock `.atc` uses** (report it in M0).

General rules from CLAUDE.md apply (CRLF, localhost only, do not break existing features, no edits to root user files during tests, Logic API first for spec changes, no fake API in the shim, no commit / push without permission, tell the user whether to restart `run-viewer.bat`).
