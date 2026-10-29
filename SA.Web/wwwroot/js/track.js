// Object Snap Tracking (OTRACK) แบบ AutoCAD — ฟังก์ชันล้วน ไม่แตะ DOM / state (ทดสอบ: SA.Tests/js/track.test.js)
//
// ชี้ค้างบนจุด snap (Endpoint / Center / Intersection / Midpoint / Perpendicular) = "จับ" จุดนั้น (acquire) · ชี้ค้างซ้ำ = ปล่อย
// จับได้สูงสุด MAX จุด จุดล่าสุด = "จุดอ้างอิงหลัก" (พิมพ์ dx dy คิดจากจุดนี้)
// เมื่อเมาส์ตรงแนวดิ่ง / แนวราบกับจุดที่จับ = จับบนเส้น tracking ได้ · จุดตัดของแนวดิ่งจากจุดหนึ่งกับแนวราบจากอีกจุด ก็จับได้
// พิกัดเป็น "พิกัดงาน" (Edit mode = เทียบ origin ของตัวที่แก้ · นอก Edit = พิกัดโลก)
"use strict";

const Track = (() => {
  const MAX = 7;
  const ACQ = ["end", "cen", "int", "mid", "perp"];
  const key = c => c.kind + "@" + c.x.toFixed(6) + "," + c.y.toFixed(6);
  const acquirable = c => !!c && ACQ.includes(c.kind);

  // จับ / ปล่อย: จุดเดิม (ชนิด + ตำแหน่งเดียวกัน) = เอาออก · ใหม่ = ต่อท้าย (เกิน MAX ทิ้งตัวเก่าสุด)
  function toggle(list, c){
    const k = key(c), i = list.findIndex(p => key(p) === k);
    if (i >= 0) return list.filter((_, j) => j !== i);
    return list.concat([{ kind: c.kind, x: c.x, y: c.y, label: c.label || "", ref: c.ref || null }]).slice(-MAX);
  }
  const main = list => list.length ? list[list.length - 1] : null;

  // จุดบนเส้น tracking ที่ตำแหน่งเมาส์ m (scale = px ต่อเมตร {x, y}, R = รัศมี px)
  //   round(v) = ปัดระยะตามเส้น (Grid snap) — ไม่ส่ง = ไม่ปัด
  // คืน [{kind:"trk", dir: "v" | "h" | "x", x, y, d, base, base2?, label, dist}] จุดตัด (x) มาก่อน แล้วเรียงตามระยะ
  function collect(list, m, scale, R, round){
    const r = round || (v => v), out = [];
    for (const p of list){
      const dv = Math.abs(m.x - p.x) * scale.x, dh = Math.abs(m.y - p.y) * scale.y;
      if (dv <= R && dh > R){ const y = p.y + r(m.y - p.y); out.push({ kind: "trk", dir: "v", x: p.x, y, d: dv, base: p, dist: y - p.y, label: `แนวดิ่งจาก ${p.label}` }); }
      if (dh <= R && dv > R){ const x = p.x + r(m.x - p.x); out.push({ kind: "trk", dir: "h", x, y: p.y, d: dh, base: p, dist: x - p.x, label: `แนวราบจาก ${p.label}` }); }
    }
    for (const a of list) for (const b of list){
      if (a === b || Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.y - b.y) < 1e-9) continue;
      const d = Math.hypot((a.x - m.x) * scale.x, (b.y - m.y) * scale.y);
      if (d <= R) out.push({ kind: "trk", dir: "x", x: a.x, y: b.y, d, base: a, base2: b, dist: b.y - a.y,
                             label: `แนวดิ่งจาก ${a.label} × แนวราบจาก ${b.label}` });
    }
    return out.sort((p, q) => (p.dir === "x" ? 0 : 1) - (q.dir === "x" ? 0 : 1) || p.d - q.d);
  }

  // รวมกับรายการ OSNAP: snap แม่นมาก่อน → เส้น tracking → snap แบบ "ใกล้สุด" (Nearest / Surface)
  function merge(snaps, trk){
    const loose = c => Snap.LOOSE.includes(c.kind);
    return snaps.filter(c => !loose(c)).concat(trk, snaps.filter(loose));
  }

  // จุดใน spec ของจุดที่จับ (สร้างจุดช่วยสร้างถ้ายังไม่มี) — ref:
  //   {type:"pt", id} จุดที่วาด · {type:"origin"} · {type:"code", code} จุดของโค้ดเดิม · {type:"fixed", x, y} ไม่มี code
  //   {type:"between", a, b, t} · {type:"intersect", a1, a2, b1, b2} · {type:"def", def} (เช่น ศูนย์กลาง)
  // F = ทิศของ Side (ใช้กับ fixed) · คืน id
  function refPoint(spec, ref, F){
    const cons = def => Spec.addPoint(spec, def, [], true);
    switch (ref && ref.type){
      case "pt": return ref.id;
      case "origin": { const ex = spec.points.find(p => p.def.type === "origin"); return ex ? ex.id : cons({ type: "origin" }); }
      case "code": { const ex = spec.points.find(p => p.def.type === "external" && p.def.code === ref.code); return ex ? ex.id : cons({ type: "external", code: ref.code }); }
      case "fixed": return cons({ type: "delta", dx: Expr.num(ref.x * (F || 1)), dy: Expr.num(ref.y) });
      case "between": return cons({ type: "between", a: ref.a, b: ref.b, t: ref.t });
      case "intersect": return cons({ type: "intersect", a1: ref.a1, a2: ref.a2, b1: ref.b1, b2: ref.b2 });
      case "def": return cons(JSON.parse(JSON.stringify(ref.def)));
    }
    return null;
  }

  // ระยะ<มุม (แบบ AutoCAD) เช่น "5<30", "Width < Ang + 90" -> { length, angle } · ไม่ใช่ = null
  function polarText(s){
    const m = /^\s*(.+?)\s*<\s*(.+?)\s*$/.exec(String(s || ""));
    return m ? { length: m[1], angle: m[2] } : null;
  }
  // มุมที่ผู้ใช้เห็นบนจอ -> มุมในกรอบ Side = Right ที่เก็บใน spec (ฝั่ง Left = 180 - มุม)
  const specAngle = (a, F) => F === -1 ? (/^-?\d+(\.\d+)?$/.test(a) ? Expr.num(180 - +a) : `180 - (${a})`) : a;

  return { MAX, ACQ, key, acquirable, toggle, main, collect, merge, refPoint, polarText, specAngle };
})();
if (typeof module !== "undefined") module.exports = Track;
