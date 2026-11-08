// Bottom boundary of a drawn part: the lower envelope of the real links in one evaluation result.
// At each offset the lowest real link counts. Auxiliary links and links that do not occur are ignored;
// vertical segments have no offset width, so they never count. Pure functions (no page access).
"use strict";
const Boundary = (() => {
  const EPS = 1e-6;

  // One entry per straight piece of every real link that occurs
  function segments(spec, r){
    const out = [];
    for (const l of spec.links){
      const q = r.links[l.id];
      if (!q || q.err || q.aux || !q.path || Spec.isAux(l)) continue;
      for (let i = 0; i + 1 < q.path.length; i++){
        const a = q.path[i], b = q.path[i + 1];
        if (Math.abs(a.x - b.x) < EPS) continue;
        const [p, s] = a.x < b.x ? [a, b] : [b, a];
        out.push({ link: l.id, codes: q.segCodes ? q.segCodes[i] : (l.codes || []), x1: p.x, y1: p.y, x2: s.x, y2: s.y });
      }
    }
    return out;
  }
  const yAt = (s, x) => s.y1 + (s.y2 - s.y1) * (x - s.x1) / (s.x2 - s.x1);

  // { stretches: [{ from, to, link, codes }], holes: [{ from, to }] } in increasing offset
  function lowerEnvelope(spec, r){
    const segs = segments(spec, r), xs = [];
    for (const s of segs) xs.push(s.x1, s.x2);
    // crossings of two links are where the lowest link changes
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++){
      const a = segs[i], b = segs[j], lo = Math.max(a.x1, b.x1), hi = Math.min(a.x2, b.x2);
      if (hi - lo < EPS) continue;
      const d0 = yAt(a, lo) - yAt(b, lo), d1 = yAt(a, hi) - yAt(b, hi);
      if (d0 * d1 < 0) xs.push(lo + (hi - lo) * d0 / (d0 - d1));
    }
    xs.sort((a, b) => a - b);
    const cuts = xs.filter((x, i) => !i || x - xs[i - 1] >= EPS);
    const stretches = [], holes = [];
    for (let i = 0; i + 1 < cuts.length; i++){
      const from = cuts[i], to = cuts[i + 1], mid = (from + to) / 2;
      const here = segs.filter(s => s.x1 <= mid && mid <= s.x2);
      if (!here.length){ holes.push({ from, to }); continue; }
      const y = Math.min(...here.map(s => yAt(s, mid)));
      const low = here.filter(s => yAt(s, mid) - y < EPS);          // overlapping links: either one's code is there
      const link = [...new Set(low.map(s => s.link))].join("+"), codes = [...new Set(low.flatMap(s => s.codes))];
      const last = stretches[stretches.length - 1];
      if (last && last.link === link && Math.abs(last.to - from) < EPS && last.codes.join() === codes.join()) last.to = to;
      else stretches.push({ from, to, link, codes });
    }
    return { stretches, holes };
  }

  const missing = (env, code) => env.stretches.filter(s => !s.codes.includes(code));
  return { segments, lowerEnvelope, missing };
})();
if (typeof module !== "undefined") module.exports = { Boundary };
