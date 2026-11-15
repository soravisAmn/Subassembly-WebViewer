# Round 8 test: project folders + .atc palette in Civil 3D

Project: `D:\test_cad\SA-Projects\SR03\SR03.assembly.json`. Details: `docs/projects.md`, build: `docs/build.md`.

Claude Code does not open or drive Civil 3D. Every step below is yours. Write the results in the table at the end (or tell Claude Code in chat).

## 0. Before you start

1. **Close Civil 3D.**
2. Restart the web (`run-viewer.bat`), then Ctrl+F5 once.

## 1. The project in the web

1. "ไฟล์ ▾" → **Open project…** → `D:\test_cad\SA-Projects\SR03\SR03.assembly.json`.
   - The header shows `project: SR03` and the folder; the 3 subassemblies draw as before, no ● and no `*`.
2. Open `D:\test_cad\SA-Projects\rock-pitching-compare\rock-pitching-compare.assembly.json` (in a **second tab**).
   - "ส่วนที่วาดไม่ตรงกับไฟล์ .cs" asks about the 2 `-web` items: choose **ใช้ใน .cs** for both, then **Save project** (the title loses `*`).
3. In that second tab, open SR03 too: it must say "อ่านอย่างเดียว" (SR03 is open in the first tab). Close the second tab.
4. Scenarios: add a case (drag the ground, "+ บันทึกกรณีนี้"), change a parameter → the case shows `*` → **อัปเดต** → click **Default** → the ground and the value come back; the drawing never changed. Save project.
5. "ไฟล์ ▾" → **ตั้งค่า…**: Copy to = `D:\test_cad\C3D_Custom\SA` (ticked). Save.

## 2. Build with Copy-to

1. **Build** → Civil 3D 2027 → Build. Expected "✓ … build สำเร็จ" and "คัดลอก … แล้ว".
2. In `D:\test_cad\C3D_Custom\SA`: `SR03.dll`, `SR03.atc`, `SR03_tools.atc`, **`SR03_palette.atc`** (new), `icons\SR03\`.

## 3. Palette in Civil 3D (the round 7 leftover)

1. Start Civil 3D 2027 (new drawing or `test_corridor.dwg`).
2. Remove the old SR03 tools / palette from the Tool Palettes window.
3. `CONTENTBROWSER` → Add Catalog → `D:\test_cad\C3D_Custom\SA\SR03.atc` (if it is already listed, remove it from the Content Browser first).
4. In the catalog, find the **palette SR03** and drag **the whole palette** once into the Tool Palettes window. Expected: a palette **SR03** with the 3 tools and their icons.
5. Insert one tool into an assembly: it works as in round 7.

## 4. Refresh Palette after a new build

1. In the web: change the default of one parameter (e.g. TopWidth of base), Save (.cs).
2. **Close Civil 3D**, Build again (Copy-to on).
3. Open Civil 3D, right-click the palette SR03 → **Refresh Palette**.
4. Check: do the tools update (new default shows when you insert the tool) **without duplicates**? Note the result.

## 5. Thai text (round 7 leftover)

1. Give a parameter a Thai description in the web (Parameter card), Save (.cs), Build.
2. In Civil 3D, check the tool properties / Subassembly Properties: is the Thai text readable (not ????)?

## 6. Pack

1. "ไฟล์ ▾" → **Pack project…** → save the zip to e.g. `D:\test_cad\SR03_<date>.zip`.
2. Unzip it into another folder, Open project from there: everything opens, no "ไฟล์หาย".

## Results

| # | Check | Result | Notes |
|---|---|---|---|
| 1.1 | SR03 opens from SA-Projects | | |
| 1.2 | compare: questions, Save as v3 | | |
| 1.3 | second tab read-only | | |
| 1.4 | scenario `*` / อัปเดต / Default, drawing unchanged | | |
| 2 | Build + Copy-to, `SR03_palette.atc` present | | |
| 3.4 | whole palette dragged once, 3 tools with icons | | |
| 4.4 | Refresh Palette updates without duplicates | | |
| 5 | Thai text readable | | |
| 6 | Pack, unzip elsewhere, opens | | |
