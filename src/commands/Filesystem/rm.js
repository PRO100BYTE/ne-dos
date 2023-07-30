import path from "path-browserify";
import {PrepareInternal} from "./StorageManager";

export default class DeleteCommand {
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