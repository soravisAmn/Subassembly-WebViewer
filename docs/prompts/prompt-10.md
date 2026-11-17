# Round 10: Web display — style by code, notes, dimensions, slope labels, Civil 3D preview

> How to use: tell Claude Code "Read CLAUDE.md and prompt-10.md, then do Milestone 0".
> One milestone at a time; stop after each so the user can check. Report to the user **in Thai, briefly** (what changed / how to check / what is not done).

## 0. Context

- Read `CLAUDE.md` first. Rounds 7 (Build), 8 (project folders) and 9 (ribbon, command registry, dockview palettes) are done and committed; project skills `sa-spec-change` and `sa-add-command` apply to this round (use them).
- This round is **IDEA#1 item 1** (`docs/ideas/IDEA#1.md`, section "1. Web display"; storage rules in section 8, table "ที่เก็บของแต่ละอย่าง"). Read only those two sections.
- **Everything in this round is web-only.** It never changes what Civil 3D draws: the generated C# body must be byte-identical with or without any display data. Annotation inside Civil 3D is done by the user with Code Set Style; the web only keeps codes correct.
- Every display group can be **hidden without being deleted**.

### User decisions (do not ask again)

| # | Decision |
|---|---|
| 1 | **Style by code ("ByCode")**, like ByLayer in CAD: `{name}.style.json` in the project folder; the project file **points to** it (default = same name as the project; may point to a shared template such as `DPT-standard.style.json`, also outside the folder — Pack copies it into `ext\`). Not synced with Civil 3D Code Set Style |
| 2 | **No style file / missing style file → today's automatic colours** (`colorFor()`), and the style file only overrides the codes it lists. Button **"สร้าง style จากสีที่เห็นตอนนี้"** writes the current colours into a new style file. A missing style file is listed in "ไฟล์หาย" but never blocks opening |
| 3 | **Per-object override** (like an object not using ByLayer) is stored in the `.cs` (sa-spec `display.overrides`) |
| 4 | Notes, dimensions and slope labels **inside one subassembly** live in its `.cs` (sa-spec `display`); ones that **span two subassemblies** (e.g. total width of body + base) live in the project file (`.assembly.json`, `display`) |
| 5 | Annotations are **bound to point ids (meaning), never to coordinates**: they move when parameters, scenarios, logic branches or Side change |
| 6 | **Hand-written `.cs` (no sa-spec): style by code only** this round; no notes / dimensions on them (no stable point ids) |
| 7 | **Hatch: a built-in set** drawn as SVG patterns: SOLID, ANSI31, ANSI37, AR-CONC, EARTH, GRAVEL (+ NONE). No `.pat` import this round |
| 8 | **Dimension parameter label is automatic**: when the measured distance comes straight from one parameter (e.g. `delta` with `dx: "Wcrest"` between the two points), the text is `3.00 (Wcrest)`. The user can switch it off or pick another name per dimension |
| 9 | Annotation kinds this round: **Note** (text + optional leader), **Dimension** horizontal / vertical / aligned (between two points), **Slope label** on a straight link (`1:2.00` or `5.0%`) |
| 10 | **Annotate tab is always visible** (not contextual); **Style palette** (dockview) for the code table; **View › Show** toggles each group (style / notes + dims + slopes / code names / point names) like layer on/off |
| 11 | **Civil 3D preview mode** (existing `c3d` toggle, `view.c3d`) hides everything in this round: no web style (plain neutral colours), no annotations, no code / point names, no auxiliary (as today) |

### Current state (checked in code)

| File | What |
|---|---|
| `js/core.js:234` `colorFor(code)` | automatic colour per code from `PALETTE`, assigned **in the order codes are met** (colours can differ between sessions); `primaryCode()` (line 239) skips `Datum` |
| `js/core.js:28-33` | bottom-bar state `aux`, `c3d`; `auxShown()` = aux on and not c3d |
| `js/workspace.js:126-132` | hand-written / generated result: shapes as `polygon.shape`, links `path.link` with `stroke: colorFor(primaryCode(l.codes))` |
| `js/workspace.js:205-260` `renderSpec` | drawn spec: shapes `dshape`, links `dlink` (aux = dashed grey, ghost = branch colour), points `dpt` / aux cross, labels `pt-lbl` (id in Edit, codes when `showCodes`) |
| `js/workspace.js:~315-327` | code legend built from `colorFor` |
| `css/app.css:7,18,30,326-330,366` | `--shape` fill, `.link` width 2.4, `.pt`, `.dlink.aux` dash |
| `js/spec.js` | points / links / shapes all have `codes: []` → **several codes per point already supported** (close the `[open]` in IDEA#1 item 3). Point def types documented at the top (`delta`, `slopeLength`, …) — use them for decision 8 |
| `js/spec.js:120` `normalize` | keeps unknown keys (so `display` survives on the JS side) |
| `SA.Web/Drawing/DrawingSpec.cs:11-23` | **no `Display` property** — suspected: any server path that parses and re-serialises the spec drops `display`. `/api/drawing/save` (`Program.cs:294`) writes `req.Spec.GetRawText()` (raw), but check every other path (`/api/drawing/spec`, `BlockMatchesSpec`, rename, Build checks, MCP) |
| `js/commands.js` | registry; View › Show has `view.aux`, `view.codes`, `view.grid`; Mode has `view.design`, `view.c3d`. Single-letter keys in use: A B C F M R X Z + draw tools (P L S …) |
| `js/dock.js:13-21` | palettes: tree, scenarios, props, code, msg, log, pts, logic, ai |
| `SA.Web/Projects/*`, `docs/projects.md` | project file version 3, relative paths, "ไฟล์หาย" list, Pack (`ext\` for outside files), read-only second tab |

Files to read by topic: `docs/screen.md` (ribbon / palettes), `docs/projects.md` (project file, Pack, missing files), `docs/logic-api.md` (ops), `docs/code-generation.md` (sa-spec line), `docs/testing.md`.

## 1. Data

### 1.1 Style file `{name}.style.json`

```json
{ "version": 1,
  "codes": {
    "Top":   { "link": { "color": "#d9a441", "linetype": "solid", "weight": 0.50 } },
    "Rock":  { "shape": { "fill": "#7a6a55", "alpha": 0.35, "hatch": { "pattern": "GRAVEL", "scale": 1.0, "angle": 0, "color": "#c8b89a" } } },
    "Crest": { "point": { "marker": "triangle", "color": "#ff6b6b", "size": 7 } } },
  "text": { "size": 11 } }
```

- `linetype`: `solid | dashed | center | hidden`; `weight` in mm like CAD lineweights (0.13 … 2.00), drawn at a **fixed screen width** (like LWDISPLAY, not scaled by zoom); `marker`: `square | circle | cross | triangle | none`.
- **Resolution order** (one pure function in a new `js/style.js`, reused by the icon generator in round 11): per-object override → the object's codes in list order (skip `Datum` unless it is the only code) → first code with a style → `colorFor()` automatic colour.
- Project file gets `styleFile` (relative path, like the `.cs` entries). Save style is separate from Save project (own `*`); a read-only tab cannot save it. Server writes only `*.style.json` inside the allowed project paths (same rules as the project file).

### 1.2 `display` in the sa-spec (per subassembly)

```json
"display": {
  "notes":  [ { "id": "N1", "text": "ระวังระดับ {Hcrest}", "at": { "point": "P4", "dx": 0.5, "dy": 0.8 }, "leader": "P4" } ],
  "dims":   [ { "id": "D1", "kind": "h", "a": "P2", "b": "P5", "offset": -1.2, "label": "auto", "decimals": 2 } ],
  "slopes": [ { "id": "G1", "link": "L3", "format": "auto" } ],
  "overrides": { "L3": { "link": { "linetype": "hidden" } }, "S1": { "shape": { "hatch": { "pattern": "EARTH" } } } } }
```

- `kind`: `h | v | aligned`; `offset` = distance of the dimension line from the measured points, in drawing units (so it moves with them). `label`: `"auto"` (decision 8) | a parameter name | `null` (number only).
- Note text may contain `{expression}` (same `Expr` as number fields) → current value, e.g. `{Hcrest}` or `{Wcrest*2}`. `leader`: a point id or null.
- Slope `format`: `ratio` (`1:2.00`), `percent` (`5.0%`), `auto` (ratio when steeper than 5 %, else percent).
- Side Left: positions mirror with the geometry, **text stays readable** (never mirrored).
- A point / link that does not exist in the current branch or scenario → its annotations are hidden (shown ghosted only while editing that item).
- Deleting a point / link also deletes the annotations bound to it (listed in Messages); Undo restores both.
- **C# generator ignores `display`** except that it rides along in the sa-spec line. Changing only `display` must not count as a geometry / parameter change in Build checks.

### 1.3 `display` in the project file (between subassemblies)

Same shape, but references are `{ "item": "<item id>", "point": "P5" }`. Hidden when either item is missing or not placed.

## 2. UI

### 2.1 Annotate tab (always visible, between View and Output)

| Panel | Commands |
|---|---|
| Note | Note (click anchor point → place text → type in an inline box), Note with leader |
| Dimension | Horizontal, Vertical, Aligned |
| Slope | Slope label (click a straight link) |
| Style | Style palette, "สร้าง style จากสีที่เห็นตอนนี้", Open style file… (point the project at another / template file) |

- AutoCAD-like flow: DIMLINEAR = pick point 1 → pick point 2 → place the dimension line. **Picks snap to real points only** (an annotation needs a point id); a pick that is not on a point shows "ต้องเลือกจุด". Typed offset accepted (Tab, like other commands). Esc cancels.
- Works **outside Edit**. The picked points decide the target: same item → that `.cs` (becomes unsaved ●, saved by the normal Save (.cs) path; M0 confirms there is one outside Edit); two items → project file.
- Annotations are selectable: double-click = edit text / options in **Properties** (new "Display" section); Delete deletes; drag a dimension line or note text = change `offset` / `dx, dy` only; Move / Copy / Rotate ignore annotations except when their points move. Undo covers every change.
- **No new single-letter shortcuts** this round (all ribbon / Properties).

### 2.2 Style palette (dockview, default right, tabbed with Properties)

- Table of every code in the project (+ codes only in the style file, greyed): link colour / linetype / weight, shape fill / alpha / hatch, point marker. Colour pickers + small preview swatch per row.
- Header: style file name + `*`, Save style, "สร้าง style จากสีที่เห็นตอนนี้", Open style file…
- The existing code legend uses the resolved style.

### 2.3 Properties: per-object override

- "Display" section for a selected point / link / shape of an sa-spec item: **ByCode** (default) or custom values; "กลับไปใช้ ByCode" removes the override.

### 2.4 View › Show (+ status bar where a button already exists)

- Toggles: Style (off = automatic colours only), Annotations (notes + dims + slopes), Codes (existing `view.codes`), Point names (P1, P2 … for sa-spec items; index for hand-written). Per-machine remembered like other bar values.
- `view.c3d` hides all of them (decision 11) but keeps their on/off values for when Design mode returns.

## 3. Rendering

- Hatch as SVG `<pattern>` in `userSpaceOnUse`, scaled with zoom like CAD hatch; patterns are approximations (document it).
- Dimension: extension lines, arrows (SVG markers — make sure they render in all browsers we use), text centred on the line, rotated with aligned dims, kept upright.
- Text size is screen-constant (`text.size`, default 11 px).
- Use the same resolved style for the workspace, the legend and (later) icons; no duplicated colour logic.

## 4. Logic API / MCP

- New ops in `js/logicops.js` (+ `docs/logic-api.md` via `SA.Tests/gen-logic-doc.js`): `addNote`, `addDim`, `addSlopeLabel`, `updateAnnotation`, `removeAnnotation`, `setOverride`, `clearOverride`. Every spec change goes through them (ribbon, Properties, MCP proposals).
- MCP: the spec it reads already carries `display`; AI proposals may add annotations through these ops (still a proposal the user accepts). The style file is **not** editable through MCP this round.
- `DrawingSpec.cs`: carry `display` through unchanged (e.g. `JsonElement? Display`), and fix every server path found in M0 that drops it.

## 5. Tests (`test-all.bat`; fixtures in `SA.Tests/fixtures/` only)

- JS: style resolution (override > code > auto, `Datum` skipped, several codes); style file load / save / missing → fallback; auto parameter label (`delta dx` = parameter → label, expression `Wcrest/2` → no label); dimension values change with a parameter and with a scenario; Side Left positions mirror, text upright; delete point → annotation gone, Undo → back; annotations hidden in `c3d`; cross-item dimension stored in the project file.
- C#: sa-spec with `display` survives parse → save → `/api/drawing/spec` → rename; **generated C# body identical with and without `display`**; Build checks see a display-only change as no geometry change; Pack copies a style file outside the folder to `ext\` and rewrites the path in the zip only.
- Never write into `D:\test_cad\SA-Projects\`.

## 6. Milestones

| M | Work | How the user checks |
|---|---|---|
| 0 | `git status`. Confirm the suspected `display` drop (every server path that touches the spec) and how Build checks detect "changed"; check whether a `.cs` can be saved outside Edit; list where colours are decided today (`colorFor`, CSS, legend, ghost, branch colours). Write `docs/prompts/prompt-10-design.md` (data shapes, resolution order, UI placement, op list). Questions below | Read the design doc; answer the questions |
| 1 | `js/style.js`, style file read / write endpoints, `styleFile` in the project file, Style palette, Properties override, View › Show toggles, c3d hides, "ไฟล์หาย" + Pack for the style file, `DrawingSpec` carries `display` | Open a copy of SR03 → set colours / hatch → reload page → same; delete the style file → opens with automatic colours; c3d mode plain |
| 2 | Annotate tab: Dimension h / v / aligned + Slope label, Logic API ops, auto parameter label, Properties "Display" section, select / drag / delete / undo | Dimension a crest width → change Wcrest and switch scenario → value follows, shows `(Wcrest)` |
| 3 | Notes (+ leader, `{expression}` text), cross-item annotations in the project file, point-name overlay, Side Left, branch / scenario hiding, MCP proposal path | Note on a point, mirror the item to Left, switch branch; dimension across body + base, Save project, reopen |
| 4 | Docs: new `docs/display.md`, update `docs/screen.md`, `docs/projects.md`, `docs/code-generation.md`, `docs/logic-api.md`; IDEA#1 item 3 `[open]` multi-code → closed; CLAUDE.md status; short `tests-civil3d/round10-checklist.md` (a `.cs` with display data builds and draws the same as before in Civil 3D); ask permission to commit | Final walk-through; run the Civil 3D checklist |

Restart `run-viewer.bat` after M1 (new endpoints); Ctrl+F5 is enough for JS-only changes.

## 7. Not in this round

- `.pat` import, radius / angle dimensions, export of a code → style table for Civil 3D, print / PDF / image export, style through MCP, light theme, icon generator (round 11), Browser (round 12).

## 8. Questions for the user in M0 (proposed default — "ตามที่เสนอ" is fine)

1. Lineweight on screen: **fixed screen width per weight** (like LWDISPLAY), not zoom-scaled.
2. Note / dimension text: **screen-constant size** (annotative), 11 px, set in the style file.
3. Dimension decimals: **2** by default, per dimension in Properties.
4. Style palette place: **right, tabbed with Properties**.
5. Adding an annotation outside Edit makes that `.cs` unsaved (●) until Save (.cs): **yes** (same as other drafts).
6. Slope label `auto` switch point: **5 %** (steeper → `1:x`, flatter → `%`).

General rules from CLAUDE.md apply (CRLF, localhost only, do not break existing features, never touch the user's project files during tests, Logic API first for spec changes, no fake API in the shim, web UI text Thai and docs / comments / MCP output English, short script output, no commit / push without permission, tell the user whether to restart `run-viewer.bat` or just Ctrl+F5, never commit Autodesk DLLs).
