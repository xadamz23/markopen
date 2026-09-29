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

// GitHub octicons for the five alert types.
const CALLOUT_ICONS = {
  note: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  tip: 'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z',
  important: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  warning: 'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  caution: 'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
};

// GitHub alerts ("> [!NOTE]") and Obsidian callouts ("> [!tip] Title", foldable "> [!info]-").
md.core.ruler.after('inline', 'callouts', (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i];
    if (open.type !== 'blockquote_open' || tokens[i + 1]?.type !== 'paragraph_open') continue;
    const inline = tokens[i + 2];
    const callout = window.markopenLib.parseCallout(inline.content.split('\n')[0]);
    if (!callout) continue;
    const { type, fold, title } = callout;
    const breakAt = inline.children.findIndex((t) => t.type === 'softbreak');
    if (breakAt === -1) tokens.splice(i + 1, 3);
    else inline.children.splice(0, breakAt + 1);
    const close = tokens.find((t, j) => j > i && t.type === 'blockquote_close' && t.level === open.level);
    const tag = fold ? 'details' : 'div';
    const titleTag = fold ? 'summary' : 'p';
    const icon = `<svg class="octicon" viewBox="0 0 16 16" width="16" height="16"><path d="${CALLOUT_ICONS[type]}"></path></svg>`;
    open.type = close.type = 'html_block';
    open.content = `<${tag} class="markdown-alert markdown-alert-${type}"${fold === '+' ? ' open' : ''}><${titleTag} class="markdown-alert-title">${icon}${escapeAttr(title)}</${titleTag}>\n`;
    close.content = `</${tag}>\n`;
  }
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
