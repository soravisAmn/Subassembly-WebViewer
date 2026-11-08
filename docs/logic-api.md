# Logic API: `js/logicops.js`

One set of pure functions for editing the logic / objects of a drawn part (no page access; works in the web and in node). Every part of the web calls this set (Properties "เกิดเมื่อ", Logic tab, Daylight Cut/Fill, Intersect, Offset, Extend to Surface, Clipped Surface Link, Array, Parameter table, draw into branch `B`). prompt-6 wraps it as MCP tools.

- Result: `{ ok: true, …result, warnings? }` or `{ ok: false, error: "Thai message" }`. **On error the spec does not change at all** (works on a copy first, then replaces · same `spec` object).
- In the web, call through `specEdit(sp => Logic.xxx(sp, …), item, "action name")` = 1 Undo · an error = a message in the banner and no Undo step.
- The last `opts` argument (optional) = `{ codeParams }`: parameters of existing code (imported files) that expressions may use.
- Names (conditions, etc.): English letters / digits / `_`, not starting with a digit · must not duplicate parameters / conditions / points · must not be names the code uses (`Logic.RESERVED`, forms like `P1` `L2` `D3` `B4` `C5` …) / words used in expressions.

| Function | Does | Possible errors |
|---|---|---|
| `addCondition(spec, { name?, expr, note?, parentBranch?, decision?, label?, yes?, no? })` | Condition + if decision + branches yes / no (names start at `Cond1`) · `parentBranch` = the "no" branch of another decision = **elif** · `decision: false` = condition only | Duplicate / reserved name, not true/false, missing point, missing branch |
| `editCondition(spec, name, { expr?, note? })` | Edit expression / note | Wrong type, **circular reference** |
| `renameCondition(spec, old, name)` | Tests / expressions / labels using the old name follow | Duplicate name |
| `removeCondition(spec, name, { how })` | Decisions using it are deleted too (`how`) | Still used by another expression (lists them) |
| `addDecision(spec, { parentBranch?, kind, test, label?, cases?, elseLabel? })` | if (true/false expression) · switch (numeric expression + `cases: [{ value, label }]` + `else` always last) | Test type, duplicate / non-numeric case |
| `editDecision(spec, id, { test?, label?, kind? })` | Change if ↔ switch (yes = case 1, no = else) | A switch with several cases cannot become if |
| `removeDecision(spec, id, { how })` | `how`: `parent` (parent branch; default) · `always` (always occurs) · `remove` (deletes objects too) · nested ones go too | |
| `moveDecision(spec, id, parentBranch \| null)` | Moves the whole block to nest in another branch (make / undo elif) | Moving into its own branch |
| `addCase(spec, decisionId, { value, label? })` · `editCase(spec, branchId, { value?, label? })` · `removeCase(spec, branchId, { how })` · `moveCase(spec, branchId, index)` | Switch cases (inserted before else, ordered by index) | Duplicate value, editing / deleting / moving `else` |
| `renameBranch(spec, id, label)` | Branch name | Empty |
| `setBranch(spec, ids, branchId \| null)` | Moves points / links / shapes · `R#` rotation group / `A#` Array = the whole group · `null` = always occurs → `warnings` (branchRisks) | Missing id / branch |
| `addVariable(spec, { name, kind?, unit?, expr, rules?: [{ when, value, warn?, error? }], note?, index? })` · `editVariable(spec, name, {…})` · `renameVariable` · `removeVariable` · `moveVariable(spec, name, index)` · `variableUses(spec, name)` | Variables (rules = if / elif, first true wins) · `kind: "bool"` = condition only | Duplicate / reserved name, expression type, **cycles** (variables / points), unknown `{name}` in text, missing CorridorError, deleting while in use |
| `addCutFill(spec, { hinge, cut, fill, params, dir, … })` (cut / fill = number x of 1:x, or text like a slope field: `1:1.5` `0.667` `2%` parameter name, expression) · `addIntersect` · `addOffset` · `addExtendToGround` · `addFollowClipped` · `addArray` · `updateArray(spec, id, …)` · `rebuildArray(spec, id, …)` · `setParamBounds` · `setParamUnit` | From rounds 4c / 4e (same args; Array uses the id), wrapped to return `{ ok, error }` | As the originals |
| `setArrayLoop(spec, id, loop \| null)` · `removeArray(spec, id)` · `addLastOf(spec, arrayId, pointId, opts?)` | Loop on / off · dissolve the Array (objects stay) · create a "last set" point, returns `{ result: id }` (round 5b; see [array-loop.md](array-loop.md)) | Invalid N / max / rounding, point not in the original set, missing Array |
| `describe(spec, evalResult?)` | Short JSON: parameters, conditions (+ current values), decision → branch → object (+ occurs?), always-occurring objects, arrays, risks | — |
| `toText(spec, evalResult?)` | Text view (variables / conditions / arrays / always occurs / if · elif · switch nested any depth) · with results = appends "← ตอนนี้" | — |
| `diffText(before, after)` | What changed between two specs, as Thai lines (`+` added · `-` removed · `~` edited): parameter, variable, condition, decision (move / kind / label), branch, Array, object (added / removed / moved branch). prompt-6 uses it to show AI edits before confirming | — |
| `nameError(spec, name)` · `freeCondName(spec)` | Check a name · next free name | — |

Example (node; see `SA.Tests/js/logicops.test.js`):

```js
const r = Logic.addCondition(spec, { name: "IsCut", expr: "ground(P2) > P2.y" });      // { ok, cond: "C1", decision: "D1", yes: "B1", no: "B2" }
Logic.setBranch(spec, ["P3", "L2"], r.yes);                                            // the cut slope occurs only in the yes branch
Logic.addCondition(spec, { name: "HighFill", expr: "P2.y - ground(P2) > 3", parentBranch: r.no });   // elif
const w = Logic.addDecision(spec, { kind: "switch", test: "ProtectionType", cases: [{ value: 1, label: "หินเรียง" }, { value: 2, label: "คอนกรีต" }] });
Logic.addCase(spec, w.decision, { value: 1 });   // { ok: false, error: "ค่า case 1 ซ้ำ" }; the spec does not change
```

## Lower-level functions from round 4c

In `spec.js` (`Spec.*`), usable in the web and in node:

`setParamBounds(spec, name, { positive, min, max })` · `paramBoundsIssue(param)` · `addCutFill(spec, o)` · `addIntersect(spec, l1, l2, { trim, keep1, keep2, aux })` · `addOffset(spec, linkId, dist, side, { aux })` · `addExtendToGround(spec, linkId, end, { codes, pointCodes, maxDistance, rewire, target })` · `addFollowClipped(spec, from, to, { refLink | refLevel, side, codes, codesGround, codesLine, target, aux })` · `clipPath(...)` · `addArray(spec, sel, { n, dx, dy, join })` / `updateArray(spec, g, { dx, dy })` / `rebuildArray(spec, g, { n, join })` / `arrayOf(spec, kind, id)` · `isAlias(spec, id)` / `auxEnd(spec, id)` (real end).
