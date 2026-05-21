import { ResolveInCurrentDrive, FormatDirectory } from "../Filesystem/StorageManager";

export default class MoreCommand {
  description() { return "Paged file viewer"; }

  help(term) {
    term.writeln('Usage: more <file>');
  }

  execute(term, params, currentDirectory) {
    return new Promise((resolve) => {
      const arg = params[1];
      if (!arg) {
        term.writeln('Usage: more <file>');
        resolve();
        return;
      }
      const file = ResolveInCurrentDrive(currentDirectory, arg);
      if (!window.fs.existsSync(file) || window.fs.statSync(file).isDirectory()) {
        term.writeln('File not found');
        resolve();
        return;
      }

      if (term._setAppMode) term._setAppMode(true);
      const lines = window.fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n').split('\n');
      let idx = 0;
      const page = Math.max(3, term.rows - 2);

      const render = () => {
        for (let i = 0; i < page && idx < lines.length; i++, idx++) term.writeln(lines[idx]);
        if (idx < lines.length) term.write(`-- More (${idx}/${lines.length}) --`);
        else exit();
      };

      const exit = () => {
        if (disp) disp.dispose();
        if (term._setAppMode) term._setAppMode(false);
        resolve();
      };

      const disp = term.onData((k) => {
        if (k === '\x1b' || k === 'q' || k === 'Q') {
          term.writeln('');
          exit();
          return;
        }
        term.write('\r\x1b[K');
        render();
      });

      term.writeln(`File: ${FormatDirectory(file)}`);
      render();
    });
  }
}
