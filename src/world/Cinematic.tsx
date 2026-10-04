import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store";

// Montage director mode (F9): plays a scripted sequence of camera shots
// while the game runs underneath. Screen-record it, cut it, ship it.
type Shot =
  | { kind: "dolly"; from: [number, number, number]; to: [number, number, number]; look: [number, number, number]; dur: number }
  | { kind: "orbit"; center: [number, number, number]; r: number; y: number; a0: number; a1: number; dur: number }
  | { kind: "selfOrbit"; r: number; dur: number };

const SHOTS: Shot[] = [
  // 1. entry hall: slow orbit around the hologram
  { kind: "orbit", center: [0, 1.6, -1], r: 4.5, y: 2.2, a0: 0.6, a1: 3.4, dur: 6 },
  // 2. corridor push toward the CS room
  { kind: "dolly", from: [0, 2.1, -5], to: [0, 1.8, -23], look: [0, 1.4, -30], dur: 6 },
  // 3. range: side dolly across the strafing bots
  { kind: "dolly", from: [-3.4, 1.6, -33], to: [3.4, 1.5, -33], look: [0, 1.2, -37.3], dur: 6 },
  // 4. arena flyover, diagonal
  { kind: "dolly", from: [74, 6.5, -13], to: [104, 4.5, -45], look: [90, 1, -30], dur: 7 },
  // 5. hero orbit around YOUR otter, wherever you're standing
  { kind: "selfOrbit", r: 2.6, dur: 6 },
];

const ease = (t: number) => t * t * (3 - 2 * t);

export function Cinematic({ head }: { head: { current: THREE.Vector3 } }) {
  const { camera } = useThree();
  const cinema = useStore((s) => s.cinema);
  const t = useRef(0);
  const idx = useRef(0);
  const started = useRef(false);

  useFrame((_, dt) => {
    if (!cinema) {
      started.current = false;
      return;
    }
    if (!started.current) {
      started.current = true;
      t.current = 0;
      idx.current = 0;
    }
    const shot = SHOTS[idx.current];
    if (!shot) {
      useStore.getState().set({ cinema: false });
      return;
    }
    t.current += dt;
    const k = ease(Math.min(1, t.current / shot.dur));

    if (shot.kind === "dolly") {
      camera.position.set(
        shot.from[0] + (shot.to[0] - shot.from[0]) * k,
        shot.from[1] + (shot.to[1] - shot.from[1]) * k,
        shot.from[2] + (shot.to[2] - shot.from[2]) * k,
      );
      camera.lookAt(shot.look[0], shot.look[1], shot.look[2]);
    } else if (shot.kind === "orbit") {
      const a = shot.a0 + (shot.a1 - shot.a0) * k;
      camera.position.set(
        shot.center[0] + Math.cos(a) * shot.r,
        shot.y,
        shot.center[2] + Math.sin(a) * shot.r,
      );
      camera.lookAt(shot.center[0], shot.center[1], shot.center[2]);
    } else {
      const h = head.current;
      const a = k * Math.PI * 2 + 0.5;
      camera.position.set(h.x + Math.cos(a) * shot.r, h.y + 0.4, h.z + Math.sin(a) * shot.r);
      camera.lookAt(h.x, h.y - 0.2, h.z);
    }

    if (t.current >= shot.dur) {
      t.current = 0;
      idx.current += 1;
    }
  });

  return null;
}
