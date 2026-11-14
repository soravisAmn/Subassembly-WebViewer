// Round 7 M4: Source package = a zip for someone with Civil 3D (the user may have none): the .cs files, a .csproj (same
// settings as Build), build.bat (finds the Civil 3D install, picks the TFM from its year, runs dotnet build, prints a short
// summary), the .atc + icons, report.md and README.txt (Thai). Never any Autodesk DLL.
//   <project folder>\build\<DLL>\<DLL>-source.zip   (staging folder build\<DLL>\source\ is rebuilt every time)

using System.IO.Compression;
using System.Security;
using System.Text;

namespace SA.Build;

public record SourceResult(bool Ok, string? Zip, List<BuildIssue> Issues, List<BuildIssue> Warnings, string? Report);

public partial class BuildEngine
{
    public SourceResult SourcePackage(BuildRequest req)
    {
        var plan = Plan(req);
        if (!plan.Ok) return new SourceResult(false, null, plan.Issues, new(), null);
        var proj = ProjectPath(req.Project)!;
        var files = plan.Files.Select(f => Path.Combine(_folder, f)).ToList();
        var years = (req.Years ?? Array.Empty<int>()).ToList();
        var tfm = C3DVersions.FallbackTfm(years.Count > 0 ? years.Max() : C3DVersions.Supported[^1]);

        lock (Gate)
        {
            var check = Check(new CheckRequest(req.Project, plan.DllName, req.Years, req.Files, req.Scenarios));
            var cat = MakeCatalog(plan.DllName, plan.Classes, files, plan.DllName + ".dll");
            var root = Path.Combine(Path.GetDirectoryName(BuildPaths.OutputDir(proj, plan.DllName, 0))!);
            var stage = Path.Combine(root, "source");
            if (Directory.Exists(stage)) Directory.Delete(stage, true);
            Directory.CreateDirectory(stage);

            foreach (var f in files) File.Copy(f, Path.Combine(stage, Path.GetFileName(f)));
            File.WriteAllText(Path.Combine(stage, plan.DllName + ".csproj"), CsprojWriter.GeneratePortable(plan.DllName, tfm, plan.Files));
            File.WriteAllText(Path.Combine(stage, "build.bat"), BuildBat(plan.DllName), new UTF8Encoding(false));
            WriteCatalog(stage, plan.DllName, cat);
            var report = ReportWriter.Build(new ReportData(plan.DllName, plan.Project, null, null, cat, check, plan.Classes, DateTime.Now,
                $"Source package: {plan.DllName}.dll (ยังไม่ได้ build)"));
            File.WriteAllText(Path.Combine(stage, "report.md"), report);
            File.WriteAllText(Path.Combine(stage, "README.txt"), Readme(plan.DllName, plan.Classes), new UTF8Encoding(true));

            var zip = Path.Combine(root, plan.DllName + "-source.zip");
            if (File.Exists(zip)) File.Delete(zip);
            ZipFile.CreateFromDirectory(stage, zip, CompressionLevel.Optimal, false);
            return new SourceResult(true, zip, check.Issues.Select(i => new BuildIssue(i.Severity, i.File, i.Message)).ToList(), cat.Warnings, report);
        }
    }

    // Windows batch, UTF-8 (chcp 65001). C3DInstall may be set before running; otherwise the newest
    // "%ProgramFiles%\Autodesk\AutoCAD 20xx" that has C3D\AeccDbMgd.dll. 2027 and later -> net10.0-windows, else net8.0-windows.
    static string BuildBat(string dll)
    {
        var s = $$"""
@echo off
rem Builds {{dll}}.dll for Civil 3D from the .cs files in this folder (SA Drawing Studio source package).
rem Needs the .NET SDK (8 for Civil 3D 2025 / 2026, 10 for 2027). Civil 3D is found by itself;
rem to choose one: set C3DInstall=C:\Program Files\Autodesk\AutoCAD 2026\   then run build.bat
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
if not defined C3DInstall (
  for /d %%D in ("%ProgramFiles%\Autodesk\AutoCAD 20*") do if exist "%%~D\C3D\AeccDbMgd.dll" set "C3DInstall=%%~D\"
)
if not defined C3DInstall (
  echo ไม่พบ Civil 3D ^(AutoCAD 20xx\C3D\AeccDbMgd.dll^) - ตั้ง C3DInstall เองแล้วรันใหม่
  exit /b 1
)
if not "%C3DInstall:~-1%"=="\" set "C3DInstall=%C3DInstall%\"
rem year = last 4 characters of the install folder name ("AutoCAD 2027"): 2027 and later run on .NET 10
for %%I in ("%C3DInstall:~0,-1%") do set "C3DName=%%~nxI"
set "C3DYear=%C3DName:~-4%"
set "TFM=net8.0-windows"
if %C3DYear% GEQ 2027 set "TFM=net10.0-windows"
echo Civil 3D: %C3DInstall%  (%TFM%)
rem C3DInstall reaches the .csproj as an environment variable (a path ending in \ breaks a -p: argument)
dotnet build "{{dll}}.csproj" -nologo -v q -consoleloggerparameters:NoSummary -nodeReuse:false -p:TargetFramework=%TFM% > build.log 2>&1
if not errorlevel 1 (
  echo OK: %~dp0{{dll}}.dll
  echo ต่อไป: CONTENTBROWSER - Add Catalog - %~dp0{{dll}}.atc
  exit /b 0
)
findstr /c:"being used by another process" /c:"MSB3027" /c:"MSB3021" build.log >nul && (
  echo ปิด Civil 3D ก่อน
  exit /b 1
)
echo FAILED:
findstr /r /c:": error " build.log
echo (log ทั้งหมด: build.log)
exit /b 1
""";
        return s.Replace("\r\n", "\n").Replace("\n", "\r\n");
    }

    static string Readme(string dll, IReadOnlyList<ClassInfo> classes) => string.Join("\r\n", (string[])
    [
        $"{dll} — subassembly สำหรับ Civil 3D (source package จาก SA Drawing Studio)",
        "",
        "ในนี้มีไฟล์ .cs, โปรเจกต์ .csproj, build.bat, Tool Catalog (.atc + icons) และ report.md — ไม่มี DLL ของ Autodesk",
        "",
        "ขั้นตอน (เครื่องที่มี Civil 3D 2025-2027):",
        "1. ติดตั้ง .NET SDK: Civil 3D 2025 / 2026 ใช้ .NET 8, Civil 3D 2027 ใช้ .NET 10 (https://dotnet.microsoft.com)",
        "2. แตก zip ไว้ในโฟลเดอร์ที่จะใช้จริง แล้วเพิ่มโฟลเดอร์นั้นเป็น Trusted Location ของ Civil 3D (Options → Files)",
        "3. ปิด Civil 3D แล้วดับเบิลคลิก build.bat (ถ้ามี Civil 3D หลายรุ่น: set C3DInstall=C:\\Program Files\\Autodesk\\AutoCAD 2026\\ ก่อนรัน)",
        $"4. ได้ {dll}.dll ข้าง {dll}.atc — เปิด Civil 3D พิมพ์ CONTENTBROWSER → Add Catalog → เลือก {dll}.atc",
        "5. ลากเครื่องมือไปใส่ Tool Palette แล้วใส่ลง assembly",
        "",
        "class ใน DLL:",
        .. classes.Select(c => "  " + c.FullName),
        "",
        "ถ้า build ไม่ผ่าน ดู build.log · ถ้าขึ้น \"ปิด Civil 3D ก่อน\" ให้ปิด Civil 3D แล้วรันใหม่",
        ""
    ]);
}
