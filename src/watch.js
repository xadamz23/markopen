const fs = require('node:fs');
const path = require('node:path');

const DEBOUNCE_MS = 150;
const isIgnored = (rel) => rel.split(path.sep).some((part) => part.startsWith('.') || part === 'node_modules');

// Watches the whole tree (FSEvents on macOS) and calls onChange(paths) once per burst,
// with root-relative paths, or null if the OS didn't say which file changed.
function watchRoot(root, onChange) {
  let paths = new Set();
  let unknown = false;
  let timer = null;
  const watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
    if (filename === null) unknown = true;
    else if (isIgnored(filename)) return;
    else paths.add(filename);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const batch = unknown ? null : [...paths];
      paths = new Set();
      unknown = false;
      onChange(batch);
    }, DEBOUNCE_MS);
  });
  const close = watcher.close.bind(watcher);
  watcher.close = () => {
    clearTimeout(timer);
    close();
  };
  return watcher;
}

module.exports = { watchRoot };
