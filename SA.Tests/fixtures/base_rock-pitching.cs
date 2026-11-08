// Subassembly รูปสี่เหลี่ยมคางหมู (Trapezoid) สำหรับ Civil 3D 2027 (.NET)
//
// อ้างอิงโครงสร้างจาก sample ของ Autodesk:
//   C:\Program Files\Autodesk\AutoCAD 2027\C3D\Sample\Civil 3D API\C3DStockSubassemblies
//   (SATemplate.vb, Utilities.vb, Subassemblies\BasicLane.vb, BasicSideSlopeCutDitch.vb)
//
// Build: dotnet build -c Release  (ในโฟลเดอร์ TrapezoidSA)
//
// รูปตัด (Side = Right):
//
//        P1 (origin)     TopWidth       P2
//         o============================o              <- Top
//        /                              \
//       /  SideSlope 1:1.5 (V:H)         \   Depth (>= 2 m)
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
//
// ความกว้างฐานคำนวณจาก slope ด้านข้าง: SideSlope = ระยะราบต่อ 1 หน่วยดิ่ง (1:1.5 -> 1.5)
//   ระยะยื่นของฐานแต่ละข้าง = Depth x SideSlope

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
    public class Trapezoid
    {
        // ชื่อ parameter
        private const string SideParam = "Side";
        private const string TopWidthParam = "TopWidth";
        private const string SideSlopeParam = "SideSlope";
        private const string DepthParam = "Depth";
        private const string SurfaceTarget = "TargetSurface";

        // ค่า Side ตามมาตรฐาน stock subassembly
        private const int Right = 0;
        private const int Left = 1;

        // ค่า default
        private const int SideDefault = Right;
        private const double TopWidthDefault = 2.0;
        private const double SideSlopeDefault = 1.5; // 1:1.5 (ดิ่ง:ราบ)
        private const double DepthDefault = 2.0;

        // ความสูงขั้นต่ำ (เมตร)
        private const double MinDepth = 2.0;

        private const double Tolerance = 1e-6;

        // จุดในพิกัดของ subassembly: U = ระยะออกด้านนอก (ก่อน flip), Y = ระดับเทียบกับ origin
        private struct Vertex
        {
            public double U;
            public double Y;
            public string PointCode;
            public string[] LinkCodes; // code ของ link จากจุดนี้ไปจุดถัดไป

            public Vertex(double u, double y, string pointCode, params string[] linkCodes)
            {
                U = u;
                Y = y;
                PointCode = pointCode;
                LinkCodes = linkCodes;
            }
        }

        // ------------------------------------------------------------------
        // Civil 3D เรียก 4 เมธอดนี้ผ่าน .atc (ต้องเป็น public, ไม่มีพารามิเตอร์)

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
                corridorState.ParamsDouble.Add(TopWidthParam, TopWidthDefault);
                corridorState.ParamsDouble.Add(SideSlopeParam, SideSlopeDefault);
                corridorState.ParamsDouble.Add(DepthParam, DepthDefault);
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

            // อ่านค่า parameter
            int side = (int)GetLong(paramsLong, SideParam, SideDefault);
            double topWidth = GetDouble(paramsDouble, TopWidthParam, TopWidthDefault);
            double sideSlope = GetDouble(paramsDouble, SideSlopeParam, SideSlopeDefault);
            double depth = GetDouble(paramsDouble, DepthParam, DepthDefault);

            // ตรวจค่าที่ผู้ใช้ใส่
            if (topWidth <= 0)
            {
                RecordError(corridorState, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, TopWidthParam);
                topWidth = TopWidthDefault;
            }
            if (sideSlope <= 0)
            {
                RecordError(corridorState, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, SideSlopeParam);
                sideSlope = SideSlopeDefault;
            }
            if (depth < MinDepth)
            {
                RecordWarning(corridorState, CorridorError.ValueTooSmall,
                    $"{DepthParam} = {depth} < {MinDepth} m, ใช้ {MinDepth} m แทน");
                depth = MinDepth;
            }

            // กลับด้านเมื่อวางฝั่งซ้าย
            double flip = side == Left ? -1.0 : 1.0;

            // ระยะยื่นของฐานแต่ละข้าง ตาม slope ด้านข้าง (ฐานกว้างกว่าด้านบนเสมอ)
            double halfDiff = depth * sideSlope;
            double baseY = -depth;

            var p1 = new Vertex(0.0, 0.0, "TrapTopInside", "Top");
            var p2 = new Vertex(topWidth, 0.0, "TrapTopOutside", "TrapSide");
            var p3 = new Vertex(topWidth + halfDiff, baseY, "TrapBaseOutside");
            var p4 = new Vertex(-halfDiff, baseY, "TrapBaseInside", "TrapSide");

            // เส้นขอบจาก P3 วนไปถึง P4 (ด้านข้างที่ต่อลงไป + ขอบล่าง)
            List<Vertex> lowerChain = null;

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
                        lowerChain = BuildLowerChain(ground, p3, p4, sideSlope, baseY);
                    }
                    catch (Exception e)
                    {
                        RecordWarning(corridorState, CorridorError.Failure, "Trapezoid: คำนวณกับ surface ไม่สำเร็จ - " + e.Message);
                        lowerChain = null;
                    }
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

            AddShape(corridorState, outline, flip);
        }

        // ------------------------------------------------------------------
        // คำนวณเส้นขอบจาก P3 ถึง P4 ตาม surface

        private static List<Vertex> BuildLowerChain(GroundSampler ground, Vertex p3, Vertex p4,
                                                    double sideSlope, double baseY)
        {
            // slope ของด้านข้าง (ลงต่อ 1 หน่วยแนวราบ) ใช้ค่าเดิมตอนต่อลงไปชน surface
            double grade = -1.0 / sideSlope;

            // ทิศที่ด้านข้างวิ่งออกไป (ในแกน U): ด้านนอกไป +U ด้านในไป -U
            const double outsideDir = 1.0;
            const double insideDir = -1.0;

            // ปลายด้านนอก (R) และด้านใน (L) ของขอบล่าง
            bool extendOutside = ground.ElevationAt(p3.U) < baseY - Tolerance;
            bool extendInside = ground.ElevationAt(p4.U) < baseY - Tolerance;

            Vertex r = extendOutside ? ground.IntersectFrom(p3, outsideDir, grade, "TrapToeOutside") : p3;
            Vertex l = extendInside ? ground.IntersectFrom(p4, insideDir, grade, "TrapToeInside") : p4;

            if (l.U >= r.U - Tolerance)
                throw new InvalidOperationException("ด้านข้างที่ต่อลงไปตัดกันก่อนถึง surface");

            // ขอบล่าง = min(ระดับฐาน, surface) จาก L ไป R
            List<Vertex> bottom = BuildBottom(ground, l, r, baseY);

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
        private static List<Vertex> BuildBottom(GroundSampler ground, Vertex l, Vertex r, double baseY)
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
        // สร้าง points / links / shape จากเส้นรอบรูป (ปิดกลับไปจุดแรกเอง)

        private static void AddShape(CorridorState corridorState, List<Vertex> outline, double flip)
        {
            PointCollection points = corridorState.Points;
            LinkCollection links = corridorState.Links;
            ShapeCollection shapes = corridorState.Shapes;

            var corridorPoints = new Point[outline.Count];
            for (int i = 0; i < outline.Count; i++)
            {
                corridorPoints[i] = points.Add(flip * outline[i].U, outline[i].Y, "");
                if (!string.IsNullOrEmpty(outline[i].PointCode))
                    corridorPoints[i].Codes.TryAdd(outline[i].PointCode);
            }

            var corridorLinks = new Link[outline.Count];
            for (int i = 0; i < outline.Count; i++)
            {
                int next = (i + 1) % outline.Count;
                corridorLinks[i] = links.Add(new[] { corridorPoints[i], corridorPoints[next] }, "");
                if (outline[i].LinkCodes != null)
                {
                    foreach (string code in outline[i].LinkCodes)
                        corridorLinks[i].Codes.TryAdd(code);
                }
            }

            Shape shape = shapes.Add(corridorLinks, "");
            shape.Codes.TryAdd("Trapezoid");
        }

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

            // ลากเส้นจากจุด from ไปทาง dir (+1/-1 ในแกน U) ด้วย slope จนชน surface
            public Vertex IntersectFrom(Vertex from, double dir, double slope, string pointCode)
            {
                bool lookRight = _flip * dir > 0;
                IPoint hit = _state.IntersectSurface(_surfaceId, _alignmentId, ToPointInMem(from.U, from.Y), lookRight, slope);
                return new Vertex(ToU(hit.Offset), hit.Elevation - _originElevation, pointCode);
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
            corridorState.RecordError(error, CorridorErrorLevel.Severe, message, nameof(Trapezoid), true);
        }

        private static void RecordWarning(CorridorState corridorState, CorridorError error, string message)
        {
            corridorState.RecordError(error, CorridorErrorLevel.AsWarning, message, nameof(Trapezoid), true);
        }

        private static void RecordError(CorridorState corridorState, Exception e)
        {
            if (corridorState == null)
                return;
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, e.Source, true);
        }
    }
}
