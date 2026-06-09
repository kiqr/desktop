import path from 'node:path';
import {describe, expect, it} from 'vitest';
import YAML from 'yaml';
import {
  discoverProjects,
  kiqrDataDir,
  mapSiteStatuses,
  parseProjectCompose,
  projectDisplayName,
  titleCaseSlug,
} from '../src/main/projects';
import type {ClassifiedStat, ProjectMeta} from '../src/main/types';

const composeYaml = YAML.stringify({
  services: {
    wordpress: {
      image: 'wordpress:php8.3',
      volumes: [
        'wordpress_data:/var/www/html',
        '/home/user/middagskassen:/var/www/html/wp-content/themes/middagskassen',
      ],
      labels: [
        'traefik.enable=true',
        'traefik.http.routers.middagskassen-wp.rule=Host(`middagskassen.lvh.me`)',
      ],
    },
    mariadb: {image: 'mariadb:11.4'},
    wpcli: {image: 'wordpress:cli-php8.3', profiles: ['cli']},
    phpmyadmin: {
      image: 'phpmyadmin:5.2',
      labels: [
        'traefik.http.routers.middagskassen-pma.rule=Host(`phpmyadmin.middagskassen.lvh.me`)',
      ],
    },
  },
  networks: {kiqr: {external: true}, default: {}},
  volumes: {wordpress_data: {}, mariadb_data: {}},
});

describe('kiqrDataDir', () => {
  it('resolves per platform', () => {
    expect(kiqrDataDir('linux', {HOME: '/home/u'})).toBe(
      path.join('/home/u', '.config', 'kiqr'),
    );
    expect(kiqrDataDir('darwin', {HOME: '/Users/u'})).toBe(
      path.join('/Users/u', 'Library', 'Application Support', 'Kiqr'),
    );
    expect(kiqrDataDir('win32', {APPDATA: '/roaming'})).toBe(
      path.join('/roaming', 'Kiqr'),
    );
  });
});

describe('parseProjectCompose', () => {
  it('extracts slug, domain, theme path and services', () => {
    const parsed = parseProjectCompose(composeYaml);
    expect(parsed.slug).toBe('middagskassen');
    expect(parsed.domain).toBe('middagskassen.lvh.me');
    expect(parsed.themePath).toBe('/home/user/middagskassen');
    expect(parsed.services).toEqual(['wordpress', 'mariadb', 'phpmyadmin']);
  });

  it('ignores the phpmyadmin subdomain when picking the site domain', () => {
    expect(parseProjectCompose(composeYaml).domain).not.toContain('phpmyadmin.');
  });

  it('returns an empty result on malformed input', () => {
    const parsed = parseProjectCompose('::: not yaml :::\n  - [');
    expect(parsed.slug).toBeNull();
    expect(parsed.services).toEqual([]);
  });
});

describe('titleCaseSlug', () => {
  it('humanizes a slug', () => {
    expect(titleCaseSlug('my-cool-site')).toBe('My Cool Site');
    expect(titleCaseSlug('middagskassen')).toBe('Middagskassen');
  });
});

describe('projectDisplayName', () => {
  it('prefers the kiqr.yaml name', () => {
    expect(projectDisplayName('name: Middagskassen\n', 'middagskassen')).toBe(
      'Middagskassen',
    );
  });

  it('falls back to a humanized slug', () => {
    expect(projectDisplayName(null, 'my-cool-site')).toBe('My Cool Site');
    expect(projectDisplayName('version: 1\n', 'my-cool-site')).toBe('My Cool Site');
  });
});

describe('discoverProjects', () => {
  it('builds a project from compose + kiqr.yaml, skipping unreadable ones', async () => {
    const files: Record<string, string> = {
      '/data/projects/proj-1/compose.yaml': composeYaml,
      '/home/user/middagskassen/kiqr.yaml': 'name: Middagskassen\n',
    };
    const projects = await discoverProjects({
      dataDir: '/data',
      readDir: async () => ['proj-1', 'empty-dir'],
      readFile: async (file) => files[file] ?? null,
    });

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      id: 'proj-1',
      name: 'Middagskassen',
      domain: 'middagskassen.lvh.me',
      themePath: '/home/user/middagskassen',
      services: ['wordpress', 'mariadb', 'phpmyadmin'],
    });
  });

  it('returns an empty list when the data dir is unreadable', async () => {
    const projects = await discoverProjects({
      dataDir: '/nope',
      readDir: async () => {
        throw new Error('ENOENT');
      },
    });
    expect(projects).toEqual([]);
  });
});

describe('mapSiteStatuses', () => {
  const project: ProjectMeta = {
    id: 'proj-1',
    slug: 'middagskassen',
    name: 'Middagskassen',
    domain: 'middagskassen.lvh.me',
    themePath: '/home/user/middagskassen',
    composePath: '/data/projects/proj-1/compose.yaml',
    services: ['wordpress', 'mariadb', 'phpmyadmin'],
  };

  const stat = (name: string): ClassifiedStat => ({
    name,
    cpu: 0.1,
    cpuPerc: '10%',
    memUsage: '128MiB / 512MiB',
    mem: 0.25,
    memPerc: '25%',
    role: 'project',
    service: 'wordpress',
    project: 'middagskassen',
  });

  it('marks services running by container-name prefix and computes the URL', () => {
    const running = new Set(['proj-1-wordpress-1', 'proj-1-mariadb-1']);
    const [site] = mapSiteStatuses([project], running, [stat('proj-1-wordpress-1')]);

    expect(site.name).toBe('Middagskassen');
    expect(site.url).toBe('http://middagskassen.lvh.me:5477');
    expect(site.running).toBe(true); // wordpress is up

    const byKey = Object.fromEntries(site.services.map((s) => [s.key, s]));
    expect(byKey.wordpress.running).toBe(true);
    expect(byKey.wordpress.label).toBe('WordPress');
    expect(byKey.wordpress.cpu).toBe(0.1);
    expect(byKey.mariadb.running).toBe(true);
    expect(byKey.mariadb.label).toBe('Database');
    expect(byKey.phpmyadmin.running).toBe(false);
  });

  it('marks the site stopped when WordPress is down', () => {
    const [site] = mapSiteStatuses([project], new Set(['proj-1-mariadb-1']), []);
    expect(site.running).toBe(false);
  });
});
