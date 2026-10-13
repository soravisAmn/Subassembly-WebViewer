// รัน subassembly ที่คอมไพล์แล้ว ตามลำดับเดียวกับ Civil 3D:
//   GetLogicalNames -> GetInputParameters -> GetOutputParameters -> (กำหนดค่า parameter / target) -> Draw
// แล้วเก็บ points / links / shapes / RecordError / Console output ส่งกลับให้เว็บ

using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using Autodesk.Civil;
using Autodesk.Civil.Runtime;
using SA.Shim;

public class WorldInput
{
    public List<SurfacePt>? Surface { get; set; }
    public bool SurfaceAssigned { get; set; } = true;
    public bool ExtendEnds { get; set; } = true;
    public bool LayoutMode { get; set; }
    public double OriginElevation { get; set; } = 100.0;
    public double Station { get; set; } = 0.0;
}

public record SurfacePt(double X, double Y);

public class ParamDef
{
    public required string Name { get; init; }
    public required string Kind { get; init; }     // long | double | string | bool
    public object? Default { get; init; }
    public string? DisplayName { get; init; }
    public string? Description { get; init; }
}

public class TargetDef
{
    public required string Name { get; init; }
    public required string Type { get; init; }
    public string? DisplayName { get; init; }
    public bool Assigned { get; init; }
    public bool Supported { get; init; }
}

public class RunOutput
{
    public string ClassName { get; set; } = "";
    public List<ParamDef> Params { get; } = new();
    public List<TargetDef> Targets { get; } = new();
    public List<object> Points { get; } = new();
    public List<object> Links { get; } = new();
    public List<object> Shapes { get; } = new();
    public List<SimIssue> Issues { get; set; } = new();
    public List<string> Log { get; } = new();
    public object? Exception { get; set; }
    public string? Stage { get; set; }
    public double RunMs { get; set; }
}

public class SubassemblyRunner
{
    private readonly object _gate = new();
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    public RunOutput Run(Type type, Dictionary<string, JsonElement>? values, WorldInput w)
    {
        lock (_gate)
        {
            var world = new SimWorld
            {
                Surface = (w.Surface ?? new()).Select(p => (p.X, p.Y)).OrderBy(p => p.X).ToList(),
                SurfaceAssigned = w.SurfaceAssigned,
                ExtendEnds = w.ExtendEnds,
                LayoutMode = w.LayoutMode,
                OriginElevation = w.OriginElevation,
                Station = w.Station
            };
            var cs = new CorridorState(world);
            var output = new RunOutput { ClassName = type.FullName ?? type.Name };

            var log = new StringWriter();
            var oldOut = Console.Out;
            var listener = new TextWriterTraceListener(log);
            var sw = Stopwatch.StartNew();

            Console.SetOut(log);
            Trace.Listeners.Add(listener);
            try
            {
                var task = Task.Run(() =>
                {
                    SimHost.Current = cs;
                    object inst = Activator.CreateInstance(type)!;

                    output.Stage = "GetLogicalNames";
                    Call(inst, "GetLogicalNames");
                    int targetCount = cs.ParamsLong.Count;

                    output.Stage = "GetInputParameters";
                    Call(inst, "GetInputParameters");
                    output.Stage = "GetOutputParameters";
                    Call(inst, "GetOutputParameters");

                    CollectDefs(cs, targetCount, output);
                    ApplyValues(cs, targetCount, values);
                    AssignTargets(cs, targetCount, world, output);

                    output.Stage = "Draw";
                    Call(inst, "Draw");
                    output.Stage = null;
                });

                if (!task.Wait(Timeout))
                {
                    output.Exception = new { type = "Timeout", message = $"โค้ดทำงานเกิน {Timeout.TotalSeconds:0} วินาทีในขั้น {output.Stage} (วนลูปไม่จบ?) — ถ้าเว็บช้าลงให้ปิดแล้วเปิดใหม่", stack = "" };
                }
            }
            catch (AggregateException ae)
            {
                var e = ae.InnerException is TargetInvocationException tie && tie.InnerException != null ? tie.InnerException : ae.InnerException ?? ae;
                output.Exception = new { type = e.GetType().Name, message = e.Message, stack = UserStack(e) };
            }
            finally
            {
                Console.Out.Flush();
                Console.SetOut(oldOut);
                Trace.Listeners.Remove(listener);
            }

            output.RunMs = sw.Elapsed.TotalMilliseconds;
            output.Issues = cs.Issues.ToList();
            output.Log.AddRange(log.ToString().Split('\n').Select(l => l.TrimEnd('\r')).Where(l => l.Length > 0));
            CollectGeometry(cs, output);
            return output;
        }
    }

    private static void Call(object inst, string name)
    {
        var m = inst.GetType().GetMethod(name, BindingFlags.Public | BindingFlags.Instance, Type.EmptyTypes);
        if (m == null) return;
        try { m.Invoke(inst, null); }
        catch (TargetInvocationException e) when (e.InnerException != null)
        {
            System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(e.InnerException).Throw();
        }
    }

    // parameter ที่เพิ่มใน GetLogicalNames (ParamsLong ลำดับแรกๆ) คือ target ไม่ใช่ input
    private static void CollectDefs(CorridorState cs, int targetCount, RunOutput o)
    {
        int i = 0;
        foreach (var p in cs.ParamsLong)
        {
            if (i++ < targetCount) continue;
            o.Params.Add(new ParamDef { Name = p.Key, Kind = "long", Default = p.DefaultValue, DisplayName = p.DisplayName, Description = p.Description });
        }
        foreach (var p in cs.ParamsDouble)
            o.Params.Add(new ParamDef { Name = p.Key, Kind = "double", Default = p.DefaultValue, DisplayName = p.DisplayName, Description = p.Description });
        foreach (var p in cs.ParamsString)
            o.Params.Add(new ParamDef { Name = p.Key, Kind = "string", Default = p.DefaultValue, DisplayName = p.DisplayName, Description = p.Description });
        foreach (var p in cs.ParamsBool)
            o.Params.Add(new ParamDef { Name = p.Key, Kind = "bool", Default = p.DefaultValue, DisplayName = p.DisplayName, Description = p.Description });
    }

    private static void ApplyValues(CorridorState cs, int targetCount, Dictionary<string, JsonElement>? values)
    {
        if (values == null) return;
        int i = 0;
        foreach (var p in cs.ParamsLong)
        {
            if (i++ < targetCount) continue;
            if (values.TryGetValue(p.Key, out var v) && TryNumber(v, out double d)) p.Value = (long)Math.Round(d);
        }
        foreach (var p in cs.ParamsDouble)
            if (values.TryGetValue(p.Key, out var v) && TryNumber(v, out double d)) p.Value = d;
        foreach (var p in cs.ParamsString)
            if (values.TryGetValue(p.Key, out var v)) p.Value = v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString();
        foreach (var p in cs.ParamsBool)
            if (values.TryGetValue(p.Key, out var v) && (v.ValueKind == JsonValueKind.True || v.ValueKind == JsonValueKind.False)) p.Value = v.GetBoolean();
    }

    private static bool TryNumber(JsonElement v, out double d)
    {
        d = 0;
        if (v.ValueKind == JsonValueKind.Number) { d = v.GetDouble(); return true; }
        if (v.ValueKind == JsonValueKind.String && double.TryParse(v.GetString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out d)) return true;
        return false;
    }

    private static void AssignTargets(CorridorState cs, int targetCount, SimWorld world, RunOutput o)
    {
        for (int i = 0; i < targetCount; i++)
        {
            var p = cs.ParamsLong[i];
            var type = Enum.IsDefined(typeof(ParamLogicalNameType), (int)p.Value) ? ((ParamLogicalNameType)(int)p.Value).ToString() : $"Unknown({p.Value})";
            bool assigned = false, supported = true;
            switch ((ParamLogicalNameType)(int)p.Value)
            {
                case ParamLogicalNameType.Surface:
                    if (world.SurfaceAssigned && world.Surface.Count >= 2)
                    {
                        cs.ParamsSurface.Add(p.Key, SimWorld.SurfaceId);
                        assigned = true;
                    }
                    break;
                case ParamLogicalNameType.Alignment:
                    cs.ParamsAlignment.Add(p.Key, SimWorld.AlignmentId); assigned = true; break;
                case ParamLogicalNameType.Profile:
                    cs.ParamsProfile.Add(p.Key, SimWorld.ProfileId); assigned = true; break;
                default:
                    supported = false; break;
            }
            o.Targets.Add(new TargetDef { Name = p.Key, Type = type, DisplayName = p.DisplayName, Assigned = assigned, Supported = supported });
        }
    }

    private static void CollectGeometry(CorridorState cs, RunOutput o)
    {
        foreach (var p in cs.Points)
            o.Points.Add(new { x = p.Offset, y = p.Elevation, codes = p.Codes.ToArray() });
        foreach (var l in cs.Links)
            o.Links.Add(new { pts = l.Points.Select(p => p.Index).ToArray(), codes = l.Codes.ToArray() });
        foreach (var s in cs.Shapes)
            o.Shapes.Add(new { links = s.Links.Select(l => l.Index).ToArray(), codes = s.Codes.ToArray(), polygon = ChainPolygon(s) });
    }

    // เรียง link ของ shape ให้ต่อกันเป็นรูปปิด (สำหรับระบายสี) ถ้าต่อไม่ได้คืน null
    private static int[]? ChainPolygon(Shape s)
    {
        var rest = s.Links.Select(l => l.Points.Select(p => p.Index).ToList()).ToList();
        if (rest.Count == 0) return null;
        var chain = new List<int>(rest[0]);
        rest.RemoveAt(0);
        while (rest.Count > 0)
        {
            int end = chain[^1];
            int k = rest.FindIndex(r => r[0] == end || r[^1] == end);
            if (k < 0) return null;
            var seg = rest[k]; rest.RemoveAt(k);
            if (seg[0] != end) seg.Reverse();
            chain.AddRange(seg.Skip(1));
        }
        if (chain.Count > 1 && chain[0] == chain[^1]) chain.RemoveAt(chain.Count - 1);
        return chain.Count >= 3 ? chain.ToArray() : null;
    }

    // เก็บเฉพาะบรรทัด stack trace ที่อยู่ในไฟล์ของผู้ใช้ (ตัดส่วนของเว็บ/ตัวจำลองออก)
    private static string UserStack(Exception e)
    {
        var lines = (e.StackTrace ?? "").Split('\n').Select(l => l.Trim())
            .Where(l => l.Length > 0 && !l.StartsWith("---") && !l.Contains("InvokeStub_") && !l.Contains("SubassemblyRunner") && !l.StartsWith("at System."))
            .ToList();
        return string.Join("\n", lines);
    }
}
