# Round 5c notes

## Answers to section 7

Answered 2026-11-09: "as proposed" for all five.

1. `docs/` file list: as in the table below.
2. `CLAUDE.md` target: <= 6 KB.
3. Existing Thai code comments stay; translate only comments in code being edited anyway.
4. Future design docs (`prompt-N-design.md`) are in English; the user's Thai answers are recorded in English.
5. The Civil 3D machine is this one: `DESKTOP-GK62KQM`, `D:\test_cad\Subassembly-WebViewer`, Civil 3D 2027 at `C:\Program Files\Autodesk\AutoCAD 2027\C3D`.

## M0 findings (2026-11-09)

Sizes: `CLAUDE.md` 28,270 bytes · `README.md` 191,470 bytes · 20 `prompt*.md` files at the root, 400,755 bytes.

Baseline tests: C# 177/177 pass. JS: 24 of 25 files pass. `rockpitching.test.js` has 1 failure ("body ... = sa-spec in body_rock-pitching-web.cs").
Cause: the user's uncommitted edit to `body_rock-pitching-web.cs` (added CutSlope / FillSlope / IsCut), so the file no longer matches `buildBody()`. Not a code bug.

User files that are modified or untracked (do not touch; the `prompt-*` ones only move):
`SR03.assembly.json`, `body_rock-pitching-web.cs`, `pavement-assembly.cs`, `TEST.assembly.json`, `body.cs`, `br.cs`, `CLAUDE.md` (status line), `prompt-5.md`, `prompt-4d.md`, `prompt-5c.md`, `prompt-6.md`.

Civil 3D on this machine: hostname `DESKTOP-GK62KQM`, `C:\Program Files\Autodesk\AutoCAD 2027\C3D` contains `AeccDbMgd.dll`.

Moved-file references to fix in M1: `CLAUDE.md`, `README.md` (5 lines), comments in `CodeGenerator.cs`, `DrawingSpec.cs`, `logicops.js`, `spec.js` (2 lines). `prompt-6.md` already uses `docs/prompts/`.

## Proposed docs/ structure

| File | Old README headings |
|---|---|
| `docs/overview.md` | title section, เปิดเว็บ, เว็บทำอะไรกับไฟล์ .cs, ระบบพิกัดจำลอง, ข้อควรรู้ |
| `docs/screen.md` | หน้าจอ, เลือก, Shortcut, มุมมอง / ซูม, Undo / Redo และ Delete, ต่างจาก AutoCAD |
| `docs/drawing-tools.md` | วาด, Object snap tracking, Polygon, Arc / Fillet, Intersect / Offset, Extend to Surface, Clipped Surface Link, Move / Copy / Paste, Rotate, Auxiliary (first part) |
| `docs/array-loop.md` | Array, Loop |
| `docs/logic.md` | from the Auxiliary section: expressions, conditions, branches, Conditions tree, Variables, text view |
| `docs/logic-api.md` | Logic API |
| `docs/parameters.md` | from the Auxiliary section: Parameter table, value types, slope fields |
| `docs/code-generation.md` | Save (.cs), object → code line, rock-pitching from the web |
| `docs/viewer.md` | Import, แก้โค้ดในเว็บ, โค้ดค้าง, Assembly, เส้น surface, Civil 3D API shim |
| `docs/testing.md` | ทดสอบ |
| `docs/civil3d-testing.md` | the five "ทดสอบใน Civil 3D" sections |
| `docs/history.md` | round-by-round history from CLAUDE.md, condensed (M3) |
| `docs/prompts/` | finished prompts and design docs |

The Auxiliary heading covers 170 lines / about 36 KB and mostly holds logic and parameter content, so it is split by topic.

## Proposed CLAUDE.md outline (target <= 6 KB, English)

Project · User · Machines and git sync · Rules (current rules, language policy, finished-round prompts move to `docs/prompts/`) · Token rules · Tests (`test-all.bat`) · Current status (last round, next, pointer to `docs/history.md`) · Plan (3-5 lines, Trello board "SA Drawing Studio").

## M2: old README heading → new file

| Old heading | New file |
|---|---|
| SA Drawing Studio (Subassembly Viewer) | `docs/overview.md` |
| หน้าจอ | `docs/screen.md` |
| วาด (Edit mode) | `docs/drawing-tools.md` |
| Object snap tracking (F11) | `docs/drawing-tools.md` |
| Polygon | `docs/drawing-tools.md` |
| Arc / Fillet (เส้นโค้ง) | `docs/drawing-tools.md` |
| Intersect / Offset (รอบ 4c) | `docs/drawing-tools.md` |
| Array (รอบ 4c) | `docs/array-loop.md` |
| Loop — Array ที่จำนวนชุดคำนวณตอนรัน (รอบ 5b) | `docs/array-loop.md` |
| Extend to Surface (รอบ 4c) | `docs/drawing-tools.md` |
| Clipped Surface Link (รอบ 4c) | `docs/drawing-tools.md` |
| Auxiliary (ช่วยสร้าง) — แบบ SAC | `docs/drawing-tools.md (Auxiliary, point types)`, `docs/logic.md (expressions, branches, Variables)`, `docs/parameters.md (table, value types, slope fields)` |
| เลือก (Window / Crossing) | `docs/screen.md` |
| Move / Copy / Paste | `docs/drawing-tools.md` |
| Rotate (R) — Edit mode | `docs/drawing-tools.md` |
| Shortcut (กด `?` หรือ `F1` บนหน้าเว็บเพื่อดูตารางนี้) | `docs/screen.md` |
| มุมมอง / ซูม | `docs/screen.md` |
| object → บรรทัดโค้ด | `docs/code-generation.md` |
| Undo / Redo และ Delete | `docs/screen.md` |
| Save (.cs) และโค้ดที่สร้าง | `docs/code-generation.md` |
| ทดสอบใน Civil 3D (รอบ 3) | `docs/civil3d-testing.md` |
| ทดสอบใน Civil 3D (รอบ 4) | `docs/civil3d-testing.md` |
| ทดสอบใน Civil 3D (รอบ 5b) — round5b-demo คันดินถม ชานพักทุก BermInterval (Loop) | `docs/civil3d-testing.md` |
| ทดสอบใน Civil 3D (รอบ 5) — round5-demo คันดิน | `docs/civil3d-testing.md` |
| ทดสอบใน Civil 3D (รอบ 4c) — rock-pitching ที่วาดใหม่ | `docs/civil3d-testing.md` |
| Logic API (รอบ 5) — `js/logicops.js` | `docs/logic-api.md` |
| rock-pitching จากเว็บ (รอบ 4e) — `base_rock-pitching-web.cs` / `body_rock-pitching-web.cs` | `docs/code-generation.md` |
| ทดสอบ | `docs/testing.md` |
| เปิดเว็บ | `docs/overview.md` |
| เปิดไฟล์ .cs (Import) | `docs/viewer.md` |
| แก้โค้ดในเว็บ | `docs/viewer.md` |
| โค้ดค้าง (loop / recursion ไม่จบ) | `docs/viewer.md` |
| Assembly (ประกอบหลาย subassembly) | `docs/viewer.md` |
| เว็บทำอะไรกับไฟล์ .cs | `docs/overview.md` |
| เส้น surface | `docs/viewer.md` |
| ระบบพิกัดจำลอง | `docs/overview.md` |
| ตัวจำลอง Civil 3D API (SA.Civil3DShim) | `docs/viewer.md` |
| ข้อควรรู้ | `docs/overview.md` |
| ต่างจาก AutoCAD | `docs/screen.md` |
