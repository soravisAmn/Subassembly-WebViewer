// round5-demo.cs — subassembly ที่สร้างจาก SA Drawing Studio
//
// รูปตัดวาดในเว็บ: โค้ดในช่วง SA-DRAWING สร้างจากการวาด (เปิดไฟล์นี้ในเว็บแล้ววาดต่อได้ อย่าแก้ช่วงนั้นด้วยมือ)
// โค้ดนอกช่วงนั้นแก้เองได้ เว็บจะไม่แตะ
//
// Parameter:
//   Side (long, default 0)
//   Width (double, default 4 m, ไม่น้อยกว่า 1 m) — Crest Width
//   ProtectionType (long, default 1) — Protection (1 หินเรียง · 2 คอนกรีต · อื่นๆ ไม่มี)
//   RockT (double, default 0.5 m) — Rock Thickness
//   ConcT (double, default 0.2 m) — Concrete Thickness
//   Depth (double, default 2.5 m) — Key Depth
//   KeyW (double, default 1 m) — Key Width
//   BermH (double, default 3 m) — Berm Height
//   BermW (double, default 2 m) — Berm Width
//   CutSlope (double, default 1:1.5) — Cut Slope (1:x)
//   FillSlope (double, default 1:2) — Fill Slope (1:x)

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
    public class Round5Demo
    {
        // ------------------------------------------------------------------
        // Civil 3D เรียก 4 เมธอดนี้ผ่าน .atc (ต้องเป็น public, ไม่มีพารามิเตอร์)

        public void GetLogicalNames()
        {
            CorridorState corridorState = null;
            try
            {
                corridorState = CivilApplication.ActiveDocument.CorridorState;
                SaDrawing_Round5Demo.AddTargets(corridorState); // SA-DRAWING TARGET
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
                SaDrawing_Round5Demo.AddParams(corridorState); // SA-DRAWING PARAM
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
                SaDrawing_Round5Demo.Draw(corridorState); // SA-DRAWING CALL
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
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, nameof(Round5Demo), true);
        }
    }

    // ===== SA-DRAWING BEGIN (สร้างโดย SA Drawing Studio — แก้ด้วยการวาดในเว็บ อย่าแก้ช่วงนี้ด้วยมือ) =====
    // sa-spec: {"version":1,"className":"Round5Demo","namespace":"TestSubassembly","params":[{"name":"Side","kind":"long","default":0,"displayName":"Side","min":null,"max":null},{"name":"Width","kind":"double","default":4,"displayName":"Crest Width","min":1,"max":null,"unit":"length"},{"name":"ProtectionType","kind":"long","default":1,"displayName":"Protection (1 หินเรียง · 2 คอนกรีต · อื่นๆ ไม่มี)","min":null,"max":null},{"name":"RockT","kind":"double","default":0.5,"displayName":"Rock Thickness","min":null,"max":null,"unit":"length","positive":true},{"name":"ConcT","kind":"double","default":0.2,"displayName":"Concrete Thickness","min":null,"max":null,"unit":"length","positive":true},{"name":"Depth","kind":"double","default":2.5,"displayName":"Key Depth","min":null,"max":null,"unit":"length"},{"name":"KeyW","kind":"double","default":1,"displayName":"Key Width","min":null,"max":null,"unit":"length","positive":true},{"name":"BermH","kind":"double","default":3,"displayName":"Berm Height","min":null,"max":null,"unit":"length","positive":true},{"name":"BermW","kind":"double","default":2,"displayName":"Berm Width","min":null,"max":null,"unit":"length","positive":true},{"name":"CutSlope","kind":"double","default":1.5,"displayName":"Cut Slope (1:x)","min":null,"max":null,"unit":"slope","positive":true},{"name":"FillSlope","kind":"double","default":2,"displayName":"Fill Slope (1:x)","min":null,"max":null,"unit":"slope","positive":true}],"targets":[{"name":"TargetSurface","type":"Surface","displayName":"Target Surface"}],"points":[{"id":"P1","codes":["CrestInside"],"def":{"type":"origin"}},{"id":"P2","codes":["CrestOutside"],"def":{"type":"delta","from":"P1","dx":"Width","dy":"0"}},{"id":"P3","codes":["Daylight_Cut"],"def":{"type":"slopeToSurface","from":"P2","slope":"1/CutSlope","dir":1,"target":"TargetSurface","maxDistance":"50","layoutLength":"3"},"branch":"B1"},{"id":"P4","codes":["Daylight_Fill"],"def":{"type":"slopeToSurface","from":"P2","slope":"-1/FillSlope","dir":1,"target":"TargetSurface","maxDistance":"50","layoutLength":"3"},"branch":"B4"},{"id":"P5","codes":["Daylight"],"def":{"type":"firstOf","points":["P3","P4","P8"]},"auxiliary":true},{"id":"P6","codes":["BermInside"],"def":{"type":"slopeLength","from":"P2","slope":"-1/FillSlope","length":"BermH","dir":1,"measure":"dy"},"branch":"B3"},{"id":"P7","codes":["BermOutside"],"def":{"type":"delta","from":"P6","dx":"BermW","dy":"0"},"branch":"B3"},{"id":"P8","codes":["Daylight_Fill"],"def":{"type":"slopeToSurface","from":"P7","slope":"-1/FillSlope","dir":1,"target":"TargetSurface","maxDistance":"50","layoutLength":"3"},"branch":"B3"},{"id":"P9","codes":["KeyBottomInside"],"def":{"type":"delta","from":"P1","dx":"0","dy":"-DepthUsed"}},{"id":"P10","codes":["KeyBottomOutside"],"def":{"type":"delta","from":"P9","dx":"KeyW","dy":"0"}},{"id":"P11","codes":["KeyTop"],"def":{"type":"delta","from":"P10","dx":"0","dy":"DepthUsed"}},{"id":"P12","codes":["RockTopInside"],"def":{"type":"delta","from":"P1","dx":"0","dy":"RockT"},"branch":"B5"},{"id":"P13","codes":["RockTopOutside"],"def":{"type":"delta","from":"P2","dx":"0","dy":"RockT"},"branch":"B5"},{"id":"P14","codes":["ConcreteTopInside"],"def":{"type":"delta","from":"P1","dx":"0","dy":"ConcT"},"branch":"B6"},{"id":"P15","codes":["ConcreteTopOutside"],"def":{"type":"delta","from":"P2","dx":"0","dy":"ConcT"},"branch":"B6"}],"links":[{"id":"L1","points":["P1","P2"],"codes":["Top","Crest"]},{"id":"L2","points":["P2","P3"],"codes":["Daylight_Cut"],"branch":"B1"},{"id":"L3","points":["P2","P4"],"codes":["Daylight_Fill"],"branch":"B4"},{"id":"L4","points":["P2","P6"],"codes":["Top","Daylight_Fill"],"branch":"B3"},{"id":"L5","points":["P6","P7"],"codes":["Top","Berm"],"branch":"B3"},{"id":"L6","points":["P7","P8"],"codes":["Top","Daylight_Fill"],"branch":"B3"},{"id":"L7","points":["P1","P9"],"codes":["Key"]},{"id":"L8","points":["P9","P10"],"codes":["Key","KeyBottom"]},{"id":"L9","points":["P10","P11"],"codes":["Key"]},{"id":"L10","points":["P11","P1"],"codes":["Key"]},{"id":"L11","points":["P1","P12"],"codes":["Rock"],"branch":"B5"},{"id":"L12","points":["P12","P13"],"codes":["Top","Rock"],"branch":"B5"},{"id":"L13","points":["P13","P2"],"codes":["Rock"],"branch":"B5"},{"id":"L14","points":["P1","P14"],"codes":["Concrete"],"branch":"B6"},{"id":"L15","points":["P14","P15"],"codes":["Top","Concrete"],"branch":"B6"},{"id":"L16","points":["P15","P2"],"codes":["Concrete"],"branch":"B6"}],"shapes":[{"id":"S1","links":["L7","L8","L9","L10"],"codes":["CoreKey"]},{"id":"S2","links":["L11","L12","L13","L1"],"codes":["Rock"],"branch":"B5"},{"id":"S3","links":["L14","L15","L16","L1"],"codes":["Concrete"],"branch":"B6"}],"side":{"param":"Side","mirror":true},"logic":{"conditions":[{"id":"C1","name":"IsCut","expr":"ground(P2) > P2.y","note":"ผิวดินสูงกว่าบานพับ = ตัด"},{"id":"C2","name":"HighFill","expr":"P2.y - ground(P2) > BermH"}],"decisions":[{"id":"D1","parent":null,"kind":"if","test":"IsCut","label":"ตัดหรือถม?"},{"id":"D2","parent":"B2","kind":"if","test":"HighFill","label":"ถมสูงไหม?"},{"id":"D3","parent":null,"kind":"switch","test":"ProtectionType","label":"ชั้นป้องกัน"}],"branches":[{"id":"B1","decision":"D1","case":true,"label":"ตัด"},{"id":"B2","decision":"D1","case":false,"label":"ถม"},{"id":"B3","decision":"D2","case":true,"label":"ถมสูง (ชานพัก)"},{"id":"B4","decision":"D2","case":false,"label":"ถมปกติ"},{"id":"B5","decision":"D3","case":1,"label":"หินเรียง"},{"id":"B6","decision":"D3","case":2,"label":"คอนกรีต"},{"id":"B7","decision":"D3","case":"else","label":"ไม่มีชั้นป้องกัน"}],"variables":[{"id":"V1","name":"DepthUsed","kind":"double","unit":"length","note":"ร่องแกนลึกขั้นต่ำ 2 m","expr":"Depth","rules":[{"when":"Depth < 2","value":"2","warn":"Depth = {Depth} m < 2 m ใช้ 2 m แทน","error":"ValueTooSmall"}]}]}}
    internal static class SaDrawing_Round5Demo
    {
        private const string Source = "Round5Demo";
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
            cs.ParamsDouble.Add("Width", 4.0).DisplayName = "Crest Width";
            cs.ParamsLong.Add("ProtectionType", 1).DisplayName = "Protection (1 หินเรียง · 2 คอนกรีต · อื่นๆ ไม่มี)";
            cs.ParamsDouble.Add("RockT", 0.5).DisplayName = "Rock Thickness";
            cs.ParamsDouble.Add("ConcT", 0.2).DisplayName = "Concrete Thickness";
            cs.ParamsDouble.Add("Depth", 2.5).DisplayName = "Key Depth";
            cs.ParamsDouble.Add("KeyW", 1.0).DisplayName = "Key Width";
            cs.ParamsDouble.Add("BermH", 3.0).DisplayName = "Berm Height";
            cs.ParamsDouble.Add("BermW", 2.0).DisplayName = "Berm Width";
            cs.ParamsDouble.Add("CutSlope", 1.5).DisplayName = "Cut Slope (1:x)";
            cs.ParamsDouble.Add("FillSlope", 2.0).DisplayName = "Fill Slope (1:x)";
        }

        internal static void Draw(CorridorState cs)
        {
            // ---- parameter (≤ 0 ที่ต้องมากกว่า 0 = error + ใช้ default · นอกขอบเขต = ใช้ค่าขอบแทน + เตือน) ----
            long Side = GetLong(cs, "Side", 0);
            double Width = GetDouble(cs, "Width", 4.0);
            if (Width < 1.0) { Warn(cs, CorridorError.ValueTooSmall, "Width = " + Width + " m < 1 m, ใช้ 1 m แทน"); Width = 1.0; }
            long ProtectionType = GetLong(cs, "ProtectionType", 1);
            double RockT = GetDouble(cs, "RockT", 0.5);
            if (RockT <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "RockT = " + RockT + " m ต้องมากกว่า 0, ใช้ค่า default 0.5 m แทน"); RockT = 0.5; }
            double ConcT = GetDouble(cs, "ConcT", 0.2);
            if (ConcT <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "ConcT = " + ConcT + " m ต้องมากกว่า 0, ใช้ค่า default 0.2 m แทน"); ConcT = 0.2; }
            double Depth = GetDouble(cs, "Depth", 2.5);
            double KeyW = GetDouble(cs, "KeyW", 1.0);
            if (KeyW <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "KeyW = " + KeyW + " m ต้องมากกว่า 0, ใช้ค่า default 1 m แทน"); KeyW = 1.0; }
            double BermH = GetDouble(cs, "BermH", 3.0);
            if (BermH <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "BermH = " + BermH + " m ต้องมากกว่า 0, ใช้ค่า default 3 m แทน"); BermH = 3.0; }
            double BermW = GetDouble(cs, "BermW", 2.0);
            if (BermW <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "BermW = " + BermW + " m ต้องมากกว่า 0, ใช้ค่า default 2 m แทน"); BermW = 2.0; }
            double CutSlope = GetDouble(cs, "CutSlope", 1.5);
            if (CutSlope <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "CutSlope = 1:" + CutSlope + " ต้องมากกว่า 0, ใช้ค่า default 1:1.5 แทน"); CutSlope = 1.5; }
            double FillSlope = GetDouble(cs, "FillSlope", 2.0);
            if (FillSlope <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "FillSlope = 1:" + FillSlope + " ต้องมากกว่า 0, ใช้ค่า default 1:2 แทน"); FillSlope = 2.0; }
            double F = Side == 1 ? -1.0 : 1.0;   // Side = 1 (Left) -> กลับด้านแนวราบทั้งหมด

            // ---- target surface (Layout mode / ไม่ได้กำหนด = วาดแบบไม่มีดิน) ----
            ObjectId surface = TargetSurface(cs, "TargetSurface");

            // ---- พิกัดของจุด (เทียบ origin; null = หาจุดนี้ไม่ได้ ส่วนที่พึ่งจุดนี้จะถูกข้าม) ----
            // (เงื่อนไข / กิ่ง: bool? = null คือไม่รู้ค่า เพราะหาจุดที่อ้างไม่ได้ -> ไม่เข้ากิ่งไหน · object ในกิ่งที่ไม่เกิด = null ไม่เพิ่มลง Civil 3D)
            Pt? P1 = Pt.Origin;   // P1 origin
            Pt? P2 = Delta(cs, "P2", P1, F * Width, 0.0);   // P2 ห่างจาก P1
            bool? IsCut = Cond(cs, "IsCut", () => Ground(cs, surface, P2) > PY(P2));   // C1 IsCut: ผิวดินสูงกว่าบานพับ = ตัด
            bool? HighFill = Cond(cs, "HighFill", () => PY(P2) - Ground(cs, surface, P2) > BermH);   // C2 HighFill
            // V1 DepthUsed: ร่องแกนลึกขั้นต่ำ 2 m
            double DepthUsed = Depth;
            if (Depth < 2.0) { Warn(cs, CorridorError.ValueTooSmall, "Depth = " + Depth + " m < 2 m ใช้ 2 m แทน"); DepthUsed = 2.0; }
            // D1 decision ตัดหรือถม?
            bool B1 = IsCut == true;   // กิ่ง "ตัด"
            bool B2 = IsCut == false;   // กิ่ง "ถม"
            Pt? P3 = B1 ? SlopeToSurface(cs, "P3", surface, P2, 1.0 / CutSlope, F, 50.0, 3.0) : null;   // P3 ลาดจนชนดิน [กิ่ง ตัด]
            // D2 decision ถมสูงไหม? (ในกิ่ง ถม)
            bool B3 = B2 && HighFill == true;   // กิ่ง "ถมสูง (ชานพัก)"
            bool B4 = B2 && HighFill == false;   // กิ่ง "ถมปกติ"
            Pt? P4 = B4 ? SlopeToSurface(cs, "P4", surface, P2, -1.0 / FillSlope, F, 50.0, 3.0) : null;   // P4 ลาดจนชนดิน [กิ่ง ถมปกติ]
            Pt? P6 = B3 ? SlopeLength(cs, "P6", P2, -1.0 / FillSlope, BermH, F, Measure.Dy) : null;   // P6 ลาด + ความยาว จาก P2 [กิ่ง ถมสูง (ชานพัก)]
            Pt? P7 = B3 ? Delta(cs, "P7", P6, F * BermW, 0.0) : null;   // P7 ห่างจาก P6 [กิ่ง ถมสูง (ชานพัก)]
            Pt? P8 = B3 ? SlopeToSurface(cs, "P8", surface, P7, -1.0 / FillSlope, F, 50.0, 3.0) : null;   // P8 ลาดจนชนดิน [กิ่ง ถมสูง (ชานพัก)]
            Pt? P5 = FirstOf(cs, "P5", P3, P4, P8);   // P5 จุดแรกที่เกิดใน P3, P4, P8
            Pt? P9 = Delta(cs, "P9", P1, F * 0.0, -DepthUsed);   // P9 ห่างจาก P1
            Pt? P10 = Delta(cs, "P10", P9, F * KeyW, 0.0);   // P10 ห่างจาก P9
            Pt? P11 = Delta(cs, "P11", P10, F * 0.0, DepthUsed);   // P11 ห่างจาก P10
            // D3 switch ชั้นป้องกัน
            double? D3 = Val(cs, "D3", () => ProtectionType);
            bool B5 = D3 != null && Eq(D3.Value, 1.0);   // กิ่ง "หินเรียง"
            bool B6 = D3 != null && Eq(D3.Value, 2.0);   // กิ่ง "คอนกรีต"
            bool B7 = D3 != null && !Eq(D3.Value, 1.0) && !Eq(D3.Value, 2.0);   // กิ่ง "ไม่มีชั้นป้องกัน"
            Pt? P12 = B5 ? Delta(cs, "P12", P1, F * 0.0, RockT) : null;   // P12 ห่างจาก P1 [กิ่ง หินเรียง]
            Pt? P13 = B5 ? Delta(cs, "P13", P2, F * 0.0, RockT) : null;   // P13 ห่างจาก P2 [กิ่ง หินเรียง]
            Pt? P14 = B6 ? Delta(cs, "P14", P1, F * 0.0, ConcT) : null;   // P14 ห่างจาก P1 [กิ่ง คอนกรีต]
            Pt? P15 = B6 ? Delta(cs, "P15", P2, F * 0.0, ConcT) : null;   // P15 ห่างจาก P2 [กิ่ง คอนกรีต]

            // ---- เพิ่มจุด / link / shape ลง CorridorState ----
            Point p1 = AddPoint(cs, P1, "CrestInside");
            Point p2 = AddPoint(cs, P2, "CrestOutside");
            Point p3 = B1 ? AddPoint(cs, P3, "Daylight_Cut") : null;   // [กิ่ง ตัด]
            Point p4 = B4 ? AddPoint(cs, P4, "Daylight_Fill") : null;   // [กิ่ง ถมปกติ]
            // P5 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            Point p6 = B3 ? AddPoint(cs, P6, "BermInside") : null;   // [กิ่ง ถมสูง (ชานพัก)]
            Point p7 = B3 ? AddPoint(cs, P7, "BermOutside") : null;   // [กิ่ง ถมสูง (ชานพัก)]
            Point p8 = B3 ? AddPoint(cs, P8, "Daylight_Fill") : null;   // [กิ่ง ถมสูง (ชานพัก)]
            Point p9 = AddPoint(cs, P9, "KeyBottomInside");
            Point p10 = AddPoint(cs, P10, "KeyBottomOutside");
            Point p11 = AddPoint(cs, P11, "KeyTop");
            Point p12 = B5 ? AddPoint(cs, P12, "RockTopInside") : null;   // [กิ่ง หินเรียง]
            Point p13 = B5 ? AddPoint(cs, P13, "RockTopOutside") : null;   // [กิ่ง หินเรียง]
            Point p14 = B6 ? AddPoint(cs, P14, "ConcreteTopInside") : null;   // [กิ่ง คอนกรีต]
            Point p15 = B6 ? AddPoint(cs, P15, "ConcreteTopOutside") : null;   // [กิ่ง คอนกรีต]
            Link l1 = AddLink(cs, "L1", p1, p2, "Top", "Crest");
            Link l2 = B1 ? AddLink(cs, "L2", p2, p3, "Daylight_Cut") : null;   // [กิ่ง ตัด]
            Link l3 = B4 ? AddLink(cs, "L3", p2, p4, "Daylight_Fill") : null;   // [กิ่ง ถมปกติ]
            Link l4 = B3 ? AddLink(cs, "L4", p2, p6, "Top", "Daylight_Fill") : null;   // [กิ่ง ถมสูง (ชานพัก)]
            Link l5 = B3 ? AddLink(cs, "L5", p6, p7, "Top", "Berm") : null;   // [กิ่ง ถมสูง (ชานพัก)]
            Link l6 = B3 ? AddLink(cs, "L6", p7, p8, "Top", "Daylight_Fill") : null;   // [กิ่ง ถมสูง (ชานพัก)]
            Link l7 = AddLink(cs, "L7", p1, p9, "Key");
            Link l8 = AddLink(cs, "L8", p9, p10, "Key", "KeyBottom");
            Link l9 = AddLink(cs, "L9", p10, p11, "Key");
            Link l10 = AddLink(cs, "L10", p11, p1, "Key");
            Link l11 = B5 ? AddLink(cs, "L11", p1, p12, "Rock") : null;   // [กิ่ง หินเรียง]
            Link l12 = B5 ? AddLink(cs, "L12", p12, p13, "Top", "Rock") : null;   // [กิ่ง หินเรียง]
            Link l13 = B5 ? AddLink(cs, "L13", p13, p2, "Rock") : null;   // [กิ่ง หินเรียง]
            Link l14 = B6 ? AddLink(cs, "L14", p1, p14, "Concrete") : null;   // [กิ่ง คอนกรีต]
            Link l15 = B6 ? AddLink(cs, "L15", p14, p15, "Top", "Concrete") : null;   // [กิ่ง คอนกรีต]
            Link l16 = B6 ? AddLink(cs, "L16", p15, p2, "Concrete") : null;   // [กิ่ง คอนกรีต]
            AddShape(cs, "S1", new[] { l7, l8, l9, l10 }, "CoreKey");
            if (B5) AddShape(cs, "S2", new[] { l11, l12, l13, l1 }, "Rock");   // [กิ่ง หินเรียง]
            if (B6) AddShape(cs, "S3", new[] { l14, l15, l16, l1 }, "Concrete");   // [กิ่ง คอนกรีต]
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
            Shape shape = cs.Shapes.Add(ChainLinks(cs, id, links), "");
            foreach (string code in codes)
                shape.Codes.TryAdd(code);
        }

        // Civil 3D walks the links of Shapes.Add in array order: each link must touch the end of the previous one
        // (a reversed link is turned around), otherwise the fill is drawn crossed. So sort them into one closed chain.
        // Not possible (open outline, more than two links at a point) = warn and keep the order given.
        private static Link[] ChainLinks(CorridorState cs, string id, Link[] links)
        {
            var rest = new List<Link>(links);
            var chain = new List<Link> { rest[0] };
            rest.RemoveAt(0);
            Point start = links[0].Points[0];
            Point end = links[0].Points[links[0].Points.Count - 1];
            while (rest.Count > 0)
            {
                int k = rest.FindIndex(l => ReferenceEquals(l.Points[0], end) || ReferenceEquals(l.Points[l.Points.Count - 1], end));
                if (k < 0) break;
                Link next = rest[k];
                rest.RemoveAt(k);
                end = ReferenceEquals(next.Points[0], end) ? next.Points[next.Points.Count - 1] : next.Points[0];
                chain.Add(next);
            }
            if (rest.Count > 0 || !ReferenceEquals(end, start))
            {
                Warn(cs, CorridorError.Failure, id + ": link ต่อกันไม่เป็นรูปปิด — Civil 3D จะระบายสีผิด");
                return links;
            }
            return chain.ToArray();
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
