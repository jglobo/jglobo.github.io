// Flappy Bird clone for the TV: the same loop as Jose's Pygame version (gravity,
// flap, scrolling pipe pairs, a point per pipe) drawn with simple original shapes.
import { PIXEL_FONT, type CrtGame, type CrtGameOptions } from './types';
import { FLAPPY, stepFlappy, type FlappyState } from './flappyPhysics';

const { W, H, GROUND, PIPE_W, PIPE_SPEED, SPACING } = FLAPPY;

export function createFlappy(opts: CrtGameOptions): CrtGame {
  const s: FlappyState = { y: H / 2, vy: 0, pipes: [], score: 0, dead: false };
  let started = false;
  let scroll = 0;
  let t = 0;
  let deadTime = 0;
  const gap = opts.cheat ? 190 : 150;
  const addPipe = (x: number) => s.pipes.push({ x, gapY: 120 + Math.random() * (GROUND - 240), gap });
  for (let i = 0; i < 4; i++) addPipe(W + 120 + i * SPACING);

  const game: CrtGame = {
    result: null,
    controls: 'Space / W / click: flap · Esc: quit',
    update(dt, input) {
      dt = Math.min(dt, 0.05);
      t += dt;
      const flap = input.pressed.has('Space') || input.pressed.has('KeyW') || input.pressed.has('ArrowUp') || input.click;
      if (!started) {
        s.y = H / 2 + Math.sin(t * 4) * 8;
        if (flap) started = true;
        else return;
      }
      if (s.dead) {
        deadTime += dt;
        if (deadTime > 1.2 && !game.result) {
          if (s.score > opts.best) opts.saveBest(s.score);
          game.result = `SCORE ${s.score}`;
        }
        return;
      }
      if (flap) opts.sfx('flap');
      scroll += PIPE_SPEED * dt;
      if (stepFlappy(s, dt, flap)) opts.sfx('point');
      if (s.dead) opts.sfx('boom');
      if (s.pipes[0] && s.pipes[0].x < -PIPE_W) {
        s.pipes.shift();
        addPipe(s.pipes[s.pipes.length - 1].x + SPACING);
      }
    },
    draw(g) {
      const sky = g.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#3a7bd5');
      sky.addColorStop(1, '#9fd8ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, GROUND);
      // Far hills
      g.fillStyle = '#7cc6a0';
      for (let i = -1; i < 6; i++) {
        const x = i * 160 - ((scroll * 0.3) % 160);
        g.beginPath();
        g.arc(x + 80, GROUND, 90, Math.PI, 0);
        g.fill();
      }
      for (const p of s.pipes) {
        const top = p.gapY - p.gap / 2;
        const bottom = p.gapY + p.gap / 2;
        g.fillStyle = '#3cb043';
        g.fillRect(p.x, 0, PIPE_W, top);
        g.fillRect(p.x, bottom, PIPE_W, GROUND - bottom);
        g.fillStyle = '#2a8a31';
        g.fillRect(p.x - 5, top - 22, PIPE_W + 10, 22);
        g.fillRect(p.x - 5, bottom, PIPE_W + 10, 22);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(p.x + 8, 0, 8, top - 22);
        g.fillRect(p.x + 8, bottom + 22, 8, GROUND - bottom - 22);
      }
      // Ground
      g.fillStyle = '#d9c27a';
      g.fillRect(0, GROUND, W, H - GROUND);
      g.fillStyle = '#b89f55';
      for (let x = -((scroll) % 32); x < W; x += 32) g.fillRect(x, GROUND, 16, 8);
      // Bird
      g.save();
      g.translate(160, s.y);
      g.rotate(Math.max(-0.5, Math.min(1.2, s.vy / 600)));
      g.fillStyle = '#ffcc33';
      g.beginPath();
      g.ellipse(0, 0, 17, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(7, -5, 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#222';
      g.fillRect(8, -6, 3, 3);
      g.fillStyle = '#ff7a29';
      g.fillRect(12, 0, 10, 5);
      g.fillStyle = '#f2a900';
      const wing = Math.sin(t * 20) > 0 ? -4 : 3;
      g.fillRect(-12, wing, 12, 6);
      g.restore();
      // Score
      g.font = `bold 44px ${PIXEL_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.lineWidth = 6;
      g.strokeStyle = '#1b1b1b';
      g.strokeText(String(s.score), W / 2, 22);
      g.fillStyle = '#fff';
      g.fillText(String(s.score), W / 2, 22);
      if (!started) {
        g.font = `bold 26px ${PIXEL_FONT}`;
        g.strokeText('PRESS SPACE TO FLAP', W / 2, H / 2 + 50);
        g.fillText('PRESS SPACE TO FLAP', W / 2, H / 2 + 50);
        g.font = `18px ${PIXEL_FONT}`;
        g.fillText(`BEST ${opts.best}`, W / 2, H / 2 + 90);
      }
    },
  };
  return game;
}
