import path from "path-browserify";
import {PrepareInternal} from "./StorageManager";
import * as BrowserFS from "browserfs";

export default class DownloadCommand {
  async execute(term, params, directory, setDirectory) {
    if (!params[1] || params[1] === "") {
      term.writeln("Invalid filename");
      return;
    }
    let filename = PrepareInternal(params[1]);
    if (/^(http|https|ftp|blob):/i.test(filename)) {
      const url = new URL(filename);
      filename = path.parse(url.pathname).base;
      if (params[2] && params[2] !== "") {
        filename = PrepareInternal(params[2]);
      }
      const buffer = await (await fetch(url.href)).arrayBuffer();
      // const data = window['buffer'].from(buffer);
      const data = window.Buffer.from(buffer);
      window.fs.writeFileSync(path.resolve(directory, filename), data);
    } else {
      filename = path.resolve(directory, filename);
      if (!window.fs.existsSync(filename)) {
        term.writeln("No such file");
        return;
      }
      if (window.fs.statSync(filename).isDirectory()) {
        term.writeln("Is a directory, can't download");
        return;
      }

      const data = window.fs.readFileSync(filename);
      const file = new File([data], path.parse(filename).base, { type: 'application/octet-stream' });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = path.parse(filename).base;
      link.click();
    }
  }

  description() {
    return "Download URL to NE-DOS or download FILE to PC";
  }
}