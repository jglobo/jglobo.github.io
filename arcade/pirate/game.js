// Pirate Platformer — a browser port of Jose's Pygame game (gui/code/*.py).
// Vanilla JS + Canvas 2D. The game logic runs at a fixed 60 steps per second,
// like the original's clock.tick(60), and mirrors the Python classes one to one.

const TILE = 64;
const VTILES = 11;
const SCREEN_W = 1200;
const SCREEN_H = VTILES * TILE; // 704
const STEP_MS = 1000 / 60;

const asset = (p) => new URL('./assets/' + p, import.meta.url).href;

// ---------------------------------------------------------------- game data
const LEVELS = [
  { node_pos: [110, 400], unlock: 1 },
  { node_pos: [300, 220], unlock: 2 },
  { node_pos: [480, 610], unlock: 3 },
  { node_pos: [610, 350], unlock: 4 },
  { node_pos: [880, 210], unlock: 5 },
  { node_pos: [1050, 400], unlock: 5 },
];

// Folder contents (the browser cannot walk directories, so they are listed here
// in the same alphabetical order os.walk returned them on Windows).
const seq = (dir, names) => names.map((n) => `graphics/${dir}/${n}.png`);
const range = (a, b, pre = '') => Array.from({ length: b - a + 1 }, (_, i) => pre + (a + i));
const FOLDERS = {
  idle: seq('character/idle', range(1, 5)),
  run: seq('character/run', range(1, 6)),
  jump: seq('character/jump', range(1, 3)),
  fall: seq('character/fall', ['fall']),
  dust_jump: seq('character/dust_particles/jump', range(1, 6, 'jump_')),
  dust_land: seq('character/dust_particles/land', range(1, 5, 'land_')),
  dust_run: seq('character/dust_particles/run', range(1, 5, 'run_')),
  gold: seq('coins/gold', range(0, 3)),
  silver: seq('coins/silver', range(0, 3)),
  clouds: seq('decoration/clouds', range(1, 3)),
  water: seq('decoration/water', range(1, 4)),
  explosion: seq('enemy/explosion', range(1, 7)),
  enemy_run: seq('enemy/run', range(1, 6)),
  ow_clouds: seq('overworld/clouds', range(1, 3)),
  ow_palms: seq('overworld/palms', range(1, 8)),
  palm_bg: seq('terrain/palm_bg', range(1, 4, 'bg_palm_')),
  palm_large: seq('terrain/palm_large', range(1, 4, 'large_')),
  palm_small: seq('terrain/palm_small', range(1, 4, 'small_')),
};
for (let i = 0; i < 6; i++) FOLDERS['node' + i] = seq('overworld/' + i, range(1, 4));
const SINGLES = {
  hat: 'graphics/character/hat.png',
  ow_hat: 'graphics/overworld/hat.png',
  sky_top: 'graphics/decoration/sky/sky_top.png',
  sky_middle: 'graphics/decoration/sky/sky_middle.png',
  sky_bottom: 'graphics/decoration/sky/sky_bottom.png',
  grass: 'graphics/decoration/grass/grass.png',
  crate: 'graphics/terrain/crate.png',
  terrain: 'graphics/terrain/terrain_tiles.png',
  health_bar: 'graphics/ui/health_bar.png',
  ui_coin: 'graphics/ui/coin.png',
};
const SOUNDS = {
  coin: 'audio/effects/coin.mp3',
  stomp: 'audio/effects/stomp.mp3',
  jump: 'audio/effects/jump.mp3',
  hit: 'audio/effects/hit.mp3',
  level_music: 'audio/level_music.mp3',
  overworld_music: 'audio/overworld_music.mp3',
};

const randint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const I = Math.trunc; // pygame Rects hold integers

// ---------------------------------------------------------------- Rect
class Rect {
  constructor(x, y, w, h) { this._x = I(x); this._y = I(y); this.w = I(w); this.h = I(h); }
  get x() { return this._x; } set x(v) { this._x = I(v); }
  get y() { return this._y; } set y(v) { this._y = I(v); }
  get left() { return this.x; } set left(v) { this.x = I(v); }
  get top() { return this.y; } set top(v) { this.y = I(v); }
  get right() { return this.x + this.w; } set right(v) { this.x = I(v) - this.w; }
  get bottom() { return this.y + this.h; } set bottom(v) { this.y = I(v) - this.h; }
  get centerx() { return this.x + (this.w >> 1); }
  get centery() { return this.y + (this.h >> 1); }
  get midbottom() { return [this.centerx, this.bottom]; }
  set midbottom([x, y]) { this.x = I(x) - (this.w >> 1); this.y = I(y) - this.h; }
  set center([x, y]) { this.x = I(x) - (this.w >> 1); this.y = I(y) - (this.h >> 1); }
  get center() { return [this.centerx, this.centery]; }
  get bottomleft() { return [this.x, this.bottom]; }
  set bottomleft([x, y]) { this.x = I(x); this.y = I(y) - this.h; }
  get bottomright() { return [this.right, this.bottom]; }
  set bottomright([x, y]) { this.x = I(x) - this.w; this.y = I(y) - this.h; }
  colliderect(o) {
    return this.x < o.x + o.w && o.x < this.x + this.w && this.y < o.y + o.h && o.y < this.y + this.h
      && this.w > 0 && this.h > 0 && o.w > 0 && o.h > 0;
  }
  collidepoint(px, py) {
    px = I(px); py = I(py);
    return px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h;
  }
}
const imgRect = (img) => new Rect(0, 0, img.width, img.height);

// ---------------------------------------------------------------- the game
export default {
  id: 'pirate',
  title: 'Pirate Platformer',
  start(container) {
    let stopped = false;
    let rafId = 0;
    const cleanups = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      cleanups.push(() => target.removeEventListener(type, fn, opts));
    };

    // ---------- DOM
    const root = document.createElement('div');
    root.className = 'pp-root';
    const style = document.createElement('style');
    style.textContent = `
      .pp-root{position:absolute;inset:0;overflow:hidden;background:#000;touch-action:none;
        -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
      .pp-root canvas{position:absolute;image-rendering:pixelated;image-rendering:crisp-edges;display:block}
      .pp-touch{display:none}
      @media (pointer: coarse){ .pp-touch{display:block} }
      .pp-btn{position:absolute;bottom:18px;width:72px;height:72px;border-radius:50%;
        border:3px solid rgba(255,255,255,.75);background:rgba(51,50,61,.45);color:#fff;
        font:bold 26px/1 system-ui,sans-serif;touch-action:none;padding:0;
        -webkit-user-select:none;user-select:none}
      .pp-btn.pp-down{background:rgba(220,73,73,.6)}
      .pp-left{left:18px}.pp-right{left:104px}.pp-jump{right:18px;width:84px;height:84px;font-size:18px}
    `;
    const canvas = document.createElement('canvas');
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const touch = document.createElement('div');
    touch.className = 'pp-touch';
    root.append(style, canvas, touch);
    container.appendChild(root);

    const fit = () => {
      const cw = root.clientWidth, ch = root.clientHeight;
      const s = Math.min(cw / SCREEN_W, ch / SCREEN_H) || 1;
      const w = Math.floor(SCREEN_W * s), h = Math.floor(SCREEN_H * s);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.style.left = Math.floor((cw - w) / 2) + 'px';
      canvas.style.top = Math.floor((ch - h) / 2) + 'px';
    };
    fit();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(fit); ro.observe(root); }
    on(window, 'resize', fit);

    // ---------- input (held-key state, like pygame.key.get_pressed)
    const keys = new Set();
    const touchKeys = new Set();
    const pressed = (k) => keys.has(k) || touchKeys.has(k);
    const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']);
    on(window, 'keydown', (e) => {
      unlockAudio();
      if (GAME_KEYS.has(e.code)) { keys.add(e.code); e.preventDefault(); }
    });
    on(window, 'keyup', (e) => {
      if (GAME_KEYS.has(e.code)) { keys.delete(e.code); e.preventDefault(); }
    });
    on(window, 'blur', () => { keys.clear(); touchKeys.clear(); });
    on(root, 'pointerdown', () => unlockAudio());
    on(root, 'contextmenu', (e) => e.preventDefault());

    const makeBtn = (cls, label, keyFor) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pp-btn ' + cls;
      b.textContent = label;
      b.setAttribute('aria-label', cls.replace('pp-', ''));
      let held = null;
      const down = (e) => {
        e.preventDefault();
        unlockAudio();
        try { b.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        held = keyFor();
        touchKeys.add(held);
        b.classList.add('pp-down');
      };
      const up = () => {
        if (held) touchKeys.delete(held);
        held = null;
        b.classList.remove('pp-down');
      };
      on(b, 'pointerdown', down);
      on(b, 'pointerup', up);
      on(b, 'pointercancel', up);
      on(b, 'lostpointercapture', up);
      touch.appendChild(b);
    };
    makeBtn('pp-left', '◀', () => 'ArrowLeft');
    makeBtn('pp-right', '▶', () => 'ArrowRight');
    // Jump in a level; "Space" (enter the level) on the overworld map.
    makeBtn('pp-jump', 'JUMP', () => (game && game.status === 'overworld' ? 'Space' : 'ArrowUp'));

    // Tap / click on the overworld map.
    on(canvas, 'pointerdown', (e) => {
      if (!game || game.status !== 'overworld') return;
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * SCREEN_W;
      const y = ((e.clientY - r.top) / r.height) * SCREEN_H;
      game.overworld.tap(x, y);
    });

    // ---------- audio (Web Audio, created after the first user gesture)
    let actx = null;
    const soundData = {};   // name -> ArrayBuffer
    const buffers = {};     // name -> AudioBuffer
    let music = null;       // { name, src, gain }
    let wantedMusic = null;
    const unlockAudio = () => {
      if (stopped || actx) {
        if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { actx = new AC(); } catch (_) { actx = null; return; }
      actx.resume().catch(() => {});
      for (const [name, data] of Object.entries(soundData)) decode(name, data);
    };
    const decode = (name, data) => {
      if (!actx || buffers[name] || !data) return;
      actx.decodeAudioData(data.slice(0)).then((buf) => {
        buffers[name] = buf;
        if (name === wantedMusic && !music) playMusic(name);
      }).catch(() => {});
    };
    const playSound = (name, volume) => {
      if (!actx || !buffers[name] || stopped) return;
      try {
        const src = actx.createBufferSource();
        const g = actx.createGain();
        g.gain.value = volume;
        src.buffer = buffers[name];
        src.connect(g).connect(actx.destination);
        src.start();
      } catch (_) { /* ignore */ }
    };
    const stopMusic = () => {
      if (music) { try { music.src.stop(); } catch (_) { /* ignore */ } music = null; }
    };
    const playMusic = (name) => {
      wantedMusic = name;
      if (music && music.name === name) return;
      stopMusic();
      if (!actx || !buffers[name] || stopped) return;
      try {
        const src = actx.createBufferSource();
        const g = actx.createGain();
        g.gain.value = 0.35;
        src.buffer = buffers[name];
        src.loop = true;
        src.connect(g).connect(actx.destination);
        src.start();
        music = { name, src, gain: g };
      } catch (_) { /* ignore */ }
    };

    // ---------- assets
    const IMG = {};  // name -> HTMLImageElement or array
    let font = null;
    let fontFamily = 'monospace';
    let levelData = null;

    const loadImage = (p) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Failed to load ' + p));
      im.src = asset(p);
    });

    const loadAll = async () => {
      const jobs = [];
      for (const [k, list] of Object.entries(FOLDERS)) {
        jobs.push(Promise.all(list.map(loadImage)).then((imgs) => { IMG[k] = imgs; }));
      }
      for (const [k, p] of Object.entries(SINGLES)) jobs.push(loadImage(p).then((im) => { IMG[k] = im; }));
      jobs.push(fetch(asset('levels.json')).then((r) => r.json()).then((j) => { levelData = j; }));
      if (typeof FontFace !== 'undefined') {
        jobs.push(new FontFace('PiratePlatformerArcade', `url(${asset('graphics/ui/ARCADEPI.TTF')})`).load()
          .then((f) => { font = f; document.fonts.add(f); fontFamily = 'PiratePlatformerArcade'; })
          .catch(() => {}));
      }
      // Sounds are optional: fetch in the background, never block the game.
      for (const [k, p] of Object.entries(SOUNDS)) {
        fetch(asset(p)).then((r) => r.arrayBuffer()).then((b) => {
          if (stopped) return;
          soundData[k] = b;
          decode(k, b);
        }).catch(() => {});
      }
      await Promise.all(jobs);
      // Cut tile sheets (import_cut_graphics) and build black silhouettes for locked nodes.
      IMG.terrain_tiles = cutGraphics(IMG.terrain);
      IMG.grass_tiles = cutGraphics(IMG.grass);
      for (let i = 0; i < 6; i++) IMG['node' + i + '_locked'] = silhouette(IMG['node' + i][0]);
    };

    const cutGraphics = (img) => {
      const out = [];
      const nx = Math.floor(img.width / TILE), ny = Math.floor(img.height / TILE);
      for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
        const cv = document.createElement('canvas');
        cv.width = TILE; cv.height = TILE;
        cv.getContext('2d').drawImage(img, c * TILE, r * TILE, TILE, TILE, 0, 0, TILE, TILE);
        out.push(cv);
      }
      return out;
    };
    const silhouette = (img) => {
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const c = cv.getContext('2d');
      c.drawImage(img, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = '#000';
      c.fillRect(0, 0, cv.width, cv.height);
      return cv;
    };

    const blit = (img, x, y, flip = false, alpha = 1) => {
      if (!img || alpha <= 0) return;
      x = I(x); y = I(y);
      if (x > SCREEN_W || y > SCREEN_H || x + img.width < 0 || y + img.height < 0) return;
      if (alpha < 1) ctx.globalAlpha = alpha;
      if (flip) {
        ctx.save();
        ctx.translate(x + img.width, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(img, x, y);
      }
      if (alpha < 1) ctx.globalAlpha = 1;
    };

    // ================================================================ tiles.py
    class Tile {
      constructor(size, x, y) { this.rect = new Rect(x, y, size, size); this.image = null; this.flip = false; this.alive = true; }
      update(shift) { this.rect.x += shift; }
      draw() { blit(this.image, this.rect.x, this.rect.y, this.flip); }
    }
    class StaticTile extends Tile {
      constructor(size, x, y, surface) { super(size, x, y); this.image = surface; }
    }
    class Crate extends StaticTile {
      constructor(size, x, y) {
        super(size, x, y, IMG.crate);
        this.rect = imgRect(this.image);
        this.rect.bottomleft = [x, y + size];
      }
    }
    class AnimatedTile extends Tile {
      constructor(size, x, y, frames) {
        super(size, x, y);
        this.frames = frames;
        this.frame_index = 0;
        this.image = this.frames[0];
      }
      animate() {
        this.frame_index += 0.15;
        if (this.frame_index >= this.frames.length) this.frame_index = 0;
        this.image = this.frames[I(this.frame_index)];
      }
      update(shift) { this.animate(); this.rect.x += shift; }
    }
    class Coin extends AnimatedTile {
      constructor(size, x, y, frames, value) {
        super(size, x, y, frames);
        this.rect = imgRect(this.image);
        this.rect.center = [x + I(size / 2), y + I(size / 2)];
        this.value = value;
      }
    }
    class Palm extends AnimatedTile {
      constructor(size, x, y, frames, offset) {
        super(size, x, y, frames);
        this.rect.x = x; this.rect.y = y - offset;
      }
    }

    // ================================================================ enemy.py
    class Enemy extends AnimatedTile {
      constructor(size, x, y) {
        super(size, x, y, IMG.enemy_run);
        this.rect.y += size - this.image.height;
        this.speed = randint(3, 5);
      }
      move() { this.rect.x += this.speed; }
      reverse_image() { this.flip = this.speed > 0; }
      reverse() { this.speed *= -1; }
      update(shift) {
        this.rect.x += shift;
        this.animate();
        this.move();
        this.reverse_image();
      }
    }

    // ================================================================ particles.py
    class ParticleEffect {
      constructor(pos, type) {
        this.frame_index = 0;
        this.animation_speed = 0.5;
        this.frames = type === 'jump' ? IMG.dust_jump : type === 'land' ? IMG.dust_land : IMG.explosion;
        this.image = this.frames[0];
        this.rect = imgRect(this.image);
        this.rect.center = pos;
        this.alive = true;
      }
      animate() {
        this.frame_index += this.animation_speed;
        if (this.frame_index >= this.frames.length) this.alive = false;
        else this.image = this.frames[I(this.frame_index)];
      }
      update(shift) { this.animate(); this.rect.x += shift; }
      draw() { blit(this.image, this.rect.x, this.rect.y); }
    }

    // ================================================================ decoration.py
    class Sky {
      constructor(horizon, style = 'level') {
        this.horizon = horizon;
        this.style = style;
        if (style === 'overworld') {
          this.palms = [];
          for (let i = 0; i < 10; i++) {
            const s = choice(IMG.ow_palms);
            const r = imgRect(s);
            r.midbottom = [randint(0, SCREEN_W), horizon * TILE + randint(50, 100)];
            this.palms.push([s, r]);
          }
          this.clouds = [];
          for (let i = 0; i < 10; i++) {
            const s = choice(IMG.ow_clouds);
            const r = imgRect(s);
            r.midbottom = [randint(0, SCREEN_W), randint(0, horizon * TILE - 100)];
            this.clouds.push([s, r]);
          }
        }
      }
      draw() {
        for (let row = 0; row < VTILES; row++) {
          const img = row < this.horizon ? IMG.sky_top : row === this.horizon ? IMG.sky_middle : IMG.sky_bottom;
          ctx.drawImage(img, 0, 0, img.width, img.height, 0, row * TILE, SCREEN_W, TILE);
        }
        if (this.style === 'overworld') {
          for (const [s, r] of this.palms) blit(s, r.x, r.y);
          for (const [s, r] of this.clouds) blit(s, r.x, r.y);
        }
      }
    }
    class Water {
      constructor(top, level_width) {
        const water_start = -SCREEN_W;
        const w = 192;
        const n = I((level_width + SCREEN_W * 2) / w);
        this.sprites = [];
        for (let t = 0; t < n; t++) this.sprites.push(new AnimatedTile(192, t * w + water_start, top, IMG.water));
      }
      draw(shift) { for (const s of this.sprites) { s.update(shift); s.draw(); } }
    }
    class Clouds {
      constructor(horizon, level_width, number) {
        this.sprites = [];
        for (let i = 0; i < number; i++) {
          this.sprites.push(new StaticTile(0, randint(-SCREEN_W, level_width + SCREEN_W), randint(0, horizon), choice(IMG.clouds)));
        }
      }
      draw(shift) { for (const s of this.sprites) { s.update(shift); s.draw(); } }
    }

    // ================================================================ player.py
    class Player {
      constructor(pos, create_jump_particles, change_health) {
        this.animations = { idle: IMG.idle, run: IMG.run, jump: IMG.jump, fall: IMG.fall };
        this.frame_index = 0;
        this.animation_speed = 0.15;
        this.image = this.animations.idle[0];
        this.flip = false;
        this.alpha = 1;
        this.rect = imgRect(this.image);
        this.rect.x = pos[0]; this.rect.y = pos[1];

        this.dust_run_particles = IMG.dust_run;
        this.dust_frame_index = 0;
        this.dust_animation_speed = 0.15;
        this.create_jump_particles = create_jump_particles;

        this.direction = { x: 0, y: 0 };
        this.speed = 8;
        this.gravity = 0.8;
        this.jump_speed = -16;
        this.collision_rect = new Rect(this.rect.x, this.rect.y, 50, this.rect.h);

        this.status = 'idle';
        this.facing_right = true;
        this.on_ground = false;
        this.on_ceiling = false;
        this.on_left = false;
        this.on_right = false;

        this.change_health = change_health;
        this.invincible = false;
        this.invincibility_duration = 500;
        this.hurt_time = 0;
      }
      animate() {
        const animation = this.animations[this.status];
        this.frame_index += this.animation_speed;
        if (this.frame_index >= animation.length) this.frame_index = 0;
        const image = animation[I(this.frame_index)];
        if (this.facing_right) {
          this.image = image; this.flip = false;
          this.rect.bottomleft = this.collision_rect.bottomleft;
        } else {
          this.image = image; this.flip = true;
          this.rect.bottomright = this.collision_rect.bottomright;
        }
        this.alpha = this.invincible ? this.wave_value() : 1;
        const mb = this.rect.midbottom;
        this.rect = imgRect(this.image);
        this.rect.midbottom = mb;
      }
      run_dust_animation() {
        if (this.status === 'run' && this.on_ground) {
          this.dust_frame_index += this.dust_animation_speed;
          if (this.dust_frame_index >= this.dust_run_particles.length) this.dust_frame_index = 0;
          const d = this.dust_run_particles[I(this.dust_frame_index)];
          if (this.facing_right) blit(d, this.rect.left - 6, this.rect.bottom - 10);
          else blit(d, this.rect.right - 6, this.rect.bottom - 10, true);
        }
      }
      get_input() {
        if (pressed('ArrowRight')) { this.direction.x = 1; this.facing_right = true; }
        else if (pressed('ArrowLeft')) { this.direction.x = -1; this.facing_right = false; }
        else this.direction.x = 0;
        if (pressed('ArrowUp') && this.on_ground) {
          this.jump();
          this.create_jump_particles(this.rect.midbottom);
        }
      }
      get_status() {
        if (this.direction.y < 0) this.status = 'jump';
        else if (this.direction.y > 1) this.status = 'fall';
        else this.status = this.direction.x !== 0 ? 'run' : 'idle';
      }
      apply_gravity() {
        this.direction.y += this.gravity;
        this.collision_rect.y = this.collision_rect.y + this.direction.y;
      }
      jump() { this.direction.y = this.jump_speed; playSound('jump', 0.2); }
      get_damage() {
        if (!this.invincible) {
          playSound('hit', 0.2);
          this.change_health(-10);
          this.invincible = true;
          this.hurt_time = performance.now();
        }
      }
      invincibility_timer() {
        if (this.invincible && performance.now() - this.hurt_time >= this.invincibility_duration) this.invincible = false;
      }
      wave_value() { return Math.sin(performance.now()) >= 0 ? 1 : 0; }
      update() {
        this.get_input();
        this.get_status();
        this.animate();
        this.run_dust_animation();
        this.invincibility_timer();
      }
      draw() { blit(this.image, this.rect.x, this.rect.y, this.flip, this.alpha); }
    }

    // ================================================================ level.py
    class Level {
      constructor(current_level, create_overworld, change_coins, change_health) {
        this.world_shift = 0;
        this.current_x = null;
        this.create_overworld = create_overworld;
        this.current_level = current_level;
        const data = levelData[current_level];
        this.new_max_level = LEVELS[current_level].unlock;

        this.player = null;
        this.goal = null;
        this.player_setup(data.player, change_health);
        this.change_coins = change_coins;

        this.dust_sprite = null;
        this.player_on_ground = false;
        this.explosion_sprites = [];

        this.terrain_sprites = this.create_tile_group(data.terrain, 'terrain');
        this.grass_sprites = this.create_tile_group(data.grass, 'grass');
        this.crate_sprites = this.create_tile_group(data.crates, 'crates');
        this.coin_sprites = this.create_tile_group(data.coins, 'coins');
        this.fg_palm_sprites = this.create_tile_group(data.fg_palms, 'fg palms');
        this.bg_palm_sprites = this.create_tile_group(data.bg_palms, 'bg palms');
        this.enemy_sprites = this.create_tile_group(data.enemies, 'enemies');
        this.constraints_sprites = this.create_tile_group(data.constraints, 'constraints');

        this.sky = new Sky(8);
        const level_width = data.terrain[0].length * TILE;
        this.water = new Water(SCREEN_H - 20, level_width);
        this.clouds = new Clouds(400, level_width, 30);
      }
      create_tile_group(layout, type) {
        const group = [];
        layout.forEach((row, ri) => row.forEach((val, ci) => {
          if (val === -1) return;
          const x = ci * TILE, y = ri * TILE;
          let s = null;
          if (type === 'terrain') s = new StaticTile(TILE, x, y, IMG.terrain_tiles[val]);
          else if (type === 'grass') s = new StaticTile(TILE, x, y, IMG.grass_tiles[val]);
          else if (type === 'crates') s = new Crate(TILE, x, y);
          else if (type === 'coins') {
            if (val === 0) s = new Coin(TILE, x, y, IMG.gold, 5);
            if (val === 1) s = new Coin(TILE, x, y, IMG.silver, 1);
          } else if (type === 'fg palms') {
            if (val === 0) s = new Palm(TILE, x, y, IMG.palm_small, 38);
            if (val === 1) s = new Palm(TILE, x, y, IMG.palm_large, 64);
          } else if (type === 'bg palms') s = new Palm(TILE, x, y, IMG.palm_bg, 64);
          else if (type === 'enemies') s = new Enemy(TILE, x, y);
          else if (type === 'constraints') s = new Tile(TILE, x, y);
          if (s) group.push(s);
        }));
        return group;
      }
      player_setup(layout, change_health) {
        layout.forEach((row, ri) => row.forEach((val, ci) => {
          const x = ci * TILE, y = ri * TILE;
          if (val === 0) this.player = new Player([x, y], (pos) => this.create_jump_particles(pos), change_health);
          if (val === 1) this.goal = new StaticTile(TILE, x, y, IMG.hat);
        }));
      }
      enemy_collision_reverse() {
        for (const e of this.enemy_sprites) {
          if (this.constraints_sprites.some((c) => c.rect.colliderect(e.rect))) e.reverse();
        }
      }
      create_jump_particles(pos) {
        let [x, y] = pos;
        if (this.player.facing_right) { x -= 10; y -= 5; } else { x += 10; y -= 5; }
        this.dust_sprite = new ParticleEffect([x, y], 'jump');
      }
      collidables() { return this.terrain_sprites.concat(this.crate_sprites, this.fg_palm_sprites); }
      horizontal_movement_collision() {
        const p = this.player;
        p.collision_rect.x += p.direction.x * p.speed;
        for (const s of this.collidables()) {
          if (s.rect.colliderect(p.collision_rect)) {
            if (p.direction.x < 0) {
              p.collision_rect.left = s.rect.right;
              p.on_left = true;
              this.current_x = p.rect.left;
            } else if (p.direction.x > 0) {
              p.collision_rect.right = s.rect.left;
              p.on_right = true;
            }
          }
        }
      }
      vertical_movement_collision() {
        const p = this.player;
        p.apply_gravity();
        for (const s of this.collidables()) {
          if (s.rect.colliderect(p.collision_rect)) {
            if (p.direction.y > 0) {
              p.collision_rect.bottom = s.rect.top;
              p.direction.y = 0;
              p.on_ground = true;
            } else if (p.direction.y < 0) {
              p.collision_rect.top = s.rect.bottom;
              p.direction.y = 0;
              p.on_ceiling = true;
            }
          }
        }
        if ((p.on_ground && p.direction.y < 0) || p.direction.y > 1) p.on_ground = false;
      }
      scroll_x() {
        const p = this.player;
        const px = p.rect.centerx, dx = p.direction.x;
        if (px < SCREEN_W / 4 && dx < 0) { this.world_shift = 8; p.speed = 0; }
        else if (px > SCREEN_W - SCREEN_W / 4 && dx > 0) { this.world_shift = -8; p.speed = 0; }
        else { this.world_shift = 0; p.speed = 8; }
      }
      get_player_on_ground() { this.player_on_ground = this.player.on_ground; }
      create_landing_dust() {
        const p = this.player;
        if (!this.player_on_ground && p.on_ground && !this.dust_sprite) {
          const [mx, my] = p.rect.midbottom;
          const ox = p.facing_right ? 10 : -10;
          this.dust_sprite = new ParticleEffect([mx - ox, my - 15], 'land');
        }
      }
      check_death() {
        if (this.player.rect.top > SCREEN_H) this.create_overworld(this.current_level, 0);
      }
      check_win() {
        if (this.goal && this.player.rect.colliderect(this.goal.rect)) this.create_overworld(this.current_level, this.new_max_level);
      }
      check_coin_collisions() {
        const hit = this.coin_sprites.filter((c) => this.player.rect.colliderect(c.rect));
        if (hit.length) {
          this.coin_sprites = this.coin_sprites.filter((c) => !hit.includes(c));
          playSound('coin', 0.2);
          for (const c of hit) this.change_coins(c.value);
        }
      }
      check_enemy_collisions() {
        const p = this.player;
        const hits = this.enemy_sprites.filter((e) => p.rect.colliderect(e.rect));
        for (const e of hits) {
          const enemy_center = e.rect.centery, enemy_top = e.rect.top, player_bottom = p.rect.bottom;
          if (enemy_top < player_bottom && player_bottom < enemy_center && p.direction.y >= 0) {
            playSound('stomp', 0.2);
            p.direction.y = -15;
            this.explosion_sprites.push(new ParticleEffect(e.rect.center, 'explosion'));
            this.enemy_sprites = this.enemy_sprites.filter((x) => x !== e);
          } else {
            p.get_damage();
          }
        }
      }
      run() {
        const shift = this.world_shift;
        const group = (arr) => { for (const s of arr) s.update(shift); for (const s of arr) s.draw(); };
        this.sky.draw();
        this.clouds.draw(shift);
        group(this.bg_palm_sprites);
        if (this.dust_sprite) {
          this.dust_sprite.update(shift);
          if (!this.dust_sprite.alive) this.dust_sprite = null; else this.dust_sprite.draw();
        }
        group(this.terrain_sprites);
        for (const e of this.enemy_sprites) e.update(shift);
        for (const c of this.constraints_sprites) c.update(shift);
        this.enemy_collision_reverse();
        for (const e of this.enemy_sprites) e.draw();
        for (const x of this.explosion_sprites) x.update(shift);
        this.explosion_sprites = this.explosion_sprites.filter((x) => x.alive);
        for (const x of this.explosion_sprites) x.draw();
        group(this.crate_sprites);
        group(this.grass_sprites);
        group(this.coin_sprites);
        group(this.fg_palm_sprites);

        this.player.update();
        this.horizontal_movement_collision();
        this.get_player_on_ground();
        this.vertical_movement_collision();
        this.create_landing_dust();
        this.scroll_x();
        this.player.draw();
        if (this.goal) { this.goal.update(shift); this.goal.draw(); }

        this.check_death();
        this.check_win();
        this.check_coin_collisions();
        this.check_enemy_collisions();

        this.water.draw(shift);
      }
    }

    // ================================================================ overworld.py
    class Node {
      constructor(pos, status, icon_speed, index) {
        this.frames = IMG['node' + index];
        this.locked = IMG['node' + index + '_locked'];
        this.frame_index = 0;
        this.image = this.frames[0];
        this.status = status === 'available' ? 'available' : 'locked';
        this.rect = imgRect(this.image);
        this.rect.center = pos;
        this.detection_zone = new Rect(this.rect.centerx - icon_speed / 2, this.rect.centery - icon_speed / 2, icon_speed, icon_speed);
      }
      animate() {
        this.frame_index += 0.15;
        if (this.frame_index >= this.frames.length) this.frame_index = 0;
        this.image = this.frames[I(this.frame_index)];
      }
      update() {
        if (this.status === 'available') this.animate();
        else this.image = this.locked;
      }
      draw() { blit(this.image, this.rect.x, this.rect.y); }
    }
    class Icon {
      constructor(pos) {
        this.pos = { x: pos[0], y: pos[1] };
        this.image = IMG.ow_hat;
        this.rect = imgRect(this.image);
        this.rect.center = pos;
      }
      update() { this.rect.center = [this.pos.x, this.pos.y]; }
      draw() { blit(this.image, this.rect.x, this.rect.y); }
    }
    class Overworld {
      constructor(start_level, max_level, create_level) {
        this.max_level = max_level;
        this.current_level = start_level;
        this.create_level = create_level;
        this.moving = false;
        this.move_direction = { x: 0, y: 0 };
        this.speed = 8;
        this.tap_target = null;
        this.nodes = LEVELS.map((d, i) => new Node(d.node_pos, i <= max_level ? 'available' : 'locked', this.speed, i));
        this.icon = new Icon(this.nodes[this.current_level].rect.center);
        this.sky = new Sky(8, 'overworld');
        this.start_time = performance.now();
        this.allow_input = false;
        this.timer_length = 300;
      }
      draw_paths() {
        if (this.max_level > 0) {
          ctx.save();
          ctx.strokeStyle = '#a04f45';
          ctx.lineWidth = 6;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          LEVELS.forEach((n, i) => {
            if (i > this.max_level) return;
            if (i === 0) ctx.moveTo(n.node_pos[0], n.node_pos[1]); else ctx.lineTo(n.node_pos[0], n.node_pos[1]);
          });
          ctx.stroke();
          ctx.restore();
        }
      }
      tap(x, y) {
        let best = -1, bestD = 110;
        this.nodes.forEach((n, i) => {
          const d = Math.hypot(n.rect.centerx - x, n.rect.centery - y);
          if (d < bestD) { bestD = d; best = i; }
        });
        if (best < 0 || best > this.max_level) return;
        if (best === this.current_level && !this.moving) {
          this.tap_target = null;
          if (this.allow_input) this.create_level(this.current_level);
        } else {
          this.tap_target = best;
        }
      }
      input() {
        if (!this.moving && this.allow_input) {
          let right = pressed('ArrowRight'), left = pressed('ArrowLeft');
          if (this.tap_target !== null) {
            if (this.tap_target > this.current_level) right = true;
            else if (this.tap_target < this.current_level) left = true;
            else this.tap_target = null;
          }
          if (right && this.current_level < this.max_level) {
            this.move_direction = this.get_movement_data('next');
            this.current_level += 1;
            this.moving = true;
          } else if (left && this.current_level > 0) {
            this.move_direction = this.get_movement_data('previous');
            this.current_level -= 1;
            this.moving = true;
          } else if (pressed('Space')) {
            this.create_level(this.current_level);
          }
        }
      }
      get_movement_data(target) {
        const [sx, sy] = this.nodes[this.current_level].rect.center;
        const [ex, ey] = this.nodes[this.current_level + (target === 'next' ? 1 : -1)].rect.center;
        const len = Math.hypot(ex - sx, ey - sy) || 1;
        return { x: (ex - sx) / len, y: (ey - sy) / len };
      }
      update_icon_pos() {
        if (this.moving && (this.move_direction.x || this.move_direction.y)) {
          this.icon.pos.x += this.move_direction.x * this.speed;
          this.icon.pos.y += this.move_direction.y * this.speed;
          if (this.nodes[this.current_level].detection_zone.collidepoint(this.icon.pos.x, this.icon.pos.y)) {
            this.moving = false;
            this.move_direction = { x: 0, y: 0 };
          }
        }
      }
      input_timer() {
        if (!this.allow_input && performance.now() - this.start_time >= this.timer_length) this.allow_input = true;
      }
      run() {
        this.input_timer();
        this.input();
        this.update_icon_pos();
        this.icon.update();
        for (const n of this.nodes) n.update();
        this.sky.draw();
        this.draw_paths();
        for (const n of this.nodes) n.draw();
        this.icon.draw();
      }
    }

    // ================================================================ ui.py
    class UI {
      show_health(current, full) {
        blit(IMG.health_bar, 20, 10);
        const w = 152 * (current / full);
        if (w > 0) { ctx.fillStyle = '#dc4949'; ctx.fillRect(54, 39, I(w), 4); }
      }
      show_coins(amount) {
        blit(IMG.ui_coin, 50, 61);
        ctx.fillStyle = '#33323d';
        ctx.font = `30px ${fontFamily}`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(String(amount), 50 + 32 + 4, 61 + 16);
      }
    }

    // ================================================================ main.py
    class Game {
      constructor() {
        this.max_level = 2;
        this.max_health = 100;
        this.cur_health = 100;
        this.coins = 0;
        this.level = null;
        this.overworld = new Overworld(0, this.max_level, (l) => this.create_level(l));
        this.status = 'overworld';
        this.ui = new UI();
        playMusic('overworld_music');
      }
      create_level(current_level) {
        this.level = new Level(current_level, (c, m) => this.create_overworld(c, m),
          (a) => this.change_coins(a), (a) => this.change_health(a));
        this.status = 'level';
        playMusic('level_music');
      }
      create_overworld(current_level, new_max_level) {
        if (new_max_level > this.max_level) this.max_level = new_max_level;
        this.overworld = new Overworld(current_level, this.max_level, (l) => this.create_level(l));
        this.status = 'overworld';
        playMusic('overworld_music');
      }
      change_coins(a) { this.coins += a; }
      change_health(a) { this.cur_health += a; }
      check_game_over() {
        if (this.cur_health <= 0) {
          this.cur_health = 100;
          this.coins = 0;
          this.max_level = 0;
          this.overworld = new Overworld(0, this.max_level, (l) => this.create_level(l));
          this.status = 'overworld';
          playMusic('overworld_music');
        }
      }
      run() {
        if (this.status === 'overworld') {
          this.overworld.run();
        } else {
          this.level.run();
          this.ui.show_health(this.cur_health, this.max_health);
          this.ui.show_coins(this.coins);
          this.check_game_over();
        }
      }
    }

    // ---------- loop
    let game = null;
    let last = 0, acc = 0;
    const frame = (t) => {
      if (stopped) return;
      rafId = requestAnimationFrame(frame);
      if (!last) last = t;
      acc += Math.min(t - last, 250);
      last = t;
      let steps = 0;
      while (acc >= STEP_MS && steps < 5) {
        ctx.fillStyle = '#bebebe'; // screen.fill('grey')
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
        game.run();
        acc -= STEP_MS;
        steps++;
      }
      if (steps === 5) acc = 0;
    };

    const drawMessage = (msg) => {
      ctx.fillStyle = '#33323d';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.fillStyle = '#fff';
      ctx.font = '32px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(msg, SCREEN_W / 2, SCREEN_H / 2);
      ctx.textAlign = 'left';
    };
    drawMessage('Loading...');

    loadAll().then(() => {
      if (stopped) return;
      game = new Game();
      rafId = requestAnimationFrame(frame);
    }).catch((err) => {
      if (stopped) return;
      console.warn('[pirate] asset loading failed', err);
      drawMessage('Could not load the game assets.');
    });

    // ---------- cleanup
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      for (const c of cleanups) c();
      if (ro) ro.disconnect();
      stopMusic();
      if (actx) { actx.close().catch(() => {}); actx = null; }
      if (font) { try { document.fonts.delete(font); } catch (_) { /* ignore */ } }
      keys.clear(); touchKeys.clear();
      root.remove();
    };
  },
};
