# markopen roadmap

Possible features. None of these is committed; v1 is a read-only viewer: explorer, GFM, highlighting, Mermaid.

## Navigation
- **Relative links**: clicking `[x](other.md)` opens that file in the viewer and selects it in the explorer. Today these clicks do nothing.
- **Local images**: load `![](img.png)` from disk relative to the current file. Today only `https:` and `data:` images show.
- **Heading outline / TOC**: an outline of the current file's headings, for jumping between sections.
- **Back / forward history** between opened files.
- **`markopen file.md`**: open the file's parent directory with that file selected.

## Finding things
- **Filename filter** box above the explorer.
- **Full-text search** across all markdown in the directory.

## Live updates
- **Live reload**: re-render the current file when it changes on disk.
- **Tree refresh**: pick up files that are added, removed or renamed.

## Rendering
- **Obsidian extras**: `[[wikilinks]]`, `![[embeds]]`, YAML frontmatter shown as a table or hidden.
- **Math** via KaTeX (`$inline$`, `$$block$$`).
- **Footnotes, definition lists, heading anchors** (markdown-it plugins).
- **Font zoom** with Cmd +/-/0.
- **Print / export to PDF**.

## App polish
- **Real .app bundle** with its own name and icon (electron-builder), so the Dock doesn't show "Electron".
- **Single instance, multiple windows**: one process, and each `markopen` opens a new window in it.
- **Remember** window size and position, sidebar width, and expanded folders. (The sidebar's collapsed state is already remembered.)
- **Resizable sidebar**.
- **Lazy tree loading** for very large directories.
