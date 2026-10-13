// ตัวจำลอง Autodesk.Civil.Runtime: CorridorState, parameter, point / link / shape

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Autodesk.AutoCAD.DatabaseServices;
using SA.Shim;

namespace Autodesk.Civil.Runtime
{
    // ---------------- parameters ----------------

    public class Param<T>
    {
        internal Param(string key, T value) { Key = key; Value = value; DefaultValue = value; }
        public string Key { get; }
        public string Name => Key;
        public T Value { get; set; }
        public T DefaultValue { get; internal set; }
        public string DisplayName { get; set; }
        public string Description { get; set; }
    }

    public class ParamLong : Param<long> { internal ParamLong(string k, long v) : base(k, v) { } }
    public class ParamDouble : Param<double> { internal ParamDouble(string k, double v) : base(k, v) { } }
    public class ParamString : Param<string> { internal ParamString(string k, string v) : base(k, v) { } }
    public class ParamBool : Param<bool> { internal ParamBool(string k, bool v) : base(k, v) { } }

    public abstract class ParamCollection<TParam, T> : IEnumerable<TParam> where TParam : Param<T>
    {
        protected readonly List<TParam> Items = new List<TParam>();
        protected abstract TParam Create(string key, T value);

        public int Count => Items.Count;
        public TParam this[int index] => Items[index];
        public bool Contains(string key) => Find(key) != null;

        public TParam Add(string key, T value)
        {
            var p = Find(key);
            if (p != null) { p.Value = value; return p; }
            p = Create(key, value);
            Items.Add(p);
            return p;
        }

        public T Value(string key)
        {
            var p = Find(key);
            if (p == null) throw new ArgumentException($"ไม่พบ parameter '{key}'");
            return p.Value;
        }

        public bool TryGetValue(string key, out T value)
        {
            var p = Find(key);
            value = p == null ? default : p.Value;
            return p != null;
        }

        internal TParam Find(string key) => Items.FirstOrDefault(i => string.Equals(i.Key, key, StringComparison.OrdinalIgnoreCase));
        internal IReadOnlyList<TParam> All => Items;

        public IEnumerator<TParam> GetEnumerator() => Items.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => Items.GetEnumerator();
    }

    public class ParamLongCollection : ParamCollection<ParamLong, long> { protected override ParamLong Create(string k, long v) => new ParamLong(k, v); }
    public class ParamDoubleCollection : ParamCollection<ParamDouble, double> { protected override ParamDouble Create(string k, double v) => new ParamDouble(k, v); }
    public class ParamStringCollection : ParamCollection<ParamString, string> { protected override ParamString Create(string k, string v) => new ParamString(k, v); }
    public class ParamBoolCollection : ParamCollection<ParamBool, bool> { protected override ParamBool Create(string k, bool v) => new ParamBool(k, v); }

    // target (surface / alignment / profile) -> ObjectId
    public class ParamObjectIdCollection
    {
        private readonly Dictionary<string, ObjectId> _map = new Dictionary<string, ObjectId>(StringComparer.OrdinalIgnoreCase);
        private readonly string _kind;
        internal ParamObjectIdCollection(string kind) { _kind = kind; }

        public int Count => _map.Count;
        public bool Contains(string key) => _map.ContainsKey(key);

        public ObjectId Value(string key)
        {
            if (!_map.TryGetValue(key, out var id))
                throw new ArgumentException($"ยังไม่ได้กำหนด {_kind} target '{key}'");
            return id;
        }

        public void Add(string key, ObjectId id) => _map[key] = id;
        internal void Set(string key, ObjectId id) => _map[key] = id;
    }

    public class ParamSurfaceCollection : ParamObjectIdCollection { internal ParamSurfaceCollection() : base("surface") { } }
    public class ParamAlignmentCollection : ParamObjectIdCollection { internal ParamAlignmentCollection() : base("alignment") { } }
    public class ParamProfileCollection : ParamObjectIdCollection { internal ParamProfileCollection() : base("profile") { } }

    // ---------------- codes / points / links / shapes ----------------

    public class CodeCollection : IEnumerable<string>
    {
        private readonly List<string> _codes = new List<string>();
        public int Count => _codes.Count;
        public string this[int index] => _codes[index];
        public bool Contains(string code) => _codes.Contains(code);
        public void Add(string code) { if (!string.IsNullOrEmpty(code) && !_codes.Contains(code)) _codes.Add(code); }
        public bool TryAdd(string code)
        {
            if (string.IsNullOrEmpty(code) || _codes.Contains(code)) return false;
            _codes.Add(code); return true;
        }
        public void Remove(string code) => _codes.Remove(code);
        public void Clear() => _codes.Clear();
        public IEnumerator<string> GetEnumerator() => _codes.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => _codes.GetEnumerator();
    }

    public class Point
    {
        internal Point(int index, double offset, double elevation) { Index = index; Offset = offset; Elevation = elevation; }
        public int Index { get; }
        public double Offset { get; set; }      // เทียบ origin ของ subassembly
        public double Elevation { get; set; }   // เทียบ origin ของ subassembly
        public CodeCollection Codes { get; } = new CodeCollection();
    }

    public class Link
    {
        internal Link(int index, Point[] points) { Index = index; Points = points; }
        public int Index { get; }
        public Point[] Points { get; }
        public Point StartPoint => Points[0];
        public Point EndPoint => Points[Points.Length - 1];
        public CodeCollection Codes { get; } = new CodeCollection();
    }

    public class Shape
    {
        internal Shape(int index, Link[] links) { Index = index; Links = links; }
        public int Index { get; }
        public Link[] Links { get; }
        public CodeCollection Codes { get; } = new CodeCollection();
    }

    public class PointCollection : IEnumerable<Point>
    {
        private readonly List<Point> _items = new List<Point>();
        public int Count => _items.Count;
        public Point this[int index] => _items[index];

        public Point Add(double offset, double elevation, string code)
        {
            if (double.IsNaN(offset) || double.IsNaN(elevation) || double.IsInfinity(offset) || double.IsInfinity(elevation))
                throw new ArgumentException($"Points.Add: ค่าพิกัดไม่ถูกต้อง ({offset}, {elevation})");
            var p = new Point(_items.Count, offset, elevation);
            p.Codes.Add(code);
            _items.Add(p);
            return p;
        }

        public IEnumerator<Point> GetEnumerator() => _items.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => _items.GetEnumerator();
    }

    public class LinkCollection : IEnumerable<Link>
    {
        private readonly List<Link> _items = new List<Link>();
        public int Count => _items.Count;
        public Link this[int index] => _items[index];

        public Link Add(Point[] points, string code)
        {
            if (points == null || points.Length < 2 || points.Any(p => p == null))
                throw new ArgumentException("Links.Add: ต้องมีอย่างน้อย 2 จุด และห้ามเป็น null");
            var l = new Link(_items.Count, points.ToArray());
            l.Codes.Add(code);
            _items.Add(l);
            return l;
        }

        public IEnumerator<Link> GetEnumerator() => _items.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => _items.GetEnumerator();
    }

    public class ShapeCollection : IEnumerable<Shape>
    {
        private readonly List<Shape> _items = new List<Shape>();
        public int Count => _items.Count;
        public Shape this[int index] => _items[index];

        public Shape Add(Link[] links, string code)
        {
            if (links == null || links.Length < 1 || links.Any(l => l == null))
                throw new ArgumentException("Shapes.Add: ต้องมีอย่างน้อย 1 link และห้ามเป็น null");
            var s = new Shape(_items.Count, links.ToArray());
            s.Codes.Add(code);
            _items.Add(s);
            return s;
        }

        public IEnumerator<Shape> GetEnumerator() => _items.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => _items.GetEnumerator();
    }

    // ---------------- station / offset / elevation ----------------

    public interface IPoint
    {
        double Station { get; }
        double Offset { get; }
        double Elevation { get; }
    }

    public class PointInMem : IPoint
    {
        public double Station { get; set; }
        public double Offset { get; set; }
        public double Elevation { get; set; }
    }

    public class SampledSectionLink
    {
        public double StartPointOffset { get; internal set; }
        public double StartPointElevation { get; internal set; }
        public double EndPointOffset { get; internal set; }
        public double EndPointElevation { get; internal set; }
    }

    public class SampledSectionLinkCollection : IEnumerable<SampledSectionLink>
    {
        internal readonly List<SampledSectionLink> Items = new List<SampledSectionLink>();
        public int Count => Items.Count;
        public SampledSectionLink this[int index] => Items[index];
        public IEnumerator<SampledSectionLink> GetEnumerator() => Items.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => Items.GetEnumerator();
    }

    // ---------------- CorridorState ----------------

    public class CorridorState
    {
        public CorridorState(SimWorld world)
        {
            World = world;
            Mode = world.LayoutMode ? CorridorMode.Layout : CorridorMode.Corridor;
            CurrentStation = world.Station;
            CurrentOffset = world.OriginOffset;
            CurrentElevation = world.OriginElevation;
        }

        public SimWorld World { get; }

        public ParamLongCollection ParamsLong { get; } = new ParamLongCollection();
        public ParamDoubleCollection ParamsDouble { get; } = new ParamDoubleCollection();
        public ParamStringCollection ParamsString { get; } = new ParamStringCollection();
        public ParamBoolCollection ParamsBool { get; } = new ParamBoolCollection();
        public ParamSurfaceCollection ParamsSurface { get; } = new ParamSurfaceCollection();
        public ParamAlignmentCollection ParamsAlignment { get; } = new ParamAlignmentCollection();
        public ParamProfileCollection ParamsProfile { get; } = new ParamProfileCollection();

        // output parameters (เก็บแยก แต่ใช้ชนิดเดียวกัน)
        public ParamLongCollection ParamsLongOutput { get; } = new ParamLongCollection();
        public ParamDoubleCollection ParamsDoubleOutput { get; } = new ParamDoubleCollection();

        public PointCollection Points { get; } = new PointCollection();
        public LinkCollection Links { get; } = new LinkCollection();
        public ShapeCollection Shapes { get; } = new ShapeCollection();

        public CorridorMode Mode { get; set; }

        public double CurrentStation { get; set; }
        public double CurrentOffset { get; set; }
        public double CurrentElevation { get; set; }
        public ObjectId CurrentAlignmentId { get; set; } = SimWorld.AlignmentId;
        public ObjectId CurrentBaselineId { get; set; } = SimWorld.AlignmentId;
        public ObjectId CurrentProfileId { get; set; } = SimWorld.ProfileId;
        public bool CurrentAlignmentIsOffsetAlignment { get; set; }
        public bool CurrentAssemblyOffsetIsFixed { get; set; }
        public double CurrentAssemblyFixedOffset { get; set; }
        public double CurrentAssemblyFixedElevation { get; set; }
        public bool CurrentSubassemblyIsReversed { get; set; }

        public List<SimIssue> Issues { get; } = new List<SimIssue>();

        public void RecordError(CorridorError error, CorridorErrorLevel level, string message, string source, bool notify)
        {
            Issues.Add(new SimIssue { Error = error.ToString(), Level = level.ToString(), Message = message, Source = source });
        }

        // ลากเส้นจาก start ไปทางขวา/ซ้ายด้วย slope จนชน surface (พิกัด absolute)
        public IPoint IntersectSurface(ObjectId surfaceId, ObjectId alignmentId, IPoint start, bool lookRight, double slope)
        {
            CheckSurface(surfaceId);
            var hit = World.Intersect(start.Offset, start.Elevation, lookRight ? 1.0 : -1.0, slope);
            if (hit == null)
                throw new InvalidOperationException("IntersectSurface: เส้น slope ไม่ชน surface ภายในขอบเขตของเส้น surface");
            return new PointInMem { Station = start.Station, Offset = hit.Value.O, Elevation = hit.Value.E };
        }

        // ผิว surface ระหว่าง p1 ถึง p2 เป็น link ย่อย (พิกัด absolute)
        public SampledSectionLinkCollection SampleSection(ObjectId surfaceId, ObjectId alignmentId, IPoint p1, IPoint p2)
        {
            CheckSurface(surfaceId);
            double a = Math.Min(p1.Offset, p2.Offset), b = Math.Max(p1.Offset, p2.Offset);
            var s = World.SurfaceAbs();
            var xs = new List<double> { a };
            xs.AddRange(s.Where(p => p.O > a + 1e-9 && p.O < b - 1e-9).Select(p => p.O));
            xs.Add(b);

            var col = new SampledSectionLinkCollection();
            for (int i = 0; i < xs.Count - 1; i++)
            {
                col.Items.Add(new SampledSectionLink
                {
                    StartPointOffset = xs[i],
                    StartPointElevation = World.ElevationAtOffset(xs[i]),
                    EndPointOffset = xs[i + 1],
                    EndPointElevation = World.ElevationAtOffset(xs[i + 1])
                });
            }
            return col;
        }

        private void CheckSurface(ObjectId id)
        {
            if (id != SimWorld.SurfaceId)
                throw new ArgumentException($"ตัวจำลอง: ObjectId {id} ไม่ใช่ surface ของเว็บ");
        }
    }
}
