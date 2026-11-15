# Round 8 design: project folders

Prompt: `docs/prompts/prompt-8.md`. Source of the decisions: `docs/ideas/IDEA#1.md` item 8.
Status: M0 answered (15 Nov). Questions 1-7 as proposed; 8 and 9 changed by the user (section 7).
M1 done (server, `SA.Web/Projects/`): `ProjectPaths` (resolution), `ProjectFile` (v1/v2 → v3, draft rule, validate, Save-as rebase), `ProjectRegistry` (per-tab handles, read-only second tab), `ProjectApi` (fs list, project open / new / save / close / relink, settings). Every file endpoint, `AssemblyService`, Build (`BuildEngine.For`) and MCP (`project` argument, tab list in `sa_status`, `sa_build_check`) follow the tab's project. The page does not send handles yet (M2), so it still uses the old folder. `ProjectsFolder` in `appsettings.json` (optional) = start folder of the file dialog.
M2 done (page, `js/project.js` + `core.js`): `fetch` adds `X-SA-Project` to every `/api/` call and re-attaches after a server restart (409 `projectLost`); workspace per tab in sessionStorage (+ localStorage copy of the last active tab); start-up rules (reload / last project / old fixed folder / scratch via `POST /api/project/scratch`); web file dialog; Open / Save / Save as / New / Recent; "ตั้งค่า…" (Copy-to moved out of the Build dialog; `c3dInstall` used by Build detection); title + `*` + read-only badge; migration-question and "ไฟล์หาย" dialogs with relink. M3 done (`js/scenarios.js`): scenarios in the project file as in section 5; the old snapshot (`projContent` / `loadScenario`) is removed, so the "scenario reverts the drawing" bug is gone (test in `scenarios.test.js`). While a case is active the page keeps the project's values in `WS().scenarioBase` and `projContentV3` writes those. Several codes per object: not a bug; round-trip tests added (JS normalize, C# generator + simulator).
M4 done: Pack project (`Projects/ProjectPack.cs`, dialog in `project.js`); `.atc` palette (`<DLL>_palette.atc`, listed in `<DLL>_tools.atc`, own stable ids; Copy-to, report and source package include it); `build-c3d.bat` compiles `tests-civil3d/round6/`; user files copied out (section 7.1); CLAUDE.md rules.
M5 done: `docs/projects.md` (Projects / Scenarios moved out of `viewer.md`), `tests-civil3d/round8-checklist.md`, history, CLAUDE.md status; prompt moved to `docs/prompts/`. `SA_STUDIO_MACHINE_DIR` (environment) = another machine folder for a test server. Header-less requests still use the old folder (only old pages send them).

## 1. M0 findings

### 1.1 Suspected bug: loading a scenario reverts the drawing — CONFIRMED (code reading)

- `snapshot(name)` (`js/ui.js` ~L2238) = deep copy of `projContent()`, which includes every item's `spec`, `savedSpec`, `source`, `attach`, and the list of items itself.
- `loadScenario(s)` calls `loadProjContent(s.ws)`, which replaces `WS().assemblies` with the snapshot.
- Effects when a scenario saved earlier is applied:
  1. the drawn part of every item goes back to the spec at save time (later drawing disappears);
  2. `savedSpec` goes back too, so the ● "not saved to .cs" marker can be wrong (it compares against an old savedSpec);
  3. items added after the scenario was saved vanish; removed items come back; attachments revert;
  4. `sav2.scenarios` is one list for all projects, so a scenario saved in project A, applied in project B, replaces B's workspace with A's items.
- The work is not lost for good: `loadProjContent` is a `History.act` step, so Ctrl+Z restores it. But nothing warns the user.
- The new format (section 3) stores no spec and no item list, and applying it never touches `assemblies`. Test in M3: draw, save scenario, draw more, apply scenario → spec unchanged.

### 1.2 Suspected bug: several codes on one object — NOT a bug (code reading)

| Layer | Behaviour |
|---|---|
| spec (`spec.js`) | `codes: []` on points, links, shapes; Clipped Surface Link also `codesGround` / `codesLine` (merged with `uniq`) |
| Properties "Codes" field (`ui.js` L702, L726, L1000) | comma-separated text, `split(",")`, trimmed, empties dropped; shown with `join(", ")` |
| Generator (`CodeGenerator.cs`) | `AddPoint` / `AddLink` / `AddShape` / `FollowSurface` / arcs take `params string[] codes` and loop `Codes.Add` |
| Shim (`CodeCollection`) | a list; `Add` ignores an empty or duplicate code |
| Runner output | `Codes.ToArray()` for points, links, shapes |

Links with 2–3 codes already pass the round-trip tests (`Top,RockFace`, `Top,Datum,SoilEnd` in `RockPitchingTests`). M3 adds a test for a point and a shape with several codes (spec → C# → shim → result, plus the JS evaluator).
Open detail, not changed: the shim drops a duplicate code silently; whether real `CodeCollection.Add` throws on a duplicate is unknown (the generator never adds one twice).

### 1.3 Everything that uses the fixed folder today

`folder` = `SubassemblyFolder` in `SA.Web/appsettings.json` (`..` = repo root), set once in `Program.cs` L25.

| Where | Use | Round 8 |
|---|---|---|
| `GET /api/info` | returns `folder` | returns the open project (path, name) + scratch flag |
| `GET /api/files` | top-level `*.cs` + `*.assembly.json` | `*.cs` of the project folder (import list); projects come from the file dialog |
| `GET/POST /api/assembly-file` | read / write `name.assembly.json` in the folder | replaced by `/api/project/open`, `/save`, `/new` (absolute path) |
| `POST /api/run` | `File` → `folder\name` | resolve against `projectDir` |
| `GET /api/source`, `POST /api/save`, `POST /api/new` | `FolderFile(folder, name)`, top level only | `ProjectFile(rel)`: relative to `projectDir` (subfolders and project-entry `..` allowed, section 2) |
| `POST /api/drawing/code`, `GET /api/drawing/spec`, `POST /api/drawing/save` | same | same |
| `AssemblyService` (`/api/assembly`) | `Path.Combine(_folder, name)` | `projectDir` |
| `BuildEngine` (plan / build / check / source package, `ProjectNames()`), `BuildChecks`, `SourcePackage` | project list + `.cs` paths + `build\` next to the project | the open project only; `build\` next to its project file (unchanged rule) |
| `GET/POST /api/build/settings` | machine settings (Copy-to) | kept as an alias of `/api/settings` for one round, then removed |
| MCP `sa_build_check` (`project` param) | "the only project in the folder" | default = the open project |
| Other MCP tools (`sa_status`, `sa_describe`, `sa_get_spec`, `sa_new`, `sa_apply`, `sa_scenarios`, `sa_check`, …) | forwarded to the page (`PageHub`), no file access | unchanged path; they read the page's specs, which come from the `.cs` + draft. `sa_scenarios add` writes a new-format scenario |
| Page callers | `editor.js` (4), `ui.js` (5), `mcp.js` (3), `main.js` (1) fetch the endpoints above; `build.js` `savedScenarios()`, `condtree.js` / `ui.js` coverage, `aipanel.js` read `scenarios` snapshots | follow the new endpoints and the new scenario format |
| `build-c3d.bat` → `tests-civil3d/build/Round6.csproj` | compiles `..\..\pavement-assembly.cs`, `base_…-web.cs`, `body_…-web.cs` (the user's root files) | point at `SA.Tests/fixtures/round6/` (locked copies already there) |

## 2. Server

### 2.1 Open project and paths

- **No single open project on the server (answer 8).** Each browser tab holds its own project. `POST /api/project/open` (or `/new`) returns a **project handle** (opaque id); the tab sends it in the header `X-SA-Project` on every request, so SR03, SR04 and SR05 can be open in 3 tabs at once. This is also how the public web must work (the handle becomes a database id there).
- `ProjectRegistry` (server memory): handle → `ProjectContext` { `ProjectFile` (absolute path of the `*.assembly.json`), `ProjectDir`, `Referenced` (normalised absolute paths the project file references), `ReadOnly`, `Tab`, `LastSeen` }. Handles are lost when the server restarts: an unknown handle answers `409 { projectLost: true }` and the page re-opens its project by path.
- **Two tabs on the same project:** the second open of a path that a live handle already holds returns a read-only handle + a warning ("เปิดอยู่ในแท็บอื่น — เปิดแบบอ่านอย่างเดียว"). Every write endpoint refuses a read-only handle. A handle is live while its tab's page socket (`/mcp-page`) is open or it was seen in the last 60 s; `POST /api/project/close` (sent on page unload) releases it.
- **MCP (answer 8):** the page tells its socket which handle it holds. `sa_status` lists every open tab (project name, folder, read-only, most recently focused). Every tool takes an optional `project` (name or path); default = the most recently focused tab. `sa_build_check` uses the same rule instead of "the only project in the folder".
- **Transition (M1 only):** a request without `X-SA-Project` uses the old fixed folder, so the current page keeps working until M2 switches it to handles (then: no handle = scratch folder, answer 2).
- No open project → `ProjectDir` = `%LOCALAPPDATA%\SA-Studio\scratch` (created on demand).
- `Resolve(rel)` for every endpoint that takes a file:
  1. accept `/` or `\`; reject rooted paths, empty names, invalid characters, names starting with `.`;
  2. `full = GetFullPath(Combine(ProjectDir, rel))`;
  3. inside `ProjectDir` (any depth) → OK; outside → OK only if `full` is in `Referenced` (rule 2 of the prompt), else refused;
  4. extension must be one the endpoint handles (`.cs` for code endpoints).
- Paths written into the project file: relative to the project file, with the separator style already used in the file (default `\` on new projects). Absolute paths are never written; if an item points at a file on another drive, saving the project stores a relative path when possible and otherwise keeps the item as a draft (section 4.2) and warns.

### 2.2 New endpoints (localhost only)

| Endpoint | Does |
|---|---|
| `GET /api/fs/list?path=` | no path → drives + recent folders; else folders + `*.assembly.json`, `*.cs`, `*.png`, `*.zip` of that folder (name, size, mtime). Read only |
| `POST /api/project/open {path, tab}` | read + migrate (v1/v2 → v3 model, section 4) → returns the handle, read-only flag, the v3 content, the missing-file list, the migration questions; adds to recent |
| `POST /api/project/close` | releases the handle in `X-SA-Project` |
| `POST /api/project/save {path?, content}` | write v3 (CRLF, atomic as `WriteText`); `path` = Save as (new folder + name); updates recent |
| `POST /api/project/new {parent, name}` | creates `parent\name\name.assembly.json` (refuses an existing folder that already holds that file); opens it |
| `POST /api/project/relink {item, path}` | checks the file exists, returns the relative path to store |
| `POST /api/project/pack {...}` | M4 (zip; outside files copied in with rewritten paths, inside the zip only) |
| `GET/POST /api/settings` | machine settings |

Write safety: only `.cs`, `.assembly.json`, `.style.json`, `.png`, `.atc`, `.zip` and build output; no delete endpoint (unchanged).

### 2.3 Machine settings (`%LOCALAPPDATA%\SA-Studio\settings.json`, extends `MachineSettings`)

```json
{ "copyTo": "D:\\test_cad\\C3D_Custom\\SA", "copyToOn": true,
  "c3dInstall": null, "recent": ["D:\\test_cad\\SA-Projects\\SR03\\SR03.assembly.json"],
  "reopenLast": true, "startFolder": null }
```

`recent` max 10, newest first. `startFolder` null = `SubassemblyFolder` from `appsettings.json` (question 3).

## 3. Project file v3

```json
{
  "version": 3,
  "surface": [{ "x": -20, "y": 101.5 }, { "x": 0, "y": 100 }],
  "surfaceOn": true, "layout": false, "extendEnds": true, "originElevation": 100,
  "bar": { },
  "assemblies": [
    { "id": "a1", "name": "SR03", "baseline": { "x": 0, "y": 0 },
      "items": [
        { "id": "i1", "file": "pavement-assembly.cs", "name": "pavement", "className": "PavementAssembly",
          "params": { "Side": "Right" }, "attach": { "type": "baseline", "x": 0, "y": 0 } },
        { "id": "i2", "file": "body_rock-pitching-web.cs", "params": { }, "attach": { "type": "point", "item": "i1", "code": "TrapTopOutside" },
          "draft": { "spec": { } } },
        { "id": "i3", "name": "ร่าง", "draft": { "fileName": "levee.cs", "spec": { } } }
      ] }
  ],
  "scenarios": [
    { "name": "ตลิ่งสูง", "ground": [[-20, 101.5], [0, 100.0], [15, 98.2]], "params": { "i2": { "Hcrest": 3.5 } }, "mode": "normal" },
    { "name": "Layout", "mode": "layout" }
  ]
}
```

- Always the `assemblies` form (v1 single-assembly shape is read, never written).
- Item keys kept: `id`, `file` (relative), `name`, `className`, `params`, `attach`. Dropped: `spec`, `savedSpec`, `generatedFile`, `sourceName`, `source`.
- `draft` (only when needed, rule 1 exception):
  - item with a file, drawing not saved (●): `{ "spec": … }` = the current spec. On open, the item uses it and shows ●; Save (.cs) clears it.
  - drawn item with no file yet: `{ "fileName": "levee.cs", "spec": … }`.
  - code item with no file in the project (inline code from "เปิดจากเครื่อง…" / template not saved): `{ "sourceName": "x.cs", "source": "…" }`; the UI suggests "Save .cs ลงโฟลเดอร์โปรเจกต์".
- `scenarios`: section 5. `bar`, `surface`, `surfaceOn`, `layout`, `extendEnds`, `originElevation` as today (the plain "Default" state).

## 4. Migration v1 / v2 → v3 (on open; v3 written on the next save)

1. Shape: v1 → one assembly; v2 kept.
2. Per item with `file` and `spec`:
   - read the `.cs` spec (`sa-spec`); compare normalised JSON (`Spec.normalize` in the page);
   - `spec` = file spec → drop;
   - `spec` ≠ file spec and `savedSpec` = file spec → it was unsaved drawing → `draft.spec` (● on open), no question;
   - otherwise (the file changed after the project was saved, or no `savedSpec`) → ask: "ใช้ใน .cs" / "ใช้ในไฟล์โปรเจกต์ (เป็น draft)" — decision 3;
   - `.cs` missing → keep `spec` as `draft.spec` and list the file in "ไฟล์หาย".
3. Item without `file`: `spec` → `draft.spec` (+ `fileName`), inline `source` → `draft.source`.
4. Paths: names stay as they are (they were top-level names in the old folder = relative to the project file when the project file sits beside them).
5. Nothing is written until the user saves; the title shows `*` after a migration that changed anything. A first save writes `<name>.assembly.json.v2.bak` next to it once (proposal; no delete endpoint needed).
6. Server side (`ProjectModel.Read`) understands v1 / v2 / v3 for Build, MCP `sa_build_check`, missing-file report and Pack; the spec / draft decision runs in the page.

## 5. Scenarios, new format

- `ground`: polyline in **workspace coordinates** (same frame as `surface`, so one ground serves every item), `[[x, y], …]`; absent = keep the Default ground.
- `params`: `{ itemId: { name: value } }`, only values that differ from the item's `params` at save time.
- `mode`: `normal` | `layout` | `notarget` (= `surfaceOn: false`).
- Applying: the page keeps the Default state (project `surface`, item `params`, mode) and an `activeScenario`; computing uses `{...item.params, ...scenario.params[id]}`, the scenario ground and mode. Specs, items and attachments are never touched; applying is not an undo step. "Default" (always first) clears `activeScenario`.
- **Pending edits (answer 9):** edits of the ground or a parameter while a scenario is active are temporary: the scenario is marked `*`; "อัปเดต" saves them into the scenario. Switching scenario or going to Default with pending edits asks: อัปเดต / ทิ้ง / ยกเลิก. They never change the project's base values (`surface`, item `params`).
- Coverage (Logic tab, `sa_check`, Build checks): built from the new format; the item's origin is its current origin (as today for items with codes).
- `sa_scenarios add` (ground relative to the subassembly origin) converts to workspace coordinates.
- Export / import: `<name>.scenario.json` (one) or `<project>.scenarios.json` (all), per project.
- **Old-scenario import (decision 4):** on the first open of a project in a browser with `sav2.scenarios`, list each old case (name, item names), tick to import. Convert: `surface` + `surfaceOn` → `ground` / `mode`, `layout` → `mode`, items matched by id, else by file → `params` that differ from the project's current values. Specs skipped. Handled projects are remembered in localStorage `sav2.scenariosImported` (list of project paths); `sav2.scenarios` is never deleted automatically.

## 6. Other

- Missing files ("ไฟล์หาย"), Pack, `.atc` palette: as in the prompt (M2, M4).
- `SubassemblyFolder`: only the file dialog's start folder (question 3).
- `build-c3d.bat` / `Round6.csproj`: compile `SA.Tests/fixtures/round6/*.cs` (M4).

## 7. Questions for the user (M0)

| # | Question | Answer |
|---|---|---|
| 1 | Keep a `draft` in the project file for unsaved drawing / items with no file | yes |
| 2 | No open project → scratch folder `%LOCALAPPDATA%\SA-Studio\scratch` | yes |
| 3 | `SubassemblyFolder` only as the file dialog's start folder, default `D:\test_cad\SA-Projects` | yes |
| 4 | Reopen the last project on start (setting, default on) | yes |
| 5 | Pack includes `build\` | off by default |
| 6 | Old root files: see 7.1 | per file |
| 7 | Migration: an unsaved drawing (`savedSpec` = `.cs`) becomes a draft without asking; ask only when the `.cs` changed after the project was saved | yes |
| 8 | One open project per server; another tab that opens a project takes over | **changed:** one project per tab, handle sent with every request; MCP lists tabs, acts on the most recently focused tab or a named project; a second tab on the same project is read-only with a warning (section 2.1) |
| 9 | Scenario ground stored in workspace coordinates; edits while a scenario is active need "อัปเดต" to stick | ground: yes · **changed:** pending edits marked `*`, switching asks อัปเดต / ทิ้ง / ยกเลิก, never touch base values (section 5) |

### 7.1 Root files (answered at M4, 15 Nov)

| File | Decision | Done |
|---|---|---|
| `SR03.assembly.json`, `pavement-assembly.cs`, `base_rock-pitching-web.cs`, `body_rock-pitching-web.cs` | move to `D:\test_cad\SA-Projects\SR03\`; snapshot of the 3 `.cs` in `tests-civil3d/round6/` for `build-c3d.bat` | copied, converted to v3 through the API (no questions, no missing files); root copies removed from git after the user confirms |
| `rock-pitching-compare.assembly.json` + `base_rock-pitching.cs`, `body_rock-pitching.cs` | own project folder `D:\test_cad\SA-Projects\rock-pitching-compare\` with the 4 `.cs` it uses | copied; left v2: opening it asks about the 2 `-web` items (their `.cs` changed after the project was saved), the user answers in the web |
| `test2.cs` | delete | `git rm` (still in history) |
