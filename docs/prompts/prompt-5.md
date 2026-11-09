# งานรอบ 5: Logic API + มุมมองข้อความ + ต้นไม้ Conditions ในแถบซ้าย + Variables

> วิธีใช้: สั่ง Claude Code ว่า "อ่าน CLAUDE.md กับ prompt-5.md แล้วทำ Milestone 0"
> ทำทีละ milestone หยุดให้ผู้ใช้ลองทุกครั้ง รายงานเป็นภาษาไทยสั้นๆ (ทำอะไร / ลองยังไง / อะไรยังไม่ได้)

## 0. บริบท

อ่าน `CLAUDE.md`, `prompt-4-design.md` (โครงข้อมูล logic), `prompt-4c-design.md` (ปุ่มรอบ 4c + รายชื่อฟังก์ชันล้วนข้อ 11) และ `prompt-4e-design.md` (ชนิดค่า) ก่อน
รอบ 4 + 4c เสร็จแล้ว: นิพจน์เงื่อนไข, `logic.conditions / decisions / branches` (กิ่ง = ทางออกของ decision, รองรับ if / switch / ซ้อน), `firstOf`,
แท็บ Logic ใน dock ล่าง, ปุ่ม **Daylight Cut/Fill**, **Extend to Surface**, **Clipped Surface Link**, **Intersect**, **Offset**, **Array**, ตาราง Parameter (ขั้นต่ำ / ขั้นสูง / ต้องมากกว่า 0)
และวาด rock-pitching ใหม่ในเว็บได้โดยไม่เขียนโค้ด (`RockPitchingTests.cs`)
รอบ 4d / 4e เสร็จแล้วด้วย: แถบซ้าย / ขวาลากปรับขนาดและแยกแผงเลื่อนในตัว (Drawer / Scenarios พับได้), ปุ่มปิดหน้าต่าง = `Esc`,
**Parameter ชนิดค่า** `Number` / `Slope (1:x)` / `Length (m)` / `Percent (%)` + ช่อง slope ↗ ↘ (ดู `prompt-4e-design.md`), ไฟล์ `base_rock-pitching-web.cs` / `body_rock-pitching-web.cs`
→ **Variables (ข้อ 4) ต้องมีชนิดค่าแบบเดียวกับ Parameter** (เช่น Variable ชนิด Slope แสดง `1:x` และใช้ในช่อง slope ได้ตรงๆ) · ต้นไม้ Conditions อยู่ในแผงต้นไม้ที่แยกไว้แล้วของ 4d

**สิ่งที่ผู้ใช้ตัดสินใจแล้ว (คุยกับ Claude ในแชท):**
- เลื่อน flowchart แบบแคนวาสไปทำพร้อมเว็บสาธารณะ (`prompt-flowchart-later.md`) — **แทนด้วยต้นไม้ Conditions ในแถบซ้าย** (ข้อ 3) ซึ่งเห็นโครง if / elif / switch ได้ทั้งหมด
- ผู้ใช้รู้สึกว่า "ไม่มีปุ่ม if" เพราะ logic ซ่อนอยู่ในแท็บล่างกับช่อง "เกิดเมื่อ" — ต้นไม้ต้องทำให้ **if มีตัวตนชัดบนหน้าจอ**
- if มีสองแบบ: (1) เลือกว่ารูปไหน **มี / ไม่มี** = กิ่ง (มีแล้ว ขาดหน้าจอ) (2) เลือก **ค่า** เช่น `if (depth < 2) depth = 2;` = **Variable** (ข้อ 4, ยังไม่มี)
- Loop แยกไปรอบ 5b (ต่อยอดจาก Array) — **ไม่ทำในรอบนี้** แต่โครง Variable ต้องไม่ขวางทาง (เช่น ตัวนับ `i` ในอนาคต)
- ชื่อปุ่ม / เครื่องมือ / โหนดใหม่ใช้ **ภาษาอังกฤษ** (แบบที่ทำใน 4c) ส่วนข้อความ UI อื่นยังเป็นไทย (จะแปลทั้งเว็บทีหลัง)
- รอบหน้า (prompt-6) จะให้ **AI ผ่าน MCP** แก้ logic → ทุกอย่างในรอบนี้ต้องผ่าน **Logic API ชุดเดียว** (ข้อ 1)

**ห้ามเปลี่ยนรูปแบบ `spec.logic` เดิม** (เพิ่มได้ เช่น `variables`) — flowchart ในอนาคตจะวาดบนข้อมูลชุดเดียวกันนี้

ไฟล์ที่ต้องอ่านก่อนแก้:
| ไฟล์ | เกี่ยวกับรอบนี้ยังไง |
|---|---|
| `SA.Web/wwwroot/js/spec.js` | logic: `branchChain`, `branchRisks`, `branchObjects`, `renameCond`, `decisionTree`, `removeDecision`, `addCutFill` + ฟังก์ชันของ 4c (README "ฟังก์ชันล้วนของรอบ 4c") |
| `SA.Web/wwwroot/js/ui.js` | `renderTree` (ต้นไม้ซ้าย), `renderLogic` (แท็บ Logic), `newCondition`, `removeDecisionsDialog`, `renameBranch`, `propsParamTable`, `liveEdit` |
| `SA.Web/wwwroot/js/draw.js`, `history.js`, `codelink.js`, `select.js` | `specEdit` + undo, `chooseDrawBranch` (`B`), logic → บรรทัดโค้ด, การเลือก |
| `SA.Web/wwwroot/js/expr.js`, `SA.Web/Drawing/SpecExpr.cs` | นิพจน์ / ชนิด bool-number / คำสงวน — Variable ต้องเข้าระบบนี้ |
| `SA.Web/Drawing/CodeGenerator.cs`, `DrawingSpec.cs` | ลำดับการคำนวณ (`TopoOrder`), บล็อกตรวจ parameter, decision / switch / กิ่ง |
| `SA.Tests/js/logic.test.js`, `cond.test.js`, `SA.Tests/DrawingTests.cs` | test logic เดิม |

Shortcut ที่ใช้แล้ว ห้ามชน: `P L S M C R X A F Z B I O`, `T/E` (Arc), `T` (Intersect ตัด), `C` (ปิด Polygon / ตัวเลือก Rotate), `Space`, `Tab`, `Enter`, `Esc`,
`F1/? F3 F8 F9 F11`, `Delete`, `Ctrl+A/C/X/V/Z/Y/E/S` — ตรวจตาราง `?` ล่าสุดอีกครั้งก่อนเพิ่ม

กติกาเดิมใน `CLAUDE.md` ใช้ทั้งหมด (CRLF, localhost, ห้ามทำของเดิมพัง, ห้ามแก้ .cs ของผู้ใช้ระหว่างทดสอบ, ห้าม commit/push เอง,
อัปเดต README + สถานะใน CLAUDE.md, บอกเรื่อง run-viewer.bat, ห้ามเพิ่ม API ปลอมใน shim)

---

## 1. Logic API (ฟังก์ชันล้วนชุดเดียว)

ไฟล์ใหม่ `js/logicops.js` (หรือใน `spec.js` ถ้าเหมาะกว่า — บอกเหตุผล) ไม่แตะ DOM / state ทดสอบด้วย node ได้
ทุกตัว: รับ `spec` + ค่า → แก้ spec และคืน `{ ok: true, warnings? }` หรือ `{ ok: false, error: "ข้อความไทย" }` **โดยไม่แก้อะไรเลยถ้า error**

| ฟังก์ชัน (ชื่อเสนอ) | ทำอะไร |
|---|---|
| `addCondition(spec, name, expr, note?)` / `editCondition` / `renameCondition` / `removeCondition(how)` | เงื่อนไขที่ตั้งชื่อ (ตรวจคำสงวน / ชื่อซ้ำ / ชนิดนิพจน์) |
| `addDecision(spec, { parentBranch, kind: "if" \| "switch", test, label, cases? })` | if = สร้างกิ่ง ใช่ / ไม่ใช่ ให้เลย · switch = กิ่งตาม cases + `else` |
| `editDecision` (test / label / kind) · `removeDecision(spec, id, how)` | `how` = เอา object ในกิ่งไปไว้ไหน (กิ่งแม่ / เกิดเสมอ / ลบทิ้ง) |
| `addCase` / `editCase` / `removeCase` / `moveCase(spec, branchId, newIndex)` | กิ่งของ switch (ค่า case ห้ามซ้ำ, `else` มีอันเดียวและอยู่ท้ายเสมอ) |
| `renameBranch(spec, id, label)` | ชื่อกิ่ง |
| `setBranch(spec, objectIds, branchId \| null)` | ย้าย point / link / shape / กลุ่มหมุน / array เข้ากิ่ง — คืนคำเตือนจาก `branchRisks` |
| `moveDecision(spec, id, newParentBranch)` | ย้าย decision ทั้งก้อนไปซ้อนในกิ่งอื่น (ห้ามย้ายเข้าในตัวเอง) — ใช้ทำ elif |
| `addVariable` / `editVariable` / `renameVariable` / `removeVariable` / `moveVariable` | Variables (ข้อ 4) |
| `addCutFill` (เดิม) + ฟังก์ชันสร้าง / แก้ของ 4c (`addFollowClipped`, `addArray`, `updateArray`, … ตาม README) | รวมเข้าชุดเดียวกัน (ห่อให้คืนรูปแบบ `{ ok, error }` เดียวกัน ถ้าตัวเดิมยังไม่ใช่) |
| `describe(spec)` | สรุปโครง logic + variables เป็น JSON สั้น (id, ชื่อ, นิพจน์, กิ่ง, จำนวน object) — ไว้ให้ MCP อ่าน |

- **UI ทั้งหมด** (ต้นไม้ใหม่ข้อ 3, แท็บ Logic, Properties "เกิดเมื่อ", ปุ่ม Daylight Cut/Fill, ปุ่มของ 4c, `B`) เรียกชุดนี้ — ไม่มีที่ไหนแก้ `spec.logic` ตรงๆ อีก
- ทุกการแก้ผ่าน `specEdit` → undo/redo ได้ครั้งเดียวต่อการกระทำ
- README หัวข้อ **"Logic API"**: รายการฟังก์ชัน + พารามิเตอร์ + ตัวอย่าง + error ที่เป็นไปได้ (prompt-6 จะห่อเป็นเครื่องมือ MCP จากหัวข้อนี้)

## 2. มุมมองข้อความ

ฟังก์ชันล้วน `Logic.toText(spec, evalResult?)` → pseudo-code อ่านง่าย เช่น
```
Variables:
  DepthUsed = ถ้า Depth < 2 → 2 (เตือน) ไม่งั้น → Depth   ← ตอนนี้: 2.00 (ถูกบีบ)
Conditions:
  IsCut = ground(P2) > P2.y          ← ตอนนี้: จริง
เกิดเสมอ: P1, P2, L1
ถ้า IsCut:                            [D1 ตัดหรือถม?]
    ตัด (B1): P3, L2                  ← เกิดตอนนี้
ไม่ใช่:
    ถม (B2): P4, L3
    ถ้า HighFill:                     [D2]   ← elif
        ถมสูง (B3): P7, L6
switch ProtectionType:               [D3]
    = 1  หินเรียง (B5): ...
    อื่นๆ (B7): (ว่าง)
```
- ใส่ค่าตอนนี้ได้เมื่อส่ง `evalResult` มา · ไม่ส่ง = โครงอย่างเดียว
- **`Logic.diffText(before, after)`** — สรุปสิ่งที่เปลี่ยนระหว่าง spec สองชุดเป็นบรรทัดภาษาไทย (เพิ่ม/ลบ/แก้ เงื่อนไข, กิ่ง, variable, object ที่ย้ายกิ่ง)
  — prompt-6 ใช้แสดงให้ผู้ใช้ดูก่อนกดยืนยันสิ่งที่ AI แก้
- แท็บ Logic มีปุ่มสลับ "ตาราง / ข้อความ" + ปุ่มคัดลอกข้อความ

## 3. ต้นไม้ Conditions ในแถบซ้าย (แทน flowchart)

ใต้ subassembly ในต้นไม้ซ้าย เพิ่มโหนด **Conditions** และ **Variables** (ข้อ 4):
```
▾ base_rock (subassembly)
   ▸ Parameters
   ▸ Points / Links / Shapes            ← object ที่เกิดเสมอ
   ▾ Conditions                          [+ Condition] [+ Switch]
      ▾ ◇ IsCut   ground(P2) > P2.y          ● จริง
         ▾ ใช่ (ตัด):   P3, L2
         ▾ ไม่ใช่ (ถม): P4, L3
            ▾ ◇ HighFill   P2.y - ground(P2) > 3   ○ เท็จ     ← elif = decision ซ้อนในกิ่ง "ไม่ใช่"
               ▸ ใช่ (ถมสูง): P7, L6
               ▸ ไม่ใช่
      ▾ ◇ switch ProtectionType   = 1
         ▸ = 1 หินเรียง …
         ▸ อื่นๆ
   ▾ Variables                           [+ Variable]
      DepthUsed = …                      2.00
```
- **ปุ่ม `+ Condition`** (และเมนูคลิกขวาที่โหนด Conditions / ที่กิ่งใดก็ได้): ใส่นิพจน์ (ตรวจด้วย `Expr.check` แบบ bool, error ไทยใต้ช่อง) → ได้ decision + กิ่ง ใช่ / ไม่ใช่
  — สร้างในกิ่ง "ไม่ใช่" = **elif** (เมนูคลิกขวาที่กิ่งไม่ใช่ เขียนว่า "+ elif (Condition ในกิ่งนี้)")
- **ปุ่ม `+ Switch`**: นิพจน์ตัวเลข (เช่น parameter `ProtectionType`) + case เริ่มต้น → กิ่งตาม case + `อื่นๆ`; เพิ่ม/แก้/ลบ case ในต้นไม้, เรียง case ด้วย ↑↓
- **โหนด decision**: แสดงชื่อ, นิพจน์, ชิป ● จริง / ○ เท็จ / ? ไม่รู้ **อัปเดตสดตอนลากผิวดิน / แก้ parameter / เปลี่ยน scenario**
  ดับเบิลคลิก = แก้นิพจน์ในที่ · คลิกขวา: เปลี่ยนชื่อ, ย้ายไปกิ่งอื่น, ลบ (dialog เดิม), ไปที่โค้ด
- **โหนดกิ่ง**: ชื่อกิ่ง + จำนวน object + ไอคอน ⚠ ถ้ายังไม่มี scenario ไหนเข้ากิ่งนี้ (coverage เดิม)
  คลิก = เลือก object ทั้งกิ่งบนรูป · คลิกขวา: "วาดลงกิ่งนี้" (เหมือน `B`), "+ Condition ในกิ่งนี้", เปลี่ยนชื่อ
- **ลาก object** (P3, L2 …) จากกิ่งหนึ่งไปอีกกิ่ง หรือไปที่ Points / Links / Shapes (= เกิดเสมอ) = `setBranch` — คำเตือน `branchRisks` ขึ้นหลังวาง
- **เปิดใช้งาน**: เงื่อนไขที่ยังไม่มีกิ่งไหนมี object = แค่คำนวณค่า ไม่สร้างอะไร (ผู้ใช้กังวลเรื่องนี้ — บอกใน README ว่าไม่ต้องเปิด/ปิดเอง)
- Points / Links / Shapes เดิมในต้นไม้: แสดงเฉพาะ object ที่เกิดเสมอ (object ในกิ่งย้ายไปอยู่ใต้กิ่ง) — หรือแสดงทั้งหมดพร้อมป้ายกิ่งแบบเดิม ให้เสนอใน M0
- แท็บ Logic ด้านล่าง: **เก็บไว้** สำหรับดูค่าสด / coverage / มุมมองข้อความ (ข้อ 2) แต่การแก้หลักย้ายมาที่ต้นไม้ (ถามใน M0)
- ทุกอย่างผ่าน Logic API ข้อ 1 และ undo ได้

## 4. Variables (if ที่เลือก "ค่า")

แบบ Define Variable ของ SAC: ค่าที่คำนวณครั้งเดียว แล้วใช้ชื่อในนิพจน์ไหนก็ได้ (dx, dy, slope, length, เงื่อนไข, Offset, Array ฯลฯ)
```jsonc
"variables": [
  { "id": "V1", "name": "DepthUsed", "kind": "double",
    "expr": "Depth",                                   // ค่าปกติ
    "rules": [ { "when": "Depth < 2", "value": "2", "warn": "Depth = {Depth} < 2 m ใช้ 2 m แทน" } ],   // if / elif ตามลำดับ ตัวแรกที่จริงชนะ
    "note": "ความลึกขั้นต่ำ 2 m" }
]
```
- หน้าต่าง `+ Variable` ถามเป็นประโยค: **ชื่อ** = [ค่าปกติ] · **ถ้า** [เงื่อนไข] → [ค่า] ☐ เตือนเมื่อใช้ค่านี้ (ข้อความ) · [+ ถ้า อีกข้อ] (= elif)
  — แบบง่ายที่สุดพิมพ์นิพจน์เดียวก็ได้ (ไม่มี rules)
- ชนิด double / bool (เทียบเท่าเงื่อนไขที่ตั้งชื่อ — เสนอใน M0 ว่าจะรวมหรือแยกจาก `conditions`) · ชื่อห้ามซ้ำกับ parameter / เงื่อนไข / คำสงวน
- อ้างจุด / ผิวดินได้ (`P3.y`, `ground(P2)`) → เข้า `TopoOrder` เหมือนเงื่อนไข · วนกัน = cyclic error
- เปลี่ยนชื่อ variable → นิพจน์ที่ใช้ชื่อนี้เปลี่ยนตาม (แบบ `renameCond`)
- **C#**: ได้บล็อก if ธรรมดาอ่านง่าย ตรงกับสไตล์ไฟล์ของผู้ใช้ เช่น
  ```csharp
  // V1 DepthUsed: ความลึกขั้นต่ำ 2 m
  double DepthUsed = Depth;
  if (Depth < 2.0) { Warn(cs, CorridorError.ValueTooSmall, $"Depth = {Depth} < 2 m ใช้ 2 m แทน"); DepthUsed = 2.0; }
  ```
  (ใช้ `CorridorError` ที่มีจริงเท่านั้น) · codelink: คลิก variable ในต้นไม้ → บรรทัดนี้
- ความต่างกับตาราง Parameter (ขั้นต่ำ / ขั้นสูง): ตารางบีบค่าที่ผู้ใช้กรอกเฉยๆ · Variable ใช้เมื่อเงื่อนไขอ้างค่าอื่น / ผิวดิน / จุด หรือต้องการหลายกรณี
  — เขียนตาราง "ใช้อันไหนเมื่อไร" ใน README
- ตัวอย่างทดสอบ: rock-pitching แบบที่ Depth ใช้ Variable แทนขั้นต่ำในตาราง → ผลเหมือนกัน

## 5. Test

- JS `logicops.test.js`: ทุกฟังก์ชันข้อ 1 ทั้งกรณีปกติและ error (ชื่อซ้ำ, คำสงวน, ชนิดนิพจน์ผิด, case ซ้ำ, else ซ้ำ/ไม่อยู่ท้าย,
  ย้าย decision เข้าตัวเอง, ลบแบบ 3 `how`, variable วนกัน) และยืนยันว่า **error แล้ว spec ไม่เปลี่ยนเลย**
- `toText` / `diffText`: if, elif, switch, ซ้อน 3 ชั้น, กิ่งว่าง, มี variable แบบมี / ไม่มี rules, มี / ไม่มีค่าตอนนี้
- Variables: ลำดับ rules (ตัวแรกที่จริงชนะ), เตือน, อ้างจุด / ผิวดิน, ใช้ใน dx / slope / Offset / Array, rename, ลบตอนมีคนใช้ (ถามก่อน)
- UI เดิมเรียก API แล้วผลเหมือนเดิม: test เดิมทั้งหมดผ่าน (`logic.test.js`, `cond.test.js`, `rockpitching.test.js`, `RockPitchingTests.cs` ฯลฯ)
- เทียบ JS กับ C# (`DrawingTests.cs`): switch หลาย case + else, elif, decision ที่ถูกย้าย, variables หลาย rules — Right / Left / Layout

## 6. Milestones

| M | งาน | ผู้ใช้ลองยังไง |
|---|---|---|
| 0 | `git status`, test เดิมผ่าน, เสนอรายการฟังก์ชันข้อ 1, ภาพร่างต้นไม้ข้อ 3 (จาก round4-demo จริง), รูปแบบ `variables` + ตัวอย่าง C#, ตัวอย่าง `toText`, ถามข้อ 8 → `prompt-5-design.md` | ตอบคำถาม |
| 1 | ข้อ 1 Logic API + test + เปลี่ยน UI เดิมมาใช้ + README "Logic API" | ใช้แท็บ Logic / Daylight Cut/Fill / ปุ่มของ 4c / `B` แบบเดิม ต้องไม่มีอะไรพัง |
| 2 | ข้อ 3 ต้นไม้ Conditions (if / elif / switch, ค่าสด, ลาก object, คลิกขวา) | สร้าง IsCut + elif HighFill + switch จากต้นไม้ล้วนๆ แล้วลากผิวดินดูชิปเปลี่ยน |
| 3 | ข้อ 4 Variables (JS + C# + หน้าต่าง + ต้นไม้) | ทำ DepthUsed แบบ rock-pitching แล้วใช้ใน dy ของจุด |
| 4 | ข้อ 2 มุมมองข้อความ + `diffText` | เปิด round4-demo ดูแบบข้อความ คัดลอกได้ |
| 5 | รวมงาน, README, `tests-civil3d/round5-demo.cs` + checklist, อัปเดตสถานะใน `CLAUDE.md` | ทดสอบใน Civil 3D |

**ชุดทดสอบ Civil 3D (M5):** คันดิน/เขื่อนที่มี switch ตาม `ProtectionType` (1 = หินเรียง, 2 = คอนกรีต, อื่นๆ = ไม่มีชั้นป้องกัน)
+ Daylight Cut/Fill + elif HighFill (ขั้นบันได) + Variable แบบ min depth · checklist: เปลี่ยน `ProtectionType` / Depth ใน Properties ของ subassembly
ใน Civil 3D แล้วรูปเปลี่ยนตาม, corridor ผ่านช่วงตัด / ถม / ถมสูง รูปตัดถูก, ข้อความเตือนของ Variable ขึ้นใน Event Viewer

## 7. สิ่งที่ไม่ต้องทำในรอบนี้

- Flowchart แบบแคนวาส (ต้นไม้ข้อ 3 แทนไปก่อน)
- Loop (prompt-5b) — แต่ออกแบบ Variables ให้เพิ่มตัวนับ `i` ภายหลังได้
- MCP / AI (prompt-6) — แต่ Logic API + `describe` + `toText` / `diffText` ต้องพร้อมให้ห่อ
- แปลข้อความ UI ทั้งเว็บเป็นอังกฤษ (ชื่อปุ่ม / โหนดใหม่เป็นอังกฤษได้เลย)
- Output parameter แบบ SAC, แปลง if/else ในโค้ดที่เขียนเองเป็นกิ่ง

## 8. คำถามที่ต้องถามผู้ใช้ใน Milestone 0 (มีค่าที่เสนอไว้ ถ้าผู้ใช้ตอบ "ตามที่เสนอ" ใช้ค่านี้)

1. ต้นไม้ Conditions: object ในกิ่งแสดงใต้กิ่ง **และ** ยังอยู่ใน Points / Links / Shapes พร้อมป้ายกิ่งไหม — เสนอ **แสดงใต้กิ่งอย่างเดียว** (Points / Links / Shapes = เกิดเสมอ)
2. แท็บ Logic ด้านล่าง — เสนอ **เก็บไว้ดูค่าสด / coverage / ข้อความ** การแก้ทำในต้นไม้
3. Variable ชนิด bool ให้รวมกับ "เงื่อนไขที่ตั้งชื่อ" เป็นเรื่องเดียวกันไหม — เสนอ **รวม** (Conditions = Variables ชนิด bool ที่ใช้เป็น test ของ decision) ถ้าทำได้โดยไม่เปลี่ยนรูปแบบ `spec.logic` เดิม ไม่งั้นแยก
4. มุมมองข้อความภาษาไทย (เสนอ) หรืออังกฤษ (`if / elif / else`)
5. ตัวอย่าง round5-demo ตรงกับงานจริงไหม
