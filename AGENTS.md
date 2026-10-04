# Repository Guidelines

## Project Structure & Module Organization

Museum of Dead Tech is a static, first-person 3D experience built with React, TypeScript, React Three Fiber, drei, and Zustand. `src/App.tsx` assembles the scene; `src/store.ts` holds shared state.

- `src/world/`: museum rendering, decor, and authoritative geometry/collision data in `layout.ts`.
- `src/player/`: movement, pointer lock, raycasting, and room tracking.
- `src/exhibits/`: self-contained exhibit components such as `Pong.tsx` and `CsRange.tsx`.
- `src/systems/`: interaction registry, narration, visual feedback, and synthesized sound.
- `src/ui/Hud.tsx` and `src/index.css`: DOM overlay and styling.
- `public/`: static assets; generated narration belongs in `public/audio/`.
- `scripts/`: narration generation. `dist/` is build output.

## Build, Test, and Development Commands

Run commands from this directory:

- `npm ci`: install dependencies from the committed lockfile.
- `npm run dev`: start the Vite development server.
- `npm run build`: run TypeScript checks and create the production bundle.
- `npm run lint`: check code with Oxlint.
- `npm run preview`: serve the production build locally after building.

## Coding Style & Naming Conventions

Match existing TypeScript: two-space indentation, double quotes, and semicolons. Use PascalCase for React components and their filenames, camelCase for functions and variables. No formatter is configured; follow nearby code and `.oxlintrc.json`.

Derive world geometry from `src/world/layout.ts`. Register exhibit interactions through `registerInteract` in an effect; use crosshair raycasting and E for activation. Keep shooting within the existing equipped, pointer-locked walk mode. Redraw canvas textures only when dirty, except active Pong gameplay. Keep exhibits theatrical rather than emulation-accurate.

## Testing Guidelines

No automated test framework, test command, or coverage threshold is configured. Run build and lint checks before submitting. Manually verify movement, wall collision, pointer lock, exhibit interactions, subtitles, and affected gameplay in the browser.

## Commit & Pull Request Guidelines

Follow the existing concise, imperative commit style, such as `Add jump and bhop movement` or `Fix shooting-range target orientation`. PRs should explain the change, link relevant issues, list validation performed, and include screenshots or recordings for visual or gameplay changes.

## Security & Configuration Tips

Narration generation requires `ELEVENLABS_API_KEY`; `ELEVENLABS_VOICE_ID` is optional. Keep credentials in environment variables. The site supports subtitles without generated audio. See `CLAUDE.md` for additional architecture notes.
