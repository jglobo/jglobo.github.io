// Procedural canvas textures for the bedroom: wallpaper, carpet, posters, the night
// window and the game box covers. Everything is drawn here, so there are no image
// files to license.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { PortfolioProject } from '../../content';
import { rng as mulberry32 } from '../../utils/random';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const MONO = '"Courier New", ui-monospace, monospace';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function texture(c: HTMLCanvasElement, repeat?: [number, number]) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

export function wallpaperTexture() {
  const { c, g } = canvas(256, 256);
  g.fillStyle = '#2b1838';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#331d42';
  for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 32, 256);
  // Tiny pixel stars, a very late-90s print.
  g.fillStyle = 'rgba(255, 200, 240, 0.18)';
  const rand = mulberry32(7);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rand() * 32) * 8;
    const y = Math.floor(rand() * 32) * 8;
    g.fillRect(x, y + 2, 6, 2);
    g.fillRect(x + 2, y, 2, 6);
  }
  return texture(c, [5, 1.6]);
}

export function carpetTexture() {
  const { c, g } = canvas(256, 256);
  g.fillStyle = '#3a3346';
  g.fillRect(0, 0, 256, 256);
  const rand = mulberry32(3);
  for (let i = 0; i < 5000; i++) {
    const v = 40 + Math.floor(rand() * 30);
    g.fillStyle = `rgb(${v + 8},${v},${v + 18})`;
    g.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  return texture(c, [6, 5]);
}

export function rugTexture() {
  const { c, g } = canvas(512, 512);
  const rings = ['#1e2a5a', '#ff3fb4', '#1e2a5a', '#19e6ff', '#1e2a5a', '#ffd23f', '#1e2a5a'];
  rings.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(256, 256, 256 - i * 34, 0, Math.PI * 2);
    g.fill();
  });
  return texture(c);
}

export function nightWindowTexture() {
  const { c, g } = canvas(512, 384);
  const sky = g.createLinearGradient(0, 0, 0, 384);
  sky.addColorStop(0, '#060b24');
  sky.addColorStop(1, '#1b2350');
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 384);
  const rand = mulberry32(11);
  for (let i = 0; i < 120; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.7})`;
    g.fillRect(rand() * 512, rand() * 260, rand() < 0.1 ? 3 : 2, rand() < 0.1 ? 3 : 2);
  }
  g.fillStyle = '#fff7d6';
  g.shadowColor = '#fff2b0';
  g.shadowBlur = 40;
  g.beginPath();
  g.arc(380, 90, 34, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  // Neighbourhood rooftops
  g.fillStyle = '#05060f';
  for (let x = 0; x < 512; x += 70) {
    const h = 40 + ((x * 37) % 50);
    g.fillRect(x, 384 - h, 64, h);
    g.beginPath();
    g.moveTo(x - 4, 384 - h);
    g.lineTo(x + 32, 384 - h - 26);
    g.lineTo(x + 68, 384 - h);
    g.fill();
    g.fillStyle = '#ffcf6b';
    if ((x / 70) % 2 === 0) g.fillRect(x + 22, 384 - h + 14, 10, 10);
    g.fillStyle = '#05060f';
  }
  return texture(c);
}

export type PosterKind = 'press-start' | 'pixel-pirates' | 'debug';

export function posterTexture(kind: PosterKind) {
  const { c, g } = canvas(360, 512);
  if (kind === 'press-start') {
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#1a0638');
    sky.addColorStop(0.55, '#ff3fb4');
    sky.addColorStop(0.56, '#120022');
    g.fillStyle = sky;
    g.fillRect(0, 0, 360, 512);
    // Striped synthwave sun
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.arc(180, 270, 90, Math.PI, 0);
    g.fill();
    g.fillStyle = '#ff3fb4';
    for (let i = 0; i < 5; i++) g.fillRect(90, 200 + i * 15, 180, 3 + i);
    g.strokeStyle = '#19e6ff';
    g.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.moveTo(180, 285);
      g.lineTo(-200 + i * 80, 512);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const y = 290 + i * i * 7;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(360, y);
      g.stroke();
    }
    g.font = `900 52px ${FONT}`;
    g.textAlign = 'center';
    g.fillStyle = '#fff';
    g.shadowColor = '#19e6ff';
    g.shadowBlur = 16;
    g.fillText('PRESS', 180, 82);
    g.fillText('START', 180, 138);
  } else if (kind === 'pixel-pirates') {
    g.fillStyle = '#0f6f8f';
    g.fillRect(0, 0, 360, 512);
    g.fillStyle = '#f6d28b';
    g.fillRect(0, 380, 360, 132);
    // Pixel ship
    const px = (x: number, y: number, w: number, h: number, col: string) => {
      g.fillStyle = col;
      g.fillRect(x * 10, y * 10, w * 10, h * 10);
    };
    px(8, 30, 20, 4, '#5a3214');
    px(10, 34, 16, 2, '#3e220d');
    px(17, 12, 2, 18, '#3e220d');
    px(11, 14, 6, 8, '#f4f1e8');
    px(19, 14, 7, 9, '#f4f1e8');
    px(17, 9, 5, 3, '#111');
    px(19, 10, 1, 1, '#fff');
    for (let i = 0; i < 6; i++) px(i * 6, 36 + (i % 2), 5, 1, '#9fe6ff');
    g.font = `900 46px ${FONT}`;
    g.textAlign = 'center';
    g.fillStyle = '#fff';
    g.fillText('PIXEL', 180, 70);
    g.fillText('PIRATES', 180, 120);
    g.font = `600 20px ${FONT}`;
    g.fillStyle = '#3e220d';
    g.fillText('NOW BOARDING · LEVEL 1-1', 180, 470);
  } else {
    g.fillStyle = '#101010';
    g.fillRect(0, 0, 360, 512);
    g.fillStyle = '#39ff88';
    const bug = ['  x    x  ', '   x  x   ', '  xxxxxx  ', ' xx xx xx ', 'xxxxxxxxxx', 'x xxxxxx x', 'x x    x x', '   xx xx  '];
    bug.forEach((row, y) => [...row].forEach((ch, x) => ch === 'x' && g.fillRect(55 + x * 25, 150 + y * 25, 23, 23)));
    g.font = `bold 40px ${MONO}`;
    g.textAlign = 'center';
    g.fillText('DEBUG', 180, 80);
    g.fillText('MODE', 180, 124);
    g.font = `18px ${MONO}`;
    g.fillStyle = '#9dffc4';
    g.fillText('it works on my machine', 180, 420);
    g.fillText('[ press ` in the hub ]', 180, 452);
  }
  return texture(c);
}

export function monitorTexture() {
  const { c, g } = canvas(320, 240);
  g.fillStyle = '#04140a';
  g.fillRect(0, 0, 320, 240);
  g.font = `14px ${MONO}`;
  g.fillStyle = '#5dff9a';
  const lines = ['jose@bedroom:~$ cd games', 'jose@bedroom:~/games$ ls', 'pirate/  flappy/  duel/  rpg/', 'jose@bedroom:~/games$ python', '  pirate/main.py', 'pygame 2.x  Hello from the', 'pygame community.', 'level 1 loaded ... ok', 'jose@bedroom:~/games$ _'];
  lines.forEach((l, i) => g.fillText(l, 12, 26 + i * 23));
  return texture(c);
}

// ---------- game boxes ----------

/** Front cover art for a game box. Known games get custom art; anything else gets a generic cover. */
export function boxCoverTexture(p: PortfolioProject) {
  const { c, g } = canvas(320, 440);
  const base = p.boxColor ?? '#4a2a6a';
  g.fillStyle = base;
  g.fillRect(0, 0, 320, 440);
  art(g, p.id, base);
  // Title band
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(0, 0, 320, 86);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  const words = p.title.toUpperCase();
  g.font = `900 ${words.length > 14 ? 30 : 36}px ${FONT}`;
  g.fillText(words, 160, 54, 300);
  // Platform strip
  g.fillStyle = '#ff3fb4';
  g.fillRect(0, 408, 320, 32);
  g.fillStyle = '#fff';
  g.font = `800 16px ${FONT}`;
  g.fillText(p.crtGame ? 'LOBO STATION · PLAYS ON TV' : 'LOBO STATION · PC / PYGAME', 160, 430);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 314, 434);
  return texture(c);
}

export function boxBackTexture(p: PortfolioProject) {
  const { c, g } = canvas(320, 440);
  g.fillStyle = '#16131f';
  g.fillRect(0, 0, 320, 440);
  g.fillStyle = p.boxColor ?? '#4a2a6a';
  g.fillRect(0, 0, 320, 10);
  g.fillStyle = '#fff';
  g.font = `800 22px ${FONT}`;
  g.fillText(p.title, 18, 46, 284);
  g.font = `15px ${FONT}`;
  g.fillStyle = '#d6d2e6';
  wrap(g, p.description, 18, 80, 284, 21);
  g.fillStyle = '#ffd23f';
  g.font = `700 14px ${FONT}`;
  g.fillText(p.technologies.join(' · '), 18, 380, 284);
  g.fillStyle = '#8f8aa6';
  g.font = `12px ${FONT}`;
  g.fillText('[E] Play on the TV   [I] Read the manual', 18, 414);
  return texture(c);
}

export function boxSpineTexture(p: PortfolioProject) {
  const { c, g } = canvas(64, 440);
  g.fillStyle = p.boxColor ?? '#4a2a6a';
  g.fillRect(0, 0, 64, 440);
  g.save();
  g.translate(32, 220);
  g.rotate(-Math.PI / 2);
  g.fillStyle = '#fff';
  g.font = `800 26px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(p.title.toUpperCase(), 0, 0, 400);
  g.restore();
  return texture(c);
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  const out: string[] = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = test;
  }
  if (line) out.push(line);
  out.slice(0, 13).forEach((l, i) => g.fillText(l, x, y + i * lh));
  return out;
}

function art(g: CanvasRenderingContext2D, id: string, base: string) {
  switch (id) {
    case 'pirate-platformer': {
      const sky = g.createLinearGradient(0, 86, 0, 408);
      sky.addColorStop(0, '#ffb347');
      sky.addColorStop(1, '#0f6f8f');
      g.fillStyle = sky;
      g.fillRect(0, 86, 320, 322);
      g.fillStyle = '#ffe08a';
      g.beginPath();
      g.arc(230, 190, 46, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0b4b63';
      g.fillRect(0, 320, 320, 88);
      // Ship silhouette
      g.fillStyle = '#2a170b';
      g.beginPath();
      g.moveTo(60, 300);
      g.lineTo(260, 300);
      g.lineTo(235, 335);
      g.lineTo(85, 335);
      g.fill();
      g.fillRect(156, 150, 8, 150);
      g.fillStyle = '#f4f1e8';
      g.fillRect(100, 165, 52, 70);
      g.fillRect(168, 165, 60, 80);
      g.fillStyle = '#111';
      g.fillRect(160, 132, 36, 22);
      g.fillStyle = '#fff';
      g.fillRect(174, 138, 8, 8);
      break;
    }
    case 'flappy-bird': {
      g.fillStyle = '#7fd0ff';
      g.fillRect(0, 86, 320, 322);
      g.fillStyle = '#3cb043';
      g.fillRect(30, 86, 60, 110);
      g.fillRect(30, 300, 60, 108);
      g.fillRect(220, 86, 60, 60);
      g.fillRect(220, 250, 60, 158);
      g.fillStyle = '#2a8a31';
      g.fillRect(24, 180, 72, 18);
      g.fillRect(24, 300, 72, 18);
      g.fillRect(214, 140, 72, 18);
      g.fillRect(214, 250, 72, 18);
      g.fillStyle = '#ffcc33';
      g.beginPath();
      g.ellipse(160, 240, 42, 34, -0.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(178, 225, 12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#222';
      g.fillRect(181, 221, 7, 7);
      g.fillStyle = '#ff7a29';
      g.fillRect(192, 238, 26, 12);
      break;
    }
    case 'space-duel': {
      g.fillStyle = '#05041a';
      g.fillRect(0, 86, 320, 322);
      const rand = mulberry32(5);
      for (let i = 0; i < 80; i++) {
        g.fillStyle = `rgba(255,255,255,${rand()})`;
        g.fillRect(rand() * 320, 86 + rand() * 322, 2, 2);
      }
      const ship = (x: number, y: number, col: string, dir: number) => {
        g.save();
        g.translate(x, y);
        g.scale(dir * 2.4, 2.4);
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(17, 0);
        g.lineTo(-12, -14);
        g.lineTo(-6, 0);
        g.lineTo(-12, 14);
        g.fill();
        g.restore();
      };
      ship(85, 200, '#ffd23f', 1);
      ship(240, 300, '#ff4d6d', -1);
      g.fillStyle = '#ffe680';
      g.fillRect(140, 198, 60, 5);
      g.fillStyle = '#ff6b81';
      g.fillRect(120, 298, 60, 5);
      break;
    }
    case 'zelda-rpg': {
      g.fillStyle = '#3f8f3a';
      g.fillRect(0, 86, 320, 322);
      g.fillStyle = '#2f6b2a';
      for (let y = 96; y < 408; y += 28) for (let x = (y / 28) % 2 ? 0 : 14; x < 320; x += 28) g.fillRect(x, y, 6, 6);
      // Shield
      g.fillStyle = '#2b4c9b';
      g.beginPath();
      g.moveTo(110, 170);
      g.lineTo(210, 170);
      g.lineTo(210, 260);
      g.quadraticCurveTo(160, 330, 110, 260);
      g.fill();
      g.strokeStyle = '#d9b44a';
      g.lineWidth = 8;
      g.stroke();
      // Sword across
      g.save();
      g.translate(160, 240);
      g.rotate(-0.7);
      g.fillStyle = '#e6eef5';
      g.fillRect(-8, -130, 16, 160);
      g.fillStyle = '#d9b44a';
      g.fillRect(-34, 30, 68, 12);
      g.fillStyle = '#6b3d1e';
      g.fillRect(-7, 42, 14, 44);
      g.restore();
      break;
    }
    default: {
      const grad = g.createLinearGradient(0, 86, 320, 408);
      grad.addColorStop(0, base);
      grad.addColorStop(1, '#120c22');
      g.fillStyle = grad;
      g.fillRect(0, 86, 320, 322);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      g.font = `900 180px ${FONT}`;
      g.textAlign = 'center';
      g.fillText('▶', 160, 320);
    }
  }
}
