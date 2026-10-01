// Game Development world: a late-90s / early-2000s bedroom. Pick a game box off
// the shelf, turn it over, put it in the console and play it on the CRT.
import { useEffect, useMemo } from 'react';
import { Portal } from '../../engine/portals/Portal';
import { HUB_THEME } from '../../engine/portals/destinations';
import { setEscapeHandler } from '../../engine/input/input';
import { releaseLock } from '../../engine/input/pointerLock';
import { audio } from '../../engine/audio/AudioManager';
import { track } from '../../analytics/track';
import { useGame } from '../../stores/gameStore';
import { useHud } from '../../stores/hudStore';
import { CrtSystem } from './crt/CrtSystem';
import { CrtTv } from './CrtTv';
import { GameShelf } from './GameShelf';
import { PORTAL, ROOM } from './layout';
import { RoomController, putBack, standUp, type RoomKeys } from './RoomController';
import { RoomEnvironment } from './RoomEnvironment';
import { useRoom } from './roomStore';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
const SCREEN_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export default function GameRoomWorld() {
  const keys = useMemo<RoomKeys>(() => ({ held: new Set(), pressed: new Set(), click: false }), []);
  const crt = useMemo(
    () =>
      new CrtSystem({
        sfx: (n) => audio.play(n),
        openInfo: (p) => {
          releaseLock();
          useGame.getState().openProject(p.id);
        },
        openUrl: (url, p) => {
          track(p.githubUrl ? 'github_clicked' : 'game_played', { project: p.id, from: 'game-room-tv' });
          const win = window.open(url, '_blank');
          if (win) win.opener = null;
        },
        exit: () => standUp(crt),
        cheat: () => useRoom.getState().cheat,
      }),
    [],
  );

  useEffect(() => {
    useRoom.setState({ mode: 'walk', heldId: null, insertedId: null, lampOn: true });
    useHud.setState({
      controls: ['WASD: walk · mouse: look', 'Click or E: pick up / use', 'I: read the manual', 'Q or Esc: put down / stand up', 'Walk into the portal: back to the Hub'],
    });
    const g = useGame.getState();
    if (!g.completedInteractions.includes('game-inserted')) g.setHint('Your games are on the shelf to the right. Pick one up and play it on the TV.');
    const hintTimer = setTimeout(() => useGame.getState().setHint(null), 9000);

    setEscapeHandler(() => {
      const room = useRoom.getState();
      if (room.mode === 'inspect') {
        putBack();
        return true;
      }
      if (room.mode === 'crt') {
        if (!crt.back()) standUp(crt);
        return true;
      }
      return room.mode === 'inserting';
    });

    let konami = 0;
    const down = (e: KeyboardEvent) => {
      if (useGame.getState().overlay !== 'none') return;
      const mode = useRoom.getState().mode;
      if (mode === 'crt' && SCREEN_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) keys.pressed.add(e.code);
      keys.held.add(e.code);
      // Easter egg: the classic cheat code.
      konami = e.code === KONAMI[konami] ? konami + 1 : e.code === KONAMI[0] ? 1 : 0;
      if (konami === KONAMI.length) {
        konami = 0;
        useRoom.getState().set({ cheat: true });
        crt.celebrateCheat();
        useGame.getState().setHint('Cheat enabled: extra health in Space Duel and wider pipes in Flappy Bird.');
        track('easter_egg', { egg: 'konami' });
      }
    };
    const up = (e: KeyboardEvent) => keys.held.delete(e.code);
    const blur = () => keys.held.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      clearTimeout(hintTimer);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      setEscapeHandler(null);
      useHud.setState({ controls: [] });
      useGame.getState().setHint(null);
      useGame.setState({ freeCursor: false });
      useRoom.setState({ mode: 'walk', heldId: null, insertedId: null });
      crt.dispose();
    };
  }, [crt, keys]);

  return (
    <>
      <color attach="background" args={['#120a18']} />
      <hemisphereLight args={['#9a86c8', '#1a1020', 0.55]} />
      <ambientLight intensity={0.14} />
      {/* Moonlight through the window */}
      <directionalLight position={[-6, 3.5, 1]} color="#8fa8ff" intensity={0.55} />
      <pointLight position={[0, ROOM.height - 0.3, 0]} color="#ff7ad1" intensity={1.1} distance={7} decay={1.5} />
      <RoomEnvironment />
      <GameShelf />
      <CrtTv crt={crt} />
      <Portal position={[PORTAL.x, PORTAL.y, ROOM.halfZ - 0.02]} normal={[0, 0, -1]} color={HUB_THEME.color} color2={HUB_THEME.color2} preview="hub" open={1} scale={0.62} />
      <RoomController crt={crt} keys={keys} />
    </>
  );
}

