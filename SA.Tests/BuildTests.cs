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

        // ---------- M2: pre-build checks ----------

        test("project รูปแบบหลาย assembly (version 2): อ่านไฟล์จาก assemblies[].items", () =>
        {
            var j = "{\"version\":2,\"assemblies\":[{\"items\":[{\"file\":\"a.cs\"},{\"file\":\"b.cs\"}]},{\"items\":[{\"file\":\"A.cs\"},{\"source\":\"x\"},{\"file\":\"c.cs\"}]}]}";
            Eq("a.cs,b.cs,c.cs", string.Join(",", BuildEngine.ProjectFiles(j)), "ไฟล์");
        });

        test("เปลี่ยน namespace / class ของไฟล์จากเว็บ: ชื่อนอกช่วง SA-DRAWING ตามไป, คอมไพล์ผ่าน, ไฟล์อื่นในโค้ดไม่เปลี่ยน", () =>
        {
            foreach (var f in Fixtures)
            {
                var src = File.ReadAllText(Path.Combine(fixtures, f));
                var blk = SA.Drawing.CodeGenerator.FindBlock(src)!;
                var oldClass = SA.Drawing.DrawingSpec.Parse(blk.SpecJson!).ClassName;
                var raw = System.Text.Json.Nodes.JsonNode.Parse(blk.SpecJson!)!;
                raw["className"] = "Renamed" + oldClass; raw["namespace"] = "Soravis.SA";
                var newSpec = SA.Drawing.DrawingSpec.Parse(raw.ToJsonString());
                var renamed = SA.Drawing.CodeGenerator.RenameClass(src, "TestSubassembly", oldClass, "Soravis.SA", "Renamed" + oldClass);
                var b2 = SA.Drawing.CodeGenerator.FindBlock(renamed)!;
                var text = SA.Drawing.CodeGenerator.ReplaceBlock(renamed, b2, SA.Drawing.CodeGenerator.GenerateBlock(newSpec, raw.ToJsonString(), b2.Indent));
                Eq(0, SA.Drawing.CodeGenerator.MissingCalls(text, newSpec).Count, $"{f}: บรรทัดเรียกส่วนที่วาด");
                var cls = ClassReader.Read(text, f).Single();
                Eq("Soravis.SA.Renamed" + oldClass, cls.FullName, $"{f}: ชื่อเต็ม");
                Eq(0, cls.MissingMethods.Length, $"{f}: เมธอด");
                var c = compiler.Compile(text, f);
                True(c.Success && c.Classes.Single().FullName == "Soravis.SA.Renamed" + oldClass, $"{f}: คอมไพล์ " + string.Join(" | ", c.Diagnostics.Take(3).Select(d => d.Message)));
                True(text.Contains("SaDrawing_Renamed" + oldClass) && !text.Contains("SaDrawing_" + oldClass + "."), $"{f}: helper");
            }
            // a namespace part equal to the class name stays (only the class is renamed)
            Eq("namespace A.Box { public class Lid { public void Draw(){} } public class Box2 { Lid b; } }",
               SA.Drawing.CodeGenerator.RenameClass("namespace A.Box { public class Box { public void Draw(){} } public class Box2 { Box b; } }", "A.Box", "Box", "A.Box", "Lid"),
               "namespace ที่ชื่อเหมือน class");
        });

        test("ตรวจก่อน build: fixture 3 ไฟล์ รันทุก scenario ขวา + ซ้าย ไม่มี error, link / shape ไม่มี code บอกเป็น id", () =>
        {
            var dir = Project(fixtures, "T", Fixtures);
            var eng = new BuildEngine(compiler, runner, dir, Path.Combine(dir, "machine"), () => new List<C3DInstall>());
            var r = eng.Check(new CheckRequest("T", null, null, null, null));
            True(r.Ok, "ไม่มี error: " + string.Join(" | ", r.Issues.Where(i => i.Severity == "error").Select(i => i.Message)));
            Eq(3, r.WebFiles.Count, "ไฟล์จากเว็บ");
            True(r.ScenarioRuns >= 3 * 16, $"จำนวนรัน {r.ScenarioRuns}");
            var nc = r.Issues.FirstOrDefault(i => i.Kind == "no-code" && i.File == "pavement-assembly.cs" && i.Message.Contains("link"));
            True(nc != null && nc.Message.Contains("L1,") && !nc.Message.Contains("L52"), "link ไม่มี code ของ pavement: " + nc?.Message);
            True(nc!.Severity == "warning", "เป็น warning");
        });

        test("ตรวจก่อน build: ไฟล์เขียนเอง — compile error, exception ตอน Draw, link ไม่มี code (บรรทัด), code ต่างแค่ตัวพิมพ์ / ช่องว่าง", () =>
        {
            var dir = Project(fixtures, "H", new[] { "hand.cs", "throws.cs", "broken.cs" });
            var hand = SubassemblyTemplate.Create("Hand").Replace("Link top = cs.Links.Add(new[] { p1, p2 }, \"Top\");", "Link top = cs.Links.Add(new[] { p1, p2 }, \"Top\"); cs.Links.Add(new[] { p2, p1 }, \"\");").Replace("\"CrestIn\"", "\"daylight \"");
            True(hand.Contains("cs.Links.Add(new[] { p2, p1 }, \"\")") && hand.Contains("\"daylight \""), "template เปลี่ยนแล้ว");
            File.WriteAllText(Path.Combine(dir, "hand.cs"), hand);
            var throws = System.Text.RegularExpressions.Regex.Replace(SubassemblyTemplate.Create("Throws"), @"public void Draw\(\)\s*\{", "public void Draw() { throw new System.InvalidOperationException(\"boom\");");
            File.WriteAllText(Path.Combine(dir, "throws.cs"), throws);
            File.WriteAllText(Path.Combine(dir, "broken.cs"), "namespace X { public class Broken { public void GetLogicalNames(){} public void GetInputParameters(){} public void GetOutputParameters(){} public void Draw() { int x = ; } } }");
            var eng = new BuildEngine(compiler, runner, dir, Path.Combine(dir, "machine"), () => new List<C3DInstall>());
            var r = eng.Check(new CheckRequest("H", null, null, null, null));
            True(!r.Ok, "ต้องมี error");
            True(r.Issues.Any(i => i.Kind == "compile" && i.File == "broken.cs" && i.Severity == "error"), "compile error");
            var run = r.Issues.FirstOrDefault(i => i.Kind == "run" && i.File == "throws.cs");
            True(run != null && run.Severity == "error" && run.Message.Contains("boom") && run.Scenarios!.Count >= 8, "exception: " + run?.Message);
            var nc = r.Issues.FirstOrDefault(i => i.Kind == "no-code" && i.File == "hand.cs");
            True(nc != null && nc.Message.Contains("link #1") && nc.Message.Contains("บรรทัด"), "link ไม่มี code: " + string.Join(" | ", r.Issues.Select(i => i.File + " " + i.Kind + ": " + i.Message)) + " classes " + string.Join(",", r.Classes.Select(c => c.File + ":" + c.FullName)) + " files " + string.Join(",", r.Files));
            True(r.Issues.Any(i => i.Kind == "code-case" && i.Message.Contains("\"daylight \"") && i.Message.Contains("\"Daylight\"")), "code ต่างแค่ตัวพิมพ์: " + string.Join(" | ", r.Issues.Select(i => i.Message)));
            Eq(0, r.WebFiles.Count, "ไม่มีไฟล์จากเว็บ");
        });

        test("ตรวจก่อน build ต่อปี: DLL ถูกล็อก = error, ชื่อซ้ำที่อื่น = warning, parameter เปลี่ยนจาก build ก่อน = warning, ปีที่ไม่ได้ติ๊กไม่เตือน", () =>
        {
            var dir = Project(fixtures, "T", Fixtures.Take(1));
            var fake = Temp();
            var eng = new BuildEngine(compiler, runner, dir, Path.Combine(dir, "machine"),
                () => new List<C3DInstall> { new(2026, fake, "net8.0-windows", true, true, null), new(2027, fake, "net10.0-windows", true, true, null) });
            var outDir = Path.Combine(dir, "build", "T", "2027");
            Directory.CreateDirectory(outDir);
            new BuildManifest { DllName = "T", Year = 2027, Classes = { new ManifestClass { FullName = "TestSubassembly.PavementAssembly", Params = { new ManifestParam { Name = "Side", Kind = "long", Default = "1" } } } } }
                .Save(Path.Combine(outDir, "build-manifest.json"));
            var other = Path.Combine(Temp(), "T.dll"); File.WriteAllText(other, "");
            eng.History.Record(other, 2027);
            File.WriteAllText(Path.Combine(outDir, "T.dll"), "");
            using (new FileStream(Path.Combine(outDir, "T.dll"), FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                var r = eng.Check(new CheckRequest("T", null, new[] { 2027 }, null, null));
                True(!r.Ok && r.Issues.Any(i => i.Kind == "locked" && i.Severity == "error"), "ล็อก");
                True(r.Issues.Any(i => i.Kind == "same-name" && i.Message.Contains(other)), "ชื่อซ้ำ");
                var pc = r.Issues.FirstOrDefault(i => i.Kind == "params");
                True(pc != null && pc.Message.Contains("Side ค่าเริ่มต้น 1 → 0") && pc.Message.Contains("MinDrop"), "parameter: " + pc?.Message);
                var y27 = r.Years.Single(y => y.Year == 2027);
                True(y27.Locked && y27.HasManifest && y27.SameName.Count == 1 && y27.OutDir == outDir, "ข้อมูลปี 2027");
                True(!r.Issues.Any(i => i.Message.StartsWith("Civil 3D 2026")), "2026 ไม่ได้ติ๊ก");
            }
            Eq(true, eng.Check(new CheckRequest("T", null, new[] { 2026 }, null, null)).Ok, "ปีอื่นไม่ล็อก");
            // Copy-to folder = a folder this build writes to: a DLL there is not "another folder"
            var s = new MachineSettings { CopyTo = Path.GetDirectoryName(other), CopyToOn = true };
            s.Save(eng.MachineDir);
            Eq(0, eng.Check(new CheckRequest("T", null, new[] { 2027 }, null, null)).Years.Single(y => y.Year == 2027).SameName.Count, "Copy-to ไม่นับเป็นที่อื่น");
            True(MachineSettings.CopyToError("relative\\x") != null && MachineSettings.CopyToError(Path.Combine(fake, "nope")) != null && MachineSettings.CopyToError(fake) == null, "ตรวจโฟลเดอร์ Copy-to");
            Eq(true, MachineSettings.Load(eng.MachineDir).CopyToOn, "โหลด setting");
        });

        test("ตรวจก่อน build: scenario ที่บันทึกไว้ในหน้าเว็บ (ไฟล์ตรงกัน) ถูกรันด้วย", () =>
        {
            var dir = Project(fixtures, "T", Fixtures.Take(1));
            var eng = new BuildEngine(compiler, runner, dir, Path.Combine(dir, "machine"), () => new List<C3DInstall>());
            var n0 = eng.Check(new CheckRequest("T", null, null, null, null)).ScenarioRuns;
            var sc = new List<CheckScenario>
            {
                new("pavement-assembly.cs", "กรณี 1", new List<SurfacePt> { new(-50, -1), new(50, -1) }, null, false),
                new("other.cs", "ไม่เกี่ยว", null, null, true)
            };
            Eq(n0 + 1, eng.Check(new CheckRequest("T", null, null, null, sc)).ScenarioRuns, "รันเพิ่ม 1");
        });

        // ---------- M3: .atc + icons ----------

        test(".atc: GUID คงที่ทุกครั้งที่ build (จากชื่อ DLL + class), ต่างชื่อ = ต่าง GUID", () =>
        {
            var a = AtcWriter.StableGuid("tool|SR03|TestSubassembly.A");
            Eq(a, AtcWriter.StableGuid("tool|SR03|TestSubassembly.A"), "เหมือนเดิม");
            True(a != AtcWriter.StableGuid("tool|SR04|TestSubassembly.A"), "ต่าง DLL");
            True(System.Text.RegularExpressions.Regex.IsMatch(a, @"^\{[0-9A-F]{8}-[0-9A-F]{4}-5[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\}$"), "รูปแบบ " + a);
        });

        test(".atc ของ fixture 3 ไฟล์ ตรงกับไฟล์ที่ล็อกไว้ (fixtures/round7/T7.atc, T7_tools.atc) + ไอคอน PNG", () =>
        {
            var dir = Project(fixtures, "T7", Fixtures);
            var eng = new BuildEngine(compiler, runner, dir, Path.Combine(dir, "machine"), () => new List<C3DInstall>());
            var plan = eng.Plan(new BuildRequest("T7", null, null, null));
            var cat = eng.MakeCatalog("T7", plan.Classes, plan.Files.Select(f => Path.Combine(dir, f)), "T7.dll");
            Eq(0, cat.Warnings.Count, "warning: " + string.Join(" | ", cat.Warnings.Select(w => w.Message)));
            var exp = Path.Combine(root, "SA.Tests", "fixtures", "round7");
            foreach (var (file, text) in new[] { ("T7.atc", cat.Catalog), ("T7_tools.atc", cat.Category) })
            {
                var want = File.Exists(Path.Combine(exp, file)) ? File.ReadAllText(Path.Combine(exp, file)) : null;
                if (want?.Replace("\r\n", "\n") != text.Replace("\r\n", "\n"))
                {
                    File.WriteAllText(Path.Combine(TempRoot, "actual_" + file), text);
                    throw new Exception($"{file} ไม่ตรง — ฉบับที่ได้อยู่ที่ {Path.Combine(TempRoot, "actual_" + file)}");
                }
            }
            Eq(3, cat.Icons.Count, "ไอคอน");
            foreach (var (rel, png) in cat.Icons)
            {
                var size = IconRenderer.Size(png);
                True(size is { } s && s.W >= 32 && s.H >= 32 && s.W <= 256 && s.H <= 256 && (s.W == 256 || s.H == 256), $"{rel}: ขนาด {size}");
                True(rel.StartsWith("icons\\") && rel.EndsWith(".png"), rel);
            }
            True(IconRenderer.Size(IconRenderer.Generic()) != null, "รูปทั่วไป");
        });

        test(".atc จาก spec: คำอธิบาย, ตัวเลือก (Enum), TypeInfo ตามชนิดค่า, comment ในโค้ดที่สร้าง · ไฟล์เขียนเอง: Side = Right / Left", () =>
        {
            var src = File.ReadAllText(Path.Combine(fixtures, "pavement-assembly.cs"));
            var raw = System.Text.Json.Nodes.JsonNode.Parse(SA.Drawing.CodeGenerator.FindBlock(src)!.SpecJson!)!;
            var ps = raw["params"]!.AsArray();
            ps[0]!["options"] = System.Text.Json.Nodes.JsonNode.Parse("""[{"value":0,"label":"ขวา Right"},{"value":1,"label":"Left"}]""");
            ps[0]!["description"] = "ด้านที่วาง";
            ps[1]!["description"] = "ระยะลด\nขั้นต่ำ";
            ps[1]!["unit"] = "length";
            var spec = SA.Drawing.DrawingSpec.Parse(raw.ToJsonString());
            var gen = SA.Drawing.CodeGenerator.GenerateFile(spec, raw.ToJsonString(), "pave.cs");
            True(gen.Contains("// ด้านที่วาง · 0=ขวา Right, 1=Left") && gen.Contains("// ระยะลด ขั้นต่ำ"), "comment ในโค้ด");
            True(gen.Contains("//   MinDrop (double, default 2 m) · ระยะลด ขั้นต่ำ") || gen.Contains("· ระยะลด ขั้นต่ำ"), "comment หัวไฟล์");
            var dir = Project(fixtures, "D", Array.Empty<string>());
            File.WriteAllText(Path.Combine(dir, "pave.cs"), gen);
            File.WriteAllText(Path.Combine(dir, "hand.cs"), SubassemblyTemplate.Create("Hand"));
            File.WriteAllText(Path.Combine(dir, "D.assembly.json"), "{\"version\":1,\"items\":[{\"file\":\"pave.cs\"},{\"file\":\"hand.cs\"}]}");
            var eng = new BuildEngine(compiler, runner, dir, Path.Combine(dir, "machine"), () => new List<C3DInstall>());
            var plan = eng.Plan(new BuildRequest("D", null, null, null));
            var cat = eng.MakeCatalog("D", plan.Classes, plan.Files.Select(f => Path.Combine(dir, f)), @"C:\full\D.dll");
            var x = XDocument.Parse(cat.Category);
            var side = x.Descendants("Side").First();
            Eq("ด้านที่วาง", (string?)side.Attribute("Description"), "คำอธิบาย Side");
            Eq("Long", (string?)side.Attribute("DataType"), "DataType");
            Eq("Right,Left", string.Join(",", side.Element("Enum")!.Elements().Select(e => e.Name.LocalName)), "ชื่อ Enum (ตัดอักษรที่ไม่ใช่ A-Z 0-9 _)");
            Eq("ขวา Right", (string?)side.Element("Enum")!.Elements().First().Attribute("DisplayName"), "DisplayName ของตัวเลือก");
            var md = x.Descendants("MinDrop").Single();
            Eq("16", (string?)md.Attribute("TypeInfo"), "length = 16");
            Eq("ระยะลด ขั้นต่ำ", (string?)md.Attribute("Description"), "คำอธิบายบรรทัดเดียว");
            Eq("2", md.Value, "default");
            True(x.Descendants("DotNetClass").All(d => (string?)d.Attribute("Assembly") == @"C:\full\D.dll"), "path แบบเต็ม");
            var hand = x.Descendants("Tool").Single(t => t.Descendants("DotNetClass").Single().Value == "TestSubassembly.Hand");
            var hs = hand.Descendants("Side").Single();
            Eq("Right,Left", string.Join(",", hs.Element("Enum")!.Elements().Select(e => e.Name.LocalName)), "Side ของไฟล์เขียนเอง");
            True(hand.Descendants("Params").Single().Elements().Where(e => (string?)e.Attribute("DataType") == "Double").All(e => (string?)e.Attribute("TypeInfo") == "16"), "double ของไฟล์เขียนเอง = 16");
            var runParams = string.Join(",", hand.Descendants("Params").Single().Elements().Select(e => e.Name.LocalName));
            True(runParams.StartsWith("Side,"), "ลำดับเดียวกับ GetInputParameters: " + runParams);
        });

        // ---------- M4: report, Copy-to, source package ----------

        test("รายงาน: class, ตาราง parameter, code จากตัวจำลอง, คำเตือน, ขั้นต่อใน Civil 3D · ไฟล์เขียนเอง = ไม่มีคำอธิบาย", () =>
        {
            var dir = Project(fixtures, "R", Fixtures.Take(1));
            File.WriteAllText(Path.Combine(dir, "hand.cs"), SubassemblyTemplate.Create("Hand"));
            File.WriteAllText(Path.Combine(dir, "R.assembly.json"), "{\"version\":1,\"items\":[{\"file\":\"pavement-assembly.cs\"},{\"file\":\"hand.cs\"}]}");
            var eng = new BuildEngine(compiler, runner, dir, Path.Combine(dir, "machine"), () => new List<C3DInstall>());
            var plan = eng.Plan(new BuildRequest("R", null, null, null));
            var check = eng.Check(new CheckRequest("R", null, null, null, null));
            var cat = eng.MakeCatalog("R", plan.Classes, plan.Files.Select(f => Path.Combine(dir, f)), "R.dll");
            var md = ReportWriter.Build(new ReportData("R", "R.assembly.json", null, null, cat, check, plan.Classes, new DateTime(2026, 11, 14, 9, 0, 0), "Source package: R.dll"));
            foreach (var want in new[] { "# Source package: R.dll", "## Classes", "- `TestSubassembly.PavementAssembly` (pavement-assembly.cs)", "## TestSubassembly.Hand",
                                         "| Name | Display name | Type | Default | Unit | Description | Min / Max | Options |", "| `Side` |", "0=Right, 1=Left",
                                         "ไม่มีคำอธิบาย (ไฟล์เขียนเอง)", "- Links: ", "`Top`", "## Warnings and errors", "link ที่ไม่มี code", "## ขั้นต่อใน Civil 3D", "CONTENTBROWSER", "2026-11-14 09:00" })
                True(md.Contains(want), "ไม่มี: " + want);
            True(md.Contains("\r\n") && !md.Replace("\r\n", "").Contains('\n'), "CRLF");
        });

        test("Copy-to: เลือกหลายปี = คัดลอกเฉพาะปีล่าสุด · ปิดไว้ / โฟลเดอร์ไม่มี = ไม่คัดลอก · DLL ใน Copy-to ถูกล็อก = error ก่อน build", () =>
        {
            var dir = Project(fixtures, "T", Fixtures.Take(1));
            var fake = Temp(); var copy = Temp();
            var eng = new BuildEngine(compiler, runner, dir, Path.Combine(dir, "machine"),
                () => new List<C3DInstall> { new(2026, fake, "net8.0-windows", true, true, null), new(2027, fake, "net10.0-windows", true, true, null) });
            Eq(null, eng.CopyDirFor(2027, new[] { 2027 }), "ปิดไว้");
            new MachineSettings { CopyTo = copy, CopyToOn = true }.Save(eng.MachineDir);
            Eq(copy, eng.CopyDirFor(2027, new[] { 2026, 2027 }), "ปีล่าสุด");
            Eq(null, eng.CopyDirFor(2026, new[] { 2026, 2027 }), "ปีอื่นไม่คัดลอก");
            Eq(copy, eng.CopyDirFor(2026, new[] { 2026 }), "ปีเดียว");
            new MachineSettings { CopyTo = Path.Combine(copy, "nope"), CopyToOn = true }.Save(eng.MachineDir);
            Eq(null, eng.CopyDirFor(2027, new[] { 2027 }), "โฟลเดอร์ไม่มี");
            new MachineSettings { CopyTo = copy, CopyToOn = true }.Save(eng.MachineDir);
            File.WriteAllText(Path.Combine(copy, "T.dll"), "");
            using (new FileStream(Path.Combine(copy, "T.dll"), FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                True(eng.Check(new CheckRequest("T", null, new[] { 2027 }, null, null)).Issues.Any(i => i.Kind == "locked" && i.Message.Contains(copy)), "check: ล็อกใน Copy-to");
                var y = eng.Build(new BuildRequest("T", null, new[] { 2027 }, null)).Builds.Single();
                True(y.Status == "locked" && y.Message!.Contains(copy), $"build: {y.Status} {y.Message}");
            }
        });

        bool sdk10 = C3DVersions.SdkMajors().Any(m => m >= 10);
        test(!sdk10 ? "build ไม่ผ่าน: skipped (ไม่มี .NET SDK 10)" : "build ไม่ผ่าน (Civil 3D ปลอม ไม่มี DLL ของ Autodesk): สรุป error + report.md บอกว่าไม่สำเร็จ, ไม่มี .atc", () =>
        {
            if (!sdk10) return;
            var dir = Project(fixtures, "F", Fixtures.Take(1));
            var fake = Temp();
            var eng = new BuildEngine(compiler, runner, dir, Path.Combine(dir, "machine"), () => new List<C3DInstall> { new(2027, fake, "net10.0-windows", true, true, null) });
            var y = eng.Build(new BuildRequest("F", null, new[] { 2027 }, null)).Builds.Single();
            True(y.Status == "failed" && y.Errors.Count > 0, $"{y.Status}: {y.Message}");
            True(y.Report != null && y.Report.Contains("✖ ไม่สำเร็จ") && File.Exists(y.ReportPath!), "report.md");
            True(!File.Exists(Path.Combine(y.OutDir, "F.atc")) && y.Atc == null, "ไม่เขียน .atc เมื่อ build ไม่ผ่าน");
        });

        test("Source package: zip มี .cs, .csproj (path สัมพัทธ์), build.bat, .atc, icons, report, README · ไม่มี DLL", () =>
        {
            var dir = Project(fixtures, "T7", Fixtures);
            var eng = new BuildEngine(compiler, runner, dir, Path.Combine(dir, "machine"), () => new List<C3DInstall>());
            var r = eng.SourcePackage(new BuildRequest("T7", null, new[] { 2027 }, null));
            True(r.Ok && File.Exists(r.Zip!) && r.Zip == Path.Combine(dir, "build", "T7", "T7-source.zip"), "zip " + r.Zip);
            using var z = System.IO.Compression.ZipFile.OpenRead(r.Zip!);
            var names = z.Entries.Select(e => e.FullName.Replace('\\', '/')).OrderBy(n => n, StringComparer.Ordinal).ToList();
            foreach (var want in Fixtures.Concat(new[] { "T7.csproj", "build.bat", "T7.atc", "T7_tools.atc.template", "report.md", "README.txt", "icons/T7/PavementAssembly.png" }))
                True(names.Contains(want), "ไม่มี " + want + ": " + string.Join(", ", names));
            True(!names.Any(n => n.EndsWith(".dll", StringComparison.OrdinalIgnoreCase)), "ไม่มี DLL");
            string Read(string n) { using var s = new StreamReader(z.GetEntry(n)!.Open()); return s.ReadToEnd(); }
            var x = XDocument.Parse(Read("T7.csproj")).Root!;
            Eq(string.Join("|", Fixtures), string.Join("|", x.Descendants("Compile").Select(c => c.Attribute("Include")!.Value)), "ไฟล์ .cs แบบสัมพัทธ์");
            Eq("$(MSBuildProjectDirectory)\\", x.Descendants("OutputPath").Single().Value, "DLL ข้าง .atc");
            True(x.Descendants("TargetFramework").Single().Attribute("Condition") != null, "TFM override ได้");
            var bat = Read("build.bat");
            True(bat.StartsWith("@echo off\r\n") && bat.Contains("chcp 65001") && bat.Contains("AeccDbMgd.dll") && bat.Contains("T7.csproj"), "build.bat");
            True(Read("README.txt").Contains("TestSubassembly.RockPitchingBodyWeb"), "README");
            True(!names.Contains("T7_tools.atc") && XDocument.Parse(Read("T7_tools.atc.template")).Descendants("DotNetClass").All(d => (string?)d.Attribute("Assembly") == BuildEngine.DllPathToken), "template ของ .atc (build.bat เขียน path เต็ม)");
            True(bat.Contains("T7_tools.atc.template") && bat.Contains(BuildEngine.DllPathToken), "build.bat เขียน .atc");
        });

        var c3d = C3DVersions.DetectThisMachine().Where(i => i.CanBuild).OrderByDescending(i => i.Year).FirstOrDefault();
        test(c3d == null ? "build จริง: skipped (ไม่พบ Civil 3D ที่ build ได้)" : $"build จริงกับ Civil 3D {c3d.Year}: DLL + .atc + report + Copy-to + manifest + build ซ้ำไม่มีการเปลี่ยน + ชื่อซ้ำที่อื่นต้องยืนยัน", () =>
        {
            if (c3d == null) return;
            var dir = Project(fixtures, "T7", Fixtures);
            var machine = Path.Combine(dir, "machine");
            var copy = Temp();
            new MachineSettings { CopyTo = copy, CopyToOn = true }.Save(machine);
            var eng = new BuildEngine(compiler, runner, dir, machine, () => new List<C3DInstall> { c3d });
            var r = eng.Build(new BuildRequest("T7", null, new[] { c3d.Year }, null));
            var y = r.Builds.Single();
            True(y.Status == "ok", $"{y.Status}: {y.Message} {string.Join(" | ", y.Errors)}");
            var outDir = Path.Combine(dir, "build", "T7", c3d.Year.ToString());
            Eq(outDir, y.OutDir, "โฟลเดอร์ output");
            True(File.Exists(Path.Combine(outDir, "T7.dll")), "มี DLL");
            True(File.Exists(Path.Combine(outDir, "T7.atc")) && File.Exists(Path.Combine(outDir, "T7_tools.atc")) && Directory.GetFiles(Path.Combine(outDir, "icons", "T7"), "*.png").Length == 3 && y.Atc == Path.Combine(outDir, "T7.atc"), ".atc + ไอคอน");
            True(File.Exists(Path.Combine(outDir, "build.log")) && File.Exists(Path.Combine(outDir, "obj", "T7.csproj")), "log + csproj");
            True(File.Exists(Path.Combine(outDir, "report.md")) && y.Report!.Contains("✓ สำเร็จ") && y.Report.Contains("`T7.dll`") && y.Report.Contains(copy), "report.md");
            // Copy-to
            Eq(copy, y.CopiedTo, "คัดลอกไป");
            True(new[] { "T7.dll", "T7.atc", "T7_tools.atc" }.All(f => File.Exists(Path.Combine(copy, f))) && Directory.GetFiles(Path.Combine(copy, "icons", "T7"), "*.png").Length == 3, "ไฟล์ใน Copy-to");
            True(XDocument.Parse(File.ReadAllText(Path.Combine(copy, "T7_tools.atc"))).Descendants("DotNetClass").All(d => (string?)d.Attribute("Assembly") == Path.Combine(copy, "T7.dll")), ".atc อ้าง DLL ใน Copy-to ด้วย path เต็ม");
            var m = BuildManifest.Load(Path.Combine(outDir, "build-manifest.json"))!;
            Eq(3, m.Classes.Count, "class ใน manifest");
            True(m.Classes.All(c => c.Params.Any(p => p.Name == "Side")), "parameter จากตัวจำลอง");
            True(m.CopiedTo.Contains(copy), "manifest จำ Copy-to");
            True(eng.History.Load().Any(e => e.Path == Path.Combine(copy, "T7.dll")), "ประวัติมี DLL ใน Copy-to");
            Eq(0, y.Changes.Count, "build แรกไม่มีการเปลี่ยน");
            True(!Directory.GetFiles(outDir).Any(f => Path.GetFileName(f).StartsWith("Acdb", StringComparison.OrdinalIgnoreCase) || Path.GetFileName(f).StartsWith("Aecc", StringComparison.OrdinalIgnoreCase)), "ไม่มี DLL ของ Autodesk ใน output");

            // the same DLL name built in another project folder (same machine history, Copy-to off) -> must be confirmed
            var machine2 = Path.Combine(dir, "machine");
            new MachineSettings { CopyTo = copy, CopyToOn = false }.Save(machine2);
            var dir2 = Project(fixtures, "T7", Fixtures.Take(1));
            var eng2 = new BuildEngine(compiler, runner, dir2, machine2, () => new List<C3DInstall> { c3d });
            var r2 = eng2.Build(new BuildRequest("T7", null, new[] { c3d.Year }, null));
            Eq("same-name", r2.Builds.Single().Status, "ชื่อซ้ำต้องถาม");
            True(r2.Builds.Single().SameName.Contains(Path.Combine(outDir, "T7.dll"), StringComparer.OrdinalIgnoreCase) && r2.Builds.Single().SameName.Contains(Path.Combine(copy, "T7.dll"), StringComparer.OrdinalIgnoreCase), "บอกที่อยู่ DLL เดิมทั้งสองที่");
            var r2b = eng2.Build(new BuildRequest("T7", null, new[] { c3d.Year }, null, AllowSameName: true));
            Eq("ok", r2b.Builds.Single().Status, "กด OK = build ได้");
            new MachineSettings { CopyTo = copy, CopyToOn = true }.Save(machine2);
            var r3 = eng.Build(new BuildRequest("T7", null, new[] { c3d.Year }, null, AllowSameName: true));
            Eq("ok", r3.Builds.Single().Status, "build ซ้ำที่เดิม");
            Eq(0, r3.Builds.Single().Changes.Count, "build ซ้ำ ไม่มีการเปลี่ยน");

            // source package built with its own build.bat, from another folder
            var src = eng.SourcePackage(new BuildRequest("T7", null, new[] { c3d.Year }, null));
            var unpack = Temp();
            System.IO.Compression.ZipFile.ExtractToDirectory(src.Zip!, unpack);
            var psi = new System.Diagnostics.ProcessStartInfo("cmd.exe", $"/c \"{Path.Combine(unpack, "build.bat")}\"") { WorkingDirectory = unpack, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
            psi.Environment["DOTNET_CLI_UI_LANGUAGE"] = "en";
            using var p = System.Diagnostics.Process.Start(psi)!;
            var outText = p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd();
            p.WaitForExit(300000);
            True(p.ExitCode == 0 && outText.Contains("OK:") && File.Exists(Path.Combine(unpack, "T7.dll")), $"build.bat: exit {p.ExitCode} {outText}");
            var builtAtc = XDocument.Parse(File.ReadAllText(Path.Combine(unpack, "T7_tools.atc")));
            True(builtAtc.Descendants("DotNetClass").All(d => (string?)d.Attribute("Assembly") == Path.Combine(unpack, "T7.dll")), "build.bat เขียน path เต็มลง .atc");
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
