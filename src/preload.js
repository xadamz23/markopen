const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('markopen', {
  getTree: () => ipcRenderer.invoke('tree'),
  readFile: (rel) => ipcRenderer.invoke('read', rel),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
});
