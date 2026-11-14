# Parameters and slope fields

Thai labels in quotes are the text shown in the web.

## SAC-style Parameter table

**Parameter** button on the Properties header during Edit · a subassembly's Properties · the Parameters node. Columns: name, kind, default, display name, **"ต้องมากกว่า 0"** (must be greater than 0, checkbox), **min / max**. Checked in the same order as `base_rock-pitching.cs` / `body_rock-pitching.cs`:

- With "ต้องมากกว่า 0" ticked and a value ≤ 0 → **red error** (`ValueShouldNotBeLessThanOrEqualToZero`, Severe) + **the default is used instead**.
- Then min / max are compared → yellow warning (`ValueTooSmall` / `ValueTooLarge`) + the limit is used, e.g. `Depth = 1.5 < 2, ใช้ 2 แทน`.
- The table warns at once if the default conflicts with the limits ("default 1 ต่ำกว่าขั้นต่ำ 2 — Civil 3D จะเตือนทุกครั้งที่ใช้ค่า default") · min > max is refused · `Side` cannot be ticked (0 = Right).
- The C# gets validation blocks like the user's files: `if (Depth <= 0) { Severe(cs, …); Depth = 2.0; }` then `if (Depth < 2.0) { Warn(cs, …); Depth = 2.0; }`.

Renaming a parameter updates expressions using it · imported files can use the original file's parameters in expressions directly.

## Description and options (round 7)

Two more fields per parameter in the card, used by the `.atc` (what Civil 3D shows in Subassembly Properties). Both go through the Logic API `setParamInfo`:

- **คำอธิบาย** (description): one line of text, at most 300 characters. In the generated C# it is only a comment (on the `AddParams` line and in the header). An empty field removes it.
- **ตัวเลือก** (options), long parameters only: `0=Right, 1=Left` (number=label, separated by commas). Civil 3D shows a list. Empty = none. When the default is not one of the values, the page warns. The Side parameter gets `0=Right, 1=Left` when it has no options of its own (shown as the placeholder). Changing a parameter to double drops its options.

Old specs without these fields work as before.

## Value types

A column of the Parameter table, separate from double / long (round 4e). The stored value / the value in expressions / C# is always the same number; only the display and warning text differ.

| Value type | Type in the table | Display / warning (web = C#) |
|---|---|---|
| Number | `2.5` | `N = 0 < 1, ใช้ 1 แทน` (as before; old specs with no value type = Number) |
| **Slope (1:x)** | `1:1.5` or `1.5` (stores x = 1.5, like the user's `SideSlope = 1.5`) | `SideSlope = 1:0.5 < 1:1, ใช้ 1:1 แทน` |
| Length (m) | `2` or `2 m` | `Depth = 0.5 m < 1 m, ใช้ 1 m แทน` |
| Percent (%) | `2` or `2%` (stores 2 = 2%) | `Grade = 12% > 10%, ใช้ 10% แทน` |

Choosing Slope ticks "ต้องมากกว่า 0" automatically · for 1:x, smaller x is steeper → min = the steepest allowed · max = the flattest allowed.

## Slope fields

Properties of "ลาด + ความยาว" / "ลาดจนชนดิน" points, the slope field in the value box, the Daylight Cut/Fill dialog: direction **↗ up / ↘ down** is separate from the value; then type one of:

- `1:1.5` · a Slope-type parameter name such as `SideSlope` (the web writes `-1/SideSlope`) · `2%` · a Percent-type parameter name (`-Grade/100`); a list of names is offered.
- Or a rise-over-run expression as before (`-0.667`, `-1/SideSlope`); the sign is in the expression and the ↗ ↘ buttons are disabled.
- Storage is still the expression → old specs / files open with the same results (not touching the field = no overwrite) · readable C#: `SlopeToSurface(…, -1.0 / SideSlope, …)`.
- Value box (Tab while drawing): `1:x` / parameter name / `%` = up or down follows the mouse.
- **Daylight Cut/Fill dialog**: the cut / fill slope fields accept the same forms (`1:1.5` · `0.667` rise over run · `2%` · Slope / Percent parameter names · expressions). **Direction is locked**: cut ↗ up / fill ↘ down (a minus sign has no effect) · the field shows `= 1:x` at once / an error message · a Number-type parameter name is used as rise over run (with a warning under the field).
  - Ticking "สร้าง parameter": constant fields become `CutSlope` / `FillSlope` of type Slope (default = x of 1:x, e.g. `0.667` → 1:1.4993, `2%` → 1:50) · fields with a parameter name / expression are used as given.
  - **Changed from before**: a lone number in this field used to mean x of 1:x (`1.5` = 1:1.5); it now means rise over run like other slope fields (Logic API `addCutFill` given a number still means x of 1:x).
- Extend to Surface has no slope field (continues along the original line).
