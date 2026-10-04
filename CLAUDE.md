# Museum of Dead Tech (StormHacks 2026)

Walkable first-person 3D museum of computing history with a sarcastic narrator.
Tracks: CSSS Legacy, Best Game, ElevenLabs, Best Design.
Full LLD: https://claude.ai/code/artifact/39267da0-9abd-463a-9f71-e5309799ccb8

## Stack
Vite + React + TypeScript, React Three Fiber + drei, Zustand. No backend; static site.

## Commands
- `npm run dev` — dev server
- `npm run build` — tsc + vite build (keep this green)
- `ELEVENLABS_API_KEY=... npx tsx scripts/generate-narration.ts` — pre-bake narrator MP3s to public/audio/ (optional; subtitles work without)
- `npx tsx scripts/fbx-to-glb.ts [file.fbx]` — convert weapon/prop FBX to .glb. Sources go in `assets/models-src/` (not deployed), output lands in `public/models/`. Reports bbox and materials; FBX is usually in centimetres, so expect to scale at the mount point.

## Architecture
- `src/world/layout.ts` — floor plan, wall AABBs, collision, room bounds. All geometry derives from WALLS/ROOMS here.
- `src/world/Museum.tsx` — walls/floor/lights rendering.
- `src/player/PlayerController.tsx` — pointer lock, WASD + collision, crosshair raycast (userData.interactId), E dispatch, room tracking, idle nag.
- `src/systems/interact.ts` — interactId -> handler/prompt registry.
- `src/systems/narration.ts` — LINES script + say(id): subtitle + optional audio. Never interrupts; non-repeatable lines play once.
- `src/exhibits/` — one file per exhibit (Pong, Eniac, Agc, Bombe, CsRange), self-contained, registered via registerInteract in useEffect.
- `src/systems/sfx.ts` — synthesized WebAudio SFX (gunshot, hit, hurt, death, ding, footsteps); no audio assets.
- `src/systems/net.ts` — Trystero P2P transport only (state/shot/hit/frag actions + a handler bag).
- `src/systems/combat.ts` — PvP damage. Shooter detects the hit and sends it; the victim owns its own HP and broadcasts its own death (no server to referee). Health, kills/deaths, kill feed and respawn live here; `combatTick()` runs from PlayerController.
- `src/systems/ragdoll.ts` — death flop as a timed pose curve (no physics engine), shared by remote corpses and your own third-person body so a death looks the same from every angle. Bodies pivot at hip height, lie where they fell, and sink out before the 3s respawn.
- Remote players carry invisible body/head hitboxes (`userData.peerId` + `zone`) in `RemotePlayers.tsx` — raycasting ignores `visible`, so dead peers' hitboxes are parked on layer 1.
- CsRange: Counter-Strike / Minh Le (SFU, 1999) shooting range at the end of the corridor. Everyone spawns armed, left-click shoots via center raycast, 6 otter range bots that faceplant when hit, timed rounds with best time. Shooting is active while pointer locked + walk mode + alive.
- `src/ui/Hud.tsx` + `src/index.css` — DOM overlay, StormHacks branding (navy #101a21, orange #fc7900, blue #0278ff).

## Conventions
- Exhibits are theatrical, not emulation-accurate — keep it that way (hackathon scope).
- Interactions go through the crosshair raycast + E only; no onClick on meshes (pointer lock).
- Canvas textures redraw only when dirty (except Pong while playing).
- Rooms: ENIAC (-x near), Bombe (+x near), Pong (-x far), AGC (+x far), off a central corridor.
