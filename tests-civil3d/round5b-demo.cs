// round5b-demo.cs — subassembly ที่สร้างจาก SA Drawing Studio
//
// รูปตัดวาดในเว็บ: โค้ดในช่วง SA-DRAWING สร้างจากการวาด (เปิดไฟล์นี้ในเว็บแล้ววาดต่อได้ อย่าแก้ช่วงนั้นด้วยมือ)
// โค้ดนอกช่วงนั้นแก้เองได้ เว็บจะไม่แตะ
//
// Parameter:
//   Side (long, default 0)
//   Width (double, default 4 m, ไม่น้อยกว่า 1 m) — Crest Width
//   FillSlope (double, default 1:2) — Fill Slope (1:x)
//   SlopeInc (double, default 0.25, ไม่น้อยกว่า 0) — Slope Increase per Bench
//   BermInterval (double, default 3 m) — Berm Every (Height)
//   BermW (double, default 2 m) — Berm Width
//   LayoutH (double, default 7 m) — Fill Height (Layout / ไม่มีดิน)

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
    public class Round5bDemo
    {
        // ------------------------------------------------------------------
        // Civil 3D เรียก 4 เมธอดนี้ผ่าน .atc (ต้องเป็น public, ไม่มีพารามิเตอร์)

        public void GetLogicalNames()
        {
            CorridorState corridorState = null;
            try
            {
                corridorState = CivilApplication.ActiveDocument.CorridorState;
                SaDrawing_Round5bDemo.AddTargets(corridorState); // SA-DRAWING TARGET
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
                SaDrawing_Round5bDemo.AddParams(corridorState); // SA-DRAWING PARAM
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
                SaDrawing_Round5bDemo.Draw(corridorState); // SA-DRAWING CALL
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
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, nameof(Round5bDemo), true);
        }
    }

    // ===== SA-DRAWING BEGIN (สร้างโดย SA Drawing Studio — แก้ด้วยการวาดในเว็บ อย่าแก้ช่วงนี้ด้วยมือ) =====
    // sa-spec: {"version":1,"className":"Round5bDemo","namespace":"TestSubassembly","params":[{"name":"Side","kind":"long","default":0,"displayName":"Side","min":null,"max":null},{"name":"Width","kind":"double","default":4,"displayName":"Crest Width","min":1,"max":null,"unit":"length"},{"name":"FillSlope","kind":"double","default":2,"displayName":"Fill Slope (1:x)","min":null,"max":null,"unit":"slope","positive":true},{"name":"SlopeInc","kind":"double","default":0.25,"displayName":"Slope Increase per Bench","min":0,"max":null},{"name":"BermInterval","kind":"double","default":3,"displayName":"Berm Every (Height)","min":null,"max":null,"unit":"length","positive":true},{"name":"BermW","kind":"double","default":2,"displayName":"Berm Width","min":null,"max":null,"unit":"length","positive":true},{"name":"LayoutH","kind":"double","default":7,"displayName":"Fill Height (Layout / ไม่มีดิน)","min":null,"max":null,"unit":"length","positive":true}],"targets":[{"name":"TargetSurface","type":"Surface","displayName":"Target Surface"}],"points":[{"id":"P1","codes":["CrestInside"],"def":{"type":"origin"}},{"id":"P2","codes":["CrestOutside"],"def":{"type":"delta","from":"P1","dx":"Width","dy":"0"}},{"id":"P3","codes":["Daylight_Fill"],"def":{"type":"slopeToSurface","from":"P2","slope":"-1/FillSlope","dir":1,"target":"TargetSurface","maxDistance":"50","layoutLength":"3"},"branch":"B2"},{"id":"P4","codes":["BermInside"],"def":{"type":"slopeLength","from":"P2","slope":"-1/FillSlope","length":"BermInterval","dir":1,"measure":"dy"},"branch":"B1"},{"id":"P5","codes":["BermOutside"],"def":{"type":"delta","from":"P4","dx":"BermW","dy":"0"},"branch":"B1"},{"id":"P6","codes":["BermInside"],"def":{"type":"delta","from":"P4","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (1))","dy":"-BermInterval"},"branch":"B1"},{"id":"P7","codes":["BermOutside"],"def":{"type":"delta","from":"P5","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (1))","dy":"-BermInterval"},"branch":"B1"},{"id":"P8","codes":["BermInside"],"def":{"type":"delta","from":"P6","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (2))","dy":"-BermInterval"},"branch":"B1"},{"id":"P9","codes":["BermOutside"],"def":{"type":"delta","from":"P7","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (2))","dy":"-BermInterval"},"branch":"B1"},{"id":"P10","codes":["BermInside"],"def":{"type":"delta","from":"P8","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (3))","dy":"-BermInterval"},"branch":"B1"},{"id":"P11","codes":["BermOutside"],"def":{"type":"delta","from":"P9","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (3))","dy":"-BermInterval"},"branch":"B1"},{"id":"P12","codes":["BermInside"],"def":{"type":"delta","from":"P10","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (4))","dy":"-BermInterval"},"branch":"B1"},{"id":"P13","codes":["BermOutside"],"def":{"type":"delta","from":"P11","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (4))","dy":"-BermInterval"},"branch":"B1"},{"id":"P14","codes":["BermInside"],"def":{"type":"delta","from":"P12","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (5))","dy":"-BermInterval"},"branch":"B1"},{"id":"P15","codes":["BermOutside"],"def":{"type":"delta","from":"P13","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (5))","dy":"-BermInterval"},"branch":"B1"},{"id":"P16","codes":["BermInside"],"def":{"type":"delta","from":"P14","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (6))","dy":"-BermInterval"},"branch":"B1"},{"id":"P17","codes":["BermOutside"],"def":{"type":"delta","from":"P15","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (6))","dy":"-BermInterval"},"branch":"B1"},{"id":"P18","codes":["BermInside"],"def":{"type":"delta","from":"P16","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (7))","dy":"-BermInterval"},"branch":"B1"},{"id":"P19","codes":["BermOutside"],"def":{"type":"delta","from":"P17","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (7))","dy":"-BermInterval"},"branch":"B1"},{"id":"P20","codes":["BermInside"],"def":{"type":"delta","from":"P18","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (8))","dy":"-BermInterval"},"branch":"B1"},{"id":"P21","codes":["BermOutside"],"def":{"type":"delta","from":"P19","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (8))","dy":"-BermInterval"},"branch":"B1"},{"id":"P22","codes":["BermInside"],"def":{"type":"delta","from":"P20","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (9))","dy":"-BermInterval"},"branch":"B1"},{"id":"P23","codes":["BermOutside"],"def":{"type":"delta","from":"P21","dx":"BermW + BermInterval * (FillSlope + SlopeInc * (9))","dy":"-BermInterval"},"branch":"B1"},{"id":"P24","codes":[],"def":{"type":"lastOf","array":"A1","point":"P5","points":["P23","P21","P19","P17","P15","P13","P11","P9","P7","P5"]},"auxiliary":true,"branch":"B1"},{"id":"P25","codes":["Daylight_Fill"],"def":{"type":"slopeToSurface","from":"P24","slope":"-1/(FillSlope + SlopeInc * count(A1))","dir":1,"target":"TargetSurface","maxDistance":"50","layoutLength":"3"},"branch":"B1"}],"links":[{"id":"L1","points":["P1","P2"],"codes":["Top","Crest"]},{"id":"L2","points":["P2","P3"],"codes":["Top","Daylight_Fill"],"branch":"B2"},{"id":"L3","points":["P2","P4"],"codes":["Top","Fill"],"branch":"B1"},{"id":"L4","points":["P4","P5"],"codes":["Top","Berm"],"branch":"B1"},{"id":"L5","points":["P5","P6"],"codes":["Top","Fill"],"branch":"B1"},{"id":"L6","points":["P6","P7"],"codes":["Top","Berm"],"branch":"B1"},{"id":"L7","points":["P7","P8"],"codes":["Top","Fill"],"branch":"B1"},{"id":"L8","points":["P8","P9"],"codes":["Top","Berm"],"branch":"B1"},{"id":"L9","points":["P9","P10"],"codes":["Top","Fill"],"branch":"B1"},{"id":"L10","points":["P10","P11"],"codes":["Top","Berm"],"branch":"B1"},{"id":"L11","points":["P11","P12"],"codes":["Top","Fill"],"branch":"B1"},{"id":"L12","points":["P12","P13"],"codes":["Top","Berm"],"branch":"B1"},{"id":"L13","points":["P13","P14"],"codes":["Top","Fill"],"branch":"B1"},{"id":"L14","points":["P14","P15"],"codes":["Top","Berm"],"branch":"B1"},{"id":"L15","points":["P15","P16"],"codes":["Top","Fill"],"branch":"B1"},{"id":"L16","points":["P16","P17"],"codes":["Top","Berm"],"branch":"B1"},{"id":"L17","points":["P17","P18"],"codes":["Top","Fill"],"branch":"B1"},{"id":"L18","points":["P18","P19"],"codes":["Top","Berm"],"branch":"B1"},{"id":"L19","points":["P19","P20"],"codes":["Top","Fill"],"branch":"B1"},{"id":"L20","points":["P20","P21"],"codes":["Top","Berm"],"branch":"B1"},{"id":"L21","points":["P21","P22"],"codes":["Top","Fill"],"branch":"B1"},{"id":"L22","points":["P22","P23"],"codes":["Top","Berm"],"branch":"B1"},{"id":"L23","points":["P24","P25"],"codes":["Top","Daylight_Fill"],"branch":"B1"}],"shapes":[],"side":{"param":"Side","mirror":true},"logic":{"conditions":[{"id":"C1","name":"HighFill","expr":"FillH > BermInterval"}],"decisions":[{"id":"D1","parent":null,"kind":"if","test":"HighFill","label":"มีชานพักไหม?"}],"branches":[{"id":"B1","decision":"D1","case":true,"label":"มีชานพัก (Loop)"},{"id":"B2","decision":"D1","case":false,"label":"ถมต่ำ"}],"variables":[{"id":"V1","name":"FillH","kind":"double","unit":"length","note":"ความสูงถมที่ไหล่คันดิน","expr":"P2.y - ground(P2)","rules":[{"when":"not hasGround()","value":"LayoutH"}]}]},"arrays":[{"id":"A1","source":{"points":["P2","P4","P5"],"links":["L3","L4"],"shapes":[]},"n":10,"dx":"BermW + BermInterval * (FillSlope + SlopeInc * i)","dy":"-BermInterval","join":{"mode":"share","from":"P5","to":"P2"},"members":[{"points":["P6","P7"],"links":["L5","L6"],"shapes":[]},{"points":["P8","P9"],"links":["L7","L8"],"shapes":[]},{"points":["P10","P11"],"links":["L9","L10"],"shapes":[]},{"points":["P12","P13"],"links":["L11","L12"],"shapes":[]},{"points":["P14","P15"],"links":["L13","L14"],"shapes":[]},{"points":["P16","P17"],"links":["L15","L16"],"shapes":[]},{"points":["P18","P19"],"links":["L17","L18"],"shapes":[]},{"points":["P20","P21"],"links":["L19","L20"],"shapes":[]},{"points":["P22","P23"],"links":["L21","L22"],"shapes":[]}],"loop":{"n":"max(1, floor(FillH / BermInterval))","nMax":10,"nRound":"floor"}}]}
    internal static class SaDrawing_Round5bDemo
    {
        private const string Source = "Round5bDemo";
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
            cs.ParamsDouble.Add("FillSlope", 2.0).DisplayName = "Fill Slope (1:x)";
            cs.ParamsDouble.Add("SlopeInc", 0.25).DisplayName = "Slope Increase per Bench";
            cs.ParamsDouble.Add("BermInterval", 3.0).DisplayName = "Berm Every (Height)";
            cs.ParamsDouble.Add("BermW", 2.0).DisplayName = "Berm Width";
            cs.ParamsDouble.Add("LayoutH", 7.0).DisplayName = "Fill Height (Layout / ไม่มีดิน)";
        }

        internal static void Draw(CorridorState cs)
        {
            // ---- parameter (≤ 0 ที่ต้องมากกว่า 0 = error + ใช้ default · นอกขอบเขต = ใช้ค่าขอบแทน + เตือน) ----
            long Side = GetLong(cs, "Side", 0);
            double Width = GetDouble(cs, "Width", 4.0);
            if (Width < 1.0) { Warn(cs, CorridorError.ValueTooSmall, "Width = " + Width + " m < 1 m, ใช้ 1 m แทน"); Width = 1.0; }
            double FillSlope = GetDouble(cs, "FillSlope", 2.0);
            if (FillSlope <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "FillSlope = 1:" + FillSlope + " ต้องมากกว่า 0, ใช้ค่า default 1:2 แทน"); FillSlope = 2.0; }
            double SlopeInc = GetDouble(cs, "SlopeInc", 0.25);
            if (SlopeInc < 0.0) { Warn(cs, CorridorError.ValueTooSmall, "SlopeInc = " + SlopeInc + " < 0, ใช้ 0 แทน"); SlopeInc = 0.0; }
            double BermInterval = GetDouble(cs, "BermInterval", 3.0);
            if (BermInterval <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "BermInterval = " + BermInterval + " m ต้องมากกว่า 0, ใช้ค่า default 3 m แทน"); BermInterval = 3.0; }
            double BermW = GetDouble(cs, "BermW", 2.0);
            if (BermW <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "BermW = " + BermW + " m ต้องมากกว่า 0, ใช้ค่า default 2 m แทน"); BermW = 2.0; }
            double LayoutH = GetDouble(cs, "LayoutH", 7.0);
            if (LayoutH <= 0) { Severe(cs, CorridorError.ValueShouldNotBeLessThanOrEqualToZero, "LayoutH = " + LayoutH + " m ต้องมากกว่า 0, ใช้ค่า default 7 m แทน"); LayoutH = 7.0; }
            double F = Side == 1 ? -1.0 : 1.0;   // Side = 1 (Left) -> กลับด้านแนวราบทั้งหมด

            // ---- target surface (Layout mode / ไม่ได้กำหนด = วาดแบบไม่มีดิน) ----
            ObjectId surface = TargetSurface(cs, "TargetSurface");

            // ---- พิกัดของจุด (เทียบ origin; null = หาจุดนี้ไม่ได้ ส่วนที่พึ่งจุดนี้จะถูกข้าม) ----
            // (เงื่อนไข / กิ่ง: bool? = null คือไม่รู้ค่า เพราะหาจุดที่อ้างไม่ได้ -> ไม่เข้ากิ่งไหน · object ในกิ่งที่ไม่เกิด = null ไม่เพิ่มลง Civil 3D)
            Pt? P1 = Pt.Origin;   // P1 origin
            Pt? P2 = Delta(cs, "P2", P1, F * Width, 0.0);   // P2 ห่างจาก P1
            // V1 FillH: ความสูงถมที่ไหล่คันดิน
            double? FillH = Val(cs, "FillH", () =>
            {
                if (!!surface.IsNull) { return LayoutH; }
                return PY(P2) - Ground(cs, surface, P2);
            });
            bool? HighFill = Cond(cs, "HighFill", () => VN(FillH) > BermInterval);   // C1 HighFill
            // D1 decision มีชานพักไหม?
            bool B1 = HighFill == true;   // กิ่ง "มีชานพัก (Loop)"
            bool B2 = HighFill == false;   // กิ่ง "ถมต่ำ"
            Pt? P3 = B2 ? SlopeToSurface(cs, "P3", surface, P2, -1.0 / FillSlope, F, 50.0, 3.0) : null;   // P3 ลาดจนชนดิน [กิ่ง ถมต่ำ]
            Pt? P4 = B1 ? SlopeLength(cs, "P4", P2, -1.0 / FillSlope, BermInterval, F, Measure.Dy) : null;   // P4 ลาด + ความยาว จาก P2 [กิ่ง มีชานพัก (Loop)]
            Pt? P5 = B1 ? Delta(cs, "P5", P4, F * BermW, 0.0) : null;   // P5 ห่างจาก P4 [กิ่ง มีชานพัก (Loop)]
            // A1 ทำซ้ำ (Loop): N = max(1, floor(FillH / BermInterval)) · ปัดลง · สูงสุด 10 ชุด
            int N_A1 = LoopN(cs, "A1", () => Math.Max(1.0, Math.Floor(VN(FillH) / BermInterval)), 10, 0);
            Pt? P6 = B1 && N_A1 > 1 ? Delta(cs, "P6", P4, F * (BermW + BermInterval * (FillSlope + SlopeInc * 1.0)), -BermInterval) : null;   // P6 ห่างจาก P4 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 2]
            Pt? P7 = B1 && N_A1 > 1 ? Delta(cs, "P7", P5, F * (BermW + BermInterval * (FillSlope + SlopeInc * 1.0)), -BermInterval) : null;   // P7 ห่างจาก P5 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 2]
            Pt? P8 = B1 && N_A1 > 2 ? Delta(cs, "P8", P6, F * (BermW + BermInterval * (FillSlope + SlopeInc * 2.0)), -BermInterval) : null;   // P8 ห่างจาก P6 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 3]
            Pt? P9 = B1 && N_A1 > 2 ? Delta(cs, "P9", P7, F * (BermW + BermInterval * (FillSlope + SlopeInc * 2.0)), -BermInterval) : null;   // P9 ห่างจาก P7 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 3]
            Pt? P10 = B1 && N_A1 > 3 ? Delta(cs, "P10", P8, F * (BermW + BermInterval * (FillSlope + SlopeInc * 3.0)), -BermInterval) : null;   // P10 ห่างจาก P8 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 4]
            Pt? P11 = B1 && N_A1 > 3 ? Delta(cs, "P11", P9, F * (BermW + BermInterval * (FillSlope + SlopeInc * 3.0)), -BermInterval) : null;   // P11 ห่างจาก P9 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 4]
            Pt? P12 = B1 && N_A1 > 4 ? Delta(cs, "P12", P10, F * (BermW + BermInterval * (FillSlope + SlopeInc * 4.0)), -BermInterval) : null;   // P12 ห่างจาก P10 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 5]
            Pt? P13 = B1 && N_A1 > 4 ? Delta(cs, "P13", P11, F * (BermW + BermInterval * (FillSlope + SlopeInc * 4.0)), -BermInterval) : null;   // P13 ห่างจาก P11 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 5]
            Pt? P14 = B1 && N_A1 > 5 ? Delta(cs, "P14", P12, F * (BermW + BermInterval * (FillSlope + SlopeInc * 5.0)), -BermInterval) : null;   // P14 ห่างจาก P12 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 6]
            Pt? P15 = B1 && N_A1 > 5 ? Delta(cs, "P15", P13, F * (BermW + BermInterval * (FillSlope + SlopeInc * 5.0)), -BermInterval) : null;   // P15 ห่างจาก P13 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 6]
            Pt? P16 = B1 && N_A1 > 6 ? Delta(cs, "P16", P14, F * (BermW + BermInterval * (FillSlope + SlopeInc * 6.0)), -BermInterval) : null;   // P16 ห่างจาก P14 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 7]
            Pt? P17 = B1 && N_A1 > 6 ? Delta(cs, "P17", P15, F * (BermW + BermInterval * (FillSlope + SlopeInc * 6.0)), -BermInterval) : null;   // P17 ห่างจาก P15 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 7]
            Pt? P18 = B1 && N_A1 > 7 ? Delta(cs, "P18", P16, F * (BermW + BermInterval * (FillSlope + SlopeInc * 7.0)), -BermInterval) : null;   // P18 ห่างจาก P16 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 8]
            Pt? P19 = B1 && N_A1 > 7 ? Delta(cs, "P19", P17, F * (BermW + BermInterval * (FillSlope + SlopeInc * 7.0)), -BermInterval) : null;   // P19 ห่างจาก P17 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 8]
            Pt? P20 = B1 && N_A1 > 8 ? Delta(cs, "P20", P18, F * (BermW + BermInterval * (FillSlope + SlopeInc * 8.0)), -BermInterval) : null;   // P20 ห่างจาก P18 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 9]
            Pt? P21 = B1 && N_A1 > 8 ? Delta(cs, "P21", P19, F * (BermW + BermInterval * (FillSlope + SlopeInc * 8.0)), -BermInterval) : null;   // P21 ห่างจาก P19 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 9]
            Pt? P22 = B1 && N_A1 > 9 ? Delta(cs, "P22", P20, F * (BermW + BermInterval * (FillSlope + SlopeInc * 9.0)), -BermInterval) : null;   // P22 ห่างจาก P20 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 10]
            Pt? P23 = B1 && N_A1 > 9 ? Delta(cs, "P23", P21, F * (BermW + BermInterval * (FillSlope + SlopeInc * 9.0)), -BermInterval) : null;   // P23 ห่างจาก P21 [กิ่ง มีชานพัก (Loop)] [A1 ชุดที่ 10]
            Pt? P24 = B1 ? FirstOf(cs, "P24", P23, P21, P19, P17, P15, P13, P11, P9, P7, P5) : null;   // P24 จุด P5 ของชุดสุดท้ายของ A1 (ไล่ P23, P21, P19, P17, P15, P13, P11, P9, P7, P5) [กิ่ง มีชานพัก (Loop)]
            Pt? P25 = B1 ? SlopeToSurface(cs, "P25", surface, P24, -1.0 / (FillSlope + SlopeInc * N_A1), F, 50.0, 3.0) : null;   // P25 ลาดจนชนดิน [กิ่ง มีชานพัก (Loop)]

            // ---- เพิ่มจุด / link / shape ลง CorridorState ----
            Point p1 = AddPoint(cs, P1, "CrestInside");
            Point p2 = AddPoint(cs, P2, "CrestOutside");
            Point p3 = B2 ? AddPoint(cs, P3, "Daylight_Fill") : null;   // [กิ่ง ถมต่ำ]
            Point p4 = B1 ? AddPoint(cs, P4, "BermInside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p5 = B1 ? AddPoint(cs, P5, "BermOutside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p6 = B1 && N_A1 > 1 ? AddPoint(cs, P6, "BermInside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p7 = B1 && N_A1 > 1 ? AddPoint(cs, P7, "BermOutside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p8 = B1 && N_A1 > 2 ? AddPoint(cs, P8, "BermInside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p9 = B1 && N_A1 > 2 ? AddPoint(cs, P9, "BermOutside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p10 = B1 && N_A1 > 3 ? AddPoint(cs, P10, "BermInside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p11 = B1 && N_A1 > 3 ? AddPoint(cs, P11, "BermOutside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p12 = B1 && N_A1 > 4 ? AddPoint(cs, P12, "BermInside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p13 = B1 && N_A1 > 4 ? AddPoint(cs, P13, "BermOutside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p14 = B1 && N_A1 > 5 ? AddPoint(cs, P14, "BermInside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p15 = B1 && N_A1 > 5 ? AddPoint(cs, P15, "BermOutside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p16 = B1 && N_A1 > 6 ? AddPoint(cs, P16, "BermInside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p17 = B1 && N_A1 > 6 ? AddPoint(cs, P17, "BermOutside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p18 = B1 && N_A1 > 7 ? AddPoint(cs, P18, "BermInside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p19 = B1 && N_A1 > 7 ? AddPoint(cs, P19, "BermOutside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p20 = B1 && N_A1 > 8 ? AddPoint(cs, P20, "BermInside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p21 = B1 && N_A1 > 8 ? AddPoint(cs, P21, "BermOutside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p22 = B1 && N_A1 > 9 ? AddPoint(cs, P22, "BermInside") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p23 = B1 && N_A1 > 9 ? AddPoint(cs, P23, "BermOutside") : null;   // [กิ่ง มีชานพัก (Loop)]
            // P24 auxiliary: ใช้คำนวณอย่างเดียว ไม่เพิ่มลง Civil 3D
            Point p25 = B1 ? AddPoint(cs, P25, "Daylight_Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
            Point p24 = P24 == null ? null : (P23 != null ? p23 : P21 != null ? p21 : P19 != null ? p19 : P17 != null ? p17 : P15 != null ? p15 : P13 != null ? p13 : P11 != null ? p11 : P9 != null ? p9 : P7 != null ? p7 : P5 != null ? p5 : null);   // P24 ปลายจริง = จุดแรกที่เกิดใน P23, P21, P19, P17, P15, P13, P11, P9, P7, P5
            Link l1 = AddLink(cs, "L1", p1, p2, "Top", "Crest");
            Link l2 = B2 ? AddLink(cs, "L2", p2, p3, "Top", "Daylight_Fill") : null;   // [กิ่ง ถมต่ำ]
            Link l3 = B1 ? AddLink(cs, "L3", p2, p4, "Top", "Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l4 = B1 ? AddLink(cs, "L4", p4, p5, "Top", "Berm") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l5 = B1 && N_A1 > 1 ? AddLink(cs, "L5", p5, p6, "Top", "Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l6 = B1 && N_A1 > 1 ? AddLink(cs, "L6", p6, p7, "Top", "Berm") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l7 = B1 && N_A1 > 2 ? AddLink(cs, "L7", p7, p8, "Top", "Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l8 = B1 && N_A1 > 2 ? AddLink(cs, "L8", p8, p9, "Top", "Berm") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l9 = B1 && N_A1 > 3 ? AddLink(cs, "L9", p9, p10, "Top", "Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l10 = B1 && N_A1 > 3 ? AddLink(cs, "L10", p10, p11, "Top", "Berm") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l11 = B1 && N_A1 > 4 ? AddLink(cs, "L11", p11, p12, "Top", "Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l12 = B1 && N_A1 > 4 ? AddLink(cs, "L12", p12, p13, "Top", "Berm") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l13 = B1 && N_A1 > 5 ? AddLink(cs, "L13", p13, p14, "Top", "Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l14 = B1 && N_A1 > 5 ? AddLink(cs, "L14", p14, p15, "Top", "Berm") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l15 = B1 && N_A1 > 6 ? AddLink(cs, "L15", p15, p16, "Top", "Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l16 = B1 && N_A1 > 6 ? AddLink(cs, "L16", p16, p17, "Top", "Berm") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l17 = B1 && N_A1 > 7 ? AddLink(cs, "L17", p17, p18, "Top", "Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l18 = B1 && N_A1 > 7 ? AddLink(cs, "L18", p18, p19, "Top", "Berm") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l19 = B1 && N_A1 > 8 ? AddLink(cs, "L19", p19, p20, "Top", "Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l20 = B1 && N_A1 > 8 ? AddLink(cs, "L20", p20, p21, "Top", "Berm") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l21 = B1 && N_A1 > 9 ? AddLink(cs, "L21", p21, p22, "Top", "Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l22 = B1 && N_A1 > 9 ? AddLink(cs, "L22", p22, p23, "Top", "Berm") : null;   // [กิ่ง มีชานพัก (Loop)]
            Link l23 = B1 ? AddLink(cs, "L23", p24, p25, "Top", "Daylight_Fill") : null;   // [กิ่ง มีชานพัก (Loop)]
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

        // จำนวนชุดของ Array แบบ Loop: ปัดเศษ (0 ลง · 1 ขึ้น · 2 ใกล้สุด .5 ออกจากศูนย์) แล้วบีบ 1..nMax — นอกช่วง / หาค่าไม่ได้ = เตือน (ตรงกับ loopN ใน spec.js)
        private static int LoopN(CorridorState cs, string id, Func<double> value, int nMax, int mode)
        {
            double v;
            try
            {
                v = value();
            }
            catch (InvalidOperationException)
            {
                v = double.NaN;
            }
            if (double.IsNaN(v) || double.IsInfinity(v))
            {
                Warn(cs, CorridorError.Failure, "Array " + id + ": หาจำนวนชุดไม่ได้ ใช้ 1");
                return 1;
            }
            double r = mode == 1 ? Math.Ceiling(v) : mode == 2 ? Math.Round(v, MidpointRounding.AwayFromZero) : Math.Floor(v);
            if (r == 0) r = 0;   // -0 (เช่น ceil(-0.3)) แสดงเป็น 0 แบบ JS
            if (r > nMax)
            {
                Warn(cs, CorridorError.ValueTooLarge, "Array " + id + ": ต้องการ " + r + " ชุด เกินสูงสุด " + nMax + " ใช้ " + nMax);
                return nMax;
            }
            if (r < 1)
            {
                Warn(cs, CorridorError.ValueTooSmall, "Array " + id + ": ได้ " + r + " ชุด น้อยกว่า 1 ใช้ 1");
                return 1;
            }
            return (int)r;
        }

        // ค่าของ variable ที่ใช้ในนิพจน์อื่น — ไม่รู้ค่า = โยน (ให้ Val / Try / Cond ข้างนอกจัดการ)
        private static double VN(double? v)
        {
            if (v == null) throw new InvalidOperationException("variable ที่อ้างไม่รู้ค่า");
            return v.Value;
        }
    }

    // ===== SA-DRAWING END =====
}
