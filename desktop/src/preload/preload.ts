import { contextBridge, ipcRenderer } from 'electron';

// Expose safe desktop companion APIs to the floating assistant renderer
contextBridge.exposeInMainWorld('desktopApi', {
  isDesktop: true,

  // Window size and position control
  setWindowSize: (width: number, height: number) => {
    ipcRenderer.send('desktop:set-window-size', { width, height });
  },
  moveWindowBy: (deltaX: number, deltaY: number) => {
    ipcRenderer.send('desktop:move-window-by', { deltaX, deltaY });
  },
  toggleWindow: () => {
    ipcRenderer.send('desktop:toggle-window');
  },
  hideWindow: () => {
    ipcRenderer.send('desktop:hide-window');
  },
  showWindow: () => {
    ipcRenderer.send('desktop:show-window');
  },
  openFullWebApp: () => {
    ipcRenderer.send('desktop:open-full-web-app');
  },

  // State sync with system tray / main process
  setMuted: (isMuted: boolean) => {
    ipcRenderer.send('desktop:set-muted', isMuted);
  },
  setAssistantState: (state: string) => {
    ipcRenderer.send('desktop:set-assistant-state', state);
  },

  // Listeners from Main process (e.g. global shortcut triggers)
  onGlobalShortcutTriggered: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('desktop:global-shortcut-activated', listener);
    return () => {
      ipcRenderer.removeListener('desktop:global-shortcut-activated', listener);
    };
  },
  onToggleMuteFromTray: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('desktop:tray-toggle-mute', listener);
    return () => {
      ipcRenderer.removeListener('desktop:tray-toggle-mute', listener);
    };
  },
  onOpenKeyboardMode: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('desktop:open-keyboard-mode', listener);
    return () => {
      ipcRenderer.removeListener('desktop:open-keyboard-mode', listener);
    };
  },
});
