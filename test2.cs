// Subassembly ชั้นป้องกันลาดตลิ่ง + backfill ด้านหลัง (SlopeProtection) สำหรับ Civil 3D 2027 (.NET)
//
// Build: dotnet build -c Release  (ในโฟลเดอร์ TrapezoidSA, รวมอยู่ใน TrapezoidSA.dll)
//
// รูปตัด (Side = Right, ลาดลงไปทางขวา):
//
//   T0                         P1   P2                       <- ระดับบน (y = 0)
//    o=========================o====o
//     \__ ground                \    \
//        \___                    \    \   ชั้นป้องกัน (หนา Thickness ตั้งฉากกับลาด)
//            \__   backfill       \    \  ลาด SlopeRatio : 1
//               |   >= 1 m ตั้งฉาก  \    \
//               \  (BackfillWidth)  \    \
//                \__________________o====o                 <- ระดับฐาน (y = -Height)
//                                  P4    P3
//
// ขอบล่างของ backfill (ไล่ตามระยะ u):
//   lower(u) = max( ระดับฐาน, min( ผิวดิน, เส้น offset ที่ห่างจากเส้นหลัง P1-P4 ตั้งฉาก BackfillWidth ) )
//   - ช่วงที่ผิวดินอยู่ห่างจากลาดเกิน BackfillWidth -> ขอบล่างวิ่งตามผิวดิน
//   - ช่วงที่ผิวดินเข้ามาใกล้ลาด (หรือตัดผ่านชั้นป้องกัน) -> ใช้เส้น offset (ขุดออกให้ได้อย่างน้อย BackfillWidth)
//   - ไม่ต่ำกว่าระดับฐาน
//   - ด้านบนปิดด้วยระดับบน จากจุดที่ผิวดินชนระดับบน (T0) มาถึง P1
//   Layout mode / ไม่มี surface -> backfill เป็นแถบกว้าง BackfillWidth ขนานกับลาด

using System;
using System.Collections.Generic;
using Autodesk.Civil;
using Autodesk.Civil.ApplicationServices;
using Autodesk.Civil.DatabaseServices;
using Autodesk.Civil.Runtime;
using AcDb = Autodesk.AutoCAD.DatabaseServices;
using ObjectId = Autodesk.AutoCAD.DatabaseServices.ObjectId;

namespace TestSubassembly
{
    public class SlopeProtection
    {
        // ชื่อ parameter
        private const string SideParam = "Side";
        private const string HeightParam = "Height";
        private const string SlopeRatioParam = "SlopeRatio";
        private const string ThicknessParam = "Thickness";
        private const string BackfillWidthParam = "BackfillWidth";
        private const string SearchWidthParam = "SearchWidth";
        private const string SurfaceTarget = "TargetSurface";

        private const int Right = 0;
        private const int Left = 1;

        // ค่า default
        private const int SideDefault = Right;
        private const double HeightDefault = 4.0;
        private const double SlopeRatioDefault = 1.5;   // แนวราบ 1.5 : แนวดิ่ง 1
        private const double ThicknessDefault = 0.5;    // ความหนาชั้นป้องกัน (ตั้งฉากกับลาด)
        private const double BackfillWidthDefault = 1.0;
        private const double SearchWidthDefault = 50.0; // ระยะสูงสุดที่มองหาผิวดินด้านหลัง

        // ระยะตั้งฉากขั้นต่ำของ backfill (เมตร)
        private const double MinBackfillWidth = 1.0;

        private const double Tolerance = 1e-6;

        // ------------------------------------------------------------------
        // Civil 3D เรียก 4 เมธอดนี้ผ่าน .atc

        public void GetLogicalNames()
        {
            CorridorState corridorState = null;
            try
            {
                corridorState = CivilApplication.ActiveDocument.CorridorState;

                ParamLong param = corridorState.ParamsLong.Add(SurfaceTarget, (int)ParamLogicalNameType.Surface);
                param.DisplayName = "Target Surface";
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

                corridorState.ParamsLong.Add(SideParam, SideDefault);
                corridorState.ParamsDouble.Add(HeightParam, HeightDefault);
                corridorState.ParamsDouble.Add(SlopeRatioParam, SlopeRatioDefault);
                corridorState.ParamsDouble.Add(ThicknessParam, ThicknessDefault);
                corridorState.ParamsDouble.Add(BackfillWidthParam, BackfillWidthDefault);
                corridorState.ParamsDouble.Add(SearchWidthParam, SearchWidthDefault);
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
                DrawImplement(corridorState);
            }
            catch (Exception e)
            {
                RecordError(corridorState, e);
            }
        }

        // ------------------------------------------------------------------

        private void DrawImplement(CorridorState corridorState)
        {
            ParamLongCollection paramsLong = corridorState.ParamsLong;
            ParamDoubleCollection paramsDouble = corridorState.ParamsDouble;

            int side = (int)GetLong(paramsLong, SideParam, SideDefault);
            double height = GetDouble(paramsDouble, HeightParam, HeightDefault);
            double slopeRatio = GetDouble(paramsDouble, SlopeRatioParam, SlopeRatioDefault);
            double thickness = GetDouble(paramsDouble, ThicknessParam, ThicknessDefault);
            double backfillWidth = GetDouble(paramsDouble, BackfillWidthParam, BackfillWidthDefault);
            double searchWidth = GetDouble(paramsDouble, SearchWidthParam, SearchWidthDefault);

            if (height <= 0)
            {
                RecordError(corridorState, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, HeightParam);
                height = HeightDefault;
            }
            if (slopeRatio <= 0)
            {
                RecordError(corridorState, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, SlopeRatioParam);
                slopeRatio = SlopeRatioDefault;
            }
            if (thickness <= 0)
            {
                RecordError(corridorState, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, ThicknessParam);
                thickness = ThicknessDefault;
            }
            if (backfillWidth < MinBackfillWidth)
            {
                RecordWarning(corridorState, CorridorError.ValueTooSmall,
                    $"{BackfillWidthParam} = {backfillWidth} < {MinBackfillWidth} m, ใช้ {MinBackfillWidth} m แทน");
                backfillWidth = MinBackfillWidth;
            }
            if (searchWidth <= 0)
            {
                RecordError(corridorState, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, SearchWidthParam);
                searchWidth = SearchWidthDefault;
            }

            double flip = side == Left ? -1.0 : 1.0;

            // ------------------------------------------------------------------
            // ชั้นป้องกัน (พิกัด U = ระยะออกด้านนอก, Y = ระดับเทียบ origin)
            double k = Math.Sqrt(1.0 + slopeRatio * slopeRatio);
            double run = slopeRatio * height;          // ระยะราบของลาด
            double topWidth = thickness * k;            // ความกว้างแนวราบของชั้นป้องกัน
            double offsetU = backfillWidth * k;         // ระยะราบของเส้น offset จากเส้นหลัง

            PointCollection points = corridorState.Points;
            LinkCollection links = corridorState.Links;
            ShapeCollection shapes = corridorState.Shapes;

            Point p1 = AddPoint(points, flip, 0.0, 0.0, "RevTopInside");
            Point p2 = AddPoint(points, flip, topWidth, 0.0, "RevTopOutside");
            Point p3 = AddPoint(points, flip, topWidth + run, -height, "RevToeOutside");
            Point p4 = AddPoint(points, flip, run, -height, "RevToeInside");

            Link revTop = AddLink(links, p1, p2, "Top", "RevetmentTop");
            Link revFace = AddLink(links, p2, p3, "Top", "RevetmentFace");
            Link revBase = AddLink(links, p3, p4, "Datum", "RevetmentBase");
            Link revBack = AddLink(links, p4, p1, "RevetmentBack");

            Shape revetment = shapes.Add(new[] { revTop, revFace, revBase, revBack }, "");
            revetment.Codes.TryAdd("Revetment");

            // ------------------------------------------------------------------
            // backfill
            GroundProfile ground = null;
            if (corridorState.Mode != CorridorMode.Layout)
            {
                ObjectId surfaceId = ObjectId.Null;
                try
                {
                    surfaceId = corridorState.ParamsSurface.Value(SurfaceTarget);
                }
                catch
                {
                    RecordWarning(corridorState, CorridorError.LogicalNameNotFound, "Target Surface");
                }

                if (!surfaceId.IsNull)
                {
                    try
                    {
                        ground = GroundProfile.Sample(corridorState, surfaceId, flip, -searchWidth, run);
                    }
                    catch (Exception e)
                    {
                        RecordWarning(corridorState, CorridorError.Failure, "SlopeProtection: อ่าน surface ไม่สำเร็จ - " + e.Message);
                    }
                }
            }

            var backfill = new BackfillSolver(ground, height, slopeRatio, offsetU, searchWidth);
            List<(double U, double Y, string LinkCode)> lower = backfill.Solve(out double topEndU, out bool hitSearchLimit);

            if (hitSearchLimit)
            {
                RecordWarning(corridorState, CorridorError.NoSideslopeIntersectFound,
                    "SlopeProtection: ไม่พบผิวดินชนระดับบนในระยะ SearchWidth, ปิด backfill ด้วยเส้นดิ่ง");
            }

            // เส้นรอบรูป backfill: T0 -> P1 -> (เส้นหลังชั้นป้องกัน) -> P4 -> ขอบล่างย้อนกลับ -> T0
            Point t0 = AddPoint(points, flip, topEndU, 0.0, "BackfillTopEnd");

            var backfillLinks = new List<Link>();
            backfillLinks.Add(AddLink(links, t0, p1, "Top", "BackfillTop"));
            backfillLinks.Add(revBack);

            // lower เรียงจาก P4 (U มาก) ไปหา T0 (U น้อย); จุดแรกคือ P4
            Point prev = p4;
            for (int i = 1; i < lower.Count; i++)
            {
                bool isLast = i == lower.Count - 1;
                bool endsAtT0 = isLast && Math.Abs(lower[i].Y) < 1e-4;

                Point next = endsAtT0 ? t0 : AddPoint(points, flip, lower[i].U, lower[i].Y, "");
                backfillLinks.Add(AddLink(links, prev, next, "Datum", lower[i - 1].LinkCode));
                prev = next;
            }

            // ปิดด้วยเส้นดิ่งเมื่อหาจุดชนระดับบนไม่เจอ
            if (!ReferenceEquals(prev, t0))
                backfillLinks.Add(AddLink(links, prev, t0, "BackfillEnd"));

            Shape backfillShape = shapes.Add(backfillLinks.ToArray(), "");
            backfillShape.Codes.TryAdd("Backfill");
        }

        // ------------------------------------------------------------------
        // คำนวณขอบล่างของ backfill

        private class BackfillSolver
        {
            private readonly GroundProfile _ground;
            private readonly double _height;
            private readonly double _slopeRatio;
            private readonly double _offsetU;
            private readonly double _searchWidth;

            public BackfillSolver(GroundProfile ground, double height, double slopeRatio, double offsetU, double searchWidth)
            {
                _ground = ground;
                _height = height;
                _slopeRatio = slopeRatio;
                _offsetU = offsetU;
                _searchWidth = searchWidth;
            }

            private double Run => _slopeRatio * _height;

            // เส้น offset ขนานกับเส้นหลัง P1-P4 ห่างออกไปด้านหลัง
            private double OffsetLineY(double u) => -(u + _offsetU) / _slopeRatio;

            private double GroundY(double u) => _ground == null ? double.PositiveInfinity : _ground.Eval(u);

            private double Lower(double u) => Math.Max(-_height, Math.Min(GroundY(u), OffsetLineY(u)));

            private string Classify(double u)
            {
                double y = Lower(u);
                if (Math.Abs(y + _height) < 1e-4) return "BackfillBase";
                if (Math.Abs(y - OffsetLineY(u)) < 1e-4) return "BackfillMinWidth";
                return "BackfillOnSurface";
            }

            // คืนจุดขอบล่างเรียงจาก P4 ไป T0 พร้อม code ของ link ที่ออกจากจุดนั้น
            public List<(double U, double Y, string LinkCode)> Solve(out double topEndU, out bool hitSearchLimit)
            {
                double domainLeft = _ground == null
                    ? -_offsetU
                    : Math.Max(_ground.MinU, -_searchWidth);

                List<double> candidates = BuildCandidates(domainLeft);

                // หา T0: จุดแรกทางซ้ายของ P1 ที่ขอบล่างขึ้นถึงระดับบน
                hitSearchLimit = true;
                topEndU = domainLeft;
                for (int i = candidates.Count - 1; i >= 0; i--)
                {
                    double u = candidates[i];
                    if (u > 0) continue;
                    if (Lower(u) >= -Tolerance)
                    {
                        topEndU = u;
                        hitSearchLimit = false;
                        break;
                    }
                }

                // จุดขอบล่างจาก T0 ถึง P4
                var raw = new List<(double U, double Y)>();
                foreach (double u in candidates)
                {
                    if (u < topEndU - Tolerance) continue;
                    raw.Add((u, Math.Min(Lower(u), 0.0)));
                }

                // ตัดจุดกลางที่อยู่บนเส้นตรงเดียวกัน
                var simplified = new List<(double U, double Y)>();
                foreach (var p in raw)
                {
                    if (simplified.Count >= 2)
                    {
                        var a = simplified[simplified.Count - 2];
                        var b = simplified[simplified.Count - 1];
                        double cross = (b.U - a.U) * (p.Y - a.Y) - (b.Y - a.Y) * (p.U - a.U);
                        if (Math.Abs(cross) < 1e-6)
                        {
                            simplified[simplified.Count - 1] = p;
                            continue;
                        }
                    }
                    simplified.Add(p);
                }

                // เรียงจาก P4 ไป T0 และกำหนด code ของแต่ละช่วงจากจุดกึ่งกลาง
                simplified.Reverse();
                var result = new List<(double U, double Y, string LinkCode)>();
                for (int i = 0; i < simplified.Count; i++)
                {
                    string code = "";
                    if (i < simplified.Count - 1)
                        code = Classify((simplified[i].U + simplified[i + 1].U) / 2.0);
                    result.Add((simplified[i].U, simplified[i].Y, code));
                }

                // จุดแรกต้องเป็น P4 พอดี
                result[0] = (Run, -_height, result[0].LinkCode);
                return result;
            }

            // ตำแหน่ง U ทั้งหมดที่ขอบล่างอาจหักมุม: จุดยอดผิวดิน + จุดตัดระหว่างเส้นต่างๆ
            private List<double> BuildCandidates(double domainLeft)
            {
                var list = new List<double> { domainLeft, 0.0, Run, -_offsetU, Run - _offsetU };

                if (_ground != null)
                {
                    IReadOnlyList<(double U, double Y)> g = _ground.Points;
                    for (int i = 0; i < g.Count; i++)
                    {
                        list.Add(g[i].U);
                        if (i == g.Count - 1) break;

                        var a = g[i];
                        var b = g[i + 1];
                        AddCrossing(list, a, b, u => OffsetLineY(u)); // ผิวดินตัดเส้น offset
                        AddCrossing(list, a, b, u => -_height);       // ผิวดินตัดระดับฐาน
                        AddCrossing(list, a, b, u => 0.0);            // ผิวดินตัดระดับบน
                    }
                }

                list.RemoveAll(u => u < domainLeft - Tolerance || u > Run + Tolerance);
                list.Sort();

                var unique = new List<double>();
                foreach (double u in list)
                {
                    if (unique.Count == 0 || u - unique[unique.Count - 1] > 1e-5)
                        unique.Add(u);
                }
                return unique;
            }

            private static void AddCrossing(List<double> list, (double U, double Y) a, (double U, double Y) b, Func<double, double> line)
            {
                double fa = a.Y - line(a.U);
                double fb = b.Y - line(b.U);
                if (fa * fb < 0)
                {
                    double t = fa / (fa - fb);
                    list.Add(a.U + t * (b.U - a.U));
                }
            }
        }

        // ------------------------------------------------------------------
        // รูปตัดผิวดินในพิกัดของ subassembly

        private class GroundProfile
        {
            private readonly List<(double U, double Y)> _points;

            private GroundProfile(List<(double U, double Y)> points)
            {
                _points = points;
            }

            public IReadOnlyList<(double U, double Y)> Points => _points;
            public double MinU => _points[0].U;

            // ระดับผิวดินที่ U (เกินปลายขวาใช้ค่าปลายสุด)
            public double Eval(double u)
            {
                if (u <= _points[0].U) return _points[0].Y;
                for (int i = 0; i < _points.Count - 1; i++)
                {
                    var a = _points[i];
                    var b = _points[i + 1];
                    if (u <= b.U)
                    {
                        double t = (u - a.U) / (b.U - a.U);
                        return a.Y + t * (b.Y - a.Y);
                    }
                }
                return _points[_points.Count - 1].Y;
            }

            public static GroundProfile Sample(CorridorState state, ObjectId surfaceId, double flip, double u1, double u2)
            {
                // origin เหมือน Utilities.GetAlignmentAndOrigin ใน stock sample
                ObjectId alignmentId;
                double originOffset, originElevation;
                if (state.CurrentAlignmentIsOffsetAlignment && state.CurrentAssemblyOffsetIsFixed)
                {
                    alignmentId = state.CurrentBaselineId;
                    originOffset = state.CurrentOffset + state.CurrentAssemblyFixedOffset;
                    originElevation = state.CurrentElevation + state.CurrentAssemblyFixedElevation;
                }
                else
                {
                    alignmentId = state.CurrentAlignmentId;
                    originOffset = state.CurrentOffset;
                    originElevation = state.CurrentElevation;
                }

                double station = state.CurrentStation;
                double ToU(double absOffset) => flip * (absOffset - originOffset);
                double ToAbs(double u) => originOffset + flip * u;

                var pts = new List<(double U, double Y)>();

                // ระดับที่ปลายทั้งสอง (ถ้าอยู่นอก surface ก็ข้ามไป)
                double? y1 = TryElevation(surfaceId, alignmentId, station, ToAbs(u1));
                double? y2 = TryElevation(surfaceId, alignmentId, station, ToAbs(u2));
                if (y1.HasValue) pts.Add((u1, y1.Value - originElevation));
                if (y2.HasValue) pts.Add((u2, y2.Value - originElevation));

                var begin = new PointInMem { Station = station, Offset = ToAbs(u1), Elevation = y1 ?? originElevation };
                var end = new PointInMem { Station = station, Offset = ToAbs(u2), Elevation = y2 ?? originElevation };

                SampledSectionLinkCollection sampled = state.SampleSection(surfaceId, alignmentId, begin, end);
                foreach (SampledSectionLink link in sampled)
                {
                    pts.Add((ToU(link.StartPointOffset), link.StartPointElevation - originElevation));
                    pts.Add((ToU(link.EndPointOffset), link.EndPointElevation - originElevation));
                }

                pts.RemoveAll(p => p.U < u1 - Tolerance || p.U > u2 + Tolerance);
                pts.Sort((a, b) => a.U.CompareTo(b.U));

                var unique = new List<(double U, double Y)>();
                foreach (var p in pts)
                {
                    if (unique.Count == 0 || p.U - unique[unique.Count - 1].U > 1e-5)
                        unique.Add(p);
                }

                if (unique.Count < 2 || unique[0].U > 0)
                    throw new InvalidOperationException("surface ไม่ครอบคลุมด้านหลังของลาด");

                return new GroundProfile(unique);
            }

            private static double? TryElevation(ObjectId surfaceId, ObjectId alignmentId, double station, double offset)
            {
                try
                {
                    AcDb.TransactionManager tm = AcDb.HostApplicationServices.WorkingDatabase.TransactionManager;
                    var surface = (Surface)tm.GetObject(surfaceId, AcDb.OpenMode.ForRead, false, false);
                    var alignment = (Alignment)tm.GetObject(alignmentId, AcDb.OpenMode.ForRead, false, false);

                    double x = 0.0, y = 0.0;
                    alignment.PointLocation(station, offset, ref x, ref y);
                    return surface.FindElevationAtXY(x, y);
                }
                catch
                {
                    return null;
                }
            }
        }

        // ------------------------------------------------------------------
        // Helpers

        private static Point AddPoint(PointCollection points, double flip, double u, double y, string code)
        {
            Point point = points.Add(flip * u, y, "");
            if (!string.IsNullOrEmpty(code))
                point.Codes.TryAdd(code);
            return point;
        }

        private static Link AddLink(LinkCollection links, Point from, Point to, params string[] codes)
        {
            Link link = links.Add(new[] { from, to }, "");
            foreach (string code in codes)
            {
                if (!string.IsNullOrEmpty(code))
                    link.Codes.TryAdd(code);
            }
            return link;
        }

        private static long GetLong(ParamLongCollection paramsLong, string name, long defaultValue)
        {
            try { return paramsLong.Value(name); }
            catch { return defaultValue; }
        }

        private static double GetDouble(ParamDoubleCollection paramsDouble, string name, double defaultValue)
        {
            try { return paramsDouble.Value(name); }
            catch { return defaultValue; }
        }

        private static void RecordError(CorridorState corridorState, CorridorError error, string message)
        {
            corridorState.RecordError(error, CorridorErrorLevel.Severe, message, nameof(SlopeProtection), true);
        }

        private static void RecordWarning(CorridorState corridorState, CorridorError error, string message)
        {
            corridorState.RecordError(error, CorridorErrorLevel.AsWarning, message, nameof(SlopeProtection), true);
        }

        private static void RecordError(CorridorState corridorState, Exception e)
        {
            if (corridorState == null)
                return;
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, e.Source, true);
        }
    }
}
