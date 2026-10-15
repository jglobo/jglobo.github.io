import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

/** Load a GLB. A model inlined as a data: URL (for hosts that don't serve .glb files) is
 *  decoded and parsed directly, because some Content-Security-Policies block fetching
 *  data: URLs. */
export function loadGltf(url: string, loader = new GLTFLoader()): Promise<GLTF> {
  if (!url.startsWith('data:')) return loader.loadAsync(url);
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return loader.parseAsync(bytes.buffer, '');
}
