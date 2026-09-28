const fs = require('node:fs');
const path = require('node:path');

const MD_EXT = /\.(md|markdown)$/i;
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

// Returns [{ name, path, type: 'dir', children } | { name, path, type: 'file' }],
// folders first. Only markdown files and folders that (transitively) contain them.
function buildTree(root, rel = '') {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return [];
  }
  const dirs = [];
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const childRel = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      const children = buildTree(root, childRel);
      if (children.length) dirs.push({ name: entry.name, path: childRel, type: 'dir', children });
    } else if (entry.isFile() && MD_EXT.test(entry.name)) {
      files.push({ name: entry.name, path: childRel, type: 'file' });
    }
  }
  return [...dirs.sort(byName), ...files.sort(byName)];
}

function resolveInsideRoot(root, rel) {
  const abs = path.resolve(root, rel);
  const fromRoot = path.relative(root, abs);
  if (!fromRoot || fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) {
    throw new Error(`Path is outside the opened directory: ${rel}`);
  }
  return abs;
}

module.exports = { MD_EXT, buildTree, resolveInsideRoot };
