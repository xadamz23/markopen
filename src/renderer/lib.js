// Pure helpers shared by the renderer and the unit tests. Loaded as a plain <script>
// (window.markopenLib) and as a CommonJS module under node:test.
(function (exports) {
  const MD_EXT = /\.(md|markdown)$/i;

  // Resolves href relative to the folder of fromFile (both root-relative, "/"-separated).
  // Returns { rel, frag }, with rel null if the link leaves the root.
  function joinRel(fromFile, href) {
    const hash = href.indexOf('#');
    const frag = hash === -1 ? '' : decodeURIComponent(href.slice(hash + 1));
    let target = hash === -1 ? href : href.slice(0, hash);
    try {
      target = decodeURIComponent(target);
    } catch {}
    if (!target) return { rel: fromFile, frag };
    const parts = target.startsWith('/') ? [] : fromFile.split('/').slice(0, -1);
    for (const part of target.split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') {
        if (!parts.length) return { rel: null, frag };
        parts.pop();
      } else {
        parts.push(part);
      }
    }
    return { rel: parts.length ? parts.join('/') : null, frag };
  }

  // GitHub-style heading slug.
  function slugify(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
  }

  // Returns a slugger that de-duplicates within one document: "a", "a-1", "a-2".
  function createSlugger() {
    const seen = new Map();
    return (text) => {
      const base = slugify(text);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return count ? `${base}-${count}` : base;
    };
  }

  const dirOf = (rel) => rel.split('/').slice(0, -1).join('/');
  const baseOf = (rel) => rel.split('/').at(-1);
  const stripMd = (name) => name.replace(MD_EXT, '');

  // Obsidian-style [[target]] resolution against root-relative markdown paths:
  // an exact path (with or without extension) wins, then a basename match anywhere,
  // preferring the linking file's folder, then the shortest path.
  function resolveWikilink(target, files, fromRel) {
    const want = stripMd(target.trim().replace(/^\/+/, '')).toLowerCase();
    if (!want) return null;
    const exact = files.find((f) => stripMd(f).toLowerCase() === want);
    if (exact) return exact;
    const byName = files.filter((f) => stripMd(baseOf(f)).toLowerCase() === want || stripMd(f).toLowerCase().endsWith(`/${want}`));
    if (!byName.length) return null;
    const here = dirOf(fromRel ?? '');
    return byName.sort((a, b) => (dirOf(b) === here) - (dirOf(a) === here) || a.length - b.length)[0];
  }

  // Subsequence fuzzy match. Returns a score (higher is better), or -1 for no match.
  function fuzzyScore(query, rel) {
    const q = query.toLowerCase().replace(/\s+/g, '');
    if (!q) return 0;
    const s = rel.toLowerCase();
    const nameStart = s.lastIndexOf('/') + 1;
    let score = 0;
    let last = -2;
    let i = 0;
    for (let j = 0; j < s.length && i < q.length; j++) {
      if (s[j] !== q[i]) continue;
      score += 1;
      if (j === last + 1) score += 3;
      if (j === nameStart || s[j - 1] === '/' || s[j - 1] === '-' || s[j - 1] === '_' || s[j - 1] === ' ') score += 2;
      if (j >= nameStart) score += 1;
      last = j;
      i++;
    }
    if (i < q.length) return -1;
    return score - s.length * 0.01;
  }

  // Splits a leading "---" YAML block off the text. data is the raw YAML (or null).
  function splitFrontmatter(text) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
    if (!match) return { data: null, body: text };
    return { data: match[1], body: text.slice(match[0].length) };
  }

  // Obsidian callout types, mapped onto GitHub's five alert colors. Unknown types are notes.
  const CALLOUT_TYPES = {
    note: ['note', 'info', 'todo', 'abstract', 'summary', 'tldr', 'quote', 'cite'],
    tip: ['tip', 'hint', 'success', 'check', 'done', 'example'],
    important: ['important', 'question', 'help', 'faq'],
    warning: ['warning', 'attention'],
    caution: ['caution', 'danger', 'error', 'bug', 'failure', 'fail', 'missing'],
  };

  // Parses a "[!type]" alert/callout marker line: "[!NOTE]", "[!tip] Title", "[!info]- Folded".
  function parseCallout(line) {
    const match = /^\[!(\w+)\]([+-]?)[ \t]*(.*)$/.exec(line);
    if (!match) return null;
    const name = match[1].toLowerCase();
    const type = Object.keys(CALLOUT_TYPES).find((key) => CALLOUT_TYPES[key].includes(name)) ?? 'note';
    const title = match[3].trim() || name[0].toUpperCase() + name.slice(1);
    return { type, fold: match[2], title };
  }

  Object.assign(exports, { MD_EXT, joinRel, slugify, createSlugger, resolveWikilink, fuzzyScore, splitFrontmatter, parseCallout });
})(typeof module === 'object' ? module.exports : (window.markopenLib = {}));
