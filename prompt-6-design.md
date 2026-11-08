# Round 6 design (M0, 2026-11-09)

## Answers to the M0 questions

Answered 2026-11-09: as proposed for 1-9, with these details.

- **Item 7, bottom boundary** = the lower envelope of all real links in each scenario (at each offset, the lowest link). Auxiliary links do not count. Optional links count only in scenarios where they occur. Vertical end segments do not count. Missing-code stretches are reported as offset from-to + link name.
- **Item 8**: fixtures in `SA.Tests/fixtures/round6/` are locked from the files as they are now, before the user adds `Datum`, so tests have real gaps to catch.
- **Item 9**: the user allowed committing `pavement-assembly.cs` and `body_rock-pitching-web.cs` at the start of M1.

## Repo state

- Tests: `test-all.bat` passes, 437 / 0.
- Test files: `base_rock-pitching-web.cs` is committed. `body_rock-pitching-web.cs` and `pavement-assembly.cs` have uncommitted user edits (restore-point question below).

| File | spec size | Points (no code) | Links (no code) | Shapes | Params | Conditions | Links with `Datum` | Link types |
|---|---|---|---|---|---|---|---|---|
| `pavement-assembly.cs` | 7.8 KB | 49 (49) | 61 (59) | 3 | 2 | 0 | 2 | line, followSurface, fillet |
| `base_rock-pitching-web.cs` | 2.2 KB | 8 (2) | 7 (1) | 1 | 4 | 0 | 1 | line, followClipped |
| `body_rock-pitching-web.cs` | 5.2 KB | 16 (10) | 15 (8) | 2 | 10 | 2 | 2 | line, followClipped |

## What was verified (official docs, 2026-11-09)

- **Claude Code** (installed: 2.1.319): connects directly over HTTP. `claude mcp add --transport http sa-studio http://localhost:5050/mcp`. Check with `claude mcp list` or `/mcp`. SSE is deprecated. OAuth starts only when a server answers 401 / 403, so a local server without auth connects directly. Output: warning above 10,000 tokens, limit 25,000 by default; text above 50,000 characters is saved to a file. Source: code.claude.com/docs/en/mcp.
- **Claude Desktop**: "custom connectors" connect from Anthropic's cloud, so **localhost cannot work that way**. Local servers go in `%APPDATA%\Claude\claude_desktop_config.json` as `command` + `args`, i.e. stdio, so **a stdio bridge is required**. Restart Desktop after editing; logs in `%APPDATA%\Claude\logs`. Sources: support.claude.com articles 11175166 and 10949351, modelcontextprotocol.io/docs/develop/connect-local-servers.
- **C# SDK**: NuGet `ModelContextProtocol.AspNetCore` 2.4.0 (latest stable) has a `net8.0` target. To be proven by a real build in M2.
- **Streamable HTTP spec**: single endpoint (POST + GET; GET may return 405), notifications get 202, the response may be plain JSON, servers MUST validate `Origin` and should bind to localhost.
- **Images**: the MCP spec defines image content in tool results (`type: image`, base64 `data`, `mimeType`). The Claude Code docs have a section "Images in tool results"; image data stays subject to `MAX_MCP_OUTPUT_TOKENS`, so `sa_render` keeps a modest default size.

## Architecture

```
Claude Code ───────HTTP────────────────► SA.Web /mcp ──WebSocket /mcp-page──► open page: Logic API on a proposal copy
Claude Desktop ─stdio─► SA.Mcp/bridge.js ──HTTP──▲           ▲                        │
                                                 └─ result / diffText / PNG ◄─────────┘
```

- **Endpoint**: in SA.Web via the SDK (`MapMcp("/mcp")`), stateless JSON mode if the SDK allows it. If the SDK does not fit, hand-write the minimum JSON-RPC.
- **C# stays thin**: each tool forwards `{ id, tool, args }` to the page and awaits the reply (timeout 20 s, one-line error). No spec logic in C#. Compile uses the existing endpoints.
- **Page link**: WebSocket. The page reconnects by itself (`dotnet watch` restarts the server). Each tab reports focus; the most recently active one is used and the result says so.
- **No page open**: immediate error "Open http://localhost:5050 first (run-viewer.bat)".
- **Bridge**: one small Node script with no packages (Node is already required), no third-party `npx` package.
- **Security**: localhost binding stays. Middleware on `/mcp` and `/mcp-page`: `Host` must be localhost / 127.0.0.1; `Origin`, when present, must be this app's own origin, else 403. No tool writes files or runs commands. Ops are data checked against the catalog; nothing sent is ever evaluated. No auth token: a local program could read and create proposals, but only the user can accept them.

## Op format for `applyBatch` / `sa_apply`

```json
[
  { "as": "p2", "fn": "addPoint", "args": [{ "type": "delta", "from": "P1", "dx": "Width", "dy": "0" }, ["CrestOutside"]] },
  { "fn": "addLink", "args": ["P1", "${p2.result}", { "codes": ["Top"] }] },
  { "fn": "addParam", "args": [{ "name": "H", "default": 3, "unit": "length" }] },
  { "as": "q", "fn": "addPoint", "args": [{ "type": "delta", "from": "P1", "dx": "0", "dy": "${p2.result}.y - H" }] }
]
```

- `as` names a result. `${name.path}` is substituted in any string, including expressions. A string that is exactly one `${...}` keeps the value's type (arrays, objects). An unknown name fails the batch.
- Preferred over the drafted `"$1.result"`: inserting an op does not renumber references.
- `fn` must be in the catalog. All or nothing: failure returns the original spec + op index + reason.
- **Catalog source**: a `Logic.META` table in `logicops.js` (name, params, one-line description). `catalog()` reads it, the function table in `docs/logic-api.md` is generated from it, and a test fails if the doc or the real functions differ.

## Proposals (page side)

- `proposal = { id, itemId, baseSpec, spec, ops, summary, status }`, in memory. A page refresh drops it and the AI is told.
- While pending, the drawing evaluates `proposal.spec`. Highlights come from comparing ids and definitions with `baseSpec`: added / changed / removed in separate colours, removed objects as ghosts.
- **Accept all** = one `History.act` step, `spec` replaced. **Reject** discards. **Step through** replays ops up to k on a copy, view only.
- Accepting never saves a file; the user presses Save (.cs).
- `sa_new` creates a proposal-only item that exists for real only after Accept.

## Tools

As in prompt-6 section 4, with defaults kept small: short summary first, `detail: "full"` on request. `sa_get_spec` fits the limits (largest spec here 7.8 KB). `sa_code_preview` omits the `// sa-spec:` line.

`sa_render`: a standalone SVG built from the evaluate result (not a copy of the live view), converted to PNG in the page. Default about 900 × 500.

## Bottom boundary check in `sa_check`

For each scenario, Right and Left: at every x breakpoint of real link segments, the lowest real link at that x forms the boundary; vertical segments are skipped. Report stretches as `x1..x2, link, codes`, and those missing the requested code. Scenarios = saved ones + generated set (flat high, flat low, sloped, V shape, Layout, no target).

## End-to-end testing

Playwright is not installed. Proposal: a Node MCP test client in `SA.Tests` for the endpoint, and the page steps run in the Claude app's browser pane, recorded in a checklist. No new dependency.

## Questions

1. Client order: Claude Code first, Desktop in M4.
2. Proposal panel: new "AI" tab in the bottom dock + status badge.
3. User edits while a proposal is pending: allowed; the proposal is cancelled with a notice.
4. Partial accept: only Accept all / Reject / Step through (view only).
5. `sa_render` shows point names / dimensions / ground: yes.
6. AI may create a new subassembly: yes, as a proposal.
7. Bottom boundary counts all real links (not only shape outlines): proposed yes.
8. prompt-6 tests use temp copies of the 3 root files, but `CLAUDE.md` now forbids tests reading root files. Proposed: lock the current 3 files into `SA.Tests/fixtures/round6/` and test only those.
9. Restore point: commit `pavement-assembly.cs` and `body_rock-pitching-web.cs` as they are now, when M4 starts (prompt-6 asks for this before the first edit). Item 8 needs those two versions earlier, at M1, so ask for one permission now.
