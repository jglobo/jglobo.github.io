// Minimal HUD: world name (top-left), menu buttons (top-right), one hint line,
// the interaction prompt (bottom-centre), world-specific extras.
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../stores/gameStore';
import { track } from '../analytics/track';
import { hubAim } from '../worlds/hub/hubAim';
import { useHud } from '../stores/hudStore';
import { DESTINATIONS, worldTheme } from '../engine/portals/destinations';
import { audio } from '../engine/audio/AudioManager';
import { releaseLock } from '../engine/input/pointerLock';
import { worldName } from './worldNames';

export function HUD() {
  const world = useGame((s) => s.currentWorld);
  const prompt = useGame((s) => s.prompt);
  const hint = useGame((s) => s.hint);
  const overlay = useGame((s) => s.overlay);
  const transition = useGame((s) => s.transition.phase);
  const theme = worldTheme(world);
  if (overlay !== 'none' && overlay !== 'inspector') return null;

  const open = (o: 'pause' | 'quick') => {
    releaseLock();
    audio.play('ui');
    useGame.getState().openOverlay(o);
  };

  return (
    <div className="hud" aria-live="polite">
      <div className="hud-world" style={{ ['--accent' as string]: theme.color }}>
        <span className="hud-symbol" aria-hidden="true">{theme.symbol}</span>
        <span>{worldName(world)}</span>
      </div>
      <div className="hud-actions">
        <button className="hud-btn" onClick={() => open('quick')}>
          Quick Portfolio <kbd>Tab</kbd>
        </button>
        <button className="hud-btn" onClick={() => open('pause')} aria-label="Menu">
          ☰ Menu <kbd>Esc</kbd>
        </button>
      </div>
      {hint && transition === 'idle' && <div className="hud-hint">{hint}</div>}
      {prompt && overlay === 'none' && <div className="hud-prompt">{prompt}</div>}
      {world === 'hub' && <HubHud />}
      {(world === 'data-science' || world === 'software') && <SpaceHud />}
      {world === 'games' && <RoomHud />}
      <ControlsLegend />
    </div>
  );
}

function HubHud() {
  const dest = useGame((s) => s.portalDestination);
  const locked = useGame((s) => s.pointerLocked);
  const d = DESTINATIONS.find((x) => x.id === dest)!;
  const cross = useRef<HTMLDivElement>(null);
  // The crosshair brightens over portal-compatible surfaces (polled, not React state).
  useEffect(() => {
    let id = 0;
    const tick = () => {
      cross.current?.classList.toggle('valid', !!hubAim.hit);
      id = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <>
      <div ref={cross} className="crosshair" style={{ ['--accent' as string]: d.color }} aria-hidden="true">
        <span>{d.symbol}</span>
      </div>
      <div className="selector" role="radiogroup" aria-label="Portal destination">
        {DESTINATIONS.map((x) => (
          <button
            key={x.id}
            role="radio"
            aria-checked={x.id === dest}
            className={`selector-item ${x.id === dest ? 'active' : ''}`}
            style={{ ['--accent' as string]: x.color }}
            tabIndex={locked ? -1 : 0}
            onClick={(e) => {
              e.stopPropagation();
              if (x.id !== dest) {
                useGame.getState().selectDestination(x.id);
                useGame.getState().completeInteraction('destination-selected');
                audio.play('select');
              }
            }}
          >
            <kbd>{x.key}</kbd>
            <span className="selector-symbol" aria-hidden="true">{x.symbol}</span>
            <span className="selector-label">{x.label}</span>
            {x.status === 'coming-soon' && <span className="selector-soon">soon</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function RoomHud() {
  const free = useGame((s) => s.freeCursor);
  return free ? null : <div className="room-dot" aria-hidden="true" />;
}

function SpaceHud() {
  const markers = useHud((s) => s.markers);
  const charge = useHud((s) => s.returnCharge);
  return (
    <>
      {markers.map((m) => (
        <div
          key={m.id}
          className={`nav-marker ${m.onScreen ? 'on' : 'edge'} ${m.discovered ? 'seen' : ''}`}
          style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
        >
          {!m.onScreen && (
            <span className="nav-arrow" style={{ transform: `rotate(${-m.angle}rad)` }} aria-hidden="true">
              ➤
            </span>
          )}
          <span className="nav-label">
            {m.symbol} {m.label}
            {!m.onScreen && <span className="nav-dist"> · {Math.round(m.distance)} m</span>}
          </span>
          {m.url && (
            <a className="nav-link" href={m.url} target="_blank" rel="noopener noreferrer" onClick={() => track('demo_clicked', { project: m.id, from: 'nav-marker' })}>
              Open {m.projectTitle} ↗
            </a>
          )}
        </div>
      ))}
      {charge > 0.02 && (
        <div className="return-charge" aria-label="Summoning return portal">
          <svg viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" className="track" />
            <circle cx="20" cy="20" r="16" className="fill" style={{ strokeDashoffset: `${100 - charge * 100}` }} pathLength={100} />
          </svg>
          <span>Return portal</span>
        </div>
      )}
    </>
  );
}

function ControlsLegend() {
  const controls = useHud((s) => s.controls);
  const [expanded, setExpanded] = useState(true);
  // Shown when a world starts, then folds away so it does not cover the view.
  useEffect(() => {
    setExpanded(true);
    const t = setTimeout(() => setExpanded(false), 14000);
    return () => clearTimeout(t);
  }, [controls]);
  if (!controls.length) return null;
  return (
    <div className="controls-legend">
      <button className="controls-toggle" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
        {expanded ? 'Hide controls' : 'Controls'}
      </button>
      {expanded && (
        <ul aria-label="Controls">
          {controls.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
