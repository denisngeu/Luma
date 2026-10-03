const {
  app,
  BrowserWindow,
  dialog,
  shell,
  session,
  desktopCapturer,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const config = require('./config.json');

// Gestion d'instance unique : empêche d'ouvrir plusieurs instances simultanées
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let win = null;
let tray = null;
let isQuitting = false;

function safeUrl(raw) {
  try {
    const u = new URL(raw);
    const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol === 'https:' || (isLocal && u.protocol === 'http:')) {
      return u;
    }
    return null;
  } catch {
    return null;
  }
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(async () => {
  let server = null;
  if (process.env.LUMA_URL) {
    server = safeUrl(process.env.LUMA_URL);
  } else {
    try {
      const res = await fetch('http://localhost:5173/api/chat', { method: 'HEAD', signal: AbortSignal.timeout(800) });
      if (res.status < 500) {
        server = safeUrl('http://localhost:5173');
      }
    } catch {}
    if (!server) {
      server = safeUrl(config.serverUrl);
    }
  }

  if (!server) {
    dialog.showErrorBox(
      'Configuration Luma',
      'Renseignez une adresse HTTPS ou locale dans config.json (serverUrl) ou via LUMA_URL.'
    );
    app.quit();
    return;
  }

  const trusted = new Set([
    server.origin,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://auth.openai.com',
    'https://auth0.openai.com',
    'https://chatgpt.com',
    'https://accounts.google.com',
    'https://appleid.apple.com',
    'https://login.microsoftonline.com',
  ]);

  const granted = new Set(['notifications']);

  session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => {
    const url = safeUrl(origin || wc?.getURL());
    return !!url && url.origin === server.origin && (granted.has(permission) || permission === 'notifications');
  });

  session.defaultSession.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    const url = safeUrl(details.requestingUrl || wc.getURL());
    if (!url || url.origin !== server.origin || !['media', 'display-capture', 'notifications'].includes(permission)) {
      callback(false);
      return;
    }

    if (permission === 'notifications') {
      granted.add(permission);
      callback(true);
      return;
    }

    try {
      const result = await dialog.showMessageBox(win, {
        type: 'question',
        title: 'Autorisation Luma',
        message: permission === 'media'
          ? 'Autoriser Luma à utiliser le micro ou la caméra ?'
          : 'Autoriser le partage d’écran dans cet appel ?',
        buttons: ['Refuser', 'Autoriser'],
        defaultId: 1,
        cancelId: 0,
      });

      const allowed = result.response === 1;
      if (allowed) granted.add(permission);
      callback(allowed);
    } catch {
      callback(false);
    }
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const url = safeUrl(request.frame?.url);
      if (!url || url.origin !== server.origin || !['/appel/', '/salle/'].some(p => url.pathname.startsWith(p))) {
        callback({});
        return;
      }

      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      if (!sources.length) {
        callback({});
        return;
      }

      const buttons = ['Annuler', ...sources.slice(0, 12).map((s, idx) => s.name || `Source ${idx + 1}`)];
      const selected = await dialog.showMessageBox(win, {
        type: 'question',
        title: 'Partager un écran ou une fenêtre',
        message: 'Choisissez la source à partager dans cet appel :',
        buttons,
        defaultId: 0,
        cancelId: 0,
      });

      const source = sources[selected.response - 1];
      callback(source ? { video: source } : {});
    } catch {
      callback({});
    }
  });

  function renderOfflinePage() {
    const offlineHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Luma - Connexion en attente</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f131d;
      background-image: radial-gradient(ellipse at 50% 20%, rgba(192, 193, 255, 0.08), transparent 70%);
      color: #dfe2f1;
      font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      user-select: none;
      overflow: hidden;
    }
    .card {
      background: #171b26;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 40px 36px;
      max-width: 460px;
      text-align: center;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1);
      position: relative;
    }
    .icon {
      width: 60px;
      height: 60px;
      background: rgba(192, 193, 255, 0.12);
      color: #c0c1ff;
      border: 1px solid rgba(192, 193, 255, 0.2);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 28px;
      box-shadow: 0 0 24px rgba(128, 131, 255, 0.25);
    }
    .badge {
      display: inline-block;
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-weight: 700;
      color: #c0c1ff;
      margin-bottom: 12px;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 12px; letter-spacing: -0.5px; color: #dfe2f1; }
    p { font-size: 14px; color: #c7c4d7; line-height: 1.6; margin-bottom: 28px; }
    button {
      background: #c0c1ff;
      color: #1000a9;
      border: none;
      border-radius: 12px;
      padding: 12px 28px;
      font-size: 14px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 16px rgba(192, 193, 255, 0.25);
    }
    button:hover { background: #8083ff; color: #ffffff; transform: translateY(-1px); }
    .status { margin-top: 20px; font-size: 12px; color: #908fa0; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #4edea3; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚡</div>
    <div class="badge">Luma Desktop</div>
    <h1>Connexion au serveur Luma impossible</h1>
    <p>Le serveur est temporairement inaccessible ou votre connexion Internet a été interrompue. L'application réessaie automatiquement.</p>
    <button onclick="window.location.reload()">Réessayer maintenant</button>
    <div class="status"><span class="status-dot"></span> Reconnexion programmée...</div>
  </div>
  <script>
    setTimeout(() => { window.location.reload(); }, 6000);
  </script>
</body>
</html>`;
    if (win) {
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(offlineHtml)}`);
    }
  }

  function getAppIcon() {
    const iconPath = path.join(__dirname, 'build', 'icon.png');
    if (fs.existsSync(iconPath)) {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) return img;
    }
    return null;
  }

  function createTray() {
    const appIcon = getAppIcon();
    if (!appIcon) return;

    try {
      tray = new Tray(appIcon);
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Ouvrir Luma',
          click: () => {
            if (win) {
              if (win.isMinimized()) win.restore();
              win.show();
              win.focus();
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Recharger',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (win) win.webContents.reload();
          },
        },
        {
          label: 'Outils de développement',
          click: () => {
            if (win) win.webContents.toggleDevTools();
          },
        },
        { type: 'separator' },
        {
          label: 'Quitter Luma',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]);

      tray.setToolTip('Luma Messenger');
      tray.setContextMenu(contextMenu);
      tray.on('click', () => {
        if (win) {
          if (win.isVisible()) {
            win.focus();
          } else {
            win.show();
            win.focus();
          }
        }
      });
      tray.on('double-click', () => {
        if (win) {
          win.show();
          win.focus();
        }
      });
    } catch (err) {
      console.warn('Tray initialization skipped:', err?.message);
    }
  }

  function create() {
    const preloadPath = path.join(__dirname, 'preload.cjs');
    const appIcon = getAppIcon();

    win = new BrowserWindow({
      width: 1300,
      height: 860,
      minWidth: 760,
      minHeight: 600,
      title: 'Luma',
      icon: appIcon || undefined,
      backgroundColor: '#0f131d',
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      titleBarOverlay: process.platform === 'win32' ? {
        color: '#0a0e18',
        symbolColor: '#dfe2f1',
        height: 40,
      } : false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
      },
    });

    win.once('ready-to-show', () => {
      win.show();
      win.focus();
    });

    const baseUa = win.webContents.getUserAgent();
    win.webContents.setUserAgent(`${baseUa} LumaDesktop/${app.getVersion()}`);

    win.webContents.setWindowOpenHandler(({ url }) => {
      const u = safeUrl(url);
      if (u?.origin === server.origin) {
        win.loadURL(u.href);
      } else if (u) {
        shell.openExternal(u.href);
      }
      return { action: 'deny' };
    });

    win.webContents.on('will-navigate', (event, url) => {
      const u = safeUrl(url);
      if (!u || !trusted.has(u.origin)) {
        event.preventDefault();
        if (u) shell.openExternal(u.href);
      }
    });

    win.webContents.on('will-attach-webview', (event) => event.preventDefault());

    win.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        win.webContents.toggleDevTools();
        event.preventDefault();
      } else if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
        win.webContents.reload();
        event.preventDefault();
      } else if (input.key === 'F11') {
        win.setFullScreen(!win.isFullScreen());
        event.preventDefault();
      }
    });

    win.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
      if (isMainFrame && errorCode !== -3) {
        renderOfflinePage();
      }
    });

    win.on('focus', () => {
      win.flashFrame(false);
    });

    win.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        win.hide();
      }
    });

    win.on('closed', () => {
      win = null;
    });

    win.loadURL(server.href);
  }

  ipcMain.on('luma:flash-frame', () => {
    if (win && !win.isFocused()) {
      win.flashFrame(true);
    }
  });

  ipcMain.on('luma:minimize', () => {
    if (win) win.minimize();
  });

  ipcMain.on('luma:maximize', () => {
    if (win) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  });

  ipcMain.on('luma:close', () => {
    if (win) win.close();
  });

  ipcMain.handle('luma:is-maximized', () => {
    return win ? win.isMaximized() : false;
  });

  create();
  createTray();

  app.on('activate', () => {
    if (!win) {
      create();
    } else {
      win.show();
      win.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
