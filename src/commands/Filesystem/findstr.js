import path from "path-browserify";
import { ResolveInCurrentDrive } from "./StorageManager";

export default class FindStrCommand {
  description() { return "Find text by pattern in file(s)"; }

  help(term) {
    term.writeln('Usage: findstr [/i] <pattern> <file|mask>');
  }

  execute(term, params, currentDirectory) {
    const flags = params.slice(1).filter(p => p.startsWith('/')).map(p => p.toLowerCase());
    const args = params.slice(1).filter(p => !p.startsWith('/'));
    if (!args[0] || !args[1]) {
      term.writeln('Usage: findstr [/i] <pattern> <file|mask>');
      return;
    }

    const pattern = args[0];
    const fileArg = args[1];
    const insensitive = flags.includes('/i');
    let regex;
    try {
      regex = new RegExp(pattern, insensitive ? 'i' : '');
    } catch {
      term.writeln('Invalid pattern');
      return;
    }

    const wildcard = fileArg.includes('*') || fileArg.includes('?');
    const target = ResolveInCurrentDrive(currentDirectory, fileArg);
    const files = [];

    if (wildcard) {
      const dir = path.dirname(target);
      const mask = path.basename(target);
      const re = new RegExp('^' + mask.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.') + '$', 'i');
      if (!window.fs.existsSync(dir)) {
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

    let found = 0;
    for (const f of files) {
      const lines = window.fs.readFileSync(f, 'utf8').replaceAll('\r\n', '\n').split('\n');
      lines.forEach((line, idx) => {
        if (regex.test(line)) {
          term.writeln(`${path.basename(f)}:${idx + 1}: ${line}`);
          found++;
        }
      });
    }
    if (!found) term.writeln('---------- NOT FOUND ----------');
  }
}
