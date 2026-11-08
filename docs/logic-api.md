# Logic API: `js/logicops.js`

One set of pure functions for editing the logic / objects of a drawn part (no page access; works in the web and in node). Every part of the web calls this set (Properties "เกิดเมื่อ", Logic tab, Daylight Cut/Fill, Intersect, Offset, Extend to Surface, Clipped Surface Link, Array, Parameter table, draw into branch `B`). prompt-6 wraps it as MCP tools.

- Result: `{ ok: true, …result, warnings? }` or `{ ok: false, error: "Thai message" }`. **On error the spec does not change at all** (works on a copy first, then replaces · same `spec` object).
- In the web, call through `specEdit(sp => Logic.xxx(sp, …), item, "action name")` = 1 Undo · an error = a message in the banner and no Undo step.
- The last `opts` argument (optional) = `{ codeParams }`: parameters of existing code (imported files) that expressions may use.
- Names (conditions, etc.): English letters / digits / `_`, not starting with a digit · must not duplicate parameters / conditions / points · must not be names the code uses (`Logic.RESERVED`, forms like `P1` `L2` `D3` `B4` `C5` …) / words used in expressions.

The table below is generated from `Logic.META` in `logicops.js`, the same source as `Logic.catalog()`. After adding a function, add its META row and run `node SA.Tests/gen-logic-doc.js`; `logicbatch.test.js` fails if the two differ.

Functions added in round 6 report errors in English because the AI reads them. Older functions still report in Thai.

## applyBatch

```js
Logic.applyBatch(spec, [
  { as: "a", fn: "addPoint", args: [{ type: "delta", from: "P1", dx: "Width", dy: "0" }, ["Top"]] },
  { fn: "addLink", args: ["P1", "${a.result}", { codes: ["Top"] }] }
]);   // { ok, results: [...], warnings: [...] } or { ok: false, error: "op 1 (addLink): ...", failedOp: 1 }
```

- Runs in order, all or nothing: on failure the spec is unchanged.
- `as` names an op's result. `${name.path}` in any string reads it, including inside expressions (`"${a.result}.y - H"`). A string that is exactly one reference keeps the value's type (lists, objects).
- `fn` must be a batch function in `Logic.META`. Nothing is evaluated as code.

## Functions

<!-- BEGIN generated from Logic.META by SA.Tests/gen-logic-doc.js. Do not edit by hand. -->

### Conditions

| Function | Does | Possible errors |
|---|---|---|
| `addCondition({ name?, expr, note?, parentBranch?, decision?, label?, yes?, no? })` | Condition + if decision + yes / no branches (names start at Cond1). parentBranch = the "no" branch of another decision = elif. decision: false = condition only. | Duplicate / reserved name, not true/false, missing point, missing branch |
| `editCondition(name, { expr?, note? })` | Edit expression / note. | Wrong type, circular reference |
| `renameCondition(old, name)` | Tests / expressions / labels using the old name follow. | Duplicate name |
| `removeCondition(name, { how })` | Decisions using it are deleted too (how). | Still used by another expression (lists them) |

### Decisions

| Function | Does | Possible errors |
|---|---|---|
| `addDecision({ parentBranch?, kind, test, label?, cases?, elseLabel? })` | if (true/false expression) or switch (numeric expression + cases: [{ value, label }] + else always last). | Test type, duplicate / non-numeric case |
| `editDecision(id, { test?, label?, kind? })` | Change if / switch (yes = case 1, no = else). | A switch with several cases cannot become if |
| `removeDecision(id, { how })` | how: parent (default) \| always \| remove (deletes objects too). Nested decisions go too. |  |
| `moveDecision(id, parentBranch \| null)` | Moves the whole block to nest in another branch (make / undo elif). | Moving into its own branch |
| `addCase(decisionId, { value, label? })` | Add a switch case (inserted before else). | Duplicate value |
| `editCase(branchId, { value?, label? })` | Edit a switch case. | Duplicate value, editing else |
| `removeCase(branchId, { how })` | Delete a switch case. | Deleting else |
| `moveCase(branchId, index)` | Reorder a switch case. | Moving else |
| `renameBranch(id, label)` | Branch name. | Empty |
| `setBranch(ids, branchId \| null)` | Moves points / links / shapes. R# rotation group / A# Array = the whole group. null = always occurs. Returns warnings (branchRisks). | Missing id / branch |

### Variables

| Function | Does | Possible errors |
|---|---|---|
| `addVariable({ name, kind?, unit?, expr, rules?: [{ when, value, warn?, error? }], note?, index? })` | Variable (rules = if / elif, first true wins). kind: "bool" = condition only. | Duplicate / reserved name, expression type, cycles, unknown {name} in text, missing CorridorError |
| `editVariable(name, { … })` | Edit a variable (same fields). | As addVariable |
| `renameVariable(old, name)` | Expressions and warning text follow. | Duplicate name |
| `removeVariable(name)` | Delete a variable. | Still in use |
| `moveVariable(name, index)` | Reorder a variable. |  |
| `variableUses(name)` | Where a variable is used. |  |

### Parameters

| Function | Does | Possible errors |
|---|---|---|
| `addParam({ name, kind?, default, displayName?, unit?, positive?, min?, max? })` | Add a parameter. kind: double (default) \| long. unit: number \| slope \| length \| percent. | Bad / duplicate name, non-numeric default, min > max, unknown unit |
| `editParam(name, { name?, kind?, default?, displayName?, unit?, positive?, min?, max? })` | Edit a parameter. Renaming updates every expression. | As addParam |
| `removeParam(name)` | Delete a parameter. | Still used by expressions (lists them), Side parameter |
| `setParamBounds(name, { positive, min, max })` | Parameter limits. |  |
| `setParamUnit(name, unit)` | Parameter value type. |  |

### Objects

| Function | Does | Possible errors |
|---|---|---|
| `addPoint(def, codes?, { aux?, branch? })` | Add a point. def.type: delta, polar, slopeLength, slopeToSurface, onSurface, between, intersect, offset, extendToGround, firstOf, external (fields: catalog pointTypes). Returns the id in result. | Unknown type, missing field / point, bad expression |
| `editPoint(id, patch)` | Merge fields into a point definition (a different type replaces it). | As addPoint, circular reference, origin / tangent / lastOf |
| `setCodes(ids, codes)` | Replace the codes of points / links / shapes. | Missing id |
| `setAuxiliary(ids, on, { cascade? })` | Make points / links auxiliary or real. cascade accepts the side effects the UI asks about. | Side effects without cascade, shape id |
| `removeObjects(ids)` | Delete objects and what depends on them (listed in warnings). | Missing id, origin |
| `addLink(a, b, { type?, codes?, aux?, optional?, branch?, target?, via?, radius?, sweep?, large?, seg? })` | Add a link. type: straight (default) \| followSurface \| arc3 (via) \| arcR (radius, sweep cw \| ccw, large). | Same point twice, missing point, real link on an auxiliary point |
| `editLink(id, patch)` | Edit link fields: codes, codesGround, codesLine, optional, target, radius, sweep, large, seg, side, refLink, refLevel. | Other fields, bad expression |
| `addFillet(link1, link2, radius, { aux? })` | Fillet at the corner of 2 straight links. | Not straight / not joined |
| `addShape(linkIds, codes?, { branch? })` | Add a shape from links in order around it. | Fewer than 3 links, auxiliary link |
| `addPolygon(pointIds, { codes?, linkCodes? })` | Free polygon: links around the points + a shape. Returns links, shape. | Fewer than 3 points, auxiliary point |
| `addRegularPolygon({ center, n, radius, angle?, mode?, aux?, codes? })` | Regular polygon, n 3–24. mode: inscribed \| to edge midpoint. | Bad n, missing centre |
| `addRotateGroup(ids, pivot, angle)` | Rotation group (angle may be an expression). Points that cannot rotate are listed in warnings. | Nothing can rotate |
| `moveObjects(ids, { dx, dy, convert? })` | Move by dx, dy (right +, up +, Side = Right frame), keeping point meanings. | Blocked points without convert |
| `copyObjects(ids, { dx, dy, convert? })` | Copy, then move the copy. Returns the new points, links, shapes, map. | Blocked points without convert |

### Tools

| Function | Does | Possible errors |
|---|---|---|
| `addCutFill({ hinge, cut, fill, params, dir, … })` | Daylight Cut/Fill. cut / fill = number x of 1:x, or text like a slope field: 1:1.5, 0.667, 2%, parameter name, expression. | As the tool |
| `addIntersect(link1, link2, { trim, keep1, keep2, aux })` | Intersect two straight links. | Parallel, not straight |
| `addOffset(linkId, dist, side, { aux })` | Parallel line: 2 points + link. | Not straight, bad expression |
| `addExtendToGround(linkId, end, { codes, pointCodes, maxDistance, rewire, target })` | Extend to Surface. Returns tip (real end), link. | Not straight |
| `addFollowClipped(from, to, { refLink \| refLevel, side, codes, codesGround, codesLine, target, aux })` | Clipped Surface Link. Returns link. | Missing reference |

### Arrays

| Function | Does | Possible errors |
|---|---|---|
| `addArray(sel, { n, dx, dy, join, loop? })` | Array or Loop (loop: { n, nMax, nRound }). Returns id. | See array-loop.md |
| `updateArray(id, { dx, dy, n, nMax, nRound })` | Edit an Array / Loop; n or nMax may rebuild. | Members referenced from outside |
| `rebuildArray(id, { n, join })` | Rebuild an Array. | Members referenced from outside |
| `setArrayLoop(id, loop \| null)` | Loop on / off. | Invalid N / max / rounding |
| `removeArray(id)` | Dissolve an Array (objects stay). | Missing Array |
| `addLastOf(arrayId, pointId, opts?)` | Create a "last set" point. Returns the id in result. | Point not in the original set, missing Array |

### Batch

| Function | Does | Possible errors |
|---|---|---|
| `applyBatch(ops)` | Run [{ fn, args, as? }] in order, all or nothing. "${name.path}" in a string reads an earlier op's result. Failure returns failedOp and the reason. | Any op's error, unknown fn or reference |
| `newSubassembly(name, { namespace?, sideParam?, targets? })` | New spec. Takes no spec argument; the result is the spec. | Invalid class name |

### Reading

| Function | Does | Possible errors |
|---|---|---|
| `catalog()` | Functions, point types, link types and key rules. |  |
| `describe(evalResult?)` | Short JSON: parameters, conditions (+ current values), decision → branch → object (+ occurs?), always-occurring objects, arrays, risks. |  |
| `toText(evalResult?)` | Text view (variables / conditions / arrays / always occurs / if · elif · switch, any depth). With results, appends "← ตอนนี้". |  |
| `diffText(before, after)` | What changed between two specs, as lines (+ added, - removed, ~ edited). |  |
| `nameError(name)` | Check a name. |  |
| `freeCondName()` | Next free condition name. |  |
| `guessError(when)` | Guess the CorridorError for a rule condition. |  |

<!-- END generated -->

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
