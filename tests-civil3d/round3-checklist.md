# ชุดทดสอบรอบ 3 ใน Civil 3D (round3-demo)

ไฟล์ในโฟลเดอร์นี้:

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `round3-demo.cs` | subassembly `TestSubassembly.Round3Demo` ที่สร้างจาก SA Drawing Studio — **build ลง Civil 3D ไฟล์นี้** |
| `round3-demo.assembly.json` | project ของเว็บ (ใช้เปิดดู / วาดต่อในเว็บ) |
| `round3-checklist.md` | ไฟล์นี้ |

ใน subassembly ตัวเดียวมีครบทุกอย่างของรอบ 3:

| ส่วน | อยู่ตรงไหน | point / link code |
|---|---|---|
| Polygon อิสระ (ตัวหลัก) + **Fillet ที่มุมบนขวาของ shape** (รัศมี `FilletR`) | ตัวหลักติด origin | `Top`, `Side`, `Datum`, shape `Body` · จุด `Toe`, `Base` |
| **Arc 3 จุด** เหนือผิวบน (จุดที่โค้งผ่าน = auxiliary) | บน `Top` | link `Crown` |
| **Arc รัศมี** ท้ายลาด (รัศมี `DitchR`) | ต่อจาก `Toe` | link `Ditch` · จุด `DitchOut` |
| **5 เหลี่ยมด้านเท่า** (R = `PolyR`, θ = `PolyTheta`, ศูนย์กลาง = auxiliary) | ซ้ายล่างของตัวหลัก | link / shape `Pentagon` |
| **กลุ่มหมุน** บล็อก 4 เหลี่ยม หมุนรอบมุม `BlockA` ด้วยมุม `BlockAng` | ขวาของราง | `BlockA`–`BlockD`, link / shape `Block` |
| จุดจาก **Object snap tracking** (กึ่งกลางผิวบน แล้วลง 0.3 m — จุดอ้างอิงเป็น auxiliary) | ใต้ผิวบน | จุด `TrackMark` |
| **Auxiliary link เส้นตรง**: เส้นทแยง 2 เส้นของตัวหลัก → จุดจริงที่จุดตัด + link จริงจากจุดนั้น | กลางตัวหลัก | จุด `AuxCross`, `AuxCrossDown`, link `Stem` |
| **Auxiliary link โค้ง** (Arc 3 จุด ใต้ตัวหลัก) → จุดจริงอ้างจุดผ่านของโค้ง | ใต้ตัวหลัก | จุด `UnderArc` |

Parameter (Properties ของ subassembly ใน Civil 3D):

| ชื่อ | default | ใช้กับ |
|---|---|---|
| `Side` | 0 (Right) | 1 = Left ภาพกระจกทั้งตัว |
| `W` | 3 | ความกว้างบน (เส้นทแยง aux / `AuxCross` / `TrackMark` / โค้ง `Crown` ขยับตาม) |
| `D` | 1.5 | ความลึก |
| `FilletR` | 0.4 | รัศมี Fillet มุมบนขวา |
| `DitchR` | 1.2 | รัศมีราง |
| `PolyR`, `PolyTheta` | 0.5, 0 | รัศมี / มุมของ 5 เหลี่ยม |
| `BlockAng` | 15 | มุมหมุนบล็อก (องศา ทวนเข็ม + ฝั่ง Right) |

---

## 0. ก่อนเริ่ม

- ไม่ต้องมี target ใดๆ (subassembly นี้ไม่ใช้ surface) — corridor ที่มี alignment + profile อะไรก็ได้
- **build แบบเดียวกับไฟล์ .cs อื่นที่คุณ build ลง Civil 3D อยู่แล้ว** (เช่น `base_rock-pitching.cs`):
  1. คัดลอก `round3-demo.cs` เข้าโปรเจกต์ Visual Studio (class library) ตัวที่ใช้ build subassembly อยู่
  2. build → ได้ DLL
  3. เพิ่ม subassembly ใน .atc / tool palette ด้วย class `TestSubassembly.Round3Demo` (namespace / class อยู่ในไฟล์บรรทัด `namespace` / `public class`)
  4. ปิดเปิด Civil 3D (ถ้า DLL ถูกโหลดค้างอยู่) แล้ววาง subassembly ลงใน assembly
- ดูในเว็บก่อนก็ได้: คัดลอก `round3-demo.assembly.json` ไปไว้โฟลเดอร์เดียวกับ `run-viewer.bat` → เว็บ: **ไฟล์ ▾ → Open project**
  (เว็บเปิดได้เฉพาะไฟล์ในโฟลเดอร์นั้น · ปุ่ม **ดูแบบ Civil 3D** ที่แถบล่าง = หน้าตาที่ควรเห็นใน Civil 3D)

## 1. ใน assembly (หลังวางลงไป)

ค่า default, ฝั่ง Right — Civil 3D ควรได้ **117 points / 115 links / 3 shapes**
(จุด / link ส่วนใหญ่มาจากโค้งที่แบ่งเป็นท่อนละไม่เกิน 0.05 m · จำนวนเปลี่ยนตาม parameter: `W` = 4 → 137 / 135)

พิกัดเทียบจุดที่ subassembly เกาะ (offset, elevation):

| point code | default | W = 4 | D = 2 | Side = 1 |
|---|---|---|---|---|
| `Toe` | (5.250, -1.500) | (6.250, -1.500) | (6.000, -2.000) | (-5.250, -1.500) |
| `AuxCross` | (2.006, -0.573) | (2.545, -0.611) | (2.091, -0.697) | (-2.006, -0.573) |
| `AuxCrossDown` | (2.006, -0.973) | (2.545, -1.011) | (2.091, -1.097) | (-2.006, -0.973) |
| `UnderArc` | (2.625, -2.600) | (3.125, -2.600) | (3.000, -3.100) | (-2.625, -2.600) |
| `TrackMark` | (1.439, -0.300) | (1.939, -0.300) | (1.439, -0.300) | (-1.439, -0.300) |
| `BlockB` | (8.216, -1.241) | (9.216, -1.241) | (8.966, -1.741) | (-8.216, -1.241) |
| `BlockC` | (8.087, -0.758) | (9.087, -0.758) | (8.837, -1.258) | (-8.087, -0.758) |

## 2. Checklist

ติ๊กทีละข้อ แล้วส่งผล (รูป / ข้อความ error) กลับมาได้เลย

- [ ] **(1) โค้งเนียนพอ / จำนวน link ไม่หนักเกิน**
  - `Crown`, `Ditch`, Fillet มุมบนขวา และ 5 เหลี่ยม ดูเป็นโค้ง / รูปเรียบ ไม่เห็นเป็นเหลี่ยมใน section view ที่ซูมปกติ
  - corridor rebuild ไม่ช้าผิดปกติ (ถ้าหนักไป: ในเว็บเปลี่ยน "แบ่งโค้ง" ใน Properties ของ link โค้งเป็นท่อนยาวขึ้น / จำนวนท่อนน้อยลง แล้ว Save ใหม่)
- [ ] **(2) shape ปิดและลง hatch ได้**: `Body` (มี Fillet), `Pentagon`, `Block` ปิดรูป ลง hatch ตาม Code Set Style ได้ครบ 3 shape
- [ ] **(3) แก้ parameter ใน Properties แล้วรูปตาม**
  - `FilletR` = 0.8 → มุมบนขวามนขึ้น · `FilletR` = 5 (ใหญ่เกิน) → มุมแหลมเดิม + คำเตือนใน Event Viewer (ไม่ crash)
  - `PolyR` / `PolyTheta` = 0.8 / 36 → 5 เหลี่ยมใหญ่ขึ้นและหมุนไป
  - `BlockAng` = -30 → บล็อกหมุนลงรอบมุม `BlockA`
  - `DitchR` = 0.7 (น้อยกว่าครึ่งความกว้างราง) → รางเป็นเส้นตรง + คำเตือน (ไม่ crash)
  - `Side` = 1 → ทั้งตัวเป็นภาพกระจก (โค้ง / มุมหมุนกลับด้านถูก) — เทียบพิกัดกับตารางข้อ 1
- [ ] **(4) จุด auxiliary ไม่โผล่ใน Civil 3D**: ไม่มีจุดที่มุมแหลมเดิมของ Fillet (offset 3.0, 0.0), ไม่มีจุดศูนย์กลาง 5 เหลี่ยม,
  ไม่มีจุดผ่านของ `Crown` (ลอยเหนือผิวบน 0.35 m), ไม่มีจุดอ้างอิงกึ่งกลางผิวบน (เหนือ `TrackMark` 0.3 m)
- [ ] **(5) ไม่มี error ใน Event Viewer ของ corridor** (ค่า default ทั้งสองฝั่ง)
- [ ] **(6) ไม่เห็น auxiliary ใดๆ** ใน assembly / corridor / section view
  - ไม่มีเส้นทแยง 2 เส้นในตัวหลัก (code `AuxDiag`) และไม่มีโค้งใต้ตัวหลัก (เหนือ `UnderArc` 0.2 m)
  - code `AuxDiag` **ไม่โผล่** ในรายการ code ของ Code Set Style / Corridor Properties (Codes)
- [ ] **(7) แก้ parameter ที่ทำให้ auxiliary ขยับ แล้วจุดจริงที่อ้างอิงขยับตามถูก**
  - `W` = 4 → `AuxCross` / `AuxCrossDown` (จุดตัดของเส้นทแยง aux) และ `TrackMark` ย้ายไปตามตารางข้อ 1
  - `D` = 2 → `UnderArc` (อ้างจุดผ่านของโค้ง aux) ลงไปที่ elevation -3.100

## 3. ส่งผลกลับ

บอกข้อที่ไม่ผ่าน + รูป section view / ข้อความใน Event Viewer · ถ้า build ไม่ผ่าน ส่งข้อความ error ของ Visual Studio มาทั้งก้อน
