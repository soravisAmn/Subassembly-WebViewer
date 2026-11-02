// round4b-demo.cs — subassembly ที่สร้างจาก SA Drawing Studio
//
// รูปตัดวาดในเว็บ: โค้ดในช่วง SA-DRAWING สร้างจากการวาด (เปิดไฟล์นี้ในเว็บแล้ววาดต่อได้ อย่าแก้ช่วงนั้นด้วยมือ)
// โค้ดนอกช่วงนั้นแก้เองได้ เว็บจะไม่แตะ
//
// Parameter:
//   Side (long, default 0)
//   TopWidth (double, default 2) — Top Width
//   SideSlope (double, default 1.5) — Side Slope (1:x)
//   Depth (double, default 1) — Depth (ตามแบบ)
//   MinDepth (double, default 1.5) — Min Depth below ground
//   WallH (double, default 0.5) — Wall Height
//   DesignWL (double, default 101) — Design WL (ระดับจริง)
//   Freeboard (double, default 0.5)
//   DitchOffset (double, default 3) — Ditch Offset
//   DitchMin (double, default 0.5) — Ditch depth min
//   DitchMax (double, default 1.5) — Ditch depth max

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
    public class Round4bDemo
    {
        // ------------------------------------------------------------------
        // Civil 3D เรียก 4 เมธอดนี้ผ่าน .atc (ต้องเป็น public, ไม่มีพารามิเตอร์)

        public void GetLogicalNames()
        {
            CorridorState corridorState = null;
            try
            {
                corridorState = CivilApplication.ActiveDocument.CorridorState;
                SaDrawing_Round4bDemo.AddTargets(corridorState); // SA-DRAWING TARGET
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
                SaDrawing_Round4bDemo.AddParams(corridorState); // SA-DRAWING PARAM
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
                SaDrawing_Round4bDemo.Draw(corridorState); // SA-DRAWING CALL
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
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, nameof(Round4bDemo), true);
        }
    }

    // ===== SA-DRAWING BEGIN (สร้างโดย SA Drawing Studio — แก้ด้วยการวาดในเว็บ อย่าแก้ช่วงนี้ด้วยมือ) =====
    // sa-spec: {"version":1,"className":"Round4bDemo","namespace":"TestSubassembly","params":[{"name":"Side","kind":"long","default":0,"displayName":"Side","min":null,"max":null},{"name":"TopWidth","kind":"double","default":2,"displayName":"Top Width","min":null,"max":null},{"name":"SideSlope","kind":"double","default":1.5,"displayName":"Side Slope (1:x)","min":null,"max":null},{"name":"Depth","kind":"double","default":1,"displayName":"Depth (ตามแบบ)","min":null,"max":null},{"name":"MinDepth","kind":"double","default":1.5,"displayName":"Min Depth below ground","min":null,"max":null},{"name":"WallH","kind":"double","default":0.5,"displayName":"Wall Height","min":null,"max":null},{"name":"DesignWL","kind":"double","default":101,"displayName":"Design WL (ระดับจริง)","min":null,"max":null},{"name":"Freeboard","kind":"double","default":0.5,"displayName":"Freeboard","min":null,"max":null},{"name":"DitchOffset","kind":"double","default":3,"displayName":"Ditch Offset","min":null,"max":null},{"name":"DitchMin","kind":"double","default":0.5,"displayName":"Ditch depth min","min":null,"max":null},{"name":"DitchMax","kind":"double","default":1.5,"displayName":"Ditch depth max","min":null,"max":null}],"targets":[{"name":"TargetSurface","type":"Surface","displayName":"Target Surface"}],"points":[{"id":"P1","codes":["TrapTopInside"],"def":{"type":"origin"}},{"id":"P2","codes":["TrapTopOutside"],"def":{"type":"delta","from":"P1","dx":"TopWidth","dy":"0"}},{"id":"P3","codes":["WallTop"],"def":{"type":"delta","from":"P2","dx":"0","dy":"WallH"},"limit":{"measure":"depth","side":"above","ref":{"type":"elev","expr":"DesignWL"},"min":"Freeboard","max":null,"action":"clampWarn","along":"vertical"}},{"id":"P4","codes":["TrapBaseOutside"],"def":{"type":"slopeLength","from":"P2","slope":"-1/SideSlope","length":"Depth","dir":1,"measure":"dy"},"limit":{"measure":"depth","side":"below","ref":{"type":"ground","target":"TargetSurface"},"min":"MinDepth","max":null,"action":"clampWarn","along":"slope"}},{"id":"P5","codes":["TrapBaseInside"],"def":{"type":"delta","from":"P1","dx":"-0.5","dy":"P4.y"}},{"id":"P6","codes":["DitchBottom"],"def":{"type":"onSurface","from":"P2","dx":"DitchOffset","target":"TargetSurface"},"limit":{"measure":"depth","side":"below","ref":{"type":"point","id":"P2"},"min":"DitchMin","max":"DitchMax","action":"clampWarn","along":"vertical"}},{"id":"P7","codes":["Underlay"],"branch":"B1","def":{"type":"delta","from":"P4","dx":"0","dy":"-0.3"}}],"links":[{"id":"L1","points":["P1","P2"],"codes":["Top"]},{"id":"L2","points":["P2","P3"],"codes":["Wall"]},{"id":"L3","points":["P2","P4"],"codes":["TrapSide"]},{"id":"L4","points":["P4","P5"],"codes":["TrapBase"]},{"id":"L5","points":["P5","P1"],"codes":["TrapSide"]},{"id":"L6","points":["P2","P6"],"codes":["Ditch"]},{"id":"L7","points":["P4","P7"],"codes":["Underlay"],"branch":"B1"}],"shapes":[{"id":"S1","links":["L1","L3","L4","L5"],"codes":["Body"]}],"logic":{"conditions":[{"id":"C1","name":"Deep","expr":"limited(P4)","note":"ฐานถูกบังคับให้ลึกกว่าแบบ = รองพื้นเพิ่ม"}],"decisions":[{"id":"D1","parent":null,"kind":"if","test":"Deep","label":"ฐานถูกบังคับลึก?"}],"branches":[{"id":"B1","decision":"D1","case":true,"label":"บังคับลึก"},{"id":"B2","decision":"D1","case":false,"label":"ลึกตามแบบ"}]},"side":{"param":"Side","mirror":true}}
    internal static class SaDrawing_Round4bDemo
    {
        private const string Source = "Round4bDemo";
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
            cs.ParamsDouble.Add("TopWidth", 2.0).DisplayName = "Top Width";
            cs.ParamsDouble.Add("SideSlope", 1.5).DisplayName = "Side Slope (1:x)";
            cs.ParamsDouble.Add("Depth", 1.0).DisplayName = "Depth (ตามแบบ)";
            cs.ParamsDouble.Add("MinDepth", 1.5).DisplayName = "Min Depth below ground";
            cs.ParamsDouble.Add("WallH", 0.5).DisplayName = "Wall Height";
            cs.ParamsDouble.Add("DesignWL", 101.0).DisplayName = "Design WL (ระดับจริง)";
            cs.ParamsDouble.Add("Freeboard", 0.5).DisplayName = "Freeboard";
            cs.ParamsDouble.Add("DitchOffset", 3.0).DisplayName = "Ditch Offset";
            cs.ParamsDouble.Add("DitchMin", 0.5).DisplayName = "Ditch depth min";
            cs.ParamsDouble.Add("DitchMax", 1.5).DisplayName = "Ditch depth max";
        }

        internal static void Draw(CorridorState cs)
        {
            // ---- parameter (นอกขอบเขต = ใช้ค่าขอบแทน + เตือน) ----
            long Side = GetLong(cs, "Side", 0);
            double TopWidth = GetDouble(cs, "TopWidth", 2.0);
            double SideSlope = GetDouble(cs, "SideSlope", 1.5);
            double Depth = GetDouble(cs, "Depth", 1.0);
            double MinDepth = GetDouble(cs, "MinDepth", 1.5);
            double WallH = GetDouble(cs, "WallH", 0.5);
            double DesignWL = GetDouble(cs, "DesignWL", 101.0);
            double Freeboard = GetDouble(cs, "Freeboard", 0.5);
            double DitchOffset = GetDouble(cs, "DitchOffset", 3.0);
            double DitchMin = GetDouble(cs, "DitchMin", 0.5);
            double DitchMax = GetDouble(cs, "DitchMax", 1.5);
            double F = Side == 1 ? -1.0 : 1.0;   // Side = 1 (Left) -> กลับด้านแนวราบทั้งหมด

            // ---- target surface (Layout mode / ไม่ได้กำหนด = วาดแบบไม่มีดิน) ----
            ObjectId surface = TargetSurface(cs, "TargetSurface");

            // ---- พิกัดของจุด (เทียบ origin; null = หาจุดนี้ไม่ได้ ส่วนที่พึ่งจุดนี้จะถูกข้าม) ----
            // (เงื่อนไข / กิ่ง: bool? = null คือไม่รู้ค่า เพราะหาจุดที่อ้างไม่ได้ -> ไม่เข้ากิ่งไหน · object ในกิ่งที่ไม่เกิด = null ไม่เพิ่มลง Civil 3D)
            Pt? P1 = Pt.Origin;   // P1 origin
            Pt? P2 = Delta(cs, "P2", P1, F * TopWidth, 0.0);   // P2 ห่างจาก P1
            Pt? P4 = SlopeLength(cs, "P4", P2, -1.0 / SideSlope, Depth, F, Measure.Dy);   // P4 ลาด + ความยาว จาก P2
            // P4 Max / Min: ต่ำกว่าผิวดิน อย่างน้อย MinDepth (ไม่ผ่าน: ขยับ + เตือน ตามแนวเดิม)
            P4 = Limit(cs, "P4", P4, P2, LimAlong.Slope, surface.IsNull ? "ไม่ได้กำหนด Target Surface" : null, _p => Ground(cs, surface, _p) - _p.Y, () => MinDepth, null, LimAct.ClampWarn, "ต่ำกว่าผิวดิน", out bool P4_lim);
            bool? Deep = Cond(cs, "Deep", () => P4_lim);   // C1 Deep: ฐานถูกบังคับให้ลึกกว่าแบบ = รองพื้นเพิ่ม
            Pt? P3 = Delta(cs, "P3", P2, F * 0.0, WallH);   // P3 ห่างจาก P2
            // P3 Max / Min: สูงกว่า ระดับ DesignWL อย่างน้อย Freeboard (ไม่ผ่าน: ขยับ + เตือน แนวดิ่ง)
            P3 = Limit(cs, "P3", P3, P2, LimAlong.Vertical, null, _p => _p.Y - ((DesignWL) - cs.CurrentElevation), () => Freeboard, null, LimAct.ClampWarn, "สูงกว่า ระดับ DesignWL", out _);
            Pt? P5 = Try(cs, "P5", () => Delta(cs, "P5", P1, F * -0.5, PY(P4)));   // P5 ห่างจาก P1
            Pt? P6 = OnSurface(cs, "P6", surface, P2, F * DitchOffset);   // P6 บนผิวดิน
            // P6 Max / Min: ต่ำกว่า P2 อย่างน้อย DitchMin อย่างมาก DitchMax (ไม่ผ่าน: ขยับ + เตือน แนวดิ่ง)
            P6 = Limit(cs, "P6", P6, null, LimAlong.Vertical, null, _p => PY(P2) - _p.Y, () => DitchMin, () => DitchMax, LimAct.ClampWarn, "ต่ำกว่า P2", out _);
            // D1 decision ฐานถูกบังคับลึก?
            bool B1 = Deep == true;   // กิ่ง "บังคับลึก"
            bool B2 = Deep == false;   // กิ่ง "ลึกตามแบบ"
            Pt? P7 = B1 ? Delta(cs, "P7", P4, F * 0.0, -0.3) : null;   // P7 ห่างจาก P4 [กิ่ง บังคับลึก]

            // ---- เพิ่มจุด / link / shape ลง CorridorState ----
            Point p1 = AddPoint(cs, P1, "TrapTopInside");
            Point p2 = AddPoint(cs, P2, "TrapTopOutside");
            Point p3 = AddPoint(cs, P3, "WallTop");
            Point p4 = AddPoint(cs, P4, "TrapBaseOutside");
            Point p5 = AddPoint(cs, P5, "TrapBaseInside");
            Point p6 = AddPoint(cs, P6, "DitchBottom");
            Point p7 = B1 ? AddPoint(cs, P7, "Underlay") : null;   // [กิ่ง บังคับลึก]
            Link l1 = AddLink(cs, "L1", p1, p2, "Top");
            Link l2 = AddLink(cs, "L2", p2, p3, "Wall");
            Link l3 = AddLink(cs, "L3", p2, p4, "TrapSide");
            Link l4 = AddLink(cs, "L4", p4, p5, "TrapBase");
            Link l5 = AddLink(cs, "L5", p5, p1, "TrapSide");
            Link l6 = AddLink(cs, "L6", p2, p6, "Ditch");
            Link l7 = B1 ? AddLink(cs, "L7", p4, p7, "Underlay") : null;   // [กิ่ง บังคับลึก]
            AddShape(cs, "S1", new[] { l1, l3, l4, l5 }, "Body");
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

        // ห่าง length ทำมุม angle (องศา ทวนเข็มจาก +x ในกรอบ Side = Right) · F = -1 (Left) กลับด้านแนวราบ
        private static Pt? Polar(CorridorState cs, string id, Pt? from, double length, double angle, double F)
        {
            if (from == null) return null;
            return Check(cs, id, new Pt(from.Value.X + F * length * Math.Cos(angle * Deg), from.Value.Y + length * Math.Sin(angle * Deg)));
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

        // หมุนจุด p รอบ pivot ด้วยมุม angle (องศา ทวนเข็ม +) — สมาชิกกลุ่มหมุน
        private static Pt? Rotate(CorridorState cs, string id, Pt? p, Pt? pivot, double angle)
        {
            if (p == null) return null;
            if (pivot == null) { Warn(cs, CorridorError.Failure, id + ": ข้ามเพราะหาจุดหมุนไม่ได้"); return null; }
            double r = angle * Deg, c = Math.Cos(r), s = Math.Sin(r), dx = p.Value.X - pivot.Value.X, dy = p.Value.Y - pivot.Value.Y;
            return Check(cs, id, new Pt(pivot.Value.X + dx * c - dy * s, pivot.Value.Y + dx * s + dy * c));
        }

        // ---- ค่าจากเรขาคณิตในนิพจน์ (P3.x / P3.y / ground / exists) ----
        // จุดที่อ้างหาไม่ได้ = โยน InvalidOperationException -> Try ข้างล่างเตือน แล้วให้ object นี้หาไม่ได้ (ตรงกับตัวคำนวณในเว็บ)

        private static double PX(Pt? p)
        {
            if (p == null) throw new InvalidOperationException("ข้ามเพราะหาจุดที่นิพจน์อ้างไม่ได้");
            return p.Value.X;
        }

        private static double PY(Pt? p)
        {
            if (p == null) throw new InvalidOperationException("ข้ามเพราะหาจุดที่นิพจน์อ้างไม่ได้");
            return p.Value.Y;
        }

        private static bool Exists(Pt? p)
        {
            return p != null;
        }

        // == / != ของตัวเลขเทียบด้วย tolerance เดียวกับเว็บ
        private static bool Eq(double a, double b)
        {
            return Math.Abs(a - b) <= 1e-6;
        }

        // ระดับผิวดินที่ offset ของจุด (เทียบ origin) · ไม่มีผิวดิน (Layout mode / ไม่ได้กำหนด target) = ระดับของจุดเอง + เตือน
        private static double Ground(CorridorState cs, ObjectId surface, Pt? p)
        {
            double y = PY(p);
            if (surface.IsNull)
            {
                if (cs.Mode != CorridorMode.Layout)
                    Warn(cs, CorridorError.LogicalNameNotFound, "ground(): ไม่ได้กำหนด Target Surface — ใช้ระดับของจุดเอง");
                return y;
            }
            try
            {
                return Elevation(cs, surface, cs.CurrentOffset + p.Value.X) - cs.CurrentElevation;
            }
            catch (Exception e)
            {
                throw new InvalidOperationException("ground(): " + e.Message);
            }
        }

        // ---- Max / Min ของจุด (รอบ 4b) — ตรงกับ limitPt / solveLimit ใน wwwroot/js/spec.js ----

        private enum LimAlong { Vertical, Horizontal, Slope }
        private enum LimAct { ClampWarn, Clamp, Warn }

        // ค่าที่คุม (measure) ของจุด q ต้องอยู่ระหว่าง min..max — นอกขอบ = ขยับตาม along จนถึงขอบ (Slope = ตามแนวจาก start)
        //   refWhy != null = อ้างอิงหาไม่ได้ (ไม่ขยับ + เตือน ยกเว้น Layout mode) · min / max = null ไม่คุม · limited = รอบนี้ไม่ผ่านขอบ
        //   อ้างจุดที่หาไม่ได้ / เงื่อนไขไม่รู้ค่า ในนิพจน์ = ไม่ขยับ + เตือน (จุดไม่หาย)
        private static Pt? Limit(CorridorState cs, string id, Pt? q, Pt? start, LimAlong along, string refWhy,
                                 Func<Pt, double> measure, Func<double> min, Func<double> max, LimAct act, string what, out bool limited)
        {
            limited = false;
            if (q == null) return null;
            Pt p0 = q.Value;
            string tag = id + " Max / Min";
            if (refWhy != null)
            {
                if (cs.Mode != CorridorMode.Layout) Warn(cs, CorridorError.LogicalNameNotFound, tag + ": " + refWhy + " — ไม่ขยับ");
                return q;
            }
            try
            {
                double? mn = min != null ? min() : (double?)null, mx = max != null ? max() : (double?)null;
                if (mn == null && mx == null) return q;
                if (mn != null && mx != null && mn.Value > mx.Value)
                {
                    Warn(cs, CorridorError.ValueInABadPosition, tag + ": อย่างน้อย " + F2(mn.Value) + " > อย่างมาก " + F2(mx.Value) + " — ใช้อย่างน้อย");
                    mx = null;
                }
                double v0 = measure(p0);
                double tgt;
                CorridorError err;
                if (mn != null && v0 < mn.Value - 1e-9) { tgt = mn.Value; err = CorridorError.ValueTooSmall; }
                else if (mx != null && v0 > mx.Value + 1e-9) { tgt = mx.Value; err = CorridorError.ValueTooLarge; }
                else return q;
                limited = true;
                string msg = id + " " + what + " " + F2(v0) + " m " + (v0 < tgt ? "<" : ">") + " " + F2(tgt) + " m ";
                if (act == LimAct.Warn) { Warn(cs, err, msg + "(ไม่ขยับ)"); return q; }
                double dx = 0.0, dy = 1.0;
                if (along == LimAlong.Horizontal) { dx = 1.0; dy = 0.0; }
                else if (along == LimAlong.Slope)
                {
                    Pt s = start ?? Pt.Origin;
                    double ex = p0.X - s.X, ey = p0.Y - s.Y, n = Math.Sqrt(ex * ex + ey * ey);
                    if (n < 1e-9) { Warn(cs, CorridorError.Failure, tag + ": จุดอยู่ที่จุดต้นของแนว — ไม่ขยับ"); return q; }
                    dx = ex / n; dy = ey / n;
                }
                double? t = SolveLimit(u =>
                {
                    try { return measure(new Pt(p0.X + u * dx, p0.Y + u * dy)) - tgt; }
                    catch (InvalidOperationException) { return double.NaN; }
                });
                if (t == null) { Warn(cs, CorridorError.Failure, tag + ": หาตำแหน่งที่ถึงขอบไม่ได้ภายใน 50 m — ไม่ขยับ"); return q; }
                if (act == LimAct.ClampWarn) Warn(cs, err, msg + "ใช้ " + F2(tgt) + " m แทน");
                return new Pt(p0.X + t.Value * dx, p0.Y + t.Value * dy);
            }
            catch (InvalidOperationException e)
            {
                Warn(cs, CorridorError.Failure, tag + ": " + e.Message + " — ไม่ขยับ");
                return q;
            }
        }

        // หา t ที่ f(t) = 0 ใกล้ 0 ที่สุด: ขยายช่วง 0.01, 0.02, ... ถึง 50 สลับ + / − แล้วแบ่งครึ่ง 60 รอบ · ไม่เจอ = null
        private static double? SolveLimit(Func<double, double> f)
        {
            double f0 = f(0.0);
            if (double.IsNaN(f0) || double.IsInfinity(f0)) return null;
            if (Math.Abs(f0) < 1e-12) return 0.0;
            double prevP = 0.0, prevN = 0.0;
            for (double s = 0.01; ; s = Math.Min(s * 2.0, 50.0))
            {
                foreach (int sg in new[] { 1, -1 })
                {
                    double t = sg * s, ft = f(t);
                    if (double.IsNaN(ft) || double.IsInfinity(ft)) continue;
                    if (ft * f0 <= 0.0)
                    {
                        double a = sg > 0 ? prevP : prevN, b = t, fa = f(a);
                        for (int k = 0; k < 60; k++)
                        {
                            double m = (a + b) / 2.0, fm = f(m);
                            if (fm * fa > 0.0) { a = m; fa = fm; } else b = m;
                        }
                        return (a + b) / 2.0;
                    }
                    if (sg > 0) prevP = t; else prevN = t;
                }
                if (s >= 50.0) return null;
            }
        }

        // ระยะตั้งฉากจากจุดถึงผิวดิน (บวก = อยู่ใต้ดิน) — ความชันของดินจากระดับ ±0.01 m
        private static double Normal(CorridorState cs, ObjectId surface, Pt p)
        {
            const double h = 0.01;
            double s = (Ground(cs, surface, new Pt(p.X + h, p.Y)) - Ground(cs, surface, new Pt(p.X - h, p.Y))) / (2.0 * h);
            return (Ground(cs, surface, p) - p.Y) / Math.Sqrt(1.0 + s * s);
        }

        // ความยาวของ p จากจุดต้น s ตามแนว s -> q (มีเครื่องหมาย)
        private static double AlongLen(Pt? s, Pt? q, Pt p)
        {
            Pt a = s ?? Pt.Origin;
            if (q == null) throw new InvalidOperationException("ข้ามเพราะหาจุดไม่ได้");
            double ex = q.Value.X - a.X, ey = q.Value.Y - a.Y, n = Math.Sqrt(ex * ex + ey * ey);
            if (n < 1e-9) throw new InvalidOperationException("จุดอยู่ที่จุดต้นของแนว");
            return ((p.X - a.X) * ex + (p.Y - a.Y) * ey) / n;
        }

        private static string F2(double v)
        {
            return (Math.Abs(v) < 0.005 ? 0.0 : v).ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);
        }

        // ---- เงื่อนไข / กิ่ง ----
        // เงื่อนไขคำนวณไม่ได้ (อ้างจุดที่หาไม่ได้ / เงื่อนไขที่ไม่รู้ค่า) = null + เตือน -> ไม่เข้ากิ่งไหน (ตรงกับตัวคำนวณในเว็บ)

        private static bool? Cond(CorridorState cs, string name, Func<bool> test)
        {
            try
            {
                return test();
            }
            catch (InvalidOperationException e)
            {
                Warn(cs, CorridorError.Failure, "เงื่อนไข " + name + ": " + e.Message);
                return null;
            }
        }

        private static double? Val(CorridorState cs, string name, Func<double> value)
        {
            try
            {
                return value();
            }
            catch (InvalidOperationException e)
            {
                Warn(cs, CorridorError.Failure, name + ": " + e.Message);
                return null;
            }
        }

        // ค่าของเงื่อนไขที่ใช้ในนิพจน์อื่น — ไม่รู้ค่า = โยน (ให้ Cond / Try ข้างนอกจัดการ)
        private static bool V(bool? b)
        {
            if (b == null) throw new InvalidOperationException("เงื่อนไขที่อ้างไม่รู้ค่า");
            return b.Value;
        }

        // จุดแรกในรายการที่เกิด (ไว้ต่อเรขาคณิตหลังกิ่ง) · ไม่มีสักจุด = หาไม่ได้ + เตือน
        private static Pt? FirstOf(CorridorState cs, string id, params Pt?[] points)
        {
            foreach (Pt? p in points)
            {
                if (p != null) return p;
            }
            Warn(cs, CorridorError.Failure, id + ": ไม่มีจุดในรายการที่เกิด");
            return null;
        }

        private static T Try<T>(CorridorState cs, string id, Func<T> calc)
        {
            try
            {
                return calc();
            }
            catch (InvalidOperationException e)
            {
                Warn(cs, CorridorError.Failure, id + ": " + e.Message);
                return default(T);
            }
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

        // ---- เส้นโค้ง: link ใน Civil 3D เป็นเส้นตรงเท่านั้น -> จุดระหว่างทาง (ไม่มี code) + link ตรงทีละท่อน (code เดียวกันทุกท่อน) ----
        // เรขาคณิตตรงกับ wwwroot/js/spec.js (tangentPoint / arcGeom / segCount / arcPoints)

        private enum Seg { Chord, Count }

        private struct Arc
        {
            public double Cx, Cy, R, A1, Sw;   // ศูนย์กลาง, รัศมี, มุมเริ่ม (rad), มุมกวาด (rad, + = ทวนเข็ม)
        }

        private static double Mod(double a, double m) => ((a % m) + m) % m;

        // จุดสัมผัสบนเส้น corner→toward ของโค้งรัศมี radius ที่มุม corner (อีกเส้นไปทาง other)
        // ขนานกัน / รัศมีใหญ่เกินเส้น = เตือน + ใช้มุมแหลมเดิม
        private static Pt? Tangent(CorridorState cs, string id, Pt? corner, Pt? toward, Pt? other, double radius)
        {
            if (corner == null || toward == null || other == null) return null;
            Pt c = corner.Value, t = toward.Value, o = other.Value;
            double l1 = Math.Sqrt((t.X - c.X) * (t.X - c.X) + (t.Y - c.Y) * (t.Y - c.Y));
            double l2 = Math.Sqrt((o.X - c.X) * (o.X - c.X) + (o.Y - c.Y) * (o.Y - c.Y));
            string warn = null;
            Pt r = c;
            if (l1 < 1e-9 || l2 < 1e-9) warn = "เส้นยาวเป็นศูนย์";
            else
            {
                double ux = (t.X - c.X) / l1, uy = (t.Y - c.Y) / l1, vx = (o.X - c.X) / l2, vy = (o.Y - c.Y) / l2;
                double al = Math.Acos(Math.Max(-1.0, Math.Min(1.0, ux * vx + uy * vy)));
                if (al < 1e-6 || Math.PI - al < 1e-6) warn = "สองเส้นขนานกัน";
                else if (!(radius > 0.0)) warn = "รัศมี " + radius + " ต้องมากกว่า 0";
                else
                {
                    double d = radius / Math.Tan(al / 2.0);
                    if (d > l1 + 1e-9 || d > l2 + 1e-9) warn = "รัศมี " + radius + " ใหญ่เกิน (จุดสัมผัสเลยปลายเส้น)";
                    else r = new Pt(c.X + ux * d, c.Y + uy * d);
                }
            }
            if (warn != null) Warn(cs, CorridorError.ValueTooLarge, id + " จุดสัมผัส: " + warn + " — ใช้มุมแหลมเดิม");
            return Check(cs, id, r);
        }

        // วงกลมของโค้งจาก a ถึง b · kind: 0 = ผ่าน 3 จุด (extra = จุดผ่าน), 1 = รัศมี (ccw = ทิศบนจอจริง), 2 = fillet (extra = จุดมุม)
        // คืนข้อความเตือนเมื่อเป็นไปไม่ได้ (ผู้เรียกใช้เส้นตรงแทน) · null = ได้ g
        private static string ArcGeom(int kind, Pt a, Pt b, Pt extra, double radius, bool ccw, bool large, out Arc g)
        {
            g = new Arc();
            double TAU = 2.0 * Math.PI;
            if (kind == 0)
            {
                Pt v = extra;
                double d = 2.0 * (a.X * (v.Y - b.Y) + v.X * (b.Y - a.Y) + b.X * (a.Y - v.Y));
                double size = Math.Max(Math.Max(Math.Sqrt((v.X - a.X) * (v.X - a.X) + (v.Y - a.Y) * (v.Y - a.Y)), Math.Sqrt((b.X - a.X) * (b.X - a.X) + (b.Y - a.Y) * (b.Y - a.Y))), 1e-9);
                if (Math.Abs(d) < 1e-9 * size * size) return "3 จุดเรียงเป็นเส้นตรง";
                double a2 = a.X * a.X + a.Y * a.Y, v2 = v.X * v.X + v.Y * v.Y, b2 = b.X * b.X + b.Y * b.Y;
                g.Cx = (a2 * (v.Y - b.Y) + v2 * (b.Y - a.Y) + b2 * (a.Y - v.Y)) / d;
                g.Cy = (a2 * (b.X - v.X) + v2 * (a.X - b.X) + b2 * (v.X - a.X)) / d;
                g.R = Math.Sqrt((a.X - g.Cx) * (a.X - g.Cx) + (a.Y - g.Cy) * (a.Y - g.Cy));
                g.A1 = Math.Atan2(a.Y - g.Cy, a.X - g.Cx);
                double s2 = Mod(Math.Atan2(b.Y - g.Cy, b.X - g.Cx) - g.A1, TAU), sv = Mod(Math.Atan2(v.Y - g.Cy, v.X - g.Cx) - g.A1, TAU);
                g.Sw = sv < s2 ? s2 : s2 - TAU;
                return null;
            }
            if (kind == 1)
            {
                double c = Math.Sqrt((b.X - a.X) * (b.X - a.X) + (b.Y - a.Y) * (b.Y - a.Y));
                if (c < 1e-9) return "จุดเริ่มกับจุดปลายเป็นจุดเดียวกัน";
                if (!(radius > 0.0) || radius < c / 2.0 - 1e-9) return "รัศมี " + radius + " น้อยกว่าครึ่งระยะเริ่ม-ปลาย (" + (c / 2.0) + ")";
                double h = Math.Sqrt(Math.Max(0.0, radius * radius - c * c / 4.0)), mx = (a.X + b.X) / 2.0, my = (a.Y + b.Y) / 2.0;
                double nx = -(b.Y - a.Y) / c, ny = (b.X - a.X) / c;   // ด้านซ้ายของทิศ a→b
                double side = ccw != large ? 1.0 : -1.0;
                g.Cx = mx + side * h * nx; g.Cy = my + side * h * ny; g.R = radius;
                g.A1 = Math.Atan2(a.Y - g.Cy, a.X - g.Cx);
                double s = Mod(Math.Atan2(b.Y - g.Cy, b.X - g.Cx) - g.A1, TAU);
                g.Sw = ccw ? s : s - TAU;
                return null;
            }
            // fillet: ศูนย์กลางบนเส้นแบ่งครึ่งมุม ห่างมุม R / sin(α/2) · จุดสัมผัสเป็นมุมแหลมเดิม = เส้นตรง
            Pt k = extra;
            double L1 = Math.Sqrt((a.X - k.X) * (a.X - k.X) + (a.Y - k.Y) * (a.Y - k.Y)), L2 = Math.Sqrt((b.X - k.X) * (b.X - k.X) + (b.Y - k.Y) * (b.Y - k.Y));
            if (L1 < 1e-9 || L2 < 1e-9) return "จุดสัมผัสอยู่ที่มุม (ดูคำเตือนของจุดสัมผัส)";
            if (!(radius > 0.0)) return "รัศมี " + radius + " ต้องมากกว่า 0";
            double ux = (a.X - k.X) / L1, uy = (a.Y - k.Y) / L1, wx = (b.X - k.X) / L2, wy = (b.Y - k.Y) / L2;
            double al = Math.Acos(Math.Max(-1.0, Math.Min(1.0, ux * wx + uy * wy)));
            if (al < 1e-6 || Math.PI - al < 1e-6) return "สองเส้นขนานกัน";
            double bl = Math.Sqrt((ux + wx) * (ux + wx) + (uy + wy) * (uy + wy)), dist = radius / Math.Sin(al / 2.0);
            g.Cx = k.X + (ux + wx) / bl * dist; g.Cy = k.Y + (uy + wy) / bl * dist; g.R = radius;
            g.A1 = Math.Atan2(a.Y - g.Cy, a.X - g.Cx);
            g.Sw = Mod(Math.Atan2(b.Y - g.Cy, b.X - g.Cx) - g.A1 + Math.PI, TAU) - Math.PI;   // ทางสั้น (< 180°)
            return null;
        }

        // จำนวนท่อน: Chord = ท่อนยาว (วัดตามโค้ง) ไม่เกิน value · Count = value ท่อน · จำกัด 2–180
        private static int SegCount(Seg by, double value, double r, double sw)
        {
            double n = by == Seg.Count ? Math.Round(value, MidpointRounding.AwayFromZero) : Math.Ceiling(r * Math.Abs(sw) / value - 1e-9);
            return (int)Math.Max(2.0, Math.Min(180.0, n));
        }

        // จุดระหว่างทาง + link ทีละท่อน (warn = เรขาคณิตเป็นไปไม่ได้ -> เส้นตรงท่อนเดียว)
        private static Link[] ArcLinks(CorridorState cs, string id, string kind, Point a, Point b, string warn, Arc g, Seg by, double value, string[] codes)
        {
            var path = new List<Point> { a };
            if (warn != null) Warn(cs, CorridorError.Failure, id + " " + kind + ": " + warn + " — ใช้เส้นตรงแทน");
            else
            {
                if (!(value > 0.0))
                {
                    Warn(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, id + ": ค่าท่อนโค้ง " + value + " ใช้ไม่ได้ — ใช้ท่อนยาว 0.05 m");
                    value = 0.05; by = Seg.Chord;
                }
                int n = SegCount(by, value, g.R, g.Sw);
                for (int i = 1; i < n; i++)
                {
                    double t = g.A1 + g.Sw * i / n;
                    path.Add(cs.Points.Add(g.Cx + g.R * Math.Cos(t), g.Cy + g.R * Math.Sin(t), ""));
                }
            }
            path.Add(b);
            var links = new Link[path.Count - 1];
            for (int i = 0; i < links.Length; i++)
            {
                links[i] = cs.Links.Add(new[] { path[i], path[i + 1] }, "");
                foreach (string code in codes)
                    links[i].Codes.TryAdd(code);
            }
            return links;
        }

        // โค้งผ่าน 3 จุด (pv = จุดผ่าน) · 3 จุดเรียงเส้นตรง = เตือน + เส้นตรง
        private static Link[] Arc3(CorridorState cs, string id, Pt? pa, Point a, Pt? pv, Pt? pb, Point b, Seg by, double value, params string[] codes)
        {
            if (a == null || b == null) return null;
            if (pv == null) { Warn(cs, CorridorError.Failure, id + ": ข้ามเพราะหาจุดที่โค้งผ่านไม่ได้"); return null; }
            string warn = ArcGeom(0, pa.Value, pb.Value, pv.Value, 0.0, false, false, out Arc g);
            return ArcLinks(cs, id, "โค้งผ่าน 3 จุด", a, b, warn, g, by, value, codes);
        }

        // โค้งเริ่ม-ปลาย-รัศมี · ccw = ทวนเข็มในกรอบ Side = Right (ฝั่ง Left ภาพกระจก = ทิศกลับ) · large = ทางยาว
        // รัศมี < ครึ่งระยะเริ่ม-ปลาย = เตือน + เส้นตรง
        private static Link[] ArcR(CorridorState cs, string id, Pt? pa, Point a, Pt? pb, Point b, double radius, bool ccw, bool large, double F, Seg by, double value, params string[] codes)
        {
            if (a == null || b == null) return null;
            string warn = ArcGeom(1, pa.Value, pb.Value, pa.Value, radius, ccw == (F > 0.0), large, out Arc g);
            return ArcLinks(cs, id, "โค้ง เริ่ม-ปลาย-รัศมี", a, b, warn, g, by, value, codes);
        }

        // โค้ง Fillet จากจุดสัมผัส pa ถึง pb ที่มุม pc
        private static Link[] Fillet(CorridorState cs, string id, Pt? pa, Point a, Pt? pc, Pt? pb, Point b, double radius, Seg by, double value, params string[] codes)
        {
            if (a == null || b == null) return null;
            if (pc == null) { Warn(cs, CorridorError.Failure, id + ": ข้ามเพราะหาจุดมุมไม่ได้"); return null; }
            string warn = ArcGeom(2, pa.Value, pb.Value, pc.Value, radius, false, false, out Arc g);
            return ArcLinks(cs, id, "โค้ง Fillet", a, b, warn, g, by, value, codes);
        }

        // ต่อ link ของ shape ตามลำดับ (เส้นโค้ง = หลายท่อน) · ส่วนที่วาดไม่ได้ (null) ให้ AddShape ข้าม + เตือน
        private static Link[] Join(params Link[][] parts)
        {
            var all = new List<Link>();
            foreach (Link[] p in parts)
            {
                if (p == null) all.Add(null);
                else all.AddRange(p);
            }
            return all.ToArray();
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
