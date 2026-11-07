# รอบ 4c — ข้อเสนอ Milestone 0 (จัดปุ่มใหม่ตามงานจริง)

> ไฟล์นี้ = สิ่งที่เสนอใน M0 + คำตอบของผู้ใช้ (หัวข้อ "ตกลงแล้ว" ท้ายไฟล์ — ถ้าขัดกับข้อก่อนหน้าให้ถือหัวข้อนั้น) — M1 เป็นต้นไปทำตามนี้

## 0. สถานะตอนเริ่ม (2026-11-07)

- git: `main` ตรงกับ `origin/main` (`bc355bd` รอบ 4b M3) · ไฟล์ค้างของผู้ใช้: `CLAUDE.md` (สถานะ "ถัดไป"), `prompt-5.md` (ฉบับย่อ), `prompt-4c.md`,
  `prompt-flowchart-later.md` (ใหม่) — ยังไม่ commit · ไฟล์ที่ไม่ commit เหมือนเดิม: `pavement-assembly.cs`, `TEST.assembly.json`, `br.cs`
- test เดิม: C# **94 / 94** · JS **14 ไฟล์ผ่านทั้งหมด** (arc 19, auxiliary 11, cond 13, evaluator 16, history 6, limit 19, logic 22, ops 9, polygon 12,
  rot 15, select 6, snap 17, track 14, view 6)
- อ่านแล้ว (อ่านอย่างเดียว): `base_rock-pitching.cs` (`BuildBottom`, `extendOutside/Inside`, `IntersectFrom`), `body_rock-pitching.cs` (`BodyGeometry.ParallelY`,
  `_kv`, `EndCrossing`, `BuildBottom` + `cleaned`) — แพทเทิร์น A–F ตาม prompt ตรงกับที่เห็นในโค้ด

---

## 1. เอา Max / Min ออก (ข้อ 1) — รายการที่จะลบ

| ที่ | ลบอะไร |
|---|---|
| `index.html` | ปุ่ม `data-tool="limit"`, `<script src="js/limit.js">` (+ ปุ่ม `bounds` ตามข้อ 2) |
| `js/limit.js` | ทั้งไฟล์ |
| `js/spec.js` | `LIMIT_*`, `limitOptions`, `limitRefs`, `setLimit`, `removeLimit`, `limitWhat`, `solveLimit`, `f2`, `limitPt` ใน evaluate, `limits` ในผลคำนวณ, `limits` ใน `exprOpts`, slot ใน `exprSlots`, ส่วน limit ใน `removeCascade` / `dependsOn` / `branchRisks` |
| `js/ui.js` | กลุ่ม Max / Min ใน Properties (`limitGroup` / `limitSet`), ส่วน Max / Min ในแท็บ Logic (`limChip`, `limitCoverage` ที่ใช้), ข้อความ scenario "Max / Min ไม่ผ่าน", `closeDialog` → `limitPreviewClear`, ชื่อสงวน `Limit SolveLimit Normal AlongLen F2 LimAlong LimAct _p`, รูปแบบ `P\d+_lim` |
| `js/draw.js` | เครื่องมือ `limit` / `limitref` (คง `PICK_TOOLS` ไว้ให้ปุ่มใหม่ใช้) |
| `js/workspace.js` | ไอคอน ↕, เส้นขอบตอนเลือกจุด, `renderLimitPreview` |
| `js/ops.js` | สำเนา limit ใน `clone`, บล็อกหมุนจุดที่มี limit ใน `rotatePlan` |
| `js/expr.js` / `SpecExpr.cs` | ฟังก์ชัน `limited()`, `limits` / `Limits` ในการตรวจ |
| `css/app.css` | `.lim-*`, `.modal.side` (เก็บ `.modal.side` ไว้ถ้าหน้าต่างของปุ่มใหม่ใช้ — ดูข้อ 4) |
| `CodeGenerator.cs` / `DrawingSpec.cs` | `SpecLimit` / `SpecLimitRef` / `SpecPoint.Limit`, `LimitLine`, `LimitWhat`, `LimitedUsed`, helper `Limit` / `SolveLimit` / `Normal` / `AlongLen` / `F2`, enum `LimAlong` / `LimAct`, regex source map ของ `Limit`, ชื่อสงวนที่เกี่ยว |
| test | `SA.Tests/js/limit.test.js`, drawing-cases 55–66 (Max / Min + round4b-demo), test เทียบ rock-pitching แบบ Max / Min ใน `DrawingTests.cs` (ได้ test ใหม่ข้อ 9 แทน), test `limited()` ใน `ExprTests.cs` |
| `tests-civil3d/` | `round4b-demo.cs`, `round4b-demo.assembly.json`, `round4b-checklist.md` |
| `README.md` | หัวข้อ Max / Min, แถวในตาราง drawer, `limit.test.js`, รอบ 4b ด้านบน, ตาราง "ใช้อันไหนเมื่อไร" (เขียนใหม่ตามปุ่มชุดใหม่) |

**ของเก่า** (project `.assembly.json`, `sa-spec` ใน .cs, localStorage):
- เปิดได้ไม่ crash: ตอนโหลด spec (`Spec.normalize` — จุดเดียวกับที่แปลง `construction` → `auxiliary`) **ตัด `limit` ทิ้งเลย** แล้วขึ้นข้อความครั้งเดียว
  "Max / Min ถูกเอาออกแล้ว — จุด P5, P7 ใช้ตำแหน่งตามนิยามเดิม" (เสนอตัดตอนโหลดแทนตอน Save — ผลเหมือนกัน และไม่มีโค้ดค้างไว้อ่าน limit)
- C#: `DrawingSpec` ไม่มี field `limit` แล้ว → JSON ที่มี `limit` อ่านผ่าน (System.Text.Json ข้าม field ที่ไม่รู้จัก) · โค้ดที่สร้างใหม่ไม่มี `Limit(...)`
- นิพจน์ที่ใช้ `limited(P5)` → error เดิมของตัวแยกนิพจน์ **"ไม่มีฟังก์ชัน limited() (ตำแหน่ง n)"** ทั้ง JS / C# (ไม่เดาให้)
- `prompt-4b.md` / `prompt-4b-design.md` เติมบรรทัดแรก "> **ยกเลิกแล้วในรอบ 4c** — เก็บไว้เป็นประวัติ"
- เป็น **commit แยก** (ขออนุญาตก่อน) ก่อนงานอื่นของ M1

## 2. ขอบเขตค่า → ตาราง Parameter (ข้อ 2, แพทเทิร์น A)

- ลบปุ่ม `bounds` · parameter ได้ field ใหม่ **`positive: true`** = "ต้องมากกว่า 0" (ตาราง: checkbox) · `min` / `max` เดิม = "ขั้นต่ำ" / "ขั้นสูง"
- ลำดับตรวจตรงกับไฟล์ของผู้ใช้: **≤ 0 ก่อน** (error + ใช้ default) → แล้วค่อย ขั้นต่ำ / ขั้นสูง (เตือน + ใช้ค่าขอบ)
- ตารางเตือนทันทีเมื่อ default ขัดกับขอบเขต: "default 1 ต่ำกว่าขั้นต่ำ 2 — Civil 3D จะเตือนทุกครั้งที่ใช้ค่า default" · default ≤ 0 ทั้งที่ติ๊ก "ต้องมากกว่า 0" = แดง
- ปุ่ม **Parameter** บนหัว Properties ตอนอยู่ใน Edit (+ โหนด Parameters ในต้นไม้เดิม)
- เว็บ: ≤ 0 ขึ้นใน Messages เป็น **error สีแดง** (ระดับ Severe แบบ C#) ส่วนขั้นต่ำ / ขั้นสูง = เตือนสีเหลือง

C# ที่ได้ (แบบเดียวกับ `base_rock-pitching.cs` บรรทัด ~150–170):
```csharp
        double Depth = GetDouble(cs, "Depth", 2.0);
        if (Depth <= 0.0) { Error(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "Depth"); Depth = 2.0; }
        if (Depth < 2.0) { Warn(cs, CorridorError.ValueTooSmall, "Depth = " + Depth + " < 2, ใช้ 2 แทน"); Depth = 2.0; }
```
`Error` = helper ใหม่ (`RecordError(..., CorridorErrorLevel.Severe, ...)` — API เดิม ไม่เพิ่มใน shim) · ถามข้อ 7 เรื่องหน่วย "m" ในข้อความ

## 3. เปลี่ยนชื่อ "ถ้าตัด / ถม" (ข้อ 3)

- ชื่อ (ถามข้อ 1): **"ลาดชนดิน ตัด/ถม"** · ข้อมูล / `data-tool="cutfill"` / `Spec.addCutFill` คงเดิม
- หัวหน้าต่าง: ประโยค "ดินสูงกว่าจุดไหล่ → ใช้ลาดตัด (เชิดขึ้น) · ดินต่ำกว่า → ใช้ลาดถม (ลงล่าง) — subassembly เลือกเองทุกสถานี"
  + SVG เล็ก 2 ช่อง (ช่วงเนิน: ลาดขึ้นชนดิน / ช่วงที่ลุ่ม: ลาดลงชนดิน)
- คำใน tooltip / แท็บ Logic / README / banner เปลี่ยนตาม

---

## 4. "ต่อลงถึงดิน" (ข้อ 4, แพทเทิร์น C) — ชนิดจุดใหม่ `extendToGround`

```jsonc
{ "id": "P7", "codes": ["E3"], "def": { "type": "extendToGround", "from": "P3", "along": "P2", "target": "TargetSurface", "maxDistance": "50" } }
// P7 = ต่อเส้น P2 -> P3 เลย P3 ออกไป (ความชันเดิม) จนชนดิน — เฉพาะเมื่อดินที่ offset ของ P3 ต่ำกว่า P3
```
- **ลอย** (ดินที่ x ของ `from` ต่ำกว่า `from.y`) → จุดชนดินตามแนว along → from
- **ไม่ลอย / ไม่มีดิน (Layout / ไม่มี target)** → จุด **ไม่เกิดแบบปกติ** (เหมือนอยู่ในกิ่งที่ไม่เกิด: ไม่วาด ไม่เตือน, link ที่ใช้มันไม่เกิดตาม)
- ต่อแล้วไม่ชนดินภายใน `maxDistance` (ระยะราบ) → เตือน + ไม่เกิด
- **"ปลายจริง"** ใช้ชนิด `firstOf` ที่มีอยู่แล้ว: `{ type: "firstOf", points: ["P7", "P3"] }` (auxiliary) — ต่อ = จุดชนดิน ไม่ต่อ = ปลายเดิม
  → ปุ่มสร้างให้ครบ: จุดต่อ + link ต่อ (P3 → P7, code = code ของ link เดิม) + จุดปลายจริง
- **shape ปิดได้ทั้งสองกรณีโดยไม่ต้องมีสองชุด**: link ต่อมีธง **`optional: true`** = ใน shape ถ้า link นี้ไม่เกิด ให้ข้ามไป
  (ขอบถัดไปเริ่มที่ "ปลายจริง" = P3 อยู่แล้ว จึงยังปิดรูป) · link อื่นที่ไม่เกิดใน shape ยังเตือนเหมือนเดิม
- ตรงกับไฟล์ของผู้ใช้: base `extendOutside` = ต่อเส้นข้าง P2→P3 ลงชนดินเมื่อ `ElevationAt(p3.U) < baseY` · body = ต่อเส้นปิดปลาย F→O ลงชนดินเมื่อดินที่ O ต่ำกว่า O

C# ที่ได้:
```csharp
        Pt? P7 = ExtendToGround(cs, "P7", surface, P3, P2, 50.0);   // P7 ต่อ P2→P3 ลงถึงดิน (ไม่ลอย / ไม่มีดิน = ไม่เกิด)
        Pt? P8 = FirstOf(cs, "P8", P7, P3);                        // P8 ปลายจริง (auxiliary)
        ...
        Point p7 = AddPoint(cs, P7, "E3");                          // P7 null = ไม่เพิ่ม (helper เดิมข้ามเงียบอยู่แล้ว)
        Link l7 = AddLink(cs, "L7", p3, p7, "TrapSide");             // ปลาย null = ไม่เกิด (เงียบ — helper เดิม)
        AddShape(cs, "S1", Join(..., Opt(l7), ...), "Trapezoid");    // Opt = ข้ามเมื่อ null (AddShape เดิมเตือนเมื่อเจอ link null)
```

## 5. "ตามดิน ไม่เกินเส้น" (ข้อ 5, แพทเทิร์น D) — ชนิด link ใหม่ `followClipped`

```jsonc
{ "id": "L8", "type": "followClipped", "from": "P8", "to": "P9", "target": "TargetSurface",
  "ref": { "link": "L5" },              // เส้นอ้างอิง (ต่อออกไปได้ทั้งสองทาง) | { "level": "-Depth" } = ระดับคงที่เทียบ origin
  "side": "below",                      // below = ไม่สูงกว่าเส้น (ขอบล่างแบบ rock-pitching) | above = ไม่ต่ำกว่าเส้น
  "codes": ["Datum"],                   // ทุกช่วง
  "codesGround": ["TrapOnSurface"],     // ช่วงที่ตามดิน
  "codesLine": ["TrapBase"] }           // ช่วงที่อยู่บนเส้น
```
- เส้นทาง = ตามผิวดินจาก `from` ถึง `to` (จุดหักของดินระหว่างทาง) แล้ว `y = min(ดิน, เส้น)` (below) · เพิ่ม **จุดที่ดินตัดเส้น** · ตัดจุดซ้ำ (< 0.0001 m)
  และจุดกลางที่อยู่บนเส้นตรงเดียวกันและเป็นช่วงชนิดเดียวกัน (แบบ `cleaned` / `result` ในไฟล์ของผู้ใช้) · ปลายทั้งสอง = `from` / `to` ตัวจริง
- ช่วงบนเส้น = ปลายทั้งสองของช่วงอยู่บนเส้น (ห่าง < 0.0001) แบบ `IsOnBase` / `IsOnLine` · นอกนั้น = ช่วงตามดิน
- **ไม่มีดิน** (Layout / ไม่มี target) → เส้นตรง `from` → `to` · code = `codes` + `codesLine`
- เส้นอ้างอิงเป็น auxiliary ได้ (ปกติจะเป็น) · `ref.level` เป็นนิพจน์ได้
- ใน C# = หลาย link (ตัวแปร `Link[]` แบบเส้นโค้ง) — shape ใช้ได้ด้วย `Join` เดิม:
```csharp
        Link[] l8 = FollowClipped(cs, "L8", surface, P8, p8, P9, p9, P4, P5, true, new[] { "Datum" }, new[] { "TrapOnSurface" }, new[] { "TrapBase" });
        // L8 ตามดิน ไม่สูงกว่าเส้น L5 (P4–P5 ต่อออกไปได้)
```
- เว็บ: วาดเหมือน link ตามดิน · คลิกเลือกได้ทั้งเส้น · ป้ายช่วงตาม code (legend สีตาม code เดิม)

## 6. "Intersect" (ข้อ 6) — ใช้ชนิดจุด `intersect` เดิม

- banner: "Intersect: คลิกเส้นที่ 1" → "คลิกเส้นที่ 2 · **T** = ตัด/ยืดเส้นด้วย (ตอนนี้: …)" · preview จุดตัด + เส้นประส่วนที่ยืด · ขนาน = "เส้นขนานกัน ไม่มีจุดตัด"
- ได้จุด `{ type: "intersect", a1, a2, b1, b2 }` (ปลายของสองเส้น ณ ตอนคลิก) — เส้นขยับ จุดตามเอง
- **ตัด/ยืด** (แบบ FILLET 0): แต่ละเส้นเก็บปลายฝั่งที่คลิก อีกปลายเปลี่ยนเป็นจุดตัด (จุดเดิมยังอยู่ — ใช้คำนวณจุดตัดต่อ) · undo ครั้งเดียว
- link ตรง (รวม auxiliary และเส้นจาก Offset) · โค้ง / ตามดิน → banner บอก "Intersect ใช้กับเส้นตรงเท่านั้นในรอบนี้"
- shortcut `I` (ถามข้อ 3) · ตัวเลือก `T` ใช้ได้เฉพาะตอนอยู่ในคำสั่ง (ตัวเลือกระหว่างคำสั่งชนะ shortcut — Arc ใช้ T ตอนวาด Arc เท่านั้น ไม่ชน)

## 7. "Offset" (ข้อ 7, แพทเทิร์น B) — ชนิดจุดใหม่ `offset`

```jsonc
{ "id": "P10", "def": { "type": "offset", "a": "P1", "b": "P2", "end": "a", "dist": "RockThickness", "side": 1 } }
// P10 = ปลาย a ของเส้น P1–P2 เลื่อนตั้งฉากไป dist · side 1 = ซ้ายมือเมื่อมองจาก a ไป b (ในกรอบ Side = Right) / -1 = ขวามือ
```
- คำสั่ง: พิมพ์ระยะ (นิพจน์ / parameter ได้ — จำค่าล่าสุดแบบ Fillet) → คลิกเส้น → คลิกฝั่ง → ได้ 2 จุด `offset` (end a / b) + link ขนาน
  · ทำซ้ำต่อได้จน Esc · checkbox / ปุ่ม `X` = เป็น Auxiliary (แบบเครื่องมืออื่น)
- ตำแหน่ง = ปลายเดิม + `F × side × dist × n` (n = เวกเตอร์ตั้งฉากหน่วยของ a→b) — ฝั่ง Left ถูกเพราะคูณ F (มี test)
- เทียบ `body_rock-pitching.cs`: `ParallelY(u, depth) = -u/FaceSlope − depth·√(1+FaceSlope²)/FaceSlope` = เส้นผิวหินเลื่อนตั้งฉาก depth — test ใช้สูตรนี้ตรงๆ
- C#: `Pt? P10 = Offset(cs, "P10", P1, P2, P1, F * 1.0 * RockThickness);`
- shortcut `O` (ถามข้อ 3) · เฉพาะ link ตรง

## 8. "Array" (ข้อ 8, แพทเทิร์น F)

```jsonc
"arrays": [{ "id": "A1", "source": { "points": ["P6", "P7"], "links": ["L5"], "shapes": [] }, "n": 5, "dx": "0.3", "dy": "-0.1",
             "join": { "from": "P7", "to": "P6" },          // ต่อชุด: link จาก P7 ของชุดก่อน ไป P6 ของชุดถัดไป (null = ไม่ต่อ)
             "members": [["P8", "P9", "L6", "L7"], ...] }]  // ของที่สร้าง (ชุดที่ 2..n)
```
- เลือก object → ปุ่ม Array → หน้าต่างประโยคเดียว "ทำซ้ำอีก [4] ชุด ห่างชุดละ dx [0.3] dy [-0.1] · ต่อชุดด้วย link จาก [P7] ไป [P6]"
- จุดของชุดที่ k = `delta { from: จุดเดียวกันของชุด k−1, dx, dy }` → แก้ dx / dy ทีเดียวขยับทั้งแถว · link / shape ในชุดคัดลอกด้วย (Ops.clone เดิม)
- Properties ของสมาชิก → กลุ่ม "Array A1" แก้ N / dx / dy → สร้างใหม่ทั้งชุด (undo ครั้งเดียว) · ลบสมาชิกเอง = ถามว่าจะเลิกเป็น array ไหม
- N เป็นตัวเลขคงที่ (Loop = ทีหลัง) · ลองกับขั้นแบบ `pavement-assembly.cs` (spec ทดสอบแยก ไม่แตะไฟล์)

## 9. วาด rock-pitching ใหม่ (ข้อ 9) — ลำดับที่วางไว้

**base** (Trapezoid): จุดบน 2 จุด → ลาดข้างสองเส้น (ลาด + ความยาว วัดดิ่ง `Depth`) → **ต่อลงถึงดิน** ที่มุมฐานทั้งสอง → **ตามดิน ไม่เกินเส้น** จากปลายจริงฝั่งใน
ถึงปลายจริงฝั่งนอก อ้างเส้นฐาน (auxiliary ระหว่างมุมฐาน) · `Depth` ขั้นต่ำ 2 ในตาราง Parameter · shape เดียวปิดทุกกรณี
**body**: ผิวหิน → **Offset** RockThickness (ใต้หิน) และ RockThickness + MinSoilThickness (เส้นความหนาขั้นต่ำ, auxiliary) → เส้นปิดปลาย 1:EndSlope จาก F
→ **Intersect** กับใต้หิน / เส้นความหนาขั้นต่ำ → **ต่อลงถึงดิน** ที่ O → **ตามดิน ไม่เกินเส้น** อ้างเส้นความหนาขั้นต่ำ · `MinSoilThickness` ขั้นต่ำ 1
- ต่างกันได้ (จะทำตารางใน README): ลำดับจุดใน shape / จุดแรกของรูป, ชื่อ code ที่ไฟล์เดิมตั้งเอง, error "Height น้อยเกินไป" ของ body (เทียบผลแทนด้วย Messages)

---

## 10. ภาพร่างหน้าต่าง / banner

```
[ลาดชนดิน ตัด/ถม]  ┌ ดินสูงกว่าจุดไหล่ → ลาดตัด (เชิดขึ้น) · ดินต่ำกว่า → ลาดถม (ลงล่าง) — เลือกเองทุกสถานี ┐
                   │  [SVG: เนิน ╱ตัด]   [SVG: ที่ลุ่ม ╲ถม]                                          │
                   └ (ช่องเดิม: ลาดตัด / ลาดถม / parameter / ทิศ / code)                              ┘
[ต่อลงถึงดิน]      banner: "ต่อลงถึงดิน: คลิกเส้น (ใกล้ปลายที่จะต่อ)" → หน้าต่างเล็ก:
                   "ถ้าปลาย P3 ของเส้น L3 ลอยเหนือดิน → ต่อแนวเดิมลงไปชนดิน · code เส้นต่อ [TrapSide] จุด [ ]"  [สร้าง]
[ตามดิน ไม่เกินเส้น] banner: "คลิกจุดเริ่ม" → "คลิกจุดปลาย" → "คลิกเส้นอ้างอิง (หรือพิมพ์ระดับ)" → หน้าต่าง:
                   "จาก P8 ถึง P9 ตามผิวดิน แต่ [ไม่สูงกว่า ▾] [เส้น L5 ▾ | ระดับ …]
                    code ทุกช่วง [Datum] · ช่วงตามดิน [TrapOnSurface] · ช่วงบนเส้น [TrapBase]"  [สร้าง]
[Intersect]        banner: "คลิกเส้นที่ 1" → "คลิกเส้นที่ 2 · T = ตัด/ยืดเส้นด้วย (ปิด)"
[Offset]           banner: "Offset ระยะ RockThickness (พิมพ์เพื่อเปลี่ยน) · คลิกเส้น" → "คลิกฝั่ง · X = Auxiliary · Esc = จบ"
[Array]            หน้าต่าง: "ทำซ้ำอีก [4] ชุด ห่างชุดละ dx [0.3] dy [-0.1] · ต่อชุดด้วย link จาก [P7 ▾] ไป [P6 ▾]"
```

## 11. ฟังก์ชันล้วนสำหรับ Logic API (prompt-5)

`Spec.addCutFill` (เดิม) · `Spec.addExtendToGround(spec, linkId, end, codes)` · `Spec.addFollowClipped(spec, from, to, ref, side, codes)` ·
`Spec.addIntersect(spec, l1, l2, { trim, keep1, keep2 })` · `Spec.addOffset(spec, linkId, dist, side, aux)` ·
`Spec.addArray(spec, sel, { n, dx, dy, join })` / `Spec.updateArray` / `Spec.removeArray` · `Spec.setParamBounds(spec, name, { positive, min, max })`
— รายชื่อนี้จะอยู่ใน README หัวข้อ Logic API

---

## 12. คำถาม — **คำตอบที่เสนออยู่ในวงเล็บตัวหนา**

1. ชื่อใหม่ของ "ถ้าตัด / ถม" — (**"ลาดชนดิน ตัด/ถม"**) · อื่นๆ: "Daylight ตัด/ถม", "ลาด 2 แบบตามดิน"
2. ชื่อปุ่มใหม่ — (**"ต่อลงถึงดิน", "ตามดิน ไม่เกินเส้น", "Intersect", "Offset", "Array"**)
3. Shortcut — (**`I` = Intersect, `O` = Offset** · อีกสามปุ่มกดจาก drawer)
4. spec เก่าที่มี Max / Min — (**ตัดทิ้งตอนโหลด + แจ้งครั้งเดียว** — ผลเหมือน "ตัดตอน Save" ที่ prompt เสนอ แต่ไม่ต้องเก็บโค้ดอ่าน limit ไว้)
5. Offset เป็น Auxiliary โดยปริยาย — (**ไม่** ติ๊กเอง / กด X)
6. "ตามดิน ไม่เกินเส้น" มี "ไม่ต่ำกว่า" ด้วย — (**มี**)
7. *(เพิ่ม)* ข้อความเตือนขั้นต่ำ / ขั้นสูงในตาราง Parameter ใส่หน่วยไหม — (**ไม่ใส่** "Depth = 1.5 < 2, ใช้ 2 แทน" เพราะบาง parameter ไม่ใช่ระยะ เช่น slope)
   · หรือมีช่อง "หน่วย" ต่อ parameter (m / % / ว่าง) แล้วใส่ตามนั้น
8. *(เพิ่ม)* ต่อลงถึงดิน + shape — (**link ต่อเป็น "optional" ใน shape: ไม่เกิด = ข้าม** ให้ shape เดียวปิดได้ทั้งสองกรณี)
9. *(เพิ่ม)* Intersect ตัด/ยืดเส้นเป็นค่าเริ่มต้นไหม — (**ไม่ตัด** ได้แค่จุดตัด · กด `T` เพื่อตัด/ยืด) · AutoCAD FILLET 0 ตัดเป็นค่าเริ่มต้น ถ้าอยากให้เหมือนก็ได้

---

## ตกลงแล้ว (ผู้ใช้ตอบ 2026-11-07)

| ข้อ | คำตอบ | ใช้ยังไง |
|---|---|---|
| 1–2 ชื่อปุ่ม | **ชื่ออังกฤษ**: ปุ่มใหม่ **Daylight Cut/Fill** (เดิม "ถ้าตัด / ถม"), **Extend to Surface** (ต่อลงถึงดิน), **Clipped Surface Link** (ตามดิน ไม่เกินเส้น), **Intersect**, **Offset**, **Array** · ปุ่มเดิมเปลี่ยนชื่อ: **Slope to Surface** (ลาดจนชนดิน), **Follow Surface** (วิ่งตามผิวดิน), **Regular Polygon** (Polygon ด้านเท่า), **Cut at Level** (ตัดที่ระดับ — ยังปิดอยู่), **My Shapes** (รูปทรงของฉัน) | เปลี่ยน **เฉพาะชื่อปุ่ม / เครื่องมือ**: ป้ายใน drawer, `TOOL_NAMES`, คำนำหน้า banner ("Slope to Surface: คลิกจุดเริ่ม"), ชื่อในตาราง `?`, ชื่อเครื่องมือใน README · **ข้อความ UI อื่นยังเป็นไทย** (คำอธิบาย, หน้าต่าง, ชนิดจุดใน Properties) — จะแปลทั้งเว็บทีหลัง |
| 3 shortcut | ไม่ได้คัดค้าน → ตามที่เสนอ | `I` = Intersect, `O` = Offset |
| 4 Max / Min เก่า | ไม่ได้คัดค้าน → ตามที่เสนอ | ตัดทิ้งตอนโหลด + แจ้งครั้งเดียว |
| 5 Offset เป็น Aux | **ไม่** — ต้องติ๊กเองถึงจะเป็น Auxiliary | checkbox ในคำสั่ง (และปุ่ม X ระหว่างคำสั่งแบบเครื่องมืออื่น) |
| 6 "ไม่ต่ำกว่า" | ไม่ได้คัดค้าน → ตามที่เสนอ | มี (below / above) |
| 7 หน่วยในข้อความ | ไม่ได้คัดค้าน → ตามที่เสนอ | ไม่ใส่หน่วย |
| 8 shape + Extend to Surface | ไม่ได้คัดค้าน → ตามที่เสนอ | link ต่อเป็น optional ใน shape |
| 9 Intersect ตัด / ไม่ตัด | **ขึ้นทางเลือกให้เลือกทุกครั้ง** | หลังคลิกเส้นที่ 2: ขึ้นตัวเลือก 2 ปุ่มข้างเมาส์ / ใน banner — **[T] ตัด/ยืดเส้นให้จบที่จุดตัด** · **[N] ไม่ตัด (ได้แค่จุดตัด)** · Esc = ยกเลิก (ไม่ใช้ค่าเริ่มต้น) |

- ข้อ 3, 4, 6, 7, 8 ผู้ใช้ไม่ได้ตอบแยก — ถือตามที่เสนอ (บอกผู้ใช้แล้วใน M0)
- ตัวเลือก T / N ของ Intersect ใช้ได้เฉพาะระหว่างคำสั่ง (ตัวเลือกระหว่างคำสั่งชนะ shortcut ทั่วไป · T ของ Arc ใช้ตอนวาด Arc เท่านั้น ไม่ชน)
