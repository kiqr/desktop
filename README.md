# KIQR Desktop

A native desktop companion for the [Kiqr CLI](https://github.com/kiqr/cli). It
lists every local WordPress site by **name and domain**, shows each one's
services at a glance, and lets you **start, stop, restart and open** them — and
the shared **kiqr agent** — without touching the terminal.

> Kiqr runs WordPress, MariaDB, and phpMyAdmin in Docker, with a shared
> background **agent** (Traefik + a splash page) proxying every project. Kiqr
> Desktop is the window into that machinery.

![Kiqr Desktop dashboard](docs/screenshot.png)

<!-- Screenshot placeholder — drop a real capture at docs/screenshot.png. -->

## What it does

- **Sites, by name** — one card per local site showing its friendly name
  (`Middagskassen`), its domain (`middagskassen.lvh.me`, click to open), and a
  status badge per dependency (WordPress · Database · phpMyAdmin). No UUIDs.
- **Manage each site** — **Start**, **Stop**, **Restart** and **Open** buttons
  per site, driven straight through `docker compose`.
- **The kiqr agent** — a strip for the shared services (Proxy · Splash ·
  **Mail**) with the same controls and a one-click **Open mail inbox**
  (`mail.lvh.me:5477`, powered by Mailpit).
- **Plain language** — "Running" / "Stopped" / "Docker not running", never raw
  container ids. Empty state nudges you to `kiqr up` instead of looking broken.

Names and domains are read from each site's generated compose + `kiqr.yaml`;
live status refreshes every ~2 seconds.

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

- `getAgentStatus()` shells out to `docker ps` filtered to the agent containers
  (`kiqr-traefik`, `kiqr-splash`, `kiqr-mailpit`) to decide whether the agent is
  up.
- `getContainerStats()` runs `docker stats --no-stream --format '{{json .}}'`,
  parses each line, and keeps only kiqr-related containers (name prefixed
  `kiqr-`, or attached to the `kiqr` Docker network).
- A poll loop runs both every ~2s and pushes the results to the renderer over
  IPC.

The string-parsing is split into pure functions (`parseAgentPs`,
`parseStatsLines`, `classifyStat`) and the shell wrapper is injectable, so the
logic is unit-tested **without** a Docker daemon. If Docker isn't installed or
the daemon is down, the service returns a clear status instead of crashing.

Sites are discovered from the CLI's data dir: `src/main/projects.ts` reads each
`projects/<id>/compose.yaml` (for the domain, theme path and services) plus the
project's `kiqr.yaml` (for the friendly name) — all in pure, tested functions.
Lifecycle actions live in `src/main/actions.ts` as pure `docker` argv builders
(`docker compose -f <file> up -d|down|restart`), spawned with `execFile` (an
argv array, never a shell string).

The renderer never touches Node or Docker directly. The preload exposes a
single sandboxed `window.kiqr` API — `onStatus` / `onStats` / `onSites`,
`refresh`, and the actions `siteAction` / `agentAction` / `openUrl` — via
`contextBridge`, with `contextIsolation` on and `nodeIntegration` off.

## Architecture

```
src/
  main/        Electron main process
    docker.ts    pure parsers + injectable exec wrapper (tested)
    projects.ts  site discovery + compose/kiqr.yaml parsing + status mapping
    actions.ts   pure docker argv builders for start/stop/restart
    poller.ts    2s poll loop -> IPC (status, stats, sites)
    ipc.ts       shared channel names
    types.ts     shared payload types
    index.ts     window, lifecycle + action handlers
  preload/     contextBridge -> window.kiqr
  renderer/    React + TypeScript dashboard (Sites + agent strip)
tests/         Vitest specs (parsers, discovery, actions — no Docker needed)
```

## Pairs with `@kiqr/cli`

The CLI creates and configures your environments; Kiqr Desktop lists, monitors
and controls them. Create your first site with the CLI:

```bash
npm install -g @kiqr/cli
cd your-theme-directory
kiqr up
```

…then drive everything from Kiqr Desktop.

## License

MIT
