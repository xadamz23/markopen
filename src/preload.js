const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('markopen', {
  getTree: () => ipcRenderer.invoke('tree'),
  readFile: (rel) => ipcRenderer.invoke('read', rel),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  onTreeChanged: (cb) => ipcRenderer.on('tree-changed', (_event, tree) => cb(tree)),
  onFilesChanged: (cb) => ipcRenderer.on('files-changed', (_event, paths) => cb(paths)),
});
