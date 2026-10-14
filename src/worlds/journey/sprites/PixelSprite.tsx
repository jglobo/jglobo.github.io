// A pixel-art character in the 3D town: an upright, slightly tilted card that
// faces the camera, picks its frame from an atlas, casts a real shadow and has a
// soft blob shadow for low graphics settings.
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, NearestFilter, PlaneGeometry, SRGBColorSpace } from 'three';
import { qualityProfile } from '../../../stores/settingsStore';
import { blobTexture } from '../textures';
import { useOwned } from '../useOwned';

export const PIXEL = 0.075;

export interface SpriteState { x: number; y: number; z: number; frame: number; flip: boolean; visible: boolean }

export function atlasTexture(atlas: { width: number; height: number; data: Uint8ClampedArray }, frames: number) {
  const c = document.createElement('canvas');
  c.width = atlas.width;
  c.height = atlas.height;
  const img = new ImageData(atlas.width, atlas.height);
  img.data.set(atlas.data);
  c.getContext('2d')!.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.repeat.set(1 / frames, 1);
  return t;
}

export function PixelSprite({
  atlas,
  frames,
  pxW,
  pxH,
  state,
  shadowSize = 0.9,
}: {
  atlas: { width: number; height: number; data: Uint8ClampedArray };
  frames: number;
  pxW: number;
  pxH: number;
  state: SpriteState;
  shadowSize?: number;
}) {
  const mesh = useRef<Mesh>(null);
  const blob = useRef<Mesh>(null);
  const shadows = qualityProfile().shadows;
  const res = useOwned(() => {
    const map = atlasTexture(atlas, frames);
    const w = pxW * PIXEL;
    const h = pxH * PIXEL;
    const geo = new PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    const mat = new MeshStandardMaterial({ map, alphaTest: 0.5, side: DoubleSide, roughness: 1, metalness: 0, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.28 });
    const blobMap = blobTexture();
    const blobMat = new MeshBasicMaterial({ map: blobMap, transparent: true, depthWrite: false });
    const blobGeo = new PlaneGeometry(shadowSize, shadowSize * 0.55);
    blobGeo.rotateX(-Math.PI / 2);
    return { map, geo, mat, blobMap, blobMat, blobGeo };
  }, [atlas]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    m.visible = state.visible;
    m.position.set(state.x, state.y, state.z);
    res.map.repeat.x = (state.flip ? -1 : 1) / frames;
    res.map.offset.x = (state.frame + (state.flip ? 1 : 0)) / frames;
    if (blob.current) {
      blob.current.visible = state.visible;
      blob.current.position.set(state.x, 0.03, state.z);
      const s = 1 / (1 + state.y * 0.8);
      blob.current.scale.set(s, 1, s);
    }
  });

  return (
    <>
      <mesh ref={mesh} geometry={res.geo} material={res.mat} castShadow={shadows} rotation-x={-0.18} />
      <mesh ref={blob} geometry={res.blobGeo} material={res.blobMat} renderOrder={1} />
    </>
  );
}
