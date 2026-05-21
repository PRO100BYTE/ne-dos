import path from "path-browserify";
import { ResolveInCurrentDrive } from "./StorageManager";

export default class MakeDirectoryCommand {
  execute(term, params, directory, setDirectory) {
    if (!params[1] || params[1] === "") {
      term.writeln("Invalid directory name");
      return;
    }
    const target = ResolveInCurrentDrive(directory, params[1]);
    window.fs.mkdirSync(target);
  }

  description() {
    return "Create directory";
  }
}