import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WALLS, WALL_HEIGHT } from "./layout";

// Dust motes drifting in the spotlight beams — classic museum shot.
function Dust() {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const n = 400;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 26;
      arr[i * 3 + 1] = Math.random() * WALL_HEIGHT;
      arr[i * 3 + 2] = 2 - Math.random() * 40;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (points.current) {
      points.current.position.y =
        Math.sin(state.clock.elapsedTime * 0.08) * 0.3;
      points.current.rotation.y = state.clock.elapsedTime * 0.004;
    }
  });

  return (
    <points ref={points} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="#ffe2b0"
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

const WALL_COLOR = "#1b1b26";
const FLOOR_COLOR = "#141419";
const CEIL_COLOR = "#0d0d13";

// Exhibit spotlight positions: one warm light per room centerpiece.
const EXHIBIT_LIGHTS: { pos: [number, number, number]; color: string }[] = [
  { pos: [-10.5, 3.2, -9.5], color: "#ffd9a0" }, // ENIAC
  { pos: [10.5, 3.2, -9.5], color: "#ffd9a0" }, // Bombe
  { pos: [-10.5, 3.2, -20.5], color: "#a0e8ff" }, // Pong (CRT blue)
  { pos: [10.5, 3.2, -20.5], color: "#ffd9a0" }, // AGC
  { pos: [0, 3.4, -1], color: "#fff0d0" }, // entry hall
  { pos: [0, 3.2, -15], color: "#8888aa" }, // corridor
];

export function Museum() {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -18]}>
        <planeGeometry args={[26.6, 40.6]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.9} />
      </mesh>
      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT, -18]}>
        <planeGeometry args={[26.6, 40.6]} />
        <meshStandardMaterial color={CEIL_COLOR} roughness={1} />
      </mesh>
      {/* walls */}
      {WALLS.map((w, i) => (
        <mesh key={i} position={[w.x, WALL_HEIGHT / 2, w.z]}>
          <boxGeometry args={[w.w, WALL_HEIGHT, w.d]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.85} />
        </mesh>
      ))}
      {/* lighting */}
      <ambientLight intensity={0.7} color="#9098b8" />
      <hemisphereLight intensity={0.5} color="#b0b8d8" groundColor="#3a3228" />
      {EXHIBIT_LIGHTS.map((l, i) => (
        <pointLight
          key={i}
          position={l.pos}
          color={l.color}
          intensity={60}
          distance={14}
          decay={1.6}
        />
      ))}
      <Dust />
    </group>
  );
}
