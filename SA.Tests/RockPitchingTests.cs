// รอบ 4c M6: ไฟล์ที่วาดใหม่ในเว็บ (tests-civil3d/round4c-*.cs — ไม่เขียนโค้ด) ต้องให้ผลเหมือนไฟล์จริงของผู้ใช้
//   base_rock-pitching.cs / body_rock-pitching.cs (อ่านอย่างเดียว — คอมไพล์จากข้อความในหน่วยความจำ ไม่แตะไฟล์)
//   รันทั้งคู่กับตัวจำลองบนผิวดินหลายแบบ × Side Right / Left × ชุดค่า parameter (รวมค่าต่ำกว่าขั้นต่ำ / ≤ 0)
//   เทียบ: จุด (พิกัด + point code) · link (ปลาย + link code) · shape (จุดของรูป + shape code) · มี error / เตือนเหมือนกัน
//   ไม่เทียบลำดับ (ลำดับ Points.Add / link ในไฟล์ที่วาดต่างจากไฟล์จริงได้ — ดูตาราง "ต่างกันตรงไหน" ใน README)

using System.Text.Json;
using SA.Drawing;

static class RockPitchingTests
{
    record Case(string Name, List<SurfacePt>? Surface, bool Layout = false, bool Assigned = true);

    public static void Run(Action<string, Action> test)
    {
        string root = FindRoot();
        var compiler = new SubassemblyCompiler();
        var runner = new SubassemblyRunner();
        Console.WriteLine("\nรอบ 4c: rock-pitching ที่วาดใหม่ในเว็บ = ไฟล์จริง (พิกัด + code ของจุด / link / shape)");

        List<SurfacePt> S(params (double X, double Y)[] p) => p.Select(q => new SurfacePt(q.X, q.Y)).ToList();
        var baseCases = new List<Case>
        {
            new("ดินสูงกว่าฐานทั้งหมด", S((-40, -1), (40, -1))),
            new("ดินต่ำกว่าฐานทั้งหมด", S((-40, -3.5), (40, -3.5))),
            new("ขรุขระ ตัดผ่านระดับฐานหลายครั้ง", S((-40, 0), (-2, -1.5), (0, -2.6), (2, -1), (4.3, -2.4), (8, -6), (10, -4.5), (14, -7), (40, -9))),
            new("ลาดเอียง (ต่อลงถึงดินสองข้าง)", S((-40, 5), (40, -11))),
            new("ต่อลงถึงดินข้างเดียว (นอก)", S((-40, 4.5), (40, -7.5))),
            new("รูป V (ต่อสองข้าง ขอบล่างตามดินกลางรูป)", S((-40, -9), (1, -1.5), (40, -9))),
            new("Layout mode", S((-40, -3.5), (40, -3.5)), Layout: true),
            new("ไม่ได้กำหนด Target Surface", S((-40, -3.5), (40, -3.5)), Assigned: false),
        };
        var bodyCases = new List<Case>
        {
            new("ดินสูงกว่าเส้นดินทั้งหมด (E = O)", S((-40, -1), (40, -1))),
            new("ดินต่ำทั้งหมด (ต่อเส้นปิดปลายลงถึงดิน)", S((-40, -9), (40, -9))),
            new("ลาดตัดเส้นดิน + ต่อที่ O", S((-40, 23), (40, -25))),
            new("ขรุขระ", S((-40, 0), (2, -1), (4, -3.5), (6, -2), (8, -6), (10, -4.5), (14, -7), (40, -9))),
            new("ช่วงกลางต่ำกว่าเส้นดิน แต่ที่ O ดินสูง (ไม่ต่อ)", S((-40, -0.5), (3, -1), (6, -5), (9, -4), (40, -3))),
            new("Layout mode", S((-40, -9), (40, -9)), Layout: true),
            new("ไม่ได้กำหนด Target Surface", S((-40, -9), (40, -9)), Assigned: false),
        };
        var baseParams = new List<Dictionary<string, double>>
        {
            new(),
            new() { ["Depth"] = 1.5 },                                // ต่ำกว่าขั้นต่ำ 2 -> เตือน + ใช้ 2
            new() { ["TopWidth"] = -1, ["SideSlope"] = 1 },           // ≤ 0 -> error + default
            new() { ["Depth"] = 3, ["SideSlope"] = 2, ["TopWidth"] = 3.5 },
        };
        var bodyParams = new List<Dictionary<string, double>>
        {
            new(),
            new() { ["MinSoilThickness"] = 0.5 },                     // ต่ำกว่าขั้นต่ำ 1 -> เตือน + ใช้ 1
            new() { ["Height"] = -1, ["RockThickness"] = 0.8 },       // ≤ 0 -> error + default
            new() { ["Height"] = 4, ["FaceSlope"] = 2, ["EndSlope"] = 2, ["MinSoilThickness"] = 1.5 },
        };

        foreach (var (name, real, drawn, cases, ps) in new[]
        {
            ("base", Path.Combine("SA.Tests", "fixtures", "base_rock-pitching.cs"), Path.Combine("tests-civil3d", "round4c-base.cs"), baseCases, baseParams),
            ("body", Path.Combine("SA.Tests", "fixtures", "body_rock-pitching.cs"), Path.Combine("tests-civil3d", "round4c-body.cs"), bodyCases, bodyParams),
            // รอบ 4e: ไฟล์ที่ Save จากเว็บไว้ข้างไฟล์จริง — parameter ชนิด Slope / Length · body จุดล่างในด้วย Extend to Surface (ไม่ใช่ min())
            ("base-web", Path.Combine("SA.Tests", "fixtures", "base_rock-pitching.cs"), Path.Combine("SA.Tests", "fixtures", "base_rock-pitching-web.cs"), baseCases, baseParams),
            ("body-web", Path.Combine("SA.Tests", "fixtures", "body_rock-pitching.cs"), Path.Combine("SA.Tests", "fixtures", "body_rock-pitching-web.cs"), bodyCases, bodyParams),
        })
        {
            CompiledSubassembly? a = null, b = null;
            string? err = null;
            try
            {
                a = compiler.Compile(File.ReadAllText(Path.Combine(root, real)), Path.GetFileName(real));
                b = compiler.Compile(File.ReadAllText(Path.Combine(root, drawn)), Path.GetFileName(drawn));
                if (!a.Success || !b.Success) err = "คอมไพล์ไม่ผ่าน: " + string.Join(" | ", a.Diagnostics.Concat(b.Diagnostics).Where(d => d.Severity == "Error").Select(d => d.Message));
            }
            catch (Exception e) { err = e.Message; }
            test($"{name}: ไฟล์ที่วาด {Path.GetFileName(drawn)} = sa-spec ของมัน (ไม่ได้แก้ด้วยมือ)", () =>
            {
                var blk = CodeGenerator.FindBlock(File.ReadAllText(Path.Combine(root, drawn))) ?? throw new Exception("ไม่มีช่วง SA-DRAWING");
                if (!CodeGenerator.BlockMatchesSpec(blk)) throw new Exception("ช่วง SA-DRAWING ไม่ตรงกับ sa-spec");
            });
            foreach (var c in cases)
                test($"{name}: {c.Name} (Right / Left × {ps.Count} ชุดค่า)", () =>
                {
                    if (err != null) throw new Exception(err);
                    foreach (int side in new[] { 0, 1 })
                        foreach (var p in ps)
                        {
                            var values = p.ToDictionary(kv => kv.Key, kv => JsonDocument.Parse(kv.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)).RootElement);
                            values["Side"] = JsonDocument.Parse(side.ToString()).RootElement;
                            var world = new WorldInput
                            {
                                Surface = c.Surface!.Select(q => new SurfacePt(side == 1 ? -q.X : q.X, q.Y)).ToList(),
                                SurfaceAssigned = c.Assigned, LayoutMode = c.Layout, ExtendEnds = true, OriginElevation = 100
                            };
                            var ra = runner.Run(a!.Classes[0], values, world);
                            var rb = runner.Run(b!.Classes[0], values, world);
                            string where = $"Side = {side} {string.Join(" ", p.Select(kv => $"{kv.Key} = {kv.Value}"))}";
                            if (ra.Exception != null || rb.Exception != null) throw new Exception($"{where}: exception {JsonSerializer.Serialize(ra.Exception ?? rb.Exception)}");
                            // ต่างกันที่รู้แล้ว (ตาราง "ต่างกันตรงไหน" ใน README): เส้นปิดปลายต่อลงไปชนดินเลย origin เข้าด้านใน
                            //   ไฟล์จริง = เตือน + เลิกใช้ผิวดิน (ขอบล่างเป็นเส้นความหนาขั้นต่ำ) · ที่วาด = เตือน + ไม่ต่อ แต่ขอบล่างยังตามดิน → ตรวจแค่ว่าเตือนทั้งคู่
                            if (name.StartsWith("body") && ra.Issues.Any(i => i.Message.Contains("เลย origin")))
                            {
                                if (!rb.Issues.Any(i => i.Message.Contains("ต่อลงถึงดิน"))) throw new Exception($"{where}: ไฟล์จริงเตือนเส้นปิดปลายเลย origin แต่ที่วาดไม่เตือน");
                                continue;
                            }
                            Same(ra, rb, where);
                        }
                });
        }

        // รอบ 5 M3: base แบบใช้ Variable DepthUsed (ถ้า Depth < 2 → 2 + เตือน) แทนขั้นต่ำในตาราง Parameter → ต้องได้ผลเหมือนไฟล์จริง
        test("base-web + Variable DepthUsed แทนขั้นต่ำ Depth (ทุกผิวดิน × Right / Left × 4 ชุดค่า)", () =>
        {
            var blk = CodeGenerator.FindBlock(File.ReadAllText(Path.Combine(root, Path.Combine("SA.Tests", "fixtures", "base_rock-pitching-web.cs")))) ?? throw new Exception("ไม่มีช่วง SA-DRAWING");
            var spec = System.Text.Json.Nodes.JsonNode.Parse(blk.SpecJson!)!;
            spec["className"] = "RockPitchingBaseVar";
            foreach (var p in spec["params"]!.AsArray()) if ((string)p!["name"]! == "Depth") p["min"] = null;
            foreach (var p in spec["points"]!.AsArray())
                foreach (var k in new[] { "dx", "dy" })
                    if (p!["def"]![k] is { } e) p["def"]![k] = System.Text.RegularExpressions.Regex.Replace((string)e!, @"\bDepth\b", "DepthUsed");
            spec["logic"] = System.Text.Json.Nodes.JsonNode.Parse("""
                { "conditions": [], "decisions": [], "branches": [],
                  "variables": [{ "id": "V1", "name": "DepthUsed", "kind": "double", "unit": "length", "expr": "Depth", "note": "ลึกขั้นต่ำ 2 m",
                                  "rules": [{ "when": "Depth < 2", "value": "2", "warn": "Depth = {Depth} m < 2 m ใช้ 2 m แทน", "error": "ValueTooSmall" }] }] }
                """);
            string json = spec.ToJsonString();
            string src = CodeGenerator.GenerateFile(DrawingSpec.Parse(json), json, "RockPitchingBaseVar.cs");
            if (!src.Contains("double DepthUsed = Depth;") || !src.Contains("if (Depth < 2.0) { Warn(cs, CorridorError.ValueTooSmall, \"Depth = \" + Depth + \" m < 2 m ใช้ 2 m แทน\"); DepthUsed = 2.0; }"))
                throw new Exception("โค้ด C# ของ DepthUsed ไม่เป็นบล็อก if อ่านง่ายตามที่ตกลง");
            var a = compiler.Compile(File.ReadAllText(Path.Combine(root, Path.Combine("SA.Tests", "fixtures", "base_rock-pitching.cs"))), "base_rock-pitching.cs");
            var b = compiler.Compile(src, "RockPitchingBaseVar.cs");
            if (!a.Success || !b.Success) throw new Exception("คอมไพล์ไม่ผ่าน: " + string.Join(" | ", b.Diagnostics.Where(d => d.Severity == "Error").Select(d => d.Message)));
            foreach (var c in baseCases)
                foreach (int side in new[] { 0, 1 })
                    foreach (var p in baseParams)
                    {
                        var values = p.ToDictionary(kv => kv.Key, kv => JsonDocument.Parse(kv.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)).RootElement);
                        values["Side"] = JsonDocument.Parse(side.ToString()).RootElement;
                        var world = new WorldInput { Surface = c.Surface!.Select(q => new SurfacePt(side == 1 ? -q.X : q.X, q.Y)).ToList(), SurfaceAssigned = c.Assigned, LayoutMode = c.Layout, ExtendEnds = true, OriginElevation = 100 };
                        var ra = runner.Run(a.Classes[0], values, world); var rb = runner.Run(b.Classes[0], values, world);
                        string where = $"{c.Name} Side = {side} {string.Join(" ", p.Select(kv => $"{kv.Key} = {kv.Value}"))}";
                        if (ra.Exception != null || rb.Exception != null) throw new Exception($"{where}: exception");
                        Same(ra, rb, where);
                    }
        });
    }

    // เทียบผลแบบไม่สนลำดับ: พิกัดปัด 5 ตำแหน่ง (−0 = 0)
    static void Same(RunOutput real, RunOutput drawn, string where)
    {
        static string N(double v) { double r = Math.Round(v, 5); return (r == 0 ? 0 : r).ToString("0.00000", System.Globalization.CultureInfo.InvariantCulture); }
        static string C(IEnumerable<string> c) => string.Join(",", c.Distinct().OrderBy(x => x, StringComparer.Ordinal));
        static string P(OutPt p) => $"({N(p.X)}, {N(p.Y)})";
        static T Get<T>(object o, string prop) => (T)o.GetType().GetProperty(prop)!.GetValue(o)!;
        void Diff(string what, List<string> x, List<string> y)
        {
            x.Sort(StringComparer.Ordinal); y.Sort(StringComparer.Ordinal);
            if (x.SequenceEqual(y)) return;
            var onlyX = x.Except(y).Take(4); var onlyY = y.Except(x).Take(4);
            throw new Exception($"{where}: {what} ไม่ตรง (ไฟล์จริง {x.Count} / ที่วาด {y.Count}) · มีแต่ไฟล์จริง: {string.Join(" ", onlyX)} · มีแต่ที่วาด: {string.Join(" ", onlyY)}");
        }
        Diff("จุด", real.Points.Select(p => P(p) + "[" + C(p.Codes) + "]").ToList(), drawn.Points.Select(p => P(p) + "[" + C(p.Codes) + "]").ToList());
        List<string> Links(RunOutput o) => o.Links.Select(l =>
        {
            var e = Get<int[]>(l, "pts").Select(i => P(o.Points[i])).OrderBy(x => x, StringComparer.Ordinal);
            return string.Join("-", e) + "[" + C(Get<string[]>(l, "codes")) + "]";
        }).ToList();
        Diff("link", Links(real), Links(drawn));
        List<string> Shapes(RunOutput o) => o.Shapes.Select(s =>
        {
            var poly = Get<int[]?>(s, "polygon");
            return C(Get<string[]>(s, "codes")) + ":" + (poly == null ? "ไม่ปิด" : string.Join(" ", poly.Select(i => P(o.Points[i])).OrderBy(x => x, StringComparer.Ordinal)));
        }).ToList();
        Diff("shape", Shapes(real), Shapes(drawn));
        bool Sev(RunOutput o) => o.Issues.Any(i => i.Level == "Severe");
        if (Sev(real) != Sev(drawn)) throw new Exception($"{where}: error (Severe) ไฟล์จริง {Sev(real)} / ที่วาด {Sev(drawn)}");
        if (real.Issues.Count > 0 != drawn.Issues.Count > 0)
            throw new Exception($"{where}: เตือน ไฟล์จริง [{string.Join(" | ", real.Issues.Select(i => i.Message))}] / ที่วาด [{string.Join(" | ", drawn.Issues.Select(i => i.Message))}]");
    }

    static string FindRoot()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d != null && !File.Exists(Path.Combine(d.FullName, "SubassemblyViewer.sln"))) d = d.Parent;
        return d?.FullName ?? throw new Exception("หาโฟลเดอร์โปรเจกต์ไม่เจอ");
    }
}
