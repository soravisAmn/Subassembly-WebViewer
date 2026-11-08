# Screen, selection, shortcuts, view, undo

Thai labels in quotes are the text shown in the web.

## Screen layout

| Part | Where | Contents |
|---|---|---|
| Menu bar | Top | **"ไฟล์ ▾"** (Import .cs, new .cs, Open / Save project, Export scenarios), **"✎ แก้โค้ด"** |
| Workspace tree | Left | Workspace → Surface / Assembly → Subassembly → Points / Links / Shapes / Parameters · Scenarios |
| Workspace | Centre | Cross-section (dark CAD-style background) + result bar below (Messages / Log / Points of the selected item) |
| Drawer + Properties | Right | Drawing tools (usable in Edit mode) · values of the selection (parameters, values of drawn points are edited here) |
| Bottom bar | Bottom | Mouse coordinates, Grid, Grid snap (F9), Ortho (F8), preset slopes, OSNAP (F3) + `▾` type menu, point codes, VE, Fit, server status |

- **Drag the edge** of the left / right panel (↔ cursor + thin blue line) to resize (left 200–600 · right 240–600 · workspace keeps at least 320 px; if the screen / code panel takes the room, the panels are squeezed automatically) · **double-click the edge** = defaults 280 / 300 · remembered in the browser · long names in the tree are cut with `…`, hover for the full name · narrow screens (≤ 900 px) have no drag handle.
- Each side has **2 independently scrolling panes**: left = Workspace tree / Scenarios · right = Drawer / Properties (Properties can scroll however long it is).
  - **Drag the horizontal divider** to set the height of Scenarios / Drawer (the other pane keeps at least ~120 px) · double-click the divider = default (height fits content).
  - **Click the Drawer / Scenarios header** (▾ / ▸) to fold / unfold; when folded, the other pane gets all the space · heights and folding are remembered in the browser · on narrow screens the whole panel scrolls as before (no divider).
- **Dialogs** (Daylight Cut/Fill, Extend to Surface, Clipped Surface Link, Array, Import, Open project, Shortcut, etc.): **×** / **"ยกเลิก"** / **`Esc`** / clicking the dark background all cancel the same way: close the dialog + end the tool that opened it (nothing changes).
  - If a field has typed / pending edits, clicking the background does not close (a warning appears in the dialog; press × / "ยกเลิก" / Esc to discard) · small value boxes (Offset, Fillet, Move, etc.) have a **×** in their header = `Esc` for that box.
- **Click** in the tree or on the drawing = select (selected points / links / shapes turn orange on the drawing and their values appear in Properties). For multiple selection see [Selection](#selection-window--crossing).
- **Pan** = drag with the middle mouse button (AutoCAD-style) or hold `Space` and drag with the left button (touchpad) · wheel = zoom (see [View / zoom](#view--zoom)).
- **Right-click** a subassembly (tree or drawing): Edit, "✎ แก้โค้ด", Rename, Save as .cs, Move, Copy, Mirror, remove from assembly ("My Shapes" comes in phase two) · right-click a drawn point / link / shape: Move, Copy, delete.
- **Right-click** an assembly (or the ⊞ axis on the drawing): **ADD** (new subassembly, then enters Edit), Import .cs into this assembly, Rename, delete assembly.
- **Right-click** the Workspace / empty space: + new Assembly, Import .cs, Fit.
- **Edit mode**: a blue bar on top reads "กำลังแก้ X"; other items are dimmed and cannot be clicked / dragged · press **"ออกจาก Edit"** to go back (see [drawing-tools.md](drawing-tools.md)). The **Save (.cs)** button (or Ctrl+S) writes the drawn part to the file (see [code-generation.md](code-generation.md)).
- Ortho, preset slopes (click = lock, double-click = edit value) and OSNAP apply while drawing.
- All settings (workspace, expanded tree nodes, bottom bar) are remembered in the browser and survive a refresh. On the first run after an update the web migrates old data itself: the old assembly → Assembly 1, a file opened in single-file mode → one subassembly attached to the axis.

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

No shortcut works while typing in a field / the code panel / a dialog.

| Key | Action |
|---|---|
| `Ctrl+Z` / `Ctrl+Y`, `Ctrl+Shift+Z` | Undo / Redo |
| `Ctrl+S` | Save (.cs) during Edit / save the code panel |
| `Ctrl+E` | Code panel |
| `M` / `C` | Move / Copy |
| `R` | Rotate (Edit mode) · while giving the angle: `C` = rotate a copy · `R` = Reference |
| `B` | Draw into branch… (Edit mode): objects drawn from now on go into the chosen branch |
| `X` | Auxiliary: while drawing = toggle the mode of the piece to be created · with a selection = toggle the selected points / links (`Ctrl+X` = cut as usual) |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy / cut / paste |
| `Delete` | Delete the selection |
| `Ctrl+A` | Select all |
| `Esc` | Cancel command / tool / selection |
| `Enter` / right-click | Finish selecting (Move / Copy) · finish Copy · finish line |
| `P` / `L` / `S` | Point / Link / Shape tools (Edit mode) |
| `C` (while drawing a Polygon) | Close a free Polygon (≥ 3 points); otherwise `C` = Copy |
| `T` / `E` (while drawing an Arc) | Arc by 3 points / start-end-radius |
| `I` / `O` | Intersect / Offset tools (Edit mode) |
| `T` / `N` (Intersect waiting for a choice) | Trim / extend lines to the intersection · no trim (intersection point only) |
| `Tab` | Next snap (when several) / type a value |
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
- Covers every action that changes the work: drawing, deleting, editing values in Properties (point values, codes, parameters, parameter table, Datum, Corridor/Layout), dragging / adding / deleting surface points, shifting the whole surface line, moving / attaching / mirroring / adding / removing subassemblies, moving the assembly axis, adding / deleting assemblies, loading a scenario / project.
- **1 action = 1 step**: a continuous drag = one step (counted on mouse release) · typing in a Properties field = one step per field (counted on leaving the field) · deleting several = one step.
- The notice bar on top shows what was undone, e.g. `Undo: ย้ายแกน Assembly 1`, `Undo: แก้ dx · pavement-assembly.cs · P6`, `Undo: ลบ 3 objects`.
- **Not undone**: saving a .cs file / project (a file written to disk is not changed back; undo and Save again if needed), view (zoom / pan), selection, bottom-bar buttons, entering / leaving Edit · Undo history is lost on page refresh.
- While typing in a field / the code panel, `Ctrl+Z` = that field's own undo (as before).
- **`Delete`** (or the Delete button in Properties): Edit mode = delete the selected points / links / shapes · outside Edit = remove the selected subassembly (items attached to it float where they are) · a selected surface point = delete that point. If something depends on what is being deleted (links / shapes / referencing points), the list of what will also disappear is shown for confirmation first.

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
