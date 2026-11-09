# Testing in Civil 3D

Test sets live in `tests-civil3d/`. Thai labels in quotes are the text shown in the web. rock-pitching web files are covered in [code-generation.md](code-generation.md).

## Round 3

`tests-civil3d/round3-demo.cs` = subassembly `TestSubassembly.Round3Demo` generated from the web, with a free Polygon + Fillet at a shape corner, 3-point Arc, radius Arc, regular pentagon (R / θ as parameters), a rotation group (angle as a parameter), a point from Object snap tracking, auxiliary points + links (straight / curved) referenced by real points.

- Build like your other `.cs` files, then follow `tests-civil3d/round3-checklist.md` (7 items in Thai + a table of expected coordinates).
- The same file passes the JS vs C# comparison (Right / Left) in `dotnet run --project SA.Tests`. What remains to check in real Civil 3D is appearance, corridor weight, Code Set Style.
- View in the web: copy `round3-demo.assembly.json` to the folder of `run-viewer.bat` → "ไฟล์ ▾" → Open project (the web opens files only in that folder).

## Round 4

`tests-civil3d/round4-demo.cs` = subassembly `TestSubassembly.Round4Demo`: shoulder + cut / fill slope chosen by the ground (`IsCut`), guardrail when fill exceeds `HighFillH` (nested branch), curb by `Curb` (switch), ditch continuing from the slope end in both cases (first that occurs + conditions in expressions).

- Needs a target surface where the corridor passes through both cut and fill; then follow `tests-civil3d/round4-checklist.md` (10 items + coordinates on flat ground).
- The same spec is in `drawing-cases.json` (JS vs C# in 5 cases: cut, normal fill, high fill + no curb, Left, Layout).

## Round 6: the 3 files edited through the web

`build-c3d.bat` at the root builds `pavement-assembly.cs`, `base_rock-pitching-web.cs` and `body_rock-pitching-web.cs` into `tests-civil3d\build\out\SaRound6.dll` against the installed Civil 3D 2027 (.NET 10, project `tests-civil3d/build/Round6.csproj`; set the MSBuild property `C3DInstall` for another install path). It prints only a short summary; "ปิด Civil 3D ก่อน" means the DLL is locked. Autodesk DLLs are referenced in place and never copied or committed.

Load it as in the guide `Subassembly C# สู่ Civil 3D 2027.html`: Trusted Location, then one Tool Palette tool per class. No NETLOAD needed. Then follow `tests-civil3d/round6-checklist.md`, which compares against commit `7162b14`.

## Round 5b: round5b-demo, fill embankment with a berm every BermInterval (Loop)

`tests-civil3d/round5b-demo.cs` = subassembly `TestSubassembly.Round5bDemo` built with the web's tools only (sequence = `buildRound5b()` in `SA.Tests/js/round5bdemo.test.js`, every step through the Logic API), saved through `/api/drawing/save` · view in the web: "ไฟล์ ▾" → Open project → `round5b-demo.assembly.json` (drag the ground point at the shoulder up / down and the number of benches changes live).

- **Variable `FillH`** = fill height at the shoulder (`P2.y - ground(P2)` · no ground = `LayoutH`) → **`HighFill`** = `FillH > BermInterval`.
- Branch with berms: **Loop A1**, set "slope down `BermInterval` → berm `BermW`", N = `max(1, floor(FillH / BermInterval))`, max 10 · sets joined by a shared point · dx = `BermW + BermInterval * (FillSlope + SlopeInc * i)` (lower benches are flatter) · **last-set point** (lastOf) → final slope to the ground at 1:(FillSlope + SlopeInc × `count(A1)`).
- Low-fill branch: one fill slope · the Arrays tree shows – (the Array is in a branch that does not occur) instead of ×N.
- drawing-cases 109–114 compare JS = C# (fill 2 / 7 / 13 / 40 m, Layout, sloped ground, Left) · in Civil 3D: follow `tests-civil3d/round5b-checklist.md`.
- Limitations: FillH is measured at one point, the shoulder (on steep ground, lower benches may be underground) · berms are equally wide on every bench (dx / dy shift the whole set equally).

## Round 5: round5-demo, embankment

`tests-civil3d/round5-demo.cs` = subassembly `TestSubassembly.Round5Demo` built with the web's tools only (sequence = `buildRound5()` in `SA.Tests/js/round5demo.test.js`, every step through the Logic API), saved through `/api/drawing/save` (the path of the Save (.cs) button) · view in the web: "ไฟล์ ▾" → Open project → `round5-demo.assembly.json`.

- **switch `ProtectionType`**: 1 rock (shape `Rock`) · 2 concrete (shape `Concrete`) · others no protection layer, on top of the crest.
- **Daylight Cut/Fill** at the shoulder → **elif `HighFill`** in the fill branch (shoulder higher than ground by more than `BermH`): high fill = slope down `BermH` → **berm** `BermW` → slope to the ground · normal fill = the original fill slope.
- **Variable `DepthUsed`**: core key (shape `CoreKey`) depth `Depth`, at least 2 m (ValueTooSmall warning).
- drawing-cases 91–95 compare JS = C# (cut / normal fill / high fill / Left / Layout) · in Civil 3D: follow `tests-civil3d/round5-checklist.md`.

## Round 4c: rock-pitching redrawn

`tests-civil3d/round4c-base.cs` (`Round4cBase`) / `round4c-body.cs` (`Round4cBody`) = `base_rock-pitching.cs` / `body_rock-pitching.cs` redrawn with the web's tools only (sequence = `buildBase()` / `buildBody()` in `SA.Tests/js/rockpitching.test.js`; a test checks that rebuilding gives the same spec, character for character).

- **base**: Parameter table (TopWidth / SideSlope must be > 0, Depth min 2) → 4 points (dx / dy as expressions, e.g. `Depth * SideSlope`) → links + Auxiliary base line → **Extend to Surface** at both base corners (base line not moved to the real end) → **Clipped Surface Link** real end outside → real end inside, not above the base line (`Datum` / `TrapOnSurface` / `TrapBase`) → Shape `Trapezoid`.
- **body**: Parameter table → rock face P1 → F → **Offset** `RockThickness` and `RockThickness + MinSoilThickness` (Auxiliary) → helper lines: end closing at 1:EndSlope from F, vertical at the origin → **Intersect** R / B0 (Auxiliary removed + code) / O / soil line at the origin → **Extend to Surface** at O ("ไม่ชนดินใน" = `O.x`) → real end drops Auxiliary + code `SoilToe` → Point `dy = min(ground(P1), P12.y)` (`SoilBaseInside`) → **Clipped Surface Link** not above the soil line → Shapes `RockPitching` + `CompactedSoil`.
- `SA.Tests/RockPitchingTests.cs`: compiles the real files (locked copies in `SA.Tests/fixtures/`) + the drawn files, then runs them on the simulator: base 8 grounds / body 7 grounds (all higher, all lower, crossing, sloped, extended on one / both sides, rough, Layout, no target) × Side Right / Left × 4 value sets (including Depth 1.5, MinSoilThickness 0.5, values ≤ 0) → compares **points + point codes, links + link codes, shapes + shape codes** and whether errors / warnings match (order is not compared).
- In Civil 3D: follow `tests-civil3d/round4c-checklist.md` (place the real files and drawn files side by side in the same corridor).

**Where they differ, and why**

| Topic | Real file | Drawn in the web | Because |
|---|---|---|---|
| Order of Points.Add / Links.Add | Along the outline | Points in spec order, followed by intermediate points of the Clipped Surface Link | The generator orders by definition · no effect on corridor / codes (the test does not compare order) |
| First point of a shape | P1 | By the order of the links clicked | Same closed shape |
| body: end-closing line extends to the ground **past the origin inward** (very low ground + steep) | Warning + no ground at all (bottom edge = the whole minimum thickness line) | Warning + no extension ("ไม่ชนดินใน" = `O.x`), but the bottom edge still follows the ground | "Stop using the ground entirely when…" needs a branch (Logic); the test only checks that both warn |
| base: extending to the ground and the two sides cross before reaching it | Warning + normal trapezoid | Extends both sides (odd shape) | Impossible in real work (needs a negative SideSlope); not reproduced |
| Extending to the ground without hitting it (e.g. short surface, ends not extended) | Warning + normal trapezoid overall | Warning + no extension at that corner only | The drawn version works per corner |
| body bottom edge removes middle points collinear on the ground too | Removed (`cross < 1e-6`) | Removes only middle points of stretches on the reference line (like base) | Occurs when ground break points are collinear; shape coordinates are the same, the point count may differ |
| body bottom edge: points < 0.0001 m apart | Keeps the later point | Keeps the first point | Differs by at most 0.0001 m |
| Whether an end floats above the ground | Lower by > 0.000001 m | Lower by > 0.000000001 m | Only when the ground is right at the base corner (within 0.000001 m) |
| No Target Surface | Warns once | Warns on each piece using the ground | Warning text may differ; presence / absence of warnings matches |
| Class name | `Trapezoid` / `RockPitchingBody` | `Round4cBase` / `Round4cBody` | Can be placed side by side in Civil 3D |
