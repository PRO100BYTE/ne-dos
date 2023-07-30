import path from "path-browserify";
import bytes from "bytes";
import columnify from "columnify";

export default class DirectoryCommand {
  execute(term, params, directory, setDirectory) {
    let param = params[1];
    if (!param || param === "") {
      param = directory;
    } else {
      param = param.replaceAll("\\", "/");
    }

    const entries = window.fs.readdirSync(path.resolve(directory, param)).sort();
    const data = [];

    entries.forEach(entry => {
      const filename = path.resolve(directory, param, entry);
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
    term.writeln(` Directory: C:${path.resolve(directory, param).replaceAll("/", "\\")}`)
    term.writeln('');

    term.writeln(columnify(data, {
      config: {
        name: { minWidth: 20 },
        type: { minWidth: 15 },
        size: { minWidth: 8 }
      }
    }).replaceAll("\n", "\r\n"));
  }
}