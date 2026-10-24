"use strict";

// ================================================================ config

const KINDS = {
  farm:            { color: "#e3b23c" },
  livestock_farm:  { color: "#e07a5f" },
  forest:          { color: "#4caf6a" },
  saw_mill:        { color: "#b0804a" },
  fishing_grounds: { color: "#38b6d8" },
  oil_platform:    { color: "#7d8ce0" },
  oil_well:        { color: "#9c8cd9" },
  oil_refinery:    { color: "#b57ad6" },
};
const EXTRA_COLORS = ["#d9d16a", "#6ad9b8", "#d96aa5", "#8fd96a", "#d98f6a", "#6a9fd9", "#c0c0c0"];
const TOWN_DIST = 2000, INDUSTRY_DIST = 900, STATION_DIST = 700, MIN_DIST = 300, MAX_DIST = 12000;
const MINOR_STREET = /town|city|residential|small|old/i;

// Layer keys, in settings order. "count" gives the number shown on the quick chip.
const LAYERS = [
  { key: "lines", color: "#ff7a59", line: true },
  { key: "stations", color: "#ffffff", round: true },
  { key: "vehicles", color: "#7fd1ff", round: true },
  { key: "catchment", color: "rgba(255,204,77,0.6)", round: true },
  { key: "rail", color: "#e8e2d6", line: true },
  { key: "street", color: "#7d93a6", line: true },
  { key: "towns", color: "#f4efe6", round: true },
  { key: "industries", color: "#e3b23c" },
  { key: "terrain", color: "#4b6a55" },
  { key: "biomes", color: "#7aa35a" },
  { key: "noise", color: "#ff8a3d" },
  { key: "pollution", color: "#a3743a" },
];
const DEFAULT_LAYERS = { lines: true, stations: true, vehicles: true, catchment: false, rail: true, street: true, towns: true,
  industries: true, terrain: true, biomes: false, noise: false, pollution: false };
const DEFAULT_PINS = ["lines", "stations", "vehicles", "rail", "street", "towns", "industries"];

// Line categories: one row in the filter matrix each. "kinds" = which columns of the matrix apply:
// in TF3 every road line reports both BUS and TRUCK modes, so road lines are split by what they carry -
// passengers make a bus line, cargo a truck line.
const CATS = [
  { key: "train", kinds: "pc" },
  { key: "tram", kinds: "pc" },
  { key: "bus", kinds: "p" },
  { key: "truck", kinds: "c" },
  { key: "plane", kinds: "pc" },
  { key: "heli", kinds: "pc" },
  { key: "ship", kinds: "pc" },
];
const AIR_CATS = ["plane", "heli"];

// Transport icons on a 24x24 grid, drawn as 2px strokes (shared by the canvas and inline SVG).
const MODE_ICONS = {
  train: "M8 3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM5 10h14M9 13.5h.01M15 13.5h.01M9 17l-2.5 4.5M15 17l2.5 4.5",
  tram: "M7 7h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM5 12.5h14M12 7V3M8.5 3h7M9 16h.01M15 16h.01M8.5 22l1-3M15.5 22l-1-3",
  bus: "M6.5 3h11A2.5 2.5 0 0 1 20 5.5V18H4V5.5A2.5 2.5 0 0 1 6.5 3zM4 11h16M7.5 14.5h.01M16.5 14.5h.01M6.5 18v3M17.5 18v3M2 7.5v3M22 7.5v3",
  truck: "M2 5h11v11H2zM13 8.5h4.5L21 12.5V16h-8M4.5 18.5a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15.5 18.5a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  plane: "M12 2.5c.9 0 1.5.9 1.5 2v5l7 4v2l-7-2v4.3l2 1.5V21l-3.5-1-3.5 1v-1.7l2-1.5v-4.3l-7 2v-2l7-4v-5c0-1.1.6-2 1.5-2z",
  heli: "M3.5 5.5h15M13 5.5V9M10 9h4a4 4 0 0 1 0 8h-4zM10 13H3M3 10.5v5M9 20.5h10M12 17v3.5M16 17v3.5",
  ship: "M2.5 14h19l-3 6.5h-13zM6 14v-4h11v4M11 10V5.5h3.5V10",
};
const ICON_PATHS = {};
function iconPath2D(k) { return ICON_PATHS[k] || (ICON_PATHS[k] = new Path2D(MODE_ICONS[k])); }
function iconSvg(k, cls) {
  return MODE_ICONS[k] ? `<svg class="${cls || "mi"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${MODE_ICONS[k]}"/></svg>` : "";
}

// Terrain palettes. land: colour stops by height above the water line (0..1, square-root scaled).
const MAP_STYLES = {
  natural: {
    land: [[0, [96, 122, 80]], [0.3, [120, 134, 88]], [0.6, [146, 138, 100]], [0.85, [158, 144, 124]], [1, [200, 196, 188]]],
    shallow: [70, 132, 164], deep: [28, 68, 104], flatLand: [104, 126, 86], flatWater: [52, 104, 138],
    grid: "rgba(0,0,0,0.07)", gridMajor: "rgba(0,0,0,0.13)", edge: "rgba(0,0,0,0.35)",
  },
  dark: {
    land: [[0, [34, 50, 46]], [0.5, [48, 62, 56]], [1, [92, 98, 96]]],
    shallow: [22, 62, 92], deep: [10, 30, 50], flatLand: [36, 52, 48], flatWater: [16, 46, 72],
    grid: "rgba(255,255,255,0.045)", gridMajor: "rgba(255,255,255,0.08)", edge: "#233343",
  },
};

// ================================================================ settings (per device)

function store(key, value) { try { localStorage.setItem("tf3map." + key, JSON.stringify(value)); } catch (e) {} }
function recall(key, fallback) {
  try { const v = localStorage.getItem("tf3map." + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
}

const SET = {
  lang: recall("lang", null),
  layers: { ...DEFAULT_LAYERS, ...recall("layers", {}) },
  pins: recall("pins", DEFAULT_PINS),
  lineFilter: recall("lineFilter", {}),
  hiddenKinds: new Set(recall("hiddenKinds", [])),
  showPop: recall("showPop", true),
  showNeeds: recall("showNeeds", false),
  follow: recall("follow", false),
  mapStyle: recall("mapStyle", "natural"),
  lineTags: recall("lineTags", true),
  rotation: recall("rotation", recall("rotate", false) ? "auto" : 0),   // degrees clockwise, or "auto" = turn to fit the screen
  units: recall("units", "km"),
  chain: recall("chain", null),   // "Only this chain" in effect: { kind, prev: hidden types before, ind: industries layer before }
};
if (!MAP_STYLES[SET.mapStyle]) SET.mapStyle = "natural";
for (const c of CATS) SET.lineFilter[c.key] = { p: true, c: true, ...(SET.lineFilter[c.key] || {}) };
function saveSettings() {
  store("lang", SET.lang); store("layers", SET.layers); store("pins", SET.pins); store("lineFilter", SET.lineFilter);
  store("hiddenKinds", [...SET.hiddenKinds]); store("showPop", SET.showPop); store("showNeeds", SET.showNeeds); store("follow", SET.follow);
  store("mapStyle", SET.mapStyle); store("lineTags", SET.lineTags); store("rotation", SET.rotation); store("units", SET.units);
  store("chain", SET.chain);
}

// ---- filter defaults / reset
function lineFilterAllOn() { return CATS.every(c => SET.lineFilter[c.key].p && SET.lineFilter[c.key].c); }
function layersAreDefault(keys) { return (keys || LAYERS.map(L => L.key)).every(k => !!SET.layers[k] === !!DEFAULT_LAYERS[k]); }
// Filters the quick bar does not show: line filter, industry types, layers that are not pinned.
function hiddenFiltersActive() {
  return !lineFilterAllOn() || (SET.hiddenKinds.size > 0 && !SET.chain) || !layersAreDefault(LAYERS.map(L => L.key).filter(k => !SET.pins.includes(k)));
}
function filtersAreDefault() { return lineFilterAllOn() && SET.hiddenKinds.size === 0 && layersAreDefault(); }
function resetFilters() {
  SET.layers = { ...DEFAULT_LAYERS };
  for (const c of CATS) SET.lineFilter[c.key] = { p: true, c: true };
  SET.hiddenKinds.clear();
  SET.chain = null;
}
setLang(pickLang(SET.lang));

// ================================================================ state

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const S = {
  world: null, live: null,
  towns: [], industries: [], kinds: [],
  bounds: null, pointBounds: null,
  view: { cx: 0, cy: 0, scale: 0.02, rot: 0 },   // scale = screen px per metre, rot = radians clockwise
  lastLiveAt: 0, sseOk: false,
  pulses: [], fitted: false, camAnim: null,
  net: { session: null, seq: 0, templates: [], tiles: new Map(), counts: { rail: 0, street: 0 }, bbox: null },
  netBusy: false, netWanted: null,
  versions: {}, loading: {},
  meta: null, cargo: new Map(),        // cargo id -> {name, icon, color}
  groups: [], groupById: new Map(), stationById: new Map(),
  lines: [], lineById: new Map(), linePaths: new Map(), pathsVersion: 0,
  lineAnchors: new Map(), tagHits: [], indTagHits: [], trails: {},
  vehicles: [], townData: new Map(),
  grids: {}, rasters: {},
  flows: null,
  sel: null, cardMore: false,
  kindCargo: new Map(), flowCargo: new Map(),   // what industries accept / produce
};

// ================================================================ helpers

// Lua writes an empty table as {} - in our data every empty table stands for an empty list.
function normalize(x) {
  if (Array.isArray(x)) return x.map(normalize);
  if (x && typeof x === "object") {
    const keys = Object.keys(x);
    if (!keys.length) return [];
    const out = {};
    for (const k of keys) out[k] = normalize(x[k]);
    return out;
  }
  return x;
}

function cssColor(rgb, a) {
  if (!rgb) return a == null ? "#999" : `rgba(150,150,150,${a})`;
  const [r, g, b] = rgb.map(v => Math.round(clamp(v, 0, 1) * 255));
  return a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}
function fmtInt(n) { return n == null ? "—" : Math.round(n).toLocaleString(CUR_LANG); }
const FT = 0.3048, MI = 1609.344;
function fmtLen(m) {
  if (SET.units === "mi") {
    const mi = m / MI;
    return mi >= 0.1 ? mi.toFixed(mi >= 100 ? 0 : 1) + " " + t("unit.mi") : Math.round(m / FT) + " " + t("unit.ft");
  }
  return m >= 1000 ? (m / 1000).toFixed(m >= 100000 ? 0 : 1) + " " + t("unit.km") : Math.round(m) + " " + t("unit.m");
}
// Label of a scale-bar step (the step is a round number in the chosen units).
function fmtStep(m) {
  if (SET.units === "mi") {
    const ft = m / FT;
    return ft < 2600 ? Math.round(ft) + " " + t("unit.ft") : +(m / MI).toFixed(2) + " " + t("unit.mi");
  }
  return m >= 1000 ? m / 1000 + " " + t("unit.km") : m + " " + t("unit.m");
}
function fmtDur(sec) {
  if (sec == null || !isFinite(sec)) return "—";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m ? `${m} ${t("unit.min")} ${s ? s + " " + t("unit.s") : ""}`.trim() : `${s} ${t("unit.s")}`;
}
function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function kindOf(type) { const m = /industries\/([^/]+)\//.exec(type || ""); return m ? m[1] : "other"; }
function kindLabel(k) { return k.replace(/_/g, " ").replace(/^./, c => c.toUpperCase()); }
function kindColor(k) {
  if (!KINDS[k]) KINDS[k] = { color: EXTRA_COLORS[Object.keys(KINDS).length % EXTRA_COLORS.length] };
  return KINDS[k].color;
}
function cargoName(id) { const c = S.cargo.get(id); return c ? (c.name || c.res || "#" + id) : "#" + id; }
function cargoColor(id) { const c = S.cargo.get(id); return c && c.color ? cssColor(c.color) : "#aaa"; }

// cargo icons: PNGs the Mac server extracts from the game files
const iconCache = new Map();
function cargoIcon(id) {
  let e = iconCache.get(id);
  if (!e) {
    const img = new Image();
    e = { img, ok: false, failed: false };
    img.onload = () => { e.ok = true; draw(); };
    img.onerror = () => { e.failed = true; };
    img.src = "icon/" + id + ".png";
    iconCache.set(id, e);
  }
  return e;
}
function iconHtml(id) {
  return `<img class="ic" src="icon/${id}.png" onerror="this.outerHTML='<span class=&quot;sw round&quot; style=&quot;background:${cargoColor(id)}&quot;></span>'" alt="">`;
}

// What an industry accepts (inp) and produces (out): from the mod, else learnt from its flows,
// else from another industry of the same kind.
function industryCargo(i) {
  if ((i.out && i.out.length) || (i.inp && i.inp.length)) return { inp: i.inp || [], out: i.out || [] };
  return S.flowCargo.get(i.id) || S.kindCargo.get(i.kind) || null;
}
function kindCargo(k) { return S.kindCargo.get(k) || null; }
// Cargo icons as HTML: inputs, an arrow, outputs.
function cargoFlowHtml(io) {
  if (!io) return "";
  const one = id => `<span class="ci" title="${escapeHtml(cargoName(id))}">${iconHtml(id)}</span>`;
  const inp = (io.inp || []).map(one).join(""), out = (io.out || []).map(one).join("");
  return `<span class="cflow">${inp}${inp && out ? `<span class="arr">→</span>` : ""}${out}</span>`;
}

// ---- cargo chains: who can supply an industry and who takes its cargo, from what each industry
// accepts and produces (the game's own stock rules, so modded industries work too).
// Everything a type accepts / produces, over all industries of that type.
function kindIO(kind) {
  const inp = new Set(), out = new Set();
  for (const i of S.industries) {
    if (i.kind !== kind) continue;
    const io = industryCargo(i); if (!io) continue;
    for (const c of io.inp || []) inp.add(c);
    for (const c of io.out || []) out.add(c);
  }
  return { inp, out };
}
// A type plus the types that supply it (make one of its inputs) or take its cargo (accept one of its outputs).
function chainKinds(kind) {
  const me = kindIO(kind), keep = new Set([kind]);
  for (const k of S.kinds) {
    if (k.key === kind) continue;
    const o = kindIO(k.key);
    if ([...me.out].some(c => o.inp.has(c)) || [...me.inp].some(c => o.out.has(c))) keep.add(k.key);
  }
  return keep;
}
// Industry types filter: only this type and its direct partners.
function showChain(kind) {
  const keep = chainKinds(kind);
  // remember what was shown before the first chain, so undo goes back there even after switching chains
  SET.chain = SET.chain ? { ...SET.chain, kind } : { kind, prev: [...SET.hiddenKinds], ind: SET.layers.industries };
  SET.hiddenKinds.clear();
  for (const k of S.kinds) if (!keep.has(k.key)) SET.hiddenKinds.add(k.key);
  SET.layers.industries = true;
  saveSettings(); renderQuick(); renderCard(); draw();
  if (document.getElementById("settings").classList.contains("open")) renderSettings();
  toast(t("toast.chain").replace("{kinds}", [...keep].map(kindLabel).join(", ")), false, 2000);
}
// Cargo the chain is about: what the chain's type accepts and produces. Cached until the world reloads.
let chainCargoCache = null;
function chainCargo() {
  const kind = SET.chain && SET.chain.kind;
  const c = chainCargoCache;
  if (c && c.kind === kind && c.inds === S.industries) return c.set;
  const io = kindIO(kind);
  chainCargoCache = { kind, inds: S.industries, set: new Set([...io.inp, ...io.out]) };
  return chainCargoCache.set;
}
// Undo "Only this chain": industry types (and the industries layer) as they were before.
function undoChain() {
  if (!SET.chain) return;
  SET.hiddenKinds = new Set(SET.chain.prev || []);
  SET.layers.industries = SET.chain.ind !== false;
  SET.chain = null;
  saveSettings(); renderQuick(); renderCard(); draw();
  if (document.getElementById("settings").classList.contains("open")) renderSettings();
}
// For one industry: per cargo, every industry (and, for its outputs, every town) that could be its partner,
// nearest first. "linked" = the game already logs deliveries between the two.
function chainPartners(ind) {
  const io = industryCargo(ind);
  if (!io || ind.x == null) return null;
  const f = S.flows && S.flows.entity === ind.id && !S.flows.pending ? S.flows : null;
  const linked = new Set([...((f && f.out) || []), ...((f && f.inn) || [])].map(([e, c]) => e + ":" + c));
  const dist = o => Math.hypot(o.x - ind.x, o.y - ind.y);
  const find = (cid, takes) => {
    const res = [];
    for (const o of S.industries) {
      if (o.id === ind.id || o.x == null) continue;
      const oio = industryCargo(o); if (!oio) continue;
      if ((takes ? oio.inp || [] : oio.out || []).includes(cid)) res.push({ o, d: dist(o), linked: linked.has(o.id + ":" + cid) });
    }
    if (takes) for (const tw of S.towns) {
      if (tw.x == null) continue;
      const d = S.townData.get(tw.id);
      if (d && (d.needs || []).some(n => n[0] === cid)) res.push({ o: tw, town: true, d: dist(tw), linked: linked.has(tw.id + ":" + cid) });
    }
    return res.sort((a, b) => b.linked - a.linked || a.d - b.d);
  };
  return { out: (io.out || []).map(cid => ({ cid, list: find(cid, true) })), inp: (io.inp || []).map(cid => ({ cid, list: find(cid, false) })) };
}
const CHAIN_ROWS = 3;   // partners listed / drawn per cargo (plus every one already linked)
function chainShown(list) {
  const n = Math.max(CHAIN_ROWS, list.filter(p => p.linked).length);
  return list.slice(0, n);
}
function partnerVisible(p) { return p.town ? SET.layers.towns : SET.layers.industries && !SET.hiddenKinds.has(p.o.kind); }
// One cargo icon on the canvas (falls back to a dot in the cargo's colour until the PNG arrives).
function drawCargoIcon(id, x, y, size) {
  const ic = cargoIcon(id);
  if (ic.ok) ctx.drawImage(ic.img, x, y, size, size);
  else { ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size * 0.4, 0, Math.PI * 2); ctx.fillStyle = cargoColor(id); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.stroke(); }
}

function passengerId() { return S.meta && S.meta.passengerId != null ? S.meta.passengerId : 0; }

// Works out per line: the cargo list with real cargo ids (L.use), passengers/cargo flags and the category.
// The game hands getLineCapacityUsages as a 1-based list over all cargo types (entry k = cargo id k-1);
// mod v5 wrote the list index as the id, so older data is shifted back here.
function prepLine(L) {
  let u = (L.usage || []).filter(x => Array.isArray(x)).map(x => [+x[0], +x[1] || 0, +x[2] || 0]);
  if (u.length && S.cargo.size && !L.usageIds) {
    const maxId = Math.max(...S.cargo.keys());
    const ids = u.map(x => x[0]).sort((a, b) => a - b);
    if (u.length === maxId + 1 && ids[0] === 1 && ids[ids.length - 1] === u.length) u = u.map(x => [x[0] - 1, x[1], x[2]]);
  }
  L.use = u.filter(x => x[2] > 0 || x[1] > 0);
  // cargo the line has actually been seen carrying (universal trucks have capacity for everything)
  if (L.id != null) {
    let seen = LINE_SEEN.get(L.id);
    if (!seen) LINE_SEEN.set(L.id, seen = new Set());
    for (const x of L.use) if (x[1] > 0) seen.add(x[0]);
  }
  const pid = passengerId();
  const modes = L.modes || [];
  if (L.use.length) {
    L._pass = L.use.some(x => x[0] === pid);
    L._cargo = L.use.some(x => x[0] !== pid);
  } else {
    L._pass = !!L.pass || (!L.cargo && !modes.includes("CARGO"));
    L._cargo = !!L.cargo || (!L.pass && modes.includes("CARGO"));
  }
  const car = L.carriers || [], has = m => modes.includes(m);
  let cat;
  if (car.includes("RAIL")) cat = "train";
  else if (car.includes("TRAM")) cat = "tram";
  else if (car.includes("WATER")) cat = "ship";
  else if (car.includes("AIR")) cat = has("AIRCRAFT") || has("SMALL_AIRCRAFT") ? "plane" : "heli";
  else if (car.includes("ROAD")) cat = L._pass || !L._cargo ? "bus" : "truck";
  else if (has("TRAIN") || has("ELECTRIC_TRAIN")) cat = "train";
  else if (has("TRAM") || has("ELECTRIC_TRAM")) cat = "tram";
  else if (has("SHIP") || has("SMALL_SHIP")) cat = "ship";
  else if (has("AIRCRAFT") || has("SMALL_AIRCRAFT")) cat = "plane";
  else if (has("HELICOPTER")) cat = "heli";
  else cat = has("TRUCK") && (!has("BUS") || (L._cargo && !L._pass)) ? "truck" : "bus";
  L._cat = cat;
}
const LINE_SEEN = new Map();   // line id -> cargo ids seen loaded on it during this session
// The line's cargo for chain filtering: what it has carried, else what it has room for.
function lineCargoIds(L) {
  if (!L._cat) prepLine(L);
  const seen = LINE_SEEN.get(L.id);
  return seen && seen.size ? [...seen] : (L.use || []).map(x => x[0]);
}
function lineCat(L) { if (!L._cat) prepLine(L); return L._cat; }
function lineIsPass(L) { if (!L._cat) prepLine(L); return L._pass; }
function lineIsCargo(L) { if (!L._cat) prepLine(L); return L._cargo; }
function catOf(key) { return CATS.find(c => c.key === key) || CATS[2]; }
function lineVisible(L) {
  if (!SET.layers.lines) return false;
  // "Only this chain": just the lines that can carry the chain's cargo, so the chain stands out
  if (SET.chain) { const cs = chainCargo(); if (!lineCargoIds(L).some(c => cs.has(c))) return false; }
  const c = catOf(lineCat(L)), f = SET.lineFilter[c.key];
  const p = c.kinds.includes("p") && f.p, cg = c.kinds.includes("c") && f.c;
  if (!lineIsPass(L) && !lineIsCargo(L)) return p || cg;   // no vehicles yet
  // a mixed road line is a bus line: its cargo side follows the bus row
  if (c.kinds === "p") return f.p;
  if (c.kinds === "c") return f.c;
  return (lineIsPass(L) && p) || (lineIsCargo(L) && cg);
}
function lineColor(L) { return L.color ? cssColor(L.color) : "#ff7a59"; }
function lineRgb(L) { return L.color ? L.color.map(v => clamp(v, 0, 1) * 255) : [255, 122, 89]; }
// dark or light ink for text/icons drawn on a coloured background
function inkOn(rgb) { const [r, g, b] = rgb; return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#0f1720" : "#ffffff"; }
function stationCat(g) {
  const c = g.carriers || [];
  if (c.includes("RAIL")) return "train";
  if (c.includes("AIR")) return "plane";
  if (c.includes("WATER")) return "ship";
  if (c.includes("TRAM")) return "tram";
  if (c.includes("ROAD")) return g.st.some(s => s.pass) || !g.st.some(s => s.cargo) ? "bus" : "truck";
  return null;
}

function stationPosOfStop(stop) {
  const g = S.groupById.get(stop[0]);
  if (!g) return null;
  const st = g.st.find(s => s.i === stop[1]) || g.st[0];
  return st && st.x != null ? [st.x, st.y] : (g.x != null ? [g.x, g.y] : null);
}

// ================================================================ data handlers

function setWorld(w) {
  S.world = w;
  S.towns = (w.towns || []).filter(t => t.x != null).map(t => ({ ...t, kind: "town" }));
  S.industries = (w.industries || []).filter(i => i.x != null).map(i => ({ ...i, kind: kindOf(i.type) }));
  const counts = {};
  for (const i of S.industries) counts[i.kind] = (counts[i.kind] || 0) + 1;
  S.kinds = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map(k => ({ key: k, n: counts[k] }));
  for (const i of S.industries) {
    if ((i.out && i.out.length) || (i.inp && i.inp.length)) S.kindCargo.set(i.kind, { inp: i.inp || [], out: i.out || [] });
  }
  const pts = [...S.towns, ...S.industries];
  S.pointBounds = null;
  if (pts.length) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    S.pointBounds = { x0, y0, x1, y1 };
  }
  updateBounds();
  renderQuick();
  if (S.sel) renderCard();
  draw();
}

function updateBounds() {
  const parts = [S.pointBounds, S.net.bbox].filter(Boolean);
  if (S.meta && S.meta.bbox) parts.push(S.meta.bbox);
  if (!parts.length) S.bounds = null;
  else {
    const x0 = Math.min(...parts.map(b => b.x0)), y0 = Math.min(...parts.map(b => b.y0));
    const x1 = Math.max(...parts.map(b => b.x1)), y1 = Math.max(...parts.map(b => b.y1));
    const pad = S.meta && S.meta.bbox ? 0 : Math.max(x1 - x0, y1 - y0) * 0.04 + 500;
    S.bounds = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }
  document.getElementById("empty").style.display = S.bounds ? "none" : "grid";
  if (!S.fitted && S.bounds && S.pointBounds) { updateRotation(); fit(); S.fitted = true; }
}

function setLive(l) {
  const now = performance.now();
  const c = l.camera;
  if (c && c.x != null) {
    const from = camNow() || c;
    const gap = S.lastLiveAt ? now - S.lastLiveAt : 100;
    S.camAnim = { from: { ...from }, to: { ...c }, t0: now, dur: clamp(gap, 60, 400) };
  }
  S.live = l;
  S.lastLiveAt = now;
  updateStatus();
  draw();
}
function camNow() {
  const a = S.camAnim;
  if (!a) return S.live && S.live.camera && S.live.camera.x != null ? S.live.camera : null;
  const k = clamp((performance.now() - a.t0) / a.dur, 0, 1);
  const e = k * (2 - k);
  const out = {};
  for (const key of Object.keys(a.to)) {
    const f = a.from[key], g = a.to[key];
    out[key] = (typeof f === "number" && typeof g === "number") ? f + (g - f) * e : g;
  }
  return out;
}
function camAnimating() { return S.camAnim && performance.now() - S.camAnim.t0 < S.camAnim.dur; }
function cameraDistance() {
  const c = camNow();
  if (!c || c.ex == null) return 1500;
  return clamp(Math.hypot(c.ex - c.x, c.ey - c.y, c.ez - c.z), MIN_DIST, MAX_DIST);
}

const DATA_HANDLERS = {
  meta(d) {
    S.meta = d;
    S.cargo = new Map((d.cargo || []).map(c => [c.id, c]));
    S.rasters = {};
    for (const L of S.lines) prepLine(L);   // cargo ids and passenger id are known now
    updateBounds();
    if (S.sel) renderCard();
  },
  stations(d) {
    S.groups = (d.groups || []).map(g => {
      const st = (g.st || []).filter(s => s.x != null);
      const x = st.length ? st.reduce((a, s) => a + s.x, 0) / st.length : null;
      const y = st.length ? st.reduce((a, s) => a + s.y, 0) / st.length : null;
      return { ...g, st: g.st || [], x, y, kind: "station" };
    });
    S.groupById = new Map(S.groups.map(g => [g.id, g]));
    S.stationById = new Map();
    for (const g of S.groups) for (const s of g.st) S.stationById.set(s.id, { ...s, group: g });
    S.linePaths.clear(); S.lineAnchors.clear();
  },
  lines(d) {
    S.lines = (d.lines || []).map(L => ({ ...L, kind: "line" }));
    for (const L of S.lines) prepLine(L);
    S.lineById = new Map(S.lines.map(L => [L.id, L]));
    S.linePaths.clear(); S.lineAnchors.clear();
    maybeLineHint();
  },
  paths(d) { S.paths = d.paths || {}; S.linePaths.clear(); S.lineAnchors.clear(); },
  trails(d) { S.trails = d.lines || {}; S.linePaths.clear(); S.lineAnchors.clear(); },
  veh(d) {
    const out = [];
    for (const part of (d.v || "").split(";")) {
      if (!part) continue;
      const f = part.split(",");
      out.push({ id: +f[0], line: +f[1], x: +f[2], y: +f[3], kind: "vehicle" });
    }
    S.vehicles = out;
  },
  towns(d) { S.townData = new Map((d.towns || []).map(x => [x.id, x])); },
  flows(d) {
    S.flows = d;
    // an industry's flows also say what it accepts and produces (used when the mod does not export it)
    if (d.kind === "industry" && ((d.inputs || []).length || (d.outputs || []).length)) {
      const io = { inp: d.inputs || [], out: d.outputs || [] };
      S.flowCargo.set(d.entity, io);
      const ind = S.industries.find(x => x.id === d.entity);
      if (ind && !S.kindCargo.has(ind.kind)) S.kindCargo.set(ind.kind, io);
    }
    if (S.sel) renderCard();
  },
  grid_terrain(d) { S.grids.terrain = d; delete S.rasters.base; },
  grid_noise(d) { S.grids.noise = d; delete S.rasters.noise; },
  grid_pollution(d) { S.grids.pollution = d; delete S.rasters.pollution; },
};

async function fetchData(name, version) {
  if (S.loading[name]) { S.loading[name] = version; return; }
  S.loading[name] = version;
  try {
    const r = await fetch("data/" + name, { cache: "no-store" });
    if (r.ok) {
      const p = await r.json();
      S.versions[name] = p.version;
      DATA_HANDLERS[name](normalize(p.data));
      renderQuick();
      if (S.sel) renderCard();
      draw();
    }
  } catch (e) {
    console.warn("fetch", name, e);
  } finally {
    const want = S.loading[name];
    S.loading[name] = 0;
    if (want && want !== version && want !== S.versions[name]) fetchData(name, want);
  }
}
function onVersions(v) {
  for (const [name, ver] of Object.entries(v)) {
    if (DATA_HANDLERS[name] && S.versions[name] !== ver) fetchData(name, ver);
  }
}

// ================================================================ network (rails + roads)

function buildTile(key, str, templates) {
  const tl = {
    key, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity,
    rail: new Path2D(), railTunnel: new Path2D(), road: new Path2D(), street: new Path2D(), streetTunnel: new Path2D(),
    nRail: 0, nStreet: 0, has: {}, railSegs: [],
  };
  if (!str) return tl;
  const minor = templates.map(n => MINOR_STREET.test(n || ""));
  for (const e of str.split(";")) {
    const f = e.split(",");
    if (f.length < 7) continue;
    const kind = f[0], tunnel = f[2] === "2";
    const x0 = +f[3], y0 = +f[4], x1 = +f[5], y1 = +f[6];
    let layer;
    if (kind === "r") { layer = tunnel ? "railTunnel" : "rail"; tl.nRail++; }
    else { layer = tunnel ? "streetTunnel" : (minor[+f[1] - 1] ? "street" : "road"); tl.nStreet++; }
    const p = tl[layer];
    tl.has[layer] = true;
    p.moveTo(x0, y0);
    if (f.length >= 11) {
      const ax = +f[7], ay = +f[8], bx = +f[9], by = +f[10];
      p.bezierCurveTo(ax, ay, bx, by, x1, y1);
      if (kind === "r") tl.railSegs.push([x0, y0, ax, ay, bx, by, x1, y1]);
      tl.x0 = Math.min(tl.x0, ax, bx); tl.x1 = Math.max(tl.x1, ax, bx);
      tl.y0 = Math.min(tl.y0, ay, by); tl.y1 = Math.max(tl.y1, ay, by);
    } else {
      p.lineTo(x1, y1);
      if (kind === "r") tl.railSegs.push([x0, y0, x1, y1]);
    }
    tl.x0 = Math.min(tl.x0, x0, x1); tl.x1 = Math.max(tl.x1, x0, x1);
    tl.y0 = Math.min(tl.y0, y0, y1); tl.y1 = Math.max(tl.y1, y0, y1);
  }
  return tl;
}

function applyNet(p) {
  const net = S.net;
  if (p.full || p.session !== net.session) net.tiles = new Map();
  net.session = p.session;
  net.seq = p.seq || 0;
  net.templates = Array.isArray(p.templates) ? p.templates : [];
  for (const [k, str] of Object.entries(p.tiles || {})) net.tiles.set(k, buildTile(k, str, net.templates));
  const keep = new Set(p.keys || []);
  for (const k of [...net.tiles.keys()]) if (!keep.has(k)) net.tiles.delete(k);
  let r = 0, s = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const tl of net.tiles.values()) {
    r += tl.nRail; s += tl.nStreet;
    if (tl.nRail + tl.nStreet) { x0 = Math.min(x0, tl.x0); y0 = Math.min(y0, tl.y0); x1 = Math.max(x1, tl.x1); y1 = Math.max(y1, tl.y1); }
  }
  net.counts = { rail: r, street: s };
  net.bbox = x0 < x1 ? { x0, y0, x1, y1 } : null;
  updateBounds();
  renderQuick();
  draw();
}

async function syncNet(meta) {
  if (!meta) return;
  if (S.netBusy) { S.netWanted = meta; return; }
  if (meta.session === S.net.session && meta.seq === S.net.seq) return;
  S.netBusy = true;
  try {
    const same = meta.session === S.net.session;
    const r = await fetch(`net?session=${encodeURIComponent(S.net.session || "")}&since=${same ? S.net.seq : 0}`, { cache: "no-store" });
    applyNet(await r.json());
  } catch (e) {
    console.warn("net sync failed", e);
  } finally {
    S.netBusy = false;
    if (S.netWanted) { const m = S.netWanted; S.netWanted = null; syncNet(m); }
  }
}

// ================================================================ transport

function connect() {
  const es = new EventSource("events");
  es.addEventListener("world", e => setWorld(normalize(JSON.parse(e.data))));
  es.addEventListener("live", e => setLive(JSON.parse(e.data)));
  es.addEventListener("net", e => syncNet(JSON.parse(e.data)));
  es.addEventListener("versions", e => onVersions(JSON.parse(e.data)));
  es.onopen = () => { S.sseOk = true; updateStatus(); };
  es.onerror = () => { S.sseOk = false; updateStatus(); };
}

async function command(cmd, at) {
  let pulse = null;
  if (at) { pulse = { x: at.x, y: at.y, t0: performance.now(), state: "pending" }; S.pulses.push(pulse); draw(); }
  try {
    const r = await fetch("cmd", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
    const res = await r.json();
    if (pulse) { pulse.state = res.ok ? "ok" : "err"; pulse.t0 = performance.now(); }
    if (!res.ok) toast(res.error || t("toast.cmdFailed"), true);
    return res;
  } catch (e) {
    if (pulse) { pulse.state = "err"; pulse.t0 = performance.now(); }
    toast(t("status.noLink"), true);
  }
}

function jumpTo(target) {
  const dist = target.kind === "town" ? TOWN_DIST : target.kind === "station" ? STATION_DIST
    : (target.kind && target.kind !== "vehicle" ? INDUSTRY_DIST : cameraDistance());
  command({ action: "jump", x: target.x, y: target.y, dist }, target);
}

function requestFlows(kind, entity) {
  S.flows = { pending: true, entity, kind };
  command({ action: "flows", entity, kind });
}

// ================================================================ view math

const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  if (updateRotation()) fit();
  draw();
}
// World (x east, y north, metres) <-> screen. The map turns clockwise by S.view.rot about the screen centre.
function toScreen(x, y) {
  const dx = (x - S.view.cx) * S.view.scale, dy = -(y - S.view.cy) * S.view.scale;
  const c = Math.cos(S.view.rot), s = Math.sin(S.view.rot);
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}
function toWorld(sx, sy) {
  const rx = sx - W / 2, ry = sy - H / 2;
  const c = Math.cos(S.view.rot), s = Math.sin(S.view.rot);
  const dx = rx * c + ry * s, dy = -rx * s + ry * c;
  return [S.view.cx + dx / S.view.scale, S.view.cy - dy / S.view.scale];
}
function worldMatrix() {
  const k = S.view.scale, cx = S.view.cx, cy = S.view.cy;
  const c = Math.cos(S.view.rot), s = Math.sin(S.view.rot);
  return [k * c, k * s, k * s, -k * c, W / 2 - k * (c * cx + s * cy), H / 2 - k * (s * cx - c * cy)];
}
function setWorldTransform() {
  const m = worldMatrix();
  ctx.setTransform(DPR * m[0], DPR * m[1], DPR * m[2], DPR * m[3], DPR * m[4], DPR * m[5]);
}
function panBy(ddx, ddy) {
  const [ax, ay] = toWorld(0, 0), [bx, by] = toWorld(ddx, ddy);
  S.view.cx -= bx - ax; S.view.cy -= by - ay;
}
function mapIsTall() { return S.bounds && (S.bounds.y1 - S.bounds.y0) > (S.bounds.x1 - S.bounds.x0); }
// Rotation: a fixed angle from the settings or a two-finger twist, or "auto" = turn by 90 degrees
// when the map and the screen have different shapes.
function rotationDeg() {
  if (SET.rotation === "auto") return S.bounds && (W > H) === mapIsTall() ? 90 : 0;
  return +SET.rotation || 0;
}
function updateRotation() {
  const want = rotationDeg() * Math.PI / 180;
  if (Math.abs(want - S.view.rot) > 1e-9) { S.view.rot = want; return true; }
  return false;
}
function normAngle(a) { const f = 2 * Math.PI; return ((a % f) + f) % f; }
// Turn the map by da radians about a screen point, which stays in place.
function rotateAt(sx, sy, da) {
  const [wx, wy] = toWorld(sx, sy);
  S.view.rot = normAngle(S.view.rot + da);
  const [nx, ny] = toWorld(sx, sy);
  S.view.cx += wx - nx; S.view.cy += wy - ny;
}
// After a twist: snap to a right angle when close, and remember the angle.
function commitRotation() {
  let deg = S.view.rot * 180 / Math.PI;
  const near = Math.round(deg / 90) * 90;
  if (Math.abs(deg - near) < 4) deg = near;
  deg = Math.round(deg) % 360;
  S.view.rot = deg * Math.PI / 180;
  SET.rotation = deg; saveSettings();
  if (document.getElementById("settings").classList.contains("open")) renderSettings();
  draw();
}
function setRotation(v) {
  SET.rotation = v; saveSettings();
  updateRotation(); draw();
}
function updateCompass() {
  const el = document.getElementById("compass");
  const deg = Math.round(S.view.rot * 1800 / Math.PI) / 10;
  const show = deg % 360 !== 0;
  if (el.hidden === show) el.hidden = !show;
  const tr = `rotate(${deg}deg)`;
  if (el.dataset.tr !== tr) { el.firstElementChild.style.transform = tr; el.dataset.tr = tr; }
}
const TOP_PAD = 64, BOTTOM_PAD = 64;
function fit() {
  if (!S.bounds) return;
  const b = S.bounds;
  const ww = b.x1 - b.x0, wh = b.y1 - b.y0;
  const c = Math.abs(Math.cos(S.view.rot)), s = Math.abs(Math.sin(S.view.rot));
  const hor = ww * c + wh * s, ver = ww * s + wh * c;
  S.view.scale = Math.min(W / hor, (H - TOP_PAD - BOTTOM_PAD) / ver);
  S.view.cx = (b.x0 + b.x1) / 2;
  S.view.cy = (b.y0 + b.y1) / 2;
  panBy(0, (TOP_PAD - BOTTOM_PAD) / 2);
  draw();
}
// Scale so the map spans the full screen width; keeps the current vertical position.
function fitWidth() {
  if (!S.bounds) return;
  const b = S.bounds;
  const c = Math.abs(Math.cos(S.view.rot)), s = Math.abs(Math.sin(S.view.rot));
  S.view.scale = W / ((b.x1 - b.x0) * c + (b.y1 - b.y0) * s);
  const [sx] = toScreen((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
  panBy(W / 2 - sx, 0);
  draw();
}
function zoomAt(sx, sy, factor) {
  const [wx, wy] = toWorld(sx, sy);
  const minScale = S.bounds ? Math.min(W, H) / Math.max(S.bounds.x1 - S.bounds.x0, S.bounds.y1 - S.bounds.y0) * 0.5 : 0.001;
  S.view.scale = Math.min(2, Math.max(minScale, S.view.scale * factor));
  const [nx, ny] = toWorld(sx, sy);
  S.view.cx += wx - nx; S.view.cy += wy - ny;
}
function visibleWorldRect() {
  const vis = [toWorld(0, 0), toWorld(W, 0), toWorld(0, H), toWorld(W, H)];
  return {
    x0: Math.min(...vis.map(p => p[0])), x1: Math.max(...vis.map(p => p[0])),
    y0: Math.min(...vis.map(p => p[1])), y1: Math.max(...vis.map(p => p[1])),
  };
}

// ================================================================ rasters (terrain, biomes, noise, pollution)

function hexAt(s, i) { return parseInt(s.substr(i * 2, 2), 16) || 0; }
function rgbOf(css) { const m = /#(..)(..)(..)/.exec(css); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [128, 128, 128]; }

function biomeLegend() {
  const cl = (S.meta && S.meta.climates) || [];
  const g = S.grids.terrain;
  if (!cl.length) return null;
  if (cl.length === 1 || !g || !g.biome) return cl[0].biomes || [];
  // pick the climate whose biome ids cover the most sampled values
  const seen = new Set();
  for (let i = 0; i < g.biome.length; i += 7) seen.add(g.biome.charCodeAt(i) - 48);
  let best = cl[0], score = -1;
  for (const c of cl) {
    const ids = new Set((c.biomes || []).map(b => b.id));
    let n = 0;
    for (const v of seen) if (ids.has(v)) n++;
    if (n > score) { score = n; best = c; }
  }
  return best.biomes || [];
}

function mapStyle() { return MAP_STYLES[SET.mapStyle] || MAP_STYLES.natural; }
function rampColor(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0] || i === stops.length - 1) {
      const [t0, a] = stops[i - 1], [t1, b] = stops[i];
      const f = clamp((t - t0) / Math.max(1e-6, t1 - t0), 0, 1);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
  }
  return stops[0][1].slice();
}

// Land/water picture of the map. Relief on: colour by height above the water line plus hill shading
// lit from the north-west. Relief off: flat land and water. Biomes tint the land.
function buildBaseRaster() {
  const g = S.grids.terrain;
  if (!g || !g.nx) return null;
  const st = mapStyle();
  const useRelief = SET.layers.terrain, useBiome = SET.layers.biomes && g.biome;
  const cv = document.createElement("canvas");
  cv.width = g.nx; cv.height = g.ny;
  const c2 = cv.getContext("2d");
  const img = c2.createImageData(g.nx, g.ny);
  const n = g.nx * g.ny;
  const bcol = new Map();
  if (useBiome) for (const b of biomeLegend() || []) bcol.set(b.id, (b.color || [0.5, 0.5, 0.5]).map(v => v * 255));
  // heights in metres
  const hmin = g.hmin != null ? +g.hmin : 0, hmax = g.hmax != null ? +g.hmax : 255;
  const span = Math.max(1, hmax - hmin);
  const H = new Float32Array(n);
  for (let i = 0; i < n; i++) H[i] = hmin + hexAt(g.height || "", i) / 255 * span;
  const isWater = i => g.water && g.water[i] === "1";
  // water line: from the game when known, else just above most of the sea floor we sampled
  let wl = S.meta && S.meta.waterLevel != null ? +S.meta.waterLevel : null;
  if (wl == null) {
    const wh = [];
    for (let i = 0; i < n; i += 3) if (isWater(i)) wh.push(H[i]);
    wh.sort((a, b) => a - b);
    wl = wh.length ? wh[Math.floor(wh.length * 0.9)] : hmin;
  }
  const landSpan = Math.max(1, hmax - wl), depthSpan = Math.max(1, wl - hmin);
  const at = (ix, iy) => H[clamp(iy, 0, g.ny - 1) * g.nx + clamp(ix, 0, g.nx - 1)];
  const ex = 3, cell = g.cell || 256;
  const L = [-0.5, 0.5, 0.7071];   // light from the north-west, 45 degrees up
  for (let iy = 0; iy < g.ny; iy++) {
    for (let ix = 0; ix < g.nx; ix++) {
      const i = iy * g.nx + ix;
      // image row 0 is drawn at world y0 (south) by the flipped world transform
      const o = i * 4;
      let c;
      if (isWater(i)) {
        if (useRelief) {
          const d = Math.sqrt(clamp((wl - H[i]) / depthSpan, 0, 1));
          c = [0, 1, 2].map(k => st.shallow[k] + (st.deep[k] - st.shallow[k]) * d);
        } else c = st.flatWater.slice();
      } else {
        c = useRelief ? rampColor(st.land, Math.sqrt(clamp((H[i] - wl) / landSpan, 0, 1))) : st.flatLand.slice();
        if (useBiome) {
          const bc = bcol.get(g.biome.charCodeAt(i) - 48);
          if (bc) c = c.map((v, k) => v * 0.45 + bc[k] * 0.55 * (SET.mapStyle === "dark" ? 0.5 : 0.85));
        }
        if (useRelief) {
          const dzdx = (at(ix + 1, iy) - at(ix - 1, iy)) / (2 * cell) * ex;
          const dzdy = (at(ix, iy + 1) - at(ix, iy - 1)) / (2 * cell) * ex;   // +iy is north
          const len = Math.hypot(dzdx, dzdy, 1);
          const shade = (-dzdx * L[0] - dzdy * L[1] + L[2]) / len / L[2];   // 1 on flat ground
          const k = clamp(shade, 0.55, 1.35);
          c = c.map(v => v * k);
        }
      }
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
  }
  c2.putImageData(img, 0, 0);
  return { canvas: cv, g };
}

const HEAT = {
  noise: [[255, 214, 90], [255, 120, 50], [230, 40, 40]],
  pollution: [[190, 160, 90], [150, 100, 50], [100, 60, 40]],
};
function heatColor(stops, v) {
  const x = v * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  return stops[i].map((c, k) => c + (stops[i + 1][k] - c) * f);
}
function buildHeatRaster(kind) {
  const g = S.grids[kind];
  if (!g || !g.nx || !g.data) return null;
  const cv = document.createElement("canvas");
  cv.width = g.nx; cv.height = g.ny;
  const c2 = cv.getContext("2d");
  const img = c2.createImageData(g.nx, g.ny);
  for (let i = 0; i < g.nx * g.ny; i++) {
    const v = hexAt(g.data, i) / 255;
    if (v <= 0.02) continue;
    const [r, gg, b] = heatColor(HEAT[kind], v);
    const o = i * 4;
    img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = Math.round(40 + v * 150);
  }
  c2.putImageData(img, 0, 0);
  return { canvas: cv, g };
}
function drawRaster(r, smooth) {
  if (!r) return;
  ctx.save();
  setWorldTransform();
  ctx.imageSmoothingEnabled = smooth;
  ctx.drawImage(r.canvas, r.g.x0, r.g.y0, r.g.nx * r.g.cell, r.g.ny * r.g.cell);
  ctx.restore();
}

// ================================================================ drawing

let frameQueued = false;
function draw() { if (frameQueued) return; frameQueued = true; requestAnimationFrame(render); }

function niceStep(metresPerPx) {
  const target = metresPerPx * 90;
  if (SET.units === "mi") {
    const ft = target / FT;
    if (ft <= 2000) return [10, 20, 50, 100, 200, 500, 1000, 2000].find(v => v >= ft) * FT;
    const mi = target / MI, p = Math.pow(10, Math.floor(Math.log10(mi)));
    return Math.max(0.5, [1, 2, 5, 10].map(m => p * m).find(v => v >= mi)) * MI;
  }
  const p = Math.pow(10, Math.floor(Math.log10(target)));
  for (const m of [1, 2, 5, 10]) if (p * m >= target) return p * m;
  return p * 10;
}

function drawNet(vr) {
  const net = S.net;
  if (!net.tiles.size || (!SET.layers.rail && !SET.layers.street)) return;
  const s = S.view.scale;
  const tiles = [];
  for (const tl of net.tiles.values()) {
    if (tl.x1 < vr.x0 || tl.x0 > vr.x1 || tl.y1 < vr.y0 || tl.y0 > vr.y1) continue;
    tiles.push(tl);
  }
  const lineMode = SET.layers.lines && S.lines.length;   // dim the network under coloured lines
  const layers = [
    ["street", "streetTunnel", getCss("--road"), clamp(s * 6, 0.5, 2.5), 0.35, true],
    ["street", "street", getCss("--street"), clamp(s * 6, 0.5, 2.5), 1, false],
    ["street", "road", getCss("--road"), clamp(s * 10, 0.8, 4), lineMode ? 0.6 : 0.9, false],
    ["rail", "railTunnel", getCss("--rail"), clamp(s * 8, 1.1, 3.5), 0.4, true],
    ["rail", "rail", getCss("--rail"), clamp(s * 8, 1.1, 3.5), lineMode ? 0.55 : 1, false],
  ];
  ctx.save();
  setWorldTransform();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [key, layer, color, px, alpha, dashed] of layers) {
    if (!SET.layers[key]) continue;
    ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = px / s;
    ctx.setLineDash(dashed ? [5 / s, 4 / s] : []);
    for (const tl of tiles) if (tl.has[layer]) ctx.stroke(tl[layer]);
  }
  ctx.restore();
}

// Polylines of a line in world coordinates: the route from the mod when known, else straight between stops.
function linePolylines(L) {
  const P = S.paths && S.paths[String(L.id)];
  const out = [];
  // ships (and anything the game could not route): the course recorded from a vehicle of the line
  const tr = S.trails && S.trails[String(L.id)];
  if (tr && tr.done && tr.pts && !AIR_CATS.includes(lineCat(L))) {
    const pl = tr.pts.split(" ").map(p => p.split(",").map(Number));
    if (pl.length >= 2) return [pl];
  }
  if (P && P.segs && P.segs.some(sg => sg)) {
    // skip a segment that only retraces an earlier one backwards (A->B then B->A):
    // drawn twice, a dashed line would look solid
    const seen = new Set();
    for (const sg of P.segs) {
      if (!sg) continue;
      const pl = sg.split(" ").map(p => p.split(",").map(Number));
      const a = pl[0], b = pl[pl.length - 1];
      const fwd = `${a}|${b}|${pl.length}`, back = `${b}|${a}|${pl.length}`;
      if (seen.has(back)) continue;
      seen.add(fwd);
      out.push(pl);
    }
    return out;
  }
  const pts = (L.stops || []).map(stationPosOfStop).filter(Boolean);
  if (pts.length >= 3) out.push([...pts, pts[0]]);
  else if (pts.length === 2) out.push(pts);
  return out;
}
function linePath(L) {
  let p = S.linePaths.get(L.id);
  if (!p) {
    p = new Path2D();
    for (const pl of linePolylines(L)) {
      pl.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y));
    }
    S.linePaths.set(L.id, p);
  }
  return p;
}

function drawLines() {
  if (!SET.layers.lines || !S.lines.length) return;
  const s = S.view.scale;
  const sel = S.sel && S.sel.kind === "line" ? S.sel.id : null;
  const hl = selectedLineSet();
  ctx.save();
  setWorldTransform();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const base = clamp(s * 14, 2.2, 5);
  for (const L of S.lines) {
    if (!lineVisible(L)) continue;
    const air = AIR_CATS.includes(lineCat(L));
    const dim = hl && !hl.has(L.id);
    ctx.globalAlpha = dim ? 0.25 : 1;
    ctx.setLineDash(air ? [10 / s, 7 / s] : []);
    if (L.id === sel) {
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = (base + 4) / s; ctx.stroke(linePath(L));
    } else if (!air) {
      // thin dark casing keeps light line colours readable on the terrain
      ctx.strokeStyle = "rgba(15,23,32,0.45)"; ctx.lineWidth = (base + 2) / s; ctx.stroke(linePath(L));
    }
    ctx.strokeStyle = lineColor(L);
    ctx.lineWidth = (L.id === sel ? base + 1.5 : base) / s;
    ctx.stroke(linePath(L));
  }
  ctx.restore();
}
// Lines to highlight for the current selection (station or town or line), else null.
function selectedLineSet() {
  if (!S.sel) return null;
  if (S.sel.kind === "line") return new Set([S.sel.id]);
  if (S.sel.kind === "station") return new Set(S.lines.filter(L => (L.stops || []).some(s => s[0] === S.sel.id)).map(L => L.id));
  return null;
}

function drawCatchment() {
  const selG = S.sel && S.sel.kind === "station" ? S.groupById.get(S.sel.id) : null;
  if (!SET.layers.catchment && !selG) return;
  const s = S.view.scale;
  ctx.save();
  setWorldTransform();
  const groups = SET.layers.catchment ? S.groups : [selG];
  for (const g of groups) {
    const strong = g === selG;
    for (const st of g.st) for (const ca of st.ca || []) {
      ctx.beginPath(); ctx.arc(ca[0], ca[1], ca[2], 0, Math.PI * 2);
      ctx.fillStyle = strong ? "rgba(255,204,77,0.14)" : "rgba(255,204,77,0.05)"; ctx.fill();
      ctx.strokeStyle = strong ? "rgba(255,204,77,0.8)" : "rgba(255,204,77,0.25)"; ctx.lineWidth = (strong ? 2 : 1) / s; ctx.stroke();
    }
  }
  ctx.restore();
}

function stationVisible(g) {
  if (!SET.layers.stations || g.x == null) return false;
  const ls = S.lines.filter(L => (L.stops || []).some(s => s[0] === g.id));
  // in chain mode a station with no lines only shows at an industry of the chain
  if (!ls.length) return !SET.chain || chainStations().has(g.id);
  return ls.some(lineVisible);
}
// Chain mode: stations next to a shown industry (an industry's own station sits right beside it).
const CHAIN_STATION_DIST = 800;
let chainStationsCache = null;
function chainStations() {
  const key = [SET.chain && SET.chain.kind, [...SET.hiddenKinds].join(","), SET.layers.industries].join("|");
  const c = chainStationsCache;
  if (c && c.key === key && c.groups === S.groups && c.inds === S.industries) return c.set;
  const set = new Set();
  const inds = SET.layers.industries ? S.industries.filter(i => i.x != null && !SET.hiddenKinds.has(i.kind)) : [];
  for (const g of S.groups) {
    if (g.x == null) continue;
    if (inds.some(i => Math.abs(i.x - g.x) < CHAIN_STATION_DIST && Math.abs(i.y - g.y) < CHAIN_STATION_DIST && Math.hypot(i.x - g.x, i.y - g.y) < CHAIN_STATION_DIST)) set.add(g.id);
  }
  chainStationsCache = { key, groups: S.groups, inds: S.industries, set };
  return set;
}
// Chain mode: a town matters if it needs the chain's cargo; the rest are drawn small and quiet.
function townInChain(tw) {
  if (!SET.chain) return true;
  const d = S.townData.get(tw.id), cs = chainCargo();
  return !!(d && (d.needs || []).some(n => cs.has(n[0])));
}

// Round (or, for cargo-only places, square) badge with a transport icon inside.
function drawBadge(x, y, r, cat, fill, ink, ring, ringW, square) {
  if (square) roundRect(x - r, y - r, 2 * r, 2 * r, r * 0.35);
  else { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
  ctx.fillStyle = fill; ctx.fill();
  if (ring) { ctx.lineWidth = ringW || 1.5; ctx.strokeStyle = ring; ctx.stroke(); }
  if (cat && MODE_ICONS[cat] && r >= 5.5) {
    const k = (r * 1.35) / 24;
    ctx.save();
    ctx.translate(x - 12 * k, y - 12 * k); ctx.scale(k, k);
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2.1, 1.25 / k); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke(iconPath2D(cat));
    ctx.restore();
  }
}

function drawStations(placed) {
  if (!SET.layers.stations) return;
  const big = S.view.scale > 0.03;
  const r = big ? clamp(S.view.scale * 90, 7, 9) : clamp(S.view.scale * 60, 3, 6.5);
  const showLabels = S.view.scale > 0.05;
  const drawn = [];
  for (const g of S.groups) {
    if (!stationVisible(g)) continue;
    const [x, y] = toScreen(g.x, g.y);
    if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
    const sel = S.sel && S.sel.kind === "station" && S.sel.id === g.id;
    const cargoOnly = g.st.some(s => s.cargo) && !g.st.some(s => s.pass);
    const rr = sel ? r + 2 : r;
    if (big) drawBadge(x, y, rr, stationCat(g), "#ffffff", "#0f1720", sel ? getCss("--accent") : "#0f1720", sel ? 2.5 : 1.8, cargoOnly);
    else {
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff"; ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = sel ? getCss("--accent") : "#0f1720"; ctx.stroke();
      if (cargoOnly) { ctx.fillStyle = "#0f1720"; ctx.fillRect(x - r * 0.45, y - r * 0.45, r * 0.9, r * 0.9); }
    }
    placed.push({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
    drawn.push([g, x, y]);
  }
  if (showLabels) for (const [g, x, y] of drawn) label(g.name, x + r + 4, y, 11, "500", "#eef2f5", placed);
}

function drawVehicles() {
  if (!SET.layers.vehicles || !S.vehicles.length) return;
  const vis = [];
  for (const v of S.vehicles) {
    const L = S.lineById.get(v.line);
    if (L && !lineVisible(L)) continue;
    const [x, y] = toScreen(v.x, v.y);
    if (x < -12 || y < -12 || x > W + 12 || y > H + 12) continue;
    vis.push([v, L, x, y]);
  }
  // icons when there is room for them, plain dots when the view is crowded
  const big = vis.length <= 80 || S.view.scale > 0.05;
  const r = big ? clamp(S.view.scale * 75, 6.5, 9) : clamp(S.view.scale * 40, 2.5, 4.5);
  const selId = S.sel && S.sel.kind === "vehicle" ? S.sel.id : null;
  for (const [v, L, x, y] of vis) {
    const rgb = L ? lineRgb(L) : [127, 209, 255];
    const fill = `rgb(${rgb.map(Math.round).join(",")})`;
    if (big) drawBadge(x, y, v.id === selId ? r + 2 : r, L ? lineCat(L) : null, fill, inkOn(rgb), v.id === selId ? getCss("--accent") : "#ffffff", v.id === selId ? 2.5 : 1.5);
    else {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = 1.3; ctx.strokeStyle = "#ffffff"; ctx.stroke();
    }
  }
}

// ---- line tags: a pill with the transport icon and the line name, placed on the line itself.
// They show that lines can be tapped and are tap targets of their own.
function lineAnchors(L) {
  let a = S.lineAnchors.get(L.id);
  if (a) return a;
  a = [];
  const pls = linePolylines(L);
  let total = 0;
  const segs = [];
  for (const pl of pls) for (let i = 1; i < pl.length; i++) {
    const d = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
    segs.push([pl[i - 1], pl[i], total, d]); total += d;
  }
  if (total > 0) {
    for (const f of [0.5, 0.3, 0.7, 0.15, 0.85, 0.4, 0.6]) {
      const want = total * f;
      const sg = segs.find(s => s[2] + s[3] >= want) || segs[segs.length - 1];
      const k = sg[3] ? (want - sg[2]) / sg[3] : 0;
      a.push([sg[0][0] + (sg[1][0] - sg[0][0]) * k, sg[0][1] + (sg[1][1] - sg[0][1]) * k]);
    }
  }
  S.lineAnchors.set(L.id, a);
  return a;
}
function shortName(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function drawLineTags(placed) {
  S.tagHits = [];
  if (!SET.layers.lines || !SET.lineTags || !S.lines.length) return;
  const vis = S.lines.filter(lineVisible);
  if (S.view.scale < 0.02 && vis.length > 15) return;
  const hl = selectedLineSet();
  const order = hl ? [...vis.filter(L => hl.has(L.id)), ...vis.filter(L => !hl.has(L.id))] : vis;
  ctx.font = `600 11px -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans", sans-serif`;
  const h = 18, top = 70, bottom = H - 70;
  for (const L of order) {
    const name = shortName(L.name, 18);
    const w = 6 + 13 + 4 + ctx.measureText(name).width + 7;
    for (const [wx, wy] of lineAnchors(L)) {
      const [x, y] = toScreen(wx, wy);
      const box = { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
      if (box.x0 < 4 || box.x1 > W - 4 || box.y0 < top || box.y1 > bottom) continue;
      if (placed.some(p => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
      placed.push(box);
      const rgb = lineRgb(L), ink = inkOn(rgb);
      ctx.globalAlpha = hl && !hl.has(L.id) ? 0.35 : 1;
      roundRect(box.x0, box.y0, w, h, h / 2);
      ctx.fillStyle = `rgb(${rgb.map(Math.round).join(",")})`; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(15,23,32,0.75)"; ctx.stroke();
      const k = 13 / 24;
      ctx.save(); ctx.translate(box.x0 + 6, y - 6.5); ctx.scale(k, k);
      ctx.strokeStyle = ink; ctx.lineWidth = 2.3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(iconPath2D(lineCat(L)));
      ctx.restore();
      ctx.fillStyle = ink; ctx.textBaseline = "middle"; ctx.fillText(name, box.x0 + 6 + 13 + 4, y + 0.5);
      ctx.globalAlpha = 1;
      S.tagHits.push({ ...box, L });
      break;
    }
  }
}

function townPopulation(id) {
  const d = S.townData.get(id);
  if (!d || !d.cap || !d.cap[0]) return null;
  return d.cap[0][0];
}

function drawTowns(placed) {
  if (!SET.layers.towns) return;
  const towns = [...S.towns].sort((a, b) => (b.size || 0) - (a.size || 0));
  const drawn = [];
  for (const tw of towns) {
    const [x, y] = toScreen(tw.x, tw.y);
    if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
    if (!townInChain(tw) && !(S.sel && S.sel.kind === "town" && S.sel.id === tw.id)) {
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(235,240,245,0.45)"; ctx.fill();
      continue;   // no name, no population, no collision box
    }
    const r = Math.max(4, Math.min(11, Math.sqrt(tw.size || 100) * 0.32)) * Math.min(1.6, Math.max(0.8, S.view.scale * 60));
    const sel = S.sel && S.sel.kind === "town" && S.sel.id === tw.id;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = getCss("--town"); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = sel ? getCss("--accent") : "rgba(15,23,32,0.9)"; ctx.stroke();
    placed.push({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
    drawn.push([tw, x, y, r]);
  }
  for (const [tw, x, y, r] of drawn) {
    let lx = x + r + 5, right = false;
    let ok = label(tw.name, lx, y, 12.5, "600", getCss("--text"), placed);
    if (!ok) { ok = label(tw.name, x - r - 5, y, 12.5, "600", getCss("--text"), placed, true); right = true; }
    if (!ok) continue;
    let yy = y + 16;   // the name's box reaches 8 px below y, the next label's 7 px above its centre
    if (SET.showPop) {
      const pop = townPopulation(tw.id);
      if (pop != null && label("👤 " + fmtInt(pop), right ? x - r - 5 : lx, yy, 10.5, "500", "#d3dbe2", placed, right)) yy += 15;
    }
    if (SET.showNeeds) {
      const d = S.townData.get(tw.id);
      const needs = d && d.needs ? d.needs.map(n => n[0]) : [];
      let ix = right ? x - r - 5 - needs.length * 17 : lx;
      for (const cid of needs) {
        const ic = cargoIcon(cid);
        if (ic.ok) ctx.drawImage(ic.img, ix, yy - 7, 15, 15);
        else { ctx.beginPath(); ctx.arc(ix + 7, yy, 6, 0, Math.PI * 2); ctx.fillStyle = cargoColor(cid); ctx.fill(); }
        ix += 17;
      }
    }
  }
}

// Size of the industry location marker. Industries share their spot with their own cargo station,
// so with stations shown the marker becomes a colored plate behind the station badge.
function industryMarkSize() {
  const s = Math.max(9, Math.min(14, S.view.scale * 170));
  if (!SET.layers.stations) return s;
  const big = S.view.scale > 0.03;
  const r = big ? clamp(S.view.scale * 90, 7, 9) : clamp(S.view.scale * 60, 3, 6.5);
  return Math.max(s, 2 * r + (big ? 10 : 6));
}
function drawIndustries(placed) {
  if (!SET.layers.industries || !S.industries.length) return;
  const s = industryMarkSize();
  for (const i of S.industries) {
    if (SET.hiddenKinds.has(i.kind)) continue;
    const [x, y] = toScreen(i.x, i.y);
    if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
    const sel = S.sel && S.sel.kind === i.kind && S.sel.id === i.id;
    ctx.fillStyle = kindColor(i.kind);
    roundRect(x - s / 2, y - s / 2, s, s, 2); ctx.fill();
    ctx.strokeStyle = sel ? getCss("--accent") : "rgba(255,255,255,0.9)"; ctx.lineWidth = sel ? 3 : 1.5; ctx.stroke();
  }
  // collision box: only the core, so the station badge on top can still place its name beside it
  const k = Math.max(9, Math.min(14, S.view.scale * 170)) / 2;
  for (const i of S.industries) {
    if (SET.hiddenKinds.has(i.kind)) continue;
    const [x, y] = toScreen(i.x, i.y);
    if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
    placed.push({ x0: x - k, y0: y - k, x1: x + k, y1: y + k });
  }
}

// Next to each industry dot: what it accepts → what it produces, as cargo icons on a dark pill,
// and the name under it when zoomed in. Drawn after towns and stations so their names win.
function drawIndustryTags(placed) {
  S.indTagHits = [];
  if (!SET.layers.industries || !S.industries.length) return;
  const vis = [];
  for (const i of S.industries) {
    if (SET.hiddenKinds.has(i.kind)) continue;
    const [x, y] = toScreen(i.x, i.y);
    if (x < 0 || y < 60 || x > W || y > H - 60) continue;
    vis.push([i, x, y]);
  }
  if (S.view.scale < 0.02 && vis.length > 40) return;
  const s = industryMarkSize();
  // the industry's own station usually carries the same name - don't print it twice
  const stationNames = SET.layers.stations && S.view.scale > 0.05 ? new Set(S.groups.filter(stationVisible).map(g => g.name)) : null;
  const isz = 15, gap = 2, padX = 4, h = isz + 6;
  for (const [i, x, y] of vis) {
    const io = industryCargo(i);
    let tagBox = null;
    if (io && ((io.inp || []).length || (io.out || []).length)) {
      const inp = io.inp || [], out = io.out || [];
      const arrowW = inp.length && out.length ? 9 : 0;
      const w = padX * 2 + (inp.length + out.length) * (isz + gap) - gap + arrowW + (arrowW ? gap : 0);
      for (const side of [1, -1]) {
        const x0 = side > 0 ? x + s / 2 + 4 : x - s / 2 - 4 - w;
        const box = { x0, y0: y - h / 2, x1: x0 + w, y1: y + h / 2 };
        if (placed.some(p => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
        placed.push(box); tagBox = box; S.indTagHits.push({ ...box, i });
        roundRect(box.x0, box.y0, w, h, 6);
        ctx.fillStyle = "rgba(15,23,32,0.82)"; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = kindColor(i.kind); ctx.stroke();
        let cx = box.x0 + padX;
        for (const id of inp) { drawCargoIcon(id, cx, y - isz / 2, isz); cx += isz + gap; }
        if (arrowW) {
          ctx.beginPath(); ctx.moveTo(cx + 1, y); ctx.lineTo(cx + arrowW - 2, y);
          ctx.moveTo(cx + arrowW - 5, y - 3); ctx.lineTo(cx + arrowW - 2, y); ctx.lineTo(cx + arrowW - 5, y + 3);
          ctx.strokeStyle = "#e8edf2"; ctx.lineWidth = 1.5; ctx.lineCap = "round"; ctx.stroke();
          cx += arrowW + gap;
        }
        for (const id of out) { drawCargoIcon(id, cx, y - isz / 2, isz); cx += isz + gap; }
        break;
      }
    }
    if (S.view.scale > 0.09 && i.name && !(stationNames && stationNames.has(i.name))) {
      if (tagBox) label(i.name, tagBox.x0, tagBox.y1 + 8, 11, "500", "#d3dbe2", placed);
      else label(i.name, x + s / 2 + 4, y, 11, "500", "#d3dbe2", placed);
    }
  }
}

// position of any entity the flows may mention
function entityPos(id) {
  const i = S.industries.find(x => x.id === id); if (i) return [i.x, i.y];
  const tw = S.towns.find(x => x.id === id); if (tw) return [tw.x, tw.y];
  const g = S.groupById.get(id); if (g && g.x != null) return [g.x, g.y];
  return null;
}
function entityName(id) {
  const i = S.industries.find(x => x.id === id); if (i) return i.name;
  const tw = S.towns.find(x => x.id === id); if (tw) return tw.name;
  const g = S.groupById.get(id); if (g) return g.name;
  const L = S.lineById.get(id); if (L) return L.name;
  return "#" + id;
}

// Selected industry: thin dotted lines to its nearest possible partners (existing deliveries get drawFlows' arrows).
function drawChain() {
  if (!S.sel || S.sel.cardKind !== "industry") return;
  const ind = S.industries.find(x => x.id === S.sel.id);
  const cp = ind && chainPartners(ind);
  if (!cp) return;
  const [x0, y0] = toScreen(ind.x, ind.y);
  const seen = new Set();
  ctx.save();
  ctx.lineWidth = 1.5; ctx.setLineDash([2, 4]); ctx.lineCap = "round";
  for (const { cid, list } of [...cp.out, ...cp.inp]) {
    for (const p of chainShown(list)) {
      if (p.linked || !partnerVisible(p)) continue;
      const [x1, y1] = toScreen(p.o.x, p.o.y);
      ctx.strokeStyle = cargoColor(cid); ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      if (seen.has(p.o.id)) continue;
      seen.add(p.o.id);
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x1, y1, p.town ? 14 : 11, 0, Math.PI * 2); ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.lineWidth = 1.5; ctx.setLineDash([2, 4]);
    }
  }
  ctx.restore();
}

function drawFlows() {
  const f = S.flows;
  if (!f || f.pending || !S.sel || f.entity !== S.sel.id) return;
  const from = entityPos(f.entity);
  if (!from) return;
  const arrow = (a, b, color) => {
    const [x0, y0] = toScreen(a[0], a[1]), [x1, y1] = toScreen(b[0], b[1]);
    const mx = (x0 + x1) / 2 - (y1 - y0) * 0.15, my = (y0 + y1) / 2 + (x1 - x0) * 0.15;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1);
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.stroke(); ctx.setLineDash([]);
    const ang = Math.atan2(y1 - my, x1 - mx);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 10 * Math.cos(ang - 0.4), y1 - 10 * Math.sin(ang - 0.4));
    ctx.lineTo(x1 - 10 * Math.cos(ang + 0.4), y1 - 10 * Math.sin(ang + 0.4)); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  };
  for (const [to, cid] of f.out || []) { const p = entityPos(to); if (p) arrow(from, p, cargoColor(cid)); }
  for (const [src, cid] of f.inn || []) { const p = entityPos(src); if (p) arrow(p, from, cargoColor(cid)); }
  for (const id of f.catchIndustries || []) {
    const p = entityPos(id);
    if (!p) continue;
    const [x, y] = toScreen(p[0], p[1]);
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.strokeStyle = getCss("--accent"); ctx.lineWidth = 2; ctx.stroke();
  }
}

function render() {
  frameQueued = false;
  if (SET.follow) { const c = camNow(); if (c && c.x != null) { S.view.cx = c.x; S.view.cy = c.y; } }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = getCss("--bg");
  ctx.fillRect(0, 0, W, H);
  if (!S.bounds) return;

  const style = mapStyle();
  ctx.fillStyle = `rgb(${style.flatLand.join(",")})`;
  mapOutline(); ctx.fill();
  ctx.strokeStyle = style.edge; ctx.lineWidth = 1; ctx.stroke();

  if (S.grids.terrain) {
    const key = `${SET.layers.terrain}|${SET.layers.biomes}|${SET.mapStyle}`;
    if (!S.rasters.base || S.rasters.baseKey !== key) { S.rasters.base = buildBaseRaster(); S.rasters.baseKey = key; }
    drawRaster(S.rasters.base, true);
  }
  for (const k of ["noise", "pollution"]) {
    if (!SET.layers[k] || !S.grids[k]) continue;
    if (!S.rasters[k]) S.rasters[k] = buildHeatRaster(k);
    drawRaster(S.rasters[k], true);
  }

  const step = niceStep(1 / S.view.scale);
  const vr = visibleWorldRect();
  ctx.save();
  mapOutline(); ctx.clip();
  ctx.lineWidth = 1;
  const gl = (a, b) => { ctx.beginPath(); ctx.moveTo(Math.round(a[0]) + 0.5, Math.round(a[1]) + 0.5); ctx.lineTo(Math.round(b[0]) + 0.5, Math.round(b[1]) + 0.5); ctx.stroke(); };
  for (let x = Math.ceil(vr.x0 / step) * step; x <= vr.x1; x += step) {
    ctx.strokeStyle = Math.round(x / step) % 5 === 0 ? style.gridMajor : style.grid;
    gl(toScreen(x, vr.y0), toScreen(x, vr.y1));
  }
  for (let y = Math.ceil(vr.y0 / step) * step; y <= vr.y1; y += step) {
    ctx.strokeStyle = Math.round(y / step) % 5 === 0 ? style.gridMajor : style.grid;
    gl(toScreen(vr.x0, y), toScreen(vr.x1, y));
  }
  ctx.restore();

  drawNet(vr);
  drawCatchment();
  drawLines();
  drawVehicles();   // under the markers and labels, so names stay readable in busy towns
  const placed = [];
  drawIndustries(placed);
  drawStations(placed);
  drawTowns(placed);
  drawIndustryTags(placed);
  drawLineTags(placed);
  drawChain();
  drawFlows();
  drawCamera();
  drawPulses();
  drawScale(step);
  updateCompass();
  updateLegend();
  if (camAnimating()) draw();
}

function label(text, x, y, size, weight, color, placed, alignRight) {
  if (!text) return false;
  ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans", sans-serif`;
  const w = ctx.measureText(text).width;
  const left = alignRight ? x - w : x;
  const box = { x0: left - 2, y0: y - size / 2 - 2, x1: left + w + 2, y1: y + size / 2 + 2 };
  for (const p of placed) if (box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0) return false;
  placed.push(box);
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3; ctx.strokeStyle = "rgba(15,23,32,0.85)"; ctx.strokeText(text, left, y);
  ctx.fillStyle = color; ctx.fillText(text, left, y);
  return true;
}

function drawCamera() {
  const c = camNow();
  if (!c || c.x == null) return;
  const [x, y] = toScreen(c.x, c.y);
  const r = Math.max(10, cameraDistance() * 0.75 * S.view.scale);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,204,77,0.10)"; ctx.fill();
  ctx.strokeStyle = "rgba(255,204,77,0.55)"; ctx.lineWidth = 1.5; ctx.stroke();
  if (c.ex != null) {
    const [ax, ay] = toScreen(c.ex, c.ey);
    const a = Math.atan2(y - ay, x - ax);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fillStyle = getCss("--accent"); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(15,23,32,0.9)"; ctx.stroke();
    ctx.restore();
  }
}

function drawPulses() {
  const now = performance.now();
  S.pulses = S.pulses.filter(p => p.state === "pending" || now - p.t0 < 700);
  for (const p of S.pulses) {
    const [x, y] = toScreen(p.x, p.y);
    const k = p.state === "pending" ? ((now - p.t0) % 900) / 900 : (now - p.t0) / 700;
    const color = p.state === "err" ? "240,90,90" : p.state === "ok" ? "76,209,138" : "255,204,77";
    ctx.beginPath(); ctx.arc(x, y, 8 + k * 22, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${color},${1 - k})`; ctx.lineWidth = 2.5; ctx.stroke();
  }
  if (S.pulses.length) draw();
}

function drawScale(step) {
  const px = step * S.view.scale;
  const x = 12, y = H - (getSafeBottom() + 70);
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 4);
  ctx.strokeStyle = "rgba(15,23,32,0.8)"; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = "#e8edf2"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.font = "600 11px -apple-system, sans-serif"; ctx.textBaseline = "bottom";
  const txt = fmtStep(step);
  ctx.lineWidth = 3; ctx.strokeStyle = "rgba(15,23,32,0.85)"; ctx.strokeText(txt, x + 4, y - 4);
  ctx.fillStyle = "#e8edf2"; ctx.fillText(txt, x + 4, y - 4);
}

function updateLegend() {
  const el = document.getElementById("legend");
  const k = ["noise", "pollution"].find(x => SET.layers[x] && S.grids[x]);
  if (!k || (S.sel && document.getElementById("card").classList.contains("open"))) { el.style.display = "none"; return; }
  const stops = HEAT[k].map(c => `rgb(${c.join(",")})`).join(",");
  const html = `${escapeHtml(t("layer." + k))}<div class="grad" style="background:linear-gradient(90deg,${stops})"></div>`
    + `<div class="ends"><span>0</span><span>${(S.grids[k].max || 0).toFixed(1)}</span></div>`;
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  el.style.display = "block";
}

// The map's rectangle as the current path, in screen space, at any rotation.
function mapOutline() {
  const b = S.bounds, w = b.x1 - b.x0, h = b.y1 - b.y0;
  ctx.save(); setWorldTransform();
  roundRect(b.x0, b.y0, w, h, Math.min(10 / S.view.scale, w / 2, h / 2));
  ctx.restore();
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const cssCache = {};
function getCss(name) { return cssCache[name] || (cssCache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim()); }
function getSafeBottom() { return parseFloat(getComputedStyle(document.querySelector(".bottom")).paddingBottom) - 8 || 0; }

// ================================================================ hit testing

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const k = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - k * dx, py - ay - k * dy);
}

function hitTest(sx, sy) {
  for (const tg of S.tagHits) if (sx >= tg.x0 - 3 && sx <= tg.x1 + 3 && sy >= tg.y0 - 3 && sy <= tg.y1 + 3) return tg.L;
  for (const tg of S.indTagHits) if (sx >= tg.x0 - 3 && sx <= tg.x1 + 3 && sy >= tg.y0 - 3 && sy <= tg.y1 + 3) return tg.i;
  let best = null, bestD = 24;
  const consider = (p, bonus) => {
    const [x, y] = toScreen(p.x, p.y);
    const d = Math.hypot(x - sx, y - sy) - (bonus || 0);
    if (d < bestD) { bestD = d; best = p; }
  };
  if (SET.layers.stations) for (const g of S.groups) if (stationVisible(g)) consider(g, 4);
  if (SET.layers.towns) for (const tw of S.towns) consider(tw, 6);
  if (SET.layers.industries) for (const i of S.industries) if (!SET.hiddenKinds.has(i.kind)) consider(i, 0);
  if (SET.layers.vehicles) for (const v of S.vehicles) { const L = S.lineById.get(v.line); if (!L || lineVisible(L)) consider(v, -6); }
  if (best) return best;
  // lines: distance to their polylines on screen
  if (SET.layers.lines) {
    let bl = null, bd = 12;
    for (const L of S.lines) {
      if (!lineVisible(L)) continue;
      for (const pl of linePolylines(L)) {
        let prev = null;
        for (const [x, y] of pl) {
          const p = toScreen(x, y);
          if (prev) { const d = distToSeg(sx, sy, prev[0], prev[1], p[0], p[1]); if (d < bd) { bd = d; bl = L; } }
          prev = p;
        }
      }
    }
    return bl;
  }
  return null;
}

// ================================================================ selection + card

function selKindOf(o) {
  if (o.kind === "town" || o.kind === "station" || o.kind === "line" || o.kind === "vehicle") return o.kind;
  return "industry";
}
function select(o, jump) {
  if (!o) { S.sel = null; renderCard(); draw(); return; }
  const kind = selKindOf(o);
  if (!S.sel || S.sel.id !== o.id) S.cardMore = false;
  S.sel = { kind: kind === "industry" ? o.kind : kind, cardKind: kind, id: o.id };
  if (kind === "town" || kind === "industry" || kind === "station") requestFlows(kind, o.id);
  else S.flows = null;
  if (jump && o.x != null && kind !== "line") {
    if (kind === "vehicle") command({ action: "focus", entity: o.id }, o);
    else jumpTo(o);
  }
  renderCard();
  draw();
}

// getMaxFrequency gives departures per second (0.01 = every 100 s); 0 means no timetable data yet.
// Values of 1 and more can only be seconds (older fake data), so they are shown as they are.
function lineInterval(L) { const f = +L.freq; return !f || f <= 0 ? null : f < 1 ? 1 / f : f; }
function stat(k, v, small) { return `<div class="stat"><div class="k">${escapeHtml(k)}</div><div class="v">${v}${small ? ` <small>${escapeHtml(small)}</small>` : ""}</div></div>`; }
function linesRows(ids) {
  return ids.map(id => S.lineById.get(id)).filter(Boolean).map(L =>
    `<div class="r link" data-line="${L.id}"><span class="sw line" style="background:${lineColor(L)}"></span><span class="grow">${escapeHtml(L.name)}</span>`
    + `<span class="num">${iconSvg(lineCat(L))}</span></div>`).join("");
}
function flowRows(list, dirOut) {
  return list.map(([ent, cid, n]) => `<div class="r">${iconHtml(cid)}<span class="grow">${escapeHtml(entityName(ent))}</span>`
    + `<span class="num">${n != null ? fmtInt(n) + t("card.perYear") : ""}</span></div>`).join("");
}
function flowsSection() {
  const f = S.flows;
  if (!f || f.entity !== S.sel.id) return "";
  if (f.pending) return `<div class="sec">${escapeHtml(t("card.flowsIn"))}</div><div class="rows"><div class="r"><span class="num">${escapeHtml(t("card.loading"))}</span></div></div>`;
  let h = "";
  if ((f.inn || []).length) h += `<div class="sec">${escapeHtml(t("card.flowsIn"))}</div><div class="rows">${flowRows(f.inn)}</div>`;
  if ((f.out || []).length) h += `<div class="sec">${escapeHtml(t("card.flowsOut"))}</div><div class="rows">${flowRows(f.out, true)}</div>`;
  if (!h && S.sel.cardKind === "town") h = `<div class="sec">${escapeHtml(t("card.flowsIn"))}</div><div class="rows"><div class="r"><span class="num">${escapeHtml(t("card.noData"))}</span></div></div>`;
  return h;
}

// Nearest possible partners of an industry, per cargo: receivers of what it makes, suppliers of what it needs.
function chainSection(ind) {
  const cp = chainPartners(ind);
  if (!cp || (!cp.out.length && !cp.inp.length)) return "";
  const rows = groups => groups.map(({ cid, list }) => {
    if (!list.length) return `<div class="r idle">${iconHtml(cid)}<span class="grow">${escapeHtml(cargoName(cid))}</span><span class="num">${escapeHtml(t("card.nonePartner"))}</span></div>`;
    const shown = chainShown(list);
    return shown.map(p => `<div class="r link" data-${p.town ? "town" : "industry"}="${p.o.id}" data-center="1">${iconHtml(cid)}`
      + `<span class="grow">${p.linked ? "✓ " : ""}${escapeHtml(p.o.name || "#" + p.o.id)}</span><span class="num">${fmtLen(p.d)}</span></div>`).join("")
      + (list.length > shown.length ? `<div class="r more"><span class="grow">${escapeHtml(t("card.morePartners").replace("{n}", list.length - shown.length))}</span></div>` : "");
  }).join("");
  let h = "";
  if (cp.out.length) h += `<div class="sec">${escapeHtml(t("card.receivers"))}</div><div class="rows">${rows(cp.out)}</div>`;
  if (cp.inp.length) h += `<div class="sec">${escapeHtml(t("card.suppliers"))}</div><div class="rows">${rows(cp.inp)}</div>`;
  return h + `<div class="hint">${escapeHtml(t("card.chainHint"))}</div>`;
}

function renderCard() {
  const el = document.getElementById("card");
  const sel = S.sel;
  if (!sel) { el.classList.remove("open"); el.innerHTML = ""; return; }
  let kindLabelTxt = "", kindIcon = "", title = "", body = "", acts = "";
  const showBtn = `<button class="btn primary" data-act="show">${escapeHtml(t("btn.showInGame"))}</button>`;
  if (sel.cardKind === "town") {
    const tw = S.towns.find(x => x.id === sel.id); if (!tw) return select(null);
    const d = S.townData.get(tw.id) || {};
    kindLabelTxt = t("card.town"); title = tw.name;
    const cap = d.cap || [];
    body += `<div class="stats">${stat(t("card.population"), fmtInt(cap[0] ? cap[0][0] : tw.size))}`
      + (cap[1] ? stat(t("card.commercial"), fmtInt(cap[1][0]), "/ " + fmtInt(cap[1][1])) : "")
      + (cap[2] ? stat(t("card.industrial"), fmtInt(cap[2][0]), "/ " + fmtInt(cap[2][1])) : "") + `</div>`;
    if (d.needs && d.needs.length) {
      const stock = new Map((d.stock || []).map(s => [s[0], s]));
      body += `<div class="sec">${escapeHtml(t("card.needs"))}</div><div class="needs">`
        + d.needs.map(([cid]) => { const s = stock.get(cid); return `<span>${iconHtml(cid)}${escapeHtml(cargoName(cid))}${s ? ` <b style="color:var(--muted);font-weight:500">${s[1]}/${s[2]}</b>` : ""}</span>`; }).join("") + `</div>`;
    }
    body += flowsSection();
    const fl = S.flows && S.flows.entity === sel.id ? (S.flows.lines || []) : [];
    if (fl.length) body += `<div class="sec">${escapeHtml(t("card.lines"))}</div><div class="rows">${linesRows(fl)}</div>`;
    acts = showBtn;
  } else if (sel.cardKind === "industry") {
    const ind = S.industries.find(x => x.id === sel.id); if (!ind) return select(null);
    kindLabelTxt = t("card.industry") + " · " + kindLabel(ind.kind); title = ind.name;
    const io = industryCargo(ind);
    if (io) body += `<div class="needs">${cargoFlowHtml(io)}</div>`;
    const f = S.flows && S.flows.entity === sel.id && !S.flows.pending ? S.flows : null;
    if (f && ((f.produced || []).length || (f.consumed || []).length)) {
      if ((f.produced || []).length) body += `<div class="sec">${escapeHtml(t("card.produces"))}</div><div class="rows">`
        + f.produced.map(([cid, n]) => `<div class="r">${iconHtml(cid)}<span class="grow">${escapeHtml(cargoName(cid))}</span><span class="num">${fmtInt(n)}${t("card.perYear")}</span></div>`).join("") + `</div>`;
      if ((f.consumed || []).length) body += `<div class="sec">${escapeHtml(t("card.consumes"))}</div><div class="rows">`
        + f.consumed.map(([cid, n]) => `<div class="r">${iconHtml(cid)}<span class="grow">${escapeHtml(cargoName(cid))}</span><span class="num">${fmtInt(n)}${t("card.perYear")}</span></div>`).join("") + `</div>`;
    } else if (ind.level) body += `<div class="stats">${stat("Level", ind.level)}</div>`;
    body += flowsSection();
    body += chainSection(ind);
    acts = (SET.chain && SET.chain.kind === ind.kind
      ? `<button class="btn" data-act="unchain">${escapeHtml(t("btn.unchain"))}</button>`
      : `<button class="btn" data-act="chain">${escapeHtml(t("btn.chain"))}</button>`) + showBtn;
  } else if (sel.cardKind === "station") {
    const g = S.groupById.get(sel.id); if (!g) return select(null);
    kindLabelTxt = t("card.station"); kindIcon = iconSvg(stationCat(g)); title = g.name;
    const radius = Math.max(0, ...g.st.flatMap(s => (s.ca || []).map(c => c[2])));
    const kinds = [g.st.some(s => s.pass) ? t("pass") : null, g.st.some(s => s.cargo) ? t("cargo") : null].filter(Boolean).join(" · ");
    body += `<div class="stats">${radius ? stat(t("card.radius"), fmtLen(radius)) : ""}${kinds ? stat(kinds, (g.carriers || []).map(c => c.toLowerCase()).join(", ") || "—") : ""}</div>`;
    const lids = S.lines.filter(L => (L.stops || []).some(s => s[0] === g.id)).map(L => L.id);
    if (lids.length) body += `<div class="sec">${escapeHtml(t("card.lines"))}</div><div class="rows">${linesRows(lids)}</div>`;
    const f = S.flows && S.flows.entity === sel.id && !S.flows.pending ? S.flows : null;
    if (f && (f.catchIndustries || []).length) body += `<div class="sec">${escapeHtml(t("card.catchment"))}</div><div class="rows">`
      + f.catchIndustries.map(id => `<div class="r tap" data-industry="${id}"><span class="sw" style="background:${kindColor((S.industries.find(i => i.id === id) || {}).kind || "other")}"></span><span class="grow">${escapeHtml(entityName(id))}</span></div>`).join("") + `</div>`;
    acts = showBtn;
  } else if (sel.cardKind === "line") {
    const L = S.lineById.get(sel.id); if (!L) return select(null);
    const cat = lineCat(L);
    kindLabelTxt = `${t("mode." + cat)} · ${[lineIsPass(L) ? t("pass") : null, lineIsCargo(L) ? t("cargo") : null].filter(Boolean).join(" + ")}`;
    kindIcon = iconSvg(cat);
    title = `<span class="sw line" style="background:${lineColor(L)};width:18px;height:6px;margin-right:6px;vertical-align:middle"></span>${escapeHtml(L.name)}`;
    const P = S.paths && S.paths[String(L.id)];
    const lenKind = P ? (P.fail ? t("card.lengthStraight") : t("card.lengthPath")) : null;
    body += `<div class="stats">`
      + (P && P.len ? stat(t("card.length"), fmtLen(P.len), lenKind) : "")
      + stat(t("card.stops"), (L.stops || []).length)
      + stat(t("card.vehicles"), L.nVeh != null ? L.nVeh : "—")
      + (lineInterval(L) ? stat(t("card.interval"), fmtDur(lineInterval(L))) : "")
      + (L.thr ? stat(t("card.throughput"), fmtInt(L.thr), t("card.perYear")) : "")
      + (L.issues ? stat(t("card.problems"), L.issues) : "")
      + `</div>`;
    // what the vehicles carry right now; the other cargo they could load stays folded away
    const use = L.use || [];
    if (use.length) {
      const row = ([cid, used, cap], idle) => `<div class="r${idle ? " idle" : ""}">${iconHtml(cid)}<span class="grow">${escapeHtml(cargoName(cid))}</span>`
        + (idle ? `<span class="num">${fmtInt(cap)}</span>`
          : `<span class="bar-mini"><i style="width:${cap ? Math.min(100, Math.round(used / cap * 100)) : 0}%"></i></span><span class="num">${fmtInt(used)}/${fmtInt(cap)}</span>`) + `</div>`;
      const active = use.filter(u => u[1] > 0).sort((a, b) => b[1] - a[1]), idle = use.filter(u => u[1] <= 0);
      body += `<div class="sec">${escapeHtml(t("card.carrying"))}</div><div class="rows">`
        + (active.length ? active.map(u => row(u)).join("") : `<div class="r"><span class="num">${escapeHtml(t("card.emptyNow"))}</span></div>`);
      if (idle.length) {
        body += `<div class="r link more" data-act="more"><span class="grow">${escapeHtml(t("card.canCarry"))} · ${idle.length}</span><span class="num">${S.cardMore ? "▾" : "▸"}</span></div>`;
        if (S.cardMore) body += idle.map(u => row(u, true)).join("");
      }
      body += `</div>`;
    }
    const stops = (L.stops || []).map(s => S.groupById.get(s[0])).filter(Boolean);
    if (stops.length) body += `<div class="sec">${escapeHtml(t("card.stops"))}</div><div class="rows">`
      + stops.map((g, i) => `<div class="r link" data-station="${g.id}"><span class="num">${i + 1}</span><span class="grow">${escapeHtml(g.name)}</span></div>`).join("") + `</div>`;
  } else if (sel.cardKind === "vehicle") {
    const v = S.vehicles.find(x => x.id === sel.id);
    const L = v && S.lineById.get(v.line);
    kindLabelTxt = t("card.vehicle"); kindIcon = L ? iconSvg(lineCat(L)) : ""; title = L ? escapeHtml(L.name) : "#" + sel.id;
    if (L) body += `<div class="rows">${linesRows([L.id])}</div>`;
    acts = `<button class="btn primary" data-act="follow">${escapeHtml(t("btn.followVehicle"))}</button>`;
  }
  const titleHtml = sel.cardKind === "line" || sel.cardKind === "vehicle" ? title : escapeHtml(title);
  el.innerHTML = `<div class="head"><div><div class="kind">${kindIcon}${escapeHtml(kindLabelTxt)}</div><h3>${titleHtml}</h3></div>`
    + `<button class="x" data-act="close" aria-label="close">✕</button></div>${body}${acts ? `<div class="acts">${acts}</div>` : ""}`;
  el.classList.add("open");
}

document.getElementById("card").addEventListener("click", e => {
  const a = e.target.closest("[data-act]");
  if (a) {
    const act = a.dataset.act;
    if (act === "close") return select(null);
    if (act === "show") {
      const o = S.sel.cardKind === "town" ? S.towns.find(x => x.id === S.sel.id)
        : S.sel.cardKind === "station" ? S.groupById.get(S.sel.id) : S.industries.find(x => x.id === S.sel.id);
      if (o) jumpTo(o);
    }
    if (act === "follow") command({ action: "focus", entity: S.sel.id });
    if (act === "unchain") undoChain();
    if (act === "chain") { const i = S.industries.find(x => x.id === S.sel.id); if (i) showChain(i.kind); }
    if (act === "more") { S.cardMore = !S.cardMore; renderCard(); }
    return;
  }
  const lr = e.target.closest("[data-line]");
  if (lr) return select(S.lineById.get(+lr.dataset.line), false);
  const sr = e.target.closest("[data-station]");
  if (sr) { const g = S.groupById.get(+sr.dataset.station); if (g) select(g, true); }
  const ir = e.target.closest("[data-industry]");
  if (ir) { const i = S.industries.find(x => x.id === +ir.dataset.industry); if (i) { if (ir.dataset.center) centerOn(i); select(i, false); } }
  const tr = e.target.closest("[data-town]");
  if (tr) { const tw = S.towns.find(x => x.id === +tr.dataset.town); if (tw) { if (tr.dataset.center) centerOn(tw); select(tw, false); } }
});
// Move the minimap (not the game camera) so the place is on screen; leaves the view alone if it already is.
function centerOn(o) {
  if (o.x == null) return;
  const [x, y] = toScreen(o.x, o.y);
  if (x > 40 && y > 80 && x < W - 40 && y < H - 120) return;
  if (SET.follow) setFollow(false);
  S.view.cx = o.x; S.view.cy = o.y;
}

// ================================================================ gestures

const pointers = new Map();
let gesture = null;

canvas.addEventListener("pointerdown", e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  closeResults();
  if (pointers.size === 1) gesture = { t0: performance.now(), moved: 0, multi: false };
  else if (gesture) gesture.multi = true;
});
canvas.addEventListener("pointermove", e => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;
  const pts = [...pointers.values()];
  if (pointers.size === 1) {
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    panBy(dx, dy);
    if (gesture) gesture.moved += Math.hypot(dx, dy);
  } else if (pointers.size === 2) {
    const other = pts.find(p => p !== prev);
    const before = Math.hypot(prev.x - other.x, prev.y - other.y);
    const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
    const mx = (e.clientX + other.x) / 2, my = (e.clientY + other.y) / 2;
    const pmx = (prev.x + other.x) / 2, pmy = (prev.y + other.y) / 2;
    if (before > 0) zoomAt(mx, my, after / before);
    // twist: starts only after ~11 degrees, so a plain pinch never turns the map
    let da = Math.atan2(e.clientY - other.y, e.clientX - other.x) - Math.atan2(prev.y - other.y, prev.x - other.x);
    if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
    if (gesture) {
      gesture.twist = (gesture.twist || 0) + da;
      if (!gesture.rotating && Math.abs(gesture.twist) > 0.2) { gesture.rotating = true; da = gesture.twist; }
      if (gesture.rotating) rotateAt(mx, my, da);
    }
    panBy(mx - pmx, my - pmy);
  }
  prev.x = e.clientX; prev.y = e.clientY;
  if (gesture && gesture.moved > 8 && SET.follow) setFollow(false);
  draw();
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size === 0 && gesture) {
    const g = gesture; gesture = null;
    if (g.rotating) commitRotation();
    if (!g.multi && g.moved < 10 && performance.now() - g.t0 < 400) onTap(e.clientX, e.clientY);
  }
}
canvas.addEventListener("pointerup", endPointer);
// mouse: show a hand over anything that opens a card
canvas.addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse" || pointers.size) return;
  canvas.style.cursor = S.bounds && hitTest(e.clientX, e.clientY) ? "pointer" : "";
});
canvas.addEventListener("pointercancel", e => {
  pointers.delete(e.pointerId);
  if (gesture && gesture.rotating) commitRotation();
  gesture = null;
});
let wheelTurnT = 0;
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  if (e.shiftKey) {   // Shift + wheel turns the map
    rotateAt(e.clientX, e.clientY, (e.deltaY || e.deltaX) * 0.004);
    clearTimeout(wheelTurnT); wheelTurnT = setTimeout(commitRotation, 350);
  } else zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
  draw();
}, { passive: false });
document.getElementById("compass").onclick = () => setRotation(0);
document.addEventListener("gesturestart", e => e.preventDefault());

function onTap(sx, sy) {
  if (!S.bounds) return;
  const hit = hitTest(sx, sy);
  if (hit) return select(hit, true);
  if (S.sel) select(null);
  const [x, y] = toWorld(sx, sy);
  jumpTo({ x, y });
}

// ================================================================ quick bar + settings

function layerCount(key) {
  switch (key) {
    case "rail": return S.net.counts.rail;
    case "street": return S.net.counts.street;
    case "towns": return S.towns.length;
    case "industries": return S.industries.length;
    case "lines": return S.lines.filter(lineVisible).length || S.lines.length;
    case "stations": return S.groups.length;
    case "vehicles": return S.vehicles.length;
    default: return null;
  }
}
function fmtCount(n) { return n == null ? "" : n >= 10000 ? Math.round(n / 1000) + "k" : n; }
function swatch(L) { return `<span class="sw${L.line ? " line" : L.round ? " round" : ""}" style="background:${L.color}"></span>`; }

function renderQuick() {
  const box = document.getElementById("quick");
  const reset = hiddenFiltersActive()
    ? `<button class="chip pill resetchip" data-reset="1" title="${escapeHtml(t("set.resetAll"))}">↺ ${escapeHtml(t("set.filtersOn"))}</button>` : "";
  const chain = SET.chain
    ? `<button class="chip pill resetchip" data-unchain="1" title="${escapeHtml(t("btn.unchain"))}">${escapeHtml(t("set.chain"))}: ${escapeHtml(kindLabel(SET.chain.kind))} ✕</button>` : "";
  const html = chain + reset + SET.pins.map(key => {
    const L = LAYERS.find(x => x.key === key);
    if (!L) return "";
    const n = layerCount(key);
    return `<button class="chip pill${SET.layers[key] ? "" : " off"}" data-layer="${key}">${swatch(L)}${escapeHtml(t("layer." + key))}`
      + (n ? ` <span class="n">${fmtCount(n)}</span>` : "") + `</button>`;
  }).join("");
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
document.getElementById("quick").addEventListener("click", e => {
  if (e.target.closest("[data-unchain]")) return undoChain();
  if (e.target.closest("[data-reset]")) {
    resetFilters(); saveSettings(); renderQuick(); draw(); toast(t("toast.reset"));
    if (document.getElementById("settings").classList.contains("open")) renderSettings();
    return;
  }
  const b = e.target.closest("[data-layer]");
  if (!b) return;
  toggleLayer(b.dataset.layer);
});
function toggleLayer(key) {
  SET.layers[key] = !SET.layers[key];
  saveSettings();
  renderQuick();
  if (document.getElementById("settings").classList.contains("open")) renderSettings();
  draw();
}

function tog(on, attrs) { return `<button class="toggle${on ? " on" : ""}" ${attrs}></button>`; }

// Section header with bulk buttons on the right.
function secHead(title, acts) {
  return `<div class="sh"><h4>${escapeHtml(title)}</h4>${acts ? `<div class="sa">${acts}</div>` : ""}</div>`;
}
function bulkBtn(action, label, disabled) { return `<button class="lnk" data-bulk="${action}"${disabled ? " disabled" : ""}>${escapeHtml(label)}</button>`; }

function renderSettings() {
  const body = document.getElementById("setBody");
  const keep = body.scrollTop;
  let h = "";
  h += `<h4>${escapeHtml(t("set.language"))}</h4><div class="list"><div class="item"><span class="grow">🌐</span><select id="langSel">`
    + LANG_ORDER.map(l => `<option value="${l}"${l === CUR_LANG ? " selected" : ""}>${escapeHtml(LANGS[l])}</option>`).join("") + `</select></div></div>`;

  const isDef = filtersAreDefault();
  h += `<div class="list resetall"><div class="item"><span class="grow">${escapeHtml(t("set.resetAll"))}<div class="sub">${escapeHtml(t("set.resetHint"))}</div></span>`
    + `<button class="btn${isDef ? "" : " primary"}" data-reset="1"${isDef ? " disabled" : ""}>${escapeHtml(t("set.reset"))}</button></div></div>`;

  const allOn = LAYERS.every(L => SET.layers[L.key]), allOff = LAYERS.every(L => !SET.layers[L.key]);
  h += secHead(t("set.layers"), bulkBtn("layers:all", t("set.all"), allOn) + bulkBtn("layers:none", t("set.none"), allOff) + bulkBtn("layers:default", t("set.default"), layersAreDefault()))
    + `<div class="hint">${escapeHtml(t("set.pinHint"))}</div><div class="list">`
    + LAYERS.map(L => `<div class="item">${swatch(L)}<span class="grow">${escapeHtml(t("layer." + L.key))}</span>`
      + `<button class="pin${SET.pins.includes(L.key) ? " on" : ""}" data-pin="${L.key}">★</button>${tog(SET.layers[L.key], `data-tl="${L.key}"`)}</div>`).join("") + `</div>`;

  const lfOff = CATS.every(c => (!c.kinds.includes("p") || !SET.lineFilter[c.key].p) && (!c.kinds.includes("c") || !SET.lineFilter[c.key].c));
  h += secHead(t("set.lines"), bulkBtn("lines:all", t("set.all"), lineFilterAllOn()) + bulkBtn("lines:none", t("set.none"), lfOff))
    + `<div class="list"><div class="matrix">`
    + `<div class="h"></div><button class="h col" data-col="p">${escapeHtml(t("pass"))}</button><button class="h col" data-col="c">${escapeHtml(t("cargo"))}</button>`
    + CATS.map(c => {
      const n = S.lines.filter(L => lineCat(L) === c.key).length;
      const cell = k => c.kinds.includes(k) ? tog(SET.lineFilter[c.key][k], `data-lf="${c.key}" data-k="${k}"`) : `<span class="na">—</span>`;
      return `<div class="name">${iconSvg(c.key)}${escapeHtml(t("mode." + c.key))}${n ? ` <span style="color:var(--muted)">${n}</span>` : ""}</div>`
        + `<div class="cell">${cell("p")}</div><div class="cell">${cell("c")}</div>`;
    }).join("") + `</div></div>`;

  if (S.kinds.length) {
    const acts = S.kinds.length > 3 ? bulkBtn("kinds:all", t("set.all"), SET.hiddenKinds.size === 0) + bulkBtn("kinds:none", t("set.none"), S.kinds.every(k => SET.hiddenKinds.has(k.key))) : "";
    h += secHead(t("set.industries"), acts) + `<div class="hint">${escapeHtml(t("set.chainHint"))}</div><div class="list">`
      + S.kinds.map(k => {
        const io = kindCargo(k.key);
        return `<div class="item kindrow"><span class="grow"><span class="kname">${escapeHtml(kindLabel(k.key))} <span style="color:var(--muted)">${k.n}</span></span>`
          + (io ? cargoFlowHtml(io) : `<span class="sw" style="background:${kindColor(k.key)}"></span>`) + `</span>`
          + `<button class="lnk" data-chain="${k.key}">${escapeHtml(t("set.chain"))}</button>${tog(!SET.hiddenKinds.has(k.key), `data-kind="${k.key}"`)}</div>`;
      }).join("")
      + `</div>`;
  }

  h += `<h4>${escapeHtml(t("set.map"))}</h4><div class="list">`
    + `<div class="item"><span class="grow">${escapeHtml(t("set.mapStyle"))}</span><select id="styleSel">`
    + Object.keys(MAP_STYLES).map(k => `<option value="${k}"${k === SET.mapStyle ? " selected" : ""}>${escapeHtml(t("style." + k))}</option>`).join("") + `</select></div>`
    + `<div class="item"><span class="grow">${escapeHtml(t("set.lineTags"))}</span>${tog(SET.lineTags, `data-opt="lineTags"`)}</div>`
    + `<div class="item"><span class="grow">${escapeHtml(t("set.rotation"))}<div class="sub">${escapeHtml(t("set.rotationHint"))}</div></span><select id="rotSel">`
    + rotationOptions().map(([v, label]) => `<option value="${v}"${String(v) === String(SET.rotation) ? " selected" : ""}>${escapeHtml(label)}</option>`).join("") + `</select></div>`
    + `<div class="item"><span class="grow">${escapeHtml(t("set.units"))}</span><select id="unitSel">`
    + ["km", "mi"].map(u => `<option value="${u}"${u === SET.units ? " selected" : ""}>${escapeHtml(t("units." + u))}</option>`).join("") + `</select></div></div>`;

  h += `<h4>${escapeHtml(t("set.towns"))}</h4><div class="list">`
    + `<div class="item"><span class="grow">${escapeHtml(t("set.showPop"))}</span>${tog(SET.showPop, `data-opt="showPop"`)}</div>`
    + `<div class="item"><span class="grow">${escapeHtml(t("set.showNeeds"))}</span>${tog(SET.showNeeds, `data-opt="showNeeds"`)}</div></div>`;


  h += `<h4>${escapeHtml(t("set.export"))}</h4><div class="list">`
    + `<div class="item"><span class="grow">${escapeHtml(t("exp.geo"))}</span><button class="btn" data-exp="geo">SVG</button></div>`
    + `<div class="item"><span class="grow">${escapeHtml(t("exp.metro"))}</span><button class="btn" data-exp="metro">SVG</button></div></div>`;
  body.innerHTML = h;
  body.scrollTop = keep;
  document.getElementById("langSel").onchange = e => { SET.lang = e.target.value; setLang(SET.lang); saveSettings(); applyStaticTexts(); renderSettings(); renderQuick(); renderCard(); draw(); };
  document.getElementById("styleSel").onchange = e => { SET.mapStyle = e.target.value; saveSettings(); draw(); };
  document.getElementById("rotSel").onchange = e => setRotation(e.target.value === "auto" ? "auto" : +e.target.value);
  document.getElementById("unitSel").onchange = e => { SET.units = e.target.value; saveSettings(); renderCard(); draw(); };
}
function rotationOptions() {
  const opts = [[0, t("rot.north")], [90, "90°"], [180, "180°"], [270, "270°"], ["auto", t("rot.auto")]];
  if (!opts.some(o => String(o[0]) === String(SET.rotation))) opts.splice(4, 0, [SET.rotation, SET.rotation + "°"]);
  return opts;
}
document.getElementById("setBody").addEventListener("click", e => {
  const el = e.target.closest("button");
  if (!el || el.disabled) return;
  if (el.dataset.tl) return toggleLayer(el.dataset.tl);
  if (el.dataset.pin) {
    const k = el.dataset.pin;
    SET.pins = SET.pins.includes(k) ? SET.pins.filter(x => x !== k) : LAYERS.map(L => L.key).filter(x => x === k || SET.pins.includes(x));
  } else if (el.dataset.lf) {
    SET.lineFilter[el.dataset.lf][el.dataset.k] = !SET.lineFilter[el.dataset.lf][el.dataset.k];
  } else if (el.dataset.col) {
    // tap on a column header: switch the whole column
    const k = el.dataset.col, cs = CATS.filter(c => c.kinds.includes(k));
    const on = !cs.every(c => SET.lineFilter[c.key][k]);
    for (const c of cs) SET.lineFilter[c.key][k] = on;
  } else if (el.dataset.bulk) {
    const [what, how] = el.dataset.bulk.split(":");
    if (what === "layers") for (const L of LAYERS) SET.layers[L.key] = how === "all" ? true : how === "none" ? false : !!DEFAULT_LAYERS[L.key];
    if (what === "lines") for (const c of CATS) SET.lineFilter[c.key] = { p: how === "all", c: how === "all" };
    if (what === "kinds") { SET.chain = null; SET.hiddenKinds.clear(); if (how === "none") for (const k of S.kinds) SET.hiddenKinds.add(k.key); }
  } else if (el.dataset.reset) {
    resetFilters();
    toast(t("toast.reset"));
  } else if (el.dataset.opt) {
    SET[el.dataset.opt] = !SET[el.dataset.opt];
  } else if (el.dataset.kind) {
    const k = el.dataset.kind;
    SET.chain = null;
    SET.hiddenKinds.has(k) ? SET.hiddenKinds.delete(k) : SET.hiddenKinds.add(k);
  } else if (el.dataset.chain) {
    return showChain(el.dataset.chain);
  } else if (el.dataset.exp) {
    return exportSvg(el.dataset.exp);
  } else return;
  saveSettings(); renderSettings(); renderQuick(); draw();
});
function openSettings() { renderSettings(); document.getElementById("settings").classList.add("open"); }
function closeSettings() { document.getElementById("settings").classList.remove("open"); }
document.getElementById("btnSettings").onclick = openSettings;
document.getElementById("setClose").onclick = closeSettings;
document.getElementById("settings").addEventListener("click", e => { if (e.target.id === "settings") closeSettings(); });

function setFollow(on) {
  SET.follow = on;
  saveSettings();
  document.getElementById("btnFollow").classList.toggle("on", on);
  const c = camNow();
  if (on && c && c.x != null) { S.view.cx = c.x; S.view.cy = c.y; draw(); }
}
document.getElementById("btnFollow").onclick = () => setFollow(!SET.follow);
document.getElementById("btnFit").onclick = () => { setFollow(false); fit(); };
document.getElementById("btnFitWidth").onclick = () => { setFollow(false); fitWidth(); };

function updateStatus() {
  const el = document.getElementById("status"), txt = document.getElementById("statusText");
  const fresh = performance.now() - S.lastLiveAt < 3000;
  el.className = "pill " + (!S.sseOk ? "" : fresh ? "ok" : "stale");
  txt.textContent = !S.sseOk ? t("status.noLink") : fresh ? t("status.game") : t("status.silent");
  // Companion reachable but the game sends nothing (mod not enabled in this save, main menu, loading):
  // say once per silent spell what to check. Tapping the status pill shows it again.
  const now = performance.now();
  if (!S.sseOk || fresh) { S.silentSince = 0; S.silentHinted = false; }
  else if (!S.silentSince) S.silentSince = now;
  else if (!S.silentHinted && now - S.silentSince > 10000) { S.silentHinted = true; toast(t("hint.silent"), false, 9000); }
}
setInterval(updateStatus, 1000);
document.getElementById("status").onclick = () => {
  const fresh = performance.now() - S.lastLiveAt < 3000;
  if (!S.sseOk) toast(t("hint.noLink"), true, 9000);
  else if (!fresh) toast(t("hint.silent"), false, 9000);
};

let toastTimer = 0;
function toast(text, isErr, ms) {
  const el = document.getElementById("toast");
  el.textContent = text; el.className = "pill show" + (isErr ? " err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "pill" + (isErr ? " err" : ""); }, ms || (isErr ? 3500 : 1400));
}
// The first few times lines show up, say that they can be tapped.
let lineHintDone = false;
function maybeLineHint() {
  if (lineHintDone || !S.lines.length) return;
  lineHintDone = true;
  const n = recall("lineHint", 0);
  if (n >= 3) return;
  store("lineHint", n + 1);
  setTimeout(() => toast(t("hint.tapLine"), false, 5000), 1500);
}

function applyStaticTexts() {
  for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
  document.getElementById("q").placeholder = t("search");
  document.getElementById("btnFollow").title = t("btn.follow");
  document.getElementById("btnFit").title = t("btn.fit");
  document.getElementById("btnFitWidth").title = t("btn.fitWidth");
  document.getElementById("btnSettings").title = t("btn.settings");
  document.getElementById("compass").title = t("btn.compass");
  for (const id of ["btnFollow", "btnFit", "btnFitWidth", "btnSettings", "compass"]) {
    const b = document.getElementById(id); b.setAttribute("aria-label", b.title);
  }
  updateStatus();
}

// ================================================================ search

const q = document.getElementById("q"), results = document.getElementById("results");
function closeResults() { results.classList.remove("open"); }
q.addEventListener("input", () => {
  const s = q.value.trim().toLowerCase();
  results.innerHTML = "";
  if (!s) return closeResults();
  const pool = [...S.towns, ...S.groups, ...S.lines, ...S.industries];
  const all = pool.filter(p => (p.name || "").toLowerCase().includes(s));
  const rank = p => p.kind === "town" ? 0 : p.kind === "station" ? 1 : p.kind === "line" ? 2 : 3;
  all.sort((a, b) => rank(a) - rank(b) || (a.name.toLowerCase().indexOf(s) - b.name.toLowerCase().indexOf(s)));
  for (const p of all.slice(0, 8)) {
    const b = document.createElement("button");
    let sw, sub, subIcon = "";
    if (p.kind === "town") { sw = `<span class="sw round" style="background:var(--town)"></span>`; sub = fmtInt(townPopulation(p.id) || p.size); }
    else if (p.kind === "station") { sw = `<span class="sw round" style="background:#fff;border:2px solid #0f1720"></span>`; sub = t("card.station"); subIcon = iconSvg(stationCat(p)); }
    else if (p.kind === "line") { sw = `<span class="sw line" style="background:${lineColor(p)}"></span>`; sub = t("mode." + lineCat(p)); subIcon = iconSvg(lineCat(p)); }
    else { sw = `<span class="sw" style="background:${kindColor(p.kind)}"></span>`; sub = kindLabel(p.kind); subIcon = cargoFlowHtml(industryCargo(p)); }
    b.innerHTML = `${sw}<span>${escapeHtml(p.name)}</span><span class="sub">${subIcon}${escapeHtml(sub)}</span>`;
    b.onclick = () => {
      q.value = ""; closeResults(); q.blur();
      setFollow(false);
      if (p.kind !== "line") { S.view.cx = p.x; S.view.cy = p.y; S.view.scale = Math.max(S.view.scale, 0.06); }
      select(p, true);
    };
    results.appendChild(b);
  }
  results.classList.toggle("open", all.length > 0);
});
q.addEventListener("keydown", e => {
  if (e.key === "Enter") { const first = results.querySelector("button"); if (first) first.click(); }
  if (e.key === "Escape") { q.value = ""; closeResults(); q.blur(); }
});

// ================================================================ SVG export

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(t("toast.exported"));
}
const xml = s => escapeHtml(s);

function exportSvg(kind) {
  const lines = S.lines.filter(lineVisible);
  const stopIds = new Set(lines.flatMap(L => (L.stops || []).map(s => s[0])));
  const groups = S.groups.filter(g => stopIds.has(g.id) && g.x != null);
  if (!groups.length) return toast(t("card.noData"), true);
  const svg = kind === "metro" ? metroSvg(lines, groups) : geoSvg(lines, groups);
  const date = new Date().toISOString().slice(0, 10);
  download(`tf3-${kind === "metro" ? "metro" : "lines"}-${date}.svg`, svg, "image/svg+xml");
}

const SVG_FONT = "Helvetica, Arial, sans-serif";
const measureCtx = document.createElement("canvas").getContext("2d");
function textWidth(s, size, weight) { measureCtx.font = `${weight || 400} ${size}px ${SVG_FONT}`; return measureCtx.measureText(s).width; }
const fx = v => Math.round(v * 10) / 10;

// Collision boxes as (possibly rotated) rectangles; separating-axis test.
function makePlacer() {
  const boxes = [];
  const proj = (c, ax) => { let lo = Infinity, hi = -Infinity; for (const p of c) { const v = p[0] * ax[0] + p[1] * ax[1]; if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; };
  const axes = c => [[c[1][0] - c[0][0], c[1][1] - c[0][1]], [c[3][0] - c[0][0], c[3][1] - c[0][1]]];
  const bb = c => [Math.min(...c.map(p => p[0])), Math.min(...c.map(p => p[1])), Math.max(...c.map(p => p[0])), Math.max(...c.map(p => p[1]))];
  const hit = (a, b) => {
    if (a.bb[0] >= b.bb[2] || b.bb[0] >= a.bb[2] || a.bb[1] >= b.bb[3] || b.bb[1] >= a.bb[3]) return false;
    for (const ax of [...axes(a.c), ...axes(b.c)]) {
      const [a0, a1] = proj(a.c, ax), [b0, b1] = proj(b.c, ax);
      if (a1 <= b0 || b1 <= a0) return false;
    }
    return true;
  };
  return {
    boxes,
    fits(c) { const o = { c, bb: bb(c) }; return !boxes.some(b => hit(b, o)); },
    add(c) { boxes.push({ c, bb: bb(c) }); },
    rect(x0, y0, x1, y1) { this.add([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]); },
  };
}
// Corners of a text box starting (or ending, with end) at x,y and running at angle a (radians, y down).
function labelBox(x, y, a, w, h, end) {
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const s0 = end ? -w : 0, s1 = end ? 0 : w;
  const P = (s, k) => [x + ux * s + vx * k * h / 2, y + uy * s + vy * k * h / 2];
  return [P(s0, -1), P(s1, -1), P(s1, 1), P(s0, 1)];
}

// Station names that do not collide with other names or station marks. Busiest stations go first.
// Returns the drawn labels and the stations that got a number instead (listed under the map).
function placeStationLabels(items, placer, size, weight, prefs, numFrom) {
  const fs = size, h = fs + 3;
  const labels = [], numbered = [], seen = [];
  const order = [...items].sort((a, b) => b.n - a.n || String(a.g.name).localeCompare(String(b.g.name)));
  const D = Math.PI / 4;
  for (const it of order) {
    const name = String(it.g.name || "");
    // the same name right next to an already named station: one label is enough
    if (seen.some(s => s.name === name && Math.hypot(s.x - it.x, s.y - it.y) < 160)) continue;
    const w = textWidth(name, fs, weight) + 2, d = it.r + 4, q = d * 0.75;
    const cands = {
      right: [it.x + d, it.y, 0, false], left: [it.x - d, it.y, 0, true],
      upright: [it.x + q, it.y - q, -D, false], downright: [it.x + q, it.y + q, D, false],
      upleft: [it.x - q, it.y - q, D, true], downleft: [it.x - q, it.y + q, -D, true],
      above: [it.x - w / 2, it.y - d - h / 2, 0, false], below: [it.x - w / 2, it.y + d + h / 2, 0, false],
    };
    let done = false;
    for (const key of prefs) {
      const [x, y, a, end] = cands[key];
      const c = labelBox(x, y, a, w, h, end);
      if (placer.fits(c)) { placer.add(c); labels.push({ text: name, x, y, a, end, c }); seen.push({ name, x: it.x, y: it.y }); done = true; break; }
    }
    if (!done) numbered.push(it);
  }
  numbered.sort((a, b) => a.y - b.y || a.x - b.x);
  numbered.forEach((it, i) => { it.num = (numFrom || 0) + i + 1; });
  return { labels, numbered };
}
function labelSvg(L, fs, weight) {
  const deg = Math.round(L.a * 180 / Math.PI);
  return `<text transform="translate(${fx(L.x)} ${fx(L.y)})${deg ? ` rotate(${deg})` : ""}" dy="0.35em" font-size="${fs}" font-weight="${weight}"`
    + `${L.end ? ' text-anchor="end"' : ""} fill="#1b2430" paint-order="stroke" stroke="#fff" stroke-width="3.5" stroke-linejoin="round">${xml(L.text)}</text>`;
}
function numberSvg(it) {
  return `<text x="${fx(it.x + it.r * 0.8)}" y="${fx(it.y - it.r * 0.8)}" font-size="10" font-weight="700" fill="#c0392b" paint-order="stroke" stroke="#fff" stroke-width="3">${it.num}</text>`;
}

// Page: title, the map panels stacked (each: content in its own coordinates, bbox = area shown,
// optional caption), then the legend grouped by transport and the list of numbered stations.
function svgDoc(panels, lines, numbered) {
  const pad = 40, headH = 86, colW = 340, rowH = 24, gap = 56;
  const W0 = Math.ceil(Math.max(...panels.map(p => p.bbox.x1 - p.bbox.x0 + 2 * pad), 2 * colW + 2 * pad));
  const cols = Math.max(1, Math.floor((W0 - 2 * pad) / colW));
  const columns = (items, y0) => {
    const per = Math.ceil(items.length / cols);
    let out = "";
    items.forEach((it, i) => { out += it(pad + Math.floor(i / per) * colW, y0 + (i % per) * rowH); });
    return { svg: out, h: per * rowH };
  };
  let y = headH, maps = "";
  panels.forEach((p, n) => {
    const cw = p.bbox.x1 - p.bbox.x0, ch = p.bbox.y1 - p.bbox.y0;
    if (p.caption) { maps += `<text x="${pad}" y="${y + 6}" font-size="18" font-weight="700" fill="#1b2430">${xml(p.caption)}</text>`; y += 26; }
    const ox = fx(pad + (W0 - 2 * pad - cw) / 2 - p.bbox.x0), oy = fx(y - p.bbox.y0);
    maps += `<clipPath id="clip${n}"><rect x="${fx(p.bbox.x0)}" y="${fx(p.bbox.y0)}" width="${fx(cw)}" height="${fx(ch)}"/></clipPath>`
      + `<g transform="translate(${ox} ${oy})">${p.frame ? `<rect x="${fx(p.bbox.x0)}" y="${fx(p.bbox.y0)}" width="${fx(cw)}" height="${fx(ch)}" fill="none" stroke="#9aa5b1" stroke-width="1.5"/>` : ""}`
      + `<g clip-path="url(#clip${n})">${p.content}</g></g>`;
    y += ch + gap;
  });
  let body = "";
  const items = [];
  for (const c of CATS) {
    const ls = lines.filter(L => lineCat(L) === c.key).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    if (!ls.length) continue;
    items.push((x, yy) => `<g transform="translate(${x} ${yy - 9}) scale(0.75)"><path d="${MODE_ICONS[c.key]}" fill="none" stroke="#1b2430" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`
      + `<text x="${x + 26}" y="${yy + 5}" font-size="14" font-weight="700" fill="#1b2430">${xml(t("mode." + c.key))} · ${ls.length}</text>`);
    for (const L of ls) {
      const air = AIR_CATS.includes(c.key);
      items.push((x, yy) => `<line x1="${x + 2}" y1="${yy}" x2="${x + 34}" y2="${yy}" stroke="${lineColor(L)}" stroke-width="6" stroke-linecap="round"${air ? ' stroke-dasharray="8 6"' : ""}/>`
        + `<text x="${x + 44}" y="${yy + 5}" font-size="13" fill="#1b2430">${xml(shortName(L.name, 38))}</text>`);
    }
  }
  if (items.length) {
    body += `<text x="${pad}" y="${y}" font-size="16" font-weight="700" fill="#1b2430">${xml(t("layer.lines"))}</text>`;
    const lg = columns(items, y + 30);
    body += lg.svg; y += 30 + lg.h + 20;
  }
  if (numbered.length) {
    body += `<text x="${pad}" y="${y}" font-size="16" font-weight="700" fill="#1b2430">${xml(t("exp.unlabeled"))}</text>`;
    const ix = columns(numbered.map(it => (x, yy) => `<text x="${x}" y="${yy + 5}" font-size="13" fill="#1b2430"><tspan font-weight="700" fill="#c0392b">${it.num}</tspan>  ${xml(shortName(it.g.name, 40))}</text>`), y + 30);
    body += ix.svg; y += 30 + ix.h + 20;
  }
  const H0 = Math.ceil(y + pad);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W0}" height="${H0}" viewBox="0 0 ${W0} ${H0}" font-family="${SVG_FONT}">`
    + `<rect width="100%" height="100%" fill="#ffffff"/>`
    + `<text x="${pad}" y="46" font-size="26" font-weight="700" fill="#1b2430">${xml(t("exp.title"))}</text>`
    + `<text x="${pad}" y="68" font-size="13" fill="#6b7785">Transport Fever 3 · ${xml(new Date().toLocaleDateString(CUR_LANG))}</text>`
    + maps + body + `</svg>`;
}
function bboxOf(points, extraBoxes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const [x, y] of points) add(x, y);
  for (const c of extraBoxes || []) for (const [x, y] of c) add(x, y);
  return { x0: x0 - 12, y0: y0 - 12, x1: x1 + 12, y1: y1 + 12 };
}
function extentOf(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
}
function linesAt(g, lines) { return lines.filter(L => (L.stops || []).some(s => s[0] === g.id)).length; }

// Densest group of stations (a big town with many stops), as a world rectangle, or null when the
// stations are spread evenly enough for one map.
function denseArea(groups, span) {
  if (groups.length < 14) return null;
  const R = Math.max(1200, span / 40);
  let best = null, bestN = 0;
  for (const a of groups) {
    let n = 0;
    for (const b of groups) if (Math.abs(a.x - b.x) < R && Math.abs(a.y - b.y) < R) n++;
    if (n > bestN) { bestN = n; best = a; }
  }
  const near = groups.filter(b => Math.hypot(best.x - b.x, best.y - b.y) < R * 1.6);
  if (near.length < 10) return null;
  const e = extentOf(near.map(g => [g.x, g.y]));
  const m = Math.max(250, (e.x1 - e.x0 + e.y1 - e.y0) * 0.06);
  const w = { x0: e.x0 - m, y0: e.y0 - m, x1: e.x1 + m, y1: e.y1 + m };
  // only worth it when the area is much smaller than the whole map
  return Math.max(w.x1 - w.x0, w.y1 - w.y0) * 4 < span ? w : null;
}
function nearestSpacing(groups) {
  const nn = [];
  for (const a of groups) {
    let m = Infinity;
    for (const b of groups) if (b !== a) m = Math.min(m, Math.hypot(a.x - b.x, a.y - b.y));
    if (isFinite(m)) nn.push(m);
  }
  nn.sort((a, b) => a - b);
  return nn.length ? nn[Math.floor(nn.length * 0.25)] : 1000;
}
const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

// One geographic panel of the world rectangle e at k px per metre.
// opts.skip: stations that get no name here (they are named on the detail panel); opts.mark: rectangle to outline.
function geoPanel(lines, groups, e, k, opts) {
  const X = x => (x - e.x0) * k, Y = y => (e.y1 - y) * k;
  let inner = "";
  if (SET.layers.rail) {
    let d = "";
    for (const tl of S.net.tiles.values()) {
      if (tl.x1 < e.x0 || tl.x0 > e.x1 || tl.y1 < e.y0 || tl.y0 > e.y1) continue;
      for (const s of tl.railSegs) {
        if (s.length === 8) d += `M${fx(X(s[0]))} ${fx(Y(s[1]))}C${fx(X(s[2]))} ${fx(Y(s[3]))} ${fx(X(s[4]))} ${fx(Y(s[5]))} ${fx(X(s[6]))} ${fx(Y(s[7]))}`;
        else d += `M${fx(X(s[0]))} ${fx(Y(s[1]))}L${fx(X(s[2]))} ${fx(Y(s[3]))}`;
      }
    }
    if (d) inner += `<path d="${d}" fill="none" stroke="#d5dbe1" stroke-width="1.2" stroke-linecap="round"/>`;
  }
  const lw = clamp(k * 30, 3, 6);
  for (const L of lines) {
    const air = AIR_CATS.includes(lineCat(L));
    for (const pl of linePolylines(L)) {
      inner += `<polyline points="${pl.map(([x, y]) => fx(X(x)) + "," + fx(Y(y))).join(" ")}" fill="none" stroke="${lineColor(L)}" stroke-width="${fx(lw)}" stroke-linecap="round" stroke-linejoin="round"${air ? ` stroke-dasharray="${fx(lw * 2.4)} ${fx(lw * 1.6)}" opacity="0.8"` : ""}/>`;
    }
  }
  const shown = groups.filter(g => inRect(e, g.x, g.y));
  const placer = makePlacer();
  const items = shown.map(g => { const n = linesAt(g, lines); return { g, n, x: X(g.x), y: Y(g.y), r: n > 1 ? 6.5 : 5 }; });
  for (const it of items) placer.rect(it.x - it.r, it.y - it.r, it.x + it.r, it.y + it.r);
  if (opts.mark) {
    const m = opts.mark, x0 = X(m.x0), y0 = Y(m.y1), x1 = X(m.x1), y1 = Y(m.y0);
    inner += `<rect x="${fx(x0)}" y="${fx(y0)}" width="${fx(x1 - x0)}" height="${fx(y1 - y0)}" fill="rgba(27,36,48,0.04)" stroke="#1b2430" stroke-width="1.5" stroke-dasharray="6 4"/>`
      + `<text x="${fx(x1 + 6)}" y="${fx(y0 + 14)}" font-size="15" font-weight="700" fill="#1b2430" paint-order="stroke" stroke="#fff" stroke-width="3">${xml(opts.markLabel)}</text>`;
    placer.rect(x0, y0, x1, y1);
  }
  const toName = opts.skip ? items.filter(it => !opts.skip(it.g)) : items;
  const { labels, numbered } = placeStationLabels(toName, placer, 13, 500, ["right", "upright", "downright", "left", "upleft", "downleft", "above", "below"], opts.numFrom || 0);
  for (const it of items) inner += `<circle cx="${fx(it.x)}" cy="${fx(it.y)}" r="${it.r}" fill="#fff" stroke="#1b2430" stroke-width="${it.n > 1 ? 2.5 : 2}"/>`;
  for (const L of labels) inner += labelSvg(L, 13, 500);
  for (const it of numbered) inner += numberSvg(it);
  const frame = [[X(e.x0), Y(e.y0)], [X(e.x1), Y(e.y1)]];
  let bbox;
  if (opts.exact) bbox = { x0: 0, y0: 0, x1: X(e.x1), y1: Y(e.y0) };
  else bbox = bboxOf([...items.map(it => [it.x, it.y]), ...frame], labels.map(L => L.c));
  return { content: inner, bbox, numbered };
}

// Geographic map. Scale comes from how close stations are, within 1500..6000 px on the long side.
// A dense town that would still be a blur gets its own detail panel (A) below the overview.
function geoSvg(lines, groups) {
  const pts = [...groups.map(g => [g.x, g.y]), ...lines.filter(L => !AIR_CATS.includes(lineCat(L))).flatMap(L => linePolylines(L).flat())];
  const e = extentOf(pts.length ? pts : groups.map(g => [g.x, g.y]));
  const span = Math.max(1, e.x1 - e.x0, e.y1 - e.y0);
  const k = clamp(34 / Math.max(nearestSpacing(groups), 40), 1500 / span, 6000 / span);
  let area = denseArea(groups, span);
  // no detail panel when the overview already gives those stations enough room
  if (area && nearestSpacing(groups.filter(g => inRect(area, g.x, g.y))) * k > 30) area = null;
  const panels = [];
  const main = geoPanel(lines, groups, e, k, area ? { skip: g => inRect(area, g.x, g.y), mark: area, markLabel: "A" } : {});
  panels.push(main);
  let numbered = main.numbered;
  if (area) {
    const ins = groups.filter(g => inRect(area, g.x, g.y));
    const aspan = Math.max(area.x1 - area.x0, area.y1 - area.y0);
    const k2 = clamp(36 / Math.max(nearestSpacing(ins), 30), 900 / aspan, 2600 / aspan);
    const det = geoPanel(lines, groups, area, k2, { exact: true, numFrom: numbered.length });
    det.caption = "A"; det.frame = true;
    panels.push(det);
    numbered = numbered.concat(det.numbered);
  }
  return svgDoc(panels, lines, numbered);
}

// Metro-style scheme. Stations keep their order from west to east and south to north, but the gaps
// between them are squeezed onto a grid (a long empty stretch counts at most 3 cells), so busy towns
// spread out and empty country shrinks. Every leg runs at 0, 45 or 90 degrees; shared legs run side by side.
function metroSvg(lines, groups) {
  const G = 50;
  const axis = get => {
    const arr = groups.map(g => [g.id, get(g)]).sort((a, b) => a[1] - b[1]);
    const out = new Map();
    let pos = 0, prev = null;
    for (const [id, v] of arr) {
      if (prev != null) { const d = v - prev; pos += d < 80 ? 0 : d < 1500 ? 1 : d < 6000 ? 2 : 3; }
      out.set(id, pos); prev = v;
    }
    return { map: out, max: pos };
  };
  const ax = axis(g => g.x), ay = axis(g => g.y);
  const pos = new Map(), taken = new Set();
  // busiest stations pick their cell first
  const order = [...groups].sort((a, b) => linesAt(b, lines) - linesAt(a, lines));
  for (const g of order) {
    let gx = ax.map.get(g.id), gy = ay.max - ay.map.get(g.id);
    if (taken.has(gx + "," + gy)) {
      let found = false;
      for (let r = 1; r <= 5 && !found; r++) {
        for (let dx = -r; dx <= r && !found; dx++) for (let dy = -r; dy <= r && !found; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || taken.has(gx + dx + "," + (gy + dy))) continue;
          gx += dx; gy += dy; found = true;
        }
      }
    }
    taken.add(gx + "," + gy);
    pos.set(g.id, [gx * G, gy * G]);
  }
  const route = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], adx = Math.abs(dx), ady = Math.abs(dy);
    const sx = Math.sign(dx), sy = Math.sign(dy);
    if (adx > ady) return [a, [a[0] + sx * (adx - ady), a[1]], b];
    return [a, [a[0], a[1] + sy * (ady - adx)], b];
  };
  const segLines = new Map();
  const legsOf = L => {
    const ids = (L.stops || []).map(s => s[0]).filter(id => pos.has(id));
    const legs = [];
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i], b = ids[(i + 1) % ids.length];
      if (a === b || (ids.length === 2 && i === 1)) continue;
      legs.push([a, b]);
    }
    return legs;
  };
  for (const L of lines) for (const [a, b] of legsOf(L)) {
    const key = a < b ? a + "|" + b : b + "|" + a;
    if (!segLines.has(key)) segLines.set(key, []);
    if (!segLines.get(key).includes(L.id)) segLines.get(key).push(L.id);
  }
  let inner = "";
  const lw = 6;
  for (const L of lines) {
    const air = AIR_CATS.includes(lineCat(L));
    for (const [a, b] of legsOf(L)) {
      const key = a < b ? a + "|" + b : b + "|" + a;
      const share = segLines.get(key), idx = share.indexOf(L.id), off = (idx - (share.length - 1) / 2) * (lw + 1.5);
      const pa = pos.get(a), pb = pos.get(b);
      const dir = a < b ? 1 : -1;
      const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1;
      const nx = -(pb[1] - pa[1]) / len * off * dir, ny = (pb[0] - pa[0]) / len * off * dir;
      const pts = route(pa, pb).map(([x, y]) => `${fx(x + nx)},${fx(y + ny)}`).join(" ");
      inner += `<polyline points="${pts}" fill="none" stroke="${lineColor(L)}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"${air ? ' stroke-dasharray="10 7" opacity="0.8"' : ""}/>`;
    }
  }
  const placer = makePlacer();
  const items = groups.map(g => { const [x, y] = pos.get(g.id); const n = linesAt(g, lines); return { g, n, x, y, r: n > 1 ? 8 : 5.5 }; });
  for (const it of items) placer.rect(it.x - it.r, it.y - it.r, it.x + it.r, it.y + it.r);
  const { labels, numbered } = placeStationLabels(items, placer, 13, 600, ["upright", "right", "downright", "upleft", "left", "downleft", "above", "below"]);
  for (const it of items) inner += `<circle cx="${it.x}" cy="${it.y}" r="${it.r}" fill="#fff" stroke="#1b2430" stroke-width="${it.n > 1 ? 3 : 2.5}"/>`;
  for (const L of labels) inner += labelSvg(L, 13, 600);
  for (const it of numbered) inner += numberSvg(it);
  const bbox = bboxOf(items.map(it => [it.x, it.y]), labels.map(L => L.c));
  return svgDoc([{ content: inner, bbox }], lines, numbered);
}

// ================================================================ start

window.addEventListener("resize", resize);
applyStaticTexts();
setFollow(SET.follow);
renderQuick();
resize();
connect();

