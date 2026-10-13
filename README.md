# Subassembly Viewer

เว็บสำหรับดูรูปร่าง subassembly จากไฟล์ .cs ตัวจริง (ไฟล์เดียวกับที่ build ลง Civil 3D)
โดยไม่ต้องเปิด Civil 3D: วางไฟล์ .cs แล้วเว็บจะคอมไพล์ รัน และวาดให้ทันที
แก้โค้ดแล้วกด Save เว็บจะวาดใหม่เองภายใน 1–2 วินาที

## เปิดเว็บ

ดับเบิลคลิก `run-viewer.bat` (หรือพิมพ์ `dotnet watch --project SA.Web`)
แล้วเปิด http://localhost:5050 ถ้าเบราว์เซอร์ไม่เปิดเอง

- ครั้งแรกจะช้าหน่อย เพราะต้องดาวน์โหลด Roslyn (ตัวคอมไพล์ C#) จาก NuGet
- อย่าปิดหน้าต่างดำระหว่างใช้งาน กด Ctrl+C เพื่อปิด

## เลือกไฟล์ .cs

- **วางไฟล์ไว้ในโฟลเดอร์นี้** (`webapp_show_SA\`) แล้วเลือกจาก dropdown ด้านบน
  เว็บอ่านเฉพาะไฟล์ .cs ที่อยู่ชั้นบนสุดของโฟลเดอร์ (ไม่อ่านโฟลเดอร์ย่อย)
  อยากใช้โฟลเดอร์อื่น: แก้ `"SubassemblyFolder"` ใน `SA.Web\appsettings.json`
- **ปุ่ม Open .cs…** เปิดไฟล์จากที่ไหนก็ได้
  ถ้าใช้ Chrome หรือ Edge เว็บจะติดตามการ Save ไฟล์นั้นให้ด้วย
  (ต้องเปิดใหม่หลังรีเฟรชหน้าเว็บ)

ไฟล์ .cs ต้องมี public class ที่มีเมธอด `public void Draw()` (แบบเดียวกับที่ .atc เรียก)
ถ้ามีหลาย class ในไฟล์เดียว จะมี dropdown ให้เลือก class

## เว็บทำอะไรกับไฟล์ .cs

เรียกตามลำดับเดียวกับ Civil 3D:

1. `GetLogicalNames()` → target ที่ประกาศไว้ (Target Surface ฯลฯ) จะแสดงในส่วน Corridor
2. `GetInputParameters()` → สร้างช่องกรอก parameter ให้อัตโนมัติ (long / double / string / bool)
   ช่องที่แก้จากค่า default จะเป็นสีฟ้า; parameter ชื่อ `Side` จะเป็น dropdown Right/Left
3. นำค่าที่กรอก + surface ที่ลากในเว็บไปใส่ แล้วเรียก `Draw()`
4. วาด points / links / shapes พร้อม code และแสดงสิ่งที่ `RecordError` บันทึกไว้

**Debug ได้ด้วย `Console.WriteLine(...)`**: ข้อความจะขึ้นในช่อง Log ของเว็บ
(ใน Civil 3D จะไม่แสดงอะไร จึงทิ้งไว้ในโค้ดได้)

ถ้าโค้ดโยน exception ออกมาโดยไม่ได้ catch เว็บจะแสดงกรอบแดงพร้อมเลขบรรทัด

## เส้น surface

- ลากจุด = ขึ้น-ลง · Shift+ลาก = เลื่อนแนวราบด้วย
- ลากที่ตัวเส้น = เลื่อน surface ทั้งเส้น (แบบ SAC)
- ดับเบิลคลิกที่เส้น หรือกด `A` แล้วคลิกบนเส้น = แทรกจุด
- คลิกขวาที่จุด หรือ `Delete` = ลบจุด · `F` = Fit · ล้อเมาส์ = zoom · ลากพื้นหลัง = pan
- ติ๊ก "กำหนด surface ของเว็บให้ Target Surface" ออก = จำลองกรณีไม่ได้กำหนด target
- "ต่อปลายเส้นออกไปแนวราบ" (เปิดไว้เป็นค่าเริ่มต้น) = surface กว้างไม่จำกัด เหมือน TIN จริงที่ใหญ่กว่า section
  ปิดเมื่ออยากทดสอบกรณีโค้ดถามระดับนอกขอบเขต surface (จะได้ PointNotOnEntityException)
- Mode = Layout จำลอง Layout mode ของ Civil 3D

## ระบบพิกัดจำลอง

- จุดที่โค้ดสร้างด้วย `Points.Add(offset, elevation, ...)` เป็นค่าเทียบ origin (แบบเดียวกับ Civil 3D)
- ส่วน `IntersectSurface`, `SampleSection`, `FindElevationAtXY`, `CurrentElevation` ใช้ค่าจริง (absolute)
  โดย origin อยู่ที่ offset 0 และระดับ = **Origin elevation** (ค่าเริ่มต้น 100)
  ถ้าโค้ดลืมแปลงระหว่างค่าจริงกับค่าเทียบ origin รูปจะเพี้ยนไป ~100 m ซึ่งช่วยจับ bug ได้
- alignment จำลองเป็นเส้นตรง: `PointLocation(station, offset)` ให้ X = offset, Y = station

## ตัวจำลอง Civil 3D API (SA.Civil3DShim)

มีเฉพาะส่วนที่ subassembly ใช้กันบ่อย:

| namespace | สิ่งที่มี |
|---|---|
| `Autodesk.Civil.Runtime` | `CorridorState` (ParamsLong/Double/String/Bool/Surface/Alignment/Profile, Points, Links, Shapes, Mode, Current*, RecordError, IntersectSurface, SampleSection), `Point`, `Link`, `Shape`, `CodeCollection`, `PointInMem`, `IPoint`, `SampledSectionLink` |
| `Autodesk.Civil` | `CorridorMode`, `CorridorError`, `CorridorErrorLevel`, `ParamLogicalNameType`, `PointNotOnEntityException` |
| `Autodesk.Civil.ApplicationServices` | `CivilApplication.ActiveDocument.CorridorState` |
| `Autodesk.Civil.DatabaseServices` | `Surface`/`TinSurface.FindElevationAtXY`, `Alignment.PointLocation/StationOffset` |
| `Autodesk.AutoCAD.DatabaseServices` | `ObjectId`, `OpenMode`, `Transaction`, `TransactionManager.GetObject`, `HostApplicationServices.WorkingDatabase` |
| `Autodesk.AutoCAD.Geometry` | `Point2d`, `Point3d` |

ถ้าไฟล์ .cs เรียก API ที่ยังไม่มี เว็บจะขึ้น compile error เช่น
`'CorridorState' does not contain a definition for 'XYZ'` → เพิ่มเข้าไปในไฟล์ของ `SA.Civil3DShim`
(dotnet watch จะ restart ให้เอง) หรือส่งชื่อฟังก์ชันให้ Claude เพิ่ม

ยังไม่รองรับ: offset/elevation target, หลาย surface พร้อมกัน, superelevation, profile จริง

## ข้อควรรู้

- ตัวจำลองเขียนขึ้นให้ชื่อและการทำงานใกล้เคียงของจริงที่สุด แต่**ไม่ใช่ Civil 3D จริง**
  เช่น ถ้า `IntersectSurface` หาจุดตัดไม่เจอ ตัวจำลองจะโยน exception (ของจริงอาจทำต่างออกไป)
  ผลสุดท้ายยังควรเช็คใน Civil 3D อีกครั้ง
- กรณีที่บันทึกไว้ใน Scenarios เก็บอยู่ในเบราว์เซอร์ ใช้ Export สำรองเป็นไฟล์ JSON ได้
- โฟลเดอร์ `SA.Core`, `SA.Civil3D`, `SA.Tests` มาจากแนวทางแรก (แยก logic ของ Trapezoid ออกมา)
  เว็บไม่ได้ใช้แล้ว ลบทิ้งได้ถ้าไม่ต้องการ
