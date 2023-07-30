import columnify from "columnify";

export default class HelpCommand {
  execute(term, registeredCommands) {
    const data = [];
    Object.keys(registeredCommands).forEach(key => {
      const obj = registeredCommands[key];
      const description = (typeof obj.description === "function" ? obj.description() : "");
      data.push({
        command: key,
        description: description
      });
    });

    term.writeln(columnify(data, {
      config: {
        command: { minWidth: 10 },
        description: { minWidth: 20 }
      }
    }).replaceAll("\n", "\r\n"))
  }
  fetchHelp(term, registeredCommands, command) {
    if (!registeredCommands[command]) {
      term.writeln(`No help available for ${command}`);
      return;
    }

    if (typeof registeredCommands[command].help === 'function') {
      registeredCommands[command].help(term);
    } else {
      term.writeln(`No help available for ${command}`);
    }
  }
}