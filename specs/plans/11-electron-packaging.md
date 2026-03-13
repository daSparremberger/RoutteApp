# Electron Packaging Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the web app as a desktop application using Electron with auto-update support.

**Architecture:** Electron main process loads the Vite-built `dist/index.html`. A preload script exposes `window.electronAPI` via contextBridge, matching the existing TypeScript definitions in `electron.d.ts`. The app already has ElectronFrame.tsx (custom titlebar), HashRouter detection, and auto-updater UI — just needs the Electron shell.

**Tech Stack:** Electron, electron-builder, electron-updater

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/electron/main.ts` | Create | Main process: window creation, IPC handlers |
| `apps/web/electron/preload.ts` | Create | contextBridge exposing electronAPI |
| `apps/web/electron/tsconfig.json` | Create | TypeScript config for electron files |
| `apps/web/package.json` | Modify | Add electron deps, scripts, builder config |

---

## Chunk 1: Electron Main Process + Preload

### Task 1: Install Electron dependencies

- [ ] **Step 1: Install**

```bash
cd apps/web && pnpm add -D electron electron-builder
pnpm add electron-updater
```

### Task 2: Create main process

**Files:**
- Create: `apps/web/electron/main.ts`

- [ ] **Step 1: Create main.ts**

```typescript
// apps/web/electron/main.ts
import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import path from "path";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window-maximized-changed", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window-maximized-changed", false);
  });
}

// Window controls
ipcMain.handle("window-minimize", () => mainWindow?.minimize());
ipcMain.handle("window-maximize-toggle", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle("window-close", () => mainWindow?.close());
ipcMain.handle("window-is-maximized", () => mainWindow?.isMaximized() ?? false);

// Auto-updater
ipcMain.handle("check-for-updates", () => {
  autoUpdater.checkForUpdates();
});
ipcMain.handle("install-update-now", () => {
  autoUpdater.quitAndInstall();
});

autoUpdater.on("checking-for-update", () => {
  mainWindow?.webContents.send("updater-status", { status: "checking" });
});
autoUpdater.on("update-available", () => {
  mainWindow?.webContents.send("updater-status", { status: "available" });
});
autoUpdater.on("update-not-available", () => {
  mainWindow?.webContents.send("updater-status", { status: "not-available" });
});
autoUpdater.on("download-progress", (progress) => {
  mainWindow?.webContents.send("updater-status", {
    status: "downloading",
    percent: progress.percent,
  });
});
autoUpdater.on("update-downloaded", () => {
  mainWindow?.webContents.send("updater-status", { status: "ready" });
});
autoUpdater.on("error", (err) => {
  mainWindow?.webContents.send("updater-status", {
    status: "error",
    message: err.message,
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/electron/main.ts
git commit -m "feat: add Electron main process with window controls and auto-updater"
```

### Task 3: Create preload script

**Files:**
- Create: `apps/web/electron/preload.ts`

Must match the existing `window.electronAPI` interface from `apps/web/src/types/electron.d.ts`.

- [ ] **Step 1: Create preload.ts**

```typescript
// apps/web/electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowMaximizeToggle: () => ipcRenderer.invoke("window-maximize-toggle"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  windowIsMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  installUpdateNow: () => ipcRenderer.invoke("install-update-now"),
  onWindowMaximizedChanged: (callback: (maximized: boolean) => void) => {
    ipcRenderer.on("window-maximized-changed", (_event, maximized) => callback(maximized));
    return () => {
      ipcRenderer.removeAllListeners("window-maximized-changed");
    };
  },
  onUpdaterStatus: (callback: (status: any) => void) => {
    ipcRenderer.on("updater-status", (_event, status) => callback(status));
    return () => {
      ipcRenderer.removeAllListeners("updater-status");
    };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/electron/preload.ts
git commit -m "feat: add Electron preload script with contextBridge API"
```

---

## Chunk 2: Build Configuration

### Task 4: Add tsconfig for electron files

**Files:**
- Create: `apps/web/electron/tsconfig.json`

- [ ] **Step 1: Create tsconfig**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "../dist-electron",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["*.ts"]
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/electron/tsconfig.json
git commit -m "feat: add electron tsconfig"
```

### Task 5: Update package.json with electron scripts and builder config

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add main entry and scripts**

Add to `package.json`:

```json
{
  "main": "dist-electron/main.js",
  "scripts": {
    "electron:compile": "tsc -p electron/tsconfig.json",
    "electron:dev": "pnpm build && pnpm electron:compile && electron .",
    "electron:build": "pnpm build && pnpm electron:compile && electron-builder"
  }
}
```

- [ ] **Step 2: Add electron-builder config**

Add `"build"` section to `package.json`:

```json
{
  "build": {
    "appId": "com.rotavans.app",
    "productName": "RotaVans",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "public/icon.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

- [ ] **Step 3: Add .gitignore entries**

Add to `apps/web/.gitignore`:

```
dist-electron/
release/
```

- [ ] **Step 4: Build electron to verify**

```bash
cd apps/web && pnpm electron:compile
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/.gitignore
git commit -m "feat: add Electron build scripts and electron-builder config"
```
