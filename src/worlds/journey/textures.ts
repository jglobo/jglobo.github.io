// Procedural textures for the Journey world. Small canvases with nearest-neighbour
// magnification, so the 3D town shares the chunky pixel look of the characters.
import { CanvasTexture, LinearFilter, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { rng } from '../../utils/random';
import { darken, lighten } from './sprites/pixelArt';

interface Opts { repeat?: [number, number]; smooth?: boolean }

export function makeTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, opts: Opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (!opts.smooth) t.magFilter = NearestFilter;
  t.anisotropy = 4;
  if (opts.repeat) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(...opts.repeat);
  }
  return t;
}

/** Near-white speckle multiplied over vertex-coloured ground. */
export const groundDetail = () =>
  makeTexture(64, 64, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 64, 64);
    const r = rng(11);
    for (let i = 0; i < 380; i++) {
      const v = 200 + Math.floor(r() * 40);
      g.fillStyle = `rgb(${v},${v + 8},${v - 10})`;
      g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 2);
    }
  }, { repeat: [48, 48] });

/** Cobblestones; tinted by the path's vertex colours. */
export const cobbleDetail = () =>
  makeTexture(32, 32, (g) => {
    g.fillStyle = '#a9a39a';
    g.fillRect(0, 0, 32, 32);
    const r = rng(5);
    for (let y = 0; y < 32; y += 8) {
      const off = (y / 8) % 2 ? 4 : 0;
      for (let x = -8; x < 32; x += 8) {
        const v = 225 + Math.floor(r() * 30);
        g.fillStyle = `rgb(${v},${v},${v - 6})`;
        g.fillRect(x + off + 1, y + 1, 6, 6);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(x + off + 1, y + 1, 5, 1);
      }
    }
  }, { repeat: [1, 1] });

export const brickTexture = (base: string, rx: number, ry: number) =>
  makeTexture(32, 32, (g) => {
    g.fillStyle = lighten(base, 0.45);
    g.fillRect(0, 0, 32, 32);
    const r = rng(base.length * 7);
    for (let y = 0; y < 32; y += 4) {
      const off = (y / 4) % 2 ? 4 : 0;
      for (let x = -8; x < 32; x += 8) {
        g.fillStyle = r() < 0.3 ? darken(base, 0.12) : r() < 0.2 ? lighten(base, 0.08) : base;
        g.fillRect(x + off, y, 7, 3);
      }
    }
  }, { repeat: [rx, ry] });

export const sidingTexture = (base: string, rx: number, ry: number) =>
  makeTexture(16, 16, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y += 4) {
      g.fillStyle = darken(base, 0.16);
      g.fillRect(0, y + 3, 16, 1);
      g.fillStyle = lighten(base, 0.12);
      g.fillRect(0, y, 16, 1);
    }
  }, { repeat: [rx, ry] });

export const plasterTexture = (base: string, rx: number, ry: number, seed = 3) =>
  makeTexture(32, 32, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 32, 32);
    const r = rng(seed);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = r() < 0.5 ? darken(base, 0.05) : lighten(base, 0.05);
      g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 2, 1);
    }
  }, { repeat: [rx, ry] });

export const shingleTexture = (base: string, rx: number, ry: number) =>
  makeTexture(16, 16, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y += 4) {
      const off = (y / 4) % 2 ? 2 : 0;
      g.fillStyle = darken(base, 0.25);
      g.fillRect(0, y + 3, 16, 1);
      for (let x = off; x < 16; x += 4) g.fillRect(x, y, 1, 3);
    }
  }, { repeat: [rx, ry] });

/**
 * One window per tile on a wall colour. `lit` is the share of warm, glowing
 * windows; the same texture doubles as the emissive map so windows glow at dusk.
 */
export function windowTiles(wall: string, frame: string, lit: number, seed: number, cols: number, rows: number, arch = false) {
  const tw = 16;
  const th = 16;
  const color = makeTexture(tw * cols, th * rows, (g) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, tw * cols, th * rows);
    const r = rng(seed);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * tw + 4;
        const y = j * th + 3;
        g.fillStyle = frame;
        g.fillRect(x - 1, y - 1, 10, 11);
        const on = r() < lit;
        g.fillStyle = on ? (r() < 0.6 ? '#ffd68a' : '#ffe9b8') : '#3c4a68';
        g.fillRect(x, y, 8, 9);
        if (arch) {
          g.fillStyle = wall;
          g.fillRect(x - 1, y - 1, 2, 2);
          g.fillRect(x + 7, y - 1, 2, 2);
        }
        g.fillStyle = frame;
        g.fillRect(x + 3, y, 2, 9);
        g.fillRect(x, y + 4, 8, 1);
      }
    }
  });
  const glow = makeTexture(tw * cols, th * rows, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, tw * cols, th * rows);
    const r = rng(seed);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const on = r() < lit;
        const warm = r() < 0.6;
        if (on) {
          g.fillStyle = warm ? '#ffb347' : '#ffd890';
          g.fillRect(i * tw + 4, j * th + 3, 8, 9);
        }
      }
    }
  });
  return { color, glow };
}

/** Glass curtain wall for the modern tower. */
export function glassTiles(seed: number, cols: number, rows: number) {
  const color = makeTexture(8 * cols, 8 * rows, (g) => {
    const r = rng(seed);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const on = r() < 0.45;
        g.fillStyle = on ? '#ffe2a6' : j % 3 === 0 ? '#6f9bc8' : '#4f78a8';
        g.fillRect(i * 8, j * 8, 8, 8);
        g.fillStyle = '#c9d7e6';
        g.fillRect(i * 8, j * 8, 8, 1);
        g.fillRect(i * 8, j * 8, 1, 8);
      }
    }
  });
  const glow = makeTexture(8 * cols, 8 * rows, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 8 * cols, 8 * rows);
    const r = rng(seed);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (r() < 0.45) {
          g.fillStyle = '#ffc36b';
          g.fillRect(i * 8 + 1, j * 8 + 1, 7, 7);
        }
      }
    }
  });
  return { color, glow };
}

export const stripeTexture = (a: string, b: string) =>
  makeTexture(16, 4, (g) => {
    for (let x = 0; x < 16; x += 4) {
      g.fillStyle = (x / 4) % 2 ? a : b;
      g.fillRect(x, 0, 4, 4);
    }
  });

/** Wooden signboard with a title and a smaller line under it. */
export function signTexture(title: string, sub: string, opts: { bg?: string; fg?: string; accent?: string } = {}) {
  const t = makeTexture(512, 160, (g) => {
    g.fillStyle = opts.bg ?? '#5a3a22';
    g.fillRect(0, 0, 512, 160);
    g.strokeStyle = opts.accent ?? '#e8b04a';
    g.lineWidth = 8;
    g.strokeRect(8, 8, 496, 144);
    g.fillStyle = opts.fg ?? '#fff3d6';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 58;
    g.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
    while (g.measureText(title).width > 460 && size > 24) g.font = `700 ${(size -= 2)}px Georgia, 'Times New Roman', serif`;
    g.fillText(title, 256, sub ? 62 : 80);
    if (sub) {
      g.fillStyle = opts.accent ?? '#e8b04a';
      g.font = `600 34px ui-monospace, Menlo, Consolas, monospace`;
      g.fillText(sub, 256, 120);
    }
  }, { smooth: true });
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** Soft round glow for lamps, motes and the dog's hearts. */
export const glowTexture = () =>
  makeTexture(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,230,180,0.55)');
    grad.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }, { smooth: true });

export const heartTexture = () =>
  makeTexture(9, 8, (g) => {
    const rows = ['.XX...XX.', 'XooX.XooX', 'XoooXoooX', 'XoooooooX', '.XoooooX.', '..XoooX..', '...XoX...', '....X....'];
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        g.fillStyle = ch === 'X' ? '#7a1c2c' : '#ff5a7a';
        g.fillRect(x, y, 1, 1);
      }),
    );
  });

export const blobTexture = () =>
  makeTexture(32, 32, (g) => {
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(30,15,10,0.55)');
    grad.addColorStop(1, 'rgba(30,15,10,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
  }, { smooth: true });
