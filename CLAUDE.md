# CLAUDE.md — Claude / Anthropic Agent Instructions for NE-DOS

> Read this file before making any changes to the NE-DOS codebase.

## Project in One Sentence

NE-DOS is a browser-based DOS terminal emulator (React + xterm.js + BrowserFS) where users type commands to interact with a virtual filesystem and run fun/utility programs.

## Key Files

| File | Purpose |
|---|---|
| `src/App.js` | Terminal init, input loop, history, `runCommand()` |
| `src/index.js` | BrowserFS mount, `window.fs` setup |
| `src/registration.js` | Instantiates and registers all commands |
| `src/commands/**/*.js` | Individual command implementations |
| `docs/` | Full project documentation |
| `DESIGN.md` | Visual/UX design decisions |

## How to Add a Feature

### New command
1. Create `src/commands/<Category>/name.js` with a default-exported ES6 class.
2. Required: `execute(term, params, currentDir, setDir)`, `description()`.
3. Optional: `help(term)`.
4. Register in `src/registration.js`.

### New TUI app
See [docs/apps.md](docs/apps.md) and the pattern used in `src/commands/Apps/nc.js`.

Key requirements:
- Save and dispose the `term.onData` listener when entering the app.
- Re-register the shell's `onData` when exiting.
- Clear screen with `\x1b[2J\x1b[H` before drawing.
- Restore cursor and call `prompt(term)` on exit.

## Coding Style

- ES6+ classes, no TypeScript.
- Arrow functions for callbacks.
- `async/await` for async commands.
- No external libraries beyond what is already in `package.json` — ask before adding.

## What NOT to Do

- Do not modify `public/index.html` unless absolutely required.
- Do not add TypeScript, it would require ejecting CRA.
- Do not persist sensitive data to BrowserFS without explicit user intent.
- Do not add tracking, analytics, or external telemetry.
- Do not generate `window.fs.writeFileSync` calls that could overwrite `/temp/` boot files on every command execution — those are written once at startup.

## Running the Project

```bash
npm.cmd install     # Windows PowerShell safe
npm.cmd start
npm.cmd run build
```

## Useful Context

- `window.registeredCommands` is the live command registry (accessible from the browser console for debugging).
- `window.fs` is the BrowserFS `fs` module.
- `window.path` is `path-browserify`.
- The terminal object (`term`) is a local variable inside the `useEffect` in `App.js` — commands receive it as a parameter.
