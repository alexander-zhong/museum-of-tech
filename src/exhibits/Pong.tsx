import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store";
import { say } from "../systems/narration";
import { registerInteract } from "../systems/interact";

const W = 320;
const H = 240;
const WIN = 3;

class PongGame {
  ballX = W / 2;
  ballY = H / 2;
  vx = 0;
  vy = 0;
  playerY = H / 2;
  aiY = H / 2;
  playerScore = 0;
  aiScore = 0;
  phase: "attract" | "play" | "over" = "attract";
  overAt = 0;

  start() {
    this.playerScore = 0;
    this.aiScore = 0;
    this.phase = "play";
    this.serve(1);
  }

  serve(dir: number) {
    this.ballX = W / 2;
    this.ballY = H / 2;
    this.vx = 130 * dir;
    this.vy = (Math.random() - 0.5) * 160;
  }

  update(dt: number) {
    if (this.phase === "over" && performance.now() - this.overAt > 2500) {
      this.phase = "attract";
    }
    if (this.phase !== "play") return;

    this.ballX += this.vx * dt;
    this.ballY += this.vy * dt;
    if (this.ballY < 6 || this.ballY > H - 6) this.vy *= -1;

    // AI paddle: tracks ball with capped speed so it is beatable
    const target = this.ballY;
    const maxAi = 95 * dt;
    this.aiY += Math.max(-maxAi, Math.min(maxAi, target - this.aiY));

    this.playerY = Math.max(24, Math.min(H - 24, this.playerY));
    this.aiY = Math.max(24, Math.min(H - 24, this.aiY));

    // player paddle at x=16, ai at x=W-16, half-height 24
    if (this.ballX < 22 && this.vx < 0 && Math.abs(this.ballY - this.playerY) < 28) {
      this.vx = Math.abs(this.vx) * 1.06;
      this.vy += (this.ballY - this.playerY) * 4;
    }
    if (this.ballX > W - 22 && this.vx > 0 && Math.abs(this.ballY - this.aiY) < 28) {
      this.vx = -Math.abs(this.vx) * 1.06;
      this.vy += (this.ballY - this.aiY) * 4;
    }

    if (this.ballX < -8) {
      this.aiScore++;
      this.afterPoint(1);
    } else if (this.ballX > W + 8) {
      this.playerScore++;
      this.afterPoint(-1);
    }
  }

  afterPoint(dir: number) {
    if (this.playerScore >= WIN || this.aiScore >= WIN) {
      this.phase = "over";
      this.overAt = performance.now();
      say(this.playerScore >= WIN ? "pong-win" : "pong-lose");
    } else {
      this.serve(dir);
    }
  }

  scanlines(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#061006";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#9fff9f";
    ctx.font = "16px monospace";
    if (this.phase === "attract") {
      ctx.textAlign = "center";
      ctx.font = "32px monospace";
      ctx.fillText("PONG", W / 2, 100);
      ctx.font = "13px monospace";
      ctx.fillText("PRESS  E  TO  PLAY", W / 2, 140);
      this.scanlines(ctx);
      return;
    }
    // net
    for (let y = 8; y < H; y += 16) ctx.fillRect(W / 2 - 1, y, 2, 8);
    // paddles + ball
    ctx.fillRect(12, this.playerY - 24, 6, 48);
    ctx.fillRect(W - 18, this.aiY - 24, 6, 48);
    ctx.fillRect(this.ballX - 4, this.ballY - 4, 8, 8);
    // score
    ctx.textAlign = "center";
    ctx.font = "24px monospace";
    ctx.fillText(String(this.playerScore), W / 2 - 40, 32);
    ctx.fillText(String(this.aiScore), W / 2 + 40, 32);
    if (this.phase === "over") {
      ctx.font = "20px monospace";
      ctx.fillText(
        this.playerScore >= WIN ? "YOU WIN" : "1972 WINS",
        W / 2,
        H / 2 + 40,
      );
    }
    this.scanlines(ctx);
  }
}

export function Pong() {
  const game = useRef(new PongGame());
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

  useEffect(() => {
    const unregister = registerInteract(
      "pong",
      () => (useStore.getState().mode === "pong" ? "E — step away" : "E — play Pong"),
      () => {
        const s = useStore.getState();
        if (s.mode === "walk") {
          s.set({ mode: "pong" });
          game.current.start();
          say("pong-start");
        } else {
          s.set({ mode: "walk" });
          game.current.phase = "attract";
        }
      },
    );
    const onMove = (e: MouseEvent) => {
      if (useStore.getState().mode === "pong") {
        game.current.playerY += e.movementY * 0.55;
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      unregister();
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  useFrame((_, dt) => {
    game.current.update(Math.min(dt, 0.04));
    const ctx = canvas.getContext("2d");
    if (ctx) {
      game.current.draw(ctx);
      texture.needsUpdate = true;
    }
  });

  // cabinet against west wall of the Pong room, screen facing +x
  return (
    <group position={[-12.15, 0, -20.5]} rotation={[0, Math.PI / 2, 0]}>
      <group userData={{ interactId: "pong" }}>
        {/* body */}
        <mesh position={[0, 0.95, -0.1]}>
          <boxGeometry args={[1.3, 1.9, 0.8]} />
          <meshStandardMaterial color="#23233a" roughness={0.6} />
        </mesh>
        {/* marquee */}
        <mesh position={[0, 2.0, -0.05]}>
          <boxGeometry args={[1.3, 0.3, 0.6]} />
          <meshStandardMaterial
            color="#111122"
            emissive="#3f6fff"
            emissiveIntensity={0.5}
          />
        </mesh>
        {/* screen */}
        <mesh position={[0, 1.35, 0.31]}>
          <planeGeometry args={[1.0, 0.75]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
        {/* control deck */}
        <mesh position={[0, 0.95, 0.32]} rotation={[-0.5, 0, 0]}>
          <boxGeometry args={[1.3, 0.08, 0.45]} />
          <meshStandardMaterial color="#2c2c46" />
        </mesh>
      </group>
      {/* screen glow */}
      <pointLight position={[0, 1.4, 1]} color="#66ff88" intensity={8} distance={5} />
    </group>
  );
}
