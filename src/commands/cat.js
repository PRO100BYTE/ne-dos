import path from "path-browserify";
import {PrepareInternal} from "../StorageManager";

export default class CatCommand {
  execute(term, params, directory, setDirectory) {
    let param = params[1];
    if (!param || param === "") {
      term.writeln("No such file");
      return;
    }
    param = PrepareInternal(param);

    const dir = path.resolve(directory, param);
    if (!window.fs.existsSync(dir)) {
      term.writeln("No such file");
      return;
    }
    if (window.fs.statSync(dir).isDirectory()) {
      term.writeln("Cannot read directory");
      return;
    }

    term.writeln(window.fs.readFileSync(dir, 'utf8').replaceAll("\n", "\r\n"));
  }
}