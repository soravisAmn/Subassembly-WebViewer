// สร้างโค้ด C# จาก DrawingSpec ("แบบ ข" ใน prompt.md ข้อ 6)
//
// ส่วนที่วาดอยู่ในช่วงมีป้ายกำกับเสมอ (ไฟล์ใหม่และไฟล์ที่ import ใช้ป้ายเดียวกัน):
//   // ===== SA-DRAWING BEGIN ... =====
//   // sa-spec: {DrawingSpec เป็น JSON บรรทัดเดียว}
//   internal static class SaDrawing_<ClassName> { AddTargets / AddParams / Draw + ตัวช่วย }
//   // ===== SA-DRAWING END =====
// และบรรทัดเรียกในเมธอดของ class หลัก (บรรทัดละ 1 ป้าย):
//   SaDrawing_X.AddTargets(corridorState); // SA-DRAWING TARGET   (GetLogicalNames)
//   SaDrawing_X.AddParams(corridorState);  // SA-DRAWING PARAM    (GetInputParameters)
//   SaDrawing_X.Draw(corridorState);       // SA-DRAWING CALL     (Draw)
//
// โค้ดที่สร้างใช้เฉพาะ Civil 3D API ที่ไฟล์ของผู้ใช้ (test2.cs, base_rock-pitching.cs) ใช้อยู่แล้ว
// และตรวจกับ API Reference 2027 แล้ว (Points/Links/Shapes.Add, Codes.TryAdd, ParamsXxx.Add/Value, DisplayName,
// IntersectSurface, SampleSection, Surface.FindElevationAtXY, Alignment.PointLocation, RecordError)
//
// ลำดับที่โค้ดสร้างต้องตรงกับ wwwroot/js/spec.js ทุกขั้น: เว็บแสดงรูปจาก JS ทันที แล้วเทียบกับผลรันโค้ดนี้

using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace SA.Drawing;

public static class CodeGenerator
{
    public const string BeginMark = "// ===== SA-DRAWING BEGIN";
    public const string EndMark = "// ===== SA-DRAWING END =====";
    public const string SpecPrefix = "// sa-spec: ";
    public const string SpecB64Prefix = "// sa-spec-b64: ";
    public const string TargetTag = "// SA-DRAWING TARGET";
    public const string ParamTag = "// SA-DRAWING PARAM";
    public const string CallTag = "// SA-DRAWING CALL";
    private const string BeginLine = BeginMark + " (สร้างโดย SA Drawing Studio — แก้ด้วยการวาดในเว็บ อย่าแก้ช่วงนี้ด้วยมือ) =====";

    // ชื่อที่โค้ดที่สร้างใช้เอง: parameter ห้ามตั้งชื่อซ้ำ (เว็บตรวจตอนตั้งชื่อด้วย)
    public static readonly HashSet<string> Reserved = new(StringComparer.Ordinal)
    {
        "cs", "F", "Deg", "Pt", "Measure", "Source", "surface",
        // ชื่อตัวช่วยในโค้ดที่สร้าง (ตัวแปรชื่อเดียวกันจะบังเมธอด / ชนิด)
        "Seg", "Arc", "Delta", "Polar", "SlopeLength", "SlopeToSurface", "OnSurface", "Between", "Intersect", "Tangent", "Rotate",
        "Arc3", "ArcR", "Fillet", "Join", "AddPoint", "AddLink", "AddShape", "FollowSurface", "Check", "Warn", "TargetSurface",
        "GetLong", "GetDouble", "Elevation",
        "abstract","as","base","bool","break","byte","case","catch","char","checked","class","const","continue","decimal","default",
        "delegate","do","double","else","enum","event","explicit","extern","false","finally","fixed","float","for","foreach","goto",
        "if","implicit","in","int","interface","internal","is","lock","long","namespace","new","null","object","operator","out",
        "override","params","private","protected","public","readonly","ref","return","sbyte","sealed","short","sizeof","stackalloc",
        "static","string","struct","switch","this","throw","true","try","typeof","uint","ulong","unchecked","unsafe","ushort","using",
        "virtual","void","volatile","while","var","Math","Point","Link","Shape","ObjectId"
    };
    public static bool IsReservedName(string n) => Reserved.Contains(n) || System.Text.RegularExpressions.Regex.IsMatch(n, @"^([PpLlSs]\d+|surface\d+)$");

    public static string HelperClass(DrawingSpec s) => "SaDrawing_" + s.ClassName;

    // ---------------- ไฟล์ใหม่ทั้งไฟล์ ----------------

    public static string GenerateFile(DrawingSpec s, string rawSpecJson, string fileName)
    {
        string cls = s.ClassName, h = HelperClass(s), ns = string.IsNullOrWhiteSpace(s.Namespace) ? "TestSubassembly" : s.Namespace!;
        var sb = new StringBuilder();
        sb.AppendLine($"// {fileName} — subassembly ที่สร้างจาก SA Drawing Studio");
        sb.AppendLine("//");
        sb.AppendLine("// รูปตัดวาดในเว็บ: โค้ดในช่วง SA-DRAWING สร้างจากการวาด (เปิดไฟล์นี้ในเว็บแล้ววาดต่อได้ อย่าแก้ช่วงนั้นด้วยมือ)");
        sb.AppendLine("// โค้ดนอกช่วงนั้นแก้เองได้ เว็บจะไม่แตะ");
        if (s.Params.Count > 0)
        {
            sb.AppendLine("//");
            sb.AppendLine("// Parameter:");
            foreach (var p in s.Params) sb.AppendLine($"//   {p.Name} ({p.Kind}, default {Num(p.Default)}{Bounds(p)}){(string.IsNullOrEmpty(p.DisplayName) || p.DisplayName == p.Name ? "" : " — " + p.DisplayName)}");
        }
        sb.AppendLine();
        sb.AppendLine("using System;");
        sb.AppendLine("using System.Collections.Generic;");
        sb.AppendLine("using Autodesk.Civil;");
        sb.AppendLine("using Autodesk.Civil.ApplicationServices;");
        sb.AppendLine("using Autodesk.Civil.DatabaseServices;");
        sb.AppendLine("using Autodesk.Civil.Runtime;");
        sb.AppendLine("using AcDb = Autodesk.AutoCAD.DatabaseServices;");
        sb.AppendLine("using ObjectId = Autodesk.AutoCAD.DatabaseServices.ObjectId;");
        sb.AppendLine();
        sb.AppendLine($"namespace {ns}");
        sb.AppendLine("{");
        sb.Append($$"""
    public class {{cls}}
    {
        // ------------------------------------------------------------------
        // Civil 3D เรียก 4 เมธอดนี้ผ่าน .atc (ต้องเป็น public, ไม่มีพารามิเตอร์)

        public void GetLogicalNames()
        {
            CorridorState corridorState = null;
            try
            {
                corridorState = CivilApplication.ActiveDocument.CorridorState;
                {{h}}.AddTargets(corridorState); {{TargetTag}}
            }
            catch (Exception e)
            {
                RecordError(corridorState, e);
            }
        }

        public void GetInputParameters()
        {
            CorridorState corridorState = null;
            try
            {
                corridorState = CivilApplication.ActiveDocument.CorridorState;
                {{h}}.AddParams(corridorState); {{ParamTag}}
            }
            catch (Exception e)
            {
                RecordError(corridorState, e);
            }
        }

        public void GetOutputParameters()
        {
            // ไม่มี output parameter
        }

        public void Draw()
        {
            CorridorState corridorState = null;
            try
            {
                corridorState = CivilApplication.ActiveDocument.CorridorState;
                {{h}}.Draw(corridorState); {{CallTag}}
            }
            catch (Exception e)
            {
                RecordError(corridorState, e);
            }
        }

        // ------------------------------------------------------------------

        private static void RecordError(CorridorState corridorState, Exception e)
        {
            if (corridorState == null)
                return;
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, nameof({{cls}}), true);
        }
    }


""");
        sb.Append(GenerateBlock(s, rawSpecJson, "    "));
        sb.AppendLine("}");
        return Crlf(sb.ToString());
    }

    // ---------------- ช่วงมีป้าย ----------------

    public static string GenerateBlock(DrawingSpec s, string rawSpecJson, string indent)
    {
        var g = new Gen(s);
        var body = g.Build();
        var sb = new StringBuilder();
        sb.AppendLine(indent + BeginLine);
        sb.AppendLine(indent + SpecLine(rawSpecJson));
        foreach (var line in body.Split('\n'))
            sb.AppendLine(line.TrimEnd('\r').Length == 0 ? "" : indent + line.TrimEnd('\r'));
        sb.AppendLine(indent + EndMark);
        return Crlf(sb.ToString());
    }

    // spec เป็น JSON บรรทัดเดียว (ภาษาไทยอ่านได้); ถ้ามีอักขระที่ C# นับเป็นขึ้นบรรทัดใหม่ ใช้ base64 แทน
    public static string SpecLine(string rawJson)
    {
        using var doc = JsonDocument.Parse(rawJson);
        var json = JsonSerializer.Serialize(doc.RootElement, new JsonSerializerOptions { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
        if (json.IndexOfAny(new[] { '\r', '\n', '\u0085', (char)0x2028, (char)0x2029 }) >= 0)
            return SpecB64Prefix + Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
        return SpecPrefix + json;
    }

    private static string Crlf(string s) => s.Replace("\r\n", "\n").Replace("\n", "\r\n");
    private static string Num(double v) => v.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture);
    private static string Bounds(SpecParam p) =>
        p.Min != null && p.Max != null ? $", {Num(p.Min.Value)}–{Num(p.Max.Value)}" :
        p.Min != null ? $", ไม่น้อยกว่า {Num(p.Min.Value)}" : p.Max != null ? $", ไม่เกิน {Num(p.Max.Value)}" : "";

    // ---------------- ตัวสร้างเนื้อหา class ----------------

    private class Gen
    {
        private readonly DrawingSpec _s;
        private readonly StringBuilder _o = new();
        private readonly HashSet<string> _names;
        private readonly Dictionary<string, string> _surf = new();   // ชื่อ target -> ตัวแปร ObjectId

        public Gen(DrawingSpec s)
        {
            _s = s;
            _names = s.Params.Select(p => p.Name).ToHashSet();
            foreach (var p in s.Params)
                if (IsReservedName(p.Name)) throw new FormatException($"ตั้งชื่อ parameter ว่า {p.Name} ไม่ได้ (ชื่อนี้โค้ดใช้เอง)");
            if (!System.Text.RegularExpressions.Regex.IsMatch(s.ClassName, @"^[A-Za-z_][A-Za-z0-9_]*$"))
                throw new FormatException($"ชื่อ class '{s.ClassName}' ใช้ใน C# ไม่ได้");
        }

        private void L(string line = "") => _o.AppendLine(line);
        private string X(string? src, string what, string id, int need = 0)
        {
            try { return SpecExpr.ToCs(src, _names, need); }
            catch (FormatException e) { throw new FormatException($"{id} {what}: {e.Message}"); }
        }

        public string Build()
        {
            string h = HelperClass(_s);
            L($"internal static class {h}");
            L("{");
            L($"    private const string Source = \"{_s.ClassName}\";");
            L("    private const double Deg = Math.PI / 180.0;");
            L();
            Targets();
            Params();
            DrawMethod();
            Helpers();
            L("}");
            return _o.ToString();
        }

        private string SurfVar(string? target)
        {
            var t = string.IsNullOrEmpty(target) ? "TargetSurface" : target!;
            if (!_surf.TryGetValue(t, out var v)) _surf[t] = v = _surf.Count == 0 ? "surface" : "surface" + (_surf.Count + 1);
            return v;
        }

        private void Targets()
        {
            L("    // GetLogicalNames: target ที่ส่วนที่วาดใช้");
            L("    internal static void AddTargets(CorridorState cs)");
            L("    {");
            foreach (var t in _s.Targets)
            {
                L($"        ParamLong {Ident(t.Name)} = cs.ParamsLong.Add(\"{t.Name}\", (int)ParamLogicalNameType.{t.Type});");
                L($"        {Ident(t.Name)}.DisplayName = {Str(t.DisplayName ?? t.Name)};");
            }
            L("    }");
            L();
        }

        private void Params()
        {
            L("    // GetInputParameters: parameter ของส่วนที่วาด");
            L("    internal static void AddParams(CorridorState cs)");
            L("    {");
            foreach (var p in _s.Params)
            {
                var add = p.Kind == "long" ? $"cs.ParamsLong.Add(\"{p.Name}\", {Math.Round(p.Default):0})" : $"cs.ParamsDouble.Add(\"{p.Name}\", {SpecExpr.Lit(p.Default)})";
                L($"        {add}.DisplayName = {Str(string.IsNullOrEmpty(p.DisplayName) ? p.Name : p.DisplayName!)};");
            }
            L("    }");
            L();
        }

        private void DrawMethod()
        {
            L("    internal static void Draw(CorridorState cs)");
            L("    {");
            // parameter
            if (_s.Params.Count > 0) L("        // ---- parameter (นอกขอบเขต = ใช้ค่าขอบแทน + เตือน) ----");
            foreach (var p in _s.Params)
            {
                bool lng = p.Kind == "long";
                L(lng ? $"        long {p.Name} = GetLong(cs, \"{p.Name}\", {Math.Round(p.Default):0});"
                      : $"        double {p.Name} = GetDouble(cs, \"{p.Name}\", {SpecExpr.Lit(p.Default)});");
                if (p.Min != null)
                    L($"        if ({p.Name} < {SpecExpr.Lit(p.Min.Value)}) {{ Warn(cs, CorridorError.ValueTooSmall, \"{p.Name} = \" + {p.Name} + \" < {Num(p.Min.Value)}, ใช้ {Num(p.Min.Value)} แทน\"); {p.Name} = {(lng ? $"(long){SpecExpr.Lit(p.Min.Value)}" : SpecExpr.Lit(p.Min.Value))}; }}");
                if (p.Max != null)
                    L($"        if ({p.Name} > {SpecExpr.Lit(p.Max.Value)}) {{ Warn(cs, CorridorError.ValueTooLarge, \"{p.Name} = \" + {p.Name} + \" > {Num(p.Max.Value)}, ใช้ {Num(p.Max.Value)} แทน\"); {p.Name} = {(lng ? $"(long){SpecExpr.Lit(p.Max.Value)}" : SpecExpr.Lit(p.Max.Value))}; }}");
            }
            if (_s.Side is { Mirror: true } sd && _s.Params.Any(p => p.Name == sd.Param))
                L($"        double F = {sd.Param} == 1 ? -1.0 : 1.0;   // {sd.Param} = 1 (Left) -> กลับด้านแนวราบทั้งหมด");
            else
                L("        double F = 1.0;");
            L();

            // surface ที่ต้องใช้
            var usesSurface = _s.Points.Where(p => p.Def.Type is "slopeToSurface" or "onSurface").Select(p => p.Def.Target)
                .Concat(_s.Links.Where(l => l.Follow).Select(l => l.Target)).ToList();
            if (usesSurface.Count > 0)
            {
                L("        // ---- target surface (Layout mode / ไม่ได้กำหนด = วาดแบบไม่มีดิน) ----");
                foreach (var t in usesSurface.Select(t => string.IsNullOrEmpty(t) ? "TargetSurface" : t!).Distinct())
                    L($"        ObjectId {SurfVar(t)} = TargetSurface(cs, \"{t}\");");
                L();
            }

            // พิกัดของจุด (ตามลำดับที่ต้องคำนวณก่อน-หลัง)
            L("        // ---- พิกัดของจุด (เทียบ origin; null = หาจุดนี้ไม่ได้ ส่วนที่พึ่งจุดนี้จะถูกข้าม) ----");
            var order = TopoOrder(out var cyclic);
            foreach (var id in cyclic)
            {
                L($"        Pt? {id} = null;");
                L($"        Warn(cs, CorridorError.Failure, \"{id}: จุด {id} อ้างถึงตัวเองเป็นวง\");");
            }
            foreach (var o in order)
            {
                if (o is SpecPoint p) PointLine(p);
                else RotationLines((SpecRotation)o);
            }
            L();

            L("        // ---- เพิ่มจุด / link / shape ลง CorridorState ----");
            foreach (var p in _s.Points)
                // จุด auxiliary: ไม่ประกาศตัวแปร Point (ไม่มีใครใช้ — กันคำเตือน CS0219 ของ compiler)
                L(p.Auxiliary ? $"        // {p.Id} auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D"
                              : $"        Point {Lc(p.Id)} = AddPoint(cs, {p.Id}{Codes(p.Codes)});");
            foreach (var l in _s.Links)
            {
                var (a, b) = l.Ends;
                // link auxiliary: ไม่มีตัวแปร Link / ไม่ Links.Add (และโค้งไม่ Points.Add จุดระหว่างทาง) — บรรทัดนี้ไว้ให้ codelink กระโดดมา
                if (l.Auxiliary) { L($"        // {l.Id} auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D"); continue; }
                // เส้นโค้ง = หลายท่อน: ตัวแปรเป็น Link[]
                string lt = l.IsArc ? "Link[]" : "Link";
                var need = new[] { a, b }.Concat(l.Type == "arc3" ? new[] { l.Via ?? "" } : l.Type == "fillet" ? new[] { l.Corner ?? "" } : Array.Empty<string>());
                var missing = need.FirstOrDefault(id => !Exists(id));
                // link ที่ข้าม: ประกาศตัวแปร null เฉพาะเมื่อ shape ใช้ (ไม่งั้น compiler เตือน CS0219)
                bool used = _s.Shapes.Any(sh => sh.Links.Contains(l.Id));
                string skip = used ? $"        {lt} {Lc(l.Id)} = null;   // " : "        // ";
                if (missing != null) { L($"{skip}{l.Id}: ไม่มีจุด {missing}"); continue; }
                var aux = new[] { a, b }.FirstOrDefault(id => _s.Points.First(p => p.Id == id).Auxiliary);
                if (aux != null)
                {
                    L($"{skip}{l.Id}: ปลาย {aux} เป็นจุด auxiliary");
                    L($"        Warn(cs, CorridorError.Failure, \"{l.Id}: ปลาย {aux} เป็นจุด auxiliary (ไม่อยู่ใน Civil 3D)\");");
                    continue;
                }
                if (l.IsArc)
                {
                    var sg = l.Seg ?? new SpecSeg();
                    string seg = $"{(sg.By == "count" ? "Seg.Count" : "Seg.Chord")}, {X(sg.Value ?? "0.05", "ท่อนโค้ง", l.Id)}";
                    string cc = Codes(l.Codes);
                    if (l.Type == "arc3")
                        L($"        Link[] {Lc(l.Id)} = Arc3(cs, \"{l.Id}\", {a}, {Lc(a)}, {l.Via}, {b}, {Lc(b)}, {seg}{cc});   // {l.Id} โค้งผ่าน {a} {l.Via} {b}");
                    else if (l.Type == "arcR")
                        L($"        Link[] {Lc(l.Id)} = ArcR(cs, \"{l.Id}\", {a}, {Lc(a)}, {b}, {Lc(b)}, {X(l.Radius, "radius", l.Id)}, {(l.Sweep == "cw" ? "false" : "true")}, {(l.Large ? "true" : "false")}, F, {seg}{cc});   // {l.Id} โค้งรัศมี {(l.Sweep == "cw" ? "ตามเข็ม" : "ทวนเข็ม")}{(l.Large ? " ทางยาว" : "")} (กรอบ Side = Right)");
                    else
                        L($"        Link[] {Lc(l.Id)} = Fillet(cs, \"{l.Id}\", {a}, {Lc(a)}, {l.Corner}, {b}, {Lc(b)}, {X(l.Radius, "radius", l.Id)}, {seg}{cc});   // {l.Id} Fillet ที่มุม {l.Corner}");
                    continue;
                }
                if (l.Follow)
                    L($"        Link {Lc(l.Id)} = FollowSurface(cs, \"{l.Id}\", {SurfVar(l.Target)}, {a}, {Lc(a)}, {b}, {Lc(b)}{Codes(l.Codes)});   // {l.Id} วิ่งตามผิวดิน");
                else
                    L($"        Link {Lc(l.Id)} = AddLink(cs, \"{l.Id}\", {Lc(a)}, {Lc(b)}{Codes(l.Codes)});");
            }
            foreach (var sh in _s.Shapes)
            {
                var ok = sh.Links.All(id => _s.Links.Any(l => l.Id == id));
                // shape ใน Civil 3D ประกอบจาก link จริงเท่านั้น
                var ax = ok ? sh.Links.FirstOrDefault(id => _s.Links.First(l => l.Id == id).Auxiliary) : null;
                if (ax != null)
                {
                    L($"        // {sh.Id}: ใช้ link auxiliary {ax} — ข้าม");
                    L($"        Warn(cs, CorridorError.Failure, \"{sh.Id}: ใช้ link auxiliary {ax} ไม่ได้ (ไม่อยู่ใน Civil 3D)\");");
                    continue;
                }
                // มีเส้นโค้ง (Link[]) = ต่อ array ตามลำดับด้วย Join
                bool arcs = sh.Links.Any(id => _s.Links.Any(l => l.Id == id && l.IsArc));
                string list = arcs ? $"Join({string.Join(", ", sh.Links.Select(id => _s.Links.First(l => l.Id == id).IsArc ? Lc(id) : $"new[] {{ {Lc(id)} }}"))})"
                                   : $"new[] {{ {string.Join(", ", sh.Links.Select(Lc))} }}";
                L(ok ? $"        AddShape(cs, \"{sh.Id}\", {list}{Codes(sh.Codes)});"
                     : $"        // {sh.Id}: มี link ที่ไม่มีอยู่จริง ข้าม");
            }
            L("    }");
            L();
        }

        private bool Exists(string id) => _s.Points.Any(p => p.Id == id);

        private void PointLine(SpecPoint p)
        {
            var d = p.Def;
            string id = p.Id, Q = Str(id);
            // อ้างจุดที่ไม่มีอยู่ = จุดนี้หาไม่ได้ (แบบเดียวกับใน JS) ไม่ทำให้ทั้งไฟล์สร้างไม่ได้
            string From(string? f) => string.IsNullOrEmpty(f) ? "Pt.Origin" : Exists(f!) ? f! : "null";
            string Dir() => d.Dir == -1 ? "-F" : "F";
            string Ex(string? e, string what, int need = 0) => X(e, what, id, need);
            switch (d.Type)
            {
                case "origin":
                    L($"        Pt? {id} = Pt.Origin;   // {id} origin");
                    break;
                case "delta":
                    L($"        Pt? {id} = Delta(cs, {Q}, {From(d.From)}, F * {Ex(d.Dx, "dx", 1)}, {Ex(d.Dy, "dy")});   // {id} ห่างจาก {d.From ?? "origin"}");
                    break;
                case "polar":
                    L($"        Pt? {id} = Polar(cs, {Q}, {From(d.From)}, {Ex(d.Length, "length")}, {Ex(d.Angle, "angle")}, F);   // {id} ระยะ + มุม จาก {d.From ?? "origin"}");
                    break;
                case "slopeLength":
                    var m = d.Measure switch { "dx" => "Measure.Dx", "dy" => "Measure.Dy", _ => "Measure.Along" };
                    L($"        Pt? {id} = SlopeLength(cs, {Q}, {From(d.From)}, {Ex(d.Slope, "slope")}, {Ex(d.Length, "length")}, {Dir()}, {m});   // {id} ลาด + ความยาว จาก {d.From ?? "origin"}");
                    break;
                case "slopeToSurface":
                    L($"        Pt? {id} = SlopeToSurface(cs, {Q}, {SurfVar(d.Target)}, {From(d.From)}, {Ex(d.Slope, "slope")}, {Dir()}, {Ex(d.MaxDistance ?? "50", "maxDistance")}, {Ex(d.LayoutLength ?? "3", "layoutLength")});   // {id} ลาดจนชนดิน");
                    break;
                case "onSurface":
                    L($"        Pt? {id} = OnSurface(cs, {Q}, {SurfVar(d.Target)}, {From(d.From)}, F * {Ex(d.Dx, "dx", 1)});   // {id} บนผิวดิน");
                    break;
                case "between":
                    L($"        Pt? {id} = Between(cs, {Q}, {From(d.A)}, {From(d.B)}, {Ex(d.T, "t")});   // {id} บนเส้น {d.A}-{d.B}");
                    break;
                case "intersect":
                    L($"        Pt? {id} = Intersect(cs, {Q}, {From(d.A1)}, {From(d.A2)}, {From(d.B1)}, {From(d.B2)});   // {id} จุดตัด {d.A1}-{d.A2} กับ {d.B1}-{d.B2}");
                    break;
                case "tangent":
                    L($"        Pt? {id} = Tangent(cs, {Q}, {From(d.Corner)}, {From(d.Toward)}, {From(d.Other)}, {Ex(d.Radius, "radius")});   // {id} จุดสัมผัสของ Fillet ที่มุม {d.Corner}");
                    break;
                case "external":
                    throw new FormatException($"{id}: จุดจากโค้ดเดิม (external) ใช้ได้กับไฟล์ที่เขียนเองเท่านั้น — รองรับใน Milestone 4");
                default:
                    throw new FormatException($"{id}: ไม่รู้จักชนิดจุด {d.Type}");
            }
        }

        // กลุ่มหมุน: สมาชิกคำนวณตาม def ก่อน (ค่าก่อนหมุน) แล้ว Rotate ทีละจุดรอบ pivot
        private void RotationLines(SpecRotation g)
        {
            string pv = Exists(g.Pivot) ? g.Pivot : "null", a = X(g.Angle, "มุมหมุน", g.Id, 1);
            L($"        // กลุ่มหมุน {g.Id}: หมุนรอบ {g.Pivot} มุม {g.Angle}° (ทวนเข็ม + ในกรอบ Side = Right)");
            foreach (var m in g.Points.Where(Exists))
                L($"        {m} = Rotate(cs, \"{m}\", {m}, {pv}, F * {a});");
        }

        // ลำดับคำนวณ: จุด (SpecPoint) + บรรทัดหมุนของกลุ่ม (SpecRotation) — จุดที่ต้องคำนวณก่อน (from / a / b ...) มาก่อน;
        // ไม่พึ่งกันคงลำดับเดิม; อ้างกันเป็นวง -> cyclic
        // จุดที่อ้างสมาชิกกลุ่มหมุน: สมาชิกกลุ่มเดียวกัน / จุดที่ pivot อ้าง (ทางอ้อมด้วย) = ก่อนบรรทัดหมุน (เห็นค่าก่อนหมุน)
        //   อื่นๆ = หลังบรรทัดหมุน (เห็นค่าที่หมุนแล้ว) — ตรงกับ evaluate ใน wwwroot/js/spec.js
        private List<object> TopoOrder(out List<string> cyclic)
        {
            var groupOf = new Dictionary<string, SpecRotation>();
            foreach (var g in _s.Rotations) foreach (var id in g.Points) groupOf[id] = g;
            var pre = new Dictionary<string, HashSet<string>>();
            foreach (var g in _s.Rotations)
            {
                var s = pre[g.Id] = new HashSet<string>();
                var stack = new Stack<string>(); stack.Push(g.Pivot);
                while (stack.Count > 0)
                {
                    var id = stack.Pop();
                    if (string.IsNullOrEmpty(id) || s.Contains(id) || groupOf.GetValueOrDefault(id) == g) continue;
                    s.Add(id);
                    var p = _s.Points.FirstOrDefault(x => x.Id == id);
                    if (p != null) foreach (var r in p.Def.Refs()) stack.Push(r);
                }
            }
            var done = new HashSet<string>(); var order = new List<object>(); var cyc = new List<string>();
            var state = new Dictionary<string, int>();
            bool VisitRot(SpecRotation g)
            {
                string key = "#" + g.Id;
                if (done.Contains(key)) return true;
                if (state.GetValueOrDefault(key) == 1) return false;
                state[key] = 1;
                bool ok = true;
                foreach (var id in g.Points.Append(g.Pivot))
                {
                    var q = _s.Points.FirstOrDefault(x => x.Id == id);
                    if (q != null && !Visit(q)) ok = false;
                }
                state[key] = 2;
                if (ok) { done.Add(key); order.Add(g); }
                else foreach (var id in g.Points) if (!cyc.Contains(id)) cyc.Add(id);
                return ok;
            }
            bool Visit(SpecPoint p)
            {
                if (done.Contains(p.Id)) return true;
                if (state.GetValueOrDefault(p.Id) == 1) return false;
                state[p.Id] = 1;
                bool ok = true;
                foreach (var r in p.Def.Refs())
                {
                    var q = _s.Points.FirstOrDefault(x => x.Id == r);
                    if (q == null) continue;
                    if (!Visit(q)) ok = false;
                    // อ้างสมาชิกกลุ่มหมุนแบบเห็นค่าที่หมุนแล้ว = ต้องอยู่หลังบรรทัดหมุนของกลุ่มนั้น
                    if (groupOf.TryGetValue(r, out var g) && groupOf.GetValueOrDefault(p.Id) != g && !pre[g.Id].Contains(p.Id) && !VisitRot(g)) ok = false;
                }
                state[p.Id] = 2;
                if (ok) { done.Add(p.Id); order.Add(p); } else if (!cyc.Contains(p.Id)) cyc.Add(p.Id);
                return ok;
            }
            foreach (var p in _s.Points) Visit(p);
            foreach (var g in _s.Rotations) VisitRot(g);
            // จุดที่พึ่งจุดในวงก็คำนวณไม่ได้ (อยู่ใน order แต่ from = null) — ประกาศจุดในวงไว้ก่อน
            cyclic = cyc;
            return order.Where(o => o is not SpecPoint p || !cyc.Contains(p.Id)).ToList();
        }

        private void Helpers()
        {
            _o.Append("""
    // ------------------------------------------------------------------
    // ตัวช่วย (พิกัดของ Pt เทียบ origin ของ subassembly; IntersectSurface / SampleSection ใช้ค่าจริง)

    private struct Pt
    {
        public readonly double X, Y;
        public Pt(double x, double y) { X = x; Y = y; }
        public static readonly Pt Origin = new Pt(0.0, 0.0);
    }

    private enum Measure { Along, Dx, Dy }

    private static Pt? Delta(CorridorState cs, string id, Pt? from, double dx, double dy)
    {
        if (from == null) return null;
        return Check(cs, id, new Pt(from.Value.X + dx, from.Value.Y + dy));
    }

    // ห่าง length ทำมุม angle (องศา ทวนเข็มจาก +x ในกรอบ Side = Right) · F = -1 (Left) กลับด้านแนวราบ
    private static Pt? Polar(CorridorState cs, string id, Pt? from, double length, double angle, double F)
    {
        if (from == null) return null;
        return Check(cs, id, new Pt(from.Value.X + F * length * Math.Cos(angle * Deg), from.Value.Y + length * Math.Sin(angle * Deg)));
    }

    // ลาด slope (ระดับที่เปลี่ยน / ระยะราบ) ไปทาง dir ยาว length ตามแนวลาด / ระยะราบ / ระยะดิ่ง
    private static Pt? SlopeLength(CorridorState cs, string id, Pt? from, double slope, double length, double dir, Measure measure)
    {
        if (from == null) return null;
        double run;
        if (measure == Measure.Dx) run = length;
        else if (measure == Measure.Dy)
        {
            if (slope == 0.0) { Warn(cs, CorridorError.ValueShouldNotBeZero, id + ": slope = 0 ใช้ระยะดิ่งไม่ได้"); return null; }
            run = Math.Abs(length / slope);
        }
        else run = length / Math.Sqrt(1.0 + slope * slope);
        return Check(cs, id, new Pt(from.Value.X + dir * run, from.Value.Y + slope * run));
    }

    // ลาดจนชนดิน: ไม่ชนภายใน maxDistance (ระยะราบ) = หยุดที่ maxDistance + เตือน; ไม่มีดิน = ยาวคงที่ layoutLength
    private static Pt? SlopeToSurface(CorridorState cs, string id, ObjectId surface, Pt? from, double slope, double dir, double maxDistance, double layoutLength)
    {
        if (from == null) return null;
        Pt f = from.Value;
        if (surface.IsNull)
        {
            if (cs.Mode != CorridorMode.Layout)
                Warn(cs, CorridorError.LogicalNameNotFound, id + " ลาดจนชนดิน: ไม่ได้กำหนด Target Surface — วาดยาวคงที่ " + layoutLength + " m");
            return Check(cs, id, new Pt(f.X + dir * layoutLength, f.Y + slope * layoutLength));
        }
        IPoint hit = null;
        try
        {
            hit = cs.IntersectSurface(surface, cs.CurrentAlignmentId, Abs(cs, f), dir > 0, slope);
        }
        catch
        {
            hit = null;
        }
        if (hit != null && Math.Abs(hit.Offset - cs.CurrentOffset - f.X) <= maxDistance + 1e-9)
            return Check(cs, id, new Pt(hit.Offset - cs.CurrentOffset, hit.Elevation - cs.CurrentElevation));
        Warn(cs, CorridorError.NoSideslopeIntersectFound, id + " ลาดจนชนดิน: ไม่ชนผิวดินภายใน " + maxDistance + " m — หยุดที่ " + maxDistance + " m");
        return Check(cs, id, new Pt(f.X + dir * maxDistance, f.Y + slope * maxDistance));
    }

    // จุดบนผิวดินที่ระยะ dx จาก from; ไม่มีดิน = ใช้ระดับของ from
    private static Pt? OnSurface(CorridorState cs, string id, ObjectId surface, Pt? from, double dx)
    {
        if (from == null) return null;
        double x = from.Value.X + dx;
        if (surface.IsNull)
        {
            if (cs.Mode != CorridorMode.Layout)
                Warn(cs, CorridorError.LogicalNameNotFound, id + " บนผิวดิน: ไม่ได้กำหนด Target Surface — ใช้ระดับของจุดตั้งต้น");
            return Check(cs, id, new Pt(x, from.Value.Y));
        }
        try
        {
            return Check(cs, id, new Pt(x, Elevation(cs, surface, cs.CurrentOffset + x) - cs.CurrentElevation));
        }
        catch (Exception e)
        {
            Warn(cs, CorridorError.Failure, id + " บนผิวดิน: " + e.Message);
            return null;
        }
    }

    private static Pt? Between(CorridorState cs, string id, Pt? a, Pt? b, double t)
    {
        if (a == null || b == null) return null;
        return Check(cs, id, new Pt(a.Value.X + t * (b.Value.X - a.Value.X), a.Value.Y + t * (b.Value.Y - a.Value.Y)));
    }

    // จุดตัดของเส้น a1-a2 กับ b1-b2 (ต่อเส้นออกไปได้)
    private static Pt? Intersect(CorridorState cs, string id, Pt? a1, Pt? a2, Pt? b1, Pt? b2)
    {
        if (a1 == null || a2 == null || b1 == null || b2 == null) return null;
        Pt p = a1.Value, q = a2.Value, r = b1.Value, s = b2.Value;
        double d = (q.X - p.X) * (s.Y - r.Y) - (q.Y - p.Y) * (s.X - r.X);
        if (Math.Abs(d) < 1e-12) { Warn(cs, CorridorError.Failure, id + ": เส้นทั้งสองขนานกัน ไม่มีจุดตัด"); return null; }
        double t = ((r.X - p.X) * (s.Y - r.Y) - (r.Y - p.Y) * (s.X - r.X)) / d;
        return Check(cs, id, new Pt(p.X + t * (q.X - p.X), p.Y + t * (q.Y - p.Y)));
    }

    // หมุนจุด p รอบ pivot ด้วยมุม angle (องศา ทวนเข็ม +) — สมาชิกกลุ่มหมุน
    private static Pt? Rotate(CorridorState cs, string id, Pt? p, Pt? pivot, double angle)
    {
        if (p == null) return null;
        if (pivot == null) { Warn(cs, CorridorError.Failure, id + ": ข้ามเพราะหาจุดหมุนไม่ได้"); return null; }
        double r = angle * Deg, c = Math.Cos(r), s = Math.Sin(r), dx = p.Value.X - pivot.Value.X, dy = p.Value.Y - pivot.Value.Y;
        return Check(cs, id, new Pt(pivot.Value.X + dx * c - dy * s, pivot.Value.Y + dx * s + dy * c));
    }

    private static Pt? Check(CorridorState cs, string id, Pt p)
    {
        if (double.IsNaN(p.X) || double.IsNaN(p.Y) || double.IsInfinity(p.X) || double.IsInfinity(p.Y))
        {
            Warn(cs, CorridorError.Failure, id + ": คำนวณไม่ได้ (หารด้วยศูนย์?)");
            return null;
        }
        return p;
    }

    private static Point AddPoint(CorridorState cs, Pt? p, params string[] codes)
    {
        if (p == null) return null;
        Point point = cs.Points.Add(p.Value.X, p.Value.Y, "");
        foreach (string code in codes)
            point.Codes.TryAdd(code);
        return point;
    }

    private static Link AddLink(CorridorState cs, string id, Point a, Point b, params string[] codes)
    {
        if (a == null || b == null) return null;
        Link link = cs.Links.Add(new[] { a, b }, "");
        foreach (string code in codes)
            link.Codes.TryAdd(code);
        return link;
    }

    // link ที่วิ่งตามผิวดินจาก a ถึง b (เพิ่มจุดที่ผิวดินหักระหว่างทาง); ไม่มีดิน = เส้นตรง
    private static Link FollowSurface(CorridorState cs, string id, ObjectId surface, Pt? pa, Point a, Pt? pb, Point b, params string[] codes)
    {
        if (a == null || b == null) return null;
        var path = new List<Point> { a };
        if (surface.IsNull)
        {
            if (cs.Mode != CorridorMode.Layout)
                Warn(cs, CorridorError.LogicalNameNotFound, id + " วิ่งตามผิวดิน: ไม่ได้กำหนด Target Surface — ใช้เส้นตรงแทน");
        }
        else
        {
            try
            {
                double lo = Math.Min(pa.Value.X, pb.Value.X), hi = Math.Max(pa.Value.X, pb.Value.X);
                var mids = new List<(double X, double Y)>();
                SampledSectionLinkCollection sampled = cs.SampleSection(surface, cs.CurrentAlignmentId, Abs(cs, pa.Value), Abs(cs, pb.Value));
                foreach (SampledSectionLink s in sampled)
                {
                    double x = s.EndPointOffset - cs.CurrentOffset;
                    if (x > lo + 1e-9 && x < hi - 1e-9)
                        mids.Add((x, s.EndPointElevation - cs.CurrentElevation));
                }
                mids.Sort((p, q) => p.X.CompareTo(q.X));
                if (pa.Value.X > pb.Value.X) mids.Reverse();
                foreach (var m in mids)
                    path.Add(cs.Points.Add(m.X, m.Y, ""));
            }
            catch (Exception e)
            {
                Warn(cs, CorridorError.Failure, id + " วิ่งตามผิวดิน: " + e.Message);
            }
        }
        path.Add(b);
        Link link = cs.Links.Add(path.ToArray(), "");
        foreach (string code in codes)
            link.Codes.TryAdd(code);
        return link;
    }

    // ---- เส้นโค้ง: link ใน Civil 3D เป็นเส้นตรงเท่านั้น -> จุดระหว่างทาง (ไม่มี code) + link ตรงทีละท่อน (code เดียวกันทุกท่อน) ----
    // เรขาคณิตตรงกับ wwwroot/js/spec.js (tangentPoint / arcGeom / segCount / arcPoints)

    private enum Seg { Chord, Count }

    private struct Arc
    {
        public double Cx, Cy, R, A1, Sw;   // ศูนย์กลาง, รัศมี, มุมเริ่ม (rad), มุมกวาด (rad, + = ทวนเข็ม)
    }

    private static double Mod(double a, double m) => ((a % m) + m) % m;

    // จุดสัมผัสบนเส้น corner→toward ของโค้งรัศมี radius ที่มุม corner (อีกเส้นไปทาง other)
    // ขนานกัน / รัศมีใหญ่เกินเส้น = เตือน + ใช้มุมแหลมเดิม
    private static Pt? Tangent(CorridorState cs, string id, Pt? corner, Pt? toward, Pt? other, double radius)
    {
        if (corner == null || toward == null || other == null) return null;
        Pt c = corner.Value, t = toward.Value, o = other.Value;
        double l1 = Math.Sqrt((t.X - c.X) * (t.X - c.X) + (t.Y - c.Y) * (t.Y - c.Y));
        double l2 = Math.Sqrt((o.X - c.X) * (o.X - c.X) + (o.Y - c.Y) * (o.Y - c.Y));
        string warn = null;
        Pt r = c;
        if (l1 < 1e-9 || l2 < 1e-9) warn = "เส้นยาวเป็นศูนย์";
        else
        {
            double ux = (t.X - c.X) / l1, uy = (t.Y - c.Y) / l1, vx = (o.X - c.X) / l2, vy = (o.Y - c.Y) / l2;
            double al = Math.Acos(Math.Max(-1.0, Math.Min(1.0, ux * vx + uy * vy)));
            if (al < 1e-6 || Math.PI - al < 1e-6) warn = "สองเส้นขนานกัน";
            else if (!(radius > 0.0)) warn = "รัศมี " + radius + " ต้องมากกว่า 0";
            else
            {
                double d = radius / Math.Tan(al / 2.0);
                if (d > l1 + 1e-9 || d > l2 + 1e-9) warn = "รัศมี " + radius + " ใหญ่เกิน (จุดสัมผัสเลยปลายเส้น)";
                else r = new Pt(c.X + ux * d, c.Y + uy * d);
            }
        }
        if (warn != null) Warn(cs, CorridorError.ValueTooLarge, id + " จุดสัมผัส: " + warn + " — ใช้มุมแหลมเดิม");
        return Check(cs, id, r);
    }

    // วงกลมของโค้งจาก a ถึง b · kind: 0 = ผ่าน 3 จุด (extra = จุดผ่าน), 1 = รัศมี (ccw = ทิศบนจอจริง), 2 = fillet (extra = จุดมุม)
    // คืนข้อความเตือนเมื่อเป็นไปไม่ได้ (ผู้เรียกใช้เส้นตรงแทน) · null = ได้ g
    private static string ArcGeom(int kind, Pt a, Pt b, Pt extra, double radius, bool ccw, bool large, out Arc g)
    {
        g = new Arc();
        double TAU = 2.0 * Math.PI;
        if (kind == 0)
        {
            Pt v = extra;
            double d = 2.0 * (a.X * (v.Y - b.Y) + v.X * (b.Y - a.Y) + b.X * (a.Y - v.Y));
            double size = Math.Max(Math.Max(Math.Sqrt((v.X - a.X) * (v.X - a.X) + (v.Y - a.Y) * (v.Y - a.Y)), Math.Sqrt((b.X - a.X) * (b.X - a.X) + (b.Y - a.Y) * (b.Y - a.Y))), 1e-9);
            if (Math.Abs(d) < 1e-9 * size * size) return "3 จุดเรียงเป็นเส้นตรง";
            double a2 = a.X * a.X + a.Y * a.Y, v2 = v.X * v.X + v.Y * v.Y, b2 = b.X * b.X + b.Y * b.Y;
            g.Cx = (a2 * (v.Y - b.Y) + v2 * (b.Y - a.Y) + b2 * (a.Y - v.Y)) / d;
            g.Cy = (a2 * (b.X - v.X) + v2 * (a.X - b.X) + b2 * (v.X - a.X)) / d;
            g.R = Math.Sqrt((a.X - g.Cx) * (a.X - g.Cx) + (a.Y - g.Cy) * (a.Y - g.Cy));
            g.A1 = Math.Atan2(a.Y - g.Cy, a.X - g.Cx);
            double s2 = Mod(Math.Atan2(b.Y - g.Cy, b.X - g.Cx) - g.A1, TAU), sv = Mod(Math.Atan2(v.Y - g.Cy, v.X - g.Cx) - g.A1, TAU);
            g.Sw = sv < s2 ? s2 : s2 - TAU;
            return null;
        }
        if (kind == 1)
        {
            double c = Math.Sqrt((b.X - a.X) * (b.X - a.X) + (b.Y - a.Y) * (b.Y - a.Y));
            if (c < 1e-9) return "จุดเริ่มกับจุดปลายเป็นจุดเดียวกัน";
            if (!(radius > 0.0) || radius < c / 2.0 - 1e-9) return "รัศมี " + radius + " น้อยกว่าครึ่งระยะเริ่ม-ปลาย (" + (c / 2.0) + ")";
            double h = Math.Sqrt(Math.Max(0.0, radius * radius - c * c / 4.0)), mx = (a.X + b.X) / 2.0, my = (a.Y + b.Y) / 2.0;
            double nx = -(b.Y - a.Y) / c, ny = (b.X - a.X) / c;   // ด้านซ้ายของทิศ a→b
            double side = ccw != large ? 1.0 : -1.0;
            g.Cx = mx + side * h * nx; g.Cy = my + side * h * ny; g.R = radius;
            g.A1 = Math.Atan2(a.Y - g.Cy, a.X - g.Cx);
            double s = Mod(Math.Atan2(b.Y - g.Cy, b.X - g.Cx) - g.A1, TAU);
            g.Sw = ccw ? s : s - TAU;
            return null;
        }
        // fillet: ศูนย์กลางบนเส้นแบ่งครึ่งมุม ห่างมุม R / sin(α/2) · จุดสัมผัสเป็นมุมแหลมเดิม = เส้นตรง
        Pt k = extra;
        double L1 = Math.Sqrt((a.X - k.X) * (a.X - k.X) + (a.Y - k.Y) * (a.Y - k.Y)), L2 = Math.Sqrt((b.X - k.X) * (b.X - k.X) + (b.Y - k.Y) * (b.Y - k.Y));
        if (L1 < 1e-9 || L2 < 1e-9) return "จุดสัมผัสอยู่ที่มุม (ดูคำเตือนของจุดสัมผัส)";
        if (!(radius > 0.0)) return "รัศมี " + radius + " ต้องมากกว่า 0";
        double ux = (a.X - k.X) / L1, uy = (a.Y - k.Y) / L1, wx = (b.X - k.X) / L2, wy = (b.Y - k.Y) / L2;
        double al = Math.Acos(Math.Max(-1.0, Math.Min(1.0, ux * wx + uy * wy)));
        if (al < 1e-6 || Math.PI - al < 1e-6) return "สองเส้นขนานกัน";
        double bl = Math.Sqrt((ux + wx) * (ux + wx) + (uy + wy) * (uy + wy)), dist = radius / Math.Sin(al / 2.0);
        g.Cx = k.X + (ux + wx) / bl * dist; g.Cy = k.Y + (uy + wy) / bl * dist; g.R = radius;
        g.A1 = Math.Atan2(a.Y - g.Cy, a.X - g.Cx);
        g.Sw = Mod(Math.Atan2(b.Y - g.Cy, b.X - g.Cx) - g.A1 + Math.PI, TAU) - Math.PI;   // ทางสั้น (< 180°)
        return null;
    }

    // จำนวนท่อน: Chord = ท่อนยาว (วัดตามโค้ง) ไม่เกิน value · Count = value ท่อน · จำกัด 2–180
    private static int SegCount(Seg by, double value, double r, double sw)
    {
        double n = by == Seg.Count ? Math.Round(value, MidpointRounding.AwayFromZero) : Math.Ceiling(r * Math.Abs(sw) / value - 1e-9);
        return (int)Math.Max(2.0, Math.Min(180.0, n));
    }

    // จุดระหว่างทาง + link ทีละท่อน (warn = เรขาคณิตเป็นไปไม่ได้ -> เส้นตรงท่อนเดียว)
    private static Link[] ArcLinks(CorridorState cs, string id, string kind, Point a, Point b, string warn, Arc g, Seg by, double value, string[] codes)
    {
        var path = new List<Point> { a };
        if (warn != null) Warn(cs, CorridorError.Failure, id + " " + kind + ": " + warn + " — ใช้เส้นตรงแทน");
        else
        {
            if (!(value > 0.0))
            {
                Warn(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, id + ": ค่าท่อนโค้ง " + value + " ใช้ไม่ได้ — ใช้ท่อนยาว 0.05 m");
                value = 0.05; by = Seg.Chord;
            }
            int n = SegCount(by, value, g.R, g.Sw);
            for (int i = 1; i < n; i++)
            {
                double t = g.A1 + g.Sw * i / n;
                path.Add(cs.Points.Add(g.Cx + g.R * Math.Cos(t), g.Cy + g.R * Math.Sin(t), ""));
            }
        }
        path.Add(b);
        var links = new Link[path.Count - 1];
        for (int i = 0; i < links.Length; i++)
        {
            links[i] = cs.Links.Add(new[] { path[i], path[i + 1] }, "");
            foreach (string code in codes)
                links[i].Codes.TryAdd(code);
        }
        return links;
    }

    // โค้งผ่าน 3 จุด (pv = จุดผ่าน) · 3 จุดเรียงเส้นตรง = เตือน + เส้นตรง
    private static Link[] Arc3(CorridorState cs, string id, Pt? pa, Point a, Pt? pv, Pt? pb, Point b, Seg by, double value, params string[] codes)
    {
        if (a == null || b == null) return null;
        if (pv == null) { Warn(cs, CorridorError.Failure, id + ": ข้ามเพราะหาจุดที่โค้งผ่านไม่ได้"); return null; }
        string warn = ArcGeom(0, pa.Value, pb.Value, pv.Value, 0.0, false, false, out Arc g);
        return ArcLinks(cs, id, "โค้งผ่าน 3 จุด", a, b, warn, g, by, value, codes);
    }

    // โค้งเริ่ม-ปลาย-รัศมี · ccw = ทวนเข็มในกรอบ Side = Right (ฝั่ง Left ภาพกระจก = ทิศกลับ) · large = ทางยาว
    // รัศมี < ครึ่งระยะเริ่ม-ปลาย = เตือน + เส้นตรง
    private static Link[] ArcR(CorridorState cs, string id, Pt? pa, Point a, Pt? pb, Point b, double radius, bool ccw, bool large, double F, Seg by, double value, params string[] codes)
    {
        if (a == null || b == null) return null;
        string warn = ArcGeom(1, pa.Value, pb.Value, pa.Value, radius, ccw == (F > 0.0), large, out Arc g);
        return ArcLinks(cs, id, "โค้ง เริ่ม-ปลาย-รัศมี", a, b, warn, g, by, value, codes);
    }

    // โค้ง Fillet จากจุดสัมผัส pa ถึง pb ที่มุม pc
    private static Link[] Fillet(CorridorState cs, string id, Pt? pa, Point a, Pt? pc, Pt? pb, Point b, double radius, Seg by, double value, params string[] codes)
    {
        if (a == null || b == null) return null;
        if (pc == null) { Warn(cs, CorridorError.Failure, id + ": ข้ามเพราะหาจุดมุมไม่ได้"); return null; }
        string warn = ArcGeom(2, pa.Value, pb.Value, pc.Value, radius, false, false, out Arc g);
        return ArcLinks(cs, id, "โค้ง Fillet", a, b, warn, g, by, value, codes);
    }

    // ต่อ link ของ shape ตามลำดับ (เส้นโค้ง = หลายท่อน) · ส่วนที่วาดไม่ได้ (null) ให้ AddShape ข้าม + เตือน
    private static Link[] Join(params Link[][] parts)
    {
        var all = new List<Link>();
        foreach (Link[] p in parts)
        {
            if (p == null) all.Add(null);
            else all.AddRange(p);
        }
        return all.ToArray();
    }

    private static void AddShape(CorridorState cs, string id, Link[] links, params string[] codes)
    {
        foreach (Link l in links)
        {
            if (l == null) { Warn(cs, CorridorError.Failure, id + ": ข้ามเพราะมี link ที่วาดไม่ได้"); return; }
        }
        Shape shape = cs.Shapes.Add(links, "");
        foreach (string code in codes)
            shape.Codes.TryAdd(code);
    }

    private static PointInMem Abs(CorridorState cs, Pt p)
    {
        return new PointInMem { Station = cs.CurrentStation, Offset = cs.CurrentOffset + p.X, Elevation = cs.CurrentElevation + p.Y };
    }

    private static ObjectId TargetSurface(CorridorState cs, string name)
    {
        if (cs.Mode == CorridorMode.Layout) return ObjectId.Null;
        try { return cs.ParamsSurface.Value(name); }
        catch { return ObjectId.Null; }
    }

    // ระดับผิวดินที่ offset จริง (แบบเดียวกับ TryElevation ใน test2.cs)
    private static double Elevation(CorridorState cs, ObjectId surfaceId, double offset)
    {
        AcDb.TransactionManager tm = AcDb.HostApplicationServices.WorkingDatabase.TransactionManager;
        var surface = (Surface)tm.GetObject(surfaceId, AcDb.OpenMode.ForRead, false, false);
        var alignment = (Alignment)tm.GetObject(cs.CurrentAlignmentId, AcDb.OpenMode.ForRead, false, false);
        double x = 0.0, y = 0.0;
        alignment.PointLocation(cs.CurrentStation, offset, ref x, ref y);
        return surface.FindElevationAtXY(x, y);
    }

    private static long GetLong(CorridorState cs, string name, long defaultValue)
    {
        try { return cs.ParamsLong.Value(name); }
        catch { return defaultValue; }
    }

    private static double GetDouble(CorridorState cs, string name, double defaultValue)
    {
        try { return cs.ParamsDouble.Value(name); }
        catch { return defaultValue; }
    }

    private static void Warn(CorridorState cs, CorridorError error, string message)
    {
        cs.RecordError(error, CorridorErrorLevel.AsWarning, message, Source, true);
    }

""");
        }

        private static string Lc(string id) => id.ToLowerInvariant();
        private static string Codes(List<string> codes) => string.Concat(codes.Select(c => ", " + Str(c)));
        private static string Ident(string name) => char.ToLowerInvariant(name[0]) + name[1..];
        private static string Str(string s) => "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
    }

    // ---------------- อ่าน / แทนที่ช่วงมีป้ายในไฟล์ ----------------

    public record Block(int Start, int End, string Indent, string? SpecJson, string Text);   // Start/End = ตำแหน่งต้นบรรทัด BEGIN / หลังบรรทัด END

    public static Block? FindBlock(string source)
    {
        int b = source.IndexOf(BeginMark, StringComparison.Ordinal);
        if (b < 0) return null;
        int lineStart = source.LastIndexOf('\n', Math.Max(0, b - 1)) + 1;
        if (b > 0 && source[b - 1] != '\n' && source[lineStart..b].Trim().Length > 0) return null;
        int e = source.IndexOf(EndMark, b, StringComparison.Ordinal);
        if (e < 0) return null;
        int endLine = source.IndexOf('\n', e);
        int end = endLine < 0 ? source.Length : endLine + 1;
        string text = source[lineStart..end];
        string indent = source[lineStart..b];
        string? spec = null;
        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Trim();
            if (line.StartsWith(SpecPrefix.Trim())) spec = line[SpecPrefix.Trim().Length..].Trim();
            else if (line.StartsWith(SpecB64Prefix.Trim())) spec = Encoding.UTF8.GetString(Convert.FromBase64String(line[SpecB64Prefix.Trim().Length..].Trim()));
        }
        return new Block(lineStart, end, indent, spec, text);
    }

    // แทนที่ช่วงมีป้ายเดิมด้วยของใหม่ (ส่วนอื่นของไฟล์ไม่เปลี่ยนแม้แต่ไบต์เดียว; ขึ้นบรรทัดตามไฟล์เดิม)
    public static string ReplaceBlock(string source, Block block, string newBlockCrlf)
    {
        bool crlf = block.Text.Contains("\r\n") || (!block.Text.Contains('\n') && source.Contains("\r\n"));
        var nb = crlf ? newBlockCrlf : newBlockCrlf.Replace("\r\n", "\n");
        return source[..block.Start] + nb + source[block.End..];
    }

    // source map: id ของ point / link / shape ที่วาด -> เลขบรรทัด (1-based) ในข้อความทั้งไฟล์
    //   point = บรรทัดคำนวณพิกัด (Pt? P3 = ...) + บรรทัดเพิ่มลง CorridorState (AddPoint(cs, P3 ...))
    //   link = บรรทัด AddLink / FollowSurface · shape = บรรทัด AddShape
    // อ่านจากช่วง SA-DRAWING ของข้อความจริง จึงตรงกับไฟล์เสมอ ทั้งไฟล์ที่สร้างใหม่และไฟล์ที่ช่วงนี้อยู่กลางไฟล์
    // (นับรวมบรรทัด CALL / PARAM / TARGET ที่อยู่ก่อนหน้าแล้ว)
    private static readonly System.Text.RegularExpressions.Regex[] MapPatterns =
    {
        new(@"^\s*Pt\? (\w+) = (?!null;)"),
        new(@"^\s*Point \w+ = AddPoint\(cs, (\w+)"),
        new(@"^\s*Link \w+ = (?:AddLink|FollowSurface)\(cs, ""([^""]+)"""),
        new(@"^\s*Link\[\] \w+ = (?:Arc3|ArcR|Fillet)\(cs, ""([^""]+)"""),
        new(@"^\s*\w+ = Rotate\(cs, ""([^""]+)"""),
        new(@"^\s*Link(?:\[\])? \w+ = null;\s+// ([^:]+):"),
        new(@"^\s*// (\w+): (?:ไม่มีจุด|ปลาย \w+ เป็นจุด auxiliary)"),
        new(@"^\s*// (\w+) auxiliary:"),
        new(@"^\s*// (\w+): ใช้ link auxiliary"),
        new(@"^\s*AddShape\(cs, ""([^""]+)"""),
        new(@"^\s*// (\w+): มี link ที่ไม่มีอยู่จริง"),
    };
    public static Dictionary<string, List<int>> SourceMap(string source)
    {
        var map = new Dictionary<string, List<int>>(StringComparer.Ordinal);
        var block = FindBlock(source);
        if (block == null) return map;
        int line = 1;
        for (int i = 0; i < block.Start; i++) if (source[i] == '\n') line++;
        foreach (var raw in block.Text.Split('\n'))
        {
            foreach (var re in MapPatterns)
            {
                var m = re.Match(raw);
                if (!m.Success) continue;
                var id = m.Groups[1].Value;
                if (!map.TryGetValue(id, out var list)) map[id] = list = new List<int>();
                list.Add(line);
                break;
            }
            line++;
        }
        return map;
    }

    // ช่วงมีป้ายในไฟล์ยังตรงกับที่ spec สร้างไหม (ไม่ตรง = มีคนแก้ด้วยมือ)
    public static bool BlockMatchesSpec(Block block)
    {
        if (block.SpecJson == null) return false;
        try
        {
            var expected = GenerateBlock(DrawingSpec.Parse(block.SpecJson), block.SpecJson, block.Indent);
            return Norm(expected) == Norm(block.Text);
        }
        catch { return false; }
    }
    private static string Norm(string s) => string.Join("\n", s.Replace("\r\n", "\n").Split('\n').Select(l => l.TrimEnd()));

    // บรรทัดเรียกที่ไฟล์ต้องมี (ขาดบรรทัดไหน = ยังไม่ได้แทรก -> Milestone 4)
    public static List<string> MissingCalls(string source, DrawingSpec s)
    {
        var h = HelperClass(s);
        var miss = new List<string>();
        if (!source.Contains(h + ".Draw(") || !source.Contains(CallTag)) miss.Add(CallTag);
        if (s.Params.Count > 0 && (!source.Contains(h + ".AddParams(") || !source.Contains(ParamTag))) miss.Add(ParamTag);
        if (s.Targets.Count > 0 && (!source.Contains(h + ".AddTargets(") || !source.Contains(TargetTag))) miss.Add(TargetTag);
        return miss;
    }
}
