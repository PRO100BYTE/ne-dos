import { ResolveInCurrentDrive } from "../Filesystem/StorageManager";

export default class SortCommand {
  description() { return "Sort text lines"; }

  help(term) {
    term.writeln('Usage: sort <file>');
    term.writeln('       sort text to sort');
  }

  execute(term, params, currentDirectory) {
    if (!params[1]) {
      term.writeln('Usage: sort <file>');
      return;
    }

    const candidate = ResolveInCurrentDrive(currentDirectory, params[1]);
    let lines;
    if (window.fs.existsSync(candidate) && !window.fs.statSync(candidate).isDirectory()) {
      lines = window.fs.readFileSync(candidate, 'utf8').replaceAll('\r\n', '\n').split('\n');
    } else {
      lines = params.slice(1).join(' ').split(/\s+/).filter(Boolean);
    }

    lines.sort((a, b) => a.localeCompare(b));
    lines.forEach((l) => term.writeln(l));
  }
}
