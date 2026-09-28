const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { MD_EXT, buildTree, resolveInsideRoot } = require('./tree');
const { watchRoot } = require('./watch');

// Launched as: electron <appDir> <rootDir>
const root = path.resolve(process.argv.at(-1));

const isWebUrl = (url) => /^https?:\/\//i.test(url);

ipcMain.handle('tree', () => ({ rootName: path.basename(root), tree: buildTree(root) }));
ipcMain.handle('read', (_event, rel) => fs.readFileSync(resolveInsideRoot(root, rel), 'utf8'));
// Forcing nativeTheme flips prefers-color-scheme, so all CSS follows along.
ipcMain.handle('set-theme', (_event, theme) => {
  nativeTheme.themeSource = theme === 'dark' ? 'dark' : 'light';
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    title: `markopen — ${path.basename(root)}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Never let the viewer navigate away; send web links to the default browser.
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    if (isWebUrl(url)) shell.openExternal(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Keep the "markopen — dir" title instead of the page <title>.
  win.on('page-title-updated', (event) => event.preventDefault());

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Push disk changes to the page: a new tree only if it actually changed, and which markdown files changed
  // (null = unknown, re-render whatever is open).
  let lastTree = JSON.stringify(buildTree(root));
  const watcher = watchRoot(root, (paths) => {
    const tree = buildTree(root);
    const json = JSON.stringify(tree);
    if (json !== lastTree) {
      lastTree = json;
      win.webContents.send('tree-changed', tree);
    }
    win.webContents.send('files-changed', paths && paths.filter((rel) => MD_EXT.test(rel)));
  });
  win.on('closed', () => watcher.close());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
