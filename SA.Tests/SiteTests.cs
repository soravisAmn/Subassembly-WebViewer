// ทดสอบ "object → บรรทัดโค้ด" (Milestone 5 รอบ 2)
//   1) source map ของส่วนที่วาด (CodeGenerator.SourceMap) ตรงกับบรรทัดจริง ทั้งไฟล์ที่สร้างใหม่ และไฟล์ที่ช่วง SA-DRAWING อยู่กลางไฟล์
//   2) ตัวจำลองจำบรรทัดที่เรียก Points / Links / Shapes.Add ผ่านฟังก์ชันช่วยได้ครบสาย และตรงกับไฟล์จริงแม้ RunGuard แทรกโค้ด
//   3) วัดเวลาที่เพิ่มจากการเก็บบรรทัด

using System.Diagnostics;
using SA.Drawing;
using SA.Shim;

static class SiteTests
{
    const string SpecJson = """
    {"version":1,"className":"MapTest","namespace":"T","params":[{"name":"Side","kind":"long","default":0},{"name":"Width","kind":"double","default":2}],
     "targets":[{"name":"TargetSurface","type":"Surface"}],
     "points":[{"id":"P1","codes":[],"def":{"type":"origin"}},{"id":"P2","codes":["Top"],"def":{"type":"delta","from":"P1","dx":"Width","dy":"0"}},
               {"id":"P3","codes":[],"def":{"type":"slopeToSurface","from":"P2","slope":"-1/2","dir":1,"target":"TargetSurface"}}],
     "links":[{"id":"L1","points":["P1","P2"],"codes":["Top"]},{"id":"L2","type":"followSurface","from":"P2","to":"P3","target":"TargetSurface","codes":[]}],
     "shapes":[{"id":"S1","links":["L1","L2"],"codes":[]}],"side":{"param":"Side","mirror":true}}
    """;

    // ไฟล์เขียนเอง: เรียกผ่านฟังก์ชันช่วย + loop (RunGuard แทรก Tick ต้น method / loop) + local function
    const string Hand = """
    using Autodesk.Civil.Runtime;
    using Autodesk.Civil.ApplicationServices;
    namespace T
    {
        public class Hand
        {
            public void Draw()
            {
                var cs = CivilApplication.ActiveDocument.CorridorState;
                DrawImplement(cs);
            }
            private void DrawImplement(CorridorState cs)
            {
                Point a = AddPoint(cs, 0, 0, "A");          // MARK-A
                Point b = null;
                for (int i = 1; i <= 2; i++)
                {
                    b = AddPoint(cs, i, -i, "B" + i);        // MARK-B
                }
                Link l = cs.Links.Add(new[] { a, b }, "L");  // MARK-L
                Point Local() { return cs.Points.Add(5, 5, "C"); }   // MARK-C
                Local();
            }
            private static Point AddPoint(CorridorState cs, double x, double y, string code)
            {
                return cs.Points.Add(x, y, code);           // MARK-ADD
            }
        }
    }
    """;

    static int LineOf(string src, string mark) =>
        src.Replace("\r\n", "\n").Split('\n').Select((l, i) => (l, i)).First(t => t.l.Contains(mark)).i + 1;
    static int[] LinesWith(string src, string text) =>
        src.Replace("\r\n", "\n").Split('\n').Select((l, i) => (l, i)).Where(t => t.l.Contains(text)).Select(t => t.i + 1).ToArray();

    public static void Run(Action<string, Action> test)
    {
        void True(bool c, string m) { if (!c) throw new Exception(m); }
        void Eq<T>(T e, T a, string w) { if (!Equals(e, a)) throw new Exception($"{w}: คาด {e} ได้ {a}"); }

        Console.WriteLine("\nobject → บรรทัดโค้ด");
        var spec = DrawingSpec.Parse(SpecJson);

        test("source map ของไฟล์ที่สร้างใหม่ ชี้บรรทัดที่มี id นั้นจริง", () =>
        {
            var src = CodeGenerator.GenerateFile(spec, SpecJson, "MapTest.cs");
            var map = CodeGenerator.SourceMap(src);
            Eq(string.Join(",", LinesWith(src, "Pt? P2 = ").Concat(LinesWith(src, "AddPoint(cs, P2"))), string.Join(",", map["P2"]), "P2");
            Eq(LinesWith(src, "AddLink(cs, \"L1\"")[0], map["L1"].Single(), "L1");
            Eq(LinesWith(src, "FollowSurface(cs, \"L2\"")[0], map["L2"].Single(), "L2 (ตามผิวดิน)");
            Eq(LinesWith(src, "AddShape(cs, \"S1\"")[0], map["S1"].Single(), "S1");
            Eq(2, map["P1"].Count, "P1 มีบรรทัดคำนวณ + บรรทัดเพิ่ม");
        });

        test("source map ของไฟล์ที่ช่วง SA-DRAWING อยู่กลางไฟล์ (มีโค้ดก่อนหน้า 40 บรรทัด)", () =>
        {
            var block = CodeGenerator.GenerateBlock(spec, SpecJson, "    ");
            var before = string.Concat(Enumerable.Range(1, 40).Select(i => $"// บรรทัดของผู้ใช้ {i}\r\n"));
            var src = before + block + "// ท้ายไฟล์\r\n";
            var map = CodeGenerator.SourceMap(src);
            Eq(LinesWith(src, "AddLink(cs, \"L1\"")[0], map["L1"].Single(), "L1");
            True(map["L1"].Single() > 40, "ต้องนับบรรทัดก่อนช่วงด้วย");
            // แทนที่ช่วงเดิมด้วยของใหม่ (แบบตอน Save) แล้วยังตรง
            var replaced = CodeGenerator.ReplaceBlock(src, CodeGenerator.FindBlock(src)!, block);
            Eq(LinesWith(replaced, "AddShape(cs, \"S1\"")[0], CodeGenerator.SourceMap(replaced)["S1"].Single(), "S1 หลังแทนที่");
        });

        var compiler = new SubassemblyCompiler();
        var runner = new SubassemblyRunner();
        var world = new SimWorld { Surface = new() { (-50.0, 99.0), (50.0, 99.0) } };

        test("ไฟล์เขียนเอง: จำบรรทัดที่เรียก Add ครบสาย (ฟังก์ชันช่วย, loop, local function) ตรงกับไฟล์จริง", () =>
        {
            var c = compiler.Compile(Hand, "hand.cs");
            True(c.Success, "คอมไพล์ไม่ผ่าน: " + string.Join(" | ", c.Diagnostics.Select(d => d.Message)));
            var o = runner.Run(c.Classes[0], null, world, 0, 100, 100);
            True(o.Exception == null, "exception");
            int add = LineOf(Hand, "MARK-ADD"), ma = LineOf(Hand, "MARK-A"), mb = LineOf(Hand, "MARK-B"), draw = LineOf(Hand, "DrawImplement(cs);");
            string S(OutPt p) => string.Join(" ← ", p.Sites!.Select(s => $"{s.Line} {s.Method}"));
            Eq($"{add} AddPoint ← {ma} DrawImplement ← {draw} Draw", S(o.Points[0]), "จุด A");
            Eq($"{add} AddPoint ← {mb} DrawImplement ← {draw} Draw", S(o.Points[2]), "จุด B2 (ใน loop)");
            Eq($"{LineOf(Hand, "MARK-C")} Local", S(o.Points[3]).Split(" ← ")[0], "local function");
            var link = System.Text.Json.JsonSerializer.SerializeToElement(o.Links[0]);
            Eq(LineOf(Hand, "MARK-L"), link.GetProperty("sites")[0].GetProperty("Line").GetInt32(), "link");
        });

        test("ปิดการเก็บ = ไม่มี sites", () =>
        {
            var c = compiler.Compile(Hand, "hand.cs");
            var o = runner.Run(c.Classes[0], null, world, 0, 100, 100, sites: false);
            True(o.Points.All(p => p.Sites == null), "ต้องไม่มี sites");
        });

        test("เวลาที่เพิ่มจากการเก็บบรรทัด (1000 จุด)", () =>
        {
            const string many = """
            using Autodesk.Civil.Runtime;
            using Autodesk.Civil.ApplicationServices;
            public class Many
            {
                public void Draw()
                {
                    var cs = CivilApplication.ActiveDocument.CorridorState;
                    for (int i = 0; i < 1000; i++) Add(cs, i);
                }
                static void Add(CorridorState cs, int i) { cs.Points.Add(i * 0.01, 0, "X"); }
            }
            """;
            var c = compiler.Compile(many, "many.cs");
            True(c.Success, "คอมไพล์ไม่ผ่าน");
            runner.Run(c.Classes[0], null, world, 0, 100, 100);                // อุ่นเครื่อง (โหลด PDB)
            double T(bool s){ var sw = Stopwatch.StartNew(); for (int k = 0; k < 3; k++) runner.Run(c.Classes[0], null, world, 0, 100, 100, s); return sw.Elapsed.TotalMilliseconds / 3; }
            double off = T(false), on = T(true);
            Console.WriteLine($"        ไม่เก็บ {off:0.0} ms · เก็บ {on:0.0} ms ต่อการรัน 1000 จุด ({(on - off) / 1000 * 1000:0} µs/จุด)");
        });
    }
}
