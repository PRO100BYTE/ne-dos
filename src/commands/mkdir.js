import path from "path-browserify";

export default class MakeDirectoryCommand {
  execute(term, params, directory, setDirectory) {
    if (!params[1] || params[1] === "") {
      term.writeln("Invalid directory name");
      return;
    }
    window.fs.mkdirSync(path.resolve(directory, params[1]));
  }
}