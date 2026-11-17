# Web display: style by code (round 10)

Everything here is **web only**. It never changes what Civil 3D draws: the generated C# body is byte-identical with or without display data, and a display-only change is not a parameter change for Build. In Civil 3D the user styles codes with a Code Set Style.

Status: M1 (style by code, per-object override, View › Show › Style, Civil 3D preview colours). Notes, dimensions and slope labels come in M2 / M3.

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
| — | `text.size` | px (used by annotations, M2) | 11 |

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

## View › Show › Style and Civil 3D preview

- **View › Show › Style** (`view.style`, stored with the bottom-bar values): off = automatic colours only (style file and overrides ignored, nothing deleted).
- **Civil 3D preview** (`view.c3d`): one neutral light grey for every link, the default shape fill, plain square points, no hatch (as Civil 3D with no Code Set Style). It keeps the Style toggle's value for when Design mode returns.

## Code

`js/style.js` (pure: resolve, parse / serialize, fromColours, setField, hatches, weights) · `js/stylepal.js` (page: style file state, rendering helpers, Style palette, Properties › Display) · `js/logicops.js` (`setOverride`, `clearOverride`) · `SA.Web/Projects/ProjectApi.cs` (endpoints), `ProjectFile.cs` (`styleFile`, missing), `ProjectPack.cs` · tests `SA.Tests/js/style.test.js`, `SA.Tests/DisplayTests.cs`, fixture `SA.Tests/fixtures/round10/demo.style.json`.
