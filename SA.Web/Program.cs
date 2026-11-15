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
// Round 8: SubassemblyFolder = the old fixed folder (requests without a project handle, until the page sends handles);
// ProjectsFolder = start folder of the web file dialog (default: SubassemblyFolder)
var folder = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath,
    builder.Configuration["SubassemblyFolder"] ?? ".."));
var startFolder = builder.Configuration["ProjectsFolder"] is { Length: > 0 } pf && Directory.Exists(pf) ? pf : folder;

SA.Mcp.McpSetup.AddSaMcp(builder.Services);
builder.Services.AddSingleton<SubassemblyCompiler>();
builder.Services.AddSingleton<SubassemblyRunner>();
builder.Services.AddSingleton(sp => new AssemblyService(
    sp.GetRequiredService<SubassemblyCompiler>(), sp.GetRequiredService<SubassemblyRunner>(), folder));
builder.Services.AddSingleton(sp => new SA.Build.BuildEngine(
    sp.GetRequiredService<SubassemblyCompiler>(), sp.GetRequiredService<SubassemblyRunner>(), folder));
// projects open in browser tabs (handle in the X-SA-Project header); no handle = the old folder
builder.Services.AddSingleton(sp =>
{
    var reg = new SA.Projects.ProjectRegistry(folder, Path.Combine(SA.Build.BuildPaths.DefaultMachineDir(), "scratch"));
    var hub = sp.GetRequiredService<SA.Mcp.PageHub>();
    reg.SocketHandles = () => hub.Handles;
    hub.Focused = reg.Focused;
    return reg;
});

var app = builder.Build();
var projects = app.Services.GetRequiredService<SA.Projects.ProjectRegistry>();   // links the page hub now
SA.Projects.ProjectHttp.MapProjectApi(app, startFolder);
// the project of the tab that sent the request (null = handle unknown: the page re-opens its project)
SA.Projects.ProjectContext? Proj(HttpContext h) => projects.Get(SA.Projects.ProjectHttp.HandleOf(h));

SA.Mcp.McpSetup.UseSaMcpGuard(app);
SA.Mcp.McpSetup.MapSaMcp(app);
app.UseDefaultFiles();
// หน้าเว็บแยกเป็นหลายไฟล์ (css/, js/) -> ให้เบราว์เซอร์ถามทุกครั้งว่าไฟล์เปลี่ยนไหม กันได้ js เก่าปนกับ html ใหม่
app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = c => c.Context.Response.Headers.CacheControl = "no-cache" });
var startedAt = DateTime.Now;

app.Logger.LogInformation("Subassembly folder: {Folder}", folder);

app.MapGet("/api/info", (HttpContext h) =>
{
    var p = Proj(h);
    return new
    {
        buildId = $"{startedAt:O}#{HotReloadTracker.Version}",
        folder = p?.ProjectDir ?? folder,
        project = p?.ProjectFile, readOnly = p?.ReadOnly ?? false, projectLost = p == null,
    };
});

// รายการไฟล์ .cs และไฟล์ .assembly.json ในโฟลเดอร์ (ไม่รวมโฟลเดอร์ย่อย) พร้อมเวลาแก้ไขล่าสุด
app.MapGet("/api/files", (HttpContext h) =>
{
    var p = Proj(h);
    if (p == null) return SA.Projects.ProjectHttp.Lost();
    var folder = p.ProjectDir;
    List<object> List(string pattern) => Directory.Exists(folder)
        ? Directory.GetFiles(folder, pattern, SearchOption.TopDirectoryOnly)
            .Select(f => new FileInfo(f))
            .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
            .Select(f => new { name = f.Name, mtime = Mtime(f.FullName), size = f.Length })
            .ToList<object>()
        : new List<object>();
    return Results.Ok(new { folder, files = List("*.cs"), assemblies = List("*.assembly.json") });
});

// ---------------- assembly: ประกอบหลาย subassembly ----------------

app.MapPost("/api/assembly", (HttpContext h, AssemblyReq req, AssemblyService svc) =>
{
    var p = Proj(h);
    if (p == null) return SA.Projects.ProjectHttp.Lost();
    return Results.Ok(new { items = svc.Run(req, n => p.Resolve(n, ".cs")) });
});

// เปิด / บันทึกไฟล์ .assembly.json ในโฟลเดอร์
app.MapGet("/api/assembly-file", (HttpContext h, string name) =>
{
    var p = Proj(h);
    if (p == null) return SA.Projects.ProjectHttp.Lost();
    var folder = p.ProjectDir;
    var file = FileUtil.AssemblyFileName(name);
    var path = file == null ? null : Path.Combine(folder, file);
    if (path == null || !File.Exists(path)) return Results.NotFound(new { message = $"ไม่พบไฟล์ {name}" });
    return Results.Text(ReadShared(path), "application/json");
});

app.MapPost("/api/assembly-file", (HttpContext h, AssemblySaveRequest req) =>
{
    var p = Proj(h);
    if (p == null) return SA.Projects.ProjectHttp.Lost();
    if (p.ReadOnly) return SA.Projects.ProjectHttp.ReadOnly();
    var folder = p.ProjectDir;
    var file = FileUtil.AssemblyFileName(req.Name);
    if (file == null) return Results.BadRequest(new { message = "ชื่อไฟล์ไม่ถูกต้อง" });
    try
    {
        FileUtil.WriteText(Path.Combine(folder, file), JsonSerializer.Serialize(req.Content, new JsonSerializerOptions { WriteIndented = true }));
        return Results.Ok(new { name = file });
    }
    catch (Exception e)
    {
        return Results.BadRequest(new { message = $"บันทึก {file} ไม่ได้: {e.Message}" });
    }
});

app.MapPost("/api/run", (HttpContext h, RunRequest req, SubassemblyCompiler compiler, SubassemblyRunner runner) =>
{
    var p = Proj(h);
    if (p == null) return SA.Projects.ProjectHttp.Lost();
    var folder = p.ProjectDir;
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
        var path = p.Resolve(req.File, ".cs");
        if (path == null || !File.Exists(path))
            return Results.Ok(new { ok = false, stage = "file", message = $"ไม่พบไฟล์ {req.File} ในโฟลเดอร์ {folder}" });
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

app.MapGet("/api/source", (HttpContext h, string file) =>
{
    var p = Proj(h);
    if (p == null) return SA.Projects.ProjectHttp.Lost();
    var folder = p.ProjectDir;
    var path = p.Resolve(file, ".cs");
    if (path == null) return Results.Ok(new { ok = false, message = $"ชื่อไฟล์ไม่ถูกต้อง: {file}" });
    if (!File.Exists(path)) return Results.Ok(new { ok = false, message = $"ไม่พบไฟล์ {file} ในโฟลเดอร์ {folder}" });
    return Results.Ok(new { ok = true, file, source = ReadShared(path), mtime = Mtime(path) });
});

// บันทึกทับไฟล์เดิม: ถ้าไฟล์ถูกแก้จากโปรแกรมอื่นหลัง baseMtime จะไม่เขียนทับ (ตอบ conflict) เว้นแต่ force = true
app.MapPost("/api/save", (HttpContext h, SaveRequest req) =>
{
    var p = Proj(h);
    if (p == null) return SA.Projects.ProjectHttp.Lost();
    if (p.ReadOnly) return SA.Projects.ProjectHttp.ReadOnly();
    var path = p.Resolve(req.File, ".cs");
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
        FileUtil.WriteText(path, req.Source);
        return Results.Ok(new { ok = true, file = req.File, mtime = Mtime(path) });
    }
    catch (Exception e)
    {
        return Results.Ok(new { ok = false, message = $"บันทึก {Path.GetFileName(path)} ไม่ได้: {e.Message}" });
    }
});

// สร้างไฟล์ .cs ใหม่จาก template (ไม่เขียนทับไฟล์ที่มีอยู่)
app.MapPost("/api/new", (HttpContext h, NewRequest req) =>
{
    var p = Proj(h);
    if (p == null) return SA.Projects.ProjectHttp.Lost();
    if (p.ReadOnly) return SA.Projects.ProjectHttp.ReadOnly();
    var name = (req.Name ?? "").Trim();
    if (name.Length > 0 && !name.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)) name += ".cs";
    var path = FolderFile(p.ProjectDir, name);
    if (path == null) return Results.Ok(new { ok = false, message = $"ตั้งชื่อไฟล์แบบนี้ไม่ได้: {req.Name}" });
    if (File.Exists(path)) return Results.Ok(new { ok = false, message = $"มีไฟล์ชื่อ {Path.GetFileName(path)} อยู่แล้ว" });
    try
    {
        FileUtil.WriteText(path, SubassemblyTemplate.Create(Path.GetFileNameWithoutExtension(path)));
        return Results.Ok(new { ok = true, file = Path.GetFileName(path), mtime = Mtime(path) });
    }
    catch (Exception e)
    {
        return Results.Ok(new { ok = false, message = $"สร้างไฟล์ไม่ได้: {e.Message}" });
    }
});

// ---------------- ส่วนที่วาดในเว็บ (DrawingSpec) -> โค้ด C# ----------------
// ดูโค้ดที่สร้าง (แถบโค้ด read-only): ไม่มีไฟล์ = ทั้งไฟล์ใหม่; มีไฟล์ที่มีช่วง SA-DRAWING = ไฟล์เดิมที่แทนช่วงนั้นแล้ว
app.MapPost("/api/drawing/code", (HttpContext h, DrawingReq req) =>
{
    var p = Proj(h);
    if (p == null) return SA.Projects.ProjectHttp.Lost();
    try
    {
        var spec = DrawingSpec.Parse(req.Spec);
        var raw = req.Spec.GetRawText();
        var path = string.IsNullOrEmpty(req.File) ? null : p.Resolve(req.File, ".cs");
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
app.MapGet("/api/drawing/spec", (HttpContext h, string file) =>
{
    var p = Proj(h);
    if (p == null) return SA.Projects.ProjectHttp.Lost();
    var path = p.Resolve(file, ".cs");
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
app.MapPost("/api/drawing/save", (HttpContext h, DrawingReq req) =>
{
    var p = Proj(h);
    if (p == null) return SA.Projects.ProjectHttp.Lost();
    if (p.ReadOnly) return SA.Projects.ProjectHttp.ReadOnly();
    var path = p.Resolve(req.File, ".cs");
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
            if (req.Rename && block?.SpecJson != null)
            {
                // Build dialog: namespace / class renamed (Logic API setClassName) -> rename them outside SA-DRAWING too
                if (!req.Force && !CodeGenerator.BlockMatchesSpec(block))
                    return Results.Ok(new { ok = false, edited = true, message = $"ช่วง SA-DRAWING ใน {name} ถูกแก้ด้วยมือ (ไม่ตรงกับ sa-spec)" });
                var old = DrawingSpec.Parse(block.SpecJson);
                string Ns(DrawingSpec d) => string.IsNullOrWhiteSpace(d.Namespace) ? "TestSubassembly" : d.Namespace!;
                var renamed = CodeGenerator.RenameClass(src, Ns(old), old.ClassName, Ns(spec), spec.ClassName);
                var b2 = CodeGenerator.FindBlock(renamed)!;
                text = CodeGenerator.ReplaceBlock(renamed, b2, CodeGenerator.GenerateBlock(spec, raw, b2.Indent));
                var missing = CodeGenerator.MissingCalls(text, spec);
                if (missing.Count > 0)
                    return Results.Ok(new { ok = false, message = $"เปลี่ยนชื่อใน {name} ไม่ครบ (ไม่พบ {string.Join(", ", missing)}) — แก้ชื่อในโค้ดเอง" });
            }
            else if (block == null)
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
        FileUtil.WriteText(path, text);
        return Results.Ok(new { ok = true, file = req.File, created, mtime = Mtime(path) });
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

// ---------------- Build (round 7): DLL for Civil 3D from the files of a project ----------------
// versions = Civil 3D installs found + whether this machine can build them; plan = files / classes / checks (no build);
// build = dotnet build per ticked version (docs/build.md)

app.MapGet("/api/build/versions", (SA.Build.BuildEngine eng) => new { versions = eng.Installs() });

// the tab's project folder (round 8); a read-only tab cannot build (a build writes build\ next to the project)
SA.Build.BuildEngine? Eng(HttpContext h, SA.Build.BuildEngine eng) { var p = Proj(h); return p == null ? null : eng.For(p.ProjectDir, p.Referenced.Contains); }

app.MapPost("/api/build/plan", (HttpContext h, SA.Build.BuildRequest req, SA.Build.BuildEngine eng) =>
    Eng(h, eng) is { } e ? Results.Ok(e.Plan(req)) : SA.Projects.ProjectHttp.Lost());

app.MapPost("/api/build", (HttpContext h, SA.Build.BuildRequest req, SA.Build.BuildEngine eng) =>
    Proj(h) is { ReadOnly: true } ? SA.Projects.ProjectHttp.ReadOnly() : Eng(h, eng) is { } e ? Results.Ok(e.Build(req)) : SA.Projects.ProjectHttp.Lost());

// source package (zip for a machine with Civil 3D): build\<DLL>\<DLL>-source.zip next to the project, no build here
app.MapPost("/api/build/source", (HttpContext h, SA.Build.BuildRequest req, SA.Build.BuildEngine eng) =>
    Proj(h) is { ReadOnly: true } ? SA.Projects.ProjectHttp.ReadOnly() : Eng(h, eng) is { } e ? Results.Ok(e.SourcePackage(req)) : SA.Projects.ProjectHttp.Lost());

// pre-build checks for the dialog (simulator runs, codes, locked / same-name DLL, parameter changes); no build
app.MapPost("/api/build/check", (HttpContext h, SA.Build.CheckRequest req, SA.Build.BuildEngine eng) =>
    Eng(h, eng) is { } e ? Results.Ok(e.Check(req)) : SA.Projects.ProjectHttp.Lost());

// machine settings (Copy-to folder): %LOCALAPPDATA%\SA-Studio\settings.json, never in a project
app.MapGet("/api/build/settings", (SA.Build.BuildEngine eng) => SA.Build.MachineSettings.Load(eng.MachineDir));
app.MapPost("/api/build/settings", (SA.Build.MachineSettings s, SA.Build.BuildEngine eng) =>
{
    s.CopyTo = string.IsNullOrWhiteSpace(s.CopyTo) ? null : s.CopyTo.Trim();
    var err = s.CopyToOn ? SA.Build.MachineSettings.CopyToError(s.CopyTo) : null;
    if (err != null) return Results.Ok(new { ok = false, message = "Copy to: " + err });
    // round 8: only the Copy-to fields change here (the settings dialog owns the rest)
    SA.Build.MachineSettings.Update(eng.MachineDir, m => { m.CopyTo = s.CopyTo; m.CopyToOn = s.CopyToOn; });
    return Results.Ok(new { ok = true });
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
record DrawingReq(JsonElement Spec, string? File, string? FileName, bool Overwrite, bool Force, bool Rename = false);

record RunRequest(string? File, string? Source, string? SourceName, string? ClassName,
                  Dictionary<string, JsonElement>? Params, WorldInput? World);

// นับจำนวนครั้งที่ dotnet watch ทำ hot reload ของตัวเว็บเอง
internal static class HotReloadTracker
{
    public static int Version;
    public static void ClearCache(Type[]? types) { }
    public static void UpdateApplication(Type[]? types) => Interlocked.Increment(ref Version);
}
