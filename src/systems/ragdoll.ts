// Theatrical ragdoll: no physics engine, just a timed flop curve.
// Shared by remote corpses and your own third-person body, so a death
// reads the same from every angle in the room.

export const FALL_MS = 520; // time to tip over
export const CORPSE_MS = 2600; // how long a body lies there before it goes
const SINK_MS = 420; // it sinks through the floor rather than popping out

// Bodies rotate about hip height, not their feet — pivoting at the floor
// looks like a falling plank, pivoting at the hips looks like a collapse.
export const HIP_PIVOT = 0.5;

/** The shot that put someone down: what the flop is built from. */
export interface Knock {
  dx: number; // unit horizontal direction the bullet was travelling
  dz: number;
  force: number; // how hard this weapon shoves, ~0.3 (knife) to 1.4 (AWP)
  seed: number; // per-death randomness, shared so every screen agrees
}

export interface RagdollPose {
  pitch: number; // tip forward or backward
  roll: number; // tip sideways
  spin: number; // yaw, added to whichever way they were facing
  y: number; // hop + collapse + final sink
  dx: number; // slide along the floor, in world space
  dz: number;
  gone: boolean; // past CORPSE_MS — stop drawing it
}

/** For deaths with no recorded shot: shove them the way they were facing. */
export function fallbackKnock(yaw: number, seed = Math.random()): Knock {
  return { dx: Math.sin(yaw), dz: Math.cos(yaw), force: 0.5, seed };
}

export function ragdollPose(
  elapsedMs: number,
  k: Knock,
  yaw: number,
): RagdollPose {
  const t = Math.max(0, elapsedMs) / 1000;
  const f = Math.min(1, Math.max(0, elapsedMs / FALL_MS));
  const ease = 1 - Math.pow(1 - f, 3); // quick tip, soft settle

  // The bullet's direction in the body's own frame. At yaw 0 a body faces
  // +Z, so forward is (sin, cos) and its local +X is (cos, -sin).
  const fwd = k.dx * Math.sin(yaw) + k.dz * Math.cos(yaw); // +1 = shot in the back
  const side = k.dx * Math.cos(yaw) - k.dz * Math.sin(yaw); // +1 = from their right

  const hop = Math.max(0, (1.1 + 0.5 * k.force) * t - 4.9 * t * t);
  const collapse = -HIP_PIVOT * 0.78 * ease; // hips drop as the body goes flat
  const sinkT = Math.min(
    1,
    Math.max(0, (elapsedMs - (CORPSE_MS - SINK_MS)) / SINK_MS),
  );
  const slide = (0.22 + 0.5 * k.force) * (1 - Math.exp(-3 * t));

  return {
    // shot from behind and they face-plant; shot in the chest and they go
    // down backward; anything off-axis tips them sideways to match
    pitch: (Math.PI / 2) * fwd * ease,
    roll: -(Math.PI / 2) * side * 0.85 * ease,
    spin: ((k.seed - 0.5) * 1.2 + side * 0.6) * ease,
    y: hop + collapse - 1.4 * sinkT * sinkT,
    dx: k.dx * slide,
    dz: k.dz * slide,
    gone: elapsedMs > CORPSE_MS,
  };
}
