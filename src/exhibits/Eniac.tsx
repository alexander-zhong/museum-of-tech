import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { say } from "../systems/narration";
import { registerInteract } from "../systems/interact";

const LAMPS = 8;

function bitsValue(bits: boolean[]): number {
  return bits.reduce((acc, b) => (acc << 1) | (b ? 1 : 0), 0);
}

export function Eniac() {
  const [switches, setSwitches] = useState<boolean[]>(Array(10).fill(false));
  const switchesRef = useRef(switches);
  switchesRef.current = switches;

  const computing = useRef({ active: false, until: 0, result: 0, shown: false });
  const lampMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  const placardCanvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    return c;
  }, []);
  const placardTex = useMemo(() => {
    const t = new THREE.CanvasTexture(placardCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [placardCanvas]);

  const drawPlacard = (text: string) => {
    const ctx = placardCanvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0e0e16";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#555a77";
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = "#ffcf8a";
    ctx.font = "42px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 78);
    placardTex.needsUpdate = true;
  };

  useEffect(() => {
    drawPlacard("SET SWITCHES. PRESS GO.");
    const cleanups: (() => void)[] = [];
    for (let i = 0; i < 10; i++) {
      cleanups.push(
        registerInteract(`eniac-sw-${i}`, "E — flip switch", () => {
          setSwitches((prev) => {
            const next = [...prev];
            next[i] = !next[i];
            return next;
          });
        }),
      );
    }
    cleanups.push(
      registerInteract("eniac-go", "E — hit GO", () => {
        if (computing.current.active) return;
        const sw = switchesRef.current;
        const a = bitsValue(sw.slice(0, 5));
        const b = bitsValue(sw.slice(5, 10));
        computing.current = {
          active: true,
          until: performance.now() + 2000,
          result: a + b,
          shown: false,
        };
        drawPlacard("COMPUTING...");
      }),
    );
    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const c = computing.current;
    if (c.active) {
      if (performance.now() < c.until) {
        // vacuum-tube theater: random flicker
        lampMats.current.forEach((m) => {
          if (m) m.emissiveIntensity = Math.random() > 0.5 ? 2.2 : 0.05;
        });
      } else {
        c.active = false;
        c.shown = true;
        const sw = switchesRef.current;
        const a = bitsValue(sw.slice(0, 5));
        const b = bitsValue(sw.slice(5, 10));
        drawPlacard(`${a} + ${b} = ${c.result}`);
        say(c.result === 42 ? "eniac-42" : "eniac-done");
      }
    }
    if (!c.active) {
      // lamps show the result in binary (or operands live when idle)
      const value = c.shown ? c.result : 0;
      for (let i = 0; i < LAMPS; i++) {
        const m = lampMats.current[i];
        if (m) {
          const on = (value >> (LAMPS - 1 - i)) & 1;
          m.emissiveIntensity = on ? 2.2 : 0.05;
        }
      }
    }
  });

  // panel wall on west side of ENIAC room, facing +x (into the room)
  return (
    <group position={[-12.35, 0, -9.5]} rotation={[0, Math.PI / 2, 0]}>
      {/* main panel */}
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[5.4, 3.2, 0.35]} />
        <meshStandardMaterial color="#16161f" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* lamp row */}
      {Array.from({ length: LAMPS }, (_, i) => (
        <mesh key={`lamp-${i}`} position={[-1.4 + i * 0.4, 2.45, 0.22]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial
            ref={(m) => {
              lampMats.current[i] = m;
            }}
            color="#331a00"
            emissive="#ffaa33"
            emissiveIntensity={0.05}
          />
        </mesh>
      ))}
      {/* operand labels: two rows of 5 switches */}
      {switches.map((on, i) => {
        const row = i < 5 ? 0 : 1;
        const col = i % 5;
        return (
          <group
            key={`sw-${i}`}
            position={[-1.3 + col * 0.65, 1.7 - row * 0.55, 0.2]}
            userData={{ interactId: `eniac-sw-${i}` }}
          >
            <mesh>
              <cylinderGeometry args={[0.07, 0.07, 0.1, 10]} />
              <meshStandardMaterial color="#444455" />
            </mesh>
            <mesh position={[0, on ? 0.09 : -0.09, 0.05]} rotation={[on ? -0.6 : 0.6, 0, 0]}>
              <boxGeometry args={[0.05, 0.22, 0.05]} />
              <meshStandardMaterial
                color={on ? "#ffcc66" : "#888899"}
                emissive={on ? "#ff9900" : "#000000"}
                emissiveIntensity={on ? 0.8 : 0}
              />
            </mesh>
          </group>
        );
      })}
      {/* GO button */}
      <mesh position={[2.2, 1.45, 0.24]} userData={{ interactId: "eniac-go" }}>
        <cylinderGeometry args={[0.16, 0.18, 0.12, 16]} />
        <meshStandardMaterial
          color="#aa1111"
          emissive="#ff2222"
          emissiveIntensity={0.6}
        />
      </mesh>
      {/* result placard */}
      <mesh position={[0, 0.65, 0.2]}>
        <planeGeometry args={[2.4, 0.6]} />
        <meshBasicMaterial map={placardTex} toneMapped={false} />
      </mesh>
    </group>
  );
}
