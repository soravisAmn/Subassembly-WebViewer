// นิพจน์ของ DrawingSpec -> นิพจน์ C# (ไวยากรณ์เดียวกับ wwwroot/js/expr.js — แก้ต้องแก้คู่กัน)
//   ตัวเลข, ชื่อ parameter, + - * / ( ), min max abs sqrt pow, sin cos tan (องศา), atan (คืนองศา)
//   เงื่อนไข: > < >= <= == != (== / != เทียบด้วย Eps) · and or not (&& || !) · true false · if(เงื่อนไข, a, b)
//   ค่าจากเรขาคณิต: P3.x (กรอบ Side = Right -> F * PX(P3)) · P3.y -> PY(P3) · ground(P3[, "T"]) -> Ground(cs, surface, P3)
//                   exists(P3) -> Exists(P3) · hasGround(["T"]) -> !surface.IsNull
// ตัวเลขเขียนเป็น double เสมอ (1 -> 1.0) กันการหารจำนวนเต็มของ C# (-1/2 จะได้ 0)

using System.Globalization;
using System.Text.RegularExpressions;

namespace SA.Drawing;

// ชื่อที่นิพจน์ใช้ได้ + วิธีเขียนเป็น C#
public sealed class ExprScope
{
    public ISet<string> Params { get; init; } = new HashSet<string>();
    public ISet<string>? Points { get; init; }            // null = ช่องนี้อ้างจุดไม่ได้
    public bool AllowMissingPoints { get; init; }         // จุดที่ไม่มีใน spec = null (หาไม่ได้ตอนรัน แบบเดียวกับในเว็บ) แทน error
    public ISet<string>? Conds { get; init; }             // ชื่อเงื่อนไข (จริง/เท็จ)
    public ISet<string>? Nullable { get; init; }          // variable ที่ไม่รู้ค่าได้ (double?) -> VN(ชื่อ) โยนเมื่อไม่รู้ค่า (รอบ 5)
    public ISet<string>? Targets { get; init; }           // null = ไม่ตรวจชื่อ target
    public Func<string?, string>? Surface { get; init; }  // ชื่อ target (null = TargetSurface) -> ตัวแปร ObjectId
}

public static class SpecExpr
{
    public const double Eps = 1e-6;                        // tolerance ของ == / != (เท่ากับ Expr.EPS ฝั่ง JS)

    private static readonly Dictionary<string, (int Min, int Max)> Funcs = new()
    {
        ["min"] = (1, 99), ["max"] = (1, 99), ["abs"] = (1, 1), ["sqrt"] = (1, 1), ["pow"] = (2, 2),
        ["sin"] = (1, 1), ["cos"] = (1, 1), ["tan"] = (1, 1), ["atan"] = (1, 1),
        ["if"] = (3, 3), ["ground"] = (1, 2), ["exists"] = (1, 1), ["hasground"] = (0, 1)
    };
    public static readonly HashSet<string> Keywords = new(StringComparer.OrdinalIgnoreCase) { "and", "or", "not", "true", "false" };
    private static readonly HashSet<string> Cmp = new() { "<", ">", "<=", ">=", "==", "!=" };

    private abstract record Node(int At);
    private record Num(double V, int At) : Node(At);
    private record Bool(bool V, int At) : Node(At);
    private record Str(string V, int At) : Node(At);
    private record Var(string Name, int At) : Node(At);
    private record PtRef(string Id, string Axis, int At) : Node(At);   // Axis: x | y | "" (ชื่อจุดใน ground / exists)
    private record Neg(Node A, int At) : Node(At);
    private record Bin(string Op, Node A, Node B, int At) : Node(At);   // + - * / < > <= >= == != and or
    private record Not(Node A, int At) : Node(At);
    private record Call(string F, List<Node> Args, int At) : Node(At);

    private record Tok(string T, string V, int At);   // T: n = ตัวเลข, i = ชื่อ, s = ข้อความ, อื่นๆ = เครื่องหมาย

    // แปลงเป็นนิพจน์ C# ชนิดตัวเลข; names = ชื่อ parameter (ไม่อยู่ในรายการ = error)
    // need = ลำดับความสำคัญของตำแหน่งที่จะวาง (1 = วางคู่กับ * หรือ / -> ใส่วงเล็บถ้าเป็นบวก/ลบ)
    public static string ToCs(string? src, ISet<string> names, int need = 0) => ToCs(src, new ExprScope { Params = names }, need);

    // want = "num" | "bool"
    public static string ToCs(string? src, ExprScope sc, int need = 0, string want = "num")
    {
        var ast = Parse(src);
        var t = TypeOf(ast, sc);
        if (t != want) throw new FormatException($"ช่องนี้ต้องเป็น{Th(want)} แต่นิพจน์นี้ให้{Th(t)}");
        // เงื่อนไขทั้งนิพจน์ไม่ต้องมีวงเล็บครอบ (ผู้เรียกวางเป็นค่าทั้งก้อน)
        return Emit(ast, want == "bool" ? Math.Min(need, -4) : need, sc);
    }

    public static ISet<string> VarsOf(string? src) => Walk(Parse(src)).OfType<Var>().Select(v => v.Name).ToHashSet();

    // ชื่อที่ใช้ (parameter / เงื่อนไข) — parse ไม่ได้ = ไม่มี
    public static ISet<string> NamesOf(string? src)
    {
        if (string.IsNullOrWhiteSpace(src)) return new HashSet<string>();
        try { return VarsOf(src); }
        catch (FormatException) { return new HashSet<string>(); }
    }

    // จุดที่นิพจน์อ้าง (parse ไม่ได้ = ไม่มี) — ใช้เรียงลำดับการคำนวณ (TopoOrder)
    public static ISet<string> PointRefs(string? src)
    {
        if (string.IsNullOrWhiteSpace(src)) return new HashSet<string>();
        try { return Walk(Parse(src)).OfType<PtRef>().Select(p => p.Id).ToHashSet(); }
        catch (FormatException) { return new HashSet<string>(); }
    }

    // target ที่ ground() / hasGround() ใช้ (null = TargetSurface) — ต้องประกาศตัวแปร surface ไว้ก่อน
    public static IEnumerable<string?> GroundTargets(string? src)
    {
        if (string.IsNullOrWhiteSpace(src)) return Array.Empty<string?>();
        try
        {
            return Walk(Parse(src)).OfType<Call>().Where(c => c.F is "ground" or "hasground")
                .Select(c => (c.F == "ground" ? c.Args.ElementAtOrDefault(1) : c.Args.ElementAtOrDefault(0)) is Str s ? s.V : null).ToList();
        }
        catch (FormatException) { return Array.Empty<string?>(); }
    }

    private static IEnumerable<Node> Walk(Node n)
    {
        yield return n;
        IEnumerable<Node> kids = n switch
        {
            Neg g => new[] { g.A }, Not x => new[] { x.A }, Bin b => new[] { b.A, b.B }, Call c => c.Args, _ => Array.Empty<Node>()
        };
        foreach (var k in kids) foreach (var d in Walk(k)) yield return d;
    }

    private static FormatException Err(int? at, string msg) => new(at != null ? $"{msg} (ตำแหน่ง {at + 1})" : msg);
    private static string Th(string t) => t switch { "num" => "ตัวเลข", "bool" => "จริง/เท็จ", "str" => "ข้อความ", _ => t };

    // ---------------- parse ----------------

    private static Node Parse(string? src)
    {
        var s = (src ?? "").Trim();
        if (s.Length == 0) throw new FormatException("นิพจน์ว่าง");
        var tk = Tokenize(s);
        int p = 0;
        Tok? Peek() => p < tk.Count ? tk[p] : null;
        bool Is(string t) => p < tk.Count && tk[p].T == t;
        bool IsKw(string w) => p < tk.Count && tk[p].T == "i" && string.Equals(tk[p].V, w, StringComparison.OrdinalIgnoreCase);
        Tok Take() => p < tk.Count ? tk[p++] : throw Err(null, $"\"{s}\": นิพจน์จบไม่ครบ");
        void Expect(string t) { var x = Take(); if (x.T != t) throw Err(x.At, $"\"{s}\": คาดว่าจะเป็น '{t}'"); }

        Node Or()
        {
            var a = And();
            while (IsKw("or") || Is("||")) { var at = Take().At; a = new Bin("or", a, And(), at); }
            return a;
        }
        Node And()
        {
            var a = NotE();
            while (IsKw("and") || Is("&&")) { var at = Take().At; a = new Bin("and", a, NotE(), at); }
            return a;
        }
        Node NotE()
        {
            if (IsKw("not") || Is("!")) { var at = Take().At; return new Not(NotE(), at); }
            return CmpE();
        }
        Node CmpE()
        {
            var a = Sum();
            if (Peek() is { } x && Cmp.Contains(x.T))
            {
                Take();
                var b = Sum();
                if (Peek() is { } y && Cmp.Contains(y.T)) throw Err(y.At, $"\"{s}\": เปรียบเทียบต่อกันแบบ a < b < c ไม่ได้ — ใช้ a < b and b < c");
                return new Bin(x.T, a, b, x.At);
            }
            return a;
        }
        Node Sum()
        {
            var a = Term();
            while (Is("+") || Is("-")) { var x = Take(); a = new Bin(x.T, a, Term(), x.At); }
            return a;
        }
        Node Term()
        {
            var a = Unary();
            while (Is("*") || Is("/")) { var x = Take(); a = new Bin(x.T, a, Unary(), x.At); }
            return a;
        }
        Node Unary()
        {
            if (Is("-")) { var at = Take().At; return new Neg(Unary(), at); }
            if (Is("+")) { Take(); return Unary(); }
            return Postfix();
        }
        Node Postfix()
        {
            var a = Atom();
            if (!Is(".")) return a;
            var dot = Take();
            if (a is not Var v) throw Err(dot.At, $"\"{s}\": ใช้ .x / .y ได้กับชื่อจุดเท่านั้น เช่น P3.x");
            var ax = p < tk.Count ? tk[p++] : null;
            if (ax is not { T: "i" } || !Regex.IsMatch(ax.V, "^[xyXY]$")) throw Err(ax?.At, $"\"{s}\": หลังจุด (.) ต้องเป็น x หรือ y เช่น P3.y");
            return new PtRef(v.Name, ax.V.ToLowerInvariant(), v.At);
        }
        Node Atom()
        {
            var x = Take();
            if (x.T == "n") return new Num(double.Parse(x.V, CultureInfo.InvariantCulture), x.At);
            if (x.T == "s") return new Str(x.V, x.At);
            if (x.T == "(") { var e = Or(); Expect(")"); return e; }
            if (x.T == "i")
            {
                var low = x.V.ToLowerInvariant();
                if (low is "true" or "false") return new Bool(low == "true", x.At);
                if (Keywords.Contains(low)) throw Err(x.At, $"\"{s}\": ไม่คาดว่าจะเจอ '{x.V}'");
                if (Is("("))
                {
                    if (!Funcs.TryGetValue(low, out var ar)) throw Err(x.At, $"ไม่มีฟังก์ชัน {x.V}()");
                    Take();
                    var args = new List<Node>();
                    if (!Is(")"))
                    {
                        args.Add(Or());
                        while (Is(",")) { Take(); args.Add(Or()); }
                    }
                    Expect(")");
                    if (args.Count < ar.Min || args.Count > ar.Max) throw Err(x.At, $"{x.V}() จำนวนค่าไม่ถูกต้อง");
                    if (low is "ground" or "exists")
                    {
                        if (args[0] is not Var v) throw Err(args[0].At, $"{x.V}() ต้องใส่ชื่อจุด เช่น {x.V}(P3)");
                        args[0] = new PtRef(v.Name, "", v.At);
                    }
                    return new Call(low, args, x.At);
                }
                return new Var(x.V, x.At);
            }
            throw Err(x.At, $"\"{s}\": ไม่คาดว่าจะเจอ '{x.V}'");
        }

        var ast = Or();
        if (p < tk.Count) throw Err(tk[p].At, $"\"{s}\": มีส่วนเกิน");
        return ast;
    }

    private static List<Tok> Tokenize(string s)
    {
        var o = new List<Tok>();
        int i = 0;
        while (i < s.Length)
        {
            char c = s[i];
            if (char.IsWhiteSpace(c)) { i++; continue; }
            var rest = s[i..];
            var num = Regex.Match(rest, @"^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?");
            if (num.Success) { o.Add(new Tok("n", num.Value, i)); i += num.Length; continue; }
            var id = Regex.Match(rest, @"^[A-Za-z_][A-Za-z0-9_]*");
            if (id.Success) { o.Add(new Tok("i", id.Value, i)); i += id.Length; continue; }
            var str = Regex.Match(rest, "^\"([^\"]*)\"|^'([^']*)'");
            if (str.Success) { o.Add(new Tok("s", str.Groups[1].Success ? str.Groups[1].Value : str.Groups[2].Value, i)); i += str.Length; continue; }
            if (c is '"' or '\'') throw Err(i, $"\"{s}\": ข้อความไม่มีเครื่องหมายคำพูดปิด");
            var op = Regex.Match(rest, @"^(<=|>=|==|!=|&&|\|\||[<>!+\-*/(),.])");
            if (op.Success) { o.Add(new Tok(op.Value, op.Value, i)); i += op.Length; continue; }
            if (c == '=') throw Err(i, $"\"{s}\": เทียบเท่ากันใช้ == (สองตัว)");
            throw Err(i, $"\"{s}\": ใช้อักษร '{c}' ไม่ได้");
        }
        return o;
    }

    // ---------------- ชนิด (num / bool / str) ----------------

    private static string TypeOf(Node n, ExprScope sc)
    {
        string Need(Node x, string want, string what)
        {
            var t = TypeOf(x, sc);
            if (t != want) throw Err(x.At, $"{what} ต้องเป็น{Th(want)} แต่ได้{Th(t)}");
            return t;
        }
        void Point(string id, int at)
        {
            if (sc.Points == null) throw Err(at, "ช่องนี้อ้างจุดไม่ได้");
            if (!sc.Points.Contains(id) && !sc.AllowMissingPoints) throw Err(at, $"ไม่มีจุด {id}");
        }
        void Target(Node x)
        {
            if (x is not Str s) throw Err(x.At, "ชื่อ target ต้องอยู่ในเครื่องหมายคำพูด เช่น \"TargetSurface\"");
            if (sc.Targets != null && !sc.Targets.Contains(s.V)) throw Err(x.At, $"ไม่มี target ชื่อ {s.V}");
        }
        switch (n)
        {
            case Num: return "num";
            case Bool: return "bool";
            case Str: return "str";
            case Var v:
                if (sc.Conds != null && sc.Conds.Contains(v.Name)) return "bool";
                if (sc.Params.Contains(v.Name)) return "num";
                if (sc.Points != null && sc.Points.Contains(v.Name)) throw Err(v.At, $"{v.Name} เป็นจุด — ใช้ {v.Name}.x / {v.Name}.y / ground({v.Name}) / exists({v.Name})");
                throw Err(v.At, $"ไม่มี parameter ชื่อ {v.Name}");
            case PtRef r: Point(r.Id, r.At); return r.Axis == "" ? "ref" : "num";
            case Neg g: Need(g.A, "num", "เครื่องหมายลบ"); return "num";
            case Not x: Need(x.A, "bool", "not"); return "bool";
            case Bin b when b.Op is "and" or "or":
                Need(b.A, "bool", $"ด้านซ้ายของ {b.Op}"); Need(b.B, "bool", $"ด้านขวาของ {b.Op}"); return "bool";
            case Bin b when b.Op is "==" or "!=":
            {
                string a = TypeOf(b.A, sc), c = TypeOf(b.B, sc);
                if (a == "str" || c == "str") throw Err(b.At, "เทียบข้อความไม่ได้");
                if (a != c) throw Err(b.At, $"{b.Op} ต้องเทียบชนิดเดียวกัน แต่ได้{Th(a)}กับ{Th(c)}");
                return "bool";
            }
            case Bin b when Cmp.Contains(b.Op):
                Need(b.A, "num", $"ด้านซ้ายของ {b.Op}"); Need(b.B, "num", $"ด้านขวาของ {b.Op}"); return "bool";
            case Bin b:
                Need(b.A, "num", $"ด้านซ้ายของ {b.Op}"); Need(b.B, "num", $"ด้านขวาของ {b.Op}"); return "num";
            case Call c:
            {
                var A = c.Args;
                if (c.F == "if")
                {
                    Need(A[0], "bool", "ค่าแรกของ if()");
                    string a = TypeOf(A[1], sc), b = TypeOf(A[2], sc);
                    if (a != b || a == "str") throw Err(c.At, $"if() ค่าที่ 2 กับ 3 ต้องชนิดเดียวกัน แต่ได้{Th(a)}กับ{Th(b)}");
                    return a;
                }
                if (c.F is "ground" or "exists")
                {
                    TypeOf(A[0], sc);
                    if (A.Count > 1) Target(A[1]);
                    return c.F == "ground" ? "num" : "bool";
                }
                if (c.F == "hasground") { if (A.Count > 0) Target(A[0]); return "bool"; }
                for (int i = 0; i < A.Count; i++) Need(A[i], "num", $"ค่าที่ {i + 1} ของ {c.F}()");
                return "num";
            }
        }
        throw Err(n.At, "นิพจน์ไม่ถูกต้อง");
    }

    // ---------------- emit C# ----------------
    // prec: -4 = ?: , -3 = ||, -2 = &&, -1 = เปรียบเทียบ, 0 = บวก/ลบ, 1 = คูณ/หาร, 2 = ตัวเดี่ยว — ใส่วงเล็บเท่าที่จำเป็น

    private static string Emit(Node n, int need, ExprScope sc)
    {
        string E(Node x, int nd) => Emit(x, nd, sc);
        string Pt(string id) => sc.Points != null && sc.Points.Contains(id) ? id : "null";   // จุดที่ไม่มี = หาไม่ได้ตอนรัน
        string Surf(string? target) => (sc.Surface ?? throw new FormatException("ใช้ ground() ในช่องนี้ไม่ได้"))(target);
        switch (n)
        {
            case Num x: return Lit(x.V);
            case Bool b: return b.V ? "true" : "false";
            case Var v: return sc.Conds != null && sc.Conds.Contains(v.Name) ? $"V({v.Name})" : sc.Nullable != null && sc.Nullable.Contains(v.Name) ? $"VN({v.Name})" : v.Name;   // เงื่อนไขไม่รู้ค่า = โยน (Try / Cond จัดการ)
            case PtRef r: return r.Axis == "x" ? Wrap($"F * PX({Pt(r.Id)})", 1, need) : $"PY({Pt(r.Id)})";
            case Neg g:
            {
                var a = E(g.A, 2);
                return Wrap(a.StartsWith('-') ? "-(" + a + ")" : "-" + a, 2, need);   // --x ใน C# คือ decrement
            }
            case Not x: return Wrap("!" + E(x.A, 2), 2, need);
            case Bin b when b.Op is "or" or "and":
            {
                int prec = b.Op == "or" ? -3 : -2;
                return Wrap($"{E(b.A, prec)} {(b.Op == "or" ? "||" : "&&")} {E(b.B, prec + 1)}", prec, need);
            }
            case Bin b when Cmp.Contains(b.Op):
            {
                // ตัวเลข == / != เทียบด้วย Eps (ตรงกับ JS)
                bool numEq = b.Op is "==" or "!=" && IsNum(b.A, sc);
                if (numEq) return Wrap($"{(b.Op == "!=" ? "!" : "")}Eq({E(b.A, 0)}, {E(b.B, 0)})", 2, need);
                return Wrap($"{E(b.A, 0)} {b.Op} {E(b.B, 0)}", -1, need);
            }
            case Bin b:
            {
                int prec = b.Op is "+" or "-" ? 0 : 1;
                // ด้านขวาของ - และ / ต้องมีวงเล็บถ้าลำดับเท่ากัน (a - (b - c))
                string l = E(b.A, prec), r = E(b.B, b.Op is "-" or "/" ? prec + 1 : prec);
                return Wrap($"{l} {b.Op} {r}", prec, need);
            }
            case Call c:
            {
                var A = c.Args;
                string? T(int i) => A.Count > i && A[i] is Str s ? s.V : null;
                switch (c.F)
                {
                    case "if": return Wrap($"{E(A[0], -3)} ? {E(A[1], -4)} : {E(A[2], -4)}", -4, need);
                    case "ground": return $"Ground(cs, {Surf(T(1))}, {Pt(((PtRef)A[0]).Id)})";
                    case "exists": return $"Exists({Pt(((PtRef)A[0]).Id)})";
                    case "hasground": return Wrap($"!{Surf(T(0))}.IsNull", 2, need);
                }
                var a = A.Select(x => E(x, 0)).ToList();
                return c.F switch
                {
                    "min" => Fold("Math.Min", a),
                    "max" => Fold("Math.Max", a),
                    "abs" => $"Math.Abs({a[0]})",
                    "sqrt" => $"Math.Sqrt({a[0]})",
                    "pow" => $"Math.Pow({a[0]}, {a[1]})",
                    "sin" => $"Math.Sin({a[0]} * Deg)",
                    "cos" => $"Math.Cos({a[0]} * Deg)",
                    "tan" => $"Math.Tan({a[0]} * Deg)",
                    "atan" => Wrap($"Math.Atan({a[0]}) / Deg", 1, need),
                    _ => throw new FormatException(c.F)
                };
            }
        }
        throw new FormatException("นิพจน์ไม่ถูกต้อง");
    }

    private static bool IsNum(Node n, ExprScope sc) { try { return TypeOf(n, sc) == "num"; } catch (FormatException) { return false; } }
    private static string Fold(string f, List<string> a) => a.Count == 1 ? a[0] : $"{f}({a[0]}, {Fold(f, a.Skip(1).ToList())})";
    private static string Wrap(string s, int prec, int need) => prec < need ? "(" + s + ")" : s;

    // ตัวเลขเป็น literal double ที่อ่านง่าย: 3 -> 3.0, 0.5 -> 0.5, 1e-7 -> 1E-07
    public static string Lit(double v)
    {
        var s = v.ToString("R", CultureInfo.InvariantCulture);
        return s.Contains('.') || s.Contains('E') || s.Contains("Infinity") || s == "NaN" ? s : s + ".0";
    }
}
