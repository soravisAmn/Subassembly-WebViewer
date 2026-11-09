# Project history (rounds 3 to 5b)

Condensed from the old `CLAUDE.md`. Prompts and design docs of each round are in `docs/prompts/`. Rounds 1, 2, 3 and 3b were finished in commit `ha`. Feature details are in the topic docs (see `README.md`).

## Not yet tested in real Civil 3D

`tests-civil3d/round3-demo.cs`, `round4-demo.cs`, `round4c-base.cs`, `round4c-body.cs`, `round5-demo.cs`, `round5b-demo.cs`, and the root files `base_rock-pitching-web.cs`, `body_rock-pitching-web.cs`, `pavement-assembly.cs` (`tests-civil3d/round6-checklist.md`). (`round4b-demo` was deleted together with Max / Min.)

## Round 4: Logic style ก (`prompt-4.md`, `prompt-4-design.md`)

All answers "as proposed". Repo cleaned up (bin/obj no longer tracked).

- M1: condition expressions, `P3.x/y`, `ground()`, `exists()`, `hasGround()` in JS / C# (`cond.test.js`, `ExprTests.cs`, drawing-cases 31–35).
- M2: if / switch / nested branches + `firstOf` in JS / C# + minimal "เกิดเมื่อ" UI (`logic.test.js`, cases 36–44). Originally firstOf was auxiliary only and real links after branches had to start from points in each branch; round 4c M3 changed this (firstOf aux = "real end", can be a real link end if all listed points are real).
- M3: "ถ้าตัด / ถม" button (`Spec.addCutFill`; cases 45–49).
- M4: Logic tab (live values, branch tree, rename / delete), show all cases (`evaluate` + `allBranches`), branch tags in the tree, scenario branch coverage, `B` = draw into branch, "เกิดเมื่อ" on several objects.
- M5: hand-edited files outside the block + branches (`DrawingTests`), codelink for conditions / branches, `round4-demo.cs` + checklist (cases 50–54).
- Proposal not done (prompt-4 item 6): show in the Logic tab which `if` line hand-written code enters. Separate task if the user wants it.

## Round 4b: Max / Min (`prompt-4b.md`, `prompt-4b-design.md`)

Button "Max / Min" controlling vertical / perpendicular-to-ground / length / horizontal distance. `p.limit` in evaluate, C# `Limit()`, `limited()`, live preview dialog (`js/limit.js`), Rotate refused for limited points. **Removed in round 4c M1.**

## Round 4c (`prompt-4c.md`, `prompt-4c-design.md`)

Decisions: button names in English (other text Thai) · Offset ticks Aux itself · Intersect asks trim / no trim every time.

- M1: Max / Min removed (commit `ea9dd1a`; old data dropped on load with one notice; `limited()` = "no such function") · Parameter table `positive` (> 0 → Severe + default), min / max, warning when default conflicts, Parameter button (`Spec.setParamBounds` / `paramBoundsIssue`) · English button names.
- M2: point type `offset` (JS + C# `Offset()`), `Spec.addOffset` / `addIntersect`, Intersect tool (`I`; T trim-extend, N no trim, no default), Offset tool (`O`) (`offset.test.js` against ParallelY of body_rock-pitching; cases 58–60).
- M3: Extend to Surface: `extendToGround` (not floating / no ground = silently off, `Spec.GROUND_OFF`), C# `ExtendToGround()`, link `optional` in shapes (C# `Opt()`), real end (`Spec.isAlias` / `auxEnd`, C# alias Point var), `Spec.addExtendToGround` (`extend.test.js`, cases 61–67).
- M4: Clipped Surface Link: link `followClipped` (flat `refLink` | `refLevel`, not `ref: {}` as drafted; side below / above; codes / codesGround / codesLine) = `Spec.clipPath` + C# `FollowClipped()` (Link[]). DrawingTests now compare link codes (`clip.test.js` against BuildBottom, cases 68–74).
- M5: Array: `spec.arrays`, `Spec.addArray` / `updateArray` / `rebuildArray` / `arrayOf` (set k = delta from the same point of the previous set; n includes the original; join share | link); deleting a member asks, then dissolves. No C# changes (`array.test.js`, cases 75–76).
- M6: base / body rock-pitching redrawn with tools only → `tests-civil3d/round4c-base.cs` / `round4c-body.cs`; sequence in `buildBase()` / `buildBody()`; `RockPitchingTests.cs` runs them against the real files: 15 grounds × Right / Left × 4 value sets match in points / links / shapes / codes (known difference: body end line hitting ground past the origin). Fixed M2 bug: Offset distance as a +/- expression lacked parentheses in C# (case 77).

## Round 4d (`prompt-4d.md`)

Resizable left / right panels (`js/panes.js`, `--lw` / `--rw`, `state.leftW` / `rightW`, double-click = 280 / 300, workspace ≥ 320), full-name tooltips in the tree, split panes (left tree / Scenarios, right Drawer / Properties; dividers `state.drawerH` / `scH`; fold `drawerFold` / `scFold`).

## Round 4e (`prompt-4e.md`, `prompt-4e-design.md`)

- M1: close buttons. Root cause: CSS `.ghost{pointer-events:none}` for SVG preview hit `button.ghost` → `:where(svg) .ghost`. `cancelDialog()` (× / cancel / Esc / background; background does not close with pending values, `#dlg-note`), × in `#dyn`.
- M2: parameter value type `unit` (number | slope | length | percent: `Spec.UNITS` / `fmtParam` / `parseUnitValue` / `setParamUnit`, C# `Unit` + `UnitPre` / `UnitSuf`), matching warning text web = C#, ↗ ↘ slope fields (`Spec.slopeRead` / `slopeWrite`, stored expression unchanged) (`slope.test.js`, cases 78–81).
- M3: `base_rock-pitching-web.cs` / `body_rock-pitching-web.cs` saved through `/api/drawing/save`; body lower point = Extend to Surface on a vertical (replaces min()); `rock-pitching-compare.assembly.json`.
- Fix: a project item holding only `file` of a web-generated file now reads sa-spec on Edit (`enterEdit` → `loadSpecFromFile` → `enterEditNow`); it used to get an empty spec that Save could overwrite.

## Round 5 (`prompt-5.md`, `prompt-5-design.md`)

Item 1, user's choice "style 2": Points / Links / Shapes list everything with a coloured branch tag, and objects also appear under their branch.

- M1: `js/logicops.js` (`Logic.*` returns `{ ok, error }`; error = spec unchanged; wraps 4c / 4e functions; describe). UI calls the API; `specEdit` shows errors in the banner. Daylight Cut/Fill dialog got slope-style fields (`Spec.slopeMagnitude`, direction locked; number = x as before) (`logicops.test.js`, cases 82–83).
- M2: Conditions tree (`js/condtree.js`: treeConditions / updateTreeLive / condDialog / condCtxItems, drag = setBranch), live chips, + Condition / + Switch, elif, case ↑↓, double-click edit.
- M3: Variables: `spec.logic.variables` (rules if / elif, first wins, warn `{name}`, error); evaluate via getters in env; C# `VariableLines` (double + if / else if; point references = double? through Val + `VN()` only when used); Logic.addVariable / edit / rename / remove / move / variableUses (cycles through variables / points = error) (cases 84–90; RockPitchingTests: base + DepthUsed = real file).
- M4: Logic.toText (Thai pseudo-code + current values) / Logic.diffText (+ - ~); table / text buttons + copy (`logictext.test.js`).
- M5: `round5-demo.cs` (+ assembly, checklist) built with the Logic API only (`buildRound5()`, cases 91–95).
- Known limits: berm has one level only (Loop came in 5b) · branchRisks does not trace points referenced through variables.

## Round 5b: Loop (`prompt-5b.md`, `prompt-5b-design.md`)

Decisions: style ก (build up to the max, occur by count), nMax 10 (max 50), N < 1 = 1, `i` of the original = 0, Array button + Loop tick, C# as an if per set, `i` only in dx / dy, N not computable = 1 + warning, N rounding `loop.nRound` (round .5 away from zero), ℹ (web only) vs ⚠ levels. Other places that substitute values were listed as a proposal in the design doc, not changed.

- M1: `floor / ceil / round` (JS + C#), `arrays[].loop` in evaluate (`loopN`; set k off when k ≥ N) + C# (`LoopN`, `N_A1 > k` gate, DrawingSpec.Arrays), Logic `updateArray` / `setArrayLoop` / `removeArray`, Array dialog + Properties + live preview, Messages ℹ / ×n / click = select (`loop.test.js`, cases 96–104 comparing `loopMsgs`).
- M2: `i` (substituted on build / edit, `Spec.withI`, Expr `allowI`, reserved name), `lastOf` (firstOf of last set → original, `refreshLastOf`, does not block rebuild, C# FirstOf), `Logic.addLastOf`, `count(A1)` (JS `ctx.count`, C# `ExprScope.ArrayCount`, TopoOrder `LoopDeps`), branchRisks for references to sets 2.. (branch "A1#k"), ⚠ also on always-occurring objects (cases 105–108).
- M3: Arrays tree (`treeArrays`: ×N + ℹ / ⚠ live, ✓ / –, click selects), "A1 ×N" label (`.arr-lbl`), ghost for non-occurring sets (`Spec.offLabel`), scenarios (`scenarioEval` / `scenarioLoops`, `logicCoverage().loops / loopMiss`), toText Arrays + shortened members, diffText for Arrays. Fixed: scenario snapshot shared live params (now a deep copy).
- M4: `round5b-demo.cs` (+ assembly, `round5b-checklist.md`): fill embankment, Variable FillH + HighFill › Loop A1 (`buildRound5b()`, cases 109–114), Array in an inactive branch shows – (`arrOff`).

## Round 5c: token housekeeping (`prompt-5c.md`, `prompt-5c-notes.md`)

Finished prompts moved to `docs/prompts/`, `test-all.bat`, tests moved to locked copies in `SA.Tests/fixtures/`, README split into English `docs/`, this file and a slim `CLAUDE.md`.

## Round 6: MCP (`prompt-6.md`, `prompt-6-design.md`)

Decisions: Claude Code first, Desktop via a stdio bridge (Desktop's custom connectors cannot reach localhost); AI tab; a user edit cancels a pending proposal; Accept all / Reject / Step through only; bottom boundary = lower envelope of real links; test fixtures locked before the user added Datum.

- M1: Logic API drawing functions, `applyBatch` (`${name.path}` references, all or nothing), `Logic.META` as the one source for `catalog()` and the doc table.
- M2: `/mcp` in SA.Web (SDK `ModelContextProtocol.AspNetCore` 2.4.0, stateless), WebSocket to the page, 7 read-only tools, `js/boundary.js`, Host / Origin checks.
- M3: proposals (`js/proposal.js`, `js/aipanel.js`), `sa_new` / `sa_apply` / `sa_scenarios` / `sa_proposal`, AI tab and overlay; `diffText` reports code and definition edits.
- M4: `sa_guide` / `edit_logic`, `SA.Mcp/bridge.js`, `SA.Tests/e2e/mcp-e2e.js`. The user then edited the 3 files through the web.
- M5: `build-c3d.bat`, `tests-civil3d/round6-checklist.md`. The 3 files compile against the real Civil 3D 2027 API.
- Known at the end of M5: by `sa_check`, `body` lacks `Datum` on L13 and L10, and `pavement` on L57 (and more when the ground is above the whole section). Left for the user to judge in Civil 3D.
- Postponed: drawing from a CAD screenshot.

## Long-term plan notes

- A SAC-style flowchart is postponed to the public web phase and must edit **the same data** as style ก (`docs/prompts/prompt-flowchart-later.md`).
- Public web later: accounts, sandboxed C# compile, user-supplied AI key, Chat / Code modes. So keep **core** (spec, evaluator, CodeGenerator, shim, pages) clearly separate from **host** (localhost, local files, local compile). No repo split yet.
- Second machine (no longer used): desktop-3l6r773, `D:\Yo\Subassembly-WebViewer`.
- Before node was installed, JS tests ran in the browser with simulated `require` and `eval-cli.js` results fed through a temporary `node.exe` stand-in (method in `docs/prompts/prompt-4-design.md`).
