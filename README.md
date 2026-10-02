# markopen

A read-only markdown viewer for macOS. Run `markopen` on a directory from the terminal and it opens a desktop window, with a file explorer on the left and rendered markdown on the right. It never edits files.

Built with Electron, with no bundler and no framework.

## Features

- **Explorer** showing only markdown files and the folders that contain them, with a filter box, ⌘P quick open and ⇧⌘F search across files.
- **GitHub-flavored rendering:** tables, task lists, syntax-highlighted code blocks with a Copy button, Mermaid diagrams, and GitHub alerts (`> [!NOTE]`).
- **Obsidian support:** `[[wikilinks]]`, `![[embeds]]`, callouts and YAML frontmatter. That makes it work well as a viewer for an Obsidian vault.
- **Navigation:** relative and `#heading` links, Back / Forward history that keeps your scroll position, and find in page (⌘F).
- **Live reload:** the open file re-renders when it's saved, and the explorer updates when files are added, removed or renamed.
- **Light/dark theme, zoom, and a resizable, collapsible sidebar.** These settings are remembered.
- **Sandboxed:** the page has no filesystem access, and nothing outside the opened directory can be read or linked.

## Requirements

- macOS
- Node.js and npm

## Setup

```sh
git clone git@github.com:xadamz23/markopen.git
cd markopen
npm install    # downloads Electron and the render libraries, and builds build/markopen.app
```

Then add an alias to `~/.zshrc`, pointing at wherever you cloned the repo:

```sh
alias markopen='/path/to/markopen/bin/markopen.js'
```

## Usage

```sh
markopen            # open the current directory
markopen ~/notes    # open any directory
```

The command returns right away, and each call opens a separate window. If there is a `README.md` or `index.md` at the root, it opens first.

## Development

```sh
npm test           # unit tests (node:test)
npm run app        # rebuild build/markopen.app (needed after upgrading Electron)
npm run icon       # regenerate assets/icon.icns from assets/icon.svg
```

## Documentation

- [docs/README.md](docs/README.md): full feature list, keyboard shortcuts and project layout
- [docs/architecture.md](docs/architecture.md): how the app is put together
- [docs/decisions.md](docs/decisions.md): design decisions
- [ROADMAP.md](ROADMAP.md): possible future features
