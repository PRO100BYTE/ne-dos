# DESIGN.md — NE-DOS UI/UX Design Decisions

## Philosophy

NE-DOS aims to recreate the aesthetic of **real 1990s DOS** running inside a modern browser. The visual style is intentionally retro: green-on-black (or amber-on-black) monospace text, no icons, no rounded corners, no shadows — only characters and colour.

## Colour Palette

| Role | ANSI | Hex |
|---|---|---|
| Background | Black (0) | `#000000` |
| Default text | Bright Green (10) | `#00ff00` |
| Prompt | Bright Cyan (14) | `#00ffff` |
| Error output | Bright Red (9) | `#ff0000` |
| Highlight / selected | Bright White on Blue | `#ffffff` / `#0000aa` |
| TUI frame / box-drawing | Bright White (15) | `#ffffff` |

## Typography

- **Font**: monospace (system default via xterm.js). The terminal renders at the browser's default monospace size.
- **Letter spacing**: normal.
- **Line height**: normal (xterm default).

xterm.js `scrollback` is set to 1000 lines — enough for long command output without consuming excessive memory.

## Layout

The terminal fills the full browser viewport (`position: fixed; inset: 0`). The xterm `FitAddon` resizes the terminal to match the viewport on load.

Overflow is hidden on `.xterm-viewport` to prevent a redundant scrollbar alongside xterm's own internal scroll.

## TUI Application Design Principles

1. **Full-screen takeover**: TUI apps clear the screen and own all input for their lifetime.
2. **Box-drawing characters**: All frames use Unicode box-drawing (`─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`). Double-line variants (`═ ║ ╔ ...`) are used for outermost borders.
3. **Function key bar**: Applications show a status bar at the bottom listing available key bindings.
4. **Escape to exit**: Every TUI app can be exited with `Esc` or `F10`, which restores the normal shell prompt.
5. **Cursor management**: The cursor is hidden while TUI apps are active and restored on exit.
6. **Colour coding**:
   - Selected / active item: reverse video (white background, black text).
   - Inactive panel: dimmed text.
   - Errors: red text.

## Startup Screen

On load the terminal displays:
```
Current date is ...
Current time is ...

The NE-DOS Personal Computer DOS
Version <branch>/<commit> (C) Copyright PRO100BYTE Team
Built: <date>
```

This mirrors authentic DOS boot screens.

## Command Prompt

Format: `C:\current\path>`  
Replicated by `FormatDirectory()` in `StorageManager.js`.

## Command History

- History is kept **in memory only** for the current session (not persisted between page loads).
- Duplicates of the immediately preceding command are not added.
- `↑` navigates backward; `↓` navigates forward (toward the most-recent command and then to an empty input).
- The current inputted (not-yet-submitted) text is saved so pressing `↓` past the end restores what the user was typing.

## Responsive Behaviour

The current design targets **desktop browsers only**. Mobile is unsupported (no touch input handling for the terminal).
