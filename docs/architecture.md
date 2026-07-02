# Architecture

## Technology Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 |
| Terminal Emulator | xterm.js v5 + xterm-addon-fit |
| Virtual Filesystem | BrowserFS 1.x (IndexedDB-backed AsyncMirror) |
| Styling | styled-components v6 |
| Build Tool | Create React App (react-scripts 5) |

## High-Level Structure

```
src/
├── App.js              # Root component — terminal init, input loop, history
├── index.js            # React entry, BrowserFS mount, window.fs setup
├── registration.js     # Registers all command objects
├── versionGitInfo.json # Git metadata generated at build time
└── commands/
    ├── ECodeAPI/       # External API integration (ecode.js)
    ├── Filesystem/     # dir, cd, mkdir, cat, rm, rmdir, download, upload
    ├── General/        # Visual/fun commands: confetti, matrix, httpcat, ...
    ├── System/         # cls, ver, help, wait, reboot, status, command, ...
    ├── Utility/        # echo, ip, geo, geoip, weather, password, base64, ...
    └── Apps/           # TUI Applications: nc.js, paint.js, player.js
```

## Runtime Data Flow

```
User keystroke
    → xterm.js onData handler (App.js)
    → command string built (with history navigation)
    → Enter pressed → runCommand()
    → command lookup in window.registeredCommands
    → command.execute(term, parts, currentDirectory, setDirectory)
    → output written to xterm via term.writeln / term.write
    → prompt() redrawn
```

## Virtual Filesystem Mount Points

| Path | Driver | Notes |
|---|---|---|
| `/` | AsyncMirror (InMemory + IndexedDB) | Persistent user storage |
| `/temp` | InMemory | Cleared on page reload |

User files survive page reloads via IndexedDB store `NEDOS`.

## Command Registration

Every command is a class with at minimum:

```js
export default class MyCommand {
  execute(term, params, currentDirectory, setDirectory) { ... }
  description() { return "Short description shown in help"; }
}
```

Optional: `help(term)` for detailed per-command help via `help <command>`.

All commands are instantiated in `src/registration.js` and stored in `window.registeredCommands`.
