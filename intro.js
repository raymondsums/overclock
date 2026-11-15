// Overclock intro: three picture frames at the start, two one-time tips in play, and the illustrated rules.
// Everything is drawn with the game's own art through window.ConveyorArt (set in game.js, see "INTRO hook").
// CSS lives in the /* INTRO */ block in index.html. No engine rules here.
(function () {
  const SEEN_KEY = 'conveyor.intro', TIPS_KEY = 'conveyor.tips';
  const A = () => window.ConveyorArt;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const LOOP = 3.2;   // seconds per frame loop
  const W = 400, H = 140;   // every frame is a 20:7 stage

  // ---------- small drawing helpers on top of the game's iso camera ----------
  // fit: a camera that puts the given ground corners [u, v, z] inside rect (viewBox units)
  function fit(rect, corners) {
    const a = A();
    const raw = a.withCam({ s: 1, ox: 0, oy: 0 }, () => corners.map(([u, v, z]) => a.P(u, v, z)));
    const xs = raw.map((p) => p.x), ys = raw.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const s = Math.min(rect.w / (x1 - x0), rect.h / (y1 - y0));
    return { s, ox: rect.x + rect.w / 2 - (x0 + x1) / 2 * s, oy: rect.y + rect.h / 2 - (y0 + y1) / 2 * s };
  }
  // the following run inside withCam
  const bayPts = (u0, v0, v1) => { const a = A(), G = a.GU; v1 = v1 === undefined ? v0 + G.mD : v1; return a.pts([a.P(u0 + .03, v0 - .02, 0), a.P(u0 + .97, v0 - .02, 0), a.P(u0 + .97, v1 + .04, 0), a.P(u0 + .03, v1 + .04, 0)]); };
  const bay = (u0, v0, cls, v1) => `<polygon class="ibay${cls ? ' ' + cls : ''}" points="${bayPts(u0, v0, v1)}"/>`;
  function plus(u0, v0) {
    const a = A(), f = a.f1, m = v0 + a.GU.mD / 2;
    const p = [a.P(u0 + .38, m, 0), a.P(u0 + .62, m, 0), a.P(u0 + .5, m - .14, 0), a.P(u0 + .5, m + .14, 0)];
    return `<path class="iplus" d="M${f(p[0].x)} ${f(p[0].y)}L${f(p[1].x)} ${f(p[1].y)}M${f(p[2].x)} ${f(p[2].y)}L${f(p[3].x)} ${f(p[3].y)}"/>`;
  }
  const machine = (id, u0, v0) => { const a = A(); return a.drawParts(id, a.isoView(u0 + (1 - a.GU.mW) / 2, v0)); };
  function joints() {
    const a = A(); let d = '';
    for (let u = -2; u <= 9; u += 2) d += `M${u} -1.2L${u} 5.6`;
    for (let v = -1.2; v <= 5.6; v += 2.27) d += `M-2.5 ${v}L9 ${v}`;
    return `<g transform="${a.gmat()}"><path d="${d}" style="stroke:var(--joint)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/></g>`;
  }
  // an item drawn like .item .shape: centred on x, sitting 62% up its own height
  function sprite(type, x, y, w) {
    const h = w * .875, f = A().f1;
    return A().ITEM[type].replace('<svg ', `<svg x="${f(x - w / 2)}" y="${f(y - h * .62)}" width="${f(w)}" height="${f(h)}" `);
  }
  // a straight run of belt along u, back row
  const belt = (u0, u1, v) => { const d = `M${u0} ${v}L${u1} ${v}`; return A().beltSVG(d, d); };
  function tote(u0, v) {   // the Shipping tote, as placeEnds draws it
    const a = A(), G = a.GU, bv = a.isoView(u0, v - .36), BW = .72;
    const top = [a.P(u0 + .06 * G.mW, v - .36 + .1 * G.mD, .5 * G.H), a.P(u0 + (BW - .06) * G.mW, v - .36 + .1 * G.mD, .5 * G.H), a.P(u0 + (BW - .06) * G.mW, v - .36 + .9 * G.mD, .5 * G.H), a.P(u0 + .06 * G.mW, v - .36 + .9 * G.mD, .5 * G.H)];
    return bv.box(0, BW, 0, 1, 0, .5, '#45494d') + bv.dec(1, `<rect x=".09" y=".12" width="${BW - .18}" height=".26" fill="none" stroke="#6a6f73" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="M.22 .25L.5 .25" fill="none" stroke="#d3b24a" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linecap="round"/>`) +
      `<polygon points="${a.pts(top)}" fill="#26282b"/>`;
  }
  function hopper(u, v) {   // the sand funnel, as placeEnds draws it
    const a = A(), G = a.GU, hv = a.isoView(u - .4, v - .4 * G.mW / G.mD), f = a.f1;
    const leg = (sx, sy) => hv.box(.5 + sx - .04, .5 + sx + .04, .5 + sy * G.mW / G.mD - .05, .5 + sy * G.mW / G.mD + .05, 0, .5, a.DSTEEL);
    const o = a.P(u, v, 1.12 * G.H), sc = fitScale();
    return leg(-.36, -.36) + leg(.36, -.36) + hv.hop(.5, .5, .42, .2, .48, 1.12, a.STEEL) + leg(-.36, .36) + leg(.36, .36) +
      `<ellipse cx="${f(o.x - sc * .1)}" cy="${f(o.y)}" rx="${f(sc * .09)}" ry="${f(sc * .05)}" fill="#b9a576"/><ellipse cx="${f(o.x + sc * .12)}" cy="${f(o.y + 1)}" rx="${f(sc * .08)}" ry="${f(sc * .045)}" fill="#d3c08f"/>`;
  }
  // the current camera scale, read back from P
  const fitScale = () => { const a = A(), p = a.P(0, 0, 0), q = a.P(1, 0, 0); return Math.hypot(q.x - p.x, q.y - p.y); };

  // keyframes: [[pct, css], ...]
  const kf = (name, stops) => `@keyframes ${name}{${stops.map(([p, c]) => `${p}%{${c}}`).join('')}}`;
  const anim = (name, ease) => `animation:${name} ${LOOP}s ${ease || 'ease-in-out'} infinite`;

  // ---------- frame 1: a card goes onto a tile, the machine appears ----------
  function frameA() {
    const a = A(), G = a.GU;
    const cam = fit({ x: 138, y: 8, w: 256, h: 126 }, [[.6, 0, 1.2 * G.H], [4.4, 0, 1.2 * G.H], [4.4, G.b1 + G.bw, 0], [.6, G.b1 + G.bw, 0]]);
    return a.withCam(cam, () => {
      const drop = a.P(2.5, G.mD * .5, .2 * G.H);
      const svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${joints()}${belt(.6, 4.4, G.b1c)}
        ${bay(1, 0)}<g>${machine('roller', 1, 0)}</g>
        ${bay(2, 0)}<polygon class="ibay ihot fa-hot" points="${bayPts(2, 0)}"/><g class="fa-plus">${plus(2, 0)}</g><g class="fa-mach">${machine('smelter', 2, 0)}</g>
        ${bay(3, 0)}${plus(3, 0)}</svg>`;
      const tx = (drop.x / W * 100).toFixed(1), ty = (drop.y / H * 100).toFixed(1);
      const css = kf('fa-card', [[0, 'left:15%;top:96%;scale:1;opacity:0'], [6, 'left:15%;top:96%;scale:1;opacity:1'], [16, 'left:15%;top:80%;scale:1;opacity:1'],
        [40, `left:${tx}%;top:${ty}%;scale:.44;opacity:1`], [47, `left:${tx}%;top:${ty}%;scale:.34;opacity:0`], [48, 'left:15%;top:96%;scale:1;opacity:0'], [100, 'left:15%;top:96%;scale:1;opacity:0']]) +
        kf('fa-dot', [[0, 'left:15%;top:96%;opacity:0'], [10, 'left:15%;top:96%;opacity:0'], [16, 'left:15%;top:80%;opacity:1'],
          [40, `left:${tx}%;top:${ty}%;opacity:1`], [46, `left:${tx}%;top:${ty}%;opacity:0`], [48, 'left:15%;top:96%;opacity:0'], [100, 'left:15%;top:96%;opacity:0']]) +
        kf('fa-mach', [[0, 'opacity:0;transform:scale(.6)'], [43, 'opacity:0;transform:scale(.6)'], [47, 'opacity:1;transform:scale(1.1)'], [54, 'opacity:1;transform:scale(1)'],
          [90, 'opacity:1;transform:scale(1)'], [97, 'opacity:0;transform:scale(1)'], [100, 'opacity:0;transform:scale(.6)']]) +
        kf('fa-plus', [[0, 'opacity:1'], [43, 'opacity:1'], [45, 'opacity:0'], [96, 'opacity:0'], [100, 'opacity:1']]) +
        kf('fa-hot', [[0, 'opacity:0'], [42, 'opacity:0'], [46, 'opacity:1'], [74, 'opacity:1'], [86, 'opacity:0'], [100, 'opacity:0']]) +
        `.fa .icard{${anim('fa-card')}}.fa .idot{${anim('fa-dot')}}.fa .fa-mach{${anim('fa-mach')}}.fa .fa-plus{${anim('fa-plus', 'linear')}}.fa .fa-hot{${anim('fa-hot', 'linear')}}`;
      // end state (reduced motion): machine standing on a fresh tile, card gone
      const html = `<div class="istage fa">${svg}<div class="icard" style="left:${tx}%;top:${ty}%"><div class="${a.cardClass('smelter')}">${a.cardHTML('smelter')}</div></div><span class="idot" style="left:${tx}%;top:${ty}%"></span></div>`;
      return { html, css };
    });
  }

  // ---------- frame 2: Run, sand rides the belt and comes out a RAM stick ----------
  function frameB() {
    const a = A(), G = a.GU, v = G.b1c, TU = 5.05;
    const cam = fit({ x: 100, y: 6, w: 296, h: 116 }, [[.1, v - .5, 1.3 * G.H], [1, 0, 1.2 * G.H], [5.85, 0, 1.2 * G.H], [5.85, v + .6, 0], [.1, v + .6, 0]]);
    return a.withCam(cam, () => {
      const s = fitScale(), iw = s * .56, f = a.f1, z = .1 * G.H;
      const ids = ['smelter', 'press', 'cutter', 'assembler'];
      const stops = [a.P(G.hopU + .05, v, z), ...ids.map((_, i) => a.P(1.5 + i, v, z)), a.P(TU + .1, v, z), a.P(TU + .36, v, .5 * G.H)];
      const T = [12, 24, 36, 48, 60, 70, 77];   // when the item reaches each stop
      const types = [['ore', 0, 24], ['ingot', 24, 36], ['plate', 36, 48], ['gear', 48, 60], ['ram', 60, 100]];
      const lbl = a.P(TU + .36, v - .36 + G.mD, 0);
      const run = { x: 10, y: 84, w: 82, h: 34 };
      const end = stops[5];
      let svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${joints()}<g class="running" style="--cleat:60ms">${belt(G.e0, TU + .3, v)}</g>${hopper(G.hopU, v)}`;
      ids.forEach((id, i) => { svg += bay(1 + i, 0) + `<g class="fb-m fb-m${i}">${machine(id, 1 + i, 0)}</g>`; });
      svg += `<g class="fb-tote">${tote(TU, v)}</g>`;
      svg += `<text class="ilabel" x="${f(lbl.x)}" y="${f(lbl.y + 11)}" text-anchor="middle">shipping</text>`;
      svg += `<g class="fb-item" style="transform:translate(${f(end.x)}px,${f(end.y)}px)">` +
        types.map(([t], i) => `<g class="fb-t fb-t${i}"${i === 4 ? '' : ' style="opacity:0"'}>${sprite(t, 0, 0, iw)}</g>`).join('') + '</g>';
      const fl = a.P(TU + .72 * G.mW, v - .36, .5 * G.H);   // just right of the tote, clear of the machines
      svg += `<text class="ifloat fb-plus" x="${f(fl.x + 3)}" y="${f(fl.y + 4)}" text-anchor="start">+49</text>`;
      svg += `<g class="fb-run"><rect x="${run.x}" y="${run.y}" width="${run.w}" height="${run.h}" rx="7" style="fill:var(--char)"/><rect x="${run.x}" y="${run.y + run.h - 4}" width="${run.w}" height="4" rx="2" fill="rgba(0,0,0,.35)"/>` +
        `<text class="irun" x="${run.x + run.w / 2 + 2}" y="${run.y + run.h / 2 + 7}" text-anchor="middle">RUN</text></g>` +
        `<circle class="fb-dot" cx="${run.x + run.w * .62}" cy="${run.y + run.h * .55}" r="11"/></svg>`;
      // keyframes
      let css = kf('fb-item', [[0, `transform:translate(${f(stops[0].x)}px,${f(stops[0].y - 8)}px);opacity:0`], [10, `transform:translate(${f(stops[0].x)}px,${f(stops[0].y - 8)}px);opacity:0`],
        ...T.map((t, i) => [t, `transform:translate(${f(stops[i].x)}px,${f(stops[i].y)}px);opacity:${i === 6 ? 0 : 1}`]),
        [100, `transform:translate(${f(stops[6].x)}px,${f(stops[6].y)}px);opacity:0`]]);
      types.forEach(([, s0, s1], i) => {
        const st = [[0, `opacity:${s0 === 0 ? 1 : 0};transform:scale(1)`]];
        if (s0 > 0) st.push([s0 - .1, 'opacity:0;transform:scale(.6)'], [s0, 'opacity:1;transform:scale(.6)'], [s0 + 3, 'opacity:1;transform:scale(1.2)'], [s0 + 6, 'opacity:1;transform:scale(1)']);
        if (s1 < 100) st.push([s1 - .1, 'opacity:1;transform:scale(1)'], [s1, 'opacity:0;transform:scale(1)']);
        st.push([100, `opacity:${s1 === 100 ? 1 : 0};transform:scale(1)`]);
        css += kf('fb-t' + i, st) + `.fb .fb-t${i}{${anim('fb-t' + i, 'linear')}}`;
      });
      ids.forEach((_, i) => {
        const t = T[i + 1];
        css += kf('fb-m' + i, [[0, 'transform:scale(1)'], [t - 1, 'transform:scale(1)'], [t + 2, 'transform:scale(1.09)'], [t + 7, 'transform:scale(1)'], [100, 'transform:scale(1)']]) + `.fb .fb-m${i}{${anim('fb-m' + i)}}`;
      });
      css += kf('fb-run', [[0, 'transform:translateY(0)'], [3, 'transform:translateY(2px)'], [9, 'transform:translateY(2px)'], [12, 'transform:translateY(0)'], [100, 'transform:translateY(0)']]) +
        kf('fb-dot', [[0, 'opacity:0'], [2, 'opacity:.9'], [10, 'opacity:.9'], [14, 'opacity:0'], [100, 'opacity:0']]) +
        kf('fb-plus', [[0, 'opacity:0;transform:translateY(4px)'], [77, 'opacity:0;transform:translateY(4px)'], [81, 'opacity:1;transform:translateY(0)'], [92, 'opacity:1;transform:translateY(-3px)'], [97, 'opacity:0;transform:translateY(-6px)'], [100, 'opacity:0']]) +
        kf('fb-tote', [[0, 'transform:scale(1)'], [76, 'transform:scale(1)'], [80, 'transform:scale(1.06)'], [86, 'transform:scale(1)'], [100, 'transform:scale(1)']]) +
        `.fb .fb-item{${anim('fb-item', 'linear')}}.fb .fb-run{${anim('fb-run')}}.fb .fb-dot{${anim('fb-dot')}}.fb .fb-plus{${anim('fb-plus')}}.fb .fb-tote{${anim('fb-tote')}}`;
      return { html: `<div class="istage fb">${svg}</div>`, css };
    });
  }

  // ---------- frame 3: the order fills before the shift runs out ----------
  // The game has no real clock: a shift is 3 runs. The dial has 3 sectors, one per run, and the bar jumps once per run.
  function frameC() {
    const STEP = [22, 47, 72], NUM = ['0', '45', '110', '210'], WID = [0, 22.5, 55, 100];
    const sector = (i) => {
      const a0 = (-90 + i * 120) * Math.PI / 180, a1 = (-90 + (i + 1) * 120) * Math.PI / 180, r = 27;
      return `M40 40L${(40 + Math.cos(a0) * r).toFixed(2)} ${(40 + Math.sin(a0) * r).toFixed(2)}A${r} ${r} 0 0 1 ${(40 + Math.cos(a1) * r).toFixed(2)} ${(40 + Math.sin(a1) * r).toFixed(2)}Z`;
    };
    const ticks = [0, 1, 2].map((i) => { const ag = (-90 + i * 120) * Math.PI / 180; return `M${(40 + Math.cos(ag) * 27).toFixed(2)} ${(40 + Math.sin(ag) * 27).toFixed(2)}L${(40 + Math.cos(ag) * 33).toFixed(2)} ${(40 + Math.sin(ag) * 33).toFixed(2)}`; }).join('');
    const dial = `<svg class="idial" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="35" class="idial-face"/>` +
      [0, 1, 2].map((i) => `<path class="idial-s fc-s${i}" d="${sector(i)}"/>`).join('') +
      `<path d="${ticks}" class="idial-tick"/><g class="fc-hand"><path d="M40 40L40 13" class="idial-hand"/></g><circle cx="40" cy="40" r="4" class="idial-pin"/></svg>`;
    const html = `<div class="istage fc"><div class="fc-in">
      <div class="iq"><div class="qrow"><span class="total fc-num">${NUM.map((n, i) => `<i class="fc-n${i}">${n}</i>`).join('')}</span><span class="of">of 200</span></div>
      <div class="bar fc-bar"><i></i></div></div>${dial}</div></div>`;
    const jump = (i) => [[STEP[i] - 2.5, WID[i]], [STEP[i], WID[i + 1]]];
    let css = kf('fc-bar', [[0, 'width:0'], ...[0, 1, 2].flatMap((i) => jump(i).map(([p, w]) => [p, `width:${w}%`])), [96, 'width:100%'], [100, 'width:0']]) +
      kf('fc-met', [[0, 'background:var(--yellow)'], [71.9, 'background:var(--yellow)'], [72, 'background:var(--good)'], [97, 'background:var(--good)'], [97.1, 'background:var(--yellow)'], [100, 'background:var(--yellow)']]) +
      kf('fc-hand', [[0, 'transform:rotate(0deg)'], ...[0, 1, 2].flatMap((i) => [[STEP[i] - 3, `transform:rotate(${i * 120}deg)`], [STEP[i], `transform:rotate(${(i + 1) * 120}deg)`]]), [100, 'transform:rotate(360deg)']]);
    [0, 1, 2].forEach((i) => { css += kf('fc-s' + i, [[0, 'opacity:0'], [STEP[i] - .1, 'opacity:0'], [STEP[i], 'opacity:1'], [96, 'opacity:1'], [100, 'opacity:0']]) + `.fc .fc-s${i}{${anim('fc-s' + i, 'linear')}}`; });
    NUM.forEach((_, i) => {
      const s0 = i ? STEP[i - 1] : 0, s1 = i < 3 ? STEP[i] : 100;
      const st = i === 0 ? [[0, 'opacity:1'], [s1 - .1, 'opacity:1'], [s1, 'opacity:0'], [97, 'opacity:0'], [97.1, 'opacity:1'], [100, 'opacity:1']]
        : i === 3 ? [[0, 'opacity:0'], [s0 - .1, 'opacity:0'], [s0, 'opacity:1'], [97, 'opacity:1'], [97.1, 'opacity:0'], [100, 'opacity:0']]
          : [[0, 'opacity:0'], [s0 - .1, 'opacity:0'], [s0, 'opacity:1'], [s1 - .1, 'opacity:1'], [s1, 'opacity:0'], [100, 'opacity:0']];
      css += kf('fc-n' + i, st) + `.fc .fc-n${i}{${anim('fc-n' + i, 'linear')}}`;
    });
    css += `.fc .fc-bar i{${anim('fc-bar', 'ease-out')},${'fc-met'} ${LOOP}s linear infinite}.fc .fc-hand{${anim('fc-hand', 'cubic-bezier(.3,1.4,.5,1)')}}`;
    return { html, css };
  }

  // ---------- the start ----------
  function framesHTML() {
    const fr = [frameA(), frameB(), frameC()];
    const caps = ['Put machines on the belt.', 'Run it. Sand becomes RAM.', 'Fill the order before the shift ends.'];
    return `<style>${fr.map((x) => x.css).join('')}</style>
      <div class="intro">
        <div class="intro-head"><h2 class="intro-mark">Overclock</h2></div>
        <ol class="intro-frames">${fr.map((x, i) => `<li class="ifr">${x.html}<p class="icap">${caps[i]}</p></li>`).join('')}</ol>
        <div class="row intro-row"><button class="primary" id="goBtn">Start shift 1</button></div>
      </div>`;
  }

  // the picture intro. A tap anywhere (sheet or veil) starts, the same as the button.
  function showFrames(o) {
    o.sheet(framesHTML());
    const veil = document.getElementById('veil');
    const go = (e) => { if (e) e.stopPropagation(); veil.removeEventListener('click', go); store.set(SEEN_KEY, '1'); o.go(); };
    setTimeout(() => veil.addEventListener('click', go), 0);   // not the click that opened it
    document.getElementById('goBtn').addEventListener('click', go);
  }

  function showShort(o) {
    o.sheet(`<h2>Overclock</h2>
      <p class="istart">Job <b>${o.job}</b>.${o.line ? ' ' + o.line : ''}</p>
      <div class="row intro-row"><button class="primary" id="goBtn">Start shift 1</button><button class="ilink" id="howBtn" type="button">How it works</button></div>`);
    document.getElementById('goBtn').addEventListener('click', o.go);
    document.getElementById('howBtn').addEventListener('click', (e) => { e.stopPropagation(); showFrames(o); });
  }

  function start(o) {
    if (o.fresh && !store.get(SEEN_KEY)) showFrames(o);
    else showShort(o);
  }

  // ---------- small pictures: bend, loop, the item chain, a boss card ----------
  // two facing tiles across the hazard band, and the arc a bend throws (same strokes as bendArc)
  function bendPic(cls) {
    const a = A(), G = a.GU, VW = 62, VH = 66;
    const v2 = 1.5, cam = fit({ x: 0, y: 2, w: 36, h: 62 }, [[0, 0, 1.2 * G.H], [1, 0, 1.2 * G.H], [1, v2 + G.mD, 0], [0, v2 + G.mD, 0]]);
    return a.withCam(cam, () => {
      const f = a.f1, s = fitScale();
      const band = `<g transform="${a.gmat()}"><rect x=".16" y="${G.mD + .14}" width=".68" height="${f((v2 - G.mD - .28) * 100) / 100}" fill="url(#hz)" opacity=".9"/></g>`;
      const A0 = a.P(.5, G.mD * .55, .72 * G.H), B = a.P(.5, v2 + G.mD * .5, .1 * G.H);
      const d = Math.hypot(B.x - A0.x, B.y - A0.y), cx = (A0.x + B.x) / 2 + d * 1.05, cy = (A0.y + B.y) / 2 - d * .12, w = Math.max(3, s * .12);
      const path = `M${f(A0.x)} ${f(A0.y)}Q${f(cx)} ${f(cy)} ${f(B.x)} ${f(B.y)}`;
      return `<svg class="${cls || 'ipic'}" viewBox="0 0 ${VW} ${VH}" aria-hidden="true">${band}${bay(0, 0)}${machine('roller', 0, 0)}${bay(0, v2)}${sprite('ore', B.x, B.y, s * .5)}` +
        `<path d="${path}" fill="none" style="stroke:var(--yellow)" stroke-width="${f(w)}" stroke-linecap="round"/><path d="${path}" fill="none" style="stroke:var(--char)" stroke-dasharray="${f(w * .9)} ${f(w * .9)}" stroke-width="${f(w * .62)}"/>` +
        `<circle cx="${f(B.x)}" cy="${f(B.y)}" r="${f(w * 1.1)}" fill="none" style="stroke:var(--yellow)" stroke-width="${f(w * .5)}"/><circle cx="${f(A0.x)}" cy="${f(A0.y)}" r="${f(w * .7)}" style="fill:var(--char)"/></svg>`;
    });
  }
  // the Returns desk and a teal loop (the chute's dash) with a RAM stick going round
  function loopPic(cls) {
    const a = A();
    const desk = `<svg x="0" y="10" width="46" height="48" viewBox="0 0 100 104">${a.drawParts('recycler', a.flatView)}</svg>`;
    return `<svg class="${cls || 'ipic'}" viewBox="0 0 84 64" aria-hidden="true">${desk}` +
      `<path d="M58 14A16 16 0 1 1 42 30" fill="none" stroke="#3c8380" stroke-width="3" stroke-dasharray="5 3.5" stroke-linecap="round"/><path d="M36 26L42 33L48 26Z" fill="#3c8380"/>` +
      `${sprite('ram', 62, 46, 22)}</svg>`;
  }
  function chainPic() {
    const a = A(), steps = [['ore', 'sand'], ['ingot', 'silicon'], ['plate', 'wafer'], ['gear', 'chip'], ['ram', 'RAM stick']];
    const arrow = '<svg class="iarr" viewBox="0 0 12 10" aria-hidden="true"><path d="M1 5H9M6 2L9.5 5L6 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return `<span class="ichain" role="img" aria-label="Sand becomes silicon, then a wafer, then a chip, then a RAM stick">${steps.map(([t, w]) =>
      `<span class="istep">${a.ITEM[t]}<small>${w}</small></span>`).join(arrow)}</span>`;
  }
  const bossPic = () => { const a = A(); return `<span class="rule ihelp-boss"><span class="boss"><b>${a.bossNm('shortage')}</b><span class="bl">${a.bossRule('shortage')}</span></span></span>`; };

  // the rules behind "?". Same copy as HELP in game.js, with the items line told by the chain picture instead.
  function help() {
    return `<ul class="ihelp">
      <li>Each shift has <b>3 runs</b>. Before each run you draw 5 machine cards. Place any of them on the belt. Placed machines stay until the shift ends.</li>
      <li>Press <b>Run</b> and <b>5 scoops of sand</b> roll down the belt. Each machine only works on its own type, so the order of the line is the plan.</li>
      <li class="ihelp-pic">${chainPic()}</li>
      <li>Whatever reaches Shipping counts. Fill the <b>order</b> by the end of the 3rd run or the job is over.</li>
      <li>Tiles with hazard stripes between them are <b>bends</b>. They face each other across the fold.<span class="ihelp-fig">${bendPic('ipic')}</span></li>
      <li>Between shifts, add a machine to your deck or scrap one.</li>
      <li>Every third shift is a <b>boss shift</b> with one twist rule. Beat it for a rare.${bossPic()}</li>
    </ul>`;
  }

  // ---------- tips in play: once per browser, over the board's top lane ----------
  const TIP = {
    bend: { pic: () => bendPic('ipic'), line: '<b>The belt folds.</b> Machines on a bend work items twice.' },
    loop: { pic: () => loopPic('ipic'), line: '<b>Returns desk:</b> everything that reaches Shipping goes round once more. Items coming back show <span class="nw">LAP 2</span>.' },
  };
  let tipTimer = 0, asked = {};
  const readTips = () => { try { return JSON.parse(store.get(TIPS_KEY)) || {}; } catch (e) { return {}; } };
  function tip(kind, force) {
    if (!TIP[kind]) return;
    const seen = readTips();
    if (!force && (seen[kind] || asked[kind])) return;
    asked[kind] = 1; seen[kind] = 1; store.set(TIPS_KEY, JSON.stringify(seen));
    setTimeout(() => showTip(kind), force ? 0 : 900);   // let the bend sign or the reward sheet land first
  }
  // over the board's top lane; when a sheet is open (a reward offer), pinned to the top of the screen above the veil
  function showTip(kind) {
    const board = document.getElementById('board'), veil = document.getElementById('veil');
    if (!board) return;
    const over = veil && veil.classList.contains('on'), host = over ? document.body : board;
    document.querySelectorAll('.introtip').forEach((el) => el.remove());
    const note = document.getElementById('tip'); if (note) note.classList.remove('on');   // the order note, if it is still up
    clearTimeout(tipTimer);
    const el = document.createElement('div');
    el.className = 'introtip t-' + kind + (over ? ' over' : '');
    el.setAttribute('role', 'status');
    el.innerHTML = `${TIP[kind].pic()}<span class="itxt">${TIP[kind].line}</span>`;
    const close = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 250); };
    el.addEventListener('click', (e) => { e.stopPropagation(); clearTimeout(tipTimer); close(); });
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    tipTimer = setTimeout(close, 4000);
  }

  // tip(kind, force): 'bend' or 'loop'. Shows once per browser (conveyor.tips) unless force is true.
  // bendArt(): the mini bend picture as an SVG string, for reuse (the fold moment).
  window.ConveyorIntro = { start, showFrames, help, tip, bendArt: () => bendPic('ipic') };
})();
