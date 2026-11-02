# ชุดทดสอบรอบ 4 ใน Civil 3D (round4-demo) — กิ่ง ตัด / ถม

ไฟล์ในโฟลเดอร์นี้:

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `round4-demo.cs` | subassembly `TestSubassembly.Round4Demo` ที่สร้างจาก SA Drawing Studio — **build ลง Civil 3D ไฟล์นี้** |
| `round4-demo.assembly.json` | project ของเว็บ (เปิดดู / ลากผิวดินดูรูปสลับ / วาดต่อในเว็บ) |
| `round4-checklist.md` | ไฟล์นี้ |

subassembly ตัวนี้ = ไหล่ทาง + ลาดตัด / ลาดถม ที่เลือกเองตามผิวดิน (เงื่อนไขในโค้ด ไม่ใช่ 2 subassembly):

| กิ่ง | เกิดเมื่อ | point / link code |
|---|---|---|
| — (เกิดเสมอ) | — | จุด `Crown`, `Shoulder` (บานพับ) · link `Top` · จุด `Ditch` (ต่อจากปลายลาดทั้งสองกรณี) |
| **ตัด** | `IsCut` = ผิวดินที่ offset ของ `Shoulder` **สูงกว่า** `Shoulder` | จุด / link `Daylight_Cut` (ลาด 1:`CutSlope` ขึ้น) · link `Ditch` (คูลึก 0.3 m) |
| **ถม** | `IsCut` เป็นเท็จ (ผิวดินเท่ากัน / ต่ำกว่า / **ไม่มีผิวดิน**) | จุด / link `Daylight_Fill` (ลาด 1:`FillSlope` ลง) · link `Ditch` (ราบ 1 m) |
| ถม › **ถมสูง** | ถม และ `Shoulder` สูงกว่าผิวดินเกิน `HighFillH` | จุด / link `Guardrail` (ราวกันตก เหนือไหล่ 0.8 m) |
| ถม › ถมปกติ | ถม และไม่เกิน `HighFillH` | (ไม่มีอะไรเพิ่ม) |
| **มีขอบทาง** | `Curb` = 1 | จุด / link `Curb` (สูง 0.15 m ที่ไหล่) |
| ไม่มีขอบทาง | `Curb` ค่าอื่น | (ไม่มีอะไรเพิ่ม) |

จุด `Daylight` (จุดแรกที่เกิดใน `Daylight_Cut`, `Daylight_Fill`) เป็น **auxiliary** — ไม่อยู่ใน Civil 3D ใช้ต่อจุด `Ditch` เท่านั้น

Parameter (Properties ของ subassembly ใน Civil 3D):

| ชื่อ | default | ใช้กับ |
|---|---|---|
| `Side` | 0 (Right) | 1 = Left ภาพกระจกทั้งตัว (เงื่อนไขเหมือนเดิม) |
| `Width` | 3 (ไม่น้อยกว่า 0.5) | ความกว้างบน · ไหล่ลาด 2% (`Shoulder` ต่ำกว่า `Crown` 0.02 × Width) |
| `CutSlope` / `FillSlope` | 1.5 / 2 | ลาดตัด 1:1.5 / ลาดถม 1:2 |
| `HighFillH` | 1.5 | ถมสูงกว่านี้ (m) = มีราวกันตก |
| `Curb` | 1 | 1 = มีขอบทาง · ค่าอื่น = ไม่มี |
| Target `TargetSurface` | — | ผิวดินที่ใช้ตัดสิน ตัด / ถม และที่ลาดวิ่งไปชน |

---

## 0. ก่อนเริ่ม

- **ต้องมี target surface** (EG) ที่ corridor ผ่านทั้งช่วงที่ดินสูงกว่าถนน (ตัด) และต่ำกว่าถนน (ถม) — ยิ่งมีช่วงถมลึกเกิน 1.5 m ยิ่งดี (เห็นราวกันตก)
  ไม่มี surface แบบนั้น: สร้าง surface ทดสอบง่ายๆ (TIN จากเส้น contour 2–3 เส้น หรือ point 4–5 จุด) ให้ profile ของถนนตัดผ่านผิวดิน
- build แบบเดียวกับรอบ 3 (`round3-checklist.md` ข้อ 0): คัดลอก `round4-demo.cs` เข้าโปรเจกต์ class library → build → เพิ่ม class `TestSubassembly.Round4Demo` ใน .atc / tool palette
- วาง subassembly ทั้งฝั่ง Right (`Side` = 0) และ Left (`Side` = 1) ใน assembly · ใน Corridor Properties → Targets กำหนด `TargetSurface` = EG ทั้งสองฝั่ง
- ดูในเว็บก่อนก็ได้: คัดลอก `round4-demo.assembly.json` ไปโฟลเดอร์เดียวกับ `run-viewer.bat` → **ไฟล์ ▾ → Open project** →
  ลากจุดผิวดินขึ้นลงดูรูปสลับ · แท็บ **Logic** (แถบล่าง) = ค่าเงื่อนไขสด · ปุ่ม **ดูแบบ Civil 3D** = หน้าตาที่ควรเห็นใน Civil 3D

## 1. ค่าที่ควรได้ (เทียบจุดที่ subassembly เกาะ)

เมื่อผิวดิน **ราบ** ใต้ช่วงนี้ที่ระดับ "จุดเกาะ + g" (offset, elevation) — ใช้เทียบใน section view ที่ผิวดินแถวนั้นค่อนข้างราบ:

| กรณี | กิ่งที่เกิด | `Shoulder` | `Daylight_Cut` / `Daylight_Fill` | `Ditch` | อื่นๆ | link |
|---|---|---|---|---|---|---|
| g = +2.0 | ตัด, มีขอบทาง | (3.000, -0.060) | Cut (6.090, 2.000) | (7.090, 1.700) | `Curb` (3.000, 0.090) | 4 |
| g = +2.0, `CutSlope` = 1 | ตัด, มีขอบทาง | (3.000, -0.060) | Cut (5.060, 2.000) | (6.060, 1.700) | `Curb` | 4 |
| g = -1.0 | ถม › ถมปกติ, มีขอบทาง | (3.000, -0.060) | Fill (4.880, -1.000) | (5.880, -1.000) | `Curb` | 4 |
| g = -1.0, `Curb` = 0 | ถม › ถมปกติ, ไม่มีขอบทาง | (3.000, -0.060) | Fill (4.880, -1.000) | (5.880, -1.000) | — | 3 |
| g = -3.0 | ถม › **ถมสูง**, มีขอบทาง | (3.000, -0.060) | Fill (8.880, -3.000) | (9.880, -3.000) | `Guardrail` (2.700, 0.740), `Curb` | 5 |
| g = -3.0, `HighFillH` = 4 | ถม › ถมปกติ | (3.000, -0.060) | Fill (8.880, -3.000) | (9.880, -3.000) | `Curb` (ไม่มี `Guardrail`) | 4 |
| g = -3.0, `Side` = 1 | ถม › ถมสูง | (-3.000, -0.060) | Fill (-8.880, -3.000) | (-9.880, -3.000) | `Guardrail` (-2.700, 0.740) | 5 |
| Layout mode (assembly) | ถม (ไม่มีผิวดิน) | (3.000, -0.060) | Fill (6.000, -1.560) ยาว 3 m | (7.000, -1.560) | `Curb` | 4 |

ผิวดินจริงไม่ราบ: offset ของปลายลาดเปลี่ยนตามดิน แต่ **กิ่ง** ต้องตรงตามนิยามเสมอ (ดูข้อ 2)

## 2. Checklist

ติ๊กทีละข้อ แล้วส่งผล (รูป section view / ข้อความใน Event Viewer) กลับมาได้เลย

- [ ] **(1) build ผ่าน** และวางลงใน assembly ได้ — ใน assembly (Layout mode ไม่มีผิวดิน) เห็นเป็น **ถม** ยาว 3 m + `Curb` ตามตารางข้อ 1 · ไม่มี error
- [ ] **(2) สลับ ตัด / ถม ตามผิวดินจริงตลอด corridor**
  - ช่วงที่ EG สูงกว่าไหล่ทาง: มีแต่ `Daylight_Cut` ขึ้นไปชนดิน + คูลึก 0.3 m · **ไม่มี** `Daylight_Fill`
  - ช่วงที่ EG ต่ำกว่าไหล่ทาง: มีแต่ `Daylight_Fill` ลงไปชนดิน + `Ditch` ราบ 1 m · **ไม่มี** `Daylight_Cut`
  - ตรงรอยต่อ ตัด ↔ ถม: section ข้างเคียงสลับกันโดยไม่มี section ที่มีทั้งสองเส้น / ไม่มีเส้นลาดหาย
- [ ] **(3) กิ่งซ้อน "ถมสูง"**: section ที่ไหล่สูงกว่าดินเกิน 1.5 m มี `Guardrail` · ถมตื้นกว่านั้นไม่มี · ช่วงตัดไม่มีแน่นอน
  - `HighFillH` = 4 → `Guardrail` หายจาก section ที่ถมไม่ถึง 4 m
- [ ] **(4) switch `Curb`**: default มี `Curb` ทุก section · `Curb` = 0 → หายหมด · `Curb` = 1 → กลับมา
- [ ] **(5) แก้ parameter แล้วรูปตาม**: `CutSlope` = 1 → ลาดตัดชันขึ้น (ตารางข้อ 1) · `FillSlope` = 3 → ลาดถมยาวขึ้น · `Width` = 4 → ไหล่ออกไป 1 m ลาดทั้งคู่ขยับตาม
- [ ] **(6) ฝั่ง Left (`Side` = 1)**: เป็นภาพกระจก และตัดสินตัด / ถม จาก **ผิวดินฝั่งซ้ายเอง** (ฝั่งซ้ายตัด ฝั่งขวาถมใน section เดียวกันได้)
- [ ] **(7) ไม่ได้กำหนด target** (ลบ `TargetSurface` ออกจาก Targets ของ corridor ชั่วคราว): ทุก section = ถม ยาว 3 m + คำเตือนใน Event Viewer (ไม่ crash)
- [ ] **(8) จุด auxiliary ไม่โผล่**: ไม่มีจุด code `Daylight` ใน section / ไม่มี code `Daylight` ในรายการ code ของ Code Set Style
- [ ] **(9) ไม่มี error ใน Event Viewer** ตอนมีผิวดิน (ค่า default ทั้งสองฝั่ง) · ส่วนที่ไม่เกิดเพราะเงื่อนไข **ต้องไม่ขึ้นเตือน**
- [ ] **(10) Code Set Style**: `Daylight_Cut`, `Daylight_Fill`, `Ditch`, `Guardrail`, `Curb`, `Top` แยกสี / label ได้ (ถ้าตั้ง style ไว้)

## 3. ส่งผลกลับ

บอกข้อที่ไม่ผ่าน + รูป section view (มีป้าย offset / elevation ยิ่งดี) / ข้อความใน Event Viewer
ถ้า build ไม่ผ่าน ส่งข้อความ error ของ Visual Studio มาทั้งก้อน
