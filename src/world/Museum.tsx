import { MeshReflectorMaterial } from "@react-three/drei";
import { WALLS, WALL_HEIGHT } from "./layout";
import { Decor } from "./Decor";
import { ThemeDecor } from "./ThemeDecor";

const WALL_COLOR = "#1b1b26";
const FLOOR_COLOR = "#141419";
const CEIL_COLOR = "#0d0d13";

// Soft exhibit lighting; the light sources have no visible cone meshes.
const EXHIBIT_LIGHTS: { pos: [number, number, number]; color: string }[] = [
  { pos: [-10.5, 3.2, -9.5], color: "#ffcb92" }, // transistor
  { pos: [10.5, 3.2, -9.5], color: "#b8f5da" }, // integrated circuit
  { pos: [-10.5, 3.2, -20.5], color: "#a0d0ff" }, // compiler
  { pos: [10.5, 3.2, -20.5], color: "#cfb7ff" }, // network
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
      <Decor />
      <ThemeDecor />
    </group>
  );
}
