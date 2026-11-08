# ชุดทดสอบรอบ 4c ใน Civil 3D — rock-pitching ที่วาดใหม่ในเว็บ (ไม่เขียนโค้ด) เทียบกับไฟล์จริง

ไฟล์ในโฟลเดอร์นี้:

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `round4c-base.cs` | `TestSubassembly.Round4cBase` — วาดใหม่จาก `base_rock-pitching.cs` (class `Trapezoid`) — **build ลง Civil 3D** |
| `round4c-body.cs` | `TestSubassembly.Round4cBody` — วาดใหม่จาก `body_rock-pitching.cs` (class `RockPitchingBody`) — **build ลง Civil 3D** |
| `round4c-base.assembly.json` / `round4c-body.assembly.json` | project ของเว็บ (เปิดดู / ลากผิวดินดูรูปเปลี่ยน / แก้ต่อในเว็บ) |
| `round4c-checklist.md` | ไฟล์นี้ |

ทั้งสองไฟล์สร้างด้วยเครื่องมือของเว็บเท่านั้น (ลำดับการกดอยู่ใน `SA.Tests/js/rockpitching.test.js` — `buildBase()` / `buildBody()`):

| ไฟล์ | เครื่องมือที่ใช้ |
|---|---|
| base | ตาราง Parameter (TopWidth / SideSlope ต้องมากกว่า 0, Depth ขั้นต่ำ 2) · Point (dx / dy เป็นนิพจน์) · Link (เส้นฐาน = Auxiliary) · **Extend to Surface** ที่มุมฐานทั้งสอง · **Clipped Surface Link** (ขอบล่าง ไม่สูงกว่าเส้นฐาน) · Shape |
| body | ตาราง Parameter · **Offset** (ใต้ชั้นหิน / เส้นความหนาขั้นต่ำ — Auxiliary) · **Intersect** (R, B0, O) · **Extend to Surface** ที่ O (ปลายจริง = SoilToe) · Point `dy = min(ground(P1), P12.y)` · **Clipped Surface Link** (ไม่สูงกว่าเส้นดิน) · Shape 2 รูป |

ในเว็บผ่าน test เทียบกับไฟล์จริงแล้ว (`dotnet run --project SA.Tests` → หัวข้อ "รอบ 4c: rock-pitching ที่วาดใหม่ในเว็บ = ไฟล์จริง"):
ผิวดิน 8 / 7 แบบ × Side Right / Left × 4 ชุดค่า parameter (รวมค่าต่ำกว่าขั้นต่ำ / ≤ 0) — **จุด, link, shape และ code ตรงกันทุกกรณี** ยกเว้นข้อ 5 ด้านล่าง

---

## 0. ก่อนเริ่ม

- build `base_rock-pitching.cs`, `body_rock-pitching.cs` (ไฟล์จริง) และ `round4c-base.cs`, `round4c-body.cs` (ที่วาด) ลง Civil 3D (.dll + .atc เหมือนรอบก่อน)
- ต้องมี target surface (EG) ที่มีทั้งช่วงที่ดิน **สูงกว่า** และ **ต่ำกว่า** ระดับฐาน / เส้นดิน (ยิ่งขรุขระยิ่งดี)
- ทำ assembly 2 ชุด: (ก) ไฟล์จริง (ข) ที่วาด — parameter เท่ากัน แล้วทำ corridor 2 เส้นบน alignment เดียวกัน (หรือ assembly เดียว ซ้าย = จริง ขวา = ที่วาด)

## 1. base: ดินสูงกว่าฐานทั้งหมด

- [ ] คางหมู 4 จุด · code จุด `TrapTopInside` / `TrapTopOutside` / `TrapBaseOutside` / `TrapBaseInside` ตรงกัน
- [ ] link `Top`, `TrapSide` ×2, ขอบล่าง `Datum` + `TrapBase` · shape `Trapezoid`

## 2. base: ดินต่ำกว่ามุมฐาน (ต่อลงถึงดิน)

- [ ] มุมฐานที่ลอย → ต่อลงไปชนดินด้วย slope เดิม: จุด `TrapToeOutside` / `TrapToeInside` + link `TrapSide` ตรงกับไฟล์จริง
- [ ] ข้างเดียวลอย = ต่อข้างเดียว (อีกข้างไม่มีจุด Toe) · shape ยังปิดรูปเดียว

## 3. base: ดินตัดผ่านระดับฐาน

- [ ] ขอบล่าง = ต่ำกว่าระหว่างดินกับระดับฐาน · ช่วงตามดิน = `Datum` + `TrapOnSurface` · ช่วงบนฐาน = `Datum` + `TrapBase`
- [ ] จุดหักของดิน / จุดที่ดินตัดระดับฐาน ตรงกับไฟล์จริง (ใช้ List Points / Section View เทียบ)

## 4. body: ชั้นหิน + Compacted Soil

- [ ] ชั้นหิน: จุด `RockTopInside` / `RockTopOutside` / `RockBaseOutside` / `RockBaseInside` · link `Top`+`RockFace`, `Top`+`RockEnd`, `RockBase`, `RockBack` · shape `RockPitching`
- [ ] Soil: `SoilToe`, `SoilBaseInside` · link `Top`+`Datum`+`SoilEnd`, ขอบล่าง `Datum`+`SoilOnSurface` / `Datum`+`SoilMinThickness`, `SoilBack` · shape `CompactedSoil`
- [ ] ดินที่ O ต่ำกว่า O → เส้นปิดปลายต่อลงถึงดิน (SoilToe อยู่บนดิน) · ดินสูงกว่า → SoilToe = O

## 5. ต่างกันที่รู้แล้ว (ตาราง "ต่างกันตรงไหน" ใน docs/civil3d-testing.md)

- [ ] body: ดินต่ำมากจนเส้นปิดปลายต่อลงไปชนดิน **เลย origin เข้าด้านใน** (เช่น Height 4, FaceSlope 2, EndSlope 2, MinSoilThickness 1.5 บนดินต่ำ -9)
  — ไฟล์จริง: เตือน + ขอบล่างเป็นเส้นความหนาขั้นต่ำทั้งเส้น · ที่วาด: เตือน + ไม่ต่อ แต่ขอบล่างยังตามดิน → **รูปต่างกัน** (ทั้งคู่เตือน)
- [ ] ลำดับจุด / link ใน Civil 3D ต่างกัน (ไม่มีผลกับ corridor / code) — เช็กว่า Shape ระบายสีได้ทั้งคู่

## 6. Parameter

- [ ] Depth = 1.5 (base) / MinSoilThickness = 0.5 (body) → เตือน "… < 2 / 1, ใช้ … แทน" ทั้งคู่ รูปเท่ากัน
- [ ] TopWidth = −1 (base) / Height = −1 (body) → error (Severe) + ใช้ค่า default ทั้งคู่
- [ ] Side = Left → ภาพกระจกเหมือนกัน

## 7. Layout mode / ไม่มี target

- [ ] Layout: คางหมูปกติ / ขอบล่างหนาขั้นต่ำ ไม่เตือน ทั้งคู่
- [ ] ไม่ได้กำหนด Target Surface (ไม่ใช่ Layout): เตือนทั้งคู่ รูปเหมือน Layout

ผล: ____ ผ่าน / ____ ไม่ผ่าน — จดสถานี + parameter + ภาพ Section ของข้อที่ไม่ผ่านกลับมาให้ด้วย
