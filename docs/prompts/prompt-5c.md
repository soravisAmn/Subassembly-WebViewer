# Round 5c (housekeeping, before prompt-6): cut token usage — English docs, slim CLAUDE.md, split README, move old prompts, quiet scripts

> How to use: tell Claude Code "Read CLAUDE.md and prompt-5c.md, then do Milestone 0".
> One milestone at a time; stop after each so the user can check. Report to the user **in Thai, briefly** (what changed / how to check / what is not done).

## 0. Why

Every Claude Code session loads `CLAUDE.md` (≈28 KB, mostly Thai, more than half is round-by-round history) and every round
updates `README.md` (≈191 KB, Thai). Thai text costs several times more tokens than English. Old `prompt-*.md` files sit at the root and get
picked up by searches. Large generated `.cs` files contain a single `// sa-spec:` line of ~8,000 characters.

Goal: **same information, far fewer tokens per session.** No feature changes, no behaviour changes, all tests still pass.

### Language policy (decided by the user — write it into CLAUDE.md)

| What | Language |
|---|---|
| `CLAUDE.md`, `README.md`, everything in `docs/`, prompts, design docs, commit messages | **English** |
| New or edited code comments | English (do not bulk-translate existing Thai comments — see question 3) |
| MCP tool descriptions and tool results (prompt-6) | English (Claude reads them; it explains to the user in Thai) |
| Web UI text, warnings/messages shown in the web, the `?` shortcut table | **Thai stays** (button / tool names are already English) |
| Claude Code's chat reports to the user | Thai, short |

Existing rules in `CLAUDE.md` still apply (CRLF, localhost only, do not break existing features, never edit the user's `.cs` files at the root,
no commit / push without permission, no fake API in the shim, spec changes go through the Logic API).

---

## 1. Move old prompts out of the root

- `git mv` every finished `prompt*.md` / `prompt-*-design.md` (prompt.md, 2, 3, 3b, 4, 4b–4e, 5, 5b + designs, `prompt-flowchart-later.md`) → `docs/prompts/`.
  Root keeps only: the **active** prompt(s) (`prompt-5c.md`, `prompt-6.md`), `CLAUDE.md`, `README.md`, `run-viewer.bat`, solution / project folders,
  the user's own files (`*.cs`, `*.assembly.json`, `link-API-Reference.txt`, the `.html` guide) — **do not move or touch user files**.
- `prompt-5.md` has an uncommitted user edit → keep that edit (move with the change, do not revert). `prompt-4d.md` is untracked → plain move.
- Fix every reference to moved files (CLAUDE.md, README, code comments, tests).
- Rule for the future (into CLAUDE.md): when a round is finished, its prompt + design move to `docs/prompts/`.

## 2. Split and translate README

- New structure (propose the exact list in M0), e.g. `docs/overview.md`, `docs/screen.md`, `docs/drawing-tools.md`, `docs/logic.md`,
  `docs/logic-api.md`, `docs/parameters.md`, `docs/code-generation.md`, `docs/viewer.md`, `docs/testing.md`, `docs/civil3d-testing.md`.
- `README.md` becomes a short English page: what the app is, how to run (`run-viewer.bat`), and an index linking to each `docs/` file
  with one line saying what is inside (so Claude can open only the file it needs).
- **Translate to English, do not summarise away facts.** Keep every rule, number, shortcut, example and caveat. Thai UI labels that appear
  in the web stay quoted as-is (e.g. the Thai text of a warning) so the docs still match the screen.
- Check: list README's old headings → each maps to a `docs/` file (put the mapping in the M2 report).

## 3. Slim CLAUDE.md (English)

Target **≤ 6 KB**. Keep only what every session needs:
- Project (3–4 lines), user (Soravis, civil/water engineer, knows AutoCAD / Civil 3D / SAC well, Python > C#, **talk to him in Thai**).
- Machines + git sync rules. **Update:** the user says this machine now has Civil 3D — confirm the machine name / Civil 3D 2027 path with the user in M0.
- Rules (all current ones + language policy above + token rules below).
- Tests: the one command from section 4.
- Current status: **only** the last finished round + what is next (one line each) + pointer to `docs/history.md`.
- Plan: 3–5 lines + pointer to the Trello board "SA Drawing Studio".

Move everything else (round 3 → 5b history, M-by-M notes, known limits) to `docs/history.md` in English, condensed (keep decisions, file names,
known limitations; drop step-by-step narration).

**Token rules (add to CLAUDE.md):**
- Read `docs/` files by topic; never read the whole docs folder or old prompts unless the task needs them.
- Never `cat` / read whole generated `.cs` files — the `// sa-spec:` line is huge. Use grep / line ranges, or load the spec through the web / tests.
- Prefer the quiet scripts (section 4); read full logs only when something fails.
- When updating docs, edit the one relevant `docs/` file; do not rewrite unrelated sections.
- Keep reports to the user short.

## 4. Quiet scripts

- `test-all.bat` (root): runs `dotnet run --project SA.Tests` + every `node SA.Tests/js/*.test.js`; prints **one summary line per suite + only the failures**
  (with the failing assertion), exit code ≠ 0 on failure. Full log written to a file under `SA.Tests/` (git-ignored) for when it is needed.
- If the test projects already print a lot, add a quiet flag rather than changing what they test.
- Use `test-all.bat` in CLAUDE.md's "Tests" section.

## 5. Milestones

| M | Work | How the user checks |
|---|---|---|
| 0 | `git status` (several user files are modified / untracked — list them, touch none), measure sizes (CLAUDE.md, README, prompts), propose `docs/` structure + CLAUDE.md outline, ask section 7 → write the answers at the top of `docs/prompts/prompt-5c-notes.md` | Answer questions |
| 1 | Sections 1 + 4 (move prompts, fix references, `test-all.bat`) — all tests pass | Root folder is clean; run `test-all.bat` |
| 2 | Section 2 (README → `docs/`, English) + heading mapping | Open README, follow a link or two |
| 3 | Section 3 (CLAUDE.md ≤ 6 KB English + `docs/history.md`) · report old vs new size of CLAUDE.md and README · ask permission to commit (one commit per milestone is fine) | Read the new CLAUDE.md (it is short) |

After M3: `prompt-5c.md` itself moves to `docs/prompts/`; next is `prompt-6.md` (already written in English).

## 6. Not in this round

- No feature or UI changes; no change to what tests check.
- Do not translate web UI text.
- Do not bulk-translate code comments (unless the user answers yes to question 3).
- Do not edit `prompt-6.md` except fixing paths that moved (e.g. "README section Logic API" → the new `docs/` file).

## 7. Questions for the user in M0 (proposed default — the user may answer "as proposed")

1. `docs/` file list — as proposed in M0.
2. Size target for CLAUDE.md — **≤ 6 KB**.
3. Existing Thai code comments — **leave them; translate only comments in code you edit anyway** (bulk translation costs many tokens once and makes huge diffs).
4. Design docs of future rounds (`prompt-N-design.md`) — **English**; the Thai answers the user gives in chat are recorded in English.
5. Machine with Civil 3D — confirm: is it this home machine (`desktop-gk62kqm`, `D:\test_cad\Subassembly-WebViewer`)? Civil 3D 2027 install path?
