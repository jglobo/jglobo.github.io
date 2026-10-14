import { BufferGeometry, ConeGeometry, ExtrudeGeometry, Shape } from 'three';

/** Gable roof: a triangular prism with its ridge along x, base on y = 0. */
export function prismGeometry(w: number, h: number, d: number): BufferGeometry {
  const s = new Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(d / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.center();
  g.translate(0, h / 2, 0);
  return g;
}

/** Hip roof: a four-sided pyramid w x d at the base. */
export function pyramidGeometry(w: number, h: number, d: number): BufferGeometry {
  const g = new ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}
