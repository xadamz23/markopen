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

// Root-relative paths of every file in a buildTree() result.
const flattenFiles = (nodes) => nodes.flatMap((n) => (n.type === 'dir' ? flattenFiles(n.children) : [n.path]));

// Case-insensitive substring search over the given files. Returns [{ path, matches: [{ line, text }] }],
// stopping once `limit` matching lines are found.
function searchFiles(root, files, query, limit = 200) {
  const needle = query.toLowerCase();
  const results = [];
  let count = 0;
  for (const rel of files) {
    if (count >= limit) break;
    let text;
    try {
      text = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    const matches = [];
    text.split(/\r?\n/).forEach((line, i) => {
      if (count < limit && line.toLowerCase().includes(needle)) {
        matches.push({ line: i + 1, text: line.trim().slice(0, 200) });
        count++;
      }
    });
    if (matches.length) results.push({ path: rel, matches });
  }
  return results;
}

// Finds a file of any type by basename (case-insensitive), with the same skip rules as buildTree.
// Returns the root-relative path of the shallowest match, or null.
function findByName(root, name) {
  const want = name.toLowerCase();
  let level = [''];
  while (level.length) {
    const next = [];
    for (const rel of level) {
      let entries;
      try {
        entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const childRel = path.join(rel, entry.name);
        if (entry.isFile() && entry.name.toLowerCase() === want) return childRel;
        if (entry.isDirectory()) next.push(childRel);
      }
    }
    level = next;
  }
  return null;
}

module.exports = { MD_EXT, buildTree, flattenFiles, searchFiles, findByName, resolveInsideRoot };
