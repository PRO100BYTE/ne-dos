import path from "path-browserify";
import { PrepareInternal, FormatDirectory } from "./StorageManager";

export default class MoveCommand {
  description() { return "Move a file or directory (supports wildcards, /y, /-y)"; }
  help(term) {
    term.writeln("Usage: move [/y|/-y] <source> <target>");
    term.writeln("");
    term.writeln("  Moves (cuts and pastes) a file or directory to a new location.");
    term.writeln("  Supports source templates: * and ?");
    term.writeln("  /y   overwrite without confirmation");
    term.writeln("  /-y  ask before overwrite");
    term.writeln("");
    term.writeln("  Example:");
    term.writeln("    move file.txt ./backup/file.txt");
    term.writeln("    move /music/song.mp3 /backup/song.mp3");
  }

  execute(term, params, currentDirectory, setDirectory) {
    return new Promise((resolve) => {
      const args = params.slice(1);
      const noConfirm = args.map(a => a.toLowerCase()).includes('/y');
      const askConfirm = args.map(a => a.toLowerCase()).includes('/-y');
      const paths = args.filter(a => !a.startsWith('/'));

      if (!paths[0] || !paths[1]) {
        term.writeln("Usage: move [/y|/-y] <source> <target>");
        term.writeln("Try: help move");
        resolve();
        return;
      }

      const wildcardToRegExp = (pattern) => {
        const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        return new RegExp('^' + esc.replaceAll('*', '.*').replaceAll('?', '.') + '$', 'i');
      };

      const deleteRecursive = (p) => {
        if (!window.fs.existsSync(p)) return;
        const st = window.fs.statSync(p);
        if (!st.isDirectory()) {
          window.fs.unlinkSync(p);
          return;
        }
        window.fs.readdirSync(p).forEach(item => deleteRecursive(path.join(p, item)));
        window.fs.rmdirSync(p);
      };

      const askOverwrite = (dst, cb) => {
        if (!window.fs.existsSync(dst)) return cb(true);
        if (noConfirm && !askConfirm) return cb(true);
        term.write(`Overwrite ${FormatDirectory(dst)}? (Y/N) `);
        const disp = term.onData((k) => {
          const key = (k || '').toLowerCase();
          if (key === 'y') { disp.dispose(); term.writeln('Y'); cb(true); }
          else if (key === 'n' || key === '\r' || key === '\x1b') { disp.dispose(); term.writeln('N'); cb(false); }
        });
      };

      try {
        const sourceRaw = paths[0];
        const targetRaw = paths[1];
        const sourcePath = PrepareInternal(sourceRaw.startsWith('/') ? sourceRaw : path.join(currentDirectory, sourceRaw));
        const targetPath = PrepareInternal(targetRaw.startsWith('/') ? targetRaw : path.join(currentDirectory, targetRaw));
        const hasWildcards = sourceRaw.includes('*') || sourceRaw.includes('?');

        if (hasWildcards) {
          const srcDir = path.dirname(sourcePath);
          const mask = path.basename(sourcePath);
          if (!window.fs.existsSync(srcDir) || !window.fs.statSync(srcDir).isDirectory()) {
            term.writeln(`Error: Directory not found: ${FormatDirectory(srcDir)}`);
            resolve();
            return;
          }
          const re = wildcardToRegExp(mask);
          const names = window.fs.readdirSync(srcDir).filter(n => re.test(n));
          const targetIsDir = window.fs.existsSync(targetPath) && window.fs.statSync(targetPath).isDirectory();
          const dstBase = targetIsDir ? targetPath : path.dirname(targetPath);
          if (dstBase !== '/' && !window.fs.existsSync(dstBase)) window.fs.mkdirSync(dstBase, { recursive: true });
          let moved = 0;
          const next = (i) => {
            if (i >= names.length) {
              term.writeln(`${moved} file(s) moved.`);
              resolve();
              return;
            }
            const src = path.join(srcDir, names[i]);
            if (window.fs.statSync(src).isDirectory()) return next(i + 1);
            const dst = path.join(dstBase, names[i]);
            askOverwrite(dst, (ok) => {
              if (ok) {
                window.fs.writeFileSync(dst, window.fs.readFileSync(src));
                window.fs.unlinkSync(src);
                moved++;
              }
              next(i + 1);
            });
          };
          next(0);
          return;
        }

        if (!window.fs.existsSync(sourcePath)) {
          term.writeln(`Error: File or directory not found: ${FormatDirectory(sourcePath)}`);
          resolve();
          return;
        }
        const targetDir = path.dirname(targetPath);
        if (targetDir !== '/' && !window.fs.existsSync(targetDir)) {
          window.fs.mkdirSync(targetDir, { recursive: true });
        }

        const stat = window.fs.statSync(sourcePath);
        if (stat.isDirectory()) {
          const copyDir = (src, dst) => {
            if (!window.fs.existsSync(dst)) window.fs.mkdirSync(dst, { recursive: true });
            window.fs.readdirSync(src).forEach(item => {
              const srcItem = path.join(src, item);
              const dstItem = path.join(dst, item);
              const itemStat = window.fs.statSync(srcItem);
              if (itemStat.isDirectory()) copyDir(srcItem, dstItem);
              else window.fs.writeFileSync(dstItem, window.fs.readFileSync(srcItem));
            });
          };
          copyDir(sourcePath, targetPath);
          deleteRecursive(sourcePath);
          term.writeln(`✓ Moved: ${FormatDirectory(sourcePath)} → ${FormatDirectory(targetPath)}`);
        } else {
          askOverwrite(targetPath, (ok) => {
            if (ok) {
              window.fs.writeFileSync(targetPath, window.fs.readFileSync(sourcePath));
              window.fs.unlinkSync(sourcePath);
              term.writeln(`✓ Moved: ${FormatDirectory(sourcePath)} → ${FormatDirectory(targetPath)}`);
            } else {
              term.writeln('Move cancelled.');
            }
            resolve();
          });
          return;
        }
      } catch (e) {
        term.writeln(`Error: ${e.message}`);
      }

      resolve();
    });
  }
}
