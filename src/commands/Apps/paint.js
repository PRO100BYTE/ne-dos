import path from "path-browserify";
import { GetDriveRoot } from "../Filesystem/StorageManager";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const ESC = '\x1b';
const CSI = ESC + '[';
const RESET = CSI + '0m';
const BOLD = CSI + '1m';
const FG_WHITE = CSI + '37m';
const FG_CYAN = CSI + '36m';
const FG_YELLOW = CSI + '33m';
const FG_GREEN = CSI + '32m';
const FG_RED = CSI + '31m';
const FG_BLACK = CSI + '30m';
const FG_MAGENTA = CSI + '35m';
const FG_BLUE = CSI + '34m';
const BG_BLACK = CSI + '40m';
const BG_BLUE = CSI + '44m';
const BG_CYAN = CSI + '46m';
const BG_GREEN = CSI + '42m';
const BG_RED = CSI + '41m';
const BG_MAGENTA = CSI + '45m';
const BG_YELLOW = CSI + '43m';
const BG_WHITE = CSI + '47m';
const REVERSE = CSI + '7m';

const goto = (r, c) => `${CSI}${r};${c}H`;
const clearScreen = () => `${CSI}2J${CSI}H`;
const hideCursor = () => `${CSI}?25l`;
const showCursor = () => `${CSI}?25h`;

// ─── Canvas dimensions are computed dynamically inside execute() ─────────────
const CANVAS_ORIGIN_ROW = 4;
const CANVAS_ORIGIN_COL = 7; // left of canvas border; palette occupies cols 1-5

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = [
  { fg: FG_WHITE,   bg: BG_BLACK,   label: '█', name: 'White/Blk' },
  { fg: FG_RED,     bg: BG_BLACK,   label: '█', name: 'Red/Blk'   },
  { fg: FG_GREEN,   bg: BG_BLACK,   label: '█', name: 'Grn/Blk'   },
  { fg: FG_YELLOW,  bg: BG_BLACK,   label: '█', name: 'Yel/Blk'   },
  { fg: FG_BLUE,    bg: BG_BLACK,   label: '█', name: 'Blu/Blk'   },
  { fg: FG_MAGENTA, bg: BG_BLACK,   label: '█', name: 'Mag/Blk'   },
  { fg: FG_CYAN,    bg: BG_BLACK,   label: '█', name: 'Cyn/Blk'   },
  { fg: FG_BLACK,   bg: BG_WHITE,   label: '█', name: 'Blk/Wht'   },
];

// ─── Brushes ──────────────────────────────────────────────────────────────────
const BRUSHES = ['█', '▓', '▒', '░', '■', '●', '◆', '★', '▲', '+', '-', '|', '.', '#', '@'];

// ─── Paint command ────────────────────────────────────────────────────────────
export default class PaintCommand {
  description() { return "ASCII paint — draw with block characters"; }
  help(term) {
    term.writeln("Usage: paint [filename]");
    term.writeln("  Arrow keys  Move cursor");
    term.writeln("  Space       Draw with current brush");
    term.writeln("  b           Cycle brush character");
    term.writeln("  c           Cycle colour");
    term.writeln("  s           Save canvas to current drive \\paint");
    term.writeln("  l           Load canvas from BrowserFS");
    term.writeln("  n           New (clear canvas)");
    term.writeln("  Esc         Exit paint");
  }

  execute(term, params, currentDirectory, setDirectory) {
    return new Promise((resolve) => {
    // Use actual terminal dimensions
    const COLS = term.cols;
    const ROWS = term.rows;
    // Canvas fills the available space                  
    // left panel: 5 cols (palette+space), right panel: 4 cols (space+brush+space)
    const CANVAS_W = Math.max(20, COLS - CANVAS_ORIGIN_COL - 5);
    const CANVAS_H = Math.max(8, ROWS - CANVAS_ORIGIN_ROW - 2);
    const driveRoot = GetDriveRoot(currentDirectory);
    const paintDir = (driveRoot === '/' ? '/paint' : `${driveRoot}/paint`);
    // Suppress shell input handler while Paint is running
    if (term._setAppMode) term._setAppMode(true);

    // Initialise empty canvas
    const canvas = [];
    const colors = [];
    for (let r = 0; r < CANVAS_H; r++) {
      canvas.push(Array(CANVAS_W).fill(' '));
      colors.push(Array(CANVAS_W).fill(0)); // index into PALETTE
    }

    let modified = false;

    const state = {
      cursorRow: 0,
      cursorCol: 0,
      brushIdx: 0,
      colorIdx: 0,
      status: "Arrows:Move  Space:Draw  b:Brush  c:Color  s:Save  l:Load  n:New  Esc:Quit",
      inputMode: null, // 'save' | 'load' | 'confirm-exit'
      inputBuffer: '',
      inputPrompt: '',
      filename: params[1] || 'picture',
    };

    // ── Ensure /paint directory exists ────────────────────────────────────────
    try {
      if (!window.fs.existsSync(paintDir)) window.fs.mkdirSync(paintDir);
    } catch {}

    // ── Renderers ─────────────────────────────────────────────────────────────
    const renderCell = (r, c) => {
      const ch = canvas[r][c];
      const pal = PALETTE[colors[r][c]];
      const isCursor = r === state.cursorRow && c === state.cursorCol;
      let out = goto(CANVAS_ORIGIN_ROW + r, CANVAS_ORIGIN_COL + c);
      if (isCursor) {
        out += REVERSE + pal.fg + (ch === ' ' ? '▌' : ch) + RESET;
      } else {
        out += pal.fg + ch + RESET;
      }
      return out;
    };

    const renderCanvas = () => {
      let out = '';
      for (let r = 0; r < CANVAS_H; r++) {
        out += goto(CANVAS_ORIGIN_ROW + r, CANVAS_ORIGIN_COL);
        for (let c = 0; c < CANVAS_W; c++) {
          const ch = canvas[r][c];
          const pal = PALETTE[colors[r][c]];
          const isCursor = r === state.cursorRow && c === state.cursorCol;
          if (isCursor) {
            out += REVERSE + pal.fg + (ch === ' ' ? '▌' : ch) + RESET;
          } else {
            out += pal.fg + ch + RESET;
          }
        }
      }
      return out;
    };

    const renderToolbar = () => {
      let out = '';
      // Title bar
      out += goto(1, 1) + BG_BLUE + FG_WHITE + BOLD;
      out += '╔' + '═'.repeat(COLS - 2) + '╗' + RESET;
      out += goto(2, 1) + BG_BLUE + FG_WHITE + BOLD;
      const title = `║  NE-PAINT  │ File: ${state.filename}.txt  │ Brush: ${BRUSHES[state.brushIdx]}  │ Color: ${PALETTE[state.colorIdx].name}  `;
      out += title.padEnd(COLS - 1, ' ') + '║' + RESET;
      out += goto(3, 1) + BG_BLUE + FG_WHITE + BOLD + '╚' + '═'.repeat(COLS - 2) + '╝' + RESET;

      // Palette swatch column (left margin)
      for (let i = 0; i < PALETTE.length; i++) {
        const p = PALETTE[i];
        const row = CANVAS_ORIGIN_ROW + i;
        out += goto(row, 1);
        if (i === state.colorIdx) {
          out += REVERSE + p.fg + '██' + RESET;
        } else {
          out += p.fg + '██' + RESET;
        }
        out += '  ';
      }

      // Brush samples column (right margin)
      for (let i = 0; i < Math.min(BRUSHES.length, CANVAS_H); i++) {
        out += goto(CANVAS_ORIGIN_ROW + i, CANVAS_ORIGIN_COL + CANVAS_W + 2);
        if (i === state.brushIdx) {
          out += REVERSE + FG_WHITE + BRUSHES[i] + RESET;
        } else {
          out += FG_WHITE + BRUSHES[i] + RESET;
        }
      }

      // Canvas border
      out += goto(CANVAS_ORIGIN_ROW - 1, CANVAS_ORIGIN_COL - 1) + FG_WHITE;
      out += '┌' + '─'.repeat(CANVAS_W) + '┐' + RESET;
      for (let r = 0; r < CANVAS_H; r++) {
        out += goto(CANVAS_ORIGIN_ROW + r, CANVAS_ORIGIN_COL - 1) + FG_WHITE + '│' + RESET;
        out += goto(CANVAS_ORIGIN_ROW + r, CANVAS_ORIGIN_COL + CANVAS_W) + FG_WHITE + '│' + RESET;
      }
      out += goto(CANVAS_ORIGIN_ROW + CANVAS_H, CANVAS_ORIGIN_COL - 1) + FG_WHITE;
      out += '└' + '─'.repeat(CANVAS_W) + '┘' + RESET;

      return out;
    };

    const renderStatus = () => {
      let out = goto(ROWS, 1) + BG_BLUE + FG_WHITE;
      if (state.inputMode) {
        out += ` ${state.inputPrompt}: ${state.inputBuffer}█`.padEnd(COLS, ' ');
      } else {
        out += (' ' + state.status).padEnd(COLS, ' ');
      }
      out += RESET;
      return out;
    };

    const render = (fullRedraw = false, prevRow = -1, prevCol = -1) => {
      let out = hideCursor();
      if (fullRedraw) {
        out += clearScreen() + renderToolbar() + renderCanvas();
      } else {
        // Redraw the OLD cursor cell first to remove highlight, then the new one
        if (prevRow >= 0 && prevCol >= 0 && (prevRow !== state.cursorRow || prevCol !== state.cursorCol)) {
          out += renderCell(prevRow, prevCol);
        }
        out += renderCell(state.cursorRow, state.cursorCol);
      }
      out += renderStatus();
      term.write(out);
    };

    // ── Save / load ───────────────────────────────────────────────────────────
    const saveCanvas = (name) => {
      try {
        const lines = canvas.map(row => row.join(''));
        window.fs.writeFileSync(`${paintDir}/${name}.txt`, lines.join('\n'));
        state.status = `Saved to ${paintDir}/${name}.txt`;
        state.filename = name;
        modified = false;
      } catch (e) {
        state.status = `Save error: ${e.message}`;
      }
    };

    const loadCanvas = (name) => {
      try {
        const raw = window.fs.readFileSync(`${paintDir}/${name}.txt`, 'utf8');
        const lines = raw.split('\n');
        for (let r = 0; r < CANVAS_H; r++) {
          const line = (lines[r] || '').split('');
          for (let c = 0; c < CANVAS_W; c++) {
            canvas[r][c] = line[c] || ' ';
            colors[r][c] = 0;
          }
        }
        state.status = `Loaded ${paintDir}/${name}.txt`;
        state.filename = name;
      } catch (e) {
        state.status = `Load error: ${e.message}`;
      }
    };

    // ── Initial render ────────────────────────────────────────────────────────
    render(true);

    const disposable = term.onData((key) => {
      // Input mode
      if (state.inputMode) {
        if (state.inputMode === 'confirm-exit') {
          const k = key.toLowerCase();
          if (k === 'y') {
            // Save then exit
            saveCanvas(state.filename);
            if (term._setAppMode) term._setAppMode(false);
            disposable.dispose();
            term.write(showCursor() + clearScreen());
            resolve();
          } else if (k === 'n') {
            // Exit without saving
            if (term._setAppMode) term._setAppMode(false);
            disposable.dispose();
            term.write(showCursor() + clearScreen());
            resolve();
          } else if (k === 'c' || key === '\x1b') {
            // Cancel
            state.inputMode = null;
            state.status = "Arrows:Move  Space:Draw  b:Brush  c:Color  s:Save  l:Load  n:New  Esc:Quit";
            render(false);
          }
          return;
        }
        if (key === '\r') {
          const val = state.inputBuffer.trim() || state.filename;
          if (state.inputMode === 'save') { saveCanvas(val); modified = false; }
          else loadCanvas(val);
          state.inputMode = null;
          state.inputBuffer = '';
          render(true);
        } else if (key === '\x1b') {
          state.inputMode = null;
          state.inputBuffer = '';
          render(false);
        } else if (key === '\u007F') {
          state.inputBuffer = state.inputBuffer.slice(0, -1);
          render(false);
        } else if (key.length === 1 && key >= ' ') {
          state.inputBuffer += key;
          render(false);
        }
        return;
      }

      let prevRow = state.cursorRow;
      let prevCol = state.cursorCol;
      let needFullRedraw = false;

      switch (key) {
        case '\x1b': // Esc — quit (with unsaved check)
          if (modified) {
            state.inputMode = 'confirm-exit';
            state.status = 'Unsaved changes! Save? [Y]es / [N]o / [C]ancel';
            render(false);
            return;
          }
          if (term._setAppMode) term._setAppMode(false);
          disposable.dispose();
          term.write(showCursor() + clearScreen());
          resolve();
          return;

        // Movement
        case '\x1b[A': state.cursorRow = Math.max(0, state.cursorRow - 1); break;
        case '\x1b[B': state.cursorRow = Math.min(CANVAS_H - 1, state.cursorRow + 1); break;
        case '\x1b[C': state.cursorCol = Math.min(CANVAS_W - 1, state.cursorCol + 1); break;
        case '\x1b[D': state.cursorCol = Math.max(0, state.cursorCol - 1); break;

        // Draw
        case ' ':
          canvas[state.cursorRow][state.cursorCol] = BRUSHES[state.brushIdx];
          colors[state.cursorRow][state.cursorCol] = state.colorIdx;
          modified = true;
          break;

        // Erase (Delete key)
        case '\x1b[3~':
          canvas[state.cursorRow][state.cursorCol] = ' ';
          modified = true;
          break;

        // Cycle brush
        case 'b': case 'B':
          state.brushIdx = (state.brushIdx + 1) % BRUSHES.length;
          needFullRedraw = true;
          break;

        // Cycle colour
        case 'c': case 'C':
          state.colorIdx = (state.colorIdx + 1) % PALETTE.length;
          needFullRedraw = true;
          break;

        // Save
        case 's': case 'S':
          state.inputMode = 'save';
          state.inputBuffer = state.filename;
          state.inputPrompt = 'Save as';
          render(false);
          return;

        // Load
        case 'l': case 'L':
          state.inputMode = 'load';
          state.inputBuffer = state.filename;
          state.inputPrompt = 'Load file';
          render(false);
          return;

        // New (clear)
        case 'n': case 'N':
          for (let r = 0; r < CANVAS_H; r++)
            for (let c = 0; c < CANVAS_W; c++) {
              canvas[r][c] = ' ';
              colors[r][c] = 0;
            }
          modified = false;
          state.status = 'Canvas cleared';
          needFullRedraw = true;
          break;

        default:
          // Direct char draw
          if (key.length === 1 && key >= ' ' && key <= '~') {
            canvas[state.cursorRow][state.cursorCol] = key;
            colors[state.cursorRow][state.cursorCol] = state.colorIdx;
            state.cursorCol = Math.min(CANVAS_W - 1, state.cursorCol + 1);
            modified = true;
          }
          break;
      }

      render(needFullRedraw, prevRow, prevCol);
    });
    }); // end Promise
  }
}
