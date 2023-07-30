import path from "path-browserify";
import {PrepareInternal} from "./StorageManager";

export default class DeleteCommand {
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
    if (window.fs.statSync(target).isDirectory()) {
      term.writeln("Is a directory, use rmdir");
      return;
    }
    window.fs.unlinkSync(target);
  }

  description() {
    return "Delete file";
  }
}