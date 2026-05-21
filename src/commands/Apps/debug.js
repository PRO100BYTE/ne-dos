/**
 * debug - Hex viewer / byte inspector
 *
 * Usage:
 *   debug [file]
 *
 * Keys:
 *   ↑ / ↓         scroll one row
 *   PgUp / PgDn   scroll one page
 *   Home / End    jump to start / end
 *   g             go to offset (enter hex offset)
 *   /             search hex bytes (space-separated) or ASCII string
 *   n             next search match
 *   e             toggle edit mode (hex nibble edit)
 *   s             save changes (edit mode)
 *   q / Esc       quit
 *   h / ?         help overlay
 */

import { PrepareInternal } from '../Filesystem/StorageManager';

const CSI = '\x1b[';
const clr  = `${CSI}2J${CSI}H`;
const hide = `${CSI}?25l`;
const show = `${CSI}?25h`;
const goto = (r, c) => `${CSI}${r};${c}H`;
const attr = (n) => `${CSI}${n}m`;
const R = attr(0), Bold = attr(1), Dim = attr(2);
const FgCyan = attr(36), FgYellow = attr(33), FgRed = attr(31);
const FgGreen = attr(32), FgWhite = attr(37), FgBlue = attr(34);
const BgBlue = attr(44), BgGrey = attr(100);

const BYTES_PER_ROW = 16;

export default class DebugCommand {
  description() { return 'Hex viewer / byte inspector'; }

  help(term) {
    term.writeln(`Usage: debug [file]\r\n  Opens hex dump viewer. Keys: q=quit, g=goto, /=search, e=edit, s=save, h=help`);
  }

  execute(term, params, currentDirectory) {
    return new Promise((resolve) => {
      let buf = null;
      let filePath = null;
      let fileName = '';
      let modified = false;

      if (params && params.trim()) {
        filePath = PrepareInternal(params.trim(), currentDirectory);
        fileName = params.trim();
        try {
          if (!window.fs.existsSync(filePath)) {
            term.write(`${FgRed}File not found: ${fileName}${R}\r\n`);
            resolve(); return;
          }
          const raw = window.fs.readFileSync(filePath);
          if (raw instanceof Uint8Array || Buffer.isBuffer(raw)) {
            buf = new Uint8Array(raw);
          } else {
            const encoder = new TextEncoder();
            buf = encoder.encode(typeof raw === 'string' ? raw : raw.toString());
          }
        } catch (e) {
          term.write(`${FgRed}${e.message}${R}\r\n`);
          resolve(); return;
        }
      } else {
        // Open with empty 256-byte buffer
        buf = new Uint8Array(256);
        fileName = '[new]';
      }

      const rows = term.rows || 24;
      const cols = term.cols || 80;

      // How many hex data rows visible (minus header, statusbar, 1 gap)
      const VISIBLE = Math.max(4, rows - 4);

      let offset = 0;      // top-visible row start byte offset
      let cursor = 0;      // selected byte index
      let editMode = false;
      let editNibble = 0;  // 0=high, 1=low
      let searchMatches = [];
      let searchIdx = 0;
      let overlay = null;  // 'help' | 'goto' | 'search'
      let overlayBuf = '';
      let searchPattern = null;

      // ── Render ───────────────────────────────────────────────────────────────

      const hexRow = (baseOffset) => {
        let out = '';
        // Offset
        out += `${FgBlue}${baseOffset.toString(16).toUpperCase().padStart(8, '0')}${R}  `;
        // Hex bytes
        for (let i = 0; i < BYTES_PER_ROW; i++) {
          const idx = baseOffset + i;
          if (idx < buf.length) {
            const isCursor = idx === cursor;
            const isSearch = searchMatches.includes(idx);
            const byte = buf[idx];
            const hexStr = byte.toString(16).toUpperCase().padStart(2, '0');
            if (isCursor) out += `${BgBlue}${FgWhite}${Bold}${hexStr}${R}`;
            else if (isSearch) out += `${FgGreen}${Bold}${hexStr}${R}`;
            else out += hexStr;
          } else {
            out += '  ';
          }
          if (i === 7) out += '  ';
          else out += ' ';
        }
        // ASCII
        out += ' |';
        for (let i = 0; i < BYTES_PER_ROW; i++) {
          const idx = baseOffset + i;
          if (idx < buf.length) {
            const b = buf[idx];
            const isCursor = idx === cursor;
            const ch = (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
            if (isCursor) out += `${BgBlue}${FgWhite}${ch}${R}`;
            else if (b >= 32 && b < 127) out += ch;
            else out += `${Dim}.${R}`;
          } else {
            out += ' ';
          }
        }
        out += '|';
        return out;
      };

      const header = () => {
        const modeStr = editMode ? `${FgRed}${Bold}[EDIT]${R}` : `${FgGreen}[VIEW]${R}`;
        const modStr  = modified ? `${FgYellow}*${R}` : ' ';
        const info = `${Bold}${FgCyan}DEBUG${R} ${modStr}${modeStr}  File: ${FgYellow}${fileName}${R}  Size: ${buf.length} bytes`;
        return info;
      };

      const statusBar = () => {
        const pct = buf.length > 0 ? Math.round((cursor / buf.length) * 100) : 0;
        const curByte = cursor < buf.length ? buf[cursor] : 0;
        const parts = [
          `Off: ${FgCyan}0x${cursor.toString(16).toUpperCase()}${R} (${cursor})`,
          `Byte: ${FgYellow}0x${curByte.toString(16).toUpperCase().padStart(2, '0')}${R} ${curByte} '${curByte >= 32 && curByte < 127 ? String.fromCharCode(curByte) : '.'}' `,
          `${pct}%`,
          searchPattern ? `Search: ${FgGreen}${searchMatches.length} match${searchMatches.length !== 1 ? 'es' : ''}${R}` : '',
          `${BgGrey} q:quit ESC:clr g:goto /:search ${editMode ? 's:save' : 'e:edit'} h:help ${R}`,
        ];
        return parts.filter(Boolean).join('  ');
      };

      const render = () => {
        let out = hide + clr;
        out += goto(1, 1) + header();
        out += goto(2, 1) + `${Dim}${'─'.repeat(Math.min(cols, 78))}${R}`;

        // Clamp offset to row boundary
        const rowOff = Math.floor(offset / BYTES_PER_ROW) * BYTES_PER_ROW;
        offset = rowOff;

        for (let row = 0; row < VISIBLE; row++) {
          const base = offset + row * BYTES_PER_ROW;
          if (base >= buf.length && buf.length > 0) {
            out += goto(row + 3, 1) + CSI + 'K';
          } else if (buf.length === 0) {
            out += goto(row + 3, 1) + CSI + 'K';
          } else {
            out += goto(row + 3, 1) + hexRow(base);
          }
        }

        out += goto(rows - 1, 1) + `${Dim}${'─'.repeat(Math.min(cols, 78))}${R}`;
        out += goto(rows, 1) + statusBar();

        if (overlay === 'help') out += renderHelp();
        if (overlay === 'goto') out += renderPrompt('Go to offset (hex): ', overlayBuf);
        if (overlay === 'search') out += renderPrompt('Search (hex bytes or "text"): ', overlayBuf);

        out += show;
        term.write(out);
      };

      const renderPrompt = (label, val) => {
        const r = Math.floor(rows / 2);
        const c = Math.floor(cols / 2) - 20;
        return goto(r, c) + `${BgGrey}${Bold} ${label}${FgYellow}${val}${R}${BgGrey}  ${R}`;
      };

      const renderHelp = () => {
        const lines = [
          `${Bold}${FgCyan}DEBUG - Help${R}`,
          `  ↑↓ / PgUp/PgDn  Scroll`,
          `  Home / End       Jump to start/end`,
          `  g                Go to offset`,
          `  / + n            Search / Next match`,
          `  e                Toggle edit mode`,
          `  s                Save file (edit mode)`,
          `  q / Esc          Quit`,
        ];
        let out = '';
        const startRow = Math.floor((rows - lines.length) / 2);
        const startCol = Math.floor(cols / 2) - 22;
        for (let i = 0; i < lines.length; i++) {
          out += goto(startRow + i, startCol) + `${BgGrey}  ${lines[i].padEnd(40, ' ')}  ${R}`;
        }
        return out;
      };

      // ── Scroll helpers ───────────────────────────────────────────────────────

      const ensureCursorVisible = () => {
        const curRow = Math.floor(cursor / BYTES_PER_ROW);
        const topRow = Math.floor(offset / BYTES_PER_ROW);
        if (curRow < topRow) offset = curRow * BYTES_PER_ROW;
        if (curRow >= topRow + VISIBLE) offset = (curRow - VISIBLE + 1) * BYTES_PER_ROW;
      };

      const moveCursor = (delta) => {
        cursor = Math.max(0, Math.min(buf.length - 1, cursor + delta));
        ensureCursorVisible();
      };

      // ── Search ───────────────────────────────────────────────────────────────

      const doSearch = (pattern) => {
        searchPattern = pattern;
        searchMatches = [];
        searchIdx = 0;
        let needle;
        if (pattern.startsWith('"') && pattern.endsWith('"')) {
          const str = pattern.slice(1, -1);
          needle = new TextEncoder().encode(str);
        } else {
          try {
            needle = pattern.split(/\s+/).map(h => parseInt(h, 16)).filter(n => !isNaN(n));
          } catch { return; }
        }
        if (needle.length === 0) return;
        outer: for (let i = 0; i <= buf.length - needle.length; i++) {
          for (let j = 0; j < needle.length; j++) {
            if (buf[i + j] !== needle[j]) continue outer;
          }
          searchMatches.push(i);
        }
        if (searchMatches.length > 0) {
          cursor = searchMatches[0];
          ensureCursorVisible();
        }
      };

      // ── Key handler ──────────────────────────────────────────────────────────

      render();

      const dispose = term.onData((data) => {
        // Overlay input modes
        if (overlay === 'goto' || overlay === 'search') {
          if (data === '\r') {
            const val = overlayBuf.trim();
            if (overlay === 'goto') {
              const off = parseInt(val, 16);
              if (!isNaN(off) && off < buf.length) { cursor = off; ensureCursorVisible(); }
            } else {
              if (val) doSearch(val);
            }
            overlay = null; overlayBuf = '';
          } else if (data === '\x1b') {
            overlay = null; overlayBuf = '';
          } else if (data === '\x7f' || data === '\b') {
            overlayBuf = overlayBuf.slice(0, -1);
          } else if (data.charCodeAt(0) >= 32) {
            overlayBuf += data;
          }
          render(); return;
        }

        if (overlay === 'help') { overlay = null; render(); return; }

        // Edit mode - nibble editing
        if (editMode && buf.length > 0 && cursor < buf.length) {
          const hexChar = data.toUpperCase();
          if (/^[0-9A-F]$/.test(hexChar)) {
            const nibbleVal = parseInt(hexChar, 16);
            const current = buf[cursor];
            if (editNibble === 0) {
              buf[cursor] = (nibbleVal << 4) | (current & 0x0F);
              editNibble = 1;
            } else {
              buf[cursor] = (current & 0xF0) | nibbleVal;
              editNibble = 0;
              modified = true;
              moveCursor(1);
            }
            render(); return;
          }
        }

        // Navigation
        switch (data) {
          case 'q': case '\x1b':
            dispose.dispose();
            term.write(clr + show);
            resolve(); return;
          case 'h': case '?':
            overlay = 'help'; break;
          case 'g':
            overlay = 'goto'; overlayBuf = ''; break;
          case '/':
            overlay = 'search'; overlayBuf = ''; break;
          case 'n':
            if (searchMatches.length > 0) {
              searchIdx = (searchIdx + 1) % searchMatches.length;
              cursor = searchMatches[searchIdx];
              ensureCursorVisible();
            }
            break;
          case 'e':
            editMode = !editMode; editNibble = 0; break;
          case 's':
            if (editMode && filePath) {
              try {
                window.fs.writeFileSync(filePath, Buffer.from(buf));
                modified = false;
                term.write(`${FgGreen}\r\nSaved.${R}\r\n`);
              } catch (e) {
                term.write(`${FgRed}\r\n${e.message}${R}\r\n`);
              }
            }
            break;
          case '\x1b[A': moveCursor(-BYTES_PER_ROW); break; // Up
          case '\x1b[B': moveCursor(BYTES_PER_ROW); break;  // Down
          case '\x1b[C': moveCursor(1); break;               // Right
          case '\x1b[D': moveCursor(-1); break;              // Left
          case '\x1b[5~': // PgUp
            moveCursor(-VISIBLE * BYTES_PER_ROW); break;
          case '\x1b[6~': // PgDn
            moveCursor(VISIBLE * BYTES_PER_ROW); break;
          case '\x1b[H': cursor = 0; ensureCursorVisible(); break; // Home
          case '\x1b[F': cursor = Math.max(0, buf.length - 1); ensureCursorVisible(); break; // End
          default: return;
        }
        render();
      });
    });
  }
}
