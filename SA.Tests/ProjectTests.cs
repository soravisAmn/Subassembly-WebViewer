// Round 8 M1: project folders on the server (SA.Web/Projects). Everything runs in a temp folder with copies of
// SA.Tests/fixtures/round8 (never the user's project folders). box.cs / box2.cs are generated there from box.spec.json.
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SA.Build;
using SA.Drawing;
using SA.Mcp;
using SA.Projects;

static class ProjectTests
{
    static readonly string TempRoot = Path.Combine(Path.GetTempPath(), "sa-project-tests");

    public static void Run(Action<string, Action> test)
    {
        Console.WriteLine("\nProject folders (round 8)");
        string root = FindRoot();
        string fixtures = Path.Combine(root, "SA.Tests", "fixtures", "round8");
        try { Directory.Delete(TempRoot, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }

        // a fresh copy of the fixtures + generated web files; returns the project folder
        string Setup(string name)
        {
            var dir = Path.Combine(TempRoot, name, "proj");
            Directory.CreateDirectory(Path.Combine(dir, "lib"));
            foreach (var f in Directory.GetFiles(fixtures)) File.Copy(f, Path.Combine(dir, Path.GetFileName(f)));
            File.Copy(Path.Combine(fixtures, "lib", "hand.cs"), Path.Combine(dir, "lib", "hand.cs"));
            var raw = JsonNode.Parse(File.ReadAllText(Path.Combine(fixtures, "box.spec.json")))!.ToJsonString();
            var spec = DrawingSpec.Parse(raw);
            File.WriteAllText(Path.Combine(dir, "box.cs"), CodeGenerator.GenerateFile(spec, raw, "box.cs"));
            File.WriteAllText(Path.Combine(dir, "box2.cs"), CodeGenerator.GenerateFile(spec, raw, "box2.cs"));
            return dir;
        }
        JsonObject J(object o) => JsonNode.Parse(JsonSerializer.Serialize(o))!.AsObject();
        JsonObject Item(JsonObject content, string id) => ProjectFile.Items(content).First(i => ProjectFile.Str(i["id"]) == id);

        test("path: relative ใน / โฟลเดอร์ย่อย / .. ออกนอกได้เฉพาะไฟล์ที่ project อ้าง / path เต็มและชื่อแปลกถูกปฏิเสธ", () =>
        {
            var d = @"D:\p\SR03";
            Eq(@"D:\p\SR03\a.cs", ProjectPaths.Resolve(d, "a.cs", null, ".cs"), "ชื่อไฟล์");
            Eq(@"D:\p\SR03\lib\a.cs", ProjectPaths.Resolve(d, "lib/a.cs", null, ".cs"), "/ ในโฟลเดอร์ย่อย");
            Eq(@"D:\p\SR03\lib\a.cs", ProjectPaths.Resolve(d, @"lib\x\..\a.cs", null, ".cs"), ".. ที่ยังอยู่ในโฟลเดอร์");
            Eq(null, ProjectPaths.Resolve(d, @"..\shared\x.cs", null, ".cs"), "ออกนอกโฟลเดอร์โดยไม่มีใครอ้าง");
            var refd = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { @"D:\p\shared\x.cs" };
            Eq(@"D:\p\shared\x.cs", ProjectPaths.Resolve(d, @"..\shared\x.cs", refd.Contains, ".cs"), "ออกนอกโฟลเดอร์ที่ project อ้าง");
            Eq(null, ProjectPaths.Resolve(d, @"..\shared\y.cs", refd.Contains, ".cs"), "ไฟล์ข้างๆ ที่ project ไม่ได้อ้าง");
            foreach (var bad in new[] { @"C:\x.cs", "D:x.cs", @"\x.cs", ".hidden.cs", "a.txt", "", @"lib\\a.cs", "a.cs:stream", "..", @"lib\.git\a.cs" })
                Eq(null, ProjectPaths.Resolve(d, bad, _ => true, ".cs"), "ต้องปฏิเสธ " + bad);
            Eq(@"lib\a.cs", ProjectPaths.ToRelative(d, @"D:\p\SR03\lib\a.cs"), "relative ใน");
            Eq("../shared/x.cs", ProjectPaths.ToRelative(d, @"D:\p\shared\x.cs", '/'), "relative ออกนอก แบบ /");
            Eq(null, ProjectPaths.ToRelative(d, @"E:\x.cs"), "คนละไดรฟ์");
            Eq('/', ProjectPaths.SepOf(new[] { "a.cs", "lib/b.cs" }), "รูปแบบ /");
            Eq('\\', ProjectPaths.SepOf(new[] { "a.cs", null }), "ค่าเริ่มต้น \\");
        });

        test("v1 → v3: assembly เดียว, spec ตรงกับ .cs ถูกตัดทิ้ง, item ไม่มีไฟล์เก็บเป็น draft, id ที่ขาดถูกเติม", () =>
        {
            var dir = Setup("v1");
            var r = ProjectFile.Open(File.ReadAllText(Path.Combine(dir, "v1.assembly.json")), dir);
            Eq(1, r.FromVersion, "รุ่นเดิม");
            True(r.Changed, "ต้องเป็น changed (รุ่นใหม่)");
            Eq(3, (int)r.Content["version"]!, "version");
            var asm = r.Content["assemblies"]!.AsArray().Single()!.AsObject();
            Eq("V1", (string?)asm["name"], "ชื่อ assembly");
            Eq(3, asm["items"]!.AsArray().Count, "จำนวน item");
            var i1 = Item(r.Content, "i1");
            Eq("box.cs,box,params,attach", string.Join(",", i1.Select(k => k.Key).Where(k => k != "id").Select(k => k == "file" ? (string)i1["file"]! : k == "name" ? (string)i1["name"]! : k)), "คีย์ของ i1");
            Eq(3.0, (double)i1["params"]!["W"]!, "params คงเดิม");
            var drafted = ProjectFile.Items(r.Content).Last();
            Eq("i3", ProjectFile.Str(drafted["id"]), "id ที่เติม");
            Eq("draft.cs", ProjectFile.Str(drafted["draft"]!["fileName"]), "draft fileName");
            True(drafted["draft"]!["spec"] is JsonObject, "draft spec");
            Eq(0, r.Questions.Count, "ไม่มีคำถาม");
            Eq(0, r.Missing.Count, "ไม่มีไฟล์หาย");
            Eq(null, ProjectFile.Validate(r.Content), "ผลผ่าน Validate");
            True(JsonNode.DeepEquals(r.Content["surface"], JsonNode.Parse(File.ReadAllText(Path.Combine(dir, "v1.assembly.json")))!["surface"]), "surface คงเดิม");
        });

        test("v2 → v3: ยังไม่ Save ลง .cs = draft ไม่ถาม · .cs ถูกแก้หลังบันทึก = ถาม · ไฟล์หาย = draft + รายการไฟล์หาย · โค้ด inline = draft", () =>
        {
            var dir = Setup("v2");
            var r = ProjectFile.Open(File.ReadAllText(Path.Combine(dir, "v2.assembly.json")), dir);
            Eq(2, r.FromVersion, "รุ่นเดิม");
            Eq(2, r.Content["assemblies"]!.AsArray().Count, "2 assembly");
            True(Item(r.Content, "j1")["draft"]!["spec"] is JsonObject, "j1 draft");
            Eq("j2", string.Join(",", r.Questions.Select(q => q.ItemId)), "คำถาม");
            True(Item(r.Content, "j2")["draft"]!["spec"] is JsonObject, "j2 draft ระหว่างรอคำตอบ");
            Eq("j3:gone.cs", string.Join(",", r.Missing.Select(m => m.ItemId + ":" + m.File)), "ไฟล์หาย");
            True(Item(r.Content, "j3")["draft"]!["spec"] is JsonObject, "j3 draft");
            Eq("// inline code", ProjectFile.Str(Item(r.Content, "j4")["draft"]!["source"]), "j4 source");
            Eq("x.cs", ProjectFile.Str(Item(r.Content, "j4")["draft"]!["sourceName"]), "j4 sourceName");
            Eq(null, Item(r.Content, "j5")["draft"], "j5 ไฟล์เขียนเองไม่มี draft");
            foreach (var it in ProjectFile.Items(r.Content))
                True(!it.ContainsKey("spec") && !it.ContainsKey("savedSpec") && !it.ContainsKey("source") && !it.ContainsKey("generatedFile"), "ยังมีคีย์เก่าใน " + it["id"]);
            Eq(@"box.cs,box2.cs,gone.cs,lib\hand.cs", string.Join(",", ProjectFile.Files(r.Content)), "ไฟล์ที่อ้าง");
        });

        test("v3 เปิดแล้วเหมือนเดิม: ไม่ changed, draft / scenarios คงอยู่, เขียนกลับได้ข้อความเดิม (CRLF)", () =>
        {
            var dir = Setup("v3");
            var text = File.ReadAllText(Path.Combine(dir, "v3.assembly.json"));
            var r = ProjectFile.Open(text, dir);
            True(!r.Changed, "ไม่ควร changed");
            Eq(0, r.Questions.Count + r.Missing.Count, "ไม่มีคำถาม / ไฟล์หาย");
            Eq(2, r.Content["scenarios"]!.AsArray().Count, "scenarios");
            True(JsonNode.DeepEquals(JsonNode.Parse(text), r.Content), "เนื้อหาเท่าเดิม");
            var again = ProjectFile.Serialize(r.Content);
            True(again.Contains("\r\n") && !again.Replace("\r\n", "").Contains('\n'), "CRLF");
            True(JsonNode.DeepEquals(JsonNode.Parse(again), r.Content), "อ่านกลับได้");
            True(again.Contains("ตลิ่งสูง"), "ภาษาไทยไม่ถูก escape");
        });

        test("รุ่นใหม่กว่า / ไม่ใช่ object = error · Validate ปฏิเสธ path เต็ม, spec ฝัง, รุ่นเก่า", () =>
        {
            Throws(() => ProjectFile.Open("""{"version":4,"assemblies":[]}""", TempRoot), "รุ่น 4");
            Throws(() => ProjectFile.Open("[1]", TempRoot), "array");
            True(ProjectFile.Validate(JsonNode.Parse("""{"version":2,"assemblies":[]}""")!.AsObject()) != null, "รุ่น 2");
            True(ProjectFile.Validate(JsonNode.Parse("""{"version":3,"assemblies":[{"items":[{"id":"a","file":"D:\\x.cs"}]}]}""")!.AsObject()) != null, "path เต็ม");
            True(ProjectFile.Validate(JsonNode.Parse("""{"version":3,"assemblies":[{"items":[{"id":"a","file":"x.cs","spec":{}}]}]}""")!.AsObject()) != null, "spec");
            Eq(null, ProjectFile.Validate(JsonNode.Parse("""{"version":3,"assemblies":[{"items":[{"id":"a","file":"..\\x.cs","draft":{"spec":{}}}]}]}""")!.AsObject()), "relative + draft ผ่าน");
        });

        test("แท็บ: หลายโปรเจกต์พร้อมกัน, แท็บที่สองของโปรเจกต์เดียวกัน = อ่านอย่างเดียว, ปิด / หมดเวลา = เปิดเขียนได้, reload แท็บเดิมไม่ติดตัวเอง", () =>
        {
            var now = new DateTime(2026, 11, 15, 8, 0, 0, DateTimeKind.Utc);
            var reg = new ProjectRegistry(Path.Combine(TempRoot, "legacy"), Path.Combine(TempRoot, "scratch")) { Now = () => now };
            var a = reg.Open(@"D:\p\SR03\SR03.assembly.json", "t1");
            var b = reg.Open(@"D:\p\SR04\SR04.assembly.json", "t2");
            True(!a.ReadOnly && !b.ReadOnly, "สองโปรเจกต์เขียนได้ทั้งคู่");
            Eq(@"D:\p\SR04", b.ProjectDir, "โฟลเดอร์ของแท็บ 2");
            Eq(b, reg.Get(b.Handle), "handle → แท็บ 2");
            Eq(reg.Legacy, reg.Get(null), "ไม่มี header = โฟลเดอร์เดิม");
            Eq(null, reg.Get("nope"), "handle ไม่รู้จัก = project หาย");
            var c = reg.Open(@"d:\p\sr03\SR03.assembly.json", "t3");
            True(c.ReadOnly, "แท็บที่สองของ SR03 ต้องอ่านอย่างเดียว");
            var a2 = reg.Open(@"D:\p\SR03\SR03.assembly.json", "t1");
            True(!a2.ReadOnly, "reload แท็บเดิม = เขียนได้");
            Eq(null, reg.Get(a.Handle), "handle เก่าของแท็บเดิมถูกแทน");
            reg.Close(a2.Handle);
            True(!reg.Open(@"D:\p\SR03\SR03.assembly.json", "t4").ReadOnly, "หลังปิด = เขียนได้");
            var d = reg.Open(@"D:\p\SR05\SR05.assembly.json", "t5");
            now += TimeSpan.FromMinutes(5);
            True(!reg.Open(@"D:\p\SR05\SR05.assembly.json", "t6").ReadOnly, "แท็บเก่าหมดเวลา (ไม่มี socket) = เขียนได้");
            reg.SocketHandles = () => new[] { b.Handle };
            True(reg.Open(@"D:\p\SR04\SR04.assembly.json", "t7").ReadOnly, "socket ยังเปิด = ยังถือโปรเจกต์อยู่แม้นานแล้ว");
            var s = reg.Open(null, "t8");
            Eq(reg.ScratchDir, s.ProjectDir, "ไม่มีโปรเจกต์ = scratch");
            reg.Focused(b.Handle);
            Eq(b, reg.Find(null), "MCP ค่าเริ่มต้น = แท็บที่ focus ล่าสุด");
            Eq(b, reg.Find("SR04"), "หาด้วยชื่อ");
            Eq(b, reg.Find("SR04.assembly.json"), "หาด้วยชื่อไฟล์");
            Eq(null, reg.Find("SR99"), "ไม่มีแท็บ");
        });

        test("API: open (v2 → v3 + รายการไฟล์หาย + recent), save, Save as ไปโฟลเดอร์อื่น (path ใหม่แบบ relative), new, relink, read-only บันทึกไม่ได้", () =>
        {
            var dir = Setup("api");
            var machine = Path.Combine(TempRoot, "api", "machine");
            var reg = new ProjectRegistry(dir, Path.Combine(machine, "scratch"));
            var o = J(ProjectHttp.Open(reg, machine, new OpenReq(Path.Combine(dir, "v2.assembly.json"), "t1")));
            True((bool)o["ok"]!, o.ToJsonString());
            True(!(bool)o["readOnly"]!, "เขียนได้");
            Eq(2, (int)o["fromVersion"]!, "fromVersion");
            Eq("gone.cs", (string?)o["missing"]![0]!["File"], "ไฟล์หาย");
            var ctx = reg.Get((string)o["handle"]!)!;
            Eq(Path.Combine(dir, "lib", "hand.cs"), ctx.Resolve(@"lib\hand.cs", ".cs"), "resolve ในแท็บ");
            Eq(Path.Combine(dir, "v2.assembly.json"), MachineSettings.Load(machine).Recent.Single(), "recent");

            var content = o["content"]!.AsObject();
            var s = J(ProjectHttp.Save(reg, machine, ctx, new SaveProjectReq((JsonObject)content.DeepClone(), null)));
            True((bool)s["ok"]!, s.ToJsonString());
            var saved = File.ReadAllText(Path.Combine(dir, "v2.assembly.json"));
            Eq(3, (int)JsonNode.Parse(saved)!["version"]!, "บันทึกเป็น v3");
            True(!saved.Contains("savedSpec"), "ไม่มี savedSpec");

            // Save as into a sibling folder: paths become ..\proj\box.cs
            var other = Path.Combine(TempRoot, "api", "copy");
            var sa = J(ProjectHttp.Save(reg, machine, ctx, new SaveProjectReq((JsonObject)content.DeepClone(), Path.Combine(other, "C.assembly.json"))));
            True((bool)sa["ok"]!, sa.ToJsonString());
            Eq(@"..\proj\box.cs", ProjectFile.Str(Item(sa["content"]!.AsObject(), "j1")["file"]), "path ใหม่");
            Eq(other, ctx.ProjectDir, "แท็บย้ายไปโฟลเดอร์ใหม่");
            Eq(Path.Combine(dir, "box.cs"), ctx.Resolve(@"..\proj\box.cs", ".cs"), "ไฟล์นอกโฟลเดอร์ที่อ้างอ่านได้");
            Eq(null, ctx.Resolve(@"..\proj\hand.cs", ".cs"), "ไฟล์นอกโฟลเดอร์ที่ไม่ได้อ้าง");
            var re = J(ProjectHttp.Open(reg, machine, new OpenReq(Path.Combine(other, "C.assembly.json"), "t2")));
            True((bool)re["readOnly"]!, "แท็บที่สองของ C = อ่านอย่างเดียว");
            Eq(3, (int)re["fromVersion"]!, "เปิดซ้ำเป็น v3");
            Eq(@"..\proj\gone.cs", string.Join(",", re["missing"]!.AsArray().Select(m => (string?)m!["File"])), "ไฟล์หายตาม path ที่ rebase แล้ว");

            // relink: the missing file -> a file in the old folder (relative path)
            var rl = J(ProjectHttp.Relink(ctx, new RelinkReq(Path.Combine(dir, "box2.cs"), null)));
            Eq(@"..\proj\box2.cs", (string?)rl["file"], "relink relative");
            True((bool)rl["outside"]!, "อยู่นอกโฟลเดอร์");
            Eq(Path.Combine(dir, "box2.cs"), ctx.Resolve(@"..\proj\box2.cs", ".cs"), "หลัง relink อ่านได้");
            True(!(bool)J(ProjectHttp.Relink(ctx, new RelinkReq(Path.Combine(dir, "nothere.cs"), null)))["ok"]!, "relink ไฟล์ที่ไม่มี");

            // new project
            var nw = J(ProjectHttp.New(reg, machine, new NewProjectReq(Path.Combine(TempRoot, "api"), "SR09", "t3")));
            True((bool)nw["ok"]!, nw.ToJsonString());
            var nf = Path.Combine(TempRoot, "api", "SR09", "SR09.assembly.json");
            True(File.Exists(nf), "สร้างไฟล์โปรเจกต์");
            Eq(nf, (string?)nw["path"], "path");
            True(!(bool)J(ProjectHttp.New(reg, machine, new NewProjectReq(Path.Combine(TempRoot, "api"), "SR09", "t4")))["ok"]!, "ซ้ำ = ไม่สร้างทับ");
            True(!(bool)J(ProjectHttp.New(reg, machine, new NewProjectReq(Path.Combine(TempRoot, "api"), @"..\x", "t4")))["ok"]!, "ชื่อแปลก");
            Eq(nf, MachineSettings.Load(machine).Recent[0], "recent ใหม่สุดอยู่ก่อน");

            True(!(bool)J(ProjectHttp.Open(reg, machine, new OpenReq(@"relative.assembly.json", "t5")))["ok"]!, "path ไม่เต็ม");
            True(!(bool)J(ProjectHttp.Open(reg, machine, new OpenReq(Path.Combine(dir, "box.cs"), "t5")))["ok"]!, "ไม่ใช่ .assembly.json");
        });

        test("ตั้งค่าเครื่อง: recent ไม่ซ้ำ ใหม่สุดก่อน ไม่เกิน 10, ค่าเดิมยังอ่านได้, เปิดโปรเจกต์ล่าสุดเป็นค่าเริ่มต้น", () =>
        {
            var machine = Path.Combine(TempRoot, "settings");
            Directory.CreateDirectory(machine);
            File.WriteAllText(Path.Combine(machine, "settings.json"), """{ "copyTo": "D:\\C3D", "copyToOn": true }""");
            var s0 = MachineSettings.Load(machine);
            Eq(@"D:\C3D", s0.CopyTo, "ไฟล์รอบ 7 อ่านได้");
            True(s0.ReopenLast, "reopenLast ค่าเริ่มต้น");
            for (int i = 0; i < 12; i++) MachineSettings.Update(machine, s => s.AddRecent($@"D:\p\P{i}\P{i}.assembly.json"));
            MachineSettings.Update(machine, s => s.AddRecent(@"d:\p\P5\P5.assembly.json"));
            var s1 = MachineSettings.Load(machine);
            Eq(10, s1.Recent.Count, "ไม่เกิน 10");
            Eq(@"d:\p\P5\P5.assembly.json", s1.Recent[0], "เปิดซ้ำขึ้นมาก่อน");
            Eq(1, s1.Recent.Count(r => r.Contains(@"\P5\")), "ไม่ซ้ำ");
            Eq(@"D:\C3D", s1.CopyTo, "Copy-to ยังอยู่");
            True(File.ReadAllText(Path.Combine(machine, "settings.json")).Contains("\r\n"), "CRLF");
        });

        test("Build ของแท็บ: ไฟล์ในโฟลเดอร์ย่อย + ไฟล์นอกโฟลเดอร์ที่ project อ้าง, ไฟล์นอกที่ไม่ได้อ้างไม่ผ่าน", () =>
        {
            var dir = Setup("build");
            var outside = Path.Combine(TempRoot, "build", "shared");
            Directory.CreateDirectory(outside);
            File.Copy(Path.Combine(fixtures, "hand.cs"), Path.Combine(outside, "o.cs"));
            File.WriteAllText(Path.Combine(dir, "B.assembly.json"),
                """{"version":3,"assemblies":[{"id":"a1","items":[{"id":"x","file":"lib\\hand.cs"},{"id":"y","file":"..\\shared\\o.cs"}]}],"scenarios":[]}""");
            var compiler = new SubassemblyCompiler(); var runner = new SubassemblyRunner();
            var baseEng = new BuildEngine(compiler, runner, TempRoot, Path.Combine(TempRoot, "build", "machine"), () => new List<C3DInstall>());
            var refd = ProjectFile.Referenced(JsonNode.Parse(File.ReadAllText(Path.Combine(dir, "B.assembly.json")))!.AsObject(), dir);
            var plan = baseEng.For(dir, refd.Contains).Plan(new BuildRequest("B.assembly.json", "B", null, null));
            True(plan.Ok, string.Join(" | ", plan.Issues.Select(i => i.Message)));
            Eq(@"lib\hand.cs,..\shared\o.cs", string.Join(",", plan.Files), "ไฟล์");
            Eq("TestSubassembly.Lib8,TestSubassembly.Hand8", string.Join(",", plan.Classes.Select(c => c.FullName)), "class");
            var bad = baseEng.For(dir).Plan(new BuildRequest("B.assembly.json", "B", null, null));
            True(!bad.Ok && bad.Issues.Any(i => i.File == @"..\shared\o.cs"), "ไม่มีรายการอ้าง = ไฟล์นอกโฟลเดอร์ไม่ผ่าน");
        });

        test("AssemblyService อ่านไฟล์ผ่านตัว resolve ของแท็บ (โฟลเดอร์ย่อย)", () =>
        {
            var dir = Setup("asm");
            var svc = new AssemblyService(new SubassemblyCompiler(), new SubassemblyRunner(), TempRoot);
            var req = JsonSerializer.Deserialize<AssemblyReq>("""{"items":[{"id":"x","file":"lib/hand.cs","attach":{"type":"baseline","x":0,"y":0}}]}""",
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
            var r = svc.Run(req, n => ProjectPaths.Resolve(dir, n, null, ".cs")).Single();
            True(r.Ok, r.Stage + " " + r.Message);
            var miss = svc.Run(req).Single();
            Eq("file", miss.Stage, "โฟลเดอร์เดิม (ค่าเริ่มต้น) ไม่มีไฟล์นี้");
        });

        test("Pack: .cs + .png ข้างกัน + lib\\ ใน zip, ไฟล์นอกโฟลเดอร์ copy เข้า ext\\ และแก้ path ใน zip เท่านั้น, ไฟล์หายถูกรายงาน, build\\ เฉพาะเมื่อเลือก, draft ไปด้วย", () =>
        {
            var dir = Setup("pack");
            var shared = Path.Combine(TempRoot, "pack", "shared");
            Directory.CreateDirectory(shared);
            File.Copy(Path.Combine(fixtures, "hand.cs"), Path.Combine(shared, "o.cs"));
            File.WriteAllBytes(Path.Combine(dir, "box.png"), new byte[] { 1, 2, 3 });
            Directory.CreateDirectory(Path.Combine(dir, "build", "P"));
            File.WriteAllText(Path.Combine(dir, "build", "P", "P.atc"), "x");
            var projText = """{"version":3,"assemblies":[{"id":"a1","items":[{"id":"x","file":"box.cs"},{"id":"y","file":"lib\\hand.cs"},{"id":"z","file":"..\\shared\\o.cs"},{"id":"g","file":"gone.cs"},{"id":"d","draft":{"fileName":"new.cs","spec":{}}}]}],"scenarios":[{"name":"L","mode":"layout"}]}""";
            var pf = Path.Combine(dir, "P.assembly.json");
            File.WriteAllText(pf, projText);
            var reg = new ProjectRegistry(dir, Path.Combine(TempRoot, "pack", "scratch"));
            var c = JsonNode.Parse(projText)!.AsObject();
            var ctx = reg.Open(pf, "t1", ProjectFile.Referenced(c, dir));
            var now = new DateTime(2026, 11, 15);
            var dry = ProjectPack.Pack(ctx, new PackReq(c, null, false, true), now);
            True(dry.Ok, dry.Message ?? "");
            Eq("P_2026-11-15.zip", dry.DefaultName, "ชื่อเริ่มต้น");
            Eq("P.assembly.json,box.cs,box.png,lib/hand.cs,ext/o.cs", string.Join(",", dry.Entries), "รายการ (ไม่มี build)");
            Eq(@"..\shared\o.cs>ext\o.cs", string.Join(",", dry.Outside.Select(o => o.File + ">" + o.PackedAs)), "ไฟล์นอกโฟลเดอร์");
            Eq("gone.cs", string.Join(",", dry.Missing), "ไฟล์หาย");
            Eq(1, dry.Drafts, "draft");
            True(ProjectPack.Pack(ctx, new PackReq(c, null, true, true), now).Entries.Contains("build/P/P.atc"), "build\\ เมื่อเลือก");
            var outZip = Path.Combine(TempRoot, "pack", "P.zip");
            var r = ProjectPack.Pack(ctx, new PackReq(c, outZip), now);
            True(r.Ok && File.Exists(outZip), r.Message ?? "");
            using (var z = System.IO.Compression.ZipFile.OpenRead(outZip))
            {
                var names = z.Entries.Select(e => e.FullName).ToList();
                Eq("P/P.assembly.json,P/box.cs,P/box.png,P/lib/hand.cs,P/ext/o.cs", string.Join(",", names), "ใน zip");
                using var sr = new StreamReader(z.GetEntry("P/P.assembly.json")!.Open());
                var inZip = JsonNode.Parse(sr.ReadToEnd())!.AsObject();
                Eq(@"ext\o.cs", ProjectFile.Str(Item(inZip, "z")["file"]), "path ใน zip ถูกแก้");
                Eq("L", (string?)inZip["scenarios"]![0]!["name"], "scenarios ไปด้วย");
                True(Item(inZip, "d")["draft"] is JsonObject, "draft ไปด้วย");
            }
            Eq(projText, File.ReadAllText(pf), "ไฟล์โปรเจกต์ที่เปิดอยู่ไม่ถูกแก้");
            Eq(@"..\shared\o.cs", ProjectFile.Str(Item(c, "z")["file"]), "content ที่ส่งมาไม่ถูกแก้");
            // unzip elsewhere and open: every file is found
            var other = Path.Combine(TempRoot, "pack", "unzipped");
            System.IO.Compression.ZipFile.ExtractToDirectory(outZip, other);
            var reopened = ProjectFile.Open(File.ReadAllText(Path.Combine(other, "P", "P.assembly.json")), Path.Combine(other, "P"));
            Eq("gone.cs", string.Join(",", reopened.Missing.Select(m => m.File)), "แตกแล้วเปิดได้ หายแค่ไฟล์ที่หายตั้งแต่แรก");
            True(!ProjectPack.Pack(ctx, new PackReq(c, "rel.zip"), now).Ok, "path ไม่เต็ม");
            True(!ProjectPack.Pack(reg.Open(null, "t9"), new PackReq(c, outZip), now).Ok, "ไม่มีโปรเจกต์");
        });

        test("หลาย code ใน object เดียว: spec → โค้ดที่สร้าง → ตัวจำลอง ได้ครบทุก code (จุด / link / shape)", () =>
        {
            var spec = JsonNode.Parse(File.ReadAllText(Path.Combine(fixtures, "box.spec.json")))!.AsObject();
            spec["points"]!.AsArray().Add(JsonNode.Parse("""{"id":"P3","codes":["Toe","Datum","Edge2"],"def":{"type":"delta","from":"P1","dx":"0","dy":"-1"}}"""));
            spec["links"]!.AsArray()[0]!["codes"] = JsonNode.Parse("""["Top","Datum"]""");
            spec["links"]!.AsArray().Add(JsonNode.Parse("""{"id":"L2","points":["P2","P3"],"codes":["Side"]}"""));
            spec["links"]!.AsArray().Add(JsonNode.Parse("""{"id":"L3","points":["P3","P1"],"codes":["Back","Datum"]}"""));
            spec["shapes"] = JsonNode.Parse("""[{"id":"S1","links":["L1","L2","L3"],"codes":["Fill","Pave"]}]""");
            var raw = spec.ToJsonString();
            var src = CodeGenerator.GenerateFile(DrawingSpec.Parse(raw), raw, "Box8.cs");
            var compiled = new SubassemblyCompiler().Compile(src, "Box8.cs");
            True(compiled.Success, string.Join(" | ", compiled.Diagnostics.Select(d => d.Message)));
            var o = new SubassemblyRunner().Run(compiled.Classes[0], null, new WorldInput());
            var pts = o.Points.Select(p => string.Join(",", p.Codes)).ToList();
            True(pts.Contains("Top,Edge") && pts.Contains("Toe,Datum,Edge2"), "จุด: " + string.Join(" | ", pts));
            var links = JsonNode.Parse(JsonSerializer.Serialize(o.Links))!.AsArray().Select(l => string.Join(",", l!["codes"]!.AsArray().Select(c => (string?)c))).ToList();
            True(links.Contains("Top,Datum") && links.Contains("Back,Datum") && links.Contains("Side"), "link: " + string.Join(" | ", links));
            var shapes = JsonNode.Parse(JsonSerializer.Serialize(o.Shapes))!.AsArray().Select(s => string.Join(",", s!["codes"]!.AsArray().Select(c => (string?)c))).ToList();
            Eq("Fill,Pave", string.Join(" | ", shapes), "shape");
        });

        test("MCP: sa_status แสดงแท็บ, เรียกด้วย project ไปที่แท็บนั้น, ค่าเริ่มต้น = แท็บที่ focus ล่าสุด, ชื่อที่ไม่มี = error พร้อมรายการแท็บ", () =>
        {
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseUrls("http://127.0.0.1:0");
            builder.Logging.ClearProviders();
            builder.Services.AddSaMcp();
            var reg = new ProjectRegistry(TempRoot, Path.Combine(TempRoot, "scratch"));
            builder.Services.AddSingleton(sp => { var hub = sp.GetRequiredService<PageHub>(); reg.SocketHandles = () => hub.Handles; hub.Focused = reg.Focused; return reg; });
            var app = builder.Build();
            app.UseSaMcpGuard();
            app.MapSaMcp();
            app.StartAsync().Wait();
            _ = app.Services.GetRequiredService<ProjectRegistry>();
            try
            {
                var url = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First();
                var a = reg.Open(@"D:\p\SR03\SR03.assembly.json", "t1");
                var b = reg.Open(@"D:\p\SR04\SR04.assembly.json", "t2");
                using var pa = McpTests.FakePage(url, m => """{"text":"page SR03"}""");
                using var pb = McpTests.FakePage(url, m => """{"text":"page SR04"}""");
                pa.Send("{\"project\":\"" + a.Handle + "\"}");
                Thread.Sleep(150);
                pb.Send("{\"project\":\"" + b.Handle + "\"}");
                Thread.Sleep(150);
                using var http = new HttpClient();
                string Call(string tool, string args)
                {
                    var req = new HttpRequestMessage(HttpMethod.Post, url + "/mcp")
                    { Content = new StringContent("{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"" + tool + "\",\"arguments\":" + args + "}}", Encoding.UTF8, "application/json") };
                    req.Headers.Add("Accept", "application/json, text/event-stream");
                    var text = http.SendAsync(req).Result.Content.ReadAsStringAsync().Result;
                    var data = text.Split('\n').FirstOrDefault(l => l.StartsWith("data: "));
                    var res = JsonDocument.Parse(data != null ? data[6..] : text).RootElement.GetProperty("result");
                    return string.Join("\n", res.GetProperty("content").EnumerateArray().Select(c => c.GetProperty("text").GetString()));
                }
                var st = Call("sa_status", "{}");
                True(st.Contains("SR03") && st.Contains("SR04") && st.Contains("page SR04"), "status: " + st);
                True(st.IndexOf("SR04", StringComparison.Ordinal) < st.IndexOf("SR03", StringComparison.Ordinal), "แท็บที่ focus ล่าสุดก่อน: " + st);
                True(Call("sa_describe", """{"project":"SR03"}""").Contains("page SR03"), "เลือกแท็บด้วยชื่อ");
                pa.Active(); Thread.Sleep(100);
                True(Call("sa_describe", "{}").Contains("page SR03"), "ค่าเริ่มต้น = แท็บที่ focus ล่าสุด");
                var e = Call("sa_describe", """{"project":"SR99"}""");
                True(e.Contains("No open tab has project SR99") && e.Contains("SR04"), e);
            }
            finally { app.StopAsync().Wait(); }
        });
    }

    static void Throws(Action a, string what)
    {
        try { a(); } catch (Exception) { return; }
        throw new Exception("ต้อง error: " + what);
    }
    static void True(bool c, string msg) { if (!c) throw new Exception(msg); }
    static void Eq<T>(T e, T a, string what) { if (!Equals(e, a)) throw new Exception($"{what}: คาด {e} ได้ {a}"); }
    static string FindRoot()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d != null && !File.Exists(Path.Combine(d.FullName, "CLAUDE.md"))) d = d.Parent;
        return d?.FullName ?? throw new Exception("ไม่พบโฟลเดอร์ repo");
    }
}
