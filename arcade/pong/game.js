// Pong - classic retro Pong, player vs computer, first to 7.
const W = 320, H = 200;          // low-res logical canvas, scaled up with crisp pixels
const PADDLE_W = 4, PADDLE_H = 28, BALL = 4;
const PLAYER_SPEED = 3.2, CPU_SPEED = 2.35;
const WIN_SCORE = 7;
const STEP = 1000 / 60;

// 3x5 pixel digits
const DIGITS = [
  '111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111',
];

export default {
  id: 'pong',
  title: 'Pong',
  start(container) {
    let alive = true;
    const cleanups = [];
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); cleanups.push(() => t.removeEventListener(ev, fn, opt)); };
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    Object.assign(canvas.style, {
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      imageRendering: 'pixelated', touchAction: 'none', outline: 'none',
    });
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const prevTouch = container.style.touchAction;
    container.style.touchAction = 'none';
    cleanups.push(() => { container.style.touchAction = prevTouch; });

    function fit() {
      const r = container.getBoundingClientRect();
      let s = Math.min(r.width / W, r.height / H);
      if (s >= 2) s = Math.floor(s);   // integer scale when there is room, for perfectly square pixels
      s = Math.max(0.1, s);
      canvas.style.width = Math.floor(W * s) + 'px';
      canvas.style.height = Math.floor(H * s) + 'px';
    }
    fit();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(fit); ro.observe(container); }
    on(window, 'resize', fit);

    // ---------- audio: simple square-wave beeps ----------
    let actx = null;
    function unlockAudio() {
      if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { actx = new AC(); } catch (e) { actx = null; }
    }
    function beep(freq, dur = 0.06) {
      if (!actx) return;
      try {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'square'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.08, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
        o.connect(g).connect(actx.destination);
        o.start(); o.stop(actx.currentTime + dur + 0.02);
      } catch (e) { /* ignore */ }
    }

    // ---------- state ----------
    let state = 'title';   // 'title' | 'serve' | 'play' | 'over'
    let player, cpu, ball, scoreP, scoreC, serveTimer, serveDir, frame = 0, cpuErr = 0, pointerY = null;
    const keys = new Set();

    function newMatch() {
      player = { x: 8, y: H / 2 - PADDLE_H / 2 };
      cpu = { x: W - 8 - PADDLE_W, y: H / 2 - PADDLE_H / 2 };
      scoreP = 0; scoreC = 0;
      serveDir = Math.random() < 0.5 ? -1 : 1;
      prepServe();
    }
    function prepServe() {
      ball = { x: W / 2 - BALL / 2, y: H / 2 - BALL / 2, vx: 0, vy: 0, speed: 2.4 };
      state = 'serve';
      serveTimer = 50;
    }
    function launch() {
      const a = (Math.random() * 0.8 - 0.4);
      ball.vx = Math.cos(a) * ball.speed * serveDir;
      ball.vy = Math.sin(a) * ball.speed;
      state = 'play';
      cpuErr = (Math.random() - 0.5) * 18;
    }
    newMatch();
    state = 'title';

    function begin() {
      unlockAudio();
      if (state === 'title' || state === 'over') { newMatch(); }
    }

    function bounceOff(p, dir) {
      const rel = ((ball.y + BALL / 2) - (p.y + PADDLE_H / 2)) / (PADDLE_H / 2); // -1..1
      const angle = Math.max(-1, Math.min(1, rel)) * (Math.PI / 3.2);
      ball.speed = Math.min(6, ball.speed + 0.18);
      ball.vx = Math.cos(angle) * ball.speed * dir;
      ball.vy = Math.sin(angle) * ball.speed;
      beep(dir > 0 ? 440 : 520);
      cpuErr = (Math.random() - 0.5) * (14 + ball.speed * 4);
    }

    function update() {
      frame++;
      // player movement
      let dy = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= PLAYER_SPEED;
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy += PLAYER_SPEED;
      if (dy) { player.y += dy; pointerY = null; }
      else if (pointerY !== null) {
        const target = pointerY - PADDLE_H / 2;
        player.y += Math.max(-6, Math.min(6, target - player.y));
      }
      player.y = Math.max(0, Math.min(H - PADDLE_H, player.y));

      if (state === 'title' || state === 'over') {
        // attract mode: cpu idles
        return;
      }

      // cpu movement: track the ball when it's coming, drift to centre otherwise
      const targetY = ball.vx > 0 ? ball.y + BALL / 2 + cpuErr : H / 2;
      const c = cpu.y + PADDLE_H / 2;
      const speed = ball.vx > 0 ? CPU_SPEED : CPU_SPEED * 0.5;
      if (Math.abs(targetY - c) > 2) cpu.y += Math.sign(targetY - c) * Math.min(speed, Math.abs(targetY - c));
      cpu.y = Math.max(0, Math.min(H - PADDLE_H, cpu.y));

      if (state === 'serve') {
        if (--serveTimer <= 0) launch();
        return;
      }

      ball.x += ball.vx;
      ball.y += ball.vy;
      if (ball.y <= 0) { ball.y = 0; ball.vy = Math.abs(ball.vy); beep(220, 0.04); }
      if (ball.y + BALL >= H) { ball.y = H - BALL; ball.vy = -Math.abs(ball.vy); beep(220, 0.04); }

      if (ball.vx < 0 && ball.x <= player.x + PADDLE_W && ball.x + BALL >= player.x &&
          ball.y + BALL >= player.y && ball.y <= player.y + PADDLE_H) {
        ball.x = player.x + PADDLE_W;
        bounceOff(player, 1);
      }
      if (ball.vx > 0 && ball.x + BALL >= cpu.x && ball.x <= cpu.x + PADDLE_W &&
          ball.y + BALL >= cpu.y && ball.y <= cpu.y + PADDLE_H) {
        ball.x = cpu.x - BALL;
        bounceOff(cpu, -1);
      }

      if (ball.x + BALL < 0) { scoreC++; point(1); }
      else if (ball.x > W) { scoreP++; point(-1); }
    }

    function point(dirToward) {
      beep(150, 0.25);
      if (scoreP >= WIN_SCORE || scoreC >= WIN_SCORE) { state = 'over'; return; }
      serveDir = dirToward === 1 ? -1 : 1; // serve toward the side that just lost the point
      prepServe();
    }

    function digit(n, x, y, s) {
      const str = String(n);
      for (let k = 0; k < str.length; k++) {
        const bits = DIGITS[+str[k]];
        for (let i = 0; i < 15; i++) if (bits[i] === '1') ctx.fillRect(x + k * 4 * s + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
      }
    }

    function text(str, x, y, size, color = '#fff') {
      ctx.font = `bold ${size}px "Courier New", ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(str, x, y);
    }

    function draw() {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      // centre net
      for (let y = 2; y < H; y += 8) ctx.fillRect(W / 2 - 1, y, 2, 4);
      // scores
      const s = 4;
      const pw = String(scoreP).length * 4 * s - s;
      digit(scoreP, W / 2 - 24 - pw, 10, s);
      digit(scoreC, W / 2 + 24, 10, s);
      // paddles
      ctx.fillRect(Math.round(player.x), Math.round(player.y), PADDLE_W, PADDLE_H);
      ctx.fillRect(Math.round(cpu.x), Math.round(cpu.y), PADDLE_W, PADDLE_H);
      // ball
      if (state === 'play' || (state === 'serve' && Math.floor(serveTimer / 6) % 2 === 0)) {
        ctx.fillRect(Math.round(ball.x), Math.round(ball.y), BALL, BALL);
      }

      if (state === 'title' || state === 'over') {
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(40, 48, W - 80, 118);
        if (state === 'title') {
          text('PONG', W / 2, 76, 28);
          text(coarse ? 'Drag to move your paddle' : 'W / S or ↑ / ↓ to move', W / 2, 106, 10, '#bbb');
          text(`First to ${WIN_SCORE} wins`, W / 2, 122, 10, '#bbb');
        } else {
          const won = scoreP > scoreC;
          text(won ? 'YOU WIN!' : 'CPU WINS', W / 2, 80, 24, won ? '#7CFC7C' : '#FF6B6B');
          text(`${scoreP} - ${scoreC}`, W / 2, 110, 12, '#bbb');
        }
        if (Math.floor(frame / 30) % 2 === 0) text(coarse ? 'TAP TO START' : 'PRESS SPACE TO START', W / 2, 148, 11);
        ctx.fillStyle = '#fff';
      }

      // subtle scanlines for the retro look
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    }

    // ---------- input ----------
    const GAME_KEYS = new Set(['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'Space', 'Enter']);
    on(window, 'keydown', (e) => {
      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault();
      keys.add(e.code);
      if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) begin();
    });
    on(window, 'keyup', (e) => keys.delete(e.code));
    on(window, 'blur', () => keys.clear());

    function toLogicalY(e) {
      const r = canvas.getBoundingClientRect();
      return ((e.clientY - r.top) / r.height) * H;
    }
    let dragging = false;
    on(container, 'pointerdown', (e) => {
      if (e.button !== undefined && e.button > 0) return;
      e.preventDefault();
      dragging = true;
      try { container.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pointerY = toLogicalY(e);
      begin();
    });
    on(container, 'pointermove', (e) => {
      // touch: drag; mouse: follow the cursor while hovering or dragging
      if (dragging || e.pointerType === 'mouse') pointerY = toLogicalY(e);
    });
    const end = () => { dragging = false; };
    on(container, 'pointerup', end);
    on(container, 'pointercancel', end);

    // ---------- loop ----------
    let last = performance.now(), acc = 0, raf = 0;
    function loop(now) {
      if (!alive) return;
      acc += Math.min(250, now - last);
      last = now;
      while (acc >= STEP) { update(); acc -= STEP; }
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return function cleanup() {
      alive = false;
      cancelAnimationFrame(raf);
      cleanups.forEach((f) => f());
      if (ro) ro.disconnect();
      if (actx) { actx.close().catch(() => {}); actx = null; }
      canvas.remove();
    };
  },
};
