// AI proposals (round 6): a copy of the spec + the ops applied to it. The real spec is untouched until the user accepts.
// No page access here. In memory only: a page refresh drops proposals.
"use strict";
const Proposals = (() => {
  let seq = 0;
  const all = [];
  const copy = o => JSON.parse(JSON.stringify(o));

  // o = { itemId, base (spec), isNew?, asmId?, item? (stand-in for a subassembly that does not exist yet) }
  function make(o){
    return { id: null, itemId: o.itemId, base: JSON.stringify(o.base), spec: copy(o.base), batches: [], summary: "", scenarios: [], warnings: [],
             status: "pending", why: "", acked: false, isNew: !!o.isNew, asmId: o.asmId || null, item: o.item || null, step: null };
  }
  const add = p => { p.id = "AI" + (++seq); all.push(p); return p; };
  const pending = () => all.filter(p => p.status === "pending");
  const pendingFor = itemId => pending().find(p => p.itemId === itemId) || null;
  const byId = id => all.find(p => p.id === id) || null;
  const opCount = p => p.batches.reduce((n, b) => n + b.length, 0);

  // Applies ops to the proposal copy. On error the proposal stays as it was.
  function apply(p, ops, summary, opts){
    const r = Logic.applyBatch(p.spec, ops, opts);
    if (!r.ok) return r;
    if (ops.length) p.batches.push(copy(ops));
    if (summary) p.summary = p.summary ? p.summary + "\n" + summary : summary;
    p.warnings.push(...r.warnings);
    p.step = null;
    return r;
  }
  const finish = (p, status, why) => { p.status = status; p.why = why || ""; p.step = null; };

  // The spec after the first k ops, for Step through (view only). Each batch's references are inside that batch.
  function specAtStep(p, k){
    const s = JSON.parse(p.base);
    let left = k;
    for (const b of p.batches){
      if (left <= 0) break;
      const r = Logic.applyBatch(s, b.slice(0, left));
      if (!r.ok) throw new Error(r.error);
      left -= b.length;
    }
    return s;
  }
  const viewSpec = p => p.step == null ? p.spec : specAtStep(p, p.step);

  // What differs from the base, by object id
  function kinds(baseSpec, spec){
    const list = s => [...s.points, ...s.links, ...s.shapes];
    const a = new Map(list(baseSpec).map(o => [o.id, JSON.stringify(o)])), b = new Map(list(spec).map(o => [o.id, JSON.stringify(o)]));
    const added = new Set(), changed = new Set(), removed = new Set();
    for (const [id, v] of b) if (!a.has(id)) added.add(id); else if (a.get(id) !== v) changed.add(id);
    for (const id of a.keys()) if (!b.has(id)) removed.add(id);
    return { added, changed, removed };
  }
  // A proposal the user cancelled by editing, not yet reported to the AI (reported once)
  function takeCancelled(itemId){
    const p = all.find(x => x.itemId === itemId && x.status === "cancelled" && !x.acked);
    if (p) p.acked = true;
    return p || null;
  }
  const reset = () => { all.length = 0; seq = 0; };
  return { make, add, pending, pendingFor, byId, opCount, apply, finish, specAtStep, viewSpec, kinds, takeCancelled, all: () => all.slice(), reset };
})();
if (typeof module !== "undefined") module.exports = { Proposals };
