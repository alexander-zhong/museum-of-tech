// Pre-generates narrator audio with ElevenLabs. Run once, commit the MP3s:
//   ELEVENLABS_API_KEY=... npx tsx scripts/generate-narration.ts
// Voice: pick a dry/sardonic one and set VOICE_ID below.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { LINES } from "../src/systems/narration";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb"; // "George"
const API_KEY = process.env.ELEVENLABS_API_KEY;

if (!API_KEY) {
  console.error("Set ELEVENLABS_API_KEY");
  process.exit(1);
}

mkdirSync("public/audio", { recursive: true });

for (const [id, text] of Object.entries(LINES)) {
  const out = `public/audio/${id}.mp3`;
  if (existsSync(out)) {
    console.log(`skip ${id} (exists)`);
    continue;
  }
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.4 },
      }),
    },
  );
  if (!res.ok) {
    console.error(`${id}: ${res.status} ${await res.text()}`);
    continue;
  }
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`wrote ${out}`);
}
