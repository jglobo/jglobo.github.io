// Deterministic dialogue helpers (no React, no DOM) for the NPC conversation box.
import type { DialogueLine } from '../../content/schema.ts';

/** Characters per second for the typewriter effect. */
export const CPS = 52;

export const visibleChars = (text: string, elapsed: number, cps = CPS) => Math.min(text.length, Math.max(0, Math.floor(elapsed * cps)));

export interface Choice { id: string; label: string; asked: boolean; answer?: string }

export const GOODBYE = 'goodbye';

/** The question menu: every line from dialogue.json, then Goodbye. */
export function menuFor(lines: DialogueLine[], asked: string[]): Choice[] {
  return [
    ...lines.map((l) => ({ id: l.question, label: l.question, asked: asked.includes(l.question), answer: l.answer })),
    { id: GOODBYE, label: 'Goodbye', asked: false },
  ];
}

/** Wraps the selection around the menu. */
export const moveSelection = (i: number, delta: number, n: number) => (((i + delta) % n) + n) % n;
