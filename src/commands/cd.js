import {FormatDirectory, GetFiles} from "../StorageManager";

export default class ChangeDirectoryCommand {
  execute(term, params, directory, setDirectory) {
    let targetDirectory = params[1];
    if (!targetDirectory) {
      term.writeln(`Directory not exists`);
      return;
    }

    const files = GetFiles(directory);
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      if (file.name === targetDirectory) {
        if (file.type === "folder") {
          setDirectory(FormatDirectory(directory) + '\\' + file.name);
        } else {
          term.writeln(`Not a directory`);
        }
        return;
      }
    }
    term.writeln(`Directory not exists`);
  }
}