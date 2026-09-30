// The 3D part of the app, loaded as its own chunk only when the visitor enters.
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ACESFilmicToneMapping, SRGBColorSpace, type PerspectiveCamera } from 'three';
import { WorldHost } from '../worlds/WorldHost';
import { DebugProbe } from '../engine/debug/DebugProbe';
import { canvasPointerDown, canvasPointerUp, canvasWheel } from '../engine/input/input';
import { requestLock } from '../engine/input/pointerLock';
import { useGame } from '../stores/gameStore';
import { QUALITY_PROFILES, useSettings, type Quality } from '../stores/settingsStore';

const ORDER: Quality[] = ['low', 'medium', 'high', 'ultra'];

export default function GameShell() {
  const quality = useSettings((s) => s.quality);
  const profile = QUALITY_PROFILES[quality];
  const world = useGame((s) => s.currentWorld);
  const wrapper = useRef<HTMLDivElement>(null);
  const [lost, setLost] = useState(false);

  const onDecline = useCallback(() => {
    const s = useSettings.getState();
    const i = ORDER.indexOf(s.quality);
    if (i > 0) {
      s.set({ quality: ORDER[i - 1] });
      useGame.getState().setHint(`Graphics lowered to ${ORDER[i - 1]} to keep things smooth (change in Settings).`);
    }
  }, []);

  if (lost) return <CrashFallback reason="The graphics context was lost." />;

  return (
    <CanvasErrorBoundary>
      <div
        ref={wrapper}
        className="canvas-wrap"
        onPointerDown={(e) => {
          const g = useGame.getState();
          // First-person worlds capture the mouse; the 2.5D space world does not need it.
          if (world === 'hub' && g.overlay === 'none' && !document.pointerLockElement) requestLock(e.currentTarget);
          canvasPointerDown(e.nativeEvent);
        }}
        onPointerUp={(e) => canvasPointerUp(e.nativeEvent)}
        onWheel={(e) => canvasWheel(e.nativeEvent)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Canvas
          key={quality}
          dpr={[1, profile.maxDpr]}
          shadows={profile.shadows}
          camera={{ fov: world === 'hub' ? 75 : 50, near: 0.05, far: 1200, position: [0, 1.7, 9] }}
          gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setLost(true);
            });
          }}
        >
          <PerformanceMonitor onDecline={onDecline} flipflops={2} />
          <FovSync world={world} />
          <WorldHost />
          <DebugProbe />
        </Canvas>
      </div>
    </CanvasErrorBoundary>
  );
}

/** Each world picks its own field of view (first person wide, space cinematic). */
function FovSync({ world }: { world: string }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useEffect(() => {
    camera.fov = world === 'hub' ? 75 : 50;
    camera.updateProjectionMatrix();
  }, [camera, world]);
  return null;
}

function CrashFallback({ reason }: { reason: string }) {
  return (
    <div className="crash">
      <h2>The 3D view stopped working</h2>
      <p>{reason} Everything in the portfolio is still available.</p>
      <div className="crash-actions">
        <button className="btn primary" onClick={() => useGame.getState().openOverlay('quick', 'about')}>Open Quick Portfolio</button>
        <button className="btn" onClick={() => location.reload()}>Reload</button>
      </div>
    </div>
  );
}

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('3D view crashed:', error);
  }
  render() {
    return this.state.error ? <CrashFallback reason="Something went wrong while rendering." /> : this.props.children;
  }
}
