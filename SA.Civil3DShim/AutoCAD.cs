// ตัวจำลอง Autodesk.AutoCAD.* (เท่าที่ subassembly ใช้)

using System;
using SA.Shim;

namespace Autodesk.AutoCAD.DatabaseServices
{
    public struct ObjectId : IEquatable<ObjectId>
    {
        private readonly long _handle;
        private readonly string _label;

        public ObjectId(long handle, string label = null) { _handle = handle; _label = label; }

        public static ObjectId Null => default;
        public bool IsNull => _handle == 0;
        public bool IsValid => _handle != 0;
        public bool IsErased => false;
        public long OldIdPtr => _handle;

        public bool Equals(ObjectId other) => _handle == other._handle;
        public override bool Equals(object obj) => obj is ObjectId o && Equals(o);
        public override int GetHashCode() => _handle.GetHashCode();
        public static bool operator ==(ObjectId a, ObjectId b) => a._handle == b._handle;
        public static bool operator !=(ObjectId a, ObjectId b) => a._handle != b._handle;
        public override string ToString() => IsNull ? "(null)" : $"({_handle}) {_label}";
    }

    public enum OpenMode { ForRead = 0, ForWrite = 1, ForNotify = 2 }

    public class DBObject : IDisposable
    {
        public ObjectId ObjectId { get; internal set; }
        public ObjectId Id => ObjectId;
        public void Dispose() { }
    }

    public class Entity : DBObject
    {
        public string Layer { get; set; } = "0";
    }

    public class TransactionManager
    {
        public DBObject GetObject(ObjectId id, OpenMode mode) => Resolve(id);
        public DBObject GetObject(ObjectId id, OpenMode mode, bool openErased) => Resolve(id);
        public DBObject GetObject(ObjectId id, OpenMode mode, bool openErased, bool forceOpenOnLockedLayer) => Resolve(id);
        public Transaction StartTransaction() => new Transaction(this);
        public Transaction StartOpenCloseTransaction() => new Transaction(this);
        public Transaction TopTransaction => new Transaction(this);

        internal static DBObject Resolve(ObjectId id)
        {
            if (id == SimWorld.SurfaceId) return new Autodesk.Civil.DatabaseServices.TinSurface { ObjectId = id };
            if (id == SimWorld.AlignmentId) return new Autodesk.Civil.DatabaseServices.Alignment { ObjectId = id };
            throw new InvalidOperationException($"ตัวจำลอง: ไม่รู้จัก ObjectId {id} (รองรับเฉพาะ surface และ alignment ของเว็บ)");
        }
    }

    public class Transaction : IDisposable
    {
        private readonly TransactionManager _tm;
        internal Transaction(TransactionManager tm) { _tm = tm; }
        public DBObject GetObject(ObjectId id, OpenMode mode) => TransactionManager.Resolve(id);
        public DBObject GetObject(ObjectId id, OpenMode mode, bool openErased) => TransactionManager.Resolve(id);
        public DBObject GetObject(ObjectId id, OpenMode mode, bool openErased, bool forceOpenOnLockedLayer) => TransactionManager.Resolve(id);
        public void Commit() { }
        public void Abort() { }
        public void Dispose() { }
    }

    public class Database
    {
        public TransactionManager TransactionManager { get; } = new TransactionManager();
    }

    public static class HostApplicationServices
    {
        private static readonly Database _db = new Database();
        public static Database WorkingDatabase => _db;
    }
}

namespace Autodesk.AutoCAD.Geometry
{
    public struct Point2d
    {
        public Point2d(double x, double y) { X = x; Y = y; }
        public double X { get; }
        public double Y { get; }
        public double GetDistanceTo(Point2d p) => Math.Sqrt((X - p.X) * (X - p.X) + (Y - p.Y) * (Y - p.Y));
        public override string ToString() => $"({X},{Y})";
    }

    public struct Point3d
    {
        public Point3d(double x, double y, double z) { X = x; Y = y; Z = z; }
        public double X { get; }
        public double Y { get; }
        public double Z { get; }
        public double DistanceTo(Point3d p) => Math.Sqrt((X - p.X) * (X - p.X) + (Y - p.Y) * (Y - p.Y) + (Z - p.Z) * (Z - p.Z));
        public static Point3d Origin => new Point3d(0, 0, 0);
        public override string ToString() => $"({X},{Y},{Z})";
    }
}
