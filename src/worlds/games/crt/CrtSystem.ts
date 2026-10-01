// Everything shown on the TV: idle screen, console boot, the cartridge menu, the
// built-in games, screenshots and messages. Draws into one 640x480 canvas that the
// TV mesh uses as a texture.
import { CanvasTexture, SRGBColorSpace } from 'three';
import { assetUrl, type PortfolioProject } from '../../../content';
import type { SfxName } from '../../../engine/audio/AudioManager';
import { loadBest, saveBest } from '../roomStore';
import { createFlappy } from './flappy';
import { createSpaceDuel } from './spaceDuel';
import { PIXEL_FONT, SCREEN_H, SCREEN_W, type CrtGame, type CrtInput } from './types';

type Screen = 'idle' | 'boot' | 'menu' | 'playing' | 'result' | 'screenshot' | 'message';
type MenuItem = 'PLAY' | 'PROJECT INFO' | 'SOURCE' | 'SCREENSHOTS' | 'BACK';
export const MENU: MenuItem[] = ['PLAY', 'PROJECT INFO', 'SOURCE', 'SCREENSHOTS', 'BACK'];

export interface CrtCallbacks {
  sfx: (name: SfxName) => void;
  openInfo: (project: PortfolioProject) => void;
  openUrl: (url: string, project: PortfolioProject) => void;
  /** BACK from the menu: stand up from the TV. */
  exit: () => void;
  cheat: () => boolean;
}

const sourceUrl = (p: PortfolioProject) => p.githubUrl ?? (p.downloadUrl ? assetUrl(p.downloadUrl) : undefined);

export class CrtSystem {
  readonly canvas = document.createElement('canvas');
  readonly texture: CanvasTexture;
  private g: CanvasRenderingContext2D;
  private screen: Screen = 'idle';
  private t = 0;
  private screenT = 0;
  private project: PortfolioProject | null = null;
  private selected = 0;
  private game: CrtGame | null = null;
  private message: string[] = [];
  private image: HTMLImageElement | null = null;
  private cheatFlash = 0;

  constructor(private cb: CrtCallbacks) {
    this.canvas.width = SCREEN_W;
    this.canvas.height = SCREEN_H;
    this.g = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
  }

  get state() {
    return this.screen;
  }

  get playing() {
    return this.screen === 'playing';
  }

  /** HUD line for the current screen. */
  get controls() {
    if (this.screen === 'playing' && this.game) return this.game.controls;
    if (this.screen === 'menu') return '↑/↓ or W/S: choose · Enter or E: select · Esc: stand up';
    if (this.screen === 'screenshot' || this.screen === 'message' || this.screen === 'result') return 'Enter or Esc: back to the menu';
    return 'Esc: stand up';
  }

  insert(project: PortfolioProject) {
    this.project = project;
    this.selected = 0;
    this.go('boot');
    this.cb.sfx('boot');
  }

  eject() {
    this.project = null;
    this.game = null;
    this.go('idle');
  }

  /** Returns to the cartridge menu after the console has booted. */
  resume() {
    if (this.project && this.screen === 'idle') this.go('menu');
  }

  celebrateCheat() {
    this.cheatFlash = 3;
    this.cb.sfx('point');
  }

  /** Esc. Returns false when the TV has nothing to back out of (caller stands up). */
  back(): boolean {
    if (this.screen === 'playing' || this.screen === 'result' || this.screen === 'screenshot' || this.screen === 'message') {
      this.game = null;
      this.go('menu');
      this.cb.sfx('blip');
      return true;
    }
    return false;
  }

  /** Click on the screen at texture coordinates (0..1, origin bottom-left). */
  click(u: number, v: number) {
    if (this.screen !== 'menu') return;
    const y = (1 - v) * SCREEN_H;
    const i = Math.floor((y - MENU_TOP) / MENU_STEP);
    if (u > 0.15 && u < 0.85 && i >= 0 && i < MENU.length) {
      this.selected = i;
      this.choose();
    }
  }

  update(dt: number, input: CrtInput) {
    this.t += dt;
    this.screenT += dt;
    this.cheatFlash = Math.max(0, this.cheatFlash - dt);
    const p = input.pressed;
    const confirm = p.has('Enter') || p.has('NumpadEnter') || p.has('KeyE') || p.has('Space');

    switch (this.screen) {
      case 'boot':
        if (this.screenT > 2.4 || (this.screenT > 0.6 && confirm)) this.go('menu');
        break;
      case 'menu':
        if (p.has('ArrowUp') || p.has('KeyW')) this.move(-1);
        if (p.has('ArrowDown') || p.has('KeyS')) this.move(1);
        if (confirm && this.screenT > 0.15) this.choose();
        break;
      case 'playing':
        this.game!.update(dt, input);
        if (this.game!.result) {
          this.message = [this.game!.result];
          this.go('result');
        }
        break;
      case 'result':
        if (this.screenT > 2.6 || (this.screenT > 0.8 && confirm)) {
          this.game = null;
          this.go('menu');
        }
        break;
      case 'screenshot':
      case 'message':
        if (confirm && this.screenT > 0.2) this.go('menu');
        break;
    }
    this.draw();
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }

  private go(s: Screen) {
    this.screen = s;
    this.screenT = 0;
  }

  private move(d: number) {
    this.selected = (this.selected + d + MENU.length) % MENU.length;
    this.cb.sfx('blip');
  }

  private choose() {
    const p = this.project;
    if (!p) return;
    this.cb.sfx('select');
    switch (MENU[this.selected]) {
      case 'PLAY': {
        if (!p.crtGame) {
          this.message = ['THIS CARTRIDGE RUNS ON', 'DESKTOP (PYTHON + PYGAME).', '', p.downloadUrl ? 'CHOOSE SOURCE TO DOWNLOAD IT,' : 'ASK JOSE FOR A DEMO,', 'OR PICK A GAME MARKED', '"PLAYS ON TV" FROM THE SHELF.'];
          this.go('message');
          return;
        }
        const id = p.crtGame;
        const opts = { sfx: this.cb.sfx, cheat: this.cb.cheat(), best: loadBest(id), saveBest: (s: number) => saveBest(id, s) };
        this.game = id === 'space-duel' ? createSpaceDuel(opts) : createFlappy(opts);
        this.go('playing');
        return;
      }
      case 'PROJECT INFO':
        this.cb.openInfo(p);
        return;
      case 'SOURCE': {
        const url = sourceUrl(p);
        if (url) {
          this.cb.openUrl(url, p);
          this.message = ['OPENING IN A NEW TAB...', '', p.githubUrl ? 'SOURCE CODE ON GITHUB' : 'DOWNLOADING THE GAME (.ZIP)', 'WITH ITS PYTHON SOURCE.'];
        } else {
          this.message = ['SOURCE AVAILABLE', 'ON REQUEST.', '', 'CONTACT DETAILS ARE IN', 'THE QUICK PORTFOLIO (TAB).'];
        }
        this.go('message');
        return;
      }
      case 'SCREENSHOTS': {
        const src = p.screenshots[0];
        if (!src) {
          this.message = ['NO SCREENSHOTS YET.'];
          this.go('message');
          return;
        }
        this.image = new Image();
        this.image.src = assetUrl(src);
        this.go('screenshot');
        return;
      }
      case 'BACK':
        this.cb.exit();
        return;
    }
  }

  // ---------- drawing ----------

  private draw() {
    const g = this.g;
    g.save();
    switch (this.screen) {
      case 'idle': this.drawIdle(); break;
      case 'boot': this.drawBoot(); break;
      case 'menu': this.drawMenu(); break;
      case 'playing': this.game!.draw(g); break;
      case 'result': this.drawResult(); break;
      case 'screenshot': this.drawScreenshot(); break;
      case 'message': this.drawMessage(); break;
    }
    g.restore();
    if (this.cheatFlash > 0) this.drawCheat();
  }

  private text(s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', weight = 'bold') {
    const g = this.g;
    g.font = `${weight} ${size}px ${PIXEL_FONT}`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  private drawIdle() {
    const g = this.g;
    g.fillStyle = '#0a0820';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    // Bouncing console logo, screensaver style.
    const x = 70 + Math.abs(((this.t * 60) % 440) - 220) * 2;
    const y = 90 + Math.abs(((this.t * 45) % 260) - 130) * 2;
    const hue = Math.floor(this.t * 20) % 360;
    this.text('LOBO', Math.min(x, SCREEN_W - 90), Math.min(y, SCREEN_H - 120), 38, `hsl(${hue} 90% 65%)`);
    this.text('STATION', Math.min(x, SCREEN_W - 90), Math.min(y, SCREEN_H - 120) + 32, 20, `hsl(${hue} 90% 80%)`);
    if (Math.floor(this.t * 1.6) % 2 === 0) this.text('INSERT A GAME FROM THE SHELF', SCREEN_W / 2, SCREEN_H - 50, 22, '#cfd6ff');
  }

  private drawBoot() {
    const g = this.g;
    const t = this.screenT;
    g.fillStyle = '#000';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    if (t < 0.5) {
      // Colour bars while the tube warms up.
      const bars = ['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f'];
      bars.forEach((c, i) => {
        g.fillStyle = c;
        g.globalAlpha = Math.min(1, t * 3);
        g.fillRect((i * SCREEN_W) / bars.length, 0, SCREEN_W / bars.length + 1, SCREEN_H);
      });
      g.globalAlpha = 1;
      return;
    }
    const k = Math.min(1, (t - 0.5) / 0.6);
    const grad = g.createLinearGradient(0, 0, SCREEN_W, 0);
    grad.addColorStop(0, '#ff3fb4');
    grad.addColorStop(1, '#3d7bff');
    g.globalAlpha = k;
    g.fillStyle = grad;
    g.fillRect(SCREEN_W / 2 - 170 * k, SCREEN_H / 2 - 70, 340 * k, 6);
    g.fillRect(SCREEN_W / 2 - 170 * k, SCREEN_H / 2 + 64, 340 * k, 6);
    this.text('LOBO STATION', SCREEN_W / 2, SCREEN_H / 2 - 10, 46);
    this.text('© 2026 ORIGINAL HARDWARE', SCREEN_W / 2, SCREEN_H / 2 + 36, 16, '#aab');
    if (t > 1.3 && this.project) this.text(`LOADING ${this.project.title.toUpperCase()}...`, SCREEN_W / 2, SCREEN_H - 60, 18, '#cfd6ff');
    g.globalAlpha = 1;
  }

  private drawMenu() {
    const g = this.g;
    const p = this.project!;
    const color = p.boxColor ?? '#ff3fb4';
    g.fillStyle = '#0b0a1c';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    g.fillStyle = color;
    g.fillRect(0, 0, SCREEN_W, 96);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < SCREEN_W; x += 8) g.fillRect(x, 0, 4, 96);
    this.text(p.title.toUpperCase(), SCREEN_W / 2, 40, p.title.length > 18 ? 30 : 36);
    this.text(p.technologies.join(' · ').toUpperCase(), SCREEN_W / 2, 76, 15, '#fff', 'center', 'normal');
    MENU.forEach((item, i) => {
      const y = MENU_TOP + i * MENU_STEP + MENU_STEP / 2;
      const on = i === this.selected;
      if (on) {
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(110, y - MENU_STEP / 2 + 4, SCREEN_W - 220, MENU_STEP - 8);
      }
      let label: string = item;
      if (item === 'PLAY' && !p.crtGame) label = 'PLAY (DESKTOP)';
      if (item === 'SOURCE' && !p.githubUrl && p.downloadUrl) label = 'SOURCE (.ZIP)';
      this.text(label, SCREEN_W / 2, y, 26, on ? '#ffe066' : '#d8dcff');
      if (on && Math.floor(this.t * 3) % 2 === 0) this.text('▶', 140, y, 24, '#ffe066');
    });
    if (p.crtGame) {
      const best = loadBest(p.crtGame);
      this.text(p.crtGame === 'space-duel' ? `WINS VS CPU: ${best}` : `BEST SCORE: ${best}`, SCREEN_W / 2, SCREEN_H - 34, 16, '#9aa0c8', 'center', 'normal');
    }
  }

  private drawResult() {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,0.08)';
    if (this.game) this.game.draw(g);
    g.fillStyle = 'rgba(0,0,10,0.55)';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    this.text(this.message[0] ?? '', SCREEN_W / 2, SCREEN_H / 2, 56, '#ffe066');
  }

  private drawScreenshot() {
    const g = this.g;
    g.fillStyle = '#000';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const img = this.image;
    if (img && img.complete && img.naturalWidth) {
      const s = Math.min(SCREEN_W / img.naturalWidth, (SCREEN_H - 50) / img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      g.drawImage(img, (SCREEN_W - w) / 2, (SCREEN_H - 50 - h) / 2, w, h);
    } else {
      this.text(img && img.complete ? 'SCREENSHOT UNAVAILABLE' : 'LOADING...', SCREEN_W / 2, SCREEN_H / 2, 22);
    }
    this.text('PROJECT INFO HAS THE ANIMATED VERSION', SCREEN_W / 2, SCREEN_H - 24, 16, '#cfd6ff', 'center', 'normal');
  }

  private drawMessage() {
    const g = this.g;
    g.fillStyle = '#0018a8';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const top = SCREEN_H / 2 - (this.message.length * 34) / 2;
    this.message.forEach((line, i) => this.text(line, SCREEN_W / 2, top + i * 34, 24));
    if (Math.floor(this.t * 1.6) % 2 === 0) this.text('PRESS ENTER', SCREEN_W / 2, SCREEN_H - 40, 18, '#cfd6ff');
  }

  private drawCheat() {
    const g = this.g;
    const hue = (this.t * 300) % 360;
    g.strokeStyle = `hsl(${hue} 100% 60%)`;
    g.lineWidth = 14;
    g.strokeRect(7, 7, SCREEN_W - 14, SCREEN_H - 14);
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(60, SCREEN_H / 2 - 50, SCREEN_W - 120, 100);
    this.text('CHEAT ENABLED', SCREEN_W / 2, SCREEN_H / 2 - 16, 34, `hsl(${hue} 100% 70%)`);
    this.text('EXTRA HEALTH · WIDER PIPES', SCREEN_W / 2, SCREEN_H / 2 + 22, 18, '#fff');
  }
}

const MENU_TOP = 130;
const MENU_STEP = 56;
