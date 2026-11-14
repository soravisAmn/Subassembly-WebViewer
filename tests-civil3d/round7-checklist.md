# Round 7 test in Civil 3D: Build dialog, .atc, icons, report

Project: `SR03.assembly.json` (`pavement-assembly.cs`, `body_rock-pitching-web.cs`, `base_rock-pitching-web.cs`). Details of the build: `docs/build.md`.

Claude Code does not open or drive Civil 3D. Every step below is yours. Write the results in the table at the end (or tell Claude Code in chat) so the next round can fix what fails.

## 0. Before you start

1. **Close Civil 3D.** A Civil 3D that has already loaded `SR03.dll` (or `SaRound6*.dll`) from another folder will not load the new one ("subassembly .Net classes could not be found").
2. Open the web (`run-viewer.bat`; restart it if it was open before round 7).
3. Open project `SR03`.

## 1. Build from the dialog

1. Press **Build** on the menu bar (or "ไฟล์ ▾" → "Build…").
2. Check what the dialog shows:
   - three classes `TestSubassembly.PavementAssembly`, `RockPitchingBodyWeb`, `RockPitchingBaseWeb`, all "สร้างจากเว็บ";
   - Civil 3D 2027 ticked, 2025 / 2026 "ไม่ได้ติดตั้ง";
   - warnings (expected: links without codes in pavement, simulator messages); no error.
3. Copy to: tick it and enter `D:\test_cad\C3D_Custom\SA` (must be a Trusted Location).
5. Press **Build**. If the box "มี DLL ชื่อนี้อยู่แล้ว" appears, read the paths, then press OK.
6. Expected: "✓ Civil 3D 2027: build สำเร็จ", the `.atc` path inside `D:\test_cad\C3D_Custom\SA`, and "คัดลอก … แล้ว". Press **ดูรายงาน** and keep it open for step 5.
7. In `D:\test_cad\C3D_Custom\SA` you should see `SR03.dll`, `SR03.atc`, `SR03_tools.atc` and `icons\SR03\` (3 PNG files).

## 2. Open Civil 3D

1. Start Civil 3D 2027 with a **new drawing** (or the round 6 test drawing `test_corridor.dwg`).

## 3. Add the catalog (relative DLL path)

1. Type `CONTENTBROWSER` → **Add Catalog** (or the catalog library menu) → choose `D:\test_cad\C3D_Custom\SA\SR03.atc`.
2. Check:
   - a category **SR03** with 3 tools: `PavementAssembly`, `RockPitchingBodyWeb`, `RockPitchingBaseWeb`;
   - each tool shows its icon (the section drawn in blue);
   - Thai text, if any parameter has a description in Thai, shows correctly.
3. Drag one tool into a Tool Palette, then insert it into an assembly. The `.atc` names the DLL by full path (the bare file name did not work in the first run).

## 4. Tools on a palette, insert

1. Drag the whole category **SR03** to a Tool Palette (or each tool).
2. Insert each subassembly into an assembly. Each must draw (no diagonal line, no error in Event Viewer).

## 5. Subassembly Properties vs the report

For each of the 3 subassemblies, open Subassembly Properties → Parameters and compare with the report ("ดูรายงาน" or `build\SR03\2027\report.md`):

- display names and order are the same as the report's parameter table;
- descriptions show (the description column of the dialog, if Civil 3D shows one);
- default values are the same;
- **Side** is a list **Right / Left**, not a number;
- slope parameters (`SideSlope` in base, unit "slope") show as a ratio; lengths show as distances.

## 6. Corridor

1. Build a corridor on the round 6 test drawing with the new tools (or replace the round 6 tools in the existing assembly).
2. Compare sections with the web, as in round 6 (`tests-civil3d/round6-checklist.md`, sections 2–4): shape fills not crossed, codes, Datum.

## 7. Parameter change and re-adding the catalog

1. Close Civil 3D.
2. In the web: Edit `base_rock-pitching-web.cs` → change the default of `TopWidth` (e.g. 2 → 2.5) → **Save (.cs)**.
3. Open the Build dialog: the checks show "parameter เปลี่ยนจาก build ครั้งก่อน … TopWidth ค่าเริ่มต้น 2 → 2.5".
4. Build. The result lists the change and says to re-drag the tools.
5. Open Civil 3D, Content Browser. First run: **Add Catalog again gave a second set of tools**. Try instead: refresh the existing `SR03` catalog (right-click), or remove it and add it again. Note which one keeps 3 tools with `TopWidth` default 2.5.
6. A tool already on a palette keeps its old default until you delete it and drag it again (expected Civil 3D behaviour).

## 8. Source package (optional)

1. In the Build dialog choose **Source package** → "สร้าง Source package".
2. Unzip `build\SR03\SR03-source.zip` into another folder (not a Trusted Location you already use for `SR03.dll`, or close Civil 3D first).
3. Double-click `build.bat`. Expected: `OK: …\SR03.dll`. Read `README.txt`.

## Results

| Step | Result (OK / problem, what Civil 3D said) |
|---|---|
| 1 Build from dialog | |
| 3 Catalog: category, 3 tools, icons | |
| 3 DLL found (full path) | |
| 3 Thai text in descriptions | |
| 4 Insert each subassembly | |
| 5 Names / order / defaults vs report | |
| 5 Side as Right / Left list | |
| 5 Slope / length display | |
| 6 Corridor sections vs web | |
| 7 Change warned, tools updated not duplicated | |
| 8 Source package build.bat | |
