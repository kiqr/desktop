import {describe, expect, it, vi} from 'vitest';
import {
  agentAction,
  composeArgs,
  networkCreateArgs,
  restartSite,
  startSite,
  stopSite,
} from '../src/main/actions';

describe('composeArgs', () => {
  it('builds up/down/restart argv', () => {
    expect(composeArgs('/p/compose.yaml', 'up')).toEqual([
      'compose',
      '-f',
      '/p/compose.yaml',
      'up',
      '-d',
    ]);
    expect(composeArgs('/p/compose.yaml', 'down')).toEqual([
      'compose',
      '-f',
      '/p/compose.yaml',
      'down',
    ]);
    expect(composeArgs('/p/compose.yaml', 'restart')).toEqual([
      'compose',
      '-f',
      '/p/compose.yaml',
      'restart',
    ]);
  });
});

describe('networkCreateArgs', () => {
  it('defaults to the kiqr network', () => {
    expect(networkCreateArgs()).toEqual(['network', 'create', 'kiqr']);
  });
});

describe('site lifecycle', () => {
  it('startSite ensures the network, then ups the site', async () => {
    const run = vi.fn(async (_args: string[]) => {});
    await startSite('/p/compose.yaml', run);
    expect(run.mock.calls[0]?.[0]).toEqual(['network', 'create', 'kiqr']);
    expect(run.mock.calls[1]?.[0]).toEqual([
      'compose',
      '-f',
      '/p/compose.yaml',
      'up',
      '-d',
    ]);
  });

  it('startSite still ups the site when the network already exists', async () => {
    const run = vi.fn(async (args: string[]) => {
      if (args[0] === 'network') throw new Error('already exists');
    });
    await startSite('/p/compose.yaml', run);
    expect(run.mock.calls[1]?.[0]).toEqual([
      'compose',
      '-f',
      '/p/compose.yaml',
      'up',
      '-d',
    ]);
  });

  it('stopSite downs the site', async () => {
    const run = vi.fn(async (_args: string[]) => {});
    await stopSite('/p/compose.yaml', run);
    expect(run).toHaveBeenCalledWith(['compose', '-f', '/p/compose.yaml', 'down']);
  });

  it('restartSite restarts the site', async () => {
    const run = vi.fn(async (_args: string[]) => {});
    await restartSite('/p/compose.yaml', run);
    expect(run).toHaveBeenCalledWith(['compose', '-f', '/p/compose.yaml', 'restart']);
  });
});

describe('agentAction', () => {
  it('creates the network before starting, but not for down', async () => {
    const up = vi.fn(async (_args: string[]) => {});
    await agentAction('/a/compose.yaml', 'up', up);
    expect(up.mock.calls[0]?.[0]).toEqual(['network', 'create', 'kiqr']);
    expect(up.mock.calls[1]?.[0]).toEqual([
      'compose',
      '-f',
      '/a/compose.yaml',
      'up',
      '-d',
    ]);

    const down = vi.fn(async (_args: string[]) => {});
    await agentAction('/a/compose.yaml', 'down', down);
    expect(down).toHaveBeenCalledTimes(1);
    expect(down).toHaveBeenCalledWith(['compose', '-f', '/a/compose.yaml', 'down']);
  });
});
