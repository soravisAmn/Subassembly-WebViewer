# Connect Claude (MCP)

Claude drives the open web page through MCP, using your existing Claude plan (no API key). The server listens on localhost only.

So far the tools only read. Editing through proposals you accept comes in M3.

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

## Bottom boundary

In each scenario, the lower envelope of the real links: at each offset, the lowest link. Auxiliary links do not count, links that do not occur in that scenario do not count, and vertical segments never count. Overlapping links count together, so a code on either one covers the stretch. Logic: `js/boundary.js`.

Scenarios: `high`, `low`, `mid`, `rising`, `falling`, `V`, `layout`, `no target`, each Right and Left, plus every saved scenario that contains this subassembly.

## What the AI cannot do

Write files, save projects, run commands, or accept a proposal for you. Requests are limited to this machine; other web pages and other hosts are refused (`Host` / `Origin` check).
