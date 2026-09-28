const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('markopen', {
  getTree: () => ipcRenderer.invoke('tree'),
  readFile: (rel) => ipcRenderer.invoke('read', rel),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  search: (query) => ipcRenderer.invoke('search', query),
  findByName: (name) => ipcRenderer.invoke('find-by-name', name),
  openInEditor: (rel) => ipcRenderer.invoke('open-in-editor', rel),
  reveal: (rel) => ipcRenderer.invoke('reveal', rel),
  onMenu: (cb) => ipcRenderer.on('menu', (_event, action) => cb(action)),
  onTreeChanged: (cb) => ipcRenderer.on('tree-changed', (_event, tree) => cb(tree)),
  onFilesChanged: (cb) => ipcRenderer.on('files-changed', (_event, paths) => cb(paths)),
});
