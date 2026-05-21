# Changelog

## v1.3.0 (big-reload-1.3.0)

### New Features
- **Command history**: Press `↑` / `↓` arrows to navigate through previously entered commands (per-session, in-memory).
- **NC — File Manager**: Norton Commander–style two-panel file manager (`nc` command). Supports copy, move, mkdir, delete, panel switching.
- **Paint**: ASCII/block-character paint application (`paint` command). Save/load canvases to/from BrowserFS at `/paint/`.
- **Player**: Music player (`player` command) that reads audio files from BrowserFS `/music/`. Supports play/pause, seek, volume, shuffle.

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
