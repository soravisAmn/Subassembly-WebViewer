# CLAUDE.md

## Project

**SA Drawing Studio (Subassembly Viewer)**: a localhost web app (ASP.NET + JS).
1. Shows the shape of a Civil 3D 2027 subassembly from its `.cs` file: compiles with Roslyn, runs against the API simulator `SA.Civil3DShim`, traces test surfaces for every case.
2. Draws subassemblies AutoCAD / SAC style and generates the `.cs` (`SA.Web/Drawing/CodeGenerator.cs`; spec in `SA.Web/wwwroot/js/spec.js`).

Docs index: `README.md`. Topic docs are in `docs/`.

**User:** Soravis, civil / water engineer. Knows AutoCAD, Civil 3D and Subassembly Composer (SAC) very well; Python more than C#. **Talk to him in Thai, briefly.**

## Machine and git

- One machine: `DESKTOP-GK62KQM`, `D:\test_cad\Subassembly-WebViewer`. Civil 3D 2027 at `C:\Program Files\Autodesk\AutoCAD 2027\C3D`. `node` v26 installed.
- Git is the only sync point: `origin` = github.com/soravisAmn/Subassembly-WebViewer, branch `main`.
- **Session start:** `git status` + `git fetch`. If `origin/main` is newer, tell the user and pull before working. If files have pending edits, summarise them first.
- **End of work:** offer commit + push (permission needed every time) and update "Status" below.
- What is agreed in chat must be written to a file (prompt, design doc, `docs/`, or this file).

## Rules

- Text files use **CRLF**.
- The server listens on localhost only. Do not break existing modes or features.
- The user's projects live outside the repo, one folder each (`D:\test_cad\SA-Projects\SR03\`, round 8). Never edit them during tests; tests never read them (nor any `*.cs` / `*.assembly.json` left at the repo root). Use locked copies in `SA.Tests/fixtures/` instead.
- A manual test server (preview) sets `SA_STUDIO_MACHINE_DIR` to a scratch folder (not the real `%LOCALAPPDATA%\SA-Studio` settings / recent projects) and opens copies of projects only.
- No commit, push or new branch without the user's permission.
- Every milestone: run all tests, update the relevant `docs/` file, tell the user whether to reopen `run-viewer.bat` or just press Ctrl+F5.
- New shortcuts go in the `?` table and must not clash. Options inside a command beat general shortcuts.
- No fake API in the shim that real Civil 3D lacks (reference: `link-API-Reference.txt`). Civil 3D links are straight only.
- The web must render exactly like Civil 3D. The shim must never be more lenient than the real API (order, direction, missing links, etc.). Any difference found in Civil 3D is fixed in the shim first (so the web shows the same problem), with a test, then in the generator. To check that an API member exists, compile a probe against the real DLLs in `C:\Program Files\Autodesk\AutoCAD 2027`.
- Features that change spec data (points, links, shapes, parameters, conditions, variables, Arrays, etc.) are functions in the Logic API (`js/logicops.js`) first, then the UI calls them. The UI must not edit the spec directly. Update `docs/logic-api.md` each time. (Pure screen features such as panel size, colour, zoom are exempt.)
- When a round is finished, its prompt + design doc move to `docs/prompts/`.

## Language

| What | Language |
|---|---|
| `CLAUDE.md`, `README.md`, `docs/`, prompts, design docs, commit messages | English (the user's Thai answers are recorded in English) |
| New or edited code comments | English. Do not bulk-translate existing Thai comments |
| MCP tool descriptions and results | English |
| Web UI text, web messages, the `?` shortcut table | Thai stays (button / tool names are English) |
| Chat reports to the user | Thai, short |

## Token rules

- Read `docs/` files by topic. Never read the whole docs folder or old prompts unless the task needs them.
- Never `cat` or read whole generated `.cs` files: the `// sa-spec:` line is huge. Use grep, line ranges, or load the spec through the web / tests.
- Prefer `test-all.bat`. Read full logs only when something fails.
- When updating docs, edit the one relevant file. Do not rewrite unrelated sections.
- Keep reports to the user short.

## Tests

`test-all.bat` at the root runs the C# suite and every JS suite: one line per suite plus only the failures; full log in `SA.Tests/test-all.log`. Close the viewer first (it locks the build output). Details: `docs/testing.md`. Real Civil 3D (`build-c3d.bat`, `tests-civil3d/`): `docs/civil3d-testing.md`.

## Status

- Last finished: round 9 (new UI shell: command registry `js/commands.js`, ribbon `js/ribbon.js`, dockable palettes `js/dock.js`), M0-M4. Docs: `docs/screen.md`. History: `docs/history.md`.
- The user's projects are in `D:\test_cad\SA-Projects\` (SR03, rock-pitching-compare); none left at the repo root.
- Round 8 Civil 3D checklist passed. In progress: round 10 (`prompt-10.md`, design `docs/prompts/prompt-10-design.md`): M0-M3 done (M1 style by code: `js/style.js`, Style palette, overrides; M2 dimensions + slope labels: `js/display.js`, `js/annot.js`, Annotate tab; M3 notes, cross-item dims in the project file, point names; `docs/display.md`); next M4 (docs, Civil 3D checklist).
- Project skills: `sa-spec-change`, `sa-civil3d-parity`, `sa-add-command` (in `.claude/skills/`). Generic agents `reviewer`, `test-runner` are user-level.
- Civil 3D results of each round (round 6 shape link order, round 7 `.atc` DLL path): `docs/civil3d-testing.md`.
- Not yet tested in real Civil 3D: the demo files listed in `docs/history.md`.

## Plan

Decided ideas: `docs/ideas/IDEA#1.md` (Thai). Read only the item for the current round, not the whole file. UI wireframes: Design canvas "SA Drawing Studio — UI wireframe" on claude.ai (the user shares screenshots).

| Round (7-9 done: `docs/history.md`) | Work (IDEA#1 item) |
|---|---|
| 10 | Web display: style by code (`.style.json`), notes, dimensions, Civil 3D preview mode (1) |
| 11 | Icon generator (5) |
| 12 | Browser palette: folder roots, thumbnails, copy into `lib\` (2) |
| 13 | In-app AI chat (6) |

Any time: `.pkt` experiment, app settings page. Later: public web; keep **core** (spec, evaluator, CodeGenerator, shim, pages) separate from **host** (localhost, local files, local compile). Postponed: drawing from a CAD screenshot via MCP. SAC-style flowchart: `docs/prompts/prompt-flowchart-later.md`.

Full roadmap: Trello board "SA Drawing Studio".
