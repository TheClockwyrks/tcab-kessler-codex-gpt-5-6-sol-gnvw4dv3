# Kessler

Kessler is a self-contained orbital demolition arcade game for the browser. Ride a deflector around a living planet, send a spinning demolition ball through three rings of derelicts, and catch the salvage they shed. Endless waves accelerate while five salvage systems continually reshape the run.

## Run locally

Requires Node.js 20 or newer.

```sh
npm ci
npm run dev
```

Open the URL Vite prints. For a production build, run `npm run build`; the complete static game is emitted to `dist/` and can be served from any static host, including under a sub-path.

## Controls

- Rotate: Left/Right arrows or A/D
- Launch: Space
- Confirm: Space or Enter
- Menu: Up/Down arrows or W/S
- Pause/resume: P or Escape

Mouse, pen, and touch operate the title and pause menus. The game field itself is keyboard-driven.

## Quality checks

Run `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test`.
