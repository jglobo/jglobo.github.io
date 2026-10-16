// Software projects on Jose's roadside billboards (assets/billboard_blank.glb, his
// model) with animated previews drawn onto its screen. Driving or walking up to one
// offers [E] Inspect project.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasTexture, SRGBColorSpace, Vector3, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { loadGltf } from '../../utils/loadGltf';
import { assetUrl, projectsByCategory, type PortfolioProject } from '../../content';
import { useInteractable } from '../../engine/interaction/interactions';
import { releaseLock } from '../../engine/input/pointerLock';
import { track } from '../../analytics/track';
import { useGame } from '../../stores/gameStore';
import { BILLBOARD_SPOTS } from './layout';
import { BILLBOARD } from './neighborhood';
import billboardUrl from './assets/billboard_blank.glb?url';

/** The screen's middle, in world units. */
const SCREEN_Y = (BILLBOARD.screen.top - BILLBOARD.screen.h / 2) * BILLBOARD.scale;
/** Canvas size in the screen's 5.8 : 2.55 shape. */
const W = 1160;
const H = 510;

export const billboardProjects = () =>
  [...projectsByCategory('software')]
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (b.id === 'portal-hub' ? 1 : 0) - (a.id === 'portal-hub' ? 1 : 0))
    .slice(0, BILLBOARD_SPOTS.length)
    .map((project, i) => ({ project, spot: BILLBOARD_SPOTS[i] }));

export function Billboards() {
  const boards = useMemo(billboardProjects, []);
  const [model, setModel] = useState<Object3D | null>(null);
  useEffect(() => {
    let alive = true;
    let loaded: Object3D | null = null;
    loadGltf(billboardUrl).then(
      (g) => {
        loaded = g.scene;
        if (alive) setModel(g.scene);
        else disposeModel(g.scene);
      },
      (err) => console.error('Billboard model failed to load', err),
    );
    return () => {
      alive = false;
      if (loaded) disposeModel(loaded);
    };
  }, []);
  return (
    <>
      {boards.map(({ project, spot }) => (
        <Billboard key={project.id} project={project} x={spot.x} z={spot.z} model={model} />
      ))}
    </>
  );
}

function disposeModel(scene: Object3D) {
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const m of ([] as Material[]).concat(mesh.material)) m.dispose();
  });
}

/** A copy of the billboard whose screen shows this texture (after Jose's setBillboardTexture). */
function makeBoard(model: Object3D, texture: CanvasTexture) {
  const board = model.clone(true);
  board.traverse((o) => {
    if ((o as Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  const display = board.getObjectByName('Billboard_Display') as Mesh | undefined;
  if (!display) throw new Error('Billboard_Display mesh not found');
  const mat = (display.material as MeshStandardMaterial).clone();
  texture.flipY = false;
  texture.needsUpdate = true;
  mat.color.set(0xffffff);
  mat.map = texture;
  // Lit from within, so it reads in shade too.
  mat.emissive.set(0xffffff);
  mat.emissiveMap = texture;
  mat.emissiveIntensity = 0.85;
  display.material = mat;
  return { board, dispose: () => mat.dispose() };
}

function Billboard({ project, x, z, model }: { project: PortfolioProject; x: number; z: number; model: Object3D | null }) {
  const screen = useMemo(() => new BillboardScreen(project), [project]);
  useEffect(() => () => screen.dispose(), [screen]);
  const group = useRef<Object3D>(null);
  useEffect(() => {
    if (!model || !group.current) return;
    const { board, dispose } = makeBoard(model, screen.texture);
    const g = group.current;
    g.add(board);
    return () => {
      g.remove(board);
      dispose();
    };
  }, [model, screen]);
  const acc = useRef(0);

  const item = useMemo(() => {
    const pad = new Vector3(x, 0, z + 3);
    return {
      id: `billboard-${project.id}`,
      label: `[E] Inspect project: ${project.title}`,
      position: () => pad,
      radius: 10,
      onInteract: () => {
        track('project_viewed', { project: project.id, from: 'software-billboard' });
        releaseLock();
        useGame.getState().openProject(project.id);
      },
    };
  }, [project, x, z]);
  useInteractable(item);

  useFrame((state, dt) => {
    acc.current += dt;
    if (acc.current > 1 / 12) {
      acc.current = 0;
      screen.draw(state.clock.elapsedTime);
    }
  });

  return (
    <group position={[x, 0, z]}>
      <group ref={group} scale={BILLBOARD.scale} />
      {/* Glowing pad in front: drive onto it to inspect */}
      <mesh position={[0, 0.04, 3]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.2, 2.6, 40]} />
        <meshBasicMaterial color="#19e6ff" transparent opacity={0.7} />
      </mesh>
      <pointLight position={[0, SCREEN_Y, 3]} color="#9fe9ff" intensity={6} distance={14} />
    </group>
  );
}

/** Draws a project's billboard: screenshot or animated art, title, pitch, tech ticker. */
class BillboardScreen {
  readonly canvas = document.createElement('canvas');
  readonly texture: CanvasTexture;
  private g: CanvasRenderingContext2D;
  private img: HTMLImageElement | null = null;

  constructor(private p: PortfolioProject) {
    this.canvas.width = W;
    this.canvas.height = H;
    this.g = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    if (p.screenshots[0]) {
      this.img = new Image();
      this.img.src = assetUrl(p.screenshots[0]);
    }
    this.draw(0);
  }

  draw(t: number) {
    const { g, p } = this;
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#071a2a');
    bg.addColorStop(1, '#0f2f45');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Preview area on the right
    const px = 640;
    const py = 34;
    const pw = 486;
    const ph = 386;
    g.fillStyle = '#0a0f18';
    g.fillRect(px, py, pw, ph);
    if (p.id === 'portal-hub') this.drawPortal(px, py, pw, ph, t);
    else if (this.img?.complete && this.img.naturalWidth) {
      const s = Math.min(pw / this.img.naturalWidth, ph / this.img.naturalHeight);
      const w = this.img.naturalWidth * s;
      const h = this.img.naturalHeight * s;
      g.drawImage(this.img, px + (pw - w) / 2, py + (ph - h) / 2, w, h);
    }
    if (p.id === 'study-clock') this.drawClock(px, py, pw, t);
    if (p.id === 'page-bound') this.drawPages(px, py, pw, ph, t);
    g.strokeStyle = '#19e6ff';
    g.lineWidth = 4;
    g.strokeRect(px, py, pw, ph);

    // Text on the left
    g.fillStyle = '#19e6ff';
    g.font = '700 26px system-ui, sans-serif';
    g.fillText(p.demoUrl ? 'LIVE WEB APP' : 'OPEN SOURCE', 40, 70);
    g.fillStyle = '#ffffff';
    g.font = '900 54px system-ui, sans-serif';
    wrap(g, p.title, 40, 132, 570, 58, 2);
    g.fillStyle = '#cfe9f5';
    g.font = '400 27px system-ui, sans-serif';
    wrap(g, p.shortDescription, 40, 262, 570, 35, 4);

    // Ticker
    g.fillStyle = '#19e6ff';
    g.fillRect(0, H - 64, W, 64);
    g.fillStyle = '#04121c';
    g.font = '800 30px system-ui, sans-serif';
    const ticker = `${p.technologies.join('  ·  ')}  ·  PRESS E TO INSPECT  ·  `;
    const tw = g.measureText(ticker).width;
    const off = (t * 90) % tw;
    for (let x = -off; x < W; x += tw) g.fillText(ticker, x, H - 21);
    this.texture.needsUpdate = true;
  }

  private drawClock(px: number, py: number, pw: number, t: number) {
    const { g } = this;
    const left = 25 * 60 - (Math.floor(t) % (25 * 60));
    const mm = String(Math.floor(left / 60)).padStart(2, '0');
    const ss = String(left % 60).padStart(2, '0');
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillRect(px + pw - 190, py + 14, 176, 64);
    g.fillStyle = '#ffd23f';
    g.font = '800 48px ui-monospace, monospace';
    g.fillText(`${mm}:${ss}`, px + pw - 176, py + 64);
  }

  /** Scanned pages flying into a book, for the ebook builder. */
  private drawPages(px: number, py: number, pw: number, ph: number, t: number) {
    const { g } = this;
    const bx = px + pw - 150;
    const by = py + ph / 2 - 80;
    for (let i = 0; i < 5; i++) {
      const u = (t * 0.35 + i / 5) % 1;
      const x = px + 40 + u * (bx - px - 40);
      const y = py + 70 + i * 52 - u * (i * 52 - 90);
      g.save();
      g.translate(x, y);
      g.rotate((1 - u) * (i % 2 ? 0.25 : -0.2));
      g.globalAlpha = Math.min(1, (1 - u) * 3);
      g.fillStyle = '#f4f1e8';
      g.fillRect(-36, -48, 72, 96);
      g.fillStyle = '#9aa7b8';
      for (let l = 0; l < 6; l++) g.fillRect(-26, -34 + l * 13, l === 5 ? 30 : 52, 4);
      g.restore();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#1e5aa8';
    g.fillRect(bx, by, 120, 160);
    g.fillStyle = '#0f3a73';
    g.fillRect(bx, by, 14, 160);
    g.fillStyle = '#ffffff';
    g.font = '800 26px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('EPUB', bx + 67, by + 70);
    g.font = '700 20px system-ui, sans-serif';
    g.fillText('+ PDF', bx + 67, by + 102);
    g.textAlign = 'left';
  }

  private drawPortal(px: number, py: number, pw: number, ph: number, t: number) {
    const { g } = this;
    const cx = px + pw / 2;
    const cy = py + ph / 2;
    for (let i = 14; i > 0; i--) {
      const r = i * 13 + Math.sin(t * 2 + i) * 4;
      g.strokeStyle = `hsla(${(i * 22 + t * 60) % 360}, 90%, 65%, ${0.15 + i / 30})`;
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(cx, cy, r * 0.8, r, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#ffffff';
    g.font = '800 30px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('YOU ARE HERE', cx, py + ph - 24);
    g.textAlign = 'left';
  }

  dispose() {
    this.texture.dispose();
  }
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const words = text.split(' ');
  let line = '';
  let n = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y + n * lh);
      n++;
      line = w;
      if (n >= maxLines) return;
    } else line = test;
  }
  if (line && n < maxLines) g.fillText(line, x, y + n * lh);
}
