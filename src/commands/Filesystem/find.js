import path from "path-browserify";
import { ResolveInCurrentDrive } from "./StorageManager";

export default class FindCommand {
  description() { return "Find a text string in file(s)"; }

  help(term) {
    term.writeln('Usage: find "text" <file|mask>');
  }

  execute(term, params, currentDirectory) {
    const needle = params[1];
    const fileArg = params[2];
    if (!needle || !fileArg) {
      term.writeln('Usage: find "text" <file|mask>');
      return;
    }

    const wildcard = fileArg.includes('*') || fileArg.includes('?');
    const target = ResolveInCurrentDrive(currentDirectory, fileArg);
    const dir = wildcard ? path.dirname(target) : null;
    const mask = wildcard ? path.basename(target) : null;
    const re = wildcard
      ? new RegExp('^' + mask.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.') + '$', 'i')
      : null;

    const files = [];
    if (wildcard) {
      if (!window.fs.existsSync(dir) || !window.fs.statSync(dir).isDirectory()) {
        term.writeln('Path not found');
        return;
      }
      for (const n of window.fs.readdirSync(dir)) {
        if (!re.test(n)) continue;
        const p = path.join(dir, n);
        if (!window.fs.statSync(p).isDirectory()) files.push(p);
      }
    } else {
      if (!window.fs.existsSync(target) || window.fs.statSync(target).isDirectory()) {
        term.writeln('File not found');
        return;
      }
      files.push(target);
    }

    let count = 0;
    for (const f of files) {
      const lines = window.fs.readFileSync(f, 'utf8').replaceAll('\r\n', '\n').split('\n');
      lines.forEach((line) => {
        if (line.includes(needle)) {
          term.writeln(`${path.basename(f)}: ${line}`);
          count++;
        }
      });
    }
    if (!count) term.writeln('---------- NOT FOUND ----------');
  }
}
