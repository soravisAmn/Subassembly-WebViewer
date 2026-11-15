# Round 8: Project folders — open from anywhere, spec only in .cs, scenarios in the project, Pack, relink, app settings

> How to use: tell Claude Code "Read CLAUDE.md and prompt-8.md, then do Milestone 0".
> One milestone at a time; stop after each so the user can check. Report to the user **in Thai, briefly** (what changed / how to check / what is not done).

## 0. Context

- Read `CLAUDE.md` first. Round 7 (Build, `.atc`, report) is done (`docs/build.md`). This round is **IDEA#1 item 8** (`docs/ideas/IDEA#1.md`, section "8. การเก็บข้อมูล") plus two small leftovers from round 7. Read only item 8 and the round-7 notes in item 3.
- Wireframes (Design canvas on claude.ai; the user can show screenshots): "Pack project", "ไฟล์หาย / relink". The ribbon UI is round 9 — **keep using the existing menu bar ("ไฟล์ ▾")** for new commands.
- Decisions already made by the user (do not ask again):

| # | Decision |
|---|---|
| 1 | The user's projects move **out of the repo** into their own folders, e.g. `D:\test_cad\SA-Projects\SR03\` |
| 2 | Open / Save as / New use **the web's own file dialog** (server lists folders) + a **recent projects** list. No native Windows dialog |
| 3 | Old project files with embedded `spec` / `savedSpec`: if equal to the spec in the `.cs` → drop silently; if different → **ask** which to keep |
| 4 | Old scenarios in localStorage: on first open of a project, an **"นำเข้า scenario เก่า"** dialog with a checkbox per case, converted to the new format |
| 5 | **New project = new folder** + project file |
| 6 | A small **app settings** dialog now (Copy-to, recent projects, Civil 3D install path), stored on the machine |
| 7 | Small extras: `.atc` palette + Refresh Palette test; check two suspected bugs (section 7) |
| — | Pack: no direct opening of a `.zip`; the user unzips to a folder, then opens it |

### Current state (checked in code)

| Where | What |
|---|---|
| `SA.Web/Program.cs` ~L25 | One fixed folder: `SubassemblyFolder` in `appsettings.json` = `..` (the repo root). `/api/files`, `/api/assembly-file`, `/api/source`, `/api/save`, `/api/new`, `/api/drawing/*` all resolve names against it (top directory only) |
| `js/ui.js` `projContent()` / `loadProjContent()` (~L2169) | Project JSON: `version` 1 (one assembly) or 2 (`assemblies`), each item has `file`, `params`, `attach`, **`spec`, `savedSpec`**, `source` (inline code for items with no file), `generatedFile` … |
| `js/draw.js` L172 | `drawingDirty = spec !== savedSpec` (the ● "not saved to .cs" marker) |
| `js/ui.js` ~L2216 | Scenarios: localStorage `sav2.scenarios`, one list for **all** projects; a scenario = `snapshot(name)` = the whole `projContent()` **including specs**; `loadScenario` replaces the workspace |
| `SA.Web/Build/BuildPaths.cs` | Machine folder `%LOCALAPPDATA%\SA-Studio` (build history) — put app settings here too |
| Repo root | The user's files `SR03.assembly.json`, `pavement-assembly.cs`, `base_rock-pitching-web.cs`, `body_rock-pitching-web.cs` (tracked in git), `TEST.assembly.json`, `rock-pitching-compare.assembly.json`, and older `.cs` files |

## 1. Project folder layout and file rules

```
SR03\                          ← any folder, any drive
├─ SR03.assembly.json          ← project file
├─ pavement-assembly.cs        ← spec (+ later notes / dimensions) embedded here only
├─ body_rock-pitching-web.cs
├─ base_rock-pitching-web.cs
├─ lib\                        ← reserved for round 12 (objects copied from the library)
└─ build\                      ← round 7 output (already "next to the project file")
```

Rules (from IDEA#1 item 8):
1. **The `.cs` is the only source of a saved spec.** The project file keeps file name, params, attach, scenarios, surface, view settings — not `spec` / `savedSpec`.
   - Exception — unsaved work must not be lost: an item whose drawing is not saved to its `.cs` yet (● dirty), or that has no file yet, keeps a **`draft`** (its current spec / inline source) in the project file, clearly named. On open, a draft restores the ● state. (Question 1.)
2. **All paths in the project file are relative to the project file** (forward or back slashes accepted on read; written as the project's own style). No absolute paths are written. Paths that leave the folder (`..\shared\x.cs`) are allowed but reported by Pack.
3. **Scenarios live in the project file** (section 3).
4. **Machine-specific values are not in the project file**: Copy-to, recent projects, Civil 3D path, window / panel layout (already localStorage), later library roots.
5. **A missing file never breaks opening** (section 5).
6. Bump the project `version` (3) and **migrate** v1 / v2 on open; write v3 on save. Keep reading v1 / v2 forever (tests).

## 2. Server: open from any folder

- Replace the single fixed folder with **the folder of the open project** (`projectDir`). Every endpoint that takes a file name resolves it against `projectDir`. Without an open project: a scratch folder in the machine folder (`%LOCALAPPDATA%\SA-Studio\scratch`), not the repo root.
- `SubassemblyFolder` in `appsettings.json` stays only as the default for the file dialog's first location (or is removed — say which in M0).
- New endpoints (localhost only, like the rest):
  - list a directory (folders + `*.assembly.json` / `*.cs` / `*.png` / `*.zip`, drives at the top level),
  - open / save / new project (absolute path in, relative paths inside),
  - read / write app settings.
- Safety: only read / write the file types the app uses (`.cs`, `.assembly.json`, `.style.json`, `.png`, `.atc`, `.zip`, build output); no delete endpoint; refuse paths with `..` after normalisation unless they come from a project file entry (rule 2).
- MCP tools (`sa_*`) keep working: they act on the open project. Check `sa_new` / `sa_apply` / `sa_get_spec` read the spec from the `.cs` (+ draft), not from the project file.
- `build-c3d.bat` / `tests-civil3d/build/Round6.csproj` point at root files that will move: update them to `tests-civil3d/` copies or the fixtures (never the user's project folder), and say what changed.

## 3. Scenarios, new format

```json
"scenarios": [
  { "name": "ตลิ่งสูง", "ground": [[-20, 101.5], [0, 100.0], [15, 98.2]],
    "params": { "<item id>": { "Hcrest": 3.5 } }, "mode": "normal" },
  { "name": "Layout", "mode": "layout" }
]
```

- A scenario stores **only what differs from the defaults**: ground line, changed parameter values per item id, mode (`normal` / `layout` / `no target`). **No spec, no geometry.**
- Applying a scenario changes ground + values used for computing; it **never replaces the drawing** and is not an undo step that can revert drawn work. A **"Default"** entry (always first) returns to the plain state.
- UI (existing Scenarios pane): click = apply · "บันทึกกรณีปัจจุบัน" · "อัปเดต" · rename · delete. Branch / Loop coverage (Logic tab, `sa_check`) keeps working from the new format.
- Export / import one or all scenarios as `<name>.scenario.json` (keep the existing "Export scenarios" menu, now per project).
- **Migration (decision 4):** on the first open of a project in a browser that still has `sav2.scenarios`, show "นำเข้า scenario เก่า": list each old case (name, item names it contains), tick to import; convert = take its ground + mode + the param values that differ from the project's current values for items with the same id / file; skip specs. Mark the old list as handled per project so the dialog does not return; never delete it automatically.

## 4. Open / Save / New / Recent / Settings (menu "ไฟล์ ▾")

- **Open project…**: the web's file dialog (folder tree + list, path box you can type / paste into, recent list on the side). Opens `*.assembly.json`.
- **Save** / **Save as…** (Save as = choose folder + name; copies nothing else — use Pack for that).
- **New project…**: choose a parent folder + name → creates `<name>\<name>.assembly.json`; the new project is open and empty.
- **Recent projects** submenu (machine setting, max 10, missing ones shown greyed with "หาไม่เจอ").
- **ตั้งค่า…** (app settings dialog): Copy-to folder (moved from the Build dialog's machine setting — keep one value), Civil 3D install override, recent list (clear), "เปิดโปรเจกต์ล่าสุดตอนเริ่ม" (default on). Stored in `%LOCALAPPDATA%\SA-Studio\settings.json`.
- Title / menu bar shows the project name + folder; unsaved project changes show `*`.

## 5. Missing files and relink

- On open, every referenced file that is missing is listed in the **"ไฟล์หาย"** dialog (wireframe): file, what happens if not found, "หาไฟล์ใหม่…" (web file dialog). Relinking writes the new **relative** path.
- An item whose `.cs` is missing: shown in the tree with ⚠, drawn as an empty frame; if it has a `draft`, offer to keep working from the draft and Save (.cs) to recreate the file.
- "เปิดต่อ" always opens the project.

## 6. Pack project

- **Pack project…** (wireframe): zip with the project file, every referenced `.cs` (+ `.png` beside it), `lib\`, scenarios (inside the project file), optional `build\` (default off). Files referenced from outside the folder are **copied in** and their paths rewritten **inside the zip only** (the open project is not changed); the dialog lists them in yellow.
- Unsaved drawing (● items): ask to Save (.cs) first, or pack with drafts.
- Output name default `<name>_<yyyy-mm-dd>.zip`, saved where the user chooses (web file dialog).
- No "open zip" — the user unzips, then Open project.

## 7. Small extras

1. **`.atc` palette (round 7 leftover):** besides the category, write a **palette** (as in the stock `.atc`) holding one tool per class, with stable ids. Report + `docs/build.md`: "ลากทั้ง palette ครั้งแรก · build ใหม่แล้วคลิกขวา palette → Refresh Palette". To be tested by the user (M5).
2. **Check two suspected bugs (report in M0, fix in the milestone that touches them):**
   - **Loading an old scenario reverts the drawing.** `snapshot()` stores `projContent()` including specs and `loadScenario` replaces the workspace, so applying a scenario saved before later drawing probably brings back the old drawing. Confirm with a test; the new format (section 3) removes the cause.
   - **Several codes on one point.** Civil 3D allows a point (and link / shape) to have several codes; check the spec, the Properties "Codes" field, the generator and the shim all keep and emit every code (round 10 notes / labels depend on it). Fix if not.

## 8. Moving the user's files

- At M4 (after Open / Save work), **with the user's permission**, move the user's project files out of the repo:
  - `SR03.assembly.json` + the 3 `.cs` files → `D:\test_cad\SA-Projects\SR03\` (as a v3 project; the user re-opens it from there),
  - other root files (`TEST.assembly.json`, `rock-pitching-compare.assembly.json`, `body.cs`, `br.cs`, `test2.cs`, `*_rock-pitching.cs`, …): list them and ask per file (move to a project folder / keep in the repo as test data / delete).
- Use `git mv` only for files that stay in the repo; files leaving the repo are copied out, then removed from git **after** the user confirms the copy opens fine.
- Update `CLAUDE.md` rules that talk about "the user's `.cs` files at the root" (they now live in project folders outside the repo; tests still use `SA.Tests/fixtures/` only).

## 9. Tests

- C#: path resolution against `projectDir` (relative in, absolute out, `..` handling), project v1 / v2 → v3 migration (fixtures of each), draft round-trip, missing-file report, Pack contents (outside files copied + paths rewritten in the zip only), settings read / write, `.atc` palette block.
- JS: scenario apply never changes specs / drawing (the bug test), old snapshot → new scenario conversion, Default entry, coverage from new scenarios, multi-code points round-trip.
- Fixtures in `SA.Tests/fixtures/` (add `round8/` with a small v1, v2 and v3 project + `.cs` files). Never the user's folders.
- Everything via `test-all.bat`.

## 10. Milestones

| M | Work | How the user checks |
|---|---|---|
| 0 | `git status`; read item 8 of IDEA#1; confirm the two suspected bugs (section 7.2) with a quick test or code reading; list every endpoint / MCP tool that uses the fixed folder; ask section 11; write `docs/prompts/prompt-8-design.md` (v3 project schema, endpoint list, migration rules) | Answer questions; read the design doc |
| 1 | Server: `projectDir`, directory listing, open / save / new endpoints, settings file, v1/v2 → v3 migration, draft rule, relative paths. MCP tools follow the open project | `test-all.bat`; open `SR03.assembly.json` from its current place through the API |
| 2 | Web: file dialog, Open / Save / Save as / New / Recent, settings dialog (Copy-to moves here), title with project name, missing-file dialog + relink | Open a copy of SR03 from another folder; rename a `.cs` and see the relink dialog |
| 3 | Scenarios in the project (new format, apply without touching the drawing, Default, rename / update, export / import), old-scenario import dialog, the multi-code fix if needed | Import old scenarios; apply them while editing — the drawing stays |
| 4 | Pack project · `.atc` palette · move the user's files out of the repo (section 8, with permission) · update `build-c3d.bat` paths · CLAUDE.md rules | Pack SR03, unzip elsewhere, open it |
| 5 | `docs/` (new `docs/projects.md`; update `viewer.md`, `build.md`, `screen.md`), `tests-civil3d/round8-checklist.md`, CLAUDE.md status; ask permission to commit | Civil 3D check below |

**M5 checklist for Civil 3D (the user does it):**
1. Open SR03 from `D:\test_cad\SA-Projects\SR03\`, Build with Copy-to (from the new settings dialog).
2. Remove the old SR03 tools / palette; Add Catalog → drag the **whole palette** once.
3. Change a parameter default, Save, close Civil 3D, Build, open Civil 3D, right-click the palette → **Refresh Palette**: do the tools update without duplicates? Note the result.
4. Check Thai text (display names / descriptions) in the tool properties (round 7 leftover).

## 11. Questions for the user in M0 (proposed default — "ตามที่เสนอ" is fine)

1. Unsaved drawing / items without a file: keep a **`draft`** in the project file (only for those items) so nothing is lost — **yes**.
2. Without an open project the web uses a scratch folder in `%LOCALAPPDATA%\SA-Studio\scratch` — **yes** (not the repo root).
3. `SubassemblyFolder` in `appsettings.json`: **keep only as the file dialog's start folder**, default `D:\test_cad\SA-Projects`.
4. On start: **reopen the last project** (setting, default on).
5. Pack: include `build\` — **off by default**.
6. Old root files (section 8): Claude Code lists them with a suggestion per file; the user decides each.

General rules from CLAUDE.md apply (CRLF, localhost only, do not break existing features, never touch the user's project files during tests, Logic API first for spec changes, no fake API in the shim, no commit / push without permission, tell the user whether to restart `run-viewer.bat`).
