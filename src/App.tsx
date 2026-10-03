import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Museum } from "./world/Museum";
import { PlayerController } from "./player/PlayerController";
import { Pong } from "./exhibits/Pong";
import { Eniac } from "./exhibits/Eniac";
import { Agc } from "./exhibits/Agc";
import { Bombe } from "./exhibits/Bombe";
import { CsRange } from "./exhibits/CsRange";
import { Hud } from "./ui/Hud";

export default function App() {
  return (
    <>
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 70, position: [0, 1.6, 0.5] }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#05060a"]} />
        <fog attach="fog" args={["#05060a", 20, 60]} />
        <Museum />
        <Pong />
        <Eniac />
        <Agc />
        <Bombe />
        <CsRange />
        <PlayerController />
        <EffectComposer>
          <Bloom intensity={0.7} luminanceThreshold={0.55} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.75} />
        </EffectComposer>
      </Canvas>
      <Hud />
    </>
  );
}
