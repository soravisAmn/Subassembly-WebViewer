// Round 6: MCP endpoint per the spec, the no-page case, foreign Host / Origin, and forwarding to a fake page.
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SA.Mcp;

static class McpTests
{
    public static void Run(Action<string, Action> test)
    {
        Console.WriteLine("\nRound 6: MCP endpoint");
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        builder.Services.AddSaMcp();
        var app = builder.Build();
        app.UseSaMcpGuard();
        app.MapSaMcp();
        app.StartAsync().Wait();
        var url = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First();
        var hub = app.Services.GetRequiredService<PageHub>();
        hub.Timeout = TimeSpan.FromSeconds(3);
        using var http = new HttpClient();

        async Task<(int Code, JsonElement Body)> Post(string body, Action<HttpRequestMessage>? tweak = null)
        {
            var req = new HttpRequestMessage(HttpMethod.Post, url + "/mcp") { Content = new StringContent(body, Encoding.UTF8, "application/json") };
            req.Headers.Add("Accept", "application/json, text/event-stream");
            tweak?.Invoke(req);
            var res = await http.SendAsync(req);
            var text = await res.Content.ReadAsStringAsync();
            var data = text.Split('\n').FirstOrDefault(l => l.StartsWith("data: "));
            var json = data != null ? data[6..] : text;
            return ((int)res.StatusCode, json.StartsWith('{') ? JsonDocument.Parse(json).RootElement.Clone() : default);
        }
        string Call(string tool, string args = "{}") => "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"" + tool + "\",\"arguments\":" + args + "}}";
        const string Init = """{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}""";
        void Is(bool c, string m) { if (!c) throw new Exception(m); }

        test("initialize answers with the server name and tools capability", () =>
        {
            var (c, b) = Post(Init).Result;
            Is(c == 200, "status " + c);
            var r = b.GetProperty("result");
            Is(r.GetProperty("serverInfo").GetProperty("name").GetString() == "sa-drawing-studio", "name");
            Is(r.GetProperty("capabilities").TryGetProperty("tools", out _), "tools capability");
        });
        test("tools/list has the read-only tools and nothing that writes", () =>
        {
            var (_, b) = Post("""{"jsonrpc":"2.0","id":2,"method":"tools/list"}""").Result;
            var names = b.GetProperty("result").GetProperty("tools").EnumerateArray().Select(t => t.GetProperty("name").GetString()!).OrderBy(n => n, StringComparer.Ordinal).ToArray();
            var want = new[] { "sa_catalog", "sa_check", "sa_code_preview", "sa_describe", "sa_get_spec", "sa_render", "sa_status" };
            Is(names.SequenceEqual(want), string.Join(",", names));
        });
        test("no web page open: an immediate error that says what to do", () =>
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var (_, b) = Post(Call("sa_status")).Result;
            var r = b.GetProperty("result");
            Is(r.GetProperty("isError").GetBoolean(), "isError");
            Is(r.GetProperty("content")[0].GetProperty("text").GetString()!.Contains("http://localhost:5050"), "text");
            Is(sw.ElapsedMilliseconds < 2000, "took " + sw.ElapsedMilliseconds);
        });
        test("a foreign Origin or Host is rejected; the app's own Origin is allowed", () =>
        {
            Is(Post(Init, q => q.Headers.Add("Origin", "http://evil.example")).Result.Code == 403, "origin");
            Is(Post(Init, q => q.Headers.Host = "evil.example").Result.Code == 403, "host");
            Is(Post(Init, q => q.Headers.Add("Origin", url)).Result.Code == 200, "own origin");
            Is(Post(Init, q => q.Headers.Add("Origin", "http://localhost:1")).Result.Code == 403, "other local port");
        });
        test("the page rejects a foreign Origin on the WebSocket too", () =>
        {
            using var ws = new ClientWebSocket();
            ws.Options.SetRequestHeader("Origin", "http://evil.example");
            bool refused = false;
            try { ws.ConnectAsync(new Uri(url.Replace("http", "ws") + "/mcp-page"), default).Wait(); } catch (AggregateException) { refused = true; }
            Is(refused, "connected");
        });
        test("tool calls reach the most recently active page; text, image and errors come back", () =>
        {
            using var older = FakePage(url, _ => """{"text":"older"}""");
            using var page = FakePage(url, m => m.GetProperty("tool").GetString() switch
            {
                "sa_describe" => "{\"text\":\"item=" + m.GetProperty("args").GetProperty("item").GetString() + "\"}",
                "sa_render" => """{"text":"png","image":"iVBORw0KGgo="}""",
                _ => """{"error":"No subassembly."}"""
            });
            for (int i = 0; i < 50 && hub.Count < 2; i++) Thread.Sleep(20);
            Is(hub.Count == 2, "pages " + hub.Count);
            page.Active();
            Thread.Sleep(100);
            var a = Post(Call("sa_describe", """{"item":"X"}""")).Result.Body.GetProperty("result");
            Is(a.GetProperty("content")[0].GetProperty("text").GetString() == "item=X", a.ToString());
            var c = Post(Call("sa_render")).Result.Body.GetProperty("result").GetProperty("content");
            Is(c[1].GetProperty("type").GetString() == "image" && c[1].GetProperty("mimeType").GetString() == "image/png", c.ToString());
            var e = Post(Call("sa_check")).Result.Body.GetProperty("result");
            Is(e.GetProperty("isError").GetBoolean() && e.GetProperty("content")[0].GetProperty("text").GetString() == "No subassembly.", e.ToString());
        });
        app.StopAsync().Wait();
    }

    sealed class Page : IDisposable
    {
        public ClientWebSocket Ws = new();
        public CancellationTokenSource Cts = new();
        public void Active() => Ws.SendAsync(Encoding.UTF8.GetBytes("""{"active":1}"""), WebSocketMessageType.Text, true, default).Wait();
        public void Dispose() { Cts.Cancel(); Ws.Dispose(); }
    }
    static Page FakePage(string url, Func<JsonElement, string> reply)
    {
        var p = new Page();
        p.Ws.ConnectAsync(new Uri(url.Replace("http", "ws") + "/mcp-page"), default).Wait();
        _ = Task.Run(async () =>
        {
            var buf = new byte[65536];
            try
            {
                while (p.Ws.State == WebSocketState.Open)
                {
                    var r = await p.Ws.ReceiveAsync(buf, p.Cts.Token);
                    var m = JsonDocument.Parse(buf.AsMemory(0, r.Count)).RootElement;
                    var body = reply(m);
                    var msg = "{\"id\":\"" + m.GetProperty("id").GetString() + "\"," + body[1..];
                    await p.Ws.SendAsync(Encoding.UTF8.GetBytes(msg), WebSocketMessageType.Text, true, default);
                }
            }
            catch (Exception e) when (e is OperationCanceledException or WebSocketException or ObjectDisposedException) { }
        });
        return p;
    }
}
