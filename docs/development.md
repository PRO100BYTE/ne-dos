# Development Guide

## Prerequisites

- Node.js 16 or newer
- npm 8+

## Install Dependencies

```bash
npm install
```

## Run in Development Mode

```bash
npm start
```

Opens at `http://localhost:3000`. Hot reloading is enabled.

## Production Build

```bash
npm run build
```

Output goes to `build/`. The `git-info` script runs first to embed the current commit hash and branch into `src/versionGitInfo.json`.

## Git Info Script

`scripts/gitInfo.js` writes `src/versionGitInfo.json` before each build/start:

```json
{
  "gitBranch": "master",
  "gitCommitHash": "abc1234",
  "date": "2024-01-01T00:00:00.000Z"
}
```

At runtime this is exposed as `window.VERSION` and `window.BUILD_DATE`.

## Adding a New Command

1. Create a file in the appropriate category under `src/commands/`:

```js
export default class MyCommand {
  description() { return "What my command does"; }
  help(term) { term.writeln("Usage: mycommand <arg>"); }
  execute(term, params, currentDirectory, setDirectory) {
    term.writeln("Hello from MyCommand!");
  }
}
```

2. Import it and register it in `src/registration.js`:

```js
import MyCommand from "./commands/Category/mycommand";
// ...
registeredCommands['mycommand'] = new MyCommand();
```

## Adding a TUI Application

TUI apps follow the same command interface but take full control of the terminal for their lifetime.

Recommended patterns:

- Use xterm's `onData` to receive raw key events.
- Draw UI using `term.write('\x1b[H\x1b[2J')` (clear) + box-drawing characters.
- Store the original `onData` disposable and dispose it on exit.
- Call `prompt(term)` after the app exits to restore the shell prompt.

See `src/commands/Apps/nc.js`, `paint.js`, `player.js` for reference implementations.

## Linting

ESLint is configured via `react-app` preset. Run:

```bash
npm run test
```

## Project Conventions

- Class-based commands (no function-only exports) for consistency.
- All filesystem paths go through `StorageManager.PrepareInternal` / `FormatDirectory`.
- Async commands should `await` their operations and be marked `async execute(...)`.
- Avoid raw `console.log` in commands — write to `term` instead.
