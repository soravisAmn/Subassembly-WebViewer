// โลกจำลองที่เว็บกำหนด: เส้น surface, ตำแหน่ง origin, mode
// ตัวจำลอง API (Autodesk.*) อ่านค่าจากที่นี่
//
// ระบบพิกัดจำลอง:
//   alignment เป็นเส้นตรงวิ่งตามแกน +Y  ->  X (โลก) = offset, Y (โลก) = station
//   surface ในเว็บกำหนดเป็น (offset, elevation) เทียบกับ origin ของ subassembly

using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.AutoCAD.DatabaseServices;

namespace SA.Shim
{
    public class SimWorld
    {
        // จุด surface เทียบกับ origin (X = offset, Y = elevation) เรียงตาม X
        public List<(double X, double Y)> Surface { get; set; } = new List<(double X, double Y)>();

        // ต่อปลายเส้น surface ออกไปแนวราบไม่จำกัด (จำลอง surface ที่กว้างกว่าที่วาด)
        // false = ถามระดับนอกช่วงจุดแล้วโยน PointNotOnEntityException แบบ surface ที่มีขอบเขต
        public bool ExtendEnds { get; set; } = true;

        // กำหนด Target Surface ให้ subassembly หรือไม่
        public bool SurfaceAssigned { get; set; } = true;

        public bool LayoutMode { get; set; }

        public double Station { get; set; } = 0.0;
        public double OriginOffset { get; set; } = 0.0;
        public double OriginElevation { get; set; } = 100.0;

        public static readonly ObjectId SurfaceId = new ObjectId(1, "EG (web surface)");
        public static readonly ObjectId AlignmentId = new ObjectId(2, "Alignment (straight, +Y)");
        public static readonly ObjectId ProfileId = new ObjectId(3, "Profile");

        // ---- surface ในพิกัด absolute (offset จาก alignment, elevation จริง) ----

        internal List<(double O, double E)> SurfaceAbs()
        {
            return Surface.Select(p => (O: OriginOffset + p.X, E: OriginElevation + p.Y))
                          .OrderBy(p => p.O).ToList();
        }

        internal double ElevationAtOffset(double absOffset)
        {
            var s = SurfaceAbs();
            if (s.Count >= 2 && ExtendEnds)
                absOffset = Math.Max(s[0].O, Math.Min(s[s.Count - 1].O, absOffset));
            if (s.Count < 2 || absOffset < s[0].O - 1e-9 || absOffset > s[s.Count - 1].O + 1e-9)
                throw new Autodesk.Civil.PointNotOnEntityException(
                    $"offset {absOffset - OriginOffset:0.###} (เทียบ origin) อยู่นอกขอบเขตของ surface");
            for (int i = 0; i < s.Count - 1; i++)
            {
                if (absOffset <= s[i + 1].O + 1e-9)
                {
                    double d = s[i + 1].O - s[i].O;
                    if (Math.Abs(d) < 1e-12) return s[i + 1].E;
                    double t = Math.Max(0, Math.Min(1, (absOffset - s[i].O) / d));
                    return s[i].E + t * (s[i + 1].E - s[i].E);
                }
            }
            return s[s.Count - 1].E;
        }

        // เส้นจาก (o0, e0) ไปทาง dir ด้วย slope (ระดับเปลี่ยน / ระยะราบที่เดิน) -> จุดแรกที่ชน surface
        internal (double O, double E)? Intersect(double o0, double e0, double dir, double slope)
        {
            var s = SurfaceAbs();
            double Line(double o) => e0 + slope * dir * (o - o0);

            double f0 = ElevationAtOffset(o0) - Line(o0);
            if (Math.Abs(f0) < 1e-9) return (o0, e0);

            var stops = new List<double> { o0 };
            if (dir > 0) stops.AddRange(s.Where(p => p.O > o0 + 1e-9).Select(p => p.O));
            else stops.AddRange(s.Where(p => p.O < o0 - 1e-9).Select(p => p.O).Reverse());
            if (ExtendEnds) stops.Add(o0 + dir * 1e4);   // ช่วงที่ต่อออกไปแนวราบ

            double fs = f0;
            for (int i = 0; i < stops.Count - 1; i++)
            {
                double a = stops[i], b = stops[i + 1];
                double fe = ElevationAtOffset(b) - Line(b);
                if (fe * f0 <= 0)
                {
                    double t = fs / (fs - fe);
                    double o = a + t * (b - a);
                    return (o, Line(o));
                }
                fs = fe;
            }
            return null;
        }
    }

    // สิ่งที่โค้ด subassembly บันทึกผ่าน CorridorState.RecordError
    public class SimIssue
    {
        public string Error { get; set; }
        public string Level { get; set; }
        public string Message { get; set; }
        public string Source { get; set; }
    }

    // ตัวกลางให้เว็บควบคุมโลกจำลอง
    public static class SimHost
    {
        private static readonly System.Threading.AsyncLocal<Autodesk.Civil.Runtime.CorridorState> _current =
            new System.Threading.AsyncLocal<Autodesk.Civil.Runtime.CorridorState>();

        public static Autodesk.Civil.Runtime.CorridorState Current
        {
            get
            {
                if (_current.Value == null)
                    throw new InvalidOperationException("ตัวจำลอง: ยังไม่มี CorridorState (เรียกนอกช่วงที่เว็บรัน subassembly)");
                return _current.Value;
            }
            set => _current.Value = value;
        }

        public static SimWorld World => Current.World;
    }
}
