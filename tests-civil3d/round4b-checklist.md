# ชุดทดสอบรอบ 4b ใน Civil 3D (round4b-demo) — Max / Min ของจุด

ไฟล์ในโฟลเดอร์นี้:

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `round4b-demo.cs` | subassembly `TestSubassembly.Round4bDemo` ที่สร้างจาก SA Drawing Studio — **build ลง Civil 3D ไฟล์นี้** |
| `round4b-demo.assembly.json` | project ของเว็บ (เปิดดู / ลากผิวดินดูจุดถูกขยับ / แท็บ Logic → Max / Min) |
| `round4b-checklist.md` | ไฟล์นี้ |

หน้าตัดแบบหินเรียง / คันกั้นน้ำ (ทรงเดียวกับ `base_rock-pitching.cs`) แต่ใช้ **Max / Min** แทนโค้ด `if (depth < MinDepth)`:

| จุด (point code) | Max / Min | ถ้าไม่ผ่าน |
|---|---|---|
| `WallTop` (สันกำแพงเหนือ `TrapTopOutside` สูง `WallH`) | ต้อง **สูงกว่าระดับ `DesignWL` (ระดับจริง) อย่างน้อย `Freeboard`** | ยกขึ้นแนวดิ่ง + เตือน |
| `TrapBaseOutside` (ฐานด้านนอก ลาด 1:`SideSlope` ลึก `Depth` ตามแบบ) | ต้อง **ต่ำกว่าผิวดินอย่างน้อย `MinDepth`** (วัดดิน ณ ตำแหน่งใหม่) | ขยับลงตามแนวลาดเดิม + เตือน |
| `TrapBaseInside` | ระดับเดียวกับ `TrapBaseOutside` (`dy = P4.y`) — ตามฐานลงไปเอง | — |
| `DitchBottom` (ก้นคู บนผิวดินที่ห่างไหล่ `DitchOffset`) | ต้อง **ต่ำกว่าไหล่ (`TrapTopOutside`) 0.5–1.5 ม.** (`DitchMin` / `DitchMax`) | ขยับแนวดิ่ง + เตือน |
| `Underlay` (รองพื้นใต้ฐาน 0.3 ม.) | เกิดเฉพาะกิ่ง **"บังคับลึก"** = เงื่อนไข `Deep = limited(P4)` (ฐานถูกขยับ) | — |

Parameter: `Side` 0 · `TopWidth` 2 · `SideSlope` 1.5 · `Depth` 1 · `MinDepth` 1.5 · `WallH` 0.5 · `DesignWL` 101 (ระดับจริง) · `Freeboard` 0.5 ·
`DitchOffset` 3 · `DitchMin` 0.5 · `DitchMax` 1.5 · Target `TargetSurface`

---

## 0. ก่อนเริ่ม

- build แบบเดียวกับรอบ 3 / 4 (`round3-checklist.md` ข้อ 0): คัดลอก `round4b-demo.cs` เข้าโปรเจกต์ class library → build → เพิ่ม class `TestSubassembly.Round4bDemo` ใน .atc / tool palette
- corridor ที่มี target surface (EG) · **ตั้ง `DesignWL` ให้เข้ากับงาน**: ระดับจริงที่อยู่เหนือ profile บางช่วงและต่ำกว่าบางช่วง จะเห็น `WallTop` ถูกยก / ไม่ถูกยก
- ดูในเว็บก่อนก็ได้: คัดลอก `round4b-demo.assembly.json` ไปโฟลเดอร์เดียวกับ `run-viewer.bat` → **ไฟล์ ▾ → Open project** → เข้า Edit →
  เลือกจุดที่มี ↕ เห็นเส้นประขอบ + ลูกศร · แท็บ **Logic** → ส่วน Max / Min = สถานะสด

## 1. ค่าที่ควรได้ (เทียบจุดที่ subassembly เกาะ)

ผิวดิน **ราบ** ที่ระดับ "จุดเกาะ + g" · ค่า default · (offset, elevation)

| กรณี | ไม่ผ่าน (เตือน) | `WallTop` | `TrapBaseOutside` | `TrapBaseInside` | `DitchBottom` | `Underlay` |
|---|---|---|---|---|---|---|
| g = 0, จุดเกาะสูง 100.000 | WallTop, ฐาน, คู (3) | (2.000, 1.500) | (4.250, -1.500) | (-0.500, -1.500) | (5.000, -0.500) | (4.250, -1.800) |
| g = -2, จุดเกาะ 100.000 | WallTop, ฐาน, คู (3) | (2.000, 1.500) | (7.250, -3.500) | (-0.500, -3.500) | (5.000, -1.500) | (7.250, -3.800) |
| g = -0.3, จุดเกาะ 100.000 | WallTop, ฐาน, คู (3) | (2.000, 1.500) | (4.700, -1.800) | (-0.500, -1.800) | (5.000, -0.500) | (4.700, -2.100) |
| g = 0, จุดเกาะ **101.500** | ฐาน, คู (2) | (2.000, 0.500) ไม่ยก | (4.250, -1.500) | (-0.500, -1.500) | (5.000, -0.500) | (4.250, -1.800) |
| g = 0, `Depth` = 2, `MinDepth` = 1 | WallTop, คู (2) | (2.000, 1.500) | (5.000, -2.000) ผ่าน | (-0.500, -2.000) | (5.000, -0.500) | **ไม่มี** |
| g = -1, `Side` = 1 | WallTop, ฐาน (2) | (-2.000, 1.500) | (-5.750, -2.500) | (0.500, -2.500) | (-5.000, -1.000) ผ่าน | (-5.750, -2.800) |
| Layout mode (assembly) | WallTop, คู (2) — ฐานไม่ขยับ (ไม่มีดิน) | (2.000, 1.500) | (3.500, -1.000) | (-0.500, -1.000) | (5.000, -0.500) | **ไม่มี** |

- `WallTop` ทุกแถว (ยกเว้นจุดเกาะ 101.500): ระดับจริง = `DesignWL` + `Freeboard` = **101.500** พอดี
- ข้อความเตือนแบบ rock-pitching เช่น `P4 ต่ำกว่าผิวดิน 1.00 m < 1.50 m ใช้ 1.50 m แทน` (g = 0) · `P3 สูงกว่า ระดับ DesignWL -0.50 m < 0.50 m ใช้ 0.50 m แทน` · `P6 ต่ำกว่า P2 0.00 m < 0.50 m ใช้ 0.50 m แทน`

## 2. Checklist

- [ ] **(1) build ผ่าน** วางลง assembly ได้ — ใน assembly (Layout mode) เห็นตามแถวสุดท้ายของตาราง · คำเตือนมีแค่ WallTop / คู
- [ ] **(2) ฐานลึกตามผิวดินจริง**: ตลอด corridor `TrapBaseOutside` ต่ำกว่า EG ที่ offset ของมันอย่างน้อย 1.50 ม. เสมอ (วัดใน section view)
  — ช่วงดินต่ำ ฐานยืดลงตามแนวลาด 1:1.5 เดิม (ไม่หักมุม) · `TrapBaseInside` ระดับเดียวกับฐานนอก
- [ ] **(3) เตือนตรงช่วงที่ถูกขยับ**: Event Viewer ของ corridor มีคำเตือน `ValueTooSmall` / `ValueTooLarge` เฉพาะ station ที่ถูกขยับ (ข้อความตามข้อ 1)
- [ ] **(4) สันกำแพงพ้นน้ำ**: ระดับจริงของ `WallTop` ≥ `DesignWL` + `Freeboard` ทุก section · ช่วงที่ profile สูงพออยู่แล้ว `WallTop` = ไหล่ + 0.5 (ไม่ถูกยก)
- [ ] **(5) คู**: ก้นคูต่ำกว่าไหล่ 0.5–1.5 ม. เสมอ — ดินแถวคูสูง = กดลงเหลือ 0.5 · ดินต่ำมาก = ยกขึ้นที่ 1.5
- [ ] **(6) กิ่ง `limited()`**: `Underlay` มีเฉพาะ section ที่ฐานถูกบังคับลึก · ตั้ง `Depth` = 3 แล้ว `Underlay` หายจาก section ที่ดินไม่ต่ำเกิน
- [ ] **(7) แก้ parameter ใน Properties แล้วรูปตาม**: `MinDepth` = 2.5 → ฐานลึกขึ้น · `Freeboard` = 1 → กำแพงสูงขึ้น 0.5 · `DesignWL` ต่ำลงจนผ่าน → กำแพงกลับเป็น `WallH`
- [ ] **(8) ฝั่ง Left (`Side` = 1)**: ภาพกระจก · ฐานลงตามแนวลาดที่กลับด้าน · ขอบเขตดิ่งเหมือนเดิม
- [ ] **(9) ไม่ได้กำหนด target**: ฐานไม่ขยับ (ลึกตาม `Depth`) + เตือน "ไม่ได้กำหนด Target Surface" · กำแพง / คู ยังคุม (อ้างระดับ / จุด) · ไม่ crash
- [ ] **(10) shape `Body`** ปิดรูปและ hatch ได้ทุก section (รวมช่วงที่ฐานถูกยืด)

## 3. ส่งผลกลับ

บอกข้อที่ไม่ผ่าน + รูป section view (มีป้าย offset / elevation) + ข้อความใน Event Viewer · build ไม่ผ่าน ส่ง error ของ Visual Studio มาทั้งก้อน
