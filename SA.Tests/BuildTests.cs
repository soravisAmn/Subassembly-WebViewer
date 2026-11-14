// Round 7 M1: build engine (SA.Web/Build). Everything runs in a temp folder with copies of the locked round 6 fixtures:
// never the user's root files. The real dotnet build runs only when Civil 3D is installed on this machine.

using System.Xml.Linq;
using SA.Build;

static class BuildTests
{
    static readonly string[] Fixtures = { "pavement-assembly.cs", "base_rock-pitching-web.cs", "body_rock-pitching-web.cs" };

    public static void Run(Action<string, Action> test)
    {
        string root = FindRoot();
        string fixtures = Path.Combine(root, "SA.Tests", "fixtures", "round6");
        Console.WriteLine("\nBuild engine (round 7)");
        try { Directory.Delete(TempRoot, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }   // leftovers of the last run

        test("csproj: TFM, ชื่อ DLL, ไฟล์ .cs ตามลำดับ, reference Autodesk แบบ Private=false, C3DInstall override ได้", () =>
        {
            var files = new[] { @"D:\p\a.cs", @"D:\p\b & c.cs" };
            var text = CsprojWriter.Generate("SR03", "net10.0-windows", @"C:\Program Files\Autodesk\AutoCAD 2027", files, @"D:\p\build\SR03\2027");
            var x = XDocument.Parse(text).Root!;
            string P(string n) => x.Descendants(n).Single().Value;
            Eq("net10.0-windows", P("TargetFramework"), "TFM");
            Eq("SR03", P("AssemblyName"), "AssemblyName");
            Eq("x64", P("PlatformTarget"), "PlatformTarget");
            Eq("true", P("EnableDynamicLoading"), "EnableDynamicLoading");
            Eq("false", P("EnableDefaultCompileItems"), "EnableDefaultCompileItems");
            Eq(@"D:\p\build\SR03\2027\", P("OutputPath"), "OutputPath");
            var c3d = x.Descendants("C3DInstall").Single();
            Eq(@"C:\Program Files\Autodesk\AutoCAD 2027\", c3d.Value, "C3DInstall");
            True(c3d.Attribute("Condition")!.Value.Contains("'$(C3DInstall)' == ''"), "C3DInstall ต้อง override ได้");
            Eq(string.Join("|", files), string.Join("|", x.Descendants("Compile").Select(c => c.Attribute("Include")!.Value)), "ไฟล์ .cs");
            var refs = x.Descendants("Reference").ToList();
            Eq("acdbmgd,accoremgd,acmgd,AecBaseMgd,AeccDbMgd", string.Join(",", refs.Select(r => r.Attribute("Include")!.Value)), "reference");
            True(refs.All(r => r.Element("Private")!.Value == "false"), "reference ต้อง Private=false (ไม่ copy DLL ของ Autodesk)");
            Eq(@"$(C3DInstall)C3D\AeccDbMgd.dll", refs[4].Element("HintPath")!.Value, "HintPath");
            True(text.Contains("\r\n") && !text.Replace("\r\n", "").Contains('\n'), "CRLF");
        });

        test("หา Civil 3D: โฟลเดอร์ติดตั้งปลอม, TFM จาก runtimeconfig, fallback ตามปี, SDK ไม่พอ, ไม่ได้ติดตั้ง", () =>
        {
            var tmp = Temp();
            void Install(string name, string? tfm)
            {
                Directory.CreateDirectory(Path.Combine(tmp, name, "C3D"));
                File.WriteAllText(Path.Combine(tmp, name, "C3D", "AeccDbMgd.dll"), "");
                if (tfm != null) File.WriteAllText(Path.Combine(tmp, name, "acdbmgd.runtimeconfig.json"), $"{{\"runtimeOptions\":{{\"tfm\":\"{tfm}\"}}}}");
            }
            Install("AutoCAD 2027", "net10.0");
            Install("AutoCAD 2026", null);
            Directory.CreateDirectory(Path.Combine(tmp, "AutoCAD 2022"));   // AutoCAD without Civil 3D
            var v = C3DVersions.Detect(new[] { tmp }, new[] { 10 });
            Eq("2025,2026,2027", string.Join(",", v.Select(i => i.Year)), "ปีที่แสดง");
            var y25 = v.Single(i => i.Year == 2025); var y26 = v.Single(i => i.Year == 2026); var y27 = v.Single(i => i.Year == 2027);
            True(!y25.Installed && !y25.CanBuild && y25.Reason == "ไม่ได้ติดตั้ง", "2025 ไม่ได้ติดตั้ง");
            Eq("net8.0-windows", y26.Tfm, "2026 fallback");
            True(y26.CanBuild, "2026 build ได้ด้วย SDK 10");
            Eq("net10.0-windows", y27.Tfm, "2027 จาก runtimeconfig");
            Eq(Path.Combine(tmp, "AutoCAD 2027") + "\\", y27.Path, "path");
            var old = C3DVersions.Detect(new[] { tmp }, new[] { 8 });
            var o27 = old.Single(i => i.Year == 2027);
            True(o27.Installed && !o27.CanBuild && o27.Reason!.Contains("SDK 10"), "SDK 8 build 2027 ไม่ได้");
            True(old.Single(i => i.Year == 2026).CanBuild, "SDK 8 build 2026 ได้");
            // C3DInstall override: an install outside the roots
            var other = Temp();
            Install(Path.Combine(other, "C3D 2025"), "net8.0");
            var withExtra = C3DVersions.Detect(new[] { tmp }, new[] { 10 }, new[] { Path.Combine(tmp, other, "C3D 2025") });
            True(withExtra.Single(i => i.Year == 2025).CanBuild, "override path");
        });

        test("ชื่อ DLL: ค่าเริ่มต้นจากชื่อ project, ตัวอักษรที่ใช้ได้", () =>
        {
            Eq("SR03", BuildEngine.DefaultDllName(@"D:\x\SR03.assembly.json"), "default");
            Eq("rock-pitching-compare", BuildEngine.DefaultDllName("rock-pitching-compare.assembly.json"), "default มี -");
            True(BuildEngine.ValidDllName("SR03") && BuildEngine.ValidDllName("Sa.Round_7-b"), "ชื่อที่ใช้ได้");
            True(!BuildEngine.ValidDllName("SR 03") && !BuildEngine.ValidDllName("ถนน") && !BuildEngine.ValidDllName("a\\b") && !BuildEngine.ValidDllName("") && !BuildEngine.ValidDllName("x."), "ชื่อที่ใช้ไม่ได้");
        });

        test("อ่าน class ด้วย Roslyn: fixture 3 ไฟล์ = TestSubassembly.* มีเมธอดครบ 4 ตัว", () =>
        {
            var names = new List<string>();
            foreach (var f in Fixtures)
            {
                var cls = ClassReader.Read(File.ReadAllText(Path.Combine(fixtures, f)), f);
                Eq(1, cls.Count, $"{f}: จำนวน class");
                Eq(0, cls[0].MissingMethods.Length, $"{f}: เมธอดที่ขาด");
                True(cls[0].IsPublic, $"{f}: public");
                Eq("TestSubassembly", cls[0].Namespace, $"{f}: namespace");
                names.Add(cls[0].FullName);
            }
            Eq(0, ClassReader.Check(ClassReader.Read(File.ReadAllText(Path.Combine(fixtures, Fixtures[0])), "a.cs"), Array.Empty<string>()).Count, "ไม่มีปัญหา");
        });

        test("ตรวจชื่อ class: ซ้ำใน DLL = error, ต่างแค่ตัวพิมพ์ = warning, เมธอดไม่ครบ = warning, ไม่ public = error", () =>
        {
            const string a = "namespace N { public class A { public void GetLogicalNames(){} public void GetInputParameters(){} public void GetOutputParameters(){} public void Draw(){} class Inner { void Draw(){} } } }";
            const string b = "namespace N.Sub; public class B { public void Draw(){} } internal static class SaDrawing_B { internal static void Draw(object cs){} }";
            const string c = "namespace N { class A { public void Draw(){} } public class a { public void GetLogicalNames(){} public void GetInputParameters(){} public void GetOutputParameters(){} public void Draw(){} } }";
            var ca = ClassReader.Read(a, "a.cs"); var cb = ClassReader.Read(b, "b.cs"); var cc = ClassReader.Read(c, "c.cs");
            Eq("N.A", string.Join(",", ca.Select(x => x.FullName)), "class ซ้อนไม่นับ");
            Eq("N.Sub.B", cb.Single().FullName, "file-scoped namespace");
            Eq("GetLogicalNames,GetInputParameters,GetOutputParameters", string.Join(",", cb.Single().MissingMethods), "เมธอดที่ขาด");
            var issues = ClassReader.Check(ca.Concat(cb).Concat(cc).ToList(), new[] { "empty.cs" });
            string Has(string sev, string text) => issues.Any(i => i.Severity == sev && i.Message.Contains(text)) ? "" : $"ไม่มี {sev}: {text}; ";
            var miss = Has("error", "N.A ซ้ำ") + Has("warning", "ต่างกันแค่ตัวพิมพ์") + Has("warning", "N.Sub.B ไม่มีเมธอด") + Has("error", "N.A ต้องเป็น public") + Has("error", "ไม่พบ class");
            True(miss == "", miss + string.Join(" | ", issues.Select(i => i.Message)));
            True(ClassReader.ValidIdentifier("Body_2") && !ClassReader.ValidIdentifier("my-class") && !ClassReader.ValidIdentifier("class") && !ClassReader.ValidIdentifier("1a"), "identifier");
            True(ClassReader.ValidNamespace("A.B") && ClassReader.ValidNamespace("") && !ClassReader.ValidNamespace("A..B"), "namespace");
        });

        test("manifest diff: เพิ่ม / ลบ / เปลี่ยนชื่อ / ค่าเริ่มต้น / ชนิด / class ใหม่ + โหลด-บันทึก", () =>
        {
            ManifestClass C(string n, params (string, string, string?)[] ps) => new() { FullName = n, File = "x.cs", Params = ps.Select(p => new ManifestParam { Name = p.Item1, Kind = p.Item2, Default = p.Item3 }).ToList() };
            var old = new BuildManifest { DllName = "SR03", Classes = { C("N.A", ("Side", "long", "0"), ("Width", "double", "3.5"), ("Depth", "double", "0.2"), ("Old", "double", "1")), C("N.Gone") } };
            var now = new BuildManifest { DllName = "SR03", Classes = { C("N.A", ("Side", "long", "0"), ("Width", "double", "3.6"), ("Depth", "long", "0"), ("New", "double", "1")), C("N.B") } };
            var d = ManifestDiff.Diff(old, now);
            Eq("N.A Old removed|N.A Width default|N.A Depth type|N.A New added|N.B  class-added|N.Gone  class-removed",
               string.Join("|", d.Select(x => $"{x.Class} {x.Param} {x.Change}")), "diff");
            True(d.Single(x => x.Change == "default").Text.Contains("3.5 → 3.6"), "ข้อความ");
            Eq(0, ManifestDiff.Diff(null, now).Count, "build ครั้งแรก = ไม่มีการเปลี่ยน");
            Eq(0, ManifestDiff.Diff(now, now).Count, "เหมือนเดิม");
            var file = Path.Combine(Temp(), "build-manifest.json");
            now.Save(file);
            Eq(0, ManifestDiff.Diff(BuildManifest.Load(file), now).Count, "โหลดกลับได้เหมือนเดิม");
            Eq("3.6", BuildManifest.FormatDefault(3.6), "double invariant");
            Eq("true", BuildManifest.FormatDefault(true), "bool");
        });

        test("DLL ชื่อซ้ำในโฟลเดอร์อื่น: จากประวัติการ build (ปีเดียวกัน), ไม่นับโฟลเดอร์ที่ build นี้เขียนเอง, ไฟล์ที่ลบไปแล้วไม่นับ", () =>
        {
            var tmp = Temp();
            string Dll(string dir, string name) { Directory.CreateDirectory(Path.Combine(tmp, dir)); var p = Path.Combine(tmp, dir, name); File.WriteAllText(p, ""); return p; }
            var target = Dll("out", "SR03.dll");
            var other = Dll("old", "sr03.dll");
            var gone = Dll("gone", "SR03.dll");
            var otherYear = Dll("y26", "SR03.dll");
            var extra = Dll("copyto", "SR03.dll");
            var h = new BuildHistory(Path.Combine(tmp, "machine"));
            h.Record(target, 2027); h.Record(other, 2027); h.Record(gone, 2027); h.Record(otherYear, 2026);
            File.Delete(gone);
            var found = h.SameNameElsewhere("SR03", 2027, new[] { Path.Combine(tmp, "out") }, new[] { extra });
            Eq(string.Join("|", new[] { other, extra }), string.Join("|", found), "ที่พบ");
            Eq(0, h.SameNameElsewhere("SR03", 2027, new[] { Path.Combine(tmp, "out"), Path.Combine(tmp, "old") }, null).Count, "โฟลเดอร์ที่ build นี้เขียน");
            Eq(4, h.Load().Count, "ประวัติ");
        });

        test("DLL ถูกล็อก (Civil 3D เปิดอยู่) ตรวจได้ก่อน build", () =>
        {
            var f = Path.Combine(Temp(), "x.dll");
            File.WriteAllText(f, "");
            using (new FileStream(f, FileMode.Open, FileAccess.Read, FileShare.Read)) True(BuildEngine.IsLocked(f), "ล็อกอยู่");
            True(!BuildEngine.IsLocked(f), "ปลดล็อกแล้ว");
            True(!BuildEngine.IsLocked(f + ".none"), "ไม่มีไฟล์");
        });

        test("สรุป error ของ dotnet build: บรรทัดเดียวต่อ error, ตัด [project] และ path เต็ม", () =>
        {
            var log = "D:\\p\\a.cs(12,5): error CS1002: ; expected [D:\\p\\build\\obj\\SR03.csproj]\r\n" +
                      "D:\\p\\a.cs(12,5): error CS1002: ; expected [D:\\p\\build\\obj\\SR03.csproj]\r\n" +
                      "  warning CS0168: x\r\n";
            Eq("a.cs(12,5): error CS1002: ; expected", string.Join("|", BuildEngine.ErrorSummary(log)), "summary");
        });

        var compiler = new SubassemblyCompiler();
        var runner = new SubassemblyRunner();

        test("plan: ไฟล์จาก project ตามลำดับ (ไฟล์ซ้ำนับครั้งเดียว), ไฟล์หาย / ชื่อ DLL ผิด / ไม่ได้เลือกปี = ไม่ build", () =>
        {
            var dir = Project(fixtures, "T", Fixtures.Append(Fixtures[0]).Append("missing.cs"));
            var eng = new BuildEngine(compiler, runner, dir, Path.Combine(dir, "machine"), () => new List<C3DInstall>());
            var p = eng.Plan(new BuildRequest("T", null, null, null));
            Eq("T", p.DllName, "DLL name");
            Eq(string.Join(",", Fixtures), string.Join(",", p.Files), "ไฟล์");
            True(!p.Ok && p.Issues.Any(i => i.Severity == "error" && i.File == "missing.cs"), "ไฟล์หาย = error");
            var sub = eng.Plan(new BuildRequest("T", "Bad Name", null, Fixtures.Take(2).ToArray()));
            Eq(2, sub.Files.Count, "เลือกบางไฟล์");
            True(!sub.Ok && sub.Issues.Any(i => i.Message.Contains("ชื่อ DLL")), "ชื่อ DLL ผิด");
            var ok = eng.Plan(new BuildRequest("T", null, null, Fixtures));
            True(ok.Ok, "ไม่มี error: " + string.Join(" | ", ok.Issues.Select(i => i.Message)));
            var noYear = eng.Build(new BuildRequest("T", null, Array.Empty<int>(), Fixtures));
            True(!noYear.Ok && noYear.Builds.Count == 0, "ไม่ได้เลือกปี");
            var notInstalled = eng.Build(new BuildRequest("T", null, new[] { 2025 }, Fixtures));
            Eq("skipped", notInstalled.Builds.Single().Status, "ปีที่ไม่ได้ติดตั้ง");
            True(File.ReadAllText(Path.Combine(dir, Fixtures[0])) == File.ReadAllText(Path.Combine(fixtures, Fixtures[0])), "ไฟล์ .cs ไม่ถูกแก้");
        });

        var c3d = C3DVersions.DetectThisMachine().Where(i => i.CanBuild).OrderByDescending(i => i.Year).FirstOrDefault();
        test(c3d == null ? "build จริง: skipped (ไม่พบ Civil 3D ที่ build ได้)" : $"build จริงกับ Civil 3D {c3d.Year}: DLL + manifest + build ซ้ำไม่มีการเปลี่ยน + ชื่อซ้ำที่อื่นต้องยืนยัน", () =>
        {
            if (c3d == null) return;
            var dir = Project(fixtures, "T7", Fixtures);
            var machine = Path.Combine(dir, "machine");
            var eng = new BuildEngine(compiler, runner, dir, machine, () => new List<C3DInstall> { c3d });
            var r = eng.Build(new BuildRequest("T7", null, new[] { c3d.Year }, null));
            var y = r.Builds.Single();
            True(y.Status == "ok", $"{y.Status}: {y.Message} {string.Join(" | ", y.Errors)}");
            var outDir = Path.Combine(dir, "build", "T7", c3d.Year.ToString());
            Eq(outDir, y.OutDir, "โฟลเดอร์ output");
            True(File.Exists(Path.Combine(outDir, "T7.dll")), "มี DLL");
            True(File.Exists(Path.Combine(outDir, "build.log")) && File.Exists(Path.Combine(outDir, "obj", "T7.csproj")), "log + csproj");
            var m = BuildManifest.Load(Path.Combine(outDir, "build-manifest.json"))!;
            Eq(3, m.Classes.Count, "class ใน manifest");
            True(m.Classes.All(c => c.Params.Any(p => p.Name == "Side")), "parameter จากตัวจำลอง");
            Eq(0, y.Changes.Count, "build แรกไม่มีการเปลี่ยน");
            True(!Directory.GetFiles(outDir).Any(f => Path.GetFileName(f).StartsWith("Acdb", StringComparison.OrdinalIgnoreCase) || Path.GetFileName(f).StartsWith("Aecc", StringComparison.OrdinalIgnoreCase)), "ไม่มี DLL ของ Autodesk ใน output");

            // the same DLL name built in another project folder (same machine history) -> must be confirmed
            var dir2 = Project(fixtures, "T7", Fixtures.Take(1));
            var eng2 = new BuildEngine(compiler, runner, dir2, machine, () => new List<C3DInstall> { c3d });
            var r2 = eng2.Build(new BuildRequest("T7", null, new[] { c3d.Year }, null));
            Eq("same-name", r2.Builds.Single().Status, "ชื่อซ้ำต้องถาม");
            True(r2.Builds.Single().SameName.Contains(Path.Combine(outDir, "T7.dll"), StringComparer.OrdinalIgnoreCase), "บอกที่อยู่ DLL เดิม");
            var r3 = eng.Build(new BuildRequest("T7", null, new[] { c3d.Year }, null));
            Eq("ok", r3.Builds.Single().Status, "build ซ้ำที่เดิม (ไม่ถามชื่อซ้ำ)");
            Eq(0, r3.Builds.Single().Changes.Count, "build ซ้ำ ไม่มีการเปลี่ยน");
        });
    }

    // A project folder in temp: copies of the fixtures + <name>.assembly.json listing them
    static string Project(string fixtures, string name, IEnumerable<string> files)
    {
        var dir = Temp();
        foreach (var f in files.Distinct())
            if (File.Exists(Path.Combine(fixtures, f))) File.Copy(Path.Combine(fixtures, f), Path.Combine(dir, f), true);
        var items = string.Join(",", files.Select((f, i) => $"{{\"id\":\"i{i}\",\"file\":\"{f}\"}}"));
        File.WriteAllText(Path.Combine(dir, name + ".assembly.json"), $"{{\"version\":1,\"items\":[{items}]}}");
        return dir;
    }

    static readonly string TempRoot = Path.Combine(Path.GetTempPath(), "sa-build-tests");

    static string Temp()
    {
        var d = Path.Combine(TempRoot, Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(d);
        return d;
    }

    static void True(bool c, string msg) { if (!c) throw new Exception(msg); }
    static void Eq<T>(T e, T a, string what) { if (!Equals(e, a)) throw new Exception($"{what}: คาด {e} ได้ {a}"); }

    static string FindRoot()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d != null && !File.Exists(Path.Combine(d.FullName, "SubassemblyViewer.sln"))) d = d.Parent;
        return d?.FullName ?? throw new Exception("หาโฟลเดอร์โปรเจกต์ไม่เจอ");
    }
}
