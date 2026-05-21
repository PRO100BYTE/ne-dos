import path from "path-browserify";
import { ResolveInCurrentDrive } from "./StorageManager";

export default class CatCommand {
  execute(term, params, directory, setDirectory) {
    const flags = params.filter(p => p && p.startsWith('/')).map(p => p.toLowerCase());
    const showNumbers = flags.includes('/n');
    let param = params.find((p, i) => i > 0 && p && !p.startsWith('/'));
    if (!param || param === "") {
      term.writeln("No such file");
      return;
    }
    const dir = ResolveInCurrentDrive(directory, param);
    if (!window.fs.existsSync(dir)) {
      term.writeln("No such file");
      return;
    }
    if (window.fs.statSync(dir).isDirectory()) {
      term.writeln("Cannot read directory");
      return;
    }

    const text = window.fs.readFileSync(dir, 'utf8');
    if (!showNumbers) {
      term.writeln(text.replaceAll("\n", "\r\n"));
      return;
    }

    const lines = text.replaceAll('\r\n', '\n').split('\n');
    lines.forEach((line, idx) => {
      term.writeln(`${String(idx + 1).padStart(5, ' ')}: ${line}`);
    });
  }

  description() {
    return "Print file content (/n for line numbers)";
  }

  help(term) {
    term.writeln("Usage: type [/n] <file>");
    term.writeln("  /n   Show line numbers");
  }
}