const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const initMermaid = () =>
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: darkQuery.matches ? 'dark' : 'default' });
initMermaid();

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

const treeEl = document.getElementById('tree');
const docEl = document.getElementById('doc');
const contentEl = document.getElementById('content');
let activeButton = null;
let activeRel = null;

async function openFile(rel, button) {
  activeButton?.classList.remove('active');
  activeButton = button;
  activeRel = rel;
  button.classList.add('active');
  try {
    const source = await window.markopen.readFile(rel);
    docEl.innerHTML = DOMPurify.sanitize(md.render(source));
    contentEl.scrollTop = 0;
    await mermaid.run({ nodes: docEl.querySelectorAll('pre.mermaid') });
  } catch (err) {
    docEl.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'error';
    p.textContent = `Could not open ${rel}: ${err.message}`;
    docEl.append(p);
  }
}

function renderNodes(nodes, container) {
  for (const node of nodes) {
    if (node.type === 'dir') {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = node.name;
      details.append(summary);
      renderNodes(node.children, details);
      container.append(details);
    } else {
      const button = document.createElement('button');
      button.className = 'file';
      button.textContent = node.name;
      button.title = node.path;
      button.addEventListener('click', () => openFile(node.path, button));
      container.append(button);
    }
  }
}

const sidebarEl = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const setCollapsed = (collapsed) => {
  sidebarEl.classList.toggle('collapsed', collapsed);
  sidebarToggle.textContent = collapsed ? '›' : '‹';
  sidebarToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '');
};
sidebarToggle.addEventListener('click', () => setCollapsed(!sidebarEl.classList.contains('collapsed')));

const themeToggle = document.getElementById('theme-toggle');
const updateToggle = () => {
  themeToggle.textContent = darkQuery.matches ? '☀' : '☾';
};
themeToggle.addEventListener('click', () => {
  const next = darkQuery.matches ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  window.markopen.setTheme(next);
});
// Fires on toggle (and on macOS appearance changes while not forced).
// Re-render so Mermaid diagrams pick up the new theme, keeping scroll position.
darkQuery.addEventListener('change', async () => {
  updateToggle();
  initMermaid();
  if (!activeRel) return;
  const scroll = contentEl.scrollTop;
  await openFile(activeRel, activeButton);
  contentEl.scrollTop = scroll;
});

async function init() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) await window.markopen.setTheme(savedTheme);
  updateToggle();
  setCollapsed(localStorage.getItem('sidebarCollapsed') === '1');

  const { rootName, tree } = await window.markopen.getTree();
  document.getElementById('root-name').textContent = rootName;
  renderNodes(tree, treeEl);

  if (!tree.length) {
    docEl.innerHTML = '<p class="empty">No markdown files in this directory.</p>';
    return;
  }
  const start = tree.find((n) => n.type === 'file' && /^(readme|index)\.(md|markdown)$/i.test(n.name));
  if (start) {
    openFile(start.path, treeEl.querySelector(`button[title="${CSS.escape(start.path)}"]`));
  } else {
    docEl.innerHTML = '<p class="empty">Select a file.</p>';
  }
}

init();
