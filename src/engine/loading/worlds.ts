// World registry: every world is its own lazily loaded chunk.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { WorldId } from '../../content';

type Loader = () => Promise<{ default: ComponentType }>;

const loaders: Record<WorldId, Loader> = {
  hub: () => import('../../worlds/hub/HubWorld'),
  'data-science': () => import('../../worlds/data-science/DataScienceWorld'),
  games: () => import('../../worlds/games/GameRoomWorld'),
  software: () => import('../../worlds/software/SoftwareWorld'),
  // Not built yet: crossing its portal opens the Quick Portfolio section instead.
  journey: () => import('../../worlds/hub/HubWorld'),
};

const cache = new Map<WorldId, Promise<{ default: ComponentType }>>();
const components = new Map<WorldId, LazyExoticComponent<ComponentType>>();

/** Starts downloading a world's chunk (called when a portal is fired). */
export function preloadWorld(id: WorldId) {
  if (!cache.has(id)) {
    const p = loaders[id]();
    p.catch(() => cache.delete(id)); // allow a retry after a failed download
    cache.set(id, p);
  }
  return cache.get(id)!;
}

export function worldComponent(id: WorldId) {
  if (!components.has(id)) components.set(id, lazy(() => preloadWorld(id)));
  return components.get(id)!;
}
