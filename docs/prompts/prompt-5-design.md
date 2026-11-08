# รอบ 5 — ข้อเสนอ Milestone 0 (Logic API · ต้นไม้ Conditions · Variables · มุมมองข้อความ)

> ไฟล์นี้ = สิ่งที่เสนอใน M0 + คำตอบของผู้ใช้ (หัวข้อ "ตกลงแล้ว" ท้ายไฟล์ — ถ้าขัดกับข้อก่อนหน้าให้ถือหัวข้อนั้น) — M1 เป็นต้นไปทำตามนี้

## 0. สถานะตอนเริ่ม (2026-11-08)

- git: `main` ตรงกับ `origin/main` (`e1fa131` — รอบ 4d / 4e commit + push ครบ)
  ไฟล์ค้างของผู้ใช้ (ไม่ commit): `prompt-5.md` (ฉบับที่ผู้ใช้แก้ล่าสุด), `SR03.assembly.json`, `pavement-assembly.cs`, `TEST.assembly.json`, `body.cs`, `br.cs`, `prompt-4d.md`
- test เดิม: C# **143 / 143** · JS **19 ไฟล์ผ่านทั้งหมด** (เครื่องนี้มี `node` แล้ว รันตรงได้)
- logic ตอนนี้ (`spec.logic`): `conditions` [{ id C#, name, expr, note }] · `decisions` [{ id D#, parent (กิ่งแม่ | null), kind if | switch, test (ชื่อเงื่อนไข / นิพจน์), label }]
  · `branches` [{ id B#, decision, case (true / false / ตัวเลข / "else"), label }] · object มี `branch` · **รอบนี้ไม่เปลี่ยนสามรายการนี้ — เพิ่ม `variables` อย่างเดียว**
- ที่ UI แก้ `spec.logic` / `branch` ตรงๆ อยู่ตอนนี้ (M1 ย้ายไปเรียก API): `ui.js` "เกิดเมื่อ" (o.branch, c.expr), `newCondition` (addIf), แท็บ Logic (c.expr, renameCond,
  b.label, ลบเงื่อนไข, removeDecision), `cutFillCommit` (addCutFill) · `draw.js` วาดลงกิ่ง (`B` — ตั้ง branch ให้ object ใหม่) · `ops.js` Copy / Paste (คงกิ่งเดิม — เป็นส่วนของ Copy ไม่ใช่การแก้ logic จึงไม่ย้าย)

---

## 1. Logic API (ข้อ 1)

### 1.1 ที่อยู่ + รูปแบบ

- ไฟล์ใหม่ **`js/logicops.js`** → `const Logic = (() => { … })()` โหลดหลัง `spec.js` (node: `expr.js` + `spec.js` + `logicops.js` ใน vm เดียวกัน)
  เหตุผลที่ไม่ใส่ใน `spec.js`: spec.js ยาว ~1,300 บรรทัดและเป็น "ตัวคำนวณ + ตัวช่วยระดับล่าง" · Logic API = ชั้นบนที่ตรวจค่า + ข้อความ error ไทย + รูปแบบผลเดียว
  (prompt-6 ห่อเป็นเครื่องมือ MCP ทีละฟังก์ชันจากไฟล์นี้ไฟล์เดียว) · ฟังก์ชันเดิมใน spec.js (`addIf`, `removeDecision`, …) อยู่ต่อ — Logic เรียกใช้
- ทุกฟังก์ชัน: `Logic.xxx(spec, args)` → `{ ok: true, …ผล, warnings? }` หรือ `{ ok: false, error: "ข้อความไทย" }`
- **error แล้ว spec ไม่เปลี่ยนเลย**: ทำบนสำเนา (`JSON` clone) → ผ่านแล้วค่อยแทนค่าลง spec เดิม (แทนทีละ key บนสุด — object `spec` ตัวเดิม UI / History ยังถือได้)
  test ยืนยันด้วยการเทียบ `JSON.stringify(spec)` ก่อน / หลังทุกกรณี error
- ไม่แตะ DOM / state · undo = UI เรียกผ่าน `specEdit(sp => Logic.xxx(sp, …), it, "ชื่อการกระทำ")` (1 การกระทำ = Undo 1 ครั้ง · error = ไม่มีก้อน Undo + ข้อความใน banner)

### 1.2 รายการฟังก์ชัน

| ฟังก์ชัน | args | ได้ | error ที่เป็นไปได้ |
|---|---|---|---|
| `addCondition(spec, { name?, expr, note?, parentBranch? , decision? })` | `decision: true` (ค่าเริ่ม) = สร้าง decision if + กิ่ง ใช่ / ไม่ใช่ ด้วย (ใน `parentBranch` = elif ถ้าเป็นกิ่ง "ไม่ใช่") · `false` = เงื่อนไขเปล่า (ใช้ในนิพจน์อื่น) | `{ cond, decision?, yes?, no? }` | ชื่อซ้ำ (parameter / เงื่อนไข / variable / จุด), คำสงวน, นิพจน์ไม่ใช่ bool, อ้างจุดที่ไม่มี, ไม่มีกิ่ง parentBranch |
| `editCondition(spec, name, { expr?, note? })` | | | ชนิดผิด, วนกัน |
| `renameCondition(spec, old, name)` | ทุกนิพจน์ + test + label ตามชื่อเดิม เปลี่ยนตาม (`renameCond` เดิม) | | ชื่อซ้ำ / คำสงวน |
| `removeCondition(spec, name, { how })` | มี decision ใช้ = ลบ decision ด้วย (`how` ด้านล่าง) · มีนิพจน์อื่นใช้ = **error** (บอกว่าใครใช้) | `{ touched }` | ยังมีนิพจน์ใช้ |
| `addDecision(spec, { parentBranch?, kind, test, label?, cases? })` | if = กิ่ง ใช่ / ไม่ใช่ · switch = กิ่งตาม `cases` [{ value, label }] + `else` ท้ายเสมอ | `{ decision, branches: [] }` | test ชนิดผิด (if = bool, switch = ตัวเลข), case ซ้ำ |
| `editDecision(spec, id, { test?, label?, kind? })` | เปลี่ยน kind if ↔ switch = แปลงกิ่ง (ใช่ → case 1, ไม่ใช่ → else / กลับกัน) object ตามกิ่งไป | | ชนิด test ไม่ตรง kind |
| `removeDecision(spec, id, { how })` | `how`: `"parent"` (กิ่งแม่ — ค่าเริ่ม) · `"always"` (เกิดเสมอ) · `"remove"` (ลบ object ในกิ่งด้วย) | `{ touched }` | ไม่มี id |
| `moveDecision(spec, id, parentBranch \| null)` | ย้าย decision ทั้งก้อน (ใช้ทำ elif / เลิก elif) | `{ warnings }` (branchRisks) | ย้ายเข้ากิ่งของตัวเอง / ที่ซ้อนอยู่ข้างใน |
| `addCase(spec, decisionId, { value, label? })` / `editCase(spec, branchId, { value?, label? })` / `removeCase(spec, branchId, { how })` / `moveCase(spec, branchId, index)` | `else` ลบ / ย้ายไม่ได้ อยู่ท้ายเสมอ (index นับเฉพาะ case ที่มีค่า) | | ค่าซ้ำ, ไม่ใช่ตัวเลข, แก้ / ลบ `else`, decision ไม่ใช่ switch |
| `renameBranch(spec, id, label)` | | | ว่าง |
| `setBranch(spec, objectIds, branchId \| null)` | point / link / shape (id ขึ้นต้น P / L / S) · กลุ่มหมุน / Array = ย้ายสมาชิกทั้งกลุ่มไปด้วย | `{ moved, warnings }` (branchRisks ของที่ย้าย) | id ไม่มี, กิ่งไม่มี |
| `addVariable(spec, { name, kind, unit?, expr, rules?, note?, index? })` / `editVariable(spec, name, {…})` / `renameVariable` / `removeVariable(spec, name)` / `moveVariable(spec, name, index)` | ข้อ 3 · kind bool = เก็บใน `conditions` (ดูคำถามข้อ 3) | `{ variable }` | ชื่อซ้ำ / คำสงวน, ชนิดผิด, **วนกัน** (V1 ใช้ V2 ใช้ V1 / ผ่านจุด), ลบตอนมีคนใช้ = error บอกรายการ (UI ถามแล้วค่อยลบคนใช้ก่อน) |
| ของ 4c ห่อใหม่: `addCutFill`, `addIntersect`, `addOffset`, `addExtendToGround`, `addFollowClipped`, `addArray`, `updateArray`, `rebuildArray`, `setParamBounds`, `setParamUnit` | args เดิม · ตัวที่เดิม throw / คืน `{ error }` → แปลงเป็น `{ ok:false, error }` | ตามเดิม + `ok` | ตามเดิม |
| `describe(spec, evalResult?)` | JSON สั้นให้ MCP อ่าน | ด้านล่าง | — |
| `toText(spec, evalResult?)` / `diffText(before, after)` | ข้อ 4 | string | — |

`describe` ตัวอย่าง (round4-demo):
```jsonc
{ "params": [{ "name": "Curb", "kind": "long", "default": 1, "unit": "number" }, …],
  "variables": [], "conditions": [{ "name": "IsCut", "expr": "ground(P2) > P2.y", "value": true }, …],
  "decisions": [{ "id": "D1", "kind": "if", "test": "IsCut", "label": "ตัดหรือถม?", "parent": null,
                  "branches": [{ "id": "B1", "case": true, "label": "ตัด", "objects": ["P3", "L2", "L4"], "active": true }, …] }, …],
  "always": { "points": 5, "links": 1, "shapes": 0 } }
```

---

## 2. ต้นไม้ Conditions ในแถบซ้าย (ข้อ 3) — ภาพร่างจาก round4-demo จริง

```
▾ Round4Demo                                   [Edit]
   ▸ Parameters (6)
   ▾ Points (5)        P1 Crown · P2 Shoulder · P5 Daylight (aux) · P6 Ditch …     ← เกิดเสมอ
   ▸ Links (1)         L1 Top
   ▾ Conditions                                 [+ Condition] [+ Switch]
      ▾ ◇ IsCut   ground(P2) > P2.y                         ● จริง
         ▾ ✓ ตัด (B1) · 3                                    ← เกิดตอนนี้
              P3 Daylight_Cut · L2 Daylight_Cut · L4 Ditch
         ▾ ✗ ถม (B2) · 3
              P4 Daylight_Fill · L3 Daylight_Fill · L5 Ditch
            ▾ ◇ HighFill   P2.y - ground(P2) > HighFillH     ○ เท็จ   ← elif (ซ้อนในกิ่ง ถม)
               ▸ ✓ ถมสูง (B3) · 2   ⚠ ยังไม่มี scenario
               ▸ ✗ ถมปกติ (B4) · 0
      ▾ ◇ switch Curb                                        = 1
         ▸ = 1 มีขอบทาง (B5) · 2
         ▸ อื่นๆ ไม่มีขอบทาง (B6) · 0
   ▾ Variables                                  [+ Variable]
      (ยังไม่มี)
```
- ชิปค่าสด: `● จริง` / `○ เท็จ` / `? ไม่รู้` (if) · `= 1` (switch) · กิ่งที่เกิดตอนนี้ตัวหนา + ✓ · อัปเดตทุกครั้งที่คำนวณใหม่ (ลากผิวดิน / parameter / scenario)
- คลิกกิ่ง = เลือก object ทั้งกิ่ง · ดับเบิลคลิก decision = แก้นิพจน์ในที่ (ช่องพิมพ์ในบรรทัด, Enter / Esc)
- คลิกขวา decision: เปลี่ยนชื่อ · แก้นิพจน์ · ย้ายไปกิ่ง… · เปลี่ยนเป็น switch / if · ลบ… (dialog เดิม 3 ทาง) · ไปที่โค้ด
- คลิกขวากิ่ง: วาดลงกิ่งนี้ (`B`) · + Condition ในกิ่งนี้ (กิ่ง "ไม่ใช่" เขียนว่า **+ elif (Condition ในกิ่งนี้)**) · + Switch ในกิ่งนี้ · เปลี่ยนชื่อ · (switch) ↑ ↓ / แก้ค่า case / ลบ case
- ลาก object (P3, L2 …) ไปวางบนกิ่ง / บน Points-Links-Shapes (= เกิดเสมอ) = `setBranch` · คำเตือน branchRisks ขึ้นใน banner หลังวาง
- ไม่มี shortcut ใหม่ (ทุกอย่างผ่านปุ่ม / คลิกขวา / ลาก) · `B` เดิมใช้ต่อ
- ไม่ต้องเปิด / ปิดเงื่อนไขเอง: เงื่อนไขที่ไม่มี object ในกิ่ง = แค่คำนวณค่า (README บอก)

---

## 3. Variables (ข้อ 4)

### 3.1 รูปแบบ (`spec.logic.variables` — เพิ่มใหม่ ไม่แตะของเดิม)

```jsonc
"variables": [
  { "id": "V1", "name": "DepthUsed", "kind": "double", "unit": "length",
    "expr": "Depth",
    "rules": [ { "when": "Depth < 2", "value": "2", "warn": "Depth = {Depth} m < 2 m ใช้ 2 m แทน", "error": "ValueTooSmall" } ],
    "note": "ความลึกขั้นต่ำ 2 m" }
]
```
- `kind`: `double` (รอบนี้) · bool = เงื่อนไข (ข้อ 3 ในคำถาม) · เผื่อ Loop: `kind: "counter"` / `scope` เพิ่มได้ภายหลังโดยไม่เปลี่ยนของเดิม
- `unit` = ชนิดค่าเหมือน Parameter (`number` / `slope` / `length` / `percent`) — Variable ชนิด Slope ใส่ในช่อง slope ได้ (`-1/SideSlopeUsed`) และแสดง `1:x`
- `rules` = if / elif ตามลำดับ **ตัวแรกที่จริงชนะ** · `value` = นิพจน์ · `warn` (ไม่ใส่ = ไม่เตือน) ใช้ `{ชื่อ}` แทนค่าได้ · `error` = CorridorError ที่มีจริง (คำถามข้อ 7)
- ลำดับคำนวณ: เข้า `TopoOrder` เหมือนเงื่อนไข (อ้างจุด / ผิวดิน / variable อื่นได้) · วนกัน = error ตอนแก้ (API) + เตือนตอนคำนวณ (แบบ cyclic เดิม)
- หาค่าไม่ได้ (อ้างจุดที่ไม่เกิด) = ไม่รู้ค่า → object ที่ใช้ชื่อนี้ข้ามไป + เตือน (แบบเงื่อนไข "? ไม่รู้")
- ชื่อห้ามซ้ำ parameter / เงื่อนไข / variable / จุด / คำสงวน (`RESERVED` เดิม + ฝั่ง C#) · rename = นิพจน์ทุกช่องเปลี่ยนตาม (แบบ `renameCond`)

### 3.2 C# ที่ได้

ไม่อ้างจุด / ผิวดิน → `double` ธรรมดา อ่านง่ายแบบไฟล์ของผู้ใช้:
```csharp
        // V1 DepthUsed: ความลึกขั้นต่ำ 2 m
        double DepthUsed = Depth;
        if (Depth < 2.0) { Warn(cs, CorridorError.ValueTooSmall, "Depth = " + Depth + " m < 2 m ใช้ 2 m แทน"); DepthUsed = 2.0; }
```
หลาย rules = `if / else if`:
```csharp
        // V2 Berm: ความกว้างชานพักตามความสูงถม
        double Berm = 0.0;
        if (FillH > 6.0) Berm = 2.0;
        else if (FillH > 3.0) Berm = 1.0;
```
อ้างจุด / ผิวดิน → `double?` (null = ไม่รู้ค่า แบบ `bool?` ของเงื่อนไข) ผ่านตัวช่วยเดิม `Val(…)`:
```csharp
        // V3 FillH: ความสูงถมที่ไหล่
        double? FillH = Val(cs, "FillH", () => PY(P2) - Ground(cs, surface, P2));
```
- codelink: คลิก variable ในต้นไม้ / แท็บ Logic → บรรทัด `// V1 …` · test: DrawingTests เทียบ JS = C# + ข้อความเตือนตรงตัว (แบบ paramMsgs รอบ 4e)

### 3.3 ใช้อันไหนเมื่อไร (จะลง README)

| ต้องการ | ใช้ |
|---|---|
| บีบค่าที่ผู้ใช้กรอกให้อยู่ในช่วง (`Depth ≥ 2`) | ตาราง Parameter (ขั้นต่ำ / ขั้นสูง) — ง่ายสุด |
| ค่าขึ้นกับค่าอื่น / ผิวดิน / จุด, หลายกรณี, ข้อความเตือนเอง | **Variable** |
| ให้รูป **มี / ไม่มี** ตามเงื่อนไข | **Condition** (กิ่ง) |
| ทางเลือกหลายแบบตามเลข (`ProtectionType`) | **Switch** |

test ข้อ 4 ของ prompt: rock-pitching base ที่ Depth ใช้ Variable `DepthUsed` (แทนขั้นต่ำ 2 ในตาราง) → ผลเหมือนไฟล์จริงใน RockPitchingTests

---

## 4. มุมมองข้อความ (ข้อ 2) — `Logic.toText(round4-demo, ผลคำนวณ ดินสูง +2)`

```
Variables: (ไม่มี)
Conditions:
  IsCut = ground(P2) > P2.y                    ← ตอนนี้: จริง
  HighFill = P2.y - ground(P2) > HighFillH     ← ตอนนี้: เท็จ
เกิดเสมอ: P1, P2, P5 (aux), P6, L1
ถ้า IsCut:                                     [D1 ตัดหรือถม?]
    ตัด (B1): P3, L2, L4                       ← เกิดตอนนี้
ไม่ใช่:
    ถม (B2): P4, L3, L5
    ถ้า HighFill:                              [D2 ถมสูงไหม?]
        ถมสูง (B3): P7, L6
    ไม่ใช่:
        ถมปกติ (B4): (ว่าง)
switch Curb:                                   [D3 ขอบทาง]   ← ตอนนี้: 1
    = 1  มีขอบทาง (B5): P8, L7                 ← เกิดตอนนี้
    อื่นๆ ไม่มีขอบทาง (B6): (ว่าง)
```
`Logic.diffText(ก่อน, หลัง)` ตัวอย่าง:
```
+ เงื่อนไข HighFill = P2.y - ground(P2) > HighFillH
+ decision D2 "ถมสูงไหม?" ในกิ่ง ถม (B2) → กิ่ง ถมสูง (B3) / ถมปกติ (B4)
~ P7, L6: เกิดเสมอ → ถมสูง (B3)
~ variable DepthUsed: ค่าปกติ Depth → Depth (เพิ่ม: ถ้า Depth < 2 → 2 เตือน)
- กิ่ง อื่นๆ (B6) ของ switch Curb
```
แท็บ Logic: ปุ่มสลับ **ตาราง / ข้อความ** + **คัดลอก** (ไม่ส่งผลคำนวณ = โครงอย่างเดียว ไม่มี "← ตอนนี้")

---

## 5. ลำดับ milestone (ตาม prompt — ไม่เปลี่ยน)

M1 Logic API + test + UI เดิมเรียก API · M2 ต้นไม้ Conditions · M3 Variables · M4 มุมมองข้อความ + diffText · M5 round5-demo + checklist + รวมงาน
round5-demo (เสนอ): คันดิน — `ProtectionType` switch (1 หินเรียง / 2 คอนกรีต / อื่นๆ ไม่มี) + Daylight Cut/Fill + elif HighFill (ชานพักขั้นบันได — Array ในกิ่ง) + Variable `DepthUsed` (ฐานราก ≥ 2 m เตือน)

---

## 6. คำถาม (ค่าที่เสนอ = ใช้ถ้าตอบ "ตามที่เสนอ")

1. object ในกิ่งในต้นไม้ — เสนอ **แสดงใต้กิ่งอย่างเดียว** (Points / Links / Shapes = เกิดเสมอ · หัวโหนดบอกจำนวน "Points (5) · ในกิ่ง 3")
2. แท็บ Logic ด้านล่าง — เสนอ **เก็บไว้ดูค่าสด / coverage / ข้อความ** · การแก้ทำในต้นไม้ (ปุ่มแก้ในแท็บเดิมยังอยู่ แต่เรียก API เดียวกัน)
3. Variable ชนิด bool รวมกับเงื่อนไข — เสนอ **รวมในหน้าจอ / API แต่ที่เก็บแยก**: bool เก็บใน `logic.conditions` เดิม (เพิ่ม `rules` ได้), double ใน `logic.variables`
   ต้นไม้: เงื่อนไขที่ไม่มี decision ใช้ แสดงใต้ **Variables** (ชิป จริง / เท็จ) · ที่มี decision แสดงเป็น ◇ ใต้ **Conditions** — ไม่เปลี่ยนรูปแบบเดิม
4. มุมมองข้อความ — เสนอ **ภาษาไทย** (ถ้า / ไม่ใช่ / อื่นๆ) ตามตัวอย่างข้อ 4
5. round5-demo — เสนอ **ตามข้อ 5** (คันดิน ProtectionType + ตัด / ถม + ถมสูง + DepthUsed)
6. (ใหม่) `+ Condition` ในต้นไม้สร้าง **เงื่อนไขที่ตั้งชื่อเสมอ** (ชื่อเริ่ม `Cond1` แก้ได้) แทนการใส่นิพจน์ลงใน decision ตรงๆ — เสนอ **ใช่** (ชื่อเห็นในต้นไม้ / โค้ด / ข้อความ)
7. (ใหม่) ข้อความเตือนของ Variable ใช้ `CorridorError` ไหน — เสนอ **เลือกได้ใน dropdown** ค่าเริ่มเดาจากเงื่อนไข: มี `<` = `ValueTooSmall`, มี `>` = `ValueTooLarge`, อื่นๆ = `Failure`
8. (ใหม่) ลบ Variable / เงื่อนไขที่มีคนใช้ — เสนอ **ไม่ยอม** บอกรายการที่ใช้ (ให้แก้ที่ใช้ก่อน) แทนการลบตามไปด้วย

---

## ตกลงแล้ว

ผู้ใช้ตอบ (2026-11-08):
- **ข้อ 1 = แบบที่ 2 (ไม่ใช่ที่เสนอ)**: Points / Links / Shapes แสดง object **ทั้งหมด** — object ในกิ่งมีป้ายชื่อกิ่งต่อท้าย **สีเดียวกับกิ่ง** (`branchColor`)
  และใต้กิ่งใน Conditions ก็แสดง object ของกิ่งนั้นด้วย (โชว์ 2 ที่ คลิกที่ไหนก็เลือกตัวเดียวกัน)
- ข้อ 2–8 **ตามที่เสนอ**
