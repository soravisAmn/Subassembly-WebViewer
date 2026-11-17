# Projects: folders, Open / Save / Pack, settings, scenarios (round 8)

Thai labels in quotes are the text shown in the web. Design and decisions: [prompts/prompt-8-design.md](prompts/prompt-8-design.md).

## Project folder

```
D:\test_cad\SA-Projects\SR03\     ← any folder, any drive; move / copy / zip it as a whole
├─ SR03.assembly.json             ← project file (version 3)
├─ pavement-assembly.cs           ← each .cs holds its own drawing (sa-spec)
├─ body_rock-pitching-web.cs
├─ base_rock-pitching-web.cs
├─ SR03.style.json                ← style by code (round 10, optional; docs/display.md)
├─ lib\                           ← reserved for round 12 (objects copied from the library)
└─ build\                         ← Build output (round 7), can be rebuilt
```

- **The `.cs` is the only place a saved drawing lives.** The project file keeps file names, parameters, attachments, ground line, scenarios, bottom-bar values and `styleFile` (the style file it uses, relative path; written only after Save style / Open style file…; no key = `{name}.style.json` if it exists, else automatic colours).
- **Drafts:** work that is not in a `.cs` yet is kept in the project file as `draft`, so nothing is lost: a drawing not saved to its `.cs` (●), a drawn item with no file yet, inline code from "เปิดจากเครื่อง…". Opening restores the ● state; Save (.cs) clears it.
- **Paths are relative to the project file** (`pavement.cs`, `lib\x.cs`, `..\shared\x.cs`); no `D:\…` is written. A file outside the folder is allowed (Pack copies it in).
- **Machine values are not in the project**: Copy-to, Civil 3D install folder, recent projects, start folder (app settings, below), window / panel layout (browser).
- Your projects (since 15 Nov 2026): `D:\test_cad\SA-Projects\SR03\`, `D:\test_cad\SA-Projects\rock-pitching-compare\`. The repo keeps only test copies (`SA.Tests/fixtures/`, `tests-civil3d/round6/`).

## "ไฟล์" menu (application button left of the ribbon tabs; the common commands are also in Home › Project)

| Item | Does |
|---|---|
| **Open project…** | the web's own file dialog: path box (type / paste + Enter), drives / start folder / recent projects on the left, double-click opens |
| **Save project** | writes the project file (version 3). The header and the tab title show `*` while there are unsaved project changes |
| **Save project as…** | any folder + name. Paths to the `.cs` files are rewritten relative to the new place; the `.cs` files stay where they are |
| **New project…** | choose a parent folder + name → creates `name\name.assembly.json` and opens it (empty) |
| Recent projects | the last 10 (this machine); missing ones greyed "หาไม่เจอ" |
| **Pack project… (zip)** | see below |
| Export / Import scenarios | see Scenarios |
| **ตั้งค่า…** | app settings (below) |

**"ตั้งค่า…"** (this machine only, `%LOCALAPPDATA%\SA-Studio\settings.json`): Copy to (moved out of the Build dialog; the Build dialog shows it with a "ตั้งค่า…" button) · Civil 3D install folder when it is not under `C:\Program Files\Autodesk` · "เปิดโปรเจกต์ล่าสุดตอนเริ่ม" (default on) · start folder of the file dialog (default `ProjectsFolder` in `SA.Web/appsettings.json` = `D:\test_cad\SA-Projects`) · clear the recent list.

## Tabs and start-up

- **Each browser tab holds its own project**: SR03, SR04 and SR05 can be open in 3 tabs at once.
- A **second tab on the same project opens read-only** ("อ่านอย่างเดียว" in the header): Save is off and the server refuses every write (save, Save (.cs), Build). Pack still works.
- Reloading a tab keeps its workspace. A new tab opens the last project (setting). Without a project the web uses a scratch folder (`%LOCALAPPDATA%\SA-Studio\scratch`); Save project as… gives it a real folder.
- After the browser was closed, the unsaved work of the last tab comes back when that project is reopened.
- **MCP (Claude):** `sa_status` lists the open tabs and their projects; every tool takes `project` (name, file name or path) and otherwise acts on the most recently focused tab. `sa_build_check` follows the same rule.

## Old project files

Version 1 / 2 files (with drawings embedded) open and are converted; the title shows `*` until Save project writes version 3.

- a drawing equal to the one in its `.cs` → dropped;
- a drawing not saved to its `.cs` → draft (●), no question;
- the `.cs` changed after the project was saved → "ส่วนที่วาดไม่ตรงกับไฟล์ .cs": choose "ใช้ใน .cs" or "ใช้ในไฟล์โปรเจกต์ (●)";
- a missing `.cs` → its drawing becomes a draft and the file is listed in "ไฟล์หาย".

## Missing files ("ไฟล์หาย")

On open, every referenced file that is missing is listed: what happens without it (empty frame, or "วาดต่อได้" when there is a draft), **"หาไฟล์ใหม่…"** (web file dialog; the new path is stored relative to the project file, outside the folder allowed) and **"เปิดต่อ"** (always opens). An item with a draft can keep working; Save (.cs) recreates the file.

The project's **style file** (`styleFile`, round 10) is listed too when it is missing ("Style … ใช้สีอัตโนมัติจนกว่าจะหาไฟล์เจอ"): the project opens with automatic colours, and "หาไฟล์ใหม่…" points the project at another `*.style.json`.

## Pack project

One zip to take the project elsewhere (like eTransmit):

- the project file (scenarios and drafts included), every referenced `.cs` (+ a `.png` with the same name beside it), `lib\`, and `build\` only when ticked (off by default);
- files referenced from **outside** the project folder are copied into `ext\` and their paths are rewritten **in the zip only** (yellow in the dialog); the open project is not changed; missing files are listed in red and skipped;
- the style file: inside the folder it keeps its path; outside (e.g. a shared template) it is copied to `ext\` and `styleFile` is rewritten in the zip only; with no `styleFile` key, a `{name}.style.json` beside the project file goes in too;
- unsaved drawings (●): "Save (.cs) ทั้งหมดก่อน", or pack them as drafts;
- default name `name_yyyy-mm-dd.zip`, saved where you choose (web file dialog). Inside the zip everything is under `name\`.
- The web does not open a zip: unzip, then Open project.

## Scenarios

Test cases of the project (left panel), saved in the project file.

- A case keeps only the **ground line** (workspace coordinates), the **parameter values that differ** from the project's, and the **mode** (normal / Layout / no target). No drawing, no items.
- **"Default"** (always first) = the project's own values. Click a case = apply it: only the ground / values / mode change, **the drawing never changes**, and it is not an undo step.
- **"+ บันทึกกรณีนี้"** = a new case from the values in use now (it becomes the active one).
- Editing the ground or a parameter while a case is active is **temporary**: the case gets `*`; **"อัปเดต"** saves the edits into it. Switching case / going to Default with edits asks **อัปเดตกรณีนี้ / ทิ้ง / ยกเลิก**. The project's values (what Save project writes) never change while a case is active.
- Row buttons: ✎ rename · ⇩ export `name.scenario.json` · × delete. ไฟล์ → Export scenarios (or Output › Export scenarios) = all cases as `project.scenarios.json`; Import accepts one case, a list, or old-format files (converted).
- Branch / Loop coverage (Logic tab), Build checks and `sa_check` use these cases; cases from an accepted AI proposal are added here.
- **"นำเข้า scenario เก่า"**: the first time a project opens in a browser that still has the old browser list (`sav2.scenarios`), the web lists those cases (name, items, how many match this project by id or file) to tick and import (ground + mode + differing values; drawings skipped). Asked once per project; the old list is never deleted.

## Server side (for development)

- `SA.Web/Projects/`: `ProjectPaths` (resolution), `ProjectFile` (v1 / v2 → v3, drafts, validation, Save-as rebase), `ProjectRegistry` (per-tab handles), `ProjectApi` (endpoints), `ProjectPack` (zip).
- Every `/api/` request carries the tab's handle in the header `X-SA-Project` (`js/core.js` wraps `fetch`). A request without it uses the old fixed folder `SubassemblyFolder` (only old pages send that). After a server restart the page re-opens its project by path (`409 projectLost`).
- Endpoints: `GET /api/fs/list` · `POST /api/project/open | new | save | scratch | close | relink | pack` · `GET/POST /api/settings` · `GET /api/style?file=` / `POST /api/style/save {file, text}` (round 10: only `*.style.json`, same path rules as the `.cs` files, valid JSON object only, refused in a read-only tab or without a project file; `relink` also accepts a `.style.json`). Files in a request resolve against the tab's project folder; subfolders are allowed, `..` only for files the project file references; no delete endpoint.
- Page: `js/project.js` (`ProjectV3`, start-up, dialogs, Pack) and `js/scenarios.js` (`Scen`).
- `SA_STUDIO_MACHINE_DIR` (environment) = another machine folder, for a test server that must not touch the real settings.
