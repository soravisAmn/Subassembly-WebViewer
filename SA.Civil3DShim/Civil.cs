// ตัวจำลอง Autodesk.Civil, Autodesk.Civil.ApplicationServices, Autodesk.Civil.DatabaseServices

using System;
using SA.Shim;

namespace Autodesk.Civil
{
    public enum CorridorMode { Layout = 0, Corridor = 1 }

    public enum CorridorErrorLevel { Severe = 0, AsWarning = 1, Warning = 2 }

    public enum CorridorError
    {
        Failure,
        LogicalNameNotFound,
        ParameterNotFound,
        ValueTooSmall,
        ValueTooLarge,
        ValueShouldNotBeLessThanOrEqualToZero,
        ValueShouldNotBeLessThanZero,
        ValueShouldNotBeZero,
        ValueShouldNotBeGreaterThanZero,
        IntersectionNotFound,
        NoSideslopeIntersectFound,
        OutOfRange,
        NotSupported
    }

    public enum ParamLogicalNameType
    {
        Alignment = 1,
        Profile = 2,
        Surface = 3,
        OffsetTarget = 4,
        ElevationTarget = 5,
        OffsetTargetPipe = 6,
        ElevationTargetPipe = 7
    }

    // Civil 3D โยน exception นี้เมื่อถามระดับนอกขอบเขต surface
    public class PointNotOnEntityException : Exception
    {
        public PointNotOnEntityException(string message) : base(message) { }
    }
}

namespace Autodesk.Civil.ApplicationServices
{
    public class CivilDocument
    {
        public Autodesk.Civil.Runtime.CorridorState CorridorState => SimHost.Current;
    }

    public static class CivilApplication
    {
        private static readonly CivilDocument _doc = new CivilDocument();
        public static CivilDocument ActiveDocument => _doc;
    }
}

namespace Autodesk.Civil.DatabaseServices
{
    using Autodesk.AutoCAD.DatabaseServices;

    public class Surface : Entity
    {
        public string Name { get; set; } = "EG";

        public double FindElevationAtXY(double x, double y)
        {
            // x = offset จาก alignment (ระบบพิกัดจำลอง)
            return SimHost.World.ElevationAtOffset(x);
        }
    }

    public class TinSurface : Surface { }

    public class Alignment : Entity
    {
        public string Name { get; set; } = "Alignment";
        public double StartingStation => -1e6;
        public double EndingStation => 1e6;
        public double Length => 2e6;

        // alignment ตรงตามแกน +Y: x = offset, y = station
        public void PointLocation(double station, double offset, ref double easting, ref double northing)
        {
            easting = offset;
            northing = station;
        }

        public void StationOffset(double easting, double northing, ref double station, ref double offset)
        {
            station = northing;
            offset = easting;
        }
    }
}
