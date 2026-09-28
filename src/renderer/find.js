// Find in page with the CSS Custom Highlight API: no DOM changes, and the find box never matches itself.
const findBar = document.getElementById('find-bar');
const findInput = document.getElementById('find-input');
const findCount = document.getElementById('find-count');
let findRanges = [];
let findIndex = 0;

function collectRanges(root, query) {
  const needle = query.toLowerCase();
  const ranges = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest('svg, button') || !parent.checkVisibility()) continue;
    const text = node.data.toLowerCase();
    for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) {
      const range = new Range();
      range.setStart(node, i);
      range.setEnd(node, i + needle.length);
      ranges.push(range);
    }
  }
  return ranges;
}

function showCurrentMatch(scroll) {
  const current = findRanges[findIndex];
  CSS.highlights.set('find-current', current ? new Highlight(current) : new Highlight());
  findCount.textContent = findInput.value ? (findRanges.length ? `${findIndex + 1} / ${findRanges.length}` : 'No results') : '';
  if (!current || !scroll) return;
  const rect = current.getBoundingClientRect();
  const view = contentEl.getBoundingClientRect();
  const headerHeight = document.getElementById('doc-header').offsetHeight;
  if (rect.top < view.top + headerHeight || rect.bottom > view.bottom) {
    contentEl.scrollTop += rect.top - view.top - view.height / 3;
  }
}

// Recomputes matches. keepPlace: after a re-render, stay on the same match number without scrolling.
function runFind({ keepPlace = false } = {}) {
  const query = findInput.value;
  findRanges = !findBar.hidden && query ? collectRanges(docEl, query) : [];
  CSS.highlights.set('find', new Highlight(...findRanges));
  findIndex = keepPlace ? Math.min(findIndex, Math.max(findRanges.length - 1, 0)) : 0;
  showCurrentMatch(!keepPlace);
}

function openFind(query) {
  const wasHidden = findBar.hidden;
  findBar.hidden = false;
  if (query !== undefined) findInput.value = query;
  findInput.focus();
  findInput.select();
  if (wasHidden || query !== undefined) runFind();
}

function closeFind() {
  findBar.hidden = true;
  CSS.highlights.delete('find');
  CSS.highlights.delete('find-current');
  findRanges = [];
}

function findStep(delta) {
  if (findBar.hidden) return openFind();
  if (!findRanges.length) return;
  findIndex = (findIndex + delta + findRanges.length) % findRanges.length;
  showCurrentMatch(true);
}

findInput.addEventListener('input', () => runFind());
findInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') findStep(event.shiftKey ? -1 : 1);
  if (event.key === 'Escape') closeFind();
});
document.getElementById('find-next').addEventListener('click', () => findStep(1));
document.getElementById('find-prev').addEventListener('click', () => findStep(-1));
document.getElementById('find-close').addEventListener('click', closeFind);
