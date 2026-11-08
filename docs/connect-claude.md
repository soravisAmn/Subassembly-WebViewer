# Connect Claude (MCP)

Claude drives the open web page through MCP, using your existing Claude plan (no API key). The server listens on localhost only.

Claude never changes your subassembly directly: every edit is a proposal you accept or reject in the web.

## Claude Code

1. Start the viewer with `run-viewer.bat` and open http://localhost:5050.
2. Run once in a terminal:

   ```bash
   claude mcp add --transport http sa-studio http://localhost:5050/mcp
   ```

3. Check with `claude mcp list` (should show Connected), or `/mcp` inside Claude Code.
4. Ask, for example: "What does the selected subassembly do?"

The web page must be open; otherwise tools answer "Open http://localhost:5050 first (run-viewer.bat)." With several tabs, the most recently active one is used.

## Claude Desktop

A stdio bridge is required, because Desktop's custom connectors connect from Anthropic's cloud and cannot reach localhost. It arrives in M4.

## Tools

| Tool | Does |
|---|---|
| `sa_status` | Web open?, assemblies, subassemblies, selected / editing |
| `sa_describe` | Short JSON + text view with current values |
| `sa_get_spec` | Full spec JSON (rarely needed) |
| `sa_catalog` | Logic API functions, point / link types, rules |
| `sa_render` | PNG of the section. `scenario`: a name from `sa_check` or `{ ground, values, layout }`. `labels`: points, all, none. Default 900 x 500 |
| `sa_check` | Compile, every scenario Right + Left, branch / Loop coverage, bottom boundary. `code: "Datum"` lists missing stretches. `detail: "full"` lists every stretch |
| `sa_code_preview` | The generated drawing method. `detail: "full"` gives the whole file (about 40,000 characters) |
| `sa_new` | Proposes a new subassembly in the current assembly; it exists only after you accept |
| `sa_apply` | Runs Logic API ops on the proposal, all or nothing. Returns named results, warnings and a diff |
| `sa_scenarios` | Lists scenarios, or adds one to the proposal (ground + parameter values) |
| `sa_proposal` | Status of a proposal, or cancels Claude's own. It cannot accept |

Read tools show the pending proposal when there is one; `view: "real"` shows the subassembly as it is.

## Proposals

- The AI tab in the bottom dock lists pending proposals: Claude's summary, a diff, warnings, and the buttons **"รับทั้งหมด"** / **"ปฏิเสธ"**. With more than one op, a slider steps through the result (view only).
- While a proposal is pending, the drawing shows it instead: green = added, orange = changed, red dashes = removed.
- Accepting is one Undo step and does not write a file; press **Save (.cs)** yourself.
- If you edit the subassembly while a proposal is pending, the proposal is cancelled with a notice, and Claude is told to read again.
- Proposals live in the page: refreshing it drops them. There is at most one pending proposal per subassembly.
- The footer shows "Claude เชื่อมต่อแล้ว" once a tool has been called in this page session, with the number of pending proposals.

## Bottom boundary

In each scenario, the lower envelope of the real links: at each offset, the lowest link. Auxiliary links do not count, links that do not occur in that scenario do not count, and vertical segments never count. Overlapping links count together, so a code on either one covers the stretch. Logic: `js/boundary.js`.

Scenarios: `high`, `low`, `mid`, `rising`, `falling`, `V`, `layout`, `no target`, each Right and Left, plus every saved scenario that contains this subassembly.

## What the AI cannot do

Write files, save projects, run commands, or accept a proposal for you. Requests are limited to this machine; other web pages and other hosts are refused (`Host` / `Origin` check).
