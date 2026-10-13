using System.Collections.Generic;

namespace SA.Core
{
    // ชื่อตรงกับ Autodesk.Civil.CorridorError เพื่อให้ adapter แปลงกลับได้ตรงตัว
    public enum IssueKind
    {
        ValueShouldNotBeLessThanOrEqualToZero,
        ValueTooSmall,
        Failure
    }

    public class Issue
    {
        public IssueKind Kind { get; set; }
        public bool IsError { get; set; }      // true = Severe, false = Warning
        public string Message { get; set; }
    }

    // จุดที่จะสร้างใน Civil 3D: X = offset จาก origin (flip แล้ว), Y = ระดับเทียบกับ origin
    public class OutPoint
    {
        public double X { get; set; }
        public double Y { get; set; }
        public string Code { get; set; }
    }

    public class OutLink
    {
        public int From { get; set; }
        public int To { get; set; }
        public string[] Codes { get; set; }
    }

    public class SubassemblyResult
    {
        public List<OutPoint> Points { get; } = new List<OutPoint>();
        public List<OutLink> Links { get; } = new List<OutLink>();
        public List<string> ShapeCodes { get; } = new List<string>();
        public List<Issue> Issues { get; } = new List<Issue>();

        // บันทึกว่าโค้ดวิ่งเข้าเงื่อนไขไหน (เว็บแสดงผล, Civil 3D ไม่ใช้)
        public List<string> Trace { get; } = new List<string>();
    }
}
