# KIQR Desktop

A native desktop companion for the [Kiqr CLI](https://github.com/kiqr/cli). It
watches your local **kiqr agent** and every WordPress dev environment it
proxies, and shows their live status and resource usage in one calm, dark
dashboard — so you always know what Docker is doing on your behalf.

> Kiqr runs WordPress, MariaDB, and phpMyAdmin in Docker, with a shared
> background **agent** (Traefik + a splash page) proxying every project. Kiqr
> Desktop is the window into that machinery.

![Kiqr Desktop dashboard](docs/screenshot.png)

<!-- Screenshot placeholder — drop a real capture at docs/screenshot.png. -->

## What it shows

- **Agent status pill** — green and pulsing when the agent is up, grey when it's
  stopped, amber when Docker itself isn't running.
- **Agent card** — the `kiqr-traefik` and `kiqr-splash` containers with live
  CPU and memory meters and a rolling CPU sparkline.
- **Projects** — a grouped card per running kiqr environment
  (WordPress / MariaDB / phpMyAdmin) with the same animated meters.
- **Intentional empty states** — when nothing's running, it tells you to
  `kiqr up` instead of looking broken.

Everything refreshes every ~2 seconds with smooth transitions.

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- The [`@kiqr/cli`](https://www.npmjs.com/package/@kiqr/cli) for actually
  spinning up environments (`kiqr up`)

## Develop

```bash
npm install
npm run dev      # electron-vite dev server with hot reload
```

`npm run dev` launches the Electron app against the dev renderer. With Docker
running and at least one `kiqr up` project active, you'll see live data; with
Docker stopped, you'll see the amber "Docker not running" state.

### Other scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | electron-vite dev (hot reload)                |
| `npm run build`     | Compile main / preload / renderer             |
| `npm run typecheck` | Strict TypeScript across node + web configs   |
| `npm test`          | Vitest unit tests for the Docker parsers      |
| `npm run lint`      | Biome check                                   |
| `npm run format`    | Biome check + autofix                         |

Packaging is configured via `electron-builder.yml` (run `electron-builder`
once you're ready to ship installers — not wired into CI).

## How it talks to Docker

All Docker access lives in the main process (`src/main/docker.ts`) and is
deliberately boring and testable:

- `getAgentStatus()` shells out to
  `docker ps --filter name=kiqr-traefik --filter name=kiqr-splash` to decide
  whether the agent is up.
- `getContainerStats()` runs `docker stats --no-stream --format '{{json .}}'`,
  parses each line, and keeps only kiqr-related containers (name prefixed
  `kiqr-`, or attached to the `kiqr` Docker network).
- A poll loop runs both every ~2s and pushes the results to the renderer over
  IPC.

The string-parsing is split into pure functions (`parseAgentPs`,
`parseStatsLines`, `classifyStat`) and the shell wrapper is injectable, so the
logic is unit-tested **without** a Docker daemon. If Docker isn't installed or
the daemon is down, the service returns a clear status instead of crashing.

The renderer never touches Node or Docker directly. The preload exposes a
single sandboxed `window.kiqr` API (`onStatus`, `onStats`, `refresh`) via
`contextBridge`, with `contextIsolation` on and `nodeIntegration` off.

## Architecture

```
src/
  main/        Electron main process
    docker.ts    pure parsers + injectable exec wrapper (tested)
    poller.ts    2s poll loop -> IPC
    ipc.ts       shared channel names
    types.ts     shared payload types
    index.ts     window + lifecycle
  preload/     contextBridge -> window.kiqr
  renderer/    React + TypeScript dashboard
tests/         Vitest specs for the parsers (no Docker needed)
```

## Pairs with `@kiqr/cli`

Kiqr Desktop is read-only today — it observes what the CLI orchestrates. Use
the CLI to drive your environments:

```bash
npm install -g @kiqr/cli
cd your-theme-directory
kiqr up
```

…then keep Kiqr Desktop open to watch it all hum.

## License

MIT
