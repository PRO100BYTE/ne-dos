import path from "path-browserify";

export default class ChangeDirectoryCommand {
  execute(term, params, directory, setDirectory) {
    let param = params[1];
    if (!param || param === "") {
      term.writeln("Invalid directory name");
      return;
    }
    param = param.replaceAll("\\", "/");

    const newCwd = path.resolve(directory, param);
    if (!window.fs.existsSync(newCwd)) {
      term.writeln("No such directory");
      return;
    }
    if (!window.fs.statSync(newCwd).isDirectory()) {
      term.writeln("No such directory");
      return;
    }
    setDirectory(newCwd);
  }
}