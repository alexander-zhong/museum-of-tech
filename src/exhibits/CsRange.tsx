import { Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { TargetOtter, CHARACTERS } from "../world/Mascots";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store";
import { say } from "../systems/narration";
import { registerInteract } from "../systems/interact";
import { sfxShoot, sfxHit, sfxDing } from "../systems/sfx";
import { addFovKick, feel } from "../systems/feel";
import { WEAPONS, weaponById } from "../systems/weapons";
import { sendShot } from "../systems/net";
import { damagePlayer } from "../systems/combat";

const FLASH_Z: Record<string, number> = {
  pistol: -0.2,
  smg: -0.26,
  rifle: -0.33, // the model's muzzle sits a little further out than the old box
  awp: -0.42,
};

// Converted from AssaultRifle_1.fbx (npx tsx scripts/fbx-to-glb.ts).
// The model is 310 units long, muzzle at +X, up at +Y, origin near the stock,
// so it gets a quarter turn to point down -Z, a scale into metres, and a
// shift that puts the barrel axis on the group origin where the flash is.
const RIFLE_SCALE = 0.002; // ~0.62 m long
const RIFLE_OFFSET: [number, number, number] = [0, -0.108, 0.273];

// The same rifle again, as the pickup lying on the shooting bench. In model
// space it spans X -19..292 (butt to muzzle) and Y -44..82 (magazine floor to
// sight), so at RIFLE_SCALE the length midpoint is 0.273 m along +X and the
// magazine sits 0.088 m below the origin. Up stays +Y, so it rests on its
// magazine the way a rifle does on a flat bench.
const RIFLE_MID = 0.273; // origin -> length midpoint
const RIFLE_DROP = 0.088; // origin -> magazine floor
const BENCH_TOP = 0.9; // bench box is 0.9 tall, centred at 0.45
const BENCH_YAW = 0.35; // laid along the bench, slightly askew
// Undo the midpoint offset through the yaw so the rifle centres on the bench.
const BENCH_RIFLE_OFFSET: [number, number, number] = [
  -RIFLE_MID * Math.cos(BENCH_YAW),
  BENCH_TOP + RIFLE_DROP,
  RIFLE_MID * Math.sin(BENCH_YAW),
];

// The pack paints 91% of this gun in three shades of grey a few percent
// apart, so it reads as one blob however it is lit. These pull the parts
// apart on BOTH axes that survive flat ambient light: brightness (near-black
// receiver against bright steel) and temperature (warm wood against cool
// metal). Delete this map for the asset's raw colours.
// DarkMetal is 59% of the surface, so it carries the body and sits mid-tone;
// Black (10%) is grip/detail dark, Metal (20%) the bright highlight at the
// muzzle, DarkWood (11%) the handguard.
const RIFLE_PALETTE: Record<string, string> = {
  Wood: "#b06e30",
  DarkWood: "#92521f",
  Metal: "#b9c0c7",
  DarkMetal: "#5c646d",
  Black: "#15171a",
};

// Clone + repaint, shared by the viewmodel and the bench pickup. `inert`
// strips raycasting for the viewmodel, which rides on the camera and must
// never catch our own bullets; the bench rifle keeps its raycast so shots
// spark off it, and so the crosshair can find its interactId.
function useRifleClone(inert: boolean) {
  const { scene } = useGLTF("/models/AssaultRifle_1.glb");
  return useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if (inert) o.raycast = () => {};
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // clone() shares materials with the cached glTF, so copy before tinting
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const tinted = mats.map((m) => {
        const std = (m as THREE.MeshStandardMaterial).clone();
        const hex = RIFLE_PALETTE[std.name];
        if (hex) std.color.set(hex);
        return std;
      });
      mesh.material = Array.isArray(mesh.material) ? tinted : tinted[0];
    });
    return clone;
  }, [scene, inert]);
}

function RifleModel() {
  const model = useRifleClone(true);
  return (
    <group
      position={RIFLE_OFFSET}
      rotation={[0, Math.PI / 2, 0]}
      scale={RIFLE_SCALE}
    >
      <primitive object={model} />
    </group>
  );
}

function BenchRifle() {
  const model = useRifleClone(false);
  return (
    <group
      position={BENCH_RIFLE_OFFSET}
      rotation={[0, BENCH_YAW, 0]}
      scale={RIFLE_SCALE}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/AssaultRifle_1.glb");

const RIFLE_PICKUP = "cs-rifle-pickup";

const MAX_SPARKS = 90;
const MAX_HOLES = 24;

const TARGETS = 6;
const TARGET_X = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75];
const TARGET_HUES = CHARACTERS.map((c) => c.hue);
const RESPAWN_MS = 1500;
const DRILL_MS = 30000;

export function CsRange() {
  const { camera, scene } = useThree();
  const weaponId = useStore((s) => s.weapon); // re-render viewmodel on switch
  const firing = useRef(false);
  const lastFire = useRef(0);
  const tryFireRef = useRef<() => void>(() => {});
  const gun = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Mesh>(null);
  const flashUntil = useRef(0);
  const recoil = useRef(0);

  const targets = useRef<(THREE.Group | null)[]>([]);
  const alive = useRef<boolean[]>(Array(TARGETS).fill(true));
  // per-bot strafe pattern + respawn clock
  const bots = useRef(
    TARGET_X.map((x) => ({
      baseX: x,
      phase: Math.random() * Math.PI * 2,
      speed: 0.7 + Math.random() * 0.9,
      amp: 0.35 + Math.random() * 0.25,
      deadAt: 0,
    })),
  );
  // 30-second kill drill
  const kills = useRef(0);
  const drillEnd = useRef<number | null>(null);
  const drillOverAt = useRef(0);
  const best = useRef(0);
  const boardTimer = useRef(0);
  const raycaster = useRef(new THREE.Raycaster());
  const muzzleLight = useRef<THREE.PointLight>(null);

  // --- tracer line ---
  const tracer = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xffcc66,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    line.frustumCulled = false;
    line.raycast = () => undefined;
    return line;
  }, []);
  const tracerUntil = useRef(0);

  // --- spark particles (single pooled Points) ---
  const sparkGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(MAX_SPARKS * 3);
    arr.fill(-100); // park dead particles far below the floor
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  const sparks = useRef({
    vel: new Float32Array(MAX_SPARKS * 3),
    life: new Float32Array(MAX_SPARKS),
    next: 0,
  });
  const spawnSparks = (point: THREE.Vector3, normal: THREE.Vector3, count: number) => {
    const pos = sparkGeo.attributes.position.array as Float32Array;
    const s = sparks.current;
    for (let n = 0; n < count; n++) {
      const i = s.next;
      s.next = (s.next + 1) % MAX_SPARKS;
      pos[i * 3] = point.x;
      pos[i * 3 + 1] = point.y;
      pos[i * 3 + 2] = point.z;
      s.vel[i * 3] = normal.x * 2 + (Math.random() - 0.5) * 3;
      s.vel[i * 3 + 1] = normal.y * 2 + Math.random() * 2.5;
      s.vel[i * 3 + 2] = normal.z * 2 + (Math.random() - 0.5) * 3;
      s.life[i] = 0.4 + Math.random() * 0.25;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  };

  // --- bullet-hole decal pool ---
  const holes = useRef<(THREE.Mesh | null)[]>([]);
  const nextHole = useRef(0);
  const placeHole = (point: THREE.Vector3, normal: THREE.Vector3) => {
    const m = holes.current[nextHole.current];
    nextHole.current = (nextHole.current + 1) % MAX_HOLES;
    if (!m) return;
    m.visible = true;
    m.position.copy(point).addScaledVector(normal, 0.012);
    m.lookAt(point.clone().add(normal));
  };

  // scoreboard
  const boardCanvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 160;
    return c;
  }, []);
  const boardTex = useMemo(() => {
    const t = new THREE.CanvasTexture(boardCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [boardCanvas]);

  const drawBoard = () => {
    const ctx = boardCanvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#101a21";
    ctx.fillRect(0, 0, 640, 160);
    ctx.strokeStyle = "#fc7900";
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 628, 148);
    ctx.font = "bold 44px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fc7900";
    const now = performance.now();
    if (drillEnd.current !== null) {
      const left = Math.max(0, Math.ceil((drillEnd.current - now) / 1000));
      ctx.fillText(`KILLS ${kills.current}`, 320, 70);
      ctx.font = "26px monospace";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(`${left}s LEFT`, 320, 115);
    } else if (now - drillOverAt.current < 5000) {
      ctx.fillText(`SCORE ${kills.current}`, 320, 70);
      ctx.font = "26px monospace";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(`BEST ${best.current}`, 320, 115);
    } else {
      ctx.fillText("30-SECOND DRILL", 320, 70);
      ctx.font = "26px monospace";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(
        best.current > 0 ? `BEST ${best.current} · SHOOT TO START` : "SHOOT A BOT TO START",
        320,
        115,
      );
    }
    boardTex.needsUpdate = true;
  };

  // Minh Le story placard
  const placardTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#101a21";
      ctx.fillRect(0, 0, 1024, 512);
      ctx.strokeStyle = "#0278ff";
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, 1004, 492);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fc7900";
      ctx.font = "bold 56px monospace";
      ctx.fillText("COUNTER-STRIKE", 512, 90);
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "34px monospace";
      const lines = [
        "1999. SFU student Minh Le",
        "builds a mod between assignments.",
        "",
        "It becomes the biggest",
        "shooter on Earth.",
        "",
        "THE GOAT WALKED THESE HALLS.",
      ];
      ctx.font = "40px monospace";
      lines.forEach((l, i) => {
        ctx.fillStyle = i === 6 ? "#fc7900" : "#e5e7eb";
        ctx.fillText(l, 512, 180 + i * 46);
      });
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);


  useEffect(() => {
    drawBoard();

    const tryFire = () => {
      const s = useStore.getState();
      if (!s.locked || s.mode !== "walk" || !s.armed || s.buyMenu || s.econMenu) return;
      if (s.dead) return; // no shooting from the respawn queue
      const def = weaponById(s.weapon);
      const now = performance.now();
      if (now - lastFire.current < def.fireMs) return;
      lastFire.current = now;

      if (typeof import.meta.env !== "undefined" && import.meta.env.DEV) {
        const w = window as unknown as Record<string, unknown>;
        w.__lastShot = { t: Date.now(), weapon: def.id };
      }
      sfxShoot(def.id);
      recoil.current = def.recoil;
      addFovKick(def.kick);
      if (!def.knife) {
        flashUntil.current = now + 60;
        if (muzzleLight.current) {
          muzzleLight.current.intensity = def.sniper ? 60 : 30;
        }
      }
      raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
      raycaster.current.far = def.range;
      const hits = raycaster.current.intersectObjects(scene.children, true);
      const hit = hits[0];

      if (!def.knife) {
        // tracer from the muzzle to the impact point (or far into the dark)
        const muzzle = new THREE.Vector3(0.26, -0.24, -0.85)
          .applyQuaternion(camera.quaternion)
          .add(camera.position);
        const end =
          hit?.point ??
          new THREE.Vector3(0, 0, -45)
            .applyQuaternion(camera.quaternion)
            .add(camera.position);
        const tp = tracer.geometry.attributes.position.array as Float32Array;
        tp[0] = muzzle.x; tp[1] = muzzle.y; tp[2] = muzzle.z;
        tp[3] = end.x; tp[4] = end.y; tp[5] = end.z;
        tracer.geometry.attributes.position.needsUpdate = true;
        tracer.visible = true;
        tracerUntil.current = now + 55;
        try {
          sendShot({
            a: [muzzle.x, muzzle.y, muzzle.z],
            b: [end.x, end.y, end.z],
          });
        } catch {
          /* no peers yet */
        }
      }

      if (!hit) return;
      const normal = hit.face
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : new THREE.Vector3(0, 1, 0);

      // did we hit another player? their hitboxes carry the peer id
      const victim = hit.object.userData.peerId as string | undefined;
      if (victim) {
        const ray = raycaster.current.ray.direction;
        const flat = Math.hypot(ray.x, ray.z) || 1;
        damagePlayer(
          victim,
          def.id,
          hit.object.userData.zone === "head",
          hit.distance,
          ray.x / flat,
          ray.z / flat,
        );
        spawnSparks(hit.point, normal, def.sparks);
        return;
      }

      // did we hit a target?
      let o: THREE.Object3D | null = hit.object;
      while (o && o.userData.targetIndex === undefined) o = o.parent;
      if (o) {
        const i = o.userData.targetIndex as number;
        if (alive.current[i]) {
          alive.current[i] = false;
          bots.current[i].deadAt = now;
          sfxHit();
          spawnSparks(hit.point, normal, def.sparks + 4);
          s.set({ hitAt: now, botKillAt: now });
          // drill: first kill starts the 30s clock
          if (drillEnd.current === null && now - drillOverAt.current > 5000) {
            drillEnd.current = now + DRILL_MS;
            kills.current = 1;
          } else if (drillEnd.current !== null) {
            kills.current++;
          }
          drawBoard();
        }
      } else {
        // environment hit: bullet hole + a few sparks (knife just scratches)
        if (!def.knife) placeHole(hit.point, normal);
        spawnSparks(hit.point, normal, def.knife ? 2 : 5);
      }
    };
    tryFireRef.current = tryFire;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        firing.current = true;
        tryFire();
      } else if (e.button === 2) {
        const s = useStore.getState();
        if (s.locked && s.armed && weaponById(s.weapon).sniper) {
          feel.fovZoom = -34; // scoped
        }
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) firing.current = false;
      if (e.button === 2) feel.fovZoom = 0;
    };
    const onContext = (e: Event) => {
      if (useStore.getState().locked) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (!s.locked || !s.armed) return;
      if (e.code === "KeyB") {
        s.set({ buyMenu: !s.buyMenu });
      } else if (/^Digit[1-5]$/.test(e.code)) {
        // CS-style direct weapon hotkeys: 1 rifle, 2 pistol, 3 knife, 4 smg, 5 awp
        const idx = Number(e.code.slice(5)) - 1;
        if (WEAPONS[idx] && WEAPONS[idx].id !== s.weapon) {
          s.set({ weapon: WEAPONS[idx].id, buyMenu: false });
          feel.fovZoom = 0;
          sfxDing();
        } else if (s.buyMenu) {
          s.set({ buyMenu: false });
        }
      }
    };
    // Arming is private to this browser: `armed` is local store state and is
    // never broadcast, and the bench rifle is never consumed or hidden. So the
    // pickup stays available to every player independently — one visitor taking
    // a rifle cannot use it up for anyone else. Taking it twice is a no-op.
    const offPickup = registerInteract(
      RIFLE_PICKUP,
      () =>
        useStore.getState().armed
          ? "AK-1977 replica · already carrying"
          : "Pick up the AK-1977",
      () => {
        const s = useStore.getState();
        if (s.armed) return;
        s.set({ armed: true, weapon: "rifle" });
        sfxDing();
        say("cs-pickup");
      },
    );

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKey);
    return () => {
      offPickup();
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, scene]);

  useFrame((state, dt) => {
    // full-auto
    if (firing.current && weaponById(useStore.getState().weapon).auto) {
      tryFireRef.current();
    }
    // recoil decays regardless of which camera is active
    recoil.current = Math.max(0, recoil.current - dt * 8);
    feel.gunRecoil = recoil.current;
    // viewmodel follows the camera
    if (gun.current) {
      const st = useStore.getState();
      gun.current.visible =
        st.armed && st.locked && st.view === "first" && (!st.cinema || feel.cinemaPov);
      if (gun.current.visible) {

        const sway = Math.sin(state.clock.elapsedTime * 1.7) * 0.004;
        gun.current.position.copy(camera.position);
        gun.current.quaternion.copy(camera.quaternion);
        gun.current.translateX(0.26);
        gun.current.translateY(-0.24 + sway);
        gun.current.translateZ(-0.55 + recoil.current * 0.07);
        gun.current.rotateX(recoil.current * 0.12);
      }
    }
    if (flash.current) {
      flash.current.visible = performance.now() < flashUntil.current;
    }
    if (muzzleLight.current && muzzleLight.current.intensity > 0) {
      muzzleLight.current.intensity = Math.max(0, muzzleLight.current.intensity - dt * 400);
    }
    if (tracer.visible && performance.now() > tracerUntil.current) {
      tracer.visible = false;
    }
    // spark physics
    {
      const pos = sparkGeo.attributes.position.array as Float32Array;
      const sp = sparks.current;
      let any = false;
      for (let i = 0; i < MAX_SPARKS; i++) {
        if (sp.life[i] <= 0) continue;
        sp.life[i] -= dt;
        if (sp.life[i] <= 0) {
          pos[i * 3 + 1] = -100;
        } else {
          sp.vel[i * 3 + 1] -= 9.8 * dt;
          pos[i * 3] += sp.vel[i * 3] * dt;
          pos[i * 3 + 1] += sp.vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += sp.vel[i * 3 + 2] * dt;
        }
        any = true;
      }
      if (any) sparkGeo.attributes.position.needsUpdate = true;
    }
    // bots: strafe while alive, faceplant when hit, respawn solo (Valorant-style)
    {
      const now = performance.now();
      const t = state.clock.elapsedTime;
      targets.current.forEach((g, i) => {
        if (!g) return;
        const bot = bots.current[i];
        if (!alive.current[i] && now - bot.deadAt > RESPAWN_MS) {
          alive.current[i] = true; // back up, no grudges
        }
        if (alive.current[i]) {
          g.position.x = bot.baseX + Math.sin(t * bot.speed + bot.phase) * bot.amp;
          g.position.z = -37.3 + Math.sin(t * bot.speed * 0.63 + bot.phase * 2) * 0.22;
        }
        const want = alive.current[i] ? 0 : Math.PI / 2;
        g.rotation.x += (want - g.rotation.x) * Math.min(1, dt * 9);
      });

      // drill clock
      if (drillEnd.current !== null && now >= drillEnd.current) {
        drillEnd.current = null;
        drillOverAt.current = now;
        if (kills.current > best.current) best.current = kills.current;
        sfxDing();
        say("cs-clear");
        drawBoard();
      }
      boardTimer.current += dt;
      if (boardTimer.current > 0.5) {
        boardTimer.current = 0;
        if (drillEnd.current !== null || now - drillOverAt.current < 6000) {
          drawBoard();
        }
      }
    }
  });

  return (
    <group>
      {/* ---- the range room ---- */}
      {/* shooting bench near the entrance */}
      <group position={[1.8, 0, -28.2]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[1.6, 0.9, 0.6]} />
          <meshStandardMaterial color="#26262e" roughness={0.7} />
        </mesh>
        {/* The AK on the bench: the rifle you pick up to arm yourself. It is a
            permanent fixture, not a one-off spawn — it never leaves the bench,
            so every visitor (and you again after a respawn) can take one. */}
        <group userData={{ interactId: RIFLE_PICKUP }}>
          <Suspense fallback={null}>
            <BenchRifle />
          </Suspense>
        </group>
      </group>

      {/* lane divider line on the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -30.5]}>
        <planeGeometry args={[9.6, 0.12]} />
        <meshBasicMaterial color="#fc7900" />
      </mesh>

      {/* targets: otter range bots along the back wall, Valorant style */}
      {TARGET_X.map((x, i) => (
        <group
          key={i}
          position={[x, 0, -37.3]}
          ref={(g) => {
            targets.current[i] = g;
          }}
          userData={{ targetIndex: i }}
        >
          {/* pad they stand on */}
          <mesh position={[0, 0.02, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.45, 0.5, 0.05, 16]} />
            <meshStandardMaterial
              color="#1a222c"
              emissive="#fc7900"
              emissiveIntensity={0.25}
            />
          </mesh>
          <Suspense fallback={null}>
            <group scale={0.62}>
              <TargetOtter hue={TARGET_HUES[i % TARGET_HUES.length]} />
            </group>
          </Suspense>
        </group>
      ))}

      {/* scoreboard above the targets */}
      <mesh position={[0, 3.0, -37.8]}>
        <planeGeometry args={[3.2, 0.8]} />
        <meshBasicMaterial map={boardTex} toneMapped={false} />
      </mesh>

      {/* Minh Le story placard on the west wall */}
      <mesh position={[-4.8, 1.9, -32]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[3.0, 1.5]} />
        <meshBasicMaterial map={placardTex} toneMapped={false} />
      </mesh>

      {/* range lighting */}
      <pointLight position={[0, 3.0, -33]} color="#ffe2b8" intensity={70} distance={16} decay={1.6} />

      {/* ---- shooting FX ---- */}
      <primitive object={tracer} />
      <points geometry={sparkGeo} raycast={() => null} frustumCulled={false}>
        <pointsMaterial
          size={0.035}
          color="#ffb347"
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      {Array.from({ length: MAX_HOLES }, (_, i) => (
        <mesh
          key={`hole-${i}`}
          visible={false}
          raycast={() => null}
          ref={(m) => {
            holes.current[i] = m;
          }}
        >
          <circleGeometry args={[0.035, 10]} />
          <meshBasicMaterial color="#0a0a0d" transparent opacity={0.9} />
        </mesh>
      ))}

      {/* ---- gun viewmodel (follows camera, shape per weapon) ---- */}
      <group ref={gun} visible={false}>
        {/* Travels with the gun, because the museum is dim and the viewmodel
            would otherwise be a silhouette in half the building. Kept weak on
            purpose: it sits ~0.3 m from the surface and falls off with the
            square of that, so it is far closer than any room light. At 1.6 it
            blew the lit faces to white and flattened the whole gun. */}
        <pointLight
          position={[0.14, 0.26, 0.1]}
          color="#ffe6c4"
          intensity={0.22}
          distance={1.1}
          decay={2}
        />
        {weaponId === "knife" && (
          <>
            <mesh position={[0, 0, -0.08]} rotation={[0.15, 0, 0]} raycast={() => null}>
              <boxGeometry args={[0.012, 0.07, 0.3]} />
              <meshStandardMaterial color="#c8ccd4" metalness={0.9} roughness={0.15} />
            </mesh>
            <mesh position={[0, -0.03, 0.14]} rotation={[0.3, 0, 0]} raycast={() => null}>
              <boxGeometry args={[0.035, 0.05, 0.14]} />
              <meshStandardMaterial color="#2c2c33" roughness={0.6} />
            </mesh>
          </>
        )}
        {weaponId === "pistol" && (
          <>
            <mesh position={[0, 0, 0.05]} raycast={() => null}>
              <boxGeometry args={[0.06, 0.08, 0.26]} />
              <meshStandardMaterial color="#3a3a42" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.09, 0.14]} rotation={[0.25, 0, 0]} raycast={() => null}>
              <boxGeometry args={[0.055, 0.13, 0.06]} />
              <meshStandardMaterial color="#2c2c33" roughness={0.5} />
            </mesh>
          </>
        )}
        {weaponId === "smg" && (
          <>
            <mesh raycast={() => null}>
              <boxGeometry args={[0.065, 0.09, 0.34]} />
              <meshStandardMaterial color="#34343c" metalness={0.6} roughness={0.35} />
            </mesh>
            <mesh position={[0, -0.13, 0.02]} raycast={() => null}>
              <boxGeometry args={[0.05, 0.18, 0.06]} />
              <meshStandardMaterial color="#26262c" roughness={0.5} />
            </mesh>
            <mesh position={[0, -0.07, 0.17]} rotation={[0.3, 0, 0]} raycast={() => null}>
              <boxGeometry args={[0.05, 0.11, 0.06]} />
              <meshStandardMaterial color="#2c2c33" roughness={0.5} />
            </mesh>
          </>
        )}
        {weaponId === "rifle" && (
          <Suspense fallback={null}>
            <RifleModel />
          </Suspense>
        )}
        {weaponId === "awp" && (
          <>
            <mesh position={[0, 0, -0.06]} raycast={() => null}>
              <boxGeometry args={[0.065, 0.09, 0.62]} />
              <meshStandardMaterial color="#3c4a38" metalness={0.4} roughness={0.45} />
            </mesh>
            <mesh position={[0, 0.08, 0.02]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
              <cylinderGeometry args={[0.035, 0.035, 0.22, 10]} />
              <meshStandardMaterial color="#1e2024" metalness={0.7} roughness={0.25} />
            </mesh>
            <mesh position={[0, -0.1, 0.2]} rotation={[0.3, 0, 0]} raycast={() => null}>
              <boxGeometry args={[0.05, 0.14, 0.09]} />
              <meshStandardMaterial color="#2f3a2c" roughness={0.5} />
            </mesh>
          </>
        )}
        <pointLight
          ref={muzzleLight}
          position={[0, 0.01, FLASH_Z[weaponId] ?? -0.3]}
          color="#ffcc55"
          intensity={0}
          distance={6}
          decay={1.8}
        />
        <mesh
          ref={flash}
          position={[0, 0.01, (FLASH_Z[weaponId] ?? -0.3) + 0.04]}
          visible={false}
          raycast={() => null}
        >
          <planeGeometry args={[0.16, 0.16]} />
          <meshBasicMaterial
            color="#ffcc55"
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
