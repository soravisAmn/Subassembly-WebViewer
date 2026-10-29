// OSNAP: หา/จัดลำดับจุด snap แบบ AutoCAD — ฟังก์ชันล้วน ไม่แตะ DOM / state (ทดสอบด้วย node ได้: SA.Tests/js/snap.test.js)
//
// ลำดับ: snap แม่น (Endpoint, Center, Intersection, Midpoint, ลาดชนดิน, Perpendicular) เลือกตัวที่ใกล้เมาส์ที่สุด
//   ระยะเท่ากัน (ต่างกันไม่เกิน TIE px) ให้ชนิดที่อยู่ก่อนใน PRECISE ชนะ (Endpoint ชนะเสมอ)
//   snap แบบ "ใกล้สุด" (Nearest, Surface) อยู่ท้ายสุด ใช้เมื่อไม่มี snap แม่นในรัศมี (แบบ Nearest ของ AutoCAD)
// Tab = วนเลือกตัวถัดไปในรายการ (keep / next) — ขยับเมาส์แล้วรายการเปลี่ยน = เริ่มที่ตัวแรกใหม่
"use strict";

const Snap = (() => {
  const PRECISE = ["end", "cen", "int", "mid", "ray", "perp"];
  const LOOSE = ["near", "surf"];
  const TIE = 0.5;

  // in = {
  //   mouse {x,y}, scale {x,y} (px ต่อเมตร แนวราบ/ดิ่ง รวม VE), R (รัศมี px),
  //   os { on, end, mid, cen, int, surf, perp, near },
  //   points [{x, y, label, ...}]            จุดที่ snap Endpoint ได้ (ตัวแรกชนะเมื่อซ้อนกัน)
  //   centers [{x, y, label, ...}]           ศูนย์กลางของโค้ง / polygon ด้านเท่า (Center)
  //   segs   [{id, a{x,y}, b{x,y}, ...}]     เส้นตรงสำหรับ Mid / Int / Perp / Near (curve = ท่อนย่อยของโค้ง: ไม่มี Mid รายท่อน)
  //   mids   [{x, y, label, ...}]           กึ่งกลางของทั้งโค้ง (Midpoint)
  //   from {x,y} | null                       จุดก่อนหน้า (Perpendicular)
  //   ground { nearest(x,y) } | null          ผิวดิน (Surface)
  //   ray {x, y, label, ...} | null           จุดที่ลาดชนดิน (มีเมื่อล็อก slope) — มีในรัศมีแล้วไม่ต้องมี Surface
  // }
  // คืนรายการเรียงแล้ว [{kind, x, y, label, d(px), point? | seg? | segs? | t?}]
  function collect(inp){
    const os = inp.os, m = inp.mouse, R = inp.R;
    if (!os.on) return [];
    const px = p => Math.hypot((p.x - m.x) * inp.scale.x, (p.y - m.y) * inp.scale.y);
    const out = [];
    const add = (kind, p, extra, r) => {
      const d = px(p);
      if (d > (r || R)) return;
      if (out.some(c => c.kind === kind && Math.abs(c.x - p.x) < 1e-9 && Math.abs(c.y - p.y) < 1e-9)) return;
      out.push({ kind, x: p.x, y: p.y, d, label: "", ...extra });
    };
    const segs = inp.segs || [];

    if (os.end) for (const p of inp.points || []) add("end", p, { label: p.label, point: p });
    if (os.cen) for (const c of inp.centers || []) add("cen", c, { label: c.label, center: c });
    if (os.int) for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++){
      const s1 = segs[i], s2 = segs[j];
      if (touch(s1, s2)) continue;                     // ต่อกันที่ปลาย = Endpoint อยู่แล้ว
      const x = Spec.lineX(s1.a, s1.b, s2.a, s2.b);
      if (x && onSeg(s1, x) && onSeg(s2, x)) add("int", x, { label: `จุดตัด ${s1.id} × ${s2.id}`, segs: [s1, s2] });
    }
    if (os.mid) for (const s of segs) if (!s.curve) add("mid", { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }, { label: `กึ่งกลาง ${s.id}`, seg: s, t: 0.5 });
    if (os.mid) for (const q of inp.mids || []) add("mid", q, { label: q.label, midpt: q });
    let ray = false;
    if (os.surf && inp.ray && px(inp.ray) <= 2.5 * R){ add("ray", inp.ray, { ...inp.ray }, 2.5 * R); ray = true; }
    if (os.perp && inp.from) for (const s of segs){
      const q = Spec.projectSeg(s.a, s.b, inp.from);
      if (q.t > 1e-6 && q.t < 1 - 1e-6) add("perp", q, { label: `ตั้งฉาก ${s.id}`, seg: s, t: q.t });
    }
    if (os.near) for (const s of segs){
      const q = Spec.projectSeg(s.a, s.b, m);
      if (q.t > 1e-6 && q.t < 1 - 1e-6) add("near", q, { label: `บน ${s.id}`, seg: s, t: q.t });
    }
    if (os.surf && !ray && inp.ground){
      const g = inp.ground.nearest(m.x, m.y);
      if (g) add("surf", g, { label: "ผิวดิน" });
    }
    return rank(out);
  }

  function rank(list){
    const tier = c => LOOSE.includes(c.kind) ? 1 : 0;
    return list.slice().sort((p, q) => tier(p) - tier(q)
      || (Math.abs(p.d - q.d) > TIE ? p.d - q.d : 0)
      || PRECISE.indexOf(p.kind) - PRECISE.indexOf(q.kind)
      || LOOSE.indexOf(p.kind) - LOOSE.indexOf(q.kind)
      || p.d - q.d);
  }

  const same = (p, q) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;
  const touch = (s1, s2) => same(s1.a, s2.a) || same(s1.a, s2.b) || same(s1.b, s2.a) || same(s1.b, s2.b);
  function onSeg(s, x){
    const q = Spec.projectSeg(s.a, s.b, x);
    return Math.hypot(q.x - x.x, q.y - x.y) < 1e-6;
  }

  // Tab: cyc = { sig, i } — รายการเดิม (ชนิด + ตำแหน่งเดิม) ใช้ตัวที่วนไว้ต่อ, รายการใหม่เริ่มที่ 0
  const sig = list => list.map(c => c.kind + "@" + c.x.toFixed(6) + "," + c.y.toFixed(6)).join("|");
  function keep(list, cyc){
    const s = sig(list);
    return cyc && cyc.sig === s && cyc.i < list.length ? cyc : { sig: s, i: 0 };
  }
  function next(list, cyc){
    const k = keep(list, cyc);
    return { sig: k.sig, i: list.length ? (k.i + 1) % list.length : 0 };
  }

  return { PRECISE, LOOSE, collect, rank, keep, next };
})();
