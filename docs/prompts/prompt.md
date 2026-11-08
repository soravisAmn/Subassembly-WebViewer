# งาน: เปลี่ยน Subassembly Viewer ให้เป็นโปรแกรม "วาด" subassembly แล้วได้ไฟล์ .cs

> วิธีใช้: เปิด Claude Code ในโฟลเดอร์ `D:\Yo\Subassembly-WebViewer` แล้วให้อ่านไฟล์นี้
> ("อ่าน prompt.md แล้วทำ Milestone 0") ทำทีละ milestone และหยุดให้ผู้ใช้ลองก่อนไป milestone ถัดไป

## 1. บริบท

ผู้ใช้เป็นวิศวกรโยธา (งานเขื่อนป้องกันตลิ่ง) เขียน custom subassembly ของ Civil 3D 2027 ด้วย C#
ปัญหาของ Subassembly Composer (SAC) คือต้องต่อ flowchart หรือเขียนโค้ดทีละส่วน ซึ่งยากและช้า

โปรเจกต์นี้ตอนนี้เป็น **viewer**: คอมไพล์ไฟล์ .cs จริงด้วย Roslyn กับตัวจำลอง Civil 3D API แล้ววาดผลบนเว็บ
เป้าหมายใหม่: เป็น **โปรแกรมวาด** แบบ CAD — ผู้ใช้วาดจุด/เส้น/รูป ใส่ parameter และเงื่อนไข
แล้วเว็บ **สร้างโค้ด C# ให้อัตโนมัติ** เป็นไฟล์ .cs ที่ build ลง Civil 3D ได้จริง

ผู้ใช้สื่อสารภาษาไทย ถนัด Python มากกว่า C# คอมเมนต์ในโค้ดและข้อความบน UI ให้เป็นภาษาไทยตามสไตล์เดิมของโปรเจกต์

## 2. โค้ดที่มีอยู่แล้ว (อ่านก่อนเริ่ม และห้ามทำของเดิมพัง)

| ไฟล์ | หน้าที่ |
|---|---|
| `SA.Civil3DShim/` | ตัวจำลอง Civil 3D API (`Autodesk.Civil.Runtime.CorridorState`, Points/Links/Shapes, `IntersectSurface`, `SampleSection`, `FindElevationAtXY`, `RunGuard` กันโค้ดค้าง) ชื่อและค่า enum ตรงกับ API Reference 2027 |
| `SA.Web/SubassemblyCompiler.cs` | คอมไพล์ .cs ด้วย Roslyn (cache ตามเนื้อหา) + `RunGuardRewriter` แทรกจุดตรวจเวลา/stack |
| `SA.Web/SubassemblyRunner.cs` | รัน GetLogicalNames → GetInputParameters → Draw แล้วเก็บ points/links/shapes/RecordError/Console |
| `SA.Web/AssemblyService.cs` | ประกอบหลาย subassembly: เกาะแกน assembly / เกาะจุดของตัวอื่นด้วย point code / ลอยอยู่ |
| `SA.Web/Program.cs` | API: `/api/run`, `/api/assembly`, `/api/files`, `/api/source`, `/api/save`, `/api/new`, `/api/assembly-file` |
| `SA.Web/SubassemblyTemplate.cs` | template ไฟล์ใหม่ (ดูรูปแบบโค้ดที่ผู้ใช้คุ้นเคย) |
| `SA.Web/wwwroot/index.html` | หน้าเว็บทั้งหมด (ไฟล์เดียว, vanilla JS + SVG): โหมดไฟล์เดียว, โหมด Assembly, แถบแก้โค้ด Monaco (บันทึกอัตโนมัติ, จัดการไฟล์ชนกัน), Scenarios |
| `test2.cs`, `base_rock-pitching.cs`, `body_rock-pitching.cs` | ไฟล์ subassembly จริงของผู้ใช้ ใช้ทดสอบ (ห้ามแก้ ยกเว้นผู้ใช้สั่ง) |
| `README.md` | คู่มือผู้ใช้ภาษาไทย อัปเดตทุกครั้งที่เพิ่มฟีเจอร์ |
| `link-API-Reference.txt` | ลิงก์ Civil 3D API Reference (civapidocs.com, หน้าเว็บโหลดเนื้อหาด้วย JS) |

กติกาที่ต้องรักษา:
- ไฟล์ทั้งหมดเป็น CRLF; ตอนเขียนไฟล์ของผู้ใช้ใช้ `WriteText` ใน Program.cs (คง BOM/บรรทัดเดิม, เขียนผ่านไฟล์ชั่วคราว)
- server เปิดเฉพาะ localhost (รันโค้ด C# บนเครื่องจริง)
- โหมดไฟล์เดียว, โหมด Assembly, แถบแก้โค้ด และ RunGuard ต้องทำงานเหมือนเดิมหลังแก้
- โค้ดที่ generate ต้องใช้เฉพาะ Civil 3D API ที่มีอยู่จริง: ใช้แบบเดียวกับไฟล์ของผู้ใช้ และตรวจกับ API Reference
  ถ้าต้องเพิ่มอะไรใน shim ให้ตรวจชื่อ/signature กับ API Reference ก่อน (ห้ามเดา) ถ้าตรวจไม่ได้ให้ถามผู้ใช้

## 3. หน้าจอใหม่ (5 ส่วน)

มี wireframe ที่ผู้ใช้ตกลงแล้ว (Claude artifact "SA Drawing Studio wireframe") สรุป:

1. **Workspace (กลางจอ)** พื้นมืดแบบ CAD มี grid, เส้น surface ที่ลากแก้ได้ (ของเดิม), แกน assembly
   มีได้หลาย assembly ใน workspace เดียว ตอน Edit subassembly ตัวไหน ตัวอื่นจางลงและแก้ไม่ได้
   มีแถบบอกด้านบน "กำลังแก้ X" + ปุ่ม Save (.cs) / ออกจาก Edit
2. **แถบซ้าย** ต้นไม้ Workspace → Assembly → Subassembly → Points / Links / Shapes / Parameters
   - คลิก object = เลือก (เน้นบนรูป + แสดงใน Properties)
   - คลิกขวา subassembly: **Edit**, Rename, Save เป็น .cs, Mirror, เอาออกจาก assembly (ระยะสอง: เพิ่มเข้า "รูปทรงของฉัน")
   - คลิกขวา assembly: **ADD** = สร้าง subassembly ใหม่ (ว่าง) แล้วเข้า Edit ทันที
3. **เมนูบาร์** ไฟล์ ▾ (Import .cs, Open project, Save project, Save / Export .cs…), ✎ แก้โค้ด (แถบเดิม)
4. **แถบขวา** แบ่ง 2 ส่วน
   - **Drawer (Toolbox):** ปุ่มมี **ไอคอนสัญลักษณ์ + ชื่อ** (เช่น Point = จุดมีกากบาท, Link = เส้นมีจุดสองปลาย,
     ลาดจนชนดิน = เส้นประลงไปชนเส้นดิน) แบ่งกลุ่ม Geometry / Surface / Logic / รูปทรงของฉัน
   - **Properties:** ค่าของ object ที่เลือก ทุกช่องตัวเลขรับ "นิพจน์" ได้ (ดูข้อ 5) + ตาราง Parameter แบบ SAC (ชื่อ, ชนิด, default, display name, ขอบเขตค่า)
5. **แถบล่าง (แบบแถบสถานะ AutoCAD)** พิกัดเมาส์ (offset จาก origin / ระดับ), Grid, Snap, Ortho (F8),
   slope สำเร็จรูป (1:1.5, 1:2, 1:3 แก้ได้), OSNAP: Endpoint, Midpoint, Intersection, **Surface** (snap ติดเส้นดิน), Perpendicular, Nearest

หน้าต่าง **Save / Export .cs**: รายการต้นไม้มี checkbox เลือกเฉพาะ subassembly ที่จะเขียนเป็นไฟล์ (1 subassembly = 1 ไฟล์),
บอกสถานะ (มีการแก้ยังไม่ save / ไม่เปลี่ยน / สร้างใหม่), ถ้าชื่อซ้ำให้ถามก่อนเขียนทับ, ติ๊กบันทึก project ไปพร้อมกันได้

## 4. การวาดแบบ CAD

- ลากเส้นแล้ว **จุดปลายเกิดเอง**; ถ้าคลิกชนจุดที่มีอยู่ (snap) ใช้จุดเดิม; คลิกต่อไปเรื่อยๆ = polyline; คลิกขวา/Enter = จบ; Esc = ยกเลิก
- ระหว่างลาก แสดง tooltip: slope (1:x และ %), ความยาว, dx/dy; กด Tab เพื่อพิมพ์ค่าหรือชื่อ parameter แทนการคลิก
- Ortho ล็อกแนวราบ/ดิ่ง; slope สำเร็จรูปล็อกมุม
- Undo/Redo (Ctrl+Z / Ctrl+Y) ใน Edit mode
- ทุก object ที่วาดเก็บ "ความหมาย" ไม่ใช่แค่พิกัด เช่น จุดที่วาดด้วย slope 1:2 ยาว Width ต้องเก็บเป็น `{from: P2, slope: "-1/2", length: "Width"}`
  เพื่อให้เปลี่ยน parameter หรือเส้น surface แล้วรูปเปลี่ยนตาม (นี่คือหัวใจของโปรแกรม)

## 5. Data model

### DrawingSpec (ของ subassembly หนึ่งตัว) — JSON
```jsonc
{
  "version": 1,
  "className": "LeveeCrest", "namespace": "SAGenerated",
  "params": [ { "name": "Width", "kind": "double", "default": 3.0, "displayName": "ความกว้างสัน", "min": 0.5, "max": null } ],
  "targets": [ { "name": "TargetSurface", "type": "Surface", "displayName": "Target Surface" } ],
  "points": [
    { "id": "P1", "codes": ["Crown"], "def": { "type": "origin" } },
    { "id": "P2", "codes": ["EdgeTop"], "def": { "type": "delta", "from": "P1", "dx": "Width", "dy": "0" } },
    { "id": "P3", "codes": [], "def": { "type": "slopeLength", "from": "P2", "slope": "-1/SideSlope", "length": "3" } },
    { "id": "P4", "codes": ["Daylight"], "def": { "type": "slopeToSurface", "from": "P3", "slope": "-1/SideSlope", "target": "TargetSurface", "maxDistance": "50" } },
    { "id": "P5", "codes": [], "def": { "type": "external", "code": "TrapTopOutside" } }   // จุดจากโค้ดเดิมของผู้ใช้ (ข้อ 6)
  ],
  "links": [
    { "id": "L1", "points": ["P1", "P2"], "codes": ["Top"] },
    { "id": "L2", "type": "followSurface", "from": "P4", "to": "P6", "target": "TargetSurface", "codes": ["Datum"] }
  ],
  "shapes": [ { "id": "S1", "links": ["L1", "L2", "L3"], "codes": ["Fill"] } ],
  "side": { "param": "Side", "mirror": true }     // ฝั่งซ้าย = กลับเครื่องหมาย offset ทั้งหมด
}
```
- ค่าที่เป็นตัวเลขทั้งหมดเป็น **นิพจน์ (string)**: ตัวเลข, ชื่อ parameter, `+ - * / ( )` และฟังก์ชันไม่กี่ตัว (`min`, `max`, `abs`)
  ตรวจตอนพิมพ์ (ชื่อไม่มีอยู่จริง/วงเล็บไม่ครบ = ขึ้นแดง) และแปลงเป็น C# ตรงๆ
- slope ใช้ระบบเดียวทั้งโปรแกรม: dy/dx (ลง = ลบ); UI แสดงเป็น 1:x ให้ด้วย
- point def ชุดแรก: `origin`, `delta` (dx, dy จากจุด), `slopeLength`, `slopeToSurface` (daylight), `onSurface` (ที่ offset ที่กำหนด), `external`
- link ชุดแรก: เส้นตรงระหว่างจุด, `followSurface` (วิ่งตามผิวดินระหว่างสองจุด ได้จุดกลางหลายจุด)

### Workspace project (`ชื่อ.saproj` ในโฟลเดอร์) — JSON
assemblies (แกน, รายการ subassembly + parameter + จุดเกาะ แบบที่ `AssemblyService` ใช้อยู่), เส้น surface, ค่าตั้งของแถบล่าง
subassembly อ้างไฟล์ .cs ด้วยชื่อไฟล์ ไม่ copy โค้ดเข้ามา (ไฟล์ .cs คือของจริง)
ระยะแรกทำ Save/Open project แบบพื้นฐาน (ต่อยอดจาก `.assembly.json` ที่มีอยู่ ให้เปิดไฟล์เก่าได้)

## 6. การสร้างโค้ด (หัวใจ) — ใช้ "แบบ ข"

ไฟล์ .cs มี 2 ชนิด:
- **สร้างในเว็บ** (ADD): ทั้งไฟล์ generate จาก spec
- **เขียนเองแล้ว Import** (เช่น `test2.cs`): ผู้ใช้วาด "เพิ่ม" ต่อได้ ส่วนที่วาดเพิ่มถูกเขียนลงไฟล์ **ในช่วงที่มีป้ายกำกับเท่านั้น**
  ห้ามแตะโค้ดของผู้ใช้นอกป้าย ต้อง save ได้และ build ใน Civil 3D ได้

รูปแบบในไฟล์ (ทั้งสองชนิดใช้ป้ายเดียวกัน จึงเปิดกลับมาแก้ด้วยการวาดได้เสมอ):
```csharp
// ===== SA-DRAWING BEGIN (สร้างโดย SA Drawing Studio — แก้ด้วยการวาดในเว็บ อย่าแก้ช่วงนี้ด้วยมือ) =====
// sa-spec: {...DrawingSpec เป็น JSON บรรทัดเดียว (หรือ base64 ถ้ามีอักขระที่ทำให้คอมเมนต์พัง)...}
internal static class SaDrawing_<ClassName>
{
    internal static void Draw(CorridorState cs, ...) { ...โค้ดที่ generate... }
}
// ===== SA-DRAWING END =====
```
และบรรทัดเรียกใน method วาดของผู้ใช้ หนึ่งบรรทัด มีป้ายกำกับ:
```csharp
SaDrawing_<ClassName>.Draw(corridorState); // SA-DRAWING CALL
```
- หาจุดที่จะแทรกบรรทัดเรียกด้วย Roslyn syntax tree (method `Draw`/`DrawImplement`/ที่ผู้ใช้เลือก; ท้าย try-block ก่อน catch) ถ้าหาไม่ได้แน่ชัด **ให้ถามผู้ใช้/ให้ผู้ใช้เลือกบรรทัด** ห้ามเดา
- parameter ใหม่ที่วาดเพิ่ม ต้องถูกเพิ่มใน `GetInputParameters` ด้วย: แทรกเป็นบรรทัดมีป้าย `// SA-DRAWING PARAM` เช่นกัน
- จุด `external` (จุดจากโค้ดเดิม) หาตอนรันด้วย point code จาก `cs.Points`; ไม่เจอ = `RecordError(... AsWarning ...)` แล้วข้ามส่วนที่พึ่งจุดนั้น
- ทำซ้ำได้ (idempotent): save ซ้ำแทนที่ช่วงเดิมทั้งหมด ไม่ทับซ้อน; diff ไฟล์ก่อน/หลังต้องเปลี่ยนเฉพาะช่วงมีป้าย
- ตอนเปิดไฟล์: อ่าน `sa-spec` กลับมาเป็น object ที่แก้ได้; ถ้าผู้ใช้แก้โค้ดในช่วงป้ายด้วยมือ (spec กับโค้ดไม่ตรง) ให้เตือน และให้เลือกว่าจะ generate ทับหรือไม่
- รูปแบบโค้ดที่ generate: อ่านง่ายแบบไฟล์ของผู้ใช้ (`GetLogicalNames/GetInputParameters/GetOutputParameters/Draw`, `RecordError`/`RecordWarning`,
  ตรวจขอบเขต parameter แล้วใช้ค่าขอบแทน + warning แบบที่ `test.cs` เดิมทำกับ Depth < 2), คอมเมนต์ภาษาไทยบอกว่าบรรทัดไหนมาจาก object ไหน (เช่น `// P4 ลาดจนชนดิน`)
- Layout mode / ไม่มี surface: ส่วนที่ต้องใช้ surface ให้วาดแบบไม่มีดิน (เหมือน `test.cs` เดิม) ไม่ throw
- generate อัตโนมัติทุกครั้งที่แก้ (preview ทันทีด้วยการคอมไพล์ในหน่วยความจำ) แต่ **เขียนลงไฟล์เมื่อกด Save** เท่านั้น
- เปิดแถบโค้ดดูโค้ดที่ generate ได้ (read-only ในช่วงป้าย)

## 7. ขอบเขต

### ระยะแรก (ทำตอนนี้)
- 5 ส่วนของหน้าจอ + Edit mode + Export dialog
- Drawer: Point, Link (polyline), Shape, ลาดจนชนดิน, วิ่งตามผิวดิน, ตัดที่ระดับ (ถ้าเวลาพอ)
- Parameter table + ขอบเขตค่า + นิพจน์ในทุกช่อง
- Snap: Endpoint, Intersection, Surface, Nearest + Ortho + slope สำเร็จรูป + พิมพ์ค่า
- สร้างโค้ดแบบ ข ทั้งไฟล์ใหม่และไฟล์ import + เปิดกลับมาแก้ได้
- Save/Open project พื้นฐาน

### ระยะสอง (ยังไม่ทำ แต่ออกแบบ data model ให้ต่อได้)
- **เงื่อนไข** (ถ้าตัด/ถม, ถ้าค่า > ...) แบบแยกเป็นสองทาง เห็นทั้งสองทางบนจอ — ผู้ใช้อยากให้สุดท้ายแก้ "ทุกอย่าง" ในไฟล์ได้ด้วยปุ่ม
  รวมถึงบล็อกพิเศษแบบ if/loop สำหรับรองรับโค้ดของผู้ใช้ — ออกแบบ spec ให้ point/link มี "เงื่อนไขการเกิด" ได้ในอนาคต
- "รูปทรงของฉัน": คลิกขวา subassembly → บันทึกเป็นตัวต่อ ใช้ซ้ำข้าม project (ปรับ parameter ตอนวาง)
- `.saproj` เต็มรูปแบบ, Marked point, ส่ง output parameter ข้าม subassembly, offset/elevation target

## 8. Milestones (หยุดให้ผู้ใช้ลองทุก milestone)

0. อ่านโค้ดทั้งหมด สรุปแผนสั้นๆ + คำถามที่ยังไม่ชัด (ข้อ 10) ให้ผู้ใช้ตอบก่อนเขียนโค้ด
1. Layout 5 ส่วน (ย้ายของเดิมเข้าที่: surface tools, Messages/Log/Points ไปอยู่ส่วนที่เหมาะ) + ต้นไม้ซ้าย + คลิกขวา + แถบล่าง (ยังไม่วาด)
2. DrawingSpec + evaluator ฝั่ง JS (คำนวณพิกัดจาก spec + surface ได้ทันทีตอนลาก) + เครื่องมือ Point/Link/Shape + snap + Properties
3. Code generator (ไฟล์ใหม่) + preview ด้วย Roslyn + Save .cs → **ทดสอบ: ผลจาก evaluator JS ต้องตรงกับผลรันโค้ดที่ generate** (unit test หลายกรณี รวม Side=Left)
4. ลาดจนชนดิน / วิ่งตามผิวดิน / external point + แบบ ข กับไฟล์ import (ทดสอบกับ `test2.cs` และ `base_rock-pitching.cs`: ไฟล์ต้องคอมไพล์ผ่าน, ส่วนนอกป้ายไม่เปลี่ยนแม้แต่ไบต์เดียว, save ซ้ำได้ผลเดิม)
5. Export dialog + Save/Open project + อัปเดต README

## 9. การทดสอบและการส่งงาน
- `dotnet build` ทั้ง solution ผ่าน; ถ้ามี SA.Tests ให้เพิ่ม test ของ generator/ตัวแทรกโค้ด
- ทดสอบใน browser จริง (ถ้ามี Playwright ใช้ได้) ทั้งโหมดเดิมและของใหม่
- ห้ามแก้ไฟล์ .cs ของผู้ใช้ระหว่างทดสอบ ให้ copy ไปทดสอบในโฟลเดอร์ชั่วคราว
- ห้าม commit/push เองจนกว่าผู้ใช้อนุญาต; บอกผู้ใช้ทุกครั้งว่าต้องปิดแล้วเปิด `run-viewer.bat` ใหม่หรือไม่
- รายงานแต่ละ milestone เป็นภาษาไทย สั้นๆ: ทำอะไรไป, ลองยังไง, อะไรยังไม่ได้

## 10. คำถามที่ยังเปิดอยู่ (ถามผู้ใช้ใน Milestone 0)
- นิพจน์ต้องรองรับมากแค่ไหน (เช่น `tan`, `sqrt`)?
- ชื่อ namespace/class ของไฟล์ที่สร้างใหม่ตั้งจากอะไร (ชื่อไฟล์? ให้ผู้ใช้กรอก?)
- ไฟล์ import ที่มีหลาย class หรือไม่มี method `Draw` ชัดเจน จะให้วาดเพิ่มที่ไหน
- ไอคอนของปุ่มใน Drawer: ใช้ตามที่เห็นใน wireframe หรือผู้ใช้มีแบบในใจ

### คำตอบ (Milestone 0, 2026-10-28)
- นิพจน์: แบบเต็ม `+ - * / ( )`, `min`, `max`, `abs`, `sqrt`, `pow` + ตรีโกณ `sin cos tan atan` (หน่วยองศา)
- ชื่อไฟล์ใหม่: ผู้ใช้กรอกตอน ADD → แปลงเป็นชื่อ class แบบ template เดิม (แก้ได้ใน Properties); namespace = `TestSubassembly`
- ไฟล์ import: หลาย class = เลือกจาก dropdown; ปกติแทรกบรรทัด CALL ท้าย try ใน `Draw()`; ถ้าโครงไม่ตรงแบบนี้ เปิดแถบโค้ดให้ผู้ใช้คลิกเลือกบรรทัด
- โหมดไฟล์เดียว: **รวมเข้า workspace** (ไม่มีโหมดแยก; เปิดไฟล์เดียว = assembly ที่มี subassembly ตัวเดียว)
  ฟีเจอร์ของโหมดเดิม (Parameters, Messages, Log, Points, Origin elevation, Scenarios, ✎ แก้โค้ด) ต้องยังใช้ได้ใน workspace
- ไอคอน Drawer: วาด SVG ตามคำอธิบายข้อ 3.4 ไปก่อน ปรับได้ใน Milestone 1
- ตัดสินใจเพิ่มเติม: แยก JS ของ index.html เป็นหลายไฟล์ใน `wwwroot/js/` (vanilla, ไม่ต้อง build);
  generator เขียนเลขเป็น double (`1.0`) กันหารจำนวนเต็ม; ใช้ชื่อเต็ม `Autodesk.Civil.Runtime.*` กันชนกับ using ของผู้ใช้;
  ไฟล์ import ที่มี parameter/target ชื่อเดียวกันอยู่แล้ว ใช้ของเดิม ไม่ Add ซ้ำ;
  ลาดจนชนดินใน Layout mode ยาวคงที่ (default 3 m แก้ได้); ทดสอบ browser ผ่าน browser pane ของแอป (ยังไม่มี Playwright)

### บันทึกจาก Milestone 2 (สิ่งที่ Milestone 3–4 ต้องรู้)
- โค้ดฝั่งเว็บ: `wwwroot/js/expr.js` (นิพจน์ → AST, ใช้ทำ C# ต่อได้), `spec.js` (DrawingSpec + evaluator), `draw.js` (เครื่องมือ/snap/undo)
  ทดสอบ: `node SA.Tests/js/evaluator.test.js` (expr.js / spec.js ไม่ใช้ DOM จึงโหลดใน node ได้)
- spec เก็บใน `item.spec` ของ workspace (และใน project); ตัวที่ ADD ในเว็บมี `item.fileName` แต่ยังไม่มีไฟล์
- สิ่งที่เพิ่มจาก data model ข้อ 5 (generator ต้องรองรับ):
  - `slopeLength` มี `dir` (1 = ออกนอก, -1 = เข้าใน) และ `measure` (`along` ตามแนวลาด / `dx` ระยะราบ / `dy` ระยะดิ่ง)
  - `slopeToSurface` มี `dir`, `maxDistance` (ระยะราบ; ไม่ชน = หยุดที่ระยะนี้ + warning), `layoutLength` (Layout / ไม่มีดิน = ยาวคงที่ระยะราบ)
  - ชนิดจุดใหม่: `between` {a, b, t} (Midpoint / Nearest / Perpendicular snap), `intersect` {a1, a2, b1, b2} (Intersection snap)
  - `from` ไม่ระบุ = origin; slope = dy / ระยะราบที่เดินไปทาง dir (แบบเดียวกับ IntersectSurface)
  - Side: ค่าแนวราบทั้งหมดคูณ F (-1 เมื่อ `side.param` = 1) — ทิศจริงของลาด = F × dir
  - parameter มี min / max เป็นตัวเลข (หรือ null); นอกขอบเขต = ใช้ค่าขอบ + warning ข้อความ `ชื่อ = ค่า < min, ใช้ min แทน`
  - spec ของไฟล์ import: `imported: true`, `params` เฉพาะที่เพิ่มใหม่, `side` อ้าง Side ของไฟล์เดิม
- evaluator คำนวณผิวดินแบบเดียวกับ `SimWorld` (ElevationAtOffset / Intersect / SampleSection) — test ใน Milestone 3 เทียบกับผลรันโค้ด C# ได้ตรงๆ

### บันทึกจาก Milestone 3 (สิ่งที่ Milestone 4 ต้องรู้)
- โค้ด: `SA.Web/Drawing/` — `SpecExpr.cs` (นิพจน์ → C#), `DrawingSpec.cs`, `CodeGenerator.cs` (GenerateFile / GenerateBlock / FindBlock / ReplaceBlock / BlockMatchesSpec / MissingCalls)
  API: `/api/drawing/code` (ดูโค้ด), `/api/drawing/save`, `/api/drawing/spec` (อ่าน sa-spec กลับ); `/api/assembly` รับ `spec` + `fileName` ต่อ item แล้วสร้าง/แทนที่ช่วงก่อนรัน (`generated: true`)
- บรรทัดเรียกในไฟล์มี 3 แบบ บรรทัดละ 1 ป้าย: `SaDrawing_X.AddTargets(corridorState); // SA-DRAWING TARGET` (GetLogicalNames),
  `SaDrawing_X.AddParams(corridorState); // SA-DRAWING PARAM` (GetInputParameters), `SaDrawing_X.Draw(corridorState); // SA-DRAWING CALL` (Draw)
  → parameter ใหม่ทั้งหมดอยู่ใน AddParams ในช่วงมีป้าย (Milestone 4 แทรกแค่บรรทัดเดียวต่อเมธอด)
- โค้ดเพิ่มจุดลง cs.Points ตามลำดับใน spec (เฉพาะที่หาได้) แล้วตามด้วยจุดกลางของ link ที่วิ่งตามผิวดิน — เว็บใช้ลำดับนี้เทียบ JS กับ C# (`csharpMismatch` ใน draw.js)
- ตรวจกับ API Reference 2027 แล้ว: `Point / PointCollection / CodeCollection` อยู่ใน `Autodesk.Civil.DatabaseServices` (ตัวจำลองวางไว้ใน Runtime — ใช้ได้เพราะไฟล์ using ทั้งสอง namespace),
  `CodeCollection` มี Count / Item / Add / TryAdd / Remove / IEnumerable<string> แต่ **ไม่มี Contains** (external point ใน M4 ต้องวน foreach),
  `PointCollection` เป็น IEnumerable<Point>, `ParamDouble.DisplayName` มีจริง
- external point ยังสร้างโค้ดไม่ได้ (generator โยน error) — M4; ไฟล์ import ที่ยังไม่มีช่วงป้าย Save ไม่ได้ (MissingCalls) — M4 แทรกด้วย Roslyn
- ทดสอบ: `dotnet run --project SA.Tests` (DrawingTests.cs เรียก `node SA.Tests/js/eval-cli.js` แล้วเทียบกับผลรันโค้ดที่สร้าง; กรณีใน `SA.Tests/js/drawing-cases.json`)
