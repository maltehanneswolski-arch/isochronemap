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
  /* Natural Earth's airports stop at 55 S, so the Antarctic fields are
     hand-added. They carry an opening year, since a runway on the ice is a
     20th-century thing and the rest of the set is gated only by size. */
  const AIRPORTS = G.airports.concat(
    D.ANTARCTIC_AIR.map(a => ({ lon: a.lon, lat: a.lat, r: 0, y: a.y, n: a.n })));

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
  /* high-speed track from OpenStreetMap, baked per cell in grid.js */
  const hsrV = unrle(G.layers.hsrv || '');       // km/h / 2 through the cell, 0 = none
  const hsrY = unrle(G.layers.hsry || '');       // opening year - 1900
  const canalYear = new Int16Array(GN);
  const linkYear = new Int16Array(GN);
  const linkWait = new Float32Array(GN);        // check-in at a tunnel portal, hours

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
    // fixed links first: a rail tunnel or bridge carries the trunk network
    // across, so the trunk stamp below may land on those sea cells too
    for (const fl of D.FIXED_LINKS) stamp(fl.pts, (lo, la) => {
      const c = cellOf(lo, la); linkYear[c] = fl.year;
      if (fl.wait) linkWait[c] = fl.wait;
      if (fl.rail && fl.year < trunkYear[c]) trunkYear[c] = fl.year;
    }, RES * 0.25);
    for (const ln of D.RAIL_LINES)
      stamp(ln.p, (lo, la) => {
        const c = cellOf(lo, la);
        if ((landMask[c] || linkYear[c]) && ln.y < trunkYear[c]) trunkYear[c] = ln.y;
      });
    for (const cn of D.CANALS) stamp(cn.pts, (lo, la) => {
      const c = cellOf(lo, la); canalYear[c] = cn.year; ferryCell[c] = 1;
    }, RES * 0.25);
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
    const railOn = new Uint8Array(GN);            // the cell's speed is a train's
    const hsrOn = new Uint8Array(GN);             // ...a high-speed train's
    const netW = D.NET_W[ei], CM = D.CLASS_MUL, circ = D.ROAD_CIRC;
    const oceanOK = M.sea === 'ship';
    const seaBase = D.WATER[ei] * (M.rail ? D.WATER_SCHEDULED[ei] : 1);
    const fry = D.FERRY[ei], ice = D.ICE_WATER[ei], riv = D.RIVER[ei] / D.RIVER_CIRC;
    const ids = best ? D.MODES.filter(m => !m.best && !m.air && m.since <= ei).map(m => m.id) : [M.id];
    const tDuty = byId.transit.duty[ei];
    const railBase = D.RAIL[ei];
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
    const qual = new Float32Array(NK), qual1 = new Float32Array(NK), rqA = new Float32Array(NK);
    const ryA = new Int16Array(NK);
    for (let k = 0; k < NK; k++) {
      const ms = k < NC ? cMS[k] : 60;
      qual[k] = Math.pow(ms / D.ROAD_REF, D.ROAD_EXP[ei]);
      qual1[k] = ms / D.ROAD_REF;               // unexaggerated: what a coach on the main road sees
      // unclaimed land is mostly sea cells bridged by a tunnel: good track
      rqA[k] = k < NC ? (ei === 4 ? cRQ[k] : cRH[k]) : 0.9;
      ryA[k] = k < NC ? cRY[k] : 9999;
    }

    // lookup[((k*6 + terrain)*5 + roadClass)*3 + railState]
    const LN = NK * 90;
    const luS = new Float32Array(LN), luD = new Uint8Array(LN), luR = new Uint8Array(LN);
    for (let k = 0; k < NK; k++) {
      const q = qual[k], q1 = qual1[k], rq = rqA[k];
      for (let t = 0; t < 6; t++) {
        const tm = tmul[t], soft = (t === 1 || t === 5) ? 0.15 + 0.65 * tm : 0.85 + 0.15 * tm;
        // the mean-speed score already carries the country's terrain speeds, but not
        // the extra distance a mountain road winds through: roads take it at half weight
        const tmCar = 0.5 + 0.5 * tm, tmCoach = 0.4 + 0.6 * tm;
        for (let rc = 0; rc < 5; rc++) {
          const rfv = rf[rc], rfv2 = rfB[rc], rfv3 = rfF[rc];
          for (let rs = 0; rs < 3; rs++) {
            let v = 0, vd = tDuty, vr = 0;
            for (let m = 0; m < ids.length; m++) {
              const id = ids[m], MM = byId[id], d = MM.duty[ei], base = MM.land[ei];
              let kmd, byRail = 0;
              if (id === 'foot') kmd = base * (0.80 + 0.20 * q) * tm * rfv3 / circ;
              else if (id === 'bike') kmd = base * (0.25 + 0.75 * q) * tm * rfv2 / circ;
              else if (id === 'road') kmd = base * q * tmCar * rfv / circ;
              else {
                kmd = base * (0.15 + 0.85 * q1) * tmCoach * (1 + (rfv - 1) * 0.5) / circ;
                if (rs && railBase > 0 && rq > 0) {
                  let r = railBase * rq * soft * (rs === 2 ? D.RAIL_MAIN : D.RAIL_BRANCH);
                  if (id === 'air') r *= 0.8;
                  r /= D.RAIL_CIRC;
                  if (r > kmd) { kmd = r; byRail = 1; }
                }
              }
              if (kmd / d > v / vd) { v = kmd; vd = d; vr = byRail; }
            }
            const o = ((k * 6 + t) * 5 + rc) * 3 + rs;
            luS[o] = v / vd; luD[o] = vd; luR[o] = vr;
          }
        }
      }
    }
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
        let onR = luR[o];
        /* a high-speed line is what it is, whatever the legacy network around
           it: its cells run at their own speed from the year they opened */
        if (railMode && hsrV[c] && hsrY[c] && yr >= 1900 + hsrY[c]) {
          const hv = hsrV[c] * 2 / D.RAIL_CIRC * (M.air ? 0.8 : 1);
          if (hv > v) { v = hv; vd = tDuty; onR = 1; hsrOn[c] = 1; }
        }
        if (rivSpeed && river[c] && rivSpeed > v) { v = rivSpeed; vd = D.SEA_DUTY; onR = 0; hsrOn[c] = 0; }
        sp[c] = v; duty[c] = vd; railOn[c] = onR;
      }
    }
    // half-reciprocal speed, so the inner loop adds instead of dividing
    const inv = new Float32Array(GN);
    for (let c = 0; c < GN; c++) inv[c] = sp[c] > 0 ? 0.5 / sp[c] : 0;
    return { sp, duty, wet, inv, railOn, hsrOn };
  }

  /* ================= the field =================
     Dial's algorithm: a bucketed queue in place of a binary heap, which is
     what makes a million-cell search feel instant. */
  /* The airfield graph does not depend on where you start, so it is built
     once per era: which fields are open, and for each the fields within
     range and the hours to them. Some 2 700 fields are far too many to pair
     up again on every solve. */
  const airGraphs = new Map();
  function airGraph(ei) {
    if (airGraphs.has(ei)) return airGraphs.get(ei);
    const yr = D.ERAS[ei].y, air = D.AIR[ei];
    const ports = AIRPORTS.filter(a => a.r <= D.AIR_RANK[ei] && (!a.y || a.y <= yr));
    const n = ports.length, nb = new Array(n), hr = new Array(n), latSpan = air.range / 111;
    for (let a = 0; a < n; a++) {
      const A = ports[a], I = [], Hh = [];
      for (let b = 0; b < n; b++) {
        if (b === a) continue;
        const B = ports[b];
        if (Math.abs(A.lat - B.lat) > latSpan) continue;
        const km = gcDist(A.lon, A.lat, B.lon, B.lat);
        if (km > air.range) continue;
        I.push(b); Hh.push(km / air.cruise + air.stop);
      }
      nb[a] = Int32Array.from(I); hr[a] = Float32Array.from(Hh);
    }
    const g = { ports, nb, hr, cells: ports.map(c => landCellOf(c.lon, c.lat)) };
    airGraphs.set(ei, g);
    return g;
  }

  const NBUK = 600000;
  const bHead = new Int32Array(NBUK);
  let bNext = null, bPrev = null, bBuk = null, bDone = null;

  function computeField(oLon, oLat, mi, ei) {
    const M = D.MODES[mi], { sp, duty, wet, inv, railOn, hsrOn } = buildSpeed(mi, ei);
    const port = D.PORT_H[ei];
    // the first train of a journey costs the walk to the station and the wait
    const board = (M.rail || M.best) ? D.RAIL_BOARD[ei] : 0, alight = board ? D.RAIL_ALIGHT : 0;
    const border = board ? D.RAIL_BORDER[ei] : 0;
    // duty hours only ever take a handful of values, so 24/dEdge is a table
    const restTab = new Float32Array(49);
    for (let s = 1; s <= 48; s++) restTab[s] = 48 / s;   // 24 / (s/2)
    const flying = M.air && !!D.AIR[ei];
    const AG = flying ? airGraph(ei) : null;
    const ports = AG ? AG.ports : [];
    const NA = ports.length, total = GN + NA;
    const air = flying ? D.AIR[ei] : null;
    const airAt = new Map();
    if (AG) AG.cells.forEach((c, k) => airAt.set(c, k));

    /* The bucket width used to be taken from the colour scale on screen, so
       the solver's range depended on how far the reader had zoomed: after a
       look at a 2026 city, a 1750 plot had a range of fifteen days and every
       cost beyond it was thrown into the last bucket and settled out of
       order. The width is now fixed at 72 seconds, under the smallest edge,
       so Dial's method is exact, and the buckets form a ring: a node's
       tentative cost is never more than one edge ahead of the current
       bucket, so 600 000 of them cover any path however long it takes. */
    const w = 0.02;

    const dist = new Float32Array(total).fill(Infinity);
    const move = new Float32Array(total).fill(0);
    if (!bNext || bNext.length < total) {
      bNext = new Int32Array(total + 64); bPrev = new Int32Array(total + 64);
      bBuk = new Int32Array(total + 64); bDone = new Uint8Array(total + 64);
    } else bDone.fill(0);
    bBuk.fill(-1);
    bHead.fill(-1);

    let cur = 0, ci = 0, nOpen = 0;              // absolute bucket, ring index, queued nodes
    const invW = 1 / w;
    /* A node may be reached again at a lower cost, so it has to move buckets
       rather than be inserted twice — one `next` pointer per node cannot hold
       two list positions, and the chain closes into a cycle if it tries. */
    const unlink = node => {
      const b = bBuk[node];
      if (b < 0) return;
      const p = bPrev[node], n = bNext[node];
      if (p >= 0) bNext[p] = n; else bHead[b % NBUK] = n;
      if (n >= 0) bPrev[n] = p;
      bBuk[node] = -1; nOpen--;
    };
    const push = (cost, node) => {
      let b = (cost * invW) | 0;
      if (b < cur) b = cur;
      if (bBuk[node] === b) return;
      unlink(node);
      const r = b % NBUK;
      bPrev[node] = -1; bNext[node] = bHead[r];
      if (bHead[r] >= 0) bPrev[bHead[r]] = node;
      bHead[r] = node; bBuk[node] = b; nOpen++;
    };

    const start = landCellOf(oLon, oLat);
    dist[start] = 0; move[start] = 0; push(0, start);

    while (nOpen > 0) {
      while (bHead[ci] < 0) { cur++; if (++ci === NBUK) ci = 0; }
      const u = bHead[ci];
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
            if (board) {
              const ru = u === start ? 0 : railOn[u], rv = railOn[v];
              if (rv !== ru) nc += rv ? board : alight;
              else if (rv && ctryRaw[u] !== ctryRaw[v] && ctryRaw[u] && ctryRaw[v]) nc += border;
            }
            if (linkWait[v] && !linkWait[u]) nc += linkWait[v];
            if (nc < dist[v]) { dist[v] = nc; move[v] = m1; push(nc, v); }
          }
        }
        if (air && airAt.has(u)) {
          const v = GN + airAt.get(u), nc = du + air.board;
          if (nc < dist[v]) { dist[v] = nc; move[v] = mu; push(nc, v); }
        }
      } else {
        const a = u - GN;
        const gcell = AG.cells[a], ncg = du + air.land;
        if (ncg < dist[gcell]) { dist[gcell] = ncg; move[gcell] = mu; push(ncg, gcell); }
        const I = AG.nb[a], Hh = AG.hr[a];
        for (let q = 0; q < I.length; q++) {
          const v = GN + I[q], nc = du + Hh[q];
          if (nc < dist[v]) { dist[v] = nc; move[v] = mu; push(nc, v); }
        }
      }
    }
    return { dist, ports, start };
  }

  /* ================= solved fields, kept and looked ahead =================
     A solve is the expensive step, so results are kept and the neighbouring
     years are worked out during the quiet moments after you stop. Scrubbing
     the timeline is then usually instant. Any gesture cancels the look-ahead,
     so it never steals a frame from something you are actually doing. */
  const fieldCache = new Map();
  const CACHE_MAX = 7;                       // ~4 MB of distances apiece
  const fieldKey = (lon, lat, mi, ei) => lon.toFixed(3) + ',' + lat.toFixed(3) + ',' + mi + ',' + ei;

  function getField(lon, lat, mi, ei) {
    const k = fieldKey(lon, lat, mi, ei);
    const hit = fieldCache.get(k);
    if (hit) { fieldCache.delete(k); fieldCache.set(k, hit); return hit; }
    const f = computeField(lon, lat, mi, ei);
    fieldCache.set(k, f);
    while (fieldCache.size > CACHE_MAX) fieldCache.delete(fieldCache.keys().next().value);
    return f;
  }

  function cancelLookahead() { clearTimeout(S.pre); S.pre = 0; }

  function lookahead() {
    cancelLookahead();
    const { lon, lat } = S.origin, mi = S.mode;
    const jobs = [];
    for (const d of (S.mobile ? [1, -1] : [1, -1, 2, -2])) {          // the years either side first
      const e = S.era + d;
      if (e >= 0 && e < D.ERAS.length && D.MODES[mi].since <= e) jobs.push([lon, lat, mi, e]);
    }
    let i = 0;
    const step = () => {
      if (i >= jobs.length || S.interacting) { S.pre = 0; return; }
      const j = jobs[i++];
      if (!fieldCache.has(fieldKey(j[0], j[1], j[2], j[3]))) getField(j[0], j[1], j[2], j[3]);
      S.pre = setTimeout(step, 250);
    };
    S.pre = setTimeout(step, 900);
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
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009') + ' km';
  };

  function ladderFor() { return D.LADDERS.base; }

  /* ================= render geometry ================= */
  const LANDGEO = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: window.GEO.land } };
  const BORDERS = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: window.GEO.countries } };
  /* Two levels of coastline, chosen by zoom and nothing else. Keying detail to
     whether the globe happens to be moving made it visibly change under the
     cursor; keying it to zoom means a given view always looks the same. */
  function thin(step) {
    return {
      type: 'Feature', geometry: {
        type: 'MultiPolygon',
        coordinates: window.GEO.land.map(poly => poly.map(ring => {
          if (ring.length <= 16) return ring;
          const out = [];
          for (let i = 0; i < ring.length - 1; i += step) out.push(ring[i]);
          out.push(ring[ring.length - 1]);
          return out;
        })).filter(p => p.length)
      }
    };
  }
  const LANDMED = thin(2);
  const BORDERMED = {
    type: 'Feature', geometry: {
      type: 'MultiPolygon',
      coordinates: window.GEO.countries.map(poly => poly.map(ring => {
        if (ring.length <= 16) return ring;
        const out = [];
        for (let i = 0; i < ring.length - 1; i += 2) out.push(ring[i]);
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
    reveal: 99, dragging: false, tBuf: null, tKey: '', palette: 0,
    interacting: false, moveQ: 1, frameAvg: 0
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
     frame. Project once and keep the Path2D, so a fill, a wash and a stroke of
     the same coastline cost one projection between them.

     Orthographic is linear in scale: at a fixed rotation a zoom only
     multiplies the projected coordinates, so the same path serves every zoom
     level, with the difference applied as a transform when it is drawn. The
     one thing that does not scale is d3's great-circle resampling, which is
     cut to a tolerance in projected pixels. So the layers are built in
     half-octave steps and always at the top of the step, never below the
     scale on screen: the drawn path is then only ever shrunk, and its
     resampling can only get finer than it needs to be, never coarser. The
     whole zoom range crosses about eight of those steps, instead of
     reprojecting 25 000 points on every frame of every zoom. */
  const vec = { key: '', s: 1 };
  function layer(name, geo) {
    const bucket = Math.ceil(Math.log2(S.scale) * 2);      // half-octaves
    const key = [bucket, Math.round(S.rotL * 100), Math.round(S.rotP * 100),
      Math.round(cx), Math.round(cy)].join(',');
    if (vec.key !== key) {
      for (const k in vec) if (k !== 'key' && k !== 's') delete vec[k];
      vec.key = key; vec.s = Math.pow(2, bucket / 2);
    }
    if (!(name in vec)) {
      proj.scale(vec.s);
      const d = pathStr(geo);
      vec[name] = d ? new Path2D(d) : null;
      proj.scale(S.scale);
    }
    return vec[name];
  }

  /* Place dots and labels are projected once per rotation for the same
     reason, as unit-sphere coordinates that a zoom simply multiplies. */
  const lab = { key: '', x: null, y: null, z: null };
  function labelGeom() {
    const key = Math.round(S.rotL * 100) + ',' + Math.round(S.rotP * 100);
    if (lab.key === key) return lab;
    const n = PLACES.length;
    if (!lab.x) { lab.x = new Float64Array(n); lab.y = new Float64Array(n); lab.z = new Float64Array(n); }
    const cosP = Math.cos(S.rotP * RAD), sinP = Math.sin(S.rotP * RAD);
    for (let k = 0; k < n; k++) {
      const c = PLACES[k];
      const l = (c.lon + S.rotL) * RAD, ph = c.lat * RAD;
      const cp = Math.cos(ph), sp = Math.sin(ph), cl = Math.cos(l);
      lab.x[k] = Math.sin(l) * cp;
      lab.y[k] = -(sp * cosP + cl * cp * sinP);
      lab.z[k] = cl * cp * cosP - sp * sinP;
    }
    lab.key = key;
    return lab;
  }

  function stageSize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const de = document.documentElement;
    Wc = de.clientWidth || window.innerWidth;
    Hc = de.clientHeight || window.innerHeight;
    for (const c of [sky, cv]) { c.width = Wc * DPR; c.height = Hc * DPR; }
    skyC.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    /* Under 820px the panel becomes a sheet along the bottom and the era axis
       moves inside it, so the globe has the whole screen above it. */
    /* A phone held on its side has room across but none down, so it keeps the
       side panel rather than a sheet. */
    const mob = Wc <= 820 && Hc >= 480;
    if (mob !== S.mobile) {
      S.mobile = mob;
      document.body.classList.toggle('mobile', mob);
      const tl = $('timeline'), pn = $('panel');
      if (mob) pn.appendChild(tl); else document.body.appendChild(tl);
      if (!mob) document.body.classList.remove('sheet-open');
    }
    const peek = mob ? sheetPeek() : 0;

    // the panel holds the right edge at every width above the sheet, so the
    // globe is centred in what is left of the screen
    const gutter = mob ? 0 : (Wc > 1140 ? 302 : 284);
    const foot = mob || Hc > 620 ? 0 : 86;     // on a short screen the axis is in the way
    cx = (Wc - gutter) * 0.5;
    const head = mob ? 54 : 0;                 // the masthead sits in this strip
    cy = mob ? head + (Hc - peek - head) * 0.5 : (Hc - foot) * 0.5;
    const fit = mob ? Math.min(Wc * 0.96, (Hc - peek - head) * 0.96) / 2
                    : Math.min((Wc - gutter) * 0.88, (Hc - foot) * 0.84) / 2;
    if (!S.fitted) { S.scale = fit; S.fitted = true; }
    else S.scale = Math.max(fit * 0.78, Math.min(S.scale, fit * 12));
    S.fit = fit;
    drawSky(); S.tKey = ''; draw();
  }

  /* How much of the sheet stays on screen when it is down: the handle, the
     place, the means of travel and the years. Measured rather than guessed,
     because the type reflows at narrow widths. */
  function sheetPeek() {
    const pn = $('panel'), tl = $('timeline');
    if (!tl || tl.parentNode !== pn) return 188;
    const top = pn.getBoundingClientRect().top;
    const h = Math.round(tl.getBoundingClientRect().bottom - top + 16);
    const peek = Math.max(120, Math.min(h, Math.round(Hc * 0.42)));
    pn.style.setProperty('--peek', peek + 'px');
    S.peekPx = peek;
    return peek;
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

  /* ---- one scale per plot -------------------------------------------
     The thresholds used to be re-derived from whatever was on screen, so
     zooming in re-coloured the whole map. A scale that moves under the
     reader is not a scale. The ladder is now a property of the field alone:
     eighteen round numbers laid log-evenly from a few minutes or hours up to
     the 97th percentile of everything reachable, and then held fixed however
     the globe is turned or zoomed. It is wide enough that a city still has
     hourly bands while the far side of the world reads in months. */
  const NICE = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 18, 24, 36, 48, 72, 96, 120,
    168, 240, 336, 504, 720, 1080, 1440, 2160, 2880, 4320, 5760, 8760, 13140, 17520, 26280];

  function makeLadder(maxT) {
    const n = D.RAMP.length;
    const lo = Math.max(NICE[0], maxT / 600);
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

  /* The 97th percentile of the reachable land, weighted by area and with the
     ice sheets left out: a plain count over a lat-lon grid would let the
     polar rows, which are many, drag the top of the scale up into the years
     it takes to walk across Antarctica. */
  function fieldLadder(field) {
    if (field.ladder) return field.ladder;
    const dist = field.dist, vals = [];
    for (let j = 0; j < GH; j++) {
      const w = Math.cos(latOf(j) * RAD);
      if (w < 0.05) continue;
      const step = Math.max(1, Math.round(11 / w));
      const row = j * GW;
      for (let i = (j * 7) % step; i < GW; i += step) {
        const c = row + i;
        if (!landMask[c] || terr[c] === 5) continue;     // ice sheets are not destinations
        const v = dist[c];
        if (v > 0 && v < Infinity) vals.push(v);
      }
    }
    let L;
    if (vals.length < 30) L = makeLadder(NICE[0] * 12);      // nothing reachable: hours
    else {
      vals.sort((p, q) => p - q);
      const hi = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.97))];
      L = makeLadder(Math.max(hi, NICE[0] * 12));
    }
    field.ladder = L;
    return L;
  }

  function refreshLadder() {
    if (!S.field) return false;
    const L = fieldLadder(S.field);
    if (L === S.ladder) return false;
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

  /* The band coordinate depends only on the cost field and the ladder, so it
     is worked out once for all 1 036 800 cells rather than for every pixel of
     every frame — which is most of what a frame used to cost. */

  /* ================= the field, on the GPU =================
     Re-projecting the sphere on the CPU means an asin and an atan2 for every
     one of a million pixels, every frame — which is the whole reason moving
     the globe was heavy. The band field is instead uploaded once as a texture
     (that upload is the only slow part, and it happens when you pick a new
     city, not while you move) and a fragment shader does the projection. The
     GPU does that for nothing, so the map can stay at full resolution while
     it turns. Falls back to the CPU renderer where WebGL2 is unavailable. */
  const GL = (() => {
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) return null;

    const VERT = `#version 300 es
    void main(){
      vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
      gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }`;

    const FRAG = `#version 300 es
    precision highp float;
    uniform sampler2D uTex;
    uniform vec2  uCentre, uTexSize;
    uniform float uRadius, uCosP, uSinP, uLon0, uHeight;
    uniform float uNB, uTMax, uAlpha, uSat, uSeaMix, uBeyondA, uLineW, uLineS, uRev;
    uniform vec3  uSea;
    uniform vec3  uRamp[18];
    out vec4 frag;

    float decode(vec2 px){
      vec4 t = texelFetch(uTex, ivec2(px), 0);
      return (t.r * 255.0 + t.g * 255.0 * 256.0) / 65535.0 * uTMax;
    }
    float landAt(vec2 px){ return texelFetch(uTex, ivec2(px), 0).b; }

    void main(){
      vec2 sc = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y);
      vec2 d  = (sc - uCentre) / uRadius;
      float X = d.x, Y = -d.y;
      float q = X * X + Y * Y;
      if (q > 1.0) discard;
      float Z = sqrt(1.0 - q);

      float a = Y * uCosP - Z * uSinP;
      float b = Y * uSinP + Z * uCosP;
      float lat = degrees(asin(clamp(a, -1.0, 1.0)));
      float lon = degrees(atan(X, b)) - uLon0;
      lon = mod(lon + 180.0, 360.0) - 180.0;

      // bilinear over the band grid, wrapping in longitude
      float fi = (lon + 180.0) / 360.0 * uTexSize.x - 0.5;
      float fj = (90.0 - lat) / 180.0 * uTexSize.y - 0.5;
      float i0 = floor(fi), j0 = clamp(floor(fj), 0.0, uTexSize.y - 2.0);
      float u = fi - i0, v = clamp(fj - j0, 0.0, 1.0);
      float ia = mod(i0, uTexSize.x), ib = mod(i0 + 1.0, uTexSize.x);
      float t = mix(mix(decode(vec2(ia, j0)),      decode(vec2(ib, j0)),      u),
                    mix(decode(vec2(ia, j0 + 1.0)), decode(vec2(ib, j0 + 1.0)), u), v);
      float isLand = landAt(vec2(u < 0.5 ? ia : ib, v < 0.5 ? j0 : j0 + 1.0));

      if (t > uRev) discard;
      float raw = t;
      float beyond = 0.0;
      if (t >= uNB) { beyond = min(1.0, (t - uNB) / 5.0); t = uNB - 0.0001; }

      float band = floor(t), f = t - band;
      int i0b = int(band);
      vec3 c0 = uRamp[i0b];
      vec3 c1 = uRamp[i0b + 1 < int(uNB) ? i0b + 1 : int(uNB) - 1];
      vec3 c = mix(c0, c1, f);

      float l = (max(max(c.r, c.g), c.b) + min(min(c.r, c.g), c.b)) * 0.5;
      c = vec3(l) + (c - vec3(l)) * uSat;
      c *= 1.0 - beyond * 0.45;
      float alpha = uAlpha * (1.0 - beyond * (1.0 - uBeyondA));

      // isochrones, at a width that is constant on screen
      float line = 0.0;
      if (raw < uNB) {
        float g = max(fwidth(raw), 1e-4);
        float dmin = min(f, 1.0 - f);
        float maj = clamp(1.0 - dmin / (g * uLineW), 0.0, 1.0);
        float hm  = abs(f - 0.5);
        float mid = clamp(1.0 - hm / (g * uLineW * 0.8), 0.0, 1.0);
        line = max(maj * maj, mid * mid * 0.45);
      }

      if (isLand < 0.5) { c = mix(c, uSea, uSeaMix); alpha *= 0.84; }
      if (line > 0.0) { c = mix(c, vec3(1.0), line * uLineS); alpha += line * 0.22; }

      frag = vec4(c, clamp(alpha, 0.0, 1.0));
    }`;

    function build(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    }
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, build(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, build(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { return null; }

    const U = {};
    for (const n of ['uTex', 'uCentre', 'uTexSize', 'uRadius', 'uCosP', 'uSinP', 'uLon0', 'uHeight',
      'uNB', 'uTMax', 'uAlpha', 'uSat', 'uSeaMix', 'uBeyondA', 'uLineW', 'uLineS', 'uRev', 'uSea', 'uRamp'])
      U[n] = gl.getUniformLocation(prog, n);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]])
      gl.texParameteri(gl.TEXTURE_2D, k, v);

    const buf = new Uint8Array(GW * GH * 4);
    let texKey = '';

    /* Pack the band grid into a texture: sixteen bits of band coordinate
       across red and green, the land flag in blue. */
    function upload(bandArr, tmax) {
      const key = S.fieldKey + '|' + S.ladder.join(',');
      if (key === texKey) return;
      texKey = key;
      const k = 65535 / tmax;
      for (let c = 0, o = 0; c < GN; c++, o += 4) {
        let q = bandArr[c] * k;
        q = q < 0 ? 0 : q > 65535 ? 65535 : q | 0;
        buf[o] = q & 255; buf[o + 1] = q >> 8;
        buf[o + 2] = landMask[c] ? 255 : 0; buf[o + 3] = 255;
      }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GW, GH, 0, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    }

    function render(w, h, centre, radius, rot, ramp, rev) {
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const NB = ramp.length, TMAX = NB + 6;
      const flat = new Float32Array(18 * 3);
      for (let i = 0; i < 18; i++) {
        const c = ramp[Math.min(i, NB - 1)];
        flat[i * 3] = c[0] / 255; flat[i * 3 + 1] = c[1] / 255; flat[i * 3 + 2] = c[2] / 255;
      }
      gl.uniform1i(U.uTex, 0);
      gl.uniform2f(U.uCentre, centre[0], centre[1]);
      gl.uniform2f(U.uTexSize, GW, GH);
      gl.uniform1f(U.uRadius, radius);
      gl.uniform1f(U.uCosP, Math.cos(rot[1] * RAD));
      gl.uniform1f(U.uSinP, Math.sin(rot[1] * RAD));
      gl.uniform1f(U.uLon0, rot[0]);
      gl.uniform1f(U.uHeight, h);
      gl.uniform1f(U.uNB, NB);
      gl.uniform1f(U.uTMax, TMAX);
      gl.uniform1f(U.uAlpha, D.FIELD_ALPHA);
      gl.uniform1f(U.uSat, D.SATURATE);
      gl.uniform1f(U.uSeaMix, D.SEA_MIX);
      gl.uniform1f(U.uBeyondA, D.BEYOND_ALPHA);
      gl.uniform1f(U.uLineW, D.LINE_WIDTH);
      gl.uniform1f(U.uLineS, D.LINE_STRENGTH);
      gl.uniform1f(U.uRev, rev >= NB ? 1e6 : rev);
      gl.uniform3f(U.uSea, D.SEA_TINT[0] / 255, D.SEA_TINT[1] / 255, D.SEA_TINT[2] / 255);
      gl.uniform3fv(U.uRamp, flat);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return { canvas: cv, upload, render, tmax: n => n + 6 };
  })();

  function bandGrid() {
    const key = S.fieldKey + '|' + S.ladder.join(',');
    if (S.bgKey === key) return S.bg;
    const dist = S.field.dist, L = S.ladder, out = S.bg && S.bg.length === GN ? S.bg : new Float32Array(GN);
    for (let c = 0; c < GN; c++) out[c] = bandT(dist[c], L);
    S.bg = out; S.bgKey = key;
    return out;
  }

  function drawField() {
    if (!S.field) return;
    if (GL) return drawFieldGL();
    return drawFieldCPU();
  }

  function drawFieldGL() {
    const ramp = rampOf(), NB = ramp.length;
    GL.upload(bandGrid(), NB + 6);
    const w = Math.round(Wc * DPR), h = Math.round(Hc * DPR);
    GL.render(w, h, [cx * DPR, cy * DPR], S.scale * DPR,
      [S.rotL, S.rotP], ramp, S.reveal);
    ctx.save();
    ctx.globalCompositeOperation = TH().blend;
    if (TH().glow) {
      try {
        ctx.filter = 'blur(6px)'; ctx.globalAlpha = 0.3;
        ctx.drawImage(GL.canvas, 0, 0, Wc, Hc);
        ctx.filter = 'none';
      } catch (e) { /* no filter support */ }
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(GL.canvas, 0, 0, Wc, Hc);
    ctx.restore();
  }

  function drawFieldCPU() {
    if (!S.field) return;
    const dist = bandGrid();
    const r = S.scale;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(Wc, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(Hc, Math.ceil(cy + r));
    const rw = x1 - x0, rh = y1 - y0;
    if (rw <= 2 || rh <= 2) return;

    /* One resolution, always full. Moving the globe is slower for it, but the
       isochrones stay sharp instead of smearing under the cursor. */
    const target = Math.min(1020, Math.max(rw, rh) * 1.06 * Math.min(1.5, DPR));
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

      // camera-space ray per pixel — unchanged by rotation, so cache it
      const geoKey = [bw, bh, x0, y0, rw, rh, Math.round(r * 10), Math.round(cx), Math.round(cy)].join(',');
      if (S.rayKey !== geoKey || !S.rayX || S.rayX.length < need) {
        S.rayX = new Float32Array(need); S.rayY = new Float32Array(need); S.rayZ = new Float32Array(need);
        for (let by = 0; by < bh; by++) {
          const sy = y0 + (by + 0.5) * rh / bh, Y = -(sy - cy) / r, Y2 = Y * Y;
          for (let bx = 0; bx < bw; bx++) {
            const q = by * bw + bx;
            const sx = x0 + (bx + 0.5) * rw / bw, X = (sx - cx) / r;
            const d2 = X * X + Y2;
            if (d2 > 1) { S.rayZ[q] = -1; continue; }
            S.rayX[q] = X; S.rayY[q] = Y; S.rayZ[q] = Math.sqrt(1 - d2);
          }
        }
        S.rayKey = geoKey;
      }
      const rayX = S.rayX, rayY = S.rayY, rayZ = S.rayZ;

      for (let p = 0; p < need; p++) {
        const Z = rayZ[p];
        if (Z < 0) { t[p] = -1; continue; }
        const Y = rayY[p], X = rayX[p];
        const a = Y * cosP - Z * sinP, b = Y * sinP + Z * cosP;
        const lat = Math.asin(a < -1 ? -1 : a > 1 ? 1 : a) * DEG;
        let lon = Math.atan2(X, b) * DEG - lon0;
        lon = ((lon + 180) % 360 + 360) % 360 - 180;
        const fi = (lon + 180) / RES - 0.5, fj = (90 - lat) / RES - 0.5;
        const i0 = Math.floor(fi), j0 = Math.min(GH - 2, Math.max(0, Math.floor(fj)));
        const u = fi - i0, v = fj - j0 < 0 ? 0 : fj - j0 > 1 ? 1 : fj - j0;
        const ia = ((i0 % GW) + GW) % GW, ib = (ia + 1) % GW;
        const r0 = j0 * GW, r1 = r0 + GW;
        const c00 = dist[r0 + ia], c10 = dist[r0 + ib];
        const c01 = dist[r1 + ia], c11 = dist[r1 + ib];
        t[p] = (c00 * (1 - u) + c10 * u) * (1 - v) + (c01 * (1 - u) + c11 * u) * v;
        lnd[p] = landMask[(v < 0.5 ? r0 : r1) + (u < 0.5 ? ia : ib)];
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
        const raw = t[p];
        let tv = raw;
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

        /* Isochrones are read from the unclamped value. Past the last
           threshold every pixel is held at NB - 0.0001, which the line test
           would see as sitting exactly on a threshold — and it painted a bright
           ring around Greenland and the pack ice. */
        let line = 0;
        if (raw < NB) {   // lines cost a gradient; restore them at rest
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
      ctx.globalCompositeOperation = TH().blend;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (TH().glow) {
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
    /* Sharpness is never traded away permanently. While the globe is actually
       being moved the band raster is sampled coarser so it keeps up; the moment
       you stop, it settles and redraws at full resolution. Only the raster
       changes — every layer stays on, so nothing appears or disappears. */
    drawScene();
  }

  /* any gesture marks the globe as in motion; it settles a moment after */
  function interacting() {
    S.interacting = true;
    if (S.pre) cancelLookahead();
    clearTimeout(S.settle);
    S.settle = setTimeout(() => {
      S.interacting = false; S.tKey = ''; S.bufKey = ''; draw();
    }, 220);
  }

  function drawScene() {
    const r = S.scale, zoom = r / (S.fit || r);
    proj.translate([cx, cy]).scale(r).rotate([S.rotL, S.rotP, 0]);
    ctx.clearRect(0, 0, Wc, Hc);

    const T = TH();
    if (T.glow) {
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

    const fine = zoom > 2.2;
    const landPath = layer(fine ? 'land' : 'landMed', fine ? LANDGEO : LANDMED);
    /* what the cached paths were cut at, against what is on screen now */
    const k = r / vec.s, iw = 1 / k;
    const globe = fn => {
      ctx.save();
      ctx.transform(k, 0, 0, k, cx * (1 - k), cy * (1 - k));
      fn();
      ctx.restore();
    };
    if (landPath) globe(() => { ctx.fillStyle = T.land; ctx.fill(landPath); });

    drawField();

    /* The bands are screen-blended, which flattens land against sea wherever
       they are bright. Wash the continents back over the top so the geography
       still reads underneath the glow. */
    // Lift the continents back out of the glow. This runs over the whole of
    // the land, reached or not, so a country you cannot get to at all still
    // reads as a country rather than as more ocean.
    if (landPath) globe(() => { ctx.fillStyle = 'rgba(146,182,236,.055)'; ctx.fill(landPath); });


    const bp = layer(fine ? 'borders' : 'bordersMed', fine ? BORDERS : BORDERMED);
    globe(() => {
      if (bp) {
        ctx.strokeStyle = T.borderHalo; ctx.lineWidth = 1.6 * iw; ctx.stroke(bp);
        ctx.strokeStyle = T.border; ctx.lineWidth = 0.6 * iw; ctx.stroke(bp);
      }
      if (landPath) {
        ctx.strokeStyle = T.coastHalo; ctx.lineWidth = 2 * iw; ctx.stroke(landPath);
        ctx.strokeStyle = T.coast; ctx.lineWidth = 0.8 * iw; ctx.stroke(landPath);
      }
    });


    // places — more of them the closer you look, never overlapping
    const LG = labelGeom();
    const cosP = Math.cos(S.rotP * RAD), sinP = Math.sin(S.rotP * RAD);
    const facing = (lon, lat) => {
      const l = (lon + S.rotL) * RAD, p = lat * RAD;
      return Math.cos(l) * Math.cos(p) * cosP - Math.sin(p) * sinP;
    };
    // grows with zoom, but bounded: past a few hundred the declutter rejects
    // nearly all of them anyway, and each still costs a projection
    const nShow = Math.round(Math.min(PLACES.length, 420, 22 + Math.pow(zoom, 1.8) * 28));
    ctx.font = '500 10px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const placed = [];
    for (let k = 0; k < nShow; k++) {
      const c = PLACES[k];
      const z = LG.z[k];
      if (z <= 0.04) continue;
      const p = [cx + r * LG.x[k], cy + r * LG.y[k]];
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
      const rm = D.MODES[S.mode].land ? D.MODES[S.mode] : byId.road;
      const kmh = rm.land[ei] / rm.duty[ei] * Math.pow(cMS[k] / D.ROAD_REF, D.ROAD_EXP[ei]);
      const bits = ['roads ' + (kmh < 10 ? kmh.toFixed(1) : Math.round(kmh)) + ' km/h'];
      bits.push(cRY[k] > yr ? 'no railway yet' : cRQ[k] === 0 ? 'no railway' : 'rail from ' + cRY[k]);
      if (cHY[k] <= yr) bits.push('high-speed since ' + cHY[k]);
      $('profile').innerHTML = '<b>' + cName[k] + '</b> · ' + bits.join(' · ');
    } else $('profile').innerHTML = '<b>At sea</b>';

    let far = 0, landTot = 0, landIn = 0, reached = 0;
    for (let j = 0; j < GH; j++) {
      const lat = latOf(j), w = Math.cos(lat * RAD);
      const row = j * GW;
      for (let i = 0; i < GW; i++) {
        const c = row + i, d = f.dist[c];
        if (d <= 24) { const km = gcDist(lo, la, lonOf(i), lat); if (km > far) far = km; }
        if (landMask[c] && terr[c] !== 5) {
          landTot += w;
          if (d <= 168) landIn += w;
          if (d > 0 && d < Infinity) reached++;
        }
      }
    }
    /* a start in open water on foot reaches nothing; say so rather than
       report the width of the cell you are standing in */
    const stranded = reached === 0;
    $('statDay').textContent = stranded ? '\u2014' : fmtKm(far);
    $('statDayNote').textContent = stranded ? 'nothing reachable' : 'farthest point';
    $('solveNote').textContent = '1\u2009036\u2009800 cells · solved in ' +
      (S.solveMs >= 1000 ? (S.solveMs / 1000).toFixed(1) + ' s' : S.solveMs + ' ms');
    const pct = landIn / landTot * 100;
    $('statWeek').textContent = stranded ? '\u2014' : (pct < 1 ? pct.toFixed(1) : Math.round(pct)) + '%';

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
    const H = t => b.push('<h4>' + t + '</h4>');
    const N = n => n.toLocaleString('en').replace(/,/g, '\u2009');
    const HR = h => h < 2 ? Math.round(h * 60) + ' min' : h + ' h';
    const L = items => b.push('<ul>' + items.map(i => '<li>' + i + '</li>').join('') + '</ul>');

    H('Grid');
    L(['0.25\u00b0, 1\u2009036\u2009800 cells',
       'Each cell holds its road class, railway, ferry route, terrain and country',
       'Quickest route found by least-cost path (Dial\u2019s Dijkstra), after ' +
         A('https://www.nature.com/articles/nature25181', 'Weiss et al. 2018')]);

    H('Roads');
    L(['Country speed from the ' +
         A('https://www.imf.org/en/Publications/WP/Issues/2022/05/13/Road-Quality-and-Mean-Speed-Score-517801', 'IMF Mean Speed score') +
         ': 38 km/h in Bhutan, 107 in the United States' +
         '<ul><li>the score sets relative quality, the year sets the speed</li></ul>',
       'Class multiplier after ' +
         A('https://openaccess.thecvf.com/content_WACV_2020/papers/Van_Etten_City-Scale_Road_Extraction_from_Satellite_Imagery_v2_Road_Speeds_and_WACV_2020_paper.pdf', 'Van Etten 2020') +
         '<ul><li>motorway 105 km/h</li><li>residential 40</li><li>dirt track 24</li></ul>',
       'Terrain cuts it to ' + Math.round(D.TERRAIN_MUL[5][ei] * 100) + '\u2013' +
         Math.round(D.TERRAIN_MUL[2][ei] * 100) + '% (ice to desert)']);

    if ((M.rail || M.best) && D.RAIL[ei] > 0) {
      H('Rail');
      const r = ['37\u2009487 cells, main lines and branches separated',
        'Each country gets its own opening year and service quality',
        'Main line ' + N(D.RAIL[ei]) + ' km/day',
        HR(D.RAIL_BOARD[ei]) + ' to board the first train, ' + HR(D.RAIL_ALIGHT) + ' to alight, ' + HR(D.RAIL_BORDER[ei]) + ' at a frontier'];
      if (E.y >= 1964) r.push('High-speed track from ' +
        A('https://wiki.openstreetmap.org/wiki/Key:highspeed', 'OpenStreetMap') +
        ', run at 75% of its line speed' +
        '<ul><li>320 km/h LGV: 240</li><li>300 km/h ICE line: 225</li></ul>');
      if (E.y >= 1900) r.push('Anchored on published timings' +
        '<ul><li>Trans-Siberian 70\u201390 km/h</li>' +
        (E.y >= 1950 ? '<li>Rajdhani 83\u201398</li>' : '') + '</ul>');
      if (E.y >= 1950) r.push('Still no working line: Central African Republic, Chad, Somalia, Bhutan');
      if (ei === 7) r.push('Checked against 166 real journeys today (' +
        A('https://transitous.org', 'Transitous') + ', operator timetables): 92% within a quarter, median 0.94');
      L(r);
    }

    if (M.land) {
      H('Pace');
      L([Math.round(M.land[ei] / M.duty[ei] * 10) / 10 + ' km/h, ' + M.duty[ei] + ' h a day',
         'Short trips run at full speed. Only long ones pay for nights and rests',
         'Walking set by ' + A('https://en.wikipedia.org/wiki/Tobler%27s_hiking_function', 'Tobler\u2019s hiking function') +
           ': 5 km/h flat, 2\u20134 over a real day']);
    }

    H('Water');
    if (M.sea === 'ship')
      L(['Open sea ' + N(D.WATER[ei]) + ' km/day, around the clock',
         'Navigable rivers ' + N(D.RIVER[ei]) + ' km/day',
         HR(D.PORT_H[ei]) + ' to board or land',
         E.y < 1869 ? 'No Suez, no Panama. Every ship rounds the Cape' : 'Suez open from 1869, Panama from 1914'
         ].concat(ei === 0 ? ['Sail figures are progress made good, from ' +
           A('https://www.rmg.co.uk/stories/maritime-history/library-archive/18th-century-sailing-times-between-english-channel-coast', 'Royal Museums Greenwich') +
           '<ul><li>30\u201340 days out to the Indies</li><li>50\u201370 back</li></ul>'] : []));
    else
      L(['You stay on land. Open water takes no colour',
         '314 scheduled ferry routes, the longest 1\u2009281 km. None crosses an ocean'
         ].concat(E.y >= 1950 ? ['Fixed links count as land from their opening year' +
           '<ul><li>Kanmon 1942, Bosphorus 1973</li><li>Seikan 1988, Channel Tunnel 1994</li></ul>'] : []));

    if (M.air && D.AIR[ei]) {
      const a = D.AIR[ei];
      H('Air');
      L(['Chartered, not timetabled. The limit is the aircraft',
         N(AIRPORTS.filter(x => x.r <= D.AIR_RANK[ei] && (!x.y || x.y <= E.y)).length) + ' airfields, from ' +
           A('https://ourairports.com/data/', 'OurAirports') + ' and Natural Earth',
         N(a.cruise) + ' km/h, range ' + N(a.range) + ' km',
         HR(a.board) + ' to get airborne, ' + HR(a.stop) + ' a refuelling stop']);
    }

    H('Corrections');
    L(['Grid routes cut corners. Land time divided by ' + D.ROAD_CIRC + ' road, ' + D.RAIL_CIRC + ' rail',
       'One scale per plot: 18 steps up to the 97th percentile of what is reachable. Zoom does not move it']);

    H('Limits');
    L(['An illustrative model, not routing data',
       'Ignores wind, monsoon, timetables, borders, war, weather',
       'Assumes you always catch the best connection']);
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
      S.fieldKey = fieldKey(S.origin.lon, S.origin.lat, S.mode, S.era);
      S.field = getField(S.origin.lon, S.origin.lat, S.mode, S.era);
      S.solveMs = Math.round(performance.now() - t0);
      S.fieldGen = (S.fieldGen || 0) + 1;
      S.tKey = '';
      refreshLadder();
      document.body.classList.remove('solving');
      updateReadout(); updateMethod();
      if (animateIn) animate(0); else { S.reveal = 99; draw(); }
      lookahead();
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
      S.mode = +b.dataset.m;
      $('travel').open = false;               // fold back to the one in use
      syncControls(); recompute(true);
      if (S.mobile) document.body.classList.remove('sheet-open');
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
      b.addEventListener('click', () => {
        S.era = k; syncControls(); recompute(true);
        if (S.mobile) document.body.classList.remove('sheet-open');
      });
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
    const cur = D.MODES[S.mode];
    $('travelNow').innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + cur.icon + '"/></svg>' +
      '<span><b>' + cur.name + '</b><i>' + cur.vehicle[ei] + '</i></span>';
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

  /* One finger turns the globe, two pinch it. A mouse gets the same from a
     drag and the wheel. Touch needs a slacker slop before a press counts as a
     drag, because a finger never lands still. */
  let down = null, moved = 0, dragRaf = 0, pinch = null, lastTap = 0;
  const pointers = new Map();
  const redraw = () => { if (!dragRaf) dragRaf = requestAnimationFrame(() => { dragRaf = 0; draw(); }); };
  const zoomTo = k => {
    const fit = S.fit || 300;
    S.scale = Math.max(fit * .78, Math.min(fit * 12, k));
    S.tKey = ''; interacting(); redraw();
  };
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  cv.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cv.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      pinch = { d: spread(), s: S.scale };
      down = null;                                   // no rotating mid-pinch
      $('tip').hidden = true;
      return;
    }
    if (pointers.size > 2) return;
    down = { x: e.clientX, y: e.clientY, rl: S.rotL, rp: S.rotP, touch: e.pointerType !== 'mouse' };
    moved = 0; S.dragging = false;
  });

  cv.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const d = spread();
      if (pinch.d > 8) zoomTo(pinch.s * d / pinch.d);
      return;
    }
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved > (down.touch ? 9 : 3)) {
        if (!S.dragging) { S.dragging = true; cv.classList.add('dragging'); unpinTip(); }
        const k = 130 / S.scale;
        S.rotL = down.rl + dx * k;
        S.rotP = Math.max(-90, Math.min(90, down.rp - dy * k));
        S.tKey = '';
        // a pointer can fire far faster than the screen refreshes; coalesce
        interacting();
        redraw();
      }
      return;
    }
    if (e.pointerType === 'mouse') hover(e.clientX, e.clientY);
  });

  const release = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    const wasDrag = S.dragging;
    if (down && !wasDrag && moved <= (down.touch ? 9 : 3)) {
      const ll = screenToLonLat(e.clientX, e.clientY);
      if (ll) {
        if (!down.touch) setOrigin(ll[0], ll[1]);
        else {
          const now = performance.now();
          if (now - lastTap < 320) { lastTap = 0; zoomTo(S.scale * 1.7); unpinTip(); }
          else { lastTap = now; hover(e.clientX, e.clientY, ll); }
        }
      }
    }
    down = null;
    if (wasDrag) {
      cancelAnimationFrame(dragRaf); dragRaf = 0;
      S.dragging = false; cv.classList.remove('dragging');
      draw();
    }
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') $('tip').hidden = true; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    zoomTo(S.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }, { passive: false });
  cv.addEventListener('dblclick', e => e.preventDefault());

  /* On a mouse this follows the cursor. On a touch screen there is no hover,
     so a tap pins it instead: the time to that place, and the choice of
     starting again from there. Without it a phone could read no time at all
     except by moving the origin. */
  function hover(sx, sy, ll) {
    const tip = $('tip'), pin = !!ll;
    ll = ll || screenToLonLat(sx, sy);
    if (!ll || !S.field) { unpinTip(); return; }
    const c = nearestPlace(ll[0], ll[1], 14000 / S.scale * 9);
    const lon = c ? c.lon : ll[0], lat = c ? c.lat : ll[1];
    const t = timeAt(S.field, lon, lat);
    const k = countryAt(lon, lat);
    const name = c ? c.n : (k >= 0 ? cName[k] : 'Open sea');
    tip.innerHTML = '<b>' + name + '</b><span>' + fmtDur(t) + '</span>' +
      (pin ? '<button type="button" data-go>Start here</button>' : '');
    tip.classList.toggle('pin', pin);
    const below = sy < 120;
    tip.classList.toggle('below', below);
    tip.style.left = Math.max(92, Math.min(Wc - 92, sx)) + 'px';
    tip.style.top = sy + 'px';
    tip.hidden = false;
    if (pin) tipAt = [lon, lat];
  }
  let tipAt = null;
  function unpinTip() {
    const tip = $('tip');
    tip.hidden = true; tip.classList.remove('pin', 'below'); tipAt = null;
  }
  $('tip').addEventListener('click', e => {
    if (!e.target.closest('[data-go]') || !tipAt) return;
    const [lon, lat] = tipAt;
    unpinTip();
    setOrigin(lon, lat);
  });

  function setOrigin(lon, lat, name, recentre) {
    unpinTip();
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

  /* ================= the sheet, on a phone =================
     It rests at the peek height and is dragged or tapped up. Dragging tracks
     the finger so it never feels like a button that happens to animate. */
  function setupSheet() {
    const pn = $('panel'), gb = $('grab');
    const openSheet = v => {
      document.body.classList.toggle('sheet-open', v);
      if (v) unpinTip(); else pn.scrollTop = 0;
    };
    let g = null;
    // the handle, the place and its coordinates all take the drag
    const onHandle = t => t === gb || t.id === 'originName' || t.id === 'originCoord';
    pn.addEventListener('pointerdown', e => {
      if (!S.mobile || !onHandle(e.target)) return;
      g = { y: e.clientY, open: document.body.classList.contains('sheet-open'), moved: 0 };
      gb.setPointerCapture(e.pointerId);
      pn.classList.add('dragging');
      unpinTip();
    });
    gb.addEventListener('pointermove', e => {
      if (!g) return;
      const dy = e.clientY - g.y;
      g.moved = Math.max(g.moved, Math.abs(dy));
      const rest = g.open ? 0 : pn.offsetHeight - (S.peekPx || 188);
      const y = Math.max(0, Math.min(pn.offsetHeight - 40, rest + dy));
      pn.style.transform = 'translateY(' + y + 'px)';
    });
    const end = () => {
      if (!g) return;
      pn.classList.remove('dragging');
      pn.style.transform = '';
      const m = g.moved, was = g.open;
      g = null;
      if (m < 6) openSheet(!was);                      // a tap toggles
      else openSheet(was ? m < 70 : m > 44);           // a drag goes where it was headed
    };
    gb.addEventListener('pointerup', end);
    gb.addEventListener('pointercancel', end);
    gb.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); openSheet(!document.body.classList.contains('sheet-open'));
      }
    });

    // reaching for the globe puts the sheet away
    cv.addEventListener('pointerdown', () => {
      if (S.mobile && document.body.classList.contains('sheet-open')) openSheet(false);
    }, true);
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
      /* A phone fires resize for every pixel the address bar slides, and a
         full redraw is far too expensive to run on each one. */
      let rt = 0;
      const scheduleSize = () => { clearTimeout(rt); rt = setTimeout(stageSize, 90); };
      window.addEventListener('resize', scheduleSize);
      window.addEventListener('orientationchange', () => setTimeout(stageSize, 220));
      if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleSize);
      setupSheet();
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

  /* on a local server only: the pieces a test harness needs to drive the
     model without going through the pointer */
  /* Checks the model against real scheduled journey times in calibration.json
     (Transitous for Europe, operator timetables elsewhere), one solve per
     origin. Takes a slice of origins so a harness can run it in pieces. */
  async function calibrate(k0, k1, mode, era) {
    const cal = await (await fetch('calibration.json')).json();
    const byFrom = new Map();
    for (const q of cal.pairs) {
      if (q.hours == null) continue;
      if (!byFrom.has(q.from)) byFrom.set(q.from, []);
      byFrom.get(q.from).push(q);
    }
    const rows = [];
    for (const fr of [...byFrom.keys()].slice(k0 || 0, k1 || 1e9)) {
      const ps = byFrom.get(fr), [la, lo] = ps[0].fromLL;
      const f = getField(lo, la, mode == null ? 4 : mode, era == null ? 7 : era);
      for (const q of ps) {
        const t = f.dist[landCellOf(q.toLL[1], q.toLL[0])];
        rows.push({ from: q.from, to: q.to, real: q.hours, model: +t.toFixed(2), ratio: +(t / q.hours).toFixed(2), src: q.src || 'transitous' });
      }
    }
    return rows;
  }
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
    window.__iso = { S, setOrigin, recompute, draw, fieldLadder, timeAt, fieldCache, getField, landCellOf, calibrate };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
