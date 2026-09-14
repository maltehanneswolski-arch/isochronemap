/* Isochronic Globe — least-cost travel-time field over a 0.25° global grid
   built from real road, rail and ferry geometry, drawn as glowing isochrone
   bands on an orthographic globe. */
(function () {
  'use strict';
  const D = window.ISO, G = window.GRID;
  const TAU = Math.PI * 2, RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const R_EARTH = 6371;

  /* ================= grid ================= */
  const RES = G.RES, GW = G.GW, GH = G.GH, GN = GW * GH;
  const lonOf = i => -180 + (i + 0.5) * RES;
  const latOf = j => 90 - (j + 0.5) * RES;
  const colOf = lon => ((Math.floor((lon + 180) / RES) % GW) + GW) % GW;
  const rowOf = lat => Math.min(GH - 1, Math.max(0, Math.floor((90 - lat) / RES)));
  const cellOf = (lon, lat) => rowOf(lat) * GW + colOf(lon);

  function gcDist(lon1, lat1, lon2, lat2) {
    const p1 = lat1 * RAD, p2 = lat2 * RAD;
    const dp = (lat2 - lat1) * RAD, dl = (lon2 - lon1) * RAD;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /* ================= unpack the baked layers ================= */
  function unrle(b64) {
    const bin = atob(b64), out = new Uint8Array(GN);
    let p = 0, o = 0;
    while (p < bin.length) {
      const v = bin.charCodeAt(p++);
      let n = bin.charCodeAt(p++);
      if (n === 254) { n = bin.charCodeAt(p) | (bin.charCodeAt(p + 1) << 8); p += 2; }
      else if (n === 255) { n = bin.charCodeAt(p) | (bin.charCodeAt(p + 1) << 8) | (bin.charCodeAt(p + 2) << 16); p += 3; }
      out.fill(v, o, o + n); o += n;
    }
    return out;
  }
  const landMask = unrle(G.layers.land);
  const ctryRaw = unrle(G.layers.ctry);     // 0 = none, else index+1
  const terr = unrle(G.layers.terr);        // 0 open 1 mountain 2 desert 3 wet 4 tundra (5 ice added below)
  const roadCls = unrle(G.layers.road);     // 0..4
  const railCls = unrle(G.layers.rail);     // 0 none, 1 branch, 2 mainline
  const ferryCell = unrle(G.layers.ferry);

  /* ================= country profiles ================= */
  const CPROF = new Map(D.COUNTRY_RAW.map(r => [r[0], { ms: r[1], rq: r[2], ry: r[3], hy: r[4] }]));
  const NC = G.names.length;
  const cName = G.names;
  const cMS = new Float32Array(NC), cRQ = new Float32Array(NC), cRH = new Float32Array(NC);
  const cRY = new Int16Array(NC), cHY = new Int16Array(NC);
  const ALIAS = {
    'United States of America': 'United States of America', 'Dem. Rep. Congo': 'Dem. Rep. Congo',
    'Central African Rep.': 'Central African Rep.', 'Bosnia and Herz.': 'Bosnia and Herz.',
    'Dominican Rep.': 'Dominican Rep.', 'Eq. Guinea': 'Eq. Guinea', 'S. Sudan': 'S. Sudan',
    'Falkland Is.': 'Falkland Is.', 'Solomon Is.': 'Solomon Is.', 'N. Cyprus': 'N. Cyprus',
    'Fr. S. Antarctic Lands': 'Fr. S. Antarctic Lands', 'W. Sahara': 'W. Sahara',
    'Macedonia': 'Macedonia', 'North Macedonia': 'Macedonia', 'Czechia': 'Czechia',
    'Czech Rep.': 'Czechia', 'Swaziland': 'eSwatini', 'eSwatini': 'eSwatini',
    'Timor-Leste': 'Timor-Leste', 'Côte d’Ivoire': "Côte d'Ivoire", 'Lao PDR': 'Laos',
    'Korea': 'South Korea', 'Dem. Rep. Korea': 'North Korea', 'Br. Indian Ocean Ter.': 'Somalia'
  };
  cName.forEach((n, i) => {
    const key = ALIAS[n] || n;
    const p = CPROF.get(key) || CPROF.get(n) || { ms: 65, rq: 0.08, ry: 9999, hy: 9999 };
    cMS[i] = p.ms; cRQ[i] = p.rq; cRY[i] = p.ry; cHY[i] = p.hy;
    cRH[i] = D.RAIL_HIST[key] !== undefined ? D.RAIL_HIST[key] : p.rq;
  });
  const ctryOf = c => ctryRaw[c] - 1;    // -1 when unassigned

  /* ================= hand-authored overlays ================= */
  const river = new Uint8Array(GN);
  const trunkYear = new Int16Array(GN).fill(9999);
  const hsrMask = new Uint8Array(GN);
  const canalYear = new Int16Array(GN);
  const linkYear = new Int16Array(GN);

  const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

  function stamp(pts, fn, step) {
    step = step || RES * 0.4;
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let s = 0; s <= n; s++) fn(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n);
    }
  }
  function inEllipse(lon, lat, e) {
    let dl = lon - e[0];
    while (dl > 180) dl -= 360; while (dl < -180) dl += 360;
    const a = dl / e[2], b = (lat - e[1]) / e[3];
    return a * a + b * b <= 1;
  }

  function bakeOverlays() {
    for (const s of D.STRAITS) landMask[cellOf(s[0], s[1])] = 0;
    for (const cut of D.WATER_CUTS) stamp(cut, (lo, la) => { landMask[cellOf(lo, la)] = 0; }, RES * 0.3);
    // rainforest and ice are not in the Natural Earth region set
    for (let j = 0; j < GH; j++) {
      const lat = latOf(j);
      for (let i = 0; i < GW; i++) {
        const c = j * GW + i;
        if (!landMask[c]) continue;
        const lon = lonOf(i);
        if (lat < -62 || inEllipse(lon, lat, [-42, 72, 14, 8])) { terr[c] = 5; continue; }
        if (terr[c]) continue;
        for (const e of D.RAINFOREST) if (inEllipse(lon, lat, e)) { terr[c] = 3; break; }
      }
    }
    for (const r of D.RIVERS) stamp(r, (lo, la) => { const c = cellOf(lo, la); if (landMask[c]) river[c] = 1; });
    for (const ln of D.RAIL_LINES)
      stamp(ln.p, (lo, la) => { const c = cellOf(lo, la); if (landMask[c] && ln.y < trunkYear[c]) trunkYear[c] = ln.y; });
    for (const [l0, a0, l1, a1] of D.HSR_REGIONS)
      for (let j = rowOf(a1); j <= rowOf(a0); j++)
        for (let lon = l0; lon <= l1; lon += RES) {
          const c = j * GW + colOf(lon);
          if (landMask[c] && railCls[c]) hsrMask[c] = 1;
        }
    for (const ln of D.HSR_LINES) stamp(ln, (lo, la) => { const c = cellOf(lo, la); if (landMask[c]) hsrMask[c] = 1; });
    for (const cn of D.CANALS) stamp(cn.pts, (lo, la) => {
      const c = cellOf(lo, la); canalYear[c] = cn.year; ferryCell[c] = 1;
    }, RES * 0.25);
    for (const fl of D.FIXED_LINKS) stamp(fl.pts, (lo, la) => { linkYear[cellOf(lo, la)] = fl.year; }, RES * 0.25);
    for (const r of D.FERRY_ROUTES) stamp(r, (lo, la) => { ferryCell[cellOf(lo, la)] = 1; }, RES * 0.25);
  }

  const distTab = new Float32Array(GH * 8);
  function bakeDist() {
    for (let j = 0; j < GH; j++) for (let d = 0; d < 8; d++) {
      const jj = j + DIRS[d][1];
      distTab[j * 8 + d] = (jj < 0 || jj >= GH) ? 0 : gcDist(0, latOf(j), DIRS[d][0] * RES, latOf(jj));
    }
  }

  function landCellOf(lon, lat) {
    const c = cellOf(lon, lat);
    if (landMask[c]) return c;
    const j0 = rowOf(lat), i0 = colOf(lon);
    let best = -1, bd = Infinity;
    for (let dj = -3; dj <= 3; dj++) {
      const jj = j0 + dj; if (jj < 0 || jj >= GH) continue;
      for (let di = -3; di <= 3; di++) {
        const ii = (i0 + di + GW) % GW, cc = jj * GW + ii;
        if (!landMask[cc]) continue;
        const d = gcDist(lon, lat, lonOf(ii), latOf(jj));
        if (d < bd) { bd = d; best = cc; }
      }
    }
    return best >= 0 ? best : c;
  }

  /* ================= speed field ================= */
  const byId = {};
  D.MODES.forEach(m => { byId[m.id] = m; });

  /* A cell's land speed depends only on (country, terrain, road class, rail
     state), so all 21 690 combinations are solved once into a lookup table
     rather than a million times inside the loop. */
  function buildSpeed(mi, ei) {
    const M = D.MODES[mi], yr = D.ERAS[ei].y, best = !!M.best;
    const sp = new Float32Array(GN), duty = new Uint8Array(GN), wet = new Uint8Array(GN);
    const netW = D.NET_W[ei], CM = D.CLASS_MUL, circ = D.ROAD_CIRC;
    const oceanOK = M.sea === 'ship';
    const seaBase = D.WATER[ei] * (M.rail ? D.WATER_SCHEDULED[ei] : 1);
    const fry = D.FERRY[ei], ice = D.ICE_WATER[ei], riv = D.RIVER[ei] / D.RIVER_CIRC;
    const ids = best ? D.MODES.filter(m => !m.best && !m.air && m.since <= ei).map(m => m.id) : [M.id];
    const tDuty = byId.transit.duty[ei];
    const railBase = D.RAIL[ei], hsrBase = D.HSR[ei];
    const railMode = M.rail || best;

    const rf = new Float32Array(5), rfB = new Float32Array(5), rfF = new Float32Array(5);
    for (let c = 0; c < 5; c++) {
      rf[c] = 1 + (CM[c] - 1) * netW;
      rfB[c] = 1 + (D.BIKE_MUL[c] - 1) * netW;
      rfF[c] = 1 + (D.FOOT_MUL[c] - 1) * netW;
    }
    const tmul = new Float32Array(6);
    for (let t = 0; t < 6; t++) tmul[t] = D.TERRAIN_MUL[t][ei];

    const NK = NC + 1;                              // last slot = unclaimed land
    const qual = new Float32Array(NK), rqA = new Float32Array(NK);
    const ryA = new Int16Array(NK), hsrA = new Uint8Array(NK);
    for (let k = 0; k < NK; k++) {
      const ms = k < NC ? cMS[k] : 60;
      qual[k] = Math.pow(ms / D.ROAD_REF, D.ROAD_EXP[ei]);
      rqA[k] = k < NC ? (ei === 4 ? cRQ[k] : cRH[k]) : 0;
      ryA[k] = k < NC ? cRY[k] : 9999;
      hsrA[k] = k < NC && yr >= cHY[k] ? 1 : 0;
    }

    // lookup[((k*6 + terrain)*5 + roadClass)*3 + railState]
    const LN = NK * 90;
    const luS = new Float32Array(LN), luD = new Uint8Array(LN);
    for (let k = 0; k < NK; k++) {
      const q = qual[k], rq = rqA[k], hsrOn = hsrA[k];
      for (let t = 0; t < 6; t++) {
        const tm = tmul[t], soft = 0.5 + 0.5 * tm;
        for (let rc = 0; rc < 5; rc++) {
          const rfv = rf[rc], rfv2 = rfB[rc], rfv3 = rfF[rc];
          for (let rs = 0; rs < 3; rs++) {
            let v = 0, vd = tDuty;
            for (let m = 0; m < ids.length; m++) {
              const id = ids[m], MM = byId[id], d = MM.duty[ei], base = MM.land[ei];
              let kmd;
              if (id === 'foot') kmd = base * (0.80 + 0.20 * q) * tm * rfv3 / circ;
              else if (id === 'bike') kmd = base * (0.25 + 0.75 * q) * tm * rfv2 / circ;
              else if (id === 'road') kmd = base * q * tm * rfv / circ;
              else {
                kmd = base * (0.20 + 0.80 * q) * tm * rfv / circ;
                if (rs && railBase > 0 && rq > 0) {
                  let r = railBase * rq * soft * (rs === 2 ? D.RAIL_MAIN : D.RAIL_BRANCH);
                  if (hsrOn) r *= D.HSR_NET_BONUS;
                  if (id === 'air') r *= 0.8;
                  r /= D.RAIL_CIRC;
                  if (r > kmd) kmd = r;
                }
              }
              if (kmd / d > v / vd) { v = kmd; vd = d; }
            }
            const o = ((k * 6 + t) * 5 + rc) * 3 + rs;
            luS[o] = v / vd; luD[o] = vd;
          }
        }
      }
    }
    const hsrSpeed = new Float32Array(NK);
    for (let k = 0; k < NK; k++)
      hsrSpeed[k] = (hsrBase > 0 && hsrA[k] && railMode) ? hsrBase * Math.max(rqA[k], 0.7) / D.RAIL_CIRC / tDuty : 0;
    const rivSpeed = oceanOK ? riv / D.SEA_DUTY : 0;

    for (let j = 0; j < GH; j++) {
      const lat = latOf(j);
      let icef = 0;
      if (lat > 70) icef = 1; else if (lat > 62) icef = (lat - 62) / 8;
      if (lat < -58) icef = 1; else if (lat < -50) icef = (-50 - lat) / 8;
      const sea = (Math.max(seaBase, fry) * (1 - icef) + ice * icef) / 24;
      const fer = (fry * (1 - icef) + ice * icef) / 24;
      const row = j * GW;
      for (let i = 0; i < GW; i++) {
        const c = row + i;
        let isW = landMask[c] === 0;
        const cy = canalYear[c];
        if (cy) isW = yr >= cy;
        const ly = linkYear[c];
        if (ly && yr >= ly) isW = false;
        if (isW) {
          wet[c] = 1; duty[c] = D.SEA_DUTY;
          sp[c] = oceanOK ? sea : (ferryCell[c] ? fer : 0);
          continue;
        }
        wet[c] = 0;
        let k = ctryRaw[c] - 1;
        if (k < 0) k = NC;
        const rc = railCls[c], tk = trunkYear[c];
        let rs = 0;
        if (railBase > 0) {
          if (tk <= yr) rs = 2;
          else if (rc && yr >= (rc === 2 ? ryA[k] : ryA[k] + 25)) rs = rc;
        }
        const o = ((k * 6 + terr[c]) * 5 + roadCls[c]) * 3 + rs;
        let v = luS[o], vd = luD[o];
        if (hsrMask[c] && hsrSpeed[k] > v) { v = hsrSpeed[k]; vd = tDuty; }
        if (rivSpeed && river[c] && rivSpeed > v) { v = rivSpeed; vd = D.SEA_DUTY; }
        sp[c] = v; duty[c] = vd;
      }
    }
    // half-reciprocal speed, so the inner loop adds instead of dividing
    const inv = new Float32Array(GN);
    for (let c = 0; c < GN; c++) inv[c] = sp[c] > 0 ? 0.5 / sp[c] : 0;
    return { sp, duty, wet, inv };
  }

  /* ================= the field =================
     Dial's algorithm: a bucketed queue in place of a binary heap, which is
     what makes a million-cell search feel instant. */
  const NBUK = 600000;
  const bHead = new Int32Array(NBUK);
  let bNext = null, bPrev = null, bBuk = null, bDone = null;

  function computeField(oLon, oLat, mi, ei) {
    const M = D.MODES[mi], { sp, duty, wet, inv } = buildSpeed(mi, ei);
    const port = D.PORT_H[ei];
    // duty hours only ever take a handful of values, so 24/dEdge is a table
    const restTab = new Float32Array(49);
    for (let s = 1; s <= 48; s++) restTab[s] = 48 / s;   // 24 / (s/2)
    const flying = M.air && !!D.AIR[ei];
    const ports = flying ? G.airports.filter(a => a.r <= D.AIR_RANK[ei]) : [];
    const NA = ports.length, total = GN + NA;
    const air = flying ? D.AIR[ei] : null;
    const airAt = new Map();
    ports.forEach((c, k) => airAt.set(landCellOf(c.lon, c.lat), k));

    const L = S.ladder;
    const w = L[L.length - 1] * 3 / NBUK;

    const dist = new Float32Array(total).fill(Infinity);
    const move = new Float32Array(total).fill(0);
    if (!bNext || bNext.length < total) {
      bNext = new Int32Array(total + 64); bPrev = new Int32Array(total + 64);
      bBuk = new Int32Array(total + 64); bDone = new Uint8Array(total + 64);
    } else bDone.fill(0);
    bBuk.fill(-1);
    bHead.fill(-1);

    let cur = 0;
    const invW = 1 / w;
    /* A node may be reached again at a lower cost, so it has to move buckets
       rather than be inserted twice — one `next` pointer per node cannot hold
       two list positions, and the chain closes into a cycle if it tries. */
    const unlink = node => {
      const b = bBuk[node];
      if (b < 0) return;
      const p = bPrev[node], n = bNext[node];
      if (p >= 0) bNext[p] = n; else bHead[b] = n;
      if (n >= 0) bPrev[n] = p;
      bBuk[node] = -1;
    };
    const push = (cost, node) => {
      let b = (cost * invW) | 0;
      if (b >= NBUK) b = NBUK - 1;
      if (b < cur) b = cur;
      if (bBuk[node] === b) return;
      unlink(node);
      bPrev[node] = -1; bNext[node] = bHead[b];
      if (bHead[b] >= 0) bPrev[bHead[b]] = node;
      bHead[b] = node; bBuk[node] = b;
    };

    const start = landCellOf(oLon, oLat);
    dist[start] = 0; move[start] = 0; push(0, start);

    for (;;) {
      while (cur < NBUK && bHead[cur] < 0) cur++;
      if (cur >= NBUK) break;
      const u = bHead[cur];
      unlink(u);
      if (bDone[u]) continue;
      bDone[u] = 1;
      const du = dist[u], mu = move[u];
      if (u < GN) {
        const iu = inv[u];
        if (iu > 0) {
          const j = (u / GW) | 0, i = u - j * GW, dj0 = j * 8;
          const dU = duty[u], wu = wet[u];
          for (let d = 0; d < 8; d++) {
            const jj = j + DIRS[d][1];
            if (jj < 0 || jj >= GH) continue;
            const v = jj * GW + ((i + DIRS[d][0] + GW) % GW);
            if (bDone[v]) continue;
            const iv = inv[v];
            if (iv <= 0) continue;
            const mEdge = distTab[dj0 + d] * (iu + iv);
            const dsum = dU + duty[v], dEdge = dsum * 0.5;
            const m1 = mu + mEdge;
            let add;
            if (m1 <= dEdge) add = mEdge;
            else {
              const rest = restTab[dsum];
              add = mu >= dEdge ? mEdge * rest : (dEdge - mu) + (m1 - dEdge) * rest;
            }
            let nc = du + add;
            if (wu !== wet[v]) nc += port * ((ferryCell[u] || ferryCell[v]) ? D.FERRY_PORT : 1);
            if (nc < dist[v]) { dist[v] = nc; move[v] = m1; push(nc, v); }
          }
        }
        if (air && airAt.has(u)) {
          const v = GN + airAt.get(u), nc = du + air.board;
          if (nc < dist[v]) { dist[v] = nc; move[v] = mu; push(nc, v); }
        }
      } else {
        const a = u - GN, A = ports[a];
        const gcell = landCellOf(A.lon, A.lat), ncg = du + air.land;
        if (ncg < dist[gcell]) { dist[gcell] = ncg; move[gcell] = mu; push(ncg, gcell); }
        for (let b = 0; b < NA; b++) {
          if (b === a) continue;
          const B = ports[b], km = gcDist(A.lon, A.lat, B.lon, B.lat);
          if (km > air.range) continue;
          const v = GN + b, nc = du + km / air.cruise + air.stop;
          if (nc < dist[v]) { dist[v] = nc; move[v] = mu; push(nc, v); }
        }
      }
    }
    return { dist, ports, start };
  }

  /* ================= formatting ================= */
  function fmtDur(h) {
    if (!isFinite(h)) return '—';
    if (h < 1) return Math.round(h * 60) + ' min';
    if (h < 10) return (Math.round(h * 10) / 10) + ' h';
    if (h < 48) return Math.round(h) + ' h';
    const d = h / 24;
    if (d < 3) return (Math.round(d * 10) / 10) + ' d';
    if (d <= 45) return Math.round(d) + ' d';
    if (d < 330) return (Math.round(d / 30.44 * 2) / 2) + ' mo';
    return (Math.round(d / 365.25 * 10) / 10) + ' yr';
  }
  function fmtBand(h) {
    if (h < 1) return Math.round(h * 60) + ' min';
    if (h < 24) return (h % 1 ? h.toFixed(1) : h) + ' h';
    const d = h / 24;
    if (d <= 45) return d + ' d';
    if (d <= 330) return (Math.round(d / 30.44 * 2) / 2) + ' mo';
    return (Math.round(d / 365.25 * 10) / 10) + ' yr';
  }
  const fmtKm = k => {
    const v = k >= 1000 ? Math.round(k / 10) * 10 : Math.round(k);
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km';
  };

  function ladderFor() { return D.LADDERS.base; }

  /* ================= render geometry ================= */
  const LANDGEO = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: window.GEO.land } };
  const BORDERS = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: window.GEO.countries } };
  const RAILGEO = { type: 'MultiLineString', coordinates: G.railDraw };
  /* A lighter copy of the coastline for use while the globe is in motion.
     Keeping every third point is still three times cheaper to project, but
     unlike a harsher decimation it leaves Greenland looking like Greenland. */
  const LANDLO = {
    type: 'Feature', geometry: {
      type: 'MultiPolygon',
      coordinates: window.GEO.land.map(poly => poly.map(ring => {
        if (ring.length <= 24) return ring;
        const out = [];
        for (let i = 0; i < ring.length - 1; i += 3) out.push(ring[i]);
        out.push(ring[ring.length - 1]);
        return out;
      })).filter(p => p.length)
    }
  };
  const PLACES = G.places;
  const TW = new Map();   // cached label widths

  /* The interface is black; only the band palette changes. */
  const TH = () => ({
    sea0: '#081120', sea1: '#04080F', sea2: '#020407', land: '#141E2B',
    coastHalo: 'rgba(2,5,10,.5)', coast: 'rgba(198,220,250,.62)',
    border: 'rgba(168,196,236,.34)', borderHalo: 'rgba(2,5,10,.45)',
    grat: 'rgba(126,158,205,.08)', rail: 'rgba(206,222,246,.42)',
    dot: 'rgba(240,246,255,.92)', dotSmall: 'rgba(186,204,232,.6)',
    label: 'rgba(228,236,250,.95)', labelSmall: 'rgba(186,201,226,.74)',
    labelHalo: 'rgba(4,7,14,.85)', limb: 'rgba(140,180,240,.22)',
    origin: 'rgba(255,255,255,.95)', originRing: '255,255,255', originDot: '#FFFFFF',
    blend: 'screen', glow: true, stars: true
  });
  const rampOf = () => D.PALETTES[S.palette].ramp;

  /* ================= state ================= */
  const S = {
    mode: 0, era: 0,
    origin: { lon: -0.13, lat: 51.51, name: 'London' },
    rotL: 0.13, rotP: -51.51, scale: 300,
    field: null, ref: null, ladder: D.LADDERS.base,
    reveal: 99, dragging: false, tBuf: null, tKey: '', net: true, palette: 0
  };

  /* ================= canvas ================= */
  const sky = document.getElementById('sky'), skyC = sky.getContext('2d');
  const cv = document.getElementById('globe'), ctx = cv.getContext('2d');
  const buf = document.createElement('canvas'), bufC = buf.getContext('2d');
  let Wc = 0, Hc = 0, DPR = 1, cx = 0, cy = 0;

  const proj = d3.geoOrthographic().clipAngle(90);
  const path = d3.geoPath(proj, ctx);
  const pathStr = d3.geoPath(proj);          // same projection, returns SVG data
  /* Re-projecting the vector layers on every draw was the whole cost of a
     frame. Project once per view and keep the Path2D, so a fill, a wash and a
     stroke of the same coastline cost one projection between them. */
  const vec = { key: '' };
  function layer(name, geo) {
    const key = [Math.round(S.scale * 10), Math.round(S.rotL * 100),
      Math.round(S.rotP * 100), Math.round(cx), Math.round(cy)].join(',');
    if (vec.key !== key) { for (const k in vec) if (k !== 'key') delete vec[k]; vec.key = key; }
    if (!vec[name]) { const d = pathStr(geo); vec[name] = d ? new Path2D(d) : null; }
    return vec[name];
  }

  function stageSize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    Wc = window.innerWidth; Hc = window.innerHeight;
    for (const c of [sky, cv]) { c.width = Wc * DPR; c.height = Hc * DPR; }
    skyC.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = Wc * 0.5; cy = Hc * (Wc > 900 ? 0.5 : 0.42);
    const fit = Math.min(Wc * 0.84, Hc * 0.84) / 2;
    if (!S.fitted) { S.scale = fit; S.fitted = true; }
    else S.scale = Math.max(fit * 0.78, Math.min(S.scale, fit * 12));
    S.fit = fit;
    drawSky(); S.tKey = ''; draw();
  }

  function drawSky() {
    const T = TH();
    skyC.clearRect(0, 0, Wc, Hc);
    skyC.fillStyle = T.paper; skyC.fillRect(0, 0, Wc, Hc);
    if (!T.stars) return;
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const n = Math.round(Wc * Hc / 5200);
    for (let k = 0; k < n; k++) {
      const x = rnd() * Wc, y = rnd() * Hc, m = rnd();
      const r = m > .97 ? 1.35 : m > .85 ? .95 : .6;
      skyC.globalAlpha = 0.1 + m * 0.5;
      skyC.fillStyle = m > .93 ? '#CBD8F0' : '#8FA2C4';
      skyC.beginPath(); skyC.arc(x, y, r, 0, TAU); skyC.fill();
    }
    skyC.globalAlpha = 1;
  }

  /* ---- the ladder follows the view ----------------------------------
     A fixed set of thresholds makes a continent look like one flat blob and a
     single country like nothing at all. Instead, sample what is actually on
     screen and lay twelve round numbers across that range — so zooming into
     France in 1900 gives hourly contours fingering along the railways, the way
     E. Martin drew them in 1882, while the whole globe still reads in weeks. */
  const NICE = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 18, 24, 36, 48, 72, 96, 120,
    168, 240, 336, 504, 720, 1080, 1440, 2160, 2880, 4320, 5760, 8760, 13140, 17520, 26280];

  function makeLadder(maxT) {
    const n = D.RAMP.length;
    const lo = Math.max(NICE[0], maxT / 260);
    const out = [];
    for (let k = 1; k <= n; k++) {
      const target = lo * Math.pow(maxT / lo, k / n);
      let best = -1;
      for (let q = 0; q < NICE.length; q++) {
        const v = NICE[q];
        if (out.length && v <= out[out.length - 1]) continue;
        if (best < 0 || Math.abs(Math.log(v / target)) < Math.abs(Math.log(best / target))) best = v;
      }
      if (best < 0) break;
      out.push(best);
    }
    let q = NICE.indexOf(out[out.length - 1]);
    while (out.length < n && ++q < NICE.length) out.push(NICE[q]);
    while (out.length < n) out.push(out[out.length - 1] * 2);
    return out;
  }

  /* costs at the 88th percentile of what the viewer can currently see */
  function viewLadder() {
    const dist = S.field && S.field.dist;
    if (!dist) return S.ladder;
    const r = S.scale, N = 90;
    const x0 = Math.max(0, cx - r), x1 = Math.min(Wc, cx + r);
    const y0 = Math.max(0, cy - r), y1 = Math.min(Hc, cy + r);
    const cosP = Math.cos(S.rotP * RAD), sinP = Math.sin(S.rotP * RAD);
    const vals = [];
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const X = (x0 + (a + 0.5) * (x1 - x0) / N - cx) / r;
      const Y = -(y0 + (b + 0.5) * (y1 - y0) / N - cy) / r;
      const d2 = X * X + Y * Y;
      if (d2 > 1) continue;
      const Z = Math.sqrt(1 - d2);
      const lat = Math.asin(Math.max(-1, Math.min(1, Y * cosP - Z * sinP))) * DEG;
      let lon = Math.atan2(X, Y * sinP + Z * cosP) * DEG - S.rotL;
      lon = ((lon + 180) % 360 + 360) % 360 - 180;
      const v = dist[cellOf(lon, lat)];
      if (v > 0 && v < Infinity) vals.push(v);
    }
    if (vals.length < 30) return S.ladder;
    vals.sort((p, q) => p - q);
    const hi = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.97))];
    return makeLadder(Math.max(hi, NICE[0] * 12));
  }

  function refreshLadder() {
    /* Re-deriving the bands from whatever happens to be on screen made the
       colours crawl as the globe turned. Rotation must never change them:
       the scale is keyed to the field itself and to a quantised zoom step,
       so it settles once and then holds still while you look around. */
    const z = Math.round(Math.log2(Math.max(0.4, S.scale / (S.fit || S.scale))) * 3);
    const key = (S.fieldGen || 0) + '|' + z;
    if (key === S.ladderKey) return false;
    S.ladderKey = key;
    const L = viewLadder();
    if (L.join() === S.ladder.join()) return false;
    S.ladder = L; S.tKey = '';
    if (S.legendReady) updateLegend();
    return true;
  }

  function bandT(c, L) {
    if (!(c < Infinity)) return 1e9;
    if (c <= L[0]) return c / L[0];
    for (let k = 1; k < L.length; k++)
      if (c <= L[k]) return k + (c - L[k - 1]) / (L[k] - L[k - 1]);
    return L.length + (c - L[L.length - 1]) / L[L.length - 1];
  }

  function drawField() {
    const dist = S.field && S.field.dist;
    if (!dist) return;
    const r = S.scale;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(Wc, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(Hc, Math.ceil(cy + r));
    const rw = x1 - x0, rh = y1 - y0;
    if (rw <= 2 || rh <= 2) return;

    // sample at the display's own resolution so the wash is smooth rather
    // than an upscaled low-res image
    const target = S.dragging ? 170
      : Math.min(950, Math.max(rw, rh) * 1.05 * Math.min(1.3, DPR));
    const lon0 = S.rotL, phi = S.rotP * RAD;
    const key = [S.fieldGen | 0, x0, y0, rw, rh, Math.round(r * 10), Math.round(S.rotL * 100), Math.round(S.rotP * 100), Math.round(target)].join(',');

    if (key !== S.tKey) {
      const bw = Math.max(8, Math.round(target * rw / Math.max(rw, rh)));
      const bh = Math.max(8, Math.round(target * rh / Math.max(rw, rh)));
      const need = bw * bh;
      if (!S.scratch || S.scratch.n < need)
        S.scratch = { n: need, t: new Float32Array(need), lnd: new Uint8Array(need) };
      const t = S.scratch.t, lnd = S.scratch.lnd;
      const cosP = Math.cos(phi), sinP = Math.sin(phi);
      const L = S.ladder;
      for (let by = 0; by < bh; by++) {
        const sy = y0 + (by + 0.5) * rh / bh, Y = -(sy - cy) / r, Y2 = Y * Y;
        for (let bx = 0; bx < bw; bx++) {
          const p = by * bw + bx;
          const sx = x0 + (bx + 0.5) * rw / bw, X = (sx - cx) / r;
          const d2 = X * X + Y2;
          if (d2 > 1) { t[p] = -1; continue; }
          const Z = Math.sqrt(1 - d2);
          const a = Y * cosP - Z * sinP, b = Y * sinP + Z * cosP;
          const lat = Math.asin(Math.max(-1, Math.min(1, a))) * DEG;
          let lon = Math.atan2(X, b) * DEG - lon0;
          lon = ((lon + 180) % 360 + 360) % 360 - 180;
          const fi = (lon + 180) / RES - 0.5, fj = (90 - lat) / RES - 0.5;
          const i0 = Math.floor(fi), j0 = Math.min(GH - 2, Math.max(0, Math.floor(fj)));
          const u = fi - i0, v = Math.min(1, Math.max(0, fj - j0));
          const ia = ((i0 % GW) + GW) % GW, ib = (ia + 1) % GW;
          const c00 = dist[j0 * GW + ia], c10 = dist[j0 * GW + ib];
          const c01 = dist[(j0 + 1) * GW + ia], c11 = dist[(j0 + 1) * GW + ib];
          const cc = (c00 * (1 - u) + c10 * u) * (1 - v) + (c01 * (1 - u) + c11 * u) * v;
          t[p] = bandT(cc, L);
          lnd[p] = landMask[(v < 0.5 ? j0 : j0 + 1) * GW + (u < 0.5 ? ia : ib)];
        }
      }
      S.tBuf = { t, lnd, bw, bh, x0, y0, rw, rh };
      S.tKey = key;
    }

    const { t, lnd, bw, bh } = S.tBuf;
    const NB = rampOf().length, rev = S.reveal;
    const bKey = (S.fieldGen | 0) + '|' + S.palette + '|' + S.tKey + '|' + (rev >= NB ? 'full' : rev.toFixed(3));
    if (bKey === S.bufKey) { blit(); return; }
    S.bufKey = bKey;
    if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }
    let img = S.img;
    if (!img || img.width !== bw || img.height !== bh) { img = S.img = bufC.createImageData(bw, bh); }
    const px = img.data;
    px.fill(0);
    const R = rampOf(), SEA = D.SEA_TINT, SW = D.SEA_MIX, SAT = D.SATURATE, A0 = D.FIELD_ALPHA;
    const LW = D.LINE_WIDTH, LS = D.LINE_STRENGTH, BEY = D.BEYOND_ALPHA;
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        const p = by * bw + bx, o = p * 4;
        let tv = t[p];
        if (tv < 0 || tv > rev) continue;
        // Past the last threshold the ground used to be left bare, which is why
        // Greenland showed up as a black hole. Hold it at the far end of the
        // ramp instead, dimmed, so it still belongs to the scheme.
        let beyond = 0;
        if (tv >= NB) {
          // Clamping everything past the last threshold to one flat colour left
          // Greenland and the pack ice as slabs. Carry the ramp onward into a
          // darker continuation instead, so it fades rather than patches.
          beyond = Math.min(1, (tv - NB) / 5);
          tv = NB - 0.0001;
        }
        const band = tv | 0, f = tv - band;
        const c0 = R[band], c1 = R[band + 1 < NB ? band + 1 : NB - 1];
        let cr = c0[0] + (c1[0] - c0[0]) * f;
        let cg = c0[1] + (c1[1] - c0[1]) * f;
        let cb = c0[2] + (c1[2] - c0[2]) * f;
        const l = (Math.max(cr, cg, cb) + Math.min(cr, cg, cb)) * 0.5;
        cr = l + (cr - l) * SAT; cg = l + (cg - l) * SAT; cb = l + (cb - l) * SAT;
        if (beyond) { const k = 1 - beyond * 0.45; cr *= k; cg *= k; cb *= k; }
        let a = A0 * (1 - beyond * (1 - BEY));

        // an isochrone on every threshold, and a fainter one mid-band
        let line = 0;
        if (beyond < 0.02 && !S.dragging) {   // lines cost a gradient; restore them at rest
          const xm = t[p - (bx > 0 ? 1 : 0)], xp = t[p + (bx < bw - 1 ? 1 : 0)];
          const ym = t[p - (by > 0 ? bw : 0)], yp = t[p + (by < bh - 1 ? bw : 0)];
          const gx = (xm < 0 || xp < 0) ? 0 : (xp - xm) * 0.5;
          const gy = (ym < 0 || yp < 0) ? 0 : (yp - ym) * 0.5;
          const g = Math.max(Math.hypot(gx, gy), 1e-3);
          const dmin = f < 0.5 ? f : 1 - f;
          let maj = 1 - dmin / (g * LW);
          maj = maj > 1 ? 1 : maj < 0 ? 0 : maj;
          const hm = f < 0.5 ? 0.5 - f : f - 0.5;
          let mid = 1 - hm / (g * LW * 0.8);
          mid = mid > 1 ? 1 : mid < 0 ? 0 : mid;
          line = Math.max(maj * maj, mid * mid * 0.45);
        }

        if (!lnd[p]) {                       // water in a cooler hue
          cr += (SEA[0] - cr) * SW; cg += (SEA[1] - cg) * SW; cb += (SEA[2] - cb) * SW;
          a *= 0.84;
        }
        if (line > 0) {
          const w = line * LS;
          cr += (255 - cr) * w; cg += (255 - cg) * w; cb += (255 - cb) * w;
          a += line * 0.22;
        }
        px[o] = cr < 0 ? 0 : cr > 255 ? 255 : cr;
        px[o + 1] = cg < 0 ? 0 : cg > 255 ? 255 : cg;
        px[o + 2] = cb < 0 ? 0 : cb > 255 ? 255 : cb;
        px[o + 3] = (a > 1 ? 1 : a) * (rev < NB ? Math.max(0, Math.min(1, (rev - tv) * 2.2)) : 1) * 255;
      }
    }
    bufC.putImageData(img, 0, 0);
    blit();

    function blit() {
      const { x0: dx, y0: dy, rw: dw, rh: dh } = S.tBuf;
      ctx.save();
      // 'screen' blending over a retina-scaled canvas costs most of a frame,
      // and it washes the tints toward white. Plain alpha is both quicker and
      // more saturated; the bloom below still uses screen, but only at rest.
      ctx.globalCompositeOperation = S.dragging ? 'source-over' : TH().blend;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = S.dragging ? 'low' : 'high';
      if (!S.dragging && TH().glow) {
        const zoom = S.scale / (S.fit || S.scale);
        try {
          ctx.filter = 'blur(' + (zoom > 2 ? 3 : 5) + 'px)';
          ctx.globalAlpha = zoom > 2 ? 0.14 : 0.22;
          ctx.drawImage(buf, dx, dy, dw, dh);
          ctx.filter = 'none';
        } catch (e) { /* no filter support */ }
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(buf, dx, dy, dw, dh);
      ctx.restore();
    }
  }


  /* ---- main draw ---- */
  function draw() {
    const r = S.scale, zoom = r / (S.fit || r);
    if (!S.dragging) refreshLadder();
    proj.translate([cx, cy]).scale(r).rotate([S.rotL, S.rotP, 0]);
    ctx.clearRect(0, 0, Wc, Hc);

    const T = TH();
    if (T.glow && !S.dragging) {
      const atm = ctx.createRadialGradient(cx, cy, r * 0.97, cx, cy, r * 1.16);
      atm.addColorStop(0, 'rgba(90,140,210,.30)'); atm.addColorStop(1, 'rgba(90,140,210,0)');
      ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, r * 1.16, 0, TAU); ctx.fill();
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(90,78,50,.3)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 3;
      ctx.fillStyle = T.sea1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.restore();
    }

    const oc = ctx.createRadialGradient(cx - r * .28, cy - r * .32, r * .05, cx, cy, r);
    oc.addColorStop(0, T.sea0); oc.addColorStop(.62, T.sea1); oc.addColorStop(1, T.sea2);
    ctx.fillStyle = oc; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();

    const landPath = layer(S.dragging ? 'landLo' : 'land', S.dragging ? LANDLO : LANDGEO);
    if (landPath) { ctx.fillStyle = T.land; ctx.fill(landPath); }

    drawField();

    /* The bands are screen-blended, which flattens land against sea wherever
       they are bright. Wash the continents back over the top so the geography
       still reads underneath the glow. */
    // Lift the continents back out of the glow. This runs over the whole of
    // the land, reached or not, so a country you cannot get to at all still
    // reads as a country rather than as more ocean.
    if (!S.dragging && landPath) {
      ctx.save();
      ctx.fillStyle = 'rgba(146,182,236,.055)'; ctx.fill(landPath);
      ctx.restore();
    }


    const M = D.MODES[S.mode], yr = D.ERAS[S.era].y;

    // the network that shapes the contours
    if (S.net && !S.dragging && zoom > 1.2 && (M.rail || M.best) && D.RAIL[S.era] > 0) {
      const rp = layer('rail', RAILGEO);
      ctx.globalAlpha = Math.min(1, (zoom - 1.2) * .85); ctx.strokeStyle = T.rail;
      if (rp) ctx.stroke(rp);
      ctx.lineWidth = zoom > 3 ? 0.9 : 0.7; ctx.globalAlpha = 1;
    }
    if ((M.rail || M.best) && D.RAIL[S.era] > 0) {
      ctx.beginPath();
      for (const ln of D.RAIL_LINES) if (ln.y <= yr) path({ type: 'LineString', coordinates: ln.p });
      if (D.HSR[S.era] > 0) for (const ln of D.HSR_LINES) path({ type: 'LineString', coordinates: ln });
      ctx.strokeStyle = T.rail; ctx.lineWidth = 0.9;
      ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    }

    if (!S.dragging) {
      const bp = layer('borders', BORDERS);
      if (bp) {
        ctx.strokeStyle = T.borderHalo; ctx.lineWidth = 1.6; ctx.stroke(bp);
        ctx.strokeStyle = T.border; ctx.lineWidth = 0.6; ctx.stroke(bp);
      }
    }
    if (landPath) {
      if (!S.dragging) { ctx.strokeStyle = T.coastHalo; ctx.lineWidth = 2; ctx.stroke(landPath); }
      ctx.strokeStyle = T.coast; ctx.lineWidth = 0.8; ctx.stroke(landPath);
    }


    // places — more of them the closer you look, never overlapping
    const cosP = Math.cos(S.rotP * RAD), sinP = Math.sin(S.rotP * RAD);
    const facing = (lon, lat) => {
      const l = (lon + S.rotL) * RAD, p = lat * RAD;
      return Math.cos(l) * Math.cos(p) * cosP - Math.sin(p) * sinP;
    };
    const nShow = S.dragging ? 14 : Math.round(Math.min(PLACES.length, 26 + Math.pow(zoom, 2.1) * 34));
    ctx.font = '500 10px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const placed = [];
    for (let k = 0; k < nShow; k++) {
      const c = PLACES[k];
      const z = facing(c.lon, c.lat);
      if (z <= 0.04) continue;
      const p = proj([c.lon, c.lat]);
      if (!p) continue;
      const big = k < 26;
      ctx.globalAlpha = Math.min(1, z / 0.26);
      ctx.beginPath(); ctx.arc(p[0], p[1], big ? 2.1 : 1.4, 0, TAU);
      ctx.fillStyle = big ? T.dot : T.dotSmall; ctx.fill();
      if (z > 0.2) {
        const w = TW.has(c.n) ? TW.get(c.n) : (TW.set(c.n, ctx.measureText(c.n).width), TW.get(c.n));
        const box = [p[0] + 4, p[1] - 6, w + 9, 12];
        let clash = false;
        for (let q = 0; q < placed.length; q++) {
          const b = placed[q];
          if (box[0] < b[0] + b[2] && box[0] + box[2] > b[0] && box[1] < b[1] + b[3] && box[1] + box[3] > b[1]) { clash = true; break; }
        }
        if (!clash) {
          placed.push(box);
          ctx.lineWidth = 2.6; ctx.strokeStyle = T.labelHalo;
          ctx.strokeText(c.n, p[0] + 5, p[1] + .5);
          ctx.fillStyle = big ? T.label : T.labelSmall;
          ctx.fillText(c.n, p[0] + 5, p[1] + .5);
        }
      }
      ctx.globalAlpha = 1;
    }

    const op = facing(S.origin.lon, S.origin.lat) > 0 ? proj([S.origin.lon, S.origin.lat]) : null;
    if (op) {
      const t = (performance.now() % 2600) / 2600;
      ctx.save();
      ctx.strokeStyle = 'rgba(' + T.originRing + ',' + (0.5 * (1 - t)).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(op[0], op[1], 4 + t * 22, 0, TAU); ctx.stroke();
      ctx.strokeStyle = T.origin; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(op[0], op[1], 5.5, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(op[0] - 10, op[1]); ctx.lineTo(op[0] - 7, op[1]);
      ctx.moveTo(op[0] + 7, op[1]); ctx.lineTo(op[0] + 10, op[1]);
      ctx.moveTo(op[0], op[1] - 10); ctx.lineTo(op[0], op[1] - 7);
      ctx.moveTo(op[0], op[1] + 7); ctx.lineTo(op[0], op[1] + 10);
      ctx.stroke();
      ctx.fillStyle = T.originDot;
      ctx.beginPath(); ctx.arc(op[0], op[1], 1.8, 0, TAU); ctx.fill();
      ctx.restore();
    }

    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
    ctx.strokeStyle = T.limb; ctx.lineWidth = 1; ctx.stroke();
  }

  /* ================= animation ================= */
  let raf = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animate(from) {
    cancelAnimationFrame(raf);
    clearTimeout(S.revealGuard);
    if (reduced) { S.reveal = 99; draw(); return; }
    const NB = D.RAMP.length, t0 = performance.now(), dur = 950;
    S.reveal = from;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      S.reveal = from + (NB + 1 - from) * (1 - Math.pow(1 - k, 2.2));
      draw();
      if (k < 1) raf = requestAnimationFrame(step); else { S.reveal = 99; pulse(); }
    };
    raf = requestAnimationFrame(step);
    // rAF is throttled to nothing in a background tab, which would leave the
    // bands stuck part-way revealed. Guarantee the finished state either way.
    S.revealGuard = setTimeout(() => {
      if (S.reveal < NB) { cancelAnimationFrame(raf); S.reveal = 99; draw(); }
    }, dur + 500);
  }
  function pulse() {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const step = () => { draw(); if (performance.now() - t0 < 2600) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }

  /* ================= readout ================= */
  const $ = id => document.getElementById(id);

  function nearestPlace(lon, lat, maxKm) {
    let best = null, bd = Infinity;
    for (let k = 0; k < PLACES.length; k++) {
      const c = PLACES[k], d = gcDist(lon, lat, c.lon, c.lat);
      if (d < bd) { bd = d; best = c; }
    }
    return bd <= maxKm ? best : null;
  }
  const timeAt = (field, lon, lat) => field ? field.dist[landCellOf(lon, lat)] : Infinity;
  function countryAt(lon, lat) { return ctryOf(landCellOf(lon, lat)); }

  function updateReadout() {
    const f = S.field, L = S.ladder, ei = S.era, yr = D.ERAS[ei].y;
    $('originName').textContent = S.origin.name;
    const lo = S.origin.lon, la = S.origin.lat;
    $('originCoord').textContent =
      Math.abs(la).toFixed(2) + '°' + (la >= 0 ? 'N' : 'S') + '  ' +
      Math.abs(lo).toFixed(2) + '°' + (lo >= 0 ? 'E' : 'W');

    const k = countryAt(lo, la);
    if (k >= 0) {
      const bits = ['roads ' + cMS[k] + ' km/h'];
      bits.push(cRY[k] > yr ? 'no railway yet' : cRQ[k] === 0 ? 'no railway' : 'rail from ' + cRY[k]);
      if (cHY[k] <= yr) bits.push('high-speed since ' + cHY[k]);
      $('profile').innerHTML = '<b>' + cName[k] + '</b> · ' + bits.join(' · ');
    } else $('profile').innerHTML = '<b>At sea</b>';

    let far = 0, landTot = 0, landIn = 0;
    for (let j = 0; j < GH; j++) {
      const lat = latOf(j), w = Math.cos(lat * RAD);
      const row = j * GW;
      for (let i = 0; i < GW; i++) {
        const c = row + i, d = f.dist[c];
        if (d <= 24) { const km = gcDist(lo, la, lonOf(i), lat); if (km > far) far = km; }
        if (landMask[c] && terr[c] !== 5) { landTot += w; if (d <= 168) landIn += w; }
      }
    }
    $('statDay').textContent = fmtKm(far);
    $('statDayNote').textContent = 'farthest point';
    $('solveNote').textContent = '1 036 800 cells · solved in ' +
      (S.solveMs >= 1000 ? (S.solveMs / 1000).toFixed(1) + ' s' : S.solveMs + ' ms');
    const pct = landIn / landTot * 100;
    $('statWeek').textContent = (pct < 1 ? pct.toFixed(1) : Math.round(pct)) + '%';

    $('thEra').textContent = yr;
    const rows = [];
    for (const name of D.LANDMARKS) {
      const c = D.CITIES.find(x => x.n === name);
      if (!c || gcDist(lo, la, c.lon, c.lat) < 500) continue;
      rows.push(c);
      if (rows.length >= 8) break;
    }
    $('destBody').innerHTML = rows.map(c =>
      '<tr><td>' + c.n + '</td><td class="num">' + fmtDur(timeAt(f, c.lon, c.lat)) + '</td></tr>').join('');

    S.legendReady = true;
    updateLegend();
  }

  function updateLegend() {
    const L = S.ladder, n = L.length, R = rampOf();
    const stops = R.map((c, i) => 'rgb(' + c.join(',') + ') ' + (i / (n - 1) * 100).toFixed(1) + '%').join(',');
    const pick = [0, 3, 6, 9, 12, n - 1].filter((v, i, a) => a.indexOf(v) === i && v < n);
    const labs = pick.map(i =>
      '<span style="left:' + ((i + 1) / n * 100).toFixed(1) + '%">' + fmtBand(L[i]) + '</span>').join('');
    $('legend').innerHTML =
      '<div class="rampbar" style="background:linear-gradient(90deg,' + stops + ')"></div>' +
      '<div class="ramplab">' + labs + '</div>' +
      '<div class="lg"><i style="background:rgba(' + R[n - 1].join(',') + ',.5)"></i>' +
      '<span>beyond ' + fmtBand(L[n - 1]) + '</span></div>';
  }

  function updateMethod() {
    const M = D.MODES[S.mode], ei = S.era, E = D.ERAS[ei], b = [];
    const A = (u, t) => '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>';

    b.push('<p>Earth sits on a <b>0.25\u00b0 grid</b> of 1\u2009036\u2009800 cells, each carrying the real road ' +
      'class, railway, ferry route, terrain and country beneath it. The map solves for the <b>quickest possible ' +
      'route</b> through that grid \u2014 a least-cost path, the same method ' +
      A('https://www.nature.com/articles/nature25181', 'Weiss et al. (2018, Nature)') +
      ' use for their global friction surface. That is why the bands finger out along main lines and motorways ' +
      'instead of spreading as circles.</p>');

    b.push('<p><b>Roads differ by country and by class.</b> Every country carries its ' +
      A('https://www.imf.org/en/Publications/WP/Issues/2022/05/13/Road-Quality-and-Mean-Speed-Score-517801', 'IMF Mean Speed score') +
      ' \u2014 the measured harmonic road speed between its cities, from 38 km/h in Bhutan to 107 in the United ' +
      'States. Each cell is then scaled by what is actually under you, with the class spread following ' +
      A('https://openaccess.thecvf.com/content_WACV_2020/papers/Van_Etten_City-Scale_Road_Extraction_from_Satellite_Imagery_v2_Road_Speeds_and_WACV_2020_paper.pdf', 'Van Etten (2020)') +
      ': a three-lane paved motorway at 105 km/h, a residential road at 40, a dirt cart track at 24.</p>');

    if (M.rail || M.best)
      b.push('<p><b>Railways are the real network</b> \u2014 37\u2009487 cells of it, main lines and branches apart. ' +
        'Each country has its own opening year and service quality: Switzerland and Japan at full speed, Canada ' +
        'at a third, and the Central African Republic, Chad, Somalia and Bhutan with no working railway at all \u2014 ' +
        A('https://en.wikipedia.org/wiki/History_of_rail_transport_in_the_Central_African_Republic', 'the CAR\u2019s only line') +
        ' ran 7.5 km and closed around 1960. Speeds are anchored on published start-to-stop averages: TGV 263 km/h, ' +
        'Shinkansen 285, Chinese G-trains 292, Indian Rajdhani 83\u201398, Trans-Siberian 70\u201390, VIA Rail capped at 130.' +
        (D.HSR[ei] > 0 ? ' High-speed track runs at <b>' + D.HSR[ei] + ' km/day</b>.' : '') + '</p>');

    if (M.land)
      b.push('<p>This mode runs at <b>' + Math.round(M.land[ei] / M.duty[ei] * 10) / 10 + ' km/h</b> on a ' +
        'par-quality highway and keeps it up for <b>' + M.duty[ei] + ' h</b> a day. Short hops run at full speed; ' +
        'only a long haul pays for nights and rests. Walking follows ' +
        A('https://en.wikipedia.org/wiki/Tobler%27s_hiking_function', 'Tobler\u2019s hiking function') +
        ' \u2014 5 km/h on the flat, a real day averaging 2\u20134. Mountain, desert, rainforest, tundra and ice cut ' +
        'the pace to between <b>' + Math.round(D.TERRAIN_MUL[5][ei] * 100) + '%</b> and <b>' +
        Math.round(D.TERRAIN_MUL[2][ei] * 100) + '%</b>.</p>');

    if (M.sea === 'ship')
      b.push('<p>Ships are in play: open sea at <b>' + D.WATER[ei] + ' km/day</b> around the clock, rivers at <b>' +
        D.RIVER[ei] + '</b>, and <b>' + D.PORT_H[ei] + ' h</b> lost boarding or landing. The 1750 figure is net ' +
        'progress made good, from ' +
        A('https://www.rmg.co.uk/stories/maritime-history/library-archive/18th-century-sailing-times-between-english-channel-coast', 'Royal Museums Greenwich') +
        ': Atlantic crossings of 30\u201340 days eastbound and 50\u201370 westbound.</p>');
    else
      b.push('<p><b>You stay on land.</b> Open water carries no colour, because you cannot get onto it. The ' +
        'exceptions are <b>314 real ferry routes</b> from the Natural Earth network \u2014 the longest is Sicily to ' +
        'Venice at 1\u2009281 km, and not one of them crosses an ocean.' +
        (E.y >= 1950 ? ' Fixed links count as dry land from the year they opened: Kanmon 1942, the Bosphorus 1973, ' +
          'Seikan 1988, the Channel Tunnel 1994, the Great Belt and \u00d8resund 1998.' : '') + '</p>');

    if (E.y < 1869) b.push('<p><b>No Suez, no Panama.</b> Both isthmuses are closed in ' + E.y +
      ', so every ship rounds the Cape of Good Hope or Cape Horn.</p>');

    if (M.air && D.AIR[ei]) {
      const a = D.AIR[ei];
      b.push('<p><b>Air means chartered, not scheduled.</b> The question is how fast you could physically get ' +
        'there if cost were no object, so the limit is the aircraft, not a timetable: any of <b>' +
        G.airports.filter(x => x.r <= D.AIR_RANK[ei]).length + ' airfields</b>, cruising at <b>' + a.cruise +
        ' km/h</b> with <b>' + a.range.toLocaleString('en') + ' km</b> of range and <b>' + a.stop +
        ' h</b> for a refuelling turn. ' +
        (E.y >= 2000
          ? 'That is a ' + A('https://bombardier.com/en/aircraft/global-7500', 'Bombardier Global 7500') +
            ' at 7\u2009700 nm and Mach 0.925, or a Gulfstream G650ER at 7\u2009500 nm.'
          : 'That is a Lockheed Constellation at 489 km/h. For comparison the ' +
            A('https://transportgeography.org/contents/chapter5/air-transport/london-sydney-air-routes/', 'scheduled 1950 Kangaroo route') +
            ' took about 58 h over seven stops \u2014 flying straight through is quicker.') +
        '</p>');
    }

    b.push('<p>Grid routes still cut corners a real road would not, so land travel is divided by a <b>circuity ' +
      'factor</b> of ' + D.ROAD_CIRC + ' by road and ' + D.RAIL_CIRC + ' by rail. The bands are not fixed either: ' +
      'they are laid across whatever is on screen, so a hemisphere reads in weeks and one country in minutes.</p>');

    b.push('<p style="color:#4E596E">Historic road speeds come from ' +
      A('https://www.historic-uk.com/CultureUK/The-Stagecoach/', 'stagecoach records') +
      ' \u2014 about 5 mph and 60\u201370 miles a day before the turnpikes, 8\u201310 mph by the mail-coach era. ' +
      'Country rail density follows the ' +
      A('https://ppp.worldbank.org/public-private-partnership/sites/default/files/2024-08/Africa_Offtrac%20-%20SubSaharan%20African%20Railways_EN.pdf', 'World Bank survey') +
      ' of sub-Saharan railways: an average of 3 km of track per 1\u2009000 km\u00b2, and sixteen African countries ' +
      'with none at all. Still an illustrative model, not routing data \u2014 it ignores winds, monsoons, ' +
      'timetables, borders, war and weather.</p>');
    $('method').innerHTML = b.join('');
  }

  /* ================= recompute ================= */
  function recompute(animateIn) {
    S.ladder = S.ladder || ladderFor();
    document.body.classList.add('solving');
    // Yield so the browser can paint the solving state before we block it for
    // a second. A timeout, not requestAnimationFrame: rAF never fires in a
    // background tab, which would leave the map permanently empty.
    clearTimeout(S.solveTimer);
    S.solveTimer = setTimeout(() => {
      const t0 = performance.now();
      S.field = computeField(S.origin.lon, S.origin.lat, S.mode, S.era);
      S.solveMs = Math.round(performance.now() - t0);
      S.fieldGen = (S.fieldGen || 0) + 1;
      S.tKey = '';
      document.body.classList.remove('solving');
      updateReadout(); updateMethod();
      if (animateIn) animate(0); else { S.reveal = 99; draw(); }
    }, 40);
  }

  /* ================= controls ================= */
  function buildModes() {
    $('modeList').innerHTML = D.MODES.map((m, k) =>
      '<button class="mode" data-m="' + k + '" aria-pressed="false">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + m.icon + '"/></svg>' +
      '<span class="lbl"><b>' + m.name + '</b><span data-v="' + k + '"></span></span></button>').join('');
    $('modeList').addEventListener('click', e => {
      const b = e.target.closest('.mode');
      if (!b || b.disabled) return;
      S.mode = +b.dataset.m; syncControls(); recompute(true);
    });
  }
  function buildEras() {
    /* Spaced evenly rather than to scale: the years are not regular, and a
       true axis would crush 1925-2026 into a corner. Where the jump between
       two plates is bigger than the rest, the axis carries a break mark. */
    const ax = $('axis'), n = D.ERAS.length;
    const gaps = D.ERAS.slice(1).map((e, i) => e.y - D.ERAS[i].y);
    const typical = gaps.slice().sort((a, b) => a - b)[gaps.length >> 1];
    const at = i => (n === 1 ? 50 : i / (n - 1) * 100);
    gaps.forEach((g, i) => {
      if (g <= typical * 1.4) return;
      const br = document.createElement('div');
      br.className = 'brk';
      br.style.left = ((at(i) + at(i + 1)) / 2) + '%';
      br.title = g + ' years';
      ax.appendChild(br);
    });
    D.ERAS.forEach((e, k) => {
      const b = document.createElement('button');
      b.className = 'era'; b.dataset.e = k;
      b.style.left = at(k) + '%';
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<div class="tick"></div><div class="yr">' + e.y + '</div>' +
        '<div class="tag">' + e.tag + '</div>';
      b.title = e.y + ' — ' + e.tag;
      b.addEventListener('click', () => { S.era = k; syncControls(); recompute(true); });
      ax.appendChild(b);
    });
  }
  function syncControls() {
    const ei = S.era;
    if (D.MODES[S.mode].since > ei) S.mode = 0;
    document.querySelectorAll('.mode').forEach(b => {
      const k = +b.dataset.m, m = D.MODES[k], ok = m.since <= ei;
      b.disabled = !ok;
      b.setAttribute('aria-pressed', String(k === S.mode));
      b.querySelector('[data-v]').textContent = ok ? m.vehicle[ei] : 'not yet possible';
    });
    let note = '';
    for (const m of D.MODES) if (m.since > ei && m.why) { note = m.why[ei] || ''; break; }
    $('modeNote').textContent = note;
    document.querySelectorAll('.era').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.e === ei)));
    $('axisFill').style.width = (ei / Math.max(1, D.ERAS.length - 1) * 100) + '%';
  }

  /* ================= pointer ================= */
  function screenToLonLat(sx, sy) {
    const r = S.scale, X = (sx - cx) / r, Y = -(sy - cy) / r;
    const d2 = X * X + Y * Y;
    if (d2 > 1) return null;
    const Z = Math.sqrt(1 - d2), phi = S.rotP * RAD;
    const a = Y * Math.cos(phi) - Z * Math.sin(phi), b = Y * Math.sin(phi) + Z * Math.cos(phi);
    const lat = Math.asin(Math.max(-1, Math.min(1, a))) * DEG;
    let lon = Math.atan2(X, b) * DEG - S.rotL;
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return [lon, lat];
  }

  let down = null, moved = 0, dragRaf = 0;
  cv.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, rl: S.rotL, rp: S.rotP };
    moved = 0; S.dragging = false;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved > 3) {
        if (!S.dragging) { S.dragging = true; cv.classList.add('dragging'); $('tip').hidden = true; }
        const k = 130 / S.scale;
        S.rotL = down.rl + dx * k;
        S.rotP = Math.max(-90, Math.min(90, down.rp - dy * k));
        S.tKey = '';
        // a pointer can fire far faster than the screen refreshes; coalesce
        if (!dragRaf) dragRaf = requestAnimationFrame(() => { dragRaf = 0; draw(); });
      }
      return;
    }
    hover(e.clientX, e.clientY);
  });
  cv.addEventListener('pointerup', e => {
    const wasDrag = S.dragging;
    if (down && !wasDrag && moved <= 3) {
      const ll = screenToLonLat(e.clientX, e.clientY);
      if (ll) setOrigin(ll[0], ll[1]);
    }
    down = null;
    if (wasDrag) {
      cancelAnimationFrame(dragRaf); dragRaf = 0;
      cv.classList.remove('dragging');
      draw();                                   // cheap frame, immediately
      clearTimeout(S.upgrade);
      S.upgrade = setTimeout(() => {            // then the full-quality one
        S.dragging = false; S.tKey = ''; draw();
      }, 70);
    }
  });
  cv.addEventListener('pointerleave', () => { $('tip').hidden = true; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const fit = S.fit || 300;
    S.scale = Math.max(fit * .78, Math.min(fit * 12, S.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    S.tKey = '';
    S.dragging = true;                       // keep the cheap path while wheeling
    clearTimeout(S.wheelIdle);
    S.wheelIdle = setTimeout(() => { S.dragging = false; S.tKey = ''; draw(); }, 180);
    if (!dragRaf) dragRaf = requestAnimationFrame(() => { dragRaf = 0; draw(); });
  }, { passive: false });

  function hover(sx, sy) {
    const tip = $('tip');
    const ll = screenToLonLat(sx, sy);
    if (!ll || !S.field) { tip.hidden = true; return; }
    const c = nearestPlace(ll[0], ll[1], 14000 / S.scale * 9);
    const lon = c ? c.lon : ll[0], lat = c ? c.lat : ll[1];
    const t = timeAt(S.field, lon, lat);
    const k = countryAt(lon, lat);
    const name = c ? c.n : (k >= 0 ? cName[k] : 'Open sea');
    tip.innerHTML = '<b>' + name + '</b><span>' + fmtDur(t) + '</span>';
    tip.style.left = sx + 'px'; tip.style.top = sy + 'px';
    tip.hidden = false;
  }

  function setOrigin(lon, lat, name, recentre) {
    const c = name ? null : nearestPlace(lon, lat, 120);
    S.origin = { lon: c ? c.lon : lon, lat: c ? c.lat : lat, name: name || (c ? c.n : coordName(lon, lat)) };
    if (recentre) { S.rotL = -S.origin.lon; S.rotP = -S.origin.lat; S.tKey = ''; }
    recompute(true);
  }
  function coordName(lon, lat) {
    const k = countryAt(lon, lat);
    if (k >= 0 && landMask[cellOf(lon, lat)]) return cName[k];
    return 'At sea  ' + Math.abs(lat).toFixed(1) + '°' + (lat >= 0 ? 'N' : 'S') + ' ' +
      Math.abs(lon).toFixed(1) + '°' + (lon >= 0 ? 'E' : 'W');
  }

  /* ================= search ================= */
  function buildPalettes() {
    const wrap = $('palette');
    wrap.innerHTML = D.PALETTES.map((p, i) => {
      const stops = p.ramp.map((c, k) =>
        'rgb(' + c.join(',') + ') ' + (k / (p.ramp.length - 1) * 100).toFixed(0) + '%').join(',');
      return '<button data-p="' + i + '" title="' + p.name + '" aria-label="' + p.name +
        '" aria-pressed="' + (i === 0) + '"><i style="background:linear-gradient(90deg,' + stops + ')"></i></button>';
    }).join('');
    const name = () => { $('paletteName').textContent = D.PALETTES[S.palette].name; };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      S.palette = +b.dataset.p;
      wrap.querySelectorAll('button').forEach(x =>
        x.setAttribute('aria-pressed', String(+x.dataset.p === S.palette)));
      name();
      S.bufKey = ''; updateLegend(); draw();
    });
    name();
  }

  function buildSearch() {
    const input = $('findInput'), list = $('findList');
    let items = [], sel = -1;
    const close = () => { list.innerHTML = ''; items = []; sel = -1; };
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) return close();
      items = PLACES.filter(c => c.n.toLowerCase().startsWith(q)).slice(0, 8);
      if (items.length < 8)
        items = items.concat(PLACES.filter(c => !c.n.toLowerCase().startsWith(q) && c.n.toLowerCase().includes(q)).slice(0, 8 - items.length));
      list.innerHTML = items.map((c, k) => '<li data-k="' + k + '">' + c.n + '</li>').join('');
      sel = -1;
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1)));
        [...list.children].forEach((li, k) => li.classList.toggle('on', k === sel));
      } else if (e.key === 'Enter') {
        const c = items[sel < 0 ? 0 : sel];
        if (c) { setOrigin(c.lon, c.lat, c.n, true); input.value = ''; close(); input.blur(); }
      } else if (e.key === 'Escape') { close(); input.blur(); }
    });
    list.addEventListener('click', e => {
      const li = e.target.closest('li'); if (!li) return;
      const c = items[+li.dataset.k];
      setOrigin(c.lon, c.lat, c.n, true); input.value = ''; close();
    });
  }

  /* ================= boot ================= */
  function boot() {
    const msg = $('bootMsg');
    const steps = [
      ['laying in rivers, canals and fixed links…', bakeOverlays],
      ['measuring the grid…', bakeDist]
    ];
    let k = 0;
    const run = () => {
      if (k < steps.length) {
        msg.textContent = steps[k][0];
        steps[k][1](); k++;
        setTimeout(run, 16);
        return;
      }
      msg.textContent = 'finding every route…';
      buildModes(); buildEras(); buildSearch(); buildPalettes();
      syncControls();
      window.addEventListener('resize', stageSize);
      if (window.ResizeObserver) {
        let t = 0;
        new ResizeObserver(() => { clearTimeout(t); t = setTimeout(stageSize, 80); })
          .observe(document.getElementById('stage'));
      }
      stageSize();
      recompute(false);
      $('boot').classList.add('gone');
      setTimeout(() => { $('boot').remove(); animate(0); }, 420);
    };
    setTimeout(run, 30);
  }

  window.__ISO = { computeField, cellOf, landCellOf, gcDist, draw, D, G, cName, cMS, cRQ, cRY,
    ctryOf, landMask, terr, roadCls, railCls, ferryCell, fmtDur, S };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
