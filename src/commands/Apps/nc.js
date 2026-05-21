import path from "path-browserify";
import { PrepareInternal, FormatDirectory } from "../Filesystem/StorageManager";
import bytes from "bytes";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const ESC = '\x1b';
const CSI = ESC + '[';
const RESET = CSI + '0m';
const BOLD = CSI + '1m';
const DIM = CSI + '2m';
const REVERSE = CSI + '7m';
const FG_WHITE = CSI + '37m';
const FG_CYAN = CSI + '36m';
const FG_YELLOW = CSI + '33m';
const FG_RED = CSI + '31m';
const FG_BLACK = CSI + '30m';
const BG_BLUE = CSI + '44m';
const BG_CYAN = CSI + '46m';
const BG_BLACK = CSI + '40m';

const goto = (row, col) => `${CSI}${row};${col}H`;
const clearScreen = () => `${CSI}2J${CSI}H`;
const hideCursor = () => `${CSI}?25l`;
const showCursor = () => `${CSI}?25h`;

// Box-drawing chars
const TL = '╔', TR = '╗', BL = '╚', BR = '╝';
const H = '═', V = '║';
const LT = '╠', RT = '╣', TT = '╦', BT = '╩', CR = '╬';
const tl = '┌', tr = '┐', bl = '└', br = '┘';
const h = '─', v = '│';

function repeat(ch, n) { return ch.repeat(n); }

// ─── NC Command ───────────────────────────────────────────────────────────────
export default class NcCommand {
  description() { return "Norton Commander — two-panel file manager"; }
  help(term) {
    term.writeln("Usage: nc");
    term.writeln("  Tab        Switch panel");
    term.writeln("  ↑↓         Move cursor");
    term.writeln("  Enter      Open directory");
    term.writeln("  Backspace  Go to parent");
    term.writeln("  F5         Copy file to other panel");
    term.writeln("  F6         Move/rename file");
    term.writeln("  F7         Create directory");
    term.writeln("  F8         Delete file/directory");
    term.writeln("  F10/Esc    Quit");
  }

  execute(term, params, currentDirectory, setDirectory) {
    // Use actual terminal dimensions
    const COLS = term.cols;
    const ROWS = term.rows;
    const PANEL_W = Math.floor(COLS / 2) - 2;
    const PANEL_H = ROWS - 5;

    // Suppress shell input handler while NC is running
    if (term._setAppMode) term._setAppMode(true);

    const state = {
      panels: [
        { dir: PrepareInternal(currentDirectory), entries: [], cursor: 0, scroll: 0 },
        { dir: '/', entries: [], cursor: 0, scroll: 0 },
      ],
      active: 0,
      status: 'Tab:Switch  F5:Copy  F6:Move  F7:MkDir  F8:Del  F10:Quit',
      inputMode: null, // null | 'mkdir' | 'rename' | 'confirm-del'
      inputBuffer: '',
      inputPrompt: '',
    };

    const loadPanel = (idx) => {
      const p = state.panels[idx];
      try {
        let entries = window.fs.readdirSync(p.dir).sort();
        p.entries = entries.map(name => {
          try {
            const fullPath = path.join(p.dir, name);
            const stat = window.fs.statSync(fullPath);
            return { name, isDir: stat.isDirectory(), size: stat.size };
          } catch {
            return { name, isDir: false, size: 0 };
          }
        });
        // sort: dirs first, then files
        p.entries.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });
        // prepend ".." unless root
        if (p.dir !== '/') {
          p.entries.unshift({ name: '..', isDir: true, size: 0 });
        }
      } catch {
        p.entries = [];
      }
      if (p.cursor >= p.entries.length) p.cursor = Math.max(0, p.entries.length - 1);
    };

    const listRows = PANEL_H - 2; // rows available for file listing

    const renderPanel = (idx, startCol) => {
      const p = state.panels[idx];
      const isActive = idx === state.active;
      const colFg = isActive ? FG_CYAN : FG_WHITE;
      const colFrame = isActive ? (BOLD + FG_CYAN) : (DIM + FG_WHITE);
      let out = '';

      // Top border with path
      const dirLabel = ` ${FormatDirectory(p.dir)} `;
      const padLeft = Math.max(0, Math.floor((PANEL_W - dirLabel.length) / 2));
      const padRight = Math.max(0, PANEL_W - dirLabel.length - padLeft);
      out += goto(1, startCol) + colFrame;
      out += tl + repeat(h, padLeft) + BOLD + FG_YELLOW + dirLabel + colFrame + repeat(h, padRight) + tr + RESET;

      // File rows
      for (let r = 0; r < listRows; r++) {
        const entryIdx = r + p.scroll;
        const isCursor = entryIdx === p.cursor;
        const entry = p.entries[entryIdx];
        out += goto(2 + r, startCol);
        if (!entry) {
          out += v + ' '.repeat(PANEL_W) + v + RESET;
          continue;
        }
        const sizeTxt = entry.isDir ? '<DIR>' : (bytes(entry.size) || '0B');
        const nameMax = PANEL_W - sizeTxt.length - 3;
        const truncName = entry.name.length > nameMax ? entry.name.slice(0, nameMax - 1) + '…' : entry.name;
        const namePad = truncName.padEnd(nameMax, ' ');
        const line = ` ${namePad} ${sizeTxt} `;
        if (isCursor && isActive) {
          out += v + REVERSE + FG_BLACK + BG_CYAN + line + RESET + v;
        } else if (isCursor) {
          out += v + REVERSE + line + RESET + v;
        } else if (entry.isDir) {
          out += v + (isActive ? FG_YELLOW : DIM + FG_YELLOW) + line + RESET + v;
        } else {
          out += v + (isActive ? FG_WHITE : DIM + FG_WHITE) + line + RESET + v;
        }
      }

      // Bottom border
      out += goto(2 + listRows, startCol) + colFrame;
      out += bl + repeat(h, PANEL_W) + br + RESET;
      return out;
    };

    const render = () => {
      let out = hideCursor() + clearScreen();

      // Two panels side by side with separator
      out += renderPanel(0, 1);
      out += renderPanel(1, PANEL_W + 3);

      // Middle vertical separator (draw over panel borders)
      const sepCol = PANEL_W + 2;
      for (let r = 1; r <= listRows + 2; r++) {
        out += goto(r, sepCol);
        if (r === 1) out += DIM + FG_WHITE + TT + RESET;
        else if (r === listRows + 2) out += DIM + FG_WHITE + BT + RESET;
        else out += DIM + FG_WHITE + V + RESET;
      }

      // Status / input row
      out += goto(ROWS - 1, 1);
      if (state.inputMode) {
        out += BG_BLUE + FG_WHITE + BOLD;
        const prompt = ` ${state.inputPrompt}: ${state.inputBuffer}█ `;
        out += prompt.padEnd(COLS, ' ') + RESET;
      } else {
        out += BG_BLUE + FG_WHITE;
        out += (' ' + state.status).padEnd(COLS, ' ') + RESET;
      }

      // Function-key bar
      const fkeys = [
        ['1Help','2Menu','3View','4Edit','5Copy','6Move','7MkDir','8Del','9PullDn','10Quit']
      ].flat();
      out += goto(ROWS, 1) + BG_BLACK + FG_WHITE;
      let bar = '';
      fkeys.forEach((k) => {
        const num = k.match(/^(\d+)/)[1];
        const label = k.slice(num.length);
        bar += RESET + BG_BLACK + FG_YELLOW + num + RESET + BG_CYAN + FG_BLACK + label + ' ';
      });
      out += bar + RESET;

      term.write(out);
    };

    // Initial load
    loadPanel(0);
    loadPanel(1);
    render();

    const ap = () => state.panels[state.active];

    const ensureScroll = () => {
      const p = ap();
      if (p.cursor < p.scroll) p.scroll = p.cursor;
      if (p.cursor >= p.scroll + listRows) p.scroll = p.cursor - listRows + 1;
    };

    const enterDir = (p, name) => {
      if (name === '..') {
        p.dir = path.dirname(p.dir) || '/';
      } else {
        p.dir = path.join(p.dir, name);
      }
      p.cursor = 0;
      p.scroll = 0;
      loadPanel(state.panels.indexOf(p));
    };

    const disposable = term.onData((key) => {
      // Input mode (mkdir / rename prompt)
      if (state.inputMode) {
        if (key === '\r') {
          const val = state.inputBuffer.trim();
          if (val) {
            try {
              if (state.inputMode === 'mkdir') {
                window.fs.mkdirSync(path.join(ap().dir, val));
                state.status = `Directory created: ${val}`;
              } else if (state.inputMode === 'rename') {
                const src = path.join(ap().dir, state.renameTarget);
                const dst = path.join(ap().dir, val);
                window.fs.renameSync(src, dst);
                state.status = `Renamed to: ${val}`;
              } else if (state.inputMode === 'copy-dest') {
                const src = path.join(ap().dir, state.copyTarget);
                const other = state.panels[1 - state.active];
                const dst = path.join(other.dir, val || state.copyTarget);
                const data = window.fs.readFileSync(src);
                window.fs.writeFileSync(dst, data);
                state.status = `Copied to: ${dst}`;
                loadPanel(1 - state.active);
              }
            } catch (e) {
              state.status = `Error: ${e.message}`;
            }
            loadPanel(state.active);
          }
          state.inputMode = null;
          state.inputBuffer = '';
        } else if (key === '\x1b') {
          state.inputMode = null;
          state.inputBuffer = '';
        } else if (key === '\u007F') {
          state.inputBuffer = state.inputBuffer.slice(0, -1);
        } else if (key.length === 1 && key >= ' ') {
          state.inputBuffer += key;
        }
        render();
        return;
      }

      switch (key) {
        // Quit
        case '\x1b':
        case '\x1b[21~': // F10
          if (term._setAppMode) term._setAppMode(false);
          disposable.dispose();
          term.write(showCursor() + clearScreen());
          setDirectory(PrepareInternal(ap().dir));
          return;

        // Navigation
        case '\x1b[A': // Up
          ap().cursor = Math.max(0, ap().cursor - 1);
          ensureScroll();
          break;
        case '\x1b[B': // Down
          ap().cursor = Math.min(ap().entries.length - 1, ap().cursor + 1);
          ensureScroll();
          break;

        // Switch panel
        case '\t':
          state.active = 1 - state.active;
          break;

        // Enter directory
        case '\r': {
          const p = ap();
          const entry = p.entries[p.cursor];
          if (entry && entry.isDir) enterDir(p, entry.name);
          break;
        }

        // Backspace — go up
        case '\u007F':
        case '\x7f':
          if (ap().dir !== '/') enterDir(ap(), '..');
          break;

        // F5 — Copy
        case '\x1b[15~': {
          const entry = ap().entries[ap().cursor];
          if (entry && !entry.isDir && entry.name !== '..') {
            const other = state.panels[1 - state.active];
            try {
              const src = path.join(ap().dir, entry.name);
              const dst = path.join(other.dir, entry.name);
              const data = window.fs.readFileSync(src);
              window.fs.writeFileSync(dst, data);
              state.status = `Copied: ${entry.name}`;
              loadPanel(1 - state.active);
            } catch (e) {
              state.status = `Copy error: ${e.message}`;
            }
          }
          break;
        }

        // F6 — Move/rename
        case '\x1b[17~': {
          const entry = ap().entries[ap().cursor];
          if (entry && entry.name !== '..') {
            state.inputMode = 'rename';
            state.inputBuffer = entry.name;
            state.renameTarget = entry.name;
            state.inputPrompt = 'Rename to';
          }
          break;
        }

        // F7 — MkDir
        case '\x1b[18~':
          state.inputMode = 'mkdir';
          state.inputBuffer = '';
          state.inputPrompt = 'New directory name';
          break;

        // F8 — Delete
        case '\x1b[19~': {
          const entry = ap().entries[ap().cursor];
          if (entry && entry.name !== '..') {
            try {
              const target = path.join(ap().dir, entry.name);
              if (entry.isDir) {
                window.fs.rmdirSync(target);
              } else {
                window.fs.unlinkSync(target);
              }
              state.status = `Deleted: ${entry.name}`;
              loadPanel(state.active);
            } catch (e) {
              state.status = `Delete error: ${e.message}`;
            }
          }
          break;
        }

        default:
          break;
      }
      render();
    });
  }
}
