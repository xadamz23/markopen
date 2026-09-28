const { app, BrowserWindow, Menu, ipcMain, nativeTheme, net, protocol, shell } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { MD_EXT, buildTree, flattenFiles, searchFiles, findByName, resolveInsideRoot } = require('./tree');
const { watchRoot } = require('./watch');

// Launched as: electron <appDir> <rootDir>
const root = path.resolve(process.argv.at(-1));

const isWebUrl = (url) => /^https?:\/\//i.test(url);

ipcMain.handle('tree', () => ({ rootName: path.basename(root), tree: buildTree(root) }));
ipcMain.handle('read', (_event, rel) => {
  const abs = resolveInsideRoot(root, rel);
  return { text: fs.readFileSync(abs, 'utf8'), mtime: fs.statSync(abs).mtimeMs };
});
ipcMain.handle('search', (_event, query) => searchFiles(root, flattenFiles(buildTree(root)), query));
ipcMain.handle('find-by-name', (_event, name) => findByName(root, name));
ipcMain.handle('open-in-editor', (_event, rel) => {
  const abs = resolveInsideRoot(root, rel);
  return new Promise((resolve, reject) =>
    execFile('open', ['-a', 'Visual Studio Code', abs], (err) => (err ? reject(err) : resolve())),
  );
});
ipcMain.handle('reveal', (_event, rel) => shell.showItemInFolder(resolveInsideRoot(root, rel)));
// Forcing nativeTheme flips prefers-color-scheme, so all CSS follows along.
ipcMain.handle('set-theme', (_event, theme) => {
  nativeTheme.themeSource = theme === 'dark' ? 'dark' : 'light';
});

// markopen://root/<rel> serves local files (images) from inside the opened directory only.
protocol.registerSchemesAsPrivileged([{ scheme: 'markopen', privileges: { standard: true, secure: true } }]);

// Menu items the page handles itself (it owns find, history and zoom).
const send = (action) => () => BrowserWindow.getFocusedWindow()?.webContents.send('menu', action);

function buildMenu() {
  return Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'fileMenu' },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: send('find') },
        { label: 'Find Next', accelerator: 'CmdOrCtrl+G', click: send('find-next') },
        { label: 'Find Previous', accelerator: 'CmdOrCtrl+Shift+G', click: send('find-prev') },
        { label: 'Search in Files…', accelerator: 'CmdOrCtrl+Shift+F', click: send('search') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Quick Open…', accelerator: 'CmdOrCtrl+P', click: send('quick-open') },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: send('toggle-sidebar') },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: send('zoom-in') },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: send('zoom-in'), visible: false },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: send('zoom-out') },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: send('zoom-reset') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: send('back') },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: send('forward') },
      ],
    },
    { role: 'windowMenu' },
  ]);
}

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

app.whenReady().then(() => {
  protocol.handle('markopen', (request) => {
    const rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');
    try {
      return net.fetch(pathToFileURL(resolveInsideRoot(root, rel)).href);
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
  Menu.setApplicationMenu(buildMenu());
  createWindow();
});
app.on('window-all-closed', () => app.quit());
