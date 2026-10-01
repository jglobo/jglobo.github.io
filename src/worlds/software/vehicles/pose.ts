/** What a vehicle model needs to draw itself; written by the controller each frame. */
export interface VehiclePose {
  x: number;
  y: number;
  z: number;
  heading: number;
  /** Signed forward speed, m/s (spins the wheels). */
  speed: number;
  /** -1..1 front-wheel / handlebar angle. */
  steer: number;
  /** Body lean in radians (positive leans right). */
  roll: number;
  /** Nose down positive. */
  pitch: number;
  /** Rider visible on top (bicycle). */
  ridden: boolean;
}

export const makePose = (x: number, z: number, heading: number): VehiclePose => ({ x, y: 0, z, heading, speed: 0, steer: 0, roll: 0, pitch: 0, ridden: false });
