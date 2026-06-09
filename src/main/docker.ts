import {exec} from 'node:child_process';
import {promisify} from 'node:util';
import {discoverProjects, mapSiteStatuses} from './projects';
import type {
  AgentContainer,
  AgentStatus,
  ClassifiedStat,
  ContainerRole,
  ContainerStat,
  ProjectMeta,
  SiteStatus,
} from './types';

/**
 * Docker-querying service for the kiqr agent and project containers.
 *
 * Design goals:
 * - All parsing lives in *pure* functions (`parseAgentPs`, `parseStatsLines`,
 *   `classifyStat`) that take strings and return typed objects, so they are
 *   unit-testable without a Docker daemon.
 * - The shell wrapper is injectable (`Exec`) so the async functions can be
 *   tested with a fake exec too.
 * - Nothing here throws on a missing/stopped Docker daemon; callers get a
 *   clear status object instead.
 */

/** The containers that together make up the kiqr agent. */
export const AGENT_CONTAINERS = ['kiqr-traefik', 'kiqr-splash', 'kiqr-mailpit'] as const;

/** The Docker network every kiqr container joins. */
export const KIQR_NETWORK = 'kiqr';

/** Container name prefix used by all kiqr-managed containers. */
const KIQR_PREFIX = 'kiqr-';

/**
 * Injectable command runner. Returns stdout, or rejects on failure. The real
 * implementation shells out to `docker`; tests pass a fake.
 */
export type Exec = (command: string) => Promise<string>;

const execAsync = promisify(exec);

/** Default {@link Exec} backed by the system `docker` binary. */
export const defaultExec: Exec = async (command) => {
  const {stdout} = await execAsync(command, {
    timeout: 8000,
    maxBuffer: 1024 * 1024 * 8,
  });
  return stdout;
};

/**
 * True when an error looks like "docker isn't installed" or "the daemon isn't
 * running" rather than a normal non-zero exit we can reason about.
 */
function isDockerUnavailable(err: unknown): boolean {
  const message = String((err as {message?: string})?.message ?? err).toLowerCase();
  return (
    message.includes('command not found') ||
    message.includes('not found') ||
    message.includes('enoent') ||
    message.includes('cannot connect to the docker daemon') ||
    message.includes('is the docker daemon running') ||
    message.includes('docker daemon')
  );
}

// ---------------------------------------------------------------------------
// Pure parsers
// ---------------------------------------------------------------------------

/**
 * Parse the output of
 * `docker ps --filter name=kiqr-traefik --filter name=kiqr-splash --format '{{.Names}}\t{{.State}}'`.
 *
 * Returns one {@link AgentContainer} per *expected* agent container, marking
 * any that are absent from the output as not running. Tolerant of blank lines
 * and unexpected whitespace.
 */
export function parseAgentPs(stdout: string): AgentContainer[] {
  const seen = new Map<string, string>();

  for (const raw of stdout.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const [name, state = ''] = line.split('\t');
    if (!name) continue;
    seen.set(name.trim(), state.trim().toLowerCase());
  }

  return AGENT_CONTAINERS.map((name) => {
    const state = seen.get(name) ?? 'absent';
    return {name, state, running: state === 'running'};
  });
}

/** Parse a percentage string like `"12.34%"` into a 0..1 fraction. */
export function parsePercent(value: string): number {
  const n = Number.parseFloat(String(value).replace('%', '').trim());
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n / 100));
}

/**
 * Parse the output of `docker stats --no-stream --format '{{json .}}'`.
 *
 * Each non-empty line is parsed as a standalone JSON object. Malformed lines
 * are skipped rather than throwing, so one bad line never sinks the batch.
 */
export function parseStatsLines(stdout: string): ContainerStat[] {
  const stats: ContainerStat[] = [];

  for (const raw of stdout.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const name = String(obj.Name ?? obj.Container ?? '').trim();
    if (!name) continue;

    const cpuPerc = String(obj.CPUPerc ?? '0%');
    const memPerc = String(obj.MemPerc ?? '0%');
    const memUsage = String(obj.MemUsage ?? '').trim();

    stats.push({
      name,
      cpuPerc,
      cpu: parsePercent(cpuPerc),
      memUsage,
      memPerc,
      mem: parsePercent(memPerc),
    });
  }

  return stats;
}

/**
 * Best-effort service + project derivation from a kiqr container name.
 *
 * kiqr names look like `kiqr-traefik`, `kiqr-splash`, or
 * `<project>-wordpress` / `<project>-mariadb` / `<project>-phpmyadmin` (kiqr
 * project compose projects). We match known service suffixes pragmatically.
 */
function deriveService(name: string): {service: string; project: string | null} {
  const lower = name.toLowerCase();

  if (lower === 'kiqr-traefik') return {service: 'traefik', project: null};
  if (lower === 'kiqr-splash') return {service: 'splash', project: null};
  if (lower === 'kiqr-mailpit') return {service: 'mail', project: null};

  const services = ['phpmyadmin', 'wordpress', 'mariadb', 'mysql', 'redis'];
  for (const service of services) {
    if (lower.endsWith(`-${service}`) || lower.includes(`-${service}-`)) {
      const project = lower
        .replace(/^kiqr-/, '')
        .replace(new RegExp(`[-_]?${service}.*$`), '');
      return {service, project: project || null};
    }
  }

  return {service: 'container', project: null};
}

/**
 * Classify a raw {@link ContainerStat} into an agent / project / other role.
 *
 * A container counts as kiqr-related when its name starts with `kiqr-` or it
 * appears in `networkMembers` (containers attached to the kiqr network). Agent
 * containers get the `agent` role; everything else kiqr-related is a
 * `project`; the rest is `other`.
 */
export function classifyStat(
  stat: ContainerStat,
  networkMembers: ReadonlySet<string> = new Set(),
): ClassifiedStat {
  const isAgent = (AGENT_CONTAINERS as readonly string[]).includes(stat.name);
  const isKiqr =
    isAgent || stat.name.startsWith(KIQR_PREFIX) || networkMembers.has(stat.name);

  const role: ContainerRole = isAgent ? 'agent' : isKiqr ? 'project' : 'other';
  const {service, project} = deriveService(stat.name);

  return {...stat, role, service, project};
}

/** Parse the names from `docker network inspect kiqr --format ...` output. */
export function parseNetworkMembers(stdout: string): Set<string> {
  const members = new Set<string>();
  for (const raw of stdout.split('\n')) {
    const name = raw.trim();
    if (name) members.add(name);
  }
  return members;
}

// ---------------------------------------------------------------------------
// Async, exec-backed API
// ---------------------------------------------------------------------------

/**
 * Determine whether the kiqr agent is running. Never throws: a missing or
 * stopped Docker daemon resolves to a `docker-down` status.
 */
export async function getAgentStatus(exec: Exec = defaultExec): Promise<AgentStatus> {
  const cmd =
    'docker ps --filter name=kiqr-traefik --filter name=kiqr-splash ' +
    '--filter name=kiqr-mailpit ' +
    "--format '{{.Names}}\t{{.State}}'";

  try {
    const stdout = await exec(cmd);
    const containers = parseAgentPs(stdout);
    const running = containers.every((c) => c.running);
    const anyUp = containers.some((c) => c.running);

    let message: string;
    if (running) {
      message = 'The kiqr agent is up and proxying your projects.';
    } else if (anyUp) {
      message = 'The kiqr agent is partially up — try `kiqr agent restart`.';
    } else {
      message = 'Agent stopped — run `kiqr up` or `kiqr agent start`.';
    }

    return {
      kind: running ? 'running' : 'stopped',
      running,
      containers,
      message,
    };
  } catch (err) {
    if (isDockerUnavailable(err)) {
      return {
        kind: 'docker-down',
        running: false,
        containers: parseAgentPs(''),
        message: 'Docker is not running. Start Docker Desktop to continue.',
      };
    }
    // Unexpected docker error: treat as stopped but keep the detail.
    return {
      kind: 'stopped',
      running: false,
      containers: parseAgentPs(''),
      message: 'Could not read agent status from Docker.',
    };
  }
}

/** Fetch the set of container names attached to the kiqr network. */
async function getNetworkMembers(exec: Exec): Promise<Set<string>> {
  const cmd =
    `docker network inspect ${KIQR_NETWORK} ` +
    "--format '{{range .Containers}}{{.Name}}\n{{end}}'";
  try {
    return parseNetworkMembers(await exec(cmd));
  } catch {
    // Network may not exist yet (agent never started). That's fine.
    return new Set();
  }
}

/**
 * Read live container stats and classify them. Returns only kiqr-related
 * containers (agent + project). Never throws — Docker problems yield an empty
 * array, which the UI renders as an intentional empty state.
 */
export async function getContainerStats(
  exec: Exec = defaultExec,
): Promise<ClassifiedStat[]> {
  try {
    const [statsOut, networkMembers] = await Promise.all([
      exec("docker stats --no-stream --format '{{json .}}'"),
      getNetworkMembers(exec),
    ]);

    return parseStatsLines(statsOut)
      .map((stat) => classifyStat(stat, networkMembers))
      .filter((stat) => stat.role !== 'other');
  } catch {
    return [];
  }
}

/** Parse running container names from `docker ps --format '{{.Names}}'`. */
export function parseRunningNames(stdout: string): string[] {
  const names: string[] = [];
  for (const raw of stdout.split('\n')) {
    const name = raw.trim();
    if (name) names.push(name);
  }
  return names;
}

/**
 * Discover local sites and attach their live Docker status. Never throws: if
 * Docker is unavailable the sites are still listed, all marked stopped.
 */
export async function getSites(
  exec: Exec = defaultExec,
  discover: () => Promise<ProjectMeta[]> = discoverProjects,
): Promise<SiteStatus[]> {
  const projects = await discover();
  if (projects.length === 0) return [];
  try {
    const [runningOut, stats] = await Promise.all([
      exec("docker ps --format '{{.Names}}'"),
      getContainerStats(exec),
    ]);
    const running = new Set(parseRunningNames(runningOut));
    return mapSiteStatuses(projects, running, stats);
  } catch {
    return mapSiteStatuses(projects, new Set(), []);
  }
}
