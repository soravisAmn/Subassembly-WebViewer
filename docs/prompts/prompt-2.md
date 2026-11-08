# งานรอบ 2: Move / Copy / Undo, คลุมเลือก + วาง, คลิก object แล้วเห็นบรรทัดโค้ด, แก้ snap

> วิธีใช้: เปิด Claude Code ในโฟลเดอร์ `D:\test_cad\Subassembly-WebViewer` แล้วสั่ง "อ่าน prompt-2.md แล้วทำ Milestone 0"
> ทำทีละ milestone หยุดให้ผู้ใช้ลองทุกครั้ง รายงานเป็นภาษาไทยสั้นๆ (ทำอะไร / ลองยังไง / อะไรยังไม่ได้)

## 0. บริบท

โปรเจกต์นี้คือ SA Drawing Studio: วาด subassembly ของ Civil 3D แบบ CAD แล้วได้ไฟล์ .cs (ดู `prompt.md` รอบแรก และ `README.md`)
ผู้ใช้ย้ายมาเครื่องที่บ้าน ดึงจาก GitHub แล้ว (commit ล่าสุด `web-drawer beginning`) — ตรวจ `git status` ก่อนเริ่ม ถ้ามีไฟล์ค้างแก้อยู่ให้บอกผู้ใช้

ผู้ใช้คุ้นกับ AutoCAD / Civil 3D มาก — พฤติกรรมของทุกฟีเจอร์ในรอบนี้ **ให้เหมือน AutoCAD ที่สุดเท่าที่ทำได้** ถ้าต้องต่างจาก AutoCAD ให้บอกเหตุผลใน README

โครงหน้าเว็บตอนนี้ (อ่านก่อนแก้):
| ไฟล์ | หน้าที่ |
|---|---|
| `SA.Web/wwwroot/js/core.js` | state กลาง, `state.bar` (grid/snap/ortho/slopes/osnap), ฟังก์ชันพิกัด `sx/sy/wx/wy`, `snapV` |
| `SA.Web/wwwroot/js/workspace.js` | วาด workspace, pointer events (`pointerdown` ~บรรทัด 365, `endDrag`), ลากจุด surface, ลาก/เกาะ subassembly, pan, `fit` |
| `SA.Web/wwwroot/js/draw.js` | Edit mode: เครื่องมือ Point/Link/Shape/ลาดจนชนดิน/วิ่งตามผิวดิน, `snapAt()`, `freePoint()`, พิมพ์ค่า (Tab), `undoStack/redoStack`, `commitPoint` |
| `SA.Web/wwwroot/js/spec.js` | DrawingSpec: evaluate, addPoint/addLink, ตัวช่วยเรขาคณิต (`lineX`, `projectSeg`, `makeGround`) |
| `SA.Web/wwwroot/js/expr.js` | นิพจน์ในช่องตัวเลข |
| `SA.Web/wwwroot/js/ui.js` | ต้นไม้ซ้าย, คลิกขวา, Properties, แถบล่าง (`renderBar`, click handler `#bar`), เมนูไฟล์, dialog, project, scenarios |
| `SA.Web/wwwroot/js/editor.js` | แถบแก้โค้ด (Monaco / textarea สำรอง, `E.goto(line)`) |
| `SA.Web/wwwroot/js/main.js` | keyboard shortcuts (`keydown` ~บรรทัด 38), เริ่มต้นแอป |
| `SA.Web/Drawing/CodeGenerator.cs` | สร้าง C# จาก spec (ช่วง `SA-DRAWING BEGIN/END`, บรรทัด `SA-DRAWING CALL/PARAM/TARGET`) |
| `SA.Civil3DShim/Runtime.cs` | `PointCollection.Add` / `LinkCollection.Add` / `ShapeCollection.Add` ของตัวจำลอง |
| `SA.Web/SubassemblyCompiler.cs`, `RunGuardRewriter.cs` | คอมไพล์ + PDB (เลขบรรทัดของไฟล์จริงไม่เลื่อนแม้มีการแทรกจุดตรวจ) |

Shortcut ที่มีอยู่แล้ว ห้ามชนโดยไม่ตั้งใจ: `P` `L` `S` (เครื่องมือ), `A` (Add point บน surface), `F` (Fit), `F8` (Ortho), `Tab` (พิมพ์ค่า), `Enter` (จบเส้น), `Esc`, `Ctrl+Z/Y` (undo ใน Edit mode), `Ctrl+E` (แถบโค้ด), `Ctrl+S` (save)
ทุก shortcut ต้องไม่ทำงานตอนโฟกัสอยู่ใน input / select / แถบโค้ด / dialog (ตามแบบที่ main.js ทำอยู่)

กติกาเดิมยังใช้ทั้งหมด: CRLF, ข้อความ UI และคอมเมนต์ภาษาไทย, localhost เท่านั้น, ห้ามทำโหมด/ฟีเจอร์เดิมพัง,
ห้ามแก้ไฟล์ .cs ของผู้ใช้ระหว่างทดสอบ (copy ไปทดสอบที่อื่น), ห้าม commit/push เองจนกว่าผู้ใช้อนุญาต, อัปเดต README ทุก milestone,
บอกผู้ใช้ทุกครั้งว่าต้องปิด/เปิด `run-viewer.bat` ใหม่ไหม หรือแค่ Ctrl+F5

---

## 1. แก้ snap (ผู้ใช้แจ้งว่า "ปุ่ม snap เหมือนยังใช้ไม่ได้")

**ทำซ้ำอาการให้ได้ก่อนแก้** (เปิดเว็บจริง ลองทุกปุ่มในแถบล่าง ทั้งตอนวาดและตอนไม่ได้วาด) แล้วรายงานสาเหตุจริงให้ผู้ใช้ก่อนแก้
จุดที่น่าสงสัยจากการอ่านโค้ด (ยังไม่ได้ยืนยัน):
- `snapAt()` ถูกเรียกเฉพาะตอนอยู่ใน Edit mode และเลือกเครื่องมือวาดอยู่ — นอกนั้น (ลากจุดที่วาดแล้ว, ลากจุด surface, move/copy ในอนาคต) OSNAP ไม่มีผลเลย
- ปุ่ม **Snap** ในแถบล่างคือ grid snap 0.05 m ไม่ใช่ object snap — ผู้ใช้อาจเข้าใจว่าเป็นสวิตช์ OSNAP (ใน AutoCAD: F3 = OSNAP เปิด/ปิดทั้งหมด, F9 = Snap grid)
- กดปุ่ม OSNAP แล้วผลไม่เปลี่ยนจนกว่าจะขยับเมาส์ (ไม่ได้คำนวณ candidate ใหม่ / ไม่ render)
- เครื่องมือ Shape / วิ่งตามผิวดิน / ลาดจนชนดิน บังคับ "เฉพาะ Endpoint" ไม่สนปุ่มอื่น
- ลำดับความสำคัญ (`end` มาก่อนเสมอ) ทำให้ Mid/Near/Perp แทบไม่เคยถูกเลือกเมื่อมี endpoint ใกล้ๆ ในรัศมี 12 px
- tooltip ปุ่มยังเขียนว่า "ใช้ตอนวาดใน Milestone 2"

พฤติกรรมที่ต้องการ:
- **OSNAP master toggle (F3)** + ปุ่มแยกแต่ละชนิด; **Grid snap (F9)** ระยะแก้ได้ (ดับเบิลคลิกปุ่มเพื่อตั้งค่า, default 0.05 m) ป้ายปุ่มให้ชัดว่าอันไหนคืออะไร
- snap ใช้ได้ทุกที่ที่ต้อง "เลือกตำแหน่ง": วาด, ลากจุดที่วาดแล้ว, base point / ปลายทางของ Move / Copy / Paste (ข้อ 2–3)
- เลือก candidate ที่ใกล้เมาส์ที่สุดในรัศมี (ไม่ใช่ endpoint ก่อนเสมอ) ยกเว้นระยะเท่ากันให้ endpoint ชนะ; กด **Tab ตอนมีหลาย candidate = วนเลือก** แบบ AutoCAD (ระวังชนกับ Tab พิมพ์ค่า — เสนอทางออกให้ผู้ใช้เลือก)
- marker คนละรูปตามชนิดแบบ AutoCAD (สี่เหลี่ยม = Endpoint, สามเหลี่ยม = Midpoint, กากบาท = Intersection, ฯลฯ) + ป้ายชื่อ
- กดปุ่มแล้วเห็นผลทันทีที่ตำแหน่งเมาส์เดิม
- แยก logic เลือก candidate เป็นฟังก์ชันล้วน (ไม่แตะ DOM) แล้วเขียน test ที่รันด้วย node ได้

## 2. Move / Copy / Delete / Undo-Redo (มี shortcut)

ใช้ได้ทั้ง:
- **ใน Edit mode**: กับ point / link / shape ที่วาด (ใน spec)
- **นอก Edit mode**: กับ subassembly ทั้งตัวใน workspace (ย้าย = เปลี่ยนจุดเกาะ/ตำแหน่ง, copy = สร้างตัวใหม่จากไฟล์เดียวกัน parameter เดียวกัน) — ถ้าเห็นว่าควรแยกเป็นรอบหลัง ให้ถามผู้ใช้ใน Milestone 0

**Move (`M`)** แบบ AutoCAD: เลือก object (หรือเลือกก่อนแล้วกด M) → คลิก base point → เห็นเงา (ghost) ตามเมาส์ → คลิกปลายทาง
(ใช้ snap / Ortho / slope lock / Tab พิมพ์ระยะ dx,dy หรือ ระยะ+slope ได้) — Esc ยกเลิก
- หัวใจ: spec เก็บ "ความหมาย" ของจุด จึงต้องย้ายแบบไม่ทำความสัมพันธ์พัง:
  - ย้ายเฉพาะจุดที่เป็น "ราก" ของกลุ่มที่เลือก (จุดที่ตำแหน่งไม่ได้ขึ้นกับจุดอื่นในกลุ่ม) จุดที่อ้างตามรากจะตามไปเอง
  - จุดชนิด `delta`/`slopeLength` จากจุดนอกกลุ่ม: แก้ dx/dy (หรือแปลงให้เหมาะ) ให้ไปอยู่ตำแหน่งใหม่
  - จุดที่ขึ้นกับ "โลกภายนอก" (`slopeToSurface`, `onSurface`, `intersect`, `between`, `external`, `origin`): ย้ายตรงๆ ไม่ได้ —
    ให้เตือนในแถบบอกว่าจุดไหนไม่ย้ายเพราะอะไร และมีตัวเลือก "แปลงเป็นระยะคงที่ (delta) แล้วย้าย"
  - นิพจน์ที่อ้าง parameter (เช่น dx = `Width`) ต้องไม่ถูกแทนที่เป็นตัวเลขเงียบๆ: ถ้าการย้ายต้องเปลี่ยนค่า ให้เขียนเป็น `Width + 1.25` หรือถามผู้ใช้ (เสนอแบบที่ดีที่สุดใน Milestone 0)
- นอก Edit mode: ย้าย subassembly = แบบเดียวกับการลากที่มีอยู่ (ปล่อยใกล้แกน/จุด = เกาะ)

**Copy (`C` แบบ AutoCAD COPY ที่วางได้หลายครั้งจนกด Esc) และ Ctrl+C / Ctrl+X / Ctrl+V**
- copy point/link/shape ได้ id ใหม่ ความสัมพันธ์ภายในชุดที่ copy ยังอ้างกันเอง ส่วนที่อ้างจุดนอกชุดยังอ้างตัวเดิม
- point/link/shape code ที่ copy มา: เก็บไว้ (Civil 3D ให้ซ้ำได้) แต่แสดงในต้นไม้ว่ามีซ้ำ
- Ctrl+V = วางแบบมี ghost ตามเมาส์ คลิกเพื่อวาง (base point = จุดอ้างอิงของชุด, snap ใช้ได้)
- clipboard ใช้ข้าม subassembly ได้ (copy จากตัวหนึ่งไปวางในอีกตัวที่กำลัง Edit) — จุดที่อ้างของนอกชุดให้แปลงเป็น delta จาก origin ของตัวใหม่
- ถ้า Ctrl+C ตอนโฟกัสอยู่ในช่องพิมพ์/แถบโค้ด ต้องเป็น copy ข้อความปกติ

**Delete (`Delete`)**: ลบที่เลือก; จุดที่ยังมี link/shape/จุดอื่นอ้างอยู่ → บอกว่าอะไรจะหายตามและให้ยืนยัน (ตอนนี้ `Delete` ลบจุด surface ที่เลือกอยู่ — คงไว้เมื่อสิ่งที่เลือกคือจุด surface)

**Undo / Redo (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`)**: ขยายจาก undoStack เดิมใน draw.js ให้ครอบคลุม **ทุกการกระทำ**:
วาด, move, copy, paste, delete, แก้ค่าใน Properties, แก้ parameter, ลากจุด surface, ย้าย/เกาะ/mirror/ลบ subassembly, ย้ายแกน assembly
- 1 การกระทำของผู้ใช้ = 1 ก้อน undo (ลากต่อเนื่อง = ก้อนเดียว)
- แถบบอกสั้นๆ ว่า undo อะไรไป ("Undo: ย้าย 3 objects")
- undo ไม่ย้อนการ save ไฟล์ (บอกใน README)

ทำตาราง shortcut ทั้งหมดใน README และกด `?` (หรือ F1) เพื่อแสดงตาราง shortcut บนจอ

## 3. คลุมเลือก (Window / Crossing) และวาง

แบบ AutoCAD:
- ลากจากซ้ายไปขวา = **Window** (กรอบเส้นทึบสีฟ้า): เลือกเฉพาะ object ที่อยู่ในกรอบทั้งตัว
- ลากจากขวาไปซ้าย = **Crossing** (กรอบเส้นประสีเขียว): เลือก object ที่แตะกรอบ
- คลิก = เลือกตัวเดียว · `Shift`+คลิก/คลุม = เอาออกจากที่เลือก (แบบ AutoCAD) · `Ctrl+A` = เลือกทั้งหมดในตัวที่ Edit อยู่ · `Esc` = ยกเลิกการเลือก
- **ตอนนี้ลากพื้นหลัง = pan** → ต้องเปลี่ยน: เสนอ pan ด้วยปุ่มกลางเมาส์ (แบบ AutoCAD) + `Space`+ลาก สำรองสำหรับ touchpad — **ถามผู้ใช้ก่อนเปลี่ยน**
- Edit mode: เลือก point/link/shape ของตัวที่แก้เท่านั้น; นอก Edit mode: เลือก subassembly ทั้งตัว
- ของที่เลือกเน้นทั้งบนรูปและในต้นไม้ซ้าย; Properties แสดง "เลือก N objects" พร้อมปุ่ม Move / Copy / Delete (และแก้ค่าที่เหมือนกันพร้อมกันได้ เช่น codes)
- เลือกก่อนแล้วสั่ง (noun-verb) และสั่งก่อนแล้วเลือก (verb-noun, Enter = จบการเลือก) ใช้ได้ทั้งคู่แบบ AutoCAD
- "วาง" = การวางผลของ Move / Copy / Paste ด้วย ghost ตามข้อ 2

## 4. คลิก object แล้วเห็นว่าอยู่บรรทัดไหนในโค้ด

เลือก point / link / shape (ทั้งที่วาดในเว็บ และที่มาจากโค้ดที่เขียนเอง) แล้ว:
- Properties แสดง "โค้ด: `ชื่อไฟล์` บรรทัด 245–252" + ปุ่ม **ไปที่โค้ด** → เปิดแถบโค้ดที่บรรทัดนั้นและ highlight ช่วงบรรทัด (Monaco decorations; textarea สำรองแค่เลื่อนไปบรรทัด)
- (ถ้าทำได้ไม่ยาก) ทางกลับ: เลื่อนเคอร์เซอร์ในแถบโค้ดไปบรรทัดที่สร้าง object → object นั้นเน้นบนรูป

วิธีหาบรรทัด:
- **ส่วนที่วาด (generated)**: ให้ `CodeGenerator` สร้าง source map (`objectId → บรรทัดเริ่ม–จบ`) ไปพร้อมโค้ด
  ต้องตรงกับบรรทัดในไฟล์จริงหลัง save — ทั้งไฟล์ที่สร้างใหม่ และไฟล์ import ที่ช่วง `SA-DRAWING` ถูกแทรกไว้กลางไฟล์ (นับรวมบรรทัด CALL/PARAM/TARGET ที่แทรก)
  ถ้ายังไม่ได้ save ให้ชี้ไปที่โค้ด preview (แถบโค้ดโหมดดูโค้ดที่ generate)
- **โค้ดที่ผู้ใช้เขียนเอง**: ให้ตัวจำลองจำ "ใครเรียก" ตอน `Points.Add` / `Links.Add` / `Shapes.Add`:
  ใช้ `new StackTrace(true)` หา frame ที่อยู่ในไฟล์ของผู้ใช้ (มี PDB อยู่แล้ว) แล้วส่งเลขบรรทัดกลับมากับ points/links/shapes ใน RunOutput
  - ไฟล์ของผู้ใช้มักเรียกผ่านฟังก์ชันช่วย (เช่น `AddPoint(...)` ใน `base_rock-pitching.cs`) → เก็บทั้งสาย frame ในไฟล์ผู้ใช้
    แล้วแสดงแบบ "บรรทัด 512 (AddPoint) ← เรียกจาก 180 (DrawImplement)" ให้กดได้ทุกบรรทัด
  - ตรวจว่าเลขบรรทัดตรงกับไฟล์จริงเมื่อมี `RunGuardRewriter` แทรกโค้ด (README บอกว่าไม่เลื่อน — ยืนยันด้วย test)
  - วัดผลต่อความเร็ว: ถ้า StackTrace ทำให้ช้าจนรู้สึกได้ตอนลากเส้น surface ให้เก็บเฉพาะตอนผู้ใช้เลือก object (ขอรันซ้ำแบบเก็บบรรทัด) แทน

## 5. Milestones

0. อ่านโค้ด + **ทำซ้ำอาการ snap** + สรุปแผน แล้วถามผู้ใช้ (ข้อ 6) ก่อนเขียนโค้ด
1. แก้ snap (ข้อ 1) + test ของ logic snap
2. ระบบ selection: คลิก / Window / Crossing / Shift / Ctrl+A / Esc + เปลี่ยนวิธี pan ตามที่ผู้ใช้เลือก + Properties หลาย object
3. Undo/Redo ครอบคลุมทุกการกระทำ + Delete
4. Move / Copy / Ctrl+C,X,V + ghost + snap ตอนวาง + ตาราง shortcut (`?`)
5. object → บรรทัดโค้ด (generated + โค้ดที่เขียนเอง) + ปุ่มไปที่โค้ด + highlight
6. อัปเดต README ทั้งหมด + ทดสอบรวมใน browser (โหมดเดิมทุกโหมดยังทำงาน)

## 6. คำถามที่ต้องถามผู้ใช้ใน Milestone 0
1. pan: ปุ่มกลางเมาส์ + Space+ลาก ได้ไหม (ลากพื้นหลังด้วยปุ่มซ้ายจะกลายเป็นคลุมเลือก)
2. shortcut ตัวอักษรเดียว (`M`, `C`) แบบที่เสนอ หรืออยากพิมพ์คำสั่งแบบ AutoCAD (`MOVE`, `CO` + Enter) ในช่องคำสั่ง
3. ย้ายจุดที่ค่าอ้าง parameter อยู่ (เช่น dx = `Width`): ให้กลายเป็น `Width + ระยะที่ย้าย` หรือถามทุกครั้ง
4. Move/Copy subassembly ทั้งตัว (นอก Edit mode) ต้องการในรอบนี้เลยไหม
5. Tab: ใช้วน snap candidate หรือพิมพ์ค่า (ตอนนี้ Tab = พิมพ์ค่า) — ถ้าจะใช้ทั้งคู่ เสนอปุ่มอื่นให้อันหนึ่ง
