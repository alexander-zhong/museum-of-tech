import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store";
import { say } from "../systems/narration";
import { registerInteract } from "../systems/interact";
import { sfxShoot, sfxHit, sfxDing } from "../systems/sfx";
import { addFovKick } from "../systems/feel";

const MAX_SPARKS = 90;
const MAX_HOLES = 24;

const TARGETS = 6;
const TARGET_X = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75];
const RESET_MS = 3500;

export function CsRange() {
  const { camera, scene } = useThree();
  const equipped = useRef(false);
  const gun = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Mesh>(null);
  const flashUntil = useRef(0);
  const recoil = useRef(0);
  const tableGun = useRef<THREE.Group>(null);

  const targets = useRef<(THREE.Group | null)[]>([]);
  const alive = useRef<boolean[]>(Array(TARGETS).fill(true));
  const runStart = useRef<number | null>(null);
  const clearedAt = useRef<number | null>(null);
  const best = useRef<number | null>(null);
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
    const down = alive.current.filter((a) => !a).length;
    ctx.fillStyle = "#101a21";
    ctx.fillRect(0, 0, 640, 160);
    ctx.strokeStyle = "#fc7900";
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 628, 148);
    ctx.font = "bold 44px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fc7900";
    if (!equipped.current) {
      ctx.fillText("GRAB THE REPLICA", 320, 70);
      ctx.font = "26px monospace";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText("ON THE BENCH BEHIND YOU", 320, 115);
    } else if (clearedAt.current !== null && runStart.current !== null) {
      const secs = ((clearedAt.current - runStart.current) / 1000).toFixed(2);
      ctx.fillText(`CLEAR  ${secs}s`, 320, 70);
      ctx.font = "26px monospace";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(
        best.current !== null ? `BEST ${(best.current / 1000).toFixed(2)}s` : "",
        320,
        115,
      );
    } else {
      ctx.fillText(`TARGETS ${down}/${TARGETS}`, 320, 70);
      ctx.font = "26px monospace";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(
        best.current !== null
          ? `BEST ${(best.current / 1000).toFixed(2)}s`
          : "TIMER STARTS ON FIRST SHOT",
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

  const resetRange = () => {
    alive.current = Array(TARGETS).fill(true);
    runStart.current = null;
    clearedAt.current = null;
    drawBoard();
  };

  useEffect(() => {
    drawBoard();
    const unregister = registerInteract("cs-gun", "E — grab the gun", () => {
      if (equipped.current) return;
      equipped.current = true;
      if (tableGun.current) tableGun.current.visible = false;
      say("cs-gun");
      drawBoard();
    });

    const onShoot = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const s = useStore.getState();
      if (!s.locked || s.mode !== "walk" || !equipped.current) return;
      if (clearedAt.current !== null) return; // between rounds
      sfxShoot();
      recoil.current = 1;
      addFovKick(1.4);
      flashUntil.current = performance.now() + 60;
      if (muzzleLight.current) muzzleLight.current.intensity = 30;
      if (runStart.current === null) runStart.current = performance.now();

      raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
      raycaster.current.far = 45;
      const hits = raycaster.current.intersectObjects(scene.children, true);
      const hit = hits[0];

      // tracer from the muzzle to the impact point (or far into the dark)
      const muzzle = new THREE.Vector3(0.26, -0.24, -0.85)
        .applyQuaternion(camera.quaternion)
        .add(camera.position);
      const end =
        hit?.point ??
        new THREE.Vector3(0, 0, -45).applyQuaternion(camera.quaternion).add(camera.position);
      const tp = tracer.geometry.attributes.position.array as Float32Array;
      tp[0] = muzzle.x; tp[1] = muzzle.y; tp[2] = muzzle.z;
      tp[3] = end.x; tp[4] = end.y; tp[5] = end.z;
      tracer.geometry.attributes.position.needsUpdate = true;
      tracer.visible = true;
      tracerUntil.current = performance.now() + 55;

      if (!hit) return;
      const normal = hit.face
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : new THREE.Vector3(0, 1, 0);

      // did we hit a target?
      let o: THREE.Object3D | null = hit.object;
      while (o && o.userData.targetIndex === undefined) o = o.parent;
      if (o) {
        const i = o.userData.targetIndex as number;
        if (alive.current[i]) {
          alive.current[i] = false;
          sfxHit();
          spawnSparks(hit.point, normal, 14);
          s.set({ hitAt: performance.now() });
          if (alive.current.every((a) => !a)) {
            clearedAt.current = performance.now();
            const time = clearedAt.current - (runStart.current ?? clearedAt.current);
            if (best.current === null || time < best.current) best.current = time;
            sfxDing();
            say("cs-clear");
            setTimeout(resetRange, RESET_MS);
          }
          drawBoard();
        }
      } else {
        // environment hit: bullet hole + a few sparks
        placeHole(hit.point, normal);
        spawnSparks(hit.point, normal, 5);
      }
    };
    window.addEventListener("mousedown", onShoot);
    return () => {
      unregister();
      window.removeEventListener("mousedown", onShoot);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, scene]);

  useFrame((state, dt) => {
    // viewmodel follows the camera
    if (gun.current) {
      gun.current.visible = equipped.current && useStore.getState().locked;
      if (gun.current.visible) {
        recoil.current = Math.max(0, recoil.current - dt * 8);
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
    // targets flip down when dead, pop back up on reset
    targets.current.forEach((g, i) => {
      if (!g) return;
      const want = alive.current[i] ? 0 : -Math.PI / 2;
      g.rotation.x += (want - g.rotation.x) * Math.min(1, dt * 10);
    });
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
        {/* pickup gun on the bench */}
        <group ref={tableGun} position={[0, 0.98, 0]} rotation={[0, 0.9, Math.PI / 2]} userData={{ interactId: "cs-gun" }}>
          <mesh>
            <boxGeometry args={[0.45, 0.09, 0.08]} />
            <meshStandardMaterial color="#3a3a42" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[-0.12, -0.09, 0]}>
            <boxGeometry args={[0.08, 0.14, 0.07]} />
            <meshStandardMaterial color="#2c2c33" roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* lane divider line on the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -30.5]}>
        <planeGeometry args={[9.6, 0.12]} />
        <meshBasicMaterial color="#fc7900" />
      </mesh>

      {/* targets along the back wall */}
      {TARGET_X.map((x, i) => (
        <group key={i} position={[x, 0, -37.4]}>
          {/* post */}
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[0.08, 1.2, 0.08]} />
            <meshStandardMaterial color="#3a3a42" />
          </mesh>
          {/* flipping head (pivot at top of post) */}
          <group
            position={[0, 1.2, 0]}
            ref={(g) => {
              targets.current[i] = g;
            }}
            userData={{ targetIndex: i }}
          >
            <mesh position={[0, 0.32, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.05, 20]} />
              <meshStandardMaterial
                color="#fc7900"
                emissive="#fc7900"
                emissiveIntensity={0.5}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 0.32, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.1, 0.16, 20]} />
              <meshBasicMaterial color="#101a21" side={THREE.DoubleSide} />
            </mesh>
          </group>
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
      <pointLight position={[0, 3.2, -31]} color="#ffd9a0" intensity={50} distance={13} decay={1.6} />
      <pointLight position={[0, 2.6, -36.5]} color="#fff0d0" intensity={40} distance={10} decay={1.6} />

      {/* ---- shooting FX ---- */}
      <primitive object={tracer} />
      <points geometry={sparkGeo} raycast={() => null}>
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

      {/* ---- gun viewmodel (follows camera) ---- */}
      <group ref={gun} visible={false}>
        <mesh raycast={() => null}>
          <boxGeometry args={[0.07, 0.09, 0.42]} />
          <meshStandardMaterial color="#3a3a42" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.09, 0.12]} rotation={[0.3, 0, 0]} raycast={() => null}>
          <boxGeometry args={[0.06, 0.14, 0.07]} />
          <meshStandardMaterial color="#2c2c33" roughness={0.5} />
        </mesh>
        <pointLight
          ref={muzzleLight}
          position={[0, 0.01, -0.3]}
          color="#ffcc55"
          intensity={0}
          distance={6}
          decay={1.8}
        />
        <mesh ref={flash} position={[0, 0.01, -0.26]} visible={false} raycast={() => null}>
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
