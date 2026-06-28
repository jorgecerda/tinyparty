import { app, BrowserWindow, screen, ipcMain, systemPreferences, Tray, Menu, session, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

let mainWindow = null;
let onboardingWindow = null;
let tray = null;
let currentStyle = 'spectrum';
let currentPalette = 'neon';
let hasUpdateAvailable = false;
let audioDevices = [];
let currentAudioDeviceId = 'default';


const isDev = process.argv.includes('--dev') || !app.isPackaged;

function bindLogging(win, name) {
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[${name} Console] [Level ${level}] ${message} (at ${path.basename(sourceId)}:${line})`);
  });
}

function setStyle(style) {
  currentStyle = style;
  if (mainWindow) {
    mainWindow.webContents.send('change-style', style);
  }
  updateTrayMenu();
}

function setPalette(palette) {
  currentPalette = palette;
  if (mainWindow) {
    mainWindow.webContents.send('change-palette', palette);
  }
  updateTrayMenu();
}


function updateTrayMenu() {
  if (!tray) return;

  const menuTemplate = [
    { label: `tinyparty ${version}`, enabled: false },
    { type: 'separator' },
    {
      label: 'style',
      submenu: [
        {
          label: 'spectrum',
          type: 'radio',
          checked: currentStyle === 'spectrum',
          click: () => { setStyle('spectrum'); }
        },
        {
          label: 'glow',
          type: 'radio',
          checked: currentStyle === 'glow',
          click: () => { setStyle('glow'); }
        },
        {
          label: 'mesh',
          type: 'radio',
          checked: currentStyle === 'mesh',
          click: () => { setStyle('mesh'); }
        },
        {
          label: 'retro',
          type: 'radio',
          checked: currentStyle === 'retro',
          click: () => { setStyle('retro'); }
        }
      ]
    },
    {
      label: 'color',
      submenu: [
        {
          label: 'neon',
          type: 'radio',
          checked: currentPalette === 'neon',
          click: () => { setPalette('neon'); }
        },
        {
          label: 'cyberpunk',
          type: 'radio',
          checked: currentPalette === 'cyberpunk',
          click: () => { setPalette('cyberpunk'); }
        },
        {
          label: 'inferno',
          type: 'radio',
          checked: currentPalette === 'inferno',
          click: () => { setPalette('inferno'); }
        }
      ]
    },
    {
      label: 'input',
      submenu: audioDevices.length === 0
        ? [{ label: 'no input devices', enabled: false }]
        : audioDevices.map(device => ({
            label: device.label.toLowerCase(),
            type: 'radio',
            checked: currentAudioDeviceId === device.id || (currentAudioDeviceId === 'default' && (device.id === 'default' || device.id === '')),
            click: () => {
              currentAudioDeviceId = device.id;
              if (mainWindow) {
                mainWindow.webContents.send('change-audio-device', device.id);
              }
              if (onboardingWindow) {
                onboardingWindow.webContents.send('change-audio-device', device.id);
              }
              updateTrayMenu();
            }
          }))
    },
    { type: 'separator' },
    { label: 'quit', click: () => { app.quit(); } }
  ];

  if (hasUpdateAvailable) {
    menuTemplate.push({ type: 'separator' });
    menuTemplate.push({
      label: 'update available...',
      click: () => {
        shell.openExternal('https://tp.crda.dev');
      }
    });
  }

  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
}

function createTray() {
  // macOS uses template images for dark/light theme support.
  // Windows/Linux need a standard colored icon (we fallback to the 2x template icon).
  const iconName = process.platform === 'darwin' ? 'trayTemplate.png' : 'trayTemplate@2x.png';
  const iconPath = path.join(__dirname, iconName);
  tray = new Tray(iconPath);
  tray.setToolTip('tinyparty');
  updateTrayMenu();
}

function isNewerVersion(latest, current) {
  const latestParts = latest.split('.').map(Number);
  const currentParts = current.split('.').map(Number);
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

async function checkUpdates() {
  try {
    const response = await fetch('https://api.github.com/repos/jorgecerda/tinyparty/releases/latest', {
      headers: {
        'User-Agent': 'tinyparty'
      }
    });
    if (!response.ok) return;
    const data = await response.json();
    const latestVersion = data.tag_name.replace(/^v/, '');
    if (isNewerVersion(latestVersion, version)) {
      hasUpdateAvailable = true;
      updateTrayMenu();
    }
  } catch (err) {
    console.error('Failed to check updates:', err);
  }
}


function createOnboardingWindow() {
  if (onboardingWindow) return;

  onboardingWindow = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    transparent: true,
    hasShadow: true,
    resizable: false,
    movable: true,
    focusable: true,
    alwaysOnTop: true,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  if (isDev) {
    bindLogging(onboardingWindow, 'Onboarding');
    onboardingWindow.webContents.openDevTools({ mode: 'detach' });
    onboardingWindow.loadURL('http://localhost:5173');
  } else {
    bindLogging(onboardingWindow, 'Onboarding');
    onboardingWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  onboardingWindow.on('closed', () => {
    onboardingWindow = null;
  });
}

function createVisualizerWindow() {
  if (mainWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;
  const { y: workAreaY, height: workAreaHeight } = primaryDisplay.workArea;
  
  const isMac = process.platform === 'darwin';
  const dockHeight = 160; // max height of the visualizer area (includes headroom for glow blur)
  const x = 0;
  
  // On Windows/Linux, position above the bottom taskbar if present, otherwise default to screen bottom
  const targetY = isMac ? (height - dockHeight) : (workAreaY + workAreaHeight - dockHeight);

  mainWindow = new BrowserWindow({
    width: width,
    height: dockHeight,
    x: x,
    y: targetY,
    type: isMac ? 'desktop' : 'toolbar', // 'desktop' to sit behind macOS Dock; 'toolbar' or undefined on others
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    alwaysOnTop: false, // Devs porting to Windows/Linux may need to adjust this or use native parent window hooks
    skipTaskbar: true,
    show: false, // Prevent flash/jump by creating it hidden
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required', // bypass AudioContext user gesture requirement
      backgroundThrottling: false
    }
  });

  // Make sure it ignores mouse events immediately
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.once('ready-to-show', () => {
    // Force the bounds post-creation to bypass OS workArea constraints
    mainWindow.setBounds({ x: 0, y: targetY, width: width, height: dockHeight });
    mainWindow.showInactive(); // Show without taking focus
    mainWindow.webContents.send('change-style', currentStyle);
    mainWindow.webContents.send('change-palette', currentPalette);
  });

  // Keep the window locked at the target position
  const lockPosition = () => {
    const bounds = mainWindow.getBounds();
    if (bounds.y !== targetY || bounds.width !== width || bounds.height !== dockHeight || bounds.x !== 0) {
      mainWindow.setBounds({ x: 0, y: targetY, width: width, height: dockHeight });
    }
  };

  mainWindow.on('move', lockPosition);
  mainWindow.on('resize', lockPosition);

  if (isDev) {
    bindLogging(mainWindow, 'Visualizer');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.loadURL('http://localhost:5173/#visualizer');
  } else {
    bindLogging(mainWindow, 'Visualizer');
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'), { hash: 'visualizer' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Hide Dock icon on macOS
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  // Handle microphone permission requests from the renderer
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'microphone' || permission === 'audio' || permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Handle permission checks from the renderer
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'microphone' || permission === 'audio' || permission === 'media') {
      return true;
    }
    return false;
  });

  createTray();
  checkUpdates();

  // Check microphone permissions
  let hasMicPermission = false;
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    hasMicPermission = (status === 'granted');
  } else {
    hasMicPermission = true;
  }

  if (hasMicPermission) {
    createVisualizerWindow();
  } else {
    createOnboardingWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (hasMicPermission) {
        createVisualizerWindow();
      } else {
        createOnboardingWindow();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Listener to toggle mouse event ignoring (allows click-through behavior)
ipcMain.on('set-ignore-mouse', (event, ignore) => {
  if (mainWindow) {
    if (ignore) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      mainWindow.setIgnoreMouseEvents(false);
    }
  }
});

// Onboarding is completed successfully
ipcMain.on('onboarding-complete', () => {
  if (onboardingWindow) {
    onboardingWindow.close();
  }
  createVisualizerWindow();
});

// Clean quit request from the UI/Esc key
ipcMain.on('quit-app', () => {
  app.quit();
});

// IPC Listener to receive audio input devices list from the renderer
ipcMain.on('send-audio-devices', (event, devices, activeId) => {
  console.log(`[Main Process] Received send-audio-devices. Count: ${devices.length}, ActiveId: ${activeId}`);
  audioDevices = devices;
  if (activeId) {
    currentAudioDeviceId = activeId;
  }
  updateTrayMenu();
});

// Sync visualizer state once renderer is fully loaded and ready to process messages
ipcMain.on('visualizer-ready', () => {
  if (mainWindow) {
    mainWindow.webContents.send('change-style', currentStyle);
    mainWindow.webContents.send('change-palette', currentPalette);
  }
});

// IPC Handler to request native macOS microphone access
ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      if (status === 'granted') {
        return true;
      }
      return await systemPreferences.askForMediaAccess('microphone');
    } catch (error) {
      console.error('Failed to request native media access:', error);
      return false;
    }
  }
  return true;
});
