import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { WALLS, WALL_HEIGHT } from "./layout";
import { Decor } from "./Decor";

// Fake volumetric god-ray cone under each exhibit light.
function LightCone({ pos, color }: { pos: [number, number, number]; color: string }) {
  return (
    <mesh position={[pos[0], pos[1] / 2 + 0.2, pos[2]]} raycast={() => null}>
      <coneGeometry args={[1.9, pos[1] + 0.4, 24, 1, true]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.055}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// Entry-hall centerpiece: a slowly rotating hologram.
function Hologram() {
  const spin = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  useFrame((state, dt) => {
    if (spin.current) {
      spin.current.rotation.y += dt * 0.5;
      spin.current.position.y = 1.7 + Math.sin(state.clock.elapsedTime * 0.9) * 0.08;
    }
    if (ring.current) ring.current.rotation.z += dt * 0.25;
  });

  return (
    <group position={[0, 0, -1]}>
      {/* pedestal */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 0.7, 24]} />
        <meshStandardMaterial color="#1e2430" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.04, 24]} />
        <meshBasicMaterial color="#0278ff" />
      </mesh>
      {/* floating wireframe core */}
      <group ref={spin}>
        <mesh raycast={() => null}>
          <icosahedronGeometry args={[0.5, 1]} />
          <meshBasicMaterial color="#0278ff" wireframe transparent opacity={0.85} />
        </mesh>
        <mesh raycast={() => null}>
          <icosahedronGeometry args={[0.28, 0]} />
          <meshBasicMaterial color="#66b3ff" transparent opacity={0.5} />
        </mesh>
      </group>
      {/* orbit ring */}
      <mesh ref={ring} position={[0, 1.7, 0]} rotation={[1.2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[0.8, 0.012, 8, 48]} />
        <meshBasicMaterial color="#fc7900" transparent opacity={0.8} />
      </mesh>
      {/* beam */}
      <mesh position={[0, 1.3, 0]} raycast={() => null}>
        <coneGeometry args={[0.45, 1.2, 20, 1, true]} />
        <meshBasicMaterial
          color="#0278ff"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight position={[0, 1.8, 0]} color="#0278ff" intensity={10} distance={7} decay={1.8} />
    </group>
  );
}

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
      {/* floor: polished museum marble — reflections do the wow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -18]}>
        <planeGeometry args={[26.6, 40.6]} />
        <MeshReflectorMaterial
          color={FLOOR_COLOR}
          resolution={256}
          blur={[400, 120]}
          mixBlur={0.9}
          mixStrength={2.2}
          roughness={0.75}
          metalness={0.35}
          mirror={0.5}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
        />
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
      {/* god-ray cones over the four exhibits */}
      {EXHIBIT_LIGHTS.slice(0, 4).map((l, i) => (
        <LightCone key={`cone-${i}`} pos={l.pos} color={l.color} />
      ))}
      <Hologram />
      <Dust />
      <Decor />
    </group>
  );
}
