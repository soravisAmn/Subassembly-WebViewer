// round3-demo.cs — subassembly ที่สร้างจาก SA Drawing Studio
//
// รูปตัดวาดในเว็บ: โค้ดในช่วง SA-DRAWING สร้างจากการวาด (เปิดไฟล์นี้ในเว็บแล้ววาดต่อได้ อย่าแก้ช่วงนั้นด้วยมือ)
// โค้ดนอกช่วงนั้นแก้เองได้ เว็บจะไม่แตะ
//
// Parameter:
//   Side (long, default 0)
//   W (double, default 3, ไม่น้อยกว่า 1) — ความกว้างบน
//   D (double, default 1.5, ไม่น้อยกว่า 0.5) — ความลึก
//   FilletR (double, default 0.4) — รัศมี Fillet มุมบน
//   DitchR (double, default 1.2) — รัศมีราง
//   PolyR (double, default 0.5) — รัศมี 5 เหลี่ยม
//   PolyTheta (double, default 0) — มุม 5 เหลี่ยม
//   BlockAng (double, default 15) — มุมหมุนบล็อก

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
    public class Round3Demo
    {
        // ------------------------------------------------------------------
        // Civil 3D เรียก 4 เมธอดนี้ผ่าน .atc (ต้องเป็น public, ไม่มีพารามิเตอร์)

        public void GetLogicalNames()
        {
            CorridorState corridorState = null;
            try
            {
                corridorState = CivilApplication.ActiveDocument.CorridorState;
                SaDrawing_Round3Demo.AddTargets(corridorState); // SA-DRAWING TARGET
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
                SaDrawing_Round3Demo.AddParams(corridorState); // SA-DRAWING PARAM
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
                SaDrawing_Round3Demo.Draw(corridorState); // SA-DRAWING CALL
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
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, nameof(Round3Demo), true);
        }
    }

    // ===== SA-DRAWING BEGIN (สร้างโดย SA Drawing Studio — แก้ด้วยการวาดในเว็บ อย่าแก้ช่วงนี้ด้วยมือ) =====
    // sa-spec: {"version":1,"className":"Round3Demo","namespace":"TestSubassembly","params":[{"name":"Side","kind":"long","default":0,"displayName":"Side"},{"name":"W","kind":"double","default":3,"displayName":"ความกว้างบน","min":1,"max":null},{"name":"D","kind":"double","default":1.5,"displayName":"ความลึก","min":0.5,"max":null},{"name":"FilletR","kind":"double","default":0.4,"displayName":"รัศมี Fillet มุมบน","min":null,"max":null},{"name":"DitchR","kind":"double","default":1.2,"displayName":"รัศมีราง","min":null,"max":null},{"name":"PolyR","kind":"double","default":0.5,"displayName":"รัศมี 5 เหลี่ยม","min":null,"max":null},{"name":"PolyTheta","kind":"double","default":0,"displayName":"มุม 5 เหลี่ยม","min":null,"max":null},{"name":"BlockAng","kind":"double","default":15,"displayName":"มุมหมุนบล็อก","min":null,"max":null}],"targets":[],"points":[{"id":"P1","codes":[],"def":{"type":"origin"}},{"id":"P2","codes":[],"def":{"type":"delta","from":"P1","dx":"W","dy":"0"},"auxiliary":true},{"id":"P3","codes":["Toe"],"def":{"type":"slopeLength","from":"P2","slope":"-1/1.5","length":"D","dir":1,"measure":"dy"}},{"id":"P4","codes":["Base"],"def":{"type":"delta","from":"P1","dx":"0","dy":"-D"}},{"id":"P5","codes":[],"def":{"type":"tangent","corner":"P2","toward":"P1","other":"P3","radius":"FilletR"}},{"id":"P6","codes":[],"def":{"type":"tangent","corner":"P2","toward":"P3","other":"P1","radius":"FilletR"}},{"id":"P7","codes":[],"def":{"type":"delta","from":"P1","dx":"W / 2","dy":"0.35"},"auxiliary":true},{"id":"P8","codes":["DitchOut"],"def":{"type":"delta","from":"P3","dx":"1.6","dy":"0"}},{"id":"P9","codes":[],"def":{"type":"delta","from":"P4","dx":"-1.2","dy":"0.6"},"auxiliary":true},{"id":"P10","codes":[],"def":{"type":"polar","from":"P9","length":"PolyR","angle":"PolyTheta + 90"}},{"id":"P11","codes":[],"def":{"type":"polar","from":"P9","length":"PolyR","angle":"PolyTheta + 162"}},{"id":"P12","codes":[],"def":{"type":"polar","from":"P9","length":"PolyR","angle":"PolyTheta + 234"}},{"id":"P13","codes":[],"def":{"type":"polar","from":"P9","length":"PolyR","angle":"PolyTheta + 306"}},{"id":"P14","codes":[],"def":{"type":"polar","from":"P9","length":"PolyR","angle":"PolyTheta + 378"}},{"id":"P15","codes":["BlockA"],"def":{"type":"delta","from":"P8","dx":"0.4","dy":"0"}},{"id":"P16","codes":["BlockB"],"def":{"type":"delta","from":"P15","dx":"1","dy":"0"}},{"id":"P17","codes":["BlockC"],"def":{"type":"delta","from":"P16","dx":"0","dy":"0.5"}},{"id":"P18","codes":["BlockD"],"def":{"type":"delta","from":"P15","dx":"0","dy":"0.5"}},{"id":"P19","codes":[],"def":{"type":"between","a":"P1","b":"P5","t":"0.5"},"auxiliary":true},{"id":"P20","codes":["TrackMark"],"def":{"type":"delta","from":"P19","dx":"0","dy":"-0.3"}},{"id":"P21","codes":["AuxCross"],"def":{"type":"intersect","a1":"P1","a2":"P3","b1":"P6","b2":"P4"}},{"id":"P22","codes":["AuxCrossDown"],"def":{"type":"delta","from":"P21","dx":"0","dy":"-0.4"}},{"id":"P23","codes":[],"def":{"type":"delta","from":"P4","dx":"0","dy":"-0.5"},"auxiliary":true},{"id":"P24","codes":[],"def":{"type":"delta","from":"P3","dx":"0","dy":"-0.5"},"auxiliary":true},{"id":"P25","codes":[],"def":{"type":"between","a":"P23","b":"P24","t":"0.5"},"auxiliary":true},{"id":"P26","codes":[],"def":{"type":"delta","from":"P25","dx":"0","dy":"-0.4"},"auxiliary":true},{"id":"P27","codes":["UnderArc"],"def":{"type":"delta","from":"P26","dx":"0","dy":"-0.2"}}],"links":[{"id":"L1","points":["P1","P5"],"codes":["Top"]},{"id":"L5","type":"fillet","from":"P5","to":"P6","corner":"P2","radius":"FilletR","codes":[]},{"id":"L2","points":["P6","P3"],"codes":["Side"]},{"id":"L3","points":["P3","P4"],"codes":["Datum"]},{"id":"L4","points":["P4","P1"],"codes":["Datum"]},{"id":"L6","type":"arc3","from":"P1","via":"P7","to":"P5","codes":["Crown"]},{"id":"L7","type":"arcR","from":"P3","to":"P8","radius":"DitchR","sweep":"ccw","large":false,"codes":["Ditch"]},{"id":"L8","points":["P10","P11"],"codes":["Pentagon"]},{"id":"L9","points":["P11","P12"],"codes":["Pentagon"]},{"id":"L10","points":["P12","P13"],"codes":["Pentagon"]},{"id":"L11","points":["P13","P14"],"codes":["Pentagon"]},{"id":"L12","points":["P14","P10"],"codes":["Pentagon"]},{"id":"L13","points":["P15","P16"],"codes":["Block"]},{"id":"L14","points":["P16","P17"],"codes":["Block"]},{"id":"L15","points":["P17","P18"],"codes":["Block"]},{"id":"L16","points":["P18","P15"],"codes":["Block"]},{"id":"L17","points":["P1","P3"],"codes":["AuxDiag"],"auxiliary":true},{"id":"L18","points":["P6","P4"],"codes":["AuxDiag"],"auxiliary":true},{"id":"L19","points":["P21","P22"],"codes":["Stem"]},{"id":"L20","type":"arc3","from":"P23","via":"P26","to":"P24","codes":[],"auxiliary":true}],"shapes":[{"id":"S1","links":["L1","L5","L2","L3","L4"],"codes":["Body"]},{"id":"S2","links":["L8","L9","L10","L11","L12"],"codes":["Pentagon"]},{"id":"S3","links":["L13","L14","L15","L16"],"codes":["Block"]}],"side":{"param":"Side","mirror":true},"polygons":[{"id":"G1","center":"P9","n":5,"radius":"PolyR","angle":"PolyTheta","mode":"inscribed","points":["P10","P11","P12","P13","P14"],"links":["L8","L9","L10","L11","L12"],"shape":"S2"}],"rotations":[{"id":"R1","pivot":"P15","angle":"BlockAng","points":["P16","P17","P18"]}]}
    internal static class SaDrawing_Round3Demo
    {
        private const string Source = "Round3Demo";
        private const double Deg = Math.PI / 180.0;

        // GetLogicalNames: target ที่ส่วนที่วาดใช้
        internal static void AddTargets(CorridorState cs)
        {
        }

        // GetInputParameters: parameter ของส่วนที่วาด
        internal static void AddParams(CorridorState cs)
        {
            cs.ParamsLong.Add("Side", 0).DisplayName = "Side";
            cs.ParamsDouble.Add("W", 3.0).DisplayName = "ความกว้างบน";
            cs.ParamsDouble.Add("D", 1.5).DisplayName = "ความลึก";
            cs.ParamsDouble.Add("FilletR", 0.4).DisplayName = "รัศมี Fillet มุมบน";
            cs.ParamsDouble.Add("DitchR", 1.2).DisplayName = "รัศมีราง";
            cs.ParamsDouble.Add("PolyR", 0.5).DisplayName = "รัศมี 5 เหลี่ยม";
            cs.ParamsDouble.Add("PolyTheta", 0.0).DisplayName = "มุม 5 เหลี่ยม";
            cs.ParamsDouble.Add("BlockAng", 15.0).DisplayName = "มุมหมุนบล็อก";
        }

        internal static void Draw(CorridorState cs)
        {
            // ---- parameter (นอกขอบเขต = ใช้ค่าขอบแทน + เตือน) ----
            long Side = GetLong(cs, "Side", 0);
            double W = GetDouble(cs, "W", 3.0);
            if (W < 1.0) { Warn(cs, CorridorError.ValueTooSmall, "W = " + W + " < 1, ใช้ 1 แทน"); W = 1.0; }
            double D = GetDouble(cs, "D", 1.5);
            if (D < 0.5) { Warn(cs, CorridorError.ValueTooSmall, "D = " + D + " < 0.5, ใช้ 0.5 แทน"); D = 0.5; }
            double FilletR = GetDouble(cs, "FilletR", 0.4);
            double DitchR = GetDouble(cs, "DitchR", 1.2);
            double PolyR = GetDouble(cs, "PolyR", 0.5);
            double PolyTheta = GetDouble(cs, "PolyTheta", 0.0);
            double BlockAng = GetDouble(cs, "BlockAng", 15.0);
            double F = Side == 1 ? -1.0 : 1.0;   // Side = 1 (Left) -> กลับด้านแนวราบทั้งหมด

            // ---- พิกัดของจุด (เทียบ origin; null = หาจุดนี้ไม่ได้ ส่วนที่พึ่งจุดนี้จะถูกข้าม) ----
            Pt? P1 = Pt.Origin;   // P1 origin
            Pt? P2 = Delta(cs, "P2", P1, F * W, 0.0);   // P2 ห่างจาก P1
            Pt? P3 = SlopeLength(cs, "P3", P2, -1.0 / 1.5, D, F, Measure.Dy);   // P3 ลาด + ความยาว จาก P2
            Pt? P4 = Delta(cs, "P4", P1, F * 0.0, -D);   // P4 ห่างจาก P1
            Pt? P5 = Tangent(cs, "P5", P2, P1, P3, FilletR);   // P5 จุดสัมผัสของ Fillet ที่มุม P2
            Pt? P6 = Tangent(cs, "P6", P2, P3, P1, FilletR);   // P6 จุดสัมผัสของ Fillet ที่มุม P2
            Pt? P7 = Delta(cs, "P7", P1, F * W / 2.0, 0.35);   // P7 ห่างจาก P1
            Pt? P8 = Delta(cs, "P8", P3, F * 1.6, 0.0);   // P8 ห่างจาก P3
            Pt? P9 = Delta(cs, "P9", P4, F * -1.2, 0.6);   // P9 ห่างจาก P4
            Pt? P10 = Polar(cs, "P10", P9, PolyR, PolyTheta + 90.0, F);   // P10 ระยะ + มุม จาก P9
            Pt? P11 = Polar(cs, "P11", P9, PolyR, PolyTheta + 162.0, F);   // P11 ระยะ + มุม จาก P9
            Pt? P12 = Polar(cs, "P12", P9, PolyR, PolyTheta + 234.0, F);   // P12 ระยะ + มุม จาก P9
            Pt? P13 = Polar(cs, "P13", P9, PolyR, PolyTheta + 306.0, F);   // P13 ระยะ + มุม จาก P9
            Pt? P14 = Polar(cs, "P14", P9, PolyR, PolyTheta + 378.0, F);   // P14 ระยะ + มุม จาก P9
            Pt? P15 = Delta(cs, "P15", P8, F * 0.4, 0.0);   // P15 ห่างจาก P8
            Pt? P16 = Delta(cs, "P16", P15, F * 1.0, 0.0);   // P16 ห่างจาก P15
            Pt? P17 = Delta(cs, "P17", P16, F * 0.0, 0.5);   // P17 ห่างจาก P16
            Pt? P18 = Delta(cs, "P18", P15, F * 0.0, 0.5);   // P18 ห่างจาก P15
            Pt? P19 = Between(cs, "P19", P1, P5, 0.5);   // P19 บนเส้น P1-P5
            Pt? P20 = Delta(cs, "P20", P19, F * 0.0, -0.3);   // P20 ห่างจาก P19
            Pt? P21 = Intersect(cs, "P21", P1, P3, P6, P4);   // P21 จุดตัด P1-P3 กับ P6-P4
            Pt? P22 = Delta(cs, "P22", P21, F * 0.0, -0.4);   // P22 ห่างจาก P21
            Pt? P23 = Delta(cs, "P23", P4, F * 0.0, -0.5);   // P23 ห่างจาก P4
            Pt? P24 = Delta(cs, "P24", P3, F * 0.0, -0.5);   // P24 ห่างจาก P3
            Pt? P25 = Between(cs, "P25", P23, P24, 0.5);   // P25 บนเส้น P23-P24
            Pt? P26 = Delta(cs, "P26", P25, F * 0.0, -0.4);   // P26 ห่างจาก P25
            Pt? P27 = Delta(cs, "P27", P26, F * 0.0, -0.2);   // P27 ห่างจาก P26
            // กลุ่มหมุน R1: หมุนรอบ P15 มุม BlockAng° (ทวนเข็ม + ในกรอบ Side = Right)
            P16 = Rotate(cs, "P16", P16, P15, F * BlockAng);
            P17 = Rotate(cs, "P17", P17, P15, F * BlockAng);
            P18 = Rotate(cs, "P18", P18, P15, F * BlockAng);

            // ---- เพิ่มจุด / link / shape ลง CorridorState ----
            Point p1 = AddPoint(cs, P1);
            // P2 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            Point p3 = AddPoint(cs, P3, "Toe");
            Point p4 = AddPoint(cs, P4, "Base");
            Point p5 = AddPoint(cs, P5);
            Point p6 = AddPoint(cs, P6);
            // P7 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            Point p8 = AddPoint(cs, P8, "DitchOut");
            // P9 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            Point p10 = AddPoint(cs, P10);
            Point p11 = AddPoint(cs, P11);
            Point p12 = AddPoint(cs, P12);
            Point p13 = AddPoint(cs, P13);
            Point p14 = AddPoint(cs, P14);
            Point p15 = AddPoint(cs, P15, "BlockA");
            Point p16 = AddPoint(cs, P16, "BlockB");
            Point p17 = AddPoint(cs, P17, "BlockC");
            Point p18 = AddPoint(cs, P18, "BlockD");
            // P19 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            Point p20 = AddPoint(cs, P20, "TrackMark");
            Point p21 = AddPoint(cs, P21, "AuxCross");
            Point p22 = AddPoint(cs, P22, "AuxCrossDown");
            // P23 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            // P24 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            // P25 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            // P26 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            Point p27 = AddPoint(cs, P27, "UnderArc");
            Link l1 = AddLink(cs, "L1", p1, p5, "Top");
            Link[] l5 = Fillet(cs, "L5", P5, p5, P2, P6, p6, FilletR, Seg.Chord, 0.05);   // L5 Fillet ที่มุม P2
            Link l2 = AddLink(cs, "L2", p6, p3, "Side");
            Link l3 = AddLink(cs, "L3", p3, p4, "Datum");
            Link l4 = AddLink(cs, "L4", p4, p1, "Datum");
            Link[] l6 = Arc3(cs, "L6", P1, p1, P7, P5, p5, Seg.Chord, 0.05, "Crown");   // L6 โค้งผ่าน P1 P7 P5
            Link[] l7 = ArcR(cs, "L7", P3, p3, P8, p8, DitchR, true, false, F, Seg.Chord, 0.05, "Ditch");   // L7 โค้งรัศมี ทวนเข็ม (กรอบ Side = Right)
            Link l8 = AddLink(cs, "L8", p10, p11, "Pentagon");
            Link l9 = AddLink(cs, "L9", p11, p12, "Pentagon");
            Link l10 = AddLink(cs, "L10", p12, p13, "Pentagon");
            Link l11 = AddLink(cs, "L11", p13, p14, "Pentagon");
            Link l12 = AddLink(cs, "L12", p14, p10, "Pentagon");
            Link l13 = AddLink(cs, "L13", p15, p16, "Block");
            Link l14 = AddLink(cs, "L14", p16, p17, "Block");
            Link l15 = AddLink(cs, "L15", p17, p18, "Block");
            Link l16 = AddLink(cs, "L16", p18, p15, "Block");
            // L17 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D
            // L18 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D
            Link l19 = AddLink(cs, "L19", p21, p22, "Stem");
            // L20 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D
            AddShape(cs, "S1", Join(new[] { l1 }, l5, new[] { l2 }, new[] { l3 }, new[] { l4 }), "Body");
            AddShape(cs, "S2", new[] { l8, l9, l10, l11, l12 }, "Pentagon");
            AddShape(cs, "S3", new[] { l13, l14, l15, l16 }, "Block");
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
