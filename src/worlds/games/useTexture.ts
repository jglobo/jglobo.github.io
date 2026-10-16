import { useEffect, useMemo } from 'react';
import type { Texture } from 'three';

/** Creates a texture once and disposes it with the component. */
export function useOwnedTexture<T extends Texture>(make: () => T, deps: unknown[] = []): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tex = useMemo(make, deps);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}
