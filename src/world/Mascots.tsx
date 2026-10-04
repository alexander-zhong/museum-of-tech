import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, useTexture } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
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

// The player's third-person body: Sparky, idle or walking with the real rig.
export function SparkyAvatar() {
  const idle = useGLTF("/models/sparky_idle.glb");
  const walk = useGLTF("/models/sparky_walk.glb");
  // clone so the entry-hall greeter and the player can coexist
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

  useFrame(() => {
    const moving = feel.avatarMoving;
    if (idleRef.current) idleRef.current.visible = !moving;
    if (walkRef.current) walkRef.current.visible = moving;
    const act = Object.values(walkAnim.actions)[0];
    if (act) act.timeScale = Math.min(2.4, Math.max(0.8, feel.avatarSpeed / 3.2));
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
