# Testing

Run everything quietly with `test-all.bat` (repository root): one summary line per suite plus only the failures; full log in `SA.Tests/test-all.log`. Close the viewer first: a running viewer locks the build output.

Tests must never read the user's working files at the root (`*.cs`, `*.assembly.json`). Use the locked copies in `SA.Tests/fixtures/` (frozen from commit e1fa131).

| Command | Tests |
|---|---|
| `dotnet run --project SA.Tests` | MCP endpoint (initialize, tools/list, tools/call, no page open, foreign Host / Origin, forwarding to a fake page), Trapezoid, code generator (compares JS with the result of running the C#, including Side = Left and link codes; this part needs `node`), SA-DRAWING block, object → code line, redrawn rock-pitching = real files (round 4c + -web.cs round 4e), exact parameter warning text (value types) |
| `node SA.Tests/js/evaluator.test.js` | Expressions + DrawingSpec (add cases in `SA.Tests/js/drawing-cases.json`) |
| `node SA.Tests/js/cond.test.js` | Condition expressions / values from geometry (round 4) |
| `node SA.Tests/js/logic.test.js` | if / switch / nested branches, firstOf, unknown values, branch cloning, cut / fill, show all cases, renaming / deleting conditions (round 4) |
| `node SA.Tests/js/rockpitching.test.js` | Redrawing base / body rock-pitching with tools = sa-spec in the locked `SA.Tests/fixtures/base_rock-pitching-web.cs` / `body_rock-pitching-web.cs`, computes with no warnings / closed shapes (rounds 4c / 4e). Comparison with the real files is in `dotnet run` |
| `node SA.Tests/js/logicbatch.test.js` | Logic API drawing functions, `applyBatch` (references, all or nothing, unknown fn / reference), `catalog` = real functions, `docs/logic-api.md` up to date, base rock-pitching redrawn with `applyBatch` only = `buildBase()` (round 6) |
| `node SA.Tests/js/boundary.test.js` | Bottom boundary (lower envelope of real links): crossings, auxiliary, holes, overlaps, branches, Left, known gaps in `SA.Tests/fixtures/round6/` (round 6) |
| `node SA.Tests/js/proposal.test.js` | AI proposals: real spec untouched, failure midway, added / changed / removed, diffText of codes and definitions, step replay, cancellation reported once (round 6) |
| `node SA.Tests/js/array.test.js` | Array: stairs (shared point), editing dx / dy / parameters, Left, link joining, shape / aux / branch, changing N (blocked), deleting = dissolves the Array, Move (round 4c) |
| `node SA.Tests/js/slope.test.js` | Parameter value types (Number / Slope 1:x / Length / Percent): display / typing / warning text, ↗ ↘ slope field read / write (old specs unchanged), Daylight Cut/Fill with Slope parameters (round 4e) |
| `node SA.Tests/js/logicops.test.js` | Logic API: every function, normal + error cases (duplicate name, reserved word, expression type, duplicate case / else, moving a decision into itself, 3 kinds of delete, cycles); spec unchanged after errors, describe (round 5) |
| `node SA.Tests/js/variables.test.js` | Variables: first true rule wins + warning text, references to points / ground (unknown), use in slope / Offset / Array / conditions, cycles, rename / delete / reorder, bool = condition (round 5). JS = C# in drawing-cases 84–90 + RockPitchingTests (DepthUsed) |
| `node SA.Tests/js/logictext.test.js` | Text view: toText (if / elif / switch / 3-level nesting / empty branch / variable with-without rules / with-without current values) · diffText (add / edit / rename / delete / move / no change) (round 5) |
| `node SA.Tests/js/round5bdemo.test.js` | round5b-demo built with the Logic API only: Loop in a branch + lastOf + no branchRisks, fill 2 / 7 / 13 m = 0 / 2 / 4 benches (slope 1:2.25 / 1:2.5), Layout, BermInterval 2, Left, above max 10 · spec = sa-spec in `tests-civil3d/round5b-demo.cs` (round 5b) |
| `node SA.Tests/js/round5demo.test.js` | round5-demo built with the Logic API only: structure / no branchRisks, cut / normal fill / high fill (berm) / Layout, 3-branch switch, DepthUsed warning, Left · spec = sa-spec in `tests-civil3d/round5-demo.cs` (round 5) |
| `node SA.Tests/js/loop.test.js` | Loop Array: floor / ceil / round (.5 / negatives), N = 1 / 2 / nMax, ⚠ above / below 1 / not computable, ℹ default round down, 3 rounding modes, link joining + shape + branch, Array ↔ Loop, editing nMax (blocked when referenced from outside), removeArray, show all cases (round 5b) + counter i, lastOf (shared point / follows max), count(A1) (Loop / fixed / bad name), mid-set reference warning (M2), Array toText / diffText + short drawing labels (M3). JS = C# in drawing-cases 96–108 |
| `node SA.Tests/js/clip.test.js` | Clipped Surface Link: compared with BuildBottom of base_rock-pitching (points + codes), not-below, sloped line, no ground, level expression, Left, branch, Copy, delete (round 4c) |
| `node SA.Tests/js/extend.test.js` | Extend to Surface: floating / buried / Layout / no hit within distance, real end as link end, optional link in a shape, Side = Left, branch, delete (round 4c) |
| `node SA.Tests/js/offset.test.js` | Offset (compared with ParallelY of body_rock-pitching, Left, negative distance) / Intersect trim / extend / no trim, Move / delete (round 4c) |
| `node SA.Tests/js/snap.test.js` | OSNAP selection (including Center) |
| `node SA.Tests/js/view.test.js` | Zoom range, grid spacing, decimals by zoom, mouse wheel |
| `node SA.Tests/js/track.test.js` | Object snap tracking, points tied to acquired points, auxiliary points, polar (Right / Left) |
| `node SA.Tests/js/polygon.test.js` | Regular polygon: vertices, to edge midpoint, editing R / θ / N, Move / Copy of the whole shape |
| `node SA.Tests/js/auxiliary.test.js` | Auxiliary points / links: geometry, real link with aux end, shape refuses aux link, old construction points, toggling without losing codes, Undo / Redo of toggles, aux Polygon / Fillet, Copy / Rotate |
| `node SA.Tests/js/rot.test.js` | Rotation groups: values before / after rotation, pivot referencing members, Side = Left, non-rotatable points, rotating again (same / another pivot), Move / Copy / delete |
| `node SA.Tests/js/arc.test.js` | 3-point / radius Arc / Fillet: geometry, Left mirror, segment count, impossible cases, Move / Copy, snaps on arcs |
| `node SA.Tests/js/select.test.js` | Window / Crossing |
| `node SA.Tests/js/history.test.js` | Undo / Redo |
| `node SA.Tests/js/ops.test.js` | Move / Copy / Paste of drawn parts |

Without `node`: the JS comparison in `dotnet run` shows FAIL "รัน node ไม่ได้" (the rest runs) · snap / select / history / ops tests can run in the web page's console (set `globalThis.SA_LIB = { Expr, Spec, Snap, Select, makeHistory, Ops }`, then eval the file in a function; the method used to test round 2).
