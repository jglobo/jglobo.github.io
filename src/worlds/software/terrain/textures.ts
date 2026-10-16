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
