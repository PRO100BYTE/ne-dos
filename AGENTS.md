# AGENTS.md — AI Agent Instructions for NE-DOS

This file provides guidance for autonomous AI coding agents (OpenAI Codex, Devin, etc.) working on the NE-DOS codebase.

## Repository Overview

NE-DOS is a React 18 single-page application. It renders a full-screen xterm.js terminal backed by a BrowserFS virtual filesystem. All commands are class instances registered in `src/registration.js`.

## Development Environment

```bash
# Install dependencies
npm install

# Start dev server
npm start          # runs git-info script first, then react-scripts start

# Production build
npm run build
```

**Do not use `npm` bare in PowerShell** — use `npm.cmd` if the execution policy blocks ps1 scripts.

## Code Conventions

- All commands are **ES6 classes** with at least `execute(term, params, currentDirectory, setDirectory)`.
- Add `description()` (returns a string) and `help(term)` to every command.
- Use `window.fs` (BrowserFS) for all filesystem operations.
- Path conversion: always use `PrepareInternal()` / `FormatDirectory()` from `StorageManager.js`.
- Do **not** use React hooks inside command classes — they run in plain JS context.
- Avoid `console.log` in commands; write to `term` instead.

## Where to Put New Code

| What | Where |
|---|---|
| New command | `src/commands/<Category>/mycommand.js` |
| Register command | `src/registration.js` |
| TUI application | `src/commands/Apps/myapp.js` |
| Global state / terminal init | `src/App.js` |
| BrowserFS config | `src/index.js` |

## Testing

There are no automated unit tests for commands (React Testing Library is available but unused for command logic). Manually test by running `npm start` and typing in the browser.

## Common Pitfalls

- BrowserFS `readFileSync` on a non-existent path throws — always check `existsSync` first.
- xterm writes need `\r\n` (CRLF), not just `\n`.
- TUI apps must dispose their `onData` listener before exiting or the shell input loop will be duplicated.
- The `FitAddon` is called once on mount; there is no resize handler — TUI apps should use static dimensions.

## Pull Request Guidelines

- Branch off `master` (or the active feature branch).
- Include a short description of what was added/changed.
- Do not run `git push --force` without explicit user approval.
