# Build for Civil 3D (round 7)

Builds the subassemblies of one project (`*.assembly.json`) into one DLL per Civil 3D version. Design and decisions: [prompts/prompt-7-design.md](prompts/prompt-7-design.md). Status: **M1, the engine and endpoints only**. The Build dialog (M2), `.atc` and icons (M3), and the report, source package and Copy-to (M4) come next.

## Engine (`SA.Web/Build/`)

| File | Does |
|---|---|
| `C3DVersions.cs` | Finds installs: `Program Files\Autodesk\AutoCAD 20xx` with `C3D\AeccDbMgd.dll`. TFM from `acdbmgd.runtimeconfig.json`, fallback 2025 / 2026 → `net8.0-windows`, 2027 → `net10.0-windows`. Checks `dotnet --list-sdks` for an SDK with major ≥ the TFM's. 2025–2027 are always listed (not installed = "ไม่ได้ติดตั้ง") |
| `BuildPaths.cs` | All paths in one place (round 8 changes only this file). Machine folder `%LOCALAPPDATA%\SA-Studio\` |
| `CsprojWriter.cs` | The `.csproj`: same settings as `tests-civil3d/build/Round6.csproj`. The `.cs` files are compiled where they are (never copied or edited), Autodesk DLLs referenced in place with `Private=false`, and `C3DInstall` can be overridden |
| `ClassReader.cs` | Namespace + class per file (Roslyn, syntax only). A subassembly class = top-level, non-static, with `Draw()` (no parameters). Checks: valid identifiers, public, full name unique in the DLL (error), names that differ only by case (warning), missing `GetLogicalNames` / `GetInputParameters` / `GetOutputParameters` / `Draw` (warning) |
| `BuildManifest.cs` | `build-manifest.json` (classes + parameters of the last successful build) and its diff: class added / removed, parameter added / removed (a rename shows as both), default or type changed. `build-history.json` in the machine folder: every DLL path built, used to find a same-named DLL in another folder |
| `BuildEngine.cs` | `Plan` (files → classes → checks, no build) and `Build` (per year: locked DLL? → same name elsewhere? → csproj → `dotnet build` → parameters from the simulator → manifest + diff → history). One build at a time, 5 min timeout |

## Output folder

```
<project folder>\build\<DLL>\<year>\
  <DLL>.dll, <DLL>.pdb, <DLL>.deps.json
  build.log              full dotnet build output
  build-manifest.json
  obj\<DLL>.csproj       generated on every build (intermediate files in obj\obj\)
```

`/build/` is git-ignored (only at the root, so `tests-civil3d/build/` is unaffected).

## Statuses per year

| Status | Meaning |
|---|---|
| `ok` | DLL built. `changes` = parameter changes since the last build ("ต้องลากเครื่องมือใหม่จาก catalog") |
| `failed` | Compiler errors, one line each (`file.cs(line,col): error CSxxxx: ...`). Full log in `build.log` |
| `locked` | "ปิด Civil 3D ก่อน": the DLL is in use (checked before the build, and from MSB3027 / MSB3021 in the output) |
| `same-name` | `<DLL>.dll` of the same Civil 3D year exists in another folder (from the build history). The request must be sent again with `allowSameName: true` (the dialog's OK / Cancel box, decision 4) |
| `skipped` | Version not installed or no matching SDK (`message` = reason) |

## Endpoints (localhost only, like every endpoint)

| Endpoint | Body / result |
|---|---|
| `GET /api/build/versions` | `{ versions: [{ year, path, tfm, installed, sdkOk, canBuild, reason }] }` |
| `POST /api/build/plan` | `{ project, dllName?, files? }` → `{ ok, dllName, files, classes, issues }` |
| `POST /api/build` | `{ project, dllName?, years: [2027], files?, allowSameName? }` → plan fields + `builds: [{ year, status, message, outDir, dll, tfm, errors, changes, sameName, warnings, ms }]` |

`project` = the file name of the project (`SR03` or `SR03.assembly.json`, at the top of the viewer folder). `dllName` defaults to the project name, and may use only `A-Z a-z 0-9 _ - .`. `files` = a subset of the project's `.cs` files (default: all, in item order).

Parameters in the manifest come from running each class in the simulator with default values. A file the simulator cannot compile still builds, but gets a warning and an empty parameter list.

## Tests

`SA.Tests/BuildTests.cs` (in `test-all.bat`): csproj, version detection with a fake install folder, DLL names, class reading and checks, manifest diff, same-name detection, locked DLL, error summary, plan. A **real build** of the 3 round 6 fixtures (copies in a temp folder) runs only when a Civil 3D install that can be built is found, otherwise it prints "skipped". Temp folder: `%TEMP%\sa-build-tests\` (cleared at the start of each run).
