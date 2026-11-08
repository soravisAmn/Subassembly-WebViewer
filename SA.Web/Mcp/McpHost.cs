// MCP endpoint (host side). The spec lives in the browser, so every tool forwards to the open page over a WebSocket.
// No spec logic here: the page runs the Logic API. No tool writes files or runs commands.
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
    public Task<CallToolResult> Describe([Description("Subassembly id, name, file or class. Default: the one being edited or selected.")] string? item = null, CancellationToken ct = default) => Forward("sa_describe", new { item }, ct);

    [McpServerTool(Name = "sa_get_spec", ReadOnly = true), Description("Full spec JSON. Use only when sa_describe is not enough.")]
    public Task<CallToolResult> GetSpec(string? item = null, CancellationToken ct = default) => Forward("sa_get_spec", new { item }, ct);

    [McpServerTool(Name = "sa_catalog", ReadOnly = true), Description("Logic API functions, point and link types, op format and key drawing rules.")]
    public Task<CallToolResult> Catalog(CancellationToken ct = default) => Forward("sa_catalog", new { }, ct);

    [McpServerTool(Name = "sa_render", ReadOnly = true), Description("PNG of the cross-section with ground, point names and dimensions. Use when the shape matters, not after every edit.")]
    public Task<CallToolResult> Render(string? item = null,
        [Description("Scenario name from sa_check, or { ground: [{x,y}], values: {}, layout: false }. Default: the current workspace.")] JsonElement? scenario = null,
        [Description("Labels: points (default), all (points and links), none.")] string? labels = null,
        int? width = null, int? height = null, CancellationToken ct = default) => Forward("sa_render", new { item, scenario, labels, width, height }, ct);

    [McpServerTool(Name = "sa_check", ReadOnly = true), Description("Compiles the generated code (no file written) and evaluates every scenario, Right and Left: messages, branch and Loop coverage, and the bottom boundary (lower envelope of real links). Give code (e.g. Datum) to list offset stretches lacking it.")]
    public Task<CallToolResult> Check(string? item = null,
        [Description("Code the bottom boundary must carry, e.g. Datum.")] string? code = null,
        [Description("summary (default) or full.")] string? detail = null, CancellationToken ct = default) => Forward("sa_check", new { item, code, detail }, ct);

    [McpServerTool(Name = "sa_code_preview", ReadOnly = true), Description("The generated drawing method in C#. No file is written. detail: full gives the whole file (long).")]
    public Task<CallToolResult> CodePreview(string? item = null, string? detail = null, CancellationToken ct = default) => Forward("sa_code_preview", new { item, detail }, ct);
}

public static class McpSetup
{
    public static void AddSaMcp(this IServiceCollection services)
    {
        services.AddSingleton<PageHub>();
        services.AddMcpServer(o => o.ServerInfo = new Implementation { Name = "sa-drawing-studio", Version = "1.0" })
                .WithHttpTransport(o => o.Stateless = true)
                .WithTools<SaTools>();
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
