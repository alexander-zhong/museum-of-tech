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
    Object.values(actions).forEach((a) => a?.reset().play());
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
  { id: "blue", name: "STORMY", hue: 170, swatch: "#2f7dd1" },
  { id: "purple", name: "TRENDY", hue: 285, swatch: "#f472b6" },
  { id: "green", name: "SENDY", hue: 90, swatch: "#52b86a" },
];

// Premium skins: tradeable cosmetics (demo-Solana wallet in systems/wallet.ts).
// `filter` is a full canvas filter string applied to the otter texture.
export type Rarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9ca3af",
  rare: "#0278ff",
  epic: "#b14cf0",
  legendary: "#fc7900",
};

export const SKINS: {
  id: string;
  name: string;
  filter: string;
  swatch: string;
  price: number;
  rarity: Rarity;
}[] = [
  { id: "rust", name: "RUST", filter: "sepia(0.7) saturate(1.4) brightness(0.9)", swatch: "#a86a3d", price: 1, rarity: "common" },
  { id: "slate", name: "SLATE", filter: "grayscale(1) brightness(0.95)", swatch: "#8d939e", price: 1, rarity: "common" },
  { id: "cherry", name: "CHERRY", filter: "hue-rotate(305deg) saturate(1.9)", swatch: "#ff4d6d", price: 1, rarity: "common" },
  { id: "toxic", name: "TOXIC", filter: "hue-rotate(55deg) saturate(2.6) brightness(1.1)", swatch: "#7CFC00", price: 1, rarity: "common" },
  { id: "frost", name: "FROST", filter: "saturate(0.35) brightness(1.35) hue-rotate(165deg)", swatch: "#bfe6ff", price: 1, rarity: "common" },
  { id: "ocean", name: "OCEAN", filter: "hue-rotate(190deg) saturate(2.2) brightness(0.95)", swatch: "#0e7490", price: 2, rarity: "rare" },
  { id: "magma", name: "MAGMA", filter: "hue-rotate(335deg) saturate(2.8) brightness(0.85) contrast(1.2)", swatch: "#dc2626", price: 2, rarity: "rare" },
  { id: "midas", name: "MIDAS", filter: "sepia(1) saturate(3) brightness(1.15)", swatch: "#ffd700", price: 3, rarity: "rare" },
  { id: "void", name: "VOID", filter: "invert(1)", swatch: "#16213e", price: 5, rarity: "epic" },
  { id: "ghost", name: "GHOST", filter: "grayscale(1) brightness(1.6) contrast(0.8)", swatch: "#e5e7eb", price: 5, rarity: "epic" },
  { id: "glitch", name: "GLITCH", filter: "invert(1) hue-rotate(90deg) saturate(3)", swatch: "#00ffc8", price: 10, rarity: "legendary" },
];

const ROLL_WEIGHT: Record<Rarity, number> = {
  common: 60,
  rare: 28,
  epic: 9,
  legendary: 3,
};

// Weighted case roll: picks a rarity bucket, then a skin inside it.
export function rollSkin(): (typeof SKINS)[number] {
  const total = Object.values(ROLL_WEIGHT).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let tier: Rarity = "common";
  for (const [k, w] of Object.entries(ROLL_WEIGHT) as [Rarity, number][]) {
    if (r < w) {
      tier = k;
      break;
    }
    r -= w;
  }
  const pool = SKINS.filter((k) => k.rarity === tier);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function swatchFor(id: string): string {
  return (
    CHARACTERS.find((c) => c.id === id)?.swatch ??
    SKINS.find((k) => k.id === id)?.swatch ??
    "#e0a33c"
  );
}

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


// ---- third-person held weapons: attached to the rig's right hand bone ----
const GUN_METAL = new THREE.MeshStandardMaterial({ color: "#3a3a42", metalness: 0.6, roughness: 0.35 });
const GUN_WOOD = new THREE.MeshStandardMaterial({ color: "#4a3426", metalness: 0.2, roughness: 0.55 });
const GUN_DARK = new THREE.MeshStandardMaterial({ color: "#26262c", roughness: 0.5 });
const GUN_GREEN = new THREE.MeshStandardMaterial({ color: "#3c4a38", metalness: 0.4, roughness: 0.45 });
const BLADE = new THREE.MeshStandardMaterial({ color: "#c8ccd4", metalness: 0.9, roughness: 0.15 });

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.raycast = () => {};
  return m;
}

export function buildHeldGun(weaponId: string): THREE.Group {
  const g = new THREE.Group();
  // built along +Z (barrel forward), grip at origin
  switch (weaponId) {
    case "knife":
      g.add(box(0.016, 0.07, 0.3, BLADE, 0, 0.02, 0.18));
      g.add(box(0.04, 0.05, 0.12, GUN_DARK, 0, 0, 0.0));
      break;
    case "pistol":
      g.add(box(0.07, 0.09, 0.28, GUN_METAL, 0, 0.05, 0.12));
      g.add(box(0.06, 0.13, 0.07, GUN_DARK, 0, -0.04, 0));
      break;
    case "smg":
      g.add(box(0.07, 0.1, 0.38, GUN_METAL, 0, 0.05, 0.14));
      g.add(box(0.05, 0.2, 0.06, GUN_DARK, 0, -0.08, 0.1));
      g.add(box(0.05, 0.12, 0.06, GUN_DARK, 0, -0.04, -0.04));
      break;
    case "awp":
      g.add(box(0.07, 0.1, 0.66, GUN_GREEN, 0, 0.05, 0.2));
      {
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), GUN_DARK);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.14, 0.12);
        scope.raycast = () => {};
        g.add(scope);
      }
      g.add(box(0.05, 0.14, 0.1, GUN_GREEN, 0, -0.05, -0.08));
      break;
    default: // rifle
      g.add(box(0.075, 0.1, 0.48, GUN_WOOD, 0, 0.05, 0.16));
      g.add(box(0.05, 0.16, 0.07, GUN_METAL, 0, -0.06, 0.08));
      g.add(box(0.06, 0.1, 0.16, GUN_WOOD, 0, 0.02, -0.14));
      break;
  }
  return g;
}

// Attach a weapon to the clone's right hand; replaces any previous one.
function attachGun(root: THREE.Object3D, weaponId: string | null): THREE.Group | null {
  const hand = root.getObjectByName("DEF-hand.R");
  if (!hand) return null;
  const old = hand.getObjectByName("held-gun");
  if (old) hand.remove(old);
  if (!weaponId) return null;
  const gun = buildHeldGun(weaponId);
  gun.name = "held-gun";
  // orient: bone +Y runs along the hand; lay the barrel across the palm
  gun.rotation.set(-Math.PI / 2, 0, 0);
  gun.position.set(0, 0.07, 0.01);
  hand.add(gun);
  return gun;
}

// Reusable otter rig: cloned skeleton, idle/walk blend, hue tint.
// Drives the local third-person avatar AND remote multiplayer players.
export function OtterRig({
  hue = 0,
  look,
  weaponId = null,
  getRecoil,
  getMoving,
  getSpeed,
}: {
  hue?: number;
  look?: string; // full canvas filter; overrides hue when set
  weaponId?: string | null; // held third-person weapon, null = empty paws
  getRecoil?: () => number;
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
    Object.values(idleAnim.actions).forEach((a) => a?.reset().play());
    Object.values(walkAnim.actions).forEach((a) => a?.reset().play());
  }, [idleAnim.actions, walkAnim.actions]);

  const guns = useRef<(THREE.Group | null)[]>([null, null]);
  useEffect(() => {
    guns.current[0] = attachGun(idleScene, weaponId);
    guns.current[1] = attachGun(walkScene, weaponId);
  }, [weaponId, idleScene, walkScene]);

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
    const kick = getRecoil ? getRecoil() : 0;
    guns.current.forEach((g) => {
      if (g) g.rotation.x = -Math.PI / 2 - kick * 0.25;
    });
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
    Object.values(actions).forEach((a) => {
      a?.reset().play();
      if (a) a.time = Math.random() * 2; // desync the six bots
    });
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
  const weapon = useStore((s) => s.weapon);
  return (
    <OtterRig
      look={lookFor(character)}
      weaponId={weapon}
      getRecoil={() => feel.gunRecoil}
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
