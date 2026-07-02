# COPILOT.md — GitHub Copilot Instructions for NE-DOS

This file is referenced by `.github/copilot-instructions.md` (or used directly) to give GitHub Copilot context about the project.

## Project Summary

NE-DOS is a React 18 single-page application that renders a full-screen xterm.js terminal with a BrowserFS-backed virtual filesystem. Users interact via a DOS-like command line.

## Architecture

- **Terminal**: xterm.js v5 with `FitAddon`. Renders inside a full-viewport `<div>`.
- **Commands**: Class instances stored in `window.registeredCommands`. Each has `execute(term, params, currentDir, setDir)`.
- **Filesystem**: BrowserFS — `window.fs` is the `fs` module, `window.path` is `path-browserify`.
- **History**: In-memory array in `App.js`; `↑`/`↓` keys navigate it.

## Code Patterns

### Typical command class

```js
import { PrepareInternal, FormatDirectory } from "../Filesystem/StorageManager";

export default class FooCommand {
  description() { return "Does foo things"; }
  help(term) { term.writeln("Usage: foo <arg>"); }
  execute(term, params, currentDirectory, setDirectory) {
    const arg = params[1] || "default";
    term.writeln(`Foo: ${arg}`);
  }
}
```

### Writing to terminal (always use CRLF)

```js
term.writeln("line of text");     // adds \r\n automatically
term.write("no newline");
term.write("\r\nmanual newline");
```

### ANSI colours

```js
term.write("\x1b[32mGreen text\x1b[0m");
term.write("\x1b[1;37;44mBold white on blue\x1b[0m");
```

### Filesystem access

```js
if (window.fs.existsSync("/myfile.txt")) {
  const content = window.fs.readFileSync("/myfile.txt", "utf8");
}
window.fs.writeFileSync("/out.txt", "data");
```

### Async command

```js
async execute(term, params, currentDirectory, setDirectory) {
  const result = await fetch("https://api.example.com/data");
  const json = await result.json();
  term.writeln(JSON.stringify(json, null, 2));
}
```

## TUI App Template

```js
export default class MyApp {
  description() { return "My TUI app"; }
  execute(term, params, currentDirectory, setDirectory) {
    // Clear screen
    term.write("\x1b[2J\x1b[H");
    // Hide cursor
    term.write("\x1b[?25l");

    // Draw UI
    this._draw(term);

    // Take over input
    const disposable = term.onData((key) => {
      if (key === "\x1b" || key === "\x1b[21~") { // Esc or F10
        disposable.dispose();
        term.write("\x1b[?25h"); // show cursor
        term.write("\x1b[2J\x1b[H");
        // The shell's prompt() will be called by App.js after execute() returns
        return;
      }
      // handle other keys...
      this._draw(term);
    });
  }
  _draw(term) { /* ... */ }
}
```

## Conventions

- Paths: DOS-style in user-facing text (`C:\folder`), POSIX internally (`/folder`).
- No TypeScript — project uses plain JS (CRA without eject).
- No new npm packages without user approval.
- All output to terminal, not `console.log`.
