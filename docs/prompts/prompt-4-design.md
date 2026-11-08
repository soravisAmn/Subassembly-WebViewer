# รอบ 4 — ข้อเสนอจาก Milestone 0 (รอผู้ใช้ตอบ)

> เขียนไว้ให้ทั้งสองเครื่องเห็นตรงกัน — คำตอบของผู้ใช้จะบันทึกต่อท้ายไฟล์นี้ (หัวข้อ "ตกลงแล้ว")

## สถานะตอนเริ่ม (เครื่องบ้าน 2026-11-02)

- `git fetch`: `main` ตรงกับ `origin/main` (commit `ha`) ไม่ต้อง pull
- ไฟล์ค้างแก้: `pavement-assembly.cs` (ของผู้ใช้ ไม่แตะ) · ยังไม่ได้ track: `CLAUDE.md`, `prompt-4.md`, `TEST.assembly.json`, `.claude/launch.json`
- test เดิมผ่านทั้งหมด (เครื่องนี้ไม่มี node จึงรัน test JS ในเบราว์เซอร์ และใช้ผล `eval-cli.js` ที่คำนวณในเบราว์เซอร์แทน node ตอนรัน `dotnet run --project SA.Tests`):
  - C#: **50 / 50** (รวม 31 กรณีเทียบผล JS กับโค้ด C# ที่สร้าง)
  - JS: arc 19, auxiliary 11, evaluator 16, history 6, ops 9, polygon 12, rot 15, select 6, snap 17, track 14, view 6 = **131 / 131**

---

## 1. จัดระเบียบ repo (ยังไม่ได้ทำ — รออนุญาต)

ตอนนี้: bin/obj ถูก track **177 ไฟล์** (จาก 256), ไม่มี `.gitignore` / `.gitattributes`
เครื่องบ้านตั้ง `core.autocrlf = true` จึงไม่เห็นปัญหา CRLF แต่เครื่องที่ทำงานน่าจะไม่ได้ตั้ง (จึงเห็น `git diff` ทั้งไฟล์)

| ขั้น | ทำอะไร |
|---|---|
| 1 | `.gitignore`: `bin/` `obj/` `.vs/` `*.user` `*.suo` `.claude/launch.json` (ถ้าผู้ใช้เลือก ignore) `.claude/settings.local.json` |
| 2 | `git rm -r --cached` เฉพาะ bin/obj (ไฟล์ในเครื่องยังอยู่) |
| 3 | `.gitattributes`: `* text=auto eol=crlf` + ไฟล์ binary (`*.dll *.exe *.pdb *.png *.jpg *.ico *.zip`) + `link-API-Reference.txt -text` (git มองว่าเป็น binary อยู่แล้ว ให้คงไว้ตามเดิม) |
| 4 | `git add --renormalize .` (ในที่เก็บเป็น LF อยู่แล้ว คาดว่าไม่มีไฟล์เปลี่ยนเนื้อหา) |
| 5 | commit แยก "จัดระเบียบ repo" — ไม่ปนงาน logic · ไม่รวม `pavement-assembly.cs` / `TEST.assembly.json` ของผู้ใช้ |

**เครื่องที่ทำงานหลัง pull:**
1. ก่อน pull: ปิด `run-viewer.bat` · มีไฟล์ค้างแก้ให้ commit หรือ `git stash` ก่อน
2. `git pull` — git จะ **ลบไฟล์ใน bin/obj ของเครื่องนั้น** (เพราะเลิก track) ไม่เป็นไร เปิด `run-viewer.bat` แล้ว build ใหม่เอง
3. ถ้า `git status` ยังขึ้นไฟล์เปลี่ยนทั้งที่ไม่ได้แก้: `git add --renormalize .` แล้ว `git status` อีกครั้ง (ควรว่าง)

---

## 2. นิพจน์ที่เป็นเงื่อนไข (เสนอ)

ไวยากรณ์ (เหมือนกันทั้ง `expr.js` และ `SpecExpr.cs`) — ลำดับความสำคัญจากต่ำไปสูง:

```
or      := and  ( ("or"  | "||") and )*
and     := not  ( ("and" | "&&") not )*
not     := ("not" | "!") not | cmp
cmp     := sum  ( ("<" | ">" | "<=" | ">=" | "==" | "!=") sum )?      // ต่อกันแบบ a < b < c ไม่ได้ (error)
sum     := term ( ("+" | "-") term )*
term    := unary ( ("*" | "/") unary )*
unary   := ("-" | "+") unary | postfix
postfix := atom ( "." ("x" | "y") )?                                  // P3.x, P3.y
atom    := ตัวเลข | true | false | ชื่อ | "(" or ")" | ฟังก์ชัน "(" ค่า, ... ")" | "ข้อความ" (เฉพาะชื่อ target ใน ground)
```

| ของใหม่ | ความหมาย |
|---|---|
| `> < >= <= == !=` | `==` / `!=` เทียบแบบมี tolerance `1e-6` (ค่าเดียวกันทั้ง JS / C#) |
| `and or not` (`&& \|\| !`) | ตรรกะ — **ลัดวงจร** (`exists(P3) and P3.y > 0` ไม่ error ตอน P3 ไม่เกิด) |
| `if(เงื่อนไข, a, b)` | เลือกค่า (a, b ชนิดเดียวกัน) |
| `P3.x` / `P3.y` | offset / elevation ของจุด เทียบ origin · **x เป็นค่าในกรอบ Right** (เสนอ — ดูคำถามข้อ 2) |
| `ground(P3)` / `ground(P3, "Target")` | ระดับผิวดินที่ offset ของ P3 (เทียบ origin เหมือน `P3.y`) |
| `exists(P3)` | จุดนี้เกิดไหม (อยู่ในกิ่งที่จริง และคำนวณได้) |
| ชื่อเงื่อนไข เช่น `IsCut` | ใช้ในนิพจน์อื่นได้ (ชนิด จริง/เท็จ) |
| `true` / `false` | ค่าคงที่ |

- **ชนิด**: ตรวจตอน parse — ช่องตัวเลข (dx, slope, ...) ใส่ จริง/เท็จ ไม่ได้ และช่องเงื่อนไขใส่ตัวเลขไม่ได้ ไม่แปลงให้เอง
  เช่น `"dx: ต้องเป็นตัวเลข แต่ 'P3.y > 0' ให้ค่า จริง/เท็จ (ตำแหน่ง 1)"`, `"and ต้องใช้กับ จริง/เท็จ แต่ด้านขวาเป็นตัวเลข (ตำแหน่ง 12)"`
- คำสงวน `and or not true false if ground exists` ตั้งเป็นชื่อ parameter / เงื่อนไขไม่ได้ (เพิ่มใน `CodeGenerator.Reserved`)
- นิพจน์ที่อ้างจุด = จุดนั้นต้องคำนวณก่อน → `TopoOrder` / evaluator รู้ (วนกัน = cyclic error เหมือนเดิม)
- **อ้างจุดที่ไม่เกิด / หาไม่ได้** (เช่น `P3.y` ตอน P3 อยู่ในกิ่งที่ไม่จริง) → ผลของเงื่อนไข = **ไม่รู้** → ทุกกิ่งของ decision นั้นไม่เกิด + เตือน
  (ใช้ `exists(P3) and ...` ถ้าต้องการกันไว้เอง)
- **ไม่มีผิวดิน (Layout mode / ไม่ได้กำหนด target)**: เสนอ `ground(P3)` = `P3.y` (ระดับของจุดเอง) + เตือนสีเหลืองแบบที่ลาดจนชนดินทำ
  → `IsCut = ground(P2) > P2.y` เป็นเท็จ = เข้ากิ่ง **ถม** ทั้ง JS และ C# (ตรงกับที่ลาดจนชนดินวาดยาวคงที่ตอนไม่มีดิน)
  และเพิ่ม `hasGround()` ไว้ให้แยกกรณี Layout เองได้ถ้าต้องการ

---

## 3. โครงข้อมูล logic (เสนอ — ปรับจากใน prompt-4)

ต่างจากใน prompt-4 ตรงที่ **กิ่งไม่เก็บนิพจน์ `when` เอง** แต่เป็น "ทางออก" ของโหนด decision —
เพื่อให้มีความจริงชุดเดียว: flowchart (prompt-5) วาดโหนด + ทางออก ใช่/ไม่ใช่ ได้ตรงๆ, AI (prompt-6) แก้ได้โดยไม่มีทางทำให้ "ใช่" กับ "ไม่ใช่" ขัดกัน

```jsonc
"logic": {
  "conditions": [                       // เงื่อนไขที่ตั้งชื่อ ใช้ซ้ำได้ ทั้งใน decision และในนิพจน์อื่น
    { "id": "C1", "name": "IsCut",    "expr": "ground(P2) > P2.y",     "note": "ผิวดินสูงกว่าบานพับ = ตัด" },
    { "id": "C2", "name": "HighFill", "expr": "P2.y - ground(P2) > 3" }
  ],
  "decisions": [                        // โหนดของ flowchart (SAC: Decision / Switch)
    { "id": "D1", "parent": null, "kind": "if",     "test": "IsCut",    "label": "ตัดหรือถม?" },
    { "id": "D2", "parent": "B2", "kind": "if",     "test": "HighFill" },           // ซ้อนอยู่ในกิ่ง "ถม"
    { "id": "D3", "parent": null, "kind": "switch", "test": "Lanes" }               // switch: ยังไม่มี UI แต่โครงรองรับ
  ],
  "branches": [                         // ทางออกของโหนด เรียงตามลำดับที่จะวาดใน flowchart
    { "id": "B1", "decision": "D1", "case": true,   "label": "ตัด" },
    { "id": "B2", "decision": "D1", "case": false,  "label": "ถม" },
    { "id": "B3", "decision": "D2", "case": true,   "label": "ถมสูง" },
    { "id": "B4", "decision": "D2", "case": false,  "label": "ถมปกติ" },
    { "id": "B5", "decision": "D3", "case": 2,      "label": "2 ช่องจราจร" },
    { "id": "B6", "decision": "D3", "case": "else", "label": "อื่นๆ" }
  ]
}
// point / link / shape / กลุ่มหมุน: "branch": "B1"   (ไม่มี = เกิดเสมอ)
```

- **กิ่งเกิดเมื่อ**: กิ่งแม่ของ decision เกิด (หรือ decision อยู่ชั้นบนสุด) **และ** ผล `test` ตรงกับ `case`
  (if: จริง/เท็จ · switch: ค่าเท่ากับ case ด้วย tolerance เดียวกับ `==` · `"else"` = ไม่ตรงกิ่งอื่นเลย) · `test` = ชื่อเงื่อนไข หรือนิพจน์ตรงๆ ก็ได้
- เทียบกับใน prompt-4: กิ่ง `{ "when": "not IsCut" }` = ทางออก `case: false` ของ decision ที่ `test: "IsCut"` — แผง Logic (แบบ ก) ยังแสดงเป็น "เงื่อนไข + กิ่ง" ตามเดิม
- `cond` ที่จองไว้ใน `spec.js`: **ไม่มีไฟล์ไหนใช้** (ค้นทั้ง repo แล้ว) → ลบคอมเมนต์ทิ้ง ใช้โครงนี้แทน
- จุดชนิดใหม่ **`firstOf`** `{ "type": "firstOf", "points": ["P5", "P6"] }` = จุดแรกในรายการที่เกิด
  เสนอให้เป็น **auxiliary โดยปริยาย** (ไม่ `Points.Add` ซ้ำซ้อนกับจุดในกิ่งที่ตำแหน่งเดียวกัน) แต่ปิดได้
- **ไม่เกิดเพราะเงื่อนไข ≠ error**: evaluator เก็บเป็น `{ off: "B1" }` แยกจาก `{ err }` (ไม่ขึ้นแดง ไม่นับเป็นปัญหา)
  - object ในกิ่งเดียวกัน / กิ่งลูก ที่อ้างจุดที่ไม่เกิด = ไม่เกิดตามปกติ
  - object "เกิดเสมอ" (หรือกิ่งอื่น) ที่อ้างจุดในกิ่ง → ตรวจตอนวาด / Save: **"P7 อาจหาจุดไม่ได้ในบางกรณี (อ้าง P5 ที่เกิดเฉพาะกิ่ง ตัด)"** + ทางแก้ (ย้ายเข้ากิ่ง / ใช้ firstOf)
- รองรับต่อได้ภายหลังโดยไม่เปลี่ยนรูปแบบ: `kind` ใหม่ของ decision, `variables` (SAC Variable) เป็นรายการใหม่ใน `logic`
  ⚠ **Loop แบบ SAC** (ทำเรขาคณิตซ้ำ N ครั้ง) ไม่เข้ากับโครงนี้ตรงๆ — ต้องมีแนวคิด "กลุ่มที่ทำซ้ำ" เพิ่ม (ไม่ขัดกัน แต่เป็นงานใหญ่อีกก้อน)

---

## 4. ตัวอย่าง: ปุ่ม "ถ้าตัด / ถม" จะได้อะไร

spec (ส่วนสำคัญ):

```jsonc
"params": [ ..., { "name": "CutSlope", "kind": "double", "default": 1.5 }, { "name": "FillSlope", "kind": "double", "default": 2 } ],
"points": [
  { "id": "P2", "def": { "type": "delta", "from": "P1", "dx": "3", "dy": "0" } },                       // บานพับ (ไหล่คันดิน)
  { "id": "P3", "branch": "B1", "codes": ["Daylight_Cut"],  "def": { "type": "slopeToSurface", "from": "P2", "slope": "1/CutSlope",   "dir": 1, "target": "TargetSurface" } },
  { "id": "P4", "branch": "B2", "codes": ["Daylight_Fill"], "def": { "type": "slopeToSurface", "from": "P2", "slope": "-1/FillSlope", "dir": 1, "target": "TargetSurface" } },
  { "id": "P5", "auxiliary": true, "codes": ["Daylight"],   "def": { "type": "firstOf", "points": ["P3", "P4"] } }
],
"links": [
  { "id": "L2", "branch": "B1", "points": ["P2", "P3"], "codes": ["Daylight_Cut"] },
  { "id": "L3", "branch": "B2", "points": ["P2", "P4"], "codes": ["Daylight_Fill"] }
],
"logic": {
  "conditions": [ { "id": "C1", "name": "IsCut", "expr": "ground(P2) > P2.y", "note": "ผิวดินสูงกว่าบานพับ = ตัด" } ],
  "decisions":  [ { "id": "D1", "parent": null, "kind": "if", "test": "IsCut", "label": "ตัดหรือถม?" } ],
  "branches":   [ { "id": "B1", "decision": "D1", "case": true, "label": "ตัด" }, { "id": "B2", "decision": "D1", "case": false, "label": "ถม" } ]
}
```

โค้ด C# ที่จะสร้าง (ในเมธอด Draw ของ `SaDrawing_X`):

```csharp
        // ---- พิกัดของจุด / เงื่อนไข (ตามลำดับที่ต้องคำนวณก่อน-หลัง) ----
        Pt? P1 = Pt.Origin;   // P1 origin
        Pt? P2 = Delta(cs, "P2", P1, F * 3.0, 0.0);   // P2 ห่างจาก P1

        // C1 IsCut: ผิวดินสูงกว่าบานพับ = ตัด   (null = ไม่รู้ เพราะหาจุดไม่ได้ -> ไม่เข้ากิ่งไหน)
        bool? IsCut = Cond(cs, "IsCut", () => Ground(cs, surface, P2) > Y(P2));
        // D1 ตัดหรือถม?
        bool B1 = IsCut == true;    // กิ่ง "ตัด"
        bool B2 = IsCut == false;   // กิ่ง "ถม"

        Pt? P3 = B1 ? SlopeToSurface(cs, "P3", surface, P2, 1.0 / CutSlope, F, 50.0, 3.0) : null;    // P3 ลาดจนชนดิน [กิ่ง ตัด]
        Pt? P4 = B2 ? SlopeToSurface(cs, "P4", surface, P2, -1.0 / FillSlope, F, 50.0, 3.0) : null;  // P4 ลาดจนชนดิน [กิ่ง ถม]
        Pt? P5 = FirstOf(P3, P4);   // P5 Daylight = จุดแรกที่เกิดใน P3, P4 (auxiliary)

        // ---- เพิ่มจุด / link / shape ลง CorridorState (เฉพาะที่เกิด) ----
        Point p2 = AddPoint(cs, P2);
        Point p3 = B1 ? AddPoint(cs, P3, "Daylight_Cut") : null;    // [กิ่ง ตัด]
        Point p4 = B2 ? AddPoint(cs, P4, "Daylight_Fill") : null;   // [กิ่ง ถม]
        Link l2 = B1 ? AddLink(cs, "L2", p2, p3, "Daylight_Cut") : null;    // [กิ่ง ตัด]
        Link l3 = B2 ? AddLink(cs, "L3", p2, p4, "Daylight_Fill") : null;   // [กิ่ง ถม]
```

- `Cond(...)` จับกรณีอ้างจุดที่เป็น null → คืน `null` + `Warn` (ตรงกับ "ไม่รู้" ใน JS) · `Y(P)` / `XR(P)` (x ในกรอบ Right = `F * P.X`) โยนเมื่อ P เป็น null
- `==` / `!=` → `Eq(a, b)` (tolerance `1e-6`) · `and / or / not` → `&& || !` ของ C# (ลัดวงจรเหมือน JS)
- จุด / object ที่ไม่เกิดเพราะกิ่ง **ไม่ Warn** · codelink (คลิก object → บรรทัด) ชี้บรรทัดเดิมได้เพราะยังเป็นบรรทัด `Pt? P3 = ...` / `AddPoint(cs, P3 ...)`
- **นิยามตัด**: ผิวดินอยู่สูงกว่าจุดบานพับ (`ground(P2) > P2.y`) = ต้องขุด = ตัด · เท่ากันพอดี = ถม (เขียนใน README / แก้นิพจน์ได้)

---

## 5. คำถาม (คำตอบที่เสนอ อยู่ในวงเล็บ)

1. นอกจากตัด/ถม งานจริงมีเงื่อนไขอะไรใช้บ่อย (ใช้ทำตัวอย่าง/ปุ่มสำเร็จรูปรอบหน้า) — เช่น ถมสูงเกิน X มีขั้นบันได (berm), ต่ำกว่าระดับน้ำมีหินทิ้ง
2. `P3.x` ฝั่ง Left: (**ค่าในกรอบ Right** — เงื่อนไขเดียวใช้ได้ทั้งสองฝั่ง) หรือค่าบนจอ (ติดลบเมื่อ Left)
   ผลต่าง: กรอบ Right = `P3.x > 2` แปลว่า "ห่างออกไปทางนอกเกิน 2 m" ทั้งสองฝั่ง · ค่าบนจอ = ฝั่ง Left ต้องเขียน `P3.x < -2`
3. เปิด Edit mode แล้ว: (**แสดงทุกกรณี** — กิ่งที่ไม่เกิดเป็นเส้นจางประ + ป้ายชื่อกิ่ง) หรือ แสดงเฉพาะที่เกิด
   และเสนอให้ปุ่ม **"ดูแบบ Civil 3D"** ที่มีอยู่แล้ว ซ่อนของที่ไม่เกิดด้วย (= แสดงเฉพาะที่เกิด) · snap ไปของที่ไม่เกิด: (**ได้ เฉพาะตอนแสดงทุกกรณี**)
4. shortcut "วาดลงกิ่ง…": (**`B`** — ยังว่าง · ตัวที่ใช้แล้ว: P L S M C R X A F Z, T/E ตอนวาด Arc)
5. จัดระเบียบ repo ข้อ 1: ตกลงไหม (**ตกลง**) · `.claude/launch.json`: (**ignore** — มี path โฟลเดอร์ชั่วคราวของเครื่อง)
   · ใส่ `CLAUDE.md` และ `prompt-4.md` (+ ไฟล์นี้) ใน commit เดียวกันไหม (**ใส่** — อีกเครื่องจะได้เห็น)
6. โครงข้อมูล: (**แบบในไฟล์นี้** — กิ่งเป็นทางออกของ decision) หรือแบบใน prompt-4 (กิ่งมี `when` เอง)
7. ไม่มีผิวดิน: `ground()` = ระดับของจุดเอง → เข้ากิ่ง ถม (**ตามที่เสนอ**)
8. เครื่องบ้านไม่มี node: ขอติดตั้ง Node.js LTS ไหม (`winget install OpenJS.NodeJS.LTS` — ผู้ใช้รันเอง) หรือใช้วิธีรันในเบราว์เซอร์ต่อ (**ติดตั้ง** — test เทียบ JS / C# จะรันตรงๆ ได้)

---

## ตกลงแล้ว (ผู้ใช้ตอบ 2026-11-02)

- **ทุกข้อ "ตามที่เสนอ"** (ข้อ 1 ยังไม่มีตัวอย่างเงื่อนไขเพิ่ม) — ใช้ค่าในวงเล็บของข้อ 2–8 และโครงข้อมูลแบบในไฟล์นี้ (กิ่ง = ทางออกของ decision)
- ผู้ใช้จะใช้ **เครื่องบ้านเครื่องเดียว** แล้ว — "เรื่อง git อะไรที่ไม่ใช้ ลบได้เลย"
- จัดระเบียบ repo ที่ทำไป: `.gitignore` / `.gitattributes` ตามข้อ 1 · เลิก track bin/obj (177 ไฟล์) · `.claude/launch.json` ignore
  · renormalize แล้วไม่มีไฟล์เปลี่ยนเนื้อหา
- **ยังไม่ได้ลบ** (ระบบกันคำสั่งลบไว้ — ผู้ใช้ลบเอง หรืออนุญาตให้ลบ):
  - branch `round2-autocad-editing` (merge เข้า main แล้ว) — `git branch -d round2-autocad-editing`
  - stash เก่าของ GitHub Desktop (มีแต่ไฟล์ใน bin/obj) — `git stash drop`
  - โปรเจกต์ `SA.Civil3D` (adapter Trapezoid ของแนวทางแรก — ไม่อยู่ใน .sln, เว็บไม่ใช้, build ไม่ได้ในเครื่องที่ไม่มี AutoCAD)
    — `git rm -r SA.Civil3D` (คืนได้ด้วย `git checkout 8555581 -- SA.Civil3D`) · `SA.Core` เก็บไว้ (SA.Tests ใช้)
