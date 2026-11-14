// Round 7: build-manifest.json in the output folder = what the last successful build of this DLL contained.
// The next build compares against it: a parameter added / removed / renamed / with a new default or type means the
// tools already on a Tool Palette are out of date ("ต้องลากเครื่องมือใหม่จาก catalog").
//
// build-history.json in the machine folder = every DLL path this machine built or copied, so a DLL of the same name in
// another folder can be found even after the project moved (Civil 3D cannot load two same-named DLLs from two paths).

using System.Globalization;
using System.Text.Json;

namespace SA.Build;

public class ManifestParam
{
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "";       // long | double | string | bool (as in GetInputParameters)
    public string? Default { get; set; }         // invariant text
}

public class ManifestClass
{
    public string FullName { get; set; } = "";
    public string File { get; set; } = "";
    public List<ManifestParam> Params { get; set; } = new();
}

public class BuildManifest
{
    public int Version { get; set; } = 1;
    public string DllName { get; set; } = "";
    public int Year { get; set; }
    public string Tfm { get; set; } = "";
    public string C3DInstall { get; set; } = "";
    public DateTime BuiltAt { get; set; }
    public List<string> Files { get; set; } = new();
    public List<ManifestClass> Classes { get; set; } = new();
    public List<string> CopiedTo { get; set; } = new();

    static readonly JsonSerializerOptions Json = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static BuildManifest? Load(string path)
    {
        try { return File.Exists(path) ? JsonSerializer.Deserialize<BuildManifest>(File.ReadAllText(path), Json) : null; }
        catch (Exception e) when (e is IOException or JsonException) { return null; }
    }

    public void Save(string path) => File.WriteAllText(path, JsonSerializer.Serialize(this, Json).ReplaceLineEndings("\r\n"));

    public static string? FormatDefault(object? v) => v switch
    {
        null => null,
        bool b => b ? "true" : "false",
        JsonElement e => e.ValueKind == JsonValueKind.String ? e.GetString() : e.GetRawText(),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => v.ToString()
    };
}

// Change: class-added | class-removed | added | removed | default | type
public record ParamChange(string Class, string? Param, string Change, string? Old, string? New)
{
    public string Text => Change switch
    {
        "class-added" => $"{Class}: class ใหม่",
        "class-removed" => $"{Class}: class ถูกเอาออก",
        "added" => $"{Class}: เพิ่ม parameter {Param}",
        "removed" => $"{Class}: ลบ parameter {Param}",
        "default" => $"{Class}: {Param} ค่าเริ่มต้น {Old} → {New}",
        "type" => $"{Class}: {Param} ชนิด {Old} → {New}",
        _ => $"{Class}: {Param} {Change}"
    };
}

public static class ManifestDiff
{
    // A renamed parameter shows as removed + added (the old name is what the palette tool still carries)
    public static List<ParamChange> Diff(BuildManifest? old, BuildManifest now)
    {
        var list = new List<ParamChange>();
        if (old == null) return list;
        var before = old.Classes.ToDictionary(c => c.FullName);
        var after = now.Classes.ToDictionary(c => c.FullName);
        foreach (var c in now.Classes)
        {
            if (!before.TryGetValue(c.FullName, out var o)) { list.Add(new(c.FullName, null, "class-added", null, null)); continue; }
            var op = o.Params.ToDictionary(p => p.Name);
            var np = c.Params.ToDictionary(p => p.Name);
            foreach (var p in o.Params.Where(p => !np.ContainsKey(p.Name))) list.Add(new(c.FullName, p.Name, "removed", p.Default, null));
            foreach (var p in c.Params)
            {
                if (!op.TryGetValue(p.Name, out var q)) { list.Add(new(c.FullName, p.Name, "added", null, p.Default)); continue; }
                if (q.Kind != p.Kind) list.Add(new(c.FullName, p.Name, "type", q.Kind, p.Kind));
                else if (q.Default != p.Default) list.Add(new(c.FullName, p.Name, "default", q.Default, p.Default));
            }
        }
        foreach (var c in old.Classes.Where(c => !after.ContainsKey(c.FullName))) list.Add(new(c.FullName, null, "class-removed", null, null));
        return list;
    }
}

public class BuildHistory
{
    public class Entry
    {
        public string Path { get; set; } = "";
        public int Year { get; set; }
        public DateTime At { get; set; }
    }

    readonly string _file;
    public BuildHistory(string machineDir) { _file = System.IO.Path.Combine(machineDir, "build-history.json"); }

    static readonly JsonSerializerOptions Json = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public List<Entry> Load()
    {
        try { return File.Exists(_file) ? JsonSerializer.Deserialize<List<Entry>>(File.ReadAllText(_file), Json) ?? new() : new(); }
        catch (Exception e) when (e is IOException or JsonException) { return new(); }
    }

    public void Record(string dllPath, int year)
    {
        var list = Load();
        var full = System.IO.Path.GetFullPath(dllPath);
        list.RemoveAll(e => string.Equals(e.Path, full, StringComparison.OrdinalIgnoreCase));
        list.Add(new Entry { Path = full, Year = year, At = DateTime.Now });
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(_file)!);
        File.WriteAllText(_file, JsonSerializer.Serialize(list, Json).ReplaceLineEndings("\r\n"));
    }

    // DLLs named <dllName>.dll that exist on disk outside the folders this build writes to (output folder, Copy-to folder).
    // Candidates: the history (same Civil 3D year: another year's DLL cannot be loaded by this Civil 3D anyway) + extra paths.
    public List<string> SameNameElsewhere(string dllName, int year, IEnumerable<string> targetDirs, IEnumerable<string>? extraDllPaths = null)
    {
        static string Norm(string d) => System.IO.Path.GetFullPath(d).TrimEnd('\\', '/');
        var targets = targetDirs.Select(Norm).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var file = dllName + ".dll";
        return Load().Where(e => e.Year == year).Select(e => e.Path)
            .Concat(extraDllPaths ?? Enumerable.Empty<string>())
            .Where(p => string.Equals(System.IO.Path.GetFileName(p), file, StringComparison.OrdinalIgnoreCase))
            .Select(System.IO.Path.GetFullPath)
            .Where(p => File.Exists(p) && !targets.Contains(Norm(System.IO.Path.GetDirectoryName(p)!)))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
