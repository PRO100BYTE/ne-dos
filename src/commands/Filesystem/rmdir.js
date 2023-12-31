import path from "path-browserify";
import {PrepareInternal} from "./StorageManager";

export default class DeleteDirectoryCommand {
  execute(term, params, directory, setDirectory) {
    params.shift();
    const context = params.join(" ");
    if (!context || context === "") {
      term.writeln("Invalid path");
      return;
    }
    const target = path.resolve(directory, PrepareInternal(context));
    if (!window.fs.existsSync(target)) {
      term.writeln("No such file");
      return;
    }
    if (!window.fs.statSync(target).isDirectory()) {
      term.writeln("Not a directory, use del");
      return;
    }

    this.deleteRecursive(target);
  }

  description() {
    return "Delete directory";
  }

  deleteRecursive(directoryPath) {
    if (window.fs.existsSync(directoryPath)) {
      window.fs.readdirSync(directoryPath).forEach((f, i) => {
        const curPath = path.join(directoryPath, f);
        if (window.fs.statSync(curPath).isDirectory()) {
          this.deleteRecursive(curPath)
        } else {
          window.fs.unlinkSync(curPath);
        }
      });
      window.fs.rmdirSync(directoryPath);
    }
  }
}