// Universal project inspector. Same content everywhere; the frame adapts to the
// world (holographic in orbit, CRT manual in the game room, billboard tablet in the
// software world, journal in the journey world).
import { useEffect, useRef } from 'react';
import { projectById } from '../content';
import { useGame } from '../stores/gameStore';
import { worldTheme } from '../engine/portals/destinations';
import { ProjectDetails } from './ProjectDetails';

const FRAME: Record<string, { className: string; kicker: string; close: string }> = {
  'data-science': { className: 'inspector holo', kicker: 'RESEARCH DATA UPLINK', close: 'Back to orbit' },
  games: { className: 'inspector crt', kicker: 'GAME MANUAL', close: 'Back' },
  software: { className: 'inspector tablet', kicker: 'APPLICATION', close: 'Back to the road' },
  journey: { className: 'inspector journal', kicker: 'MEMORY', close: 'Close journal' },
  hub: { className: 'inspector holo', kicker: 'PROJECT FILE', close: 'Close' },
};

export function ProjectInspector() {
  const open = useGame((s) => s.overlay === 'inspector');
  const id = useGame((s) => s.selectedProject);
  const world = useGame((s) => s.currentWorld);
  const closeRef = useRef<HTMLButtonElement>(null);
  const project = id ? projectById(id) : undefined;

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open || !project) return null;
  const frame = FRAME[world] ?? FRAME.hub;
  const theme = worldTheme(project.world);
  const close = () => useGame.getState().closeOverlay();

  return (
    <div className="overlay-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className={frame.className} role="dialog" aria-modal="true" aria-labelledby="inspector-title" style={{ ['--accent' as string]: theme.color }}>
        <header>
          <div className="kicker">
            <span aria-hidden="true">{theme.symbol}</span> {frame.kicker}
          </div>
          <h2 id="inspector-title">{project.title}</h2>
          <button ref={closeRef} className="icon-btn" onClick={close} aria-label="Close project">
            ✕
          </button>
        </header>
        <div className="inspector-body">
          <ProjectDetails project={project} />
        </div>
        <footer>
          <button className="btn" onClick={close}>
            {frame.close} <kbd>Esc</kbd>
          </button>
        </footer>
      </section>
    </div>
  );
}
