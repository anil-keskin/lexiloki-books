/* Lexi & Loki: Safe Crossing — mini game 1.
 * Plain HTML5 canvas, no libraries, no network, no data saved.
 * Lesson: cross at the zebra crossing, stop, look left & right, wait for green, walk. */
'use strict';
(() => {
  const W = 960, H = 540;
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    cv.style.width = Math.floor(W * s) + 'px';
    cv.style.height = Math.floor(H * s) + 'px';
    cv.width = Math.round(W * s * dpr);
    cv.height = Math.round(H * s * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- assets ----------
  const img = {};
  for (const n of ['lexi', 'loki']) { const i = new Image(); i.src = 'assets/' + n + '.png'; img[n] = i; }

  // ---------- layout ----------
  const ROAD_TOP = 150, ROAD_BOT = 390, MID = 270;
  const CW_L = 398, CW_R = 562, CW_C = 480;   // zebra crossing
  const BOT_Y = 452, TOP_Y = 142;             // feet line on each sidewalk
  const STOP_A = 378, STOP_B = 582;           // car stop lines (lane A -> right, lane B <- left)
  const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';

  // ---------- sound (synthesised, no files) ----------
  let actx = null, soundOn = true;
  function unlockAudio() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) actx = new AC();
  }
  function tone(f, d, type = 'sine', vol = 0.15, when = 0) {
    if (!soundOn || !actx) return;
    const t = actx.currentTime + when;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
  }
  const sfx = {
    click: () => tone(660, 0.08, 'triangle', 0.12),
    horn: () => { tone(330, 0.35, 'square', 0.07); tone(415, 0.35, 'square', 0.05); },
    tick: () => tone(1250, 0.03, 'square', 0.04),
    good: () => { tone(523, 0.12, 'triangle', 0.15); tone(659, 0.12, 'triangle', 0.15, 0.1); tone(784, 0.2, 'triangle', 0.15, 0.2); },
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.15, i * 0.12)),
    oops: () => { tone(392, 0.15, 'sawtooth', 0.06); tone(330, 0.25, 'sawtooth', 0.06, 0.15); },
  };

  // ---------- voice (device text-to-speech, offline) ----------
  const TTS = 'speechSynthesis' in window;
  let voice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    voice = vs.find(v => /female|zira|samantha|jenny|aria|libby|google us english/i.test(v.name)) || vs[0] || null;
  }
  if (TTS) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, who) {
    if (!soundOn || !TTS) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[^\w\s.,!?'-]/g, ' '));
    if (voice) u.voice = voice;
    u.lang = 'en-US'; u.rate = 0.95; u.pitch = who === 'loki' ? 1.6 : 1.2;
    speechSynthesis.speak(u);
  }

  // ---------- state ----------
  let S;
  function reset() {
    S = {
      phase: 'title', time: 0,
      loki: { x: 150, y: BOT_Y, dir: 1, walk: 0, tilt: 0, hop: 0 },
      lexi: { x: 80, y: BOT_Y, walk: 0 },
      mistakes: 0, cool: 0, looked: { l: false, r: false }, lookT: 0, lookDir: 0,
      light: 'red', lightT: 0, tickT: 0, cars: [], spawn: [0.3, 1.2],
      confetti: [], hasIce: false, hintT: 0, showHint: false, winT: 0, crossing: false, warnStripes: 0,
      say: { text: '', who: 'lexi', wait: false, next: null, t: 0 },
    };
    for (let i = 0; i < 3; i++) { spawn(0, 120 + i * 300); spawn(1, 820 - i * 300); }
  }

  function talk(who, text, next) {
    S.say = { text, who, wait: !!next, next: next || null, t: 0 };
    speak(text, who);
  }
  function lexiSays(text, next) { talk('lexi', text, next); }

  // ---------- cars ----------
  const COLORS = ['#e94b3c', '#3b7ddd', '#8e5bd6', '#2fae5a', '#ff7aa8', '#1fb5b0', '#ff8c2e'];
  function spawn(lane, atX) {
    const bus = Math.random() < 0.18;
    const c = {
      lane, bus, w: bus ? 170 : 110 + (Math.random() * 25 | 0), h: bus ? 62 : 54,
      color: bus ? '#f5b82e' : COLORS[Math.random() * COLORS.length | 0],
      vmax: 140 + Math.random() * 60, v: 0, y: lane === 0 ? 210 : 330,
    };
    c.v = c.vmax;
    c.x = atX !== undefined ? atX : (lane === 0 ? -c.w - 10 : W + 10);
    // keep a gap to the car that entered before
    const same = S.cars.filter(k => k.lane === lane);
    for (const k of same) {
      if (c.x < k.x + k.w + 40 && c.x + c.w + 40 > k.x) return false;
    }
    S.cars.push(c);
    return true;
  }
  function carsMustStop() { return S.light === 'green' && (S.phase === 'wait' || S.phase === 'cross'); }
  function crossingClear() { return !S.cars.some(c => c.x < CW_R + 6 && c.x + c.w > CW_L - 6); }
  function updateCars(dt) {
    for (let lane = 0; lane < 2; lane++) {
      S.spawn[lane] -= dt;
      if (S.spawn[lane] <= 0) { spawn(lane); S.spawn[lane] = 1.3 + Math.random() * 2.2; }
      const list = S.cars.filter(c => c.lane === lane)
        .sort((a, b) => lane === 0 ? b.x - a.x : a.x - b.x);   // front-most first
      list.forEach((c, i) => {
        const front = lane === 0 ? c.x + c.w : c.x;
        let room = Infinity;
        const ahead = list[i - 1];
        if (ahead) room = (lane === 0 ? ahead.x - (c.x + c.w) : c.x - (ahead.x + ahead.w)) - 26;
        if (carsMustStop()) {
          const d = lane === 0 ? STOP_A - front : front - STOP_B;
          if (d >= -2) room = Math.min(room, Math.max(0, d));
        }
        const vAllowed = room === Infinity ? c.vmax : Math.sqrt(Math.max(0, 2 * 380 * room));
        c.v = Math.min(c.v + 260 * dt, c.vmax, vAllowed);
        if (room <= 0.5) c.v = 0;
        const step = Math.min(c.v * dt, Math.max(0, room));
        c.x += lane === 0 ? step : -step;
      });
    }
    S.cars = S.cars.filter(c => c.x > -c.w - 40 && c.x < W + 40);
  }

  // ---------- game flow ----------
  function startGame() {
    reset();
    S.phase = 'talk';
    talk('loki', 'Ice cream! Ice cream! I want ice cream!', () =>
      lexiSays("Hi friends! I'm Lexi. The ice cream cart is across the street. Let's help Loki cross safely!", () => {
        S.phase = 'walk';
        lexiSays('First, find the zebra crossing. It has white stripes. Use the arrows to walk there.');
      }));
  }

  function mistake(text) {
    S.mistakes++; S.cool = 1.4; S.loki.hop = 0.5;
    sfx.oops(); lexiSays(text);
  }

  function tryCross() {
    if (S.cool > 0) return;
    if (S.phase === 'walk') {
      S.showHint = true;
      mistake("Whoa, Loki! Not here. We only cross at the zebra crossing. Walk to the white stripes first!");
    } else if (S.phase === 'look') {
      mistake('Stop first, Loki! Before we cross, we look LEFT and RIGHT for cars.');
    } else if (S.phase === 'wait') {
      if (S.light === 'red') {
        sfx.horn();
        mistake('Beep beep! Red means WAIT. We wait for the green walking man.');
      } else if (!crossingClear()) {
        S.cool = 1; lexiSays('Wait... let that car pass first. Never step in front of a moving car.');
      } else {
        S.phase = 'cross'; S.crossing = true; sfx.good();
        lexiSays("Green and all cars stopped. Hold my paw! We WALK, we don't run, and keep looking.");
      }
    }
  }

  function look(dir) {
    if (S.phase !== 'look' || S.lookT > 0.2) return;
    S.lookDir = dir; S.lookT = 1.1;
    if (dir < 0) { S.looked.l = true; lexiSays(S.looked.r ? 'And look LEFT again... ' : 'Look LEFT... cars come from this side.'); }
    else { S.looked.r = true; lexiSays(S.looked.l ? 'Now look RIGHT...' : 'Look RIGHT... cars come from this side too.'); }
  }

  function update(dt) {
    S.time += dt;
    S.say.t += dt;
    if (S.cool > 0) S.cool -= dt;
    if (S.loki.hop > 0) S.loki.hop -= dt;
    if (S.warnStripes > 0) S.warnStripes -= dt;
    updateCars(dt);

    const L = S.loki, X = S.lexi;
    const left = held.has('left') || keys.has('left');
    const right = held.has('right') || keys.has('right');
    let moving = false;

    if (S.phase === 'walk') {
      S.hintT += dt;
      if (S.hintT > 6) S.showHint = true;
      if (left !== right) {
        L.dir = left ? -1 : 1; L.x = Math.max(50, Math.min(W - 50, L.x + L.dir * 170 * dt)); moving = true;
      }
      if (Math.abs(L.x - CW_C) < 16) {
        L.x = CW_C + 36; S.phase = 'look'; S.showHint = false; sfx.good();
        keys.clear(); held.clear(); L.walk = 0;   // a held arrow must not count as "looking"
        lexiSays('Good job, Loki! This is the zebra crossing. Now STOP at the edge... and look LEFT and RIGHT for cars.');
      }
    } else if (S.phase === 'look') {
      if (S.lookT > 0) {
        S.lookT -= dt;
        L.tilt = S.lookDir * 0.2 * Math.min(1, S.lookT * 3);
        if (S.lookT <= 0 && S.looked.l && S.looked.r) {
          S.phase = 'wait'; S.light = 'red'; S.lightT = 4.5; L.tilt = 0;
          lexiSays('Great looking! Now look at the light. The red man means WAIT. The green walking man means GO.');
        }
      }
      if ((left || right) && S.cool <= 0 && S.lookT <= 0) { look(left ? -1 : 1); keys.delete('left'); keys.delete('right'); }
    } else if (S.phase === 'wait') {
      if (S.light === 'red') {
        S.lightT -= dt;
        if (S.lightT <= 0) {
          S.light = 'green'; sfx.good();
          lexiSays('Green walking man! The cars are stopping. When all cars stop, press CROSS.');
        }
      }
    } else if (S.phase === 'cross') {
      if (left || right) { if (S.warnStripes <= 0) { S.warnStripes = 2.5; lexiSays('Stay on the stripes, Loki!'); } }
      L.y -= 95 * dt; moving = true; L.dir = 1;
      if (L.y <= TOP_Y) { L.y = TOP_Y; win(); }
    } else if (S.phase === 'win') {
      S.winT += dt;
      const tx = 600;
      if (Math.abs(L.x - tx) > 4) { L.x += Math.sign(tx - L.x) * 150 * dt; L.dir = Math.sign(tx - L.x) || 1; moving = true; }
      else if (!S.hasIce) { S.hasIce = true; sfx.win(); burst(L.x, L.y - 110); lexiSays('We did it! Safe and sound. Yummy ice cream!'); }
    }

    // ticking signal sound while green
    if (S.light === 'green') { S.tickT -= dt; if (S.tickT <= 0) { sfx.tick(); S.tickT = 0.45; } }

    if (moving) L.walk += dt; else L.walk = 0;
    // Lexi stays close to Loki (on the crossing she walks beside him)
    const onCrossing = S.phase === 'look' || S.phase === 'wait' || S.phase === 'cross';
    const tx = onCrossing ? CW_C - 42 : (S.phase === 'win' ? L.x - 85 : L.x - 85 * L.dir);
    const ty = L.y;
    const dx = tx - X.x, dy = ty - X.y;
    X.x += dx * Math.min(1, dt * 4); X.y += dy * Math.min(1, dt * 6);
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) X.walk += dt; else X.walk = 0;

    // confetti
    for (const p of S.confetti) { p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; }
    S.confetti = S.confetti.filter(p => p.y < H + 20);
    if (S.phase === 'win' && S.hasIce && Math.random() < dt * 6) burst(Math.random() * W, -10, 4);
  }

  function win() {
    S.phase = 'win'; S.crossing = false; S.light = 'red'; S.winT = 0; S.tickT = 0;
    sfx.good(); burst(L0().x, TOP_Y - 80);
  }
  const L0 = () => S.loki;
  function burst(x, y, n = 40) {
    const cols = ['#ff5a8a', '#ffd23f', '#3bceac', '#5b8cff', '#ff8c2e', '#b26bff'];
    for (let i = 0; i < n; i++) S.confetti.push({
      x, y, vx: (Math.random() - 0.5) * 420, vy: -Math.random() * 380 - 60,
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, c: cols[i % cols.length], s: 5 + Math.random() * 6,
    });
  }
  const stars = () => Math.max(1, 3 - S.mistakes);

  // ---------- input ----------
  const held = new Set(), keys = new Set(), ptrBtn = new Map();
  function buttons() {
    const b = [];
    const p = S.phase;
    if (p === 'title') b.push({ id: 'play', x: W / 2 - 120, y: 390, w: 240, h: 84, label: 'PLAY  ▶', color: '#2fae5a', big: true });
    if (p === 'walk' || p === 'wait') {
      b.push({ id: 'left', x: 18, y: H - 76, w: 88, h: 66, label: '◀', color: '#6b5bd6' });
      b.push({ id: 'right', x: 116, y: H - 76, w: 88, h: 66, label: '▶', color: '#6b5bd6' });
    }
    if (p === 'walk' || p === 'look' || p === 'wait') {
      const ready = p === 'wait' && S.light === 'green';
      b.push({ id: 'up', x: W - 214, y: H - 76, w: 196, h: 66, label: 'CROSS  ▲', color: ready ? '#2fae5a' : '#e0675a', pulse: ready });
    }
    if (p === 'look') {
      b.push({ id: 'lookL', x: W / 2 - 250, y: H - 76, w: 220, h: 66, label: '◀ Look Left', color: '#3b7ddd', pulse: !S.looked.l });
      b.push({ id: 'lookR', x: W / 2 - 10, y: H - 76, w: 220, h: 66, label: 'Look Right ▶', color: '#3b7ddd', pulse: !S.looked.r });
    }
    if (p === 'win' && S.winT > 2.2) b.push({ id: 'again', x: W / 2 - 120, y: 420, w: 240, h: 72, label: 'PLAY AGAIN', color: '#2fae5a', big: true });
    b.push({ id: 'sound', x: W - 62, y: 10, w: 50, h: 50, label: soundOn ? '♪' : '×', color: '#ffffffcc', dark: true });
    return b;
  }
  const hit = (b, p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  function toWorld(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function press(id) {
    sfx.click();
    switch (id) {
      case 'play': case 'again': startGame(); break;
      case 'left': case 'right': held.add(id); break;
      case 'up': tryCross(); break;
      case 'lookL': look(-1); break;
      case 'lookR': look(1); break;
      case 'sound':
        soundOn = !soundOn;
        if (!soundOn && TTS) speechSynthesis.cancel();
        break;
    }
  }
  function tapContinue() {
    if (S.say.wait && S.say.t > 0.4 && S.say.next) { const n = S.say.next; S.say.next = null; S.say.wait = false; sfx.click(); n(); }
  }
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); unlockAudio();
    const p = toWorld(e);
    const b = buttons().find(k => hit(k, p));
    if (b) { ptrBtn.set(e.pointerId, b.id); press(b.id); } else tapContinue();
  });
  const release = e => { const id = ptrBtn.get(e.pointerId); if (id) { held.delete(id); ptrBtn.delete(e.pointerId); } };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  window.addEventListener('keydown', e => {
    unlockAudio();
    if (KEYMAP[e.key]) { if (!e.repeat) keys.add(KEYMAP[e.key]); e.preventDefault(); return; }
    if (e.repeat) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (S.say.wait) return tapContinue();
      if (S.phase === 'title' || (S.phase === 'win' && S.winT > 2.2)) return press('play');
    }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') { e.preventDefault(); tryCross(); }
  });
  window.addEventListener('keyup', e => { if (KEYMAP[e.key]) keys.delete(KEYMAP[e.key]); });
  window.addEventListener('blur', () => { keys.clear(); held.clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && TTS) speechSynthesis.cancel(); });

  // ---------- drawing helpers ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function text(t, x, y, size, color, align = 'center', weight = 'bold') {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(t, x, y);
  }
  function wrap(t, maxW, size) {
    ctx.font = `bold ${size}px ${FONT}`;
    const words = t.split(' '), lines = []; let cur = '';
    for (const w of words) { const n = cur ? cur + ' ' + w : w; if (ctx.measureText(n).width > maxW && cur) { lines.push(cur); cur = w; } else cur = n; }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawScene() {
    // park (top)
    ctx.fillStyle = '#7cc46a'; ctx.fillRect(0, 0, W, 92);
    ctx.fillStyle = '#d8d2c4'; ctx.fillRect(0, 92, W, ROAD_TOP - 92);
    // bottom sidewalk + grass
    ctx.fillStyle = '#d8d2c4'; ctx.fillRect(0, ROAD_BOT, W, 92);
    ctx.fillStyle = '#7cc46a'; ctx.fillRect(0, ROAD_BOT + 92, W, H - ROAD_BOT - 92);
    // tile lines
    ctx.strokeStyle = '#c5bdaa'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 92); ctx.lineTo(x, ROAD_TOP); ctx.moveTo(x, ROAD_BOT); ctx.lineTo(x, ROAD_BOT + 92); ctx.stroke();
    }
    // road + curbs
    ctx.fillStyle = '#4a4e57'; ctx.fillRect(0, ROAD_TOP, W, ROAD_BOT - ROAD_TOP);
    ctx.fillStyle = '#9a9488'; ctx.fillRect(0, ROAD_TOP - 6, W, 6); ctx.fillRect(0, ROAD_BOT, W, 6);
    // centre line
    ctx.fillStyle = '#f5c842';
    for (let x = 10; x < W; x += 70) if (x + 40 < CW_L - 30 || x > CW_R + 30) ctx.fillRect(x, MID - 3, 40, 6);
    // stop lines
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(STOP_A, ROAD_TOP + 4, 6, MID - ROAD_TOP - 8);
    ctx.fillRect(STOP_B - 6, MID + 4, 6, ROAD_BOT - MID - 8);
    // zebra crossing
    const glow = S.phase === 'walk' && S.showHint ? 0.55 + 0.45 * Math.sin(S.time * 6) : 1;
    ctx.fillStyle = `rgba(255,255,255,${0.9 * glow})`;
    for (let y = ROAD_TOP + 8; y < ROAD_BOT - 10; y += 34) ctx.fillRect(CW_L, y, CW_R - CW_L, 18);

    // trees & flowers
    for (const tx of [60, 230, 380, 880]) tree(tx, 70);
    for (const fx of [40, 140, 300, 620, 760, 900]) flower(fx, H - 22);
    cart(650, 22);
    signal(612, ROAD_BOT + 4, 1);
    signal(350, 96, 0.7);
  }
  function tree(x, y) {
    ctx.fillStyle = '#8a5a3b'; ctx.fillRect(x - 6, y - 10, 12, 26);
    ctx.fillStyle = '#3f9a4a'; ctx.beginPath(); ctx.arc(x, y - 26, 30, 0, 7); ctx.fill();
    ctx.fillStyle = '#54b35c'; ctx.beginPath(); ctx.arc(x - 10, y - 34, 16, 0, 7); ctx.fill();
  }
  function flower(x, y) {
    ctx.fillStyle = '#ff8fb3';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(i * 1.26) * 5, y + Math.sin(i * 1.26) * 5, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
  }
  function cart(x, y) {
    // umbrella
    const cols = ['#ff5a8a', '#ffffff'];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = cols[i % 2]; ctx.beginPath(); ctx.moveTo(x + 60, y - 6);
      ctx.arc(x + 60, y + 22, 58, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#7b6a58'; ctx.fillRect(x + 58, y + 20, 4, 36);
    rr(x + 8, y + 52, 104, 50, 10); ctx.fillStyle = '#5bc0eb'; ctx.fill();
    text('ICE CREAM', x + 60, y + 77, 15, '#ffffff');
    ctx.fillStyle = '#333'; for (const wx of [x + 28, x + 92]) { ctx.beginPath(); ctx.arc(wx, y + 106, 9, 0, 7); ctx.fill(); }
  }
  function walkMan(x, y, s, walking, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -16, 4.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 4);
    if (walking) { ctx.moveTo(0, 4); ctx.lineTo(-7, 15); ctx.moveTo(0, 4); ctx.lineTo(7, 14); ctx.moveTo(0, -7); ctx.lineTo(-7, 0); ctx.moveTo(0, -7); ctx.lineTo(8, -2); }
    else { ctx.moveTo(0, 4); ctx.lineTo(-3, 15); ctx.moveTo(0, 4); ctx.lineTo(3, 15); ctx.moveTo(0, -7); ctx.lineTo(-5, 3); ctx.moveTo(0, -7); ctx.lineTo(5, 3); }
    ctx.stroke(); ctx.restore();
  }
  function signal(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#55595f'; ctx.fillRect(-3, 40, 6, 44);
    rr(-24, -40, 48, 84, 8); ctx.fillStyle = '#262a30'; ctx.fill();
    const red = S.light === 'red', green = !red;
    ctx.fillStyle = red ? '#3a1414' : '#1a1a1a'; rr(-18, -34, 36, 36, 6); ctx.fill();
    ctx.fillStyle = green ? '#123a1c' : '#1a1a1a'; rr(-18, 2, 36, 36, 6); ctx.fill();
    walkMan(0, -14, 1, false, red ? '#ff4b4b' : '#4a2222');
    const blink = S.light === 'green' ? 1 : 0;
    walkMan(0, 22, 1, true, blink ? '#4dff7a' : '#1f3a26');
    ctx.restore();
    if (s === 1 && S.phase === 'wait' && S.light === 'red') {
      // small countdown dots so kids see waiting progress
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < Math.ceil(S.lightT) ? '#ffd23f' : '#ffffff55';
        ctx.beginPath(); ctx.arc(x - 20 + i * 10, y - 52, 3.5, 0, 7); ctx.fill();
      }
    }
  }
  function car(c) {
    ctx.save(); ctx.translate(c.x, c.y - c.h / 2);
    const flip = c.lane === 1;
    if (flip) { ctx.translate(c.w, 0); ctx.scale(-1, 1); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(4, 6, c.w, c.h, 14); ctx.fill();
    ctx.fillStyle = '#222';
    for (const wx of [c.w * 0.2, c.w * 0.75]) { ctx.fillRect(wx - 10, -5, 20, 8); ctx.fillRect(wx - 10, c.h - 3, 20, 8); }
    ctx.fillStyle = c.color; rr(0, 0, c.w, c.h, 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(6, 5, c.w - 12, 10, 5); ctx.fill();
    ctx.fillStyle = '#bfe6ff';
    if (c.bus) { for (let i = 0; i < 5; i++) { rr(14 + i * 28, 10, 20, c.h - 20, 4); ctx.fill(); } }
    else { rr(c.w * 0.58, 8, c.w * 0.18, c.h - 16, 6); ctx.fill(); rr(c.w * 0.18, 9, c.w * 0.14, c.h - 18, 5); ctx.fill(); }
    ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(c.w - 4, 10, 4, 0, 7); ctx.arc(c.w - 4, c.h - 10, 4, 0, 7); ctx.fill();
    if (c.v < 5 && carsMustStop()) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(0, 6, 4, 10); ctx.fillRect(0, c.h - 16, 4, 10); }
    ctx.restore();
  }
  function dog(name, d, h, faceLeft) {
    const im = img[name];
    if (!im.complete || !im.naturalWidth) return;
    const w = h * im.naturalWidth / im.naturalHeight;
    const bob = d.walk ? Math.abs(Math.sin(d.walk * 11)) * 5 : 0;
    const hop = d.hop > 0 ? Math.sin(d.hop / 0.5 * Math.PI) * 14 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y, w * 0.42, 7, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(d.x, d.y - bob - hop);
    ctx.rotate((d.tilt || 0) + (d.walk ? Math.sin(d.walk * 11) * 0.05 : 0));
    if (faceLeft) ctx.scale(-1, 1);
    ctx.drawImage(im, -w / 2, -h, w, h);
    ctx.restore();
  }
  function iceCream(x, y) {
    ctx.fillStyle = '#e0a458'; ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 24); ctx.fill();
    ctx.fillStyle = '#ff8fb3'; ctx.beginPath(); ctx.arc(x, y - 4, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(x, y - 15, 8, 0, 7); ctx.fill();
  }
  function drawButtons() {
    for (const b of buttons()) {
      const s = b.pulse ? 1 + Math.sin(S.time * 7) * 0.04 : 1;
      ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(s, s);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(-b.w / 2 + 3, -b.h / 2 + 5, b.w, b.h, 18); ctx.fill();
      ctx.fillStyle = b.color; rr(-b.w / 2, -b.h / 2, b.w, b.h, 18); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.stroke();
      text(b.label, 0, 2, b.big ? 34 : (b.w < 60 ? 28 : 28), b.dark ? '#2b2f6b' : '#ffffff');
      ctx.restore();
    }
  }
  function drawSay() {
    const s = S.say;
    if (!s.text || S.phase === 'title' || (S.phase === 'win' && S.winT > 1.6)) return;
    const size = 22, w = W - 92, x = 14;
    const lines = wrap(s.text, w - 130, size);
    const h = Math.max(84, 26 + lines.length * 28 + (s.wait ? 22 : 0));
    // near the top normally; at the bottom once the dogs reach the park side
    const y = (S.phase === 'cross' || S.phase === 'win') ? H - h - 12 : 10;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; rr(x + 3, y + 5, w, h, 18); ctx.fill();
    ctx.fillStyle = s.who === 'loki' ? '#eef8e8' : '#fff0f6'; rr(x, y, w, h, 18); ctx.fill();
    ctx.strokeStyle = s.who === 'loki' ? '#5f8a4a' : '#ff8fb3'; ctx.lineWidth = 4; ctx.stroke();
    // portrait: top part of the sprite
    const im = img[s.who];
    if (im.complete && im.naturalWidth) {
      ctx.save(); ctx.beginPath(); ctx.arc(x + 50, y + 44, 36, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.clip();
      const sw = im.naturalWidth, sh = sw;
      ctx.drawImage(im, 0, 0, sw, sh, x + 14, y + 6, 74, 74);
      ctx.restore();
    }
    text(s.who === 'loki' ? 'LOKI' : 'LEXI', x + 50, y + 88 > y + h - 6 ? y + h - 8 : y + 88, 13, s.who === 'loki' ? '#5f8a4a' : '#d6457a');
    lines.forEach((ln, i) => text(ln, x + 108, y + 26 + i * 28, size, '#2b2f6b', 'left'));
    if (s.wait && s.t > 0.4) text('Tap to continue  ▶', x + w - 16, y + h - 16, 16, '#d6457a', 'right');
  }
  function drawTitle() {
    ctx.fillStyle = 'rgba(43,47,107,0.72)'; ctx.fillRect(0, 0, W, H);
    text('Lexi & Loki', W / 2, 92, 72, '#ffd23f');
    text('Safe Crossing', W / 2, 160, 40, '#ffffff');
    const t = S.time;
    dog('lexi', { x: W / 2 - 110, y: 370, walk: 0, tilt: Math.sin(t * 2) * 0.04 }, 190, false);
    dog('loki', { x: W / 2 + 110, y: 370, walk: 0, tilt: Math.sin(t * 2 + 1) * 0.05 }, 190, false);
    text('No ads  •  No data collected  •  Works offline', W / 2, H - 22, 15, '#c9cbff', 'center', 'normal');
  }
  function drawWin() {
    if (S.winT < 1.6) return;
    const a = Math.min(1, (S.winT - 1.6) * 3);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(43,47,107,0.55)'; ctx.fillRect(0, 0, W, H);
    rr(W / 2 - 300, 70, 600, 440, 26); ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6; ctx.stroke();
    text('Hooray! Safe Crossing!', W / 2, 115, 38, '#d6457a');
    for (let i = 0; i < 3; i++) text('★', W / 2 - 70 + i * 70, 170, 58, i < stars() ? '#ffc21a' : '#ddd6c8');
    const rules = ['1. Cross at the zebra crossing', '2. Stop at the edge', '3. Look left and right', '4. Wait for the green walking man', '5. Walk, don\'t run'];
    rules.forEach((r, i) => text(r, W / 2 - 200, 225 + i * 36, 24, '#2b2f6b', 'left'));
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawScene();
    for (const c of S.cars) car(c);
    if (S.phase !== 'title') {
      // hint arrow to the crossing
      if (S.phase === 'walk' && S.showHint) {
        const by = ROAD_BOT + 4 + Math.sin(S.time * 6) * 6;
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(CW_C, by + 22); ctx.lineTo(CW_C - 18, by); ctx.lineTo(CW_C + 18, by); ctx.fill();
      }
      // look arrows over the lanes
      if (S.phase === 'look' && S.lookT > 0) {
        ctx.globalAlpha = Math.min(1, S.lookT * 2);
        const ay = S.lookDir < 0 ? 210 : 330;
        text(S.lookDir < 0 ? '◀ ◀ ◀' : '▶ ▶ ▶', S.lookDir < 0 ? 200 : 760, ay, 46, '#ffd23f');
        ctx.globalAlpha = 1;
      }
      const ds = [['lexi', S.lexi, 150, false], ['loki', S.loki, 140, S.loki.dir < 0]].sort((a, b) => a[1].y - b[1].y);
      for (const [n, d, h, f] of ds) dog(n, d, h, f);
      if (S.hasIce) { iceCream(S.loki.x + 40, S.loki.y - 74); iceCream(S.lexi.x + 42, S.lexi.y - 78); }
    }
    for (const p of S.confetti) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    if (S.phase === 'title') drawTitle();
    if (S.phase === 'win') drawWin();
    drawSay();
    drawButtons();
  }

  // ---------- loop ----------
  reset();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // test hook for automated checks (read-only snapshot)
  window.__lexiloki = {
    state: () => S, press, tryCross,
    step: sec => { for (let t = 0; t < sec; t += 1 / 60) update(1 / 60); render(); },
  };
})();
