import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store";
import { feel, session } from "../systems/feel";

// Montage director mode (F9): a fully scripted ~45s performance.
// The sequence teleports the player between sets, swaps weapons, fires
// real bursts (tracers, bot takedowns, stacked jingles) and mixes POV
// shots with cinematic moves. Screen-record and walk away.

type Ev = { t: number; act: () => void };
type Shot = (
  | { kind: "dolly"; from: [number, number, number]; to: [number, number, number]; look: [number, number, number] }
  | { kind: "orbit"; center: [number, number, number]; r: number; y: number; a0: number; a1: number }
  | { kind: "selfOrbit"; r: number }
  | { kind: "pov"; aim: [number, number, number] }
) & { dur: number; events?: Ev[] };

const md = () => window.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
const mu = () => window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
const setW = (w: string) => useStore.getState().set({ weapon: w });
const tp = (x: number, z: number) => session.teleport(x, z);

const SHOTS: Shot[] = [
  // 1. establishing: hologram orbit while the player is staged at the range
  {
    kind: "orbit", center: [0, 1.6, -1], r: 4.5, y: 2.2, a0: 0.6, a1: 3.2, dur: 5,
    events: [
      { t: 0.1, act: () => { tp(0, -31.5); setW("rifle"); } },
    ],
  },
  // 2. corridor push
  { kind: "dolly", from: [0, 2.1, -5], to: [0, 1.8, -22], look: [0, 1.4, -30], dur: 5 },
  // 3. POV: AK burst into the strafing bots — tracers, flops, jingle chaos
  {
    kind: "pov", aim: [0, 1.15, -37.3], dur: 5.5,
    events: [
      { t: 0.5, act: md }, { t: 1.6, act: mu },
      { t: 2.2, act: md }, { t: 3.4, act: mu },
      { t: 3.9, act: md }, { t: 5.2, act: mu },
    ],
  },
  // 4. side dolly across the carnage while bots pop back up
  { kind: "dolly", from: [-3.4, 1.6, -33.5], to: [3.4, 1.4, -33.5], look: [0, 1.1, -37.3], dur: 5 },
  // 5. hero orbit: your otter, AWP in paws, arena set
  {
    kind: "selfOrbit", r: 2.6, dur: 5.5,
    events: [{ t: 0.05, act: () => { tp(90, -30); setW("awp"); } }],
  },
  // 6. POV: scoped AWP shot across the arena, then a second one
  {
    kind: "pov", aim: [74, 1, -46], dur: 5.5,
    events: [
      { t: 0.4, act: () => { feel.fovZoom = -34; } },
      { t: 1.4, act: md }, { t: 1.5, act: mu },
      { t: 3.4, act: md }, { t: 3.5, act: mu },
      { t: 5.0, act: () => { feel.fovZoom = 0; } },
    ],
  },
  // 7. arena flyover
  { kind: "dolly", from: [74, 6.5, -13], to: [104, 4.5, -45], look: [90, 1, -30], dur: 6 },
  // 8. finale: knife out, tight low orbit on the otter back home
  {
    kind: "selfOrbit", r: 2.2, dur: 6,
    events: [{ t: 0.05, act: () => { tp(0, -1.0 + 3.2); setW("knife"); } }],
  },
];

const ease = (t: number) => t * t * (3 - 2 * t);

export function Cinematic({ head }: { head: { current: THREE.Vector3 } }) {
  const { camera } = useThree();
  const cinema = useStore((s) => s.cinema);
  const t = useRef(0);
  const idx = useRef(0);
  const fired = useRef(0);
  const started = useRef(false);

  useFrame((_, dt) => {
    if (!cinema) {
      if (started.current) {
        // clean exit even when cancelled mid-burst
        mu();
        feel.fovZoom = 0;
        feel.cinemaPov = false;
        started.current = false;
      }
      return;
    }
    if (!started.current) {
      started.current = true;
      t.current = 0;
      idx.current = 0;
      fired.current = 0;
    }
    const shot = SHOTS[idx.current];
    if (!shot) {
      mu();
      feel.fovZoom = 0;
      feel.cinemaPov = false;
      useStore.getState().set({ cinema: false });
      return;
    }
    feel.cinemaPov = shot.kind === "pov";
    t.current += dt;

    // fire any due events exactly once
    if (shot.events) {
      for (const ev of shot.events) {
        const key = idx.current * 100 + shot.events.indexOf(ev);
        if (t.current >= ev.t && fired.current <= key) {
          ev.act();
          fired.current = key + 1;
        }
      }
    }

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
      camera.position.set(shot.center[0] + Math.cos(a) * shot.r, shot.y, shot.center[2] + Math.sin(a) * shot.r);
      camera.lookAt(shot.center[0], shot.center[1], shot.center[2]);
    } else if (shot.kind === "selfOrbit") {
      const h = head.current;
      const a = k * Math.PI * 2 + 0.5;
      camera.position.set(h.x + Math.cos(a) * shot.r, h.y + 0.4, h.z + Math.sin(a) * shot.r);
      camera.lookAt(h.x, h.y - 0.2, h.z);
    } else {
      // pov: sit at the player's eyes, aim at the mark with a little sway
      const h = head.current;
      camera.position.set(h.x, h.y, h.z);
      const sway = Math.sin(t.current * 1.6) * 0.15;
      camera.lookAt(shot.aim[0] + sway, shot.aim[1], shot.aim[2]);
    }

    if (t.current >= shot.dur) {
      t.current = 0;
      idx.current += 1;
      fired.current = idx.current * 100;
    }
  });

  return null;
}
