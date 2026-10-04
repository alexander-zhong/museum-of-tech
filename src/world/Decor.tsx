import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const GOLD = "#c9a24b";
const ROPE = "#8a1f2d";

// ---- velvet rope line guarding an exhibit ----
function RopeLine({
  from,
  to,
}: {
  from: [number, number, number];
  to: [number, number, number];
}) {
  const tube = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= 0.18;
    const c = new THREE.QuadraticBezierCurve3(a, mid, b);
    return new THREE.TubeGeometry(c, 12, 0.025, 8);
  }, [from, to]);
  return (
    <mesh geometry={tube} raycast={() => null}>
      <meshStandardMaterial color={ROPE} roughness={0.9} />
    </mesh>
  );
}

function Stanchion({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
        <meshStandardMaterial color="#22232e" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} emissive={GOLD} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.04, 12]} />
        <meshStandardMaterial color="#22232e" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

// Three stanchions + two rope spans, centered at (x,z), spanning `width` along `axis`.
function RopeGuard({
  x,
  z,
  width,
  axis,
}: {
  x: number;
  z: number;
  width: number;
  axis: "x" | "z";
}) {
  const h = 0.93;
  const half = width / 2;
  const p = (o: number): [number, number, number] =>
    axis === "x" ? [x + o, 0, z] : [x, 0, z + o];
  const r = (o: number): [number, number, number] =>
    axis === "x" ? [x + o, h, z] : [x, h, z + o];
  return (
    <group>
      <Stanchion pos={p(-half)} />
      <Stanchion pos={p(0)} />
      <Stanchion pos={p(half)} />
      <RopeLine from={r(-half)} to={r(0)} />
      <RopeLine from={r(0)} to={r(half)} />
    </group>
  );
}

// ---- museum column with glowing trim ----
function Column({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 4, 10]} />
        <meshStandardMaterial color="#232430" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.7, 0.3, 0.7]} />
        <meshStandardMaterial color="#1b1c26" roughness={0.7} />
      </mesh>
      <mesh position={[0, 3.85, 0]}>
        <boxGeometry args={[0.7, 0.3, 0.7]} />
        <meshStandardMaterial color="#1b1c26" roughness={0.7} />
      </mesh>
      {/* glowing trim ring */}
      <mesh position={[0, 0.34, 0]}>
        <torusGeometry args={[0.27, 0.015, 8, 24]} />
        <meshBasicMaterial color="#fc7900" />
      </mesh>
    </group>
  );
}

// ---- ceiling light panel ----
function CeilPanel({ pos, w = 1.6, d = 0.5, color = "#dfe8ff" }: { pos: [number, number, number]; w?: number; d?: number; color?: string }) {
  return (
    <mesh position={pos} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

// ---- hanging banner with canvas typography ----
function Banner({
  pos,
  lines,
  accent,
}: {
  pos: [number, number, number];
  lines: string[];
  accent: string;
}) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 1024;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#101a21";
      ctx.fillRect(0, 0, 512, 1024);
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, 512, 14);
      ctx.fillRect(0, 1010, 512, 14);
      ctx.textAlign = "center";
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "bold 92px monospace";
      lines.forEach((l, i) => {
        ctx.fillStyle = i === lines.length - 1 ? accent : "#e5e7eb";
        ctx.fillText(l, 256, 260 + i * 160);
      });
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [lines, accent]);
  return (
    <group position={pos}>
      <mesh position={[0, -1.1, 0]} raycast={() => null}>
        <planeGeometry args={[1.1, 2.2]} />
        <meshBasicMaterial map={tex} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh raycast={() => null}>
        <boxGeometry args={[1.2, 0.05, 0.05]} />
        <meshStandardMaterial color="#444" metalness={0.6} />
      </mesh>
    </group>
  );
}

// ---- blinking server/relay panel (set dressing for the ENIAC room) ----
function BlinkenPanel({ pos, rotY = 0 }: { pos: [number, number, number]; rotY?: number }) {
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    if (t.current > 0.18) {
      t.current = 0;
      mats.current.forEach((m) => {
        if (m && Math.random() < 0.3) {
          m.emissiveIntensity = m.emissiveIntensity > 0.5 ? 0.05 : 1.6;
        }
      });
    }
  });
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[1.6, 2.6, 0.3]} />
        <meshStandardMaterial color="#16161f" roughness={0.7} metalness={0.3} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-0.55 + (i % 4) * 0.37, 0.8 - Math.floor(i / 4) * 0.45, 0.17]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial
            ref={(m) => {
              if (m) mats.current[i] = m;
            }}
            color="#331a00"
            emissive={i % 3 === 0 ? "#ff5533" : "#ffaa33"}
            emissiveIntensity={Math.random() > 0.5 ? 1.6 : 0.05}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---- wooden crates (CS room, de_dust energy) ----
function Crate({ pos, size = 0.8, rotY = 0 }: { pos: [number, number, number]; size?: number; rotY?: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color="#6b4f2a" roughness={0.9} />
      </mesh>
      {/* edge trim */}
      {([[0, size / 2 - 0.03, 0], [0, -size / 2 + 0.03, 0]] as const).map((p, i) => (
        <mesh key={i} position={[p[0], p[1], p[2]]}>
          <boxGeometry args={[size + 0.04, 0.07, size + 0.04]} />
          <meshStandardMaterial color="#4e3a20" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ---- the Moon (AGC room) ----
function Moon() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.15;
      ref.current.position.y = 2.1 + Math.sin(state.clock.elapsedTime * 0.6) * 0.06;
    }
  });
  return (
    <group position={[8, 0, -24.5]}>
      <mesh ref={ref} position={[0, 2.1, 0]} raycast={() => null}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshStandardMaterial color="#b8bcc4" roughness={1} />
      </mesh>
      <pointLight position={[0.9, 2.4, 0.6]} color="#cdd4e8" intensity={6} distance={5} decay={1.8} />
    </group>
  );
}

// ---- dead arcade cabinet (Pong room set dressing) ----
function DeadCabinet({ pos, rotY }: { pos: [number, number, number]; rotY: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 192;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#07070a";
      ctx.fillRect(0, 0, 256, 192);
      ctx.fillStyle = "#3a3f4a";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.fillText("OUT OF", 128, 85);
      ctx.fillText("ORDER", 128, 120);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.95, -0.1]}>
        <boxGeometry args={[1.3, 1.9, 0.8]} />
        <meshStandardMaterial color="#191925" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.35, 0.31]}>
        <planeGeometry args={[1.0, 0.75]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Decor() {
  return (
    <group>
      {/* entry hall: columns flanking the corridor mouth + banners */}
      <Column pos={[-4, 0, -3.3]} />
      <Column pos={[4, 0, -3.3]} />
      <Column pos={[-9, 0, -0.5]} />
      <Column pos={[9, 0, -0.5]} />
      <Banner pos={[-6.5, 3.9, -2]} lines={["DEAD", "TECH", "2026"]} accent="#fc7900" />
      <Banner pos={[6.5, 3.9, -2]} lines={["BORN", "TO", "BUILD"]} accent="#0278ff" />

      {/* corridor: ceiling light strip + baseboard glow */}
      {[-6, -10, -14, -18, -22].map((z) => (
        <CeilPanel key={z} pos={[0, 3.98, z]} />
      ))}
      <mesh position={[-2.8, 0.04, -15]} raycast={() => null}>
        <boxGeometry args={[0.04, 0.04, 21.5]} />
        <meshBasicMaterial color="#fc7900" toneMapped={false} />
      </mesh>
      <mesh position={[2.8, 0.04, -15]} raycast={() => null}>
        <boxGeometry args={[0.04, 0.04, 21.5]} />
        <meshBasicMaterial color="#fc7900" toneMapped={false} />
      </mesh>

      {/* velvet ropes in front of each exhibit */}
      <RopeGuard x={-10.3} z={-9.5} width={4.4} axis="z" />
      <RopeGuard x={10.3} z={-9.5} width={3.4} axis="z" />
      <RopeGuard x={10.4} z={-20.5} width={3} axis="z" />

      {/* ENIAC room: blinking relay panels fill the walls */}
      <BlinkenPanel pos={[-8, 1.3, -4.55]} rotY={Math.PI} />
      <BlinkenPanel pos={[-5.5, 1.3, -4.55]} rotY={Math.PI} />
      <BlinkenPanel pos={[-8, 1.3, -14.45]} />
      <BlinkenPanel pos={[-5.5, 1.3, -14.45]} />

      {/* Pong room: dead sibling cabinets */}
      <DeadCabinet pos={[-10, 0, -17]} rotY={2.2} />
      <DeadCabinet pos={[-10, 0, -24]} rotY={0.9} />

      {/* AGC room: the Moon itself */}
      <Moon />

      {/* CS room: crate stacks, as is tradition */}
      <Crate pos={[-4, 0.4, -27.5]} rotY={0.2} />
      <Crate pos={[-3.9, 1.2, -27.6]} size={0.75} rotY={0.6} />
      <Crate pos={[-4.2, 0.4, -36.8]} rotY={0.4} />
      <Crate pos={[4.2, 0.35, -33]} size={0.7} rotY={1.1} />
      <CeilPanel pos={[0, 3.98, -31]} w={2.2} d={0.7} color="#ffe9c9" />
    </group>
  );
}
