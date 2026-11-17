# Round 10 design: style by code, notes, dimensions, slope labels, Civil 3D preview

Prompt: `prompt-10.md`. This doc records the M0 findings and the design for M1-M4. User decisions 1-11 are in the prompt and are not repeated here.

## 1. M0 findings (checked in code)

### 1.1 Does the server drop `display`? **No.**

`DrawingSpec` has no `Display` property, but no server path re-serialises a `DrawingSpec`. Every path that writes or returns the spec uses the **raw JSON**:

| Path | What it uses | `display` kept? |
|---|---|---|
| `/api/drawing/code` (`Program.cs:247`) | `GenerateBlock(spec, req.Spec.GetRawText())` | yes |
| `/api/drawing/save` (`Program.cs:294`), incl. rename branch | `req.Spec.GetRawText()` -> `SpecLine(raw)` | yes |
| `/api/drawing/spec` (`Program.cs:273`) | `JsonDocument.Parse(block.SpecJson)` clone | yes |
| `BlockMatchesSpec` (`CodeGenerator.cs:1686`) | regenerates from `block.SpecJson` | yes (and stays "not hand-edited") |
| `AssemblyService.cs:196,228` (run) | `item.Spec.GetRawText()` | yes |
| `ProjectFile.FileSpec` (`ProjectFile.cs:56`) | `JsonNode.Parse(block.SpecJson)` | yes |
| Build checks / engine (`BuildChecks.cs:76`, `BuildEngine.cs:325`) | `DrawingSpec.Parse` read-only (codes, params) | n/a (never written) |
| MCP (`McpHost.cs`) | forwards to the page; no spec logic on the server | n/a (JS side) |
| JS `Spec.normalize` (`spec.js:120`) | keeps unknown keys | yes |

`SpecLine` re-serialises through `JsonDocument` (formatting only, every key kept). So M1 only adds `JsonElement? Display` to `DrawingSpec` for clarity and future use; there is nothing to fix. The C# test "survives parse -> save -> spec -> rename" stays in the plan to lock this in.

### 1.2 How Build checks detect "changed"

Only `ManifestDiff.Diff(old, new)` (`BuildChecks.cs:116-118`): parameters (name, kind, default) from the **simulator run** compared with `build\<year>\manifest`. There is no file-time or hash check. A display-only change cannot change the generated body (generator ignores `display`) so it cannot change the manifest. A test locks this in.

### 1.3 Can a `.cs` be saved outside Edit? **Yes.**

- Properties of a selected item: button "Save (.cs) ●" (`ui.js:544`), enabled by `canSaveDrawing(it)` (`draw.js:174`), no Edit needed.
- Right-click on an item: "Save เป็น .cs" (`ui.js:218`).
- Not outside Edit: ribbon `finish.save` (Edit only, `commands.js:193`) and Ctrl+S (Edit only; otherwise saves the code editor, `main.js:44-49`). See question 7.
- The ● dirty mark is `drawingDirty(it)` = `it.savedSpec !== JSON.stringify(it.spec)` (`draw.js:172`), so a display change marks the item ● with no extra work.
- `specEdit(fn, it, label)` (`draw.js:178`) works on any item (`it` argument), not only the edited one, and `History.act` covers it; Undo snapshots `state.ws.assemblies` (`history.js:58`), which contains each item's spec, so annotation Undo is free.

### 1.4 Where colours are decided today

| Place | What |
|---|---|
| `css/app.css:9,20,32` | `--l1 … --l8` link palette (three theme blocks) |
| `js/core.js:13` `PALETTE`, `:234` `colorFor(code)` | code -> palette var, **in the order codes are met** (`length % 7`; `--l8` = no code). Session-dependent |
| `js/core.js:239` `primaryCode` | first code that is not `Datum` |
| `js/workspace.js:131` | hand-written / generated links: `stroke = colorFor(primaryCode)` |
| `js/workspace.js:230` | drawn links: ghost -> `branchColor`, else `colorFor(primaryCode)` |
| `js/workspace.js:324` | code legend swatch: `colorFor(c)` |
| `css/app.css:7,18,30,326` | `--shape` = one fill for every shape (no per-code colour) |
| `css/app.css` `.pt`, `.dpt`, `.dcons`, `.dlink.aux` | points and auxiliary styling (fixed) |
| `js/draw.js:34-35` `BR_COLORS`, `branchColor` | branch / ghost colours (logic, not style; stay as they are) |
| c3d mode (`core.js:28-33`) | today only hides aux + error objects; colours unchanged |

Round 10 replaces the three `colorFor(primaryCode(...))` call sites and the shape fill with `Style.resolve(...)`. Branch colours, selection / hover highlight and the aux dash stay app-owned (they show editing state, not the drawing).

### 1.5 Other findings

- Several codes per point / link / shape are already supported (`codes: []` everywhere): IDEA#1 item 3 `[open]` can be closed in M4.
- Project file (`project.js:26`) already stores `bar`; the new Show toggles go into `state.bar` like `aux` / `c3d` (saved with the project and in the tab state).
- `MissingFile(ItemId, ItemName, File)` (`ProjectFile.cs:14`) is per item; the style file needs an entry without an item (`ItemId = ""`, kind `style`).
- Pack copies outside files to `ext/` (`ProjectPack.cs:73-81`) for `.cs` entries only; M1 adds `styleFile` to the same loop.

## 2. Data

### 2.1 Style file — as `prompt-10.md` §1.1

- Defaults when a field is missing: link `{ linetype: "solid", weight: 0.25 }`, shape `{ alpha: 0.12, hatch: none }`, point `{ marker: "square", size: 8 }`, `text.size` 11. Colour missing -> automatic colour.
- Unknown keys kept (round 11 may add icon fields).

### 2.2 Automatic colour must become stable

`colorFor` today depends on the order codes are met, so "สร้าง style จากสีที่เห็นตอนนี้" would freeze a session-dependent result. Change in M1: automatic colour = palette index from a **hash of the code name** (stable across sessions and machines). Visible effect: some codes change colour once. (No question: the old order was never saved anywhere.)

### 2.3 `js/style.js` (pure, runs in node)

```js
Style.resolve(kind, codes, override, styleFile, opts)   // kind: "link" | "shape" | "point"
  // -> { color, linetype, weight, fill, alpha, hatch, marker, size, source: "override" | "code:<name>" | "auto" }
  // order: override fields -> first code (list order, Datum skipped unless only code) that has this kind in the style
  //        -> automatic colour (opts.auto(code)) + defaults
  // opts.useStyle === false (View › Show › Style off) -> skip style file and overrides
  // opts.c3d === true -> neutral style (question 8), no hatch, no markers beyond the default
Style.parse(json) / Style.serialize(style) / Style.fromColours(codes, autoFn)   // "สร้าง style จากสีที่เห็นตอนนี้"
Style.HATCHES   // SOLID, ANSI31, ANSI37, AR-CONC, EARTH, GRAVEL, NONE -> SVG pattern builders
```

Overrides merge field by field (an override of only `linetype` keeps the code colour).

### 2.4 `display` in the sa-spec — as `prompt-10.md` §1.2, plus

- Ids: notes `N1…`, dims `D1…`, slopes `G1…` (next free number per kind; not reused within a session).
- `normalize`: missing `display` = none; it is written only when not empty (a spec without annotations stays byte-identical to today's).
- `overrides` key = point / link / shape id.

### 2.5 Project file

- `styleFile`: relative path (like `.cs` entries); missing key = `{project name}.style.json` **if that file exists**, else automatic colours. The key is written only after the user saves or opens a style file.
- `display`: same shape, references `{ item, point }` / `{ item, link }`. Project file version stays 3 (new optional keys; older webs ignore them).

## 3. Cascades (Logic API keeps annotations consistent)

| Existing op | Effect on `display` |
|---|---|
| `removeObjects` | annotations bound to a removed point / link and overrides of removed ids are removed; listed in warnings |
| `removeDecision how: remove`, `removeCase` with objects | same through `removeObjects` |
| `removeParam` / param rename (`editParam` name) | dim `label` with that name -> `"auto"` on remove, renamed on rename (changed in M2 after review: an explicit label is the user's choice); `{expr}` in notes renamed like other expressions (rename) or left (remove: the note shows `{?}`) |
| `copyObjects` | annotations are **not** copied (only geometry); overrides of copied objects are copied |
| `moveObjects`, `setBranch`, Array / Loop | nothing (annotations follow point ids) |
| Copy item / Save as | the whole spec incl. `display` |

Cross-item annotations in the project file: removing an item or a point removes the bound project annotations (warning in Messages).

## 4. New Logic API ops (`js/logicops.js`, group "Display")

| Op | Args | Notes |
|---|---|---|
| `addNote` | `{ text, at: { point, dx, dy }, leader? }` | returns id |
| `addDim` | `{ kind, a, b, offset, label?, decimals? }` | `a`, `b` must be real points |
| `addSlopeLabel` | `{ link, format? }` | straight links only |
| `updateAnnotation` | `id, { … }` | any field of the kind; drag = `offset` / `dx, dy` |
| `removeAnnotation` | `ids` | |
| `setOverride` | `id, { link? / shape? / point? }` | merges |
| `clearOverride` | `id, kind?` | "กลับไปใช้ ByCode" |

Project-level annotations use the same functions on a project `display` object (`Logic.Display.*` working on `{ display }` with item-qualified refs), called through a project-level `projEdit()` with one Undo step.

Pure helpers (also used by tests): `Display.dimValue(spec, result, dim)`, `Display.autoLabel(spec, dim)` (decision 8: the two points are linked by a single `delta` / `slopeLength` def whose `dx` / `dy` / `length` along the measured direction is exactly one parameter name), `Display.slopeText(link, format)`.

## 5. UI placement

- **Annotate tab** (always visible, after View): panels Note / Dimension / Slope / Style as `prompt-10.md` §2.1. Commands registered in `js/commands.js` via the `sa-add-command` skill; no single-letter keys.
- **Style palette**: new dockview panel `style`, default tabbed with Properties (right).
- **Properties**: "Display" section (override ByCode / custom; for an annotation its options).
- **View › Show**: `view.style`, `view.annot`, existing `view.codes`, new `view.ptnames`. `view.c3d` hides all four, keeps their values.
- Picks for annotations snap to real points only (point ids); a cross-item pick targets the project file.

## 6. Rendering order (one SVG group per layer)

surface -> shapes (fill, then hatch pattern) -> links -> points / markers -> annotations (dims, slopes, notes) -> labels (codes, point names) -> selection / hover. Hatch `<pattern patternUnits="userSpaceOnUse">` scaled with zoom; line weights and text sizes screen-constant (`vector-effect: non-scaling-stroke`, font-size from `text.size`). Side Left: positions mirror, text never mirrored, kept upright (angle normalised to −90°…90°).

## 7. Milestone split (as `prompt-10.md` §6)

M1 style + toggles + `DrawingSpec.Display`; M2 dims + slopes + ops; M3 notes + cross-item + point names + Side / branch / MCP; M4 docs + checklist.

## 8. Questions for the user (M0)

Proposed defaults 1-6 are from `prompt-10.md` §8. 7-8 are new from M0.

1. Lineweight: fixed screen width per weight (like LWDISPLAY).
2. Text: screen-constant 11 px, set in the style file.
3. Dimension decimals: 2 by default, per dimension.
4. Style palette: right, tabbed with Properties.
5. Annotation outside Edit makes the `.cs` unsaved (●) until Save (.cs): yes.
6. Slope `auto`: steeper than 5 % -> `1:x`, else `%`.
7. **Ctrl+S outside Edit** today does not save a drawn `.cs` (only Properties / right-click do). Proposed: Ctrl+S outside Edit saves the **selected** item's `.cs` when it is ● and no code editor has focus; otherwise unchanged.
8. **Colours in Civil 3D preview** (decision 11 "plain neutral"): proposed one neutral light-grey for every link, the default shape fill, plain square points (closest to Civil 3D with no Code Set Style). Alternative: keep today's automatic colours.

## 9. Answers

2026-11-17: the user accepted every proposal (1-8) as written in section 8, and the stable hash-based automatic colour (section 2.2).
- 7: Ctrl+S outside Edit saves the selected drawn item's `.cs` when it is unsaved and no code editor has focus.
- 8: Civil 3D preview = one neutral light-grey for every link, default shape fill, plain square points.
