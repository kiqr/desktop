import {describe, expect, it} from 'vitest';
import {
  classifyStat,
  type Exec,
  getAgentStatus,
  getContainerStats,
  parseAgentPs,
  parseNetworkMembers,
  parsePercent,
  parseStatsLines,
} from '../src/main/docker';

describe('parseAgentPs', () => {
  it('reports both containers running', () => {
    const out = 'kiqr-traefik\trunning\nkiqr-splash\trunning\n';
    const result = parseAgentPs(out);
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.running)).toBe(true);
  });

  it('reports one running, one absent', () => {
    const result = parseAgentPs('kiqr-traefik\trunning\n');
    const traefik = result.find((c) => c.name === 'kiqr-traefik');
    const splash = result.find((c) => c.name === 'kiqr-splash');
    expect(traefik?.running).toBe(true);
    expect(splash?.running).toBe(false);
    expect(splash?.state).toBe('absent');
  });

  it('reports none running on empty output', () => {
    const result = parseAgentPs('');
    expect(result).toHaveLength(2);
    expect(result.some((c) => c.running)).toBe(false);
  });

  it('treats a non-running state (exited) as not running', () => {
    const result = parseAgentPs('kiqr-traefik\texited\nkiqr-splash\trunning\n');
    expect(result.find((c) => c.name === 'kiqr-traefik')?.running).toBe(false);
  });

  it('tolerates blank lines and stray whitespace', () => {
    const out = '\n  kiqr-traefik\trunning  \n\n kiqr-splash\trunning\n';
    const result = parseAgentPs(out);
    expect(result.every((c) => c.running)).toBe(true);
  });
});

describe('parsePercent', () => {
  it('parses a normal percentage to a 0..1 fraction', () => {
    expect(parsePercent('12.50%')).toBeCloseTo(0.125);
  });

  it('clamps and defaults garbage to 0', () => {
    expect(parsePercent('not-a-number')).toBe(0);
    expect(parsePercent('250%')).toBe(1);
    expect(parsePercent('-5%')).toBe(0);
  });
});

describe('parseStatsLines', () => {
  const line = (obj: Record<string, unknown>): string => JSON.stringify(obj);

  it('parses valid json lines', () => {
    const out = [
      line({
        Name: 'kiqr-traefik',
        CPUPerc: '1.50%',
        MemUsage: '20MiB / 2GiB',
        MemPerc: '1.00%',
      }),
      line({
        Name: 'demo-wordpress',
        CPUPerc: '8.00%',
        MemUsage: '120MiB / 2GiB',
        MemPerc: '6.00%',
      }),
    ].join('\n');

    const result = parseStatsLines(out);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: 'kiqr-traefik',
      cpuPerc: '1.50%',
      memUsage: '20MiB / 2GiB',
    });
    expect(result[0]?.cpu).toBeCloseTo(0.015);
    expect(result[1]?.mem).toBeCloseTo(0.06);
  });

  it('skips malformed lines but keeps the good ones', () => {
    const out = [
      line({Name: 'good', CPUPerc: '2.00%', MemUsage: '1MiB / 2GiB', MemPerc: '0.10%'}),
      '{not valid json',
      '',
      line({
        Name: 'also-good',
        CPUPerc: '3.00%',
        MemUsage: '2MiB / 2GiB',
        MemPerc: '0.20%',
      }),
    ].join('\n');

    const result = parseStatsLines(out);
    expect(result.map((s) => s.name)).toEqual(['good', 'also-good']);
  });

  it('returns an empty array for empty input', () => {
    expect(parseStatsLines('')).toEqual([]);
    expect(parseStatsLines('\n\n')).toEqual([]);
  });

  it('supports the Container key as a name fallback', () => {
    const out = line({Container: 'fallback', CPUPerc: '0%', MemPerc: '0%'});
    expect(parseStatsLines(out)[0]?.name).toBe('fallback');
  });
});

describe('classifyStat', () => {
  const base = {cpuPerc: '0%', cpu: 0, memUsage: '', memPerc: '0%', mem: 0};

  it('classifies agent containers', () => {
    const c = classifyStat({...base, name: 'kiqr-traefik'});
    expect(c.role).toBe('agent');
    expect(c.service).toBe('traefik');
  });

  it('classifies prefixed project containers', () => {
    const c = classifyStat({...base, name: 'kiqr-demo-wordpress'});
    expect(c.role).toBe('project');
    expect(c.service).toBe('wordpress');
  });

  it('classifies network members even without the kiqr- prefix', () => {
    const members = new Set(['demo-mariadb']);
    const c = classifyStat({...base, name: 'demo-mariadb'}, members);
    expect(c.role).toBe('project');
    expect(c.service).toBe('mariadb');
    expect(c.project).toBe('demo');
  });

  it('classifies unrelated containers as other', () => {
    const c = classifyStat({...base, name: 'some-random-app'});
    expect(c.role).toBe('other');
  });
});

describe('parseNetworkMembers', () => {
  it('parses newline-separated names', () => {
    const members = parseNetworkMembers('demo-wordpress\ndemo-mariadb\n\n');
    expect(members.has('demo-wordpress')).toBe(true);
    expect(members.has('demo-mariadb')).toBe(true);
    expect(members.size).toBe(2);
  });
});

describe('getAgentStatus (mocked exec)', () => {
  it('returns running when both containers are up', async () => {
    const exec: Exec = async () => 'kiqr-traefik\trunning\nkiqr-splash\trunning\n';
    const status = await getAgentStatus(exec);
    expect(status.kind).toBe('running');
    expect(status.running).toBe(true);
  });

  it('returns stopped when nothing is up', async () => {
    const exec: Exec = async () => '';
    const status = await getAgentStatus(exec);
    expect(status.kind).toBe('stopped');
    expect(status.message).toContain('kiqr up');
  });

  it('returns docker-down when the daemon is unreachable', async () => {
    const exec: Exec = async () => {
      throw new Error(
        'Cannot connect to the Docker daemon at unix:///var/run/docker.sock',
      );
    };
    const status = await getAgentStatus(exec);
    expect(status.kind).toBe('docker-down');
    expect(status.message).toContain('Docker');
  });

  it('does not throw on an unexpected docker error', async () => {
    const exec: Exec = async () => {
      throw new Error('some unexpected failure');
    };
    const status = await getAgentStatus(exec);
    expect(status.kind).toBe('stopped');
    expect(status.running).toBe(false);
  });
});

describe('getContainerStats (mocked exec)', () => {
  it('returns only kiqr-related containers, classified', async () => {
    const exec: Exec = async (cmd) => {
      if (cmd.includes('network inspect')) return 'demo-mariadb\n';
      return [
        JSON.stringify({
          Name: 'kiqr-traefik',
          CPUPerc: '1%',
          MemUsage: '10MiB / 2GiB',
          MemPerc: '0.5%',
        }),
        JSON.stringify({
          Name: 'demo-mariadb',
          CPUPerc: '2%',
          MemUsage: '40MiB / 2GiB',
          MemPerc: '2%',
        }),
        JSON.stringify({
          Name: 'totally-unrelated',
          CPUPerc: '9%',
          MemUsage: '99MiB / 2GiB',
          MemPerc: '9%',
        }),
      ].join('\n');
    };

    const stats = await getContainerStats(exec);
    const names = stats.map((s) => s.name).sort();
    expect(names).toEqual(['demo-mariadb', 'kiqr-traefik']);
    expect(stats.find((s) => s.name === 'kiqr-traefik')?.role).toBe('agent');
  });

  it('returns an empty array when docker is unavailable', async () => {
    const exec: Exec = async () => {
      throw new Error('command not found: docker');
    };
    expect(await getContainerStats(exec)).toEqual([]);
  });
});
