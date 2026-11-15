// Sound: soft and tactile. Web Audio only, no files.
// A desk toy of felt, wood and rubber. Small muted ticks, soft knocks, shhh puffs,
// rubbery thunks, a glassy glint for the polisher, and a warm marimba note for the bend.
(() => {
  let NOISE = null;
  const noiseBuf = (ac) => { if (NOISE && NOISE.sampleRate === ac.sampleRate) return NOISE;
    NOISE = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const ch = NOISE.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; return NOISE; };
  const vary = (x, amt) => x * (1 + (Math.random() * 2 - 1) * amt);
  // Envelope gain: soft attack, exponential fall.
  const env = (ac, t, peak, att, dec) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec); return g; };
  // A plain tone with an optional pitch drop, through a lowpass so nothing gets sharp.
  const tone = (ac, out, o) => { const t = o.t || ac.currentTime; const osc = ac.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || o.d));
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp || 3000;
    const g = env(ac, t, o.g, o.a || 0.004, o.d); osc.connect(lp); lp.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + (o.a || 0.004) + o.d + 0.02); };
  // A burst of filtered noise. Optional band sweep for zips and puffs.
  const noise = (ac, out, o) => { const t = o.t || ac.currentTime; const src = ac.createBufferSource(); src.buffer = noiseBuf(ac);
    const bp = ac.createBiquadFilter(); bp.type = o.ftype || 'bandpass'; bp.frequency.setValueAtTime(o.f, t); bp.Q.value = o.q || 1;
    if (o.to) bp.frequency.exponentialRampToValueAtTime(o.to, t + (o.a || 0.003) + o.d);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5500;
    const g = env(ac, t, o.g, o.a || 0.003, o.d); src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(out);
    src.start(t, Math.random() * 0.5); src.stop(t + (o.a || 0.003) + o.d + 0.02); };
  // Muted wooden tick: a short pitched click plus a breath of band noise.
  const wood = (ac, out, f, g, d, t) => { tone(ac, out, { t, f, to: f * 0.92, g, a: 0.002, d, lp: 4000 });
    noise(ac, out, { t, f: f * 1.6, q: 3, g: g * 0.35, a: 0.001, d: d * 0.5 }); };
  // Marimba-like note: fundamental, a soft 4x partial that dies fast, and a felt mallet touch.
  const marimba = (ac, out, f, g, d, t) => { t = t || ac.currentTime;
    tone(ac, out, { t, f, g, a: 0.006, d, lp: 3500 });
    tone(ac, out, { t, f: f * 3.93, g: g * 0.18, a: 0.003, d: d * 0.22, lp: 5500 });
    tone(ac, out, { t, f: f * 0.5, g: g * 0.12, a: 0.01, d: d * 0.6, lp: 800 });
    noise(ac, out, { t, f: Math.min(f * 2.5, 3000), q: 2, g: g * 0.12, a: 0.001, d: 0.012 }); };
  // Soft knock: a low sine that drops, with a felt thud.
  const knock = (ac, out, f, g, t) => { g *= 0.6; tone(ac, out, { t, f, to: f * 0.55, glide: 0.06, g, a: 0.003, d: 0.11, lp: 1200 });
    noise(ac, out, { t, f: 600, q: 0.8, g: g * 0.3, a: 0.002, d: 0.03 }); };
  // Rubbery thunk: a triangle with a quick pitch bend down, low passed.
  const thunk = (ac, out, f, g, t) => tone(ac, out, { t, type: 'triangle', f, to: f * 0.5, glide: 0.08, g, a: 0.006, d: 0.14, lp: 700 });
  // Shhh puff: noise with a slower attack.
  const puff = (ac, out, f, to, g, d, t) => noise(ac, out, { t, f, to, q: 0.9, g: g * 2.6, a: 0.035, d });
  // Glassy glint: two inharmonic sines, soft attack.
  const glint = (ac, out, f, g, t) => { t = t || ac.currentTime;
    tone(ac, out, { t, f, g, a: 0.005, d: 0.16, lp: 5500 });
    tone(ac, out, { t: t + 0.025, f: f * 1.505, g: g * 0.55, a: 0.005, d: 0.12, lp: 5500 }); };

  const PENTA = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];   // G4 major pentatonic upward, 9 steps
  const now = (ac) => ac.currentTime;

  const MACHINE = {
    press:    (ac, o) => knock(ac, o, 170, 0.5),
    stamper:  (ac, o) => { knock(ac, o, 200, 0.45); wood(ac, o, 900, 0.08, 0.03); },
    smelter:  (ac, o) => puff(ac, o, 900, 400, 0.22, 0.15),
    furnace:  (ac, o) => { puff(ac, o, 700, 300, 0.26, 0.16); thunk(ac, o, 90, 0.18); },
    annealer: (ac, o) => puff(ac, o, 1100, 600, 0.18, 0.15),
    tempering:(ac, o) => { puff(ac, o, 1300, 700, 0.16, 0.12); wood(ac, o, 700, 0.1, 0.04, now(ac) + 0.05); },
    cutter:   (ac, o) => noise(ac, o, { f: 1400, to: 3600, q: 4, g: 0.7, a: 0.01, d: 0.07 }),
    washer:   (ac, o) => { puff(ac, o, 2600, 2000, 0.16, 0.13); tone(ac, o, { f: 600, to: 1100, g: 0.05, a: 0.01, d: 0.06, t: now(ac) + 0.04 }); },
    coater:   (ac, o) => puff(ac, o, 1800, 1400, 0.16, 0.14),
    oiler:    (ac, o) => { tone(ac, o, { f: 320, to: 620, glide: 0.07, g: 0.2, a: 0.008, d: 0.09, lp: 1500 }); },
    polisher: (ac, o) => glint(ac, o, vary(2600, 0.03), 0.13),
    roller:   (ac, o) => { const t = now(ac); thunk(ac, o, 120, 0.3, t); thunk(ac, o, 105, 0.22, t + 0.05); thunk(ac, o, 95, 0.15, t + 0.1); },
    crusher:  (ac, o) => { thunk(ac, o, 80, 0.36); noise(ac, o, { f: 400, q: 0.7, g: 0.14, a: 0.004, d: 0.08 }); },
    caster:   (ac, o) => { thunk(ac, o, 140, 0.3); puff(ac, o, 1000, 600, 0.1, 0.1, now(ac) + 0.03); },
    gearbox:  (ac, o) => { const t = now(ac); wood(ac, o, 800, 0.12, 0.03, t); wood(ac, o, 950, 0.1, 0.03, t + 0.045); wood(ac, o, 800, 0.08, 0.03, t + 0.09); },
    assembler:(ac, o) => { const t = now(ac); knock(ac, o, 220, 0.32, t); knock(ac, o, 260, 0.26, t + 0.07); },
    tally:    (ac, o) => { const t = now(ac); wood(ac, o, 1300, 0.12, 0.035, t); wood(ac, o, 1550, 0.1, 0.035, t + 0.06); },
    inspector:(ac, o) => { tone(ac, o, { f: 700, to: 1000, glide: 0.05, g: 0.12, a: 0.006, d: 0.08 }); wood(ac, o, 1200, 0.08, 0.03, now(ac) + 0.07); },
    duplicator:(ac, o) => { const t = now(ac); marimba(ac, o, 660, 0.12, 0.08, t); marimba(ac, o, 660, 0.1, 0.08, t + 0.07); },
    recycler: (ac, o) => { puff(ac, o, 1500, 500, 0.16, 0.14); thunk(ac, o, 160, 0.14); },
    overclock:(ac, o) => tone(ac, o, { type: 'triangle', f: 300, to: 900, glide: 0.12, g: 0.16, a: 0.01, d: 0.14, lp: 2000 }),
  };
  const KIND = {
    change:  (ac, o) => knock(ac, o, vary(240, 0.04), 0.36),
    add:     (ac, o) => { const t = now(ac); wood(ac, o, 600, 0.13, 0.04, t); wood(ac, o, 800, 0.11, 0.04, t + 0.05); },
    mult:    (ac, o) => tone(ac, o, { type: 'triangle', f: 160, to: 320, glide: 0.06, g: 0.3, a: 0.006, d: 0.13, lp: 1000 }),
    special: (ac, o) => marimba(ac, o, 990, 0.1, 0.12),
  };

  window.SOUNDSET = {
    pick(ac, out) { tone(ac, out, { f: vary(500, 0.04), to: 760, glide: 0.04, g: 0.1, a: 0.006, d: 0.05, lp: 2000 }); },
    place(ac, out) { const t = ac.currentTime; wood(ac, out, vary(520, 0.04), 0.2, 0.05, t); thunk(ac, out, 130, 0.18, t); },
    land(ac, out) { wood(ac, out, vary(1500, 0.12), vary(0.045, 0.3), 0.03); },
    machine(ac, out, d) { const fn = MACHINE[d.id] || KIND[d.kind] || KIND.change; fn(ac, out); },
    bend(ac, out, d) { const i = Math.max(0, Math.min(PENTA.length - 1, (d.combo || 1) - 1));
      marimba(ac, out, PENTA[i], 0.46, 0.3); },
    bin(ac, out) { thunk(ac, out, vary(170, 0.06), 0.2); noise(ac, out, { f: 500, q: 0.7, g: 0.06, a: 0.003, d: 0.04 }); },
    tick(ac, out) { wood(ac, out, vary(2100, 0.1), vary(0.03, 0.3), 0.022); },
    quota(ac, out) { const t = ac.currentTime;
      marimba(ac, out, 523.25, 0.3, 0.3, t); marimba(ac, out, 659.25, 0.32, 0.3, t + 0.13);
      marimba(ac, out, 783.99, 0.36, 0.75, t + 0.26); },
    fail(ac, out) { const t = ac.currentTime;
      marimba(ac, out, 220, 0.34, 0.4, t); marimba(ac, out, 164.81, 0.32, 0.6, t + 0.32); },
  };
})();

// The dispatcher. Each take sets window.SOUNDSET = { pick, place, land, machine, bend, bin, tick, quota, fail }:
// functions (ac, out, data) that schedule Web Audio nodes into `out` (a gain node, already at the master level). No files.
(() => {
  const KEY = 'conveyor.sound';
  let on = true; try { on = localStorage.getItem(KEY) !== 'off'; } catch (_) {}
  let ac = null, out = null, last = {};
  const unlock = () => { if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); out = ac.createGain(); out.gain.value = .55; const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    out.connect(comp); comp.connect(ac.destination); };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, unlock, { capture: true, passive: true }));   // no sound before the first tap
  window.__unlockAudio = unlock;
  // Rate limits so a busy line never machine-guns: the same event at most every N ms.
  const GAP = { land: 70, machine: 45, tick: 60, bin: 50, bend: 90 };
  window.SFX = (ev, data) => { if (!on || !ac || !window.SOUNDSET || !window.SOUNDSET[ev]) return;
    const now = performance.now(); if (GAP[ev] && now - (last[ev] || 0) < GAP[ev]) return; last[ev] = now;
    try { window.SOUNDSET[ev](ac, out, data || {}); } catch (e) { console.warn('sfx', ev, e); } };
  // Mute toggle: top bar, next to "?". On by default, saved per viewer.
  addEventListener('DOMContentLoaded', () => {
    const help = document.getElementById('helpBtn'); if (!help) return;
    const b = document.createElement('button'); b.className = help.className; b.id = 'muteBtn'; b.type = 'button';
    const paint = () => { b.setAttribute('aria-label', on ? 'Sound on. Tap to mute.' : 'Muted. Tap for sound.'); b.setAttribute('aria-pressed', String(!on));
      b.innerHTML = on ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>'
        : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>'; };
    b.addEventListener('click', (e) => { e.stopPropagation(); on = !on; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (_) {} paint(); unlock(); });
    paint(); help.parentNode.insertBefore(b, help); b.style.marginRight = '6px';
  });
})();
