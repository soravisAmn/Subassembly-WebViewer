// Subassembly ตัวลาดของ Rock Pitching Revetment (RockPitchingBody) สำหรับ Civil 3D 2027 (.NET)
//
// รูปตัด (Side = Right, ลาดลงไปทางขวา):
//
//   P0 (origin)
//    o___
//    |   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾o F         <- ผิวชั้นหิน ลาด 1:FaceSlope (ดิ่ง:ราบ), สูง Height
//    |  ชั้นหิน (หนา RockThickness ตั้งฉาก)    /
//  B0 o-------------------------------------o R           <- ใต้ชั้นหิน
//    |  Compacted Soil                     /
//    |  (หนาอย่างน้อย MinSoilThickness       /  เส้นปิดปลาย 1:EndSlope จาก F ลงไปทางด้านใน
//    |   ตั้งฉากกับลาด)                     /
//  L0 o____                              /
//          ‾‾‾‾\__ surface __          /
//                            \____  o E                   <- ชนขอบล่าง
//
// ขอบล่างของ Compacted Soil (ไล่ตามระยะ u จาก 0 ถึง E):
//   lower(u) = min( ผิวดิน, เส้นที่ห่างจากใต้ชั้นหินตั้งฉาก MinSoilThickness )
//   - ช่วงที่ผิวดินลึกกว่าเส้นนี้ -> ถมลงไปถึงผิวดิน
//   - ช่วงที่ผิวดินอยู่ใกล้กว่า (หรืออยู่เหนือชั้นหิน) -> ใช้เส้นนี้ (หนาอย่างน้อย MinSoilThickness)
// เส้นปิดปลายลากจาก F ด้วย slope 1:EndSlope ลงไปจนชนขอบล่าง (E)
// Layout mode / ไม่มี surface -> ขอบล่างเป็นเส้นที่หนา MinSoilThickness ตลอด

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
    public class RockPitchingBody
    {
        // ชื่อ parameter
        private const string SideParam = "Side";
        private const string HeightParam = "Height";
        private const string FaceSlopeParam = "FaceSlope";
        private const string RockThicknessParam = "RockThickness";
        private const string MinSoilThicknessParam = "MinSoilThickness";
        private const string EndSlopeParam = "EndSlope";
        private const string SurfaceTarget = "TargetSurface";

        private const int Right = 0;
        private const int Left = 1;

        // ค่า default (slope เป็นระยะราบต่อ 1 หน่วยดิ่ง: 1:2.5 -> 2.5)
        private const int SideDefault = Right;
        private const double HeightDefault = 5.0;
        private const double FaceSlopeDefault = 2.5;
        private const double RockThicknessDefault = 0.5;
        private const double MinSoilThicknessDefault = 1.0;
        private const double EndSlopeDefault = 1.5;

        // ความหนาขั้นต่ำของ Compacted Soil ตั้งฉากกับลาด (เมตร)
        private const double MinSoilThicknessLimit = 1.0;

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
                corridorState.ParamsDouble.Add(FaceSlopeParam, FaceSlopeDefault);
                corridorState.ParamsDouble.Add(RockThicknessParam, RockThicknessDefault);
                corridorState.ParamsDouble.Add(MinSoilThicknessParam, MinSoilThicknessDefault);
                corridorState.ParamsDouble.Add(EndSlopeParam, EndSlopeDefault);
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
            double faceSlope = GetDouble(paramsDouble, FaceSlopeParam, FaceSlopeDefault);
            double rockThickness = GetDouble(paramsDouble, RockThicknessParam, RockThicknessDefault);
            double soilThickness = GetDouble(paramsDouble, MinSoilThicknessParam, MinSoilThicknessDefault);
            double endSlope = GetDouble(paramsDouble, EndSlopeParam, EndSlopeDefault);

            if (height <= 0)
            {
                RecordError(corridorState, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, HeightParam);
                height = HeightDefault;
            }
            if (faceSlope <= 0)
            {
                RecordError(corridorState, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, FaceSlopeParam);
                faceSlope = FaceSlopeDefault;
            }
            if (rockThickness <= 0)
            {
                RecordError(corridorState, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, RockThicknessParam);
                rockThickness = RockThicknessDefault;
            }
            if (soilThickness < MinSoilThicknessLimit)
            {
                RecordWarning(corridorState, CorridorError.ValueTooSmall,
                    $"{MinSoilThicknessParam} = {soilThickness} < {MinSoilThicknessLimit} m, ใช้ {MinSoilThicknessLimit} m แทน");
                soilThickness = MinSoilThicknessLimit;
            }
            if (endSlope <= 0)
            {
                RecordError(corridorState, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, EndSlopeParam);
                endSlope = EndSlopeDefault;
            }

            double flip = side == Left ? -1.0 : 1.0;

            var geo = new BodyGeometry(height, faceSlope, rockThickness, soilThickness, endSlope);

            // เส้นปิดปลายต้องชนเส้นความหนาขั้นต่ำทางขวาของ origin
            (double U, double Y) o = geo.EndCrossing(geo.SoilDepth);
            if (o.U <= Tolerance)
            {
                RecordError(corridorState, CorridorError.ValueTooSmall,
                    $"RockPitchingBody: {HeightParam} = {height} m น้อยเกินไปสำหรับความหนาชั้นหิน + Compacted Soil");
                return;
            }

            // ------------------------------------------------------------------
            // ขอบล่างของ Compacted Soil เรียงจาก u = 0 ไปหา E
            List<(double U, double Y, bool OnSurface)> bottom = null;

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
                        var ground = new GroundSampler(corridorState, surfaceId, flip);
                        bottom = BuildBottom(ground, geo, o);
                    }
                    catch (Exception e)
                    {
                        RecordWarning(corridorState, CorridorError.Failure,
                            "RockPitchingBody: คำนวณกับ surface ไม่สำเร็จ, ใช้ความหนาขั้นต่ำแทน - " + e.Message);
                        bottom = null;
                    }
                }
            }

            if (bottom == null)
            {
                bottom = new List<(double U, double Y, bool OnSurface)>
                {
                    (0.0, geo.SoilLineY(0.0), false),
                    (o.U, o.Y, false)
                };
            }

            // ------------------------------------------------------------------
            // ชั้นหิน: P0 -> F -> R -> B0 -> P0
            PointCollection points = corridorState.Points;
            LinkCollection links = corridorState.Links;
            ShapeCollection shapes = corridorState.Shapes;

            (double U, double Y) r = geo.EndCrossing(geo.RockDepth);

            Point p0 = AddPoint(points, flip, 0.0, 0.0, "RockTopInside");
            Point f = AddPoint(points, flip, geo.FaceEndU, -height, "RockTopOutside");
            Point pr = AddPoint(points, flip, r.U, r.Y, "RockBaseOutside");
            Point b0 = AddPoint(points, flip, 0.0, geo.RockLineY(0.0), "RockBaseInside");

            Link rockFace = AddLink(links, p0, f, "Top", "RockFace");
            Link rockEnd = AddLink(links, f, pr, "Top", "RockEnd");
            Link rockBase = AddLink(links, pr, b0, "RockBase");
            Link rockBack = AddLink(links, b0, p0, "RockBack");

            Shape rock = shapes.Add(new[] { rockFace, rockEnd, rockBase, rockBack }, "");
            rock.Codes.TryAdd("RockPitching");

            // ------------------------------------------------------------------
            // Compacted Soil: B0 -> R -> E -> ขอบล่างย้อนกลับ -> L0 -> B0
            var soilLinks = new List<Link> { rockBase };

            var toe = bottom[bottom.Count - 1];
            Point pe = AddPoint(points, flip, toe.U, toe.Y, "SoilToe");
            soilLinks.Add(AddLink(links, pr, pe, "Top", "Datum", "SoilEnd"));

            Point prev = pe;
            for (int i = bottom.Count - 2; i >= 0; i--)
            {
                string code = i == 0 ? "SoilBaseInside" : "";
                Point next = AddPoint(points, flip, bottom[i].U, bottom[i].Y, code);
                string linkCode = bottom[i].OnSurface ? "SoilOnSurface" : "SoilMinThickness";
                soilLinks.Add(AddLink(links, prev, next, "Datum", linkCode));
                prev = next;
            }

            soilLinks.Add(AddLink(links, prev, b0, "SoilBack"));

            Shape soil = shapes.Add(soilLinks.ToArray(), "");
            soil.Codes.TryAdd("CompactedSoil");
        }

        // ------------------------------------------------------------------
        // เรขาคณิตของตัวลาด (U = ระยะออกด้านนอก, Y = ระดับเทียบ origin)

        private class BodyGeometry
        {
            private readonly double _height;
            private readonly double _faceSlope;
            private readonly double _endSlope;
            private readonly double _kv; // ระยะดิ่งต่อ 1 หน่วยความหนาตั้งฉากกับลาด

            public BodyGeometry(double height, double faceSlope, double rockThickness, double soilThickness, double endSlope)
            {
                _height = height;
                _faceSlope = faceSlope;
                _endSlope = endSlope;
                _kv = Math.Sqrt(1.0 + faceSlope * faceSlope) / faceSlope;
                RockDepth = rockThickness;
                SoilDepth = rockThickness + soilThickness;
            }

            // ความหนาตั้งฉากจากผิวหินถึงใต้ชั้นหิน / ถึงเส้นความหนาขั้นต่ำของ soil
            public double RockDepth { get; }
            public double SoilDepth { get; }

            public double FaceEndU => _faceSlope * _height;

            // เส้นขนานกับผิวหิน ลึกลงไปตั้งฉาก depth
            public double ParallelY(double u, double depth) => -u / _faceSlope - depth * _kv;

            public double RockLineY(double u) => ParallelY(u, RockDepth);
            public double SoilLineY(double u) => ParallelY(u, SoilDepth);

            // grade ของเส้นปิดปลายเมื่อลากจาก F เข้าด้านใน (ลง)
            public double EndGrade => -1.0 / _endSlope;

            // จุดที่เส้นปิดปลาย (จาก F ลงไปด้านใน) ตัดเส้นขนานที่ลึก depth
            public (double U, double Y) EndCrossing(double depth)
            {
                // เส้นปิดปลาย: y = -H + (u - sH) / e
                double u = (_height * (1.0 + _faceSlope / _endSlope) - depth * _kv)
                           / (1.0 / _faceSlope + 1.0 / _endSlope);
                return (u, ParallelY(u, depth));
            }
        }

        // ------------------------------------------------------------------
        // ขอบล่างตาม surface: min(ผิวดิน, เส้นความหนาขั้นต่ำ) จาก u = 0 ถึง E

        private static List<(double U, double Y, bool OnSurface)> BuildBottom(GroundSampler ground, BodyGeometry geo, (double U, double Y) o)
        {
            // E: ถ้าผิวดินที่ O อยู่สูงกว่าเส้นความหนาขั้นต่ำ ใช้ O, ไม่เช่นนั้นลากเส้นปิดปลายต่อลงไปชนผิวดิน
            (double U, double Y) e = o;
            if (ground.ElevationAt(o.U) < o.Y - Tolerance)
            {
                e = ground.IntersectFrom(o.U, o.Y, -1.0, geo.EndGrade);
                if (e.U <= Tolerance)
                    throw new InvalidOperationException("เส้นปิดปลายชนผิวดินเลย origin เข้าไปด้านใน");
            }

            List<(double U, double Y)> profile = ground.Profile(0.0, e.U);

            // จุดบนขอบล่าง + จุดที่ผิวดินตัดเส้นความหนาขั้นต่ำ
            var raw = new List<(double U, double Y, bool OnSurface)>();
            for (int i = 0; i < profile.Count; i++)
            {
                var b = profile[i];
                if (i > 0)
                {
                    var a = profile[i - 1];
                    double fa = a.Y - geo.SoilLineY(a.U);
                    double fb = b.Y - geo.SoilLineY(b.U);
                    if (fa * fb < 0)
                    {
                        double t = fa / (fa - fb);
                        double u = a.U + t * (b.U - a.U);
                        raw.Add((u, geo.SoilLineY(u), false));
                    }
                }
                double line = geo.SoilLineY(b.U);
                raw.Add(b.Y < line ? (b.U, b.Y, true) : (b.U, line, false));
            }

            // ปลายขวาคือ E พอดี
            raw[raw.Count - 1] = (e.U, e.Y, raw[raw.Count - 1].OnSurface);

            // OnSurface ของจุด i = ช่วง i -> i+1 อยู่บนผิวดิน (ถ้าปลายทั้งสองไม่ได้อยู่บนเส้นความหนาขั้นต่ำ)
            var segments = new List<(double U, double Y, bool OnSurface)>();
            for (int i = 0; i < raw.Count; i++)
            {
                bool onSurface = i < raw.Count - 1
                    && !(IsOnLine(raw[i], geo) && IsOnLine(raw[i + 1], geo));
                segments.Add((raw[i].U, raw[i].Y, onSurface));
            }

            // ตัดจุดซ้ำ และจุดกลางที่อยู่บนเส้นตรงเดียวกันและเป็นประเภทเดียวกัน
            var result = new List<(double U, double Y, bool OnSurface)>();
            foreach (var p in segments)
            {
                if (result.Count > 0 && Math.Abs(p.U - result[result.Count - 1].U) < 1e-4)
                {
                    result[result.Count - 1] = (p.U, p.Y, p.OnSurface);
                    continue;
                }
                if (result.Count >= 2)
                {
                    var a = result[result.Count - 2];
                    var b = result[result.Count - 1];
                    double cross = (b.U - a.U) * (p.Y - a.Y) - (b.Y - a.Y) * (p.U - a.U);
                    if (Math.Abs(cross) < 1e-6 && a.OnSurface == b.OnSurface)
                    {
                        result[result.Count - 1] = p;
                        continue;
                    }
                }
                result.Add(p);
            }

            if (result.Count < 2)
                throw new InvalidOperationException("ขอบล่างของ Compacted Soil สั้นเกินไป");

            return result;
        }

        private static bool IsOnLine((double U, double Y, bool OnSurface) p, BodyGeometry geo)
            => Math.Abs(p.Y - geo.SoilLineY(p.U)) < 1e-4;

        // ------------------------------------------------------------------
        // อ่านค่าจาก surface ในพิกัดของ subassembly

        private class GroundSampler
        {
            private readonly CorridorState _state;
            private readonly ObjectId _surfaceId;
            private readonly ObjectId _alignmentId;
            private readonly double _station;
            private readonly double _originOffset;
            private readonly double _originElevation;
            private readonly double _flip;

            public GroundSampler(CorridorState state, ObjectId surfaceId, double flip)
            {
                _state = state;
                _surfaceId = surfaceId;
                _flip = flip;
                _station = state.CurrentStation;

                // เหมือน Utilities.GetAlignmentAndOrigin ใน stock sample
                if (state.CurrentAlignmentIsOffsetAlignment && state.CurrentAssemblyOffsetIsFixed)
                {
                    _alignmentId = state.CurrentBaselineId;
                    _originOffset = state.CurrentOffset + state.CurrentAssemblyFixedOffset;
                    _originElevation = state.CurrentElevation + state.CurrentAssemblyFixedElevation;
                }
                else
                {
                    _alignmentId = state.CurrentAlignmentId;
                    _originOffset = state.CurrentOffset;
                    _originElevation = state.CurrentElevation;
                }
            }

            private double ToAbsOffset(double u) => _originOffset + _flip * u;
            private double ToU(double absOffset) => _flip * (absOffset - _originOffset);

            private PointInMem ToPointInMem(double u, double y)
            {
                return new PointInMem
                {
                    Station = _station,
                    Offset = ToAbsOffset(u),
                    Elevation = _originElevation + y
                };
            }

            // ระดับ surface (เทียบกับ origin) ที่ระยะ u
            public double ElevationAt(double u)
            {
                AcDb.Database db = AcDb.HostApplicationServices.WorkingDatabase;
                AcDb.TransactionManager tm = db.TransactionManager;

                var surface = (Surface)tm.GetObject(_surfaceId, AcDb.OpenMode.ForRead, false, false);
                var alignment = (Alignment)tm.GetObject(_alignmentId, AcDb.OpenMode.ForRead, false, false);

                double x = 0.0, y = 0.0;
                alignment.PointLocation(_station, ToAbsOffset(u), ref x, ref y);
                return surface.FindElevationAtXY(x, y) - _originElevation;
            }

            // ลากเส้นจาก (u, y) ไปทาง dir (+1/-1 ในแกน U) ด้วย grade จนชน surface
            public (double U, double Y) IntersectFrom(double u, double y, double dir, double grade)
            {
                bool lookRight = _flip * dir > 0;
                IPoint hit = _state.IntersectSurface(_surfaceId, _alignmentId, ToPointInMem(u, y), lookRight, grade);
                return (ToU(hit.Offset), hit.Elevation - _originElevation);
            }

            // จุดบนผิว surface ระหว่าง u1 ถึง u2 เรียงตาม U (รวมปลายทั้งสอง)
            public List<(double U, double Y)> Profile(double u1, double u2)
            {
                double y1 = ElevationAt(u1);
                double y2 = ElevationAt(u2);

                var result = new List<(double U, double Y)> { (u1, y1) };

                SampledSectionLinkCollection sampled =
                    _state.SampleSection(_surfaceId, _alignmentId, ToPointInMem(u1, y1), ToPointInMem(u2, y2));

                var inner = new List<(double U, double Y)>();
                foreach (SampledSectionLink link in sampled)
                {
                    AddIfInside(inner, ToU(link.StartPointOffset), link.StartPointElevation - _originElevation, u1, u2);
                    AddIfInside(inner, ToU(link.EndPointOffset), link.EndPointElevation - _originElevation, u1, u2);
                }
                inner.Sort((a, b) => a.U.CompareTo(b.U));

                result.AddRange(inner);
                result.Add((u2, y2));
                return result;
            }

            private static void AddIfInside(List<(double U, double Y)> list, double u, double y, double u1, double u2)
            {
                if (u > u1 + 1e-4 && u < u2 - 1e-4)
                    list.Add((u, y));
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
            corridorState.RecordError(error, CorridorErrorLevel.Severe, message, nameof(RockPitchingBody), true);
        }

        private static void RecordWarning(CorridorState corridorState, CorridorError error, string message)
        {
            corridorState.RecordError(error, CorridorErrorLevel.AsWarning, message, nameof(RockPitchingBody), true);
        }

        private static void RecordError(CorridorState corridorState, Exception e)
        {
            if (corridorState == null)
                return;
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, e.Source, true);
        }
    }
}
