# CLAUDE.md — อ่านไฟล์นี้ก่อนทำงานทุกครั้ง (Claude Code โหลดไฟล์นี้อัตโนมัติ)

## โปรเจกต์
**SA Drawing Studio (Subassembly Viewer)** — เว็บ localhost (ASP.NET + JS) สำหรับ
1) ดูรูปร่าง subassembly จากไฟล์ .cs ของ Civil 3D 2027 โดยคอมไพล์ด้วย Roslyn แล้วรันกับตัวจำลอง API (`SA.Civil3DShim`) และลากเส้น surface ทดสอบทุก case
2) วาด subassembly แบบ AutoCAD / SAC แล้วสร้างไฟล์ .cs ให้ (`SA.Web/Drawing/CodeGenerator.cs`, spec อยู่ใน `SA.Web/wwwroot/js/spec.js`)
รายละเอียดการใช้งานทั้งหมดอยู่ใน `README.md`

ผู้ใช้: Soravis วิศวกรโยธา/แหล่งน้ำ คุ้น AutoCAD / Civil 3D / Subassembly Composer (SAC) มาก ถนัด Python มากกว่า C# — **คุยและรายงานเป็นภาษาไทย**

## เครื่องที่ใช้
**ตั้งแต่ 2026-11-02 ใช้เครื่องบ้านเครื่องเดียว** (ผู้ใช้แจ้ง) — เครื่องนี้ไม่มี Civil 3D และยังไม่มี `node` (ดูหัวข้อ ทดสอบ)
ข้อด้านล่างเก็บไว้เผื่อกลับไปใช้สองเครื่อง

| เครื่อง | โฟลเดอร์ |
|---|---|
| บ้าน (desktop-gk62kqm) — **ใช้อยู่** | `D:\test_cad\Subassembly-WebViewer` |
| ที่ทำงาน (desktop-3l6r773, มี Civil 3D) — เลิกใช้ชั่วคราว | `D:\Yo\Subassembly-WebViewer` |

- ที่เดียวที่ข้อมูลตรงกันคือ **git (`origin` = github.com/soravisAmn/Subassembly-WebViewer, branch `main`)** — Claude Code แต่ละเครื่องไม่รู้ว่าอีกเครื่องคุยอะไรไป
- **เริ่ม session**: `git status` + `git fetch` → ถ้า `origin/main` ใหม่กว่า ให้บอกผู้ใช้แล้ว pull ก่อนทำงาน; ถ้ามีไฟล์ค้างแก้ ให้สรุปให้ผู้ใช้ดูก่อน
- **จบงาน / ก่อนผู้ใช้ย้ายเครื่อง**: เสนอ commit + push (ต้องได้รับอนุญาตทุกครั้ง) และอัปเดตหัวข้อ "สถานะล่าสุด" ด้านล่าง
- เรื่องที่ตกลงกันในแชทต้องเขียนลงไฟล์ (prompt-*.md / README / ไฟล์นี้) ไม่งั้นอีกเครื่องไม่รู้

## กติกา
- ไฟล์ข้อความใช้ **CRLF**, ข้อความ UI และคอมเมนต์เป็นภาษาไทย
- server ฟังแค่ localhost; ห้ามทำโหมด/ฟีเจอร์เดิมพัง
- ห้ามแก้ไฟล์ .cs ของผู้ใช้ (ที่ root เช่น `base_rock-pitching.cs`, `pavement-assembly.cs`) ระหว่างทดสอบ — copy ไปทดสอบที่อื่น
- ห้าม commit / push / สร้าง branch เองจนกว่าผู้ใช้อนุญาต
- ทุก milestone: รัน test ทั้งหมด (ด้านล่าง), อัปเดต README, บอกผู้ใช้ว่าต้องเปิด `run-viewer.bat` ใหม่หรือแค่ Ctrl+F5
- shortcut ใหม่ต้องอยู่ในตาราง `?` และไม่ชนของเดิม; ตัวเลือกระหว่างคำสั่งชนะ shortcut ทั่วไป
- ห้ามเพิ่ม API ปลอมใน shim ที่ Civil 3D จริงไม่มี (อ้างอิง: `link-API-Reference.txt`) — link ใน Civil 3D เป็นเส้นตรงเท่านั้น

## ทดสอบ
- `dotnet run --project SA.Tests` (รวมเทียบผล JS กับ C# ที่สร้าง ต้องมี `node`)
- `node SA.Tests/js/<ชื่อ>.test.js` ทุกไฟล์ในโฟลเดอร์ `SA.Tests/js`
- ยังไม่มี node: รัน test JS ในเบราว์เซอร์ (จำลอง `require` ของ fs / path / vm) และป้อนผล `eval-cli.js` ที่คำนวณในเบราว์เซอร์ให้ `dotnet run --project SA.Tests`
  ผ่านตัวแทน `node.exe` ชั่วคราว — วิธีที่ใช้ใน M0 รอบ 4 (ดู `prompt-4-design.md`) · ติดตั้ง node แล้วไม่ต้องทำแบบนี้
- ชุดทดสอบใน Civil 3D จริง: `tests-civil3d/` (ต้องมีเครื่องที่มี Civil 3D)

## สถานะล่าสุด (อัปเดตทุกครั้งที่จบ milestone)
- รอบ 1 (`prompt.md`), รอบ 2 (`prompt-2.md`), รอบ 3 + 3b (`prompt-3.md`, `prompt-3b.md`) — **เสร็จแล้ว** (commit `ha`)
- ยังไม่ได้ทดสอบ `tests-civil3d/round3-demo.cs`, `round4-demo.cs`, `round4c-base.cs`, `round4c-body.cs` ใน Civil 3D จริง (เครื่องนี้ไม่มี Civil 3D · round4b-demo ถูกลบไปพร้อม Max / Min)
- **รอบ 4 `prompt-4.md` เสร็จแล้ว** — M0 เสร็จ (2026-11-02): ข้อเสนอ + คำตอบผู้ใช้อยู่ใน `prompt-4-design.md` (ตอบ "ตามที่เสนอ" ทุกข้อ), จัดระเบียบ repo แล้ว (เลิก track bin/obj · ยังเหลือของที่ควรลบ ดูไฟล์นั้น)
  M1 เสร็จ (2026-11-02): นิพจน์เงื่อนไข + P3.x/y, ground(), exists(), hasGround() ใน JS / C# (test: `cond.test.js`, `ExprTests.cs`, drawing-cases 31–35)
  M2 เสร็จ (2026-11-02): กิ่ง if / switch / ซ้อน + `firstOf` ใน JS / C# + UI ขั้นต่ำ "เกิดเมื่อ" ใน Properties (test: `logic.test.js`, ExprTests "กิ่ง -> C#", drawing-cases 36–44)
  - ตกลงระหว่างทำ: firstOf เป็น auxiliary → link จริงหลังกิ่งต้องต่อจากจุดในแต่ละกิ่งเอง (ยังไม่มี "จุดแทน" ที่ AddLink ได้)
    — **รอบ 4c M3 เปลี่ยนแล้ว**: firstOf aux = "ปลายจริง" เป็นปลาย link จริงได้ (ถ้าจุดในรายการเป็นจุดจริงทั้งหมด)
  - object ที่ไม่เกิดถูกซ่อน (เลือกบนรูปไม่ได้จนกว่าจะเกิด) — "แสดงทุกกรณี" อยู่ M4
  M3 เสร็จ (2026-11-02): ปุ่ม "ถ้าตัด / ถม" ใน drawer (`Spec.addCutFill` + หน้าต่างใน ui.js; test: `logic.test.js`, drawing-cases 45–49)
  M4 เสร็จ (2026-11-02): แท็บ Logic (ค่าสด, ต้นไม้กิ่ง, เปลี่ยนชื่อ / ลบ), แสดงทุกกรณี (`evaluate` + `allBranches`), ป้ายกิ่งในต้นไม้, scenario ครอบคลุมกิ่ง, B = วาดลงกิ่ง, เกิดเมื่อหลายชิ้น
  M5 เสร็จ (2026-11-02): ข้อ 6 (ไฟล์ที่แก้เองนอกช่วง + กิ่ง — test ใน DrawingTests), codelink ของเงื่อนไข / กิ่ง (แท็บ Logic → โค้ด, เคอร์เซอร์บรรทัดกิ่ง → object),
  `tests-civil3d/round4-demo.cs` + `round4-checklist.md` (+ drawing-cases 50–54) → **รอบ 4 จบ** รอทดสอบใน Civil 3D
  ข้อเสนอที่ยังไม่ทำ (prompt-4 ข้อ 6): แสดงในแท็บ Logic ว่าโค้ดที่เขียนเองเข้า if บรรทัดไหน — งานแยก ถ้าผู้ใช้ต้องการ
  รอบ 4b M0 เสร็จ (2026-11-02): ข้อเสนอ + คำตอบใน `prompt-4b-design.md` (ปุ่มชื่อ "Max / Min" · เลือกได้ว่าคุม ระยะดิ่ง / ตั้งฉากผิวดิน / ความยาว / ระยะราบ · ตัวอย่าง = base_rock-pitching)
  รอบ 4b M1 เสร็จ (2026-11-02): `p.limit` ใน evaluate (spec.js limitPt / setLimit / limitOptions) + C# `Limit()` + `limited()` + Properties ขั้นต่ำ
    (test: `limit.test.js`, drawing-cases 55–60, DrawingTests เทียบ base_rock-pitching.cs, ExprTests "Max / Min -> C#")
  รอบ 4b M2 เสร็จ (2026-11-02): ปุ่ม "Max / Min" ใน drawer + หน้าต่างถามเป็นประโยค (ชิดขวา) + พรีวิวสด (ข้อความ + เส้นประขอบ / ลูกศรบนรูป) — `js/limit.js`
  รอบ 4b M3 เสร็จ (2026-11-02): ไอคอน ↕ + เส้นขอบตอนเลือกจุด, Properties ประโยคสรุป, แท็บ Logic → Max / Min (สถานะสด + scenario), Delete ถาม, Rotate ไม่ให้หมุนจุดที่มี Max / Min,
    branchRisks นับจุดที่ Max / Min อ้าง, README ตาราง "ใช้อันไหนเมื่อไร", `tests-civil3d/round4b-demo.cs` + `round4b-checklist.md` (drawing-cases 61–66) → **รอบ 4b จบ** รอทดสอบใน Civil 3D
  รอบ 4c M0 เสร็จ (2026-11-07): ข้อเสนอ + คำตอบใน `prompt-4c-design.md` (ชื่อปุ่มเป็นอังกฤษ: Daylight Cut/Fill, Extend to Surface, Clipped Surface Link, Intersect, Offset, Array + เปลี่ยนชื่อปุ่มเดิม · ข้อความอื่นยังไทย · Offset ติ๊ก Aux เอง · Intersect ถามตัด/ไม่ตัดทุกครั้ง)
  รอบ 4c M1 เสร็จ (2026-11-07): เอา Max / Min ออก (commit แยก `ea9dd1a` — ของเก่าตัดทิ้งตอนโหลด + แจ้งครั้งเดียว · `limited()` = "ไม่มีฟังก์ชัน"),
    ตาราง Parameter: `positive` (ต้องมากกว่า 0 → Severe + default) + ขั้นต่ำ / ขั้นสูง + เตือน default ขัดขอบเขต + ปุ่ม Parameter บนหัว Properties (`Spec.setParamBounds` / `paramBoundsIssue`),
    ชื่อปุ่มอังกฤษ (Daylight Cut/Fill, Slope to Surface, Follow Surface, Regular Polygon, Cut at Level, My Shapes) + คำอธิบาย / ภาพในหน้าต่าง Daylight Cut/Fill
  รอบ 4c M2 เสร็จ (2026-11-07): ชนิดจุด `offset` (JS + C# `Offset()`), `Spec.addOffset` / `addIntersect`, เครื่องมือ Intersect (`I` — หน้าต่าง T ตัด/ยืด · N ไม่ตัด · ไม่มี default)
    + Offset (`O` — ระยะเป็นนิพจน์ / parameter, คลิกด้าน, ทำซ้ำได้, X = aux), Properties จุด offset (แก้คู่พร้อมกัน), Move ตามเอง
    (test: `offset.test.js` เทียบ ParallelY ของ body_rock-pitching, drawing-cases 58–60)
  รอบ 4c M3 เสร็จ (2026-11-07): Extend to Surface — ชนิดจุด `extendToGround` (ไม่ลอย / ไม่มีดิน = off `Spec.GROUND_OFF` เงียบ) + C# `ExtendToGround()`,
    link `optional` ใน shape (C# `Opt()`), **ปลายจริง** = firstOf aux เป็นปลาย link จริงได้ (`Spec.isAlias` / `auxEnd` · C# alias Point var), `Spec.addExtendToGround`
    (rewire เส้นที่ต่อที่ปลายไปปลายจริง + แทรกใน shape), ปุ่มกลุ่ม Surface + หน้าต่าง, Properties (test: `extend.test.js`, drawing-cases 61–67)
  รอบ 4c M4 เสร็จ (2026-11-07): Clipped Surface Link — link `followClipped` (`refLink` | `refLevel` แบบ flat ไม่ใช่ `ref: {}` ตามร่าง, side below/above,
    codes / codesGround / codesLine) = `Spec.clipPath` + C# `FollowClipped()` (Link[]), `Spec.addFollowClipped`, ปุ่ม + หน้าต่าง + Properties
    · DrawingTests เทียบ code ของ link แล้ว (test: `clip.test.js` เทียบ BuildBottom, drawing-cases 68–74)
  รอบ 4c M5 เสร็จ (2026-11-07): Array — `spec.arrays` + `Spec.addArray` / `updateArray` / `rebuildArray` / `arrayOf` (ชุดที่ k = delta จากจุดเดียวกันของชุดก่อน,
    n = ชุดทั้งหมดรวมต้นฉบับ, join share (จุดร่วม — ขั้นบันได) | link), ปุ่ม Geometry + หน้าต่าง + Properties "Array A1", ลบสมาชิก = ถามแล้วเลิกเป็น Array
    · ไม่แตะ C# (test: `array.test.js`, drawing-cases 75–76)
  รอบ 4c M6 เสร็จ (2026-11-07): วาด base / body rock-pitching ใหม่ด้วยเครื่องมือเท่านั้น → `tests-civil3d/round4c-base.cs` / `round4c-body.cs` (+ .assembly.json, `round4c-checklist.md`)
    ลำดับการกด = `buildBase()` / `buildBody()` ใน `SA.Tests/js/rockpitching.test.js` · `SA.Tests/RockPitchingTests.cs` รันคู่กับไฟล์จริง: 15 ผิวดิน × Right / Left × 4 ชุดค่า
    = จุด / link / shape / code ตรงกัน (ต่างที่รู้แล้ว: body เส้นปิดปลายชนดินเลย origin — ตาราง "ต่างกันตรงไหน" ใน README)
    · แก้บั๊ก M2: Offset ระยะเป็นนิพจน์บวก / ลบ ใน C# ขาดวงเล็บ (drawing-case 77) → **รอบ 4c จบ** รอทดสอบใน Civil 3D (`round4c-checklist.md`)
  รอบ 4d เสร็จ (2026-11-07): ลากปรับความกว้างแถบซ้าย / ขวา (`js/panes.js` · `--lw` / `--rw` · `state.leftW` / `rightW` · ดับเบิลคลิก = 280 / 300 · workspace ≥ 320) + tooltip ชื่อเต็มในต้นไม้
  ถัดไป: **`prompt-5.md`** (Logic API + มุมมองข้อความ + ต้นไม้ Conditions ในแถบซ้ายแทน flowchart + Variables) — ยังไม่เริ่ม · แล้ว prompt-5b (Loop ต่อยอด Array — ยังไม่มีไฟล์) → prompt-6 (MCP) · flowchart เลื่อนไปทำพร้อมเว็บสาธารณะ (`prompt-flowchart-later.md`) · แผนงานรวมอยู่ใน Trello บอร์ด "SA Drawing Studio"

## แผนต่อจากนี้ (ตกลงกับผู้ใช้แล้ว)
1. prompt-4: Logic ก (ข้างบน)
2. prompt-5 (ฉบับย่อ): Logic API + มุมมองข้อความ + Switch ในแท็บ Logic — flowchart แบบ SAC เลื่อนไปทำพร้อมเว็บสาธารณะ (ต้องแก้ **ข้อมูลชุดเดียวกับ ก** เสมอ)
3. prompt-6: MCP server ให้ Claude Desktop / Claude Code สั่งเว็บได้ (อ่าน/แก้ spec, compile, รัน scenario) — AI ช่วยทำ logic ซับซ้อนแทนการวาด flowchart เอง
4. ทีหลัง: เว็บสาธารณะ (บัญชีผู้ใช้, sandbox การ compile C#, ผู้ใช้ใส่ API key ของ AI เอง, โหมด Chat / Code)
   — โค้ดจึงต้องแยก **core** (spec, evaluator, CodeGenerator, shim, หน้าเว็บ) ออกจาก **host** (localhost, ไฟล์ในเครื่อง, compile ในเครื่อง) ให้ชัด
   แต่ **ยังไม่แยก repo** — ใช้ repo เดียว ผู้ใช้ใช้แบบในเครื่องไปก่อน
