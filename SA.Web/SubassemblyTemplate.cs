// โค้ดเริ่มต้นของไฟล์ .cs ที่สร้างจากปุ่ม "+ ไฟล์ใหม่" ในเว็บ
// โครงเดียวกับไฟล์ที่ build ลง Civil 3D: public class + 4 เมธอดที่ .atc เรียก

using System.Text;

public static class SubassemblyTemplate
{
    public static string Create(string fileName)
    {
        string cls = ClassName(fileName);
        return Body.Replace("__CLASS__", cls).Replace("__FILE__", fileName).Replace("\r\n", "\n").Replace("\n", "\r\n");
    }

    // ชื่อไฟล์ -> ชื่อ class ที่ถูกต้องใน C# (เช่น "rock-pitching 2" -> "RockPitching2")
    private static string ClassName(string name)
    {
        var sb = new StringBuilder();
        bool upper = true;
        foreach (char c in name)
        {
            if (char.IsLetterOrDigit(c) && c < 128)
            {
                sb.Append(upper ? char.ToUpperInvariant(c) : c);
                upper = false;
            }
            else upper = true;
        }
        if (sb.Length == 0 || char.IsDigit(sb[0])) sb.Insert(0, "Subassembly");
        return sb.ToString();
    }

    private const string Body = """
// __FILE__.cs — subassembly ที่สร้างจากเว็บ viewer
//
// รูปตัด (Side = Right):
//
//   P1 (origin)   Width    P2
//    o======================o            <- Top
//                            \
//                             \  ลาดถม 1:FillSlope (หรือลาดตัด 1:CutSlope ขึ้นไป)
//                              o P3      <- Daylight (ชน Target Surface)
//
// แก้โค้ดในเว็บแล้วรูปจะวาดใหม่เอง · Console.WriteLine(...) จะขึ้นในช่อง Log ของเว็บ

using System;
using Autodesk.Civil;
using Autodesk.Civil.ApplicationServices;
using Autodesk.Civil.Runtime;
using ObjectId = Autodesk.AutoCAD.DatabaseServices.ObjectId;

namespace TestSubassembly
{
    public class __CLASS__
    {
        private const string SurfaceTarget = "TargetSurface";

        private const string SideParam = "Side";
        private const string WidthParam = "Width";
        private const string FillSlopeParam = "FillSlope";
        private const string CutSlopeParam = "CutSlope";

        private const int Left = 1;               // Side: 0 = Right, 1 = Left
        private const double LayoutSlopeLength = 3.0;

        // ------------------------------------------------------------------
        // Civil 3D เรียก 4 เมธอดนี้ผ่าน .atc (ต้องเป็น public, ไม่มีพารามิเตอร์)

        public void GetLogicalNames()
        {
            CorridorState corridorState = null;
            try
            {
                corridorState = CivilApplication.ActiveDocument.CorridorState;
                ParamLong param = corridorState.ParamsLong.Add(SurfaceTarget, (int)ParamLogicalNameType.Surface);
                param.DisplayName = "Target Surface";
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
                corridorState.ParamsLong.Add(SideParam, 0);
                corridorState.ParamsDouble.Add(WidthParam, 4.0);       // ความกว้างสัน (m)
                corridorState.ParamsDouble.Add(FillSlopeParam, 2.0);   // ลาดถม 1:2 (ดิ่ง:ราบ)
                corridorState.ParamsDouble.Add(CutSlopeParam, 1.5);    // ลาดตัด 1:1.5
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
                DrawImplement(corridorState);
            }
            catch (Exception e)
            {
                RecordError(corridorState, e);
            }
        }

        // ------------------------------------------------------------------

        private void DrawImplement(CorridorState cs)
        {
            double flip = cs.ParamsLong.Value(SideParam) == Left ? -1.0 : 1.0;
            double width = cs.ParamsDouble.Value(WidthParam);
            double fillSlope = cs.ParamsDouble.Value(FillSlopeParam);
            double cutSlope = cs.ParamsDouble.Value(CutSlopeParam);

            // จุดใน Points.Add เป็นค่าเทียบ origin: offset (ขวา +), elevation (ขึ้น +)
            Point p1 = cs.Points.Add(0.0, 0.0, "CrestIn");
            Point p2 = cs.Points.Add(flip * width, 0.0, "CrestOut");
            Link top = cs.Links.Add(new[] { p1, p2 }, "Top");
            top.Codes.TryAdd("Datum");

            // Layout mode หรือไม่ได้กำหนด surface -> วาดลาดถมยาวคงที่ไว้ให้เห็นรูป
            ObjectId surfaceId = ObjectId.Null;
            if (cs.Mode != CorridorMode.Layout)
            {
                try { surfaceId = cs.ParamsSurface.Value(SurfaceTarget); }
                catch { }
            }
            if (surfaceId.IsNull)
            {
                Point end = cs.Points.Add(flip * (width + LayoutSlopeLength * fillSlope), -LayoutSlopeLength, "Daylight");
                cs.Links.Add(new[] { p2, end }, "Daylight");
                return;
            }

            // หา daylight: ลองลาดถมลงไปหา surface ก่อน ถ้าไม่ชน (P2 อยู่ใต้ดิน) ใช้ลาดตัดขึ้นไปแทน
            // IntersectSurface ใช้พิกัดจริง (absolute) จึงต้องบวก/ลบ CurrentOffset, CurrentElevation
            var start = new PointInMem
            {
                Station = cs.CurrentStation,
                Offset = cs.CurrentOffset + flip * width,
                Elevation = cs.CurrentElevation
            };
            bool lookRight = flip > 0;
            IPoint hit;
            string kind;
            try
            {
                hit = cs.IntersectSurface(surfaceId, cs.CurrentAlignmentId, start, lookRight, -1.0 / fillSlope);
                kind = "ถม";
            }
            catch
            {
                hit = cs.IntersectSurface(surfaceId, cs.CurrentAlignmentId, start, lookRight, 1.0 / cutSlope);
                kind = "ตัด";
            }

            Point p3 = cs.Points.Add(hit.Offset - cs.CurrentOffset, hit.Elevation - cs.CurrentElevation, "Daylight");
            Link slope = cs.Links.Add(new[] { p2, p3 }, "Daylight");
            slope.Codes.TryAdd("Top");
            slope.Codes.TryAdd("Datum");

            Console.WriteLine($"{kind}: daylight ที่ offset {p3.Offset:0.000}, elev {p3.Elevation:0.000}");
        }

        // ------------------------------------------------------------------

        private static void RecordError(CorridorState corridorState, Exception e)
        {
            if (corridorState == null)
                return;
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, nameof(__CLASS__), true);
        }
    }
}
""";
}
