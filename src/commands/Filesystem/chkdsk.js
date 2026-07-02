import path from "path-browserify";
import { ResolveInCurrentDrive, FormatDirectory } from "./StorageManager";

export default class ChkDskCommand {
  description() { return "Check virtual disk status"; }

  help(term) {
    term.writeln('Usage: chkdsk [path]');
  }

  execute(term, params, currentDirectory) {
    const root = ResolveInCurrentDrive(currentDirectory, params[1] || '.');
    if (!window.fs.existsSync(root)) {
      term.writeln('Path not found');
      return;
    }

    let dirs = 0;
    let files = 0;
    let bytes = 0;
    let errors = 0;

    const walk = (p) => {
      try {
        const st = window.fs.statSync(p);
        if (st.isDirectory()) {
          dirs++;
          for (const n of window.fs.readdirSync(p)) walk(path.join(p, n));
        } else {
          files++;
          bytes += st.size || 0;
        }
      } catch {
        errors++;
      }
    };

    walk(root);

    term.writeln('Checking file system...');
    term.writeln(`Volume: ${FormatDirectory(root)}`);
    term.writeln(`${files} file(s)`);
    term.writeln(`${dirs} dir(s)`);
    term.writeln(`${bytes} bytes`);
    term.writeln(errors ? `${errors} error(s) detected` : 'No problems found');
  }
}
