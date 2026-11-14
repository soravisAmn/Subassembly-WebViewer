# Build for Civil 3D (round 7)

Builds the subassemblies of one project (`*.assembly.json`) into one DLL per Civil 3D version. Design and decisions: [prompts/prompt-7-design.md](prompts/prompt-7-design.md). Status: **M3**: engine, endpoints, Build dialog, pre-build checks, `sa_build_check`, `.atc` and icons. The report, the source package and the actual Copy-to come in M4.

## Build dialog (`js/build.js`)

Open it from **"ไฟล์ ▾" → "Build…"** or the **Build** button on the menu bar. The project must be saved first, because the build uses the saved project file and the `.cs` files on disk.

| Part | Does |
|---|---|
| สิ่งที่อยู่ใน DLL | One row per class: tick box per file (default all), file (สร้างจากเว็บ / เขียนเอง), namespace, class, and check result (✓ / ⚠ n / ✖ n) |
| namespace / class | Web files: editable, then "เปลี่ยน" → confirm "ต้อง Save ไฟล์ … ด้วย" → Logic API `setClassName` (one Undo step) → Save (.cs) with `rename` (Roslyn renames the class, its uses, the `SaDrawing_` helper and the namespace declaration outside SA-DRAWING; comments are not touched). The file must be open in the workspace. Hand-written files: read-only ("แก้ในโค้ด") |
| Export | Build (DLL package). Source package (M4) and `.pkt` ("ทดลองภายหลัง") are shown disabled |
| .atc | "path แบบเต็ม": the `.atc` names the DLL by full path (the Copy-to folder when it is on, else the output folder) instead of the bare file name. Fallback in case Civil 3D does not accept the bare name (test in M5) |
| ชื่อ DLL | Default = project name |
| Civil 3D | One tick per version found; versions that cannot be built are greyed with the reason. Default: the newest that can be built |
| Output | `build\<DLL>\<year>\` per ticked version |
| Copy to | Machine setting (tick + absolute folder that exists), saved at once to `settings.json`. The copy itself comes in M4 |
| ตรวจก่อน build | Runs when the dialog opens, on every change, and on "ตรวจอีกครั้ง". Errors first, then warnings. The page adds "ส่วนที่วาดยังไม่ได้ Save (.cs)" for unsaved drawings of built files |
| Build | Disabled while there is an error (or nothing to build). A same-named DLL in another folder → OK / Cancel box "มี DLL ชื่อนี้อยู่แล้ว" (decision 4), OK = build with `allowSameName`. Shows progress, then per version: DLL path (copy button), compiler errors, and parameter changes ("ลบเครื่องมือเก่าออกจาก palette แล้วลากใหม่") |

No new shortcut.

## Pre-build checks (`BuildChecks.cs`, `BuildEngine.Check`)

Same for the dialog and MCP `sa_build_check`. They run on the files on disk, because that is what `dotnet build` compiles.

| Kind | Severity | What |
|---|---|---|
| `class` | error / warning | From `ClassReader` (see below) |
| `compile` | error | The simulator cannot compile the file (first 10 errors, with line) |
| `run` | error | An exception in some scenario (the scenarios are listed) |
| `message` | warning | Simulator messages, once each with the scenarios they occur in |
| `no-code` | warning | Links / shapes without any code. Web files: ids from the sa-spec (`L3`, `S1`, auxiliary links not counted). Hand-written files: `link #n (บรรทัด …)` from the simulator run |
| `code-case` | warning | Codes that differ only by case or spaces anywhere in the DLL (`Datum` vs `datum `) |
| `locked` | error | Ticked version: the DLL in the output folder is in use ("ปิด Civil 3D ก่อน") |
| `same-name` | warning | Ticked version: a same-named DLL in another folder (build history; the output and Copy-to folders do not count) |
| `params` | warning | Ticked version: parameter changes since the last build (manifest) |

Scenarios per class, as `sa_check`: grounds `high`, `low`, `mid`, `rising`, `falling`, `V` around the shape, `layout`, `no target`, each Right and Left (Left only when the class has the Side parameter), plus the saved scenarios the page sends for that file (ground relative to the item origin). That makes 16 runs per class, plus the saved scenarios.

## MCP `sa_build_check`

A read-only tool that runs `Check` on the server, so it works without the page. Arguments: `project` (default: the only project in the folder), `dllName`, `years` (default: every version that can be built). It never builds: the user presses Build. Messages stay in Thai, as in the dialog.

## Engine (`SA.Web/Build/`)

| File | Does |
|---|---|
| `C3DVersions.cs` | Finds installs: `Program Files\Autodesk\AutoCAD 20xx` with `C3D\AeccDbMgd.dll`. TFM from `acdbmgd.runtimeconfig.json`, fallback 2025 / 2026 → `net8.0-windows`, 2027 → `net10.0-windows`. Checks `dotnet --list-sdks` for an SDK with major ≥ the TFM's. 2025–2027 are always listed (not installed = "ไม่ได้ติดตั้ง") |
| `BuildPaths.cs` | All paths in one place (round 8 changes only this file). Machine folder `%LOCALAPPDATA%\SA-Studio\` |
| `CsprojWriter.cs` | The `.csproj`: same settings as `tests-civil3d/build/Round6.csproj`. The `.cs` files are compiled where they are (never copied or edited), Autodesk DLLs referenced in place with `Private=false`, and `C3DInstall` can be overridden |
| `ClassReader.cs` | Namespace + class per file (Roslyn, syntax only). A subassembly class = top-level, non-static, with `Draw()` (no parameters). Checks: valid identifiers, public, full name unique in the DLL (error), names that differ only by case (warning), missing `GetLogicalNames` / `GetInputParameters` / `GetOutputParameters` / `Draw` (warning) |
| `BuildManifest.cs` | `build-manifest.json` (classes + parameters of the last successful build) and its diff: class added / removed, parameter added / removed (a rename shows as both), default or type changed. `build-history.json` in the machine folder: every DLL path built, used to find a same-named DLL in another folder |
| `BuildChecks.cs` | `Check`: the pre-build checks above |
| `MachineSettings.cs` | `%LOCALAPPDATA%\SA-Studio\settings.json`: `copyTo`, `copyToOn` |
| `BuildEngine.cs` | `Plan` (files → classes → checks, no build) and `Build` (per year: locked DLL? → same name elsewhere? → csproj → `dotnet build` → parameters from the simulator → manifest + diff → history). One build at a time, 5 min timeout |

## Output folder

```
<project folder>\build\<DLL>\<year>\
  <DLL>.dll, <DLL>.pdb, <DLL>.deps.json
  build.log              full dotnet build output
  build-manifest.json
  <DLL>.atc              Tool Catalog (Content Browser → Add Catalog)
  <DLL>_tools.atc        the category with one tool per class
  icons\<Class>.png      tool images (Namespace_Class.png when two classes share a name)
  obj\<DLL>.csproj       generated on every build (intermediate files in obj\obj\)
```

`/build/` is git-ignored (only at the root, so `tests-civil3d/build/` is unaffected).

## Tool Catalog (`AtcWriter.cs`, `IconRenderer.cs`, `BuildEngine.MakeCatalog`)

Written after every successful build (outline from the stock catalogs: [prompts/prompt-7-design.md](prompts/prompt-7-design.md), section 3).

- `<DLL>.atc` = root `<Catalog>` with one category, `Url href=".\\<DLL>_tools.atc"` (as the stock Corridor catalogs). `<DLL>_tools.atc` = root `<Category>` with one `<Tool>` per class in DLL order. Plain-text names, like the SAC catalogs.
- GUIDs are name-based (SHA-1, v5 layout) from the DLL name and the class full name. A rebuild keeps them, so re-adding the catalog updates the tools instead of adding copies.
- Tool: name = class name, description = full name + DLL, image `icons\<Class>.png` (64 × 64 declared), `StockToolRef` = the subassembly tool kind, `DotNetClass Assembly="<DLL>.dll"` (or the full path), `<Units>m</Units>`.
- Parameters in `GetInputParameters` order, from a simulator run with default values (Side = Right, layout). `DataType` Long / Double / String / Bool (Bool untested in Civil 3D). `TypeInfo` for doubles: length → 16, slope (x of 1:x) → 10, number / percent → 0; hand-written files → 16. `DisplayName` and `Description` from the spec, else from the code, else the name. Options → `<Enum>` (element = label with only A-Z 0-9 _, else `Option<value>`; `DisplayName` = label). The Side parameter gets Right = 0 / Left = 1.
- Checked after writing: well-formed, the catalog points to the category, every class of the DLL appears once. Problems are warnings of the build.
- Icons: drawn on the server from the same run (shapes light blue, links dark blue, white, cropped), fitted into 256 × 256 with 4 × supersampling, written as PNG without any library. A class that cannot be run gets a plain grey image and a warning "ใช้รูปทั่วไปแทน".

## Statuses per year

| Status | Meaning |
|---|---|
| `ok` | DLL, `.atc` and icons written (`atc`, `icons`). `changes` = parameter changes since the last build ("ต้องลากเครื่องมือใหม่จาก catalog") |
| `failed` | Compiler errors, one line each (`file.cs(line,col): error CSxxxx: ...`). Full log in `build.log` |
| `locked` | "ปิด Civil 3D ก่อน": the DLL is in use (checked before the build, and from MSB3027 / MSB3021 in the output) |
| `same-name` | `<DLL>.dll` of the same Civil 3D year exists in another folder (from the build history). The request must be sent again with `allowSameName: true` (the dialog's OK / Cancel box, decision 4) |
| `skipped` | Version not installed or no matching SDK (`message` = reason) |

## Endpoints (localhost only, like every endpoint)

| Endpoint | Body / result |
|---|---|
| `GET /api/build/versions` | `{ versions: [{ year, path, tfm, installed, sdkOk, canBuild, reason }] }` |
| `POST /api/build/check` | `{ project, dllName?, years?, files?, scenarios?: [{ file, name, surface, values, layout }] }` → `{ ok, dllName, files, classes, webFiles, issues: [{ severity, kind, file, message, scenarios }], years: [{ year, tfm, canBuild, reason, outDir, locked, sameName, changes, hasManifest }], scenarioRuns, ms }` |
| `GET` / `POST /api/build/settings` | `{ copyTo, copyToOn }`. POST refuses a missing or relative folder while `copyToOn` |
| `POST /api/drawing/save` + `rename: true` | Save (.cs) that also renames namespace / class outside SA-DRAWING (Build dialog) |
| `POST /api/build/plan` | `{ project, dllName?, files? }` → `{ ok, dllName, files, classes, issues }` |
| `POST /api/build` | `{ project, dllName?, years: [2027], files?, allowSameName?, atcFullPath? }` → plan fields + `builds: [{ year, status, message, outDir, dll, atc, icons, tfm, errors, changes, sameName, warnings, ms }]` |

`project` = the file name of the project (`SR03` or `SR03.assembly.json`, at the top of the viewer folder). `dllName` defaults to the project name, and may use only `A-Z a-z 0-9 _ - .`. `files` = a subset of the project's `.cs` files (default: all, in item order).

Parameters in the manifest come from running each class in the simulator with default values. A file the simulator cannot compile still builds, but gets a warning and an empty parameter list.

## Tests

`SA.Tests/BuildTests.cs` (in `test-all.bat`): csproj, version detection with a fake install folder, DLL names, class reading and checks, manifest diff, same-name detection, locked DLL, error summary, plan, project version 2, class rename, pre-build checks (web and hand-written files, per version, Copy-to, saved scenarios). `.atc` of the 3 fixtures vs the locked `SA.Tests/fixtures/round7/T7.atc` / `T7_tools.atc`, stable GUIDs, icons (PNG, size), description / options / TypeInfo / Enum / full path, hand-written Side. `logicops.test.js`: `setClassName`, `setParamInfo`, options text. `McpTests.cs`: `sa_build_check` is listed, read-only, and has no hidden argument. A **real build** of the 3 round 6 fixtures (copies in a temp folder) runs only when a Civil 3D install that can be built is found, otherwise it prints "skipped". Temp folder: `%TEMP%\sa-build-tests\` (cleared at the start of each run).
