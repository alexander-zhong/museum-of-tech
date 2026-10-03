import { WALLS, WALL_HEIGHT } from "./layout";

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -12]}>
        <planeGeometry args={[26.6, 28.6]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.9} />
      </mesh>
      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT, -12]}>
        <planeGeometry args={[26.6, 28.6]} />
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
    </group>
  );
}
