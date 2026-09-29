const { test } = require('node:test');
const assert = require('node:assert/strict');
const { joinRel, slugify, createSlugger, resolveWikilink, fuzzyScore, splitFrontmatter, parseCallout } = require('../src/renderer/lib');

test('joinRel resolves relative to the current file folder', () => {
  assert.deepEqual(joinRel('docs/guide.md', 'other.md'), { rel: 'docs/other.md', frag: '' });
  assert.deepEqual(joinRel('docs/guide.md', '../README.md#setup'), { rel: 'README.md', frag: 'setup' });
  assert.deepEqual(joinRel('docs/guide.md', './deep/more.md'), { rel: 'docs/deep/more.md', frag: '' });
  assert.deepEqual(joinRel('docs/guide.md', '/a.md'), { rel: 'a.md', frag: '' });
  assert.deepEqual(joinRel('a.md', 'my%20note.md'), { rel: 'my note.md', frag: '' });
});

test('joinRel keeps the current file for fragment-only links', () => {
  assert.deepEqual(joinRel('docs/guide.md', '#install'), { rel: 'docs/guide.md', frag: 'install' });
});

test('joinRel returns null for links that leave the root', () => {
  assert.equal(joinRel('a.md', '../outside.md').rel, null);
  assert.equal(joinRel('docs/guide.md', '../../x.md').rel, null);
});

test('slugify matches GitHub heading ids', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
  assert.equal(slugify('What is `markopen`?'), 'what-is-markopen');
  assert.equal(slugify('Setup & Install'), 'setup--install');
  assert.equal(slugify('Über café'), 'über-café');
});

test('createSlugger numbers duplicate headings', () => {
  const slug = createSlugger();
  assert.deepEqual([slug('Notes'), slug('Notes'), slug('Notes')], ['notes', 'notes-1', 'notes-2']);
});

test('resolveWikilink prefers exact paths, then the same folder, then the shortest path', () => {
  const files = ['a.md', 'docs/guide.md', 'docs/deep/guide.md', 'other/guide.md', 'x/y/Note.md'];
  assert.equal(resolveWikilink('docs/deep/guide', files, 'a.md'), 'docs/deep/guide.md');
  assert.equal(resolveWikilink('guide', files, 'docs/deep/more.md'), 'docs/deep/guide.md');
  assert.equal(resolveWikilink('guide', files, 'a.md'), 'docs/guide.md');
  assert.equal(resolveWikilink('note', files, 'a.md'), 'x/y/Note.md');
  assert.equal(resolveWikilink('deep/guide', files, 'a.md'), 'docs/deep/guide.md');
  assert.equal(resolveWikilink('missing', files, 'a.md'), null);
});

test('fuzzyScore matches subsequences and ranks basename matches higher', () => {
  assert.equal(fuzzyScore('xyz', 'docs/guide.md'), -1);
  assert.ok(fuzzyScore('gd', 'docs/guide.md') > 0);
  assert.ok(fuzzyScore('guide', 'docs/guide.md') > fuzzyScore('guide', 'g/u/i/d/e.md'));
  assert.ok(fuzzyScore('read', 'README.md') > fuzzyScore('read', 'docs/rea-d.md'));
});

test('splitFrontmatter separates a leading YAML block', () => {
  assert.deepEqual(splitFrontmatter('---\ntitle: Hi\ntags: [a]\n---\n# Body\n'), { data: 'title: Hi\ntags: [a]', body: '# Body\n' });
  assert.deepEqual(splitFrontmatter('# No frontmatter\n---\n'), { data: null, body: '# No frontmatter\n---\n' });
  assert.deepEqual(splitFrontmatter('---\na: 1\n---'), { data: 'a: 1', body: '' });
});

test('parseCallout reads GitHub alerts', () => {
  assert.deepEqual(parseCallout('[!NOTE]'), { type: 'note', fold: '', title: 'Note' });
  assert.deepEqual(parseCallout('[!WARNING]'), { type: 'warning', fold: '', title: 'Warning' });
});

test('parseCallout reads Obsidian callouts with titles, aliases and folding', () => {
  assert.deepEqual(parseCallout('[!tip] Custom title'), { type: 'tip', fold: '', title: 'Custom title' });
  assert.deepEqual(parseCallout('[!info]'), { type: 'note', fold: '', title: 'Info' });
  assert.deepEqual(parseCallout('[!bug]- Folded'), { type: 'caution', fold: '-', title: 'Folded' });
  assert.deepEqual(parseCallout('[!faq]+'), { type: 'important', fold: '+', title: 'Faq' });
  assert.deepEqual(parseCallout('[!whatever]'), { type: 'note', fold: '', title: 'Whatever' });
});

test('parseCallout ignores lines that are not markers', () => {
  assert.equal(parseCallout('[!NOTE'), null);
  assert.equal(parseCallout('see [!NOTE]'), null);
  assert.equal(parseCallout('[!] empty'), null);
});
