---
name: sa-civil3d-parity
description: Use when real Civil 3D behaves differently from the SA Drawing Studio web / simulator, or when generated or shim code starts using a Civil 3D API member not used before.
---

# Keeping the web equal to Civil 3D

## Rules
- The web must render exactly like Civil 3D. The simulator `SA.Civil3DShim` must **never be more lenient** than the real API (order, direction, missing links, wrappers, exceptions).
- Never add to the shim an API member Civil 3D lacks. Civil 3D links are straight only.
- Claude Code never opens or drives Civil 3D. The user runs it from a checklist and reports back.

## A difference found in Civil 3D: fix order
1. **Shim first**: change `SA.Civil3DShim` (`Civil.cs`, `AutoCAD.cs`, `SimWorld.cs`, `ShapeWalk.cs`, …) so the simulator behaves like Civil 3D. Add a test that fails before the fix, so the web shows the same problem.
2. **Generator next**: fix `SA.Web/Drawing/CodeGenerator.cs` so the generated code works under the stricter rule. The test passes.
3. Write down what Civil 3D did and why in `docs/civil3d-testing.md` (round section) and, if it changes generated code, `docs/code-generation.md`.

Worked example (round 6 M5): shapes filled as crossed triangles. Civil 3D walks the links of `Shapes.Add` in array order. The shim walks them the same way (`ShapeWalk.cs`), the generator emits a `ChainLinks` helper that hands the links over as one closed chain, and `SA.Tests/ShapeChainTests.cs` covers it. A second run showed that `Link.Points` returns new wrappers in the real API: `ChainLinks` compares positions, and the shim returns new wrappers too. Details: `docs/civil3d-testing.md` "Round 6".

## Does an API member exist?
- Look it up in `link-API-Reference.txt` (repo root).
- Then **compile a probe against the real DLLs** in `C:\Program Files\Autodesk\AutoCAD 2027`. Copy the references of `tests-civil3d/build/Round6.csproj` (`acdbmgd`, `accoremgd`, `acmgd`, `ACA\AecBaseMgd`, `C3D\AeccDbMgd`, `<Private>false</Private>`, `net10.0-windows`, x64) into a throwaway project in the scratchpad, with one `.cs` that uses the member, and `dotnet build` it. Compiles = exists. Do not commit the probe; DLLs are never copied or committed.
- `build-c3d.bat` (`tests-civil3d/build/build.js`) builds the round 6 snapshot in `tests-civil3d/round6/` the same way; projects are built from the web's Build dialog (`docs/build.md`).

## Checklist for the user: `tests-civil3d/roundN-checklist.md`
English, numbered steps, Thai only for UI labels as shown in the web. Sections used so far (see `round6`, `round7`, `round8-checklist.md`):
- **0. Before you start**: close Civil 3D (a running Civil 3D locks the DLL and will not load a second DLL with the same assembly name), restart `run-viewer.bat`, Ctrl+F5.
- **The project in the web**: which project in `D:\test_cad\SA-Projects\` to open, what it must show.
- **Build**: ไฟล์ → Build… (or Output › Build), Civil 3D 2027, Copy to set in ไฟล์ → ตั้งค่า…; expected files (`<DLL>.dll`, `.atc`, `_tools.atc`, `_palette.atc`, `icons\`).
- **Palette in Civil 3D**: `CONTENTBROWSER` → Add Catalog (full DLL path in the `.atc`), drag the whole palette into Tool Palettes; after a rebuild: Refresh Palette (no duplicates).
- **Compare with the web**: insert the tool into an assembly / corridor (`test_corridor.dwg`); per scenario the section shape, codes, Datum, shapes filled correctly, Event Viewer messages; Subassembly Properties vs the build report.
- **Results** table: `# | Check | Result | Notes`, one row per step, for the user to fill in and send back.
Record the outcome in `docs/civil3d-testing.md` and the `CLAUDE.md` status.
