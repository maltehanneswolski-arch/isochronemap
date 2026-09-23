/* The way in, drawn like a chart. A traveller stands on a line. Scroll, and
   it sets off: walking, then running, cycling, driving, at the wheel of a
   sailing ship, of a steamer, and at the controls of a plane. The plane climbs
   out of the frame, and the line it leaves behind curls up into a circle,
   which is the rim of the globe. The graticule is sketched in, and then the
   bare globe is inside it, asking where to start. Nothing is solved until you
   answer, so the drawing never waits on the solver.

   It is drawn the way a hand draws a map: pen strokes that swell and thin,
   hatching for shade and a cartouche round the title, on a plain ground. The same hand carries on over the page after it:
   the globe gets a pencilled graticule and rim (ISO_SKETCH, drawn by app.js),
   and the title, the panel and the years get ruled frames, a book face and
   warm ink, with a paper grain over everything.

   The scroll decides the means of travel; legs, wheels, sails, waves and
   smoke keep moving in time, so the figure never freezes mid-stride when you
   stop. ?nointro skips the ride but keeps the hand-drawn look. */
(function () {
  'use strict';
  const TAU = Math.PI * 2, RAD = Math.PI / 180;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mixP = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

  /* ================= paper and ink, for the whole page ================= */
  window.ISO_SKETCH = true;
  (function grain() {
    const n = 180, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'), img = g.createImageData(n, n);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random();
      img.data[i] = 238; img.data[i + 1] = 232; img.data[i + 2] = 216;
      img.data[i + 3] = v > 0.94 ? 80 + Math.random() * 110 : v > 0.55 ? 18 : 0;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(238,232,216,.22)'; g.lineWidth = 0.6;
    for (let k = 0; k < 46; k++) {
      const x = Math.random() * n, y = Math.random() * n, a = Math.random() * TAU, l = 4 + Math.random() * 11;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1.5, y + Math.sin(a) * l * 0.5 - 1.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    const st = document.createElement('style');
    st.textContent = '.paper-grain{position:fixed;inset:0;z-index:45;pointer-events:none;opacity:.075;' +
      'background-image:url(' + c.toDataURL() + ');background-size:' + n + 'px ' + n + 'px}';
    document.head.appendChild(st);
    const d = document.createElement('div'); d.className = 'paper-grain'; d.setAttribute('aria-hidden', 'true');
    document.body.appendChild(d);
  })();

  /* ================= the page in the same hand =================
     The title, the panel and the years are ruled by hand like the intro's
     cartouche, set in a book face, in warm ink. Frames for the big boxes are
     drawn to each box's own size and redrawn when it changes; small boxes
     share frames that stretch. Only this page does this; the plain version
     keeps its clean instrument panel. */
  (function hud() {
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap';
    document.head.appendChild(font);
    document.documentElement.classList.add('sketch');

    // a small seeded random, so a frame drawn twice is drawn the same
    const rng = seed => () => {
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const INKC = '#E2DCCC';
    // one ruled edge: run a little past each corner and a little off straight, as a pen draws it
    function edge(r, x0, y0, x1, y1, amp, step) {
      const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      const o0 = 0.5 + r() * 2.5, o1 = 0.5 + r() * 2.5, n = Math.max(2, Math.round(L / step));
      let d = '', j = 0;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        j = j * 0.6 + (r() - 0.5) * amp;
        const x = x0 - ux * o0 + (x1 - x0 + ux * (o0 + o1)) * t, y = y0 - uy * o0 + (y1 - y0 + uy * (o0 + o1)) * t;
        d += (i ? 'L' : 'M') + (x - uy * j).toFixed(1) + ' ' + (y + ux * j).toFixed(1);
      }
      return d;
    }
    const box = (r, x0, y0, x1, y1, amp, step) =>
      edge(r, x0, y0, x1, y0, amp, step) + edge(r, x1, y0, x1, y1, amp, step) +
      edge(r, x1, y1, x0, y1, amp, step) + edge(r, x0, y1, x0, y0, amp, step);
    const url = svg => 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    const path = (d, op, w, extra) => '<path d="' + d + '" fill="none" stroke="' + INKC + '" stroke-opacity="' + op +
      '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>';

    // frames that stretch to any small box: buttons, the tooltip, the rules between sections
    const NS = ' vector-effect="non-scaling-stroke"';
    const stretch = (vb, body) => url('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" preserveAspectRatio="none">' + body + '</svg>');
    const css = document.documentElement.style;
    css.setProperty('--sk-box', stretch('0 0 100 40', path(box(rng(11), 1.5, 1.5, 98.5, 38.5, 0.9, 12), 0.7, 1, NS)));
    css.setProperty('--sk-box-faint', stretch('0 0 100 40', path(box(rng(12), 1.5, 1.5, 98.5, 38.5, 0.9, 12), 0.3, 1, NS)));
    css.setProperty('--sk-rule', stretch('0 0 200 6', path(edge(rng(13), 1, 3, 199, 3, 1.1, 10), 0.35, 1, NS)));
    css.setProperty('--sk-under', stretch('0 0 200 6', path(edge(rng(14), 1, 3, 199, 3, 1.1, 10), 0.6, 1, NS)));

    // a cartouche for a box of a given size: a double rule with a loop at each corner
    function cartouche(w, h, seed) {
      const r = rng(seed);
      let body = path(box(r, 2.5, 2.5, w - 2.5, h - 2.5, 1.1, 16), 0.72, 1.1) + path(box(r, 6.5, 6.5, w - 6.5, h - 6.5, 1.1, 16), 0.3, 0.7);
      for (const [x, y] of [[2.5, 2.5], [w - 2.5, 2.5], [w - 2.5, h - 2.5], [2.5, h - 2.5]])
        body += '<circle cx="' + x + '" cy="' + y + '" r="2.3" fill="none" stroke="' + INKC + '" stroke-opacity=".55" stroke-width=".8"/>';
      return url('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + body + '</svg>');
    }
    // the years as a scale bar: two rules with every other stretch between them filled in
    function scaleBar(w, n) {
      const r = rng(21), y0 = 4, y1 = 10;
      let body = path(edge(r, 0, y0, w, y0, 0.8, 14), 0.6, 0.9) + path(edge(r, 0, y1, w, y1, 0.8, 14), 0.6, 0.9);
      for (let k = 0; k < n - 1; k += 2) {
        const a = k / (n - 1) * w, b = (k + 1) / (n - 1) * w;
        body += '<rect x="' + a.toFixed(1) + '" y="' + y0 + '" width="' + (b - a).toFixed(1) + '" height="' + (y1 - y0) +
          '" fill="' + INKC + '" fill-opacity=".2"/>';
      }
      return url('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="16" viewBox="0 0 ' + w + ' 16">' + body + '</svg>');
    }
    const paint = el => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (w < 4 || h < 4) return;
      const phone = document.body.classList.contains('mobile');
      if (el.id === 'axis' || el.id === 'timeline') {
        // on a phone the years are a row of buttons inside the sheet, with no frame or bar of their own
        if (phone) { el.style.backgroundImage = 'none'; return; }
        if (el.id === 'axis') { el.style.backgroundImage = scaleBar(w, (window.ISO && window.ISO.ERAS && window.ISO.ERAS.length) || 8); return; }
      }
      el.style.backgroundImage = cartouche(w, h, el.id.length * 7 + 3);
    };
    const FRAMED = ['brand', 'panel', 'timeline', 'axis'];
    const ro = new ResizeObserver(es => es.forEach(e => paint(e.target)));
    FRAMED.forEach(id => { const el = document.getElementById(id); if (el) ro.observe(el); });
    // a resize observer only reports while the page is being drawn; paint on the other cues too
    const paintAll = () => FRAMED.forEach(id => { const el = document.getElementById(id); if (el) paint(el); });
    window.addEventListener('resize', paintAll);
    if (document.fonts) document.fonts.ready.then(paintAll);
    window.addEventListener('iso:ready', paintAll);
    setTimeout(paintAll, 60); setTimeout(paintAll, 2500);

    // the title and the panel share one column on a wide screen, the title at its head,
    // so the panel always starts below it and neither ever sits on the globe
    const brand = document.getElementById('brand'), pn = document.getElementById('panel');
    if (brand) brand.insertAdjacentHTML('afterbegin', '<p class="kicker">A passage chart for travellers</p>');
    if (brand && pn) {
      const col = document.createElement('div'); col.id = 'rightcol';
      pn.parentNode.insertBefore(col, pn); col.appendChild(brand); col.appendChild(pn);
    }

    const st = document.createElement('style');
    st.textContent = `
html.sketch{
  --text:#E6E0D1; --text-dim:#C3BBA7; --text-faint:#8E8674; --head:#F2EDE1; --hot:#F4EFE3;
  --line:#E2DCCC; --line-lit:#FBF8F0; --line-dim:rgba(226,220,204,.32);
  --rule:rgba(226,220,204,.2); --rule-soft:rgba(226,220,204,.1);
  --panel:rgba(7,9,15,.93); --panel-solid:#090B12;
  --font-s:"EB Garamond",Georgia,"Times New Roman",serif; --font-m:"EB Garamond",Georgia,"Times New Roman",serif;
  --fs-xs:11.5px; --fs-s:14px; --fs-m:17px; --fs-l:21px;
}
html.sketch body{font-size:15px}
/* paper, not glass, and a ruled frame drawn by hand to each box's size */
html.sketch .panel,html.sketch #brand{border:none;backdrop-filter:none;-webkit-backdrop-filter:none;
  background-color:var(--panel);background-repeat:no-repeat;background-position:0 0}
html.sketch .eyebrow,html.sketch summary{letter-spacing:.2em;font-weight:500}
html.sketch #panel{padding:17px 18px 15px}
/* the panel and the search list still scroll, but show no bar while they do */
html.sketch #panel,html.sketch #findList{scrollbar-width:none}
html.sketch #panel::-webkit-scrollbar,html.sketch #findList::-webkit-scrollbar{display:none}
html.sketch #timeline{padding:14px 36px 10px}
/* the title as a cartouche, as in the intro */
html.sketch #brand{padding:16px 22px 17px;max-width:340px}
html.sketch #brand::before,html.sketch #brand .rule{display:none}
html.sketch #brand .kicker{margin:0 0 9px;font-size:10.5px;letter-spacing:.3em;text-transform:uppercase;font-weight:500;color:var(--text-dim)}
html.sketch #brand h1{text-shadow:none;margin-bottom:9px}
html.sketch #brand .lede{font-family:var(--font-d);font-style:italic;font-size:15px;color:var(--text-dim);text-shadow:none}
html.sketch #brand .gloss{font-size:12.5px;text-shadow:none}
/* controls ruled by hand instead of hairlines */
html.sketch #findInput{border:none;padding:9px 3px 10px;font-style:italic;font-size:15.5px;
  background:transparent var(--sk-under) left bottom/100% 6px no-repeat}
html.sketch #findList{border:none;background:var(--panel-solid) var(--sk-box-faint) 0 0/100% 100% no-repeat}
html.sketch #travelNow{border:none;background:rgba(226,220,204,.045) var(--sk-box) 0 0/100% 100% no-repeat}
html.sketch .mode{border-color:transparent}
html.sketch .mode[aria-pressed="true"]{border-color:transparent;background:rgba(226,220,204,.05) var(--sk-box) 0 0/100% 100% no-repeat}
html.sketch #palette button,html.sketch #palette button:hover{border-color:transparent}
html.sketch #palette button[aria-pressed="true"]{background:var(--sk-box) 0 0/100% 100% no-repeat}
html.sketch #profile{border:none;background:rgba(226,220,204,.03) var(--sk-box-faint) 0 0/100% 100% no-repeat}
html.sketch .stats{background:none;border:none;gap:8px}
html.sketch .stat{background:var(--sk-box-faint) 0 0/100% 100% no-repeat}
html.sketch .stat b{font-variant-numeric:lining-nums tabular-nums;font-weight:500}
html.sketch details:not(#travel){border-top:none;background:var(--sk-rule) 0 0/100% 6px no-repeat;padding-top:12px}
html.sketch #foot{border-top:none;background:var(--sk-rule) 0 0/100% 6px no-repeat;padding-top:12px}
html.sketch .ramplab span,html.sketch .lg,html.sketch #originCoord,html.sketch #solveNote{font-style:italic}
html.sketch #journeys .nm{font-size:14px}
html.sketch #journeys .v,html.sketch #journeys .tk{font-size:12px;font-style:italic}
html.sketch #play{border:none;background:var(--sk-box) 0 0/100% 100% no-repeat}
html.sketch #play:hover{background:rgba(226,220,204,.05) var(--sk-box) 0 0/100% 100% no-repeat}
/* the years as a map's scale bar */
html.sketch #axis{background-repeat:no-repeat;background-position:0 0}
html.sketch #axis .track,html.sketch #axis .fill{display:none}
html.sketch #axis .brk{background:var(--panel-solid)}
html.sketch .era .tick{background:var(--line-dim)}
html.sketch .era .yr{font-size:15px;font-variant-numeric:oldstyle-nums}
html.sketch .era .tag{font-style:italic;font-size:12px;letter-spacing:.01em}
/* the small things that float over the map */
html.sketch #tip{border:none;background:rgba(7,9,15,.95) var(--sk-box) 0 0/100% 100% no-repeat;padding:8px 12px}
html.sketch #tip b{font-family:var(--font-d);font-size:15px}
html.sketch #tip button{border:none;background:var(--sk-box) 0 0/100% 100% no-repeat}
html.sketch #solving{border:none;background:rgba(7,9,15,.95) var(--sk-box) 0 0/100% 100% no-repeat;
  font-family:var(--font-d);font-style:italic;text-transform:none;letter-spacing:.02em;font-size:16px;padding:12px 20px}
html.sketch #boot p{font-style:italic}
/* on a phone the sheet is a square-cornered sheet of paper */
html.sketch body.mobile #panel{border-radius:0;background-color:rgba(7,9,15,.95)}
html.sketch body.mobile .era,html.sketch body.mobile #playChip{border:none;background:var(--sk-box-faint) 0 0/100% 100% no-repeat}
html.sketch body.mobile .era[aria-pressed="true"]{background:rgba(226,220,204,.08) var(--sk-box) 0 0/100% 100% no-repeat}
html.sketch body.mobile .mode{border-color:transparent;background:var(--sk-box-faint) 0 0/100% 100% no-repeat}
html.sketch body.mobile .mode[aria-pressed="true"]{background:rgba(226,220,204,.06) var(--sk-box) 0 0/100% 100% no-repeat}
/* on a wide screen the title heads the right-hand column, above the panel, so it never sits on the globe */
html.sketch #rightcol{position:fixed;top:20px;right:22px;bottom:156px;width:280px;z-index:6;
  display:flex;flex-direction:column;gap:10px;pointer-events:none}
html.sketch #rightcol>*{pointer-events:auto}
html.sketch body.mobile #rightcol{display:contents}
html.sketch body:not(.mobile) #brand,html.sketch body:not(.mobile) #panel{position:static}
html.sketch body:not(.mobile) #panel{flex:0 1 auto;min-height:0;max-height:none;width:auto}
html.sketch body:not(.mobile) #brand{flex:none;width:auto;max-width:none;padding:15px 20px 16px}
html.sketch body:not(.mobile) #brand .kicker{font-size:9.5px;letter-spacing:.22em}
html.sketch body:not(.mobile) #brand h1{font-size:28px}
html.sketch body:not(.mobile) #brand .lede{font-size:14px}
html.sketch body:not(.mobile) #brand .gloss{display:none}
@media (max-width:1140px){html.sketch #rightcol{width:262px}}
html.sketch body.mobile #brand{padding:8px 12px 9px}
html.sketch body.mobile #brand .kicker{display:none}
html.sketch body.mobile #brand .lede{font-size:12.5px}
html.sketch body.mobile .era .yr{font-size:12.5px}
@media (max-width:360px){html.sketch body.mobile .era .yr{font-size:11px}}
`;
    document.head.appendChild(st);
  })();

  if (/[?&]nointro\b/.test(location.search)) return;
  window.ISO_HOLD = true;
  window.ISO_ASK = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= the page around it ================= */
  const style = document.createElement('style');
  style.textContent = `
html.intro-on #brand,html.intro-on #panel,html.intro-on #timeline,html.intro-on #boot{visibility:hidden}
#intro{position:fixed;inset:0;z-index:40;overflow:hidden;outline:none;touch-action:none;
  overscroll-behavior:none;-webkit-user-select:none;user-select:none}
#intro .istage{position:absolute;inset:0;overflow:hidden}
#intro .ibg{position:absolute;inset:0;transition:opacity .9s var(--ease);
  background:radial-gradient(ellipse 80% 70% at 50% 46%,#0B0F19 0%,#06080F 62%,#030409 100%)}
#intro canvas{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
#intro .ititle{position:absolute;left:50%;top:13vh;width:max-content;max-width:calc(100% - 64px);
  padding:22px 34px 24px;text-align:center;pointer-events:none;color:#EDE7D9;transform:translateX(-50%)}
#intro .ik{margin:0 0 12px;font-size:var(--fs-xs);letter-spacing:.3em;text-transform:uppercase;font-weight:600;
  color:#B9B09B}
#intro .ih{margin:0;font-family:var(--font-d);font-weight:500;font-size:clamp(34px,5.6vw,58px);line-height:1;
  letter-spacing:.005em}
#intro .il{margin:14px auto 0;max-width:26em;font-family:var(--font-d);font-style:italic;font-size:clamp(15px,1.6vw,18px);
  line-height:1.4;color:#CFC7B4;text-wrap:balance}
#intro .ihint{position:absolute;left:0;right:0;bottom:calc(24px + env(safe-area-inset-bottom));margin:0;text-align:center;
  pointer-events:none;font-size:var(--fs-xs);letter-spacing:.3em;text-transform:uppercase;font-weight:600;color:#A79E8A}
#intro .ihint::after{content:"";display:block;width:1px;height:28px;margin:10px auto 0;
  background:linear-gradient(#DCD6C6,rgba(220,214,198,0));transform-origin:top;animation:ihint 2s var(--ease) infinite}
@keyframes ihint{0%{transform:scaleY(0);opacity:1}60%{transform:scaleY(1);opacity:1}100%{transform:scaleY(1);opacity:0}}
#intro .iwait{position:absolute;left:0;right:0;bottom:12vh;margin:0;text-align:center;pointer-events:none;
  font-family:var(--font-d);font-style:italic;font-size:var(--fs-m);color:#A79E8A;
  opacity:0;transition:opacity .4s var(--ease)}
#intro.waiting .iwait{opacity:1}
#intro .iskip{position:absolute;top:calc(14px + env(safe-area-inset-top));right:calc(18px + env(safe-area-inset-right));
  min-height:40px;padding:0 4px;font-size:var(--fs-xs);letter-spacing:.24em;text-transform:uppercase;font-weight:600;
  color:#CFC7B4;transition:color .2s var(--ease),opacity .5s var(--ease)}
#intro .iskip span{border-bottom:1px solid rgba(207,199,180,.45);padding-bottom:3px}
#intro .iskip:hover{color:#F3EEE2}
#intro.leaving{pointer-events:none}
#intro.leaving .ibg,#intro.leaving .iskip,#intro.leaving .iwait{opacity:0}
#intro.fast .ibg{transition-duration:.35s}
`;
  document.head.appendChild(style);
  document.documentElement.classList.add('intro-on');

  /* Nothing here scrolls natively. The wheel, a finger or the keys move a
     position along a track seven screens long, so no browser, phone or
     desktop, ever draws a scrollbar or a scroll indicator over the drawing. */
  const root = document.createElement('div');
  root.id = 'intro';
  root.tabIndex = -1;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Introduction. Scroll to go on, or skip it.');
  root.innerHTML =
    '<div class="istage"><div class="ibg"></div><canvas aria-hidden="true"></canvas>' +
    '<div class="ititle"><p class="ik">A passage chart for travellers</p><p class="ih">Isochronic Globe</p>' +
    '<p class="il">How far you could get from any point on Earth, in any year since 1750.</p></div>' +
    '<p class="ihint" aria-hidden="true">Scroll to set off</p>' +
    '<p class="iwait" aria-hidden="true">building the world&hellip;</p>' +
    '<button class="iskip" type="button"><span>Skip the intro</span></button></div>';
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
  const elTitle = root.querySelector('.ititle'), elHint = root.querySelector('.ihint');

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
    const i = Math.floor(clamp(s, 0, 1.999)), a = GAIT[i], b = GAIT[Math.ceil(clamp(s, 0, 2))], t = clamp(s - i, 0, 1);
    const o = {};
    for (const k in a) o[k] = lerp(a[k], b[k], t);
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
  function seated(hip, lean, headLean, feet, hands) {
    const sh = [hip[0] + Math.sin(lean) * TO, hip[1] + Math.cos(lean) * TO];
    const nk = [sh[0] + Math.sin(headLean) * NK, sh[1] + Math.cos(headLean) * NK];
    const hd = [nk[0] + Math.sin(headLean) * HR, nk[1] + Math.cos(headLean) * HR];
    const L1 = ik(hip, feet[0], TH, SH, 1), L2 = ik(hip, feet[1], TH, SH, 1);
    const A1 = ik(sh, hands[0], UA, FA, -1), A2 = ik(sh, hands[1], UA, FA, -1);
    return { hip, k1: L1[0], f1: L1[1], k2: L2[0], f2: L2[1], sh, nk, hd, e1: A1[0], h1: A1[1], e2: A2[0], h2: A2[1] };
  }
  // standing at a ship's wheel: the legs of a standing figure, both hands on the rim
  let steer = 0;
  function atWheel(phi, breath, at, wheel) {
    const p = gaitPose(phi, GAIT[0], breath), o = {};
    for (const k in p) o[k] = [p[k][0] + at[0], p[k][1] + at[1]];
    const grip = a => [wheel.c[0] + Math.cos(a) * wheel.r, wheel.c[1] + Math.sin(a) * wheel.r];
    const A1 = ik(o.sh, grip(Math.PI - 0.5 + steer), UA, FA, -1), A2 = ik(o.sh, grip(Math.PI + 0.45 + steer), UA, FA, -1);
    o.e1 = A1[0]; o.h1 = A1[1]; o.e2 = A2[0]; o.h2 = A2[1];
    return o;
  }
  const mixPose = (a, b, t) => { const o = {}; for (const k in a) o[k] = mixP(a[k], b[k], t); return o; };

  /* The luggage: a backpack on foot, running and on the bicycle (and in the
     car, out of sight); on board it comes off and stands on deck as a
     suitcase, and it goes into the hold for the flight. Both are the same
     twelve-point outline plus two lines, so one redraws itself into the other. */
  function backpack(p) {
    const dx = p.sh[0] - p.hip[0], dy = p.sh[1] - p.hip[1], L = Math.hypot(dx, dy) || 1;
    const u = [dx / L, dy / L], bk = [-u[1], u[0]];                     // along the spine, and out behind it
    const at = (t, d) => [p.hip[0] + u[0] * L * t + bk[0] * d, p.hip[1] + u[1] * L * t + bk[1] * d];
    return {
      pts: [at(0.95, 0.03), at(0.98, 0.09), at(0.92, 0.15), at(0.74, 0.17), at(0.52, 0.175), at(0.33, 0.165),
            at(0.25, 0.12), at(0.25, 0.06), at(0.3, 0.02), at(0.5, 0.02), at(0.7, 0.02), at(0.86, 0.02)],
      lines: [[at(0.95, 0.03), at(1.0, -0.02), at(0.6, -0.05)],        // the strap over the shoulder
              [at(0.7, 0.17), at(0.7, 0.03)]]                          // the flap
    };
  }
  function suitcase(x, y) {
    const w = 0.21, h = 0.26, r = 0.028;
    return {
      pts: [[x, y + h - r], [x + r, y + h], [x + w / 2, y + h], [x + w - r, y + h], [x + w, y + h - r], [x + w, y + h / 2],
            [x + w, y + r], [x + w - r, y], [x + w / 2, y], [x + r, y], [x, y + r], [x, y + h / 2]],
      lines: [[[x + w * 0.34, y + h], [x + w / 2, y + h + 0.055], [x + w * 0.66, y + h]],   // the handle
              [[x + w * 0.74, y + h], [x + w * 0.74, y]]]                                 // the strap round it
    };
  }
  const SUIT_SAIL = [-1.53, 0.72], SUIT_STEAM = [-0.445, 0.3];
  const bagFor = (st, pose) => st <= 4 ? backpack(pose) : st === 5 ? suitcase(SUIT_SAIL[0], SUIT_SAIL[1]) : suitcase(SUIT_STEAM[0], SUIT_STEAM[1]);
  const mixBag = (a, b, t) => ({ pts: a.pts.map((q, i) => mixP(q, b.pts[i], t)),
                                 lines: a.lines.map((l, j) => l.map((q, i) => mixP(q, b.lines[j][i], t))) });

  /* ================= the means of travel ================= */
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
  const spokes = (c, r, a, n) => {
    const out = [];
    for (let i = 0; i < (n || 2); i++) {
      const q = a + i * Math.PI / (n || 2);
      out.push([[c[0] + Math.cos(q) * r, c[1] + Math.sin(q) * r], [c[0] - Math.cos(q) * r, c[1] - Math.sin(q) * r]]);
    }
    return out;
  };
  const shipWheel = (c, r) => {
    const L = [circ(c, r, 61, 20), circ(c, 0.025, 62, 8)];
    for (let i = 0; i < 8; i++) {
      const a = steer + i * TAU / 8;
      L.push([[c[0] + Math.cos(a) * 0.025, c[1] + Math.sin(a) * 0.025], [c[0] + Math.cos(a) * r * 1.42, c[1] + Math.sin(a) * r * 1.42]]);
    }
    return L;
  };

  // bicycle
  const BIKE = { RA: [-0.33, 0.19], FA: [0.34, 0.19], BB: [-0.02, 0.17], ST: [-0.12, 0.52], HT: [0.21, 0.5],
                 HB: [0.24, 0.41], R: 0.19, CR: 0.075 };
  const pedals = th => [
    [BIKE.BB[0] + BIKE.CR * Math.cos(th), BIKE.BB[1] + BIKE.CR * Math.sin(th)],
    [BIKE.BB[0] - BIKE.CR * Math.cos(th), BIKE.BB[1] - BIKE.CR * Math.sin(th)]];
  const bikePose = th => { const p = pedals(th); return seated([-0.12, 0.57], 0.62, 0.35, [p[1], p[0]], [[0.26, 0.6], [0.27, 0.6]]); };
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

  // car
  const carPose = () => seated([-0.14, 0.25], -0.08, -0.05, [[0.22, 0.17], [0.24, 0.16]], [[0.13, 0.52], [0.15, 0.51]]);
  const CAR_BODY = [[-0.86, 0.14], [-0.88, 0.3], [-0.8, 0.42], [-0.44, 0.47], [-0.36, 0.84], [0.06, 0.87],
                    [0.34, 0.5], [0.76, 0.45], [0.88, 0.32], [0.86, 0.14], [-0.86, 0.14]];
  const CAR_WIN = [[-0.31, 0.5], [-0.27, 0.8], [0.04, 0.83], [0.27, 0.52], [-0.31, 0.5]];
  function carStrokes(wa) {
    const W1 = [-0.52, 0.15], W2 = [0.52, 0.15];
    return [
      CAR_BODY, CAR_WIN, [[0.09, 0.46], [0.19, 0.58]],
      circ(W1, 0.15, 21), circ(W2, 0.15, 22), circ(W1, 0.045, 23), circ(W2, 0.045, 24),
      ...spokes(W1, 0.13, wa, 1), ...spokes(W2, 0.13, wa, 1),
      circ([0.8, 0.36], 0.032, 25), [[-0.3, 0.46], [-0.3, 0.2]], [[0.3, 0.44], [0.3, 0.2]]
    ];
  }

  // a square-rigged sailing ship; the figure at the wheel on the quarterdeck
  const SAIL_AT = [-1.25, 0.72], SAIL_WHEEL = { c: [-0.98, 1.3], r: 0.12 };      // standing on the quarterdeck
  const sailPose = (phi, breath) => atWheel(phi, breath, SAIL_AT, SAIL_WHEEL);
  const SAIL_HULL = [[-1.55, 0.72], [-0.95, 0.68], [-0.9, 0.52], [0.9, 0.48], [1.38, 0.68], [1.12, 0.06],
                     [0.55, -0.16], [-1.05, -0.16], [-1.5, 0.1], [-1.55, 0.72]];
  function sailPath(xl, xr, yt, yb, b) {
    const pts = [], mid = (yt + yb) / 2;
    const q = (a, c, e, n) => { for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * e[0], u * u * a[1] + 2 * u * t * c[1] + t * t * e[1]]); } };
    q([xl, yt], [(xl + xr) / 2, yt - 0.03], [xr, yt], 6);                    // along the yard
    q([xr, yt], [xr + b, mid], [xr - 0.04, yb], 6);                          // leech, bellied forward
    q([xr - 0.04, yb], [(xl + xr) / 2 + b * 0.6, yb - 0.08], [xl + 0.04, yb], 6);  // foot
    q([xl + 0.04, yb], [xl + b, mid], [xl, yt], 6);                          // luff
    return pts;
  }
  function sailSeams(xl, xr, yt, yb, b) {
    const L = [];
    for (const f of [1 / 3, 2 / 3]) {
      const x = lerp(xl, xr, f);
      L.push([[x, yt - 0.02], [x + b * 0.9, (yt + yb) / 2], [x + 0.01, yb + 0.03]]);
    }
    return L;
  }
  function sailShip(time) {
    const bl = k => 0.1 + (reduced ? 0 : 0.028 * Math.sin(time * 1.3 + k));
    const S = [[-0.48, 0.58, 2.06, 1.46, bl(0)], [-0.53, 0.63, 1.35, 0.8, bl(1)],
               [0.4, 1.2, 1.8, 1.32, bl(2)], [0.35, 1.25, 1.22, 0.8, bl(3)]];
    const wave = reduced ? 0 : 0.035 * Math.sin(time * 3.2);
    return {
      back: [                                                               // spars and rigging, under the sails
        [[0.05, 0.5], [0.05, 2.25]], [[0.8, 0.49], [0.8, 1.95]], [[1.3, 0.64], [1.72, 0.86]],
        [[0.05, 2.25], [-1.52, 0.74]], [[0.05, 2.25], [0.8, 1.95]], [[0.8, 1.95], [1.7, 0.86]],
        [[-0.5, 2.08], [0.6, 2.08]], [[-0.55, 1.38], [0.65, 1.38]], [[0.38, 1.82], [1.22, 1.82]], [[0.33, 1.25], [1.27, 1.25]],
        [[0.05, 2.25], [0.36, 2.2 + wave], [0.05, 2.15]]
      ],
      sails: S.map(s => sailPath(s[0], s[1], s[2], s[3], s[4])).concat([[[1.68, 0.87], [1.12, 1.4], [0.84, 1.88], [0.98, 1.2], [1.08, 0.64]]]),
      seams: [].concat(...S.map(s => sailSeams(s[0], s[1], s[2], s[3], s[4]))),
      hull: [SAIL_HULL, [[-1.48, 0.36], [-0.2, 0.3], [1.22, 0.38]], [[-0.9, 0.52], [-0.9, 0.68]],
        ...[-0.95, -0.55, -0.15, 0.25, 0.65].map(x => [[x - 0.05, 0.15], [x + 0.05, 0.15], [x + 0.05, 0.24], [x - 0.05, 0.24], [x - 0.05, 0.15]]),
        [[-0.98, 0.72], [-0.98, 1.17]], ...shipWheel(SAIL_WHEEL.c, SAIL_WHEEL.r)]
    };
  }

  // a steamer with a wheelhouse; the figure at the wheel inside it, seen through the window
  const DECK = 0.3, STEAM_WHEEL = { c: [0.3, 1.02], r: 0.11 };
  const steamPose = (phi, breath) => atWheel(phi, breath, [0, DECK], STEAM_WHEEL);
  const STEAM_HULL = [[-1.7, DECK], [0.62, DECK], [0.95, 0.46], [0.78, -0.16], [-1.5, -0.16], [-1.76, 0.1], [-1.7, DECK]];
  const WHEELHOUSE = [[-0.22, DECK], [-0.22, 1.52], [0.5, 1.52], [0.5, DECK], [-0.22, DECK]];
  const WH_WINDOW = [[-0.12, 0.86], [-0.12, 1.44], [0.44, 1.44], [0.44, 0.86], [-0.12, 0.86]];
  const FUNNEL = [[-0.78, DECK], [-0.74, 1.4], [-0.5, 1.4], [-0.46, DECK], [-0.78, DECK]];
  const FUNNEL_TOP = [-0.62, 1.42];
  function steamBack() {
    return [
      STEAM_HULL,
      [[-1.45, DECK], [-1.45, 0.72], [-0.92, 0.72], [-0.92, DECK]], [[-1.35, 0.55], [-1.02, 0.55]],
      FUNNEL, [[-0.755, 1.22], [-0.485, 1.22]],
      ...[-1.35, -1.05, -0.75, -0.45, -0.15, 0.15, 0.45].map((x, i) => circ([x, 0.12], 0.028, 31 + i, 10))
    ];
  }
  function steamFront() {
    return [WHEELHOUSE, WH_WINDOW, [[-0.28, 1.52], [0.56, 1.52]],
      [[0.14, 1.52], [0.14, 1.86]], [[0.14, 1.86], [0.32, 1.81], [0.14, 1.76]],
      ...shipWheel(STEAM_WHEEL.c, STEAM_WHEEL.r)];
  }

  // plane: a fuselage deep enough to hold the pilot, hips and legs and all, under a framed canopy
  const pilotPose = () => seated([0.12, 0.44], 0.1, 0.06, [[0.5, 0.42], [0.52, 0.41]], [[0.33, 0.56], [0.34, 0.55]]);
  const PLANE_BODY = [[1.05, 0.5], [0.86, 0.66], [0.46, 0.7], [-0.45, 0.68], [-1.05, 0.64], [-1.05, 0.55],
                      [-0.45, 0.42], [0.55, 0.3], [0.98, 0.4], [1.05, 0.5]];
  const CANOPY = [[0.46, 0.7], [0.38, 1.06], [0.02, 1.08], [-0.12, 0.69], [0.46, 0.7]];
  const GLASS = [[0.39, 0.72], [0.32, 1.02], [0.05, 1.04], [-0.05, 0.71], [0.39, 0.72]];
  const FIN = [[-0.75, 0.67], [-0.98, 1.02], [-1.08, 1.02], [-1.05, 0.64]];
  function planeStrokes(pa, gear, wa) {
    const wing = [];
    for (let i = 0; i <= 20; i++) { const a = TAU * i / 20; wing.push([0.12 + Math.cos(a) * 0.46, 0.47 + Math.sin(a) * 0.05]); }
    return [PLANE_BODY, CANOPY, GLASS, FIN, [[-0.82, 0.6], [-1.22, 0.61]], wing, [[0.86, 0.66], [0.84, 0.34]],
      [[1.08, 0.5 - 0.25 * Math.cos(pa)], [1.08, 0.5 + 0.25 * Math.cos(pa)]]];
  }
  /* The undercarriage folds away as the plane climbs: the main leg swings
     back and up into the belly, the tail wheel forward into the tail, and a
     door closes over the main wheel. It is drawn before the fuselage, so the
     fuselage hides what has gone inside it. */
  function gear(k, wa) {
    const g = sstep(0.1, 0.42, k);                                    // 0 down, 1 stowed
    const mh = [0.34, 0.325], ml = 0.245, ma = -Math.PI / 2 - g * 1.99;
    const mw = [mh[0] + Math.cos(ma) * ml, mh[1] + Math.sin(ma) * ml];
    const me = [mh[0] + Math.cos(ma) * (ml - 0.08), mh[1] + Math.sin(ma) * (ml - 0.08)];
    const th = [-0.9, 0.52], tl = 0.445, ta = -Math.PI / 2 + g * Math.PI / 2;
    const tw = [th[0] + Math.cos(ta) * tl, th[1] + Math.sin(ta) * tl];
    const te = [th[0] + Math.cos(ta) * (tl - 0.04), th[1] + Math.sin(ta) * (tl - 0.04)];
    // the door hangs open under the well until the wheel is in, then shuts along the belly
    const shut = sstep(0.72, 1, g), dh = [0.37, 0.322], da = Math.atan2(0.119, -0.993) + (1 - shut) * 1.25;
    const door = [dh, [dh[0] + Math.cos(da) * 0.24, dh[1] + Math.sin(da) * 0.24]];
    return { legs: [[mh, me], circ(mw, 0.08, 41), ...spokes(mw, 0.065, wa, 1), [th, te], circ(tw, 0.04, 42, 10)], door };
  }

  /* ================= drawing by hand =================
     Every line is cut into short steps, each nudged off true by a smooth
     wobble that is redrawn eight times a second, which is what makes a pen line
     look alive on film. Each stroke is then laid down as a ribbon that swells in
     the middle and thins at the ends, the way a nib does. */
  let W = 0, H = 0, DPR = 1, FH = 150, X0 = 0, GY = 0, J = 0.7, LW = 2, SEG = 7, boil = 0;
  let tf = { x: 0, y: 0, r: 0 };
  const FIG = '#EFEADF', LINE = '#E2DCCC';
  const INKBG = '#06080F';
  const scr = p => {
    const c = Math.cos(tf.r), s = Math.sin(tf.r);
    return [X0 + (tf.x + p[0] * c - p[1] * s) * FH, GY - (tf.y + p[0] * s + p[1] * c) * FH];
  };
  function wobble(pts, id, seg) {
    const out = [], step = seg || SEG;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let j = 0; j < n; j++) out.push([lerp(a[0], b[0], j / n), lerp(a[1], b[1], j / n)]);
    }
    const e = pts[pts.length - 1];
    out.push([e[0], e[1]]);
    const h1 = id * 12.9898 + boil * 78.233, h2 = id * 4.1414 + boil * 3.7;
    for (let i = 0; i < out.length; i++) {
      out[i][0] += (Math.sin(i * 0.9 + h1) * 0.6 + Math.sin(i * 0.37 + h2) * 0.4) * J;
      out[i][1] += (Math.sin(i * 0.8 + h2 * 1.3) * 0.6 + Math.sin(i * 0.41 + h1 * 0.7) * 0.4) * J;
    }
    return out;
  }
  // one nib stroke along a polyline in screen space
  function nib(poly, w, closed, id) {
    const n = poly.length;
    if (n < 2) return;
    const L = [0];
    for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    const tot = L[n - 1] || 1, left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = poly[Math.max(0, i - 1)], b = poly[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const u = L[i] / tot;
      const taper = closed ? 1 : Math.pow(Math.sin(Math.PI * clamp(u, 0.03, 0.97)), 0.5);
      const hw = w * 0.5 * (0.4 + 0.6 * taper) * (1 + 0.2 * Math.sin(L[i] * 0.08 + id * 1.3));
      left.push([poly[i][0] - dy * hw, poly[i][1] + dx * hw]);
      right.push([poly[i][0] + dy * hw, poly[i][1] - dx * hw]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
  }
  /* lay down a list of polylines in pen, the first `frac` of their length in the order given;
     `thin` lines (the graticule) take a plain pencil stroke at a coarser step, which is all a
     hairline shows and a fraction of the work on a phone */
  function ink(list, frac, alpha, col, w, idBase, screen, thin) {
    if (frac <= 0.001 || alpha <= 0.003) return;
    let budget = Infinity;
    const polys = list.map((pts, k) => wobble(screen ? pts : pts.map(scr), idBase + k, thin ? SEG * 3 : 0));
    if (frac < 1) {
      let total = 0;
      for (const p of polys) for (let i = 1; i < p.length; i++) total += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      budget = total * frac;
    }
    ctx.globalAlpha = alpha; ctx.fillStyle = col;
    if (thin) { ctx.strokeStyle = col; ctx.lineWidth = w || LW; ctx.beginPath(); }
    polys.forEach((p, k) => {
      if (budget <= 0) return;
      let cut = p.length;
      if (budget < Infinity) {
        let run = 0;
        for (let i = 1; i < p.length; i++) {
          const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
          if (run + d > budget) {
            const t = (budget - run) / d;
            p[i] = [lerp(p[i - 1][0], p[i][0], t), lerp(p[i - 1][1], p[i][1], t)];
            cut = i + 1; run = budget; break;
          }
          run += d;
        }
        budget -= run;
      }
      const q = cut < p.length ? p.slice(0, cut) : p;
      if (thin) { q.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])); return; }
      const closed = q.length > 3 && Math.hypot(q[0][0] - q[q.length - 1][0], q[0][1] - q[q.length - 1][1]) < 2;
      nib(q, w || LW, closed, idBase + k);
    });
    if (thin) ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const trace = (pts, hole) => {
    ctx.beginPath();
    pts.map(scr).forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    if (hole) { hole.map(scr).forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
  };
  // fill a shape with the paper colour, so it hides what is behind it
  function occlude(pts, alpha, hole) {
    if (alpha <= 0.003) return;
    ctx.globalAlpha = alpha; ctx.fillStyle = INKBG;
    trace(pts, hole); ctx.fill('evenodd');
    ctx.globalAlpha = 1;
  }
  // engraver's hatching, clipped to a shape
  function hatch(pts, alpha, hole, dense) {
    if (alpha <= 0.01) return;
    const sp = pts.map(scr);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of sp) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const gap = Math.max(3, FH * (dense ? 0.022 : 0.03)), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const rad = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
    ctx.save();
    trace(pts, hole); ctx.clip('evenodd');
    // the hatching turns with what it shades, so a climbing plane keeps its shading
    ctx.translate(mx, my); ctx.rotate(-tf.r);
    ctx.globalAlpha = alpha; ctx.strokeStyle = LINE; ctx.lineWidth = Math.max(0.6, LW * 0.32);
    ctx.beginPath();
    for (let q = -2 * rad; q < 2 * rad; q += gap) {
      const j = Math.sin(q * 0.37 + boil * 1.7) * 0.9;
      ctx.moveTo(q + j - rad * 0.8, rad); ctx.lineTo(q + j + rad * 0.8, -rad);
    }
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function figureFar(p, a) { ink([[p.hip, p.k1, p.f1], [p.sh, p.e1, p.h1]], 1, a * 0.45, FIG, LW * 1.1, 1); }
  function figureNear(p, a) {
    ink([[p.hip, p.sh, p.nk], circ(p.hd, HR, 4, 16), [p.hip, p.k2, p.f2], [p.sh, p.e2, p.h2]], 1, a, FIG, LW * 1.15, 3);
  }

  /* ================= the ride, set by the scroll =================
     s runs 0 to 7: standing, walking, running, cycling, driving, sailing,
     steaming, flying. Each holds for a stretch of the scroll and hands over
     to the next. */
  // each change from one means of travel to the next takes about three times the scroll it holds for:
  // the drawing in between is the part worth watching, and the figure keeps moving while it holds
  const KEYS = [[0, 0], [0.02, 0], [0.07, 1], [0.1, 1], [0.16, 2], [0.19, 2], [0.27, 3], [0.3, 3],
                [0.38, 4], [0.41, 4], [0.5, 5], [0.53, 5], [0.62, 6], [0.65, 6], [0.73, 7], [1, 7]];
  const stageOf = p => {
    for (let i = 1; i < KEYS.length; i++) {
      const [p1, s1] = KEYS[i], [p0, s0] = KEYS[i - 1];
      if (p <= p1) return s0 === s1 ? s0 : lerp(s0, s1, sstep(p0, p1, p));
    }
    return 7;
  };
  // standing, walking, running, bicycle, car, sail, steam, plane: figure heights a second
  const SPEED = [0, 1.0, 2.3, 3.2, 5.2, 2.2, 3.0, 7.5];
  const speedAt = s => lerp(SPEED[Math.floor(s)], SPEED[Math.ceil(s)], s - Math.floor(s));
  const TAKEOFF = [0.75, 0.86], RING = [0.86, 0.96], GRAT = [0.95, 0.985], END = 0.988;
  const waterAt = s => clamp(1 - Math.max(0, 5 - s, s - 6), 0, 1);

  /* where the globe will be: asked of the page once it is built, worked out
     the same way before that */
  function globeGeom() {
    const A = window.ISO_APP;
    if (A && A.booted) return A.geom();
    const mob = W <= 820 && H >= 480;
    if (mob) {
      const peek = 158, head = 58, h = H - peek - head;
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
    J = Math.max(0.55, FH * 0.0042); LW = Math.max(1.7, FH * 0.015); SEG = Math.max(5, FH * 0.04);
    if (typeof pos === 'number') pos = target * spanPx();          // keep the place on the track when the screen changes
  }

  /* ================= state and the loop ================= */
  let P = 0, target = 0, last = performance.now(), time = 0;
  let off = 0, phi = 0, crank = 0, wheel = 0, prop = 0, puffT = 0, stepT = 0;
  const puffs = [];
  let G = null, leaving = null, waiting = false, finished = false;

  // the scroll, done by hand: a flick carries on and slows the way a native scroll does
  let pos = 0, fling = 0;
  const spanPx = () => Math.max(1, H * 7);                          // the ride is seven screens of scrolling
  const moveBy = d => { pos = clamp(pos + d, 0, spanPx()); target = pos / spanPx(); };
  root.addEventListener('wheel', e => {
    e.preventDefault();
    fling = 0;
    moveBy(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1));
  }, { passive: false });
  let ty = null, tt = 0, vel = 0;
  root.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { ty = null; return; }
    ty = e.touches[0].clientY; tt = performance.now(); vel = 0; fling = 0;
  }, { passive: true });
  root.addEventListener('touchmove', e => {
    if (ty === null) return;
    e.preventDefault();
    const y = e.touches[0].clientY, now = performance.now(), dy = ty - y;
    vel = 0.8 * (dy / Math.max(1, now - tt)) + 0.2 * vel;           // pixels a millisecond, smoothed
    ty = y; tt = now;
    moveBy(dy);
  }, { passive: false });
  root.addEventListener('touchend', () => {
    if (ty === null) return;
    ty = null;
    if (performance.now() - tt < 90) fling = vel;                    // still moving when it let go
  }, { passive: true });

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    tick(dt);
    if (!finished) requestAnimationFrame(frame);
  }
  function tick(dt) {
    time += dt;
    if (fling) {
      moveBy(fling * dt * 1000);
      fling *= Math.exp(-dt * 1000 / 325);
      if (Math.abs(fling) < 0.02 || pos <= 0 || pos >= spanPx()) fling = 0;
    }
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

    words();
    draw(s, tRing);

    if (!leaving && P >= END) {
      if (window.ISO_APP && window.ISO_APP.booted) finish(false);
      else if (!waiting) { waiting = true; root.classList.add('waiting'); }
    }
  }

  let titleFade = 1;
  function words() {
    titleFade = 1 - sstep(0.008, 0.032, P);
    elTitle.style.opacity = titleFade.toFixed(3);
    elTitle.style.transform = 'translate(-50%,' + (-(1 - titleFade) * 18).toFixed(1) + 'px)';
    elHint.style.opacity = titleFade.toFixed(3);
  }

  // the rig: ships rock on the water, the plane climbs away
  function rigAt(k, wat) {
    const r = { x: 0, y: 0, r: 0 };
    if (wat > 0) {
      r.y += (reduced ? 0 : Math.sin(time * 1.6) * 0.018) * wat;
      r.r += (reduced ? 0 : Math.sin(time * 1.25) * 0.03) * wat;
    }
    if (k > 0) {
      r.x += k * k * (W * 0.72) / FH;
      r.y += Math.pow(k, 1.7) * (H * 0.95) / FH;
      r.r += 0.3 * sstep(0, 0.35, k) * (1 - 0.4 * sstep(0.6, 1, k));
    }
    return r;
  }

  function draw(s, tRing) {
    ctx.clearRect(0, 0, W, H);
    const fade = leaving ? 1 - clamp((performance.now() - leaving.t0) / leaving.dur, 0, 1) : 1;
    const pres = v => clamp(1 - Math.abs(s - v), 0, 1);
    const k = sstep(TAKEOFF[0], TAKEOFF[1], P);
    const wat = waterAt(s);
    const standness = clamp(1 - s, 0, 1) + pres(5) + pres(6);
    const breath = reduced ? 0 : Math.sin(time * 1.8) * 0.004 * standness;

    tf = { x: 0, y: 0, r: 0 };
    cartouche(titleFade);

    /* ---- the pose, handed from one means of travel to the next ---- */
    const a = Math.floor(s), t = s - a;
    const poseOf = st => st <= 2 ? gaitPose(phi, gaitAt(st), breath) : st === 3 ? bikePose(crank) :
      st === 4 ? carPose() : st === 5 ? sailPose(phi, breath) : st === 6 ? steamPose(phi, breath) : pilotPose();
    const pose = s <= 2 ? gaitPose(phi, gaitAt(s), breath) : t < 1e-3 ? poseOf(a) : mixPose(poseOf(a), poseOf(a + 1), sstep(0, 1, t));

    tf = rigAt(k, wat);
    const shown = 1 - sstep(0.93, 1, k);                        // gone once out of the frame
    if (shown > 0) {
      // behind the figure: the bicycle, and the body of the steamer
      figureFar(pose, shown);
      const pb = pres(3), pc = pres(4), psl = pres(5), pst = pres(6), pp = pres(7);
      if (pb > 0) ink(bikeStrokes(crank, wheel), sstep(0, 1, pb), 1, LINE, LW, 100);
      if (pst > 0) {
        smoke(pst);
        occlude(STEAM_HULL, pst); hatch(STEAM_HULL, 0.3 * pst); hatch(FUNNEL, 0.4 * pst, null, true);
        ink(steamBack(), sstep(0, 1, pst), 1, LINE, LW, 200);
      }
      // the luggage, on the traveller's back or on deck
      const bagA = s >= 7 ? 0 : s > 6 ? 1 - sstep(0, 1, t) : 1;
      if (bagA > 0.01) {
        const bag = s <= 4 || t < 1e-3 || a >= 6 ? bagFor(Math.min(a, 6), pose) : mixBag(bagFor(a, pose), bagFor(a + 1, pose), sstep(0, 1, t));
        const loop = bag.pts.concat([bag.pts[0]]);
        occlude(loop, bagA); hatch(loop, 0.28 * bagA, null, true);
        ink([loop, ...bag.lines], 1, bagA * shown, FIG, LW * 0.95, 800);
      }
      figureNear(pose, shown);
      // in front of it: whatever the figure is inside, or standing behind
      if (pst > 0) {
        occlude(WHEELHOUSE, pst, WH_WINDOW); hatch(WHEELHOUSE, 0.22 * pst, WH_WINDOW);
        ink(steamFront(), sstep(0, 1, pst), 1, LINE, LW, 250);
      }
      if (psl > 0) {
        const sh = sailShip(time);
        ink(sh.back, sstep(0, 1, psl), 0.85, LINE, LW * 0.8, 600);
        for (const sp of sh.sails) occlude(sp, psl);
        ink(sh.sails, sstep(0, 1, psl), 1, LINE, LW, 620);
        ink(sh.seams, sstep(0, 1, psl), 0.45, LINE, LW * 0.6, 640);
        occlude(SAIL_HULL, psl); hatch(SAIL_HULL, 0.3 * psl);
        ink(sh.hull, sstep(0, 1, psl), 1, LINE, LW, 660);
      }
      if (pc > 0) {
        occlude(CAR_BODY, pc, CAR_WIN); hatch(CAR_BODY, 0.2 * pc, CAR_WIN);
        ink(carStrokes(wheel), sstep(0, 1, pc), 1, LINE, LW, 300);
      }
      if (pp > 0) {
        const gr = gear(k, wheel);
        ink(gr.legs, sstep(0, 1, pp), shown, LINE, LW, 450);
        occlude(PLANE_BODY, pp); occlude(CANOPY, pp, GLASS);
        hatch(PLANE_BODY, 0.2 * pp); hatch(FIN, 0.3 * pp, null, true);
        ink(planeStrokes(prop), sstep(0, 1, pp), shown, LINE, LW, 400);
        ink([gr.door], sstep(0, 1, pp), shown, LINE, LW * 0.9, 460);
      }
    }

    /* ---- the ground, which becomes the rim of the globe ---- */
    tf = { x: 0, y: 0, r: 0 };
    ground(s, wat, tRing, fade);
    if (tRing >= 0.999) graticule(sstep(GRAT[0], GRAT[1], P), fade);
  }

  function smoke(a) {
    const top = FUNNEL_TOP;
    if (!reduced && puffT > 0.42) { puffT = 0; puffs.push({ t: 0 }); }
    for (const q of puffs) q.t += reduced ? 0 : stepT;
    while (puffs.length && puffs[0].t > 3.2) puffs.shift();
    const list = reduced ? [{ t: 0.6 }, { t: 1.4 }, { t: 2.2 }] : puffs;
    for (const q of list) {
      const c = [top[0] - q.t * 0.34, top[1] + 0.06 + q.t * 0.1];
      ink([circ(c, 0.035 + q.t * 0.05, 50 + Math.round(q.t * 10) % 7, 14)], 1, a * 0.5 * (1 - q.t / 3.2), LINE, LW * 0.7, 500);
    }
  }


  function ground(s, wat, tRing, fade) {
    const A = 0.028 * FH * sstep(0, 1, wat), lam = 0.5;
    const yAt = x => GY - A * Math.sin(TAU * ((x - X0) / FH + off) / lam + (reduced ? 0 : time * 0.9));
    if (tRing <= 0.001) {
      const pts = [];
      for (let x = -24; x <= W + 24; x += 8) pts.push([x, yAt(x)]);
      // below the line is water or earth: hide what sits beneath it
      ctx.fillStyle = INKBG; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(-24, H + 10);
      for (const p of pts) ctx.lineTo(p[0], p[1] + LW * 0.6);
      ctx.lineTo(W + 24, H + 10); ctx.closePath(); ctx.fill();
      ink([pts], 1, 0.95 * fade, LINE, LW * 1.1, 900, true);
      marks(yAt, 1 - wat, wat, fade);
      return;
    }
    /* The line keeps its length and bends: an arc of ever tighter radius
       whose lowest point walks down to the bottom of the globe, until its two
       ends meet at the top and it is the globe's rim. */
    const R = G.r, L0 = Math.max(W + 240, TAU * R, 2 * (Math.max(G.cx, W - G.cx) + 60)), e = sstep(0, 1, tRing);
    const len = lerp(L0, TAU * R, e), span = TAU * tRing;
    const bx = G.cx, by = lerp(GY, G.cy + R, sstep(0, 0.6, tRing));   // down to the rim early, so the ends stay in view
    const rho = len / span, cyA = by - rho;
    const n = 240, pts = [];
    for (let i = 0; i <= n; i++) {
      const aa = Math.PI / 2 + span * (i / n - 0.5);
      pts.push([bx + rho * Math.cos(aa), cyA + rho * Math.sin(aa)]);
    }
    ink([pts], 1, 0.95 * fade, LINE, LW * (1.1 + 0.2 * e), 900, true);
    const fm = 1 - sstep(0, 0.12, tRing);
    if (fm > 0) marks(yAt, fm, 0, fm * fade);
  }

  // a few hatch marks under the land and small crests on the water, riding with the ground
  const hs = n => { const x = Math.sin(n * 91.345 + 17.1) * 43758.5453; return x - Math.floor(x); };
  function marks(yAt, land, water, a) {
    const gap = 0.16, i0 = Math.floor((off - X0 / FH) / gap) - 2, i1 = Math.ceil((off + (W - X0) / FH) / gap) + 2;
    const hatchL = [], crest = [];
    for (let i = i0; i <= i1; i++) {
      const u = i * gap + hs(i) * 0.09, x = X0 + (u - off) * FH;
      if (land > 0.01 && hs(i + 3) < 0.62) {
        const y = yAt(x) + LW + 2, l = (0.025 + 0.03 * hs(i + 7)) * FH;
        hatchL.push([[x, y], [x - l * 0.55, y + l]]);
      }
      if (water > 0.01 && i % 2 === 0 && hs(i + 11) < 0.7) {
        const y = yAt(x) + (0.06 + 0.1 * hs(i + 5)) * FH, w = 0.06 * FH;
        crest.push([[x - w, y], [x - w * 0.4, y + w * 0.22], [x + w * 0.2, y + w * 0.1]]);
      }
    }
    if (hatchL.length) ink(hatchL, 1, 0.42 * land * a, LINE, LW * 0.7, 950, true);
    if (crest.length) ink(crest, 1, 0.38 * water * a, LINE, LW * 0.7, 980, true);
  }

  // the title in a cartouche: a double rule, drawn round it by hand
  function cartouche(a) {
    if (a <= 0.01) return;
    const r = elTitle.getBoundingClientRect();
    const x0 = r.left, x1 = r.right, y0 = r.top, y1 = r.bottom, d = 5;
    const box = i => [[x0 - i, y0 - i], [x1 + i, y0 - i], [x1 + i, y1 + i], [x0 - i, y1 + i], [x0 - i, y0 - i]];
    ink([box(0)], 1, a * 0.7, LINE, LW * 0.8, 1400, true);
    ink([box(d)], 1, a * 0.35, LINE, LW * 0.5, 1410, true);
    ink([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([cx, cy]) => circ([cx, cy], 3.2, cx + cy, 10)), 1, a * 0.6, LINE, LW * 0.6, 1420, true);
  }

  /* The graticule of the globe that is about to appear, every thirty
     degrees, turned the way the globe will be turned, so the sketch lands
     where the map's own pencilled graticule does. */
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
    ink(lines, t, 0.32 * fade, LINE, LW * 0.6, 700, true, true);
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
  const KEYSTEP = { ArrowDown: 0.08, ArrowUp: -0.08, PageDown: 0.9, PageUp: -0.9, ' ': 0.9, End: 99, Home: -99 };
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); finish(true); return; }
    if (e.key in KEYSTEP && e.target === root) {
      e.preventDefault(); fling = 0;
      moveBy((e.key === ' ' && e.shiftKey ? -1 : 1) * KEYSTEP[e.key] * H);
    }
  });

  // on a local server only: hold the ride at any point and run it for a while, frame by frame
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname))
    window.__intro = { at(p, secs) { target = P = p; pos = p * spanPx(); for (let i = 0; i < Math.round((secs || 0.5) * 60); i++) tick(1 / 60); return stageOf(P); } };

  size();
  window.addEventListener('resize', size);
  root.focus({ preventScroll: true });
  requestAnimationFrame(frame);
})();
