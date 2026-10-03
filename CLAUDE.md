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

## Architecture
- `src/world/layout.ts` — floor plan, wall AABBs, collision, room bounds. All geometry derives from WALLS/ROOMS here.
- `src/world/Museum.tsx` — walls/floor/lights rendering.
- `src/player/PlayerController.tsx` — pointer lock, WASD + collision, crosshair raycast (userData.interactId), E dispatch, room tracking, idle nag.
- `src/systems/interact.ts` — interactId -> handler/prompt registry.
- `src/systems/narration.ts` — LINES script + say(id): subtitle + optional audio. Never interrupts; non-repeatable lines play once.
- `src/exhibits/` — one file per exhibit (Pong, Eniac, Agc, Bombe), self-contained, registered via registerInteract in useEffect.
- `src/ui/Hud.tsx` + `src/index.css` — DOM overlay, StormHacks branding (navy #101a21, orange #fc7900, blue #0278ff).

## Conventions
- Exhibits are theatrical, not emulation-accurate — keep it that way (hackathon scope).
- Interactions go through the crosshair raycast + E only; no onClick on meshes (pointer lock).
- Canvas textures redraw only when dirty (except Pong while playing).
- Rooms: ENIAC (-x near), Bombe (+x near), Pong (-x far), AGC (+x far), off a central corridor.
