# (เลื่อนไปทำทีหลัง — พร้อมเว็บสาธารณะ) Flowchart แบบ SAC — ฉบับเต็มเดิมของ prompt-5

> วิธีใช้: สั่ง Claude Code ว่า "อ่าน CLAUDE.md กับ prompt-5.md แล้วทำ Milestone 0"
> ทำทีละ milestone หยุดให้ผู้ใช้ลองทุกครั้ง รายงานเป็นภาษาไทยสั้นๆ (ทำอะไร / ลองยังไง / อะไรยังไม่ได้)

## 0. บริบท

อ่าน `CLAUDE.md` (กติกา, test, แผน) และ **`prompt-4-design.md`** (โครงข้อมูล logic ที่ตกลงแล้ว) ก่อน
รอบ 4 เสร็จแล้ว: นิพจน์เงื่อนไข, `logic.conditions / decisions / branches` (กิ่ง = ทางออกของ decision, รองรับ if / switch / ซ้อน),
`firstOf`, ปุ่ม "ถ้าตัด / ถม", แท็บ Logic ใน dock ล่าง (ค่าสด, ต้นไม้กิ่ง, scenario ครอบคลุมกิ่ง), `B` = วาดลงกิ่ง, codelink ของเงื่อนไข/กิ่ง

รอบนี้ทำ **แบบ ข: flowchart แบบ Subassembly Composer** — ผู้ใช้คุ้นกับ SAC มาก ให้หน้าตา/ความรู้สึกใกล้ SAC (Flowchart คู่กับ Preview)
**กติกาสำคัญที่สุดของรอบนี้:** flowchart เป็น **อีกมุมมองของข้อมูลชุดเดียวกัน** — ห้ามมีโครงข้อมูล logic ชุดที่สอง
แก้ใน flowchart → แท็บ Logic / Properties / รูป / โค้ดเปลี่ยนตาม และกลับกัน
รอบหน้า (prompt-6) จะให้ **AI ผ่าน MCP** แก้ logic ด้วย → รอบนี้ต้องทำให้ทุกการแก้ logic ผ่าน **ฟังก์ชันล้วนชุดเดียว** (ข้อ 1)
ที่ MCP เรียกต่อได้เลย

ไฟล์ที่ต้องอ่านก่อนแก้:
| ไฟล์ | เกี่ยวกับรอบนี้ยังไง |
|---|---|
| `prompt-4-design.md` | โครงข้อมูล logic, ความหมายของกิ่ง, `firstOf`, การไม่เกิด ≠ error |
| `SA.Web/wwwroot/js/spec.js` | `branchChain`, `branchRisks`, `branchObjects`, `renameCond`, `decisionTree`, `removeDecision`, `addCutFill`, evaluate ส่วน logic |
| `SA.Web/wwwroot/js/ui.js` | `renderLogic` (แท็บ Logic), `newCondition`, `removeDecisionsDialog`, `renameBranch`, `logicCoverage`, `scenarioBranches`, `branchColor`, `liveEdit` |
| `SA.Web/wwwroot/js/draw.js` | `specEdit` (แก้ spec + undo), `chooseDrawBranch` |
| `SA.Web/wwwroot/js/history.js`, `codelink.js`, `select.js` | undo/redo, object/logic → บรรทัดโค้ด, การเลือก |
| `SA.Web/wwwroot/js/workspace.js`, `view.js` | pan/zoom ของ workspace (ใช้เป็นแบบให้ flowchart) |
| `SA.Web/wwwroot/index.html` | โครงหน้า: `#left`, `#center` (`#main` + `#dock`), `#right` |
| `SA.Web/Drawing/CodeGenerator.cs` | โค้ดของ decision / switch / กิ่ง (ต้องไม่เปลี่ยนเพราะ layout ของ flowchart) |
| `SA.Tests/js/logic.test.js`, `cond.test.js`, `SA.Tests/DrawingTests.cs` | test logic เดิม |

Shortcut ที่ใช้แล้ว ห้ามชน: `P L S M C R X A F Z B`, `T/E` (ตอนวาด Arc), `C` (ปิด Polygon / Copy ใน Rotate), `Space`, `Tab`, `Enter`, `Esc`,
`F1/? F3 F8 F9 F11`, `Delete`, `Ctrl+A/C/X/V/Z/Y/E/S` — shortcut ใหม่ต้องอยู่ในตาราง `?`

กติกาเดิมทั้งหมดใน `CLAUDE.md` ใช้ต่อ (CRLF, UI/คอมเมนต์ไทย, localhost, ห้ามทำของเดิมพัง, ห้ามแก้ .cs ของผู้ใช้ระหว่างทดสอบ,
ห้าม commit/push เอง, อัปเดต README + สถานะใน CLAUDE.md, บอกว่าต้องเปิด `run-viewer.bat` ใหม่หรือแค่ Ctrl+F5, ห้ามเพิ่ม API ปลอมใน shim)

---

## 1. ฟังก์ชันแก้ logic ชุดเดียว (ฐานของ flowchart และ MCP รอบหน้า)

รวมทุกการแก้ logic เป็นฟังก์ชันล้วน (ไม่แตะ DOM / state) ในไฟล์ใหม่ `js/logicops.js` (หรือใน `spec.js` ถ้าเหมาะกว่า — บอกเหตุผล) ทุกตัว:
รับ `spec` + ค่า → แก้ spec หรือคืน error ภาษาไทย (ไม่แก้อะไรเลยถ้า error) และมี test

| ฟังก์ชัน (ชื่อเสนอ) | ทำอะไร |
|---|---|
| `addCondition(spec, name, expr, note?)` / `editCondition` / `renameCondition` / `removeCondition(how)` | เงื่อนไขที่ตั้งชื่อ |
| `addDecision(spec, { parentBranch, kind: "if" \| "switch", test, label, cases? })` | if = สร้างกิ่ง ใช่/ไม่ใช่ ให้เลย · switch = กิ่งตาม cases + `else` |
| `editDecision` (test / label / kind) · `removeDecision(spec, id, how)` | `how` = เอา object ในกิ่งไปไว้ไหน (กิ่งแม่ / เกิดเสมอ / ลบทิ้ง) — ใช้ร่วมกับ dialog เดิม |
| `addCase` / `editCase` / `removeCase` / `moveCase(spec, branchId, newIndex)` | กิ่งของ switch (ห้ามค่า case ซ้ำ, `else` มีได้อันเดียวและอยู่ท้ายเสมอ) |
| `setBranch(spec, objectIds, branchId \| null)` | ย้าย point / link / shape / กลุ่มหมุน เข้ากิ่ง (ตรวจ `branchRisks` แล้วคืนคำเตือน) |
| `moveDecision(spec, id, newParentBranch)` | ย้าย decision ทั้งก้อนไปซ้อนในกิ่งอื่น (ห้ามย้ายเข้าไปในตัวเอง) |
| `setLayout(spec, nodeId, {x, y})` / `clearLayout` | ตำแหน่งกล่องใน flowchart (ข้อ 2) |

- UI เดิม (แท็บ Logic, Properties "เกิดเมื่อ", ปุ่มถ้าตัด/ถม, `B`) ต้องเปลี่ยนมาเรียกชุดนี้ด้วย — ไม่มีที่ไหนแก้ `spec.logic` ตรงๆ อีก
- ทุกการแก้ผ่าน `specEdit` → undo/redo ได้ครั้งเดียวต่อหนึ่งการกระทำ
- เขียนรายการฟังก์ชัน + พารามิเตอร์ + error ไว้ใน README หัวข้อใหม่ "Logic API" (prompt-6 จะห่อเป็นเครื่องมือ MCP จากรายการนี้)

## 2. หน้าจอ Flowchart

**ตำแหน่ง** (เสนอ — ถามใน M0): แบบ SAC = แบ่ง `#main` เป็น **Flowchart | Preview (workspace)** ลากเส้นแบ่งปรับขนาดได้
เปิด/ปิดด้วยปุ่มบนแถบ Edit + shortcut (เสนอ `G`) จำสถานะไว้ในเบราว์เซอร์ · ใช้ได้เมื่ออยู่ใน Edit ของ subassembly ที่มีส่วนที่วาด
(นอก Edit = ดูได้อย่างเดียว เหมือนแท็บ Logic)

**สิ่งที่วาด** (SVG ทำเอง ไม่ต้องเพิ่ม library):
- กล่อง **Start** บนสุด → กล่อง **"เกิดเสมอ"** (object ที่ไม่มีกิ่ง)
- **Decision** = รูปข้าวหลามตัด มีชื่อ + นิพจน์ `test` + ชิป จริง/เท็จ สด, ทางออก "ใช่" / "ไม่ใช่"
- **Switch** = กล่องหลายทางออก (ป้ายค่า case ของแต่ละทาง + `else`)
- **กิ่ง** = กล่องปลายทางของแต่ละทางออก: ชื่อกิ่ง, สีกิ่ง (`branchColor` เดิม), **ชิป object** ในกิ่ง (P3, L2, …) และ decision ที่ซ้อนอยู่ต่อลงไป
- เส้นเชื่อมมีลูกศร; **ทางที่เกิดตอนนี้** (ตามผิวดิน / parameter ปัจจุบัน) เป็นเส้นเข้ม ส่วนที่ไม่เกิดจาง — อัปเดตสดตอนลากจุด surface
- layout อัตโนมัติแบบต้นไม้บนลงล่าง (ไม่ทับกัน) · ผู้ใช้ลากกล่องไปวางเองได้ → เก็บใน `spec.logic.layout` (ข้อ 1)
  ปุ่ม "จัดใหม่อัตโนมัติ" · **layout ต้องไม่ทำให้โค้ด C# ที่สร้างเปลี่ยนแม้แต่ตัวอักษรเดียว** (มี test)
- pan / zoom แบบเดียวกับ workspace (ล้อเมาส์, ปุ่มกลาง / Space + ลาก, `F` = fit เมื่อเมาส์อยู่ใน flowchart)

**เชื่อมกับ Preview (workspace):**
- คลิกชิป object ใน flowchart = เลือก object นั้นในรูป (และกลับกัน: เลือกในรูป → ชิปถูก highlight + กล่องกิ่งของมัน)
- hover กล่องกิ่ง = เน้น object ทั้งกิ่งในรูป (แบบ "แสดงทุกกรณี" แม้กิ่งนั้นไม่เกิดตอนนี้)
- คลิกกล่องกิ่ง = ตั้งเป็นกิ่งสำหรับวาด (เหมือน `B`) — banner บอกชัด

## 3. แก้ logic ใน Flowchart

- **คลิกขวา / ปุ่ม `+`** บนกล่อง: เพิ่ม Decision (if) / Switch ใต้ Start หรือในกิ่ง, เพิ่ม case, แก้ชื่อ, ลบ (ใช้ dialog `removeDecisionsDialog` เดิม)
- **ดับเบิลคลิก** decision / case = แก้ `test` / ค่า case ในกล่องเลย (ตรวจด้วย `Expr.check` แบบ want bool / number, แสดง error ภาษาไทยใต้ช่อง)
  ใส่ชื่อเงื่อนไข หรือพิมพ์นิพจน์ตรงๆ ก็ได้ (มีปุ่ม "ตั้งเป็นเงื่อนไขชื่อ…" ให้แปลงนิพจน์เป็นเงื่อนไขที่ใช้ซ้ำได้)
- **ลากชิป object** จากกล่องกิ่งหนึ่งไปอีกกล่อง = `setBranch` (ลากไปกล่อง "เกิดเสมอ" = เอาออกจากกิ่ง) — ถ้ามีคำเตือน `branchRisks`
  ให้ขึ้นหลังวาง พร้อมทางแก้เดิม (ย้ายเข้ากิ่ง / ใช้ firstOf) · เลือกหลายชิ้นแล้วลากพร้อมกันได้
- **ลาก decision** ไปวางในกิ่งอื่น = `moveDecision`
- **ลากเรียง case** ของ switch = `moveCase` (ลำดับมีผลกับโค้ดที่สร้าง — บอกผู้ใช้)
- `Delete` ตอนเลือกกล่องใน flowchart = ลบกล่องนั้น (ผ่าน dialog) ไม่ใช่ลบ object ในรูป — โฟกัสอยู่ที่ไหนคำสั่งไปที่นั่น
- ทุกการแก้ undo/redo ได้ (`Ctrl+Z/Y` ทำงานทั้งใน flowchart และ workspace ใช้ history ชุดเดียว)

## 4. ตรวจสอบ / ทดสอบครบทุก case ใน Flowchart

- **coverage**: กล่องกิ่งที่ยังไม่มี scenario ไหนเข้า มีป้าย ⚠ "ยังไม่ทดสอบ" (ใช้ `logicCoverage` เดิม)
  เลือก scenario ในแผงซ้าย → flowchart เน้นเส้นทางของ scenario นั้น
- **คำเตือน**: decision ที่ผล "ไม่รู้" (อ้างจุดที่ไม่เกิด), กิ่งว่าง, object ที่ `branchRisks` เตือน → ไอคอนบนกล่อง + tooltip
- **codelink**: ปุ่ม/เมนู "ไปที่โค้ด" บนกล่องเงื่อนไข / decision / กิ่ง (ใช้ `logicCodeBtn` เดิม) และเคอร์เซอร์ในโค้ด → กล่องที่ตรงกัน highlight
- **มุมมองข้อความ** (สลับในหัว flowchart): แสดง logic เป็น pseudo-code อ่านง่าย แก้ไม่ได้ เช่น
  ```
  เกิดเสมอ: P1, P2, L1
  ถ้า IsCut (ground(P2) > P2.y):
      ตัด: P3, L2
  ไม่ใช่:
      ถม: P4, L3
      ถ้า HighFill: ...
  ```
  (prompt-6 จะใช้รูปแบบนี้ให้ AI สรุปสิ่งที่แก้ให้ผู้ใช้ดู — ทำเป็นฟังก์ชันล้วน `Logic.toText(spec)` มี test)
- **ไฟล์ .cs ที่เขียนเอง (import)**: flowchart แสดงเฉพาะส่วนที่วาด + กล่องทึบ "โค้ดเดิม (นอกช่วง SA-DRAWING)" หนึ่งกล่อง ไม่ต้องแยก if ในโค้ดเดิม

## 5. Test

- JS `logicops.test.js`: ทุกฟังก์ชันข้อ 1 ทั้งกรณีปกติและ error (ชื่อซ้ำ, คำสงวน, case ซ้ำ, else ซ้ำ, ย้าย decision เข้าตัวเอง, ลบแบบ 3 `how`),
  undo/redo, `setBranch` คืนคำเตือนตรงกับ `branchRisks`, `toText` ของ if / switch / ซ้อน / ว่าง
- layout: เปลี่ยน/ล้าง layout แล้ว **โค้ด C# ที่สร้างเหมือนเดิมทุกตัวอักษร** และ spec เก่าที่ไม่มี layout เปิดได้ (จัดอัตโนมัติ)
- auto-layout: ฟังก์ชันล้วนคืนตำแหน่งที่ไม่ทับกันสำหรับต้นไม้ตัวอย่าง (if ซ้อน 3 ชั้น, switch 5 case)
- เทียบ JS กับ C# (`DrawingTests.cs`) สำหรับ spec ที่สร้างด้วย logicops: switch หลาย case + else, decision ที่ถูก `moveDecision`, case ที่ถูกเรียงใหม่ — ทั้ง Right / Left
- เพิ่มกรณีใน `SA.Tests/js/drawing-cases.json`

## 6. Milestones

| M | งาน | ผู้ใช้ลองยังไง |
|---|---|---|
| 0 | `git status`, รัน test เดิมผ่าน, เสนอ: ตำแหน่ง flowchart (ภาพร่าง ASCII), รายการฟังก์ชันข้อ 1, รูปแบบ `logic.layout`, ถามข้อ 8 · บันทึกข้อเสนอ + คำตอบใน `prompt-5-design.md` | ตอบคำถาม |
| 1 | ข้อ 1 `logicops` + test + เปลี่ยน UI เดิมมาใช้ (พฤติกรรมเดิมต้องเหมือนเดิม) + README "Logic API" | ใช้แท็บ Logic / ถ้าตัด-ถม / `B` แบบเดิม ต้องไม่มีอะไรพัง |
| 2 | ข้อ 2 flowchart แบบดูอย่างเดียว: วาด, layout อัตโนมัติ, เส้นทางที่เกิดสด, pan/zoom, เชื่อมการเลือกกับ Preview | เปิด `round4-demo` ดู flowchart แล้วลาก surface ดูเส้นทางเปลี่ยน |
| 3 | ข้อ 3 แก้ใน flowchart: เพิ่ม/แก้/ลบ decision-switch-case, ลากชิป object, ลาก decision, เรียง case, ลากกล่อง (layout), undo | สร้าง switch ตาม parameter ใหม่ทั้งหมดจาก flowchart |
| 4 | ข้อ 4: coverage, คำเตือน, codelink, มุมมองข้อความ, ไฟล์ import | ดูกิ่งที่ยังไม่ทดสอบ, กดไปที่โค้ด |
| 5 | รวมงาน + test ข้อ 5 ครบ, README, `tests-civil3d/round5-demo.cs` + `round5-checklist.md`, อัปเดตสถานะใน `CLAUDE.md` | ทดสอบใน Civil 3D (ด้านล่าง) |

**ชุดทดสอบ Civil 3D (M5):** `round5-demo.cs` สร้างจาก flowchart ทั้งหมด เช่น เขื่อน/คันดินที่มี
**switch ตาม parameter `ProtectionType`** (1 = หินเรียง, 2 = คอนกรีต, else = ไม่มีชั้นป้องกัน) + ใต้กิ่ง "ถม" มี **if `HighFill`** (ถมสูงเกิน X = มีขั้นบันได berm)
+ ตัด/ถม เดิม · checklist: เปลี่ยน `ProtectionType` ใน Properties ของ subassembly ใน Civil 3D แล้วรูปเปลี่ยนตาม, corridor ผ่านช่วงตัด/ถม/ถมสูง แล้วรูปตัดสลับถูก,
ไม่มี error แปลกใน Event Viewer · ตัวอย่างนี้ให้ผู้ใช้ปรับให้ตรงงานจริงได้ (ถามใน M0)

## 7. สิ่งที่ไม่ต้องทำในรอบนี้

- MCP / AI (prompt-6) — แต่ Logic API ข้อ 1 ต้องพร้อมให้ห่อ
- Loop, Variable, Output parameter แบบ SAC (โครงข้อมูลยังไม่รองรับ Loop — ดู prompt-4-design ข้อ 3)
- แปลง if/else ในโค้ดที่ผู้ใช้เขียนเองเป็น flowchart
- เว็บสาธารณะ / แยก core-host จริงจัง (แค่อย่าผูกโค้ดใหม่กับไฟล์ในเครื่อง — logicops / layout / toText เป็นฟังก์ชันล้วน)

## 8. คำถามที่ต้องถามผู้ใช้ใน Milestone 0 (มีค่าที่เสนอไว้ ถ้าผู้ใช้ตอบ "ตามที่เสนอ" ใช้ค่านี้)

1. ตำแหน่ง flowchart — เสนอ **แบ่งจอ Flowchart | Preview แบบ SAC** (อีกแบบ: แท็บสลับกับ workspace เต็มจอ)
2. Shortcut เปิด/ปิด flowchart — เสนอ **`G`**
3. ตำแหน่งกล่องที่ลากเอง — เสนอเก็บใน **`spec.logic.layout`** (ไปกับไฟล์ .cs ผ่าน sa-spec) แทนการเก็บใน `.saproj`
4. ลากชิป object ไปกิ่งอื่น = **ย้าย** (เสนอ) หรือถามทุกครั้งว่าย้าย/คัดลอก
5. ตัวอย่าง round5-demo (switch ตามชนิดชั้นป้องกัน + ขั้นบันไดเมื่อถมสูง) ตรงกับงานจริงไหม หรืออยากได้เงื่อนไขอื่น
