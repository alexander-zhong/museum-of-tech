import { useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";

// Set dressing stays out of the interaction raycast; the lesson screens remain usable.
function Box({ at, size, color, emissive }: { at: [number, number, number]; size: [number, number, number]; color: string; emissive?: string }) {
  return <mesh position={at} raycast={() => null}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} metalness={0.45} roughness={0.45} emissive={emissive || "#000000"} emissiveIntensity={emissive ? 0.5 : 0} />
  </mesh>;
}
function Cylinder({ at, radii, color, rotation }: { at: [number, number, number]; radii: [number, number, number]; color: string; rotation?: [number, number, number] }) {
  return <mesh position={at} rotation={rotation} raycast={() => null}>
    <cylinderGeometry args={[radii[0], radii[1], radii[2], 24]} />
    <meshStandardMaterial color={color} metalness={0.65} roughness={0.35} />
  </mesh>;
}
function Sphere({ at, radius, color }: { at: [number, number, number]; radius: number; color: string }) {
  return <mesh position={at} raycast={() => null}>
    <sphereGeometry args={[radius, 12, 8]} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
  </mesh>;
}
function Wire({ from, to, color, thickness = 0.025 }: { from: [number, number, number]; to: [number, number, number]; color: string; thickness?: number }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const direction = b.clone().sub(a);
  return <mesh position={mid} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())} raycast={() => null}>
    <cylinderGeometry args={[thickness, thickness, direction.length(), 6]} />
    <meshBasicMaterial color={color} />
  </mesh>;
}
function Label({ at, title, caption, color, width = 2.7 }: { at: [number, number, number]; title: string; caption: string; color: string; width?: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 192;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#091821";
    ctx.fillRect(0, 0, 768, 192);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 768, 10);
    ctx.font = "bold 48px monospace";
    ctx.fillText(title, 26, 84);
    ctx.fillStyle = "#dce6ee";
    ctx.font = "27px monospace";
    ctx.fillText(caption, 26, 145);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [title, caption, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  // Canvas text is readable from the entrance-facing side of the display.
  return <mesh position={at} rotation={[0, Math.PI, 0]} raycast={() => null}>
    <planeGeometry args={[width, width / 4]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}
function AgainstLeftWall({ x, z, west, children }: { x: number; z: number; west: boolean; children: ReactNode }) {
  // Looking in from the corridor, west rooms have the south wall on the left;
  // east rooms have the north wall on the left. Face each display into its room.
  return <group position={[x, 0, z]} rotation={[0, west ? Math.PI : 0, 0]}>
    <group position={[-x, 0, -z]}>{children}</group>
  </group>;
}
function Plinth({ x, z, color }: { x: number; z: number; color: string }) {
  return <group>
    <Box at={[x, 0.42, z]} size={[2.1, 0.84, 1.7]} color="#202b35" />
    <Box at={[x, 0.86, z]} size={[2.18, 0.08, 1.78]} color={color} />
  </group>;
}

function TransistorRoom() {
  const x = -8.5, z = -14.05;
  return <AgainstLeftWall x={x} z={z} west>
    <Plinth x={x} z={z} color="#a86d3b" />
    {/* A glowing glass vacuum tube beside the solid-state device. */}
    <Cylinder at={[x - 0.55, 1.43, z]} radii={[0.27, 0.3, 1.05]} color="#805844" />
    <mesh position={[x - 0.55, 1.43, z]} raycast={() => null}>
      <cylinderGeometry args={[0.34, 0.34, 1.16, 24]} />
      <meshStandardMaterial color="#d0e5ed" transparent opacity={0.25} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
    <Wire from={[x - 0.55, 1.05, z]} to={[x - 0.55, 1.87, z]} color="#ff7e35" thickness={0.04} />
    <Cylinder at={[x + 0.6, 1.55, z]} radii={[0.33, 0.42, 0.65]} color="#20252c" />
    {[z - 0.22, z, z + 0.22].map((pinZ) => <Cylinder key={pinZ} at={[x + 0.6, 1.04, pinZ]} radii={[0.035, 0.035, 0.48]} color="#dbbd75" />)}
    <Label at={[x, 2.4, z]} title="VACUUM TUBE  /  TRANSISTOR" caption="Large heated valve → small switch" color="#ffb45e" width={3.5} />
    <Label at={[x, 0.69, z - 0.9]} title="1947  ·  BELL LABS" caption="Bardeen · Brattain · Shockley" color="#ffb45e" width={2.7} />
  </AgainstLeftWall>;
}

function ChipRoom() {
  const x = 8.5, z = -4.95;
  return <AgainstLeftWall x={x} z={z} west={false}>
    <Plinth x={x} z={z} color="#4a9c7a" />
    <Box at={[x, 1.13, z]} size={[1.55, 0.22, 1.2]} color="#a99764" />
    <Box at={[x, 1.27, z]} size={[1.22, 0.12, 0.95]} color="#193b35" />
    {/* Enlarged integrated-circuit package, die, pins and etched traces. */}
    <Box at={[x, 1.36, z]} size={[0.82, 0.06, 0.57]} color="#132b25" />
    {Array.from({ length: 8 }, (_, i) => {
      const offset = -0.49 + i * 0.14;
      return <group key={i}>
        <Box at={[x - 0.91, 1.12, z + offset]} size={[0.28, 0.07, 0.055]} color="#d4b76b" />
        <Box at={[x + 0.91, 1.12, z + offset]} size={[0.28, 0.07, 0.055]} color="#d4b76b" />
      </group>;
    })}
    {Array.from({ length: 5 }, (_, i) => <Wire key={i} from={[x - 0.32, 1.4, z - 0.2 + i * 0.1]} to={[x + 0.32, 1.4, z - 0.2 + i * 0.1]} color="#8de0b6" thickness={0.008} />)}
    <mesh position={[x + 0.85, 1.7, z - 0.15]} rotation={[0, Math.PI / 5, Math.PI / 2]} raycast={() => null}>
      <cylinderGeometry args={[0.62, 0.62, 0.08, 32]} />
      <meshStandardMaterial color="#568f84" metalness={0.65} roughness={0.25} />
    </mesh>
    <Label at={[x, 2.4, z]} title="THE INTEGRATED CIRCUIT" caption="Thousands of switches, one chip" color="#82e0ba" width={3.4} />
    <Label at={[x, 0.69, z - 0.9]} title="1958–1971  ·  SILICON" caption="Kilby · Noyce · 4004 team" color="#82e0ba" width={2.7} />
  </AgainstLeftWall>;
}

function CompilerRoom() {
  const x = -8.5, z = -25.05;
  return <AgainstLeftWall x={x} z={z} west>
    <Plinth x={x} z={z} color="#497fae" />
    <Box at={[x, 1.35, z + 0.28]} size={[1.48, 0.95, 0.22]} color="#b5aa91" />
    <Box at={[x, 1.38, z + 0.15]} size={[1.26, 0.73, 0.04]} color="#10232e" emissive="#145676" />
    <Label at={[x, 1.5, z + 0.12]} title="ADD 2 3" caption="→  00000001 00000010 00000011" color="#87bcff" width={1.05} />
    <Box at={[x, 0.99, z - 0.41]} size={[1.55, 0.1, 0.42]} color="#a7a193" />
    {Array.from({ length: 18 }, (_, i) => <Box key={i} at={[x - 0.65 + (i % 9) * 0.16, 1.05, z - 0.29 - Math.floor(i / 9) * 0.15]} size={[0.11, 0.025, 0.1]} color="#d9d2b8" />)}
    <Wire from={[x + 1.25, 0.95, z - 0.5]} to={[x + 1.25, 1.95, z - 0.5]} color="#f0bd73" thickness={0.04} />
    <Sphere at={[x + 1.25, 1.95, z - 0.5]} radius={0.07} color="#ffca7d" />
    <Label at={[x, 2.5, z]} title="SOURCE → MACHINE CODE" caption="A language the CPU can execute" color="#87bcff" width={3.4} />
    <Label at={[x, 0.69, z - 0.9]} title="GRACE HOPPER" caption="A-0 · FLOW-MATIC · nanosecond" color="#87bcff" width={2.7} />
  </AgainstLeftWall>;
}

function Computer({ x, z, color }: { x: number; z: number; color: string }) {
  return <group>
    <Box at={[x, 1.15, z]} size={[0.72, 0.6, 0.42]} color="#d2c7ae" />
    <Box at={[x, 1.2, z - 0.23]} size={[0.55, 0.36, 0.03]} color="#0d2930" emissive={color} />
    <Box at={[x, 0.89, z - 0.31]} size={[0.52, 0.06, 0.2]} color="#c4bba8" />
    <Sphere at={[x, 1.2, z - 0.27]} radius={0.055} color={color} />
  </group>;
}
function NetworkRoom() {
  const x = 8.5, z = -15.95;
  const nodes: [number, number, number][] = [[x - 0.62, 0.93, z - 0.48], [x + 0.62, 0.93, z - 0.48], [x - 0.62, 0.93, z + 0.48], [x + 0.62, 0.93, z + 0.48]];
  return <AgainstLeftWall x={x} z={z} west={false}>
    <Plinth x={x} z={z} color="#765ea0" />
    {[[-0.62, -0.48], [0.62, -0.48], [-0.62, 0.48], [0.62, 0.48]].map(([dx, dz], i) => <Computer key={i} x={x + dx} z={z + dz} color="#b692ff" />)}
    <Wire from={nodes[0]} to={nodes[1]} color="#b692ff" />
    <Wire from={nodes[0]} to={nodes[2]} color="#b692ff" />
    <Wire from={nodes[1]} to={nodes[3]} color="#b692ff" />
    <Wire from={nodes[2]} to={nodes[3]} color="#b692ff" />
    <Label at={[x, 2.5, z]} title="FOUR COMPUTERS" caption="A message becomes packets" color="#c4a1ff" width={3.4} />
    <Label at={[x, 0.69, z - 0.9]} title="ARPANET  ·  1969" caption="UCLA → SRI: L, O, then crash" color="#c4a1ff" width={2.7} />
  </AgainstLeftWall>;
}

export function ThemeDecor() {
  return <group>
    <TransistorRoom />
    <ChipRoom />
    <CompilerRoom />
    <NetworkRoom />
  </group>;
}
