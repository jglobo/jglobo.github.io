import type { SfxName } from '../../../engine/audio/AudioManager';

/** Keys are KeyboardEvent.code values. `pressed` holds only this frame's new presses. */
export interface CrtInput {
  held: ReadonlySet<string>;
  pressed: ReadonlySet<string>;
  /** A click/tap on the screen this frame. */
  click: boolean;
}

/** A small game that renders into the TV's 640x480 canvas. */
export interface CrtGame {
  update(dt: number, input: CrtInput): void;
  draw(g: CanvasRenderingContext2D): void;
  /** Set when the round is finished; the TV shows it and returns to the menu. */
  result: string | null;
  /** One line of controls shown in the HUD while playing. */
  controls: string;
}

export interface CrtGameOptions {
  sfx: (name: SfxName) => void;
  /** Konami code bonus. */
  cheat: boolean;
  best: number;
  saveBest: (score: number) => void;
}

export const SCREEN_W = 640;
export const SCREEN_H = 480;
export const PIXEL_FONT = '"Courier New", ui-monospace, monospace';
