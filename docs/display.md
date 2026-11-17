# Web display: style, dimensions, slope labels, notes (round 10)

Everything here is **web only**. It never changes what Civil 3D draws: the generated C# body is byte-identical with or without display data, and a display-only change is not a parameter change for Build. In Civil 3D the user styles codes with a Code Set Style.

Round 10 is complete (M0-M4): style by code and per-object overrides (M1), dimensions and slope labels with the Annotate tab (M2), notes, cross-item dimensions, point names, Side / branch display and MCP (M3). Design: `docs/prompts/prompt-10-design.md`. Civil 3D check: `tests-civil3d/round10-checklist.md`.

Where each thing is stored:

| What | Stored in |
|---|---|
| Style by code (colour, linetype, weight, fill, hatch, marker, text size) | `{name}.style.json`, pointed at by the project file (`styleFile`) |
| Per-object override, dimensions, slope labels, notes of one subassembly | its `.cs` (sa-spec `display`) |
| Dimensions between two subassemblies | the project file (`.assembly.json`, `display`) |
| View › Show toggles | the project file / tab state with the other bottom-bar values (`bar`) |

## Style file `{name}.style.json`

```json
{ "version": 1,
  "codes": {
    "Top":   { "link": { "color": "#d9a441", "linetype": "solid", "weight": 0.50 } },
    "Rock":  { "shape": { "fill": "#7a6a55", "alpha": 0.35, "hatch": { "pattern": "GRAVEL", "scale": 1.0, "angle": 0, "color": "#c8b89a" } } },
    "Crest": { "point": { "marker": "triangle", "color": "#ff6b6b", "size": 7 } } },
  "text": { "size": 11 } }
```

| Kind | Field | Values | Default |
|---|---|---|---|
| link | `color` | `#rrggbb` | automatic colour of the code |
| link | `linetype` | `solid`, `dashed`, `center`, `hidden` | `solid` |
| link | `weight` | mm (0.13 … 2.00), drawn at a fixed screen width like LWDISPLAY (0.25 mm = 2.4 px) | 0.25 |
| shape | `fill`, `alpha` | `#rrggbb`, 0-1 | the workspace shape fill |
| shape | `hatch` | `{ pattern, scale, angle, color }` or a pattern name | none |
| point | `marker`, `color`, `size` | `square`, `circle`, `cross`, `triangle`, `none`; `#rrggbb`; px | square, 8 px |
| — | `text.size` | px, screen-constant size of all annotation text (dimensions, slope labels, notes) | 11 |

- Unknown keys are kept (later rounds add fields). A bad field is ignored with a warning in the status line; a broken file = automatic colours.
- The project file points at the style file with `styleFile` (relative path, may be outside the folder, e.g. a shared `DPT-standard.style.json`). No key = `{project}.style.json` beside the project file if it exists, else automatic colours. The key is written after **Save style** or **Open style file…** (then Save project). **Save project as…** keeps the same style file: the key is rebased to the new folder, and a default `{project}.style.json` that exists gets a key pointing at it (unsaved style edits follow too).
- A missing style file is listed in "ไฟล์หาย" and never blocks opening. **Pack** copies an outside style file into `ext\` (path rewritten in the zip only). See [projects.md](projects.md).
- Save style is separate from Save project (own `*` in the Style palette). A read-only tab cannot save it. Server: `GET /api/style?file=`, `POST /api/style/save` (only `*.style.json`, same path rules as the `.cs` files).

## Resolution order

One pure function, `Style.resolve(kind, codes, override, styleFile, opts)` in `js/style.js` (runs in node; reused by the icon generator in round 11):

1. the object's **override** (`spec.display.overrides[id]`), field by field;
2. the object's **codes in list order**, `Datum` skipped unless it is the only code: the first code that has an entry of this kind in the style file;
3. the **automatic colour** + defaults.

Overrides merge field by field: an override of only `linetype` keeps the colour of the code. The automatic colour is a palette index from a **stable hash of the code name** (same colour on every machine and session; before round 10 it depended on the order codes were met).

The workspace (drawn items, hand-written / generated results), the code legend and the AI proposal preview all use `resolveStyle()` (`js/stylepal.js`). App-owned looks stay as they are: auxiliary (grey dash), branch ghosts, selection / hover, errors.

Hand-written `.cs` (no sa-spec): style by code only (no overrides). Their points keep the small circle unless a point code has a style entry.

## Hatches

SOLID, ANSI31 (45° lines), ANSI37 (cross-hatch), AR-CONC (concrete dots / triangles), EARTH, GRAVEL, NONE. They are **approximations** of the AutoCAD patterns drawn as SVG `<pattern>` tiles in user space: they scale with zoom like a CAD hatch and pan with the drawing. No `.pat` import.

## Per-object override (Properties › Display)

For a selected drawn point / link / shape: **Style** = ByCode (default) or กำหนดเอง (custom values for that kind); **กลับไปใช้ ByCode** removes the override. Stored in the `.cs` (`display.overrides`), so the item becomes unsaved (●) until Save (.cs) (works outside Edit; Ctrl+S outside Edit saves the selected item when it is ●). Every change goes through the Logic API `setOverride` / `clearOverride` = one Undo step ([logic-api.md](logic-api.md)). Deleting an object deletes its override; Copy copies it. Auxiliary objects have no style.

`display` is written only when it holds something, so a spec without overrides stays byte-identical to before.

## Style palette

Dockable palette `Style` (default: a tab behind Properties on the right; View › Palettes › Style). Header: style file name + `*`. Buttons: **Save style**, **สร้าง style จากสีที่เห็นตอนนี้** (writes the colour each code shows now; codes that already have a link colour keep it), **Open style file…**. One block per code in the project (codes only in the style file are greyed): Link colour / linetype / weight, Shape fill / alpha / hatch (+ hatch colour), Point colour / marker / size. Bold label = set in the style file; `↺` = back to automatic for that kind; `×` = remove the code from the style file. Unsaved edits survive a reload of the tab.

## View › Show and Civil 3D preview

- **View › Show › Style** (`view.style`, stored with the bottom-bar values): off = automatic colours only (style file and overrides ignored, nothing deleted).
- **Civil 3D preview** (`view.c3d`): one neutral light grey for every link, the default shape fill, plain square points, no hatch (as Civil 3D with no Code Set Style). It keeps the Style toggle's value for when Design mode returns.
- **View › Show › Annotations** (`view.annot`, `state.bar.annot`, saved like the other bar values): off = notes, dimensions and slope labels hidden (not deleted). Civil 3D preview hides them too and keeps the toggle's value.
- **View › Show › Point names** (`view.ptnames`, `state.bar.ptnames`, off by default, M3): `P1`, `P2` … beside the real points of drawn items outside Edit too (in Edit the edited item always shows them), `#0`, `#1` … (point index) for hand-written / imported code. Codes (`view.codes`) stay as before (selected / edited item).
- **Civil 3D preview hides all four groups**: style (neutral colours), annotations (the items' and the project's), codes and point names, also the point ids shown while editing an item (decision 11); their toggle values are kept and come back with Design mode (one rule: `Display.showFlags(bar, showCodes)`).

## Dimensions and slope labels (M2)

Stored in the `.cs` (sa-spec `display.dims` / `display.slopes`), bound to **point / link ids**, never coordinates, so they follow parameters, scenarios, branches and Side:

```json
"display": {
  "dims":   [ { "id": "D1", "kind": "h", "a": "P2", "b": "P5", "offset": -1.2, "label": "auto", "decimals": 2 } ],
  "slopes": [ { "id": "G1", "link": "L3", "format": "auto" } ] }
```

- **Annotate tab** (always visible, between View and Output): Dimension › Horizontal / Vertical / Aligned, Slope › Slope label, Style › Style palette / สร้าง style จากสีที่เห็นตอนนี้ / Open style file…. No keyboard shortcuts.
- **Dimension** (like DIMLINEAR / DIMALIGNED): click point 1 → point 2 → click to place the dimension line (a preview follows the mouse). Picks snap to **real points of drawn items only** (point ids); elsewhere the banner says "ต้องเลือกจุด". `Tab` or a digit while placing = type the distance (m, sign = side). `Esc` or right-click cancels. Two points in different items = a cross-item dimension in the project file (M3, below). In Edit only the edited item can be picked.
- **Slope label**: click a straight link. Text is placed at the middle of the link, along it, upright.
- Works **outside Edit**; the item becomes unsaved (●) until Save (.cs) (Ctrl+S outside Edit saves the selected item). Every change is one Undo step through the Logic API (`addDim`, `addSlopeLabel`, `updateAnnotation`, `removeAnnotation`, [logic-api.md](logic-api.md)).
- **Value**: h = |dx|, v = |dy|, aligned = distance, from the evaluated points (current parameters / scenario / Side), `decimals` (default 2). **Label** `auto` adds `(Wcrest)` when one `delta` / `slopeLength` / `polar` definition joins the two points and the measured field is exactly that parameter name (`Wcrest/2` → no label; no auto label when either point is in a rotate group); or a picked parameter; or none.
- **Slope text**: `ratio` `1:2.00` (run / rise), `percent` `5.0%`, `auto` = ratio when steeper than 5 %, else percent. No sign (the direction is in the drawing).
- **offset** = distance of the dimension line from the middle of the two points (h: up +, v: outward +, aligned: left of a → b), stored in the Side = Right frame; Side Left mirrors the position. Text is never mirrored: it is centred on the dimension line, rotated with aligned dimensions and kept upright (−90° … 90°; vertical text reads from the right, as in AutoCAD).
- **Drawing**: extension lines (small gap at the point, a little past the line), arrows as one SVG `<marker>` (`orient="auto-start-reverse"`, checked in Chrome and Edge), screen-constant 1 px lines and `text.size` px text in the app colour `--ann` (app-owned, not from the style file). Drawn on top of the item's points.
- **Hidden** when a point / link does not exist in the current branch / scenario (no value), when View › Show › Annotations is off, and in Civil 3D preview.
- **Select**: click the text or the dimension line; double-click also opens Properties. **Properties › Display**: kind (h / v / aligned), ป้าย parameter (อัตโนมัติ / a parameter / ไม่แสดง), ทศนิยม 0–6, ระยะห่าง; slope: รูปแบบ (auto / 1:x / %); ลบ. **Drag** a dimension line = change `offset` only. **Delete** removes the selected annotation (in or out of Edit).
- **Cascades**: deleting a point / link deletes the annotations bound to it; Undo restores both. Delete in Edit names them in its confirmation ("… และ annotation D1, G1 ไปด้วย"); `removeObjects`, `removeDecision`, `removeCase` and `removeCondition` with `how: remove` list them in `warnings` ("Annotations removed with them: …", shown in the banner). Removing a parameter sets a label that named it back to `auto`; renaming a parameter renames the label (an explicit label is the user's choice, so it follows the name). Array / Loop with fewer sets removes annotations and overrides bound to members that no longer exist, with the same warning. Copy does not copy annotations.
- **Ids** `D1…`, `G1…`: never reused within an item. `display.seq` (`{ "D": 2, "G": 1 }`) keeps the highest number handed out; it stays after the annotations are removed (a spec never annotated has no `display`). Undo restores it with the spec.
- A hand-written `.cs` without an SA-DRAWING block cannot be saved, so it takes no annotations and no per-object override (the banner / Properties says why).

## Notes (M3)

```json
"notes": [ { "id": "N1", "text": "ระดับสัน +{Hcrest}", "at": { "point": "P4", "dx": 0.5, "dy": 0.8 }, "leader": "P4" } ]
```

- **Annotate › Note / Note with leader** (like MLEADER): click the anchor point (real points only; elsewhere "ต้องเลือกจุด") → click where the text goes → type in the inline box → Enter. Esc (or right-click) cancels. Note with leader draws a line with an arrow from the text to the anchor point. Stored in the `.cs` (the item becomes ●), one Undo step (`addNote`).
- **`{expression}`** in the text is replaced by its current value, using the same `Expr` as number fields: `{Hcrest}`, `{Wcrest*2}`, `{P3.y}`, variables. Up to 3 decimals, trailing zeros dropped. An unknown name, a bad expression or a non-number shows `{?}`. Renaming a parameter (Properties table or Logic API, both through `Logic.editParam`) / variable / condition renames it inside `{…}`; removing a parameter leaves the text (it shows `{?}`).
- **Position**: `dx` / `dy` from the anchor point, drawing units, Side = Right frame. Side Left mirrors the position; the text is never mirrored or rotated (it grows away from the point: left-aligned on the right side, right-aligned on the left side). The box takes one line; a line break from the Logic API / MCP gives several lines.
- **Select / edit**: click the text (double-click also opens Properties). **Properties › Display**: ข้อความ, ผูกกับจุด (a leader that pointed at the old anchor moves with it), เส้นชี้ (none / the anchor / another point), dx, dy, ลบ, and the text as shown now. **Drag** the text = `dx` / `dy` only. Delete removes it.
- Stored `leader` = a point id or `null`; the Logic API also takes `true` (= the anchor point) and `false` (= none).
- Removing the anchor point removes the note (named in the warning / confirmation); removing the leader point only removes the leader.

## Cross-item dimensions (M3)

A dimension whose two points are in **different subassemblies** (e.g. total width of body + base) is stored in the **project file**, not in a `.cs` (decision 4):

```json
"display": { "dims": [ { "id": "D1", "kind": "h", "a": { "item": "i1", "point": "P1" }, "b": { "item": "i2", "point": "P5" },
                         "offset": 1.5, "label": "auto", "decimals": 2 } ], "seq": { "D": 1 } }
```

- Same command as M2: pick a point of one item, then a point of another item (outside Edit; in Edit only the edited item can be picked). The banner says "จุดของอีกตัว = เก็บในไฟล์ project". The project gets `*` (Save project), not the items.
- The value is measured between the two placed items (world positions, each with its own Side); the text is the value only (no parameter label: the points are in different items). The offset frame and mirroring follow the first item's Side.
- **Hidden** when either item is missing, has no drawing (its `.cs` is missing), has a pending AI proposal, or a point does not occur in the current branch / scenario. In Edit they are dimmed and cannot be picked, like other items.
- Select, drag (offset), Properties (แนว, ทศนิยม, ระยะห่าง, ลบ), Delete and Undo work as for an item's dimension; every change goes through the same Logic API on a project doc (`projEdit`, one Undo step; Undo covers the project display too).
- **Removing an item, or a point a project dimension is bound to, removes that dimension** in the same Undo step, with a warning in the banner and in **Messages** ("project · ลบ annotation ข้ามตัว D1 ไปด้วย (…)", shown whatever is selected; click = dismiss; cleared by Undo / Redo and when a project is opened / created). A `.cs` reloaded from disk (Import of a generated file, opening the project, the migration answer "use the .cs") that no longer has a bound point removes it too, with its own warning (not an Undo step: like the load itself).
- Delete with item and project annotations selected together removes all of them in one Undo step.
- Saved with **Save project**, restored on open; the project file version stays 3 (older webs ignore the key). Save as and Pack carry it unchanged ([projects.md](projects.md)). Notes and slope labels always belong to one item.

## Side Left, branches, scenarios (M3)

- All annotations are bound to point / link ids, so they follow parameters, scenarios, branches and Side. With Side = Left positions mirror; text stays upright and readable (dimensions, slope labels, notes, cross-item dimensions).
- An annotation whose point / link does not occur in the current branch / scenario is hidden. While **editing that item** ("show all cases", not Civil 3D preview) it is drawn **ghosted** (faded, dashed) where it is when its branch occurs.
- Drawing order: … points → annotations (all items, then the project's) → labels (codes, point names) → selection (design §6), so an item drawn later never covers another item's annotations.
- While an **AI proposal** is pending on an item, its annotations are hidden and annotation picks on it are refused (accepting replaces its spec).

## Logic API

Every change to display data goes through `js/logicops.js` (one Undo step each; the UI never edits the spec directly). Full reference: [logic-api.md](logic-api.md) (sections "Display").

| Op | Does |
|---|---|
| `setOverride(id, { link \| shape \| point })` / `clearOverride(id, kind?)` | per-object style, field by field / back to ByCode |
| `addDim({ kind, a, b, offset?, label?, decimals? })` | dimension h / v / aligned between two point ids |
| `addSlopeLabel({ link, format? })` | slope label on a straight link |
| `addNote({ text, at: { point, dx?, dy? }, leader? })` | note, optional leader, `{expression}` text |
| `updateAnnotation(id, patch)` / `removeAnnotation(ids)` | change / delete any annotation |

Cross-item dimensions use `addDim` / `updateAnnotation` / `removeAnnotation` on a project doc (`Display.projDoc`, `projEdit` in `js/annot.js`); `addNote` and `addSlopeLabel` refuse it. The style file is not a spec: it is edited by the Style palette only (`js/stylepal.js`), not through the Logic API.

## MCP

The spec read by `sa_get_spec` carries `display`; `sa_describe` lists `annotations` (ids and what they are bound to). Proposals may add or change annotations with `addNote`, `addDim`, `addSlopeLabel`, `updateAnnotation`, `removeAnnotation` (still a proposal the user accepts); see `SA.Web/Mcp/sa_guide.md`. Cross-item dimensions (project file) and the style file are not editable through MCP.

## Code

`js/style.js` (pure: resolve, parse / serialize, fromColours, setField, hatches, weights) · `js/display.js` (pure: dimension values, auto label, slope text, note text / geometry, show flags, project helpers `projDoc` / `projPoints` / `projPrune`, visibility) · `js/annot.js` (page: Annotate commands, drawing, drag, Properties of an annotation, `projEdit` / `projCascade`) · `js/stylepal.js` (page: style file state, rendering helpers, Style palette, Properties › Display) · `js/logicops.js` (`setOverride`, `clearOverride`, `addDim`, `addSlopeLabel`, `addNote`, `updateAnnotation`, `removeAnnotation`) · `SA.Web/Projects/ProjectApi.cs` (endpoints), `ProjectFile.cs` (`styleFile`, missing), `ProjectPack.cs` · tests `SA.Tests/js/style.test.js`, `SA.Tests/js/display.test.js`, `SA.Tests/js/notes.test.js`, `SA.Tests/DisplayTests.cs`, fixture `SA.Tests/fixtures/round10/demo.style.json`.

## Limits (not in this round)

- No `.pat` import (only the built-in hatches above, drawn as approximations); no radius / angle dimensions.
- No export of the code → style table to a Civil 3D Code Set Style, and no sync with it: in Civil 3D the user styles codes there.
- No print / PDF / image export; no light theme.
- The style file cannot be edited through MCP; cross-item dimensions are not editable through MCP.
- Hand-written `.cs` (no sa-spec): style by code only, no overrides, notes or dimensions.
- Icon generator: round 11; Browser palette: round 12.
