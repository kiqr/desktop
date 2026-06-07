/** IPC channel names shared between main, preload, and renderer. */
export const IPC = {
  /** main -> renderer: an updated AgentStatus payload. */
  status: 'kiqr:status',
  /** main -> renderer: an updated ClassifiedStat[] payload. */
  stats: 'kiqr:stats',
  /** renderer -> main: request an immediate poll. */
  refresh: 'kiqr:refresh',
} as const;
