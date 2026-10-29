# งานรอบ 3: เส้นโค้ง (Arc / Fillet), Polygon, OSNAP แบบ dropdown, จุดอ้างอิงจากการชี้ค้าง (dx dy), Rotate, ซูมละเอียดขึ้น

> วิธีใช้: เปิด Claude Code ในโฟลเดอร์โปรเจกต์ แล้วสั่ง "อ่าน prompt-3.md แล้วทำ Milestone 0"
> ทำทีละ milestone หยุดให้ผู้ใช้ลองทุกครั้ง รายงานเป็นภาษาไทยสั้นๆ (ทำอะไร / ลองยังไง / อะไรยังไม่ได้)

## 0. บริบท

โปรเจกต์นี้คือ SA Drawing Studio: วาด subassembly ของ Civil 3D แบบ CAD แล้วได้ไฟล์ .cs (ดู `prompt.md`, `prompt-2.md`, `README.md`)
รอบ 2 (`prompt-2.md`) ทำเสร็จแล้ว: OSNAP ใหม่ (`snap.js`), Move/Copy/Paste (`ops.js`, `cmd.js`), undo/redo (`history.js`),
คลุมเลือก (`select.js`), คลิก object แล้วไปบรรทัดโค้ด (`codelink.js`) — **ของใหม่ทั้งหมดในรอบนี้ต้องต่อกับระบบเหล่านี้ ไม่ใช่ทำระบบซ้อน**
ตรวจ `git status` / `git log -3` ก่อนเริ่ม ถ้ามีไฟล์ค้างแก้อยู่ให้บอกผู้ใช้

ผู้ใช้คุ้นกับ AutoCAD / Civil 3D / Subassembly Composer (SAC) มาก — พฤติกรรม **ให้เหมือน AutoCAD ที่สุด** ส่วนการกำหนดค่า **ให้เหมือน SAC**
(ช่องตัวเลขใส่ได้ทั้งค่าคงที่และนิพจน์ / ชื่อ parameter) ถ้าต้องต่างจากนี้ให้บอกเหตุผลใน README

ไฟล์ที่ต้องอ่านก่อนแก้:
| ไฟล์ | เกี่ยวกับรอบนี้ยังไง |
|---|---|
| `SA.Web/wwwroot/js/spec.js` | ชนิดจุด (`def.type`) / ชนิด link, `evaluate`, `addPoint`, `removeCascade` — จะเพิ่มชนิดใหม่ที่นี่ |
| `SA.Web/Drawing/DrawingSpec.cs`, `CodeGenerator.cs` | spec ฝั่ง server + สร้าง C# (`PointLine`, `TopoOrder`, `Helpers`, ส่วน "เพิ่มจุด / link / shape") |
| `SA.Web/wwwroot/js/snap.js` | รวบรวม/จัดลำดับ candidate (ฟังก์ชันล้วน มี test) |
| `SA.Web/wwwroot/js/draw.js` | เครื่องมือวาด, `snapAt`, marker ของ snap (`markerPath`), พิมพ์ค่า (Tab) |
| `SA.Web/wwwroot/js/ops.js`, `cmd.js` | Move/Copy/Paste — Rotate จะใช้โครงเดียวกัน (`Ops.plan`, `WHY`, `FOLLOW`) |
| `SA.Web/wwwroot/js/history.js`, `select.js`, `codelink.js` | undo/redo, การเลือก, source map ไปบรรทัดโค้ด |
| `SA.Web/wwwroot/js/workspace.js`, `core.js` | ซูม (`wheel` handler: clamp `scale` 4–800 px/m), `fit`, grid (`niceStep`), `state.bar`, `snapV` |
| `SA.Web/wwwroot/index.html`, `js/ui.js` | แถบล่าง `#bar` (ปุ่ม OSNAP), drawer เครื่องมือ (`data-tool`), Properties |
| `SA.Tests/js/*.test.js` | test ที่รันด้วย node — เพิ่ม test ของทุกอย่างใหม่ที่เป็นฟังก์ชันล้วน |

Shortcut ที่มีอยู่แล้ว ห้ามชนโดยไม่ตั้งใจ: `P` `L` `S` `A` `F` `M` `C` `Space`(pan) `Tab` `Enter` `Esc` `F3` `F8` `F9` `?`/`F1` `Delete`
`Ctrl+A/C/X/V/Z/Y/E/S` — shortcut ใหม่ทุกตัวต้องเพิ่มในตาราง `?` ด้วย

กติกาเดิมยังใช้ทั้งหมด: CRLF, ข้อความ UI และคอมเมนต์ภาษาไทย, localhost เท่านั้น, ห้ามทำโหมด/ฟีเจอร์เดิมพัง,
ห้ามแก้ไฟล์ .cs ของผู้ใช้ระหว่างทดสอบ (copy ไปทดสอบที่อื่น), ห้าม commit/push เองจนกว่าผู้ใช้อนุญาต, อัปเดต README ทุก milestone,
บอกผู้ใช้ทุกครั้งว่าต้องปิด/เปิด `run-viewer.bat` ใหม่ไหม หรือแค่ Ctrl+F5

**ข้อจำกัดจาก Civil 3D API ที่ต้องยึด:** shim มีแค่ `Points.Add`, `Links.Add(Point[], code)`, `Shapes.Add(Link[], code)` และเท่าที่ผู้ใช้กับผมรู้
link ใน subassembly เป็น **เส้นตรงเท่านั้น** → เส้นโค้งทุกชนิดต้อง **แบ่งเป็น link ตรงสั้นๆ หลายท่อน** ในโค้ดที่สร้าง (แบบที่ stock subassembly ทำ)
ห้ามเพิ่ม API ปลอมใน shim ที่ Civil 3D จริงไม่มี ถ้าเจอเหตุผลที่ต้องแตะ shim ให้ถามผู้ใช้ก่อน

---

## 1. Polygon (สองโหมด) + จุดช่วยสร้าง

เครื่องมือใหม่ใน drawer (ไอคอน SVG แบบเดียวกับปุ่มอื่น) สองตัว:

**1a. Polygon อิสระ** — คลิกจุดไปเรื่อยๆ (ใช้ snap / Ortho / พิมพ์ค่า Tab ได้เหมือนเครื่องมือ Link) แล้ว
ปิดรูปด้วยการคลิกจุดแรก, `Enter` หรือ `C` (Close แบบ AutoCAD) → ได้ point + link + **shape** ครบในครั้งเดียว (≥ 3 จุด)
- จุดที่คลิกบน snap ของจุดเดิม = ใช้จุดเดิม (ไม่สร้างซ้ำ) เหมือนเครื่องมือ Link
- ถามรหัส link/shape ตอนจบแบบเดียวกับเครื่องมือ Shape เดิม

**1b. Polygon ด้านเท่า** (ค่าเริ่มต้น 5 เหลี่ยม) — คลิกจุดศูนย์กลาง → ลากรัศมี/มุม → คลิก (หรือ Tab พิมพ์ค่า)
- ช่องค่าตอนวาดและใน Properties: **จำนวนด้าน N** (ตัวเลขคงที่ 3–24, เปลี่ยนแล้วสร้างจุดใหม่), **รัศมี R**, **มุมหมุน θ** (องศา)
  — R และ θ เป็นนิพจน์ได้ (ตัวเลข หรือชื่อ parameter แบบ SAC) มีปุ่มลัด "สร้าง parameter ใหม่จากช่องนี้"
- R = รัศมีถึงมุม (inscribed) ให้มีตัวเลือก "ถึงกึ่งกลางด้าน" (circumscribed) แบบคำสั่ง POLYGON ของ AutoCAD
- จุดศูนย์กลางเกาะจุดเดิมได้ (snap) → รูปทั้งรูปเลื่อนตามจุดนั้น

**ชนิดจุดใหม่ที่ต้องใช้ (เพิ่มใน spec.js + DrawingSpec.cs + CodeGenerator.cs + ops.js):**
- `polar` — `from, length, angle` จุดที่ห่างจาก from ระยะ length ทำมุม angle (องศา ทวนเข็มจาก +x บนจอ)
  ฝั่ง Left (F = -1) ต้องกลับด้านแนวราบให้ถูกเหมือนชนิดอื่น (`x = from.X + F·L·cosθ`) เขียน test ทั้งสองฝั่ง
  จุดยอดของ polygon ด้านเท่า = `polar` จากจุดศูนย์กลาง (`angle = θ + 90 + i·360/N` หรือตามที่ออกแบบ บอกใน README)
- **จุดช่วยสร้าง (construction)** — flag `construction: true` บนจุด: คำนวณใน C# เป็นตัวแปร `Pt?` แต่ **ไม่เรียก `Points.Add`**
  (ไม่ไปโผล่ใน Civil 3D) วาดในเว็บเป็นกากบาทเทาเล็กๆ, snap Endpoint ได้, ติ๊กเปิด/ปิดได้ใน Properties
  จุดศูนย์กลางของ polygon ด้านเท่า (ถ้าไม่ได้เกาะจุดเดิม) และจุดยอดเดิมของ Fillet (ข้อ 2) เป็น construction
  link ที่ปลายเป็นจุด construction ไม่ได้ (ห้าม/เตือน)

ทุกอย่างต้องใช้ได้กับ: select / window-crossing, Move/Copy/Paste, Delete (cascade), undo/redo, codelink, Side mirror

## 2. เส้นโค้ง: Arc และ Fillet

**ชนิด link ใหม่** (หนึ่ง link ใน spec = หลายท่อนในโค้ดที่สร้าง):
- `arc3` — `from, via, to` ผ่าน 3 จุด (via เป็นจุดใน spec — ปกติเป็น construction)
- `arcR` — `from, to, radius, sweep: "cw" | "ccw", large: false|true` จุดเริ่ม-จุดปลาย-รัศมี (radius เป็นนิพจน์ได้)
- `fillet` — โค้งสัมผัสระหว่าง 2 เส้นที่มุม (ดูด้านล่าง)
- ทุกชนิดมี `seg: { by: "chord" | "count", value: "<นิพจน์>" }` — default `chord` ยาวไม่เกิน **0.05 m** (ถามผู้ใช้ใน M0),
  จำนวนท่อนคำนวณตอนรัน (ใน C#) จำกัด 2–180 ท่อน

**เครื่องมือ:**
- **Arc** (drawer): โหมดย่อย "3 จุด" กับ "เริ่ม-ปลาย-รัศมี" (สลับได้ระหว่างวาด เช่นกดตัวอักษรใน banner แบบ AutoCAD) preview โค้งตามเมาส์
- **Fillet** (drawer): ใส่รัศมี R (นิพจน์ได้) → คลิก link ที่ 1 แล้ว link ที่ 2 ที่ต่อกันที่มุม P
  - ได้จุดสัมผัส T1, T2 (ชนิดจุดใหม่ `tangent` — `corner, toward, other, radius`: อยู่บนเส้น corner→toward ห่าง R / tan(α/2))
  - link เดิม A–P, P–B ถูกแทนด้วย A–T1, fillet(T1→T2), T2–B; P กลายเป็น construction (ถ้าไม่มีอย่างอื่นใช้ P อยู่)
  - shape ที่ใช้ link เดิมต้องอัปเดตให้ใช้ชุดใหม่ตามลำดับ
  - ตอนรัน ถ้า R ใหญ่เกินจนจุดสัมผัสเลยปลายเส้น หรือสองเส้นขนานกัน → `RecordError` แบบเตือน + ใช้มุมแหลมเดิมแทน (ไม่ crash)

**การสร้าง C#:** เพิ่ม helper ใน `Helpers()` เช่น `ArcPoints(...)` คืนรายการจุดระหว่างทาง แล้ว `Points.Add` จุดระหว่างทาง (ไม่มี code)
+ `Links.Add` ทีละท่อนด้วย link code ของ arc ทุกท่อน; ตัวแปร link ของ arc เป็น `Link[]` และ `AddShape` ต้องรวม array ของ arc ตามลำดับได้
กรณีเรขาคณิตเป็นไปไม่ได้ (3 จุดเรียงเส้นตรง, รัศมี < ครึ่งคอร์ด) → เตือน + ใช้เส้นตรงแทน
ทิศ cw/ccw เก็บในกรอบ "Side = Right" แล้วกลับด้วย F ตอนรัน (ฝั่ง Left ต้องได้ภาพกระจกที่ถูก) — มี test

**snap กับเส้นโค้ง:** Endpoint ที่ปลาย, Nearest / Perpendicular / Intersection บนท่อนย่อย (ใช้ geometry ที่ tessellate แล้ว),
และ snap ชนิดใหม่ **Center** (`cen` — วงกลม+กากบาท แบบ AutoCAD) ที่จุดศูนย์กลางของ arc / polygon ด้านเท่า
(snap Center แล้วคลิก = สร้างจุด construction ที่ศูนย์กลาง) — เพิ่มใน `snap.js` พร้อม test

## 3. OSNAP แบบ dropdown

แทนปุ่ม Endpoint / Midpoint / … 6 ปุ่มในแถบล่าง ด้วยแบบ AutoCAD status bar:
- ปุ่ม `OSNAP (F3)` (เปิด/ปิดทั้งหมด เหมือนเดิม) + ปุ่มลูกศร `▾` ข้างๆ เปิดเมนูรายการชนิด snap พร้อม **ไอคอน marker รูปเดียวกับที่ขึ้นบนจอ** (ใช้ `markerPath`) และ checkbox
- เมนูไม่ปิดเมื่อติ๊ก (ติ๊กหลายอันต่อกันได้) ปิดเมื่อคลิกข้างนอก / Esc, มี "เลือกทั้งหมด" / "ล้างทั้งหมด"
- ชนิดในรายการ: Endpoint, Midpoint, Center (ใหม่), Intersection, Perpendicular, Nearest, Surface (ลาดชนดิน/ผิวดิน) + **Tracking (F11)** ของข้อ 4
- คลิกขวาที่ปุ่ม OSNAP = เปิดเมนูเดียวกัน (แบบ AutoCAD)
- tooltip ของปุ่มบอกชนิดที่เปิดอยู่; ค่าที่เลือกเก็บใน `state.bar.osnap` และจำข้ามการเปิดหน้าใหม่เหมือนเดิม
- เปลี่ยนแล้วเห็นผลทันทีที่ตำแหน่งเมาส์เดิม (กติกาจากรอบ 2)
- แถบล่างที่ได้ต้องสั้นลง ไม่ล้นบนจอ 1366 px

## 4. จุดอ้างอิงจากการชี้ค้าง (Object Snap Tracking) + พิมพ์ dx dy

พฤติกรรมแบบ OTRACK ของ AutoCAD — ทำงานทุกครั้งที่กำลัง "เลือกตำแหน่ง" (เครื่องมือวาด, base/ปลายทางของ Move/Copy/Paste/Rotate):
- เอาเมาส์ **ค้างบน snap candidate ประมาณ 0.5 วินาที** (ตั้งค่าได้) → จุดนั้นถูก "จับ" (acquire) ขึ้นเครื่องหมาย `+` เล็กๆ สีต่างจาก snap
- ชี้ค้างที่จุดที่จับแล้วอีกครั้ง = ปล่อย; จับได้ทีละหลายจุด (สูงสุด ~7 แบบ AutoCAD) จุดล่าสุดคือ "จุดอ้างอิงหลัก"
- เมื่อมีจุดอ้างอิง: เลื่อนเมาส์ให้แนวราบ/แนวดิ่งตรงกับจุดที่จับ → ขึ้นเส้นประ tracking และ snap ไปบนเส้นนั้นได้ (ป้าย เช่น "แนวดิ่งจาก P3")
  จุดตัดของเส้น tracking สองเส้นก็ snap ได้
- **กด Tab ตอนมีจุดอ้างอิง → ช่องพิมพ์ dx dy คิดจากจุดอ้างอิงหลัก** (ไม่ใช่จุดก่อนหน้า) และ banner บอกชัดว่า "อ้างจาก P3"
  (ตอนไม่มีจุดอ้างอิง Tab ทำงานแบบเดิม; การวน candidate ด้วย Tab จากรอบ 2 ต้องยังใช้ได้ — ถ้าชนกันให้เสนอทางออกผู้ใช้ใน M0)
- **การเก็บใน spec: ผูกกับจุดนั้น** (ผู้ใช้เลือกแล้ว) — จุดใหม่เป็น `delta` (หรือ `polar` ถ้าพิมพ์เป็นระยะ<มุม) โดย `from` = จุดที่จับ
  ถ้าจุดที่จับยังไม่เป็นจุดใน spec (Midpoint, Intersection, Center) ให้สร้างจุด construction (`between` / `intersect` / ศูนย์กลาง) ขึ้นมาเป็น from
  → ถ้าจุดแม่เลื่อน (เช่น ตาม surface หรือ parameter) จุดใหม่เลื่อนตาม — มี test ยืนยัน
- เปิด/ปิดด้วย **F11** และอยู่ในเมนู OSNAP (ข้อ 3); Esc ล้างจุดที่จับทั้งหมด; จบคำสั่งแล้วล้างเอง

## 5. Rotate (R)

คำสั่ง `R` (แบบ ROTATE ของ AutoCAD) ใช้โครงเดียวกับ Move/Copy ใน `cmd.js`:
1. เลือก object (หรือใช้ชุดที่เลือกอยู่) → 2. คลิก base point (จุดหมุน, snap/tracking ได้) → 3. ระบุมุม: ลากเมาส์ (preview หมุนจริง) หรือ Tab พิมพ์
- มุมเป็นองศา บวก = ทวนเข็มบนจอ; ช่องมุม **ใส่ได้ทั้งตัวเลขคงที่และนิพจน์ / ชื่อ parameter** (แบบ SAC) + ปุ่มลัดสร้าง parameter ใหม่
- ตัวเลือกใน banner แบบ AutoCAD: `C` = Copy (หมุนสำเนา ต้นฉบับอยู่ที่เดิม), `R` = Reference (มุมอ้างอิง → มุมใหม่)
- ฝั่ง Left (F = -1) มุมบนจอต้องกลับเครื่องหมายให้ภาพกระจกถูก — มี test

**การเก็บใน spec (ห้ามแปลงเป็นพิกัดคงที่เงียบๆ):** แนะนำแบบ "กลุ่มหมุน"
`rotations: [{ id, pivot, angle, points: [...] }]` — สมาชิกคำนวณตาม def เดิมในกรอบที่ยังไม่หมุน (สมาชิกอ้างสมาชิกด้วยกันใช้พิกัดก่อนหมุน)
แล้วหมุนรอบ pivot ด้วย angle; จุดนอกกลุ่มที่อ้างสมาชิกเห็นพิกัดที่หมุนแล้ว; pivot เป็นจุดใน spec (สร้าง construction ถ้าจำเป็น)
ใน C# = คำนวณ `Pt?` ก่อนหมุน แล้วผ่าน helper `Rotate(pt, pivot, angleDeg)` ก่อน `AddPoint`
ถ้าเห็นทางที่ดีกว่า เสนอผู้ใช้ใน M0 ได้ แต่ต้องรักษา: มุมเป็น parameter ได้, แก้มุมใน Properties ของกลุ่มได้ภายหลัง, undo ได้

**จุดที่หมุนไม่ได้ (ผู้ใช้เลือกแล้ว: เตือนแล้วข้ามไปก่อน):** จุดที่ขึ้นกับโลกภายนอก — ลาดจนชนดิน, บนผิวดิน, จุดจากโค้ดเดิม, origin,
บนเส้น/จุดตัดของจุดที่ไม่ได้หมุน (ใช้ `Ops.plan` / `WHY` ชุดเดียวกับ Move) → ไม่หมุน + ขึ้นรายการเหตุผลก่อนยืนยัน
(ยังไม่ต้องมีตัวเลือก "แปลงเป็นค่าคงที่แล้วหมุน" ในรอบนี้) — link/shape ที่ปลายข้างหนึ่งหมุนอีกข้างไม่หมุน จะยืดตามจริง ไม่ต้องห้าม

## 6. ซูมละเอียดขึ้น (ถึงระดับ 1 ซม. สบายๆ)

- เปลี่ยน clamp ของ `state.view.scale` (ตอนนี้ 4–800 px/m ใน wheel handler และ `fit`) ให้ซูมเข้าได้อย่างน้อย **~20000 px/m** (1 ซม. ≈ 200 px)
  และซูมออกได้น้อยกว่าเดิม (เช่น 0.5 px/m) — รวมค่าที่โหลดจาก project/localStorage ด้วย
- grid ปรับระยะตามซูม (`niceStep` ลงไปถึง 0.005 / 0.001 m), ตัวเลขพิกัดใน `#bar-xy` และป้ายต่างๆ เพิ่มทศนิยมตามซูม (ถึง 3 ตำแหน่ง)
- ความหนาเส้น / marker / ตัวอักษร / รัศมี snap คงที่เป็น px ทุกระดับซูม; ซูมเข้ามากๆ แล้วการลาก/snap/พิมพ์ค่ายังแม่น
- Grid snap (F9): ดับเบิลคลิกตั้งระยะได้เล็กถึง 0.001 m
- เพิ่ม **Zoom to selection** (`Z` เมื่อมีของที่เลือก, ไม่มี = Fit) และให้ wheel ซูมนุ่มขึ้น (กด Shift ค้าง = ซูมทีละน้อย)

---

## 7. Milestones

| M | งาน | ผู้ใช้ลองยังไง |
|---|---|---|
| 0 | อ่านโค้ด, `git status`, รัน test เดิมให้ผ่าน, ถามคำถามข้อ 8, เสนอโครงชนิดจุด/link ใหม่ + รูปแบบ spec (ตัวอย่าง JSON) | ตอบคำถาม |
| 1 | ข้อ 6 ซูม + ข้อ 3 OSNAP dropdown (งานเล็ก เห็นผลเร็ว) | ซูมดูรายละเอียด 1 ซม., ติ๊ก snap ในเมนู |
| 2 | ข้อ 4 Tracking + dx dy (เพิ่ม Center snap กับ construction point ส่วนที่ต้องใช้) | ชี้ค้างที่จุด → Tab พิมพ์ dx dy → ขยับจุดแม่แล้วจุดใหม่ตาม |
| 3 | ข้อ 1 Polygon ทั้งสองโหมด + `polar` + construction + C# | วาด 5 เหลี่ยม, เปลี่ยน R/θ เป็น parameter, สลับ Side |
| 4 | ข้อ 2 Arc + Fillet + snap บนโค้ง + C# | วาดราง/มุมโค้ง, Fillet มุม shape, เปลี่ยนรัศมีใหญ่เกินดูคำเตือน |
| 5 | ข้อ 5 Rotate + กลุ่มหมุน + C# | หมุนชุดจุดด้วยมุมคงที่และมุมที่เป็น parameter, ลองหมุนจุดลาดชนดิน |
| 6 | รวมงาน: codelink/undo/copy-paste/delete ครบทุกชนิดใหม่, test ฝั่ง Left, README, **ชุดทดสอบสำหรับ Civil 3D** (ด้านล่าง) | ทดสอบใน Civil 3D |

ทุก milestone: รัน test JS ทั้งหมด + สร้าง .cs จาก spec ตัวอย่างแล้วคอมไพล์/รันผ่าน shim ในเว็บได้ไม่มี error
แต่ละชนิดใหม่ต้องมี test ที่เทียบพิกัดที่ **JS evaluate** กับพิกัดที่ **C# ที่สร้างแล้วรันผ่าน shim** ว่าตรงกัน (ทั้ง Side Right/Left)

**ชุดทดสอบสำหรับ Civil 3D (M6):** สร้าง `tests-civil3d/round3-demo.cs` (+ `.saproj`) ที่มีครบ: 5 เหลี่ยมด้านเท่า (R, θ เป็น parameter),
Polygon อิสระ, Arc 3 จุด, Arc รัศมี, Fillet ที่มุมของ shape, กลุ่มหมุน (มุมเป็น parameter), จุดที่สร้างจาก tracking
และ `tests-civil3d/round3-checklist.md` ภาษาไทยให้ผู้ใช้ทำในเครื่องที่มี Civil 3D: build → import → ใส่ใน assembly + corridor แล้วเช็ค
(1) โค้งเนียนพอไหม / จำนวน link ไม่หนักเกิน (2) shape ปิดและลง hatch ได้ (3) แก้ R/θ/มุมหมุน/Side ใน Properties แล้วรูปตาม
(4) จุด construction ไม่โผล่ใน Civil 3D (5) ไม่มี error ใน Event Viewer ของ corridor

## 8. คำถามที่ต้องถามผู้ใช้ใน Milestone 0 (มีค่าที่เสนอไว้ ถ้าผู้ใช้ตอบ "ตามที่เสนอ" ใช้ค่านี้)

1. ความยาวท่อนย่อยของโค้ง default — เสนอ **0.05 m** (และ 2–180 ท่อน)
2. Shortcut — เสนอ `R` = Rotate, `F11` = Tracking, `Z` = Zoom to selection; Arc / Fillet / Polygon กดจาก drawer (ไม่มีตัวอักษร) หรืออยากได้ตัวไหน
3. เวลาชี้ค้างเพื่อจับจุด — เสนอ **0.5 วินาที**
4. ถ้า Tab (พิมพ์ dx dy จากจุดอ้างอิง) ชนกับ Tab วน candidate ของรอบ 2 — เสนอทางออก 1–2 แบบให้เลือก
5. รูปแบบ "กลุ่มหมุน" ใน spec โอเคไหม (แสดงตัวอย่าง JSON + ตัวอย่าง C# ที่จะได้)

### คำตอบ (Milestone 0, 2026-10-29) — ใช้ค่าที่เสนอทั้งหมด
- ท่อนโค้ง default ยาวไม่เกิน 0.05 m (2–180 ท่อน) · ชี้ค้าง 0.5 วินาที · `R` = Rotate, `F11` = Tracking (ถ้า Chrome กัน F11 ไม่ได้ เสนอปุ่มสำรอง), `Z` = Zoom to selection · Arc / Fillet / Polygon กดจาก drawer
- Tab: ทำงานแบบเดิม (มี snap ≥ 2 = วน ไม่งั้น = พิมพ์ค่า) · **พิมพ์ตัวเลขได้ทันที = ช่อง dx dy คิดจากจุดอ้างอิงหลัก** เมื่อมีจุดที่จับไว้ (แบบ AutoCAD)
- spec ตามที่เสนอ:
  - จุด: `polar {from, length, angle}` (x = from.X + F·L·cosθ), `construction: true` (ไม่ Points.Add), `tangent {corner, toward, other, radius}`
  - link: `arc3 {from, via, to, seg}`, `arcR {from, to, radius, sweep, large, seg}`, `fillet {from, to, corner, radius, seg}` — `seg = {by: chord|count, value}`
  - `polygons: [{id, center, n, radius, angle, mode: inscribed|circumscribed, points, links, shape}]` — จุดยอดเป็น `polar` ธรรมดา
    (angle ของจุดยอด i = `θ + 90 + i·360/N`, circumscribed: length = `R / cos(180/N)`) record นี้ใช้แก้ N/R/θ ใน Properties แล้วเขียน def ของจุดยอดใหม่
  - `rotations: [{id, pivot, angle, points}]` — 1 จุดอยู่ได้กลุ่มเดียว, pivot ห้ามอยู่ในกลุ่มตัวเอง; C#: คำนวณสมาชิกก่อน แล้ว `Pn = Rotate(Pn, pivot, F * angle)` ก่อนจุดนอกกลุ่มที่อ้างถึง
- ชุดทดสอบ Civil 3D (M6) ใช้ `.assembly.json` แทน `.saproj`
- หมายเหตุ: งานรอบแรก Milestone 4 (วาดเพิ่มลงไฟล์ที่เขียนเอง / external ใน C#) และ 5 (Export dialog / .saproj) ยังไม่ได้ทำ

## 9. สิ่งที่ไม่ต้องทำในรอบนี้

- โค้งพาราโบลา / spline, วงกลมเต็มวง, Offset, Mirror, Scale, Trim/Extend
- หมุน subassembly ทั้งตัวในโหมด Assembly
- จำนวนด้านของ polygon เป็น parameter (N คงที่ตอนวาด)
- ตัวเลือก "แปลงเป็นค่าคงที่แล้วหมุน" สำหรับจุดที่หมุนไม่ได้
