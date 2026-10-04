import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Sparky, Gallery } from "./world/Mascots";
import { RemotePlayers } from "./world/RemotePlayers";
import { Arena, PortalGate } from "./world/Arena";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Museum } from "./world/Museum";
import { PlayerController } from "./player/PlayerController";
import { CsRange } from "./exhibits/CsRange";
import { Stations } from "./education/Stations";
import { LearningLab } from "./education/LearningLab";
import { Hud } from "./ui/Hud";
import { CanvasFallback } from "./ui/CanvasFallback";

export default function App() {
  return (
    <>
      <CanvasFallback>
        <Canvas
          camera={{ fov: 75, near: 0.1, far: 70, position: [0, 1.6, 0.5] }}
          gl={{ antialias: true }}
          dpr={[1, 1.5]}
        >
          <color attach="background" args={["#05060a"]} />
          <fog attach="fog" args={["#05060a", 20, 60]} />
          <Museum />
          <Suspense fallback={null}>
            <Sparky />
            <Gallery />
          </Suspense>
          <RemotePlayers />
          <Arena />
          {/* museum-side gate to the arena, in the CS room */}
          <PortalGate pos={[-4.3, 0, -32]} rotY={Math.PI / 2} color="#fc7900" />
          <Stations />
          <CsRange />
          <PlayerController />
          <EffectComposer>
            <Bloom intensity={0.7} luminanceThreshold={0.55} mipmapBlur />
            <Vignette eskil={false} offset={0.2} darkness={0.75} />
          </EffectComposer>
        </Canvas>
      </CanvasFallback>
      <Hud />
      <LearningLab />
    </>
  );
}
