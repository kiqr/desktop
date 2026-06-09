/**
 * Shared types describing what the main process pushes to the renderer.
 * Kept dependency-free so they can be imported from main, preload, and tests.
 */

/** A single kiqr agent container as reported by `docker ps`. */
export interface AgentContainer {
  name: string;
  /** Docker container state, e.g. `running`, `exited`, `created`. */
  state: string;
  running: boolean;
}

/** Why the agent is in its current state — drives the UI status pill. */
export type AgentStatusKind = 'running' | 'stopped' | 'docker-down';

/** Result of {@link getAgentStatus}. */
export interface AgentStatus {
  kind: AgentStatusKind;
  /** True when every expected agent container is running. */
  running: boolean;
  /** The expected agent containers and whether each is up. */
  containers: AgentContainer[];
  /** Human-readable explanation, surfaced in the UI. */
  message: string;
}

/** Parsed `docker stats` line for one container. */
export interface ContainerStat {
  name: string;
  /** CPU usage as a fraction 0..1 (parsed from e.g. "12.34%"). */
  cpu: number;
  /** Raw CPU string from docker, e.g. "12.34%". */
  cpuPerc: string;
  /** Raw memory usage string, e.g. "128MiB / 512MiB". */
  memUsage: string;
  /** Memory usage as a fraction 0..1 (parsed from e.g. "25.00%"). */
  mem: number;
  /** Raw memory percentage string, e.g. "25.00%". */
  memPerc: string;
}

/** What categories of container we surface in the dashboard. */
export type ContainerRole = 'agent' | 'project' | 'other';

export interface ClassifiedStat extends ContainerStat {
  role: ContainerRole;
  /** Best-effort service label, e.g. `wordpress`, `mariadb`, `traefik`. */
  service: string;
  /** Project slug derived from the container name, when detectable. */
  project: string | null;
}

/** The kiqr-managed services a site runs (wpcli is hidden from the UI). */
export type ProjectServiceKey = 'wordpress' | 'mariadb' | 'phpmyadmin';

/** A discovered local site, before its live (Docker) status is attached. */
export interface ProjectMeta {
  /** The project id (its data-dir folder name); never shown to the user. */
  id: string;
  /** URL slug, e.g. `middagskassen`. */
  slug: string;
  /** Friendly display name, e.g. `Middagskassen`. */
  name: string;
  /** The site's local domain, e.g. `middagskassen.lvh.me`. */
  domain: string;
  /** Absolute path to the theme repo, when known. */
  themePath: string | null;
  /** Absolute path to the generated compose file (used to start/stop the site). */
  composePath: string;
  /** Which services this site defines. */
  services: ProjectServiceKey[];
}

/** Live status of one of a site's services, ready for a status badge. */
export interface ServiceStatus {
  key: ProjectServiceKey;
  /** Friendly label, e.g. `WordPress`, `Database`, `phpMyAdmin`. */
  label: string;
  running: boolean;
  /** CPU usage 0..1, when stats are available. */
  cpu?: number;
  /** Memory usage 0..1, when stats are available. */
  mem?: number;
  /** Raw memory usage string, e.g. `128MiB / 512MiB`. */
  memUsage?: string;
}

/** A site (project) with its live status — the primary unit of the new UI. */
export interface SiteStatus {
  id: string;
  name: string;
  domain: string;
  /** Browser URL for the site (`http://<domain>:5477`). */
  url: string;
  composePath: string;
  /** True when the site's WordPress container is running. */
  running: boolean;
  services: ServiceStatus[];
}
