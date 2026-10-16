// Contextual first-visit guidance: one short hint at a time, advancing as the
// visitor does each thing. Returning visitors get a single reminder line.
import { useEffect } from 'react';
import { useGame } from '../../stores/gameStore';
import { useHud } from '../../stores/hudStore';

const STEPS: { done: string; hint: string }[] = [
  { done: 'moved', hint: 'WASD to move · Mouse to look (click the view to capture the mouse, or drag)' },
  { done: 'portal-blue', hint: 'Left click a white panel to shoot a blue portal' },
  { done: 'portal-orange', hint: 'Right click another white panel for the orange portal' },
  { done: 'portal-entered', hint: 'Walk into one portal to come out of the other' },
];
const RETURNING = 'Solve a wall puzzle to open its world, or use the console in the middle · Tab for Quick Portfolio';

export function useHubTutorial() {
  useEffect(() => {
    useHud.setState({
      controls: ['WASD: move', 'Mouse: look', 'Left click / 1: blue portal', 'Right click / 2: orange portal', 'R: clear portals', 'E: press buttons, use the console', 'Shift: sprint'],
    });
    let moveTimer: number | undefined;
    const update = () => {
      const s = useGame.getState();
      if (s.currentWorld !== 'hub') return;
      // Visitors from before the two-colour gun still get its steps (but not "move" again).
      const step = STEPS.find((st) => !s.completedInteractions.includes(st.done) && !(st.done === 'moved' && s.tutorialSeen));
      if (!step) {
        if (!s.tutorialSeen || !s.completedInteractions.includes('tutorial')) s.completeInteraction('tutorial');
        if (s.hint !== RETURNING) s.setHint(RETURNING);
        return;
      }
      if (s.hint !== step.hint) s.setHint(step.hint);
    };
    // Movement is detected from key presses rather than from the controller.
    const onKey = (e: KeyboardEvent) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        window.clearTimeout(moveTimer);
        moveTimer = window.setTimeout(() => useGame.getState().completeInteraction('moved'), 700);
      }
    };
    window.addEventListener('keydown', onKey);
    const unsub = useGame.subscribe(update);
    update();
    return () => {
      unsub();
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(moveTimer);
      useGame.getState().setHint(null);
      useHud.setState({ controls: [] });
    };
  }, []);
}
