import {contextBridge, ipcRenderer} from 'electron';
import {IPC} from '../main/ipc';
import type {AgentStatus, ClassifiedStat} from '../main/types';

type StatusCb = (status: AgentStatus) => void;
type StatsCb = (stats: ClassifiedStat[]) => void;

/**
 * The safe surface exposed to the renderer. No Node, no ipcRenderer — just
 * typed subscriptions and a refresh trigger. Each `on*` returns an
 * unsubscribe function.
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
  refresh(): void {
    ipcRenderer.send(IPC.refresh);
  },
};

export type KiqrApi = typeof api;

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('kiqr', api);
} else {
  // Fallback for the (disabled) non-isolated case.
  (globalThis as unknown as {kiqr: KiqrApi}).kiqr = api;
}
