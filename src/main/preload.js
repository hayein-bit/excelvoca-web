const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('excelvoca', {
  loadWords: () => ipcRenderer.invoke('words:load'),
  loadProgress: () => ipcRenderer.invoke('progress:load'),
  saveProgress: (data) => ipcRenderer.invoke('progress:save', data),
  loadSession: () => ipcRenderer.invoke('session:load'),
  saveSession: (data) => ipcRenderer.invoke('session:save', data),
  clearSession: () => ipcRenderer.invoke('session:clear'),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (data) => ipcRenderer.invoke('settings:save', data),
  upsertDailyLog: (row) => ipcRenderer.invoke('stats:upsertDailyLog', row)
});
