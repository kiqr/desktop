import {join} from 'node:path';
import {electronApp, is, optimizer} from '@electron-toolkit/utils';
import {app, BrowserWindow, ipcMain, shell} from 'electron';
import {
  agentAction,
  type ComposeAction,
  restartSite,
  startSite,
  stopSite,
} from './actions';
import {IPC} from './ipc';
import {startPollLoop} from './poller';
import {agentComposePath, discoverProjects} from './projects';

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0e16',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return {action: 'deny'};
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.kiqr.desktop');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  const window = createWindow();

  const send = (channel: string, payload: unknown): void => {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  };

  const loop = startPollLoop({
    onStatus: (status) => send(IPC.status, status),
    onStats: (stats) => send(IPC.stats, stats),
    onSites: (sites) => send(IPC.sites, sites),
  });

  ipcMain.on(IPC.refresh, () => loop.refresh());

  // Site lifecycle: start / stop / restart a single site by id.
  ipcMain.handle(
    IPC.siteAction,
    async (_event, payload: {id: string; action: ComposeAction}) => {
      const projects = await discoverProjects();
      const project = projects.find((p) => p.id === payload.id);
      if (!project) throw new Error('Unknown site');
      if (payload.action === 'up') await startSite(project.composePath);
      else if (payload.action === 'down') await stopSite(project.composePath);
      else await restartSite(project.composePath);
      loop.refresh();
    },
  );

  // Agent lifecycle: start / stop / restart the shared proxy + splash + mail.
  ipcMain.handle(IPC.agentAction, async (_event, payload: {action: ComposeAction}) => {
    await agentAction(agentComposePath(), payload.action);
    loop.refresh();
  });

  // Open a site / inbox URL in the user's default browser.
  ipcMain.handle(IPC.openUrl, async (_event, payload: {url: string}) => {
    await shell.openExternal(payload.url);
  });

  app.on('will-quit', () => loop.stop());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
