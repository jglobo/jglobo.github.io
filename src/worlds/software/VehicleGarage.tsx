// The garage the visitor arrives at: an open-fronted workshop with the rideable
// vehicles out front and the rest of the planned fleet under covers.
import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { makeTextTexture } from '../../utils/textTexture';
import { GARAGE } from './layout';

/** Vehicles from the plan that are not rideable yet. */
export const COVERED = ['Off-road SUV', 'Sport bike', 'Cruiser', 'Dirt bike', 'Skateboard', 'ATV'];

export function VehicleGarage() {
  const w = GARAGE.maxX - GARAGE.minX;
  const d = GARAGE.maxZ - GARAGE.minZ;
  const cx = (GARAGE.minX + GARAGE.maxX) / 2;
  const cz = (GARAGE.minZ + GARAGE.maxZ) / 2;
  const h = GARAGE.height;
  const mats = useMemo(
    () => ({
      wall: new MeshStandardMaterial({ color: '#c9ccd4', roughness: 0.8 }),
      trim: new MeshStandardMaterial({ color: '#19e6ff', emissive: '#0b7f8f', emissiveIntensity: 0.6 }),
      floor: new MeshStandardMaterial({ color: '#5d626c', roughness: 0.6, metalness: 0.1 }),
      steel: new MeshStandardMaterial({ color: '#7a8292', metalness: 0.5, roughness: 0.45 }),
      tarp: new MeshStandardMaterial({ color: '#2f4a6a', roughness: 0.95 }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const sign = useMemo(
    () =>
      makeTextTexture(
        [
          { text: 'SOFTWARE GARAGE', size: 96, weight: '900', color: '#ffffff' },
          { text: 'pick a ride · apps are on the billboards', size: 42, weight: '600', color: '#b8fbff' },
        ],
        { width: 1400, height: 300, background: '#0c1420', glow: '#19e6ff' },
      ),
    [],
  );
  const labels = useMemo(
    () =>
      COVERED.map((name) =>
        makeTextTexture(
          [
            { text: name.toUpperCase(), size: 54, weight: '800', color: '#ffffff' },
            { text: 'coming soon', size: 38, weight: '500', color: '#b8fbff' },
          ],
          { width: 512, height: 180, background: '#14202e' },
        ),
      ),
    [],
  );
  const bayLabels = useMemo(
    () => ['SPORTS CAR', 'BICYCLE'].map((t) => makeTextTexture([{ text: t, size: 80, weight: '900', color: '#ffd23f' }], { width: 512, height: 128 })),
    [],
  );
  useEffect(() => () => [sign, ...labels, ...bayLabels].forEach((t) => t.dispose()), [sign, labels, bayLabels]);

  return (
    <group>
      <mesh material={mats.floor} position={[cx, 0.05, cz]} receiveShadow>
        <boxGeometry args={[w, 0.1, d]} />
      </mesh>
      {/* Back and side walls */}
      <mesh material={mats.wall} position={[cx, h / 2, GARAGE.minZ + 0.3]} castShadow receiveShadow>
        <boxGeometry args={[w, h, 0.6]} />
      </mesh>
      {[GARAGE.minX + 0.3, GARAGE.maxX - 0.3].map((x) => (
        <mesh key={x} material={mats.wall} position={[x, h / 2, cz]} castShadow receiveShadow>
          <boxGeometry args={[0.6, h, d]} />
        </mesh>
      ))}
      {/* Open roof trusses, so the elevated camera can see inside */}
      {[-5.5, -1.5, 2.5, GARAGE.maxZ - 0.2].map((z) => (
        <mesh key={z} material={mats.steel} position={[cx, h + 0.2, z]} castShadow>
          <boxGeometry args={[w + 1, 0.4, 0.4]} />
        </mesh>
      ))}
      <mesh material={mats.steel} position={[cx, h + 0.2, cz]}>
        <boxGeometry args={[0.3, 0.3, d]} />
      </mesh>
      <mesh material={mats.trim} position={[cx, h - 0.05, GARAGE.maxZ + 0.48]}>
        <boxGeometry args={[w + 1, 0.12, 0.06]} />
      </mesh>
      {[GARAGE.minX + 0.3, GARAGE.maxX - 0.3].map((x) => (
        <mesh key={`p${x}`} material={mats.steel} position={[x, h / 2, GARAGE.maxZ]}>
          <boxGeometry args={[0.7, h, 0.7]} />
        </mesh>
      ))}
      <mesh position={[cx, h + 1.4, GARAGE.maxZ + 0.55]}>
        <planeGeometry args={[11, 2.35]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      {/* Bay lines and labels for the rideable vehicles */}
      {[[-5, 0], [4, 1]].map(([x, i]) => (
        <group key={x} position={[x, 0.11, -1]}>
          {[-1.6, 1.6].map((dx) => (
            <mesh key={dx} position={[dx, 0, 0]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.12, 5]} />
              <meshBasicMaterial color="#ffd23f" />
            </mesh>
          ))}
          <mesh position={[0, 0.001, 3.1]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[2.6, 0.65]} />
            <meshBasicMaterial map={bayLabels[i]} transparent />
          </mesh>
        </group>
      ))}
      {/* The rest of the fleet, under covers along the back wall */}
      {COVERED.map((name, i) => {
        const x = GARAGE.minX + 2.2 + i * ((w - 4.4) / (COVERED.length - 1));
        const big = name === 'Off-road SUV' || name === 'ATV';
        return (
          <group key={name} position={[x, 0, GARAGE.minZ + 2]}>
            <mesh material={mats.tarp} position-y={big ? 0.8 : 0.55} scale={[big ? 1.3 : 0.6, big ? 0.8 : 0.55, big ? 1.6 : 1.1]} castShadow>
              <sphereGeometry args={[1, 14, 10]} />
            </mesh>
            <mesh position={[0, 2.6, -1.05]}>
              <planeGeometry args={[2.4, 0.84]} />
              <meshBasicMaterial map={labels[i]} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      {/* Workbench and tool wall */}
      <mesh material={mats.steel} position={[GARAGE.maxX - 1.4, 0.5, 2.5]} castShadow>
        <boxGeometry args={[1.4, 1, 3]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[GARAGE.maxX - 0.62, 1.8 + (i % 2) * 0.5, 1.6 + i * 0.6]}>
          <boxGeometry args={[0.05, 0.4, 0.1]} />
          <meshStandardMaterial color={['#e63946', '#ffd23f', '#19e6ff', '#9be564'][i]} />
        </mesh>
      ))}
      <pointLight position={[cx, h - 0.6, cz]} intensity={8} distance={22} color="#e6f4ff" />
    </group>
  );
}
