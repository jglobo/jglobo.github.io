// Arcade vehicle model shared by every vehicle. Velocity is kept in world space and
// split into forward and sideways parts each step: throttle and drag act forward,
// grip bleeds off the sideways part (less grip = drift). Ramps and jumps use a
// simple vertical integrator. Pure, so it is unit tested.
import { collide, groundAt, onRoad } from '../layout.ts';

export interface VehicleSpec {
  id: string;
  name: string;
  /** m/s */
  maxSpeed: number;
  offRoadMaxSpeed: number;
  accel: number;
  brake: number;
  reverseMax: number;
  /** Max yaw rate in rad/s. */
  steer: number;
  /** Sideways velocity decay per second (higher = more grip). */
  grip: number;
  /** Grip while the handbrake is held. */
  driftGrip: number;
  /** Vertical jump speed, 0 = cannot jump. */
  jump: number;
  /** Collision radius. */
  radius: number;
  /** Air control: yaw rate while airborne (tricks). */
  airSpin: number;
}

export const SPECS: Record<string, VehicleSpec> = {
  'sports-car': {
    id: 'sports-car', name: 'Sports car',
    maxSpeed: 34, offRoadMaxSpeed: 16, accel: 14, brake: 30, reverseMax: 8, steer: 2.1, grip: 9, driftGrip: 1.3, jump: 0, radius: 1.6, airSpin: 0,
  },
  bicycle: {
    id: 'bicycle', name: 'Bicycle',
    maxSpeed: 12, offRoadMaxSpeed: 9, accel: 7, brake: 16, reverseMax: 2, steer: 3.2, grip: 14, driftGrip: 6, jump: 6.5, radius: 0.6, airSpin: 10,
  },
};

export interface VehicleInput {
  throttle: number; // -1..1 (negative = brake / reverse)
  steer: number; // -1 (left) .. 1 (right)
  handbrake: boolean;
  jump: boolean;
}

export interface VehicleState {
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  /** Heading in radians; 0 faces north (-z), positive turns right (clockwise from above). */
  heading: number;
  grounded: boolean;
  /** Yaw accumulated while airborne, for trick detection. */
  airYaw: number;
  /** Set for one step when a trick lands: full turns completed in the air. */
  landedSpins: number;
  drifting: boolean;
}

const GRAVITY = 20;

export const initialVehicle = (x: number, z: number, heading = 0): VehicleState => ({
  x, z, y: groundAt(x, z), vx: 0, vz: 0, vy: 0, heading, grounded: true, airYaw: 0, landedSpins: 0, drifting: false,
});

export const forwardOf = (h: number) => ({ x: Math.sin(h), z: -Math.cos(h) });

/** Signed forward speed. */
export function speedOf(s: VehicleState) {
  const f = forwardOf(s.heading);
  return s.vx * f.x + s.vz * f.z;
}

export function stepVehicle(prev: VehicleState, spec: VehicleSpec, input: VehicleInput, dt: number): VehicleState {
  const s = { ...prev, landedSpins: 0 };

  if (s.grounded) {
    const road = onRoad(s.x, s.z);
    const cap = road ? spec.maxSpeed : spec.offRoadMaxSpeed;
    // Steering first: it scales in with speed and reverses when backing up.
    const f0 = forwardOf(s.heading);
    const fwd0 = s.vx * f0.x + s.vz * f0.z;
    const steerAmount = spec.steer * Math.min(1, Math.abs(fwd0) / 4) * Math.sign(fwd0 || 1);
    const highSpeedDamp = 1 - Math.min(0.45, (Math.abs(fwd0) / spec.maxSpeed) * 0.45);
    s.heading += input.steer * steerAmount * highSpeedDamp * (input.handbrake ? 1.35 : 1) * dt;

    // The velocity does not turn with the body: split it in the new frame.
    const f = forwardOf(s.heading);
    const r = { x: -f.z, z: f.x };
    let fwd = s.vx * f.x + s.vz * f.z;
    let side = s.vx * r.x + s.vz * r.z;

    if (input.throttle > 0) {
      fwd += (fwd < 0 ? spec.brake : spec.accel * (1 - Math.max(0, fwd) / cap)) * input.throttle * dt;
    } else if (input.throttle < 0) {
      if (fwd > 0.5) fwd = Math.max(0, fwd + spec.brake * input.throttle * dt);
      else fwd = Math.max(-spec.reverseMax, fwd + spec.accel * 0.6 * input.throttle * dt);
    }
    // Rolling resistance and air drag; more off road.
    const drag = (road ? 0.25 : 0.9) + Math.abs(fwd) * 0.012;
    fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), drag * dt * (input.throttle === 0 ? 4 : 1));
    if (fwd > cap) fwd += (cap - fwd) * Math.min(1, dt * 2);
    if (input.handbrake) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), spec.brake * 0.25 * dt);

    side *= Math.exp(-(input.handbrake ? spec.driftGrip : spec.grip) * dt);
    s.drifting = Math.abs(side) > 2.5;
    s.vx = f.x * fwd + r.x * side;
    s.vz = f.z * fwd + r.z * side;

    if (input.jump && spec.jump > 0) {
      s.vy = spec.jump;
      s.grounded = false;
      s.airYaw = 0;
    }
  } else {
    // In the air: no traction; some vehicles can spin.
    const spin = input.steer * spec.airSpin * dt;
    s.heading += spin;
    s.airYaw += spin;
    s.drifting = false;
  }

  const ox = s.x;
  const oz = s.z;
  s.x += s.vx * dt;
  s.z += s.vz * dt;

  // Vertical: follow the ground, launch off ramp tops, fall with gravity.
  const before = groundAt(ox, oz);
  const ground = groundAt(s.x, s.z);
  if (s.grounded) {
    const rise = (ground - before) / Math.max(1e-6, dt);
    if (ground < before - 0.05) {
      // Left the top of a ramp: keep the climb speed and fly.
      s.grounded = false;
      s.vy = Math.max(0, prev.vy);
      s.airYaw = 0;
      s.y = before;
    } else {
      s.y = ground;
      s.vy = rise;
    }
  }
  if (!s.grounded) {
    s.vy -= GRAVITY * dt;
    s.y += s.vy * dt;
    if (s.y <= ground) {
      s.y = ground;
      s.vy = 0;
      s.grounded = true;
      // A little forgiveness: landing within ~50 degrees of a full turn still counts.
      s.landedSpins = Math.floor((Math.abs(s.airYaw) + 0.9) / (Math.PI * 2));
      s.airYaw = 0;
    }
  }

  // Collisions: push out and kill the velocity going into the obstacle.
  const c = collide(s.x, s.z, spec.radius);
  if (c.hit) {
    s.x = c.x;
    s.z = c.z;
    const into = s.vx * c.nx + s.vz * c.nz;
    if (into < 0) {
      s.vx -= c.nx * into * 1.3;
      s.vz -= c.nz * into * 1.3;
      s.vx *= 0.7;
      s.vz *= 0.7;
    }
  }
  return s;
}
