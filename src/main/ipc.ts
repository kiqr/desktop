/** IPC channel names shared between main, preload, and renderer. */
export const IPC = {
  /** main -> renderer: an updated AgentStatus payload. */
  status: 'kiqr:status',
  /** main -> renderer: an updated ClassifiedStat[] payload. */
  stats: 'kiqr:stats',
  /** main -> renderer: an updated SiteStatus[] payload (the Sites list). */
  sites: 'kiqr:sites',
  /** renderer -> main: request an immediate poll. */
  refresh: 'kiqr:refresh',
  /** renderer -> main (invoke): start/stop/restart a site by id. */
  siteAction: 'kiqr:site-action',
  /** renderer -> main (invoke): start/stop/restart the kiqr agent. */
  agentAction: 'kiqr:agent-action',
  /** renderer -> main (invoke): open a URL in the default browser. */
  openUrl: 'kiqr:open-url',
} as const;
