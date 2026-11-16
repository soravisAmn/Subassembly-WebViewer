# Round 9: New UI shell — Ribbon, contextual Edit tabs, dockable palettes

> How to use: tell Claude Code "Read CLAUDE.md and prompt-9.md, then do Milestone 0".
> One milestone at a time; stop after each so the user can check. Report to the user **in Thai, briefly** (what changed / how to check / what is not done).

## 0. Context

- Read `CLAUDE.md` first. Rounds 7 (Build) and 8 (project folders) are done; the round 8 Civil 3D checklist passed (whole-palette drag + Refresh Palette, Thai text OK). This round is **IDEA#1 item 7** (`docs/ideas/IDEA#1.md`, section "7. Layout ของ UI" incl. "ร่าง Ribbon"). Read only that item.
- **No Figma pass** (user decision): this prompt is the layout spec. It follows the wireframe the user reviewed (Design canvas "SA Drawing Studio — UI wireframe" on claude.ai; he can show screenshots).
- **This round moves the UI, it does not add features.** Every command that works today must still work, with the same shortcuts and right-click menus. Nothing that changes spec data may bypass the Logic API (unchanged rule).
- Current UI (checked): plain HTML + vanilla JS, no libraries. `index.html`: `<header>` with "ไฟล์ ▾" dropdown (Import .cs, new .cs, Open / Save / Save as / New / Pack project, Recent, Build, Export / Import scenarios, ตั้งค่า), buttons Build and "✎ แก้โค้ด"; `<aside id="left">` Workspace tree + Scenarios (`js/panes.js` splits / folds); `#ed` code panel; `#center` with the Edit bar, `#main` SVG workspace and the bottom **dock** (Messages, Log, Points, Logic, AI); `<aside id="right">` **Drawer** (tools: point, link, shape, ngon, arc, fillet, intersect, array, daylight, follow, extend + Logic group + disabled placeholders "marked", "level", "My Shapes") + Properties; `<footer id="bar">` status bar; context menus `#ctx`, OSNAP menu, modal dialogs.

### User decisions (do not ask again)

| # | Decision |
|---|---|
| 1 | No Figma; follow this prompt + the wireframe |
| 2 | Docking with **`dockview-core`**, vendored locally (no CDN), MIT license file kept beside it |
| 3 | Only tabs with working commands now: **Home, View, Output, AI** + contextual **Draw, Modify, Logic**. Annotate comes in round 10, Browser in round 12 — do not add empty tabs |
| 4 | **Remove the Drawer**; its tools move to the contextual tabs. In-command value boxes (Tab, offset, etc.) stay as they are |
| 5 | **"ไฟล์" application button** left of the tabs (like AutoCAD's A menu) + **Quick Access** (Save, Undo, Redo) + a Project panel in Home with the common file commands |
| 6 | Icons: **Tabler icons** (outline), only the SVGs used, vendored with the MIT license |
| 7 | AutoCAD behaviour: double-click a tab = minimise / restore the ribbon; tooltips show name + shortcut + one Thai line; entering Edit switches to Draw, leaving Edit returns to the previous tab; palette layout remembered per machine + "Reset layout" |
| 8 | Keep the current dark theme and fonts (IBM Plex) |

## 1. Screen layout (top to bottom)

```
┌ title row: [ไฟล์] [Save][Undo][Redo] │ SR03 *  D:\test_cad\SA-Projects\SR03 ┐
├ tab row:   Home  View  Output  AI  │ Draw  Modify  Logic  (contextual, Edit only, teal) ┤
├ ribbon:    panels of the active tab (≈ 90 px, minimisable) … [Finish: Save (.cs) | ออกจาก Edit] ┤
├ edit bar:  "✎ กำลังแก้ X …" (unchanged, only in Edit) ┤
├ body:      dockview — centre = workspace (not closable), palettes around it ┤
└ status bar (unchanged) ┘
```

- The **"ไฟล์" menu** has everything the old "ไฟล์ ▾" had (same order, same commands, same Recent submenu); "Save / Export .cs…" (disabled placeholder) is dropped.
- The project name + `*` + folder move to the title row (as now in `<header>`).
- The status bar keeps every item. View-tab toggles (Aux, c3d, codes, Grid) and the status-bar toggles are **the same state** (two buttons, one value).

## 2. Ribbon content

Every button = a command from the registry (section 4). Names in English as now; tooltips Thai.

**Always visible**

| Tab | Panel → commands |
|---|---|
| **Home** | Project: New, Open, Save, Save as, Pack · Import: Import .cs, New .cs from template · Assembly: New assembly, Add subassembly (ADD), Edit (needs a selected subassembly) · Clipboard: Cut, Copy, Paste, Delete |
| **View** | Navigate: Fit (F), Zoom selection (Z) · Mode: **Design / Civil 3D preview** (= the `c3d` toggle) · Show: Aux, Codes, Grid · VE (1 / 2 / 5) · **Scenario** dropdown (Default first; same as clicking in the Scenarios palette) · Palettes: toggle each palette + **Reset layout** |
| **Output** | Build (opens the Build dialog) · Code: Edit code (Ctrl+E), View generated code · Scenarios: Export, Import |
| **AI** | Proposals: open the AI palette, count badge · Claude: "เชื่อม Claude" (shows the steps from `docs/connect-claude.md` in a dialog), connection status |

**Contextual — only in Edit mode** (teal tabs, as in Civil 3D):

| Tab | Panel → commands |
|---|---|
| **Draw** | Draw: Point (P), Link (L), Shape (S), Polygon, Arc · Surface: Slope to Surface, Follow Surface, Extend to Surface, Clipped Surface Link, Daylight Cut/Fill · Construct: Intersect (I), Offset (O), Fillet, Array, Auxiliary (X) |
| **Modify** | Move (M), Copy (C), Rotate (R), Mirror, Delete |
| **Logic** | Parameters (table), Variables, Conditions (opens the Logic palette), Draw into branch (B), "ถ้าตัด / ถม" |
| *(right end of every contextual tab)* | **Finish**: Save (.cs) · ออกจาก Edit |

- The exact list comes from the **inventory in M0**: every current entry point must land somewhere (ribbon, ไฟล์ menu, right-click, palette header) or be listed as removed with a reason. Placeholders that never worked ("marked", "level", "My Shapes") are removed; "My Shapes" is replaced by Browser in round 12.
- Buttons disabled by state (e.g. Edit with nothing selected) show why in the tooltip.
- Large buttons (icon + label under it) for the main commands, small rows (icon + label right) where a panel has many; narrow window: panels scroll horizontally, never wrap into a second ribbon row.

## 3. Palettes (dockview)

| Palette | Content (existing) | Default place |
|---|---|---|
| Workspace | tree (`#tree`) | left, top |
| Scenarios | scenario list + buttons | left, below Workspace |
| Properties | `#props` | right |
| Code | the code panel `#ed` (conflict bar, editor) | right, tab next to Properties; opened by Ctrl+E |
| Messages · Log · Points · Logic · AI | the 5 dock tabs | bottom, one tab group under the workspace |

- Centre = the workspace SVG + its overlays (banner, problem, welcome, legend, tip, dynamic input). Not closable, not floatable.
- Palettes can be moved, tabbed together, resized, closed, reopened (View → Palettes), and **floated** if dockview supports it without extra work (otherwise docking only — say which in M0).
- Badges (Messages / AI counts) stay on the palette tabs.
- Layout saved per machine (localStorage, versioned key); "Reset layout" restores the default. A layout saved by an older version that no longer matches → default layout, no error.
- `js/panes.js` (old splits / folds) is replaced; remove what is no longer used.
- MCP / page bridge (`js/mcp.js`, `js/aipanel.js`) must keep working: element ids the bridge uses stay, or the bridge is updated with a test.

## 4. Command registry (structure)

- One module (e.g. `js/commands.js`): each command = `{ id, label, icon, shortcut, tip (Thai), enabled(state) → true | reason, active(state)?, run() }`.
- The ribbon, the ไฟล์ menu, Quick Access, right-click menus that repeat ribbon commands, and keyboard shortcuts **read from the registry** — one place to change a name / shortcut / enable rule. The `?` shortcut table is generated from it (Thai text as now).
- Existing handlers are called, not rewritten. Spec-changing commands still go through the Logic API.

## 5. Icons and look

- Tabler outline SVGs in `wwwroot/lib/tabler/` (only those used) + license. Pick icons that read as CAD actions; where Tabler has nothing fitting (e.g. Slope to Surface, Follow Surface, Daylight Cut/Fill, Clipped Surface Link), **reuse the current Drawer SVGs** — they were drawn for these tools.
- Contextual tabs teal-tinted; active tab and toggled buttons clearly marked; colours from the existing CSS variables (`css/app.css`), no new palette.
- Thai text must not be clipped in labels / tooltips.

## 6. Tests

- JS (node): registry — every command has id / label / tip, no duplicate shortcuts, enable rules (contextual commands disabled outside Edit, Edit needs a selection); the **inventory test**: every old `data-cmd` / `data-tool` / header button id maps to a registry command or is in the documented "removed" list; layout restore — corrupt / old saved layout falls back to default.
- If Playwright is available on the machine, a small smoke test: page loads, each tab switches, entering Edit shows Draw / Modify / Logic, Reset layout works. If not available: skip with "skipped" (not a failure) and a manual checklist.
- Everything via `test-all.bat`.

## 7. Milestones

| M | Work | How the user checks |
|---|---|---|
| 0 | `git status`. **Inventory** of every UI entry point today (menu items, header buttons, Drawer tools, dock tabs, status-bar buttons, right-click menu items, shortcuts) → table old place → new place (or removed + reason). Check `dockview-core`: license, a build usable without a bundler, size, docking / floating support, how to vendor. Ask section 8. Write `docs/prompts/prompt-9-design.md` (inventory table, ribbon spec, default layout) | Read the inventory; answer questions |
| 1 | Command registry + ribbon (always-visible tabs) + ไฟล์ menu + Quick Access + title row. Old header removed; Drawer still there for now | All Home / View / Output / AI buttons work; shortcuts unchanged |
| 2 | Contextual Draw / Modify / Logic + Finish panel + Edit flow (switch / return); **remove the Drawer**; icons; tooltips; ribbon minimise | Enter Edit from the tree / right-click / Home → draw with the ribbon only |
| 3 | dockview: all palettes, default layout, save / restore, Reset layout, View → Palettes; remove old `panes.js` splits; MCP bridge check | Move / tab / close / reopen palettes, refresh the page — layout stays; Reset |
| 4 | Clean-up of dead code / CSS, narrow-window behaviour, `?` table from the registry, `docs/screen.md` rewritten for the new layout (other docs: fix references to Drawer / ไฟล์ ▾), CLAUDE.md status; ask permission to commit | Final walk-through (below) |

**M4 walk-through for the user (no Civil 3D needed):** open SR03 → every tab → Edit a subassembly → draw a point, link, shape, Slope to Surface → Move / Rotate → Logic: add a condition → Save (.cs) → ออกจาก Edit → switch scenario from View → Build from Output → AI palette shows a proposal (if Claude is connected) → rearrange palettes, refresh, Reset layout → `?` table.

## 8. Not in this round

- Annotate tab, notes / dimensions, style by code (round 10); icon editor (11); Browser (12); in-app AI chat (13); light theme; new commands of any kind.

## 9. Questions for the user in M0 (proposed default — "ตามที่เสนอ" is fine)

1. Code palette default place: **right, tabbed with Properties** (opens on Ctrl+E).
2. Floating palettes: **allowed if dockview gives it for free**; otherwise docking only.
3. Build also in Quick Access: **no** (Output tab only; the Build dialog is two clicks away).
4. Ribbon minimised state remembered: **yes**, per machine.
5. Removed placeholders ("marked", "level", "My Shapes"): **remove now**; anything else the inventory finds unused is listed for the user to decide.

General rules from CLAUDE.md apply (CRLF, localhost only, do not break existing features, never touch the user's project files during tests, Logic API first for spec changes, no fake API in the shim, no commit / push without permission, tell the user whether to restart `run-viewer.bat` or just Ctrl+F5).
