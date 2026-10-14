// เว็บ viewer สำหรับ subassembly (ไฟล์ .cs ตัวจริงที่เขียนด้วย Civil 3D API)
// รัน: dotnet run --project SA.Web   แล้วเปิด http://localhost:5050
//
// ลำดับงาน:
//   1) อ่านไฟล์ .cs จากโฟลเดอร์ (SubassemblyFolder ใน appsettings.json) หรือรับ source จากปุ่ม Open .cs
//   2) คอมไพล์ด้วย Roslyn โดยอ้างอิงตัวจำลอง Civil 3D API (SA.Civil3DShim)
//   3) รัน GetLogicalNames / GetInputParameters / Draw กับ surface ที่ลากในเว็บ
//   4) ส่ง points / links / shapes / error กลับไปวาด
//
// แถบแก้โค้ดในเว็บใช้ /api/source (อ่าน), /api/save (บันทึกอัตโนมัติ) และ /api/new (ไฟล์ใหม่จาก template)
// เว็บนี้รันโค้ด C# ที่ส่งเข้ามาบนเครื่องนี้จริง จึงเปิดให้เข้าได้เฉพาะ localhost (ดู Properties/launchSettings.json)

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
            .Select(f => new { name = f.Name, mtime = Mtime(f.FullName), size = f.Length })
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

// ---------------- แถบแก้โค้ด: อ่าน / บันทึก / สร้างไฟล์ .cs ในโฟลเดอร์ ----------------
// mtime ส่งเป็นข้อความ (ticks) เพราะตัวเลขขนาดนี้ JavaScript เก็บได้ไม่ครบทุกหลัก

app.MapGet("/api/source", (string file) =>
{
    var path = FolderFile(folder, file);
    if (path == null) return Results.Ok(new { ok = false, message = $"ชื่อไฟล์ไม่ถูกต้อง: {file}" });
    if (!File.Exists(path)) return Results.Ok(new { ok = false, message = $"ไม่พบไฟล์ {file} ในโฟลเดอร์ {folder}" });
    return Results.Ok(new { ok = true, file = Path.GetFileName(path), source = ReadShared(path), mtime = Mtime(path) });
});

// บันทึกทับไฟล์เดิม: ถ้าไฟล์ถูกแก้จากโปรแกรมอื่นหลัง baseMtime จะไม่เขียนทับ (ตอบ conflict) เว้นแต่ force = true
app.MapPost("/api/save", (SaveRequest req) =>
{
    var path = FolderFile(folder, req.File);
    if (path == null) return Results.Ok(new { ok = false, message = $"ชื่อไฟล์ไม่ถูกต้อง: {req.File}" });
    if (req.Source == null) return Results.Ok(new { ok = false, message = "ไม่มีเนื้อหาให้บันทึก" });

    if (File.Exists(path) && !req.Force && !string.IsNullOrEmpty(req.BaseMtime) && Mtime(path) != req.BaseMtime)
    {
        var disk = ReadShared(path);
        if (disk != req.Source)
            return Results.Ok(new { ok = false, conflict = true, mtime = Mtime(path), source = disk,
                                    message = $"{Path.GetFileName(path)} ถูกแก้จากโปรแกรมอื่นหลังเปิดในเว็บ" });
    }

    try
    {
        WriteText(path, req.Source);
        return Results.Ok(new { ok = true, file = Path.GetFileName(path), mtime = Mtime(path) });
    }
    catch (Exception e)
    {
        return Results.Ok(new { ok = false, message = $"บันทึก {Path.GetFileName(path)} ไม่ได้: {e.Message}" });
    }
});

// สร้างไฟล์ .cs ใหม่จาก template (ไม่เขียนทับไฟล์ที่มีอยู่)
app.MapPost("/api/new", (NewRequest req) =>
{
    var name = (req.Name ?? "").Trim();
    if (name.Length > 0 && !name.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)) name += ".cs";
    var path = FolderFile(folder, name);
    if (path == null) return Results.Ok(new { ok = false, message = $"ตั้งชื่อไฟล์แบบนี้ไม่ได้: {req.Name}" });
    if (File.Exists(path)) return Results.Ok(new { ok = false, message = $"มีไฟล์ชื่อ {Path.GetFileName(path)} อยู่แล้ว" });
    try
    {
        WriteText(path, SubassemblyTemplate.Create(Path.GetFileNameWithoutExtension(path)));
        return Results.Ok(new { ok = true, file = Path.GetFileName(path), mtime = Mtime(path) });
    }
    catch (Exception e)
    {
        return Results.Ok(new { ok = false, message = $"สร้างไฟล์ไม่ได้: {e.Message}" });
    }
});

app.Run();

// ชื่อไฟล์ .cs ที่อยู่ชั้นบนสุดของโฟลเดอร์เท่านั้น (กันชื่อที่พาออกนอกโฟลเดอร์ เช่น ..\x.cs)
static string? FolderFile(string folder, string? name)
{
    if (string.IsNullOrWhiteSpace(name)) return null;
    name = name.Trim();
    if (name != Path.GetFileName(name) || name.StartsWith('.') || name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0) return null;
    if (!name.EndsWith(".cs", StringComparison.OrdinalIgnoreCase) || name.Length <= 3) return null;
    var full = Path.GetFullPath(Path.Combine(folder, name));
    return string.Equals(Path.GetDirectoryName(full), folder.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase) ? full : null;
}

static string Mtime(string path) => File.GetLastWriteTimeUtc(path).Ticks.ToString();

// เขียนผ่านไฟล์ชั่วคราวแล้วสลับ (ไฟล์ไม่ขาดครึ่งถ้าเขียนไม่จบ) และคง BOM เดิมของไฟล์ไว้
static void WriteText(string path, string text)
{
    bool bom = true;   // ไฟล์ใหม่: UTF-8 มี BOM (เครื่องมือบน Windows อ่านคอมเมนต์ภาษาไทยถูกแน่นอน)
    if (File.Exists(path))
    {
        using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        var head = new byte[3];
        int n = fs.Read(head, 0, 3);
        bom = n == 3 && head[0] == 0xEF && head[1] == 0xBB && head[2] == 0xBF;
    }
    var bytes = new System.Text.UTF8Encoding(bom).GetPreamble().Concat(new System.Text.UTF8Encoding(false).GetBytes(text)).ToArray();
    var tmp = Path.Combine(Path.GetDirectoryName(path)!, "." + Path.GetFileName(path) + ".saving");
    File.WriteAllBytes(tmp, bytes);
    try { File.Move(tmp, path, overwrite: true); }
    catch (IOException)
    {
        // ไฟล์ถูกโปรแกรมอื่นจับไว้ -> เขียนตรงแทน
        File.Delete(tmp);
        File.WriteAllBytes(path, bytes);
    }
}

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

record SaveRequest(string? File, string? Source, string? BaseMtime, bool Force);
record NewRequest(string? Name);

record RunRequest(string? File, string? Source, string? SourceName, string? ClassName,
                  Dictionary<string, JsonElement>? Params, WorldInput? World);

// นับจำนวนครั้งที่ dotnet watch ทำ hot reload ของตัวเว็บเอง
internal static class HotReloadTracker
{
    public static int Version;
    public static void ClearCache(Type[]? types) { }
    public static void UpdateApplication(Type[]? types) => Interlocked.Increment(ref Version);
}
