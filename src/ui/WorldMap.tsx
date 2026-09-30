import type { WorldId } from '../content';
import { DESTINATIONS, HUB_THEME } from '../engine/portals/destinations';
import { useGame } from '../stores/gameStore';

const LAYOUT: Record<WorldId, { x: number; y: number }> = {
  hub: { x: 50, y: 50 },
  'data-science': { x: 50, y: 12 },
  games: { x: 14, y: 50 },
  software: { x: 86, y: 50 },
  journey: { x: 50, y: 88 },
};

/** Universal map: the Hub in the middle, the four worlds around it; visited worlds light up. */
export function WorldMap() {
  const visited = useGame((s) => s.visitedWorlds);
  const current = useGame((s) => s.currentWorld);
  const nodes = [{ id: 'hub' as WorldId, label: 'Portal Hub', world: 'Dimensional lab', symbol: HUB_THEME.symbol, color: HUB_THEME.color, status: 'playable' }, ...DESTINATIONS];
  return (
    <div className="world-map" role="img" aria-label="World map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {DESTINATIONS.map((d) => (
          <line key={d.id} x1={50} y1={50} x2={LAYOUT[d.id].x} y2={LAYOUT[d.id].y} className={visited.includes(d.id) ? 'lit' : ''} />
        ))}
      </svg>
      {nodes.map((n) => (
        <div
          key={n.id}
          className={`map-node ${visited.includes(n.id) ? 'visited' : ''} ${current === n.id ? 'here' : ''}`}
          style={{ left: `${LAYOUT[n.id].x}%`, top: `${LAYOUT[n.id].y}%`, ['--accent' as string]: n.color }}
        >
          <span className="map-symbol" aria-hidden="true">{n.symbol}</span>
          <strong>{n.label}</strong>
          <span className="muted">{n.world}</span>
          <span className="map-state">
            {current === n.id ? 'You are here' : n.status === 'coming-soon' ? 'Coming soon' : visited.includes(n.id) ? 'Visited' : 'Not visited'}
          </span>
        </div>
      ))}
    </div>
  );
}
