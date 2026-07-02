import path from "path-browserify";
import { PrepareInternal, FormatDirectory } from "./StorageManager";

export default class CopyCommand {
  description() { return "Copy a file or directory (supports wildcards, /y, /-y)"; }
  help(term) {
    term.writeln("Usage: copy [/y|/-y] <source> <target>");
    term.writeln("");
    term.writeln("  Copies a file or directory to a new location.");
    term.writeln("  Supports source templates: * and ?");
    term.writeln("  /y   overwrite without confirmation");
    term.writeln("  /-y  ask before overwrite");
    term.writeln("  Use copy /source /target or relative paths.");
    term.writeln("");
    term.writeln("  Example:");
    term.writeln("    copy file.txt backup.txt");
    term.writeln("    copy /music/song.mp3 /backup/song.mp3");
  }

  execute(term, params, currentDirectory, setDirectory) {
    return new Promise((resolve) => {
      const args = params.slice(1);
      const noConfirm = args.map(a => a.toLowerCase()).includes('/y');
      const askConfirm = args.map(a => a.toLowerCase()).includes('/-y');
      const paths = args.filter(a => !a.startsWith('/'));

      if (!paths[0] || !paths[1]) {
        term.writeln("Usage: copy [/y|/-y] <source> <target>");
        term.writeln("Try: help copy");
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
          if (key === 'y') {
            disp.dispose();
            term.writeln('Y');
            cb(true);
          } else if (key === 'n' || key === '\r' || key === '\x1b') {
            disp.dispose();
            term.writeln('N');
            cb(false);
          }
        });
      };

      const copyFile = (src, dst) => {
        const targetDir = path.dirname(dst);
        if (targetDir !== '/' && !window.fs.existsSync(targetDir)) {
          window.fs.mkdirSync(targetDir, { recursive: true });
        }
        const content = window.fs.readFileSync(src);
        window.fs.writeFileSync(dst, content);
      };

      const copyDir = (src, dst) => {
        if (!window.fs.existsSync(dst)) window.fs.mkdirSync(dst, { recursive: true });
        window.fs.readdirSync(src).forEach(item => {
          const srcItem = path.join(src, item);
          const dstItem = path.join(dst, item);
          const itemStat = window.fs.statSync(srcItem);
          if (itemStat.isDirectory()) {
            copyDir(srcItem, dstItem);
          } else {
            copyFile(srcItem, dstItem);
          }
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
          const entries = window.fs.readdirSync(srcDir);
          const re = wildcardToRegExp(mask);
          const matches = entries.filter(name => re.test(name));
          if (!matches.length) {
            term.writeln('0 file(s) copied.');
            resolve();
            return;
          }

          const targetIsDir = window.fs.existsSync(targetPath) && window.fs.statSync(targetPath).isDirectory();
          const dstBase = targetIsDir ? targetPath : path.dirname(targetPath);
          if (dstBase !== '/' && !window.fs.existsSync(dstBase)) window.fs.mkdirSync(dstBase, { recursive: true });

          let copied = 0;
          const processNext = (i) => {
            if (i >= matches.length) {
              term.writeln(`${copied} file(s) copied.`);
              resolve();
              return;
            }
            const name = matches[i];
            const src = path.join(srcDir, name);
            if (window.fs.statSync(src).isDirectory()) return processNext(i + 1);
            const dst = path.join(dstBase, name);
            askOverwrite(dst, (ok) => {
              if (ok) { copyFile(src, dst); copied++; }
              processNext(i + 1);
            });
          };
          processNext(0);
          return;
        }

        if (!window.fs.existsSync(sourcePath)) {
          term.writeln(`Error: File or directory not found: ${FormatDirectory(sourcePath)}`);
          resolve();
          return;
        }

        const stat = window.fs.statSync(sourcePath);
        if (stat.isDirectory()) {
          if (window.fs.existsSync(targetPath) && !window.fs.statSync(targetPath).isDirectory()) {
            term.writeln(`Error: Target exists and is not a directory: ${FormatDirectory(targetPath)}`);
            resolve();
            return;
          }
          copyDir(sourcePath, targetPath);
          term.writeln(`✓ Copied: ${FormatDirectory(sourcePath)} → ${FormatDirectory(targetPath)}`);
        } else {
          askOverwrite(targetPath, (ok) => {
            if (ok) {
              copyFile(sourcePath, targetPath);
              term.writeln(`✓ Copied: ${FormatDirectory(sourcePath)} → ${FormatDirectory(targetPath)}`);
            } else {
              term.writeln('Copy cancelled.');
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
