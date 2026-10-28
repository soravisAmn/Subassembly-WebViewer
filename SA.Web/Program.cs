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
using SA.Drawing;

[assembly: System.Reflection.Metadata.MetadataUpdateHandler(typeof(HotReloadTracker))]

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.SerializerOptions.NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals;
});
var folder = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath,
    builder.Configuration["SubassemblyFolder"] ?? ".."));

builder.Services.AddSingleton<SubassemblyCompiler>();
builder.Services.AddSingleton<SubassemblyRunner>();
builder.Services.AddSingleton(sp => new AssemblyService(
    sp.GetRequiredService<SubassemblyCompiler>(), sp.GetRequiredService<SubassemblyRunner>(), folder));

var app = builder.Build();
app.UseDefaultFiles();
// หน้าเว็บแยกเป็นหลายไฟล์ (css/, js/) -> ให้เบราว์เซอร์ถามทุกครั้งว่าไฟล์เปลี่ยนไหม กันได้ js เก่าปนกับ html ใหม่
app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = c => c.Context.Response.Headers.CacheControl = "no-cache" });
var startedAt = DateTime.Now;

app.Logger.LogInformation("Subassembly folder: {Folder}", folder);

app.MapGet("/api/info", () => new
{
    buildId = $"{startedAt:O}#{HotReloadTracker.Version}",
    folder
});

// รายการไฟล์ .cs และไฟล์ .assembly.json ในโฟลเดอร์ (ไม่รวมโฟลเดอร์ย่อย) พร้อมเวลาแก้ไขล่าสุด
app.MapGet("/api/files", () =>
{
    List<object> List(string pattern) => Directory.Exists(folder)
        ? Directory.GetFiles(folder, pattern, SearchOption.TopDirectoryOnly)
            .Select(f => new FileInfo(f))
            .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
            .Select(f => new { name = f.Name, mtime = Mtime(f.FullName), size = f.Length })
            .ToList<object>()
        : new List<object>();
    return new { folder, files = List("*.cs"), assemblies = List("*.assembly.json") };
});

// ---------------- assembly: ประกอบหลาย subassembly ----------------

app.MapPost("/api/assembly", (AssemblyReq req, AssemblyService svc) => new { items = svc.Run(req) });

// เปิด / บันทึกไฟล์ .assembly.json ในโฟลเดอร์
app.MapGet("/api/assembly-file", (string name) =>
{
    var file = FileUtil.AssemblyFileName(name);
    var path = file == null ? null : Path.Combine(folder, file);
    if (path == null || !File.Exists(path)) return Results.NotFound(new { message = $"ไม่พบไฟล์ {name}" });
    return Results.Text(ReadShared(path), "application/json");
});

app.MapPost("/api/assembly-file", (AssemblySaveRequest req) =>
{
    var file = FileUtil.AssemblyFileName(req.Name);
    if (file == null) return Results.BadRequest(new { message = "ชื่อไฟล์ไม่ถูกต้อง" });
    try
    {
        WriteText(Path.Combine(folder, file), JsonSerializer.Serialize(req.Content, new JsonSerializerOptions { WriteIndented = true }));
        return Results.Ok(new { name = file });
    }
    catch (Exception e)
    {
        return Results.BadRequest(new { message = $"บันทึก {file} ไม่ได้: {e.Message}" });
    }
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

// ---------------- ส่วนที่วาดในเว็บ (DrawingSpec) -> โค้ด C# ----------------
// ดูโค้ดที่สร้าง (แถบโค้ด read-only): ไม่มีไฟล์ = ทั้งไฟล์ใหม่; มีไฟล์ที่มีช่วง SA-DRAWING = ไฟล์เดิมที่แทนช่วงนั้นแล้ว
app.MapPost("/api/drawing/code", (DrawingReq req) =>
{
    try
    {
        var spec = DrawingSpec.Parse(req.Spec);
        var raw = req.Spec.GetRawText();
        var path = string.IsNullOrEmpty(req.File) ? null : FolderFile(folder, req.File);
        if (path != null && File.Exists(path))
        {
            var src = ReadShared(path);
            var block = CodeGenerator.FindBlock(src);
            if (block == null) return Results.Ok(new { ok = false, message = $"{Path.GetFileName(path)} ยังไม่มีช่วง SA-DRAWING (ไฟล์ที่เขียนเอง — Milestone 4)" });
            return Results.Ok(new { ok = true, source = CodeGenerator.ReplaceBlock(src, block, CodeGenerator.GenerateBlock(spec, raw, block.Indent)) });
        }
        var name = req.FileName ?? spec.ClassName + ".cs";
        return Results.Ok(new { ok = true, source = CodeGenerator.GenerateFile(spec, raw, Path.GetFileName(name)) });
    }
    catch (Exception e) when (e is FormatException or JsonException)
    {
        return Results.Ok(new { ok = false, message = "สร้างโค้ดไม่ได้: " + e.Message });
    }
});

// อ่านส่วนที่วาดกลับจากไฟล์ (sa-spec) ตอน import / เปิด project
app.MapGet("/api/drawing/spec", (string file) =>
{
    var path = FolderFile(folder, file);
    if (path == null || !File.Exists(path)) return Results.Ok(new { ok = false, message = $"ไม่พบไฟล์ {file}" });
    var block = CodeGenerator.FindBlock(ReadShared(path));
    if (block?.SpecJson == null) return Results.Ok(new { ok = true, spec = (JsonElement?)null, edited = false });
    try
    {
        using var doc = JsonDocument.Parse(block.SpecJson);
        return Results.Ok(new { ok = true, spec = (JsonElement?)doc.RootElement.Clone(), edited = !CodeGenerator.BlockMatchesSpec(block) });
    }
    catch (JsonException e)
    {
        return Results.Ok(new { ok = false, message = $"อ่าน sa-spec ใน {file} ไม่ได้: {e.Message}" });
    }
});

// Save .cs: ไฟล์ยังไม่มี = สร้างทั้งไฟล์; มีช่วง SA-DRAWING = แทนที่เฉพาะช่วงนั้น (ส่วนอื่นไม่เปลี่ยนแม้แต่ไบต์เดียว)
//   ชื่อซ้ำกับไฟล์ที่ไม่มีช่วงนี้ -> ถาม (overwrite) · ช่วงในไฟล์ถูกแก้ด้วยมือ -> ถาม (force)
app.MapPost("/api/drawing/save", (DrawingReq req) =>
{
    var path = FolderFile(folder, req.File);
    if (path == null) return Results.Ok(new { ok = false, message = $"ตั้งชื่อไฟล์แบบนี้ไม่ได้: {req.File}" });
    var name = Path.GetFileName(path);
    try
    {
        var spec = DrawingSpec.Parse(req.Spec);
        var raw = req.Spec.GetRawText();
        string text;
        bool created = false;
        if (!File.Exists(path))
        {
            text = CodeGenerator.GenerateFile(spec, raw, name);
            created = true;
        }
        else
        {
            var src = ReadShared(path);
            var block = CodeGenerator.FindBlock(src);
            if (block == null)
            {
                if (!req.Overwrite)
                    return Results.Ok(new { ok = false, exists = true, message = $"มีไฟล์ชื่อ {name} อยู่แล้ว และไม่ใช่ไฟล์ที่สร้างจากเว็บ" });
                text = CodeGenerator.GenerateFile(spec, raw, name);
            }
            else
            {
                if (!req.Force && !CodeGenerator.BlockMatchesSpec(block))
                    return Results.Ok(new { ok = false, edited = true, message = $"ช่วง SA-DRAWING ใน {name} ถูกแก้ด้วยมือ (ไม่ตรงกับ sa-spec)" });
                var miss = CodeGenerator.MissingCalls(src, spec);
                if (miss.Count > 0)
                    return Results.Ok(new { ok = false, message = $"{name} ไม่มีบรรทัด {string.Join(", ", miss)} ที่เรียกส่วนที่วาด — การแทรกบรรทัดให้เองมาใน Milestone 4" });
                text = CodeGenerator.ReplaceBlock(src, block, CodeGenerator.GenerateBlock(spec, raw, block.Indent));
            }
        }
        WriteText(path, text);
        return Results.Ok(new { ok = true, file = name, created, mtime = Mtime(path) });
    }
    catch (Exception e) when (e is FormatException or JsonException)
    {
        return Results.Ok(new { ok = false, message = "สร้างโค้ดไม่ได้: " + e.Message });
    }
    catch (IOException e)
    {
        return Results.Ok(new { ok = false, message = $"บันทึก {name} ไม่ได้: {e.Message}" });
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
record AssemblySaveRequest(string? Name, JsonElement Content);
record DrawingReq(JsonElement Spec, string? File, string? FileName, bool Overwrite, bool Force);

record RunRequest(string? File, string? Source, string? SourceName, string? ClassName,
                  Dictionary<string, JsonElement>? Params, WorldInput? World);

// นับจำนวนครั้งที่ dotnet watch ทำ hot reload ของตัวเว็บเอง
internal static class HotReloadTracker
{
    public static int Version;
    public static void ClearCache(Type[]? types) { }
    public static void UpdateApplication(Type[]? types) => Interlocked.Increment(ref Version);
}
