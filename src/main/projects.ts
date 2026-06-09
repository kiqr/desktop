import {promises as fs} from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type {
  ClassifiedStat,
  ProjectMeta,
  ProjectServiceKey,
  ServiceStatus,
  SiteStatus,
} from './types';

/** The port the kiqr agent (Traefik) serves every site on. */
export const KIQR_PORT = 5477;

/** Friendly, human labels for each service — no jargon, no container ids. */
export const SERVICE_LABELS: Record<ProjectServiceKey, string> = {
  wordpress: 'WordPress',
  mariadb: 'Database',
  phpmyadmin: 'phpMyAdmin',
};

/**
 * Discovers the local kiqr "sites" (projects) from the CLI's data directory
 * and reads human-friendly metadata (name, domain) out of each one — so the
 * UI can show "Middagskassen · middagskassen.lvh.me" instead of a UUID.
 *
 * Mirrors the layout produced by `@kiqr/cli`:
 *   <dataDir>/projects/<project_id>/compose.yaml   (generated docker-compose)
 *   <dataDir>/traefik/compose.yaml                 (the shared kiqr agent)
 * and the project's committed `kiqr.yaml` (which holds the display name) lives
 * at the theme path that compose bind-mounts into the WordPress container.
 *
 * All parsing is in pure functions so it's unit-testable without a filesystem.
 */

/** The kiqr-managed services a site cares about (wpcli is a CLI helper, hidden). */
const KNOWN_SERVICES: ProjectServiceKey[] = ['wordpress', 'mariadb', 'phpmyadmin'];

/** Resolve the kiqr data directory the same way the CLI does, per platform. */
export function kiqrDataDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  switch (platform) {
    case 'darwin': {
      const home = env.HOME;
      if (!home) throw new Error('HOME is not set');
      return path.join(home, 'Library', 'Application Support', 'Kiqr');
    }
    case 'win32': {
      const appData = env.APPDATA;
      if (!appData) throw new Error('APPDATA is not set');
      return path.join(appData, 'Kiqr');
    }
    default: {
      const home = env.HOME;
      if (!home) throw new Error('HOME is not set');
      return path.join(home, '.config', 'kiqr');
    }
  }
}

/** Parsed bits of a project's generated compose.yaml. */
export interface ParsedCompose {
  slug: string | null;
  domain: string | null;
  themePath: string | null;
  services: ProjectServiceKey[];
}

/**
 * Extract the site's slug, public domain, theme path and service set from a
 * project compose.yaml. The WordPress service carries a Traefik
 * `Host(`<slug>.lvh.me`)` label (phpMyAdmin gets `phpmyadmin.<slug>.lvh.me`),
 * and bind-mounts the theme at `…/wp-content/themes/<slug>`.
 */
export function parseProjectCompose(yamlText: string): ParsedCompose {
  const empty: ParsedCompose = {
    slug: null,
    domain: null,
    themePath: null,
    services: [],
  };

  let doc: unknown;
  try {
    doc = YAML.parse(yamlText);
  } catch {
    return empty;
  }
  const services = (doc as {services?: Record<string, unknown>})?.services;
  if (!services || typeof services !== 'object') return empty;

  const present = KNOWN_SERVICES.filter((key) => key in services);

  const wp = services.wordpress as {labels?: unknown; volumes?: unknown} | undefined;

  // Domain: the WordPress router's Host(...) — the one that is NOT the
  // phpmyadmin.* subdomain.
  let domain: string | null = null;
  const labels = Array.isArray(wp?.labels) ? (wp?.labels as unknown[]) : [];
  for (const label of labels) {
    const match = String(label).match(/Host\(`([^`]+)`\)/);
    const host = match?.[1];
    if (host && !host.startsWith('phpmyadmin.')) {
      domain = host;
      break;
    }
  }

  const slug = domain ? domain.replace(/\.lvh\.me$/, '') : null;

  // Theme path: the bind-mount that targets wp-content/themes/<slug>.
  let themePath: string | null = null;
  const volumes = Array.isArray(wp?.volumes) ? (wp?.volumes as unknown[]) : [];
  for (const vol of volumes) {
    const text = String(vol);
    const idx = text.indexOf(':/var/www/html/wp-content/themes/');
    if (idx > 0) {
      themePath = text.slice(0, idx);
      break;
    }
  }

  return {slug, domain, themePath, services: present};
}

/** Title-case a slug as a fallback display name: `my-cool-site` -> `My Cool Site`. */
export function titleCaseSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Pick the friendliest display name: the `name` from the project's committed
 * `kiqr.yaml`, falling back to a title-cased slug.
 */
export function projectDisplayName(kiqrYamlText: string | null, slug: string): string {
  if (kiqrYamlText) {
    try {
      const parsed = YAML.parse(kiqrYamlText) as {name?: unknown} | null;
      const name = parsed?.name;
      if (typeof name === 'string' && name.trim()) return name.trim();
    } catch {
      // fall through to the slug
    }
  }
  return titleCaseSlug(slug);
}

/** Injected so discovery is testable without touching the real filesystem. */
export interface DiscoverDeps {
  dataDir?: string;
  readDir?: (dir: string) => Promise<string[]>;
  readFile?: (file: string) => Promise<string | null>;
}

async function safeReadFile(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Walk `<dataDir>/projects/*` and build a {@link ProjectMeta} per site. Never
 * throws: an unreadable data dir or a malformed project is skipped.
 */
export async function discoverProjects(deps: DiscoverDeps = {}): Promise<ProjectMeta[]> {
  const dataDir = deps.dataDir ?? kiqrDataDir();
  const readDir = deps.readDir ?? (async (dir) => fs.readdir(dir));
  const readFile = deps.readFile ?? safeReadFile;

  const projectsDir = path.join(dataDir, 'projects');

  let ids: string[];
  try {
    ids = await readDir(projectsDir);
  } catch {
    return [];
  }

  const projects: ProjectMeta[] = [];
  for (const id of ids) {
    const composePath = path.join(projectsDir, id, 'compose.yaml');
    const composeText = await readFile(composePath);
    if (!composeText) continue;

    const parsed = parseProjectCompose(composeText);
    if (!parsed.slug || parsed.services.length === 0) continue;

    const kiqrYaml = parsed.themePath
      ? await readFile(path.join(parsed.themePath, 'kiqr.yaml'))
      : null;

    projects.push({
      id,
      slug: parsed.slug,
      name: projectDisplayName(kiqrYaml, parsed.slug),
      domain: parsed.domain ?? `${parsed.slug}.lvh.me`,
      themePath: parsed.themePath,
      composePath,
      services: parsed.services,
    });
  }

  projects.sort((a, b) => a.name.localeCompare(b.name));
  return projects;
}

/** Absolute path to the shared kiqr agent's compose file. */
export function agentComposePath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(kiqrDataDir(platform, env), 'traefik', 'compose.yaml');
}

/**
 * Combine discovered sites with live Docker info into {@link SiteStatus}.
 *
 * A service counts as running when a running container name starts with
 * `<project_id>-<service>` (Docker Compose names them `<id>-<service>-1`).
 * Resource stats are attached when present. Pure — no Docker calls.
 */
export function mapSiteStatuses(
  projects: ProjectMeta[],
  runningNames: ReadonlySet<string>,
  stats: ClassifiedStat[],
): SiteStatus[] {
  const running = [...runningNames];

  return projects.map((project) => {
    const services: ServiceStatus[] = project.services.map((key) => {
      const prefix = `${project.id}-${key}`;
      const isRunning = running.some((name) => name.startsWith(prefix));
      const stat = stats.find((s) => s.name.startsWith(prefix));
      return {
        key,
        label: SERVICE_LABELS[key],
        running: isRunning,
        cpu: stat?.cpu,
        mem: stat?.mem,
        memUsage: stat?.memUsage,
      };
    });

    const wordpress = services.find((s) => s.key === 'wordpress');

    return {
      id: project.id,
      name: project.name,
      domain: project.domain,
      url: `http://${project.domain}:${KIQR_PORT}`,
      composePath: project.composePath,
      running: Boolean(wordpress?.running),
      services,
    };
  });
}
