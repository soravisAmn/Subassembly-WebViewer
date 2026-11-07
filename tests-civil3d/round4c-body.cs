// round4c-body.cs — subassembly ที่สร้างจาก SA Drawing Studio
//
// รูปตัดวาดในเว็บ: โค้ดในช่วง SA-DRAWING สร้างจากการวาด (เปิดไฟล์นี้ในเว็บแล้ววาดต่อได้ อย่าแก้ช่วงนั้นด้วยมือ)
// โค้ดนอกช่วงนั้นแก้เองได้ เว็บจะไม่แตะ
//
// Parameter:
//   Side (long, default 0)
//   Height (double, default 5)
//   FaceSlope (double, default 2.5) — Face Slope (1:x)
//   RockThickness (double, default 0.5) — Rock Thickness
//   MinSoilThickness (double, default 1, ไม่น้อยกว่า 1) — Min Soil Thickness
//   EndSlope (double, default 1.5) — End Slope (1:x)

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
    public class Round4cBody
    {
        // ------------------------------------------------------------------
        // Civil 3D เรียก 4 เมธอดนี้ผ่าน .atc (ต้องเป็น public, ไม่มีพารามิเตอร์)

        public void GetLogicalNames()
        {
            CorridorState corridorState = null;
            try
            {
                corridorState = CivilApplication.ActiveDocument.CorridorState;
                SaDrawing_Round4cBody.AddTargets(corridorState); // SA-DRAWING TARGET
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
                SaDrawing_Round4cBody.AddParams(corridorState); // SA-DRAWING PARAM
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
                SaDrawing_Round4cBody.Draw(corridorState); // SA-DRAWING CALL
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
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, nameof(Round4cBody), true);
        }
    }

    // ===== SA-DRAWING BEGIN (สร้างโดย SA Drawing Studio — แก้ด้วยการวาดในเว็บ อย่าแก้ช่วงนี้ด้วยมือ) =====
    // sa-spec: {"version":1,"className":"Round4cBody","namespace":"TestSubassembly","params":[{"name":"Side","kind":"long","default":0,"displayName":"Side","min":null,"max":null},{"name":"Height","kind":"double","default":5,"displayName":"Height","min":null,"max":null,"positive":true},{"name":"FaceSlope","kind":"double","default":2.5,"displayName":"Face Slope (1:x)","min":null,"max":null,"positive":true},{"name":"RockThickness","kind":"double","default":0.5,"displayName":"Rock Thickness","min":null,"max":null,"positive":true},{"name":"MinSoilThickness","kind":"double","default":1,"displayName":"Min Soil Thickness","min":1,"max":null},{"name":"EndSlope","kind":"double","default":1.5,"displayName":"End Slope (1:x)","min":null,"max":null,"positive":true}],"targets":[{"name":"TargetSurface","type":"Surface","displayName":"Target Surface"}],"points":[{"id":"P1","codes":["RockTopInside"],"def":{"type":"origin"}},{"id":"P2","codes":["RockTopOutside"],"def":{"type":"delta","from":"P1","dx":"FaceSlope * Height","dy":"-Height"}},{"id":"P3","codes":[],"def":{"type":"offset","a":"P1","b":"P2","end":"a","dist":"RockThickness","side":-1},"auxiliary":true},{"id":"P4","codes":[],"def":{"type":"offset","a":"P1","b":"P2","end":"b","dist":"RockThickness","side":-1},"auxiliary":true},{"id":"P5","codes":[],"def":{"type":"offset","a":"P1","b":"P2","end":"a","dist":"RockThickness + MinSoilThickness","side":-1},"auxiliary":true},{"id":"P6","codes":[],"def":{"type":"offset","a":"P1","b":"P2","end":"b","dist":"RockThickness + MinSoilThickness","side":-1},"auxiliary":true},{"id":"P7","codes":[],"def":{"type":"delta","from":"P2","dx":"-EndSlope","dy":"-1"},"auxiliary":true},{"id":"P8","codes":[],"def":{"type":"delta","from":"P1","dx":"0","dy":"-1"},"auxiliary":true},{"id":"P9","codes":["RockBaseOutside"],"def":{"type":"intersect","a1":"P3","a2":"P4","b1":"P2","b2":"P7"}},{"id":"P10","codes":["RockBaseInside"],"def":{"type":"intersect","a1":"P3","a2":"P4","b1":"P1","b2":"P8"}},{"id":"P11","codes":[],"def":{"type":"intersect","a1":"P5","a2":"P6","b1":"P2","b2":"P7"},"auxiliary":true},{"id":"P12","codes":[],"def":{"type":"intersect","a1":"P5","a2":"P6","b1":"P1","b2":"P8"},"auxiliary":true},{"id":"P13","codes":[],"def":{"type":"extendToGround","from":"P11","along":"P2","target":"TargetSurface","maxDistance":"P11.x"},"auxiliary":true},{"id":"P14","codes":["SoilToe"],"def":{"type":"firstOf","points":["P13","P11"]}},{"id":"P15","codes":["SoilBaseInside"],"def":{"type":"delta","from":"P1","dx":"0","dy":"min(ground(P1), P12.y)"}}],"links":[{"id":"L1","points":["P1","P2"],"codes":["Top","RockFace"]},{"id":"L2","points":["P3","P4"],"auxiliary":true,"codes":[]},{"id":"L3","points":["P5","P6"],"auxiliary":true,"codes":[]},{"id":"L4","points":["P2","P7"],"auxiliary":true,"codes":[]},{"id":"L5","points":["P1","P8"],"auxiliary":true,"codes":[]},{"id":"L6","points":["P2","P11"],"auxiliary":true,"codes":[]},{"id":"L7","points":["P11","P13"],"codes":[],"optional":true,"auxiliary":true},{"id":"L8","points":["P2","P9"],"codes":["Top","RockEnd"]},{"id":"L9","points":["P9","P10"],"codes":["RockBase"]},{"id":"L10","points":["P10","P1"],"codes":["RockBack"]},{"id":"L11","points":["P9","P14"],"codes":["Top","Datum","SoilEnd"]},{"id":"L12","type":"followClipped","from":"P14","to":"P15","target":"TargetSurface","refLink":"L3","side":"below","codes":["Datum"],"codesGround":["SoilOnSurface"],"codesLine":["SoilMinThickness"]},{"id":"L13","points":["P15","P10"],"codes":["SoilBack"]}],"shapes":[{"id":"S1","links":["L1","L8","L9","L10"],"codes":["RockPitching"]},{"id":"S2","links":["L9","L11","L12","L13"],"codes":["CompactedSoil"]}],"side":{"param":"Side","mirror":true}}
    internal static class SaDrawing_Round4cBody
    {
        private const string Source = "Round4cBody";
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
            cs.ParamsDouble.Add("Height", 5.0).DisplayName = "Height";
            cs.ParamsDouble.Add("FaceSlope", 2.5).DisplayName = "Face Slope (1:x)";
            cs.ParamsDouble.Add("RockThickness", 0.5).DisplayName = "Rock Thickness";
            cs.ParamsDouble.Add("MinSoilThickness", 1.0).DisplayName = "Min Soil Thickness";
            cs.ParamsDouble.Add("EndSlope", 1.5).DisplayName = "End Slope (1:x)";
        }

        internal static void Draw(CorridorState cs)
        {
            // ---- parameter (≤ 0 ที่ต้องมากกว่า 0 = error + ใช้ default · นอกขอบเขต = ใช้ค่าขอบแทน + เตือน) ----
            long Side = GetLong(cs, "Side", 0);
            double Height = GetDouble(cs, "Height", 5.0);
            if (Height <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "Height = " + Height + " ต้องมากกว่า 0, ใช้ค่า default 5 แทน"); Height = 5.0; }
            double FaceSlope = GetDouble(cs, "FaceSlope", 2.5);
            if (FaceSlope <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "FaceSlope = " + FaceSlope + " ต้องมากกว่า 0, ใช้ค่า default 2.5 แทน"); FaceSlope = 2.5; }
            double RockThickness = GetDouble(cs, "RockThickness", 0.5);
            if (RockThickness <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "RockThickness = " + RockThickness + " ต้องมากกว่า 0, ใช้ค่า default 0.5 แทน"); RockThickness = 0.5; }
            double MinSoilThickness = GetDouble(cs, "MinSoilThickness", 1.0);
            if (MinSoilThickness < 1.0) { Warn(cs, CorridorError.ValueTooSmall, "MinSoilThickness = " + MinSoilThickness + " < 1, ใช้ 1 แทน"); MinSoilThickness = 1.0; }
            double EndSlope = GetDouble(cs, "EndSlope", 1.5);
            if (EndSlope <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "EndSlope = " + EndSlope + " ต้องมากกว่า 0, ใช้ค่า default 1.5 แทน"); EndSlope = 1.5; }
            double F = Side == 1 ? -1.0 : 1.0;   // Side = 1 (Left) -> กลับด้านแนวราบทั้งหมด

            // ---- target surface (Layout mode / ไม่ได้กำหนด = วาดแบบไม่มีดิน) ----
            ObjectId surface = TargetSurface(cs, "TargetSurface");

            // ---- พิกัดของจุด (เทียบ origin; null = หาจุดนี้ไม่ได้ ส่วนที่พึ่งจุดนี้จะถูกข้าม) ----
            Pt? P1 = Pt.Origin;   // P1 origin
            Pt? P2 = Delta(cs, "P2", P1, F * FaceSlope * Height, -Height);   // P2 ห่างจาก P1
            Pt? P3 = Offset(cs, "P3", P1, P2, P1, F * -1.0 * RockThickness);   // P3 offset ปลาย P1 ของเส้น P1-P2 ไปทางขวาของทิศ P1→P2
            Pt? P4 = Offset(cs, "P4", P1, P2, P2, F * -1.0 * RockThickness);   // P4 offset ปลาย P2 ของเส้น P1-P2 ไปทางขวาของทิศ P1→P2
            Pt? P5 = Offset(cs, "P5", P1, P2, P1, F * -1.0 * (RockThickness + MinSoilThickness));   // P5 offset ปลาย P1 ของเส้น P1-P2 ไปทางขวาของทิศ P1→P2
            Pt? P6 = Offset(cs, "P6", P1, P2, P2, F * -1.0 * (RockThickness + MinSoilThickness));   // P6 offset ปลาย P2 ของเส้น P1-P2 ไปทางขวาของทิศ P1→P2
            Pt? P7 = Delta(cs, "P7", P2, F * -EndSlope, -1.0);   // P7 ห่างจาก P2
            Pt? P8 = Delta(cs, "P8", P1, F * 0.0, -1.0);   // P8 ห่างจาก P1
            Pt? P9 = Intersect(cs, "P9", P3, P4, P2, P7);   // P9 จุดตัด P3-P4 กับ P2-P7
            Pt? P10 = Intersect(cs, "P10", P3, P4, P1, P8);   // P10 จุดตัด P3-P4 กับ P1-P8
            Pt? P11 = Intersect(cs, "P11", P5, P6, P2, P7);   // P11 จุดตัด P5-P6 กับ P2-P7
            Pt? P12 = Intersect(cs, "P12", P5, P6, P1, P8);   // P12 จุดตัด P5-P6 กับ P1-P8
            Pt? P13 = Try(cs, "P13", () => ExtendToGround(cs, "P13", surface, P11, P2, F * PX(P11)));   // P13 ต่อเส้น P2→P11 ลงถึงดิน (ไม่ลอย / ไม่มีดิน = ไม่เกิด)
            Pt? P14 = FirstOf(cs, "P14", P13, P11);   // P14 จุดแรกที่เกิดใน P13, P11
            Pt? P15 = Try(cs, "P15", () => Delta(cs, "P15", P1, F * 0.0, Math.Min(Ground(cs, surface, P1), PY(P12))));   // P15 ห่างจาก P1

            // ---- เพิ่มจุด / link / shape ลง CorridorState ----
            Point p1 = AddPoint(cs, P1, "RockTopInside");
            Point p2 = AddPoint(cs, P2, "RockTopOutside");
            // P3 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            // P4 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            // P5 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            // P6 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            // P7 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            // P8 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            Point p9 = AddPoint(cs, P9, "RockBaseOutside");
            Point p10 = AddPoint(cs, P10, "RockBaseInside");
            // P11 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            // P12 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            // P13 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            Point p14 = AddPoint(cs, P14, "SoilToe");
            Point p15 = AddPoint(cs, P15, "SoilBaseInside");
            Link l1 = AddLink(cs, "L1", p1, p2, "Top", "RockFace");
            // L2 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D
            // L3 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D
            // L4 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D
            // L5 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D
            // L6 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D
            // L7 auxiliary: ใช้อ้างอิงอย่างเดียว ไม่เพิ่มลง Civil 3D
            Link l8 = AddLink(cs, "L8", p2, p9, "Top", "RockEnd");
            Link l9 = AddLink(cs, "L9", p9, p10, "RockBase");
            Link l10 = AddLink(cs, "L10", p10, p1, "RockBack");
            Link l11 = AddLink(cs, "L11", p9, p14, "Top", "Datum", "SoilEnd");
            Link[] l12 = FollowClipped(cs, "L12", surface, P14, p14, P15, p15, P5, P6, true, new[] { "Datum" }, new[] { "SoilOnSurface" }, new[] { "SoilMinThickness" });   // L12 ตามดิน ไม่สูงกว่าเส้น L3
            Link l13 = AddLink(cs, "L13", p15, p10, "SoilBack");
            AddShape(cs, "S1", new[] { l1, l8, l9, l10 }, "RockPitching");
            AddShape(cs, "S2", Join(new[] { l9 }, new[] { l11 }, l12, new[] { l13 }), "CompactedSoil");
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

        // Offset: จุด e (ปลายของเส้น a→b) เลื่อนตั้งฉากไป k (+ = ซ้ายของทิศ a→b บนจอจริง — ตัวเรียกคูณ F ให้แล้ว) — เส้นขนาน
        private static Pt? Offset(CorridorState cs, string id, Pt? a, Pt? b, Pt? e, double k)
        {
            if (a == null || b == null || e == null) return null;
            double dx = b.Value.X - a.Value.X, dy = b.Value.Y - a.Value.Y, n = Math.Sqrt(dx * dx + dy * dy);
            if (n < 1e-9) { Warn(cs, CorridorError.Failure, id + ": เส้นยาวเป็นศูนย์ หาทิศ offset ไม่ได้"); return null; }
            return Check(cs, id, new Pt(e.Value.X - dy * k / n, e.Value.Y + dx * k / n));
        }

        // Extend to Surface: ต่อเส้น along→from เลย from ออกไป (ทิศเดิม) จนชนดิน — เฉพาะเมื่อปลาย from ลอยเหนือดิน
        //   ไม่ลอย / ไม่มีดิน (Layout / ไม่มี target) = null เงียบๆ (link / shape ที่ใช้ = ไม่เกิด) · ไม่ชนดินภายใน maxDistance (ระยะราบ) = เตือน + null
        private static Pt? ExtendToGround(CorridorState cs, string id, ObjectId surface, Pt? from, Pt? along, double maxDistance)
        {
            if (from == null || along == null || surface.IsNull) return null;
            Pt f = from.Value;
            double gy;
            try
            {
                gy = Elevation(cs, surface, cs.CurrentOffset + f.X) - cs.CurrentElevation;
            }
            catch (Exception e)
            {
                Warn(cs, CorridorError.Failure, id + " ต่อลงถึงดิน: " + e.Message);
                return null;
            }
            if (!(gy < f.Y - 1e-9)) return null;
            double dx = f.X - along.Value.X, dy = f.Y - along.Value.Y;
            if (Math.Abs(dx) < 1e-12 && Math.Abs(dy) < 1e-12) { Warn(cs, CorridorError.Failure, id + " ต่อลงถึงดิน: เส้นยาวเป็นศูนย์"); return null; }
            Pt? hit = null;
            if (Math.Abs(dx) < 1e-12)
            {
                if (dy < 0) hit = new Pt(f.X, gy);
            }
            else
            {
                try
                {
                    IPoint h = cs.IntersectSurface(surface, cs.CurrentAlignmentId, Abs(cs, f), dx > 0, dy / Math.Abs(dx));
                    if (h != null) hit = new Pt(h.Offset - cs.CurrentOffset, h.Elevation - cs.CurrentElevation);
                }
                catch
                {
                    hit = null;
                }
            }
            if (hit == null || Math.Abs(hit.Value.X - f.X) > maxDistance + 1e-9)
            {
                Warn(cs, CorridorError.NoSideslopeIntersectFound, id + " ต่อลงถึงดิน: ไม่ชนผิวดินภายใน " + maxDistance + " m");
                return null;
            }
            return Check(cs, id, hit.Value);
        }

        // Clipped Surface Link: ตามผิวดินจาก a ถึง b แต่ไม่สูงกว่า (below) / ไม่ต่ำกว่า เส้นอ้างอิง r1–r2 (ต่อออกไปได้)
        //   แบบ BuildBottom ของ base_rock-pitching.cs — ตรงกับ clipPath ใน wwwroot/js/spec.js
        //   ช่วงที่ปลายทั้งสองอยู่บนเส้น = codes + codesLine · นอกนั้น = codes + codesGround · ไม่มีดิน / เส้นอ้างอิงแนวดิ่ง = เส้นตรง + codesLine
        private static Link[] FollowClipped(CorridorState cs, string id, ObjectId surface, Pt? pa, Point a, Pt? pb, Point b, Pt? r1, Pt? r2, bool below,
                                            string[] codes, string[] codesGround, string[] codesLine)
        {
            if (a == null || b == null || r1 == null || r2 == null) return null;
            Pt A = pa.Value, B = pb.Value, R1 = r1.Value, R2 = r2.Value;
            var lineCodes = new List<string>(codes); lineCodes.AddRange(codesLine);
            var gndCodes = new List<string>(codes); gndCodes.AddRange(codesGround);
            var path = new List<Pt> { A, B };
            bool clipped = false;
            Func<double, double> line = x => R1.Y + (R2.Y - R1.Y) * (x - R1.X) / (R2.X - R1.X);
            string fail = null;
            if (Math.Abs(R2.X - R1.X) < 1e-9) fail = "เส้นอ้างอิงเป็นแนวดิ่ง";
            else if (surface.IsNull)
            {
                if (cs.Mode != CorridorMode.Layout) fail = "ไม่ได้กำหนด Target Surface";
            }
            else
            {
                try
                {
                    // ผิวดิน: ปลายทั้งสอง + จุดหักระหว่างทาง (แบบ FollowSurface)
                    var prof = new List<(double X, double Y)> { (A.X, Elevation(cs, surface, cs.CurrentOffset + A.X) - cs.CurrentElevation) };
                    double lo = Math.Min(A.X, B.X), hi = Math.Max(A.X, B.X);
                    var mids = new List<(double X, double Y)>();
                    SampledSectionLinkCollection sampled = cs.SampleSection(surface, cs.CurrentAlignmentId, Abs(cs, A), Abs(cs, B));
                    foreach (SampledSectionLink s in sampled)
                    {
                        double x = s.EndPointOffset - cs.CurrentOffset;
                        if (x > lo + 1e-9 && x < hi - 1e-9)
                            mids.Add((x, s.EndPointElevation - cs.CurrentElevation));
                    }
                    mids.Sort((p, q) => p.X.CompareTo(q.X));
                    if (A.X > B.X) mids.Reverse();
                    prof.AddRange(mids);
                    prof.Add((B.X, Elevation(cs, surface, cs.CurrentOffset + B.X) - cs.CurrentElevation));

                    Func<double, double, double> clip = (x, y) => below ? Math.Min(y, line(x)) : Math.Max(y, line(x));
                    var raw = new List<Pt> { new Pt(prof[0].X, clip(prof[0].X, prof[0].Y)) };
                    for (int i = 0; i < prof.Count - 1; i++)
                    {
                        var p = prof[i];
                        var q = prof[i + 1];
                        double da = p.Y - line(p.X), db = q.Y - line(q.X);
                        if (da * db < 0)
                        {
                            double t = da / (da - db), x = p.X + t * (q.X - p.X);
                            raw.Add(new Pt(x, line(x)));
                        }
                        raw.Add(new Pt(q.X, clip(q.X, q.Y)));
                    }
                    // ตัดจุดซ้ำ (ระยะราบ < 0.0001) และจุดกลางของช่วงที่อยู่บนเส้น
                    var c = new List<Pt>();
                    foreach (Pt p in raw)
                    {
                        if (c.Count > 0 && Math.Abs(p.X - c[c.Count - 1].X) < 1e-4) continue;
                        if (c.Count >= 2 && Math.Abs(p.Y - line(p.X)) < 1e-4 && Math.Abs(c[c.Count - 1].Y - line(c[c.Count - 1].X)) < 1e-4
                            && Math.Abs(c[c.Count - 2].Y - line(c[c.Count - 2].X)) < 1e-4)
                        {
                            c[c.Count - 1] = p;
                            continue;
                        }
                        c.Add(p);
                    }
                    if (c.Count >= 2)
                    {
                        path = new List<Pt> { A };
                        for (int i = 1; i < c.Count - 1; i++) path.Add(c[i]);
                        path.Add(B);
                    }
                    clipped = true;
                }
                catch (Exception e)
                {
                    fail = e.Message;
                }
            }
            if (fail != null) Warn(cs, CorridorError.Failure, id + " ตามดิน ไม่เกินเส้น: " + fail + " — ใช้เส้นตรงแทน");
            var pts = new Point[path.Count];
            pts[0] = a;
            pts[path.Count - 1] = b;
            for (int i = 1; i < path.Count - 1; i++) pts[i] = cs.Points.Add(path[i].X, path[i].Y, "");
            var links = new Link[path.Count - 1];
            for (int i = 0; i < links.Length; i++)
            {
                links[i] = cs.Links.Add(new[] { pts[i], pts[i + 1] }, "");
                bool on = clipped && Math.Abs(path[i].Y - line(path[i].X)) < 1e-4 && Math.Abs(path[i + 1].Y - line(path[i + 1].X)) < 1e-4;
                foreach (string code in (on || !clipped ? lineCodes : gndCodes))
                    links[i].Codes.TryAdd(code);
            }
            return links;
        }

        // link optional ใน shape (ต่อลงถึงดิน): ไม่เกิด / วาดไม่ได้ (null) = ข้ามไป
        private static Link[] Opt(Link l) => l == null ? new Link[0] : new[] { l };
        private static Link[] Opt(Link[] l) => l ?? new Link[0];

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

        // error ระดับ Severe (parameter ≤ 0 ที่ต้องมากกว่า 0 — แบบ RecordError ใน base_rock-pitching.cs)
        private static void Severe(CorridorState cs, CorridorError error, string message)
        {
            cs.RecordError(error, CorridorErrorLevel.Severe, message, Source, true);
        }
    }

    // ===== SA-DRAWING END =====
}
