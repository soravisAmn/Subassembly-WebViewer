// DrawingSpec ฝั่ง server (อ่านจาก JSON ที่เว็บส่งมา) — ความหมายของแต่ละ field ดู wwwroot/js/spec.js
// ช่องนิพจน์เก็บเป็นข้อความเสมอ (ถ้า JSON เป็นตัวเลขก็อ่านเป็นข้อความให้)

using System.Text.Json;
using System.Text.Json.Serialization;

namespace SA.Drawing;

public class DrawingSpec
{
    public int Version { get; set; } = 1;
    public string ClassName { get; set; } = "";
    public string? Namespace { get; set; }
    public List<SpecParam> Params { get; set; } = new();
    public List<SpecTarget> Targets { get; set; } = new();
    public List<SpecPoint> Points { get; set; } = new();
    public List<SpecLink> Links { get; set; } = new();
    public List<SpecShape> Shapes { get; set; } = new();
    public SpecSide? Side { get; set; }
    public bool Imported { get; set; }

    public static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
        Converters = { new LooseStringConverter() }
    };

    public static DrawingSpec Parse(JsonElement e) => e.Deserialize<DrawingSpec>(Json) ?? throw new FormatException("spec ว่าง");
    public static DrawingSpec Parse(string json) => JsonSerializer.Deserialize<DrawingSpec>(json, Json) ?? throw new FormatException("spec ว่าง");
}

public class SpecParam
{
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "double";      // double | long
    public double Default { get; set; }
    public string? DisplayName { get; set; }
    public double? Min { get; set; }
    public double? Max { get; set; }
}

public class SpecTarget
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "Surface";
    public string? DisplayName { get; set; }
}

public class SpecPoint
{
    public string Id { get; set; } = "";
    public List<string> Codes { get; set; } = new();
    public PointDef Def { get; set; } = new();
}

public class PointDef
{
    public string Type { get; set; } = "";
    public string? From { get; set; }
    public string? Dx { get; set; }
    public string? Dy { get; set; }
    public string? Slope { get; set; }
    public string? Length { get; set; }
    public double? Dir { get; set; }
    public string? Measure { get; set; }
    public string? Target { get; set; }
    public string? MaxDistance { get; set; }
    public string? LayoutLength { get; set; }
    public string? A { get; set; }
    public string? B { get; set; }
    public string? T { get; set; }
    public string? A1 { get; set; }
    public string? A2 { get; set; }
    public string? B1 { get; set; }
    public string? B2 { get; set; }
    public string? Code { get; set; }

    public IEnumerable<string> Refs() => new[] { From, A, B, A1, A2, B1, B2 }.Where(r => !string.IsNullOrEmpty(r))!;
}

public class SpecLink
{
    public string Id { get; set; } = "";
    public List<string>? Points { get; set; }
    public string? Type { get; set; }                 // null = เส้นตรง | followSurface
    public string? From { get; set; }
    public string? To { get; set; }
    public string? Target { get; set; }
    public List<string> Codes { get; set; } = new();

    public bool Follow => Type == "followSurface";
    public (string A, string B) Ends => Follow ? (From ?? "", To ?? "") : (Points is { Count: >= 2 } ? (Points[0], Points[^1]) : ("", ""));
}

public class SpecShape
{
    public string Id { get; set; } = "";
    public List<string> Links { get; set; } = new();
    public List<string> Codes { get; set; } = new();
}

public class SpecSide
{
    public string Param { get; set; } = "Side";
    public bool Mirror { get; set; } = true;
}

// อ่าน string ที่อาจเป็นตัวเลขใน JSON (เช่น dx: 3 แทน "3")
internal class LooseStringConverter : JsonConverter<string>
{
    public override string? Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) => r.TokenType switch
    {
        JsonTokenType.String => r.GetString(),
        JsonTokenType.Number => r.GetDouble().ToString("R", System.Globalization.CultureInfo.InvariantCulture),
        JsonTokenType.Null => null,
        _ => throw new JsonException("ต้องเป็นข้อความหรือตัวเลข")
    };
    public override void Write(Utf8JsonWriter w, string v, JsonSerializerOptions o) => w.WriteStringValue(v);
}
