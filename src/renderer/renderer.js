const treeEl = document.getElementById('tree');
const docEl = document.getElementById('doc');
const contentEl = document.getElementById('content');
const filterEl = document.getElementById('filter');
const docHeader = document.getElementById('doc-header');
const backButton = document.getElementById('back');
const forwardButton = document.getElementById('forward');

const flattenFiles = (nodes) => nodes.flatMap((n) => (n.type === 'dir' ? flattenFiles(n.children) : [n.path]));
let allFiles = [];
let activeRel = null;
let activeEmbeds = new Set();
let activeMtime = null;
let renderSeq = 0;

const showMessage = (className, text) =>
  docEl.replaceChildren(Object.assign(document.createElement('p'), { className, textContent: text }));

// Renders rel into the document. Options: frag (heading to scroll to) or scroll (scrollTop to restore).
// Only the latest call wins, so quick clicks can't leave an older file on screen.
async function showFile(rel, { frag = '', scroll = 0 } = {}) {
  const seq = ++renderSeq;
  activeRel = rel;
  selectInTree(rel);
  try {
    const { text, mtime } = await window.markopen.readFile(rel);
    const env = { rel, files: allFiles, depth: 0, embeds: new Set() };
    const el = await renderDoc(text, env);
    if (seq !== renderSeq) return;
    docEl.replaceChildren(...el.childNodes);
    activeEmbeds = env.embeds;
    activeMtime = mtime;
  } catch (err) {
    if (seq !== renderSeq) return;
    showMessage('error', `Could not open ${rel}: ${err.message}`);
    activeMtime = null;
  }
  updateHeader();
  if (!frag || !scrollToFrag(frag)) contentEl.scrollTop = scroll;
  if (!findBar.hidden) runFind({ keepPlace: true });
}

function scrollToFrag(frag) {
  const target =
    docEl.querySelector(`[id="${CSS.escape(frag)}"]`) ??
    docEl.querySelector(`[id="${CSS.escape(window.markopenLib.slugify(frag))}"]`);
  target?.scrollIntoView();
  return Boolean(target);
}

// Re-render the open file (after a theme switch or a change on disk), keeping the scroll position.
function rerenderActive() {
  if (activeRel) return showFile(activeRel, { scroll: contentEl.scrollTop });
}

// History: one entry per navigation, remembering each entry's scroll position.
const historyStack = [];
let historyIndex = -1;

function updateNavButtons() {
  backButton.disabled = historyIndex <= 0;
  forwardButton.disabled = historyIndex >= historyStack.length - 1;
}

function navigate(rel, frag = '') {
  if (rel === activeRel && !frag) return Promise.resolve();
  if (historyIndex >= 0) historyStack[historyIndex].scroll = contentEl.scrollTop;
  historyStack.splice(historyIndex + 1, Infinity, { rel, scroll: 0 });
  historyIndex++;
  updateNavButtons();
  if (rel === activeRel && frag) {
    scrollToFrag(frag);
    return Promise.resolve();
  }
  return showFile(rel, { frag });
}

function go(delta) {
  const target = historyIndex + delta;
  if (target < 0 || target >= historyStack.length) return;
  historyStack[historyIndex].scroll = contentEl.scrollTop;
  historyIndex = target;
  updateNavButtons();
  const { rel, scroll } = historyStack[target];
  if (rel === activeRel) contentEl.scrollTop = scroll;
  else showFile(rel, { scroll });
}

backButton.addEventListener('click', () => go(-1));
forwardButton.addEventListener('click', () => go(1));
window.addEventListener('mouseup', (event) => {
  if (event.button === 3) go(-1);
  if (event.button === 4) go(1);
});

// Links inside the document. Web links fall through to main, which opens the browser.
docEl.addEventListener('click', (event) => {
  const copy = event.target.closest('.copy-code');
  if (copy) return copyCode(copy);
  const link = event.target.closest('a');
  if (!link) return;
  if (link.dataset.rel) {
    event.preventDefault();
    return navigate(link.dataset.rel, link.dataset.frag);
  }
  const href = link.getAttribute('href');
  if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return;
  event.preventDefault();
  const { rel, frag } = joinRel(activeRel, href);
  if (rel === activeRel) navigate(rel, frag);
  else if (rel && window.markopenLib.MD_EXT.test(rel)) navigate(rel, frag);
});

async function copyCode(button) {
  await navigator.clipboard.writeText(button.parentElement.querySelector('code').textContent);
  button.textContent = 'Copied';
  setTimeout(() => (button.textContent = 'Copy'), 1500);
}

// Document header: breadcrumb, last modified, open in editor / reveal.
const breadcrumbEl = document.getElementById('breadcrumb');
const modifiedEl = document.getElementById('modified');
const timeAgo = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function formatAgo(ms) {
  const seconds = (ms - Date.now()) / 1000;
  for (const [unit, size] of [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (Math.abs(seconds) >= size) return timeAgo.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

function updateHeader() {
  docHeader.hidden = !activeRel;
  if (!activeRel) return;
  const parts = activeRel.split('/');
  breadcrumbEl.replaceChildren();
  parts.forEach((part, i) => {
    if (i) breadcrumbEl.append(Object.assign(document.createElement('span'), { className: 'sep', textContent: '›' }));
    if (i === parts.length - 1) {
      breadcrumbEl.append(Object.assign(document.createElement('span'), { className: 'current', textContent: part }));
      return;
    }
    const folder = Object.assign(document.createElement('button'), { className: 'crumb', textContent: part });
    folder.title = 'Show in sidebar';
    folder.addEventListener('click', () => revealFolder(parts.slice(0, i + 1).join('/')));
    breadcrumbEl.append(folder);
  });
  modifiedEl.textContent = activeMtime ? `modified ${formatAgo(activeMtime)}` : '';
  modifiedEl.title = activeMtime ? new Date(activeMtime).toLocaleString() : '';
}
setInterval(() => activeMtime && updateHeader(), 60_000);

document.getElementById('open-editor').addEventListener('click', () => activeRel && window.markopen.openInEditor(activeRel));
document.getElementById('reveal').addEventListener('click', () => activeRel && window.markopen.reveal(activeRel));

// Explorer
function renderNodes(nodes, container) {
  for (const node of nodes) {
    if (node.type === 'dir') {
      const details = document.createElement('details');
      details.dataset.path = node.path;
      const summary = document.createElement('summary');
      summary.textContent = node.name;
      summary.title = node.path;
      const children = document.createElement('div');
      children.className = 'children';
      renderNodes(node.children, children);
      details.append(summary, children);
      container.append(details);
    } else {
      const button = document.createElement('button');
      button.className = 'file';
      button.textContent = node.name;
      button.title = node.path;
      button.dataset.path = node.path;
      button.addEventListener('click', () => navigate(node.path));
      container.append(button);
    }
  }
}

const openAncestors = (el) => {
  for (let d = el.parentElement.closest('details'); d; d = d.parentElement.closest('details')) d.open = true;
};

function selectInTree(rel) {
  treeEl.querySelector('.file.active')?.classList.remove('active');
  const button = treeEl.querySelector(`.file[data-path="${CSS.escape(rel)}"]`);
  if (!button) return;
  button.classList.add('active');
  openAncestors(button);
  button.scrollIntoView({ block: 'nearest' });
}

function revealFolder(dir) {
  const details = treeEl.querySelector(`details[data-path="${CSS.escape(dir)}"]`);
  if (!details) return;
  setCollapsed(false);
  openAncestors(details);
  details.open = true;
  details.querySelector('summary').scrollIntoView({ block: 'nearest' });
}

// Filter box: hide files whose path doesn't contain the text, and folders left empty.
let openBeforeFilter = null;
const openFolders = () => new Set([...treeEl.querySelectorAll('details[open]')].map((d) => d.dataset.path));
const restoreFolders = (open) => {
  for (const details of treeEl.querySelectorAll('details')) details.open = open.has(details.dataset.path);
};

function applyFilter() {
  const query = filterEl.value.trim().toLowerCase();
  if (query && !openBeforeFilter) openBeforeFilter = openFolders();
  for (const button of treeEl.querySelectorAll('.file')) {
    button.hidden = Boolean(query) && !button.dataset.path.toLowerCase().includes(query);
  }
  for (const details of [...treeEl.querySelectorAll('details')].reverse()) {
    details.hidden = Boolean(query) && !details.querySelector('.file:not([hidden])');
    if (query) details.open = !details.hidden;
  }
  if (!query && openBeforeFilter) {
    restoreFolders(openBeforeFilter);
    openBeforeFilter = null;
    if (activeRel) selectInTree(activeRel);
  }
}

filterEl.addEventListener('input', applyFilter);
filterEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') treeEl.querySelector('.file:not([hidden])')?.click();
  if (event.key === 'Escape') {
    filterEl.value = '';
    applyFilter();
  }
});

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

// Document zoom (the sidebar stays the same size).
const ZOOM_STEPS = [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
let zoom = 1;
const setZoom = (value) => {
  zoom = ZOOM_STEPS.includes(value) ? value : 1;
  docEl.style.zoom = zoom;
  localStorage.setItem('docZoom', zoom);
};
const stepZoom = (delta) => setZoom(ZOOM_STEPS[clamp(ZOOM_STEPS.indexOf(zoom) + delta, 0, ZOOM_STEPS.length - 1)]);

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

const menuActions = {
  find: () => openFind(),
  'find-next': () => findStep(1),
  'find-prev': () => findStep(-1),
  search: () => openPalette('search'),
  'quick-open': () => openPalette('files'),
  'toggle-sidebar': () => setCollapsed(!sidebarEl.classList.contains('collapsed')),
  'zoom-in': () => stepZoom(1),
  'zoom-out': () => stepZoom(-1),
  'zoom-reset': () => setZoom(1),
  back: () => go(-1),
  forward: () => go(1),
};
window.markopen.onMenu((action) => menuActions[action]?.());
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!overlay.hidden) closePalette();
  else if (!findBar.hidden) closeFind();
});

// Live updates from disk. Redraw the tree keeping open folders and the selection.
window.markopen.onTreeChanged((tree) => {
  allFiles = flattenFiles(tree);
  const open = openBeforeFilter ?? openFolders();
  treeEl.replaceChildren();
  renderNodes(tree, treeEl);
  restoreFolders(open);
  if (filterEl.value.trim()) applyFilter();

  if (activeRel) {
    if (allFiles.includes(activeRel)) {
      selectInTree(activeRel);
    } else {
      activeRel = null;
      updateHeader();
      showMessage('empty', 'This file was removed.');
    }
  } else if (docEl.querySelector('p.empty')) {
    showMessage('empty', tree.length ? 'Select a file.' : 'No markdown files in this directory.');
  }
});
window.markopen.onFilesChanged((paths) => {
  if (activeRel && (!paths || paths.some((rel) => rel === activeRel || activeEmbeds.has(rel)))) rerenderActive();
});

async function init() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) await window.markopen.setTheme(savedTheme);
  updateToggle();
  setCollapsed(localStorage.getItem('sidebarCollapsed') === '1');
  setSidebarWidth(Number(localStorage.getItem('sidebarWidth')) || SIDEBAR_DEFAULT);
  setZoom(Number(localStorage.getItem('docZoom')) || 1);

  const { rootName, tree } = await window.markopen.getTree();
  document.getElementById('root-name').textContent = rootName;
  allFiles = flattenFiles(tree);
  renderNodes(tree, treeEl);

  if (!tree.length) return showMessage('empty', 'No markdown files in this directory.');
  const start = tree.find((n) => n.type === 'file' && /^(readme|index)\.(md|markdown)$/i.test(n.name));
  if (start) navigate(start.path);
  else showMessage('empty', 'Select a file.');
}

init();
