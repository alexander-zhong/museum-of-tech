import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { collide, pointBlocked, roomAt, roomTitle } from "../world/layout";
import { useStore } from "../store";
import { say } from "../systems/narration";
import { dispatchInteract, promptFor } from "../systems/interact";
import { sfxFootstep, startAmbient } from "../systems/sfx";
import { feel } from "../systems/feel";

const SPEED = 4;
const SPRINT = 6.2;
const EYE = 1.6;
const REACH = 2.8;
const BASE_FOV = 75;

// jump / bhop tuning (Source-style, simplified)
const GRAVITY = 18;
const JUMP_VEL = 5.6;
const GROUND_ACCEL = 60;
const GROUND_FRICTION = 8;
const AIR_ACCEL = 24;
const MAX_AIR_SPEED = 11; // hard cap on horizontal speed
const BHOP_WINDOW = 160; // ms after landing where a jump keeps momentum
const BHOP_BOOST = 1.09; // speed multiplier per chained hop
const UPS = 62.5; // display conversion: 4 m/s walk ≈ 250 u/s, CS-style
const BOOM = 3.1; // third-person camera distance

export function PlayerController() {
  const { camera, scene } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const raycaster = useRef(new THREE.Raycaster());
  const lookedAt = useRef<string | null>(null);
  const lastMove = useRef(performance.now());
  const roomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bobPhase = useRef(0);
  const lastStep = useRef(0);
  const fovExtra = useRef(0);
  const vel = useRef(new THREE.Vector3()); // persistent horizontal velocity
  const vy = useRef(0);
  const jumpY = useRef(0); // height above the floor
  const lastLand = useRef(0);
  const speedoTimer = useRef(0);
  const head = useRef(new THREE.Vector3(0, EYE, 0.5)); // logical player head
  const smoothY = useRef(EYE);
  const avatar = useRef<THREE.Group>(null);

  useEffect(() => {
    camera.position.set(0, EYE, 0.5);

    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "KeyE" && lookedAt.current) {
        dispatchInteract(lookedAt.current);
      }
      if (e.code === "KeyV") {
        const s = useStore.getState();
        s.set({ view: s.view === "first" ? "third" : "first" });
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
      const sprinting = (k.ShiftLeft || k.ShiftRight) && fwd > 0;
      const groundMax = sprinting ? SPRINT : SPEED;
      const grounded = jumpY.current <= 0.0001 && vy.current <= 0;
      const now = performance.now();

      // wish direction from input, camera-relative
      const wish = new THREE.Vector3();
      if (fwd || strafe) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        wish.copy(dir.multiplyScalar(fwd)).add(side.multiplyScalar(strafe)).normalize();
      }

      if (grounded) {
        // jump (hold Space = auto-bhop)
        if (k.Space) {
          vy.current = JUMP_VEL;
          if (now - lastLand.current < BHOP_WINDOW && vel.current.length() > SPEED * 0.9) {
            vel.current.multiplyScalar(BHOP_BOOST); // chained hop: keep + build speed
          }
          if (vel.current.length() > MAX_AIR_SPEED) vel.current.setLength(MAX_AIR_SPEED);
          sfxFootstep();
        } else {
          // ground friction + acceleration
          vel.current.multiplyScalar(Math.max(0, 1 - GROUND_FRICTION * d));
          if (wish.lengthSq() > 0) {
            vel.current.addScaledVector(wish, GROUND_ACCEL * d);
            if (vel.current.length() > groundMax) vel.current.setLength(groundMax);
          }
        }
      } else {
        // airborne: gravity + air strafing, momentum preserved
        vy.current -= GRAVITY * d;
        if (wish.lengthSq() > 0) {
          vel.current.addScaledVector(wish, AIR_ACCEL * d);
          if (vel.current.length() > MAX_AIR_SPEED) vel.current.setLength(MAX_AIR_SPEED);
        }
      }

      // vertical integrate + land
      jumpY.current += vy.current * d;
      if (jumpY.current <= 0) {
        if (!grounded && vy.current < 0) {
          lastLand.current = now;
          sfxFootstep();
        }
        jumpY.current = 0;
        if (vy.current < 0) vy.current = 0;
      }

      // horizontal integrate with wall slide (kill velocity into walls)
      const intendedX = head.current.x + vel.current.x * d;
      const intendedZ = head.current.z + vel.current.z * d;
      const [nx, nz] = collide(intendedX, intendedZ);
      if (Math.abs(nx - intendedX) > 1e-6) vel.current.x = 0;
      if (Math.abs(nz - intendedZ) > 1e-6) vel.current.z = 0;
      head.current.x = nx;
      head.current.z = nz;

      const hSpeed = vel.current.length();
      const moving = hSpeed > 0.3;

      // head bob (grounded only) + footsteps
      if (grounded && moving && !k.Space) {
        bobPhase.current += d * (3 + hSpeed * 1.4);
        const stepBeat = Math.floor(bobPhase.current / Math.PI);
        if (stepBeat !== lastStep.current) {
          lastStep.current = stepBeat;
          sfxFootstep();
        }
      }
      const bob = grounded && moving ? Math.sin(bobPhase.current) * 0.035 : 0;
      smoothY.current +=
        (EYE + jumpY.current + bob - smoothY.current) * Math.min(1, d * 14);
      head.current.y = smoothY.current;

      if (moving) lastMove.current = now;

      // speedometer (imperative DOM — avoids re-rendering React every frame)
      speedoTimer.current += d;
      if (speedoTimer.current > 0.08) {
        speedoTimer.current = 0;
        const el = document.getElementById("speedo");
        if (el) {
          if (hSpeed > SPEED + 0.3 || !grounded) {
            el.textContent = `${Math.round(hSpeed * UPS)} u/s`;
            el.style.opacity = "1";
            el.style.color = hSpeed > SPRINT + 0.5 ? "#fc7900" : "#9ca3af";
          } else {
            el.style.opacity = "0";
          }
        }
      }

      // idle nag
      if (now - lastMove.current > 20000) {
        say("idle");
        lastMove.current = now;
      }
    }

    // camera placement: first person = at the head; third = boom behind, wall-clamped
    const third = state.view === "third";
    if (third) {
      const fwdDir = new THREE.Vector3();
      camera.getWorldDirection(fwdDir);
      let t = 1;
      for (; t >= 0.15; t -= 0.1) {
        const sx = head.current.x - fwdDir.x * BOOM * t;
        const sz = head.current.z - fwdDir.z * BOOM * t;
        if (!pointBlocked(sx, sz)) break;
      }
      camera.position.set(
        head.current.x - fwdDir.x * BOOM * t,
        Math.min(3.7, Math.max(0.5, head.current.y - fwdDir.y * BOOM * t + 0.25)),
        head.current.z - fwdDir.z * BOOM * t,
      );
    } else {
      camera.position.copy(head.current);
    }

    // avatar visible only in third person, facing camera yaw
    if (avatar.current) {
      avatar.current.visible = third && state.locked;
      if (avatar.current.visible) {
        avatar.current.position.set(
          head.current.x,
          head.current.y - EYE,
          head.current.z,
        );
        const fwdDir = new THREE.Vector3();
        camera.getWorldDirection(fwdDir);
        avatar.current.rotation.y = Math.atan2(fwdDir.x, fwdDir.z);
      }
    }

    // FOV: speed widen + shot kick, one smooth lerp
    feel.fovKick = Math.max(0, feel.fovKick - d * 14);
    const speedFov = Math.min(10, Math.max(0, (vel.current.length() - SPEED) * 1.6));
    const targetExtra = speedFov + feel.fovKick;
    fovExtra.current += (targetExtra - fovExtra.current) * Math.min(1, d * 9);
    const cam = camera as THREE.PerspectiveCamera;
    const wantFov = BASE_FOV + fovExtra.current;
    if (Math.abs(cam.fov - wantFov) > 0.01) {
      cam.fov = wantFov;
      cam.updateProjectionMatrix();
    }

    // room tracking
    const room = roomAt(head.current.x, head.current.z);
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
    raycaster.current.far = REACH + camera.position.distanceTo(head.current);
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
    <>
      <PointerLockControls
        onLock={() => {
          useStore.getState().set({ locked: true });
          startAmbient();
          say("intro");
        }}
        onUnlock={() =>
          useStore.getState().set({ locked: false, mode: "walk", prompt: null })
        }
      />
      {/* third-person avatar: low-poly museum visitor */}
      <group ref={avatar} visible={false}>
        <mesh position={[0, 0.78, 0]} raycast={() => null}>
          <capsuleGeometry args={[0.24, 0.8, 4, 10]} />
          <meshStandardMaterial color="#1e2430" roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[0, 1.52, 0]} raycast={() => null}>
          <sphereGeometry args={[0.17, 14, 14]} />
          <meshStandardMaterial color="#232a38" roughness={0.5} />
        </mesh>
        {/* visor */}
        <mesh position={[0, 1.54, 0.13]} raycast={() => null}>
          <boxGeometry args={[0.2, 0.06, 0.1]} />
          <meshBasicMaterial color="#fc7900" toneMapped={false} />
        </mesh>
        {/* backpack */}
        <mesh position={[0, 0.95, -0.24]} raycast={() => null}>
          <boxGeometry args={[0.3, 0.42, 0.14]} />
          <meshStandardMaterial color="#182028" roughness={0.8} />
        </mesh>
      </group>
    </>
  );
}
