import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { say } from "../systems/narration";
import { registerInteract } from "../systems/interact";

const PLAINTEXT = "SLEEP IS A LEGACY FEATURE";
const rot13 = (s: string) =>
  s.replace(/[A-Z]/g, (c) =>
    String.fromCharCode(((c.charCodeAt(0) - 65 + 13) % 26) + 65),
  );
const CIPHERTEXT = rot13(PLAINTEXT); // genuinely decodes — judges can check

const DRUMS = 9;
const SPIN_BASE = 3000; // ms before first drum locks
const SPIN_STAGGER = 520;
const PRINT_START = SPIN_BASE + DRUMS * SPIN_STAGGER + 400;

export function Bombe() {
  const drums = useRef<(THREE.Group | null)[]>([]);
  const run = useRef<{ started: number; printed: number; done: boolean } | null>(null);

  const stripCanvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 96;
    return c;
  }, []);
  const stripTex = useMemo(() => {
    const t = new THREE.CanvasTexture(stripCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [stripCanvas]);

  const drawStrip = (text: string) => {
    const ctx = stripCanvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#e8e2cf";
    ctx.fillRect(0, 0, 768, 96);
    ctx.fillStyle = "#2a2318";
    ctx.font = "bold 40px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, 384, 62);
    stripTex.needsUpdate = true;
  };

  const placardTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 160;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#101a21";
      ctx.fillRect(0, 0, 768, 160);
      ctx.strokeStyle = "#fc7900";
      ctx.strokeRect(8, 8, 752, 144);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "26px monospace";
      ctx.textAlign = "center";
      ctx.fillText("INTERCEPTED TRANSMISSION:", 384, 52);
      ctx.fillStyle = "#fc7900";
      ctx.font = "bold 36px monospace";
      ctx.fillText(CIPHERTEXT, 384, 112);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useEffect(() => {
    drawStrip("");
    return registerInteract("bombe", "E — run the bombe", () => {
      if (run.current && !run.current.done) return; // not interruptible mid-run
      run.current = { started: performance.now(), printed: 0, done: false };
      drawStrip("");
      say("bombe-start");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    const r = run.current;
    if (!r || r.done) return;
    const elapsed = performance.now() - r.started;

    // drums spin, then lock one by one
    drums.current.forEach((g, i) => {
      if (!g) return;
      const lockAt = SPIN_BASE + i * SPIN_STAGGER;
      if (elapsed < lockAt) {
        g.rotation.z += (6 + i * 0.7) * dt;
      } else {
        // snap to a "found" position
        g.rotation.z = (i * Math.PI * 2) / 26;
      }
    });

    // teleprinter output
    if (elapsed > PRINT_START) {
      const chars = Math.min(
        PLAINTEXT.length,
        Math.floor((elapsed - PRINT_START) / 45),
      );
      if (chars > r.printed) {
        r.printed = chars;
        drawStrip(PLAINTEXT.slice(0, chars));
      }
      if (chars >= PLAINTEXT.length) {
        r.done = true;
        say("bombe-done");
      }
    }
  });

  // cabinet on east wall of Bombe room, facing -x (into the room)
  return (
    <group position={[12.3, 0, -9.5]} rotation={[0, -Math.PI / 2, 0]}>
      <group userData={{ interactId: "bombe" }}>
        {/* cabinet */}
        <mesh position={[0, 1.5, -0.15]}>
          <boxGeometry args={[3.6, 3.0, 0.6]} />
          <meshStandardMaterial color="#3a2b1c" roughness={0.75} />
        </mesh>
        {/* 3x3 rotor drums */}
        {Array.from({ length: DRUMS }, (_, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          return (
            <group
              key={i}
              position={[-0.9 + col * 0.9, 2.3 - row * 0.75, 0.22]}
              ref={(g) => {
                drums.current[i] = g;
              }}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.26, 0.26, 0.18, 24]} />
                <meshStandardMaterial color="#8a2f1f" roughness={0.45} metalness={0.3} />
              </mesh>
              {/* index mark so rotation reads */}
              <mesh position={[0, 0.2, 0.1]}>
                <boxGeometry args={[0.04, 0.1, 0.02]} />
                <meshStandardMaterial color="#e8d9a0" />
              </mesh>
            </group>
          );
        })}
      </group>
      {/* paper strip output */}
      <mesh position={[0, 0.6, 0.18]} rotation={[-0.15, 0, 0]}>
        <planeGeometry args={[2.4, 0.3]} />
        <meshBasicMaterial map={stripTex} toneMapped={false} />
      </mesh>
      {/* ciphertext placard on the side wall */}
      <mesh position={[-2.6, 1.7, 0.4]} rotation={[0, 0.3, 0]}>
        <planeGeometry args={[1.9, 0.4]} />
        <meshBasicMaterial map={placardTex} toneMapped={false} />
      </mesh>
    </group>
  );
}
