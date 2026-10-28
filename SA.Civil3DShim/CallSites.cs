// "ใครเรียก" Points.Add / Links.Add / Shapes.Add (ไม่มีใน Civil 3D จริง)
//
// ตอนเปิด (Enabled) ตัวจำลองจะจำบรรทัดในไฟล์ .cs ของผู้ใช้ที่เรียกเพิ่มจุด / link / shape แต่ละตัว
// ด้วย StackTrace + PDB ที่เว็บคอมไพล์ไว้แล้ว เก็บทั้งสาย frame ที่อยู่ในไฟล์ของผู้ใช้ (ในสุดก่อน)
// เช่น AddPoint (บรรทัด 512) ← DrawImplement (บรรทัด 180) ← Draw (บรรทัด 95)
// เลขบรรทัดตรงกับไฟล์จริง: จุดตรวจของ RunGuard ถูกแทรกไว้บรรทัดเดียวกับ { จึงไม่ทำให้บรรทัดเลื่อน
// object ของ Civil 3D ไม่มี property เพิ่ม — เก็บแยกไว้ในตารางของคลาสนี้

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.CompilerServices;

namespace SA.Shim
{
    public sealed class CallSite
    {
        public CallSite(int line, string method) { Line = line; Method = method; }
        public int Line { get; }
        public string Method { get; }
    }

    public static class CallSites
    {
        // assembly ของไฟล์ผู้ใช้ที่เว็บคอมไพล์ชื่อขึ้นต้นด้วย "SA_" (ดู SubassemblyCompiler)
        private const string UserPrefix = "SA_";
        private const int MaxFrames = 8;
        private static readonly ConditionalWeakTable<object, CallSite[]> Table = new ConditionalWeakTable<object, CallSite[]>();

        [ThreadStatic] private static bool _enabled;

        // เปิด/ปิดบนเธรดที่รัน subassembly (ปิด = ไม่เก็บ เร็วกว่า)
        public static bool Enabled { get => _enabled; set => _enabled = value; }

        public static CallSite[] Of(object o) => o != null && Table.TryGetValue(o, out var s) ? s : null;

        internal static void Record(object o)
        {
            if (!_enabled || o == null) return;
            CallSite[] sites;
            try { sites = Capture(); }
            catch { return; }
            if (sites.Length > 0) Table.AddOrUpdate(o, sites);
        }

        private static CallSite[] Capture()
        {
            var list = new List<CallSite>();
            foreach (var f in new StackTrace(2, true).GetFrames())
            {
                var m = f.GetMethod();
                var asm = m?.DeclaringType?.Assembly;
                if (asm == null || !(asm.GetName().Name ?? "").StartsWith(UserPrefix, StringComparison.Ordinal)) continue;
                int line = f.GetFileLineNumber();
                if (line <= 0) continue;
                list.Add(new CallSite(line, MethodName(m)));
                if (list.Count >= MaxFrames) break;
            }
            return list.ToArray();
        }

        // ชื่อที่คนอ่านเข้าใจ: lambda "<Draw>b__0" -> Draw · local function "<Draw>g__AddPoint|3_0" -> AddPoint
        private static string MethodName(MethodBase m)
        {
            string n = m.Name;
            int g = n.IndexOf(">g__", StringComparison.Ordinal);
            if (g >= 0) { int bar = n.IndexOf('|', g); return bar > g ? n.Substring(g + 4, bar - g - 4) : n; }
            if (n.StartsWith("<", StringComparison.Ordinal)) { int e = n.IndexOf('>'); if (e > 1) return n.Substring(1, e - 1); }
            return n;
        }
    }
}
