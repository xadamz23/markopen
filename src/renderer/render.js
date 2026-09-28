// Markdown → DOM. renderDoc() builds everything off-DOM so the caller can swap it in in one go.
const { joinRel, createSlugger, resolveWikilink, splitFrontmatter } = window.markopenLib;

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const initMermaid = () =>
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: darkQuery.matches ? 'dark' : 'default' });
initMermaid();

const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|avif|bmp)$/i;

const md = window.markdownit({
  html: true,
  linkify: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
    return '';
  },
});

const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token.info.trim() === 'mermaid') {
    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

// GFM task lists: "- [ ] item" / "- [x] item" -> disabled checkbox.
md.core.ruler.after('inline', 'task-lists', (state) => {
  const tokens = state.tokens;
  tokens.forEach((token, i) => {
    if (token.type !== 'inline' || tokens[i - 2]?.type !== 'list_item_open') return;
    const first = token.children[0];
    const match = first?.type === 'text' && /^\[([ xX])\]\s/.exec(first.content);
    if (!match) return;
    first.content = first.content.slice(match[0].length);
    const checkbox = new state.Token('html_inline', '', 0);
    checkbox.content = `<input type="checkbox" disabled${match[1] === ' ' ? '' : ' checked'}> `;
    token.children.unshift(checkbox);
    tokens[i - 2].attrJoin('class', 'task-list-item');
  });
});

// Heading ids (GitHub-style slugs) so "#section" links and the outline can find them.
md.core.ruler.push('heading-ids', (state) => {
  const slug = createSlugger();
  state.tokens.forEach((token, i) => {
    if (token.type !== 'heading_open') return;
    const text = state.tokens[i + 1].children
      .filter((t) => t.type === 'text' || t.type === 'code_inline')
      .map((t) => t.content)
      .join('');
    token.attrSet('id', slug(text));
  });
});

// Obsidian [[target#heading|alias]] links and ![[target]] embeds.
md.inline.ruler.before('link', 'wikilink', (state, silent) => {
  let pos = state.pos;
  const embed = state.src.charCodeAt(pos) === 0x21; // "!"
  if (embed) pos++;
  if (!state.src.startsWith('[[', pos)) return false;
  const end = state.src.indexOf(']]', pos + 2);
  if (end === -1) return false;
  const inner = state.src.slice(pos + 2, end);
  if (!inner.trim() || /[\n[]/.test(inner)) return false;
  if (!silent) {
    const [link, ...alias] = inner.split('|');
    const [target, ...heading] = link.split('#');
    const token = state.push(embed ? 'wikiembed' : 'wikilink', '', 0);
    token.meta = { target: target.trim(), heading: heading.join('#').trim(), alias: alias.join('|').trim() };
  }
  state.pos = end + 2;
  return true;
});

const escapeAttr = (text) => md.utils.escapeHtml(text);

md.renderer.rules.wikilink = (tokens, idx, _options, env) => {
  const { target, heading, alias } = tokens[idx].meta;
  const rel = target ? resolveWikilink(target, env.files, env.rel) : env.rel;
  const text = alias || [target, heading].filter(Boolean).join(' › ');
  if (!rel) return `<a class="wikilink broken" title="No note named ${escapeAttr(target)}">${escapeAttr(text)}</a>`;
  const frag = heading ? window.markopenLib.slugify(heading) : '';
  return `<a class="wikilink" href="#" data-rel="${escapeAttr(rel)}" data-frag="${escapeAttr(frag)}" title="${escapeAttr(rel)}">${escapeAttr(text)}</a>`;
};

// Embeds become placeholders that renderDoc() fills in. Inside an embed they're plain links (one level only).
md.renderer.rules.wikiembed = (tokens, idx, options, env, self) => {
  const { target, heading, alias } = tokens[idx].meta;
  if (IMAGE_EXT.test(target)) {
    const width = /^\d+$/.test(alias) ? ` width="${alias}"` : '';
    return `<img class="embed-image" data-embed-name="${escapeAttr(target)}" alt="${escapeAttr(/^\d+$/.test(alias) ? target : alias || target)}"${width}>`;
  }
  if (env.depth > 0) return md.renderer.rules.wikilink(tokens, idx, options, env, self);
  return `<span class="embed" data-target="${escapeAttr(target)}" data-heading="${escapeAttr(heading)}"></span>`;
};

const fileUrl = (rel) => `markopen://root/${rel.split('/').map(encodeURIComponent).join('/')}`;
const isExternal = (src) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(src);

// Relative image paths load through the markopen: protocol, relative to the file they're in.
async function resolveImages(el, rel) {
  for (const img of el.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src');
    if (isExternal(src)) continue;
    const target = joinRel(rel, src).rel;
    if (target) img.src = fileUrl(target);
  }
  await Promise.all(
    [...el.querySelectorAll('img[data-embed-name]')].map(async (img) => {
      const name = img.dataset.embedName;
      const found = name.includes('/') ? name.replace(/^\/+/, '') : await window.markopen.findByName(name);
      if (found) img.src = fileUrl(found);
      else img.replaceWith(Object.assign(document.createElement('span'), { className: 'wikilink broken', textContent: name }));
    }),
  );
}

// Frontmatter as a collapsed "Properties" table.
function renderProperties(yaml) {
  const details = document.createElement('details');
  details.className = 'properties';
  details.append(Object.assign(document.createElement('summary'), { textContent: 'Properties' }));
  let data;
  try {
    data = jsyaml.load(yaml);
  } catch {}
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    details.append(Object.assign(document.createElement('pre'), { textContent: yaml }));
    return details;
  }
  const table = document.createElement('table');
  for (const [key, value] of Object.entries(data)) {
    const row = table.insertRow();
    row.insertCell().textContent = key;
    const cell = row.insertCell();
    if (Array.isArray(value)) {
      for (const item of value) {
        cell.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: formatValue(item) }));
      }
    } else {
      cell.textContent = formatValue(value);
    }
  }
  details.append(table);
  return details;
}

function formatValue(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

// Keeps only the section under the heading with this slug (up to the next heading of the same or higher level).
function extractSection(el, slug) {
  const start = el.querySelector(`[id="${CSS.escape(slug)}"]`);
  if (!start || !/^H[1-6]$/.test(start.tagName)) return;
  const level = Number(start.tagName[1]);
  const keep = [start];
  for (let node = start.nextElementSibling; node; node = node.nextElementSibling) {
    if (/^H[1-6]$/.test(node.tagName) && Number(node.tagName[1]) <= level) break;
    keep.push(node);
  }
  el.replaceChildren(...keep);
}

async function fillEmbed(placeholder, env) {
  const { target, heading } = placeholder.dataset;
  const rel = resolveWikilink(target, env.files, env.rel);
  const box = document.createElement('div');
  box.className = 'embed-note';
  placeholder.replaceWith(box);
  if (!rel) {
    box.classList.add('broken');
    box.textContent = `No note named ${target}`;
    return;
  }
  env.embeds.add(rel);
  const title = Object.assign(document.createElement('a'), { className: 'embed-title wikilink', href: '#', textContent: rel });
  title.dataset.rel = rel;
  box.append(title);
  try {
    const { text } = await window.markopen.readFile(rel);
    const inner = await renderDoc(text, { ...env, rel, depth: 1 });
    if (heading) extractSection(inner, window.markopenLib.slugify(heading));
    // Embedded headings keep their look but not their ids, so anchors stay unique.
    for (const node of inner.querySelectorAll('[id]')) node.removeAttribute('id');
    box.append(...inner.childNodes);
  } catch (err) {
    box.append(Object.assign(document.createElement('p'), { className: 'error', textContent: err.message }));
  }
}

function addCopyButtons(el) {
  for (const pre of el.querySelectorAll('pre:not(.mermaid)')) {
    if (!pre.querySelector('code')) continue;
    const wrap = document.createElement('div');
    wrap.className = 'code-block';
    pre.replaceWith(wrap);
    const button = Object.assign(document.createElement('button'), { className: 'copy-code', textContent: 'Copy' });
    wrap.append(pre, button);
  }
}

let mermaidId = 0;

// Renders each diagram on its own, so one bad diagram shows an inline error instead of breaking the page.
async function renderMermaid(el) {
  for (const pre of el.querySelectorAll('pre.mermaid')) {
    const id = `mermaid-${++mermaidId}`;
    try {
      const { svg } = await mermaid.render(id, pre.textContent);
      pre.innerHTML = svg;
    } catch (err) {
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
      const box = document.createElement('div');
      box.className = 'mermaid-error';
      box.append(
        Object.assign(document.createElement('strong'), { textContent: 'Mermaid error: ' }),
        (err?.message ?? String(err)).split('\n')[0],
        Object.assign(document.createElement('pre'), { textContent: pre.textContent }),
      );
      pre.replaceWith(box);
    }
  }
}

// env: { rel, files, depth, embeds: Set of embedded note paths (filled in) }.
async function renderDoc(source, env) {
  const { data, body } = splitFrontmatter(source);
  const el = document.createElement('div');
  el.innerHTML = DOMPurify.sanitize(md.render(body, env));
  await resolveImages(el, env.rel);
  if (env.depth > 0) return el;
  if (data !== null) el.prepend(renderProperties(data));
  await Promise.all([...el.querySelectorAll('span.embed')].map((placeholder) => fillEmbed(placeholder, env)));
  addCopyButtons(el);
  await renderMermaid(el);
  return el;
}
