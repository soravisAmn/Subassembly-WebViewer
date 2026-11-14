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
- Never edit the user's `.cs` files at the root during tests; copy them elsewhere.
- Tests must never read the user's working files at the root (`*.cs`, `*.assembly.json`). Use locked copies in `SA.Tests/fixtures/` instead.
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

`build-c3d.bat` builds the round 6 subassemblies against real Civil 3D. `test-all.bat` at the root runs the C# suite and every JS suite: one line per suite plus only the failures; full log in `SA.Tests/test-all.log`. Close the viewer first (it locks the build output). Details: `docs/testing.md`. Real Civil 3D test sets: `tests-civil3d/`, see `docs/civil3d-testing.md`.

## Status

- Last finished: round 7 (Build dialog, report, `.atc`, icons, source package), M0-M5. Docs: `docs/build.md`. History: `docs/history.md`.
- Round 7 Civil 3D run: `.atc` needs the full DLL path (now the only form), Side list OK, re-adding the catalog duplicates the tools (open: try refresh / remove first). Thai text not checked. Next: round 8 (project folders).
- Round 6 M5 Civil 3D run: shapes filled crossed (link order in `Shapes.Add`). Fixed in shim + generator (`docs/civil3d-testing.md`).
- Not yet tested in real Civil 3D: the demo files listed in `docs/history.md`.

## Plan

Decided ideas: `docs/ideas/IDEA#1.md` (Thai). Read only the item for the current round, not the whole file. UI wireframes: Design canvas "SA Drawing Studio — UI wireframe" on claude.ai (the user shares screenshots).

| Round | Work (IDEA#1 item) |
|---|---|
| 7 | Build + report + `.atc` + source package (3–4) |
| 8 | Project-folder storage: relative paths, spec only in `.cs`, scenarios in the project file, Pack, relink (8) |
| 9 | New UI shell: ribbon, contextual Edit tabs, dockable palettes (7) — after the Figma pass |
| 10 | Web display: style by code (`.style.json`), notes, dimensions, Civil 3D preview mode (1) |
| 11 | Icon generator (5) |
| 12 | Browser palette: folder roots, thumbnails, copy into `lib\` (2) |
| 13 | In-app AI chat (6) |

Any time: `.pkt` experiment, app settings page. Later: public web; keep **core** (spec, evaluator, CodeGenerator, shim, pages) separate from **host** (localhost, local files, local compile). Postponed: drawing from a CAD screenshot via MCP. SAC-style flowchart: `docs/prompts/prompt-flowchart-later.md`.

Full roadmap: Trello board "SA Drawing Studio".
