// Round 8: project file (*.assembly.json) version 3, and migration of versions 1 / 2 (design section 3-4).
//   v1 = one assembly at the root (items, baseline, name) · v2 = assemblies[] · both embed spec / savedSpec per item
//   v3 = always assemblies[]; items keep id, file, name, className, params, attach (+ draft when needed); scenarios
// The .cs is the only source of a saved spec. A draft keeps work that is not in a .cs yet:
//   { spec } = drawing not saved to its .cs · { fileName, spec } = drawn item with no file · { sourceName, source } = inline code

using System.Text.Json;
using System.Text.Json.Nodes;
using SA.Drawing;

namespace SA.Projects;

public record MigrationQuestion(string ItemId, string? ItemName, string File, string Reason);
// Kind "cs" = a subassembly file of an item; "style" = the project's style file (ItemId = "", round 10)
public record MissingFile(string ItemId, string? ItemName, string File, string Kind = "cs");

public class ProjectOpenResult
{
    public JsonObject Content { get; set; } = new();       // v3
    public int FromVersion { get; set; }
    public bool Changed { get; set; }                       // migration changed something: the page shows "*"
    public List<MigrationQuestion> Questions { get; set; } = new();
    public List<MissingFile> Missing { get; set; } = new();
}

public static class ProjectFile
{
    public const int Version = 3;
    public const string Ext = ".assembly.json";
    public const string StyleExt = ".style.json";               // style by code (docs/display.md); the project file key "styleFile" points at it

    static readonly string[] KeepItem = { "id", "file", "name", "className", "params", "attach", "draft" };
    static readonly JsonSerializerOptions Indented = new() { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static string Serialize(JsonObject v3) => v3.ToJsonString(Indented).ReplaceLineEndings("\r\n");

    // Items of any version (v1 root items, v2 / v3 assemblies[].items)
    public static IEnumerable<JsonObject> Items(JsonObject root)
    {
        if (root["items"] is JsonArray a1) foreach (var it in a1.OfType<JsonObject>()) yield return it;
        if (root["assemblies"] is JsonArray asms)
            foreach (var a in asms.OfType<JsonObject>())
                if (a["items"] is JsonArray its) foreach (var it in its.OfType<JsonObject>()) yield return it;
    }

    public static string? Str(JsonNode? n) => n is JsonValue v && v.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s) ? s : null;

    // .cs files referenced by the project, in item order, once each
    public static List<string> Files(JsonObject root)
    {
        var list = new List<string>();
        foreach (var it in Items(root))
            if (Str(it["file"]) is { } f && !list.Contains(f, StringComparer.OrdinalIgnoreCase)) list.Add(f);
        return list;
    }

    // The spec in a .cs (sa-spec), null when the file has no SA-DRAWING block
    public static JsonNode? FileSpec(string path)
    {
        var block = CodeGenerator.FindBlock(FileUtil.ReadShared(path));
        if (block?.SpecJson == null) return null;
        try { return JsonNode.Parse(block.SpecJson); } catch (JsonException) { return null; }
    }

    // Reads any version, returns v3. dir = folder of the project file (for the .cs specs and the missing-file list).
    public static ProjectOpenResult Open(string json, string dir)
    {
        var root = JsonNode.Parse(json) as JsonObject ?? throw new FormatException("ไฟล์ project ไม่ใช่ JSON object");
        int ver = root["version"] is JsonValue vv && vv.TryGetValue<int>(out var n) ? n : 1;
        if (ver > Version) throw new FormatException($"ไฟล์ project รุ่น {ver} ใหม่กว่าเว็บนี้ (รองรับถึงรุ่น {Version})");
        var r = new ProjectOpenResult { FromVersion = ver };

        // 1. shape: always assemblies[]
        var v3 = new JsonObject { ["version"] = Version };
        foreach (var kv in root.ToList())
            if (kv.Key is not ("version" or "items" or "assemblies" or "baseline" or "name")) v3[kv.Key] = kv.Value?.DeepClone();
        JsonArray asms;
        if (root["assemblies"] is JsonArray a2) asms = (JsonArray)a2.DeepClone();
        else
        {
            asms = new JsonArray();
            var one = new JsonObject { ["id"] = "a1", ["name"] = root["name"]?.DeepClone() ?? "Assembly 1",
                                       ["baseline"] = root["baseline"]?.DeepClone() ?? new JsonObject { ["x"] = 0, ["y"] = 0 },
                                       ["items"] = root["items"]?.DeepClone() ?? new JsonArray() };
            asms.Add(one);
        }
        r.Changed = ver < Version;
        v3["assemblies"] = asms;
        if (v3["scenarios"] is not JsonArray) v3["scenarios"] = new JsonArray();

        // 2. items
        int k = 0;
        foreach (var it in Items(v3).ToList())
        {
            k++;
            if (Str(it["id"]) == null) { it["id"] = "i" + k; r.Changed = true; }
            var id = Str(it["id"])!;
            var name = Str(it["name"]);
            var file = Str(it["file"]);
            var spec = it["spec"];
            var saved = Str(it["savedSpec"]);
            JsonObject? draft = it["draft"] as JsonObject;

            if (file != null)
            {
                var path = ProjectPaths.Entry(dir, file);
                bool exists = path != null && File.Exists(path);
                if (!exists) r.Missing.Add(new(id, name, file));
                if (spec is JsonObject)
                {
                    if (!exists) draft = new JsonObject { ["spec"] = spec.DeepClone() };
                    else
                    {
                        var fs = FileSpec(path!);
                        if (fs != null && JsonNode.DeepEquals(fs, spec)) { }                    // same as the .cs: drop
                        else if (fs != null && saved != null && SameJson(saved, fs))
                            draft = new JsonObject { ["spec"] = spec.DeepClone() };            // unsaved drawing: draft, no question
                        else
                        {
                            draft = new JsonObject { ["spec"] = spec.DeepClone() };            // kept until the user answers
                            r.Questions.Add(new(id, name, file, fs == null
                                ? "ไฟล์ .cs ไม่มีส่วนที่วาด (sa-spec) แต่ไฟล์ project มี"
                                : "ส่วนที่วาดในไฟล์ project ไม่ตรงกับใน .cs (ไฟล์ .cs ถูกแก้หลังบันทึก project)"));
                        }
                    }
                }
            }
            else if (draft == null)
            {
                if (spec is JsonObject)
                {
                    draft = new JsonObject { ["spec"] = spec.DeepClone() };
                    if (Str(it["fileName"]) is { } fn) draft["fileName"] = fn;
                }
                else if (Str(it["source"]) is { } src)
                {
                    draft = new JsonObject { ["source"] = src };
                    if (Str(it["sourceName"]) is { } sn) draft["sourceName"] = sn;
                }
            }

            foreach (var key in it.Select(k => k.Key).ToList())
                if (!KeepItem.Contains(key)) { it.Remove(key); r.Changed = true; }
            if (draft != null && !ReferenceEquals(draft, it["draft"])) { it["draft"] = draft; r.Changed = true; }
        }
        // the style file is not an item: a missing one is listed (kind "style") but never blocks opening — automatic colours then
        if (Str(v3["styleFile"]) is { } sf && (ProjectPaths.Entry(dir, sf) is not { } sp || !File.Exists(sp)))
            r.Missing.Add(new("", null, sf, "style"));
        r.Content = v3;
        return r;
    }

    // Absolute path of the style file the project points at (null = no key / not a relative path)
    public static string? StylePath(JsonObject c, string dir) => Str(c["styleFile"]) is { } sf ? ProjectPaths.Entry(dir, sf) : null;

    static bool SameJson(string text, JsonNode node)
    {
        try { return JsonNode.DeepEquals(JsonNode.Parse(text), node); } catch (JsonException) { return false; }
    }

    // A v3 content from the page before it is written: version 3, relative paths only, no embedded spec outside draft.
    public static string? Validate(JsonObject c)
    {
        if (!(c["version"] is JsonValue v && v.TryGetValue<int>(out var n) && n == Version)) return "ต้องเป็นไฟล์ project รุ่น 3";
        if (c["assemblies"] is not JsonArray) return "ไม่มี assemblies";
        if (c.ContainsKey("styleFile") && c["styleFile"] != null)
        {
            if (Str(c["styleFile"]) is not { } sf || Path.IsPathRooted(sf) || sf.Contains(':') || !sf.EndsWith(StyleExt, StringComparison.OrdinalIgnoreCase))
                return "styleFile ต้องเป็น path แบบ relative ของไฟล์ *.style.json";
        }
        foreach (var it in Items(c))
        {
            if (Str(it["file"]) is { } f && (Path.IsPathRooted(f) || f.Contains(':'))) return $"path ของไฟล์ต้องเป็นแบบ relative: {f}";
            if (it.ContainsKey("spec") || it.ContainsKey("savedSpec")) return "spec ต้องอยู่ใน .cs หรือ draft เท่านั้น";
        }
        return null;
    }

    // Save as into another folder: item paths are rewritten relative to the new folder (same file on disk).
    // Returns the files that cannot be reached by a relative path (another drive); nothing is changed then.
    public static List<string> Rebase(JsonObject c, string oldDir, string newDir)
    {
        var sep = ProjectPaths.SepOf(Items(c).Select(i => Str(i["file"])));
        var bad = new List<string>();
        var map = new List<(JsonObject It, string Rel)>();
        foreach (var it in Items(c))
            if (Str(it["file"]) is { } f && ProjectPaths.Entry(oldDir, f) is { } full)
            {
                if (ProjectPaths.ToRelative(newDir, full, sep) is { } rel) map.Add((it, rel)); else bad.Add(f);
            }
        string? styleRel = null;
        if (Str(c["styleFile"]) is { } sf && ProjectPaths.Entry(oldDir, sf) is { } sfull)
        {
            styleRel = ProjectPaths.ToRelative(newDir, sfull, sep);
            if (styleRel == null) bad.Add(sf);
        }
        if (bad.Count == 0)
        {
            foreach (var (it, rel) in map) it["file"] = rel;
            if (styleRel != null) c["styleFile"] = styleRel;
        }
        return bad;
    }

    // Absolute paths of every referenced file (the project may reference files outside its folder)
    public static HashSet<string> Referenced(JsonObject c, string dir)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var f in Files(c)) if (ProjectPaths.Entry(dir, f) is { } full) set.Add(full);
        if (StylePath(c, dir) is { } style) set.Add(style);
        return set;
    }
}
