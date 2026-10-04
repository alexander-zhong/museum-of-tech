import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, useTexture } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { useStore } from "../store";
import { registerInteract } from "../systems/interact";
import { say } from "../systems/narration";
import { feel } from "../systems/feel";

// Sparky — the StormHacks otter mascot, greeting visitors in the entry hall.
export function Sparky() {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/models/sparky_idle.glb");
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const first = Object.values(actions)[0];
    first?.reset().play();
    const unregister = registerInteract("sparky", "E — Sparky", () =>
      say("sparky"),
    );
    return unregister;
  }, [actions]);

  return (
    <group
      ref={group}
      position={[2.6, 0, -2.2]}
      rotation={[0, -0.45, 0]}
      userData={{ interactId: "sparky" }}
    >
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/models/sparky_idle.glb");
useGLTF.preload("/models/sparky_walk.glb");

// Playable otters — hue-rotations of Sparky's texture, matching the paintings.
export const CHARACTERS = [
  { id: "gold", name: "SPARKY", hue: 0, swatch: "#e0a33c" },
  { id: "blue", name: "SURGE", hue: 170, swatch: "#2f7dd1" },
  { id: "purple", name: "TRENDY", hue: 285, swatch: "#f472b6" },
  { id: "green", name: "SENDY", hue: 90, swatch: "#52b86a" },
];

// Premium skins: tradeable cosmetics (demo-Solana wallet in systems/wallet.ts).
// `filter` is a full canvas filter string applied to the otter texture.
export const SKINS = [
  { id: "midas", name: "MIDAS", filter: "sepia(1) saturate(3) brightness(1.15)", swatch: "#ffd700", price: 3 },
  { id: "void", name: "VOID", filter: "invert(1)", swatch: "#16213e", price: 5 },
  { id: "frost", name: "FROST", filter: "saturate(0.35) brightness(1.35) hue-rotate(165deg)", swatch: "#bfe6ff", price: 2 },
  { id: "toxic", name: "TOXIC", filter: "hue-rotate(55deg) saturate(2.6) brightness(1.1)", swatch: "#7CFC00", price: 2 },
  { id: "cherry", name: "CHERRY", filter: "hue-rotate(305deg) saturate(1.9)", swatch: "#ff4d6d", price: 1 },
];

export function nameFor(id: string): string {
  return (
    CHARACTERS.find((c) => c.id === id)?.name ??
    SKINS.find((k) => k.id === id)?.name ??
    "OTTER"
  );
}

// Canvas filter for any character or skin id.
export function lookFor(id: string): string {
  const skin = SKINS.find((k) => k.id === id);
  if (skin) return skin.filter;
  const hue = CHARACTERS.find((c) => c.id === id)?.hue ?? 0;
  return hue === 0 ? "" : `hue-rotate(${hue}deg)`;
}

const tintCache = new Map<string, THREE.Texture>();

function tintTexture(tex: THREE.Texture, filter: string): THREE.Texture {
  if (!filter) return tex;
  const key = `${tex.uuid}:${filter}`;
  const cached = tintCache.get(key);
  if (cached) return cached;
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  if (!ctx) return tex;
  ctx.filter = filter;
  ctx.drawImage(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = tex.flipY;
  t.colorSpace = tex.colorSpace;
  t.wrapS = tex.wrapS;
  t.wrapT = tex.wrapT;
  t.needsUpdate = true;
  tintCache.set(key, t);
  return t;
}

// Clone materials once, then swap their map for the tinted variant.
function applyHue(root: THREE.Object3D, hue: number) {
  applyLook(root, hue === 0 ? "" : `hue-rotate(${hue}deg)`);
}

function applyLook(root: THREE.Object3D, filter: string) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m, i) => {
      const std = m as THREE.MeshStandardMaterial;
      if (!std.map) return;
      if (!std.userData.cloned) {
        const clone = std.clone();
        clone.userData.cloned = true;
        clone.userData.origMap = std.map;
        if (Array.isArray(mesh.material)) mesh.material[i] = clone;
        else mesh.material = clone;
      }
      const mat = (Array.isArray(mesh.material) ? mesh.material[i] : mesh.material) as THREE.MeshStandardMaterial;
      mat.map = tintTexture(mat.userData.origMap as THREE.Texture, filter);
      mat.needsUpdate = true;
    });
  });
}

// Reusable otter rig: cloned skeleton, idle/walk blend, hue tint.
// Drives the local third-person avatar AND remote multiplayer players.
export function OtterRig({
  hue = 0,
  look,
  getMoving,
  getSpeed,
}: {
  hue?: number;
  look?: string; // full canvas filter; overrides hue when set
  getMoving: () => boolean;
  getSpeed: () => number;
}) {
  const idle = useGLTF("/models/sparky_idle.glb");
  const walk = useGLTF("/models/sparky_walk.glb");
  const idleScene = useMemo(() => SkeletonUtils.clone(idle.scene), [idle.scene]);
  const walkScene = useMemo(() => SkeletonUtils.clone(walk.scene), [walk.scene]);
  useMemo(() => {
    [idleScene, walkScene].forEach((s) =>
      s.traverse((o) => {
        o.raycast = () => {}; // never block the crosshair or catch bullets
      }),
    );
  }, [idleScene, walkScene]);

  const idleRef = useRef<THREE.Group>(null);
  const walkRef = useRef<THREE.Group>(null);
  const idleAnim = useAnimations(idle.animations, idleRef);
  const walkAnim = useAnimations(walk.animations, walkRef);

  useEffect(() => {
    Object.values(idleAnim.actions)[0]?.reset().play();
    Object.values(walkAnim.actions)[0]?.reset().play();
  }, [idleAnim.actions, walkAnim.actions]);

  useEffect(() => {
    const filter = look ?? (hue === 0 ? "" : `hue-rotate(${hue}deg)`);
    applyLook(idleScene, filter);
    applyLook(walkScene, filter);
  }, [hue, look, idleScene, walkScene]);

  useFrame(() => {
    const moving = getMoving();
    if (idleRef.current) idleRef.current.visible = !moving;
    if (walkRef.current) walkRef.current.visible = moving;
    const act = Object.values(walkAnim.actions)[0];
    if (act) act.timeScale = Math.min(2.4, Math.max(0.8, getSpeed() / 3.2));
  });

  return (
    <group scale={0.85}>
      <group ref={idleRef}>
        <primitive object={idleScene} />
      </group>
      <group ref={walkRef} visible={false}>
        <primitive object={walkScene} />
      </group>
    </group>
  );
}

// Range target: a walking otter clone that CAN catch the crosshair ray
// (unlike avatars, which are raycast-invisible). Valorant-bot energy.
export function TargetOtter({ hue }: { hue: number }) {
  const walk = useGLTF("/models/sparky_walk.glb");
  const scene = useMemo(() => SkeletonUtils.clone(walk.scene), [walk.scene]);
  const ref = useRef<THREE.Group>(null);
  const { actions } = useAnimations(walk.animations, ref);
  useEffect(() => {
    applyHue(scene, hue);
  }, [scene, hue]);
  useEffect(() => {
    const act = Object.values(actions)[0];
    act?.reset().play();
    if (act) act.time = Math.random() * 2; // desync the six bots
  }, [actions]);
  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

export function hueFor(characterId: string): number {
  return CHARACTERS.find((ch) => ch.id === characterId)?.hue ?? 0;
}

// The player's third-person body: your chosen otter.
export function SparkyAvatar() {
  const character = useStore((s) => s.character);
  return (
    <OtterRig
      look={lookFor(character)}
      getMoving={() => feel.avatarMoving}
      getSpeed={() => feel.avatarSpeed}
    />
  );
}

// Framed otter paintings lifted from the StormHacks studio.
const ART: {
  url: string;
  pos: [number, number, number];
  rotY: number;
  w: number;
  h: number;
}[] = [
  // entry hall, north wall
  { url: "/art/ch1.webp", pos: [-7, 2.2, 1.82], rotY: Math.PI, w: 1.7, h: 1.1 },
  { url: "/art/ch6.webp", pos: [7, 2.2, 1.82], rotY: Math.PI, w: 1.7, h: 1.1 },
  // corridor, between the exhibit doors
  { url: "/art/ch2.webp", pos: [-2.82, 2.1, -13.2], rotY: Math.PI / 2, w: 1.0, h: 1.45 },
  { url: "/art/ch3.webp", pos: [2.82, 2.1, -13.2], rotY: -Math.PI / 2, w: 1.0, h: 1.25 },
  { url: "/art/ch4.webp", pos: [-2.82, 2.1, -16.8], rotY: Math.PI / 2, w: 1.0, h: 1.25 },
  { url: "/art/ch5.webp", pos: [2.82, 2.1, -16.8], rotY: -Math.PI / 2, w: 1.7, h: 1.1 },
];

function Painting({ art }: { art: (typeof ART)[number] }) {
  const tex = useTexture(art.url);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <group position={art.pos} rotation={[0, art.rotY, 0]}>
      {/* wooden frame */}
      <mesh position={[0, 0, -0.03]} raycast={() => null}>
        <boxGeometry args={[art.w + 0.12, art.h + 0.12, 0.05]} />
        <meshStandardMaterial color="#5a4027" roughness={0.7} />
      </mesh>
      <mesh raycast={() => null}>
        <planeGeometry args={[art.w, art.h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Gallery() {
  return (
    <group>
      {ART.map((a) => (
        <Painting key={a.url} art={a} />
      ))}
    </group>
  );
}
