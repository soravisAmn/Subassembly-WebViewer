// สร้างโค้ด C# จาก DrawingSpec ("แบบ ข" ใน docs/prompts/prompt.md ข้อ 6)
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
        "Seg", "Arc", "Delta", "Polar", "SlopeLength", "SlopeToSurface", "OnSurface", "Between", "Intersect", "Offset", "ExtendToGround", "Opt", "FollowClipped", "Tangent", "Rotate",
        "Arc3", "ArcR", "Fillet", "Join", "AddPoint", "AddLink", "AddShape", "FollowSurface", "Check", "Warn", "TargetSurface",
        "GetLong", "GetDouble", "Elevation", "Ground", "Exists", "PX", "PY", "Eq", "Try", "Cond", "Val", "V", "VN", "LoopN", "FirstOf", "Severe",
        // คำในนิพจน์ (and or not true false — ไม่สนตัวพิมพ์ ตรวจใน IsReservedName)
        "abstract","as","base","bool","break","byte","case","catch","char","checked","class","const","continue","decimal","default",
        "delegate","do","double","else","enum","event","explicit","extern","false","finally","fixed","float","for","foreach","goto",
        "if","implicit","in","int","interface","internal","is","lock","long","namespace","new","null","object","operator","out",
        "override","params","private","protected","public","readonly","ref","return","sbyte","sealed","short","sizeof","stackalloc",
        "static","string","struct","switch","this","throw","true","try","typeof","uint","ulong","unchecked","unsafe","ushort","using",
        "virtual","void","volatile","while","var","Math","Point","Link","Shape","ObjectId"
    };
    public static bool IsReservedName(string n) => Reserved.Contains(n) || SpecExpr.Keywords.Contains(n)
        || System.Text.RegularExpressions.Regex.IsMatch(n, @"^([PpLlSsBbDd]\d+|surface\d+)$");

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
            foreach (var p in s.Params) sb.AppendLine($"//   {p.Name} ({p.Kind}, default {UnitNum(p, p.Default)}{Bounds(p)}){(string.IsNullOrEmpty(p.DisplayName) || p.DisplayName == p.Name ? "" : " — " + p.DisplayName)}{ParamNote(p)}");
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
    // ชนิดค่าของ parameter ในข้อความเตือน: slope = 1:x · length = x m · percent = x% (ตรงกับ fmtUnit ใน spec.js)
    private static string UnitPre(string? unit) => unit == "slope" ? "1:" : "";
    private static string UnitSuf(string? unit) => unit switch { "length" => " m", "percent" => "%", _ => "" };
    private static string UnitNum(SpecParam p, double v) => UnitPre(p.Unit) + Num(v) + UnitSuf(p.Unit);
    private static string Bounds(SpecParam p) =>
        p.Min != null && p.Max != null ? $", {UnitNum(p, p.Min.Value)}–{UnitNum(p, p.Max.Value)}" :
        p.Min != null ? $", ไม่น้อยกว่า {UnitNum(p, p.Min.Value)}" : p.Max != null ? $", ไม่เกิน {UnitNum(p, p.Max.Value)}" : "";

    // ---------------- ตัวสร้างเนื้อหา class ----------------

    private class Gen
    {
        private readonly DrawingSpec _s;
        private readonly StringBuilder _o = new();
        private readonly HashSet<string> _names;
        private readonly Dictionary<string, string> _surf = new();   // ชื่อ target -> ตัวแปร ObjectId
        private readonly ExprScope _scope;
        private readonly SpecLogic _logic;
        // variable ที่ไม่รู้ค่าได้ (อ้างจุด / เงื่อนไข / variable แบบนี้ / วนกัน) = double? — คำนวณหลัง TopoOrder ก่อนเขียนบรรทัดแรกที่ใช้
        private readonly HashSet<string> _runtimeVars = new();
        // Array แบบ Loop (รอบ 5b): object id -> (array, ชุดที่ k) · ชุดที่ k เกิดเมื่อ N_A1 > k
        private readonly Dictionary<string, (SpecArray G, int K)> _loopOf = new();
        private IEnumerable<SpecArray> Loops => _s.Arrays.Where(g => g.Loop != null);

        public Gen(DrawingSpec s)
        {
            _s = s;
            _names = s.Params.Select(p => p.Name).ToHashSet();
            _logic = s.Logic ?? new SpecLogic();
            CheckLogicNames();
            foreach (var g in s.Arrays.Where(g => g.Loop != null))
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(g.Id, @"^A\d+$")) throw new FormatException($"ชื่อ Array '{g.Id}' ใช้ไม่ได้");
                if (g.Loop!.NMax < 2 || g.Loop.NMax > 50) throw new FormatException($"Array {g.Id}: สูงสุดต้อง 2–50 ชุด");
                for (int k = 1; k <= g.Members.Count; k++)
                    foreach (var id in g.Members[k - 1].Points.Concat(g.Members[k - 1].Links).Concat(g.Members[k - 1].Shapes)) _loopOf[id] = (g, k);
            }
            // นิพจน์อ้างจุดได้ (จุดที่ไม่มี = หาไม่ได้ตอนรัน แบบเดียวกับในเว็บ) · ไฟล์ import ใช้ target ของโค้ดเดิม = ไม่ตรวจชื่อ
            _scope = new ExprScope
            {
                Params = _names.Concat(_logic.Variables.Select(v => v.Name)).ToHashSet(), Points = s.Points.Select(p => p.Id).ToHashSet(), AllowMissingPoints = true,
                Conds = _logic.Conditions.Select(c => c.Name).ToHashSet(), Nullable = _runtimeVars,
                Targets = s.Imported ? null : s.Targets.Select(t => t.Name).ToHashSet(), Surface = SurfVar, ArrayCount = ArrayCountCs
            };
            foreach (var p in s.Params)
                if (IsReservedName(p.Name)) throw new FormatException($"ตั้งชื่อ parameter ว่า {p.Name} ไม่ได้ (ชื่อนี้โค้ดใช้เอง)");
            if (!System.Text.RegularExpressions.Regex.IsMatch(s.ClassName, @"^[A-Za-z_][A-Za-z0-9_]*$"))
                throw new FormatException($"ชื่อ class '{s.ClassName}' ใช้ใน C# ไม่ได้");
        }

        // ชื่อในโค้ด C#: เงื่อนไข (bool?) / decision (D1) / กิ่ง (B1) ต้องเป็นชื่อตัวแปรได้ และไม่ซ้ำกับ parameter / จุด / กันเอง
        private void CheckLogicNames()
        {
            var used = new HashSet<string>(_names.Concat(_s.Points.Select(p => p.Id)));
            void Name(string n, string what)
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(n ?? "", @"^[A-Za-z_][A-Za-z0-9_]*$")) throw new FormatException($"{what} '{n}' ใช้เป็นชื่อในโค้ดไม่ได้ (ตัวอังกฤษ / ตัวเลข / _)");
                if (Reserved.Contains(n!) || SpecExpr.Keywords.Contains(n!)) throw new FormatException($"ตั้งชื่อ{what}ว่า {n} ไม่ได้ (ชื่อนี้โค้ดใช้เอง)");
                if (!used.Add(n!)) throw new FormatException($"ชื่อ{what} {n} ซ้ำกับ parameter / จุด / ชื่ออื่น");
            }
            foreach (var c in _logic.Conditions) Name(c.Name, "เงื่อนไข");
            foreach (var v in _logic.Variables) { Name(v.Name, " variable"); if (v.Kind != "double") throw new FormatException($"variable {v.Name}: ชนิด {v.Kind} ยังไม่รองรับ"); }
            foreach (var d in _logic.Decisions) Name(d.Id, " decision");
            foreach (var b in _logic.Branches) Name(b.Id, "กิ่ง");
        }

        private void L(string line = "") => _o.AppendLine(line);
        private string X(string? src, string what, string id, int need = 0, string want = "num")
        {
            try { return SpecExpr.ToCs(src, _scope, need, want); }
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
                L($"        {add}.DisplayName = {Str(string.IsNullOrEmpty(p.DisplayName) ? p.Name : p.DisplayName!)};{(ParamNote(p) is { Length: > 0 } n ? "   //" + n[2..] : "")}");
            }
            L("    }");
            L();
        }

        private void DrawMethod()
        {
            L("    internal static void Draw(CorridorState cs)");
            L("    {");
            // parameter
            if (_s.Params.Count > 0) L("        // ---- parameter (≤ 0 ที่ต้องมากกว่า 0 = error + ใช้ default · นอกขอบเขต = ใช้ค่าขอบแทน + เตือน) ----");
            foreach (var p in _s.Params)
            {
                bool lng = p.Kind == "long";
                L(lng ? $"        long {p.Name} = GetLong(cs, \"{p.Name}\", {Math.Round(p.Default):0});"
                      : $"        double {p.Name} = GetDouble(cs, \"{p.Name}\", {SpecExpr.Lit(p.Default)});");
                string def = lng ? $"{Math.Round(p.Default):0}" : SpecExpr.Lit(p.Default);
                // ชนิดค่า (รอบ 4e): ข้อความเตือนแสดงแบบ 1:x / m / % ตรงกับ fmtParam ใน spec.js
                string pre = UnitPre(p.Unit), suf = UnitSuf(p.Unit);
                string U(double v) => pre + Num(v) + suf;
                string cur = $"\"{p.Name} = {pre}\" + {p.Name} + \"{suf}";
                if (p.Positive)
                    L($"        if ({p.Name} <= 0) {{ Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, {cur} ต้องมากกว่า 0, ใช้ค่า default {U(p.Default)} แทน\"); {p.Name} = {def}; }}");
                if (p.Min != null)
                    L($"        if ({p.Name} < {SpecExpr.Lit(p.Min.Value)}) {{ Warn(cs, CorridorError.ValueTooSmall, {cur} < {U(p.Min.Value)}, ใช้ {U(p.Min.Value)} แทน\"); {p.Name} = {(lng ? $"(long){SpecExpr.Lit(p.Min.Value)}" : SpecExpr.Lit(p.Min.Value))}; }}");
                if (p.Max != null)
                    L($"        if ({p.Name} > {SpecExpr.Lit(p.Max.Value)}) {{ Warn(cs, CorridorError.ValueTooLarge, {cur} > {U(p.Max.Value)}, ใช้ {U(p.Max.Value)} แทน\"); {p.Name} = {(lng ? $"(long){SpecExpr.Lit(p.Max.Value)}" : SpecExpr.Lit(p.Max.Value))}; }}");
            }
            if (_s.Side is { Mirror: true } sd && _s.Params.Any(p => p.Name == sd.Param))
                L($"        double F = {sd.Param} == 1 ? -1.0 : 1.0;   // {sd.Param} = 1 (Left) -> กลับด้านแนวราบทั้งหมด");
            else
                L("        double F = 1.0;");
            L();

            // surface ที่ต้องใช้
            var usesSurface = _s.Points.Where(p => p.Def.Type is "slopeToSurface" or "onSurface" or "extendToGround").Select(p => p.Def.Target)
                .Concat(_s.Links.Where(l => l.Follow || l.IsClipped).Select(l => l.Target))
                // ground() / hasGround() ในนิพจน์
                .Concat(_s.Points.SelectMany(p => p.Def.Exprs()).Concat(_s.Links.SelectMany(LinkExprs)).Concat(_s.Rotations.Select(g => g.Angle))
                    .Concat(_logic.Conditions.Select(c => c.Expr)).Concat(_logic.Decisions.Select(d => d.Test)).Concat(_logic.Variables.SelectMany(v => v.Exprs()))
                    .SelectMany(SpecExpr.GroundTargets)).ToList();
            if (usesSurface.Count > 0)
            {
                L("        // ---- target surface (Layout mode / ไม่ได้กำหนด = วาดแบบไม่มีดิน) ----");
                foreach (var t in usesSurface.Select(t => string.IsNullOrEmpty(t) ? "TargetSurface" : t!).Distinct())
                    L($"        ObjectId {SurfVar(t)} = TargetSurface(cs, \"{t}\");");
                L();
            }

            // พิกัดของจุด (ตามลำดับที่ต้องคำนวณก่อน-หลัง)
            L("        // ---- พิกัดของจุด (เทียบ origin; null = หาจุดนี้ไม่ได้ ส่วนที่พึ่งจุดนี้จะถูกข้าม) ----");
            if (_logic.Conditions.Count > 0 || _logic.Decisions.Count > 0)
                L("        // (เงื่อนไข / กิ่ง: bool? = null คือไม่รู้ค่า เพราะหาจุดที่อ้างไม่ได้ -> ไม่เข้ากิ่งไหน · object ในกิ่งที่ไม่เกิด = null ไม่เพิ่มลง Civil 3D)");
            var order = TopoOrder(out var cyclic);
            ComputeRuntimeVars(cyclic);
            foreach (var key in cyclic)
            {
                if (key.StartsWith("#L"))
                {
                    L($"        int N_{key[2..]} = 1;");
                    L($"        Warn(cs, CorridorError.Failure, \"Array {key[2..]}: หาจำนวนชุดไม่ได้ ใช้ 1\");");
                }
                else if (key.StartsWith('$'))
                {
                    L($"        double? {key[1..]} = null;");
                    L($"        Warn(cs, CorridorError.Failure, \"{key[1..]} อ้างถึงตัวเองเป็นวง\");");
                }
                else if (key.StartsWith('?'))
                {
                    L($"        bool? {key[1..]} = null;");
                    L($"        Warn(cs, CorridorError.Failure, \"เงื่อนไข {key[1..]} อ้างถึงตัวเองเป็นวง\");");
                }
                else if (key.StartsWith('!'))
                {
                    foreach (var b in _logic.Branches.Where(b => b.Decision == key[1..])) L($"        bool {b.Id} = false;");
                    L($"        Warn(cs, CorridorError.Failure, \"{key[1..]}: อ้างถึงตัวเองเป็นวง\");");
                }
                else
                {
                    L($"        Pt? {key} = null;");
                    L($"        Warn(cs, CorridorError.Failure, \"{key}: จุด {key} อ้างถึงตัวเองเป็นวง\");");
                }
            }
            foreach (var o in order)
            {
                if (o is SpecPoint p) PointLine(p);
                else if (o is SpecCondition c) ConditionLine(c);
                else if (o is SpecDecision d) DecisionLines(d);
                else if (o is SpecVariable v) VariableLines(v);
                else if (o is SpecArray g) LoopLine(g);
                else RotationLines((SpecRotation)o);
            }
            L();

            L("        // ---- เพิ่มจุด / link / shape ลง CorridorState ----");
            foreach (var p in _s.Points)
                // จุด auxiliary: ไม่ประกาศตัวแปร Point (ไม่มีใครใช้ — กันคำเตือน CS0219 ของ compiler)
                L(p.Auxiliary ? $"        // {p.Id} auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D"
                              : $"        Point {Lc(p.Id)} = {InGate(p.Branch, p.Id, $"AddPoint(cs, {p.Id}{Codes(p.Codes)})")};{BrNote(p.Branch)}");
            // ปลายจริง (firstOf auxiliary) ที่ link จริงใช้: Point = ของจุดแรกในรายการที่เกิด (ไม่ Points.Add ซ้ำ)
            var aliasUsed = _s.Links.Where(l => !l.Auxiliary).SelectMany(l => new[] { l.Ends.A, l.Ends.B })
                                    .Where(id => IsAlias(id) && AuxEnd(id) == null).Distinct().ToHashSet();
            foreach (var p in _s.Points.Where(p => aliasUsed.Contains(p.Id)))
                L($"        Point {Lc(p.Id)} = {AliasExpr(p.Id, new HashSet<string>())};   // {p.Id} ปลายจริง = จุดแรกที่เกิดใน {string.Join(", ", p.Def.Points ?? new())}");
            foreach (var l in _s.Links)
            {
                var (a, b) = l.Ends;
                // link auxiliary: ไม่มีตัวแปร Link / ไม่ Links.Add (และโค้งไม่ Points.Add จุดระหว่างทาง) — บรรทัดนี้ไว้ให้ codelink กระโดดมา
                if (l.Auxiliary) { L($"        // {l.Id} auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D"); continue; }
                // เส้นโค้ง = หลายท่อน: ตัวแปรเป็น Link[]
                string lt = l.IsMulti ? "Link[]" : "Link";
                var need = new[] { a, b }.Concat(l.Type == "arc3" ? new[] { l.Via ?? "" } : l.Type == "fillet" ? new[] { l.Corner ?? "" } : Array.Empty<string>());
                var missing = need.FirstOrDefault(id => !Exists(id));
                // link ที่ข้าม: ประกาศตัวแปร null เฉพาะเมื่อ shape ใช้ (ไม่งั้น compiler เตือน CS0219)
                bool used = _s.Shapes.Any(sh => sh.Links.Contains(l.Id));
                string skip = used ? $"        {lt} {Lc(l.Id)} = null;   // " : "        // ";
                if (missing != null) { L($"{skip}{l.Id}: ไม่มีจุด {missing}"); continue; }
                var aux = new[] { a, b }.Select(AuxEnd).FirstOrDefault(id => id != null);
                // เตือนเฉพาะเมื่อกิ่งของ link นี้เกิด (แบบในเว็บ)
                string whenOn = l.Branch != null ? $"if ({Br(l.Branch)}) " : "";
                if (aux != null)
                {
                    L($"{skip}{l.Id}: ปลาย {aux} เป็นจุด auxiliary");
                    L($"        {whenOn}Warn(cs, CorridorError.Failure, \"{l.Id}: ปลาย {aux} เป็นจุด auxiliary (ไม่อยู่ใน Civil 3D)\");");
                    continue;
                }
                if (l.IsArc)
                {
                    var sg = l.Seg ?? new SpecSeg();
                    string seg = $"{(sg.By == "count" ? "Seg.Count" : "Seg.Chord")}, {X(sg.Value ?? "0.05", "ท่อนโค้ง", l.Id)}";
                    string cc = Codes(l.Codes);
                    // รัศมี / ความละเอียดอ้างจุด: หาจุดไม่ได้ = link นี้หาไม่ได้ + เตือน (แบบเดียวกับในเว็บ)
                    bool wrap = UsesRuntime(LinkExprs(l));
                    string W(string call) => InGate(l.Branch, l.Id, wrap ? $"Try(cs, \"{l.Id}\", () => {call})" : call);
                    if (l.Type == "arc3")
                        L($"        Link[] {Lc(l.Id)} = {W($"Arc3(cs, \"{l.Id}\", {a}, {Lc(a)}, {l.Via}, {b}, {Lc(b)}, {seg}{cc})")};   // {l.Id} โค้งผ่าน {a} {l.Via} {b}{BrTag(l.Branch)}");
                    else if (l.Type == "arcR")
                        L($"        Link[] {Lc(l.Id)} = {W($"ArcR(cs, \"{l.Id}\", {a}, {Lc(a)}, {b}, {Lc(b)}, {X(l.Radius, "radius", l.Id)}, {(l.Sweep == "cw" ? "false" : "true")}, {(l.Large ? "true" : "false")}, F, {seg}{cc})")};   // {l.Id} โค้งรัศมี {(l.Sweep == "cw" ? "ตามเข็ม" : "ทวนเข็ม")}{(l.Large ? " ทางยาว" : "")} (กรอบ Side = Right){BrTag(l.Branch)}");
                    else
                        L($"        Link[] {Lc(l.Id)} = {W($"Fillet(cs, \"{l.Id}\", {a}, {Lc(a)}, {l.Corner}, {b}, {Lc(b)}, {X(l.Radius, "radius", l.Id)}, {seg}{cc})")};   // {l.Id} Fillet ที่มุม {l.Corner}{BrTag(l.Branch)}");
                    continue;
                }
                if (l.IsClipped)
                {
                    // เส้นอ้างอิง: link เส้นตรง (ปลายทั้งสอง) หรือระดับคงที่ (2 จุดสมมติบนระดับนั้น)
                    var rl = l.RefLink != null ? _s.Links.FirstOrDefault(x => x.Id == l.RefLink) : null;
                    if (l.RefLink != null && (rl == null || rl.Points is not { Count: >= 2 } || rl.Type != null))
                    {
                        L($"{skip}{l.Id}: เส้นอ้างอิง {l.RefLink} ต้องเป็น link เส้นตรง");
                        L($"        {whenOn}Warn(cs, CorridorError.Failure, \"{l.Id}: เส้นอ้างอิง {l.RefLink} ต้องเป็น link เส้นตรง\");");
                        continue;
                    }
                    string r1, r2;
                    if (rl != null) { var (rp, rq) = rl.Ends; r1 = Exists(rp) ? rp : "null"; r2 = Exists(rq) ? rq : "null"; }
                    else { string lv = X(l.RefLevel ?? "0", "ระดับอ้างอิง", l.Id); r1 = $"new Pt(0.0, {lv})"; r2 = $"new Pt(1.0, {lv})"; }
                    string Arr(List<string> c) => c.Count == 0 ? "new string[0]" : $"new[] {{ {string.Join(", ", c.Select(Str))} }}";
                    bool above = l.Side == "above";
                    string call = $"FollowClipped(cs, \"{l.Id}\", {SurfVar(l.Target)}, {a}, {Lc(a)}, {b}, {Lc(b)}, {r1}, {r2}, {(above ? "false" : "true")}, {Arr(l.Codes)}, {Arr(l.CodesGround)}, {Arr(l.CodesLine)})";
                    bool wrap = UsesRuntime(LinkExprs(l));
                    L($"        Link[] {Lc(l.Id)} = {InGate(l.Branch, l.Id, wrap ? $"Try(cs, \"{l.Id}\", () => {call})" : call)};   // {l.Id} ตามดิน ไม่{(above ? "ต่ำ" : "สูง")}กว่า{(rl != null ? $"เส้น {l.RefLink}" : $"ระดับ {l.RefLevel}")}{BrTag(l.Branch)}");
                    continue;
                }
                if (l.Follow)
                    L($"        Link {Lc(l.Id)} = {InGate(l.Branch, l.Id, $"FollowSurface(cs, \"{l.Id}\", {SurfVar(l.Target)}, {a}, {Lc(a)}, {b}, {Lc(b)}{Codes(l.Codes)})")};   // {l.Id} วิ่งตามผิวดิน{BrTag(l.Branch)}");
                else
                    L($"        Link {Lc(l.Id)} = {InGate(l.Branch, l.Id, $"AddLink(cs, \"{l.Id}\", {Lc(a)}, {Lc(b)}{Codes(l.Codes)})")};{BrNote(l.Branch)}");
            }
            foreach (var sh in _s.Shapes)
            {
                var ok = sh.Links.All(id => _s.Links.Any(l => l.Id == id));
                // shape ใน Civil 3D ประกอบจาก link จริงเท่านั้น
                var ax = ok ? sh.Links.FirstOrDefault(id => _s.Links.First(l => l.Id == id).Auxiliary) : null;
                string shOn = Gate(sh.Branch, sh.Id) is { } shg ? $"if ({shg}) " : "";
                if (ax != null)
                {
                    L($"        // {sh.Id}: ใช้ link auxiliary {ax} — ข้าม");
                    L($"        {shOn}Warn(cs, CorridorError.Failure, \"{sh.Id}: ใช้ link auxiliary {ax} ไม่ได้ (ไม่อยู่ใน Civil 3D)\");");
                    continue;
                }
                // มีเส้นโค้ง (Link[]) = ต่อ array ตามลำดับด้วย Join
                // link optional (ต่อลงถึงดิน) = Opt(...) ข้ามเมื่อ null
                bool Opt(string id) => _s.Links.Any(l => l.Id == id && l.Optional && !l.Auxiliary);
                bool arcs = sh.Links.Any(id => _s.Links.Any(l => l.Id == id && l.IsMulti) || Opt(id));
                string list = arcs ? $"Join({string.Join(", ", sh.Links.Select(id => Opt(id) ? $"Opt({Lc(id)})" : _s.Links.First(l => l.Id == id).IsMulti ? Lc(id) : $"new[] {{ {Lc(id)} }}"))})"
                                   : $"new[] {{ {string.Join(", ", sh.Links.Select(Lc))} }}";
                L(ok ? $"        {shOn}AddShape(cs, \"{sh.Id}\", {list}{Codes(sh.Codes)});{BrNote(sh.Branch)}"
                     : $"        // {sh.Id}: มี link ที่ไม่มีอยู่จริง ข้าม");
            }
            L("    }");
            L();
        }

        private bool Exists(string id) => _s.Points.Any(p => p.Id == id);
        // ปลายจริง = จุด firstOf ที่เป็น auxiliary (ตรงกับ isAlias / auxEnd ใน spec.js)
        private bool IsAlias(string id) => _s.Points.FirstOrDefault(p => p.Id == id) is { Auxiliary: true } p && p.Def.Type is "firstOf" or "lastOf";
        private string? AuxEnd(string id) => AuxEnd(id, new HashSet<string>());
        private string? AuxEnd(string id, HashSet<string> seen)
        {
            var p = _s.Points.FirstOrDefault(x => x.Id == id);
            if (p == null) return null;
            if (!IsAlias(id)) return p.Auxiliary ? id : null;
            if (!seen.Add(id)) return null;
            return (p.Def.Points ?? new()).Any(m => AuxEnd(m, seen) != null) ? id : null;
        }
        // Point ของปลายจริง: P8 == null ? null : (P7 != null ? p7 : P3 != null ? p3 : null)
        private string AliasExpr(string id, HashSet<string> seen)
        {
            seen.Add(id);
            var members = (_s.Points.First(p => p.Id == id).Def.Points ?? new()).Where(m => Exists(m) && !seen.Contains(m)).ToList();
            string chain = "null";
            for (int i = members.Count - 1; i >= 0; i--)
            {
                string m = members[i], pt = IsAlias(m) ? $"({AliasExpr(m, seen)})" : Lc(m);
                chain = $"{m} != null ? {pt} : {chain}";
            }
            return $"{id} == null ? null : ({chain})";
        }
        private static IEnumerable<string?> LinkExprs(SpecLink l) => new[] { l.Radius, l.Seg?.Value, l.RefLevel };

        private void PointLine(SpecPoint p)
        {
            var d = p.Def;
            string id = p.Id, Q = Str(id);
            // อ้างจุดที่ไม่มีอยู่ = จุดนี้หาไม่ได้ (แบบเดียวกับใน JS) ไม่ทำให้ทั้งไฟล์สร้างไม่ได้
            string From(string? f) => string.IsNullOrEmpty(f) ? "Pt.Origin" : Exists(f!) ? f! : "null";
            string Dir() => d.Dir == -1 ? "-F" : "F";
            string Ex(string? e, string what, int need = 0) => X(e, what, id, need);
            var (rhs, note) = d.Type switch
            {
                "origin" => ("Pt.Origin", $"{id} origin"),
                "delta" => ($"Delta(cs, {Q}, {From(d.From)}, F * {Ex(d.Dx, "dx", 1)}, {Ex(d.Dy, "dy")})", $"{id} ห่างจาก {d.From ?? "origin"}"),
                "polar" => ($"Polar(cs, {Q}, {From(d.From)}, {Ex(d.Length, "length")}, {Ex(d.Angle, "angle")}, F)", $"{id} ระยะ + มุม จาก {d.From ?? "origin"}"),
                "slopeLength" => ($"SlopeLength(cs, {Q}, {From(d.From)}, {Ex(d.Slope, "slope")}, {Ex(d.Length, "length")}, {Dir()}, {d.Measure switch { "dx" => "Measure.Dx", "dy" => "Measure.Dy", _ => "Measure.Along" }})",
                                  $"{id} ลาด + ความยาว จาก {d.From ?? "origin"}"),
                "slopeToSurface" => ($"SlopeToSurface(cs, {Q}, {SurfVar(d.Target)}, {From(d.From)}, {Ex(d.Slope, "slope")}, {Dir()}, {Ex(d.MaxDistance ?? "50", "maxDistance")}, {Ex(d.LayoutLength ?? "3", "layoutLength")})",
                                     $"{id} ลาดจนชนดิน"),
                "onSurface" => ($"OnSurface(cs, {Q}, {SurfVar(d.Target)}, {From(d.From)}, F * {Ex(d.Dx, "dx", 1)})", $"{id} บนผิวดิน"),
                "between" => ($"Between(cs, {Q}, {From(d.A)}, {From(d.B)}, {Ex(d.T, "t")})", $"{id} บนเส้น {d.A}-{d.B}"),
                "intersect" => ($"Intersect(cs, {Q}, {From(d.A1)}, {From(d.A2)}, {From(d.B1)}, {From(d.B2)})", $"{id} จุดตัด {d.A1}-{d.A2} กับ {d.B1}-{d.B2}"),
                "offset" => ($"Offset(cs, {Q}, {From(d.A)}, {From(d.B)}, {(d.End == "b" ? From(d.B) : From(d.A))}, F * {(d.Side == -1 ? "-1.0" : "1.0")} * {Ex(d.Dist, "dist", 1)})",
                             $"{id} offset ปลาย {(d.End == "b" ? d.B : d.A)} ของเส้น {d.A}-{d.B} ไปทาง{(d.Side == -1 ? "ขวา" : "ซ้าย")}ของทิศ {d.A}→{d.B}"),
                "extendToGround" => ($"ExtendToGround(cs, {Q}, {SurfVar(d.Target)}, {From(d.From)}, {From(d.Along)}, {Ex(d.MaxDistance ?? "50", "maxDistance")})",
                                     $"{id} ต่อเส้น {d.Along}→{d.From} ลงถึงดิน (ไม่ลอย / ไม่มีดิน = ไม่เกิด)"),
                "tangent" => ($"Tangent(cs, {Q}, {From(d.Corner)}, {From(d.Toward)}, {From(d.Other)}, {Ex(d.Radius, "radius")})", $"{id} จุดสัมผัสของ Fillet ที่มุม {d.Corner}"),
                "firstOf" => ($"FirstOf(cs, {Q}{string.Concat((d.Points ?? new()).Select(x => ", " + From(x)))})", $"{id} จุดแรกที่เกิดใน {string.Join(", ", d.Points ?? new())}"),
                "lastOf" => ($"FirstOf(cs, {Q}{string.Concat((d.Points ?? new()).Select(x => ", " + From(x)))})", $"{id} จุด {d.Point} ของชุดสุดท้ายของ {d.Array} (ไล่ {string.Join(", ", d.Points ?? new())})"),
                "external" => throw new FormatException($"{id}: จุดจากโค้ดเดิม (external) ใช้ได้กับไฟล์ที่เขียนเองเท่านั้น — รองรับใน Milestone 4"),
                _ => throw new FormatException($"{id}: ไม่รู้จักชนิดจุด {d.Type}")
            };
            // นิพจน์ที่อ้างจุด (P3.y, ground(P3) ...): จุดที่อ้างหาไม่ได้ = จุดนี้หาไม่ได้ + เตือน (แบบเดียวกับในเว็บ) ไม่ทำให้ Draw ล้มทั้งตัว
            if (UsesRuntime(d.Exprs())) rhs = $"Try(cs, {Q}, () => {rhs})";
            L($"        Pt? {id} = {InGate(p.Branch, p.Id, rhs)};   // {note}{BrTag(p.Branch)}{LoopTag(p.Id)}");
        }

        // กลุ่มหมุน: สมาชิกคำนวณตาม def ก่อน (ค่าก่อนหมุน) แล้ว Rotate ทีละจุดรอบ pivot
        private void RotationLines(SpecRotation g)
        {
            string pv = Exists(g.Pivot) ? g.Pivot : "null", a = X(g.Angle, "มุมหมุน", g.Id, 1);
            L($"        // กลุ่มหมุน {g.Id}: หมุนรอบ {g.Pivot} มุม {g.Angle}° (ทวนเข็ม + ในกรอบ Side = Right)");
            bool wrap = UsesRuntime(new[] { g.Angle });    // มุมอ้างจุด / เงื่อนไข: หาไม่ได้ = สมาชิกหาไม่ได้ + เตือน
            foreach (var m in g.Points.Where(Exists))
                L(wrap ? $"        {m} = Try(cs, \"{m}\", () => Rotate(cs, \"{m}\", {m}, {pv}, F * {a}));"
                       : $"        {m} = Rotate(cs, \"{m}\", {m}, {pv}, F * {a});");
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
            // จุดที่ viewer (จุด / null = เงื่อนไข) อ้าง: คำนวณก่อน + ถ้าเห็นค่าที่หมุนแล้วต้องหลังบรรทัดหมุน
            bool NeedPt(string r, string? viewer)
            {
                var q = _s.Points.FirstOrDefault(x => x.Id == r);
                if (q == null) return true;
                bool ok = Visit(q);
                if (groupOf.TryGetValue(r, out var g) && (viewer == null || (groupOf.GetValueOrDefault(viewer) != g && !pre[g.Id].Contains(viewer))) && !VisitRot(g)) ok = false;
                return ok;
            }
            // เงื่อนไข: จุดในนิพจน์ + เงื่อนไขอื่นที่อ้าง
            bool VisitCond(SpecCondition c)
            {
                string key = "?" + c.Name;
                if (done.Contains(key)) return true;
                if (state.GetValueOrDefault(key) == 1) return false;
                state[key] = 1;
                bool ok = SpecExpr.PointRefs(c.Expr).All(r => NeedPt(r, null)) & CondDeps(c.Expr).All(VisitCond) & VarDeps(c.Expr).All(VisitVar) & LoopDeps(c.Expr).All(VisitLoop);
                state[key] = 2;
                if (ok) { done.Add(key); order.Add(c); } else if (!cyc.Contains(key)) cyc.Add(key);
                return ok;
            }
            // variable (รอบ 5): จุด / เงื่อนไข / variable อื่นในนิพจน์ทั้งหมด (ค่าปกติ + rules)
            bool VisitVar(SpecVariable v)
            {
                string key = "$" + v.Name;
                if (done.Contains(key)) return true;
                if (state.GetValueOrDefault(key) == 1) return false;
                state[key] = 1;
                bool ok = true;
                foreach (var e in v.Exprs()) ok &= SpecExpr.PointRefs(e).All(r => NeedPt(r, null)) & CondDeps(e).All(VisitCond) & VarDeps(e).All(VisitVar) & LoopDeps(e).All(VisitLoop);
                state[key] = 2;
                if (ok) { done.Add(key); order.Add(v); } else if (!cyc.Contains(key)) cyc.Add(key);
                return ok;
            }
            // decision (+ บรรทัดกิ่งของมัน): test + กิ่งแม่
            bool VisitDec(SpecDecision d)
            {
                string key = "!" + d.Id;
                if (done.Contains(key)) return true;
                if (state.GetValueOrDefault(key) == 1) return false;
                state[key] = 1;
                bool ok = SpecExpr.PointRefs(d.Test).All(r => NeedPt(r, null)) & CondDeps(d.Test).All(VisitCond) & VarDeps(d.Test).All(VisitVar) & LoopDeps(d.Test).All(VisitLoop);
                if (d.Parent != null && DecOf(d.Parent) is { } pd && !VisitDec(pd)) ok = false;
                state[key] = 2;
                if (ok) { done.Add(key); order.Add(d); } else if (!cyc.Contains(key)) cyc.Add(key);
                return ok;
            }
            bool VisitBranch(string? branch) => branch == null || DecOf(branch) is not { } d || VisitDec(d);
            // Loop (รอบ 5b): N คำนวณก่อนชุดแรกที่ใช้ · นิพจน์ N อ้างจุด / เงื่อนไข / variable ได้
            bool VisitLoop(SpecArray g)
            {
                string key = "#L" + g.Id;
                if (done.Contains(key)) return true;
                if (state.GetValueOrDefault(key) == 1) return false;
                state[key] = 1;
                string? e = g.Loop!.N;
                bool ok = SpecExpr.PointRefs(e).All(r => NeedPt(r, null)) & CondDeps(e).All(VisitCond) & VarDeps(e).All(VisitVar) & LoopDeps(e).All(VisitLoop);
                state[key] = 2;
                if (ok) { done.Add(key); order.Add(g); } else if (!cyc.Contains(key)) cyc.Add(key);
                return ok;
            }
            bool VisitLoopOf(string id) => !_loopOf.TryGetValue(id, out var lp) || VisitLoop(lp.G);
            bool VisitRot(SpecRotation g)
            {
                string key = "#" + g.Id;
                if (done.Contains(key)) return true;
                if (state.GetValueOrDefault(key) == 1) return false;
                state[key] = 1;
                bool ok = VarDeps(g.Angle).All(VisitVar);
                foreach (var id in g.Points.Append(g.Pivot).Concat(SpecExpr.PointRefs(g.Angle)))
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
                // อ้างสมาชิกกลุ่มหมุนแบบเห็นค่าที่หมุนแล้ว = ต้องอยู่หลังบรรทัดหมุนของกลุ่มนั้น (NeedPt) · อยู่ในกิ่ง = หลังบรรทัดกิ่ง
                bool ok = p.Def.Refs().All(r => NeedPt(r, p.Id)) & VisitBranch(p.Branch) & VisitLoopOf(p.Id) & p.Def.Exprs().SelectMany(CondDeps).All(VisitCond) & p.Def.Exprs().SelectMany(VarDeps).All(VisitVar) & p.Def.Exprs().SelectMany(LoopDeps).All(VisitLoop);
                state[p.Id] = 2;
                if (ok) { done.Add(p.Id); order.Add(p); } else if (!cyc.Contains(p.Id)) cyc.Add(p.Id);
                return ok;
            }
            // เงื่อนไขคำนวณทุกตัวเสมอ (แบบในเว็บ) แม้ไม่มีใครใช้
            foreach (var c in _logic.Conditions) VisitCond(c);
            foreach (var v in _logic.Variables) VisitVar(v);          // variable คำนวณทุกตัวเสมอ (เตือนครบแบบในเว็บ)
            foreach (var p in _s.Points) Visit(p);
            foreach (var g in _s.Rotations) VisitRot(g);
            foreach (var g in Loops) VisitLoop(g);                 // Loop ที่ไม่มีจุดในชุด (แต่มี link / shape) ก็ประกาศ N
            foreach (var d in _logic.Decisions) VisitDec(d);
            // จุดที่พึ่งจุดในวงก็คำนวณไม่ได้ (อยู่ใน order แต่ from = null) — ประกาศจุดในวงไว้ก่อน
            cyclic = cyc;
            return order.Where(o => o switch
            {
                SpecPoint p => !cyc.Contains(p.Id), SpecCondition c => !cyc.Contains("?" + c.Name), SpecDecision d => !cyc.Contains("!" + d.Id), SpecVariable v => !cyc.Contains("$" + v.Name), SpecArray g => !cyc.Contains("#L" + g.Id), _ => true
            }).ToList();
        }

        // ---------------- Logic ----------------
        // ชื่อเงื่อนไขที่นิพจน์ใช้
        private IEnumerable<SpecCondition> CondDeps(string? expr) =>
            SpecExpr.NamesOf(expr).Select(n => _logic.Conditions.FirstOrDefault(c => c.Name == n)).Where(c => c != null)!;
        private SpecDecision? DecOf(string branch) =>
            _logic.Branches.FirstOrDefault(b => b.Id == branch) is { } b ? _logic.Decisions.FirstOrDefault(d => d.Id == b.Decision) : null;
        // ตัวแปรกิ่ง: กิ่งที่ไม่มี (หรือ decision ของมันไม่มี) = ไม่เกิดเลย
        private string Br(string branch) => DecOf(branch) != null ? branch : "false";
        private string BrLabel(string branch) => _logic.Branches.FirstOrDefault(b => b.Id == branch)?.Label ?? branch;
        // object ในกิ่ง: ค่า = null เมื่อกิ่งไม่เกิด
        private string InBranch(string? branch, string expr) => branch == null ? expr : $"{Br(branch)} ? {expr} : null";
        // กิ่ง + ชุดของ Loop: เงื่อนไขที่ object นี้เกิด (null = เกิดเสมอ)
        private string? Gate(string? branch, string id)
        {
            var c = new List<string>();
            if (branch != null) c.Add(Br(branch));
            if (_loopOf.TryGetValue(id, out var lp)) c.Add($"N_{lp.G.Id} > {lp.K}");
            return c.Count == 0 ? null : string.Join(" && ", c);
        }
        private string InGate(string? branch, string id, string expr) => Gate(branch, id) is { } g ? $"{g} ? {expr} : null" : expr;
        private string LoopTag(string id) => _loopOf.TryGetValue(id, out var lp) ? $" [{lp.G.Id} ชุดที่ {lp.K + 1}]" : "";
        private string BrTag(string? branch) => branch == null ? "" : $" [กิ่ง {BrLabel(branch)}]";            // ต่อท้ายคอมเมนต์ที่มีอยู่
        private string BrNote(string? branch) => branch == null ? "" : $"   // [กิ่ง {BrLabel(branch)}]";      // คอมเมนต์ท้ายบรรทัด
        private bool UsesRuntime(IEnumerable<string?> exprs) => exprs.Any(e => SpecExpr.PointRefs(e).Count > 0 || CondDeps(e).Any() || SpecExpr.NamesOf(e).Any(_runtimeVars.Contains));
        // variable ที่นิพจน์ใช้
        private IEnumerable<SpecVariable> VarDeps(string? expr) =>
            SpecExpr.NamesOf(expr).Select(n => _logic.Variables.FirstOrDefault(v => v.Name == n)).Where(v => v != null)!;

        // Loop ที่ count() ในนิพจน์อ้าง (N ต้องคำนวณก่อน) — Array N คงที่ไม่ต้องรอ
        private IEnumerable<SpecArray> LoopDeps(string? expr) =>
            SpecExpr.ArrayRefs(expr).Select(id => Loops.FirstOrDefault(g => g.Id == id)).Where(g => g != null)!;
        // count(A1) -> N_A1 (Loop) / จำนวนชุดคงที่ / null = ไม่มี Array นี้
        private string? ArrayCountCs(string id) => _s.Arrays.FirstOrDefault(g => g.Id == id) is { } g ? g.Loop != null ? $"N_{g.Id}" : (g.Members.Count + 1).ToString() : null;

        // Array แบบ Loop (รอบ 5b): จำนวนชุดครั้งเดียว — ปัดเศษ (0 ลง · 1 ขึ้น · 2 ใกล้สุด) แล้วบีบ 1..nMax (LoopN เตือนเอง)
        private void LoopLine(SpecArray g)
        {
            var L0 = g.Loop!;
            int mode = L0.NRound == "ceil" ? 1 : L0.NRound == "round" ? 2 : 0;
            string rt = mode == 1 ? "ปัดขึ้น" : mode == 2 ? "ปัดใกล้สุด" : "ปัดลง";
            L($"        // {g.Id} ทำซ้ำ (Loop): N = {L0.N} · {rt} · สูงสุด {L0.NMax} ชุด");
            L($"        int N_{g.Id} = LoopN(cs, \"{g.Id}\", () => {X(L0.N, "N", g.Id)}, {L0.NMax}, {mode});");
        }

        // variable ที่ไม่รู้ค่าได้: อ้างจุด / เงื่อนไข / วนกัน / ใช้ variable แบบนี้ (ทางอ้อมด้วย)
        private void ComputeRuntimeVars(List<string> cyclic)
        {
            _runtimeVars.Clear();
            foreach (var v in _logic.Variables)
                if (cyclic.Contains("$" + v.Name) || v.Exprs().Any(e => SpecExpr.PointRefs(e).Count > 0 || CondDeps(e).Any())) _runtimeVars.Add(v.Name);
            for (bool more = true; more; )
            {
                more = false;
                foreach (var v in _logic.Variables)
                    if (!_runtimeVars.Contains(v.Name) && v.Exprs().Any(e => SpecExpr.NamesOf(e).Any(_runtimeVars.Contains))) { _runtimeVars.Add(v.Name); more = true; }
            }
        }

        // ข้อความเตือนของ variable: {ชื่อ} -> ค่า ("Depth = " + Depth + " m ...") — ตรงกับ varWarnText ใน spec.js
        private string WarnText(string text)
        {
            var parts = System.Text.RegularExpressions.Regex.Split(text, @"\{([A-Za-z_][A-Za-z0-9_]*)\}");
            var list = new List<string>();
            for (int i = 0; i < parts.Length; i++)
            {
                if (i % 2 == 0) { if (parts[i].Length > 0) list.Add("\"" + parts[i] + "\""); }
                else list.Add(_runtimeVars.Contains(parts[i]) ? $"VN({parts[i]})" : parts[i]);
            }
            if (list.Count == 0) return "\"\"";
            if (!list[0].StartsWith("\"")) list.Insert(0, "\"\"");
            return string.Join(" + ", list);
        }
        private static readonly HashSet<string> VarErrors = new() { "ValueTooSmall", "ValueTooLarge", "Failure", "ValueShouldNotBeLessThanOrEqualToZero", "ValueShouldNotBeLessThanZero", "ValueShouldNotBeZero", "ValueInABadPosition" };
        private string VarWarn(SpecVarRule r) =>
            string.IsNullOrWhiteSpace(r.Warn) ? "" : $"Warn(cs, CorridorError.{(VarErrors.Contains(r.Error ?? "") ? r.Error : "Failure")}, {WarnText(r.Warn!)}); ";

        // Variable (รอบ 5): ไม่อ้างจุด = double ธรรมดา + if / else if (อ่านแบบเขียนเอง) · อ้างจุด / เงื่อนไข = double? ผ่าน Val (หาไม่ได้ = null + เตือน)
        private void VariableLines(SpecVariable v)
        {
            foreach (var r in v.Rules)
                if (!string.IsNullOrEmpty(r.Warn) && (r.Warn.Contains('"') || r.Warn.Contains('\\'))) throw new FormatException($"variable {v.Name}: ข้อความเตือนใช้ \" หรือ \\ ไม่ได้");
            L($"        // {v.Id} {v.Name}{(string.IsNullOrWhiteSpace(v.Note) ? "" : ": " + v.Note)}");
            string Num(string? e, string what) => X(e, what, v.Name);
            string Bool(string? e, string what) => X(e, what, v.Name, 0, "bool");
            if (!_runtimeVars.Contains(v.Name))
            {
                L($"        double {v.Name} = {Num(v.Expr, "ค่าปกติ")};");
                for (int i = 0; i < v.Rules.Count; i++)
                {
                    var r = v.Rules[i];
                    string head = (i == 0 ? "if" : "else if") + $" ({Bool(r.When, $"ถ้า ข้อ {i + 1}")})";
                    string set = $"{v.Name} = {Num(r.Value, $"ค่า ข้อ {i + 1}")};";
                    L(string.IsNullOrWhiteSpace(r.Warn) ? $"        {head} {set}" : $"        {head} {{ {VarWarn(r)}{set} }}");
                }
                return;
            }
            if (v.Rules.Count == 0) { L($"        double? {v.Name} = Val(cs, \"{v.Name}\", () => {Num(v.Expr, "ค่าปกติ")});"); return; }
            L($"        double? {v.Name} = Val(cs, \"{v.Name}\", () =>");
            L("        {");
            for (int i = 0; i < v.Rules.Count; i++)
            {
                var r = v.Rules[i];
                L($"            if ({Bool(r.When, $"ถ้า ข้อ {i + 1}")}) {{ {VarWarn(r)}return {Num(r.Value, $"ค่า ข้อ {i + 1}")}; }}");
            }
            L($"            return {Num(v.Expr, "ค่าปกติ")};");
            L("        });");
        }

        private void ConditionLine(SpecCondition c)
        {
            L($"        bool? {c.Name} = Cond(cs, \"{c.Name}\", () => {X(c.Expr, "เงื่อนไข", c.Name, 0, "bool")});   // {c.Id} {c.Name}{(string.IsNullOrWhiteSpace(c.Note) ? "" : ": " + c.Note)}");
        }

        // decision: ค่าของ test (ไม่รู้ = null) แล้วบรรทัดละกิ่ง — กิ่งเกิด = กิ่งแม่เกิด && ค่าตรง case
        private void DecisionLines(SpecDecision d)
        {
            var test = (d.Test ?? "").Trim();
            string parent = d.Parent != null ? Br(d.Parent) : "";
            string guard(string e) => d.Parent != null ? $"{parent} ? {e} : null" : e;
            string head = parent.Length > 0 ? parent + " && " : "";
            L($"        // {d.Id} {(d.Kind == "switch" ? "switch" : "decision")}{(string.IsNullOrWhiteSpace(d.Label) ? "" : " " + d.Label)}{(d.Parent != null ? $" (ในกิ่ง {BrLabel(d.Parent)})" : "")}");
            var outs = _logic.Branches.Where(b => b.Decision == d.Id).ToList();
            if (d.Kind == "switch")
            {
                L($"        double? {d.Id} = {guard($"Val(cs, \"{d.Id}\", () => {X(test, "switch", d.Id)})")};");
                foreach (var b in outs)
                {
                    string on = b.IsElse
                        ? $"{d.Id} != null" + string.Concat(outs.Where(o => !o.IsElse).Select(o => $" && !Eq({d.Id}.Value, {SpecExpr.Lit(o.AsNumber)})"))
                        : $"{d.Id} != null && Eq({d.Id}.Value, {SpecExpr.Lit(b.AsNumber)})";
                    L($"        bool {b.Id} = {head}{on};   // กิ่ง \"{b.Label ?? b.Id}\"");
                }
                return;
            }
            string val;
            if (_logic.Conditions.Any(c => c.Name == test)) val = test;                 // test = ชื่อเงื่อนไข (คำนวณไว้แล้ว)
            else { L($"        bool? {d.Id} = {guard($"Cond(cs, \"{d.Id}\", () => {X(test, "decision", d.Id, 0, "bool")})")};"); val = d.Id; }
            foreach (var b in outs)
                L($"        bool {b.Id} = {head}{val} == {(b.AsBool ? "true" : "false")};   // กิ่ง \"{b.Label ?? b.Id}\"");
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

    // Offset: จุด e (ปลายของเส้น a→b) เลื่อนตั้งฉากไป k (+ = ซ้ายของทิศ a→b บนจอจริง — ตัวเรียกคูณ F ให้แล้ว) — เส้นขนาน
    private static Pt? Offset(CorridorState cs, string id, Pt? a, Pt? b, Pt? e, double k)
    {
        if (a == null || b == null || e == null) return null;
        double dx = b.Value.X - a.Value.X, dy = b.Value.Y - a.Value.Y, n = Math.Sqrt(dx * dx + dy * dy);
        if (n < 1e-9) { Warn(cs, CorridorError.Failure, id + ": เส้นยาวเป็นศูนย์ หาทิศ offset ไม่ได้"); return null; }
        return Check(cs, id, new Pt(e.Value.X - dy * k / n, e.Value.Y + dx * k / n));
    }

    // Extend to Surface: ต่อเส้น along→from เลย from ออกไป (ทิศเดิม) จนชนดิน — เฉพาะเมื่อปลาย from ลอยเหนือดิน
    //   ไม่ลอย / ไม่มีดิน (Layout / ไม่มี target) = null เงียบๆ (link / shape ที่ใช้ = ไม่เกิด) · ไม่ชนดินภายใน maxDistance (ระยะราบ) = เตือน + null
    private static Pt? ExtendToGround(CorridorState cs, string id, ObjectId surface, Pt? from, Pt? along, double maxDistance)
    {
        if (from == null || along == null || surface.IsNull) return null;
        Pt f = from.Value;
        double gy;
        try
        {
            gy = Elevation(cs, surface, cs.CurrentOffset + f.X) - cs.CurrentElevation;
        }
        catch (Exception e)
        {
            Warn(cs, CorridorError.Failure, id + " ต่อลงถึงดิน: " + e.Message);
            return null;
        }
        if (!(gy < f.Y - 1e-9)) return null;
        double dx = f.X - along.Value.X, dy = f.Y - along.Value.Y;
        if (Math.Abs(dx) < 1e-12 && Math.Abs(dy) < 1e-12) { Warn(cs, CorridorError.Failure, id + " ต่อลงถึงดิน: เส้นยาวเป็นศูนย์"); return null; }
        Pt? hit = null;
        if (Math.Abs(dx) < 1e-12)
        {
            if (dy < 0) hit = new Pt(f.X, gy);
        }
        else
        {
            try
            {
                IPoint h = cs.IntersectSurface(surface, cs.CurrentAlignmentId, Abs(cs, f), dx > 0, dy / Math.Abs(dx));
                if (h != null) hit = new Pt(h.Offset - cs.CurrentOffset, h.Elevation - cs.CurrentElevation);
            }
            catch
            {
                hit = null;
            }
        }
        if (hit == null || Math.Abs(hit.Value.X - f.X) > maxDistance + 1e-9)
        {
            Warn(cs, CorridorError.NoSideslopeIntersectFound, id + " ต่อลงถึงดิน: ไม่ชนผิวดินภายใน " + maxDistance + " m");
            return null;
        }
        return Check(cs, id, hit.Value);
    }

    // Clipped Surface Link: ตามผิวดินจาก a ถึง b แต่ไม่สูงกว่า (below) / ไม่ต่ำกว่า เส้นอ้างอิง r1–r2 (ต่อออกไปได้)
    //   แบบ BuildBottom ของ base_rock-pitching.cs — ตรงกับ clipPath ใน wwwroot/js/spec.js
    //   ช่วงที่ปลายทั้งสองอยู่บนเส้น = codes + codesLine · นอกนั้น = codes + codesGround · ไม่มีดิน / เส้นอ้างอิงแนวดิ่ง = เส้นตรง + codesLine
    private static Link[] FollowClipped(CorridorState cs, string id, ObjectId surface, Pt? pa, Point a, Pt? pb, Point b, Pt? r1, Pt? r2, bool below,
                                        string[] codes, string[] codesGround, string[] codesLine)
    {
        if (a == null || b == null || r1 == null || r2 == null) return null;
        Pt A = pa.Value, B = pb.Value, R1 = r1.Value, R2 = r2.Value;
        var lineCodes = new List<string>(codes); lineCodes.AddRange(codesLine);
        var gndCodes = new List<string>(codes); gndCodes.AddRange(codesGround);
        var path = new List<Pt> { A, B };
        bool clipped = false;
        Func<double, double> line = x => R1.Y + (R2.Y - R1.Y) * (x - R1.X) / (R2.X - R1.X);
        string fail = null;
        if (Math.Abs(R2.X - R1.X) < 1e-9) fail = "เส้นอ้างอิงเป็นแนวดิ่ง";
        else if (surface.IsNull)
        {
            if (cs.Mode != CorridorMode.Layout) fail = "ไม่ได้กำหนด Target Surface";
        }
        else
        {
            try
            {
                // ผิวดิน: ปลายทั้งสอง + จุดหักระหว่างทาง (แบบ FollowSurface)
                var prof = new List<(double X, double Y)> { (A.X, Elevation(cs, surface, cs.CurrentOffset + A.X) - cs.CurrentElevation) };
                double lo = Math.Min(A.X, B.X), hi = Math.Max(A.X, B.X);
                var mids = new List<(double X, double Y)>();
                SampledSectionLinkCollection sampled = cs.SampleSection(surface, cs.CurrentAlignmentId, Abs(cs, A), Abs(cs, B));
                foreach (SampledSectionLink s in sampled)
                {
                    double x = s.EndPointOffset - cs.CurrentOffset;
                    if (x > lo + 1e-9 && x < hi - 1e-9)
                        mids.Add((x, s.EndPointElevation - cs.CurrentElevation));
                }
                mids.Sort((p, q) => p.X.CompareTo(q.X));
                if (A.X > B.X) mids.Reverse();
                prof.AddRange(mids);
                prof.Add((B.X, Elevation(cs, surface, cs.CurrentOffset + B.X) - cs.CurrentElevation));

                Func<double, double, double> clip = (x, y) => below ? Math.Min(y, line(x)) : Math.Max(y, line(x));
                var raw = new List<Pt> { new Pt(prof[0].X, clip(prof[0].X, prof[0].Y)) };
                for (int i = 0; i < prof.Count - 1; i++)
                {
                    var p = prof[i];
                    var q = prof[i + 1];
                    double da = p.Y - line(p.X), db = q.Y - line(q.X);
                    if (da * db < 0)
                    {
                        double t = da / (da - db), x = p.X + t * (q.X - p.X);
                        raw.Add(new Pt(x, line(x)));
                    }
                    raw.Add(new Pt(q.X, clip(q.X, q.Y)));
                }
                // ตัดจุดซ้ำ (ระยะราบ < 0.0001) และจุดกลางของช่วงที่อยู่บนเส้น
                var c = new List<Pt>();
                foreach (Pt p in raw)
                {
                    if (c.Count > 0 && Math.Abs(p.X - c[c.Count - 1].X) < 1e-4) continue;
                    if (c.Count >= 2 && Math.Abs(p.Y - line(p.X)) < 1e-4 && Math.Abs(c[c.Count - 1].Y - line(c[c.Count - 1].X)) < 1e-4
                        && Math.Abs(c[c.Count - 2].Y - line(c[c.Count - 2].X)) < 1e-4)
                    {
                        c[c.Count - 1] = p;
                        continue;
                    }
                    c.Add(p);
                }
                if (c.Count >= 2)
                {
                    path = new List<Pt> { A };
                    for (int i = 1; i < c.Count - 1; i++) path.Add(c[i]);
                    path.Add(B);
                }
                clipped = true;
            }
            catch (Exception e)
            {
                fail = e.Message;
            }
        }
        if (fail != null) Warn(cs, CorridorError.Failure, id + " ตามดิน ไม่เกินเส้น: " + fail + " — ใช้เส้นตรงแทน");
        var pts = new Point[path.Count];
        pts[0] = a;
        pts[path.Count - 1] = b;
        for (int i = 1; i < path.Count - 1; i++) pts[i] = cs.Points.Add(path[i].X, path[i].Y, "");
        var links = new Link[path.Count - 1];
        for (int i = 0; i < links.Length; i++)
        {
            links[i] = cs.Links.Add(new[] { pts[i], pts[i + 1] }, "");
            bool on = clipped && Math.Abs(path[i].Y - line(path[i].X)) < 1e-4 && Math.Abs(path[i + 1].Y - line(path[i + 1].X)) < 1e-4;
            foreach (string code in (on || !clipped ? lineCodes : gndCodes))
                links[i].Codes.TryAdd(code);
        }
        return links;
    }

    // link optional ใน shape (ต่อลงถึงดิน): ไม่เกิด / วาดไม่ได้ (null) = ข้ามไป
    private static Link[] Opt(Link l) => l == null ? new Link[0] : new[] { l };
    private static Link[] Opt(Link[] l) => l ?? new Link[0];

    // หมุนจุด p รอบ pivot ด้วยมุม angle (องศา ทวนเข็ม +) — สมาชิกกลุ่มหมุน
    private static Pt? Rotate(CorridorState cs, string id, Pt? p, Pt? pivot, double angle)
    {
        if (p == null) return null;
        if (pivot == null) { Warn(cs, CorridorError.Failure, id + ": ข้ามเพราะหาจุดหมุนไม่ได้"); return null; }
        double r = angle * Deg, c = Math.Cos(r), s = Math.Sin(r), dx = p.Value.X - pivot.Value.X, dy = p.Value.Y - pivot.Value.Y;
        return Check(cs, id, new Pt(pivot.Value.X + dx * c - dy * s, pivot.Value.Y + dx * s + dy * c));
    }

    // ---- ค่าจากเรขาคณิตในนิพจน์ (P3.x / P3.y / ground / exists) ----
    // จุดที่อ้างหาไม่ได้ = โยน InvalidOperationException -> Try ข้างล่างเตือน แล้วให้ object นี้หาไม่ได้ (ตรงกับตัวคำนวณในเว็บ)

    private static double PX(Pt? p)
    {
        if (p == null) throw new InvalidOperationException("ข้ามเพราะหาจุดที่นิพจน์อ้างไม่ได้");
        return p.Value.X;
    }

    private static double PY(Pt? p)
    {
        if (p == null) throw new InvalidOperationException("ข้ามเพราะหาจุดที่นิพจน์อ้างไม่ได้");
        return p.Value.Y;
    }

    private static bool Exists(Pt? p)
    {
        return p != null;
    }

    // == / != ของตัวเลขเทียบด้วย tolerance เดียวกับเว็บ
    private static bool Eq(double a, double b)
    {
        return Math.Abs(a - b) <= 1e-6;
    }

    // ระดับผิวดินที่ offset ของจุด (เทียบ origin) · ไม่มีผิวดิน (Layout mode / ไม่ได้กำหนด target) = ระดับของจุดเอง + เตือน
    private static double Ground(CorridorState cs, ObjectId surface, Pt? p)
    {
        double y = PY(p);
        if (surface.IsNull)
        {
            if (cs.Mode != CorridorMode.Layout)
                Warn(cs, CorridorError.LogicalNameNotFound, "ground(): ไม่ได้กำหนด Target Surface — ใช้ระดับของจุดเอง");
            return y;
        }
        try
        {
            return Elevation(cs, surface, cs.CurrentOffset + p.Value.X) - cs.CurrentElevation;
        }
        catch (Exception e)
        {
            throw new InvalidOperationException("ground(): " + e.Message);
        }
    }

    // ---- เงื่อนไข / กิ่ง ----
    // เงื่อนไขคำนวณไม่ได้ (อ้างจุดที่หาไม่ได้ / เงื่อนไขที่ไม่รู้ค่า) = null + เตือน -> ไม่เข้ากิ่งไหน (ตรงกับตัวคำนวณในเว็บ)

    private static bool? Cond(CorridorState cs, string name, Func<bool> test)
    {
        try
        {
            return test();
        }
        catch (InvalidOperationException e)
        {
            Warn(cs, CorridorError.Failure, "เงื่อนไข " + name + ": " + e.Message);
            return null;
        }
    }

    private static double? Val(CorridorState cs, string name, Func<double> value)
    {
        try
        {
            return value();
        }
        catch (InvalidOperationException e)
        {
            Warn(cs, CorridorError.Failure, name + ": " + e.Message);
            return null;
        }
    }

    // ค่าของเงื่อนไขที่ใช้ในนิพจน์อื่น — ไม่รู้ค่า = โยน (ให้ Cond / Try ข้างนอกจัดการ)
    private static bool V(bool? b)
    {
        if (b == null) throw new InvalidOperationException("เงื่อนไขที่อ้างไม่รู้ค่า");
        return b.Value;
    }

    // จุดแรกในรายการที่เกิด (ไว้ต่อเรขาคณิตหลังกิ่ง) · ไม่มีสักจุด = หาไม่ได้ + เตือน
    private static Pt? FirstOf(CorridorState cs, string id, params Pt?[] points)
    {
        foreach (Pt? p in points)
        {
            if (p != null) return p;
        }
        Warn(cs, CorridorError.Failure, id + ": ไม่มีจุดในรายการที่เกิด");
        return null;
    }

    private static T Try<T>(CorridorState cs, string id, Func<T> calc)
    {
        try
        {
            return calc();
        }
        catch (InvalidOperationException e)
        {
            Warn(cs, CorridorError.Failure, id + ": " + e.Message);
            return default(T);
        }
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
        Shape shape = cs.Shapes.Add(ChainLinks(cs, id, links), "");
        foreach (string code in codes)
            shape.Codes.TryAdd(code);
    }

    // Civil 3D walks the links of Shapes.Add in array order: each link must touch the end of the previous one
    // (a reversed link is turned around), otherwise the fill is drawn crossed. So sort them into one closed chain.
    // Starts from the first link and searches (with backtracking: points at the same position, e.g. zero-length links,
    // can offer several ways) for an order that uses every link and returns to the start.
    // Not possible (open outline) = warn and keep the order given.
    private static Link[] ChainLinks(CorridorState cs, string id, Link[] links)
    {
        var used = new bool[links.Length];
        var order = new List<Link> { links[0] };
        used[0] = true;
        int budget = 100000;
        if (!ChainFrom(links, used, order, links[0].Points[links[0].Points.Count - 1], links[0].Points[0], ref budget))
        {
            Warn(cs, CorridorError.Failure, id + ": link ต่อกันไม่เป็นรูปปิด — Civil 3D จะระบายสีผิด");
            return links;
        }
        return order.ToArray();
    }

    private static bool ChainFrom(Link[] links, bool[] used, List<Link> order, Point end, Point start, ref int budget)
    {
        if (order.Count == links.Length) return SamePt(end, start);
        if (--budget < 0) return false;
        for (int i = 0; i < links.Length; i++)
        {
            if (used[i]) continue;
            Point a = links[i].Points[0], b = links[i].Points[links[i].Points.Count - 1];
            Point next = SamePt(a, end) ? b : SamePt(b, end) ? a : null;
            if (next == null) continue;
            used[i] = true;
            order.Add(links[i]);
            if (ChainFrom(links, used, order, next, start, ref budget)) return true;
            used[i] = false;
            order.RemoveAt(order.Count - 1);
        }
        return false;
    }

    // Points read back from Link.Points are new wrapper objects in Civil 3D: compare by position, never by reference
    private static bool SamePt(Point a, Point b)
    {
        return Math.Abs(a.Offset - b.Offset) < 1e-7 && Math.Abs(a.Elevation - b.Elevation) < 1e-7;   // same tolerance as samePt in spec.js
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

    // error ระดับ Severe (parameter ≤ 0 ที่ต้องมากกว่า 0 — แบบ RecordError ใน base_rock-pitching.cs)
    private static void Severe(CorridorState cs, CorridorError error, string message)
    {
        cs.RecordError(error, CorridorErrorLevel.Severe, message, Source, true);
    }

""");
            // Array แบบ Loop (รอบ 5b) — มีเฉพาะเมื่อใช้ (ไฟล์เดิมไม่เปลี่ยน)
            if (Loops.Any())
                _o.Append("""

    // จำนวนชุดของ Array แบบ Loop: ปัดเศษ (0 ลง · 1 ขึ้น · 2 ใกล้สุด .5 ออกจากศูนย์) แล้วบีบ 1..nMax — นอกช่วง / หาค่าไม่ได้ = เตือน (ตรงกับ loopN ใน spec.js)
    private static int LoopN(CorridorState cs, string id, Func<double> value, int nMax, int mode)
    {
        double v;
        try
        {
            v = value();
        }
        catch (InvalidOperationException)
        {
            v = double.NaN;
        }
        if (double.IsNaN(v) || double.IsInfinity(v))
        {
            Warn(cs, CorridorError.Failure, "Array " + id + ": หาจำนวนชุดไม่ได้ ใช้ 1");
            return 1;
        }
        double r = mode == 1 ? Math.Ceiling(v) : mode == 2 ? Math.Round(v, MidpointRounding.AwayFromZero) : Math.Floor(v);
        if (r == 0) r = 0;   // -0 (เช่น ceil(-0.3)) แสดงเป็น 0 แบบ JS
        if (r > nMax)
        {
            Warn(cs, CorridorError.ValueTooLarge, "Array " + id + ": ต้องการ " + r + " ชุด เกินสูงสุด " + nMax + " ใช้ " + nMax);
            return nMax;
        }
        if (r < 1)
        {
            Warn(cs, CorridorError.ValueTooSmall, "Array " + id + ": ได้ " + r + " ชุด น้อยกว่า 1 ใช้ 1");
            return 1;
        }
        return (int)r;
    }

""");
            // variable ที่ไม่รู้ค่าได้ (รอบ 5) — มีเฉพาะเมื่อใช้ (ไฟล์ที่ไม่มี variable ไม่เปลี่ยน)
            if (_runtimeVars.Count > 0)
                _o.Append("""

    // ค่าของ variable ที่ใช้ในนิพจน์อื่น — ไม่รู้ค่า = โยน (ให้ Val / Try / Cond ข้างนอกจัดการ)
    private static double VN(double? v)
    {
        if (v == null) throw new InvalidOperationException("variable ที่อ้างไม่รู้ค่า");
        return v.Value;
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
    //   เงื่อนไข (ชื่อ) / decision (D1, switch / if ที่เป็นนิพจน์) / กิ่ง (B1) = บรรทัดที่คำนวณค่า (แท็บ Logic → ปุ่ม โค้ด)
    // อ่านจากช่วง SA-DRAWING ของข้อความจริง จึงตรงกับไฟล์เสมอ ทั้งไฟล์ที่สร้างใหม่และไฟล์ที่ช่วงนี้อยู่กลางไฟล์
    // (นับรวมบรรทัด CALL / PARAM / TARGET ที่อยู่ก่อนหน้าแล้ว)
    private static readonly System.Text.RegularExpressions.Regex[] MapPatterns =
    {
        new(@"^\s*Pt\? (\w+) = (?!null;)"),
        new(@"^\s*Point \w+ = (?:[\w ><&]+ \? )?AddPoint\(cs, (\w+)"),
        new(@"^\s*Link \w+ = (?:[\w ><&]+ \? )?(?:AddLink|FollowSurface)\(cs, ""([^""]+)"""),
        new(@"^\s*Link\[\] \w+ = (?:[\w ><&]+ \? )?(?:Try\(cs, ""[^""]+"", \(\) => )?(?:Arc3|ArcR|Fillet|FollowClipped)\(cs, ""([^""]+)"""),
        new(@"^\s*bool\?? (\w+) = "),                         // เงื่อนไข (ชื่อ) / decision (D1) / กิ่ง (B1)
        new(@"^\s*// (V\d+) \w+"),                          // variable (รอบ 5): บรรทัดคอมเมนต์หัว
        new(@"^\s*// (A\d+) ทำซ้ำ"),                         // Array แบบ Loop (รอบ 5b): บรรทัดหัว
        new(@"^\s*double\? (\w+) = "),                        // switch
        new(@"^\s*\w+ = (?:Try\(cs, ""[^""]+"", \(\) => )?Rotate\(cs, ""([^""]+)"""),
        new(@"^\s*Link(?:\[\])? \w+ = null;\s+// ([^:]+):"),
        new(@"^\s*// (\w+): (?:ไม่มีจุด|ปลาย \w+ เป็นจุด auxiliary)"),
        new(@"^\s*// (\w+) auxiliary:"),
        new(@"^\s*// (\w+): ใช้ link auxiliary"),
        new(@"^\s*(?:if \([\w ><&]+\) )?AddShape\(cs, ""([^""]+)"""),
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
    // Round 7: description / options of a parameter as comment text (" · text · 0=Right, 1=Left"), one line. Empty = "".
    // Only comments: Civil 3D reads them from the .atc, the code does not change.
    internal static string ParamNote(SpecParam p)
    {
        static string One(string s) => string.Join(" ", s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(p.Description)) parts.Add(One(p.Description));
        if (p.Kind == "long" && p.Options is { Count: > 0 }) parts.Add(string.Join(", ", p.Options.Select(o => $"{o.Value}={One(o.Label)}")));
        return parts.Count == 0 ? "" : " · " + string.Join(" · ", parts);
    }

    private static string Norm(string s) => string.Join("\n", s.Replace("\r\n", "\n").Split('\n').Select(l => l.TrimEnd()));

    // Round 7 Build dialog: rename the namespace / class of a web file outside SA-DRAWING (the block is regenerated after).
    // Roslyn tokens, not text: identifiers named like the class (declaration, constructors, uses), the SaDrawing_ helper
    // name, and namespace declarations named like the old namespace. Comments and strings are not touched.
    public static string RenameClass(string source, string oldNamespace, string oldClass, string newNamespace, string newClass)
    {
        var root = Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree.ParseText(source).GetRoot();
        var edits = new List<(int Start, int Length, string Text)>();
        string oldHelper = "SaDrawing_" + oldClass, newHelper = "SaDrawing_" + newClass;
        if (oldClass != newClass)
            foreach (var t in root.DescendantTokens().Where(t => t.RawKind == (int)Microsoft.CodeAnalysis.CSharp.SyntaxKind.IdentifierToken))
            {
                // a namespace part with the same text as the class is not the class
                if (t.Parent!.AncestorsAndSelf().Any(a => a.Parent is Microsoft.CodeAnalysis.CSharp.Syntax.BaseNamespaceDeclarationSyntax nd && nd.Name == a)) continue;
                if (t.ValueText == oldClass) edits.Add((t.SpanStart, t.Span.Length, newClass));
                else if (t.ValueText == oldHelper) edits.Add((t.SpanStart, t.Span.Length, newHelper));
            }
        if (oldNamespace != newNamespace)
            foreach (var n in root.DescendantNodes().OfType<Microsoft.CodeAnalysis.CSharp.Syntax.BaseNamespaceDeclarationSyntax>())
                if (n.Name.ToString() == oldNamespace) edits.Add((n.Name.SpanStart, n.Name.Span.Length, newNamespace));
        var sb = new StringBuilder(source);
        foreach (var e in edits.OrderByDescending(e => e.Start)) sb.Remove(e.Start, e.Length).Insert(e.Start, e.Text);
        return sb.ToString();
    }

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
