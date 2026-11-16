# Round 9 design: new UI shell (ribbon, contextual tabs, dockable palettes)

Status: **M0 done** (2026-11-16). All questions in section 7 answered: every proposal accepted.
Spec: `prompt-9.md`. Idea: `docs/ideas/IDEA#1.md` item 7.

## 1. Inventory: every UI entry point today → new place

Legend: **R** = ribbon `Tab › Panel`, **F** = ไฟล์ application menu, **QA** = Quick Access, **ctx** = right-click (unchanged), **pal** = stays inside its palette, **bar** = status bar (unchanged), ✗ = removed.

### 1.1 ไฟล์ ▾ menu (`#dd-file`, `data-cmd`)

| Old (`data-cmd`) | Label | New place |
|---|---|---|
| `import` | Import .cs (เข้า workspace)… | F + R Home › Import |
| `new-cs` | สร้าง .cs ใหม่จาก template… | F + R Home › Import |
| `open-proj` | Open project… | F + R Home › Project |
| `save-proj` | Save project (off in a read-only tab) | F + QA + R Home › Project |
| `save-proj-as` | Save project as… | F + R Home › Project |
| `new-proj` | New project… | F + R Home › Project |
| `pack` | Pack project… (zip) | F + R Home › Project |
| `#dd-recent` | Recent projects submenu | F (same submenu) |
| `export` | Save / Export .cs… (disabled placeholder) | ✗ removed (never worked; Save (.cs) is in Finish) |
| `build` | Build… | F + R Output › Build |
| `sc-export` | Export scenarios (.json) | F + R Output › Scenarios |
| `sc-import` | Import scenarios… | F + R Output › Scenarios |
| `settings` | ตั้งค่า… | F only |

### 1.2 Header (`<header>`)

| Old id | What | New place |
|---|---|---|
| `#m-file` | ไฟล์ ▾ button | "ไฟล์" application button, left of the tabs |
| `#b-build` | Build | R Output › Build (not in QA, Q3) |
| `#b-edit` | ✎ แก้โค้ด (Ctrl+E) | R Output › Code › Edit code; Code palette |
| `#proj-name` | project name + `*` | title row |
| `#folder` | project folder path | title row |
| `h1` "SA Drawing Studio" | app name | title row (left of QA, short) |
| `#f-open`, `#f-import` | hidden file inputs | kept (hidden, moved out of the header) |

### 1.3 Left aside → palettes

| Old | New |
|---|---|
| `#sec-tree` Workspace tree + row buttons (`+ Variable`, `+ If`, `+ Switch`, …) | Workspace palette (pal, unchanged) |
| `#sec-sc` Scenarios list + `#b-save` "+ บันทึกกรณีนี้" | Scenarios palette (pal); scenario pick also R View › Scenario dropdown |
| fold header / `#split-left` / `#lw-resize` (panes.js) | ✗ replaced by dockview resize / tabs |

### 1.4 Code panel `#ed`

| Old | New |
|---|---|
| `#ed-save` บันทึก, `#ed-dl` ดาวน์โหลด, conflict bar `#ed-keep` / `#ed-take` | Code palette (pal, unchanged ids) |
| `#ed-close` × | palette close (×); Ctrl+E toggles |
| `#ed-resize` width drag | ✗ dockview resize |

### 1.5 Edit bar (`#edit-bar`)

| Old | New |
|---|---|
| text "✎ กำลังแก้ X …" + branch | stays (only in Edit) |
| `#edit-save` Save (.cs) | R contextual › Finish › Save (.cs) (Ctrl+S unchanged); bar button removed |
| `#edit-exit` ออกจาก Edit | R contextual › Finish › ออกจาก Edit; bar button removed |

### 1.6 Bottom dock (`#dock`)

| Old (`data-tab`) | New |
|---|---|
| `msg` Messages (+ badges `#n-msg`, `#n-info`) | Messages palette, badges on its tab |
| `log` Log (`#n-log`) | Log palette |
| `pts` Points (`#n-pts`) | Points palette |
| `logic` Logic (`#n-logic`) | Logic palette; also R Logic › Conditions opens it |
| `ai` AI (`#n-ai`) | AI palette; also R AI › Proposals opens it (badge copied) |
| `#dock-of` "· item name" | one line at the top of each of the 5 palettes (same text) |
| `#dock-toggle` ▾ fold | ✗ removed (resize / close the palette instead; see Q7) |

### 1.7 Drawer tools (`#drawer`, `data-tool`)

| Old | New |
|---|---|
| `point` | R Draw › Draw › Point (P) |
| `link` | R Draw › Draw › Link (L) |
| `shape` | R Draw › Draw › Shape (S) |
| `polygon` | R Draw › Draw › Polygon |
| `ngon` Regular Polygon | R Draw › Draw › Regular Polygon (missing in prompt §2, added) |
| `arc` | R Draw › Draw › Arc |
| `daylight` Slope to Surface | R Draw › Surface |
| `follow` Follow Surface | R Draw › Surface |
| `extend` Extend to Surface | R Draw › Surface |
| `clip` Clipped Surface Link | R Draw › Surface |
| `cutfill` Daylight Cut/Fill | R Draw › Surface **and** R Logic › ถ้าตัด / ถม (same command id, Q2) |
| `intersect` | R Draw › Construct (I) |
| `offset` | R Draw › Construct (O) |
| `fillet` | R Draw › Construct |
| `array` | R Draw › Construct |
| `marked` Marked point (placeholder) | ✗ removed (never worked) |
| `level` Cut at Level (placeholder) | ✗ removed (never worked) |
| My Shapes "Save to My Shapes" (placeholder) | ✗ removed (Browser comes in round 12) |
| `#drawer-hint` "Undo Ctrl+Z …" | ✗ removed (tooltips carry it) |
| `#split-right`, `#rw-resize`, fold header | ✗ dockview |

### 1.8 Status bar (`#bar`) — all stay

| Item | Also in |
|---|---|
| `#bar-xy`, Grid snap (F9), Ortho (F8), slope presets, OSNAP (F3) + `▾` menu, `#ai-status`, `#srv` | — (bar only) |
| Grid (`data-tg="grid"`) | R View › Show › Grid (same state) |
| Aux (`b-aux`) | R View › Show › Aux |
| ดูแบบ Civil 3D (`b-c3d`) | R View › Mode › Design / Civil 3D preview |
| codes | R View › Show › Codes |
| VE select | R View › VE (1 / 2 / 5) |
| Fit (`b-fit`) | R View › Navigate › Fit |

### 1.9 Right-click menus (all stay; entries that repeat a ribbon command call the registry)

| Menu | Entries |
|---|---|
| drawn object | Move (M), Copy (C), Rotate (R), Auxiliary on/off, ลบ |
| subassembly | Edit / ออกจาก Edit, แก้โค้ด / ดูโค้ดที่สร้าง, Rename…, Save เป็น .cs, Move, Copy, Mirror, ~~เพิ่มเข้า "My Shapes"~~ (✗ placeholder removed), เอาออกจาก assembly |
| assembly | ADD, Import .cs เข้า assembly นี้…, Rename…, ลบ assembly |
| surface | Add point (A), รีเซ็ตเส้น surface |
| workspace | + Assembly ใหม่, Import .cs…, Fit (F) |
| Conditions tree (`condtree.js`) | unchanged (ไปที่โค้ด, rename, add / delete, …) |

### 1.10 Properties inline buttons

Stay in the Properties palette (Parameter table, Edit, Mirror, เอาออก, Move / Copy / Rotate / Auxiliary / Delete of the selection, ADD, Import into assembly, surface Add / ลบจุด / รีเซ็ต, …). Those that repeat a ribbon command call the registry.

### 1.11 Keyboard (all unchanged; read from the registry, `?` table generated)

Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z, Ctrl+S, Ctrl+E, Ctrl+A, Ctrl+C / X / V, F, Z, A, M, C, R, X, B, P, L, S, I, O, Delete / Backspace, Esc, ? / F1, F3, F8, F9, F11, Space + drag, Tab / digits / Enter while drawing; in-command options (Arc T / E, Intersect T / N, Polygon C, Rotate C / R) beat general shortcuts as now.

## 2. Ribbon spec

Large = icon + label under; small = icon + label right (rows of 3).

**Title row:** [ไฟล์] · QA: Save project, Undo, Redo · project name `*` · folder.

**Home**
| Panel | Commands |
|---|---|
| Project | New (L), Open (L), Save (L), Save as (s), Pack (s) |
| Import | Import .cs (L), New .cs from template (s) |
| Assembly | New assembly (s), Add subassembly / ADD (s, needs a selected assembly), Edit (L, needs a selected subassembly), Mirror (s, Q1) |
| Surface | Add point (A) (s), Reset surface (s) (Q3) |
| Clipboard | Cut, Copy, Paste, Delete, Select all (s) (Q4) |

**View**: Navigate: Fit (F), Zoom selection (Z) · Mode: Design / Civil 3D preview · Show: Aux, Codes, Grid · VE 1 / 2 / 5 · Scenario dropdown · Palettes: one toggle per palette + Reset layout.

**Output**: Build (L) · Code: Edit code (Ctrl+E), View generated code · Scenarios: Export, Import.

**AI**: Proposals: open AI palette + count badge · Claude: เชื่อม Claude (dialog with the steps of `docs/connect-claude.md`) + connection status (same source as `#ai-status`).

**Draw** (contextual): Draw: Point, Link, Shape, Polygon, Regular Polygon, Arc · Surface: Slope to Surface, Follow Surface, Extend to Surface, Clipped Surface Link, Daylight Cut/Fill · Construct: Intersect, Offset, Fillet, Array, Auxiliary (X).

**Modify** (contextual): Move (M), Copy (C), Rotate (R), Delete. Mirror: see Q1.

**Logic** (contextual): Parameters (opens Properties on the Parameter table, as the current "Parameter" button) · Variables (opens Workspace palette, expands + selects the Variables node of the edited item) · Conditions (opens Logic palette) · Draw into branch (B) · ถ้าตัด / ถม (= `cutfill`, Q2).

**Finish** (right end of each contextual tab): Save (.cs) · ออกจาก Edit.

Behaviour: double-click a tab = minimise / restore (remembered, Q4 of prompt = yes); tooltip = name + shortcut + one Thai line + disabled reason; Edit → switch to Draw, leave Edit → previous tab; narrow window → panels scroll horizontally.

## 3. Default palette layout (dockview)

```
┌──────────────┬───────────────────────────────┬──────────────────────┐
│ Workspace    │                               │ Properties │ Code    │
│              │      workspace (centre,       │                      │
├──────────────┤      no tab header,           │                      │
│ Scenarios    │      not closable / floatable)│                      │
│              ├───────────────────────────────┤                      │
│              │ Messages│Log│Points│Logic│AI   │                      │
└──────────────┴───────────────────────────────┴──────────────────────┘
```

Widths ≈ today's: left 260 px, right 320 px, bottom ≈ 220 px. Code tab is opened by Ctrl+E (not active by default).

## 4. dockview-core check

| Item | Result |
|---|---|
| Version / licence | 8.9.0, MIT (`LICENCE.md`, © 2021 mathuo) |
| Build without a bundler | `dist/dockview-core.min.js` is UMD → global `window["dockview-core"]`; no dependencies |
| Size | 564 KB (≈107 KB gzip), CSS injected by the script (there is no separate `.css` in v8; the `noStyle` build would need our own CSS) |
| Docking / tabs / resize | yes |
| Floating | **yes, built in** (`addFloatingGroup`, drag a tab out with Shift) → allowed (prompt Q2). Pop-out windows (`addPopoutGroup`) not used |
| Save / restore | `api.toJSON()` / `api.fromJSON()`; stored under a versioned localStorage key (`sa.layout.v1`); bad / old JSON → default layout |
| Theme | class `dockview-theme-dark`, then `--dv-*` variables mapped to `css/app.css` variables |
| Vendor | `SA.Web/wwwroot/lib/dockview/dockview-core.min.js` + `LICENCE.md` (copied from the npm tarball, no npm dependency in the repo) |

Tabler: `@tabler/icons` 3.52.0, MIT; only used outline SVGs copied into `wwwroot/lib/tabler/` + `LICENSE`.

## 5. Command registry

`js/commands.js`: `{ id, label, icon, shortcut, tip, enabled(state) → true | "reason", active(state)?, run() }`. Ribbon, ไฟล์ menu, QA, repeated right-click entries and the `?` table read from it. Keyboard dispatch in `main.js` keeps its order (in-command options first) but takes command keys from the registry. Handlers called as they are.

## 6. Tests (plan)

- `SA.Tests/js/commands.test.js`: fields present, no duplicate shortcuts, contextual commands disabled outside Edit, Edit needs a selected subassembly.
- Inventory test: every old `data-cmd` / `data-tool` / header id maps to a command id or is in the removed list (§1, kept as a table in the test).
- Layout test: corrupt / old saved layout → default.
- **Playwright is not installed** on this machine → smoke test skipped ("skipped", not a failure) + manual checklist in `docs/testing.md` (Q5).

## 7. Questions for the user (M0)

From the prompt (proposed defaults): 1 Code palette right, tabbed with Properties · 2 floating allowed (dockview has it) · 3 Build not in QA · 4 ribbon minimised state remembered · 5 placeholders removed now.

Found in the inventory:

| # | Question | Proposal |
|---|---|---|
| Q1 | Mirror today works only on a whole subassembly (outside Edit). Mirror of drawn parts does not exist (new command = not this round) | Mirror in **Home › Assembly**; Modify has no Mirror this round |
| Q2 | "ถ้าตัด / ถม" (Logic) is the same tool as Daylight Cut/Fill (Surface) | same command shown in both panels |
| Q3 | Add point on surface (A) + Reset surface have no ribbon place | Home › Surface panel (right-click stays) |
| Q4 | Select all (Ctrl+A) has no ribbon place | Home › Clipboard |
| Q5 | Playwright not installed | skip + manual checklist (no install) |
| Q6 | Regular Polygon missing from prompt §2 | add to Draw › Draw |
| Q7 | Bottom dock ▾ fold button | remove (dockview resize / close) |

Answers (2026-11-16): prompt questions 1-5 as proposed; Q1 Mirror in Home › Assembly (no Mirror in Modify this round); Q2 shown in both panels; Q3-Q7 as proposed.

## 8. Progress

- **M1 (2026-11-17):** `js/commands.js` (registry, incl. the contextual commands for M2, inventory map `OLD` / `REMOVED`), `js/ribbon.js` (title row, ไฟล์ menu, Quick Access, Home / View / Output / AI). Old `<header>` buttons gone; Drawer still there. Keyboard in `main.js` looks commands up in the registry (same order of checks as before). View toggles and the status bar share `barClick()`. Icons: `/lib/tabler/*.svg` used as CSS masks (absolute URL: a relative `url()` inside a CSS variable resolves against `css/`). View › Palettes moves to M3 (needs dockview); ribbon minimise and styled tooltips come in M2 (title tooltips for now).
