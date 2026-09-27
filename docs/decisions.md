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
