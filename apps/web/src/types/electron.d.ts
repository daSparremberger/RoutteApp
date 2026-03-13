export {};

type UpdaterStatusPayload = {
  status: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error' | 'download-progress';
  version?: string;
  message?: string;
  progress?: number;
};

declare global {
  interface Window {
    electronAPI?: {
      isDesktop: boolean;
      windowMinimize: () => Promise<void>;
      windowMaximizeToggle: () => Promise<void>;
      windowClose: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;
      installUpdateNow: () => Promise<void>;
      checkForUpdates: () => Promise<void>;
      onWindowMaximizedChanged: (callback: (isMaximized: boolean) => void) => () => void;
      onUpdaterStatus: (callback: (payload: UpdaterStatusPayload) => void) => () => void;
    };
  }
}
