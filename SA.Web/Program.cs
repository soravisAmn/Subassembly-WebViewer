// เว็บ viewer สำหรับ subassembly (ไฟล์ .cs ตัวจริงที่เขียนด้วย Civil 3D API)
// รัน: dotnet run --project SA.Web   แล้วเปิด http://localhost:5050
//
// ลำดับงาน:
//   1) อ่านไฟล์ .cs จากโฟลเดอร์ (SubassemblyFolder ใน appsettings.json) หรือรับ source จากปุ่ม Open .cs
//   2) คอมไพล์ด้วย Roslyn โดยอ้างอิงตัวจำลอง Civil 3D API (SA.Civil3DShim)
//   3) รัน GetLogicalNames / GetInputParameters / Draw กับ surface ที่ลากในเว็บ
//   4) ส่ง points / links / shapes / error กลับไปวาด

using System.Text.Json;
using System.Text.Json.Serialization;

[assembly: System.Reflection.Metadata.MetadataUpdateHandler(typeof(HotReloadTracker))]

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.SerializerOptions.NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals;
});
builder.Services.AddSingleton<SubassemblyCompiler>();
builder.Services.AddSingleton<SubassemblyRunner>();

var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles();

var folder = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath,
    app.Configuration["SubassemblyFolder"] ?? ".."));
var startedAt = DateTime.Now;

app.Logger.LogInformation("Subassembly folder: {Folder}", folder);

app.MapGet("/api/info", () => new
{
    buildId = $"{startedAt:O}#{HotReloadTracker.Version}",
    folder
});

// รายการไฟล์ .cs ในโฟลเดอร์ (ไม่รวมโฟลเดอร์ย่อย) พร้อมเวลาแก้ไขล่าสุด
app.MapGet("/api/files", () =>
{
    var files = Directory.Exists(folder)
        ? Directory.GetFiles(folder, "*.cs", SearchOption.TopDirectoryOnly)
            .Select(f => new FileInfo(f))
            .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
            .Select(f => new { name = f.Name, mtime = f.LastWriteTimeUtc.Ticks, size = f.Length })
            .ToList<object>()
        : new List<object>();
    return new { folder, files };
});

app.MapPost("/api/run", (RunRequest req, SubassemblyCompiler compiler, SubassemblyRunner runner) =>
{
    // 1) หา source
    string source, name;
    if (!string.IsNullOrEmpty(req.Source))
    {
        source = req.Source;
        name = Path.GetFileName(req.SourceName ?? "opened.cs");
    }
    else if (!string.IsNullOrEmpty(req.File))
    {
        name = Path.GetFileName(req.File);
        var path = Path.Combine(folder, name);
        if (!File.Exists(path))
            return Results.Ok(new { ok = false, stage = "file", message = $"ไม่พบไฟล์ {name} ในโฟลเดอร์ {folder}" });
        source = ReadShared(path);
    }
    else
        return Results.Ok(new { ok = false, stage = "file", message = "ยังไม่ได้เลือกไฟล์ .cs" });

    // 2) คอมไพล์
    var compiled = compiler.Compile(source, name);
    if (!compiled.Success)
        return Results.Ok(new { ok = false, stage = "compile", file = name, diagnostics = compiled.Diagnostics, compileMs = compiled.CompileMs });

    if (compiled.Classes.Count == 0)
        return Results.Ok(new
        {
            ok = false, stage = "class", file = name, diagnostics = compiled.Diagnostics,
            message = "ไม่พบ class ที่เป็น subassembly (ต้องเป็น public class ที่มีเมธอด public void Draw() ไม่มีพารามิเตอร์)"
        });

    var type = compiled.Classes.FirstOrDefault(t => t.FullName == req.ClassName) ?? compiled.Classes[0];

    // 3) รัน
    var output = runner.Run(type, req.Params, req.World ?? new WorldInput());
    return Results.Ok(new
    {
        ok = true,
        file = name,
        classes = compiled.Classes.Select(c => c.FullName).ToList(),
        warnings = compiled.Diagnostics,
        compileMs = compiled.CompileMs,
        result = output
    });
});

app.Run();

// อ่านไฟล์แม้ editor กำลังเปิด/เขียนอยู่
static string ReadShared(string path)
{
    for (int i = 0; ; i++)
    {
        try
        {
            using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var sr = new StreamReader(fs);
            return sr.ReadToEnd();
        }
        catch (IOException) when (i < 5) { Thread.Sleep(80); }
    }
}

record RunRequest(string? File, string? Source, string? SourceName, string? ClassName,
                  Dictionary<string, JsonElement>? Params, WorldInput? World);

// นับจำนวนครั้งที่ dotnet watch ทำ hot reload ของตัวเว็บเอง
internal static class HotReloadTracker
{
    public static int Version;
    public static void ClearCache(Type[]? types) { }
    public static void UpdateApplication(Type[]? types) => Interlocked.Increment(ref Version);
}
