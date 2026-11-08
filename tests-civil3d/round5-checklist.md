# ชุดทดสอบรอบ 5 ใน Civil 3D (round5-demo) — switch / ตัด-ถม / elif ชานพัก / Variable

ไฟล์ในโฟลเดอร์นี้:

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `round5-demo.cs` | subassembly `TestSubassembly.Round5Demo` ที่สร้างจาก SA Drawing Studio (Save ผ่านปุ่ม Save (.cs)) — **build ลง Civil 3D ไฟล์นี้** |
| `round5-demo.assembly.json` | project ของเว็บ (ไฟล์ ▾ → Open project · ลากผิวดินดูกิ่งสลับ · ต้นไม้ Conditions / Variables · แท็บ Logic → ข้อความ) |
| `round5-checklist.md` | ไฟล์นี้ |

ลำดับการสร้างในเว็บ (ไม่เขียนโค้ด) = `buildRound5()` ใน `SA.Tests/js/round5demo.test.js` (ทุกขั้นเรียก Logic API ชุดเดียวกับปุ่ม / ต้นไม้ Conditions / หน้าต่าง Variable)

subassembly ตัวนี้ = ครึ่งคันดิน (Right) — สันกว้าง `Width` + ลาดตัด / ลาดถมที่เลือกเองตามผิวดิน + ชานพักเมื่อถมสูง + ร่องแกน + ชั้นป้องกันบนสันตาม `ProtectionType`

มุมมองข้อความ (แท็บ Logic → ข้อความ):
```
Variables:
  DepthUsed = ถ้า Depth < 2 → 2 (เตือน) · ไม่งั้น → Depth
Conditions:
  IsCut = ground(P2) > P2.y
  HighFill = P2.y - ground(P2) > BermH
ถ้า IsCut:                     [D1 ตัดหรือถม?]
    ตัด: ลาดตัด 1:CutSlope ขึ้นไปหาผิวดิน
ไม่ใช่:
    ถม:
    ถ้า HighFill:              [D2 ถมสูงไหม?]
        ถมสูง (ชานพัก): ลาดลง BermH → ชานพัก BermW → ลาดจนชนดิน
    ไม่ใช่:
        ถมปกติ: ลาดถม 1:FillSlope ลงไปหาผิวดิน
switch ProtectionType:         [D3 ชั้นป้องกัน]
    = 1  หินเรียง:  ชั้น Rock หนา RockT บนสัน
    = 2  คอนกรีต:  ชั้น Concrete หนา ConcT บนสัน
    อื่นๆ ไม่มีชั้นป้องกัน
```

| กิ่ง | เกิดเมื่อ | point / link / shape code |
|---|---|---|
| — (เกิดเสมอ) | — | จุด `CrestInside`, `CrestOutside` · link `Top, Crest` · ร่องแกน: จุด `KeyBottomInside`, `KeyBottomOutside`, `KeyTop` · link `Key` / `KeyBottom` · shape `CoreKey` |
| **ตัด** | `IsCut` = ผิวดินที่ไหล่ (`CrestOutside`) สูงกว่าไหล่ | จุด / link `Daylight_Cut` |
| ถม › **ถมปกติ** | ไม่ตัด และถมไม่เกิน `BermH` | จุด / link `Daylight_Fill` |
| ถม › **ถมสูง (ชานพัก)** | ไม่ตัด และไหล่สูงกว่าผิวดินเกิน `BermH` | จุด `BermInside`, `BermOutside`, `Daylight_Fill` · link `Top, Daylight_Fill` / `Top, Berm` |
| **หินเรียง** | `ProtectionType` = 1 | จุด `RockTopInside` / `RockTopOutside` · link `Rock`, `Top, Rock` · shape `Rock` |
| **คอนกรีต** | `ProtectionType` = 2 | จุด `ConcreteTopInside` / `ConcreteTopOutside` · link `Concrete`, `Top, Concrete` · shape `Concrete` |
| ไม่มีชั้นป้องกัน | `ProtectionType` ค่าอื่น | (ไม่มีอะไรเพิ่ม) |

Parameter (Properties ของ subassembly ใน Civil 3D):

| ชื่อ | default | ใช้กับ |
|---|---|---|
| `Side` | 0 (Right) | 1 = Left ภาพกระจกทั้งตัว |
| `Width` | 4 (ไม่น้อยกว่า 1) | ความกว้างสัน (ครึ่งตัว) |
| `ProtectionType` | 1 | 1 หินเรียง · 2 คอนกรีต · อื่นๆ ไม่มี |
| `RockT` / `ConcT` | 0.5 / 0.2 | ความหนาชั้นป้องกัน |
| `Depth` | 2.5 | ร่องแกนลึก — **น้อยกว่า 2 = ใช้ 2 + เตือน** (Variable `DepthUsed`) |
| `KeyW` | 1 | ร่องแกนกว้าง |
| `BermH` / `BermW` | 3 / 2 | ถมสูงเกิน `BermH` = มีชานพักกว้าง `BermW` ที่ระดับต่ำกว่าไหล่ `BermH` |
| `CutSlope` / `FillSlope` | 1.5 / 2 (ชนิด Slope 1:x) | ลาดตัด 1:1.5 / ลาดถม 1:2 (ชานพักใช้ `FillSlope` ด้วย) |
| Target `TargetSurface` | — | ผิวดินที่ใช้ตัดสิน ตัด / ถม / ถมสูง และที่ลาดวิ่งไปชน |

---

## 0. ก่อนเริ่ม

- build `round5-demo.cs` (namespace `TestSubassembly` class `Round5Demo`) แบบเดียวกับรอบก่อน แล้วสร้าง tool ใน Tool Palette
- **target surface** ที่ corridor ผ่านทั้งช่วง **ตัด** (ดินสูงกว่าไหล่), **ถมปกติ** (ต่ำกว่าไม่เกิน 3 m) และ **ถมสูง** (ต่ำกว่าเกิน 3 m) — ยิ่งมีช่วงเปลี่ยนต่อเนื่องยิ่งดี
- วาง assembly: subassembly นี้ฝั่ง Right (และอีกตัว `Side = 1` ฝั่ง Left ถ้าอยากเทียบภาพกระจก)

## 1. ในเว็บก่อน (ไม่ต้องมี Civil 3D)

- [ ] ไฟล์ ▾ → Open project → `round5-demo.assembly.json` · เปิดเห็นรูป ไม่มี error
- [ ] ต้นไม้ซ้าย → Conditions: IsCut › (ถม) › HighFill ซ้อน (elif) · switch ProtectionType 3 กิ่ง · Variables: DepthUsed ชิป `2.5 m`
- [ ] ลากผิวดินขึ้นลง → ชิป / ✓ ในต้นไม้ และแท็บ Logic → ข้อความ เปลี่ยนตาม (ตัด → ถมปกติ → ถมสูง)
- [ ] Properties ของ subassembly: ProtectionType 1 / 2 / 3 → ชั้นบนสันเปลี่ยน หิน / คอนกรีต / ไม่มี
- [ ] Depth = 1.5 → ร่องแกนลึก 2 + Messages "Depth = 1.5 m < 2 m ใช้ 2 m แทน"

## 2. ใน Civil 3D — corridor

- [ ] corridor สร้างได้ทั้งเส้น ไม่มี error สีแดงใน Event Viewer (ค่า default)
- [ ] ช่วง **ตัด**: รูปตัดมีลาดตัดขึ้นไปชนดิน (`Daylight_Cut`) ไม่มีลาดถม / ชานพัก
- [ ] ช่วง **ถมปกติ**: ลาดถม 1:2 ลงไปชนดิน (`Daylight_Fill`) ไม่มีชานพัก
- [ ] ช่วง **ถมสูง** (ไหล่สูงกว่าดินเกิน 3 m): ลาดลง 3 m → ชานพักราบกว้าง 2 m → ลาด 1:2 ลงไปชนดิน
- [ ] สถานีที่ช่วงเปลี่ยน (ตัด ↔ ถม ↔ ถมสูง) รูปตัดสลับถูก ไม่มีเส้นค้าง / จุดหลุด
- [ ] ร่องแกนใต้สันลึก 2.5 m กว้าง 1 m ทุกสถานี (shape `CoreKey`)

## 3. Parameter ใน Properties ของ subassembly (Civil 3D)

- [ ] `ProtectionType` = 1 → ชั้นหินหนา 0.5 m บนสัน (shape `Rock`)
- [ ] `ProtectionType` = 2 → ชั้นคอนกรีตหนา 0.2 m (shape `Concrete`) ชั้นหินหายไป
- [ ] `ProtectionType` = 3 (หรือ 0) → ไม่มีชั้นบนสัน
- [ ] `Depth` = 1.5 → ร่องแกนลึก **2 m** + **Event Viewer** มีเตือน `Depth = 1.5 m < 2 m ใช้ 2 m แทน` (ValueTooSmall)
- [ ] `BermH` = 1 → ช่วงถมเกือบทั้งหมดกลายเป็นถมสูง (มีชานพัก)
- [ ] `Side` = 1 → ภาพกระจก (ลาด / ชานพักไปทางซ้าย) เงื่อนไขเหมือนเดิม

## 4. code / label

- [ ] Code Set Style แสดง link `Daylight_Cut`, `Daylight_Fill`, `Berm`, `Rock`, `Concrete`, `Key` ตามกิ่ง
- [ ] shape `Rock` / `Concrete` / `CoreKey` ใช้ในปริมาณงาน (Quantity Takeoff) ได้

## บันทึกผล

| ข้อ | ผ่าน / ไม่ผ่าน | หมายเหตุ |
|---|---|---|
| | | |
