---
name: sa-add-command
description: Use when adding or changing a user command in SA Drawing Studio — a ribbon button, ไฟล์ menu item, Quick Access button, keyboard shortcut, right-click item or palette.
---

# Adding a command (round 9 shell)

All commands live in one registry: `SA.Web/wwwroot/js/commands.js` (`Commands`). The ribbon, ไฟล์ menu, Quick Access, the keyboard (`js/main.js`) and the `?` table read from it; `js/ribbon.js` draws them. Never wire a button straight to a handler.

## 1. Registry entry (`LIST` in `commands.js`)
`{ id, label, icon | svg, shortcut?, keys?, tip, enabled?(c), active?(c), edit?, keyIdle?, keyRun?, run() }`
- `id`: `area.name` (`draw.`, `mod.`, `logic.`, `view.`, `pal.` …). `label`: English, as in the UI.
- `icon`: a Tabler **outline** name; copy only that SVG into `wwwroot/lib/tabler/` (the MIT `LICENSE` is there). A CAD tool with no fitting Tabler icon: `svg` = inner SVG markup in a 28 × 22 viewBox, styled by the `.rsvg` classes in `css/app.css` (see `TOOL_SVG`).
- `tip`: one Thai line (the tooltip adds name, shortcut and the reason when off).
- `enabled(c)`: `true` or a Thai reason string; `c` comes from `ctxNow()` in `js/ribbon.js` (add a field there if needed). `edit: true` = contextual: disabled outside Edit, key ignored outside Edit.
- `active(c)`: pressed state for toggles. Toggles shared with the status bar call `barClick()` (one state, two buttons).
- `keys`: lower-case normalised keys (`"p"`, `"ctrl+shift+z"`, `"f3"`); `shortcut`: how it is shown. `keyRun` when the key differs from the button (draw tools: key starts, button toggles). `keyIdle` = ignored during Move / Copy / Rotate.
- `run()`: calls the existing handler. If it changes spec data, the handler must go through the Logic API: follow `sa-spec-change`.

## 2. Where it appears
- Ribbon: `RIBBON` (tab → panels → items: `"id"` large, `["id", "s"]` small, `["id", "s", "label here"]`, `{ widget }`). Always-visible tabs Home / View / Output / AI; Draw / Modify / Logic are contextual (Edit only) and end with `FINISH`. Do not add an empty tab (Annotate comes in round 10, Browser in round 12). Small buttons stack in columns of 3; a narrow window scrolls the panels sideways.
- ไฟล์ menu: `FILE_MENU` (+ `MENU_LABEL` for a longer label); Quick Access: `QUICK`.
- Right-click (`ctxItems` in `js/ui.js`): entries that repeat a ribbon command take label / shortcut from the registry (`CL(id)`, `CK(id)`).
- A new palette: `DockLayout.PALETTES` in `js/dock.js`, a `.pal` (+ `.pal-tab`) in `index.html`, a `pal.<id>` toggle in View › Palettes; render code checks `palShown(id)` and `refresh()` in `dock.js` redraws it when shown.

## 3. Shortcuts
- Options inside a running command (Arc T / E, Intersect T / N, Polygon C, Rotate C / R) beat general shortcuts: they are checked first in `main.js`.
- Add the row to `HELP` (the `?` table, Thai text). `SA.Tests/js/commands.test.js` fails if a key belongs to two commands, a key has no `shortcut`, or a key is missing from the `?` table.

## 4. Tests and docs
- `commands.test.js`: fields, enable rules (add a case for the new rule), icons exist, contextual commands only on contextual tabs. A removed or moved old entry point: update `OLD` / `REMOVED` (inventory test).
- UI check: `node SA.Tests/e2e/ui-smoke.js http://localhost:5051/` against a **test** server (scratch `SA_STUDIO_MACHINE_DIR`, copies only).
- Update `docs/screen.md` (ribbon table) and the topic doc of the feature; run `test-all.bat`.
