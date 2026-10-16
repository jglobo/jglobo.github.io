// Which of Jose's clips to play, and how fast, for the robot, the bike and the car.
// The playback rates are worked out from the models so wheels and feet match the
// ground speed. Pure, so it is unit tested.

export interface ClipChoice { name: string; timeScale: number }

/** Bike wheel radius 0.37 m; Cycle turns the wheels twice a second (Jose's controller). */
const CYCLE = 2 * Math.PI * 2 * 0.37;
export const CYCLE_SPEEDS = { CycleIdle: 0, Cycle: CYCLE, CycleFast: CYCLE / (20 / 30), Coast: CYCLE / 2 } as const;

/** Rider and bike together: pedal when the throttle is held, coast when it is not. */
export function cyclingClip(speed: number, pedalling: boolean): ClipChoice {
  const s = Math.abs(speed);
  if (s < 0.02) return { name: 'CycleIdle', timeScale: 1 };
  const name = !pedalling ? 'Coast' : s > 5.8 ? 'CycleFast' : 'Cycle';
  return { name, timeScale: s / CYCLE_SPEEDS[name] };
}

/** Car wheel radius 0.35 m; each clip's wheel turns per loop, measured from the model. */
const wheel = (turns: number, seconds: number) => (turns / seconds) * 2 * Math.PI * 0.35;
export const CAR_SPEEDS = {
  Car_Drive: wheel(4, 2),
  Car_DriveFast: wheel(4, 1),
  Car_TurnLeft: wheel(3, 2),
  Car_TurnRight: wheel(3, 2),
  Car_Reverse: wheel(2, 2),
} as const;

/** `steer` is -1 (left) .. 1 (right). */
export function carClip(forward: number, steer: number): ClipChoice {
  if (forward < -0.3) return { name: 'Car_Reverse', timeScale: -forward / CAR_SPEEDS.Car_Reverse };
  if (forward <= 0.3) return { name: 'Car_Idle', timeScale: 1 };
  if (Math.abs(steer) > 0.45 && forward < 14) {
    const name = steer < 0 ? 'Car_TurnLeft' : 'Car_TurnRight';
    return { name, timeScale: forward / CAR_SPEEDS[name] };
  }
  const name = forward > 9 ? 'Car_DriveFast' : 'Car_Drive';
  return { name, timeScale: forward / CAR_SPEEDS[name] };
}

/** Ground speed of the robot's Walk and Run cycles at normal rate (feet planted). */
export const FOOT_SPEEDS = { Walk: 1.25, Run: 3.5 } as const;

export function footClip(speed: number): ClipChoice {
  if (speed < 0.15) return { name: 'Idle', timeScale: 1 };
  const name = speed < 3.2 ? 'Walk' : 'Run';
  return { name, timeScale: speed / FOOT_SPEEDS[name] };
}
