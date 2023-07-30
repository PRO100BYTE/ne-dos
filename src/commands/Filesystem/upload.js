import path from "path-browserify";
import {FormatDirectory, PrepareInternal} from "./StorageManager";
import * as BrowserFS from "browserfs";

export default class UploadCommand {
  async execute(term, params, directory, setDirectory) {
    return new Promise(a => {
      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.addEventListener('change', e => {
        const { files } = e.target;
        for (const file of files) {
          const reader = new FileReader();
          reader.readAsArrayBuffer(file);
          reader.onload = () => {
            const buffer = window.Buffer.from(reader.result);
            const filepath = path.resolve(directory, file.name);
            window.fs.writeFileSync(filepath, buffer);
            term.writeln(`Uploaded ${FormatDirectory(filepath)}`);
            a();
          };
        }
      });
      input.click();
    });
  }

  description() {
    return "Upload file";
  }
}