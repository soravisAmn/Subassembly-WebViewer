---
name: sa-spec-change
description: Use when adding or changing anything stored in a drawn subassembly's spec (points, links, shapes, parameters and their fields, conditions, variables, Arrays / Loops, display data) in SA Drawing Studio.
---

# Changing the spec (SA Drawing Studio)

The spec is the meaning of a drawing (definitions, expressions, codes), never coordinates. It lives in the `// sa-spec:` line of the `.cs` (never read whole generated `.cs` files: grep / line ranges only). Work through this list in order; skip a step only when it truly does not apply, and say so.

## 1. Logic API first — `SA.Web/wwwroot/js/logicops.js`
- Add / change a pure function in `Logic` (no DOM, no `state`; runs in node). It works on a copy through `tx()`: on error the spec does not change and the result is `{ ok: false, error }`. Errors: English for functions from round 6 on (the AI reads them), Thai for older ones.
- Validate names against `Logic.RESERVED` (must match `CodeGenerator.Reserved` in C#) and existing names.
- Add its `META` row (the one source for `Logic.catalog()` and the table in `docs/logic-api.md`), then run `node SA.Tests/gen-logic-doc.js`. `logicbatch.test.js` fails if the doc is stale. Write the prose part of `docs/logic-api.md` too.
- In the web it is called as `specEdit(sp => Logic.xxx(sp, …), item, "action name")` (`js/draw.js`) = exactly one Ctrl+Z per user action; an error = banner message, no Undo step.

## 2. Spec shape — `SA.Web/wwwroot/js/spec.js`
- Field names and defaults; `Spec.normalize(spec, dropped)` must load **old specs** (missing field = default, renamed field converted, dropped data reported). Readers use helpers such as `Spec.isAux`, not raw flags.
- Mirror the field in C#: `SA.Web/Drawing/DrawingSpec.cs` (expressions are stored as text) and, for expressions, `SpecExpr.cs`.

## 3. UI
- The UI only calls the Logic API (rule in `CLAUDE.md`): Properties, tables, tree, dialogs. Thai labels; button / tool names English.
- A new command or button: follow the `sa-add-command` skill.

## 4. Generator — `SA.Web/Drawing/CodeGenerator.cs`
- Emit C# for the new data inside the `SA-DRAWING` block only; use only Civil 3D API that exists (`link-API-Reference.txt`; see `sa-civil3d-parity`). Check both Side = Right and Left (Left is mirrored by the generated code).

## 5. Simulator and JS / C# agreement
- The page evaluates the spec in JS (`js/spec.js`, `js/expr.js`); the server compiles the generated C# and runs it on `SA.Civil3DShim`. They must agree.
- Add cases to `SA.Tests/js/drawing-cases.json`: `DrawingTests.cs` runs every case through `SA.Tests/js/eval-cli.js` (JS) and through the generated, compiled code (C#) and compares. Expression parity: `SA.Tests/ExprTests.cs`.
- The shim must not be more lenient than Civil 3D (`sa-civil3d-parity`).

## 6. MCP
- `sa_catalog` returns `Logic.catalog()` (from `META`), so a new Logic function is visible to Claude automatically. Check whether `sa_describe` / the text view (`Logic.toText`), `sa_check`, or the guides `SA.Web/Mcp/sa_guide.md`, `edit_logic.md` need the new field. Page side of the tools: `js/mcp.js`; server side: `SA.Web/Mcp/McpHost.cs`.

## 7. Tests and docs
- JS tests in `SA.Tests/js/*.test.js` (e.g. `logicops.test.js`, `logicbatch.test.js`, the topic test of the feature), C# in `SA.Tests/*.cs`. Inputs from `SA.Tests/fixtures/` only, never the user's projects.
- Run `test-all.bat` (close the viewer first). Update the topic doc (`docs/drawing-tools.md`, `logic.md`, `parameters.md`, `array-loop.md`, `code-generation.md` …) and `docs/logic-api.md`.
- New Civil 3D behaviour to confirm: add it to the round's `tests-civil3d/roundN-checklist.md`.
