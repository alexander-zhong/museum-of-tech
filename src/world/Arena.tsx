import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ARENA, ARENA_WALLS, ARENA_COVER, WALL_HEIGHT } from "./layout";

const CX = (ARENA.minX + ARENA.maxX) / 2;
const CZ = (ARENA.minZ + ARENA.maxZ) / 2;

// Glowing walk-in teleporter ring.
export function PortalGate({
  pos,
  rotY = 0,
  color = "#fc7900",
}: {
  pos: [number, number, number];
  rotY?: number;
  color?: string;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const disc = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.8;
    if (disc.current) {
      const m = disc.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.35 + Math.sin(state.clock.elapsedTime * 3) * 0.12;
    }
  });
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh ref={ring} position={[0, 1.4, 0]} raycast={() => null}>
        <torusGeometry args={[1.1, 0.06, 10, 40]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={disc} position={[0, 1.4, 0]} raycast={() => null}>
        <circleGeometry args={[1.02, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* floor pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} raycast={() => null}>
        <ringGeometry args={[0.7, 1.1, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

export function Arena() {
  return (
    <group>
      {/* floor + no ceiling: the arena floats in the void */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CX, 0, CZ]}>
        <planeGeometry args={[40.6, 40.6]} />
        <meshStandardMaterial color="#141017" roughness={0.8} metalness={0.2} />
      </mesh>
      {/* perimeter walls with neon top trim */}
      {ARENA_WALLS.map((w, i) => (
        <group key={i}>
          <mesh position={[w.x, WALL_HEIGHT / 2, w.z]}>
            <boxGeometry args={[w.w, WALL_HEIGHT, w.d]} />
            <meshStandardMaterial color="#1d1420" roughness={0.8} />
          </mesh>
          <mesh position={[w.x, WALL_HEIGHT - 0.06, w.z]} raycast={() => null}>
            <boxGeometry args={[Math.max(w.w, 0.1), 0.08, Math.max(w.d, 0.1)]} />
            <meshBasicMaterial color="#fc2d5e" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* cover blocks with glowing edges */}
      {ARENA_COVER.map((c, i) => (
        <group key={`c-${i}`}>
          <mesh position={[c.x, c.h / 2, c.z]}>
            <boxGeometry args={[c.w, c.h, c.d]} />
            <meshStandardMaterial color="#231a28" roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[c.x, c.h + 0.02, c.z]} raycast={() => null}>
            <boxGeometry args={[c.w + 0.04, 0.05, c.d + 0.04]} />
            <meshBasicMaterial color="#fc7900" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* lighting: two hot corners + cold center (lights are the perf budget) */}
      <pointLight position={[74, 3.4, -14]} color="#fc2d5e" intensity={55} distance={30} decay={1.6} />
      <pointLight position={[106, 3.4, -46]} color="#0278ff" intensity={55} distance={30} decay={1.6} />
      <pointLight position={[CX, 5, CZ]} color="#fff0d0" intensity={60} distance={28} decay={1.7} />

      {/* arena -> museum portal (blue, by the north wall) */}
      <PortalGate pos={[90, 0, -11.5]} color="#0278ff" />
    </group>
  );
}
