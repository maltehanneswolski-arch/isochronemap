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
console.log('  land cells', land.reduce((a, b) => a + b, 0), '=', (land.reduce((a, b) => a + b, 0) / GN * 100).toFixed(1) + '%');

console.log('· terrain regions (10m geography)');
const TMAP = { 'Range/mtn': 1, 'Plateau': 1, 'Desert': 2, 'Tundra': 4, 'Wetlands': 3, 'Delta': 3 };
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

console.log('· airports (10m)');
const ap = P('ne_10m_airports.geojson');
const airports = ap.features
  .filter(f => f.properties.featurecla === 'Airport' && !/spaceport/i.test(f.properties.type || ''))
  .map(f => ({ lon: +f.geometry.coordinates[0].toFixed(3), lat: +f.geometry.coordinates[1].toFixed(3),
    r: f.properties.scalerank, big: /major/i.test(f.properties.type || '') ? 1 : 0 }));
console.log('  airfields', airports.length, ' major', airports.filter(a => a.big).length,
  ' rank<=5', airports.filter(a => a.r <= 5).length);

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
const layers = { land: rle(land), ctry: rle(ctry), terr: rle(terr), road: rle(road), rail: rle(rail), ferry: rle(ferry) };
for (const k in layers) console.log('  ', k, (layers[k].length / 1024).toFixed(0) + ' KB');

fs.writeFileSync('grid.js',
  'window.GRID=' + JSON.stringify({ RES, GW, GH, names: cNames, layers, places, railDraw, airports }) + ';\n');
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
