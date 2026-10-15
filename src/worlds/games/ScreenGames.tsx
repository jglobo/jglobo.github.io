// Jose's browser games, bundled with the site in play/<id>/, running on the room's real
// screens: the desk computer and the TV. Each game is an iframe laid onto the 3D glass
// with drei's <Html transform>, so it sits exactly where the screen is and takes the
// mouse and keyboard directly.
import { Html } from '@react-three/drei/web/Html.js';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { assetUrl, projectById, projectsByCategory, type PortfolioProject } from '../../content';
import { audio } from '../../engine/audio/AudioManager';
import { releaseLock, requestLock } from '../../engine/input/pointerLock';
import { clearInput } from '../../engine/input/input';
import { track } from '../../analytics/track';
import { useGame } from '../../stores/gameStore';
import { MONITOR, TV, TV_SCREEN } from './layout';
import { useRoom } from './roomStore';

/** Width of the page each game is laid out in, in CSS pixels; it is then scaled onto the glass. */
const PAGE_W = 1024;
/** drei maps 400 / distanceFactor CSS pixels to one world unit. */
const factorFor = (glassW: number) => (400 * glassW) / PAGE_W;

/** Keeps clicks on the screens away from the room's own click handling (look, use, TV menu). */
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

const pinBottom = (_el: unknown, _cam: unknown, size: { width: number; height: number }) => [size.width / 2, size.height - 34];

export const pcGames = () => projectsByCategory('games').filter((p) => p.playUrl && p.playOn === 'pc');

export function sitAtComputer() {
  releaseLock();
  useGame.setState({ freeCursor: true });
  useRoom.getState().set({ mode: 'pc', embed: null });
}

export function leaveComputer() {
  const room = useRoom.getState();
  if (room.mode !== 'pc') return;
  room.set({ mode: 'walk', embed: null });
  useGame.setState({ freeCursor: false });
  clearInput();
  const el = document.querySelector<HTMLElement>('.canvas-wrap');
  if (el) requestLock(el);
}

export function playGame(p: PortfolioProject) {
  audio.play('select');
  track('game_played', { project: p.id, from: p.playOn === 'tv' ? 'game-room-tv' : 'game-room-pc' });
  useRoom.getState().set({ embed: p.id });
}

/** Stops the running game: back to the computer's desktop or the TV's menu. */
export const stopGame = () => useRoom.getState().set({ embed: null });

export function ScreenGames() {
  const mode = useRoom((s) => s.mode);
  const embed = useRoom((s) => s.embed);
  const game = embed ? projectById(embed) : undefined;
  const onPc = mode === 'pc';
  const onTv = mode === 'crt' && !!game;
  if (!onPc && !onTv) return null;
  const glass = onPc ? MONITOR : { x: TV.x, y: TV.screenY, z: TV.screenZ, ...TV_SCREEN };
  const pageH = Math.round((PAGE_W * glass.h) / glass.w);
  return (
    <>
      {game && <PauseRoom />}
      <Html transform position={[glass.x, glass.y, glass.z + 0.004]} distanceFactor={factorFor(glass.w)} zIndexRange={[10, 0]}>
        <div className="screen-page" style={{ width: PAGE_W, height: pageH }} onPointerDown={stop} onPointerUp={stop}>
          {game ? <GameFrame game={game} /> : <Desktop />}
        </div>
      </Html>
      {/* Controls pinned to the bottom of the view */}
      {/* (anchored at the screen so drei never treats it as behind the camera) */}
      <Html position={[glass.x, glass.y, glass.z]} calculatePosition={pinBottom} zIndexRange={[11, 0]}>
        <div className="screen-bar" onPointerDown={stop} onPointerUp={stop}>
          <span>{game ? `Playing ${game.title}` : 'Lobo OS · pick a game'}</span>
          {game && (
            <button className="btn" onClick={stopGame}>
              {onPc ? '◀ Back to the desktop' : '◀ Back to the TV menu'}
            </button>
          )}
          {game?.githubUrl && (
            <a className="btn" href={game.githubUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('github_clicked', { project: game.id, from: 'game-room-screen' })}>
              Source on GitHub ↗
            </a>
          )}
          {onPc && (
            <button className="btn" onClick={leaveComputer}>
              Stand up <kbd>Esc</kbd>
            </button>
          )}
        </div>
      </Html>
    </>
  );
}

/** While a game runs, the room stops redrawing (once the camera has settled), so the
 *  game gets the GPU to itself. */
function PauseRoom() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    const t = setTimeout(() => setFrameloop('demand'), 1500);
    return () => {
      clearTimeout(t);
      setFrameloop('always');
    };
  }, [setFrameloop]);
  return null;
}

function GameFrame({ game }: { game: PortfolioProject }) {
  const frame = useRef<HTMLIFrameElement>(null);
  // Hand the keyboard to the game as soon as it has loaded.
  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    const focus = () => {
      f.focus();
      f.contentWindow?.focus();
    };
    f.addEventListener('load', focus);
    return () => f.removeEventListener('load', focus);
  }, []);
  return <iframe ref={frame} className="screen-frame" src={assetUrl(game.playUrl!)} title={game.title} allow="autoplay; fullscreen" />;
}

/** The computer's start screen: one icon per bundled game. */
function Desktop() {
  const games = pcGames();
  const tvGames = projectsByCategory('games').filter((p) => p.playUrl && p.playOn === 'tv');
  return (
    <div className="lobo-os">
      <header>
        <b>LOBO OS</b>
        <span>Jose's browser games</span>
      </header>
      <div className="lobo-os-icons">
        {games.map((p) => (
          <button key={p.id} className="lobo-os-icon" onClick={() => playGame(p)}>
            {p.screenshots[0] && <img src={assetUrl(p.screenshots[0])} alt="" />}
            <b>{p.title}</b>
            <span>{p.shortDescription}</span>
          </button>
        ))}
      </div>
      {tvGames.length > 0 && <footer>Click a game to play it. {tvGames.map((p) => p.title).join(', ')}: find the box on the shelf and play it on the TV.</footer>}
    </div>
  );
}
