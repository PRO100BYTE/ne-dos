import {GetFiles} from "../StorageManager";

export default class DirectoryCommand {
  execute(term, params, directory, setDirectory) {
    const files = GetFiles(directory);
    let longestFileName = 2;
    files.forEach(d => {
      if (d.name.length > longestFileName) {
        longestFileName = d.name.length;
      }
    });

    term.writeln('');
    term.writeln(` Directory of ${directory}`);
    term.writeln('');

    term.writeln(`.${this.generateSpaces('.', longestFileName)}    DIRECTORY`);
    if (directory !== "C:\\") {
      term.writeln(`..${this.generateSpaces('..', longestFileName)}    DIRECTORY`);
    }

    files.forEach(file => {
      const n = file.name + this.generateSpaces(file.name, longestFileName);
      term.writeln(n + "    " + (file.type === "folder" ? "DIRECTORY" : file.type.toUpperCase()));
    });
    term.writeln('');
  }

  generateSpaces = (fileName, length) => {
    const estimatedLength = length - fileName.length;
    let result = "";
    for (let i = 0; i < estimatedLength; i++) {
      result += " ";
    }
    return result;
  };
}