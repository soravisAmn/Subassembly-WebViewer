# ชุดทดสอบรอบ 5b ใน Civil 3D (round5b-demo) — Loop: คันดินถม ชานพักทุก BermInterval

ไฟล์ในโฟลเดอร์นี้:

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `round5b-demo.cs` | subassembly `TestSubassembly.Round5bDemo` ที่สร้างจาก SA Drawing Studio (Save ผ่าน Save (.cs)) — **build ลง Civil 3D ไฟล์นี้** |
| `round5b-demo.assembly.json` | project ของเว็บ (ไฟล์ ▾ → Open project · ลากจุดผิวดินที่ไหล่ขึ้นลงดูจำนวนชั้นเปลี่ยน · ต้นไม้ Arrays · แท็บ Logic → ข้อความ) |
| `round5b-checklist.md` | ไฟล์นี้ |

ลำดับการสร้างในเว็บ (ไม่เขียนโค้ด) = `buildRound5b()` ใน `SA.Tests/js/round5bdemo.test.js`
(ปุ่ม Array + ติ๊ก Loop · ปุ่ม "สร้างจุดชุดสุดท้าย" · + Condition · + Variable — ทุกขั้นเรียก Logic API ชุดเดียวกับหน้าจอ)

subassembly ตัวนี้ = ครึ่งคันดินถม (Right) — สันกว้าง `Width` แล้ว:
- **ถมต่ำ** (ความสูงถมที่ไหล่ `FillH` ไม่เกิน `BermInterval`): ลาดถม 1:`FillSlope` เส้นเดียวลงไปชนดิน
- **มีชานพัก**: ทำซ้ำชุด "ลาดลง `BermInterval` → ชานพักราบ `BermW`" **N = floor(FillH / BermInterval) ชั้น** (Loop A1 · สูงสุด 10)
  ลาดชั้นที่ i (บนสุด i = 0) = 1:(`FillSlope` + `SlopeInc` × i) — ชั้นล่างลาดกว่า
  แล้วลาดสุดท้ายจาก **ปลายชานพักชั้นสุดท้าย** (จุด lastOf) ลงไปชนดินที่ 1:(`FillSlope` + `SlopeInc` × `count(A1)`)

มุมมองข้อความ (แท็บ Logic → ข้อความ — ค่าตอนนี้ต่อท้ายแต่ละบรรทัด):
```
Variables:
  FillH = ถ้า not hasGround() → LayoutH · ไม่งั้น → P2.y - ground(P2)
Conditions:
  HighFill = FillH > BermInterval
Arrays:
  ทำซ้ำ A1 (P2, P4, P5, L3, L4): N = max(1, floor(FillH / BermInterval)) สูงสุด 10 ปัดลง · dx = BermW + BermInterval * (FillSlope + SlopeInc * i) · dy = -BermInterval · ต่อชุด จุดร่วม P5 → P2
เกิดเสมอ: P1, P2, L1
ถ้า HighFill:                               [D1 มีชานพักไหม?]
    มีชานพัก (Loop) (B1): P4, P5, P24 (aux), P25, L3, L4, L23, สมาชิก A1 (ชุด 2–10)
ไม่ใช่:
    ถมต่ำ (B2): P3, L2
```

| กิ่ง / ชุด | เกิดเมื่อ | point / link code |
|---|---|---|
| — (เกิดเสมอ) | — | จุด `CrestInside`, `CrestOutside` · link `Top, Crest` |
| **ถมต่ำ** | `FillH` ≤ `BermInterval` | จุด / link `Daylight_Fill` (link `Top, Daylight_Fill`) |
| **มีชานพัก** ชั้นที่ 1 … N | `FillH` > `BermInterval` · ชั้นที่ k เกิดเมื่อ k ≤ N | จุด `BermInside`, `BermOutside` · link `Top, Fill` (ลาด) / `Top, Berm` (ชานพัก) |
| **มีชานพัก** ลาดสุดท้าย | `FillH` > `BermInterval` | จุด `Daylight_Fill` · link `Top, Daylight_Fill` |

Parameter:

| ชื่อ | default | ใช้กับ |
|---|---|---|
| `Side` | 0 (Right) | 1 = Left ภาพกระจก |
| `Width` | 4 (ไม่น้อยกว่า 1) | ความกว้างสัน (ครึ่งตัว) |
| `FillSlope` | 2 (ชนิด Slope 1:x) | ลาดชั้นบนสุด |
| `SlopeInc` | 0.25 | ลาดชั้นถัดลงไปเพิ่มทีละเท่านี้ (0 = ทุกชั้นเท่ากัน) |
| `BermInterval` | 3 m | มีชานพักทุกความสูงเท่านี้ |
| `BermW` | 2 m | ความกว้างชานพัก |
| `LayoutH` | 7 m | ความสูงถมที่ใช้ตอนไม่มีผิวดิน (Layout) |
| Target `TargetSurface` | — | ผิวดินที่ใช้หา `FillH` (ที่ไหล่) และที่ลาดสุดท้ายวิ่งไปชน |

ค่าที่ควรได้ (ผิวดินราบ · ค่า default):

| ถม `FillH` | N (ชั้น) | `BermInside` ชั้น 1 / 2 (offset) | ปลายลาด `Daylight_Fill` |
|---|---|---|---|
| 2 m | – (ถมต่ำ) | – | 8.00 |
| 7 m | 2 | 10.00 / 18.75 | 23.25 (ลาดสุดท้าย 1:2.5 ลง 1 m) |
| 13 m | 4 | 10.00 / 18.75 / … | ลาดสุดท้าย 1:3 ลง 1 m |
| 40 m | 10 (ต้องการ 13 — ⚠ เกินสูงสุด) | | |

ข้อจำกัดที่รู้: `FillH` วัดที่ไหล่ (`CrestOutside`) จุดเดียว — ผิวดินลาดมาก ชานพักชั้นล่างอาจอยู่ใต้ดิน (ไม่ตัดออก) · ชานพักกว้างเท่ากันทุกชั้น
(dx / dy ของ Array เลื่อนทั้งชุดเท่ากัน `i` จึงเปลี่ยนได้แค่ระยะระหว่างชุด = ความลาด)

---

## 0. ก่อนเริ่ม

- build `round5b-demo.cs` (namespace `TestSubassembly` class `Round5bDemo`) แบบเดียวกับรอบก่อน แล้วสร้าง tool ใน Tool Palette
- **target surface** ที่ความสูงถม (ไหล่คันดินเทียบผิวดิน) เปลี่ยนตามสถานีตั้งแต่ < 3 m ถึง > 12 m — เช่น profile คันดินราบผ่านหุบ
- วาง assembly: subassembly นี้ฝั่ง Right (และอีกตัว `Side = 1` ฝั่ง Left ถ้าอยากเทียบภาพกระจก)

## 1. ในเว็บก่อน (ไม่ต้องมี Civil 3D)

- [ ] ไฟล์ ▾ → Open project → `round5b-demo.assembly.json` · เห็นชานพัก 2 ชั้น + ป้าย "A1 ×2" · ไม่มี error
- [ ] ต้นไม้ซ้าย → Arrays → A1 `Loop N = max(1, floor(FillH / BermInterval)) · สูงสุด 10` ชิป ×2 · ชุด 1–2 ✓ ชุด 3–10 จาง –
- [ ] ลากจุดผิวดินที่ x = 4 ลงลึก → ชิป ×3, ×4 … และชั้นบนรูปเพิ่มสด · ขึ้นสูง (ถมไม่ถึง 3 m) → กิ่ง ถมต่ำ
- [ ] แสดงทุกกรณี (ตอน Edit) → ชั้นที่ยังไม่เกิดเป็นเส้นประจาง ป้าย ‹A1 ชุดที่ 5›
- [ ] บันทึก scenario ถม 2 / 4 / 40 m → แท็บ Logic ไม่เตือน "ยังไม่มี scenario ที่ N = 1 / สูงสุด" แล้ว
- [ ] Properties ของ subassembly: SlopeInc 0 → ลาดทุกชั้น 1:2 · BermInterval 2 → ชั้นเพิ่ม

## 2. ใน Civil 3D — corridor

- [ ] corridor สร้างได้ทั้งเส้น ไม่มี error สีแดงใน Event Viewer (ค่า default ที่ถมไม่เกิน 33 m)
- [ ] ช่วงถมไม่ถึง 3 m: ลาดเส้นเดียวลงไปชนดิน (`Daylight_Fill`) ไม่มีชานพัก
- [ ] ช่วงถม 3–6 m: ชานพัก 1 ชั้น · 6–9 m: 2 ชั้น · … **จำนวนชานพักเปลี่ยนตามสถานี** (ดูรูปตัดหลายสถานี)
- [ ] ชั้นที่ 2 ลงไปลาดกว่าชั้นบน (1:2.25, 1:2.5, …) · ชานพักราบกว้าง 2 m ทุกชั้น
- [ ] ลาดสุดท้ายต่อจากปลายชานพักชั้นสุดท้ายเสมอ (ไม่ใช่จากชั้นแรก) แล้วชนดิน
- [ ] สถานีที่จำนวนชั้นเปลี่ยน (เช่น ถม 5.9 → 6.1 m) รูปตัดสลับถูก ไม่มีจุด / link ค้าง (Points / Links มีเฉพาะชั้นที่เกิด)

## 3. Parameter ใน Properties ของ subassembly (Civil 3D)

- [ ] `BermInterval` = 2 → ชานพักถี่ขึ้น
- [ ] `SlopeInc` = 0 → ทุกชั้นลาด 1:2
- [ ] `BermW` = 3 → ชานพักกว้าง 3 m
- [ ] ถมสูงมาก (เช่น `BermInterval` = 1 ช่วงถม > 11 m) → ใช้ 10 ชั้น + **Event Viewer** มีเตือน `Array A1: ต้องการ … ชุด เกินสูงสุด 10 ใช้ 10` (ValueTooLarge)
- [ ] `Side` = 1 → ภาพกระจก (ชานพักไปทางซ้าย)

## 4. code / label

- [ ] Code Set Style แสดง link `Berm` (ชานพัก), `Fill` (ลาดระหว่างชั้น), `Daylight_Fill` (ลาดสุดท้าย / ถมต่ำ), `Crest`
- [ ] Feature line จาก point code `BermInside` / `BermOutside` ต่อกันตามชั้น (ชั้นที่ไม่เกิดที่สถานีนั้นไม่มีจุด)

## บันทึกผล

| ข้อ | ผ่าน / ไม่ผ่าน | หมายเหตุ |
|---|---|---|
| | | |
