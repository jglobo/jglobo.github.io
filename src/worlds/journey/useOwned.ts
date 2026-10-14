import { useEffect, useMemo } from 'react';

/** Creates GPU resources once (materials, geometries, textures) and disposes them with the component. */
export function useOwned<T>(make: () => T, deps: unknown[] = []): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(make, deps);
  useEffect(
    () => () => {
      const dispose = (v: unknown): void => {
        if (Array.isArray(v)) v.forEach(dispose);
        else if (v && typeof (v as { dispose?: unknown }).dispose === 'function') (v as { dispose: () => void }).dispose();
      };
      if (value && typeof value === 'object' && !('dispose' in value)) Object.values(value).forEach(dispose);
      else dispose(value);
    },
    [value],
  );
  return value;
}
