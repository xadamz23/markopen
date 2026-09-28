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

// Re-render the open file (after a theme switch or a change on disk), keeping the scroll position.
async function rerenderActive() {
  if (!activeRel) return;
  const scroll = contentEl.scrollTop;
  await openFile(activeRel, activeButton);
  contentEl.scrollTop = scroll;
}

function renderNodes(nodes, container) {
  for (const node of nodes) {
    if (node.type === 'dir') {
      const details = document.createElement('details');
      details.dataset.path = node.path;
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
  sidebarToggle.setAttribute('aria-pressed', String(collapsed));
  sidebarToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '');
};
sidebarToggle.addEventListener('click', () => setCollapsed(!sidebarEl.classList.contains('collapsed')));

// Drag the sidebar's right edge to resize; double-click resets. The document always keeps at least 320px.
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 600;
const SIDEBAR_DEFAULT = 280;
const resizer = document.getElementById('sidebar-resizer');
let sidebarWidth = SIDEBAR_DEFAULT;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const setSidebarWidth = (px) => {
  sidebarWidth = Math.round(clamp(px, SIDEBAR_MIN, SIDEBAR_MAX));
  const shown = clamp(sidebarWidth, SIDEBAR_MIN, window.innerWidth - 320);
  document.documentElement.style.setProperty('--sidebar-width', `${shown}px`);
};
resizer.addEventListener('pointerdown', (event) => {
  resizer.setPointerCapture(event.pointerId);
  document.body.classList.add('resizing');
});
resizer.addEventListener('pointermove', (event) => {
  if (resizer.hasPointerCapture(event.pointerId)) setSidebarWidth(event.clientX);
});
resizer.addEventListener('pointerup', (event) => {
  resizer.releasePointerCapture(event.pointerId);
  document.body.classList.remove('resizing');
  localStorage.setItem('sidebarWidth', sidebarWidth);
});
resizer.addEventListener('dblclick', () => {
  setSidebarWidth(SIDEBAR_DEFAULT);
  localStorage.setItem('sidebarWidth', sidebarWidth);
});
// Shrinking the window re-clamps; growing it back restores the width you chose.
window.addEventListener('resize', () => setSidebarWidth(sidebarWidth));

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
  await rerenderActive();
});

// Live updates from disk. Redraw the tree keeping open folders and the selection.
window.markopen.onTreeChanged((tree) => {
  const open = new Set([...treeEl.querySelectorAll('details[open]')].map((d) => d.dataset.path));
  treeEl.replaceChildren();
  renderNodes(tree, treeEl);
  for (const details of treeEl.querySelectorAll('details')) details.open = open.has(details.dataset.path);

  if (activeRel) {
    activeButton = treeEl.querySelector(`button[title="${CSS.escape(activeRel)}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    } else {
      activeRel = null;
      docEl.innerHTML = '<p class="empty">This file was removed.</p>';
    }
  } else if (docEl.querySelector('p.empty')) {
    docEl.innerHTML = tree.length
      ? '<p class="empty">Select a file.</p>'
      : '<p class="empty">No markdown files in this directory.</p>';
  }
});
window.markopen.onFilesChanged((paths) => {
  if (activeRel && (!paths || paths.includes(activeRel))) rerenderActive();
});

async function init() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) await window.markopen.setTheme(savedTheme);
  updateToggle();
  setCollapsed(localStorage.getItem('sidebarCollapsed') === '1');
  setSidebarWidth(Number(localStorage.getItem('sidebarWidth')) || SIDEBAR_DEFAULT);

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
