// Round 7: every path of a build in one place. Round 8 moves projects into their own folders: only this file changes.
//
//   <project folder>\build\<DLL>\<year>\
//     <DLL>.dll, report.md, build.log, build-manifest.json (+ .atc / icons\ from M3)
//     obj\<DLL>.csproj   generated project (its own intermediate files go to obj\obj\)

namespace SA.Build;

public static class BuildPaths
{
    public static string OutputDir(string projectFile, string dllName, int year) =>
        Path.Combine(Path.GetDirectoryName(Path.GetFullPath(projectFile))!, "build", dllName, year.ToString());

    public static string Dll(string outDir, string dllName) => Path.Combine(outDir, dllName + ".dll");
    public static string ObjDir(string outDir) => Path.Combine(outDir, "obj");
    public static string Csproj(string outDir, string dllName) => Path.Combine(ObjDir(outDir), dllName + ".csproj");
    public static string Manifest(string outDir) => Path.Combine(outDir, "build-manifest.json");
    public static string Log(string outDir) => Path.Combine(outDir, "build.log");
    public static string Report(string outDir) => Path.Combine(outDir, "report.md");

    // Machine settings (not in any project, never committed): build history, settings.json, scratch\.
    // SA_STUDIO_MACHINE_DIR (environment) = another folder, for a test server that must not touch the real settings.
    public static string DefaultMachineDir() =>
        Environment.GetEnvironmentVariable("SA_STUDIO_MACHINE_DIR") is { Length: > 0 } d ? Path.GetFullPath(d)
        : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SA-Studio");
}
