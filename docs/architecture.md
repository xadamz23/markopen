# Architecture

markopen is a small Electron app: no bundler, no framework, about 600 lines of our own code (JS, HTML, CSS).

## Launch flow

```mermaid
flowchart LR
  A["markopen ~/notes"] -->|"resolve + validate dir"| B["bin/markopen.js"]
  B -->|"spawn detached, then exit"| C["Electron main<br/>src/main.js"]
  C -->|"BrowserWindow + preload"| D["Renderer<br/>src/renderer/"]
  D -->|"IPC: tree / read / set-theme"| C
  C -->|"events: tree-changed / files-changed"| D
```

1. `bin/markopen.js` resolves the argument (default `.`) and exits with an error if it isn't a directory. It then runs `build/markopen.app/Contents/MacOS/Electron <appDir> <dir>` as a detached child and exits, so the terminal is free immediately. If the bundle is missing, it tells you to run `npm install`.
2. `src/main.js` treats the last command-line argument as the root directory. It registers the IPC handlers and opens one window titled `markopen — <dir name>`. Closing the window quits the process.
3. The renderer asks main for the tree, draws the explorer, and asks for file contents when you click a file.

## App bundle (`scripts/make-app.js`)

macOS takes the menu-bar name, Dock name and icon from the running bundle's `Info.plist`, not from anything the app can set at runtime. So `postinstall` copies `node_modules/electron/dist/Electron.app` to `build/markopen.app`. It then sets `CFBundleName`/`CFBundleDisplayName` to `markopen` and `CFBundleIdentifier` to `com.adamstahl.markopen`, and overwrites `Resources/electron.icns` with `assets/icon.icns`. The executable and helper apps keep their "Electron" names so Electron can still find its helpers. No re-signing is needed: the binary's linker ad-hoc signature doesn't bind `Info.plist` (`codesign -dv` shows `Info.plist=not bound`).

The bundle holds no app code; it's passed the project folder as its app path. That's why the `../../node_modules/...` script paths still work and edits show up on the next launch.

`assets/icon.icns` is generated from `assets/icon.svg` by `scripts/make-icon.js`. That script renders the SVG in an offscreen Electron window, resizes it into an `.iconset`, and runs `iconutil`.

## Processes and the IPC surface

The page runs with `contextIsolation: true`, `sandbox: true` and `nodeIntegration: false`, so it has no Node or filesystem access of its own. `src/preload.js` exposes exactly three request calls as `window.markopen`:

| Call | Main-process handler | Returns |
|---|---|---|
| `getTree()` | `buildTree(root)` | `{ rootName, tree }` |
| `readFile(rel)` | `fs.readFileSync(resolveInsideRoot(root, rel))` | file text |
| `setTheme('light' \| 'dark')` | `nativeTheme.themeSource = …` | nothing |

Main also pushes two events, which the page subscribes to through `onTreeChanged(cb)` and `onFilesChanged(cb)`:

| Event | Payload | Sent when |
|---|---|---|
| `tree-changed` | the new tree | the rebuilt tree differs from the last one sent |
| `files-changed` | changed markdown paths, or `null` if unknown | after every batch of disk changes |

`resolveInsideRoot` (in `src/tree.js`) rejects any path that resolves outside the opened directory. That means even a compromised page can only read files under the root.

## File tree (`src/tree.js`)

`buildTree(root)` walks the directory synchronously and returns nested nodes `{ name, path, type: 'dir' | 'file', children? }`, with `path` relative to the root. Rules:

- keep `.md` / `.markdown` files (case-insensitive)
- skip dot-entries and `node_modules`
- drop folders that end up with no markdown in them
- sort folders before files, each group case-insensitively with numeric ordering
- silently skip folders that can't be read

The whole tree is built upfront. That's fast for normal directories (the Obsidian vault, 173 files, takes about 7ms), but it's a known limit for huge trees (see the roadmap).

## Live updates (`src/watch.js`)

`watchRoot(root, onChange)` puts one recursive `fs.watch` on the root (FSEvents on macOS). It drops events under dot-folders and `node_modules`, the same rules `buildTree` uses. It collects the changed paths and calls `onChange` once 150ms after the last event, because editors often save as write-temp-then-rename. If FSEvents doesn't give a filename, the batch is `null`.

For each batch, main rebuilds the tree and sends `tree-changed` only if its JSON differs from the last tree sent. So saving a note, or adding a `.txt` file, doesn't redraw the sidebar. It then sends `files-changed`. The renderer:
- re-renders the open file if it's in the list (or the list is `null`), keeping the scroll position. The theme toggle uses the same `rerenderActive()` helper.
- redraws the tree on `tree-changed`, re-opens the folders that were open (each `<details>` carries `data-path`) and re-selects the active file. If the open file is gone, the document shows "This file was removed."

The watcher is closed when the window closes.

## Rendering pipeline (`src/renderer/renderer.js`)

```
markdown text
  → markdown-it (html, linkify)            GFM tables, strikethrough, autolinks
      + highlight.js in the highlight hook  code fences with a known language
      + custom core rule "task-lists"       "- [ ]" / "- [x]" → disabled checkbox
      + fence override for ```mermaid       → <pre class="mermaid">
  → DOMPurify.sanitize                      strips scripts/handlers from raw HTML in notes
  → innerHTML into <article class="markdown-body">
  → mermaid.run() on pre.mermaid nodes      diagrams become SVG
```

The libraries are loaded as plain `<script>` tags straight from `node_modules` (their browser/UMD builds), which is why there's no build step. The page's Content-Security-Policy allows scripts only from the app itself, plus images from `https:` and `data:`.

## Styling and theme

- `github-markdown-css` styles the document; `styles.css` handles the two-pane layout and the sidebar.
- All colours, including the highlight.js theme (two `<link>`s with `media="(prefers-color-scheme: …)"`), switch on `prefers-color-scheme`.
- **Toggle:** the button calls `setTheme`, main sets `nativeTheme.themeSource`, and Chromium then flips `prefers-color-scheme` for the page, so every stylesheet follows with no extra CSS. The renderer listens for that media-query change to swap the button icon, re-initialise Mermaid with the matching theme, and re-render the open file, keeping its scroll position.
- The choice is saved in `localStorage` under `theme` and applied at startup, before the first render. Until you click the toggle, nothing is saved and the app follows macOS.
- **Sidebar collapse:** the button (an inline SVG sidebar icon) toggles a `collapsed` class on `#sidebar` and sets `aria-pressed`. That shrinks the sidebar to a 44px strip and hides everything in it except the button. The icon's panel switches from filled to outlined. The state is saved in `localStorage` under `sidebarCollapsed` and restored at startup.
- **Sidebar resize:** `#sidebar-resizer` is a 5px strip over the sidebar's right border. Dragging it uses pointer capture and sets the `--sidebar-width` CSS variable. The chosen width is clamped to 180–600px and saved as `sidebarWidth` on pointer-up. The width actually shown is also capped so the document keeps at least 320px. Shrinking the window narrows the sidebar, and growing it back restores the chosen width. Double-clicking resets to 280px. The resizer is hidden while the sidebar is collapsed.
- The document column is capped at 1920px (`#doc` `max-width`) and centred, so it uses most of a wide window.

## Link handling

The window must never navigate away from the viewer. `will-navigate` is always cancelled, and `setWindowOpenHandler` always denies. In both cases `http(s)` URLs are passed to `shell.openExternal`, which opens them in your default browser. Everything else, including relative `.md` links, currently does nothing.

## Testing

- `npm test` runs `test/tree.test.js` (node:test) against a temporary directory fixture. It covers filtering, pruning, sorting, nesting and path-escape rejection.
- `test/watch.test.js` checks that bursts of writes arrive as one batch, that dot-folders and `node_modules` are ignored, and that paths are root-relative. It waits before starting the watcher, because FSEvents otherwise reports the temp folder's own creation.
- The UI was checked by running a throwaway Electron script. Drags need `sendInputEvent` mouse moves with `modifiers: ['leftButtonDown']`; without it, pointer capture doesn't hold. It loads `src/main.js`, inspects the DOM via `executeJavaScript` and saves `webContents.capturePage()` screenshots, because macOS `screencapture` isn't permitted from the terminal here. That script isn't kept in the repo.
