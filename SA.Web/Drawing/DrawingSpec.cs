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
    public List<SpecRotation> Rotations { get; set; } = new();
    public SpecLogic? Logic { get; set; }                 // เงื่อนไข / decision / กิ่ง (รอบ 4 — ดู prompt-4-design.md)
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
    public bool Auxiliary { get; set; }               // Auxiliary (ช่วยสร้าง): คำนวณพิกัดแต่ไม่ Points.Add
    // spec รุ่นก่อน: construction = auxiliary (อ่านอย่างเดียว)
    public bool Construction { get => false; set { if (value) Auxiliary = true; } }
    public string? Branch { get; set; }               // เกิดเฉพาะเมื่อกิ่งนี้เกิด (null = เกิดเสมอ)
    public SpecLimit? Limit { get; set; }             // Max / Min ของจุด (รอบ 4b — ดู prompt-4b-design.md)
}

// Max / Min: ค่าที่คุม (measure) ต้องอยู่ระหว่าง Min..Max — นอกขอบ = ขยับจุดตาม Along จนถึงขอบ (ตรงกับ limitPt ใน spec.js)
//   measure: depth (ระยะดิ่งจากอ้างอิง) | normal (ตั้งฉากกับผิวดิน) | length (ความยาวจากจุดต้นตามแนวเดิม) | offset (ระยะราบจากอ้างอิง ออกนอก +)
public class SpecLimit
{
    public string Measure { get; set; } = "depth";
    public string? Side { get; set; }                 // below (ต่ำกว่า) | above (สูงกว่า) — depth / normal
    public SpecLimitRef? Ref { get; set; }
    public string? Min { get; set; }
    public string? Max { get; set; }
    public string Action { get; set; } = "clampWarn"; // clampWarn | clamp | warn
    public string Along { get; set; } = "vertical";   // vertical | horizontal | slope
    public bool Below => Side != "above";
    public IEnumerable<string> Exprs() => new[] { Min, Max, Ref?.Expr }.Where(e => !string.IsNullOrWhiteSpace(e))!;
    // จุดที่ต้องคำนวณก่อน: จุดอ้างอิง + จุดในนิพจน์
    public IEnumerable<string> Refs() => (Ref is { Type: "point", Id: { Length: > 0 } id } ? new[] { id } : Array.Empty<string>())
        .Concat(Exprs().SelectMany(SpecExpr.PointRefs)).Distinct();
}

public class SpecLimitRef
{
    public string Type { get; set; } = "ground";      // ground | point | elev | origin
    public string? Target { get; set; }
    public string? Id { get; set; }
    public string? Expr { get; set; }                 // elev: ระดับจริง (นิพจน์)
}

public class PointDef
{
    public string Type { get; set; } = "";
    public string? From { get; set; }
    public string? Dx { get; set; }
    public string? Dy { get; set; }
    public string? Slope { get; set; }
    public string? Length { get; set; }
    public string? Angle { get; set; }
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
    public string? Corner { get; set; }               // tangent: จุดมุม / จุดที่เส้นวิ่งไปหา / อีกเส้น / รัศมี
    public string? Toward { get; set; }
    public string? Other { get; set; }
    public string? Radius { get; set; }
    public List<string>? Points { get; set; }         // firstOf: จุดแรกในรายการที่เกิด

    // จุดที่ต้องคำนวณก่อน: ช่องอ้างจุด + รายการของ firstOf + จุดในนิพจน์ (P3.x, ground(P3), exists(P3)) — ตรงกับ refs ใน spec.js
    public IEnumerable<string> Refs() => new[] { From, A, B, A1, A2, B1, B2, Corner, Toward, Other }.Where(r => !string.IsNullOrEmpty(r))
        .Concat(Type == "firstOf" ? Points ?? new() : new())
        .Concat(Exprs().SelectMany(SpecExpr.PointRefs)).Distinct()!;

    // ช่องนิพจน์ทั้งหมดของ def (ที่ไม่ว่าง)
    public IEnumerable<string> Exprs() => new[] { Dx, Dy, Slope, Length, Angle, MaxDistance, LayoutLength, T, Radius }.Where(e => !string.IsNullOrWhiteSpace(e))!;
}

public class SpecLink
{
    public string Id { get; set; } = "";
    public List<string>? Points { get; set; }
    public string? Type { get; set; }                 // null = เส้นตรง | followSurface | arc3 | arcR | fillet
    public string? From { get; set; }
    public string? To { get; set; }
    public string? Target { get; set; }
    public string? Via { get; set; }                  // arc3: จุดที่โค้งผ่าน
    public string? Corner { get; set; }               // fillet: จุดมุมเดิม
    public string? Radius { get; set; }               // arcR / fillet
    public string? Sweep { get; set; }                // arcR: ccw | cw (กรอบ Side = Right)
    public bool Large { get; set; }                   // arcR: ทางยาว (> 180°)
    public SpecSeg? Seg { get; set; }                 // ความละเอียดของโค้ง (ไม่มี = ท่อนยาวไม่เกิน 0.05 m)
    public bool Auxiliary { get; set; }               // Auxiliary (ช่วยสร้าง): ใช้อ้างอิงอย่างเดียว ไม่ Links.Add
    public bool Construction { get => false; set { if (value) Auxiliary = true; } }
    public List<string> Codes { get; set; } = new();
    public string? Branch { get; set; }

    public bool Follow => Type == "followSurface";
    public bool IsArc => Type is "arc3" or "arcR" or "fillet";
    public (string A, string B) Ends => Points is { Count: >= 2 } ? (Points[0], Points[^1]) : (From ?? "", To ?? "");
}

public class SpecSeg
{
    public string By { get; set; } = "chord";         // chord = ท่อนยาวไม่เกิน value (m) | count = value ท่อน
    public string? Value { get; set; } = "0.05";
}

public class SpecShape
{
    public string Id { get; set; } = "";
    public List<string> Links { get; set; } = new();
    public List<string> Codes { get; set; } = new();
    public string? Branch { get; set; }
}

// ---------------- Logic (รอบ 4) ----------------
// conditions = เงื่อนไขที่ตั้งชื่อ (ใช้ซ้ำได้) · decisions = โหนดของ flowchart (if / switch) · branches = ทางออกของ decision
// กิ่งเกิด = กิ่งแม่ของ decision เกิด (หรืออยู่ชั้นบนสุด) และค่าของ test ตรงกับ case
public class SpecLogic
{
    public List<SpecCondition> Conditions { get; set; } = new();
    public List<SpecDecision> Decisions { get; set; } = new();
    public List<SpecBranch> Branches { get; set; } = new();
}

public class SpecCondition
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";           // ชื่อตัวแปรในโค้ด C# (bool?) และในนิพจน์อื่น
    public string? Expr { get; set; }
    public string? Note { get; set; }
}

public class SpecDecision
{
    public string Id { get; set; } = "";
    public string? Parent { get; set; }               // กิ่งแม่ (null = ชั้นบนสุด)
    public string Kind { get; set; } = "if";          // if | switch
    public string? Test { get; set; }                 // ชื่อเงื่อนไข หรือนิพจน์ (if = จริง/เท็จ, switch = ตัวเลข)
    public string? Label { get; set; }
}

public class SpecBranch
{
    public string Id { get; set; } = "";
    public string Decision { get; set; } = "";
    public JsonElement Case { get; set; }             // if: true / false · switch: ตัวเลข หรือ "else"
    public string? Label { get; set; }

    public bool IsElse => Case.ValueKind == JsonValueKind.String && Case.GetString() == "else";
    public bool AsBool => Case.ValueKind == JsonValueKind.True || (Case.ValueKind == JsonValueKind.String && Case.GetString() == "true");
    public double AsNumber => Case.ValueKind == JsonValueKind.Number ? Case.GetDouble()
        : double.TryParse(Case.ValueKind == JsonValueKind.String ? Case.GetString() : "", System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : double.NaN;
}

// กลุ่มหมุน: สมาชิกคำนวณตาม def แล้วหมุนรอบ pivot ด้วย F × angle (องศา ทวนเข็ม + ในกรอบ Side = Right)
public class SpecRotation
{
    public string Id { get; set; } = "";
    public string Pivot { get; set; } = "";
    public string? Angle { get; set; }
    public List<string> Points { get; set; } = new();
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
