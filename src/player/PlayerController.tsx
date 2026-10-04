import { Suspense, useEffect, useRef } from "react";
import { SparkyAvatar } from "../world/Mascots";
import { Cinematic } from "../world/Cinematic";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { collide, pointBlocked, roomAt, roomTitle, PORTALS } from "../world/layout";
import { useStore } from "../store";
import { say, narrateRoom } from "../systems/narration";
import { dispatchInteract, promptFor } from "../systems/interact";
import { sfxFootstep, sfxThud, startAmbient } from "../systems/sfx";
import { feel, session } from "../systems/feel";
import { weaponById } from "../systems/weapons";
import { sendState } from "../systems/net";
import { combatTick } from "../systems/combat";
import {
  FALL_MS,
  HIP_PIVOT,
  fallbackKnock,
  ragdollPose,
  type Knock,
} from "../systems/ragdoll";

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
const BOOM = 3.1; // third-person camera distance
const DEAD_EYE = 0.42; // where the camera ends up once you hit the floor
const DEAD_ROLL = 0.95; // and how far it rolls over

export function PlayerController() {
  const { camera, scene } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const raycaster = useRef(new THREE.Raycaster());
  const lookedAt = useRef<string | null>(null);
  const lastMove = useRef(performance.now());
  const roomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMapUpdate = useRef(0);
  const bobPhase = useRef(0);
  const lastStep = useRef(0);
  const fovExtra = useRef(0);
  const vel = useRef(new THREE.Vector3()); // persistent horizontal velocity
  const vy = useRef(0);
  const jumpY = useRef(0); // height above the floor
  const lastLand = useRef(0);
  const head = useRef(new THREE.Vector3(0, EYE, 0.5)); // logical player head
  const portalCd = useRef(0);
  const smoothY = useRef(EYE);
  const avatar = useRef<THREE.Group>(null);
  const avatarFlop = useRef<THREE.Group>(null);
  const deadSince = useRef(0); // drives the death cam and your own ragdoll
  const deadYaw = useRef(0); // the way you were facing when you dropped
  const roll = useRef(0); // death-cam roll, owned here — never read off the camera
  const thudded = useRef(false);
  const knock = useRef<Knock>(fallbackKnock(0));

  useEffect(() => {
    camera.position.set(0, EYE, 0.5);
    // Default XYZ order reports a fake z (roll) for any yaw+pitch look
    // direction; YXZ matches how PointerLockControls builds the orientation,
    // so rotation.z means roll and nothing else.
    camera.rotation.order = "YXZ";
    // R3F aims the default camera at the world origin unless the Canvas camera
    // props carry a rotation, which from eye height is a faceful of floor.
    // Level it: zero yaw looks down -Z, straight along the corridor.
    camera.rotation.set(0, 0, 0);

    const down = (e: KeyboardEvent) => {
      if (useStore.getState().lesson) return;
      keys.current[e.code] = true;
      if (e.code === "KeyE" && lookedAt.current) {
        dispatchInteract(lookedAt.current);
      }
      if (e.code === "KeyV") {
        const s = useStore.getState();
        s.set({ view: s.view === "first" ? "third" : "first" });
      }
      if (e.code === "KeyP") {
        const s = useStore.getState();
        s.set({ cinema: !s.cinema });
        if (!s.cinema) document.exitPointerLock();
        return;
      }
      if (e.code === "KeyM") {
        const s = useStore.getState();
        if (!s.started) return;
        if (s.econMenu) {
          s.set({ econMenu: false });
          session.lock();
        } else {
          s.set({ econMenu: true, buyMenu: false });
          document.exitPointerLock();
        }
      }
    };
    const unsubscribeLesson = useStore.subscribe((state, previous) => {
      if (state.lesson !== previous.lesson) keys.current = {};
    });
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    // combat uses this to drop us at a spawn point after we respawn
    session.teleport = (x: number, z: number) => {
      head.current.set(x, EYE, z);
      smoothY.current = EYE;
      vel.current.set(0, 0, 0);
      vy.current = 0;
      jumpY.current = 0;
      camera.position.copy(head.current);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    // multiplayer broadcast on a timer, NOT the render loop and NOT gated on
    // pointer lock — so a paused or unfocused window stays present in the
    // world instead of freezing out, like a real online game.
    const dir = new THREE.Vector3();
    const net = setInterval(() => {
      camera.getWorldDirection(dir);
      const s = useStore.getState();
      try {
        sendState({
          p: [head.current.x, head.current.y, head.current.z],
          yaw: Math.atan2(dir.x, dir.z),
          char: s.character,
          mv: feel.avatarMoving,
          w: s.armed ? s.weapon : undefined, // unarmed broadcasts no weapon
          hp: s.dead ? 0 : s.hp,
          ...(s.dead && s.knock ? { ko: s.knock } : {}),
        });
      } catch {
        /* no peers yet */
      }
    }, 90);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      clearInterval(net);
      unsubscribeLesson();
    };
  }, [camera]);

  useFrame((_, dt) => {
    const state = useStore.getState();
    const d = Math.min(dt, 0.05);

    // movement (frozen while playing Pong or waiting to respawn)
    if (state.locked && state.mode === "walk" && !state.dead) {
      const k = keys.current;
      const fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
      const strafe = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
      const sprinting = (k.ShiftLeft || k.ShiftRight) && fwd > 0;
      const weaponMult = state.armed ? weaponById(state.weapon).speedMult : 1;
      const groundMax = (sprinting ? SPRINT : SPEED) * weaponMult;
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
      feel.avatarMoving = moving;
      feel.avatarSpeed = hSpeed;


      // idle nag
      if (now - lastMove.current > 20000) {
        say("idle");
        lastMove.current = now;
      }
    } else if (state.dead) {
      // dead men don't slide: park the body until we respawn
      vel.current.set(0, 0, 0);
      vy.current = 0;
      feel.avatarMoving = false;
      feel.avatarSpeed = 0;
      if (deadSince.current === 0) {
        deadSince.current = performance.now();
        const look = new THREE.Vector3();
        camera.getWorldDirection(look);
        deadYaw.current = Math.atan2(look.x, look.z);
        thudded.current = false;
        const k = state.knock;
        knock.current = k
          ? { dx: k[0], dz: k[1], force: k[2], seed: k[3] }
          : fallbackKnock(deadYaw.current);
      }
      if (!thudded.current && performance.now() - deadSince.current > FALL_MS) {
        thudded.current = true;
        sfxThud(); // the body settling
      }
      // ...and the camera drops to the floor with them
      smoothY.current += (DEAD_EYE - smoothY.current) * Math.min(1, d * 6);
      head.current.y = smoothY.current;
      roll.current += (DEAD_ROLL - roll.current) * Math.min(1, d * 5);
    }
    if (!state.dead) {
      deadSince.current = 0;
      if (roll.current !== 0) {
        roll.current *= 1 - Math.min(1, d * 8); // unroll on respawn
        if (Math.abs(roll.current) < 0.001) roll.current = 0;
      }
    }
    // the camera's roll is ours alone: assert it, never read it back
    camera.rotation.z = roll.current;

    if (!state.locked) feel.avatarMoving = false; // paused = standing, not moonwalking

    // respawn timer + kill-feed expiry
    combatTick();

    // camera placement: first person = at the head; third = boom behind, wall-clamped
    if (state.cinema) {
      if (avatar.current) {
        avatar.current.visible = true;
        avatar.current.position.set(head.current.x, head.current.y - EYE, head.current.z);
      }
      return; // the Cinematic component owns the camera
    }
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
      const pose = state.dead
        ? ragdollPose(
            performance.now() - deadSince.current,
            knock.current,
            deadYaw.current,
          )
        : null;
      avatar.current.visible = third && state.locked && !pose?.gone;
      if (avatar.current.visible) {
        const fwdDir = new THREE.Vector3();
        camera.getWorldDirection(fwdDir);
        if (pose) {
          // the camera is on the floor, so place the body on the floor too
          avatar.current.position.set(
            head.current.x + pose.dx,
            pose.y,
            head.current.z + pose.dz,
          );
          avatar.current.rotation.y = deadYaw.current + pose.spin;
          if (avatarFlop.current) {
            avatarFlop.current.rotation.x = pose.pitch;
            avatarFlop.current.rotation.z = pose.roll;
          }
        } else {
          avatar.current.position.set(
            head.current.x,
            head.current.y - EYE,
            head.current.z,
          );
          avatar.current.rotation.y = Math.atan2(fwdDir.x, fwdDir.z);
          if (avatarFlop.current) avatarFlop.current.rotation.set(0, 0, 0);
        }
      }
    }

    // FOV: speed widen + shot kick, one smooth lerp
    feel.fovKick = Math.max(0, feel.fovKick - d * 14);
    const speedFov = Math.min(10, Math.max(0, (vel.current.length() - SPEED) * 1.6));
    const targetExtra = speedFov + feel.fovKick + feel.fovZoom;
    fovExtra.current += (targetExtra - fovExtra.current) * Math.min(1, d * 9);
    const cam = camera as THREE.PerspectiveCamera;
    const wantFov = BASE_FOV + fovExtra.current;
    if (Math.abs(cam.fov - wantFov) > 0.01) {
      cam.fov = wantFov;
      cam.updateProjectionMatrix();
    }

    // walk-in portals (museum <-> arena), with a cooldown so arrival
    // next to the return gate can't ping-pong you
    if (state.locked && performance.now() - portalCd.current > 1500) {
      for (const p of PORTALS) {
        const dx = head.current.x - p.x;
        const dz = head.current.z - p.z;
        if (dx * dx + dz * dz < p.r * p.r) {
          portalCd.current = performance.now();
          session.teleport(p.tx, p.tz);
          break;
        }
      }
    }

    // room tracking
    const room = roomAt(head.current.x, head.current.z);
    if (state.locked && state.started && room !== "dm" &&
        performance.now() - lastMapUpdate.current > 100) {
      lastMapUpdate.current = performance.now();
      state.set({ playerPosition: [head.current.x, head.current.z] });
    }
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
      narrateRoom(room);
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
        ref={(c) => {
          session.lock = () => c?.lock();
        }}
        onLock={() => {
          useStore.getState().set({ locked: true, started: true });
          startAmbient();
          say("evolution-intro");
        }}
        onUnlock={() =>
          useStore.getState().set({ locked: false, mode: "walk", prompt: null })
        }
      />
      <Cinematic head={head} />
      {/* third-person avatar: you are Sparky */}
      <group ref={avatar} visible={false}>
        <group ref={avatarFlop} position={[0, HIP_PIVOT, 0]}>
          <group position={[0, -HIP_PIVOT, 0]}>
            <Suspense fallback={null}>
              <SparkyAvatar />
            </Suspense>
          </group>
        </group>
      </group>
    </>
  );
}
