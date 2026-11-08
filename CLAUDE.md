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

`test-all.bat` at the root runs the C# suite and every JS suite: one line per suite plus only the failures; full log in `SA.Tests/test-all.log`. Close the viewer first (it locks the build output). Details: `docs/testing.md`. Real Civil 3D test sets: `tests-civil3d/`, see `docs/civil3d-testing.md`.

## Status

- Last finished: round 5c (token housekeeping). History: `docs/history.md`.
- In progress: round 6, M0-M2 done (`prompt-6-design.md`, `docs/connect-claude.md`). Next: M3 (proposals).
- `prompt-6.md` (MCP: Claude Code / Desktop drive the web through proposals the user accepts, drawing from sketches; Logic API gains basic drawing + applyBatch).
- Not yet tested in real Civil 3D: the demo files listed in `docs/history.md`.

## Plan

1. prompt-6: MCP server so Claude can read / edit the spec, compile and run scenarios.
2. Later: public web (accounts, sandboxed C# compile, user-supplied AI key, Chat / Code modes). Keep **core** (spec, evaluator, CodeGenerator, shim, pages) separate from **host** (localhost, local files, local compile). One repo for now.
3. SAC-style flowchart comes with the public web and must edit the same data as the current logic (`docs/prompts/prompt-flowchart-later.md`).

Full roadmap: Trello board "SA Drawing Studio".
