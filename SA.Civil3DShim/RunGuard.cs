// ตัวกันโค้ดค้างของเว็บ viewer (ไม่มีใน Civil 3D จริง)
//
// ตอนคอมไพล์ เว็บจะแทรก global::SA.Shim.RunGuard.Tick(); ไว้ต้น loop และต้น method ทุกตัวในไฟล์ .cs
// (แทรกไว้บรรทัดเดียวกับ { จึงไม่ทำให้เลขบรรทัดเลื่อน) แล้ว Tick() จะ:
//   - โยน ViewerTimeoutException เมื่อรันเกินเวลาที่กำหนด  -> loop ไม่จบจะหยุดจริง ไม่ค้างอยู่เบื้องหลัง
//   - โยน InsufficientExecutionStackException เมื่อ recursion ลึกเกิน -> กันเว็บล่มจาก stack overflow
// ไฟล์ .cs ของผู้ใช้ไม่ถูกแก้ การแทรกเกิดเฉพาะในหน่วยความจำตอนคอมไพล์

using System;
using System.Runtime.CompilerServices;

namespace SA.Shim
{
    public sealed class ViewerTimeoutException : Exception
    {
        public ViewerTimeoutException(double seconds)
            : base($"โค้ดทำงานเกิน {seconds:0.#} วินาที (loop หรือ recursion ไม่จบ?) เว็บหยุดการรันให้แล้ว") { }
    }

    public static class RunGuard
    {
        // stack ที่ใช้ได้ต่อการรันหนึ่งครั้ง: พอสำหรับ recursion ปกติหลายพันชั้น
        // และหยุดเร็วพอที่การคลาย stack กลับจะไม่ช้า
        private const long MaxStackBytes = 512 * 1024;

        [ThreadStatic] private static long _deadline;   // Environment.TickCount64; 0 = ไม่จำกัด
        [ThreadStatic] private static double _seconds;
        [ThreadStatic] private static long _stackBase;  // ตำแหน่ง stack ตอน Begin
        [ThreadStatic] private static string _tripped;  // "timeout" | "stack" | null
        [ThreadStatic] private static string _trippedAt; // stack trace ตอนถูกหยุดครั้งแรก
        [ThreadStatic] private static int _count;

        // เหตุที่รันรอบล่าสุดบนเธรดนี้ถูกหยุด (แม้โค้ดจะ catch exception ไว้เอง): "timeout", "stack" หรือ null
        public static string Tripped => _tripped;

        // ตำแหน่งที่ถูกหยุดครั้งแรก (ชี้ไปที่ loop/recursion จริง ไม่ใช่ catch ที่เรียกต่อมา)
        public static string TrippedStack => _trippedAt;

        private static void Trip(string why)
        {
            if (_tripped != null) return;
            _tripped = why;
            try { _trippedAt = new System.Diagnostics.StackTrace(2, true).ToString(); } catch { _trippedAt = null; }
        }

        public static unsafe void Begin(TimeSpan limit)
        {
            int marker = 0;
            _stackBase = (long)&marker;
            _seconds = limit.TotalSeconds;
            _deadline = Environment.TickCount64 + (long)limit.TotalMilliseconds;
            _tripped = null;
            _trippedAt = null;
            _count = 0;
        }

        public static void End()
        {
            _deadline = 0;
        }

        public static unsafe void Tick()
        {
            RuntimeHelpers.EnsureSufficientExecutionStack();
            if (_deadline == 0) return;

            if (_tripped == "timeout") throw new ViewerTimeoutException(_seconds);
            int marker = 0;
            if (Math.Abs(_stackBase - (long)&marker) > MaxStackBytes)
            {
                Trip("stack");
                throw new InsufficientExecutionStackException("เรียกฟังก์ชันซ้อนกันลึกเกินไป (recursion ไม่จบ?)");
            }
            if ((++_count & 0xFF) == 0 && Environment.TickCount64 > _deadline)
            {
                Trip("timeout");
                throw new ViewerTimeoutException(_seconds);
            }
        }
    }
}
