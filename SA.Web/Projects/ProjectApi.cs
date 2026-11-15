// Round 8: endpoints for project folders (design section 2.2). Localhost only, like the rest of the server.
//   GET  /api/fs/list?path=        drives + recent folders, or one folder: sub-folders + *.assembly.json / *.cs / *.png / *.zip
//   POST /api/project/open         {path, tab}         -> handle (header X-SA-Project from then on), v3 content, migration report
//   POST /api/project/new          {parent, name, tab} -> parent\name\name.assembly.json, opened
//   POST /api/project/save         {content, path?}    -> writes v3 (path = Save as; item paths rebased to the new folder)
//   POST /api/project/scratch      {tab}               -> handle for no project (scratch folder in the machine folder)
//   POST /api/project/close                            -> releases the handle
//   POST /api/project/relink       {path, sep?}        -> relative path of a file chosen for a missing one
//   POST /api/project/pack         {content, out, includeBuild, dryRun} -> zip of the project (ProjectPack.cs)
//   GET/POST /api/settings                             -> machine settings (%LOCALAPPDATA%\SA-Studio\settings.json)
// Read only for the file system except: project files (*.assembly.json) and the new project folder. No delete.

using System.Text.Json;
using System.Text.Json.Nodes;
using SA.Build;

namespace SA.Projects;

public record OpenReq(string? Path, string? Tab);
public record NewProjectReq(string? Parent, string? Name, string? Tab);
public record SaveProjectReq(JsonObject? Content, string? Path);
public record RelinkReq(string? Path, string? Sep);
public record ScratchReq(string? Tab);

public static class ProjectHttp
{
    public const string Header = "X-SA-Project";

    public static string? HandleOf(HttpContext h) => h.Request.Headers[Header].FirstOrDefault();

    public static IResult Lost() => Results.Json(new { ok = false, projectLost = true, message = "เซิร์ฟเวอร์ไม่รู้จักโปรเจกต์ของแท็บนี้แล้ว (เพิ่งรีสตาร์ต?) — เปิดโปรเจกต์ใหม่อีกครั้ง" }, statusCode: 409);
    public static IResult ReadOnly() => Results.Json(new { ok = false, readOnly = true, message = "โปรเจกต์นี้เปิดอยู่ในแท็บอื่น — แท็บนี้อ่านอย่างเดียว" }, statusCode: 409);
    static IResult Fail(string message) => Results.Ok(new { ok = false, message });

    static readonly string[] ListExts = { ".assembly.json", ".cs", ".png", ".zip" };

    static bool IsProjectPath(string? p) => !string.IsNullOrWhiteSpace(p) && Path.IsPathFullyQualified(p)
        && p.EndsWith(ProjectFile.Ext, StringComparison.OrdinalIgnoreCase) && Path.GetFileName(p).Length > ProjectFile.Ext.Length;

    static bool ValidName(string? n) => !string.IsNullOrWhiteSpace(n) && n.Trim() == n && !n.StartsWith('.') && !n.EndsWith('.')
        && n.IndexOfAny(Path.GetInvalidFileNameChars()) < 0;

    // GET /api/fs/list
    public static object List(string? path, MachineSettings settings, string startFolder)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            var drives = DriveInfo.GetDrives().Where(d => d.IsReady).Select(d => new { name = d.Name.TrimEnd('\\'), path = d.Name, kind = "drive" });
            var recent = settings.Recent.Select(r => Path.GetDirectoryName(r)!).Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(d => new { name = Path.GetFileName(d), path = d, kind = Directory.Exists(d) ? "recent" : "missing" });
            return new { ok = true, path = (string?)null, parent = (string?)null, start = startFolder, entries = drives.Concat(recent).ToList() };
        }
        if (!Path.IsPathFullyQualified(path) || !Directory.Exists(path)) return new { ok = false, message = $"ไม่พบโฟลเดอร์ {path}" };
        var dir = new DirectoryInfo(Path.GetFullPath(path));
        try
        {
            var hidden = FileAttributes.Hidden | FileAttributes.System;
            var folders = dir.EnumerateDirectories().Where(d => (d.Attributes & hidden) == 0 && !d.Name.StartsWith('.'))
                .OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
                .Select(d => new { name = d.Name, path = d.FullName, kind = "folder", size = (long?)null, mtime = (string?)null });
            var files = dir.EnumerateFiles().Where(f => (f.Attributes & hidden) == 0 && !f.Name.StartsWith('.') && ListExts.Any(e => f.Name.EndsWith(e, StringComparison.OrdinalIgnoreCase)))
                .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
                .Select(f => new { name = f.Name, path = f.FullName, kind = f.Name.EndsWith(ProjectFile.Ext, StringComparison.OrdinalIgnoreCase) ? "project" : f.Extension.TrimStart('.').ToLowerInvariant(),
                                   size = (long?)f.Length, mtime = (string?)f.LastWriteTimeUtc.Ticks.ToString() });
            return new { ok = true, path = dir.FullName, parent = dir.Parent?.FullName, start = startFolder, entries = folders.Concat(files).ToList() };
        }
        catch (Exception e) when (e is UnauthorizedAccessException or IOException)
        {
            return new { ok = false, message = $"อ่านโฟลเดอร์ {path} ไม่ได้: {e.Message}" };
        }
    }

    static object Opened(ProjectContext ctx, ProjectOpenResult r) => new
    {
        ok = true, handle = ctx.Handle, readOnly = ctx.ReadOnly,
        warning = ctx.ReadOnly ? "โปรเจกต์นี้เปิดอยู่ในแท็บอื่น — เปิดแบบอ่านอย่างเดียว (บันทึกไม่ได้)" : null,
        path = ctx.ProjectFile, dir = ctx.ProjectDir, name = ctx.Name,
        content = r.Content, fromVersion = r.FromVersion, changed = r.Changed, questions = r.Questions, missing = r.Missing,
    };

    // Opens a project file for a tab (also used by tests)
    public static object Open(ProjectRegistry reg, string machineDir, OpenReq req)
    {
        if (!IsProjectPath(req.Path)) return new { ok = false, message = "ต้องเป็น path เต็มของไฟล์ *.assembly.json" };
        var path = Path.GetFullPath(req.Path!);
        if (!File.Exists(path)) return new { ok = false, missingProject = true, message = $"ไม่พบไฟล์ {path}" };
        ProjectOpenResult r;
        try { r = ProjectFile.Open(FileUtil.ReadShared(path), Path.GetDirectoryName(path)!); }
        catch (Exception e) when (e is JsonException or FormatException) { return new { ok = false, message = $"อ่าน {Path.GetFileName(path)} ไม่ได้: {e.Message}" }; }
        var ctx = reg.Open(path, req.Tab, ProjectFile.Referenced(r.Content, Path.GetDirectoryName(path)!));
        MachineSettings.Update(machineDir, s => s.AddRecent(path));
        return Opened(ctx, r);
    }

    public static object New(ProjectRegistry reg, string machineDir, NewProjectReq req)
    {
        if (string.IsNullOrWhiteSpace(req.Parent) || !Path.IsPathFullyQualified(req.Parent) || !Directory.Exists(req.Parent))
            return new { ok = false, message = $"ไม่พบโฟลเดอร์ {req.Parent}" };
        if (!ValidName(req.Name)) return new { ok = false, message = $"ตั้งชื่อโปรเจกต์แบบนี้ไม่ได้: {req.Name}" };
        var dir = Path.Combine(Path.GetFullPath(req.Parent), req.Name!);
        var path = Path.Combine(dir, req.Name + ProjectFile.Ext);
        if (File.Exists(path)) return new { ok = false, message = $"มีโปรเจกต์ {path} อยู่แล้ว" };
        var content = new JsonObject
        {
            ["version"] = ProjectFile.Version,
            ["assemblies"] = new JsonArray(new JsonObject { ["id"] = "a1", ["name"] = req.Name, ["baseline"] = new JsonObject { ["x"] = 0, ["y"] = 0 }, ["items"] = new JsonArray() }),
            ["scenarios"] = new JsonArray(),
        };
        try
        {
            Directory.CreateDirectory(dir);
            FileUtil.WriteText(path, ProjectFile.Serialize(content));
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { return new { ok = false, message = $"สร้างโปรเจกต์ไม่ได้: {e.Message}" }; }
        return Open(reg, machineDir, new OpenReq(path, req.Tab));
    }

    public static object Save(ProjectRegistry reg, string machineDir, ProjectContext ctx, SaveProjectReq req)
    {
        if (req.Content == null) return new { ok = false, message = "ไม่มีเนื้อหาให้บันทึก" };
        var err = ProjectFile.Validate(req.Content);
        if (err != null) return new { ok = false, message = err };
        var path = ctx.ProjectFile;
        if (!string.IsNullOrWhiteSpace(req.Path))
        {
            if (!IsProjectPath(req.Path)) return new { ok = false, message = "ต้องเป็น path เต็มของไฟล์ *.assembly.json" };
            var newPath = Path.GetFullPath(req.Path);
            var newDir = Path.GetDirectoryName(newPath)!;
            if (!Directory.Exists(Path.GetDirectoryName(newDir))) return new { ok = false, message = $"ไม่พบโฟลเดอร์ {Path.GetDirectoryName(newDir)}" };
            var bad = ProjectFile.Rebase(req.Content, ctx.ProjectDir, newDir);
            if (bad.Count > 0) return new { ok = false, message = $"อ้างไฟล์จากโฟลเดอร์ใหม่แบบ relative ไม่ได้ (คนละไดรฟ์): {string.Join(", ", bad)}" };
            if (!reg.Move(ctx, newPath)) return new { ok = false, message = $"{Path.GetFileName(newPath)} เปิดอยู่ในแท็บอื่น" };
            path = newPath;
        }
        if (path == null) return new { ok = false, needPath = true, message = "ยังไม่มีไฟล์โปรเจกต์ — ใช้ Save as" };
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            FileUtil.WriteText(path, ProjectFile.Serialize(req.Content));
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { return new { ok = false, message = $"บันทึก {Path.GetFileName(path)} ไม่ได้: {e.Message}" }; }
        ctx.Referenced = ProjectFile.Referenced(req.Content, ctx.ProjectDir);
        MachineSettings.Update(machineDir, s => s.AddRecent(path));
        return new { ok = true, path, dir = ctx.ProjectDir, name = ctx.Name, content = req.Content };
    }

    public static object Relink(ProjectContext ctx, RelinkReq req)
    {
        if (string.IsNullOrWhiteSpace(req.Path) || !Path.IsPathFullyQualified(req.Path) || !req.Path.EndsWith(".cs", StringComparison.OrdinalIgnoreCase))
            return new { ok = false, message = "ต้องเป็น path เต็มของไฟล์ .cs" };
        var full = Path.GetFullPath(req.Path);
        if (!File.Exists(full)) return new { ok = false, message = $"ไม่พบไฟล์ {full}" };
        var rel = ProjectPaths.ToRelative(ctx.ProjectDir, full, req.Sep == "/" ? '/' : '\\');
        if (rel == null) return new { ok = false, message = "ไฟล์อยู่คนละไดรฟ์กับโปรเจกต์ — copy ไฟล์มาไว้ในโฟลเดอร์โปรเจกต์ก่อน" };
        ctx.Referenced.Add(full);
        return new { ok = true, file = rel, outside = !ProjectPaths.IsInside(ctx.ProjectDir, full) };
    }

    static object SettingsView(MachineSettings s, string startFolder) => new
    {
        s.CopyTo, s.CopyToOn, s.C3dInstall, s.ReopenLast, s.StartFolder, s.Recent,
        recentInfo = s.Recent.Select(r => new { path = r, name = Path.GetFileName(r)[..^ProjectFile.Ext.Length], exists = File.Exists(r) }),
        startEffective = string.IsNullOrWhiteSpace(s.StartFolder) ? startFolder : s.StartFolder,
    };

    public static void MapProjectApi(this WebApplication app, string startFolder)
    {
        app.MapGet("/api/fs/list", (string? path, BuildEngine eng) => List(path, MachineSettings.Load(eng.MachineDir), startFolder));

        app.MapPost("/api/project/open", (OpenReq req, ProjectRegistry reg, BuildEngine eng) => Open(reg, eng.MachineDir, req));
        app.MapPost("/api/project/new", (NewProjectReq req, ProjectRegistry reg, BuildEngine eng) => New(reg, eng.MachineDir, req));
        app.MapPost("/api/project/save", (HttpContext h, SaveProjectReq req, ProjectRegistry reg, BuildEngine eng) =>
        {
            var ctx = reg.Get(HandleOf(h));
            if (ctx == null) return Lost();
            if (ctx.Legacy) return Fail("ยังไม่ได้เปิดโปรเจกต์ (ใช้ Open / New project)");
            if (ctx.ReadOnly) return ReadOnly();
            return Results.Ok(Save(reg, eng.MachineDir, ctx, req));
        });
        app.MapPost("/api/project/scratch", (ScratchReq req, ProjectRegistry reg) =>
        {
            Directory.CreateDirectory(reg.ScratchDir);
            var c = reg.Open(null, req.Tab);
            return Results.Ok(new { ok = true, handle = c.Handle, readOnly = false, dir = c.ProjectDir });
        });
        // Pack project (M4): dry run = the list for the dialog; a read-only tab may pack (it only reads the project)
        app.MapPost("/api/project/pack", (HttpContext h, PackReq req, ProjectRegistry reg) =>
        {
            var ctx = reg.Get(HandleOf(h));
            if (ctx == null) return Lost();
            if (ctx.Legacy) return Fail("ยังไม่ได้เปิดโปรเจกต์");
            return Results.Ok(ProjectPack.Pack(ctx, req));
        });
        app.MapPost("/api/project/close", (HttpContext h, ProjectRegistry reg) => { reg.Close(HandleOf(h)); return Results.Ok(new { ok = true }); });
        app.MapPost("/api/project/relink", (HttpContext h, RelinkReq req, ProjectRegistry reg) =>
        {
            var ctx = reg.Get(HandleOf(h));
            if (ctx == null) return Lost();
            if (ctx.ReadOnly) return ReadOnly();
            return Results.Ok(Relink(ctx, req));
        });

        app.MapGet("/api/settings", (BuildEngine eng) => SettingsView(MachineSettings.Load(eng.MachineDir), startFolder));
        // fields that are present replace the stored ones; "clearRecent": true empties the recent list
        app.MapPost("/api/settings", (JsonObject body, BuildEngine eng) =>
        {
            string? Str(string k) => body[k] is JsonValue v && v.TryGetValue<string>(out var s) ? (string.IsNullOrWhiteSpace(s) ? null : s.Trim()) : null;
            bool? Bool(string k) => body[k] is JsonValue v && v.TryGetValue<bool>(out var b) ? b : null;
            var cur = MachineSettings.Load(eng.MachineDir);
            var copyTo = body.ContainsKey("copyTo") ? Str("copyTo") : cur.CopyTo;
            var copyOn = Bool("copyToOn") ?? cur.CopyToOn;
            var err = copyOn ? MachineSettings.CopyToError(copyTo) : null;
            if (err != null) return Fail("Copy to: " + err);
            var c3d = body.ContainsKey("c3dInstall") ? Str("c3dInstall") : cur.C3dInstall;
            if (c3d != null && !Directory.Exists(c3d)) return Fail($"ไม่พบโฟลเดอร์ Civil 3D {c3d}");
            var start = body.ContainsKey("startFolder") ? Str("startFolder") : cur.StartFolder;
            if (start != null && !Directory.Exists(start)) return Fail($"ไม่พบโฟลเดอร์ {start}");
            var s = MachineSettings.Update(eng.MachineDir, s =>
            {
                s.CopyTo = copyTo; s.CopyToOn = copyOn; s.C3dInstall = c3d; s.StartFolder = start;
                if (Bool("reopenLast") is { } r) s.ReopenLast = r;
                if (Bool("clearRecent") == true) s.Recent.Clear();
            });
            return Results.Ok(new { ok = true, settings = SettingsView(s, startFolder) });
        });
    }
}
