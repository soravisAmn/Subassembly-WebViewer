// นิพจน์ของ DrawingSpec -> นิพจน์ C# (ไวยากรณ์เดียวกับ wwwroot/js/expr.js)
//   ตัวเลข, ชื่อ parameter, + - * / ( ), min max abs sqrt pow, sin cos tan (องศา), atan (คืนองศา)
// ตัวเลขเขียนเป็น double เสมอ (1 -> 1.0) กันการหารจำนวนเต็มของ C# (-1/2 จะได้ 0)

using System.Globalization;

namespace SA.Drawing;

public static class SpecExpr
{
    private static readonly Dictionary<string, (int Min, int Max)> Funcs = new()
    {
        ["min"] = (1, 99), ["max"] = (1, 99), ["abs"] = (1, 1), ["sqrt"] = (1, 1), ["pow"] = (2, 2),
        ["sin"] = (1, 1), ["cos"] = (1, 1), ["tan"] = (1, 1), ["atan"] = (1, 1)
    };

    private abstract record Node;
    private record Num(double V) : Node;
    private record Var(string Name) : Node;
    private record Neg(Node A) : Node;
    private record Bin(char Op, Node A, Node B) : Node;
    private record Call(string F, List<Node> Args) : Node;

    private record Tok(char T, string V, int At);   // T: n = ตัวเลข, i = ชื่อ, อื่นๆ = เครื่องหมาย

    // แปลงเป็นนิพจน์ C#; names = ชื่อที่ใช้ได้ (ไม่อยู่ในรายการ = error)
    // need = ลำดับความสำคัญของตำแหน่งที่จะวาง (1 = วางคู่กับ * หรือ / -> ใส่วงเล็บถ้าเป็นบวก/ลบ)
    public static string ToCs(string? src, ISet<string> names, int need = 0)
    {
        var ast = Parse(src);
        foreach (var n in Vars(ast))
            if (!names.Contains(n)) throw new FormatException($"ไม่มี parameter ชื่อ {n}");
        return Emit(ast, need);
    }

    public static ISet<string> VarsOf(string? src) => Vars(Parse(src)).ToHashSet();

    private static IEnumerable<string> Vars(Node n) => n switch
    {
        Var v => new[] { v.Name },
        Neg g => Vars(g.A),
        Bin b => Vars(b.A).Concat(Vars(b.B)),
        Call c => c.Args.SelectMany(Vars),
        _ => Array.Empty<string>()
    };

    // ---------------- parse ----------------

    private static Node Parse(string? src)
    {
        var s = (src ?? "").Trim();
        if (s.Length == 0) throw new FormatException("นิพจน์ว่าง");
        var tk = Tokenize(s);
        int p = 0;
        Tok? Peek() => p < tk.Count ? tk[p] : null;
        Tok Take() => p < tk.Count ? tk[p++] : throw new FormatException($"\"{s}\": นิพจน์จบไม่ครบ");
        void Expect(char t)
        {
            var x = Take();
            if (x.T != t) throw new FormatException($"\"{s}\": คาดว่าจะเป็น '{t}' ที่ตำแหน่ง {x.At + 1}");
        }

        Node Expr()
        {
            var a = Term();
            while (Peek() is { T: '+' or '-' }) { var op = Take().T; a = new Bin(op, a, Term()); }
            return a;
        }
        Node Term()
        {
            var a = Unary();
            while (Peek() is { T: '*' or '/' }) { var op = Take().T; a = new Bin(op, a, Unary()); }
            return a;
        }
        Node Unary()
        {
            if (Peek() is { T: '-' }) { Take(); return new Neg(Unary()); }
            if (Peek() is { T: '+' }) { Take(); return Unary(); }
            return Atom();
        }
        Node Atom()
        {
            var x = Take();
            if (x.T == 'n') return new Num(double.Parse(x.V, CultureInfo.InvariantCulture));
            if (x.T == '(') { var e = Expr(); Expect(')'); return e; }
            if (x.T == 'i')
            {
                if (Peek() is { T: '(' })
                {
                    var f = x.V.ToLowerInvariant();
                    if (!Funcs.TryGetValue(f, out var ar)) throw new FormatException($"ไม่มีฟังก์ชัน {x.V}()");
                    Take();
                    var args = new List<Node>();
                    if (Peek() is not { T: ')' })
                    {
                        args.Add(Expr());
                        while (Peek() is { T: ',' }) { Take(); args.Add(Expr()); }
                    }
                    Expect(')');
                    if (args.Count < ar.Min || args.Count > ar.Max) throw new FormatException($"{f}() จำนวนค่าไม่ถูกต้อง");
                    return new Call(f, args);
                }
                return new Var(x.V);
            }
            throw new FormatException($"\"{s}\": ไม่คาดว่าจะเจอ '{x.T}' ที่ตำแหน่ง {x.At + 1}");
        }

        var ast = Expr();
        if (p < tk.Count) throw new FormatException($"\"{s}\": มีส่วนเกินที่ตำแหน่ง {tk[p].At + 1}");
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
            var num = System.Text.RegularExpressions.Regex.Match(s[i..], @"^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?");
            if (num.Success) { o.Add(new Tok('n', num.Value, i)); i += num.Length; continue; }
            var id = System.Text.RegularExpressions.Regex.Match(s[i..], @"^[A-Za-z_][A-Za-z0-9_]*");
            if (id.Success) { o.Add(new Tok('i', id.Value, i)); i += id.Length; continue; }
            if ("+-*/(),".Contains(c)) { o.Add(new Tok(c, c.ToString(), i)); i++; continue; }
            throw new FormatException($"\"{s}\": ใช้อักษร '{c}' ไม่ได้");
        }
        return o;
    }

    // ---------------- emit C# ----------------
    // prec: 0 = บวก/ลบ, 1 = คูณ/หาร, 2 = ตัวเดี่ยว — ใส่วงเล็บเท่าที่จำเป็น

    private static string Emit(Node n, int need)
    {
        switch (n)
        {
            case Num x: return Lit(x.V);
            case Var v: return v.Name;
            case Neg g:
            {
                var a = Emit(g.A, 2);
                return Wrap(a.StartsWith('-') ? "-(" + a + ")" : "-" + a, 2, need);   // --x ใน C# คือ decrement
            }
            case Bin b:
            {
                int prec = b.Op is '+' or '-' ? 0 : 1;
                // ด้านขวาของ - และ / ต้องมีวงเล็บถ้าลำดับเท่ากัน (a - (b - c))
                string l = Emit(b.A, prec), r = Emit(b.B, b.Op is '-' or '/' ? prec + 1 : prec);
                return Wrap($"{l} {b.Op} {r}", prec, need);
            }
            case Call c:
            {
                var a = c.Args.Select(x => Emit(x, 0)).ToList();
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

    private static string Fold(string f, List<string> a) => a.Count == 1 ? a[0] : $"{f}({a[0]}, {Fold(f, a.Skip(1).ToList())})";
    private static string Wrap(string s, int prec, int need) => prec < need ? "(" + s + ")" : s;

    // ตัวเลขเป็น literal double ที่อ่านง่าย: 3 -> 3.0, 0.5 -> 0.5, 1e-7 -> 1E-07
    public static string Lit(double v)
    {
        var s = v.ToString("R", CultureInfo.InvariantCulture);
        return s.Contains('.') || s.Contains('E') || s.Contains("Infinity") || s == "NaN" ? s : s + ".0";
    }
}
