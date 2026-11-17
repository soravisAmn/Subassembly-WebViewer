// Style by code ("ByCode", round 10): one pure resolver for how a link / shape / point is drawn on the web.
//   Style file {name}.style.json = { version, codes: { Top: { link, shape, point } }, text: { size } } (docs/display.md).
//   resolve() order: per-object override (spec display.overrides) -> the object's codes in list order (Datum skipped unless it is the
//   only code; the first code that has this kind) -> automatic colour (stable hash of the code name) + defaults.
//   Overrides merge field by field. Web only: nothing here reaches the generated C#.
//   Runs in node (SA.Tests/js/style.test.js) and in the page (plain script, before workspace.js).
"use strict";
const Style = (() => {
  const LINETYPES = ["solid", "dashed", "center", "hidden"];
  const MARKERS = ["square", "circle", "cross", "triangle", "none"];
  const KINDS = ["link", "shape", "point"];
  const FIELDS = { link: ["color", "linetype", "weight"], shape: ["fill", "alpha", "hatch"], point: ["marker", "color", "size"] };
  const DEFAULTS = {
    link: { color: null, linetype: "solid", weight: 0.25 },
    shape: { fill: null, alpha: 0.12, hatch: null },       // fill null = the workspace's default shape fill
    point: { marker: "square", size: 8, color: null }      // color null = the default point look
  };
  const TEXT_SIZE = 11;
  const NEUTRAL = "#c9ccd1";                               // Civil 3D preview: one plain light grey for every link
  // same order as --l1 … --l7 in css/app.css (workspace palette); the page reads the CSS variables, node uses these
  const AUTO_PALETTE = ["#6ea4ff", "#f0a04b", "#3fcf9a", "#b08cff", "#ff7eb6", "#4fd2e0", "#e2cf55"];
  const NO_CODE = "#9a9ea6";

  const isNum = v => typeof v === "number" && isFinite(v);
  const isColor = v => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim());

  // ---------- automatic colour: stable across sessions and machines ----------
  function hash(str){
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return h >>> 0;
  }
  const autoIndex = code => hash(String(code)) % AUTO_PALETTE.length;
  const autoColor = code => code ? AUTO_PALETTE[autoIndex(code)] : NO_CODE;

  // ---------- hatch: approximations of the AutoCAD patterns as SVG pattern tiles ----------
  // build(color, s) -> { w, h, body }: a tile w × h px (s = the base cell in px, scales with zoom); body = SVG markup inside <pattern>
  const q = c => String(c || "#999").replace(/[^#0-9a-zA-Z(),.% ]/g, "");
  const line = (d, c, w) => `<path d="${d}" stroke="${q(c)}" stroke-width="${w || 1}" fill="none" stroke-linecap="square"/>`;
  const dot = (x, y, r, c) => `<circle cx="${+x.toFixed(2)}" cy="${+y.toFixed(2)}" r="${+r.toFixed(2)}" fill="${q(c)}"/>`;
  const diag = s => `M0 ${s} L${s} 0 M${-s / 2} ${s / 2} L${s / 2} ${-s / 2} M${s / 2} ${s * 1.5} L${s * 1.5} ${s / 2}`;
  const diag2 = s => `M0 0 L${s} ${s} M${-s / 2} ${s / 2} L${s / 2} ${s * 1.5} M${s / 2} ${-s / 2} L${s * 1.5} ${s / 2}`;
  const HATCHES = {
    SOLID:   { label: "SOLID", build: (c, s) => ({ w: s, h: s, body: `<rect width="${s}" height="${s}" fill="${q(c)}"/>` }) },
    ANSI31:  { label: "ANSI31 (เส้นเฉียง 45°)", build: (c, s) => ({ w: s, h: s, body: line(diag(s), c) }) },
    ANSI37:  { label: "ANSI37 (เส้นเฉียงไขว้)", build: (c, s) => ({ w: s, h: s, body: line(diag(s) + diag2(s), c) }) },
    "AR-CONC": { label: "AR-CONC (คอนกรีต)", build: (c, s) => {
      const t = 2 * s, p = (x, y) => [x * t, y * t];
      const dots = [[.12, .18], [.55, .1], [.82, .4], [.3, .55], [.68, .78], [.1, .85], [.92, .92], [.45, .35]].map(([x, y]) => dot(...p(x, y), Math.max(.6, s * .05), c));
      const tri = [[.2, .4, .26, .47, .16, .47], [.75, .15, .8, .22, .7, .22], [.5, .7, .56, .78, .45, .78], [.88, .65, .93, .72, .83, .72]]
        .map(a => `<path d="M${a.slice(0, 2).map(v => +(v * t).toFixed(2)).join(" ")} L${a.slice(2, 4).map(v => +(v * t).toFixed(2)).join(" ")} L${a.slice(4).map(v => +(v * t).toFixed(2)).join(" ")} Z" fill="none" stroke="${q(c)}" stroke-width="1"/>`).join("");
      return { w: t, h: t, body: dots.join("") + tri };
    } },
    EARTH:   { label: "EARTH (ดิน)", build: (c, s) => ({ w: s, h: s, body:
      line(`M0 ${s * .75} L${s * .5} ${s * .75} M${s * .25} ${s * .6} L${s * .25} ${s * .9}`, c) + line(`M${s * .5} ${s * .25} L${s} ${s * .25} M${s * .75} ${s * .1} L${s * .75} ${s * .4}`, c) }) },
    GRAVEL:  { label: "GRAVEL (กรวด)", build: (c, s) => {
      const t = 2 * s, P = a => a.map(v => +(v * t).toFixed(2)).join(" ");
      const stones = [[.1, .2, .3, .1, .35, .3, .15, .38], [.55, .15, .8, .2, .75, .4, .5, .35], [.2, .65, .42, .6, .46, .85, .22, .9], [.65, .62, .9, .7, .8, .92, .62, .85]]
        .map(a => `<path d="M${P(a.slice(0, 2))} L${P(a.slice(2, 4))} L${P(a.slice(4, 6))} L${P(a.slice(6))} Z" fill="none" stroke="${q(c)}" stroke-width="1"/>`).join("");
      return { w: t, h: t, body: stones + dot(.5 * t, .55 * t, .7, c) + dot(.05 * t, .5 * t, .7, c) + dot(.95 * t, .05 * t, .7, c) };
    } },
    NONE:    { label: "NONE", build: null }
  };

  // ---------- one field at a time: valid value or undefined ----------
  function hatchIn(h){
    if (h == null) return undefined;
    if (typeof h === "string") h = { pattern: h };
    if (typeof h !== "object" || Array.isArray(h)) return undefined;
    const o = { ...h };
    if (o.pattern !== undefined && !(typeof o.pattern === "string" && o.pattern.toUpperCase() in HATCHES)) delete o.pattern;
    else if (o.pattern !== undefined) o.pattern = o.pattern.toUpperCase();
    if (o.scale !== undefined && !(isNum(o.scale) && o.scale > 0)) delete o.scale;
    if (o.angle !== undefined && !isNum(o.angle)) delete o.angle;
    if (o.color !== undefined && !isColor(o.color)) delete o.color;
    return o;
  }
  const FIELD_OK = {
    color: isColor, fill: isColor,
    linetype: v => LINETYPES.includes(v),
    weight: v => isNum(v) && v > 0 && v <= 5,
    alpha: v => isNum(v) && v >= 0 && v <= 1,
    marker: v => MARKERS.includes(v),
    size: v => isNum(v) && v > 0 && v <= 40
  };
  const HATCH_DEFAULT = { pattern: "SOLID", scale: 1, angle: 0, color: null };
  // out.hatch is null (none) or { pattern, scale, angle, color }; a later hatch object merges field by field into the earlier one
  function mergeHatch(prev, h){
    const x = hatchIn(h);
    if (!x) return prev;
    const m = { ...(prev || HATCH_DEFAULT), ...x };
    return m.pattern === "NONE" ? null : m;
  }
  function apply(out, kind, e){
    let n = 0;
    if (!e || typeof e !== "object") return 0;
    for (const f of FIELDS[kind]){
      if (!(f in e)) continue;
      if (f === "hatch"){ if (!hatchIn(e.hatch)) continue; out.hatch = mergeHatch(out.hatch, e.hatch); if (!out.set.includes(f)) out.set.push(f); n++; continue; }
      if (!FIELD_OK[f](e[f])) continue;
      out[f] = f === "weight" || f === "alpha" || f === "size" ? +e[f] : f === "linetype" || f === "marker" ? e[f] : e[f].trim();
      if (!out.set.includes(f)) out.set.push(f); n++;
    }
    return n;
  }

  // null = the value is valid for this field of this kind, else a short reason (used by the Logic API setOverride)
  function checkField(kind, field, v){
    if (!KINDS.includes(kind)) return "unknown kind " + kind;
    if (!FIELDS[kind].includes(field)) return `${field} is not a ${kind} field (${FIELDS[kind].join(", ")})`;
    if (field === "hatch"){
      const h = hatchIn(v), why = "hatch must be a pattern name or { pattern, scale > 0, angle, color #rrggbb } (patterns: " + Object.keys(HATCHES).join(", ") + ")";
      if (!h || (typeof v === "string" && !h.pattern)) return why;
      // an object: every field that was given must survive cleaning (no silent fallback to SOLID)
      const lost = ["pattern", "scale", "angle", "color"].filter(x => v[x] !== undefined && !(x in h));
      if (typeof v === "object" && lost.length) return `bad hatch ${lost.join(", ")}: ${JSON.stringify(v)}. ` + why;
      return null;
    }
    return FIELD_OK[field](v) ? null : `bad value for ${field}: ${JSON.stringify(v)}`;
  }

  // codes in list order for resolving: Datum is skipped unless it is the only code
  function codesOrder(codes){
    const a = (codes || []).filter(Boolean);
    const rest = a.filter(c => c !== "Datum");
    return rest.length ? rest : a.slice(0, 1);
  }

  // kind: "link" | "shape" | "point" · codes: the object's code list · override: spec.display.overrides[id] ({ link?, shape?, point? })
  // styleFile: parsed style (Style.parse().style) or null · opts: { useStyle: false -> automatic colours only, c3d: true -> neutral, auto(code) -> colour }
  // -> { kind, color, linetype, weight, fill, alpha, hatch, marker, size, source, set } (only the fields of the kind)
  function resolve(kind, codes, override, styleFile, opts){
    if (!KINDS.includes(kind)) throw new Error("Style.resolve: unknown kind " + kind);
    opts = opts || {};
    const list = codesOrder(codes), primary = list[0] || "";
    const out = { kind, ...DEFAULTS[kind], source: "auto", set: [] };
    if (kind === "link") out.color = opts.c3d ? NEUTRAL : (opts.auto || autoColor)(primary);
    if (opts.c3d){ out.source = "c3d"; return out; }
    if (opts.useStyle === false) return out;
    const cs = styleFile && styleFile.codes;
    if (cs) for (const c of list){
      const e = Object.prototype.hasOwnProperty.call(cs, c) && cs[c] && cs[c][kind];
      if (e && typeof e === "object" && apply(out, kind, e)){ out.source = "code:" + c; break; }
    }
    if (override && apply(out, kind, override[kind])) out.source = "override";
    return out;
  }

  // ---------- the style file ----------
  const empty = () => ({ version: 1, codes: {}, text: { size: TEXT_SIZE } });
  // text or object -> { ok, style, warnings } | { ok: false, error }. Unknown keys are kept (later rounds add fields); bad fields are dropped with a warning
  function parse(input){
    let o = input;
    if (typeof o === "string"){
      if (!o.trim()) return { ok: false, error: "Style file is empty." };
      try{ o = JSON.parse(o.replace(/^﻿/, "")); }catch(e){ return { ok: false, error: "Style file is not valid JSON: " + e.message }; }
    }
    if (!o || typeof o !== "object" || Array.isArray(o)) return { ok: false, error: "Style file must be a JSON object." };
    const ver = o.version == null ? 1 : o.version;
    if (!isNum(ver) || ver > 1) return { ok: false, error: `Style file version ${ver} is newer than this app (supports 1).` };
    const warnings = [], st = { ...o, version: 1, codes: {}, text: { ...(o.text && typeof o.text === "object" ? o.text : {}) } };
    if (!(isNum(st.text.size) && st.text.size >= 6 && st.text.size <= 48)){ if ("size" in st.text) warnings.push("text.size ignored"); st.text.size = TEXT_SIZE; }
    if (o.codes != null && (typeof o.codes !== "object" || Array.isArray(o.codes))) warnings.push("codes ignored (not an object)");
    else for (const [code, entry] of Object.entries(o.codes || {})){
      if (!entry || typeof entry !== "object" || Array.isArray(entry)){ warnings.push(`${code}: ignored (not an object)`); continue; }
      const e = { ...entry };
      for (const kind of KINDS){
        if (!(kind in e)) continue;
        const src = e[kind];
        if (!src || typeof src !== "object" || Array.isArray(src)){ warnings.push(`${code}.${kind}: ignored`); delete e[kind]; continue; }
        const k = { ...src };
        for (const f of FIELDS[kind]){
          if (!(f in k)) continue;
          if (f === "hatch"){
            const h = hatchIn(k.hatch);
            if (!h || (typeof k.hatch === "string" && !h.pattern)){ warnings.push(`${code}.${kind}.hatch: ignored`); delete k.hatch; continue; }
            if (typeof k.hatch === "object" && Object.keys(k.hatch).some(x => ["pattern", "scale", "angle", "color"].includes(x) && !(x in h))) warnings.push(`${code}.${kind}.hatch: some fields ignored`);
            if (typeof k.hatch === "object") k.hatch = h;
            continue;
          }
          if (!FIELD_OK[f](k[f])){ warnings.push(`${code}.${kind}.${f}: ignored (${JSON.stringify(k[f])})`); delete k[f]; }
        }
        e[kind] = k;
      }
      st.codes[code] = e;
    }
    return { ok: true, style: st, warnings };
  }
  const serialize = style => JSON.stringify({ ...style, version: 1 }, null, 2) + "\n";
  // "สร้าง style จากสีที่เห็นตอนนี้": the automatic colour of each code written down as a link colour
  function fromColours(codes, autoFn){
    const st = empty(), f = autoFn || autoColor;
    for (const c of codes || []){
      if (!c || c in st.codes) continue;
      st.codes[c] = { link: { color: f(c) } };
    }
    return st;
  }
  // edit one code of a style in place (palette rows): patch fields; null / undefined = remove the field; an empty kind / code is removed
  function setField(style, code, kind, patch){
    if (!KINDS.includes(kind)) throw new Error("unknown kind " + kind);
    const e = style.codes[code] = style.codes[code] || {};
    const k = e[kind] = e[kind] || {};
    for (const [f, v] of Object.entries(patch || {})){ if (v === null || v === undefined) delete k[f]; else k[f] = v; }
    if (!Object.keys(k).length) delete e[kind];
    if (!Object.keys(e).length) delete style.codes[code];
    return style;
  }
  const textSize = style => style && style.text && isNum(style.text.size) ? style.text.size : TEXT_SIZE;

  // ---------- drawing helpers ----------
  // lineweight in mm -> screen px (fixed width, not zoomed): 0.25 mm = 2.4 px like links before round 10
  const weightPx = w => +(1.2 + 4.8 * w).toFixed(2);
  const DASH = { solid: "", dashed: "8 5", center: "14 4 3 4", hidden: "3 4" };
  const dash = lt => DASH[lt] || "";
  // pattern tile for a resolved hatch at the given zoom (px per drawing unit). null when there is nothing to draw
  function hatchTile(h, scale){
    if (!h || !HATCHES[h.pattern] || !HATCHES[h.pattern].build) return null;
    const s = Math.max(3, Math.min(120, 0.25 * scale * (h.scale || 1)));
    const t = HATCHES[h.pattern].build(h.color || "#c8b89a", +s.toFixed(2));
    return { ...t, angle: h.angle || 0, key: `${h.pattern}|${h.color || ""}|${+s.toFixed(1)}|${h.angle || 0}` };
  }

  // the cleaned value stored for a field (hatch: pattern upper-cased, a name becomes { pattern }); call after checkField
  const cleanField = (field, v) => field === "hatch" ? hatchIn(v) : typeof v === "string" ? v.trim() : v;

  return { cleanField, LINETYPES, MARKERS, KINDS, FIELDS, DEFAULTS, HATCHES, NEUTRAL, AUTO_PALETTE, NO_CODE, TEXT_SIZE,
           autoIndex, autoColor, codesOrder, checkField, resolve, empty, parse, serialize, fromColours, setField, textSize, weightPx, dash, hatchTile, isColor };
})();
if (typeof module !== "undefined") module.exports = Style;
