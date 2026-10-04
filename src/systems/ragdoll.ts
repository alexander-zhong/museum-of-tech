// Theatrical ragdoll: no physics engine, just a timed flop curve.
// Shared by remote corpses and your own third-person body, so a death
// reads the same from every angle in the room.

export const FALL_MS = 520; // time to tip over
export const CORPSE_MS = 2600; // how long a body lies there before it goes
const SINK_MS = 420; // it sinks through the floor rather than popping out

// Bodies rotate about hip height, not their feet — pivoting at the floor
// looks like a falling plank, pivoting at the hips looks like a collapse.
export const HIP_PIVOT = 0.5;

export interface RagdollPose {
  pitch: number; // tip forward or backward
  roll: number; // twist as it goes down
  spin: number; // yaw, added to whichever way they were facing
  y: number; // hop + collapse + final sink
  dx: number; // slide along the floor
  dz: number;
  gone: boolean; // past CORPSE_MS — stop drawing it
}

/** Cheap stable hash, so one body tumbles the same way for its whole fall. */
export function ragdollSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function ragdollPose(elapsedMs: number, seed: number): RagdollPose {
  const t = Math.max(0, elapsedMs) / 1000;
  const f = Math.min(1, Math.max(0, elapsedMs / FALL_MS));
  const ease = 1 - Math.pow(1 - f, 3); // quick tip, soft settle
  const back = seed > 0.5 ? 1 : -1; // face-plant or flat on the back
  const side = (seed * 7919) % 1; // the rest of the tumble, per body

  const hop = Math.max(0, 1.5 * t - 4.9 * t * t); // small pop off the ground
  const collapse = -HIP_PIVOT * 0.78 * ease; // hips drop as the body goes flat
  const sinkT = Math.min(
    1,
    Math.max(0, (elapsedMs - (CORPSE_MS - SINK_MS)) / SINK_MS),
  );
  const slide = ((0.55 + side * 0.5) * (1 - Math.exp(-3 * t))) / 3;

  return {
    pitch: back * (Math.PI / 2) * ease,
    roll: (side - 0.5) * 0.7 * ease,
    spin: (side - 0.5) * 1.6 * ease,
    y: hop + collapse - 1.4 * sinkT * sinkT,
    dx: Math.sin(side * Math.PI * 2) * slide,
    dz: -back * Math.cos(side * Math.PI * 2) * slide,
    gone: elapsedMs > CORPSE_MS,
  };
}
