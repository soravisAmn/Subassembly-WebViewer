# SA Drawing Studio — IDEA#1 (รายการไอเดีย 8 หมวด)
ที่มา: รายการไอเดีย v2 (11 พ.ย. 2026) + ที่คุยเพิ่มวันที่ 12 พ.ย. 2026 ยังเป็นแค่แผน ยังไม่ได้สร้างอะไร
สัญลักษณ์: [decided] = ตกลงแนวทางแล้ว · [open] = ยังต้องคุยต่อ · [idea: ...] = พักไว้ก่อน ค่อยกลับมาคุย

> หมายเหตุ annotation ใน Civil 3D (ตัด Decision ข้อ 0 เดิมออกแล้ว — 12 พ.ย.)
> ป้ายระดับ marker และ label ในรูปตัดทำใน Civil 3D เองผ่าน Code Set Style (Marker style + Label style ตาม code)
> แล้วแต่ผู้ใช้จะตั้ง เว็บมีหน้าที่แค่ทำให้ code ถูกและครบ (ดูข้อ 3) ไม่ export style ไป Civil 3D
> label ของ Civil 3D อ่านค่าของจุด/link/shape เอง (elevation, offset, slope, area) แต่แสดงค่า parameter ของเราไม่ได้
> จุดเดียวใส่ได้หลาย code ถ้าอยากได้ label คนละแบบ (เช่น `Crest` + `CrestEL`) ไม่ต้องสร้างจุดซ้อน

---

## 1. Web display — การแสดงผลที่เห็นเฉพาะในเว็บ ไม่ถูกเขียนลง .cs [decided]
ทุกอย่างในหมวดนี้ไม่ไปถึง Civil 3D ใช้ช่วยคิดและช่วยดูเท่านั้น และ**ซ่อนได้โดยไม่ลบ**

### ตารางรายการในหมวดนี้
| กลุ่ม | รายการ | เก็บที่ | ซ่อนได้ |
|---|---|---|---|
| 1a Style ตาม code | Link: สี, linetype (ทึบ / ประ / center), น้ำหนักเส้น | `{ชื่อ}.style.json` (ข้อ 8) | ✓ (กลับไปใช้สีมาตรฐาน) |
| | Shape: สีพื้น, hatch pattern | `.style.json` | ✓ |
| | Point: ตัวอย่างสัญลักษณ์ marker | `.style.json` | ✓ |
| | link ช่วย / link ที่ซ่อน (แบบ SAC) แสดงเป็นเส้นประเป็นค่าเริ่มต้น | ค่าเริ่มต้นของแอป | ✓ |
| | override ทีละ object (เหมือน CAD ที่ object ไม่ใช้ ByLayer) | ในไฟล์ (sa-spec ส่วน `display`) | ✓ |
| 1b Note และ dimension | Note: ข้อความอิสระ + leader ผูกกับ object | ในไฟล์ (`display`) | ✓ |
| | Dimension: แนวนอน / แนวตั้ง / ตามแนว ระหว่างสองจุด | ในไฟล์ (`display`) | ✓ |
| | ตัวเลข dimension เปลี่ยนเองตาม parameter และ scenario, เลือกโชว์ชื่อ parameter ได้ เช่น `3.00 (Wcrest)` | — | — |
| 1c ข้อมูลช่วยดู (overlay) | ชื่อ code ของแต่ละ point / link / shape | ไม่ต้องเก็บ (ค่าจาก geometry) | ✓ |
| | ชื่อจุด (P1, P2 …) | ไม่ต้องเก็บ | ✓ |
| 1d โหมดการดู (ต่อยอดปุ่ม c3d ที่มีอยู่แล้วในแถบล่าง ซึ่งตอนนี้ซ่อนแค่ auxiliary) | **Design** = เห็นทุกอย่าง | ค่าที่ผู้ใช้เลือกล่าสุด | — |
| | **Civil 3D preview** = เห็นแค่ assembly / subassembly ที่จะไปแสดงใน Civil 3D จริง (ไม่มี link ช่วย, note, dimension, style ของเว็บ, ชื่อ code) | | — |
| | เปิด/ปิดทีละกลุ่ม (1a / 1b / 1c) แบบ layer on/off | | — |

### กติกา
- 1a ใช้หลักเดียวกับ ByLayer ของ CAD แต่เป็น **ByCode** — คิดแบบเดียวกับ Code Set Style ใน Civil 3D แต่**ไม่ sync กัน** ต่างคนต่างตั้ง
- note และ dimension ผูกกับ**จุดตามความหมาย** (ID ของจุด) ไม่ใช่พิกัด → ขยับตามเมื่อแก้ geometry
  (เทียบ SAC: SAC ไม่มี dimension ที่ตัวเลขเปลี่ยนตาม parameter → จุดขาย)
- เก็บแยกจาก geometry ตอน export .cs ไม่แตะส่วนนี้ (อย่างมากใส่เป็นคอมเมนต์)
- ที่เก็บ style, note และ dimension: ดูข้อ 8
- [idea: export ตารางจับคู่ code กับ style ไว้ช่วยตั้ง Code Set Style ใน Civil 3D เอง] — ความสำคัญต่ำ (Civil 3D มี Import Codes อยู่แล้ว)
- ตำแหน่งใน UI: กำหนดตอนออกแบบ layout (ข้อ 7) เช่น palette "Display" ที่มี Style by code + ปุ่มโหมดการดู

---

## 2. Browser — คลัง object ที่ใช้ซ้ำ [decided]
- ชื่อ palette / ribbon tab = **Browser** (14 พ.ย.) เพราะเห็นมากกว่าคลัง: โฟลเดอร์โปรเจกต์ + คลัง + โฟลเดอร์แชร์ (คุ้นแบบ Content Browser ของ Civil 3D และ Browser ของ QGIS)
- หน้าตา: แถบเครื่องมือ (เพิ่มโฟลเดอร์ root, รีเฟรช, ยุบทั้งหมด, ค้นหา) → **ต้นไม้โฟลเดอร์** (มีโฟลเดอร์ย่อย, โชว์จำนวน .cs) → path ของโฟลเดอร์ที่เลือก → **ตาราง thumbnail** ของ object ในโฟลเดอร์นั้น
- **root หลายตัว ที่ผู้ใช้เพิ่มเอง** (แบบ Favorites ของ QGIS) ไม่เริ่มจากทั้งไดรฟ์ `C:\`:
  - `โปรเจกต์: SR03` (รวม `lib\` ที่ copy เข้ามาแล้ว) — มาเองเมื่อเปิดโปรเจกต์
  - `คลัง: SA-Library` และโฟลเดอร์แชร์ของทีม เช่น `\\server\design\SA` — ตั้งในการตั้งค่าแอป (ค่าเฉพาะเครื่อง ข้อ 8)
  - เหตุผล: เห็นแต่โฟลเดอร์ที่มี .cs และใช้ได้กับเว็บบน cloud ในอนาคต (cloud เปิดทั้งไดรฟ์ของ user ไม่ได้)
- object แต่ละชิ้นในคลัง = **subassembly .cs แยกไฟล์** (คลาสของตัวเอง) ไม่ได้รวมเข้าไปใน .cs ตัวอื่น
- เว็บทำหน้าที่แค่**แสดงรายการ**ไฟล์ในโฟลเดอร์คลัง (ชื่อไฟล์ และรูป thumbnail ถ้ามี) ไม่ import, ไม่ cache
  และไม่เก็บข้อมูลของคลังไว้เอง → เว็บจะเบา
- วิธีใช้: ลากไฟล์จากรายการเข้า workspace → เข้ามาเป็น subassembly ใน assembly ต่อกันด้วย point code
  (ใช้ฟีเจอร์ assembly ที่มีอยู่แล้ว)
- **ตอนลากเข้าโปรเจกต์ = copy** .cs (+ .png) เข้าโฟลเดอร์โปรเจกต์ เช่น `SR03\lib\Fence.cs` [decided 14 พ.ย.]
  → ย้ายโปรเจกต์ได้โดยไม่พึ่งคลัง (ข้อ 8) และแก้คลังแล้วไม่ทำโปรเจกต์เก่าพังเงียบๆ
  - ปุ่ม **"อัปเดตจากคลัง"**: โชว์ความต่างก่อน แล้วผู้ใช้กดรับเอง
  - (ทางที่ไม่เลือก: อ้าง path ไปที่คลังตรงๆ — แก้ที่เดียวทุกโปรเจกต์ตาม แต่ย้ายเครื่องแล้วหาไม่เจอ)
- โฟลเดอร์คลังตั้งในการตั้งค่าแอปของแต่ละเครื่อง ไม่อยู่ในโปรเจกต์ · แสดงใน palette Browser + ปุ่มใน Browser tab
- Thumbnail: บันทึกไฟล์ PNG ไว้ข้าง .cs (`Fence.cs` + `Fence.png`) เว็บจะได้ไม่ต้องรันโค้ดทุกไฟล์เพื่อแสดงตัวอย่าง
- ตัวอย่าง object: รั้ว, พื้น, รางน้ำ, เขื่อนแบบอื่น ๆ

### 2.1 [idea: คลังแบบมาตรฐานสำหรับ community]
- เว็บแยกอีกตัวที่เป็นแบรนด์ของเรา เก็บโฟลเดอร์แบบมาตรฐานของหน่วยงานไทยให้ดาวน์โหลด
  (เช่น กรมโยธาธิการและผังเมือง — เสาเข็ม, รูปตัดเขื่อนมาตรฐาน)
- user ดาวน์โหลดโฟลเดอร์แล้วเปิดใน panel คลัง ช่วยสร้าง community และแบรนด์ไปพร้อมกัน
- ก่อนเผยแพร่:
  - **ลิขสิทธิ์:** งานของหน่วยงานรัฐไทยส่วนใหญ่ยังมีลิขสิทธิ์ (ยกเว้นบางประเภท เช่นตัวบทกฎหมาย ระเบียบ และประกาศ)
    การนำขนาดหรือ spec มาสร้างรูปตัดเองมีความเสี่ยงน้อยกว่าการนำตัวแบบไปแจก แต่ควรสอบถามหน่วยงานหรือตรวจเงื่อนไขก่อน
  - **ความรับผิดชอบทางวิศวกรรม:** ระบุแหล่งอ้างอิงและเวอร์ชันของแบบทุกชิ้น และมี disclaimer ว่าผู้ใช้ต้องตรวจสอบเองก่อนนำไปใช้จริง

---

## 3. หน้าต่าง Build และรายงาน [decided]
### ก่อน build (หน้าต่างตั้งค่า)
- ชื่อไฟล์ DLL — ค่าเริ่มต้นเป็นชื่อ workspace หรือ project และแก้ได้
- Namespace — แก้ได้
- ชื่อคลาส — ระบบตรวจให้อัตโนมัติว่าเป็นชื่อที่ C# ใช้ได้, ไม่ซ้ำกัน และไม่ชนกับคลาสของ SATemplate
- เวอร์ชัน Civil 3D ที่จะ build ให้ (ดูการจัดการเวอร์ชันในข้อ 4)

### ตรวจก่อน build (warning)
- link / shape ที่ไม่มี code
- ชื่อ code ที่สะกดไม่ตรงกัน (เช่น `Datum` กับ `datum`) — label / marker ใน Civil 3D จะขึ้นก็ต่อเมื่อ code ถูก
- parameter ที่เปลี่ยนไปจาก build ครั้งก่อน (ต้องลากเครื่องมือใหม่จาก catalog)
- ชื่อ DLL ซ้ำกับ DLL ที่อยู่คนละ path (.NET โหลดชื่อเดียวกันจากสอง path ใน session เดียวไม่ได้ → "classes could not be found")
- [open] เว็บรองรับ**จุดที่มีหลาย code**แล้วหรือยัง — ต้องเช็กในโค้ด ถ้ายังต้องเพิ่ม

### หลัง build (รายงานแสดงในแอป และบันทึกเป็นไฟล์)
- ชื่อเต็ม `Namespace.Class` ของทุกคลาส (ใช้กรอกใน Civil 3D)
- ตารางพารามิเตอร์: ชื่อ, ชื่อที่แสดง, type, ค่า default, หน่วย, คำอธิบาย
  (spec ต้องมีช่องคำอธิบายและ enum ของ parameter ด้วย)
- รายการ point / link / shape code ที่ใช้
- path ของไฟล์ที่ได้ (DLL, .atc), target framework, warning และ error

### สร้าง .atc (Tool Catalog) ให้อัตโนมัติ [decided — คุ้มค่ามาก]
- สร้างจากข้อมูลชุดเดียวกัน (ชื่อคลาส, พารามิเตอร์, ค่า default, type) → ตรงกับโค้ดเสมอ
- มี: ชื่อเครื่องมือ, คำอธิบาย, ไอคอน, ชื่อที่แสดงและคำอธิบายของพารามิเตอร์, dropdown (เช่น Side = Left/Right)
- ขั้นตอนของ user ใน Civil 3D: `CONTENTBROWSER` → Add Catalog → เลือกไฟล์ .atc → ลากเครื่องมือหรือทั้งหมวดไปวางใน Tool Palette
  ไม่ต้อง copy BasicLane แล้วแก้ Assembly/Class name เองอีก
- .atc ต้องอ้างถึง DLL แบบ **relative path** (`.\MySA.dll`) เพื่อให้โฟลเดอร์เดียวกันใช้ได้ทุกเครื่อง
  [open] ต้องทดลองใน Civil 3D จริงก่อนว่า relative path ใช้ได้
- หมายเหตุสำหรับ user: ถ้าเพิ่มหรือลบพารามิเตอร์ → build ใหม่ → นำเครื่องมือเก่าออกจาก palette แล้วลากใหม่จาก catalog
  (palette เก็บสำเนาของเครื่องมือไว้ตอนที่ลากมา)
- ใช้ไฟล์ .atc ของ stock ใน `C:\ProgramData\Autodesk\C3D 2027\` เป็นต้นแบบโครงสร้าง tag ที่ถูกต้อง
- [idea: ให้ `build-c3d.bat` copy DLL ไปที่ `D:\test_cad\C3D_Custom\SA` ให้เองหลัง build]

---

## 4. โหมด export และที่ที่ใช้ compile [decided]
### ทำไมต้อง compile บนเครื่อง
- เบราว์เซอร์รันโปรแกรมในเครื่อง user ไม่ได้ และ server บน cloud ก็เข้าถึงดิสก์ของ user ไม่ได้
  (การให้ user พิมพ์ path ในเครื่องลงในเว็บบน cloud จึงไม่ช่วยอะไร)
- การ compile ต้องใช้ DLL อ้างอิงของ Autodesk (`AeccDbMgd.dll`, `acdbmgd.dll` ฯลฯ) ซึ่งเรานำไปวางบน server
  สาธารณะไม่ได้ (ติด license) ทั้งนี้ไม่ต้องเปิด Civil 3D ค้างไว้ แค่ติดตั้งไว้ในเครื่องก็พอ
- การสร้างโค้ด, .atc, ไอคอน และรายงาน เป็นแค่ข้อความหรือรูปภาพ → ทำที่ไหนก็ได้ รวมถึงบน cloud

### แผน
- **ตอนนี้:** ใช้ local app/server ที่มีอยู่เป็นตัว compile (สั่ง `dotnet build` ได้อยู่แล้ว) ทำส่วนนี้ให้เสร็จก่อน
- **ภายหลัง (ถ้าเว็บสาธารณะมีคนใช้จริง):** เว็บบน cloud สำหรับวาด แชร์ และ community + โปรแกรมตัวช่วยขนาดเล็ก
  ที่ติดตั้งบนเครื่อง user เพื่อให้ปุ่ม Build บนเว็บ compile ในเครื่องเขาได้
- ตัวช่วยบนเครื่องควร**ตรวจหาเวอร์ชันให้เอง** โดยอ่าน registry ว่ามี Civil 3D ปีไหน และสั่ง `dotnet --list-sdks`
  → dropdown เวอร์ชันจะแสดงเฉพาะที่เครื่องมีจริง
- เก็บตารางจับคู่เวอร์ชันไว้ในแอป: Civil 3D 2025/2026 → `net8.0-windows`, 2027 → `net10.0-windows`
  ทำให้กดครั้งเดียวแล้ว build ให้หลายเวอร์ชันพร้อมกันได้

### โหมด export
| โหมด | สำหรับ | ได้ไฟล์ |
|---|---|---|
| **Build (DLL package)** | user ที่มี Civil 3D และ .NET SDK | `.dll` + `.atc` + ไอคอน + รายงาน |
| **Source package** | user ที่ไม่มี Civil 3D → ส่งต่อให้เพื่อนที่มี | `.cs` + `.csproj` + `.atc` + ไอคอน + `build.bat` (หา path ของ Civil 3D เอง) + รายงาน |
| **.pkt** [idea: ทดลอง] | ทุกคน โดยไม่ต้อง compile | package ของ SAC นำเข้าด้วยคำสั่ง `IMPORTSUBASSEMBLIES` |

- ทบทวนหน้าที่ของแต่ละไฟล์: `.cs` + `.csproj` ใช้แค่ตอน build เท่านั้น ส่วน `.csproj` คือสูตรการ build (target framework, x64,
  path ของ DLL อ้างอิง, ชื่อ DLL ที่ได้, การ copy หลัง build) **`.dll` กับ `.atc` (และไอคอน) ต้องส่งไปให้ Civil 3D คู่กันเสมอ**

### [idea: export เป็น .pkt]
- .pkt = zip ที่มี flowchart `.xaml` ของ SAC + `.atc` + รูป รันใน Civil 3D ได้โดยไม่ต้อง compile → สร้างบน cloud ได้ทั้งหมด
- ข้อจำกัด: Autodesk ไม่ได้เปิดเผยรูปแบบ XAML (ต้องแกะเอง), ใช้ได้เฉพาะ geometry และ logic แบบ condition tree ที่ทำในเว็บ
  **ไม่รองรับ .cs ที่เขียนมือแล้ว import เข้ามา** และทำงานช้ากว่า subassembly แบบ .NET
- ทดลองครั้งแรก: สร้าง subassembly ง่าย ๆ ใน SAC (สี่เหลี่ยมกับ Decision หนึ่งอัน) แล้ว save เป็น .pkt จากนั้นเปลี่ยนนามสกุลเป็น .zip แล้วดูไฟล์ .xaml ข้างใน

---

## 5. ตัวสร้างไอคอน [decided]
- render รูปตัดของ subassembly (ที่ค่า default) ออกมาเป็น PNG ใช้เป็นไอคอนของเครื่องมือ
- user ตกแต่งต่อในเว็บได้ (สี ข้อความ ลูกศร) หรืออัปโหลดรูปจากข้างนอกแทน
- ระบบปรับขนาดให้ตรงกับที่ .atc ต้องการเอง
- ใช้ style ของข้อ 1 ตอน render ได้ (สี / hatch) แต่ไม่เอา note / dimension

---

## 6. หน้าต่าง AI chat ในแอป [decided: แบบ ก — รายละเอียดยังต้องคุย]
### แบบ ก (แนวทางที่เลือก)
- user login เข้าเว็บของเรา แล้วใส่ **API key ของตัวเอง** (สร้างได้ที่ Anthropic Console)
- ค่าใช้งานไปเก็บที่บัญชี API ของ user (คิดตามจำนวนที่ใช้จริง แยกจากแพ็กเกจ Claude Pro/Max)
- server ของเราเก็บ key แบบเข้ารหัสแล้วเป็นผู้เรียก Claude API ห้ามวาง key ไว้ในโค้ดฝั่งเบราว์เซอร์
- ใช้ API ตามปกติไม่ต้องทำข้อตกลงพิเศษกับ Anthropic แค่ทำตาม Commercial Terms และ Usage Policy
  (การให้ login ด้วยบัญชี Claude แบบ subscription แล้วไปใช้ในแอปของบุคคลที่สามมีข้อจำกัด ต้องตรวจเงื่อนไขล่าสุดก่อนพิจารณาทางนี้)
- แบบ ข (ไม่เลือกสำหรับ chat ในแอป): user เชื่อม MCP server ของเรากับแอป Claude ของตัวเอง → chat อยู่ในแอป Claude ไม่ได้อยู่ใน UI ของเรา
- [open] ทาง MCP ที่ทำเสร็จแล้วใน prompt-6 (localhost `/mcp`, ไม่ต้องมี key, ทุกการแก้เป็น proposal ให้ user กดรับ)
  ยังใช้ได้คู่กัน → จะเก็บทั้งสองทางไหม

### กลไกการแก้แบบ (อธิบายเพิ่ม)
- Claude แก้แบบ**ได้** ผ่าน tool ใน MCP ที่เรามีอยู่แล้ว
- กลไก: Claude ส่ง tool call ออกมา (เช่น `add_link(from: P1, to: P2, code: "Top")`) แล้ว**แอปของเราเป็นผู้รันคำสั่ง**
- ลำดับ: chat panel → server ของเรา → Claude API (พร้อมรายการ tool) → tool call กลับมา → แอปนำไปแก้แบบ
- รูปแบบการนำไปใช้เป็นทางเลือกในการออกแบบ [open]:
  - แก้ทันที + ปุ่ม Undo ทีเดียวสำหรับทุกอย่างที่ Claude ทำในรอบนั้น หรือ
  - แสดงตัวอย่างก่อน แล้ว user กดยืนยัน (แบบ proposal ที่มีอยู่แล้วในแท็บ AI)

### แคปรูปแล้วให้วาดตาม (กรณีใช้งานที่วางแผนไว้)
- user วางภาพแคปรูปตัด → Claude อ่านภาพ (vision) แล้ววาดตามด้วย tool ของเรา โดยใช้ขนาดตามที่ระบุในภาพ
- ได้ผลดีที่สุดเมื่อรูปมีตัวเลขบอกระยะ (12.50, 1:2.5 ...) เพราะอ่านตัวเลขได้แม่นกว่าการกะระยะจากขนาดภาพ
- ส่วนที่ไม่มีตัวเลขกำกับ Claude ต้องประมาณเอง → user ต้องตรวจสอบ
- (ตรงกับการ์ด Trello "วาดตามรูปสเก็ตช์" ที่พักไว้)

### [idea: tool สำหรับอ่านแบบกลับ]
- tool ที่ให้ Claude **อ่านสถานะของแบบปัจจุบัน** (รายการ point พร้อมพิกัด, link, shape, code, พารามิเตอร์)
  และอาจรวมถึงภาพ render ของ workspace
- ทำให้ Claude ตรวจและแก้งานของตัวเองได้ (วาด → อ่านกลับ → เทียบกับภาพต้นฉบับ → แก้)
- หมายเหตุ: MCP ปัจจุบันมี `sa_describe`, `sa_get_spec`, `sa_render` อยู่แล้ว — อาจเป็นแค่การต่อยอด

---

## 7. Layout ของ UI [decided ทิศทางแล้ว — ยังไม่เริ่มออกแบบ]
- ด้านบน: **Ribbon** แบ่งเป็น Tab → Panel → Command (คุ้นมือ user ของ Civil 3D)

### ร่าง Ribbon [decided 14 พ.ย. — รายละเอียดในแต่ละ panel ยังปรับได้]
Tab ที่เห็นตลอด:
| Tab | Panel → คำสั่ง | ที่มา |
|---|---|---|
| **Home** | Project: New, Open, Save, Pack · Import: .cs · Assembly: New assembly, Add subassembly, Edit · Clipboard / Undo | มีแล้ว + Pack (ข้อ 8) |
| **Browser** | เปิด palette Browser, เพิ่มโฟลเดอร์ root, บันทึกเข้าคลัง, อัปเดตจากคลัง | ข้อ 2 |
| **Annotate** (แยก tab) | Note · Dimension (แนวนอน / แนวตั้ง / ตามแนว) · ชื่อ code | ข้อ 1b, 1c |
| **View** | Fit, Zoom · โหมด Design / Civil 3D preview · เปิดปิด style / note / code · VE · **dropdown Scenario ปัจจุบัน** (Default / กรณี 1 / …) · เปิดปิด palette | มีแล้ว + ข้อ 1, 8 |
| **Output** | Build DLL, Source package, .atc · Icon · รายงาน · แก้โค้ด (`Ctrl+E`) | ข้อ 3–5 |
| **AI** (แยก tab) | เปิด chat, แคปรูปให้วาดตาม, proposals (รับ / ไม่รับ), ตั้งค่า key / เชื่อม Claude | ข้อ 6 |

Contextual tab — โผล่เฉพาะตอน Edit subassembly (แบบ Civil 3D):
| Tab | Panel → คำสั่ง |
|---|---|
| **Draw** | Draw: Point, Link, Polygon, Shape, Arc · Surface: Extend to Surface, Clipped Surface Link, Daylight Cut/Fill · Construct: Intersect, Offset, Fillet, Auxiliary (`X`) |
| **Modify** | Move, Copy, Rotate, Mirror, Array / Loop, Delete |
| **Logic** | Parameters · Variables · Conditions tree · Draw into branch (`B`) |
| ปุ่มท้ายแถบ | **Save (.cs)** · **ออกจาก Edit** (เหมือนปุ่ม Finish ของ contextual tab ใน Civil 3D) |

ไม่อยู่ใน ribbon:
- แถบล่าง: Grid, Ortho, OSNAP, tracking, slope preset (เหมือน AutoCAD)
- palette (เปิดค้างได้): workspace tree, properties, Scenarios, Style by code, Browser, AI chat — ribbon มีแค่ปุ่มเปิดปิด

- ซ้ายและขวา: **ระบบ palette** ที่ dock, ย้าย และเปิดปิดได้ (แบบ palette ของ AutoCAD)
- ด้านล่าง: snap bar + ผลการ build และ warning
- feature ที่ต้องหาที่วาง: object tree, รายการคลัง (ข้อ 2), Display / Style by code + โหมดการดู (ข้อ 1), properties,
  AI chat (ข้อ 6), หน้าต่าง Build/Export และรายงาน (ข้อ 3–4), ตัวแก้ไอคอน (ข้อ 5), Pack project (ข้อ 8)
- ขั้นต่อไป: **คุยทุกข้อให้จบก่อน แล้วค่อยทำ Figma** เพื่อดูโครงเว็บ จากนั้นค่อยมาดูตำแหน่งด้วยกัน
  (Figma มี MCP server ที่ให้ Claude Code อ่านแบบได้ → ส่งต่อไปเขียนโค้ดได้ลื่น)
- ข้อสังเกตตอนเขียนโค้ด: ใช้ library สำเร็จรูปสำหรับระบบ dock (เช่น dockview) แทนการเขียนเองตั้งแต่ศูนย์

---

## 8. การเก็บข้อมูล — เปิดไฟล์ที่ไหนก็ได้ [decided 14 พ.ย.]
### ปัญหาของตอนนี้ (เช็กจากไฟล์จริง)
- path ของ .cs ในไฟล์โปรเจกต์ผูกกับโฟลเดอร์ที่ server รันอยู่ → ย้ายโปรเจกต์ไปโฟลเดอร์อื่นแล้วหาไฟล์ไม่เจอ
- spec ถูกเก็บซ้ำ 2 ที่: ใน `.assembly.json` (`spec`, `savedSpec`) และบรรทัด `// sa-spec:` ใน .cs → อาจไม่ตรงกัน
- scenarios อยู่ใน localStorage (`sav2.scenarios`) → เปลี่ยนเครื่องหรือเบราว์เซอร์แล้วหาย

### โครงแบบ "โฟลเดอร์โปรเจกต์" (คล้าย eTransmit + xref ของ AutoCAD)
```
SR03\                          ← ย้าย / copy / zip ไปไหนก็ได้
├─ SR03.assembly.json          ← ไฟล์โปรเจกต์
├─ SR03.style.json             ← style ตาม code (ข้อ 1a)
├─ pavement-assembly.cs        ← spec + note / dimension / override ฝังในนี้
├─ pavement-assembly.png       ← thumbnail / ไอคอน
├─ body_rock-pitching-web.cs
└─ build\                      ← DLL, .atc (สร้างใหม่ได้ ไม่ต้องส่งต่อ)
```

### กติกา
| # | กติกา | แก้อะไร |
|---|---|---|
| 1 | **.cs เป็นต้นฉบับของ spec ที่เดียว** ไฟล์โปรเจกต์เก็บแค่ชื่อไฟล์, params, จุดต่อ, scenario — ไม่เก็บ spec ซ้ำ | spec ซ้ำ 2 ที่ |
| 2 | **path ทุกตัว relative จากไฟล์โปรเจกต์** ห้ามมี `D:\...` | ย้ายโฟลเดอร์ไม่ได้ |
| 3 | **scenarios ย้ายเข้าไฟล์โปรเจกต์** | scenarios หาย |
| 4 | **ค่าเฉพาะเครื่องอยู่ในการตั้งค่าแอป ไม่อยู่ในโปรเจกต์**: path Civil 3D, โฟลเดอร์คลัง, ไฟล์ล่าสุด, layout ของ palette | ไม่ติดค่าเครื่องเดิม |
| 5 | **ไฟล์หายต้องไม่พัง**: เตือน + ปุ่ม "หาไฟล์ใหม่" (เหมือน relink xref); style หาย → ใช้สีมาตรฐาน | เปิดได้เสมอ |
| 6 | **ไฟล์มี `version`** (มีอยู่แล้ว) แอปรุ่นใหม่แปลงไฟล์เก่าให้เอง | ไฟล์เก่ายังเปิดได้ |

### ที่เก็บของแต่ละอย่าง
| ข้อมูล | เก็บที่ |
|---|---|
| geometry, logic, parameter (spec) | .cs (`// sa-spec:`) |
| note, dimension, override style ทีละ object | .cs (spec ส่วน `display`) → ติดไปกับไฟล์เมื่อเอาเข้าคลัง |
| style ตาม code | `{ชื่อ}.style.json` — ไฟล์โปรเจกต์**ชี้ไป**ที่ไฟล์ style (ค่าเริ่มต้นชื่อเดียวกับโปรเจกต์ หรือชี้ไปไฟล์กลางแบบ template เช่น `DPT-standard.style.json`) |
| รายการ subassembly, params, จุดต่อ, ผิวดิน, scenario, ค่าแถบล่าง | `{ชื่อ}.assembly.json` |
| ค่าเฉพาะเครื่อง | การตั้งค่าแอป |

### การพกไปใช้ 3 ระดับ
- **.cs ไฟล์เดียว** → subassembly ครบ (รวม note / dimension)
- **ทั้งโฟลเดอร์** → ทั้งโปรเจกต์
- **ปุ่ม "Pack project"** → zip ไฟล์เดียว รวม style กลางที่อยู่นอกโฟลเดอร์ด้วย (แบบ eTransmit) — ใช้กับเว็บบน cloud ในอนาคตได้ (อัปโหลด zip)

### Scenarios — ออกแบบใหม่ [decided 14 พ.ย.]
- **ตอนนี้ (เช็กจากโค้ด `ui.js`):** เก็บใน localStorage `sav2.scenarios` กองเดียวรวมทุกโปรเจกต์ · หนึ่ง scenario = **snapshot ทั้ง workspace**
  (`projContent()`: ทุก item, params, จุดต่อ, ดิน และน่าจะรวม spec) · กดเปิด = แทนที่ workspace ทั้งก้อน
  → เสี่ยงว่าเปิด scenario เก่าแล้วรูปที่วาดย้อนกลับ — ให้ Claude Code ตรวจยืนยันก่อน
- **ที่ควรเป็น:** scenario เก็บแค่ส่วนที่ต่างจาก default: เส้นดิน + params ที่เปลี่ยน (ราย subassembly) + โหมด (Layout / ไม่มี target)
  ไม่แตะ geometry / spec · ค่า default อยู่ใน .cs
- เก็บใน `{ชื่อ}.assembly.json` ของโปรเจกต์นั้น (ไม่ใช่ไฟล์แยกต่อ scenario)
  ```json
  "scenarios": [
    { "name": "ตลิ่งสูง", "ground": [[-20, 101.5], [0, 100.0], [15, 98.2]],
      "params": { "body": { "Hcrest": 3.5 } }, "mode": "normal" },
    { "name": "Layout", "mode": "layout" }
  ]
  ```
  (`params` แยกตาม id ของ subassembly ในโปรเจกต์ → ใช้ข้ามโปรเจกต์ตรงๆ ไม่ได้)
- ของเสริม: Export / Import ทีละกรณีเป็น `{ชื่อกรณี}.scenario.json` ไว้แชร์
- [idea: ถ้าดึงรูปตัดดินจริงจาก sample line ใน Civil 3D มาเป็นร้อยกรณี → ย้ายไป `scenarios\*.json` ตอนนั้น] — ยังไม่ทำ
- ใช้งาน: palette Scenarios (คลิก = ใช้กรณีนั้น, บันทึกกรณีปัจจุบัน, อัปเดต, ลบ) + dropdown ใน View tab โดยมี **"Default"** เป็นตัวแรก
  การสลับเปลี่ยนแค่ดินและค่าที่ใช้คำนวณ ไม่ทับงานที่วาดอยู่
- ต้องแปลง scenarios เก่าใน localStorage / `scenarios.json` เข้าโปรเจกต์ (ถาม user ว่ากรณีไหนเป็นของโปรเจกต์ไหน)
- ความสำคัญ: ต่ำสำหรับรูปตายตัว · สูงสำหรับ subassembly ที่มีตัด/ถม, Daylight, Extend to Surface, Loop
  (Logic tab เตือนกิ่งที่ยังไม่มี scenario, `sa_check` ของ AI รันทุก scenario)

### ผลที่ต้องยอมรับ / งานที่ต้องเพิ่ม
- ตัดสำเนา spec ออกจากไฟล์โปรเจกต์ → ถ้า .cs หาย subassembly ตัวนั้นเปิดไม่ได้ (ใช้ Pack เป็นวิธีส่งต่อที่ปลอดภัยแทน)
- server ต้องเปิดโปรเจกต์จากโฟลเดอร์ไหนก็ได้ (ตอนนี้อ่านได้แค่ในโฟลเดอร์ของแอป)
- ต้องแปลงไฟล์โปรเจกต์รุ่นเก่า (มี spec ฝัง) ให้อัตโนมัติ — ถ้า spec ในโปรเจกต์ไม่ตรงกับใน .cs ให้ถามผู้ใช้ก่อน

---

## ไอเดียเรื่องวิธีทำงาน (12 พ.ย.)
- [idea: แยก sub agent ตามหมวด] แต่ละหมวด (1–7) มี sub agent ของตัวเองใน Claude Code
  ต้องคิดก่อนว่าในเว็บมี palette หรือ tab อะไรบ้าง แล้วผูก agent กับส่วนนั้น
- [idea] หลังคุยครบทุกข้อ → ทำ Figma ดูโครงเว็บ (ข้อ 7)
- งานค้างใน Trello ที่ยังไม่อยู่ในลำดับ: วาดตามรูปสเก็ตช์ (→ ข้อ 6), แยก core / host

---

## ลำดับงาน [decided 14 พ.ย.]
| รอบ | งาน | เหตุผล |
|---|---|---|
| 7 | Build + รายงาน + .atc + Source package (ข้อ 3–4) | ใช้ใน Civil 3D ได้ทันที |
| 8 | การเก็บข้อมูล (ข้อ 8): โฟลเดอร์โปรเจกต์, relative path, spec ใน .cs ที่เดียว, scenario แบบใหม่, Pack, relink | วางโครงไฟล์ให้นิ่งก่อนสร้างไฟล์ใหม่ (`.style.json`, `lib\`) + แก้ความเสี่ยง scenario ทับรูป |
| 9 | โครง UI ใหม่ (ข้อ 7): Ribbon, contextual tab, palette ที่ dock ได้ | ฟีเจอร์ถัดไปต้องมีที่วาง palette · **ส่ง Figma ให้เสร็จก่อนรอบนี้** |
| 10 | Web display (ข้อ 1) | ต่อยอดปุ่ม c3d + ใช้ `.style.json` จากรอบ 8 |
| 11 | ตัวสร้างไอคอน (ข้อ 5) | ใช้ style จากรอบ 10 + เสียบเข้า .atc ของรอบ 7 |
| 12 | Browser (ข้อ 2) | ใช้กติกา copy เข้า `lib\` (รอบ 8) + palette (รอบ 9) |
| 13 | AI chat ในแอป (ข้อ 6) | ใหญ่ ต้องตัดสินเรื่อง key ก่อน · ทาง MCP ใช้ได้อยู่แล้ว |

แทรกได้ทุกเมื่อ: ทดลอง .pkt · หน้าตั้งค่าแอป (คู่กับรอบ 8 หรือ 12)
ทางเลือก: สลับรอบ 10 ขึ้นก่อน 9 ได้ ถ้าอยากเห็นฟีเจอร์ก่อน (Style by code อยู่แผงขวาชั่วคราว)
Wireframe ของทุกข้อ: Design canvas "SA Drawing Studio — UI wireframe" (claude.ai)
