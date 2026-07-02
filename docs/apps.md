# TUI Applications

NE-DOS v1.3.0 introduces three pseudo-graphical terminal applications rendered entirely inside xterm.js using Unicode box-drawing characters and ANSI escape sequences.

---

## `nc` — File Manager (Norton Commander style)

Launched with the `nc` command.

### Layout

```
╔═══════════════════════╦═══════════════════════╗
║  Left Panel           ║  Right Panel          ║
║  C:\                  ║  C:\                  ║
╠═══════════════════════╬═══════════════════════╣
║ [ folder1         ]   ║   folder2             ║
║   file.txt        55B ║   notes.txt       12B ║
║   ...                 ║   ...                 ║
╠═══════════════════════╩═══════════════════════╣
║ F5 Copy  F6 Move  F7 MkDir  F8 Del  F10 Quit  ║
╚═══════════════════════════════════════════════╝
```

### Key Bindings

| Key | Action |
|---|---|
| `Tab` | Switch active panel |
| `↑` / `↓` | Move cursor |
| `Enter` | Open directory |
| `Backspace` | Go to parent directory |
| `F1` | Show keybinding reference in status bar |
| `F3` | View file in pager (or enter directory) |
| `F5` | Copy selected entry to other panel (recursive for folders, editable destination) |
| `F6` | Move / rename selected entry (editable destination) |
| `F7` | Create new directory |
| `F8` | Delete selected entry with Y/N confirmation (recursive for folders) |
| `PgUp` / `PgDn` | Scroll file list by page |
| `F10` | Exit NC, return to shell (bare `Esc` is **not** a quit key) |

---

## `paint` — ASCII Paint

Launched with the `paint` command.

### Layout

```
╔══════════════════════════════════════════════╗
║  NE-PAINT  [New] [Save] [Load] [Clear] [Quit]║
╠══════╦═══════════════════════════════════════╣
║ ████ ║                                       ║
║ ░░░░ ║          Drawing Canvas               ║
║ ████ ║                                       ║
║ Tool ║                                       ║
╚══════╩═══════════════════════════════════════╝
```

### Key Bindings

| Key | Action |
|---|---|
| Arrow keys | Move cursor |
| `Space` | Draw with current brush at cursor |
| Any printable char | Draw that character and advance cursor |
| `b` | Cycle brush character |
| `c` | Cycle colour |
| `s` | Save canvas to BrowserFS (`/paint/<name>.txt`) |
| `l` | Load canvas from BrowserFS |
| `n` | New (clear canvas) |
| `Delete` | Erase character at cursor |
| `Esc` | Exit Paint |

You can pass a filename argument to pre-fill the save/load name:

```
paint myart
```

---

## `player` — Music Player

Launched with the `player` command.

Reads `.mp3` / `.ogg` / `.wav` files stored in the BrowserFS directory `/music/`.

### Layout

```
╔══════════════════════════════════════════════╗
║           ♪  NE-PLAYER  ♪                   ║
╠══════════════════════════════════════════════╣
║  Now playing: song.mp3                       ║
║  ████████████░░░░░░░░░░░░  01:23 / 03:45     ║
╠══════════════════════════════════════════════╣
║  Playlist                                    ║
║  [1] song.mp3                                ║
║  [2] another.ogg                             ║
╠══════════════════════════════════════════════╣
║  [Space] Play/Pause  [←][→] Seek  [↑][↓] Track ║
║  [+][-] Volume  [s] Shuffle  [Esc] Quit      ║
╚══════════════════════════════════════════════╝
```

### Using the Player

1. Upload audio files with the `upload` command (they will be saved to `/music/`).
2. Run `player` to launch the player.
3. Navigate with arrow keys and press `Space` to play/pause.

### Key Bindings

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `↑` / `↓` | Previous / next track |
| `←` / `→` | Seek ±5 s |
| `Shift+←` / `Shift+→` | Seek ±30 s |
| `+` / `-` | Volume +5 % / −5 % |
| `1`–`9`, `0` | Jump to track 1–9 / 10 |
| `s` | Toggle shuffle |
| `r` | Toggle repeat (one track) |
| `a` | Toggle repeat all |
| `Esc` | Exit player |

You can pass a starting track name:

```
player mysong.mp3
```

---

## `edit` — Text Editor

Launched with `edit [filepath]`. Creates the file if it does not exist.

### Key Bindings

| Key | Action |
|---|---|
| Arrow keys | Move cursor |
| `Home` / `End` | Start / end of line |
| `PgUp` / `PgDn` | Scroll page |
| `Enter` | Insert new line |
| `Backspace` | Delete character before cursor |
| `Delete` | Delete character at cursor |
| `Tab` | Insert 4 spaces |
| `Ctrl+S` | Save file |
| `Ctrl+X` | Save and exit |
| `Ctrl+Q` | Quit without saving |

The title bar shows `*` when there are unsaved changes. Horizontal scroll is automatic when the line exceeds the terminal width.
