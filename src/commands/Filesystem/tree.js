import path from "path-browserify";
import columnify from "columnify";
import {PrepareInternal} from "./StorageManager";

export default class TreeCommand {
  execute(term, params, directory, setDirectory) {
    // здесь создайте логику команды
    let param = params[1];
    if (!param || param === "") {
      param = directory;
    } else {
      param = PrepareInternal(param);
    }

    if (!window.fs.existsSync(path.resolve(directory, param))) {
      term.writeln("No such directory");
      return;
    }
    if (!window.fs.statSync(path.resolve(directory, param)).isDirectory()) {
      term.writeln("No such directory");
      return;
    }

    const entries = window.fs.readdirSync(path.resolve(directory, param)).sort();
    const data = [];

    // функция для рекурсивного обхода дерева файлов
    const traverseTree = (dir, prefix) => {
      const files = window.fs.readdirSync(dir).sort();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = path.resolve(dir, file);
        const stat = window.fs.statSync(filename);
        // добавляем символы в зависимости от положения файла в дереве
        const symbol = i === files.length - 1 ? "└── " : "├── ";
        data.push(prefix + symbol + file);
        // если файл является директорией, то продолжаем обход
        if (stat.isDirectory()) {
          traverseTree(filename, prefix + (i === files.length - 1 ? "    " : "│   "));
        }
      }
    };

    // запускаем обход с корневой директории
    traverseTree(path.resolve(directory, param), "");

    term.writeln('');
    term.writeln(` Directory: C:${path.resolve(directory, param).replaceAll("/", "\\")}`)
    term.writeln('');

    term.writeln(columnify(data, {
      config: {
        name: { minWidth: 20 },
      }
    }).replaceAll("\n", "\r\n"));
  }

  description() {
    // Краткое описание Вашей команды (для команды help)
    return "Display the tree structure of files in a directory";
  }

  help(term) {
    // Действия программы при получении помощи
    // Выполняется при 'help your_command'
    term.writeln("Usage: tree [directory]");
    term.writeln("If no directory is given, the current directory is used.");
  }
}
