import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function emitWindowState() {
  mainWindow?.webContents.send('window-maximized-changed', mainWindow?.isMaximized() ?? false);
}

function emitUpdaterStatus(payload: Record<string, unknown>) {
  mainWindow?.webContents.send('updater-status', payload);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('maximize', emitWindowState);
  mainWindow.on('unmaximize', emitWindowState);
  mainWindow.webContents.on('did-finish-load', emitWindowState);
}

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize-toggle', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.handle('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    emitUpdaterStatus({ status: 'not-available', message: 'Atualizacoes disponiveis apenas no build empacotado.' });
    return;
  }

  await autoUpdater.checkForUpdates();
});
ipcMain.handle('install-update-now', () => {
  if (app.isPackaged) {
    autoUpdater.quitAndInstall();
  }
});

autoUpdater.on('checking-for-update', () => emitUpdaterStatus({ status: 'checking' }));
autoUpdater.on('update-available', (info) => emitUpdaterStatus({ status: 'available', version: info.version }));
autoUpdater.on('update-not-available', () => emitUpdaterStatus({ status: 'not-available' }));
autoUpdater.on('download-progress', (progress) => {
  emitUpdaterStatus({
    status: 'download-progress',
    progress: progress.percent,
  });
});
autoUpdater.on('update-downloaded', (info) => {
  emitUpdaterStatus({ status: 'downloaded', version: info.version });
});
autoUpdater.on('error', (error) => {
  emitUpdaterStatus({ status: 'error', message: error.message });
});

app.whenReady().then(() => {
  createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
