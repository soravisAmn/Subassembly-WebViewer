// Round 7 M2: pre-build checks (Build dialog and MCP sa_build_check). Everything runs on the server, on the files as they
// are on disk (that is what dotnet build will compile):
//   - compile in the simulator (error = blocking), run every class in a set of scenarios Right + Left like sa_check
//     (high, low, mid, rising, falling, V around the shape, layout, no target) + saved scenarios sent by the page;
//     an exception = blocking, simulator messages = warnings
//   - links / shapes without a code: from the sa-spec (ids L3, S1) for web files, from the simulator run for hand-written ones
//   - codes that differ only by case / spaces across the whole DLL (Datum vs datum)
//   - per Civil 3D year: DLL locked (blocking), same-named DLL in another folder, parameters changed since the last build

using System.Text.Json;
using SA.Drawing;
using SA.Shim;

namespace SA.Build;

// A scenario from the page (saved scenarios): ground relative to the item's origin, parameter values, layout mode
public record CheckScenario(string? File, string? Name, List<SurfacePt>? Surface, Dictionary<string, JsonElement>? Values, bool Layout);

public record CheckRequest(string? Project, string? DllName, int[]? Years, string[]? Files, List<CheckScenario>? Scenarios);

// Kind: compile | run | message | no-code | code-case | locked | same-name | params | class (from ClassReader)
public record CheckIssue(string Severity, string Kind, string? File, string Message, List<string>? Scenarios = null);

public class CheckYear
{
    public int Year { get; set; }
    public string Tfm { get; set; } = "";
    public bool CanBuild { get; set; }
    public string? Reason { get; set; }
    public string OutDir { get; set; } = "";
    public bool Locked { get; set; }
    public List<string> SameName { get; set; } = new();
    public List<ParamChange> Changes { get; set; } = new();
    public bool HasManifest { get; set; }
}

public class CheckResult
{
    public bool Ok { get; set; }                       // no blocking error (the years ticked included)
    public string DllName { get; set; } = "";
    public string? Project { get; set; }
    public List<string> Files { get; set; } = new();
    public List<ClassInfo> Classes { get; set; } = new();
    public List<string> WebFiles { get; set; } = new();   // files with an sa-spec (namespace / class can be edited from the dialog)
    public List<CheckIssue> Issues { get; set; } = new();
    public List<CheckYear> Years { get; set; } = new();
    public int ScenarioRuns { get; set; }
    public double Ms { get; set; }
}

public partial class BuildEngine
{
    public CheckResult Check(CheckRequest req)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var plan = Plan(new BuildRequest(req.Project, req.DllName, req.Years, req.Files));
        var r = new CheckResult { DllName = plan.DllName, Project = plan.Project, Files = plan.Files, Classes = plan.Classes };
        r.Issues.AddRange(plan.Issues.Select(i => new CheckIssue(i.Severity, "class", i.File, i.Message)));

        var current = new List<ManifestClass>();
        var codes = new List<(string Code, string Where)>();
        foreach (var name in plan.Files)
        {
            var src = FileUtil.ReadShared(Path.Combine(_folder, name));
            var block = CodeGenerator.FindBlock(src);
            DrawingSpec? spec = null;
            if (block?.SpecJson != null)
                try { spec = DrawingSpec.Parse(block.SpecJson); r.WebFiles.Add(name); }
                catch (Exception e) when (e is JsonException or FormatException) { r.Issues.Add(new("warning", "no-code", name, $"อ่าน sa-spec ไม่ได้: {e.Message}")); }

            var compiled = _compiler.Compile(src, name);
            if (!compiled.Success)
            {
                foreach (var d in compiled.Diagnostics.Where(d => d.Severity.Equals("Error", StringComparison.OrdinalIgnoreCase)).Take(10))
                    r.Issues.Add(new("error", "compile", name, $"บรรทัด {d.Line}: {d.Id} {d.Message}"));
                continue;
            }
            foreach (var c in plan.Classes.Where(c => c.File == name))
            {
                var type = compiled.Classes.FirstOrDefault(t => t.FullName == c.FullName);
                if (type == null) continue;
                var mc = CheckClass(r, name, type, spec, req.Scenarios, codes);
                if (mc != null) current.Add(mc);
            }
            if (spec != null) NoCodeFromSpec(r, name, spec);
        }

        // codes that differ only by case / spaces
        foreach (var g in codes.GroupBy(c => NormCode(c.Code)).Where(g => g.Select(c => c.Code).Distinct().Count() > 1))
        {
            var variants = g.GroupBy(c => c.Code).Select(v => $"\"{v.Key}\" ({string.Join(", ", v.Select(x => x.Where).Distinct().Take(3))})");
            r.Issues.Add(new("warning", "code-case", null, $"code ต่างกันแค่ตัวพิมพ์เล็ก/ใหญ่หรือช่องว่าง: {string.Join(" · ", variants)}"));
        }

        // per Civil 3D year
        var proj = ProjectPath(req.Project);
        var installs = Installs();
        foreach (var inst in installs)
        {
            var y = new CheckYear { Year = inst.Year, Tfm = inst.Tfm, CanBuild = inst.CanBuild, Reason = inst.Reason };
            r.Years.Add(y);
            if (proj == null || !ValidDllName(r.DllName)) continue;
            y.OutDir = BuildPaths.OutputDir(proj, r.DllName, inst.Year);
            if (!inst.CanBuild) continue;
            bool ticked = req.Years?.Contains(inst.Year) == true;
            y.Locked = IsLocked(BuildPaths.Dll(y.OutDir, r.DllName));
            y.SameName = History.SameNameElsewhere(r.DllName, inst.Year, TargetDirs(y.OutDir));
            var old = BuildManifest.Load(BuildPaths.Manifest(y.OutDir));
            y.HasManifest = old != null;
            y.Changes = ManifestDiff.Diff(old, new BuildManifest { Classes = current });
            if (!ticked) continue;
            if (y.Locked) r.Issues.Add(new("error", "locked", null, $"Civil 3D {inst.Year}: ปิด Civil 3D ก่อน — {r.DllName}.dll ถูกโปรแกรมอื่นใช้อยู่"));
            if (y.SameName.Count > 0)
                r.Issues.Add(new("warning", "same-name", null, $"Civil 3D {inst.Year}: มี {r.DllName}.dll อยู่แล้วที่ {string.Join(", ", y.SameName)} — Civil 3D โหลด DLL ชื่อเดียวกันจาก 2 ที่ใน session เดียวไม่ได้"));
            if (y.Changes.Count > 0)
                r.Issues.Add(new("warning", "params", null, $"Civil 3D {inst.Year}: parameter เปลี่ยนจาก build ครั้งก่อน — ต้องลากเครื่องมือใหม่จาก catalog: {string.Join("; ", y.Changes.Select(c => c.Text))}"));
        }

        r.Ok = !r.Issues.Any(i => i.Severity == "error");
        r.Ms = sw.Elapsed.TotalMilliseconds;
        return r;
    }

    static string NormCode(string c) => new string(c.Where(ch => !char.IsWhiteSpace(ch)).ToArray()).ToLowerInvariant();

    // Runs one class in every scenario; returns its parameters (for the manifest diff), null when the first run failed
    ManifestClass? CheckClass(CheckResult r, string file, Type type, DrawingSpec? spec, List<CheckScenario>? saved, List<(string, string)> codes)
    {
        var baseRun = _runner.Run(type, null, new WorldInput { LayoutMode = true });
        var fullName = type.FullName ?? type.Name;
        if (baseRun.Exception != null && baseRun.Stage != "Draw")
        {
            r.Issues.Add(new("error", "run", file, $"{fullName}: {ExceptionText(baseRun)}"));
            return null;
        }
        var mc = new ManifestClass
        {
            FullName = fullName, File = file,
            Params = baseRun.Params.Select(p => new ManifestParam { Name = p.Name, Kind = p.Kind, Default = BuildManifest.FormatDefault(p.Default) }).ToList()
        };

        // grounds around the shape (relative to the origin), as sa_check
        const double elev = 100.0;   // WorldInput.OriginElevation default
        var pts = baseRun.Points.Select(p => (X: p.X, Y: p.Y - elev)).ToList();
        if (pts.Count == 0) pts.Add((0, 0));
        double yMin = pts.Min(p => p.Y), yMax = pts.Max(p => p.Y), R = pts.Max(p => Math.Abs(p.X)) + 30;
        List<SurfacePt> L(params (double X, double Y)[] p) => p.Select(q => new SurfacePt(q.X, q.Y)).ToList();
        var grounds = new (string Name, List<SurfacePt> Line)[]
        {
            ("high", L((-R, yMax + 3), (R, yMax + 3))), ("low", L((-R, yMin - 3), (R, yMin - 3))), ("mid", L((-R, (yMin + yMax) / 2), (R, (yMin + yMax) / 2))),
            ("rising", L((-R, yMin - 3), (R, yMax + 3))), ("falling", L((-R, yMax + 3), (R, yMin - 3))), ("V", L((-R, yMax + 3), (0, yMin - 3), (R, yMax + 3)))
        };
        var side = spec?.Side?.Param ?? (mc.Params.Any(p => p.Name == "Side") ? "Side" : null);
        var runs = new List<(string Name, Dictionary<string, JsonElement>? Values, WorldInput World)>();
        foreach (var (sd, sname) in new[] { (0, "Right"), (1, "Left") })
        {
            if (side == null && sd == 1) break;
            var values = side == null ? null : new Dictionary<string, JsonElement> { [side] = JsonSerializer.SerializeToElement(sd) };
            foreach (var g in grounds) runs.Add(($"{g.Name} {sname}", values, new WorldInput { Surface = g.Line }));
            runs.Add(($"layout {sname}", values, new WorldInput { LayoutMode = true }));
            runs.Add(($"no target {sname}", values, new WorldInput { SurfaceAssigned = false }));
        }
        foreach (var s in saved ?? new())
            if (string.Equals(s.File, file, StringComparison.OrdinalIgnoreCase))
                runs.Add(($"saved: {s.Name}", s.Values, new WorldInput { Surface = s.Surface, LayoutMode = s.Layout, SurfaceAssigned = s.Surface is { Count: >= 2 } }));

        var errors = new Dictionary<string, List<string>>();
        var messages = new Dictionary<string, List<string>>();
        var noCodeLinks = new SortedDictionary<int, string>();
        var noCodeShapes = new SortedDictionary<int, string>();
        foreach (var (name, values, world) in runs)
        {
            var o = _runner.Run(type, values, world);
            r.ScenarioRuns++;
            if (o.Exception != null) Add(errors, $"{fullName}: {ExceptionText(o)}", name);
            foreach (var i in o.Issues) Add(messages, $"{fullName}: {i.Message}", name);
            foreach (var p in o.Points) foreach (var c in p.Codes) codes.Add((c, file));
            var links = o.Links.Select(l => JsonSerializer.SerializeToElement(l)).ToList();
            var shapes = o.Shapes.Select(s => JsonSerializer.SerializeToElement(s)).ToList();
            for (int k = 0; k < links.Count; k++)
            {
                var lc = links[k].GetProperty("codes").EnumerateArray().Select(e => e.GetString() ?? "").ToList();
                foreach (var c in lc) codes.Add((c, file));
                if (lc.Count == 0 && spec == null) noCodeLinks.TryAdd(k, $"link #{k}{SiteText(links[k])}");
            }
            for (int k = 0; k < shapes.Count; k++)
            {
                var sc = shapes[k].GetProperty("codes").EnumerateArray().Select(e => e.GetString() ?? "").ToList();
                foreach (var c in sc) codes.Add((c, file));
                if (sc.Count == 0 && spec == null) noCodeShapes.TryAdd(k, $"shape #{k}{SiteText(shapes[k])}");
            }
        }
        foreach (var (msg, sc) in errors) r.Issues.Add(new("error", "run", file, msg, sc));
        foreach (var (msg, sc) in messages) r.Issues.Add(new("warning", "message", file, msg, sc));
        if (noCodeLinks.Count > 0) r.Issues.Add(new("warning", "no-code", file, $"{fullName}: link ที่ไม่มี code: {string.Join(", ", noCodeLinks.Values.Take(30))}{More(noCodeLinks.Count)}"));
        if (noCodeShapes.Count > 0) r.Issues.Add(new("warning", "no-code", file, $"{fullName}: shape ที่ไม่มี code: {string.Join(", ", noCodeShapes.Values.Take(30))}{More(noCodeShapes.Count)}"));
        return mc;
    }

    static string More(int n) => n > 30 ? $" … อีก {n - 30}" : "";

    static void Add(Dictionary<string, List<string>> d, string key, string scenario)
    {
        if (!d.TryGetValue(key, out var list)) d[key] = list = new();
        list.Add(scenario);
    }

    static string ExceptionText(RunOutput o)
    {
        var e = JsonSerializer.SerializeToElement(o.Exception);
        string P(string n) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(n, out var v) ? v.ToString() : "";
        return $"{P("type")} ขั้น {o.Stage ?? "?"}: {P("message")}";
    }

    // " (บรรทัด 120)" from the call sites the simulator recorded
    static string SiteText(JsonElement o)
    {
        if (!o.TryGetProperty("sites", out var s) || s.ValueKind != JsonValueKind.Array) return "";
        var lines = s.EnumerateArray().Where(x => x.TryGetProperty("Line", out _)).Select(x => x.GetProperty("Line").GetInt32()).Where(n => n > 0).Distinct().Take(2).ToList();
        return lines.Count == 0 ? "" : $" (บรรทัด {string.Join(", ", lines)})";
    }

    // Web files: real (non-auxiliary) links / shapes of the sa-spec without any code, by id
    static void NoCodeFromSpec(CheckResult r, string file, DrawingSpec spec)
    {
        var links = spec.Links.Where(l => !l.Auxiliary && l.Codes.Count == 0 && l.CodesGround.Count == 0 && l.CodesLine.Count == 0).Select(l => l.Id).ToList();
        var shapes = spec.Shapes.Where(s => s.Codes.Count == 0).Select(s => s.Id).ToList();
        var cls = string.IsNullOrEmpty(spec.Namespace) ? spec.ClassName : spec.Namespace + "." + spec.ClassName;
        if (links.Count > 0) r.Issues.Add(new("warning", "no-code", file, $"{cls}: link ที่ไม่มี code: {string.Join(", ", links.Take(30))}{More(links.Count)}"));
        if (shapes.Count > 0) r.Issues.Add(new("warning", "no-code", file, $"{cls}: shape ที่ไม่มี code: {string.Join(", ", shapes.Take(30))}{More(shapes.Count)}"));
    }
}
