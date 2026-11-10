// Shapes must fill like Civil 3D (round 6 M5 finding): Civil 3D walks the links of Shapes.Add in array order, so the
// generated code must hand them over as one closed chain (ChainLinks). The simulator walks them the same way (ShapeWalk).
//   1. The shim is not more lenient than Civil 3D: the old generated files (shape links in spec order) show the broken fill.
//   2. Regenerating every locked fixture and demo from its sa-spec: every shape is a closed, non-self-intersecting polygon
//      on many grounds, Side Right and Left.

using System.Text.Json;
using SA.Drawing;

static class ShapeChainTests
{
    record Ground(string Name, List<SurfacePt> Surface, bool Layout = false, bool Assigned = true);

    static readonly string[] Files =
    {
        Path.Combine("SA.Tests", "fixtures", "round6", "pavement-assembly.cs"),
        Path.Combine("SA.Tests", "fixtures", "round6", "base_rock-pitching-web.cs"),
        Path.Combine("SA.Tests", "fixtures", "round6", "body_rock-pitching-web.cs"),
        Path.Combine("SA.Tests", "fixtures", "base_rock-pitching-web.cs"),
        Path.Combine("SA.Tests", "fixtures", "body_rock-pitching-web.cs"),
        Path.Combine("tests-civil3d", "round3-demo.cs"),
        Path.Combine("tests-civil3d", "round4-demo.cs"),
        Path.Combine("tests-civil3d", "round4c-base.cs"),
        Path.Combine("tests-civil3d", "round4c-body.cs"),
        Path.Combine("tests-civil3d", "round5-demo.cs"),
        Path.Combine("tests-civil3d", "round5b-demo.cs"),
    };

    public static void Run(Action<string, Action> test)
    {
        string root = FindRoot();
        var compiler = new SubassemblyCompiler();
        var runner = new SubassemblyRunner();
        Console.WriteLine("\nShape: link ต่อกันเป็นวงแบบที่ Civil 3D ต้องการ (ShapeWalk / ChainLinks)");

        List<SurfacePt> S(params (double X, double Y)[] p) => p.Select(q => new SurfacePt(q.X, q.Y)).ToList();
        var grounds = new List<Ground>
        {
            new("flat +3", S((-80, 3), (80, 3))),
            new("flat 0", S((-80, 0), (80, 0))),
            new("flat -1", S((-80, -1), (80, -1))),
            new("flat -2.5", S((-80, -2.5), (80, -2.5))),
            new("flat -5", S((-80, -5), (80, -5))),
            new("flat -9", S((-80, -9), (80, -9))),
            new("flat -20", S((-80, -20), (80, -20))),
            new("rising", S((-80, -30), (80, 30))),
            new("falling", S((-80, 30), (80, -30))),
            new("V", S((-80, -12), (0, -1), (80, -12))),
            new("ridge", S((-80, -12), (0, 2), (80, -12))),
            new("rough", S((-80, 0), (-3, -1), (0, -2.6), (2, -1), (4.3, -2.4), (8, -6), (10, -4.5), (14, -7), (80, -9))),
            new("Layout", S((-80, -3), (80, -3)), Layout: true),
            new("no target", S((-80, -3), (80, -3)), Assigned: false),
        };

        test("ตัวจำลองไม่หลวมกว่า Civil 3D: body S2 รุ่นเก่า (link ตามลำดับ spec) = ต่อไม่เป็นวง + เตือน", () =>
        {
            var src = File.ReadAllText(Path.Combine(root, "SA.Tests", "fixtures", "round6", "body_rock-pitching-web.cs"));
            var c = compiler.Compile(src, "body_rock-pitching-web.cs");
            if (!c.Success) throw new Exception("คอมไพล์ไม่ผ่าน");
            var o = runner.Run(c.Classes[0], Values(0), World(grounds[2], 0));
            var s2 = o.Shapes.FirstOrDefault(s => Get<string[]>(s, "codes").Contains("CompactedSoil")) ?? throw new Exception("ไม่มี shape CompactedSoil");
            if (Get<bool>(s2, "chained")) throw new Exception("S2 ต้องต่อไม่เป็นวง (Civil 3D ระบายไขว้)");
            if (!o.Issues.Any(i => i.Error == "ShapeLinksNotChained")) throw new Exception("ต้องมีเตือน ShapeLinksNotChained");
            var s1 = o.Shapes.First(s => Get<string[]>(s, "codes").Contains("RockPitching"));
            if (!Get<bool>(s1, "chained")) throw new Exception("S1 ต่อกันถูกอยู่แล้ว ต้อง chained");
        });

        foreach (var rel in Files)
        {
            test($"{Path.GetFileName(rel)}: สร้างใหม่จาก sa-spec · ทุก shape เป็นรูปปิดไม่ไขว้ ({grounds.Count} ผิวดิน × Right / Left)", () =>
            {
                var blk = CodeGenerator.FindBlock(File.ReadAllText(Path.Combine(root, rel))) ?? throw new Exception("ไม่มีช่วง SA-DRAWING");
                var spec = DrawingSpec.Parse(blk.SpecJson ?? throw new Exception("ไม่มี sa-spec"));
                var src = CodeGenerator.GenerateFile(spec, blk.SpecJson, spec.ClassName + ".cs");
                var c = compiler.Compile(src, spec.ClassName + ".cs");
                if (!c.Success) throw new Exception("คอมไพล์ไม่ผ่าน: " + string.Join(" | ", c.Diagnostics.Where(d => d.Severity == "Error").Select(d => $"({d.Line}) {d.Message}")));
                int shapes = 0;
                var known = new List<string>();
                foreach (var g in grounds)
                    foreach (int side in new[] { 0, 1 })
                    {
                        var o = runner.Run(c.Classes[0], Values(side), World(g, side));
                        string where = $"{g.Name} {(side == 0 ? "Right" : "Left")}";
                        if (o.Exception != null) throw new Exception($"{where}: exception {JsonSerializer.Serialize(o.Exception)}");
                        var bad = o.Issues.FirstOrDefault(i => i.Error == "ShapeLinksNotChained" || i.Message.Contains("ต่อกันไม่เป็นรูปปิด"));
                        if (bad != null) throw new Exception($"{where}: {bad.Message}");
                        foreach (var s in o.Shapes)
                        {
                            shapes++;
                            string sid = $"{where} shape [{string.Join(",", Get<string[]>(s, "codes"))}]";
                            if (!Get<bool>(s, "chained")) throw new Exception($"{sid}: link ไม่ต่อกันเป็นวง");
                            var poly = Get<int[]?>(s, "polygon") ?? throw new Exception($"{sid}: ไม่มีรูป");
                            var pts = poly.Select(i => (o.Points[i].X, o.Points[i].Y)).ToList();
                            // the links chain, but the geometry of the drawing itself crosses (not the generator's doing)
                            if (Crosses(pts) is not null) known.Add(sid);
                        }
                    }
                if (shapes == 0 && spec.Shapes.Count > 0) throw new Exception("spec มี shape แต่ไม่เกิดเลยสักกรณี");
                KnownCrossings.TryGetValue(Path.GetFileName(rel), out var allowed);
                var unexpected = known.Where(k => allowed == null || !allowed.Contains(k)).ToList();
                if (unexpected.Count > 0) throw new Exception($"รูปไขว้ {unexpected.Count} กรณี: {string.Join(" · ", unexpected)}");
                if (known.Count > 0) Console.WriteLine($"        (รูปไขว้ที่รู้แล้ว เป็นข้อจำกัดของแบบ {known.Count} กรณี: {string.Join(" · ", known)})");
            });
        }
    }

    // Shapes whose drawn geometry crosses itself on some grounds although the links chain correctly.
    // These are limits of the drawing (the user decides), listed in docs/civil3d-testing.md. Anything else crossing = failure.
    static readonly Dictionary<string, HashSet<string>> KnownCrossings = new()
    {
        // S3 (L49 L42 L61 L62 L63 L2 L59 L60): the slope to the ground from P35 / P5 and the Follow Surface link cross
        // when the ground is at the top level or sloping (locked copy from before the user's round 6 code edits)
        ["pavement-assembly.cs"] = new()
        {
            "flat 0 Right shape [sand]", "flat 0 Left shape [sand]", "rising Right shape [sand]",
            "rising Left shape [sand]", "falling Right shape [sand]", "falling Left shape [sand]",
        },
    };

    static Dictionary<string, JsonElement> Values(int side) => new() { ["Side"] = JsonDocument.Parse(side.ToString()).RootElement };

    static WorldInput World(Ground g, int side) => new()
    {
        Surface = g.Surface.Select(q => new SurfacePt(side == 1 ? -q.X : q.X, q.Y)).ToList(),
        SurfaceAssigned = g.Assigned, LayoutMode = g.Layout, ExtendEnds = true, OriginElevation = 100
    };

    // null = simple polygon · otherwise which edges cross (touching within 1e-9 does not count)
    static string? Crosses(List<(double X, double Y)> p)
    {
        // drop repeated points (zero-length edges)
        var q = new List<(double X, double Y)>();
        foreach (var a in p)
            if (q.Count == 0 || Math.Abs(q[^1].X - a.X) > 1e-9 || Math.Abs(q[^1].Y - a.Y) > 1e-9) q.Add(a);
        if (q.Count > 1 && Math.Abs(q[0].X - q[^1].X) < 1e-9 && Math.Abs(q[0].Y - q[^1].Y) < 1e-9) q.RemoveAt(q.Count - 1);
        int n = q.Count;
        if (n < 3) return "น้อยกว่า 3 จุด";
        double area = 0;
        for (int i = 0; i < n; i++) area += q[i].X * q[(i + 1) % n].Y - q[(i + 1) % n].X * q[i].Y;
        if (Math.Abs(area) < 1e-9) return "พื้นที่ 0";
        double Cr((double X, double Y) o, (double X, double Y) a, (double X, double Y) b) => (a.X - o.X) * (b.Y - o.Y) - (a.Y - o.Y) * (b.X - o.X);
        for (int i = 0; i < n; i++)
            for (int j = i + 1; j < n; j++)
            {
                if (j == i + 1 || (i == 0 && j == n - 1)) continue;   // neighbouring edges share a point
                var (a, b, c, d) = (q[i], q[(i + 1) % n], q[j], q[(j + 1) % n]);
                double d1 = Cr(c, d, a), d2 = Cr(c, d, b), d3 = Cr(a, b, c), d4 = Cr(a, b, d);
                if (((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9)))
                    return $"ขอบ {i}-{i + 1} กับ {j}-{(j + 1) % n} ที่ ({a.X:0.###},{a.Y:0.###})";
            }
        return null;
    }

    static T Get<T>(object o, string name) => (T)o.GetType().GetProperty(name)!.GetValue(o)!;

    static string FindRoot()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d != null && !File.Exists(Path.Combine(d.FullName, "SubassemblyViewer.sln"))) d = d.Parent;
        return d?.FullName ?? throw new Exception("หาโฟลเดอร์โปรเจกต์ไม่เจอ");
    }
}
