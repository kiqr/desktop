# Changelog

All notable changes to **Kiqr Desktop** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Project-centric "Sites" dashboard** — every local site is listed by its
  friendly name and domain (read from its compose + `kiqr.yaml`), with a status
  badge per dependency (WordPress · Database · phpMyAdmin). No UUIDs, plain
  language ("running" / "stopped").
- **Manage deployments** — Start / Stop / Restart / Open controls per site, and
  Start / Stop / Restart for the shared kiqr agent, driven through
  `docker compose`.
- **Mailpit awareness** — the kiqr agent now includes the `kiqr-mailpit`
  container, with a one-click **Open mail inbox** (`mail.lvh.me:5477`).
- New main-process modules: `projects.ts` (site discovery + compose/`kiqr.yaml`
  parsing + status mapping) and `actions.ts` (pure `docker` argv builders),
  both unit-tested.
- `window.kiqr` gains `onSites`, `siteAction`, `agentAction`, and `openUrl`.

### Changed

- The dashboard is now sites-first. The previous agent/resource cards and CPU
  sparklines were replaced by the Sites list and a compact agent strip.

### Notes

- The live GUI and the real start/stop/restart actions require a display and a
  Docker daemon, which CI lacks — they're covered by unit tests of the pure
  discovery/parsing/command-building logic. Smoke-test with `npm run dev` and
  Docker running.
