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
npm install                                                        # once, downloads Electron + render libs
alias markopen='~/me/code/personal/markopen/bin/markopen.js'       # put in ~/.zshrc; any alias name works
```

Moving or renaming this folder means updating the alias.

## Features (v1)

- **Explorer:** a collapsible tree showing only `.md`/`.markdown` files and the folders that contain them. Folders come first, then files alphabetically. Hidden (dot) folders and `node_modules` are skipped.
- **Rendering:** GitHub-flavored markdown (tables, task lists, strikethrough, autolinks), syntax-highlighted code blocks, and ```` ```mermaid ```` diagrams.
- **Start page:** opens `README.md` or `index.md` at the root if there is one.
- **Light/dark toggle:** the ☾/☀ button in the sidebar header. It follows the macOS appearance until you first click it, and after that your choice is remembered.
- **Collapsible sidebar:** the ‹/› button in the sidebar header folds the explorer to a thin strip, giving the document the full window. The collapsed state is remembered.
- **External links** open in your default browser.

Not yet supported: links between `.md` files, local images, search, live reload. See [../ROADMAP.md](../ROADMAP.md).

## Development

```sh
npm test                          # unit tests for the file tree (node:test)
npx electron . /some/dir          # run without the CLI wrapper
```

## Project layout

```
bin/markopen.js          CLI: validates the path, launches Electron detached
src/main.js              Electron main process: window, IPC, link handling, theme
src/tree.js              directory walk + path-safety helper (unit tested)
src/preload.js           the only bridge between the page and Node
src/renderer/            index.html, renderer.js, styles.css — the UI
test/tree.test.js        tests for src/tree.js
docs/                    these docs
ROADMAP.md               deferred feature ideas
```

More detail: [architecture.md](architecture.md) · [decisions.md](decisions.md)
