import path from "path-browserify";
import bytes from "bytes";
import columnify from "columnify";
import { ResolveInCurrentDrive, FormatDirectory } from "./StorageManager";

export default class DirectoryCommand {
  execute(term, params, directory, setDirectory) {
    let param = params[1];
    if (!param || param === "") {
      param = '.';
    }

    const resolvedDir = ResolveInCurrentDrive(directory, param);

    if (!window.fs.existsSync(resolvedDir)) {
      term.writeln("No such directory");
      return;
    }
    if (!window.fs.statSync(resolvedDir).isDirectory()) {
      term.writeln("No such directory");
      return;
    }

    const entries = window.fs.readdirSync(resolvedDir).sort();
    const data = [];

    entries.forEach(entry => {
      const filename = path.resolve(resolvedDir, entry);
      const stat = window.fs.statSync(filename);

      let filetype;
      if (!stat.isDirectory()) {
        switch (filename.split('.')?.pop()?.toLowerCase()) {
          case 'json':
            filetype = 'json'
            break
          case 'md':
            filetype = 'markdown'
            break
          case 'txt':
            filetype = 'text'
            break
          case 'js':
            filetype = 'javascript'
            break
          default:
            filetype = null
        }
      }

      data.push({
        name: entry,
        type: (filetype ? filetype : (stat.isDirectory() ? 'directory' : 'file')).toUpperCase(),
        size: bytes(stat.size, {}).toLowerCase()
      });
    });

    term.writeln('');
    term.writeln(` Directory: ${FormatDirectory(resolvedDir)}`)
    term.writeln('');

    term.writeln(columnify(data, {
      config: {
        name: { minWidth: 20 },
        type: { minWidth: 15 },
        size: { minWidth: 8 }
      }
    }).replaceAll("\n", "\r\n"));
  }

  description() {
    return "List files in directory";
  }
}