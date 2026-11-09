# Round 6: MCP — let Claude (Claude Code / Claude Desktop) drive the web app; test on 3 existing files, then build into Civil 3D

> How to use: tell Claude Code "Read CLAUDE.md and prompt-6.md, then do Milestone 0". (Do `prompt-5c.md` first.)
> One milestone at a time; stop after each so the user can try it. Report to the user **in Thai, briefly** (what was done / how to try / what does not work yet).

## 0. Context

Read `CLAUDE.md`, the round 5 / 5b design docs (`docs/prompts/prompt-5-design.md`, `docs/prompts/prompt-5b-design.md`) and the Logic API doc (in `docs/` after prompt-5c).
Done in rounds 5 / 5b: `js/logicops.js` (Logic API — every logic edit is a pure function returning `{ ok, error, warnings }`), `Logic.describe`,
`Logic.toText`, `Logic.diffText`, the Conditions / Variables / Arrays trees, Loop.

**Goal (agreed with the user):** the user chats with Claude in the Claude Code or Claude Desktop window they already use (their existing plan,
**no API key**), and Claude drives the open web page through **MCP**. The user sees the drawing change live and **always accepts / rejects** AI edits himself.

Examples that must work at the end of the round:
1. "Add a berm every 3 m, and if the fill is higher than 6 m use rock pitching" → Claude reads the current subassembly, edits through the Logic API,
   runs scenarios / compile itself, then waits for the user to accept.
2. "This pavement has no codes — set them, and turn the hard-coded layer thicknesses into parameters" → Claude reads `toText` / `sa_render` and proposes the whole edit.
3. "New subassembly: trapezoid base, top width 2 m, depth 2 m, slope 1:1.5, extend to ground if the ground is lower" → Claude asks what was not said,
   then draws with meaningful definitions (referencing parameters / other points, not fixed coordinates).

**Test set for this round = 3 files at the repo root (all contain `sa-spec`):**

| File | Class | What it tests |
|---|---|---|
| `pavement-assembly.cs` | `PavementAssembly` | Large (~50 points, Follow Surface, fillet, 3 shapes) but **almost no point / link codes** and many hard-coded numbers → AI sets codes / creates parameters |
| `base_rock-pitching-web.cs` | `RockPitchingBaseWeb` | Known correct answer (`buildBase()`) → AI **redraws it from a text description**; compare every scenario |
| `body_rock-pitching-web.cs` | `RockPitchingBodyWeb` | Has logic (conditions `IsCut` / `IsCut2` are identical, Cut/Fill slope parameters possibly unused) → AI reads logic / finds duplicates / edits logic |

**The user's real task this round: in all 3 files the bottom-most boundary must carry the code `Datum`** — in every case
(cut / fill / hits ground / misses ground / `firstOf` fallback branches). Some links already have it; check the whole boundary in every scenario, not only the default one.

**The user allows editing these 3 files, but only through the web:** AI proposes via MCP → user accepts → user presses the web's **Save (.cs)** over the original file.
- **Claude Code must not edit the `.cs` text or the `sa-spec` by hand or by script.** If the web cannot do something, that is a web feature to add, not a shortcut.
- Some of these files are uncommitted → **before the first edit, ask the user's permission to commit the 3 files as they are now** (restore point).
- Automated tests must still copy the files to a temp folder first and never touch the originals (check with a hash before / after).
- Drawing from a CAD screenshot is postponed to the next prompt (see section 8).

**Must not change:** the AI **never writes files** (no Save .cs, no Save project) — every AI edit is a *proposal* in the web; the user accepts and then saves with the
existing buttons. The AI cannot accept on the user's behalf. The server still listens on localhost only.

All rules in `CLAUDE.md` apply (CRLF, localhost, don't break existing features, never edit the user's `.cs` files outside the flow above, no commit / push without
permission, update docs + CLAUDE.md status, say whether `run-viewer.bat` must be restarted, no fake API in the shim, spec changes through the Logic API,
stop any SA.Web you started for testing, token rules).

---

## 1. Complete the Logic API for "drawing from scratch"

The Logic API covers logic + the round-4c tools; drawing also needs the basics. Wrap what exists in `spec.js` into `logicops.js` with the same shape
(`{ ok, error, warnings, result }`):
- `newSubassembly(name, opts)` (class name, Side, targets) · `addParam` / `editParam` / `removeParam` (incl. units Slope / Length / Percent, bounds)
- `addPoint(def, codes, opts)` for every point type (delta, polar, slopeLength, slopeToSurface, onSurface, between, intersect, …) · `editPoint` / `setCodes` / `setAuxiliary` / `removeObjects`
- `addLink` (straight / Follow Surface / arc / fillet) · `addShape` · `addPolygon` / `addRegularPolygon` · `addRotateGroup` · Move / Copy via the existing `Ops`
- **`applyBatch(spec, ops[])`** — a list of `{ fn, args }` run in order, **all or nothing** (an error anywhere = original spec returned + which op failed + why).
  Ids created by an op can be referenced by later ops (e.g. `"$1.result"`, or a safer form proposed in M0).
- `catalog()` — functions + parameters + one-line descriptions (English) for the AI — **generated from the same source as the Logic API doc**, not written twice.
- Node tests: every new function + `applyBatch` (success / failure midway = spec unchanged / referencing earlier results) · redraw base rock-pitching with
  `applyBatch` only and get the same result as `buildBase()`.

## 2. MCP architecture (propose in M0 — verify the real thing first)

The Logic API runs in the **browser** (spec / workspace live in the page), so the proposal is:
```
Claude Code / Claude Desktop ──MCP──► SA.Web (localhost:5050/mcp) ──► open web page (WebSocket / SSE) ──► Logic API on a proposal copy
                                         ▲                                   │
                                         └──────── result / diffText / image ◄┘
```
- The MCP endpoint lives in SA.Web (nothing extra to run). **M0 must check from official docs** how Claude Code and Claude Desktop connect to MCP servers today
  (HTTP / Streamable HTTP directly, or a stdio bridge) and which MCP C# SDK works with net8.0 (package name / version). Do not guess. If no SDK fits, hand-write the minimum JSON-RPC.
- If Claude Desktop needs stdio: a tiny bridge (e.g. `SA.Mcp` console app or script) forwarding to `localhost:5050/mcp`. Claude Code uses HTTP directly if possible.
- **No web page open** → tool returns "Open http://localhost:5050 first (run-viewer.bat)" immediately, no hang. Several tabs → use the most recently active one and say so.
- **Security:** localhost only; validate `Host` / `Origin` (DNS rebinding, other web pages in the browser); no tool writes files or runs system commands;
  the AI only sends Logic API ops (never eval code it sends).

## 3. Proposals — the AI edits, the user decides

- Every editing tool **does not touch the real spec**; it creates / extends a **proposal** for that subassembly (spec copy + list of ops).
- The web shows the proposal live: drawing from the proposal spec, AI changes **highlighted** (added / changed / removed in different colours), and an
  **"AI proposal"** panel (Thai label in the UI; new dock tab or floating panel — propose in M0) with `diffText` + warnings + the AI's `summary`.
- Buttons: **Accept all** (= one undo step) / **Reject** / **Step through** (view the result after op k — accepting up to k only if easy, otherwise skip).
- While a proposal is pending and the user edits that subassembly himself → see question 3.
- Status badge: "Claude connected" + number of pending proposals (Thai UI text).

## 4. Tools (English names, English descriptions and results — Claude explains to the user in Thai)

| Tool | Does | Edits? |
|---|---|---|
| `sa_status` | web open?, workspace contents (assemblies / subassemblies / selected / editable), pending proposals | no |
| `sa_describe` | `describe` + `toText` (with current values) of a subassembly | no |
| `sa_get_spec` | full spec JSON (read-only) — use only when `sa_describe` is not enough | no |
| `sa_catalog` | `catalog()` + point / link types + key rules (Side Right, slope, auxiliary, …) | no |
| `sa_render` | **PNG** of the section (real or proposal) with point names / dimensions / ground, choose scenario | no |
| `sa_check` | evaluate + compile the generated code (no file written) → messages, compile errors, branch / Loop coverage, every scenario + **bottom-most boundary per scenario: which links, which codes, which stretches lack a given code (e.g. `Datum`)** | no |
| `sa_code_preview` | generated C# (text) | no |
| `sa_new` | new subassembly in the selected assembly (as a proposal) | proposal |
| `sa_apply` | `applyBatch(ops)` into the proposal + `summary` for the user → per-op results, cumulative `diffText`, warnings | proposal |
| `sa_scenarios` | list / add scenarios (polyline ground + parameter values) to cover every branch — adding = proposal | proposal |
| `sa_proposal` | proposal status (pending / accepted / rejected) or **cancel its own proposal** — cannot accept | proposal |

**Keep tool output small (token budget):**
- Short summary first; details only on request (e.g. `detail: "full"`). Default results must not dump the whole spec.
- Prefer `toText` / `diffText` / ids over JSON; `sa_get_spec` is the exception, used rarely.
- `sa_render`: modest default size; Claude calls it when needed, not after every op.
- Errors: one line + how to fix.

- MCP **resource / prompt `sa_guide`** (the AI reads it before working): drawing rules — meaningful point definitions (parameters / other points, not coordinates),
  "a point that a real link ends on must be a real point", Side Right + mirror, slope 1:x, which tool for follow-ground / extend-to-ground, set codes completely
  (Civil 3D Code Set Styles use codes for labels / hatches), **ask the user when information is missing** (unstated dimensions, what is a parameter, what follows the ground, codes),
  after edits run `sa_check` (and `sa_render` when the shape changed), then summarise with `toText`. Real examples: base / body rock-pitching (`rockpitching.test.js`).
- MCP prompt `edit_logic` (guide for conditions / variables / Loop), same style, if not hard.

## 5. Setup / docs

- New doc **"Connect Claude (MCP)"**: step by step for **Claude Code** and **Claude Desktop** (Windows config locations, what to paste, how to check it connected)
  + 5 example requests + what the AI cannot do (write files, accept by itself).
- `run-viewer.bat` also prints the MCP URL.
- If config can be automated safely (e.g. `claude mcp add …`), **tell the user to run it**; never edit config files outside the project yourself.

## 6. Tests

(Every test using the 3 files works on temp copies — originals unchanged, verified by hash.)

- Node: section 1 + `applyBatch` + `catalog` matches the real functions.
- C#: MCP endpoint — `initialize` / `tools/list` / `tools/call` per the MCP spec, no-web-page case, foreign `Origin` rejected.
- End-to-end (test MCP client or script; Playwright if available, otherwise a manual checklist): open the web → import the 3 files →
  `sa_describe` works on all 3 / `sa_render` returns an image / `sa_check` compiles ·
  `sa_new` + `sa_apply` redraw base rock-pitching → accept → every scenario equals `base_rock-pitching-web.cs` ·
  `sa_apply` sets codes on 3–4 pavement points → reject = original spec · proposal failing midway = nothing changes ·
  bottom boundary: `sa_check` reports missing `Datum` stretches correctly (a case with a known answer); after adding codes = no gaps in any scenario of all 3 files (on copies).
- All existing tests pass (`test-all.bat`).

## 7. Milestones

| M | Work | How the user tries it |
|---|---|---|
| 0 | `git status`, tests pass, **check how Claude Code / Claude Desktop connect to MCP today + C# SDK**, propose architecture / tool list / proposal panel / op format, ask section 9 → `prompt-6-design.md` (English) | Answer questions |
| 1 | Section 1: Logic API + `applyBatch` + `catalog` + tests | (behind the scenes) test results + Logic API doc |
| 2 | MCP endpoint + bridge to the page + read-only tools (`sa_status`, `sa_describe`, `sa_get_spec`, `sa_catalog`, `sa_render`, `sa_check`, `sa_code_preview`) + setup doc | Connect Claude Code, ask "what does this subassembly do?" |
| 3 | Proposals + `sa_apply` / `sa_new` / `sa_scenarios` / `sa_proposal` + accept / reject panel | Ask for "a berm every 3 m", accept / reject |
| 4 | `sa_guide` (+ `edit_logic`) + Claude Desktop + full test with the 3 files — write example requests for the user: **(main) add `Datum` to the bottom boundary of all 3 files**, explain, codes + parameters for pavement, redraw base from text, clean the duplicate logic in body · ask permission to commit the 3 files before the user starts editing | Ask Claude to add `Datum` → review the proposal → accept → Save (.cs) over the original |
| 5 | Wrap-up: docs, **build the DLL for the user** (7.1), `tests-civil3d/round6-checklist.md` (English is fine; the user reads Thai or English) — the 3 files edited via the web → user loads the DLL into Civil 3D (**this machine has Civil 3D now**) → check: same section shape as before (`git diff` shows only code changes), `Datum` continuous along the corridor (a corridor surface built from `Datum` links has no holes, in cut and fill), no errors in the Event Viewer · update CLAUDE.md status | Test in Civil 3D |

### 7.1 Build the DLL for Civil 3D (M5 — the user agreed Claude Code builds it)

- `tests-civil3d/build/`: a small build project (target framework as Civil 3D 2027 requires — check docs / the installed DLLs, do not guess) referencing the installed
  Civil 3D / AutoCAD DLLs (auto-detect the install path or one property to set · `Copy Local = false` · **never commit Autodesk DLLs**), compiling the selected `.cs` files (the 3 of this round) → one DLL.
- `build-c3d.bat` at the root: one command → DLL, **prints only a short summary** (success / output path / only the error lines). If the DLL is locked
  (Civil 3D running with it loaded) print "ปิด Civil 3D ก่อน" (close Civil 3D first) instead of a long error.
- Compiling against the real API also checks the shim: shim passes but the real API fails = the shim is wrong → report to the user + fix the shim to match reality
  (do not change the generated code to dodge it).
- Claude Code **never opens or drives Civil 3D** — loading the DLL, building the corridor, checking the Datum surface are the user's steps in the checklist.
- Docs: how to run `build-c3d.bat` + how to load the DLL into Civil 3D.

## 8. Not in this round

- AI chat panel inside the web / BYOK API key / Chat-Code modes of the public site
- AI writing files / accepting by itself / running commands
- Real core / host split (but MCP code is host-side — do not duplicate spec logic in C#; reuse the Logic API)
- Flowchart
- **Drawing from a CAD screenshot** (MCP prompt `draw_from_sketch` + splitting a drawing into several subassemblies + mandatory questions about the ground line /
  thicknesses without dimensions / unlabelled lines) → next prompt, with real test images. `sa_render` is still built now.

## 9. Questions for the user in M0 (proposed default — the user may answer "as proposed")

1. Which client first — **Claude Code first** (simpler), Claude Desktop in M4.
2. Proposal panel — **new "AI" tab in the bottom dock** + status badge.
3. User edits the subassembly while a proposal is pending — **allowed; the proposal is cancelled with a notice** (the AI must re-read and propose again).
4. Partial accept — **only Accept all / Reject / Step through (view only)** this round.
5. `sa_render` shows point names / dimensions / ground — **yes**.
6. May the AI create a new subassembly — **yes (as a proposal)**.
