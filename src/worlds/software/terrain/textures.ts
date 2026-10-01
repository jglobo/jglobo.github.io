// Procedural textures for the Software world (no image files to license).
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { rng } from '../../../utils/random';

function make(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

export const grassTexture = () =>
  make(256, 256, (g) => {
    g.fillStyle = '#4f8a3c';
    g.fillRect(0, 0, 256, 256);
    const r = rng(4);
    for (let i = 0; i < 3500; i++) {
      const v = Math.floor(r() * 40);
      g.fillStyle = `rgb(${60 + v},${110 + v},${50 + v / 2})`;
      g.fillRect(r() * 256, r() * 256, 2, 3);
    }
  }, [36, 36]);

/** Asphalt strip with a dashed centre line; u runs along the road. */
export const roadTexture = () =>
  make(256, 64, (g) => {
    g.fillStyle = '#3a3d45';
    g.fillRect(0, 0, 256, 64);
    const r = rng(8);
    for (let i = 0; i < 900; i++) {
      const v = 50 + Math.floor(r() * 25);
      g.fillStyle = `rgb(${v},${v},${v + 6})`;
      g.fillRect(r() * 256, r() * 64, 2, 2);
    }
    g.fillStyle = '#e8e2c8';
    g.fillRect(0, 2, 256, 2);
    g.fillRect(0, 60, 256, 2);
    g.fillStyle = '#ffd23f';
    for (let x = 0; x < 256; x += 64) g.fillRect(x, 30, 36, 4);
  });

export const windowsTexture = (seed: number) =>
  make(128, 256, (g) => {
    g.fillStyle = '#1b2233';
    g.fillRect(0, 0, 128, 256);
    const r = rng(seed);
    for (let y = 6; y < 256; y += 16) {
      for (let x = 6; x < 128; x += 16) {
        const lit = r() < 0.45;
        g.fillStyle = lit ? (r() < 0.5 ? '#ffe7a3' : '#bfe6ff') : '#2c3650';
        g.fillRect(x, y, 10, 10);
      }
    }
  });

export const dirtTexture = () =>
  make(128, 128, (g) => {
    g.fillStyle = '#8a6a44';
    g.fillRect(0, 0, 128, 128);
    const r = rng(12);
    for (let i = 0; i < 900; i++) {
      const v = Math.floor(r() * 40);
      g.fillStyle = `rgb(${110 + v},${84 + v},${54 + v / 2})`;
      g.fillRect(r() * 128, r() * 128, 2, 2);
    }
  }, [4, 4]);
