const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { buildTree, resolveInsideRoot } = require('./tree');

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
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
