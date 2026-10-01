import type { WorldId } from '../content';
import { destination } from '../engine/portals/destinations';

export const worldName = (id: WorldId) => (id === 'hub' ? 'Portal Hub' : destination(id)?.world ?? id);
