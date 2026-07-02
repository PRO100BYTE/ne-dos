import path from "path-browserify";
import { PrepareInternal, FormatDirectory } from "./StorageManager";

export default class RenameCommand {
  description() { return "Rename a file or directory (supports /y and wildcards)"; }
  help(term) {
    term.writeln("Usage: rename [/y|/-y] <source> <target>");
    term.writeln("");
    term.writeln("  Renames a file or directory to a new name or path.");
    term.writeln("  Supports source templates * and ? for files in one directory.");
    term.writeln("");
    term.writeln("  Example:");
    term.writeln("    rename oldfile.txt newfile.txt");
    term.writeln("    rename /music/song.mp3 /music/newsong.mp3");
  }

  execute(term, params, currentDirectory, setDirectory) {
    return new Promise((resolve) => {
      const args = params.slice(1);
      const noConfirm = args.map(a => a.toLowerCase()).includes('/y');
      const askConfirm = args.map(a => a.toLowerCase()).includes('/-y');
      const paths = args.filter(a => !a.startsWith('/'));

      if (!paths[0] || !paths[1]) {
        term.writeln("Usage: rename [/y|/-y] <source> <target>");
        term.writeln("Try: help rename");
        resolve();
        return;
      }

      const wildcardToRegExp = (pattern) => {
        const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        return new RegExp('^' + esc.replaceAll('*', '.*').replaceAll('?', '.') + '$', 'i');
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
          const renameMask = path.basename(targetPath);
          const toName = (name) => {
            // Basic DOS-like replacement for single '*' in target mask.
            if (!renameMask.includes('*')) return renameMask;
            const sourceStem = name.split('.').slice(0, -1).join('.') || name;
            return renameMask.replace('*', sourceStem);
          };
          const entries = window.fs.readdirSync(srcDir).filter(n => re.test(n));
          let changed = 0;
          const next = (i) => {
            if (i >= entries.length) {
              term.writeln(`${changed} file(s) renamed.`);
              resolve();
              return;
            }
            const oldName = entries[i];
            const src = path.join(srcDir, oldName);
            if (window.fs.statSync(src).isDirectory()) return next(i + 1);
            const dst = path.join(srcDir, toName(oldName));
            askOverwrite(dst, (ok) => {
              if (ok) {
                window.fs.writeFileSync(dst, window.fs.readFileSync(src));
                window.fs.unlinkSync(src);
                changed++;
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
        const stat = window.fs.statSync(sourcePath);
        if (stat.isDirectory()) {
          if (window.fs.existsSync(targetPath)) {
            term.writeln(`Error: Target already exists: ${FormatDirectory(targetPath)}`);
            resolve();
            return;
          }
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
          const rmDir = (p) => {
            window.fs.readdirSync(p).forEach(item => {
              const itemPath = path.join(p, item);
              if (window.fs.statSync(itemPath).isDirectory()) rmDir(itemPath);
              else window.fs.unlinkSync(itemPath);
            });
            window.fs.rmdirSync(p);
          };
          copyDir(sourcePath, targetPath);
          rmDir(sourcePath);
        } else {
          askOverwrite(targetPath, (ok) => {
            if (ok) {
              window.fs.writeFileSync(targetPath, window.fs.readFileSync(sourcePath));
              window.fs.unlinkSync(sourcePath);
              term.writeln(`✓ Renamed: ${FormatDirectory(sourcePath)} → ${FormatDirectory(targetPath)}`);
            } else {
              term.writeln('Rename cancelled.');
            }
            resolve();
          });
          return;
        }
        term.writeln(`✓ Renamed: ${FormatDirectory(sourcePath)} → ${FormatDirectory(targetPath)}`);
      } catch (e) {
        term.writeln(`Error: ${e.message}`);
      }

      resolve();
    });
  }
}
