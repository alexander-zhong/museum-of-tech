// Voiceover for the P-key demo tour. Standalone on purpose (no src imports).
//   ELEVENLABS_API_KEY=... npx tsx scripts/generate-demo-audio.ts
import { mkdirSync, writeFileSync } from "node:fs";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb"; // George
const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("Set ELEVENLABS_API_KEY");
  process.exit(1);
}

const LINES = [
  "This is Otter Origins — our StormHacks twenty twenty-six submission. A multiplayer museum where the history of computing is something you play — not something you read.",
  "Built in twenty-four hours with React Three Fiber. Four rooms tell the story of your computer — transistor, chip, compiler, network — with an ElevenLabs tour guide narrating every step.",
  "Room one: the transistor, nineteen forty-seven. Every room is a hands-on station — walk up, press E, and experiment. No plaques. No velvet ropes. Well — some velvet ropes.",
  "Room two: the integrated circuit. Billions of transistors learned to live on one chip. Ours just blinks dramatically — but it earns it.",
  "Room three: the compiler — where humans stopped writing ones and zeroes, and started writing bugs at a much higher level.",
  "Room four: the network, nineteen sixty-nine. Computers learned to talk. This museum speaks fluent peer-to-peer — every visitor you see is a real player.",
  "And the story lands in nineteen ninety-nine — Counter-Strike, built right here at SFU by student Minh Le. So we built him a range: six otter bots, five weapons, a thirty-second drill.",
  "This portal leads somewhere less educational.",
  "Full multiplayer deathmatch. No servers, no logins — pure peer-to-peer. Headshots, kill feeds, ragdolls, and a skin marketplace running on Solana.",
  "Otter Origins. Twenty-four hours, one museum, zero naps. History you can bunny-hop through. Thanks for watching.",
];

mkdirSync("public/audio", { recursive: true });
for (let i = 0; i < LINES.length; i++) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: LINES[i],
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35 },
    }),
  });
  if (!res.ok) {
    console.error(`demo-${i}: ${res.status} ${await res.text()}`);
    continue;
  }
  writeFileSync(`public/audio/demo-${i}.mp3`, Buffer.from(await res.arrayBuffer()));
  console.log(`wrote demo-${i}.mp3`);
}
