// Original pixel-art characters, drawn in code (no sprite sheets to license).
// Each character is a palette plus a few shape rules; frames are rasterised into a
// small grid, then outlined and shaded automatically so every sprite shares one
// consistent pixel style. Pure (no DOM), so it can be unit tested.

export type Cell = string | null;
export type Grid = Cell[][];

export const HUMAN_W = 16;
export const HUMAN_H = 24;
export const DOG_W = 16;
export const DOG_H = 12;
export const OUTLINE = '#2b1d1a';

export interface HumanLook {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'cap';
  cap?: string;
  shirt: string;
  pants: string;
  shoes: string;
  backpack?: string;
  beard?: boolean;
}

export interface DogLook { fur: string; light: string; ear: string }

/** Frame order in a human atlas. */
export const HUMAN_FRAMES = ['down0', 'down1', 'down2', 'up0', 'up1', 'up2', 'side0', 'side1', 'side2', 'wave'] as const;
export type HumanFrame = (typeof HUMAN_FRAMES)[number];
export const DOG_FRAMES = ['side0', 'side1', 'side2', 'sit0', 'sit1'] as const;
export type DogFrame = (typeof DOG_FRAMES)[number];

const blank = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<Cell>(w).fill(null));

function rect(g: Grid, x: number, y: number, w: number, h: number, c: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[j].length) g[j][i] = c;
}
const px = (g: Grid, x: number, y: number, c: string) => rect(g, x, y, 1, 1, c);

/** Draws one frame of a person, 16 x 24 pixels, feet on the bottom row. */
export function humanGrid(look: HumanLook, frame: HumanFrame): Grid {
  const g = blank(HUMAN_W, HUMAN_H);
  const dir = frame.startsWith('side') ? 'side' : frame.startsWith('up') ? 'up' : 'down';
  const step = frame === 'wave' ? 0 : Number(frame.slice(-1));
  const legA = step === 1 ? 1 : 0;
  const legB = step === 2 ? 1 : 0;
  const eye = '#2b1d1a';

  if (dir === 'side') {
    // Facing right. Legs scissor while walking.
    const back = step === 0 ? 0 : step === 1 ? -2 : 2;
    rect(g, 7 + back, 18, 2, 4, darken(look.pants, 0.15));
    rect(g, 7 + back, 22, 3, 1, look.shoes);
    rect(g, 7 - back, 18, 2, 4, look.pants);
    rect(g, 7 - back, 22, 3, 1, look.shoes);
    rect(g, 6, 12, 4, 6, look.shirt);
    if (look.backpack) rect(g, 4, 12, 2, 5, look.backpack);
    const swing = step === 0 ? 0 : step === 1 ? 1 : -1;
    rect(g, 7 + swing, 13, 2, 3, darken(look.shirt, 0.12));
    rect(g, 7 + swing * 2, 16, 2, 1, look.skin);
    rect(g, 8, 11, 2, 1, look.skin);
    rect(g, 6, 5, 6, 6, look.skin);
    px(g, 12, 8, look.skin);
    if (look.hairStyle === 'cap') {
      rect(g, 5, 2, 7, 3, look.cap ?? look.hair);
      rect(g, 10, 4, 4, 1, look.cap ?? look.hair);
      rect(g, 5, 5, 2, 3, look.hair);
    } else {
      rect(g, 5, 2, 7, 3, look.hair);
      rect(g, 5, 5, 3, 3, look.hair);
      px(g, 11, 5, look.hair);
      if (look.hairStyle === 'long') rect(g, 4, 5, 3, 7, look.hair);
    }
    px(g, 10, 7, eye);
    if (look.beard) {
      // Trimmed beard: sideburn, jawline, chin and a short mustache.
      rect(g, 7, 8, 1, 2, look.hair);
      rect(g, 8, 10, 3, 1, look.hair);
      px(g, 11, 9, look.hair);
      px(g, 10, 11, look.hair);
    }
    return g;
  }

  // Front or back view.
  rect(g, 5, 18, 3, 4 - legA, look.pants);
  rect(g, 8, 18, 3, 4 - legB, darken(look.pants, 0.1));
  rect(g, 5, 22 - legA, 3, 1, look.shoes);
  rect(g, 8, 22 - legB, 3, 1, look.shoes);
  rect(g, 5, 17, 6, 1, darken(look.pants, 0.25));
  rect(g, 4, 12, 8, 1, look.shirt);
  rect(g, 5, 13, 6, 4, look.shirt);
  // Arms swing opposite to the legs.
  const armL = frame === 'wave' ? 0 : legB - legA;
  const armR = -armL;
  rect(g, 3, 13 + Math.max(0, armL), 1, 2, look.shirt);
  rect(g, 3, 15 + Math.max(0, armL), 1, 2 - Math.max(0, -armL), look.skin);
  if (frame === 'wave') {
    rect(g, 12, 9, 1, 4, look.shirt);
    rect(g, 12, 7, 2, 2, look.skin);
  } else {
    rect(g, 12, 13 + Math.max(0, armR), 1, 2, look.shirt);
    rect(g, 12, 15 + Math.max(0, armR), 1, 2 - Math.max(0, -armR), look.skin);
  }
  rect(g, 7, 11, 2, 1, look.skin);

  if (dir === 'up') {
    if (look.backpack) {
      rect(g, 5, 12, 6, 5, look.backpack);
      rect(g, 6, 13, 4, 1, darken(look.backpack, 0.2));
    }
    rect(g, 4, 3, 8, 8, look.hair);
    rect(g, 5, 2, 6, 1, look.hair);
    px(g, 4, 8, look.skin);
    px(g, 11, 8, look.skin);
    if (look.hairStyle === 'cap') rect(g, 4, 2, 8, 3, look.cap ?? look.hair);
    if (look.hairStyle === 'long') rect(g, 4, 8, 8, 5, look.hair);
    return g;
  }

  rect(g, 5, 5, 6, 6, look.skin);
  px(g, 4, 8, look.skin);
  px(g, 11, 8, look.skin);
  if (look.hairStyle === 'cap') {
    rect(g, 4, 2, 8, 3, look.cap ?? look.hair);
    rect(g, 3, 5, 10, 1, darken(look.cap ?? look.hair, 0.2));
    px(g, 4, 6, look.hair);
    px(g, 11, 6, look.hair);
  } else {
    rect(g, 5, 2, 6, 1, look.hair);
    rect(g, 4, 3, 8, 2, look.hair);
    rect(g, 4, 5, 2, 2, look.hair);
    rect(g, 10, 5, 2, 1, look.hair);
    px(g, 8, 5, look.hair);
    if (look.hairStyle === 'long') {
      rect(g, 4, 5, 1, 7, look.hair);
      rect(g, 11, 5, 1, 7, look.hair);
    }
  }
  px(g, 6, 8, eye);
  px(g, 9, 8, eye);
  if (look.beard) {
    // Clean-cut beard and mustache: a narrow jawline that meets at the chin, a mustache
    // over the mouth and bare cheeks.
    px(g, 5, 9, look.hair);
    px(g, 10, 9, look.hair);
    rect(g, 7, 9, 2, 1, look.hair);
    px(g, 6, 10, look.hair);
    px(g, 9, 10, look.hair);
    rect(g, 7, 10, 2, 1, darken(look.skin, 0.25));
    rect(g, 7, 11, 2, 1, look.hair);
  } else {
    px(g, 5, 9, blush(look.skin));
    px(g, 10, 9, blush(look.skin));
  }
  if (look.backpack) {
    px(g, 5, 12, darken(look.backpack, 0.1));
    px(g, 10, 12, darken(look.backpack, 0.1));
  }
  return g;
}

/**
 * The visitor: a small, round robot with a big visor and glowing eyes, drawn for
 * this project (16 x 24, same frames as a person so it shares the controller).
 */
export function robotGrid(frame: HumanFrame): Grid {
  const g = blank(HUMAN_W, HUMAN_H);
  const shell = '#eef2f8';
  const joint = '#7d8fb6';
  const visor = '#1c2240';
  const eye = '#62f2ff';
  const glow = '#ffcf5a';
  const dir = frame.startsWith('side') ? 'side' : frame.startsWith('up') ? 'up' : 'down';
  const step = frame === 'wave' ? 0 : Number(frame.slice(-1));
  const liftA = step === 1 ? 1 : 0;
  const liftB = step === 2 ? 1 : 0;

  if (dir === 'side') {
    const k = step === 0 ? 0 : step === 1 ? 2 : -2;
    rect(g, 6 - k, 19, 2, 3, darken(joint, 0.15));
    rect(g, 5 - k, 22, 4, 1, darken(shell, 0.1));
    rect(g, 7 + k, 19, 2, 3, joint);
    rect(g, 6 + k, 22, 4, 1, shell);
    rect(g, 5, 13, 6, 6, shell);
    rect(g, 3, 14, 2, 3, joint);
    px(g, 3, 15, glow);
    const swing = step === 0 ? 0 : step === 1 ? 1 : -1;
    rect(g, 7 + swing, 14, 2, 3, joint);
    rect(g, 7 + swing * 2, 17, 2, 1, shell);
    rect(g, 3, 4, 10, 9, shell);
    rect(g, 8, 6, 5, 5, visor);
    rect(g, 10, 7, 2, 3, eye);
    rect(g, 2, 7, 1, 3, joint);
    rect(g, 6, 2, 1, 2, joint);
    rect(g, 5, 0, 2, 2, glow);
    return g;
  }

  // Legs and feet; the walk lifts one foot at a time.
  rect(g, 5, 19, 2, 3 - liftA, joint);
  rect(g, 9, 19, 2, 3 - liftB, darken(joint, 0.1));
  rect(g, 4, 22 - liftA, 4, 1, shell);
  rect(g, 8, 22 - liftB, 4, 1, shell);
  // Body and arms.
  rect(g, 4, 13, 8, 6, shell);
  const armL = frame === 'wave' ? 0 : liftB - liftA;
  rect(g, 2, 14 + Math.max(0, armL), 2, 3, joint);
  rect(g, 2, 17 + Math.max(0, armL), 2, 1, shell);
  if (frame === 'wave') {
    rect(g, 12, 9, 2, 4, joint);
    rect(g, 12, 7, 2, 2, shell);
  } else {
    rect(g, 12, 14 + Math.max(0, -armL), 2, 3, joint);
    rect(g, 12, 17 + Math.max(0, -armL), 2, 1, shell);
  }
  // Head: a big rounded helmet, ear pods and an antenna with a glowing tip.
  rect(g, 3, 5, 10, 8, shell);
  rect(g, 4, 4, 8, 1, shell);
  rect(g, 1, 7, 2, 3, joint);
  rect(g, 13, 7, 2, 3, joint);
  rect(g, 8, 2, 1, 2, joint);
  rect(g, 7, 0, 3, 2, glow);
  if (dir === 'up') {
    rect(g, 6, 7, 4, 3, darken(shell, 0.08));
    rect(g, 6, 14, 4, 4, joint);
    rect(g, 7, 17, 2, 1, glow);
    return g;
  }
  rect(g, 4, 6, 8, 5, visor);
  rect(g, 5, 7, 2, 3, eye);
  rect(g, 9, 7, 2, 3, eye);
  px(g, 5, 7, '#ffffff');
  px(g, 9, 7, '#ffffff');
  rect(g, 7, 15, 2, 2, glow);
  return g;
}

/** Draws one frame of a small dog, 16 x 12 pixels. */
export function dogGrid(look: DogLook, frame: DogFrame): Grid {
  const g = blank(DOG_W, DOG_H);
  const nose = '#2b1d1a';
  if (frame.startsWith('sit')) {
    const wag = frame === 'sit1' ? 1 : 0;
    rect(g, 5, 6, 6, 5, look.fur);
    rect(g, 6, 7, 4, 4, look.light);
    rect(g, 5, 11, 2, 1, look.light);
    rect(g, 9, 11, 2, 1, look.light);
    rect(g, 4, 1, 8, 5, look.fur);
    rect(g, 6, 4, 4, 2, look.light);
    rect(g, 3, 1, 2, 4, look.ear);
    rect(g, 11, 1, 2, 4, look.ear);
    px(g, 6, 3, nose);
    px(g, 9, 3, nose);
    rect(g, 7, 4, 2, 1, nose);
    rect(g, 11 + wag, 8 - wag, 2, 1, look.fur);
    return g;
  }
  const step = Number(frame.slice(-1));
  const a = step === 1 ? 1 : 0;
  const b = step === 2 ? 1 : 0;
  rect(g, 3, 5, 9, 4, look.fur);
  rect(g, 4, 8, 7, 1, look.light);
  // Legs (front pair and back pair alternate).
  rect(g, 4 - a, 9, 1, 3 - b, look.fur);
  rect(g, 6 + a, 9, 1, 3 - a, darken(look.fur, 0.15));
  rect(g, 9 + b, 9, 1, 3 - a, look.fur);
  rect(g, 11 - b, 9, 1, 3 - b, darken(look.fur, 0.15));
  // Head, snout, ear.
  rect(g, 10, 2, 4, 4, look.fur);
  rect(g, 13, 4, 2, 2, look.light);
  px(g, 15, 4, nose);
  px(g, 12, 3, nose);
  rect(g, 10, 1, 2, 3, look.ear);
  // Tail wags up and down.
  rect(g, 1, 3 + (step === 1 ? 1 : 0), 2, 2, look.fur);
  return g;
}

/** Adds a dark outline and simple top-light shading. Returns a new grid. */
export function stylize(src: Grid): Grid {
  const h = src.length;
  const w = src[0].length;
  const out = blank(w, h);
  const at = (x: number, y: number) => (y >= 0 && y < h && x >= 0 && x < w ? src[y][x] : null);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = src[y][x];
      if (c) {
        let col = c;
        if (c !== OUTLINE && at(x + 1, y) === null) col = darken(c, 0.18);
        else if (c !== OUTLINE && at(x, y - 1) === null) col = lighten(c, 0.14);
        out[y][x] = col;
      } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
        out[y][x] = OUTLINE;
      }
    }
  }
  return out;
}

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
export const darken = (hex: string, k: number) => {
  const [r, g, b] = parse(hex);
  return toHex(r * (1 - k), g * (1 - k), b * (1 - k));
};
export const lighten = (hex: string, k: number) => {
  const [r, g, b] = parse(hex);
  return toHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k);
};
const blush = (skin: string) => {
  const [r, g, b] = parse(skin);
  return toHex(r + 20, g - 25, b - 15);
};

/** Paints frames side by side into RGBA pixels (for a canvas ImageData). */
export function rasterize(frames: Grid[]): { width: number; height: number; data: Uint8ClampedArray } {
  const fw = frames[0][0].length;
  const height = frames[0].length;
  const width = fw * frames.length;
  const data = new Uint8ClampedArray(width * height * 4);
  frames.forEach((grid, f) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < fw; x++) {
        const c = grid[y][x];
        if (!c) continue;
        const [r, g, b] = parse(c);
        const i = (y * width + f * fw + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
  });
  return { width, height, data };
}

export const humanAtlas = (look: HumanLook) => rasterize(HUMAN_FRAMES.map((f) => stylize(humanGrid(look, f))));
export const robotAtlas = () => rasterize(HUMAN_FRAMES.map((f) => stylize(robotGrid(f))));
export const dogAtlas = (look: DogLook) => rasterize(DOG_FRAMES.map((f) => stylize(dogGrid(look, f))));

// The family, as Jose described them: black hair and light brown skin for him and
// his wife (a clean-cut beard and mustache for him), brown hair for their son, generic clothes, and a white dog.
export const LOOKS = {
  jose: { skin: '#cf9e76', hair: '#141011', hairStyle: 'short', beard: true, shirt: '#2f7fb8', pants: '#383d52', shoes: '#4a3426' },
  wife: { skin: '#cf9e76', hair: '#141011', hairStyle: 'long', shirt: '#b8577a', pants: '#3d3a4f', shoes: '#4a3426' },
  son: { skin: '#d4a57e', hair: '#6a4126', hairStyle: 'short', shirt: '#e8a628', pants: '#3f6a8a', shoes: '#f2f2f2' },
} satisfies Record<string, HumanLook>;
export const DOG_LOOK: DogLook = { fur: '#f3f0ea', light: '#ffffff', ear: '#d8cdbd' };
