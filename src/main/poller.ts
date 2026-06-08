import {defaultExec, type Exec, getAgentStatus, getContainerStats} from './docker';
import type {AgentStatus, ClassifiedStat} from './types';

export interface PollHandlers {
  onStatus: (status: AgentStatus) => void;
  onStats: (stats: ClassifiedStat[]) => void;
}

export interface PollOptions {
  intervalMs?: number;
  exec?: Exec;
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
  {intervalMs = 2000, exec = defaultExec}: PollOptions = {},
) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let stopped = false;

  async function tick(): Promise<void> {
    if (inFlight || stopped) return;
    inFlight = true;
    try {
      const [status, stats] = await Promise.all([
        getAgentStatus(exec),
        getContainerStats(exec),
      ]);
      if (stopped) return;
      handlers.onStatus(status);
      handlers.onStats(stats);
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
