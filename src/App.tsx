import { Canvas } from "@react-three/fiber";
import { Museum } from "./world/Museum";
import { PlayerController } from "./player/PlayerController";
import { Pong } from "./exhibits/Pong";
import { Eniac } from "./exhibits/Eniac";
import { Agc } from "./exhibits/Agc";
import { Bombe } from "./exhibits/Bombe";
import { Hud } from "./ui/Hud";

export default function App() {
  return (
    <>
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 60, position: [0, 1.6, 0.5] }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#05060a"]} />
        <fog attach="fog" args={["#05060a", 20, 60]} />
        <Museum />
        <Pong />
        <Eniac />
        <Agc />
        <Bombe />
        <PlayerController />
      </Canvas>
      <Hud />
    </>
  );
}
