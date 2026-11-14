// Round 7: namespace + class of every subassembly class in a .cs file, read with Roslyn (syntax only, so hand-written
// files that use API members the simulator lacks are still read), plus the checks the Build dialog shows.
// A subassembly class = a top-level, non-static class with an instance method Draw() without parameters (as the
// compiler of the viewer looks for). Static helpers such as the generated SaDrawing_* class are not counted.

using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace SA.Build;

public record ClassInfo(string File, string Namespace, string Name, bool IsPublic, string[] MissingMethods)
{
    public string FullName => Namespace.Length == 0 ? Name : Namespace + "." + Name;
}

// Severity: "error" blocks the build, "warning" does not
public record BuildIssue(string Severity, string? File, string Message);

public static class ClassReader
{
    // The public methods Civil 3D calls on a .NET subassembly class
    public static readonly string[] CivilMethods = { "GetLogicalNames", "GetInputParameters", "GetOutputParameters", "Draw" };

    public static List<ClassInfo> Read(string source, string file)
    {
        var root = CSharpSyntaxTree.ParseText(source).GetCompilationUnitRoot();
        var list = new List<ClassInfo>();
        foreach (var cls in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
        {
            if (cls.Parent is TypeDeclarationSyntax) continue;   // nested classes are helpers
            if (cls.Modifiers.Any(SyntaxKind.StaticKeyword)) continue;   // e.g. the generated SaDrawing_* helper with Draw(cs)
            var methods = cls.Members.OfType<MethodDeclarationSyntax>().ToList();
            if (!methods.Any(m => m.Identifier.Text == "Draw" && m.ParameterList.Parameters.Count == 0 && !m.Modifiers.Any(SyntaxKind.StaticKeyword))) continue;

            bool IsPublicNoArgs(MethodDeclarationSyntax m) =>
                m.Modifiers.Any(SyntaxKind.PublicKeyword) && !m.Modifiers.Any(SyntaxKind.StaticKeyword) && m.ParameterList.Parameters.Count == 0;
            var missing = CivilMethods.Where(n => !methods.Any(m => m.Identifier.Text == n && IsPublicNoArgs(m))).ToArray();

            var ns = string.Join(".", cls.Ancestors().OfType<BaseNamespaceDeclarationSyntax>().Reverse().Select(n => n.Name.ToString()));
            bool isPublic = cls.Modifiers.Any(SyntaxKind.PublicKeyword) && !cls.Modifiers.Any(SyntaxKind.AbstractKeyword);
            list.Add(new ClassInfo(file, ns, cls.Identifier.Text, isPublic, missing));
        }
        return list;
    }

    // A namespace is valid when every dotted part is a C# identifier (an empty namespace is allowed)
    public static bool ValidNamespace(string ns) => ns.Length == 0 || ns.Split('.').All(ValidIdentifier);
    public static bool ValidIdentifier(string s) => SyntaxFacts.IsValidIdentifier(s) && SyntaxFacts.GetKeywordKind(s) == SyntaxKind.None;

    // classes = every class of the files going into one DLL; filesWithoutClass = files where Read found nothing
    public static List<BuildIssue> Check(IReadOnlyList<ClassInfo> classes, IEnumerable<string> filesWithoutClass)
    {
        var issues = new List<BuildIssue>();
        foreach (var f in filesWithoutClass)
            issues.Add(new("error", f, "ไม่พบ class ที่เป็น subassembly (ต้องมีเมธอด Draw)"));
        foreach (var c in classes)
        {
            if (!ValidIdentifier(c.Name)) issues.Add(new("error", c.File, $"ชื่อ class '{c.Name}' ใช้เป็นชื่อใน C# ไม่ได้"));
            if (!ValidNamespace(c.Namespace)) issues.Add(new("error", c.File, $"namespace '{c.Namespace}' ใช้เป็นชื่อใน C# ไม่ได้"));
            if (!c.IsPublic) issues.Add(new("error", c.File, $"{c.FullName} ต้องเป็น public class (Civil 3D มองไม่เห็น class ที่ไม่ public)"));
            if (c.MissingMethods.Length > 0)
                issues.Add(new("warning", c.File, $"{c.FullName} ไม่มีเมธอด public {string.Join(", ", c.MissingMethods)}() ที่ Civil 3D เรียก"));
        }
        foreach (var g in classes.GroupBy(c => c.FullName).Where(g => g.Count() > 1))
            issues.Add(new("error", null, $"ชื่อเต็ม {g.Key} ซ้ำกันใน DLL เดียว: {string.Join(", ", g.Select(c => c.File))}"));
        foreach (var g in classes.GroupBy(c => c.FullName, StringComparer.OrdinalIgnoreCase).Where(g => g.Select(c => c.FullName).Distinct().Count() > 1))
            issues.Add(new("warning", null, $"ชื่อเต็มต่างกันแค่ตัวพิมพ์เล็ก/ใหญ่: {string.Join(", ", g.Select(c => c.FullName).Distinct())}"));
        return issues;
    }
}
