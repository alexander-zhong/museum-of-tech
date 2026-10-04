import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { ROOM_INTROS } from "../src/systems/room-intros.ts";

const apiKey = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb";
if (!apiKey) {
  console.error("Set ELEVENLABS_API_KEY in .env.local or your shell environment.");
  process.exit(1);
}
mkdirSync("public/audio", { recursive: true });
for (const [room, text] of Object.entries(ROOM_INTROS)) {
  const path = `public/audio/learn-${room}.mp3`;
  if (existsSync(path) && !process.argv.includes("--force")) {
    console.log(`Skip ${path}; use --force to regenerate.`);
    continue;
  }
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.25 } }),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok) throw new Error(`ElevenLabs returned HTTP ${response.status}`);
    if (!response.headers.get("content-type")?.startsWith("audio/")) throw new Error("Expected an audio response");
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) throw new Error("Empty audio response");
    writeFileSync(path, audio);
    console.log(`Generated ${path}`);
  } catch (error) {
    console.error(`Failed ${room}: ${error.message}`);
    process.exitCode = 1;
  }
}
