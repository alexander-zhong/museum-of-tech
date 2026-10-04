import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { peers, shotQueue, type NetState } from "../systems/net";
import { MAX_HP } from "../systems/combat";
import {
  HIP_PIVOT,
  fallbackKnock,
  ragdollPose,
  type Knock,
} from "../systems/ragdoll";
import { OtterRig, lookFor, nameFor, CHARACTERS, SKINS } from "./Mascots";

const STALE_MS = 6000; // drop peers that stop talking
const EYE = 1.6;

// Hitboxes, sized to the otter model (feet at y=0, head tops out ~1.7).
// They are invisible but do raycast — this is what bullets actually hit.
const BODY: [number, number, number] = [0.75, 1.15, 0.75];
const BODY_Y = 0.575;
const HEAD: [number, number, number] = [0.5, 0.55, 0.5];
const HEAD_CENTER_Y = 1.42;

const BAR_W = 0.8;
const BAR_H = 0.07;

function barColor(frac: number): number {
  if (frac > 0.6) return 0x52b86a;
  if (frac > 0.3) return 0xfc7900;
  return 0xd13a3a;
}

function RemoteOtter({ id }: { id: string }) {
  const group = useRef<THREE.Group>(null);
  const flop = useRef<THREE.Group>(null); // ragdoll pivot at hip height
  const hud = useRef<THREE.Group>(null); // name tag + health bar
  const hitboxes = useRef<(THREE.Mesh | null)[]>([]);
  const fill = useRef<THREE.Sprite>(null);
  const moving = useRef(false);
  const speed = useRef(0);
  const [char, setChar] = useState("gold");
  const [heldWeapon, setHeldWeapon] = useState<string | null>(null);
  const last = useRef(new THREE.Vector3());
  // ragdoll bookkeeping: a body stays where it fell, not where they respawn
  const deathAt = useRef(0);
  const deathPos = useRef(new THREE.Vector3());
  const deathYaw = useRef(0);
  const snapUntil = useRef(0); // just-respawned: teleport, never glide
  const knock = useRef<Knock>(fallbackKnock(0));

  useFrame((_, dt) => {
    const entry = peers.get(id);
    const g = group.current;
    if (!entry || !g) return;
    const s: NetState = entry.state;
    const target = new THREE.Vector3(s.p[0], s.p[1] - EYE, s.p[2]);
    const hp = s.hp ?? MAX_HP;
    const alive = hp > 0;
    const now = performance.now();

    if (!alive && deathAt.current === 0) {
      // they just went down: pin the body where it fell and start the flop
      deathAt.current = now;
      deathPos.current.copy(g.position);
      deathYaw.current = g.rotation.y;
      // the shot rides along with hp hitting zero; older clients send none
      knock.current = s.ko
        ? { dx: s.ko[0], dz: s.ko[1], force: s.ko[2], seed: s.ko[3] }
        : fallbackKnock(deathYaw.current);
    } else if (alive && deathAt.current !== 0) {
      // respawned somewhere else — snap, don't glide across the museum
      deathAt.current = 0;
      // their respawn position may be a packet behind, so snap for a moment
      // instead of sliding the body across the museum to meet it
      snapUntil.current = now + 400;
      g.position.copy(target);
      if (flop.current) {
        flop.current.rotation.set(0, 0, 0);
        flop.current.visible = true;
      }
    }

    if (deathAt.current === 0) {
      // smooth toward the latest network position
      if (now < snapUntil.current) g.position.copy(target);
      else g.position.lerp(target, Math.min(1, dt * 12));
      const yawDiff =
        ((s.yaw - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      g.rotation.y += yawDiff * Math.min(1, dt * 12);
      speed.current = g.position.distanceTo(last.current) / Math.max(dt, 1e-4);
      last.current.copy(g.position);
      moving.current = s.mv || speed.current > 0.5;
    } else {
      const pose = ragdollPose(now - deathAt.current, knock.current, deathYaw.current);
      g.position.set(
        deathPos.current.x + pose.dx,
        deathPos.current.y + pose.y,
        deathPos.current.z + pose.dz,
      );
      g.rotation.y = deathYaw.current + pose.spin;
      moving.current = false;
      speed.current = 0;
      last.current.copy(g.position);
      if (flop.current) {
        flop.current.rotation.x = pose.pitch;
        flop.current.rotation.z = pose.roll;
        flop.current.visible = !pose.gone;
      }
    }
    if (s.char !== char) setChar(s.char);
    // NetState.w is omitted while a peer is unarmed, so undefined means empty
    // paws — not a default rifle. Anything else is the weapon they picked up.
    const w = s.w ?? null;
    if (w !== heldWeapon) setHeldWeapon(w);

    // the dead stop catching bullets — and raycasting ignores `visible`,
    // so park the hitboxes on an unused layer rather than just hiding them
    hitboxes.current.forEach((m) => m?.layers.set(alive ? 0 : 1));
    if (hud.current) hud.current.visible = alive;
    const frac = Math.max(0, Math.min(1, hp / MAX_HP));
    if (fill.current) {
      fill.current.scale.set(BAR_W * frac, BAR_H, 1);
      fill.current.position.x = -(BAR_W * (1 - frac)) / 2;
      (fill.current.material as THREE.SpriteMaterial).color.setHex(
        barColor(frac),
      );
    }
  });

  return (
    <group ref={group}>
      <group ref={flop} position={[0, HIP_PIVOT, 0]}>
        <group position={[0, -HIP_PIVOT, 0]}>
          <Suspense fallback={null}>
            <OtterRig
              look={lookFor(char)}
              weaponId={heldWeapon}
              getMoving={() => moving.current}
              getSpeed={() => speed.current}
            />
          </Suspense>
        </group>
      </group>
      {/* bullet hitboxes: invisible, but the only thing shots collide with */}
      <mesh
        position={[0, BODY_Y, 0]}
        userData={{ peerId: id, zone: "body" }}
        ref={(m) => {
          hitboxes.current[0] = m;
        }}
      >
        <boxGeometry args={BODY} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh
        position={[0, HEAD_CENTER_Y, 0]}
        userData={{ peerId: id, zone: "head" }}
        ref={(m) => {
          hitboxes.current[1] = m;
        }}
      >
        <boxGeometry args={HEAD} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* health bar + name tag: live players only */}
      <group ref={hud}>
        <sprite
          position={[0, 1.88, 0]}
          scale={[BAR_W, BAR_H, 1]}
          raycast={() => undefined}
        >
          <spriteMaterial color="#101a21" opacity={0.75} transparent depthWrite={false} />
        </sprite>
        <sprite ref={fill} position={[0, 1.88, 0]} raycast={() => undefined}>
          <spriteMaterial color="#52b86a" depthWrite={false} />
        </sprite>
        <NameTag char={char} />
      </group>
    </group>
  );
}

function NameTag({ char }: { char: string }) {
  const def = CHARACTERS.find((c) => c.id === char) ?? SKINS.find((k) => k.id === char);
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
      ctx.fillText(nameFor(char), 128, 42);
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
