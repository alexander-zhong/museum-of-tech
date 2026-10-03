import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { collide, roomAt, roomTitle } from "../world/layout";
import { useStore } from "../store";
import { say } from "../systems/narration";
import { dispatchInteract, promptFor } from "../systems/interact";
import { sfxFootstep } from "../systems/sfx";

const SPEED = 4;
const EYE = 1.6;
const REACH = 2.8;

export function PlayerController() {
  const { camera, scene } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const raycaster = useRef(new THREE.Raycaster());
  const lookedAt = useRef<string | null>(null);
  const lastMove = useRef(performance.now());
  const roomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bobPhase = useRef(0);
  const lastStep = useRef(0);

  useEffect(() => {
    camera.position.set(0, EYE, 0.5);

    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "KeyE" && lookedAt.current) {
        dispatchInteract(lookedAt.current);
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [camera]);

  useFrame((_, dt) => {
    const state = useStore.getState();
    const d = Math.min(dt, 0.05);

    // movement (frozen while playing Pong)
    if (state.locked && state.mode === "walk") {
      const k = keys.current;
      const fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
      const strafe = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
      if (fwd || strafe) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        const move = dir
          .multiplyScalar(fwd)
          .add(side.multiplyScalar(strafe))
          .normalize()
          .multiplyScalar(SPEED * d);
        const [nx, nz] = collide(
          camera.position.x + move.x,
          camera.position.z + move.z,
        );
        camera.position.x = nx;
        camera.position.z = nz;
        // head bob + footsteps
        bobPhase.current += d * 9;
        camera.position.y = EYE + Math.sin(bobPhase.current) * 0.035;
        const stepBeat = Math.floor(bobPhase.current / Math.PI);
        if (stepBeat !== lastStep.current) {
          lastStep.current = stepBeat;
          sfxFootstep();
        }
        lastMove.current = performance.now();
      } else {
        // settle the camera when standing still
        camera.position.y += (EYE - camera.position.y) * Math.min(1, d * 8);
      }
      // idle nag
      if (performance.now() - lastMove.current > 20000) {
        say("idle");
        lastMove.current = performance.now();
      }
    }

    // room tracking
    const room = roomAt(camera.position.x, camera.position.z);
    if (room !== state.room) {
      state.set({ room });
      const title = roomTitle(room);
      if (title) {
        state.set({ roomTitle: title });
        if (roomTimer.current) clearTimeout(roomTimer.current);
        roomTimer.current = setTimeout(
          () => useStore.getState().set({ roomTitle: null }),
          3000,
        );
      }
      if (room && room !== "entry") say(`entry-${room}`);
    }

    // crosshair raycast for interactables
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.current.far = REACH;
    const hits = raycaster.current.intersectObjects(scene.children, true);
    let found: string | null = null;
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.interactId) {
          found = o.userData.interactId as string;
          break;
        }
        o = o.parent;
      }
      if (found) break;
      if (h.object.type === "Mesh") break; // wall blocks the ray
    }
    if (found !== lookedAt.current) {
      lookedAt.current = found;
      state.set({ prompt: found ? promptFor(found) : null });
    } else if (found) {
      // label can be dynamic (e.g. Pong: play/exit)
      const p = promptFor(found);
      if (p !== state.prompt) state.set({ prompt: p });
    }
  });

  return (
    <PointerLockControls
      onLock={() => {
        useStore.getState().set({ locked: true });
        say("intro");
      }}
      onUnlock={() =>
        useStore.getState().set({ locked: false, mode: "walk", prompt: null })
      }
    />
  );
}
