// pavement-assembly.cs — subassembly ที่สร้างจาก SA Drawing Studio
//
// รูปตัดวาดในเว็บ: โค้ดในช่วง SA-DRAWING สร้างจากการวาด (เปิดไฟล์นี้ในเว็บแล้ววาดต่อได้ อย่าแก้ช่วงนั้นด้วยมือ)
// โค้ดนอกช่วงนั้นแก้เองได้ เว็บจะไม่แตะ
//
// Parameter:
//   Side (long, default 0)

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
    public class PavementAssembly
    {
        // ------------------------------------------------------------------
        // Civil 3D เรียก 4 เมธอดนี้ผ่าน .atc (ต้องเป็น public, ไม่มีพารามิเตอร์)

        public void GetLogicalNames()
        {
            CorridorState corridorState = null;
            try
            {
                corridorState = CivilApplication.ActiveDocument.CorridorState;
                SaDrawing_PavementAssembly.AddTargets(corridorState); // SA-DRAWING TARGET
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
                SaDrawing_PavementAssembly.AddParams(corridorState); // SA-DRAWING PARAM
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
                SaDrawing_PavementAssembly.Draw(corridorState); // SA-DRAWING CALL
            }
            catch (Exception e)
            {
                RecordError(corridorState, e);
            }
        }

        // ------------------------------------------------------------------

        private static void RecordError(CorridorState corridorState, Exception e)
        {
            if (corridorState == null)
                return;
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, nameof(PavementAssembly), true);
        }
    }

    // ===== SA-DRAWING BEGIN (สร้างโดย SA Drawing Studio — แก้ด้วยการวาดในเว็บ อย่าแก้ช่วงนี้ด้วยมือ) =====
    // sa-spec: {"version":1,"className":"PavementAssembly","namespace":"TestSubassembly","params":[{"name":"Side","kind":"long","default":0,"displayName":"Side","min":null,"max":null}],"targets":[{"name":"TargetSurface","type":"Surface","displayName":"Target Surface"}],"points":[{"id":"P1","codes":[],"def":{"type":"origin"}},{"id":"P2","codes":[],"def":{"type":"delta","dx":"0","dy":"0"}},{"id":"P3","codes":[],"def":{"type":"delta","from":"P2","dx":"-0.25","dy":"0"}},{"id":"P4","codes":[],"def":{"type":"delta","dx":"0","dy":"-0.5","from":"P3"}},{"id":"P5","codes":[],"def":{"type":"delta","from":"P4","dx":"0.25","dy":"0"}},{"id":"P6","codes":[],"def":{"type":"delta","from":"P3","dx":"-0.3","dy":"0"}},{"id":"P7","codes":[],"def":{"type":"delta","from":"P6","dx":"0","dy":"-0.1"}},{"id":"P8","codes":[],"def":{"type":"between","a":"P3","b":"P4","t":"0.2"}},{"id":"P9","codes":[],"def":{"type":"delta","from":"P6","dx":"-0.3","dy":"0"}},{"id":"P10","codes":[],"def":{"type":"delta","from":"P9","dx":"0","dy":"-0.1"}},{"id":"P11","codes":[],"def":{"type":"delta","from":"P9","dx":"-0.3","dy":"0"}},{"id":"P12","codes":[],"def":{"type":"delta","from":"P11","dx":"0","dy":"-0.1"}},{"id":"P13","codes":[],"def":{"type":"delta","from":"P11","dx":"-0.3","dy":"0"}},{"id":"P14","codes":[],"def":{"type":"delta","from":"P13","dx":"0","dy":"-0.1"}},{"id":"P15","codes":[],"def":{"type":"delta","from":"P13","dx":"-0.3","dy":"0"}},{"id":"P16","codes":[],"def":{"type":"delta","from":"P15","dx":"0","dy":"-0.1"}},{"id":"P17","codes":[],"def":{"type":"delta","from":"P15","dx":"-0.3","dy":"0"}},{"id":"P18","codes":[],"def":{"type":"delta","from":"P17","dx":"0","dy":"-0.1"}},{"id":"P19","codes":[],"def":{"type":"delta","from":"P17","dx":"-0.3","dy":"0"}},{"id":"P20","codes":[],"def":{"type":"delta","from":"P19","dx":"0","dy":"-0.1"}},{"id":"P21","codes":[],"def":{"type":"delta","dx":"-2.65","dy":"0"}},{"id":"P22","codes":[],"def":{"type":"delta","dx":"-2.65","dy":"-0.1"}},{"id":"P23","codes":[],"def":{"type":"delta","dx":"-2.95","dy":"0"}},{"id":"P24","codes":[],"def":{"type":"delta","dx":"-2.95","dy":"-0.1"}},{"id":"P25","codes":[],"def":{"type":"delta","dx":"-2.65","dy":"-0.1"}}],"links":[{"id":"L1","points":["P2","P3"],"codes":[]},{"id":"L2","points":["P4","P5"],"codes":[]},{"id":"L3","points":["P5","P1"],"codes":[]},{"id":"L4","points":["P3","P4"],"codes":[]},{"id":"L5","points":["P3","P6"],"codes":[]},{"id":"L6","points":["P6","P7"],"codes":[]},{"id":"L7","points":["P7","P8"],"codes":[]},{"id":"L8","points":["P8","P3"],"codes":[]},{"id":"L9","points":["P6","P9"],"codes":[]},{"id":"L10","points":["P9","P10"],"codes":[]},{"id":"L11","points":["P10","P7"],"codes":[]},{"id":"L12","points":["P9","P11"],"codes":[]},{"id":"L13","points":["P11","P12"],"codes":[]},{"id":"L14","points":["P12","P10"],"codes":[]},{"id":"L15","points":["P11","P13"],"codes":[]},{"id":"L16","points":["P13","P14"],"codes":[]},{"id":"L17","points":["P14","P12"],"codes":[]},{"id":"L18","points":["P13","P15"],"codes":[]},{"id":"L19","points":["P15","P16"],"codes":[]},{"id":"L20","points":["P16","P14"],"codes":[]},{"id":"L21","points":["P15","P17"],"codes":[]},{"id":"L22","points":["P17","P18"],"codes":[]},{"id":"L23","points":["P18","P16"],"codes":[]},{"id":"L24","points":["P17","P19"],"codes":[]},{"id":"L25","points":["P19","P20"],"codes":[]},{"id":"L26","points":["P20","P18"],"codes":[]},{"id":"L27","points":["P19","P21"],"codes":[]},{"id":"L28","points":["P21","P22"],"codes":[]},{"id":"L29","points":["P22","P20"],"codes":[]},{"id":"L30","points":["P21","P23"],"codes":[]},{"id":"L31","points":["P23","P24"],"codes":[]},{"id":"L32","points":["P24","P25"],"codes":[]}],"shapes":[],"side":{"param":"Side","mirror":true}}
    internal static class SaDrawing_PavementAssembly
    {
        private const string Source = "PavementAssembly";
        private const double Deg = Math.PI / 180.0;

        // GetLogicalNames: target ที่ส่วนที่วาดใช้
        internal static void AddTargets(CorridorState cs)
        {
            ParamLong targetSurface = cs.ParamsLong.Add("TargetSurface", (int)ParamLogicalNameType.Surface);
            targetSurface.DisplayName = "Target Surface";
        }

        // GetInputParameters: parameter ของส่วนที่วาด
        internal static void AddParams(CorridorState cs)
        {
            cs.ParamsLong.Add("Side", 0).DisplayName = "Side";
        }

        internal static void Draw(CorridorState cs)
        {
            // ---- parameter (นอกขอบเขต = ใช้ค่าขอบแทน + เตือน) ----
            long Side = GetLong(cs, "Side", 0);
            double F = Side == 1 ? -1.0 : 1.0;   // Side = 1 (Left) -> กลับด้านแนวราบทั้งหมด

            // ---- พิกัดของจุด (เทียบ origin; null = หาจุดนี้ไม่ได้ ส่วนที่พึ่งจุดนี้จะถูกข้าม) ----
            Pt? P1 = Pt.Origin;   // P1 origin
            Pt? P2 = Delta(cs, "P2", Pt.Origin, F * 0.0, 0.0);   // P2 ห่างจาก origin
            Pt? P3 = Delta(cs, "P3", P2, F * -0.25, 0.0);   // P3 ห่างจาก P2
            Pt? P4 = Delta(cs, "P4", P3, F * 0.0, -0.5);   // P4 ห่างจาก P3
            Pt? P5 = Delta(cs, "P5", P4, F * 0.25, 0.0);   // P5 ห่างจาก P4
            Pt? P6 = Delta(cs, "P6", P3, F * -0.3, 0.0);   // P6 ห่างจาก P3
            Pt? P7 = Delta(cs, "P7", P6, F * 0.0, -0.1);   // P7 ห่างจาก P6
            Pt? P8 = Between(cs, "P8", P3, P4, 0.2);   // P8 บนเส้น P3-P4
            Pt? P9 = Delta(cs, "P9", P6, F * -0.3, 0.0);   // P9 ห่างจาก P6
            Pt? P10 = Delta(cs, "P10", P9, F * 0.0, -0.1);   // P10 ห่างจาก P9
            Pt? P11 = Delta(cs, "P11", P9, F * -0.3, 0.0);   // P11 ห่างจาก P9
            Pt? P12 = Delta(cs, "P12", P11, F * 0.0, -0.1);   // P12 ห่างจาก P11
            Pt? P13 = Delta(cs, "P13", P11, F * -0.3, 0.0);   // P13 ห่างจาก P11
            Pt? P14 = Delta(cs, "P14", P13, F * 0.0, -0.1);   // P14 ห่างจาก P13
            Pt? P15 = Delta(cs, "P15", P13, F * -0.3, 0.0);   // P15 ห่างจาก P13
            Pt? P16 = Delta(cs, "P16", P15, F * 0.0, -0.1);   // P16 ห่างจาก P15
            Pt? P17 = Delta(cs, "P17", P15, F * -0.3, 0.0);   // P17 ห่างจาก P15
            Pt? P18 = Delta(cs, "P18", P17, F * 0.0, -0.1);   // P18 ห่างจาก P17
            Pt? P19 = Delta(cs, "P19", P17, F * -0.3, 0.0);   // P19 ห่างจาก P17
            Pt? P20 = Delta(cs, "P20", P19, F * 0.0, -0.1);   // P20 ห่างจาก P19
            Pt? P21 = Delta(cs, "P21", Pt.Origin, F * -2.65, 0.0);   // P21 ห่างจาก origin
            Pt? P22 = Delta(cs, "P22", Pt.Origin, F * -2.65, -0.1);   // P22 ห่างจาก origin
            Pt? P23 = Delta(cs, "P23", Pt.Origin, F * -2.95, 0.0);   // P23 ห่างจาก origin
            Pt? P24 = Delta(cs, "P24", Pt.Origin, F * -2.95, -0.1);   // P24 ห่างจาก origin
            Pt? P25 = Delta(cs, "P25", Pt.Origin, F * -2.65, -0.1);   // P25 ห่างจาก origin

            // ---- เพิ่มจุด / link / shape ลง CorridorState ----
            Point p1 = AddPoint(cs, P1);
            Point p2 = AddPoint(cs, P2);
            Point p3 = AddPoint(cs, P3);
            Point p4 = AddPoint(cs, P4);
            Point p5 = AddPoint(cs, P5);
            Point p6 = AddPoint(cs, P6);
            Point p7 = AddPoint(cs, P7);
            Point p8 = AddPoint(cs, P8);
            Point p9 = AddPoint(cs, P9);
            Point p10 = AddPoint(cs, P10);
            Point p11 = AddPoint(cs, P11);
            Point p12 = AddPoint(cs, P12);
            Point p13 = AddPoint(cs, P13);
            Point p14 = AddPoint(cs, P14);
            Point p15 = AddPoint(cs, P15);
            Point p16 = AddPoint(cs, P16);
            Point p17 = AddPoint(cs, P17);
            Point p18 = AddPoint(cs, P18);
            Point p19 = AddPoint(cs, P19);
            Point p20 = AddPoint(cs, P20);
            Point p21 = AddPoint(cs, P21);
            Point p22 = AddPoint(cs, P22);
            Point p23 = AddPoint(cs, P23);
            Point p24 = AddPoint(cs, P24);
            Point p25 = AddPoint(cs, P25);
            Link l1 = AddLink(cs, "L1", p2, p3);
            Link l2 = AddLink(cs, "L2", p4, p5);
            Link l3 = AddLink(cs, "L3", p5, p1);
            Link l4 = AddLink(cs, "L4", p3, p4);
            Link l5 = AddLink(cs, "L5", p3, p6);
            Link l6 = AddLink(cs, "L6", p6, p7);
            Link l7 = AddLink(cs, "L7", p7, p8);
            Link l8 = AddLink(cs, "L8", p8, p3);
            Link l9 = AddLink(cs, "L9", p6, p9);
            Link l10 = AddLink(cs, "L10", p9, p10);
            Link l11 = AddLink(cs, "L11", p10, p7);
            Link l12 = AddLink(cs, "L12", p9, p11);
            Link l13 = AddLink(cs, "L13", p11, p12);
            Link l14 = AddLink(cs, "L14", p12, p10);
            Link l15 = AddLink(cs, "L15", p11, p13);
            Link l16 = AddLink(cs, "L16", p13, p14);
            Link l17 = AddLink(cs, "L17", p14, p12);
            Link l18 = AddLink(cs, "L18", p13, p15);
            Link l19 = AddLink(cs, "L19", p15, p16);
            Link l20 = AddLink(cs, "L20", p16, p14);
            Link l21 = AddLink(cs, "L21", p15, p17);
            Link l22 = AddLink(cs, "L22", p17, p18);
            Link l23 = AddLink(cs, "L23", p18, p16);
            Link l24 = AddLink(cs, "L24", p17, p19);
            Link l25 = AddLink(cs, "L25", p19, p20);
            Link l26 = AddLink(cs, "L26", p20, p18);
            Link l27 = AddLink(cs, "L27", p19, p21);
            Link l28 = AddLink(cs, "L28", p21, p22);
            Link l29 = AddLink(cs, "L29", p22, p20);
            Link l30 = AddLink(cs, "L30", p21, p23);
            Link l31 = AddLink(cs, "L31", p23, p24);
            Link l32 = AddLink(cs, "L32", p24, p25);
        }

        // ------------------------------------------------------------------
        // ตัวช่วย (พิกัดของ Pt เทียบ origin ของ subassembly; IntersectSurface / SampleSection ใช้ค่าจริง)

        private struct Pt
        {
            public readonly double X, Y;
            public Pt(double x, double y) { X = x; Y = y; }
            public static readonly Pt Origin = new Pt(0.0, 0.0);
        }

        private enum Measure { Along, Dx, Dy }

        private static Pt? Delta(CorridorState cs, string id, Pt? from, double dx, double dy)
        {
            if (from == null) return null;
            return Check(cs, id, new Pt(from.Value.X + dx, from.Value.Y + dy));
        }

        // ลาด slope (ระดับที่เปลี่ยน / ระยะราบ) ไปทาง dir ยาว length ตามแนวลาด / ระยะราบ / ระยะดิ่ง
        private static Pt? SlopeLength(CorridorState cs, string id, Pt? from, double slope, double length, double dir, Measure measure)
        {
            if (from == null) return null;
            double run;
            if (measure == Measure.Dx) run = length;
            else if (measure == Measure.Dy)
            {
                if (slope == 0.0) { Warn(cs, CorridorError.ValueShouldNotBeZero, id + ": slope = 0 ใช้ระยะดิ่งไม่ได้"); return null; }
                run = Math.Abs(length / slope);
            }
            else run = length / Math.Sqrt(1.0 + slope * slope);
            return Check(cs, id, new Pt(from.Value.X + dir * run, from.Value.Y + slope * run));
        }

        // ลาดจนชนดิน: ไม่ชนภายใน maxDistance (ระยะราบ) = หยุดที่ maxDistance + เตือน; ไม่มีดิน = ยาวคงที่ layoutLength
        private static Pt? SlopeToSurface(CorridorState cs, string id, ObjectId surface, Pt? from, double slope, double dir, double maxDistance, double layoutLength)
        {
            if (from == null) return null;
            Pt f = from.Value;
            if (surface.IsNull)
            {
                if (cs.Mode != CorridorMode.Layout)
                    Warn(cs, CorridorError.LogicalNameNotFound, id + " ลาดจนชนดิน: ไม่ได้กำหนด Target Surface — วาดยาวคงที่ " + layoutLength + " m");
                return Check(cs, id, new Pt(f.X + dir * layoutLength, f.Y + slope * layoutLength));
            }
            IPoint hit = null;
            try
            {
                hit = cs.IntersectSurface(surface, cs.CurrentAlignmentId, Abs(cs, f), dir > 0, slope);
            }
            catch
            {
                hit = null;
            }
            if (hit != null && Math.Abs(hit.Offset - cs.CurrentOffset - f.X) <= maxDistance + 1e-9)
                return Check(cs, id, new Pt(hit.Offset - cs.CurrentOffset, hit.Elevation - cs.CurrentElevation));
            Warn(cs, CorridorError.NoSideslopeIntersectFound, id + " ลาดจนชนดิน: ไม่ชนผิวดินภายใน " + maxDistance + " m — หยุดที่ " + maxDistance + " m");
            return Check(cs, id, new Pt(f.X + dir * maxDistance, f.Y + slope * maxDistance));
        }

        // จุดบนผิวดินที่ระยะ dx จาก from; ไม่มีดิน = ใช้ระดับของ from
        private static Pt? OnSurface(CorridorState cs, string id, ObjectId surface, Pt? from, double dx)
        {
            if (from == null) return null;
            double x = from.Value.X + dx;
            if (surface.IsNull)
            {
                if (cs.Mode != CorridorMode.Layout)
                    Warn(cs, CorridorError.LogicalNameNotFound, id + " บนผิวดิน: ไม่ได้กำหนด Target Surface — ใช้ระดับของจุดตั้งต้น");
                return Check(cs, id, new Pt(x, from.Value.Y));
            }
            try
            {
                return Check(cs, id, new Pt(x, Elevation(cs, surface, cs.CurrentOffset + x) - cs.CurrentElevation));
            }
            catch (Exception e)
            {
                Warn(cs, CorridorError.Failure, id + " บนผิวดิน: " + e.Message);
                return null;
            }
        }

        private static Pt? Between(CorridorState cs, string id, Pt? a, Pt? b, double t)
        {
            if (a == null || b == null) return null;
            return Check(cs, id, new Pt(a.Value.X + t * (b.Value.X - a.Value.X), a.Value.Y + t * (b.Value.Y - a.Value.Y)));
        }

        // จุดตัดของเส้น a1-a2 กับ b1-b2 (ต่อเส้นออกไปได้)
        private static Pt? Intersect(CorridorState cs, string id, Pt? a1, Pt? a2, Pt? b1, Pt? b2)
        {
            if (a1 == null || a2 == null || b1 == null || b2 == null) return null;
            Pt p = a1.Value, q = a2.Value, r = b1.Value, s = b2.Value;
            double d = (q.X - p.X) * (s.Y - r.Y) - (q.Y - p.Y) * (s.X - r.X);
            if (Math.Abs(d) < 1e-12) { Warn(cs, CorridorError.Failure, id + ": เส้นทั้งสองขนานกัน ไม่มีจุดตัด"); return null; }
            double t = ((r.X - p.X) * (s.Y - r.Y) - (r.Y - p.Y) * (s.X - r.X)) / d;
            return Check(cs, id, new Pt(p.X + t * (q.X - p.X), p.Y + t * (q.Y - p.Y)));
        }

        private static Pt? Check(CorridorState cs, string id, Pt p)
        {
            if (double.IsNaN(p.X) || double.IsNaN(p.Y) || double.IsInfinity(p.X) || double.IsInfinity(p.Y))
            {
                Warn(cs, CorridorError.Failure, id + ": คำนวณไม่ได้ (หารด้วยศูนย์?)");
                return null;
            }
            return p;
        }

        private static Point AddPoint(CorridorState cs, Pt? p, params string[] codes)
        {
            if (p == null) return null;
            Point point = cs.Points.Add(p.Value.X, p.Value.Y, "");
            foreach (string code in codes)
                point.Codes.TryAdd(code);
            return point;
        }

        private static Link AddLink(CorridorState cs, string id, Point a, Point b, params string[] codes)
        {
            if (a == null || b == null) return null;
            Link link = cs.Links.Add(new[] { a, b }, "");
            foreach (string code in codes)
                link.Codes.TryAdd(code);
            return link;
        }

        // link ที่วิ่งตามผิวดินจาก a ถึง b (เพิ่มจุดที่ผิวดินหักระหว่างทาง); ไม่มีดิน = เส้นตรง
        private static Link FollowSurface(CorridorState cs, string id, ObjectId surface, Pt? pa, Point a, Pt? pb, Point b, params string[] codes)
        {
            if (a == null || b == null) return null;
            var path = new List<Point> { a };
            if (surface.IsNull)
            {
                if (cs.Mode != CorridorMode.Layout)
                    Warn(cs, CorridorError.LogicalNameNotFound, id + " วิ่งตามผิวดิน: ไม่ได้กำหนด Target Surface — ใช้เส้นตรงแทน");
            }
            else
            {
                try
                {
                    double lo = Math.Min(pa.Value.X, pb.Value.X), hi = Math.Max(pa.Value.X, pb.Value.X);
                    var mids = new List<(double X, double Y)>();
                    SampledSectionLinkCollection sampled = cs.SampleSection(surface, cs.CurrentAlignmentId, Abs(cs, pa.Value), Abs(cs, pb.Value));
                    foreach (SampledSectionLink s in sampled)
                    {
                        double x = s.EndPointOffset - cs.CurrentOffset;
                        if (x > lo + 1e-9 && x < hi - 1e-9)
                            mids.Add((x, s.EndPointElevation - cs.CurrentElevation));
                    }
                    mids.Sort((p, q) => p.X.CompareTo(q.X));
                    if (pa.Value.X > pb.Value.X) mids.Reverse();
                    foreach (var m in mids)
                        path.Add(cs.Points.Add(m.X, m.Y, ""));
                }
                catch (Exception e)
                {
                    Warn(cs, CorridorError.Failure, id + " วิ่งตามผิวดิน: " + e.Message);
                }
            }
            path.Add(b);
            Link link = cs.Links.Add(path.ToArray(), "");
            foreach (string code in codes)
                link.Codes.TryAdd(code);
            return link;
        }

        private static void AddShape(CorridorState cs, string id, Link[] links, params string[] codes)
        {
            foreach (Link l in links)
            {
                if (l == null) { Warn(cs, CorridorError.Failure, id + ": ข้ามเพราะมี link ที่วาดไม่ได้"); return; }
            }
            Shape shape = cs.Shapes.Add(links, "");
            foreach (string code in codes)
                shape.Codes.TryAdd(code);
        }

        private static PointInMem Abs(CorridorState cs, Pt p)
        {
            return new PointInMem { Station = cs.CurrentStation, Offset = cs.CurrentOffset + p.X, Elevation = cs.CurrentElevation + p.Y };
        }

        private static ObjectId TargetSurface(CorridorState cs, string name)
        {
            if (cs.Mode == CorridorMode.Layout) return ObjectId.Null;
            try { return cs.ParamsSurface.Value(name); }
            catch { return ObjectId.Null; }
        }

        // ระดับผิวดินที่ offset จริง (แบบเดียวกับ TryElevation ใน test2.cs)
        private static double Elevation(CorridorState cs, ObjectId surfaceId, double offset)
        {
            AcDb.TransactionManager tm = AcDb.HostApplicationServices.WorkingDatabase.TransactionManager;
            var surface = (Surface)tm.GetObject(surfaceId, AcDb.OpenMode.ForRead, false, false);
            var alignment = (Alignment)tm.GetObject(cs.CurrentAlignmentId, AcDb.OpenMode.ForRead, false, false);
            double x = 0.0, y = 0.0;
            alignment.PointLocation(cs.CurrentStation, offset, ref x, ref y);
            return surface.FindElevationAtXY(x, y);
        }

        private static long GetLong(CorridorState cs, string name, long defaultValue)
        {
            try { return cs.ParamsLong.Value(name); }
            catch { return defaultValue; }
        }

        private static double GetDouble(CorridorState cs, string name, double defaultValue)
        {
            try { return cs.ParamsDouble.Value(name); }
            catch { return defaultValue; }
        }

        private static void Warn(CorridorState cs, CorridorError error, string message)
        {
            cs.RecordError(error, CorridorErrorLevel.AsWarning, message, Source, true);
        }
    }

    // ===== SA-DRAWING END =====
}
