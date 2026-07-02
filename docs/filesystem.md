# Virtual Filesystem

NE-DOS uses [BrowserFS](https://github.com/jvilk/BrowserFS) to provide a POSIX-like filesystem inside the browser.

## Mount Configuration

```
/        AsyncMirror
           ├─ sync:  InMemory     (fast in-RAM working copy)
           └─ async: IndexedDB    (storeName: "NEDOS", persistent)

/temp    InMemory                 (session-only, cleared on reload)
```

All paths in command arguments use DOS conventions (`C:\folder\file.txt`). Internally, driver paths are POSIX (`/folder/file.txt`). Conversion is done by `StorageManager.js`.

## StorageManager Utilities

```js
// "C:\folder\sub"  →  "/folder/sub"
PrepareInternal(dosPath)

// "/folder/sub"  →  "C:\folder\sub"
FormatDirectory(posixPath)
```

## Accessing the Filesystem in Commands

After BrowserFS initialises (see `index.js`), the standard Node.js `fs` module is available as `window.fs` and `window.path`.

```js
// Read a file
const data = window.fs.readFileSync('/myfile.txt', 'utf8');

// Write a file
window.fs.writeFileSync('/myfile.txt', 'hello\n');

// List a directory
const entries = window.fs.readdirSync('/');

// Check existence
window.fs.existsSync('/myfile.txt');
```

All synchronous calls work because the in-memory layer is always in sync; the IndexedDB layer mirrors asynchronously.

## Temp Files Written on Startup

| Path | Content |
|---|---|
| `/temp/host` | `window.location.host` |
| `/temp/language` | `navigator.language` |
| `/temp/user-agent` | `navigator.userAgent` |
| `/temp/user-agent.json` | `navigator.userAgentData` JSON |
| `/temp/connection` | Network connection info JSON |

## Limitations

- Max practical storage depends on browser IndexedDB quota (usually several hundred MB).
- Binary file upload/download is supported via the `upload` / `download` commands.
- There is no real permission system; all files are world-readable/writable.
