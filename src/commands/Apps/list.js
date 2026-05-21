import { ResolveInCurrentDrive, FormatDirectory } from "../Filesystem/StorageManager";

const CSI = '\x1b[';
const clear = () => `${CSI}2J${CSI}H`;
const goto = (r, c) => `${CSI}${r};${c}H`;
const hide = () => `${CSI}?25l`;
const show = () => `${CSI}?25h`;

export default class ListCommand {
  description() { return "Text viewer (LIST style)"; }

  help(term) {
    term.writeln('Usage: list <file>');
  }

  execute(term, params, currentDirectory) {
    return new Promise((resolve) => {
      const arg = params[1];
      if (!arg) {
        term.writeln('Usage: list <file>');
        resolve();
        return;
      }
      const file = ResolveInCurrentDrive(currentDirectory, arg);
      if (!window.fs.existsSync(file) || window.fs.statSync(file).isDirectory()) {
        term.writeln('File not found');
        resolve();
        return;
      }

      const lines = window.fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n').split('\n');
      let top = 0;
      let query = '';
      if (term._setAppMode) term._setAppMode(true);

      const render = () => {
        const rows = term.rows;
        const cols = term.cols;
        const viewRows = rows - 2;
        let out = hide() + clear();
        out += goto(1, 1) + ` LIST ${FormatDirectory(file)}  (${top + 1}-${Math.min(top + viewRows, lines.length)}/${lines.length})`;
        for (let i = 0; i < viewRows; i++) {
          const line = lines[top + i] || '';
          out += goto(2 + i, 1) + line.slice(0, cols).padEnd(cols, ' ');
        }
        out += goto(rows, 1) + 'Esc:Quit  Up/Down/PgUp/PgDn:Scroll  /:Search'.padEnd(cols, ' ');
        term.write(out);
      };

      const searchNext = () => {
        if (!query) return;
        for (let i = top + 1; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(query.toLowerCase())) {
            top = i;
            return;
          }
        }
      };

      const exit = () => {
        if (disp) disp.dispose();
        if (term._setAppMode) term._setAppMode(false);
        term.write(show() + clear());
        resolve();
      };

      let askSearch = false;
      render();
      const disp = term.onData((k) => {
        if (askSearch) {
          if (k === '\r') {
            askSearch = false;
            searchNext();
            render();
            return;
          }
          if (k === '\x7f') query = query.slice(0, -1);
          else if (k >= ' ' && k <= '~') query += k;
          term.write(goto(term.rows, 1) + `/ ${query}`.padEnd(term.cols, ' '));
          return;
        }

        switch (k) {
          case '\x1b': exit(); return;
          case '\x1b[A': top = Math.max(0, top - 1); break;
          case '\x1b[B': top = Math.min(Math.max(0, lines.length - 1), top + 1); break;
          case '\x1b[5~': top = Math.max(0, top - (term.rows - 3)); break;
          case '\x1b[6~': top = Math.min(Math.max(0, lines.length - 1), top + (term.rows - 3)); break;
          case '/': askSearch = true; query = ''; term.write(goto(term.rows, 1) + '/ '.padEnd(term.cols, ' ')); return;
          default: return;
        }
        render();
      });
    });
  }
}
