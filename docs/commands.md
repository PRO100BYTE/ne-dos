# Commands Reference

## System Commands

| Command | Description |
|---|---|
| `help [command]` | List all commands or show help for a specific command |
| `ver` | Display NE-DOS version |
| `cls` | Clear the terminal screen |
| `wait <ms>` | Pause execution for given milliseconds |
| `status` | Show system status |
| `reboot` | Reload the page (soft reboot) |
| `command` | Run an internal command (CMD.COM equivalent) |
| `registercommand` | Dynamically register a custom command |

## Filesystem Commands

| Command | Syntax | Description |
|---|---|---|
| `dir [path]` | `dir [C:\path]` | List directory contents |
| `cd <path>` | `cd C:\folder` | Change current directory |
| `mkdir <path>` | `mkdir C:\new` | Create directory |
| `type <file>` | `type C:\file.txt` | Print file contents |
| `del <file>` | `del C:\file.txt` | Delete a file |
| `rmdir <path>` | `rmdir C:\folder` | Remove a directory |
| `download <file>` | `download C:\file` | Download file to host OS |
| `upload` | `upload` | Upload a file into BrowserFS |

## General / Fun Commands

| Command | Description |
|---|---|
| `date` | Display current date |
| `time` | Display current time |
| `credits` | Show project credits |
| `github` | Open the GitHub repository |
| `www <url>` | Open a URL in the browser |
| `confetti` | Launch confetti animation |
| `httpcat <code>` | Show HTTP status cat image |
| `httpdog <code>` | Show HTTP status dog image |
| `matrix` | Display the Matrix rain effect |

## Utility Commands

| Command | Syntax | Description |
|---|---|---|
| `echo <text>` | `echo hello world` | Print text |
| `ip` | `ip` | Show public IP address |
| `geoip [ip]` | `geoip 8.8.8.8` | Geo-locate an IP |
| `geo` | `geo` | Show browser geolocation |
| `weather [city]` | `weather Moscow` | Show weather |
| `aboutme` | `aboutme` | Display user-agent info |
| `password <len>` | `password 16` | Generate random password |
| `base64 <enc\|dec> <text>` | `base64 enc hello` | Encode/decode Base64 |

## ECodeAPI

| Command | Description |
|---|---|
| `ecode <code>` | Look up an HTTP status code via ECodeAPI |

## TUI Applications (v1.3.0+)

| Command | Syntax | Description |
|---|---|---|
| `nc` | `nc` | Norton Commander–style two-panel file manager |
| `paint` | `paint [filename]` | ASCII/block-character paint program; opens `filename` from `/paint/` if given |
| `player` | `player [trackname]` | Music player; starts at `trackname` in `/music/` if given |
| `edit` | `edit [filepath]` | Fullscreen TUI text editor; creates or opens the given file |

## Input Features (v1.3.0+)

- **History navigation**: Press `↑` / `↓` arrows to cycle through previous commands.
- **Ctrl+C**: Cancel current input and show a new prompt.
- **Backspace**: Delete last character.
- **Empty Enter**: Pressing Enter on an empty line shows a new prompt (no error).
