using System;
using System.Collections.Generic;
using System.Linq;

namespace SA.Core
{
    // Surface แบบเส้นหัก (offset, elevation) สำหรับเว็บและ unit test
    // จุดรับเข้ามาเป็นพิกัดที่เห็นบนจอ: X = offset จาก origin (ขวา = บวก), Y = ระดับเทียบกับ origin
    // ภายในแปลงเป็นแกน U ของ subassembly ด้วย u = flip * x
    public class PolylineGround : IGround
    {
        private const double Eps = 1e-9;
        private readonly List<(double U, double Y)> _pts;

        public PolylineGround(IEnumerable<(double X, double Y)> points, double flip)
        {
            _pts = points.Select(p => (U: flip * p.X, p.Y))
                         .OrderBy(p => p.U)
                         .ToList();
            if (_pts.Count < 2)
                throw new ArgumentException("surface ต้องมีอย่างน้อย 2 จุด");
        }

        public double MinU => _pts[0].U;
        public double MaxU => _pts[_pts.Count - 1].U;

        public double ElevationAt(double u)
        {
            if (u < MinU - 1e-6 || u > MaxU + 1e-6)
                throw new InvalidOperationException($"ตำแหน่ง u = {u:0.###} อยู่นอกขอบเขต surface");

            for (int i = 0; i < _pts.Count - 1; i++)
            {
                var a = _pts[i];
                var b = _pts[i + 1];
                if (u <= b.U + 1e-6)
                {
                    double du = b.U - a.U;
                    if (Math.Abs(du) < Eps) return b.Y;
                    double t = Math.Max(0.0, Math.Min(1.0, (u - a.U) / du));
                    return a.Y + t * (b.Y - a.Y);
                }
            }
            return _pts[_pts.Count - 1].Y;
        }

        public Vertex IntersectFrom(Vertex from, double dir, double slope, string pointCode)
        {
            // เส้น: y(u) = from.Y + slope * dir * (u - from.U)  โดยเดินเฉพาะทาง dir
            // f(u) = ground(u) - line(u); หาจุดแรกที่ f เปลี่ยนเครื่องหมาย
            double Line(double u) => from.Y + slope * dir * (u - from.U);

            double f0 = ElevationAt(from.U) - Line(from.U);
            if (Math.Abs(f0) < 1e-9)
                return new Vertex(from.U, from.Y, pointCode);

            // ลำดับจุดตามทิศที่เดิน เริ่มจาก from.U
            var stops = new List<double> { from.U };
            if (dir > 0)
                stops.AddRange(_pts.Where(p => p.U > from.U + 1e-9).Select(p => p.U));
            else
                stops.AddRange(_pts.Where(p => p.U < from.U - 1e-9).Select(p => p.U).Reverse());

            double fs = f0;
            for (int i = 0; i < stops.Count - 1; i++)
            {
                double s = stops[i], e = stops[i + 1];
                double fe = ElevationAt(e) - Line(e);
                if (fe * f0 <= 0)
                {
                    double t = fs / (fs - fe);
                    double u = s + t * (e - s);
                    return new Vertex(u, Line(u), pointCode);
                }
                fs = fe;
            }

            throw new InvalidOperationException("เส้น slope ไม่ชน surface ภายในขอบเขตของเส้น surface");
        }

        public List<(double U, double Y)> Profile(double u1, double u2)
        {
            var result = new List<(double U, double Y)> { (u1, ElevationAt(u1)) };
            result.AddRange(_pts.Where(p => p.U > u1 + 1e-4 && p.U < u2 - 1e-4));
            result.Add((u2, ElevationAt(u2)));
            return result;
        }
    }
}
