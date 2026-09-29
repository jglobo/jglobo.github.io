// Flappy Bird - browser remake of the original Pygame game, using its original assets.
const W = 288, H = 512;
const BASE_Y = 400;            // top of the ground strip (512 - 112)
const GRAVITY = 0.38, FLAP = -6.6, MAX_FALL = 10;
const PIPE_SPEED = 2, PIPE_GAP = 112, PIPE_EVERY = 92; // frames
const STEP = 1000 / 60;

const asset = (p) => new URL('./assets/' + p, import.meta.url).href;

function loadImage(name) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Failed to load ' + name));
    img.src = asset(name);
  });
}

export default {
  id: 'flappy',
  title: 'Flappy Bird',
  start(container) {
    let alive = true;
    const cleanups = [];
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); cleanups.push(() => t.removeEventListener(ev, fn, opt)); };

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    Object.assign(canvas.style, {
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      imageRendering: 'pixelated', touchAction: 'none', outline: 'none', cursor: 'pointer',
    });
    canvas.tabIndex = 0;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function fit() {
      const r = container.getBoundingClientRect();
      const s = Math.max(0.1, Math.min(r.width / W, r.height / H));
      canvas.style.width = Math.floor(W * s) + 'px';
      canvas.style.height = Math.floor(H * s) + 'px';
    }
    fit();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(fit); ro.observe(container); }
    on(window, 'resize', fit);

    // ---------- assets ----------
    const img = {};
    const imageNames = ['background-day', 'background-night', 'base', 'pipe-green', 'pipe-red', 'message', 'gameover'];
    for (const c of ['yellow', 'red', 'blue']) for (const f of ['upflap', 'midflap', 'downflap']) imageNames.push(`${c}bird-${f}`);
    let ready = false;
    let fontFace = null;
    let fontName = 'sans-serif';
    Promise.all(imageNames.map((n) => loadImage(n + '.png').then((i) => { img[n] = i; })))
      .then(() => { ready = true; })
      .catch((e) => console.warn(e));
    if (typeof FontFace !== 'undefined') {
      fontFace = new FontFace('Flappy04B19', `url(${asset('04B_19.ttf')})`);
      fontFace.load().then((f) => { if (!alive) return; document.fonts.add(f); fontName = 'Flappy04B19'; }).catch(() => {});
    }

    // ---------- audio (Web Audio, created on first gesture) ----------
    const soundNames = ['wing', 'point', 'hit', 'die', 'swooshing'];
    const raw = {}, buffers = {};
    let actx = null;
    soundNames.forEach((n) => {
      fetch(asset(`sfx_${n}.wav`)).then((r) => r.arrayBuffer()).then((b) => { raw[n] = b; decode(n); }).catch(() => {});
    });
    function decode(n) {
      if (!actx || !raw[n] || buffers[n]) return;
      const data = raw[n]; raw[n] = null;
      actx.decodeAudioData(data).then((b) => { buffers[n] = b; }).catch(() => {});
    }
    function unlockAudio() {
      if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { actx = new AC(); } catch (e) { return; }
      soundNames.forEach(decode);
    }
    function play(n) {
      if (!actx || !buffers[n]) return;
      try {
        const src = actx.createBufferSource();
        src.buffer = buffers[n];
        const g = actx.createGain(); g.gain.value = 0.5;
        src.connect(g).connect(actx.destination);
        src.start();
      } catch (e) { /* ignore */ }
    }

    // ---------- game state ----------
    let best = 0;
    try { best = parseInt(localStorage.getItem('arcade.flappy.best') || '0', 10) || 0; } catch (e) { /* ignore */ }
    let state, bird, pipes, score, frame, baseX, spawnTimer, theme, deadTimer, flash;

    function reset() {
      state = 'ready';
      const colors = ['yellow', 'red', 'blue'];
      theme = {
        bird: colors[Math.floor(Math.random() * 3)],
        bg: Math.random() < 0.5 ? 'background-day' : 'background-night',
      };
      theme.pipe = theme.bg === 'background-day' ? 'pipe-green' : 'pipe-red';
      bird = { x: 60, y: 236, vy: 0, rot: 0 };
      pipes = [];
      score = 0; frame = 0; spawnTimer = 40; deadTimer = 0; flash = 0;
      baseX = baseX || 0;
    }
    reset();

    function flap() {
      unlockAudio();
      if (state === 'ready') { state = 'play'; bird.vy = FLAP; play('wing'); return; }
      if (state === 'play') { bird.vy = FLAP; play('wing'); return; }
      if (state === 'over' && deadTimer > 30) { play('swooshing'); reset(); }
    }

    function die() {
      if (state !== 'play') return;
      state = 'dying';
      flash = 8;
      play('hit');
      setTimeoutSafe(() => play('die'), 250);
      if (score > best) {
        best = score;
        try { localStorage.setItem('arcade.flappy.best', String(best)); } catch (e) { /* ignore */ }
      }
    }

    const timeouts = [];
    function setTimeoutSafe(fn, ms) { timeouts.push(setTimeout(() => { if (alive) fn(); }, ms)); }

    function spawnPipe() {
      const minTop = 60, maxTop = BASE_Y - 60 - PIPE_GAP;
      const top = minTop + Math.random() * (maxTop - minTop);
      pipes.push({ x: W + 10, top: Math.round(top), passed: false });
    }

    function update() {
      frame++;
      if (flash > 0) flash--;
      if (state !== 'dying' && state !== 'over') baseX = (baseX - PIPE_SPEED) % 48;

      if (state === 'ready') {
        bird.y = 236 + Math.sin(frame / 8) * 5;
        bird.rot = 0;
        return;
      }
      if (state === 'over') { deadTimer++; return; }

      bird.vy = Math.min(bird.vy + GRAVITY, MAX_FALL);
      bird.y += bird.vy;
      bird.rot = bird.vy < 0 ? -25 : Math.min(90, bird.rot + 4);

      if (state === 'play') {
        if (--spawnTimer <= 0) { spawnPipe(); spawnTimer = PIPE_EVERY; }
        for (const p of pipes) {
          p.x -= PIPE_SPEED;
          if (!p.passed && p.x + 52 < bird.x) { p.passed = true; score++; play('point'); }
        }
        pipes = pipes.filter((p) => p.x > -60);

        // collisions (slightly forgiving hitbox)
        const bx = bird.x - 15, by = bird.y - 10, bw = 30, bh = 20;
        if (bird.y - 12 < -40) { bird.y = -28; bird.vy = 0; }
        for (const p of pipes) {
          if (bx + bw > p.x + 2 && bx < p.x + 50) {
            if (by < p.top || by + bh > p.top + PIPE_GAP) { die(); break; }
          }
        }
      }
      if (bird.y + 12 >= BASE_Y) {
        bird.y = BASE_Y - 12;
        if (state === 'play') die();
        state = 'over';
        deadTimer = 0;
      }
    }

    function drawText(text, x, y, size, align = 'center') {
      ctx.font = `${size}px ${fontName}`;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      // 1px-per-step black outline drawn as offset copies (keeps the pixel font's counters open)
      const o = Math.max(1, Math.round(size / 14));
      ctx.fillStyle = '#000';
      for (let dx = -o; dx <= o; dx += o) for (let dy = -o; dy <= o; dy += o) if (dx || dy) ctx.fillText(text, x + dx, y + dy);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x, y);
    }

    function draw() {
      ctx.imageSmoothingEnabled = false;
      if (!ready) {
        ctx.fillStyle = '#4ec0ca'; ctx.fillRect(0, 0, W, H);
        drawText('Loading...', W / 2, H / 2, 20);
        return;
      }
      ctx.drawImage(img[theme.bg], 0, 0);

      const pipeImg = img[theme.pipe];
      for (const p of pipes) {
        // top pipe (flipped)
        ctx.save();
        ctx.translate(p.x, p.top);
        ctx.scale(1, -1);
        ctx.drawImage(pipeImg, 0, 0);
        ctx.restore();
        ctx.drawImage(pipeImg, p.x, p.top + PIPE_GAP);
      }

      const baseImg = img.base;
      ctx.drawImage(baseImg, Math.round(baseX), BASE_Y);
      ctx.drawImage(baseImg, Math.round(baseX) + baseImg.width, BASE_Y);

      const frames = ['upflap', 'midflap', 'downflap', 'midflap'];
      const fi = (state === 'dying' || state === 'over') ? 1 : Math.floor(frame / 5) % 4;
      const b = img[`${theme.bird}bird-${frames[fi]}`];
      ctx.save();
      ctx.translate(Math.round(bird.x), Math.round(bird.y));
      ctx.rotate(bird.rot * Math.PI / 180);
      ctx.drawImage(b, -b.width / 2, -b.height / 2);
      ctx.restore();

      if (state === 'ready') {
        ctx.drawImage(img.message, (W - img.message.width) / 2, 60);
      } else {
        drawText(String(score), W / 2, 50, 40);
      }

      if (state === 'over') {
        const g = img.gameover;
        ctx.drawImage(g, (W - g.width) / 2, 120);
        ctx.fillStyle = '#ded895';
        ctx.strokeStyle = '#543847';
        ctx.lineWidth = 3;
        ctx.fillRect(44, 180, 200, 90);
        ctx.strokeRect(44, 180, 200, 90);
        drawText('SCORE', 64, 205, 16, 'left');
        drawText(String(score), 224, 205, 22, 'right');
        drawText('BEST', 64, 245, 16, 'left');
        drawText(String(best), 224, 245, 22, 'right');
        if (deadTimer > 30 && Math.floor(frame / 30) % 2 === 0) {
          drawText(coarse ? 'Tap to play again' : 'Space / click to retry', W / 2, 310, 16);
        }
      }

      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash / 8})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

    // ---------- input ----------
    on(window, 'keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
        e.preventDefault();
        if (!e.repeat) flap();
      }
    });
    on(container, 'pointerdown', (e) => {
      if (e.button !== undefined && e.button > 0) return;
      e.preventDefault();
      flap();
    });
    const prevTouch = container.style.touchAction;
    container.style.touchAction = 'none';
    cleanups.push(() => { container.style.touchAction = prevTouch; });

    // ---------- loop ----------
    let last = performance.now(), acc = 0, raf = 0;
    function loop(now) {
      if (!alive) return;
      acc += Math.min(250, now - last);
      last = now;
      while (acc >= STEP) { if (ready) update(); acc -= STEP; }
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    try { canvas.focus({ preventScroll: true }); } catch (e) { /* ignore */ }

    return function cleanup() {
      alive = false;
      cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
      cleanups.forEach((f) => f());
      if (ro) ro.disconnect();
      if (actx) { actx.close().catch(() => {}); actx = null; }
      if (fontFace && document.fonts && document.fonts.delete) { try { document.fonts.delete(fontFace); } catch (e) { /* ignore */ } }
      canvas.remove();
    };
  },
};
