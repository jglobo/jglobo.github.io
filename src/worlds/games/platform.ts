// What a game on the shelf runs on, worked out from its technologies, for the box
// art and the TV's "this cartridge runs on..." message.
import type { PortfolioProject } from '../../content';

export function gamePlatform(p: PortfolioProject): { strip: string; tv: string } {
  const tech = p.technologies.map((t) => t.toLowerCase());
  if (tech.includes('c++')) return { strip: 'PC / C++ TERMINAL', tv: 'A TERMINAL (C++).' };
  if (tech.includes('javascript')) return { strip: 'WEB BROWSER', tv: 'A WEB BROWSER (JAVASCRIPT).' };
  return { strip: 'PC / PYGAME', tv: 'DESKTOP (PYTHON + PYGAME).' };
}
