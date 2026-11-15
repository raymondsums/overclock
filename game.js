// Conveyor UI. Rules live in engine.js.
(function () {
  const E = window.Engine;
  const C = E.CARDS;
  const $ = (id) => document.getElementById(id);
  const sfx = (ev, d) => { if (window.SFX) window.SFX(ev, d); };   // sound.js; silent if it is missing
  const board = $('board'), cam = $('cam'), layer = $('layer'), handEl = $('hand'), lever = $('lever');

  // ---------- look: painted shop floor ----------
  // Iso floor. Ground units: u runs along the belt, v across it, z up. One tile is 1 unit wide.
  const PH = 20 * Math.PI / 180, AL = 40 * Math.PI / 180;
  const AX = { ux: Math.cos(PH), uy: Math.sin(PH) * Math.sin(AL), vx: -Math.sin(PH), vy: Math.cos(PH) * Math.sin(AL), zy: -Math.cos(AL) };
  // machine bay is mW x mD, height unit H. Row 1: machines then belt. Row 2 (front): machines then belt.
  // closer camera: machines 1.21x bigger on the same column pitch, rows packed tighter, ends pulled in
  const GU = { mW: 1.04, mD: .874, H: .967, zMax: 1.2, m1: 0, b1: .94, bw: .5, m2: 2.99, b2: 3.92, foldU: 6, foldR: .45, hopU: .56, binU: .2, e0: .45, beltZ: 0 };
  GU.b1c = GU.b1 + GU.bw / 2; GU.b2c = GU.b2 + GU.bw / 2;
  // belt length: NT tiles, HALF on each row. The layout sets it per job; extensions add a column at the fold.
  let NT = 10, HALF = 5, STR = false;   // STR: the first job's straight belt, both rows run left to right
  const colOf = (k) => k < HALF ? k : STR ? k - HALF : NT - 1 - k;
  const uOf = (k) => 1 + colOf(k);           // left edge of the tile column
  const mvOf = (k) => k < HALF ? GU.m1 : GU.m2; // back edge of the machine bay
  let Lg = { s: 40, ox: 0, oy: 0 };
  function P(u, v, z) { return { x: Lg.ox + (u * AX.ux + v * AX.vx) * Lg.s, y: Lg.oy + (u * AX.uy + v * AX.vy + (z || 0) * AX.zy) * Lg.s }; }
  const gmat = () => `matrix(${AX.ux * Lg.s} ${AX.uy * Lg.s} ${AX.vx * Lg.s} ${AX.vy * Lg.s} ${Lg.ox} ${Lg.oy})`;
  const f1 = (n) => Math.round(n * 10) / 10;
  const pts = (a) => a.map((p) => f1(p.x) + ',' + f1(p.y)).join(' ');

  // colours
  const PAL = { change: '#a65b47', add: '#7a8f78', mult: '#4d6f94', special: '#3c8380' };
  const STEEL = '#a9afb2', DSTEEL = '#677074', CHAR = '#34373b', GLASS = '#bccfd2', FIRE = '#b5503c', GLOW = '#dcc068', PALE = '#ebe8de', ORE = '#80695a', ORE2 = '#96806c';
  function shade(hex, a) {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
    const t = a > 0 ? 255 : 0, k = Math.abs(a);
    return '#' + c.map((x) => Math.round(x + (t - x) * k).toString(16).padStart(2, '0')).join('');
  }

  // decal helpers. Decals are drawn on a front face in local (x, z) units, z up.
  const NS = 'vector-effect="non-scaling-stroke"';
  const dc = (x, z, r, f, ex = '') => `<circle cx="${x}" cy="${z}" r="${r}" fill="${f}" ${ex}/>`;
  const dr = (x0, z0, x1, z1, f, ex = '') => `<rect x="${x0}" y="${z0}" width="${f1((x1 - x0) * 1000) / 1000}" height="${f1((z1 - z0) * 1000) / 1000}" fill="${f}" ${ex}/>`;
  const dp = (d, f, ex = '') => `<path d="${d}" fill="${f}" ${ex}/>`;
  const st = (c, w) => `stroke="${c}" stroke-width="${w}" ${NS} stroke-linecap="round" stroke-linejoin="round"`;
  function gearD(cx, cz, r, n) {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a0 = (i / (n * 2)) * Math.PI * 2, a1 = ((i + 1) / (n * 2)) * Math.PI * 2, R = i % 2 ? r * .74 : r;
      d += (i ? 'L' : 'M') + f1((cx + Math.cos(a0) * R) * 1000) / 1000 + ' ' + f1((cz + Math.sin(a0) * R) * 1000) / 1000 + 'L' + f1((cx + Math.cos(a1) * R) * 1000) / 1000 + ' ' + f1((cz + Math.sin(a1) * R) * 1000) / 1000;
    }
    return d + 'Z';
  }
  function starD(cx, cz, r) {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, R = i % 2 ? r * .45 : r; d += (i ? 'L' : 'M') + f1((cx + Math.cos(a) * R) * 1000) / 1000 + ' ' + f1((cz + Math.sin(a) * R) * 1000) / 1000; }
    return d + 'Z';
  }
  const flame = (x, z, w, h) => dp(`M${x} ${z}Q${x - w * .1} ${z + h * .5} ${x + w * .2} ${z + h * .8}Q${x + w * .22} ${z + h * .45} ${x + w * .42} ${z + h * .4}Q${x + w * .55} ${z + h * .75} ${x + w * .62} ${z + h}Q${x + w * 1.05} ${z + h * .55} ${x + w} ${z}Z`, FIRE) +
    dp(`M${x + w * .25} ${z}Q${x + w * .25} ${z + h * .35} ${x + w * .45} ${z + h * .55}Q${x + w * .55} ${z + h * .3} ${x + w * .75} ${z + h * .45}Q${x + w * .82} ${z + h * .2} ${x + w * .78} ${z}Z`, GLOW);

  // parts: ['box',x0,x1,y0,y1,z0,z1,col,opt] ['cyl',cx,cy,r,z0,z1,col,top] ['hop',cx,cy,rt,rb,z0,z1,col] ['dec',y,svg]
  // ---------- the RAM theme: art per machine (ids as in engine.js) ----------
  const SAND = '#d3c08f', SAND2 = '#b9a576', BOARD = '#557f5a', GOLD = '#c4a24f', WAFER = '#cfd4dc', PLASMA = '#b9a3c9', LED = '#9fcf8e', PIPE = '#6f97b8', WHITE = '#e6e4dc';
  const lines = (arr, c, w, ex = '') => dp(arr.map(([a, b, x, y]) => `M${a} ${b}L${x} ${y}`).join(''), 'none', st(c, w) + ex);
  const housing = (K, z = .58) => ['box', .06, .94, .2, 1, 0, z, K, { panel: 1 }];
  const vents = (K, x0, x1, zs) => zs.map((z) => dr(x0, z, x1, z + .04, shade(K, -.25))).join('');
  const ART = {
    // Sifter: a sieve drum over a hopper
    crusher: (K) => [housing(K, .36), ['dec', 1, dr(.38, .04, .62, .14, CHAR) + vents(K, .14, .3, [.16, .24]) + vents(K, .7, .86, [.16, .24])], ['hop', .5, .55, .36, .16, .36, .74, STEEL],
      ['box', .12, .88, .4, .78, .76, 1.08, shade(K, .16)], ['dec', .78, dr(.18, .82, .82, 1.02, CHAR) + lines([[.26, .82, .26, 1.02], [.34, .82, .34, 1.02], [.42, .82, .42, 1.02], [.5, .82, .5, 1.02], [.58, .82, .58, 1.02], [.66, .82, .66, 1.02], [.74, .82, .74, 1.02], [.18, .88, .82, .88], [.18, .95, .82, .95]], '#8d9599', .8)]],
    // Sand washer: a spray drum with nozzles
    washer: (K) => [housing(K, .52), ['dec', 1, dc(.3, .26, .14, DSTEEL) + dc(.3, .26, .1, '#9dbcc5') + dp('M.2 .26Q.3 .32 .4 .26L.38 .19Q.3 .13 .22 .19Z', '#5f8998') + vents(K, .55, .84, [.16, .26, .36])],
      ['cyl', .5, .58, .27, .52, .9, GLASS, '#d8e4e6'], ['box', .48, .52, .55, .61, .9, 1.04, DSTEEL], ['box', .14, .86, .55, .61, 1.02, 1.09, DSTEEL],
      ['dec', .61, dr(.2, .97, .25, 1.02, CHAR) + dr(.475, .97, .525, 1.02, CHAR) + dr(.75, .97, .8, 1.02, CHAR) + dc(.225, .93, .014, '#7fb0c2') + dc(.5, .93, .014, '#7fb0c2') + dc(.775, .93, .014, '#7fb0c2') + dc(.225, .895, .011, '#7fb0c2') + dc(.775, .895, .011, '#7fb0c2')]],
    // Furnace: a brick furnace with a glow door
    smelter: (K) => [['box', .06, .94, .2, 1, 0, .66, K, { panel: 1 }],
      ['dec', 1, lines([[.1, .16, .9, .16], [.1, .3, .9, .3], [.1, .44, .9, .44], [.6, .02, .6, .16], [.8, .02, .8, .16], [.7, .16, .7, .3], [.62, .3, .62, .44], [.82, .3, .82, .44], [.72, .44, .72, .58], [.3, .44, .3, .58], [.5, .44, .5, .58]], shade(K, -.2), 1) +
        dp('M.16 .04L.16 .28Q.16 .42 .34 .42Q.52 .42 .52 .28L.52 .04Z', CHAR) + flame(.21, .05, .26, .3)], ['cyl', .78, .45, .09, .66, 1.2, DSTEEL, '#555c60']],
    // Arc furnace: three electrodes on top
    furnace: (K) => [['box', .04, .96, .15, 1, 0, .6, K, { panel: 1 }], ['dec', 1, dr(.18, .12, .82, .3, CHAR) + dr(.22, .15, .78, .27, GLOW, 'opacity=".9"') + lines([[.24, .21, .76, .21]], FIRE, 2) + vents(K, .3, .7, [.4])],
      ['cyl', .5, .55, .4, .6, .7, shade(K, .14), shade(K, .3)], ['cyl', .3, .5, .05, .7, 1.16, DSTEEL, '#555c60'], ['cyl', .5, .5, .05, .7, 1.22, DSTEEL, '#555c60'], ['cyl', .7, .5, .05, .7, 1.12, DSTEEL, '#555c60']],
    // Crystal puller: a tall puller with a boule hanging below
    caster: (K) => [['box', .04, .96, .25, 1, 0, .3, K, { panel: 1 }], ['dec', 1, dr(.38, .09, .62, .2, CHAR) + dr(.41, .12, .59, .17, GLOW)],
      ['box', .08, .18, .4, .6, .3, 1.12, DSTEEL], ['box', .82, .92, .4, .6, .3, 1.12, DSTEEL], ['cyl', .5, .55, .21, .3, .4, CHAR, GLOW],
      ['hop', .5, .55, .12, .04, .44, .52, '#9aa2a6'], ['cyl', .5, .55, .12, .52, .84, '#9aa2a6', '#c3cacd'], ['box', .48, .52, .52, .58, .84, 1.08, STEEL], ['box', .06, .94, .4, .62, 1.06, 1.18, K]],
    // Slicer: a wire saw frame
    press: (K) => [['box', .04, .96, .25, 1, 0, .34, K, { panel: 1 }], ['dec', 1, lines([[.3, .17, .7, .17]], shade(K, .5), 2)], ['box', .28, .72, .4, .75, .34, .58, '#9aa2a6'],
      ['box', .06, .16, .45, .6, .34, 1.15, DSTEEL], ['box', .84, .94, .45, .6, .34, 1.15, DSTEEL], ['box', .06, .94, .45, .6, 1.06, 1.16, K],
      ['dec', .6, dc(.24, .76, .1, CHAR) + dc(.76, .76, .1, CHAR) + dc(.24, .76, .035, STEEL) + dc(.76, .76, .035, STEEL) + lines([[.24, .66, .76, .66], [.24, .86, .76, .86]], PALE, 1.2) + lines([[.24, .63, .76, .63], [.24, .6, .76, .6]], PALE, .8)]],
    // Annealer: a long low oven
    annealer: (K) => [['box', .03, .97, .2, 1, 0, .5, K, { panel: 1 }], ['dec', 1, dr(.11, .1, .52, .36, CHAR) + dr(.14, .13, .49, .33, GLOW, 'opacity=".9"') + dp('M.62 .1Q.67 .18 .62 .25Q.57 .32 .62 .4M.72 .1Q.77 .18 .72 .25Q.67 .32 .72 .4M.82 .1Q.87 .18 .82 .25Q.77 .32 .82 .4', 'none', st(shade(K, .55), 1.8))], ['cyl', .3, .55, .06, .5, .62, DSTEEL, '#555c60'], ['cyl', .5, .55, .06, .5, .62, DSTEEL, '#555c60'], ['cyl', .7, .55, .06, .5, .62, DSTEEL, '#555c60']],
    // Spin coater: a spinning disc under a nozzle
    coater: (K) => [housing(K, .5), ['dec', 1, dp('M.28 .3A.22 .1 0 1 0 .66 .36', 'none', st(shade(K, .5), 2)) + dp('M.62 .42L.7 .35L.6 .31Z', shade(K, .5)) + vents(K, .16, .3, [.1])],
      ['cyl', .44, .55, .32, .5, .6, shade(K, .25), CHAR], ['cyl', .44, .55, .27, .6, .63, WAFER, '#e4e8ee'],
      ['box', .8, .88, .5, .6, .5, 1.02, DSTEEL], ['box', .4, .88, .5, .6, .96, 1.03, DSTEEL], ['box', .41, .48, .5, .6, .84, .96, CHAR], ['dec', .6, dc(.445, .78, .018, '#8b7fa8') + dc(.445, .72, .014, '#8b7fa8')]],
    // Litho: a projector head over a stage
    stamper: (K) => [['box', .04, .96, .25, 1, 0, .35, K, { panel: 1 }], ['dec', 1, dr(.3, .1, .7, .24, CHAR) + lines([[.36, .17, .64, .17]], GLOW, 1.4)],
      ['box', .2, .8, .35, .85, .35, .42, shade(K, .25)], ['cyl', .5, .6, .22, .42, .45, WAFER, '#e4e8ee'], ['box', .8, .92, .2, .4, .35, 1.1, DSTEEL],
      ['dec', .6, dp('M.43 .74L.57 .74L.7 .46L.3 .46Z', '#f0e3a8', 'opacity=".5"')], ['cyl', .5, .6, .08, .72, .86, GLASS, '#e6eef0'], ['box', .24, .9, .38, .78, .86, 1.14, K, { panel: 1 }]],
    // Etcher: a chamber with a window and a plasma glow
    cutter: (K) => [['box', .06, .94, .2, 1, 0, .82, K, { panel: 1 }], ['cyl', .24, .5, .06, .82, 1.02, DSTEEL, '#555c60'], ['cyl', .76, .5, .06, .82, .96, DSTEEL, '#555c60'],
      ['dec', 1, dc(.5, .42, .28, CHAR) + dc(.5, .42, .23, '#3d3550') + dc(.5, .42, .18, PLASMA, 'opacity=".9"') + dc(.5, .42, .1, '#ece3f2') +
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => dc(f1((.5 + Math.cos(i * Math.PI / 4) * .255) * 1000) / 1000, f1((.42 + Math.sin(i * Math.PI / 4) * .255) * 1000) / 1000, .013, STEEL)).join('')]],
    // Burn-in rack: a rack of slots with small lights
    tempering: (K) => [['box', .12, .88, .2, 1, 0, 1.06, K, { panel: 1 }], ['dec', 1, [.14, .36, .58, .8].map((z, i) => dr(.2, z, .64, z + .13, CHAR) + dr(.24, z + .04, .6, z + .09, '#45494d') + dc(.75, z + .065, .035, i === 2 ? GLOW : LED)).join('')]],
    // Board assembler: a pick and place head over a green board
    assembler: (K) => [housing(K, .42), ['dec', 1, dr(.56, .1, .84, .3, CHAR) + lines([[.6, .2, .66, .26], [.66, .26, .8, .14]], LED, 1.6) + lines([[.18, .21, .42, .21]], shade(K, .5), 2)],
      ['box', .06, .14, .25, .35, .42, 1.05, DSTEEL], ['box', .86, .94, .25, .35, .42, 1.05, DSTEEL], ['box', .06, .94, .25, .35, .98, 1.06, DSTEEL],
      ['box', .12, .88, .4, .9, .42, .48, BOARD], ['box', .18, .32, .5, .7, .48, .55, CHAR], ['box', .4, .54, .5, .7, .48, .55, CHAR], ['box', .62, .76, .5, .7, .48, .55, CHAR],
      ['dec', .9, dr(.14, .42, .86, .45, GOLD)], ['box', .54, .7, .26, .5, .72, 1.0, shade(K, .15)], ['box', .6, .64, .34, .42, .58, .72, CHAR]],
    // Stacker: chips stacked in a tower
    gearbox: (K) => [['box', .08, .92, .2, 1, 0, .28, K, { panel: 1 }], ['dec', 1, lines([[.5, .06, .5, .22]], PALE, 2.4) + dp('M.44 .18L.5 .24L.56 .18Z', PALE)],
      ...[0, 1, 2, 3, 4].flatMap((i) => { const z0 = .3 + i * .17, j = i % 2 ? .04 : -.02; return [['box', .26 + j, .74 + j, .4, .8, z0, z0 + .12, i % 2 ? '#43474b' : CHAR],
        ['dec', .8, [.32, .4, .48, .56, .64].map((x) => dr(f1((x + j) * 1000) / 1000, f1((z0 + .035) * 1000) / 1000, f1((x + j + .03) * 1000) / 1000, f1((z0 + .085) * 1000) / 1000, GOLD)).join('')]]; })],
    // Wiper: a soft roller brush
    roller: (K) => [['box', .04, .96, .2, 1, 0, .36, K, { panel: 1 }], ['dec', 1, lines([[.3, .18, .7, .18]], shade(K, .5), 2)], ['box', .08, .14, .4, .7, .36, .8, DSTEEL], ['box', .86, .92, .4, .7, .36, .8, DSTEEL],
      ['box', .14, .86, .42, .72, .44, .76, '#d9d0bd'], ['dec', .72, lines([.2, .27, .34, .41, .48, .55, .62, .69, .76, .82].map((x) => [x, .47, x, .73]), '#b8ad96', 1) + dc(.11, .6, .03, CHAR) + dc(.89, .6, .03, CHAR)]],
    // Tester: a probe card with pins and a green light
    polisher: (K) => [housing(K, .5), ['dec', 1, dr(.14, .14, .5, .4, CHAR) + lines([[.22, .27, .29, .2], [.29, .2, .43, .34]], LED, 2) + vents(K, .62, .84, [.2, .3])],
      ['box', .28, .7, .4, .75, .5, .54, WAFER], ['box', .74, .86, .3, .5, .5, 1.12, DSTEEL], ['box', .24, .9, .32, .72, 1.0, 1.12, K],
      ['box', .26, .72, .36, .76, .88, .94, BOARD], ['dec', .76, lines([.31, .37, .43, .49, .55, .61, .67].map((x) => [x, .88, x, .79]), GOLD, 1)], ['cyl', .8, .45, .05, 1.12, 1.19, LED, '#cfe8c4']],
    // Coolant pump: a pump with a blue pipe
    oiler: (K) => [housing(K, .5), ['dec', 1, dc(.3, .27, .13, PALE, st(shade(K, -.3), 1.2)) + lines([[.3, .27, .38, .35]], CHAR, 1.8) + dc(.3, .27, .02, CHAR) + vents(K, .56, .84, [.14, .24, .34])],
      ['cyl', .36, .55, .16, .5, .84, DSTEEL, '#8d9599'], ['box', .72, .84, .5, .62, .5, 1.02, PIPE], ['box', .22, .84, .5, .62, .92, 1.02, PIPE], ['box', .14, .24, .48, .64, .88, 1.06, shade(PIPE, -.15)]],
    // QA log: a clipboard terminal with ticks
    tally: (K) => [housing(K, .5), ['dec', 1, dr(.16, .06, .5, .44, PALE) + dr(.27, .41, .39, .47, CHAR) + lines([[.21, .31, .24, .28], [.24, .28, .29, .35], [.21, .18, .24, .15], [.24, .15, .29, .22]], '#5b8758', 1.6) + lines([[.33, .31, .45, .31], [.33, .18, .45, .18]], DSTEEL, 1.2) + vents(K, .62, .84, [.14, .24])],
      ['box', .6, .66, .5, .6, .5, .66, DSTEEL], ['box', .38, .9, .45, .65, .66, .98, CHAR], ['dec', .65, dr(.42, .7, .86, .94, '#2f3f36') + lines([[.48, .82, .52, .78], [.52, .78, .58, .88]], '#a8d49a', 1.6) + lines([[.64, .82, .8, .82]], '#a8d49a', 1.2)]],
    // Inspector: a magnifier on a stand
    inspector: (K) => [housing(K), ['box', .74, .8, .4, .48, .58, 1.0, DSTEEL], ['cyl', .77, .44, .08, 1.0, 1.1, '#e5dfc4', '#f4eed2'], ['dec', 1, dc(.42, .31, .15, GLASS, st(CHAR, 3)) + dp('M.53 .2L.66 .08', 'none', st(CHAR, 4)) + dp('M.35 .37Q.38 .41 .43 .41', 'none', st(PALE, 1.5))]],
    // Copier: two stacked boxes and an arrow
    duplicator: (K) => [['box', .04, .96, .2, 1, 0, .26, shade(K, -.12), { panel: 1 }], ['box', .1, .58, .3, .85, .26, .64, K, { panel: 1 }], ['box', .42, .9, .3, .85, .64, 1.02, K, { panel: 1 }],
      ['dec', .85, dr(.2, .36, .48, .54, shade(K, .5)) + dr(.52, .74, .8, .92, shade(K, .5))], ['dec', 1, dp('M.16 .1L.76 .1L.76 .05L.85 .13L.76 .21L.76 .16L.16 .16Z', CHAR) + dp('M.66 .5Q.8 .5 .82 .6', 'none', st(CHAR, 2.6)) + dp('M.76 .58L.83 .66L.88 .56Z', CHAR)]],
    // Returns desk: a counter with a return arrow
    recycler: (K) => [['box', .04, .96, .3, 1, 0, .52, K, { panel: 1 }], ['box', .02, .98, .28, 1, .52, .58, PALE], ['dec', 1, dp('M.64 .16L.4 .16A.1 .1 0 0 0 .4 .36L.58 .36', 'none', st(PALE, 3)) + dp('M.56 .28L.67 .36L.56 .44Z', PALE)],
      ['box', .56, .9, .4, .7, .58, .78, '#c3a77a'], ['dec', .7, lines([[.6, .68, .86, .68]], '#a68b5f', 1.4)], ['cyl', .24, .6, .07, .58, .62, DSTEEL, STEEL], ['cyl', .24, .6, .04, .62, .68, STEEL, '#c8cdcf']],
    // Turbo: a dial in the red, with a small double chevron for boost
    overclock: (K) => [housing(K), ['dec', 1, dc(.5, .28, .21, PALE, st(shade(K, -.3), 1.5)) + dp('M.56 .464A.19 .19 0 0 0 .69 .28', 'none', st(FIRE, 5)) + dp('M.5 .28L.65 .39', 'none', st(CHAR, 2.4)) + dc(.5, .28, .035, CHAR) + dp('M.72 .17L.77 .13L.72 .09M.77 .17L.82 .13L.77 .09', 'none', st('#cfae45', 1.8))], ['box', .66, .82, .45, .65, .58, .7, DSTEEL]],
    // Sand truck: a small tipper truck
    hopper: (K) => [['box', .04, .96, .3, .9, .1, .2, DSTEEL], ['box', .06, .62, .25, .95, .2, .55, K, { panel: 1 }], ['hop', .34, .6, .14, .26, .55, .7, SAND],
      ['box', .66, .94, .3, .95, .2, .72, shade(K, .12), { panel: 1 }], ['dec', .95, dr(.72, .46, .88, .64, GLASS)],
      ['dec', 1, dc(.22, .1, .1, CHAR) + dc(.22, .1, .04, STEEL) + dc(.78, .1, .1, CHAR) + dc(.78, .1, .04, STEEL)]],
    // Wide fold: the belt folded twice
    widefold: (K) => [['box', .04, .96, .2, 1, 0, .5, K, { panel: 1 }], ['dec', 1, dp('M.16 .1L.76 .1A.08 .08 0 0 0 .76 .26L.24 .26A.08 .08 0 0 1 .24 .42L.84 .42', 'none', st(CHAR, 5)) + dp('M.16 .1L.76 .1A.08 .08 0 0 0 .76 .26L.24 .26A.08 .08 0 0 1 .24 .42L.84 .42', 'none', st('#d3b24a', 1.3) + ' stroke-dasharray="2 2"')], ['box', .08, .92, .42, .72, .5, .58, STEEL]],
    // Night crew: a lamp and a thermos
    nightcrew: (K) => [['box', .08, .92, .25, 1, 0, .42, K, { panel: 1 }], ['dec', 1, dp('M.54 .32A.11 .11 0 1 1 .54 .1A.08 .08 0 1 0 .54 .32Z', PALE) + lines([[.18, .16, .36, .16], [.18, .24, .36, .24], [.7, .16, .84, .16], [.7, .24, .84, .24]], shade(K, -.3), 1.4)],
      ['cyl', .68, .6, .11, .42, .46, DSTEEL, STEEL], ['dec', .6, dp('M.53 .87L.83 .87L.92 .47L.44 .47Z', GLOW, 'opacity=".35"')], ['box', .66, .7, .56, .64, .46, .9, DSTEEL], ['hop', .64, .6, .07, .17, .86, 1.06, '#e5dfc4'],
      ['cyl', .28, .55, .08, .42, .8, shade(K, .32), CHAR], ['cyl', .28, .55, .085, .8, .87, CHAR, '#45494d']],
    // Long contract: a rolled contract with a seal
    boltgun: (K) => [housing(K, .42), ['dec', 1, vents(K, .16, .4, [.14, .24]) + dr(.6, .12, .84, .3, shade(K, -.15))],
      ['box', .12, .88, .42, .72, .42, .62, PALE], ['dec', .72, dc(.12, .52, .1, '#d9d3c2') + dc(.12, .52, .05, '#bdb6a3') + dc(.88, .52, .1, '#d9d3c2') + dc(.88, .52, .05, '#bdb6a3') + lines([[.26, .56, .58, .56], [.26, .49, .5, .49]], '#a39d8e', 1) +
        dp('M.66 .48L.62 .36L.67 .39L.7 .35Z', FIRE) + dp('M.74 .48L.78 .36L.73 .39L.7 .35Z', shade(FIRE, -.15)) + dc(.7, .5, .065, FIRE) + dc(.7, .5, .035, shade(FIRE, .25))]],
    // Clean room: a white room with a door and an air shower
    richseam: (K) => [['box', .04, .96, .2, 1, 0, .9, WHITE, { panel: 1 }], ['box', .04, .96, .2, 1, 0, .1, K], ['box', .58, .86, .4, .7, .9, 1.02, shade(WHITE, -.1)],
      ['dec', 1, dr(.12, .1, .46, .74, K) + dr(.16, .1, .42, .7, GLASS) + dc(.38, .4, .018, CHAR) + dr(.56, .5, .88, .78, shade(WHITE, -.12)) + lines([[.59, .55, .85, .55], [.59, .61, .85, .61], [.59, .67, .85, .67], [.59, .73, .85, .73]], DSTEEL, 1) +
        lines([[.64, .44, .64, .2], [.72, .44, .72, .16], [.8, .44, .8, .2]], '#8fb2bb', 1.4, ' stroke-dasharray="1.5 2.5"')], ['dec', .7, dc(.72, .96, .03, K)]],
    _: (K) => [housing(K)],
  };
  // ---------- the RAM theme: names, tags and rule text (RENAME.md). Engine ids, numbers and rules are unchanged ----------
  const NAME = {
    crusher: ['Sifter', 'sand +2', 'Sand +2'],
    washer: ['Sand washer', 'sand x2', 'Sand x2'],
    smelter: ['Furnace', 'sand to silicon +3', 'Sand into silicon, +3'],
    furnace: ['Arc furnace', 'sand to silicon +8', 'Sand into silicon, +8'],
    caster: ['Crystal puller', 'silicon +4', 'Silicon +4'],
    press: ['Slicer', 'silicon to wafer x2', 'Silicon into wafer, x2'],
    annealer: ['Annealer', 'silicon x3', 'Silicon x3'],
    coater: ['Spin coater', 'wafer x2', 'Wafer x2'],
    stamper: ['Litho', 'wafer +10', 'Wafer +10'],
    cutter: ['Etcher', 'wafer to chip x3', 'Wafer into chip, x3'],
    tempering: ['Burn-in rack', 'chip x2', 'Chip x2'],
    assembler: ['Board assembler', 'chips to RAM +25', 'Chip +25, and it ships as a RAM stick'],
    gearbox: ['Stacker', 'chip x2 per Etcher', 'Chip x2 for each Etcher on the belt'],
    roller: ['Wiper', 'any +1', 'Anything +1'],
    polisher: ['Tester', 'x2, not sand', 'Silicon, wafer or chip x2'],
    oiler: ['Coolant pump', 'any +1 per machine', 'Anything +1 for each machine on the belt'],
    tally: ['QA log', '+3 per step done', 'Anything +3 for each machine that already worked it'],
    inspector: ['Inspector', 'x2 on a bend', 'Anything x2, only when it sits on a bend'],
    duplicator: ['Copier', 'one becomes two', 'One item becomes two. Eats a deck card each shift'],
    recycler: ['Returns desk', 'shipping loops once', 'Everything that reaches Shipping goes round once more'],
    overclock: ['Turbo', 'x3 at 20+', 'x3 to anything worth 20 or more'],   // the game is Overclock now; the id stays
    hopper: ['Sand truck', '+3 sand a run', '3 more sand each run'],
    widefold: ['Wide fold', 'every tile bends', 'Every tile is a bend'],
    nightcrew: ['Night crew', 'draw 7', 'Draw 7 cards each run while this is on the belt'],
    boltgun: ['Long contract', 'keep 2 machines', 'At shift end, bolt down up to 2 machines to keep for the next shift. A second copy makes it 3'],
    richseam: ['Clean room', 'sand starts at 5', 'Sand comes in worth 5, not 1'],
  };
  const nm = (id) => (NAME[id] || [C[id].name])[0];
  const TAG = Object.fromEntries(Object.keys(NAME).map((id) => [id, NAME[id][1]]));
  const rl = (id) => (NAME[id] || [0, 0, rl(id)])[2];
  const BOSS = {
    powercut: ['Rolling blackout', 'The grid is busy training something. Only 2 runs this shift.'],
    straight: ['Fab audit', 'An auditor wants a straight line. Bends do nothing this shift.'],
    shorthand: ['GPU shortage', 'Everyone bought the machines first. Draw 4 cards each run.'],
    jam: ['Data center outage', 'Two tiles are down. Someone tripped on a cable.'],
    inspection: ['Investor call', 'Only sticks worth {min} or more count. They want a nice chart.'],
    shortage: ['Sand shortage', 'Somehow. Only 3 sand per run.'],
    newmodel: ['New model launch', 'A lab announced something. Demand jumps: this order is 30% bigger.'],   // the engine adds this rule later
  };
  // the boss card shows the rule; the dry line shows briefly at shift start or on tap
  const BOSS_SPLIT = {
    powercut: ['Only 2 runs this shift.', 'The grid is busy training something.'],
    straight: ['Bends do nothing this shift.', 'An auditor wants a straight line.'],
    shorthand: ['Draw 4 cards each run.', 'Everyone bought the machines first.'],
    jam: ['Two tiles are down.', 'Someone tripped on a cable.'],
    inspection: ['Only sticks worth {min} or more count.', 'They want a nice chart.'],
    shortage: ['Only 3 sand per run.', 'Somehow.'],
    newmodel: ['Demand jumps: this order is 30% bigger.', 'A lab announced something.'],
  };
  const bossRule = (id, R) => (BOSS_SPLIT[id] ? BOSS_SPLIT[id][0] : bossLn(id, R)).replace('{min}', R ? R.minWorth : '');
  const bossDry = (id) => BOSS_SPLIT[id] ? BOSS_SPLIT[id][1] : '';
  const bossNm = (id) => BOSS[id] ? BOSS[id][0] : (E.BOSSES[id] || { name: id }).name;
  const bossLn = (id, R) => (BOSS[id] ? BOSS[id][1] : (R && R.bossText) || '').replace('{min}', R ? R.minWorth : '');
  const LABS = ['OpenAI', 'Anthropic', 'Google DeepMind', 'Meta', 'xAI', 'Mistral', 'Cohere', 'Microsoft', 'Amazon', 'Apple'];
  const NOTES = ["It's for a demo.", "They said it's urgent. Everyone says it's urgent.", 'Paid in compute credits.', 'The last order was also urgent.', 'They need it before the announcement.', 'Training run starts at 9.', 'Same as last week, plus a bit more.', 'The whole industry ordered at once.'];
  const ENDS = ['The lab found a cheaper fab.', 'The model shipped without you.', "They switched to a different vendor. It's also you, next job.", 'Demand went down for about an hour.', 'Your RAM is in a data center now. You are not.'];
  // one slip per shift. Lab and note run on separate tracks (labs step 1, notes step 3 of 8), so no company owns a joke
  // and a note never repeats on back-to-back slips
  const slipLab = (run, shift) => LABS[(run * 7 + shift) % LABS.length];
  const slipNote = (run, shift) => NOTES[(run * 5 + shift * 3) % NOTES.length];

  // one renderer per view. Iso maps local (x,y,z) to the floor; flat is the front elevation for cards.
  function isoView(u0, v0) {
    const Q = (x, y, z) => P(u0 + x * GU.mW, v0 + y * GU.mD, z * GU.H);
    return {
      poly: (a, f) => `<polygon points="${pts(a)}" fill="${f}" stroke="${shade(f, -.28)}" stroke-width=".6" stroke-linejoin="round"/>`,
      box(x0, x1, y0, y1, z0, z1, col) {
        return this.poly([Q(x1, y0, z0), Q(x1, y1, z0), Q(x1, y1, z1), Q(x1, y0, z1)], shade(col, -.22)) +
          this.poly([Q(x0, y1, z0), Q(x1, y1, z0), Q(x1, y1, z1), Q(x0, y1, z1)], col) +
          this.poly([Q(x0, y0, z1), Q(x1, y0, z1), Q(x1, y1, z1), Q(x0, y1, z1)], shade(col, .2));
      },
      cyl(cx, cy, r, z0, z1, col, top) {
        const b = Q(cx, cy, z0), t = Q(cx, cy, z1), rx = r * GU.mW * Lg.s, ry = rx * Math.sin(AL), k = .45, yk = ry * Math.sqrt(1 - k * k);
        return `<path d="M${f1(b.x - rx)} ${f1(t.y)}L${f1(b.x - rx)} ${f1(b.y)}A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(b.x + rx)} ${f1(b.y)}L${f1(b.x + rx)} ${f1(t.y)}Z" fill="${col}"/>` +
          `<path d="M${f1(b.x + rx * k)} ${f1(t.y + yk)}L${f1(b.x + rx * k)} ${f1(b.y + yk)}A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(b.x + rx)} ${f1(b.y)}L${f1(b.x + rx)} ${f1(t.y)}Z" fill="${shade(col, -.2)}"/>` +
          `<ellipse cx="${f1(t.x)}" cy="${f1(t.y)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${top || shade(col, .22)}" stroke="${shade(col, -.25)}" stroke-width=".6"/>`;
      },
      hop(cx, cy, rt, rb, z0, z1, col) {
        const dy = GU.mW / GU.mD, T = (sx, sy, r, z) => Q(cx + sx * r, cy + sy * r * dy, z);
        return this.poly([T(-1, 1, rb, z0), T(1, 1, rb, z0), T(1, 1, rt, z1), T(-1, 1, rt, z1)], col) +
          this.poly([T(1, -1, rb, z0), T(1, 1, rb, z0), T(1, 1, rt, z1), T(1, -1, rt, z1)], shade(col, -.22)) +
          this.poly([T(-1, -1, rt, z1), T(1, -1, rt, z1), T(1, 1, rt, z1), T(-1, 1, rt, z1)], shade(col, .2)) +
          this.poly([T(-.8, -.8, rt, z1), T(.8, -.8, rt, z1), T(.8, .8, rt, z1), T(-.8, .8, rt, z1)], shade(col, -.45));
      },
      dec(y, svg) {
        const o = Q(0, y, 0), a = Q(1, y, 0), c = Q(0, y, 1);
        return `<g transform="matrix(${f1((a.x - o.x) * 100) / 100} ${f1((a.y - o.y) * 100) / 100} ${f1((c.x - o.x) * 100) / 100} ${f1((c.y - o.y) * 100) / 100} ${f1(o.x)} ${f1(o.y)})">${svg}</g>`;
      },
    };
  }
  const FX = 80, FZ = 80 * .8 / .86, FY0 = 98;
  const flatView = {
    box(x0, x1, y0, y1, z0, z1, col) {
      const X = 10 + x0 * FX, W = (x1 - x0) * FX, Y = FY0 - z1 * FZ, Hh = (z1 - z0) * FZ;
      return `<rect x="${f1(X)}" y="${f1(Y)}" width="${f1(W)}" height="${f1(Hh)}" fill="${col}"/>` +
        `<rect x="${f1(X)}" y="${f1(Y)}" width="${f1(W)}" height="2.6" fill="${shade(col, .22)}"/>` +
        `<rect x="${f1(X + W - 2.6)}" y="${f1(Y + 2.6)}" width="2.6" height="${f1(Math.max(0, Hh - 2.6))}" fill="${shade(col, -.18)}"/>`;
    },
    cyl(cx, cy, r, z0, z1, col, top) {
      const X = 10 + cx * FX, R = r * FX, Y0 = FY0 - z0 * FZ, Y1 = FY0 - z1 * FZ;
      return `<rect x="${f1(X - R)}" y="${f1(Y1)}" width="${f1(2 * R)}" height="${f1(Y0 - Y1)}" fill="${col}"/>` +
        `<rect x="${f1(X + R * .45)}" y="${f1(Y1)}" width="${f1(R * .55)}" height="${f1(Y0 - Y1)}" fill="${shade(col, -.2)}"/>` +
        `<ellipse cx="${f1(X)}" cy="${f1(Y1)}" rx="${f1(R)}" ry="${f1(R * .3)}" fill="${top || shade(col, .22)}"/>`;
    },
    hop(cx, cy, rt, rb, z0, z1, col) {
      const X = 10 + cx * FX, Y0 = FY0 - z0 * FZ, Y1 = FY0 - z1 * FZ;
      return `<polygon points="${f1(X - rb * FX)},${f1(Y0)} ${f1(X + rb * FX)},${f1(Y0)} ${f1(X + rt * FX)},${f1(Y1)} ${f1(X - rt * FX)},${f1(Y1)}" fill="${col}"/>` +
        `<polygon points="${f1(X + rb * FX * .55)},${f1(Y0)} ${f1(X + rb * FX)},${f1(Y0)} ${f1(X + rt * FX)},${f1(Y1)} ${f1(X + rt * FX * .55)},${f1(Y1)}" fill="${shade(col, -.18)}"/>` +
        `<rect x="${f1(X - rt * FX)}" y="${f1(Y1)}" width="${f1(rt * FX * 2)}" height="3" fill="${shade(col, .22)}"/>`;
    },
    dec(y, svg) { return `<g transform="matrix(${FX} 0 0 ${-FZ} 10 ${FY0})">${svg}</g>`; },
  };
  function panel(p) {
    const [, x0, x1, , , z0, z1, col] = p, ix = .05, iz = .05;
    return dr(x0 + ix, z0 + iz, x1 - ix, z1 - iz, 'none', `stroke="${shade(col, -.2)}" stroke-width="1" ${NS}`) +
      dc(x0 + ix * .55, z1 - iz * .55, .012, shade(col, -.3)) + dc(x1 - ix * .55, z1 - iz * .55, .012, shade(col, -.3)) +
      dc(x0 + ix * .55, z0 + iz * .55, .012, shade(col, -.3)) + dc(x1 - ix * .55, z0 + iz * .55, .012, shade(col, -.3));
  }
  function drawParts(id, view) {
    const K = PAL[C[id].kind];
    return (ART[id] || ART._)(K).map((p) => {
      if (p[0] === 'box') return view.box(...p.slice(1, 8)) + (p[8] && p[8].panel ? view.dec(p[4], panel(p)) : '');
      if (p[0] === 'cyl') return view.cyl(...p.slice(1));
      if (p[0] === 'hop') return view.hop(...p.slice(1));
      if (p[0] === 'dec') return view.dec(p[1], p[2]);
      return '';
    }).join('');
  }
  const flatArt = (id) => `<svg class="art" viewBox="0 0 100 104" aria-hidden="true"><ellipse cx="50" cy="99" rx="44" ry="3.2" fill="rgba(40,42,44,.12)"/>${drawParts(id, flatView)}</svg>`;

  // items: sand, silicon, wafer, chip, and the RAM stick a chip becomes after the Board assembler. Engine types stay ore, ingot, plate, gear.
  const ITEM = (() => {
    const P2 = (a) => a.map(([x, y]) => f1(x) + ',' + f1(y)).join(' ');
    const sand = '<svg viewBox="-16 -14 32 28"><ellipse cx="0" cy="8.4" rx="13.5" ry="3" fill="#9c895f"/><path d="M-13 8Q-10 -1 -3 -6Q1 -8.4 4 -6Q10 -1 13 8Q0 11 -13 8Z" fill="#d3c08f"/><path d="M4 -6Q10 -1 13 8Q8 9.6 3 10Q6 2 1 -7.4Q3 -7 4 -6Z" fill="#b9a576"/>' +
      [[-5, 2, 1.1], [-1, -2.5, 1], [-8, 6, 1], [1, 5, 1.1], [-3, 7.5, .9], [-6.5, -1, .8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ebdfbd"/>`).join('') + '<circle cx="7" cy="4" r="1" fill="#9c875c"/><circle cx="5" cy="-1" r=".8" fill="#9c875c"/></svg>';
    const silicon = '<svg viewBox="-16 -14 32 28"><path d="M-9 -5L8 -5L8 7L-9 7Q-14.5 1 -9 -5Z" fill="#848d92"/><path d="M-9 -5L8 -5L8 -.6L-11.3 -.6Q-10.6 -3.4 -9 -5Z" fill="#b2babd"/><path d="M-9 4.6L8 4.6L8 7L-9 7Q-10.6 5.9 -11.2 4.6Z" fill="#6d767b"/><ellipse cx="8" cy="1" rx="3.6" ry="6" fill="#c8ced1"/><ellipse cx="8" cy="1" rx="2.1" ry="3.8" fill="#a9b1b5"/></svg>';
    const wafer = '<svg viewBox="-16 -14 32 28"><path d="M-14 0A14 7.5 0 0 0 -4 7.2L4 7.2A14 7.5 0 0 0 14 0L14 2.2A14 7.5 0 0 1 4 9.4L-4 9.4A14 7.5 0 0 1 -14 2.2Z" fill="#8c94a2"/><path d="M-14 0A14 7.5 0 0 1 14 0A14 7.5 0 0 1 4 7.2L-4 7.2A14 7.5 0 0 1 -14 0Z" fill="#cfd4dc"/>' +
      '<path d="M-9 -3L3 3M-4 -5.5L8 .5M1 -6.6L11 -1.6M-12 .4L-2 5.4M-9 3L3 -3M-4 5.5L8 -.5M1 6.6L11 1.6M-12 -.4L-2 -5.4" stroke="#aab1be" stroke-width=".7" fill="none"/><path d="M-10 -1.5A11 5 0 0 1 2 -6" stroke="#eef0f4" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>';
    const pinsL = [.2, .4, .6, .8].map((t) => `M${f1(-12 + 12 * t)} ${f1(1 + 6 * t)}l-1 2.4`).join('');
    const pinsR = [.2, .4, .6, .8].map((t) => `M${f1(12 * t)} ${f1(7 - 6 * t)}l1 2.4`).join('');
    const chip = `<svg viewBox="-16 -14 32 28"><path d="${pinsL}${pinsR}" stroke="#c9a54f" stroke-width="1.7" fill="none"/><polygon points="${P2([[-12, -2], [0, 4], [0, 7], [-12, 1]])}" fill="#25272a"/><polygon points="${P2([[0, 4], [12, -2], [12, 1], [0, 7]])}" fill="#2f3236"/><polygon points="${P2([[0, -8], [12, -2], [0, 4], [-12, -2]])}" fill="#3d4146"/><circle cx="-5.5" cy="-2" r="1.1" fill="#5c6066"/></svg>`;
    // RAM stick: a board lying on the belt, long side to the front, gold contacts on the front edge
    const L = [12, -4], Sv = [2.6, 3.4];
    const at = (a, b) => [L[0] * a + Sv[0] * b, L[1] * a + Sv[1] * b];
    const quad = (a0, a1, b0, b1) => P2([at(a0, b0), at(a1, b0), at(a1, b1), at(a0, b1)]);
    const e0 = at(-1, 1), e1 = at(1, 1);
    const ram = `<svg viewBox="-16 -14 32 28"><polygon points="${P2([e0, e1, [e1[0], e1[1] + 2], [e0[0], e0[1] + 2]])}" fill="#3c5f42"/><polygon points="${quad(-1, 1, -1, 1)}" fill="#557f5a"/>` +
      [-.66, -.08, .5].map((a) => `<polygon points="${quad(a, a + .42, -.7, .25)}" fill="#2a2c2f"/>`).join('') +
      `<polygon points="${quad(-.94, .94, .55, .92)}" fill="#c9a54f"/><path d="${[-.7, -.45, -.2, .05, .3, .55, .8].map((a) => { const p = at(a, .55), q = at(a, .92); return `M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}`; }).join('')}" stroke="#a88a3e" stroke-width=".6"/></svg>`;
    return { ore: sand, ingot: silicon, plate: wafer, gear: chip, ram };
  })();

  // ---------- floor geometry ----------
  const G2 = { name: {}, fl: {}, top: {} };
  // The camera fits the belt, its names and the float lanes into the board box (the height left between the panel and the hand).
  // Width sets the scale unless the box is too short; then the scale drops until it fits. Content is centred in the box.
  const GUT = 16;
  // the frame's front edge runs just past the front row's two line names, so no name sits across it (the names are px, the floor is units)
  let FV = GU.b2 + GU.bw + .32;
  const frameV = (s) => GU.b2 + GU.bw + Math.max(.32, (.09 * s + 3 + 24 + 5) / (AX.vy * s));
  let colwHand = 0;
  let LANE = 58;   // room above the back row and below the front row for a full bend sign
  // left and right screen extents of the floor in ground units (bin on the left for the U, on the right for the straight belt)
  function xBounds() {
    const sx = (u, v) => u * AX.ux + v * AX.vx;
    // the painted frame (drawFloor) is the outermost thing on the floor, so its stroke sets the extents too
    const fr = STR ? [GU.e0 - .25, GU.binU + .95] : [GU.binU - .1, GU.foldU + GU.foldR + GU.bw / 2 + .2], fv = [-.18, FV], st = .05;
    const frL = sx(fr[0] - st, fv[1] + st), frR = sx(fr[1] + st, fv[0] - st);
    if (STR) return [Math.min(frL, sx(GU.e0 - .1, GU.b2c + .3), sx(1, GU.m2 + GU.mD)), Math.max(frR, sx(GU.foldU + GU.foldR + GU.bw / 2 + .06, GU.b1), sx(GU.binU + .8, GU.b2c - .4))];
    return [Math.min(frL, sx(GU.binU - .03, GU.b2c - .36 + GU.mD + .03), sx(1, GU.m2 + GU.mD)), Math.max(frR, sx(GU.foldU + GU.foldR + GU.bw / 2 + .06, GU.b1))];
  }
  function layoutFloor() {
    const W = board.clientWidth || 360, Hav = board.clientHeight || 330;
    const solve = () => {
      const [minX, maxX] = xBounds();
      const sW = (W - 2 * GUT) / (maxX - minX);   // a page gutter each side, so the frame and Shipping never touch the screen edge
      let s = sW, [y0, y1] = fitAt(s);
      if (y1 - y0 > Hav - 4) {   // height is linear in the scale, so two samples give the scale that fits
        const [a0, a1] = fitAt(s / 2), k = ((y1 - y0) - (a1 - a0)) / (s / 2);
        s = Math.max(10, s - ((y1 - y0) - (Hav - 4)) / k);
        [y0, y1] = fitAt(s);
      }
      return [s, y0, y1];
    };
    // short boxes (a small phone on a boss shift): smaller bend signs and floats, so the lanes give their room to the machines
    LANE = 58; board.classList.remove('tight');
    FV = frameV(Lg.s || 40);
    let [s, y0, y1] = solve();
    if (s < 40) { LANE = 42; board.classList.add('tight'); [s, y0, y1] = solve(); }
    FV = frameV(s); [s, y0, y1] = solve();   // the frame depends on the scale; one more pass settles it
    const shift = Math.max(2 - y0, (Hav - (y1 - y0)) / 2 - y0);
    Lg.oy = shift;
    const mv = (o) => { o.y += shift; };
    for (let k = 0; k < NT; k++) { mv(G2.name[k]); mv(G2.fl[k]); G2.top[k] = P(uOf(k) + .5, mvOf(k) + GU.mD * .55, .72 * GU.H); }
    mv(G2.name.hop); mv(G2.fl.hop); mv(G2.name.bin); mv(G2.fl.bin);
    board.style.setProperty('--is', Math.round(s * .56) + 'px');
    // a belt name wraps to its own column, so neighbours never overlap. In the run view the width stays at the hand view's,
    // so names keep their two lines and the bigger pitch only adds space between them.
    const colw = Math.round(s * AX.ux - 6);   // 6px under the pitch: neighbours sit a row apart in y, but never touch in x
    if (!handEl.parentNode.classList.contains('runview') || !colwHand) colwHand = colw;
    board.style.setProperty('--colw', Math.min(colw, colwHand) + 'px');
    board.classList.toggle('narrow', Math.min(colw, colwHand) < 54);   // small phones: tighter name letters, so one long word still fits its column
    drawFloor(W, Hav);
    placeTiles();
    placeBands();
    placeEnds();
    const fx = $('fx'); fx.setAttribute('width', W); fx.setAttribute('height', Hav);
    if (S) drawNames();
  }
  // lays out names and float lanes for scale s with oy = 0; returns the top and bottom of everything that must stay in the box
  function fitAt(s) {
    const [minX, maxX] = xBounds();
    const W = board.clientWidth || 360;
    Lg = { s, ox: W / 2 - (minX + maxX) / 2 * s, oy: 0 };
    // names and floats with oy = 0, then shift everything down so the top lane fits
    const nameTop = {}, nameBot = {};
    for (let k = 0; k < NT; k++) {
      const u = uOf(k) + .5;
      if (k < HALF) {
        const b = P(u, GU.m1, GU.zMax * GU.H).y - 3;
        nameTop[k] = b - 12; nameBot[k] = b;
        G2.name[k] = { x: P(u, GU.m1 + GU.mD / 2, 0).x, y: b - 12 };
      } else {
        const t = P(u, GU.b2 + GU.bw, 0).y + .09 * s + 3;
        nameTop[k] = t; nameBot[k] = t + 12;
        G2.name[k] = { x: P(u, GU.b2c, 0).x, y: t };
      }
    }
    for (let k = 0; k < NT; k++) {
      const c = colOf(k);
      if (k < HALF) {
        const left = c > 0 ? nameTop[k - 1] : nameTop[k];
        G2.fl[k] = { x: G2.name[k].x, y: Math.min(nameTop[k], left) - 3, dn: false };
      } else {
        const right = c < HALF - 1 ? nameBot[k - 1] : nameBot[k];
        G2.fl[k] = { x: G2.name[k].x, y: Math.max(nameBot[k], right) + 3, dn: true };
      }
      G2.top[k] = P(uOf(k) + .5, mvOf(k) + GU.mD * .55, .72 * GU.H);
    }
    const hopTop = P(GU.hopU, GU.b1c, 1.15 * GU.H).y;
    const hopGap = 18 + .3 * s;   // the funnel is bigger up close, so its label sits higher
    G2.name.hop = { x: P(GU.hopU, GU.b1c, 0).x, y: hopTop - hopGap };
    G2.fl.hop = { x: G2.name.hop.x, y: hopTop - hopGap - 2, dn: false };
    const binFront = P(GU.binU + .36, GU.b2c - .36 + GU.mD, 0).y;
    G2.name.bin = { x: P(GU.binU + .36, GU.b2c - .36 + GU.mD, 0).x, y: binFront + 3 };
    G2.fl.bin = { x: G2.name.bin.x, y: Math.max(binFront + 17, nameBot[NT - 1] + 3), dn: true };
    let minY = Infinity, maxY = -Infinity;
    for (let k = 0; k < NT; k++) { minY = Math.min(minY, G2.fl[k].y - (k < HALF ? LANE : 0)); maxY = Math.max(maxY, G2.fl[k].y + (k < HALF ? 0 : LANE)); }   // room for a full bend sign, so it never lands on the quota panel or the status line
    minY = Math.min(minY, G2.fl.hop.y - 26); maxY = Math.max(maxY, G2.fl.bin.y + 30);
    return [minY, maxY];
  }

  const VM = (GU.b1 + GU.bw + GU.m2) / 2, XL = .55;   // straight belt: the return lane between the rows, and its left drop
  const beltD = () => {
    const { b1c, b2c, foldU: fu, foldR: r } = GU;
    const e = GU.e0;
    if (STR) {   // row one, a plain turn down at the right, back left along the middle lane, down at the left, row two to Shipping on the right
      const con = `M${fu} ${b1c}A${r} ${r} 0 0 1 ${fu + r} ${b1c + r}L${fu + r} ${VM - r}A${r} ${r} 0 0 1 ${fu} ${VM}L${XL + r} ${VM}A${r} ${r} 0 0 0 ${XL} ${VM + r}L${XL} ${b2c - r}A${r} ${r} 0 0 0 ${XL + r} ${b2c}`;
      // the connector is plain rubber belt like the rows, not the steel end drum of a fold
      return { rubber: `M${e} ${b1c}L${fu} ${b1c}` + con.replace(/^M[^A]*/, '') + `L${GU.binU + .1} ${b2c}`, fold: '',
        all: `M${e} ${b1c}L${fu} ${b1c}` + con.replace(/^M[^A]*/, '') + `L${GU.binU + .1} ${b2c}` };
    }
    return { rubber: `M${e} ${b1c}L${fu} ${b1c}M${fu} ${b2c}L${e} ${b2c}`,
      fold: `M${fu} ${b1c}A${r} ${r} 0 0 1 ${fu + r} ${b1c + r}L${fu + r} ${b2c - r}A${r} ${r} 0 0 1 ${fu} ${b2c}`,
      all: `M${e} ${b1c}L${fu} ${b1c}A${r} ${r} 0 0 1 ${fu + r} ${b1c + r}L${fu + r} ${b2c - r}A${r} ${r} 0 0 1 ${fu} ${b2c}L${e} ${b2c}` };
  };
  // INTRO hook: the belt's stroke stack (shadow, steel rim, rubber, cleats), shared by drawFloor and intro.js
  function beltSVG(all, rubber) {
    const t = f1(.09 * Lg.s), bw = GU.bw;
    return `<g transform="translate(0 ${t})"><g transform="${gmat()}"><path d="${all}" fill="none" stroke="#1f2124" stroke-width="${bw + .1}"/></g></g>
      <g transform="${gmat()}">
        <path d="${all}" fill="none" stroke="${DSTEEL}" stroke-width="${bw + .1}"/>
        <path d="${all}" fill="none" stroke="${STEEL}" stroke-width="${bw + .04}"/>
        <path d="${rubber}" fill="none" style="stroke:var(--rubber)" stroke-width="${bw - .02}"/>
        <path class="cleat" d="${rubber}" fill="none" style="stroke:var(--rubber2)" stroke-width="${bw - .1}" stroke-dasharray=".05 .2"/>
      </g>`;
  }
  function drawFloor(W, Hh) {
    const f = $('floor'), d = beltD(), bw = GU.bw;
    f.setAttribute('width', W); f.setAttribute('height', Hh); f.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
    let joints = '';
    const uEnd = GU.foldU + 3;
    for (let u = -2; u <= uEnd; u += 2) joints += `M${u} -1.2L${u} 5.6`;
    for (let v = -1.2; v <= 5.6; v += 2.27) joints += `M-2.5 ${v}L${uEnd} ${v}`;
    f.innerHTML = `
      <defs>
        <pattern id="hz" patternUnits="userSpaceOnUse" width=".22" height=".22" patternTransform="rotate(45)"><rect width=".11" height=".22" style="fill:var(--char)"/><rect x=".11" width=".11" height=".22" style="fill:var(--yellow)"/></pattern>
        <pattern id="hzSoft" patternUnits="userSpaceOnUse" width=".22" height=".22" patternTransform="rotate(45)"><rect width=".22" height=".22" style="fill:color-mix(in srgb,var(--yellow) 30%,var(--bg))"/><rect width=".07" height=".22" style="fill:color-mix(in srgb,var(--char) 30%,var(--bg))"/></pattern>
        <pattern id="hzRed" patternUnits="userSpaceOnUse" width=".22" height=".22" patternTransform="rotate(-45)"><rect width=".22" height=".22" style="fill:color-mix(in srgb,var(--bad) 22%,var(--bg))"/><rect width=".08" height=".22" style="fill:color-mix(in srgb,var(--bad) 60%,var(--bg))"/></pattern>
      </defs>
      <g transform="${gmat()}">
        <path d="${joints}" style="stroke:var(--joint)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>
        <rect x="${STR ? GU.e0 - .25 : GU.binU - .1}" y="-.18" width="${STR ? GU.binU + .95 - GU.e0 + .25 : GU.foldU + GU.foldR + bw / 2 + .2 - GU.binU + .1}" height="${f1((FV + .18) * 100) / 100}" fill="none" style="stroke:var(--yellow)" stroke-width=".07" opacity=".85"/>
        ${STR ? '' : `<path d="M${GU.binU - .1} ${GU.b1 + bw + .16}L.95 ${GU.b1 + bw + .16}M${GU.binU - .1} ${GU.m2 - .14}L.95 ${GU.m2 - .14}" style="stroke:var(--yellow)" stroke-width=".05" opacity=".6"/>`}
      </g>
      ${beltSVG(d.all, d.rubber)}
      <g transform="${gmat()}">
        <path d="${d.fold}" fill="none" stroke="#c3c8ca" stroke-width="${bw - .02}"/>
        <path class="roll" d="${d.fold}" fill="none" stroke="#8b9296" stroke-width="${bw - .08}" stroke-dasharray=".04 .21"/>
        <g id="chute" class="chute"><path d="M${GU.e0} ${GU.b2c - .1}L${GU.binU + .06} ${GU.b2c - .1}L${GU.binU + .06} ${GU.b1c}L${GU.e0 - .1} ${GU.b1c}" fill="none" stroke="${PAL.special}" stroke-width=".12" stroke-dasharray=".14 .1" opacity=".85"/></g>
      </g>`;
  }

  // a tile is a transparent hit box clipped to the machine bay plus its belt segment
  function tileGeom(k) {
    const u0 = uOf(k), v0 = mvOf(k), bv = k < HALF ? GU.b1 : GU.b2, zt = GU.zMax * GU.H;
    const mu0 = u0 + .05, mu1 = u0 + .95, mv1 = v0 + GU.mD;
    const poly = [P(mu0, v0, zt), P(mu1, v0, zt), P(mu1, v0, 0), P(u0 + 1, bv, 0), P(u0 + 1, bv + GU.bw, 0), P(u0, bv + GU.bw, 0), P(u0, bv, 0), P(mu0, mv1, 0), P(mu0, mv1, zt)];
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    return { poly, box, u0, v0 };
  }
  function placeTiles() {
    tiles.forEach((t, k) => {
      const g = tileGeom(k);
      t.style.left = g.box.x + 'px'; t.style.top = g.box.y + 'px';
      t.style.width = g.box.w + 'px'; t.style.height = g.box.h + 'px';
      t.style.clipPath = `polygon(${g.poly.map((p) => f1(p.x - g.box.x) + 'px ' + f1(p.y - g.box.y) + 'px').join(',')})`;
      t._g = g;
    });
  }
  function tileSVG(k, id, bend) {
    const g = tiles[k]._g, b = g.box, u0 = g.u0, v0 = g.v0;
    const bay = [P(u0 + .03, v0 - .02, 0), P(u0 + .97, v0 - .02, 0), P(u0 + .97, v0 + GU.mD + .04, 0), P(u0 + .03, v0 + GU.mD + .04, 0)];
    let s = `<svg width="${f1(b.w)}" height="${f1(b.h)}" viewBox="${f1(b.x)} ${f1(b.y)} ${f1(b.w)} ${f1(b.h)}"><polygon class="bay${bend ? ' bendbay' : ''}" points="${pts(bay)}"/>`;
    if (id) s += `<g class="mg">${drawParts(id, isoView(u0 + (1 - GU.mW) / 2, v0))}</g>`;
    else if (!(S && S.R && S.R.blocked.includes(k))) {
      const c = P(u0 + .5, v0 + GU.mD / 2, 0), a = P(u0 + .38, v0 + GU.mD / 2, 0), e = P(u0 + .62, v0 + GU.mD / 2, 0), n = P(u0 + .5, v0 + GU.mD / 2 - .14, 0), so = P(u0 + .5, v0 + GU.mD / 2 + .14, 0);
      s += `<path class="plus" d="M${f1(a.x)} ${f1(a.y)}L${f1(e.x)} ${f1(e.y)}M${f1(n.x)} ${f1(n.y)}L${f1(so.x)} ${f1(so.y)}"/>`;
    }
    return s + '</svg>';
  }
  function placeBands() {
    document.querySelectorAll('.band').forEach((el) => {
      const k = +el.dataset.pair, u0 = uOf(k), va = GU.b1 + GU.bw + .1, vb = GU.m2 - .08;
      const q = [P(u0 + .16, va, 0), P(u0 + .84, va, 0), P(u0 + .84, vb, 0), P(u0 + .16, vb, 0)];
      const xs = q.map((p) => p.x), ys = q.map((p) => p.y), x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
      Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      el.querySelector('svg').outerHTML = `<svg width="${f1(w)}" height="${f1(h)}" viewBox="${f1(x)} ${f1(y)} ${f1(w)} ${f1(h)}"><g transform="${gmat()}"><rect x="${u0 + .16}" y="${va}" width=".68" height="${f1((vb - va) * 100) / 100}" fill="url(#hz)" opacity=".9"/></g></svg>`;
      const lp = P(u0 + .5, GU.b1 + GU.bw + .5, 0);
      const sp = el.querySelector('span'); sp.style.left = (lp.x - x) + 'px'; sp.style.top = (lp.y - y) + 'px';
    });
  }
  function placeEnds() {
    // hopper: a steel funnel over the start of the belt
    const hb = $('hopBox'), hv = isoView(GU.hopU - .4, GU.b1c - .4 * GU.mW / GU.mD);
    const legs = [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]];
    const leg = (sx, sy) => hv.box(.5 + sx - .04, .5 + sx + .04, .5 + sy * GU.mW / GU.mD - .05, .5 + sy * GU.mW / GU.mD + .05, 0, .5, DSTEEL);
    let s = leg(-.36, -.36) + leg(.36, -.36) + hv.hop(.5, .5, .42, .2, .48, 1.12, STEEL) + leg(-.36, .36) + leg(.36, .36);
    const o = P(GU.hopU, GU.b1c, 1.12 * GU.H);
    s += `<ellipse cx="${f1(o.x - 4)}" cy="${f1(o.y)}" rx="${f1(Lg.s * .09)}" ry="${f1(Lg.s * .05)}" fill="#b9a576"/><ellipse cx="${f1(o.x + 5)}" cy="${f1(o.y + 1)}" rx="${f1(Lg.s * .08)}" ry="${f1(Lg.s * .045)}" fill="#d3c08f"/>`;
    fitBox(hb.parentNode, hb, s, [P(GU.hopU - .5, GU.b1c - .5, 1.3 * GU.H), P(GU.hopU + .5, GU.b1c + .5, 0), P(GU.hopU - .5, GU.b1c + .5, 0), P(GU.hopU + .5, GU.b1c - .5, 1.3 * GU.H)]);
    // bin: a charcoal tote at the end of the belt
    const bv = isoView(GU.binU, GU.b2c - .36), BW = .72;
    const b2 = bv.box(0, BW, 0, 1, 0, .5, '#45494d') + bv.dec(1, dr(.09, .12, BW - .09, .38, 'none', `stroke="#6a6f73" stroke-width="1" ${NS}`) + dp('M.22 .25L.5 .25', 'none', st(GU && '#d3b24a', 2.2)));
    const bu = GU.binU, top = [P(bu + .06 * GU.mW, GU.b2c - .36 + .1 * GU.mD, .5 * GU.H), P(bu + (BW - .06) * GU.mW, GU.b2c - .36 + .1 * GU.mD, .5 * GU.H), P(bu + (BW - .06) * GU.mW, GU.b2c - .36 + .9 * GU.mD, .5 * GU.H), P(bu + .06 * GU.mW, GU.b2c - .36 + .9 * GU.mD, .5 * GU.H)];
    fitBox($('binBox').parentNode, $('binBox'), b2 + `<polygon points="${pts(top)}" fill="#26282b"/>`, [P(bu - .05, GU.b2c - .5, .7 * GU.H), P(bu + .85, GU.b2c + .6, 0), P(bu - .05, GU.b2c + .6, 0), P(bu + .85, GU.b2c - .5, .7)]);
  }
  function fitBox(outer, inner, svg, corners) {
    const xs = corners.map((p) => p.x), ys = corners.map((p) => p.y), x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    Object.assign(outer.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    inner.innerHTML = `<svg width="${f1(w)}" height="${f1(h)}" viewBox="${f1(x)} ${f1(y)} ${f1(w)} ${f1(h)}">${svg}</svg>`;
  }
  function drawNames() {
    const el = $('names');
    let h = `<span class="bn end" style="left:${f1(G2.name.hop.x)}px;top:${f1(G2.name.hop.y)}px">sand</span><span class="bn end" style="left:${f1(Math.max(G2.name.bin.x, 30))}px;top:${f1(G2.name.bin.y)}px">shipping</span>`;
    for (let k = 0; k < NT; k++) {
      const id = S && S.belt ? S.belt[k] : null, jam = S && S.R && S.R.blocked.includes(k);
      const txt = jam ? 'jammed' : id ? nm(id) : '';
      if (!txt) continue;
      // back row names grow upward from their line, front row names grow down, so two line names never sit on a machine
      h += `<span class="bn${k < HALF ? ' up' : ''}${jam ? ' jam' : id && C[id].rar === 'r' ? ' rare' : ''}" style="left:${f1(G2.name[k].x)}px;top:${f1(G2.name[k].y + (k < HALF ? 12 : 0))}px">${txt}</span>`;
    }
    el.innerHTML = h;
    // one long word can be wider than its column; shrink just that name so it never meets its neighbour
    const cw = parseFloat(board.style.getPropertyValue('--colw')) || 0;
    if (cw) el.querySelectorAll('.bn:not(.end)').forEach((n) => { const w = n.offsetWidth; if (w > cw) n.style.fontSize = Math.max(9, parseFloat(getComputedStyle(n).fontSize) * cw / w) + 'px'; });
  }

  // the hazard arc a bend throws across the fold
  function bendArc(from, to) {
    const A = G2.top[from], B = to, fx = $('fx');
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, d = Math.hypot(B.x - A.x, B.y - A.y);
    const cx = mx + d * .55, cy = my - d * .12;
    const path = `M${f1(A.x)} ${f1(A.y)}Q${f1(cx)} ${f1(cy)} ${f1(B.x)} ${f1(B.y)}`;
    const w = Math.max(5, Lg.s * .12);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'go');
    g.innerHTML = `<path class="arc a" d="${path}" pathLength="1" stroke-dasharray="1" stroke-width="${f1(w)}"/><path class="arc b" d="${path}" stroke-dasharray="${f1(w * .9)} ${f1(w * .9)}" stroke-width="${f1(w * .62)}"/>` +
      `<circle cx="${f1(B.x)}" cy="${f1(B.y)}" r="${f1(w * 1.1)}" fill="none" style="stroke:var(--yellow)" stroke-width="${f1(w * .5)}"/><circle cx="${f1(A.x)}" cy="${f1(A.y)}" r="${f1(w * .7)}" style="fill:var(--char)"/>`;
    fx.appendChild(g);
    setTimeout(() => g.remove(), 950);
  }

  // ---------- saved stats (per browser) ----------
  const KEY = 'conveyor.v1';
  function loadStats() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { runs: 0, best: 0, history: [] }; }
    catch (e) { return { runs: 0, best: 0, history: [] }; }
  }
  function saveStats(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  let stats = loadStats();

  // ---------- state ----------
  let S = null;
  const fmt = (n) => n >= 1e7 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : Math.round(n).toLocaleString('en-US');

  function newRun() {
    stats.runs++; saveStats(stats);
    S = {
      run: stats.runs, deck: E.STARTER.slice(), shift: 0, started: Date.now(),
      bestPull: 0, bendSeen: false, bendTotal: 0, firstBend: 0,
      bossBag: E.shuffle(Object.keys(E.BOSSES)), log: [], work: {}, bestItem: null, kept: null,
      layout: E.layout(E.shuffle(Object.keys(E.LAYOUTS))[0]),   // a random line for each job
    };
    // the first job ever: a straight belt for shifts 1 and 2, ordinary machines only; it folds at shift 3
    S.firstJob = !stats.seenFold;
    if (S.firstJob) {
      S.layout = E.layout('straight');
      // the fold shift's boss is a gentle one: never Fab audit (bends off) or New model launch (a bigger order)
      while (['straight', 'newmodel'].includes(S.bossBag[0])) S.bossBag.push(S.bossBag.shift());
    }
    startShift();
  }

  const bossFor = (shift) => E.isBoss(shift) ? S.bossBag[(shift / 3 - 1) % S.bossBag.length] : null;
  const layoutLine = () => S.layout.straight ? 'a straight line. It folds at shift 3' : `${S.layout.name}, ${S.layout.tiles} tiles, ${plural(S.layout.cols.length, 'bend')}`;
  function minus(deck, used) {
    const left = deck.slice();
    used.forEach((id) => { const i = left.indexOf(id); if (i >= 0) left.splice(i, 1); });
    return left;
  }

  function startShift() {
    clearFloats();   // last shift's signs and numbers would sit over the new layout
    S.shift++;
    let fold = null;
    if (S.layout.straight && S.shift >= 3) {   // the belt folds: remember where row two and Shipping were, for the animation
      fold = { rows: tiles.slice(HALF).map((t) => t.getBoundingClientRect()), bin: $('binBox').parentNode.getBoundingClientRect(), floor: $('floor').cloneNode(true) };
      S.layout = E.layout('standard');
    }
    S.R = E.shiftRules(S.shift, bossFor(S.shift), Math.random, S.layout.tiles, S.layout.straight, S.layout.q);
    S.quota = S.R.quota;
    S.total = 0; S.pull = 0; S.pulls = [];
    S.belt = S.kept ? S.kept.slice() : Array(S.layout.tiles).fill(null);
    setTiles(S.layout.tiles, S.layout.straight);
    S.carried = !!S.kept;
    S.kept = null;
    S.R.blocked.forEach((k) => { S.belt[k] = null; });
    S.fresh = {};       // tile -> {replaced} placed this pull, can be taken back
    S.draw = E.shuffle(minus(S.deck, S.belt.filter(Boolean))); S.discard = []; S.hand = [];
    S.log.push({ shift: S.shift, quota: S.quota, boss: S.R.boss, total: 0, best: 0 });
    nextPull();
    if (fold) foldBelt(fold);
  }

  // The fold, about 1.2 s: row two and Shipping slide round into the U, the straight floor fades into the folded one,
  // then the bend stripes wipe in and the bend hint shows. Reduced motion: straight to the U and the hint.
  function foldBelt(old) {
    stats.seenFold = true; saveStats(stats);
    const hint = () => { if (window.ConveyorIntro) ConveyorIntro.tip('bend', true); else say('<b>The belt folds.</b> Machines on a bend work items twice.'); };
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !Element.prototype.animate) { hint(); return; }
    S.busy = true;
    const ease = 'cubic-bezier(.45,0,.2,1)', D = 1200;
    const slide = (el, r0) => { const r1 = el.getBoundingClientRect(); el.animate([{ transform: `translate(${r0.left - r1.left}px,${r0.top - r1.top}px)` }, { transform: 'none' }], { duration: D, easing: ease }); };
    tiles.slice(HALF).forEach((t, i) => slide(t, old.rows[i]));
    slide($('binBox').parentNode, old.bin);
    const f = $('floor');
    old.floor.removeAttribute('id'); old.floor.style.pointerEvents = 'none';
    f.parentNode.insertBefore(old.floor, f.nextSibling);
    old.floor.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D * .75, easing: 'ease-in', fill: 'forwards' }).onfinish = () => old.floor.remove();
    f.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D, easing: 'ease-out' });
    $('names').animate([{ opacity: 0 }, { opacity: 0, offset: .7 }, { opacity: 1 }], { duration: D });
    document.querySelectorAll('.band').forEach((b) => b.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 100% 0 0)', offset: .75 }, { clipPath: 'inset(0 0 0 0)' }], { duration: D + 400, easing: 'ease-out' }));
    setTimeout(() => { S.busy = false; render(); hint(); }, D + 450);
  }

  function handSize() {
    return S.belt.some((id) => id && C[id].draw) ? Math.max(S.R.draw, 7) : S.R.draw;
  }

  function nextPull() {
    S.pull++;
    S.discard.push(...S.hand);
    S.hand = []; S.fresh = {}; S.sel = -1;
    const size = handSize();
    while (S.hand.length < size) {
      if (!S.draw.length) { if (!S.discard.length) break; S.draw = E.shuffle(S.discard); S.discard = []; }
      S.hand.push(S.draw.pop());
    }
    S.busy = false;
    render();
    const of = S.R.pulls;
    if (S.pull === 1) showTip();
    const boss = S.R.boss ? ` Boss shift: ${bossNm(S.R.boss)}.` : '';   // the boss card above carries the rule
    if (S.pull === 1) {
      say(S.shift === 1
        ? `<b>Run 1 of ${of}.</b> Today: ${layoutLine()}. Tap a card, then a tile.`
        : `<b>Run 1 of ${of}.</b>${S.carried ? ' The Long contract kept your bolted machines.' : ''}${boss || ' Draw, place, run.'}`);
    } else {
      say(`<b>Run ${S.pull} of ${of}.</b> ${S.hand.length} new cards. Place more machines, or cover one you don't want.`);
    }
  }

  // ---------- render ----------
  const tiles = [];
  const BOLT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2.5 20.2,7.25 20.2,16.75 12,21.5 3.8,16.75 3.8,7.25" fill="#cfae45" stroke="#2e3135" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="#2e3135" stroke-width="1.8"/></svg>';   // a hex bolt head
  // (re)builds the tiles and bend bands for a belt of n tiles, then lays the floor out again
  function setTiles(n, straight) {
    straight = !!straight;
    if (n === NT && tiles.length === n && straight === STR) return;
    NT = n; HALF = n / 2; GU.foldU = 1 + HALF; STR = straight;
    GU.binU = STR ? GU.foldU + .15 : .2;   // Shipping sits at the end of row two: right for the straight belt, left for the U
    tiles.forEach((t) => t.remove()); tiles.length = 0;
    document.querySelectorAll('.band').forEach((b) => b.remove());
    const before = $('hopBox').parentNode;
    for (let c = 0; c < HALF; c++) {
      const b = document.createElement('div');
      b.className = 'band'; b.dataset.pair = c;
      b.innerHTML = '<svg></svg><span>bend</span>';
      cam.insertBefore(b, before);
    }
    for (let k = 0; k < n; k++) {
      const t = document.createElement('div');
      t.className = 'tile ' + (k < HALF ? 'r1' : 'r2');
      t.innerHTML = '<div class="mach"></div>';
      t.addEventListener('click', () => tapTile(k));
      cam.appendChild(t);
      tiles.push(t);
    }
    layoutFloor();
  }
  function buildBoard() { setTiles(10); }
  const bendsNow = () => E.bendsOf(S && S.layout ? S.layout : E.layout('standard'));

  // what each card works on, from its rule in engine.js. null: it changes the belt or the draw, not items.
  const WORKS = {
    crusher: 'ore', washer: 'ore', smelter: 'ore', furnace: 'ore', hopper: 'ore', richseam: 'ore',
    caster: 'ingot', press: 'ingot', annealer: 'ingot',
    coater: 'plate', stamper: 'plate', cutter: 'plate',
    tempering: 'gear', assembler: 'gear', gearbox: 'gear',
    polisher: 'metal',
    roller: 'any', oiler: 'any', tally: 'any', inspector: 'any', duplicator: 'any', recycler: 'any', overclock: 'any', widefold: 'any',
    nightcrew: null, boltgun: null,
  };
  const WORKS_WORD = { ore: 'sand', ingot: 'silicon', plate: 'wafers', gear: 'chips', metal: 'silicon, wafers and chips', any: 'anything' };
  // a small item drawn inside a 32 x 28 box; groups for 'metal' and 'any'
  const mini = (t, x, y, w) => ITEM[t].replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${f1(w * .875)}" `);
  function itemIcon(t) {
    if (t === 'any') return `<svg viewBox="0 0 32 28">${mini('ore', -1, 1, 17)}${mini('plate', 15, 2, 17)}${mini('ingot', 1, 12, 17)}${mini('gear', 14, 12, 18)}</svg>`;
    if (t === 'metal') return `<svg viewBox="0 0 32 28">${mini('plate', 0, 1, 18)}${mini('ingot', 14, 2, 18)}${mini('gear', 7, 11, 19)}</svg>`;
    return ITEM[t];
  }
  // card art: the same front elevation as flatArt, cropped tight so the machine fills the window
  const cardArt = (id) => `<svg class="art" viewBox="8 5 84 97" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><ellipse cx="50" cy="99" rx="42" ry="2.6" fill="rgba(40,42,44,.18)"/>${drawParts(id, flatView)}</svg>`;
  // belt extension rewards: not deck cards. [name, tag, rule]
  const EXT = {
    ext: ['Extension', '+2 tiles', 'Two more tiles at the fold, for the rest of the job'],
    extbend: ['Extension', '+2 tiles, bend', 'Two more tiles at the fold, facing each other as a bend, for the rest of the job'],
  };
  function extArt(bend) {
    // an iso belt segment in the board's steel and rubber, a +2 plate on top; the bend version adds a hazard band across it
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const L0 = [12, 62], L1 = [40, 78], R0 = [60, 36], R1 = [88, 52];   // short ends L0-L1 and R0-R1, long sides L0-R0 (back) and L1-R1 (front)
    const pt = (q) => q.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
    const ins = (t, u) => lerp(lerp(L0, R0, t), lerp(L1, R1, t), u);   // t along the belt, u across it
    const cleats = [.08, .18, .28, .38, .48, .58, .68, .78, .88].map((t) => { const a = ins(t, .16), b = ins(t, .84); return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`; }).join('');
    const id = bend ? 'xcb' : 'xc';
    const band = bend ? `<clipPath id="${id}"><polygon points="${pt([ins(.4, 0), ins(.6, 0), ins(.6, 1), ins(.4, 1)])}"/></clipPath><g clip-path="url(#${id})"><rect x="10" y="30" width="80" height="60" fill="#d3b24a"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<path d="M${18 + n * 7} 82L${38 + n * 7} 34" stroke="#34373b" stroke-width="3"/>`).join('')}</g>` : '';
    return `<svg class="art" viewBox="8 5 84 97" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><ellipse cx="50" cy="96" rx="40" ry="2.6" fill="rgba(40,42,44,.18)"/>
      <polygon points="${pt([L1, R1, [R1[0], R1[1] + 6], [L1[0], L1[1] + 6]])}" fill="#1f2124"/><polygon points="${pt([L0, L1, [L1[0], L1[1] + 6], [L0[0], L0[1] + 6]])}" fill="#2a2c2f"/>
      <polygon points="${pt([L0, R0, R1, L1])}" fill="${DSTEEL}"/><polygon points="${pt([ins(0, .06), ins(1, .06), ins(1, .94), ins(0, .94)])}" fill="${STEEL}"/>
      <polygon points="${pt([ins(0, .12), ins(1, .12), ins(1, .88), ins(0, .88)])}" fill="#2f3134"/><path d="${cleats}" stroke="#4b4f53" stroke-width="2.2"/>${band}
      <rect x="36" y="14" width="28" height="18" rx="3" fill="#cfae45" stroke="#2e3135" stroke-width="1.4"/><text x="50" y="28.2" text-anchor="middle" font-family="DIN Condensed,Avenir Next Condensed,Arial Narrow,sans-serif" font-weight="700" font-size="15" fill="#2e3135">+2</text>
      <path d="M50 32V40" stroke="#2e3135" stroke-width="1.4"/></svg>`;
  }
  function cardHTML(id) {
    if (EXT[id]) return `<span class="win">${extArt(id === 'extbend')}</span><span class="nm">${EXT[id][0]}</span><span class="tg k-special">${EXT[id][1]}</span>`;
    const c = C[id], w = WORKS[id];
    const chip = w ? `<span class="it" title="Works on ${WORKS_WORD[w]}">${itemIcon(w)}</span>` : '';
    return `${c.rar === 'r' ? '<span class="rr">RARE</span>' : ''}<span class="win">${cardArt(id)}${chip}</span><span class="nm">${nm(id)}</span><span class="tg k-${c.kind}">${TAG[id] || ''}</span>`;
  }
  const cardTitle = (id) => EXT[id] ? `${EXT[id][0]}: ${EXT[id][2]}` : `${nm(id)}: ${rl(id)}`;
  function cardClass(id) { if (EXT[id]) return 'card k-special ext'; const c = C[id]; return `card k-${c.kind}${c.rar === 'r' ? ' rare' : ''}`; }

  function render() {
    $('runNo').textContent = S.run;
    $('shiftNo').textContent = S.shift;
    $('pullNo').textContent = S.pull;
    $('pullMax').textContent = S.R ? S.R.pulls : 3;
    const rule = $('rule');
    if (S.R && S.R.boss) { rule.style.display = ''; rule.innerHTML = `<div class="boss"><b>${bossNm(S.R.boss)}</b><span class="bl">${bossRule(S.R.boss, S.R)}</span></div>`; }
    else rule.style.display = 'none';
    const map = E.bendMap(S.belt, { noBends: S.R && S.R.noBends, bends: bendsNow() });
    document.querySelectorAll('.band').forEach((b) => {
      const k = +b.dataset.pair;
      const on = map[k] !== undefined;
      const off = S.R && S.R.noBends && bendsNow()[k] !== undefined;
      b.style.display = on || off ? 'block' : 'none';
      b.classList.toggle('off', !!off);
      b.querySelector('span').textContent = off ? 'bend off' : 'bend';
    });
    $('quota').textContent = fmt(S.quota);
    $('slip').innerHTML = S.shift ? `<b>${slipLab(S.run, S.shift)} needs ${fmt(S.quota)} by morning.</b>` : '';
    setTotal(S.total);
    const pt = $('pullTotal'); pt.textContent = ''; pt.className = 'pullnum';
    S.belt.forEach((id, k) => {
      const t = tiles[k], m = t.querySelector('.mach');
      t.classList.remove('empty', 'rare', 'fresh', 'target', 'occupied', 'blocked');
      const onBend = map[k] !== undefined;
      t.title = id ? cardTitle(id) : '';
      if (S.R && S.R.blocked.includes(k)) { t.classList.add('blocked'); m.className = 'mach'; m.innerHTML = tileSVG(k, null, false); return; }
      if (!id) { t.classList.add('empty'); m.className = 'mach'; m.innerHTML = tileSVG(k, null, onBend); }
      else {
        m.className = 'mach k-' + C[id].kind;
        m.innerHTML = tileSVG(k, id, onBend);
        if (C[id].rar === 'r') t.classList.add('rare');
        if (S.fresh[k]) t.classList.add('fresh');
      }
      if (S.sel >= 0 && !S.busy) { t.classList.add('target'); if (id) t.classList.add('occupied'); }
      if (S.keep && id && id !== 'boltgun') t.classList.add('target', 'occupied');   // keepable: the same highlight as a tile you can place on
      const bolted = S.keep && S.keep.picked.includes(k);
      t.classList.toggle('bolted', !!bolted);
      let bi = t.querySelector('.bolt'); if (bolted && !bi) { bi = document.createElement('span'); bi.className = 'bolt'; bi.innerHTML = BOLT_ICON; t.appendChild(bi); } else if (!bolted && bi) bi.remove();
    });
    $('chute').classList.toggle('on', S.belt.includes('recycler') && !STR);
    drawNames();
    handEl.innerHTML = '';
    S.hand.forEach((id, i) => {
      const b = document.createElement('button');
      b.className = cardClass(id) + (i === S.sel ? ' sel' : '');
      b.innerHTML = cardHTML(id);
      b.title = cardTitle(id);
      b.addEventListener('click', () => tapCard(i));
      handEl.appendChild(b);
    });
    // 5 or fewer in one row. Bigger hands (Night Crew) go in one row where there is room, else two rows.
    const n = S.hand.length, roomy = handEl.clientWidth >= n * 64 + (n - 1) * 6;
    // Bigger hands that don't fit (Night Crew on a phone) side-scroll in one row at the 5-card size, never wrap behind the lever.
    const cols = n <= 5 || !roomy ? 5 : n;
    handEl.style.setProperty('--cols', cols);
    handEl.classList.remove('two');
    handEl.classList.toggle('scroll', n > cols);
    handEl.classList.toggle('locked', !!(S.busy || S.keep));
    drawPile(S.draw.length);
    const running = handEl.parentNode.classList.contains('runview');   // only a run folds the lever to Faster, not the belt fold
    lever.textContent = S.keep ? 'Keep' : running ? 'Faster' : 'Run';
    lever.classList.toggle('fast', running);
    lever.classList.toggle('on', running && speedUp);
  }

  function setTotal(v) {
    if (S && v > (window.__lastTotal || 0) && S.busy) sfx('tick', { v }); window.__lastTotal = v;
    $('total').textContent = fmt(v);
    const bar = $('bar');
    bar.querySelector('i').style.width = Math.min(100, v / S.quota * 100) + '%';
    bar.classList.toggle('met', v >= S.quota);
  }

  // ---------- the deck pile ----------
  function cardBack(w = 30, h = 42) {
    return `<svg viewBox="0 0 30 42" width="${w}" height="${h}" aria-hidden="true">
      <rect x="0.75" y="0.75" width="28.5" height="40.5" rx="4" fill="#2f3236" stroke="#1f2124" stroke-width="1.5"/>
      <rect x="3.5" y="3.5" width="23" height="35" rx="2.5" fill="none" stroke="#cfae45" stroke-width="1.25"/>
      <g transform="translate(15 21)">
        <rect x="-8" y="-4.5" width="16" height="9" rx="1" fill="#5c7a5a"/>
        <rect x="-6" y="-2.75" width="3" height="3.5" fill="#1f2124"/><rect x="-1.5" y="-2.75" width="3" height="3.5" fill="#1f2124"/><rect x="3" y="-2.75" width="3" height="3.5" fill="#1f2124"/>
        <rect x="-7" y="2.5" width="14" height="1.5" fill="#cfae45"/>
      </g>
    </svg>`;
  }
  const pileLayers = (n) => n >= 8 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0;
  let pileN = null, pileTimer = 0;
  function pileHTML(n, grow) {
    const L = pileLayers(n);
    if (!L) return `<span class="bk out" style="--i:0"><span class="ct">0</span></span>`;
    let out = '';
    for (let i = 0; i < L; i++) {
      const dark = L - 1 - i, top = i === L - 1;
      out += `<span class="bk${grow && i === 0 ? ' grow' : ''}" style="--i:${i};${dark ? `filter:brightness(${Math.pow(.92, dark).toFixed(3)})` : ''}">${cardBack()}${top ? `<span class="ct">${n}</span>` : ''}</span>`;
    }
    return out;
  }
  function drawPile(n) {
    const b = $('deckBtn'), was = pileN;
    if (n === was) return;
    pileN = n;
    b.setAttribute('aria-label', `Deck: ${n} card${n === 1 ? '' : 's'}. Tap to see them.`);
    clearTimeout(pileTimer);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const grow = was !== null && pileLayers(n) > pileLayers(was);
    const top = b.querySelector('.bk:last-of-type');
    // a draw: the top back lifts and fades (140 ms), then the pile re-renders
    if (was !== null && n < was && top && !reduce) { top.classList.add('lift'); pileTimer = setTimeout(() => { b.innerHTML = pileHTML(n, false); }, 140); return; }
    b.innerHTML = pileHTML(n, grow && !reduce);
  }

  function say(html) { $('status').innerHTML = html; }
  // the order note, then a boss shift's dry line, under the quota panel: one tag at a time, about 3 s each, then it fades.
  // A tap on the panel shows the current one again. A new tag replaces the one that is up, never stacks.
  let tipTimer = 0, tipIdx = 0;
  const tipList = () => S && S.shift ? [slipNote(S.run, S.shift)].concat(S.R && S.R.boss && bossDry(S.R.boss) ? [bossDry(S.R.boss)] : []) : [];
  function showTipAt(i, chain) {
    const t = $('tip'), list = tipList(); clearTimeout(tipTimer);
    if (!list[i]) { t.classList.remove('on'); return; }
    tipIdx = i;
    t.innerHTML = `<span>${list[i]}</span>`;
    t.classList.add('on');
    tipTimer = setTimeout(() => { if (chain && list[i + 1]) showTipAt(i + 1, true); else t.classList.remove('on'); }, 3000);
  }
  function showTip() { showTipAt(0, true); }   // shift start: the whole queue

  // ---------- placing ----------
  function tapCard(i) {
    if (S.busy || S.keep) return;
    S.sel = S.sel === i ? -1 : i;
    render();
    if (S.sel >= 0) sfx('pick', { id: S.hand[i] });
    if (S.sel >= 0) {
      say(`<b>${nm(S.hand[i])}:</b> ${rl(S.hand[i])}. Tap a tile to place it.`);
    }
  }

  function tapTile(k) {
    if (S.busy) return;
    if (S.keep) { tapKeep(k); return; }
    if (S.R.blocked.includes(k)) { say('That tile is jammed for this shift.'); return; }
    if (S.sel >= 0) {
      const id = S.hand[S.sel];
      const old = S.belt[k];
      if (S.fresh[k]) {
        // swapping a machine placed this pull: the old one goes back to the hand
        S.hand[S.sel] = old;
        S.belt[k] = id;
        S.fresh[k] = { replaced: S.fresh[k].replaced };
      } else {
        S.hand.splice(S.sel, 1);
        S.belt[k] = id;
        S.fresh[k] = { replaced: old };
      }
      S.sel = -1;
      render();
      sfx('place', { id, k });
      const under = S.fresh[k].replaced;
      say(under
        ? `${nm(id)} covers the ${nm(under)}. Tap it to take it back.`
        : `Placed ${nm(id)}. ${S.hand.length ? 'Place more, or press Run.' : 'Press Run.'}`);
      return;
    }
    const id = S.belt[k];
    if (S.fresh[k]) {
      // take back a machine placed this pull
      S.hand.push(id);
      S.belt[k] = S.fresh[k].replaced;
      delete S.fresh[k];
      render();
      say(`Took ${nm(id)} back.`);
      return;
    }
    const bend = E.bendMap(S.belt, { noBends: S.R.noBends, bends: bendsNow() })[k] !== undefined;
    if (id) say(`<b>${nm(id)}:</b> ${rl(id)}.${bend ? ' It sits on a bend.' : ''} Placed machines stay until the shift ends.`);
    else say(bend ? 'An open bend tile. It faces the tile across the fold.' : 'An open tile. Pick a card first.');
  }

  // ---------- the pull ----------
  let geo = null;
  function measure() {
    const z = .1 * GU.H, pos = {};
    for (let k = 0; k < NT; k++) pos[k] = P(uOf(k) + .5, k < HALF ? GU.b1c : GU.b2c, z);
    pos[-1] = P(GU.hopU + .05, GU.b1c, z);
    pos[NT] = P(GU.binU + .36, GU.b2c, .5 * GU.H);
    const fold = [];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; fold.push(P(GU.foldU + Math.cos(a) * GU.foldR, GU.b1c + GU.foldR + Math.sin(a) * GU.foldR, z)); }
    for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; fold.push(P(GU.foldU + Math.cos(a) * GU.foldR, GU.b2c - GU.foldR + Math.sin(a) * GU.foldR, z)); }
    let back = [P(GU.binU + .06, GU.b2c - .1, z), P(GU.binU + .06, GU.b1c, z)];
    if (STR) {   // the connector replaces the fold: down at the right, back along the middle lane, down at the left
      fold.length = 0;
      const r = GU.foldR, fu = GU.foldU, arc = (cu, cv, a0, a1) => { for (let i = 0; i <= 4; i++) { const a = a0 + (a1 - a0) * i / 4; fold.push(P(cu + Math.cos(a) * r, cv + Math.sin(a) * r, z)); } };
      arc(fu, GU.b1c + r, -Math.PI / 2, 0); arc(fu, VM - r, 0, Math.PI / 2); arc(XL + r, VM + r, -Math.PI / 2, -Math.PI); arc(XL + r, GU.b2c - r, Math.PI, Math.PI / 2);
      back = [P(GU.binU + .4, GU.b2c + .75, z), P(GU.e0 - .2, GU.b2c + .75, z), P(GU.e0 - .2, GU.b1c, z)];
    }
    geo = { pos, fold, back };
  }

  function pathPoints(a, b) {
    const A = geo.pos[a], B = geo.pos[b];
    if (a === HALF - 1 && b === HALF) return [A, ...geo.fold, B];
    if (a === NT && b === -1) return [A, ...geo.back, B];
    return [A, B];
  }
  function along(pts, f) {
    const seg = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(d); L += d; }
    let want = f * L;
    for (let i = 0; i < seg.length; i++) {
      if (want <= seg[i] || i === seg.length - 1) {
        const g = seg[i] ? Math.min(1, want / seg[i]) : 1;
        return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * g, y: pts[i].y + (pts[i + 1].y - pts[i].y) * g };
      }
      want -= seg[i];
    }
    return pts[pts.length - 1];
  }

  const floatAt = {}, laneFloats = {};
  // one bend sign per lane (top or bottom): a new bend replaces it, a bend right after bumps its count
  const signUp = {};
  const SIGN_SHORT = { 'two of them': 'COPY' };
  function clearFloats() {
    board.querySelectorAll('.float').forEach((f) => f.remove());
    $('fx').innerHTML = '';   // bend arcs
    Object.keys(signUp).forEach((k) => { clearTimeout(signUp[k].timer); delete signUp[k]; });
  }
  function floatText(x, y, txt, cls) {
    cls = cls || '';
    const bend = / bend$/.test(txt) && /\bbend\b/.test(cls);
    const lane = /\bdn\b/.test(cls) ? 'dn' : 'up', up = signUp[lane];
    const now = performance.now();
    if (!bend && /\bk-/.test(cls) && up && up.el.isConnected) return;   // the sign is the louder event; the machine pop still shows the hit
    if (bend) {
      const raw = txt.replace(/ bend$/, ''), label = /^[x+]\d/.test(raw) ? raw : (SIGN_SHORT[raw] || raw.split(' ')[0]);
      if (up && up.el.isConnected && now - up.t < 250) {
        up.n++; up.t = now;
        up.el.querySelector('em').textContent = up.n;
        up.el.querySelector('em').style.display = '';
        clearTimeout(up.timer);
        up.el.style.animation = 'none'; void up.el.offsetWidth; up.el.style.animation = '';
        up.timer = setTimeout(() => up.el.remove(), 1400);
        return;
      }
      if (up) { clearTimeout(up.timer); up.el.remove(); }
      board.querySelectorAll('.float[data-lane="' + lane + '"]').forEach((o) => o.remove());   // clear machine floats already up in this lane
      const f = document.createElement('div');
      f.className = 'float ' + cls;
      f.innerHTML = `<span class="in"><b>${label}</b><i>bend</i><em style="display:none">1</em></span>`;
      f.style.left = x + 'px'; f.style.top = y + 'px';
      cam.appendChild(f);
      // fit: at most 46% of the board wide, type scales down, and never past the board edge
      const W = board.clientWidth, cap = W * .46, w = f.offsetWidth;
      if (w > cap) { const r = cap / w, fb = f.querySelector('b'), fi = f.querySelector('i'); fb.style.fontSize = (parseFloat(getComputedStyle(fb).fontSize) * r) + 'px'; fi.style.fontSize = Math.max(11, parseFloat(getComputedStyle(fi).fontSize) * r) + 'px'; }
      const half = f.offsetWidth / 2;
      f.style.left = Math.min(W - 4 - half, Math.max(4 + half, x)) + 'px';
      clearNames(f, lane);
      const rec = { el: f, t: now, n: 1 };
      rec.timer = setTimeout(() => f.remove(), 1400);
      signUp[lane] = rec;
      return;
    }
    const f = document.createElement('div');
    f.className = 'float ' + cls;
    f.textContent = SIGN_SHORT[txt] || txt;   // the Copier floats COPY, like its bend sign
    if (/\bk-/.test(cls)) f.dataset.lane = lane;
    // one float per lane spot: a new number replaces the last one there, so they never stack
    const key = Math.round(x) + ',' + Math.round(y), live = floatAt[key];
    if (live && live.isConnected) live.remove();
    floatAt[key] = f;
    // a neighbour still up within 28 px in this lane: step 14 px further out (up in the top lane, down in the bottom), at most 2 steps;
    // all 3 spots taken, the oldest goes
    const L = (laneFloats[lane] = (laneFloats[lane] || []).filter((o) => o.el.isConnected));
    const near = L.filter((o) => Math.abs(o.x - x) < 28);
    let step = [0, 1, 2].find((n) => !near.some((o) => o.step === n));
    if (step === undefined) { const old = near[0]; old.el.remove(); L.splice(L.indexOf(old), 1); step = old.step; }
    L.push({ el: f, x, step });
    f.style.left = x + 'px'; f.style.top = (y + (lane === 'dn' ? 1 : -1) * step * 14) + 'px';
    cam.appendChild(f);
    const W = board.clientWidth, half = f.offsetWidth / 2;
    f.style.left = Math.min(W - 4 - half, Math.max(4 + half, x)) + 'px';   // big bin numbers stay on screen
    if (!/\bagain\b/.test(cls)) clearNames(f, lane);
    setTimeout(() => f.remove(), 1100);
  }
  // a two line belt name grows into the float lane; nudge a float out past any name it would cover (offset boxes, so the cam transform and the pop-in scale don't skew it)
  function clearNames(f, lane) {
    const fw = f.offsetWidth, fh = f.offsetHeight, fx = parseFloat(f.style.left), fy = parseFloat(f.style.top);
    const l = fx - fw / 2, r = fx + fw / 2, top = lane === 'dn' ? fy : fy - fh, bot = top + fh;
    let dy = 0;
    $('names').querySelectorAll(lane === 'dn' ? '.bn:not(.up):not(.end)' : '.bn.up').forEach((n) => {
      const w = n.offsetWidth, h = n.offsetHeight, nl = n.offsetLeft - w / 2, nt = n.classList.contains('up') ? n.offsetTop - h : n.offsetTop;
      if (nl + w < l || nl > r) return;
      if (lane === 'dn') { if (nt < bot && nt + h + 6 > top) dy = Math.max(dy, nt + h + 6 - top); }
      else if (nt + h > top && nt - 6 < bot) dy = Math.min(dy, nt - 6 - bot);
    });
    if (dy) f.style.top = (lane === 'dn' ? Math.min(board.clientHeight - fh - 2, fy + dy) : Math.max(fh + 2, fy + dy)) + 'px';   // never past the board edge
  }
  function pulse(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  function setItemLook(el, p) {
    if (el.classList.contains('done')) return;
    const look = p.t === 'gear' && el.dataset.ram ? 'ram' : p.t;   // a chip the Board assembler worked ships as a RAM stick
    const morph = el.dataset.t && el.dataset.t !== look;
    if (el.dataset.t !== look) { el.querySelector('.shape').innerHTML = ITEM[look]; el.dataset.t = look; }
    el.className = 'item ' + p.t + (p.n > 1 ? ' multi' : '') + (morph ? ' morph' : '');
    el.querySelector('.val').textContent = fmt(p.v);
    el.querySelector('.n').textContent = 'x' + p.n;
  }

  // Run view: the hand slides away while the line runs and the board takes its room. The floor is laid out for the
  // new box at once (so taps and item paths are exact), then the cam layer eases from the old framing to the new one.
  let camEnd = 0;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  function runView(on) {
    const wrap = handEl.parentNode;
    if (wrap.classList.contains('runview') === on) return;
    const old = { ...Lg };
    if (on) handEl.style.top = handEl.offsetTop + 'px';   // pinned where it sat, so it slides from there
    handEl.classList.remove('back');
    handEl.classList.toggle('away', on);
    wrap.classList.toggle('runview', on);
    if (!on) { handEl.style.top = ''; void handEl.offsetWidth; handEl.classList.add('back'); }
    lastBox = board.clientWidth + 'x' + board.clientHeight;   // the ResizeObserver would refit with a jump; do it here instead
    layoutFloor(); if (S) render(); if (S && S.busy) measure();
    // signs still up when the board eases back would hang past the smaller box: fade them out quickly instead
    cam.querySelectorAll('.float').forEach((f) => { f.animate([{ filter: 'opacity(1)' }, { filter: 'opacity(0)' }], { duration: 160, fill: 'forwards' }).onfinish = () => f.remove(); });
    $('fx').innerHTML = '';
    if (calm.matches) return;
    const r = old.s / Lg.s, tx = old.ox - Lg.ox * r, ty = old.oy - Lg.oy * r;
    if (Math.abs(r - 1) < .003 && Math.abs(tx) < .5 && Math.abs(ty) < .5) return;
    cam.style.transition = 'none';
    cam.style.transform = `translate(${tx}px,${ty}px) scale(${r})`;
    void cam.offsetWidth;
    cam.style.transition = 'transform .5s cubic-bezier(.3,.6,.2,1)';
    cam.style.transform = '';
    const end = ++camEnd;
    setTimeout(() => { if (end === camEnd) cam.style.transition = ''; }, 520);
  }

  let speedUp = false;
  function pull() {
    if (S.busy) { speedUp = true; lever.classList.add('on'); return; }
    S.busy = true; window.__combo = 0; S.sel = -1; speedUp = false;
    render();
    say('');
    runView(true);
    setTimeout(() => { if (S && S.busy && !$('status').innerHTML) say('Running the line...'); }, 200);   // after the cards clear
    measure();
    const res = E.simulatePull(S.belt, { noBends: S.R.noBends, ore: S.R.ore, minWorth: S.R.minWorth, bends: bendsNow() });
    Object.keys(res.work).forEach((id) => { S.work[id] = (S.work[id] || 0) + res.work[id]; });
    if (res.best && (!S.bestItem || res.best.v > S.bestItem.v)) S.bestItem = { ...res.best, shift: S.shift };
    board.classList.add('running');
    layer.innerHTML = '';
    const items = res.items.map((it) => {
      const el = document.createElement('div');
      el.innerHTML = '<div class="shape"></div><div class="val"></div><div class="n"></div><div class="lap"></div>';
      setItemLook(el, it.track[0]);
      el.style.opacity = 0;
      layer.appendChild(el);
      return { it, el, j: -1 };
    });
    // keep a normal pull around 8 to 10 seconds, longer lines run a little faster
    const baseMs = Math.max(120, Math.min(260, 9000 / (res.endTick + 1)));
    board.style.setProperty('--cleat', (baseMs * .25) + 'ms');
    let tick = -0.5, last = performance.now(), pullSum = 0;
    const pt = $('pullTotal');
    pt.classList.add('live');
    pt.textContent = '+0 this run';

    function fire(o, p) {
      // floats sit in clear floor lanes: behind the back row, in front of the front row
      const F = p.pos >= 0 && p.pos < NT ? G2.fl[p.pos] : p.pos === NT ? G2.fl.bin : G2.fl.hop;
      const dn = F.dn ? ' dn' : '';
      if (p.pos >= 0 && p.pos < NT) {
        sfx('land', { pos: p.pos, t: p.t });
        p.fx.forEach((fx, i) => {
          setTimeout(() => {
            const src = tiles[fx.from];
            if (fx.reach) {
              pulse(src, 'reach'); window.__combo = (window.__combo || 0) + 1; sfx('bend', { id: S.belt[fx.from], combo: window.__combo, txt: fx.txt });
              const band = document.querySelector(`.band[data-pair="${Math.min(fx.from, res.bends[fx.from])}"]`);
              if (band) pulse(band, 'flash');
              bendArc(fx.from, geo.pos[p.pos]);
              floatText(F.x, F.y, fx.txt + ' bend', 'bend' + dn);
              S.bendTotal++;
              if (window.ConveyorIntro) ConveyorIntro.tip('bend');   // INTRO hook: first bend, once per browser
              if (!S.bendSeen) {
                S.bendSeen = true;
                S.firstBend = S.shift;
                say(`<b>Bend.</b> The ${nm(S.belt[fx.from])} reached across the fold and worked that item a second time.`);
              }
            } else {
              pulse(src, 'pop'); sfx('machine', { id: S.belt[fx.from], kind: C[S.belt[fx.from]].kind, txt: fx.txt, to: fx.t });
              floatText(F.x, F.y, fx.txt, 'k-' + C[S.belt[fx.from]].kind + dn);
            }
            if (S.belt[fx.from] === 'assembler' && fx.t === 'gear') o.el.dataset.ram = '1';
            setItemLook(o.el, fx);
          }, i * 140 * (speedUp ? 0.3 : 1));
        });
        if (!p.fx.length) setItemLook(o.el, p);
      } else if (p.pos === NT) {
        if (p.final) {
          pullSum += o.it.worth; sfx('bin', { worth: o.it.worth });
          o.el.classList.add('done');
          o.el.style.opacity = 0;
          floatText(F.x, F.y, p.tooSmall ? 'too small' : '+' + fmt(o.it.worth), (p.tooSmall ? 'plain' : 'bin') + dn);
          pt.textContent = '+' + fmt(pullSum) + ' this run';
          pulse(pt, 'bump');
          setTotal(S.total + pullSum);
          pulse($('total'), 'bump');
          pulse($('binBox'), 'bump');
        } else {
          floatText(F.x, F.y, 'again', 'again');
        }
      } else if (p.pos === -1) {
        o.el.style.opacity = 1;
        if (p.again) {   // back from Shipping for another lap: count it on the item
          o.lap = (o.lap || 1) + 1;
          const lp = o.el.querySelector('.lap'); lp.textContent = 'lap ' + o.lap; lp.style.display = 'block';
          pulse(lp, 'bump');
        }
      }
    }

    function frame(now) {
      const dt = Math.min(64, now - last); last = now;
      tick += dt / (speedUp ? 55 : baseMs);
      let alive = false;
      items.forEach((o) => {
        const tr = o.it.track;
        while (o.j + 1 < tr.length && tr[o.j + 1].tick <= tick) { o.j++; fire(o, tr[o.j]); }
        if (o.j < 0) { alive = true; return; }
        if (o.j >= tr.length - 1) return;
        alive = true;
        const a = tr[o.j], b = tr[o.j + 1];
        let pt2;
        pt2 = along(pathPoints(a.pos, b.pos), (tick - a.tick) / (b.tick - a.tick));
        o.el.style.transform = `translate(${pt2.x}px,${pt2.y}px)`;
      });
      if (alive) requestAnimationFrame(frame);
      else setTimeout(() => endPull(res, pullSum), 650);
    }
    requestAnimationFrame(frame);
  }

  function endPull(res, pullSum) {
    board.classList.remove('running');
    S.total += pullSum;
    S.bestPull = Math.max(S.bestPull, pullSum);
    const L = S.log[S.log.length - 1];
    L.total = S.total; L.best = Math.max(L.best, pullSum);
    setTotal(S.total);
    if (S.pull < S.R.pulls) { nextPull(); runView(false); return; }
    S.busy = false;
    render();
    runView(false);
    say(S.total >= S.quota ? 'Order met.' : 'Order missed.');
    sfx(S.total >= S.quota ? 'quota' : 'fail', {});
    if (S.total >= S.quota) shiftWon(); else runLost();
  }

  // ---------- between shifts ----------
  function sheet(html) { clearFloats(); $('sheet').innerHTML = html; $('veil').classList.add('on'); }   // no sign pokes out from behind a sheet
  function closeSheet() { $('veil').classList.remove('on'); }

  // Long contract: at shift end, pick up to 2 machines to bolt down for the next shift (a second copy makes it 3).
  // The contract itself can't be bolted, so it never chains. sim: about half the old whole-belt boost.
  const keepLimit = () => { const n = S.belt.filter((id) => id === 'boltgun').length; return n ? Math.min(3, 1 + n) : 0; };
  function shiftWon() {
    const lim = keepLimit(), can = S.belt.some((id) => id && id !== 'boltgun');
    if (lim && can) { clearFloats(); S.keep = { lim, picked: [] }; render(); keepSay(); return; }
    S.kept = null;
    afterKeep();
  }
  function keepSay() {
    const n = S.keep.picked.length;
    say(`<b>Long contract.</b> Tap up to ${S.keep.lim} machines to bolt down for next shift. ${n ? `${n} bolted.` : ''} Then tap Keep.`);
  }
  function tapKeep(k) {
    const id = S.belt[k], P = S.keep.picked, i = P.indexOf(k);
    if (!id || id === 'boltgun') { say('The Long contract keeps machines, not itself. Tap another machine.'); return; }
    if (i >= 0) P.splice(i, 1); else if (P.length < S.keep.lim) P.push(k); else { say(`Up to ${S.keep.lim}. Tap a bolted one to free it first.`); return; }
    render(); keepSay();
  }
  function finishKeep() {
    const P = S.keep.picked;
    S.kept = P.length ? S.belt.map((id, k) => P.includes(k) ? id : null) : null;
    S.keep = null;
    render();
    afterKeep();
  }
  function afterKeep() {
    // the Duplicator eats one random card per copy that was on the belt, never one bolted to the belt
    const eaten = [];
    S.belt.forEach((id) => {
      if (id !== 'duplicator') return;
      const free = minus(S.deck, S.kept ? S.kept.filter(Boolean) : []);
      const pool = free.filter((c) => c !== 'duplicator');
      if (!pool.length) return;
      const gone = pool[Math.floor(Math.random() * pool.length)];
      S.deck.splice(S.deck.indexOf(gone), 1);
      eaten.push(gone);
    });
    S.log[S.log.length - 1].eaten = eaten;
    S.offer = E.offer(Math.random, !!S.R.boss || S.shift === 2, S.layout.tiles < E.MAX_TILES && !S.layout.straight, S.layout.straight && S.shift < 2);
    S.eatenNote = eaten.length ? `<p>The Copier ate ${eaten.map((id) => 'a ' + nm(id)).join(' and ')} from your deck.</p>` : '';
    rewardSheet();
  }

  function rewardSheet() {
    const L = S.log[S.log.length - 1];
    const nextBoss = bossFor(S.shift + 1);
    const nextR = E.shiftRules(S.shift + 1, nextBoss, Math.random, S.layout.tiles, S.layout.straight && S.shift + 1 < 3, S.layout.q);
    // a boss next: the same striped box as the quota panel, not a sentence
    const nextLine = nextBoss ? '' : ` Next order: <b>${fmt(nextR.quota)}</b>.`;
    const nextBox = nextBoss ? `<div class="rule nextboss"><div class="boss"><span class="bk">Next, order ${fmt(nextR.quota)}</span><b>${bossNm(nextBoss)}</b><span class="bl">${bossRule(nextBoss, nextR)}</span></div></div>` : '';
    sheet(`
      <div class="kicker">Shift ${S.shift} done${S.R.boss ? ', boss beaten' : ''}</div>
      <h2 class="met">Order met: ${fmt(S.total)} of ${fmt(S.quota)}</h2>
      <p class="aside">Order shipped. They already sent the next one.</p>
      ${S.eatenNote}
      ${S.kept ? `<p>The Long contract keeps ${plural(S.kept.filter(Boolean).length, 'bolted machine')} for next shift.</p>` : ''}
      <p>Add one machine to your deck.${nextLine}</p>${nextBox}
      <div class="opts">${S.offer.map((id) => `<button class="${cardClass(id)}" data-add="${id}" title="${cardTitle(id)}">${cardHTML(id)}</button>`).join('')}</div>
      <div class="row"><button class="ghost" id="scrapBtn">Scrap a card instead</button><button class="ghost" id="skipBtn">Skip</button></div>
    `);
    if (S.offer.includes('recycler') && window.ConveyorIntro) ConveyorIntro.tip('loop');   // INTRO hook: first Returns desk offer, once per browser
    document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.add;
      if (EXT[id]) {   // a belt extension: one more column at the fold, kept machines move with their tiles
        S.layout = E.extendLayout(S.layout, id === 'extbend');
        if (S.kept) S.kept = E.remapBelt(S.kept);
        L.extended = id;
      } else { S.deck.push(id); L.picked = id; }
      closeSheet(); startShift();
    }));
    $('skipBtn').addEventListener('click', () => { closeSheet(); startShift(); });
    $('scrapBtn').addEventListener('click', scrapSheet);
  }

  function scrapSheet() {
    const L = S.log[S.log.length - 1];
    const free = minus(S.deck, S.kept ? S.kept.filter(Boolean) : []);
    const sorted = free.map((id, i) => ({ id, i })).sort((a, b) => nm(a.id).localeCompare(nm(b.id)));
    sheet(`
      <div class="kicker">Scrap a card</div>
      <h2>Pick one to take out of your deck</h2>
      <p>Fewer cards means your best machines come up more often.${S.kept ? ' Machines held by the Long contract are not listed.' : ''}</p>
      <div class="deckgrid">${sorted.map((o) => `<button class="${cardClass(o.id)}" data-id="${o.id}" title="${cardTitle(o.id)}">${cardHTML(o.id)}</button>`).join('')}</div>
      <div class="row"><button class="ghost" id="backBtn">Back</button></div>
    `);
    document.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => { S.deck.splice(S.deck.indexOf(b.dataset.id), 1); L.scrapped = b.dataset.id; closeSheet(); startShift(); }));
    $('backBtn').addEventListener('click', rewardSheet);
  }

  // ---------- the story of the run ----------
  const TYPE = { ore: 'scoop of sand', ingot: 'piece of silicon', plate: 'wafer', gear: 'chip' };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  function storyOf() {
    const cleared = S.shift - 1;
    const bossesBeaten = S.log.filter((l) => l.boss && l.total >= l.quota).length;
    const bestShift = S.log.reduce((a, l) => (l.best > (a ? a.best : -1) ? l : a), null);
    const top = Object.keys(S.work).sort((a, b) => S.work[b] - S.work[a])[0];
    const picks = S.log.map((l) => l.picked).filter(Boolean);
    const rares = picks.filter((id) => C[id].rar === 'r');
    const last = S.log[S.log.length - 1];
    const short = Math.round((1 - last.total / last.quota) * 100);
    const lines = [];
    lines.push(`Your line: ${S.layout.name}${S.layout.ext ? `, grown to ${S.layout.tiles} tiles` : `, ${S.layout.tiles} tiles`}.`);
    lines.push(cleared
      ? `You kept the job for ${plural(cleared, 'shift')}${bossesBeaten ? `, ${plural(bossesBeaten, 'boss shift')} included` : ''}.`
      : 'You did not make it through the first shift.');
    if (bestShift && bestShift.best) lines.push(`Your best run was ${fmt(bestShift.best)} on shift ${bestShift.shift}.`);
    if (top) lines.push(`The ${nm(top)} did the most work: ${fmt(S.work[top])} items.`);
    lines.push(S.bendTotal
      ? `Bends worked ${fmt(S.bendTotal)} items a second time, starting on shift ${S.firstBend}.`
      : 'You never got a bend to work.');
    if (S.bestItem) lines.push(`The biggest single item was ${/^[aeiou]/.test(TYPE[S.bestItem.t]) ? 'an' : 'a'} ${TYPE[S.bestItem.t]} worth ${fmt(S.bestItem.v)}${S.bestItem.n > 1 ? `, and you had ${S.bestItem.n} of them` : ''}.`);
    if (rares.length) lines.push(`Rares you took: ${rares.map((id) => nm(id)).join(', ')}.`);
    lines.push(`${last.boss ? `The boss shift, ${bossNm(last.boss)}, ended it` : `Shift ${last.shift} ended it`}: ${fmt(last.total)} of ${fmt(last.quota)}, ${short}% short.`);
    return lines;
  }

  function runLost() {
    const mins = Math.max(1, Math.round((Date.now() - S.started) / 60000));
    const reached = S.shift - 1;
    const newBest = reached > stats.best;
    stats.best = Math.max(stats.best, reached);
    stats.history.unshift({ run: S.run, cleared: reached, mins, bestPull: S.bestPull, bends: S.bendTotal,
      picks: S.log.map((l) => l.picked).filter(Boolean), layout: S.layout.id, tiles: S.layout.tiles, at: new Date().toISOString() });
    stats.history = stats.history.slice(0, 20);
    saveStats(stats);
    const rows = S.log.map((l) => {
      const pct = Math.min(100, l.total / l.quota * 100);
      const note = [l.boss ? bossNm(l.boss) : '', l.picked ? '+ ' + nm(l.picked) : '', l.extended ? '+ ' + EXT[l.extended][0].toLowerCase() : '', l.scrapped ? '- ' + nm(l.scrapped) : '',
        (l.eaten || []).length ? 'Copier ate ' + l.eaten.map((id) => nm(id)).join(', ') : ''].filter(Boolean).join(' · ');
      return `<div class="srow${l.total >= l.quota ? '' : ' lost'}">
        <span class="sn">${l.shift}</span>
        <span class="sm"><span class="sb"><i style="width:${pct}%"></i></span><span class="st">${note || '&nbsp;'}</span></span>
        <span class="sv">${fmt(l.total)}<small> / ${fmt(l.quota)}</small></span></div>`;
    }).join('');
    // picture and numbers first: one result line, one dry line, four tiles; the story waits behind "See the run"
    const last = S.log[S.log.length - 1];
    const top = Object.keys(S.work).sort((a, b) => S.work[b] - S.work[a])[0];
    const shipped = S.log.reduce((a, l) => a + l.total, 0);
    const best = S.log.reduce((a, l) => Math.max(a, l.best || 0), 0);
    const clock = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    const peak = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16M6 16v-4M10 16V9M14 16V5M18 16v-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    sheet(`
      <div class="kicker">Job ${S.run} over · let go on shift ${S.shift}</div>
      <h2 class="miss">Order missed: ${fmt(last.total)} of ${fmt(last.quota)}</h2>
      <p class="endline">${ENDS[S.run % ENDS.length]}</p>
      <div class="etiles">
        <div class="et"><span class="ei">${clock}</span><b>${reached}</b><span>${reached === 1 ? 'shift' : 'shifts'} lasted${newBest ? ' <i>new best</i>' : ''}</span></div>
        <div class="et"><span class="ei">${peak}</span><b>${fmt(best)}</b><span>best run</span></div>
        <div class="et"><span class="ei art">${top ? cardArt(top) : ''}</span><b class="nm">${top ? nm(top) : 'None'}</b><span>top machine</span></div>
        <div class="et"><span class="ei">${ITEM.ram}</span><b>${fmt(shipped)}</b><span>RAM sticks shipped</span></div>
      </div>
      <details class="more"><summary>See the run</summary>
        <div class="story">${storyOf().map((l) => `<p>${l}</p>`).join('')}</div>
        <div class="shifts">${rows}</div>
        <p>${mins} min this job. Best ever: <b>${plural(stats.best, 'shift')}</b>.</p>
      </details>
      <button class="primary big" id="againBtn">New job</button>
    `);
    $('againBtn').addEventListener('click', () => { closeSheet(); newRun(); });
  }

  const HELP = `
    <ul>
      <li>Each shift has <b>3 runs</b>. Before each run you draw 5 machine cards. Place any of them on the belt. Placed machines stay until the shift ends.</li>
      <li>Press <b>Run</b> and <b>5 scoops of sand</b> roll down the belt. Each machine only works on its own type, so the order of the line is the plan.</li>
      <li>Sand can become silicon, silicon can become wafers, wafers can become chips.</li>
      <li>Whatever reaches Shipping counts. Fill the <b>order</b> by the end of the 3rd run or the job is over.</li>
      <li>Tiles with hazard stripes between them are <b>bends</b>. They face each other across the fold.</li>
      <li>Between shifts, add a machine to your deck or scrap one.</li>
      <li>Every third shift is a <b>boss shift</b> with one twist rule. Beat it for a rare.</li>
    </ul>`;

  function startSheet() {
    const h = stats.history[0];
    // INTRO hook: picture intro on a fresh first visit, else the short start sheet
    if (window.ConveyorIntro) return ConveyorIntro.start({ sheet, fresh: stats.runs === 0, job: stats.runs + 1,
      line: `${stats.best ? `Best so far: <b>${stats.best} shifts</b>.` : ''}${h ? ` Last job: ${h.cleared} shifts in ${h.mins} min.` : ''}`,
      go: () => { closeSheet(); newRun(); } });
    sheet(`
      <h2>Overclock</h2>
      <p>You run the night shift at a RAM fab. Lay machines on the belt, press Run, fill the order.</p>
      ${HELP}
      <p>Job <b>${stats.runs + 1}</b>${stats.best ? `. Best so far: <b>${stats.best} shifts</b>` : ''}${h ? `. Last job: ${h.cleared} shifts in ${h.mins} min` : ''}.</p>
      <div class="row"><button class="primary" id="goBtn">Start shift 1</button></div>
    `);
    $('goBtn').addEventListener('click', () => { closeSheet(); newRun(); });
  }

  function helpSheet() {
    // INTRO hook: the illustrated rules from intro.js; HELP stays as the fallback
    sheet(`<h2>How it works</h2>${window.ConveyorIntro ? ConveyorIntro.help() : HELP}<p class="fine">Company names are used for fun. Not affiliated with or endorsed by any of them.</p><div class="row"><button class="primary" id="okBtn">Got it</button><button class="ghost" id="resetBtn">Replay the first job</button></div>`);
    $('okBtn').addEventListener('click', closeSheet);
    // for testing: the next job starts straight again and the one-time tips show again
    $('resetBtn').addEventListener('click', () => { stats.seenFold = false; saveStats(stats); try { localStorage.removeItem('conveyor.tips'); } catch (e) {} closeSheet(); say('The next job starts on a straight belt again.'); });
  }

  function deckSheet() {
    const count = (arr) => {
      const m = {}; arr.forEach((id) => (m[id] = (m[id] || 0) + 1));
      return Object.keys(m).sort((a, b) => nm(a).localeCompare(nm(b))).map((id) => `<div><span>${nm(id)}</span><b>${m[id]}</b></div>`).join('') || '<div><span>Empty</span></div>';
    };
    sheet(`
      <h2>Deck</h2>
      <p>Whole deck: ${S.deck.length} cards.</p>
      <div class="kicker">Still to draw this shift (${S.draw.length})</div>
      <div class="list">${count(S.draw)}</div>
      <div class="kicker">Used this shift (${S.discard.length})</div>
      <div class="list">${count(S.discard)}</div>
      <button class="primary" id="okBtn">Close</button>
    `);
    $('okBtn').addEventListener('click', closeSheet);
  }

  // ---------- wire up ----------
  buildBoard();
  lever.addEventListener('click', () => { if (!S || $('veil').classList.contains('on')) return; if (S.keep) finishKeep(); else pull(); });
  board.addEventListener('click', () => { if (S && S.busy) { speedUp = true; lever.classList.add('on'); } });
  $('helpBtn').addEventListener('click', helpSheet);
  $('deckBtn').addEventListener('click', () => { if (S) deckSheet(); });
  const relayout = () => { layoutFloor(); if (S) render(); if (S && S.busy) measure(); };
  window.addEventListener('resize', relayout);
  // the board box changes height when the panel grows (boss card) or the hand changes; refit the camera then
  let lastBox = '';
  new ResizeObserver(() => { const k = board.clientWidth + 'x' + board.clientHeight; if (k !== lastBox) { lastBox = k; relayout(); } }).observe(board);
  document.querySelector('.quota').addEventListener('click', () => showTipAt(tipIdx, false));

  // INTRO hook: lets intro.js draw with the game's own art. withCam swaps the iso camera for one call.
  const withCam = (cam, fn) => { const keep = Lg; Lg = cam; try { return fn(); } finally { Lg = keep; } };
  window.ConveyorArt = { P, GU, AX, gmat, pts, f1, shade, isoView, flatView, drawParts, ITEM, cardHTML, cardClass, cardBack, beltSVG, withCam, bossNm, bossRule, nm, STEEL, DSTEEL };

  // empty board behind the start sheet
  S = { run: stats.runs + 1, shift: 1, pull: 1, quota: E.quotaFor(1), R: E.shiftRules(1, null), total: 0, belt: Array(10).fill(null), fresh: {}, hand: [], draw: [], sel: -1 };
  render();
  S = null;
  startSheet();
})();
