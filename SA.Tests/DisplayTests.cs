// Round 10 M1: web display data on the server. The sa-spec "display" key rides along unchanged (generate, FindBlock, save,
// rename), never changes the generated C# body or the Build manifest; style file endpoints and the project file key
// "styleFile" (missing file, Pack). Runs in a temp folder with copies of SA.Tests/fixtures (never the user's projects).
using System.Text.Json;
using System.Text.Json.Nodes;
using SA.Build;
using SA.Drawing;
using SA.Projects;

static class DisplayTests
{
    static readonly string TempRoot = Path.Combine(Path.GetTempPath(), "sa-display-tests");

    public static void Run(Action<string, Action> test)
    {
        Console.WriteLine("\nWeb display (round 10)");
        string root = FindRoot();
        string fixtures = Path.Combine(root, "SA.Tests", "fixtures");
        try { Directory.Delete(TempRoot, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        Directory.CreateDirectory(TempRoot);

        JsonObject BoxSpec() => JsonNode.Parse(File.ReadAllText(Path.Combine(fixtures, "round8", "box.spec.json")))!.AsObject();
        const string DisplayJson = """{"overrides":{"L1":{"link":{"linetype":"hidden","weight":0.5}},"P2":{"point":{"marker":"triangle"}}},"notes":[{"id":"N1","text":"ระวัง {W}","at":{"point":"P2","dx":0.5,"dy":0.8}}]}""";
        (string Plain, string WithDisplay) Raws(Action<JsonObject>? tweak = null)
        {
            var a = BoxSpec(); tweak?.Invoke(a);
            var b = (JsonObject)a.DeepClone(); b["display"] = JsonNode.Parse(DisplayJson);
            return (a.ToJsonString(), b.ToJsonString());
        }
        string Gen(string raw, string name = "Box8.cs") => CodeGenerator.GenerateFile(DrawingSpec.Parse(raw), raw, name);
        // the file without its sa-spec line(s): what Civil 3D compiles
        string Body(string src) => string.Join("\n", src.Replace("\r\n", "\n").Split('\n').Where(l => !l.TrimStart().StartsWith("// sa-spec")));
        JsonObject J(object o) => JsonNode.Parse(JsonSerializer.Serialize(o))!.AsObject();

        test("sa-spec with display: DrawingSpec.Display carries it; generate → FindBlock → spec keeps it; the block still matches its spec", () =>
        {
            var (_, raw) = Raws();
            var spec = DrawingSpec.Parse(raw);
            True(spec.Display is { ValueKind: JsonValueKind.Object }, "DrawingSpec.Display");
            var block = CodeGenerator.FindBlock(Gen(raw))!;
            var back = JsonNode.Parse(block.SpecJson!)!;
            True(JsonNode.DeepEquals(JsonNode.Parse(DisplayJson), back["display"]), "display unchanged: " + back["display"]?.ToJsonString());
            True(CodeGenerator.BlockMatchesSpec(block), "not seen as hand-edited");
        });

        test("save over an existing file and the rename path keep display (only the SA-DRAWING block changes)", () =>
        {
            var (plain, raw) = Raws();
            var src = Gen(plain);
            // normal save: replace the block with the new spec
            var b1 = CodeGenerator.FindBlock(src)!;
            var saved = CodeGenerator.ReplaceBlock(src, b1, CodeGenerator.GenerateBlock(DrawingSpec.Parse(raw), raw, b1.Indent));
            True(JsonNode.DeepEquals(JsonNode.Parse(DisplayJson), JsonNode.Parse(CodeGenerator.FindBlock(saved)!.SpecJson!)!["display"]), "save");
            // rename (Build dialog): class renamed, display kept
            var renamedSpec = JsonNode.Parse(raw)!.AsObject(); renamedSpec["className"] = "Box9";
            var raw2 = renamedSpec.ToJsonString();
            var old = DrawingSpec.Parse(CodeGenerator.FindBlock(saved)!.SpecJson!);
            var renamed = CodeGenerator.RenameClass(saved, "TestSubassembly", old.ClassName, "TestSubassembly", "Box9");
            var b2 = CodeGenerator.FindBlock(renamed)!;
            var text = CodeGenerator.ReplaceBlock(renamed, b2, CodeGenerator.GenerateBlock(DrawingSpec.Parse(raw2), raw2, b2.Indent));
            var b3 = CodeGenerator.FindBlock(text)!;
            True(JsonNode.DeepEquals(JsonNode.Parse(DisplayJson), JsonNode.Parse(b3.SpecJson!)!["display"]), "rename");
            Eq(0, CodeGenerator.MissingCalls(text, DrawingSpec.Parse(raw2)).Count, "rename complete");
        });

        test("generated C# body is byte-identical with and without display", () =>
        {
            var (plain, raw) = Raws();
            var a = Gen(plain); var b = Gen(raw);
            True(a != b, "the sa-spec line differs");
            Eq(Body(a), Body(b), "body");
        });

        test("Build manifest: a display-only change is no parameter change; a default change is", () =>
        {
            BuildManifest Manifest(string raw)
            {
                var src = Gen(raw);
                var compiled = new SubassemblyCompiler().Compile(src, "Box8.cs");
                True(compiled.Success, string.Join(" | ", compiled.Diagnostics.Select(d => d.Message)));
                var o = new SubassemblyRunner().Run(compiled.Classes[0], null, new WorldInput());
                return new BuildManifest { Classes = { new ManifestClass { FullName = compiled.Classes[0].FullName!, File = "Box8.cs",
                    Params = o.Params.Select(p => new ManifestParam { Name = p.Name, Kind = p.Kind, Default = BuildManifest.FormatDefault(p.Default) }).ToList() } } };
            }
            var (plain, raw) = Raws();
            Eq(0, ManifestDiff.Diff(Manifest(plain), Manifest(raw)).Count, "display only");
            var (_, changed) = Raws(s => s["params"]!.AsArray()[1]!["default"] = 3);
            True(ManifestDiff.Diff(Manifest(plain), Manifest(changed)).Count > 0, "a real change is still seen");
        });

        // ---------- style file + project file ----------
        string Proj(string name, string? styleFile)
        {
            var dir = Path.Combine(TempRoot, name, "proj");
            Directory.CreateDirectory(dir);
            var c = new JsonObject { ["version"] = 3, ["assemblies"] = new JsonArray(new JsonObject { ["id"] = "a1", ["items"] = new JsonArray() }), ["scenarios"] = new JsonArray() };
            if (styleFile != null) c["styleFile"] = styleFile;
            File.WriteAllText(Path.Combine(dir, "P.assembly.json"), ProjectFile.Serialize(c));
            return dir;
        }
        var demoStyle = File.ReadAllText(Path.Combine(fixtures, "round10", "demo.style.json"));

        test("style endpoints: read / save only *.style.json in the project (outside only when referenced); bad JSON, read-only tab, no project refused", () =>
        {
            var dir = Proj("ep", null);
            var machine = Path.Combine(TempRoot, "ep", "machine");
            var reg = new ProjectRegistry(dir, Path.Combine(machine, "scratch"));
            var o = J(ProjectHttp.Open(reg, machine, new OpenReq(Path.Combine(dir, "P.assembly.json"), "t1")));
            var ctx = reg.Get((string)o["handle"]!)!;
            var miss = J(ProjectHttp.StyleRead(ctx, "P.style.json"));
            True(!(bool)miss["ok"]! && (bool)miss["notFound"]!, "not there yet: notFound");
            var s = J(ProjectHttp.StyleSave(ctx, new StyleSaveReq("P.style.json", demoStyle.Replace("\r\n", "\n"))));
            True((bool)s["ok"]!, s.ToJsonString());
            True(File.ReadAllText(Path.Combine(dir, "P.style.json")).Contains("\r\n"), "written with CRLF");
            var rd = J(ProjectHttp.StyleRead(ctx, "P.style.json"));
            True((bool)rd["ok"]! && ((string)rd["text"]!).Contains("GRAVEL"), "read back");
            True((bool)J(ProjectHttp.StyleSave(ctx, new StyleSaveReq(@"lib\sub.style.json", "{}")))["ok"]!, "subfolder");
            foreach (var bad in new[] { "P.json", "P.cs", @"C:\x.style.json", @"..\outside.style.json", ".style.json", "" })
            {
                True(!(bool)J(ProjectHttp.StyleSave(ctx, new StyleSaveReq(bad, "{}")))["ok"]!, "save must refuse " + bad);
                True(!(bool)J(ProjectHttp.StyleRead(ctx, bad))["ok"]!, "read must refuse " + bad);
            }
            True(!(bool)J(ProjectHttp.StyleSave(ctx, new StyleSaveReq("P.style.json", "{bad")))["ok"]!, "not JSON");
            True(!(bool)J(ProjectHttp.StyleSave(ctx, new StyleSaveReq("P.style.json", "[1]")))["ok"]!, "not an object");
            // outside the folder: only after the project references it (Open style file… = relink)
            var shared = Path.Combine(TempRoot, "ep", "shared"); Directory.CreateDirectory(shared);
            File.WriteAllText(Path.Combine(shared, "std.style.json"), demoStyle);
            True(!(bool)J(ProjectHttp.StyleRead(ctx, @"..\shared\std.style.json"))["ok"]!, "not referenced yet");
            var rl = J(ProjectHttp.Relink(ctx, new RelinkReq(Path.Combine(shared, "std.style.json"), null)));
            Eq(@"..\shared\std.style.json", (string?)rl["file"], "relink gives a relative path");
            True((bool)J(ProjectHttp.StyleRead(ctx, @"..\shared\std.style.json"))["ok"]!, "referenced: readable");
            True((bool)J(ProjectHttp.StyleSave(ctx, new StyleSaveReq(@"..\shared\std.style.json", demoStyle)))["ok"]!, "referenced: writable");
            // second tab on the same project = read-only
            var o2 = J(ProjectHttp.Open(reg, machine, new OpenReq(Path.Combine(dir, "P.assembly.json"), "t2")));
            var ro = reg.Get((string)o2["handle"]!)!;
            True(ro.ReadOnly, "second tab read-only");
            True((bool)J(ProjectHttp.StyleRead(ro, "P.style.json"))["ok"]!, "read-only tab can read");
            True(!(bool)J(ProjectHttp.StyleSave(ro, new StyleSaveReq("P.style.json", "{}")))["ok"]!, "read-only tab cannot save");
            // no project file (scratch)
            var scratch = reg.Open(null, "t3");
            True(!(bool)J(ProjectHttp.StyleSave(scratch, new StyleSaveReq("x.style.json", "{}")))["ok"]!, "scratch: Save project first");
        });

        test("project file: styleFile relative only; a missing style file is listed (kind style) and never blocks opening; Save as rebases it", () =>
        {
            var dir = Proj("pf", "gone.style.json");
            var r = ProjectFile.Open(File.ReadAllText(Path.Combine(dir, "P.assembly.json")), dir);
            var m = r.Missing.Single();
            Eq("style", m.Kind, "kind"); Eq("", m.ItemId, "no item"); Eq("gone.style.json", m.File, "file");
            Eq("gone.style.json", ProjectFile.Str(r.Content["styleFile"]), "key kept");
            var ok = JsonNode.Parse("""{"version":3,"assemblies":[],"styleFile":"lib\\a.style.json"}""")!.AsObject();
            Eq(null, ProjectFile.Validate(ok), "relative ok");
            foreach (var bad in new[] { @"C:\\a.style.json", "a.json", "" })
                True(ProjectFile.Validate(JsonNode.Parse($$"""{"version":3,"assemblies":[],"styleFile":"{{bad}}"}""")!.AsObject()) != null, "must refuse " + bad);
            var c = JsonNode.Parse("""{"version":3,"assemblies":[],"styleFile":"P.style.json"}""")!.AsObject();
            Eq(0, ProjectFile.Rebase(c, dir, Path.Combine(TempRoot, "pf", "copy")).Count, "rebase");
            Eq(@"..\proj\P.style.json", ProjectFile.Str(c["styleFile"]), "Save as: path from the new folder");
            True(ProjectFile.Referenced(c, Path.Combine(TempRoot, "pf", "copy")).Contains(Path.Combine(dir, "P.style.json")), "referenced");
        });

        test("Pack: an outside style file is copied to ext\\ and the path rewritten in the zip only; the default {project}.style.json goes in too", () =>
        {
            var dir = Proj("pack", @"..\shared\std.style.json");
            var shared = Path.Combine(TempRoot, "pack", "shared"); Directory.CreateDirectory(shared);
            File.WriteAllText(Path.Combine(shared, "std.style.json"), demoStyle);
            var pf = Path.Combine(dir, "P.assembly.json");
            var text = File.ReadAllText(pf);
            var c = JsonNode.Parse(text)!.AsObject();
            var reg = new ProjectRegistry(dir, Path.Combine(TempRoot, "pack", "scratch"));
            var ctx = reg.Open(pf, "t1", ProjectFile.Referenced(c, dir));
            var now = new DateTime(2026, 11, 17);
            var dry = ProjectPack.Pack(ctx, new PackReq(c, null, false, true), now);
            True(dry.Ok, dry.Message ?? "");
            Eq("P.assembly.json,ext/std.style.json", string.Join(",", dry.Entries), "entries");
            Eq(@"..\shared\std.style.json>ext\std.style.json", string.Join(",", dry.Outside.Select(o => o.File + ">" + o.PackedAs)), "outside");
            var outZip = Path.Combine(TempRoot, "pack", "P.zip");
            True(ProjectPack.Pack(ctx, new PackReq(c, outZip), now).Ok, "pack");
            using (var z = System.IO.Compression.ZipFile.OpenRead(outZip))
            {
                using var sr = new StreamReader(z.GetEntry("P/P.assembly.json")!.Open());
                Eq(@"ext\std.style.json", ProjectFile.Str(JsonNode.Parse(sr.ReadToEnd())!["styleFile"]), "path in the zip");
                True(z.GetEntry("P/ext/std.style.json") != null, "file in the zip");
            }
            Eq(text, File.ReadAllText(pf), "project file not touched");
            Eq(@"..\shared\std.style.json", ProjectFile.Str(c["styleFile"]), "content not touched");
            // missing style file: reported, not blocking
            var c2 = JsonNode.Parse("""{"version":3,"assemblies":[],"styleFile":"gone.style.json"}""")!.AsObject();
            var d2 = ProjectPack.Pack(ctx, new PackReq(c2, null, false, true), now);
            True(d2.Ok && d2.Missing.Contains("gone.style.json"), "missing listed");
            // no key: the default name beside the project file
            File.WriteAllText(Path.Combine(dir, "P.style.json"), demoStyle);
            var c3 = JsonNode.Parse("""{"version":3,"assemblies":[]}""")!.AsObject();
            True(ProjectPack.Pack(ctx, new PackReq(c3, null, false, true), now).Entries.Contains("P.style.json"), "default style file");
            // two outside files with the same name: the suffix goes before ".style.json" so the copy is still a style file
            Eq("ext/std-2.style.json", ProjectPack.ExtName("std.style.json", 2), "style suffix");
            Eq("ext/o-3.cs", ProjectPack.ExtName("o.cs", 3), ".cs suffix");
        });
    }

    static void True(bool c, string msg) { if (!c) throw new Exception(msg); }
    static void Eq<T>(T e, T a, string what) { if (!Equals(e, a)) throw new Exception($"{what}: expected {e}, got {a}"); }
    static string FindRoot()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d != null && !File.Exists(Path.Combine(d.FullName, "CLAUDE.md"))) d = d.Parent;
        return d?.FullName ?? throw new Exception("repo folder not found");
    }
}
