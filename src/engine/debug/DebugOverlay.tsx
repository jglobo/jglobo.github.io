// Development overlay: FPS, frame time, draw calls, triangles, loaded resources,
// world, positions and active interaction, plus instant teleports between worlds.
import { useEffect, useState } from 'react';
import { useGame } from '../../stores/gameStore';
import { activeInteractable, interactableCount } from '../interaction/interactions';
import { travelTo } from '../loading/travel';
import { debugInfo } from './debugInfo';
import { DESTINATIONS } from '../portals/destinations';

export function DebugOverlay() {
  const debug = useGame((s) => s.debug);
  const world = useGame((s) => s.currentWorld);
  const [, force] = useState(0);
  useEffect(() => {
    if (!debug) return;
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [debug]);
  if (!debug) return null;
  const f = (v: number[]) => v.map((n) => n.toFixed(1)).join(', ');
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return (
    <div className="debug" aria-hidden="true">
      <div>FPS {debugInfo.fps} · {debugInfo.frameMs.toFixed(1)} ms</div>
      <div>Draw calls {debugInfo.calls} · Tris {debugInfo.triangles.toLocaleString()}</div>
      <div>Geometries {debugInfo.geometries} · Textures {debugInfo.textures}</div>
      {mem && <div>JS heap {(mem.usedJSHeapSize / 1048576).toFixed(0)} MB</div>}
      <div>World {world}</div>
      <div>Player {f(debugInfo.player)}</div>
      <div>Camera {f(debugInfo.camera)}</div>
      <div>Interactables {interactableCount()} · Active {activeInteractable() ?? '-'}</div>
      <div className="debug-teleport">
        <button onClick={() => void travelTo('hub')}>Hub</button>
        {DESTINATIONS.filter((d) => d.status === 'playable').map((d) => (
          <button key={d.id} onClick={() => void travelTo(d.id)}>{d.label}</button>
        ))}
      </div>
      <div className="debug-hint">` toggles this panel</div>
    </div>
  );
}
