import path from "path-browserify";
import { ResolveInCurrentDrive, FormatDirectory } from "./StorageManager";

export default class TreeCommand {
  execute(term, params, directory, setDirectory) {
    const target = params[1] || '.';
    const resolvedDir = ResolveInCurrentDrive(directory, target);

    if (!window.fs.existsSync(resolvedDir)) {
      term.writeln("No such directory");
      return;
    }
    if (!window.fs.statSync(resolvedDir).isDirectory()) {
      term.writeln("No such directory");
      return;
    }

    const parseDepth = Number.parseInt(params[2], 10);
    const maxDepth = Number.isFinite(parseDepth) && parseDepth >= 0 ? parseDepth : Infinity;
    let folders = 0;
    let files = 0;

    const sortEntries = (baseDir, entries) => {
      return entries.slice().sort((a, b) => {
        const aPath = path.join(baseDir, a);
        const bPath = path.join(baseDir, b);
        let aIsDir = false;
        let bIsDir = false;
        try { aIsDir = window.fs.statSync(aPath).isDirectory(); } catch {}
        try { bIsDir = window.fs.statSync(bPath).isDirectory(); } catch {}
        if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
        return a.localeCompare(b);
      });
    };

    const walk = (baseDir, prefix, depth) => {
      if (depth > maxDepth) return;

      let entries = [];
      try {
        entries = sortEntries(baseDir, window.fs.readdirSync(baseDir));
      } catch {
        term.writeln(prefix + "[error reading directory]");
        return;
      }

      entries.forEach((entry, idx) => {
        const fullPath = path.join(baseDir, entry);
        let isDir = false;
        try {
          isDir = window.fs.statSync(fullPath).isDirectory();
        } catch {}

        const isLast = idx === entries.length - 1;
        const branch = isLast ? "`-- " : "|-- ";
        const nextPrefix = prefix + (isLast ? "    " : "|   ");

        if (isDir) {
          folders++;
          term.writeln(prefix + branch + entry + "/");
          if (depth < maxDepth) {
            walk(fullPath, nextPrefix, depth + 1);
          }
        } else {
          files++;
          term.writeln(prefix + branch + entry);
        }
      });
    };

    term.writeln(FormatDirectory(resolvedDir));
    walk(resolvedDir, "", 0);
    term.writeln("");
    term.writeln(`${folders} director${folders === 1 ? 'y' : 'ies'}, ${files} file${files === 1 ? '' : 's'}`);
  }

  description() {
    return "Display directory tree";
  }

  help(term) {
    term.writeln("Usage: tree [path] [maxDepth]");
    term.writeln("Displays files and folders as a tree.");
    term.writeln("Examples:");
    term.writeln("  tree");
    term.writeln("  tree . 2");
    term.writeln("  tree C:\\projects 3");
  }
}