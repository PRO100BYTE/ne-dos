import path from "path-browserify";
import { ResolveInCurrentDrive, FormatDirectory } from "./StorageManager";

export default class XCopyCommand {
  description() { return "Extended copy (directories, recursive)"; }

  help(term) {
    term.writeln("Usage: xcopy <source> <target> [/s] [/e] [/y]");
    term.writeln("  /s  copy directories except empty");
    term.writeln("  /e  copy directories including empty");
    term.writeln("  /y  overwrite without prompt");
  }

  execute(term, params, currentDirectory) {
    const flags = new Set(params.slice(1).filter(p => p.startsWith('/')).map(p => p.toLowerCase()));
    const args = params.slice(1).filter(p => !p.startsWith('/'));
    const includeSubdirs = flags.has('/s') || flags.has('/e');
    const includeEmpty = flags.has('/e');
    const force = flags.has('/y');

    if (!args[0] || !args[1]) {
      term.writeln("Usage: xcopy <source> <target> [/s] [/e] [/y]");
      return;
    }

    const source = ResolveInCurrentDrive(currentDirectory, args[0]);
    const target = ResolveInCurrentDrive(currentDirectory, args[1]);

    if (!window.fs.existsSync(source)) {
      term.writeln(`File not found: ${FormatDirectory(source)}`);
      return;
    }

    const copyFile = (src, dst) => {
      if (window.fs.existsSync(dst) && !force) return false;
      const parent = path.dirname(dst);
      if (parent !== '/' && !window.fs.existsSync(parent)) window.fs.mkdirSync(parent, { recursive: true });
      window.fs.writeFileSync(dst, window.fs.readFileSync(src));
      return true;
    };

    const copyDir = (src, dst) => {
      let copied = 0;
      if (!window.fs.existsSync(dst)) window.fs.mkdirSync(dst, { recursive: true });
      const entries = window.fs.readdirSync(src);
      if (!entries.length && includeEmpty) return 1;
      for (const name of entries) {
        const s = path.join(src, name);
        const d = path.join(dst, name);
        const st = window.fs.statSync(s);
        if (st.isDirectory()) {
          if (includeSubdirs) copied += copyDir(s, d);
        } else {
          if (copyFile(s, d)) copied++;
        }
      }
      return copied;
    };

    let copied = 0;
    const st = window.fs.statSync(source);
    if (st.isDirectory()) {
      if (!includeSubdirs) {
        term.writeln("Specify /s or /e to copy directories.");
        return;
      }
      copied = copyDir(source, target);
    } else {
      copied = copyFile(source, target) ? 1 : 0;
    }

    term.writeln(`${copied} file(s) copied.`);
  }
}
