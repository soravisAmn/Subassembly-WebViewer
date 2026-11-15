// Round 8: file paths of a project folder (docs/prompts/prompt-8-design.md section 2.1).
//   - a project file stores paths relative to itself ("pavement.cs", "lib\x.cs", "..\shared\x.cs"); "/" or "\" accepted
//   - a request names a file relative to the project folder; it may go into subfolders, and outside the folder only when
//     the project file itself references that file (allowOutside)
//   - absolute paths are never written into a project file

namespace SA.Projects;

public static class ProjectPaths
{
    static readonly StringComparison Cmp = StringComparison.OrdinalIgnoreCase;

    // Absolute path of rel inside dir, or null when rel is not allowed.
    //   exts: allowed extensions (".cs", ".assembly.json", …); none = any
    public static string? Resolve(string dir, string? rel, Func<string, bool>? allowOutside = null, params string[] exts)
    {
        if (string.IsNullOrWhiteSpace(rel)) return null;
        rel = rel.Trim().Replace('/', '\\');
        if (Path.IsPathRooted(rel) || rel.Contains(':')) return null;
        var parts = rel.Split('\\');
        foreach (var p in parts)
        {
            if (p.Length == 0) return null;
            if (p == "..") continue;
            if (p.StartsWith('.') || p.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0) return null;
        }
        var name = parts[^1];
        if (name == "..") return null;
        if (exts.Length > 0 && !exts.Any(e => name.EndsWith(e, Cmp) && name.Length > e.Length)) return null;
        var full = Path.GetFullPath(Path.Combine(dir, rel));
        if (IsInside(dir, full)) return full;
        return allowOutside != null && allowOutside(full) ? full : null;
    }

    // full is dir itself or below it
    public static bool IsInside(string dir, string full)
    {
        var d = Path.GetFullPath(dir).TrimEnd('\\', '/') + "\\";
        return Path.GetFullPath(full).StartsWith(d, Cmp);
    }

    // Relative path from dir to full, written with sep. Null when there is none (another drive).
    public static string? ToRelative(string dir, string full, char sep = '\\')
    {
        var rel = Path.GetRelativePath(Path.GetFullPath(dir), Path.GetFullPath(full));
        if (Path.IsPathRooted(rel)) return null;
        return sep == '/' ? rel.Replace('\\', '/') : rel.Replace('/', '\\');
    }

    // Absolute path of a project-file entry (any relative path, ".." allowed); null when it is not a relative file path
    public static string? Entry(string dir, string? rel)
    {
        if (string.IsNullOrWhiteSpace(rel)) return null;
        rel = rel.Trim().Replace('/', '\\');
        if (Path.IsPathRooted(rel) || rel.Contains(':') || rel.IndexOfAny(Path.GetInvalidPathChars()) >= 0) return null;
        return Path.GetFullPath(Path.Combine(dir, rel));
    }

    // Style of the separators a project file already uses (default "\")
    public static char SepOf(IEnumerable<string?> paths) =>
        paths.Any(p => p != null && p.Contains('/')) && !paths.Any(p => p != null && p.Contains('\\')) ? '/' : '\\';
}
