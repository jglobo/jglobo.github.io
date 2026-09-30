import { CanvasTexture, SRGBColorSpace } from 'three';

export interface TextLine {
  text: string;
  size: number; // px at canvas scale
  color?: string;
  weight?: string;
  font?: string;
}

/** Renders lines of text into a CanvasTexture (crisp signage without font downloads). */
export function makeTextTexture(
  lines: TextLine[],
  opts: { width?: number; height?: number; background?: string; align?: CanvasTextAlign; padding?: number; glow?: string } = {},
) {
  const { width = 1024, height = 512, background, align = 'center', padding = 40, glow } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  const total = lines.reduce((sum, l) => sum + l.size * 1.3, 0);
  let y = (height - total) / 2;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const x = align === 'center' ? width / 2 : align === 'left' ? padding : width - padding;
  for (const l of lines) {
    ctx.font = `${l.weight ?? '600'} ${l.size}px ${l.font ?? 'system-ui, "Segoe UI", Roboto, sans-serif'}`;
    ctx.fillStyle = l.color ?? '#fff';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = l.size * 0.4;
    }
    ctx.fillText(l.text, x, y + l.size * 0.15);
    y += l.size * 1.3;
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
