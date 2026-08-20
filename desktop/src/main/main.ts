import {
  app,
  BrowserWindow,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
  shell,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

// Constants
const DEFAULT_ORB_WINDOW_WIDTH = 360;
const DEFAULT_ORB_WINDOW_HEIGHT = 420;
const SETTINGS_FILE_PATH = path.join(app.getPath('userData'), 'floating-assistant-settings.json');

interface UserWindowSettings {
  x?: number;
  y?: number;
  isMuted?: boolean;
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let assistantState = 'idle';
let isMutedState = false;

// Load saved position & preferences
function loadSavedSettings(): UserWindowSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const data = fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('[Desktop Main] Failed to read saved window settings:', err);
  }
  return {};
}

// Save position & preferences
function saveSettings(settings: Partial<UserWindowSettings>) {
  try {
    const current = loadSavedSettings();
    const merged = { ...current, ...settings };
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Desktop Main] Failed to save window settings:', err);
  }
}

// Calculate safe starting coordinates on primary display
function getSafeInitialPosition(saved?: UserWindowSettings): { x: number; y: number } {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  if (saved?.x !== undefined && saved?.y !== undefined) {
    const displays = screen.getAllDisplays();
    const isInsideAnyDisplay = displays.some((d) => {
      const bounds = d.bounds;
      return (
        saved.x! >= bounds.x &&
        saved.x! < bounds.x + bounds.width &&
        saved.y! >= bounds.y &&
        saved.y! < bounds.y + bounds.height
      );
    });

    if (isInsideAnyDisplay) {
      return { x: saved.x, y: saved.y };
    }
  }

  // Default: Bottom-right corner floating orb
  return {
    x: screenWidth - DEFAULT_ORB_WINDOW_WIDTH - 24,
    y: screenHeight - DEFAULT_ORB_WINDOW_HEIGHT - 24,
  };
}

// Check if dev server is ready
function checkDevServerReady(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, (res) => {
        resolve(res.statusCode === 200 || res.statusCode === 304);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(800, () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

// Poll until Vite server is ready and load URL
async function loadWithRetry(targetUrl: string, checkUrl: string, maxAttempts = 30) {
  for (let i = 1; i <= maxAttempts; i++) {
    const isReady = await checkDevServerReady(checkUrl);
    if (isReady) {
      console.log(`[Desktop Main] Dev server ready on attempt ${i}! Loading ${targetUrl}`);
      mainWindow?.loadURL(targetUrl);
      return;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  // Fallback
  console.log('[Desktop Main] Fallback loading directly...');
  mainWindow?.loadURL(targetUrl);
}

// Create the floating transparent companion window
function createFloatingWindow() {
  const savedSettings = loadSavedSettings();
  const initialPos = getSafeInitialPosition(savedSettings);

  mainWindow = new BrowserWindow({
    width: DEFAULT_ORB_WINDOW_WIDTH,
    height: DEFAULT_ORB_WINDOW_HEIGHT,
    x: initialPos.x,
    y: initialPos.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  // Save coordinates when dragged
  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    saveSettings({ x, y });
  });

  // Background mode: hide on close unless quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  const devServerBase = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const floatingUrl = `${devServerBase}?mode=floating`;

  loadWithRetry(floatingUrl, devServerBase);
}

// Generate simple programmatically generated tray icon
function createTrayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="6" fill="#0284c7" />
    <circle cx="8" cy="8" r="3" fill="#38bdf8" />
  </svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg));
}

// Initialize system tray and menu
function createSystemTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Inworld Floating AI Companion');

  const updateContextMenu = () => {
    const isVisible = mainWindow?.isVisible() ?? false;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isVisible ? 'Hide Floating Assistant' : 'Show Floating Assistant (Ctrl+Space)',
        click: () => {
          if (isVisible) {
            mainWindow?.hide();
          } else {
            showAndFocusAssistant();
          }
        },
      },
      {
        label: isMutedState ? 'Unmute Microphone' : 'Mute Microphone',
        click: () => {
          mainWindow?.webContents.send('desktop:tray-toggle-mute');
        },
      },
      { type: 'separator' },
      {
        label: 'Open Full Control Center',
        click: () => {
          shell.openExternal('http://localhost:5173');
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Assistant',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray?.setContextMenu(contextMenu);
  };

  tray.on('click', () => {
    showAndFocusAssistant();
  });

  tray.on('right-click', () => {
    updateContextMenu();
  });

  updateContextMenu();
}

// Show assistant and bring to focus
function showAndFocusAssistant() {
  if (!mainWindow) {
    createFloatingWindow();
    return;
  }

  mainWindow.show();
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
}

// Trigger shortcut activation
function triggerShortcutActivation() {
  showAndFocusAssistant();
  mainWindow?.webContents.send('desktop:global-shortcut-activated');
}

// Register Global Shortcuts
function registerGlobalShortcuts() {
  const shortcuts = ['CommandOrControl+Space', 'CommandOrControl+Shift+Space', 'Alt+Space'];

  for (const shortcut of shortcuts) {
    try {
      const success = globalShortcut.register(shortcut, () => {
        console.log(`[Desktop Main] Global shortcut triggered: ${shortcut}`);
        triggerShortcutActivation();
      });
      if (success) {
        console.log(`[Desktop Main] Registered global shortcut: ${shortcut}`);
      }
    } catch (err) {
      console.warn(`[Desktop Main] Error registering shortcut ${shortcut}:`, err);
    }
  }
}

// Set up IPC listeners
function setupIpcHandlers() {
  ipcMain.on('desktop:toggle-window', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      showAndFocusAssistant();
    }
  });

  ipcMain.on('desktop:show-window', () => {
    showAndFocusAssistant();
  });

  ipcMain.on('desktop:hide-window', () => {
    mainWindow?.hide();
  });

  ipcMain.on('desktop:move-window-by', (_, { deltaX, deltaY }: { deltaX: number; deltaY: number }) => {
    if (!mainWindow) return;
    const [curX, curY] = mainWindow.getPosition();
    mainWindow.setPosition(curX + deltaX, curY + deltaY);
  });

  ipcMain.on('desktop:open-full-web-app', () => {
    shell.openExternal('http://localhost:5173');
  });

  ipcMain.on('desktop:set-muted', (_, isMuted: boolean) => {
    isMutedState = isMuted;
  });

  ipcMain.on('desktop:set-assistant-state', (_, state: string) => {
    assistantState = state;
  });
}

// Electron App Lifecycle
app.whenReady().then(() => {
  setupIpcHandlers();
  createFloatingWindow();
  createSystemTray();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createFloatingWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Keep running in system tray
});
