import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store";
import { say } from "../systems/narration";
import { registerInteract } from "../systems/interact";
import { sfxShoot, sfxHit, sfxDing } from "../systems/sfx";

const TARGETS = 6;
const TARGET_X = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75];
const RESET_MS = 3500;

export function CsRange() {
  const { camera } = useThree();
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
        "1999. Minh “Gooseman” Le, a computing",
        "science student at SFU, builds a",
        "Half-Life mod between assignments.",
        "",
        "It becomes the most played FPS",
        "on Earth and defines esports.",
        "",
        "The other exhibits made computers.",
        "A student here made them fun.",
      ];
      lines.forEach((l, i) => ctx.fillText(l, 512, 160 + i * 40));
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
    const unregister = registerInteract("cs-gun", "E — pick up the replica", () => {
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
      flashUntil.current = performance.now() + 60;
      if (runStart.current === null) runStart.current = performance.now();

      raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
      raycaster.current.far = 40;
      const meshes = targets.current.filter(Boolean) as THREE.Object3D[];
      const hits = raycaster.current.intersectObjects(meshes, true);
      if (hits.length > 0) {
        let o: THREE.Object3D | null = hits[0].object;
        while (o && o.userData.targetIndex === undefined) o = o.parent;
        if (o) {
          const i = o.userData.targetIndex as number;
          if (alive.current[i]) {
            alive.current[i] = false;
            sfxHit();
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
        }
      }
    };
    window.addEventListener("mousedown", onShoot);
    return () => {
      unregister();
      window.removeEventListener("mousedown", onShoot);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

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
