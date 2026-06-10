import {
  defaultExec,
  type Exec,
  getAgentStatus,
  getContainerStats,
  getSites,
} from './docker';
import type {AgentStatus, ClassifiedStat, SiteStatus} from './types';

export interface PollHandlers {
  onStatus: (status: AgentStatus) => void;
  onStats: (stats: ClassifiedStat[]) => void;
  onSites: (sites: SiteStatus[]) => void;
}

export interface PollOptions {
  intervalMs?: number;
  exec?: Exec;
  /** Overridable site fetcher (lets tests avoid real filesystem discovery). */
  getSitesFn?: (exec: Exec) => Promise<SiteStatus[]>;
}

/**
 * A polling loop that queries Docker every `intervalMs` and pushes results to
 * the supplied handlers. Returns a controller with `refresh()` (poll now) and
 * `stop()`.
 *
 * Polls never overlap: if a tick is still in flight when the timer fires, the
 * next tick is skipped. Errors are swallowed inside the docker service, so the
 * loop keeps running across a Docker restart.
 */
export function startPollLoop(
  handlers: PollHandlers,
  {intervalMs = 2000, exec = defaultExec, getSitesFn = getSites}: PollOptions = {},
) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let stopped = false;

  async function tick(): Promise<void> {
    if (inFlight || stopped) return;
    inFlight = true;
    try {
      const [status, stats, sites] = await Promise.all([
        getAgentStatus(exec),
        getContainerStats(exec),
        getSitesFn(exec),
      ]);
      if (stopped) return;
      handlers.onStatus(status);
      handlers.onStats(stats);
      handlers.onSites(sites);
    } finally {
      inFlight = false;
    }
  }

  // Fire immediately so the UI isn't blank for the first interval.
  void tick();
  timer = setInterval(() => void tick(), intervalMs);

  return {
    refresh: () => void tick(),
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
