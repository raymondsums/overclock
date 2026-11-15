// Conveyor engine. Pure rules, no DOM. Loaded by index.html and by sim.js in node.
(function (root) {
  const TILES = 10;
  // The belt is always a folded U: the top row runs left to right, folds, and the bottom row comes back right to left.
  // With N tiles, tile k on the top row faces tile N-1-k across the fold. A bend pair is one of those columns:
  // a machine on a bend also works the tile across.
  // Layouts: one is picked at random for each job. cols are the top-row columns that are bends.
  const LAYOUTS = {
    // q: order size for this line, so the four feel about as hard as each other (sim.js)
    standard: { name: 'Standard line', tiles: 10, cols: [1, 3],    q: 1 },
    tight:    { name: 'Tight line',    tiles: 8,  cols: [1, 2],    q: .75 },
    long:     { name: 'Long line',     tiles: 14, cols: [3],       q: 1 },
    double:   { name: 'Double fold',   tiles: 12, cols: [0, 2, 4], q: 1.25 },
  };
  const MAX_TILES = 14;
  // The first job ever starts straight (no fold, no bends) for shifts 1 and 2, then folds into the standard U.
  // Not in LAYOUTS, so a random pick never lands on it.
  const STRAIGHT = { name: 'Straight line', tiles: 10, cols: [], straight: true };
  const STRAIGHT_QUOTA = 0.5;   // sim: a weak player ends the first job by shift 2 about 9% of the time, a little gentler than a normal job
  const layout = (id) => {
    const L = id === 'straight' ? STRAIGHT : LAYOUTS[id];
    return { id, name: L.name, tiles: L.tiles, cols: L.cols.slice(), straight: !!L.straight, q: L.q || 1 };
  };
  function bendsOf(L) {
    const m = {};
    L.cols.forEach((c) => { const d = L.tiles - 1 - c; m[c] = d; m[d] = c; });
    return m;
  }
  function wideOf(n) { const m = {}; for (let k = 0; k < n; k++) m[k] = n - 1 - k; return m; }
  // A belt extension adds one column at the fold end: a top tile and the bottom tile across from it.
  // withBend makes that new column a bend pair. Returns the new layout; remapBelt moves placed machines to match.
  function extendLayout(L, withBend) {
    const h = L.tiles / 2;
    return { id: L.id, name: L.name, tiles: L.tiles + 2, cols: withBend ? L.cols.concat([h]) : L.cols.slice(), ext: (L.ext || 0) + 1, q: L.q || 1 };
  }
  function remapBelt(belt) {
    const h = belt.length / 2;
    return belt.slice(0, h).concat([null, null], belt.slice(h));
  }
  const BENDS = bendsOf(LAYOUTS.standard);
  const WIDE = wideOf(TILES);
  const GAP = 2; // ticks between ore leaving the hopper
  const ORE_PER_PULL = 5;
  const PULLS_PER_SHIFT = 3;
  const HAND = 5;
  const QUOTAS = [200, 400, 600, 1200, 2000, 3000, 5000, 8000, 12000, 18000];
  const quotaFor = (shift) => shift <= QUOTAS.length ? QUOTAS[shift - 1] : Math.round(QUOTAS[QUOTAS.length - 1] * Math.pow(1.5, shift - QUOTAS.length) / 1000) * 1000;

  const METAL = { ingot: 1, plate: 1, gear: 1 };

  // kind: change (turns one type into another), add, mult, special. rar: c, u, r.
  const CARDS = {
    // ore
    crusher:   { name: 'Crusher',   rar: 'c', kind: 'add',    text: 'Ore +2',
                 work: (it) => it.t === 'ore' ? (it.v += 2, '+2') : null },
    washer:    { name: 'Washer',    rar: 'c', kind: 'mult',   text: 'Ore x2',
                 work: (it) => it.t === 'ore' ? (it.v *= 2, 'x2') : null },
    smelter:   { name: 'Smelter',   rar: 'c', kind: 'change', text: 'Ore into ingot, +3',
                 work: (it) => it.t === 'ore' ? (it.t = 'ingot', it.v += 3, '+3') : null },
    furnace:   { name: 'Furnace',   rar: 'u', kind: 'change', text: 'Ore into ingot, +8',
                 work: (it) => it.t === 'ore' ? (it.t = 'ingot', it.v += 8, '+8') : null },
    // ingot
    caster:    { name: 'Caster',    rar: 'c', kind: 'add',    text: 'Ingot +4',
                 work: (it) => it.t === 'ingot' ? (it.v += 4, '+4') : null },
    press:     { name: 'Press',     rar: 'c', kind: 'change', text: 'Ingot into plate, x2',
                 work: (it) => it.t === 'ingot' ? (it.t = 'plate', it.v *= 2, 'x2') : null },
    annealer:  { name: 'Annealer',  rar: 'u', kind: 'mult',   text: 'Ingot x3',
                 work: (it) => it.t === 'ingot' ? (it.v *= 3, 'x3') : null },
    // plate
    coater:    { name: 'Coater',    rar: 'c', kind: 'mult',   text: 'Plate x2',
                 work: (it) => it.t === 'plate' ? (it.v *= 2, 'x2') : null },
    stamper:   { name: 'Stamper',   rar: 'u', kind: 'add',    text: 'Plate +10',
                 work: (it) => it.t === 'plate' ? (it.v += 10, '+10') : null },
    cutter:    { name: 'Cutter',    rar: 'u', kind: 'change', text: 'Plate into gear, x3',
                 work: (it) => it.t === 'plate' ? (it.t = 'gear', it.v *= 3, 'x3') : null },
    // gear
    tempering: { name: 'Temper',    rar: 'u', kind: 'mult',   text: 'Gear x2',
                 work: (it) => it.t === 'gear' ? (it.v *= 2, 'x2') : null },
    assembler: { name: 'Assembler', rar: 'u', kind: 'add',    text: 'Gear +25',
                 work: (it) => it.t === 'gear' ? (it.v += 25, '+25') : null },
    gearbox:   { name: 'Gearbox',   rar: 'u', kind: 'mult',   text: 'Gear x2 for each Cutter on the belt',
                 work: (it, ctx) => it.t === 'gear' && ctx.count.cutter ? (it.v *= Math.pow(2, ctx.count.cutter), 'x' + Math.pow(2, ctx.count.cutter)) : null },
    // any
    roller:    { name: 'Roller',    rar: 'c', kind: 'add',    text: 'Anything +1',
                 work: (it) => (it.v += 1, '+1') },
    polisher:  { name: 'Polisher',  rar: 'c', kind: 'mult',   text: 'Ingot, plate or gear x2',
                 work: (it) => METAL[it.t] ? (it.v *= 2, 'x2') : null },
    oiler:     { name: 'Oiler',     rar: 'u', kind: 'add',    text: 'Anything +1 for each machine on the belt',
                 work: (it, ctx) => (it.v += ctx.machines, '+' + ctx.machines) },
    tally:     { name: 'Tally',     rar: 'u', kind: 'add',    text: 'Anything +3 for each machine that already worked it',
                 work: (it) => it.passed ? (it.v += 3 * it.passed, '+' + 3 * it.passed) : null },
    inspector: { name: 'Inspector', rar: 'u', kind: 'mult',   text: 'Anything x2, only when it sits on a bend',
                 work: (it, ctx) => ctx.onBend ? (it.v *= 2, 'x2') : null },
    duplicator:{ name: 'Duplicator',rar: 'u', kind: 'mult',   text: 'One item becomes two. Eats a deck card each shift',
                 work: (it) => (it.n *= 2, 'two of them') },
    // rares: rule benders
    recycler:  { name: 'Recycler',  rar: 'r', kind: 'special',text: 'Everything that reaches the bin goes round once more',
                 laps: 1, work: () => null },
    overclock: { name: 'Overclock', rar: 'r', kind: 'mult',   text: 'x3 to anything worth 20 or more',
                 work: (it) => it.v >= 20 ? (it.v *= 3, 'x3') : null },
    hopper:    { name: 'Big Hopper',rar: 'r', kind: 'special',text: '3 more ore each pull',
                 ore: 3, work: () => null },
    widefold:  { name: 'Wide Fold', rar: 'r', kind: 'special',text: 'Every tile is a bend',
                 wide: true, work: () => null },
    nightcrew: { name: 'Night Crew',rar: 'r', kind: 'special',text: 'Draw 7 cards each pull while this is on the belt',
                 draw: 7, work: () => null },
    boltgun:   { name: 'Bolt Gun',  rar: 'r', kind: 'special',text: 'At shift end, keep up to 2 machines for the next shift (3 with two copies)',
                 bolt: true, work: () => null },
    richseam:  { name: 'Rich Seam', rar: 'r', kind: 'special',text: 'Ore comes in worth 5, not 1',
                 rich: 4, work: () => null },
  };

  const STARTER = ['smelter', 'smelter', 'smelter', 'press', 'press', 'polisher',
                   'roller', 'roller', 'roller', 'roller', 'crusher', 'duplicator'];

  // Boss shifts every third shift. Each bends one rule for that shift only. Boss quota is 80% of normal unless quotaMul says otherwise.
  const BOSSES = {
    powercut:   { name: 'Power cut',     text: 'Only 2 pulls this shift.', pulls: 2 },
    straight:   { name: 'Straight belt', text: 'Bends do nothing this shift.', noBends: true },
    shorthand:  { name: 'Short staffed', text: 'Draw 4 cards each pull.', draw: 4 },
    jam:        { name: 'Jammed tiles',  text: 'Two tiles are blocked this shift.', jam: 2 },
    inspection: { name: 'Inspection',    text: 'Items worth less than {min} count for nothing.', minFrac: 1 / 60 },
    shortage:   { name: 'Ore shortage',  text: 'Only 3 ore per pull.', ore: 3 },
    newmodel:   { name: 'New model launch', text: 'This order is 30% bigger.', quotaMul: 1.3 },
  };
  const isBoss = (shift) => shift % 3 === 0;

  const snap = (it) => ({ t: it.t, v: it.v, n: it.n });

  function bendMap(belt, opts) {
    if (opts && opts.noBends) return {};
    if (belt.some((id) => id && CARDS[id].wide)) return wideOf(belt.length);
    return (opts && opts.bends) || (belt.length === TILES ? BENDS : bendsOf({ tiles: belt.length, cols: [] }));
  }

  // Runs one pull. belt: array of card ids or null, one per tile (any even length).
  // opts: { noBends, ore (base ore count), minWorth, bends (map from bendsOf; the standard pairs if left out) }
  // Returns every item's track: points {pos, tick, t, v, n, fx[]}. pos -1 hopper, 0..N-1 tiles, N bin.
  function simulatePull(belt, opts) {
    opts = opts || {};
    const N = belt.length;
    const count = {};
    belt.forEach((id) => { if (id) count[id] = (count[id] || 0) + 1; });
    const bends = bendMap(belt, opts);
    const ctx = { machines: belt.filter(Boolean).length, count, onBend: false };
    let nOre = opts.ore || ORE_PER_PULL, laps = 0, start = 1;
    belt.forEach((id) => {
      if (!id) return;
      const c = CARDS[id];
      if (c.ore) nOre += c.ore;
      if (c.laps) laps += c.laps;
      if (c.rich) start += c.rich;
    });
    const minWorth = opts.minWorth || 0;
    const items = [];
    const work = {}; // card id -> times it worked an item (counting copies)
    let total = 0, endTick = 0, bendHits = 0, best = null;
    for (let i = 0; i < nOre; i++) {
      const it = { t: 'ore', v: start, n: 1, passed: 0 };
      let tick = i * GAP;
      const track = [{ pos: -1, tick, ...snap(it), fx: [] }];
      for (let lap = 0; lap <= laps; lap++) {
        if (lap > 0) { tick++; track.push({ pos: -1, tick, ...snap(it), fx: [], again: true }); }
        for (let k = 0; k < N; k++) {
          tick++;
          const fx = [];
          const use = (from, reach) => {
            const id = belt[from];
            if (!id) return;
            ctx.onBend = bends[from] !== undefined;
            const txt = CARDS[id].work(it, ctx);
            if (txt) {
              it.passed++;
              work[id] = (work[id] || 0) + it.n;
              fx.push({ from, reach, txt, ...snap(it) });
              if (reach) bendHits += it.n;
            }
          };
          use(k, false);
          if (bends[k] !== undefined) use(bends[k], true);
          track.push({ pos: k, tick, ...snap(it), fx });
        }
        tick++;
        track.push({ pos: N, tick, ...snap(it), fx: [], final: lap === laps });
      }
      const tooSmall = it.v < minWorth;
      const worth = tooSmall ? 0 : it.v * it.n;
      track[track.length - 1].tooSmall = tooSmall;
      total += worth;
      if (!best || it.v > best.v) best = snap(it);
      items.push({ track, worth });
      endTick = Math.max(endTick, tick);
    }
    return { items, total, endTick, nOre, laps, bendHits, work, best, bends };
  }

  function shuffle(a, rnd = Math.random) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Reward offer: 3 different cards. Guaranteed one rare when forceRare.
  // canExtend: the belt is under MAX_TILES. Then one slot may be a belt extension ('ext', or 'extbend' with a new bend pair),
  // never on a screen with a guaranteed rare.
  const EXT_CHANCE = 0.3, EXT_BEND = 0.35;
  function offer(rnd = Math.random, forceRare = false, canExtend = false, noRare = false) {
    const pool = { c: [], u: [], r: [] };
    Object.keys(CARDS).forEach((id) => pool[CARDS[id].rar].push(id));
    const pick = (rar) => pool[rar][Math.floor(rnd() * pool[rar].length)];
    const out = [];
    if (forceRare) out.push(pick('r'));
    let guard = 0;
    while (out.length < 3 && guard++ < 100) {
      const x = rnd();
      const id = pick(x < 0.08 && !noRare ? 'r' : x < 0.5 ? 'u' : 'c');
      if (!out.includes(id)) out.push(id);
    }
    if (canExtend && !forceRare && rnd() < EXT_CHANCE) out[Math.floor(rnd() * out.length)] = rnd() < EXT_BEND ? 'extbend' : 'ext';
    return shuffle(out, rnd);
  }

  // Shift rules for a given shift and boss (boss id or null).
  function shiftRules(shift, bossId, rnd = Math.random, tiles = TILES, straight = false, q = 1) {
    // boss shifts ask for a bit less, since the twist costs output
    // New model launch is the one that asks for more instead
    let quota = bossId ? Math.round(quotaFor(shift) * (BOSSES[bossId].quotaMul || 0.8) / 10) * 10 : quotaFor(shift);
    if (straight) quota = Math.round(quota * STRAIGHT_QUOTA / 10) * 10;
    else if (q !== 1) quota = Math.round(quota * q / 10) * 10;   // no bends yet, so the first job's straight shifts ask for less
    const b = bossId ? BOSSES[bossId] : {};
    const r = { quota, boss: bossId || null, pulls: b.pulls || PULLS_PER_SHIFT, draw: b.draw || HAND,
                noBends: !!b.noBends, ore: b.ore || ORE_PER_PULL, minWorth: 0, blocked: [] };
    if (b.minFrac) r.minWorth = Math.max(5, Math.round(quota * b.minFrac / 5) * 5);
    if (b.jam) r.blocked = shuffle(Array.from({ length: tiles }, (_, k) => k), rnd).slice(0, b.jam);
    r.bossText = bossId ? b.text.replace('{min}', r.minWorth) : '';
    return r;
  }

  const api = { TILES, BENDS, WIDE, LAYOUTS, MAX_TILES, layout, bendsOf, extendLayout, remapBelt, EXT_CHANCE, GAP, ORE_PER_PULL, PULLS_PER_SHIFT, HAND, quotaFor, CARDS, STARTER, BOSSES,
                isBoss, shiftRules, bendMap, simulatePull, shuffle, offer };
  if (typeof module !== 'undefined') module.exports = api; else root.Engine = api;
})(this);
