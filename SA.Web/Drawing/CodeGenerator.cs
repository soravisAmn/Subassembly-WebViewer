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
            foreach (var p in order) PointLine(p);
            L();

            L("        // ---- เพิ่มจุด / link / shape ลง CorridorState ----");
            foreach (var p in _s.Points)
                L($"        Point {Lc(p.Id)} = AddPoint(cs, {p.Id}{Codes(p.Codes)});");
            foreach (var l in _s.Links)
            {
                var (a, b) = l.Ends;
                if (!Exists(a) || !Exists(b)) { L($"        Link {Lc(l.Id)} = null;   // {l.Id}: ไม่มีจุดปลาย {(!Exists(a) ? a : b)}"); continue; }
                if (l.Follow)
                    L($"        Link {Lc(l.Id)} = FollowSurface(cs, \"{l.Id}\", {SurfVar(l.Target)}, {a}, {Lc(a)}, {b}, {Lc(b)}{Codes(l.Codes)});   // {l.Id} วิ่งตามผิวดิน");
                else
                    L($"        Link {Lc(l.Id)} = AddLink(cs, \"{l.Id}\", {Lc(a)}, {Lc(b)}{Codes(l.Codes)});");
            }
            foreach (var sh in _s.Shapes)
            {
                var ok = sh.Links.All(id => _s.Links.Any(l => l.Id == id));
                L(ok ? $"        AddShape(cs, \"{sh.Id}\", new[] {{ {string.Join(", ", sh.Links.Select(Lc))} }}{Codes(sh.Codes)});"
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
                case "external":
                    throw new FormatException($"{id}: จุดจากโค้ดเดิม (external) ใช้ได้กับไฟล์ที่เขียนเองเท่านั้น — รองรับใน Milestone 4");
                default:
                    throw new FormatException($"{id}: ไม่รู้จักชนิดจุด {d.Type}");
            }
        }

        // จุดที่ต้องคำนวณก่อน (from / a / b ...) มาก่อน; ไม่พึ่งกันคงลำดับเดิม; อ้างกันเป็นวง -> cyclic
        private List<SpecPoint> TopoOrder(out List<string> cyclic)
        {
            var done = new HashSet<string>(); var order = new List<SpecPoint>(); var cyc = new List<string>();
            var state = new Dictionary<string, int>();
            bool Visit(SpecPoint p)
            {
                if (done.Contains(p.Id)) return true;
                if (state.GetValueOrDefault(p.Id) == 1) return false;
                state[p.Id] = 1;
                bool ok = true;
                foreach (var r in p.Def.Refs())
                {
                    var q = _s.Points.FirstOrDefault(x => x.Id == r);
                    if (q != null && !Visit(q)) ok = false;
                }
                state[p.Id] = 2;
                if (ok) { done.Add(p.Id); order.Add(p); } else if (!cyc.Contains(p.Id)) cyc.Add(p.Id);
                return ok;
            }
            foreach (var p in _s.Points) Visit(p);
            // จุดที่พึ่งจุดในวงก็คำนวณไม่ได้ (อยู่ใน order แต่ from = null) — ประกาศจุดในวงไว้ก่อน
            cyclic = cyc;
            return order.Where(p => !cyc.Contains(p.Id)).ToList();
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
        new(@"^\s*Link \w+ = null;\s+// ([^:]+):"),
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
