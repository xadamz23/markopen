// One overlay for quick open (fuzzy file names) and search in files (full text, from main).
const overlay = document.getElementById('overlay');
const paletteInput = document.getElementById('palette-input');
const paletteResults = document.getElementById('palette-results');
let paletteMode = null; // 'files' | 'search'
let paletteItems = [];
let paletteSelected = 0;
let searchTimer = null;
let searchSeq = 0;

function openPalette(mode) {
  paletteMode = mode;
  overlay.hidden = false;
  paletteInput.placeholder = mode === 'files' ? 'Go to file…' : 'Search in all files…';
  paletteInput.value = mode === 'search' ? window.getSelection().toString().split('\n')[0] : '';
  paletteInput.focus();
  paletteInput.select();
  updatePalette();
}

function closePalette() {
  overlay.hidden = true;
  paletteMode = null;
  clearTimeout(searchTimer);
}

// Text with every case-insensitive occurrence of query wrapped in <mark>.
function markMatches(text, query) {
  const frag = document.createDocumentFragment();
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  let at = 0;
  for (let i = needle ? lower.indexOf(needle) : -1; i !== -1; i = lower.indexOf(needle, at)) {
    frag.append(text.slice(at, i), Object.assign(document.createElement('mark'), { textContent: text.slice(i, i + needle.length) }));
    at = i + needle.length;
  }
  frag.append(text.slice(at));
  return frag;
}

function renderPalette() {
  paletteResults.replaceChildren();
  const query = paletteInput.value.trim();
  paletteItems.forEach((item, i) => {
    const li = document.createElement('li');
    li.classList.toggle('selected', i === paletteSelected);
    const slash = item.path.lastIndexOf('/');
    if (paletteMode === 'files') {
      li.append(
        Object.assign(document.createElement('span'), { className: 'name', textContent: item.path.slice(slash + 1) }),
        Object.assign(document.createElement('span'), { className: 'dir', textContent: item.path.slice(0, slash + 1) }),
      );
    } else {
      const text = Object.assign(document.createElement('span'), { className: 'line' });
      text.append(markMatches(item.text, query));
      li.append(Object.assign(document.createElement('span'), { className: 'dir', textContent: `${item.path}:${item.line}` }), text);
    }
    li.addEventListener('mousemove', () => {
      paletteResults.children[paletteSelected]?.classList.remove('selected');
      paletteSelected = i;
      li.classList.add('selected');
    });
    li.addEventListener('click', () => choosePaletteItem(i));
    paletteResults.append(li);
  });
  if (!paletteItems.length && query) {
    paletteResults.append(Object.assign(document.createElement('li'), { className: 'none', textContent: 'No matches' }));
  }
  paletteResults.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
}

function updatePalette() {
  const query = paletteInput.value.trim();
  paletteSelected = 0;
  if (paletteMode === 'files') {
    paletteItems = allFiles
      .map((path) => ({ path, score: window.markopenLib.fuzzyScore(query, path) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
    return renderPalette();
  }
  clearTimeout(searchTimer);
  if (!query) {
    paletteItems = [];
    return renderPalette();
  }
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq;
    const results = await window.markopen.search(query);
    if (seq !== searchSeq || paletteMode !== 'search') return;
    paletteItems = results.flatMap((file) => file.matches.map((match) => ({ path: file.path, ...match })));
    renderPalette();
  }, 200);
}

async function choosePaletteItem(i) {
  const item = paletteItems[i];
  if (!item) return;
  const mode = paletteMode;
  const query = paletteInput.value.trim();
  closePalette();
  await navigate(item.path);
  if (mode === 'search') openFind(query);
}

paletteInput.addEventListener('input', updatePalette);
paletteInput.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const n = paletteItems.length;
    if (n) paletteSelected = (paletteSelected + (event.key === 'ArrowDown' ? 1 : -1) + n) % n;
    renderPalette();
  } else if (event.key === 'Enter') {
    choosePaletteItem(paletteSelected);
  } else if (event.key === 'Escape') {
    closePalette();
  }
});
overlay.addEventListener('mousedown', (event) => {
  if (event.target === overlay) closePalette();
});
