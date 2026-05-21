import path from "path-browserify";
import { PrepareInternal, FormatDirectory } from "./StorageManager";

export default class MoveCommand {
  description() { return "Move a file or directory"; }
  help(term) {
    term.writeln("Usage: move <source> <target>");
    term.writeln("");
    term.writeln("  Moves (cuts and pastes) a file or directory to a new location.");
    term.writeln("  Use move /source /target or relative paths.");
    term.writeln("");
    term.writeln("  Example:");
    term.writeln("    move file.txt ./backup/file.txt");
    term.writeln("    move /music/song.mp3 /backup/song.mp3");
  }

  execute(term, params, currentDirectory, setDirectory) {
    return new Promise((resolve) => {
      if (!params[1] || !params[2]) {
        term.writeln("Usage: move <source> <target>");
        term.writeln("Try: help move");
        resolve();
        return;
      }

      try {
        // Resolve source and target paths
        const sourcePath = PrepareInternal(
          params[1].startsWith('/') ? params[1] : path.join(currentDirectory, params[1])
        );
        const targetPath = PrepareInternal(
          params[2].startsWith('/') ? params[2] : path.join(currentDirectory, params[2])
        );

        // Check if source exists
        if (!window.fs.existsSync(sourcePath)) {
          term.writeln(`Error: File or directory not found: ${FormatDirectory(sourcePath)}`);
          resolve();
          return;
        }

        // Check if target already exists
        if (window.fs.existsSync(targetPath)) {
          term.writeln(`Error: Target already exists: ${FormatDirectory(targetPath)}`);
          resolve();
          return;
        }

        // Ensure parent directory of target exists
        const targetDir = path.dirname(targetPath);
        if (targetDir !== '/' && !window.fs.existsSync(targetDir)) {
          window.fs.mkdirSync(targetDir, { recursive: true });
        }

        // Perform move (copy + delete)
        const stat = window.fs.statSync(sourcePath);
        if (stat.isDirectory()) {
          // Copy directory recursively
          const copyDir = (src, dst) => {
            if (!window.fs.existsSync(dst)) window.fs.mkdirSync(dst);
            window.fs.readdirSync(src).forEach(item => {
              const srcItem = path.join(src, item);
              const dstItem = path.join(dst, item);
              const itemStat = window.fs.statSync(srcItem);
              if (itemStat.isDirectory()) {
                copyDir(srcItem, dstItem);
              } else {
                const content = window.fs.readFileSync(srcItem);
                window.fs.writeFileSync(dstItem, content);
              }
            });
          };
          copyDir(sourcePath, targetPath);
          // Delete source directory recursively
          const rmDir = (p) => {
            window.fs.readdirSync(p).forEach(item => {
              const itemPath = path.join(p, item);
              const itemStat = window.fs.statSync(itemPath);
              if (itemStat.isDirectory()) {
                rmDir(itemPath);
              } else {
                window.fs.unlinkSync(itemPath);
              }
            });
            window.fs.rmdirSync(p);
          };
          rmDir(sourcePath);
          term.writeln(`✓ Moved: ${FormatDirectory(sourcePath)} → ${FormatDirectory(targetPath)}`);
        } else {
          // Copy file
          const content = window.fs.readFileSync(sourcePath);
          window.fs.writeFileSync(targetPath, content);
          // Delete source file
          window.fs.unlinkSync(sourcePath);
          term.writeln(`✓ Moved: ${FormatDirectory(sourcePath)} → ${FormatDirectory(targetPath)}`);
        }
      } catch (e) {
        term.writeln(`Error: ${e.message}`);
      }

      resolve();
    });
  }
}
