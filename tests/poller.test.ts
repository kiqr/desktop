import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Exec} from '../src/main/docker';
import {startPollLoop} from '../src/main/poller';

describe('startPollLoop', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires immediately and pushes status + stats', async () => {
    const exec: Exec = async (cmd) => {
      if (cmd.includes('network inspect')) return '';
      if (cmd.includes('docker ps'))
        return 'kiqr-traefik\trunning\nkiqr-splash\trunning\n';
      return JSON.stringify({
        Name: 'kiqr-traefik',
        CPUPerc: '1%',
        MemUsage: '1MiB / 2GiB',
        MemPerc: '0.1%',
      });
    };

    const onStatus = vi.fn();
    const onStats = vi.fn();
    const loop = startPollLoop({onStatus, onStats}, {exec, intervalMs: 2000});

    // The loop fires one tick immediately, before the interval elapses.
    await vi.advanceTimersByTimeAsync(0);
    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(onStats).toHaveBeenCalledTimes(1);
    expect(onStatus.mock.calls[0]?.[0].kind).toBe('running');

    // And again on the next interval.
    await vi.advanceTimersByTimeAsync(2000);
    expect(onStatus).toHaveBeenCalledTimes(2);

    loop.stop();
  });

  it('stops pushing after stop()', async () => {
    const exec: Exec = async () => '';
    const onStatus = vi.fn();
    const onStats = vi.fn();
    const loop = startPollLoop({onStatus, onStats}, {exec, intervalMs: 2000});

    await vi.runOnlyPendingTimersAsync();
    const callsAfterFirst = onStatus.mock.calls.length;
    loop.stop();

    await vi.advanceTimersByTimeAsync(6000);
    expect(onStatus.mock.calls.length).toBe(callsAfterFirst);
  });
});
