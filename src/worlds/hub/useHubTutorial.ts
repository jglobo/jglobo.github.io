// Contextual first-visit guidance: one short hint at a time, advancing as the
// visitor does each thing. Returning visitors get a single reminder line.
import { useEffect } from 'react';
import { useGame } from '../../stores/gameStore';
import { useHud } from '../../stores/hudStore';

const STEPS: { done: string; hint: string }[] = [
  { done: 'moved', hint: 'WASD to move · Mouse to look (click the view to capture the mouse, or drag)' },
  { done: 'destination-selected', hint: 'Choose a destination: press 1–4 or scroll' },
  { done: 'portal-fired', hint: 'Aim at a glowing wall panel and click to fire a portal' },
  { done: 'portal-entered', hint: 'Walk through the portal' },
];

export function useHubTutorial() {
  useEffect(() => {
    useHud.setState({ controls: ['WASD: move', 'Mouse: look', 'Click: fire portal', '1–4 / scroll: destination', 'E: interact', 'Shift: sprint'] });
    let moveTimer: number | undefined;
    const update = () => {
      const s = useGame.getState();
      if (s.currentWorld !== 'hub') return;
      if (s.tutorialSeen) {
        s.setHint(s.portal ? 'Walk through the portal' : 'Pick a world with 1–4 · Click a wall panel to open a portal · Tab for Quick Portfolio');
        return;
      }
      const step = STEPS.find((st) => !s.completedInteractions.includes(st.done));
      if (!step) {
        s.completeInteraction('tutorial');
        return;
      }
      // "Choose a destination" also counts as done once a portal is fired.
      if (step.done === 'destination-selected' && s.completedInteractions.includes('portal-fired')) {
        s.completeInteraction('destination-selected');
        return;
      }
      s.setHint(step.hint);
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
