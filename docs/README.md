# markopen

A read-only markdown viewer for macOS. Point it at a directory from the terminal and it opens a desktop window, with a file explorer on the left and rendered markdown on the right. It never edits files.

## Usage

```sh
markopen            # open the current directory
markopen .          # same
markopen ~/notes    # open any directory
```

The command returns immediately; the window runs on its own. Each call opens a separate window. A path that isn't a directory prints `markopen: <path> is not a directory` and exits with code 1.

## Setup

There is no global install. The script runs directly from this folder:

```sh
cd ~/me/code/personal/markopen
npm install                                                        # once: downloads Electron + render libs, builds build/markopen.app
alias markopen='~/me/code/personal/markopen/bin/markopen.js'       # put in ~/.zshrc; any alias name works
```

Moving or renaming this folder means updating the alias.

`npm install` also builds `build/markopen.app`, a local copy of Electron renamed to markopen with its own icon, so the menu bar and Dock say "markopen". Code changes don't need a rebuild, because the bundle loads the code from this folder. Rebuild it with `npm run app` after upgrading Electron.

## Features (v1)

- **Explorer:** a collapsible tree showing only `.md`/`.markdown` files and the folders that contain them. Folders come first, then files alphabetically. Hidden (dot) folders and `node_modules` are skipped.
- **Rendering:** GitHub-flavored markdown (tables, task lists, strikethrough, autolinks), syntax-highlighted code blocks with a Copy button, and ```` ```mermaid ```` diagrams. A diagram with a syntax error shows an inline error box; the rest of the page still renders.
- **Links:** `#heading` links scroll to the heading. Relative links to other `.md` files (`[x](../other.md#section)`) open them in the viewer and select them in the explorer. Relative images (`![](img/pic.png)`) load from disk. Nothing outside the opened directory can be linked or loaded.
- **Obsidian notes:** `[[note]]`, `[[note#Heading]]` and `[[note|alias]]` links resolve the way Obsidian does (exact path first, then the file name anywhere, preferring the same folder). Links to missing notes are red and dashed. `![[note]]` embeds the note (or `![[note#Heading]]` just that section), one level deep. `![[pic.png]]` and `![[pic.png|200]]` embed images. YAML frontmatter shows as a collapsed **Properties** table at the top.
- **History:** Back / Forward (⌘[ / ⌘], the ‹ › buttons, or mouse buttons 4/5), and each entry keeps its scroll position.
- **Document header:** the file's path as a breadcrumb (click a folder to show it in the sidebar), when it was last modified, and **Open in VS Code** / **Reveal in Finder** buttons.
- **Find in page:** ⌘F, then Enter / ⇧Enter or ⌘G / ⇧⌘G to move between matches, and Esc to close.
- **Finding files:** the **Filter files** box above the explorer narrows the tree to paths containing the text (Enter opens the first match, Esc clears it). ⌘P opens a fuzzy quick-open list. ⇧⌘F searches the text of every markdown file; picking a result opens the file with find-in-page already showing the query.
- **Zoom:** ⌘+ / ⌘- / ⌘0 zoom the document (not the sidebar), from 70% to 200%. The level is remembered.
- **Start page:** opens `README.md` or `index.md` at the root if there is one.
- **Light/dark toggle:** the ☾/☀ button in the sidebar header. It follows the macOS appearance until you first click it, and after that your choice is remembered.
- **Resizable sidebar:** drag its right edge to set the width, between 180px and 600px. Double-click the edge to reset it to 280px. The width is remembered.
- **Collapsible sidebar:** the sidebar button at the top left (or ⌘\\) folds the explorer to a thin strip, giving the document the full window. The collapsed state is remembered.
- **Live updates:** the open file re-renders when it's saved, keeping your scroll position. The explorer picks up markdown files and folders that are added, removed or renamed, and keeps open folders open.
- **External links** open in your default browser.

See [../ROADMAP.md](../ROADMAP.md) for what's not supported yet.

## Development

```sh
npm test                          # unit tests for the file tree, watcher and renderer helpers (node:test)
npx electron . /some/dir          # run without the CLI wrapper (menu bar will say "Electron")
npm run app                       # rebuild build/markopen.app
npm run icon                      # regenerate assets/icon.icns from assets/icon.svg
```

## Project layout

```
bin/markopen.js          CLI: validates the path, launches Electron detached
src/main.js              Electron main process: window, IPC, link handling, theme
src/tree.js              directory walk, search, find-by-name, path-safety helper (unit tested)
src/watch.js             recursive fs.watch with debouncing (unit tested)
src/preload.js           the only bridge between the page and Node
src/renderer/            the UI: index.html, styles.css and the scripts below
  lib.js                 pure helpers: link paths, slugs, wikilink resolution, fuzzy match (unit tested)
  render.js              markdown → DOM (markdown-it rules, embeds, images, Mermaid, Properties)
  find.js                find in page
  palette.js             quick open and search-in-files overlay
  renderer.js            app state: explorer, filter, navigation/history, header, sidebar, theme, zoom, menu
test/                    tree.test.js, watch.test.js, lib.test.js
assets/                  icon.svg (source) and icon.icns (generated, committed)
scripts/                 make-app.js (builds the bundle), make-icon.js (svg → icns)
build/markopen.app       generated app bundle (gitignored)
docs/                    these docs
ROADMAP.md               deferred feature ideas
```

More detail: [architecture.md](architecture.md) · [decisions.md](decisions.md)
