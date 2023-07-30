import path from "path-browserify";

export default class CatCommand {
  execute(term, params, directory, setDirectory) {
    let param = params[1];
    if (!param || param === "") {
      term.writeln("No such file");
      return;
    }
    param = param.replaceAll("\\", "/");

    const dir = path.resolve(directory, param);
    if (!window.fs.existsSync(dir)) {
      term.writeln("No such file");
      return;
    }
    if (window.fs.statSync(dir).isDirectory()) {
      term.writeln("Cannot read directory");
      return;
    }

    term.writeln(window.fs.readSync(dir, 'utf8').replaceAll("\n", "\r\n"));
  }
}