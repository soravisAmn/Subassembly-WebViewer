// ประกอบ subassembly หลายตัวเป็น assembly
//
// พิกัดบนจอ (web): X = ระยะแนวราบ, Y = ระดับเทียบ datum (ระดับจริง = Datum + Y)
// แกน assembly (baseline) วางที่ (Baseline.X, Baseline.Y) ได้อิสระ; alignment จำลองอยู่ที่แกนนี้ (offset 0)
//
// subassembly แต่ละตัวมีจุดเกาะ (origin) ได้ 3 แบบ:
//   baseline : เกาะที่แกน assembly
//   point    : เกาะที่จุดของ subassembly ตัวอื่น (หาจุดด้วย point code, ถ้าไม่มี code ใช้ลำดับจุด)
//   free     : ยังไม่ได้เกาะ ลอยอยู่ที่ (X, Y)
// รันตัวแม่ก่อนตัวลูกเสมอ แล้วแปลงจุดผลลัพธ์ (เทียบ origin) เป็นพิกัดบนจอ

using System.Text.Json;
using SA.Drawing;
using SA.Shim;

public class AttachReq
{
    public string Type { get; set; } = "free";   // baseline | point | free
    public string? Parent { get; set; }
    public string? Code { get; set; }
    public int? Index { get; set; }
    public double X { get; set; }                 // ตำแหน่งล่าสุดที่รู้ (ใช้เมื่อหาจุดเกาะไม่เจอ / free)
    public double Y { get; set; }
}

public class ItemReq
{
    public string Id { get; set; } = "";
    public string? File { get; set; }
    public string? Source { get; set; }
    public string? SourceName { get; set; }
    public string? ClassName { get; set; }
    public Dictionary<string, JsonElement>? Params { get; set; }
    public AttachReq Attach { get; set; } = new();
    // ส่วนที่วาดในเว็บ (DrawingSpec): ไม่มีไฟล์ = สร้างทั้งไฟล์จาก spec; มีไฟล์ที่มีช่วง SA-DRAWING = แทนที่ช่วงนั้นก่อนรัน
    public JsonElement? Spec { get; set; }
    public string? FileName { get; set; }
}

public class AssemblyReq
{
    public SurfacePt Baseline { get; set; } = new(0, 0);
    public double Datum { get; set; } = 100.0;
    public List<SurfacePt>? Surface { get; set; }
    public bool SurfaceAssigned { get; set; } = true;
    public bool ExtendEnds { get; set; } = true;
    public bool LayoutMode { get; set; }
    public double Station { get; set; }
    public bool Sites { get; set; } = true;          // เก็บบรรทัดที่เรียก Points / Links / Shapes.Add (CallSites)
    public List<ItemReq> Items { get; set; } = new();
}

public class ItemResult
{
    public string Id { get; set; } = "";
    public bool Ok { get; set; }
    public string? Stage { get; set; }             // file | compile | class (เมื่อ Ok = false)
    public string? Message { get; set; }
    public string? File { get; set; }
    public List<CompileDiagnostic>? Diagnostics { get; set; }
    public List<string?> Classes { get; set; } = new();
    public string? ClassName { get; set; }
    public double CompileMs { get; set; }
    public double OriginX { get; set; }
    public double OriginY { get; set; }
    public string AttachState { get; set; } = "free";  // baseline | point | free | lost
    public string? AttachNote { get; set; }
    public RunOutput? Result { get; set; }
    public bool Generated { get; set; }                // รันโค้ดที่สร้างจาก spec (รูปที่เว็บแสดงมาจาก JS ส่วนผลนี้ใช้ตรวจ)
    // เลขบรรทัดในผลนี้ (sites ของจุด/link/shape และ DrawnLines) อ้างข้อความไหน:
    //   file = ไฟล์บนดิสก์ · editor = โค้ดในแถบแก้ที่ส่งมา · preview = โค้ดที่สร้าง (ส่วนที่วาดยังไม่ได้ Save ลงไฟล์)
    public string LinesFor { get; set; } = "file";
    public Dictionary<string, List<int>>? DrawnLines { get; set; }   // id ที่วาด -> บรรทัด (CodeGenerator.SourceMap)
}

public class AssemblyService
{
    private readonly SubassemblyCompiler _compiler;
    private readonly SubassemblyRunner _runner;
    private readonly string _folder;

    public AssemblyService(SubassemblyCompiler compiler, SubassemblyRunner runner, string folder)
    {
        _compiler = compiler; _runner = runner; _folder = folder;
    }

    public List<ItemResult> Run(AssemblyReq req)
    {
        double bx = req.Baseline.X, by = req.Baseline.Y;
        double baselineElev = req.Datum + by;

        // surface ค่าจริง: offset = X - bx, elevation = Datum + Y
        var world = new SimWorld
        {
            Surface = (req.Surface ?? new()).Select(p => (p.X - bx, req.Datum + p.Y)).OrderBy(p => p.Item1).ToList(),
            SurfaceAssigned = req.SurfaceAssigned,
            ExtendEnds = req.ExtendEnds,
            LayoutMode = req.LayoutMode,
            Station = req.Station
        };

        var byId = req.Items.Where(i => !string.IsNullOrEmpty(i.Id)).GroupBy(i => i.Id).ToDictionary(g => g.Key, g => g.First());
        var done = new Dictionary<string, ItemResult>();
        var visiting = new HashSet<string>();

        ItemResult Resolve(ItemReq item)
        {
            if (done.TryGetValue(item.Id, out var r)) return r;
            var res = new ItemResult { Id = item.Id, OriginX = item.Attach.X, OriginY = item.Attach.Y };

            if (!visiting.Add(item.Id))
            {
                res.AttachState = "lost";
                res.AttachNote = "เกาะวนเป็นวง (ตัวลูกเกาะกลับไปหาตัวแม่) — ใช้ตำแหน่งล่าสุดแทน";
            }
            else
            {
                // 1) หาจุดเกาะ
                var a = item.Attach;
                switch (a.Type)
                {
                    case "baseline":
                        res.OriginX = bx; res.OriginY = by; res.AttachState = "baseline";
                        break;
                    case "point":
                        if (a.Parent == null || !byId.TryGetValue(a.Parent, out var parentReq))
                        {
                            res.AttachState = "lost"; res.AttachNote = "ไม่พบ subassembly ตัวแม่ — ใช้ตำแหน่งล่าสุดแทน";
                            break;
                        }
                        var parent = Resolve(parentReq);
                        var pts = parent.Result?.Points;
                        OutPt? hit = null;
                        if (pts != null)
                        {
                            bool indexOk = a.Index is int k && k >= 0 && k < pts.Count;
                            if (!string.IsNullOrEmpty(a.Code))
                                // code ซ้ำกันได้หลายจุด: ถ้าจุดลำดับเดิมยังมี code นี้ใช้จุดนั้น ไม่งั้นใช้จุดแรกที่มี code
                                hit = indexOk && pts[a.Index!.Value].Codes.Contains(a.Code) ? pts[a.Index!.Value]
                                    : pts.FirstOrDefault(p => p.Codes.Contains(a.Code));
                            else if (indexOk) hit = pts[a.Index!.Value];
                        }
                        if (hit != null)
                        {
                            res.OriginX = hit.X; res.OriginY = hit.Y; res.AttachState = "point";
                        }
                        else
                        {
                            res.AttachState = "lost";
                            res.AttachNote = pts == null
                                ? "ตัวแม่รันไม่สำเร็จ — ใช้ตำแหน่งล่าสุดแทน"
                                : !string.IsNullOrEmpty(a.Code)
                                    ? $"ตัวแม่ไม่มีจุด code '{a.Code}' แล้ว — ใช้ตำแหน่งล่าสุดแทน"
                                    : $"ตัวแม่ไม่มีจุดลำดับที่ {a.Index} แล้ว — ใช้ตำแหน่งล่าสุดแทน";
                        }
                        break;
                    default:
                        res.AttachState = "free";
                        break;
                }

                // 2) คอมไพล์และรัน
                RunItem(item, res, world, bx, req.Datum, baselineElev, req.Sites);
                visiting.Remove(item.Id);
            }

            done[item.Id] = res;
            return res;
        }

        foreach (var item in req.Items.Where(i => !string.IsNullOrEmpty(i.Id))) Resolve(item);
        return req.Items.Where(i => done.ContainsKey(i.Id)).Select(i => done[i.Id]).ToList();
    }

    private void RunItem(ItemReq item, ItemResult res, SimWorld world, double bx, double datum, double baselineElev, bool sites)
    {
        string source, name;
        string? disk = null;
        DrawingSpec? spec = null;
        try
        {
            if (item.Spec is { ValueKind: JsonValueKind.Object } sp) spec = DrawingSpec.Parse(sp);
        }
        catch (Exception e)
        {
            res.Stage = "generate"; res.Message = "อ่านส่วนที่วาดไม่ได้: " + e.Message; return;
        }

        if (spec != null && string.IsNullOrEmpty(item.Source) && string.IsNullOrEmpty(item.File))
        {
            // ADD ในเว็บ ยังไม่มีไฟล์: สร้างทั้งไฟล์ในหน่วยความจำ
            name = Path.GetFileName(item.FileName ?? spec.ClassName + ".cs");
            try { source = CodeGenerator.GenerateFile(spec, item.Spec!.Value.GetRawText(), name); }
            catch (FormatException e) { res.Stage = "generate"; res.File = name; res.Message = "สร้างโค้ดไม่ได้: " + e.Message; return; }
            res.Generated = true;
            res.LinesFor = "preview";
        }
        else if (!string.IsNullOrEmpty(item.Source))
        {
            source = item.Source;
            name = Path.GetFileName(item.SourceName ?? "opened.cs");
            res.LinesFor = "editor";
        }
        else if (!string.IsNullOrEmpty(item.File))
        {
            name = Path.GetFileName(item.File);
            var path = Path.Combine(_folder, name);
            if (!System.IO.File.Exists(path))
            {
                res.Stage = "file"; res.File = name;
                res.Message = $"ไม่พบไฟล์ {name} ในโฟลเดอร์";
                return;
            }
            source = disk = FileUtil.ReadShared(path);
        }
        else
        {
            res.Stage = "file"; res.Message = "ยังไม่ได้เลือกไฟล์ .cs"; return;
        }
        res.File = name;

        // ไฟล์ที่มีช่วง SA-DRAWING: ใช้ส่วนที่วาดล่าสุดในเว็บแทนช่วงเดิม (ยังไม่เขียนลงไฟล์จนกว่าจะกด Save)
        if (spec != null && !res.Generated && CodeGenerator.FindBlock(source) is { } block)
        {
            try { source = CodeGenerator.ReplaceBlock(source, block, CodeGenerator.GenerateBlock(spec, item.Spec!.Value.GetRawText(), block.Indent)); }
            catch (FormatException e) { res.Stage = "generate"; res.Message = "สร้างโค้ดไม่ได้: " + e.Message; return; }
            res.Generated = true;
            // ส่วนที่วาดตรงกับที่ Save ไว้ = ข้อความเดียวกับไฟล์ บรรทัดชี้ไฟล์ได้เลย
            if (disk != null && source != disk) res.LinesFor = "preview";
        }
        if (spec != null && res.Generated) res.DrawnLines = CodeGenerator.SourceMap(source);

        var compiled = _compiler.Compile(source, name);
        res.CompileMs = compiled.CompileMs;
        res.Diagnostics = compiled.Diagnostics;
        if (!compiled.Success) { res.Stage = "compile"; return; }
        if (compiled.Classes.Count == 0)
        {
            res.Stage = "class";
            res.Message = "ไม่พบ class ที่เป็น subassembly (ต้องเป็น public class ที่มีเมธอด public void Draw() ไม่มีพารามิเตอร์)";
            return;
        }

        var type = compiled.Classes.FirstOrDefault(t => t.FullName == item.ClassName) ?? compiled.Classes[0];
        res.Classes = compiled.Classes.Select(c => c.FullName).ToList();
        res.ClassName = type.FullName;

        double originOffset = res.OriginX - bx;
        double originElev = datum + res.OriginY;
        var output = _runner.Run(type, item.Params, world, originOffset, originElev, baselineElev, sites);

        // จุดเทียบ origin -> พิกัดบนจอ
        output.Points = output.Points.Select(p => p with { X = res.OriginX + p.X, Y = res.OriginY + p.Y }).ToList();
        res.Result = output;
        res.Ok = true;
    }
}

public static class FileUtil
{
    // อ่านไฟล์แม้ editor กำลังเปิด/เขียนอยู่
    public static string ReadShared(string path)
    {
        for (int i = 0; ; i++)
        {
            try
            {
                using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                using var sr = new StreamReader(fs);
                return sr.ReadToEnd();
            }
            catch (IOException) when (i < 5) { Thread.Sleep(80); }
        }
    }

    // ชื่อไฟล์ assembly ที่ปลอดภัย: ตัด path ออก แล้วบังคับนามสกุล .assembly.json
    public static string? AssemblyFileName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        name = Path.GetFileName(name.Trim());
        if (name.EndsWith(".assembly.json", StringComparison.OrdinalIgnoreCase)) name = name[..^".assembly.json".Length];
        foreach (var c in Path.GetInvalidFileNameChars()) name = name.Replace(c, '_');
        if (name.Length == 0 || name.StartsWith(".")) return null;
        return name + ".assembly.json";
    }
}
