'use strict';

const path = require('node:path');
const {
  app, BrowserWindow, ipcMain, session, shell, desktopCapturer, powerSaveBlocker,
} = require('electron');
const settingsStore = require('./settings');
const { resolveChord, sanitizeText, chordEvents } = require('./keys');
const { isDiscordUrl, chromeUserAgent } = require('./origins');

// Dev-only override so the smoke test can point the app at a local fixture.
const DEV_URL = !app.isPackaged ? process.env.DISCORD_PAD_URL : undefined;
const START_URL = DEV_URL || 'https://discord.com/app';
const isAppUrl = (url) => isDiscordUrl(url) || Boolean(DEV_URL && url.startsWith(DEV_URL));
const PARTITION = 'persist:discord';
const ALLOWED_PERMISSIONS = new Set([
  'media', 'notifications', 'fullscreen', 'clipboard-sanitized-write',
  'display-capture', 'speaker-selection',
]);

let mainWindow = null;
let settings = null;
let callBlockerId = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(start);
}

app.setAppUserModelId('com.discordpad.app');
// Keep calls running when the window is in the background.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
// Allow call audio to start without a click first.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function configureSession(ses) {
  ses.setUserAgent(chromeUserAgent(ses.getUserAgent()));

  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isDiscordUrl(details.requestingUrl || wc.getURL()));
  });
  ses.setPermissionCheckHandler((wc, permission, origin) => (
    ALLOWED_PERMISSIONS.has(permission) && isDiscordUrl(origin)
  ));

  // Screen share: share the primary screen with system audio, no picker needed
  // (a picker is hard to drive from a controller).
  ses.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (!sources.length) return callback({});
      const video = sources[0];
      callback(process.platform === 'win32' ? { video, audio: 'loopback' } : { video });
    }).catch(() => callback({}));
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    fullscreen: settings.fullscreen,
    autoHideMenuBar: true,
    backgroundColor: '#313338',
    title: 'Discord Pad',
    show: false,
    webPreferences: {
      partition: PARTITION,
      preload: path.join(__dirname, '..', '..', 'dist', 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: true,
    },
  });
  mainWindow.setMenu(null);

  const wc = mainWindow.webContents;
  wc.setZoomFactor(settings.zoomFactor);
  wc.on('did-finish-load', () => wc.setZoomFactor(settings.zoomFactor));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  // Stay on Discord; everything else opens in the default browser.
  wc.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (isDiscordUrl(url)) {
      // e.g. popout windows Discord opens on its own origin; keep them in-app.
      wc.loadURL(url);
    } else {
      openExternal(url);
    }
    return { action: 'deny' };
  });

  // F11 toggles full screen for keyboard users.
  wc.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      toggleFullscreen();
    }
  });

  wc.loadURL(START_URL);
}

function openExternal(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:') shell.openExternal(url);
  } catch {
    // ignore malformed URLs
  }
}

function toggleFullscreen() {
  if (!mainWindow) return;
  settings.fullscreen = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(settings.fullscreen);
  settingsStore.save(app.getPath('userData'), settings);
}

// Only accept IPC from the main window's top frame while it shows Discord.
function fromApp(event) {
  return Boolean(
    mainWindow
    && event.sender === mainWindow.webContents
    && event.senderFrame === mainWindow.webContents.mainFrame
    && isAppUrl(event.senderFrame.url),
  );
}

function registerIpc() {
  ipcMain.handle('pad:get-settings', (event) => (fromApp(event) ? settings : null));

  ipcMain.on('pad:chord', (event, name) => {
    if (!fromApp(event)) return;
    const chord = resolveChord(name);
    if (!chord) return;
    for (const input of chordEvents(chord)) mainWindow.webContents.sendInputEvent(input);
  });

  ipcMain.on('pad:text', (event, text) => {
    if (!fromApp(event)) return;
    const clean = sanitizeText(text);
    if (clean) mainWindow.webContents.insertText(clean);
  });

  ipcMain.on('pad:toggle-fullscreen', (event) => {
    if (fromApp(event)) toggleFullscreen();
  });

  // Keep the TV awake while in a call.
  ipcMain.on('pad:in-call', (event, inCall) => {
    if (!fromApp(event)) return;
    if (inCall && callBlockerId === null) {
      callBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    } else if (!inCall && callBlockerId !== null) {
      powerSaveBlocker.stop(callBlockerId);
      callBlockerId = null;
    }
  });

  // Bring the window forward when a call comes in.
  ipcMain.on('pad:incoming-call', (event) => {
    if (!fromApp(event) || !mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.flashFrame(true);
  });
}

function start() {
  settings = settingsStore.load(app.getPath('userData'));
  configureSession(session.fromPartition(PARTITION));
  registerIpc();
  createWindow();
}

app.on('window-all-closed', () => app.quit());

// Block any other webContents (e.g. <webview>) from being created with Node.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});
