# Changelog

## v1.3.0 (big-reload-1.3.0)

### New Features
- **BIOS boot screen**: Animated POST sequence with PRO100BYTE Team ASCII logo, hardware detection table. Press any key to skip.
- **Command history**: Press `↑` / `↓` arrows to navigate through previously entered commands (per-session, in-memory).
- **NC — File Manager**: Norton Commander–style two-panel file manager (`nc` command). F1 Help, F3 file pager, F5 recursive copy, F6 move/rename, F7 mkdir, F8 delete with Y/N confirmation, PgUp/PgDn scrolling, F10 to quit.
- **Paint** (`paint [filename]`): ASCII/block-character paint application. Dynamic canvas fills the full terminal. Save/load canvases at `/paint/`. Accepts optional filename argument.
- **Player** (`player [trackname]`): Music player with 3-row animated visualizer (R/Y/G), full-width layout, number keys 1–9 to jump tracks, Shift+←/→ to seek ±30 s, repeat-all mode, file info panel. Accepts optional starting track argument.
- **NE-EDIT** (`edit [filename]`): Fullscreen TUI text editor. Ctrl+S save, Ctrl+X save-and-exit, Ctrl+Q quit without saving, Home/End, PgUp/PgDn, Delete key, Tab (4 spaces), horizontal scroll, unsaved-changes `*` indicator.
- **Empty Enter fix**: Pressing Enter on an empty command line no longer shows `Bad command`.
- **TUI exit fix**: All TUI apps now clear the screen and restore the shell prompt on exit. Exit handled via `Promise` so `runCommand` awaits completion cleanly.
- **NC navigation fix**: Removed bare `Esc` as quit key in NC (was colliding with arrow-key escape sequences); exit now only via F10.

### Documentation
- Added full `docs/` directory with architecture, commands reference, filesystem guide, app guide, development guide, and changelog.
- Added `DESIGN.md` (UI/UX design decisions), `AGENTS.md`, `CLAUDE.md`, `COPILOT.md` (AI agent instructions).

---

## v1.1.1

- Stability improvements.
- Additional utility commands: `password`, `base64`.

## v1.1.0

- Added `matrix` command (Matrix rain effect).
- Added `reboot` command.
- Added `upload` / `download` commands for file transfer.
- BrowserFS now persists to IndexedDB under store name `NEDOS`.

## v1.0.0

- Initial release.
- xterm.js terminal, BrowserFS virtual filesystem.
- Core command set: `dir`, `cd`, `mkdir`, `type`, `del`, `rmdir`, `cls`, `ver`, `help`, `echo`, `date`, `time`, `ip`, `geo`, `geoip`, `weather`, `credits`, `github`, `www`, `confetti`, `httpcat`, `httpdog`, `matrix`.
