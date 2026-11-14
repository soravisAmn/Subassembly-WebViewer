// MCP endpoint (host side). The spec lives in the browser, so the tools forward to the open page over a WebSocket.
// No spec logic here: the page runs the Logic API. No tool writes files or runs commands. Exception: sa_build_check
// (round 7) runs the read-only pre-build checks on the server (SA.Build.BuildEngine.Check), on the saved files.
using System.Collections.Concurrent;
using System.ComponentModel;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;

namespace SA.Mcp;

// The open web pages. The most recently active one answers tool calls.
public sealed class PageHub
{
    public const string NoPage = "Open http://localhost:5050 first (run-viewer.bat).";
    sealed class Conn { public WebSocket Ws = null!; public long Active; public readonly SemaphoreSlim Send = new(1, 1); }

    readonly ConcurrentDictionary<Guid, Conn> _conns = new();
    readonly ConcurrentDictionary<string, TaskCompletionSource<JsonElement>> _waiting = new();
    long _clock;

    public int Count => _conns.Count;
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(20);

    // Serves one page until its socket closes.
    public async Task RunAsync(WebSocket ws, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        var conn = new Conn { Ws = ws, Active = Interlocked.Increment(ref _clock) };
        _conns[id] = conn;
        var buf = new byte[64 * 1024];
        try
        {
            while (ws.State == WebSocketState.Open)
            {
                using var ms = new MemoryStream();
                WebSocketReceiveResult r;
                do
                {
                    r = await ws.ReceiveAsync(buf, ct);
                    if (r.MessageType == WebSocketMessageType.Close) return;
                    ms.Write(buf, 0, r.Count);
                } while (!r.EndOfMessage);
                Handle(conn, ms.ToArray());
            }
        }
        catch (Exception e) when (e is WebSocketException or OperationCanceledException) { }
        finally { _conns.TryRemove(id, out _); }
    }

    void Handle(Conn conn, byte[] data)
    {
        JsonElement msg;
        try { msg = JsonDocument.Parse(data).RootElement.Clone(); } catch (JsonException) { return; }
        if (msg.TryGetProperty("active", out _)) { conn.Active = Interlocked.Increment(ref _clock); return; }
        if (msg.TryGetProperty("id", out var idEl) && idEl.GetString() is { } rid && _waiting.TryRemove(rid, out var tcs)) tcs.TrySetResult(msg);
    }

    // Sends a tool call to the most recently active page. Null = no page open.
    public async Task<JsonElement?> CallAsync(string tool, object args, CancellationToken ct)
    {
        var target = _conns.Values.OrderByDescending(c => c.Active).FirstOrDefault();
        if (target == null) return null;
        var id = Guid.NewGuid().ToString("N");
        var tcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        _waiting[id] = tcs;
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(new { id, tool, args, tabs = _conns.Count });
            await target.Send.WaitAsync(ct);
            try { await target.Ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct); }
            finally { target.Send.Release(); }
            return await tcs.Task.WaitAsync(Timeout, ct);
        }
        finally { _waiting.TryRemove(id, out _); }
    }
}

[McpServerToolType]
public sealed class SaTools(PageHub hub)
{
    static CallToolResult Fail(string text) => new() { IsError = true, Content = [new TextContentBlock { Text = text }] };

    async Task<CallToolResult> Forward(string tool, object args, CancellationToken ct)
    {
        JsonElement? reply;
        try { reply = await hub.CallAsync(tool, args, ct); }
        catch (TimeoutException) { return Fail("The web page did not answer in time. Check that the page is not stuck, then try again."); }
        catch (WebSocketException) { return Fail("Lost the connection to the web page. Try again."); }
        if (reply == null) return Fail(PageHub.NoPage);
        var r = reply.Value;
        if (r.TryGetProperty("error", out var err)) return Fail(err.GetString() ?? "Error.");
        var content = new List<ContentBlock>();
        if (r.TryGetProperty("text", out var text)) content.Add(new TextContentBlock { Text = text.GetString() ?? "" });
        if (r.TryGetProperty("image", out var img)) content.Add(ImageContentBlock.FromBytes(Convert.FromBase64String(img.GetString() ?? ""), "image/png"));
        return new CallToolResult { Content = content };
    }

    [McpServerTool(Name = "sa_status", ReadOnly = true), Description("Whether the web page is open, its assemblies and subassemblies, which one is selected or being edited, pending proposals. Call this first.")]
    public Task<CallToolResult> Status(CancellationToken ct = default) => Forward("sa_status", new { }, ct);

    [McpServerTool(Name = "sa_describe", ReadOnly = true), Description("Parameters, conditions, branches, objects and a text view (with current values) of a subassembly's drawn part.")]
    public Task<CallToolResult> Describe([Description("Subassembly id, name, file or class. Default: the one being edited or selected.")] string? item = null, [Description("real = ignore a pending proposal.")] string? view = null, CancellationToken ct = default) => Forward("sa_describe", new { item, view }, ct);

    [McpServerTool(Name = "sa_get_spec", ReadOnly = true), Description("Full spec JSON. Use only when sa_describe is not enough.")]
    public Task<CallToolResult> GetSpec(string? item = null, string? view = null, CancellationToken ct = default) => Forward("sa_get_spec", new { item, view }, ct);

    [McpServerTool(Name = "sa_new"), Description("Propose a new subassembly in the current assembly. It exists only after the user accepts. Ask the user first about anything not stated.")]
    public Task<CallToolResult> New([Description("C# class name.")] string name, string? summary = null, [Description("Target surface names. Default: TargetSurface.")] string[]? targets = null, CancellationToken ct = default) => Forward("sa_new", new { name, summary, targets }, ct);

    [McpServerTool(Name = "sa_apply"), Description("Apply Logic API ops to a proposal, all or nothing. Never changes the real subassembly: the user accepts in the web. See sa_catalog for functions.")]
    public Task<CallToolResult> Apply([Description("[{ fn, args, as? }]; \"${name.result}\" in a string reads an earlier op's result.")] JsonElement ops,
        [Description("One or two sentences for the user, in Thai.")] string summary, string? item = null, CancellationToken ct = default) => Forward("sa_apply", new { item, ops, summary }, ct);

    [McpServerTool(Name = "sa_scenarios"), Description("List scenarios, or add one to the proposal (ground polyline relative to the subassembly origin + parameter values) to cover every branch.")]
    public Task<CallToolResult> Scenarios([Description("list (default) or add.")] string? action = null, string? name = null,
        [Description("[{x,y}], at least 2 points, or omit for no ground.")] JsonElement? ground = null, JsonElement? values = null, bool? layout = null, string? item = null, CancellationToken ct = default) => Forward("sa_scenarios", new { item, action, name, ground, values, layout }, ct);

    [McpServerTool(Name = "sa_proposal"), Description("Status of a proposal, or cancel your own. Only the user can accept.")]
    public Task<CallToolResult> Proposal([Description("status (default) or cancel.")] string? action = null, string? id = null, string? item = null, CancellationToken ct = default) => Forward("sa_proposal", new { action, id, item }, ct);

    [McpServerTool(Name = "sa_catalog", ReadOnly = true), Description("Logic API functions, point and link types, op format and the drawing guide. Read this before the first edit.")]
    public async Task<CallToolResult> Catalog(CancellationToken ct = default)
    {
        var r = await Forward("sa_catalog", new { }, ct);
        if (r.IsError != true) r.Content.Add(new TextContentBlock { Text = McpGuide.Read("sa_guide.md") });
        return r;
    }

    [McpServerTool(Name = "sa_render", ReadOnly = true), Description("PNG of the cross-section with ground, point names and dimensions. Use when the shape matters, not after every edit.")]
    public Task<CallToolResult> Render(string? item = null,
        [Description("Scenario name from sa_check, or { ground: [{x,y}], values: {}, layout: false }. Default: the current workspace.")] JsonElement? scenario = null,
        [Description("Labels: points (default), all (points and links), none.")] string? labels = null,
        int? width = null, int? height = null, string? view = null, CancellationToken ct = default) => Forward("sa_render", new { item, scenario, labels, width, height, view }, ct);

    [McpServerTool(Name = "sa_check", ReadOnly = true), Description("Compiles the generated code (no file written) and evaluates every scenario, Right and Left: messages, branch and Loop coverage, and the bottom boundary (lower envelope of real links). Give code (e.g. Datum) to list offset stretches lacking it.")]
    public Task<CallToolResult> Check(string? item = null,
        [Description("Code the bottom boundary must carry, e.g. Datum.")] string? code = null,
        [Description("summary (default) or full.")] string? detail = null, string? view = null, CancellationToken ct = default) => Forward("sa_check", new { item, code, detail, view }, ct);

    [McpServerTool(Name = "sa_code_preview", ReadOnly = true), Description("The generated drawing method in C#. No file is written. detail: full gives the whole file (long).")]
    public Task<CallToolResult> CodePreview(string? item = null, string? detail = null, string? view = null, CancellationToken ct = default) => Forward("sa_code_preview", new { item, detail, view }, ct);

    // Round 7: runs on the server (the files on disk, as the Build would compile them), not in the page. Never builds.
    [McpServerTool(Name = "sa_build_check", ReadOnly = true), Description("Pre-build checks of a project (*.assembly.json) as the Build dialog runs them, on the saved .cs files: class names, simulator compile and runs (every scenario Right + Left), links / shapes without codes, codes differing only by case, locked or same-named DLL, parameter changes since the last build. Never builds: the user presses Build.")]
    public CallToolResult BuildCheck(IServiceProvider services,
        [Description("Project file name, e.g. SR03 or SR03.assembly.json. Default: the only project in the folder.")] string? project = null,
        [Description("DLL name. Default: the project name.")] string? dllName = null,
        [Description("Civil 3D years to check, e.g. [2027]. Default: every version that can be built.")] int[]? years = null)
    {
        if (services.GetService(typeof(SA.Build.BuildEngine)) is not SA.Build.BuildEngine eng) return Fail("Build is not available in this server.");
        if (string.IsNullOrWhiteSpace(project))
        {
            var all = eng.ProjectNames();
            if (all.Count != 1) return Fail(all.Count == 0 ? "No *.assembly.json in the folder. Save the project first." : $"Pass project. Projects: {string.Join(", ", all)}.");
            project = all[0];
        }
        years ??= eng.Installs().Where(i => i.CanBuild).Select(i => i.Year).ToArray();
        var r = eng.Check(new SA.Build.CheckRequest(project, dllName, years, null, null));
        var lines = new List<string>
        {
            $"Project {r.Project ?? project}, DLL {r.DllName}.dll, years {(years.Length > 0 ? string.Join(", ", years) : "none buildable")}. {(r.Ok ? "No blocking error." : "BLOCKING ERRORS: Build is not possible.")} Scenario runs: {r.ScenarioRuns}.",
            "Classes: " + string.Join(", ", r.Classes.Select(c => $"{c.FullName} ({c.File}{(r.WebFiles.Contains(c.File) ? ", web" : ", hand-written")})")),
        };
        foreach (var y in r.Years.Where(y => years.Contains(y.Year)))
            lines.Add($"Civil 3D {y.Year} ({y.Tfm}): {(y.CanBuild ? $"output {y.OutDir}{(y.Locked ? ", DLL LOCKED" : "")}{(y.HasManifest ? $", {y.Changes.Count} parameter change(s) since last build" : ", never built")}" : "cannot build: " + y.Reason)}");
        foreach (var i in r.Issues)
            lines.Add($"{i.Severity.ToUpperInvariant()} [{i.Kind}] {(i.File != null ? i.File + ": " : "")}{i.Message}{(i.Scenarios is { Count: > 0 } ? $" (scenarios: {string.Join(", ", i.Scenarios.Take(6))}{(i.Scenarios.Count > 6 ? ", …" : "")})" : "")}");
        if (r.Issues.Count == 0) lines.Add("No warnings.");
        lines.Add("Messages are in Thai as the user sees them in the Build dialog.");
        return new CallToolResult { Content = [new TextContentBlock { Text = string.Join("\n", lines) }] };
    }
}

// The drawing guide, for clients that read MCP prompts or resources
public static class McpGuide
{
    public const string Instructions = "Drives SA Drawing Studio, a web app for Civil 3D subassemblies. Call sa_status, then sa_catalog (it includes the drawing guide) before the first edit. Edits are proposals: only the user can accept them, and the user saves the file. Ask the user when dimensions, parameters or codes are not stated. Answer the user in Thai.";

    public static string Read(string name)
    {
        using var s = typeof(McpGuide).Assembly.GetManifestResourceStream(name) ?? throw new InvalidOperationException("Missing resource " + name);
        using var r = new StreamReader(s);
        return r.ReadToEnd();
    }
}

[McpServerPromptType]
public sealed class SaPrompts
{
    [McpServerPrompt(Name = "sa_guide"), Description("Rules for drawing and editing subassemblies. Read before working.")]
    public static string Guide() => McpGuide.Read("sa_guide.md");

    [McpServerPrompt(Name = "edit_logic"), Description("Guide for conditions, variables and Loop.")]
    public static string EditLogic() => McpGuide.Read("edit_logic.md");
}

[McpServerResourceType]
public sealed class SaResources
{
    [McpServerResource(UriTemplate = "sa://guide", Name = "sa_guide", MimeType = "text/markdown"), Description("Rules for drawing and editing subassemblies.")]
    public static string Guide() => McpGuide.Read("sa_guide.md");

    [McpServerResource(UriTemplate = "sa://edit_logic", Name = "edit_logic", MimeType = "text/markdown"), Description("Guide for conditions, variables and Loop.")]
    public static string EditLogic() => McpGuide.Read("edit_logic.md");
}

public static class McpSetup
{
    public static void AddSaMcp(this IServiceCollection services)
    {
        services.AddSingleton<PageHub>();
        services.AddMcpServer(o => { o.ServerInfo = new Implementation { Name = "sa-drawing-studio", Version = "1.0" }; o.ServerInstructions = McpGuide.Instructions; })
                .WithHttpTransport(o => o.Stateless = true)
                .WithTools<SaTools>()
                .WithPrompts<SaPrompts>()
                .WithResources<SaResources>();
    }

    static bool IsLoopback(string host) => host is "localhost" or "127.0.0.1" or "[::1]" or "::1";

    // Blocks DNS rebinding and other web pages: Host must be local; Origin, when present, must be this app.
    public static bool Allowed(HttpRequest req)
    {
        if (!IsLoopback(req.Host.Host)) return false;
        string origin = req.Headers.Origin.ToString();
        if (origin.Length == 0) return true;
        return Uri.TryCreate(origin, UriKind.Absolute, out var u) && IsLoopback(u.Host) && u.Port == (req.Host.Port ?? (req.IsHttps ? 443 : 80));
    }

    public static void UseSaMcpGuard(this WebApplication app)
    {
        app.Use(async (ctx, next) =>
        {
            if ((ctx.Request.Path.StartsWithSegments("/mcp") || ctx.Request.Path.StartsWithSegments("/mcp-page")) && !Allowed(ctx.Request))
            {
                ctx.Response.StatusCode = (int)HttpStatusCode.Forbidden;
                await ctx.Response.Body.WriteAsync(Encoding.UTF8.GetBytes("Forbidden origin"));
                return;
            }
            await next();
        });
        app.UseWebSockets();
    }

    public static void MapSaMcp(this WebApplication app)
    {
        app.MapMcp("/mcp");
        app.Map("/mcp-page", async (HttpContext ctx, PageHub hub) =>
        {
            if (!ctx.WebSockets.IsWebSocketRequest) { ctx.Response.StatusCode = 400; return; }
            using var ws = await ctx.WebSockets.AcceptWebSocketAsync();
            await hub.RunAsync(ws, ctx.RequestAborted);
        });
    }
}
