// Spaceship Duel - browser remake of the original Pygame two-player game, using its original assets.
const W = 900, H = 500;
const BORDER = { x: W / 2 - 5, y: 0, w: 10, h: H };
const SHIP_W = 40, SHIP_H = 55;        // size after the 90 degree rotation (55x40 sprite turned sideways)
const VEL = 5, BULLET_VEL = 7, MAX_BULLETS = 3, MAX_HEALTH = 10;
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

// Pre-render a ship: scale to 55x40, then rotate by `deg` degrees clockwise.
function makeShip(src, deg) {
  const c = document.createElement('canvas');
  c.width = SHIP_W; c.height = SHIP_H;
  const g = c.getContext('2d');
  g.translate(SHIP_W / 2, SHIP_H / 2);
  g.rotate(deg * Math.PI / 180);
  g.drawImage(src, -55 / 2, -40 / 2, 55, 40);
  return c;
}

const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export default {
  id: 'spaceduel',
  title: 'Spaceship Duel',
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

    // UI layer (menu + touch controls), sized to the canvas box
    const ui = document.createElement('div');
    Object.assign(ui.style, {
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      pointerEvents: 'none', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', color: '#fff',
      userSelect: 'none', webkitUserSelect: 'none',
    });
    container.appendChild(ui);

    let scale = 1;
    function fit() {
      const r = container.getBoundingClientRect();
      scale = Math.max(0.1, Math.min(r.width / W, r.height / H));
      const w = Math.floor(W * scale) + 'px', h = Math.floor(H * scale) + 'px';
      canvas.style.width = w; canvas.style.height = h;
      ui.style.width = w; ui.style.height = h;
      ui.style.fontSize = Math.max(10, Math.round(16 * scale)) + 'px';
    }
    fit();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(fit); ro.observe(container); }
    on(window, 'resize', fit);

    // ---------- assets ----------
    let bg = null, yellowShip = null, redShip = null;
    Promise.all([loadImage('space.jpg'), loadImage('spaceship_yellow.png'), loadImage('spaceship_red.png')])
      .then(([s, y, r]) => { bg = s; yellowShip = makeShip(y, 90); redShip = makeShip(r, -90); })
      .catch((e) => console.warn(e));

    // ---------- audio ----------
    const soundNames = ['bullet', 'hit'];
    const raw = {}, buffers = {};
    let actx = null;
    soundNames.forEach((n) => {
      fetch(asset(n + '.wav')).then((r) => r.arrayBuffer()).then((b) => { raw[n] = b; decode(n); }).catch(() => {});
    });
    function decode(n) {
      if (!actx || !raw[n] || buffers[n]) return;
      const d = raw[n]; raw[n] = null;
      actx.decodeAudioData(d).then((b) => { buffers[n] = b; }).catch(() => {});
    }
    function unlockAudio() {
      if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { actx = new AC(); } catch (e) { return; }
      soundNames.forEach(decode);
    }
    function play(n, vol = 0.4) {
      if (!actx || !buffers[n]) return;
      try {
        const s = actx.createBufferSource(); s.buffer = buffers[n];
        const g = actx.createGain(); g.gain.value = vol;
        s.connect(g).connect(actx.destination); s.start();
      } catch (e) { /* ignore */ }
    }

    // ---------- state ----------
    let mode = 'cpu';           // 'cpu' | 'pvp'
    let state = 'menu';         // 'menu' | 'play' | 'win'
    let yellow, red, yBullets, rBullets, yHealth, rHealth, winner, winTimer, ai;
    const keys = new Set();
    const touch = { up: false, down: false, left: false, right: false };

    function resetRound() {
      yellow = { x: 100, y: H / 2 - SHIP_H / 2, w: SHIP_W, h: SHIP_H };
      red = { x: 700 + (55 - SHIP_W), y: H / 2 - SHIP_H / 2, w: SHIP_W, h: SHIP_H };
      yBullets = []; rBullets = [];
      yHealth = MAX_HEALTH; rHealth = MAX_HEALTH;
      winner = ''; winTimer = 0;
      ai = { ty: red.y, tx: red.x, think: 0, fireCd: 40 };
    }
    resetRound();

    function fire(side) {
      if (state !== 'play') return;
      if (side === 'yellow' && yBullets.length < MAX_BULLETS) {
        yBullets.push({ x: yellow.x + yellow.w, y: yellow.y + yellow.h / 2 - 2, w: 10, h: 5 });
        play('bullet', 0.3);
      } else if (side === 'red' && rBullets.length < MAX_BULLETS) {
        rBullets.push({ x: red.x - 10, y: red.y + red.h / 2 - 2, w: 10, h: 5 });
        play('bullet', 0.3);
      }
    }

    const clampYellow = () => {
      yellow.x = Math.max(0, Math.min(BORDER.x - yellow.w, yellow.x));
      yellow.y = Math.max(0, Math.min(H - yellow.h - 15, yellow.y));
    };
    const clampRed = () => {
      red.x = Math.max(BORDER.x + BORDER.w, Math.min(W - red.w, red.x));
      red.y = Math.max(0, Math.min(H - red.h - 15, red.y));
    };

    function updateAI() {
      // Re-plan a few times a second with some noise so the computer is beatable.
      if (--ai.think <= 0) {
        ai.think = 12 + Math.floor(Math.random() * 14);
        ai.ty = yellow.y + (Math.random() - 0.5) * 70;
        ai.tx = 560 + Math.random() * 260;
        // Dodge the nearest incoming bullet in our lane.
        let threat = null;
        for (const b of yBullets) {
          if (b.x < red.x + red.w && red.x - b.x < 260 && b.y + b.h > red.y - 8 && b.y < red.y + red.h + 8) {
            if (!threat || b.x > threat.x) threat = b;
          }
        }
        if (threat && Math.random() < 0.75) {
          ai.ty = threat.y < red.y + red.h / 2 ? threat.y + 30 : threat.y - red.h - 30;
          if (ai.ty < 0) ai.ty = threat.y + 30;
          if (ai.ty > H - red.h - 15) ai.ty = threat.y - red.h - 30;
        }
      }
      const speed = VEL - 1;
      const dy = ai.ty - red.y, dx = ai.tx - red.x;
      if (Math.abs(dy) > 3) red.y += Math.sign(dy) * Math.min(speed, Math.abs(dy));
      if (Math.abs(dx) > 3) red.x += Math.sign(dx) * Math.min(speed * 0.5, Math.abs(dx));
      clampRed();
      if (--ai.fireCd <= 0) {
        const aligned = Math.abs((red.y + red.h / 2) - (yellow.y + yellow.h / 2)) < 45;
        if (aligned || Math.random() < 0.02) {
          fire('red');
          ai.fireCd = 22 + Math.floor(Math.random() * 30);
        }
      }
    }

    function update() {
      if (state === 'win') {
        if (++winTimer > 60 * 3) { state = 'menu'; showMenu(); }
        return;
      }
      if (state !== 'play') return;

      const k = (c) => keys.has(c);
      if ((k('KeyA') || touch.left) && yellow.x - VEL > 0) yellow.x -= VEL;
      if ((k('KeyD') || touch.right)) yellow.x += VEL;
      if ((k('KeyW') || touch.up)) yellow.y -= VEL;
      if ((k('KeyS') || touch.down)) yellow.y += VEL;
      clampYellow();

      if (mode === 'pvp') {
        if (k('ArrowLeft')) red.x -= VEL;
        if (k('ArrowRight')) red.x += VEL;
        if (k('ArrowUp')) red.y -= VEL;
        if (k('ArrowDown')) red.y += VEL;
        clampRed();
      } else {
        updateAI();
      }

      for (const b of yBullets) {
        b.x += BULLET_VEL;
        if (hit(b, red)) { b.dead = true; rHealth--; play('hit', 0.35); }
        else if (b.x > W) b.dead = true;
      }
      for (const b of rBullets) {
        b.x -= BULLET_VEL;
        if (hit(b, yellow)) { b.dead = true; yHealth--; play('hit', 0.35); }
        else if (b.x < -10) b.dead = true;
      }
      yBullets = yBullets.filter((b) => !b.dead);
      rBullets = rBullets.filter((b) => !b.dead);

      if (rHealth <= 0) winner = mode === 'cpu' ? 'You Win!' : 'Yellow Wins!';
      if (yHealth <= 0) winner = mode === 'cpu' ? 'Computer Wins!' : 'Red Wins!';
      if (winner) { state = 'win'; winTimer = 0; setTouchVisible(false); }
    }

    function draw() {
      if (bg) ctx.drawImage(bg, 0, 0, W, H);
      else { ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, H); }
      ctx.fillStyle = '#000';
      ctx.fillRect(BORDER.x, BORDER.y, BORDER.w, BORDER.h);

      ctx.font = 'bold 32px "Comic Sans MS", system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText('Health: ' + yHealth, 10, 10);
      ctx.textAlign = 'right';
      ctx.fillText('Health: ' + rHealth, W - 10, 10);
      if (mode === 'cpu') {
        ctx.font = '14px system-ui, sans-serif';
        ctx.globalAlpha = 0.7;
        ctx.textAlign = 'left'; ctx.fillText('YOU', 12, 46);
        ctx.textAlign = 'right'; ctx.fillText('CPU', W - 12, 46);
        ctx.globalAlpha = 1;
      }

      if (yellowShip) ctx.drawImage(yellowShip, Math.round(yellow.x), Math.round(yellow.y));
      if (redShip) ctx.drawImage(redShip, Math.round(red.x), Math.round(red.y));

      ctx.fillStyle = '#ff0';
      for (const b of yBullets) ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#f00';
      for (const b of rBullets) ctx.fillRect(b.x, b.y, b.w, b.h);

      if (state === 'win') {
        ctx.font = 'bold 100px "Comic Sans MS", system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.strokeStyle = '#000';
        ctx.strokeText(winner, W / 2, H / 2);
        ctx.fillStyle = '#fff';
        ctx.fillText(winner, W / 2, H / 2);
      }
    }

    // ---------- DOM: menu ----------
    const btnCss = 'pointer-events:auto;cursor:pointer;border:2px solid #fff;background:rgba(0,0,0,.55);color:#fff;' +
      'font:inherit;font-weight:700;padding:.5em 1em;border-radius:.4em;margin:.25em;touch-action:manipulation;';
    const menu = document.createElement('div');
    Object.assign(menu.style, {
      position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,0,10,.62)', textAlign: 'center', pointerEvents: 'auto',
    });
    menu.innerHTML = `
      <div style="font-size:2.6em;font-weight:800;letter-spacing:.04em;text-shadow:0 3px 0 #000">SPACESHIP DUEL</div>
      <div style="margin:.4em 0 .8em;opacity:.85">First to knock the other ship's health to 0 wins</div>
      <div data-role="modes">
        <button data-mode="cpu" style="${btnCss}">1 Player (vs Computer)</button>
        <button data-mode="pvp" style="${btnCss}">2 Players</button>
      </div>
      <div data-role="controls" style="margin:.8em 0;line-height:1.5;font-size:.9em;max-width:90%"></div>
      <button data-role="start" style="${btnCss}font-size:1.2em;background:#c9a400;border-color:#ffe066;color:#000">START</button>
      <div data-role="hint" style="margin-top:.5em;font-size:.8em;opacity:.7"></div>`;
    ui.appendChild(menu);
    const modeBtns = menu.querySelectorAll('[data-mode]');
    const controlsEl = menu.querySelector('[data-role=controls]');
    const hintEl = menu.querySelector('[data-role=hint]');

    function renderMenu() {
      modeBtns.forEach((b) => {
        const sel = b.dataset.mode === mode;
        b.style.background = sel ? '#fff' : 'rgba(0,0,0,.55)';
        b.style.color = sel ? '#000' : '#fff';
      });
      const y = '<b style="color:#ffe066">Yellow</b>', r = '<b style="color:#ff6b6b">Red</b>';
      if (coarse && mode === 'cpu') {
        controlsEl.innerHTML = `You are ${y} (left). Use the on-screen pad to move and FIRE to shoot.<br>Max 3 bullets on screen at once.`;
      } else if (mode === 'cpu') {
        controlsEl.innerHTML = `You are ${y} (left): <b>W A S D</b> to move, <b>F</b> or <b>Left Ctrl</b> to fire.<br>${r} is flown by the computer. Max 3 bullets on screen at once.`;
      } else {
        controlsEl.innerHTML = `${y} (left): <b>W A S D</b> to move, <b>F</b> or <b>Left Ctrl</b> to fire.<br>` +
          `${r} (right): <b>Arrow keys</b> to move, <b>Enter</b>, <b>/</b> or <b>Right Ctrl</b> to fire.<br>Max 3 bullets on screen at once.`;
      }
      hintEl.textContent = coarse ? '' : 'Keys: 1 = vs Computer, 2 = 2 Players, Space = Start';
    }
    function showMenu() { menu.style.display = 'flex'; renderMenu(); setTouchVisible(false); }
    function startGame() {
      unlockAudio();
      resetRound();
      state = 'play';
      menu.style.display = 'none';
      setTouchVisible(coarse && mode === 'cpu');
      keys.clear();
    }
    modeBtns.forEach((b) => on(b, 'click', () => { mode = b.dataset.mode; unlockAudio(); renderMenu(); }));
    on(menu.querySelector('[data-role=start]'), 'click', startGame);

    // ---------- DOM: touch controls ----------
    const pad = document.createElement('div');
    Object.assign(pad.style, { position: 'absolute', inset: '0', display: 'none', pointerEvents: 'none' });
    const tbtn = (label, css) => {
      const b = document.createElement('div');
      b.textContent = label;
      b.style.cssText = 'position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.55);border-radius:.6em;color:#fff;font-weight:800;' +
        'font-size:1.4em;width:3.4em;height:3.4em;' + css;
      pad.appendChild(b);
      return b;
    };
    const tUp = tbtn('▲', 'left:4.2em;bottom:7.2em;');
    const tDown = tbtn('▼', 'left:4.2em;bottom:.6em;');
    const tLeft = tbtn('◀', 'left:.6em;bottom:3.9em;');
    const tRight = tbtn('▶', 'left:7.8em;bottom:3.9em;');
    const tFire = tbtn('FIRE', 'right:1em;bottom:1.5em;width:5em;height:5em;border-radius:50%;background:rgba(255,220,0,.35);');
    [[tUp, 'up'], [tDown, 'down'], [tLeft, 'left'], [tRight, 'right']].forEach(([el, dir]) => {
      const set = (v) => (e) => { e.preventDefault(); touch[dir] = v; el.style.background = v ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.16)'; };
      on(el, 'pointerdown', (e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } set(true)(e); });
      on(el, 'pointerup', set(false));
      on(el, 'pointercancel', set(false));
      on(el, 'lostpointercapture', set(false));
    });
    on(tFire, 'pointerdown', (e) => { e.preventDefault(); unlockAudio(); fire('yellow'); });
    ui.appendChild(pad);
    function setTouchVisible(v) {
      pad.style.display = v ? 'block' : 'none';
      if (!v) { touch.up = touch.down = touch.left = touch.right = false; }
    }

    // ---------- keyboard ----------
    const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'ControlLeft', 'ControlRight', 'Enter', 'NumpadEnter', 'Slash', 'NumpadDivide', 'Space', 'Digit1', 'Digit2', 'Numpad1', 'Numpad2']);
    on(window, 'keydown', (e) => {
      if (!GAME_KEYS.has(e.code)) return;
      if (e.code.startsWith('Control')) { /* keep default off only while playing */ if (state === 'play') e.preventDefault(); }
      else e.preventDefault();
      if (state === 'menu') {
        if (e.code === 'Digit1' || e.code === 'Numpad1') { mode = 'cpu'; renderMenu(); startGame(); }
        else if (e.code === 'Digit2' || e.code === 'Numpad2') { mode = 'pvp'; renderMenu(); startGame(); }
        else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') startGame();
        return;
      }
      keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'KeyF' || e.code === 'ControlLeft') fire('yellow');
      if (mode === 'pvp' && (e.code === 'ControlRight' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Slash' || e.code === 'NumpadDivide')) fire('red');
    });
    on(window, 'keyup', (e) => { keys.delete(e.code); });
    on(window, 'blur', () => keys.clear());

    showMenu();

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
      ui.remove();
      canvas.remove();
    };
  },
};
