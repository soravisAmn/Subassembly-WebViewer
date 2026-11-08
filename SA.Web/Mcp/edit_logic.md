# Editing logic: conditions, variables, Loop

Read `sa_guide` first. Start from the text view in `sa_describe`.

## Which to use

| Need | Use |
|---|---|
| Clamp a value the user enters to a range | Parameter `min` / `max` |
| A value depending on other values, ground or points, several cases, a custom warning | `addVariable` |
| Geometry that exists or not by a condition | `addCondition`, then `setBranch` |
| Alternatives by a number | `addDecision` with `kind: "switch"` |
| A repeated set whose count is computed | `addArray` with `loop` |

## Conditions

- `addCondition` makes the condition, an if decision and yes / no branches; it returns `yes` and `no`. `parentBranch` set to the other decision's "no" branch = elif.
- Move objects with `setBranch(ids, branchId)`; `null` = always occurs. Read `warnings`: a warning means an object references a point that occurs only in some branch.
- After branches, continue geometry from a `firstOf` point listing the end of each branch. As auxiliary it can be the end of a real link.
- Expressions: `P3.x`, `P3.y`, `ground(P3)`, `exists(P3)`, `hasGround()`, `and or not`, `if(c, a, b)`, `floor ceil round`, `min max abs sqrt pow`, `sin cos tan` (degrees), `atan`.
- Before removing a condition that looks duplicated, check that its decision and branches can go: `removeDecision` with `how: "parent"` keeps objects in the parent branch; compare `toText` before and after.

## Variables

`rules` are if / elif; the first true wins. `warn` may use `{Name}`. A value depending on points is unknown when a point cannot be found. Cycles are refused.

## Loop

`addArray(sel, { n: 2, dx, dy, join, loop: { n: "floor(H / Step)", nMax: 10, nRound: "floor" } })`.

- Set k (original = 0) occurs when k < N. N below 1 uses 1, so if nothing should exist, put the Array in a branch and use `max(1, ...)`.
- `i` is the set index, only in dx / dy. dx / dy shift a whole set equally.
- Continue after the Array from `addLastOf(arrayId, pointId)`, never from a middle set. `count(A1)` is the current count.

## After editing

Run `sa_check`: every branch should be entered and Loop N should reach 1 and the maximum. If a scenario is missing, add one with `sa_scenarios`.
