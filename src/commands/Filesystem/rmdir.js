import path from "path-browserify";
import {PrepareInternal} from "./StorageManager";

export default class DeleteDirectoryCommand {
  execute(term, params, directory, setDirectory) {
    if (!params[1] || params[1] === "") {
      term.writeln("Invalid path");
      return;
    }
    const target = path.resolve(directory, PrepareInternal(params[1]));
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
    return "Delete file";
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