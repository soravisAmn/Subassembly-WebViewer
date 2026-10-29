# งานรอบ 3b: Auxiliary point / link (แบบ SAC) — แทรกก่อน Milestone 6 ของ prompt-3

> วิธีใช้: สั่ง Claude Code ว่า "อ่าน prompt-3b.md แล้วทำ Milestone 3b-0"
> ทำ 3b-0 → 3b-2 ให้เสร็จก่อน แล้วค่อยทำ **Milestone 6 ของ prompt-3** (รวมงาน + ชุดทดสอบ Civil 3D) โดยนับ auxiliary เข้าไปด้วย
> ทำทีละ milestone หยุดให้ผู้ใช้ลองทุกครั้ง รายงานเป็นภาษาไทยสั้นๆ (ทำอะไร / ลองยังไง / อะไรยังไม่ได้)

## 0. บริบท

prompt-3 ทำถึง Milestone 5 แล้ว ตอนนี้มี **"จุดช่วยสร้าง"** (`construction: true` บนจุด) อยู่แล้ว:
- `spec.js`: `isConstruction`, `addPoint(..., construction)`, `evaluate` ข้าม link ที่ปลายเป็นจุดช่วยสร้าง + เตือน, Fillet ทำให้จุดมุมเป็น construction
- `DrawingSpec.cs`: `SpecPoint.Construction`
- `CodeGenerator.cs`: จุด construction ไม่ `AddPoint` (เขียนเป็นคอมเมนต์), link ที่ปลายเป็น construction = `null` + `Warn`
- README หัวข้อ Polygon / Arc / Fillet / Object snap tracking อธิบายเรื่องนี้

ผู้ใช้ต้องการฟีเจอร์ที่ SAC เรียกว่า **Auxiliary** ให้ครบทั้ง **point และ link**: เรขาคณิตไว้ช่วยสร้าง ที่คำนวณได้ อ้างอิงได้ snap ได้
แต่ **ไม่ถูกส่งออกไปเป็นส่วนของ subassembly** (ไม่ `Points.Add` / `Links.Add` → ไม่โผล่ใน Civil 3D, ไม่เข้า corridor)
งานนี้คือ **ขยายของเดิม** ไม่ใช่ทำระบบใหม่ซ้อน

กติกาเดิมใช้ทั้งหมด (ดู prompt-3 ข้อ 0): CRLF, UI/คอมเมนต์ภาษาไทย, localhost, ห้ามทำของเดิมพัง, ห้ามแก้ .cs ของผู้ใช้ระหว่างทดสอบ,
ห้าม commit/push เองจนกว่าผู้ใช้อนุญาต, อัปเดต README, บอกว่าต้องเปิด `run-viewer.bat` ใหม่หรือแค่ Ctrl+F5, shortcut ใหม่ต้องอยู่ในตาราง `?`

---

## 1. เปลี่ยนชื่อ construction → auxiliary (เข้ากันได้กับของเก่า)

- ใน spec ใช้ key ใหม่ `auxiliary: true` ทั้งบน **point และ link** (และเส้นโค้ง arc3 / arcR / fillet / followSurface)
- **อ่านของเก่าได้เสมอ**: `construction: true` ใน `.saproj`, spec ที่ฝังใน .cs (`// sa-spec:`), clipboard → ถือเป็น `auxiliary: true`
  เขียนออกใหม่เป็น `auxiliary` เท่านั้น (ทั้ง JS และ `DrawingSpec.cs` — ฝั่ง C# รับได้ทั้งสอง key)
- เปลี่ยนชื่อในโค้ด/UI/README ให้เป็นคำเดียวกันทั้งหมด: ในหน้าเว็บใช้คำว่า **"Auxiliary (ช่วยสร้าง)"**
- มี test: โหลด spec เก่าที่มี `construction` แล้วผลคำนวณ + โค้ดที่สร้างเหมือนเดิมทุกอย่าง

## 2. Auxiliary link

**ความหมาย:** link ที่มีไว้อ้างอิง/snap/ดูเป็นแนว — คำนวณ geometry ในเว็บ (รวม tessellate โค้ง) แต่ในโค้ด C# **ไม่มี `Links.Add`**
(และเส้นโค้ง auxiliary ไม่ `Points.Add` จุดระหว่างทาง)

**กติกา:**
- ปลายของ auxiliary link เป็นได้ทั้งจุดจริงและจุด auxiliary
- **link จริงที่ปลายเป็นจุด auxiliary** = ยังไม่อนุญาตเหมือนเดิม (Civil 3D ไม่มีจุดนั้น) แต่เพิ่ม **quick fix** ในข้อความเตือน / Properties:
  "ทำจุด Pn เป็นจุดจริง" หรือ "ทำ link นี้เป็น Auxiliary" — ห้ามเปลี่ยนให้เองเงียบๆ
- **shape ใช้ auxiliary link ไม่ได้**: เครื่องมือ Shape / Polygon ไม่ยอมเลือก (ขึ้นเหตุผล) และถ้าผู้ใช้สลับ link ใน shape ให้เป็น auxiliary
  → ถามก่อนว่าจะเอา link ออกจาก shape (shape อาจไม่ปิด = เตือน) หรือยกเลิก
- สลับ **จุดจริงที่ link จริงใช้อยู่** ให้เป็น auxiliary → ขึ้นรายการ link ที่กระทบ + ตัวเลือก "ทำ link พวกนี้เป็น Auxiliary ด้วย" / ยกเลิก
- object auxiliary ไม่ส่ง code ออกไป (Civil 3D ไม่เห็นอยู่แล้ว): ช่อง code ใน Properties ให้ disable พร้อมหมายเหตุ แต่ **ไม่ลบ code เดิมทิ้ง**
  (สลับกลับเป็นของจริงแล้ว code กลับมา)

**ใช้งานได้กับระบบเดิมทั้งหมด:**
- snap ทุกชนิดบน auxiliary link/point (Endpoint, Midpoint, Center, Intersection ระหว่าง auxiliary กับของจริง, Perpendicular, Nearest)
  และ Object snap tracking — จุดที่สร้างจาก snap พวกนี้อ้างจุดปลาย/def เหมือนเดิม (ตามรูปทรงเมื่อ parameter / surface เปลี่ยน)
- select / window-crossing, Move / Copy / Paste, Rotate (กลุ่มหมุน), Delete (cascade), undo/redo, codelink (คลิกแล้วไปบรรทัดคำนวณ `Pt?`
  หรือบรรทัดคอมเมนต์ของ link auxiliary), Side Left mirror, polygon ด้านเท่า, Fillet (เช่น Fillet ระหว่าง auxiliary link สองเส้น = arc auxiliary)

## 3. วิธีสั่ง + การแสดงผล

- **Properties**: checkbox "Auxiliary (ช่วยสร้าง)" ของ point / link
- **คลิกขวา**: "ทำเป็น Auxiliary" / "ทำเป็นของจริง" (ใช้กับหลายชิ้นที่เลือกพร้อมกันได้)
- **ระหว่างวาด** (Point / Link / Polygon / Arc / Fillet): กด `X` สลับโหมดของชิ้นที่กำลังจะสร้าง — banner ขึ้นป้าย "Auxiliary" ชัดๆ
- **นอกคำสั่ง** มีของเลือกอยู่: `X` = สลับ auxiliary ของชุดที่เลือก (ผ่านกติกาข้อ 2 ทุกข้อ)
  — ตรวจก่อนว่า `X` ไม่ชนตัวเลือกของคำสั่งใดที่ทำไปแล้วในรอบ 3 (ตัวเลือกในคำสั่งชนะ shortcut ทั่วไป ตามกติกาเดิม)
- **หน้าตา**: จุด = กากบาทเทาเล็ก, link = เส้นประเทาบาง (โค้งก็ประเทา), ชื่อ/ป้ายสีจาง; hover / เลือกแล้ว highlight เหมือนของอื่น
- **แถบล่าง**: ปุ่ม `Aux` แสดง/ซ่อน auxiliary ทั้งหมด (ซ่อนแล้วยัง snap ไม่ได้ — บอกใน tooltip) และปุ่ม/โหมด
  **"ดูแบบ Civil 3D"** = ซ่อน auxiliary + แสดงเฉพาะที่จะออกไปจริง
- **ต้นไม้ซ้าย**: object auxiliary ไอคอนเทา + ป้าย "aux" (หรือจัดกลุ่มย่อย "Auxiliary" — เลือกแบบที่อ่านง่ายกว่า บอกผู้ใช้)

## 4. โค้ด C# ที่สร้าง

- จุด auxiliary: คำนวณ `Pt?` ตามเดิม ไม่ `AddPoint` (มีอยู่แล้ว)
- link auxiliary: ไม่ประกาศตัวแปร `Link` / `Link[]` และไม่ `AddLink` — เขียนบรรทัดคอมเมนต์ `// L5 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D`
  (เป็นตำแหน่งให้ codelink กระโดดไป) และต้องไม่เกิด warning ของ compiler เพิ่ม
- สิ่งที่อ้าง auxiliary link ได้ในเชิงคำนวณคือ "จุดปลาย/def ของมัน" อยู่แล้ว (เช่น `intersect`, `between`) — ถ้าเจอกรณีที่ต้องการชนิดจุดใหม่
  (เช่น จุดบนโค้ง auxiliary) ให้ **เสนอผู้ใช้ก่อน** ไม่ต้องทำในรอบนี้
- spec ที่ฝังใน .cs (`// sa-spec:`) ต้องเก็บ `auxiliary` ครบ → เปิดไฟล์ใหม่แล้วได้หน้าตาเดิม

## 5. Test

- JS: evaluate ของ link auxiliary (ตรง / โค้ง) มี geometry, link จริงที่ปลายเป็น aux = เตือน, shape ปฏิเสธ aux link, สลับไปมาไม่เสีย code,
  undo/redo การสลับ, Copy/Paste/Rotate คงสถานะ auxiliary, โหลด `construction` เก่า
- C#: รันโค้ดที่สร้างผ่าน shim แล้วนับว่า **จำนวน Points / Links / Shapes ใน CorridorState = เฉพาะของจริง** (ไม่มีของ auxiliary หลุดเข้าไป)
  ทั้ง Side Right / Left; พิกัดจุดจริงที่อ้าง auxiliary ตรงกับที่ JS คำนวณ

## 6. Milestones

| M | งาน | ผู้ใช้ลองยังไง |
|---|---|---|
| 3b-0 | อ่านโค้ด construction ปัจจุบัน, `git status`, รัน test เดิมผ่าน, เสนอรูปแบบ spec + ตอบคำถามข้อ 7 | ตอบคำถาม |
| 3b-1 | ข้อ 1 เปลี่ยนชื่อ + อ่านของเก่า, ข้อ 2 auxiliary link + กติกา, ข้อ 4 โค้ด C# | วาดเส้น aux ช่วยหาจุดตัด แล้ววาด link จริงจากจุดตัดนั้น, ลองทำ shape ด้วย aux link |
| 3b-2 | ข้อ 3 UI ครบ (`X`, คลิกขวา, ปุ่ม Aux, ดูแบบ Civil 3D, ต้นไม้) + test ข้อ 5 + README | สลับไปมา, ซ่อน aux, ดูแบบ Civil 3D, Save แล้วเปิดใหม่ |

แล้วทำต่อ **Milestone 6 ของ prompt-3** โดยเพิ่มใน `tests-civil3d/round3-demo.cs` ให้มี auxiliary point + auxiliary link (ตรงและโค้ง)
ที่จุดจริงอ้างอิงอยู่ และเพิ่มใน `round3-checklist.md`:
(6) ใน Civil 3D ไม่เห็น auxiliary ใดๆ ใน assembly / corridor / section view และ code ของมันไม่โผล่ใน Code Set Style
(7) แก้ parameter ที่ทำให้ auxiliary ขยับ แล้วจุดจริงที่อ้างอิงขยับตามถูกต้อง

## 7. คำถามที่ต้องถามผู้ใช้ใน 3b-0 (มีค่าที่เสนอไว้ ถ้าผู้ใช้ตอบ "ตามที่เสนอ" ใช้ค่านี้)

1. Shortcut `X` สำหรับสลับ Auxiliary — เสนอ `X` (ถ้าชนอะไรในรอบ 3 ให้เสนอตัวอื่น)
2. ต้นไม้ซ้าย: ป้าย "aux" ปนกับของจริง หรือแยกกลุ่ม "Auxiliary" — เสนอ **ป้าย aux ปนกัน** (ลำดับตามการวาด)
3. ตอนเปิด Edit mode ครั้งแรก ให้แสดง auxiliary ไหม — เสนอ **แสดง**

### คำตอบ (Milestone 3b-0, 2026-10-29) — ใช้ค่าที่เสนอทั้งหมด
- Shortcut `X` = สลับ Auxiliary (ระหว่างวาด = โหมดของชิ้นที่กำลังสร้าง · มีของเลือกอยู่ = สลับชุดที่เลือก) — ไม่ชนตัวเลือกคำสั่งในรอบ 3 (Rotate C/R, Arc T/E, Polygon C) · `Ctrl+X` = ตัด เหมือนเดิม
- ต้นไม้ซ้าย: ป้าย "aux" ปนกับของจริง เรียงตามลำดับการวาด (ไอคอน/ชื่อสีเทา)
- เปิด Edit mode: แสดง auxiliary (ปุ่ม Aux เปิดอยู่ จำค่าข้ามการเปิดหน้าใหม่)
- spec: `auxiliary: true` บน point / link (รวม arc3 / arcR / fillet / followSurface)
  - อ่าน `construction: true` ของเก่าได้ (spec ใน .cs, .assembly.json, clipboard) = auxiliary · เขียนออกเป็น `auxiliary` อย่างเดียว · C# รับทั้งสอง key
  - codes ของ object auxiliary เก็บไว้ไม่ลบ แต่ไม่ส่งออก
  - จุดที่ระบบสร้างเอง (ศูนย์กลาง polygon, จุดผ่าน arc, จุดอ้างอิงจาก Tracking, มุมเดิมของ Fillet, จุดหมุน) = auxiliary เหมือนเดิม
  - Fillet: aux + aux = โค้ง + จุดสัมผัสเป็น aux · ผสม aux / จริง = โค้ง + จุดสัมผัสเป็นของจริง (link aux ฝั่งนั้นยังเป็น aux)
  - C#: link auxiliary = บรรทัดคอมเมนต์อย่างเดียว `// L7 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D`
