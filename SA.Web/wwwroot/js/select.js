// การเลือกแบบ AutoCAD: Window / Crossing และรวมชุดที่เลือก — ฟังก์ชันล้วน ไม่แตะ DOM / state
// (ทดสอบด้วย node: SA.Tests/js/select.test.js)
//
// ลากซ้าย → ขวา = Window: เลือกเฉพาะ object ที่อยู่ในกรอบทั้งตัว
// ลากขวา → ซ้าย = Crossing: เลือก object ที่แตะกรอบ (ปลาย/เส้นตัดขอบกรอบ หรือกรอบอยู่ในรูปปิด)
// object = { sel, geoms: [{ pts: [{x, y}], closed? }] } พิกัดเป็น px บนจอ (จุด = geom ที่มี pts ตัวเดียว)
"use strict";

const Select = (() => {
  const mode = (x0, x1) => x1 >= x0 ? "window" : "crossing";
  const box = (x0, y0, x1, y1) => ({ l: Math.min(x0, x1), r: Math.max(x0, x1), t: Math.min(y0, y1), b: Math.max(y0, y1) });
  const inside = (p, b) => p.x >= b.l && p.x <= b.r && p.y >= b.t && p.y <= b.b;

  // ส่วนของเส้น p-q แตะกรอบไหม (ปลายอยู่ในกรอบ หรือตัดขอบใดขอบหนึ่ง)
  function segHits(p, q, b){
    if (inside(p, b) || inside(q, b)) return true;
    const c = [{ x: b.l, y: b.t }, { x: b.r, y: b.t }, { x: b.r, y: b.b }, { x: b.l, y: b.b }];
    for (let i = 0; i < 4; i++) if (segX(p, q, c[i], c[(i + 1) % 4])) return true;
    return false;
  }
  function segX(a, b, c, d){
    const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  }
  function inPoly(p, pts){
    let r = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){
      const a = pts[i], c = pts[j];
      if ((a.y > p.y) !== (c.y > p.y) && p.x < (c.x - a.x) * (p.y - a.y) / (c.y - a.y) + a.x) r = !r;
    }
    return r;
  }

  function geomHit(g, b, crossing){
    const P = g.pts;
    if (!P.length) return false;
    if (!crossing) return P.every(p => inside(p, b));
    if (P.length === 1) return inside(P[0], b);
    const n = g.closed ? P.length : P.length - 1;
    for (let i = 0; i < n; i++) if (segHits(P[i], P[(i + 1) % P.length], b)) return true;
    return !!g.closed && inPoly({ x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 }, P);
  }
  // Window = ทุก geom อยู่ในกรอบ · Crossing = มี geom ใดแตะกรอบ
  function hit(obj, b, crossing){
    const G = obj.geoms.filter(g => g.pts.length);
    if (!G.length) return false;
    return crossing ? G.some(g => geomHit(g, b, true)) : G.every(g => geomHit(g, b, false));
  }
  const pick = (objs, b, crossing) => objs.filter(o => hit(o, b, crossing)).map(o => o.sel);

  // ชุดที่เลือก: key ไม่ซ้ำ · remove = Shift (เอาออก) · ไม่งั้นเพิ่มต่อท้าย
  const key = s => [s.type, s.item || s.asm || "", s.id != null ? s.id : s.i != null ? s.i : ""].join("|");
  function merge(list, add, remove){
    const out = list.slice(), keys = new Set(out.map(key));
    for (const s of add){
      const k = key(s);
      if (remove){ if (keys.has(k)){ keys.delete(k); out.splice(out.findIndex(o => key(o) === k), 1); } }
      else if (!keys.has(k)){ keys.add(k); out.push(s); }
    }
    return out;
  }

  return { mode, box, hit, pick, key, merge };
})();
