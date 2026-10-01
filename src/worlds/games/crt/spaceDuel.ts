// Space Duel for the TV. Same rules as Jose's Pygame original (two ships, a centre
// border, three bullets each, ten health) with new vector art and synthesized sound.
// The red ship is flown by the computer.
import { PIXEL_FONT, SCREEN_H, SCREEN_W, type CrtGame, type CrtGameOptions, type CrtInput } from './types';

const W = SCREEN_W;
const H = SCREEN_H;
const TOP = 44; // HUD band
const BORDER_X = W / 2 - 4;
const SHIP_W = 34;
const SHIP_H = 28;
const VEL = 3.6;
const BULLET_VEL = 6;
const MAX_BULLETS = 3;
const STEP = 1 / 60;

interface Box { x: number; y: number; w: number; h: number; dead?: boolean }
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function createSpaceDuel(opts: CrtGameOptions): CrtGame {
  const maxHealth = opts.cheat ? 30 : 10;
  const you: Box = { x: 60, y: H / 2 - SHIP_H / 2, w: SHIP_W, h: SHIP_H };
  const cpu: Box = { x: W - 60 - SHIP_W, y: H / 2 - SHIP_H / 2, w: SHIP_W, h: SHIP_H };
  let yourBullets: Box[] = [];
  let cpuBullets: Box[] = [];
  let yourHealth = maxHealth;
  let cpuHealth = 10;
  let acc = 0;
  let flash = 0;
  const ai = { ty: cpu.y, tx: cpu.x, think: 0, fireCd: 50 };
  const stars = Array.from({ length: 90 }, (_, i) => ({ x: (i * 97) % W, y: TOP + ((i * 53) % (H - TOP)), s: (i % 3) + 1 }));

  const fire = (who: 'you' | 'cpu') => {
    if (who === 'you' && yourBullets.length < MAX_BULLETS) {
      yourBullets.push({ x: you.x + you.w, y: you.y + you.h / 2 - 2, w: 10, h: 4 });
      opts.sfx('zap');
    } else if (who === 'cpu' && cpuBullets.length < MAX_BULLETS) {
      cpuBullets.push({ x: cpu.x - 10, y: cpu.y + cpu.h / 2 - 2, w: 10, h: 4 });
      opts.sfx('zap');
    }
  };

  const clamp = (b: Box, minX: number, maxX: number) => {
    b.x = Math.max(minX, Math.min(maxX - b.w, b.x));
    b.y = Math.max(TOP, Math.min(H - b.h - 8, b.y));
  };

  function thinkAI() {
    // Re-plan a few times a second with some noise so the computer is beatable.
    if (--ai.think <= 0) {
      ai.think = 12 + Math.floor(Math.random() * 14);
      ai.ty = you.y + (Math.random() - 0.5) * 60;
      ai.tx = BORDER_X + 60 + Math.random() * (W - BORDER_X - 120);
      let threat: Box | null = null;
      for (const b of yourBullets) {
        if (b.x < cpu.x + cpu.w && cpu.x - b.x < 190 && b.y + b.h > cpu.y - 6 && b.y < cpu.y + cpu.h + 6) {
          if (!threat || b.x > threat.x) threat = b;
        }
      }
      if (threat && Math.random() < 0.72) ai.ty = threat.y < cpu.y + cpu.h / 2 ? threat.y + 26 : threat.y - cpu.h - 26;
    }
    const dy = ai.ty - cpu.y;
    const dx = ai.tx - cpu.x;
    if (Math.abs(dy) > 2) cpu.y += Math.sign(dy) * Math.min(VEL - 0.8, Math.abs(dy));
    if (Math.abs(dx) > 2) cpu.x += Math.sign(dx) * Math.min((VEL - 0.8) * 0.5, Math.abs(dx));
    clamp(cpu, BORDER_X + 8, W);
    if (--ai.fireCd <= 0) {
      const aligned = Math.abs(cpu.y - you.y) < 34;
      if (aligned || Math.random() < 0.02) {
        fire('cpu');
        ai.fireCd = 24 + Math.floor(Math.random() * 30);
      }
    }
  }

  function step(input: CrtInput) {
    const k = (...codes: string[]) => codes.some((c) => input.held.has(c));
    if (k('KeyA', 'ArrowLeft')) you.x -= VEL;
    if (k('KeyD', 'ArrowRight')) you.x += VEL;
    if (k('KeyW', 'ArrowUp')) you.y -= VEL;
    if (k('KeyS', 'ArrowDown')) you.y += VEL;
    clamp(you, 0, BORDER_X);
    thinkAI();
    for (const b of yourBullets) {
      b.x += BULLET_VEL;
      if (overlap(b, cpu)) { b.dead = true; cpuHealth--; flash = 0.15; opts.sfx('boom'); }
      else if (b.x > W) b.dead = true;
    }
    for (const b of cpuBullets) {
      b.x -= BULLET_VEL;
      if (overlap(b, you)) { b.dead = true; yourHealth--; flash = 0.15; opts.sfx('boom'); }
      else if (b.x < -10) b.dead = true;
    }
    yourBullets = yourBullets.filter((b) => !b.dead);
    cpuBullets = cpuBullets.filter((b) => !b.dead);
  }

  const game: CrtGame = {
    result: null,
    controls: 'WASD / arrows: move · Space or F: fire · Esc: quit',
    update(dt, input) {
      if (game.result) return;
      if (input.pressed.has('Space') || input.pressed.has('KeyF') || input.click) fire('you');
      acc += Math.min(dt, 0.1);
      while (acc >= STEP) {
        step(input);
        acc -= STEP;
      }
      flash = Math.max(0, flash - dt);
      if (cpuHealth <= 0) {
        game.result = 'YOU WIN!';
        opts.saveBest(opts.best + 1);
      } else if (yourHealth <= 0) game.result = 'CPU WINS';
    },
    draw(g) {
      g.fillStyle = '#04030c';
      g.fillRect(0, 0, W, H);
      for (const s of stars) {
        g.fillStyle = s.s === 3 ? '#fff' : s.s === 2 ? '#9ab' : '#456';
        g.fillRect(s.x, s.y, s.s, s.s);
      }
      g.fillStyle = '#2a2550';
      g.fillRect(BORDER_X, TOP, 8, H - TOP);
      ship(g, you, '#ffd23f', 1);
      ship(g, cpu, '#ff4d6d', -1);
      g.fillStyle = '#ffe680';
      for (const b of yourBullets) g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = '#ff6b81';
      for (const b of cpuBullets) g.fillRect(b.x, b.y, b.w, b.h);
      // HUD band
      g.fillStyle = '#120f2a';
      g.fillRect(0, 0, W, TOP);
      g.font = `bold 22px ${PIXEL_FONT}`;
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.fillStyle = '#ffd23f';
      g.fillText(`YOU ${'■'.repeat(Math.max(0, Math.min(yourHealth, 15)))}${yourHealth > 15 ? '+' : ''}`, 24, TOP / 2);
      g.textAlign = 'right';
      g.fillStyle = '#ff4d6d';
      g.fillText(`${'■'.repeat(Math.max(0, cpuHealth))} CPU`, W - 24, TOP / 2);
      if (flash > 0) {
        g.fillStyle = `rgba(255,255,255,${flash})`;
        g.fillRect(0, 0, W, H);
      }
    },
  };
  return game;
}

/** A small arrow-shaped fighter facing `dir` (1 = right). */
function ship(g: CanvasRenderingContext2D, b: Box, color: string, dir: 1 | -1) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  g.save();
  g.translate(cx, cy);
  g.scale(dir, 1);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(17, 0);
  g.lineTo(-12, -14);
  g.lineTo(-6, 0);
  g.lineTo(-12, 14);
  g.closePath();
  g.fill();
  g.fillStyle = '#fff';
  g.fillRect(-2, -3, 8, 6);
  g.fillStyle = '#7fd4ff';
  g.fillRect(-16, -4, 5, 8);
  g.restore();
}
