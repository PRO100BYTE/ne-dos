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
| `F5` | Copy selected file to the other panel |
| `F6` | Move (rename) selected file |
| `F7` | Create new directory |
| `F8` | Delete selected file/directory |
| `F10` / `Esc` | Exit NC, return to shell |

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
| `Space` | Place current character |
| `1`–`9` | Select brush character |
| `c` | Cycle colour |
| `s` | Save canvas to BrowserFS (`/paint/<name>.txt`) |
| `l` | Load canvas from BrowserFS |
| `n` | New (clear canvas) |
| `Esc` | Exit Paint |

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
| `←` / `→` | Seek backward / forward 5 s |
| `+` / `-` | Volume up / down |
| `s` | Toggle shuffle |
| `Esc` | Exit player |
