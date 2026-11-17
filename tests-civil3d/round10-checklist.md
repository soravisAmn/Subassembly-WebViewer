# Round 10 test: web display data does not change Civil 3D

Everything in round 10 (style by code, overrides, dimensions, slope labels, notes) is web only. The generated C# body must be byte-identical with or without `display`, so Civil 3D must build and draw the subassembly exactly as before. Details: `docs/display.md`, build: `docs/build.md`.

Claude Code does not open or drive Civil 3D. Every step below is yours. Write the results in the table at the end (or tell Claude Code in chat). Do **not** use `D:\test_cad\SA-Projects\`: work on a copy.

## 0. Before you start

1. **Close Civil 3D.**
2. Restart the web (`run-viewer.bat`), then Ctrl+F5 once.
3. Make a scratch folder `D:\test_cad\round10-test\` (the project folder `r10\` is created inside it in step 1.1). The test file is `SA.Tests\fixtures\body_rock-pitching-web.cs` (class `TestSubassembly.RockPitchingBodyWeb`, drawn by the web, has sa-spec).
4. SR03 may hold a class with the same full name: use a drawing that has no SR03 subassemblies, so Civil 3D loads the class from `r10.dll` only.

## 1. Build without display data (A)

1. "ไฟล์ ▾" → **New project** in `D:\test_cad\round10-test\` (name `r10`). The web creates `D:\test_cad\round10-test\r10\r10.assembly.json`. Copy `SA.Tests\fixtures\body_rock-pitching-web.cs` into `D:\test_cad\round10-test\r10\`, then **Import .cs** → pick that file → Save project.
2. Copy `r10\body_rock-pitching-web.cs` to `D:\test_cad\round10-test\A-before.cs` (outside the project, for comparing later).
3. "ไฟล์ ▾" → **ตั้งค่า…**: Copy to **off** (so SR03 in `C3D_Custom\SA` is not touched). **Build** → Civil 3D 2027. Expected "✓ … build สำเร็จ". The DLL then loads from the scratch build folder: add `D:\test_cad\round10-test\r10\build\` (with sub-folders) to Civil 3D **Trusted Locations**, or accept the load prompt in step 1.4.
4. Start Civil 3D (`test_corridor.dwg` or a new drawing with a surface). `CONTENTBROWSER` → Add Catalog → `D:\test_cad\round10-test\r10\build\r10\2027\r10.atc`. Insert the tool into an assembly, build a short corridor through cut and fill.
5. Record: screenshot of the assembly and one section (same zoom), the Code Set Style "All Codes" labels, and the point / link / shape codes listed in Subassembly Properties. Save the drawing as `round10-A.dwg`. **Close Civil 3D.**

## 2. Add display data, build again (B)

1. In the web, select the item (no Edit needed):
   - Style palette: give a link code a colour + `dashed`, a shape code a GRAVEL hatch → **Save style**.
   - Properties › Display on one link: Style = กำหนดเอง, another colour.
   - Annotate › Horizontal: a dimension across the top width; Annotate › Slope label on the slope link; Annotate › Note with leader on a point, text `ความกว้าง {` + a parameter name + `}`.
   - The item shows ●. **Save (.cs)** (Ctrl+S).
2. Compare the files in a command prompt in `D:\test_cad\round10-test\`: `fc /n A-before.cs r10\body_rock-pitching-web.cs`. Expected: **only the `// sa-spec:` line differs** (it now holds `"display"`). No other line.
3. Mode › **Civil 3D preview**: no style colours, no annotations, no point names (neutral grey links).
4. **Build** again. Expected: success, and the report / dialog shows **no parameter change** (display only).
5. Open Civil 3D, open `round10-A.dwg`, Rebuild the corridor (the DLL path is the same).
6. Compare with step 1.5: the assembly, the sections and the codes must be **the same**. No dimension, note, hatch or colour from the web appears in Civil 3D (those come only from your Code Set Style).

## 3. Clean up

Close Civil 3D, remove the catalog `r10.atc` from the Content Browser and the Trusted Location added in step 1.3, delete `D:\test_cad\round10-test\` if you like. In the web, "ไฟล์ ▾" → **ตั้งค่า…**: turn Copy to **back on** (`D:\test_cad\C3D_Custom\SA`). It is a machine setting; left off, the next SR03 build silently skips the copy.

## Results

Write them in `docs/civil3d-testing.md`, section "Round 10" (or tell Claude Code in chat).

| # | Check | Result | Notes |
|---|---|---|---|
| 1.3 | Build A succeeds | | |
| 1.4 | tool inserts, corridor builds | | |
| 2.2 | `fc`: only the `// sa-spec:` line differs | | |
| 2.3 | Civil 3D preview hides style / annotations | | |
| 2.4 | Build B succeeds, no parameter change | | |
| 2.6 | Civil 3D draws B the same as A (shape, links, codes) | | |
