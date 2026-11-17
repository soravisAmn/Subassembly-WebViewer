// Round 8 M4: Pack project = one zip that opens anywhere (like AutoCAD eTransmit).
//   <name>/<name>.assembly.json   the project file (content from the page: drafts included; outside paths rewritten)
//   <name>/<file>.cs (+ .png)     every referenced .cs at its relative path; a .png with the same name beside it too
//   <name>/ext/<file>.cs          files referenced from outside the project folder, copied in; paths rewritten in the zip only
//   <name>/lib/…                  the whole lib\ folder (round 12)
//   <name>/build/…                only when asked (default off)
// The open project is never changed. Missing files are listed and skipped. There is no "open zip": unzip, then Open project.

using System.IO.Compression;
using System.Text;
using System.Text.Json.Nodes;

namespace SA.Projects;

public record PackReq(JsonObject? Content, string? Out, bool IncludeBuild = false, bool DryRun = false);
public record PackOutside(string File, string PackedAs);

public class PackResult
{
    public bool Ok { get; set; }
    public string? Message { get; set; }
    public string? Zip { get; set; }
    public string DefaultName { get; set; } = "";
    public List<string> Entries { get; set; } = new();
    public List<PackOutside> Outside { get; set; } = new();
    public List<string> Missing { get; set; } = new();
    public int Drafts { get; set; }
    public long Bytes { get; set; }
}

public static class ProjectPack
{
    static readonly StringComparer Cmp = StringComparer.OrdinalIgnoreCase;

    // ext/ name for the i-th file with the same name: x-2.cs, x-2.style.json (the suffix goes before a double extension)
    public static string ExtName(string baseName, int i)
    {
        var ext = baseName.EndsWith(ProjectFile.StyleExt, StringComparison.OrdinalIgnoreCase) ? ProjectFile.StyleExt : Path.GetExtension(baseName);
        return $"ext/{baseName[..^ext.Length]}-{i}{ext}";
    }

    public static string DefaultZipName(string projectName, DateTime now) => $"{projectName}_{now:yyyy-MM-dd}.zip";

    public static PackResult Pack(ProjectContext ctx, PackReq req, DateTime? now = null)
    {
        var r = new PackResult();
        if (ctx.ProjectFile == null) { r.Message = "Save project ก่อน (Pack ใช้ไฟล์โปรเจกต์)"; return r; }
        var dir = ctx.ProjectDir;
        var name = ctx.Name;
        r.DefaultName = DefaultZipName(name, now ?? DateTime.Now);
        JsonObject content;
        if (req.Content != null)
        {
            var err = ProjectFile.Validate(req.Content);
            if (err != null) { r.Message = err; return r; }
            content = (JsonObject)req.Content.DeepClone();
        }
        else content = ProjectFile.Open(FileUtil.ReadShared(ctx.ProjectFile), dir).Content;

        var files = new List<(string Zip, string Src)>();
        var used = new HashSet<string>(Cmp);
        void Add(string zipRel, string src)
        {
            zipRel = zipRel.Replace('\\', '/');
            if (used.Add(zipRel)) files.Add((zipRel, src));
        }
        // a .png with the same name beside a .cs (thumbnail / icon, round 11)
        void AddWithPng(string zipRel, string full)
        {
            Add(zipRel, full);
            var png = Path.ChangeExtension(full, ".png");
            if (File.Exists(png)) Add(Path.ChangeExtension(zipRel, ".png"), png);
        }

        var sep = ProjectPaths.SepOf(ProjectFile.Items(content).Select(i => ProjectFile.Str(i["file"])));
        var rewrite = new Dictionary<string, string>(Cmp);            // file entry -> path inside the zip's project folder
        foreach (var f in ProjectFile.Files(content))
        {
            var full = ProjectPaths.Entry(dir, f);
            if (full == null || !File.Exists(full)) { r.Missing.Add(f); continue; }
            if (ProjectPaths.IsInside(dir, full)) { AddWithPng(ProjectPaths.ToRelative(dir, full)!, full); continue; }
            var baseName = Path.GetFileName(full);
            var rel = "ext/" + baseName;
            for (int i = 2; used.Contains(rel); i++) rel = ExtName(baseName, i);
            AddWithPng(rel, full);
            var packed = sep == '/' ? rel : rel.Replace('/', '\\');
            rewrite[f] = packed;
            r.Outside.Add(new(f, packed));
        }
        foreach (var it in ProjectFile.Items(content))
        {
            if (ProjectFile.Str(it["file"]) is { } f && rewrite.TryGetValue(f, out var p)) it["file"] = p;
            if (it["draft"] is JsonObject) r.Drafts++;
        }
        // the style file (round 10): inside the folder it keeps its path; outside it is copied to ext/ and the path is rewritten in the zip only
        if (ProjectFile.Str(content["styleFile"]) is { } sf)
        {
            var sfull = ProjectPaths.Entry(dir, sf);
            if (sfull == null || !File.Exists(sfull)) r.Missing.Add(sf);
            else if (ProjectPaths.IsInside(dir, sfull)) Add(ProjectPaths.ToRelative(dir, sfull)!, sfull);
            else
            {
                var baseName = Path.GetFileName(sfull);
                var rel = "ext/" + baseName;
                for (int i = 2; used.Contains(rel); i++) rel = ExtName(baseName, i);
                Add(rel, sfull);
                var packed = sep == '/' ? rel : rel.Replace('/', '\\');
                content["styleFile"] = packed;
                r.Outside.Add(new(sf, packed));
            }
        }
        // no key: the default {project}.style.json beside the project file goes in too (same folder, path unchanged)
        else if (File.Exists(Path.Combine(dir, name + ProjectFile.StyleExt))) Add(name + ProjectFile.StyleExt, Path.Combine(dir, name + ProjectFile.StyleExt));
        void AddDir(string sub)
        {
            var d = Path.Combine(dir, sub);
            if (!Directory.Exists(d)) return;
            foreach (var f in Directory.GetFiles(d, "*", SearchOption.AllDirectories))
                Add(ProjectPaths.ToRelative(dir, f)!, f);
        }
        AddDir("lib");
        if (req.IncludeBuild) AddDir("build");

        var projName = name + ProjectFile.Ext;
        r.Entries = new[] { projName }.Concat(files.Select(f => f.Zip)).ToList();
        if (req.DryRun) { r.Ok = true; return r; }

        if (string.IsNullOrWhiteSpace(req.Out) || !Path.IsPathFullyQualified(req.Out) || !req.Out.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        { r.Message = "ต้องเป็น path เต็มของไฟล์ .zip"; return r; }
        var outPath = Path.GetFullPath(req.Out);
        if (!Directory.Exists(Path.GetDirectoryName(outPath))) { r.Message = $"ไม่พบโฟลเดอร์ {Path.GetDirectoryName(outPath)}"; return r; }
        var tmp = outPath + ".packing";
        try
        {
            using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write))
            using (var zip = new ZipArchive(fs, ZipArchiveMode.Create))
            {
                var e = zip.CreateEntry(name + "/" + projName, CompressionLevel.Optimal);
                using (var w = new StreamWriter(e.Open(), new UTF8Encoding(true))) w.Write(ProjectFile.Serialize(content));
                foreach (var (zipRel, src) in files)
                {
                    var entry = zip.CreateEntry(name + "/" + zipRel, CompressionLevel.Optimal);
                    using var dst = entry.Open();
                    using var s = new FileStream(src, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                    s.CopyTo(dst);
                }
            }
            File.Move(tmp, outPath, overwrite: true);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            try { File.Delete(tmp); } catch (IOException) { }
            r.Message = $"เขียน {Path.GetFileName(outPath)} ไม่ได้: {e.Message}";
            return r;
        }
        r.Ok = true; r.Zip = outPath; r.Bytes = new FileInfo(outPath).Length;
        return r;
    }
}
