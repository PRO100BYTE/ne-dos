import path from "path-browserify";
import { PrepareInternal, FormatDirectory } from "../Filesystem/StorageManager";
import bytes from "bytes";
import PlayerCommand from "./player";
import EditCommand from "./edit";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const CSI = '\x1b[';
const RESET  = CSI + '0m';
const BOLD   = CSI + '1m';
const DIM    = CSI + '2m';
const REVERSE = CSI + '7m';
const FG_WHITE  = CSI + '37m';
const FG_CYAN   = CSI + '36m';
const FG_YELLOW = CSI + '33m';
const FG_RED    = CSI + '31m';
const FG_GREEN  = CSI + '32m';
const FG_BLACK  = CSI + '30m';
const BG_BLUE   = CSI + '44m';
const BG_CYAN   = CSI + '46m';
const BG_BLACK  = CSI + '40m';
const BG_RED    = CSI + '41m';

const goto        = (r, c) => `${CSI}${r};${c}H`;
const clearScreen = ()     => `${CSI}2J${CSI}H`;
const hideCursor  = ()     => `${CSI}?25l`;
const showCursor  = ()     => `${CSI}?25h`;
const rep         = (ch, n) => n > 0 ? ch.repeat(n) : '';

// box-drawing
const tl = '┌', tr = '┐', bl = '└', br = '┘', h = '─', v = '│';
const V = '║', TT = '╦', BT = '╩';

// ─── NC Command ───────────────────────────────────────────────────────────────
export default class NcCommand {
  description() { return "Norton Commander — two-panel file manager"; }
  help(term) {
    term.writeln("Usage: nc");
    term.writeln("  Tab          Switch active panel");
    term.writeln("  ↑/↓          Move cursor");
    term.writeln("  PgUp/PgDn    Scroll by page");
    term.writeln("  Enter        Enter directory");
    term.writeln("  Backspace    Go to parent directory");
    term.writeln("  F1           Show keybindings");
    term.writeln("  F3           View file content (pager)");
    term.writeln("  F5           Copy to other panel (with edit destination)");
    term.writeln("  F6           Move/rename (with edit destination)");
    term.writeln("  F7           Create directory");
    term.writeln("  F8           Delete with Y/N confirmation");
    term.writeln("  F10 / Esc    Quit and return to shell");
  }

  execute(term, params, currentDirectory, setDirectory) {
    return new Promise((resolve) => {
    const COLS     = term.cols;
    const ROWS     = term.rows;
    const PANEL_W  = Math.floor(COLS / 2) - 2;
    const listRows = ROWS - 4;
    const SEP_COL  = PANEL_W + 2;
    const R_START  = PANEL_W + 3;

    if (term._setAppMode) term._setAppMode(true);

    const state = {
      panels: [
        { dir: PrepareInternal(currentDirectory), entries: [], cursor: 0, scroll: 0 },
        { dir: '/', entries: [], cursor: 0, scroll: 0 },
      ],
      active: 0,
      status: 'F1:Help  F3:View  F5:Copy  F6:Move  F7:MkDir  F8:Del  Tab:Switch  F10:Quit',
      inputMode:   null,   // null|'mkdir'|'rename'|'copy'|'move'|'confirm-del'|'view'
      inputBuffer: '',
      inputPrompt: '',
      inputExtra:  '',     // original name for rename/copy/move/delete
      viewLines:   [],
      viewScroll:  0,
      viewTitle:   '',
    };

    // ── FS utilities ──────────────────────────────────────────────────────────
    const copyRecursive = (src, dst) => {
      const st = window.fs.statSync(src);
      if (st.isDirectory()) {
        if (!window.fs.existsSync(dst)) window.fs.mkdirSync(dst);
        for (const e of window.fs.readdirSync(src))
          copyRecursive(path.join(src, e), path.join(dst, e));
      } else {
        window.fs.writeFileSync(dst, window.fs.readFileSync(src));
      }
    };

    const deleteRecursive = (target) => {
      const st = window.fs.statSync(target);
      if (st.isDirectory()) {
        for (const e of window.fs.readdirSync(target))
          deleteRecursive(path.join(target, e));
        window.fs.rmdirSync(target);
      } else {
        window.fs.unlinkSync(target);
      }
    };

    // ── Panel loading ─────────────────────────────────────────────────────────
    const loadPanel = (idx) => {
      const p = state.panels[idx];
      try {
        const rawEntries = window.fs.readdirSync(p.dir).map(name => {
          try {
            const st = window.fs.statSync(path.join(p.dir, name));
            return { name, isDir: st.isDirectory(), size: st.size };
          } catch { return { name, isDir: false, size: 0 }; }
        });
        rawEntries.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        if (p.dir !== '/') rawEntries.unshift({ name: '..', isDir: true, size: 0 });
        p.entries = rawEntries;
      } catch { p.entries = []; }
      if (p.cursor >= p.entries.length) p.cursor = Math.max(0, p.entries.length - 1);
    };

    const ap = () => state.panels[state.active];

    const ensureScroll = () => {
      const p = ap();
      if (p.cursor < p.scroll) p.scroll = p.cursor;
      if (p.cursor >= p.scroll + listRows) p.scroll = p.cursor - listRows + 1;
    };

    const enterDir = (p, name) => {
      p.dir    = name === '..' ? (path.dirname(p.dir) || '/') : path.join(p.dir, name);
      p.cursor = 0;
      p.scroll = 0;
      loadPanel(state.panels.indexOf(p));
    };

    // ── Panel renderer ────────────────────────────────────────────────────────
    const renderPanel = (idx, startCol) => {
      const p        = state.panels[idx];
      const isActive = idx === state.active;
      const frame    = isActive ? (BOLD + FG_CYAN) : (DIM + FG_WHITE);
      let out = '';

      // top border + dir label
      const dirLabel = ` ${FormatDirectory(p.dir)} `;
      const labelLen = Math.min(dirLabel.length, PANEL_W - 2);
      const label    = dirLabel.slice(0, labelLen);
      const padL     = Math.max(0, Math.floor((PANEL_W - label.length) / 2));
      const padR     = Math.max(0, PANEL_W - label.length - padL);
      out += goto(1, startCol) + frame;
      out += tl + rep(h, padL) + RESET + (isActive ? BOLD + FG_YELLOW : DIM + FG_YELLOW) + label;
      out += frame + rep(h, padR) + tr + RESET;

      // file list
      for (let r = 0; r < listRows; r++) {
        const entryIdx = r + p.scroll;
        const entry    = p.entries[entryIdx];
        out += goto(2 + r, startCol);
        if (!entry) { out += v + rep(' ', PANEL_W) + v + RESET; continue; }

        const sizeTxt = entry.isDir ? '<DIR> ' : (bytes(entry.size) || '0B').padStart(6, ' ');
        const nameMax = PANEL_W - sizeTxt.length - 2;
        const name    = entry.name.length > nameMax
          ? entry.name.slice(0, nameMax - 1) + '…'
          : entry.name.padEnd(nameMax, ' ');
        const line = ` ${name} ${sizeTxt}`;
        const isCursor = entryIdx === p.cursor;

        if (isCursor && isActive) {
          out += v + REVERSE + BG_CYAN + FG_BLACK + line + RESET + v;
        } else if (isCursor) {
          out += v + REVERSE + line + RESET + v;
        } else if (entry.isDir) {
          out += v + (isActive ? FG_YELLOW : DIM + FG_YELLOW) + line + RESET + v;
        } else {
          out += v + (isActive ? FG_WHITE : DIM + FG_WHITE) + line + RESET + v;
        }
      }

      // bottom border
      out += goto(2 + listRows, startCol) + frame + bl + rep(h, PANEL_W) + br + RESET;
      return out;
    };

    // ── Main screen render ────────────────────────────────────────────────────
    const render = () => {
      let out = hideCursor() + clearScreen();
      out += renderPanel(0, 1);
      out += renderPanel(1, R_START);

      // vertical separator
      for (let r = 1; r <= listRows + 2; r++) {
        out += goto(r, SEP_COL) + DIM + FG_WHITE;
        if      (r === 1)            out += TT;
        else if (r === listRows + 2) out += BT;
        else                         out += V;
        out += RESET;
      }

      // status bar
      out += goto(ROWS - 1, 1) + BG_BLUE + FG_WHITE;
      if (state.inputMode === 'confirm-del') {
        out += (` Delete "${state.inputExtra}"? Press  Y  to confirm,  N  or  Esc  to cancel`).padEnd(COLS, ' ') + RESET;
      } else if (state.inputMode && state.inputMode !== 'view') {
        const cur = state.inputBuffer.length < COLS - state.inputPrompt.length - 6 ? '█' : '';
        out += (` ${state.inputPrompt}: ${state.inputBuffer}${cur}`).padEnd(COLS, ' ') + RESET;
      } else {
        out += (' ' + state.status).padEnd(COLS, ' ') + RESET;
      }

      // function-key bar
      const fkeys = ['1Help', '3View', '5Copy', '6Move', '7MkDir', '8Del', '10Quit'];
      out += goto(ROWS, 1) + BG_BLACK;
      for (const k of fkeys) {
        const num   = k.match(/^\d+/)[0];
        const label = k.slice(num.length);
        out += RESET + BG_BLACK + FG_YELLOW + BOLD + num + RESET + BG_CYAN + FG_BLACK + label + ' ';
      }
      out += RESET;

      term.write(out);
    };

    // ── File viewer (pager) ───────────────────────────────────────────────────
    const renderViewer = () => {
      const visRows = ROWS - 3;
      let out = hideCursor() + clearScreen();

      // header
      const titleLeft  = ` View: ${state.viewTitle}`;
      const titleRight = ` L:${state.viewScroll + 1}-${Math.min(state.viewScroll + visRows, state.viewLines.length)}/${state.viewLines.length} `;
      const pad = Math.max(0, COLS - titleLeft.length - titleRight.length);
      out += goto(1, 1) + BG_BLUE + FG_WHITE + BOLD + titleLeft + rep(' ', pad) + titleRight + RESET;

      // separator
      out += goto(2, 1) + DIM + FG_WHITE + rep(h, COLS) + RESET;

      // content
      for (let r = 0; r < visRows; r++) {
        const line = state.viewLines[state.viewScroll + r] || '';
        out += goto(3 + r, 1) + FG_WHITE + line.slice(0, COLS).padEnd(COLS, ' ') + RESET;
      }

      // footer
      out += goto(ROWS, 1) + BG_BLUE + FG_WHITE;
      out += ' F3/Esc:Close   ↑↓:Line scroll   PgUp/PgDn:Page   Home/End:Start/End'.padEnd(COLS, ' ') + RESET;

      term.write(out);
    };

    // ── Init ──────────────────────────────────────────────────────────────────
    loadPanel(0);
    loadPanel(1);
    render();

    // ── Input handler ─────────────────────────────────────────────────────────
    const disposable = term.onData(async (key) => {

      // ── View / pager mode ──────────────────────────────────────────────────
      if (state.inputMode === 'view') {
        const visRows = ROWS - 3;
        const maxScroll = Math.max(0, state.viewLines.length - visRows);
        switch (key) {
          case '\x1b':
          case '\x1bOR': // F3
            state.inputMode = null;
            render();
            break;
          case '\x1b[A':  state.viewScroll = Math.max(0, state.viewScroll - 1);        renderViewer(); break;
          case '\x1b[B':  state.viewScroll = Math.min(maxScroll, state.viewScroll + 1); renderViewer(); break;
          case '\x1b[5~': state.viewScroll = Math.max(0, state.viewScroll - visRows);   renderViewer(); break;
          case '\x1b[6~': state.viewScroll = Math.min(maxScroll, state.viewScroll + visRows); renderViewer(); break;
          case '\x1b[H':  state.viewScroll = 0;          renderViewer(); break;
          case '\x1b[F':  state.viewScroll = maxScroll;  renderViewer(); break;
          default: break;
        }
        return;
      }

      // ── Delete confirmation ────────────────────────────────────────────────
      if (state.inputMode === 'confirm-del') {
        if (key === 'y' || key === 'Y') {
          try {
            deleteRecursive(state._deleteTarget);
            state.status = `Deleted: ${state.inputExtra}`;
            loadPanel(state.active);
          } catch (e) { state.status = `Delete error: ${e.message}`; }
        } else {
          state.status = 'Delete cancelled.';
        }
        state.inputMode = null;
        render();
        return;
      }

      // ── Text input modes ───────────────────────────────────────────────────
      if (state.inputMode) {
        switch (key) {
          case '\r': {
            const val = state.inputBuffer.trim();
            if (val) {
              try {
                if (state.inputMode === 'mkdir') {
                  window.fs.mkdirSync(path.join(ap().dir, val));
                  state.status = `Directory created: ${val}`;
                  loadPanel(state.active);

                } else if (state.inputMode === 'rename') {
                  const src = path.join(ap().dir, state.inputExtra);
                  const dst = path.join(ap().dir, val);
                  window.fs.renameSync(src, dst);
                  state.status = `Renamed → ${val}`;
                  loadPanel(state.active);

                } else if (state.inputMode === 'copy') {
                  const src = path.join(ap().dir, state.inputExtra);
                  copyRecursive(src, val);
                  state.status = `Copied to: ${val}`;
                  loadPanel(0); loadPanel(1);

                } else if (state.inputMode === 'move') {
                  const src = path.join(ap().dir, state.inputExtra);
                  window.fs.renameSync(src, val);
                  state.status = `Moved to: ${val}`;
                  loadPanel(0); loadPanel(1);
                }
              } catch (e) { state.status = `Error: ${e.message}`; }
            }
            state.inputMode = null;
            state.inputBuffer = '';
            break;
          }
          case '\x1b':
            state.inputMode = null;
            state.inputBuffer = '';
            state.status = 'Cancelled.';
            break;
          case '\u007F':
            state.inputBuffer = state.inputBuffer.slice(0, -1);
            break;
          default:
            if (key.length === 1 && key >= ' ')
              state.inputBuffer += key;
            break;
        }
        render();
        return;
      }

      // ── Normal navigation ──────────────────────────────────────────────────
      switch (key) {
        // Quit — F10 only (bare Esc is start of escape sequences, do not use it as quit)
        case '\x1b[21~': // F10
          if (term._setAppMode) term._setAppMode(false);
          disposable.dispose();
          term.write(showCursor() + clearScreen());
          setDirectory(PrepareInternal(ap().dir));
          resolve();
          return;

        // Cursor movement
        case '\x1b[A': ap().cursor = Math.max(0, ap().cursor - 1); ensureScroll(); break;
        case '\x1b[B': ap().cursor = Math.min(ap().entries.length - 1, ap().cursor + 1); ensureScroll(); break;
        case '\x1b[5~': ap().cursor = Math.max(0, ap().cursor - listRows); ensureScroll(); break;
        case '\x1b[6~': ap().cursor = Math.min(ap().entries.length - 1, ap().cursor + listRows); ensureScroll(); break;

        // Switch panel
        case '\t': state.active = 1 - state.active; break;

        // Enter directory or open file
        case '\r': {
          const e = ap().entries[ap().cursor];
          if (!e) break;
          if (e.isDir) {
            enterDir(ap(), e.name);
            break;
          }
          // Open file in associated app
          {
            const AUDIO_EXT = ['.mp3', '.ogg', '.wav', '.flac', '.aac', '.m4a'];
            const ext = path.extname(e.name).toLowerCase();
            const filePath = path.join(ap().dir, e.name);
            disposable.dispose();
            if (term._setAppMode) term._setAppMode(false);
            term.write(showCursor() + clearScreen());
            if (AUDIO_EXT.includes(ext)) {
              const cmd = new PlayerCommand();
              await cmd.execute(term, ['player', filePath], ap().dir, setDirectory);
            } else {
              const cmd = new EditCommand();
              await cmd.execute(term, ['edit', filePath], ap().dir, setDirectory);
            }
            resolve();
            return;
          }
        }

        // Backspace — parent dir
        case '\u007F':
          if (ap().dir !== '/') enterDir(ap(), '..');
          break;

        // F1 — Help (show keybindings in status bar)
        case '\x1bOP':
          state.status = 'Tab:Panel  ↑↓:Cursor  Enter:Open  BSp:Up  F3:View  F5:Copy  F6:Move  F7:MkDir  F8:Del  F10:Quit';
          break;

        // F3 — View file / enter dir
        case '\x1bOR': {
          const e = ap().entries[ap().cursor];
          if (!e || e.name === '..') break;
          if (e.isDir) { enterDir(ap(), e.name); break; }
          try {
            let raw = '';
            try { raw = window.fs.readFileSync(path.join(ap().dir, e.name), 'utf8'); }
            catch { raw = window.fs.readFileSync(path.join(ap().dir, e.name)).toString('latin1'); }
            state.viewLines  = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            state.viewScroll = 0;
            state.viewTitle  = `${FormatDirectory(ap().dir)}\\${e.name}`;
            state.inputMode  = 'view';
            renderViewer();
            return;
          } catch (err) { state.status = `View error: ${err.message}`; }
          break;
        }

        // F5 — Copy (show destination, confirm with Enter)
        case '\x1b[15~': {
          const e = ap().entries[ap().cursor];
          if (e && e.name !== '..') {
            const other = state.panels[1 - state.active];
            state.inputMode   = 'copy';
            state.inputBuffer = path.join(other.dir, e.name);
            state.inputPrompt = `Copy "${e.name}" to`;
            state.inputExtra  = e.name;
          }
          break;
        }

        // F6 — Move / rename
        case '\x1b[17~': {
          const e = ap().entries[ap().cursor];
          if (e && e.name !== '..') {
            const other = state.panels[1 - state.active];
            // If same dir → rename; otherwise offer move to other panel
            state.inputMode   = 'move';
            state.inputBuffer = path.join(other.dir, e.name);
            state.inputPrompt = `Move/Rename "${e.name}" to`;
            state.inputExtra  = e.name;
          }
          break;
        }

        // F7 — MkDir
        case '\x1b[18~':
          state.inputMode   = 'mkdir';
          state.inputBuffer = '';
          state.inputPrompt = 'New directory name';
          break;

        // F8 — Delete with confirmation
        case '\x1b[19~': {
          const e = ap().entries[ap().cursor];
          if (e && e.name !== '..') {
            state.inputMode     = 'confirm-del';
            state._deleteTarget = path.join(ap().dir, e.name);
            state.inputExtra    = e.name;
          }
          break;
        }

        default: break;
      }

      render();
    });
    }); // end Promise
  }
}

