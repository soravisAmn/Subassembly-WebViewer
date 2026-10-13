// อ่านค่าจาก TIN surface จริงในพิกัดของ subassembly (คือ GroundSampler จาก test.cs เดิม)
// implement Core.IGround เพื่อให้ TrapezoidLogic เรียกใช้ได้แบบเดียวกับ PolylineGround ในเว็บ

using System.Collections.Generic;
using Autodesk.Civil.DatabaseServices;
using Autodesk.Civil.Runtime;
using AcDb = Autodesk.AutoCAD.DatabaseServices;
using ObjectId = Autodesk.AutoCAD.DatabaseServices.ObjectId;
using Core = SA.Core;

namespace TestSubassembly
{
    internal class Civil3DGround : Core.IGround
    {
        private readonly CorridorState _state;
        private readonly ObjectId _surfaceId;
        private readonly ObjectId _alignmentId;
        private readonly double _station;
        private readonly double _originOffset;
        private readonly double _originElevation;
        private readonly double _flip;

        public Civil3DGround(CorridorState state, ObjectId surfaceId, double flip)
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
        public Core.Vertex IntersectFrom(Core.Vertex from, double dir, double slope, string pointCode)
        {
            bool lookRight = _flip * dir > 0;
            IPoint hit = _state.IntersectSurface(_surfaceId, _alignmentId, ToPointInMem(from.U, from.Y), lookRight, slope);
            return new Core.Vertex(ToU(hit.Offset), hit.Elevation - _originElevation, pointCode);
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
}
