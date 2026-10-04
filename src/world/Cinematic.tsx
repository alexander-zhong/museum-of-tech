import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store";
import { feel } from "../systems/feel";

// Demo tour (P): a ~2 minute guided walkthrough of every exhibit with its
// own ElevenLabs voiceover (public/audio/demo-N.mp3, one per shot). While
// it runs the game's own narration is muted (see systems/narration.ts) and
// the HUD + viewmodel are hidden. Every path is a straight line through
// open space or a door gap, so the camera never crosses a wall.

type Shot =
  | { kind: "dolly"; from: [number, number, number]; to: [number, number, number]; look: [number, number, number]; dur: number }
  | { kind: "orbit"; center: [number, number, number]; r: number; y: number; a0: number; a1: number; dur: number };

const TOUR: Shot[] = [
  // 0. entry hall orbit (kept tight so it stays inside the hall)
  { kind: "orbit", center: [0, 1.5, -2.5], r: 3.0, y: 2.0, a0: 0.7, a1: 3.4, dur: 10 },
  // 1. corridor push
  { kind: "dolly", from: [0, 1.9, -4.6], to: [0, 1.7, -13.5], look: [0, 1.3, -20], dur: 10 },
  // 2. room 01 · transistor (west near) — in through the door gap
  { kind: "dolly", from: [-3.4, 1.6, -9.5], to: [-8.5, 1.6, -9.5], look: [-12.4, 1.3, -9.5], dur: 12 },
  // 3. room 02 · integrated circuit (east near)
  { kind: "dolly", from: [3.4, 1.6, -9.5], to: [8.5, 1.6, -9.5], look: [12.4, 1.3, -9.5], dur: 12 },
  // 4. room 03 · compiler (west far)
  { kind: "dolly", from: [-3.4, 1.6, -20.5], to: [-8.5, 1.6, -20.5], look: [-12.3, 1.3, -20.5], dur: 12 },
  // 5. room 04 · network (east far)
  { kind: "dolly", from: [3.4, 1.6, -20.5], to: [8.5, 1.6, -20.5], look: [12.4, 1.3, -20.5], dur: 12 },
  // 6. CS room: push toward the strafing bots
  { kind: "dolly", from: [0, 1.8, -27.2], to: [0, 1.5, -33.5], look: [0, 1.1, -37.3], dur: 13 },
  // 7. portal close-up (east wall of the CS room)
  { kind: "dolly", from: [1.5, 1.5, -30.2], to: [3.0, 1.4, -31.4], look: [4.3, 1.4, -32], dur: 7 },
  // 8. arena flyover
  { kind: "dolly", from: [74, 6.5, -13], to: [104, 4.5, -45], look: [90, 1, -30], dur: 12 },
  // 9. finale: slow push from the entrance looking down the museum
  { kind: "dolly", from: [0, 2.0, 1.2], to: [0, 1.7, -2.6], look: [0, 1.4, -12], dur: 10 },
];

const ease = (t: number) => t * t * (3 - 2 * t);

export function Cinematic({ head }: { head: { current: THREE.Vector3 } }) {
  const { camera } = useThree();
  const cinema = useStore((s) => s.cinema);
  const t = useRef(0);
  const idx = useRef(-1);
  const started = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  void head;

  const stopAudio = () => {
    audio.current?.pause();
    audio.current = null;
  };

  useFrame((_, dt) => {
    if (!cinema) {
      if (started.current) {
        stopAudio();
        feel.cinemaPov = false;
        started.current = false;
      }
      return;
    }
    if (!started.current) {
      started.current = true;
      t.current = 0;
      idx.current = -1;
    }
    feel.cinemaPov = false;

    // advance shots; -1 means "about to start shot 0"
    if (idx.current === -1 || t.current >= TOUR[idx.current].dur) {
      idx.current += 1;
      t.current = 0;
      const shot = TOUR[idx.current];
      if (!shot) {
        stopAudio();
        useStore.getState().set({ cinema: false });
        return;
      }
      stopAudio();
      try {
        audio.current = new Audio(`/audio/demo-${idx.current}.mp3`);
        audio.current.play().catch(() => {});
      } catch {
        /* voiceover missing: the tour still runs silent */
      }
    }

    const shot = TOUR[idx.current];
    t.current += dt;
    const k = ease(Math.min(1, t.current / shot.dur));

    if (shot.kind === "dolly") {
      camera.position.set(
        shot.from[0] + (shot.to[0] - shot.from[0]) * k,
        shot.from[1] + (shot.to[1] - shot.from[1]) * k,
        shot.from[2] + (shot.to[2] - shot.from[2]) * k,
      );
      camera.lookAt(shot.look[0], shot.look[1], shot.look[2]);
    } else {
      const a = shot.a0 + (shot.a1 - shot.a0) * k;
      camera.position.set(shot.center[0] + Math.cos(a) * shot.r, shot.y, shot.center[2] + Math.sin(a) * shot.r);
      camera.lookAt(shot.center[0], shot.center[1], shot.center[2]);
    }
  });

  return null;
}
