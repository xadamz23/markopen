const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { watchRoot } = require('../src/watch');

let root;
let watcher;
let batches;

const write = (rel, content = '# hi\n') => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'markopen-watch-')));
  batches = [];
  // Let FSEvents flush the temp dir's own creation before watching, then give the watcher a moment to start.
  await wait(200);
  watcher = watchRoot(root, (paths) => batches.push(paths));
  await wait(200);
});

afterEach(() => {
  watcher.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('batches quick writes into one change', async () => {
  write('a.md', '1');
  write('a.md', '2');
  write('a.md', '3');
  await wait(500);
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0], ['a.md']);
});

test('ignores dot folders and node_modules', async () => {
  write('.hidden/secret.md');
  write('node_modules/pkg/README.md');
  await wait(500);
  assert.deepEqual(batches, []);
});

test('reports files in new folders by relative path', async () => {
  write('newdir/x.md');
  await wait(500);
  assert.ok(batches.flat().includes(path.join('newdir', 'x.md')));
});
