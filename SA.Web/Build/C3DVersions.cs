// Round 7 build engine: which Civil 3D versions can be built on this machine.
// An install = an "AutoCAD 20xx" folder that holds C3D\AeccDbMgd.dll. Its target framework comes from
// acdbmgd.runtimeconfig.json in that folder (this is how .NET 10 was found for 2027); the year map is only a fallback.

using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SA.Build;

public record C3DInstall(int Year, string? Path, string Tfm, bool Installed, bool SdkOk, string? Reason)
{
    public bool CanBuild => Installed && SdkOk;
}

public static class C3DVersions
{
    // Shown in the dialog even when not installed (greyed). Older versions run on .NET Framework: not supported.
    public static readonly int[] Supported = { 2025, 2026, 2027 };

    public static string FallbackTfm(int year) => year >= 2027 ? "net10.0-windows" : "net8.0-windows";

    public static IEnumerable<string> DefaultRoots()
    {
        var pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        if (!string.IsNullOrEmpty(pf)) yield return Path.Combine(pf, "Autodesk");
    }

    // roots: folders that hold "AutoCAD 20xx" folders. extraInstalls: install folders given directly
    // (the C3DInstall override, e.g. Civil 3D on another drive); the year is read from the folder name.
    public static List<C3DInstall> Detect(IEnumerable<string> roots, IReadOnlyCollection<int> sdkMajors, IEnumerable<string>? extraInstalls = null)
    {
        var found = new Dictionary<int, string>();
        void Consider(string dir)
        {
            var m = Regex.Match(Path.GetFileName(dir.TrimEnd('\\', '/')), @"(20\d\d)");
            if (!m.Success || !File.Exists(Path.Combine(dir, "C3D", "AeccDbMgd.dll"))) return;
            found.TryAdd(int.Parse(m.Groups[1].Value), Path.GetFullPath(dir).TrimEnd('\\') + "\\");
        }
        foreach (var dir in extraInstalls ?? Enumerable.Empty<string>())
            if (Directory.Exists(dir)) Consider(dir);
        foreach (var root in roots.Where(Directory.Exists))
            foreach (var dir in Directory.GetDirectories(root, "AutoCAD 20*"))
                if (Regex.IsMatch(Path.GetFileName(dir), @"^AutoCAD 20\d\d$")) Consider(dir);

        var list = new List<C3DInstall>();
        foreach (var year in Supported.Union(found.Keys).OrderBy(y => y))
        {
            if (!found.TryGetValue(year, out var path))
            {
                list.Add(new(year, null, FallbackTfm(year), false, false, "ไม่ได้ติดตั้ง"));
                continue;
            }
            if (year < Supported[0])
            {
                list.Add(new(year, path, "net48", true, false, $"Civil 3D {year} ใช้ .NET Framework — ยังไม่รองรับ"));
                continue;
            }
            var tfm = ReadTfm(path) ?? FallbackTfm(year);
            int major = TfmMajor(tfm);
            bool ok = sdkMajors.Any(m => m >= major);
            list.Add(new(year, path, tfm, true, ok, ok ? null : $"ไม่มี .NET SDK {major} ขึ้นไป (ดู dotnet --list-sdks)"));
        }
        return list;
    }

    // "net10.0" in acdbmgd.runtimeconfig.json -> "net10.0-windows"; null when the file is missing or unreadable
    public static string? ReadTfm(string install)
    {
        try
        {
            var file = Path.Combine(install, "acdbmgd.runtimeconfig.json");
            if (!File.Exists(file)) return null;
            using var doc = JsonDocument.Parse(File.ReadAllText(file));
            var tfm = doc.RootElement.GetProperty("runtimeOptions").GetProperty("tfm").GetString();
            if (string.IsNullOrEmpty(tfm) || !Regex.IsMatch(tfm, @"^net\d+\.\d+$")) return null;
            return tfm + "-windows";
        }
        catch (Exception e) when (e is IOException or JsonException or KeyNotFoundException or InvalidOperationException)
        {
            return null;
        }
    }

    public static int TfmMajor(string tfm)
    {
        var m = Regex.Match(tfm, @"^net(\d+)\.");
        return m.Success ? int.Parse(m.Groups[1].Value) : 0;
    }

    // Major versions of the installed .NET SDKs ("10.0.401 [C:\...]" -> 10). Cached: SDKs do not change while the viewer runs.
    static List<int>? _sdks;
    public static IReadOnlyCollection<int> SdkMajors()
    {
        if (_sdks != null) return _sdks;
        var list = new List<int>();
        try
        {
            var psi = new ProcessStartInfo("dotnet", "--list-sdks") { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
            using var p = Process.Start(psi)!;
            var text = p.StandardOutput.ReadToEnd();
            p.WaitForExit(15000);
            foreach (Match m in Regex.Matches(text, @"^(\d+)\.\d+\.\d+", RegexOptions.Multiline)) list.Add(int.Parse(m.Groups[1].Value));
        }
        catch (Exception e) when (e is System.ComponentModel.Win32Exception or InvalidOperationException) { }
        return _sdks = list.Distinct().OrderBy(x => x).ToList();
    }

    public static List<C3DInstall> DetectThisMachine(IEnumerable<string>? extraInstalls = null) => Detect(DefaultRoots(), SdkMajors(), extraInstalls);
}
