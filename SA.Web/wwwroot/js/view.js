// มุมมอง: ช่วงซูม, ระยะ grid, ทศนิยมที่แสดงตามซูม — ฟังก์ชันล้วน ไม่แตะ DOM / state (ทดสอบ: SA.Tests/js/view.test.js)
// scale = px ต่อเมตร (แนวราบ) · ซูมเข้าได้ถึง 20000 px/m (1 ซม. ≈ 200 px) · ซูมออกได้ถึง 0.5 px/m
"use strict";

const View = (() => {
  const ZOOM_MIN = 0.5, ZOOM_MAX = 20000;
  const clampScale = s => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +s || 42));

  // ระยะ grid ที่ห่างบนจอไม่ต่ำกว่า 34 px — ลงไปถึง 1 มม. (ซูมเข้า) / ขึ้นไปถึง 5 กม. (ซูมออก)
  const GRID_STEPS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  function niceStep(pxPerUnit){
    for (const s of GRID_STEPS) if (s * pxPerUnit >= 34) return s;
    return GRID_STEPS[GRID_STEPS.length - 1];
  }
  // ตัวเลขบน grid: ทศนิยมพอดีกับระยะ grid (0.005 -> 3 ตำแหน่ง, 0.5 -> 1, 10 -> 0) ไม่มีศูนย์เกินท้าย
  const gridLabel = (v, step) => String(+v.toFixed(Math.max(0, Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)))));

  // ทศนิยมของพิกัดที่แสดง (แถบล่าง) ตามซูม: ซูมออกมาก 1 ตำแหน่ง · ปกติ 2 · ซูมเข้า (≥ 100 px/m) 3
  const zoomDec = scale => scale >= 100 ? 3 : scale >= 10 ? 2 : 1;
  const fmt = (v, scale) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(zoomDec(scale));

  // ล้อเมาส์ -> ตัวคูณซูม: Shift = ทีละน้อย · Chrome ส่ง Shift+ล้อมาเป็น deltaX · deltaMode 1 = นับเป็นบรรทัด (Firefox)
  function wheelFactor(e){
    const d = (e.deltaY || e.deltaX || 0) * (e.deltaMode === 1 ? 16 : 1);
    return Math.exp(-Math.max(-300, Math.min(300, d)) * (e.shiftKey ? 0.0004 : 0.0012));
  }

  return { ZOOM_MIN, ZOOM_MAX, clampScale, GRID_STEPS, niceStep, gridLabel, zoomDec, fmt, wheelFactor };
})();
if (typeof module !== "undefined") module.exports = View;
