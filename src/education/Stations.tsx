import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { lessons, type LessonId } from "./content";
import { ROOMS } from "../world/layout";
import { registerInteract } from "../systems/interact";
import { say } from "../systems/narration";
import { useStore } from "../store";

function Station({ id }: { id: LessonId }) {
  const lesson = lessons.find((l) => l.id === id)!;
  const room = ROOMS.find((r) => r.id === id)!;
  const west = room.maxX < 0;
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 640;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0b1720"; ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = lesson.color; ctx.fillRect(0, 0, 1024, 12);
    ctx.font = "24px monospace"; ctx.fillText(`THE EVOLUTION OF MODERN COMPUTING / 0${lessons.indexOf(lesson) + 1}`, 48, 80);
    ctx.font = "bold 64px monospace"; ctx.fillText(lesson.name.toUpperCase(), 48, 180);
    ctx.font = "32px monospace"; ctx.fillText(lesson.date, 48, 245);
    ctx.fillStyle = "#e2ecf5"; ctx.font = "26px monospace";
    const words = lesson.question.split(" "); let line = "", y = 335;
    for (const word of words) { if (ctx.measureText(line + word).width > 900) { ctx.fillText(line, 48, y); y += 40; line = ""; } line += word + " "; }
    ctx.fillText(line, 48, y);
    ctx.fillStyle = lesson.color; ctx.font = "bold 32px monospace"; ctx.fillText("[ E ]  OPEN THE EXPERIMENT", 48, 530);
    ctx.font = "22px monospace"; ctx.fillText("Change it. Test it. Discover why it matters.", 48, 585);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [lesson]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => registerInteract(`lesson-${id}`, `E — Explore ${lesson.name}`, () => {
    if (!useStore.getState().locked || useStore.getState().lesson) return;
    useStore.getState().set({ lesson: id, buyMenu: false, subtitle: null });
    say(`learn-${id}`, true);
    document.exitPointerLock();
  }), [id, lesson.name]);
  return <group position={[west ? room.minX + 0.7 : room.maxX - 0.7, 0, (room.minZ + room.maxZ) / 2]} rotation={[0, west ? Math.PI / 2 : -Math.PI / 2, 0]}>
    <mesh position={[0, 1.5, 0]} userData={{ interactId: `lesson-${id}` }}><boxGeometry args={[4.3, 2.8, 0.45]} /><meshStandardMaterial color="#182934" metalness={0.4} roughness={0.5} /></mesh>
    <mesh position={[0, 1.65, 0.24]} userData={{ interactId: `lesson-${id}` }}><planeGeometry args={[4, 2.5]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>
  </group>;
}

function DoorMarker({ id }: { id: LessonId }) {
  const lesson = lessons.find((l) => l.id === id)!;
  const room = ROOMS.find((r) => r.id === id)!;
  const west = room.maxX < 0;
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#101a21";
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = lesson.color;
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 500, 244);
    ctx.fillStyle = lesson.color;
    ctx.font = "bold 108px monospace";
    ctx.fillText(String(lessons.indexOf(lesson) + 1).padStart(2, "0"), 30, 159);
    ctx.fillStyle = "#e5edf3";
    ctx.font = "bold 35px monospace";
    ctx.fillText(lesson.name === "Integrated circuit" ? "CHIP" : lesson.name.toUpperCase(), 190, 110);
    ctx.font = "23px monospace";
    ctx.fillText("ENTER HERE", 190, 157);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    return result;
  }, [lesson]);
  useEffect(() => () => texture.dispose(), [texture]);

  return <mesh position={[west ? -2.82 : 2.82, 2.2, room.maxZ - 3.5]} rotation={[0, west ? Math.PI / 2 : -Math.PI / 2, 0]} raycast={() => null}>
    <planeGeometry args={[1.8, 0.9]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}

export function Stations() {
  return <>{lessons.map((l) => <group key={l.id}><Station id={l.id} /><DoorMarker id={l.id} /></group>)}</>;
}
