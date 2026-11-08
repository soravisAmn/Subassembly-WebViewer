# Array and Loop

Thai labels in quotes are the text shown in the web.

## Array (round 4c)

Repeats a set of objects like AutoCAD's ARRAY (single straight line), e.g. the stairs of `pavement-assembly.cs` that used to be drawn point by point.

- **Select** drawn points / links / shapes (a link brings its ends · a shape brings its links) → **Array** button (Geometry group) → dialog:
  - **Number of sets** including the original (2–200 · fixed number; N as a parameter = Loop, below).
  - **dx / dy** per set (expression / parameter allowed, e.g. `Tread` / `-Rise` · dx outward + in the Side = Right frame).
  - **Joining**: none · **shared point** = the *to* point of the next set is the *from* point of the previous set (stairs with no duplicate points) · **link** from (previous set) → to (next set).
  - Defaults: an open-line set = dx / dy from the first to the last point of the set + shared point (stairs) · with a shape = as wide as the bounding box, no joining.
- A point of set k = **distance dx, dy from the same point of the previous set** (type "ห่างจากจุด"). Links / shapes / codes / Auxiliary / branches copy from the original → moving the original moves every set · changing a parameter in dx / dy changes every step · the C# is ordinary points / links (Civil 3D does not need to know about Array).
- **Properties** of any piece in the group → **"Array A1"** group: edit **dx / dy** (shifts the whole row · `+` creates a parameter), **number of sets** (rebuilds; refused, with a list, if something else references members), **"เลือกทั้ง Array"**, **"เลิกเป็น Array"** (all pieces remain).
- Deleting a member / the original yourself = asks first, then the Array is dissolved · every step can be undone.
- spec: `arrays: [{ id, source: { points, links, shapes }, n, dx, dy, join: { mode: "share" | "link", from, to } | null, members: [...] }]`

## Loop: an Array whose number of sets is computed at run time (round 5b)

A full example: `tests-civil3d/round5b-demo.cs` (fill embankment with a berm every BermInterval; see [civil3d-testing.md](civil3d-testing.md)).

The existing **Array** button → tick **Loop** (or Properties "Array A1" → ☐ Loop):

| Field | Purpose |
|---|---|
| **N** | Number of sets including the original = expression / parameter / variable, e.g. `floor(Height / BermInterval)` (may reference points / ground). A live preview appears under the field: `7 / 3 = 2.3333 → 2 ชุด (ปัดลง)` |
| **"สูงสุด"** (max) | Sets built in advance (default 10 · 2–50). Set k (original k = 0) **occurs when k < N**; not occurring = like an object in an inactive branch (not an error) |
| **"ปัดเศษ N"** | N not an integer: (not chosen = round down + ℹ) · floor · ceil · round (.5 rounds away from zero, same in web and C#) |

- **Abnormal N** = ⚠ warning (web + Civil 3D Event Viewer): above max → uses max (`ValueTooLarge`) · below 1 → uses 1 (`ValueTooSmall`) · not computable → uses 1 (`Failure`).
- **ℹ information** (blue; web only, not sent to Civil 3D) = the system used a default because nothing was chosen (e.g. round down).
- **Messages** tab: identical messages on one line (×n) · separate ⚠ / ℹ badges · **clicking an Array message selects the whole Array**.
- Functions in every expression field: `floor(x)` `ceil(x)` `round(x)` (round .5 away from zero: 2.5 → 3, −2.5 → −3).
- C#: `int N_A1 = LoopN(cs, "A1", () => Height / BermInterval, 10, 0);` once, then every line of set k = `N_A1 > k ? … : null` (shape = `if (N_A1 > k) AddShape…`) → Points / Links / Shapes in Civil 3D contain only sets that occur · files with no Loop generate byte-identical code.
- spec: `arrays[].loop = { n: "expression", nMax: 10, nRound?: "floor" | "ceil" | "round" }` (absent = fixed-N Array) · Logic API: `addArray(…, { loop })` / `updateArray(spec, id, { n, nMax, nRound, dx, dy })` / `setArrayLoop(spec, id, loop | null)` / `removeArray`.
- **Counter `i`** (only in an Array's dx / dy fields): index of the set being placed; original 0, next 1, 2, … e.g. `dx = 1 + 0.5 * i` widens each step by 0.5. (Substituted as a number in each set's points: `1 + 0.5 * (2)` · `i` elsewhere = error · a parameter cannot be named `i`.)
- **"Last set" point (`lastOf`)**: select a point of the original set → Properties "Array A1" → **"สร้างจุด "ชุดสุดท้าย" ของ P3"** = an Auxiliary point at the same point of the last set that occurs (tries last set → … → original, like firstOf). It **can be the end of a real link**, for what continues after the Array. (The list follows the number of sets · max can be edited even with lastOf referencing · C#: `FirstOf(cs, "P8", P7, P6, P5, P4, P3)`.)
- **`count(A1)`** in every expression field = the current number of sets (Loop = N after rounding / clamping · fixed Array = n), e.g. condition `count(A1) >= 3` · C# = `N_A1` (or a number).
- **Referencing a point of set 2 or later of a Loop from outside the Array** = ⚠ in Properties "อ้าง P5 ของ A1 ชุดที่ 3 (Loop — อาจไม่เกิดถ้า N น้อย ใช้ lastOf)" (like referencing a point in a branch) · Logic API `addLastOf(spec, "A1", "P3")` → `{ result: "P8" }`.
- **Left tree → Arrays** (below Variables · only when there is an Array): each Array = `A1 Loop N = … · สูงสุด 10` + a **×N now** chip (updates live when editing parameters / dragging ground) + ⚠ / ℹ (hover = message). Below the Array = set 1 (original), set 2, … with the set's objects · ✓ = occurs now · faded – = does not · click an Array = select the whole Array · click a set = select that set. An Array in an inactive branch shows – instead of ×N.
- **On the drawing** (item being edited): blue label **"A1 ×3"** at the first point of the original set · **show all cases** = sets not occurring are drawn as faded dashes labelled ‹A1 ชุดที่ 5› (like objects in a branch).
- **Scenarios**: the list shows `A1 ×N` for each case · the Logic tab + Arrays tree warn ⚠ "ยังไม่มี scenario ที่ Loop A1 N = 1 / N = สูงสุด (10)" (the edges of a Loop that should be tested).
- **Text view** (Logic tab → "ข้อความ" / `Logic.toText`): an `Arrays:` header + `ทำซ้ำ A1 (P6, P7, L5): N = floor(Height / BermInterval) สูงสุด 10 ปัดลง (ค่าเริ่ม) · dx = … · dy = … ← ตอนนี้: 3 ชุด`. Members of set 2.. are shortened to "สมาชิก A1 (ชุด 2–10)" · `Logic.diffText` reports + / - Array, ~ N / max / rounding / dx / dy / joining / Loop on-off, "~ A1 สร้างสมาชิกใหม่" (does not list member ids one by one).
- Old bug fixed: **"+ บันทึกกรณีนี้"** stored parameters by reference to the live values, so later edits changed the just-saved case (until a page reload). Values are now copied on save.
