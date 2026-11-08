# SA Drawing Studio (Subassembly Viewer)

A localhost web app (ASP.NET + JS) for Civil 3D 2027 subassemblies. It compiles a real `.cs` subassembly with Roslyn, runs it against a Civil 3D API simulator and draws the result, and it can also draw a subassembly CAD-style and generate the `.cs` file.

## Run

Double-click `run-viewer.bat`, then open http://localhost:5050. Run all tests with `test-all.bat` (close the viewer first).

## Documentation

| File | Contents |
|---|---|
| [docs/overview.md](docs/overview.md) | What the app does, features by round, opening the web, how a .cs file is run, simulated coordinates, caveats |
| [docs/screen.md](docs/screen.md) | Screen layout, selection, shortcut table, zoom, undo / delete, differences from AutoCAD |
| [docs/drawing-tools.md](docs/drawing-tools.md) | Drawing tools, OSNAP, tracking, Polygon, Arc / Fillet, Intersect / Offset, Extend to Surface, Clipped Surface Link, point types, Auxiliary, Move / Copy / Paste, Rotate |
| [docs/array-loop.md](docs/array-loop.md) | Array and Loop (N computed at run time, `i`, `lastOf`, `count()`) |
| [docs/logic.md](docs/logic.md) | Expressions, conditions, branches, Conditions tree, Variables, Logic tab, Daylight Cut/Fill |
| [docs/logic-api.md](docs/logic-api.md) | Logic API reference (`js/logicops.js`) |
| [docs/parameters.md](docs/parameters.md) | Parameter table, value types, slope fields |
| [docs/code-generation.md](docs/code-generation.md) | Save (.cs), generated code layout, object → code line, rock-pitching files from the web |
| [docs/viewer.md](docs/viewer.md) | Import, editing code, hung code, assemblies, surface line, API simulator |
| [docs/connect-claude.md](docs/connect-claude.md) | Connect Claude (MCP): setup, tools, what the AI cannot do |
| [docs/testing.md](docs/testing.md) | Test commands and what each suite covers |
| [docs/civil3d-testing.md](docs/civil3d-testing.md) | Test sets for real Civil 3D, differences from the real rock-pitching files |
| [docs/prompts/](docs/prompts/) | Finished round prompts and design docs |
