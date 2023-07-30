export default class EchoCommand {
    execute(term, params, directory, setDirectory) {
      if (params.length === 1) {
        term.writeln("");
        return;
      }
      params.shift();
      let string = params.join(" ");
      term.writeln(string);
    }
  }
  