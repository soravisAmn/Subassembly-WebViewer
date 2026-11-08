# Drawing tools (Edit mode)

Thai labels in quotes are the text shown in the web. Arrays and Loops are in [array-loop.md](array-loop.md), conditions in [logic.md](logic.md), parameters in [parameters.md](parameters.md).

Right-click a subassembly → **Edit** (or right-click an assembly → **ADD** = a new empty subassembly with point P1 at the origin).

| Tool (Drawer) | Key | Use |
|---|---|---|
| Point | `P` | Click to place a point (referenced from the selected point; nothing selected = from the origin) |
| Link | `L` | Keep clicking = polyline · end points are created automatically · clicking an existing point reuses it · right-click / `Enter` = finish the line |
| Shape | `S` | Click the points around the shape in order, then the first point (or `Enter`) = close · missing links are created |
| Polygon | | Click points around the shape · first point / `C` / `Enter` = close (links + shape); see [Polygon](#polygon) |
| Regular Polygon | | Click the centre, drag radius / angle, click = create · `Tab` = type N / R / θ |
| Arc | (`T` / `E` while drawing) | 3 points: start → through → end · start-end-radius: start → end → drag to choose the curve; see [Arc / Fillet](#arc--fillet) |
| Fillet | | Set the radius (`Tab` / type a number), then click 2 links meeting at a corner |
| Intersect | `I` | Click 2 straight links → choose `T` trim / extend lines to end at the intersection, or `N` no trim (intersection point only); see [Intersect / Offset](#intersect--offset) |
| Array | | Select objects first (click / box), then press the button → dialog: number of sets, dx, dy, joining (shared point / link); see [array-loop.md](array-loop.md) |
| Offset | `O` | Set the distance (`Tab` / type a number) → click a straight link → click a side = parallel line (2 points + link) |
| Slope to Surface | | Click the start point, move the mouse to choose direction, click = daylight point (slope from the locked button in the bottom bar; none locked = 1:2) |
| Clipped Surface Link | | Click start → end → reference line (straight link · `Tab` = fixed level) → dialog ("ไม่สูงกว่า" / "ไม่ต่ำกว่า", 3 sets of codes); see [Clipped Surface Link](#clipped-surface-link) |
| Extend to Surface | | Click a straight link near the end to extend → confirmation dialog (extension link / point codes, maximum distance, move links connected there to the real end); see [Extend to Surface](#extend-to-surface) |
| Follow Surface | | Click start, then end = a link that follows the ground (with ground break points along the way) |
| Daylight Cut/Fill | | Click the hinge point (or select one point, then the button) → dialog (explanation + picture of hill / low ground) sets cut slope / fill slope / codes → creates the whole set; see [logic.md](logic.md#daylight-cutfill-button) |

- While dragging, a tooltip shows slope (1:x and %), length, dx / dy and snap type.
- **Type values instead of clicking** (Dynamic Input style): type a digit / `-` / `.` directly, or press **`Tab`** (when there is no snap to cycle). Fields dx, dy, slope (`1:2` accepted, up/down follows the mouse), length; empty fields use the mouse value · parameter names / expressions are accepted (invalid = red).
- **Ortho** (`F8`) locks horizontal / vertical · **preset slopes** lock the angle · **Grid snap** (`F9`) rounds dx / dy / along-slope distance of free points in 0.05 m steps (double-click the button to set the spacing, down to 0.001 m). Also applies when dragging surface points / the axis / floating subassemblies · **not an object snap**.
- **OSNAP** like AutoCAD's status bar: `OSNAP (F3)` button = all on / off · the **`▾`** next to it (or **right-click the OSNAP button**) = snap type menu.
  - The menu has checkboxes + the same marker icons as on screen · several can be ticked without closing · click outside / `Esc` = close · **select all / clear all** available.
  - Changes take effect at the current mouse position · the choice is remembered across page loads · hovering the OSNAP button shows the enabled types in a tooltip.
  - At the end of the menu: **Object snap tracking (F11)** + the hover-time field (default 0.5 s).
  - All drawing tools and Move / Copy / Paste locations use the same set.

  | Marker | Type | Snaps to |
  |---|---|---|
  | □ square | Endpoint | Drawn points / points from existing code / origin |
  | △ triangle | Midpoint | Link midpoint |
  | ◯ circle with cross | Center | Centre of a regular polygon / arc · a polygon centre is already a point, so both Endpoint and Center appear (`Tab` cycles) |
  | ✕ cross | Intersection | Intersection of 2 links (not joined at their ends) |
  | ⊠ square with cross | Slope to ground | With a locked slope + Surface on: where the slope from the previous point hits the ground (catches from 2.5× farther) |
  | ⊥ right angle | Perpendicular | Perpendicular from the previous point to a link |
  | ⧗ hourglass | Nearest | Point on a link nearest the mouse |
  | ground line with tick | Surface | Point on the ground nearest the mouse |

  - The snap **nearest the mouse** within 12 px wins · on a tie, Endpoint wins.
  - Nearest and Surface are fallbacks, used only when no other snap type is within the radius (like AutoCAD's Nearest; otherwise they would always win by being right under the mouse).
  - Several in the radius (label shows `(1/3)`) → **`Tab` = next one**, AutoCAD-style · moving the mouse until the list changes restarts at the nearest.
  - With Endpoint / OSNAP off, clicking on an existing point creates a **new point** at the same place (AutoCAD-style), not the existing one.
  - Base point / destination of Move / Copy / Paste use the same snaps · a drawn point still cannot be dragged directly with the mouse (use `M`).
  - Snap selection logic is in `js/snap.js` (no screen access); test with `node SA.Tests/js/snap.test.js`.
- `Ctrl+Z` / `Ctrl+Y` = Undo / Redo ([screen.md](screen.md#undo--redo-and-delete)) · `Delete` = delete the selection · `Esc` = cancel the line / leave the tool.
- Middle-mouse drag or `Space` + drag = pan (works while drawing) · wheel = zoom.

## Object snap tracking (F11)

Like AutoCAD's OTRACK; available whenever a location is being picked: drawing tools and base point / destination of Move / Copy / Paste. (On/off with `F11` or the `▾` menu by the OSNAP button · OSNAP must be on.)

1. **Hover** on a snap point (Endpoint, Center, Intersection, Midpoint, Perpendicular) for about 0.5 s = **acquire** it; a cyan `+` appears.
   - Hovering again on an acquired point = release · up to 7 points · the most recently acquired (bold `+`) = the **main reference point**.
2. Move the mouse to line up **vertically / horizontally** with an acquired point → a dashed tracking line appears and it snaps on that line (label e.g. "แนวดิ่งจาก P3").
   - The intersection of a vertical from one point with a horizontal from another also snaps (before single lines) · Grid snap rounds the distance along the line · `Tab` cycles.
   - Order: exact OSNAP snaps → tracking lines → Nearest / Surface.
3. **Just type a number** (or `Tab` when there is no snap to cycle) = dx dy box **measured from the main reference point** (box header says "อ้างจาก P3 (Tracking)").
   - The dx field accepts **distance<angle**, e.g. `5<30`, `Width<Ang+90` (screen angle, counter-clockwise from +x) = a "distance + angle" point.
4. **`Esc`** = clear all acquired points (press again = cancel as usual) · changing / ending a tool or command clears them.

**The new point is tied to the acquired point** (not fixed coordinates): stored as "distance from point" (or "distance + angle") with `from` = the acquired point. An acquired location that is not yet a point in the spec (midpoint, intersection, centre, point from existing code) is created as an **auxiliary point** the first time and reused → when the parent moves (parameter / surface) the new point follows · during Move / Copy / Paste only the position is used (moving works as before). Logic is in `js/track.js`; test with `node SA.Tests/js/track.test.js`.

## Polygon

- **Free Polygon**: like Link but closable. Click the first point (with ≥ 3 points) or press **`C`** or **`Enter`** = link back to the first point + create a shape. While drawing you see the fill + a dashed closing line · OSNAP / Tracking / typed values work as with Link · everything is one Undo step per click.
- **Regular Polygon** (like AutoCAD's POLYGON): click the centre → drag = radius + rotation (Ortho = locks in 90° steps) → click = create.
  - **`Tab`** = value box: **N** (3–24), tick **"ถึงกึ่งกลางด้าน"** (to edge midpoint), **R** and **θ** (number / parameter name / expression) · empty = mouse value.
  - The **`+`** button by R / θ = create a new parameter (named `R`, `Theta`, …) with default = the field's current value, then the field uses that name (SAC-style).
  - Before clicking the centre, `Tab` = set N / mode or type dx dy of the centre · N / mode are remembered for next time.
  - **θ** is in the Side = Right frame: θ = 0 → first vertex on top (to-edge-midpoint: first edge midpoint on top) · Left is a mirror image.
  - A centre not snapped to an existing point = **auxiliary point** (not in Civil 3D) · vertices are ordinary **polar** points from the centre: angle = `θ + 90 + i·360/N` (non-terminating divisions stay as fractions, e.g. `90 + 360 * 1 / 7`, no rounding) · distance = `R` or `R / cos(180/N)` (to edge midpoint).
  - **Properties** of a vertex / link / shape / centre has a **"Polygon ด้านเท่า G1"** group: edit **N** (creates new vertices; refused, with names, if something else references existing vertices / links), **R / θ** (shape changes at once, vertex ids stay), **mode**, `+` button creates a parameter · link / shape codes are kept when N changes.
  - Move / Copy: selecting any piece takes the whole shape + centre (moving edits only the centre; vertices follow) · a copy becomes a new polygon (G2) that can still have N / R / θ edited.
  - Deleting a vertex leaves ordinary points / links (the polygon data is gone).

## Arc / Fillet

Civil 3D links are **straight only**, so one curve in the spec becomes **intermediate points (no code) + straight link segments** (the curve's codes on every segment) in the C#, as stock subassemblies do. The segment count is computed at run time in Civil 3D (changes with parameters) · default **segment length (along the curve) at most 0.05 m** · limited to **2–180 segments**. Editable in the link's Properties: **"แบ่งโค้ง"** = maximum segment length (m) or number of segments (expression allowed) · Properties also tells how many links / points Civil 3D will get.

- **3-point Arc** (press `T` during the Arc tool): click start → through → end. A through point clicked on empty space / on a snap that is not an existing point = **auxiliary point** (not in Civil 3D) · dx dy / Tracking / snap work on all points · 3 collinear points = warning + straight line.
- **Start-end-radius Arc** (press `E`): click start → end → **drag** (the curve passes through the mouse; ghost + tooltip with radius / direction / long way), then click.
  - `Tab` while dragging = value box: **R** (expression / parameter, `+` button creates a parameter) + tick **"ตามเข็ม"** (clockwise) / **"ทางยาว (> 180°)"**.
  - Direction is stored in the Side = Right frame (Left mirrors, reversing by itself) · radius less than half the start-end distance = warning + straight line (no error).
  - Properties: radius, direction, short / long way · a straight link can be converted to a radius arc from the **"ชนิด"** field.
- **Fillet**: set the radius first (`Tab` or type a number; the banner shows the current value) → click link 1 → link 2 meeting at corner P (the hovered line glows).
  - Creates **tangent points T1, T2** (point type `tangent`: on the line at R / tan(α/2) from the corner) · original links A–P, P–B become A–T1, **Fillet T1→T2**, T2–B (same ids).
  - Shapes using the original links get the Fillet inserted in order · if P has no other links it becomes auxiliary (unless P has a point code: it stays a real point so the code is not lost).
  - **R too large so the tangent points pass the line ends / parallel lines** = at run time a warning (RecordError warning) + the original sharp corner (no crash).
  - Edit the radius on the Fillet link or either tangent point; all three change together · several Fillets on the same shape work · straight links only.
  - The tool stays on for the next corner (Esc = finish).
- **Snaps on arcs**: Endpoint at the ends · Nearest / Perpendicular / Intersection on segments · **Midpoint** of the whole arc · **Center** at the centre. (Points obtained from a snap on an arc / arc midpoint / arc centre are **fixed values** of the click position; there is no "on arc" point type yet · Center = auxiliary point.)
- Move / Copy: selecting an arc link includes its through / corner point · tangent points follow the corner and lines · deleting a through / corner point deletes the arc.

## Intersect / Offset

- **Intersect** (`I`): click straight link 1 → 2 (hovered line glows) → **a choice dialog appears every time** (no default; `Enter` does not choose):
  - `T` **trim / extend to the intersection**: each line **keeps the end on the side you clicked** (relative to the intersection); the other end is replaced by the intersection · an intersection beyond the line end extends the line. The original end still exists (the intersection is computed from it); with no other links it becomes auxiliary · with a point code it stays real + a notice (like Fillet).
  - `N` **no trim**: only the intersection point (type **"จุดตัดของ 2 เส้น"**), lines unchanged · `X` = make the intersection Auxiliary (only with no-trim; after trimming it is the end of a real link).
  - `Esc` = cancel · parallel / already joined at the same point / not straight = reason given, nothing created.
  - At run time parallel lines = no intersection + warning (no crash), in both web and C#.
- **Offset** (`O`): set the distance first (`Tab` / type; expression / parameter name allowed, e.g. `RockThickness`, `+` creates a parameter) → click a straight link → move the mouse to see the parallel ghost → click a side = **2 Offset points + a new link** · the tool stays on for more lines (`Esc` = finish), like AutoCAD's OFFSET.
  - Point type **Offset (parallel line)**: end a / b of line a→b shifted perpendicular by `distance` · side = left / right of direction a→b **in the Side = Right frame** (Left mirrors).
  - Auxiliary **only when `X` is pressed** (does not follow the original line) · the branch follows the original line · editing distance / side in Properties of either point also edits its mate (stays parallel).
  - Zero-length original line = no direction + warning · Move: follows when both ends of the original line move.
  - Result matches `ParallelY` of `body_rock-pitching.cs` (line parallel to the rock face, perpendicular depth RockThickness; test `offset.test.js`).
- Generated C#: `Pt? P3 = Offset(cs, "P3", P1, P2, P1, F * -1.0 * RockThickness);` · intersections use the existing `Intersect(...)`.

## Extend to Surface

Extends a line down to the ground **only when its end floats above the ground**, like `extendOutside` of `base_rock-pitching.cs` / the end-closing line at O of `body_rock-pitching.cs`.

- **Extend to Surface** button (Surface group) → click a straight link **near the end to extend** (a circle at the end + extension ghost on hover) → dialog: extension link code (normally the original link's code), ground point code, **"ไม่ชนดินใน"** (horizontal distance in m; expression / parameter allowed), tick **"ย้ายเส้นอื่นที่ต่อที่ปลายนี้ไปต่อที่ปลายจริง"** (normally ticked).
- It creates 3 things:
  - A point of type **extend to ground** (`extendToGround`: from = the end being extended, along = the other end of the line), continuing along → from until it hits the ground.
    - Floating (ground at the end's x is lower than the end) = extend · **not floating / Layout / no Target Surface = does not occur, no warning** (like an object in an inactive branch; Properties says "ปลายไม่ลอยเหนือดิน").
    - Floating but does not hit the ground within the set distance / extends upward / surface too short = warning + no extension.
  - An **extension link** (original end → ground point) flagged **optional**: in a shape, if it does not occur / cannot be drawn, it is simply skipped (tick / untick in the link's Properties).
  - A **real end** point (first that occurs in [ground point, original end] · auxiliary) that **can be the end of a real link** (uses the first real point that occurs; C#: `Point p6 = P6 == null ? null : (P5 != null ? p5 : P3 != null ? p3 : null);`). It works when all listed points are real (an aux point = skipped + warning like an aux end) · a first-that-occurs point that is **not** auxiliary = an ordinary point (Points.Add as before).
- Shapes using the original line: the extension link is inserted after it + the next edge starts at the real end → **one shape closes both with and without the extension** (no need for 2 branches).
- The branch follows the original line (no "draw into branch") · an auxiliary original line = new items are auxiliary and real links are not moved · Move: the extension point does not move (depends on the ground).
- C#: `Pt? P5 = ExtendToGround(cs, "P5", surface, P3, P2, MaxExt);` · shapes use `Join(..., Opt(l5), ...)` (`Opt` = skip when null).

## Clipped Surface Link

A link that **follows the ground but does not pass a reference line** = a bottom edge like `BuildBottom` of `base_rock-pitching.cs` (`min(ground, base level)`); tested directly against that file's formula (`clip.test.js`).

- **Clipped Surface Link** button (Surface group) → click the **start** → **end** (drawn points; the real end of Extend to Surface works) → click the **reference line** (a straight link, normally the auxiliary base line between base corners; extends both ways) or press `Tab` for a **fixed level** (expression relative to the origin, e.g. `-Depth`) → dialog: **"ไม่สูงกว่า"** (bottom edge) / **"ไม่ต่ำกว่า"**, codes for all stretches / on-ground stretches / on-line stretches (e.g. `Datum` / `TrapOnSurface` / `TrapBase`).
- Path: ground from start to end (ground break points) → clipped by the reference line (`min` / `max`) + **points where the ground crosses the line** → removes duplicate points (< 0.0001 m) and middle points of on-line stretches → both ends = the real start / end points.
- In Civil 3D = **several links** (like arcs) + intermediate points (no code) · a segment with both ends on the line = all-stretch codes + on-line codes · otherwise = all-stretch codes + on-ground codes.
- No ground: Layout = straight line (no warning) · no Target Surface = straight line + warning · vertical reference line / ground out of range = straight line + warning (on-line codes).
- Link Properties: change reference line / level, side, stretch codes + how many links Civil 3D gets (on ground / on line).
- Deleting the reference line deletes this link too (asks first) · copying together with the reference line uses the copy · Extend to Surface can move the start / end to the real end.
- spec: `{ type: "followClipped", from, to, target, refLink | refLevel, side: "below" | "above", codes, codesGround, codesLine }`
- C#: `Link[] l3 = FollowClipped(cs, "L3", surface, P6, p6, P8, p8, P3, P4, true, new[] { "Datum" }, new[] { "TrapOnSurface" }, new[] { "TrapBase" });`

## Point types: everything is stored as meaning

**Everything drawn is stored as its "meaning"**, not just coordinates. For example, a point drawn at slope 1:2 from P2 is stored as `ลาด -1/2 จาก P2 ยาว 2.236`. Changing a parameter or the surface changes the drawing at once · view / edit the meaning in the point's Properties:

| Point type | Meaning |
|---|---|
| Origin | The origin (0, 0) |
| Distance from point (dx, dy) ("ห่างจากจุด") | dx outward (+), dy up (+) from the chosen point |
| Distance + angle (polar) | At `distance`, angle `angle` (degrees counter-clockwise from +x in the Side = Right frame; Left mirrors) · both fields can be expressions |
| Slope + length ("ลาด + ความยาว") | slope = dy/dx (down = negative) outward / inward, length along the slope / horizontal / vertical |
| Slope to ground ("ลาดจนชนดิน") | Slopes until it hits Target Surface · not hit within the set distance = stops + warning · Layout / no ground = fixed length |
| On ground ("บนผิวดิน") | Ground level at dx from the chosen point |
| On a line between 2 points | Ratio t (0.5 = midpoint) |
| Intersection of 2 lines | Intersection of lines a1-a2 and b1-b2 |
| Extend to ground (Extend to Surface) | Continues along → from past from until it hits the ground, when from floats above it · not floating / no ground = does not occur (no warning) |
| Offset (parallel line) | End a / b of line a→b shifted perpendicular by `distance` (expression) to the left / right of direction a→b in the Side = Right frame · the Offset tool creates pairs |
| Point from existing code | A point of the file's code, found by point code (not found = warning, things depending on it are skipped) |
| Tangent (Fillet) | On the line corner→`towards`, at R / tan(α/2) from the corner (α = angle between the lines) · created only by the Fillet tool |

`firstOf` and `lastOf` are in [logic.md](logic.md) and [array-loop.md](array-loop.md).

## Auxiliary (SAC-style construction objects)

Points / links that help construction: **computed / referenced / snappable**, but **not exported to Civil 3D** (the C# does not call `Points.Add` / `Links.Add`, so they do not appear in the assembly / corridor). (Earlier versions called them "จุดช่วยสร้าง" `construction: true`; old specs / files open and convert to `auxiliary: true`.)

- **How to set**
  - **`X` while drawing** (Point / Link / Polygon / Regular Polygon / Arc / Fillet) = toggle the mode of the piece about to be created; banner shows **◇ AUXILIARY** in grey dashes. New points / links are aux (existing snapped points do not change) · aux Polygon = outline with no shape · aux Fillet = arc + tangent construction points laid over the corner (original lines / shape unchanged).
  - **`X` outside a command** = toggle the selected points / links (any real ones mixed in = all become aux · all aux = all become real) · **Auxiliary (X)** button in Properties for multiple selection.
  - **Right-click** → **"ทำเป็น Auxiliary"** / **"ทำเป็นของจริง"** (clicking a piece in the selected set = the whole set).
  - Tick **"Auxiliary (ช่วยสร้าง)"** in a point / link's Properties (straight, follow-ground, all arc types).
  - Automatically aux: Tracking reference points, regular polygon centres, 3-point Arc through points, Fillet original corners, rotation pivots.
- **Appearance**: point = grey cross, link = thin grey dashes, faded labels · left tree: grey italic name + "aux" tag, mixed with real objects in drawing order.
- **Bottom bar**: **Aux** button = show / hide all auxiliary objects (hidden = **no snapping / box select** and dropped from the selection · remembered · default shown) · **"ดูแบบ Civil 3D"** button = hides auxiliaries + skipped links, showing only what is really exported.
- **Auxiliary links** connect to both real and aux points · every snap type works (Endpoint, Midpoint, Intersection with real lines, Perpendicular, Nearest, Center of arcs). E.g. draw 2 aux diagonals → snap their intersection → get a real (intersect) point that follows when parameters change.
- **A real link with an aux end** is not possible (Civil 3D has no such point): skipped + warning · drawn as a dashed red line · Properties has quick fixes **"ทำจุด Pn เป็นจุดจริง"** / **"ทำ link นี้เป็น Auxiliary"** (no silent change) · the Link tool will not start from an aux point.
- **Shapes cannot use aux links**: Shape / Polygon refuse aux link edges (with the reason) · a shape with an aux link = skipped + warning + quick fix.
- Ticking a real point used by real links → asks "ทำ link พวกนี้เป็น Auxiliary ด้วย" / cancel · ticking a link in a shape → asks "เอา link ออกจาก shape" / cancel · making a link real with an aux end → asks "ทำจุดปลายเป็นจุดจริงด้วย" (Cancel = the link only, then warning + quick fix).
- **Codes of aux objects are not exported**: the Codes field is disabled but **not cleared**; switching back to real restores them.
- Fillet between 2 aux links = arc + tangent points are aux · an aux Fillet with real lines = arc + tangent points are real.
- Move / Copy / Paste / Rotate / Delete / Undo keep the aux state · C#: aux points compute `Pt?` only · an aux link = comment line `// L5 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D` (clicking the object goes to this line) · no extra compiler warnings.
- `.cs` files saved by an earlier version with construction points: the first overwrite asks, because the comment text in the code changed (the drawing does not).

## Other notes on drawn parts

- `Side` = 1 (Left) flips the horizontal direction of the whole drawn part · Mirror works on drawn items too.
- The drawn part is stored in the project (Save project) and in the browser · it is written to the `.cs` file only when you press Save (.cs).
- Other subassemblies can attach to drawn points (using the result of running the generated C#) · in hand-written files with drawn additions, the additions cannot be attached to yet, and Save cannot write to a file with no SA-DRAWING block (Milestone 4 of round 1 was not done).

## Move / Copy / Paste

AutoCAD-style, in both **Edit mode** (drawn points / links / shapes) and **outside Edit mode** (whole subassemblies).

1. Select first, then press **`M`** (Move) / **`C`** (Copy), or press first, then select (click / box) and **Enter** (or right-click). (Move / Copy buttons in Properties for multiple selection and in the right-click menu also work.)
2. Click the **base point** → a **ghost** (dashed green) follows the mouse → click the **destination**.
   - **OSNAP** (Tab cycles), **Grid snap**, **Ortho** (F8), **slope lock** work as when drawing.
   - **Type a distance**: type a number directly, or **Tab** (when there is no snap to cycle) → dx, dy (on screen: right +, up +) or slope (`1:2`) + length along the slope · empty = mouse value.
   - **Copy** places repeatedly until **Enter** / **Esc** · **Esc** = cancel the command · each placement = 1 Undo step.
3. **`Ctrl+C`** / **`Ctrl+X`** = copy / cut the selection · **`Ctrl+V`** = paste (ghost follows the mouse at once; base point = bottom-left corner of the copied set). In a field / the code panel these are normal text copy.

**Moving without breaking the meaning (Edit mode)**: the spec stores what a point means.

| Point in the selected set | Effect of moving |
|---|---|
| Distance (dx, dy) from a point outside the set / origin = **root** | dx / dy are edited; expressions referencing a parameter are **appended to**, e.g. `Width` → `Width + 1.25` (repeated moves combine constants: `Width + 0.5`) |
| Already follows moved points (dx,dy / slope from a point in the set, on-line / intersection with all ends moved) | Follows by itself, no edit |
| Slope + length that is a root | Converted to dx, dy distances at the new position (the old slope line no longer passes through it) |
| Slope to ground, on ground, on-line / intersection of unmoved points, points from existing code, origin | **Not moved**: the notice bar says which point and why + a button **"แปลงเป็นระยะคงที่ (delta) แล้วย้าย"** (origin cannot move) |

- Points **outside** the set that reference moved points also move (visible in the ghost, tooltip says "ขยับตาม …"). Unlike AutoCAD, which moves only the selection, but this way the drawing does not break.
- **Copy**: the copy gets new ids · relations inside the set reference each other, those referencing points outside the set keep the originals · codes come along (duplicates are allowed as in Civil 3D; the tree shows "code ซ้ำ").
- **Paste across subassemblies** (Ctrl+C in one → Edit another → Ctrl+V): points referencing things outside the set / origin / points from existing code / expressions using parameters the new item lacks are converted to fixed distances from the new item's origin · drawn parts paste only in Edit mode, subassemblies only outside it.
- **Outside Edit mode**: Move = moves the attachment as when dragging (origin landing near the axis / another item's point = attach, otherwise float) · items attached to it follow · Copy / Paste = copies (same `.cs`, same parameters; an item with no file yet gets a `-copy.cs` file name).
- Logic is in `js/ops.js` (no screen access); test with `node SA.Tests/js/ops.test.js`.
- **Moving / copying rotated things**: selecting any point in a rotation group takes the whole group · if the pivot was not moved along, a new pivot is used (an auxiliary point offset from the old one by the move distance) with the same angle.

## Rotate (R)

Edit mode, like AutoCAD's ROTATE, with the same structure as Move / Copy:

1. Select objects and press **`R`** (or `R` first, then select + Enter · the Rotate button in Properties / the right-click menu also works).
2. Click the **pivot** (base point; OSNAP / Tracking work).
3. **Drag** = angle (ghost rotates for real · positive = counter-clockwise on screen · empty space rounds to 1° · Ortho = 90° steps · pointing at a snap = angle exactly toward that point), then click. Or **type a number / Tab** = angle field: number / **expression / parameter name** (SAC-style) + `+` button creates a new parameter + tick Copy.
   - Options while giving the angle (like AutoCAD's prompt): **`C`** = rotate a copy (the original stays) · **`R`** = Reference: click 2 points (or Tab to type) = reference angle, then drag / type the **new angle** → rotation = new − reference (a reference angle typed as parameters is stored as an expression, e.g. `(Ang2) - (Ang1)`).

**Stored in the spec as a "rotation group"** (`spec.rotations = [{ id, pivot, angle, points }]`), not converted to fixed coordinates:
- Points in the group are computed by their original meaning (dx / dy / slope, etc. **in the pre-rotation frame**; a point's Properties show the original values), then rotated around the pivot by the group's angle.
- Points outside the group referencing points inside see the rotated position (they shift, they do not rotate) · links / shapes with one end rotated stretch accordingly.
- The pivot is a point in the spec: snapping an existing point = uses it · another snap / empty space = a new auxiliary point · if the pivot references a point in the group (e.g. a midpoint of members), it sees the pre-rotation value = really rotates around that point.
- The angle is stored in the Side = Right frame (counter-clockwise +) · **on Left the sign flips by itself** (correct mirror) · C#: compute the `Pt?` first, then `P5 = Rotate(cs, "P5", P5, pivot, F * angle)` before points that reference it.
- **Properties** (select a point / link / shape in the group, or the pivot): group **"กลุ่มหมุน R1"**: edit **angle** (expression + `+` button), change the **pivot**, **select whole group**, **"เลิกหมุน"** (points go back) · the tree shows "หมุน R1".
- **Rotating again**: whole group + the same pivot = adds to the same group's angle (`Ang` → `Ang + 15`) · another pivot = adds the angle + the group's pivot rotates too (only for groups whose members reference each other / the group's pivot; otherwise the reason is given) · selecting only some points of a group = those are not rotated.
- **Points that cannot rotate** (warned and skipped, same set as Move): slope to ground, on ground, points from existing code, origin, on-line / intersection / tangent of unrotated points. The notice bar lists names + reasons before clicking (no convert-to-fixed-then-rotate option yet) · points referencing the pivot can rotate (the pivot stays).
- Points outside the set lying "between" rotated points (e.g. P5 in the set references P4 outside, which references P3 in the set) are pulled into the group to prevent circular references.
- Logic: `Ops.rotatePlan` / `Ops.rotate` in `js/ops.js`; test with `node SA.Tests/js/rot.test.js`.
