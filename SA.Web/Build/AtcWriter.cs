// Round 7 M3: Tool Catalog files for Civil 3D Content Browser ("Add Catalog"), written from scratch after reading the stock
// catalogs (outline in docs/prompts/prompt-7-design.md, section 3; nothing of Autodesk is copied):
//   <DLL>.atc        root <Catalog>: one category that points to the file below (as the stock Corridor catalogs do)
//   <DLL>_tools.atc  root <Category>: one <Tool> per class (plain-text names like the SAC / XAML catalogs)
// GUIDs are derived from the DLL / class names, so a rebuild keeps them and re-adding the catalog updates the tools.

using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using SA.Drawing;

namespace SA.Build;

public record AtcParam(string Name, string Kind, string? Default, string? DisplayName, string? Description, string? Unit, List<SpecOption>? Options, bool FromSpec)
{
    // spec limits, only for the report (Civil 3D has no place for them in the .atc)
    public double? Min { get; init; }
    public double? Max { get; init; }
    public bool Positive { get; init; }
}
public record AtcTool(string FullName, string ClassName, string Icon, List<AtcParam> Params);

public static class AtcWriter
{
    // Same value in every stock subassembly tool (the "subassembly" tool kind)
    const string StockToolRef = "{7F55AAC0-0256-48D7-BFA5-914702663FDE}";

    public static string CategoryFile(string dllName) => dllName + "_tools.atc";

    // Name-based GUID (SHA-1, version 5 layout): same text = same GUID on every build and machine
    public static string StableGuid(string text)
    {
        var h = SHA1.HashData(Encoding.UTF8.GetBytes("SA-Drawing-Studio|" + text));
        var b = h[..16];
        b[6] = (byte)((b[6] & 0x0F) | 0x50);
        b[8] = (byte)((b[8] & 0x3F) | 0x80);
        var hex = Convert.ToHexString(b);
        return $"{{{hex[..8]}-{hex[8..12]}-{hex[12..16]}-{hex[16..20]}-{hex[20..]}}}";
    }

    // Civil 3D TypeInfo of a double, from the spec unit (stock catalogs: 16 = distance, 10 = slope as x of 1:x, 0 = number).
    // percent is stored as 2 = 2%, unlike TypeInfo 9 (a grade stored as 0.02), so it stays a plain number.
    // Hand-written files have no unit: 16, as the SAC catalogs write for every parameter.
    public static string? TypeInfo(AtcParam p) => p.Kind switch
    {
        "double" => !p.FromSpec ? "16" : p.Unit switch { "length" => "16", "slope" => "10", _ => "0" },
        _ => null
    };

    static string DataType(string kind) => kind switch { "long" => "Long", "string" => "String", "bool" => "Bool", _ => "Double" };

    // <DLL>.atc and <DLL>_tools.atc. assemblyRef = "SR03.dll" (next to the .atc) or a full path.
    public static (string Catalog, string Category) Write(string dllName, string assemblyRef, IReadOnlyList<AtcTool> tools)
    {
        var catId = StableGuid("category|" + dllName);
        string catDesc = $"Subassemblies in {dllName}.dll (SA Drawing Studio)";
        var catIcon = tools.Count > 0 ? tools[0].Icon : null;
        XElement Images(string? src, int cx, int cy) => new("Images", new XAttribute("option", "0"),
            new XElement("Image", new XAttribute("cx", cx), new XAttribute("cy", cy), src == null ? null : new XAttribute("src", ".\\" + src)));

        var catalog = new XElement("Catalog", new XAttribute("FileRevision", "18.0.0"), new XAttribute("Revision", "18.0.0"), new XAttribute("option", "0"),
            new XElement("ItemID", new XAttribute("idValue", StableGuid("catalog|" + dllName))),
            new XElement("Properties",
                new XElement("ItemName", dllName),
                Images(catIcon, 93, 123),
                new XElement("Description", catDesc),
                new XElement("AccessRight", "1")),
            new XElement("Source", new XElement("Publisher", new XElement("PublisherName", "SA Drawing Studio"))),
            new XElement("Tools"), new XElement("Palettes"), new XElement("Packages"),
            new XElement("Categories",
                new XElement("Category", new XAttribute("Revision", "18.0.0"), new XAttribute("option", "0"),
                    new XElement("ItemID", new XAttribute("idValue", catId)),
                    new XElement("Url", new XAttribute("href", ".\\\\" + CategoryFile(dllName))),
                    new XElement("Properties",
                        new XElement("ItemName", dllName),
                        Images(catIcon, 93, 123),
                        new XElement("Description", catDesc),
                        new XElement("AccessRight", "1")),
                    new XElement("Source"))));

        var category = new XElement("Category",
            new XElement("ItemID", new XAttribute("idValue", catId)),
            new XElement("Properties",
                new XElement("ItemName", dllName),
                Images(catIcon, 93, 123),
                new XElement("Description", catDesc),
                new XElement("AccessRight", "1")),
            new XElement("CustomData"), new XElement("Source"), new XElement("Palettes"), new XElement("Packages"),
            new XElement("Tools", tools.Select(t => Tool(dllName, assemblyRef, t))));

        return (Text(catalog), Text(category));
    }

    static XElement Tool(string dllName, string assemblyRef, AtcTool t) =>
        new("Tool",
            new XElement("ItemID", new XAttribute("idValue", StableGuid("tool|" + dllName + "|" + t.FullName))),
            new XElement("Properties",
                new XElement("ItemName", t.ClassName),
                new XElement("Images", new XElement("Image", new XAttribute("cx", 64), new XAttribute("cy", 64), new XAttribute("src", ".\\" + t.Icon))),
                new XElement("Description", $"{t.FullName} ({dllName}.dll)"),
                new XElement("Keywords", $"_{t.ClassName.ToLowerInvariant()} subassembly")),
            new XElement("Source"),
            new XElement("StockToolRef", new XAttribute("idValue", StockToolRef)),
            new XElement("Data",
                new XElement("AeccDbSubassembly",
                    new XElement("GeometryGenerateMode", "UseDotNet"),
                    new XElement("DotNetClass", new XAttribute("Assembly", assemblyRef), t.FullName),
                    new XElement("Params", t.Params.Select(Param))),
                new XElement("Units", "m")));

    static XElement Param(AtcParam p)
    {
        var e = new XElement(p.Name, new XAttribute("DataType", DataType(p.Kind)));
        if (TypeInfo(p) is { } ti) e.Add(new XAttribute("TypeInfo", ti));
        var display = string.IsNullOrWhiteSpace(p.DisplayName) ? p.Name : One(p.DisplayName!);
        e.Add(new XAttribute("DisplayName", display), new XAttribute("Description", string.IsNullOrWhiteSpace(p.Description) ? display : One(p.Description!)));
        e.Add(p.Default ?? "");
        if (p.Kind == "long" && p.Options is { Count: > 0 })
        {
            var used = new HashSet<string>();
            e.Add(new XElement("Enum", p.Options.Select(o =>
            {
                var n = Regex.Replace(o.Label, @"[^A-Za-z0-9_]", "");
                if (n.Length == 0 || !(char.IsLetter(n[0]) || n[0] == '_') || n.StartsWith("xml", StringComparison.OrdinalIgnoreCase) || !used.Add(n))
                    n = "Option" + o.Value.ToString(CultureInfo.InvariantCulture).Replace('-', 'm');
                used.Add(n);
                return new XElement(n, new XAttribute("DisplayName", o.Label), o.Value.ToString(CultureInfo.InvariantCulture));
            })));
        }
        return e;
    }

    // one line, single spaces (Civil 3D shows the text in one property row)
    static string One(string s) => string.Join(" ", s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    static string Text(XElement root)
    {
        var doc = new XDocument(new XDeclaration("1.0", "utf-8", null), root);
        var sb = new StringBuilder();
        using (var w = System.Xml.XmlWriter.Create(new StringWriter(sb), new System.Xml.XmlWriterSettings { Indent = true, IndentChars = "  ", NewLineChars = "\r\n", OmitXmlDeclaration = true }))
            doc.Save(w);
        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n" + sb + "\r\n";
    }

    // Well-formed, the catalog points to the category file, every class of the DLL appears exactly once
    public static List<string> Validate(string catalog, string category, string dllName, IEnumerable<string> fullNames)
    {
        var errors = new List<string>();
        try
        {
            var cat = XDocument.Parse(catalog);
            var href = cat.Descendants("Url").Select(u => (string?)u.Attribute("href")).FirstOrDefault();
            if (href == null || !href.EndsWith(CategoryFile(dllName))) errors.Add("catalog ไม่ชี้ไปที่ " + CategoryFile(dllName));
            var tools = XDocument.Parse(category).Descendants("DotNetClass").Select(d => d.Value).ToList();
            foreach (var n in fullNames)
            {
                int k = tools.Count(t => t == n);
                if (k != 1) errors.Add($"{n} อยู่ใน .atc {k} ครั้ง");
            }
            foreach (var extra in tools.Except(fullNames)) errors.Add($".atc มี {extra} ที่ไม่อยู่ใน DLL");
        }
        catch (System.Xml.XmlException e) { errors.Add(".atc ไม่ใช่ XML ที่ถูกต้อง: " + e.Message); }
        return errors;
    }
}
