import type { WorldId } from '../../content';

export interface Destination {
  id: Exclude<WorldId, 'hub'>;
  key: string; // hotkey label
  label: string;
  world: string;
  symbol: string; // shown on the selector and crosshair, so colour is never the only cue
  color: string;
  color2: string;
  status: 'playable' | 'coming-soon';
}

export const DESTINATIONS: Destination[] = [
  { id: 'data-science', key: '1', label: 'Data Science', world: 'Orbital Data World', symbol: '✦', color: '#3d7bff', color2: '#9fd0ff', status: 'playable' },
  { id: 'games', key: '2', label: 'Game Development', world: 'Retro Bedroom', symbol: '▶', color: '#ff3fb4', color2: '#ffb3e6', status: 'playable' },
  { id: 'software', key: '3', label: 'Software Engineering', world: 'Vehicle Playground', symbol: '⬢', color: '#19e6ff', color2: '#b8fbff', status: 'coming-soon' },
  { id: 'journey', key: '4', label: 'My Journey', world: 'HD-2D Life Town', symbol: '❖', color: '#ffb52e', color2: '#ffe9b0', status: 'coming-soon' },
];

export const HUB_THEME = { label: 'Portal Hub', symbol: '◎', color: '#b48cff', color2: '#e6d9ff' };

export const destination = (id: WorldId) => DESTINATIONS.find((d) => d.id === id);
export const worldTheme = (id: WorldId) => destination(id) ?? HUB_THEME;
