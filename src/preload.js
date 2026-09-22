const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('drakoria', {
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateStatus: (callback) => ipcRenderer.on('updates:status', (_event, status) => callback(status)),
  listGames: () => ipcRenderer.invoke('games:list'),
  getCredentials: (id) => ipcRenderer.invoke('games:credentials', id),
  saveGame: (game) => ipcRenderer.invoke('games:save', game),
  deleteGame: (id, clearSession = false) => ipcRenderer.invoke('games:delete', id, clearSession),
  getDiagnostics: () => ipcRenderer.invoke('games:diagnostics'),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  listReminders: () => ipcRenderer.invoke('reminders:list'),
  saveReminder: (reminder) => ipcRenderer.invoke('reminders:save', reminder),
  deleteReminder: (id) => ipcRenderer.invoke('reminders:delete', id),
  onRemindersChanged: (callback) => ipcRenderer.on('reminders:changed', callback),
  getNote: (gameId) => ipcRenderer.invoke('notes:get', gameId),
  saveNote: (gameId, value) => ipcRenderer.invoke('notes:save', gameId, value)
});
