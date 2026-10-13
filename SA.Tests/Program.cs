// ทดสอบเงื่อนไขของ TrapezoidLogic โดยไม่ต้องเปิด Civil 3D
// รัน: dotnet run --project SA.Tests
//
// เพิ่มกรณีใหม่ได้ด้วยการเขียน Test("ชื่อกรณี", () => { ... }) แล้วใช้ Eq / Near / True ตรวจผล

using SA.Core;

int passed = 0, failed = 0;

void Test(string name, Action body)
{
    try { body(); passed++; Console.WriteLine($"  PASS  {name}"); }
    catch (Exception e) { failed++; Console.WriteLine($"  FAIL  {name}\n        {e.Message}"); }
}
void True(bool cond, string msg) { if (!cond) throw new Exception(msg); }
void Eq<T>(T expected, T actual, string what) { if (!Equals(expected, actual)) throw new Exception($"{what}: คาด {expected} ได้ {actual}"); }
void Near(double expected, double actual, string what, double tol = 1e-3) { if (Math.Abs(expected - actual) > tol) throw new Exception($"{what}: คาด {expected:0.####} ได้ {actual:0.####}"); }
void Pt(SubassemblyResult r, int i, double x, double y) { Near(x, r.Points[i].X, $"จุด {i} X"); Near(y, r.Points[i].Y, $"จุด {i} Y"); }
string Codes(SubassemblyResult r, int link) => string.Join(",", r.Links[link].Codes);

PolylineGround Ground(double flip, params (double X, double Y)[] pts) => new PolylineGround(pts, flip);

// Top = 3, Bottom = 5, Depth = 2 -> P1 (0,0) P2 (3,0) P3 (4,-2) P4 (-1,-2), slope ด้านข้าง = -2
var std = new TrapezoidParams();

Console.WriteLine("TrapezoidLogic");

Test("ไม่มี surface → คางหมูปกติ 4 จุด", () =>
{
    var r = TrapezoidLogic.Build(std, null);
    Eq(4, r.Points.Count, "จำนวนจุด");
    Pt(r, 0, 0, 0); Pt(r, 1, 3, 0); Pt(r, 2, 4, -2); Pt(r, 3, -1, -2);
    Eq("Top", Codes(r, 0), "link 0");
    Eq("Datum,TrapBase", Codes(r, 2), "link P3→P4");
    Eq(0, r.Issues.Count, "issue");
});

Test("surface ราบสูงกว่าฐาน → ไม่ต่อด้านข้าง ใช้เส้นฐาน", () =>
{
    var r = TrapezoidLogic.Build(std, Ground(1, (-20, -1), (0, -1), (20, -1)));
    Eq(4, r.Points.Count, "จำนวนจุด");
    Pt(r, 2, 4, -2); Pt(r, 3, -1, -2);
    Eq("Datum,TrapBase", Codes(r, 2), "link ขอบล่าง");
});

Test("surface ราบต่ำกว่าฐาน → ต่อลงชน surface ทั้งสองข้าง", () =>
{
    var r = TrapezoidLogic.Build(std, Ground(1, (-20, -3), (20, -3)));
    Eq(6, r.Points.Count, "จำนวนจุด");
    Pt(r, 2, 4, -2); Pt(r, 3, 4.5, -3); Pt(r, 4, -1.5, -3); Pt(r, 5, -1, -2);
    Eq("TrapToeOutside", r.Points[3].Code, "code E3");
    Eq("TrapToeInside", r.Points[4].Code, "code E4");
    Eq("TrapSide", Codes(r, 2), "link P3→E3");
    Eq("Datum,TrapOnSurface", Codes(r, 3), "link E3→E4");
    Eq("TrapSide", Codes(r, 4), "link E4→P4");
});

Test("Side = Left → ผลเป็นภาพสะท้อนของฝั่งขวา", () =>
{
    var left = new TrapezoidParams { Side = TrapezoidParams.Left };
    var r = TrapezoidLogic.Build(left, Ground(-1, (-20, -3), (20, -3)));
    Eq(6, r.Points.Count, "จำนวนจุด");
    Pt(r, 1, -3, 0); Pt(r, 3, -4.5, -3); Pt(r, 4, 1.5, -3);
});

Test("surface ลาดตัดผ่านระดับฐาน → ขอบล่างแบ่งเป็นเส้นฐาน + ตามผิว", () =>
{
    // y = -2 - 0.1x : ตัดระดับฐานที่ x = 0
    var r = TrapezoidLogic.Build(std, Ground(1, (-10, -1), (10, -3)));
    Eq(6, r.Points.Count, "จำนวนจุด");
    Pt(r, 3, 8 / 1.9, -2 - 0.1 * (8 / 1.9));   // E3
    Pt(r, 4, 0, -2);                            // จุดที่ surface ตัดระดับฐาน
    Pt(r, 5, -1, -2);                           // P4 (ไม่ต่อ)
    Eq("Datum,TrapOnSurface", Codes(r, 3), "link E3→จุดตัด");
    Eq("Datum,TrapBase", Codes(r, 4), "link จุดตัด→P4");
});

Test("surface มีจุดหักใต้ฐาน → ขอบล่างวิ่งตามจุดหัก", () =>
{
    var r = TrapezoidLogic.Build(std, Ground(1, (-20, -1), (0, -1), (1.5, -2.5), (3, -1), (20, -1)));
    // surface ตัดระดับฐานที่ x = 1 และ x = 2
    // ขอบล่าง (นอกเข้าใน): P3 → (2,-2) → (1.5,-2.5) → (1,-2) → P4
    Eq(7, r.Points.Count, "จำนวนจุด");
    Pt(r, 3, 2, -2); Pt(r, 4, 1.5, -2.5); Pt(r, 5, 1, -2); Pt(r, 6, -1, -2);
    Eq("Datum,TrapOnSurface", Codes(r, 3), "link เข้าแอ่ง");
    Eq("Datum,TrapBase", Codes(r, 5), "link ฐานด้านใน");
});

Test("surface สั้นเกินไป → เตือน Failure และกลับไปคางหมูปกติ", () =>
{
    var r = TrapezoidLogic.Build(std, Ground(1, (0, -3), (4.2, -3)));
    Eq(4, r.Points.Count, "จำนวนจุด");
    Eq(1, r.Issues.Count, "issue");
    Eq(IssueKind.Failure, r.Issues[0].Kind, "ชนิด issue");
});

Test("Depth < 2 → เตือนและใช้ 2 m", () =>
{
    var r = TrapezoidLogic.Build(new TrapezoidParams { Depth = 1.2 }, null);
    Eq(IssueKind.ValueTooSmall, r.Issues[0].Kind, "ชนิด issue");
    Pt(r, 2, 4, -2);
});

Test("TopWidth <= 0 → error และใช้ค่า default", () =>
{
    var r = TrapezoidLogic.Build(new TrapezoidParams { TopWidth = 0 }, null);
    True(r.Issues[0].IsError, "ต้องเป็น error");
    Pt(r, 1, 3, 0);
});

Console.WriteLine($"\n{passed} ผ่าน, {failed} ไม่ผ่าน");
return failed == 0 ? 0 : 1;
