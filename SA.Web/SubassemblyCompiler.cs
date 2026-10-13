// คอมไพล์ไฟล์ .cs ของ subassembly ตอนรันด้วย Roslyn
// อ้างอิง: .NET runtime + SA.Civil3DShim (ตัวจำลอง Autodesk.*)
// ผลลัพธ์ถูก cache ตามเนื้อหาไฟล์ -> ไฟล์ไม่เปลี่ยนก็ไม่คอมไพล์ซ้ำ

using System.Reflection;
using System.Runtime.Loader;
using System.Security.Cryptography;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Emit;
using Microsoft.CodeAnalysis.Text;

public record CompileDiagnostic(string Severity, string Id, int Line, int Column, string Message);

public class CompiledSubassembly
{
    public required string Hash { get; init; }
    public bool Success { get; init; }
    public List<CompileDiagnostic> Diagnostics { get; init; } = new();
    public Assembly? Assembly { get; init; }
    public AssemblyLoadContext? Context { get; init; }
    public List<Type> Classes { get; init; } = new();
    public double CompileMs { get; init; }
}

public class SubassemblyCompiler
{
    private readonly object _gate = new();
    private readonly Dictionary<string, CompiledSubassembly> _cache = new();
    private readonly LinkedList<string> _order = new();
    private const int MaxCache = 12;
    private List<MetadataReference>? _refs;

    public CompiledSubassembly Compile(string source, string fileName)
    {
        string hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(fileName + "\n" + source)));
        lock (_gate)
        {
            if (_cache.TryGetValue(hash, out var hit)) return hit;

            var result = CompileCore(source, fileName, hash);
            _cache[hash] = result;
            _order.AddLast(hash);
            while (_order.Count > MaxCache)
            {
                var old = _order.First!.Value;
                _order.RemoveFirst();
                if (_cache.Remove(old, out var gone)) gone.Context?.Unload();
            }
            return result;
        }
    }

    private CompiledSubassembly CompileCore(string source, string fileName, string hash)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var parseOptions = new CSharpParseOptions(LanguageVersion.Latest, preprocessorSymbols: new[] { "DEBUG", "TRACE", "SA_VIEWER" });
        var text = SourceText.From(source, Encoding.UTF8);
        var tree = CSharpSyntaxTree.ParseText(text, parseOptions, path: fileName);

        var compilation = CSharpCompilation.Create(
            "SA_" + Path.GetFileNameWithoutExtension(fileName) + "_" + hash[..8],
            new[] { tree },
            References(),
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary,
                optimizationLevel: OptimizationLevel.Debug,
                nullableContextOptions: NullableContextOptions.Disable));

        using var pe = new MemoryStream();
        using var pdb = new MemoryStream();
        EmitResult emit = compilation.Emit(pe, pdb,
            embeddedTexts: new[] { EmbeddedText.FromSource(fileName, text) },
            options: new EmitOptions(debugInformationFormat: DebugInformationFormat.PortablePdb));

        var diags = emit.Diagnostics
            .Where(d => d.Severity == DiagnosticSeverity.Error || d.Severity == DiagnosticSeverity.Warning)
            .Where(d => d.Severity == DiagnosticSeverity.Error || d.Id != "CS1591")
            .Select(d =>
            {
                var span = d.Location.GetLineSpan();
                return new CompileDiagnostic(d.Severity.ToString(), d.Id,
                    span.StartLinePosition.Line + 1, span.StartLinePosition.Character + 1, d.GetMessage());
            })
            .OrderBy(d => d.Severity == "Error" ? 0 : 1).ThenBy(d => d.Line)
            .ToList();

        if (!emit.Success)
            return new CompiledSubassembly { Hash = hash, Success = false, Diagnostics = diags, CompileMs = sw.Elapsed.TotalMilliseconds };

        pe.Position = 0; pdb.Position = 0;
        var ctx = new AssemblyLoadContext("SA:" + fileName + ":" + hash[..8], isCollectible: true);
        var asm = ctx.LoadFromStream(pe, pdb);

        var classes = asm.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && t.IsPublic
                        && t.GetConstructor(Type.EmptyTypes) != null
                        && t.GetMethod("Draw", BindingFlags.Public | BindingFlags.Instance, Type.EmptyTypes) != null)
            .OrderBy(t => t.FullName)
            .ToList();

        return new CompiledSubassembly
        {
            Hash = hash, Success = true, Diagnostics = diags, Assembly = asm, Context = ctx,
            Classes = classes, CompileMs = sw.Elapsed.TotalMilliseconds
        };
    }

    // .NET runtime + ตัวจำลอง Civil 3D (ไม่รวม assembly ของเว็บเอง เพื่อกันชื่อชนกัน)
    private List<MetadataReference> References()
    {
        if (_refs != null) return _refs;
        string runtimeDir = Path.GetDirectoryName(typeof(object).Assembly.Location)!;
        var files = Directory.GetFiles(runtimeDir, "*.dll")
            .Where(f =>
            {
                var n = Path.GetFileName(f);
                return n.StartsWith("System.") || n == "System.dll" || n == "netstandard.dll" || n == "mscorlib.dll"
                       || n == "Microsoft.CSharp.dll" || n == "Microsoft.VisualBasic.dll" || n == "Microsoft.Win32.Primitives.dll";
            })
            .Where(IsManaged)
            .ToList();
        files.Add(typeof(Autodesk.Civil.Runtime.CorridorState).Assembly.Location);
        _refs = files.Select(f => (MetadataReference)MetadataReference.CreateFromFile(f)).ToList();
        return _refs;
    }

    private static bool IsManaged(string path)
    {
        try { AssemblyName.GetAssemblyName(path); return true; }
        catch { return false; }
    }
}
