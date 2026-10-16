// Things in the bedroom you can look at and use. The room controller casts a ray
// from the centre of the view each frame and asks the nearest target for its prompt.
import { useEffect } from 'react';
import type { Object3D } from 'three';

export interface LookTarget {
  id: string;
  object: () => Object3D | null;
  prompt: () => string | null;
  use: () => void;
  inspect?: () => void;
  reach?: number;
}

const targets = new Map<string, LookTarget>();

export function useLookTarget(target: LookTarget | null) {
  useEffect(() => {
    if (!target) return;
    targets.set(target.id, target);
    return () => {
      targets.delete(target.id);
    };
  }, [target]);
}

export const allLookTargets = () => targets;

/** Finds which target an intersected object belongs to (walks up the parents). */
export function targetFor(obj: Object3D | null): LookTarget | null {
  for (let o = obj; o; o = o.parent) {
    const id = o.userData.lookId as string | undefined;
    if (id && targets.has(id)) return targets.get(id)!;
  }
  return null;
}
