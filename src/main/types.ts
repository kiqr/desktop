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
