// Round 7: builds the subassemblies of one project (*.assembly.json) into one DLL per Civil 3D version.
//   1. files of the project (items[].file, in order) -> classes (Roslyn) -> checks (errors stop here)
//   2. pre-build checks (BuildChecks.cs) for the report
//   3. per ticked Civil 3D year: locked DLL (output / Copy-to)? same-named DLL in another folder? -> write
//      obj\<DLL>.csproj -> dotnet build
//   4. success: .atc + icons (parameters from the simulator) -> build-manifest.json + diff with the previous build ->
//      Copy-to (newest ticked year only) -> build history (machine folder)
//   5. report.md for every year that was tried (success or failure)
// The user's .cs files are only read (compiled in place by dotnet build). One build at a time.

using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SA.Build;

// AtcFullPath: the .atc names the DLL by full path (fallback if Civil 3D does not accept the bare file name, see M5)
// Scenarios: the page's saved scenarios, as for the checks (they go into the report)
public record BuildRequest(string? Project, string? DllName, int[]? Years, string[]? Files, bool AllowSameName = false, bool AtcFullPath = false,
                           List<CheckScenario>? Scenarios = null);

public class BuildYearResult
{
    public int Year { get; set; }
    public string Status { get; set; } = "";     // ok | failed | locked | same-name | skipped
    public string? Message { get; set; }
    public string OutDir { get; set; } = "";
    public string? Dll { get; set; }
    public string Tfm { get; set; } = "";
    public List<string> Errors { get; set; } = new();
    public List<ParamChange> Changes { get; set; } = new();
    public List<string> SameName { get; set; } = new();
    public List<BuildIssue> Warnings { get; set; } = new();
    public string? Atc { get; set; }                // <DLL>.atc (Content Browser → Add Catalog)
    public int Icons { get; set; }
    public string? CopiedTo { get; set; }           // Copy-to folder the DLL + .atc + icons went to
    public string? CopyError { get; set; }
    public string? Report { get; set; }             // report.md text (the dialog shows it)
    public string? ReportPath { get; set; }
    public double Ms { get; set; }
}

public class BuildResult
{
    public bool Ok { get; set; }
    public string DllName { get; set; } = "";
    public string? Project { get; set; }
    public List<string> Files { get; set; } = new();
    public List<ClassInfo> Classes { get; set; } = new();
    public List<BuildIssue> Issues { get; set; } = new();
    public List<BuildYearResult> Builds { get; set; } = new();
}

public partial class BuildEngine
{
    readonly SubassemblyCompiler _compiler;
    readonly SubassemblyRunner _runner;
    readonly string _folder;
    readonly Func<List<C3DInstall>> _installs;
    public BuildHistory History { get; }
    public string MachineDir { get; }

    static readonly object Gate = new();
    public static TimeSpan Timeout { get; set; } = TimeSpan.FromMinutes(5);

    public BuildEngine(SubassemblyCompiler compiler, SubassemblyRunner runner, string folder, string? machineDir = null, Func<List<C3DInstall>>? installs = null)
    {
        _compiler = compiler;
        _runner = runner;
        _folder = Path.GetFullPath(folder);
        MachineDir = machineDir ?? BuildPaths.DefaultMachineDir();
        History = new BuildHistory(MachineDir);
        _installs = installs ?? (() => C3DVersions.DetectThisMachine());
    }

    public List<C3DInstall> Installs() => _installs();

    // DLL name = a file name Civil 3D and MSBuild both accept: letters, digits, _ - . (no spaces, no Thai)
    public static bool ValidDllName(string? s) => !string.IsNullOrEmpty(s) && s.Length <= 100 && Regex.IsMatch(s, @"^[A-Za-z0-9_][A-Za-z0-9_.-]*$") && !s.EndsWith('.');

    public static string DefaultDllName(string projectFile)
    {
        var n = Path.GetFileName(projectFile);
        if (n.EndsWith(".assembly.json", StringComparison.OrdinalIgnoreCase)) n = n[..^".assembly.json".Length];
        n = Regex.Replace(n, @"[^A-Za-z0-9_.-]", "_").Trim('.');
        return n.Length == 0 ? "Subassemblies" : n;
    }

    // *.assembly.json at the top of the folder
    public List<string> ProjectNames() => Directory.Exists(_folder)
        ? Directory.GetFiles(_folder, "*.assembly.json", SearchOption.TopDirectoryOnly).Select(Path.GetFileName).OrderBy(n => n, StringComparer.OrdinalIgnoreCase).ToList()!
        : new List<string>();

    public string? ProjectPath(string? project)
    {
        var name = FileUtil.AssemblyFileName(project);
        return name == null ? null : Path.Combine(_folder, name);
    }

    // .cs files of the project in item order (a file used by several items counts once).
    // Version 1 = items at the root; version 2 = assemblies[].items.
    public static List<string> ProjectFiles(string projectJson)
    {
        using var doc = JsonDocument.Parse(projectJson);
        var list = new List<string>();
        void Items(JsonElement owner)
        {
            if (!owner.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array) return;
            foreach (var it in items.EnumerateArray())
                if (it.ValueKind == JsonValueKind.Object && it.TryGetProperty("file", out var f) && f.ValueKind == JsonValueKind.String
                    && !string.IsNullOrWhiteSpace(f.GetString()) && !list.Contains(f.GetString()!, StringComparer.OrdinalIgnoreCase))
                    list.Add(f.GetString()!);
        }
        Items(doc.RootElement);
        if (doc.RootElement.TryGetProperty("assemblies", out var asms) && asms.ValueKind == JsonValueKind.Array)
            foreach (var a in asms.EnumerateArray()) if (a.ValueKind == JsonValueKind.Object) Items(a);
        return list;
    }

    // Steps 1 only: files, classes, checks. Used by Build and by the dialog / sa_build_check (no build).
    public BuildResult Plan(BuildRequest req)
    {
        var r = new BuildResult();
        var proj = ProjectPath(req.Project);
        if (proj == null || !File.Exists(proj)) { r.Issues.Add(new("error", null, $"ไม่พบไฟล์ project {req.Project}")); return r; }
        r.Project = Path.GetFileName(proj);
        r.DllName = string.IsNullOrWhiteSpace(req.DllName) ? DefaultDllName(proj) : req.DllName.Trim();
        if (!ValidDllName(r.DllName)) r.Issues.Add(new("error", null, $"ชื่อ DLL '{r.DllName}' ใช้ไม่ได้ (ใช้ได้เฉพาะ A-Z a-z 0-9 _ - .)"));

        List<string> files;
        try { files = ProjectFiles(FileUtil.ReadShared(proj)); }
        catch (JsonException e) { r.Issues.Add(new("error", r.Project, $"อ่าน project ไม่ได้: {e.Message}")); return r; }
        if (req.Files != null) files = files.Where(f => req.Files.Contains(f, StringComparer.OrdinalIgnoreCase)).ToList();
        if (files.Count == 0) r.Issues.Add(new("error", r.Project, "ไม่มีไฟล์ .cs ให้ build"));

        var empty = new List<string>();
        foreach (var f in files)
        {
            var path = SafeFile(f);
            if (path == null || !File.Exists(path)) { r.Issues.Add(new("error", f, $"ไม่พบไฟล์ {f}")); continue; }
            r.Files.Add(Path.GetFileName(path));
            var cls = ClassReader.Read(FileUtil.ReadShared(path), Path.GetFileName(path));
            if (cls.Count == 0) empty.Add(Path.GetFileName(path));
            r.Classes.AddRange(cls);
        }
        r.Issues.AddRange(ClassReader.Check(r.Classes, empty));
        r.Ok = !r.Issues.Any(i => i.Severity == "error");
        return r;
    }

    public BuildResult Build(BuildRequest req)
    {
        var r = Plan(req);
        if (!r.Ok) return r;
        var years = (req.Years ?? Array.Empty<int>()).Distinct().ToList();
        if (years.Count == 0) { r.Ok = false; r.Issues.Add(new("error", null, "ยังไม่ได้เลือก Civil 3D version")); return r; }

        var installs = Installs();
        var proj = ProjectPath(req.Project)!;
        var files = r.Files.Select(f => Path.Combine(_folder, f)).ToList();
        lock (Gate)
        {
            var check = Check(new CheckRequest(req.Project, r.DllName, years.ToArray(), req.Files, req.Scenarios));
            foreach (var year in years)
            {
                var c3d = installs.FirstOrDefault(i => i.Year == year) ?? new C3DInstall(year, null, C3DVersions.FallbackTfm(year), false, false, "ไม่ได้ติดตั้ง");
                r.Builds.Add(BuildYear(r, c3d, proj, files, req, CopyDirFor(year, years), check));
            }
        }
        r.Ok = r.Builds.All(b => b.Status == "ok");
        return r;
    }

    BuildYearResult BuildYear(BuildResult plan, C3DInstall c3d, string proj, List<string> files, BuildRequest req, string? copyDir, CheckResult check)
    {
        var sw = Stopwatch.StartNew();
        var dllName = plan.DllName;
        var outDir = BuildPaths.OutputDir(proj, dllName, c3d.Year);
        var dll = BuildPaths.Dll(outDir, dllName);
        var y = new BuildYearResult { Year = c3d.Year, OutDir = outDir, Tfm = c3d.Tfm };
        if (!c3d.CanBuild) { y.Status = "skipped"; y.Message = c3d.Reason; return y; }

        string Locked(string what) => $"ปิด Civil 3D ก่อน: {dllName}.dll {what}ถูกโปรแกรมอื่นใช้อยู่";
        if (IsLocked(dll)) { y.Status = "locked"; y.Message = Locked(""); return y; }
        if (copyDir != null && IsLocked(Path.Combine(copyDir, dllName + ".dll"))) { y.Status = "locked"; y.Message = Locked($"ใน {copyDir} "); return y; }

        y.SameName = History.SameNameElsewhere(dllName, c3d.Year, TargetDirs(outDir));
        if (y.SameName.Count > 0 && !req.AllowSameName)
        {
            y.Status = "same-name";
            y.Message = $"มี {dllName}.dll อยู่แล้วในโฟลเดอร์อื่น";
            return y;
        }

        // parameters / icons / .atc text first: the report needs them even when the build fails
        var cat = MakeCatalog(dllName, plan.Classes, files, req.AtcFullPath ? Path.Combine(copyDir ?? outDir, dllName + ".dll") : dllName + ".dll");
        y.Warnings.AddRange(cat.Warnings);

        Directory.CreateDirectory(BuildPaths.ObjDir(outDir));
        var csproj = BuildPaths.Csproj(outDir, dllName);
        File.WriteAllText(csproj, CsprojWriter.Generate(dllName, c3d.Tfm, c3d.Path!, files, outDir));

        var (code, output) = RunDotnet(csproj);
        File.WriteAllText(BuildPaths.Log(outDir), output);
        if (code != 0)
        {
            if (Regex.IsMatch(output, "being used by another process|locked by|MSB3027|MSB3021"))
            {
                y.Status = "locked";
                y.Message = Locked("");
            }
            else
            {
                y.Status = "failed";
                y.Errors = ErrorSummary(output);
                y.Message = code == -1 ? "build ใช้เวลานานเกินไป (หยุดแล้ว)" : $"build ไม่ผ่าน: {y.Errors.Count} error";
            }
            y.Ms = sw.Elapsed.TotalMilliseconds;
            WriteReport(y, plan, c3d, cat, check);
            return y;
        }

        // .atc + icons: the DLL is referenced by file name (next to the .atc) or by the full path where it is loaded from
        WriteCatalog(outDir, dllName, cat);
        y.Atc = Path.Combine(outDir, dllName + ".atc");
        y.Icons = cat.Icons.Count;

        var manifest = new BuildManifest
        {
            DllName = dllName, Year = c3d.Year, Tfm = c3d.Tfm, C3DInstall = c3d.Path!, BuiltAt = DateTime.Now,
            Files = plan.Files.ToList(),
            Classes = cat.Tools.Select(tl => new ManifestClass
            {
                FullName = tl.FullName, File = cat.FileOf[tl.FullName],
                Params = tl.Params.Select(p => new ManifestParam { Name = p.Name, Kind = p.Kind, Default = p.Default }).ToList()
            }).ToList(),
        };
        var old = BuildManifest.Load(BuildPaths.Manifest(outDir));
        if (old != null) manifest.CopiedTo = old.CopiedTo;
        y.Changes = ManifestDiff.Diff(old, manifest);
        History.Record(dll, c3d.Year);

        if (copyDir != null)
        {
            try
            {
                CopyOut(outDir, copyDir, dllName);
                y.CopiedTo = copyDir;
                if (!manifest.CopiedTo.Contains(copyDir, StringComparer.OrdinalIgnoreCase)) manifest.CopiedTo.Add(copyDir);
                History.Record(Path.Combine(copyDir, dllName + ".dll"), c3d.Year);
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException)
            {
                y.CopyError = $"คัดลอกไป {copyDir} ไม่ได้: {e.Message}";
            }
        }
        manifest.Save(BuildPaths.Manifest(outDir));

        y.Status = "ok";
        y.Dll = dll;
        y.Message = "build สำเร็จ";
        y.Ms = sw.Elapsed.TotalMilliseconds;
        WriteReport(y, plan, c3d, cat, check);
        return y;
    }

    // Copy-to: the DLL, both .atc files and icons\<DLL>\ (that subfolder is replaced; nothing else in the folder is touched)
    static void CopyOut(string outDir, string copyDir, string dllName)
    {
        foreach (var f in new[] { dllName + ".dll", dllName + ".atc", AtcWriter.CategoryFile(dllName) })
            File.Copy(Path.Combine(outDir, f), Path.Combine(copyDir, f), true);
        var src = Path.Combine(outDir, "icons", dllName);
        var dst = Path.Combine(copyDir, "icons", dllName);
        if (Directory.Exists(dst)) foreach (var f in Directory.GetFiles(dst, "*.png")) File.Delete(f);
        Directory.CreateDirectory(dst);
        foreach (var f in Directory.GetFiles(src, "*.png")) File.Copy(f, Path.Combine(dst, Path.GetFileName(f)), true);
    }

    void WriteReport(BuildYearResult y, BuildResult plan, C3DInstall c3d, CatalogOutput cat, CheckResult check)
    {
        y.Report = ReportWriter.Build(new ReportData(plan.DllName, plan.Project, y, c3d, cat, check, plan.Classes, DateTime.Now));
        y.ReportPath = BuildPaths.Report(y.OutDir);
        Directory.CreateDirectory(y.OutDir);
        File.WriteAllText(y.ReportPath, y.Report);
    }

    public record CatalogOutput(string Catalog, string Category, Dictionary<string, byte[]> Icons, List<AtcTool> Tools,
                                Dictionary<string, string> FileOf, List<BuildIssue> Warnings);

    // .atc text + icons for the classes of these files. Parameters as GetInputParameters gives them (order included), read by
    // running each class in the simulator with default values (Side = Right, layout mode: also the run the icon is drawn from).
    // Web files add description, unit and options from the sa-spec. A file the simulator cannot compile (API it lacks)
    // still builds: its classes get no parameter list, a plain icon and a warning.
    public CatalogOutput MakeCatalog(string dllName, IReadOnlyList<ClassInfo> classes, IEnumerable<string> files, string assemblyRef)
    {
        var tools = new List<AtcTool>();
        var icons = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
        var fileOf = new Dictionary<string, string>();
        var warnings = new List<BuildIssue>();
        var dupNames = classes.GroupBy(c => c.Name, StringComparer.OrdinalIgnoreCase).Where(g => g.Count() > 1).Select(g => g.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var path in files)
        {
            var name = Path.GetFileName(path);
            var src = FileUtil.ReadShared(path);
            SA.Drawing.DrawingSpec? spec = null;
            var block = SA.Drawing.CodeGenerator.FindBlock(src);
            if (block?.SpecJson != null)
                try { spec = SA.Drawing.DrawingSpec.Parse(block.SpecJson); } catch (Exception e) when (e is JsonException or FormatException) { }
            var compiled = _compiler.Compile(src, name);
            foreach (var c in classes.Where(c => c.File == name))
            {
                var icon = "icons\\" + dllName + "\\" + (dupNames.Contains(c.Name) ? c.FullName.Replace('.', '_') : c.Name) + ".png";
                var type = compiled.Success ? compiled.Classes.FirstOrDefault(t => t.FullName == c.FullName) : null;
                var prms = new List<AtcParam>();
                byte[]? png = null;
                if (type == null)
                    warnings.Add(new("warning", name, $"อ่าน parameter ของ {c.FullName} จากตัวจำลองไม่ได้ (ตัวจำลองคอมไพล์ไฟล์นี้ไม่ผ่าน) — .atc ไม่มีรายการ parameter"));
                else
                {
                    var run = _runner.Run(type, null, new WorldInput { LayoutMode = true });
                    foreach (var p in run.Params)
                    {
                        var sp = spec?.Params.FirstOrDefault(x => x.Name == p.Name);
                        bool isSide = spec != null ? spec.Side?.Param == p.Name : p.Name == "Side";
                        var options = sp?.Options is { Count: > 0 } ? sp.Options
                            : p.Kind == "long" && isSide ? new List<SA.Drawing.SpecOption> { new() { Value = 0, Label = "Right" }, new() { Value = 1, Label = "Left" } } : null;
                        prms.Add(new AtcParam(p.Name, p.Kind, BuildManifest.FormatDefault(p.Default), sp?.DisplayName ?? p.DisplayName,
                                              !string.IsNullOrWhiteSpace(sp?.Description) ? sp!.Description : p.Description, sp?.Unit, options, sp != null)
                                 { Min = sp?.Min, Max = sp?.Max, Positive = sp?.Positive ?? false });
                    }
                    if (run.Exception == null) png = IconRenderer.Render(run);
                }
                if (png == null) warnings.Add(new("warning", name, $"วาดรูปของ {c.FullName} ไม่ได้ — ใช้รูปทั่วไปแทน"));
                icons[icon] = png ?? IconRenderer.Generic();
                tools.Add(new AtcTool(c.FullName, c.Name, icon, prms));
                fileOf[c.FullName] = name;
            }
        }
        var (catalog, category) = AtcWriter.Write(dllName, assemblyRef, tools);
        foreach (var e in AtcWriter.Validate(catalog, category, dllName, tools.Select(t => t.FullName)))
            warnings.Add(new("warning", null, e));
        return new CatalogOutput(catalog, category, icons, tools, fileOf, warnings);
    }

    // <DLL>.atc, <DLL>_tools.atc, icons\<DLL>\ (old icons removed: a renamed class leaves no stale image). The DLL
    // subfolder keeps icons of different DLLs apart in a shared Copy-to folder.
    public static void WriteCatalog(string outDir, string dllName, CatalogOutput cat)
    {
        File.WriteAllText(Path.Combine(outDir, dllName + ".atc"), cat.Catalog);
        File.WriteAllText(Path.Combine(outDir, AtcWriter.CategoryFile(dllName)), cat.Category);
        var iconDir = Path.Combine(outDir, "icons", dllName);
        if (Directory.Exists(iconDir)) foreach (var f in Directory.GetFiles(iconDir, "*.png")) File.Delete(f);
        Directory.CreateDirectory(iconDir);
        foreach (var (rel, png) in cat.Icons) File.WriteAllBytes(Path.Combine(outDir, rel), png);
    }

    // Folders this build writes the DLL to: the output folder + the Copy-to folder when it is on (M4 copies there)
    public List<string> TargetDirs(string outDir)
    {
        var list = new List<string> { outDir };
        var s = MachineSettings.Load(MachineDir);
        if (s.CopyToOn && MachineSettings.CopyToError(s.CopyTo) == null) list.Add(s.CopyTo!);
        return list;
    }

    // Copy-to folder for this year, or null. With several years ticked only the newest is copied: one folder cannot hold
    // two DLLs of the same name, and moving between Copy-to subfolders would itself make same-named DLLs in two paths.
    public string? CopyDirFor(int year, IEnumerable<int>? years)
    {
        var s = MachineSettings.Load(MachineDir);
        if (!s.CopyToOn || MachineSettings.CopyToError(s.CopyTo) != null) return null;
        var buildable = Installs().Where(i => i.CanBuild).Select(i => i.Year).ToHashSet();
        var ticked = (years ?? Array.Empty<int>()).Where(buildable.Contains).ToList();
        return ticked.Count > 0 && ticked.Max() == year ? s.CopyTo : null;
    }

    // A loaded DLL (Civil 3D open) cannot be opened for writing
    public static bool IsLocked(string file)
    {
        if (!File.Exists(file)) return false;
        try { using var fs = new FileStream(file, FileMode.Open, FileAccess.ReadWrite, FileShare.None); return false; }
        catch (IOException) { return true; }
        catch (UnauthorizedAccessException) { return true; }
    }

    // Same summary as tests-civil3d/build/build.js: error lines once each, without the trailing [project] part
    public static List<string> ErrorSummary(string output)
    {
        return output.Split('\n')
            .Select(l => l.TrimEnd('\r'))
            .Where(l => Regex.IsMatch(l, @"\berror\b"))
            .Select(l => Regex.Replace(l, @"\s*\[[^\]]*\.csproj\]\s*$", "").Trim())
            .Select(l => Regex.Replace(l, @"^[A-Za-z]:\\[^(:]*\\([^\\(:]+\.cs)\(", "$1("))   // full path -> file name
            .Distinct()
            .ToList();
    }

    // -1 = timed out
    static (int Code, string Output) RunDotnet(string csproj)
    {
        var psi = new ProcessStartInfo("dotnet") { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
        foreach (var a in new[] { "build", csproj, "-nologo", "-v", "q", "-consoleloggerparameters:NoSummary", "-nodeReuse:false",
                                  "-p:ImportDirectoryBuildProps=false", "-p:ImportDirectoryBuildTargets=false" })
            psi.ArgumentList.Add(a);
        psi.Environment["DOTNET_CLI_UI_LANGUAGE"] = "en";     // English messages: the error parser looks for "error"
        psi.Environment["MSBUILDDISABLENODEREUSE"] = "1";     // no MSBuild node left running (it would hold files)
        psi.Environment["DOTNET_NOLOGO"] = "1";
        psi.Environment["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1";
        using var p = Process.Start(psi)!;
        var sb = new StringBuilder();
        p.OutputDataReceived += (_, e) => { if (e.Data != null) lock (sb) sb.AppendLine(e.Data); };
        p.ErrorDataReceived += (_, e) => { if (e.Data != null) lock (sb) sb.AppendLine(e.Data); };
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();
        if (!p.WaitForExit((int)Timeout.TotalMilliseconds))
        {
            try { p.Kill(true); } catch (InvalidOperationException) { }
            return (-1, sb + "\r\n(timed out)");
        }
        p.WaitForExit();
        lock (sb) return (p.ExitCode, sb.ToString());
    }

    // A file name at the top of the project folder (no path that leads outside it)
    string? SafeFile(string name)
    {
        name = name.Trim();
        if (name != Path.GetFileName(name) || name.StartsWith('.') || name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0) return null;
        if (!name.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)) return null;
        return Path.Combine(_folder, name);
    }
}
