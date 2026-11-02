// ทดสอบตัวแปลงนิพจน์ -> C# (SpecExpr) ของรอบ 4: เงื่อนไข, ค่าจากเรขาคณิต, ชนิด, error ภาษาไทย
// (ผลคำนวณจริงเทียบกับ JS อยู่ใน DrawingTests ผ่าน drawing-cases.json)

using SA.Drawing;

static class ExprTests
{
    public static void Run(Action<string, Action> test)
    {
        void Eq(string e, string a, string w) { if (e != a) throw new Exception($"{w}: คาด {e} ได้ {a}"); }
        void Throws(Action f, string part, string w)
        {
            try { f(); }
            catch (FormatException e) { if (!e.Message.Contains(part)) throw new Exception($"{w}: ข้อความ \"{e.Message}\" ต้องมี \"{part}\""); return; }
            throw new Exception($"{w}: ต้อง error");
        }
        var sc = new ExprScope
        {
            Params = new HashSet<string> { "Width" }, Points = new HashSet<string> { "P2", "P3" },
            Targets = new HashSet<string> { "TargetSurface" }, Surface = t => t == null || t == "TargetSurface" ? "surface" : "surface2"
        };
        string Cs(string src, string want = "num") => SpecExpr.ToCs(src, sc, 0, want);

        Console.WriteLine("\nนิพจน์เงื่อนไข -> C#");
        test("เปรียบเทียบ / ตรรกะ / if / == ด้วย Eq", () =>
        {
            Eq("Width > 2.0 && !(Width < 1.0) || false", Cs("Width > 2 and not Width < 1 or false", "bool"), "and / or / not");
            Eq("Eq(Width, 3.0)", Cs("Width == 3", "bool"), "==");
            Eq("!Eq(Width, 3.0)", Cs("Width != 3", "bool"), "!=");
            Eq("(Width > 1.0) == true", Cs("(Width > 1) == true", "bool"), "== ของ จริง/เท็จ");
            Eq("(Width > 2.0 ? 2.0 : 4.0) * 2.0", Cs("if(Width > 2, 2, 4) * 2"), "if ในการคูณ");
            Eq("Width > 1.0 && (Width < 5.0 || Width == 9.0)".Replace("Width == 9.0", "Eq(Width, 9.0)"), Cs("Width > 1 && (Width < 5 || Width == 9)", "bool"), "วงเล็บ || ใน &&");
        });
        test("ค่าจากเรขาคณิต: P3.x (กรอบ Right), P3.y, ground, exists, hasGround", () =>
        {
            Eq("F * PX(P3) + 1.0", Cs("P3.x + 1"), "P3.x");
            Eq("Width * F * PX(P3)", Cs("Width * P3.x"), "P3.x หลัง *");
            Eq("Width / (F * PX(P3))", Cs("Width / P3.x"), "P3.x หลัง /");
            Eq("Ground(cs, surface, P2) - PY(P2)", Cs("ground(P2) - P2.y"), "ground");
            Eq("Ground(cs, surface, P2)", Cs("ground(P2, \"TargetSurface\")"), "ground + target");
            Eq("Exists(P3) && !surface.IsNull", Cs("exists(P3) and hasGround()", "bool"), "exists / hasGround");
            var loose = new ExprScope { Params = sc.Params, Points = sc.Points, AllowMissingPoints = true, Surface = sc.Surface };
            Eq("PY(null)", SpecExpr.ToCs("P9.y", loose), "จุดที่ไม่มี (ตอนสร้างโค้ด) = null");
            Eq("P2,P3", string.Join(",", SpecExpr.PointRefs("P3.x + ground(P2) + if(exists(P3), 1, 0)").OrderBy(x => x)), "PointRefs");
        });
        test("ชนิด / error ภาษาไทยพร้อมตำแหน่ง", () =>
        {
            Throws(() => Cs("Width > 1"), "ช่องนี้ต้องเป็นตัวเลข", "ช่องตัวเลข");
            Throws(() => Cs("Width + 1", "bool"), "ช่องนี้ต้องเป็นจริง/เท็จ", "ช่องเงื่อนไข");
            Throws(() => Cs("true + 1"), "ด้านซ้ายของ + ต้องเป็นตัวเลข แต่ได้จริง/เท็จ (ตำแหน่ง 1)", "true + 1");
            Throws(() => Cs("1 < 2 < 3", "bool"), "a < b < c", "ต่อกัน");
            Throws(() => Cs("Width = 3", "bool"), "==", "= ตัวเดียว");
            Throws(() => Cs("P4.y"), "ไม่มีจุด P4", "จุดที่ไม่มี");
            Throws(() => Cs("P3 + 1"), "P3 เป็นจุด", "ชื่อจุดลอยๆ");
            Throws(() => Cs("ground(P3, \"Rock\")"), "ไม่มี target ชื่อ Rock", "target");
            Throws(() => SpecExpr.ToCs("P3.y", new HashSet<string>()), "อ้างจุดไม่ได้", "ช่องที่อ้างจุดไม่ได้");
        });
        test("คำสงวน and / or / not / true / false ตั้งเป็นชื่อ parameter ไม่ได้ (ไม่สนตัวพิมพ์)", () =>
        {
            foreach (var n in new[] { "and", "OR", "Not", "true", "False", "Ground", "Exists", "PX", "Try" })
                if (!CodeGenerator.IsReservedName(n)) throw new Exception($"{n} ต้องเป็นคำสงวน");
        });
    }
}
