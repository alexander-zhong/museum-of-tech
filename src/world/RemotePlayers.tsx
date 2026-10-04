import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { peers, shotQueue, type NetState } from "../systems/net";
import { OtterRig, hueFor, CHARACTERS } from "./Mascots";

const STALE_MS = 6000; // drop peers that stop talking
const EYE = 1.6;

function RemoteOtter({ id }: { id: string }) {
  const group = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const speed = useRef(0);
  const [char, setChar] = useState("gold");
  const last = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const entry = peers.get(id);
    const g = group.current;
    if (!entry || !g) return;
    const s: NetState = entry.state;
    const target = new THREE.Vector3(s.p[0], s.p[1] - EYE, s.p[2]);
    // smooth toward the latest network position
    g.position.lerp(target, Math.min(1, dt * 12));
    const yawDiff =
      ((s.yaw - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.rotation.y += yawDiff * Math.min(1, dt * 12);
    speed.current = g.position.distanceTo(last.current) / Math.max(dt, 1e-4);
    last.current.copy(g.position);
    moving.current = s.mv || speed.current > 0.5;
    if (s.char !== char) setChar(s.char);
  });

  return (
    <group ref={group}>
      <Suspense fallback={null}>
        <OtterRig
          hue={hueFor(char)}
          getMoving={() => moving.current}
          getSpeed={() => speed.current}
        />
      </Suspense>
      {/* name tag */}
      <NameTag char={char} />
    </group>
  );
}

function NameTag({ char }: { char: string }) {
  const def = CHARACTERS.find((c) => c.id === char);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgba(16,26,33,0.75)";
      ctx.fillRect(48, 8, 160, 48);
      ctx.fillStyle = def?.swatch ?? "#e0a33c";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.fillText(def?.name ?? "OTTER", 128, 42);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [def]);
  return (
    <sprite position={[0, 2.05, 0]} scale={[0.9, 0.22, 1]} raycast={() => undefined}>
      <spriteMaterial map={tex} transparent depthWrite={false} />
    </sprite>
  );
}

// Tracer pool for remote players' shots.
function RemoteShots() {
  const lines = useMemo(
    () =>
      Array.from({ length: 8 }, () => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
        const line = new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({
            color: 0xffcc66,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        line.visible = false;
        line.frustumCulled = false;
        line.raycast = () => undefined;
        return { line, until: 0 };
      }),
    [],
  );
  const next = useRef(0);

  useFrame(() => {
    const now = performance.now();
    while (shotQueue.length > 0) {
      const shot = shotQueue.shift()!;
      const slot = lines[next.current];
      next.current = (next.current + 1) % lines.length;
      const p = slot.line.geometry.attributes.position.array as Float32Array;
      p[0] = shot.a[0]; p[1] = shot.a[1]; p[2] = shot.a[2];
      p[3] = shot.b[0]; p[4] = shot.b[1]; p[5] = shot.b[2];
      slot.line.geometry.attributes.position.needsUpdate = true;
      slot.line.visible = true;
      slot.until = now + 60;
    }
    lines.forEach((slot) => {
      if (slot.line.visible && now > slot.until) slot.line.visible = false;
    });
  });

  return (
    <group>
      {lines.map((slot, i) => (
        <primitive key={i} object={slot.line} />
      ))}
    </group>
  );
}

export function RemotePlayers() {
  const [ids, setIds] = useState<string[]>([]);

  // reconcile the peer list twice a second (join/leave is rare)
  useEffect(() => {
    const t = setInterval(() => {
      const now = performance.now();
      for (const [id, e] of peers) {
        if (now - e.at > STALE_MS) peers.delete(id);
      }
      const current = [...peers.keys()].sort();
      setIds((prev) =>
        prev.length === current.length && prev.every((v, i) => v === current[i])
          ? prev
          : current,
      );
    }, 500);
    return () => clearInterval(t);
  }, []);

  return (
    <group>
      {ids.map((id) => (
        <RemoteOtter key={id} id={id} />
      ))}
      <RemoteShots />
    </group>
  );
}
