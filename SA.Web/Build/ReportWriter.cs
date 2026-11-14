// Round 7 M4: report.md in the output folder (and shown in the Build dialog). English headings, Thai explanations.
//   status, date, Civil 3D version, TFM, DLL, output files · full class names (what to type in Civil 3D) · per class:
//   parameter table + codes seen in the simulator runs · warnings and errors · parameter changes · next steps in Civil 3D

using System.Globalization;
using System.Text;

namespace SA.Build;

// Year = null for a source package (nothing built yet)
public record ReportData(string DllName, string? Project, BuildYearResult? Year, C3DInstall? C3D, BuildEngine.CatalogOutput Cat,
                         CheckResult? Check, IReadOnlyList<ClassInfo> Classes, DateTime At, string? Title = null);

public static class ReportWriter
{
    static string Cell(string? s) => string.IsNullOrEmpty(s) ? "—" : s.Replace("|", "\\|").Replace("\r", " ").Replace("\n", " ");
    static string Num(double? v) => v == null ? "" : v.Value.ToString("0.####", CultureInfo.InvariantCulture);

    public static string Build(ReportData d)
    {
        var y = d.Year;
        var sb = new StringBuilder();
        void L(string s = "") => sb.Append(s).Append("\r\n");
        bool ok = y?.Status == "ok";

        L($"# {d.Title ?? $"Build report: {d.DllName}.dll — Civil 3D {y?.Year}"}");
        L();
        L("| | |");
        L("|---|---|");
        if (y != null) L($"| Status | {(ok ? "✓ สำเร็จ" : "✖ ไม่สำเร็จ")} — {Cell(y.Message)} |");
        L($"| Date | {d.At:yyyy-MM-dd HH:mm} |");
        if (d.C3D != null) L($"| Civil 3D | {d.C3D.Year} ({Cell(d.C3D.Path)}) |");
        if (y != null) L($"| TFM | {y.Tfm} |");
        L($"| DLL | `{d.DllName}.dll` |");
        if (d.Project != null) L($"| Project | `{d.Project}` |");
        if (y != null) L($"| Output folder | `{y.OutDir}` |");
        if (y?.CopiedTo != null) L($"| Copy to | `{y.CopiedTo}` (DLL + .atc + icons) |");
        if (y?.CopyError != null) L($"| Copy to | ✖ {Cell(y.CopyError)} |");
        L();

        if (y != null && ok)
        {
            L("## Output files");
            L();
            foreach (var f in new[] { d.DllName + ".dll", d.DllName + ".atc", AtcWriter.CategoryFile(d.DllName), "report.md", "build.log", "build-manifest.json" })
                L($"- `{f}`");
            foreach (var icon in d.Cat.Icons.Keys.OrderBy(k => k)) L($"- `{icon}`");
            L();
        }

        L("## Classes");
        L();
        L("ชื่อเต็มของ class (namespace.class) — ชื่อที่ Civil 3D ใช้ (อยู่ใน .atc แล้ว ไม่ต้องพิมพ์เองถ้าใช้ catalog):");
        L();
        foreach (var c in d.Classes) L($"- `{c.FullName}` ({c.File})");
        L();

        foreach (var t in d.Cat.Tools)
        {
            var file = d.Cat.FileOf.TryGetValue(t.FullName, out var f) ? f : "";
            bool web = d.Check?.WebFiles.Contains(file) == true || t.Params.Any(p => p.FromSpec);
            L($"## {t.FullName}");
            L();
            L($"File `{file}` ({(web ? "สร้างจากเว็บ" : "เขียนเอง")}) · icon `{t.Icon}`");
            L();
            if (t.Params.Count == 0) L("ไม่มีรายการ parameter (ตัวจำลองรัน class นี้ไม่ได้)");
            else
            {
                L("| Name | Display name | Type | Default | Unit | Description | Min / Max | Options |");
                L("|---|---|---|---|---|---|---|---|");
                foreach (var p in t.Params)
                {
                    var bounds = string.Join(" ", new[] { p.Positive ? "> 0" : "", p.Min != null ? "min " + Num(p.Min) : "", p.Max != null ? "max " + Num(p.Max) : "" }.Where(s => s != ""));
                    var desc = !string.IsNullOrWhiteSpace(p.Description) ? p.Description : web ? null : "ไม่มีคำอธิบาย (ไฟล์เขียนเอง)";
                    var opts = p.Options is { Count: > 0 } ? string.Join(", ", p.Options.Select(o => $"{o.Value}={o.Label}")) : null;
                    L($"| `{p.Name}` | {Cell(p.DisplayName)} | {p.Kind} | {Cell(p.Default)} | {Cell(p.FromSpec ? p.Unit ?? "number" : null)} | {Cell(desc)} | {Cell(bounds)} | {Cell(opts)} |");
                }
            }
            L();
            if (d.Check != null && d.Check.Codes.TryGetValue(t.FullName, out var cc))
            {
                string List(SortedSet<string> s) => s.Count == 0 ? "—" : string.Join(", ", s.Select(x => $"`{x}`"));
                L("Codes (จากการรันในตัวจำลองทุก scenario):");
                L();
                L($"- Points: {List(cc.Points)}");
                L($"- Links: {List(cc.Links)}");
                L($"- Shapes: {List(cc.Shapes)}");
                L();
            }
        }

        var errors = new List<string>();
        var warns = new List<string>();
        if (y != null) errors.AddRange(y.Errors);
        foreach (var i in d.Check?.Issues ?? new())
            (i.Severity == "error" ? errors : warns).Add($"{(i.File != null ? $"`{i.File}` " : "")}{i.Message}{(i.Scenarios is { Count: > 0 } ? $" ({i.Scenarios.Count} scenario)" : "")}");
        foreach (var w in y?.Warnings ?? d.Cat.Warnings) warns.Add($"{(w.File != null ? $"`{w.File}` " : "")}{w.Message}");
        L("## Warnings and errors");
        L();
        if (errors.Count == 0 && warns.Count == 0) L("ไม่มี");
        foreach (var e in errors) L($"- ✖ {e}");
        foreach (var w in warns.Distinct()) L($"- ⚠ {w}");
        L();

        if (y is { Changes.Count: > 0 })
        {
            L("## Parameter changes since the last build");
            L();
            L("parameter เปลี่ยน: ใน Civil 3D ต้องลบเครื่องมือเก่าออกจาก Tool Palette แล้วลากใหม่จาก catalog (เครื่องมือเก่าจำ parameter ชุดเดิม)");
            L();
            foreach (var c in y.Changes) L($"- {c.Text}");
            L();
        }

        L("## ขั้นต่อใน Civil 3D");
        L();
        var atcDir = y?.CopiedTo ?? y?.OutDir;
        L("1. ถ้าเคยโหลด DLL ชื่อนี้จากโฟลเดอร์อื่นใน session นี้ ให้ปิด Civil 3D แล้วเปิดใหม่ก่อน (Civil 3D โหลด DLL ชื่อเดียวกันจาก 2 ที่ไม่ได้)");
        L($"2. โฟลเดอร์ที่มี DLL ต้องเป็น Trusted Location (Options → Files → Trusted Locations){(atcDir != null ? $": `{atcDir}`" : "")}");
        L($"3. พิมพ์ `CONTENTBROWSER` → Add Catalog → เลือก `{(atcDir != null ? Path.Combine(atcDir, d.DllName + ".atc") : d.DllName + ".atc")}`");
        L($"4. ลากเครื่องมือ (หรือทั้ง category `{d.DllName}`) ไปใส่ Tool Palette แล้วใส่ลง assembly");
        L("5. ถ้า parameter เปลี่ยน ให้ลบเครื่องมือเก่าออกจาก palette แล้วลากใหม่");
        return sb.ToString();
    }
}
