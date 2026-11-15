// Round 7 M2: settings of this machine (not of a project, never committed): %LOCALAPPDATA%\SA-Studio\settings.json
//   copyTo   = folder the Build copies the DLL + .atc + icons to after a successful build (M4), e.g. a Trusted Location
//   copyToOn = the Copy-to option is ticked (default off)
// Round 8 (app settings dialog "ตั้งค่า…"): c3dInstall override, recent projects (max 10, newest first),
//   reopenLast (default on), startFolder of the web file dialog (null = SubassemblyFolder in appsettings.json)

using System.Text.Json;

namespace SA.Build;

public class MachineSettings
{
    public string? CopyTo { get; set; }
    public bool CopyToOn { get; set; }
    public string? C3dInstall { get; set; }
    public List<string> Recent { get; set; } = new();
    public bool ReopenLast { get; set; } = true;
    public string? StartFolder { get; set; }

    public const int MaxRecent = 10;

    // Newest first, once each, at most MaxRecent
    public void AddRecent(string projectFile)
    {
        var full = Path.GetFullPath(projectFile);
        Recent.RemoveAll(r => string.Equals(r, full, StringComparison.OrdinalIgnoreCase));
        Recent.Insert(0, full);
        if (Recent.Count > MaxRecent) Recent.RemoveRange(MaxRecent, Recent.Count - MaxRecent);
    }

    static readonly object Gate = new();
    // Load, change, save under one lock (two tabs opening projects at once)
    public static MachineSettings Update(string machineDir, Action<MachineSettings> change)
    {
        lock (Gate)
        {
            var s = Load(machineDir);
            change(s);
            s.Save(machineDir);
            return s;
        }
    }

    static readonly JsonSerializerOptions Json = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    static string FileOf(string machineDir) => Path.Combine(machineDir, "settings.json");

    public static MachineSettings Load(string machineDir)
    {
        try
        {
            var f = FileOf(machineDir);
            return File.Exists(f) ? JsonSerializer.Deserialize<MachineSettings>(File.ReadAllText(f), Json) ?? new() : new();
        }
        catch (Exception e) when (e is IOException or JsonException) { return new(); }
    }

    public void Save(string machineDir)
    {
        Directory.CreateDirectory(machineDir);
        File.WriteAllText(FileOf(machineDir), JsonSerializer.Serialize(this, Json).ReplaceLineEndings("\r\n"));
    }

    // A Copy-to folder must be an absolute path to a folder that exists (it is not created for the user)
    public static string? CopyToError(string? folder)
    {
        if (string.IsNullOrWhiteSpace(folder)) return "ยังไม่ได้ใส่โฟลเดอร์";
        if (!Path.IsPathFullyQualified(folder)) return "ต้องเป็น path เต็ม เช่น D:\\C3D_Custom\\SA";
        if (!Directory.Exists(folder)) return $"ไม่พบโฟลเดอร์ {folder}";
        return null;
    }
}
