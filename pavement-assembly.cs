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
    // sa-spec: {"version":1,"className":"PavementAssembly","namespace":"TestSubassembly","params":[{"name":"Side","kind":"long","default":0,"displayName":"Side","min":null,"max":null}],"targets":[{"name":"TargetSurface","type":"Surface","displayName":"Target Surface"}],"points":[{"id":"P1","codes":[],"def":{"type":"origin"}},{"id":"P2","codes":[],"def":{"type":"delta","dx":"0","dy":"0"}},{"id":"P3","codes":[],"def":{"type":"delta","from":"P2","dx":"-0.25","dy":"0"}},{"id":"P4","codes":[],"def":{"type":"delta","dx":"0","dy":"-0.5","from":"P3"}},{"id":"P5","codes":[],"def":{"type":"delta","from":"P4","dx":"0.25","dy":"0"}},{"id":"P6","codes":[],"def":{"type":"delta","from":"P3","dx":"-0.3","dy":"0"}},{"id":"P7","codes":[],"def":{"type":"delta","from":"P6","dx":"0","dy":"-0.1"}},{"id":"P8","codes":[],"def":{"type":"between","a":"P3","b":"P4","t":"0.2"}},{"id":"P9","codes":[],"def":{"type":"delta","from":"P6","dx":"-0.3","dy":"0"}},{"id":"P10","codes":[],"def":{"type":"delta","from":"P9","dx":"0","dy":"-0.1"}},{"id":"P11","codes":[],"def":{"type":"delta","from":"P9","dx":"-0.3","dy":"0"}},{"id":"P12","codes":[],"def":{"type":"delta","from":"P11","dx":"0","dy":"-0.1"}},{"id":"P13","codes":[],"def":{"type":"delta","from":"P11","dx":"-0.3","dy":"0"}},{"id":"P14","codes":[],"def":{"type":"delta","from":"P13","dx":"0","dy":"-0.1"}},{"id":"P15","codes":[],"def":{"type":"delta","from":"P13","dx":"-0.3","dy":"0"}},{"id":"P16","codes":[],"def":{"type":"delta","from":"P15","dx":"0","dy":"-0.1"}},{"id":"P17","codes":[],"def":{"type":"delta","from":"P15","dx":"-0.3","dy":"0"}},{"id":"P18","codes":[],"def":{"type":"delta","from":"P17","dx":"0","dy":"-0.1"}},{"id":"P19","codes":[],"def":{"type":"delta","from":"P17","dx":"-0.3","dy":"0"}},{"id":"P20","codes":[],"def":{"type":"delta","from":"P19","dx":"0","dy":"-0.1"}},{"id":"P21","codes":[],"def":{"type":"delta","dx":"-2.65","dy":"0"}},{"id":"P22","codes":[],"def":{"type":"delta","dx":"-2.65","dy":"-0.1"}},{"id":"P23","codes":[],"def":{"type":"delta","dx":"-2.95","dy":"0"}},{"id":"P24","codes":[],"def":{"type":"delta","dx":"-2.95","dy":"-0.1"}},{"id":"P25","codes":[],"def":{"type":"delta","dx":"-2.65","dy":"-0.1"}},{"id":"P26","codes":[],"def":{"type":"delta","from":"P1","dx":"-0.05","dy":"-0.000"}},{"id":"P27","codes":[],"def":{"type":"delta","from":"P26","dx":"0","dy":"0.100"}},{"id":"P28","codes":[],"def":{"type":"delta","from":"P27","dx":"-0.15","dy":"0"}},{"id":"P29","codes":[],"def":{"type":"delta","dx":"0","dy":"-0.1","from":"P28"}},{"id":"P30","codes":[],"def":{"type":"delta","dx":"-0.0375","dy":"0","from":"P27"}},{"id":"P31","codes":[],"def":{"type":"delta","from":"P30","dx":"0","dy":"0.96"}},{"id":"P32","codes":[],"def":{"type":"delta","from":"P31","dx":"-0.075","dy":"-0.0014"}},{"id":"P33","codes":[],"def":{"type":"between","a":"P27","b":"P28","t":"0.75"}},{"id":"P34","codes":[],"def":{"type":"delta","from":"P23","dx":"0","dy":"-0.4"}},{"id":"P35","codes":[],"def":{"type":"delta","from":"P34","dx":"-0.5","dy":"0"}},{"id":"P36","codes":[],"def":{"type":"delta","from":"P35","dx":"0","dy":"0.24"}},{"id":"P37","codes":[],"def":{"type":"delta","from":"P23","dx":"-0.15","dy":"0.0019"}},{"id":"P38","codes":[],"def":{"type":"slopeLength","from":"P36","slope":"-1/8.33","length":"0.3022","dir":1,"measure":"along"}},{"id":"P39","codes":[],"def":{"type":"slopeLength","from":"P38","slope":"1/0.12","length":"0.1686","dir":1,"measure":"along"}},{"id":"P41","codes":[],"def":{"type":"slopeToSurface","from":"P35","slope":"-1/1.5","dir":-1,"target":"TargetSurface","maxDistance":"50","layoutLength":"3"}},{"id":"P42","codes":[],"def":{"type":"delta","from":"P36","dx":"-0.5","dy":"0.0051"}},{"id":"P43","codes":[],"def":{"type":"slopeToSurface","from":"P42","slope":"-1/2","dir":-1,"target":"TargetSurface","maxDistance":"50","layoutLength":"3"}},{"id":"P44","codes":[],"def":{"type":"delta","from":"P5","dx":"-0.045","dy":"-0.00"}},{"id":"P45","codes":[],"def":{"type":"delta","from":"P44","dx":"0","dy":"0.05"}},{"id":"P46","codes":[],"def":{"type":"delta","from":"P45","dx":"-0.16","dy":"-0.0"}},{"id":"P47","codes":[],"def":{"type":"delta","from":"P46","dx":"0","dy":"-2.5"}},{"id":"P48","codes":[],"def":{"type":"delta","from":"P47","dx":"0.16","dy":"0.0034"}},{"id":"P49","codes":[],"def":{"type":"onSurface","from":"P5","dx":"-0.0","target":"TargetSurface"}}],"links":[{"id":"L1","points":["P2","P3"],"codes":[]},{"id":"L2","points":["P4","P5"],"codes":[]},{"id":"L3","points":["P5","P1"],"codes":[]},{"id":"L4","points":["P3","P4"],"codes":[]},{"id":"L5","points":["P3","P6"],"codes":[]},{"id":"L6","points":["P6","P7"],"codes":[]},{"id":"L7","points":["P7","P8"],"codes":[]},{"id":"L8","points":["P8","P3"],"codes":[]},{"id":"L9","points":["P6","P9"],"codes":[]},{"id":"L10","points":["P9","P10"],"codes":[]},{"id":"L11","points":["P10","P7"],"codes":[]},{"id":"L12","points":["P9","P11"],"codes":[]},{"id":"L13","points":["P11","P12"],"codes":[]},{"id":"L14","points":["P12","P10"],"codes":[]},{"id":"L15","points":["P11","P13"],"codes":[]},{"id":"L16","points":["P13","P14"],"codes":[]},{"id":"L17","points":["P14","P12"],"codes":[]},{"id":"L18","points":["P13","P15"],"codes":[]},{"id":"L19","points":["P15","P16"],"codes":[]},{"id":"L20","points":["P16","P14"],"codes":[]},{"id":"L21","points":["P15","P17"],"codes":[]},{"id":"L22","points":["P17","P18"],"codes":[]},{"id":"L23","points":["P18","P16"],"codes":[]},{"id":"L24","points":["P17","P19"],"codes":[]},{"id":"L25","points":["P19","P20"],"codes":[]},{"id":"L26","points":["P20","P18"],"codes":[]},{"id":"L27","points":["P19","P21"],"codes":[]},{"id":"L28","points":["P21","P22"],"codes":[]},{"id":"L29","points":["P22","P20"],"codes":[]},{"id":"L30","points":["P21","P23"],"codes":[]},{"id":"L31","points":["P23","P24"],"codes":[]},{"id":"L32","points":["P24","P25"],"codes":[]},{"id":"L33","points":["P3","P1"],"codes":[]},{"id":"L34","points":["P1","P26"],"codes":[]},{"id":"L35","points":["P26","P27"],"codes":[]},{"id":"L36","points":["P27","P28"],"codes":[]},{"id":"L37","points":["P28","P29"],"codes":[]},{"id":"L38","points":["P30","P31"],"codes":[]},{"id":"L39","points":["P31","P32"],"codes":[]},{"id":"L40","points":["P32","P33"],"codes":[]},{"id":"L41","points":["P23","P34"],"codes":[]},{"id":"L42","points":["P34","P35"],"codes":[]},{"id":"L43","points":["P35","P36"],"codes":[]},{"id":"L44","points":["P23","P37"],"codes":[]},{"id":"L45","points":["P36","P38"],"codes":[]},{"id":"L46","points":["P38","P39"],"codes":[]},{"id":"L47","points":["P39","P37"],"codes":[]},{"id":"L49","points":["P35","P41"],"codes":[]},{"id":"L50","points":["P36","P42"],"codes":[]},{"id":"L51","points":["P42","P43"],"codes":[]},{"id":"L52","type":"followSurface","from":"P43","to":"P41","target":"TargetSurface","codes":["Datum"]},{"id":"L54","points":["P44","P45"],"codes":[]},{"id":"L55","points":["P45","P46"],"codes":[]},{"id":"L56","points":["P46","P47"],"codes":[]},{"id":"L57","points":["P47","P48"],"codes":[]},{"id":"L58","points":["P48","P44"],"codes":[]},{"id":"L59","points":["P5","P49"],"codes":[]},{"id":"L60","type":"followSurface","from":"P49","to":"P41","target":"TargetSurface","codes":["Datum"]},{"id":"L61","points":["P34","P24"],"codes":["compact soil"]},{"id":"L62","points":["P24","P8"],"codes":[]},{"id":"L63","points":["P8","P4"],"codes":[]}],"shapes":[{"id":"S1","links":["L33","L3","L2","L4"],"codes":[]},{"id":"S2","links":["L50","L43","L49","L52","L51"],"codes":["compact soil"]},{"id":"S3","links":["L49","L42","L61","L62","L63","L2","L59","L60"],"codes":["sand"]}],"side":{"param":"Side","mirror":true}}
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

            // ---- target surface (Layout mode / ไม่ได้กำหนด = วาดแบบไม่มีดิน) ----
            ObjectId surface = TargetSurface(cs, "TargetSurface");

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
            Pt? P26 = Delta(cs, "P26", P1, F * -0.05, -0.0);   // P26 ห่างจาก P1
            Pt? P27 = Delta(cs, "P27", P26, F * 0.0, 0.1);   // P27 ห่างจาก P26
            Pt? P28 = Delta(cs, "P28", P27, F * -0.15, 0.0);   // P28 ห่างจาก P27
            Pt? P29 = Delta(cs, "P29", P28, F * 0.0, -0.1);   // P29 ห่างจาก P28
            Pt? P30 = Delta(cs, "P30", P27, F * -0.0375, 0.0);   // P30 ห่างจาก P27
            Pt? P31 = Delta(cs, "P31", P30, F * 0.0, 0.96);   // P31 ห่างจาก P30
            Pt? P32 = Delta(cs, "P32", P31, F * -0.075, -0.0014);   // P32 ห่างจาก P31
            Pt? P33 = Between(cs, "P33", P27, P28, 0.75);   // P33 บนเส้น P27-P28
            Pt? P34 = Delta(cs, "P34", P23, F * 0.0, -0.4);   // P34 ห่างจาก P23
            Pt? P35 = Delta(cs, "P35", P34, F * -0.5, 0.0);   // P35 ห่างจาก P34
            Pt? P36 = Delta(cs, "P36", P35, F * 0.0, 0.24);   // P36 ห่างจาก P35
            Pt? P37 = Delta(cs, "P37", P23, F * -0.15, 0.0019);   // P37 ห่างจาก P23
            Pt? P38 = SlopeLength(cs, "P38", P36, -1.0 / 8.33, 0.3022, F, Measure.Along);   // P38 ลาด + ความยาว จาก P36
            Pt? P39 = SlopeLength(cs, "P39", P38, 1.0 / 0.12, 0.1686, F, Measure.Along);   // P39 ลาด + ความยาว จาก P38
            Pt? P41 = SlopeToSurface(cs, "P41", surface, P35, -1.0 / 1.5, -F, 50.0, 3.0);   // P41 ลาดจนชนดิน
            Pt? P42 = Delta(cs, "P42", P36, F * -0.5, 0.0051);   // P42 ห่างจาก P36
            Pt? P43 = SlopeToSurface(cs, "P43", surface, P42, -1.0 / 2.0, -F, 50.0, 3.0);   // P43 ลาดจนชนดิน
            Pt? P44 = Delta(cs, "P44", P5, F * -0.045, -0.0);   // P44 ห่างจาก P5
            Pt? P45 = Delta(cs, "P45", P44, F * 0.0, 0.05);   // P45 ห่างจาก P44
            Pt? P46 = Delta(cs, "P46", P45, F * -0.16, -0.0);   // P46 ห่างจาก P45
            Pt? P47 = Delta(cs, "P47", P46, F * 0.0, -2.5);   // P47 ห่างจาก P46
            Pt? P48 = Delta(cs, "P48", P47, F * 0.16, 0.0034);   // P48 ห่างจาก P47
            Pt? P49 = OnSurface(cs, "P49", surface, P5, F * -0.0);   // P49 บนผิวดิน

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
            Point p26 = AddPoint(cs, P26);
            Point p27 = AddPoint(cs, P27);
            Point p28 = AddPoint(cs, P28);
            Point p29 = AddPoint(cs, P29);
            Point p30 = AddPoint(cs, P30);
            Point p31 = AddPoint(cs, P31);
            Point p32 = AddPoint(cs, P32);
            Point p33 = AddPoint(cs, P33);
            Point p34 = AddPoint(cs, P34);
            Point p35 = AddPoint(cs, P35);
            Point p36 = AddPoint(cs, P36);
            Point p37 = AddPoint(cs, P37);
            Point p38 = AddPoint(cs, P38);
            Point p39 = AddPoint(cs, P39);
            Point p41 = AddPoint(cs, P41);
            Point p42 = AddPoint(cs, P42);
            Point p43 = AddPoint(cs, P43);
            Point p44 = AddPoint(cs, P44);
            Point p45 = AddPoint(cs, P45);
            Point p46 = AddPoint(cs, P46);
            Point p47 = AddPoint(cs, P47);
            Point p48 = AddPoint(cs, P48);
            Point p49 = AddPoint(cs, P49);
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
            Link l33 = AddLink(cs, "L33", p3, p1);
            Link l34 = AddLink(cs, "L34", p1, p26);
            Link l35 = AddLink(cs, "L35", p26, p27);
            Link l36 = AddLink(cs, "L36", p27, p28);
            Link l37 = AddLink(cs, "L37", p28, p29);
            Link l38 = AddLink(cs, "L38", p30, p31);
            Link l39 = AddLink(cs, "L39", p31, p32);
            Link l40 = AddLink(cs, "L40", p32, p33);
            Link l41 = AddLink(cs, "L41", p23, p34);
            Link l42 = AddLink(cs, "L42", p34, p35);
            Link l43 = AddLink(cs, "L43", p35, p36);
            Link l44 = AddLink(cs, "L44", p23, p37);
            Link l45 = AddLink(cs, "L45", p36, p38);
            Link l46 = AddLink(cs, "L46", p38, p39);
            Link l47 = AddLink(cs, "L47", p39, p37);
            Link l49 = AddLink(cs, "L49", p35, p41);
            Link l50 = AddLink(cs, "L50", p36, p42);
            Link l51 = AddLink(cs, "L51", p42, p43);
            Link l52 = FollowSurface(cs, "L52", surface, P43, p43, P41, p41, "Datum");   // L52 วิ่งตามผิวดิน
            Link l54 = AddLink(cs, "L54", p44, p45);
            Link l55 = AddLink(cs, "L55", p45, p46);
            Link l56 = AddLink(cs, "L56", p46, p47);
            Link l57 = AddLink(cs, "L57", p47, p48);
            Link l58 = AddLink(cs, "L58", p48, p44);
            Link l59 = AddLink(cs, "L59", p5, p49);
            Link l60 = FollowSurface(cs, "L60", surface, P49, p49, P41, p41, "Datum");   // L60 วิ่งตามผิวดิน
            Link l61 = AddLink(cs, "L61", p34, p24, "compact soil");
            Link l62 = AddLink(cs, "L62", p24, p8);
            Link l63 = AddLink(cs, "L63", p8, p4);
            AddShape(cs, "S1", new[] { l33, l3, l2, l4 });
            AddShape(cs, "S2", new[] { l50, l43, l49, l52, l51 }, "compact soil");
            AddShape(cs, "S3", new[] { l49, l42, l61, l62, l63, l2, l59, l60 }, "sand");
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
