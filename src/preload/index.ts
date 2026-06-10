import {contextBridge, ipcRenderer} from 'electron';
import {IPC} from '../main/ipc';
import type {AgentStatus, ClassifiedStat, SiteStatus} from '../main/types';

type StatusCb = (status: AgentStatus) => void;
type StatsCb = (stats: ClassifiedStat[]) => void;
type SitesCb = (sites: SiteStatus[]) => void;

/** Lifecycle action a user can trigger on a site or the agent. */
export type LifecycleAction = 'up' | 'down' | 'restart';

/**
 * The safe surface exposed to the renderer. No Node, no ipcRenderer — just
 * typed subscriptions, action invocations, and a refresh trigger. Each `on*`
 * returns an unsubscribe function.
 */
const api = {
  onStatus(cb: StatusCb): () => void {
    const handler = (_event: unknown, status: AgentStatus): void => cb(status);
    ipcRenderer.on(IPC.status, handler);
    return () => ipcRenderer.removeListener(IPC.status, handler);
  },
  onStats(cb: StatsCb): () => void {
    const handler = (_event: unknown, stats: ClassifiedStat[]): void => cb(stats);
    ipcRenderer.on(IPC.stats, handler);
    return () => ipcRenderer.removeListener(IPC.stats, handler);
  },
  onSites(cb: SitesCb): () => void {
    const handler = (_event: unknown, sites: SiteStatus[]): void => cb(sites);
    ipcRenderer.on(IPC.sites, handler);
    return () => ipcRenderer.removeListener(IPC.sites, handler);
  },
  refresh(): void {
    ipcRenderer.send(IPC.refresh);
  },
  /** Start / stop / restart a single site by id. */
  siteAction(id: string, action: LifecycleAction): Promise<void> {
    return ipcRenderer.invoke(IPC.siteAction, {id, action});
  },
  /** Start / stop / restart the shared kiqr agent. */
  agentAction(action: LifecycleAction): Promise<void> {
    return ipcRenderer.invoke(IPC.agentAction, {action});
  },
  /** Open a URL (site or mail inbox) in the default browser. */
  openUrl(url: string): Promise<void> {
    return ipcRenderer.invoke(IPC.openUrl, {url});
  },
};

export type KiqrApi = typeof api;

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('kiqr', api);
} else {
  // Fallback for the (disabled) non-isolated case.
  (globalThis as unknown as {kiqr: KiqrApi}).kiqr = api;
}
