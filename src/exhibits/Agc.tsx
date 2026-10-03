import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { say } from "../systems/narration";
import { registerInteract } from "../systems/interact";

const W = 256;
const H = 256;

// Scripted DSKY sequences — theatrical, not an emulator.
type Step = { at: number; verb?: string; noun?: string; prog?: string; r1?: string; r2?: string; r3?: string; alarm?: boolean; narrate?: string };

const SEQUENCES: Step[][] = [
  [
    { at: 0, verb: "16", noun: "36", prog: "00", r1: "", r2: "", r3: "", narrate: "agc-advance" },
    { at: 600, r1: "CLOCK" }, // r1 replaced live by mission clock in tick
  ],
  [
    { at: 0, verb: "16", noun: "65", prog: "00", r1: "+00102", r2: "+00045", r3: "+00007" },
  ],
  [
    { at: 0, verb: "99", noun: "62", prog: "63", r1: "+01202", r2: "", r3: "" },
    { at: 800, alarm: true, narrate: "agc-1202" },
    { at: 7000, alarm: false, verb: "16", noun: "68", prog: "63", r1: "+04000", r2: "+00120", r3: "-00003" },
  ],
];

interface Display {
  prog: string;
  verb: string;
  noun: string;
  r1: string;
  r2: string;
  r3: string;
  alarm: boolean;
  liveClock: boolean;
}

export function Agc() {
  const disp = useRef<Display>({
    prog: "00",
    verb: "--",
    noun: "--",
    r1: "",
    r2: "",
    r3: "",
    alarm: false,
    liveClock: false,
  });
  const seqIndex = useRef(0);
  const running = useRef<{ steps: Step[]; started: number; next: number } | null>(null);
  const bootTime = useRef(performance.now());
  const dirty = useRef(true);

  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);

  const draw = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const d = disp.current;
    ctx.fillStyle = "#0a0f0a";
    ctx.fillRect(0, 0, W, H);
    ctx.font = "13px monospace";
    ctx.fillStyle = "#8a8a7a";
    ctx.fillText("COMP ACTY", 14, 24);
    ctx.fillText("PROG", 180, 24);
    ctx.fillText("VERB", 14, 80);
    ctx.fillText("NOUN", 180, 80);

    // alarm light
    if (d.alarm && Math.floor(performance.now() / 350) % 2 === 0) {
      ctx.fillStyle = "#ffcf00";
      ctx.fillRect(12, 32, 92, 26);
      ctx.fillStyle = "#1a1400";
      ctx.font = "bold 15px monospace";
      ctx.fillText("PROG ALRM", 16, 51);
    } else {
      ctx.strokeStyle = "#333a33";
      ctx.strokeRect(12, 32, 92, 26);
    }

    ctx.fillStyle = "#4dff4d";
    ctx.font = "bold 30px monospace";
    ctx.fillText(d.prog, 180, 54);
    ctx.fillText(d.verb, 14, 112);
    ctx.fillText(d.noun, 180, 112);

    // registers
    ctx.font = "bold 26px monospace";
    const rows = [d.r1, d.r2, d.r3];
    rows.forEach((r, i) => {
      ctx.strokeStyle = "#2a332a";
      ctx.beginPath();
      ctx.moveTo(14, 132 + i * 38);
      ctx.lineTo(242, 132 + i * 38);
      ctx.stroke();
      ctx.fillStyle = "#4dff4d";
      ctx.textAlign = "right";
      ctx.fillText(r, 242, 160 + i * 38);
      ctx.textAlign = "left";
    });
    texture.needsUpdate = true;
  };

  useEffect(() => {
    draw();
    return registerInteract("agc", "E — key in next sequence", () => {
      if (running.current) return;
      const steps = SEQUENCES[seqIndex.current % SEQUENCES.length];
      seqIndex.current++;
      running.current = { steps, started: performance.now(), next: 0 };
      disp.current.liveClock = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const run = running.current;
    const d = disp.current;
    if (run) {
      const elapsed = performance.now() - run.started;
      while (run.next < run.steps.length && run.steps[run.next].at <= elapsed) {
        const s = run.steps[run.next];
        if (s.prog !== undefined) d.prog = s.prog;
        if (s.verb !== undefined) d.verb = s.verb;
        if (s.noun !== undefined) d.noun = s.noun;
        if (s.r1 !== undefined) {
          if (s.r1 === "CLOCK") d.liveClock = true;
          else d.r1 = s.r1;
        }
        if (s.r2 !== undefined) d.r2 = s.r2;
        if (s.r3 !== undefined) d.r3 = s.r3;
        if (s.alarm !== undefined) d.alarm = s.alarm;
        if (s.narrate) say(s.narrate);
        run.next++;
        dirty.current = true;
      }
      if (run.next >= run.steps.length && !d.alarm) running.current = null;
      if (run && run.next >= run.steps.length && d.alarm === false) running.current = null;
    }
    if (d.liveClock) {
      const t = (performance.now() - bootTime.current) / 1000;
      const hh = String(Math.floor(t / 3600)).padStart(2, "0");
      const mm = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
      const ss = String(Math.floor(t % 60)).padStart(2, "0");
      d.r1 = `+${hh}${mm}${ss}`;
      dirty.current = true;
    }
    if (d.alarm) dirty.current = true; // keep the lamp blinking
    if (dirty.current) {
      draw();
      dirty.current = false;
    }
  });

  // console on east wall of AGC room, facing -x (into the room)
  return (
    <group position={[12.3, 0, -20.5]} rotation={[0, -Math.PI / 2, 0]}>
      <group userData={{ interactId: "agc" }}>
        {/* console body */}
        <mesh position={[0, 0.9, -0.1]}>
          <boxGeometry args={[2.2, 1.8, 0.7]} />
          <meshStandardMaterial color="#2e2e33" roughness={0.5} metalness={0.4} />
        </mesh>
        {/* DSKY display */}
        <mesh position={[-0.45, 1.25, 0.28]}>
          <planeGeometry args={[0.85, 0.85]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
        {/* keypad: 3 rows of 6 keys */}
        {Array.from({ length: 18 }, (_, i) => (
          <mesh
            key={i}
            position={[0.25 + (i % 6) * 0.17, 1.5 - Math.floor(i / 6) * 0.17, 0.27]}
          >
            <boxGeometry args={[0.13, 0.13, 0.06]} />
            <meshStandardMaterial color="#44444c" roughness={0.4} />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, 1.3, 1]} color="#44ff66" intensity={6} distance={4.5} />
    </group>
  );
}
