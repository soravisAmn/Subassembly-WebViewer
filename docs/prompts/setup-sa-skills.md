# One-off task: create the project skills `sa-spec-change`, `sa-civil3d-parity`, `sa-add-command`

> How to use: **after round 9 is finished and committed** (the command registry must exist), in a new Claude Code session tell Claude Code
> "Read CLAUDE.md and setup-sa-skills.md, then do it". Report to the user in Thai, briefly.

## Why

These steps repeat in every round and are easy to get wrong. As project skills they load only when needed, instead of growing `CLAUDE.md`. The generic user-level subagents `reviewer` and `test-runner` (in `~/.claude/agents/`) already exist and are used together with these skills; do not create project copies of them.

## What to do

1. Create three skills in the repo: `.claude/skills/<name>/SKILL.md`, English, CRLF, **each ≤ 4 KB**. Frontmatter: `name`, `description` (one sentence saying when to use it — this decides when it loads).
2. **Write them from the real code and docs, not from this file's wording**: check every function, file and command name you mention exists (grep). Link to `docs/*.md` for detail instead of copying it. No Thai except UI labels quoted as they appear in the web.
3. Add one line to `CLAUDE.md` (keep it ≤ 6 KB — trim elsewhere if needed): "Project skills: `sa-spec-change`, `sa-civil3d-parity`, `sa-add-command` (in `.claude/skills/`). Generic agents `reviewer`, `test-runner` are user-level."
4. Check `.gitignore` does not exclude `.claude/skills/` (it excludes only `.claude/launch.json` and `.claude/settings.local.json` today).
5. Show the user the three files (short summary each), ask permission to commit. Then move this file to `docs/prompts/`.

## Skill 1: `sa-spec-change`

When: adding or changing anything stored in the spec (points, links, shapes, parameters and their fields, conditions, variables, Arrays / Loops, display data from round 10 on).

Must cover, in order, as a checklist:
- Logic API first (`js/logicops.js`): the new function, undo behaviour (one Ctrl+Z per user action), validation and Thai error text; `docs/logic-api.md` entry.
- Spec shape (`js/spec.js`): field names, `Spec.normalize` / defaults so **old specs still load**; spec stores meaning, not coordinates.
- UI calls the Logic API only (never edits the spec directly); Properties / tables; Thai labels.
- Generator (`SA.Web/Drawing/CodeGenerator.cs`): emitted C#, only Civil 3D APIs that exist (`link-API-Reference.txt`); Right and Left.
- Shim / simulator: same result as Civil 3D; JS result vs C# result compared (how the existing tests do it — name the test files).
- MCP: whether `sa_*` tools / the catalog need the new field.
- Tests (fixtures only) + `test-all.bat`; docs file for the feature.

## Skill 2: `sa-civil3d-parity`

When: real Civil 3D behaves differently from the web, or new code uses a Civil 3D API not used before.

Must cover:
- Rule: the web must render exactly like Civil 3D; the shim must never be more lenient than the real API.
- Order: reproduce the Civil 3D behaviour in the shim first (the web then shows the same problem) with a failing test → fix the generator → test passes. Example to cite: the round 6 "shape link order" fix (`ChainLinks`, `ShapeWalk`, `docs/civil3d-testing.md`).
- How to check an API member exists: compile a probe against the real DLLs in `C:\Program Files\Autodesk\AutoCAD 2027` (show the existing way to do it, e.g. `tests-civil3d/build`), plus `link-API-Reference.txt`. Never add API to the shim that Civil 3D lacks.
- Writing `tests-civil3d/roundN-checklist.md` for the user: the standard sections used so far (build / load via the round 7 Build dialog + `.atc` palette + Refresh Palette, what to compare with the web, what to report back). Claude Code never opens or drives Civil 3D.

## Skill 3: `sa-add-command`

When: adding a new user command (ribbon button, menu item, shortcut, right-click item) — rounds 10–13 add many.

Must cover (from the round 9 registry as built):
- The registry entry fields and where the file is; icon choice (Tabler outline in `wwwroot/lib/tabler/`, or a custom SVG like the old Drawer ones); Thai tooltip with shortcut; enable rule with a reason text.
- Which tab / panel; contextual tabs only in Edit; no new empty tabs.
- Shortcut clash check (the test that enforces it) and the generated `?` table.
- If the command changes spec data → use `sa-spec-change`.
- Tests to add (registry test, inventory test) and `docs/screen.md` update.
