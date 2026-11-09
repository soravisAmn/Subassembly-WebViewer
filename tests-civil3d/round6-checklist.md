# Round 6 test in Civil 3D (the 3 files edited through the web)

Files: `pavement-assembly.cs`, `base_rock-pitching-web.cs`, `body_rock-pitching-web.cs`.
Baseline for comparison: git commit **`7162b14`** (the restore point before round 6 edits).

Claude Code does not open or drive Civil 3D. Every step below is yours.

## What changed since 7162b14 (from the embedded specs)

| File | Change | Section shape (areas, 7 grounds) |
|---|---|---|
| `pavement-assembly.cs` | Shape codes: S2 `compact soil` → `sand`, S3 `sand` → `CompactedSoil` | Same |
| `base_rock-pitching-web.cs` | New logic and geometry: points P9, P10, links L8–L17, L2 and L3 optional and in branches B6 / B12, S1 outline extended | Same area at those 7 grounds; the outline has more links |
| `body_rock-pitching-web.cs` | L13 codes: `Top, Datum, SoilEnd` → `Top, SoilEnd` | Same |

So `git diff` is **not** codes-only for base: compare base by shape, not by diff.

## Datum on the bottom boundary at HEAD (from `sa_check` logic, simulator)

Lower envelope of real links. Gaps in the 7 generated grounds, Right side:

| File | Datum gaps |
|---|---|
| base | None |
| pavement | L57 (−0.205 to −0.045) on `mid`, `rising`, `falling`, Layout. On `high` (ground above the whole section), also L49, L42, L32, L29 … most of the width. None on `low`, `V` |
| body | **Every ground:** L13 (from about 5.9–11.0 to 11.995) and L10 (11.995 to 12.500) |

Body L13 lost `Datum` in the edit above. Check section 3 with this in mind; a hole there is expected unless these links are meant to be outside the Datum surface.

## 0. Build and load

1. Close Civil 3D, then at the repository root run `build-c3d.bat`. It prints the output path: `tests-civil3d\build\out\SaRound6.dll`. "ปิด Civil 3D ก่อน" means the DLL is locked.
2. Copy `SaRound6.dll` to your subassembly folder (your guide uses `C:\C3D_Custom\SA\`). It needs to be in a Trusted Location.
3. Tool Palette: create one tool per class, as in your guide `Subassembly C# สู่ Civil 3D 2027.html` (section 7). Assembly = the DLL path. Class names:
   - `TestSubassembly.PavementAssembly`
   - `TestSubassembly.RockPitchingBaseWeb`
   - `TestSubassembly.RockPitchingBodyWeb`
4. Open the drawing used before round 6 (or any with a target surface passing through both cut and fill).

To compare against the baseline, build `7162b14` too: `git worktree add ..\sa-7162b14 7162b14`, set the three `Compile` paths in a copy of `Round6.csproj` to it, and use a different AssemblyName. Class names are the same, so load the two DLLs in separate drawings. Remove the worktree afterwards with `git worktree remove ..\sa-7162b14`.

## 1. Same section shape as 7162b14

For each file, same corridor and stations, baseline vs. new:

- [ ] pavement: sections match, in cut and fill
- [ ] body: sections match, in cut and fill
- [ ] base: sections match where the ground is above and below the base; note any station that differs (base has new branches)
- [ ] base: new links L8–L17 and branches behave as you intended
- [ ] No extra or missing points at transition stations

## 2. Event Viewer

- [ ] No red errors in Event Viewer with default parameters, for all 3
- [ ] Warnings only where expected (`Layout`, no target)

## 3. Datum is continuous

Build a corridor surface from `Datum` links for each subassembly.

- [ ] base: no holes, in cut and fill
- [ ] pavement: no holes in normal ground. L57 (a narrow stretch near the axis) is a known gap in `mid` / `rising` / `falling` grounds
- [ ] pavement: if ground above the whole section really occurs, check that stretch
- [ ] body: L13 and L10 are known gaps. Record whether the surface has a hole there, and whether that is what you want

## 4. Codes

- [ ] Code Set Style shows the expected point, link and shape codes
- [ ] pavement shapes S2 = `sand`, S3 = `CompactedSoil` in hatches and quantities

## Results

| Item | Pass / fail | Notes |
|---|---|---|
| | | |
