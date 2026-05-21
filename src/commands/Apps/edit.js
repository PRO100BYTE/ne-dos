import path from "path-browserify";
import { PrepareInternal, FormatDirectory } from "../Filesystem/StorageManager";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const CSI     = '\x1b[';
const RESET   = CSI + '0m';
const BOLD    = CSI + '1m';
const DIM     = CSI + '2m';
const REVERSE = CSI + '7m';
const FG_WHITE   = CSI + '37m';
const FG_CYAN    = CSI + '36m';
const FG_YELLOW  = CSI + '33m';
const FG_GREEN   = CSI + '32m';
const FG_RED     = CSI + '31m';
const FG_BLACK   = CSI + '30m';
const FG_BLUE    = CSI + '34m';
const BG_BLUE    = CSI + '44m';
const BG_BLACK   = CSI + '40m';

const goto        = (r, c) => `${CSI}${r};${c}H`;
const clearScreen = ()     => `${CSI}2J${CSI}H`;
const hideCursor  = ()     => `${CSI}?25l`;
const showCursor  = ()     => `${CSI}?25h`;
const rep         = (ch, n) => n > 0 ? ch.repeat(Math.max(0, n)) : '';

// ─── Edit Command ─────────────────────────────────────────────────────────────
export default class EditCommand {
  description() { return "NE-EDIT — fullscreen text editor with TUI"; }
  help(term) {
    term.writeln("Usage: edit [filename]");
    term.writeln("");
    term.writeln("  Arrow keys   Move cursor");
    term.writeln("  Home / End   Start / end of line");
    term.writeln("  PgUp / PgDn  Scroll page");
    term.writeln("  Ctrl+S       Save file");
    term.writeln("  Ctrl+X       Save and exit");
    term.writeln("  Ctrl+Q       Quit without saving");
    term.writeln("  Enter        New line");
    term.writeln("  Backspace    Delete char before cursor");
    term.writeln("  Delete       Delete char at cursor");
    term.writeln("  Tab          Insert 4 spaces");
  }

  execute(term, params, currentDirectory, setDirectory) {
    return new Promise((resolve) => {
    const COLS = term.cols;
    const ROWS = term.rows;
    if (term._setAppMode) term._setAppMode(true);

    // ── File bootstrap ────────────────────────────────────────────────────────
    let filename = params[1] ? PrepareInternal(
      params[1].startsWith('/') ? params[1]
        : path.join(currentDirectory, params[1])
    ) : null;

    let lines = [''];
    if (filename) {
      try {
        const raw = window.fs.readFileSync(filename, 'utf8');
        lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        if (lines.length === 0) lines = [''];
      } catch {
        lines = ['']; // new file
      }
    }

    let modified = false;

    // ── Editor state ──────────────────────────────────────────────────────────
    const state = {
      curRow: 0,       // cursor row in document
      curCol: 0,       // cursor col in document
      scrollRow: 0,    // first visible row
      scrollCol: 0,    // first visible col (horizontal scroll)
      status:  '',     // status bar message
      inputMode: null, // 'save-as'
      inputBuffer: '',
    };

    // Visible rows for text (between header and footer)
    const EDIT_ROWS = ROWS - 3;    // rows 2..ROWS-2
    const EDIT_COLS = COLS;

    const clampCurCol = () => {
      state.curCol = Math.min(state.curCol, lines[state.curRow].length);
    };

    const ensureVisible = () => {
      if (state.curRow < state.scrollRow) state.scrollRow = state.curRow;
      if (state.curRow >= state.scrollRow + EDIT_ROWS) state.scrollRow = state.curRow - EDIT_ROWS + 1;
      const visCol = state.curCol - state.scrollCol;
      if (visCol < 0) state.scrollCol = state.curCol;
      if (visCol >= EDIT_COLS - 1) state.scrollCol = state.curCol - EDIT_COLS + 2;
      if (state.scrollCol < 0) state.scrollCol = 0;
    };

    // ── Renderers ─────────────────────────────────────────────────────────────
    const renderHeader = () => {
      const fname  = filename ? FormatDirectory(filename) : '[No Name]';
      const mod    = modified ? ' *' : '';
      const title  = ` NE-EDIT  │  ${fname}${mod}`;
      const hint   = ' Ctrl+S:Save  Ctrl+X:Save&Exit  Ctrl+Q:Quit ';
      const pad    = Math.max(0, COLS - title.length - hint.length);
      return goto(1, 1) + BG_BLUE + FG_WHITE + BOLD +
             title.padEnd(title.length + pad, ' ') + DIM + hint + RESET;
    };

    const renderStatus = () => {
      const pos   = ` Ln:${state.curRow + 1}  Col:${state.curCol + 1}  Lines:${lines.length} `;
      const msg   = state.inputMode === 'save-as' || state.inputMode === 'save-as-exit'
        ? ` Save as: ${state.inputBuffer}█`
        : (state.status || ' Ready');
      return goto(ROWS, 1) + BG_BLUE + FG_WHITE +
             (' ' + msg).padEnd(COLS - pos.length, ' ') + BOLD + pos + RESET;
    };

    const renderContent = () => {
      let out = '';
      for (let r = 0; r < EDIT_ROWS; r++) {
        const docRow = r + state.scrollRow;
        out += goto(r + 2, 1);
        if (docRow >= lines.length) {
          out += DIM + FG_BLUE + '~' + rep(' ', COLS - 1) + RESET;
          continue;
        }
        const line    = lines[docRow];
        const visible = line.slice(state.scrollCol, state.scrollCol + EDIT_COLS);
        const isCurRow = docRow === state.curRow;
        if (isCurRow) {
          const curPosInView = state.curCol - state.scrollCol;
          const before  = visible.slice(0, curPosInView);
          const curChar = visible[curPosInView] || ' ';
          const after   = visible.slice(curPosInView + 1);
          out += FG_WHITE + before +
                 REVERSE + curChar + RESET +
                 FG_WHITE + after +
                 rep(' ', Math.max(0, COLS - visible.length - 1)) + RESET;
        } else {
          out += FG_WHITE + visible + rep(' ', Math.max(0, COLS - visible.length)) + RESET;
        }
      }
      return out;
    };

    const render = () => {
      ensureVisible();
      term.write(hideCursor() + renderHeader() + renderContent() + renderStatus());
    };

    // ── File operations ───────────────────────────────────────────────────────
    const saveFile = (fpath) => {
      try {
        // Ensure parent directory exists
        const dir = path.dirname(fpath);
        if (!window.fs.existsSync(dir)) window.fs.mkdirSync(dir);
        window.fs.writeFileSync(fpath, lines.join('\n'));
        filename = fpath;
        modified = false;
        state.status = `Saved: ${FormatDirectory(fpath)}`;
      } catch (e) {
        state.status = `Save error: ${e.message}`;
      }
    };

    const doExit = () => {
      disposable.dispose();
      if (term._setAppMode) term._setAppMode(false);
      term.write(showCursor() + clearScreen());
      resolve();
    };

    // ── Initial render ────────────────────────────────────────────────────────
    term.write(clearScreen());
    render();

    // ── Input handler ─────────────────────────────────────────────────────────
    let disposable;
    disposable = term.onData((key) => {
      // Confirm-exit mode (Ctrl+Q with unsaved changes)
      if (state.inputMode === 'confirm-exit') {
        const k = key.toLowerCase();
        if (k === 'y') {
          doExit();
        } else if (k === 'n' || key === '\x1b') {
          state.inputMode = null;
          state.status = '';
          render();
        }
        return;
      }

      // Save-as input mode
      if (state.inputMode === 'save-as') {        if (key === '\r') {
          const val = state.inputBuffer.trim();
          if (val) {
            const fpath = val.startsWith('/')
              ? val
              : path.join(currentDirectory, val);
            saveFile(PrepareInternal(fpath));
          } else {
            state.status = 'Save cancelled.';
          }
          state.inputMode = null;
          state.inputBuffer = '';
          render();
          return;
        } else if (key === '\x1b') {
          state.inputMode = null;
          state.inputBuffer = '';
          state.status = 'Save cancelled.';
          render();
          return;
        } else if (key === '\u007F') {
          state.inputBuffer = state.inputBuffer.slice(0, -1);
          render();
          return;
        } else if (key.length === 1 && key >= ' ') {
          state.inputBuffer += key;
          render();
          return;
        }
        return;
      }

      const line = () => lines[state.curRow];

      // Control keys
      if (key === '\x13') { // Ctrl+S — Save
        if (filename) {
          saveFile(filename);
          render();
        } else {
          state.inputMode   = 'save-as';
          state.inputBuffer = '';
          render();
        }
        return;
      }

      if (key === '\x18') { // Ctrl+X — Save & Exit
        if (filename) {
          saveFile(filename);
          doExit();
        } else {
          state.inputMode   = 'save-as';
          state.inputBuffer = '__exit_after_save__';
          // special sentinel: handled below
          state.inputMode = 'save-as-exit';
          state.inputBuffer = '';
          render();
        }
        return;
      }

      if (state.inputMode === 'save-as-exit') {
        if (key === '\r') {
          const val = state.inputBuffer.trim();
          if (val) {
            const fpath = val.startsWith('/')
              ? val
              : path.join(currentDirectory, val);
            saveFile(PrepareInternal(fpath));
          }
          state.inputMode = null;
          state.inputBuffer = '';
          doExit();
          return;
        } else if (key === '\x1b') {
          state.inputMode = null;
          state.inputBuffer = '';
          state.status = 'Save cancelled.';
          render();
          return;
        } else if (key === '\u007F') {
          state.inputBuffer = state.inputBuffer.slice(0, -1);
          render();
          return;
        } else if (key.length === 1 && key >= ' ') {
          state.inputBuffer += key;
          render();
          return;
        }
        return;
      }

      if (key === '\x11') { // Ctrl+Q — Quit without saving
        if (modified) {
          state.inputMode   = 'confirm-exit';
          state.inputBuffer = '';
          state.status = 'Unsaved changes! Quit? [Y]es / [N]o';
          render();
        } else {
          doExit();
        }
        return;
      }

      // Navigation
      if (key === '\x1b[A') { // Up
        if (state.curRow > 0) { state.curRow--; clampCurCol(); }
        render(); return;
      }
      if (key === '\x1b[B') { // Down
        if (state.curRow < lines.length - 1) { state.curRow++; clampCurCol(); }
        render(); return;
      }
      if (key === '\x1b[C') { // Right
        if (state.curCol < line().length) {
          state.curCol++;
        } else if (state.curRow < lines.length - 1) {
          state.curRow++; state.curCol = 0;
        }
        render(); return;
      }
      if (key === '\x1b[D') { // Left
        if (state.curCol > 0) {
          state.curCol--;
        } else if (state.curRow > 0) {
          state.curRow--;
          state.curCol = lines[state.curRow].length;
        }
        render(); return;
      }
      if (key === '\x1b[H' || key === '\x01') { // Home / Ctrl+A
        state.curCol = 0; render(); return;
      }
      if (key === '\x1b[F' || key === '\x05') { // End / Ctrl+E
        state.curCol = line().length; render(); return;
      }
      if (key === '\x1b[5~') { // PgUp
        state.curRow = Math.max(0, state.curRow - EDIT_ROWS);
        clampCurCol(); render(); return;
      }
      if (key === '\x1b[6~') { // PgDn
        state.curRow = Math.min(lines.length - 1, state.curRow + EDIT_ROWS);
        clampCurCol(); render(); return;
      }

      // Edit keys
      if (key === '\r') { // Enter — new line
        const before = line().slice(0, state.curCol);
        const after  = line().slice(state.curCol);
        lines[state.curRow] = before;
        lines.splice(state.curRow + 1, 0, after);
        state.curRow++;
        state.curCol = 0;
        modified = true;
        render(); return;
      }

      if (key === '\u007F') { // Backspace
        if (state.curCol > 0) {
          lines[state.curRow] = line().slice(0, state.curCol - 1) + line().slice(state.curCol);
          state.curCol--;
          modified = true;
        } else if (state.curRow > 0) {
          const prevLen = lines[state.curRow - 1].length;
          lines[state.curRow - 1] += line();
          lines.splice(state.curRow, 1);
          state.curRow--;
          state.curCol = prevLen;
          modified = true;
        }
        render(); return;
      }

      if (key === '\x1b[3~') { // Delete
        if (state.curCol < line().length) {
          lines[state.curRow] = line().slice(0, state.curCol) + line().slice(state.curCol + 1);
          modified = true;
        } else if (state.curRow < lines.length - 1) {
          lines[state.curRow] += lines[state.curRow + 1];
          lines.splice(state.curRow + 1, 1);
          modified = true;
        }
        render(); return;
      }

      if (key === '\t') { // Tab → 4 spaces
        const spaces = '    ';
        lines[state.curRow] = line().slice(0, state.curCol) + spaces + line().slice(state.curCol);
        state.curCol += 4;
        modified = true;
        render(); return;
      }

      // Printable char
      if (key.length === 1 && key >= ' ') {
        lines[state.curRow] = line().slice(0, state.curCol) + key + line().slice(state.curCol);
        state.curCol++;
        modified = true;
        render(); return;
      }
    });

    }); // end Promise
  }
}
