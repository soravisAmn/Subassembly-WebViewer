# Screen, selection, shortcuts, view, undo

Thai labels in quotes are the text shown in the web.

## Screen layout

Round 9 shell (AutoCAD / Civil 3D style): title row + ribbon on top, dockable palettes around the workspace, status bar at the bottom.

```
┌ title row  [ไฟล์] [Save][Undo][Redo] │ project name *  folder ┐
├ tab row    Home  View  Annotate  Output  AI  │ Draw  Modify  Logic   (contextual, Edit only, teal) ┤
├ ribbon     panels of the active tab … [Finish: Save (.cs) | ออกจาก Edit] ┤
├ edit bar   "✎ กำลังแก้ X …" (only in Edit) ┤
├ palettes   Workspace / Scenarios │ workspace (centre) │ Properties / Code ; Messages · Log · Points · Logic · AI under the workspace ┤
└ status bar ┘
```

| Part | Contents |
|---|---|
| **ไฟล์** (application button) | Import .cs, new .cs from template, Open / Save / Save as / New / Pack project, recent projects, Build, Export / Import scenarios, ตั้งค่า… |
| **Quick Access** | Save project, Undo, Redo |
| **Home** | Project (New, Open, Save, Save as, Pack) · Import (Import .cs, New .cs) · Assembly (Edit, New assembly, Add subassembly, Mirror) · Surface (Add point `A`, Reset surface) · Clipboard (Cut, Copy, Paste, Delete, Select all) |
| **View** | Navigate (Fit `F`, Zoom selection `Z`) · Mode (Design / Civil 3D preview) · Show (Style, Annotations, Aux, Codes, Point names, Grid; Style = style by code on / off, Annotations = notes / dimensions / slope labels on / off, Point names = P1, P2 … outside Edit too (off by default); Civil 3D preview hides style / annotations / codes / point names and keeps the values; see [display.md](display.md)) · VE 1 / 2 / 5 · Scenario dropdown (same as clicking in Scenarios) · Palettes (one toggle per palette + Reset layout) |
| **Annotate** (always visible, round 10) | Note (Note, Note with leader) · Dimension (Horizontal, Vertical, Aligned; two points in different items = cross-item dimension in the project file) · Slope (Slope label) · Style (Style palette, สร้าง style จากสีที่เห็นตอนนี้, Open style file…). Works outside Edit; no single-letter keys. See [display.md](display.md) |
| **Output** | Build · Code (Edit code `Ctrl+E`, View generated code) · Scenarios (Export, Import) |
| **AI** | Proposals (opens the AI palette, count badge) · Claude (เชื่อม Claude = the steps of [connect-claude.md](connect-claude.md), connection status) |
| **Draw** (Edit) | Draw (Point `P`, Link `L`, Shape `S`, Polygon, Regular Polygon, Arc) · Surface (Slope to Surface, Follow Surface, Extend to Surface, Clipped Surface Link, Daylight Cut/Fill) · Construct (Intersect `I`, Offset `O`, Fillet, Array, Auxiliary `X`) |
| **Modify** (Edit) | Move `M`, Copy `C`, Rotate `R`, Delete |
| **Logic** (Edit) | Parameters (table in Properties), Variables (node in the Workspace tree), Conditions (Logic palette), Draw into branch `B`, ถ้าตัด / ถม (= Daylight Cut/Fill) |
| **Finish** (right end of Draw / Modify / Logic) | Save (.cs) `Ctrl+S`, ออกจาก Edit |
| Palettes | **Workspace** (tree) and **Scenarios** on the left · **Properties** on the right with **Style** as a tab behind it (round 10, [display.md](display.md)), **Code** opens as a tab next to it with `Ctrl+E` · **Messages / Log / Points / Logic / AI** as one tab group under the workspace (dark like the drawing; each says which subassembly it shows; counts on the tabs) |
| Workspace (centre) | Cross-section (dark CAD-style background); no tab, cannot be closed or floated; palettes dock beside it, never on it |
| Status bar | Mouse coordinates, Grid, Grid snap (F9), Ortho (F8), preset slopes, OSNAP (F3) + `▾` type menu, Aux, ดูแบบ Civil 3D, codes, VE, Fit, Claude status, server status |

- **Ribbon**: every button, the ไฟล์ menu, Quick Access, keys and the `?` table come from one command registry (`js/commands.js`). **Tooltip** = name, shortcut, one Thai line, and why the button is off (a click on an off button says it in the banner). View toggles (Aux, Codes, Grid, Civil 3D preview, VE) are the same state as the status-bar buttons.
- **Edit flow** (as Civil 3D): entering Edit (tree, right-click, Home › Edit, ADD) shows the teal Draw / Modify / Logic tabs and switches to Draw; leaving returns to the tab you were on.
- **Double-click a ribbon tab** = minimise / restore the ribbon (remembered on this machine); minimised, a click on a tab shows its panels over the drawing until a command runs or you click elsewhere. Narrow window: panels scroll sideways (never a second row), the title row drops the app name, then the folder.
- **Palettes** are moved by their tab: onto another palette's tab bar = tab together, to an edge = dock beside; **Shift + drag** a tab out = floating palette. Drag the border between palettes to resize (each keeps a minimum size, the workspace at least 320 px). **×** on a tab closes it; **View › Palettes** reopens / closes each palette and **Reset layout** puts everything back.
- The palette layout is remembered **per machine** (browser storage `sa.layout`); a layout saved by an older version or a broken one is ignored (default layout, no error). The Code palette follows the code panel of each browser tab.
- **Dialogs** (Daylight Cut/Fill, Extend to Surface, Clipped Surface Link, Array, Import, Open project, Shortcut, etc.): **×** / **"ยกเลิก"** / **`Esc`** / clicking the dark background all cancel the same way: close the dialog + end the tool that opened it (nothing changes).
  - If a field has typed / pending edits, clicking the background does not close (a warning appears in the dialog; press × / "ยกเลิก" / Esc to discard) · small value boxes (Offset, Fillet, Move, etc.) have a **×** in their header = `Esc` for that box.
- **Click** in the tree or on the drawing = select (selected points / links / shapes turn orange on the drawing and their values appear in Properties). For multiple selection see [Selection](#selection-window--crossing).
- **Pan** = drag with the middle mouse button (AutoCAD-style) or hold `Space` and drag with the left button (touchpad) · wheel = zoom (see [View / zoom](#view--zoom)).
- **Right-click** a subassembly (tree or drawing): Edit, "✎ แก้โค้ด", Rename, Save as .cs, Move, Copy, Mirror, remove from assembly · right-click a drawn point / link / shape: Move, Copy, Rotate, Auxiliary, delete. Entries that repeat a ribbon command take its name / shortcut from the registry.
- **Right-click** an assembly (or the ⊞ axis on the drawing): **ADD** (new subassembly, then enters Edit), Import .cs into this assembly, Rename, delete assembly.
- **Right-click** the Workspace / empty space: + new Assembly, Import .cs, Fit.
- **Edit mode**: a blue bar under the ribbon reads "กำลังแก้ X"; other items are dimmed and cannot be clicked / dragged · **Finish › ออกจาก Edit** goes back (see [drawing-tools.md](drawing-tools.md)). **Finish › Save (.cs)** (or Ctrl+S) writes the drawn part to the file (see [code-generation.md](code-generation.md)).
- Ortho, preset slopes (click = lock, double-click = edit value) and OSNAP apply while drawing.
- Workspace, expanded tree nodes, status bar and ribbon tab are remembered per browser tab and survive a refresh. On the first run after an update the web migrates old data itself: the old assembly → Assembly 1, a file opened in single-file mode → one subassembly attached to the axis; panel sizes of the layout before round 9 are dropped.

## Selection (Window / Crossing)

AutoCAD-style (as with PICKADD = add to the set):

| Action | Result |
|---|---|
| Drag the background **left → right** | **Window** (solid blue box): selects only objects entirely inside |
| Drag the background **right → left** | **Crossing** (dashed green box): selects objects touching the box |
| Click an object / box again | **Add** to the current set |
| `Shift` + click / box | **Remove** from the set |
| `Ctrl` + click in the tree | Add / remove (plain click in the tree = select one) |
| `Ctrl+A` | Select all |
| `Esc` / click empty space | Clear selection |

- **Edit mode**: selects only drawn points / links / shapes of the item being edited (starting a drag on an object is still a box select, it does not drag the object). Points / links from existing code can still be clicked to view values one at a time, but they do not join the set · the Point tool references the most recently selected point.
- **Outside Edit mode**: selects whole subassemblies · dragging a subassembly moves / attaches it as before. Clicking again on the only selected item selects a point / link / shape inside (view values in Properties).
- The selection is highlighted on the drawing and in the tree · Properties shows "เลือก N objects" by type, a list (click = select just that one, × = remove), and a **Codes** field that edits all pieces at once (Edit mode · one Ctrl+Z undoes it) · Move / Copy / Delete buttons work.
- **Different from AutoCAD**: AutoCAD starts a box by clicking empty space (2 clicks) and press-drag = lasso. Here only **press-drag = box**, and clicking empty space clears the selection, because dragging is what web mouse users expect and it needs no pending state between 2 clicks.
- The box logic is in `js/select.js` (no screen access); test with `node SA.Tests/js/select.test.js`.

## Shortcuts (press `?` or `F1` in the web for this table)

No shortcut works while typing in a field / the code panel / a dialog. The web's `?` table is generated from the command registry (`js/commands.js`, `HELP`): a new shortcut goes there, and `commands.test.js` fails if a key is missing from the table or used twice. Options inside a command (Arc T / E, Intersect T / N, Polygon C, Rotate C / R) beat general shortcuts.

| Key | Action |
|---|---|
| `Ctrl+Z` / `Ctrl+Y`, `Ctrl+Shift+Z` | Undo / Redo |
| `Ctrl+S` | Save (.cs) during Edit · outside Edit: the selected drawn item's `.cs` when it is unsaved (●) and the code panel has no focus · otherwise save the code panel |
| `Ctrl+E` | Code panel |
| `M` / `C` | Move / Copy |
| `R` | Rotate (Edit mode) · while giving the angle: `C` = rotate a copy · `R` = Reference |
| `B` | Draw into branch… (Edit mode): objects drawn from now on go into the chosen branch |
| `X` | Auxiliary: while drawing = toggle the mode of the piece to be created · with a selection = toggle the selected points / links (`Ctrl+X` = cut as usual) |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy / cut / paste |
| `Delete` | Delete the selection |
| `Ctrl+A` | Select all |
| `Esc` | Cancel command / tool / selection (also Dimension / Slope label) |
| `Enter` / right-click | Finish selecting (Move / Copy) · finish Copy · finish line |
| `P` / `L` / `S` | Point / Link / Shape tools (Edit mode) |
| `C` (while drawing a Polygon) | Close a free Polygon (≥ 3 points); otherwise `C` = Copy |
| `T` / `E` (while drawing an Arc) | Arc by 3 points / start-end-radius |
| `I` / `O` | Intersect / Offset tools (Edit mode) |
| `T` / `N` (Intersect waiting for a choice) | Trim / extend lines to the intersection · no trim (intersection point only) |
| `Tab` | Next snap (when several) / type a value · placing a dimension line: type its distance |
| digits / `-` / `.` | Type a value (while drawing) / a distance (while placing Move / Copy) · with an acquired point = measured from it · the dx field accepts `distance<angle` |
| `F3` / `F8` / `F9` | OSNAP / Ortho / Grid snap |
| `▾` / right-click the OSNAP button | Snap type menu |
| `F11` | Object snap tracking (on/off) · hover on a snap = acquire / release · `Esc` = clear acquired points |
| `F` | Fit (see everything) |
| `Z` | Zoom to selection (no selection = Fit) |
| `Shift` + wheel | Zoom in small steps |
| `A` | Add a point on the surface line |
| `?` / `F1` | Shortcut table |
| Middle-mouse drag / `Space` + drag · wheel | Pan · Zoom |

## View / zoom

- Wheel = zoom around the mouse position · **`Shift` + wheel = small steps** (for millimetre-level aiming).
- Zoom in to **20000 px/m** (1 cm ≈ 200 px, so 1 cm is comfortably visible) and out to 0.5 px/m (several kilometres).
- The grid spacing follows the zoom, down to 0.001 m · grid numbers have the decimals matching the spacing · mouse coordinates in the bottom bar show 1–3 decimals according to zoom.
- Line widths / markers / text / snap radius (12 px) stay constant at every zoom level.
- **`Z`** = zoom to the selection (point / link / shape / subassembly) · nothing selected = Fit (`F`).
- A zoom remembered in the browser is clamped to this range when the page opens · logic in `js/view.js`; test with `node SA.Tests/js/view.test.js`.

## Undo / Redo and Delete

- **`Ctrl+Z`** = Undo · **`Ctrl+Y`** or **`Ctrl+Shift+Z`** = Redo, everywhere (in and out of Edit mode), up to 200 steps.
- Covers every action that changes the work: drawing, deleting, editing values in Properties (point values, codes, parameters, parameter table, Datum, Corridor/Layout), dragging / adding / deleting surface points, shifting the whole surface line, moving / attaching / mirroring / adding / removing subassemblies, moving the assembly axis, adding / deleting assemblies, opening a project. Switching scenarios is not an undo step (round 8).
- **1 action = 1 step**: a continuous drag = one step (counted on mouse release) · typing in a Properties field = one step per field (counted on leaving the field) · deleting several = one step.
- The notice bar on top shows what was undone, e.g. `Undo: ย้ายแกน Assembly 1`, `Undo: แก้ dx · pavement-assembly.cs · P6`, `Undo: ลบ 3 objects`.
- **Not undone**: saving a .cs file / project (a file written to disk is not changed back; undo and Save again if needed), view (zoom / pan), selection, bottom-bar buttons, entering / leaving Edit · Undo history is lost on page refresh.
- While typing in a field / the code panel, `Ctrl+Z` = that field's own undo (as before).
- **`Delete`** (or the Delete button in Properties): Edit mode = delete the selected points / links / shapes · outside Edit = remove the selected subassembly (items attached to it float where they are) · a selected surface point = delete that point · a selected dimension / slope label = delete it (in or out of Edit). If something depends on what is being deleted (links / shapes / referencing points), the list of what will also disappear is shown for confirmation first.

## Differences from AutoCAD

| Topic | AutoCAD | Here | Reason |
|---|---|---|---|
| Clicking empty space | Starts a selection box (2 clicks) · press-drag = lasso | Press-drag = Window / Crossing box · click empty = clear selection | Dragging is familiar to web mouse users; no pending state between 2 clicks |
| Move point | Moves only the selection | Points outside the set that "follow" a moved point move too · points depending on the ground / another point's line do not move (with a button to convert to fixed distances) | The spec stores what a point means (e.g. distance from P3), not coordinates, so the drawing does not break and parameters keep controlling it |
| Move with expressions | — | `Width` moved 1.25 → `Width + 1.25` | A value that references a parameter must not silently become a number |
| `F11` | Object snap tracking | Same, but if the browser still toggles full screen, switch it from the `▾` menu | F11 is the browser's full-screen key; some browsers do not let a page block it |
| Ortho | `F8` forces every direction | Applies only to free points / Move destinations (snap comes first) | A snap tells what the point means (end, midpoint), which matters more than horizontal / vertical |
| Grid snap | Rounds coordinates to the grid | Rounds dx / dy / along-slope distance relative to the previous point | Spec values are distances from the previous point; round numbers read better |
| Commands | Type `MOVE` / `CO` in the command line | Single-letter keys `M` / `C` (no command line) | Agreed in round 2; an AutoCAD-style command line can be added later |
| Tab | Cycles snaps · Dynamic Input accepts digits directly | Same, but with one snap / no snap, Tab opens the value box | Tab originally meant "type a value"; kept when there is nothing to cycle |
| Undo | Works across Save | Works, but a saved file is not rewritten · lost on refresh | Writing to disk should happen only from pressing Save |
| Nearest / Surface | Normal snaps | Fallback, used when no other snap type is within the radius | It is always exactly under the mouse; as a normal snap it would win every time |
| ARC options | Typed on the command line (Center / End / Radius …) | 2 modes: 3 points (`T`) and start-end-radius (`E`) | No command line · these 2 are enough for cross-sections (agreed in round 3) |
| Curves in Civil 3D | — | Split into short straight links | The Civil 3D API has straight links only |
| ROTATE | Rotates object coordinates immediately | Stored as a rotation group (original meaning + angle) · angle editable later / can be a parameter | Lets parameters control the shape in Civil 3D and stays correct when Side flips |
| ROTATE Reference | Has a Points option for the new angle | New angle = direction from pivot to mouse (or typed) | Most common use; no extra clicks |
| FILLET | Ends after 1 corner (has Multiple) | The tool stays on for the next corner · R too large = still created, but at run time uses a sharp corner + warning | R can be a parameter; an oversized value may arise from changing values in Civil 3D, so it must not error |
