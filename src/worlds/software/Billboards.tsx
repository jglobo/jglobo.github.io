// Software projects as giant roadside billboards with animated previews. Driving or
// walking up to one offers [E] Inspect project.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, SRGBColorSpace, Vector3 } from 'three';
import { assetUrl, projectsByCategory, type PortfolioProject } from '../../content';
import { useInteractable } from '../../engine/interaction/interactions';
import { releaseLock } from '../../engine/input/pointerLock';
import { track } from '../../analytics/track';
import { useGame } from '../../stores/gameStore';
import { BILLBOARD_POST_HALF, BILLBOARD_SPOTS } from './layout';

const SCREEN_W = 12;
const SCREEN_H = 6.75;
const SCREEN_Y = 7.6;

export const billboardProjects = () =>
  [...projectsByCategory('software')]
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (b.id === 'portal-hub' ? 1 : 0) - (a.id === 'portal-hub' ? 1 : 0))
    .slice(0, BILLBOARD_SPOTS.length)
    .map((project, i) => ({ project, spot: BILLBOARD_SPOTS[i] }));

export function Billboards() {
  const boards = useMemo(billboardProjects, []);
  return (
    <>
      {boards.map(({ project, spot }) => (
        <Billboard key={project.id} project={project} x={spot.x} z={spot.z} />
      ))}
    </>
  );
}

function Billboard({ project, x, z }: { project: PortfolioProject; x: number; z: number }) {
  const screen = useMemo(() => new BillboardScreen(project), [project]);
  useEffect(() => () => screen.dispose(), [screen]);
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
      {[-BILLBOARD_POST_HALF, BILLBOARD_POST_HALF].map((px) => (
        <mesh key={px} position={[px, SCREEN_Y / 2, -0.2]} castShadow>
          <cylinderGeometry args={[0.28, 0.35, SCREEN_Y, 8]} />
          <meshStandardMaterial color="#4a505c" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, SCREEN_Y, -0.35]} castShadow>
        <boxGeometry args={[SCREEN_W + 0.6, SCREEN_H + 0.6, 0.4]} />
        <meshStandardMaterial color="#20242c" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, SCREEN_Y, -0.14]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial map={screen.texture} toneMapped={false} />
      </mesh>
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
    this.canvas.width = 1024;
    this.canvas.height = 576;
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
    const W = 1024;
    const H = 576;
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#071a2a');
    bg.addColorStop(1, '#0f2f45');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Preview area on the right
    const px = 520;
    const py = 60;
    const pw = 460;
    const ph = 400;
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
    g.strokeStyle = '#19e6ff';
    g.lineWidth = 4;
    g.strokeRect(px, py, pw, ph);

    // Text on the left
    g.fillStyle = '#19e6ff';
    g.font = '700 26px system-ui, sans-serif';
    g.fillText(p.demoUrl ? 'LIVE WEB APP' : 'OPEN SOURCE', 40, 86);
    g.fillStyle = '#ffffff';
    g.font = '900 52px system-ui, sans-serif';
    wrap(g, p.title, 40, 150, 450, 56, 3);
    g.fillStyle = '#cfe9f5';
    g.font = '400 26px system-ui, sans-serif';
    wrap(g, p.shortDescription, 40, 330, 450, 34, 4);

    // Ticker
    g.fillStyle = '#19e6ff';
    g.fillRect(0, H - 70, W, 70);
    g.fillStyle = '#04121c';
    g.font = '800 30px system-ui, sans-serif';
    const ticker = `${p.technologies.join('  ·  ')}  ·  PRESS E TO INSPECT  ·  `;
    const tw = g.measureText(ticker).width;
    const off = (t * 90) % tw;
    for (let x = -off; x < W; x += tw) g.fillText(ticker, x, H - 24);
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
