const { app, BrowserWindow, ipcMain, safeStorage, session, shell, Tray, Menu, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let tray;
let isQuitting = false;
const reminderTimers = new Map();
const gameContents = new Map();

function sendUpdateStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:status', status);
}

function configureAutoUpdater() {
  if (!app.isPackaged || process.env.DRAKORIA_CAPTURE) return;
  autoUpdater.autoDownload = false;
  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => sendUpdateStatus({ state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ state: 'current' }));
  autoUpdater.on('download-progress', (progress) => sendUpdateStatus({ state: 'downloading', percent: Math.round(progress.percent) }));
  autoUpdater.on('update-downloaded', (info) => sendUpdateStatus({ state: 'ready', version: info.version }));
  autoUpdater.on('error', () => sendUpdateStatus({ state: 'error' }));
  autoUpdater.checkForUpdates().catch(() => {});
}

if (process.env.DRAKORIA_CAPTURE) app.disableHardwareAcceleration();

// Mantém dados e sessões da identidade anterior após a troca de nome do aplicativo.
const customUserData = process.env.OVELHAOHB_USER_DATA;
const currentUserData = customUserData
  ? path.resolve(customUserData)
  : path.join(app.getPath('appData'), 'OvelhaoHb Idles Hub');
const legacyUserData = path.join(app.getPath('appData'), 'drakoria-tab');
function profileHasGames(directory) {
  try {
    const games = JSON.parse(fs.readFileSync(path.join(directory, 'games.json'), 'utf8'));
    return Array.isArray(games) && games.length > 0;
  } catch {
    return false;
  }
}
const shouldMigrateProfile = !customUserData
  && profileHasGames(legacyUserData)
  && !profileHasGames(currentUserData);
if (shouldMigrateProfile) {
  try {
    fs.cpSync(legacyUserData, currentUserData, {
      recursive: true,
      force: true,
      filter: (source) => !['SingletonLock', 'SingletonCookie', 'SingletonSocket'].includes(path.basename(source))
    });
  } catch {}
}
fs.mkdirSync(currentUserData, { recursive: true });
app.setPath('userData', currentUserData);

// Mantém os loops dos jogos ativos mesmo quando a janela está minimizada ou coberta.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Limites equilibrados: evitam crescimento indefinido sem forçar downloads constantes.
app.commandLine.appendSwitch('disk-cache-size', String(96 * 1024 * 1024));
app.commandLine.appendSwitch('media-cache-size', String(32 * 1024 * 1024));

function dataFile() {
  return path.join(app.getPath('userData'), 'games.json');
}

function remindersFile() {
  return path.join(app.getPath('userData'), 'reminders.json');
}

function notesFile() {
  return path.join(app.getPath('userData'), 'game-notes.json');
}

function companionFile() {
  return path.join(app.getPath('userData'), 'game-companion.json');
}

function windowStateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function readWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'));
    if (Number.isFinite(state.width) && Number.isFinite(state.height)) return state;
  } catch {}
  return { width: 1440, height: 900 };
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isMaximized() || mainWindow.isMinimized()) return;
  try { fs.writeFileSync(windowStateFile(), JSON.stringify(mainWindow.getBounds()), 'utf8'); } catch {}
}

function readGames() {
  try {
    const games = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    return Array.isArray(games) ? games : [];
  } catch {
    return [];
  }
}

function writeGames(games) {
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  const target = dataFile();
  const temporary = `${target}.${process.pid}.tmp`;
  const backup = `${target}.bak`;
  if (fs.existsSync(target)) fs.copyFileSync(target, backup);
  fs.writeFileSync(temporary, JSON.stringify(games, null, 2), 'utf8');
  fs.renameSync(temporary, target);
}

function readReminders() {
  try {
    const reminders = JSON.parse(fs.readFileSync(remindersFile(), 'utf8'));
    return Array.isArray(reminders) ? reminders : [];
  } catch {
    return [];
  }
}

function writeReminders(reminders) {
  const target = remindersFile();
  const temporary = `${target}.${process.pid}.tmp`;
  const backup = `${target}.bak`;
  if (fs.existsSync(target)) fs.copyFileSync(target, backup);
  fs.writeFileSync(temporary, JSON.stringify(reminders, null, 2), 'utf8');
  fs.renameSync(temporary, target);
}

function readNotes() {
  try {
    const notes = JSON.parse(fs.readFileSync(notesFile(), 'utf8'));
    return notes && typeof notes === 'object' && !Array.isArray(notes) ? notes : {};
  } catch {
    return {};
  }
}

function writeNotes(notes) {
  const target = notesFile();
  const temporary = `${target}.${process.pid}.tmp`;
  const backup = `${target}.bak`;
  if (fs.existsSync(target)) fs.copyFileSync(target, backup);
  fs.writeFileSync(temporary, JSON.stringify(notes, null, 2), 'utf8');
  fs.renameSync(temporary, target);
}

function readCompanion() {
  try {
    const data = JSON.parse(fs.readFileSync(companionFile(), 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch { return {}; }
}

function writeCompanion(data) {
  const target = companionFile();
  const temporary = `${target}.${process.pid}.tmp`;
  if (fs.existsSync(target)) fs.copyFileSync(target, `${target}.bak`);
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temporary, target);
}

async function maintainCaches() {
  const marker = path.join(app.getPath('userData'), 'cache-maintenance.json');
  const week = 7 * 24 * 60 * 60 * 1000;
  let lastCleanup = 0;
  try {
    lastCleanup = JSON.parse(fs.readFileSync(marker, 'utf8')).lastCleanup || 0;
  } catch {}

  if (Date.now() - lastCleanup < week) return;

  const partitions = readGames().map((game) => `persist:game-${game.id}`);
  await Promise.allSettled([
    session.defaultSession.clearCache(),
    ...partitions.map((partition) => session.fromPartition(partition).clearCache())
  ]);
  fs.writeFileSync(marker, JSON.stringify({ lastCleanup: Date.now() }), 'utf8');
}

function encrypt(value = '') {
  if (!value) return '';
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('A criptografia segura do sistema não está disponível.');
  }
  return safeStorage.encryptString(value).toString('base64');
}

function decrypt(value = '') {
  if (!value) return '';
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return '';
  }
}

function publicGame(game) {
  return {
    id: game.id,
    name: game.name,
    url: game.url,
    hasCredentials: Boolean(game.username || game.password),
    autoFill: Boolean(game.autoFill),
    muted: Boolean(game.muted),
    keepActive: game.keepActive !== false,
    favorite: Boolean(game.favorite),
    zoomFactor: Number.isFinite(game.zoomFactor) ? game.zoomFactor : 1,
    icon: String(game.icon || ''),
    color: game.color,
    createdAt: game.createdAt
  };
}

function assertHubSender(event) {
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
    throw new Error('Solicitação não autorizada.');
  }
}

function normalizeId(value) {
  const id = String(value || '');
  if (!/^[a-zA-Z0-9-]{36}$/.test(id)) throw new Error('Identificador de jogo inválido.');
  return id;
}

function normalizeColor(value) {
  const color = String(value || '#8b5cf6');
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Cor de atalho inválida.');
  return color;
}

function normalizeZoomFactor(value) {
  const zoom = Number(value ?? 1);
  if (!Number.isFinite(zoom) || zoom < 0.5 || zoom > 2) throw new Error('Zoom inválido.');
  return Math.round(zoom * 100) / 100;
}

function normalizeReminder(input) {
  if (!input || typeof input !== 'object') throw new Error('Lembrete inválido.');
  const title = String(input.title || '').trim();
  const intervalMinutes = Number(input.intervalMinutes);
  if (!title || title.length > 80) throw new Error('Informe um lembrete de até 80 caracteres.');
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 10080) {
    throw new Error('Use um intervalo entre 1 minuto e 7 dias.');
  }
  return {
    id: input.id ? normalizeId(input.id) : crypto.randomUUID(),
    title,
    intervalMinutes,
    nextAt: Number.isFinite(Number(input.nextAt)) ? Number(input.nextAt) : Date.now() + intervalMinutes * 60 * 1000,
    createdAt: input.createdAt || new Date().toISOString()
  };
}

function clearReminderTimer(id) {
  const timer = reminderTimers.get(id);
  if (timer) clearTimeout(timer);
  reminderTimers.delete(id);
}

function scheduleReminder(reminder) {
  clearReminderTimer(reminder.id);
  const delay = Math.max(0, reminder.nextAt - Date.now());
  reminderTimers.set(reminder.id, setTimeout(() => fireReminder(reminder.id), delay));
}

function scheduleReminders() {
  readReminders().forEach(scheduleReminder);
}

function fireReminder(id) {
  const reminders = readReminders();
  const index = reminders.findIndex((reminder) => reminder.id === id);
  if (index < 0) return;
  const reminder = reminders[index];
  reminder.nextAt = Date.now() + reminder.intervalMinutes * 60 * 1000;
  writeReminders(reminders);
  scheduleReminder(reminder);
  if (Notification.isSupported()) {
    const notification = new Notification({ title: 'OvelhaoHb Idles Hub', body: reminder.title });
    notification.on('click', () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
    notification.show();
  }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('reminders:changed');
}

function normalizeUrl(raw) {
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use um endereço HTTP ou HTTPS.');
  return url.toString();
}

function registerIpc() {
  ipcMain.handle('app:version', (event) => {
    assertHubSender(event);
    return app.getVersion();
  });

  ipcMain.handle('updates:check', (event) => {
    assertHubSender(event);
    if (!app.isPackaged) return { state: 'development' };
    autoUpdater.checkForUpdates().catch(() => sendUpdateStatus({ state: 'error' }));
    return { state: 'checking' };
  });

  ipcMain.handle('updates:download', (event) => {
    assertHubSender(event);
    autoUpdater.downloadUpdate().catch(() => sendUpdateStatus({ state: 'error' }));
    return true;
  });

  ipcMain.handle('updates:install', (event) => {
    assertHubSender(event);
    isQuitting = true;
    autoUpdater.quitAndInstall();
    return true;
  });

  ipcMain.handle('backup:export', async (event) => {
    assertHubSender(event);
    const result = await dialog.showSaveDialog(mainWindow, { title: 'Exportar dados do hub', defaultPath: 'ovelhaohb-idles-hub-backup.json', filters: [{ name: 'Backup do hub', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return false;
    const backup = { format: 1, createdAt: new Date().toISOString(), games: readGames(), reminders: readReminders(), notes: readNotes() };
    fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2), 'utf8');
    return true;
  });

  ipcMain.handle('backup:import', async (event) => {
    assertHubSender(event);
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Restaurar dados do hub', properties: ['openFile'], filters: [{ name: 'Backup do hub', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return false;
    const backup = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
    if (backup?.format !== 1 || !Array.isArray(backup.games) || !Array.isArray(backup.reminders) || !backup.notes || typeof backup.notes !== 'object') throw new Error('Este arquivo não é um backup válido do hub.');
    const stamp = Date.now();
    if (fs.existsSync(dataFile())) fs.copyFileSync(dataFile(), `${dataFile()}.${stamp}.pre-restore.bak`);
    if (fs.existsSync(remindersFile())) fs.copyFileSync(remindersFile(), `${remindersFile()}.${stamp}.pre-restore.bak`);
    if (fs.existsSync(notesFile())) fs.copyFileSync(notesFile(), `${notesFile()}.${stamp}.pre-restore.bak`);
    writeGames(backup.games);
    writeReminders(backup.reminders);
    writeNotes(backup.notes);
    scheduleReminders();
    return true;
  });

  ipcMain.handle('games:list', (event) => {
    assertHubSender(event);
    return readGames().map(publicGame);
  });

  ipcMain.handle('games:credentials', (event, rawId) => {
    assertHubSender(event);
    const id = normalizeId(rawId);
    const game = readGames().find((entry) => entry.id === id);
    if (!game) throw new Error('Jogo não encontrado.');
    return { username: decrypt(game.username), password: decrypt(game.password) };
  });

  ipcMain.handle('reminders:list', (event) => {
    assertHubSender(event);
    return readReminders();
  });

  ipcMain.handle('reminders:save', (event, input) => {
    assertHubSender(event);
    const clean = normalizeReminder(input);
    const reminders = readReminders();
    const index = reminders.findIndex((reminder) => reminder.id === clean.id);
    if (index >= 0) reminders[index] = clean;
    else reminders.push(clean);
    writeReminders(reminders);
    scheduleReminder(clean);
    return clean;
  });

  ipcMain.handle('reminders:delete', (event, rawId) => {
    assertHubSender(event);
    const id = normalizeId(rawId);
    const reminders = readReminders();
    if (!reminders.some((reminder) => reminder.id === id)) throw new Error('Lembrete não encontrado.');
    writeReminders(reminders.filter((reminder) => reminder.id !== id));
    clearReminderTimer(id);
    return true;
  });

  ipcMain.handle('notes:get', (event, rawGameId) => {
    assertHubSender(event);
    const gameId = normalizeId(rawGameId);
    return String(readNotes()[gameId] || '');
  });

  ipcMain.handle('notes:save', (event, rawGameId, value) => {
    assertHubSender(event);
    const gameId = normalizeId(rawGameId);
    const note = String(value || '');
    if (note.length > 10000) throw new Error('A nota pode ter no máximo 10.000 caracteres.');
    const notes = readNotes();
    if (note.trim()) notes[gameId] = note;
    else delete notes[gameId];
    writeNotes(notes);
    return true;
  });

  ipcMain.handle('companion:get', (event, rawGameId) => {
    assertHubSender(event);
    const gameId = normalizeId(rawGameId);
    const value = readCompanion()[gameId] || {};
    return { tasks: Array.isArray(value.tasks) ? value.tasks : [], links: Array.isArray(value.links) ? value.links : [] };
  });

  ipcMain.handle('companion:save', (event, rawGameId, input) => {
    assertHubSender(event);
    const gameId = normalizeId(rawGameId);
    const tasks = Array.isArray(input?.tasks) ? input.tasks.slice(0, 100).map((task) => ({ text: String(task.text || '').trim().slice(0, 160), done: Boolean(task.done) })).filter((task) => task.text) : [];
    const links = Array.isArray(input?.links) ? input.links.slice(0, 30).map((link) => ({ label: String(link.label || '').trim().slice(0, 80), url: normalizeUrl(String(link.url || '').trim()) })).filter((link) => link.label) : [];
    const data = readCompanion();
    data[gameId] = { tasks, links };
    writeCompanion(data);
    return data[gameId];
  });

  ipcMain.handle('games:save', (event, input) => {
    assertHubSender(event);
    if (!input || typeof input !== 'object') throw new Error('Dados de jogo inválidos.');
    const games = readGames();
    const index = input.id ? games.findIndex((game) => game.id === input.id) : -1;
    const existing = index >= 0 ? games[index] : null;
    const now = new Date().toISOString();
    const clean = {
      id: input.id ? normalizeId(input.id) : crypto.randomUUID(),
      name: String(input.name || '').trim(),
      url: normalizeUrl(String(input.url || '').trim()),
      username: Object.hasOwn(input, 'username') ? encrypt(String(input.username || '')) : (existing?.username || ''),
      password: Object.hasOwn(input, 'password') ? encrypt(String(input.password || '')) : (existing?.password || ''),
      autoFill: Boolean(input.autoFill),
      muted: Boolean(input.muted),
      keepActive: input.keepActive !== false,
      favorite: Boolean(input.favorite),
      zoomFactor: normalizeZoomFactor(input.zoomFactor),
      icon: String(input.icon || ''),
      color: normalizeColor(input.color),
      createdAt: input.createdAt || now
    };
    if (!clean.name) throw new Error('Informe um nome para o jogo.');
    const savedIndex = games.findIndex((game) => game.id === clean.id);
    if (savedIndex >= 0) games[savedIndex] = clean;
    else games.push(clean);
    writeGames(games);
    return publicGame(clean);
  });

  ipcMain.handle('games:delete', async (event, rawId, clearSession = false) => {
    assertHubSender(event);
    const id = normalizeId(rawId);
    const games = readGames();
    if (!games.some((game) => game.id === id)) throw new Error('Jogo não encontrado.');
    writeGames(games.filter((game) => game.id !== id));
    if (clearSession) await session.fromPartition(`persist:game-${id}`).clearStorageData();
    return true;
  });

  ipcMain.handle('games:diagnostics', async (event) => {
    assertHubSender(event);
    const entries = await Promise.all([...gameContents.entries()].map(async ([id, contents]) => {
      try {
        const memory = await contents.getProcessMemoryInfo();
        return { id, processId: contents.getOSProcessId(), memory: memory.private || memory.residentSet || 0 };
      } catch {
        return { id, processId: null, memory: null };
      }
    }));
    return entries;
  });

  ipcMain.handle('external:open', (event, url) => {
    assertHubSender(event);
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol)) return shell.openExternal(parsed.toString());
    return false;
  });
}

function createWindow() {
  const savedBounds = readWindowState();
  mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x,
    y: savedBounds.y,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0b0b10',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0b0b10',
      symbolColor: '#a7a7b3',
      height: 42
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      backgroundThrottling: false,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Modo opcional para testes visuais automatizados da interface.
  if (process.env.DRAKORIA_CAPTURE) {
    mainWindow.webContents.once('did-finish-load', async () => {
      if (process.env.OVELHAOHB_CAPTURE_COLLAPSED) {
        await mainWindow.webContents.executeJavaScript("document.querySelector('#toggleSidebar')?.click()");
      }
      if (process.env.OVELHAOHB_TEST_TEXT_INPUT) {
        await mainWindow.webContents.executeJavaScript("document.querySelector('#welcomeAdd')?.click(); document.querySelector('#gameName')?.focus()");
        await mainWindow.webContents.insertText('Campo funcionando');
        const value = await mainWindow.webContents.executeJavaScript("document.querySelector('#gameName')?.value");
        if (value !== 'Campo funcionando') throw new Error('O teste de digitação no formulário falhou.');
      }
      if (process.env.OVELHAOHB_CAPTURE_GAME) {
        await mainWindow.webContents.executeJavaScript("document.querySelector('.game-item')?.click()");
      }
      const captureDelay = process.env.OVELHAOHB_CAPTURE_GAME ? 5000 : 1200;
      setTimeout(async () => {
        try {
          const image = await mainWindow.capturePage();
          fs.writeFileSync(path.resolve(process.env.DRAKORIA_CAPTURE), image.toPNG());
        } finally {
          app.exit(0);
        }
      }, captureDelay);
    });
  }

  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.backgroundThrottling = false;
    webPreferences.spellcheck = false;
    if (!/^https?:\/\//i.test(params.src)) params.src = 'about:blank';
  });

  mainWindow.webContents.on('did-attach-webview', (_event, contents) => {
    const gameId = String(contents.getLastWebPreferences().partition || '').replace(/^persist:game-/, '');
    if (/^[a-zA-Z0-9-]{36}$/.test(gameId)) gameContents.set(gameId, contents);
    contents.once('destroyed', () => gameContents.delete(gameId));
    contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    contents.setWindowOpenHandler(({ url }) => {
      try {
        const parsed = new URL(url);
        if (['http:', 'https:'].includes(parsed.protocol)) shell.openExternal(parsed.toString());
      } catch {}
      return { action: 'deny' };
    });

    if (process.env.OVELHAOHB_TEST_GAME_INPUT) {
      contents.once('dom-ready', () => setTimeout(async () => {
        try {
          mainWindow.show();
          mainWindow.focus();
          contents.focus();
          const found = await contents.executeJavaScript("(() => { const input = document.querySelector('input:not([type=hidden])'); if (!input) return false; input.focus(); return true; })()");
          if (!found) throw new Error('Campo do jogo não encontrado.');
          for (const character of 'teste-campo') {
            contents.sendInputEvent({ type: 'char', keyCode: character });
          }
          const value = await contents.executeJavaScript("document.querySelector('input:not([type=hidden])')?.value");
          if (value !== 'teste-campo') throw new Error('O campo do jogo não recebeu texto.');
          if (process.env.OVELHAOHB_TEST_RESULT) fs.writeFileSync(process.env.OVELHAOHB_TEST_RESULT, 'ok', 'utf8');
        } catch (error) {
          if (process.env.OVELHAOHB_TEST_RESULT) fs.writeFileSync(process.env.OVELHAOHB_TEST_RESULT, error.message, 'utf8');
        }
      }, 500));
    }
  });
}

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico');
  tray = new Tray(iconPath);
  const showWindow = () => {
    if (!mainWindow) createWindow();
    mainWindow.show();
    mainWindow.focus();
  };
  tray.setToolTip('OvelhaoHb Idles Hub');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar hub', click: showWindow },
    { type: 'separator' },
    { label: 'Sair', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', showWindow);
}

app.whenReady().then(() => {
  registerIpc();
  maintainCaches().catch(() => {});
  createWindow();
  createTray();
  scheduleReminders();
  configureAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') app.quit();
});

app.on('before-quit', () => { isQuitting = true; });
