// เงื่อนไขทั้งหมดของ subassembly Trapezoid (ย้ายมาจาก test.cs เดิม)
// ไฟล์นี้ไม่อ้างอิง Civil 3D เลย -> Civil 3D และเว็บเรียกใช้โค้ดชุดเดียวกัน
//
// รูปตัด (Side = Right):
//
//        P1 (origin)     TopWidth       P2
//         o============================o              <- Top
//        /                              \
//       /                                \   Depth (>= 2 m)
//      o=============o~~~~~~~~~~~~~~~~~~~~o P3         <- ระดับฐาน
//     P4              \__ surface __       \
//                                   \___    \
//                                       \___ o E3      <- ต่อ slope เดิมลงไปชน surface
//
// กฎของขอบล่าง (เมื่อมี Target Surface):
//   - ขอบล่าง = ค่าที่ต่ำกว่าระหว่าง "ระดับฐาน" กับ "ผิว surface"
//     ช่วงที่ surface สูงกว่าฐาน -> ใช้เส้นฐานแนวนอน (ปิดชน surface)
//     ช่วงที่ surface ต่ำกว่าฐาน -> ขอบล่างวิ่งตามผิว surface
//   - ถ้า P3 / P4 ลอยอยู่เหนือ surface จะต่อเส้นด้านข้างลงไปด้วย slope เดิมจนชน surface (E3 / E4)
//   - Layout mode หรือไม่ได้กำหนด surface -> วาดคางหมูปกติ

using System;
using System.Collections.Generic;

namespace SA.Core
{
    public class TrapezoidParams
    {
        // ค่า Side ตามมาตรฐาน stock subassembly
        public const int Right = 0;
        public const int Left = 1;

        public const int SideDefault = Right;
        public const double TopWidthDefault = 3.0;
        public const double BottomWidthDefault = 5.0;
        public const double DepthDefault = 2.0;

        public int Side { get; set; } = SideDefault;
        public double TopWidth { get; set; } = TopWidthDefault;
        public double BottomWidth { get; set; } = BottomWidthDefault;
        public double Depth { get; set; } = DepthDefault;
    }

    public static class TrapezoidLogic
    {
        // ชื่อ parameter (ใช้ทั้งใน Civil 3D และข้อความเตือน)
        public const string SideParam = "Side";
        public const string TopWidthParam = "TopWidth";
        public const string BottomWidthParam = "BottomWidth";
        public const string DepthParam = "Depth";

        // ความสูงขั้นต่ำ (เมตร)
        public const double MinDepth = 2.0;

        private const double Tolerance = 1e-6;

        // ground = null -> Layout mode หรือไม่มี Target Surface
        public static SubassemblyResult Build(TrapezoidParams prm, IGround ground)
        {
            var res = new SubassemblyResult();

            int side = prm.Side;
            double topWidth = prm.TopWidth;
            double bottomWidth = prm.BottomWidth;
            double depth = prm.Depth;

            // ตรวจค่าที่ผู้ใช้ใส่
            if (topWidth <= 0)
            {
                AddIssue(res, IssueKind.ValueShouldNotBeLessThanOrEqualToZero, true, TopWidthParam);
                topWidth = TrapezoidParams.TopWidthDefault;
            }
            if (bottomWidth <= 0)
            {
                AddIssue(res, IssueKind.ValueShouldNotBeLessThanOrEqualToZero, true, BottomWidthParam);
                bottomWidth = TrapezoidParams.BottomWidthDefault;
            }
            if (depth < MinDepth)
            {
                AddIssue(res, IssueKind.ValueTooSmall, false,
                    $"{DepthParam} = {depth} < {MinDepth} m, ใช้ {MinDepth} m แทน");
                depth = MinDepth;
            }

            // กลับด้านเมื่อวางฝั่งซ้าย
            double flip = side == TrapezoidParams.Left ? -1.0 : 1.0;
            res.Trace.Add(side == TrapezoidParams.Left ? "Side = Left → กลับด้าน (flip = -1)" : "Side = Right");

            // ระยะยื่นของฐานแต่ละข้าง (บวก = ฐานกว้างกว่าด้านบน)
            double halfDiff = (bottomWidth - topWidth) / 2.0;
            double baseY = -depth;

            var p1 = new Vertex(0.0, 0.0, "TrapTopInside", "Top");
            var p2 = new Vertex(topWidth, 0.0, "TrapTopOutside", "TrapSide");
            var p3 = new Vertex(topWidth + halfDiff, baseY, "TrapBaseOutside");
            var p4 = new Vertex(-halfDiff, baseY, "TrapBaseInside", "TrapSide");

            // เส้นขอบจาก P3 วนไปถึง P4 (ด้านข้างที่ต่อลงไป + ขอบล่าง)
            List<Vertex> lowerChain = null;

            if (ground == null)
            {
                res.Trace.Add("ไม่มี surface (หรือ Layout mode) → วาดคางหมูปกติ");
            }
            else
            {
                try
                {
                    lowerChain = BuildLowerChain(ground, p3, p4, halfDiff, depth, baseY, res.Trace);
                }
                catch (Exception e)
                {
                    AddIssue(res, IssueKind.Failure, false, "Trapezoid: คำนวณกับ surface ไม่สำเร็จ - " + e.Message);
                    res.Trace.Add("คำนวณกับ surface ไม่สำเร็จ → กลับไปวาดคางหมูปกติ");
                    lowerChain = null;
                }
            }

            if (lowerChain == null)
            {
                // คางหมูปกติ
                p3.LinkCodes = new[] { "Datum", "TrapBase" };
                lowerChain = new List<Vertex> { p3, p4 };
            }

            var outline = new List<Vertex> { p1, p2 };
            outline.AddRange(lowerChain);

            BuildShape(res, outline, flip);
            return res;
        }

        // ------------------------------------------------------------------
        // คำนวณเส้นขอบจาก P3 ถึง P4 ตาม surface

        private static List<Vertex> BuildLowerChain(IGround ground, Vertex p3, Vertex p4,
                                                    double halfDiff, double depth, double baseY,
                                                    List<string> trace)
        {
            // slope ของด้านข้าง (ลงต่อ 1 หน่วยแนวราบ) ใช้ค่าเดิมตอนต่อลงไปชน surface
            double run = Math.Max(Math.Abs(halfDiff), 1e-4);
            double sideSlope = -depth / run;

            // ทิศที่ด้านข้างวิ่งออกไป (ในแกน U): ด้านนอกไป +U ด้านในไป -U เมื่อฐานกว้างกว่าด้านบน
            double outsideDir = halfDiff >= 0 ? 1.0 : -1.0;
            double insideDir = -outsideDir;

            // ปลายด้านนอก (R) และด้านใน (L) ของขอบล่าง
            double gOut = ground.ElevationAt(p3.U);
            double gIn = ground.ElevationAt(p4.U);
            bool extendOutside = gOut < baseY - Tolerance;
            bool extendInside = gIn < baseY - Tolerance;

            Vertex r = extendOutside ? ground.IntersectFrom(p3, outsideDir, sideSlope, "TrapToeOutside") : p3;
            Vertex l = extendInside ? ground.IntersectFrom(p4, insideDir, sideSlope, "TrapToeInside") : p4;

            trace.Add(extendOutside
                ? $"P3: surface ({gOut:0.000}) ต่ำกว่าฐาน ({baseY:0.000}) → ต่อด้านข้างลงชน surface ที่ E3 (u = {r.U:0.000}, y = {r.Y:0.000})"
                : $"P3: surface ({gOut:0.000}) ไม่ต่ำกว่าฐาน ({baseY:0.000}) → ไม่ต่อด้านข้าง");
            trace.Add(extendInside
                ? $"P4: surface ({gIn:0.000}) ต่ำกว่าฐาน ({baseY:0.000}) → ต่อด้านข้างลงชน surface ที่ E4 (u = {l.U:0.000}, y = {l.Y:0.000})"
                : $"P4: surface ({gIn:0.000}) ไม่ต่ำกว่าฐาน ({baseY:0.000}) → ไม่ต่อด้านข้าง");

            if (l.U >= r.U - Tolerance)
                throw new InvalidOperationException("ด้านข้างที่ต่อลงไปตัดกันก่อนถึง surface");

            // ขอบล่าง = min(ระดับฐาน, surface) จาก L ไป R
            List<Vertex> bottom = BuildBottom(ground, l, r, baseY);

            int onBase = 0, onSurface = 0;
            for (int i = 0; i < bottom.Count - 1; i++)
            {
                if (IsOnBase(bottom[i].Y, baseY) && IsOnBase(bottom[i + 1].Y, baseY)) onBase++;
                else onSurface++;
            }
            trace.Add($"ขอบล่าง: {onBase} ช่วงเป็นเส้นฐาน (TrapBase), {onSurface} ช่วงวิ่งตามผิว surface (TrapOnSurface)");

            // ประกอบเส้นขอบ P3 -> (E3) -> ขอบล่างจากนอกเข้าใน -> (E4) -> P4
            var chain = new List<Vertex>();

            if (extendOutside)
            {
                p3.LinkCodes = new[] { "TrapSide" };
                chain.Add(p3);
            }

            // bottom เรียงจาก L ไป R จึงไล่ย้อนกลับ; link code ของจุด i คือช่วง i -> i-1
            for (int i = bottom.Count - 1; i >= 0; i--)
            {
                Vertex v = bottom[i];
                if (i > 0)
                    v.LinkCodes = BottomLinkCodes(bottom[i], bottom[i - 1], baseY);
                chain.Add(v);
            }

            if (extendInside)
            {
                // จุดสุดท้ายของ bottom คือ E4 -> ต่อขึ้นไป P4 ตาม slope เดิม
                Vertex e4 = chain[chain.Count - 1];
                e4.LinkCodes = new[] { "TrapSide" };
                chain[chain.Count - 1] = e4;
                chain.Add(p4);
            }
            else
            {
                // จุดสุดท้ายคือ P4 เอง ใช้ link ด้านข้างกลับขึ้น P1
                Vertex last = chain[chain.Count - 1];
                last.LinkCodes = p4.LinkCodes;
                chain[chain.Count - 1] = last;
            }

            return chain;
        }

        // เส้นขอบล่างจาก L ไป R: ใช้ระดับฐานในช่วงที่ surface สูงกว่า และใช้ผิว surface ในช่วงที่ต่ำกว่า
        private static List<Vertex> BuildBottom(IGround ground, Vertex l, Vertex r, double baseY)
        {
            List<(double U, double Y)> profile = ground.Profile(l.U, r.U);

            var raw = new List<(double U, double Y)>();
            raw.Add((profile[0].U, Math.Min(profile[0].Y, baseY)));
            for (int i = 0; i < profile.Count - 1; i++)
            {
                var a = profile[i];
                var b = profile[i + 1];

                // surface ตัดผ่านระดับฐาน -> เพิ่มจุดตัด
                if ((a.Y - baseY) * (b.Y - baseY) < 0)
                {
                    double t = (baseY - a.Y) / (b.Y - a.Y);
                    raw.Add((a.U + t * (b.U - a.U), baseY));
                }
                raw.Add((b.U, Math.Min(b.Y, baseY)));
            }

            // ตัดจุดซ้ำและจุดกลางของช่วงที่เป็นเส้นฐานแนวนอน
            var cleaned = new List<(double U, double Y)>();
            foreach (var p in raw)
            {
                if (cleaned.Count > 0 && Math.Abs(p.U - cleaned[cleaned.Count - 1].U) < 1e-4)
                    continue;
                if (cleaned.Count >= 2
                    && IsOnBase(p.Y, baseY)
                    && IsOnBase(cleaned[cleaned.Count - 1].Y, baseY)
                    && IsOnBase(cleaned[cleaned.Count - 2].Y, baseY))
                {
                    cleaned[cleaned.Count - 1] = p;
                    continue;
                }
                cleaned.Add(p);
            }

            var bottom = new List<Vertex>();
            for (int i = 0; i < cleaned.Count; i++)
                bottom.Add(new Vertex(cleaned[i].U, cleaned[i].Y, ""));

            // ปลายทั้งสองข้างใช้ L / R ตัวจริง (เก็บ code ไว้)
            if (bottom.Count < 2)
                bottom = new List<Vertex> { l, r };
            else
            {
                bottom[0] = l;
                bottom[bottom.Count - 1] = r;
            }
            return bottom;
        }

        private static string[] BottomLinkCodes(Vertex a, Vertex b, double baseY)
        {
            bool onBase = IsOnBase(a.Y, baseY) && IsOnBase(b.Y, baseY);
            return onBase ? new[] { "Datum", "TrapBase" } : new[] { "Datum", "TrapOnSurface" };
        }

        private static bool IsOnBase(double y, double baseY) => Math.Abs(y - baseY) < 1e-4;

        // ------------------------------------------------------------------
        // แปลงเส้นรอบรูปเป็น points / links / shape (ปิดกลับไปจุดแรกเอง)
        // เดิมคือ AddShape ที่สร้างลง Civil 3D ตรงๆ ตอนนี้แค่เก็บเป็นข้อมูล

        private static void BuildShape(SubassemblyResult res, List<Vertex> outline, double flip)
        {
            for (int i = 0; i < outline.Count; i++)
            {
                res.Points.Add(new OutPoint
                {
                    X = flip * outline[i].U,
                    Y = outline[i].Y,
                    Code = outline[i].PointCode ?? ""
                });
            }

            for (int i = 0; i < outline.Count; i++)
            {
                res.Links.Add(new OutLink
                {
                    From = i,
                    To = (i + 1) % outline.Count,
                    Codes = outline[i].LinkCodes ?? new string[0]
                });
            }

            res.ShapeCodes.Add("Trapezoid");
        }

        private static void AddIssue(SubassemblyResult res, IssueKind kind, bool isError, string message)
        {
            res.Issues.Add(new Issue { Kind = kind, IsError = isError, Message = message });
        }
    }
}
