// Central input manager. Tracks held keys and mouse-look deltas; controllers read it
// every frame. One set of window listeners for the whole app, installed once.
import { DEFAULT_BINDINGS, useSettings, type Action } from '../../stores/settingsStore';

// Saved settings from an older version may not list every action yet.
const codes = (action: Action) => useSettings.getState().bindings[action] ?? DEFAULT_BINDINGS[action];

const held = new Set<string>();
// code -> time of the key press, consumed by wasPressed().
const pressed = new Map<string, number>();
let lookX = 0;
let lookY = 0;
let dragging = false;
let dragMoved = 0;
let wheel = 0;
let installed = false;

type ClickHandler = () => void;
const clickHandlers = new Set<ClickHandler>();

export function installInput() {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    if (!held.has(e.code)) pressed.set(e.code, performance.now());
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement || dragging) {
      lookX += e.movementX;
      lookY += e.movementY;
      if (dragging) dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
    }
  });
  window.addEventListener('mouseup', () => (dragging = false));
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

/** Canvas mouse handlers: pointer-lock click fires; without lock, drag looks and a click fires. */
export function canvasPointerDown(e: PointerEvent | MouseEvent) {
  if (e.button !== 0) return;
  if (document.pointerLockElement) {
    clickHandlers.forEach((h) => h());
    return;
  }
  dragging = true;
  dragMoved = 0;
}

export function canvasPointerUp(e: PointerEvent | MouseEvent) {
  if (e.button !== 0 || document.pointerLockElement) return;
  if (dragMoved < 6) clickHandlers.forEach((h) => h());
  dragging = false;
}

export function canvasWheel(e: WheelEvent) {
  wheel += Math.sign(e.deltaY);
}

export function onFire(handler: ClickHandler) {
  clickHandlers.add(handler);
  return () => {
    clickHandlers.delete(handler);
  };
}

export function isDown(action: Action) {
  return codes(action).some((code) => held.has(code));
}

/** True once per key press; presses older than 1 s are ignored. */
export function wasPressed(action: Action) {
  const now = performance.now();
  for (const code of codes(action)) {
    const t = pressed.get(code);
    if (t !== undefined) {
      pressed.delete(code);
      if (now - t < 1000) return true;
    }
  }
  return false;
}

export function consumeLook() {
  const s = useSettings.getState();
  const k = 0.0022 * s.mouseSensitivity;
  const out = { x: lookX * k, y: lookY * k * (s.invertY ? -1 : 1) };
  lookX = 0;
  lookY = 0;
  return out;
}

export function consumeWheel() {
  const w = wheel;
  wheel = 0;
  return w;
}

let escapeHandler: (() => boolean) | null = null;

/** A world can claim Esc (e.g. to put an object down) before it opens the pause menu. */
export function setEscapeHandler(handler: (() => boolean) | null) {
  escapeHandler = handler;
}

export const runEscapeHandler = () => !!escapeHandler?.();

export function clearInput() {
  held.clear();
  pressed.clear();
  lookX = lookY = wheel = 0;
  dragging = false;
}
