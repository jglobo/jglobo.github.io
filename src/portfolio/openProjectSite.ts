import { publishedUrl, type PortfolioProject } from '../content';
import { track } from '../analytics/track';
import { useGame } from '../stores/gameStore';
import { releaseLock } from '../engine/input/pointerLock';

/** Opens a project's published page in a new tab. If the browser blocks the new tab,
 *  the project panel opens instead, which has the same link as a normal button. */
export function openProjectSite(project: PortfolioProject, from: string) {
  const url = publishedUrl(project);
  track(project.demoUrl ? 'demo_clicked' : 'github_clicked', { project: project.id, from });
  useGame.getState().completeInteraction(`visited-${project.id}`);
  useGame.setState((s) => ({ discoveredProjects: s.discoveredProjects.includes(project.id) ? s.discoveredProjects : [...s.discoveredProjects, project.id] }));
  // No 'noopener' feature string: with it, window.open always returns null and we could
  // not tell a blocked tab from an opened one. Cut the opener link by hand instead.
  const win = url ? window.open(url, '_blank') : null;
  if (win) win.opener = null;
  if (!win) {
    releaseLock();
    useGame.getState().openProject(project.id);
  }
}
