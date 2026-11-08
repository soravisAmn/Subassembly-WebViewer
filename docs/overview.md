# Overview

A web app for viewing the shape of a subassembly from its real `.cs` file (the same file you build into Civil 3D) without opening Civil 3D: drop in a `.cs` file and the web compiles, runs and draws it. Edit the code and Save, and it redraws within 1–2 seconds.

It can also **draw** a subassembly CAD-style and generate the `.cs` file automatically (first round: `docs/prompts/prompt.md` through Milestone 3 — draw, press **Save (.cs)**, and get a file that builds into Civil 3D).

## Features by round

**Round 2 (`docs/prompts/prompt-2.md`)** — work like AutoCAD as much as possible:

| Topic | Summary | Doc |
|---|---|---|
| Snap | OSNAP (`F3`) with separate types, Grid snap (`F9`), nearest wins, `Tab` cycles snaps, AutoCAD-style markers | [drawing-tools.md](drawing-tools.md) |
| Selection | Window / Crossing, `Shift` removes, `Ctrl+A`, `Esc` · pan with middle mouse / `Space` + drag | [screen.md](screen.md) |
| Undo / Delete | `Ctrl+Z / Y` covers every action · `Delete` on several objects, asking when something depends on them | [screen.md](screen.md) |
| Move / Copy / Paste | `M`, `C`, `Ctrl+C / X / V` with ghost + snap · moves without breaking what a point means · also works on whole subassemblies | [drawing-tools.md](drawing-tools.md) |
| object → code | Select an object to see its lines in the file + a button to go to the code; the cursor in the code highlights the object | [code-generation.md](code-generation.md) |
| Shortcuts | Press `?` / `F1` in the web | [screen.md](screen.md) |

**Round 4c (`docs/prompts/prompt-4c.md`)** — complete (M0–M6): buttons reorganised around real work; agreements in `docs/prompts/prompt-4c-design.md`.
- **`base_rock-pitching.cs` / `body_rock-pitching.cs` can be redrawn entirely in the web with no code** → `tests-civil3d/round4c-base.cs` / `round4c-body.cs`. Tests run them side by side with the real files through the simulator: points / links / shapes / codes match (see [civil3d-testing.md](civil3d-testing.md), including the "where they differ" table).
- **New buttons Intersect (`I`) / Offset (`O`)** in the Geometry group ([drawing-tools.md](drawing-tools.md)) · new point type **Offset (parallel line)**.
- **New button Extend to Surface** in the Surface group · new point type **extend to ground** · **optional** link in a shape · a **real end** can be a link end.
- **New button Array** in the Geometry group ([array-loop.md](array-loop.md)): repeat the selected set N times, dx, dy apart · pavement-style steps.
- **New button Clipped Surface Link** in the Surface group · new link type **follow ground, not past a line** (separate codes for the on-ground / on-line stretches).
- The JS vs C# test (`dotnet run --project SA.Tests`) now also compares **link codes** (previously coordinates only).
- **Max / Min (round 4b) was removed.** Old projects / `.cs` files containing Max / Min still open: it is dropped on load, with a one-time notice "Max / Min ถูกเอาออกแล้ว — จุด … ใช้ตำแหน่งตามนิยามเดิม". Expressions using `limited()` show "ไม่มีฟังก์ชัน limited()".
- The "ขอบเขตค่า" button moved into the **Parameter table** ("ต้องมากกว่า 0" / min / max fields — [parameters.md](parameters.md)) · a **Parameter** button sits on the Properties header during Edit.
- **Button / tool names are in English** (other text stays Thai; a full translation of the web comes later): Daylight Cut/Fill (was "ถ้าตัด / ถม"), Slope to Surface ("ลาดจนชนดิน"), Follow Surface ("วิ่งตามผิวดิน"), Regular Polygon ("Polygon ด้านเท่า"), Cut at Level ("ตัดที่ระดับ" — still disabled), My Shapes ("รูปทรงของฉัน").

**Round 4 (`docs/prompts/prompt-4.md`)** — complete (M0–M5): Logic style ก — conditions / branches attached to objects ([logic.md](logic.md)).
- Condition expressions (`and or not`, `if()`, `P3.x / P3.y`, `ground()`, `exists()`), if / switch / nested branches, point type **first that occurs**, button **"ถ้าตัด / ถม"**, **Logic** tab (live values + scenario branch coverage), **show all cases**, `B` = draw into a branch. JS and the generated C# give matching results (every branch, Right / Left / Layout).
- **Civil 3D test set**: `tests-civil3d/round4-demo.cs` (+ `.assembly.json`): cut / fill / high fill / shoulder switch · follow `tests-civil3d/round4-checklist.md`.

**Round 3 (`docs/prompts/prompt-3.md`)** — complete: Milestones 1–6 + Auxiliary 3b-1, 3b-2 (`docs/prompts/prompt-3b.md`).
- **Civil 3D test set**: `tests-civil3d/round3-demo.cs` (+ `.assembly.json`) has everything from round 3 + auxiliary · follow `tests-civil3d/round3-checklist.md`.
- **Auxiliary** points / links in SAC style: computed / referenced / snappable, but not exported to Civil 3D.
- **Rotate (`R`)** AutoCAD-style: pivot → drag / type an angle (expression / parameter allowed) · options `C` = rotate a copy, `R` = Reference · stored as a **rotation group** whose angle can be edited later in Properties.
- **Curves** (Drawer): **Arc** by 3 points / start-end-radius and **Fillet** at the corner of 2 links. In C# they are split into short straight links (Civil 3D links are straight only) · the radius can be a parameter.
- **Polygon** (Drawer): **free** (click point by point; click the first point / `C` / `Enter` closes) and **regular** (centre + radius, N 3–24, to corner / to edge midpoint) · R / θ can be parameters; edit N / R / θ later in Properties.
- **Object snap tracking (F11)**: hover on a snap point to acquire it → move along its vertical / horizontal, or type dx dy / distance<angle from it · the new point is tied to the acquired point.
- **New point types**: distance + angle (polar) and **Auxiliary point** (computed in code, not added to Civil 3D).
- **Fine zoom**: in to 20000 px/m (1 cm ≈ 200 px), out to 0.5 px/m · grid down to 1 mm · `Shift` + wheel = small zoom steps · `Z` = zoom to selection.
- **OSNAP dropdown**: `OSNAP (F3)` button + `▾` (or right-click the button) = checkable snap-type menu with the same marker icons as on screen.

Differences from AutoCAD (with reasons) are in [screen.md](screen.md#differences-from-autocad).

## Opening the web

Double-click `run-viewer.bat` (or type `dotnet watch --project SA.Web`), then open http://localhost:5050 if the browser does not open by itself.

- The first run is slow because Roslyn (the C# compiler) is downloaded from NuGet.
- Do not close the black window while working; press Ctrl+C to shut down.

## What the web does with a .cs file

It calls things in the same order as Civil 3D:

1. `GetLogicalNames()` → declared targets (Target Surface, etc.) appear in the subassembly's Properties.
2. `GetInputParameters()` → parameter input fields are created automatically (long / double / string / bool). Fields changed from their default turn blue; a parameter named `Side` becomes a Right/Left dropdown.
3. Puts in the entered values + the surface dragged in the web, then calls `Draw()`.
4. Draws points / links / shapes with codes and shows whatever `RecordError` recorded.

**Debug with `Console.WriteLine(...)`**: the text appears in the web's Log panel (Civil 3D shows nothing, so it can stay in the code).

If the code throws an uncaught exception, the web shows a red box with the line number.

## Simulated coordinate system

- Points created with `Points.Add(offset, elevation, ...)` are relative to the origin (same as Civil 3D).
- `IntersectSurface`, `SampleSection`, `FindElevationAtXY`, `CurrentElevation` use real (absolute) values, with the assembly axis at offset 0 and real elevation = **Datum** + the axis height on screen (Datum defaults to 100; editable in the Workspace's Properties). If code forgets to convert between absolute and origin-relative values, the drawing is off by ~100 m, which helps catch bugs.
- The simulated alignment is a straight line: `PointLocation(station, offset)` gives X = offset, Y = station.

## Good to know

- The simulator is written to match the real names and behaviour as closely as possible, but it is **not real Civil 3D**. For example, if `IntersectSurface` finds no intersection the simulator throws an exception (the real one may behave differently). Check final results in Civil 3D.
- Cases saved under Scenarios (left panel) live in the browser; back them up as JSON via "ไฟล์ ▾" → Export scenarios. Scenarios saved from earlier web versions still load.
- The folders `SA.Core`, `SA.Civil3D` come from the first approach (separating the Trapezoid logic); the web no longer uses them. (`SA.Tests` still uses them to test the web — do not delete.)
