import path from "path-browserify";
import {PrepareInternal} from "./StorageManager";

export default class MakeDirectoryCommand {
  execute(term, params, directory, setDirectory) {
    if (!params[1] || params[1] === "") {
      term.writeln("Invalid directory name");
      return;
    }
    const target = path.resolve(directory, PrepareInternal(params[1]));
    console.log(target);
    window.fs.mkdirSync(target);
  }

  description() {
    return "Create directory";
  }
}