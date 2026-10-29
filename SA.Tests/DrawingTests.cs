// ทดสอบตัวสร้างโค้ดของ SA Drawing Studio (SA.Web/Drawing)
//   1) ผลจากตัวคำนวณ JS ของเว็บ (node SA.Tests/js/eval-cli.js) ต้องตรงกับผลรันโค้ด C# ที่สร้าง กับตัวจำลอง
//      กรณีทดสอบอยู่ใน SA.Tests/js/drawing-cases.json (เพิ่มกรณีได้ที่นั่น)
//   2) แทนที่ช่วง SA-DRAWING ซ้ำได้ผลเดิม และส่วนนอกช่วงไม่เปลี่ยน

using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Nodes;
using SA.Drawing;

static class DrawingTests
{
    public static void Run(Action<string, Action> test)
    {
        string root = FindRoot();
        string casesPath = Path.Combine(root, "SA.Tests", "js", "drawing-cases.json");
        var cases = JsonNode.Parse(File.ReadAllText(casesPath))!.AsArray();
        for (int i = 0; i < cases.Count; i++)
            if (cases[i]!["copySpecFrom"] is JsonNode from) cases[i]!["spec"] = cases[(int)from]!["spec"]!.DeepClone();

        JsonArray? js = null;
        string? nodeError = null;
        try { js = RunNode(root, casesPath); }
        catch (Exception e) { nodeError = e.Message; }

        var compiler = new SubassemblyCompiler();
        var runner = new SubassemblyRunner();

        Console.WriteLine("\nโค้ดที่สร้างจากการวาด: ผล JS ต้องตรงกับผลรันโค้ด C#");
        for (int i = 0; i < cases.Count; i++)
        {
            var c = cases[i]!;
            int k = i;
            test((string)c["name"]!, () =>
            {
                if (js == null) throw new Exception("รัน node ไม่ได้: " + nodeError);
                var specJson = c["spec"]!.ToJsonString();
                var spec = DrawingSpec.Parse(specJson);
                var src = CodeGenerator.GenerateFile(spec, specJson, spec.ClassName + ".cs");

                var compiled = compiler.Compile(src, spec.ClassName + ".cs");
                if (!compiled.Success)
                    throw new Exception("คอมไพล์ไม่ผ่าน: " + string.Join(" | ", compiled.Diagnostics.Where(d => d.Severity == "Error").Select(d => $"({d.Line}) {d.Message}")));
                if (compiled.Classes.Count != 1) throw new Exception($"ต้องมี subassembly 1 class ได้ {compiled.Classes.Count}");

                var values = new Dictionary<string, JsonElement>();
                if (c["values"] is JsonObject vo)
                    foreach (var (key, v) in vo) values[key] = JsonDocument.Parse(v!.ToJsonString()).RootElement;
                var world = new WorldInput
                {
                    Surface = c["surface"]!.AsArray().Select(p => new SurfacePt((double)p!["x"]!, (double)p["y"]!)).ToList(),
                    SurfaceAssigned = c["surfaceAssigned"] is not JsonNode sa || (bool)sa,
                    ExtendEnds = c["extendEnds"] is not JsonNode ee || (bool)ee,
                    LayoutMode = c["layout"] is JsonNode lm && (bool)lm,
                    OriginElevation = 100
                };
                var o = runner.Run(compiled.Classes[0], values, world);
                if (o.Exception != null) throw new Exception("โค้ดที่สร้างโยน exception: " + JsonSerializer.Serialize(o.Exception));
                Compare(js[k]!, o);
            });
        }

        Console.WriteLine("\nช่วง SA-DRAWING: แทนที่ซ้ำได้ ส่วนนอกช่วงไม่เปลี่ยน");
        test("แทนที่ช่วงเดิมด้วยของใหม่ ส่วนอื่นไม่เปลี่ยนแม้แต่ไบต์เดียว / ทำซ้ำได้ผลเดิม", () =>
        {
            var json1 = cases[0]!["spec"]!.ToJsonString();
            var file = CodeGenerator.GenerateFile(DrawingSpec.Parse(json1), json1, "Crest.cs");
            // ผู้ใช้เขียนโค้ดเพิ่มนอกช่วงป้าย
            file = file.Replace("// ไม่มี output parameter", "// ไม่มี output parameter\r\n            // ผู้ใช้เขียนเอง: ห้ามหาย");
            var b1 = CodeGenerator.FindBlock(file) ?? throw new Exception("หาช่วงป้ายไม่เจอ");
            if (!CodeGenerator.BlockMatchesSpec(b1)) throw new Exception("ช่วงที่เพิ่งสร้างต้องตรงกับ sa-spec");
            if (b1.SpecJson == null || JsonNode.Parse(b1.SpecJson)!.ToJsonString() != JsonNode.Parse(json1)!.ToJsonString()) throw new Exception("อ่าน sa-spec กลับมาไม่ตรง");

            var spec2 = JsonNode.Parse(json1)!;
            spec2["params"]![1]!["default"] = 5.5;
            var json2 = spec2.ToJsonString();
            var file2 = CodeGenerator.ReplaceBlock(file, b1, CodeGenerator.GenerateBlock(DrawingSpec.Parse(json2), json2, b1.Indent));
            var b2 = CodeGenerator.FindBlock(file2)!;
            if (file2[..b2.Start] != file[..b1.Start] || file2[b2.End..] != file[b1.End..]) throw new Exception("ส่วนนอกช่วงป้ายเปลี่ยน");
            if (!file2.Contains("ผู้ใช้เขียนเอง: ห้ามหาย")) throw new Exception("โค้ดของผู้ใช้หาย");
            if (!b2.Text.Contains("5.5")) throw new Exception("ช่วงใหม่ไม่มีค่าใหม่");
            var file3 = CodeGenerator.ReplaceBlock(file2, b2, CodeGenerator.GenerateBlock(DrawingSpec.Parse(json2), json2, b2.Indent));
            if (file3 != file2) throw new Exception("save ซ้ำแล้วไฟล์เปลี่ยน");
            if (CodeGenerator.MissingCalls(file2, DrawingSpec.Parse(json2)).Count != 0) throw new Exception("ไฟล์ใหม่ต้องมีบรรทัดเรียกครบ");
        });
        test("แก้ช่วงป้ายด้วยมือ -> ตรวจได้ว่าไม่ตรงกับ sa-spec", () =>
        {
            var json = cases[0]!["spec"]!.ToJsonString();
            var file = CodeGenerator.GenerateFile(DrawingSpec.Parse(json), json, "Crest.cs");
            var edited = file.Replace("Pt? P2 = Delta(", "Pt? P2 = /* แก้มือ */ Delta(");
            if (CodeGenerator.BlockMatchesSpec(CodeGenerator.FindBlock(edited)!)) throw new Exception("ต้องตรวจเจอว่าถูกแก้");
        });
        test("ไฟล์ LF ล้วน: แทนที่แล้วยังเป็น LF", () =>
        {
            var json = cases[0]!["spec"]!.ToJsonString();
            var lf = CodeGenerator.GenerateFile(DrawingSpec.Parse(json), json, "Crest.cs").Replace("\r\n", "\n");
            var b = CodeGenerator.FindBlock(lf)!;
            var r = CodeGenerator.ReplaceBlock(lf, b, CodeGenerator.GenerateBlock(DrawingSpec.Parse(json), json, b.Indent));
            if (r.Contains('\r')) throw new Exception("มี CR หลุดเข้ามา");
        });
        test("object → บรรทัดโค้ด ครบทุกชนิด (polar, polygon, โค้ง, Fillet, กลุ่มหมุน, auxiliary) ในทุกกรณีทดสอบ", () =>
        {
            foreach (var c in cases)
            {
                if (c!["spec"] == null) continue;
                var json = c["spec"]!.ToJsonString();
                var s = DrawingSpec.Parse(json);
                var src = CodeGenerator.GenerateFile(s, json, "Map.cs");
                var map = CodeGenerator.SourceMap(src);
                var lines = src.Replace("\r\n", "\n").Split('\n');
                foreach (var id in s.Points.Select(p => p.Id).Concat(s.Links.Select(l => l.Id)).Concat(s.Shapes.Select(x => x.Id)))
                {
                    if (!map.TryGetValue(id, out var at) || at.Count == 0) throw new Exception($"{s.ClassName}: {id} ไม่มีบรรทัดในโค้ด");
                    foreach (var n in at)
                        if (!System.Text.RegularExpressions.Regex.IsMatch(lines[n - 1], $@"\b{id}\b"))
                            throw new Exception($"{s.ClassName}: {id} ชี้บรรทัด {n} ที่ไม่มี {id}: {lines[n - 1].Trim()}");
                }
            }
        });
        test("ชื่อ parameter ที่โค้ดใช้เอง (เช่น F, P1, cs) ใช้ไม่ได้", () =>
        {
            var spec = JsonNode.Parse(cases[0]!["spec"]!.ToJsonString())!;
            spec["params"]![1]!["name"] = "F";
            try { CodeGenerator.GenerateFile(DrawingSpec.Parse(spec.ToJsonString()), spec.ToJsonString(), "x.cs"); }
            catch (FormatException) { return; }
            throw new Exception("ต้องไม่ยอมให้ตั้งชื่อ F");
        });
    }

    // เทียบผล: จุดที่หาได้ตามลำดับใน spec, ตามด้วยจุดกลางของ link ที่วิ่งตามผิวดิน; link / shape ตามลำดับ
    private static void Compare(JsonNode js, RunOutput o)
    {
        const double tol = 1e-6;
        var exp = new List<(double X, double Y, string What)>();
        foreach (var p in js["points"]!.AsArray())    // จุด auxiliary ไม่ Points.Add
            if (p!["err"] == null && !(p["auxiliary"] is JsonNode c && (bool)c)) exp.Add(((double)p["x"]!, (double)p["y"]!, (string)p["id"]!));
        foreach (var l in js["links"]!.AsArray())
        {
            if (l!["err"] != null) continue;
            // เส้นโค้งแตกเป็นท่อน: ท่อนแรกมี mids = จุดระหว่างทางของทั้งโค้ง
            if (l["mids"] is JsonArray mids)
            {
                for (int i = 0; i < mids.Count; i++) exp.Add(((double)mids[i]![0]!, (double)mids[i]![1]!, $"{l["id"]} จุดบนโค้ง {i + 1}"));
                continue;
            }
            var path = l["path"]!.AsArray();
            for (int i = 1; i < path.Count - 1; i++) exp.Add(((double)path[i]![0]!, (double)path[i]![1]!, $"{l["id"]} จุดกลาง {i}"));
        }
        // straight link ไม่มีจุดกลาง -> จำนวนจุดกลางที่คาด = followSurface + จุดบนโค้ง
        if (o.Points.Count != exp.Count)
            throw new Exception($"จำนวนจุด: JS {exp.Count} / C# {o.Points.Count} — C#: {string.Join(" ", o.Points.Select(p => $"({p.X:0.###},{p.Y:0.###})"))}");
        for (int i = 0; i < exp.Count; i++)
            if (Math.Abs(exp[i].X - o.Points[i].X) > tol || Math.Abs(exp[i].Y - o.Points[i].Y) > tol)
                throw new Exception($"{exp[i].What}: JS ({exp[i].X:0.######}, {exp[i].Y:0.######}) / C# ({o.Points[i].X:0.######}, {o.Points[i].Y:0.######})");

        var jl = js["links"]!.AsArray().Where(l => l!["err"] == null).ToList();
        if (jl.Count != o.Links.Count) throw new Exception($"จำนวน link: JS {jl.Count} / C# {o.Links.Count}");
        for (int i = 0; i < jl.Count; i++)
        {
            var path = jl[i]!["path"]!.AsArray();
            var idx = (int[])o.Links[i].GetType().GetProperty("pts")!.GetValue(o.Links[i])!;
            if (idx.Length != path.Count) throw new Exception($"{jl[i]!["id"]}: จำนวนจุด JS {path.Count} / C# {idx.Length}");
            for (int k = 0; k < idx.Length; k++)
                if (Math.Abs((double)path[k]![0]! - o.Points[idx[k]].X) > tol || Math.Abs((double)path[k]![1]! - o.Points[idx[k]].Y) > tol)
                    throw new Exception($"{jl[i]!["id"]} จุดที่ {k} ไม่ตรง");
        }

        var js_ = js["shapes"]!.AsArray().Where(s => s!["err"] == null).ToList();
        if (js_.Count != o.Shapes.Count) throw new Exception($"จำนวน shape: JS {js_.Count} / C# {o.Shapes.Count}");
        for (int i = 0; i < js_.Count; i++)
        {
            var poly = js_[i]!["poly"] as JsonArray;
            var cpoly = (int[]?)o.Shapes[i].GetType().GetProperty("polygon")!.GetValue(o.Shapes[i]);
            if ((poly == null) != (cpoly == null)) throw new Exception($"{js_[i]!["id"]}: รูปปิด JS {poly != null} / C# {cpoly != null}");
            if (poly == null) continue;
            var a = poly.Select(p => $"{(double)p![0]!:0.######},{(double)p[1]!:0.######}").OrderBy(s => s);
            var b = cpoly!.Select(k => $"{o.Points[k].X:0.######},{o.Points[k].Y:0.######}").OrderBy(s => s);
            if (!a.SequenceEqual(b)) throw new Exception($"{js_[i]!["id"]}: จุดของรูปไม่ตรง");
        }

        bool jw = (int)js["issues"]! > 0, cw = o.Issues.Count > 0;
        if (jw != cw) throw new Exception($"warning: JS {(int)js["issues"]!} / C# {o.Issues.Count} ({string.Join(" | ", o.Issues.Select(x => x.Message))})");
    }

    private static JsonArray RunNode(string root, string casesPath)
    {
        var psi = new ProcessStartInfo("node", $"\"{Path.Combine(root, "SA.Tests", "js", "eval-cli.js")}\" \"{casesPath}\"")
        { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, StandardOutputEncoding = System.Text.Encoding.UTF8 };
        using var p = Process.Start(psi)!;
        var stdout = p.StandardOutput.ReadToEnd();
        var stderr = p.StandardError.ReadToEnd();
        p.WaitForExit();
        if (p.ExitCode != 0) throw new Exception(stderr);
        return JsonNode.Parse(stdout)!.AsArray();
    }

    private static string FindRoot()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d != null && !File.Exists(Path.Combine(d.FullName, "SubassemblyViewer.sln"))) d = d.Parent;
        return d?.FullName ?? throw new Exception("หาโฟลเดอร์โปรเจกต์ไม่เจอ");
    }
}
