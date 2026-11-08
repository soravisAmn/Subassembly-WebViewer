# Logic: expressions, conditions, branches, variables

Thai labels in quotes are the text shown in the web. The programmatic interface is in [logic-api.md](logic-api.md).

## Expressions

**Every numeric field accepts expressions**: numbers, parameter names, `+ - * / ( )`, `min max abs sqrt pow`, `floor ceil round`, `sin cos tan` (degrees), `atan` (returns degrees). Checked while typing: a wrong name / unbalanced parenthesis turns red.

**Conditions and values from geometry** (round 4):

| Write | Meaning |
|---|---|
| `> < >= <= == !=` | Comparison. `==` / `!=` treat values within 0.000001 as equal · chaining like `a < b < c` is not allowed (use `and`) |
| `and or not` (or `&& \|\| !`) | Logic, case-insensitive. If the left side decides, the right side is not computed (`exists(P3) and P3.y > 0` does not error when P3 is missing) |
| `true` / `false` · `if(condition, a, b)` | Boolean values · choose a value (a, b of the same type), e.g. `if(ground(P2) > P2.y, 1, -1)` |
| `P3.x` / `P3.y` | Offset / elevation of a point relative to the origin. **x is in the Right frame** (still positive on Left), so one condition works on both sides |
| `ground(P3)` / `ground(P3, "TargetSurface")` | Ground level at P3's offset (relative to the origin) · no ground (Layout / no target) = P3's own level + warning (no warning in Layout) |
| `exists(P3)` | Whether this point can be computed · `hasGround()` = whether a ground is available |

- A numeric field cannot hold true/false (e.g. `P2.y > 0` turns red "ช่องนี้ต้องเป็นตัวเลข"); error text gives the position.
- An expression referencing a point requires that point to be computed first (circular references = error) · deleting a point also deletes points that use its value in expressions.
- A point that cannot be found = this point cannot be found + warning (C# wraps it in `Try(...)` for matching results, without failing the whole Draw).
- `and or not true false` cannot be parameter names.

## Branches (cut / fill, etc.)

Round 4, style ก: conditions are attached to objects. (A SAC-style flowchart comes later and will edit the same data.)

- Properties of a point / link / shape → **"เกิดเมื่อ"**: `เกิดเสมอ` (always) / an existing branch / `+ เงื่อนไขใหม่…` (asks for a name + true/false expression, creating branches "ใช่" / "ไม่ใช่"; an object already in a branch = the new condition nests under that branch) · the condition's expression is editable on the next row · shows whether it occurs now. With several selected, "เกิดเมื่อ" is set on all at once (one Ctrl+Z).
- **Draw into branch (`B`)** in Edit mode: pick a branch from the list → what the drawing tools create from now on goes into it (banner shows `▶ กิ่ง ตัด` and the Edit bar names the branch). Choosing `เกิดเสมอ` = off · Copy / Paste keep the original's branch · the "ถ้าตัด / ถม" button sets its own branches.
- **Show all cases** (Edit mode): objects not occurring now are drawn as faded dashes in the branch colour + branch name label (position = when that branch occurs with the current ground · slope-to-ground that does not hit = layoutLength long) · they can be clicked / box-selected / snapped / connected to · Properties says "ไม่เกิดตอนนี้ (กิ่ง …)" + the position when the branch occurs. **"ดูแบบ Civil 3D"** = only what really occurs (as in Civil 3D), and no snapping to non-occurring things · outside Edit mode only what occurs is shown.
- **Tree**: objects in a branch have a branch name tag (same colour as the drawing · faded = not occurring now). Not occurring is not an error, so no ⚠.

### Conditions tree

Round 5: left panel, under the subassembly after Shapes · editable during Edit. The whole if / elif / switch structure in one place:

```
▾ Conditions (3)
   + Condition  + Switch
   ▾ ◇ IsCut  ground(P2) > P2.y          ● จริง
      ▾ ● ใช่ ตัด B1               3 ✓    ← objects in the branch (click = same selection as in Points / Links / Shapes)
      ▾ ● ไม่ใช่ ถม B2             3
         ▾ ◇ HighFill …                 –      ← elif = a decision nested in the "no" branch (– = not computed because the parent branch does not occur)
   ▾ ◇ switch Curb                       = 1
      ▸ ● = 1 มีขอบทาง B5          2 ✓
      ▸ ● อื่นๆ ไม่มีขอบทาง B6     0
```

- Live chips ● "จริง" / ○ "เท็จ" / ? "ไม่รู้" / `= value` (switch) / – not computed · branches occurring now have ✓ and bold · ⚠ = no scenario enters this branch yet. Updates live while dragging the ground / editing parameters.
- **+ Condition** / **+ Switch** (buttons under the Conditions header): dialog for the name (starts at `Cond1`) + expression (checked at once, error under the field) · switch = numeric expression + case values `1, 2, 3` ("อื่นๆ" is added automatically).
- **Right-click a branch**: draw into this branch (= `B`) · **+ elif (Condition in this branch)** ("ไม่ใช่" branch) / + Condition in this branch · + Switch in this branch · rename · (switch) edit case value · ↑ ↓ · delete case (asks where objects go).
- **Right-click a decision**: edit expression · change label · (switch) + case · move to nest in a branch… · change to switch / if · go to code · delete… · **double-click a decision** = edit the expression inline (Enter / Esc).
- **Drag an object** (P / L / S rows in Points / Links / Shapes or under a branch) onto a branch = move into it · onto the Points / Links / Shapes header = always occurs · dragging one in the selected set moves the whole set. (The warning "อ้างจุดที่เกิดเฉพาะบางกิ่ง" appears in the banner.) Each action is one Undo (through the Logic API).
- **No need to switch conditions on / off**: a condition with no objects in its branches only computes a value and creates nothing in Civil 3D.

### Variables

Round 5: left panel, under Conditions, like SAC's Define Variable. A numeric value computed once, then usable by name in any expression (dx / dy, slope, Offset distance, Array, conditions, switch). **+ Variable** = a dialog phrased as a sentence:

```
DepthUsed = [Depth]                       ชนิดค่า [Length (m)]
  ถ้า        [Depth < 2]  → [2]           ☑ เตือนเมื่อใช้ค่านี้ [Depth = {Depth} m < 2 m ใช้ 2 m แทน] [ValueTooSmall]
  ไม่งั้น ถ้า [Depth > 10] → [10]          (+ ถ้า อีกข้อ = elif · first true wins · none = the normal value)
```

- The chip in the tree = the current value (by value type, e.g. `2 m`, `1:1.5`) · double-click = edit · right-click: edit / ↑ ↓ / go to code / delete (refused with a list if in use).
- A Slope (1:x) value type goes directly into a slope field (`-1/SideSlopeUsed`) · warning text uses `{name}` for values · CorridorError is guessed (`<` = ValueTooSmall, `>` = ValueTooLarge) and can be changed.
- Can reference points / ground (`P2.y - ground(P2)`) · a point that cannot be found = unknown value + warning → things using this name cannot be found · circular references (through variables / points) are refused.
- Renaming updates every expression + warning text · conditions no decision uses yet are also shown under Variables (type bool).
- **C#**: no point references = a readable if block, as if hand-written · with point references / conditions = `double?` through `Val(…)`:

```csharp
// V1 DepthUsed: ความลึกขั้นต่ำ 2 m
double DepthUsed = Depth;
if (Depth < 2.0) { Warn(cs, CorridorError.ValueTooSmall, "Depth = " + Depth + " m < 2 m ใช้ 2 m แทน"); DepthUsed = 2.0; }
```

**Which to use when**

| Need | Use |
|---|---|
| Clamp a value the user enters to a range (`Depth ≥ 2`) | Parameter table (min / max); simplest |
| A value depending on other values / ground / points, several cases, custom warning text | **Variable** |
| Make geometry **exist / not exist** by a condition | **Condition** (branch) |
| Several alternatives by a number (`ProtectionType`) | **Switch** |

### Logic tab

Result bar at the bottom, next to Points: all conditions + true / false / unknown values, **live while dragging the ground / editing parameters** · edit expressions · rename (expressions using the name follow) · delete (if a branch holds objects, asks: move to the parent branch / always occurs, or delete them · a condition still used in another expression cannot be deleted) · decision → branch tree with colours, occurs / does not, object count (click = select the objects), rename branch.

**"ตาราง" / "ข้อความ"** (round 5): buttons on the Logic tab switch to the **text view** = the whole structure as Thai pseudo-code (`Logic.toText`) with current values appended and updated live · **"คัดลอก"** button:

```
Conditions:
  IsCut = ground(P2) > P2.y                 ← ตอนนี้: จริง
เกิดเสมอ: P1, P2, P5 (aux), P6, L1
ถ้า IsCut:                                  [D1 ตัดหรือถม?]
    ตัด (B1): P3, L2, L4                    ← เกิดตอนนี้
ไม่ใช่:
    ถม (B2): P4, L3, L5
    ถ้า HighFill:                           [D2 ถมสูงไหม?]      ← elif
switch Curb:                                [D3 ขอบทาง]   ← ตอนนี้: 1
    = 1  มีขอบทาง (B5): P8, L7              ← เกิดตอนนี้
```

(`– (กิ่งแม่ไม่เกิด)` = a decision nested in a branch that does not occur, so it was not computed.)

### Scenario branch coverage

Each branch in the Logic tab says which scenarios enter it and shows ⚠ **"ยังไม่มี scenario ไหนเข้ากิ่ง …"** · the Scenarios list (left panel) appends the branches occurring in that case, computed from the current spec + the scenario's ground / parameters / Layout. (A subassembly with code uses its current origin position, approximately.)

### Rules for branches

- An object in a branch that does not occur = absent from Civil 3D (no warning) · things referencing a non-occurring point (from / a / b …) silently do not occur · referencing a non-occurring point in an expression (`P3.y`) = cannot be found + warning (ask `exists(P3)` first) · referencing a point of another branch shows ⚠ in Properties at design time.
- Named conditions can be used in other expressions, e.g. `if(IsCut, 1, 0)` · not computable (references a missing point) = unknown + warning → enters no branch.
- Point type **first that occurs, after branches** (`firstOf`): a list of points, e.g. `P3, P4` → uses the first that occurs, for continuing geometry after branches. As auxiliary = **real end**: it can also be the end of a real link (uses the first real point that occurs; round 4c, see [Extend to Surface](drawing-tools.md#extend-to-surface)), or link from the point in each branch yourself, e.g. `P3–P6` in cut, `P4–P6` in fill.

### Daylight Cut/Fill button

Drawer (formerly "ถ้าตัด / ถม"): ground higher than the hinge point → cut slope (up) · ground lower → fill slope (down), chosen by itself at every station. Click the hinge point (embankment shoulder / shoulder edge; must be a real drawn point) → dialog sets: cut slope (default = first slope button `1:1.5`), fill slope (second `1:2`), whether to create parameters `CutSlope` / `FillSlope`, direction, codes (`Daylight_Cut` / `Daylight_Fill`), target (if several surfaces) → all at once (one Ctrl+Z): condition `IsCut = ground(P2) > P2.y`, branches **"ตัด"** / **"ถม"**, one slope-to-ground point + slope link per branch, a **Daylight** point (first that occurs, auxiliary) for continuing geometry. Drag the ground point up / down and the drawing flips between cut / fill at once.

- **Definition of cut**: ground above the hinge = excavation = cut · ground exactly at the hinge / no ground (Layout, no target) = **fill**. For another definition (e.g. cut when the ground is more than 0.3 m higher), edit the expression in the slope point's Properties, row "เงื่อนไข IsCut".
- Can be repeated at other points: names do not clash (`IsCut2`, `CutSlope2`, branch "ตัด P6") · a hinge inside a branch = the new cut / fill set nests under that branch.
- A link continuing from a slope's end (e.g. a drainage ditch): link from each branch's slope point, or draw the next point from Daylight, then link from the slope point of each branch.

### Other notes

- **Web-generated files with hand edits outside the SA-DRAWING block** (imported to keep drawing): the drawn part within the block can use conditions / branches as in a new file (Save replaces only the block; your code stays) · if / else logic you wrote outside the block is not converted to branches (later round) · hand-written files with no SA-DRAWING block still cannot have the drawn part saved into them.
- **object → code line**: the Logic tab has a **"โค้ด"** button on conditions / decisions / branches → goes to the line computing the value · the cursor on a `bool B3 = …` line highlights that branch's objects on the drawing (those not occurring now highlight at their show-all-cases position).
- C#: `bool? IsCut = Cond(cs, "IsCut", () => …);` → `bool B1 = IsCut == true;` → `Pt? P3 = B1 ? … : null;` / `Point p3 = B1 ? AddPoint(…) : null;` / `if (B1) AddShape(…)` · switch: `double? D1 = Val(…)`, then branches compare with `Eq` (the `else` branch = matches no other) · the names `B1`, `D1`, `Cond`, `Val`, `V`, `FirstOf` are reserved.
