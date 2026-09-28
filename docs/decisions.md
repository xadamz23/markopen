# Decisions

A log of the choices made while building markopen and why. Newest last.

## 1. Electron desktop window (2026-09-25)

**Options considered:**
- A local Node server that opens a browser tab. Simplest, but it's just a tab, and the terminal stays blocked while it runs.
- A native SwiftUI app with a WebView. Most native, but the most work to build and maintain.
- Electron.

**Chose Electron.** Adam wanted a real desktop window, and Electron gives that with ordinary web code and the standard JS markdown libraries. The known cost is size: roughly 200MB for the Electron runtime.

## 2. Keep v1 minimal; park everything else in ROADMAP.md (2026-09-25)

Offered as optional extras: live reload, relative links and images, filename search, heading outline, Obsidian extras, math. Adam deferred all of them. v1 is the explorer plus rendering; the rest is listed in [../ROADMAP.md](../ROADMAP.md).

## 3. Rendering scope: GFM, highlighting and Mermaid (2026-09-25)

Chosen: GitHub-flavored markdown, syntax highlighting and Mermaid diagrams. Not chosen for now: Obsidian wikilinks/embeds/frontmatter and KaTeX math.

markdown-it doesn't do GFM task lists by default. Instead of adding a dependency for them (the common plugin is old), a small custom rule of about 15 lines in `renderer.js` turns `[ ]` / `[x]` into disabled checkboxes.

## 4. No bundler (2026-09-25)

markdown-it, highlight.js, DOMPurify and Mermaid all ship ready-made browser builds. The page loads them with `<script>` tags from `node_modules`. That means no build step, no config, and nothing to go stale. Trade-off: the page references `../../node_modules/...` paths, which would need changing if the app were ever packaged.

## 5. Locked-down renderer (2026-09-25)

Markdown can contain raw HTML, and some notes might come from elsewhere. So:
- The page runs sandboxed, with context isolation and no Node access.
- Rendered HTML goes through DOMPurify.
- A Content-Security-Policy is set.
- File reads are limited to the opened directory (`resolveInsideRoot`).
- The window can never navigate away; web links open in the default browser.

This is the minimum; none of it is optional hardening added on top.

## 6. Explorer filtering rules (2026-09-25)

Show only `.md`/`.markdown` files, plus folders that contain them. Skip dot-folders (`.git`, `.obsidian`, …) and `node_modules`. Sort folders first, case-insensitive. Build the whole tree upfront, because it's fast enough for real directories (the vault takes about 7ms). Lazy loading is on the roadmap in case it's ever needed.

## 7. One process per invocation; the CLI returns immediately (2026-09-25)

Each call spawns its own detached Electron process with one window. This is simpler than a single running instance managing several windows. The cost is a separate Dock icon per window, and the Dock shows "Electron" because the app isn't packaged. Both fixes (packaging and single-instance) are on the roadmap.

## 8. Renamed openmd → markopen (2026-09-25)

The command, package, folder (`~/me/tmp/markopen`), window title, preload API (`window.markopen`) and docs were all renamed. No `openmd` references remain.

## 9. No global install; Adam provides the alias (2026-09-25)

v1 was put on the PATH with `npm link`, which created two symlinks under `/opt/homebrew`. Adam didn't want anything there, so they were removed with `npm rm -g openmd`, and the `bin` entry was dropped from `package.json` so it can't be re-linked by accident. `bin/markopen.js` is executable and is meant to be called through Adam's own shell alias.

## 10. Light/dark toggle through nativeTheme (2026-09-25)

The toggle sets Electron's `nativeTheme.themeSource` rather than swapping stylesheets or adding CSS classes. Chromium then reports the forced scheme through `prefers-color-scheme`, so github-markdown-css, the highlight.js themes and our sidebar colours all switch without extra CSS. Mermaid can't restyle an already-rendered diagram, so the open file is re-rendered with its scroll position kept.

The toggle has two states, light and dark. It follows macOS only until you first click it, and the choice is then stored in `localStorage`. Adam confirmed there's no need for a "back to system" option.

## 11. Moved to ~/me/code/personal/markopen (2026-09-25)

The project folder moved from `~/me/tmp/markopen` to `~/me/code/personal/markopen`. The setup commands in the README now use the new path, and the shell alias has to point there too.

## 12. Collapsible sidebar and wider document (2026-09-25)

A ‹/› button in the sidebar header collapses the explorer to a 36px strip, so a document can use the whole window. The collapsed state is saved in `localStorage` (`sidebarCollapsed`) the same way the theme is. The document's max width went from 960px to 1920px so it fills wide windows, and the folder chevrons were made bigger so they're easier to see.

## 13. Own app name and icon through a local bundle copy (2026-09-27)

The menu bar showed "Electron" because macOS reads the app name from the bundle's `Info.plist`, and `app.setName()` can't change that. **Options considered:**
- `@electron/packager`: a proper packaged `.app`. But it's a new dependency, and every code change would need a rebuild.
- **A local bundle copy (chosen).** `postinstall` copies Electron.app to a gitignored `build/markopen.app`, renames it in `Info.plist` and swaps in our icon. The CLI launches that copy with the project folder as the app path, so the code still runs from source with no build step (keeping #4).

This replaces the "Electron" Dock name noted in #7. It's still one process per window. No re-signing is done, because Electron's linker ad-hoc signature doesn't cover `Info.plist`. Also, this machine's `node_modules` has no symlinks, so `codesign --deep` fails on the framework anyway. The icon is a document with an M↓ mark on an indigo→blue tile. It's drawn as `assets/icon.svg` and turned into `icon.icns` by `npm run icon`, and both files are committed.

## 14. Resizable sidebar and a clearer collapse button (2026-09-27)

The sidebar's right edge can be dragged between 180px and 600px, and double-clicking it resets to 280px. The document always keeps at least 320px. The width is stored in `localStorage` (`sidebarWidth`) alongside the theme and collapsed state. The ‹/› glyph was too faint, so the collapse button is now a bordered 28px button with a sidebar icon whose panel is filled when open and outlined when collapsed.

## 15. Live reload and tree refresh through one recursive fs.watch (2026-09-28)

The open file re-renders when it changes on disk, keeping its scroll position. The sidebar updates when markdown files or folders are added, removed or renamed, keeping open folders and the selection. **Options considered:**
- chokidar: the usual choice, but it's a new dependency, and its cross-platform handling isn't needed in a macOS-only app.
- **Node's `fs.watch(root, { recursive: true })` (chosen).** On macOS it's backed by FSEvents, so one watcher covers the whole tree.

Events are debounced for 150ms so an editor's write-temp-then-rename save becomes one update. Main rebuilds the whole tree on every batch (the vault takes about 7ms) and sends it only if it changed, which keeps the renderer from redrawing the sidebar on every save.

## 16. Navigation, finding and Obsidian support (2026-09-28)

After a codebase review, Adam picked these from a ranked list:
- **Bug fixes:** a broken Mermaid block no longer blanks the page, `#heading` links work, and quick clicks can't leave the wrong file showing.
- **Navigation:** relative `.md` links and images, and back/forward history.
- **Finding:** find in page, a filename filter and quick open, and full-text search.
- **Obsidian:** a frontmatter Properties table, and wikilinks and embeds.
- **Extras:** document zoom, a copy button on code blocks, Open in VS Code and Reveal in Finder, and a document header with the path and modified time.
- **Polish:** less flicker on reload, and indent guides and icons in the tree. The `.md` extension stays visible.

Lazy tree loading was dropped for now. The filter, the search and wikilink resolution all need the full file list anyway, and the vault walks in 7ms. Choices made along the way:

- **Local images through a `markopen:` protocol**, not by loosening the CSP to `file:`. The handler goes through `resolveInsideRoot`, so the page still can't read outside the root (decision 5).
- **Find in page with the CSS Custom Highlight API**, not `webContents.findInPage`. `findInPage` matches the text typed into its own find box and moves focus. Highlights leave the DOM untouched and survive a re-render. The cost: a match can't span formatting.
- **Our own app menu.** The default View menu's ⌘+/⌘- zoom the whole page. Owning the menu lets zoom apply to the document only, and gives ⌘F, ⌘P, ⇧⌘F and ⌘[ / ⌘] a home that also shows up in the menu bar.
- **js-yaml for frontmatter.** It's the one new dependency, and it ships a UMD browser build, so there's still no bundler (decision 4). Frontmatter that doesn't parse is shown raw. Adam chose a collapsed "Properties" table over hiding the frontmatter or always showing it.
- **Quick open and the filter box both**, as Adam chose, sharing one overlay with search in files.
- **Open in VS Code** uses `open -a "Visual Studio Code"`. The `code` CLI isn't reliably on the PATH of an app started from the Dock.
- **Embeds go one level deep.** An embedded note's own embeds render as links, so a note that embeds itself can't loop.
- **Off-DOM rendering.** Each render is built in a detached element and swapped in, with `mermaid.render` per diagram. That fixed the Mermaid failure and the reload flicker in one change.
