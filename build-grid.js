/* Preprocess Natural Earth vectors into packed 0.25° grid layers for the
   Isochronic Globe. Run:  node --max-old-space-size=6144 build-grid.js
   Writes grid.js (packed layers + place labels) and geo.js (render geometry). */
const fs = require('fs');
const P = f => JSON.parse(fs.readFileSync('data/' + f, 'utf8'));

const RES = 0.25, GW = 1440, GH = 720, GN = GW * GH;
const rowOf = lat => Math.min(GH - 1, Math.max(0, Math.floor((90 - lat) / RES)));
const latOf = j => 90 - (j + 0.5) * RES;
const colOf = lon => ((Math.floor((lon + 180) / RES) % GW) + GW) % GW;
const cellOf = (lon, lat) => rowOf(lat) * GW + colOf(lon);

/* ---------- topojson ---------- */
function topoDecode(topo, name) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(p => { x += p[0]; y += p[1]; return [x * sx + tx, y * sy + ty]; });
  });
  const ring = idxs => {
    const out = [];
    for (const ai of idxs) {
      const rev = ai < 0, a = arcs[rev ? ~ai : ai], seg = rev ? a.slice().reverse() : a;
      for (let k = out.length ? 1 : 0; k < seg.length; k++) out.push(seg[k]);
    }
    return out;
  };
  const o = topo.objects[name];
  const geoms = o.type === 'GeometryCollection' ? o.geometries : [o];
  return geoms.map(g => ({
    name: (g.properties && g.properties.name) || null,
    polys: g.type === 'Polygon' ? [g.arcs.map(ring)]
      : g.type === 'MultiPolygon' ? g.arcs.map(p => p.map(ring)) : []
  }));
}

/* ---------- scanline polygon fill, antimeridian-safe ---------- */
function fillPoly(rings, cb) {
  let lo = Infinity, hi = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const un = rings.map(rg => {
    const out = []; let prev = null;
    for (const p of rg) {
      let lon = p[0];
      if (prev !== null) {
        while (lon - prev > 180) lon -= 360;
        while (lon - prev < -180) lon += 360;
      }
      prev = lon;
      if (lon < lo) lo = lon; if (lon > hi) hi = lon;
      if (p[1] < minLat) minLat = p[1]; if (p[1] > maxLat) maxLat = p[1];
      out.push([lon, p[1]]);
    }
    return out;
  });
  const edges = [];
  for (const rg of un)
    for (let k = 0; k < rg.length; k++) {
      const a = rg[k], b = rg[(k + 1) % rg.length];
      if (a[1] !== b[1]) edges.push([a[0], a[1], b[0], b[1]]);
    }
  if (!edges.length) return;
  const xs = [];
  for (let j = rowOf(maxLat); j <= rowOf(minLat); j++) {
    const lat = latOf(j);
    xs.length = 0;
    for (let e = 0; e < edges.length; e++) {
      const [ax, ay, bx, by] = edges[e];
      if ((ay <= lat) === (by <= lat)) continue;
      xs.push(ax + (lat - ay) / (by - ay) * (bx - ax));
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let m = 0; m + 1 < xs.length; m += 2) {
      const ia = Math.ceil((xs[m] + 180) / RES - 0.5);
      const ib = Math.floor((xs[m + 1] + 180) / RES - 0.5);
      const span = Math.min(ib - ia, GW - 1);
      for (let k = 0; k <= span; k++) cb(((ia + k) % GW + GW) % GW, j);
    }
  }
}

/* ---------- line stamping ---------- */
function stampLine(coords, cb) {
  for (let k = 1; k < coords.length; k++) {
    const [x0, y0] = coords[k - 1], [x1, y1] = coords[k];
    let dx = x1 - x0;
    if (Math.abs(dx) > 180) continue;               // antimeridian jump
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(y1 - y0)) / (RES * 0.4)));
    for (let s = 0; s <= n; s++) cb(x0 + dx * s / n, y0 + (y1 - y0) * s / n);
  }
}
function eachLine(geom, cb) {
  if (!geom) return;
  if (geom.type === 'LineString') cb(geom.coordinates);
  else if (geom.type === 'MultiLineString') geom.coordinates.forEach(cb);
}

/* ---------- layers ---------- */
const land = new Uint8Array(GN);
const ctry = new Uint8Array(GN);          // 0 = none, else index+1
const terr = new Uint8Array(GN);
const road = new Uint8Array(GN);          // 0 none .. 4 motorway
const rail = new Uint8Array(GN);          // 0 none, 1 line, 2 mainline
const ferry = new Uint8Array(GN);

console.log('· countries + land (50m)');
const c50 = topoDecode(P('countries-50m.json'), 'countries');
const cNames = c50.map(c => c.name || '—');
c50.forEach((c, idx) => {
  for (const poly of c.polys) fillPoly(poly, (i, j) => { const p = j * GW + i; land[p] = 1; ctry[p] = idx + 1; });
});
// land object catches islands that belong to no listed country
for (const g of topoDecode(P('countries-50m.json'), 'land'))
  for (const poly of g.polys) fillPoly(poly, (i, j) => { land[j * GW + i] = 1; });

/* The scanline above cannot fill a ring that encloses a pole. Antarctica's
   does: in plate carree it runs the coast, drops to -90, crosses the bottom
   edge and climbs back, and unwrapping the longitudes folds that seam onto
   one side, so the rows below about -84 come out with fewer than two
   crossings and are left as ocean. That is what put open sea at the South
   Pole. The cap is filled in directly instead, which costs nothing in
   accuracy: the Ross and Ronne ice fronts are the southern limit of open
   water at about 78 S, so every cell below 84 S is ice sheet or ice shelf. */
{
  const ant = cNames.indexOf('Antarctica') + 1;
  let n = 0;
  for (let j = rowOf(-84); j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const p = j * GW + i;
      if (!land[p]) n++;
      land[p] = 1; if (ant) ctry[p] = ant;
    }
  console.log('  polar cap filled', n, 'cells below 84 S');
}
console.log('  land cells', land.reduce((a, b) => a + b, 0), '=', (land.reduce((a, b) => a + b, 0) / GN * 100).toFixed(1) + '%');

console.log('· terrain regions (10m geography)');
const TMAP = { 'Range/mtn': 1, 'Plateau': 4, 'Desert': 2, 'Tundra': 4, 'Wetlands': 3, 'Delta': 3 };
const geo = P('ne_10m_geography_regions_polys.geojson');
const seen = {};
for (const f of geo.features) {
  const cls = TMAP[f.properties.FEATURECLA];
  seen[f.properties.FEATURECLA] = (seen[f.properties.FEATURECLA] || 0) + 1;
  if (!cls) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) fillPoly(poly, (i, j) => { const p = j * GW + i; if (land[p]) terr[p] = cls; });
}
console.log('  classes seen:', Object.entries(seen).map(e => e[0] + ':' + e[1]).join(' '));

console.log('· roads (10m)');
const RCLS = f => {
  const t = f.properties.type, ex = f.properties.expressway;
  if (t === 'Ferry Route' || t === 'Ferry, seasonal' || f.properties.featurecla === 'Ferry') return 0;
  if (t === 'Major Highway' || t === 'Beltway') return ex ? 4 : 3;
  if (t === 'Secondary Highway') return ex ? 3 : 2;
  return 1;
};
const roads = P('ne_10m_roads.geojson');
let nFerry = 0;
for (const f of roads.features) {
  const isFerry = f.properties.featurecla === 'Ferry' || /Ferry/.test(f.properties.type || '');
  if (isFerry) {
    nFerry++;
    eachLine(f.geometry, c => stampLine(c, (lon, lat) => { ferry[cellOf(lon, lat)] = 1; }));
    continue;
  }
  const cls = RCLS(f);
  eachLine(f.geometry, c => stampLine(c, (lon, lat) => {
    const p = cellOf(lon, lat); if (cls > road[p]) road[p] = cls;
  }));
}
console.log('  ferry routes', nFerry, ' road cells', road.reduce((a, b) => a + (b ? 1 : 0), 0));

console.log('· railroads (10m)');
const rr = P('ne_10m_railroads.geojson');
const railDraw = [];
for (const f of rr.features) {
  const p = f.properties;
  // NB: the "north_america_dup" part is not a duplicate of anything else here —
  // the global part explicitly excludes North America, so dropping it deletes
  // every railway in the USA, Canada and Mexico.
  if (p.featurecla === 'Railroad ferry') { eachLine(f.geometry, c => stampLine(c, (lon, lat) => { ferry[cellOf(lon, lat)] = 1; })); continue; }
  const main = p.scalerank <= 7 ? 2 : 1;
  eachLine(f.geometry, c => stampLine(c, (lon, lat) => {
    const q = cellOf(lon, lat); if (main > rail[q]) rail[q] = main;
  }));
  if (p.scalerank <= 6) eachLine(f.geometry, c => {
    const s = simplify(c, 0.12);
    if (s.length > 1) railDraw.push(s.map(pt => [+pt[0].toFixed(2), +pt[1].toFixed(2)]));
  });
}
console.log('  rail cells', rail.reduce((a, b) => a + (b ? 1 : 0), 0), ' draw lines', railDraw.length);

/* Douglas–Peucker */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let idx = -1, dmax = 0;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, den = Math.hypot(dx, dy);
    for (let k = a + 1; k < b; k++) {
      // A closed ring starts and ends on the same point, so the baseline has
      // no length and every perpendicular distance is zero — which silently
      // collapses the whole ring to two points. Fall back to radial distance.
      const d = den > 1e-12
        ? Math.abs((pts[k][0] - ax) * dy - (pts[k][1] - ay) * dx) / den
        : Math.hypot(pts[k][0] - ax, pts[k][1] - ay);
      if (d > dmax) { dmax = d; idx = k; }
    }
    if (dmax > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, k) => keep[k]);
}

/* Natural Earth carries 890 airports and misses whole islands: Sardinia has
   none, so a jet from London took sixteen hours to reach Cagliari. The set is
   now OurAirports (public domain), every large or medium airport with
   scheduled service. Natural Earth's entries keep their scalerank, which is
   what gates the earlier eras; the additions come in from 1975 (large) and
   2000 (medium), since the file has no opening years. Medium fields within
   80 km of a larger one add nothing but air-graph edges and are left out. */
console.log('· airports (Natural Earth 10m + OurAirports)');
function readCSV(path) {
  const txt = fs.readFileSync(path, 'utf8'), rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, k) => [h, r[k]])));
}
const gcKm = (a, b, c, d) => {
  const p1 = b * Math.PI / 180, p2 = d * Math.PI / 180, dl = (c - a) * Math.PI / 180;
  return 6371 * Math.acos(Math.min(1, Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl)));
};
const ap = P('ne_10m_airports.geojson');
const airports = ap.features
  .filter(f => f.properties.featurecla === 'Airport' && !/spaceport/i.test(f.properties.type || ''))
  .map(f => ({ lon: +f.geometry.coordinates[0].toFixed(3), lat: +f.geometry.coordinates[1].toFixed(3),
    r: f.properties.scalerank, big: /major/i.test(f.properties.type || '') ? 1 : 0 }));
const neN = airports.length;
{
  const oa = readCSV('data/ourairports.csv')
    .filter(r => (r.type === 'large_airport' || r.type === 'medium_airport') && r.scheduled_service === 'yes')
    .map(r => ({ lon: +(+r.longitude_deg).toFixed(3), lat: +(+r.latitude_deg).toFixed(3), large: r.type === 'large_airport' }))
    .filter(r => isFinite(r.lon) && isFinite(r.lat));
  const near = (x, y, km, list) => list.some(a => Math.abs(a.lat - y) * 111 < km && gcKm(x, y, a.lon, a.lat) < km);
  let addL = 0, addM = 0;
  for (const r of oa.filter(r => r.large)) {
    if (near(r.lon, r.lat, 3, airports)) continue;
    airports.push({ lon: r.lon, lat: r.lat, r: 6, big: 1 }); addL++;
  }
  for (const r of oa.filter(r => !r.large)) {
    if (near(r.lon, r.lat, 80, airports)) continue;
    airports.push({ lon: r.lon, lat: r.lat, r: 8, big: 0 }); addM++;
  }
  console.log('  Natural Earth', neN, ' + OurAirports large', addL, ' medium', addM, ' = ', airports.length);
}

console.log('· populated places (10m)');
const pp = P('ne_10m_populated_places_simple.geojson');
const places = pp.features.map(f => {
  const p = f.properties;
  return { n: p.name, lon: +f.geometry.coordinates[0].toFixed(3), lat: +f.geometry.coordinates[1].toFixed(3),
    pop: p.pop_max || 0, cap: p.adm0cap ? 1 : 0, sr: p.scalerank };
}).filter(p => p.n && (p.pop > 180000 || p.cap))
  .sort((a, b) => (b.cap - a.cap) || (b.pop - a.pop))
  .slice(0, 1100);
console.log('  places', places.length);

/* ---------- pack ---------- */
function rle(arr) {
  const out = [];
  let i = 0;
  while (i < arr.length) {
    const v = arr[i]; let n = 1;
    while (i + n < arr.length && arr[i + n] === v && n < 0xfffff) n++;
    out.push(v);
    if (n < 254) out.push(n);
    else if (n < 65536) { out.push(254, n & 255, n >> 8); }
    else { out.push(255, n & 255, (n >> 8) & 255, (n >> 16) & 255); }
    i += n;
  }
  return Buffer.from(out).toString('base64');
}
/* High-speed track from OpenStreetMap: every way tagged highspeed=yes, in
   regional Overpass pulls (tools/harvest_osm_hsr.sh). Each cell keeps the
   best line speed crossing it and the year it opened. Speed: 75% of the
   tagged maxspeed, which is what the timetable delivers between stops once
   acceleration, restrictions and calls are paid for (Paris-Marseille 320 ->
   ~245; Koln-Frankfurt 300 -> ~225 on the new line, the rest of that journey
   being conventional). OSM start_date is sparse, so where it is missing the
   year comes from a short table of the lines that were open before 2000,
   and anything else is treated as post-2000. */
console.log('· high-speed rail (OpenStreetMap)');
const hsrv = new Uint8Array(GN), hsry = new Uint8Array(GN);   // km/h / 2; year - 1900 (0 = none)
{
  // [lon0, lat0, lon1, lat1, year] for lines open before 2000, where OSM has no date
  const EARLY = [
    [130, 33, 135, 35.2, 1975], [135, 34.4, 140.5, 36.5, 1964],        // Sanyo; Tokaido
    [138, 36, 142, 41, 1982],                                          // Tohoku, Joetsu
    [2, 45, 5.5, 49, 1981], [-2, 46.5, 2.4, 49.2, 1990],               // LGV Sud-Est; Atlantique
    [1.5, 48.9, 4.5, 51.1, 1993], [3, 50.4, 4.4, 50.9, 1997],          // LGV Nord; HSL 1
    [9.5, 49.7, 10.2, 52.5, 1991], [8.4, 48.7, 9.3, 49.6, 1991],       // Hannover-Wurzburg; Mannheim-Stuttgart
    [9.7, 52.2, 13.5, 52.7, 1998],                                     // Hannover-Berlin
    [11.2, 41.8, 12.6, 43.8, 1992],                                    // Direttissima Roma-Firenze
    [-6.1, 37.3, -3.6, 40.5, 1992]                                     // Madrid-Sevilla
  ];
  /* 57% of the ways carry start_date. Rather than call the rest 2015, the
     dated ones are collected onto a 2-degree lattice first and an undated way
     takes the median year of its own neighbourhood; the boxes below cover the
     corridors that opened before 2000 where a whole region would otherwise
     read modern, and 2015 is only the last resort. */
  const dated = new Map();
  const latKey = (lon, lat) => ((lat + 90) >> 1) * 256 + ((lon + 180) >> 1);
  const yearTag = tags => {
    const sd = (tags.start_date || tags.opening_date || '').match(/\d{4}/);
    const y = sd ? +sd[0] : 0;
    return (y >= 1960 && y <= 2035) ? y : 0;
  };
  const yearOf = (tags, lon, lat) => {
    const y = yearTag(tags);
    if (y) return y;
    for (const [l0, a0, l1, a1, yy] of EARLY) if (lon >= l0 && lon <= l1 && lat >= a0 && lat <= a1) return yy;
    for (const r of [0, 1, 2]) {                      // widen the neighbourhood
      const near = [];
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        const v = dated.get(latKey(lon + dx * 2, lat + dy * 2));
        if (v) near.push(...v);
      }
      if (near.length >= 3) { near.sort((p, q) => p - q); return near[near.length >> 1]; }
    }
    return 2015;
  };
  // first pass: where the dated ways are
  for (const f of fs.readdirSync('data').filter(n => /^osm_hsr_.*\.json$/.test(n))) {
    let d;
    try { d = JSON.parse(fs.readFileSync('data/' + f, 'utf8')); } catch (e) { continue; }
    for (const w of d.elements || []) {
      if (!w.geometry || !w.geometry.length) continue;
      const y = yearTag(w.tags || {});
      if (!y) continue;
      const m = w.geometry[w.geometry.length >> 1], k = latKey(m.lon, m.lat);
      if (!dated.has(k)) dated.set(k, []);
      dated.get(k).push(y);
    }
  }
  console.log('  dated neighbourhoods', dated.size);

  let ways = 0, cells = 0;
  for (const f of fs.readdirSync('data').filter(n => /^osm_hsr_.*\.json$/.test(n))) {
    let d;
    try { d = JSON.parse(fs.readFileSync('data/' + f, 'utf8')); } catch (e) { console.log('  skipping', f, '(not JSON)'); continue; }
    for (const w of d.elements || []) {
      if (!w.geometry || w.geometry.length < 2) continue;
      const tags = w.tags || {};
      const ms = parseFloat(String(tags.maxspeed || '').replace(/[^\d.].*$/, ''));
      /* OSM carries the speed the track is signalled for. 0.65 of it is what
         a service that calls at stations makes over a corridor. The hand
         corridors below are already end-to-end service speeds, taken from
         real timings, so they are not discounted again. */
      const v = Math.round(Math.max(110, Math.min(300, (isFinite(ms) && ms > 0 ? ms : 270) * 0.65)) / 2);
      const mid = w.geometry[w.geometry.length >> 1];
      const y = Math.max(1, Math.min(255, yearOf(tags, mid.lon, mid.lat) - 1900));
      ways++;
      for (let k = 1; k < w.geometry.length; k++) {
        const a = w.geometry[k - 1], b = w.geometry[k];
        const n = Math.max(1, Math.ceil(Math.hypot(b.lon - a.lon, b.lat - a.lat) / (RES * 0.3)));
        for (let t = 0; t <= n; t++) {
          const lon = a.lon + (b.lon - a.lon) * t / n, lat = a.lat + (b.lat - a.lat) * t / n;
          const c = rowOf(lat) * GW + colOf(lon);
          if (!hsrv[c]) cells++;
          if (v > hsrv[c]) hsrv[c] = v;
          if (!hsry[c] || y < hsry[c]) hsry[c] = y;
        }
      }
    }
  }
  console.log('  OSM ways', ways, ' cells', cells);

  /* The corridors themselves, with the running speed the timetable actually
     delivers end to end (excluding boarding) and the year they opened. OSM
     gives finer geometry and a maxspeed wherever a box has been pulled; this
     list makes the layer complete regardless, and carries the opening years
     the tags mostly lack. Speeds are fastest scheduled service over the
     corridor length: Paris-Marseille 750 km in 3:05 -> 245; Cologne-Frankfurt
     180 km in 1:05 -> 215 (the new line, with its calls); Brussels-Cologne
     220 km in 1:47 with conventional ends -> 160 on the HSL; Tokaido 515 km
     in 2:21 -> 225; Beijing-Shanghai 1318 km in 4:18 -> 280. */
  const H = (v, y, ...p) => ({ v, y, p });
  const HSR_HAND = [
    // France
    H(240, 1981, [2.35, 48.86], [5.08, 45.72]), H(245, 2001, [5.08, 45.72], [4.98, 44.99], [4.79, 43.92], [5.38, 43.30]),
    H(230, 2001, [4.79, 43.92], [4.36, 43.84], [3.88, 43.61]), H(240, 1989, [2.35, 48.86], [0.19, 48.0]),
    H(240, 2017, [0.19, 48.0], [-1.68, 48.11]), H(240, 1990, [2.35, 48.86], [0.69, 47.39]), H(250, 2017, [0.69, 47.39], [-0.58, 44.84]),
    H(150, 1989, [0.19, 48.0], [-1.55, 47.22]), H(245, 1993, [2.35, 48.86], [3.06, 50.63]), H(240, 1993, [3.06, 50.63], [1.81, 50.92]),
    H(220, 1997, [3.06, 50.63], [4.35, 50.85]), H(245, 2007, [2.35, 48.86], [4.0, 49.2], [7.75, 48.58]),
    H(230, 2011, [5.04, 47.32], [6.02, 47.24], [7.34, 47.75]), H(220, 2013, [3.88, 43.61], [2.9, 42.7], [2.96, 42.27], [2.17, 41.39]),
    // Britain
    H(220, 2003, [-0.13, 51.53], [0.87, 51.14], [1.17, 51.10]), H(140, 1994, [1.17, 51.10], [1.81, 50.92]),
    H(150, 2004, [-0.13, 51.51], [-1.9, 52.48], [-2.44, 53.09], [-2.24, 53.48]),
    H(145, 2004, [-2.44, 53.09], [-2.7, 53.76], [-2.94, 54.89], [-4.25, 55.86]),
    H(150, 1991, [-0.13, 51.51], [-0.25, 52.57], [-1.09, 53.96], [-1.61, 54.97], [-3.19, 55.95]),
    H(140, 2018, [-0.13, 51.51], [-0.97, 51.46], [-1.78, 51.56], [-2.59, 51.45]), H(135, 2018, [-2.59, 51.45], [-3.18, 51.48]),
    // Benelux, Germany
    H(160, 2002, [4.35, 50.85], [4.7, 50.88], [5.57, 50.63], [6.08, 50.78], [6.96, 50.94]),
    H(150, 2009, [4.35, 50.85], [4.42, 51.22], [4.47, 51.92], [4.9, 52.37]),
    H(215, 2002, [6.96, 50.94], [8.57, 50.05], [8.68, 50.11]), H(150, 1991, [8.68, 50.11], [8.47, 49.49]),
    H(190, 1991, [8.47, 49.49], [9.18, 48.78]), H(180, 2022, [9.18, 48.78], [9.99, 48.4]), H(140, 1990, [9.99, 48.4], [10.9, 48.37], [11.58, 48.14]),
    H(200, 1991, [9.74, 52.37], [9.93, 51.53], [9.5, 51.32], [9.68, 50.55], [9.93, 49.79]), H(200, 1998, [9.74, 52.37], [13.4, 52.52]),
    H(200, 2006, [11.08, 49.45], [11.43, 48.77], [11.58, 48.14]), H(210, 2017, [13.4, 52.52], [12.0, 51.48], [11.03, 50.98], [11.08, 49.45]),
    H(160, 2004, [10.0, 53.55], [13.4, 52.52]), H(130, 2012, [8.4, 49.01], [7.59, 47.56]), H(140, 1991, [8.47, 49.49], [8.4, 49.01]),
    H(125, 2000, [8.68, 50.11], [9.93, 49.79], [11.08, 49.45]), H(135, 2000, [6.96, 50.94], [7.47, 51.51], [9.74, 52.37]),
    H(140, 2000, [10.0, 53.55], [9.74, 52.37]),
    // Austria, Switzerland
    H(145, 2012, [16.37, 48.21], [15.62, 48.2], [14.29, 48.31], [13.05, 47.81]), H(130, 2025, [15.44, 47.07], [14.31, 46.62]),
    H(135, 2004, [8.54, 47.38], [7.45, 46.95]), H(125, 2004, [7.45, 46.95], [6.63, 46.52], [6.14, 46.2]),
    H(100, 2016, [8.54, 47.38], [8.95, 46.0], [9.19, 45.46]),
    // Italy
    H(180, 2009, [7.68, 45.07], [9.19, 45.46]), H(210, 2008, [9.19, 45.46], [11.34, 44.49]), H(175, 2009, [11.34, 44.49], [11.25, 43.77]),
    H(185, 1992, [11.25, 43.77], [12.5, 41.9]), H(200, 2005, [12.5, 41.9], [14.27, 40.85]), H(150, 2008, [14.27, 40.85], [14.79, 40.68]),
    H(150, 2016, [9.19, 45.46], [10.22, 45.54], [10.99, 45.44], [12.33, 45.44]),
    // Spain, Portugal
    H(245, 2008, [-3.7, 40.42], [-0.89, 41.65], [0.62, 41.62], [2.17, 41.39]), H(220, 2013, [2.17, 41.39], [2.82, 41.98], [2.96, 42.27]),
    H(205, 1992, [-3.7, 40.42], [-4.78, 37.89], [-5.98, 37.39]), H(195, 2007, [-4.78, 37.89], [-4.42, 36.72]),
    H(230, 2010, [-3.7, 40.42], [-2.13, 40.07], [-0.38, 39.47]), H(210, 2013, [-2.13, 40.07], [-1.86, 38.99], [-0.48, 38.35]),
    H(200, 2007, [-3.7, 40.42], [-4.12, 40.95], [-4.73, 41.65]), H(190, 2015, [-4.73, 41.65], [-5.57, 42.6]), H(190, 2022, [-4.73, 41.65], [-3.7, 42.34]),
    H(170, 2021, [-5.57, 42.6], [-7.86, 42.34], [-8.55, 42.88], [-8.4, 43.37]), H(150, 2005, [-3.7, 40.42], [-4.02, 39.86]),
    H(150, 2018, [-0.38, 39.47], [-0.05, 39.99]), H(125, 1999, [-9.14, 38.72], [-8.61, 41.15]),
    H(150, 1997, [2.17, 41.39], [1.25, 41.12], [0.05, 40.4], [-0.38, 39.47]),
    // the north, Poland, the Danube
    H(155, 1990, [18.07, 59.33], [11.97, 57.71]), H(145, 1995, [18.07, 59.33], [13.0, 55.6]),
    H(120, 2000, [12.57, 55.68], [10.39, 55.4], [9.75, 55.57], [10.2, 56.16]), H(150, 1998, [10.75, 59.91], [11.1, 60.19]),
    H(135, 2006, [24.94, 60.17], [23.76, 61.5]), H(130, 2022, [23.73, 37.98], [22.42, 38.9], [22.94, 40.64]), H(140, 2014, [21.01, 52.23], [19.94, 50.06]), H(135, 2014, [21.01, 52.23], [19.02, 50.26]),
    H(135, 2015, [21.01, 52.23], [18.65, 54.35]), H(120, 2010, [16.37, 48.21], [19.04, 47.5]),
    H(110, 2015, [13.4, 52.52], [14.55, 52.35], [16.93, 52.41], [21.01, 52.23]),
    // Russia, Turkey, Morocco, Arabia, Central Asia
    H(190, 2009, [37.62, 55.75], [30.31, 59.94]), H(130, 2010, [37.62, 55.75], [44.0, 56.3]),
    H(115, 2012, [30.52, 50.45], [28.66, 50.25], [26.25, 50.62], [24.03, 49.84]),
    H(140, 2014, [29.0, 41.0], [30.52, 39.78], [32.86, 39.93]), H(160, 2011, [32.86, 39.93], [32.48, 37.87]), H(150, 2023, [32.86, 39.93], [37.02, 39.75]),
    H(220, 2018, [-5.83, 35.76], [-6.58, 34.26]), H(120, 2018, [-6.58, 34.26], [-6.85, 34.02], [-7.59, 33.57]),
    H(200, 2018, [39.83, 21.39], [39.19, 21.49], [39.57, 24.52]), H(165, 2011, [69.24, 41.3], [66.96, 39.65], [64.42, 39.77]),
    H(110, 2016, [46.68, 24.71], [49.6, 25.4], [50.09, 26.42]), H(100, 2017, [36.82, -1.29], [38.0, -2.6], [39.67, -4.04]),
    H(130, 2022, [-3.7, 40.42], [-6.09, 39.48], [-6.97, 38.88]),
    // North America
    H(120, 2000, [-71.06, 42.36], [-74.0, 40.71]), H(165, 2000, [-74.0, 40.71], [-75.16, 39.95], [-77.04, 38.91]),
    H(115, 2023, [-80.19, 25.76], [-80.05, 26.71], [-81.38, 28.54]), H(110, 1990, [-79.38, 43.65], [-75.7, 45.42], [-73.57, 45.5]),
    H(110, 1990, [-79.38, 43.65], [-76.5, 44.23], [-73.57, 45.5]),
    // Japan
    H(200, 1964, [139.77, 35.68], [136.88, 35.17], [135.76, 34.99], [135.5, 34.73]),
    H(245, 1975, [135.5, 34.73], [133.92, 34.67], [132.47, 34.4], [130.42, 33.59]),
    H(230, 1982, [139.77, 35.68], [140.88, 38.26], [141.14, 39.7]), H(220, 2010, [141.14, 39.7], [140.69, 40.83]), H(150, 2016, [140.69, 40.83], [140.65, 41.9]),
    H(200, 1982, [139.77, 35.68], [139.0, 36.32], [139.06, 37.91]), H(190, 2015, [139.0, 36.32], [138.19, 36.64], [137.21, 36.7], [136.66, 36.58]),
    H(180, 2024, [136.66, 36.58], [136.06, 35.65]), H(195, 2011, [130.42, 33.59], [130.69, 32.79], [130.54, 31.58]),
    // Korea, Taiwan, Indonesia
    H(195, 2004, [126.97, 37.55], [127.43, 36.33], [128.6, 35.88], [129.04, 35.11]), H(185, 2015, [127.33, 36.62], [126.79, 35.14], [126.39, 34.79]),
    H(225, 2007, [121.52, 25.05], [120.62, 24.11], [120.31, 22.69]), H(190, 2023, [106.85, -6.21], [107.62, -6.92]),
    // China: the trunks
    H(280, 2011, [116.4, 39.9], [117.0, 36.65], [118.8, 32.06], [121.47, 31.23]),
    H(280, 2012, [116.4, 39.9], [114.5, 38.05], [113.63, 34.75], [114.31, 30.59], [112.94, 28.23], [113.26, 23.13], [114.06, 22.54], [114.17, 22.3]),
    H(250, 2010, [121.47, 31.23], [120.16, 30.27]), H(220, 2013, [120.16, 30.27], [121.55, 29.87]), H(230, 2014, [120.16, 30.27], [115.86, 28.68], [112.94, 28.23]),
    H(200, 2009, [118.8, 32.06], [117.28, 31.86], [114.31, 30.59]), H(190, 2014, [114.31, 30.59], [106.55, 29.56]), H(280, 2015, [106.55, 29.56], [104.07, 30.57]),
    H(250, 2010, [113.63, 34.75], [108.94, 34.34]), H(210, 2017, [108.94, 34.34], [104.07, 30.57]), H(210, 2017, [108.94, 34.34], [103.83, 36.06]), H(170, 2014, [103.83, 36.06], [87.62, 43.83]),
    H(240, 2012, [116.4, 39.9], [123.43, 41.8], [126.53, 45.8]), H(190, 2016, [113.26, 23.13], [106.63, 26.65], [102.83, 25.04]), H(200, 2018, [106.63, 26.65], [106.55, 29.56]),
    H(200, 2013, [120.16, 30.27], [119.3, 26.07], [118.09, 24.48]), H(190, 2013, [118.09, 24.48], [114.06, 22.54]),
    H(200, 2008, [120.38, 36.07], [117.0, 36.65]), H(230, 2017, [117.0, 36.65], [114.5, 38.05]), H(200, 2012, [112.55, 37.87], [114.5, 38.05])
  ];
  // and the dense eastern Chinese grid: every railway cell in this box has a
  // high-speed neighbour, at a regional 160 km/h from 2015
  const HSR_BOX = [[103, 22, 122, 41, 160, 2015]];
  let hc = 0;
  const put = (c, kmh, y) => { const v = Math.round(kmh / 2); if (!hsrv[c]) hc++; if (v > hsrv[c]) hsrv[c] = v; if (!hsry[c] || y < hsry[c]) hsry[c] = y; };
  /* A hand corridor is the speed a service makes over the whole corridor, so
     it governs rather than competing with OSM's line speeds. Taking the
     maximum threw the curated value away wherever a fast fragment touched
     the cell: Frankfurt to Nuremberg is 125 km/h end to end with its stops,
     but the Hannover-Wurzburg line ends in one cell and the Nuremberg-
     Ingolstadt line starts in another, so the 92 conventional km between
     them ran at 200. Brussels to Vienna lost two hours that way. */
  const set = (c, kmh, y) => { const v = Math.round(kmh / 2); if (!hsrv[c]) hc++; hsrv[c] = v; if (!hsry[c] || y < hsry[c]) hsry[c] = y; };
  for (const ln of HSR_HAND) {
    const y = ln.y - 1900;
    for (let k = 1; k < ln.p.length; k++) {
      const [x0, y0] = ln.p[k - 1], [x1, y1] = ln.p[k];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (RES * 0.3)));
      for (let t = 0; t <= n; t++) set(cellOf(x0 + (x1 - x0) * t / n, y0 + (y1 - y0) * t / n), ln.v, y);
    }
  }
  for (const [l0, a0, l1, a1, v, y] of HSR_BOX)
    for (let j = rowOf(a1); j <= rowOf(a0); j++)
      for (let lon = l0; lon <= l1; lon += RES) { const c = j * GW + colOf(lon); if (land[c] && rail[c]) put(c, v, y - 1900); }
  console.log('  + hand corridors', HSR_HAND.length, ' new cells', hc, ' total', hsrv.reduce((a, b) => a + (b ? 1 : 0), 0));
}

/* Jeremy Atack's historical transportation GIS (Vanderbilt, public): every
   American railway segment 1826-1911 with the year it was in operation by,
   and every steamboat-navigated river with the year navigation began. The
   model had no dated American network and took the country's single 1830
   opening year, so by 1850 the whole United States was on rail; the real
   figure is 8 570 track miles in 1850 against 180 557 in 1900, and where
   they were matters more than how many. tools/convert_atack.py reduces the
   shapefiles to this grid. 255 marks a cell inside the surveyed area that
   no line had reached by 1911, so it cannot fall back on the country rule. */
console.log('\u00b7 American rail and river years (Atack)');
const usrail = new Uint8Array(GN), usriv = new Uint8Array(GN);
{
  const p = 'data/atack_years.json';
  if (!fs.existsSync(p)) console.log('  no atack_years.json - run tools/convert_atack.py');
  else {
    const A = JSON.parse(fs.readFileSync(p, 'utf8'));
    const put = (arr, o) => { let n = 0; for (const k in o) { const y = o[k] - 1800; if (y > 0 && y < 255) { arr[+k] = y; n++; } } return n; };
    const nr = put(usrail, A.rail), nv = put(usriv, A.river);
    // the surveyed area: the contiguous states, so a cell the survey covers
    // and no line reached stays off the network rather than inheriting 1830
    let box = 0;
    for (let j = rowOf(49.4); j <= rowOf(24.5); j++)
      for (let lon = -125; lon <= -66.5; lon += RES) {
        const c = j * GW + colOf(lon);
        if (land[c] && !usrail[c]) { usrail[c] = 255; box++; }
      }
    console.log('  rail cells', nr, ' river cells', nv, ' surveyed but never reached', box);
  }
}

/* The Malaria Atlas Project's friction surface (Weiss et al. 2018, 2020):
   a 30 arc-second raster of minutes per metre for land travel, built from
   OSM roads, railways, rivers, land cover and slope. It measures what this
   model assembles from road class times country mean speed times terrain,
   Carried only where Natural Earth maps no road at all: blending it in
   everywhere was tried and measurably hurt both truth sets (the fastest
   pixel in a cell is an optimistic statistic and the routes chained those
   cells together), while filling the gaps with it is neutral on both and
   adds a road where there was none across 161 608 cells. km/h, 0 elsewhere.
   tools/harvest_map_friction.py fetches and reduces it. */
console.log('\u00b7 friction surface (Malaria Atlas Project)');
const mapf = new Uint8Array(GN);
{
  const p = 'data/map_friction.bin';
  if (!fs.existsSync(p)) console.log('  no map_friction.bin - run tools/harvest_map_friction.py');
  else {
    const buf = fs.readFileSync(p);
    /* Only the cells Natural Earth has no road for are kept: the measurement
       is used to fill those gaps and nothing else, so carrying the rest would
       be a third of a megabyte for nobody. Speeds are rounded to 5 km/h,
       which costs nothing at this cell size and packs far better. */
    let n = 0, sum = 0;
    for (let c = 0; c < GN; c++) {
      if (!land[c] || road[c] !== 0) continue;
      const f = buf[c];
      if (f < 20) continue;            // below this the terrain model already agrees
      mapf[c] = Math.min(250, Math.round(f / 10) * 10);
      n++; sum += f;
    }
    console.log('  cells with no mapped road but a measured one', n,
      ' mean', (sum / Math.max(1, n)).toFixed(1), 'km/h');
  }
}

/* What the real timetables say the model is getting wrong, cell by cell
   (tools/make_ota_layer.py). 100 means no adjustment. */
console.log('· timetable correction (Transitous one-to-all)');
const otaf = new Uint8Array(GN).fill(100);
{
  const p = 'data/ota_factor.bin';
  if (!fs.existsSync(p)) console.log('  no ota_factor.bin - run tools/make_ota_layer.py');
  else {
    otaf.set(fs.readFileSync(p));
    let n = 0; for (let c = 0; c < GN; c++) if (otaf[c] !== 100) n++;
    console.log('  cells corrected', n);
  }
}

const layers = { land: rle(land), ctry: rle(ctry), terr: rle(terr), road: rle(road), rail: rle(rail), ferry: rle(ferry),
  hsrv: rle(hsrv), hsry: rle(hsry), usrail: rle(usrail), usriv: rle(usriv), mapf: rle(mapf), otaf: rle(otaf) };
for (const k in layers) console.log('  ', k, (layers[k].length / 1024).toFixed(0) + ' KB');

fs.writeFileSync('grid.js',
  'window.GRID=' + JSON.stringify({ RES, GW, GH, names: cNames, layers, places, airports }) + ';\n');
console.log('grid.js', (fs.statSync('grid.js').size / 1024 / 1024).toFixed(2), 'MB');

/* render geometry: 50m land + country borders, as plain coordinate arrays */
const geoOut = {
  land: topoDecode(P('countries-50m.json'), 'land').flatMap(g => g.polys)
    .map(poly => poly.map(r => simplify(r, 0.04).map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]))),
  countries: c50.flatMap(c => c.polys)
    .map(poly => poly.map(r => simplify(r, 0.08).map(p => [+p[0].toFixed(2), +p[1].toFixed(2)])))
};
fs.writeFileSync('geo.js', 'window.GEO=' + JSON.stringify(geoOut) + ';\n');
console.log('geo.js', (fs.statSync('geo.js').size / 1024 / 1024).toFixed(2), 'MB');
