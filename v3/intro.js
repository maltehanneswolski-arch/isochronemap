/* The way in. A figure drawn by hand stands on a line. Scroll, and it sets
   off: walking, then running, then steering a steamer, cycling, driving and
   flying, in the order they were invented, each captioned with its year. The
   plane climbs out of the frame, and the line it leaves behind curls up into
   a circle, which is the rim of the globe. The graticule is sketched in, and
   when it is done the bare globe is inside it, asking where to start. Nothing
   is solved until you answer, so the drawing never waits on the solver.

   The scroll decides the means of travel. The legs, wheels, waves and smoke
   keep moving in time, so the figure never freezes mid-stride when you stop.
   The world is built underneath while you scroll; if you get to the end
   first, the circle waits for it. ?nointro skips all of this. */
(function () {
  'use strict';
  if (/[?&]nointro\b/.test(location.search)) return;
  window.ISO_HOLD = true;
  window.ISO_ASK = true;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2, RAD = Math.PI / 180;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mixP = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

  /* ================= the page around it ================= */
  const style = document.createElement('style');
  style.textContent = `
html.intro-on #brand,html.intro-on #panel,html.intro-on #timeline,html.intro-on #boot{visibility:hidden}
#intro{position:fixed;inset:0;z-index:40;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;
  scrollbar-width:none;outline:none;-webkit-overflow-scrolling:touch}
#intro::-webkit-scrollbar{display:none}
#intro .istage{position:sticky;top:0;height:100%;overflow:hidden}
#intro .ibg{position:absolute;inset:0;background:var(--ink);transition:opacity .9s var(--ease)}
#intro canvas{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
#intro .irun{height:500%}
#intro .ititle{position:absolute;left:0;right:0;top:14vh;padding:0 22px;text-align:center;pointer-events:none}
#intro .ih{margin:0;font-family:var(--font-d);font-weight:500;font-size:clamp(34px,6vw,62px);line-height:1;
  letter-spacing:-.01em;color:var(--head)}
#intro .il{margin:14px auto 0;max-width:27em;font-size:var(--fs-m);line-height:1.45;color:var(--text-dim);
  text-wrap:balance}
#intro .icap{position:absolute;left:0;right:0;top:0;margin:0;text-align:center;pointer-events:none;
  font-family:var(--font-d);font-weight:500;font-size:clamp(28px,3.4vw,42px);letter-spacing:.01em;color:var(--text)}
#intro .ihint{position:absolute;left:0;right:0;bottom:calc(24px + env(safe-area-inset-bottom));margin:0;text-align:center;
  pointer-events:none;font-size:var(--fs-xs);letter-spacing:.16em;text-transform:uppercase;font-weight:600;
  color:var(--text-faint)}
#intro .ihint::after{content:"";display:block;width:1px;height:28px;margin:10px auto 0;
  background:linear-gradient(var(--line),rgba(201,212,228,0));transform-origin:top;animation:ihint 2s var(--ease) infinite}
@keyframes ihint{0%{transform:scaleY(0);opacity:1}60%{transform:scaleY(1);opacity:1}100%{transform:scaleY(1);opacity:0}}
#intro .iwait{position:absolute;left:0;right:0;bottom:12vh;margin:0;text-align:center;pointer-events:none;
  font-family:var(--font-m);font-size:var(--fs-xs);letter-spacing:.06em;color:var(--text-faint);
  opacity:0;transition:opacity .4s var(--ease)}
#intro.waiting .iwait{opacity:1}
#intro .iskip{position:absolute;top:calc(14px + env(safe-area-inset-top));right:calc(16px + env(safe-area-inset-right));
  min-height:40px;padding:0 14px;border:1px solid var(--line-dim);background:rgba(5,7,14,.6);
  font-size:var(--fs-xs);letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:var(--line);
  transition:border-color .2s var(--ease),opacity .5s var(--ease)}
#intro .iskip:hover{border-color:var(--line)}
#intro.leaving{pointer-events:none}
#intro.leaving .ibg,#intro.leaving .iskip,#intro.leaving .icap,#intro.leaving .iwait{opacity:0}
#intro.fast .ibg{transition-duration:.35s}
`;
  document.head.appendChild(style);
  document.documentElement.classList.add('intro-on');

  const root = document.createElement('div');
  root.id = 'intro';
  root.tabIndex = -1;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Introduction. Scroll to go on, or skip it.');
  /* The drawing sits in a sticky layer inside the scrolling box, not in fixed
     layers over it: a wheel turned over a fixed element scrolls the page, which
     cannot scroll, and the box underneath never hears of it. */
  root.innerHTML =
    '<div class="istage"><div class="ibg"></div><canvas aria-hidden="true"></canvas>' +
    '<div class="ititle"><p class="ih">Isochronic Globe</p>' +
    '<p class="il">How far you could get from any point on Earth, in any year since 1750.</p></div>' +
    '<p class="icap" aria-live="polite"></p>' +
    '<p class="ihint" aria-hidden="true">Scroll to set off</p>' +
    '<p class="iwait" aria-hidden="true">building the world&hellip;</p>' +
    '<button class="iskip" type="button">Skip the intro</button></div>' +
    '<div class="irun"></div>';
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
  const elTitle = root.querySelector('.ititle'), elHint = root.querySelector('.ihint');
  const elCap = root.querySelector('.icap');

  /* ================= the figure =================
     Lengths are in figure heights (FH); y is up from the ground. Angles are
     from straight down, positive forward, the way the figure is heading. */
  const TH = 0.25, SH = 0.25, TO = 0.3, NK = 0.045, HR = 0.085, UA = 0.16, FA = 0.155;
  const GAIT = [
    { at: 0, ak: 0, k0: 0.02, sp: 0.1, lean: 0.02, aa: 0.04, a0: 0.1, el: 0.12, air: 0 },       // standing
    { at: 0.38, ak: 0.62, k0: 0.06, sp: 0, lean: 0.05, aa: 0.34, a0: 0.05, el: 0.28, air: 0 },   // walking
    { at: 0.7, ak: 1.5, k0: 0.18, sp: 0, lean: 0.22, aa: 0.7, a0: 0.1, el: 1.5, air: 0.04 }      // running
  ];
  const gaitAt = s => {
    const a = GAIT[Math.floor(clamp(s, 0, 1.999))], b = GAIT[Math.ceil(clamp(s, 0, 2))], t = s - Math.floor(clamp(s, 0, 1.999));
    const o = {};
    for (const k in a) o[k] = lerp(a[k], b[k], clamp(t, 0, 1));
    return o;
  };

  function gaitPose(phi, g, breath) {
    const leg = off => {
      const q = phi + off;
      const a1 = g.at * Math.sin(q) + (off ? -g.sp : g.sp);
      const kn = g.k0 + g.ak * Math.pow(Math.max(0, Math.cos(q + 0.8)), 2);
      const a2 = a1 - kn;
      const k = [Math.sin(a1) * TH, -Math.cos(a1) * TH];
      return [k, [k[0] + Math.sin(a2) * SH, k[1] - Math.cos(a2) * SH]];
    };
    const [k1, f1] = leg(Math.PI), [k2, f2] = leg(0);         // the far leg half a stride behind
    const hy = -Math.min(f1[1], f2[1]) + g.air * Math.pow(Math.max(0, Math.cos(2 * phi)), 2) + (breath || 0);
    const up = p => [p[0], p[1] + hy];
    const L = g.lean;
    const sh = [Math.sin(L) * TO, hy + Math.cos(L) * TO];
    const nk = [sh[0] + Math.sin(L * .6) * NK, sh[1] + Math.cos(L * .6) * NK];
    const hd = [nk[0] + Math.sin(L * .6) * HR, nk[1] + Math.cos(L * .6) * HR];
    const arm = off => {
      const a1 = -g.aa * Math.sin(phi + off) + g.a0 + (breath || 0) * 4, a2 = a1 + g.el;
      const e = [sh[0] + Math.sin(a1) * UA, sh[1] - Math.cos(a1) * UA];
      return [e, [e[0] + Math.sin(a2) * FA, e[1] - Math.cos(a2) * FA]];
    };
    const [e1, h1] = arm(Math.PI), [e2, h2] = arm(0);          // each arm swings against its own leg
    return { hip: [0, hy], k1: up(k1), f1: up(f1), k2: up(k2), f2: up(f2), sh, nk, hd, e1, h1, e2, h2 };
  }

  // two bones from a root to a target; bend +1 puts the joint forward, -1 below
  function ik(a, b, l1, l2, bend) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-4);
    const ang = Math.atan2(dy, dx);
    const t = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const j = [a[0] + Math.cos(ang + bend * t) * l1, a[1] + Math.sin(ang + bend * t) * l1];
    return [j, [a[0] + Math.cos(ang) * d, a[1] + Math.sin(ang) * d]];
  }
  function upper(hip, lean, headLean) {
    const sh = [hip[0] + Math.sin(lean) * TO, hip[1] + Math.cos(lean) * TO];
    const nk = [sh[0] + Math.sin(headLean) * NK, sh[1] + Math.cos(headLean) * NK];
    return { sh, nk, hd: [nk[0] + Math.sin(headLean) * HR, nk[1] + Math.cos(headLean) * HR] };
  }
  function seated(hip, lean, headLean, feet, hands, kneeBend) {
    const u = upper(hip, lean, headLean);
    const L1 = ik(hip, feet[0], TH, SH, kneeBend), L2 = ik(hip, feet[1], TH, SH, kneeBend);
    const A1 = ik(u.sh, hands[0], UA, FA, -1), A2 = ik(u.sh, hands[1], UA, FA, -1);
    return { hip, k1: L1[0], f1: L1[1], k2: L2[0], f2: L2[1], sh: u.sh, nk: u.nk, hd: u.hd,
             e1: A1[0], h1: A1[1], e2: A2[0], h2: A2[1] };
  }

  /* ================= the means of travel ================= */
  const BIKE = { RA: [-0.33, 0.19], FA: [0.34, 0.19], BB: [-0.02, 0.17], ST: [-0.12, 0.52], HT: [0.21, 0.5],
                 HB: [0.24, 0.41], R: 0.19, CR: 0.075 };
  const pedals = th => [
    [BIKE.BB[0] + BIKE.CR * Math.cos(th), BIKE.BB[1] + BIKE.CR * Math.sin(th)],
    [BIKE.BB[0] - BIKE.CR * Math.cos(th), BIKE.BB[1] - BIKE.CR * Math.sin(th)]];
  const bikePose = th => { const p = pedals(th); return seated([-0.12, 0.57], 0.62, 0.35, [p[1], p[0]], [[0.26, 0.6], [0.27, 0.6]], 1); };
  const carPose = () => seated([-0.14, 0.27], -0.08, -0.05, [[0.22, 0.17], [0.24, 0.16]], [[0.13, 0.53], [0.15, 0.52]], 1);
  /* The steamer has a wheelhouse, and the figure stands at the wheel inside
     it, seen through the window, both hands on the rim as it turns. */
  const DECK = 0.3, WHEEL = { c: [0.3, 1.02], r: 0.11 };
  let steer = 0;
  const steerPose = (phi, breath) => {
    const p = gaitPose(phi, GAIT[0], breath), o = {};
    for (const k in p) o[k] = [p[k][0], p[k][1] + DECK];
    const c = WHEEL.c, r = WHEEL.r, grip = a => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
    const A1 = ik(o.sh, grip(Math.PI - 0.5 + steer), UA, FA, -1), A2 = ik(o.sh, grip(Math.PI + 0.45 + steer), UA, FA, -1);
    o.e1 = A1[0]; o.h1 = A1[1]; o.e2 = A2[0]; o.h2 = A2[1];
    return o;
  };
  // low in the seat, so the head sits well inside the canopy
  const pilotPose = () => seated([0.12, 0.28], 0.1, 0.06, [[0.48, 0.28], [0.5, 0.27]], [[0.34, 0.47], [0.35, 0.46]], 1);
  const mixPose = (a, b, t) => { const o = {}; for (const k in a) o[k] = mixP(a[k], b[k], t); return o; };

  const circ = (c, r, id, n) => {
    n = n || Math.max(12, Math.round(r * 90));
    const a0 = (id * 1.7) % TAU, out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (TAU + 0.32) * i / n;
      const rr = r * (1 + 0.035 * Math.sin(a * 2 + id));
      out.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]);
    }
    return out;
  };
  const spokes = (c, r, a) => [
    [[c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r], [c[0] - Math.cos(a) * r, c[1] - Math.sin(a) * r]],
    [[c[0] + Math.cos(a + TAU / 4) * r, c[1] + Math.sin(a + TAU / 4) * r],
     [c[0] - Math.cos(a + TAU / 4) * r, c[1] - Math.sin(a + TAU / 4) * r]]];

  function bikeStrokes(th, wa) {
    const B = BIKE, p = pedals(th);
    return [
      circ(B.RA, B.R, 11), circ(B.FA, B.R, 12),
      [B.RA, B.BB, B.ST, B.RA], [B.ST, B.HT], [B.BB, B.HB], [[0.2, 0.58], B.HT, B.HB, B.FA],
      [[0.2, 0.58], [0.29, 0.6]], [B.ST, [-0.13, 0.545]], [[-0.2, 0.545], [-0.06, 0.552]],
      ...spokes(B.RA, B.R * 0.92, wa), ...spokes(B.FA, B.R * 0.92, wa),
      [p[0], B.BB, p[1]]
    ];
  }
  const CAR_BODY = [[-0.86, 0.14], [-0.88, 0.3], [-0.8, 0.42], [-0.44, 0.47], [-0.36, 0.84], [0.06, 0.87],
                    [0.34, 0.5], [0.76, 0.45], [0.88, 0.32], [0.86, 0.14], [-0.86, 0.14]];
  const CAR_WIN = [[-0.31, 0.5], [-0.27, 0.8], [0.04, 0.83], [0.27, 0.52], [-0.31, 0.5]];
  function carStrokes(wa) {
    const W1 = [-0.52, 0.15], W2 = [0.52, 0.15];
    return [
      CAR_BODY, CAR_WIN, [[0.09, 0.46], [0.19, 0.58]],
      circ(W1, 0.15, 21), circ(W2, 0.15, 22), circ(W1, 0.045, 23), circ(W2, 0.045, 24),
      ...spokes(W1, 0.13, wa).slice(0, 1), ...spokes(W2, 0.13, wa).slice(0, 1),
      circ([0.8, 0.36], 0.032, 25), [[-0.3, 0.46], [-0.3, 0.2]], [[0.3, 0.44], [0.3, 0.2]]
    ];
  }
  const SHIP_HULL = [[-1.7, DECK], [0.62, DECK], [0.95, 0.46], [0.78, -0.16], [-1.5, -0.16], [-1.76, 0.1], [-1.7, DECK]];
  const WHEELHOUSE = [[-0.22, DECK], [-0.22, 1.46], [0.5, 1.46], [0.5, DECK], [-0.22, DECK]];
  const WH_WINDOW = [[-0.12, 0.86], [-0.12, 1.37], [0.44, 1.37], [0.44, 0.86], [-0.12, 0.86]];
  const FUNNEL_TOP = [-0.62, 1.42];
  // behind the figure: hull, deckhouse, funnel, portholes
  function shipBack() {
    const holes = [-1.35, -1.05, -0.75, -0.45, -0.15, 0.15, 0.45].map((x, i) => circ([x, 0.12], 0.028, 31 + i, 10));
    return [
      SHIP_HULL,
      [[-1.45, DECK], [-1.45, 0.72], [-0.92, 0.72], [-0.92, DECK]], [[-1.35, 0.55], [-1.02, 0.55]],
      [[-0.78, DECK], [-0.74, 1.4], [-0.5, 1.4], [-0.46, DECK]], [[-0.755, 1.22], [-0.485, 1.22]],
      ...holes
    ];
  }
  // in front of it: the wheelhouse walls, the roof with its flag, and the wheel
  function shipFront() {
    const c = WHEEL.c, r = WHEEL.r;
    const L = [WHEELHOUSE, WH_WINDOW, [[-0.28, 1.46], [0.56, 1.46]],
      [[0.14, 1.46], [0.14, 1.8]], [[0.14, 1.8], [0.32, 1.75], [0.14, 1.7]],
      circ(c, r, 61, 20), circ(c, 0.025, 62, 8)];
    for (let i = 0; i < 8; i++) {
      const a = steer + i * TAU / 8;
      L.push([[c[0] + Math.cos(a) * 0.025, c[1] + Math.sin(a) * 0.025], [c[0] + Math.cos(a) * r * 1.4, c[1] + Math.sin(a) * r * 1.4]]);
    }
    return L;
  }
  const PLANE_BODY = [[1.0, 0.44], [0.82, 0.56], [0.4, 0.6], [-0.5, 0.57], [-1.02, 0.54], [-1.02, 0.47],
                      [-0.5, 0.4], [0.62, 0.34], [0.94, 0.38], [1.0, 0.44]];
  const CANOPY = [[0.44, 0.6], [0.36, 0.88], [0.04, 0.9], [-0.06, 0.6], [0.44, 0.6]];
  const GLASS = [[0.37, 0.625], [0.31, 0.845], [0.07, 0.86], [0.0, 0.625], [0.37, 0.625]];
  function planeStrokes(pa, gear, wa) {
    const wing = [];
    for (let i = 0; i <= 18; i++) { const a = TAU * i / 18; wing.push([0.12 + Math.cos(a) * 0.42, 0.43 + Math.sin(a) * 0.045]); }
    const L = [
      PLANE_BODY, CANOPY, GLASS,
      [[-0.72, 0.56], [-0.94, 0.86], [-1.04, 0.86], [-1.02, 0.54]], [[-0.78, 0.5], [-1.14, 0.51]], wing,
      [[1.03, 0.42 - 0.22 * Math.cos(pa)], [1.03, 0.42 + 0.22 * Math.cos(pa)]]
    ];
    if (gear > 0.02) {
      const g = gear, wy = lerp(0.36, 0.075, g);
      L.push([[0.32, 0.35], [0.3, wy]], circ([0.3, wy], 0.075, 41), ...spokes([0.3, wy], 0.06, wa).slice(0, 1));
      L.push([[-0.88, 0.47], [-0.9, lerp(0.47, 0.07, g)]], circ([-0.9, lerp(0.47, 0.035, g)], 0.035, 42, 10));
    }
    return L;
  }

  /* ================= drawing by hand =================
     Every line is cut into short steps and each step nudged off true by a
     smooth wobble. The wobble is redrawn eight times a second, which is what
     makes a pencil line look alive on film. */
  let W = 0, H = 0, DPR = 1, FH = 150, X0 = 0, GY = 0, J = 0.7, LW = 2, SEG = 7, boil = 0;
  let tf = { x: 0, y: 0, r: 0 };
  const scr = p => {
    const c = Math.cos(tf.r), s = Math.sin(tf.r);
    return [X0 + (tf.x + p[0] * c - p[1] * s) * FH, GY - (tf.y + p[0] * s + p[1] * c) * FH];
  };
  function wobble(pts, id) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / SEG));
      for (let j = 0; j < n; j++) out.push([lerp(a[0], b[0], j / n), lerp(a[1], b[1], j / n)]);
    }
    out.push(pts[pts.length - 1]);
    const h1 = id * 12.9898 + boil * 78.233, h2 = id * 4.1414 + boil * 3.7;
    for (let i = 0; i < out.length; i++) {
      out[i][0] += (Math.sin(i * 0.9 + h1) * 0.6 + Math.sin(i * 0.37 + h2) * 0.4) * J;
      out[i][1] += (Math.sin(i * 0.8 + h2 * 1.3) * 0.6 + Math.sin(i * 0.41 + h1 * 0.7) * 0.4) * J;
    }
    return out;
  }
  // draw a list of polylines, the first `frac` of their length in the order given
  function ink(list, frac, alpha, col, w, idBase, screen) {
    if (frac <= 0.001 || alpha <= 0.003) return;
    const polys = list.map((pts, k) => wobble(screen ? pts.map(p => p.slice()) : pts.map(scr), idBase + k));
    let budget = Infinity;
    if (frac < 1) {
      let total = 0;
      for (const p of polys) for (let i = 1; i < p.length; i++) total += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      budget = total * frac;
    }
    ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = w || LW;
    ctx.beginPath();
    for (const p of polys) {
      if (budget <= 0) break;
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) {
        const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        if (budget < d) {
          const t = budget / d;
          ctx.lineTo(lerp(p[i - 1][0], p[i][0], t), lerp(p[i - 1][1], p[i][1], t));
          budget = 0; break;
        }
        ctx.lineTo(p[i][0], p[i][1]); budget -= d;
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function occlude(pts, alpha, hole) {
    if (alpha <= 0.003) return;
    ctx.globalAlpha = alpha; ctx.fillStyle = INK;
    ctx.beginPath();
    pts.map(scr).forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    if (hole) { hole.map(scr).forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
  }
  const INK = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#05070E';
  const FIG = '#DEE5F1', LINE = '#C9D4E4';

  function figureFar(p, a) {
    ink([[p.hip, p.k1, p.f1], [p.sh, p.e1, p.h1]], 1, a * 0.45, FIG, LW, 1);
  }
  function figureNear(p, a) {
    ink([[p.hip, p.sh, p.nk], circ(p.hd, HR, 4, 16), [p.hip, p.k2, p.f2], [p.sh, p.e2, p.h2]], 1, a, FIG, LW, 3);
  }

  /* ================= the ride, set by the scroll =================
     s runs 0 to 6: standing, walking, running, cycling, driving, sailing,
     flying. Each holds for a stretch of the scroll and hands over to the next. */
  const KEYS = [[0, 0], [0.035, 0], [0.085, 1], [0.15, 1], [0.195, 2], [0.26, 2], [0.305, 3], [0.38, 3],
                [0.425, 4], [0.5, 4], [0.545, 5], [0.62, 5], [0.665, 6], [1, 6]];
  const stageOf = p => {
    for (let i = 1; i < KEYS.length; i++) {
      const [p1, s1] = KEYS[i], [p0, s0] = KEYS[i - 1];
      if (p <= p1) return s0 === s1 ? s0 : lerp(s0, s1, sstep(p0, p1, p));
    }
    return 6;
  };
  // standing, walking, running, steamer, bicycle, car, plane; figure heights a second
  const SPEED = [0, 1.0, 2.3, 2.8, 3.4, 5.2, 7.5];
  const speedAt = s => lerp(SPEED[Math.floor(s)], SPEED[Math.ceil(s)], s - Math.floor(s));
  /* The year each came in: Fulton's Clermont on the Hudson, Starley's Rover
     safety bicycle, Benz's Motorwagen patent, the Wrights at Kitty Hawk. */
  const CAPS = ['', '', '', '1807', '1885', '1886', '1903'];
  const TAKEOFF = [0.69, 0.8], RING = [0.8, 0.94], GRAT = [0.925, 0.965], END = 0.968;

  /* where the globe will be: asked of the page once it is built, worked out
     the same way before that */
  function globeGeom() {
    const A = window.ISO_APP;
    if (A && A.booted) return A.geom();
    const mob = W <= 820 && H >= 480;
    if (mob) {
      const peek = 237, head = 58, h = H - peek - head;
      return { cx: W / 2, cy: head + h / 2, r: Math.min(W * 0.96, h * 0.96) / 2, rotL: 0.13, rotP: -51.51 };
    }
    const gutter = W > 1140 ? 302 : 284, foot = H > 620 ? 0 : 134;
    return { cx: (W - gutter) / 2, cy: (H - foot) / 2, r: Math.min((W - gutter) * 0.88, (H - foot) * 0.84) / 2,
             rotL: 0.13, rotP: -51.51 };
  }

  function size() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, root.clientWidth || innerWidth); H = Math.max(1, root.clientHeight || innerHeight);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    FH = clamp(Math.min(H * 0.2, W * 0.28), 88, 220);
    X0 = W / 2; GY = Math.round(H * 0.63);
    J = Math.max(0.55, FH * 0.0042); LW = Math.max(1.6, FH * 0.0135); SEG = Math.max(5, FH * 0.04);
    elCap.style.transform = 'translateY(' + Math.round(GY + FH * 0.3) + 'px)';
  }

  /* ================= state and the loop ================= */
  let P = 0, target = 0, last = performance.now(), time = 0;
  let off = 0, phi = 0, crank = 0, wheel = 0, prop = 0, puffT = 0, stepT = 0;
  const puffs = [];
  let G = null, leaving = null, waiting = false, finished = false, capNow = '';

  root.addEventListener('scroll', () => {
    const span = root.scrollHeight - root.clientHeight;
    target = span > 0 ? clamp(root.scrollTop / span, 0, 1) : 0;
  }, { passive: true });

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    tick(dt);
    if (!finished) requestAnimationFrame(frame);
  }
  function tick(dt) {
    time += dt;
    const dP = (target - P) * (1 - Math.exp(-dt * (reduced ? 40 : 7)));
    P += dP;
    if (Math.abs(target - P) < 1e-5) P = target;
    boil = reduced ? 1 : Math.floor(time * 8);

    const s = stageOf(P);
    const tRing = sstep(RING[0], RING[1], P);
    // with reduced motion nothing moves unless the scroll moves it
    const dT = reduced ? Math.abs(dP) * 40 : dt;
    stepT = dT;
    const v = speedAt(s) * (1 - tRing);
    off += v * dT;
    const g = gaitAt(Math.min(s, 2));
    phi += dT * (s < 2.5 ? v / (0.5 * Math.max(g.at, 0.25)) : 3);
    crank -= dT * v / BIKE.R / 2.4;
    wheel -= dT * v / 0.16;
    prop += dT * 55;
    steer = reduced ? 0 : 0.35 * Math.sin(time * 0.7);
    puffT += dT;

    if (!G) G = globeGeom();
    const gt = globeGeom(), kg = 1 - Math.exp(-dt * 6);
    for (const k of ['cx', 'cy', 'r']) G[k] = lerp(G[k], gt[k], kg);
    G.rotL = gt.rotL; G.rotP = gt.rotP;

    draw(s, tRing);
    words(s);

    if (!leaving && P >= END) {
      if (window.ISO_APP && window.ISO_APP.booted) finish(false);
      else if (!waiting) { waiting = true; root.classList.add('waiting'); }
    }
  }

  function words(s) {
    const fadeTop = 1 - sstep(0.012, 0.045, P);
    elTitle.style.opacity = fadeTop.toFixed(3);
    elTitle.style.transform = 'translateY(' + (-(1 - fadeTop) * 18).toFixed(1) + 'px)';
    elHint.style.opacity = fadeTop.toFixed(3);
    const k = Math.round(s), near = 1 - clamp(Math.abs(s - k) * 2.6, 0, 1);
    const cap = CAPS[k] || '';
    let a = cap ? near : 0;
    if (k === 6) a *= 1 - sstep(0.73, 0.78, P);
    if (cap !== capNow) { capNow = cap; elCap.textContent = cap; }
    elCap.style.opacity = a.toFixed(3);
  }

  function draw(s, tRing) {
    ctx.clearRect(0, 0, W, H);
    const fade = leaving ? 1 - clamp((performance.now() - leaving.t0) / leaving.dur, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = 1;

    const pres = v => clamp(1 - Math.abs(s - v), 0, 1);
    const k = sstep(TAKEOFF[0], TAKEOFF[1], P);
    const standness = clamp(1 - s, 0, 1) + pres(3);
    const breath = reduced ? 0 : Math.sin(time * 1.8) * 0.004 * standness;

    /* ---- the pose, handed from one means of travel to the next ---- */
    let pose;
    const a = Math.floor(s), t = s - a;
    const poseOf = st => st <= 2 ? gaitPose(phi, gaitAt(st), breath) : st === 3 ? steerPose(phi, breath) :
      st === 4 ? bikePose(crank) : st === 5 ? carPose() : pilotPose();
    if (s <= 2) pose = gaitPose(phi, gaitAt(s), breath);
    else if (t < 1e-3) pose = poseOf(a);
    else pose = mixPose(poseOf(a), poseOf(a + 1), sstep(0, 1, t));

    /* ---- the rig: the ship rocks, the plane climbs ---- */
    const ps = pres(3);
    tf = { x: 0, y: 0, r: 0 };
    if (ps > 0) {
      tf.y += (reduced ? 0 : Math.sin(time * 1.6) * 0.018) * ps;
      tf.r += (reduced ? 0 : Math.sin(time * 1.25) * 0.035) * ps;
    }
    if (k > 0) {
      tf.x += k * k * (W * 0.72) / FH;
      tf.y += Math.pow(k, 1.7) * (H * 0.95) / FH;
      tf.r += 0.3 * sstep(0, 0.35, k) * (1 - 0.4 * sstep(0.6, 1, k));
    }
    const shown = 1 - sstep(0.93, 1, k);                        // gone once out of the frame

    if (shown > 0) {
      // behind the figure: the bicycle and the body of the ship
      figureFar(pose, shown);
      const pb = pres(4);
      if (pb > 0) ink(bikeStrokes(crank, wheel), sstep(0, 1, pb), 1, LINE, LW, 100);
      if (ps > 0) {
        smoke(ps);
        occlude(SHIP_HULL, ps);
        ink(shipBack(), sstep(0, 1, ps), 1, LINE, LW, 200);
      }
      figureNear(pose, shown);
      // in front of it: the wheelhouse, the car and the plane, which hide what they hold
      if (ps > 0) {
        occlude(WHEELHOUSE, ps, WH_WINDOW);
        ink(shipFront(), sstep(0, 1, ps), 1, LINE, LW, 250);
      }
      const pc = pres(5);
      if (pc > 0) {
        occlude(CAR_BODY, pc, CAR_WIN);
        ink(carStrokes(wheel), sstep(0, 1, pc), 1, LINE, LW, 300);
      }
      const pp = pres(6);
      if (pp > 0) {
        occlude(PLANE_BODY, pp);
        occlude(CANOPY, pp, GLASS);
        ink(planeStrokes(prop, 1 - sstep(0.2, 0.5, k), wheel), sstep(0, 1, pp), shown, LINE, LW, 400);
      }
    }

    /* ---- the ground, which becomes the rim of the globe ---- */
    tf = { x: 0, y: 0, r: 0 };
    ground(s, tRing, fade);
    if (tRing >= 0.999) graticule(sstep(GRAT[0], GRAT[1], P), fade);
    ctx.restore();
  }

  function smoke(a) {
    const top = FUNNEL_TOP;
    if (!reduced && puffT > 0.42) { puffT = 0; puffs.push({ t: 0 }); }
    for (const q of puffs) q.t += reduced ? 0 : stepT;
    while (puffs.length && puffs[0].t > 3.2) puffs.shift();
    const list = reduced ? [{ t: 0.6 }, { t: 1.4 }, { t: 2.2 }] : puffs;
    for (const q of list) {
      const c = [top[0] - q.t * 0.34, top[1] + 0.06 + q.t * 0.1];
      const r = 0.035 + q.t * 0.05;
      ink([circ(c, r, 50 + Math.round(q.t * 10) % 7, 14)], 1, a * 0.5 * (1 - q.t / 3.2), LINE, LW * 0.8, 500);
    }
  }

  function ground(s, tRing, fade) {
    const water = clamp(1 - Math.abs(s - 3), 0, 1);
    const A = 0.028 * FH * sstep(0, 1, water), lam = 0.5;
    const yAt = x => GY - A * Math.sin(TAU * ((x - X0) / FH + off) / lam + (reduced ? 0 : time * 0.9));
    if (tRing <= 0.001) {
      const pts = [];
      for (let x = -24; x <= W + 24; x += 8) pts.push([x, yAt(x)]);
      // below the line is water or earth: hide what sits beneath it
      ctx.fillStyle = INK; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(-24, H + 10);
      for (const p of pts) ctx.lineTo(p[0], p[1] + LW * 0.6);
      ctx.lineTo(W + 24, H + 10); ctx.closePath(); ctx.fill();
      ink([pts], 1, 0.92 * fade, LINE, LW, 900, true);
      marks(yAt, 1 - water, water, 1);
      return;
    }
    /* The line keeps its length and bends: an arc of ever tighter radius
       whose lowest point walks down to the bottom of the globe, until its two
       ends meet at the top and it is the globe's rim. */
    const R = G.r, L0 = Math.max(W + 240, TAU * R, 2 * (Math.max(G.cx, W - G.cx) + 60)), e = sstep(0, 1, tRing);
    const len = lerp(L0, TAU * R, e), span = TAU * tRing;
    const bx = G.cx, by = lerp(GY, G.cy + R, sstep(0, 0.6, tRing));   // down to the rim early, so the ends stay in view
    const rho = len / span, cxA = bx, cyA = by - rho;
    const n = 220, pts = [];
    for (let i = 0; i <= n; i++) {
      const aa = Math.PI / 2 + span * (i / n - 0.5);
      pts.push([cxA + rho * Math.cos(aa), cyA + rho * Math.sin(aa)]);
    }
    ink([pts], 1, 0.92 * fade, LINE, LW * (1 + 0.15 * e), 900, true);
    const fm = 1 - sstep(0, 0.12, tRing);
    if (fm > 0) marks(yAt, fm, 0, fm);
  }

  // hatching under the earth, small crests on the water; they ride with the ground
  const hs = n => { const x = Math.sin(n * 91.345 + 17.1) * 43758.5453; return x - Math.floor(x); };
  function marks(yAt, land, water, a) {
    const gap = 0.16, i0 = Math.floor((off - X0 / FH) / gap) - 2, i1 = Math.ceil((off + (W - X0) / FH) / gap) + 2;
    const hatch = [], crest = [];
    for (let i = i0; i <= i1; i++) {
      const u = i * gap + hs(i) * 0.09, x = X0 + (u - off) * FH;
      if (land > 0.01 && hs(i + 3) < 0.62) {
        const y = yAt(x) + LW + 2, l = (0.025 + 0.03 * hs(i + 7)) * FH;
        hatch.push([[x, y], [x - l * 0.55, y + l]]);
      }
      if (water > 0.01 && i % 2 === 0 && hs(i + 11) < 0.7) {
        const y = yAt(x) + (0.06 + 0.1 * hs(i + 5)) * FH, w = 0.06 * FH;
        crest.push([[x - w, y], [x - w * 0.4, y + w * 0.22], [x + w * 0.2, y + w * 0.1]]);
      }
    }
    if (hatch.length) ink(hatch, 1, 0.42 * land * a, LINE, LW * 0.8, 950, true);
    if (crest.length) ink(crest, 1, 0.38 * water * a, LINE, LW * 0.8, 980, true);
  }

  /* The graticule of the globe that is about to appear, every thirty
     degrees, turned the way the globe will be turned, so the sketch lands
     where the map does. */
  function graticule(t, fade) {
    if (t <= 0) return;
    const cosP = Math.cos(G.rotP * RAD), sinP = Math.sin(G.rotP * RAD);
    const pj = (lon, lat) => {
      const l = (lon + G.rotL) * RAD, ph = lat * RAD, cp = Math.cos(ph);
      const z = Math.cos(l) * cp * cosP - Math.sin(ph) * sinP;
      return [G.cx + G.r * Math.sin(l) * cp, G.cy - G.r * (Math.sin(ph) * cosP + Math.cos(l) * cp * sinP), z];
    };
    const lines = [];
    const run = pts => { let cur = []; for (const p of pts) { if (p[2] > 0.02) cur.push([p[0], p[1]]); else { if (cur.length > 1) lines.push(cur); cur = []; } } if (cur.length > 1) lines.push(cur); };
    for (let lat = -60; lat <= 60; lat += 30) { const pts = []; for (let lon = -180; lon <= 180; lon += 4) pts.push(pj(lon, lat)); run(pts); }
    for (let lon = -180; lon < 180; lon += 30) { const pts = []; for (let lat = -90; lat <= 90; lat += 4) pts.push(pj(lon, lat)); run(pts); }
    ink(lines, t, 0.3 * fade, LINE, LW * 0.7, 700, true);
  }

  /* ================= handing over to the map ================= */
  function release() {
    document.documentElement.classList.remove('intro-on');
    const A = window.ISO_APP;
    if (A) { if (A.booted) A.enter(); else A.hold = false; }
    else window.ISO_HOLD = false;
  }
  function finish(fast) {
    if (leaving) return;
    leaving = { t0: performance.now(), dur: fast ? 350 : 900 };
    root.classList.remove('waiting');
    root.classList.add('leaving');
    if (fast) root.classList.add('fast');
    release();
    setTimeout(() => { finished = true; root.remove(); style.remove(); }, leaving.dur + 60);
  }
  window.addEventListener('iso:ready', () => { if (waiting && !leaving) finish(false); });
  root.querySelector('.iskip').addEventListener('click', () => finish(true));
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); finish(true); }
  });

  // on a local server only: hold the ride at any point and run it for a while, frame by frame
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
    window.__intro = { at(p, secs) { target = P = p; for (let i = 0; i < Math.round((secs || 0.5) * 60); i++) tick(1 / 60); return stageOf(P); } };

  size();
  window.addEventListener('resize', size);
  root.focus({ preventScroll: true });
  requestAnimationFrame(frame);
})();
