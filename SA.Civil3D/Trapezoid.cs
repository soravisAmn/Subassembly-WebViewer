// Adapter ของ subassembly Trapezoid สำหรับ Civil 3D 2027
//
// ไฟล์นี้ไม่มีเงื่อนไขทางวิศวกรรมแล้ว ทำแค่ 3 อย่าง:
//   1) อ่าน parameter จาก CorridorState
//   2) ห่อ surface จริงเป็น IGround (Civil3DGround.cs) แล้วเรียก SA.Core.TrapezoidLogic.Build
//   3) นำผลลัพธ์ (points / links / shape / issues) ไปสร้างใน Civil 3D
//
// เงื่อนไขทั้งหมดอยู่ที่ SA.Core/TrapezoidLogic.cs -> แก้ที่นั่นแล้วเช็คในเว็บได้ทันที
//
// namespace + ชื่อคลาสเหมือน test.cs เดิม (TestSubassembly.Trapezoid) ไฟล์ .atc จึงใช้ชื่อคลาสเดิมได้

using System;
using Autodesk.Civil;
using Autodesk.Civil.ApplicationServices;
using Autodesk.Civil.DatabaseServices;
using Autodesk.Civil.Runtime;
using ObjectId = Autodesk.AutoCAD.DatabaseServices.ObjectId;
using Core = SA.Core;

namespace TestSubassembly
{
    public class Trapezoid
    {
        private const string SurfaceTarget = "TargetSurface";

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

                corridorState.ParamsLong.Add(Core.TrapezoidLogic.SideParam, Core.TrapezoidParams.SideDefault);
                corridorState.ParamsDouble.Add(Core.TrapezoidLogic.TopWidthParam, Core.TrapezoidParams.TopWidthDefault);
                corridorState.ParamsDouble.Add(Core.TrapezoidLogic.BottomWidthParam, Core.TrapezoidParams.BottomWidthDefault);
                corridorState.ParamsDouble.Add(Core.TrapezoidLogic.DepthParam, Core.TrapezoidParams.DepthDefault);
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

        private void DrawImplement(CorridorState corridorState)
        {
            ParamLongCollection paramsLong = corridorState.ParamsLong;
            ParamDoubleCollection paramsDouble = corridorState.ParamsDouble;

            // 1) อ่านค่า parameter
            var prm = new Core.TrapezoidParams
            {
                Side = (int)GetLong(paramsLong, Core.TrapezoidLogic.SideParam, Core.TrapezoidParams.SideDefault),
                TopWidth = GetDouble(paramsDouble, Core.TrapezoidLogic.TopWidthParam, Core.TrapezoidParams.TopWidthDefault),
                BottomWidth = GetDouble(paramsDouble, Core.TrapezoidLogic.BottomWidthParam, Core.TrapezoidParams.BottomWidthDefault),
                Depth = GetDouble(paramsDouble, Core.TrapezoidLogic.DepthParam, Core.TrapezoidParams.DepthDefault)
            };
            double flip = prm.Side == Core.TrapezoidParams.Left ? -1.0 : 1.0;

            // 2) เตรียม surface (null = Layout mode หรือไม่มี surface -> Core วาดคางหมูปกติ)
            Core.IGround ground = null;
            if (corridorState.Mode != CorridorMode.Layout)
            {
                ObjectId surfaceId = ObjectId.Null;
                try
                {
                    surfaceId = corridorState.ParamsSurface.Value(SurfaceTarget);
                }
                catch
                {
                    RecordWarning(corridorState, CorridorError.LogicalNameNotFound, "Target Surface");
                }

                if (!surfaceId.IsNull)
                {
                    try
                    {
                        ground = new Civil3DGround(corridorState, surfaceId, flip);
                    }
                    catch (Exception e)
                    {
                        RecordWarning(corridorState, CorridorError.Failure, "Trapezoid: คำนวณกับ surface ไม่สำเร็จ - " + e.Message);
                        ground = null;
                    }
                }
            }

            // เรียกเงื่อนไขทั้งหมดใน Core
            Core.SubassemblyResult result = Core.TrapezoidLogic.Build(prm, ground);

            // 3) ส่งต่อ error / warning และสร้าง geometry ใน Civil 3D
            foreach (Core.Issue issue in result.Issues)
            {
                if (issue.IsError)
                    RecordError(corridorState, ToCorridorError(issue.Kind), issue.Message);
                else
                    RecordWarning(corridorState, ToCorridorError(issue.Kind), issue.Message);
            }

            AddShape(corridorState, result);
        }

        // สร้าง points / links / shape จากผลลัพธ์ของ Core
        private static void AddShape(CorridorState corridorState, Core.SubassemblyResult result)
        {
            PointCollection points = corridorState.Points;
            LinkCollection links = corridorState.Links;
            ShapeCollection shapes = corridorState.Shapes;

            var corridorPoints = new Point[result.Points.Count];
            for (int i = 0; i < result.Points.Count; i++)
            {
                Core.OutPoint p = result.Points[i];
                corridorPoints[i] = points.Add(p.X, p.Y, "");
                if (!string.IsNullOrEmpty(p.Code))
                    corridorPoints[i].Codes.TryAdd(p.Code);
            }

            var corridorLinks = new Link[result.Links.Count];
            for (int i = 0; i < result.Links.Count; i++)
            {
                Core.OutLink l = result.Links[i];
                corridorLinks[i] = links.Add(new[] { corridorPoints[l.From], corridorPoints[l.To] }, "");
                foreach (string code in l.Codes)
                    corridorLinks[i].Codes.TryAdd(code);
            }

            Shape shape = shapes.Add(corridorLinks, "");
            foreach (string code in result.ShapeCodes)
                shape.Codes.TryAdd(code);
        }

        // ------------------------------------------------------------------
        // Helpers

        private static CorridorError ToCorridorError(Core.IssueKind kind)
        {
            switch (kind)
            {
                case Core.IssueKind.ValueShouldNotBeLessThanOrEqualToZero: return CorridorError.ValueShouldNotBeLessThanOrEqualToZero;
                case Core.IssueKind.ValueTooSmall: return CorridorError.ValueTooSmall;
                default: return CorridorError.Failure;
            }
        }

        private static long GetLong(ParamLongCollection paramsLong, string name, long defaultValue)
        {
            try { return paramsLong.Value(name); }
            catch { return defaultValue; }
        }

        private static double GetDouble(ParamDoubleCollection paramsDouble, string name, double defaultValue)
        {
            try { return paramsDouble.Value(name); }
            catch { return defaultValue; }
        }

        private static void RecordError(CorridorState corridorState, CorridorError error, string message)
        {
            corridorState.RecordError(error, CorridorErrorLevel.Severe, message, nameof(Trapezoid), true);
        }

        private static void RecordWarning(CorridorState corridorState, CorridorError error, string message)
        {
            corridorState.RecordError(error, CorridorErrorLevel.AsWarning, message, nameof(Trapezoid), true);
        }

        private static void RecordError(CorridorState corridorState, Exception e)
        {
            if (corridorState == null)
                return;
            corridorState.RecordError(CorridorError.Failure, CorridorErrorLevel.Severe, e.Message, e.Source, true);
        }
    }
}
