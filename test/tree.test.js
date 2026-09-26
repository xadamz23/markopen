const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildTree, resolveInsideRoot } = require('../src/tree');

let root;

function touch(rel, content = '# hi\n') {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'markopen-test-'));
  touch('README.md');
  touch('b.markdown');
  touch('a.md');
  touch('notes.txt');
  touch('docs/guide.md');
  touch('docs/deep/more.md');
  touch('zeta/only.md');
  touch('images/pic.png');
  touch('.hidden/secret.md');
  touch('node_modules/pkg/README.md');
  fs.mkdirSync(path.join(root, 'empty'));
});

after(() => fs.rmSync(root, { recursive: true, force: true }));

const names = (nodes) => nodes.map((n) => n.name);

test('lists folders first, then markdown files, alphabetically', () => {
  const tree = buildTree(root);
  assert.deepEqual(names(tree), ['docs', 'zeta', 'a.md', 'b.markdown', 'README.md']);
});

test('skips non-markdown files, empty folders, dot folders and node_modules', () => {
  const all = JSON.stringify(buildTree(root));
  for (const excluded of ['notes.txt', 'images', 'empty', '.hidden', 'node_modules']) {
    assert.ok(!all.includes(excluded), `${excluded} should be excluded`);
  }
});

test('nests children with root-relative paths', () => {
  const docs = buildTree(root).find((n) => n.name === 'docs');
  assert.equal(docs.type, 'dir');
  assert.deepEqual(names(docs.children), ['deep', 'guide.md']);
  const more = docs.children[0].children[0];
  assert.deepEqual(more, { name: 'more.md', path: path.join('docs', 'deep', 'more.md'), type: 'file' });
});

test('resolveInsideRoot returns absolute path for paths inside root', () => {
  assert.equal(resolveInsideRoot(root, 'docs/guide.md'), path.join(root, 'docs', 'guide.md'));
});

test('resolveInsideRoot rejects paths escaping root', () => {
  assert.throws(() => resolveInsideRoot(root, '../outside.md'));
  assert.throws(() => resolveInsideRoot(root, '/etc/passwd'));
  assert.throws(() => resolveInsideRoot(root, 'docs/../../x.md'));
});
