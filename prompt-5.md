# งานรอบ 5 (ฉบับย่อ): Logic API + มุมมองข้อความ + แก้ Switch / decision ซ้อนในแท็บ Logic

> วิธีใช้: สั่ง Claude Code ว่า "อ่าน CLAUDE.md กับ prompt-5.md แล้วทำ Milestone 0"
> ทำทีละ milestone หยุดให้ผู้ใช้ลองทุกครั้ง รายงานเป็นภาษาไทยสั้นๆ (ทำอะไร / ลองยังไง / อะไรยังไม่ได้)
> **ทำหลัง `prompt-4b.md` เสร็จ** (4b เสร็จแล้ว — `setLimit` / `removeLimit` / `limitOptions` ต้องอยู่ใน Logic API ด้วย)

## 0. บริบท

อ่าน `CLAUDE.md` และ `prompt-4-design.md` (โครงข้อมูล logic ที่ตกลงแล้ว) และ `prompt-4b-design.md` ก่อน
รอบ 4 + 4b เสร็จแล้ว: นิพจน์เงื่อนไข, `logic.conditions / decisions / branches` (กิ่ง = ทางออกของ decision, รองรับ if / switch / ซ้อน),
`firstOf`, ปุ่ม "ถ้าตัด / ถม", ปุ่ม "Max / Min", แท็บ Logic

**ตกลงกับผู้ใช้แล้ว:** เลื่อน flowchart แบบแคนวาส (SAC) ออกไปทำตอนทำเว็บสาธารณะ
รอบนี้ทำเฉพาะสิ่งที่ **prompt-6 (MCP ให้ AI แก้ logic)** ต้องใช้ + ช่องว่างของแท็บ Logic:
1. **Logic API** — ทุกการแก้ logic ผ่านฟังก์ชันล้วนชุดเดียว (AI จะเรียกชุดนี้ผ่าน MCP)
2. **มุมมองข้อความ** — logic เป็น pseudo-code อ่านง่าย (AI ใช้สรุปสิ่งที่แก้ให้ผู้ใช้ตรวจ)
3. **แท็บ Logic แก้ได้ครบ** — สร้าง Switch, เพิ่ม/แก้/เรียง case, ซ้อน decision ในกิ่ง (ตอนนี้โครงข้อมูลรองรับแต่ยังไม่มีหน้าจอ)

**ห้ามเปลี่ยนรูปแบบ `spec.logic`** — flowchart ในอนาคตจะวาดบนข้อมูลชุดเดียวกันนี้

ไฟล์ที่ต้องอ่านก่อนแก้:
| ไฟล์ | เกี่ยวกับรอบนี้ยังไง |
|---|---|
| `SA.Web/wwwroot/js/spec.js` | `branchChain`, `branchRisks`, `branchObjects`, `renameCond`, `decisionTree`, `removeDecision`, `addCutFill`, ส่วน limit ของ 4b, evaluate ส่วน logic |
| `SA.Web/wwwroot/js/ui.js` | `renderLogic`, `newCondition`, `removeDecisionsDialog`, `renameBranch`, `renameCondition`, `deleteCondition`, `logicCoverage`, `liveEdit`, หน้าต่างถ้าตัด/ถม และของ 4b |
| `SA.Web/wwwroot/js/draw.js` | `specEdit` (แก้ spec + undo), `chooseDrawBranch` |
| `SA.Web/wwwroot/js/history.js`, `codelink.js` | undo/redo, logic → บรรทัดโค้ด |
| `SA.Web/Drawing/CodeGenerator.cs` | โค้ดของ decision / switch / กิ่ง (ลำดับ case มีผลกับโค้ด) |
| `SA.Tests/js/logic.test.js`, `cond.test.js`, `SA.Tests/DrawingTests.cs` | test logic เดิม |

Shortcut ที่ใช้แล้ว ห้ามชน: `P L S M C R X A F Z B`, `T/E` (Arc), `C` (ปิด Polygon / ตัวเลือก Rotate), `Space`, `Tab`, `Enter`, `Esc`,
`F1/? F3 F8 F9 F11`, `Delete`, `Ctrl+A/C/X/V/Z/Y/E/S` (+ ที่ 4b เพิ่ม) — รอบนี้ไม่จำเป็นต้องมี shortcut ใหม่

กติกาเดิมใน `CLAUDE.md` ใช้ทั้งหมด (CRLF, UI/คอมเมนต์ไทย, localhost, ห้ามทำของเดิมพัง, ห้ามแก้ .cs ของผู้ใช้ระหว่างทดสอบ,
ห้าม commit/push เอง, อัปเดต README + สถานะใน CLAUDE.md, บอกเรื่อง run-viewer.bat, ห้ามเพิ่ม API ปลอมใน shim)

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
| `setBranch(spec, objectIds, branchId \| null)` | ย้าย point / link / shape / กลุ่มหมุน เข้ากิ่ง — คืนคำเตือนจาก `branchRisks` |
| `moveDecision(spec, id, newParentBranch)` | ย้าย decision ทั้งก้อนไปซ้อนในกิ่งอื่น (ห้ามย้ายเข้าในตัวเอง) |
| `addCutFill(spec, o)` (เดิม) · `setLimit` / `removeLimit` / `limitOptions` (จาก 4b — ใน spec.js แล้ว) | รวมเข้าชุดเดียวกัน |
| `describe(spec)` | สรุปโครง logic เป็น JSON สั้น (id, ชื่อ, นิพจน์, กิ่ง, จำนวน object) — ไว้ให้ MCP อ่าน |

- **UI เดิมทั้งหมด** (แท็บ Logic, Properties "เกิดเมื่อ", ปุ่มถ้าตัด/ถม, ปุ่ม Max / Min, `B`) เปลี่ยนมาเรียกชุดนี้ — ไม่มีที่ไหนแก้ `spec.logic` ตรงๆ อีก
  พฤติกรรมที่ผู้ใช้เห็นต้องเหมือนเดิม
- ทุกการแก้ผ่าน `specEdit` → undo/redo ได้ครั้งเดียวต่อการกระทำ
- README หัวข้อใหม่ **"Logic API"**: รายการฟังก์ชัน + พารามิเตอร์ + ตัวอย่าง + error ที่เป็นไปได้ (prompt-6 จะห่อเป็นเครื่องมือ MCP จากหัวข้อนี้)

## 2. มุมมองข้อความ

ฟังก์ชันล้วน `Logic.toText(spec, evalResult?)` → pseudo-code ภาษาไทย เช่น
```
เงื่อนไข:
  IsCut = ground(P2) > P2.y          ← ตอนนี้: จริง
เกิดเสมอ: P1, P2, L1
ถ้า IsCut:                            [D1 ตัดหรือถม?]
    ตัด (B1): P3, L2                  ← เกิดตอนนี้
ไม่ใช่:
    ถม (B2): P4, L3
    ถ้า HighFill:                     [D2]
        ถมสูง (B3): P7, L6
switch ProtectionType:               [D3]
    = 1  หินเรียง (B5): ...
    = 2  คอนกรีต (B6): ...
    อื่นๆ (B7): (ว่าง)
Max / Min:
  P5 ต่ำกว่าผิวดินอย่างน้อย MinDepth  ← ตอนนี้: ถูกปรับ +0.60
```
- ใส่ค่าตอนนี้ได้เมื่อส่ง `evalResult` มา · ไม่ส่ง = โครงอย่างเดียว (สำหรับ diff)
- **`Logic.diffText(before, after)`** — สรุปสิ่งที่เปลี่ยนระหว่าง spec สองชุดเป็นบรรทัดภาษาไทย (เพิ่ม/ลบ/แก้ เงื่อนไข, กิ่ง, object ที่ย้ายกิ่ง)
  — prompt-6 ใช้แสดงให้ผู้ใช้ดูก่อนกดยืนยันสิ่งที่ AI แก้
- แท็บ Logic มีปุ่มสลับ "ตาราง / ข้อความ" + ปุ่มคัดลอกข้อความ (ไว้วางให้ AI หรือเก็บในรายงาน)

## 3. แท็บ Logic แก้ได้ครบ

- **+ Switch** (ข้าง "+ เงื่อนไขใหม่"): ใส่นิพจน์ตัวเลข (เช่น parameter `ProtectionType`) + รายการ case เริ่มต้น → สร้าง decision แบบ switch + กิ่ง + `else`
- ในแถว switch: เพิ่ม case, แก้ค่า case / ชื่อกิ่ง ในที่, ลบ case (ถามว่าจะเอา object ไปไหน), **เรียง case** ด้วยปุ่ม ↑↓ (หรือลาก)
- ในแถวกิ่งใดก็ได้: **"+ decision ในกิ่งนี้"** (if / switch) — ซ้อนได้หลายชั้น
- ในแถว decision: แก้ `test` ในที่ (ตรวจด้วย `Expr.check` ตามชนิด bool / number, error ภาษาไทยใต้ช่อง), เปลี่ยนชื่อ, **ย้ายไปกิ่งอื่น** (เลือกจากรายการ)
- ทุกอย่างผ่าน Logic API ข้อ 1 และ undo ได้
- Properties "เกิดเมื่อ" ต้องเลือกกิ่งของ switch และกิ่งที่ซ้อนได้ (แสดงเป็นเส้นทาง เช่น "ถม › ถมสูง")

## 4. Test

- JS `logicops.test.js`: ทุกฟังก์ชันข้อ 1 ทั้งกรณีปกติและ error (ชื่อซ้ำ, คำสงวน, ชนิดนิพจน์ผิด, case ซ้ำ, else ซ้ำ/ไม่อยู่ท้าย,
  ย้าย decision เข้าตัวเอง, ลบแบบ 3 `how`) และยืนยันว่า **error แล้ว spec ไม่เปลี่ยนเลย**
- `toText` / `diffText`: if, switch, ซ้อน 3 ชั้น, กิ่งว่าง, มี Max / Min, มี/ไม่มีค่าตอนนี้
- UI เดิมเรียก API แล้วผลเหมือนเดิม: รัน test เดิมทั้งหมด (`logic.test.js`, `cond.test.js`, ของ 4b) ผ่านโดยไม่แก้ค่าที่คาด
- เทียบ JS กับ C# (`DrawingTests.cs`) สำหรับ spec ที่สร้างด้วย API: switch หลาย case + else, case ที่ถูกเรียงใหม่, decision ที่ถูกย้าย — Right / Left
- เพิ่มกรณีใน `SA.Tests/js/drawing-cases.json`

## 5. Milestones

| M | งาน | ผู้ใช้ลองยังไง |
|---|---|---|
| 0 | `git status`, test เดิมผ่าน, เสนอรายการฟังก์ชันข้อ 1 + ตัวอย่าง `toText` จากไฟล์ round4-demo, ถามข้อ 7 → บันทึกใน `prompt-5-design.md` | ตอบคำถาม |
| 1 | ข้อ 1 Logic API + test + เปลี่ยน UI เดิมมาใช้ + README "Logic API" | ใช้แท็บ Logic / ถ้าตัด-ถม / Max-Min / `B` แบบเดิม ต้องไม่มีอะไรพัง |
| 2 | ข้อ 2 มุมมองข้อความ + `diffText` | เปิด round4-demo ดูแบบข้อความ ลากผิวดินแล้วค่าตอนนี้เปลี่ยน |
| 3 | ข้อ 3 Switch / case / decision ซ้อน ในแท็บ Logic | สร้าง switch ตาม parameter ใหม่ทั้งหมดจากแท็บ Logic |
| 4 | รวมงาน, README, `tests-civil3d/round5-demo.cs` + checklist, อัปเดตสถานะใน `CLAUDE.md` | ทดสอบใน Civil 3D |

**ชุดทดสอบ Civil 3D (M4):** คันดิน/เขื่อนที่มี **switch ตาม `ProtectionType`** (1 = หินเรียง, 2 = คอนกรีต, else = ไม่มีชั้นป้องกัน)
+ ตัด/ถม + ใต้กิ่งถมมี if `HighFill` (ขั้นบันได) · checklist: เปลี่ยน `ProtectionType` ใน Properties ของ subassembly ใน Civil 3D แล้วรูปเปลี่ยนตาม,
corridor ผ่านช่วงตัด/ถม/ถมสูง แล้วรูปตัดถูก, ไม่มี error แปลกใน Event Viewer

## 6. สิ่งที่ไม่ต้องทำในรอบนี้

- **Flowchart แบบแคนวาส** (เลื่อนไปทำพร้อมเว็บสาธารณะ — อยู่ใน Trello "ไอเดีย / ทีหลัง")
- MCP / AI (prompt-6) — แต่ Logic API + `describe` + `toText` / `diffText` ต้องพร้อมให้ห่อ
- Loop / Variable / Output parameter แบบ SAC, แปลง if/else ในโค้ดที่เขียนเองเป็นกิ่ง
- เว็บสาธารณะ / แยก core-host จริงจัง (แค่อย่าผูกโค้ดใหม่กับไฟล์ในเครื่อง)

## 7. คำถามที่ต้องถามผู้ใช้ใน Milestone 0 (มีค่าที่เสนอไว้ ถ้าผู้ใช้ตอบ "ตามที่เสนอ" ใช้ค่านี้)

1. มุมมองข้อความเป็นภาษาไทย (เสนอ) หรืออังกฤษ (`if / else`) — AI อ่านได้ทั้งคู่
2. เรียง case ด้วยปุ่ม ↑↓ (เสนอ — ง่ายและ undo ชัด) หรือลาก
3. ตัวอย่าง round5-demo (switch ชนิดชั้นป้องกัน + ขั้นบันไดเมื่อถมสูง) ตรงกับงานจริงไหม
