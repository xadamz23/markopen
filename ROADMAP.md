# markopen roadmap

Possible features. None of these is committed.

## Navigation
- **Heading outline / TOC**: an outline of the current file's headings, for jumping between sections.
- **`markopen file.md`**: open the file's parent directory with that file selected.

## Rendering
- **Math** via KaTeX (`$inline$`, `$$block$$`).
- **Footnotes, definition lists, GitHub alerts** (`> [!NOTE]`).
- **Print / export to PDF**.

## App polish
- **Standalone .app** (electron-builder) that can live in /Applications. The name and icon are already handled by the local `build/markopen.app` copy.
- **Single instance, multiple windows**: one process, and each `markopen` opens a new window in it.
- **Remember** window size and position, and expanded folders. (Sidebar width, collapsed state, theme and zoom are already remembered.)
- **Lazy tree loading** for very large directories.
