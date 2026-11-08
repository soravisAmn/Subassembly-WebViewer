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
